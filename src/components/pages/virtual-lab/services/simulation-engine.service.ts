import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AIService } from '../../../../services/ai.service';
import { ChatService } from '../../../../services/chat.service';
import { NotificationService } from '../../../../services/notification.service';
import {
  PanelConfig,
  SimulationCaseSummary,
  SimulationFeedback,
  SimulationMessage,
  SimulationScenarioConfig,
  SimulationSessionMeta,
  SimulationStatus,
  SimulationTranscriptEntry,
  SimulationTurnRequest,
  SimulationTurnResponse,
  SpecialtyCategory,
  TimerConfig
} from '../models/virtual-lab.models';
import { SimulationActionParserService } from './simulation-action-parser.service';
import { ClinicalRecordService } from './clinical-record.service';
import { MedicalSimulationRuntimeService } from './medical-simulation-runtime.service';
import { PanelStateService } from './panel-state.service';
import { SimulationReportService } from './simulation-report.service';
import { SpecialtyProfile, SpecialtyProfileService } from './specialty-profile.service';
import { VirtualLabTimerService } from './timer.service';
import { VirtualLabSessionService } from './virtual-lab-session.service';
import { LiveMonitorService } from './live-monitor.service';

@Injectable({ providedIn: 'root' })
export class SimulationEngineService {
  private readonly ai = inject(AIService);
  private readonly chat = inject(ChatService);
  private readonly notifications = inject(NotificationService);
  private readonly panelState = inject(PanelStateService);
  private readonly medicalRuntime = inject(MedicalSimulationRuntimeService);
  private readonly clinicalRecords = inject(ClinicalRecordService);
  private readonly profiles = inject(SpecialtyProfileService);
  private readonly actionParser = inject(SimulationActionParserService);
  private readonly reports = inject(SimulationReportService);
  private readonly session = inject(VirtualLabSessionService);
  private readonly liveMonitor = inject(LiveMonitorService);
  readonly timer = inject(VirtualLabTimerService);

  readonly status = signal<SimulationStatus>('idle');
  readonly messages = signal<SimulationMessage[]>([]);
  readonly sessionMeta = signal<SimulationSessionMeta | null>(null);
  readonly panelConfig = signal<PanelConfig | null>(null);
  readonly quickOptions = signal<string[]>([]);
  readonly lastError = signal('');
  readonly caseSummary = signal<SimulationCaseSummary | null>(null);
  readonly activeFeedback = signal<SimulationFeedback | null>(null);
  readonly isMedicalSession = signal(false);

  readonly isBusy = computed(() => this.status() === 'starting' || this.status() === 'processing');
  readonly isComplete = computed(() => this.status() === 'completed' || this.status() === 'failed');
  readonly currentScore = computed(() => this.sessionMeta()?.score ?? 50);
  readonly progressPercent = computed(() => {
    const meta = this.sessionMeta();
    if (!meta || meta.estimatedTotalSteps <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round((meta.stepIndex / meta.estimatedTotalSteps) * 100)));
  });

  private transcript: SimulationTranscriptEntry[] = [];
  private activeConfig: SimulationScenarioConfig | null = null;
  private activeProfile: SpecialtyProfile | null = null;
  private promptToken: string | null = null;
  private usageRecorded = false;
  private outcomeRecorded = false;
  private clinicalRecordSaved = false;
  private feedbackTimeout: number | null = null;
  private streamingPreviewId: string | null = null;

  constructor() {
    effect(() => {
      if (!this.isMedicalSession()) {
        return;
      }

      this.syncMedicalRuntimeState();
      const summary = this.medicalRuntime.summary();
      if (summary) {
        this.caseSummary.set(summary);
      }
    });

    effect(() => {
      if (this.isMedicalSession()) {
        return;
      }
      const livePanel = this.liveMonitor.panelConfig();
      if (livePanel) {
        this.panelConfig.set(livePanel);
      }
    });
  }

  async startSession(config: SimulationScenarioConfig) {
    if (this.isBusy()) {
      return;
    }

    this.reset();
    this.activeConfig = config;
    this.activeProfile = this.profiles.resolveProfile(config.specialty, config.scenario);
    this.status.set('starting');
    this.lastError.set('');
    const usesMedicalRuntime = this.profiles.shouldUseMedicalRuntime(config, this.activeProfile) && !config.clinicalCase;

    if (usesMedicalRuntime) {
      this.liveMonitor.reset();
      this.isMedicalSession.set(true);
      const start = this.medicalRuntime.startCase(config);

      if (!this.usageRecorded) {
        this.ai.incrementUsage('virtualLabSimulations');
        this.usageRecorded = true;
      }

      this.syncMedicalRuntimeState();
      this.appendAssistantMessage(start.assistantMessage, 'intro');
      this.quickOptions.set([]);
      this.status.set('active');
      const nextToken = crypto.randomUUID();
      this.promptToken = nextToken;
      this.timer.arm(this.buildSessionTimerConfig(config, start.timer), nextToken, () => {
        void this.handleTimeout(nextToken);
      });
      this.notifications.show('Simulation Ready', this.medicalRuntime.sessionMeta()?.title || config.scenario, 'success', 'fa-solid fa-vial-circle-check');
      return;
    }

    const turn = await this.runTurn({
      config,
      requestType: 'start',
      transcript: [],
      sessionMeta: null,
      previousPanel: null
    });

    if (!this.usageRecorded) {
      this.ai.incrementUsage('virtualLabSimulations');
      this.usageRecorded = true;
    }

    this.applyTurn(turn, config, 'start');
    const nextToken = crypto.randomUUID();
    this.promptToken = nextToken;
    this.timer.arm(this.buildSessionTimerConfig(config, turn.timer), nextToken, () => {
      void this.handleTimeout(nextToken);
    });
    this.notifications.show('Simulation Ready', turn.sessionTitle, 'success', 'fa-solid fa-vial-circle-check');
  }

  async submitResponse(input: string) {
    const config = this.activeConfig;
    const normalizedInput = input.trim();
    if (!config || !normalizedInput || this.isBusy() || this.isComplete()) {
      return;
    }

    const action = this.actionParser.parse(normalizedInput);
    if (action.wantsExit) {
      this.exitSessionByRequest();
      return;
    }

    if (action.wantsTutor) {
      this.appendUserMessage(normalizedInput);
      await this.handoffToTutor(normalizedInput);
      return;
    }

    if (this.isMedicalSession()) {
      this.quickOptions.set([]);
      this.appendUserMessage(normalizedInput);
      if (action.wantsOptions) {
        const result = this.medicalRuntime.requestOptions();
        this.applyMedicalResult({
          assistantMessage: result.assistantMessage,
          feedback: {
            id: crypto.randomUUID(),
            tone: 'neutral',
            title: config.language === 'ar' ? 'خيارات ممكنة' : 'Possible Options',
            message: result.assistantMessage,
            icon: 'fa-solid fa-circle-info'
          },
          quickOptions: result.quickOptions,
          status: 'active',
          summary: null
        }, true);
        return;
      }

      const result = this.medicalRuntime.submitDecision(normalizedInput, action);
      this.applyMedicalResult(this.decorateMedicalResultWithConsultant(result, action), false);
      return;
    }

    const requestType = action.wantsOptions ? 'options' : 'decision';
    this.quickOptions.set([]);
    this.appendUserMessage(normalizedInput);
    this.liveMonitor.applyAction(action, normalizedInput, config.language);
    if (requestType === 'options') {
      this.serveLocalOptions(config);
      return;
    }
    this.status.set('processing');

    const turn = await this.runTurn({
      config,
      requestType,
      transcript: [...this.transcript],
      userInput: normalizedInput,
      sessionMeta: this.sessionMeta(),
      previousPanel: this.panelConfig()
    });

    this.applyTurn(turn, config, requestType, normalizedInput);
  }

  async requestOptions() {
    const config = this.activeConfig;
    if (!config || this.isBusy() || this.isComplete()) {
      return;
    }

    if (this.isMedicalSession()) {
      const result = this.medicalRuntime.requestOptions();
      this.quickOptions.set(result.quickOptions);
      this.appendAssistantMessage(result.assistantMessage, 'feedback');
      return;
    }

    this.serveLocalOptions(config);
  }

  async handleTimeout(token: string) {
    const config = this.activeConfig;
    if (!config || this.isComplete() || this.promptToken !== token) {
      return;
    }

    if (this.isBusy()) {
      window.setTimeout(() => {
        void this.handleTimeout(token);
      }, 160);
      return;
    }

    if (this.isMedicalSession()) {
      const result = this.medicalRuntime.handleTimeout();
      this.appendSystemMessage(
        config.language === 'ar'
          ? 'انتهى وقت الحالة. أُغلق التفاعل وبدأ إعداد التقرير النهائي.'
          : 'The case timer has expired. Interaction is closed and the final report is being prepared.',
        'timeout'
      );
      this.applyMedicalResult(result);
      return;
    }

    this.status.set('processing');

    const turn = await this.runTurn({
      config,
      requestType: 'timeout',
      transcript: [...this.transcript],
      sessionMeta: this.sessionMeta(),
      previousPanel: this.panelConfig()
    });

    this.applyTurn(turn, config, 'timeout');
  }

  reset(clearUsage: boolean = true) {
    this.clearFeedback();
    this.clearStreamingPreview();
    this.timer.clear();
    this.medicalRuntime.reset();
    this.liveMonitor.reset();
    this.status.set('idle');
    this.messages.set([]);
    this.sessionMeta.set(null);
    this.panelConfig.set(null);
    this.quickOptions.set([]);
    this.lastError.set('');
    this.caseSummary.set(null);
    this.activeFeedback.set(null);
    this.isMedicalSession.set(false);
    this.transcript = [];
    this.promptToken = null;
    this.activeConfig = null;
    this.activeProfile = null;
    if (clearUsage) {
      this.usageRecorded = false;
      this.outcomeRecorded = false;
      this.clinicalRecordSaved = false;
    }
  }

  private syncMedicalRuntimeState() {
    this.panelConfig.set(this.medicalRuntime.panelConfig());
    this.sessionMeta.set(this.decorateSessionMeta(this.medicalRuntime.sessionMeta(), this.activeConfig, this.activeProfile));
  }

  private applyMedicalResult(result: {
    assistantMessage: string;
    feedback: SimulationFeedback;
    quickOptions: string[];
    status: 'active' | 'completed' | 'failed';
    summary: SimulationCaseSummary | null;
  }, exposeOptions: boolean = false) {
    this.syncMedicalRuntimeState();
    if (result.assistantMessage) {
      this.appendAssistantMessage(result.assistantMessage, result.status === 'active' ? 'prompt' : 'feedback');
    }

    this.quickOptions.set(exposeOptions ? result.quickOptions : []);
    this.activeFeedback.set(result.feedback);
    this.scheduleFeedbackClear();

    if (result.summary) {
      this.caseSummary.set(result.summary);
    }

    if (result.status === 'active') {
      this.status.set('active');
      return;
    }

    this.status.set(result.status);
    this.timer.clear();
    this.recordOutcome(result.status, this.sessionMeta()?.title || this.activeConfig?.scenario || 'Medical simulation', this.currentScore());
    void this.persistClinicalRecord(result.status, result.summary || this.caseSummary());
  }

  private scheduleFeedbackClear() {
    if (this.feedbackTimeout !== null) {
      window.clearTimeout(this.feedbackTimeout);
    }

    this.feedbackTimeout = window.setTimeout(() => {
      this.activeFeedback.set(null);
      this.feedbackTimeout = null;
    }, 14000);
  }

  private clearFeedback() {
    if (this.feedbackTimeout !== null) {
      window.clearTimeout(this.feedbackTimeout);
      this.feedbackTimeout = null;
    }
    this.activeFeedback.set(null);
  }

  private async runTurn(request: SimulationTurnRequest): Promise<SimulationTurnResponse> {
    try {
      const payload = await this.requestAiTurn(request);
      return this.normalizeTurn(payload, request);
    } catch (error) {
      console.error('Simulation turn failed, using fallback response', error);
      this.lastError.set('AI simulation fallback engaged');
      return this.buildFallbackTurn(request);
    }
  }

  private async requestAiTurn(request: SimulationTurnRequest): Promise<unknown> {
    const profile = this.activeProfile || this.profiles.resolveProfile(request.config.specialty, request.config.scenario);
    const category = profile.category;
    const humanLanguage = request.config.language === 'ar' ? 'Arabic' : 'English';
    const parsedAction = request.userInput ? this.actionParser.parse(request.userInput) : null;
    const historyText = request.transcript.length > 0
      ? request.transcript.slice(-6).map((entry) => `${entry.role.toUpperCase()}: ${entry.text}`).join('\n')
      : 'No previous transcript yet.';
    const requestInstruction = request.requestType === 'start'
      ? 'Start the simulation immediately with role, setting, urgency, and the first decision prompt. Do not ask setup questions.'
      : request.requestType === 'timeout'
        ? 'The fixed lab duration has expired. Close the simulation with a final consequence and a defendable end state.'
        : request.requestType === 'options'
          ? 'The learner explicitly asked for options. Keep the session active and provide 3 or 4 plausible options in the options array. Do not reveal the best answer directly.'
          : `Learner response: "${request.userInput || ''}". Evaluate it logically, then continue the scenario.`;

    const caseInstruction = request.config.clinicalCase
      ? 'A clinical case JSON payload has been provided. Use it as the single source of truth. Do not invent a different patient, vitals, or story. Stay aligned to it.'
      : 'If no clinical case payload is provided, generate a realistic scenario from the specialty and scenario input.';

    const systemInstruction = [
      'You are an advanced interactive training simulation engine.',
      'Return strictly valid JSON only.',
      'Keep all user-facing prose directly in the requested language.',
      'The session must feel realistic, profession-specific, stepwise, and immersive.',
      caseInstruction,
      'The learner selected a fixed lab duration. Do not close the scenario before the timeout turn arrives unless the learner explicitly exits or asks for tutor handoff.',
      'Adapt every part of the experience to the chosen specialty profile instead of using generic wording.',
      'Use concise but vivid wording so the learner feels inside a real workplace, not a chatbot.',
      'Treat the timer as a fixed full-lab countdown rather than per-turn windows.',
      'Never include quick options unless the learner explicitly asked for them in this turn.',
      'If the learner asks for options, the options array must contain 3 or 4 plausible choices with mixed quality and only one strongest move.',
      'Unless the case is truly irreversible, do not end the scenario early. Let the learner recover after mistakes with realistic consequences.',
      'If the learner consulted a supervisor, consultant, manager, or senior, simulate that person briefly inside the assistantMessage while keeping the learner responsible for execution.',
      'If the learner provides calculations, assess whether the logic is correct and mention the error source if it is wrong.',
      'Return JSON with keys: sessionTitle, role, setting, objective, urgency, assistantMessage, nextPrompt, options, timer, status, scoreDelta, stepIndex, estimatedTotalSteps, timeoutMessage, coachLabel, consultantLabel, summary, panel.',
      'timer keys: enabled, seconds, label, urgency, autoStart.',
      'status must be one of active, completed, failed.',
      'panel.type must be one of medical-monitor, ecg, programming-console, business-metrics, law-evidence, science-chart, operations-board, generic-insights.',
      'For medical-monitor include monitor{heartRate,bloodPressure,oxygenSaturation,respiratoryRate,temperatureCelsius,alertLevel,ecgPreset}.',
      'For ecg include ecg{preset,caption} and select from normal, stemi, af, vtach only.',
      'For programming-console include console{environment,status,focusFile,logs[{level,text}],nextHint}.',
      'For business-metrics include metrics{headline,metrics[{label,value,delta,trend}],recommendation}.',
      'For law-evidence include evidence{hearingStage,evidence[{title,detail,weight}],proceduralNote}.',
      'For science-chart include chart{title,xLabel,yLabel,points[{label,value,emphasis}],insight}.',
      'For operations-board include operations{phase,headline,priorities[{label,detail,status}],actors[{role,status}],constraints[],tools[]}.',
      'For generic-insights include insights{cards[{label,value,note}]}.',
      'If status is completed or failed, include summary{title,subtitle,outcomeLabel,patientCourse,whatHappened[],correctActions[],incorrectActions[],vitalsImpact[],educationalAnalysis,strengths[],mistakesToAvoid[],recommendations[],initialSnapshotLabel,finalSnapshotLabel,initialSnapshot[],finalSnapshot[],correctActionsLabel,incorrectActionsLabel,impactLabel,recommendationsLabel,performanceDimensions[{label,value,note}]}.',
      `Write everything for the learner in ${humanLanguage}.`
    ].join(' ');

    const clinicalCaseContext = request.config.clinicalCase
      ? `Clinical case context (must follow exactly, do not invent conflicting details):\n${JSON.stringify(request.config.clinicalCase)}`
      : 'No pre-generated clinical case payload.';

    const message = [
      `Specialty: "${request.config.specialty}".`,
      `Scenario: "${request.config.scenario}".`,
      `Difficulty: ${request.config.difficulty}.`,
      `Lab duration: ${request.config.durationMinutes} minutes.`,
      `Specialty category: ${category}.`,
      clinicalCaseContext,
      this.profiles.buildPromptContext(profile, request.config),
      request.sessionMeta
        ? `Current session state: title="${request.sessionMeta.title || ''}", role="${request.sessionMeta.role || ''}", setting="${request.sessionMeta.setting || ''}", stepIndex=${request.sessionMeta.stepIndex || 0}, estimatedTotalSteps=${request.sessionMeta.estimatedTotalSteps || 0}, score=${request.sessionMeta.score || 50}, consultant="${request.sessionMeta.consultantLabel || ''}".`
        : 'No session state yet.',
      parsedAction
        ? `Parsed learner intent: wantsOptions=${parsedAction.wantsOptions}, wantsConsultant=${parsedAction.wantsConsultant}, consultantTarget="${parsedAction.consultantTarget || ''}", actionFamilies="${parsedAction.actionFamilies.join(',')}", mentionsCalculation=${parsedAction.mentionsCalculation}.`
        : 'No parsed learner action yet.',
      `Transcript:\n${historyText}`,
      requestInstruction,
      this.panelGuide(category, profile),
      `Preferred coach label: ${profile.personaTitle[request.config.language]}.`,
      `Preferred consultant label: ${profile.consultantTitle[request.config.language]}.`,
      'Do not ask the learner to configure the scene. Drop them directly into the active situation.'
    ].join('\n\n');

    const body = JSON.stringify({
      message,
      systemInstruction,
      jsonMode: true,
      maxTokens: 1400,
      featureHint: 'simulation',
      knowledgeMode: 'off'
    });

    this.startStreamingPreview(request.requestType);
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });

      const payload = await response.json().catch(() => null) as { text?: string; error?: string } | null;
      if (!response.ok || !payload?.text) {
        throw new Error(payload?.error || `Simulation request failed (${response.status})`);
      }

      return this.parseJson(payload.text);
    } finally {
      this.clearStreamingPreview();
    }
  }

  private async requestAiTurnStream(body: string, requestType: SimulationTurnRequest['requestType']): Promise<string> {
    this.startStreamingPreview(requestType);

    const response = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });

    if (!response.ok || !response.body) {
      throw new Error(`Streaming request failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        const event = JSON.parse(trimmed) as { type?: string; text?: string; delta?: string; error?: string };
        if (event.type === 'error') {
          throw new Error(event.error || 'Simulation streaming failed');
        }

        if (event.type === 'chunk' && typeof event.delta === 'string') {
          finalText += event.delta;
          const preview = this.extractAssistantPreview(finalText) || this.streamingPreviewLabel(requestType);
          this.updateStreamingPreview(preview);
        }

        if (event.type === 'meta') {
          continue;
        }

        if (event.type === 'done' && typeof event.text === 'string') {
          finalText = event.text;
        }
      }
    }

    this.clearStreamingPreview();
    return finalText;
  }

  private startStreamingPreview(requestType: SimulationTurnRequest['requestType']) {
    this.clearStreamingPreview();
    const id = crypto.randomUUID();
    this.streamingPreviewId = id;
    this.messages.update((current) => [...current, {
      id,
      role: 'assistant',
      text: this.streamingPreviewLabel(requestType),
      kind: requestType === 'start' ? 'intro' : 'prompt',
      timestamp: Date.now()
    }]);
  }

  private updateStreamingPreview(text: string) {
    if (!this.streamingPreviewId) {
      return;
    }

    this.messages.update((current) => current.map((message) =>
      message.id === this.streamingPreviewId
        ? { ...message, text: text || message.text }
        : message
    ));
  }

  private clearStreamingPreview() {
    if (!this.streamingPreviewId) {
      return;
    }

    const previewId = this.streamingPreviewId;
    this.streamingPreviewId = null;
    this.messages.update((current) => current.filter((message) => message.id !== previewId));
  }

  private streamingPreviewLabel(requestType: SimulationTurnRequest['requestType']) {
    const language = this.activeConfig?.language === 'ar' ? 'ar' : 'en';
    if (requestType === 'start') {
      return language === 'ar' ? 'جارٍ فتح الحالة...' : 'Opening the case...';
    }
    if (requestType === 'timeout') {
      return language === 'ar' ? 'جارٍ إنهاء الحالة...' : 'Closing the case...';
    }
    return language === 'ar' ? 'جارٍ توليد الرد السريري...' : 'Generating the next response...';
  }

  private extractAssistantPreview(rawJson: string): string {
    const keyIndex = rawJson.indexOf('"assistantMessage"');
    if (keyIndex < 0) {
      return '';
    }

    const colonIndex = rawJson.indexOf(':', keyIndex);
    const startQuote = rawJson.indexOf('"', colonIndex + 1);
    if (colonIndex < 0 || startQuote < 0) {
      return '';
    }

    let output = '';
    let escaped = false;
    for (let index = startQuote + 1; index < rawJson.length; index += 1) {
      const char = rawJson[index];
      if (escaped) {
        if (char === 'n') output += '\n';
        else if (char === 't') output += '\t';
        else if (char === 'r') output += '';
        else output += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        break;
      }

      output += char;
    }

    return output.trim();
  }

  private applyTurn(
    turn: SimulationTurnResponse,
    config: SimulationScenarioConfig,
    requestType: SimulationTurnRequest['requestType'],
    lastUserMessage: string = ''
  ) {
    const previousScore = this.sessionMeta()?.score ?? 50;
    const updatedScore = Math.max(0, Math.min(100, previousScore + turn.scoreDelta));
    const profile = this.activeProfile || this.profiles.resolveProfile(config.specialty, config.scenario);
    const category = profile.category;
    const resolvedPanel = this.panelState.resolvePanel(config, turn.panel, this.panelConfig(), lastUserMessage);
    const suppressEarlyClosure = requestType !== 'timeout' && turn.status !== 'active';
    const effectiveStatus = suppressEarlyClosure ? 'active' : turn.status;
    const combinedAssistantText = turn.nextPrompt && !turn.assistantMessage.includes(turn.nextPrompt)
      ? `${turn.assistantMessage}\n\n${turn.nextPrompt}`
      : turn.assistantMessage;
    const effectiveAssistantText = suppressEarlyClosure
      ? `${combinedAssistantText}\n\n${this.sessionContinuationPrompt(config, profile, turn.status)}`
      : combinedAssistantText;

    if (requestType === 'timeout' && turn.timeoutMessage) {
      this.appendSystemMessage(turn.timeoutMessage, 'timeout');
    }

    this.appendAssistantMessage(effectiveAssistantText, requestType === 'start' ? 'intro' : 'prompt');
    if (this.isMedicalSession()) {
      this.panelConfig.set(resolvedPanel);
    } else {
      this.liveMonitor.setPanel(resolvedPanel, { forceReset: requestType === 'start' });
      this.panelConfig.set(this.liveMonitor.panelConfig());
    }
    this.quickOptions.set(requestType === 'options' ? turn.options.slice(0, 4) : []);
    this.sessionMeta.set(this.decorateSessionMeta({
      title: turn.sessionTitle,
      role: turn.role,
      setting: turn.setting,
      objective: turn.objective,
      urgency: turn.urgency,
      specialtyCategory: category,
      stepIndex: turn.stepIndex,
      estimatedTotalSteps: turn.estimatedTotalSteps,
      score: updatedScore,
      coachLabel: turn.coachLabel,
      consultantLabel: turn.consultantLabel
    }, config, profile));

    if (effectiveStatus === 'completed' || effectiveStatus === 'failed') {
      const fallbackSummary = this.reports.buildSummary({
        config,
        profile,
        sessionMeta: this.sessionMeta(),
        transcript: [...this.transcript],
        score: updatedScore,
        status: effectiveStatus,
        closedReason: requestType === 'timeout' ? 'timer' : effectiveStatus === 'failed' ? 'critical-deterioration' : 'completed'
      });
      this.caseSummary.set(this.reports.normalizeSummary(turn.summary, fallbackSummary, profile, config.language));
      this.status.set(effectiveStatus);
      this.timer.clear();
      this.recordOutcome(effectiveStatus, turn.sessionTitle, updatedScore);
      void this.persistClinicalRecord(effectiveStatus, this.caseSummary());
      return;
    }

    this.status.set('active');
  }

  private appendUserMessage(text: string) {
    const message: SimulationMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      kind: 'note',
      timestamp: Date.now()
    };
    this.messages.update((current) => [...current, message]);
    this.transcript.push({ role: 'user', text });
  }

  private appendAssistantMessage(text: string, kind: SimulationMessage['kind']) {
    const message: SimulationMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text,
      kind,
      timestamp: Date.now()
    };
    this.messages.update((current) => [...current, message]);
    this.transcript.push({ role: 'assistant', text });
  }

  private appendSystemMessage(text: string, kind: SimulationMessage['kind']) {
    const message: SimulationMessage = {
      id: crypto.randomUUID(),
      role: 'system',
      text,
      kind,
      timestamp: Date.now()
    };
    this.messages.update((current) => [...current, message]);
  }

  private recordOutcome(status: 'completed' | 'failed', title: string, score: number) {
    if (this.outcomeRecorded) {
      return;
    }

    this.outcomeRecorded = true;
    this.ai.addPerformanceRecord({
      date: new Date().toISOString(),
      score,
      type: 'simulation',
      subject: title
    });

    if (status === 'completed') {
      this.ai.simulationsCompleted.update((value) => value + 1);
    }
  }

  private serveLocalOptions(config: SimulationScenarioConfig) {
    const profile = this.activeProfile || this.profiles.resolveProfile(config.specialty, config.scenario);
    const options = this.localOptions(profile.category, config, profile).slice(0, 4);
    const message = config.language === 'ar'
      ? `هذه الخيارات محلية وسريعة ومبنية على نمط الحالة الحالي. ${profile.hintStyle.ar}.`
      : `These options are fast local suggestions based on the current case pattern. ${profile.hintStyle.en}.`;

    this.quickOptions.set(options);
    this.appendAssistantMessage(message, 'feedback');
    this.activeFeedback.set({
      id: crypto.randomUUID(),
      tone: 'neutral',
      title: config.language === 'ar' ? 'خيارات ممكنة' : 'Possible Options',
      message,
      icon: 'fa-solid fa-circle-info'
    });
    this.scheduleFeedbackClear();
    this.status.set('active');
  }

  private async persistClinicalRecord(
    status: 'completed' | 'failed',
    summary: SimulationCaseSummary | null
  ) {
    if (this.clinicalRecordSaved) {
      return;
    }

    const config = this.activeConfig;
    const generatedCase = config?.generatedCase || this.buildGeneratedCaseFromClinicalCase(config?.clinicalCase || null, config) || null;
    if (!config || !generatedCase || !summary) {
      return;
    }

    this.clinicalRecordSaved = true;

    try {
      const totalSeconds = config.durationMinutes * 60;
      const timeSpentSeconds = Math.max(0, totalSeconds - this.timer.timeLeftSeconds());
      const treatmentChoices = this.transcript
        .filter((entry) => entry.role === 'user')
        .map((entry) => entry.text)
        .filter(Boolean)
        .slice(-16);

      await this.clinicalRecords.saveRecord({
        caseId: generatedCase.caseId,
        signature: generatedCase.signature,
        specialty: config.specialty,
        specialtyTrack: generatedCase.specialtyTrack,
        disease: generatedCase.diseaseLabelEn,
        difficulty: config.difficulty,
        score: Math.round(summary.score),
        status,
        date: new Date().toISOString(),
        timeSpentSeconds,
        mistakes: [...summary.incorrectActions, ...summary.mistakesToAvoid].filter(Boolean).slice(0, 12),
        correctDecisions: [...summary.correctActions, ...summary.strengths].filter(Boolean).slice(0, 12),
        treatmentChoices,
        title: summary.title || generatedCase.title,
        caseDescription: generatedCase.caseDescription || summary.patientCourse,
        finalEvaluation: summary.outcomeLabel,
        educationalAnalysis: summary.educationalAnalysis,
        transcript: this.messages().map((message) => ({
          role: message.role,
          text: message.text,
          timestamp: message.timestamp
        })),
        summary: summary as unknown as Record<string, unknown>,
        generatedCase
      });
    } catch (error) {
      this.clinicalRecordSaved = false;
      console.error('Failed to persist clinical record', error);
    }
  }

  private buildGeneratedCaseFromClinicalCase(clinicalCase: SimulationScenarioConfig['clinicalCase'] | null, config: SimulationScenarioConfig | null) {
    if (!clinicalCase || !config) {
      return null;
    }

    const requestedTopic = clinicalCase.requestedTopic || clinicalCase.title;
    const diseaseLabelEn = requestedTopic || clinicalCase.title;

    const ageGroup = clinicalCase.patient.age < 16
      ? 'child'
      : clinicalCase.patient.age > 64
        ? 'older-adult'
        : 'adult';

    const patientSex = (clinicalCase.patient.gender === 'female' ? 'female' : 'male') as 'male' | 'female';

    return {
      caseId: clinicalCase.caseId,
      sessionId: clinicalCase.sessionId,
      signature: `${clinicalCase.caseId}-${clinicalCase.sessionId}`,
      language: clinicalCase.language,
      specialty: clinicalCase.specialty,
      scenario: requestedTopic,
      specialtyTrack: clinicalCase.setting.careArea || clinicalCase.specialty,
      title: clinicalCase.title,
      diseaseKey: diseaseLabelEn.toLowerCase().replace(/\s+/g, '-'),
      diseaseLabel: clinicalCase.title,
      diseaseLabelEn,
      difficulty: config.difficulty,
      runtimeCategory: 'respiratory' as const,
      patientAge: clinicalCase.patient.age || 0,
      ageGroup: ageGroup as 'child' | 'adult' | 'older-adult',
      patientSex,
      severity: clinicalCase.setting.urgencyLevel || '',
      complication: '',
      source: '',
      medicalHistory: clinicalCase.pastMedicalHistory || [],
      chiefComplaint: clinicalCase.chiefComplaint,
      openingMessage: clinicalCase.historyOfPresentIllness,
      caseDescription: clinicalCase.historyOfPresentIllness,
      treatmentResponse: '',
      learningFocus: clinicalCase.learningObjectives || [],
      recommendedInvestigations: clinicalCase.availableTests || [],
      vitals: {
        heartRate: 0,
        respiratoryRate: 0,
        oxygenSaturation: 0,
        systolic: 0,
        diastolic: 0,
        temperatureCelsius: 0
      },
      labs: [],
      levelTier: 'bronze' as const,
      createdAt: new Date().toISOString()
    };
  }

  private normalizeTurn(input: unknown, request: SimulationTurnRequest): SimulationTurnResponse {
    const candidate = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const category = this.profiles.categorizeSpecialty(request.config.specialty, request.config.scenario);
    const fallback = this.buildFallbackTurn(request);
    const options = Array.isArray(candidate['options'])
      ? candidate['options'].filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 4)
      : fallback.options;

    return {
      sessionTitle: this.stringValue(candidate['sessionTitle'], fallback.sessionTitle),
      role: this.stringValue(candidate['role'], fallback.role),
      setting: this.stringValue(candidate['setting'], fallback.setting),
      objective: this.stringValue(candidate['objective'], fallback.objective),
      urgency: this.normalizeUrgency(candidate['urgency'], fallback.urgency),
      assistantMessage: this.stringValue(candidate['assistantMessage'], fallback.assistantMessage),
      nextPrompt: this.stringValue(candidate['nextPrompt'], fallback.nextPrompt),
      options,
      timer: this.normalizeTimer(candidate['timer'], fallback.timer, category, request),
      status: this.normalizeStatus(candidate['status'], fallback.status),
      scoreDelta: this.numberValue(candidate['scoreDelta'], fallback.scoreDelta, -25, 25),
      stepIndex: this.numberValue(candidate['stepIndex'], fallback.stepIndex, 1, 12),
      estimatedTotalSteps: this.numberValue(candidate['estimatedTotalSteps'], fallback.estimatedTotalSteps, 1, 12),
      timeoutMessage: typeof candidate['timeoutMessage'] === 'string' && candidate['timeoutMessage'].trim()
        ? candidate['timeoutMessage'].trim()
        : fallback.timeoutMessage,
      coachLabel: this.stringValue(candidate['coachLabel'], fallback.coachLabel || ''),
      consultantLabel: this.stringValue(candidate['consultantLabel'], fallback.consultantLabel || ''),
      summary: candidate['summary'] || fallback.summary,
      panel: candidate['panel'] || fallback.panel
    };
  }

  private buildFallbackTurn(request: SimulationTurnRequest): SimulationTurnResponse {
    const profile = this.activeProfile || this.profiles.resolveProfile(request.config.specialty, request.config.scenario);
    const category = profile.category;
    const parsedAction = request.userInput ? this.actionParser.parse(request.userInput) : null;
    const totalSteps = this.profiles.totalSteps(request.config.difficulty, request.config.durationMinutes);
    const currentStep = request.requestType === 'start'
      ? 1
      : Math.max(1, Math.min(totalSteps, (request.sessionMeta?.stepIndex || 1) + (request.requestType === 'options' ? 0 : 1)));
    const title = this.defaultTitle(request.config, profile);
    const role = this.defaultRole(profile, request.config);
    const setting = this.defaultSetting(profile, request.config);
    const objective = this.defaultObjective(profile, request.config);
    const timer = this.defaultTimer(category, request.config, request.requestType, currentStep);

    if (request.requestType === 'start') {
      return {
        sessionTitle: title,
        role,
        setting,
        objective,
        urgency: timer.enabled ? 'time-critical' : 'routine',
        assistantMessage: [
          `${profile.personaTitle[request.config.language]}.`,
          `${role}.`,
          `${setting}.`,
          this.openingSituation(category, request.config, profile),
          this.stepPrompt(category, request.config, currentStep, profile)
        ].join(' '),
        nextPrompt: this.stepPrompt(category, request.config, currentStep, profile),
        options: [],
        timer,
        status: 'active',
        scoreDelta: 0,
        stepIndex: currentStep,
        estimatedTotalSteps: totalSteps,
        coachLabel: profile.personaTitle[request.config.language],
        consultantLabel: profile.consultantTitle[request.config.language],
        panel: null
      };
    }

    if (request.requestType === 'options') {
      return {
        sessionTitle: title,
        role,
        setting,
        objective,
        urgency: timer.enabled ? 'time-critical' : 'routine',
        assistantMessage: request.config.language === 'ar'
          ? `هذه خيارات مبنية على منطق ${profile.displayName.ar}. فكّر في الإجراء الأقوى قبل أن تلتزم به.`
          : `These options follow the logic of ${profile.displayName.en}. Consider the strongest move before you commit.`,
        nextPrompt: this.stepPrompt(category, request.config, request.sessionMeta?.stepIndex || 1, profile),
        options: this.localOptions(category, request.config, profile),
        timer,
        status: 'active',
        scoreDelta: 0,
        stepIndex: request.sessionMeta?.stepIndex || 1,
        estimatedTotalSteps: totalSteps,
        coachLabel: profile.personaTitle[request.config.language],
        consultantLabel: profile.consultantTitle[request.config.language],
        panel: null
      };
    }

    const evaluation = request.requestType === 'timeout'
      ? 'timeout'
      : this.evaluateResponse(category, request.userInput || '', profile);
    const scoreDelta = request.requestType === 'timeout'
      ? -12
      : evaluation === 'strong'
        ? (request.config.difficulty === 'expert' ? 8 : 10)
        : evaluation === 'partial'
          ? 3
          : -6;
    const finalScore = Math.max(0, Math.min(100, (request.sessionMeta?.score ?? 50) + scoreDelta));
    const nextStatus = request.requestType === 'timeout'
      ? (finalScore >= (request.config.difficulty === 'expert' ? 68 : request.config.difficulty === 'hard' ? 62 : 58) ? 'completed' : 'failed')
      : 'active';
    const consultantText = parsedAction?.wantsConsultant
      ? this.consultantFallbackText(profile, request.config, parsedAction.consultantTarget)
      : '';
    const fallbackSummary = nextStatus === 'active'
      ? undefined
      : this.reports.buildSummary({
        config: request.config,
        profile,
        sessionMeta: this.decorateSessionMeta({
          title,
          role,
          setting,
          objective,
          urgency: timer.enabled ? 'time-critical' : 'routine',
          specialtyCategory: category,
          stepIndex: currentStep,
          estimatedTotalSteps: totalSteps,
          score: finalScore,
          coachLabel: profile.personaTitle[request.config.language],
          consultantLabel: profile.consultantTitle[request.config.language]
        }, request.config, profile),
        transcript: [...request.transcript, ...(request.userInput ? [{ role: 'user' as const, text: request.userInput }] : [])],
        score: finalScore,
        status: nextStatus,
        closedReason: request.requestType === 'timeout' ? 'timer' : nextStatus === 'failed' ? 'critical-deterioration' : 'completed'
      });

    return {
      sessionTitle: title,
      role,
      setting,
      objective,
      urgency: timer.enabled ? 'time-critical' : 'routine',
      assistantMessage: `${consultantText}${consultantText ? '\n\n' : ''}${this.buildFallbackOutcomeText(request, evaluation, currentStep, nextStatus, profile)}`,
      nextPrompt: nextStatus === 'active' ? this.stepPrompt(category, request.config, currentStep, profile) : this.finalPrompt(request.config, nextStatus),
      options: [],
      timer,
      status: nextStatus,
      scoreDelta,
      stepIndex: currentStep,
      estimatedTotalSteps: totalSteps,
      timeoutMessage: request.requestType === 'timeout'
        ? this.timeoutText(category, request.config)
        : undefined,
      coachLabel: profile.personaTitle[request.config.language],
      consultantLabel: profile.consultantTitle[request.config.language],
      summary: fallbackSummary,
      panel: null
    };
  }

  private buildFallbackOutcomeText(
    request: SimulationTurnRequest,
    evaluation: 'strong' | 'partial' | 'weak' | 'timeout',
    currentStep: number,
    nextStatus: 'active' | 'completed' | 'failed',
    profile: SpecialtyProfile
  ) {
    const language = request.config.language;
    if (evaluation === 'timeout') {
      if (nextStatus === 'failed') {
        return language === 'ar'
          ? 'تأخرت عن نافذة القرار الحرجة، فتقدمت الحالة من دون تدخلك وانتهى المسار الحالي بعواقب واضحة.'
          : 'You missed the critical decision window, the case moved on without your intervention, and the current path ended with clear consequences.';
      }

      return language === 'ar'
        ? 'انتهى الوقت قبل أن ترد، لذا تحملت الحالة نتيجة التأخير وانتقلت إلى المرحلة التالية تحت ضغط أكبر.'
        : 'Time expired before you responded, so the case absorbed the consequence of delay and moved into the next phase under higher pressure.';
    }

    if (nextStatus === 'completed') {
      return language === 'ar'
        ? `اختيارك الأخير حافظ على منطق محاكاة ${profile.displayName.ar}. أُغلقت الحالة بنهاية قابلة للدفاع ومبررة مهنيًا.`
        : `Your final move preserved the logic of the ${profile.displayName.en} simulation. The case closed with a professionally defensible outcome.`;
    }

    if (evaluation === 'strong') {
      return language === 'ar'
        ? `قرارك في المرحلة ${currentStep} كان قويًا وعمليًا، لذلك استقرت الصورة مؤقتًا لكن المشهد لا يزال يتطلب حكمًا دقيقًا.`
        : `Your decision in phase ${currentStep} was strong and practical, so the scene stabilized temporarily, but it still requires precise judgment.`;
    }

    if (evaluation === 'partial') {
      return language === 'ar'
        ? `قرارك خفف الضغط جزئيًا في المرحلة ${currentStep}، لكنه ترك نقطة ضعف ستعود سريعًا إذا لم تعالجها الآن.`
        : `Your move reduced pressure only partially in phase ${currentStep}, leaving a weakness that will return quickly if you do not address it now.`;
    }

    return language === 'ar'
      ? `هذه الاستجابة لم تعالج أخطر عنصر في المرحلة ${currentStep}، لذلك ارتفع مستوى المخاطر وانتقلت الحالة إلى وضع أكثر حساسية.`
      : `This response did not address the most dangerous element in phase ${currentStep}, so the risk level rose and the case moved into a more sensitive state.`;
  }

  private defaultTimer(
    category: SpecialtyCategory,
    config: SimulationScenarioConfig,
    requestType: SimulationTurnRequest['requestType'],
    stepIndex: number
  ): TimerConfig {
    if (requestType === 'options') {
      return {
        enabled: false,
        seconds: 0,
        label: config.language === 'ar' ? 'دون مؤقت' : 'Untimed',
        urgency: 'low',
        autoStart: false
      };
    }

    const scenarioText = `${config.specialty} ${config.scenario}`.toLowerCase();
    const urgentSignal = /(emergency|critical|distress|arrest|bleeding|shock|outage|attack|deadline|hearing|crash|incident|طارئ|حرج|نزيف|تعطل|هجوم|جلسة)/i.test(scenarioText);
    const baseEnabled = category === 'medical' || urgentSignal || ((config.difficulty === 'hard' || config.difficulty === 'expert') && category !== 'general');
    const seconds = config.durationMinutes * 60;

    return {
      enabled: seconds > 0,
      seconds,
      label: config.language === 'ar' ? 'مدة المختبر' : 'Lab Duration',
      urgency: baseEnabled ? ((config.difficulty === 'hard' || config.difficulty === 'expert') ? 'high' : 'moderate') : 'moderate',
      autoStart: seconds > 0,
      mode: 'case'
    };
  }

  private defaultTitle(config: SimulationScenarioConfig, profile: SpecialtyProfile) {
    return config.language === 'ar'
      ? `${profile.displayName.ar}: ${config.scenario}`
      : `${profile.displayName.en}: ${config.scenario}`;
  }

  private defaultRole(profile: SpecialtyProfile, config: SimulationScenarioConfig) {
    return profile.roleFrame[config.language];
  }

  private defaultSetting(profile: SpecialtyProfile, config: SimulationScenarioConfig) {
    return profile.defaultSetting[config.language];
  }

  private defaultObjective(profile: SpecialtyProfile, config: SimulationScenarioConfig) {
    if (config.language === 'ar') {
      return `حافظ على ${profile.evaluationRubric.map((item) => item.ar).slice(0, 2).join(' و')} أثناء تطور الحالة.`;
    }

    return `Protect ${profile.evaluationRubric.map((item) => item.en).slice(0, 2).join(' and ')} as the scenario evolves.`;
  }

  private openingSituation(category: SpecialtyCategory, config: SimulationScenarioConfig, profile: SpecialtyProfile) {
    if (config.language === 'ar') {
      switch (category) {
        case 'medical': return `بدأت حالة ${config.scenario} بالتدهور للتو، وكل دقيقة تغيّر ما يمكن إنقاذه.`;
        case 'programming': return `ظهر خلل مرتبط بـ ${config.scenario}، والأنظمة المتأثرة ما زالت تتلقى حركة نشطة.`;
        case 'business': return `قرار ${config.scenario} دخل لحظة حساسة، والمؤشرات المتعارضة بدأت تظهر مباشرة.`;
        case 'law': return `ملف ${config.scenario} دخل نقطة اعتراض أو إثبات حاسمة داخل الجلسة.`;
        case 'science': return `نتائج ${config.scenario} تحمل إشارة غير مستقرة وتحتاج إلى تفسير متزن الآن.`;
        case 'operations': return `وضع ${config.scenario} دخل لحظة تنفيذية حساسة داخل ${profile.displayName.ar} ويحتاج قرارًا عمليًا واضحًا.`;
        default: return `الوضع المرتبط بـ ${config.scenario} تصاعد وأصبح يتطلب قرارًا مهنيًا واضحًا.`;
      }
    }

    switch (category) {
      case 'medical': return `The ${config.scenario} case has just started to deteriorate, and each minute changes what can still be rescued.`;
      case 'programming': return `A fault tied to ${config.scenario} just surfaced, and affected systems are still under live traffic.`;
      case 'business': return `The ${config.scenario} decision has entered a sensitive moment, and conflicting metrics are appearing immediately.`;
      case 'law': return `The ${config.scenario} matter has entered a pivotal objection or proof stage inside the hearing.`;
      case 'science': return `The results around ${config.scenario} show an unstable signal and need disciplined interpretation now.`;
      case 'operations': return `The ${config.scenario} situation has entered a sensitive execution moment inside ${profile.displayName.en} and now demands a practical decision.`;
      default: return `The situation around ${config.scenario} escalated and now requires a clear professional decision.`;
    }
  }

  private stepPrompt(category: SpecialtyCategory, config: SimulationScenarioConfig, stepIndex: number, profile: SpecialtyProfile) {
    if (config.language === 'ar') {
      switch ((stepIndex - 1) % 5) {
        case 0: return 'ما الإجراء الأول الأكثر أولوية الآن؟';
        case 1: return category === 'medical' ? 'ما التدخل التالي الأفضل قبل أن تتغير المؤشرات؟' : 'ما الخطوة التالية الأكثر منطقية؟';
        case 2: return category === 'operations' ? `أي قيد أو خطر داخل ${profile.displayName.ar} يجب التعامل معه الآن؟` : 'أي عنصر في المشهد هو الأكثر إثارة للقلق الآن؟';
        case 3: return 'ما الاستجابة الأكثر مناسبة في هذه اللحظة؟';
        default: return 'ما الذي يجب فعله أولاً في هذا التطور الجديد؟';
      }
    }

    switch ((stepIndex - 1) % 5) {
      case 0: return 'What is the highest-priority first move right now?';
      case 1: return category === 'medical' ? 'What is the next best intervention before the indicators shift again?' : 'What is the next best step?';
      case 2: return category === 'operations' ? `Which execution risk inside ${profile.displayName.en} demands attention now?` : 'Which signal is the most concerning at this point?';
      case 3: return 'What is the most appropriate response in this moment?';
      default: return 'What should be done first after this new development?';
    }
  }

  private finalPrompt(config: SimulationScenarioConfig, status: 'completed' | 'failed') {
    if (config.language === 'ar') {
      return status === 'completed'
        ? 'تم إغلاق الحالة. راجع كيف أثرت قراراتك على النتيجة النهائية.'
        : 'انتهى هذا المسار. راجع أين تأخر القرار أو فقدت الأولوية الصحيحة.';
    }

    return status === 'completed'
      ? 'The case is now closed. Review how your decisions shaped the final outcome.'
      : 'This path has ended. Review where timing or prioritization broke down.';
  }

  private timeoutText(category: SpecialtyCategory, config: SimulationScenarioConfig) {
    if (config.language === 'ar') {
      switch (category) {
        case 'medical': return 'انتهى الوقت. تدهورت الحالة لأن نافذة التدخل القصير قد مرّت.';
        case 'law': return 'انتهى الوقت. تحركت الجلسة إلى الخطوة التالية وفاتت فرصة الاعتراض.';
        case 'programming': return 'انتهى الوقت. استمر الخلل وأثر على نطاق أوسع من الخدمة.';
        default: return 'انتهى الوقت. مرّت لحظة القرار وانتقلت الحالة إلى تبعات التأخير.';
      }
    }

    switch (category) {
      case 'medical': return 'Time is over. The patient deteriorated because the short intervention window passed.';
      case 'law': return 'Time is over. The hearing moved forward and the objection window passed.';
      case 'programming': return 'Time is over. The fault continued and affected a wider part of the service.';
      default: return 'Time is over. The decision window passed and the scenario advanced with the consequence of delay.';
    }
  }

  private localOptions(category: SpecialtyCategory, config: SimulationScenarioConfig, profile: SpecialtyProfile): string[] {
    if (config.language === 'ar') {
      switch (category) {
        case 'medical':
          return ['تقييم ABC بسرعة ثم التدخل في الأخطر أولاً', 'انتظار استقرار إضافي قبل التحرك', 'التركيز على التفاصيل الثانوية قبل الأولويات'];
        case 'programming':
          return ['إعادة إنتاج الخطأ وقراءة السجلات الحية', 'إعادة تشغيل كل شيء بلا تشخيص', 'إعلان الحل قبل تأكيد السبب'];
        case 'business':
          return ['اختبار الأثر على الهامش والعملاء معًا', 'خفض السعر فورًا بلا قياس', 'تأجيل القرار رغم استمرار النزيف'];
        case 'law':
          return ['الاعتراض المحدد مع أساس قانوني واضح', 'الاعتراض العام غير المؤسس', 'الصمت رغم الضرر الإجرائي'];
        case 'operations':
          return [
            `ابدأ بأخطر عنصر تشغيلي داخل ${profile.displayName.ar} ثم اربطه بخطوة تنفيذ واضحة`,
            'انتقل مباشرة إلى التنفيذ من دون مراجعة القيود أو المخاطر',
            'استشر المشرف لكن احتفظ بالقرار العملي التالي بيدك'
          ];
        default:
          return ['تحديد الأولوية الأخطر ثم التحرك', 'جمع المزيد من الإشارات ثم التبرير', 'القفز إلى قرار نهائي بلا تحقق'];
      }
    }

    switch (category) {
      case 'medical':
        return ['Run a rapid ABC assessment and act on the highest threat first', 'Wait for more stability before acting', 'Focus on secondary detail before the priority'];
      case 'programming':
        return ['Reproduce the failure and inspect live logs', 'Restart everything without diagnosing', 'Declare the issue solved before confirming the cause'];
      case 'business':
        return ['Test the impact on margin and customer response together', 'Cut price immediately without measurement', 'Delay the decision while losses continue'];
      case 'law':
        return ['Make a precise objection tied to a clear rule', 'Raise a vague objection without foundation', 'Stay silent despite procedural harm'];
      case 'operations':
        return [
          `Start with the highest operational risk inside ${profile.displayName.en} and tie it to a clear next move`,
          'Jump into execution without checking the governing constraints',
          'Consult the supervisor while still keeping the next practical move in your hands'
        ];
      default:
        return ['Identify the highest-risk priority and move on it first', 'Collect one more signal and justify the next move', 'Jump to a final decision without verification'];
    }
  }

  private evaluateResponse(category: SpecialtyCategory, input: string, profile: SpecialtyProfile): 'strong' | 'partial' | 'weak' {
    const normalized = input.trim().toLowerCase();
    if (!normalized) {
      return 'weak';
    }

    const strongSignals: Record<SpecialtyCategory, string[]> = {
      medical: ['abc', 'airway', 'breathing', 'circulation', 'oxygen', 'monitor', 'ecg', 'iv', 'stabilize', 'assess'],
      programming: ['log', 'trace', 'reproduce', 'rollback', 'deploy', 'debug', 'test', 'stack', 'monitor'],
      business: ['margin', 'segment', 'experiment', 'pricing', 'customer', 'cohort', 'forecast', 'trade-off'],
      law: ['object', 'objection', 'foundation', 'relevance', 'hearsay', 'preserve', 'record', 'rule'],
      science: ['control', 'variable', 'baseline', 'outlier', 'hypothesis', 'evidence', 'replicate'],
      operations: ['assess', 'inspect', 'review', 'sequence', 'risk', 'safety', 'client', 'brief', 'constraint', 'supervisor'],
      general: ['priority', 'first', 'assess', 'risk', 'stabilize', 'evidence', 'verify']
    };

    const profileMatches = profile.vocabulary.filter((signal) => normalized.includes(signal.toLowerCase())).length;
    const matches = strongSignals[category].filter((signal) => normalized.includes(signal)).length + profileMatches;
    if (matches >= 2 || normalized.split(/\s+/).length >= 10) {
      return 'strong';
    }

    if (matches === 1 || normalized.split(/\s+/).length >= 5) {
      return 'partial';
    }

    return 'weak';
  }

  private decorateSessionMeta(
    meta: SimulationSessionMeta | null,
    config: SimulationScenarioConfig | null,
    profile: SpecialtyProfile | null
  ): SimulationSessionMeta | null {
    if (!meta || !config || !profile) {
      return meta;
    }

    return {
      ...meta,
      specialtyLabel: profile.displayName[config.language],
      difficultyLabel: this.profiles.difficultyLabel(config.difficulty, config.language),
      coachLabel: meta.coachLabel || profile.personaTitle[config.language],
      consultantLabel: meta.consultantLabel || profile.consultantTitle[config.language],
      environmentLabel: meta.setting,
      specialtyProfileId: profile.id
    };
  }

  private consultantFallbackText(profile: SpecialtyProfile, config: SimulationScenarioConfig, target: string | null): string {
    const consultant = profile.consultantTitle[config.language];
    if (config.language === 'ar') {
      if (target === 'doctor' || target === 'pharmacist') {
        return `${consultant}: أعطني تقييمك المختصر أولًا ثم نفّذ الإجراء الأكثر أولوية وارجع لي بالاستجابة المباشرة.`;
      }
      if (target === 'engineer' || target === 'manager') {
        return `${consultant}: حدّد الخطر الأساسي، اقترح خطوة عملية الآن، ثم ادعمها بسبب واضح قبل أن نوسّع القرار.`;
      }
      if (target === 'lawyer') {
        return `${consultant}: لا تعطِني رأيًا عامًا. حدّد النقطة الإجرائية أو القانونية ثم تحرّك عليها بصياغة دقيقة.`;
      }
      return `${consultant}: سأوجّهك، لكنك ما زلت مسؤولًا عن القرار التالي. حدّد الأولوية وامضِ بها بوضوح.`;
    }

    if (target === 'doctor' || target === 'pharmacist') {
      return `${consultant}: Give me your brief assessment first, then execute the highest-priority move and report the immediate response.`;
    }
    if (target === 'engineer' || target === 'manager') {
      return `${consultant}: Identify the primary risk, name the practical move you will take now, and justify it before we widen the decision.`;
    }
    if (target === 'lawyer') {
      return `${consultant}: Do not give me a vague opinion. Identify the procedural or legal point and move on it precisely.`;
    }
    return `${consultant}: I can guide you, but you still own the next move. Name the priority and act on it clearly.`;
  }

  private criticalRecoveryPrompt(config: SimulationScenarioConfig, profile: SpecialtyProfile) {
    if (config.language === 'ar') {
      return `الحالة ما زالت نشطة لكنها دخلت وضعًا شديد الخطورة داخل ${profile.displayName.ar}. لم تُغلق المحاكاة بعد، وما زال أمامك وقت لتصحيح المسار قبل انتهاء المؤقت.`;
    }

    return `The scenario is still active, but it has entered a severe critical state inside ${profile.displayName.en}. The simulation is not closed yet, and you still have time to recover before the timer expires.`;
  }

  private sessionContinuationPrompt(
    config: SimulationScenarioConfig,
    profile: SpecialtyProfile,
    status: 'active' | 'completed' | 'failed'
  ) {
    if (status === 'failed') {
      return this.criticalRecoveryPrompt(config, profile);
    }

    if (config.language === 'ar') {
      return `المشهد داخل ${profile.displayName.ar} ما زال مفتوحًا لأن المختبر محدد بزمن ${config.durationMinutes} دقائق. استمر في العمل حتى انتهاء المؤقت أو اطلب الخروج إذا أردت إنهاء الجلسة.`;
    }

    return `The ${profile.displayName.en} simulation remains open because the lab runs on a fixed ${config.durationMinutes}-minute duration. Keep working until the timer ends, or explicitly exit if you want to leave the session.`;
  }

  private buildSessionTimerConfig(config: SimulationScenarioConfig, fallback?: TimerConfig): TimerConfig {
    return {
      enabled: true,
      seconds: config.durationMinutes * 60,
      label: config.language === 'ar' ? 'مدة المختبر' : 'Lab Duration',
      urgency: fallback?.urgency || (config.difficulty === 'hard' || config.difficulty === 'expert' ? 'high' : 'moderate'),
      autoStart: true,
      mode: 'case'
    };
  }

  private exitSessionByRequest() {
    const config = this.activeConfig;
    this.reset();
    this.session.routeTo('simulation-setup');
    this.notifications.show(
      config?.language === 'ar' ? 'الخروج من المختبر' : 'Exited Lab',
      config?.language === 'ar'
        ? 'تم إنهاء جلسة المحاكاة والعودة إلى إعداد المختبر.'
        : 'The simulation session was closed and you were returned to setup.',
      'warning',
      'fa-solid fa-door-open'
    );
  }

  private decorateMedicalResultWithConsultant(
    result: {
      assistantMessage: string;
      feedback: SimulationFeedback;
      quickOptions: string[];
      status: 'active' | 'completed' | 'failed';
      summary: SimulationCaseSummary | null;
    },
    action: ReturnType<SimulationActionParserService['parse']>
  ) {
    if (!action.wantsConsultant || !this.activeConfig || !this.activeProfile) {
      return result;
    }

    if (action.wantsDoctor || action.consultantTarget === 'doctor' || action.consultantTarget === 'pharmacist') {
      return result;
    }

    return {
      ...result,
      assistantMessage: `${this.consultantFallbackText(this.activeProfile, this.activeConfig, action.consultantTarget)}\n\n${result.assistantMessage}`
    };
  }

  private async handoffToTutor(userInput: string) {
    const config = this.activeConfig;
    const profile = this.activeProfile;
    if (!config || !profile) {
      return;
    }

    this.timer.clear();
    this.status.set('completed');

    let summary: SimulationCaseSummary;
    if (this.isMedicalSession()) {
      const handoff = this.medicalRuntime.handoffToTutor();
      summary = handoff.summary;
      this.caseSummary.set(summary);
    } else {
      summary = this.reports.buildSummary({
        config,
        profile,
        sessionMeta: this.sessionMeta(),
        transcript: [...this.transcript],
        score: this.currentScore(),
        status: 'completed',
        closedReason: 'manual'
      });
      this.caseSummary.set(summary);
    }

    void this.persistClinicalRecord('completed', summary);

    const requestText = this.buildTutorLaunchRequest(config, profile, summary, userInput);
    this.chat.queueTutorLaunch({
      title: config.language === 'ar' ? `شرح محاكاة: ${config.scenario}` : `Simulation Debrief: ${config.scenario}`,
      context: {
        specialization: profile.displayName[config.language],
        subject: config.specialty,
        lesson: config.scenario,
        helpType: config.language === 'ar' ? 'شرح المحاكاة خطوة بخطوة' : 'Step-by-step simulation debrief'
      },
      userVisibleText: config.language === 'ar' ? 'أوقف الحالة واشرحها لي خطوة بخطوة.' : 'Stop the case and teach it to me step by step.',
      requestText
    });

    this.appendSystemMessage(
      config.language === 'ar'
        ? 'تم إيقاف الحالة ونقل السياق إلى المعلم الذكي مع حفظ ملخص منظم للمحاكاة.'
        : 'The case was paused and the context was handed to the AI Tutor with a structured simulation summary.',
      'note'
    );

    window.location.hash = '#dashboard/tutor';
  }

  private buildTutorLaunchRequest(
    config: SimulationScenarioConfig,
    profile: SpecialtyProfile,
    summary: SimulationCaseSummary,
    userInput: string
  ): string {
    const transcriptText = this.transcript
      .slice(-10)
      .map((entry) => `${entry.role.toUpperCase()}: ${entry.text}`)
      .join('\n');

    if (config.language === 'ar') {
      return [
        `حوّل هذه المحاكاة إلى وضع AI Tutor / Smart Teacher.`,
        `التخصص: ${profile.displayName.ar}.`,
        `المجال الذي أدخله الطالب: ${config.specialty}.`,
        `السيناريو: ${config.scenario}.`,
        `الصعوبة: ${this.profiles.difficultyLabel(config.difficulty, 'ar')}.`,
        `سبب التحويل: ${userInput}.`,
        `ملخص منظم للحالة:`,
        `- النتيجة: ${summary.outcomeLabel}`,
        `- ما حدث: ${summary.whatHappened.join(' | ')}`,
        `- القرارات القوية: ${summary.correctActions.join(' | ') || 'غير محددة'}`,
        `- القرارات الضعيفة: ${summary.incorrectActions.join(' | ') || 'غير محددة'}`,
        `- التحليل التعليمي: ${summary.educationalAnalysis}`,
        `- التوصيات: ${summary.recommendations.join(' | ')}`,
        `آخر سياق محادثة:\n${transcriptText || 'لا يوجد'}`,
        'اشرح للطالب بعمق: ما الذي كان يحدث، لماذا كان مهمًا، ما القرارات الصحيحة، ما الأخطاء، ما المنهجية المثلى، وكيف يفكر المحترف في هذه الحالة، ثم أعطه خطة تحسن عملية.'
      ].join('\n');
    }

    return [
      'Convert this live simulation into AI Tutor / Smart Teacher mode.',
      `Specialty profile: ${profile.displayName.en}.`,
      `User-entered field: ${config.specialty}.`,
      `Scenario: ${config.scenario}.`,
      `Difficulty: ${this.profiles.difficultyLabel(config.difficulty, 'en')}.`,
      `Reason for handoff: ${userInput}.`,
      'Structured case summary:',
      `- Outcome: ${summary.outcomeLabel}`,
      `- What happened: ${summary.whatHappened.join(' | ')}`,
      `- Strong decisions: ${summary.correctActions.join(' | ') || 'Not specified'}`,
      `- Weak decisions: ${summary.incorrectActions.join(' | ') || 'Not specified'}`,
      `- Educational analysis: ${summary.educationalAnalysis}`,
      `- Recommendations: ${summary.recommendations.join(' | ')}`,
      `Recent transcript:\n${transcriptText || 'None'}`,
      'Teach the learner deeply: what was happening, why it mattered, which moves were stronger, which mistakes mattered, what the ideal reasoning path looks like, how an expert would think through the scene, and how the learner should improve next time.'
    ].join('\n');
  }

  private normalizeTimer(
    value: unknown,
    fallback?: TimerConfig,
    category?: SpecialtyCategory,
    request?: SimulationTurnRequest
  ): TimerConfig {
    const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const base = fallback || this.defaultTimer(category || 'general', request?.config || {
      specialty: '',
      scenario: '',
      difficulty: 'medium',
      durationMinutes: 10,
      language: 'en'
    }, 'decision', 1);
    const urgency = candidate['urgency'] === 'high' || candidate['urgency'] === 'moderate' || candidate['urgency'] === 'low'
      ? candidate['urgency']
      : base.urgency;
    const seconds = this.numberValue(candidate['seconds'], base.seconds, 0, 300);

    return {
      enabled: typeof candidate['enabled'] === 'boolean' ? candidate['enabled'] : base.enabled,
      seconds,
      label: this.stringValue(candidate['label'], base.label),
      urgency,
      autoStart: typeof candidate['autoStart'] === 'boolean' ? candidate['autoStart'] : base.autoStart
    };
  }

  private normalizeUrgency(value: unknown, fallback: SimulationTurnResponse['urgency']): SimulationTurnResponse['urgency'] {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'routine' || normalized === 'time-critical' || normalized === 'critical') {
      return normalized;
    }
    return fallback;
  }

  private normalizeStatus(value: unknown, fallback: SimulationTurnResponse['status']): SimulationTurnResponse['status'] {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'active' || normalized === 'completed' || normalized === 'failed') {
      return normalized;
    }
    return fallback;
  }

  private panelGuide(category: SpecialtyCategory, _profile?: SpecialtyProfile) {
    switch (category) {
      case 'medical':
        return 'Use a medical-monitor panel by default. If the learner requests ECG or rhythm tracing, switch panel.type to ecg with one of the local presets.';
      case 'programming':
        return 'Use a programming-console panel with realistic logs and one clear next hint.';
      case 'business':
        return 'Use a business-metrics panel with 3 or 4 metrics showing the trade-off clearly.';
      case 'law':
        return 'Use a law-evidence panel with hearing stage, strongest evidence items, and a procedural note.';
      case 'science':
        return 'Use a science-chart panel with compact data points and a short insight.';
      case 'operations':
        return 'Use an operations-board panel with current phase, live priorities, active actors, constraints, and tools.';
      default:
        return 'Use a generic-insights panel with 3 or 4 concise cards relevant to the scene.';
    }
  }

  private isOptionsRequest(value: string) {
    return /(options|choices|hint|help me narrow|possible moves|اقتراحات|خيارات|دلني|ساعدني)/i.test(value);
  }

  private extractJsonPayload(raw: string): string {
    const trimmed = raw.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return fenced[1].trim();
    }

    const objectStart = trimmed.indexOf('{');
    const arrayStart = trimmed.indexOf('[');
    const start = objectStart >= 0 && arrayStart >= 0 ? Math.min(objectStart, arrayStart) : Math.max(objectStart, arrayStart);
    if (start < 0) {
      return trimmed;
    }

    const objectEnd = trimmed.lastIndexOf('}');
    const arrayEnd = trimmed.lastIndexOf(']');
    const end = Math.max(objectEnd, arrayEnd);
    return end >= start ? trimmed.slice(start, end + 1) : trimmed;
  }

  private parseJson(raw: string): unknown {
    return JSON.parse(this.extractJsonPayload(raw));
  }

  private stringValue(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  private numberValue(value: unknown, fallback: number, min: number, max: number) {
    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? fallback), 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, Math.round(parsed)));
  }
}
