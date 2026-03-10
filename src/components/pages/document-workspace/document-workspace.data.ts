export interface DemoDocumentSection {
  title: string;
  eyebrow: string;
  paragraphs: string[];
  callout?: string;
}

export const DEMO_DOCUMENT_PAGES: DemoDocumentSection[] = [
  {
    eyebrow: 'Advanced Physiology Seminar',
    title: 'Cellular Respiration And Oxygen Delivery',
    paragraphs: [
      'Cellular respiration converts glucose and oxygen into adenosine triphosphate, carbon dioxide, and water. The process is efficient only when oxygen delivery matches metabolic demand.',
      'Hemoglobin affinity changes with temperature, pH, carbon dioxide, and 2,3-BPG. A right shift in the oxyhemoglobin curve helps tissue unloading during exercise or systemic stress.',
      'Students should connect cellular energy production with clinical observations such as fatigue, elevated lactate, or altered mental status when oxygen use is impaired.'
    ],
    callout:
      'Applied example: A septic patient may have adequate oxygen saturation but poor tissue utilization, so lactate remains high despite normal pulse oximetry.'
  },
  {
    eyebrow: 'Immunology Review',
    title: 'Innate And Adaptive Immune Coordination',
    paragraphs: [
      'Innate immunity acts first through barriers, complement, macrophages, and neutrophils. Adaptive immunity follows with antigen-specific B-cell and T-cell responses.',
      'Dendritic cells are critical because they capture antigen, migrate to lymph nodes, and present it to naive T cells with the co-stimulation required for activation.',
      'The strongest study strategy is to track sequence: exposure, recognition, activation, amplification, effector response, and memory formation.'
    ],
    callout:
      'Clinical anchor: Vaccination works by building adaptive memory before a real infection occurs, shortening response time during future exposure.'
  },
  {
    eyebrow: 'Clinical Reasoning Note',
    title: 'Acid Base Balance In Practice',
    paragraphs: [
      'Acid base interpretation begins with pH, then PaCO2, then bicarbonate. The student should decide whether the primary disorder is respiratory or metabolic before checking compensation.',
      'Metabolic acidosis often reflects acid gain, bicarbonate loss, or reduced renal clearance. Respiratory compensation lowers carbon dioxide through faster ventilation.',
      'A useful habit is to attach every lab abnormality to a likely bedside scenario, such as diarrhea, diabetic ketoacidosis, renal failure, or salicylate toxicity.'
    ],
    callout:
      'Practical example: In diabetic ketoacidosis the patient may present with deep rapid breathing, dehydration, high glucose, and an anion gap metabolic acidosis.'
  },
  {
    eyebrow: 'Study Guide',
    title: 'High Retention Review Framework',
    paragraphs: [
      'Use a three-pass reading method: first orient to headings, second identify mechanisms, and third build applied examples in your own language.',
      'When a paragraph feels dense, select only the confusing sentence and ask for explanation or simplification. Targeted help produces better retention than page-level summaries.',
      'During live lectures, keep recording active for the full session while anchoring short notes to the exact passage or concept that needs review later.'
    ],
    callout:
      'Workflow reminder: Read, select, ask, annotate, then convert the answer into a short note you can revisit before exams.'
  }
];

export const STUDY_TRANSLATION_GLOSSARY: Record<string, string> = {
  acid: 'حمض',
  adaptive: 'تكيفي',
  affinity: 'ألفة',
  antigen: 'مستضد',
  balance: 'توازن',
  blood: 'دم',
  bicarbonate: 'بيكربونات',
  carbon: 'كربون',
  cell: 'خلية',
  cellular: 'خلوي',
  clinical: 'سريري',
  compensation: 'تعويض',
  dioxide: 'ثاني أكسيد',
  energy: 'طاقة',
  exercise: 'جهد',
  glucose: 'غلوكوز',
  hemoglobin: 'هيموغلوبين',
  immune: 'مناعي',
  immunity: 'مناعة',
  infection: 'عدوى',
  innate: 'فطري',
  kidney: 'كلوي',
  lactate: 'لاكتات',
  lymph: 'لمف',
  memory: 'ذاكرة',
  metabolic: 'استقلابي',
  oxygen: 'أكسجين',
  patient: 'مريض',
  ph: 'الرقم الهيدروجيني',
  physiology: 'فسيولوجيا',
  practice: 'ممارسة',
  pressure: 'ضغط',
  renal: 'كلوي',
  respiration: 'تنفس',
  response: 'استجابة',
  respiratory: 'تنفسي',
  saturation: 'تشبع',
  septic: 'إنتاني',
  stress: 'إجهاد',
  tissue: 'نسيج',
  utilization: 'استخدام'
};
