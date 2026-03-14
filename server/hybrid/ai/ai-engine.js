import { createOpenAIChatCompletionDetailed, streamOpenAIChatCompletion } from '../../openai/openai-client.js';
const roughTokenEstimate = (text) => Math.max(1, Math.ceil(text.length / 4));
export class AIEngine {
    apiKey;
    fastModel;
    optimizer;
    monitor;
    constructor(apiKey, fastModel, optimizer, monitor) {
        this.apiKey = apiKey;
        this.fastModel = fastModel;
        this.optimizer = optimizer;
        this.monitor = monitor;
    }
    normalizeUsage(usage, text) {
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
    async generate(request, decision, groundedResults) {
        if (!this.apiKey) {
            throw new Error('OPENAI_API_KEY not configured');
        }
        const model = this.optimizer.selectModel(request.model, decision, this.fastModel);
        const prepared = this.optimizer.buildMessages(request, groundedResults);
        const startedAt = Date.now();
        const completion = await createOpenAIChatCompletionDetailed({
            apiKey: this.apiKey,
            model,
            messages: prepared.messages,
            temperature: typeof request.temperature === 'number' ? request.temperature : (request.jsonMode ? 0.1 : 0.45),
            maxTokens: request.maxTokens
        });
        const text = completion.text;
        const aiLatencyMs = Date.now() - startedAt;
        const usage = this.normalizeUsage(completion.usage, text);
        this.monitor.recordAiUsage(aiLatencyMs, usage);
        return {
            text,
            model,
            usage,
            aiLatencyMs
        };
    }
    async *stream(request, decision, groundedResults) {
        if (!decision.allowStreaming ||
            request.jsonMode ||
            !this.apiKey) {
            const generated = await this.generate(request, decision, groundedResults);
            yield { type: 'chunk', delta: generated.text };
            yield {
                type: 'meta',
                route: groundedResults.length > 0 ? 'rag_ai' : 'ai',
                reason: decision.reason,
                cacheLayer: 'miss',
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
        let usage;
        for await (const event of streamOpenAIChatCompletion({
            apiKey: this.apiKey,
            model,
            messages: prepared.messages,
            temperature: typeof request.temperature === 'number' ? request.temperature : (request.jsonMode ? 0.1 : 0.45),
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
        const aiLatencyMs = Date.now() - startedAt;
        this.monitor.recordAiUsage(aiLatencyMs, usage);
        yield {
            type: 'meta',
            route: groundedResults.length > 0 ? 'rag_ai' : 'ai',
            reason: decision.reason,
            cacheLayer: 'miss',
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
