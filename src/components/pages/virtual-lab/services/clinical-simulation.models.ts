import {
  ActiveInterventionPanelData,
  ClinicalAbgPanelResult,
  ClinicalDashboardPanelData,
  ClinicalEducationScoreCard,
  ClinicalEcgResult,
  ClinicalExamSectionData,
  ClinicalHypothesisData,
  ClinicalImagingResult,
  ClinicalLabPanelResult,
  ClinicalPatientChartData,
  ClinicalResultViewer,
  ClinicalTimelineEvent,
  MedicalSeverity,
  PanelConfig,
  SimulationCaseSummary,
  SimulationFeedback,
  SimulationScenarioConfig,
  SimulationSessionMeta,
  TimerConfig,
  VitalSnapshot
} from '../models/virtual-lab.models';

export type ClinicalCaseId =
  | 'hypoglycemia'
  | 'copd-exacerbation'
  | 'myocardial-infarction'
  | 'anaphylaxis'
  | 'septic-shock'
  | 'acute-asthma'
  | 'acute-appendicitis'
  | 'postpartum-hemorrhage'
  | 'dka'
  | 'pneumonia'
  | 'gi-bleed'
  | 'stroke';

export type ClinicalSpecialtyLensId =
  | 'nursing'
  | 'medicine'
  | 'emergency'
  | 'icu'
  | 'pediatrics'
  | 'surgery'
  | 'obstetrics'
  | 'allied-health';

export type ClinicalDimensionId =
  | 'oxygenation'
  | 'ventilation'
  | 'perfusion'
  | 'infection'
  | 'metabolic'
  | 'pain'
  | 'neurologic'
  | 'bleeding'
  | 'coronary'
  | 'allergic';

export type ClinicalHistoryTarget =
  | 'onset'
  | 'associated-symptoms'
  | 'pmh'
  | 'medications'
  | 'allergies'
  | 'last-meal'
  | 'pregnancy'
  | 'context';

export type ClinicalExamTarget =
  | 'general'
  | 'vitals'
  | 'airway'
  | 'breathing'
  | 'circulation'
  | 'neuro'
  | 'abdomen'
  | 'chest'
  | 'cardiac'
  | 'pelvis';

export type ClinicalInvestigationId =
  | 'cbc'
  | 'cmp'
  | 'bmp'
  | 'lft'
  | 'rft'
  | 'glucose'
  | 'ketones'
  | 'troponin'
  | 'lactate'
  | 'blood-cultures'
  | 'abg'
  | 'ecg'
  | 'chest-xray'
  | 'ct-head'
  | 'ct-abdomen'
  | 'pelvic-ultrasound';

export type ClinicalTreatmentId =
  | 'oxygen'
  | 'iv-access'
  | 'monitor'
  | 'nebulizer'
  | 'steroids'
  | 'antibiotics'
  | 'iv-fluids'
  | 'vasopressors'
  | 'aspirin'
  | 'nitroglycerin'
  | 'heparin'
  | 'dextrose'
  | 'insulin'
  | 'epinephrine'
  | 'suction'
  | 'transfusion'
  | 'oxytocin'
  | 'analgesia'
  | 'surgical-consult'
  | 'reassess';

export interface ClinicalSpecialtyLens {
  id: ClinicalSpecialtyLensId;
  displayName: { ar: string; en: string };
  setting: { ar: string; en: string };
  coachLabel: { ar: string; en: string };
  consultantLabel: { ar: string; en: string };
  learningFocus: { ar: string[]; en: string[] };
  evaluationWeights: Record<'history' | 'exam' | 'tests' | 'diagnosis' | 'treatment' | 'timing' | 'safety', number>;
  deteriorationMultiplier: number;
}

export interface ClinicalPhysiologyState {
  oxygenation: number;
  ventilation: number;
  perfusion: number;
  infection: number;
  metabolic: number;
  pain: number;
  neurologic: number;
  bleeding: number;
  coronary: number;
  allergic: number;
}

export interface ClinicalVitalsState {
  heartRate: number;
  respiratoryRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  oxygenSaturation: number;
  temperatureCelsius: number;
  mentalStatus: string;
}

export interface ClinicalExpectationMap {
  keyHistory: ClinicalHistoryTarget[];
  keyExams: ClinicalExamTarget[];
  keyInvestigations: ClinicalInvestigationId[];
  keyTreatments: ClinicalTreatmentId[];
  harmfulActions: ClinicalTreatmentId[];
  diagnosticKeywords: string[];
  differentialList: string[];
}

export interface ClinicalCaseDefinition {
  id: ClinicalCaseId;
  aliases: string[];
  titles: { ar: string; en: string };
  overview: { ar: string; en: string };
  ageRange: readonly [number, number];
  gender: 'male' | 'female' | 'any';
  basePhysiology: Partial<ClinicalPhysiologyState>;
  deteriorationPerTick: Partial<ClinicalPhysiologyState>;
  targetInvestigations: ClinicalInvestigationId[];
  targetTreatments: ClinicalTreatmentId[];
  expectations: ClinicalExpectationMap;
  generatePatientChart: (context: GeneratedCaseContext) => ClinicalPatientChartData;
  initialHighlightedExams: (context: GeneratedCaseContext) => ClinicalExamSectionData[];
  resolveVitals: (state: ClinicalSimulationState) => ClinicalVitalsState;
  resolveSeverity: (state: ClinicalSimulationState) => MedicalSeverity;
  nextPrompt: (state: ClinicalSimulationState) => string;
  openingNarrative: (context: GeneratedCaseContext) => string;
  historyResponse: (target: ClinicalHistoryTarget, state: ClinicalSimulationState) => string | null;
  examResponse: (target: ClinicalExamTarget, state: ClinicalSimulationState) => ClinicalExamSectionData | null;
  investigationResult: (target: ClinicalInvestigationId, state: ClinicalSimulationState) =>
    ClinicalLabPanelResult | ClinicalAbgPanelResult | ClinicalEcgResult | ClinicalImagingResult | null;
  applyTreatment: (target: ClinicalTreatmentId, state: ClinicalSimulationState) => ClinicalTreatmentResolution;
  buildDifferentials: (state: ClinicalSimulationState) => ClinicalHypothesisData[];
  buildIdealPlan: (language: SimulationScenarioConfig['language'], lens: ClinicalSpecialtyLens) => string[];
  buildOutcomeNarrative: (state: ClinicalSimulationState) => string;
}

export interface GeneratedCaseContext {
  config: SimulationScenarioConfig;
  language: SimulationScenarioConfig['language'];
  seed: number;
  lens: ClinicalSpecialtyLens;
  definition: ClinicalCaseDefinition;
  patientName: string;
  patientSex: 'male' | 'female';
  patientAge: number;
}

export interface ClinicalScoreState {
  history: number;
  exam: number;
  tests: number;
  diagnosis: number;
  treatment: number;
  timing: number;
  safety: number;
}

export interface DiagnosisAttempt {
  text: string;
  matched: boolean;
  scoreAwarded: number;
  createdAt: number;
}

export interface ClinicalSimulationState {
  config: SimulationScenarioConfig;
  definition: ClinicalCaseDefinition;
  lens: ClinicalSpecialtyLens;
  seed: number;
  patientChart: ClinicalPatientChartData;
  physiology: ClinicalPhysiologyState;
  vitals: ClinicalVitalsState;
  severity: MedicalSeverity;
  score: ClinicalScoreState;
  startedAt: number;
  lastUpdatedAt: number;
  tickCount: number;
  stepIndex: number;
  estimatedTotalSteps: number;
  status: 'active' | 'completed' | 'failed';
  patientStableTicks: number;
  requestedHistory: Set<ClinicalHistoryTarget>;
  requestedExams: Map<ClinicalExamTarget, ClinicalExamSectionData>;
  requestedInvestigations: Map<ClinicalInvestigationId, ClinicalResultViewer>;
  activeInterventions: Map<ClinicalTreatmentId, ActiveInterventionPanelData>;
  completedInterventions: Set<ClinicalTreatmentId>;
  diagnosticHypotheses: ClinicalHypothesisData[];
  diagnosisAttempts: DiagnosisAttempt[];
  timeline: ClinicalTimelineEvent[];
  mistakes: string[];
  strengths: string[];
  latestAlerts: string[];
  latestFeedback: SimulationFeedback | null;
  dosageCalculatorVisible: boolean;
  lastClinicianResponse: string;
  actionLog: ClinicalActionLogEntry[];
}

export interface ClinicalActionLogEntry {
  id: string;
  kind: 'history' | 'exam' | 'investigation' | 'treatment' | 'diagnosis' | 'monitor' | 'system';
  label: string;
  detail: string;
  effectSummary: string[];
  createdAt: number;
}

export interface ClinicalTreatmentResolution {
  applied: boolean;
  alreadyActive?: boolean;
  message: string;
  immediateEffects: string[];
  physiologyDelta?: Partial<Record<ClinicalDimensionId, number>>;
  startIntervention?: ActiveInterventionPanelData | null;
  stopInterventionId?: ClinicalTreatmentId | null;
  scoreEffects?: Partial<ClinicalScoreState>;
  dangerous?: boolean;
}

export interface ClinicalActionResolution {
  assistantMessage: string;
  feedback: SimulationFeedback;
  status: 'active' | 'completed' | 'failed';
  quickOptions: string[];
  summary: SimulationCaseSummary | null;
}

export interface ClinicalPanelBuild {
  monitor: PanelConfig['monitor'];
  dashboard: ClinicalDashboardPanelData;
  sessionMeta: SimulationSessionMeta;
}

export interface ClinicalTimeoutResult {
  result: ClinicalActionResolution;
  summary: SimulationCaseSummary;
}

export interface ClinicalRuntimeStart {
  assistantMessage: string;
  timer: TimerConfig;
  quickOptions: string[];
}

export interface ClinicalTutorHandoff {
  summary: SimulationCaseSummary;
}

export interface ClinicalGenerationResult {
  state: ClinicalSimulationState;
  context: GeneratedCaseContext;
}
