const normalizeString = (value) => typeof value === 'string' ? value.trim() : '';
const normalizeStringList = (value, max) => Array.isArray(value)
    ? value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, max)
    : [];
const parseJson = (raw) => {
    try {
        return JSON.parse(raw);
    }
    catch {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return JSON.parse(raw.slice(start, end + 1));
        }
        catch {
            return null;
        }
    }
};
export const buildCaseV2Prompt = (input) => {
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
export const normalizeCaseV2 = (raw, input) => {
    const payload = parseJson(raw) || {};
    const patient = payload['patient'] && typeof payload['patient'] === 'object' ? payload['patient'] : {};
    const setting = payload['setting'] && typeof payload['setting'] === 'object' ? payload['setting'] : {};
    const vitalSigns = payload['vitalSigns'] && typeof payload['vitalSigns'] === 'object' ? payload['vitalSigns'] : {};
    const physicalExam = payload['physicalExam'] && typeof payload['physicalExam'] === 'object' ? payload['physicalExam'] : {};
    const progression = payload['progressionModel'] && typeof payload['progressionModel'] === 'object'
        ? payload['progressionModel']
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
