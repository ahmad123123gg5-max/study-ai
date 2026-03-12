import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AIService } from './ai.service';
import { NotificationService } from './notification.service';
import { LanguageCode } from '../i18n/language-config';

export type FlashcardDifficulty = 'easy' | 'medium' | 'hard';
export type FlashcardReviewState = 'easy' | 'medium' | 'hard' | null;
export type FlashcardType =
  | 'qa'
  | 'definition'
  | 'cause_effect'
  | 'comparison'
  | 'steps'
  | 'true_false'
  | 'application'
  | 'rapid_recall'
  | 'difficult_concept'
  | 'final_review';

export type FlashcardGenerationMode = 'standard' | 'more' | 'simplify' | 'strengthen';
export type FlashcardArtifactKind = 'summary' | 'mind_map' | 'difficult_points' | 'study_plan' | 'exam_sprint';

export interface FlashcardItem {
  id: string;
  type: FlashcardType;
  front: string;
  back: string;
  hint?: string;
  difficulty: FlashcardDifficulty;
  tags?: string[];
  sourceSnippet?: string;
  mastered?: boolean;
  reviewState?: FlashcardReviewState;
}

export interface FlashcardLaunchContext {
  sourceText: string;
  sourceType: string;
  sourceTitle?: string;
  conversationId?: string;
  messageId?: string;
  language?: LanguageCode;
  groupName?: string;
  createdAt?: string;
}

export interface FlashcardSetProgress {
  currentCardId: string | null;
  completedCardIds: string[];
  viewedCardIds: string[];
  ratingStats: Record<'easy' | 'medium' | 'hard', number>;
  queue: string[];
}

export interface SavedFlashcardSet {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sourceText: string;
  sourceType: string;
  sourceTitle?: string;
  conversationId?: string;
  messageId?: string;
  language: LanguageCode;
  cards: FlashcardItem[];
  progress: FlashcardSetProgress;
  quizHistory: FlashcardQuizAttempt[];
}

interface GeneratedFlashcardPayload {
  setTitle?: string;
  cards?: Partial<FlashcardItem>[];
}

interface FlashcardQuizQuestion {
  id: string;
  cardId?: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
}

export interface FlashcardQuizAttempt {
  id: string;
  completedAt: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  wrongCardIds: string[];
}

@Injectable({ providedIn: 'root' })
export class FlashcardsService {
  private readonly STORAGE_KEY = 'smartedge_flashcard_sets_v1';
  private readonly ACTIVE_SET_KEY = 'smartedge_flashcard_active_set_id';
  private readonly ai = inject(AIService);
  private readonly ns = inject(NotificationService);

  launchContext = signal<FlashcardLaunchContext | null>(null);
  savedSets = signal<SavedFlashcardSet[]>(this.loadSavedSets());
  activeSetId = signal<string | null>(this.loadActiveSetId());

  activeSet = computed(() => {
    const activeId = this.activeSetId();
    if (!activeId) return null;
    return this.savedSets().find(set => set.id === activeId) || null;
  });

  constructor() {
    effect(() => {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.savedSets()));
    });

    effect(() => {
      const activeId = this.activeSetId();
      if (activeId) {
        localStorage.setItem(this.ACTIVE_SET_KEY, activeId);
      } else {
        localStorage.removeItem(this.ACTIVE_SET_KEY);
      }
    });
  }

  openFromSource(context: FlashcardLaunchContext) {
    this.launchContext.set({
      ...context,
      sourceType: this.normalizeSourceType(context.sourceType),
      sourceText: context.sourceText.trim(),
      createdAt: context.createdAt || new Date().toISOString()
    });
  }

  consumeLaunchContext() {
    const context = this.launchContext();
    this.launchContext.set(null);
    return context;
  }

  setActiveSet(setId: string | null) {
    this.activeSetId.set(setId);
  }

  getSavedSet(setId: string) {
    return this.savedSets().find(set => set.id === setId) || null;
  }

  deleteSavedSet(setId: string) {
    this.savedSets.update(list => list.filter(set => set.id !== setId));
    if (this.activeSetId() === setId) {
      this.activeSetId.set(this.savedSets()[0]?.id || null);
    }
  }

  saveSet(input: Omit<SavedFlashcardSet, 'updatedAt'> & { updatedAt?: string }, options?: { silent?: boolean }) {
    const payload: SavedFlashcardSet = {
      ...input,
      quizHistory: this.normalizeQuizHistory(input.quizHistory),
      updatedAt: input.updatedAt || new Date().toISOString()
    };

    this.savedSets.update(existing => {
      const index = existing.findIndex(set => set.id === payload.id);
      if (index === -1) {
        return [payload, ...existing];
      }

      const next = [...existing];
      next[index] = payload;
      return next;
    });

    this.activeSetId.set(payload.id);
    if (!options?.silent) {
      this.ns.show(
        this.ai.currentLanguage() === 'ar' ? 'تم حفظ البطاقات' : 'Flashcards Saved',
        this.ai.currentLanguage() === 'ar' ? 'أضيفت المجموعة إلى مجموعاتك المحفوظة.' : 'The set was added to your saved collections.',
        'success',
        'fa-layer-group'
      );
    }

    return payload;
  }

  updateSetProgress(setId: string, progress: FlashcardSetProgress, cards?: FlashcardItem[]) {
    this.savedSets.update(existing => existing.map(set => {
      if (set.id !== setId) return set;
      return {
        ...set,
        cards: cards || set.cards,
        progress,
        updatedAt: new Date().toISOString()
      };
    }));
  }

  createInitialProgress(cards: FlashcardItem[]): FlashcardSetProgress {
    const ids = cards.map(card => card.id);
    return {
      currentCardId: ids[0] || null,
      completedCardIds: [],
      viewedCardIds: [],
      ratingStats: {
        easy: 0,
        medium: 0,
        hard: 0
      },
      queue: ids
    };
  }

  createEmptySet(context?: FlashcardLaunchContext): SavedFlashcardSet {
    const language = context?.language || this.ai.currentLanguage();
    return {
      id: crypto.randomUUID(),
      name: context?.groupName || (language === 'ar' ? 'مجموعة بطاقات جديدة' : 'New Flashcard Set'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceText: context?.sourceText || '',
      sourceType: this.normalizeSourceType(context?.sourceType),
      sourceTitle: context?.sourceTitle,
      conversationId: context?.conversationId,
      messageId: context?.messageId,
      language,
      cards: [],
      progress: this.createInitialProgress([]),
      quizHistory: []
    };
  }

  async generateSet(
    context: FlashcardLaunchContext,
    mode: FlashcardGenerationMode = 'standard'
  ): Promise<{ setTitle: string; sourceText: string; cards: FlashcardItem[] }> {
    const normalizedContext = {
      ...context,
      sourceText: context.sourceText.trim(),
      language: context.language || this.ai.currentLanguage()
    };

    if (!normalizedContext.sourceText) {
      throw new Error('FLASHCARD_SOURCE_EMPTY');
    }

    const sourceText = await this.prepareSourceText(normalizedContext);
    const { count, modeInstruction } = this.getModeInstruction(mode, normalizedContext.language);
    const payload = await this.requestGeneratedPayload(normalizedContext, sourceText, count, modeInstruction);

    const cards = this.normalizeCards(
      (payload?.cards || []).length
        ? payload.cards || []
        : this.buildFallbackCardsFromSource(sourceText, normalizedContext.language, count),
      sourceText
    );

    if (!cards.length) {
      throw new Error('FLASHCARD_SOURCE_TOO_WEAK');
    }

    return {
      setTitle: payload?.setTitle?.trim()
        || normalizedContext.groupName
        || this.defaultSetName(normalizedContext.sourceTitle, normalizedContext.language),
      sourceText,
      cards
    };
  }

  async generateQuiz(cards: FlashcardItem[], sourceTitle?: string): Promise<FlashcardQuizQuestion[]> {
    const payload = await this.chatJson<{ questions?: FlashcardQuizQuestion[] }>(
      `Flashcards source title: ${sourceTitle || 'Flashcards'}
Flashcards:
${cards.map(card => `CARD_ID: ${card.id}\nTYPE: ${card.type}\nFRONT: ${card.front}\nBACK: ${card.back}`).join('\n\n')}`,
      `Generate a high-quality self-test quiz from the flashcards.
Return ONLY JSON with key: questions.
Each question must have:
- id
- cardId
- question
- options (exactly 4)
- answerIndex (0 to 3)
- explanation
Keep questions educational and faithful to the flashcards.
Every question must reference one provided CARD_ID in cardId.
Respond strictly in ${this.ai.getLanguageName()}.`
    );

    const validCardIds = new Set(cards.map(card => card.id));
    return (payload.questions || []).map((question, index) => ({
      id: question.id || crypto.randomUUID(),
      cardId: validCardIds.has(String(question.cardId || '').trim())
        ? String(question.cardId || '').trim()
        : cards[index % Math.max(cards.length, 1)]?.id,
      question: question.question || '',
      options: Array.isArray(question.options) ? question.options.slice(0, 4) : [],
      answerIndex: Number.isFinite(question.answerIndex) ? question.answerIndex : 0,
      explanation: question.explanation || ''
    })).filter(question => question.question && question.options.length === 4 && !!question.cardId);
  }

  async generateArtifact(kind: FlashcardArtifactKind, cards: FlashcardItem[], sourceTitle?: string): Promise<string> {
    const promptMap: Record<FlashcardArtifactKind, string> = {
      summary: 'Create a sharp revision summary from these flashcards.',
      mind_map: 'Convert these flashcards into a structured mind map with clear hierarchy and subpoints.',
      difficult_points: 'Explain the hardest ideas across these flashcards in a simpler but accurate way.',
      study_plan: 'Create a concise review plan using these flashcards for short-term study.',
      exam_sprint: 'Create a last-minute exam sprint review based on these flashcards.'
    };

    return this.chatText(
      `Flashcards source title: ${sourceTitle || 'Flashcards'}
Flashcards:
${cards.map(card => `TYPE: ${card.type}\nFRONT: ${card.front}\nBACK: ${card.back}\nDIFFICULTY: ${card.difficulty}`).join('\n\n')}`,
      `You are a study companion.
${promptMap[kind]}
Be concise, educational, well-structured, and useful for a student.
Respond strictly in ${this.ai.getLanguageName()}.
Do not mention that you are using flashcards unless useful.`
    );
  }

  private async expandSourceIfNeeded(sourceText: string, context: FlashcardLaunchContext) {
    if (sourceText.length >= 260) {
      return sourceText;
    }

    return this.chatText(
      `Source type: ${context.sourceType}
Source title: ${context.sourceTitle || 'Untitled'}
Short source:
${sourceText}`,
      `Expand the explanation into a stronger flashcard-ready learning passage without changing the original topic.
Keep it faithful to the source.
Add only clarifying structure, examples, and conceptual links that are directly implied by the source.
Make it suitable for generating rich educational flashcards.
Respond strictly in ${this.ai.getLanguageName(context.language)}.
      Return plain text only.`
    );
  }

  private async prepareSourceText(context: FlashcardLaunchContext) {
    try {
      return await this.expandSourceIfNeeded(context.sourceText, context);
    } catch {
      return context.sourceText;
    }
  }

  private async requestGeneratedPayload(
    context: FlashcardLaunchContext,
    sourceText: string,
    count: number,
    modeInstruction: string
  ): Promise<GeneratedFlashcardPayload | null> {
    const message = `SOURCE TYPE: ${context.sourceType}
SOURCE TITLE: ${context.sourceTitle || 'Untitled'}
STUDENT LEVEL: ${this.ai.userLevel()}
REQUESTED CARD COUNT: ${count}
SOURCE CONTENT:
${sourceText}`;

    const instructions = [
      `You are an elite academic flashcard generator.
Your task is to turn the provided educational content into strong study flashcards.
Return ONLY a JSON object with keys: setTitle, cards.
Each card must contain:
- id
- type
- front
- back
- hint
- difficulty
- tags
- sourceSnippet

VALID type values:
- qa
- definition
- cause_effect
- comparison
- steps
- true_false
- application
- rapid_recall
- difficult_concept
- final_review

QUALITY RULES:
- No duplicate cards.
- No shallow memorization-only cards unless they serve rapid review.
- Prefer conceptual understanding, transfer, causes, contrasts, steps, and exam readiness.
- Keep cards faithful to the provided source. Do not invent unsupported facts.
- If the topic is scientific, medical, legal, or university-level, increase rigor appropriately.
- If the material is school-level, make the cards clearer and more accessible.
- Make front concise and answerable.
- Make back precise, educational, and exam-useful.
- Keep sourceSnippet short and directly tied to the source.
- Use tags as compact keywords.
- difficulty must be one of: easy, medium, hard.
- hint should be short and useful.
- Create a diverse mix across the valid type values when relevant.
- ${modeInstruction}
- Respond strictly in ${this.ai.getLanguageName(context.language)}.
- JSON only.`,
      `Generate ${count} strong study flashcards from the source.
Return only valid JSON.
Accepted formats:
1. { "setTitle": "...", "cards": [ ... ] }
2. [ { ...cardFields } ]

Each card must contain front and back.
Keep the content faithful to the source and respond in ${this.ai.getLanguageName(context.language)}.`
    ];

    let lastError: unknown = null;

    for (const instruction of instructions) {
      try {
        const raw = await this.chatText(
          message,
          `${instruction}\nReturn strictly valid JSON with no markdown fences and no extra text.`
        );
        const payload = this.parseGeneratedFlashcardPayload(raw);
        if ((payload.cards || []).length > 0) {
          return payload;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      console.warn('Flashcards AI generation fell back to local builder:', lastError);
    }

    return null;
  }

  private getModeInstruction(mode: FlashcardGenerationMode, language: LanguageCode) {
    if (mode === 'more') {
      return {
        count: 20,
        modeInstruction: language === 'ar'
          ? 'أنشئ بطاقات إضافية أعمق وأكثر تنوعًا من المصدر نفسه.'
          : 'Generate additional, deeper, and more varied cards from the same source.'
      };
    }

    if (mode === 'simplify') {
      return {
        count: 14,
        modeInstruction: language === 'ar'
          ? 'اجعل البطاقات أوضح وأسهل وأكثر مناسبة للمراجعة السريعة.'
          : 'Make the cards clearer, easier, and more student-friendly for fast review.'
      };
    }

    if (mode === 'strengthen') {
      return {
        count: 16,
        modeInstruction: language === 'ar'
          ? 'اجعل البطاقات أكثر عمقًا ودقةً وجامعية مع تركيز على الفهم والتحليل.'
          : 'Make the cards deeper, more rigorous, and more university-level with stronger analytical focus.'
      };
    }

    return {
      count: 14,
      modeInstruction: language === 'ar'
        ? 'أنشئ مجموعة متوازنة وقوية للمراجعة والفهم والاختبار.'
        : 'Create a balanced, strong set for revision, understanding, and exam preparation.'
    };
  }

  private parseGeneratedFlashcardPayload(raw: string): GeneratedFlashcardPayload {
    const parsed = JSON.parse(this.extractJsonPayload(raw)) as GeneratedFlashcardPayload | Partial<FlashcardItem>[];
    if (Array.isArray(parsed)) {
      return { cards: parsed };
    }

    if (parsed && typeof parsed === 'object') {
      const cards = Array.isArray(parsed.cards)
        ? parsed.cards
        : this.extractCardsFromLooseText(raw);
      return {
        setTitle: typeof parsed.setTitle === 'string' ? parsed.setTitle : undefined,
        cards
      };
    }

    return { cards: this.extractCardsFromLooseText(raw) };
  }

  private normalizeCards(cards: Partial<FlashcardItem>[], sourceText: string): FlashcardItem[] {
    const seen = new Set<string>();

    return cards.map((card, index) => {
      const front = String(card.front || '').trim();
      const back = String(card.back || '').trim();
      const uniqueKey = `${front}__${back}`.toLowerCase();
      if (!front || !back || seen.has(uniqueKey)) {
        return null;
      }

      seen.add(uniqueKey);
      return {
        id: String(card.id || crypto.randomUUID()),
        type: this.normalizeType(card.type),
        front,
        back,
        hint: String(card.hint || '').trim() || undefined,
        difficulty: this.normalizeDifficulty(card.difficulty),
        tags: Array.isArray(card.tags)
          ? card.tags.map(tag => String(tag).trim()).filter(Boolean).slice(0, 6)
          : [],
        sourceSnippet: String(card.sourceSnippet || sourceText.slice(0, 160)).trim() || undefined,
        mastered: Boolean(card.mastered),
        reviewState: card.reviewState === 'easy' || card.reviewState === 'medium' || card.reviewState === 'hard'
          ? card.reviewState
          : null
        } satisfies FlashcardItem;
    }).filter((card): card is NonNullable<typeof card> => !!card).slice(0, 28);
  }

  private buildFallbackCardsFromSource(
    sourceText: string,
    language: LanguageCode,
    count: number
  ): Partial<FlashcardItem>[] {
    const segments = this.extractStudySegments(sourceText);
    const targetCount = Math.max(4, Math.min(count, 18));
    const cards: Partial<FlashcardItem>[] = [];
    const seen = new Set<string>();

    const addCard = (card: Partial<FlashcardItem>) => {
      const front = String(card.front || '').trim();
      const back = String(card.back || '').trim();
      const key = `${front}__${back}`.toLowerCase();
      if (!front || !back || seen.has(key)) {
        return;
      }

      seen.add(key);
      cards.push({
        id: crypto.randomUUID(),
        hint: card.hint,
        sourceSnippet: card.sourceSnippet,
        difficulty: card.difficulty,
        tags: card.tags,
        type: card.type,
        front,
        back
      });
    };

    const overview = segments.slice(0, 3).join(language === 'ar' ? '، ثم ' : ' Then ');
    if (overview) {
      addCard({
        type: 'final_review',
        front: language === 'ar'
          ? 'ما الفكرة العامة للمحتوى الحالي؟'
          : 'What is the overall idea of the current content?',
        back: overview,
        hint: language === 'ar' ? 'ابدأ بالصورة العامة' : 'Start with the big picture',
        difficulty: 'easy',
        tags: this.extractKeywords(sourceText, language, 4),
        sourceSnippet: overview.slice(0, 160)
      });
    }

    segments.forEach((segment, index) => {
      if (cards.length >= targetCount) {
        return;
      }

      addCard({
        type: this.inferFallbackType(segment, index),
        front: this.buildFallbackFront(segment, index, language),
        back: segment,
        hint: this.buildHint(segment, language),
        difficulty: this.inferFallbackDifficulty(segment),
        tags: this.extractKeywords(segment, language, 5),
        sourceSnippet: segment.slice(0, 160)
      });
    });

    if (cards.length < Math.min(3, targetCount) && segments[0]) {
      const primary = segments[0];
      addCard({
        type: 'definition',
        front: language === 'ar'
          ? 'اكتب تعريفًا مختصرًا لهذه الفكرة.'
          : 'Write a short definition for this idea.',
        back: primary,
        hint: language === 'ar' ? 'عرّف الفكرة بدقة' : 'Define the idea precisely',
        difficulty: 'easy',
        tags: this.extractKeywords(primary, language, 4),
        sourceSnippet: primary.slice(0, 160)
      });
      addCard({
        type: 'rapid_recall',
        front: language === 'ar'
          ? 'ما النقطة الأهم التي يجب تذكرها سريعًا؟'
          : 'What is the fastest key point to remember?',
        back: primary,
        hint: language === 'ar' ? 'ركّز على لب الفكرة' : 'Focus on the core idea',
        difficulty: 'medium',
        tags: this.extractKeywords(primary, language, 4),
        sourceSnippet: primary.slice(0, 160)
      });
    }

    return cards;
  }

  private extractStudySegments(sourceText: string): string[] {
    const cleaned = sourceText
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\r/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\u00a0/g, ' ');

    const lines = cleaned
      .split(/\n+/)
      .map(line => line
        .replace(/^\s*(?:[-*•●▪■]|\d+[\.\)])\s*/g, '')
        .replace(/^#+\s*/g, '')
        .replace(/\s+/g, ' ')
        .trim())
      .filter(line => line.length >= 24);

    const sentencePool = cleaned
      .replace(/\s+/g, ' ')
      .split(/[.!?؟؛\n]+/g)
      .map(part => part.trim())
      .filter(part => part.length >= 24);

    const merged: string[] = [];
    let buffer = '';

    for (const part of [...lines, ...sentencePool]) {
      const candidate = buffer ? `${buffer} ${part}` : part;
      if (candidate.length < 70) {
        buffer = candidate;
        continue;
      }

      merged.push(candidate.trim());
      buffer = '';
    }

    if (buffer.trim()) {
      merged.push(buffer.trim());
    }

    return Array.from(new Set(merged.map(segment => segment.slice(0, 320)))).slice(0, 18);
  }

  private inferFallbackType(segment: string, index: number): FlashcardType {
    const normalized = segment.toLowerCase();
    if (/(?:first|second|third|then|finally|step|stage|begin|start|بعد|ثم|أول|ثاني|خطوة|مرحلة|أخير)/i.test(segment)) {
      return 'steps';
    }
    if (/(?:because|therefore|result|lead to|causes?|effect|سبب|نتيجة|يؤدي|بسبب|لذلك)/i.test(segment)) {
      return 'cause_effect';
    }
    if (/(?:compare|versus|vs\.?|difference|similar|contrast|مقارنة|الفرق|تشابه|اختلاف)/i.test(segment)) {
      return 'comparison';
    }
    if (/(?:apply|application|example|scenario|practical|تطبيق|مثال|حالة|عملي)/i.test(segment)) {
      return 'application';
    }

    const fallbackCycle: FlashcardType[] = ['qa', 'definition', 'rapid_recall', 'difficult_concept'];
    return fallbackCycle[index % fallbackCycle.length];
  }

  private buildFallbackFront(segment: string, index: number, language: LanguageCode) {
    const type = this.inferFallbackType(segment, index);
    const labels = this.extractKeywords(segment, language, 3).join(language === 'ar' ? '، ' : ', ');

    if (type === 'steps') {
      return language === 'ar'
        ? `ما الخطوات أو التسلسل المذكور${labels ? ` حول ${labels}` : ''}؟`
        : `What steps or sequence are described${labels ? ` about ${labels}` : ''}?`;
    }

    if (type === 'cause_effect') {
      return language === 'ar'
        ? `ما العلاقة السببية الموضحة${labels ? ` في ${labels}` : ''}؟`
        : `What cause-and-effect relationship is explained${labels ? ` in ${labels}` : ''}?`;
    }

    if (type === 'comparison') {
      return language === 'ar'
        ? `ما أوجه المقارنة أو الفرق المذكورة${labels ? ` في ${labels}` : ''}؟`
        : `What comparison or contrast is mentioned${labels ? ` in ${labels}` : ''}?`;
    }

    if (type === 'application') {
      return language === 'ar'
        ? `كيف يمكن تطبيق هذه الفكرة${labels ? ` في ${labels}` : ''}؟`
        : `How can this idea be applied${labels ? ` in ${labels}` : ''}?`;
    }

    return language === 'ar'
      ? `اشرح الفكرة الأساسية في النقطة ${index + 1}${labels ? ` حول ${labels}` : ''}.`
      : `Explain the main idea in point ${index + 1}${labels ? ` about ${labels}` : ''}.`;
  }

  private buildHint(segment: string, language: LanguageCode) {
    const keywords = this.extractKeywords(segment, language, 3);
    if (keywords.length > 0) {
      return keywords.join(language === 'ar' ? ' - ' : ' / ');
    }
    return language === 'ar' ? 'راجع الجملة بعناية' : 'Review the sentence carefully';
  }

  private inferFallbackDifficulty(segment: string): FlashcardDifficulty {
    if (segment.length >= 210 || /(?:however|although|despite|whereas|مع ذلك|رغم|بينما|على الرغم)/i.test(segment)) {
      return 'hard';
    }
    if (segment.length >= 120) {
      return 'medium';
    }
    return 'easy';
  }

  private extractKeywords(text: string, language: LanguageCode, limit: number): string[] {
    const stopwords = language === 'ar'
      ? new Set(['هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'على', 'إلى', 'من', 'في', 'عن', 'مع', 'ثم', 'بعد', 'قبل', 'كان', 'كانت', 'كما', 'لها', 'له', 'أن', 'إن', 'أو', 'أي', 'كل'])
      : new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'about', 'your', 'their', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'are', 'was', 'were', 'been', 'than']);

    const counts = new Map<string, number>();
    const matchedWords = text.match(language === 'ar' ? /[\u0600-\u06FF]{3,}/g : /[a-zA-Z]{4,}/g);
    const words: string[] = matchedWords ? [...matchedWords] : [];

    words.forEach((raw) => {
      const word = raw.toLowerCase();
      if (stopwords.has(word)) {
        return;
      }
      counts.set(word, (counts.get(word) || 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
      .slice(0, limit)
      .map(([word]) => word);
  }

  private extractCardsFromLooseText(raw: string): Partial<FlashcardItem>[] {
    const lines = raw.split(/\n+/).map(line => line.trim()).filter(Boolean);
    const cards: Partial<FlashcardItem>[] = [];
    let current: Partial<FlashcardItem> | null = null;

    const pushCurrent = () => {
      if (!current?.front || !current?.back) {
        return;
      }
      cards.push(current);
      current = null;
    };

    for (const line of lines) {
      const frontMatch = line.match(/^(?:[-*]\s*)?(?:front|question|q|السؤال|وجه البطاقة)\s*[:：-]\s*(.+)$/i);
      if (frontMatch?.[1]) {
        pushCurrent();
        current = { front: frontMatch[1].trim(), type: 'qa', difficulty: 'medium' };
        continue;
      }

      const backMatch = line.match(/^(?:[-*]\s*)?(?:back|answer|a|الإجابة|الجواب|ظهر البطاقة)\s*[:：-]\s*(.+)$/i);
      if (backMatch?.[1]) {
        current = current || { type: 'qa', difficulty: 'medium' };
        current.back = backMatch[1].trim();
        continue;
      }

      const hintMatch = line.match(/^(?:[-*]\s*)?(?:hint|تلميح)\s*[:：-]\s*(.+)$/i);
      if (hintMatch?.[1]) {
        current = current || { type: 'qa', difficulty: 'medium' };
        current.hint = hintMatch[1].trim();
      }
    }

    pushCurrent();
    return cards;
  }

  private normalizeType(value: unknown): FlashcardType {
    const raw = String(value || '').trim().toLowerCase();
    const map: Record<string, FlashcardType> = {
      qa: 'qa',
      q_a: 'qa',
      question_answer: 'qa',
      definition: 'definition',
      term: 'definition',
      cause_effect: 'cause_effect',
      causeeffect: 'cause_effect',
      comparison: 'comparison',
      compare: 'comparison',
      steps: 'steps',
      process: 'steps',
      true_false: 'true_false',
      truefalse: 'true_false',
      application: 'application',
      practical_application: 'application',
      rapid_recall: 'rapid_recall',
      rapid: 'rapid_recall',
      difficult_concept: 'difficult_concept',
      difficult: 'difficult_concept',
      final_review: 'final_review',
      final: 'final_review'
    };

    return map[raw] || 'qa';
  }

  private normalizeDifficulty(value: unknown): FlashcardDifficulty {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'easy' || raw === 'medium' || raw === 'hard') {
      return raw;
    }
    return 'medium';
  }

  private defaultSetName(sourceTitle?: string, language: LanguageCode = 'ar') {
    if (sourceTitle?.trim()) {
      return sourceTitle.trim();
    }

    return language === 'ar' ? 'مجموعة مراجعة ذكية' : 'Smart Review Set';
  }

  private async chatText(message: string, systemInstruction: string): Promise<string> {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        systemInstruction,
        model: 'gpt-4o-mini'
      })
    });

    const payload = await response.json().catch(() => null) as { text?: string; error?: string } | null;
    if (!response.ok || !payload?.text) {
      throw new Error(payload?.error || `Flashcards AI request failed (${response.status})`);
    }

    return payload.text.trim();
  }

  private async chatJson<T>(message: string, systemInstruction: string): Promise<T> {
    const strictInstruction = `${systemInstruction}\nReturn strictly valid JSON with no markdown fences and no extra text.`;
    const text = await this.chatText(message, strictInstruction);
    return JSON.parse(this.extractJsonPayload(text)) as T;
  }

  private extractJsonPayload(raw: string): string {
    const text = raw.trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return fenced[1].trim();

    const objStart = text.indexOf('{');
    const arrStart = text.indexOf('[');
    const start = objStart >= 0 && arrStart >= 0 ? Math.min(objStart, arrStart) : Math.max(objStart, arrStart);
    if (start < 0) return text;

    const objEnd = text.lastIndexOf('}');
    const arrEnd = text.lastIndexOf(']');
    const end = Math.max(objEnd, arrEnd);
    if (end < start) return text;

    return text.slice(start, end + 1).trim();
  }

  private loadSavedSets(): SavedFlashcardSet[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as SavedFlashcardSet[];
      return Array.isArray(parsed)
        ? parsed.map((set) => ({
          ...set,
          sourceType: this.normalizeSourceType(set.sourceType),
          quizHistory: this.normalizeQuizHistory(set.quizHistory)
        }))
        : [];
    } catch {
      return [];
    }
  }

  private loadActiveSetId() {
    return localStorage.getItem(this.ACTIVE_SET_KEY);
  }

  private normalizeSourceType(value: unknown): string {
    const normalized = String(value || '').trim();
    if (normalized.replace(/[_\s-]+/g, '').toLowerCase() === 'voicetutor') {
      return 'tutor';
    }
    return normalized || 'manual';
  }

  private normalizeQuizHistory(value: unknown): FlashcardQuizAttempt[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((attempt) => {
      const raw = attempt as Partial<FlashcardQuizAttempt>;
      return {
        id: String(raw.id || crypto.randomUUID()),
        completedAt: String(raw.completedAt || new Date().toISOString()),
        score: Math.max(0, Math.min(100, Math.round(Number(raw.score) || 0))),
        correctAnswers: Math.max(0, Math.round(Number(raw.correctAnswers) || 0)),
        totalQuestions: Math.max(0, Math.round(Number(raw.totalQuestions) || 0)),
        wrongCardIds: Array.isArray(raw.wrongCardIds)
          ? raw.wrongCardIds.map((cardId) => String(cardId || '').trim()).filter(Boolean)
          : []
      } satisfies FlashcardQuizAttempt;
    }).slice(0, 20);
  }
}

export type { FlashcardQuizQuestion };
