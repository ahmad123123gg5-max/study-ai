import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import {
  PanelConfig,
  SimulationCaseSummary,
  SimulationFeedback,
  SimulationScenarioConfig,
  SimulationSessionMeta
} from '../models/virtual-lab.models';
import { ClinicalCaseGeneratorService } from './clinical-case-generator.service';
import { ClinicalEvaluationEngineService } from './clinical-evaluation-engine.service';
import { ClinicalInquiryOutcome, ClinicalInvestigationEngineService } from './clinical-investigation-engine.service';
import {
  ClinicalExamTarget,
  ClinicalHistoryTarget,
  ClinicalRuntimeStart,
  ClinicalSimulationState,
  ClinicalTreatmentId
} from './clinical-simulation.models';
import { ClinicalTreatmentEngineService, ClinicalTreatmentOutcome } from './clinical-treatment-engine.service';

interface RuntimeDecisionResult {
  assistantMessage: string;
  feedback: SimulationFeedback;
  quickOptions: string[];
  status: 'active' | 'completed' | 'failed';
  summary: SimulationCaseSummary | null;
}

const TICK_MS = 1500;

@Injectable({ providedIn: 'root' })
export class MedicalSimulationRuntimeService implements OnDestroy {
  private readonly generator = inject(ClinicalCaseGeneratorService);
  private readonly investigation = inject(ClinicalInvestigationEngineService);
  private readonly treatment = inject(ClinicalTreatmentEngineService);
  private readonly evaluation = inject(ClinicalEvaluationEngineService);

  private intervalId: number | null = null;

  readonly state = signal<ClinicalSimulationState | null>(null);
  readonly summary = signal<SimulationCaseSummary | null>(null);

  readonly panelConfig = computed<PanelConfig | null>(() => {
    const state = this.state();
    return state ? this.evaluation.buildPanelConfig(state) : null;
  });

  readonly sessionMeta = computed<SimulationSessionMeta | null>(() => {
    const state = this.state();
    return state ? this.evaluation.buildSessionMeta(state) : null;
  });

  readonly quickOptions = computed<string[]>(() => {
    const state = this.state();
    return state ? this.evaluation.buildQuickOptions(state) : [];
  });

  readonly active = computed(() => this.state()?.status === 'active');

  startCase(config: SimulationScenarioConfig): ClinicalRuntimeStart {
    this.reset();
    const generated = this.generator.generate(config);
    const state = generated.state;
    this.state.set(state);
    this.startTicker();

    return {
      assistantMessage: `${generated.context.definition.openingNarrative(generated.context)}\n\n${generated.context.definition.nextPrompt(state)}`,
      timer: {
        enabled: true,
        seconds: config.durationMinutes * 60,
        label: config.language === 'ar' ? 'مدة المختبر' : 'Lab Duration',
        urgency: config.difficulty === 'hard' || config.difficulty === 'expert' ? 'high' : 'moderate',
        autoStart: true,
        mode: 'case'
      },
      quickOptions: this.evaluation.buildQuickOptions(state)
    };
  }

  submitDecision(input: string, _parsedAction?: unknown): RuntimeDecisionResult {
    const state = this.state();
    if (!state || state.status !== 'active') {
      return {
        assistantMessage: '',
        feedback: this.feedback('neutral', state?.config.language || 'en', 'Simulation Paused', 'The case is no longer accepting actions.'),
        quickOptions: [],
        status: state?.status === 'failed' ? 'failed' : 'completed',
        summary: this.summary()
      };
    }

    state.stepIndex = Math.min(state.estimatedTotalSteps, state.stepIndex + 1);
    state.score.timing = this.clamp(state.score.timing + 2, 0, 100);

    const results: string[] = [];
    const actionOutcomes: Array<ClinicalInquiryOutcome | ClinicalTreatmentOutcome> = [];
    const normalized = this.normalize(input);

    const historyTargets = this.detectHistoryTargets(normalized);
    const examTargets = this.detectExamTargets(normalized);
    const investigationTargets = this.detectInvestigationTargets(normalized);
    const treatmentTargets = this.detectTreatmentTargets(normalized);
    const diagnosisMode = this.isDiagnosisStatement(normalized);
    const wantsReassessment = /(reassess|recheck|repeat|اعد التقييم|اعادة تقييم|إعادة تقييم|راجع)/.test(normalized);

    for (const target of historyTargets) {
      const outcome = this.investigation.requestHistory(state, target);
      this.recordOutcome(state, outcome);
      actionOutcomes.push(outcome);
      results.push(outcome.message);
    }

    for (const target of examTargets) {
      const outcome = this.investigation.requestExam(state, target);
      this.recordOutcome(state, outcome);
      actionOutcomes.push(outcome);
      results.push(outcome.message);
    }

    for (const target of investigationTargets) {
      const outcome = this.investigation.requestInvestigation(state, target);
      this.recordOutcome(state, outcome);
      actionOutcomes.push(outcome);
      results.push(outcome.message);
    }

    for (const target of treatmentTargets) {
      const outcome = this.treatment.applyTreatment(state, target);
      this.recordTreatmentOutcome(state, outcome);
      actionOutcomes.push(outcome);
      results.push(outcome.message);
    }

    if (diagnosisMode) {
      const outcome = this.investigation.submitDiagnosis(state, input);
      this.recordOutcome(state, outcome);
      actionOutcomes.push(outcome);
      results.push(outcome.message);
    }

    if (wantsReassessment && !treatmentTargets.includes('reassess')) {
      const outcome = this.treatment.applyTreatment(state, 'reassess');
      this.recordTreatmentOutcome(state, outcome);
      actionOutcomes.push(outcome);
      results.push(outcome.message);
    }

    if (actionOutcomes.length === 0) {
      state.score.timing = this.clamp(state.score.timing - 4, 0, 100);
      state.score.safety = this.clamp(state.score.safety - 2, 0, 100);
      state.mistakes.push(state.config.language === 'ar'
        ? 'كان الإدخال عاماً ولم يتحول إلى history/exam/tests/treatment واضح.'
        : 'The input stayed vague and did not translate into a clear history, exam, test, or treatment action.');
      results.push(state.config.language === 'ar'
        ? 'لم أفهم الإجراء السريري المحدد. اطلب history، فحصاً، فحوصات، تشخيصاً، أو علاجاً واضحاً.'
        : 'I did not detect a specific clinical move. Ask for history, exam, investigations, a diagnosis, or a treatment clearly.');
    }

    state.vitals = state.definition.resolveVitals(state);
    state.severity = state.definition.resolveSeverity(state);
    state.diagnosticHypotheses = state.definition.buildDifferentials(state);
    state.latestAlerts = this.buildAlerts(state);
    state.lastClinicianResponse = results[results.length - 1] || state.lastClinicianResponse;

    const status = this.resolveStatus(state);
    if (status !== 'active') {
      state.status = status;
      this.stopTicker();
      this.state.set({ ...state });
      const summary = this.evaluation.buildSummary(state, status === 'failed' ? 'critical-deterioration' : 'completed');
      this.summary.set(summary);
      return {
        assistantMessage: `${results.join('\n\n')}\n\n${summary.patientCourse}`,
        feedback: this.feedback(status === 'failed' ? 'negative' : 'positive', state.config.language, status === 'failed' ? 'Case Deteriorated' : 'Case Stabilized', summary.outcomeLabel),
        quickOptions: [],
        status,
        summary
      };
    }

    const tone = actionOutcomes.some((item) => 'resolution' in item && item.resolution.dangerous)
      ? 'negative'
      : actionOutcomes.length > 0
        ? 'positive'
        : 'neutral';

    this.state.set({ ...state });

    return {
      assistantMessage: `${results.join('\n\n')}\n\n${state.definition.nextPrompt(state)}`,
      feedback: this.feedback(
        tone,
        state.config.language,
        tone === 'negative'
          ? (state.config.language === 'ar' ? 'استجابة غير مثالية' : 'Unsafe or weak response')
          : tone === 'positive'
            ? (state.config.language === 'ar' ? 'تحديث سريري' : 'Clinical update')
            : (state.config.language === 'ar' ? 'معلومة' : 'Notice'),
        tone === 'negative'
          ? (state.config.language === 'ar' ? 'بعض القرارات حسّنت المسار وأخرى أضرت به أو كانت غير كافية.' : 'Some actions helped, while others were harmful or insufficient.')
          : (state.config.language === 'ar' ? 'تم تحديث الحالة والنتائج بناءً على قراراتك.' : 'The patient state and results have been updated from your decisions.')
      ),
      quickOptions: this.evaluation.buildQuickOptions(state),
      status: 'active',
      summary: null
    };
  }

  requestOptions() {
    const state = this.state();
    if (!state) {
      return {
        assistantMessage: '',
        quickOptions: []
      };
    }

    return {
      assistantMessage: state.config.language === 'ar'
        ? 'هذه الخيارات مبنية على ما لم يُستكمل بعد في history/exam/tests/treatment.'
        : 'These options are based on what is still missing across history, exam, investigations, and treatment.',
      quickOptions: this.evaluation.buildQuickOptions(state)
    };
  }

  handleTimeout(): RuntimeDecisionResult {
    const state = this.state();
    if (!state) {
      return {
        assistantMessage: '',
        feedback: this.feedback('neutral', 'en', 'Time Ended', 'The session has already closed.'),
        quickOptions: [],
        status: 'completed',
        summary: this.summary()
      };
    }

    state.status = this.resolveStatus(state) === 'failed' ? 'failed' : 'completed';
    this.stopTicker();
    this.state.set({ ...state });
    const summary = this.evaluation.buildSummary(state, 'timer');
    this.summary.set(summary);

    return {
      assistantMessage: summary.patientCourse,
      feedback: this.feedback(state.status === 'failed' ? 'negative' : 'neutral', state.config.language, state.config.language === 'ar' ? 'انتهى الوقت' : 'Time is over', summary.outcomeLabel),
      quickOptions: [],
      status: state.status,
      summary
    };
  }

  handoffToTutor() {
    const state = this.state();
    const summary = state
      ? this.evaluation.buildSummary(state, 'manual')
      : null;
    if (summary) {
      this.summary.set(summary);
    }
    return { summary };
  }

  reset() {
    this.stopTicker();
    this.state.set(null);
    this.summary.set(null);
  }

  ngOnDestroy() {
    this.stopTicker();
  }

  private startTicker() {
    this.stopTicker();
    this.intervalId = window.setInterval(() => {
      const state = this.state();
      if (!state || state.status !== 'active') {
        return;
      }

      this.treatment.tick(state);
      state.latestAlerts = this.buildAlerts(state);

      if (state.severity === 'critical') {
        state.timeline.push({
          id: crypto.randomUUID(),
          timeLabel: this.timeLabel(state.tickCount, state.config.language),
          title: state.config.language === 'ar' ? 'تدهور زمني' : 'Time-sensitive deterioration',
          detail: state.config.language === 'ar'
            ? 'استمرت الحالة بالتدهور لأن الخطر الأساسي ما زال غير مسيطر عليه.'
            : 'The patient continues to deteriorate because the core threat remains uncontrolled.',
          tone: 'critical'
        });
      }

      if (this.resolveStatus(state) === 'failed') {
        state.status = 'failed';
        this.stopTicker();
        this.summary.set(this.evaluation.buildSummary(state, 'critical-deterioration'));
      }

      this.state.set({ ...state });
    }, TICK_MS);
  }

  private stopTicker() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private recordOutcome(state: ClinicalSimulationState, outcome: ClinicalInquiryOutcome) {
    state.timeline.push(outcome.timeline);
    state.actionLog.push(outcome.logEntry);
  }

  private recordTreatmentOutcome(state: ClinicalSimulationState, outcome: ClinicalTreatmentOutcome) {
    state.timeline.push(outcome.timeline);
    state.actionLog.push(outcome.logEntry);
    if (outcome.resolution.dangerous) {
      state.mistakes.push(outcome.message);
    } else {
      state.strengths.push(outcome.message);
    }
  }

  private resolveStatus(state: ClinicalSimulationState): 'active' | 'completed' | 'failed' {
    const diagnosisMatched = state.diagnosisAttempts.some((entry) => entry.matched);
    const keyTreatmentsDone = state.definition.expectations.keyTreatments.filter((item) => !state.completedInterventions.has(item)).length;
    const overallScore = this.evaluation.overallScore(state);

    if (state.severity === 'critical' && state.tickCount >= 6) {
      return 'failed';
    }

    if (diagnosisMatched && keyTreatmentsDone <= 1 && state.severity !== 'critical' && state.patientStableTicks >= 2 && overallScore >= 68) {
      return 'completed';
    }

    return 'active';
  }

  private buildAlerts(state: ClinicalSimulationState) {
    const alerts: string[] = [];
    if (state.severity === 'critical') {
      alerts.push(state.config.language === 'ar'
        ? 'إنذار: المؤشرات الحيوية تتدهور بسرعة.'
        : 'Alert: the vital signs are worsening rapidly.');
    }
    const missingCoreTreatment = state.definition.expectations.keyTreatments.find((item) => !state.completedInterventions.has(item));
    if (missingCoreTreatment && state.tickCount >= 2) {
      alerts.push(state.config.language === 'ar'
        ? 'هناك خطوة علاجية أساسية ما زالت غير منفذة.'
        : 'A key therapeutic step is still missing.');
    }
    return alerts;
  }

  private detectHistoryTargets(value: string): ClinicalHistoryTarget[] {
    return this.detectTargets(value, [
      ['onset', /(history|hx|onset|when did it start|بدا|بدأ|منذ متى|تاريخ المرض)/],
      ['associated-symptoms', /(associated|symptoms|cough|pain|vomit|rash|اعراض|أعراض|سعال|الم|ألم|قيء|طفح)/],
      ['pmh', /(pmh|past medical|history of|مرضي|امراض سابقة|أمراض سابقة)/],
      ['medications', /(medication|meds|drug history|ادوية|أدوية|دواء|علاج)/],
      ['allergies', /(allerg|حساسيه|حساسية)/],
      ['last-meal', /(last meal|ate|اكل|أكل|آخر وجبة)/],
      ['pregnancy', /(pregnan|postpartum|ولاده|ولادة|حمل)/],
      ['context', /(context|trigger|cause|exposure|سبب|محفز|تعرض)/]
    ]);
  }

  private detectExamTargets(value: string): ClinicalExamTarget[] {
    return this.detectTargets(value, [
      ['general', /(general exam|look at|inspect|assessment|قيم|افحص|فحص عام|general)/],
      ['vitals', /(vitals|vital signs|العلامات الحيويه|العلامات الحيوية|ضغط|نبض|ساتوريشن|تشبع)/],
      ['airway', /(airway|مجرى الهواء|air way)/],
      ['breathing', /(breathing|respiratory|تنفس|تنفسي)/],
      ['circulation', /(circulation|perfusion|دوره دمويه|دورة دموية)/],
      ['neuro', /(neuro|neurolog|وعي|gcs|pupil|عصبي)/],
      ['abdomen', /(abdomen|abdominal|بطن)/],
      ['chest', /(chest sounds|auscultat|chest|صدر|سماعات الصدر)/],
      ['cardiac', /(cardiac|heart sounds|قلب)/],
      ['pelvis', /(pelvic|uterus|uterine|رحم|ولادي|نزف مهبلي)/]
    ]);
  }

  private detectInvestigationTargets(value: string) {
    return this.detectTargets(value, [
      ['cbc', /\bcbc\b|complete blood/i],
      ['cmp', /\bcmp\b/i],
      ['bmp', /\bbmp\b/i],
      ['lft', /\blft\b/i],
      ['rft', /\brft\b/i],
      ['glucose', /(glucose|sugar|سكر)/],
      ['ketones', /(ketone|كيتون)/],
      ['troponin', /(troponin|تروبونين)/],
      ['lactate', /(lactate|لاكتيت)/],
      ['blood-cultures', /(blood culture|cultures|مزرعه دم|مزرعة دم)/],
      ['abg', /\babg\b|arterial blood gas/i],
      ['ecg', /\becg\b|\bekg\b|تخطيط|رسم قلب/],
      ['chest-xray', /(chest x-?ray|cxr|اشعه صدر|أشعة صدر)/],
      ['ct-head', /(ct head|head ct|ct brain|ct المخ|ct الراس|ct الرأس)/],
      ['ct-abdomen', /(ct abdomen|ct abd|ct البطن)/],
      ['pelvic-ultrasound', /(pelvic ultrasound|uterine ultrasound|سونار|ultrasound|التراساوند)/]
    ]);
  }

  private detectTreatmentTargets(value: string): ClinicalTreatmentId[] {
    return this.detectTargets(value, [
      ['oxygen', /(oxygen|o2|اكسجين|أكسجين)/],
      ['iv-access', /(iv access|iv line|cannula|وريدي|كانيولا)/],
      ['monitor', /(monitor|monitoring|مراقبه|مراقبة|monitors)/],
      ['nebulizer', /(nebulizer|neb|salbutamol|albuterol|نيبولايزر|نيبولايزر|سالبوتامول)/],
      ['steroids', /(steroid|hydrocortisone|dexamethasone|ستيرويد)/],
      ['antibiotics', /(antibiotic|antibiotics|مضاد|مضادات)/],
      ['iv-fluids', /(iv fluids|fluid bolus|normal saline|ringer|محلول|سوائل)/],
      ['vasopressors', /(vasopressor|noradrenaline|norepinephrine|فازوبرسر|نورأدرينالين)/],
      ['aspirin', /(aspirin|اسبرين|أسبرين)/],
      ['nitroglycerin', /(nitroglycerin|nitro|نيترو)/],
      ['heparin', /(heparin|هيبارين)/],
      ['dextrose', /(dextrose|d50|جلوكوز وريدي|ديكستروز)/],
      ['insulin', /(insulin|انسولين|إنسولين)/],
      ['epinephrine', /(epinephrine|adrenaline|ادرينالين|أدرينالين)/],
      ['suction', /(suction|شفط)/],
      ['transfusion', /(transfusion|blood|دم|نقل دم)/],
      ['oxytocin', /(oxytocin|اوكسيتوسين|أوكسيتوسين)/],
      ['analgesia', /(analgesia|pain relief|paracetamol|morphine|مسكن|تسكين)/],
      ['surgical-consult', /(surgical consult|call surgery|الجراحه|الجراحة|استدعاء الجراح)/],
      ['reassess', /(reassess|recheck|repeat|اعد التقييم|اعادة تقييم|إعادة تقييم|راجع)/]
    ]);
  }

  private detectTargets<T extends string>(value: string, entries: Array<[T, RegExp]>): T[] {
    return entries.filter(([, pattern]) => pattern.test(value)).map(([label]) => label);
  }

  private isDiagnosisStatement(value: string) {
    return /(diagnosis|differential|i think|likely|suspect|التشخيص|التشخيص التفريقي|أعتقد|اعتقد|ارجح|أرجح|اشك|أشك)/.test(value);
  }

  private normalize(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/[ة]/g, 'ه')
      .replace(/[ىي]/g, 'ي')
      .replace(/\s+/g, ' ');
  }

  private feedback(tone: SimulationFeedback['tone'], language: SimulationScenarioConfig['language'], title: string, message: string): SimulationFeedback {
    return {
      id: crypto.randomUUID(),
      tone,
      title,
      message,
      icon: tone === 'positive'
        ? 'fa-solid fa-circle-check'
        : tone === 'negative'
          ? 'fa-solid fa-triangle-exclamation'
          : 'fa-solid fa-circle-info'
    };
  }

  private timeLabel(seconds: number, language: SimulationScenarioConfig['language']) {
    return language === 'ar' ? `+${seconds} ث` : `+${seconds}s`;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }
}
