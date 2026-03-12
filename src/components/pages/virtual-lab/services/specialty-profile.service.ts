import { Injectable } from '@angular/core';
import {
  PanelType,
  ScenarioDifficulty,
  SimulationScenarioConfig,
  SpecialtyCategory
} from '../models/virtual-lab.models';

type LocalizedText = { ar: string; en: string };

export interface SpecialtyProfile {
  id: string;
  category: SpecialtyCategory;
  aliases: string[];
  displayName: LocalizedText;
  personaTitle: LocalizedText;
  roleFrame: LocalizedText;
  defaultSetting: LocalizedText;
  consultantTitle: LocalizedText;
  panelType: PanelType;
  runtimeMode: 'ai' | 'medical-live';
  monitorPolicy: 'never' | 'contextual' | 'always';
  audioPolicy: 'never' | 'contextual';
  vocabulary: string[];
  evaluationRubric: LocalizedText[];
  scenarioDirections: LocalizedText[];
  variationAxes: LocalizedText[];
  hintStyle: LocalizedText;
}

@Injectable({ providedIn: 'root' })
export class SpecialtyProfileService {
  private readonly profiles: SpecialtyProfile[] = [
    {
      id: 'emergency-critical-care',
      category: 'medical',
      aliases: [
        'emergency', 'er', 'icu', 'or', 'critical care', 'trauma', 'urgent care', 'code blue',
        'طوارئ', 'عناية مركزة', 'عنايه مركزه', 'غرفه عمليات', 'عمليات', 'انعاش', 'حرجه'
      ],
      displayName: { ar: 'الطوارئ والعناية الحرجة', en: 'Emergency and Critical Care' },
      personaTitle: { ar: 'مدرب محاكاة سريرية حرجة', en: 'Critical-care simulation coach' },
      roleFrame: { ar: 'تصرف كمشرف سريري يراقب الأولويات تحت الضغط', en: 'Act like a supervising clinician under live pressure' },
      defaultSetting: { ar: 'بيئة رعاية حادة بقرارات تتغير خلال ثوانٍ', en: 'A high-acuity environment where decisions shift within seconds' },
      consultantTitle: { ar: 'الاستشاري المناوب', en: 'On-call consultant' },
      panelType: 'medical-monitor',
      runtimeMode: 'medical-live',
      monitorPolicy: 'always',
      audioPolicy: 'contextual',
      vocabulary: ['abc', 'airway', 'hemodynamics', 'monitor', 'escalation', 'reassess'],
      evaluationRubric: [
        { ar: 'ترتيب الأولويات', en: 'Prioritization' },
        { ar: 'سلامة التدخل', en: 'Intervention safety' },
        { ar: 'إعادة التقييم', en: 'Reassessment' },
        { ar: 'التصعيد في الوقت المناسب', en: 'Timely escalation' }
      ],
      scenarioDirections: [
        { ar: 'تدهور تدريجي حقيقي وليس قفزات مصطنعة', en: 'Progressive deterioration rather than fake jumps' },
        { ar: 'قرارات متسلسلة تؤثر مباشرة في المؤشرات', en: 'Sequential decisions must shape live indicators' }
      ],
      variationAxes: [
        { ar: 'حِدة الحالة', en: 'Severity' },
        { ar: 'الاستجابة للعلاج', en: 'Response to treatment' },
        { ar: 'ضغط الوقت', en: 'Time pressure' }
      ],
      hintStyle: { ar: 'قدّم خيارات عملية غير مباشرة مع احتمال وجود خيارات مضللة', en: 'Offer plausible options without giving away the answer' }
    },
    {
      id: 'nursing-medicine',
      category: 'medical',
      aliases: [
        'nursing', 'nurse', 'medicine', 'medical', 'internal medicine', 'pediatrics', 'obgyn', 'midwifery',
        'تمريض', 'طب', 'باطنه', 'اطفال', 'نساء', 'قباله'
      ],
      displayName: { ar: 'التمريض والطب السريري', en: 'Clinical Nursing and Medicine' },
      personaTitle: { ar: 'مدرب سريري واقعي', en: 'Clinical practice coach' },
      roleFrame: { ar: 'وجّه الطالب كما يفعل مشرف سريري في وردية حقيقية', en: 'Guide the learner like a supervising clinician on a real shift' },
      defaultSetting: { ar: 'وحدة رعاية أو عيادة بسرير حالة وتحديثات مهنية واقعية', en: 'A ward or clinic with realistic bedside updates' },
      consultantTitle: { ar: 'الطبيب المشرف', en: 'Supervising physician' },
      panelType: 'operations-board',
      runtimeMode: 'ai',
      monitorPolicy: 'contextual',
      audioPolicy: 'contextual',
      vocabulary: ['assessment', 'orders', 'differential', 'handoff', 'documentation', 'safety'],
      evaluationRubric: [
        { ar: 'التقييم السريري', en: 'Clinical assessment' },
        { ar: 'منهجية القرار', en: 'Decision methodology' },
        { ar: 'السلامة والاتصال', en: 'Safety and communication' },
        { ar: 'الدقة المهنية', en: 'Professional accuracy' }
      ],
      scenarioDirections: [
        { ar: 'ادمج تاريخ الحالة والنتائج والتفكير السريري', en: 'Blend history, results, and clinical reasoning' },
        { ar: 'اسمح بتصحيح المسار قبل إنهاء الحالة', en: 'Allow recovery after mistakes before closing the case' }
      ],
      variationAxes: [
        { ar: 'مكان الرعاية', en: 'Care setting' },
        { ar: 'تعقيد الحالة', en: 'Case complexity' },
        { ar: 'تعدد التشخيصات التفريقية', en: 'Differential overlap' }
      ],
      hintStyle: { ar: 'قدّم تلميحات مرتبطة بالأولوية السريرية التالية لا بالإجابة النهائية', en: 'Hint at the next priority, not the final answer' }
    },
    {
      id: 'pharmacy',
      category: 'medical',
      aliases: ['pharmacy', 'pharmacist', 'pharmacology', 'صيدلة', 'دواء', 'ادويه'],
      displayName: { ar: 'الصيدلة', en: 'Pharmacy' },
      personaTitle: { ar: 'مدرب صيدلة سريرية', en: 'Clinical pharmacy coach' },
      roleFrame: { ar: 'ركّز على الجرعات والتداخلات والتحقق الصارم', en: 'Focus on dosing, interactions, and verification discipline' },
      defaultSetting: { ar: 'صيدلية أو مراجعة علاجية مرتبطة بحالة حقيقية', en: 'A pharmacy or medication review tied to a real case' },
      consultantTitle: { ar: 'الصيدلي الأقدم', en: 'Senior pharmacist' },
      panelType: 'science-chart',
      runtimeMode: 'ai',
      monitorPolicy: 'never',
      audioPolicy: 'never',
      vocabulary: ['dose', 'interaction', 'contraindication', 'renal dosing', 'verification', 'reconciliation'],
      evaluationRubric: [
        { ar: 'سلامة الجرعة', en: 'Dose safety' },
        { ar: 'فهم التداخلات', en: 'Interaction awareness' },
        { ar: 'التحقق من الموانع', en: 'Contraindication checking' },
        { ar: 'التوثيق والتثقيف', en: 'Documentation and counseling' }
      ],
      scenarioDirections: [
        { ar: 'اسمح بحسابات وتركيزات ووحدات حقيقية', en: 'Allow real calculations, concentrations, and unit conversions' },
        { ar: 'بيّن أثر الخطأ الحسابي بشكل مهني', en: 'Show the professional consequence of a calculation mistake' }
      ],
      variationAxes: [
        { ar: 'وزن المريض أو عمره', en: 'Weight or age' },
        { ar: 'وظيفة الكلى أو الكبد', en: 'Renal or hepatic status' },
        { ar: 'تعدد الأدوية', en: 'Polypharmacy' }
      ],
      hintStyle: { ar: 'ساعد الطالب على مراجعة المعطيات التي يجب أن تدخل في الحساب', en: 'Help the learner revisit the factors that must enter the calculation' }
    },
    {
      id: 'dentistry-allied-health',
      category: 'medical',
      aliases: [
        'dentistry', 'dental', 'physical therapy', 'occupational therapy', 'radiology', 'medical laboratory',
        'respiratory therapy', 'nutrition', 'public health', 'veterinary', 'psychology', 'dentist',
        'اسنان', 'علاج طبيعي', 'علاج وظيفي', 'اشعه', 'مختبر', 'تنفس', 'تغذيه', 'صحه عامه', 'طب بيطري', 'نفسي'
      ],
      displayName: { ar: 'التخصصات الصحية التطبيقية', en: 'Applied Health Professions' },
      personaTitle: { ar: 'مدرب مهني تطبيقي', en: 'Applied practice coach' },
      roleFrame: { ar: 'ابنِ الحالة حول التقييم المهني وخطة التنفيذ والمتابعة', en: 'Build the case around assessment, execution, and follow-up' },
      defaultSetting: { ar: 'بيئة تخصصية عملية مرتبطة بعميل أو مريض أو عينة', en: 'A specialty environment centered on a client, patient, or specimen' },
      consultantTitle: { ar: 'المشرف السريري', en: 'Clinical supervisor' },
      panelType: 'operations-board',
      runtimeMode: 'ai',
      monitorPolicy: 'contextual',
      audioPolicy: 'never',
      vocabulary: ['protocol', 'assessment', 'contraindication', 'technique', 'progression', 'follow-up'],
      evaluationRubric: [
        { ar: 'جودة التقييم', en: 'Assessment quality' },
        { ar: 'اختيار التقنية', en: 'Technique selection' },
        { ar: 'السلامة المهنية', en: 'Professional safety' },
        { ar: 'خطة المتابعة', en: 'Follow-up planning' }
      ],
      scenarioDirections: [
        { ar: 'اجعل الأدوات والإجراءات جزءًا من القرار', en: 'Make tools and procedures part of the decision' },
        { ar: 'تجنّب تحويل الحالة إلى أسئلة نظرية فقط', en: 'Avoid turning the case into pure theory' }
      ],
      variationAxes: [
        { ar: 'نوع الحالة', en: 'Case type' },
        { ar: 'الموانع أو المخاطر', en: 'Risks or contraindications' },
        { ar: 'الاستجابة والمتابعة', en: 'Response and follow-up' }
      ],
      hintStyle: { ar: 'لمّح إلى ما يجب فحصه أو استبعاده قبل الإجراء', en: 'Hint at what should be checked or ruled out before acting' }
    },
    {
      id: 'law',
      category: 'law',
      aliases: ['law', 'legal', 'court', 'litigation', 'contract', 'compliance', 'محاماه', 'قانون', 'محكمه', 'دعوى', 'عقد'],
      displayName: { ar: 'القانون', en: 'Law' },
      personaTitle: { ar: 'مشرف قانوني واقعي', en: 'Legal simulation supervisor' },
      roleFrame: { ar: 'تصرّف كأنك شريك مشرف أو قاضٍ أو خصم إجرائي حسب المرحلة', en: 'Behave like a supervising partner, judge, or opposing counsel depending on the moment' },
      defaultSetting: { ar: 'جلسة أو مكتب قانوني بضغوط وقائع واعتراضات وصياغة', en: 'A hearing or legal office with procedural and drafting pressure' },
      consultantTitle: { ar: 'الشريك المشرف', en: 'Supervising partner' },
      panelType: 'law-evidence',
      runtimeMode: 'ai',
      monitorPolicy: 'never',
      audioPolicy: 'never',
      vocabulary: ['issue spotting', 'objection', 'foundation', 'precedent', 'burden', 'strategy'],
      evaluationRubric: [
        { ar: 'تحليل الوقائع', en: 'Fact analysis' },
        { ar: 'تحديد الإشكاليات القانونية', en: 'Issue spotting' },
        { ar: 'قوة الصياغة أو الاعتراض', en: 'Drafting or objection strength' },
        { ar: 'الاستراتيجية الإجرائية', en: 'Procedural strategy' }
      ],
      scenarioDirections: [
        { ar: 'اجعل لكل خطوة تبعات إجرائية واضحة', en: 'Give each move a clear procedural consequence' },
        { ar: 'يمكن للاستشارة أن تعطي دفعًا لكن لا تحل الملف وحدها', en: 'Consultation may guide the learner but must not solve the matter alone' }
      ],
      variationAxes: [
        { ar: 'مرحلة القضية', en: 'Case stage' },
        { ar: 'قوة الأدلة', en: 'Strength of evidence' },
        { ar: 'هدف الخصم', en: 'Opponent strategy' }
      ],
      hintStyle: { ar: 'قدّم اعتراضات أو دفوعًا محتملة متفاوتة القوة', en: 'Offer possible objections or defenses with mixed strength' }
    },
    {
      id: 'engineering-architecture',
      category: 'operations',
      aliases: [
        'engineering', 'civil', 'architectural', 'electrical', 'mechanical', 'industrial', 'construction', 'site', 'architecture',
        'هندسه', 'مدني', 'معماري', 'كهرباء', 'ميكانيك', 'صناعي', 'موقع', 'انشاءات', 'عماره'
      ],
      displayName: { ar: 'الهندسة والعمارة', en: 'Engineering and Architecture' },
      personaTitle: { ar: 'مشرف مشروع ومحاكاة موقع', en: 'Project and site simulation coach' },
      roleFrame: { ar: 'حوّل الحالة إلى قرار تصميم أو تنفيذ أو سلامة مدعوم بالأسباب', en: 'Turn the case into a design, execution, or safety decision backed by reasons' },
      defaultSetting: { ar: 'موقع عمل أو مراجعة مخططات أو تحقيق فشل تقني', en: 'A job site, drawing review, or technical failure investigation' },
      consultantTitle: { ar: 'المهندس الأقدم', en: 'Senior engineer' },
      panelType: 'operations-board',
      runtimeMode: 'ai',
      monitorPolicy: 'never',
      audioPolicy: 'never',
      vocabulary: ['load path', 'code compliance', 'tolerance', 'root cause', 'site safety', 'trade-off'],
      evaluationRubric: [
        { ar: 'تشخيص السبب', en: 'Cause diagnosis' },
        { ar: 'سلامة القرار', en: 'Decision safety' },
        { ar: 'الالتزام بالكود أو المواصفة', en: 'Code/spec compliance' },
        { ar: 'منطق التنفيذ', en: 'Execution logic' }
      ],
      scenarioDirections: [
        { ar: 'اجعل المخاطر والسلامة والكلفة والوقت متداخلة', en: 'Blend safety, cost, schedule, and technical risk' },
        { ar: 'اسمح بتحليل رسومات أو أحمال أو تسلسل تنفيذ', en: 'Allow analysis of drawings, loads, or execution sequence' }
      ],
      variationAxes: [
        { ar: 'مرحلة المشروع', en: 'Project phase' },
        { ar: 'مصدر الخلل', en: 'Failure source' },
        { ar: 'قيود الموقع أو الميزانية', en: 'Site or budget constraints' }
      ],
      hintStyle: { ar: 'قدّم بدائل تنفيذ أو تصميم وبعضها غير آمن أو غير اقتصادي', en: 'Offer design or execution alternatives, some unsafe or uneconomic' }
    },
    {
      id: 'business-finance',
      category: 'business',
      aliases: [
        'business', 'management', 'marketing', 'accounting', 'finance', 'hr', 'supply chain', 'operations management',
        'اعمال', 'اداره', 'تسويق', 'محاسبه', 'ماليه', 'موارد بشريه', 'سلاسل الامداد'
      ],
      displayName: { ar: 'الأعمال والمالية والإدارة', en: 'Business, Finance, and Management' },
      personaTitle: { ar: 'مدرب قرارات تشغيلية', en: 'Operational decision coach' },
      roleFrame: { ar: 'قِس القرار على الأثر المالي والتشغيلي والبشري معًا', en: 'Judge each move across financial, operational, and human impact' },
      defaultSetting: { ar: 'اجتماع قرار أو أزمة تشغيلية بمؤشرات متعارضة', en: 'A decision room or operational crisis with conflicting metrics' },
      consultantTitle: { ar: 'المدير التنفيذي', en: 'Executive sponsor' },
      panelType: 'business-metrics',
      runtimeMode: 'ai',
      monitorPolicy: 'never',
      audioPolicy: 'never',
      vocabulary: ['margin', 'cash flow', 'forecast', 'stakeholders', 'trade-off', 'execution'],
      evaluationRubric: [
        { ar: 'منطق القرار', en: 'Decision logic' },
        { ar: 'تحليل الأثر', en: 'Impact analysis' },
        { ar: 'إدارة المخاطر', en: 'Risk management' },
        { ar: 'وضوح التنفيذ', en: 'Execution clarity' }
      ],
      scenarioDirections: [
        { ar: 'أظهر مؤشرات متضاربة بدل مسار واضح جدًا', en: 'Show conflicting indicators instead of a single obvious path' },
        { ar: 'دع بعض القرارات السيئة تستمر مع تكلفة لاحقة', en: 'Let some weak decisions continue with delayed cost' }
      ],
      variationAxes: [
        { ar: 'الضغط المالي', en: 'Financial pressure' },
        { ar: 'رد فعل العملاء أو الفريق', en: 'Customer or team response' },
        { ar: 'قيود التنفيذ', en: 'Execution constraints' }
      ],
      hintStyle: { ar: 'قدّم إجراءات محتملة مع مقايضات حقيقية لا حلول مثالية', en: 'Offer plausible moves with real trade-offs, not idealized answers' }
    },
    {
      id: 'computer-science',
      category: 'programming',
      aliases: [
        'computer science', 'software', 'programming', 'developer', 'cybersecurity', 'ai', 'data science',
        'backend', 'frontend', 'devops', 'security', 'برمجه', 'حاسوب', 'امن سيبراني', 'ذكاء اصطناعي', 'علوم بيانات'
      ],
      displayName: { ar: 'علوم الحاسوب والبرمجة', en: 'Computer Science and Software' },
      personaTitle: { ar: 'مدرب استجابة تقنية حية', en: 'Live technical incident coach' },
      roleFrame: { ar: 'اختبر التشخيص، الاحتواء، والجودة الهندسية لا مجرد إصلاح سريع', en: 'Test diagnosis, containment, and engineering judgment instead of a quick fix' },
      defaultSetting: { ar: 'بيئة تشغيل أو مراجعة معمارية أو تحقيق أمني', en: 'A production environment, architecture review, or security investigation' },
      consultantTitle: { ar: 'المهندس الرئيسي', en: 'Principal engineer' },
      panelType: 'programming-console',
      runtimeMode: 'ai',
      monitorPolicy: 'never',
      audioPolicy: 'never',
      vocabulary: ['logs', 'trace', 'rollback', 'architecture', 'blast radius', 'security boundary'],
      evaluationRubric: [
        { ar: 'تشخيص السبب الجذري', en: 'Root cause analysis' },
        { ar: 'تقليل الأثر', en: 'Impact containment' },
        { ar: 'جودة القرار المعماري', en: 'Architectural judgment' },
        { ar: 'سلامة التنفيذ', en: 'Execution safety' }
      ],
      scenarioDirections: [
        { ar: 'اجعل بعض الخطوات مفيدة جزئيًا لكن غير حاسمة', en: 'Some steps should be useful but not decisive' },
        { ar: 'ادمج debugging مع trade-offs أمنية وقابلية التوسع', en: 'Blend debugging with security and scalability trade-offs' }
      ],
      variationAxes: [
        { ar: 'نطاق التأثير', en: 'Blast radius' },
        { ar: 'نوع الفشل', en: 'Failure mode' },
        { ar: 'قيود النشر أو الوقت', en: 'Deployment or time constraints' }
      ],
      hintStyle: { ar: 'اعرض خطوات Debugging متفاوتة الجودة وبعضها قد يخفي السبب الحقيقي', en: 'Show debugging moves of mixed quality, some of which may hide the real cause' }
    },
    {
      id: 'education-training',
      category: 'operations',
      aliases: ['education', 'teaching', 'teacher', 'classroom', 'curriculum', 'تعليم', 'تدريس', 'صف', 'منهاج', 'معلم'],
      displayName: { ar: 'التعليم والتدريب', en: 'Education and Teaching' },
      personaTitle: { ar: 'مشرف ملاحظة صفية', en: 'Classroom simulation supervisor' },
      roleFrame: { ar: 'اجعل القرارات مرتبطة بإدارة الصف، التشخيص التعليمي، وتعديل الخطة', en: 'Tie decisions to classroom management, learning diagnosis, and lesson adjustment' },
      defaultSetting: { ar: 'صف أو جلسة تدريبية مع سلوك طلابي وأهداف تعلم حية', en: 'A classroom or training room with live learner behavior and goals' },
      consultantTitle: { ar: 'المعلم المشرف', en: 'Mentor teacher' },
      panelType: 'operations-board',
      runtimeMode: 'ai',
      monitorPolicy: 'never',
      audioPolicy: 'never',
      vocabulary: ['engagement', 'scaffolding', 'differentiation', 'behavior', 'assessment', 'feedback'],
      evaluationRubric: [
        { ar: 'إدارة الصف', en: 'Classroom management' },
        { ar: 'اختيار الاستراتيجية', en: 'Strategy selection' },
        { ar: 'قياس الفهم', en: 'Understanding checks' },
        { ar: 'التكيف مع الطلاب', en: 'Learner adaptation' }
      ],
      scenarioDirections: [
        { ar: 'اسمح بتعديل الخطة أثناء الدرس', en: 'Allow lesson-plan adjustment mid-session' },
        { ar: 'أظهر أثر القرار على الانضباط والفهم معًا', en: 'Show the effect on both behavior and understanding' }
      ],
      variationAxes: [
        { ar: 'مستوى الطلاب', en: 'Student level' },
        { ar: 'السلوك الصفّي', en: 'Behavior pattern' },
        { ar: 'ضغط الوقت أو المنهج', en: 'Time or curriculum pressure' }
      ],
      hintStyle: { ar: 'وجّه الطالب نحو الملاحظة الصفية التالية التي يجب أن يبني عليها قراره', en: 'Nudge the learner toward the next classroom signal that should shape the decision' }
    },
    {
      id: 'design-media-beauty',
      category: 'operations',
      aliases: [
        'design', 'interior design', 'graphic design', 'media', 'journalism', 'beauty', 'cosmetic', 'skincare', 'hair', 'laser', 'aesthetic',
        'تصميم', 'جرافيك', 'داخلي', 'اعلام', 'صحافه', 'تجميل', 'بشره', 'شعر', 'ليزر', 'تجميلي'
      ],
      displayName: { ar: 'التصميم والإعلام والتجميل', en: 'Design, Media, and Beauty' },
      personaTitle: { ar: 'مدرب عميل/مشروع واقعي', en: 'Client-facing simulation coach' },
      roleFrame: { ar: 'اختبر التقييم، التوقعات، التقنية، والتواصل المهني مع العميل أو المشروع', en: 'Test assessment, expectations, technique, and professional communication' },
      defaultSetting: { ar: 'جلسة عميل أو مشروع تنفيذي مع اعتبارات ذوق وسلامة ونتيجة', en: 'A client session or delivery project with outcome, taste, and safety constraints' },
      consultantTitle: { ar: 'الخبير المشرف', en: 'Senior specialist' },
      panelType: 'operations-board',
      runtimeMode: 'ai',
      monitorPolicy: 'never',
      audioPolicy: 'never',
      vocabulary: ['brief', 'fit', 'contraindication', 'consent', 'technique', 'aftercare'],
      evaluationRubric: [
        { ar: 'جودة التقييم الأولي', en: 'Initial assessment quality' },
        { ar: 'اختيار التقنية أو الأسلوب', en: 'Technique/style selection' },
        { ar: 'إدارة التوقعات', en: 'Expectation management' },
        { ar: 'السلامة والمتابعة', en: 'Safety and aftercare' }
      ],
      scenarioDirections: [
        { ar: 'اربط القرار بموانع الاستخدام أو brief العميل عند الحاجة', en: 'Tie the decision to contraindications or the client brief when relevant' },
        { ar: 'اسمح بوجود مخاطر سمعة أو رضا إلى جانب المخاطر التقنية', en: 'Allow reputation or satisfaction risks alongside technical ones' }
      ],
      variationAxes: [
        { ar: 'نوع العميل أو الجمهور', en: 'Client or audience type' },
        { ar: 'الحساسية أو المانع', en: 'Sensitivity or contraindication' },
        { ar: 'الوقت والنتيجة المطلوبة', en: 'Timing and desired outcome' }
      ],
      hintStyle: { ar: 'قدّم إجراءات ممكنة مع اختلاف واضح في السلامة والجودة والملاءمة', en: 'Offer possible actions with visibly different safety, quality, and fit' }
    },
    {
      id: 'hospitality-languages',
      category: 'operations',
      aliases: [
        'hospitality', 'tourism', 'translation', 'languages', 'aviation', 'customer service',
        'ضيافه', 'سياحه', 'ترجمه', 'لغات', 'طيران', 'خدمه عملاء'
      ],
      displayName: { ar: 'الضيافة واللغات والخدمات', en: 'Hospitality, Languages, and Service' },
      personaTitle: { ar: 'مدرب موقف مهني مباشر', en: 'Frontline service simulation coach' },
      roleFrame: { ar: 'قيّم القرار وفق الجودة المهنية والتواصل وحل المشكلة تحت الضغط', en: 'Evaluate the move through professionalism, communication, and problem resolution under pressure' },
      defaultSetting: { ar: 'مكتب خدمة أو موقف تشغيلي مباشر مع عميل أو مسافر أو نص يحتاج دقة', en: 'A service desk or live situation with a client, traveler, or accuracy-sensitive text' },
      consultantTitle: { ar: 'المشرف المناوب', en: 'Duty supervisor' },
      panelType: 'operations-board',
      runtimeMode: 'ai',
      monitorPolicy: 'never',
      audioPolicy: 'never',
      vocabulary: ['escalation', 'service recovery', 'clarity', 'accuracy', 'tone', 'handover'],
      evaluationRubric: [
        { ar: 'وضوح التواصل', en: 'Communication clarity' },
        { ar: 'إدارة الموقف', en: 'Situation handling' },
        { ar: 'الدقة المهنية', en: 'Professional accuracy' },
        { ar: 'الاستجابة للضغط', en: 'Pressure response' }
      ],
      scenarioDirections: [
        { ar: 'دع الموقف يتغير بناء على أسلوب الطالب لا المعلومة فقط', en: 'Let the scene change based on tone and handling, not facts alone' },
        { ar: 'اجعل التصعيد أداة مساعدة لا هروبًا من القرار', en: 'Escalation should assist, not replace judgment' }
      ],
      variationAxes: [
        { ar: 'حدة العميل أو الموقف', en: 'Customer or situation intensity' },
        { ar: 'قيود السياسة أو الوقت', en: 'Policy or time constraints' },
        { ar: 'الحاجة إلى الدقة', en: 'Accuracy requirement' }
      ],
      hintStyle: { ar: 'قدّم مسارات استجابة محتملة وبعضها يبدو مهذبًا لكنه غير فعّال', en: 'Offer response paths where some sound polite but remain ineffective' }
    },
    {
      id: 'general-professional',
      category: 'general',
      aliases: [],
      displayName: { ar: 'محاكاة مهنية عامة', en: 'General Professional Simulation' },
      personaTitle: { ar: 'مدرب مواقف ذكي', en: 'Adaptive scenario coach' },
      roleFrame: { ar: 'حوّل المجال المختار إلى بيئة مهنية محسوسة مع قرارات متتابعة', en: 'Turn the selected field into a tangible professional environment with sequential choices' },
      defaultSetting: { ar: 'بيئة عمل متحركة تحتاج حكمًا عمليًا وتعليلًا جيدًا', en: 'A moving professional environment that needs practical judgment and sound reasoning' },
      consultantTitle: { ar: 'المشرف الخبير', en: 'Senior supervisor' },
      panelType: 'generic-insights',
      runtimeMode: 'ai',
      monitorPolicy: 'never',
      audioPolicy: 'never',
      vocabulary: ['priority', 'risk', 'sequence', 'impact', 'stakeholder', 'verification'],
      evaluationRubric: [
        { ar: 'وضوح الأولوية', en: 'Priority clarity' },
        { ar: 'جودة التحليل', en: 'Analysis quality' },
        { ar: 'سلامة التنفيذ', en: 'Execution safety' },
        { ar: 'قابلية التبرير', en: 'Defensibility' }
      ],
      scenarioDirections: [
        { ar: 'ابنِ سياقًا مهنيًا حقيقيًا بدل نص عام', en: 'Build a real professional context rather than generic text' },
        { ar: 'اجعل التقييم مرتبطًا بالمجال المختار', en: 'Tie the evaluation directly to the chosen field' }
      ],
      variationAxes: [
        { ar: 'البيئة', en: 'Environment' },
        { ar: 'أصحاب المصلحة', en: 'Stakeholders' },
        { ar: 'درجة الغموض', en: 'Ambiguity level' }
      ],
      hintStyle: { ar: 'قدّم بدائل عملية بوضوح متفاوت ليبقى التفكير مطلوبًا', en: 'Provide practical alternatives of mixed quality so reasoning stays necessary' }
    }
  ];

  resolveProfile(specialty: string, scenario: string = ''): SpecialtyProfile {
    const haystack = this.normalize(`${specialty} ${scenario}`);
    let bestMatch: SpecialtyProfile | null = null;
    let bestScore = 0;

    for (const profile of this.profiles) {
      const score = profile.aliases.reduce((total, alias) => total + (haystack.includes(this.normalize(alias)) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = profile;
      }
    }

    if (bestMatch) {
      return bestMatch;
    }

    if (/(medical|medicine|nurs|clinic|hospital|patient|طب|تمريض|مريض|سريري)/.test(haystack)) {
      return this.profileById('nursing-medicine');
    }
    if (/(engineer|engineering|civil|mechanical|electrical|architecture|هندس|معمار)/.test(haystack)) {
      return this.profileById('engineering-architecture');
    }
    if (/(law|legal|court|contract|قانون|محكم)/.test(haystack)) {
      return this.profileById('law');
    }
    if (/(software|code|program|debug|cyber|api|برمج|كود|سيبراني)/.test(haystack)) {
      return this.profileById('computer-science');
    }
    if (/(business|finance|market|account|hr|supply|اعمال|ادار|مال|محاسب)/.test(haystack)) {
      return this.profileById('business-finance');
    }

    return this.profileById('general-professional');
  }

  categorizeSpecialty(specialty: string, scenario: string = ''): SpecialtyCategory {
    return this.resolveProfile(specialty, scenario).category;
  }

  defaultPanelType(specialty: string, scenario: string = ''): PanelType {
    const profile = this.resolveProfile(specialty, scenario);
    if (profile.monitorPolicy !== 'never' && this.shouldUseMedicalRuntime({ specialty, scenario, difficulty: 'medium', durationMinutes: 10, language: 'en' }, profile)) {
      return 'medical-monitor';
    }
    return profile.panelType;
  }

  difficultyLabel(level: ScenarioDifficulty, language: 'ar' | 'en'): string {
    if (language === 'ar') {
      if (level === 'easy') return 'Beginner';
      if (level === 'medium') return 'Intermediate';
      return 'Advanced';
    }

    if (level === 'easy') return 'Beginner';
    if (level === 'medium') return 'Intermediate';
    return 'Advanced';
  }

  difficultyInstruction(level: ScenarioDifficulty, language: 'ar' | 'en'): string {
    if (language === 'ar') {
      if (level === 'easy') return 'قدّم إشارات واضحة، معلومات مبكرة، وتدهورًا أبطأ يساعد المبتدئ على ترتيب القرار.';
      if (level === 'medium') return 'استخدم غموضًا سريريًا واقعياً مع حاجة لفحص وفحوصات وترتيب أولويات منطقي.';
      return 'اجعل الحالة متعددة الطبقات مع معلومات أقل، مضاعفات أكثر، وتدهور أسرع.';
    }

    if (level === 'easy') return 'Provide clear cues, early structure, and slower deterioration for a beginner-friendly case.';
    if (level === 'medium') return 'Use realistic ambiguity with a balanced need for assessment, investigations, and treatment planning.';
    return 'Build a layered case with less upfront information, more complications, and faster deterioration.';
  }

  totalSteps(level: ScenarioDifficulty, durationMinutes: 5 | 10 | 15 = 10): number {
    const base = level === 'easy' ? 4 : level === 'medium' ? 5 : level === 'hard' ? 6 : 7;
    const durationBonus = durationMinutes === 15 ? 4 : durationMinutes === 10 ? 2 : 0;
    return base + durationBonus;
  }

  shouldUseMedicalRuntime(config: SimulationScenarioConfig, providedProfile?: SpecialtyProfile): boolean {
    const profile = providedProfile || this.resolveProfile(config.specialty, config.scenario);
    const hasLocalReferenceImages = (config.referenceImages?.length || 0) > 0;
    return profile.runtimeMode === 'medical-live' && !hasLocalReferenceImages;
  }

  wantsMonitor(config: SimulationScenarioConfig, providedProfile?: SpecialtyProfile): boolean {
    const profile = providedProfile || this.resolveProfile(config.specialty, config.scenario);
    if (profile.monitorPolicy === 'always') {
      return true;
    }
    if (profile.monitorPolicy === 'never') {
      return false;
    }
    return profile.category === 'medical' || this.shouldUseMedicalRuntime(config, profile);
  }

  consultantLabel(profile: SpecialtyProfile, language: 'ar' | 'en'): string {
    return profile.consultantTitle[language];
  }

  localText(text: LocalizedText, language: 'ar' | 'en'): string {
    return text[language];
  }

  profileById(id: string): SpecialtyProfile {
    return this.profiles.find((profile) => profile.id === id) || this.profiles[this.profiles.length - 1];
  }

  buildPromptContext(profile: SpecialtyProfile, config: SimulationScenarioConfig): string {
    const language = config.language;
    const rubric = profile.evaluationRubric.map((item) => `- ${item[language]}`).join('\n');
    const directions = profile.scenarioDirections.map((item) => `- ${item[language]}`).join('\n');
    const variations = profile.variationAxes.map((item) => `- ${item[language]}`).join('\n');
    const vocab = profile.vocabulary.join(', ');

    return [
      `Resolved specialty profile: ${profile.displayName.en} / ${profile.displayName.ar}.`,
      `Persona: ${profile.personaTitle[language]}.`,
      `Role frame: ${profile.roleFrame[language]}.`,
      `Preferred environment: ${profile.defaultSetting[language]}.`,
      `Consultant title inside the scenario: ${profile.consultantTitle[language]}.`,
      `Difficulty behavior: ${this.difficultyInstruction(config.difficulty, language)}`,
      `Evaluation rubric:\n${rubric}`,
      `Scenario design rules:\n${directions}`,
      `Variation axes to reduce repetition:\n${variations}`,
      `Vocabulary and terminology cues: ${vocab || 'context-specific terminology'}`
    ].join('\n');
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
