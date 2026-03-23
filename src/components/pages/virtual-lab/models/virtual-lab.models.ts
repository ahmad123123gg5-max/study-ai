export type VirtualLabRoute = 'simulation-setup' | 'simulation-session' | 'simulation-progress' | 'simulation-review';
export type ScenarioDifficulty = 'easy' | 'medium' | 'hard' | 'expert';
export type SimulationDurationMinutes = 5 | 10 | 15;
export type SpecialtyCategory = 'medical' | 'programming' | 'business' | 'law' | 'science' | 'operations' | 'general';
export type SimulationStatus = 'idle' | 'starting' | 'active' | 'processing' | 'completed' | 'failed';
export type TimerUrgency = 'low' | 'moderate' | 'high';
export type MedicalSeverity = 'stable' | 'concerning' | 'unstable' | 'critical';
export type SimulationFeedbackTone = 'positive' | 'negative' | 'neutral';
export type SimulationCaseResult = 'success' | 'failure' | 'partial' | 'deteriorated';
export type ClinicalLevelTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type ClinicalLabStatus = 'normal' | 'watch' | 'critical';
export type ClinicalResultKind = 'lab-panel' | 'abg' | 'ecg' | 'imaging';
export type ClinicalImagingTone = 'xray' | 'ct' | 'mri' | 'ultrasound';
export type PanelType =
  | 'medical-monitor'
  | 'ecg'
  | 'programming-console'
  | 'business-metrics'
  | 'law-evidence'
  | 'science-chart'
  | 'operations-board'
  | 'generic-insights';

export interface ScenarioConfig {
  specialty: string;
  scenario: string;
  difficulty: ScenarioDifficulty;
  durationMinutes: SimulationDurationMinutes;
  referenceImages?: SimulationReferenceImage[];
}

export interface SimulationScenarioConfig extends ScenarioConfig {
  language: 'ar' | 'en';
  generatedCase?: GeneratedClinicalCase | null;
  clinicalCase?: ClinicalAiCase | null;
  tutorContext?: {
    topic: string;
    recentTopic?: string;
    explanationContext?: string;
    userIntent?: string;
    attachedFileContext?: string;
    selectedSpecialty?: string;
    sourceConversationId?: string;
    sourceMessageId?: string;
  } | null;
}

export interface SimulationReferenceImage {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
}

export interface ClinicalLabVariation {
  id: string;
  label: string;
  value: string;
  status: ClinicalLabStatus;
}

export interface GeneratedClinicalCase {
  caseId: string;
  sessionId: string;
  signature: string;
  language: 'ar' | 'en';
  specialty: string;
  scenario: string;
  specialtyTrack: string;
  title: string;
  diseaseKey: string;
  diseaseLabel: string;
  diseaseLabelEn: string;
  difficulty: ScenarioDifficulty;
  runtimeCategory: 'respiratory' | 'shock' | 'cardiac' | 'seizure';
  patientAge: number;
  ageGroup: 'neonate' | 'child' | 'adult' | 'older-adult';
  patientSex: 'male' | 'female';
  severity: string;
  complication: string;
  source: string;
  medicalHistory: string[];
  chiefComplaint: string;
  openingMessage: string;
  caseDescription: string;
  treatmentResponse: string;
  learningFocus: string[];
  recommendedInvestigations: string[];
  vitals: {
    heartRate: number;
    respiratoryRate: number;
    oxygenSaturation: number;
    systolic: number;
    diastolic: number;
    temperatureCelsius: number;
  };
  labs: ClinicalLabVariation[];
  levelTier: ClinicalLevelTier;
  createdAt: string;
}

export interface ClinicalAiCase {
  caseId: string;
  sessionId: string;
  specialty: string;
  difficulty: string;
  requestedTopic: string;
  language: 'ar' | 'en';
  title: string;
  patient: {
    name: string;
    age: number;
    gender: string;
    weight?: string;
    background?: string;
  };
  setting: {
    careArea?: string;
    urgencyLevel?: string;
    context?: string;
  };
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string[];
  medications: string[];
  allergies: string[];
  vitalSigns: {
    temperature: string;
    heartRate: string;
    bloodPressure: string;
    respiratoryRate: string;
    oxygenSaturation: string;
    painScore?: string;
  };
  physicalExam: {
    generalAppearance: string;
    systemFindings: string[];
  };
  initialClues: string[];
  redFlags: string[];
  expectedFocus: string[];
  progressionModel: {
    canDeteriorate: boolean;
    canImprove: boolean;
    triggers: string[];
  };
  availableTests: string[];
  initialManagementPossibilities: string[];
  learningObjectives: string[];
  aiNotesInternal: {
    notVisibleToStudent: true;
  };
}

export interface ClinicalRecordSummary {
  recordId: string;
  caseId: string;
  signature: string;
  specialty: string;
  specialtyTrack: string;
  disease: string;
  difficulty: ScenarioDifficulty;
  score: number;
  status: 'completed' | 'failed';
  date: string;
  timeSpentSeconds: number;
  mistakes: string[];
  correctDecisions: string[];
  treatmentChoices: string[];
  title: string;
  caseDescription: string;
  finalEvaluation: string;
  educationalAnalysis: string;
  transcript: Array<{ role: 'assistant' | 'user' | 'system'; text: string; timestamp?: number }>;
  summary: Record<string, unknown> | null;
  generatedCase: GeneratedClinicalCase | null;
  levelTier: ClinicalLevelTier;
}

export interface ClinicalSpecialtyCount {
  specialty: string;
  count: number;
}

export interface ClinicalProgressStats {
  totalCasesCompleted: number;
  averageScore: number;
  bestScore: number;
  worstScore: number;
  totalHoursPracticed: number;
  mostPracticedSpecialty: string;
  specialtyBreakdown: ClinicalSpecialtyCount[];
  levelTier: ClinicalLevelTier;
  recommendedDifficulty: ScenarioDifficulty;
}

export interface TimerConfig {
  enabled: boolean;
  seconds: number;
  label: string;
  urgency: TimerUrgency;
  autoStart: boolean;
  mode?: 'turn' | 'case';
}

export interface SimulationMessage {
  id: string;
  role: 'assistant' | 'user' | 'system';
  text: string;
  kind: 'intro' | 'prompt' | 'feedback' | 'timeout' | 'note' | 'consultant' | 'result' | 'alert';
  timestamp: number;
}

export interface SimulationTranscriptEntry {
  role: 'assistant' | 'user';
  text: string;
}

export interface SimulationSessionMeta {
  title: string;
  role: string;
  setting: string;
  objective: string;
  urgency: 'routine' | 'time-critical' | 'critical';
  specialtyCategory: SpecialtyCategory;
  stepIndex: number;
  estimatedTotalSteps: number;
  score: number;
  specialtyLabel?: string;
  difficultyLabel?: string;
  coachLabel?: string;
  consultantLabel?: string;
  environmentLabel?: string;
  specialtyProfileId?: string;
  patientLabel?: string;
  phaseLabel?: string;
}

export interface ActiveInterventionPanelData {
  id: string;
  label: string;
  detail: string;
  kind: 'oxygen' | 'airway' | 'access' | 'fluids' | 'monitoring' | 'device' | 'medication' | 'support';
  intensity: 'low' | 'medium' | 'high';
  startedAt: number;
  active: boolean;
}

export interface ClinicianOrderPanelData {
  id: string;
  label: string;
  instructions: string;
  category: 'medication' | 'monitoring' | 'procedure' | 'consult' | 'supportive-care' | 'investigation';
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: number;
}

export interface DosageCheckFeedback {
  status: 'correct' | 'incorrect' | 'needs-review';
  title: string;
  message: string;
  details?: string[];
}

export interface DosageCalculatorPanelData {
  visible: boolean;
  drugName: string;
  instruction: string;
  route: string;
  weightKg: number | null;
  dosePerKgMg: number | null;
  concentrationLabel?: string;
  concentrationMgPerMl: number | null;
  recommendedDoseMg: number | null;
  recommendedVolumeMl: number | null;
  submittedDoseMg?: number | null;
  submittedVolumeMl?: number | null;
  feedback?: DosageCheckFeedback | null;
}

export interface ClinicalHypothesisData {
  diagnosis: string;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
  primary?: boolean;
}

export interface MedicalPatientStatePanelData {
  activeInterventions: ActiveInterventionPanelData[];
  pendingOrders: ClinicianOrderPanelData[];
  recentActions: string[];
  lastClinicianResponse: string;
  doctorRequested: boolean;
  doctorResponded: boolean;
  monitoringActive: boolean;
  diagnosticHypotheses?: ClinicalHypothesisData[];
}

export interface MedicalMonitorPanelData {
  heartRate: number;
  bloodPressure: string;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  oxygenSaturation: number;
  respiratoryRate: number;
  temperatureCelsius: number;
  alertLevel: 'stable' | 'watch' | 'critical';
  ecgPreset: 'normal' | 'stemi' | 'af' | 'vtach';
  severity: MedicalSeverity;
  statusLabel: string;
  trendNote: string;
  alarmActive: boolean;
  patientState: MedicalPatientStatePanelData;
  dosageCalculator?: DosageCalculatorPanelData | null;
}

export interface VitalSnapshot {
  heartRate: number;
  oxygenSaturation: number;
  respiratoryRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  temperatureCelsius: number;
  severity: MedicalSeverity;
}

export interface SimulationFeedback {
  id: string;
  tone: SimulationFeedbackTone;
  title: string;
  message: string;
  icon: string;
}

export interface SimulationActionRecord {
  id: string;
  input: string;
  outcome: 'correct' | 'partial' | 'incorrect' | 'neutral';
  matchedActions: string[];
  effects: string[];
  severityBefore: MedicalSeverity;
  severityAfter: MedicalSeverity;
  vitalsBefore: VitalSnapshot;
  vitalsAfter: VitalSnapshot;
  createdAt: number;
}

export interface SimulationPerformanceMetric {
  label: string;
  value: string;
  note?: string;
}

export interface ClinicalPatientChartData {
  patientName: string;
  age: string;
  sex: string;
  specialtyFocus: string;
  caseTitle: string;
  chiefComplaint: string;
  triageNote: string;
  historyOfPresentIllness: string[];
  pastHistory: string[];
  medicationHistory: string[];
  allergies: string[];
  socialHistory: string[];
  riskFlags: string[];
}

export interface ClinicalExamSectionData {
  id: string;
  label: string;
  summary: string;
  findings: string[];
  status: 'baseline' | 'requested' | 'critical';
}

export interface ClinicalLabValueData {
  name: string;
  value: string;
  unit?: string;
  reference?: string;
  flag?: 'normal' | 'high' | 'low' | 'critical';
}

export interface ClinicalLabGroupData {
  id: string;
  label: string;
  items: ClinicalLabValueData[];
}

interface ClinicalResultViewerBase {
  id: string;
  kind: ClinicalResultKind;
  title: string;
  subtitle: string;
  note: string;
  requestedAt: number;
  urgent: boolean;
}

export interface ClinicalLabPanelResult extends ClinicalResultViewerBase {
  kind: 'lab-panel';
  groups: ClinicalLabGroupData[];
}

export interface ClinicalAbgPanelResult extends ClinicalResultViewerBase {
  kind: 'abg';
  values: ClinicalLabValueData[];
  interpretation: string;
}

export interface ClinicalEcgResult extends ClinicalResultViewerBase {
  kind: 'ecg';
  preset: 'normal' | 'stemi' | 'af' | 'vtach';
  interpretation: string;
  findings: string[];
}

export interface ClinicalImagingResult extends ClinicalResultViewerBase {
  kind: 'imaging';
  modality: string;
  tone: ClinicalImagingTone;
  findings: string[];
  impression: string;
  annotations: string[];
}

export type ClinicalResultViewer =
  | ClinicalLabPanelResult
  | ClinicalAbgPanelResult
  | ClinicalEcgResult
  | ClinicalImagingResult;

export interface ClinicalTimelineEvent {
  id: string;
  timeLabel: string;
  title: string;
  detail: string;
  tone: 'neutral' | 'positive' | 'warning' | 'critical';
}

export interface ClinicalEducationScoreCard {
  id: string;
  label: string;
  score: number;
  status: 'strong' | 'mixed' | 'weak';
  note: string;
}

export interface ClinicalDashboardPanelData {
  patientChart: ClinicalPatientChartData;
  highlightedExams: ClinicalExamSectionData[];
  results: ClinicalResultViewer[];
  featuredResultId: string | null;
  differentials: ClinicalHypothesisData[];
  timeline: ClinicalTimelineEvent[];
  alerts: string[];
  learningFocus: string[];
  scoreCards: ClinicalEducationScoreCard[];
}

export interface SimulationCaseSummary {
  result: SimulationCaseResult;
  closedReason: 'timer' | 'completed' | 'critical-deterioration' | 'manual';
  title: string;
  subtitle: string;
  outcomeLabel: string;
  patientCourse: string;
  whatHappened: string[];
  correctActions: string[];
  incorrectActions: string[];
  vitalsImpact: string[];
  educationalAnalysis: string;
  strengths: string[];
  mistakesToAvoid: string[];
  recommendations: string[];
  initialVitals?: VitalSnapshot;
  finalVitals?: VitalSnapshot;
  initialSnapshotLabel?: string;
  finalSnapshotLabel?: string;
  initialSnapshot?: string[];
  finalSnapshot?: string[];
  correctActionsLabel?: string;
  incorrectActionsLabel?: string;
  impactLabel?: string;
  recommendationsLabel?: string;
  performanceDimensions?: SimulationPerformanceMetric[];
  idealPlanLabel?: string;
  idealPlan?: string[];
  criticalMistakesLabel?: string;
  criticalMistakes?: string[];
  timelineLabel?: string;
  timelineHighlights?: string[];
  score: number;
}

export interface EcgPanelData {
  preset: 'normal' | 'stemi' | 'af' | 'vtach';
  caption: string;
}

export interface ConsoleLine {
  level: 'info' | 'warn' | 'error' | 'success';
  text: string;
}

export interface ProgrammingConsolePanelData {
  environment: string;
  status: string;
  focusFile: string;
  logs: ConsoleLine[];
  nextHint: string;
}

export interface MetricCard {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down' | 'steady';
}

export interface BusinessMetricsPanelData {
  headline: string;
  metrics: MetricCard[];
  recommendation: string;
}

export interface EvidenceItem {
  title: string;
  detail: string;
  weight: 'high' | 'medium' | 'low';
}

export interface LawEvidencePanelData {
  hearingStage: string;
  evidence: EvidenceItem[];
  proceduralNote: string;
}

export interface ScienceDatum {
  label: string;
  value: number;
  emphasis?: string;
}

export interface ScienceChartPanelData {
  title: string;
  xLabel: string;
  yLabel: string;
  points: ScienceDatum[];
  insight: string;
}

export interface InsightCard {
  label: string;
  value: string;
  note?: string;
}

export interface GenericInsightPanelData {
  cards: InsightCard[];
}

export interface OperationsPriorityItem {
  label: string;
  detail: string;
  status: 'critical' | 'watch' | 'ready';
}

export interface OperationsActorItem {
  role: string;
  status: string;
}

export interface OperationsBoardData {
  phase: string;
  headline: string;
  priorities: OperationsPriorityItem[];
  actors: OperationsActorItem[];
  constraints: string[];
  tools: string[];
}

export interface PanelConfig {
  type: PanelType;
  title: string;
  subtitle: string;
  summary: string;
  specialtyCategory: SpecialtyCategory;
  monitor?: MedicalMonitorPanelData;
  clinical?: ClinicalDashboardPanelData;
  ecg?: EcgPanelData;
  console?: ProgrammingConsolePanelData;
  metrics?: BusinessMetricsPanelData;
  evidence?: LawEvidencePanelData;
  chart?: ScienceChartPanelData;
  operations?: OperationsBoardData;
  insights?: GenericInsightPanelData;
}

export interface SimulationTurnRequest {
  config: SimulationScenarioConfig;
  requestType: 'start' | 'decision' | 'options' | 'timeout';
  transcript: SimulationTranscriptEntry[];
  userInput?: string;
  sessionMeta?: Partial<SimulationSessionMeta> | null;
  previousPanel?: PanelConfig | null;
}

export interface SimulationTurnResponse {
  sessionTitle: string;
  role: string;
  setting: string;
  objective: string;
  urgency: 'routine' | 'time-critical' | 'critical';
  assistantMessage: string;
  nextPrompt: string;
  options: string[];
  timer: TimerConfig;
  status: 'active' | 'completed' | 'failed';
  scoreDelta: number;
  stepIndex: number;
  estimatedTotalSteps: number;
  timeoutMessage?: string;
  coachLabel?: string;
  consultantLabel?: string;
  summary?: unknown;
  panel?: unknown;
}

export const VIRTUAL_LAB_DIFFICULTY_OPTIONS: Array<{ value: ScenarioDifficulty; label: string; description: string }> = [
  { value: 'easy', label: 'Beginner', description: 'Clear cues, guided assessment, and slower deterioration.' },
  { value: 'medium', label: 'Intermediate', description: 'Balanced ambiguity with realistic pressure and clinical tradeoffs.' },
  { value: 'hard', label: 'Advanced', description: 'Less hand-holding, faster deterioration, and more layered decisions.' }
];

export const VIRTUAL_LAB_DURATION_OPTIONS: Array<{ value: SimulationDurationMinutes; label: string; description: string }> = [
  { value: 5, label: '5 min', description: 'Fast scenario for rapid recognition and first-line management.' },
  { value: 10, label: '10 min', description: 'Balanced duration for history, investigations, treatment, and reassessment.' },
  { value: 15, label: '15 min', description: 'Extended run for dynamic progression, complications, and full debriefing.' }
];
