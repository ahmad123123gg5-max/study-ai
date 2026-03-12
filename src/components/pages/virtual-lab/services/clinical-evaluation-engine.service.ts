import { Injectable } from '@angular/core';
import {
  ClinicalDashboardPanelData,
  ClinicalEducationScoreCard,
  ClinicalHypothesisData,
  ClinicianOrderPanelData,
  MedicalMonitorPanelData,
  PanelConfig,
  SimulationCaseSummary,
  SimulationFeedback,
  SimulationSessionMeta,
  SimulationScenarioConfig,
  VitalSnapshot
} from '../models/virtual-lab.models';
import {
  ClinicalExamTarget,
  ClinicalGenerationResult,
  ClinicalHistoryTarget,
  ClinicalInvestigationId,
  ClinicalPanelBuild,
  ClinicalSimulationState,
  ClinicalSpecialtyLens,
  ClinicalTreatmentId
} from './clinical-simulation.models';

@Injectable({ providedIn: 'root' })
export class ClinicalEvaluationEngineService {
  buildPanel(state: ClinicalSimulationState): ClinicalPanelBuild {
    const monitor: MedicalMonitorPanelData = {
      heartRate: state.vitals.heartRate,
      bloodPressure: `${state.vitals.bloodPressureSystolic}/${state.vitals.bloodPressureDiastolic}`,
      bloodPressureSystolic: state.vitals.bloodPressureSystolic,
      bloodPressureDiastolic: state.vitals.bloodPressureDiastolic,
      oxygenSaturation: state.vitals.oxygenSaturation,
      respiratoryRate: state.vitals.respiratoryRate,
      temperatureCelsius: state.vitals.temperatureCelsius,
      alertLevel: state.severity === 'critical' ? 'critical' : state.severity === 'stable' ? 'stable' : 'watch',
      ecgPreset: this.resolveEcgPreset(state),
      severity: state.severity,
      statusLabel: this.statusLabel(state),
      trendNote: state.definition.nextPrompt(state),
      alarmActive: state.severity === 'critical',
      patientState: {
        activeInterventions: Array.from(state.activeInterventions.values()),
        pendingOrders: this.pendingOrders(state),
        recentActions: state.actionLog.slice(-4).map((item) => item.label),
        lastClinicianResponse: state.lastClinicianResponse,
        doctorRequested: false,
        doctorResponded: false,
        monitoringActive: state.activeInterventions.has('monitor'),
        diagnosticHypotheses: state.diagnosticHypotheses
      },
      dosageCalculator: null
    };

    const dashboard: ClinicalDashboardPanelData = {
      patientChart: state.patientChart,
      highlightedExams: Array.from(state.requestedExams.values()),
      results: Array.from(state.requestedInvestigations.values()),
      featuredResultId: this.featuredResultId(state),
      differentials: state.diagnosticHypotheses,
      timeline: state.timeline.slice(-8),
      alerts: state.latestAlerts,
      learningFocus: state.lens.learningFocus[state.config.language],
      scoreCards: this.scoreCards(state)
    };

    return {
      monitor,
      dashboard,
      sessionMeta: this.buildSessionMeta(state)
    };
  }

  buildPanelConfig(state: ClinicalSimulationState): PanelConfig {
    const built = this.buildPanel(state);
    return {
      type: 'medical-monitor',
      title: state.config.language === 'ar' ? 'لوحة الحالة السريرية' : 'Clinical Case Dashboard',
      subtitle: `${state.patientChart.patientName} • ${state.definition.titles[state.config.language]}`,
      summary: state.definition.overview[state.config.language],
      specialtyCategory: 'medical',
      monitor: built.monitor,
      clinical: built.dashboard
    };
  }

  buildSessionMeta(state: ClinicalSimulationState): SimulationSessionMeta {
    return {
      title: `${state.definition.titles[state.config.language]} • ${state.patientChart.patientName}`,
      role: state.config.language === 'ar'
        ? `${state.patientChart.age} • ${state.patientChart.sex}`
        : `${state.patientChart.age} • ${state.patientChart.sex}`,
      setting: state.lens.setting[state.config.language],
      objective: state.definition.overview[state.config.language],
      urgency: state.severity === 'critical' ? 'critical' : state.severity === 'unstable' ? 'time-critical' : 'routine',
      specialtyCategory: 'medical',
      stepIndex: state.stepIndex,
      estimatedTotalSteps: state.estimatedTotalSteps,
      score: this.overallScore(state),
      specialtyLabel: state.lens.displayName[state.config.language],
      difficultyLabel: this.difficultyLabel(state.config),
      coachLabel: state.lens.coachLabel[state.config.language],
      consultantLabel: state.lens.consultantLabel[state.config.language],
      environmentLabel: state.lens.setting[state.config.language],
      patientLabel: `${state.patientChart.patientName} • ${state.patientChart.chiefComplaint}`,
      phaseLabel: this.statusLabel(state)
    };
  }

  buildFeedback(
    state: ClinicalSimulationState,
    tone: SimulationFeedback['tone'],
    title: string,
    message: string
  ): SimulationFeedback {
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

  buildQuickOptions(state: ClinicalSimulationState): string[] {
    const language = state.config.language;
    const options: string[] = [];

    const missingHistory = state.definition.expectations.keyHistory.find((item) => !state.requestedHistory.has(item));
    const missingExam = state.definition.expectations.keyExams.find((item) => !state.requestedExams.has(item));
    const missingTest = state.definition.expectations.keyInvestigations.find((item) => !state.requestedInvestigations.has(item));
    const missingTreatment = state.definition.expectations.keyTreatments.find((item) => !state.completedInterventions.has(item));

    if (missingHistory) options.push(this.historyLabel(missingHistory, language));
    if (missingExam) options.push(this.examLabel(missingExam, language));
    if (missingTest) options.push(this.investigationLabel(missingTest, language));
    if (missingTreatment) options.push(this.treatmentLabel(missingTreatment, language));

    if (!state.diagnosisAttempts.some((entry) => entry.matched)) {
      options.push(language === 'ar' ? 'اذكر التشخيص المرجح والتشخيصات التفريقية' : 'State the most likely diagnosis and your differentials');
    }

    return Array.from(new Set(options)).slice(0, 4);
  }

  buildSummary(state: ClinicalSimulationState, closedReason: SimulationCaseSummary['closedReason']): SimulationCaseSummary {
    const score = this.overallScore(state);
    const result = score >= 80 ? 'success' : score >= 58 ? 'partial' : state.severity === 'critical' ? 'deteriorated' : 'failure';
    const strengths = this.collectStrengths(state);
    const mistakes = this.collectMistakes(state);
    const idealPlan = state.definition.buildIdealPlan(state.config.language, state.lens);

    return {
      result,
      closedReason,
      title: state.config.language === 'ar' ? 'التقييم الختامي للحالة' : 'Final Case Evaluation',
      subtitle: `${state.definition.titles[state.config.language]} • ${state.patientChart.patientName}`,
      outcomeLabel: score >= 80
        ? this.t(state.config.language, 'أداء قوي', 'Strong Performance')
        : score >= 58
          ? this.t(state.config.language, 'أداء مختلط', 'Mixed Performance')
          : this.t(state.config.language, 'أداء يحتاج إعادة بناء', 'Performance Needs Rework'),
      patientCourse: state.definition.buildOutcomeNarrative(state),
      whatHappened: state.timeline.slice(-5).map((event) => `${event.title}: ${event.detail}`),
      correctActions: strengths,
      incorrectActions: mistakes,
      vitalsImpact: [
        `HR ${state.vitals.heartRate} bpm`,
        `SpO2 ${state.vitals.oxygenSaturation}%`,
        `BP ${state.vitals.bloodPressureSystolic}/${state.vitals.bloodPressureDiastolic}`,
        `RR ${state.vitals.respiratoryRate}/min`
      ],
      educationalAnalysis: this.educationalAnalysis(state),
      strengths,
      mistakesToAvoid: mistakes,
      recommendations: idealPlan.slice(0, 4),
      initialSnapshotLabel: this.t(state.config.language, 'بداية الحالة', 'Initial Case Snapshot'),
      finalSnapshotLabel: this.t(state.config.language, 'الحالة عند الإغلاق', 'Closing Case Snapshot'),
      initialSnapshot: [
        state.patientChart.caseTitle,
        state.patientChart.chiefComplaint,
        state.patientChart.triageNote
      ],
      finalSnapshot: [
        `${this.t(state.config.language, 'الشدة الحالية', 'Current severity')}: ${this.statusLabel(state)}`,
        `${this.t(state.config.language, 'عدد النتائج المطلوبة', 'Results requested')}: ${state.requestedInvestigations.size}`,
        `${this.t(state.config.language, 'التدخلات المنفذة', 'Interventions completed')}: ${state.completedInterventions.size}`
      ],
      correctActionsLabel: this.t(state.config.language, 'ما تم عمله جيداً', 'What Went Well'),
      incorrectActionsLabel: this.t(state.config.language, 'ما احتاج تصحيحاً', 'What Needed Correction'),
      impactLabel: this.t(state.config.language, 'تأثير القرارات على المريض', 'Impact of Decisions on the Patient'),
      recommendationsLabel: this.t(state.config.language, 'الخطة المثالية', 'Ideal Management Plan'),
      performanceDimensions: this.scoreCards(state).map((metric) => ({
        label: metric.label,
        value: `${metric.score}/100`,
        note: metric.note
      })),
      idealPlanLabel: this.t(state.config.language, 'الخطة المثالية للتعامل', 'Ideal Management Plan'),
      idealPlan,
      criticalMistakesLabel: this.t(state.config.language, 'أخطاء حرجة أو متكررة', 'Critical or Repeated Errors'),
      criticalMistakes: mistakes.slice(0, 4),
      timelineLabel: this.t(state.config.language, 'الـ Timeline السريري', 'Clinical Timeline'),
      timelineHighlights: state.timeline.slice(-6).map((item) => `${item.timeLabel} • ${item.title}`),
      score
    };
  }

  overallScore(state: ClinicalSimulationState): number {
    const weights = state.lens.evaluationWeights;
    const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
    const weighted =
      (state.score.history * weights.history) +
      (state.score.exam * weights.exam) +
      (state.score.tests * weights.tests) +
      (state.score.diagnosis * weights.diagnosis) +
      (state.score.treatment * weights.treatment) +
      (state.score.timing * weights.timing) +
      (state.score.safety * weights.safety);

    return Math.max(0, Math.min(100, Math.round(weighted / totalWeight)));
  }

  captureSnapshot(state: ClinicalSimulationState): VitalSnapshot {
    return {
      heartRate: state.vitals.heartRate,
      oxygenSaturation: state.vitals.oxygenSaturation,
      respiratoryRate: state.vitals.respiratoryRate,
      bloodPressureSystolic: state.vitals.bloodPressureSystolic,
      bloodPressureDiastolic: state.vitals.bloodPressureDiastolic,
      temperatureCelsius: state.vitals.temperatureCelsius,
      severity: state.severity
    };
  }

  private featuredResultId(state: ClinicalSimulationState) {
    const entries = Array.from(state.requestedInvestigations.values());
    return entries.length > 0 ? entries[entries.length - 1]?.id || null : null;
  }

  private pendingOrders(state: ClinicalSimulationState): ClinicianOrderPanelData[] {
    const language = state.config.language;
    const orders: ClinicianOrderPanelData[] = [];
    const missingTreatment = state.definition.expectations.keyTreatments.filter((item) => !state.completedInterventions.has(item)).slice(0, 3);
    for (const item of missingTreatment) {
      orders.push({
        id: item,
        label: this.treatmentLabel(item, language),
        instructions: language === 'ar'
          ? 'ما زال هذا الإجراء من الخطوات الأساسية غير المنفذة.'
          : 'This remains one of the core missing management steps.',
        category: 'procedure',
        status: 'pending',
        createdAt: Date.now()
      });
    }
    return orders;
  }

  private scoreCards(state: ClinicalSimulationState): ClinicalEducationScoreCard[] {
    return [
      this.metricCard('history', this.t(state.config.language, 'التاريخ المرضي', 'History'), state.score.history, state),
      this.metricCard('exam', this.t(state.config.language, 'الفحص السريري', 'Exam'), state.score.exam, state),
      this.metricCard('tests', this.t(state.config.language, 'الفحوصات', 'Investigations'), state.score.tests, state),
      this.metricCard('diagnosis', this.t(state.config.language, 'التشخيص', 'Diagnosis'), state.score.diagnosis, state),
      this.metricCard('treatment', this.t(state.config.language, 'العلاج', 'Treatment'), state.score.treatment, state),
      this.metricCard('timing', this.t(state.config.language, 'التوقيت والأولوية', 'Timing & Prioritization'), state.score.timing, state)
    ];
  }

  private metricCard(id: string, label: string, score: number, state: ClinicalSimulationState): ClinicalEducationScoreCard {
    return {
      id,
      label,
      score,
      status: score >= 70 ? 'strong' : score >= 45 ? 'mixed' : 'weak',
      note: id === 'treatment'
        ? this.t(state.config.language, 'هل بدأت العلاج الصحيح وفي الوقت المناسب؟', 'Did you start the right treatment at the right time?')
        : id === 'diagnosis'
          ? this.t(state.config.language, 'هل ربطت المعطيات بالتشخيص الأرجح؟', 'Did you connect the data to the most likely diagnosis?')
          : this.t(state.config.language, 'يتحسن هذا المحور كلما كانت قراراتك أكثر ترتيباً واتساقاً.', 'This metric improves when your decisions stay organized and consistent.')
    };
  }

  private collectStrengths(state: ClinicalSimulationState): string[] {
    const strengths: string[] = [];
    if (state.requestedHistory.size > 0) strengths.push(this.t(state.config.language, 'بدأت بجمع history موجه.', 'You began by gathering a focused history.'));
    if (state.requestedExams.size >= 2) strengths.push(this.t(state.config.language, 'دعمت قراراتك بفحص سريري فعلي.', 'You supported decisions with real physical examination.'));
    if (state.completedInterventions.size > 0) strengths.push(this.t(state.config.language, 'حوّلت المعطيات إلى تدخلات عملية.', 'You turned the data into practical interventions.'));
    if (state.diagnosisAttempts.some((item) => item.matched)) strengths.push(this.t(state.config.language, 'طرحت تشخيصاً منطقياً مبنياً على المعطيات.', 'You proposed a defensible diagnosis based on the available data.'));
    if (strengths.length === 0) strengths.push(this.t(state.config.language, 'واصلت التفاعل مع الحالة دون تركها بلا قرارات.', 'You kept engaging with the case instead of abandoning it.'));
    return strengths.slice(0, 4);
  }

  private collectMistakes(state: ClinicalSimulationState): string[] {
    const mistakes = [...state.mistakes];
    if (state.requestedHistory.size === 0) mistakes.push(this.t(state.config.language, 'لم يُؤخذ history موجه مبكراً.', 'No focused history was taken early.'));
    if (state.requestedExams.size < 2) mistakes.push(this.t(state.config.language, 'الفحص السريري كان محدوداً أو متأخراً.', 'Physical examination remained limited or late.'));
    if (!state.diagnosisAttempts.some((entry) => entry.matched)) mistakes.push(this.t(state.config.language, 'لم يُطرح تشخيص رئيسي مدعوم بشكل كافٍ.', 'A sufficiently supported leading diagnosis was not proposed.'));
    if (state.completedInterventions.size === 0) mistakes.push(this.t(state.config.language, 'تأخر بدء التدخلات العلاجية.', 'Therapeutic interventions were delayed.'));
    return Array.from(new Set(mistakes)).slice(0, 4);
  }

  private educationalAnalysis(state: ClinicalSimulationState) {
    return state.config.language === 'ar'
      ? `هذه الحالة قاست ${state.lens.learningFocus.ar.join('، ')}. كلما بنيت history ثم exam ثم tests ثم treatment ثم reassessment ارتفعت الدرجة وازدادت استجابة المريض واقعية.`
      : `This case tested ${state.lens.learningFocus.en.join(', ')}. The more consistently you built history, exam, investigations, treatment, and reassessment in sequence, the stronger the score and patient response became.`;
  }

  private resolveEcgPreset(state: ClinicalSimulationState): MedicalMonitorPanelData['ecgPreset'] {
    if (state.definition.id === 'myocardial-infarction') return 'stemi';
    if (state.definition.id === 'septic-shock' && state.severity === 'critical') return 'af';
    return 'normal';
  }

  private statusLabel(state: ClinicalSimulationState) {
    if (state.severity === 'critical') {
      return this.t(state.config.language, 'حرج جداً', 'Critical');
    }
    if (state.severity === 'unstable') {
      return this.t(state.config.language, 'غير مستقر', 'Unstable');
    }
    if (state.severity === 'concerning') {
      return this.t(state.config.language, 'مقلق ويحتاج متابعة', 'Concerning');
    }
    return this.t(state.config.language, 'أكثر استقراراً', 'Stabilizing');
  }

  private difficultyLabel(config: SimulationScenarioConfig) {
    if (config.language === 'ar') {
      if (config.difficulty === 'easy') return 'Beginner';
      if (config.difficulty === 'hard' || config.difficulty === 'expert') return 'Advanced';
      return 'Intermediate';
    }

    if (config.difficulty === 'easy') return 'Beginner';
    if (config.difficulty === 'hard' || config.difficulty === 'expert') return 'Advanced';
    return 'Intermediate';
  }

  private historyLabel(target: ClinicalHistoryTarget, language: SimulationScenarioConfig['language']) {
    const labels: Record<ClinicalHistoryTarget, string> = {
      onset: language === 'ar' ? 'اسأل عن بداية الأعراض' : 'Ask about onset',
      'associated-symptoms': language === 'ar' ? 'اسأل عن الأعراض المصاحبة' : 'Ask about associated symptoms',
      pmh: language === 'ar' ? 'اسأل عن التاريخ المرضي' : 'Review past medical history',
      medications: language === 'ar' ? 'اسأل عن الأدوية الحالية' : 'Ask about current medications',
      allergies: language === 'ar' ? 'اسأل عن الحساسية' : 'Ask about allergies',
      'last-meal': language === 'ar' ? 'اسأل عن آخر وجبة' : 'Ask about the last meal',
      pregnancy: language === 'ar' ? 'استوضح سياق الحمل/الولادة' : 'Clarify pregnancy / postpartum context',
      context: language === 'ar' ? 'اسأل عن سياق بدء الحالة' : 'Clarify the trigger or context'
    };
    return labels[target];
  }

  private examLabel(target: ClinicalExamTarget, language: SimulationScenarioConfig['language']) {
    const labels: Record<ClinicalExamTarget, string> = {
      general: language === 'ar' ? 'افحص المظهر العام' : 'Perform a general assessment',
      vitals: language === 'ar' ? 'أعد تقييم العلامات الحيوية' : 'Reassess the vital signs',
      airway: language === 'ar' ? 'افحص airway' : 'Examine the airway',
      breathing: language === 'ar' ? 'افحص التنفس' : 'Examine breathing',
      circulation: language === 'ar' ? 'افحص الدورة الدموية' : 'Examine circulation',
      neuro: language === 'ar' ? 'اعمل neurologic exam' : 'Perform a neurologic exam',
      abdomen: language === 'ar' ? 'افحص البطن' : 'Examine the abdomen',
      chest: language === 'ar' ? 'افحص أصوات الصدر' : 'Examine the chest / breath sounds',
      cardiac: language === 'ar' ? 'افحص القلب والدوران' : 'Examine the cardiac findings',
      pelvis: language === 'ar' ? 'افحص النزف/الرحم' : 'Assess obstetric / pelvic findings'
    };
    return labels[target];
  }

  private investigationLabel(target: ClinicalInvestigationId, language: SimulationScenarioConfig['language']) {
    const labels: Record<ClinicalInvestigationId, string> = {
      cbc: 'Request CBC',
      cmp: 'Request CMP',
      bmp: 'Request BMP',
      lft: 'Request LFT',
      rft: 'Request RFT',
      glucose: language === 'ar' ? 'اطلب glucose' : 'Check glucose',
      ketones: language === 'ar' ? 'اطلب ketones' : 'Check ketones',
      troponin: 'Request troponin',
      lactate: 'Request lactate',
      'blood-cultures': language === 'ar' ? 'اطلب blood cultures' : 'Obtain blood cultures',
      abg: 'Request ABG',
      ecg: 'Perform ECG',
      'chest-xray': 'Request Chest X-ray',
      'ct-head': 'Request CT head',
      'ct-abdomen': 'Request CT abdomen',
      'pelvic-ultrasound': language === 'ar' ? 'اطلب pelvic ultrasound' : 'Request pelvic ultrasound'
    };
    return labels[target];
  }

  private treatmentLabel(target: ClinicalTreatmentId, language: SimulationScenarioConfig['language']) {
    const labels: Record<ClinicalTreatmentId, string> = {
      oxygen: language === 'ar' ? 'ابدأ أكسجين' : 'Start oxygen',
      'iv-access': language === 'ar' ? 'افتح IV access' : 'Establish IV access',
      monitor: language === 'ar' ? 'فعّل المراقبة المستمرة' : 'Start continuous monitoring',
      nebulizer: language === 'ar' ? 'أعط nebulizer' : 'Give nebulizer therapy',
      steroids: language === 'ar' ? 'ابدأ steroids' : 'Start steroids',
      antibiotics: language === 'ar' ? 'ابدأ antibiotics' : 'Start antibiotics',
      'iv-fluids': language === 'ar' ? 'ابدأ IV fluids' : 'Start IV fluids',
      vasopressors: language === 'ar' ? 'فكّر في vasopressors' : 'Consider vasopressors',
      aspirin: language === 'ar' ? 'أعط aspirin' : 'Give aspirin',
      nitroglycerin: language === 'ar' ? 'أعط nitroglycerin' : 'Give nitroglycerin',
      heparin: language === 'ar' ? 'ابدأ heparin' : 'Start heparin',
      dextrose: language === 'ar' ? 'أعط dextrose' : 'Give dextrose',
      insulin: language === 'ar' ? 'ابدأ insulin' : 'Start insulin',
      epinephrine: language === 'ar' ? 'أعط epinephrine' : 'Give epinephrine',
      suction: language === 'ar' ? 'اعمل suction' : 'Perform suction',
      transfusion: language === 'ar' ? 'ابدأ transfusion' : 'Arrange transfusion',
      oxytocin: language === 'ar' ? 'أعط oxytocin' : 'Give oxytocin',
      analgesia: language === 'ar' ? 'أعط analgesia' : 'Provide analgesia',
      'surgical-consult': language === 'ar' ? 'اطلب surgical consult' : 'Request surgical consult',
      reassess: language === 'ar' ? 'أعد تقييم المريض' : 'Reassess the patient'
    };
    return labels[target];
  }

  private t(language: SimulationScenarioConfig['language'], arabic: string, english: string) {
    return language === 'ar' ? arabic : english;
  }
}
