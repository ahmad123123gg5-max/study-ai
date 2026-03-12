import { Injectable, inject } from '@angular/core';
import {
  SimulationCaseSummary,
  SimulationPerformanceMetric,
  SimulationScenarioConfig,
  SimulationSessionMeta,
  SimulationTranscriptEntry
} from '../models/virtual-lab.models';
import { SimulationActionParserService } from './simulation-action-parser.service';
import { SpecialtyProfile, SpecialtyProfileService } from './specialty-profile.service';

interface BuildSummaryOptions {
  config: SimulationScenarioConfig;
  profile: SpecialtyProfile;
  sessionMeta: SimulationSessionMeta | null;
  transcript: SimulationTranscriptEntry[];
  score: number;
  status: 'completed' | 'failed';
  closedReason: SimulationCaseSummary['closedReason'];
}

@Injectable({ providedIn: 'root' })
export class SimulationReportService {
  private readonly profiles = inject(SpecialtyProfileService);
  private readonly parser = inject(SimulationActionParserService);

  buildSummary(options: BuildSummaryOptions): SimulationCaseSummary {
    const { config, profile, sessionMeta, transcript, score, status, closedReason } = options;
    const language = config.language;
    const userMoves = transcript.filter((entry) => entry.role === 'user').map((entry) => entry.text.trim()).filter(Boolean);
    const assistantMoves = transcript.filter((entry) => entry.role === 'assistant').map((entry) => entry.text.trim()).filter(Boolean);
    const parsedMoves = userMoves.map((move) => ({ move, parsed: this.parser.parse(move) }));
    const strongActions = parsedMoves
      .filter(({ move, parsed }) => move.split(/\s+/).length >= 5 || parsed.actionFamilies.length >= 2)
      .map(({ move }) => move)
      .slice(0, 4);
    const incorrectActions = parsedMoves
      .filter(({ parsed }) => parsed.wantsOptions || parsed.asksForPause)
      .map(({ move }) => move)
      .slice(0, 4);
    const impactLabel = this.impactLabel(profile, language);
    const recommendationsLabel = this.recommendationsLabel(profile, language);
    const performanceDimensions = this.performanceDimensions(profile, score, language);

    return {
      result: status === 'completed'
        ? (score >= 78 ? 'success' : score >= 55 ? 'partial' : 'deteriorated')
        : (score >= 48 ? 'partial' : 'failure'),
      closedReason,
      title: this.t(language, 'التقرير النهائي للمحاكاة', 'Final Simulation Report'),
      subtitle: sessionMeta?.title || `${profile.displayName[language]}: ${config.scenario}`,
      outcomeLabel: status === 'completed'
        ? (score >= 78 ? this.t(language, 'أداء قوي', 'Strong Outcome') : this.t(language, 'أداء مقبول مع ثغرات', 'Mixed Outcome'))
        : this.t(language, 'الحالة أُغلقت قبل الحسم الكامل', 'The case closed before full control'),
      patientCourse: this.caseTrajectory(profile, config, score, status),
      whatHappened: this.whatHappened(profile, config, sessionMeta, assistantMoves, status, language),
      correctActions: strongActions,
      incorrectActions,
      vitalsImpact: this.impactItems(profile, assistantMoves, score, language),
      educationalAnalysis: this.educationalAnalysis(profile, score, language),
      strengths: this.strengths(profile, parsedMoves, score, language),
      mistakesToAvoid: this.mistakes(profile, parsedMoves, language),
      recommendations: this.recommendations(profile, config, language),
      initialSnapshotLabel: this.t(language, 'بداية المشهد', 'Opening Snapshot'),
      finalSnapshotLabel: this.t(language, 'نهاية المشهد', 'Closing Snapshot'),
      initialSnapshot: this.initialSnapshot(profile, config, sessionMeta, language),
      finalSnapshot: this.finalSnapshot(profile, config, score, status, language),
      correctActionsLabel: this.t(language, 'قرارات قوية', 'Strong Decisions'),
      incorrectActionsLabel: this.t(language, 'قرارات احتاجت إعادة بناء', 'Decisions To Rework'),
      impactLabel,
      recommendationsLabel,
      performanceDimensions,
      score: Math.round(score)
    };
  }

  normalizeSummary(
    candidate: unknown,
    fallback: SimulationCaseSummary,
    profile: SpecialtyProfile,
    language: 'ar' | 'en'
  ): SimulationCaseSummary {
    const raw = candidate && typeof candidate === 'object' ? candidate as Record<string, unknown> : {};
    const performanceDimensions = Array.isArray(raw['performanceDimensions'])
      ? raw['performanceDimensions']
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => ({
          label: this.stringValue(item['label'], language === 'ar' ? 'المعيار' : 'Metric'),
          value: this.stringValue(item['value'], '--'),
          note: typeof item['note'] === 'string' && item['note'].trim() ? item['note'].trim() : undefined
        }))
        .slice(0, 4)
      : fallback.performanceDimensions;

    return {
      ...fallback,
      title: this.stringValue(raw['title'], fallback.title),
      subtitle: this.stringValue(raw['subtitle'], fallback.subtitle),
      outcomeLabel: this.stringValue(raw['outcomeLabel'], fallback.outcomeLabel),
      patientCourse: this.stringValue(raw['patientCourse'], fallback.patientCourse),
      whatHappened: this.stringArray(raw['whatHappened'], fallback.whatHappened),
      correctActions: this.stringArray(raw['correctActions'], fallback.correctActions),
      incorrectActions: this.stringArray(raw['incorrectActions'], fallback.incorrectActions),
      vitalsImpact: this.stringArray(raw['vitalsImpact'], fallback.vitalsImpact),
      educationalAnalysis: this.stringValue(raw['educationalAnalysis'], fallback.educationalAnalysis),
      strengths: this.stringArray(raw['strengths'], fallback.strengths),
      mistakesToAvoid: this.stringArray(raw['mistakesToAvoid'], fallback.mistakesToAvoid),
      recommendations: this.stringArray(raw['recommendations'], fallback.recommendations),
      initialSnapshotLabel: this.stringValue(raw['initialSnapshotLabel'], fallback.initialSnapshotLabel || this.t(language, 'بداية المشهد', 'Opening Snapshot')),
      finalSnapshotLabel: this.stringValue(raw['finalSnapshotLabel'], fallback.finalSnapshotLabel || this.t(language, 'نهاية المشهد', 'Closing Snapshot')),
      initialSnapshot: this.stringArray(raw['initialSnapshot'], fallback.initialSnapshot || []),
      finalSnapshot: this.stringArray(raw['finalSnapshot'], fallback.finalSnapshot || []),
      correctActionsLabel: this.stringValue(raw['correctActionsLabel'], fallback.correctActionsLabel || this.t(language, 'قرارات قوية', 'Strong Decisions')),
      incorrectActionsLabel: this.stringValue(raw['incorrectActionsLabel'], fallback.incorrectActionsLabel || this.t(language, 'قرارات احتاجت إعادة بناء', 'Decisions To Rework')),
      impactLabel: this.stringValue(raw['impactLabel'], fallback.impactLabel || this.impactLabel(profile, language)),
      recommendationsLabel: this.stringValue(raw['recommendationsLabel'], fallback.recommendationsLabel || this.recommendationsLabel(profile, language)),
      performanceDimensions
    };
  }

  private caseTrajectory(profile: SpecialtyProfile, config: SimulationScenarioConfig, score: number, status: 'completed' | 'failed'): string {
    const language = config.language;
    if (status === 'completed' && score >= 78) {
      return this.t(language, `أغلقت المحاكاة بمسار مهني مقنع داخل مجال ${profile.displayName[language]} بعد قرارات متسلسلة حافظت على منطق الحالة.`, `The simulation closed with a convincing professional trajectory in ${profile.displayName.en} after sequential decisions preserved the logic of the case.`);
    }
    if (status === 'completed') {
      return this.t(language, `وصلت إلى نهاية منطقية في ${profile.displayName[language]}، لكن بعض نقاط الضعف بقيت واضحة في التحليل أو الترتيب أو التنفيذ.`, `You reached a defensible end point in ${profile.displayName.en}, but some weaknesses in analysis, sequencing, or execution remained visible.`);
    }
    return this.t(language, `تم إيقاف هذا المسار قبل السيطرة الكاملة على تعقيد الحالة، ما يكشف حاجة إلى دعم تعليمي أو إعادة تنظيم القرار في ${profile.displayName[language]}.`, `This path stopped before the complexity was fully controlled, showing the need for stronger instructional support or decision restructuring in ${profile.displayName.en}.`);
  }

  private whatHappened(
    profile: SpecialtyProfile,
    config: SimulationScenarioConfig,
    sessionMeta: SimulationSessionMeta | null,
    assistantMoves: string[],
    status: 'completed' | 'failed',
    language: 'ar' | 'en'
  ): string[] {
    const highlights = assistantMoves.slice(-3).filter(Boolean);
    return [
      this.t(language, `دخلت الحالة في بيئة ${sessionMeta?.setting || profile.defaultSetting[language]} مع هدف رئيسي هو ${sessionMeta?.objective || profile.roleFrame[language]}.`, `The case opened inside ${sessionMeta?.setting || profile.defaultSetting.en} with a core objective of ${sessionMeta?.objective || profile.roleFrame.en}.`),
      ...highlights.slice(0, 2),
      this.t(language, status === 'completed' ? 'تمت المحافظة على استمرار السيناريو حتى نقطة إغلاق منطقية.' : 'الحالة توقفت قبل الوصول إلى استقرار كامل أو إنهاء مثالي.', status === 'completed' ? 'The scenario remained active until a logical close point.' : 'The case stopped before reaching full stability or an ideal close.')
    ].slice(0, 4);
  }

  private impactItems(profile: SpecialtyProfile, assistantMoves: string[], score: number, language: 'ar' | 'en'): string[] {
    const extracted = assistantMoves
      .filter((line) => line.length > 20)
      .slice(-3);
    if (extracted.length > 0) {
      return extracted;
    }

    return [
      this.t(language, `تأثرت جودة التنفيذ بحسب مستوى ${Math.round(score)} من 100.`, `Execution quality was shaped by the score level of ${Math.round(score)} out of 100.`),
      this.t(language, `ظهر أثر القرار في عناصر ${profile.evaluationRubric.map((item) => item[language]).slice(0, 2).join(this.t(language, ' و', ' and '))}.`, `The consequence of each move appeared through ${profile.evaluationRubric.map((item) => item.en).slice(0, 2).join(' and ')}.`)
    ];
  }

  private educationalAnalysis(profile: SpecialtyProfile, score: number, language: 'ar' | 'en'): string {
    const rubricText = profile.evaluationRubric.map((item) => item[language]).join(this.t(language, '، ', ', '));
    if (score >= 78) {
      return this.t(language, `هذه المحاكاة كافأت وضوح الأولوية ودقة التنفيذ عبر ${rubricText}. التفكير المهني بقي مترابطًا ولم ينزلق إلى قرارات سطحية.`, `This simulation rewarded clear prioritization and disciplined execution across ${rubricText}. The professional reasoning stayed coherent instead of collapsing into superficial moves.`);
    }
    if (score >= 55) {
      return this.t(language, `الأداء كان عمليًا جزئيًا، لكنه احتاج ضبطًا أقوى في ${rubricText}. كانت هناك لحظات جيدة، لكن المنهجية لم تبقَ ثابتة بما يكفي.`, `The performance was partly practical, but it needed stronger control across ${rubricText}. There were good moments, yet the methodology did not remain consistent enough.`);
    }
    return this.t(language, `أظهرت الحالة أن التحدي لم يكن في المعرفة فقط، بل في ترتيب الخطوات وتبريرها ومراجعة أثرها. تحسين ${rubricText} سيغيّر النتيجة بوضوح لاحقًا.`, `The case showed that the challenge was not knowledge alone, but sequencing, justifying, and reassessing actions. Improving ${rubricText} would materially change the outcome next time.`);
  }

  private strengths(
    profile: SpecialtyProfile,
    parsedMoves: Array<{ move: string; parsed: ReturnType<SimulationActionParserService['parse']> }>,
    score: number,
    language: 'ar' | 'en'
  ): string[] {
    const strengths: string[] = [];
    if (parsedMoves.some(({ parsed }) => parsed.actionFamilies.includes('assess'))) {
      strengths.push(this.t(language, 'بدأت من التقييم أو التشخيص بدل القفز مباشرة إلى التنفيذ.', 'You began with assessment or diagnosis instead of jumping straight into execution.'));
    }
    if (parsedMoves.some(({ parsed }) => parsed.actionFamilies.includes('consult'))) {
      strengths.push(this.t(language, 'استخدمت التصعيد أو الاستشارة كأداة داعمة بدل الاستسلام المبكر.', 'You used escalation or consultation as support instead of early surrender.'));
    }
    if (parsedMoves.some(({ parsed }) => parsed.actionFamilies.includes('communicate'))) {
      strengths.push(this.t(language, 'أدخلت التواصل أو التوثيق ضمن القرار بدل إهماله.', 'You included communication or documentation in the decision path.'));
    }
    if (score >= 75) {
      strengths.push(this.t(language, `ظهر تحسن واضح في ${profile.evaluationRubric[0]?.[language] || this.t(language, 'المنهجية', 'methodology')}.`, `Clear strength appeared in ${profile.evaluationRubric[0]?.en || 'methodology'}.`));
    }
    if (strengths.length === 0) {
      strengths.push(this.t(language, 'حافظت على التفاعل مع الحالة بدل تركها دون قرار.', 'You kept engaging with the case instead of abandoning it.'));
    }
    return strengths.slice(0, 4);
  }

  private mistakes(
    profile: SpecialtyProfile,
    parsedMoves: Array<{ move: string; parsed: ReturnType<SimulationActionParserService['parse']> }>,
    language: 'ar' | 'en'
  ): string[] {
    const mistakes: string[] = [];
    if (parsedMoves.some(({ parsed }) => parsed.wantsOptions)) {
      mistakes.push(this.t(language, 'الاعتماد المبكر على الخيارات قد يخفي ضعفًا في بناء القرار المستقل.', 'Early dependence on options can hide weakness in independent decision building.'));
    }
    if (!parsedMoves.some(({ parsed }) => parsed.actionFamilies.includes('assess'))) {
      mistakes.push(this.t(language, 'غياب التقييم الأولي الواضح جعل بعض الخطوات أقل دفاعية مهنيًا.', 'The lack of a clear initial assessment made several steps less professionally defensible.'));
    }
    if (!parsedMoves.some(({ parsed }) => parsed.actionFamilies.includes('monitor') || parsed.actionFamilies.includes('communicate'))) {
      mistakes.push(this.t(language, 'لم يظهر ما يكفي من إعادة التقييم أو التوثيق أو التحقق بعد القرار.', 'There was not enough reassessment, documentation, or verification after decisions.'));
    }
    if (mistakes.length === 0) {
      mistakes.push(this.t(language, `استمر في تقوية ${profile.evaluationRubric.map((item) => item[language]).slice(0, 2).join(this.t(language, ' و', ' and '))}.`, `Keep strengthening ${profile.evaluationRubric.map((item) => item.en).slice(0, 2).join(' and ')}.`));
    }
    return mistakes.slice(0, 4);
  }

  private recommendations(profile: SpecialtyProfile, config: SimulationScenarioConfig, language: 'ar' | 'en'): string[] {
    return [
      this.t(language, `أعد لعب سيناريو مشابه في مجال ${profile.displayName[language]} لكن مع تركيز خاص على ${profile.evaluationRubric[0]?.[language] || this.t(language, 'الأولوية', 'prioritization')}.`, `Replay a similar ${profile.displayName.en} scenario with extra focus on ${profile.evaluationRubric[0]?.en || 'prioritization'}.`),
      this.t(language, `في مستوى ${this.profiles.difficultyLabel(config.difficulty, language)}، راقب كيف تغيّر المعطيات لا كيف تبدأ فقط.`, `At ${this.profiles.difficultyLabel(config.difficulty, language)} level, track how the data evolves rather than only how the case starts.`),
      this.t(language, `قبل القرار القادم، دوّن في ذهنك: ما الأولوية، ما الخطر، وما أثر الخطوة إذا لم تنجح؟`, `Before the next decision, ask: what is the priority, what is the risk, and what happens if the move fails?`)
    ];
  }

  private initialSnapshot(
    profile: SpecialtyProfile,
    config: SimulationScenarioConfig,
    sessionMeta: SimulationSessionMeta | null,
    language: 'ar' | 'en'
  ): string[] {
    return [
      this.t(language, `التخصص: ${profile.displayName[language]}`, `Specialty: ${profile.displayName.en}`),
      this.t(language, `المشهد: ${config.scenario}`, `Scenario: ${config.scenario}`),
      this.t(language, `الدور: ${sessionMeta?.role || profile.personaTitle[language]}`, `Role: ${sessionMeta?.role || profile.personaTitle.en}`),
      this.t(language, `الصعوبة: ${this.profiles.difficultyLabel(config.difficulty, language)}`, `Difficulty: ${this.profiles.difficultyLabel(config.difficulty, language)}`)
    ];
  }

  private finalSnapshot(
    profile: SpecialtyProfile,
    config: SimulationScenarioConfig,
    score: number,
    status: 'completed' | 'failed',
    language: 'ar' | 'en'
  ): string[] {
    return [
      this.t(language, `حالة الإغلاق: ${status === 'completed' ? 'اكتملت المحاكاة' : 'تم إيقاف المسار'}`, `Closure: ${status === 'completed' ? 'Simulation completed' : 'Path stopped'}`),
      this.t(language, `النتيجة الكلية: ${Math.round(score)}/100`, `Overall score: ${Math.round(score)}/100`),
      this.t(language, `أقوى محور ظاهر: ${profile.evaluationRubric[0]?.[language] || this.t(language, 'الأولوية', 'prioritization')}`, `Strongest visible axis: ${profile.evaluationRubric[0]?.en || 'prioritization'}`),
      this.t(language, `المستشار داخل الحالة: ${profile.consultantTitle[language]}`, `In-scenario consultant: ${profile.consultantTitle.en}`)
    ];
  }

  private impactLabel(profile: SpecialtyProfile, language: 'ar' | 'en'): string {
    if (profile.category === 'medical') {
      return this.t(language, 'تأثير القرارات على الحالة', 'Clinical / Scenario Impact');
    }
    if (profile.category === 'business') {
      return this.t(language, 'الأثر التشغيلي والمالي', 'Operational and Financial Impact');
    }
    if (profile.category === 'law') {
      return this.t(language, 'الأثر الإجرائي والقانوني', 'Procedural and Legal Impact');
    }
    return this.t(language, 'أثر القرارات داخل السيناريو', 'Decision Impact Inside the Scenario');
  }

  private recommendationsLabel(profile: SpecialtyProfile, language: 'ar' | 'en'): string {
    if (profile.category === 'medical') {
      return this.t(language, 'النهج المهني الموصى به', 'Recommended Professional Approach');
    }
    return this.t(language, 'توصيات التحسن التالية', 'Next Improvement Recommendations');
  }

  private performanceDimensions(profile: SpecialtyProfile, score: number, language: 'ar' | 'en'): SimulationPerformanceMetric[] {
    const scoring = (offset: number) => `${Math.max(35, Math.min(98, Math.round(score + offset)))}/100`;
    return [
      {
        label: this.t(language, 'السرعة', 'Speed'),
        value: scoring(-4),
        note: this.t(language, 'هل تحركت مبكرًا في اللحظات الحساسة؟', 'Did you move early enough in sensitive moments?')
      },
      {
        label: this.t(language, 'الدقة', 'Accuracy'),
        value: scoring(1),
        note: this.t(language, `تقاس عبر ${profile.evaluationRubric[1]?.[language] || this.t(language, 'جودة القرار', 'decision quality')}.`, `Measured through ${profile.evaluationRubric[1]?.en || 'decision quality'}.`)
      },
      {
        label: this.t(language, 'المنهجية', 'Method'),
        value: scoring(0),
        note: this.t(language, 'هل كان الترتيب منطقيًا ويمكن الدفاع عنه؟', 'Was the sequence logical and defensible?')
      },
      {
        label: this.t(language, 'الاحترافية', 'Professionalism'),
        value: scoring(3),
        note: this.t(language, 'يشمل التوثيق، الاتصال، والتصعيد عند الحاجة.', 'Includes communication, documentation, and escalation when needed.')
      }
    ];
  }

  private stringArray(value: unknown, fallback: string[]): string[] {
    const normalized = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 6)
      : [];
    return normalized.length > 0 ? normalized : fallback;
  }

  private stringValue(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  private t(language: 'ar' | 'en', arabic: string, english: string): string {
    return language === 'ar' ? arabic : english;
  }
}
