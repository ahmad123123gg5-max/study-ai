import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, effect, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AIService } from '../../services/ai.service';
import {
  FlashcardArtifactKind,
  FlashcardDifficulty,
  FlashcardGenerationMode,
  FlashcardItem,
  FlashcardLaunchContext,
  FlashcardQuizAttempt,
  FlashcardQuizQuestion,
  FlashcardReviewState,
  FlashcardType,
  FlashcardsService,
  SavedFlashcardSet
} from '../../services/flashcards.service';
import { NotificationService } from '../../services/notification.service';
import { UpgradeModal } from '../shared/upgrade-modal.component';
import { LanguageCode } from '../../i18n/language-config';

type FlashcardDisplayMode = 'classic' | 'rapid' | 'self_test' | 'reels';
type FlashcardFilterDifficulty = 'all' | FlashcardDifficulty;
type FlashcardFilterType = 'all' | FlashcardType;
type FlashcardThemeId =
  | 'classic_student'
  | 'soft_pink'
  | 'anime'
  | 'rose'
  | 'dark_academic'
  | 'kids'
  | 'gamer'
  | 'elegant_gold'
  | 'minimal_white'
  | 'neon_study';
type FlashcardShapeId =
  | 'rounded_soft'
  | 'sharp_modern'
  | 'glass'
  | 'notebook'
  | 'polaroid'
  | 'cute_sticker'
  | 'futuristic'
  | 'exam'
  | 'kids_fun';
type FlashcardStylePresetId = 'students' | 'kids' | 'girls' | 'youth' | 'university' | 'school' | 'playful' | 'formal';
type FlashcardBorderStyle = 'soft' | 'solid' | 'dashed' | 'double' | 'glow';
type FlashcardMotionStyle = 'soft' | 'balanced' | 'dynamic';
type FlashcardColorSlot = 'frontColor' | 'backColor' | 'textColor' | 'borderColor';
type FlashcardFace = 'front' | 'back';

interface FlashcardThemeDefinition {
  id: FlashcardThemeId;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  frontColor: string;
  backColor: string;
  textColor: string;
  borderColor: string;
  accentColor: string;
  secondaryColor: string;
  pattern: 'paper' | 'blossom' | 'sparkle' | 'rose' | 'grid' | 'confetti' | 'pixel' | 'gold' | 'minimal' | 'neon';
  defaultShape: FlashcardShapeId;
  defaultMotion: FlashcardMotionStyle;
  defaultBorderStyle: FlashcardBorderStyle;
}

interface FlashcardShapeDefinition {
  id: FlashcardShapeId;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

interface FlashcardStylePresetDefinition {
  id: FlashcardStylePresetId;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  themeId: FlashcardThemeId;
  shapeId: FlashcardShapeId;
  motion: FlashcardMotionStyle;
  borderStyle: FlashcardBorderStyle;
}

interface FlashcardCustomizationSettings {
  themeId: FlashcardThemeId;
  shapeId: FlashcardShapeId;
  stylePreset: FlashcardStylePresetId;
  frontColor: string;
  backColor: string;
  textColor: string;
  borderColor: string;
  borderStyle: FlashcardBorderStyle;
  autoContrast: boolean;
  motion: FlashcardMotionStyle;
}

const FLASHCARD_UI_STORAGE_KEY = 'smartedge_flashcard_ui_customization_v1';

const FLASHCARD_THEMES: FlashcardThemeDefinition[] = [
  {
    id: 'classic_student',
    labelAr: 'Classic Student',
    labelEn: 'Classic Student',
    descriptionAr: 'بسيط وأنيق ومناسب لكل الطلاب.',
    descriptionEn: 'Simple, balanced, and polished for everyday study.',
    frontColor: '#1d4ed8',
    backColor: '#0f172a',
    textColor: '#f8fafc',
    borderColor: '#7dd3fc',
    accentColor: '#38bdf8',
    secondaryColor: '#22d3ee',
    pattern: 'paper',
    defaultShape: 'rounded_soft',
    defaultMotion: 'balanced',
    defaultBorderStyle: 'soft'
  },
  {
    id: 'soft_pink',
    labelAr: 'Soft Pink / Cute',
    labelEn: 'Soft Pink / Cute',
    descriptionAr: 'ألوان ناعمة ولمسات لطيفة ومريحة.',
    descriptionEn: 'Soft, cute, and calm with gentle gradients.',
    frontColor: '#ec4899',
    backColor: '#be185d',
    textColor: '#fff7fb',
    borderColor: '#f9a8d4',
    accentColor: '#f472b6',
    secondaryColor: '#fbcfe8',
    pattern: 'blossom',
    defaultShape: 'cute_sticker',
    defaultMotion: 'soft',
    defaultBorderStyle: 'soft'
  },
  {
    id: 'anime',
    labelAr: 'Anime Style',
    labelEn: 'Anime Style',
    descriptionAr: 'ألوان نابضة مع لمسات حديثة تشبه الأنيمي.',
    descriptionEn: 'Vivid color layering with modern anime-like energy.',
    frontColor: '#7c3aed',
    backColor: '#312e81',
    textColor: '#eef2ff',
    borderColor: '#c4b5fd',
    accentColor: '#a855f7',
    secondaryColor: '#60a5fa',
    pattern: 'sparkle',
    defaultShape: 'futuristic',
    defaultMotion: 'dynamic',
    defaultBorderStyle: 'glow'
  },
  {
    id: 'rose',
    labelAr: 'Rose Theme',
    labelEn: 'Rose Theme',
    descriptionAr: 'ستايل وردي أنيق وهادئ مع تدرجات ناعمة.',
    descriptionEn: 'Elegant rosy gradients with warm softness.',
    frontColor: '#e11d48',
    backColor: '#9f1239',
    textColor: '#fff1f2',
    borderColor: '#fda4af',
    accentColor: '#fb7185',
    secondaryColor: '#fda4af',
    pattern: 'rose',
    defaultShape: 'rounded_soft',
    defaultMotion: 'balanced',
    defaultBorderStyle: 'soft'
  },
  {
    id: 'dark_academic',
    labelAr: 'Dark Academic',
    labelEn: 'Dark Academic',
    descriptionAr: 'ستايل جامعي داكن وفخم للمراجعة المركزة.',
    descriptionEn: 'Dark academic depth for rigorous focused review.',
    frontColor: '#111827',
    backColor: '#020617',
    textColor: '#e2e8f0',
    borderColor: '#94a3b8',
    accentColor: '#f59e0b',
    secondaryColor: '#a78bfa',
    pattern: 'grid',
    defaultShape: 'exam',
    defaultMotion: 'soft',
    defaultBorderStyle: 'double'
  },
  {
    id: 'kids',
    labelAr: 'Kids Theme',
    labelEn: 'Kids Theme',
    descriptionAr: 'مرِح وواضح ومناسب للأطفال.',
    descriptionEn: 'Playful, friendly, and bright for younger learners.',
    frontColor: '#10b981',
    backColor: '#14b8a6',
    textColor: '#f0fdfa',
    borderColor: '#99f6e4',
    accentColor: '#facc15',
    secondaryColor: '#fb7185',
    pattern: 'confetti',
    defaultShape: 'kids_fun',
    defaultMotion: 'dynamic',
    defaultBorderStyle: 'soft'
  },
  {
    id: 'gamer',
    labelAr: 'Boys / Gamer Theme',
    labelEn: 'Boys / Gamer Theme',
    descriptionAr: 'أقوى وأغمق مع لمسات تقنية حديثة.',
    descriptionEn: 'Stronger, darker, and more high-tech in tone.',
    frontColor: '#0f172a',
    backColor: '#111827',
    textColor: '#e0f2fe',
    borderColor: '#38bdf8',
    accentColor: '#22d3ee',
    secondaryColor: '#a855f7',
    pattern: 'pixel',
    defaultShape: 'sharp_modern',
    defaultMotion: 'dynamic',
    defaultBorderStyle: 'glow'
  },
  {
    id: 'elegant_gold',
    labelAr: 'Elegant Gold',
    labelEn: 'Elegant Gold',
    descriptionAr: 'فاخر وراقٍ مع طابع ذهبي خفيف.',
    descriptionEn: 'Luxury-inspired with restrained golden warmth.',
    frontColor: '#78350f',
    backColor: '#451a03',
    textColor: '#fefce8',
    borderColor: '#fcd34d',
    accentColor: '#fbbf24',
    secondaryColor: '#fde68a',
    pattern: 'gold',
    defaultShape: 'polaroid',
    defaultMotion: 'soft',
    defaultBorderStyle: 'double'
  },
  {
    id: 'minimal_white',
    labelAr: 'Minimal White',
    labelEn: 'Minimal White',
    descriptionAr: 'أبيض نظيف وبسيط جدًا مع وضوح عالٍ.',
    descriptionEn: 'Crisp and clean with a minimal white surface.',
    frontColor: '#f8fafc',
    backColor: '#e2e8f0',
    textColor: '#0f172a',
    borderColor: '#94a3b8',
    accentColor: '#0f172a',
    secondaryColor: '#475569',
    pattern: 'minimal',
    defaultShape: 'glass',
    defaultMotion: 'soft',
    defaultBorderStyle: 'solid'
  },
  {
    id: 'neon_study',
    labelAr: 'Neon Study',
    labelEn: 'Neon Study',
    descriptionAr: 'توهج خفيف ولمسات مستقبلية حديثة.',
    descriptionEn: 'Soft neon glow with a fresh futuristic feel.',
    frontColor: '#082f49',
    backColor: '#0f172a',
    textColor: '#ecfeff',
    borderColor: '#22d3ee',
    accentColor: '#22d3ee',
    secondaryColor: '#4ade80',
    pattern: 'neon',
    defaultShape: 'futuristic',
    defaultMotion: 'dynamic',
    defaultBorderStyle: 'glow'
  }
];

const FLASHCARD_SHAPES: FlashcardShapeDefinition[] = [
  { id: 'rounded_soft', labelAr: 'Rounded Soft Card', labelEn: 'Rounded Soft Card', descriptionAr: 'حواف ناعمة ومريحة للدراسة اليومية.', descriptionEn: 'Soft rounded form for relaxed study.' },
  { id: 'sharp_modern', labelAr: 'Sharp Modern Card', labelEn: 'Sharp Modern Card', descriptionAr: 'أقرب لستايل حديث وخطوط حادة.', descriptionEn: 'Sharper geometry with a modern feel.' },
  { id: 'glass', labelAr: 'Glassmorphism Card', labelEn: 'Glassmorphism Card', descriptionAr: 'زجاجية شفافة مع عمق خفيف.', descriptionEn: 'Frosted glass with subtle depth.' },
  { id: 'notebook', labelAr: 'Notebook Style Card', labelEn: 'Notebook Style Card', descriptionAr: 'إحساس دفتر ملاحظات منظم.', descriptionEn: 'Notebook-inspired study card.' },
  { id: 'polaroid', labelAr: 'Polaroid Style Card', labelEn: 'Polaroid Style Card', descriptionAr: 'ستايل صورة فورية مع إطار واضح.', descriptionEn: 'Polaroid-inspired frame and spacing.' },
  { id: 'cute_sticker', labelAr: 'Cute Sticker Card', labelEn: 'Cute Sticker Card', descriptionAr: 'بطاقة لطيفة مع تفاصيل زخرفية خفيفة.', descriptionEn: 'Cute sticker aesthetic with playful details.' },
  { id: 'futuristic', labelAr: 'Futuristic Card', labelEn: 'Futuristic Card', descriptionAr: 'خطوط ولمسات تقنية مستقبلية.', descriptionEn: 'Futuristic corners and tech accents.' },
  { id: 'exam', labelAr: 'Exam Card', labelEn: 'Exam Card', descriptionAr: 'أقرب لبطاقة مراجعة رسمية قبل الاختبار.', descriptionEn: 'Structured exam-review card.' },
  { id: 'kids_fun', labelAr: 'Kids Fun Card', labelEn: 'Kids Fun Card', descriptionAr: 'شكل مرح مناسب للأطفال.', descriptionEn: 'Fun and lively layout for kids.' }
];

const FLASHCARD_STYLE_PRESETS: FlashcardStylePresetDefinition[] = [
  { id: 'students', labelAr: 'للطلاب', labelEn: 'For Students', descriptionAr: 'متوازن وأنيق ومناسب لمعظم الدروس.', descriptionEn: 'Balanced and polished for most lessons.', themeId: 'classic_student', shapeId: 'rounded_soft', motion: 'balanced', borderStyle: 'soft' },
  { id: 'kids', labelAr: 'للأطفال', labelEn: 'For Kids', descriptionAr: 'ألوان أوضح وشكل أكثر مرحًا.', descriptionEn: 'Brighter and more playful.', themeId: 'kids', shapeId: 'kids_fun', motion: 'dynamic', borderStyle: 'soft' },
  { id: 'girls', labelAr: 'للبنات', labelEn: 'For Girls', descriptionAr: 'ألوان ناعمة وستايل لطيف.', descriptionEn: 'Soft, cute, and warm.', themeId: 'soft_pink', shapeId: 'cute_sticker', motion: 'soft', borderStyle: 'soft' },
  { id: 'youth', labelAr: 'للشباب', labelEn: 'For Youth', descriptionAr: 'ستايل أقوى ولمسات حديثة.', descriptionEn: 'Stronger and more energetic.', themeId: 'gamer', shapeId: 'sharp_modern', motion: 'dynamic', borderStyle: 'glow' },
  { id: 'university', labelAr: 'ستايل جامعي', labelEn: 'University Style', descriptionAr: 'أعمق وأكثر فخامة للمحتوى الجامعي.', descriptionEn: 'More academic and serious.', themeId: 'dark_academic', shapeId: 'exam', motion: 'soft', borderStyle: 'double' },
  { id: 'school', labelAr: 'ستايل مدرسي', labelEn: 'School Style', descriptionAr: 'واضح ومنظم ومناسب للمراجعة المدرسية.', descriptionEn: 'Clear and structured for school review.', themeId: 'classic_student', shapeId: 'notebook', motion: 'balanced', borderStyle: 'solid' },
  { id: 'playful', labelAr: 'ستايل مرح', labelEn: 'Playful Style', descriptionAr: 'حيوي ومرح لكن دون فوضى بصرية.', descriptionEn: 'Lively without becoming chaotic.', themeId: 'anime', shapeId: 'futuristic', motion: 'dynamic', borderStyle: 'glow' },
  { id: 'formal', labelAr: 'ستايل رسمي', labelEn: 'Formal Style', descriptionAr: 'نظيف وهادئ واحترافي.', descriptionEn: 'Clean, restrained, and formal.', themeId: 'minimal_white', shapeId: 'glass', motion: 'soft', borderStyle: 'solid' }
];

const FLASHCARD_COLOR_SWATCHES = [
  { id: 'indigo', hex: '#4f46e5' },
  { id: 'blue', hex: '#2563eb' },
  { id: 'purple', hex: '#7c3aed' },
  { id: 'pink', hex: '#ec4899' },
  { id: 'emerald', hex: '#10b981' },
  { id: 'amber', hex: '#f59e0b' },
  { id: 'rose', hex: '#e11d48' },
  { id: 'slate', hex: '#334155' },
  { id: 'cyan', hex: '#0891b2' },
  { id: 'teal', hex: '#0f766e' },
  { id: 'white', hex: '#f8fafc' },
  { id: 'midnight', hex: '#0f172a' }
] as const;

const DEFAULT_THEME = FLASHCARD_THEMES[0];
const DEFAULT_CUSTOMIZATION: FlashcardCustomizationSettings = {
  themeId: DEFAULT_THEME.id,
  shapeId: DEFAULT_THEME.defaultShape,
  stylePreset: 'students',
  frontColor: DEFAULT_THEME.frontColor,
  backColor: DEFAULT_THEME.backColor,
  textColor: DEFAULT_THEME.textColor,
  borderColor: DEFAULT_THEME.borderColor,
  borderStyle: DEFAULT_THEME.defaultBorderStyle,
  autoContrast: true,
  motion: DEFAULT_THEME.defaultMotion
};

const ARABIC_SCRIPT_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function clampColor(value: number) { return Math.max(0, Math.min(255, Math.round(value))); }

function normalizeHex(input: string, fallback = '#0f172a') {
  const trimmed = input.trim();
  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) return normalized;
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    const [, r, g, b] = normalized;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex);
  const match = /^#([0-9a-f]{6})$/i.exec(normalized);
  if (!match) return null;
  const int = Number.parseInt(match[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbString(hex: string, alpha = 1) {
  const rgb = hexToRgb(hex) || hexToRgb('#0f172a')!;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function shiftHex(hex: string, amount: number) {
  const rgb = hexToRgb(hex) || hexToRgb('#0f172a')!;
  return `#${[rgb.r, rgb.g, rgb.b].map(value => clampColor(value + amount).toString(16).padStart(2, '0')).join('')}`;
}

function mixHex(first: string, second: string, weight = 0.5) {
  const a = hexToRgb(first) || hexToRgb('#0f172a')!;
  const b = hexToRgb(second) || hexToRgb('#ffffff')!;
  const blend = (from: number, to: number) => clampColor(from * (1 - weight) + to * weight);
  return `#${[blend(a.r, b.r), blend(a.g, b.g), blend(a.b, b.b)].map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

function containsArabicScript(text: string) {
  return ARABIC_SCRIPT_PATTERN.test(text);
}

function luminance(hex: string) {
  const rgb = hexToRgb(hex) || hexToRgb('#0f172a')!;
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function contrastTextColor(background: string) {
  return luminance(background) > 0.45 ? '#0f172a' : '#f8fafc';
}

@Component({
  selector: 'app-flashcards-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UpgradeModal],
  templateUrl: './flashcards.page.html',
  styleUrl: './flashcards.page.css'
})
export class FlashcardsPage {
  readonly ai = inject(AIService);
  readonly flashcards = inject(FlashcardsService);
  private readonly ns = inject(NotificationService);

  back = output<string>();

  currentSet = signal<SavedFlashcardSet | null>(null);
  activeCardId = signal<string | null>(null);
  sourceEditorText = signal('');
  displayMode = signal<FlashcardDisplayMode>('classic');
  filterDifficulty = signal<FlashcardFilterDifficulty>('all');
  filterType = signal<FlashcardFilterType>('all');
  filterTag = signal<string>('all');
  currentFace = signal<FlashcardFace>('front');
  isFlipped = signal(false);
  showAnswer = signal(false);
  showHint = signal(false);
  isBusy = signal(false);
  busyAction = signal<'generate' | 'artifact' | 'quiz' | null>(null);
  loadingMessageIndex = signal(0);
  errorMessage = signal('');
  artifactTitle = signal('');
  artifactContent = signal('');
  quizQuestions = signal<FlashcardQuizQuestion[]>([]);
  showQuizModal = signal(false);
  quizSelections = signal<Record<string, number>>({});
  speakingCardId = signal<string | null>(null);
  activeCardRenderTimestamp = signal(Date.now());
  upgradeMessage = signal('');
  showUpgradeModal = signal(false);
  showCustomizationDrawer = signal(false);
  previewFlipped = signal(false);
  private readonly initialCustomization = this.loadCustomization();
  savedCustomization = signal<FlashcardCustomizationSettings>(this.cloneCustomization(this.initialCustomization));
  draftCustomization = signal<FlashcardCustomizationSettings>(this.cloneCustomization(this.initialCustomization));
  private loadingTimer: number | null = null;
  private readonly voices = signal<SpeechSynthesisVoice[]>([]);
  private isCompletingQuiz = false;

  readonly displayModes = computed(() => {
    const isAr = this.ai.currentLanguage() === 'ar';
    return [
      { id: 'classic' as const, label: isAr ? 'الوضع الكلاسيكي' : 'Classic Mode' },
      { id: 'rapid' as const, label: isAr ? 'الدراسة السريعة' : 'Rapid Study' },
      { id: 'self_test' as const, label: isAr ? 'الاختبار الذاتي' : 'Self-Test' },
      { id: 'reels' as const, label: isAr ? 'وضع التمرير' : 'Reels Mode' }
    ];
  });

  readonly difficultyFilterOptions = computed(() => {
    const isAr = this.ai.currentLanguage() === 'ar';
    return [
      { id: 'all' as const, label: isAr ? 'كل الصعوبات' : 'All Difficulties' },
      { id: 'easy' as const, label: isAr ? 'سهلة' : 'Easy' },
      { id: 'medium' as const, label: isAr ? 'متوسطة' : 'Medium' },
      { id: 'hard' as const, label: isAr ? 'صعبة' : 'Hard' }
    ];
  });

  readonly typeFilterOptions = computed(() => {
    const options: Array<{ id: FlashcardFilterType; label: string }> = [
      { id: 'all', label: this.ai.currentLanguage() === 'ar' ? 'كل الأنواع' : 'All Types' }
    ];
    const seen = new Set<FlashcardType>();
    for (const card of this.currentSet()?.cards || []) {
      if (seen.has(card.type)) continue;
      seen.add(card.type);
      options.push({ id: card.type, label: this.cardTypeLabel(card.type) });
    }
    return options;
  });

  readonly allTags = computed(() => {
    const tags = new Set<string>();
    for (const card of this.currentSet()?.cards || []) {
      for (const tag of card.tags || []) {
        const trimmed = tag.trim();
        if (trimmed) tags.add(trimmed);
      }
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  });

  readonly filteredCards = computed(() => {
    const set = this.currentSet();
    if (!set) return [];
    return set.cards.filter(card => {
      if (this.filterDifficulty() !== 'all' && card.difficulty !== this.filterDifficulty()) return false;
      if (this.filterType() !== 'all' && card.type !== this.filterType()) return false;
      if (this.filterTag() !== 'all' && !(card.tags || []).includes(this.filterTag())) return false;
      return true;
    });
  });

  readonly filteredQueueIds = computed(() => {
    const set = this.currentSet();
    if (!set) return [];
    const visibleIds = new Set(this.filteredCards().map(card => card.id));
    const ordered = set.progress.queue.filter(id => visibleIds.has(id));
    const missing = this.filteredCards().map(card => card.id).filter(id => !ordered.includes(id));
    return [...ordered, ...missing];
  });

  readonly currentCard = computed(() => {
    const set = this.currentSet();
    const activeCardId = this.activeCardId();
    if (!set || !activeCardId) return null;
    return this.findCardById(set.cards, activeCardId);
  });

  readonly sidebarCards = computed(() => {
    const set = this.currentSet();
    if (!set) return [];

    return this.filteredQueueIds()
      .map(cardId => this.findCardById(set.cards, cardId))
      .filter((card): card is FlashcardItem => card !== null);
  });

  readonly currentCardIndex = computed(() => {
    const card = this.currentCard();
    if (!card) return -1;
    return this.filteredQueueIds().findIndex(id => id === card.id);
  });

  readonly activeCardRenderKey = computed(() => `${this.activeCardId() || 'none'}:${this.activeCardRenderTimestamp()}`);

  readonly visibleCardCount = computed(() => this.filteredCards().length);
  readonly totalCardCount = computed(() => this.currentSet()?.cards.length || 0);

  readonly completedCount = computed(() => {
    const set = this.currentSet();
    if (!set) return 0;
    const visibleIds = new Set(this.filteredCards().map(card => card.id));
    return set.progress.completedCardIds.filter(id => visibleIds.has(id)).length;
  });

  readonly progressPercent = computed(() => {
    const total = this.visibleCardCount();
    if (!total) return 0;
    return Math.min(100, Math.round((this.completedCount() / total) * 100));
  });

  readonly reviewStats = computed(() => (this.currentSet()?.cards || []).reduce(
    (stats, card) => {
      if (card.reviewState) {
        stats[card.reviewState] += 1;
      }
      return stats;
    },
    { easy: 0, medium: 0, hard: 0 }
  ));

  readonly difficultyDistribution = computed(() => {
    const cards = this.currentSet()?.cards || [];
    const total = cards.length || 1;
    return (['easy', 'medium', 'hard'] as FlashcardDifficulty[]).map(level => {
      const count = cards.filter(card => card.difficulty === level).length;
      return {
        id: level,
        label: this.difficultyLabel(level),
        count,
        percent: Math.round((count / total) * 100)
      };
    });
  });

  readonly currentSourceTitle = computed(() => {
    const set = this.currentSet();
    if (!set) return this.ai.currentLanguage() === 'ar' ? 'بدون مصدر محدد' : 'No Source Selected';
    return set.sourceTitle?.trim() || this.sourceTypeLabel(set.sourceType);
  });

  readonly currentSourceBadge = computed(() => {
    const set = this.currentSet();
    if (!set) return this.ai.currentLanguage() === 'ar' ? 'مصدر حر' : 'Free Source';
    return `${this.ai.currentLanguage() === 'ar' ? 'من' : 'From'} ${this.sourceTypeLabel(set.sourceType)}`;
  });

  readonly loadingMessages = computed(() => this.ai.currentLanguage() === 'ar'
    ? ['يتم تحليل الشرح...', 'يتم استخراج المفاهيم...', 'يتم بناء البطاقات الذكية...', 'يتم ترتيب الشكل والأنماط...']
    : ['Analyzing the explanation...', 'Extracting the concepts...', 'Building smart flashcards...', 'Polishing the card deck...']);

  readonly themeOptions = computed(() => FLASHCARD_THEMES.map(theme => ({
    ...theme,
    label: this.ai.currentLanguage() === 'ar' ? theme.labelAr : theme.labelEn,
    description: this.ai.currentLanguage() === 'ar' ? theme.descriptionAr : theme.descriptionEn
  })));

  readonly shapeOptions = computed(() => FLASHCARD_SHAPES.map(shape => ({
    ...shape,
    label: this.ai.currentLanguage() === 'ar' ? shape.labelAr : shape.labelEn,
    description: this.ai.currentLanguage() === 'ar' ? shape.descriptionAr : shape.descriptionEn
  })));

  readonly stylePresetOptions = computed(() => FLASHCARD_STYLE_PRESETS.map(preset => ({
    ...preset,
    label: this.ai.currentLanguage() === 'ar' ? preset.labelAr : preset.labelEn,
    description: this.ai.currentLanguage() === 'ar' ? preset.descriptionAr : preset.descriptionEn
  })));

  readonly borderOptions = computed(() => {
    const isAr = this.ai.currentLanguage() === 'ar';
    return [
      { id: 'soft' as const, label: isAr ? 'ناعم' : 'Soft' },
      { id: 'solid' as const, label: isAr ? 'صلب' : 'Solid' },
      { id: 'dashed' as const, label: isAr ? 'متقطع' : 'Dashed' },
      { id: 'double' as const, label: isAr ? 'مزدوج' : 'Double' },
      { id: 'glow' as const, label: isAr ? 'متوهج' : 'Glow' }
    ];
  });

  readonly motionOptions = computed(() => {
    const isAr = this.ai.currentLanguage() === 'ar';
    return [
      { id: 'soft' as const, label: isAr ? 'ناعمة' : 'Soft' },
      { id: 'balanced' as const, label: isAr ? 'متوازنة' : 'Balanced' },
      { id: 'dynamic' as const, label: isAr ? 'أقوى' : 'Dynamic' }
    ];
  });

  readonly colorOptions = computed(() => FLASHCARD_COLOR_SWATCHES.map(color => ({
    ...color,
    label: color.id.charAt(0).toUpperCase() + color.id.slice(1)
  })));

  readonly effectiveCustomization = computed(() => this.showCustomizationDrawer()
    ? this.draftCustomization()
    : this.savedCustomization());

  readonly activeTheme = computed(() => this.resolveTheme(this.effectiveCustomization().themeId));
  readonly activeShape = computed(() => this.resolveShape(this.effectiveCustomization().shapeId));

  readonly previewCard = computed<FlashcardItem>(() => this.currentCard() || {
    id: 'preview-card',
    type: 'qa',
    front: this.ai.currentLanguage() === 'ar' ? 'ما الفكرة الأساسية لهذا الدرس؟' : 'What is the core idea of this lesson?',
    back: this.ai.currentLanguage() === 'ar' ? 'الفكرة الأساسية تظهر هنا كإجابة واضحة ومركزة تساعدك على التذكر بسرعة.' : 'The main answer appears here in a clear focused way that helps quick recall.',
    difficulty: 'medium',
    hint: this.ai.currentLanguage() === 'ar' ? 'ركّز على الفكرة العامة' : 'Focus on the big idea',
    tags: [this.ai.currentLanguage() === 'ar' ? 'معاينة' : 'preview'],
    sourceSnippet: this.ai.currentLanguage() === 'ar' ? 'مقتطف قصير من المصدر الأصلي.' : 'A short source snippet.'
  });

  constructor() {
    this.bootstrapPage();

    effect(() => {
      this.synchronizeActiveCardSelection();
    });

    effect(() => {
      const cardId = this.currentCard()?.id;
      if (!cardId) return;

      const set = this.currentSet();
      if (!set) return;

      if (set.progress.currentCardId !== cardId || !set.progress.viewedCardIds.includes(cardId)) {
        this.patchCurrentSet({
          progress: {
            ...set.progress,
            currentCardId: cardId,
            viewedCardIds: set.progress.viewedCardIds.includes(cardId)
              ? set.progress.viewedCardIds
              : [...set.progress.viewedCardIds, cardId]
          }
        }, true);
      }
    });

    effect(() => {
      const activeCardId = this.activeCardId();
      const renderedCardId = this.currentCard()?.id || null;
      if (!activeCardId && !renderedCardId) {
        return;
      }

      console.debug('[flashcards] active-card-sync', {
        activeCardId,
        renderedCardId,
        currentFace: this.currentFace(),
        renderKey: this.activeCardRenderKey()
      });
    });

    effect(() => {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(FLASHCARD_UI_STORAGE_KEY, JSON.stringify(this.savedCustomization()));
    });

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => this.voices.set(window.speechSynthesis.getVoices());
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase();
    if (tagName === 'textarea' || tagName === 'input' || tagName === 'select') {
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.goToNextCard();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.goToPreviousCard();
      return;
    }

    if (event.key === ' ') {
      event.preventDefault();
      if (this.showCustomizationDrawer()) {
        this.previewFlipped.update(value => !value);
      } else {
        this.togglePrimaryReveal();
      }
    }
  }

  ngOnDestroy() {
    this.stopLoadingTicker();
    this.stopSpeech();
  }

  setDisplayMode(mode: FlashcardDisplayMode) {
    this.displayMode.set(mode);
    this.resetActiveCardPresentation('display-mode');
  }

  setFilterDifficulty(value: FlashcardFilterDifficulty) {
    this.filterDifficulty.set(value);
  }

  setFilterType(value: FlashcardFilterType) {
    this.filterType.set(value);
  }

  setFilterTag(value: string) {
    this.filterTag.set(value);
  }

  selectSidebarCard(cardId: string) {
    this.selectActiveCardById(cardId, 'sidebar');
  }

  canGenerate() {
    return this.sourceEditorText().trim().length > 0;
  }

  hasCards() {
    return this.visibleCardCount() > 0;
  }

  hasPreviousCard() {
    return this.currentCardIndex() > 0;
  }

  hasNextCard() {
    return this.currentCardIndex() >= 0 && this.currentCardIndex() < this.filteredQueueIds().length - 1;
  }

  currentIndexLabel() {
    return `${Math.max(this.currentCardIndex() + 1, 0)} / ${this.visibleCardCount()}`;
  }

  currentSetLanguage() {
    return this.currentSet()?.language || this.ai.currentLanguage();
  }

  private synchronizeActiveCardSelection() {
    const set = this.currentSet();
    const nextId = this.resolvePreferredCardId(set, this.activeCardId(), this.filteredQueueIds());
    if (this.activeCardId() !== nextId) {
      this.selectActiveCardById(nextId, 'sync', false);
    }
  }

  private selectActiveCardById(cardId: string | null, source: string, persist = true) {
    const set = this.currentSet();
    const resolvedId = this.resolvePreferredCardId(set, cardId, this.filteredQueueIds());
    const previousActiveCardId = this.activeCardId();
    const displayedBefore = this.currentCard()?.id || null;
    const shouldRefreshView = previousActiveCardId !== resolvedId || source !== 'sync';

    if (previousActiveCardId !== resolvedId) {
      this.activeCardId.set(resolvedId);
    }

    if (shouldRefreshView) {
      this.resetActiveCardPresentation(source);
    }

    if (persist && set && set.progress.currentCardId !== resolvedId) {
      this.patchCurrentSet({
        progress: {
          ...set.progress,
          currentCardId: resolvedId
        }
      }, true);
    }

    console.debug('[flashcards] select-active-card', {
      source,
      requestedCardId: cardId,
      resolvedCardId: resolvedId,
      previousActiveCardId,
      displayedBefore,
      displayedAfter: resolvedId
    });
  }

  private resetActiveCardPresentation(source: string) {
    this.isFlipped.set(false);
    this.showAnswer.set(false);
    this.showHint.set(false);
    this.currentFace.set('front');
    this.activeCardRenderTimestamp.set(this.nextRenderTimestamp());

    console.debug('[flashcards] reset-card-presentation', {
      source,
      activeCardId: this.activeCardId(),
      currentFace: this.currentFace(),
      renderKey: this.activeCardRenderKey()
    });
  }

  private nextRenderTimestamp() {
    const current = this.activeCardRenderTimestamp();
    const next = Date.now();
    return next > current ? next : current + 1;
  }

  private resolvePreferredCardId(
    set: SavedFlashcardSet | null,
    preferredId: string | null | undefined,
    candidateIds?: string[] | null
  ): string | null {
    if (!set || set.cards.length === 0) {
      return null;
    }

    const sourceIds = candidateIds !== undefined && candidateIds !== null
      ? candidateIds
      : set.progress.queue;
    const availableIds = sourceIds
      .filter(id => this.findCardById(set.cards, id) !== null);

    if (availableIds.length === 0 && candidateIds !== undefined && candidateIds !== null) {
      return null;
    }

    if (preferredId && availableIds.includes(preferredId)) {
      return preferredId;
    }

    if (set.progress.currentCardId && availableIds.includes(set.progress.currentCardId)) {
      return set.progress.currentCardId;
    }

    return availableIds.find(id => !!id) || set.cards.find(card => !!card.id)?.id || null;
  }

  private findCardById(cards: FlashcardItem[], cardId: string | null | undefined) {
    if (!cardId) return null;
    return cards.find(card => card.id === cardId) || null;
  }

  resolveBackTarget() {
    const sourceType = this.currentSet()?.sourceType || '';
    if (sourceType === 'mindmap') return 'mindmap';
    if (sourceType === 'tutor') return 'tutor';
    if (sourceType === 'research') return 'research';
    if (sourceType === 'transform') return 'transform';
    return 'overview';
  }

  openCustomizationPanel() {
    this.draftCustomization.set(this.cloneCustomization(this.savedCustomization()));
    this.previewFlipped.set(false);
    this.showCustomizationDrawer.set(true);
  }

  closeCustomizationPanel() {
    this.draftCustomization.set(this.cloneCustomization(this.savedCustomization()));
    this.previewFlipped.set(false);
    this.showCustomizationDrawer.set(false);
  }

  saveCustomization() {
    const next = this.normalizeCustomization(this.draftCustomization());
    this.savedCustomization.set(next);
    this.showCustomizationDrawer.set(false);
    this.previewFlipped.set(false);
    this.ns.show(
      this.ai.currentLanguage() === 'ar' ? 'تم حفظ التخصيص' : 'Customization Saved',
      this.ai.currentLanguage() === 'ar' ? 'سيتم تذكر ألوان وشكل البطاقة في زيارتك القادمة.' : 'Your card style will stay saved for your next visit.',
      'success',
      'fa-palette'
    );
  }

  resetCustomizationDraft() {
    this.draftCustomization.set(this.cloneCustomization(DEFAULT_CUSTOMIZATION));
    this.previewFlipped.set(false);
  }

  selectTheme(themeId: FlashcardThemeId) {
    const theme = this.resolveTheme(themeId);
    const current = this.draftCustomization();
    this.draftCustomization.set(this.normalizeCustomization({
      ...current,
      themeId,
      frontColor: theme.frontColor,
      backColor: theme.backColor,
      textColor: theme.textColor,
      borderColor: theme.borderColor,
      borderStyle: theme.defaultBorderStyle,
      motion: theme.defaultMotion
    }));
  }

  selectShape(shapeId: FlashcardShapeId) {
    this.draftCustomization.update(current => ({ ...current, shapeId }));
  }

  selectStylePreset(stylePreset: FlashcardStylePresetId) {
    const preset = this.resolveStylePreset(stylePreset);
    const theme = this.resolveTheme(preset.themeId);
    this.draftCustomization.set(this.normalizeCustomization({
      stylePreset,
      themeId: preset.themeId,
      shapeId: preset.shapeId,
      frontColor: theme.frontColor,
      backColor: theme.backColor,
      textColor: theme.textColor,
      borderColor: theme.borderColor,
      borderStyle: preset.borderStyle,
      autoContrast: true,
      motion: preset.motion
    }));
  }

  setBorderStyle(borderStyle: FlashcardBorderStyle) {
    this.draftCustomization.update(current => ({ ...current, borderStyle }));
  }

  setMotionStyle(motion: FlashcardMotionStyle) {
    this.draftCustomization.update(current => ({ ...current, motion }));
  }

  toggleAutoContrast() {
    this.draftCustomization.update(current => ({ ...current, autoContrast: !current.autoContrast }));
  }

  setDraftColor(slot: FlashcardColorSlot, color: string) {
    const normalized = normalizeHex(color, slot === 'textColor' ? '#f8fafc' : '#0f172a');
    this.draftCustomization.update(current => ({
      ...current,
      [slot]: normalized,
      autoContrast: slot === 'textColor' ? false : current.autoContrast
    }));
  }

  togglePreviewFlip() {
    this.previewFlipped.update(value => !value);
  }

  currentThemeLabel() {
    const theme = this.resolveTheme(this.savedCustomization().themeId);
    return this.ai.currentLanguage() === 'ar' ? theme.labelAr : theme.labelEn;
  }

  currentShapeLabel() {
    const shape = this.resolveShape(this.savedCustomization().shapeId);
    return this.ai.currentLanguage() === 'ar' ? shape.labelAr : shape.labelEn;
  }

  customizationButtonLabel() {
    return this.ai.currentLanguage() === 'ar' ? 'تخصيص' : 'Customize';
  }

  currentDisplayLabel() {
    const current = this.displayModes().find(mode => mode.id === this.displayMode());
    return current?.label || '';
  }

  revealButtonLabel() {
    if (this.displayMode() === 'classic') {
      return this.ai.currentLanguage() === 'ar' ? 'اقلب البطاقة' : 'Flip Card';
    }
    return this.showAnswer()
      ? (this.ai.currentLanguage() === 'ar' ? 'إخفاء الجواب' : 'Hide Answer')
      : (this.ai.currentLanguage() === 'ar' ? 'أظهر الجواب' : 'Show Answer');
  }

  cardSectionLabel(face: FlashcardFace) {
    return face === 'front'
      ? (this.ai.currentLanguage() === 'ar' ? 'الواجهة' : 'Front Side')
      : (this.ai.currentLanguage() === 'ar' ? 'الخلفية / الجواب' : 'Back Side');
  }

  cardModeCaption() {
    if (this.displayMode() === 'classic') {
      return this.cardSectionLabel(this.currentFace());
    }
    if (this.displayMode() === 'rapid') {
      return this.ai.currentLanguage() === 'ar' ? 'الدراسة السريعة' : 'Rapid Study';
    }
    if (this.displayMode() === 'self_test') {
      return this.ai.currentLanguage() === 'ar' ? 'الاختبار الذاتي' : 'Self-Test';
    }
    return this.ai.currentLanguage() === 'ar' ? 'وضع التمرير' : 'Reels Mode';
  }

  themeChipStyle(themeId: FlashcardThemeId) {
    const theme = this.resolveTheme(themeId);
    return {
      background: `linear-gradient(135deg, ${rgbString(shiftHex(theme.frontColor, 16), 0.96)} 0%, ${rgbString(theme.backColor, 0.98)} 100%)`,
      borderColor: rgbString(theme.borderColor, 0.36),
      color: contrastTextColor(theme.frontColor),
      boxShadow: `0 18px 42px ${rgbString(theme.accentColor, 0.18)}`
    };
  }

  accentButtonStyle(preview = false) {
    const theme = preview ? this.resolveTheme(this.draftCustomization().themeId) : this.activeTheme();
    return {
      background: `linear-gradient(135deg, ${rgbString(theme.accentColor, 0.96)} 0%, ${rgbString(theme.secondaryColor, 0.9)} 100%)`,
      color: contrastTextColor(theme.accentColor),
      boxShadow: `0 18px 36px ${rgbString(theme.accentColor, 0.24)}`
    };
  }

  cardSceneStyle(flipped: boolean, preview = false) {
    const settings = preview ? this.draftCustomization() : this.effectiveCustomization();
    const theme = this.resolveTheme(settings.themeId);
    const motion = settings.motion;
    const duration = motion === 'soft' ? '820ms' : motion === 'dynamic' ? '560ms' : '680ms';
    const scale = motion === 'soft' ? '1.01' : motion === 'dynamic' ? '1.02' : '1.014';
    const lift = motion === 'soft' ? '4px' : motion === 'dynamic' ? '8px' : '6px';
    return {
      '--flashcard-rotation': flipped ? '180deg' : '0deg',
      '--flashcard-duration': duration,
      '--flashcard-hover-scale': scale,
      '--flashcard-hover-lift': lift,
      '--flashcard-depth-shadow': `0 42px 90px ${rgbString(theme.accentColor, 0.26)}`,
      '--flashcard-sheen': rgbString(theme.secondaryColor, 0.34)
    } as Record<string, string>;
  }

  cardFaceStyle(face: FlashcardFace, preview = false) {
    const settings = preview ? this.draftCustomization() : this.effectiveCustomization();
    const theme = this.resolveTheme(settings.themeId);
    const baseColor = normalizeHex(face === 'front' ? settings.frontColor : settings.backColor);
    const textColor = settings.autoContrast ? contrastTextColor(baseColor) : normalizeHex(settings.textColor, theme.textColor);
    const borderColor = normalizeHex(settings.borderColor, theme.borderColor);
    const topTint = mixHex(baseColor, '#ffffff', 0.14);
    const deepTint = mixHex(baseColor, '#020617', 0.32);
    return {
      background: `radial-gradient(circle at 18% 18%, ${rgbString(topTint, 0.92)} 0%, transparent 34%), linear-gradient(145deg, ${rgbString(shiftHex(baseColor, 12), 0.96)} 0%, ${rgbString(baseColor, 0.97)} 46%, ${rgbString(deepTint, 0.98)} 100%)`,
      color: textColor,
      borderColor: rgbString(borderColor, settings.borderStyle === 'glow' ? 0.7 : 0.36),
      boxShadow: `0 32px 74px ${rgbString(theme.accentColor, face === 'front' ? 0.16 : 0.12)}, inset 0 1px 0 rgba(255,255,255,${luminance(baseColor) > 0.55 ? 0.22 : 0.08})`,
      '--card-accent': theme.accentColor,
      '--card-secondary': theme.secondaryColor,
      '--card-border-solid': borderColor,
      '--card-text-color': textColor,
      '--card-muted-color': luminance(baseColor) > 0.55 ? '#334155' : '#cbd5e1',
      '--card-pattern-opacity': face === 'front' ? '0.18' : '0.14'
    } as Record<string, string>;
  }

  facePatternClass(preview = false) {
    const settings = preview ? this.draftCustomization() : this.effectiveCustomization();
    return `pattern-${this.resolveTheme(settings.themeId).pattern}`;
  }

  faceAttributeTheme(preview = false) {
    const settings = preview ? this.draftCustomization() : this.effectiveCustomization();
    return this.resolveTheme(settings.themeId).id;
  }

  faceAttributeShape(preview = false) {
    const settings = preview ? this.draftCustomization() : this.effectiveCustomization();
    return this.resolveShape(settings.shapeId).id;
  }

  faceAttributeBorder(preview = false) {
    const settings = preview ? this.draftCustomization() : this.effectiveCustomization();
    return settings.borderStyle;
  }

  faceAttributeMotion(preview = false) {
    const settings = preview ? this.draftCustomization() : this.effectiveCustomization();
    return settings.motion;
  }

  typeChipStyle(type: FlashcardType, preview = false) {
    const theme = preview ? this.resolveTheme(this.draftCustomization().themeId) : this.activeTheme();
    const map: Record<FlashcardType, string> = {
      qa: theme.accentColor,
      definition: theme.secondaryColor,
      cause_effect: '#f97316',
      comparison: '#8b5cf6',
      steps: '#10b981',
      true_false: '#f59e0b',
      application: '#38bdf8',
      rapid_recall: '#f472b6',
      difficult_concept: '#ef4444',
      final_review: '#facc15'
    };
    const color = map[type] || theme.accentColor;
    return {
      borderColor: rgbString(color, 0.34),
      background: rgbString(color, 0.12),
      color: contrastTextColor(color) === '#0f172a' ? '#082f49' : '#f8fafc'
    };
  }

  difficultyChipStyle(level: FlashcardDifficulty) {
    const color = level === 'easy' ? '#10b981' : level === 'medium' ? '#f59e0b' : '#e11d48';
    return {
      borderColor: rgbString(color, 0.3),
      background: rgbString(color, 0.14),
      color: contrastTextColor(color) === '#0f172a' ? '#0f172a' : '#fff7ed'
    };
  }

  reviewChipStyle(level: FlashcardReviewState) {
    const color = level === 'easy' ? '#10b981' : level === 'medium' ? '#f59e0b' : '#38bdf8';
    return {
      borderColor: rgbString(color, 0.28),
      background: rgbString(color, 0.1),
      color: contrastTextColor(color) === '#0f172a' ? '#0f172a' : '#f8fafc'
    };
  }

  async generateFromEditor() {
    const sourceText = this.sourceEditorText().trim();
    if (!sourceText) return;

    const baseSet = this.currentSet() || this.flashcards.createEmptySet();
    await this.generateCards({
      sourceText,
      sourceType: baseSet.sourceType || 'manual',
      sourceTitle: baseSet.sourceTitle || (this.ai.currentLanguage() === 'ar' ? 'من إدخال يدوي' : 'From Manual Input'),
      conversationId: baseSet.conversationId,
      messageId: baseSet.messageId,
      language: baseSet.language || this.ai.currentLanguage(),
      groupName: baseSet.name
    }, 'standard');
  }

  async regenerateSet() {
    const set = this.currentSet();
    const sourceText = this.sourceEditorText().trim() || set?.sourceText || '';
    if (!set || !sourceText) return;

    await this.generateCards({
      sourceText,
      sourceType: set.sourceType,
      sourceTitle: set.sourceTitle,
      conversationId: set.conversationId,
      messageId: set.messageId,
      language: set.language,
      groupName: set.name
    }, 'standard');
  }

  async generateWithMode(mode: FlashcardGenerationMode) {
    const set = this.currentSet();
    const sourceText = this.sourceEditorText().trim() || set?.sourceText || '';
    if (!set || !sourceText) return;

    await this.generateCards({
      sourceText,
      sourceType: set.sourceType,
      sourceTitle: set.sourceTitle,
      conversationId: set.conversationId,
      messageId: set.messageId,
      language: set.language,
      groupName: set.name
    }, mode);
  }

  saveCurrentSet() {
    const set = this.currentSet();
    if (!set) return;
    this.currentSet.set(this.flashcards.saveSet(this.normalizedCurrentSet(set)));
  }

  notifyExportSoon() {
    this.ns.show(
      this.ai.currentLanguage() === 'ar' ? 'التصدير قادم' : 'Export Coming Soon',
      this.ai.currentLanguage() === 'ar'
        ? 'زر التصدير محجوز للتحديث القادم دون تغيير الصفحة الحالية.'
        : 'The export action is reserved for the next update without changing the current page.',
      'info',
      'fa-file-export'
    );
  }

  clearEditor() {
    this.sourceEditorText.set('');
    if (!this.currentSet()?.cards.length) {
      this.selectActiveCardById(null, 'clear-editor', false);
      this.currentSet.set(null);
    }
  }

  loadSavedSet(setId: string) {
    const saved = this.flashcards.getSavedSet(setId);
    if (!saved) return;
    this.flashcards.setActiveSet(saved.id);
    this.currentSet.set(this.cloneSet(saved));
    this.selectActiveCardById(saved.progress.currentCardId || null, 'load-saved-set', false);
    this.sourceEditorText.set(saved.sourceText);
    this.errorMessage.set('');
  }

  deleteSavedSet(setId: string, event: Event) {
    event.stopPropagation();
    this.flashcards.deleteSavedSet(setId);
    if (this.currentSet()?.id === setId) {
      const fallback = this.flashcards.activeSet();
      if (fallback) {
        this.currentSet.set(this.cloneSet(fallback));
        this.selectActiveCardById(fallback.progress.currentCardId || null, 'delete-saved-set-fallback', false);
        this.sourceEditorText.set(fallback.sourceText);
      } else {
        this.selectActiveCardById(null, 'delete-saved-set-empty', false);
        this.currentSet.set(null);
        this.sourceEditorText.set('');
      }
    }
  }

  goToPreviousCard() {
    const queue = this.filteredQueueIds();
    const currentIndex = this.currentCardIndex();
    if (currentIndex <= 0) return;
    this.selectActiveCardById(queue[currentIndex - 1], 'previous-card');
  }

  goToNextCard() {
    const queue = this.filteredQueueIds();
    const currentIndex = this.currentCardIndex();
    if (currentIndex < 0 || currentIndex >= queue.length - 1) return;
    this.selectActiveCardById(queue[currentIndex + 1], 'next-card');
  }

  toggleCardFace() {
    this.isFlipped.update(value => {
      const next = !value;
      this.currentFace.set(next ? 'back' : 'front');
      return next;
    });
  }

  revealAnswer() {
    this.showAnswer.update(value => {
      const next = !value;
      this.currentFace.set(next ? 'back' : 'front');
      return next;
    });
  }

  toggleHint() {
    this.showHint.update(value => !value);
  }

  togglePrimaryReveal() {
    if (this.displayMode() === 'classic') {
      this.toggleCardFace();
      return;
    }
    this.revealAnswer();
  }

  interactWithCardStage() {
    this.togglePrimaryReveal();
  }

  interactWithPreviewStage() {
    this.togglePreviewFlip();
  }

  handleStageKeydown(event: KeyboardEvent, preview = false) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    if (preview) {
      this.interactWithPreviewStage();
      return;
    }

    this.interactWithCardStage();
  }

  async rateCurrentCard(reviewState: Exclude<FlashcardReviewState, null>) {
    const set = this.currentSet();
    const currentCard = this.currentCard();
    if (!set || !currentCard) return;
    const visibleQueue = this.filteredQueueIds();
    const visibleIndex = visibleQueue.findIndex(id => id === currentCard.id);

    const cards = set.cards.map(card => card.id === currentCard.id
      ? { ...card, reviewState, mastered: reviewState === 'easy' }
      : card);

    const queueWithoutCurrent = set.progress.queue.filter(id => id !== currentCard.id);
    const insertionIndex = reviewState === 'hard'
      ? Math.min(1, queueWithoutCurrent.length)
      : reviewState === 'medium'
        ? Math.min(3, queueWithoutCurrent.length)
        : queueWithoutCurrent.length;
    const nextQueue = [...queueWithoutCurrent];
    nextQueue.splice(insertionIndex, 0, currentCard.id);

    const completedCardIds = set.progress.completedCardIds.includes(currentCard.id)
      ? set.progress.completedCardIds
      : [...set.progress.completedCardIds, currentCard.id];
    const nextVisibleId = visibleIndex >= 0
      ? visibleQueue[visibleIndex + 1] || visibleQueue[visibleIndex - 1] || null
      : null;

    this.patchCurrentSet({
      cards,
      progress: {
        ...set.progress,
        queue: nextQueue,
        currentCardId: nextVisibleId || queueWithoutCurrent[0] || nextQueue[0] || null,
        completedCardIds
      }
    }, true);
  }

  async openQuiz() {
    const set = this.currentSet();
    if (!set || set.cards.length === 0 || !this.guardUsage()) return;

    this.errorMessage.set('');
    this.isCompletingQuiz = false;
    this.startBusy('quiz');
    try {
      this.quizQuestions.set(await this.flashcards.generateQuiz(set.cards, set.name));
      this.quizSelections.set({});
      this.showQuizModal.set(true);
      this.ai.incrementUsage('aiTeacherQuestions');
    } catch (error) {
      console.error('Quiz generation failed:', error);
      this.errorMessage.set(this.ai.currentLanguage() === 'ar'
        ? 'تعذر توليد الاختبار من البطاقات الحالية.'
        : 'Could not generate a quiz from the current cards.');
    } finally {
      this.stopBusy();
    }
  }

  closeQuizModal() {
    this.resetQuizState();
  }

  selectQuizOption(questionId: string, optionIndex: number) {
    if (this.quizSelectedOption(questionId) !== null || this.isCompletingQuiz) return;
    let nextSelections: Record<string, number> = {};
    this.quizSelections.update(current => {
      nextSelections = { ...current, [questionId]: optionIndex };
      return nextSelections;
    });

    if (this.quizQuestions().length > 0 && Object.keys(nextSelections).length >= this.quizQuestions().length) {
      this.isCompletingQuiz = true;
      window.setTimeout(() => this.finishQuizAttempt(), 180);
    }
  }

  quizSelectedOption(questionId: string) {
    const value = this.quizSelections()[questionId];
    return typeof value === 'number' ? value : null;
  }

  hasAnsweredQuizQuestion(questionId: string) {
    return this.quizSelectedOption(questionId) !== null;
  }

  isCorrectQuizOption(question: FlashcardQuizQuestion, optionIndex: number) {
    return this.hasAnsweredQuizQuestion(question.id) && question.answerIndex === optionIndex;
  }

  isWrongSelectedQuizOption(question: FlashcardQuizQuestion, optionIndex: number) {
    const selected = this.quizSelectedOption(question.id);
    return selected !== null && selected === optionIndex && question.answerIndex !== optionIndex;
  }

  async buildArtifact(kind: FlashcardArtifactKind) {
    const set = this.currentSet();
    if (!set || set.cards.length === 0 || !this.guardUsage()) return;

    this.errorMessage.set('');
    this.startBusy('artifact');
    try {
      const text = await this.flashcards.generateArtifact(kind, set.cards, set.name);
      this.artifactTitle.set(this.artifactLabel(kind));
      this.artifactContent.set(text);
      this.ai.incrementUsage('aiTeacherQuestions');
    } catch (error) {
      console.error('Artifact generation failed:', error);
      this.errorMessage.set(this.ai.currentLanguage() === 'ar'
        ? 'تعذر إنشاء المخرج المطلوب من البطاقات الحالية.'
        : 'Could not generate the requested artifact from the current cards.');
    } finally {
      this.stopBusy();
    }
  }

  copyArtifact() {
    if (!this.artifactContent()) return;
    navigator.clipboard.writeText(this.artifactContent());
    this.ns.show(
      this.ai.currentLanguage() === 'ar' ? 'تم النسخ' : 'Copied',
      this.ai.currentLanguage() === 'ar' ? 'تم نسخ المحتوى المولد إلى الحافظة.' : 'The generated content was copied to the clipboard.',
      'success',
      'fa-copy'
    );
  }

  speakCurrentCard() {
    const card = this.currentCard();
    if (!card || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (this.speakingCardId() === card.id) {
      this.stopSpeech();
      return;
    }

    this.stopSpeech();
    const text = `${card.front}. ${card.back}`;
    const language = this.detectSpeechLanguage(text, this.currentSetLanguage());
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 0.96;
    utterance.pitch = 1;
    const voice = this.resolveSpeechVoice(language);
    if (voice) utterance.voice = voice;
    utterance.onstart = () => this.speakingCardId.set(card.id);
    utterance.onend = () => this.speakingCardId.set(null);
    utterance.onerror = () => this.speakingCardId.set(null);
    window.speechSynthesis.speak(utterance);
  }

  sourceTypeLabel(sourceType: string) {
    const map: Record<string, { ar: string; en: string }> = {
      tutor: { ar: 'المعلم الذكي', en: 'AI Tutor' },
      research: { ar: 'البحث الأكاديمي', en: 'Academic Research' },
      transform: { ar: 'تحويل المحتوى', en: 'Content Transform' },
      manual: { ar: 'إدخال يدوي', en: 'Manual Input' },
      };
    const label = map[sourceType] || { ar: 'مصدر مخصص', en: 'Custom Source' };
    return this.ai.currentLanguage() === 'ar' ? label.ar : label.en;
  }

  cardTypeLabel(type: FlashcardType) {
    const labels: Record<FlashcardType, { ar: string; en: string }> = {
      qa: { ar: 'سؤال / جواب', en: 'Q / A' },
      definition: { ar: 'تعريف / مصطلح', en: 'Definition' },
      cause_effect: { ar: 'سبب / نتيجة', en: 'Cause / Effect' },
      comparison: { ar: 'مقارنة', en: 'Comparison' },
      steps: { ar: 'خطوات / ترتيب', en: 'Steps' },
      true_false: { ar: 'صح أو خطأ', en: 'True / False' },
      application: { ar: 'تطبيق عملي', en: 'Application' },
      rapid_recall: { ar: 'تذكر سريع', en: 'Rapid Recall' },
      difficult_concept: { ar: 'مفهوم صعب', en: 'Difficult Concept' },
      final_review: { ar: 'مراجعة نهائية', en: 'Final Review' }
    };
    return this.ai.currentLanguage() === 'ar' ? labels[type].ar : labels[type].en;
  }

  cardTypeIcon(type: FlashcardType) {
    const icons: Record<FlashcardType, string> = {
      qa: 'fa-circle-question',
      definition: 'fa-book-open',
      cause_effect: 'fa-arrows-turn-to-dots',
      comparison: 'fa-code-compare',
      steps: 'fa-list-ol',
      true_false: 'fa-check-double',
      application: 'fa-flask',
      rapid_recall: 'fa-bolt',
      difficult_concept: 'fa-brain',
      final_review: 'fa-graduation-cap'
    };
    return icons[type];
  }

  difficultyLabel(level: FlashcardDifficulty) {
    return this.ai.currentLanguage() === 'ar'
      ? ({ easy: 'سهلة', medium: 'متوسطة', hard: 'صعبة' }[level])
      : level.charAt(0).toUpperCase() + level.slice(1);
  }

  reviewStateLabel(level: FlashcardReviewState) {
    return level ? this.difficultyLabel(level) : (this.ai.currentLanguage() === 'ar' ? 'بدون تقييم' : 'Not Rated');
  }

  artifactLabel(kind: FlashcardArtifactKind) {
    const labels: Record<FlashcardArtifactKind, { ar: string; en: string }> = {
      summary: { ar: 'ملخص من البطاقات', en: 'Summary From Cards' },
      mind_map: { ar: 'خريطة ذهنية', en: 'Mind Map' },
      difficult_points: { ar: 'تبسيط النقاط الصعبة', en: 'Difficult Points Simplified' },
      study_plan: { ar: 'خطة مراجعة', en: 'Study Plan' },
      exam_sprint: { ar: 'مراجعة سريعة قبل الامتحان', en: 'Exam Sprint Review' }
    };
    return this.ai.currentLanguage() === 'ar' ? labels[kind].ar : labels[kind].en;
  }

  resolveTextDirection(text: string, fallbackLanguage: LanguageCode) {
    return containsArabicScript(text) || fallbackLanguage === 'ar' ? 'rtl' : 'ltr';
  }

  resolveTextLanguage(text: string, fallbackLanguage: LanguageCode) {
    return containsArabicScript(text) ? 'ar' : fallbackLanguage;
  }

  quizOptionLabel(index: number) {
    return ['A', 'B', 'C', 'D'][index] || String(index + 1);
  }

  busyActionLabel() {
    if (this.busyAction() === 'quiz') return this.ai.currentLanguage() === 'ar' ? 'يتم بناء الاختبار' : 'Building Quiz';
    if (this.busyAction() === 'artifact') return this.ai.currentLanguage() === 'ar' ? 'يتم توليد المخرج' : 'Generating Artifact';
    return this.ai.currentLanguage() === 'ar' ? 'يتم بناء البطاقات' : 'Building Flashcards';
  }

  closeUpgradeModal() {
    this.showUpgradeModal.set(false);
  }

  private bootstrapPage() {
    const launchContext = this.flashcards.consumeLaunchContext();
    if (launchContext?.sourceText?.trim()) {
      const starterSet = this.flashcards.createEmptySet(launchContext);
      this.currentSet.set(starterSet);
      this.selectActiveCardById(starterSet.progress.currentCardId || null, 'bootstrap-launch-context', false);
      this.sourceEditorText.set(launchContext.sourceText);
      void this.generateCards(launchContext, 'standard');
      return;
    }

    const activeSet = this.flashcards.activeSet();
    if (activeSet) {
      this.currentSet.set(this.cloneSet(activeSet));
      this.selectActiveCardById(activeSet.progress.currentCardId || null, 'bootstrap-active-set', false);
      this.sourceEditorText.set(activeSet.sourceText);
      return;
    }

    this.selectActiveCardById(null, 'bootstrap-empty', false);
    this.currentSet.set(null);
    this.sourceEditorText.set('');
  }

  private async generateCards(context: FlashcardLaunchContext, mode: FlashcardGenerationMode) {
    if (!this.guardUsage()) return;

    this.errorMessage.set('');
    this.startBusy('generate');
    try {
      const result = await this.flashcards.generateSet(context, mode);
      const baseSet = this.currentSet() || this.flashcards.createEmptySet(context);
      const cards = mode === 'more' ? this.mergeCards(baseSet.cards, result.cards) : result.cards;
      const progress = mode === 'more' && baseSet.cards.length > 0
        ? this.mergeProgress(baseSet, cards)
        : this.flashcards.createInitialProgress(cards);

      const nextSet: SavedFlashcardSet = {
        ...baseSet,
        name: result.setTitle,
        sourceText: result.sourceText,
        sourceType: context.sourceType,
        sourceTitle: context.sourceTitle,
        conversationId: context.conversationId,
        messageId: context.messageId,
        language: context.language || this.ai.currentLanguage(),
        cards,
        progress,
        updatedAt: new Date().toISOString()
      };

      this.currentSet.set(this.flashcards.saveSet(this.normalizedCurrentSet(nextSet), { silent: true }));
      this.selectActiveCardById(nextSet.progress.currentCardId || null, 'generate-cards', false);
      this.sourceEditorText.set(result.sourceText);
      this.artifactContent.set('');
      this.artifactTitle.set('');
      this.flashcards.setActiveSet(nextSet.id);
      this.ai.incrementUsage('aiTeacherQuestions');
      this.ai.awardXPForAction('flashcards', mode === 'standard' ? 18 : 12, {
        fingerprint: `flashcards:${nextSet.id}`
      });
    } catch (error) {
      console.error('Flashcard generation failed:', error);
      const errorCode = error instanceof Error ? error.message : '';
      if (errorCode === 'FLASHCARD_SOURCE_EMPTY') {
        this.errorMessage.set(this.ai.currentLanguage() === 'ar'
          ? 'لا يوجد محتوى كافٍ لتوليد البطاقات.'
          : 'There is not enough content to generate flashcards.');
      } else if (errorCode === 'FLASHCARD_SOURCE_TOO_WEAK') {
        this.errorMessage.set(this.ai.currentLanguage() === 'ar'
          ? 'المحتوى الحالي قصير جدًا أو غير واضح لتوليد بطاقات مفيدة.'
          : 'The current content is too short or unclear to build useful flashcards.');
      } else {
        this.errorMessage.set(this.ai.currentLanguage() === 'ar'
          ? 'تعذر توليد البطاقات من المحتوى الحالي. حاول بصياغة أوضح.'
          : 'Could not generate flashcards from the current content. Try a clearer source.');
      }
    } finally {
      this.stopBusy();
    }
  }

  private mergeCards(existing: FlashcardItem[], incoming: FlashcardItem[]) {
    const seen = new Set(existing.map(card => `${card.front}__${card.back}`.toLowerCase()));
    const extras = incoming.filter(card => {
      const key = `${card.front}__${card.back}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return [...existing, ...extras];
  }

  private mergeProgress(set: SavedFlashcardSet, cards: FlashcardItem[]) {
    const currentQueue = set.progress.queue.filter(id => cards.some(card => card.id === id));
    const newIds = cards.map(card => card.id).filter(id => !currentQueue.includes(id));
    const nextProgressQueue = [...currentQueue, ...newIds];
    return {
      ...set.progress,
      currentCardId: this.resolvePreferredCardId({ ...set, cards, progress: { ...set.progress, queue: nextProgressQueue } }, set.progress.currentCardId, nextProgressQueue),
      completedCardIds: set.progress.completedCardIds.filter(id => cards.some(card => card.id === id)),
      viewedCardIds: set.progress.viewedCardIds.filter(id => cards.some(card => card.id === id)),
      queue: nextProgressQueue
    };
  }

  private guardUsage() {
    const limitCheck = this.ai.checkLimit('aiTeacherQuestions');
    if (!limitCheck.allowed) {
      this.upgradeMessage.set(limitCheck.message);
      this.showUpgradeModal.set(true);
      return false;
    }
    return true;
  }

  private finishQuizAttempt() {
    const set = this.currentSet();
    const questions = this.quizQuestions();
    const selections = this.quizSelections();

    if (!set || questions.length === 0) {
      this.isCompletingQuiz = false;
      this.resetQuizState();
      return;
    }

    const correctAnswers = questions.reduce((count, question) => (
      selections[question.id] === question.answerIndex ? count + 1 : count
    ), 0);
    const score = Math.round((correctAnswers / questions.length) * 100);
    const wrongCardIds = Array.from(new Set(
      questions
        .filter(question => selections[question.id] !== question.answerIndex)
        .map(question => question.cardId || '')
        .filter(Boolean)
    ));

    const cards = set.cards.map(card => wrongCardIds.includes(card.id)
      ? { ...card, reviewState: 'hard' as FlashcardReviewState, mastered: false }
      : card);
    const attempt: FlashcardQuizAttempt = {
      id: crypto.randomUUID(),
      completedAt: new Date().toISOString(),
      score,
      correctAnswers,
      totalQuestions: questions.length,
      wrongCardIds
    };

    this.patchCurrentSet({
      cards,
      quizHistory: [attempt, ...(set.quizHistory || [])].slice(0, 20)
    }, true);

    this.ai.quizzesCompleted.update(count => count + 1);
    this.ai.addPerformanceRecord({
      date: attempt.completedAt,
      score,
      type: 'quiz',
      subject: set.name,
      grade: this.ai.getGrade(score)
    });

    this.ns.show(
      this.ai.currentLanguage() === 'ar' ? 'انتهى الاختبار وتم الحفظ' : 'Quiz Completed And Saved',
      this.ai.currentLanguage() === 'ar'
        ? `تم حفظ نتيجتك ${score}%${wrongCardIds.length ? ` ويوجد ${wrongCardIds.length} بطاقة لازم تحفظها.` : '.'}`
        : `Your ${score}% result was saved${wrongCardIds.length ? ` and ${wrongCardIds.length} card(s) now need review.` : '.'}`,
      score >= 60 ? 'success' : 'warning',
      'fa-clipboard-question'
    );

    this.isCompletingQuiz = false;
    this.resetQuizState();
    this.back.emit('overview');
  }

  private resetQuizState() {
    this.showQuizModal.set(false);
    this.quizSelections.set({});
    this.quizQuestions.set([]);
    this.isCompletingQuiz = false;
  }

  private patchCurrentSet(patch: Partial<SavedFlashcardSet>, silent = true) {
    const current = this.currentSet();
    if (!current) return;
    const nextSet = this.normalizedCurrentSet({
      ...current,
      ...patch,
      updatedAt: new Date().toISOString()
    });
    this.currentSet.set(nextSet);
    this.flashcards.saveSet(nextSet, { silent });
  }

  private normalizedCurrentSet(set: SavedFlashcardSet) {
    const cards = set.cards.map(card => ({ ...card, tags: (card.tags || []).filter(Boolean).slice(0, 8) }));
    const queue = set.progress.queue.filter(id => cards.some(card => card.id === id));
    const missingIds = cards.map(card => card.id).filter(id => !queue.includes(id));
    return {
      ...set,
      name: set.name.trim() || (this.ai.currentLanguage() === 'ar' ? 'مجموعة مراجعة ذكية' : 'Smart Review Set'),
      sourceText: (this.sourceEditorText().trim() || set.sourceText || '').trim(),
      cards,
      progress: {
        ...set.progress,
        currentCardId: this.resolvePreferredCardId({ ...set, cards, progress: { ...set.progress, queue: [...queue, ...missingIds] } }, set.progress.currentCardId, [...queue, ...missingIds]),
        completedCardIds: set.progress.completedCardIds.filter(id => cards.some(card => card.id === id)),
        viewedCardIds: set.progress.viewedCardIds.filter(id => cards.some(card => card.id === id)),
        queue: [...queue, ...missingIds]
      }
    };
  }

  private cloneSet(set: SavedFlashcardSet) {
    return JSON.parse(JSON.stringify(set)) as SavedFlashcardSet;
  }

  private cloneCustomization(settings: FlashcardCustomizationSettings) {
    return JSON.parse(JSON.stringify(settings)) as FlashcardCustomizationSettings;
  }

  private normalizeCustomization(settings: FlashcardCustomizationSettings): FlashcardCustomizationSettings {
    const theme = this.resolveTheme(settings.themeId);
    const shape = this.resolveShape(settings.shapeId);
    const stylePreset = this.resolveStylePreset(settings.stylePreset);
    const validBorderStyles: FlashcardBorderStyle[] = ['soft', 'solid', 'dashed', 'double', 'glow'];
    const validMotionStyles: FlashcardMotionStyle[] = ['soft', 'balanced', 'dynamic'];
    return {
      themeId: theme.id,
      shapeId: shape.id,
      stylePreset: stylePreset.id,
      frontColor: normalizeHex(settings.frontColor || theme.frontColor, theme.frontColor),
      backColor: normalizeHex(settings.backColor || theme.backColor, theme.backColor),
      textColor: normalizeHex(settings.textColor || theme.textColor, theme.textColor),
      borderColor: normalizeHex(settings.borderColor || theme.borderColor, theme.borderColor),
      borderStyle: validBorderStyles.includes(settings.borderStyle) ? settings.borderStyle : theme.defaultBorderStyle,
      autoContrast: settings.autoContrast ?? true,
      motion: validMotionStyles.includes(settings.motion) ? settings.motion : theme.defaultMotion
    };
  }

  private loadCustomization(): FlashcardCustomizationSettings {
    if (typeof localStorage === 'undefined') {
      return this.cloneCustomization(DEFAULT_CUSTOMIZATION);
    }

    try {
      const raw = localStorage.getItem(FLASHCARD_UI_STORAGE_KEY);
      if (!raw) {
        return this.cloneCustomization(DEFAULT_CUSTOMIZATION);
      }
      return this.normalizeCustomization(JSON.parse(raw) as FlashcardCustomizationSettings);
    } catch {
      return this.cloneCustomization(DEFAULT_CUSTOMIZATION);
    }
  }

  private resolveTheme(themeId: FlashcardThemeId) {
    return FLASHCARD_THEMES.find(theme => theme.id === themeId) || DEFAULT_THEME;
  }

  private resolveShape(shapeId: FlashcardShapeId) {
    return FLASHCARD_SHAPES.find(shape => shape.id === shapeId) || FLASHCARD_SHAPES[0];
  }

  private resolveStylePreset(stylePreset: FlashcardStylePresetId) {
    return FLASHCARD_STYLE_PRESETS.find(preset => preset.id === stylePreset) || FLASHCARD_STYLE_PRESETS[0];
  }

  private startBusy(action: 'generate' | 'artifact' | 'quiz') {
    this.isBusy.set(true);
    this.busyAction.set(action);
    this.startLoadingTicker();
  }

  private stopBusy() {
    this.isBusy.set(false);
    this.busyAction.set(null);
    this.stopLoadingTicker();
  }

  private startLoadingTicker() {
    this.stopLoadingTicker();
    this.loadingMessageIndex.set(0);
    this.loadingTimer = window.setInterval(() => {
      const next = (this.loadingMessageIndex() + 1) % this.loadingMessages().length;
      this.loadingMessageIndex.set(next);
    }, 1400);
  }

  private stopLoadingTicker() {
    if (this.loadingTimer !== null) {
      window.clearInterval(this.loadingTimer);
      this.loadingTimer = null;
    }
  }

  private stopSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.speakingCardId.set(null);
  }

  private detectSpeechLanguage(text: string, fallbackLanguage: LanguageCode) {
    if (/[\u0600-\u06FF]/.test(text)) return 'ar-SA';
    const lower = text.toLowerCase();
    if (/[àâçéèêëîïôûùüÿœ]/.test(lower)) return 'fr-FR';
    if (/[áéíóúñ¿¡]/.test(lower)) return 'es-ES';
    if (/[äöüß]/.test(lower)) return 'de-DE';
    return fallbackLanguage === 'ar' ? 'ar-SA' : 'en-US';
  }

  private resolveSpeechVoice(lang: string) {
    const languageCode = lang.toLowerCase().split('-')[0];
    return this.voices().find(voice => voice.lang.toLowerCase().startsWith(languageCode))
      || this.voices().find(voice => voice.lang.toLowerCase() === lang.toLowerCase());
  }
}
