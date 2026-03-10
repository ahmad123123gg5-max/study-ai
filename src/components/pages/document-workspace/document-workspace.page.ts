import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  output,
  signal,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AIPanelComponent } from './components/ai-panel.component';
import { DocumentToolbarComponent } from './components/document-toolbar.component';
import { DocumentViewerComponent } from './components/document-viewer.component';
import { EmptyStateComponent } from './components/empty-state.component';
import { ErrorStateComponent } from './components/error-state.component';
import {
  FloatingSelectionMenuComponent,
  SelectionAction
} from './components/floating-selection-menu.component';
import { LoadingStateComponent } from './components/loading-state.component';
import { NotesPanelComponent } from './components/notes-panel.component';
import { RecordingControllerComponent } from './components/recording-controller.component';
import { TranslationPanelComponent } from './components/translation-panel.component';
import { WorkspaceToolOptionsBarComponent } from './components/workspace-tool-options-bar.component';
import { WorkspaceToolsMenuComponent } from './components/workspace-tools-menu.component';
import {
  createAnchoredNote,
  createDefaultPanelVisibility,
  createDefaultRecordingState,
  createSelectionAnnotation,
  useAISelectionActions,
  useAnnotations,
  useDocumentSelection,
  useDocumentWorkspaceState,
  usePanelsState,
  useRecordingState,
  useWorkspacePersistence
} from './document-workspace.state';
import {
  AIResponseItem,
  AnnotationTool,
  DocumentSession,
  LoadedDocumentResource,
  RecordingCaptureMode,
  SavedWorkspacePayload,
  SelectedTextContext,
  StudyNote,
  TargetLanguage,
  TranslationBlock,
  TranslationPageEntry,
  TranslationViewMode,
  WorkspaceLanguage,
  WorkspaceSourceType,
  WorkspaceToolKey,
  WorkspaceViewMode
} from './document-workspace.types';
import { DocumentWorkspaceAIService } from './services/document-workspace-ai.service';
import { DocumentWorkspacePdfService } from './services/document-workspace-pdf.service';
import { DocumentWorkspacePersistenceService } from './services/document-workspace-persistence.service';
import { DocumentWorkspaceRecordingService } from './services/document-workspace-recording.service';
import { DocumentWorkspaceTranslationService } from './services/document-workspace-translation.service';
import { DocumentWorkspaceVoiceService } from './services/document-workspace-voice.service';

interface WorkspaceNotice {
  id: string;
  tone: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
}

@Component({
  selector: 'app-document-workspace-page',
  standalone: true,
  imports: [
    CommonModule,
    AIPanelComponent,
    DocumentToolbarComponent,
    DocumentViewerComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    FloatingSelectionMenuComponent,
    LoadingStateComponent,
    NotesPanelComponent,
    RecordingControllerComponent,
    TranslationPanelComponent,
    WorkspaceToolOptionsBarComponent,
    WorkspaceToolsMenuComponent
  ],
  templateUrl: './document-workspace.page.html',
  host: {
    class: 'block'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentWorkspacePage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly pdfService = inject(DocumentWorkspacePdfService);
  private readonly aiService = inject(DocumentWorkspaceAIService);
  private readonly translationService = inject(DocumentWorkspaceTranslationService);
  private readonly persistenceService = inject(DocumentWorkspacePersistenceService);
  private readonly recordingService = inject(DocumentWorkspaceRecordingService);

  protected readonly voiceService = inject(DocumentWorkspaceVoiceService);
  protected readonly workspace = useDocumentWorkspaceState(null);
  protected readonly panelsState = usePanelsState(this.workspace);
  protected readonly selectionState = useDocumentSelection();
  protected readonly annotationState = useAnnotations(this.workspace);
  protected readonly aiActions = useAISelectionActions(this.workspace, this.aiService);
  protected readonly recordingState = useRecordingState(this.workspace, this.recordingService);
  protected readonly persistenceState = useWorkspacePersistence(this.workspace.session, this.persistenceService);

  protected readonly resource = signal<LoadedDocumentResource | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly landingMessage = signal<string | null>(null);
  protected readonly scrollRequest = signal<{ pageNumber: number; id: number; anchorY?: number } | null>(null);
  protected readonly translationSelectionLoading = signal(false);
  protected readonly notice = signal<WorkspaceNotice | null>(null);
  protected readonly toolsMenuOpen = signal(true);
  protected readonly activeTool = signal<WorkspaceToolKey | null>(null);
  protected readonly aiLauncherPosition = signal({ x: 0, y: 0 });
  protected readonly recoverableWorkspace = signal<SavedWorkspacePayload | null>(null);
  readonly back = output<void>();

  protected readonly resourcePages = computed(() => this.resource()?.pages || []);
  protected readonly aiLoading = computed(() => this.aiActions.isBusy() !== 'idle');
  protected readonly selectionMenuBusy = computed(() => this.aiLoading() || this.translationSelectionLoading());
  protected readonly annotationModeEnabled = computed(
    () => this.annotationState.activeTool() !== 'select'
  );
  protected readonly showRightPanel = computed(() => {
    const session = this.workspace.session();
    const activePanel = this.panelsState.activeRightPanel();
    return Boolean(
      this.resource() && session && activePanel && session.panelVisibility[activePanel]
    );
  });
  protected readonly showToolOptionsBar = computed(() => Boolean(this.resource() && this.activeTool()));
  protected readonly showRecordingChip = computed(() => {
    const recording = this.recordingState.recording();
    return (
      recording.status !== 'idle' ||
      Boolean(recording.blobUrl) ||
      recording.permission === 'denied' ||
      recording.permission === 'unsupported'
    );
  });
  protected readonly currentPageTranslationEntry = computed<TranslationPageEntry | null>(() => {
    const session = this.workspace.session();
    if (!session) {
      return null;
    }
    return session.pageTranslations[session.currentPage] || null;
  });
  protected readonly activeAISelection = computed(() => {
    const thread = this.aiActions.activeThread();
    if (thread?.scope === 'selection') {
      return thread.selection;
    }
    return thread ? null : this.selectionState.selection();
  });
  protected readonly selectionSummary = computed(
    () => this.selectionState.selection()?.text || this.aiActions.activeThread()?.selection?.text || null
  );

  private readonly fileInputRef = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly viewerHostRef = viewChild<ElementRef<HTMLElement>>('viewerHost');
  private readonly viewerSize = signal({ width: 0, height: 0 });
  private readonly pageTranslationRequests = new Set<number>();
  private aiLauncherPinned = false;
  private aiLauncherDragState: {
    pointerId: number | null;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } = {
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
    moved: false
  };
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private loadRequestId = 0;
  private scrollRequestId = 0;

  constructor() {
    effect((onCleanup) => {
      const host = this.viewerHostRef()?.nativeElement;
      if (!host || typeof ResizeObserver === 'undefined') {
        return;
      }

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }
        this.viewerSize.set({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      });

      observer.observe(host);
      this.viewerSize.set({
        width: host.clientWidth,
        height: host.clientHeight
      });

      onCleanup(() => observer.disconnect());
    });

    effect(() => {
      const resource = this.resource();
      const session = this.workspace.session();
      const size = this.viewerSize();

      if (!resource || !session || session.fitMode === 'manual' || !size.width || !size.height) {
        return;
      }

      const page = resource.pages.find((item) => item.pageNumber === session.currentPage) || resource.pages[0];
      if (!page) {
        return;
      }

      const availableWidth = Math.max(320, size.width - 48);
      const availableHeight = Math.max(320, size.height - 48);
      const nextZoom =
        session.fitMode === 'width'
          ? availableWidth / page.width
          : Math.min(availableWidth / page.width, availableHeight / page.height);
      const normalizedZoom = Number(Math.min(2.5, Math.max(0.45, nextZoom)).toFixed(3));

      if (Math.abs(normalizedZoom - session.zoom) > 0.01) {
        this.workspace.patchSession({ zoom: normalizedZoom });
      }
    });

    effect(() => {
      const size = this.viewerSize();
      if (!size.width || !size.height) {
        return;
      }

      this.aiLauncherPosition.update((current) => {
        if (!this.aiLauncherPinned && current.x === 0 && current.y === 0) {
          return {
            x: 18,
            y: 20
          };
        }

        return {
          x: this.clamp(current.x, 12, Math.max(12, size.width - 60)),
          y: this.clamp(current.y, 12, Math.max(12, size.height - 60))
        };
      });
    });

    effect(() => {
      const resource = this.resource();
      const session = this.workspace.session();

      if (!resource || !session || session.translationViewMode === 'original') {
        return;
      }

      void this.ensurePageTranslation(
        session.currentPage,
        session.translationViewMode === 'inline' ? 'inline' : 'page'
      );
    });

    this.destroyRef.onDestroy(() => {
      if (this.noticeTimer) {
        clearTimeout(this.noticeTimer);
      }
      this.voiceService.stop();
      void this.pdfService.disposeResource(this.resource());
    });

    void this.bootstrapWorkspace();
  }

  protected async saveWorkspace() {
    if (!this.workspace.session()) {
      this.showNotice('info', 'No file open', 'Upload a file first, then save the workspace if you want to keep it locally.');
      return;
    }
    await this.persistenceState.saveNow();
    this.showNotice('success', 'Workspace saved', 'Your current study session was saved locally.');
  }

  protected openFilePicker() {
    this.fileInputRef()?.nativeElement.click();
  }

  protected async handleFileSelection(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    await this.openWorkspaceFile(file, this.resolveSourceType(file));
    input.value = '';
  }

  protected async loadDemoWorkspace() {
    const demoFile = await this.pdfService.createDemoFile();
    await this.openWorkspaceFile(demoFile, 'sample');
  }

  protected async retryWorkspaceLoad() {
    await this.bootstrapWorkspace();
  }

  protected async reopenSavedWorkspace() {
    const recovered = this.recoverableWorkspace();
    if (!recovered?.session || !recovered.file) {
      return;
    }

    await this.openWorkspaceFile(recovered.file, recovered.session.sourceType, recovered.session);
  }

  protected async discardRecoveredWorkspace() {
    await this.persistenceService.clearWorkspace();
    this.recoverableWorkspace.set(null);
    this.showNotice('info', 'Saved workspace cleared', 'The previously saved document was removed from local recovery.');
  }

  protected zoomIn() {
    const session = this.workspace.session();
    if (!session) {
      return;
    }
    this.workspace.patchSession({
      fitMode: 'manual',
      zoom: Number(Math.min(2.6, session.zoom + 0.12).toFixed(2))
    });
  }

  protected zoomOut() {
    const session = this.workspace.session();
    if (!session) {
      return;
    }
    this.workspace.patchSession({
      fitMode: 'manual',
      zoom: Number(Math.max(0.45, session.zoom - 0.12).toFixed(2))
    });
  }

  protected setFitMode(mode: DocumentSession['fitMode']) {
    if (!this.workspace.session()) {
      return;
    }
    this.workspace.patchSession({ fitMode: mode });
  }

  protected toggleToolsMenu() {
    if (!this.resource()) {
      return;
    }
    const nextOpen = !this.toolsMenuOpen();
    this.toolsMenuOpen.set(nextOpen);
    if (!nextOpen) {
      this.closeActiveTool();
    }
  }

  protected closeToolsMenu() {
    this.toolsMenuOpen.set(false);
    this.closeActiveTool();
  }

  protected async setActiveTool(tool: WorkspaceToolKey) {
    const normalizedTool = this.normalizeWorkspaceTool(tool);

    if (normalizedTool === 'focus') {
      this.toggleFocusMode();
      return;
    }

    if (normalizedTool === 'notes') {
      this.panelsState.openRightPanel('notes');
      this.activeTool.set(null);
      this.annotationState.clearTool();
      this.syncWorkspaceViewMode();
      return;
    }

    this.activeTool.set(normalizedTool);
    if (!this.isAnnotationWorkspaceTool(normalizedTool)) {
      this.annotationState.clearTool();
    }

    switch (normalizedTool) {
      case 'reader':
        this.syncWorkspaceViewMode();
        return;
      case 'draw':
        this.activateAnnotationTool('free-draw');
        return;
      case 'highlight':
        this.activateAnnotationTool(
          this.annotationState.activeTool() === 'underline' ? 'underline' : 'highlight'
        );
        return;
      case 'shapes':
        this.activateAnnotationTool(
          this.annotationState.activeTool() === 'circle' ? 'circle' : 'rectangle'
        );
        return;
      case 'arrow':
        this.activateAnnotationTool('arrow');
        return;
      case 'text-note':
        this.activateAnnotationTool(
          this.annotationState.activeTool() === 'sticky-note' ? 'sticky-note' : 'text-note'
        );
        return;
      case 'eraser':
        this.activateAnnotationTool('eraser');
        return;
      case 'ai':
        this.openAIAssistant();
        return;
      case 'translate':
        if (this.workspace.session()?.translationViewMode === 'original') {
          await this.setTranslationMode('inline');
        } else {
          await this.translateCurrentPage();
        }
        return;
      case 'recorder':
        return;
    }
  }

  protected closeActiveTool() {
    const previousTool = this.activeTool();
    this.activeTool.set(null);

    if (previousTool && this.isAnnotationWorkspaceTool(previousTool)) {
      this.annotationState.clearTool();
    }

    this.syncWorkspaceViewMode();
  }

  protected toggleFocusMode() {
    const session = this.workspace.session();
    if (!session) {
      return;
    }

    const nextFocus = !session.focusMode;
    if (nextFocus) {
      this.selectionState.clearSelection();
      this.closeRightPanel();
      this.toolsMenuOpen.set(false);
      this.activeTool.set(null);
    }

    this.workspace.patchSession({
      focusMode: nextFocus,
      viewMode: this.resolveWorkspaceViewMode(
        session.translationViewMode,
        this.annotationState.activeTool(),
        nextFocus
      )
    });

    this.showNotice(
      'info',
      nextFocus ? 'Focus mode on' : 'Focus mode off',
      nextFocus
        ? 'The interface is reduced so the document can take the full workspace.'
        : 'Full study controls are visible again.'
    );
  }

  protected toggleTranslationPanel() {
    const isOpen = this.panelsState.activeRightPanel() === 'translation' && this.workspace.session()?.panelVisibility.translation;
    this.panelsState.toggleRightPanel('translation');
    if (!isOpen) {
      this.annotationState.clearTool();
      this.syncWorkspaceViewMode();
    }
    this.activeTool.set(isOpen ? null : 'translate');
  }

  protected toggleAIPanel() {
    const isOpen = this.panelsState.activeRightPanel() === 'ai' && this.workspace.session()?.panelVisibility.ai;
    if (isOpen) {
      this.closeRightPanel();
      return;
    }
    this.openAIAssistant();
  }

  protected toggleNotesPanel() {
    const isOpen = this.panelsState.activeRightPanel() === 'notes' && this.workspace.session()?.panelVisibility.notes;
    this.panelsState.toggleRightPanel('notes');
    if (!isOpen) {
      this.annotationState.clearTool();
      this.syncWorkspaceViewMode();
    }
    this.activeTool.set(null);
  }

  protected goToPreviousPage() {
    const session = this.workspace.session();
    if (!session || session.currentPage <= 1) {
      return;
    }
    this.requestScroll(session.currentPage - 1);
  }

  protected goToNextPage() {
    const session = this.workspace.session();
    if (!session || session.currentPage >= session.totalPages) {
      return;
    }
    this.requestScroll(session.currentPage + 1);
  }

  protected jumpToPage(pageNumber: number) {
    this.requestScroll(pageNumber);
  }

  protected jumpToNote(note: StudyNote) {
    const totalPages = this.workspace.session()?.totalPages || 0;
    if (!note.pageNumber || note.pageNumber > totalPages) {
      this.showNotice('warning', 'Note location unavailable', 'This note points to a page that is not available in the current document.');
      return;
    }
    this.panelsState.openRightPanel('notes');
    this.requestScroll(note.pageNumber, note.anchorRect?.y);
    this.showNotice('info', 'Jumped to note', `Moved back to page ${note.pageNumber}.`);
  }

  protected handleCurrentPageChange(pageNumber: number) {
    const session = this.workspace.session();
    if (!session || pageNumber === session.currentPage) {
      return;
    }
    this.workspace.patchSession({ currentPage: pageNumber });
  }

  protected handleSelectionChange(selection: SelectedTextContext | null) {
    this.selectionState.setSelection(selection);
    if (!selection) {
      this.annotationState.selectAnnotation(null);
    }
  }

  protected async handleSelectionAction(action: SelectionAction) {
    const selection = this.selectionState.selection();
    if (!selection) {
      return;
    }

    switch (action) {
      case 'explain':
        this.activeTool.set(null);
        this.annotationState.clearTool();
        this.syncWorkspaceViewMode();
        this.panelsState.openRightPanel('ai');
        await this.aiActions.explainSelection(selection);
        break;
      case 'translate':
        this.activeTool.set('translate');
        this.annotationState.clearTool();
        this.syncWorkspaceViewMode();
        if ((this.workspace.session()?.translationViewMode || 'original') === 'original') {
          await this.setTranslationMode('inline');
        } else {
          await this.ensurePageTranslation(selection.pageNumber, 'inline', true);
        }
        await this.translateSelection(selection);
        break;
      case 'ask':
        this.activeTool.set(null);
        this.annotationState.clearTool();
        this.syncWorkspaceViewMode();
        this.panelsState.openRightPanel('ai');
        this.aiActions.openThreadForSelection(selection);
        break;
      case 'simplify':
        this.activeTool.set(null);
        this.annotationState.clearTool();
        this.syncWorkspaceViewMode();
        this.panelsState.openRightPanel('ai');
        await this.aiActions.simplifySelection(selection);
        break;
      case 'highlight':
        this.annotationState.addAnnotation(createSelectionAnnotation('highlight', selection));
        this.selectionState.clearSelection();
        this.showNotice('success', 'Highlight added', `Saved a highlight on page ${selection.pageNumber}.`);
        break;
      case 'add-note':
        this.activeTool.set('notes');
        this.annotationState.clearTool();
        this.syncWorkspaceViewMode();
        this.addAnchoredSelectionNote(selection);
        break;
      case 'copy':
        await this.copyText(selection.text);
        break;
    }
  }

  protected async askFollowUp(question: string) {
    const thread = this.aiActions.activeThread();
    if (thread?.scope === 'selection' && thread.selection) {
      await this.aiActions.askSelection(thread.selection, question);
      return;
    }

    const selection = this.selectionState.selection();
    if (selection && !thread) {
      await this.aiActions.askSelection(selection, question);
      return;
    }

    await this.aiActions.askGeneral(question, this.currentAIContext());
  }

  protected async playVoiceExplanation(item: { id: string; response: string }) {
    await this.voiceService.playVoiceExplanation(item.id, item.response);
  }

  protected clearAIResults() {
    this.voiceService.stop();
    this.aiActions.clearResponses();
    this.showNotice('info', 'AI results cleared', 'The document copilot history was cleared for this session.');
  }

  protected async setTranslationMode(mode: TranslationViewMode) {
    const session = this.workspace.session();
    if (!session) {
      return;
    }

    this.workspace.patchSession({
      translationViewMode: mode,
      viewMode: this.resolveWorkspaceViewMode(mode, this.annotationState.activeTool(), session.focusMode)
    });

    if (mode !== 'original') {
      const currentPage = session.currentPage || 1;
      await this.ensurePageTranslation(currentPage, mode === 'inline' ? 'inline' : 'page');
    }
  }

  protected async translateCurrentPage() {
    const currentPage = this.workspace.session()?.currentPage;
    if (!currentPage) {
      return;
    }

    await this.ensurePageTranslation(
      currentPage,
      (this.workspace.session()?.translationViewMode || 'page') === 'inline' ? 'inline' : 'page',
      true
    );
  }

  protected setAnnotationTool(tool: AnnotationTool) {
    this.annotationState.setTool(tool);
    this.activeTool.set(this.workspaceToolForAnnotation(tool));
    this.syncWorkspaceViewMode();
  }

  protected async setTranslationSourceLanguage(language: WorkspaceLanguage) {
    const session = this.workspace.session();
    if (!session || session.translationSourceLanguage === language) {
      return;
    }

    this.workspace.patchSession({
      translationSourceLanguage: language,
      selectedTextTranslation: null,
      pageTranslations: {}
    });
    this.showNotice('info', 'Source language updated', 'New translations will use the updated source language preference.');

    if (session.translationViewMode !== 'original') {
      await this.translateCurrentPage();
    }
  }

  protected async setTranslationTargetLanguage(language: TargetLanguage) {
    const session = this.workspace.session();
    if (!session || session.translationTargetLanguage === language) {
      return;
    }

    this.workspace.patchSession({
      translationTargetLanguage: language,
      selectedTextTranslation: null,
      pageTranslations: {}
    });
    this.showNotice('info', 'Target language updated', 'Inline and page translations will refresh in the selected language.');

    if (session.translationViewMode !== 'original') {
      await this.translateCurrentPage();
    }
  }

  protected setRecordingCaptureMode(mode: RecordingCaptureMode) {
    const recording = this.recordingState.recording();
    if (recording.captureMode === mode) {
      return;
    }

    this.workspace.updateSession((current) => ({
      ...current,
      recording: {
        ...current.recording,
        captureMode: mode
      }
    }));

    if (recording.status === 'recording' || recording.status === 'paused') {
      this.showNotice(
        'info',
        'Capture mode saved',
        'The new capture mode will apply the next time you start a recording session.'
      );
    }
  }

  protected async copyTranslatedSelection(item: TranslationBlock) {
    await this.copyText(item.translatedText);
  }

  protected saveTranslatedSelectionAsNote(item: TranslationBlock) {
    const selection = this.activeAISelection();
    if (selection && selection.text === item.sourceText) {
      const anchored = createAnchoredNote(selection);
      anchored.title = 'Translated selection';
      anchored.content = `${item.sourceText}\n\n${item.translatedText}`;
      this.pushNote(anchored);
      this.showNotice('success', 'Saved to notes', 'The translated selection was attached to your notes.');
      return;
    }

    this.pushNote({
      id: crypto.randomUUID(),
      type: 'general',
      title: 'Translated selection',
      content: `${item.sourceText}\n\n${item.translatedText}`,
      pageNumber: item.pageNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    this.showNotice('success', 'Saved to notes', 'The translated selection was added to your document notes.');
  }

  protected addGeneralNote(title: string, content: string) {
    this.pushNote({
      id: crypto.randomUUID(),
      type: 'general',
      title,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    this.showNotice('success', 'Note added', 'Your document note is now part of this study session.');
  }

  protected updateNote(note: StudyNote) {
    this.workspace.updateSession((current) => ({
      ...current,
      notes: current.notes.map((item) => (item.id === note.id ? note : item))
    }));
  }

  protected deleteNote(noteId: string) {
    this.workspace.updateSession((current) => ({
      ...current,
      notes: current.notes.filter((item) => item.id !== noteId)
    }));
  }

  protected closeRightPanel() {
    this.panelsState.closeRightPanels();
    if (this.activeTool() === 'notes' || this.activeTool() === 'translate' || this.activeTool() === 'ai') {
      this.activeTool.set(null);
      this.syncWorkspaceViewMode();
    }
  }

  protected startAILauncherDrag(event: PointerEvent) {
    const host = this.viewerHostRef()?.nativeElement;
    if (!host) {
      return;
    }

    const rect = host.getBoundingClientRect();
    this.aiLauncherDragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left - this.aiLauncherPosition().x,
      offsetY: event.clientY - rect.top - this.aiLauncherPosition().y,
      moved: false
    };
    event.preventDefault();
    event.stopPropagation();
  }

  protected handleAILauncherClick(event: MouseEvent) {
    if (this.aiLauncherDragState.moved) {
      event.preventDefault();
      event.stopPropagation();
      this.aiLauncherDragState.moved = false;
      return;
    }

    this.openAIAssistant();
  }

  protected async startRecording() {
    try {
      await this.recordingState.startRecording(this.workspace.session()?.recording.captureMode || 'microphone');
      this.showNotice('success', 'Recording started', 'Lecture recording will continue while you move between pages and panels.');
    } catch {
      this.showNotice(
        'warning',
        'Recording unavailable',
        this.recordingState.recording().lastError || 'Microphone access is required to start recording.'
      );
    }
  }

  protected pauseRecording() {
    this.recordingState.pauseRecording();
    this.showNotice('info', 'Recording paused', 'The session-wide lecture recording is paused.');
  }

  protected resumeRecording() {
    this.recordingState.resumeRecording();
    this.showNotice('success', 'Recording resumed', 'Lecture recording is active again across the workspace.');
  }

  protected stopRecording() {
    this.recordingState.stopRecording();
    this.showNotice('success', 'Recording stopped', 'The lecture recording metadata was saved for this session.');
  }

  protected async downloadDocument() {
    const resource = this.resource();
    if (!resource) {
      return;
    }

    const url = resource.objectUrl || URL.createObjectURL(resource.file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = resource.file.name;
    anchor.click();
  }

  protected async resetWorkspace() {
    this.voiceService.stop();
    this.selectionState.clearSelection();
    this.recordingState.stopRecording();
    this.toolsMenuOpen.set(false);
    this.activeTool.set(null);
    this.annotationState.clearTool();

    const previous = this.resource();
    this.resource.set(null);
    this.workspace.setSession(null);
    this.errorMessage.set(null);
    this.loading.set(false);
    this.pageTranslationRequests.clear();

    await this.persistenceService.clearWorkspace();
    this.recoverableWorkspace.set(null);
    await this.pdfService.disposeResource(previous);
    this.showNotice('info', 'Workspace reset', 'Saved local session data was cleared. You can open a file or the demo document again.');
  }

  protected copyAIResult(item: AIResponseItem) {
    const text = item.response;
    void this.copyText(text);
  }

  protected saveAIResultAsNote(item: { selectionText: string; response: string; pageNumber: number; kind: string }) {
    const selection = this.activeAISelection();
    if (selection && selection.text === item.selectionText) {
      const anchored = createAnchoredNote(selection);
      anchored.title = item.kind === 'explain' ? 'AI explanation' : 'Simplified wording';
      anchored.content = `${item.selectionText}\n\n${item.response}`;
      this.pushNote(anchored);
    } else {
      this.pushNote({
        id: crypto.randomUUID(),
        type: 'general',
        title: item.kind === 'explain' ? 'AI explanation' : 'Simplified wording',
        content: `${item.selectionText}\n\n${item.response}`,
        pageNumber: item.pageNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    this.showNotice('success', 'Saved to notes', 'The AI result was added to your study notes.');
  }

  @HostListener('window:beforeunload')
  protected handleBeforeUnload() {
    void this.persistenceState.saveNow();
  }

  @HostListener('document:pointermove', ['$event'])
  protected handleAILauncherPointerMove(event: PointerEvent) {
    if (this.aiLauncherDragState.pointerId !== event.pointerId) {
      return;
    }

    const host = this.viewerHostRef()?.nativeElement;
    if (!host) {
      return;
    }

    const rect = host.getBoundingClientRect();
    const nextX = this.clamp(event.clientX - rect.left - this.aiLauncherDragState.offsetX, 12, Math.max(12, rect.width - 60));
    const nextY = this.clamp(event.clientY - rect.top - this.aiLauncherDragState.offsetY, 12, Math.max(12, rect.height - 60));
    const current = this.aiLauncherPosition();
    if (Math.abs(current.x - nextX) > 2 || Math.abs(current.y - nextY) > 2) {
      this.aiLauncherDragState.moved = true;
      this.aiLauncherPinned = true;
      this.aiLauncherPosition.set({ x: nextX, y: nextY });
    }
  }

  @HostListener('document:pointerup', ['$event'])
  protected handleAILauncherPointerUp(event: PointerEvent) {
    if (this.aiLauncherDragState.pointerId !== event.pointerId) {
      return;
    }

    this.aiLauncherDragState.pointerId = null;
    this.aiLauncherDragState.offsetX = 0;
    this.aiLauncherDragState.offsetY = 0;
  }

  @HostListener('document:keydown', ['$event'])
  protected handleKeyboardShortcuts(event: KeyboardEvent) {
    if (this.shouldIgnoreShortcut(event)) {
      return;
    }

    const key = event.key.toLowerCase();

    if (event.key === 'Escape') {
      if (this.selectionState.selection()) {
        this.selectionState.clearSelection();
        window.getSelection()?.removeAllRanges();
        event.preventDefault();
        return;
      }

      if (this.toolsMenuOpen()) {
        this.toolsMenuOpen.set(false);
        event.preventDefault();
        return;
      }

      if (this.panelsState.activeRightPanel()) {
        this.closeRightPanel();
        event.preventDefault();
        return;
      }

      if (this.activeTool()) {
        this.closeActiveTool();
        event.preventDefault();
        return;
      }
    }

    if ((event.ctrlKey || event.metaKey) && (key === '=' || key === '+')) {
      event.preventDefault();
      this.zoomIn();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && key === '-') {
      event.preventDefault();
      this.zoomOut();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === 'z') {
      event.preventDefault();
      this.annotationState.undo();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && ((event.shiftKey && key === 'z') || key === 'y')) {
      event.preventDefault();
      this.annotationState.redo();
      return;
    }

    if (!event.altKey) {
      return;
    }

    switch (key) {
      case 'a':
        event.preventDefault();
        this.toggleAIPanel();
        break;
      case 'n':
        event.preventDefault();
        this.toggleNotesPanel();
        break;
      case 't':
        event.preventDefault();
        this.toggleTranslationPanel();
        break;
      case 'f':
        event.preventDefault();
        this.toggleFocusMode();
        break;
      case 'm':
        event.preventDefault();
        this.toggleToolsMenu();
        break;
      default:
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          this.goToPreviousPage();
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          this.goToNextPage();
        }
        break;
    }
  }

  private activateAnnotationTool(tool: AnnotationTool) {
    this.selectionState.clearSelection();
    this.annotationState.setTool(tool);
    this.syncWorkspaceViewMode();
  }

  private syncWorkspaceViewMode() {
    const session = this.workspace.session();
    if (!session) {
      return;
    }

    this.workspace.patchSession({
      viewMode: this.resolveWorkspaceViewMode(
        session.translationViewMode,
        this.annotationState.activeTool(),
        session.focusMode
      )
    });
  }

  private resolveWorkspaceViewMode(
    translationMode: TranslationViewMode,
    annotationTool: AnnotationTool,
    focusMode: boolean
  ): WorkspaceViewMode {
    if (focusMode) {
      return 'focus';
    }

    if (annotationTool !== 'select') {
      return 'annotation';
    }

    return translationMode === 'original' ? 'reading' : 'translation';
  }

  private isAnnotationWorkspaceTool(tool: WorkspaceToolKey): boolean {
    return (
      tool === 'draw' ||
      tool === 'highlight' ||
      tool === 'shapes' ||
      tool === 'arrow' ||
      tool === 'text-note' ||
      tool === 'eraser'
    );
  }

  private normalizeWorkspaceTool(tool: WorkspaceToolKey): WorkspaceToolKey {
    return tool === 'sticky-note' ? 'text-note' : tool;
  }

  private workspaceToolForAnnotation(tool: AnnotationTool): WorkspaceToolKey | null {
    switch (tool) {
      case 'free-draw':
        return 'draw';
      case 'highlight':
      case 'underline':
        return 'highlight';
      case 'rectangle':
      case 'circle':
        return 'shapes';
      case 'arrow':
        return 'arrow';
      case 'text-note':
      case 'sticky-note':
        return 'text-note';
      case 'eraser':
        return 'eraser';
      default:
        return null;
    }
  }

  private async bootstrapWorkspace() {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.landingMessage.set(null);

    try {
      const restored = await this.persistenceState.restore();
      this.recoverableWorkspace.set(restored.session && restored.file ? restored : null);
      this.workspace.setSession(null);
      this.resource.set(null);
      this.loading.set(false);

      if (restored.session && !restored.file) {
        this.landingMessage.set(
          'A saved workspace was found, but its file is no longer available. Upload the file you want to study to continue.'
        );
      }
    } catch (error) {
      console.error('Document workspace bootstrap failed', error);
      this.workspace.setSession(null);
      this.resource.set(null);
      this.errorMessage.set('The workspace could not check local recovery data. Upload a file to continue.');
      this.loading.set(false);
    }
  }

  private async openWorkspaceFile(
    originalFile: File,
    sourceType: WorkspaceSourceType,
    restoredSession?: DocumentSession
  ) {
    const requestId = ++this.loadRequestId;
    this.loading.set(true);
    this.errorMessage.set(null);
    this.landingMessage.set(null);
    this.selectionState.clearSelection();
    this.voiceService.stop();
    this.toolsMenuOpen.set(false);
    this.activeTool.set(null);
    this.annotationState.clearTool();
    this.panelsState.closeRightPanels();

    try {
      const recording = this.recordingState.recording();
      if (recording.status === 'recording' || recording.status === 'paused') {
        this.recordingState.stopRecording();
        this.showNotice('warning', 'Recording stopped', 'The previous recording was stopped before switching to a different file.');
      }

      const renderFile =
        sourceType === 'ppt' ? await this.pdfService.createSlidePlaceholder(originalFile) : originalFile;
      const nextResource = await this.pdfService.loadFile(renderFile, sourceType);
      if (requestId !== this.loadRequestId) {
        await this.pdfService.disposeResource(nextResource);
        return;
      }
      nextResource.fileId = restoredSession?.fileId || nextResource.fileId;
      nextResource.fileName = restoredSession?.fileName || originalFile.name;

      const nextSession = restoredSession
        ? this.hydrateSession(restoredSession, nextResource)
        : this.createSession(nextResource, originalFile.name, sourceType);

      const previous = this.resource();
      this.resource.set(nextResource);
      this.workspace.setSession(nextSession);
      await this.pdfService.disposeResource(previous);

      if (!restoredSession) {
        await this.persistenceService.persistFile(nextSession.fileId, originalFile);
      }

      this.recoverableWorkspace.set({
        session: nextSession,
        file: originalFile
      });
      this.toolsMenuOpen.set(true);
      await this.persistenceState.saveNow();
      this.loading.set(false);
      if (!restoredSession) {
        this.showNotice('success', 'Document ready', `${originalFile.name} is open and ready for study.`);
      }
    } catch (error) {
      console.error('Document workspace load failed', error);
      this.errorMessage.set(
        'The document could not be opened. Check the file type and try again. PDF files are supported directly, and PowerPoint files currently open through a generated study placeholder.'
      );
      this.loading.set(false);
    }
  }

  private createSession(
    resource: LoadedDocumentResource,
    displayName: string,
    sourceType: WorkspaceSourceType
  ): DocumentSession {
    const id = crypto.randomUUID();
    return {
      id,
      fileId: resource.fileId,
      fileName: displayName,
      sourceType,
      currentPage: 1,
      totalPages: resource.totalPages,
      zoom: 1,
      fitMode: 'width',
      viewMode: 'reading',
      translationViewMode: 'original',
      panelVisibility: createDefaultPanelVisibility(),
      focusMode: false,
      activeRightPanel: null,
      annotations: [],
      notes: [],
      aiResponses: [],
      aiThreads: [],
      activeAIThreadId: null,
      selectedTextTranslation: null,
      pageTranslations: {},
      recording: {
        ...createDefaultRecordingState(),
        documentId: resource.fileId,
        workspaceSessionId: id
      },
      translationSourceLanguage: 'auto',
      translationTargetLanguage: 'ar',
      selectableTextAvailable: resource.pages.some((page) => page.blocks.length > 0),
      updatedAt: new Date().toISOString()
    };
  }

  private hydrateSession(restored: DocumentSession, resource: LoadedDocumentResource): DocumentSession {
    const currentPage = Math.min(Math.max(1, restored.currentPage || 1), Math.max(1, resource.totalPages));
    return {
      ...restored,
      fileId: restored.fileId || resource.fileId,
      fileName: restored.fileName || resource.fileName,
      totalPages: resource.totalPages,
      currentPage,
      selectableTextAvailable: resource.pages.some((page) => page.blocks.length > 0),
      panelVisibility: {
        ...createDefaultPanelVisibility(),
        ...restored.panelVisibility
      },
      recording: {
        ...restored.recording,
        captureMode: restored.recording?.captureMode || 'microphone',
        documentId: restored.fileId || resource.fileId,
        workspaceSessionId: restored.id
      },
      translationSourceLanguage: restored.translationSourceLanguage || 'auto',
      translationTargetLanguage: restored.translationTargetLanguage || 'ar',
      updatedAt: new Date().toISOString()
    };
  }

  private resolveSourceType(file: File): WorkspaceSourceType {
    return /\.(ppt|pptx)$/i.test(file.name) ? 'ppt' : 'pdf';
  }

  private requestScroll(pageNumber: number, anchorY?: number) {
    this.workspace.patchSession({ currentPage: pageNumber });
    this.scrollRequest.set({
      pageNumber,
      anchorY,
      id: ++this.scrollRequestId
    });
  }

  private async translateSelection(selection: SelectedTextContext) {
    this.translationSelectionLoading.set(true);
    try {
      const session = this.workspace.session();
      if (!session) {
        return;
      }

      const translation = await this.translationService.translateSelection(
        selection.text,
        selection.pageNumber,
        session.translationSourceLanguage,
        session.translationTargetLanguage
      );
      this.workspace.patchSession({ selectedTextTranslation: translation });
      this.showNotice('success', 'Selection translated', 'The translated line is ready and can also be shown directly in the document view.');
    } catch (error) {
      console.error('Selected text translation failed', error);
      this.workspace.patchSession({ selectedTextTranslation: null });
      this.showNotice('warning', 'Translation unavailable', 'The selected text could not be translated right now.');
    } finally {
      this.translationSelectionLoading.set(false);
    }
  }

  private async ensurePageTranslation(
    pageNumber: number,
    mode: TranslationBlock['mode'],
    force = false
  ) {
    const session = this.workspace.session();
    const resource = this.resource();

    if (!session || !resource) {
      return;
    }

    const page = resource.pages.find((item) => item.pageNumber === pageNumber);
    if (!page) {
      return;
    }

    const expectedSource = this.translationService.resolveSourceLanguage(page.text, session.translationSourceLanguage);
    const expectedTarget = this.translationService.resolveTargetLanguage(
      page.text,
      session.translationSourceLanguage,
      session.translationTargetLanguage
    );
    const existing = session.pageTranslations[pageNumber];
    if (!force && existing && (existing.status === 'loading' || existing.status === 'unavailable')) {
      return;
    }
    if (
      !force &&
      existing?.status === 'ready' &&
      existing.sourceLanguage === expectedSource &&
      existing.targetLanguage === expectedTarget &&
      existing.blocks.length
    ) {
      return;
    }
    if (this.pageTranslationRequests.has(pageNumber)) {
      return;
    }

    if (!page.blocks.length) {
      this.workspace.updateSession((current) => ({
        ...current,
        pageTranslations: {
        ...current.pageTranslations,
        [pageNumber]: {
          pageNumber,
          sourceLanguage: expectedSource,
          targetLanguage: expectedTarget,
          status: 'unavailable',
          blocks: [],
          createdAt: new Date().toISOString()
        }
        }
      }));
      if (force) {
        this.showNotice('warning', 'Translation unavailable', 'This page does not have extracted text blocks available for translation.');
      }
      return;
    }

    this.pageTranslationRequests.add(pageNumber);
    this.workspace.updateSession((current) => ({
      ...current,
      pageTranslations: {
        ...current.pageTranslations,
        [pageNumber]: {
          pageNumber,
          sourceLanguage: current.pageTranslations[pageNumber]?.sourceLanguage || expectedSource,
          targetLanguage: expectedTarget,
          status: 'loading',
          blocks: current.pageTranslations[pageNumber]?.blocks || [],
          createdAt: current.pageTranslations[pageNumber]?.createdAt || new Date().toISOString()
        }
      }
    }));

    try {
      const batch = await this.translationService.translatePageBlocks(
        pageNumber,
        page.blocks,
        session.translationSourceLanguage,
        session.translationTargetLanguage,
        mode
      );
      this.workspace.updateSession((current) => ({
        ...current,
        pageTranslations: {
          ...current.pageTranslations,
          [pageNumber]: {
            pageNumber,
            sourceLanguage: batch.sourceLanguage,
            targetLanguage: batch.targetLanguage,
            status: 'ready',
            blocks: batch.blocks,
            createdAt: current.pageTranslations[pageNumber]?.createdAt || new Date().toISOString()
          }
        }
      }));
      if (force) {
        this.showNotice('success', 'Page translation ready', `Translated content is ready for page ${pageNumber}.`);
      }
    } catch (error) {
      console.error('Page translation failed', error);
      this.workspace.updateSession((current) => ({
        ...current,
        pageTranslations: {
        ...current.pageTranslations,
        [pageNumber]: {
          pageNumber,
          sourceLanguage: current.pageTranslations[pageNumber]?.sourceLanguage || expectedSource,
          targetLanguage: expectedTarget,
          status: 'error',
          blocks: [],
          createdAt: current.pageTranslations[pageNumber]?.createdAt || new Date().toISOString(),
            errorMessage: 'Translation is temporarily unavailable for this page.'
          }
        }
      }));
      if (force) {
        this.showNotice('warning', 'Translation unavailable', 'The current page could not be translated right now.');
      }
    } finally {
      this.pageTranslationRequests.delete(pageNumber);
    }
  }

  private addAnchoredSelectionNote(selection: SelectedTextContext) {
    const note = createAnchoredNote(selection);
    note.content = selection.text;
    this.pushNote(note);
    this.panelsState.openRightPanel('notes');
    this.selectionState.clearSelection();
    this.showNotice('success', 'Selection note added', `A note was attached to page ${selection.pageNumber}.`);
  }

  private pushNote(note: StudyNote) {
    this.workspace.updateSession((current) => ({
      ...current,
      notes: [note, ...current.notes]
    }));
    this.panelsState.openRightPanel('notes');
  }

  private async copyText(text: string) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        this.showNotice('success', 'Copied', 'Content was copied to the clipboard.');
        return;
      }

      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();

      if (!copied) {
        throw new Error('Clipboard fallback failed');
      }

      this.showNotice('success', 'Copied', 'Content was copied to the clipboard.');
    } catch (error) {
      console.warn('Clipboard copy failed', error);
      this.showNotice('warning', 'Copy unavailable', 'Clipboard access is not available in this browser context.');
    }
  }

  private showNotice(
    tone: WorkspaceNotice['tone'],
    title: string,
    message: string,
    durationMs = 2600
  ) {
    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer);
    }

    this.notice.set({
      id: crypto.randomUUID(),
      tone,
      title,
      message
    });

    this.noticeTimer = setTimeout(() => {
      this.notice.set(null);
      this.noticeTimer = null;
    }, durationMs);
  }

  private shouldIgnoreShortcut(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return false;
    }

    if (target.isContentEditable) {
      return true;
    }

    const tagName = target.tagName.toLowerCase();
    return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
  }

  protected openAIAssistant() {
    if (!this.resource()) {
      return;
    }

    this.annotationState.clearTool();
    this.aiActions.openGeneralThread();
    this.panelsState.openRightPanel('ai');
    this.activeTool.set(null);
    this.syncWorkspaceViewMode();
  }

  private currentAIContext() {
    const session = this.workspace.session();
    const resource = this.resource();
    const currentPage = session?.currentPage || 1;
    const page = resource?.pages.find((item) => item.pageNumber === currentPage) || resource?.pages[0];

    return {
      fileName: session?.fileName || resource?.fileName,
      currentPage,
      pageSummary: page?.summary,
      pageText: page?.text
    };
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }
}
