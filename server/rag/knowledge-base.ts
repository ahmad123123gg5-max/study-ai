import { KnowledgeDocumentSeed } from './types.js';

export const KNOWLEDGE_BASE_SEEDS: KnowledgeDocumentSeed[] = [
  {
    id: 'medical-basic-life-support',
    domain: 'medical',
    title: 'Adult basic life support priorities',
    keywords: ['cpr', 'cardiac arrest', 'aed', 'compressions', 'defibrillation', 'airway', 'breathing'],
    source: {
      id: 'aha-cpr-2020',
      title: 'Highlights of the 2020 American Heart Association Guidelines for CPR and ECC',
      publisher: 'American Heart Association',
      year: 2020,
      url: 'https://cpr.heart.org/en/resuscitation-science/cpr-and-ecc-guidelines/highlights-of-the-2020-aha-guidelines-for-cpr-and-ecc',
      kind: 'guideline'
    },
    chunks: [
      'Basic life support starts with rapid recognition of cardiac arrest, activation of the emergency response system, and immediate high-quality chest compressions. Early defibrillation is a major priority when a shockable rhythm is present, and interruptions in compressions should be kept as short as possible.',
      'High-quality CPR focuses on adequate rate and depth, full chest recoil, and avoiding unnecessary pauses. Team coordination, role clarity, and prompt AED use improve the chance of return of spontaneous circulation and survival.'
    ]
  },
  {
    id: 'medical-sepsis-early-management',
    domain: 'medical',
    title: 'Early sepsis recognition and initial management',
    keywords: ['sepsis', 'infection', 'shock', 'lactate', 'fluids', 'antibiotics', 'resuscitation'],
    source: {
      id: 'ssc-sepsis-2021',
      title: 'Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2021',
      publisher: 'Society of Critical Care Medicine / Intensive Care Medicine',
      year: 2021,
      url: 'https://link.springer.com/article/10.1007/s00134-021-06506-y',
      kind: 'guideline'
    },
    chunks: [
      'Sepsis care depends on early recognition of infection with organ dysfunction, rapid assessment of perfusion, and prompt treatment of the likely source. Clinicians should obtain cultures when feasible without creating major delay, begin appropriate antimicrobials quickly, and reassess the patient repeatedly rather than treating sepsis as a single one-time decision.',
      'Initial resuscitation prioritizes airway and circulation, hemodynamic monitoring, and timely fluid therapy for patients with hypotension or signs of poor perfusion. Ongoing management depends on response to fluids, need for vasopressors, source control, and repeated evaluation of lactate, urine output, and mental status.'
    ]
  },
  {
    id: 'medical-hand-hygiene',
    domain: 'medical',
    title: 'Hand hygiene and infection prevention',
    keywords: ['hand hygiene', 'infection prevention', 'patient safety', 'asepsis', 'cross contamination'],
    source: {
      id: 'who-hand-hygiene',
      title: 'WHO Guidelines on Hand Hygiene in Health Care',
      publisher: 'World Health Organization',
      year: 2009,
      url: 'https://www.who.int/publications/i/item/9789241597906',
      kind: 'guideline'
    },
    chunks: [
      'Hand hygiene is one of the strongest measures for reducing healthcare-associated infection. It is performed at key moments before patient contact, before clean or aseptic procedures, after body fluid exposure risk, after patient contact, and after contact with the patient environment.',
      'Effective infection prevention requires matching the method to the context: alcohol-based hand rub for most routine decontamination and soap with water when hands are visibly soiled or exposure circumstances require washing. Compliance improves when workflow, reminders, training, and institutional culture all support the behavior.'
    ]
  },
  {
    id: 'nursing-process-adpie',
    domain: 'nursing',
    title: 'The nursing process',
    keywords: ['nursing process', 'assessment', 'diagnosis', 'planning', 'implementation', 'evaluation', 'care plan'],
    source: {
      id: 'statpearls-nursing-process',
      title: 'Nursing Process',
      publisher: 'NCBI Bookshelf / StatPearls',
      year: 2023,
      url: 'https://www.ncbi.nlm.nih.gov/books/NBK499937/',
      kind: 'reference'
    },
    chunks: [
      'The nursing process is a structured clinical reasoning cycle that commonly follows assessment, diagnosis, planning, implementation, and evaluation. It helps nurses gather data, identify patient needs, choose priorities, document goals, and measure whether interventions actually improved the situation.',
      'A strong nursing care plan links assessment findings to nursing diagnoses, measurable outcomes, and specific interventions. Evaluation is not an afterthought; it closes the loop and determines whether the plan should be continued, modified, escalated, or stopped.'
    ]
  },
  {
    id: 'nursing-prioritization',
    domain: 'nursing',
    title: 'Nursing prioritization and safety framing',
    keywords: ['prioritization', 'abc', 'airway', 'breathing', 'circulation', 'safety', 'delegation', 'urgent'],
    source: {
      id: 'statpearls-nursing-process-priority',
      title: 'Nursing Process',
      publisher: 'NCBI Bookshelf / StatPearls',
      year: 2023,
      url: 'https://www.ncbi.nlm.nih.gov/books/NBK499937/',
      kind: 'reference'
    },
    chunks: [
      'When several patient needs compete at once, nurses usually prioritize physiologic stability first. Airway, breathing, circulation, acute neurological change, severe bleeding, and rapidly worsening infection generally move ahead of routine teaching or long-term planning tasks.',
      'Safe prioritization also considers what can be delegated, what requires direct assessment by the nurse, and which changes create immediate harm if missed. Good prioritization is dynamic: it changes as the patient responds, deteriorates, or new information becomes available.'
    ]
  },
  {
    id: 'science-scientific-method',
    domain: 'science',
    title: 'Scientific method and experimental reasoning',
    keywords: ['scientific method', 'hypothesis', 'experiment', 'variables', 'evidence', 'observation', 'analysis'],
    source: {
      id: 'openstax-biology-2e',
      title: 'Biology 2e',
      publisher: 'OpenStax',
      year: 2018,
      url: 'https://openstax.org/details/books/biology-2e',
      kind: 'textbook'
    },
    chunks: [
      'Scientific reasoning usually starts with observation, question formation, and a hypothesis that can be tested. Good experiments separate variables, define measurements clearly, and allow the hypothesis to be challenged rather than protected from evidence.',
      'Scientific explanations become stronger when they are reproducible, measured carefully, and interpreted in light of limitations. A conclusion should follow from the data collected and should distinguish between what the evidence supports directly and what still remains uncertain.'
    ]
  },
  {
    id: 'science-homeostasis',
    domain: 'science',
    title: 'Homeostasis and biological regulation',
    keywords: ['homeostasis', 'feedback', 'physiology', 'regulation', 'internal environment', 'negative feedback'],
    source: {
      id: 'openstax-anatomy-physiology-2e',
      title: 'Anatomy and Physiology 2e',
      publisher: 'OpenStax',
      year: 2019,
      url: 'https://openstax.org/details/books/anatomy-and-physiology-2e',
      kind: 'textbook'
    },
    chunks: [
      'Homeostasis refers to the maintenance of relatively stable internal conditions despite changes in the external or internal environment. Biological control systems often rely on feedback loops, especially negative feedback, to keep variables such as temperature, glucose, and blood pressure within workable ranges.',
      'A homeostatic explanation usually identifies the variable being regulated, the sensors that detect change, the control center that interprets the signal, and the effectors that act to restore balance. Disease often appears when one part of that loop fails or is overwhelmed.'
    ]
  },
  {
    id: 'science-chemistry-foundations',
    domain: 'science',
    title: 'Chemistry foundations for matter and measurement',
    keywords: ['chemistry', 'matter', 'atom', 'molecule', 'measurement', 'units', 'precision', 'accuracy'],
    source: {
      id: 'openstax-chemistry-2e',
      title: 'Chemistry 2e',
      publisher: 'OpenStax',
      year: 2019,
      url: 'https://openstax.org/details/books/chemistry-2e',
      kind: 'textbook'
    },
    chunks: [
      'Chemistry studies matter, composition, structure, properties, and change. Accurate chemical reasoning depends on careful observation, correct use of units, and clear distinction between measured data, calculated values, and explanatory models.',
      'Precision describes consistency of repeated measurements, while accuracy describes closeness to the accepted value. Good chemical explanations connect particle-level models to observable behavior without confusing the model itself with the direct measurement.'
    ]
  },
  {
    id: 'engineering-cybersecurity-framework',
    domain: 'engineering',
    title: 'Cybersecurity risk management functions',
    keywords: ['cybersecurity', 'govern', 'identify', 'protect', 'detect', 'respond', 'recover', 'risk'],
    source: {
      id: 'nist-csf-2',
      title: 'The NIST Cybersecurity Framework 2.0',
      publisher: 'National Institute of Standards and Technology',
      year: 2024,
      url: 'https://www.nist.gov/cyberframework',
      kind: 'standard'
    },
    chunks: [
      'The NIST Cybersecurity Framework organizes cybersecurity work into govern, identify, protect, detect, respond, and recover. The framework is not a checklist to copy blindly; it is a structure for understanding risk, assigning responsibilities, and improving controls over time.',
      'A strong engineering response aligns technical safeguards with governance, asset awareness, detection capability, incident response, and recovery planning. Decisions should reflect organizational context, critical services, likely threats, and the impact of failure.'
    ]
  },
  {
    id: 'engineering-incident-response',
    domain: 'engineering',
    title: 'Incident response life cycle',
    keywords: ['incident response', 'preparation', 'detection', 'analysis', 'containment', 'eradication', 'recovery', 'lessons learned'],
    source: {
      id: 'nist-sp-800-61r3',
      title: 'Incident Response Recommendations and Considerations for Cybersecurity Risk Management',
      publisher: 'National Institute of Standards and Technology',
      year: 2025,
      url: 'https://www.nist.gov/publications/incident-response-recommendations-and-considerations-cybersecurity-risk-management',
      kind: 'standard'
    },
    chunks: [
      'Incident response is strongest when preparation exists before the event: roles, communication paths, logging, escalation criteria, and access to evidence. Detection and analysis should establish what happened, how confident the team is, what assets are affected, and what needs immediate protection.',
      'Containment, eradication, and recovery should be sequenced according to operational risk. Teams should preserve evidence, reduce further damage, restore service deliberately, and document lessons learned so the same failure mode does not repeat.'
    ]
  },
  {
    id: 'engineering-systems-engineering',
    domain: 'engineering',
    title: 'Systems engineering life cycle thinking',
    keywords: ['systems engineering', 'requirements', 'verification', 'validation', 'integration', 'tradeoffs', 'lifecycle'],
    source: {
      id: 'nasa-se-handbook',
      title: 'NASA Systems Engineering Handbook',
      publisher: 'NASA',
      year: 2017,
      url: 'https://www.nasa.gov/reference/systems-engineering-handbook/',
      kind: 'handbook'
    },
    chunks: [
      'Systems engineering treats a project as an interconnected whole rather than a pile of separate components. Requirements definition, architecture, interfaces, integration, verification, validation, and operations must be connected from the start because weakness in one stage propagates into the rest.',
      'Good systems engineering balances performance, cost, schedule, safety, reliability, and maintainability. Verification asks whether the design was built right against requirements, while validation asks whether the right system was built for the mission or user need.'
    ]
  },
  {
    id: 'legal-negligence',
    domain: 'legal',
    title: 'Negligence framework',
    keywords: ['negligence', 'duty', 'breach', 'causation', 'damages', 'tort', 'liability'],
    source: {
      id: 'cornell-wex-negligence',
      title: 'Negligence',
      publisher: 'Legal Information Institute, Cornell Law School',
      year: 2025,
      url: 'https://www.law.cornell.edu/wex/negligence',
      kind: 'framework'
    },
    chunks: [
      'Negligence analysis usually asks whether a duty of care existed, whether that duty was breached, whether the breach caused the injury in a legally meaningful way, and whether actual damages resulted. The elements must connect logically; a weak link in duty, breach, causation, or damages can defeat the claim.',
      'Legal analysis should separate factual causation from broader policy or proximate causation questions. It should also distinguish negligence from intentional torts, strict liability, and mere unfortunate outcomes that do not by themselves prove breach.'
    ]
  },
  {
    id: 'legal-evidence-relevance-hearsay',
    domain: 'legal',
    title: 'Evidence relevance, prejudice, and hearsay basics',
    keywords: ['evidence', 'relevance', 'probative', 'prejudice', 'hearsay', 'rule 401', 'rule 403', 'rule 801', 'rule 802'],
    source: {
      id: 'federal-rules-evidence',
      title: 'Federal Rules of Evidence',
      publisher: 'United States Courts',
      year: 2025,
      url: 'https://www.uscourts.gov/rules-policies/current-rules-practice-procedure/federal-rules-evidence',
      kind: 'framework'
    },
    chunks: [
      'Evidence is generally relevant when it has some tendency to make a fact of consequence more or less probable. Even relevant evidence can face exclusion when the risk of unfair prejudice, confusion, delay, or waste substantially outweighs its probative value.',
      'Hearsay is usually an out-of-court statement offered to prove the truth of what it asserts, and the basic rule is exclusion unless an exemption or exception applies. Good legal reasoning identifies why the statement is being offered before labeling it hearsay.'
    ]
  }
];
