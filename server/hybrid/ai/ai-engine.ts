import {
  buildBlockedKnowledgeResponse,
  buildKnowledgeRevisionInstruction,
  buildKnowledgeValidatorPrompt,
  extractJsonPayload,
  fallbackKnowledgeValidationResult,
  normalizeKnowledgeValidationResult
} from '../../knowledge-validation.js';
import {
  createOpenAIChatCompletionDetailed,
  streamOpenAIChatCompletion,
  type OpenAIChatCompletionUsage
} from '../../openai/openai-client.js';
import type { HybridPerformanceMonitor } from '../monitoring/performance-monitor.js';
import type {
  HybridChatRequest,
  HybridRoutingDecision,
  HybridStreamEvent,
  HybridUsageSnapshot,
  RetrievedDocument
} from '../types.js';
import type { AIHyperOptimizationEngine } from './ai-hyper-optimization-engine.js';

const roughTokenEstimate = (text: string): number => Math.max(1, Math.ceil(text.length / 4));

export class AIEngine {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly fastModel: string,
    private readonly optimizer: AIHyperOptimizationEngine,
    private readonly monitor: HybridPerformanceMonitor,
    private readonly enableFullAuditOnLowRisk: boolean
  ) {}

  private normalizeUsage(usage: OpenAIChatCompletionUsage | undefined, text: string): HybridUsageSnapshot {
    if (usage) {
      return {
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens
      };
    }

    return {
      completionTokens: roughTokenEstimate(text),
      totalTokens: roughTokenEstimate(text)
    };
  }

  private shouldUseFullAudit(request: HybridChatRequest): boolean {
    return this.enableFullAuditOnLowRisk ||
      request.validationContext.riskLevel !== 'low' ||
      request.validationContext.medicalSafetyApplied ||
      request.jsonMode;
  }

  private async auditResponse(
    request: HybridChatRequest,
    candidateResponse: string,
    model: string
  ) {
    if (!this.apiKey || !this.shouldUseFullAudit(request)) {
      return fallbackKnowledgeValidationResult(request.validationContext, candidateResponse);
    }

    const validatorPrompt = buildKnowledgeValidatorPrompt(request.validationContext, candidateResponse);

    try {
      const audit = await createOpenAIChatCompletionDetailed({
        apiKey: this.apiKey,
        model,
        messages: [
          { role: 'system', content: validatorPrompt.system },
          { role: 'user', content: validatorPrompt.user }
        ],
        temperature: 0.1,
        maxTokens: 900
      });
      const parsed = JSON.parse(extractJsonPayload(audit.text)) as unknown;
      return normalizeKnowledgeValidationResult(parsed, request.validationContext, candidateResponse);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Validator audit failed';
      return fallbackKnowledgeValidationResult(request.validationContext, candidateResponse, reason);
    }
  }

  async generate(
    request: HybridChatRequest,
    decision: HybridRoutingDecision,
    groundedResults: RetrievedDocument[]
  ): Promise<{
    text: string;
    validation: Awaited<ReturnType<AIEngine['auditResponse']>>;
    model: string;
    usage?: HybridUsageSnapshot;
    aiLatencyMs: number;
  }> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const model = this.optimizer.selectModel(request.model, decision, this.fastModel);
    const prepared = this.optimizer.buildMessages(request, groundedResults);
    const startedAt = Date.now();

    let completion = await createOpenAIChatCompletionDetailed({
      apiKey: this.apiKey,
      model,
      messages: prepared.messages,
      temperature: request.jsonMode ? 0.1 : 0.45,
      maxTokens: request.maxTokens
    });

    let text = completion.text;
    let validation = await this.auditResponse(request, text, model);

    if (validation.needsRevision || validation.blocked) {
      try {
        const revised = await createOpenAIChatCompletionDetailed({
          apiKey: this.apiKey,
          model,
          messages: [
            ...prepared.messages,
            { role: 'assistant', content: text },
            { role: 'system', content: buildKnowledgeRevisionInstruction(request.validationContext, validation) }
          ],
          temperature: request.jsonMode ? 0.1 : 0.2,
          maxTokens: request.maxTokens
        });

        const revisedValidation = await this.auditResponse(request, revised.text, model);
        if (revisedValidation.score >= validation.score || validation.blocked) {
          completion = revised;
          text = revised.text;
          validation = revisedValidation;
        }
      } catch {
        // Keep the original answer if revision fails.
      }
    }

    if (validation.blocked && !request.jsonMode) {
      text = buildBlockedKnowledgeResponse(request.validationContext, validation);
    }

    const aiLatencyMs = Date.now() - startedAt;
    const usage = this.normalizeUsage(completion.usage, text);
    this.monitor.recordAiUsage(aiLatencyMs, usage);

    return {
      text,
      validation,
      model,
      usage,
      aiLatencyMs
    };
  }

  async *stream(
    request: HybridChatRequest,
    decision: HybridRoutingDecision,
    groundedResults: RetrievedDocument[]
  ): AsyncGenerator<HybridStreamEvent> {
    if (
      !decision.allowStreaming ||
      request.validationContext.riskLevel === 'high' ||
      request.jsonMode ||
      !this.apiKey
    ) {
      const generated = await this.generate(request, decision, groundedResults);
      yield { type: 'chunk', delta: generated.text };
      yield {
        type: 'meta',
        route: groundedResults.length > 0 ? 'rag_ai' : 'ai',
        reason: decision.reason,
        cacheLayer: 'miss',
        validation: generated.validation,
        groundedResults,
        model: generated.model,
        metrics: {
          durationMs: generated.aiLatencyMs,
          cacheLayer: 'miss',
          aiLatencyMs: generated.aiLatencyMs
        },
        usage: generated.usage,
        cached: false
      };
      return;
    }

    const model = this.optimizer.selectModel(request.model, decision, this.fastModel);
    const prepared = this.optimizer.buildMessages(request, groundedResults);
    const startedAt = Date.now();
    let fullText = '';
    let usage: HybridUsageSnapshot | undefined;

    for await (const event of streamOpenAIChatCompletion({
      apiKey: this.apiKey,
      model,
      messages: prepared.messages,
      temperature: request.jsonMode ? 0.1 : 0.45,
      maxTokens: request.maxTokens
    })) {
      if (event.type === 'delta' && event.text) {
        fullText += event.text;
        yield { type: 'chunk', delta: event.text };
      }

      if (event.type === 'done') {
        usage = this.normalizeUsage(event.usage, fullText);
      }
    }

    const validation = await this.auditResponse(request, fullText, model);
    const aiLatencyMs = Date.now() - startedAt;
    this.monitor.recordAiUsage(aiLatencyMs, usage);

    yield {
      type: 'meta',
      route: groundedResults.length > 0 ? 'rag_ai' : 'ai',
      reason: decision.reason,
      cacheLayer: 'miss',
      validation,
      groundedResults,
      model,
      metrics: {
        durationMs: aiLatencyMs,
        cacheLayer: 'miss',
        aiLatencyMs
      },
      usage,
      cached: false
    };
  }
}
