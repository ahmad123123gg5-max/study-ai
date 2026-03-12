import { Injectable, inject } from '@angular/core';
import {
  ConsoleLine,
  EcgPanelData,
  EvidenceItem,
  InsightCard,
  LawEvidencePanelData,
  MedicalMonitorPanelData,
  MetricCard,
  OperationsActorItem,
  OperationsBoardData,
  OperationsPriorityItem,
  PanelConfig,
  PanelType,
  ProgrammingConsolePanelData,
  ScenarioConfig,
  ScienceDatum,
  SpecialtyCategory
} from '../models/virtual-lab.models';
import { SpecialtyProfileService } from './specialty-profile.service';

@Injectable({ providedIn: 'root' })
export class PanelStateService {
  private readonly profiles = inject(SpecialtyProfileService);

  categorizeSpecialty(value: string): SpecialtyCategory {
    return this.profiles.categorizeSpecialty(value);
  }

  resolvePanel(
    config: ScenarioConfig,
    rawPanel: unknown,
    previousPanel: PanelConfig | null,
    lastUserMessage: string = ''
  ): PanelConfig {
    const profile = this.profiles.resolveProfile(config.specialty, config.scenario);
    const category = profile.category;
    const candidate = rawPanel && typeof rawPanel === 'object' ? rawPanel as Record<string, unknown> : {};
    const requestedType = this.normalizePanelType(candidate.type);
    const wantsEcg = category === 'medical' && /(ecg|ekg|heart tracing|cardiac monitor|rhythm strip|تخطيط|نبض|قلب)/i.test(lastUserMessage);
    const preferredType = requestedType
      || (this.profiles.wantsMonitor({ ...config, language: 'en', difficulty: config.difficulty }, profile)
        ? 'medical-monitor'
        : profile.panelType);

    if (preferredType === 'ecg' || wantsEcg || candidate['ecg']) {
      if (category === 'medical') {
        return this.buildMedicalEcgPanel(config, candidate, previousPanel);
      }
    }

    if (preferredType === 'medical-monitor') {
      return this.buildMedicalMonitorPanel(config, candidate, previousPanel);
    }

    if (preferredType === 'programming-console') {
      return this.buildProgrammingPanel(config, candidate, previousPanel);
    }

    if (preferredType === 'business-metrics') {
      return this.buildBusinessPanel(config, candidate, previousPanel);
    }

    if (preferredType === 'law-evidence') {
      return this.buildLawPanel(config, candidate, previousPanel);
    }

    if (preferredType === 'science-chart') {
      return this.buildSciencePanel(config, candidate, previousPanel);
    }

    if (preferredType === 'operations-board' || category === 'operations') {
      return this.buildOperationsPanel(config, candidate, previousPanel);
    }

    return this.buildGenericPanel(config, candidate, previousPanel);
  }

  private buildMedicalMonitorPanel(config: ScenarioConfig, candidate: Record<string, unknown>, previousPanel: PanelConfig | null): PanelConfig {
    const previousMonitor = previousPanel?.monitor;
    const rawMonitor = candidate['monitor'] && typeof candidate['monitor'] === 'object'
      ? candidate['monitor'] as Record<string, unknown>
      : candidate;

    const monitor: MedicalMonitorPanelData = {
      heartRate: this.numberValue(rawMonitor['heartRate'], previousMonitor?.heartRate ?? 96, 30, 190),
      bloodPressure: this.stringValue(rawMonitor['bloodPressure'], previousMonitor?.bloodPressure ?? '124/78'),
      bloodPressureSystolic: this.numberValue(rawMonitor['bloodPressureSystolic'], previousMonitor?.bloodPressureSystolic ?? 124, 40, 220),
      bloodPressureDiastolic: this.numberValue(rawMonitor['bloodPressureDiastolic'], previousMonitor?.bloodPressureDiastolic ?? 78, 20, 140),
      oxygenSaturation: this.numberValue(rawMonitor['oxygenSaturation'], previousMonitor?.oxygenSaturation ?? 97, 60, 100),
      respiratoryRate: this.numberValue(rawMonitor['respiratoryRate'], previousMonitor?.respiratoryRate ?? 18, 6, 40),
      temperatureCelsius: this.numberValue(rawMonitor['temperatureCelsius'], previousMonitor?.temperatureCelsius ?? 37.0, 34, 42),
      alertLevel: this.normalizeAlertLevel(rawMonitor['alertLevel'], previousMonitor?.alertLevel ?? 'watch'),
      ecgPreset: this.normalizeEcgPreset(rawMonitor['ecgPreset'], previousMonitor?.ecgPreset ?? 'normal'),
      severity: this.normalizeSeverity(rawMonitor['severity'], previousMonitor?.severity ?? 'concerning'),
      statusLabel: this.stringValue(rawMonitor['statusLabel'], previousMonitor?.statusLabel ?? 'Watch closely'),
      trendNote: this.stringValue(rawMonitor['trendNote'], previousMonitor?.trendNote ?? 'Vitals are updating from the latest decision.'),
      alarmActive: typeof rawMonitor['alarmActive'] === 'boolean' ? rawMonitor['alarmActive'] : (previousMonitor?.alarmActive ?? false),
      patientState: previousMonitor?.patientState ?? {
        activeInterventions: [],
        pendingOrders: [],
        recentActions: [],
        lastClinicianResponse: '',
        doctorRequested: false,
        doctorResponded: false,
        monitoringActive: false
      },
      dosageCalculator: previousMonitor?.dosageCalculator ?? null
    };

    return {
      type: 'medical-monitor',
      title: this.stringValue(candidate['title'], 'Patient Monitor'),
      subtitle: this.stringValue(candidate['subtitle'], config.specialty),
      summary: this.stringValue(candidate['summary'], `Live vitals responding to each decision in ${config.scenario}.`),
      specialtyCategory: 'medical',
      monitor
    };
  }

  private buildMedicalEcgPanel(config: ScenarioConfig, candidate: Record<string, unknown>, previousPanel: PanelConfig | null): PanelConfig {
    const previousPreset = previousPanel?.ecg?.preset || previousPanel?.monitor?.ecgPreset || 'normal';
    const rawEcg = candidate['ecg'] && typeof candidate['ecg'] === 'object'
      ? candidate['ecg'] as Record<string, unknown>
      : candidate;
    const ecg: EcgPanelData = {
      preset: this.normalizeEcgPreset(rawEcg['preset'], previousPreset),
      caption: this.stringValue(rawEcg['caption'], 'Local ECG library view')
    };

    return {
      type: 'ecg',
      title: this.stringValue(candidate['title'], 'ECG Review'),
      subtitle: this.stringValue(candidate['subtitle'], config.scenario),
      summary: this.stringValue(candidate['summary'], 'A local rhythm strip is being shown based on the current scenario state.'),
      specialtyCategory: 'medical',
      ecg
    };
  }

  private buildProgrammingPanel(config: ScenarioConfig, candidate: Record<string, unknown>, previousPanel: PanelConfig | null): PanelConfig {
    const previousConsole = previousPanel?.console;
    const rawConsole = candidate['console'] && typeof candidate['console'] === 'object'
      ? candidate['console'] as Record<string, unknown>
      : candidate;
    const logsSource = Array.isArray(rawConsole['logs']) ? rawConsole['logs'] : [];
    const logs = logsSource.length > 0
      ? logsSource
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
        .map((entry) => ({
          level: this.normalizeConsoleLevel(entry['level'], 'info'),
          text: this.stringValue(entry['text'], 'No detail available')
        }))
        .slice(0, 6)
      : (previousConsole?.logs || this.defaultConsoleLogs(config));

    const consoleData: ProgrammingConsolePanelData = {
      environment: this.stringValue(rawConsole['environment'], previousConsole?.environment ?? 'staging'),
      status: this.stringValue(rawConsole['status'], previousConsole?.status ?? 'Investigating active incident'),
      focusFile: this.stringValue(rawConsole['focusFile'], previousConsole?.focusFile ?? 'src/app/core/handler.ts'),
      logs,
      nextHint: this.stringValue(rawConsole['nextHint'], previousConsole?.nextHint ?? 'Correlate the stack trace with the last deployment.')
    };

    return {
      type: 'programming-console',
      title: this.stringValue(candidate['title'], 'Runtime Console'),
      subtitle: this.stringValue(candidate['subtitle'], config.specialty),
      summary: this.stringValue(candidate['summary'], `Watch system output and narrow down the cause of ${config.scenario}.`),
      specialtyCategory: 'programming',
      console: consoleData
    };
  }

  private buildBusinessPanel(config: ScenarioConfig, candidate: Record<string, unknown>, previousPanel: PanelConfig | null): PanelConfig {
    const previousMetrics = previousPanel?.metrics;
    const rawMetrics = candidate['metrics'] && typeof candidate['metrics'] === 'object'
      ? candidate['metrics'] as Record<string, unknown>
      : candidate;
    const cardsSource = Array.isArray(rawMetrics['metrics']) ? rawMetrics['metrics'] : [];
    const metrics = cardsSource.length > 0
      ? cardsSource
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
        .map((entry) => ({
          label: this.stringValue(entry['label'], 'Metric'),
          value: this.stringValue(entry['value'], '--'),
          delta: this.stringValue(entry['delta'], '0%'),
          trend: this.normalizeTrend(entry['trend'], 'steady')
        }))
        .slice(0, 4)
      : (previousMetrics?.metrics || this.defaultBusinessMetrics());

    return {
      type: 'business-metrics',
      title: this.stringValue(candidate['title'], 'Impact Dashboard'),
      subtitle: this.stringValue(candidate['subtitle'], config.specialty),
      summary: this.stringValue(candidate['summary'], `Track the business effect of each move in ${config.scenario}.`),
      specialtyCategory: 'business',
      metrics: {
        headline: this.stringValue(rawMetrics['headline'], previousMetrics?.headline ?? 'Decision impact model'),
        metrics,
        recommendation: this.stringValue(rawMetrics['recommendation'], previousMetrics?.recommendation ?? 'Protect margin first, then manage volume.')
      }
    };
  }

  private buildLawPanel(config: ScenarioConfig, candidate: Record<string, unknown>, previousPanel: PanelConfig | null): PanelConfig {
    const previousEvidence = previousPanel?.evidence;
    const rawEvidence = candidate['evidence'] && typeof candidate['evidence'] === 'object'
      ? candidate['evidence'] as Record<string, unknown>
      : candidate;
    const evidenceSource = Array.isArray(rawEvidence['items'])
      ? rawEvidence['items']
      : Array.isArray(rawEvidence['evidence'])
        ? rawEvidence['evidence']
        : [];
    const evidence = evidenceSource.length > 0
      ? evidenceSource
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
        .map((entry) => ({
          title: this.stringValue(entry['title'], 'Item'),
          detail: this.stringValue(entry['detail'], 'Pending review'),
          weight: this.normalizeWeight(entry['weight'], 'medium')
        }))
        .slice(0, 5)
      : (previousEvidence?.evidence || this.defaultEvidenceItems(config));

    const evidenceData: LawEvidencePanelData = {
      hearingStage: this.stringValue(rawEvidence['hearingStage'], previousEvidence?.hearingStage ?? 'Cross-examination'),
      evidence,
      proceduralNote: this.stringValue(rawEvidence['proceduralNote'], previousEvidence?.proceduralNote ?? 'Anchor every objection to a specific rule.')
    };

    return {
      type: 'law-evidence',
      title: this.stringValue(candidate['title'], 'Case File'),
      subtitle: this.stringValue(candidate['subtitle'], config.specialty),
      summary: this.stringValue(candidate['summary'], `Review the strongest facts and procedural pressure points in ${config.scenario}.`),
      specialtyCategory: 'law',
      evidence: evidenceData
    };
  }

  private buildSciencePanel(config: ScenarioConfig, candidate: Record<string, unknown>, previousPanel: PanelConfig | null): PanelConfig {
    const previousChart = previousPanel?.chart;
    const rawChart = candidate['chart'] && typeof candidate['chart'] === 'object'
      ? candidate['chart'] as Record<string, unknown>
      : candidate;
    const pointsSource = Array.isArray(rawChart['points']) ? rawChart['points'] : [];
    const points: ScienceDatum[] = pointsSource.length > 0
      ? pointsSource
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
        .map((entry) => ({
          label: this.stringValue(entry['label'], 'Point'),
          value: this.numberValue(entry['value'], 50, 0, 100),
          emphasis: typeof entry['emphasis'] === 'string' ? entry['emphasis'].trim() : undefined
        }))
        .slice(0, 6)
      : (previousChart?.points || this.defaultSciencePoints(config));

    return {
      type: 'science-chart',
      title: this.stringValue(candidate['title'], 'Analysis Panel'),
      subtitle: this.stringValue(candidate['subtitle'], config.specialty),
      summary: this.stringValue(candidate['summary'], `A compact results view for the current ${config.scenario} simulation.`),
      specialtyCategory: 'science',
      chart: {
        title: this.stringValue(rawChart['title'], previousChart?.title ?? 'Observed results'),
        xLabel: this.stringValue(rawChart['xLabel'], previousChart?.xLabel ?? 'Measure'),
        yLabel: this.stringValue(rawChart['yLabel'], previousChart?.yLabel ?? 'Relative value'),
        points,
        insight: this.stringValue(rawChart['insight'], previousChart?.insight ?? 'Compare the outlier first before concluding.')
      }
    };
  }

  private buildGenericPanel(config: ScenarioConfig, candidate: Record<string, unknown>, previousPanel: PanelConfig | null): PanelConfig {
    const previousCards = previousPanel?.insights?.cards;
    const rawInsights = candidate['insights'] && typeof candidate['insights'] === 'object'
      ? candidate['insights'] as Record<string, unknown>
      : candidate;
    const cardsSource = Array.isArray(rawInsights['cards']) ? rawInsights['cards'] : [];
    const cards: InsightCard[] = cardsSource.length > 0
      ? cardsSource
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
        .map((entry) => ({
          label: this.stringValue(entry['label'], 'Signal'),
          value: this.stringValue(entry['value'], '--'),
          note: typeof entry['note'] === 'string' && entry['note'].trim() ? entry['note'].trim() : undefined
        }))
        .slice(0, 4)
      : (previousCards || this.defaultInsightCards(config));

    return {
      type: 'generic-insights',
      title: this.stringValue(candidate['title'], 'Situation Snapshot'),
      subtitle: this.stringValue(candidate['subtitle'], config.specialty),
      summary: this.stringValue(candidate['summary'], `A quick operational view for ${config.scenario}.`),
      specialtyCategory: 'general',
      insights: { cards }
    };
  }

  private buildOperationsPanel(config: ScenarioConfig, candidate: Record<string, unknown>, previousPanel: PanelConfig | null): PanelConfig {
    const previousOps = previousPanel?.operations;
    const rawOperations = candidate['operations'] && typeof candidate['operations'] === 'object'
      ? candidate['operations'] as Record<string, unknown>
      : candidate;
    const prioritiesSource = Array.isArray(rawOperations['priorities']) ? rawOperations['priorities'] : [];
    const actorsSource = Array.isArray(rawOperations['actors']) ? rawOperations['actors'] : [];

    const priorities: OperationsPriorityItem[] = prioritiesSource.length > 0
      ? prioritiesSource
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
        .map((entry) => ({
          label: this.stringValue(entry['label'], 'Priority'),
          detail: this.stringValue(entry['detail'], 'Pending review'),
          status: this.normalizePriorityStatus(entry['status'], 'watch')
        }))
        .slice(0, 4)
      : (previousOps?.priorities || this.defaultOperationsPriorities(config));

    const actors: OperationsActorItem[] = actorsSource.length > 0
      ? actorsSource
        .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
        .map((entry) => ({
          role: this.stringValue(entry['role'], 'Actor'),
          status: this.stringValue(entry['status'], 'Active')
        }))
        .slice(0, 4)
      : (previousOps?.actors || this.defaultOperationsActors(config));

    const constraints = this.stringArray(rawOperations['constraints'], previousOps?.constraints || [
      `Time pressure is affecting ${config.scenario}.`,
      'The next move must remain professionally defensible.'
    ]);
    const tools = this.stringArray(rawOperations['tools'], previousOps?.tools || [
      config.specialty,
      config.scenario,
      config.difficulty === 'expert' ? 'High-ambiguity brief' : 'Structured case brief'
    ]);

    const operations: OperationsBoardData = {
      phase: this.stringValue(rawOperations['phase'], previousOps?.phase ?? 'Active scenario'),
      headline: this.stringValue(rawOperations['headline'], previousOps?.headline ?? `Operational view for ${config.scenario}`),
      priorities,
      actors,
      constraints: constraints.slice(0, 4),
      tools: tools.slice(0, 4)
    };

    return {
      type: 'operations-board',
      title: this.stringValue(candidate['title'], 'Operations Board'),
      subtitle: this.stringValue(candidate['subtitle'], config.specialty),
      summary: this.stringValue(candidate['summary'], `Track actors, constraints, and actionable priorities inside ${config.scenario}.`),
      specialtyCategory: 'operations',
      operations
    };
  }

  private normalizePanelType(value: unknown): PanelType | null {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (
      normalized === 'medical-monitor' ||
      normalized === 'ecg' ||
      normalized === 'programming-console' ||
      normalized === 'business-metrics' ||
      normalized === 'law-evidence' ||
      normalized === 'science-chart' ||
      normalized === 'operations-board' ||
      normalized === 'generic-insights'
    ) {
      return normalized;
    }

    return null;
  }

  private normalizeAlertLevel(value: unknown, fallback: MedicalMonitorPanelData['alertLevel']): MedicalMonitorPanelData['alertLevel'] {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'stable' || normalized === 'watch' || normalized === 'critical') {
      return normalized;
    }
    return fallback;
  }

  private normalizeSeverity(value: unknown, fallback: MedicalMonitorPanelData['severity']): MedicalMonitorPanelData['severity'] {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'stable' || normalized === 'concerning' || normalized === 'unstable' || normalized === 'critical') {
      return normalized;
    }
    return fallback;
  }

  private normalizeEcgPreset(value: unknown, fallback: EcgPanelData['preset']): EcgPanelData['preset'] {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'normal' || normalized === 'stemi' || normalized === 'af' || normalized === 'vtach') {
      return normalized;
    }
    return fallback;
  }

  private normalizeConsoleLevel(value: unknown, fallback: ConsoleLine['level']): ConsoleLine['level'] {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'info' || normalized === 'warn' || normalized === 'error' || normalized === 'success') {
      return normalized;
    }
    return fallback;
  }

  private normalizeTrend(value: unknown, fallback: MetricCard['trend']): MetricCard['trend'] {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'up' || normalized === 'down' || normalized === 'steady') {
      return normalized;
    }
    return fallback;
  }

  private normalizeWeight(value: unknown, fallback: EvidenceItem['weight']): EvidenceItem['weight'] {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
      return normalized;
    }
    return fallback;
  }

  private normalizePriorityStatus(value: unknown, fallback: OperationsPriorityItem['status']): OperationsPriorityItem['status'] {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'critical' || normalized === 'watch' || normalized === 'ready') {
      return normalized;
    }
    return fallback;
  }

  private stringValue(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  private stringArray(value: unknown, fallback: string[]): string[] {
    const normalized = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
      : [];
    return normalized.length > 0 ? normalized : fallback;
  }

  private numberValue(value: unknown, fallback: number, min: number, max: number) {
    const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value ?? fallback));
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.max(min, Math.min(max, Math.round(numeric * 10) / 10));
  }

  private defaultConsoleLogs(config: ScenarioConfig): ConsoleLine[] {
    return [
      { level: 'error', text: `Unhandled failure while processing ${config.scenario}.` },
      { level: 'warn', text: 'Recent deployment introduced a timing regression.' },
      { level: 'info', text: 'Stack trace narrowed to one unstable service boundary.' }
    ];
  }

  private defaultBusinessMetrics(): MetricCard[] {
    return [
      { label: 'Revenue Impact', value: '-4.8%', delta: '-1.2%', trend: 'down' },
      { label: 'Conversion Rate', value: '3.1%', delta: '+0.3%', trend: 'up' },
      { label: 'Margin Pressure', value: 'High', delta: '+8 pts', trend: 'up' },
      { label: 'Customer Churn Risk', value: 'Watch', delta: '-2 pts', trend: 'steady' }
    ];
  }

  private defaultEvidenceItems(config: ScenarioConfig): EvidenceItem[] {
    return [
      { title: 'Primary testimony', detail: `Key witness account related to ${config.scenario}.`, weight: 'high' },
      { title: 'Timeline note', detail: 'Sequence of events includes one contested gap.', weight: 'medium' },
      { title: 'Procedural issue', detail: 'Opposing counsel is testing foundation and relevance.', weight: 'medium' }
    ];
  }

  private defaultSciencePoints(config: ScenarioConfig): ScienceDatum[] {
    return [
      { label: 'Baseline', value: 42 },
      { label: 'Observed shift', value: 68, emphasis: config.scenario },
      { label: 'Control check', value: 51 },
      { label: 'Outlier', value: 84 }
    ];
  }

  private defaultInsightCards(config: ScenarioConfig): InsightCard[] {
    return [
      { label: 'Focus', value: config.specialty },
      { label: 'Scenario', value: config.scenario },
      { label: 'Pressure', value: config.difficulty === 'expert' ? 'Extreme' : config.difficulty === 'hard' ? 'High' : config.difficulty === 'medium' ? 'Moderate' : 'Low' },
      { label: 'Goal', value: 'Stabilize the situation and justify the next move.' }
    ];
  }

  private defaultOperationsPriorities(config: ScenarioConfig): OperationsPriorityItem[] {
    return [
      { label: 'Primary risk', detail: `The core pressure point inside ${config.scenario}.`, status: 'critical' },
      { label: 'Next verification', detail: 'Identify the missing fact that should shape the next step.', status: 'watch' },
      { label: 'Professional standard', detail: `Keep the move aligned with ${config.specialty} expectations.`, status: 'ready' }
    ];
  }

  private defaultOperationsActors(config: ScenarioConfig): OperationsActorItem[] {
    return [
      { role: 'Lead learner', status: `Responsible for the next ${config.specialty} decision` },
      { role: 'Stakeholder', status: `Affected directly by ${config.scenario}` },
      { role: 'Supervisor', status: 'Available for escalation, not full takeover' }
    ];
  }
}
