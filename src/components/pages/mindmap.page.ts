import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild, computed, effect, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { AIService } from '../../services/ai.service';
import { FlashcardsService } from '../../services/flashcards.service';
import {
  DEFAULT_MINDMAP_CUSTOMIZATION,
  KnowledgeBoardState,
  MindMapBackgroundMode,
  MindMapCustomizationSettings,
  MindMapDirection,
  MindMapGenerationMode,
  MindMapLineStyle,
  MindMapNode,
  MindMapNodeSize,
  MindMapNodeReviewState,
  MindMapNodeShape,
  MindMapNodeType,
  MindMapQuizAttempt,
  MindMapService,
  MindMapThemeId,
  MindMapVisualMode,
  MindMapViewMode,
  MindMapWorkspaceSurface,
  SavedMindMap,
  SmartKnowledgeConnection,
  SmartKnowledgeConnectionKind,
  SmartKnowledgeNode
} from '../../services/mindmap.service';
import { NotificationService } from '../../services/notification.service';
import { UpgradeModal } from '../shared/upgrade-modal.component';
import { LanguageCode } from '../../i18n/language-config';

interface MindMapThemeDefinition {
  id: MindMapThemeId;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  canvasBackground: string;
  surface: string;
  lineColor: string;
  accentColor: string;
  secondaryColor: string;
  rootColor: string;
  mainColor: string;
  subColor: string;
  detailColor: string;
  glow: string;
}

interface MindMapQuizQuestion {
  id: string;
  nodeId?: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
}

interface SmartKnowledgeNodeDraft {
  id: string | null;
  title: string;
  explanation: string;
  bulletsText: string;
  imageUrl: string;
  icon: string;
  sourceLabel: string;
  accentColor: string;
}

type MindMapLayoutPreset = 'center' | 'top_down' | 'rtl_academic' | 'compact_study';

const MINDMAP_THEMES: MindMapThemeDefinition[] = [
  {
    id: 'classic_academic',
    labelAr: 'Classic Academic',
    labelEn: 'Classic Academic',
    descriptionAr: 'ستايل أكاديمي متوازن وواضح للمذاكرة اليومية.',
    descriptionEn: 'Balanced academic styling for everyday study.',
    canvasBackground: 'radial-gradient(circle at top, rgba(56,189,248,0.14), transparent 28%), linear-gradient(180deg, #020617 0%, #0f172a 100%)',
    surface: 'rgba(15,23,42,0.88)',
    lineColor: 'rgba(125,211,252,0.35)',
    accentColor: '#38bdf8',
    secondaryColor: '#818cf8',
    rootColor: '#0ea5e9',
    mainColor: '#312e81',
    subColor: '#0f766e',
    detailColor: '#1e293b',
    glow: 'rgba(56,189,248,0.2)'
  },
  {
    id: 'dark_study',
    labelAr: 'Dark Study',
    labelEn: 'Dark Study',
    descriptionAr: 'غامق وهادئ ومناسب للمحتوى الجامعي العميق.',
    descriptionEn: 'Dark, calm, and strong for deep study.',
    canvasBackground: 'radial-gradient(circle at top right, rgba(168,85,247,0.14), transparent 26%), linear-gradient(180deg, #020617 0%, #111827 100%)',
    surface: 'rgba(2,6,23,0.9)',
    lineColor: 'rgba(148,163,184,0.3)',
    accentColor: '#f59e0b',
    secondaryColor: '#a78bfa',
    rootColor: '#78350f',
    mainColor: '#1e1b4b',
    subColor: '#1f2937',
    detailColor: '#111827',
    glow: 'rgba(245,158,11,0.18)'
  },
  {
    id: 'soft_minimal',
    labelAr: 'Soft Minimal',
    labelEn: 'Soft Minimal',
    descriptionAr: 'خلفية ناعمة وبطاقات نظيفة وخفيفة.',
    descriptionEn: 'Clean surfaces with a soft minimal mood.',
    canvasBackground: 'linear-gradient(180deg, #e2e8f0 0%, #f8fafc 100%)',
    surface: 'rgba(255,255,255,0.9)',
    lineColor: 'rgba(71,85,105,0.22)',
    accentColor: '#2563eb',
    secondaryColor: '#14b8a6',
    rootColor: '#eff6ff',
    mainColor: '#ffffff',
    subColor: '#f8fafc',
    detailColor: '#f1f5f9',
    glow: 'rgba(37,99,235,0.12)'
  },
  {
    id: 'neon_focus',
    labelAr: 'Neon Focus',
    labelEn: 'Neon Focus',
    descriptionAr: 'توهج خفيف ولمسات مستقبلية للمذاكرة المركزة.',
    descriptionEn: 'Subtle neon glow for a focused futuristic feel.',
    canvasBackground: 'radial-gradient(circle at top, rgba(34,211,238,0.18), transparent 24%), linear-gradient(180deg, #03131d 0%, #0f172a 100%)',
    surface: 'rgba(3,19,29,0.92)',
    lineColor: 'rgba(34,211,238,0.35)',
    accentColor: '#22d3ee',
    secondaryColor: '#4ade80',
    rootColor: '#082f49',
    mainColor: '#0f172a',
    subColor: '#134e4a',
    detailColor: '#0f172a',
    glow: 'rgba(34,211,238,0.26)'
  },
  {
    id: 'kids_friendly',
    labelAr: 'Kids Friendly',
    labelEn: 'Kids Friendly',
    descriptionAr: 'ألوان مبهجة وواضحة بدون تشويش على القراءة.',
    descriptionEn: 'Playful and bright while staying readable.',
    canvasBackground: 'linear-gradient(180deg, #eff6ff 0%, #fefce8 100%)',
    surface: 'rgba(255,255,255,0.9)',
    lineColor: 'rgba(16,185,129,0.24)',
    accentColor: '#f59e0b',
    secondaryColor: '#10b981',
    rootColor: '#fef3c7',
    mainColor: '#dbeafe',
    subColor: '#ecfccb',
    detailColor: '#fff7ed',
    glow: 'rgba(245,158,11,0.12)'
  },
  {
    id: 'medical_clean',
    labelAr: 'Medical Clean',
    labelEn: 'Medical Clean',
    descriptionAr: 'ستايل نظيف ودقيق مناسب للمحتوى الطبي والعلمي.',
    descriptionEn: 'Clean and precise for medical and scientific content.',
    canvasBackground: 'radial-gradient(circle at top left, rgba(14,165,233,0.12), transparent 22%), linear-gradient(180deg, #ecfeff 0%, #f8fafc 100%)',
    surface: 'rgba(255,255,255,0.92)',
    lineColor: 'rgba(14,165,233,0.24)',
    accentColor: '#0ea5e9',
    secondaryColor: '#0f766e',
    rootColor: '#e0f2fe',
    mainColor: '#ffffff',
    subColor: '#ecfeff',
    detailColor: '#f8fafc',
    glow: 'rgba(14,165,233,0.12)'
  },
  {
    id: 'engineering_grid',
    labelAr: 'Engineering Grid',
    labelEn: 'Engineering Grid',
    descriptionAr: 'شبكة تقنية دقيقة ولمسات هندسية حديثة.',
    descriptionEn: 'Technical grid styling with a sharper engineering feel.',
    canvasBackground: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)',
    surface: 'rgba(15,23,42,0.92)',
    lineColor: 'rgba(99,102,241,0.26)',
    accentColor: '#6366f1',
    secondaryColor: '#38bdf8',
    rootColor: '#1e1b4b',
    mainColor: '#172554',
    subColor: '#0f172a',
    detailColor: '#111827',
    glow: 'rgba(99,102,241,0.18)'
  }
];

@Component({
  selector: 'app-mindmap-page',
  standalone: true,
  imports: [CommonModule, FormsModule, UpgradeModal],
  templateUrl: './mindmap.page.html',
  styleUrl: './mindmap.page.css'
})
export class MindMapPage {
  readonly ai = inject(AIService);
  readonly mindmaps = inject(MindMapService);
  private readonly flashcards = inject(FlashcardsService);
  private readonly ns = inject(NotificationService);
  private readonly MIN_SCALE = 0.58;
  private readonly MAX_SCALE = 2.2;
  private readonly ZOOM_STEP = 0.12;

  @ViewChild('mapStage') mapStage?: ElementRef<HTMLDivElement>;
  @ViewChild('mapCanvas') mapCanvas?: ElementRef<HTMLDivElement>;
  @ViewChild('mapViewport') mapViewport?: ElementRef<HTMLDivElement>;

  back = output<string>();
  openFlashcards = output<void>();

  currentMap = signal<SavedMindMap | null>(null);
  sourceEditorText = signal('');
  errorMessage = signal('');
  isBusy = signal(false);
  busyAction = signal<'generate' | 'artifact' | 'quiz' | 'export' | 'knowledge' | null>(null);
  loadingMessageIndex = signal(0);
  viewMode = signal<MindMapViewMode>('mindmap');
  selectedNodeId = signal<string | null>(null);
  editingNodeId = signal<string | null>(null);
  editingNodeTitle = signal('');
  emphasizeImportant = signal(false);
  hideDetails = signal(false);
  showSavedMaps = signal(false);
  showCustomizationDrawer = signal(false);
  artifactTitle = signal('');
  artifactContent = signal('');
  quizQuestions = signal<MindMapQuizQuestion[]>([]);
  showQuizModal = signal(false);
  quizSelections = signal<Record<string, number>>({});
  workspaceSurface = signal<MindMapWorkspaceSurface>('mindmap');
  selectedKnowledgeNodeId = signal<string | null>(null);
  editingKnowledgeNodeId = signal<string | null>(null);
  showKnowledgeEditor = signal(false);
  knowledgeNodeDraft = signal<SmartKnowledgeNodeDraft>(this.createKnowledgeNodeDraft());
  connectingKnowledgeNodeId = signal<string | null>(null);
  showKnowledgeAiPrompt = signal(false);
  knowledgeAiPrompt = signal('');
  isKnowledgeStudyMode = signal(false);
  knowledgeStudyNodeId = signal<string | null>(null);
  knowledgeRevealStage = signal<0 | 1 | 2>(0);
  studyShowConnections = signal(true);
  studyFocusCurrentNode = signal(true);
  scale = signal(1);
  offsetX = signal(0);
  offsetY = signal(0);
  isPanning = signal(false);
  isNativeFullscreen = signal(false);
  isFallbackFullscreen = signal(false);
  upgradeMessage = signal('');
  showUpgradeModal = signal(false);

  private loadingTimer: number | null = null;
  private bodyOverflowBeforeFullscreen: string | null = null;
  private isCompletingQuiz = false;
  private readonly emptyKnowledgeBoard = this.mindmaps.createEmptyKnowledgeBoard();
  private panState: { active: boolean; startX: number; startY: number; baseX: number; baseY: number } = {
    active: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0
  };
  private knowledgeDragState: { nodeId: string; startX: number; startY: number; baseX: number; baseY: number } | null = null;
  private knowledgeResizeState: { nodeId: string; startX: number; startY: number; baseWidth: number; baseHeight: number } | null = null;

  readonly loadingMessages = computed(() => this.ai.currentLanguage() === 'ar'
    ? ['يتم تحليل الشرح...', 'يتم استخراج المحاور الرئيسية...', 'يتم بناء الفروع الذهنية...', 'يتم تنظيم الخريطة التفاعلية...']
    : ['Analyzing the explanation...', 'Extracting the main branches...', 'Building the mind structure...', 'Organizing the interactive map...']);

  readonly themeOptions = computed(() => MINDMAP_THEMES.map(theme => ({
    ...theme,
    label: this.ai.currentLanguage() === 'ar' ? theme.labelAr : theme.labelEn,
    description: this.ai.currentLanguage() === 'ar' ? theme.descriptionAr : theme.descriptionEn
  })));

  readonly viewModeOptions = computed(() => {
    const isAr = this.ai.currentLanguage() === 'ar';
    return [
      { id: 'mindmap' as const, label: isAr ? 'Mind Map' : 'Mind Map' },
      { id: 'tree' as const, label: isAr ? 'Tree View' : 'Tree View' },
      { id: 'study' as const, label: isAr ? 'Study Mode' : 'Study Mode' },
      { id: 'compact' as const, label: isAr ? 'Compact View' : 'Compact View' }
    ];
  });

  readonly currentRoot = computed(() => this.currentMap()?.root || null);
  readonly selectedNode = computed(() => {
    const root = this.currentRoot();
    const selectedId = this.selectedNodeId();
    return root && selectedId ? this.findNode(root, selectedId) : root;
  });

  readonly flatNodes = computed(() => {
    const root = this.currentRoot();
    return root ? this.mindmaps.flattenNodes(root).filter(node => node.type !== 'root') : [];
  });

  readonly studyNodes = computed(() => this.flatNodes().filter(node => !this.hideDetails() || (node.type !== 'detail' && node.type !== 'example')));
  readonly currentStudyIndex = computed(() => {
    const selectedId = this.selectedNodeId();
    return this.studyNodes().findIndex(node => node.id === selectedId);
  });
  readonly zoomPercent = computed(() => `${Math.round(this.scale() * 100)}%`);
  readonly isFullscreenActive = computed(() => this.isNativeFullscreen() || this.isFallbackFullscreen());
  readonly currentSourceTitle = computed(() => {
    const map = this.currentMap();
    if (!map) return this.ai.currentLanguage() === 'ar' ? 'بدون مصدر محدد' : 'No Source Selected';
    return map.sourceTitle?.trim() || this.sourceTypeLabel(map.sourceType);
  });
  readonly currentSourceBadge = computed(() => {
    const map = this.currentMap();
    if (!map) return this.ai.currentLanguage() === 'ar' ? 'مصدر حر' : 'Free Source';
    return `${this.ai.currentLanguage() === 'ar' ? 'من' : 'From'} ${this.sourceTypeLabel(map.sourceType)}`;
  });
  readonly currentCustomization = computed(() => this.currentMap()?.customization || DEFAULT_MINDMAP_CUSTOMIZATION);
  readonly activeTheme = computed(() => this.resolveTheme(this.currentCustomization().themeId));
  readonly savedMapsList = computed(() => this.mindmaps.savedMaps());
  readonly progressSummary = computed(() => this.currentMap()?.progress || this.mindmaps.createProgress(this.currentRoot(), this.selectedNodeId()));
  readonly knowledgeBoard = computed(() => this.currentMap()?.knowledgeBoard || this.emptyKnowledgeBoard);
  readonly knowledgeNodes = computed(() => this.knowledgeBoard().nodes);
  readonly knowledgeConnections = computed(() => this.knowledgeBoard().connections);
  readonly isKnowledgeSurface = computed(() => this.workspaceSurface() === 'knowledge');
  readonly selectedKnowledgeNode = computed(() =>
    this.findKnowledgeNode(this.selectedKnowledgeNodeId() || this.knowledgeBoard().study.currentNodeId)
  );
  readonly knowledgeStudySequence = computed(() => this.buildKnowledgeStudySequence());
  readonly currentKnowledgeStudyIndex = computed(() =>
    this.knowledgeStudySequence().findIndex(node => node.id === this.knowledgeStudyNodeId())
  );
  readonly currentKnowledgeStudyNode = computed(() =>
    this.findKnowledgeNode(this.knowledgeStudyNodeId() || this.knowledgeBoard().study.currentNodeId)
  );
  readonly highlightedKnowledgeConnectionIds = computed(() => {
    if (!this.isKnowledgeStudyMode()) {
      return new Set(this.knowledgeConnections().map(connection => connection.id));
    }

    const currentNodeId = this.knowledgeStudyNodeId();
    if (!this.studyShowConnections() || !currentNodeId) {
      return new Set<string>();
    }

    return new Set(
      this.knowledgeConnections()
        .filter(connection => connection.fromNodeId === currentNodeId || connection.toNodeId === currentNodeId)
        .map(connection => connection.id)
    );
  });
  readonly knowledgeBoardMetrics = computed(() => ({
    nodes: this.knowledgeNodes().length,
    connections: this.knowledgeConnections().length,
    keyNodes: this.knowledgeNodes().filter(node => node.isKeyNode).length
  }));
  readonly knowledgeBoardCanvasStyle = computed(() => this.getKnowledgeBoardCanvasStyle());
  readonly layoutPreset = computed<MindMapLayoutPreset>(() => {
    if (this.viewMode() === 'compact') return 'compact_study';
    if (this.currentCustomization().direction === 'rtl') return 'rtl_academic';
    if (this.currentCustomization().direction === 'vertical' || this.viewMode() === 'tree') return 'top_down';
    return 'center';
  });
  readonly lineStyleOptions = computed(() => {
    const isAr = this.ai.currentLanguage() === 'ar';
    return [
      { id: 'curved' as const, label: isAr ? 'منحنية ناعمة' : 'Curved' },
      { id: 'straight' as const, label: isAr ? 'مستقيمة نظيفة' : 'Straight' },
      { id: 'academic' as const, label: isAr ? 'أكاديمية' : 'Academic' },
      { id: 'neon' as const, label: isAr ? 'نيون خفيف' : 'Soft Neon' }
    ];
  });
  readonly nodeSizeOptions = computed(() => {
    const isAr = this.ai.currentLanguage() === 'ar';
    return [
      { id: 'compact' as const, label: isAr ? 'صغير' : 'Compact' },
      { id: 'balanced' as const, label: isAr ? 'متوازن' : 'Balanced' },
      { id: 'large' as const, label: isAr ? 'كبير' : 'Large' }
    ];
  });
  readonly backgroundOptions = computed(() => {
    const isAr = this.ai.currentLanguage() === 'ar';
    return [
      { id: 'minimal' as const, label: isAr ? 'Minimal' : 'Minimal' },
      { id: 'academic_grid' as const, label: isAr ? 'شبكة أكاديمية' : 'Academic Grid' }
    ];
  });
  readonly visualModeOptions = computed(() => {
    const isAr = this.ai.currentLanguage() === 'ar';
    return [
      { id: 'default' as const, label: isAr ? 'افتراضي' : 'Default' },
      { id: 'focus' as const, label: isAr ? 'تركيز العقدة' : 'Focus Node' },
      { id: 'branch' as const, label: isAr ? 'تركيز الفرع' : 'Branch Study' },
      { id: 'exam' as const, label: isAr ? 'مراجعة امتحان' : 'Exam Review' },
      { id: 'presentation' as const, label: isAr ? 'عرض نظيف' : 'Presentation' }
    ];
  });
  readonly selectedPathIds = computed(() => {
    const path = this.findPathToNode(this.currentRoot(), this.selectedNodeId());
    return new Set(path.map(node => node.id));
  });
  readonly selectedSubtreeIds = computed(() => {
    const set = new Set<string>();
    const node = this.selectedNode();
    if (!node) return set;
    this.collectSubtreeIds(node, set);
    return set;
  });
  readonly selectedBranchRootId = computed(() => {
    const path = this.findPathToNode(this.currentRoot(), this.selectedNodeId());
    return path[1]?.id || path[0]?.id || null;
  });

  constructor() {
    this.bootstrapPage();

    effect(() => {
      const map = this.currentMap();
      if (!map) return;
      this.viewMode.set(map.viewMode);
      this.selectedNodeId.set(map.progress.currentNodeId || map.root?.id || null);
      this.workspaceSurface.set(map.knowledgeBoard.activeSurface);
      this.selectedKnowledgeNodeId.set(map.knowledgeBoard.study.currentNodeId || map.knowledgeBoard.nodes[0]?.id || null);
      this.knowledgeStudyNodeId.set(map.knowledgeBoard.study.currentNodeId || map.knowledgeBoard.nodes[0]?.id || null);
      this.studyShowConnections.set(map.knowledgeBoard.study.showConnections);
      this.studyFocusCurrentNode.set(map.knowledgeBoard.study.focusCurrentNode);
    });
  }

  @HostListener('document:keydown.escape')
  handleEscape() {
    if (this.isFallbackFullscreen()) {
      void this.exitFullScreen();
    }
    this.editingNodeId.set(null);
    this.editingKnowledgeNodeId.set(null);
    this.showKnowledgeEditor.set(false);
    this.showKnowledgeAiPrompt.set(false);
    this.connectingKnowledgeNodeId.set(null);
    if (this.isKnowledgeStudyMode()) {
      this.exitKnowledgeStudyMode();
    }
    this.showQuizModal.set(false);
    this.showCustomizationDrawer.set(false);
  }

  @HostListener('document:fullscreenchange')
  handleFullscreenChange() {
    const stage = this.mapStage?.nativeElement;
    const isActive = Boolean(stage && this.getFullscreenElement() === stage);
    const hadNativeFullscreen = this.isNativeFullscreen();
    this.isNativeFullscreen.set(isActive);

    if (isActive !== hadNativeFullscreen) {
      window.requestAnimationFrame(() => this.fitMapToScreen());
    }
  }

  @HostListener('document:webkitfullscreenchange')
  handleWebkitFullscreenChange() {
    this.handleFullscreenChange();
  }

  @HostListener('document:keydown.arrowright', ['$event'])
  handleArrowRight(event: KeyboardEvent) {
    if (this.shouldIgnoreKeyboard(event)) return;
    event.preventDefault();
    if (this.isKnowledgeStudyMode()) {
      this.goToNextKnowledgeStudyNode();
      return;
    }
    this.goToNextStudyNode();
  }

  @HostListener('document:keydown.arrowleft', ['$event'])
  handleArrowLeft(event: KeyboardEvent) {
    if (this.shouldIgnoreKeyboard(event)) return;
    event.preventDefault();
    if (this.isKnowledgeStudyMode()) {
      this.goToPreviousKnowledgeStudyNode();
      return;
    }
    this.goToPreviousStudyNode();
  }

  @HostListener('document:keydown.space', ['$event'])
  handleSpace(event: KeyboardEvent) {
    if (this.shouldIgnoreKeyboard(event)) return;
    const node = this.selectedNode();
    if (!node) return;
    event.preventDefault();
    this.toggleNodeCollapse(node.id, event);
  }

  @HostListener('document:pointermove', ['$event'])
  handleDocumentPointerMove(event: PointerEvent) {
    if (this.knowledgeDragState) {
      const nextX = this.knowledgeDragState.baseX + ((event.clientX - this.knowledgeDragState.startX) / this.scale());
      const nextY = this.knowledgeDragState.baseY + ((event.clientY - this.knowledgeDragState.startY) / this.scale());
      this.updateKnowledgeNode(this.knowledgeDragState.nodeId, node => ({
        ...node,
        x: Math.max(48, Number(nextX.toFixed(1))),
        y: Math.max(48, Number(nextY.toFixed(1)))
      }), true);
      return;
    }

    if (this.knowledgeResizeState) {
      const nextWidth = this.knowledgeResizeState.baseWidth + ((event.clientX - this.knowledgeResizeState.startX) / this.scale());
      const nextHeight = this.knowledgeResizeState.baseHeight + ((event.clientY - this.knowledgeResizeState.startY) / this.scale());
      this.updateKnowledgeNode(this.knowledgeResizeState.nodeId, node => ({
        ...node,
        width: Math.max(250, Math.min(520, Number(nextWidth.toFixed(1)))),
        height: Math.max(180, Math.min(440, Number(nextHeight.toFixed(1))))
      }), true);
    }
  }

  @HostListener('document:pointerup')
  handleDocumentPointerUp() {
    if (this.knowledgeDragState || this.knowledgeResizeState) {
      this.knowledgeDragState = null;
      this.knowledgeResizeState = null;
      this.commitKnowledgeBoard();
    }
  }

  ngOnDestroy() {
    this.stopBusy();
    this.unlockBodyScroll();
  }

  ngAfterViewInit() {
    if (this.hasMap()) {
      window.requestAnimationFrame(() => this.fitMapToScreen());
    }
  }

  resolveBackTarget() {
    const sourceType = this.currentMap()?.sourceType || '';
    if (sourceType === 'flashcards') return 'flashcards';
    if (sourceType === 'tutor') return 'tutor';
    if (sourceType === 'research') return 'research';
    if (sourceType === 'transform') return 'transform';
    return 'overview';
  }

  goBack() {
    this.back.emit(this.resolveBackTarget());
  }

  canGenerate() {
    return this.sourceEditorText().trim().length > 0;
  }

  hasMap() {
    return Boolean(this.currentMap());
  }

  activeThemeStyle() {
    const theme = this.activeTheme();
    return {
      '--mindmap-canvas-bg': theme.canvasBackground,
      '--mindmap-surface': theme.surface,
      '--mindmap-line': theme.lineColor,
      '--mindmap-line-soft': `${theme.lineColor}66`,
      '--mindmap-accent': theme.accentColor,
      '--mindmap-secondary': theme.secondaryColor,
      '--mindmap-root': theme.rootColor,
      '--mindmap-main': theme.mainColor,
      '--mindmap-sub': theme.subColor,
      '--mindmap-detail': theme.detailColor,
      '--mindmap-glow': theme.glow
    } as Record<string, string>;
  }

  headerThemeStyle(themeId: MindMapThemeId) {
    const theme = this.resolveTheme(themeId);
    return {
      background: theme.canvasBackground,
      boxShadow: `0 20px 60px ${theme.glow}`
    };
  }

  canvasTransform() {
    return `translate(${this.offsetX()}px, ${this.offsetY()}px) scale(${this.scale()})`;
  }

  canvasClass() {
    if (this.isKnowledgeSurface()) {
      return [
        'knowledge-canvas',
        this.isKnowledgeStudyMode() ? 'is-knowledge-study' : '',
        this.isPanning() ? 'is-panning' : ''
      ].filter(Boolean).join(' ');
    }

    const customization = this.currentCustomization();
    const normalizedLineStyle = this.normalizeLineStyle(customization.lineStyle);
    return [
      `layout-${this.layoutPreset()}`,
      `line-${normalizedLineStyle}`,
      `size-${customization.nodeSize}`,
      `shape-${customization.nodeShape}`,
      `visual-${customization.visualMode}`,
      `bg-${customization.backgroundMode}`,
      customization.direction === 'vertical' || this.viewMode() === 'tree' ? 'is-vertical' : '',
      customization.direction === 'rtl' ? 'is-rtl' : '',
      this.viewMode() === 'compact' ? 'is-compact' : '',
      this.viewMode() === 'study' ? 'is-study-preview' : '',
      !customization.showIcons ? 'is-iconless' : '',
      this.isPanning() ? 'is-panning' : ''
    ].filter(Boolean).join(' ');
  }

  spacingClass() {
    return `spacing-${this.currentCustomization().spacing}`;
  }

  treeClass() {
    return [
      this.spacingClass(),
      `layout-${this.layoutPreset()}`,
      `visual-${this.currentCustomization().visualMode}`
    ].join(' ');
  }

  isSelectedNode(nodeId: string) {
    return this.selectedNodeId() === nodeId;
  }

  isEditingNode(nodeId: string) {
    return this.editingNodeId() === nodeId;
  }

  selectNode(nodeId: string, event?: Event) {
    event?.stopPropagation();
    this.selectedNodeId.set(nodeId);
    const map = this.currentMap();
    if (!map) return;
    this.persistMap({
      ...map,
      progress: this.mindmaps.createProgress(map.root, nodeId)
    }, true);
    window.requestAnimationFrame(() => this.centerSelectedNode());
  }

  startNodeEdit(node: MindMapNode, event?: Event) {
    event?.stopPropagation();
    this.selectedNodeId.set(node.id);
    this.editingNodeId.set(node.id);
    this.editingNodeTitle.set(node.title);
  }

  saveNodeEdit(nodeId: string) {
    const title = this.editingNodeTitle().trim();
    if (!title) {
      this.editingNodeId.set(null);
      return;
    }

    this.updateNode(nodeId, node => ({ ...node, title }));
    this.editingNodeId.set(null);
  }

  cancelNodeEdit() {
    this.editingNodeId.set(null);
    this.editingNodeTitle.set('');
  }

  toggleNodeCollapse(nodeId: string, event?: Event) {
    event?.stopPropagation();
    this.updateNode(nodeId, node => ({ ...node, collapsed: !node.collapsed }));
  }

  addChildNode(nodeId: string, event?: Event) {
    event?.stopPropagation();
    const root = this.currentRoot();
    if (!root) return;

    const nextRoot = this.walkTree(root, nodeId, node => {
      const nextOrder = node.children?.length || 0;
      const child: MindMapNode = {
        id: crypto.randomUUID(),
        title: this.ai.currentLanguage() === 'ar' ? 'فرع جديد' : 'New Branch',
        type: node.level === 0 ? 'main' : node.level === 1 ? 'sub' : 'detail',
        level: node.level + 1,
        parentId: node.id,
        order: nextOrder,
        children: [],
        isKeyPoint: false,
        collapsed: false,
        reviewState: null
      };
      return {
        ...node,
        collapsed: false,
        children: [...(node.children || []), child]
      };
    });

    this.commitRoot(nextRoot, nodeId);
    const parent = this.findNode(nextRoot, nodeId);
    const child = parent?.children?.[parent.children.length - 1];
    if (child) {
      this.selectedNodeId.set(child.id);
      this.startNodeEdit(child);
    }
  }

  deleteNode(nodeId: string, event?: Event) {
    event?.stopPropagation();
    const root = this.currentRoot();
    if (!root || root.id === nodeId) return;

    const nextRoot = this.removeNode(root, nodeId);
    const fallbackNodeId = this.findParentId(root, nodeId) || root.id;
    this.commitRoot(nextRoot, fallbackNodeId);
  }

  cycleNodeColor(nodeId: string, event?: Event) {
    event?.stopPropagation();
    const colors = ['#38bdf8', '#818cf8', '#4ade80', '#f59e0b', '#f472b6', '#ef4444', '#14b8a6'];
    const node = this.findNode(this.currentRoot(), nodeId);
    const currentIndex = colors.indexOf(node?.customColor || '');
    const nextColor = colors[(currentIndex + 1) % colors.length];
    this.updateNode(nodeId, current => ({ ...current, customColor: nextColor }));
  }

  changeNodeType(nodeId: string, type: string) {
    this.updateNode(nodeId, node => ({
      ...node,
      type: this.normalizeNodeType(type, node.level),
      isKeyPoint: type === 'important' ? true : node.isKeyPoint
    }));
  }

  toggleNodeImportance(nodeId: string, event?: Event) {
    event?.stopPropagation();
    this.updateNode(nodeId, node => ({
      ...node,
      isKeyPoint: !node.isKeyPoint,
      type: !node.isKeyPoint ? 'important' : (node.type === 'important' ? (node.level <= 1 ? 'main' : 'sub') : node.type)
    }));
  }

  editNodeNote(nodeId: string, event?: Event) {
    event?.stopPropagation();
    const node = this.findNode(this.currentRoot(), nodeId);
    if (!node) return;
    const note = window.prompt(
      this.ai.currentLanguage() === 'ar' ? 'أضف ملاحظة لهذه العقدة' : 'Add a note for this node',
      node.note || ''
    );
    if (note === null) return;
    this.updateNode(nodeId, current => ({ ...current, note: note.trim() || undefined }));
  }

  async generateQuestionFromNode(nodeId: string, event?: Event) {
    event?.stopPropagation();
    const node = this.findNode(this.currentRoot(), nodeId);
    if (!node || !this.guardUsage()) return;

    this.startBusy('artifact');
    this.errorMessage.set('');
    try {
      const response = await this.requestTextArtifact(
        `Create one short study question from this mind map node.
Node title: ${node.title}
Node summary: ${node.summary || ''}
Node note: ${node.note || ''}
Source title: ${this.currentMap()?.sourceTitle || this.currentMap()?.name || 'Mind Map'}`,
        this.ai.currentLanguage() === 'ar' ? 'سؤال ذكي من العقدة' : 'Smart Question From Node'
      );
      this.artifactTitle.set(this.ai.currentLanguage() === 'ar' ? 'سؤال من العقدة' : 'Question From Node');
      this.artifactContent.set(response);
      this.ai.incrementUsage('aiTeacherQuestions');
    } catch (error) {
      console.error('Question generation failed', error);
      this.errorMessage.set(this.ai.currentLanguage() === 'ar'
        ? 'تعذر توليد سؤال من العقدة الحالية.'
        : 'Could not generate a question from the selected node.');
    } finally {
      this.stopBusy();
    }
  }

  markNodeReview(nodeId: string, state: Exclude<MindMapNodeReviewState, null>) {
    this.updateNode(nodeId, node => ({ ...node, reviewState: state }));
  }

  clearNodeReview(nodeId: string) {
    this.updateNode(nodeId, node => ({ ...node, reviewState: null }));
  }

  openNodeAsFlashcards(nodeId: string, event?: Event) {
    event?.stopPropagation();
    const node = this.findNode(this.currentRoot(), nodeId);
    if (!node) return;

    const sourceText = [node.title, node.summary, node.note, ...(node.children || []).map(child => `${child.title}: ${child.summary || ''}`)]
      .filter(Boolean)
      .join('\n');

    this.flashcards.openFromSource({
      sourceText,
      sourceType: 'mindmap',
      sourceTitle: node.title,
      conversationId: this.currentMap()?.conversationId,
      messageId: node.id,
      language: this.currentMap()?.language || this.ai.currentLanguage(),
      groupName: node.title
    });
    this.openFlashcards.emit();
  }

  openMapAsFlashcards() {
    const map = this.currentMap();
    const root = this.currentRoot();
    if (!map || !root) return;

    this.flashcards.openFromSource({
      sourceText: this.mindmaps.toOutlineText(root),
      sourceType: 'mindmap',
      sourceTitle: map.name,
      conversationId: map.conversationId,
      messageId: map.messageId,
      language: map.language,
      groupName: map.name
    });
    this.openFlashcards.emit();
  }

  async generateFromEditor() {
    const sourceText = this.sourceEditorText().trim();
    if (!sourceText) return;

    const baseMap = this.currentMap() || this.mindmaps.createEmptyMap();
    await this.generateMap({
      sourceText,
      sourceType: baseMap.sourceType || 'manual',
      sourceTitle: baseMap.sourceTitle || (this.ai.currentLanguage() === 'ar' ? 'من إدخال يدوي' : 'From Manual Input'),
      conversationId: baseMap.conversationId,
      messageId: baseMap.messageId,
      language: baseMap.language || this.ai.currentLanguage(),
      mapName: baseMap.name
    }, 'standard');
  }

  async regenerateMap() {
    const map = this.currentMap();
    const sourceText = this.sourceEditorText().trim() || map?.sourceText || '';
    if (!map || !sourceText) return;

    await this.generateMap({
      sourceText,
      sourceType: map.sourceType,
      sourceTitle: map.sourceTitle,
      conversationId: map.conversationId,
      messageId: map.messageId,
      language: map.language,
      mapName: map.name
    }, 'standard');
  }

  async simplifyMap() {
    const map = this.currentMap();
    const sourceText = this.sourceEditorText().trim() || map?.sourceText || '';
    if (!map || !sourceText) return;

    await this.generateMap({
      sourceText,
      sourceType: map.sourceType,
      sourceTitle: map.sourceTitle,
      conversationId: map.conversationId,
      messageId: map.messageId,
      language: map.language,
      mapName: map.name
    }, 'simplify');
  }

  async deepenMap() {
    const map = this.currentMap();
    const sourceText = this.sourceEditorText().trim() || map?.sourceText || '';
    if (!map || !sourceText) return;

    await this.generateMap({
      sourceText,
      sourceType: map.sourceType,
      sourceTitle: map.sourceTitle,
      conversationId: map.conversationId,
      messageId: map.messageId,
      language: map.language,
      mapName: map.name
    }, 'expand');
  }

  saveCurrentMap() {
    const map = this.currentMap();
    if (!map) return;
    this.persistMap(map, false);
  }

  loadSavedMap(mapId: string) {
    const saved = this.mindmaps.getSavedMap(mapId);
    if (!saved) return;
    this.mindmaps.setActiveMap(saved.id);
    this.currentMap.set(this.mindmaps.cloneMap(saved));
    this.sourceEditorText.set(saved.sourceText);
    this.viewMode.set(saved.viewMode);
    this.selectedNodeId.set(saved.progress.currentNodeId || saved.root?.id || null);
    this.errorMessage.set('');
    this.showSavedMaps.set(false);
    window.requestAnimationFrame(() => this.fitMapToScreen());
  }

  deleteSavedMap(mapId: string, event: Event) {
    event.stopPropagation();
    this.mindmaps.deleteSavedMap(mapId);
    if (this.currentMap()?.id === mapId) {
      const fallback = this.mindmaps.activeMap();
      if (fallback) {
        this.currentMap.set(this.mindmaps.cloneMap(fallback));
        this.sourceEditorText.set(fallback.sourceText);
      } else {
        this.currentMap.set(null);
        this.sourceEditorText.set('');
      }
    }
  }

  toggleSavedMaps() {
    this.showSavedMaps.update(value => !value);
  }

  toggleCustomizationDrawer() {
    this.showCustomizationDrawer.update(value => !value);
  }

  setViewMode(mode: MindMapViewMode) {
    this.viewMode.set(mode);
    const map = this.currentMap();
    if (!map) return;
    this.persistMap({ ...map, viewMode: mode }, true);
    window.requestAnimationFrame(() => this.fitMapToScreen());
  }

  setWorkspaceSurface(surface: MindMapWorkspaceSurface) {
    const map = this.ensureCurrentMap();
    const nextBoard: KnowledgeBoardState = {
      ...this.knowledgeBoard(),
      activeSurface: surface,
      study: {
        ...this.knowledgeBoard().study,
        currentNodeId: this.knowledgeStudyNodeId() || this.selectedKnowledgeNodeId() || this.knowledgeBoard().study.currentNodeId
      }
    };

    this.workspaceSurface.set(surface);
    this.persistMap({
      ...map,
      knowledgeBoard: nextBoard
    }, true);

    window.requestAnimationFrame(() => this.fitMapToScreen());
  }

  createSmartKnowledgeNode() {
    const map = this.ensureCurrentMap();
    if (!map) return;
    this.workspaceSurface.set('knowledge');
    this.showKnowledgeAiPrompt.set(false);
    this.connectingKnowledgeNodeId.set(null);
    this.knowledgeNodeDraft.set(this.createKnowledgeNodeDraft());
    this.editingKnowledgeNodeId.set(null);
    this.showKnowledgeEditor.set(true);
    this.persistMap({
      ...map,
      knowledgeBoard: {
        ...this.knowledgeBoard(),
        activeSurface: 'knowledge'
      }
    }, true);
  }

  openKnowledgeNodeEditor(node?: SmartKnowledgeNode | null, event?: Event) {
    event?.stopPropagation();
    if (node) {
      this.selectedKnowledgeNodeId.set(node.id);
      this.editingKnowledgeNodeId.set(node.id);
      this.knowledgeNodeDraft.set({
        id: node.id,
        title: node.title,
        explanation: node.explanation,
        bulletsText: node.bullets.join('\n'),
        imageUrl: node.imageUrl || '',
        icon: node.icon || '',
        sourceLabel: node.sourceLabel || '',
        accentColor: node.accentColor || ''
      });
    } else {
      this.editingKnowledgeNodeId.set(null);
      this.knowledgeNodeDraft.set(this.createKnowledgeNodeDraft());
    }
    this.showKnowledgeEditor.set(true);
  }

  closeKnowledgeNodeEditor() {
    this.showKnowledgeEditor.set(false);
    this.editingKnowledgeNodeId.set(null);
    this.knowledgeNodeDraft.set(this.createKnowledgeNodeDraft());
  }

  patchKnowledgeNodeDraft(patch: Partial<SmartKnowledgeNodeDraft>) {
    this.knowledgeNodeDraft.update(current => ({ ...current, ...patch }));
  }

  saveKnowledgeNodeEdit() {
    const draft = this.knowledgeNodeDraft();
    const title = draft.title.trim();
    if (!title) {
      return;
    }

    const bullets = draft.bulletsText
      .split('\n')
      .map(line => line.replace(/^[\-\u2022]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 6);

    if (draft.id) {
      this.updateKnowledgeNode(draft.id, node => ({
        ...node,
        title,
        explanation: draft.explanation.trim(),
        bullets,
        imageUrl: draft.imageUrl.trim() || undefined,
        icon: draft.icon.trim() || undefined,
        sourceLabel: draft.sourceLabel.trim() || undefined,
        accentColor: draft.accentColor.trim() || undefined
      }));
    } else {
      const position = this.getSuggestedKnowledgeNodePosition();
      const nextNode: SmartKnowledgeNode = {
        id: crypto.randomUUID(),
        title,
        explanation: draft.explanation.trim(),
        bullets,
        imageUrl: draft.imageUrl.trim() || undefined,
        icon: draft.icon.trim() || undefined,
        sourceLabel: draft.sourceLabel.trim() || undefined,
        accentColor: draft.accentColor.trim() || undefined,
        x: position.x,
        y: position.y,
        width: 320,
        height: this.estimateKnowledgeNodeHeight({
          explanation: draft.explanation.trim(),
          bullets
        }),
        order: this.knowledgeNodes().length,
        parentId: null,
        isKeyNode: false
      };
      this.patchKnowledgeBoard(board => ({
        ...board,
        activeSurface: 'knowledge',
        nodes: [...board.nodes, nextNode],
        study: {
          ...board.study,
          currentNodeId: nextNode.id
        }
      }));
      this.selectedKnowledgeNodeId.set(nextNode.id);
      this.knowledgeStudyNodeId.set(nextNode.id);
    }

    this.closeKnowledgeNodeEditor();
    window.requestAnimationFrame(() => {
      const nodeId = this.selectedKnowledgeNodeId();
      if (nodeId) {
        this.centerOnNode(nodeId);
      }
    });
  }

  selectKnowledgeNode(nodeId: string, event?: Event) {
    event?.stopPropagation();
    if (this.connectingKnowledgeNodeId() && this.connectingKnowledgeNodeId() !== nodeId) {
      this.createKnowledgeConnection(this.connectingKnowledgeNodeId() as string, nodeId, 'related');
      this.connectingKnowledgeNodeId.set(null);
      this.selectedKnowledgeNodeId.set(nodeId);
      return;
    }

    this.selectedKnowledgeNodeId.set(nodeId);
    this.knowledgeStudyNodeId.set(nodeId);
    this.knowledgeRevealStage.set(0);
    this.patchKnowledgeBoard(board => ({
      ...board,
      study: {
        ...board.study,
        currentNodeId: nodeId
      }
    }));
  }

  duplicateKnowledgeNode(nodeId: string, event?: Event) {
    event?.stopPropagation();
    const node = this.findKnowledgeNode(nodeId);
    if (!node) return;

    const duplicate: SmartKnowledgeNode = {
      ...this.mindmaps.cloneMap(node),
      id: crypto.randomUUID(),
      x: node.x + 56,
      y: node.y + 56,
      order: this.knowledgeNodes().length
    };

    this.patchKnowledgeBoard(board => ({
      ...board,
      nodes: [...board.nodes, duplicate],
      study: {
        ...board.study,
        currentNodeId: duplicate.id
      }
    }));
    this.selectedKnowledgeNodeId.set(duplicate.id);
    this.knowledgeStudyNodeId.set(duplicate.id);
  }

  deleteKnowledgeNode(nodeId: string, event?: Event) {
    event?.stopPropagation();
    const nodes = this.knowledgeNodes().filter(node => node.id !== nodeId);
    const fallbackNodeId = nodes[0]?.id || null;
    this.patchKnowledgeBoard(board => ({
      ...board,
      nodes,
      connections: board.connections.filter(connection => connection.fromNodeId !== nodeId && connection.toNodeId !== nodeId),
      study: {
        ...board.study,
        currentNodeId: fallbackNodeId
      }
    }));
    this.selectedKnowledgeNodeId.set(fallbackNodeId);
    this.knowledgeStudyNodeId.set(fallbackNodeId);
  }

  startConnectingKnowledgeNode(nodeId: string, event?: Event) {
    event?.stopPropagation();
    this.selectedKnowledgeNodeId.set(nodeId);
    this.connectingKnowledgeNodeId.set(nodeId);
  }

  cancelKnowledgeConnectionMode(event?: Event) {
    event?.stopPropagation();
    this.connectingKnowledgeNodeId.set(null);
  }

  addChildKnowledgeNode(parentId: string, event?: Event) {
    event?.stopPropagation();
    const parent = this.findKnowledgeNode(parentId);
    if (!parent) return;

    const child: SmartKnowledgeNode = {
      id: crypto.randomUUID(),
      title: this.ai.currentLanguage() === 'ar' ? 'مفهوم فرعي' : 'Child Concept',
      explanation: '',
      bullets: [],
      icon: '•',
      sourceLabel: parent.title,
      x: parent.x + 380,
      y: parent.y + Math.min(240, parent.height + 48),
      width: 300,
      height: 200,
      order: this.knowledgeNodes().length,
      parentId,
      isKeyNode: false
    };

    this.patchKnowledgeBoard(board => ({
      ...board,
      activeSurface: 'knowledge',
      nodes: [...board.nodes, child],
      connections: [
        ...board.connections,
        {
          id: crypto.randomUUID(),
          fromNodeId: parentId,
          toNodeId: child.id,
          kind: 'child'
        }
      ],
      study: {
        ...board.study,
        currentNodeId: child.id
      }
    }));

    this.selectedKnowledgeNodeId.set(child.id);
    this.knowledgeStudyNodeId.set(child.id);
    this.openKnowledgeNodeEditor(child);
  }

  convertKnowledgeNodeToFlashcard(nodeId: string, event?: Event) {
    event?.stopPropagation();
    const node = this.findKnowledgeNode(nodeId);
    const map = this.currentMap();
    if (!node || !map) return;

    this.flashcards.openFromSource({
      sourceText: [node.title, node.explanation, ...node.bullets].filter(Boolean).join('\n'),
      sourceType: 'mindmap',
      sourceTitle: node.title,
      conversationId: map.conversationId,
      messageId: node.id,
      language: map.language,
      groupName: node.title
    });
    this.openFlashcards.emit();
  }

  toggleKnowledgeAiPrompt() {
    this.showKnowledgeAiPrompt.update(value => !value);
    if (!this.showKnowledgeAiPrompt()) {
      this.knowledgeAiPrompt.set('');
    }
  }

  async generateKnowledgeNodesWithAI() {
    const prompt = this.knowledgeAiPrompt().trim();
    if (!prompt || !this.guardUsage()) return;

    this.startBusy('knowledge');
    this.errorMessage.set('');
    try {
      const generatedBoard = await this.mindmaps.generateKnowledgeBoardFromTopic(prompt, this.currentMap()?.language || this.ai.currentLanguage());
      const nextBoard = this.mergeKnowledgeBoard(generatedBoard);
      const map = this.ensureCurrentMap();
      this.workspaceSurface.set('knowledge');
      this.persistMap({
        ...map,
        knowledgeBoard: nextBoard
      }, true);
      this.selectedKnowledgeNodeId.set(nextBoard.study.currentNodeId);
      this.knowledgeStudyNodeId.set(nextBoard.study.currentNodeId);
      this.showKnowledgeAiPrompt.set(false);
      this.knowledgeAiPrompt.set('');
      this.ai.incrementUsage('aiTeacherQuestions');
      window.requestAnimationFrame(() => this.fitMapToScreen());
    } catch (error) {
      console.error('Knowledge board generation failed', error);
      this.errorMessage.set(this.ai.currentLanguage() === 'ar'
        ? 'تعذر إنشاء Smart Knowledge Nodes من هذا الموضوع الآن.'
        : 'Could not generate smart knowledge nodes from this topic right now.');
    } finally {
      this.stopBusy();
    }
  }

  startKnowledgeStudyMode() {
    const firstNodeId = this.knowledgeStudyNodeId() || this.selectedKnowledgeNodeId() || this.knowledgeNodes()[0]?.id || null;
    if (!firstNodeId) return;
    this.workspaceSurface.set('knowledge');
    this.isKnowledgeStudyMode.set(true);
    this.knowledgeStudyNodeId.set(firstNodeId);
    this.selectedKnowledgeNodeId.set(firstNodeId);
    this.knowledgeRevealStage.set(0);
    this.patchKnowledgeBoard(board => ({
      ...board,
      activeSurface: 'knowledge',
      study: {
        ...board.study,
        currentNodeId: firstNodeId,
        showConnections: this.studyShowConnections(),
        focusCurrentNode: this.studyFocusCurrentNode()
      }
    }));
    this.focusCurrentKnowledgeNode();
  }

  exitKnowledgeStudyMode() {
    this.isKnowledgeStudyMode.set(false);
    this.knowledgeRevealStage.set(0);
    this.patchKnowledgeBoard(board => ({
      ...board,
      study: {
        ...board.study,
        currentNodeId: this.knowledgeStudyNodeId() || board.study.currentNodeId,
        showConnections: this.studyShowConnections(),
        focusCurrentNode: this.studyFocusCurrentNode()
      }
    }), true);
  }

  goToNextKnowledgeStudyNode() {
    const nodes = this.knowledgeStudySequence();
    if (!nodes.length) return;
    const currentIndex = this.currentKnowledgeStudyIndex();
    const next = nodes[(currentIndex + 1 + nodes.length) % nodes.length] || nodes[0];
    this.selectKnowledgeStudyNode(next.id);
  }

  goToPreviousKnowledgeStudyNode() {
    const nodes = this.knowledgeStudySequence();
    if (!nodes.length) return;
    const currentIndex = this.currentKnowledgeStudyIndex();
    const previous = nodes[(currentIndex - 1 + nodes.length) % nodes.length] || nodes[0];
    this.selectKnowledgeStudyNode(previous.id);
  }

  focusCurrentKnowledgeNode() {
    this.studyFocusCurrentNode.set(true);
    this.patchKnowledgeBoard(board => ({
      ...board,
      study: {
        ...board.study,
        focusCurrentNode: true
      }
    }), true);
    const currentId = this.knowledgeStudyNodeId();
    if (!currentId) return;
    this.setScale(Math.max(this.scale(), 1.05));
    window.requestAnimationFrame(() => this.centerOnNode(currentId));
  }

  toggleKnowledgeStudyConnections() {
    const nextValue = !this.studyShowConnections();
    this.studyShowConnections.set(nextValue);
    this.patchKnowledgeBoard(board => ({
      ...board,
      study: {
        ...board.study,
        showConnections: nextValue
      }
    }), true);
  }

  advanceKnowledgeRevealStage() {
    this.knowledgeRevealStage.update(stage => (stage < 2 ? ((stage + 1) as 0 | 1 | 2) : stage));
  }

  startKnowledgeNodeDrag(nodeId: string, event: PointerEvent) {
    event.stopPropagation();
    if (this.isKnowledgeStudyMode()) return;
    const node = this.findKnowledgeNode(nodeId);
    if (!node) return;
    this.selectKnowledgeNode(nodeId);
    this.knowledgeDragState = {
      nodeId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: node.x,
      baseY: node.y
    };
  }

  startKnowledgeNodeResize(nodeId: string, event: PointerEvent) {
    event.stopPropagation();
    if (this.isKnowledgeStudyMode()) return;
    const node = this.findKnowledgeNode(nodeId);
    if (!node) return;
    this.selectKnowledgeNode(nodeId);
    this.knowledgeResizeState = {
      nodeId,
      startX: event.clientX,
      startY: event.clientY,
      baseWidth: node.width,
      baseHeight: node.height
    };
  }

  setTheme(themeId: MindMapThemeId) {
    this.patchCustomization({ themeId });
  }

  setLineStyle(lineStyle: MindMapLineStyle) {
    this.patchCustomization({ lineStyle });
  }

  setNodeShape(nodeShape: MindMapNodeShape) {
    this.patchCustomization({ nodeShape });
  }

  setDirection(direction: MindMapDirection) {
    this.patchCustomization({ direction });
  }

  setSpacing(spacing: 'compact' | 'balanced' | 'spacious') {
    this.patchCustomization({ spacing });
  }

  setNodeSize(nodeSize: MindMapNodeSize) {
    this.patchCustomization({ nodeSize });
  }

  setBackgroundMode(backgroundMode: MindMapBackgroundMode) {
    this.patchCustomization({ backgroundMode });
  }

  toggleNodeIcons() {
    this.patchCustomization({ showIcons: !this.currentCustomization().showIcons });
  }

  setVisualMode(visualMode: MindMapVisualMode) {
    this.patchCustomization({ visualMode });
  }

  applyLayoutPreset(layout: MindMapLayoutPreset) {
    if (layout === 'center') {
      this.setViewMode('mindmap');
      this.patchCustomization({ direction: 'center' });
    } else if (layout === 'top_down') {
      this.setViewMode('tree');
      this.patchCustomization({ direction: 'vertical' });
    } else if (layout === 'rtl_academic') {
      this.setViewMode('tree');
      this.patchCustomization({ direction: 'rtl' });
    } else {
      this.setViewMode('compact');
      this.patchCustomization({ direction: 'center', spacing: 'compact' });
    }
    window.requestAnimationFrame(() => this.fitMapToScreen());
  }

  resetCustomization() {
    const map = this.currentMap();
    if (!map) return;
    this.persistMap({
      ...map,
      customization: { ...DEFAULT_MINDMAP_CUSTOMIZATION }
    }, true);
  }

  resetViewport() {
    this.scale.set(1);
    this.offsetX.set(0);
    this.offsetY.set(0);
  }

  fitMapToScreen() {
    const viewport = this.mapViewport?.nativeElement;
    const canvas = this.mapCanvas?.nativeElement;
    if (!viewport || !canvas) return;

    this.resetViewport();
    window.requestAnimationFrame(() => {
      const nodeElements = Array.from(canvas.querySelectorAll<HTMLElement>('.mind-node-shell, .knowledge-node-shell'));
      if (!nodeElements.length) return;

      const viewportRect = viewport.getBoundingClientRect();
      const bounds = nodeElements.reduce((acc, node) => {
        const rect = node.getBoundingClientRect();
        return {
          left: Math.min(acc.left, rect.left),
          top: Math.min(acc.top, rect.top),
          right: Math.max(acc.right, rect.right),
          bottom: Math.max(acc.bottom, rect.bottom)
        };
      }, {
        left: Number.POSITIVE_INFINITY,
        top: Number.POSITIVE_INFINITY,
        right: Number.NEGATIVE_INFINITY,
        bottom: Number.NEGATIVE_INFINITY
      });

      const mapWidth = Math.max(240, bounds.right - bounds.left);
      const mapHeight = Math.max(200, bounds.bottom - bounds.top);
      const padding = 120;
      const widthScale = (viewportRect.width - padding) / mapWidth;
      const heightScale = (viewportRect.height - padding) / mapHeight;
      const nextScale = Math.min(1.45, Math.max(0.58, Number(Math.min(widthScale, heightScale).toFixed(2))));
      this.scale.set(nextScale);

      window.requestAnimationFrame(() => {
        const refreshedNodes = Array.from(canvas.querySelectorAll<HTMLElement>('.mind-node-shell, .knowledge-node-shell'));
        if (!refreshedNodes.length) return;
        const refreshedBounds = refreshedNodes.reduce((acc, node) => {
          const rect = node.getBoundingClientRect();
          return {
            left: Math.min(acc.left, rect.left),
            top: Math.min(acc.top, rect.top),
            right: Math.max(acc.right, rect.right),
            bottom: Math.max(acc.bottom, rect.bottom)
          };
        }, {
          left: Number.POSITIVE_INFINITY,
          top: Number.POSITIVE_INFINITY,
          right: Number.NEGATIVE_INFINITY,
          bottom: Number.NEGATIVE_INFINITY
        });

        const currentViewportRect = viewport.getBoundingClientRect();
        const mapCenterX = refreshedBounds.left + ((refreshedBounds.right - refreshedBounds.left) / 2);
        const mapCenterY = refreshedBounds.top + ((refreshedBounds.bottom - refreshedBounds.top) / 2);
        const viewportCenterX = currentViewportRect.left + (currentViewportRect.width / 2);
        const viewportCenterY = currentViewportRect.top + (currentViewportRect.height / 2);

        this.offsetX.update(value => value + (viewportCenterX - mapCenterX));
        this.offsetY.update(value => value + (viewportCenterY - mapCenterY));
      });
    });
  }

  centerRoot() {
    const rootId = this.currentRoot()?.id;
    if (!rootId) return;
    this.centerOnNode(rootId);
  }

  centerSelectedNode() {
    const nodeId = this.isKnowledgeSurface() ? this.selectedKnowledgeNodeId() : this.selectedNodeId();
    if (!nodeId) return;
    this.centerOnNode(nodeId);
  }

  zoomIn() {
    this.setScale(this.scale() + this.ZOOM_STEP);
  }

  zoomOut() {
    this.setScale(this.scale() - this.ZOOM_STEP);
  }

  reorganizeLayout() {
    const root = this.currentRoot();
    if (!root) return;
    const nextRoot = this.normalizeNodeOrders(root);
    this.commitRoot(nextRoot, this.selectedNodeId());
    this.resetViewport();
    window.requestAnimationFrame(() => this.fitMapToScreen());
  }

  expandAllNodes() {
    const root = this.currentRoot();
    if (!root) return;
    this.commitRoot(this.applyToTree(root, node => ({ ...node, collapsed: false })), this.selectedNodeId());
  }

  hideMapDetails() {
    this.hideDetails.set(true);
  }

  showMapDetails() {
    this.hideDetails.set(false);
  }

  toggleImportantEmphasis() {
    this.emphasizeImportant.update(value => !value);
  }

  async generateSummaryFromMap() {
    const root = this.currentRoot();
    if (!root || !this.guardUsage()) return;

    this.startBusy('artifact');
    this.errorMessage.set('');
    try {
      const response = await this.requestTextArtifact(
        `Convert this mind map into a concise educational summary.
Map title: ${this.currentMap()?.name || 'Mind Map'}
Outline:
${this.mindmaps.toOutlineText(root)}`,
        this.ai.currentLanguage() === 'ar' ? 'ملخص من الخريطة' : 'Summary From Map'
      );
      this.artifactTitle.set(this.ai.currentLanguage() === 'ar' ? 'ملخص من الخريطة' : 'Summary From Map');
      this.artifactContent.set(response);
      this.ai.incrementUsage('aiTeacherQuestions');
    } catch (error) {
      console.error('Mind map summary failed', error);
      this.errorMessage.set(this.ai.currentLanguage() === 'ar'
        ? 'تعذر تحويل الخريطة إلى ملخص.'
        : 'Could not convert the map into a summary.');
    } finally {
      this.stopBusy();
    }
  }

  async openQuizModal() {
    const root = this.currentRoot();
    if (!root || !this.guardUsage()) return;

    this.startBusy('quiz');
    this.errorMessage.set('');
    this.isCompletingQuiz = false;
    try {
      const quizNodes = this.flatNodes();
      const response = await this.requestQuiz(
        `Create a short multiple-choice quiz from this mind map.
Map title: ${this.currentMap()?.name || 'Mind Map'}
Outline:
${this.mindmaps.toOutlineText(root)}

Study nodes:
${quizNodes.map(node => `NODE_ID: ${node.id}\nTITLE: ${node.title}\nSUMMARY: ${this.nodeSummary(node) || 'N/A'}`).join('\n\n')}`,
        quizNodes.map(node => node.id)
      );
      this.quizQuestions.set(response);
      this.quizSelections.set({});
      this.showQuizModal.set(true);
      this.ai.incrementUsage('aiTeacherQuestions');
    } catch (error) {
      console.error('Mind map quiz failed', error);
      this.errorMessage.set(this.ai.currentLanguage() === 'ar'
        ? 'تعذر إنشاء اختبار من الخريطة الحالية.'
        : 'Could not create a quiz from the current map.');
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
      window.setTimeout(() => this.finishMindMapQuizAttempt(), 180);
    }
  }

  quizSelectedOption(questionId: string) {
    const value = this.quizSelections()[questionId];
    return typeof value === 'number' ? value : null;
  }

  hasAnsweredQuizQuestion(questionId: string) {
    return this.quizSelectedOption(questionId) !== null;
  }

  isCorrectQuizOption(question: MindMapQuizQuestion, optionIndex: number) {
    return this.hasAnsweredQuizQuestion(question.id) && question.answerIndex === optionIndex;
  }

  isWrongSelectedQuizOption(question: MindMapQuizQuestion, optionIndex: number) {
    const selected = this.quizSelectedOption(question.id);
    return selected !== null && selected === optionIndex && question.answerIndex !== optionIndex;
  }

  async exportAsJson() {
    const map = this.currentMap();
    if (!map) return;
    this.downloadFile(
      `${this.safeFileName(map.name)}.json`,
      new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' })
    );
  }

  async exportAsText() {
    const map = this.currentMap();
    const root = this.currentRoot();
    if (!map || !root) return;
    this.downloadFile(
      `${this.safeFileName(map.name)}.txt`,
      new Blob([this.mindmaps.toOutlineText(root)], { type: 'text/plain;charset=utf-8' })
    );
  }

  async exportAsPng() {
    await this.exportVisual('png', 'full');
  }

  async exportAsPdf() {
    await this.exportVisual('pdf', 'full');
  }

  async exportCurrentViewAsPng() {
    await this.exportVisual('png', 'viewport');
  }

  async exportCurrentViewAsPdf() {
    await this.exportVisual('pdf', 'viewport');
  }

  async toggleFullScreen() {
    if (this.isFullscreenActive()) {
      await this.exitFullScreen();
      return;
    }

    await this.enterFullScreen();
  }

  onCanvasPointerDown(event: PointerEvent) {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.mind-node-shell, .knowledge-node-shell, button, input, select, textarea')) {
      return;
    }

    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);

    this.panState = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      baseX: this.offsetX(),
      baseY: this.offsetY()
    };
    this.isPanning.set(true);
  }

  onCanvasPointerMove(event: PointerEvent) {
    if (!this.panState.active) return;
    this.offsetX.set(this.panState.baseX + (event.clientX - this.panState.startX));
    this.offsetY.set(this.panState.baseY + (event.clientY - this.panState.startY));
  }

  onCanvasPointerUp(event?: PointerEvent) {
    (event?.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId);
    this.panState.active = false;
    this.isPanning.set(false);
  }

  onCanvasWheel(event: WheelEvent) {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -0.08 : 0.08;
    this.setScale(this.scale() + direction);
  }

  nodeTypeLabel(type: MindMapNodeType) {
    const labels: Record<MindMapNodeType, { ar: string; en: string }> = {
      root: { ar: 'الجذر', en: 'Root' },
      main: { ar: 'محور رئيسي', en: 'Main Topic' },
      sub: { ar: 'فرع فرعي', en: 'Subtopic' },
      detail: { ar: 'تفصيل', en: 'Detail' },
      example: { ar: 'مثال', en: 'Example' },
      important: { ar: 'نقطة مهمة', en: 'Important' },
      definition: { ar: 'تعريف', en: 'Definition' },
      warning: { ar: 'تنبيه', en: 'Warning' }
    };
    return this.ai.currentLanguage() === 'ar' ? labels[type].ar : labels[type].en;
  }

  nodeTypeIcon(type: MindMapNodeType) {
    const icons: Record<MindMapNodeType, string> = {
      root: 'fa-bullseye',
      main: 'fa-diagram-project',
      sub: 'fa-share-nodes',
      detail: 'fa-circle-dot',
      example: 'fa-lightbulb',
      important: 'fa-star',
      definition: 'fa-book-open',
      warning: 'fa-triangle-exclamation'
    };
    return icons[type];
  }

  nodeStyle(node: MindMapNode) {
    const theme = this.activeTheme();
    const shape = this.currentCustomization().nodeShape;
    const bg = node.customColor
      || (node.type === 'root' ? theme.rootColor
        : node.type === 'main' ? theme.mainColor
        : node.type === 'sub' ? theme.subColor
        : theme.detailColor);
    const isLight = /^#(?:f|e|d)/i.test(bg) || bg.includes('255');
    const emphasis = this.emphasizeImportant() && (node.isKeyPoint || node.type === 'important');
    const background = shape === 'glass'
      ? `linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04)), ${bg}`
      : `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01)), ${bg}`;

    return {
      background,
      color: isLight ? '#0f172a' : '#f8fafc',
      borderColor: emphasis ? theme.accentColor : 'rgba(255,255,255,0.12)',
      boxShadow: emphasis
        ? `0 28px 64px ${theme.glow}, 0 0 0 1px ${theme.accentColor} inset`
        : `0 22px 52px ${theme.glow}`,
      borderRadius: shape === 'pill' ? '999px'
        : shape === 'academic' ? '1.15rem'
        : shape === 'glass' ? '1.65rem'
        : '1.45rem',
      backdropFilter: shape === 'glass' ? 'blur(18px)' : undefined
    } as Record<string, string | undefined>;
  }

  nodeShellClass(node: MindMapNode) {
    return [
      `node-${node.type}`,
      this.isSelectedNode(node.id) ? 'is-selected' : '',
      this.isNodeDimmed(node) ? 'is-dimmed' : '',
      this.currentCustomization().visualMode === 'exam' && (node.isKeyPoint || node.type === 'important') ? 'is-exam-highlight' : '',
      this.selectedPathIds().has(node.id) ? 'is-on-path' : '',
      this.selectedSubtreeIds().has(node.id) ? 'is-in-focus-branch' : ''
    ].filter(Boolean).join(' ');
  }

  knowledgeNodeStyle(node: SmartKnowledgeNode) {
    const theme = this.activeTheme();
    const accent = node.accentColor || (node.isKeyNode ? theme.accentColor : theme.secondaryColor);
    return {
      width: `${node.width}px`,
      minHeight: `${node.height}px`,
      borderColor: node.isKeyNode ? `${accent}66` : 'rgba(255,255,255,0.08)',
      boxShadow: node.isKeyNode
        ? `0 24px 64px ${theme.glow}, 0 0 0 1px ${accent}44 inset`
        : '0 24px 54px rgba(2, 6, 23, 0.3)',
      background: node.accentColor
        ? `linear-gradient(180deg, ${node.accentColor}22, rgba(15,23,42,0.94))`
        : 'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.94))'
    } as Record<string, string>;
  }

  knowledgeNodeShellClass(node: SmartKnowledgeNode) {
    return [
      this.selectedKnowledgeNodeId() === node.id ? 'is-selected' : '',
      this.isKnowledgeStudyMode() && this.studyFocusCurrentNode() && this.currentKnowledgeStudyNode()?.id !== node.id ? 'is-dimmed' : '',
      node.isKeyNode ? 'is-key-node' : ''
    ].filter(Boolean).join(' ');
  }

  knowledgeConnectionPath(connection: SmartKnowledgeConnection) {
    const from = this.findKnowledgeNode(connection.fromNodeId);
    const to = this.findKnowledgeNode(connection.toNodeId);
    if (!from || !to) return '';

    const startX = from.x + from.width;
    const startY = from.y + (from.height / 2);
    const endX = to.x;
    const endY = to.y + (to.height / 2);
    const curve = Math.max(80, Math.abs(endX - startX) * 0.42);

    return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
  }

  knowledgeConnectionLabelStyle(connection: SmartKnowledgeConnection) {
    const from = this.findKnowledgeNode(connection.fromNodeId);
    const to = this.findKnowledgeNode(connection.toNodeId);
    if (!from || !to) {
      return {
        left: '0px',
        top: '0px'
      };
    }

    const left = ((from.x + from.width) + to.x) / 2;
    const top = ((from.y + (from.height / 2)) + (to.y + (to.height / 2))) / 2;
    return {
      left: `${left}px`,
      top: `${top}px`
    };
  }

  isKnowledgeConnectionVisible(connection: SmartKnowledgeConnection) {
    if (!this.isKnowledgeStudyMode()) return true;
    return this.highlightedKnowledgeConnectionIds().has(connection.id);
  }

  showNodeSummary(node: MindMapNode) {
    const summary = this.nodeSummary(node);
    if (!summary) return false;
    if (this.hideDetails() && (node.type === 'detail' || node.type === 'example')) return false;

    const visualMode = this.currentCustomization().visualMode;
    if (visualMode === 'presentation') {
      return node.type === 'root' || node.type === 'main' || this.isSelectedNode(node.id);
    }

    if (visualMode === 'exam') {
      return node.type !== 'detail';
    }

    return true;
  }

  shouldShowNodeIcon() {
    return this.currentCustomization().showIcons;
  }

  isNodeDimmed(node: MindMapNode) {
    const visualMode = this.currentCustomization().visualMode;
    if (visualMode === 'default') return false;
    if (!this.selectedNodeId()) return false;
    if (this.isSelectedNode(node.id)) return false;

    if (visualMode === 'focus') {
      return !(this.selectedPathIds().has(node.id) || this.selectedSubtreeIds().has(node.id));
    }

    if (visualMode === 'branch') {
      return !this.isNodeInSelectedBranch(node.id);
    }

    if (visualMode === 'exam') {
      return node.type === 'detail' || node.type === 'example';
    }

    if (visualMode === 'presentation') {
      return node.type === 'detail' && !this.selectedPathIds().has(node.id);
    }

    return false;
  }

  nodeSummary(node: MindMapNode) {
    return node.summary?.trim() || node.note?.trim() || '';
  }

  visibleChildren(node: MindMapNode) {
    const children = [...(node.children || [])].sort((left, right) => (left.order || 0) - (right.order || 0));
    if (!this.hideDetails()) return children;
    return children.filter(child => child.type !== 'detail' && child.type !== 'example');
  }

  selectedNodeChildren() {
    return this.visibleChildren(this.selectedNode() || { children: [] } as MindMapNode);
  }

  selectedNodeDirection() {
    const text = `${this.selectedNode()?.title || ''} ${this.selectedNode()?.summary || ''}`;
    return this.resolveTextDirection(text, this.currentMap()?.language || this.ai.currentLanguage());
  }

  progressPercent() {
    const progress = this.progressSummary();
    if (!progress.totalNodes) return 0;
    return Math.round((progress.understoodNodes / progress.totalNodes) * 100);
  }

  studyStatusLabel() {
    const progress = this.progressSummary();
    return `${progress.understoodNodes} / ${progress.totalNodes}`;
  }

  goToNextStudyNode() {
    const index = this.currentStudyIndex();
    const nodes = this.studyNodes();
    if (!nodes.length) return;
    const next = nodes[Math.min(index + 1, nodes.length - 1)] || nodes[0];
    this.selectNode(next.id);
  }

  goToPreviousStudyNode() {
    const index = this.currentStudyIndex();
    const nodes = this.studyNodes();
    if (!nodes.length) return;
    const previous = nodes[Math.max(index - 1, 0)] || nodes[0];
    this.selectNode(previous.id);
  }

  sourceTypeLabel(sourceType: string) {
    const map: Record<string, { ar: string; en: string }> = {
      tutor: { ar: 'المعلم الذكي', en: 'AI Tutor' },
      research: { ar: 'البحث الأكاديمي', en: 'Academic Research' },
      transform: { ar: 'تحويل المحتوى', en: 'Content Transform' },
      manual: { ar: 'إدخال يدوي', en: 'Manual Input' },
      mindmap: { ar: 'خريطة ذهنية', en: 'Mind Map' }
    };
    const label = map[sourceType] || { ar: 'مصدر مخصص', en: 'Custom Source' };
    return this.ai.currentLanguage() === 'ar' ? label.ar : label.en;
  }

  resolveTextDirection(text: string, fallbackLanguage: LanguageCode) {
    return /[\u0600-\u06FF]/.test(text) || fallbackLanguage === 'ar' ? 'rtl' : 'ltr';
  }

  formatSavedDate(value: string) {
    return new Date(value).toLocaleString(this.ai.currentLanguage() === 'ar' ? 'ar' : 'en');
  }

  closeUpgradeModal() {
    this.showUpgradeModal.set(false);
  }

  private bootstrapPage() {
    const launchContext = this.mindmaps.consumeLaunchContext();
    if (launchContext?.sourceText?.trim()) {
      const starterMap = this.mindmaps.createEmptyMap(launchContext);
      this.currentMap.set(starterMap);
      this.sourceEditorText.set(launchContext.sourceText);
      void this.generateMap(launchContext, 'standard');
      return;
    }

    const activeMap = this.mindmaps.activeMap();
    if (activeMap) {
      this.currentMap.set(this.mindmaps.cloneMap(activeMap));
      this.sourceEditorText.set(activeMap.sourceText);
      this.selectedNodeId.set(activeMap.progress.currentNodeId || activeMap.root?.id || null);
      window.requestAnimationFrame(() => this.fitMapToScreen());
      return;
    }

    this.currentMap.set(null);
    this.sourceEditorText.set('');
  }

  private async generateMap(context: Parameters<MindMapService['generateMap']>[0], mode: MindMapGenerationMode) {
    if (!this.guardUsage()) return;

    this.errorMessage.set('');
    this.startBusy('generate');
    try {
      const result = await this.mindmaps.generateMap(context, mode);
      const baseMap = this.currentMap() || this.mindmaps.createEmptyMap(context);
      const nextMap: SavedMindMap = {
        ...baseMap,
        name: result.mapTitle,
        sourceText: result.sourceText,
        sourceType: context.sourceType,
        sourceTitle: context.sourceTitle,
        conversationId: context.conversationId,
        messageId: context.messageId,
        language: context.language || this.ai.currentLanguage(),
        root: result.root,
        viewMode: this.viewMode(),
        updatedAt: new Date().toISOString(),
        progress: this.mindmaps.createProgress(result.root, result.root.children?.[0]?.id || result.root.id)
      };

      this.currentMap.set(this.mindmaps.saveMap(nextMap, { silent: true }));
      this.sourceEditorText.set(result.sourceText);
      this.selectedNodeId.set(nextMap.progress.currentNodeId || result.root.id);
      this.artifactTitle.set('');
      this.artifactContent.set('');
      this.ai.incrementUsage('aiTeacherQuestions');
      this.ai.addXP(mode === 'standard' ? 20 : 10);
      this.resetViewport();
      window.requestAnimationFrame(() => this.fitMapToScreen());
    } catch (error) {
      console.error('Mind map generation failed:', error);
      this.errorMessage.set(this.ai.currentLanguage() === 'ar'
        ? 'تعذر إنشاء الخريطة الذهنية من المحتوى الحالي. حاول بنص أوضح أو أطول قليلًا.'
        : 'Could not build a mind map from the current content. Try a clearer or slightly richer source.');
    } finally {
      this.stopBusy();
    }
  }

  private patchCustomization(patch: Partial<MindMapCustomizationSettings>) {
    const map = this.currentMap();
    if (!map) return;
    this.persistMap({
      ...map,
      customization: {
        ...map.customization,
        ...patch
      }
    }, true);
  }

  private persistMap(map: SavedMindMap, silent = true) {
    const saved = this.mindmaps.saveMap({
      ...map,
      viewMode: this.viewMode(),
      progress: this.mindmaps.createProgress(map.root, this.selectedNodeId() || map.progress.currentNodeId)
    }, { silent });
    this.currentMap.set(this.mindmaps.cloneMap(saved));
  }

  private patchKnowledgeBoard(updater: (board: KnowledgeBoardState) => KnowledgeBoardState, silent = true) {
    const map = this.ensureCurrentMap();
    const nextBoard = updater(this.mindmaps.cloneMap(this.knowledgeBoard()));
    this.persistMap({
      ...map,
      knowledgeBoard: nextBoard
    }, silent);
  }

  private commitKnowledgeBoard() {
    const map = this.currentMap();
    if (!map) return;
    this.persistMap({
      ...map,
      knowledgeBoard: {
        ...this.knowledgeBoard(),
        study: {
          ...this.knowledgeBoard().study,
          currentNodeId: this.knowledgeStudyNodeId() || this.selectedKnowledgeNodeId() || this.knowledgeBoard().study.currentNodeId
        }
      }
    }, true);
  }

  private updateKnowledgeNode(nodeId: string, updater: (node: SmartKnowledgeNode) => SmartKnowledgeNode, silent = true) {
    this.patchKnowledgeBoard(board => ({
      ...board,
      nodes: board.nodes.map(node => {
        if (node.id !== nodeId) return node;
        const nextNode = updater(this.mindmaps.cloneMap(node));
        return {
          ...nextNode,
          height: this.estimateKnowledgeNodeHeight(nextNode)
        };
      })
    }), silent);
  }

  private createKnowledgeConnection(fromNodeId: string, toNodeId: string, kind: SmartKnowledgeConnectionKind, label?: string) {
    if (fromNodeId === toNodeId) return;
    const exists = this.knowledgeConnections().some(connection =>
      connection.fromNodeId === fromNodeId && connection.toNodeId === toNodeId
    );
    if (exists) return;

    this.patchKnowledgeBoard(board => ({
      ...board,
      connections: [
        ...board.connections,
        {
          id: crypto.randomUUID(),
          fromNodeId,
          toNodeId,
          kind,
          label: label?.trim() || undefined
        }
      ]
    }));
  }

  private findKnowledgeNode(nodeId: string | null) {
    if (!nodeId) return null;
    return this.knowledgeNodes().find(node => node.id === nodeId) || null;
  }

  private selectKnowledgeStudyNode(nodeId: string) {
    this.knowledgeStudyNodeId.set(nodeId);
    this.selectedKnowledgeNodeId.set(nodeId);
    this.knowledgeRevealStage.set(0);
    this.patchKnowledgeBoard(board => ({
      ...board,
      study: {
        ...board.study,
        currentNodeId: nodeId
      }
    }), true);
    window.requestAnimationFrame(() => this.centerOnNode(nodeId));
  }

  private buildKnowledgeStudySequence() {
    const nodes = this.knowledgeNodes();
    if (!nodes.length) return [];

    const connections = this.knowledgeConnections().filter(connection => connection.kind === 'child' || connection.kind === 'sequence');
    const incoming = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    for (const node of nodes) {
      incoming.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    for (const connection of connections) {
      incoming.set(connection.toNodeId, (incoming.get(connection.toNodeId) || 0) + 1);
      adjacency.get(connection.fromNodeId)?.push(connection.toNodeId);
    }

    const roots = nodes
      .filter(node => (incoming.get(node.id) || 0) === 0)
      .sort((left, right) => left.x - right.x || left.y - right.y);
    const orderedNodes: SmartKnowledgeNode[] = [];
    const visited = new Set<string>();
    const queue = [...roots, ...nodes.filter(node => !roots.some(root => root.id === node.id))];

    while (queue.length) {
      const current = queue.shift();
      if (!current || visited.has(current.id)) continue;
      visited.add(current.id);
      orderedNodes.push(current);
      const children = (adjacency.get(current.id) || [])
        .map(childId => this.findKnowledgeNode(childId))
        .filter((node): node is SmartKnowledgeNode => Boolean(node))
        .sort((left, right) => left.x - right.x || left.y - right.y);
      queue.push(...children);
    }

    return orderedNodes.length
      ? orderedNodes
      : [...nodes].sort((left, right) => left.x - right.x || left.y - right.y);
  }

  private mergeKnowledgeBoard(generatedBoard: KnowledgeBoardState): KnowledgeBoardState {
    if (!this.knowledgeNodes().length) {
      return {
        ...generatedBoard,
        activeSurface: 'knowledge',
        study: {
          ...generatedBoard.study,
          currentNodeId: generatedBoard.study.currentNodeId || generatedBoard.nodes[0]?.id || null
        }
      };
    }

    const offsetX = Math.max(...this.knowledgeNodes().map(node => node.x + node.width), 0) + 220;
    const appendedNodes = generatedBoard.nodes.map(node => ({
      ...node,
      x: node.x + offsetX,
      order: this.knowledgeNodes().length + node.order
    }));

    return {
      nodes: [...this.knowledgeNodes(), ...appendedNodes],
      connections: [...this.knowledgeConnections(), ...generatedBoard.connections],
      activeSurface: 'knowledge',
      study: {
        currentNodeId: appendedNodes[0]?.id || this.knowledgeBoard().study.currentNodeId,
        showConnections: this.studyShowConnections(),
        focusCurrentNode: this.studyFocusCurrentNode()
      }
    };
  }

  private getSuggestedKnowledgeNodePosition() {
    const selected = this.selectedKnowledgeNode();
    if (selected) {
      return {
        x: selected.x + 120,
        y: selected.y + 120
      };
    }

    const nodes = this.knowledgeNodes();
    if (!nodes.length) {
      return { x: 160, y: 160 };
    }

    return {
      x: Math.max(...nodes.map(node => node.x)) + 72,
      y: Math.max(...nodes.map(node => node.y)) + 40
    };
  }

  private estimateKnowledgeNodeHeight(node: Pick<SmartKnowledgeNode, 'explanation' | 'bullets'>) {
    const explanationLines = Math.max(1, Math.ceil((node.explanation?.length || 0) / 54));
    const bulletLines = (node.bullets || []).length;
    return Math.max(190, Math.min(420, 148 + (explanationLines * 22) + (bulletLines * 26)));
  }

  private createKnowledgeNodeDraft(): SmartKnowledgeNodeDraft {
    return {
      id: null,
      title: '',
      explanation: '',
      bulletsText: '',
      imageUrl: '',
      icon: '',
      sourceLabel: '',
      accentColor: ''
    };
  }

  private ensureCurrentMap() {
    const current = this.currentMap();
    if (current) return current;
    const starter = this.mindmaps.createEmptyMap();
    this.currentMap.set(starter);
    return starter;
  }

  private getKnowledgeBoardCanvasStyle() {
    const nodes = this.knowledgeNodes();
    if (!nodes.length) {
      return {
        width: '1600px',
        height: '960px'
      };
    }

    const width = Math.max(1600, Math.max(...nodes.map(node => node.x + node.width)) + 260);
    const height = Math.max(960, Math.max(...nodes.map(node => node.y + node.height)) + 260);
    return {
      width: `${Math.ceil(width)}px`,
      height: `${Math.ceil(height)}px`
    };
  }

  private updateNode(nodeId: string, updater: (node: MindMapNode) => MindMapNode) {
    const root = this.currentRoot();
    if (!root) return;
    const nextRoot = this.walkTree(root, nodeId, updater);
    this.commitRoot(nextRoot, nodeId);
  }

  private commitRoot(root: MindMapNode | null, selectedNodeId?: string | null) {
    const map = this.currentMap();
    if (!map || !root) return;
    const currentNodeId = selectedNodeId || this.selectedNodeId() || root.id;
    this.persistMap({
      ...map,
      root,
      progress: this.mindmaps.createProgress(root, currentNodeId)
    }, true);
    this.selectedNodeId.set(currentNodeId);
  }

  private walkTree(root: MindMapNode, nodeId: string, updater: (node: MindMapNode) => MindMapNode): MindMapNode {
    if (root.id === nodeId) {
      return updater(this.mindmaps.cloneMap(root));
    }

    return {
      ...root,
      children: (root.children || []).map(child => this.walkTree(child, nodeId, updater))
    };
  }

  private removeNode(root: MindMapNode, nodeId: string): MindMapNode {
    return {
      ...root,
      children: (root.children || [])
        .filter(child => child.id !== nodeId)
        .map(child => this.removeNode(child, nodeId))
        .map((child, index) => ({ ...child, order: index }))
    };
  }

  private applyToTree(root: MindMapNode, updater: (node: MindMapNode) => MindMapNode): MindMapNode {
    const current = updater({ ...root });
    return {
      ...current,
      children: (current.children || []).map(child => this.applyToTree(child, updater))
    };
  }

  private normalizeNodeOrders(root: MindMapNode): MindMapNode {
    return {
      ...root,
      children: (root.children || []).map((child, index) => ({
        ...this.normalizeNodeOrders(child),
        order: index
      }))
    };
  }

  private findNode(root: MindMapNode | null, nodeId: string | null): MindMapNode | null {
    if (!root || !nodeId) return null;
    if (root.id === nodeId) return root;
    for (const child of root.children || []) {
      const found = this.findNode(child, nodeId);
      if (found) return found;
    }
    return null;
  }

  private findParentId(root: MindMapNode | null, nodeId: string): string | null {
    if (!root) return null;
    for (const child of root.children || []) {
      if (child.id === nodeId) {
        return root.id;
      }
      const nested = this.findParentId(child, nodeId);
      if (nested) return nested;
    }
    return null;
  }

  private normalizeNodeType(type: string, level: number): MindMapNodeType {
    const candidate = type as MindMapNodeType;
    if (candidate === 'root') return level === 0 ? 'root' : 'main';
    if (
      candidate === 'main' ||
      candidate === 'sub' ||
      candidate === 'detail' ||
      candidate === 'example' ||
      candidate === 'important' ||
      candidate === 'definition' ||
      candidate === 'warning'
    ) {
      return candidate;
    }
    return level <= 1 ? 'main' : 'sub';
  }

  private resolveTheme(themeId: MindMapThemeId) {
    return MINDMAP_THEMES.find(theme => theme.id === themeId) || MINDMAP_THEMES[0];
  }

  private normalizeLineStyle(lineStyle: MindMapLineStyle) {
    if (lineStyle === 'soft') return 'curved';
    if (lineStyle === 'angled') return 'academic';
    return lineStyle;
  }

  private setScale(nextScale: number) {
    const clamped = Math.min(this.MAX_SCALE, Math.max(this.MIN_SCALE, Number(nextScale.toFixed(2))));
    this.scale.set(clamped);
  }

  private async enterFullScreen() {
    const stage = this.mapStage?.nativeElement;
    if (!stage) return;

    if (this.canUseNativeFullscreen(stage)) {
      try {
        await this.requestNativeFullscreen(stage);
        return;
      } catch (error) {
        console.warn('Mind map native fullscreen failed, falling back to fixed mode.', error);
      }
    }

    this.lockBodyScroll();
    this.isFallbackFullscreen.set(true);
    window.requestAnimationFrame(() => this.fitMapToScreen());
  }

  private async exitFullScreen() {
    if (this.isFallbackFullscreen()) {
      this.isFallbackFullscreen.set(false);
      this.unlockBodyScroll();
      window.requestAnimationFrame(() => this.fitMapToScreen());
      return;
    }

    const fullscreenElement = this.getFullscreenElement();
    if (!fullscreenElement) return;

    try {
      await this.exitNativeFullscreen();
    } catch (error) {
      console.warn('Mind map native fullscreen exit failed.', error);
    } finally {
      this.isNativeFullscreen.set(false);
      window.requestAnimationFrame(() => this.fitMapToScreen());
    }
  }

  private canUseNativeFullscreen(element: HTMLElement) {
    const candidate = element as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    };
    return typeof element.requestFullscreen === 'function'
      || typeof candidate.webkitRequestFullscreen === 'function'
      || typeof candidate.msRequestFullscreen === 'function';
  }

  private async requestNativeFullscreen(element: HTMLElement) {
    const candidate = element as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
      msRequestFullscreen?: () => Promise<void> | void;
    };

    if (typeof element.requestFullscreen === 'function') {
      await element.requestFullscreen();
      return;
    }

    if (typeof candidate.webkitRequestFullscreen === 'function') {
      await Promise.resolve(candidate.webkitRequestFullscreen());
      return;
    }

    if (typeof candidate.msRequestFullscreen === 'function') {
      await Promise.resolve(candidate.msRequestFullscreen());
    }
  }

  private async exitNativeFullscreen() {
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
      msExitFullscreen?: () => Promise<void> | void;
    };

    if (typeof document.exitFullscreen === 'function') {
      await document.exitFullscreen();
      return;
    }

    if (typeof doc.webkitExitFullscreen === 'function') {
      await Promise.resolve(doc.webkitExitFullscreen());
      return;
    }

    if (typeof doc.msExitFullscreen === 'function') {
      await Promise.resolve(doc.msExitFullscreen());
    }
  }

  private getFullscreenElement() {
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      msFullscreenElement?: Element | null;
    };
    return doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement || null;
  }

  private lockBodyScroll() {
    if (typeof document === 'undefined') return;
    if (this.bodyOverflowBeforeFullscreen === null) {
      this.bodyOverflowBeforeFullscreen = document.body.style.overflow;
    }
    document.body.style.overflow = 'hidden';
  }

  private unlockBodyScroll() {
    if (typeof document === 'undefined') return;
    if (this.bodyOverflowBeforeFullscreen === null) return;
    document.body.style.overflow = this.bodyOverflowBeforeFullscreen;
    this.bodyOverflowBeforeFullscreen = null;
  }

  private centerOnNode(nodeId: string) {
    const viewport = this.mapViewport?.nativeElement;
    const canvas = this.mapCanvas?.nativeElement;
    if (!viewport || !canvas) return;

    const selector = typeof CSS !== 'undefined' && 'escape' in CSS
      ? `[data-node-id="${CSS.escape(nodeId)}"]`
      : `[data-node-id="${nodeId.replace(/"/g, '\\"')}"]`;
    const nodeElement = canvas.querySelector<HTMLElement>(selector);
    if (!nodeElement) return;

    const viewportRect = viewport.getBoundingClientRect();
    const nodeRect = nodeElement.getBoundingClientRect();
    const nodeCenterX = nodeRect.left + (nodeRect.width / 2);
    const nodeCenterY = nodeRect.top + (nodeRect.height / 2);
    const viewportCenterX = viewportRect.left + (viewportRect.width / 2);
    const viewportCenterY = viewportRect.top + (viewportRect.height / 2);

    this.offsetX.update(value => value + (viewportCenterX - nodeCenterX));
    this.offsetY.update(value => value + (viewportCenterY - nodeCenterY));
  }

  private findPathToNode(root: MindMapNode | null, nodeId: string | null, path: MindMapNode[] = []): MindMapNode[] {
    if (!root || !nodeId) return [];
    const nextPath = [...path, root];
    if (root.id === nodeId) return nextPath;

    for (const child of root.children || []) {
      const nested = this.findPathToNode(child, nodeId, nextPath);
      if (nested.length) return nested;
    }

    return [];
  }

  private collectSubtreeIds(node: MindMapNode, store: Set<string>) {
    store.add(node.id);
    for (const child of node.children || []) {
      this.collectSubtreeIds(child, store);
    }
  }

  private isNodeInSelectedBranch(nodeId: string) {
    const branchRootId = this.selectedBranchRootId();
    const root = this.currentRoot();
    if (!branchRootId || !root) return true;
    if (nodeId === root.id) return true;

    const branchRoot = this.findNode(root, branchRootId);
    if (!branchRoot) return true;

    const branchIds = new Set<string>();
    this.collectSubtreeIds(branchRoot, branchIds);
    const pathIds = this.selectedPathIds();
    return branchIds.has(nodeId) || pathIds.has(nodeId);
  }

  private shouldIgnoreKeyboard(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase();
    return tagName === 'textarea' || tagName === 'input' || tagName === 'select';
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

  private startBusy(action: 'generate' | 'artifact' | 'quiz' | 'export' | 'knowledge') {
    this.busyAction.set(action);
    this.isBusy.set(true);
    this.loadingMessageIndex.set(0);
    this.stopLoadingTicker();
    this.loadingTimer = window.setInterval(() => {
      this.loadingMessageIndex.update(index => (index + 1) % this.loadingMessages().length);
    }, 1300);
  }

  private stopLoadingTicker() {
    if (this.loadingTimer !== null) {
      window.clearInterval(this.loadingTimer);
      this.loadingTimer = null;
    }
  }

  private stopBusy() {
    this.stopLoadingTicker();
    this.isBusy.set(false);
    this.busyAction.set(null);
  }

  private async requestTextArtifact(message: string, fallbackTitle: string) {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        systemInstruction: `You are a study assistant.
Create a concise, useful educational output.
Match the user's language automatically.
Keep the response organized, direct, and faithful to the provided mind map.
Return plain text only.`,
        model: 'gpt-4o-mini'
      })
    });

    const payload = await response.json().catch(() => null) as { text?: string; error?: string; validation?: unknown } | null;
    if (payload?.validation) {
      this.ai.registerKnowledgeValidation(payload.validation);
    }
    if (!response.ok || !payload?.text) {
      throw new Error(payload?.error || fallbackTitle);
    }
    return payload.text.trim();
  }

  private finishMindMapQuizAttempt() {
    const map = this.currentMap();
    const root = this.currentRoot();
    const questions = this.quizQuestions();
    const selections = this.quizSelections();

    if (!map || !root || questions.length === 0) {
      this.isCompletingQuiz = false;
      this.resetQuizState();
      return;
    }

    const correctAnswers = questions.reduce((count, question) => (
      selections[question.id] === question.answerIndex ? count + 1 : count
    ), 0);
    const score = Math.round((correctAnswers / questions.length) * 100);
    const wrongNodeIds = Array.from(new Set(
      questions
        .filter(question => selections[question.id] !== question.answerIndex)
        .map(question => question.nodeId || '')
        .filter(Boolean)
    ));
    const wrongNodeSet = new Set(wrongNodeIds);
    const nextRoot = this.applyToTree(root, node => wrongNodeSet.has(node.id)
      ? { ...node, reviewState: 'review' }
      : node);
    const attempt: MindMapQuizAttempt = {
      id: crypto.randomUUID(),
      completedAt: new Date().toISOString(),
      score,
      correctAnswers,
      totalQuestions: questions.length,
      wrongNodeIds
    };

    this.persistMap({
      ...map,
      root: nextRoot,
      quizHistory: [attempt, ...(map.quizHistory || [])].slice(0, 20)
    }, true);

    this.ai.quizzesCompleted.update(count => count + 1);
    this.ai.addPerformanceRecord({
      date: attempt.completedAt,
      score,
      type: 'quiz',
      subject: map.name,
      grade: this.ai.getGrade(score)
    });

    this.ns.show(
      this.ai.currentLanguage() === 'ar' ? 'انتهى الاختبار وتم الحفظ' : 'Quiz Completed And Saved',
      this.ai.currentLanguage() === 'ar'
        ? `تم حفظ نتيجتك ${score}%${wrongNodeIds.length ? ` ويوجد ${wrongNodeIds.length} عقدة تحتاج مراجعة.` : '.'}`
        : `Your ${score}% result was saved${wrongNodeIds.length ? ` and ${wrongNodeIds.length} node(s) now need review.` : '.'}`,
      score >= 60 ? 'success' : 'warning',
      'fa-diagram-project'
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

  private async requestQuiz(message: string, nodeIds: string[]): Promise<MindMapQuizQuestion[]> {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        systemInstruction: `Generate a short multiple-choice quiz from the provided mind map.
Return ONLY JSON with key "questions".
Each question must contain:
- id
- nodeId
- question
- options (exactly 4)
- answerIndex (0 to 3)
- explanation
Every question must reference one provided NODE_ID in nodeId.
Respond strictly in ${this.ai.getLanguageName()}.
JSON only.`,
        model: 'gpt-4o-mini'
      })
    });

    const payload = await response.json().catch(() => null) as { text?: string; error?: string; validation?: unknown } | null;
    if (payload?.validation) {
      this.ai.registerKnowledgeValidation(payload.validation);
    }
    if (!response.ok || !payload?.text) {
      throw new Error(payload?.error || 'Quiz generation failed');
    }

    const raw = payload.text.trim();
    const normalized = this.extractJsonPayload(raw);
    const parsed = JSON.parse(normalized) as { questions?: MindMapQuizQuestion[] };
    const validNodeIds = new Set(nodeIds);
    return (parsed.questions || []).map((question, index) => ({
      id: question.id || crypto.randomUUID(),
      nodeId: validNodeIds.has(String(question.nodeId || '').trim())
        ? String(question.nodeId || '').trim()
        : nodeIds[index % Math.max(nodeIds.length, 1)],
      question: question.question || '',
      options: Array.isArray(question.options) ? question.options.slice(0, 4) : [],
      answerIndex: Number.isFinite(question.answerIndex) ? question.answerIndex : 0,
      explanation: question.explanation || ''
    })).filter(question => question.question && question.options.length === 4 && !!question.nodeId);
  }

  private extractJsonPayload(raw: string) {
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

  private async exportVisual(mode: 'png' | 'pdf', scope: 'full' | 'viewport') {
    const target = scope === 'viewport'
      ? this.mapViewport?.nativeElement
      : this.mapCanvas?.nativeElement;
    const map = this.currentMap();
    if (!target || !map) return;

    this.startBusy('export');
    try {
      const canvas = await html2canvas(target, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        logging: false
      });

      if (mode === 'png') {
        canvas.toBlob(blob => {
          if (!blob) return;
          this.downloadFile(`${this.safeFileName(map.name)}-${scope}.png`, blob);
        }, 'image/png');
      } else {
        const image = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        pdf.addImage(image, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`${this.safeFileName(map.name)}-${scope}.pdf`);
      }
    } catch (error) {
      console.error('Mind map export failed', error);
      this.errorMessage.set(this.ai.currentLanguage() === 'ar'
        ? 'تعذر تصدير الخريطة الحالية.'
        : 'Could not export the current map.');
    } finally {
      this.stopBusy();
    }
  }

  private downloadFile(name: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private safeFileName(input: string) {
    return input.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || 'mind-map';
  }
}
