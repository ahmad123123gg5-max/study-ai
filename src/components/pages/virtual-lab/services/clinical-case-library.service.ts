import { Injectable } from '@angular/core';
import {
  ClinicalAbgPanelResult,
  ClinicalEcgResult,
  ClinicalExamSectionData,
  ClinicalHypothesisData,
  ClinicalImagingResult,
  ClinicalLabGroupData,
  ClinicalLabPanelResult,
  ClinicalLabValueData,
  ClinicalPatientChartData,
  MedicalSeverity,
  SimulationScenarioConfig
} from '../models/virtual-lab.models';
import {
  ClinicalCaseDefinition,
  ClinicalCaseId,
  ClinicalExamTarget,
  ClinicalHistoryTarget,
  ClinicalSpecialtyLens,
  ClinicalSpecialtyLensId,
  ClinicalSimulationState,
  ClinicalTreatmentId,
  ClinicalTreatmentResolution,
  ClinicalVitalsState,
  GeneratedCaseContext
} from './clinical-simulation.models';

const MALE_NAMES = ['Omar', 'Ahmad', 'Yousef', 'Khaled', 'Tariq', 'Adam', 'Noah', 'Elias'];
const FEMALE_NAMES = ['Mariam', 'Layla', 'Amina', 'Sara', 'Dina', 'Nour', 'Lina', 'Rania'];

@Injectable({ providedIn: 'root' })
export class ClinicalCaseLibraryService {
  readonly lenses: ClinicalSpecialtyLens[] = [
    {
      id: 'nursing',
      displayName: { ar: 'التمريض', en: 'Nursing' },
      setting: { ar: 'سرير مريض يحتاج assessment وتمريض أولويات', en: 'A bedside case requiring nursing assessment and prioritization' },
      coachLabel: { ar: 'مدرب تمريض سريري', en: 'Clinical nursing coach' },
      consultantLabel: { ar: 'الممرض المسؤول / الطبيب المناوب', en: 'Charge nurse / on-call physician' },
      learningFocus: {
        ar: ['assessment المبكر', 'سلامة المريض', 'التدخلات التمريضية', 'المراقبة المستمرة'],
        en: ['Early assessment', 'Patient safety', 'Nursing interventions', 'Continuous monitoring']
      },
      evaluationWeights: { history: 14, exam: 18, tests: 12, diagnosis: 8, treatment: 20, timing: 12, safety: 16 },
      deteriorationMultiplier: 1
    },
    {
      id: 'medicine',
      displayName: { ar: 'الطب السريري', en: 'Medicine' },
      setting: { ar: 'حالة سريرية تتطلب تشخيصاً وتفسيراً علاجياً', en: 'A clinical case requiring diagnostic reasoning and medical management' },
      coachLabel: { ar: 'مدرب طب سريري', en: 'Clinical medicine coach' },
      consultantLabel: { ar: 'الاستشاري', en: 'Consultant physician' },
      learningFocus: {
        ar: ['التشخيص التفريقي', 'اختيار الفحوصات', 'الخطة العلاجية', 'إعادة التقييم'],
        en: ['Differential diagnosis', 'Investigation selection', 'Medical plan', 'Reassessment']
      },
      evaluationWeights: { history: 12, exam: 16, tests: 18, diagnosis: 18, treatment: 18, timing: 8, safety: 10 },
      deteriorationMultiplier: 1.05
    },
    {
      id: 'emergency',
      displayName: { ar: 'الطوارئ', en: 'Emergency' },
      setting: { ar: 'قسم طوارئ مع triage وقرارات ABCDE سريعة', en: 'An emergency bay with triage pressure and rapid ABCDE decisions' },
      coachLabel: { ar: 'مدرب طوارئ', en: 'Emergency simulation coach' },
      consultantLabel: { ar: 'طبيب الطوارئ الأقدم', en: 'Senior emergency physician' },
      learningFocus: {
        ar: ['triage', 'ABCDE', 'التدخل العاجل', 'التصعيد السريع'],
        en: ['Triage', 'ABCDE', 'Urgent intervention', 'Rapid escalation']
      },
      evaluationWeights: { history: 8, exam: 18, tests: 12, diagnosis: 12, treatment: 22, timing: 16, safety: 12 },
      deteriorationMultiplier: 1.18
    },
    {
      id: 'icu',
      displayName: { ar: 'العناية المكثفة', en: 'ICU' },
      setting: { ar: 'بيئة حرجة مع shock states ومراقبة لصيقة', en: 'A high-acuity ICU environment with shock states and intensive monitoring' },
      coachLabel: { ar: 'مدرب عناية مكثفة', en: 'Critical care coach' },
      consultantLabel: { ar: 'استشاري العناية المكثفة', en: 'Intensivist' },
      learningFocus: {
        ar: ['hemodynamics', 'shock logic', 'ventilation support', 'time-sensitive response'],
        en: ['Hemodynamics', 'Shock logic', 'Ventilation support', 'Time-sensitive response']
      },
      evaluationWeights: { history: 6, exam: 14, tests: 16, diagnosis: 14, treatment: 24, timing: 16, safety: 10 },
      deteriorationMultiplier: 1.28
    },
    {
      id: 'pediatrics',
      displayName: { ar: 'طب الأطفال', en: 'Pediatrics' },
      setting: { ar: 'طفل يحتاج تقييم عمري مناسب وجرعات دقيقة', en: 'A pediatric case with age-appropriate assessment and dosing' },
      coachLabel: { ar: 'مدرب طب أطفال', en: 'Pediatrics coach' },
      consultantLabel: { ar: 'اختصاصي الأطفال', en: 'Pediatric specialist' },
      learningFocus: {
        ar: ['التقييم العمري', 'الجرعات', 'الأمان', 'إشراك المرافق'],
        en: ['Age-appropriate assessment', 'Dosing', 'Safety', 'Caregiver communication']
      },
      evaluationWeights: { history: 12, exam: 18, tests: 12, diagnosis: 14, treatment: 18, timing: 12, safety: 14 },
      deteriorationMultiplier: 1.12
    },
    {
      id: 'surgery',
      displayName: { ar: 'الجراحة', en: 'Surgery' },
      setting: { ar: 'حالة جراحية حادة مع قرار imaging/consult وتوقيت تدخل', en: 'An acute surgical case requiring imaging, consultation, and timely intervention' },
      coachLabel: { ar: 'مدرب جراحة', en: 'Surgical simulation coach' },
      consultantLabel: { ar: 'الجراح المناوب', en: 'On-call surgeon' },
      learningFocus: {
        ar: ['acute abdomen logic', 'resuscitation', 'surgical referral', 'pre-op thinking'],
        en: ['Acute abdomen logic', 'Resuscitation', 'Surgical referral', 'Pre-op thinking']
      },
      evaluationWeights: { history: 14, exam: 18, tests: 16, diagnosis: 16, treatment: 14, timing: 10, safety: 12 },
      deteriorationMultiplier: 1.06
    },
    {
      id: 'obstetrics',
      displayName: { ar: 'النساء والولادة', en: 'Obstetrics' },
      setting: { ar: 'مضاعفة ولادية تتطلب إنقاذاً سريعاً للأم', en: 'An obstetric emergency requiring maternal stabilization' },
      coachLabel: { ar: 'مدرب نسائية وولادة', en: 'Obstetric emergency coach' },
      consultantLabel: { ar: 'اختصاصي النساء والولادة', en: 'Obstetrics consultant' },
      learningFocus: {
        ar: ['maternal stabilization', 'bleeding control', 'uterotonics', 'team escalation'],
        en: ['Maternal stabilization', 'Bleeding control', 'Uterotonics', 'Team escalation']
      },
      evaluationWeights: { history: 10, exam: 18, tests: 10, diagnosis: 12, treatment: 24, timing: 14, safety: 12 },
      deteriorationMultiplier: 1.22
    },
    {
      id: 'allied-health',
      displayName: { ar: 'تخصص صحي', en: 'Allied Health' },
      setting: { ar: 'حالة صحية تطبيقية تحتاج تقييم وتنسيق آمن', en: 'An applied health case requiring assessment and safe coordination' },
      coachLabel: { ar: 'مدرب مهني صحي', en: 'Health professions coach' },
      consultantLabel: { ar: 'المشرف السريري', en: 'Clinical supervisor' },
      learningFocus: {
        ar: ['الفحص الموجه', 'السلامة', 'التصعيد', 'التوثيق'],
        en: ['Focused assessment', 'Safety', 'Escalation', 'Documentation']
      },
      evaluationWeights: { history: 14, exam: 18, tests: 10, diagnosis: 10, treatment: 18, timing: 12, safety: 18 },
      deteriorationMultiplier: 1
    }
  ];

  readonly definitions: ClinicalCaseDefinition[];

  constructor() {
    this.definitions = [
      this.buildHypoglycemiaDefinition(),
      this.buildCopdDefinition(),
      this.buildMiDefinition(),
      this.buildAnaphylaxisDefinition(),
      this.buildSepticShockDefinition(),
      this.buildAcuteAsthmaDefinition(),
      this.buildAppendicitisDefinition(),
      this.buildPostpartumHemorrhageDefinition(),
      this.buildDkaDefinition(),
      this.buildPneumoniaDefinition(),
      this.buildGiBleedDefinition(),
      this.buildStrokeDefinition()
    ];
  }

  resolveLens(specialty: string): ClinicalSpecialtyLens {
    const normalized = this.normalize(specialty);

    if (/(nurs|تمريض)/.test(normalized)) return this.lensById('nursing');
    if (/(icu|critical care|intensive|عنايه|عناية|مكثفه|مكثفة)/.test(normalized)) return this.lensById('icu');
    if (/(emergency|er|ed|trauma|طوارئ|اسعاف|إسعاف)/.test(normalized)) return this.lensById('emergency');
    if (/(pediatric|paeds|child|اطفال|أطفال)/.test(normalized)) return this.lensById('pediatrics');
    if (/(surgery|surgical|surgeon|جراح|جراحة)/.test(normalized)) return this.lensById('surgery');
    if (/(obstetric|obgyn|gyn|midwife|postpartum|نساء|ولاده|ولادة|قباله|قبالة)/.test(normalized)) return this.lensById('obstetrics');
    if (/(medicine|medical|physician|internal|family|طب|باطنه|باطنة|سريري)/.test(normalized)) return this.lensById('medicine');

    return this.lensById('allied-health');
  }

  resolveCaseId(topic: string, lens: ClinicalSpecialtyLens): ClinicalCaseId {
    const normalized = this.normalize(topic);
    const matched = this.definitions.find((definition) => definition.aliases.some((alias) => normalized.includes(alias)));
    if (matched) {
      return matched.id;
    }

    if (lens.id === 'pediatrics') return 'acute-asthma';
    if (lens.id === 'obstetrics') return 'postpartum-hemorrhage';
    if (lens.id === 'surgery') return 'acute-appendicitis';
    if (lens.id === 'icu') return 'septic-shock';
    if (lens.id === 'emergency') return 'anaphylaxis';
    return 'pneumonia';
  }

  definitionById(id: ClinicalCaseId): ClinicalCaseDefinition {
    return this.definitions.find((definition) => definition.id === id) || this.definitions[0];
  }

  lensById(id: ClinicalSpecialtyLensId): ClinicalSpecialtyLens {
    return this.lenses.find((lens) => lens.id === id) || this.lenses[0];
  }

  createContext(config: SimulationScenarioConfig): GeneratedCaseContext {
    const lens = this.resolveLens(config.specialty);
    const definition = this.definitionById(this.resolveCaseId(config.scenario, lens));
    const seed = this.createSeed(`${config.specialty}:${config.scenario}:${config.difficulty}`);
    const patientSex = definition.gender === 'any'
      ? (seed % 2 === 0 ? 'male' : 'female')
      : definition.gender;
    const ageSpan = Math.max(1, (definition.ageRange[1] - definition.ageRange[0]) + 1);
    const patientAge = definition.ageRange[0] + (seed % ageSpan);
    const names = patientSex === 'female' ? FEMALE_NAMES : MALE_NAMES;

    return {
      config,
      language: config.language,
      seed,
      lens,
      definition,
      patientName: names[seed % names.length],
      patientSex,
      patientAge
    };
  }

  createSeed(input: string): number {
    let hash = 0;
    for (const char of input) {
      hash = ((hash << 5) - hash) + char.charCodeAt(0);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private buildChart(
    context: GeneratedCaseContext,
    content: {
      chiefComplaint: string;
      triageNote: string;
      hpi: string[];
      pmh: string[];
      meds: string[];
      allergies: string[];
      social: string[];
      risks: string[];
    }
  ): ClinicalPatientChartData {
    return {
      patientName: context.patientName,
      age: `${context.patientAge} ${context.language === 'ar' ? 'سنة' : 'years'}`,
      sex: context.patientSex === 'female' ? this.t(context.language, 'أنثى', 'Female') : this.t(context.language, 'ذكر', 'Male'),
      specialtyFocus: context.lens.displayName[context.language],
      caseTitle: context.definition.titles[context.language],
      chiefComplaint: content.chiefComplaint,
      triageNote: content.triageNote,
      historyOfPresentIllness: content.hpi,
      pastHistory: content.pmh,
      medicationHistory: content.meds.length > 0 ? content.meds : [this.t(context.language, 'غير محدد حالياً', 'Not yet clarified')],
      allergies: content.allergies,
      socialHistory: content.social,
      riskFlags: content.risks
    };
  }

  private examSection(
    id: string,
    context: GeneratedCaseContext,
    labelArEn: string,
    summary: string,
    findings: string[],
    status: ClinicalExamSectionData['status']
  ): ClinicalExamSectionData {
    const [labelAr, labelEn] = labelArEn.includes(' / ')
      ? labelArEn.split(' / ')
      : [labelArEn, labelArEn];

    return {
      id,
      label: context.language === 'ar' ? labelAr : labelEn,
      summary,
      findings,
      status
    };
  }

  private respiratoryVitals(state: ClinicalSimulationState, variant: 'copd' | 'asthma'): ClinicalVitalsState {
    return {
      heartRate: this.round((variant === 'asthma' ? 110 : 92) + (state.physiology.ventilation * 0.18)),
      respiratoryRate: this.round((variant === 'asthma' ? 28 : 22) + (state.physiology.ventilation * 0.14)),
      bloodPressureSystolic: this.round((variant === 'asthma' ? 108 : 132) - (state.physiology.perfusion * 0.08)),
      bloodPressureDiastolic: this.round((variant === 'asthma' ? 64 : 76) - (state.physiology.perfusion * 0.04)),
      oxygenSaturation: this.round((variant === 'asthma' ? 96 : 92) - (state.physiology.oxygenation * 0.16)),
      temperatureCelsius: variant === 'copd' ? Number((36.8 + (state.physiology.infection * 0.01)).toFixed(1)) : 37.1,
      mentalStatus: state.physiology.ventilation >= 82
        ? this.t(state.config.language, 'مرهق تنفسياً', 'Respiratory fatigue developing')
        : this.t(state.config.language, 'يقظ لكنه مجهد', 'Alert but distressed')
    };
  }

  private respiratorySeverity(state: ClinicalSimulationState): MedicalSeverity {
    if (state.physiology.oxygenation >= 82 || state.physiology.ventilation >= 82) return 'critical';
    if (state.physiology.oxygenation >= 64 || state.physiology.ventilation >= 64) return 'unstable';
    if (state.physiology.oxygenation >= 38 || state.physiology.ventilation >= 38) return 'concerning';
    return 'stable';
  }

  private labValue(name: string, value: string, unit: string = '', reference: string = '', flag: ClinicalLabValueData['flag'] = 'normal'): ClinicalLabValueData {
    return { name, value, unit, reference, flag };
  }

  private labPanel(
    _state: ClinicalSimulationState,
    title: string,
    subtitle: string,
    note: string,
    groups: ClinicalLabGroupData[],
    urgent = false
  ): ClinicalLabPanelResult {
    return {
      id: crypto.randomUUID(),
      kind: 'lab-panel',
      title,
      subtitle,
      note,
      requestedAt: Date.now(),
      urgent,
      groups
    };
  }

  private abgResult(
    _state: ClinicalSimulationState,
    title: string,
    subtitle: string,
    note: string,
    values: ClinicalLabValueData[],
    interpretation: string,
    urgent = true
  ): ClinicalAbgPanelResult {
    return {
      id: crypto.randomUUID(),
      kind: 'abg',
      title,
      subtitle,
      note,
      requestedAt: Date.now(),
      urgent,
      values,
      interpretation
    };
  }

  private ecgResult(
    preset: ClinicalEcgResult['preset'],
    _state: ClinicalSimulationState,
    title: string,
    note: string,
    findings: string[]
  ): ClinicalEcgResult {
    return {
      id: crypto.randomUUID(),
      kind: 'ecg',
      title,
      subtitle: '12-lead ECG',
      note,
      requestedAt: Date.now(),
      urgent: preset !== 'normal',
      preset,
      interpretation: findings[0] || note,
      findings
    };
  }

  private imagingResult(
    _state: ClinicalSimulationState,
    modality: string,
    tone: ClinicalImagingResult['tone'],
    title: string,
    note: string,
    findings: string[],
    impression: string,
    annotations: string[]
  ): ClinicalImagingResult {
    return {
      id: crypto.randomUUID(),
      kind: 'imaging',
      title,
      subtitle: modality,
      note,
      requestedAt: Date.now(),
      urgent: true,
      modality,
      tone,
      findings,
      impression,
      annotations
    };
  }

  private basicDifferentials(
    state: ClinicalSimulationState,
    entries: Array<[string, ClinicalHypothesisData['confidence'], string]>
  ): ClinicalHypothesisData[] {
    return entries.map(([diagnosis, confidence, rationale], index) => ({
      diagnosis,
      confidence,
      rationale,
      primary: index === 0 && state.diagnosisAttempts.some((attempt) => attempt.matched)
    }));
  }

  private applyDelta(state: ClinicalSimulationState, delta: Partial<Record<keyof ClinicalSimulationState['physiology'], number>>) {
    for (const [key, amount] of Object.entries(delta)) {
      const dimension = key as keyof ClinicalSimulationState['physiology'];
      state.physiology[dimension] = this.clamp(state.physiology[dimension] + (amount || 0), 0, 100);
    }
  }

  private basicPersistentTreatment(
    state: ClinicalSimulationState,
    target: ClinicalTreatmentId,
    label: string,
    detail: string,
    kind: 'oxygen' | 'access' | 'monitoring' | 'fluids' | 'medication' | 'support',
    intensity: 'low' | 'medium' | 'high',
    delta: Partial<Record<keyof ClinicalSimulationState['physiology'], number>>,
    message: string
  ): ClinicalTreatmentResolution {
    const existing = state.activeInterventions.get(target);
    if (existing) {
      this.applyDelta(state, delta);
      return {
        applied: true,
        alreadyActive: true,
        message,
        immediateEffects: [this.t(state.config.language, 'التدخل كان فعالاً بالفعل وما زال مستمراً.', 'The intervention was already active and remains in place.')]
      };
    }

    this.applyDelta(state, delta);
    return {
      applied: true,
      message,
      immediateEffects: [],
      startIntervention: {
        id: target,
        label,
        detail,
        kind,
        intensity,
        startedAt: Date.now(),
        active: true
      }
    };
  }

  private harmfulTreatment(
    state: ClinicalSimulationState,
    messageAr: string,
    messageEn: string,
    delta: Partial<Record<keyof ClinicalSimulationState['physiology'], number>>
  ): ClinicalTreatmentResolution {
    this.applyDelta(state, delta);
    return {
      applied: true,
      dangerous: true,
      message: this.t(state.config.language, messageAr, messageEn),
      immediateEffects: [this.t(state.config.language, 'القرار غير مناسب وأدى إلى أثر سلبي مباشر.', 'The action was inappropriate and caused direct harm.')],
      scoreEffects: { safety: -8, treatment: -6 }
    };
  }

  private genericNeutralTreatment(state: ClinicalSimulationState, label: string): ClinicalTreatmentResolution {
    return {
      applied: false,
      message: this.t(state.config.language, `هذا الإجراء (${label}) ليس من أولويات هذه الحالة حالياً.`, `That action (${label}) is not a priority for this case right now.`),
      immediateEffects: [],
      scoreEffects: { treatment: -2 }
    };
  }

  private normalize(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/[ة]/g, 'ه')
      .replace(/[ىي]/g, 'ي')
      .replace(/\s+/g, ' ');
  }

  private round(value: number): number {
    return Math.round(value);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private t(language: SimulationScenarioConfig['language'], arabic: string, english: string) {
    return language === 'ar' ? arabic : english;
  }

  private buildHypoglycemiaDefinition(): ClinicalCaseDefinition {
    return {
      id: 'hypoglycemia',
      aliases: ['hypoglycemia', 'hypoglycaemia', 'low blood sugar', 'نقص السكر', 'هبوط السكر'],
      titles: { ar: 'نقص سكر الدم الحاد', en: 'Acute Hypoglycemia' },
      overview: { ar: 'مريض مع altered mental status بسبب انخفاض شديد في glucose.', en: 'A patient with altered mental status due to severe hypoglycemia.' },
      ageRange: [24, 74] as const,
      gender: 'any',
      basePhysiology: { metabolic: 72, neurologic: 58, perfusion: 18 },
      deteriorationPerTick: { metabolic: 1.8, neurologic: 1.4 },
      targetInvestigations: ['glucose', 'bmp', 'ecg'],
      targetTreatments: ['monitor', 'iv-access', 'dextrose', 'reassess'],
      expectations: {
        keyHistory: ['onset', 'medications', 'last-meal', 'pmh'],
        keyExams: ['general', 'vitals', 'neuro'],
        keyInvestigations: ['glucose', 'bmp', 'ecg'],
        keyTreatments: ['monitor', 'iv-access', 'dextrose', 'reassess'],
        harmfulActions: ['insulin'],
        diagnosticKeywords: ['hypoglycemia', 'low glucose', 'insulin'],
        differentialList: ['Hypoglycemia', 'Post-ictal state', 'Stroke']
      },
      generatePatientChart: (context) => this.buildChart(context, {
        chiefComplaint: this.t(context.language, 'تعرّق، رجفان، انخفاض وعي.', 'Sweating, tremor, and reduced consciousness.'),
        triageNote: this.t(context.language, 'المريض مشوش، جلده بارد ورطب، واستجابته بطيئة.', 'The patient is confused, clammy, and slow to respond.'),
        hpi: [
          this.t(context.language, 'أُحضر من المنزل بعد تدهور مفاجئ في الوعي.', 'Brought from home after a sudden decline in alertness.'),
          this.t(context.language, 'المرافق يذكر أن المريض أخذ insulin لكنه لم يأكل جيداً.', 'The accompanying relative says the patient took insulin but barely ate.')
        ],
        pmh: [
          this.t(context.language, 'Diabetes mellitus على insulin.', 'Diabetes mellitus on insulin.'),
          this.t(context.language, 'نوبات hypoglycemia سابقة متفرقة.', 'Intermittent prior hypoglycemia episodes.')
        ],
        meds: ['Insulin glargine', 'Insulin lispro'],
        allergies: [this.t(context.language, 'لا حساسية دوائية معروفة', 'No known drug allergies')],
        social: [this.t(context.language, 'آخر وجبة كانت خفيفة جداً هذا الصباح.', 'Only a very light meal earlier today.')],
        risks: ['Impaired consciousness', 'Neuroglycopenia', 'Recurrent insulin exposure']
      }),
      initialHighlightedExams: (context) => [
        this.examSection('general', context, 'مظهر عام / General', this.t(context.language, 'مريض شاحب ومتعرق مع تباطؤ واضح.', 'Pale, diaphoretic patient with obvious slowing.'), [
          this.t(context.language, 'يستجيب للصوت فقط.', 'Responds to voice only.'),
          this.t(context.language, 'جلد بارد ورطب.', 'Cold clammy skin.')
        ], 'baseline'),
        this.examSection('neuro', context, 'الوعي / Consciousness', this.t(context.language, 'Confusion مع بطء إدراكي.', 'Confusion with slowed cognition.'), [
          this.t(context.language, 'GCS تقريباً 12/15.', 'Approximate GCS 12/15.'),
          this.t(context.language, 'لا يوجد عجز بؤري واضح.', 'No focal deficit is obvious.')
        ], 'baseline')
      ],
      resolveVitals: (state) => ({
        heartRate: this.round(88 + (state.physiology.metabolic * 0.34) + (state.physiology.neurologic * 0.12)),
        respiratoryRate: this.round(16 + (state.physiology.metabolic * 0.08)),
        bloodPressureSystolic: this.round(132 - (state.physiology.metabolic * 0.18)),
        bloodPressureDiastolic: this.round(78 - (state.physiology.metabolic * 0.08)),
        oxygenSaturation: 97,
        temperatureCelsius: 36.4,
        mentalStatus: state.physiology.neurologic >= 72 ? this.t(state.config.language, 'مشوش / نعسان', 'Confused / drowsy') : this.t(state.config.language, 'أفضل من البداية', 'Improving')
      }),
      resolveSeverity: (state) => state.physiology.metabolic >= 82 || state.physiology.neurologic >= 80 ? 'critical'
        : state.physiology.metabolic >= 64 ? 'unstable'
          : state.physiology.metabolic >= 40 ? 'concerning'
            : 'stable',
      nextPrompt: (state) => this.t(state.config.language, 'ما تقييمك الأولي وما أول تدخل ستبدأه الآن؟', 'What is your immediate assessment, and what will you do first?'),
      openingNarrative: (context) => this.t(
        context.language,
        `أنت داخل ${context.lens.displayName.ar}. المريض ${context.patientName}، عمره ${context.patientAge} سنة، وصل بحالة تغير وعي مفاجئ مع تعرق ورجفان. المطلوب أن تقيّم وتتصرف بسرعة قبل مزيد من التدهور.`,
        `You are working in ${context.lens.displayName.en}. ${context.patientName}, age ${context.patientAge}, arrives with sudden altered mental status, diaphoresis, and tremor. Assess and intervene quickly before further decline.`
      ),
      historyResponse: (target, state) => target === 'medications'
        ? this.t(state.config.language, 'أخذ جرعة insulin المعتادة، لكن الأكل كان قليلاً جداً.', 'He took the usual insulin dose but ate very little.')
        : target === 'last-meal'
          ? this.t(state.config.language, 'آخر وجبة كانت صغيرة جداً منذ ساعات.', 'The last meal was very small and several hours ago.')
          : target === 'pmh'
            ? this.t(state.config.language, 'لديه diabetes معروف على insulin.', 'Known diabetes managed with insulin.')
            : target === 'onset'
              ? this.t(state.config.language, 'التدهور كان مفاجئاً نسبياً خلال أقل من ساعة.', 'The decline was relatively sudden within the last hour.')
              : this.t(state.config.language, 'القصة ترجح hypoglycemia مرتبطة بالجرعة وعدم الأكل.', 'The history points toward hypoglycemia related to insulin and poor intake.'),
      examResponse: (target, state) => target === 'neuro'
        ? {
            id: 'neuro',
            label: this.t(state.config.language, 'الفحص العصبي', 'Neurologic Exam'),
            summary: this.t(state.config.language, 'المريض مشوش لكن دون deficit بؤري واضح.', 'The patient is confused without a clear focal deficit.'),
            findings: [
              this.t(state.config.language, 'GCS نحو 12/15.', 'GCS around 12/15.'),
              this.t(state.config.language, 'لا علامات stroke بؤرية واضحة.', 'No clear focal stroke signs.')
            ],
            status: 'requested'
          }
        : (target === 'vitals' || target === 'general')
          ? {
              id: target,
              label: this.t(state.config.language, 'العلامات الحيوية / المظهر العام', 'Vitals / General'),
              summary: this.t(state.config.language, 'تعرق، رجفان، وتباطؤ استجابة.', 'Diaphoresis, tremor, and slowed responsiveness.'),
              findings: [
                this.t(state.config.language, 'جلد بارد رطب.', 'Cold clammy skin.'),
                this.t(state.config.language, 'المريض يستجيب ببطء للأسئلة.', 'The patient answers slowly.')
              ],
              status: 'requested'
            }
          : null,
      investigationResult: (target, state) => target === 'glucose'
        ? this.labPanel(state, 'Point-of-care glucose', 'Bedside measurement', this.t(state.config.language, 'نتيجة حاسمة لحالة الوعي الحالية.', 'This is the key result for the current mental status.'), [{
            id: 'glucose',
            label: 'Glucose',
            items: [this.labValue('Glucose', '42', 'mg/dL', '70-140', 'critical')]
          }], true)
        : (target === 'bmp' || target === 'cmp')
          ? this.labPanel(state, 'Metabolic profile', 'Basic metabolic panel', this.t(state.config.language, 'لا يوجد اضطراب شديد آخر غير glucose المنخفض حالياً.', 'No major competing derangement besides severe hypoglycemia.'), [{
              id: 'bmp',
              label: 'BMP',
              items: [
                this.labValue('Na', '138', 'mmol/L', '135-145'),
                this.labValue('K', '4.2', 'mmol/L', '3.5-5.1'),
                this.labValue('Creatinine', '0.9', 'mg/dL', '0.6-1.3')
              ]
            }])
          : target === 'ecg'
            ? this.ecgResult('normal', state, 'ECG', this.t(state.config.language, 'نظم جيبي سريع خفيف دون ischemic changes.', 'Mild sinus tachycardia without ischemic changes.'), [
                this.t(state.config.language, 'Sinus tachycardia mild.', 'Mild sinus tachycardia.')
              ])
            : null,
      applyTreatment: (target, state) => {
        switch (target) {
          case 'monitor':
            return this.basicPersistentTreatment(state, 'monitor', this.t(state.config.language, 'مراقبة مستمرة', 'Continuous monitoring'), this.t(state.config.language, 'تم ربط المريض بالمونيتور.', 'The patient is connected to continuous monitoring.'), 'monitoring', 'medium', {}, this.t(state.config.language, 'تم وضع المريض على المونيتور.', 'Continuous monitoring is now in place.'));
          case 'iv-access':
            return this.basicPersistentTreatment(state, 'iv-access', this.t(state.config.language, 'IV line', 'IV access'), this.t(state.config.language, 'تم تركيب خط وريدي.', 'IV access has been established.'), 'access', 'medium', {}, this.t(state.config.language, 'تم فتح خط وريدي.', 'IV access has been obtained.'));
          case 'dextrose':
            this.applyDelta(state, { metabolic: -42, neurologic: -30 });
            return { applied: true, message: this.t(state.config.language, 'أُعطي dextrose، وبدأت الاستجابة العصبية تتحسن.', 'Dextrose was administered and mental status is starting to improve.'), immediateEffects: [this.t(state.config.language, 'ازداد مستوى الوعي تدريجياً.', 'Mental status is improving.')] };
          case 'insulin':
            return this.harmfulTreatment(state, 'إعطاء insulin هنا يفاقم hypoglycemia.', 'Giving insulin here worsens hypoglycemia.', { metabolic: 18, neurologic: 12 });
          case 'reassess':
            this.applyDelta(state, { neurologic: -8 });
            return { applied: true, message: this.t(state.config.language, 'إعادة التقييم أظهرت تحسن الاستجابة بعد التدخل.', 'Reassessment shows improved responsiveness after treatment.'), immediateEffects: [] };
          default:
            return this.genericNeutralTreatment(state, target);
        }
      },
      buildDifferentials: (state) => this.basicDifferentials(state, [
        ['Hypoglycemia', 'high', 'Capillary glucose explains the reduced consciousness and autonomic symptoms.'],
        ['Post-ictal state', 'medium', 'Confusion could mimic a recent seizure, but diaphoresis and insulin exposure fit hypoglycemia better.'],
        ['Stroke', 'low', 'Neurologic emergency remains on the list until focal deficit or glucose result clarifies the picture.']
      ]),
      buildIdealPlan: (language, lens) => [
        this.t(language, 'ابدأ monitor + capillary glucose فوراً.', 'Start monitoring and check capillary glucose immediately.'),
        this.t(language, 'افتح IV line ثم أعط dextrose سريعاً إذا كان glucose منخفضاً.', 'Establish IV access and give dextrose promptly if glucose is low.'),
        this.t(language, 'أعد تقييم الوعي والعلامات الحيوية بعد العلاج.', 'Reassess mental status and vitals after treatment.'),
        this.t(language, `وثّق السبب المحتمل ونسّق مع ${lens.consultantLabel.en} أو الفريق المناسب لمنع التكرار.`, `Document the likely trigger and coordinate with ${lens.consultantLabel.en} or the relevant team to prevent recurrence.`)
      ],
      buildOutcomeNarrative: (state) => state.severity === 'stable'
        ? this.t(state.config.language, 'تحسن مستوى الوعي بعد تصحيح السكر، وأصبح المريض أكثر أماناً مع حاجة لمتابعة السبب.', 'Mental status improved after glucose correction, and the patient is safer but still needs cause-focused follow-up.')
        : this.t(state.config.language, 'استمر نقص السكر أو تأخر تصحيحه، ما أبقى الحالة عصبية وغير آمنة.', 'Hypoglycemia persisted or was corrected late, leaving the patient neurologically vulnerable.')
    };
  }
  private buildCopdDefinition(): ClinicalCaseDefinition {
    return {
      id: 'copd-exacerbation',
      aliases: ['copd', 'copd exacerbation', 'copd flare', 'تفاقم copd', 'تفاقم الانسداد الرئوي'],
      titles: { ar: 'تفاقم COPD', en: 'COPD Exacerbation' },
      overview: { ar: 'ضيق نفس متفاقم مع wheeze واحتباس CO2 محتمل.', en: 'An acute COPD flare with dyspnea, wheeze, and likely CO2 retention.' },
      ageRange: [54, 79] as const,
      gender: 'any',
      basePhysiology: { oxygenation: 66, ventilation: 62, infection: 28, perfusion: 22 },
      deteriorationPerTick: { oxygenation: 1.5, ventilation: 1.2, infection: 0.4 },
      targetInvestigations: ['abg', 'cbc', 'bmp', 'chest-xray'],
      targetTreatments: ['oxygen', 'monitor', 'iv-access', 'nebulizer', 'steroids', 'reassess'],
      expectations: {
        keyHistory: ['onset', 'associated-symptoms', 'pmh', 'medications'],
        keyExams: ['general', 'vitals', 'breathing', 'chest'],
        keyInvestigations: ['abg', 'cbc', 'bmp', 'chest-xray'],
        keyTreatments: ['oxygen', 'monitor', 'nebulizer', 'steroids', 'reassess'],
        harmfulActions: [],
        diagnosticKeywords: ['copd', 'copd exacerbation', 'co2 retention', 'hypercapnia'],
        differentialList: ['COPD exacerbation', 'Pneumonia', 'Acute heart failure']
      },
      generatePatientChart: (context) => this.buildChart(context, {
        chiefComplaint: this.t(context.language, 'ضيق نفس متزايد مع سعال وبلغم.', 'Worsening shortness of breath with cough and sputum.'),
        triageNote: this.t(context.language, 'يجلس بوضعية tripod ويتكلم بكلمات متقطعة.', 'Sits in a tripod position and speaks in broken phrases.'),
        hpi: [
          this.t(context.language, 'ازداد ضيق النفس خلال 2-3 أيام مع صفير واضح.', 'Dyspnea has worsened over 2-3 days with obvious wheeze.'),
          this.t(context.language, 'البلغم ازداد كثافة وتغير لونه.', 'Sputum became thicker and changed color.')
        ],
        pmh: [
          this.t(context.language, 'COPD معروف مع تدخين طويل سابق.', 'Known COPD with a long prior smoking history.'),
          this.t(context.language, 'دخولات سابقة للمستشفى بسبب exacerbations.', 'Previous admissions for COPD exacerbations.')
        ],
        meds: ['Tiotropium inhaler', 'Salbutamol inhaler'],
        allergies: [this.t(context.language, 'لا حساسية دوائية معروفة', 'No known drug allergies')],
        social: [this.t(context.language, 'أوقف التدخين قبل سنة لكنه ما زال يتعرض لدخان المنزل.', 'Stopped smoking a year ago but still has household smoke exposure.')],
        risks: ['Respiratory fatigue', 'Hypercapnia', 'Hypoxemia']
      }),
      initialHighlightedExams: (context) => [
        this.examSection('breathing', context, 'التنفس / Breathing', this.t(context.language, 'ضيق نفس واضح مع wheeze منتشر.', 'Marked respiratory distress with diffuse wheeze.'), [
          this.t(context.language, 'استخدام accessory muscles.', 'Accessory muscle use.'),
          this.t(context.language, 'زفير مطوّل.', 'Prolonged expiratory phase.')
        ], 'baseline')
      ],
      resolveVitals: (state) => this.respiratoryVitals(state, 'copd'),
      resolveSeverity: (state) => this.respiratorySeverity(state),
      nextPrompt: (state) => this.t(state.config.language, 'قيّم airway والتنفس، وقرّر ما الفحوصات والعلاج الأولي المطلوب الآن.', 'Assess airway and breathing, then decide on the immediate investigations and first-line treatment.'),
      openingNarrative: (context) => this.t(
        context.language,
        `أنت في ${context.lens.setting.ar}. ${context.patientName}، ${context.patientAge} سنة، يعاني من COPD معروف وجاء بضيق نفس متفاقم مع wheeze وسعال منتج.`,
        `You are in ${context.lens.setting.en}. ${context.patientName}, age ${context.patientAge}, has known COPD and presents with worsening dyspnea, wheeze, and productive cough.`
      ),
      historyResponse: (target, state) => target === 'onset'
        ? this.t(state.config.language, 'ضيق النفس ازداد تدريجياً خلال يومين إلى ثلاثة.', 'Breathlessness worsened over two to three days.')
        : target === 'associated-symptoms'
          ? this.t(state.config.language, 'هناك زيادة في السعال والبلغم مع صفير.', 'There is more cough, sputum, and wheeze.')
          : target === 'pmh'
            ? this.t(state.config.language, 'COPD معروف مع admissions سابقة.', 'Known COPD with prior exacerbation admissions.')
            : this.t(state.config.language, 'يستخدم inhalers في البيت لكنه لم يتحسن بما يكفي اليوم.', 'Uses home inhalers but did not improve enough today.'),
      examResponse: (target, state) => (target === 'chest' || target === 'breathing')
        ? {
            id: target,
            label: this.t(state.config.language, 'فحص الصدر', 'Chest Exam'),
            summary: this.t(state.config.language, 'Wheeze منتشر وزفير مطول.', 'Diffuse wheeze with prolonged expiration.'),
            findings: [this.t(state.config.language, 'استعمال عضلات إضافية.', 'Accessory muscle use.'), this.t(state.config.language, 'air entry أقل من الطبيعي لكنه مسموع.', 'Air entry is reduced but present.')],
            status: 'requested'
          }
        : null,
      investigationResult: (target, state) => target === 'abg'
        ? this.abgResult(state, 'ABG', 'Arterial blood gas', this.t(state.config.language, 'تتوافق مع hypercapnic respiratory failure جزئياً.', 'Compatible with partially decompensated hypercapnic respiratory failure.'), [
            this.labValue('pH', '7.30', '', '7.35-7.45', 'low'),
            this.labValue('PaCO2', '58', 'mmHg', '35-45', 'high'),
            this.labValue('PaO2', '60', 'mmHg', '80-100', 'low'),
            this.labValue('HCO3-', '29', 'mmol/L', '22-26', 'high')
          ], this.t(state.config.language, 'Respiratory acidosis with hypercapnia and hypoxemia.', 'Respiratory acidosis with hypercapnia and hypoxemia.'))
        : target === 'cbc'
          ? this.labPanel(state, 'CBC', 'Complete blood count', this.t(state.config.language, 'قد توجد leukocytosis خفيفة كمثير للـ exacerbation.', 'There may be mild leukocytosis as part of the trigger.'), [{
              id: 'cbc',
              label: 'CBC',
              items: [
                this.labValue('WBC', '13.2', 'x10^9/L', '4.0-11.0', 'high'),
                this.labValue('Hb', '14.6', 'g/dL', '12-16'),
                this.labValue('Platelets', '286', 'x10^9/L', '150-400')
              ]
            }])
          : (target === 'bmp' || target === 'cmp')
            ? this.labPanel(state, 'BMP', 'Basic metabolic panel', this.t(state.config.language, 'لا يوجد اضطراب كيميائي حاد يغيّر الخطة الأولية.', 'No major chemistry abnormality changes the immediate plan.'), [{
                id: 'bmp',
                label: 'BMP',
                items: [
                  this.labValue('Na', '136', 'mmol/L', '135-145'),
                  this.labValue('K', '4.5', 'mmol/L', '3.5-5.1'),
                  this.labValue('Creatinine', '1.1', 'mg/dL', '0.6-1.3')
                ]
              }])
            : target === 'chest-xray'
              ? this.imagingResult(state, 'Chest X-ray', 'xray', 'Chest X-ray', this.t(state.config.language, 'تظهر فرط انتفاخ دون ارتشاح واضح.', 'Shows hyperinflation without a focal infiltrate.'), [
                  this.t(state.config.language, 'فرط انتفاخ رئوي.', 'Hyperinflation.'),
                  this.t(state.config.language, 'لا consolidation واضحة.', 'No clear focal consolidation.')
                ], this.t(state.config.language, 'CXR يدعم COPD exacerbation دون pneumonia واضحة.', 'Chest X-ray supports COPD exacerbation without clear pneumonia.'), [
                  this.t(state.config.language, 'Diaphragm flattened', 'Flattened diaphragms'),
                  this.t(state.config.language, 'Hyperinflated lungs', 'Hyperinflated lungs')
                ])
              : null,
      applyTreatment: (target, state) => {
        switch (target) {
          case 'oxygen':
            return this.basicPersistentTreatment(state, 'oxygen', 'Controlled oxygen', this.t(state.config.language, 'Venturi / titrated oxygen started.', 'Venturi / titrated oxygen started.'), 'oxygen', 'medium', { oxygenation: -14 }, this.t(state.config.language, 'بدأ دعم الأكسجين بشكل مضبوط.', 'Controlled oxygen support has started.'));
          case 'monitor':
            return this.basicPersistentTreatment(state, 'monitor', 'Respiratory monitoring', this.t(state.config.language, 'Continuous pulse oximetry and monitor active.', 'Continuous pulse oximetry and monitoring are active.'), 'monitoring', 'medium', {}, this.t(state.config.language, 'تم تفعيل المراقبة المستمرة.', 'Continuous monitoring is active.'));
          case 'iv-access':
            return this.basicPersistentTreatment(state, 'iv-access', 'IV access', this.t(state.config.language, 'IV cannula inserted.', 'IV cannula inserted.'), 'access', 'low', {}, this.t(state.config.language, 'تم تأمين الخط الوريدي.', 'IV access is secured.'));
          case 'nebulizer':
            this.applyDelta(state, { ventilation: -18, oxygenation: -10 });
            return { applied: true, message: this.t(state.config.language, 'أُعطي nebulizer bronchodilator، وبدأ wheeze يخف تدريجياً.', 'Nebulized bronchodilator was given, and the wheeze is starting to ease.'), immediateEffects: [this.t(state.config.language, 'هبط جهد التنفس قليلاً.', 'Work of breathing has fallen slightly.')] };
          case 'steroids':
            this.applyDelta(state, { ventilation: -8, infection: -4 });
            return { applied: true, message: this.t(state.config.language, 'تم بدء steroids كجزء من علاج exacerbation.', 'Steroids have been started as part of exacerbation management.'), immediateEffects: [] };
          case 'reassess':
            this.applyDelta(state, { oxygenation: -5, ventilation: -6 });
            return { applied: true, message: this.t(state.config.language, 'إعادة التقييم تُظهر أن الكلام والأكسجة أفضل من البداية.', 'Reassessment shows better speech and oxygenation than at baseline.'), immediateEffects: [] };
          default:
            return this.genericNeutralTreatment(state, target);
        }
      },
      buildDifferentials: (state) => this.basicDifferentials(state, [
        ['COPD exacerbation', 'high', 'Known COPD with wheeze, prolonged expiration, and likely hypercapnia.'],
        ['Pneumonia', 'medium', 'Infective trigger remains possible if fever, WBC rise, or infiltrate appears.'],
        ['Acute heart failure', 'low', 'Dyspnea is possible, but wheeze and sputum pattern point more toward COPD.']
      ]),
      buildIdealPlan: (language) => [
        this.t(language, 'ابدأ مراقبة + controlled oxygen مع هدف SpO2 مناسب.', 'Start monitoring and controlled oxygen with an appropriate saturation target.'),
        this.t(language, 'أعط bronchodilator nebulizer وsteroids مبكراً.', 'Give bronchodilator nebulization and steroids early.'),
        this.t(language, 'اطلب ABG وCXR وراقب مؤشرات fatigue/CO2 retention.', 'Request ABG and chest X-ray, and watch for fatigue or CO2 retention.'),
        this.t(language, 'أعد التقييم بعد كل تدخل وصعّد إذا استمرت الضائقة التنفسية.', 'Reassess after each move and escalate if respiratory distress persists.')
      ],
      buildOutcomeNarrative: (state) => state.severity === 'stable'
        ? this.t(state.config.language, 'تحسنت الأكسجة وجهد التنفس بعد bronchodilator والدعم المناسب.', 'Oxygenation and work of breathing improved after bronchodilator therapy and appropriate support.')
        : this.t(state.config.language, 'بقيت الضائقة التنفسية قائمة مع خطر fatigue واحتباس CO2.', 'Respiratory distress persisted with risk of fatigue and worsening CO2 retention.')
    };
  }
  private buildMiDefinition(): ClinicalCaseDefinition {
    return {
      id: 'myocardial-infarction',
      aliases: ['mi', 'myocardial infarction', 'stemi', 'nstemi', 'chest pain', 'احتشاء', 'جلطة قلبية', 'ذبحة'],
      titles: { ar: 'احتشاء عضلة القلب', en: 'Myocardial Infarction' },
      overview: { ar: 'ألم صدري ضاغط مع ischemic ECG/troponin pattern.', en: 'Pressure-like chest pain with ischemic ECG and troponin findings.' },
      ageRange: [42, 78] as const,
      gender: 'any',
      basePhysiology: { coronary: 78, perfusion: 28, pain: 58 },
      deteriorationPerTick: { coronary: 1.6, perfusion: 1.1 },
      targetInvestigations: ['ecg', 'troponin', 'cbc', 'bmp'],
      targetTreatments: ['monitor', 'iv-access', 'oxygen', 'aspirin', 'nitroglycerin', 'heparin', 'reassess'],
      expectations: {
        keyHistory: ['onset', 'associated-symptoms', 'pmh', 'medications'],
        keyExams: ['general', 'vitals', 'cardiac', 'circulation'],
        keyInvestigations: ['ecg', 'troponin', 'bmp'],
        keyTreatments: ['monitor', 'aspirin', 'nitroglycerin', 'heparin', 'reassess'],
        harmfulActions: [],
        diagnosticKeywords: ['mi', 'stemi', 'myocardial infarction', 'acs', 'acute coronary syndrome'],
        differentialList: ['STEMI', 'NSTEMI', 'Aortic dissection', 'Pulmonary embolism']
      },
      generatePatientChart: (context) => this.buildChart(context, {
        chiefComplaint: this.t(context.language, 'ألم صدري ضاغط ممتد للذراع اليسرى.', 'Central crushing chest pain radiating to the left arm.'),
        triageNote: this.t(context.language, 'المريض شاحب ومتعرق ويبدو قلقاً بشدة.', 'The patient is pale, diaphoretic, and visibly distressed.'),
        hpi: [
          this.t(context.language, 'الألم بدأ منذ 40 دقيقة أثناء الراحة.', 'Pain began 40 minutes ago at rest.'),
          this.t(context.language, 'يترافق مع غثيان وتعرق وضيق نفس خفيف.', 'Associated with nausea, diaphoresis, and mild dyspnea.')
        ],
        pmh: ['Hypertension', 'Type 2 diabetes', this.t(context.language, 'تدخين سابق', 'Former smoker')],
        meds: ['Amlodipine', 'Metformin'],
        allergies: [this.t(context.language, 'لا حساسية دوائية معروفة', 'No known drug allergies')],
        social: [this.t(context.language, 'لديه عوامل خطورة قلبية متعددة.', 'Has multiple cardiovascular risk factors.')],
        risks: ['Ongoing ischemia', 'Arrhythmia', 'Cardiogenic compromise']
      }),
      initialHighlightedExams: (context) => [
        this.examSection('cardiac', context, 'القلب / Cardiac', this.t(context.language, 'ألم صدري إقفاري النمط مع توتر واضح.', 'Ischemic-type chest pain with marked distress.'), [
          this.t(context.language, 'المريض يقبض على منتصف الصدر.', 'The patient clutches the central chest.'),
          this.t(context.language, 'الجلد متعرق.', 'Profuse diaphoresis.')
        ], 'baseline')
      ],
      resolveVitals: (state) => ({
        heartRate: this.round(86 + (state.physiology.coronary * 0.28) + (state.physiology.pain * 0.12)),
        respiratoryRate: this.round(18 + (state.physiology.coronary * 0.08)),
        bloodPressureSystolic: this.round(138 - (state.physiology.perfusion * 0.28)),
        bloodPressureDiastolic: this.round(84 - (state.physiology.perfusion * 0.1)),
        oxygenSaturation: this.round(97 - (state.physiology.perfusion * 0.04)),
        temperatureCelsius: 36.8,
        mentalStatus: this.t(state.config.language, 'يقظ لكنه متألم', 'Alert but in pain')
      }),
      resolveSeverity: (state) => state.physiology.coronary >= 84 || state.physiology.perfusion >= 76 ? 'critical'
        : state.physiology.coronary >= 64 ? 'unstable'
          : state.physiology.coronary >= 40 ? 'concerning'
            : 'stable',
      nextPrompt: (state) => this.t(state.config.language, 'ما أولوياتك الآن من diagnosis, ECG, والـ reperfusion-oriented management؟', 'What are your immediate priorities for diagnosis, ECG, and reperfusion-oriented management?'),
      openingNarrative: (context) => this.t(
        context.language,
        `المشهد الآن في ${context.lens.setting.ar}. ${context.patientName}، عمره ${context.patientAge} سنة، وصل بألم صدري ضاغط مع تعرّق وغثيان.`,
        `You are in ${context.lens.setting.en}. ${context.patientName}, age ${context.patientAge}, presents with crushing chest pain, diaphoresis, and nausea.`
      ),
      historyResponse: (target, state) => target === 'onset'
        ? this.t(state.config.language, 'الألم بدأ بشكل ضاغط قبل نحو 40 دقيقة أثناء الراحة.', 'The pain started as a pressure sensation about 40 minutes ago at rest.')
        : target === 'associated-symptoms'
          ? this.t(state.config.language, 'غثيان، تعرق، وضيق نفس خفيف.', 'There is nausea, diaphoresis, and mild dyspnea.')
          : target === 'pmh'
            ? this.t(state.config.language, 'لديه عوامل خطورة قلبية مثل السكري وارتفاع الضغط.', 'There are cardiovascular risk factors such as diabetes and hypertension.')
            : this.t(state.config.language, 'لا توجد أدوية مضادة للتخثر حالياً حسب المعطيات الأولى.', 'No current anticoagulant use is apparent from the initial history.'),
      examResponse: (target, state) => (target === 'cardiac' || target === 'general')
        ? {
            id: target,
            label: this.t(state.config.language, 'الفحص السريري', 'Clinical Exam'),
            summary: this.t(state.config.language, 'المريض شاحب ومتعرق ويتألم صدرياً.', 'The patient is pale, diaphoretic, and in chest pain.'),
            findings: [this.t(state.config.language, 'لا توجد crackles واضحة حالياً.', 'No clear crackles are present right now.'), this.t(state.config.language, 'الأطراف دافئة لكن المريض قلق جداً.', 'Extremities are warm but the patient is extremely anxious.')],
            status: 'requested'
          }
        : null,
      investigationResult: (target, state) => target === 'ecg'
        ? this.ecgResult('stemi', state, '12-lead ECG', this.t(state.config.language, 'تبدلات ST elevation في الجدار السفلي/الأمامي حسب المحاكاة.', 'ST-segment elevation pattern consistent with acute myocardial infarction.'), [
            this.t(state.config.language, 'ST elevation متوافق مع acute MI.', 'ST elevation consistent with acute MI.'),
            this.t(state.config.language, 'يتطلب ACS pathway عاجلاً.', 'Requires urgent ACS pathway escalation.')
          ])
        : target === 'troponin'
          ? this.labPanel(state, 'Cardiac markers', 'Troponin', this.t(state.config.language, 'يدعم حدوث أذية عضلية قلبية.', 'Supports myocardial injury.'), [{
              id: 'troponin',
              label: 'Troponin',
              items: [this.labValue('Troponin I', '2.4', 'ng/mL', '<0.04', 'critical')]
            }], true)
          : (target === 'bmp' || target === 'cmp')
            ? this.labPanel(state, 'BMP', 'Chemistry', this.t(state.config.language, 'النتائج الكيميائية الأساسية لا تمنع الخطة الأولية.', 'The core chemistry does not change the immediate plan.'), [{
                id: 'bmp',
                label: 'BMP',
                items: [this.labValue('K', '4.2', 'mmol/L', '3.5-5.1'), this.labValue('Creatinine', '1.0', 'mg/dL', '0.6-1.3')]
              }])
            : target === 'cbc'
              ? this.labPanel(state, 'CBC', 'Complete blood count', this.t(state.config.language, 'CBC دون شذوذات تغير القرار القلبي الأولي.', 'CBC does not change the early cardiac decision-making.'), [{
                  id: 'cbc',
                  label: 'CBC',
                  items: [this.labValue('Hb', '14.2', 'g/dL', '12-16'), this.labValue('WBC', '9.6', 'x10^9/L', '4.0-11.0')]
                }])
              : null,
      applyTreatment: (target, state) => {
        switch (target) {
          case 'monitor':
            return this.basicPersistentTreatment(state, 'monitor', 'Cardiac monitor', this.t(state.config.language, 'Continuous ECG monitoring active.', 'Continuous ECG monitoring active.'), 'monitoring', 'high', {}, this.t(state.config.language, 'تم وصل المريض على المراقبة القلبية.', 'The patient is on cardiac monitoring.'));
          case 'iv-access':
            return this.basicPersistentTreatment(state, 'iv-access', 'IV access', this.t(state.config.language, 'IV access established for ACS management.', 'IV access established for ACS management.'), 'access', 'medium', {}, this.t(state.config.language, 'تم فتح خط وريدي.', 'IV access established.'));
          case 'oxygen':
            return this.basicPersistentTreatment(state, 'oxygen', 'Oxygen support', this.t(state.config.language, 'Low-flow oxygen running.', 'Low-flow oxygen running.'), 'oxygen', 'low', { oxygenation: -4 }, this.t(state.config.language, 'بدأ دعم الأكسجين.', 'Oxygen support started.'));
          case 'aspirin':
            this.applyDelta(state, { coronary: -18 });
            return { applied: true, message: this.t(state.config.language, 'أُعطي aspirin مبكراً، وهو قرار مناسب في ACS.', 'Aspirin was given early, which is appropriate in ACS.'), immediateEffects: [this.t(state.config.language, 'الخطر الإقفاري ينخفض تدريجياً.', 'Ischemic risk is starting to ease.')] };
          case 'nitroglycerin':
            this.applyDelta(state, { coronary: -10, pain: -12, perfusion: 2 });
            return { applied: true, message: this.t(state.config.language, 'أُعطي nitroglycerin مع متابعة الضغط.', 'Nitroglycerin was given with blood pressure monitoring.'), immediateEffects: [] };
          case 'heparin':
            this.applyDelta(state, { coronary: -12 });
            return { applied: true, message: this.t(state.config.language, 'بدأ anticoagulation المبدئي ضمن ACS pathway.', 'Initial anticoagulation has been started as part of the ACS pathway.'), immediateEffects: [] };
          case 'reassess':
            this.applyDelta(state, { pain: -8, coronary: -6 });
            return { applied: true, message: this.t(state.config.language, 'إعادة التقييم: الألم أخف قليلاً لكن الحالة ما زالت تحتاج reperfusion pathway.', 'Reassessment: the pain is somewhat easier, but the patient still needs a reperfusion pathway.'), immediateEffects: [] };
          default:
            return this.genericNeutralTreatment(state, target);
        }
      },
      buildDifferentials: (state) => this.basicDifferentials(state, [
        ['STEMI / ACS', 'high', 'Classic ischemic chest pain with expected ECG and troponin correlation.'],
        ['Aortic dissection', 'medium', 'Consider if the pain is tearing or pulse deficits appear.'],
        ['Pulmonary embolism', 'low', 'Can cause chest pain and dyspnea, but the pattern is less typical here.']
      ]),
      buildIdealPlan: (language) => [
        this.t(language, 'ابدأ monitor واطلب ECG خلال دقائق.', 'Start monitoring and obtain a 12-lead ECG within minutes.'),
        this.t(language, 'أعط aspirin باكراً مع تقييم suitability لـ nitroglycerin/heparin.', 'Give aspirin early and assess suitability for nitroglycerin and heparin.'),
        this.t(language, 'اطلب troponin وBMP ونسّق مع فريق reperfusion/cath lab حسب النمط.', 'Order troponin and BMP, then coordinate reperfusion / cath lab escalation according to the pattern.'),
        this.t(language, 'استمر في reassessment للألم، الضغط، والنظم.', 'Continue reassessment of pain, blood pressure, and rhythm.')
      ],
      buildOutcomeNarrative: (state) => state.severity === 'stable'
        ? this.t(state.config.language, 'تم التعرف على ACS مبكراً وبدأت المعالجة المبدئية المناسبة.', 'ACS was recognized early and appropriate initial management was started.')
        : this.t(state.config.language, 'بقيت الإقفارية نشطة أو تأخر التدخل، ما أبقى الخطر القلبي مرتفعاً.', 'Ischemia remained active or treatment was delayed, leaving a high-risk cardiac course.')
    };
  }
  private buildAnaphylaxisDefinition(): ClinicalCaseDefinition {
    return {
      id: 'anaphylaxis',
      aliases: ['anaphylaxis', 'allergic shock', 'تحسس شديد', 'صدمة تحسسية', 'anaphylactic'],
      titles: { ar: 'التأق الحاد', en: 'Anaphylaxis' },
      overview: { ar: 'تفاعل تحسسي يهدد airway والدورة الدموية.', en: 'A severe allergic reaction threatening the airway and circulation.' },
      ageRange: [18, 52] as const,
      gender: 'any',
      basePhysiology: { allergic: 84, oxygenation: 58, perfusion: 62 },
      deteriorationPerTick: { allergic: 1.8, oxygenation: 1.4, perfusion: 1.5 },
      targetInvestigations: ['cbc'],
      targetTreatments: ['oxygen', 'monitor', 'iv-access', 'epinephrine', 'iv-fluids', 'reassess'],
      expectations: {
        keyHistory: ['onset', 'allergies', 'context'],
        keyExams: ['general', 'airway', 'breathing', 'circulation'],
        keyInvestigations: ['cbc'],
        keyTreatments: ['epinephrine', 'oxygen', 'iv-fluids', 'monitor', 'reassess'],
        harmfulActions: [],
        diagnosticKeywords: ['anaphylaxis', 'allergic shock', 'allergic reaction'],
        differentialList: ['Anaphylaxis', 'Septic shock', 'Asthma exacerbation']
      },
      generatePatientChart: (context) => this.buildChart(context, {
        chiefComplaint: this.t(context.language, 'ضيق نفس مفاجئ مع طفح وانخفاض ضغط.', 'Sudden shortness of breath with rash and hypotension.'),
        triageNote: this.t(context.language, 'بعد تعرض حديث لمسبب تحسسي محتمل.', 'Shortly after a likely allergen exposure.'),
        hpi: [
          this.t(context.language, 'الأعراض بدأت خلال دقائق من دواء/طعام جديد.', 'Symptoms started within minutes of a new medication or food.'),
          this.t(context.language, 'المريض يشتكي من ضيق صدر، حكة، ودوخة.', 'The patient reports chest tightness, itching, and dizziness.')
        ],
        pmh: [this.t(context.language, 'تاريخ حساسية غذائية سابقة.', 'History of prior food allergy.')],
        meds: [],
        allergies: [this.t(context.language, 'حساسية محتملة لمسبب حديث', 'Likely allergy to a recent exposure')],
        social: [this.t(context.language, 'لا توجد قصة مرضية مزمنة مهمة.', 'No significant chronic medical history.')],
        risks: ['Airway edema', 'Distributive shock', 'Rapid deterioration']
      }),
      initialHighlightedExams: (context) => [
        this.examSection('airway', context, 'الهواء / Airway', this.t(context.language, 'صوت أجش مع إحساس tight throat.', 'Hoarse voice with throat tightness.'), [
          this.t(context.language, 'تورم شفاه خفيف.', 'Mild lip swelling.'),
          this.t(context.language, 'البلع مزعج.', 'Swallowing feels uncomfortable.')
        ], 'baseline'),
        this.examSection('general', context, 'الجلد / Skin', this.t(context.language, 'طفح شروي منتشر.', 'Widespread urticaria.'), [
          this.t(context.language, 'حكة واحمرار جلدي.', 'Pruritic erythematous rash.')
        ], 'baseline')
      ],
      resolveVitals: (state) => ({
        heartRate: this.round(102 + (state.physiology.allergic * 0.24) + (state.physiology.perfusion * 0.18)),
        respiratoryRate: this.round(20 + (state.physiology.oxygenation * 0.14)),
        bloodPressureSystolic: this.round(118 - (state.physiology.perfusion * 0.38)),
        bloodPressureDiastolic: this.round(72 - (state.physiology.perfusion * 0.18)),
        oxygenSaturation: this.round(96 - (state.physiology.oxygenation * 0.18)),
        temperatureCelsius: 36.7,
        mentalStatus: state.physiology.perfusion >= 72 ? this.t(state.config.language, 'قلق / دوخة', 'Anxious / dizzy') : this.t(state.config.language, 'أوضح من البداية', 'Clearer than baseline')
      }),
      resolveSeverity: (state) => state.physiology.allergic >= 82 || state.physiology.perfusion >= 76 ? 'critical'
        : state.physiology.allergic >= 60 ? 'unstable'
          : state.physiology.allergic >= 36 ? 'concerning'
            : 'stable',
      nextPrompt: (state) => this.t(state.config.language, 'هل هذه anaphylaxis؟ وما أول تدخل life-saving ستبدأه؟', 'Is this anaphylaxis, and what is your first life-saving action?'),
      openingNarrative: (context) => this.t(
        context.language,
        `المريض ${context.patientName} وصل بعد تعرض حديث لمسبب تحسسي محتمل مع طفح وضيق نفس ودوخة. الحالة قد تتدهور خلال دقائق.`,
        `${context.patientName} has arrived after a likely allergen exposure with rash, shortness of breath, and dizziness. This case can deteriorate within minutes.`
      ),
      historyResponse: (_target, state) => this.t(state.config.language, 'الأعراض بدأت خلال دقائق من تعرض دوائي/غذائي حديث، مع طفح وحكة وتضيق نفس.', 'Symptoms started within minutes of a recent medication or food exposure, with rash, itching, and shortness of breath.'),
      examResponse: (target, state) => target === 'airway'
        ? {
            id: 'airway',
            label: this.t(state.config.language, 'Airway', 'Airway'),
            summary: this.t(state.config.language, 'بحة وصعوبة حلقية مع احتمال وذمة مبكرة.', 'Hoarseness and throat tightness suggesting early edema.'),
            findings: [this.t(state.config.language, 'Lip swelling.', 'Lip swelling.'), this.t(state.config.language, 'Hoarse voice.', 'Hoarse voice.')],
            status: 'critical'
          }
        : target === 'breathing'
          ? {
              id: 'breathing',
              label: this.t(state.config.language, 'Breathing', 'Breathing'),
              summary: this.t(state.config.language, 'Wheeze مع ضيق نفس.', 'Wheeze with dyspnea.'),
              findings: [this.t(state.config.language, 'SpO2 منخفضة نسبياً.', 'Relative hypoxemia is present.')],
              status: 'critical'
            }
          : null,
      investigationResult: (target, state) => target === 'cbc'
        ? this.labPanel(state, 'CBC', 'Supportive labs', this.t(state.config.language, 'الفحوصات ليست ما ينقذ المريض الآن؛ العلاج أولاً.', 'Labs are not the life-saving priority here; treatment comes first.'), [{
            id: 'cbc',
            label: 'CBC',
            items: [this.labValue('WBC', '11.8', 'x10^9/L', '4.0-11.0', 'high'), this.labValue('Hb', '13.7', 'g/dL', '12-16')]
          }])
        : null,
      applyTreatment: (target, state) => {
        switch (target) {
          case 'epinephrine':
            this.applyDelta(state, { allergic: -34, oxygenation: -16, perfusion: -20 });
            return { applied: true, message: this.t(state.config.language, 'أُعطي epinephrine مبكراً، وهذا هو التدخل المحوري في anaphylaxis.', 'Epinephrine was given early; this is the pivotal life-saving intervention in anaphylaxis.'), immediateEffects: [this.t(state.config.language, 'الضغط والتنفس بدآ يتحسنان.', 'Blood pressure and breathing are beginning to improve.')] };
          case 'oxygen':
            return this.basicPersistentTreatment(state, 'oxygen', 'High-flow oxygen', this.t(state.config.language, 'Oxygen running.', 'Oxygen running.'), 'oxygen', 'high', { oxygenation: -12 }, this.t(state.config.language, 'تم بدء الأكسجين.', 'Oxygen support started.'));
          case 'monitor':
            return this.basicPersistentTreatment(state, 'monitor', 'Emergency monitoring', this.t(state.config.language, 'Continuous monitor applied.', 'Continuous monitor applied.'), 'monitoring', 'high', {}, this.t(state.config.language, 'المراقبة المستمرة فعالة.', 'Continuous monitoring is active.'));
          case 'iv-access':
            return this.basicPersistentTreatment(state, 'iv-access', 'IV access', this.t(state.config.language, 'IV access established.', 'IV access established.'), 'access', 'high', {}, this.t(state.config.language, 'تم فتح IV سريعاً.', 'Rapid IV access established.'));
          case 'iv-fluids':
            return this.basicPersistentTreatment(state, 'iv-fluids', 'IV fluids', this.t(state.config.language, 'Fluid bolus running.', 'Fluid bolus running.'), 'fluids', 'high', { perfusion: -16 }, this.t(state.config.language, 'بدأت fluid resuscitation.', 'Fluid resuscitation has started.'));
          case 'reassess':
            this.applyDelta(state, { oxygenation: -6, perfusion: -8 });
            return { applied: true, message: this.t(state.config.language, 'إعادة التقييم: الأكسجة والضغط أفضل من البداية لكن يلزم مراقبة لصيقة.', 'Reassessment: oxygenation and blood pressure are better than baseline but still need close observation.'), immediateEffects: [] };
          default:
            return this.genericNeutralTreatment(state, target);
        }
      },
      buildDifferentials: (state) => this.basicDifferentials(state, [
        ['Anaphylaxis', 'high', 'Acute onset after exposure with skin, airway, and circulatory findings.'],
        ['Asthma exacerbation', 'medium', 'Wheeze may overlap, but rash and hypotension support anaphylaxis.'],
        ['Septic shock', 'low', 'Shock is possible, but the abrupt allergic presentation makes it less likely.']
      ]),
      buildIdealPlan: (language) => [
        this.t(language, 'أعط IM epinephrine فوراً.', 'Give IM epinephrine immediately.'),
        this.t(language, 'ادعم airway/oxygen وابدأ monitor + IV access.', 'Support the airway / oxygen and start monitoring with IV access.'),
        this.t(language, 'أعط IV fluids إذا وُجد hypotension.', 'Give IV fluids when hypotension is present.'),
        this.t(language, 'أعد التقييم سريعاً لأن التدهور في هذه الحالة time-sensitive.', 'Reassess quickly because deterioration is time-sensitive in this scenario.')
      ],
      buildOutcomeNarrative: (state) => state.severity === 'stable'
        ? this.t(state.config.language, 'تم عكس التفاعل التحسسي تدريجياً بعد epinephrine والدعم المناسب.', 'The allergic cascade was reversed progressively after epinephrine and supportive care.')
        : this.t(state.config.language, 'لم يُعكس التفاعل التحسسي بسرعة كافية، وبقيت الدورة الدموية/الأكسجة مهددتين.', 'The allergic reaction was not reversed quickly enough, leaving circulation and oxygenation at risk.')
    };
  }
  private buildSepticShockDefinition(): ClinicalCaseDefinition {
    return {
      id: 'septic-shock',
      aliases: ['sepsis', 'septic shock', 'shock sepsis', 'صدمة إنتانية', 'إنتان', 'septic'],
      titles: { ar: 'صدمة إنتانية', en: 'Septic Shock' },
      overview: { ar: 'Shock state مع infection source، hypotension، وlactate مرتفع.', en: 'A shock state with infection source, hypotension, and elevated lactate.' },
      ageRange: [28, 81] as const,
      gender: 'any',
      basePhysiology: { infection: 86, perfusion: 78, metabolic: 44 },
      deteriorationPerTick: { infection: 1.2, perfusion: 1.8, metabolic: 1.1 },
      targetInvestigations: ['cbc', 'cmp', 'lactate', 'blood-cultures', 'abg', 'chest-xray'],
      targetTreatments: ['monitor', 'oxygen', 'iv-access', 'iv-fluids', 'antibiotics', 'vasopressors', 'reassess'],
      expectations: {
        keyHistory: ['onset', 'associated-symptoms', 'pmh', 'context'],
        keyExams: ['general', 'vitals', 'circulation', 'breathing'],
        keyInvestigations: ['cbc', 'lactate', 'blood-cultures', 'abg'],
        keyTreatments: ['monitor', 'iv-access', 'iv-fluids', 'antibiotics', 'reassess'],
        harmfulActions: ['nitroglycerin'],
        diagnosticKeywords: ['septic shock', 'sepsis', 'shock'],
        differentialList: ['Septic shock', 'Hypovolemic shock', 'Anaphylaxis']
      },
      generatePatientChart: (context) => this.buildChart(context, {
        chiefComplaint: this.t(context.language, 'حمى، تدهور عام، وانخفاض ضغط.', 'Fever, malaise, and low blood pressure.'),
        triageNote: this.t(context.language, 'المريض مصاب بتسرع قلب وهبوط ضغط مع برودة أطراف.', 'The patient is tachycardic and hypotensive with cool extremities.'),
        hpi: [
          this.t(context.language, 'تدهور خلال 24 ساعة مع حرارة ورعشة ووهن.', 'Progressive decline over 24 hours with fever, rigors, and weakness.'),
          this.t(context.language, 'هناك مصدر عدوى محتمل صدري أو بولي حسب القصة.', 'History suggests a possible pulmonary or urinary source.')
        ],
        pmh: [this.t(context.language, 'قد يكون لديه مرض مزمن أو مناعة ضعيفة جزئياً.', 'May have chronic disease or partial immune compromise.')],
        meds: [],
        allergies: [this.t(context.language, 'لا حساسية دوائية موثقة', 'No documented drug allergies')],
        social: [this.t(context.language, 'العائلة تذكر قلة بول ودوخة متزايدة.', 'Family reports reduced urine output and worsening dizziness.')],
        risks: ['Refractory hypotension', 'High lactate', 'Organ hypoperfusion']
      }),
      initialHighlightedExams: (context) => [
        this.examSection('circulation', context, 'الدورة الدموية / Circulation', this.t(context.language, 'أطراف باردة وإعادة امتلاء بطيئة.', 'Cool extremities with delayed capillary refill.'), [
          this.t(context.language, 'Capillary refill متأخر.', 'Delayed capillary refill.'),
          this.t(context.language, 'النبض سريع وضعيف.', 'Pulse is fast and weak.')
        ], 'baseline')
      ],
      resolveVitals: (state) => ({
        heartRate: this.round(108 + (state.physiology.infection * 0.18) + (state.physiology.perfusion * 0.24)),
        respiratoryRate: this.round(22 + (state.physiology.metabolic * 0.1)),
        bloodPressureSystolic: this.round(116 - (state.physiology.perfusion * 0.42)),
        bloodPressureDiastolic: this.round(66 - (state.physiology.perfusion * 0.18)),
        oxygenSaturation: this.round(95 - (state.physiology.infection * 0.06)),
        temperatureCelsius: Number((37.1 + (state.physiology.infection * 0.02)).toFixed(1)),
        mentalStatus: state.physiology.perfusion >= 74 ? this.t(state.config.language, 'مشوش / نعسان', 'Confused / drowsy') : this.t(state.config.language, 'يتجاوب لكنه مرهق', 'Responsive but fatigued')
      }),
      resolveSeverity: (state) => state.physiology.perfusion >= 82 || state.physiology.infection >= 88 ? 'critical'
        : state.physiology.perfusion >= 64 ? 'unstable'
          : state.physiology.perfusion >= 40 ? 'concerning'
            : 'stable',
      nextPrompt: (state) => this.t(state.config.language, 'تصرّف كحالة septic shock: ما أولوياتك في sepsis bundle والـ hemodynamic support؟', 'Treat this as septic shock: what are your sepsis bundle and hemodynamic priorities?'),
      openingNarrative: (context) => this.t(
        context.language,
        `هذا مريض في ${context.lens.displayName.ar} مع shock state محتملة مرتبطة بعدوى. الضغط منخفض، النبض سريع، والتدهور يبدو جاريًا.`,
        `This patient in ${context.lens.displayName.en} appears to be in a shock state related to infection. Blood pressure is falling, the pulse is rapid, and deterioration is ongoing.`
      ),
      historyResponse: (_target, state) => this.t(state.config.language, 'هناك حرارة/رعشة مع أعراض ترجح مصدر عدوى، مع قلة بول ودوخة وهبوط ضغط.', 'There are fever and rigors with symptoms suggesting an infectious source, along with low urine output, dizziness, and hypotension.'),
      examResponse: (target, state) => target === 'circulation'
        ? {
            id: 'circulation',
            label: this.t(state.config.language, 'Circulation', 'Circulation'),
            summary: this.t(state.config.language, 'ضغط منخفض ونبض سريع مع refill بطيء.', 'Low blood pressure and a rapid pulse with delayed refill.'),
            findings: [this.t(state.config.language, 'الأطراف باردة.', 'Cool extremities.'), this.t(state.config.language, 'Cap refill متأخر.', 'Capillary refill is delayed.')],
            status: 'critical'
          }
        : null,
      investigationResult: (target, state) => {
        if (target === 'cbc') {
          return this.labPanel(state, 'CBC', 'Sepsis workup', this.t(state.config.language, 'CBC يدعم عدوى جهازية.', 'CBC supports systemic infection.'), [{
            id: 'cbc',
            label: 'CBC',
            items: [
              this.labValue('WBC', '18.6', 'x10^9/L', '4.0-11.0', 'high'),
              this.labValue('Hb', '12.4', 'g/dL', '12-16'),
              this.labValue('Platelets', '142', 'x10^9/L', '150-400', 'low')
            ]
          }], true);
        }
        if (target === 'lactate') {
          return this.labPanel(state, 'Lactate', 'Perfusion marker', this.t(state.config.language, 'يدل على hypoperfusion مهم.', 'Suggests significant hypoperfusion.'), [{
            id: 'lactate',
            label: 'Lactate',
            items: [this.labValue('Lactate', '4.8', 'mmol/L', '0.5-2.0', 'critical')]
          }], true);
        }
        if (target === 'blood-cultures') {
          return this.labPanel(state, 'Blood cultures', 'Microbiology', this.t(state.config.language, 'أُخذت cultures قبل/حول بدء antibiotics إن أمكن.', 'Cultures were obtained before or around antibiotic initiation when feasible.'), [{
            id: 'cultures',
            label: 'Status',
            items: [this.labValue('Cultures', this.t(state.config.language, 'قيد المعالجة', 'Collected and pending'))]
          }]);
        }
        if (target === 'abg') {
          return this.abgResult(state, 'ABG', 'Shock assessment', this.t(state.config.language, 'يوحي بحماض استقلابي مرتبط بنقص التروية.', 'Suggests metabolic acidosis related to hypoperfusion.'), [
            this.labValue('pH', '7.28', '', '7.35-7.45', 'low'),
            this.labValue('PaCO2', '31', 'mmHg', '35-45', 'low'),
            this.labValue('HCO3-', '15', 'mmol/L', '22-26', 'low')
          ], this.t(state.config.language, 'Metabolic acidosis with respiratory compensation.', 'Metabolic acidosis with respiratory compensation.'));
        }
        if (target === 'cmp' || target === 'bmp') {
          return this.labPanel(state, 'CMP', 'Chemistry', this.t(state.config.language, 'الوظائف الكلوية بدأت تتأثر بنقص التروية.', 'Renal function is beginning to reflect hypoperfusion.'), [{
            id: 'cmp',
            label: 'CMP',
            items: [
              this.labValue('Creatinine', '1.7', 'mg/dL', '0.6-1.3', 'high'),
              this.labValue('Na', '133', 'mmol/L', '135-145', 'low')
            ]
          }]);
        }
        if (target === 'chest-xray') {
          return this.imagingResult(state, 'Chest X-ray', 'xray', 'Portable Chest X-ray', this.t(state.config.language, 'ترتسم ارتشاحات قاعدية/بؤرية كمصدر عدوى محتمل.', 'Shows patchy basal infiltrates as a possible infectious source.'), [
            this.t(state.config.language, 'Infiltrate in lower lobe.', 'Lower-lobe infiltrate.'),
            this.t(state.config.language, 'No pneumothorax.', 'No pneumothorax.')
          ], this.t(state.config.language, 'CXR suggests a pulmonary septic source.', 'Chest X-ray suggests a pulmonary septic source.'), [
            this.t(state.config.language, 'Basal opacity', 'Basal opacity')
          ]);
        }
        return null;
      },
      applyTreatment: (target, state) => {
        switch (target) {
          case 'monitor':
            return this.basicPersistentTreatment(state, 'monitor', 'Hemodynamic monitoring', this.t(state.config.language, 'Continuous monitoring running.', 'Continuous monitoring running.'), 'monitoring', 'high', {}, this.t(state.config.language, 'المراقبة الدموية فعالة الآن.', 'Hemodynamic monitoring is now active.'));
          case 'oxygen':
            return this.basicPersistentTreatment(state, 'oxygen', 'Oxygen support', this.t(state.config.language, 'Oxygen support running.', 'Oxygen support running.'), 'oxygen', 'medium', { oxygenation: -8 }, this.t(state.config.language, 'بدأ دعم الأكسجين.', 'Oxygen support started.'));
          case 'iv-access':
            return this.basicPersistentTreatment(state, 'iv-access', 'Large-bore IV access', this.t(state.config.language, 'Wide-bore IV access established.', 'Large-bore IV access established.'), 'access', 'high', {}, this.t(state.config.language, 'تم تأمين خطوط وريدية.', 'IV access has been secured.'));
          case 'iv-fluids':
            return this.basicPersistentTreatment(state, 'iv-fluids', 'Fluid resuscitation', this.t(state.config.language, 'Crystalloid bolus is running.', 'Crystalloid bolus is running.'), 'fluids', 'high', { perfusion: -18, metabolic: -4 }, this.t(state.config.language, 'بدأت fluid resuscitation.', 'Fluid resuscitation has started.'));
          case 'antibiotics':
            this.applyDelta(state, { infection: -18 });
            return { applied: true, message: this.t(state.config.language, 'بدأت antibiotics مبكراً، وهو قرار أساسي في septic shock.', 'Broad-spectrum antibiotics were started early, which is essential in septic shock.'), immediateEffects: [] };
          case 'vasopressors':
            this.applyDelta(state, { perfusion: -12 });
            return { applied: true, message: this.t(state.config.language, 'بدأ دعم vasopressors بسبب استمرار hypotension.', 'Vasopressor support was started because hypotension persisted.'), immediateEffects: [] };
          case 'nitroglycerin':
            return this.harmfulTreatment(state, 'nitroglycerin هنا سيزيد hypotension في shock.', 'Nitroglycerin here worsens hypotension in shock.', { perfusion: 16 });
          case 'reassess':
            this.applyDelta(state, { perfusion: -8, metabolic: -4 });
            return { applied: true, message: this.t(state.config.language, 'إعادة التقييم: التروية تحسنت جزئياً لكن الحالة ما زالت حرجة وتحتاج متابعة دقيقة.', 'Reassessment: perfusion has partially improved, but the patient remains high risk and needs close follow-up.'), immediateEffects: [] };
          default:
            return this.genericNeutralTreatment(state, target);
        }
      },
      buildDifferentials: (state) => this.basicDifferentials(state, [
        ['Septic shock', 'high', 'Hypotension with infection markers and elevated lactate fits septic shock.'],
        ['Hypovolemic shock', 'medium', 'Shock physiology overlaps, but fever / infection markers favor sepsis.'],
        ['Anaphylaxis', 'low', 'Distributive physiology is possible, but the infectious prodrome makes it less likely.']
      ]),
      buildIdealPlan: (language) => [
        this.t(language, 'ابدأ monitor وIV access واسع ثم fluid resuscitation مبكراً.', 'Start monitoring, secure large-bore IV access, and begin fluid resuscitation early.'),
        this.t(language, 'اطلب CBC/CMP/lactate/cultures وABG بحسب الحاجة.', 'Request CBC, CMP, lactate, cultures, and ABG as indicated.'),
        this.t(language, 'ابدأ antibiotics مبكراً بعد أخذ cultures إذا أمكن دون تأخير ضار.', 'Start antibiotics early after obtaining cultures when feasible without harmful delay.'),
        this.t(language, 'إذا بقي hypotension، فكّر في vasopressors مع استمرار reassessment.', 'If hypotension persists, consider vasopressors while continuing reassessment.')
      ],
      buildOutcomeNarrative: (state) => state.severity === 'stable'
        ? this.t(state.config.language, 'تحسن perfusion تدريجياً بعد bundle مناسب وعلاج عدوى مبكر.', 'Perfusion improved gradually after an appropriate bundle and early infection-directed therapy.')
        : this.t(state.config.language, 'بقيت صدمة الإنتان فعالة مع نقص تروية مستمر أو علاج متأخر.', 'Septic shock remained active with ongoing hypoperfusion or delayed treatment.')
    };
  }
  private buildAcuteAsthmaDefinition(): ClinicalCaseDefinition {
    return {
      id: 'acute-asthma',
      aliases: ['asthma', 'acute asthma', 'status asthmaticus', 'ربو', 'ازمة ربو', 'أزمة ربو'],
      titles: { ar: 'أزمة ربو حادة', en: 'Acute Asthma' },
      overview: { ar: 'Bronchospasm حاد مع wheeze ونقص أكسجة متدرج.', en: 'Acute bronchospasm with wheeze and progressive hypoxemia.' },
      ageRange: [4, 14] as const,
      gender: 'any',
      basePhysiology: { oxygenation: 68, ventilation: 70, allergic: 24 },
      deteriorationPerTick: { oxygenation: 1.6, ventilation: 1.4 },
      targetInvestigations: ['abg', 'chest-xray'],
      targetTreatments: ['oxygen', 'monitor', 'nebulizer', 'steroids', 'reassess'],
      expectations: {
        keyHistory: ['onset', 'associated-symptoms', 'pmh', 'context'],
        keyExams: ['general', 'breathing', 'chest', 'vitals'],
        keyInvestigations: ['abg'],
        keyTreatments: ['oxygen', 'nebulizer', 'steroids', 'monitor', 'reassess'],
        harmfulActions: [],
        diagnosticKeywords: ['asthma', 'acute asthma', 'bronchospasm'],
        differentialList: ['Acute asthma', 'Anaphylaxis', 'Pneumonia']
      },
      generatePatientChart: (context) => this.buildChart(context, {
        chiefComplaint: this.t(context.language, 'صفير وضيق نفس حاد عند طفل.', 'Acute wheeze and shortness of breath in a child.'),
        triageNote: this.t(context.language, 'الطفل متعب، يتكلم بكلمات قصيرة، والأم قلقة.', 'The child is tired, speaking in short phrases, and the caregiver is anxious.'),
        hpi: [
          this.t(context.language, 'بدأت الأعراض بعد عدوى علوية/محفز معروف.', 'Symptoms began after a URTI or a known trigger.'),
          this.t(context.language, 'استجاب جزئياً للبخاخ المنزلي ثم ساء مجدداً.', 'There was only partial response to the home inhaler before worsening again.')
        ],
        pmh: [this.t(context.language, 'ربو معروف مع نوبات سابقة.', 'Known asthma with prior exacerbations.')],
        meds: ['Salbutamol inhaler'],
        allergies: [this.t(context.language, 'قد توجد حساسية صدرية/تحسسية', 'Possible atopic history')],
        social: [this.t(context.language, 'الطفل مع والدته الآن.', 'The child is accompanied by a caregiver.')],
        risks: ['Respiratory fatigue', 'Silent chest if worsening', 'Pediatric dosing']
      }),
      initialHighlightedExams: (context) => [
        this.examSection('breathing', context, 'التنفس / Breathing', this.t(context.language, 'صفير منتشر مع سحب عضلي.', 'Diffuse wheeze with increased work of breathing.'), [
          this.t(context.language, 'Intercostal retractions.', 'Intercostal retractions.'),
          this.t(context.language, 'ينطق بكلمات قصيرة فقط.', 'Speech limited to short phrases.')
        ], 'baseline')
      ],
      resolveVitals: (state) => this.respiratoryVitals(state, 'asthma'),
      resolveSeverity: (state) => this.respiratorySeverity(state),
      nextPrompt: (state) => this.t(state.config.language, 'هذه حالة pediatric asthma. ماذا ستفحص وتبدأ من علاج الآن؟', 'This is pediatric acute asthma. What will you assess and treat first?'),
      openingNarrative: (context) => this.t(
        context.language,
        `طفل اسمه ${context.patientName}، عمره ${context.patientAge} سنوات، وصل إلى ${context.lens.displayName.ar} بصفير واضح وضيق نفس متزايد.`,
        `${context.patientName} is a ${context.patientAge}-year-old child presenting to ${context.lens.displayName.en} with marked wheeze and worsening dyspnea.`
      ),
      historyResponse: (_target, state) => this.t(state.config.language, 'يوجد تاريخ ربو معروف، والأعراض بدأت بعد trigger تنفسي/تحسسي مع استجابة ضعيفة للبخاخ المنزلي.', 'There is known asthma, and symptoms began after a respiratory or allergic trigger with poor response to the home inhaler.'),
      examResponse: (target, state) => (target === 'chest' || target === 'breathing')
        ? {
            id: target,
            label: this.t(state.config.language, 'Chest Exam', 'Chest Exam'),
            summary: this.t(state.config.language, 'Wheeze منتشر مع work of breathing مرتفع.', 'Diffuse wheeze with increased work of breathing.'),
            findings: [this.t(state.config.language, 'Retractions present.', 'Retractions present.'), this.t(state.config.language, 'Air entry reduced but audible.', 'Air entry is reduced but still audible.')],
            status: 'requested'
          }
        : null,
      investigationResult: (target, state) => target === 'abg'
        ? this.abgResult(state, 'ABG', 'Asthma severity', this.t(state.config.language, 'يوحي بإنهاك تنفسي يقترب إذا استمر التدهور.', 'Suggests evolving respiratory fatigue if deterioration continues.'), [
            this.labValue('pH', '7.34', '', '7.35-7.45', 'low'),
            this.labValue('PaCO2', '46', 'mmHg', '35-45', 'high'),
            this.labValue('PaO2', '68', 'mmHg', '80-100', 'low')
          ], this.t(state.config.language, 'Borderline ventilatory failure in severe asthma.', 'Borderline ventilatory failure in severe asthma.'))
        : target === 'chest-xray'
          ? this.imagingResult(state, 'Chest X-ray', 'xray', 'Chest X-ray', this.t(state.config.language, 'لا توجد بؤرة التهابية واضحة؛ الصورة أقرب إلى air trapping.', 'No focal infiltrate; the film is more consistent with air trapping.'), [
              this.t(state.config.language, 'Hyperinflation without focal consolidation.', 'Hyperinflation without focal consolidation.')
            ], this.t(state.config.language, 'Imaging supports acute asthma rather than pneumonia.', 'Imaging supports acute asthma rather than pneumonia.'), [
              this.t(state.config.language, 'Hyperinflation', 'Hyperinflation')
            ])
          : null,
      applyTreatment: (target, state) => {
        switch (target) {
          case 'oxygen':
            return this.basicPersistentTreatment(state, 'oxygen', 'Oxygen support', this.t(state.config.language, 'Supplemental oxygen active.', 'Supplemental oxygen active.'), 'oxygen', 'medium', { oxygenation: -14 }, this.t(state.config.language, 'تم بدء الأكسجين.', 'Oxygen support started.'));
          case 'monitor':
            return this.basicPersistentTreatment(state, 'monitor', 'Pediatric monitoring', this.t(state.config.language, 'Continuous monitoring active.', 'Continuous monitoring active.'), 'monitoring', 'medium', {}, this.t(state.config.language, 'بدأت المراقبة المستمرة.', 'Continuous monitoring started.'));
          case 'nebulizer':
            this.applyDelta(state, { ventilation: -20, oxygenation: -10 });
            return { applied: true, message: this.t(state.config.language, 'أُعطي bronchodilator nebulizer وتحسن wheeze نسبياً.', 'Nebulized bronchodilator was given and the wheeze has eased somewhat.'), immediateEffects: [] };
          case 'steroids':
            this.applyDelta(state, { ventilation: -8 });
            return { applied: true, message: this.t(state.config.language, 'تم بدء steroids مبكراً ضمن خطة الأزمة.', 'Steroids have been started early as part of the exacerbation plan.'), immediateEffects: [] };
          case 'reassess':
            this.applyDelta(state, { oxygenation: -5, ventilation: -6 });
            return { applied: true, message: this.t(state.config.language, 'إعادة التقييم: الطفل يتكلم أسهل من البداية لكن ما زال يحتاج متابعة لصيقة.', 'Reassessment: the child is speaking more easily than at baseline but still needs close observation.'), immediateEffects: [] };
          default:
            return this.genericNeutralTreatment(state, target);
        }
      },
      buildDifferentials: (state) => this.basicDifferentials(state, [
        ['Acute asthma', 'high', 'Known asthma with wheeze and increased work of breathing.'],
        ['Anaphylaxis', 'medium', 'Consider if rash or recent allergen exposure appears.'],
        ['Pneumonia', 'low', 'Fever and focal findings would push this higher.']
      ]),
      buildIdealPlan: (language) => [
        this.t(language, 'ادعم oxygenation حسب الحاجة.', 'Support oxygenation as needed.'),
        this.t(language, 'ابدأ bronchodilator nebulizer وsteroids مبكراً.', 'Start bronchodilator nebulization and steroids early.'),
        this.t(language, 'راقب signs of fatigue أو silent chest.', 'Watch for fatigue or a developing silent chest.'),
        this.t(language, 'أعد التقييم سريعاً لأن الطفل قد يتدهور أسرع من البالغ.', 'Reassess rapidly because children can deteriorate faster than adults.')
      ],
      buildOutcomeNarrative: (state) => state.severity === 'stable'
        ? this.t(state.config.language, 'تحسن wheeze وجهد التنفس تدريجياً بعد المعالجة المناسبة.', 'Wheeze and work of breathing improved gradually after appropriate therapy.')
        : this.t(state.config.language, 'بقيت الأزمة التنفسية فعالة مع خطر إجهاد تنفسي متزايد.', 'The asthma attack remained active with rising risk of respiratory fatigue.')
    };
  }
  private buildAppendicitisDefinition(): ClinicalCaseDefinition {
    return {
      id: 'acute-appendicitis',
      aliases: ['appendicitis', 'acute appendicitis', 'right lower quadrant', 'التهاب الزائدة', 'زائدة'],
      titles: { ar: 'التهاب زائدة حاد', en: 'Acute Appendicitis' },
      overview: { ar: 'Acute abdomen مع ألم RLQ واحتياج لتقييم جراحي.', en: 'An acute abdomen presentation with RLQ pain and surgical decision-making.' },
      ageRange: [14, 38] as const,
      gender: 'any',
      basePhysiology: { pain: 66, infection: 32, perfusion: 18 },
      deteriorationPerTick: { pain: 0.8, infection: 0.9 },
      targetInvestigations: ['cbc', 'bmp', 'ct-abdomen'],
      targetTreatments: ['iv-access', 'iv-fluids', 'analgesia', 'surgical-consult', 'reassess'],
      expectations: {
        keyHistory: ['onset', 'associated-symptoms', 'last-meal'],
        keyExams: ['general', 'abdomen', 'vitals'],
        keyInvestigations: ['cbc', 'ct-abdomen'],
        keyTreatments: ['iv-access', 'iv-fluids', 'analgesia', 'surgical-consult', 'reassess'],
        harmfulActions: [],
        diagnosticKeywords: ['appendicitis', 'appendix', 'acute appendicitis'],
        differentialList: ['Acute appendicitis', 'Gastroenteritis', 'Ovarian pathology']
      },
      generatePatientChart: (context) => this.buildChart(context, {
        chiefComplaint: this.t(context.language, 'ألم بطني انتقل إلى الربع السفلي الأيمن.', 'Abdominal pain migrating to the right lower quadrant.'),
        triageNote: this.t(context.language, 'مريض متألم مع غثيان وفقدان شهية.', 'The patient is uncomfortable with nausea and anorexia.'),
        hpi: [
          this.t(context.language, 'بدأ الألم حول السرة ثم تمركز في RLQ.', 'Pain started peri-umbilically, then localized to the RLQ.'),
          this.t(context.language, 'يوجد غثيان وربما قيء خفيف.', 'Nausea and possible mild vomiting are present.')
        ],
        pmh: [this.t(context.language, 'لا تاريخ جراحي مهم.', 'No major surgical history.')],
        meds: [],
        allergies: [this.t(context.language, 'لا حساسية معروفة', 'No known allergies')],
        social: [this.t(context.language, 'لم يأكل جيداً منذ بداية الألم.', 'Poor oral intake since the pain began.')],
        risks: ['Progressive peritonism', 'Need for timely surgical review']
      }),
      initialHighlightedExams: (context) => [
        this.examSection('abdomen', context, 'البطن / Abdomen', this.t(context.language, 'Tenderness واضح في RLQ.', 'Clear RLQ tenderness.'), [
          this.t(context.language, 'Rebound tenderness خفيف إلى متوسط.', 'Mild-to-moderate rebound tenderness.'),
          this.t(context.language, 'Guarding موضعي.', 'Localized guarding.')
        ], 'baseline')
      ],
      resolveVitals: (state) => ({
        heartRate: this.round(86 + (state.physiology.pain * 0.2) + (state.physiology.infection * 0.12)),
        respiratoryRate: this.round(18 + (state.physiology.pain * 0.06)),
        bloodPressureSystolic: 122,
        bloodPressureDiastolic: 76,
        oxygenSaturation: 99,
        temperatureCelsius: Number((37.1 + (state.physiology.infection * 0.012)).toFixed(1)),
        mentalStatus: this.t(state.config.language, 'يقظ ومتألم', 'Alert and uncomfortable')
      }),
      resolveSeverity: (state) => state.physiology.infection >= 74 ? 'unstable'
        : state.physiology.pain >= 44 ? 'concerning'
          : 'stable',
      nextPrompt: (state) => this.t(state.config.language, 'خذ history مناسب وافحص البطن ثم قرّر imaging/consult.', 'Take an appropriate history, examine the abdomen, then decide on imaging and consultation.'),
      openingNarrative: (context) => this.t(
        context.language,
        `${context.patientName} حضر بألم بطني بدأ بشكل مبهم ثم تمركز في RLQ. المطلوب الآن تقييم جراحي منطقي وليس مسكنات فقط.`,
        `${context.patientName} presents with abdominal pain that started vaguely and then localized to the RLQ. This now needs structured surgical assessment, not pain relief alone.`
      ),
      historyResponse: (target, state) => target === 'onset'
        ? this.t(state.config.language, 'الألم بدأ حول السرة ثم انتقل إلى RLQ.', 'Pain began peri-umbilically and then moved to the RLQ.')
        : target === 'associated-symptoms'
          ? this.t(state.config.language, 'غثيان، فقدان شهية، وربما حرارة خفيفة.', 'There is nausea, anorexia, and possibly low-grade fever.')
          : this.t(state.config.language, 'القصة تدعم appendicitis أكثر من ألم بطني غير نوعي.', 'The history favors appendicitis over nonspecific abdominal pain.'),
      examResponse: (target, state) => target === 'abdomen'
        ? {
            id: 'abdomen',
            label: this.t(state.config.language, 'Abdominal Exam', 'Abdominal Exam'),
            summary: this.t(state.config.language, 'Tenderness موضعي في RLQ مع guarding.', 'Localized RLQ tenderness with guarding.'),
            findings: [
              this.t(state.config.language, 'Rebound positive mildly.', 'Mild rebound tenderness.'),
              this.t(state.config.language, 'Cough/percussion tenderness present.', 'Cough / percussion tenderness is present.')
            ],
            status: 'requested'
          }
        : null,
      investigationResult: (target, state) => target === 'cbc'
        ? this.labPanel(state, 'CBC', 'Inflammatory profile', this.t(state.config.language, 'Leukocytosis تدعم التهاباً حاداً.', 'Leukocytosis supports acute inflammation.'), [{
            id: 'cbc',
            label: 'CBC',
            items: [this.labValue('WBC', '14.8', 'x10^9/L', '4.0-11.0', 'high'), this.labValue('Hb', '13.8', 'g/dL', '12-16')]
          }])
        : (target === 'bmp' || target === 'cmp')
          ? this.labPanel(state, 'BMP', 'Chemistry', this.t(state.config.language, 'لا يوجد اضطراب استقلابي مهم حالياً.', 'There is no major metabolic derangement at present.'), [{
              id: 'bmp',
              label: 'BMP',
              items: [this.labValue('Na', '137', 'mmol/L', '135-145'), this.labValue('Creatinine', '0.8', 'mg/dL', '0.6-1.3')]
            }])
          : target === 'ct-abdomen'
            ? this.imagingResult(state, 'CT Abdomen', 'ct', 'CT Abdomen/Pelvis', this.t(state.config.language, 'تظهر زائدة متوسعة مع periappendiceal fat stranding.', 'Shows an enlarged appendix with periappendiceal fat stranding.'), [
                this.t(state.config.language, 'Appendix dilated.', 'Dilated appendix.'),
                this.t(state.config.language, 'Periappendiceal fat stranding.', 'Periappendiceal fat stranding.')
              ], this.t(state.config.language, 'CT يدعم بقوة acute appendicitis.', 'CT strongly supports acute appendicitis.'), [
                this.t(state.config.language, 'RLQ inflamed appendix', 'Inflamed appendix in RLQ')
              ])
            : null,
      applyTreatment: (target, state) => {
        switch (target) {
          case 'iv-access':
            return this.basicPersistentTreatment(state, 'iv-access', 'IV access', this.t(state.config.language, 'IV access secured.', 'IV access secured.'), 'access', 'medium', {}, this.t(state.config.language, 'تم فتح خط وريدي.', 'IV access established.'));
          case 'iv-fluids':
            return this.basicPersistentTreatment(state, 'iv-fluids', 'Maintenance / resuscitation fluids', this.t(state.config.language, 'IV fluids running.', 'IV fluids running.'), 'fluids', 'medium', { perfusion: -8 }, this.t(state.config.language, 'بدأت السوائل الوريدية.', 'IV fluids started.'));
          case 'analgesia':
            this.applyDelta(state, { pain: -18 });
            return { applied: true, message: this.t(state.config.language, 'تمت السيطرة على الألم بشكل مناسب دون إخفاء المنطق السريري.', 'Analgesia was provided appropriately without obscuring the clinical picture.'), immediateEffects: [] };
          case 'surgical-consult':
            this.applyDelta(state, { infection: -4 });
            return { applied: true, message: this.t(state.config.language, 'تم إبلاغ الجراحة/تصعيد الحالة للمراجعة.', 'Surgery has been consulted / the case has been escalated for review.'), immediateEffects: [this.t(state.config.language, 'المسار الجراحي أصبح منطقياً.', 'The case is now on a defensible surgical path.')] };
          case 'reassess':
            this.applyDelta(state, { pain: -4 });
            return { applied: true, message: this.t(state.config.language, 'إعادة التقييم: الألم ما زال موضعياً في RLQ رغم بعض التحسن العرضي.', 'Reassessment: the pain remains localized to the RLQ despite some symptomatic relief.'), immediateEffects: [] };
          default:
            return this.genericNeutralTreatment(state, target);
        }
      },
      buildDifferentials: (state) => this.basicDifferentials(state, [
        ['Acute appendicitis', 'high', 'Migratory pain, anorexia, RLQ tenderness, and inflammatory markers fit well.'],
        ['Gastroenteritis', 'medium', 'Abdominal pain and nausea overlap, but localized RLQ findings are less typical.'],
        ['Ovarian / pelvic pathology', 'low', 'Important in the right context, especially in females.']
      ]),
      buildIdealPlan: (language) => [
        this.t(language, 'خذ history موجهاً وحدد migration/anorexia/fever.', 'Take a focused history and clarify pain migration, anorexia, and fever.'),
        this.t(language, 'افحص البطن بحثاً عن localized tenderness/peritonism.', 'Examine the abdomen for localized tenderness and peritoneal signs.'),
        this.t(language, 'اطلب CBC وimaging مناسباً حسب السياق.', 'Request CBC and appropriate imaging based on context.'),
        this.t(language, 'نسّق مع الجراحة بعد stabilizing basics.', 'Coordinate with surgery after stabilizing the basics.')
      ],
      buildOutcomeNarrative: (state) => state.diagnosticHypotheses.some((item) => item.primary)
        ? this.t(state.config.language, 'وصلت الحالة إلى مسار جراحي منطقي مع تقييم مناسب.', 'The case moved into a defensible surgical pathway with appropriate assessment.')
        : this.t(state.config.language, 'بقي التشخيص الجراحي غير واضح أو تأخر referral المناسب.', 'The surgical diagnosis remained unclear or referral was delayed.')
    };
  }
  private buildPostpartumHemorrhageDefinition(): ClinicalCaseDefinition {
    return {
      id: 'postpartum-hemorrhage',
      aliases: ['postpartum hemorrhage', 'pph', 'نزف ما بعد الولادة', 'نزيف بعد الولادة'],
      titles: { ar: 'نزف ما بعد الولادة', en: 'Postpartum Hemorrhage' },
      overview: { ar: 'نزف ولادي حاد مع هبوط ضغط وحاجة لإنقاذ سريع.', en: 'An acute postpartum hemorrhage with hemorrhagic shock risk.' },
      ageRange: [19, 39] as const,
      gender: 'female',
      basePhysiology: { bleeding: 84, perfusion: 72, pain: 20 },
      deteriorationPerTick: { bleeding: 1.6, perfusion: 1.8 },
      targetInvestigations: ['cbc', 'bmp', 'abg', 'pelvic-ultrasound'],
      targetTreatments: ['monitor', 'oxygen', 'iv-access', 'iv-fluids', 'oxytocin', 'transfusion', 'reassess'],
      expectations: {
        keyHistory: ['pregnancy', 'onset', 'context'],
        keyExams: ['general', 'vitals', 'circulation', 'pelvis'],
        keyInvestigations: ['cbc'],
        keyTreatments: ['monitor', 'iv-access', 'iv-fluids', 'oxytocin', 'transfusion', 'reassess'],
        harmfulActions: [],
        diagnosticKeywords: ['postpartum hemorrhage', 'pph', 'uterine atony'],
        differentialList: ['Postpartum hemorrhage', 'Retained products', 'Birth canal trauma']
      },
      generatePatientChart: (context) => this.buildChart(context, {
        chiefComplaint: this.t(context.language, 'نزف غزير بعد الولادة مع دوخة.', 'Heavy postpartum bleeding with dizziness.'),
        triageNote: this.t(context.language, 'الأم شاحبة ومتسرعة القلب بعد ولادة حديثة.', 'The mother is pale and tachycardic after a recent delivery.'),
        hpi: [
          this.t(context.language, 'حدث النزف خلال وقت قصير بعد الولادة.', 'Bleeding started shortly after delivery.'),
          this.t(context.language, 'هناك امتلاء فوط متكرر وشعور بالدوخة.', 'Pads are soaking rapidly and the patient feels faint.')
        ],
        pmh: [this.t(context.language, 'ولادة حديثة - راقبي uterine tone والنزف.', 'Recent delivery - focus on uterine tone and blood loss.')],
        meds: [],
        allergies: [this.t(context.language, 'لا حساسية دوائية موثقة', 'No documented drug allergies')],
        social: [this.t(context.language, 'العائلة موجودة والولادة كانت قبل فترة قصيرة.', 'Family is present and the delivery was recent.')],
        risks: ['Hemorrhagic shock', 'Uterine atony', 'Need for massive resuscitation']
      }),
      initialHighlightedExams: (context) => [
        this.examSection('pelvis', context, 'الولادة / Obstetric', this.t(context.language, 'نزف مهبلي غزير بعد الولادة.', 'Heavy vaginal bleeding after delivery.'), [
          this.t(context.language, 'الرحم مترهل نسبياً.', 'The uterus feels boggy.'),
          this.t(context.language, 'هناك ongoing blood loss.', 'There is ongoing visible blood loss.')
        ], 'baseline')
      ],
      resolveVitals: (state) => ({
        heartRate: this.round(104 + (state.physiology.bleeding * 0.24)),
        respiratoryRate: this.round(20 + (state.physiology.perfusion * 0.12)),
        bloodPressureSystolic: this.round(118 - (state.physiology.perfusion * 0.42)),
        bloodPressureDiastolic: this.round(70 - (state.physiology.perfusion * 0.18)),
        oxygenSaturation: this.round(97 - (state.physiology.perfusion * 0.08)),
        temperatureCelsius: 36.7,
        mentalStatus: state.physiology.perfusion >= 74 ? this.t(state.config.language, 'دوخة / ضعف', 'Dizzy / weak') : this.t(state.config.language, 'أوضح قليلاً', 'Slightly clearer')
      }),
      resolveSeverity: (state) => state.physiology.bleeding >= 84 || state.physiology.perfusion >= 80 ? 'critical'
        : state.physiology.bleeding >= 62 ? 'unstable'
          : state.physiology.bleeding >= 38 ? 'concerning'
            : 'stable',
      nextPrompt: (state) => this.t(state.config.language, 'الحالة الآن PPH حتى يثبت العكس. ما خطواتك العاجلة للسيطرة على النزف وإنقاذ الدورة الدموية؟', 'Treat this as postpartum hemorrhage until proven otherwise. What are your immediate steps to control bleeding and stabilize circulation?'),
      openingNarrative: (context) => this.t(
        context.language,
        `أنت في ${context.lens.displayName.ar}. المريضة ${context.patientName} بعد ولادة حديثة والآن لديها نزف واضح وتسرع قلب ودوخة.`,
        `You are in ${context.lens.displayName.en}. ${context.patientName} is post-delivery and now has obvious bleeding, tachycardia, and dizziness.`
      ),
      historyResponse: (_target, state) => this.t(state.config.language, 'المريضة postpartum حديثاً والنزف غزير ومتواصل.', 'The patient is recently postpartum with heavy ongoing bleeding.'),
      examResponse: (target, state) => (target === 'pelvis' || target === 'circulation')
        ? {
            id: target,
            label: this.t(state.config.language, 'Obstetric Exam', 'Obstetric Exam'),
            summary: this.t(state.config.language, 'نزف ولادي غزير مع رحم مترهل.', 'Heavy postpartum bleeding with a boggy uterus.'),
            findings: [this.t(state.config.language, 'Visible ongoing blood loss.', 'Visible ongoing blood loss.'), this.t(state.config.language, 'Uterine tone poor.', 'Poor uterine tone.')],
            status: 'critical'
          }
        : null,
      investigationResult: (target, state) => target === 'cbc'
        ? this.labPanel(state, 'CBC', 'Hemorrhage workup', this.t(state.config.language, 'Hb منخفضة مع فقد دم واضح.', 'Hemoglobin is low in the context of active blood loss.'), [{
            id: 'cbc',
            label: 'CBC',
            items: [
              this.labValue('Hb', '7.8', 'g/dL', '12-16', 'critical'),
              this.labValue('WBC', '14.0', 'x10^9/L', '4.0-11.0', 'high'),
              this.labValue('Platelets', '178', 'x10^9/L', '150-400')
            ]
          }], true)
        : (target === 'bmp' || target === 'cmp')
          ? this.labPanel(state, 'BMP', 'Chemistry', this.t(state.config.language, 'النتائج الكلوية قد تبدأ بالتأثر من نقص التروية.', 'Renal chemistry may begin reflecting hypoperfusion.'), [{
              id: 'bmp',
              label: 'BMP',
              items: [this.labValue('Creatinine', '1.2', 'mg/dL', '0.6-1.3'), this.labValue('Na', '135', 'mmol/L', '135-145')]
            }])
          : target === 'abg'
            ? this.abgResult(state, 'ABG', 'Hemorrhage severity', this.t(state.config.language, 'يوحي بنقص تروية/حماض أولي.', 'Suggests early hypoperfusion and acidosis.'), [
                this.labValue('pH', '7.31', '', '7.35-7.45', 'low'),
                this.labValue('Lactate surrogate', '3.8', 'mmol/L', '0.5-2.0', 'high')
              ], this.t(state.config.language, 'Early shock physiology is present.', 'Early shock physiology is present.'))
            : target === 'pelvic-ultrasound'
              ? this.imagingResult(state, 'Pelvic Ultrasound', 'ultrasound', 'Pelvic / uterine ultrasound', this.t(state.config.language, 'قد تُظهر بقايا أو تجمّعاً رحمياً حسب السياق، لكن العلاج العاجل لا ينتظر.', 'May suggest retained products depending on the context, but urgent management should not wait.'), [
                  this.t(state.config.language, 'Uterine cavity findings need correlation.', 'Uterine cavity findings need correlation.')
                ], this.t(state.config.language, 'Imaging may help define cause, but hemorrhage control remains the immediate priority.', 'Imaging may clarify cause, but bleeding control remains the immediate priority.'), [
                  this.t(state.config.language, 'Endometrial cavity', 'Endometrial cavity')
                ])
              : null,
      applyTreatment: (target, state) => {
        switch (target) {
          case 'monitor':
            return this.basicPersistentTreatment(state, 'monitor', 'Maternal monitoring', this.t(state.config.language, 'Continuous maternal monitoring active.', 'Continuous maternal monitoring active.'), 'monitoring', 'high', {}, this.t(state.config.language, 'المراقبة المستمرة فعالة.', 'Continuous monitoring is active.'));
          case 'oxygen':
            return this.basicPersistentTreatment(state, 'oxygen', 'Oxygen support', this.t(state.config.language, 'Oxygen running.', 'Oxygen running.'), 'oxygen', 'medium', { oxygenation: -4 }, this.t(state.config.language, 'تم بدء الأكسجين.', 'Oxygen support started.'));
          case 'iv-access':
            return this.basicPersistentTreatment(state, 'iv-access', 'Large-bore IV access', this.t(state.config.language, 'Large-bore IV access established.', 'Large-bore IV access established.'), 'access', 'high', {}, this.t(state.config.language, 'تم تأمين IV access واسع.', 'Large-bore IV access has been secured.'));
          case 'iv-fluids':
            return this.basicPersistentTreatment(state, 'iv-fluids', 'Fluid resuscitation', this.t(state.config.language, 'Rapid fluids running.', 'Rapid fluids running.'), 'fluids', 'high', { perfusion: -16 }, this.t(state.config.language, 'بدأت fluid resuscitation.', 'Fluid resuscitation has started.'));
          case 'oxytocin':
            this.applyDelta(state, { bleeding: -24 });
            return { applied: true, message: this.t(state.config.language, 'بدأ oxytocin لعلاج uterine atony المحتملة.', 'Oxytocin was started for likely uterine atony.'), immediateEffects: [this.t(state.config.language, 'النزف يبدو أقل قليلاً.', 'Bleeding appears slightly reduced.')] };
          case 'transfusion':
            this.applyDelta(state, { perfusion: -18, bleeding: -6 });
            return { applied: true, message: this.t(state.config.language, 'بدأ دعم الدم/التحضير له بسبب نزف مهم.', 'Blood product support has been started or arranged due to significant hemorrhage.'), immediateEffects: [] };
          case 'reassess':
            this.applyDelta(state, { perfusion: -8, bleeding: -8 });
            return { applied: true, message: this.t(state.config.language, 'إعادة التقييم: الضغط أفضل قليلاً لكن النزف ما زال يحتاج ضبطاً دقيقاً.', 'Reassessment: blood pressure is slightly better, but bleeding still needs close control.'), immediateEffects: [] };
          default:
            return this.genericNeutralTreatment(state, target);
        }
      },
      buildDifferentials: (state) => this.basicDifferentials(state, [
        ['Postpartum hemorrhage', 'high', 'Ongoing heavy postpartum bleeding with hemodynamic instability.'],
        ['Retained products', 'medium', 'Possible underlying cause if bleeding persists despite uterotonic support.'],
        ['Birth canal trauma', 'low', 'Still relevant when uterine tone does not explain all the bleeding.']
      ]),
      buildIdealPlan: (language) => [
        this.t(language, 'اعترفي بالحالة كـ hemorrhage emergency فوراً.', 'Recognize this immediately as a hemorrhage emergency.'),
        this.t(language, 'ابدئي monitor + IV access + fluid/blood support سريعاً.', 'Start monitoring, IV access, and rapid fluid / blood support.'),
        this.t(language, 'ابدئي uterotonic مثل oxytocin مع تقييم uterine tone.', 'Start a uterotonic such as oxytocin while assessing uterine tone.'),
        this.t(language, 'صعّدي مبكراً لفريق obstetrics إذا استمر النزف.', 'Escalate early to the obstetric team if bleeding continues.')
      ],
      buildOutcomeNarrative: (state) => state.severity === 'stable'
        ? this.t(state.config.language, 'بدأ النزف يهدأ وتحسنت التروية بعد resuscitation وعلاج سببي أولي.', 'Bleeding slowed and perfusion improved after resuscitation and initial cause-directed treatment.')
        : this.t(state.config.language, 'استمر النزف أو تأخر التحكم به، ما أبقى خطر shock مرتفعاً.', 'Bleeding continued or control was delayed, leaving ongoing shock risk.')
    };
  }
  private buildDkaDefinition(): ClinicalCaseDefinition {
    return {
      id: 'dka',
      aliases: ['dka', 'diabetic ketoacidosis', 'حماض كيتوني', 'ketoacidosis'],
      titles: { ar: 'الحماض الكيتوني السكري', en: 'Diabetic Ketoacidosis' },
      overview: { ar: 'Hyperglycemia + ketosis + acidosis مع dehydration.', en: 'Hyperglycemia, ketosis, acidosis, and dehydration.' },
      ageRange: [16, 46] as const,
      gender: 'any',
      basePhysiology: { metabolic: 86, perfusion: 46 },
      deteriorationPerTick: { metabolic: 1.3, perfusion: 0.8 },
      targetInvestigations: ['glucose', 'ketones', 'bmp', 'abg'],
      targetTreatments: ['monitor', 'iv-access', 'iv-fluids', 'insulin', 'reassess'],
      expectations: {
        keyHistory: ['onset', 'pmh', 'medications', 'associated-symptoms'],
        keyExams: ['general', 'vitals', 'breathing'],
        keyInvestigations: ['glucose', 'ketones', 'bmp', 'abg'],
        keyTreatments: ['iv-fluids', 'insulin', 'monitor', 'reassess'],
        harmfulActions: ['dextrose'],
        diagnosticKeywords: ['dka', 'diabetic ketoacidosis', 'ketoacidosis'],
        differentialList: ['DKA', 'Sepsis', 'Gastroenteritis']
      },
      generatePatientChart: (context) => this.buildChart(context, {
        chiefComplaint: this.t(context.language, 'عطش شديد، قيء، وتسرع تنفس.', 'Severe thirst, vomiting, and rapid breathing.'),
        triageNote: this.t(context.language, 'المريض جاف مع تنفس عميق سريع.', 'The patient looks dehydrated and breathes deeply and rapidly.'),
        hpi: [this.t(context.language, 'أيام من polyuria/polydipsia مع قيء ووهن.', 'Several days of polyuria/polydipsia with vomiting and weakness.')],
        pmh: [this.t(context.language, 'Type 1 diabetes أو diabetes على insulin.', 'Type 1 diabetes or insulin-treated diabetes.')],
        meds: ['Insulin'],
        allergies: [this.t(context.language, 'لا حساسية معروفة', 'No known allergies')],
        social: [this.t(context.language, 'الإدخال الغذائي ضعيف مؤخراً.', 'Recent oral intake has been poor.')],
        risks: ['Severe dehydration', 'Acidosis', 'Electrolyte derangement']
      }),
      initialHighlightedExams: (context) => [
        this.examSection('breathing', context, 'التنفس / Breathing', this.t(context.language, 'تنفس Kussmaul نسبي.', 'Relative Kussmaul-type breathing.'), [
          this.t(context.language, 'جفاف واضح.', 'Obvious dehydration.'),
          this.t(context.language, 'رائحة كيتونية محتملة.', 'Possible ketotic breath odor.')
        ], 'baseline')
      ],
      resolveVitals: (state) => ({
        heartRate: this.round(100 + (state.physiology.metabolic * 0.18)),
        respiratoryRate: this.round(24 + (state.physiology.metabolic * 0.14)),
        bloodPressureSystolic: this.round(112 - (state.physiology.perfusion * 0.22)),
        bloodPressureDiastolic: this.round(68 - (state.physiology.perfusion * 0.08)),
        oxygenSaturation: 98,
        temperatureCelsius: 36.9,
        mentalStatus: state.physiology.metabolic >= 80 ? this.t(state.config.language, 'مرهق / بطيء', 'Tired / slowed') : this.t(state.config.language, 'أوضح من البداية', 'Clearer than baseline')
      }),
      resolveSeverity: (state) => state.physiology.metabolic >= 86 ? 'critical'
        : state.physiology.metabolic >= 62 ? 'unstable'
          : state.physiology.metabolic >= 40 ? 'concerning'
            : 'stable',
      nextPrompt: (state) => this.t(state.config.language, 'افترض DKA إلى أن تستبعده: ما الفحوصات السريعة والعلاج الأولي الآن؟', 'Assume DKA until you exclude it: what immediate tests and initial treatment do you need now?'),
      openingNarrative: (context) => this.t(context.language, `${context.patientName} وصل بتجفاف، قيء، وتسرع تنفس. نمط الحالة يوحي بمشكلة metabolic خطيرة.`, `${context.patientName} presents with dehydration, vomiting, and tachypnea. The pattern suggests a serious metabolic emergency.`),
      historyResponse: (_target, state) => this.t(state.config.language, 'القصة تدعم DKA بقوة مع missed insulin أو trigger محتمل.', 'The history strongly supports DKA with missed insulin or a trigger.'),
      examResponse: (target, state) => (target === 'breathing' || target === 'general')
        ? {
            id: target,
            label: this.t(state.config.language, 'General / Breathing', 'General / Breathing'),
            summary: this.t(state.config.language, 'تجفاف مع Kussmaul-like breathing.', 'Dehydration with Kussmaul-like breathing.'),
            findings: [this.t(state.config.language, 'Mucous membranes dry.', 'Dry mucous membranes.'), this.t(state.config.language, 'Deep rapid breathing.', 'Deep rapid breathing.')],
            status: 'requested'
          }
        : null,
      investigationResult: (target, state) => target === 'glucose'
        ? this.labPanel(state, 'Glucose', 'Capillary / serum glucose', this.t(state.config.language, 'Hyperglycemia شديدة.', 'Severe hyperglycemia is present.'), [{
            id: 'glucose',
            label: 'Glucose',
            items: [this.labValue('Glucose', '462', 'mg/dL', '70-140', 'critical')]
          }], true)
        : target === 'ketones'
          ? this.labPanel(state, 'Ketones', 'Ketone assessment', this.t(state.config.language, 'Ketones إيجابية بوضوح.', 'Ketones are clearly positive.'), [{
              id: 'ketones',
              label: 'Ketones',
              items: [this.labValue('Serum ketones', 'Positive ++', '', '', 'critical')]
            }], true)
          : (target === 'bmp' || target === 'cmp')
            ? this.labPanel(state, 'BMP', 'Electrolytes', this.t(state.config.language, 'يوجد bicarbonate منخفض واضطراب كيميائي متوقع في DKA.', 'There is low bicarbonate and the expected chemistry derangement of DKA.'), [{
                id: 'bmp',
                label: 'BMP',
                items: [
                  this.labValue('Na', '130', 'mmol/L', '135-145', 'low'),
                  this.labValue('K', '5.3', 'mmol/L', '3.5-5.1', 'high'),
                  this.labValue('HCO3-', '12', 'mmol/L', '22-26', 'critical')
                ]
              }], true)
            : target === 'abg'
              ? this.abgResult(state, 'ABG', 'Acid-base status', this.t(state.config.language, 'يوجد metabolic acidosis واضح.', 'There is clear metabolic acidosis.'), [
                  this.labValue('pH', '7.18', '', '7.35-7.45', 'critical'),
                  this.labValue('PaCO2', '24', 'mmHg', '35-45', 'low'),
                  this.labValue('HCO3-', '10', 'mmol/L', '22-26', 'critical')
                ], this.t(state.config.language, 'High-anion-gap metabolic acidosis compatible with DKA.', 'High-anion-gap metabolic acidosis compatible with DKA.'))
              : null,
      applyTreatment: (target, state) => {
        switch (target) {
          case 'monitor':
            return this.basicPersistentTreatment(state, 'monitor', 'Metabolic monitoring', this.t(state.config.language, 'Cardiorespiratory monitoring active.', 'Cardiorespiratory monitoring active.'), 'monitoring', 'medium', {}, this.t(state.config.language, 'بدأت المراقبة.', 'Monitoring has started.'));
          case 'iv-access':
            return this.basicPersistentTreatment(state, 'iv-access', 'IV access', this.t(state.config.language, 'IV line inserted.', 'IV line inserted.'), 'access', 'medium', {}, this.t(state.config.language, 'تم فتح IV.', 'IV access secured.'));
          case 'iv-fluids':
            return this.basicPersistentTreatment(state, 'iv-fluids', 'Fluid resuscitation', this.t(state.config.language, 'Fluids are running.', 'Fluids are running.'), 'fluids', 'high', { metabolic: -12, perfusion: -14 }, this.t(state.config.language, 'بدأت السوائل الوريدية.', 'IV fluids have started.'));
          case 'insulin':
            this.applyDelta(state, { metabolic: -18 });
            return { applied: true, message: this.t(state.config.language, 'بدأ insulin ضمن خطة علاج DKA بعد تقييم مناسب.', 'Insulin therapy has been started within a DKA treatment plan.'), immediateEffects: [] };
          case 'dextrose':
            return this.harmfulTreatment(state, 'إعطاء dextrose الآن ليس منطقياً في DKA قبل الحاجة إليه ضمن البروتوكول.', 'Giving dextrose now is not appropriate in DKA before it is indicated in protocol-driven management.', { metabolic: 6 });
          case 'reassess':
            this.applyDelta(state, { metabolic: -6, perfusion: -4 });
            return { applied: true, message: this.t(state.config.language, 'إعادة التقييم: التنفس العميق والجفاف أفضل قليلاً من البداية.', 'Reassessment: the deep breathing and dehydration are slightly better than at baseline.'), immediateEffects: [] };
          default:
            return this.genericNeutralTreatment(state, target);
        }
      },
      buildDifferentials: (state) => this.basicDifferentials(state, [
        ['DKA', 'high', 'Hyperglycemia with ketones, acidosis, and dehydration would confirm it.'],
        ['Sepsis', 'medium', 'Could be the trigger or a competing diagnosis.'],
        ['Gastroenteritis', 'low', 'Vomiting overlaps but does not explain the metabolic pattern.']
      ]),
      buildIdealPlan: (language) => [
        this.t(language, 'اطلب glucose/ketones/BMP/ABG مبكراً.', 'Request glucose, ketones, BMP, and ABG early.'),
        this.t(language, 'ابدأ IV fluids كخطوة أولى أساسية.', 'Begin IV fluids as the first essential step.'),
        this.t(language, 'بعد التأكد من الخطة المناسبة، ابدأ insulin therapy مع مراقبة لصيقة.', 'Start insulin therapy with close monitoring once the management plan is in place.'),
        this.t(language, 'أعد التقييم سريرياً ومخبرياً بشكل متكرر.', 'Reassess both clinically and biochemically at frequent intervals.')
      ],
      buildOutcomeNarrative: (state) => state.severity === 'stable'
        ? this.t(state.config.language, 'انخفضت شدة الاضطراب الاستقلابي بعد fluids والنهج الصحيح.', 'Metabolic derangement eased after fluids and the correct treatment pathway.')
        : this.t(state.config.language, 'بقي الاضطراب الاستقلابي فعّالاً بسبب تأخر التشخيص أو العلاج.', 'Metabolic instability remained active because diagnosis or treatment was delayed.')
    };
  }

  private buildPneumoniaDefinition(): ClinicalCaseDefinition {
    return {
      id: 'pneumonia',
      aliases: ['pneumonia', 'التهاب رئوي', 'community acquired pneumonia', 'صدرية'],
      titles: { ar: 'التهاب رئوي', en: 'Pneumonia' },
      overview: { ar: 'عدوى رئوية مع حرارة وتسرع نفس ونقص أكسجة بدرجات متفاوتة.', en: 'A pulmonary infection with fever, tachypnea, and variable hypoxemia.' },
      ageRange: [22, 84] as const,
      gender: 'any',
      basePhysiology: { infection: 70, oxygenation: 44 },
      deteriorationPerTick: { infection: 0.9, oxygenation: 1 },
      targetInvestigations: ['cbc', 'chest-xray', 'abg'],
      targetTreatments: ['oxygen', 'monitor', 'iv-access', 'antibiotics', 'reassess'],
      expectations: {
        keyHistory: ['onset', 'associated-symptoms', 'pmh'],
        keyExams: ['general', 'breathing', 'chest', 'vitals'],
        keyInvestigations: ['cbc', 'chest-xray'],
        keyTreatments: ['oxygen', 'antibiotics', 'monitor', 'reassess'],
        harmfulActions: [],
        diagnosticKeywords: ['pneumonia', 'community acquired pneumonia'],
        differentialList: ['Pneumonia', 'COPD exacerbation', 'Pulmonary edema']
      },
      generatePatientChart: (context) => this.buildChart(context, {
        chiefComplaint: this.t(context.language, 'حمى وسعال وضيق نفس.', 'Fever, cough, and shortness of breath.'),
        triageNote: this.t(context.language, 'المريض يبدو مريضاً مع سعال منتج وحرارة.', 'The patient looks unwell with productive cough and fever.'),
        hpi: [
          this.t(context.language, 'أعراض تنفسية ازدادت خلال أيام.', 'Respiratory symptoms have progressed over several days.'),
          this.t(context.language, 'يوجد بلغم وألم صدري pleuritic أحياناً.', 'There is sputum production and possible pleuritic chest pain.')
        ],
        pmh: [],
        meds: [],
        allergies: [this.t(context.language, 'لا حساسية موثقة', 'No documented allergies')],
        social: [this.t(context.language, 'قد تكون هناك عدوى مجتمعية أو احتكاك بمريض.', 'Possible community exposure to infection.')],
        risks: ['Respiratory compromise', 'Sepsis progression if untreated']
      }),
      initialHighlightedExams: (context) => [
        this.examSection('chest', context, 'الصدر / Chest', this.t(context.language, 'أصوات تنفس غير متساوية مع crackles بؤرية.', 'Asymmetric breath sounds with focal crackles.'), [
          this.t(context.language, 'Crackles قاعدية أو بؤرية.', 'Basal or focal crackles.'),
          this.t(context.language, 'السعال منتج.', 'The cough is productive.')
        ], 'baseline')
      ],
      resolveVitals: (state) => ({
        heartRate: this.round(96 + (state.physiology.infection * 0.14)),
        respiratoryRate: this.round(20 + (state.physiology.oxygenation * 0.12)),
        bloodPressureSystolic: this.round(124 - (state.physiology.perfusion * 0.14)),
        bloodPressureDiastolic: this.round(74 - (state.physiology.perfusion * 0.06)),
        oxygenSaturation: this.round(96 - (state.physiology.oxygenation * 0.14)),
        temperatureCelsius: Number((37.2 + (state.physiology.infection * 0.02)).toFixed(1)),
        mentalStatus: this.t(state.config.language, 'يقظ لكنه مجهد', 'Alert but fatigued')
      }),
      resolveSeverity: (state) => state.physiology.oxygenation >= 76 ? 'unstable'
        : state.physiology.infection >= 58 ? 'concerning'
          : 'stable',
      nextPrompt: (state) => this.t(state.config.language, 'افحص الصدر واطلب investigations مناسبة ثم ابدأ العلاج الموجه.', 'Examine the chest, obtain the appropriate investigations, and start targeted management.'),
      openingNarrative: (context) => this.t(context.language, `${context.patientName} جاء بحرارة وسعال وضيق نفس. تحتاج الحالة إلى تمييز عدوى رئوية من غيرها وبدء علاج مناسب.`, `${context.patientName} presents with fever, cough, and dyspnea. You need to distinguish pneumonia from other causes and begin appropriate care.`),
      historyResponse: (_target, state) => this.t(state.config.language, 'هناك سعال منتج وحرارة وتعب عام.', 'There is productive cough, fever, and systemic malaise.'),
      examResponse: (target, state) => (target === 'chest' || target === 'breathing')
        ? {
            id: target,
            label: this.t(state.config.language, 'Chest Exam', 'Chest Exam'),
            summary: this.t(state.config.language, 'Crackles بؤرية مع air entry غير متساوٍ.', 'Focal crackles with asymmetric air entry.'),
            findings: [this.t(state.config.language, 'Bronchial breathing over affected zone.', 'Bronchial breath sounds over the affected zone.')],
            status: 'requested'
          }
        : null,
      investigationResult: (target, state) => target === 'cbc'
        ? this.labPanel(state, 'CBC', 'Infection workup', this.t(state.config.language, 'Leukocytosis تدعم عدوى بكتيرية.', 'Leukocytosis supports bacterial infection.'), [{
            id: 'cbc',
            label: 'CBC',
            items: [this.labValue('WBC', '16.1', 'x10^9/L', '4.0-11.0', 'high'), this.labValue('Hb', '13.1', 'g/dL', '12-16')]
          }])
        : target === 'chest-xray'
          ? this.imagingResult(state, 'Chest X-ray', 'xray', 'Chest X-ray', this.t(state.config.language, 'توجد كثافة/ارتشاح يتوافق مع pneumonia.', 'There is focal opacity consistent with pneumonia.'), [
              this.t(state.config.language, 'Right lower lobe consolidation.', 'Right lower lobe consolidation.')
            ], this.t(state.config.language, 'Imaging is consistent with pneumonia.', 'Imaging is consistent with pneumonia.'), [
              this.t(state.config.language, 'Lower lobe opacity', 'Lower lobe opacity')
            ])
          : target === 'abg'
            ? this.abgResult(state, 'ABG', 'Respiratory severity', this.t(state.config.language, 'Hypoxemia خفيفة إلى متوسطة.', 'Mild-to-moderate hypoxemia is present.'), [
                this.labValue('pH', '7.41', '', '7.35-7.45'),
                this.labValue('PaO2', '68', 'mmHg', '80-100', 'low')
              ], this.t(state.config.language, 'Hypoxemia in the context of a pulmonary infection.', 'Hypoxemia in the context of pulmonary infection.'))
            : null,
      applyTreatment: (target, state) => {
        switch (target) {
          case 'oxygen':
            return this.basicPersistentTreatment(state, 'oxygen', 'Oxygen support', this.t(state.config.language, 'Supplemental oxygen active.', 'Supplemental oxygen active.'), 'oxygen', 'medium', { oxygenation: -10 }, this.t(state.config.language, 'تم بدء الأكسجين.', 'Oxygen support started.'));
          case 'monitor':
            return this.basicPersistentTreatment(state, 'monitor', 'Monitoring', this.t(state.config.language, 'Continuous vital monitoring active.', 'Continuous vital monitoring active.'), 'monitoring', 'medium', {}, this.t(state.config.language, 'المراقبة فعالة.', 'Monitoring is active.'));
          case 'iv-access':
            return this.basicPersistentTreatment(state, 'iv-access', 'IV access', this.t(state.config.language, 'IV access established.', 'IV access established.'), 'access', 'low', {}, this.t(state.config.language, 'تم فتح خط وريدي.', 'IV access established.'));
          case 'antibiotics':
            this.applyDelta(state, { infection: -16 });
            return { applied: true, message: this.t(state.config.language, 'بدأ antibiotic therapy الموجه للحالة.', 'Antibiotic therapy appropriate to the case has been started.'), immediateEffects: [] };
          case 'reassess':
            this.applyDelta(state, { infection: -4, oxygenation: -4 });
            return { applied: true, message: this.t(state.config.language, 'إعادة التقييم: الحرارة والضيق ما زالا موجودين لكن المسار أصبح أكثر ضبطاً.', 'Reassessment: fever and dyspnea remain, but the case is more controlled than before.'), immediateEffects: [] };
          default:
            return this.genericNeutralTreatment(state, target);
        }
      },
      buildDifferentials: (state) => this.basicDifferentials(state, [
        ['Pneumonia', 'high', 'Fever, cough, crackles, and imaging findings fit a pulmonary infection.'],
        ['COPD exacerbation', 'medium', 'Possible overlap if wheeze dominates.'],
        ['Pulmonary edema', 'low', 'Would need stronger cardiac or volume-overload evidence.']
      ]),
      buildIdealPlan: (language) => [
        this.t(language, 'خذ history تنفسي موجهاً وافحص الصدر.', 'Take a focused respiratory history and examine the chest.'),
        this.t(language, 'اطلب CBC وChest X-ray.', 'Request CBC and a chest X-ray.'),
        this.t(language, 'ادعم oxygenation عند الحاجة وابدأ antibiotics المناسبة.', 'Support oxygenation as needed and start appropriate antibiotics.'),
        this.t(language, 'أعد التقييم سريرياً بعد العلاج الأولي.', 'Reassess clinically after initial treatment.')
      ],
      buildOutcomeNarrative: (state) => state.severity === 'stable'
        ? this.t(state.config.language, 'بدا المسار متجهاً نحو استقرار تدريجي بعد التعرف على pneumonia وعلاجها.', 'The course began moving toward stability after pneumonia was recognized and treated.')
        : this.t(state.config.language, 'بقيت العدوى الرئوية تؤثر في التنفس أو لم تُعالج مبكراً بما يكفي.', 'The pulmonary infection continued to compromise breathing or was not treated early enough.')
    };
  }
  private buildGiBleedDefinition(): ClinicalCaseDefinition {
    return {
      id: 'gi-bleed',
      aliases: ['gi bleed', 'gastrointestinal bleed', 'hematemesis', 'ميلينا', 'نزف هضمي'],
      titles: { ar: 'نزف هضمي', en: 'GI Bleed' },
      overview: { ar: 'نزف هضمي مع هبوط Hb وعلامات نقص حجم.', en: 'A gastrointestinal bleed with volume loss and falling hemoglobin.' },
      ageRange: [30, 82] as const,
      gender: 'any',
      basePhysiology: { bleeding: 70, perfusion: 58 },
      deteriorationPerTick: { bleeding: 1.1, perfusion: 1.2 },
      targetInvestigations: ['cbc', 'bmp', 'abg'],
      targetTreatments: ['monitor', 'iv-access', 'iv-fluids', 'transfusion', 'reassess'],
      expectations: {
        keyHistory: ['onset', 'associated-symptoms', 'medications', 'pmh'],
        keyExams: ['general', 'circulation', 'abdomen', 'vitals'],
        keyInvestigations: ['cbc', 'bmp'],
        keyTreatments: ['monitor', 'iv-access', 'iv-fluids', 'transfusion', 'reassess'],
        harmfulActions: [],
        diagnosticKeywords: ['gi bleed', 'gastrointestinal bleed', 'upper gi bleed', 'melena', 'hematemesis'],
        differentialList: ['GI bleed', 'Variceal bleed', 'Peptic ulcer bleed']
      },
      generatePatientChart: (context) => this.buildChart(context, {
        chiefComplaint: this.t(context.language, 'قيء دموي أو ميلينا مع دوخة.', 'Hematemesis or melena with dizziness.'),
        triageNote: this.t(context.language, 'المريض شاحب ومرهق مع علامات نقص حجم.', 'The patient is pale and exhausted with signs of volume loss.'),
        hpi: [
          this.t(context.language, 'هناك نزف هضمي ظاهر أو براز أسود مع ضعف.', 'There is overt GI bleeding or black stool with weakness.'),
          this.t(context.language, 'تفاقمت الدوخة مع الوقوف.', 'Dizziness worsens on standing.')
        ],
        pmh: [],
        meds: [this.t(context.language, 'اسأل عن NSAIDs أو anticoagulants.', 'Ask about NSAIDs or anticoagulants.')],
        allergies: [this.t(context.language, 'غير معروفة حالياً', 'Currently unknown')],
        social: [this.t(context.language, 'قد يكون هناك استعمال مسكنات أو تاريخ قرحة.', 'There may be analgesic use or ulcer history.')],
        risks: ['Hypovolemia', 'Anemia', 'Shock if untreated']
      }),
      initialHighlightedExams: (context) => [
        this.examSection('circulation', context, 'الدورة الدموية / Circulation', this.t(context.language, 'المريض شاحب مع pulse سريع.', 'The patient is pale with a rapid pulse.'), [
          this.t(context.language, 'Orthostatic symptoms.', 'Orthostatic symptoms.'),
          this.t(context.language, 'برودة أطراف خفيفة.', 'Mild cool extremities.')
        ], 'baseline')
      ],
      resolveVitals: (state) => ({
        heartRate: this.round(98 + (state.physiology.bleeding * 0.18)),
        respiratoryRate: this.round(18 + (state.physiology.perfusion * 0.08)),
        bloodPressureSystolic: this.round(118 - (state.physiology.perfusion * 0.28)),
        bloodPressureDiastolic: this.round(70 - (state.physiology.perfusion * 0.12)),
        oxygenSaturation: 98,
        temperatureCelsius: 36.7,
        mentalStatus: state.physiology.perfusion >= 70 ? this.t(state.config.language, 'دوخة / وهن', 'Dizzy / weak') : this.t(state.config.language, 'أكثر استقراراً', 'More stable')
      }),
      resolveSeverity: (state) => state.physiology.bleeding >= 78 || state.physiology.perfusion >= 74 ? 'unstable'
        : state.physiology.bleeding >= 46 ? 'concerning'
          : 'stable',
      nextPrompt: (state) => this.t(state.config.language, 'ما تقييمك لنقص الحجم وما خطتك لدعم الدورة الدموية وطلب الفحوصات المناسبة؟', 'How do you assess the volume loss, and what is your plan for hemodynamic support and appropriate investigations?'),
      openingNarrative: (context) => this.t(context.language, `${context.patientName} حضر بشكوى نزف هضمي ودوخة. المطلوب الآن حماية الدورة الدموية والتعرّف على شدة النزف.`, `${context.patientName} presents with gastrointestinal bleeding and dizziness. Your immediate task is to protect circulation and define the severity of the bleed.`),
      historyResponse: (_target, state) => this.t(state.config.language, 'القصة تشير إلى نزف هضمي مع نقص حجم، وقد يكون هناك استعمال NSAIDs أو مميعات.', 'The history points to GI bleeding with volume loss, possibly with NSAID or anticoagulant exposure.'),
      examResponse: (target, state) => (target === 'circulation' || target === 'general')
        ? {
            id: target,
            label: this.t(state.config.language, 'General / Circulation', 'General / Circulation'),
            summary: this.t(state.config.language, 'شحوب، دوخة، وتسرع قلب.', 'Pallor, dizziness, and tachycardia.'),
            findings: [this.t(state.config.language, 'Orthostatic tendency.', 'Orthostatic tendency.')],
            status: 'requested'
          }
        : null,
      investigationResult: (target, state) => target === 'cbc'
        ? this.labPanel(state, 'CBC', 'Bleeding profile', this.t(state.config.language, 'Hb منخفضة بما يتوافق مع النزف.', 'Hemoglobin is low in a pattern consistent with bleeding.'), [{
            id: 'cbc',
            label: 'CBC',
            items: [this.labValue('Hb', '8.1', 'g/dL', '12-16', 'critical'), this.labValue('WBC', '11.4', 'x10^9/L', '4.0-11.0', 'high')]
          }], true)
        : (target === 'bmp' || target === 'cmp')
          ? this.labPanel(state, 'BMP', 'Chemistry', this.t(state.config.language, 'هناك mild prerenal pattern محتمل.', 'There is a possible mild pre-renal pattern.'), [{
              id: 'bmp',
              label: 'BMP',
              items: [this.labValue('BUN', '34', 'mg/dL', '7-20', 'high'), this.labValue('Creatinine', '1.3', 'mg/dL', '0.6-1.3')]
            }])
          : target === 'abg'
            ? this.abgResult(state, 'ABG', 'Shock trend', this.t(state.config.language, 'هناك mild metabolic effect from hypoperfusion.', 'There is a mild metabolic effect from hypoperfusion.'), [
                this.labValue('pH', '7.33', '', '7.35-7.45', 'low'),
                this.labValue('Lactate surrogate', '3.1', 'mmol/L', '0.5-2.0', 'high')
              ], this.t(state.config.language, 'Early hypovolemic physiology is present.', 'Early hypovolemic physiology is present.'))
            : null,
      applyTreatment: (target, state) => {
        switch (target) {
          case 'monitor':
            return this.basicPersistentTreatment(state, 'monitor', 'Hemodynamic monitoring', this.t(state.config.language, 'Continuous monitoring active.', 'Continuous monitoring active.'), 'monitoring', 'medium', {}, this.t(state.config.language, 'المراقبة فعالة.', 'Monitoring active.'));
          case 'iv-access':
            return this.basicPersistentTreatment(state, 'iv-access', 'Large-bore IV access', this.t(state.config.language, 'Large-bore access secured.', 'Large-bore access secured.'), 'access', 'high', {}, this.t(state.config.language, 'تم تأمين IV access واسع.', 'Large-bore IV access secured.'));
          case 'iv-fluids':
            return this.basicPersistentTreatment(state, 'iv-fluids', 'Fluid bolus', this.t(state.config.language, 'Fluids running.', 'Fluids running.'), 'fluids', 'high', { perfusion: -16 }, this.t(state.config.language, 'بدأت fluids لدعم الدورة.', 'Fluids started to support circulation.'));
          case 'transfusion':
            this.applyDelta(state, { perfusion: -18, bleeding: -8 });
            return { applied: true, message: this.t(state.config.language, 'تم البدء بدعم الدم/التحضير له بسبب Hb منخفضة ونقص حجم.', 'Blood support has been initiated or arranged because of low hemoglobin and volume loss.'), immediateEffects: [] };
          case 'reassess':
            this.applyDelta(state, { perfusion: -6 });
            return { applied: true, message: this.t(state.config.language, 'إعادة التقييم تُظهر تحسن الضغط نسبياً لكن النزف يحتاج متابعة.', 'Reassessment shows relative improvement in blood pressure, but the bleeding still requires follow-up.'), immediateEffects: [] };
          default:
            return this.genericNeutralTreatment(state, target);
        }
      },
      buildDifferentials: (state) => this.basicDifferentials(state, [
        ['GI bleed', 'high', 'Visible bleeding / melena with hemodynamic change supports it strongly.'],
        ['Variceal bleed', 'medium', 'Consider depending on liver history.'],
        ['Peptic ulcer bleed', 'medium', 'A common cause, especially with NSAID exposure.']
      ]),
      buildIdealPlan: (language) => [
        this.t(language, 'ابدأ monitor + IV access واسع.', 'Start monitoring and obtain large-bore IV access.'),
        this.t(language, 'قيّم ABCs ونقص الحجم ثم ابدأ fluid support.', 'Assess ABCs and volume loss, then begin fluid support.'),
        this.t(language, 'اطلب CBC/BMP ونسّق لاحقاً مع الفريق المناسب للنزف.', 'Request CBC/BMP and coordinate further bleeding management with the relevant team.'),
        this.t(language, 'فكّر في transfusion إذا دلّت الحالة على نزف مهم.', 'Consider transfusion when the pattern suggests significant blood loss.')
      ],
      buildOutcomeNarrative: (state) => state.severity === 'stable'
        ? this.t(state.config.language, 'تحسنت الدورة الدموية بعد دعم مناسب وتحديد شدة النزف.', 'Circulation improved after appropriate support and better definition of bleed severity.')
        : this.t(state.config.language, 'بقي النزف أو أثره على الدورة الدموية قائماً بشكل مقلق.', 'The bleed or its hemodynamic impact remained concerning.')
    };
  }

  private buildStrokeDefinition(): ClinicalCaseDefinition {
    return {
      id: 'stroke',
      aliases: ['stroke', 'cva', 'neurologic deficit', 'سكتة', 'جلطة دماغية'],
      titles: { ar: 'سكتة دماغية', en: 'Stroke' },
      overview: { ar: 'عجز عصبي بؤري حاد يحتاج recognition وتصعيد سريع.', en: 'An acute focal neurologic deficit requiring rapid recognition and escalation.' },
      ageRange: [38, 85] as const,
      gender: 'any',
      basePhysiology: { neurologic: 82, perfusion: 26 },
      deteriorationPerTick: { neurologic: 1.4 },
      targetInvestigations: ['glucose', 'ct-head', 'cbc', 'bmp'],
      targetTreatments: ['monitor', 'oxygen', 'iv-access', 'reassess'],
      expectations: {
        keyHistory: ['onset', 'associated-symptoms', 'pmh', 'medications'],
        keyExams: ['general', 'neuro', 'vitals'],
        keyInvestigations: ['glucose', 'ct-head'],
        keyTreatments: ['monitor', 'oxygen', 'iv-access', 'reassess'],
        harmfulActions: [],
        diagnosticKeywords: ['stroke', 'cva', 'acute stroke'],
        differentialList: ['Stroke', 'Hypoglycemia', 'Seizure / post-ictal state']
      },
      generatePatientChart: (context) => this.buildChart(context, {
        chiefComplaint: this.t(context.language, 'ضعف مفاجئ واضطراب كلام.', 'Sudden weakness and speech disturbance.'),
        triageNote: this.t(context.language, 'بداية مفاجئة لعجز عصبي بؤري.', 'Sudden onset focal neurologic deficit.'),
        hpi: [
          this.t(context.language, 'بداية الأعراض واضحة ومحددة زمنياً.', 'The onset is sudden and time-defined.'),
          this.t(context.language, 'يوجد ضعف في طرف واحد وربما facial droop.', 'There is unilateral weakness and possible facial droop.')
        ],
        pmh: ['Hypertension', this.t(context.language, 'قد يكون لديه A-fib أو عوامل خطورة وعائية.', 'May have atrial fibrillation or vascular risk factors.')],
        meds: [],
        allergies: [this.t(context.language, 'غير معروفة', 'Unknown')],
        social: [this.t(context.language, 'الوقت منذ آخر مرة كان طبيعياً مهم جداً.', 'The last-known-well time is critical.')],
        risks: ['Time-sensitive neurologic loss', 'Need to exclude stroke mimic']
      }),
      initialHighlightedExams: (context) => [
        this.examSection('neuro', context, 'العصبي / Neurologic', this.t(context.language, 'عجز بؤري واضح.', 'Clear focal neurologic deficit.'), [
          this.t(context.language, 'ضعف طرف أيمن/أيسر حسب السيناريو.', 'Weakness on one side.'),
          this.t(context.language, 'speech difficulty / facial asymmetry.', 'Speech difficulty / facial asymmetry.')
        ], 'baseline')
      ],
      resolveVitals: (state) => ({
        heartRate: this.round(82 + (state.physiology.neurologic * 0.08)),
        respiratoryRate: 18,
        bloodPressureSystolic: this.round(154 - (state.physiology.perfusion * 0.12)),
        bloodPressureDiastolic: this.round(88 - (state.physiology.perfusion * 0.06)),
        oxygenSaturation: 97,
        temperatureCelsius: 36.8,
        mentalStatus: state.physiology.neurologic >= 82 ? this.t(state.config.language, 'يقظ مع deficit بؤري', 'Alert with focal deficit') : this.t(state.config.language, 'العيب العصبي أخف', 'Deficit is less prominent')
      }),
      resolveSeverity: (state) => state.physiology.neurologic >= 86 ? 'critical'
        : state.physiology.neurologic >= 64 ? 'unstable'
          : state.physiology.neurologic >= 38 ? 'concerning'
            : 'stable',
      nextPrompt: (state) => this.t(state.config.language, 'هذه حالة neuro time-critical. افحص الوعي/العجز واطلب ما يستبعد mimics ثم imaging المناسب.', 'This is a time-critical neuro case. Examine consciousness and deficits, exclude mimics, then obtain the appropriate imaging.'),
      openingNarrative: (context) => this.t(context.language, `${context.patientName} وصل بعجز عصبي مفاجئ. كل دقيقة مهمة هنا، ويجب تمييز stroke عن mimics بسرعة.`, `${context.patientName} presents with a sudden focal neurologic deficit. Every minute matters, and stroke must be distinguished quickly from mimics.`),
      historyResponse: (_target, state) => this.t(state.config.language, 'القصة تدعم stroke حتى يثبت العكس، لكن glucose يجب فحصه فوراً.', 'The history supports stroke until proven otherwise, but glucose must be checked immediately.'),
      examResponse: (target, state) => target === 'neuro'
        ? {
            id: 'neuro',
            label: this.t(state.config.language, 'Neurologic Exam', 'Neurologic Exam'),
            summary: this.t(state.config.language, 'فحص عصبي بؤري إيجابي.', 'The focal neurologic exam is positive.'),
            findings: [
              this.t(state.config.language, 'Facial asymmetry.', 'Facial asymmetry.'),
              this.t(state.config.language, 'Arm drift / unilateral weakness.', 'Arm drift / unilateral weakness.'),
              this.t(state.config.language, 'Speech disturbance.', 'Speech disturbance.')
            ],
            status: 'critical'
          }
        : null,
      investigationResult: (target, state) => target === 'glucose'
        ? this.labPanel(state, 'Glucose', 'Stroke mimic check', this.t(state.config.language, 'Glucose طبيعية وتستبعد mimic مهم.', 'Glucose is normal, helping exclude a major mimic.'), [{
            id: 'glucose',
            label: 'Glucose',
            items: [this.labValue('Glucose', '108', 'mg/dL', '70-140')]
          }])
        : target === 'ct-head'
          ? this.imagingResult(state, 'CT Head', 'ct', 'CT Head', this.t(state.config.language, 'لا نزف داخل القحف واضح على CT الأولي.', 'No intracranial hemorrhage is seen on the initial CT.'), [
              this.t(state.config.language, 'No acute bleed.', 'No acute bleed.'),
              this.t(state.config.language, 'Early ischemic change not excluded.', 'Early ischemic change is not excluded.')
            ], this.t(state.config.language, 'CT يدعم استكمال stroke pathway.', 'CT supports proceeding down the stroke pathway.'), [
              this.t(state.config.language, 'No acute bleed', 'No acute bleed')
            ])
          : (target === 'cbc' || target === 'bmp' || target === 'cmp')
            ? this.labPanel(state, target.toUpperCase(), 'Supportive workup', this.t(state.config.language, 'التحاليل الأساسية لا تغيّر أولوية stroke pathway حالياً.', 'The basic labs do not change the immediate stroke pathway priority.'), [{
                id: target,
                label: target.toUpperCase(),
                items: [this.labValue('Hb', '13.9', 'g/dL', '12-16'), this.labValue('Na', '139', 'mmol/L', '135-145')]
              }])
            : null,
      applyTreatment: (target, state) => {
        switch (target) {
          case 'monitor':
            return this.basicPersistentTreatment(state, 'monitor', 'Neurologic monitoring', this.t(state.config.language, 'Continuous monitoring active.', 'Continuous monitoring active.'), 'monitoring', 'high', {}, this.t(state.config.language, 'بدأت المراقبة المستمرة.', 'Continuous monitoring has started.'));
          case 'oxygen':
            return this.basicPersistentTreatment(state, 'oxygen', 'Oxygen support', this.t(state.config.language, 'Supplemental oxygen active.', 'Supplemental oxygen active.'), 'oxygen', 'low', { oxygenation: -4 }, this.t(state.config.language, 'تم بدء دعم الأكسجين عند الحاجة.', 'Oxygen support started as needed.'));
          case 'iv-access':
            return this.basicPersistentTreatment(state, 'iv-access', 'IV access', this.t(state.config.language, 'IV line placed.', 'IV line placed.'), 'access', 'medium', {}, this.t(state.config.language, 'تم فتح خط وريدي.', 'IV access established.'));
          case 'reassess':
            this.applyDelta(state, { neurologic: -4 });
            return { applied: true, message: this.t(state.config.language, 'إعادة التقييم العصبي تحفظ baseline وتلتقط أي تغير جديد.', 'Reassessment preserves the neurologic baseline and watches for any evolution.'), immediateEffects: [] };
          default:
            return this.genericNeutralTreatment(state, target);
        }
      },
      buildDifferentials: (state) => this.basicDifferentials(state, [
        ['Stroke', 'high', 'Acute focal deficit with a clear onset supports stroke.'],
        ['Hypoglycemia', 'medium', 'Always exclude a glucose-related mimic quickly.'],
        ['Post-ictal state', 'low', 'Can mimic focal deficits depending on history.']
      ]),
      buildIdealPlan: (language) => [
        this.t(language, 'حدّد onset / last-known-well بسرعة.', 'Clarify onset / last-known-well quickly.'),
        this.t(language, 'افحص neuro status بشكل مركز.', 'Perform a focused neurologic examination.'),
        this.t(language, 'اطلب glucose فوراً لاستبعاد mimic سريع.', 'Check glucose immediately to exclude a rapid mimic.'),
        this.t(language, 'نسّق CT head / stroke pathway دون تأخير.', 'Coordinate CT head / stroke pathway without delay.')
      ],
      buildOutcomeNarrative: (state) => state.diagnosticHypotheses.some((item) => item.primary)
        ? this.t(state.config.language, 'تم التعرف على الحالة العصبية كـ stroke pathway بشكل منطقي وسريع.', 'The neurologic emergency was recognized and moved into a defensible stroke pathway quickly.')
        : this.t(state.config.language, 'تأخر التعرّف على الحالة العصبية أو استبعاد mimics الأساسية.', 'Recognition of the neurologic emergency or exclusion of major mimics was delayed.')
    };
  }
}
