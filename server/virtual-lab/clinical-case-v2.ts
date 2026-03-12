import type { HybridChatRequest } from '../hybrid/types.js';

export interface ClinicalCaseV2Input {
  requestId: string;
  sessionId: string;
  timestamp: number;
  seed: string;
  specialty: string;
  requestedTopic: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  learnerLevel?: string;
  simulationMode?: string;
  encounterType?: string;
  language: 'ar' | 'en';
  patientAgePreference?: string;
  patientGenderPreference?: string;
  careSetting?: string;
  focusArea?: string;
}

export interface ClinicalCaseV2Response {
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

const normalizeString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeStringList = (value: unknown, max: number): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, max)
    : [];

const parseJson = (raw: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) {
      return null;
    }
    try {
      return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
};

export const buildCaseV2Prompt = (input: ClinicalCaseV2Input): Pick<HybridChatRequest, 'message' | 'systemInstruction' | 'jsonMode' | 'knowledgeMode' | 'featureHint' | 'maxTokens'> => {
  const topicLine = input.requestedTopic
    ? `Requested topic: "${input.requestedTopic}".`
    : 'Requested topic: none. Choose a plausible topic within the specialty.';

  const systemInstruction = [
    'You are an expert clinical simulation engine for healthcare education.',
    'Generate a realistic, educational, specialty-specific clinical case.',
    'Always tailor the case to the selected specialty, requested condition/topic, learner level, and difficulty.',
    'Create a completely new and non-repeated patient case every time.',
    'Do not use generic filler text.',
    'Do not repeat previously used names, vitals, or narratives.',
    'Make the case clinically coherent, educationally useful, and appropriate for simulation-based learning.',
    'If the requested topic is specific, stay tightly aligned to it.',
    'If it is broad, choose a plausible case within the selected specialty.',
    'Return the response as strict JSON only.',
    'Use this exact JSON structure with all keys present (empty arrays allowed):',
    '{',
    '"caseId":"...",',
    '"sessionId":"...",',
    '"specialty":"...",',
    '"difficulty":"...",',
    '"requestedTopic":"...",',
    '"language":"ar/en",',
    '"title":"...",',
    '"patient":{"name":"...","age":0,"gender":"...","weight":"...","background":"..."},',
    '"setting":{"careArea":"...","urgencyLevel":"...","context":"..."},',
    '"chiefComplaint":"...",',
    '"historyOfPresentIllness":"...",',
    '"pastMedicalHistory":[],',
    '"medications":[],',
    '"allergies":[],',
    '"vitalSigns":{"temperature":"...","heartRate":"...","bloodPressure":"...","respiratoryRate":"...","oxygenSaturation":"...","painScore":"..."},',
    '"physicalExam":{"generalAppearance":"...","systemFindings":[]},',
    '"initialClues":[],',
    '"redFlags":[],',
    '"expectedFocus":[],',
    '"progressionModel":{"canDeteriorate":true,"canImprove":true,"triggers":[]},',
    '"availableTests":[],',
    '"initialManagementPossibilities":[],',
    '"learningObjectives":[],',
    '"aiNotesInternal":{"notVisibleToStudent":true}',
    '}'
  ].join('\n');

  const message = [
    `Specialty: ${input.specialty}`,
    topicLine,
    `Difficulty: ${input.difficulty}`,
    input.learnerLevel ? `Learner level: ${input.learnerLevel}` : 'Learner level: not provided.',
    input.simulationMode ? `Simulation mode: ${input.simulationMode}` : 'Simulation mode: not provided.',
    input.encounterType ? `Encounter type: ${input.encounterType}` : 'Encounter type: not provided.',
    input.careSetting ? `Care setting: ${input.careSetting}` : 'Care setting: not provided.',
    input.focusArea ? `Focus area: ${input.focusArea}` : 'Focus area: not provided.',
    input.patientAgePreference ? `Patient age preference: ${input.patientAgePreference}` : 'Patient age preference: not provided.',
    input.patientGenderPreference ? `Patient gender preference: ${input.patientGenderPreference}` : 'Patient gender preference: not provided.',
    `Request nonce: ${input.requestId}`,
    `Session nonce: ${input.sessionId}`,
    `Seed: ${input.seed}`,
    `Timestamp: ${input.timestamp}`,
    `Output language: ${input.language === 'ar' ? 'Arabic (medical) with acceptable English terms when needed.' : 'English.'}`
  ].join('\n');

  return {
    message,
    systemInstruction,
    jsonMode: true,
    knowledgeMode: 'off',
    featureHint: 'clinical_case_generation_v2',
    maxTokens: 1800
  };
};

export const normalizeCaseV2 = (raw: string, input: ClinicalCaseV2Input): ClinicalCaseV2Response => {
  const payload = parseJson(raw) || {};

  const patient = payload['patient'] && typeof payload['patient'] === 'object' ? payload['patient'] as Record<string, unknown> : {};
  const setting = payload['setting'] && typeof payload['setting'] === 'object' ? payload['setting'] as Record<string, unknown> : {};
  const vitalSigns = payload['vitalSigns'] && typeof payload['vitalSigns'] === 'object' ? payload['vitalSigns'] as Record<string, unknown> : {};
  const physicalExam = payload['physicalExam'] && typeof payload['physicalExam'] === 'object' ? payload['physicalExam'] as Record<string, unknown> : {};
  const progression = payload['progressionModel'] && typeof payload['progressionModel'] === 'object'
    ? payload['progressionModel'] as Record<string, unknown>
    : {};

  return {
    caseId: normalizeString(payload['caseId']) || input.requestId,
    sessionId: normalizeString(payload['sessionId']) || input.sessionId,
    specialty: normalizeString(payload['specialty']) || input.specialty,
    difficulty: normalizeString(payload['difficulty']) || input.difficulty,
    requestedTopic: normalizeString(payload['requestedTopic']) || input.requestedTopic,
    language: input.language,
    title: normalizeString(payload['title']) || `${input.specialty} Simulation`,
    patient: {
      name: normalizeString(patient['name']) || 'Patient',
      age: Number(patient['age']) || 0,
      gender: normalizeString(patient['gender']) || 'unspecified',
      weight: normalizeString(patient['weight']),
      background: normalizeString(patient['background'])
    },
    setting: {
      careArea: normalizeString(setting['careArea']),
      urgencyLevel: normalizeString(setting['urgencyLevel']),
      context: normalizeString(setting['context'])
    },
    chiefComplaint: normalizeString(payload['chiefComplaint']),
    historyOfPresentIllness: normalizeString(payload['historyOfPresentIllness']),
    pastMedicalHistory: normalizeStringList(payload['pastMedicalHistory'], 12),
    medications: normalizeStringList(payload['medications'], 12),
    allergies: normalizeStringList(payload['allergies'], 12),
    vitalSigns: {
      temperature: normalizeString(vitalSigns['temperature']),
      heartRate: normalizeString(vitalSigns['heartRate']),
      bloodPressure: normalizeString(vitalSigns['bloodPressure']),
      respiratoryRate: normalizeString(vitalSigns['respiratoryRate']),
      oxygenSaturation: normalizeString(vitalSigns['oxygenSaturation']),
      painScore: normalizeString(vitalSigns['painScore'])
    },
    physicalExam: {
      generalAppearance: normalizeString(physicalExam['generalAppearance']),
      systemFindings: normalizeStringList(physicalExam['systemFindings'], 12)
    },
    initialClues: normalizeStringList(payload['initialClues'], 10),
    redFlags: normalizeStringList(payload['redFlags'], 10),
    expectedFocus: normalizeStringList(payload['expectedFocus'], 10),
    progressionModel: {
      canDeteriorate: Boolean(progression['canDeteriorate']),
      canImprove: Boolean(progression['canImprove']),
      triggers: normalizeStringList(progression['triggers'], 10)
    },
    availableTests: normalizeStringList(payload['availableTests'], 16),
    initialManagementPossibilities: normalizeStringList(payload['initialManagementPossibilities'], 12),
    learningObjectives: normalizeStringList(payload['learningObjectives'], 12),
    aiNotesInternal: {
      notVisibleToStudent: true
    }
  };
};
