import { createHash, randomUUID } from 'crypto';
const normalizeString = (value) => typeof value === 'string' ? value.trim() : '';
const normalizeStringList = (value, limit) => Array.isArray(value)
    ? value
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, limit)
    : [];
const normalizeLabStatus = (value) => value === 'critical' || value === 'watch' || value === 'normal' ? value : 'watch';
const normalizeRuntimeCategory = (value) => {
    if (value === 'respiratory' || value === 'shock' || value === 'cardiac' || value === 'seizure') {
        return value;
    }
    return 'respiratory';
};
const buildSignature = (parts) => createHash('sha256').update(parts.join('|')).digest('hex');
const safeNumber = (value, fallback, min, max) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }
    return Math.max(min, Math.min(parsed, max));
};
const parsePayload = (raw) => {
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
const pickText = (payload, language, key, fallback) => {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
        return value.trim();
    }
    return fallback;
};
export const buildAiCasePrompt = (input) => {
    const scenarioText = input.requestedCondition.trim() || input.scenario.trim();
    const scenarioInstruction = scenarioText
        ? `Focus strictly on this case topic: "${scenarioText}".`
        : 'Choose a random but realistic case topic within the chosen specialty.';
    const difficultyBlock = input.difficulty === 'easy'
        ? 'Difficulty: easy. Simple presentation, clear signs, relatively stable, straightforward initial decisions.'
        : input.difficulty === 'hard'
            ? 'Difficulty: hard. Complex presentation, multiple details, differential diagnoses, careful decisions required.'
            : input.difficulty === 'expert'
                ? 'Difficulty: expert. Highly complex, multi-system interplay, subtle pitfalls, advanced decision making.'
                : 'Difficulty: medium. Requires analysis and linking data, with some distractors.';
    const avoidText = input.recentTopics.length > 0
        ? `Avoid repeating these recent topics: ${input.recentTopics.slice(0, 12).join(', ')}.`
        : 'Avoid repeating any recent case topics for this learner.';
    const jsonSchema = [
        '{',
        '"diseaseLabelEn": "short English disease label",',
        '"diseaseLabelAr": "الاسم بالعربية",',
        '"diseaseKey": "kebab-case-key",',
        '"specialtyTrackEn": "Emergency / ICU / Pediatrics / Ward / Specialty",',
        '"specialtyTrackAr": "الطوارئ / العناية المركزة / الأطفال / الجناح السريري / التخصص",',
        '"runtimeCategory": "respiratory|shock|cardiac|seizure",',
        '"severity": "mild|moderate|severe|critical",',
        '"complicationEn": "short complication",',
        '"complicationAr": "المضاعفة",',
        '"sourceEn": "trigger/source",',
        '"sourceAr": "المصدر/السبب",',
        '"patientAge": 18,',
        '"patientSex": "male|female",',
        '"chiefComplaintEn": "short chief complaint",',
        '"chiefComplaintAr": "الشكوى الرئيسية",',
        '"openingMessageEn": "1-2 sentence opening",',
        '"openingMessageAr": "جملتان افتتاحيتان",',
        '"caseDescriptionEn": "summary including symptoms + exam + evolution",',
        '"caseDescriptionAr": "وصف الحالة مع الأعراض والفحص والتطور",',
        '"treatmentResponseEn": "expected response if treated well",',
        '"treatmentResponseAr": "استجابة العلاج المتوقعة",',
        '"medicalHistoryEn": ["history item 1", "history item 2"],',
        '"medicalHistoryAr": ["...", "..."],',
        '"learningFocusEn": ["focus 1","focus 2","focus 3"],',
        '"learningFocusAr": ["...","...","..."],',
        '"recommendedInvestigationsEn": ["investigation 1","investigation 2","investigation 3"],',
        '"recommendedInvestigationsAr": ["...","...","..."],',
        '"vitals": {"heartRate": 110, "respiratoryRate": 24, "oxygenSaturation": 92, "systolic": 95, "diastolic": 60, "temperatureCelsius": 38.2},',
        '"labs": [{"label": "Lab name", "value": "value with units", "status": "normal|watch|critical"}]',
        '}'
    ].join('\n');
    const systemInstruction = [
        'You are a clinical simulation case generator for a virtual lab.',
        'Return strictly valid JSON only, no markdown.',
        'Generate realistic, educational, non-generic cases.',
        'Generate a completely new, non-repeated, realistic clinical simulation case. Do not reuse previous patient details.',
        'Ensure the case matches the user specialty and requested difficulty.',
        'Randomize details to avoid repetition.',
        `Language preference: ${input.language === 'ar' ? 'Arabic with English labels also provided.' : 'English with Arabic labels also provided.'}`,
        'JSON schema (must match exactly, do not add extra fields):',
        jsonSchema
    ].join('\n');
    const message = [
        `Specialty: ${input.specialty}`,
        scenarioInstruction,
        difficultyBlock,
        avoidText,
        `Generation seed: ${input.seed}`,
        `Request nonce: ${input.requestId}`,
        `Session nonce: ${input.sessionId}`,
        `Timestamp: ${input.timestamp}`
    ].join('\n');
    return {
        message,
        systemInstruction,
        jsonMode: true,
        knowledgeMode: 'off',
        featureHint: 'clinical_case_generation',
        maxTokens: 1500
    };
};
export const mapAiCaseToGeneratedCase = (input, rawText) => {
    const payload = parsePayload(rawText) || {};
    const diseaseLabelEn = normalizeString(payload.diseaseLabelEn) || normalizeString(payload.diseaseKey) || 'Clinical Case';
    const diseaseLabelAr = normalizeString(payload.diseaseLabelAr) || diseaseLabelEn;
    const specialtyTrackEn = normalizeString(payload.specialtyTrackEn) || input.specialty;
    const specialtyTrackAr = normalizeString(payload.specialtyTrackAr) || input.specialty;
    const chiefComplaintEn = normalizeString(payload.chiefComplaintEn) || normalizeString(payload.caseDescriptionEn);
    const chiefComplaintAr = normalizeString(payload.chiefComplaintAr) || normalizeString(payload.caseDescriptionAr) || chiefComplaintEn;
    const caseId = randomUUID();
    const signature = buildSignature([
        input.userId,
        diseaseLabelEn,
        input.specialty,
        input.difficulty,
        String(Date.now()),
        input.seed
    ]);
    const language = input.language;
    const diseaseLabel = language === 'ar' ? diseaseLabelAr : diseaseLabelEn;
    const title = language === 'ar'
        ? `${specialtyTrackAr} - ${diseaseLabelAr} (${normalizeString(payload.severity) || 'متوسط'})`
        : `${specialtyTrackEn} - ${diseaseLabelEn} (${normalizeString(payload.severity) || 'moderate'})`;
    const vitals = payload.vitals || {};
    return {
        caseId,
        sessionId: input.sessionId || randomUUID(),
        signature,
        language,
        specialty: input.specialty,
        scenario: input.requestedCondition || input.scenario || input.specialty,
        specialtyTrack: language === 'ar' ? specialtyTrackAr : specialtyTrackEn,
        title,
        diseaseKey: normalizeString(payload.diseaseKey) || diseaseLabelEn.toLowerCase().replace(/\s+/g, '-'),
        diseaseLabel,
        diseaseLabelEn,
        difficulty: input.difficulty,
        runtimeCategory: normalizeRuntimeCategory(payload.runtimeCategory),
        patientAge: safeNumber(payload.patientAge, 38, 1, 100),
        ageGroup: safeNumber(payload.patientAge, 38, 1, 100) < 16 ? 'child' : safeNumber(payload.patientAge, 38, 1, 100) > 64 ? 'older-adult' : 'adult',
        patientSex: payload.patientSex === 'female' ? 'female' : 'male',
        severity: normalizeString(payload.severity) || (language === 'ar' ? 'متوسط' : 'moderate'),
        complication: language === 'ar' ? normalizeString(payload.complicationAr) : normalizeString(payload.complicationEn),
        source: language === 'ar' ? normalizeString(payload.sourceAr) : normalizeString(payload.sourceEn),
        medicalHistory: language === 'ar' ? normalizeStringList(payload.medicalHistoryAr, 6) : normalizeStringList(payload.medicalHistoryEn, 6),
        chiefComplaint: language === 'ar' ? chiefComplaintAr : chiefComplaintEn,
        openingMessage: language === 'ar'
            ? pickText(payload, 'ar', 'openingMessageAr', chiefComplaintAr)
            : pickText(payload, 'en', 'openingMessageEn', chiefComplaintEn),
        caseDescription: language === 'ar'
            ? pickText(payload, 'ar', 'caseDescriptionAr', chiefComplaintAr)
            : pickText(payload, 'en', 'caseDescriptionEn', chiefComplaintEn),
        treatmentResponse: language === 'ar'
            ? pickText(payload, 'ar', 'treatmentResponseAr', '')
            : pickText(payload, 'en', 'treatmentResponseEn', ''),
        learningFocus: language === 'ar' ? normalizeStringList(payload.learningFocusAr, 5) : normalizeStringList(payload.learningFocusEn, 5),
        recommendedInvestigations: language === 'ar'
            ? normalizeStringList(payload.recommendedInvestigationsAr, 6)
            : normalizeStringList(payload.recommendedInvestigationsEn, 6),
        vitals: {
            heartRate: safeNumber(vitals.heartRate, 98, 30, 200),
            respiratoryRate: safeNumber(vitals.respiratoryRate, 20, 6, 60),
            oxygenSaturation: safeNumber(vitals.oxygenSaturation, 94, 60, 100),
            systolic: safeNumber(vitals.systolic, 112, 60, 200),
            diastolic: safeNumber(vitals.diastolic, 70, 30, 140),
            temperatureCelsius: safeNumber(vitals.temperatureCelsius, 37.2, 34, 42)
        },
        labs: (payload.labs || []).map((lab) => ({
            id: randomUUID(),
            label: normalizeString(lab.label) || (language === 'ar' ? 'فحص مخبري' : 'Lab'),
            value: normalizeString(lab.value),
            status: normalizeLabStatus(lab.status)
        })),
        levelTier: 'bronze',
        createdAt: new Date().toISOString()
    };
};
