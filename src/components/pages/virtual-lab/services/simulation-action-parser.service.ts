import { Injectable } from '@angular/core';

export interface ParsedSimulationAction {
  raw: string;
  normalized: string;
  wantsOptions: boolean;
  wantsTutor: boolean;
  wantsExit: boolean;
  wantsConsultant: boolean;
  wantsDoctor: boolean;
  consultantTarget: string | null;
  asksForStepByStep: boolean;
  asksForPause: boolean;
  actionFamilies: string[];
  mentionsCalculation: boolean;
  mentionsMedication: boolean;
  wantsStop: boolean;
  wantsEscalation: boolean;
  interventionTargets: string[];
}

@Injectable({ providedIn: 'root' })
export class SimulationActionParserService {
  parse(input: string): ParsedSimulationAction {
    const normalized = this.normalize(input);
    const actionFamilies = this.detectActionFamilies(normalized);
    const interventionTargets = this.detectInterventionTargets(normalized);

    return {
      raw: input,
      normalized,
      wantsOptions: this.matches(normalized, [
        'options', 'choices', 'hint', 'help me', 'help', 'possible moves', 'what are the options',
        'اعطني خيارات', 'اعطني خيار', 'ما الخيارات', 'خيارات', 'تلميح', 'ساعدني', 'اعطني اجراءات'
      ]),
      wantsTutor: this.matches(normalized, [
        'stop the case', 'pause the case', 'teach me', 'explain to me', 'i do not understand', 'step by step',
        'اوقف الحاله', 'اوقف الحالة', 'اوقف', 'اشرح لي', 'علمني', 'لا افهم', 'انا لا افهم', 'خطوه بخطوه', 'خطوة بخطوة'
      ]),
      wantsExit: this.matches(normalized, [
        'exit the exam', 'exit the test', 'leave the test', 'leave the exam', 'quit the simulation', 'end the test', 'i want to leave',
        'بدي اطلع', 'اريد الخروج', 'أريد الخروج', 'اخرجني', 'اطلع من الاختبار', 'اخرج من الاختبار', 'انهي الاختبار', 'انسحب من الاختبار', 'بدي اخرج'
      ]),
      wantsConsultant: this.matches(normalized, [
        'consult', 'call senior', 'call supervisor', 'ask attending', 'escalate to', 'review with',
        'استشير', 'استدعي', 'اتصل', 'ارجع الى', 'اشاور', 'اسأل المشرف', 'اطلب المشرف',
        'انادي الطبيب', 'انادي الدكتور', 'استدعي الطبيب', 'اكلم الدكتور', 'اطلب الطبيب', 'اطلب مراجعه الطبيب'
      ]),
      wantsDoctor: this.matches(normalized, [
        'call doctor', 'call the doctor', 'call physician', 'ask the doctor', 'page the doctor', 'call attending',
        'doctor review', 'contact doctor',
        'انادي الطبيب', 'انادي الدكتور', 'استدعي الطبيب', 'استشير الطبيب', 'اكلم الدكتور', 'اطلب مراجعه الطبيب', 'اطلب الطبيب', 'اسال الطبيب'
      ]),
      consultantTarget: this.extractConsultantTarget(normalized),
      asksForStepByStep: this.matches(normalized, [
        'step by step', 'walk me through', 'guide me', 'help me understand',
        'خطوه بخطوه', 'خطوة بخطوة', 'امش معي', 'وجّهني', 'علمني'
      ]),
      asksForPause: this.matches(normalized, [
        'pause', 'stop the case', 'hold the scenario',
        'اوقف', 'وقف', 'ايقاف', 'جمّد الحاله', 'جمد الحالة'
      ]),
      actionFamilies,
      mentionsCalculation: /\b(\d+(\.\d+)?\s*(mg|mcg|ml|kg|g|units|iu|mm|cm|m2|m3|usd|%|hrs?|hours?))\b/.test(normalized)
        || /(dose|dosage|calc|calculate|rate|ratio|budget|load|area|جرعه|جرعة|احسب|حساب|معدل|نسبه|نسبة|حموله|حمولة)/.test(normalized),
      mentionsMedication: /(medication|medicine|drug|dose|dosage|diazepam|midazolam|salbutamol|adrenaline|epinephrine|morphine|insulin|paracetamol|دواء|علاج|جرعه|جرعة|ادويه|ادوية|ديازيبام|ميدازولام|سالبيوتامول|مورفين|انسولين)/.test(normalized),
      wantsStop: /(stop|remove|discontinue|hold|turn off|وقف|اوقف|شيل|ازل|ازاله|افصل|الغي)/.test(normalized),
      wantsEscalation: /(escalate|increase|raise|higher|upscale|upgrade|تصعيد|صعّد|صعد|زود|ارفع|اعلى|اعلي|non rebreather|high flow)/.test(normalized),
      interventionTargets
    };
  }

  private detectActionFamilies(normalized: string): string[] {
    const families: Array<[string, RegExp]> = [
      ['assess', /(assess|evaluate|review|inspect|analyze|فحص|اقيم|أقيم|راجع|حلل|حلل)/],
      ['intervene', /(start|give|administer|apply|fix|treat|deploy|نفذ|ابدأ|اعطي|أعطي|اصلح|عالج)/],
      ['monitor', /(monitor|reassess|follow up|watch|observe|راقب|اعاده تقييم|إعادة تقييم|تابع)/],
      ['communicate', /(explain|inform|counsel|document|brief|اشرح|ابلغ|وثق|بلّغ|بلغ)/],
      ['consult', /(consult|call|escalate|supervisor|senior|استشير|استدعي|اشاور|مشرف|اقدم)/],
      ['calculate', /(calculate|dose|rate|ratio|budget|area|load|احسب|جرعه|جرعة|معدل|مساحه|مساحة|حموله|حمولة)/],
      ['medicate', /(medication|medicine|drug|diazepam|midazolam|salbutamol|دواء|علاج|جرعه|جرعة|ديازيبام|ميدازولام)/]
    ];

    return families
      .filter(([, pattern]) => pattern.test(normalized))
      .map(([family]) => family);
  }

  private detectInterventionTargets(normalized: string): string[] {
    const targets: Array<[string, RegExp]> = [
      ['oxygen', /(oxygen|o2|nasal cannula|cannula|venturi|mask|non rebreather|high flow|اكسجين|اكسجن|قنيه|قنية|كانيولا|كانيولا اكسجين|قناع|ماسك)/],
      ['iv-access', /(iv|intravenous|venous line|iv line|cannula|وريدي|وريديه|وريدية|خط وريدي|كانيولا وريديه|كانيولا وريدية)/],
      ['iv-fluids', /(fluid|fluids|bolus|saline|ringer|normal saline|ns|محلول|سوائل|رينجر|سالين)/],
      ['monitoring', /(monitor|monitoring|pulse ox|spo2|bp|telemetry|ecg monitor|مونيتور|مراقبه|مراقبة|ساتوريشن|ضغط|نبض)/],
      ['suction', /(suction|شفط)/],
      ['airway', /(airway|jaw thrust|head tilt|position|reposition|مجرى|مجرى الهواء|وضعيه|وضعية|رفع الراس|فتح مجرى)/],
      ['ecg', /(ecg|ekg|rhythm strip|telemetry|تخطيط|رسم قلب|نظم القلب)/],
      ['medication', /(medication|medicine|drug|dose|dosage|diazepam|midazolam|salbutamol|دواء|علاج|جرعه|جرعة|ديازيبام|ميدازولام|سالبيوتامول)/]
    ];

    return targets
      .filter(([, pattern]) => pattern.test(normalized))
      .map(([label]) => label);
  }

  private extractConsultantTarget(normalized: string): string | null {
    const targets: Array<[RegExp, string]> = [
      [/(doctor|attending|physician|dr\b|دكتور|طبيب)/, 'doctor'],
      [/(engineer|architect|مهندس|معماري)/, 'engineer'],
      [/(lawyer|partner|counsel|محامي|شريك)/, 'lawyer'],
      [/(manager|director|مدير)/, 'manager'],
      [/(teacher|mentor|معلم|مدرب)/, 'teacher'],
      [/(pharmacist|صيدلي)/, 'pharmacist'],
      [/(technician|tech|فني)/, 'technician']
    ];

    for (const [pattern, label] of targets) {
      if (pattern.test(normalized)) {
        return label;
      }
    }

    return null;
  }

  private matches(normalized: string, patterns: string[]): boolean {
    return patterns.some((pattern) => normalized.includes(this.normalize(pattern)));
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
}
