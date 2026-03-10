import {
  DestroyRef,
  Signal,
  WritableSignal,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import {
  AIResponseItem,
  AISelectionThread,
  AIThreadMessage,
  AnnotationItem,
  AnnotationTool,
  DocumentSession,
  PanelVisibilityState,
  RecordingCaptureMode,
  RecordingSessionState,
  RightPanelKey,
  SelectedTextContext,
  StudyNote,
  TranslationViewMode
} from './document-workspace.types';
import { DocumentWorkspaceAIService } from './services/document-workspace-ai.service';
import { DocumentWorkspacePersistenceService } from './services/document-workspace-persistence.service';
import { DocumentWorkspaceRecordingService } from './services/document-workspace-recording.service';

export interface WorkspaceStateApi {
  session: WritableSignal<DocumentSession | null>;
  setSession: (next: DocumentSession | null) => void;
  updateSession: (updater: (current: DocumentSession) => DocumentSession) => void;
  patchSession: (patch: Partial<DocumentSession>) => void;
}

export function createDefaultPanelVisibility(): PanelVisibilityState {
  return {
    thumbnails: false,
    ai: false,
    translation: false,
    notes: false
  };
}

export function createDefaultRecordingState(): RecordingSessionState {
  return {
    sessionId: crypto.randomUUID(),
    captureMode: 'microphone',
    status: 'idle',
    permission: 'unknown',
    elapsedMs: 0,
    chunks: 0,
    updatedAt: new Date().toISOString()
  };
}

export function useDocumentWorkspaceState(initialSession: DocumentSession | null = null): WorkspaceStateApi {
  const session = signal<DocumentSession | null>(initialSession);

  const setSession = (next: DocumentSession | null) => {
    session.set(next);
  };

  const updateSession = (updater: (current: DocumentSession) => DocumentSession) => {
    session.update((current) => {
      if (!current) {
        return current;
      }
      return {
        ...updater(current),
        updatedAt: new Date().toISOString()
      };
    });
  };

  const patchSession = (patch: Partial<DocumentSession>) => {
    updateSession((current) => ({
      ...current,
      ...patch
    }));
  };

  return { session, setSession, updateSession, patchSession };
}

function resolveNextActiveRightPanel(
  panels: PanelVisibilityState,
  preferred: RightPanelKey
): RightPanelKey {
  if (preferred && panels[preferred]) {
    return preferred;
  }
  if (panels.ai) return 'ai';
  if (panels.translation) return 'translation';
  if (panels.notes) return 'notes';
  return null;
}

function setExclusiveRightPanels(panel: Exclude<RightPanelKey, null>, open: boolean): PanelVisibilityState {
  return {
    thumbnails: false,
    ai: open && panel === 'ai',
    translation: open && panel === 'translation',
    notes: open && panel === 'notes'
  };
}

export function usePanelsState(workspace: WorkspaceStateApi) {
  const panels = computed(() => workspace.session()?.panelVisibility ?? createDefaultPanelVisibility());
  const activeRightPanel = computed(() => workspace.session()?.activeRightPanel ?? null);

  const toggleThumbnails = () => {
    workspace.updateSession((current) => ({
      ...current,
      panelVisibility: {
        ...current.panelVisibility,
        thumbnails: !current.panelVisibility.thumbnails
      }
    }));
  };

  const toggleRightPanel = (panel: Exclude<RightPanelKey, null>) => {
    workspace.updateSession((current) => {
      const nextOpen = !(current.activeRightPanel === panel && current.panelVisibility[panel]);
      const nextPanels = {
        ...current.panelVisibility,
        ...setExclusiveRightPanels(panel, nextOpen),
        thumbnails: current.panelVisibility.thumbnails
      };

      return {
        ...current,
        panelVisibility: nextPanels,
        activeRightPanel: nextOpen ? panel : resolveNextActiveRightPanel(nextPanels, current.activeRightPanel)
      };
    });
  };

  const openRightPanel = (panel: Exclude<RightPanelKey, null>) => {
    workspace.updateSession((current) => ({
      ...current,
      panelVisibility: {
        ...current.panelVisibility,
        ...setExclusiveRightPanels(panel, true),
        thumbnails: current.panelVisibility.thumbnails
      },
      activeRightPanel: panel
    }));
  };

  const closeRightPanels = () => {
    workspace.updateSession((current) => ({
      ...current,
      panelVisibility: {
        ...current.panelVisibility,
        ai: false,
        translation: false,
        notes: false
      },
      activeRightPanel: null
    }));
  };

  return {
    panels,
    activeRightPanel,
    toggleThumbnails,
    toggleRightPanel,
    openRightPanel,
    closeRightPanels
  };
}

export function useTranslationMode(workspace: WorkspaceStateApi) {
  const translationViewMode = computed(
    () => workspace.session()?.translationViewMode ?? ('original' as TranslationViewMode)
  );

  const setTranslationViewMode = (mode: TranslationViewMode) => {
    workspace.updateSession((current) => ({
      ...current,
      translationViewMode: mode,
      viewMode:
        mode === 'original'
          ? (current.viewMode === 'translation' ? 'reading' : current.viewMode)
          : 'translation'
    }));
  };

  return {
    translationViewMode,
    setTranslationViewMode
  };
}

export function useDocumentSelection() {
  const selection = signal<SelectedTextContext | null>(null);
  const hasSelection = computed(() => Boolean(selection()?.text?.trim()));

  return {
    selection,
    hasSelection,
    setSelection: (next: SelectedTextContext | null) => selection.set(next),
    clearSelection: () => selection.set(null)
  };
}

export function createSelectionAnnotation(
  type: 'highlight' | 'underline',
  selection: SelectedTextContext
): AnnotationItem {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    type,
    pageNumber: selection.pageNumber,
    color: type === 'highlight' ? '#f59e0b' : '#2563eb',
    fragments: selection.fragments,
    createdAt: now,
    updatedAt: now
  };
}

export function createAnchoredNote(selection: SelectedTextContext): StudyNote {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    type: 'anchored',
    title: 'Selection note',
    content: '',
    pageNumber: selection.pageNumber,
    anchorText: selection.text,
    anchorRect: selection.fragments[0],
    createdAt: now,
    updatedAt: now
  };
}

function createThreadMessage(
  role: AIThreadMessage['role'],
  text: string,
  status: AIThreadMessage['status'] = 'complete'
): AIThreadMessage {
  return {
    id: crypto.randomUUID(),
    role,
    text,
    status,
    createdAt: new Date().toISOString()
  };
}

function createSelectionThread(selection: SelectedTextContext): AISelectionThread {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    scope: 'selection',
    selectionKey: selection.selectionKey,
    selection,
    title: selection.text.slice(0, 72) || 'Selected text',
    messages: [],
    createdAt: now,
    updatedAt: now
  };
}

function createGeneralThread(): AISelectionThread {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    scope: 'general',
    selectionKey: '__general__',
    selection: null,
    title: 'General document assistant',
    messages: [],
    createdAt: now,
    updatedAt: now
  };
}

export function useAnnotations(workspace: WorkspaceStateApi) {
  const history = signal<AnnotationItem[][]>([]);
  const future = signal<AnnotationItem[][]>([]);
  const activeTool = signal<AnnotationTool>('select');
  const selectedAnnotationId = signal<string | null>(null);

  const annotations = computed(() => workspace.session()?.annotations ?? []);
  const canUndo = computed(() => history().length > 0);
  const canRedo = computed(() => future().length > 0);

  const commit = (next: AnnotationItem[]) => {
    history.update((stack) => [annotations(), ...stack].slice(0, 40));
    future.set([]);
    workspace.patchSession({ annotations: next });
  };

  const addAnnotation = (annotation: AnnotationItem) => {
    commit([...annotations(), annotation]);
    selectedAnnotationId.set(annotation.id);
  };

  const updateAnnotation = (annotation: AnnotationItem) => {
    commit(annotations().map((item) => (item.id === annotation.id ? annotation : item)));
  };

  const removeAnnotation = (annotationId: string) => {
    commit(annotations().filter((item) => item.id !== annotationId));
    if (selectedAnnotationId() === annotationId) {
      selectedAnnotationId.set(null);
    }
  };

  const undo = () => {
    const [previous, ...rest] = history();
    if (!previous) {
      return;
    }
    future.update((stack) => [annotations(), ...stack].slice(0, 40));
    history.set(rest);
    workspace.patchSession({ annotations: previous });
  };

  const redo = () => {
    const [next, ...rest] = future();
    if (!next) {
      return;
    }
    history.update((stack) => [annotations(), ...stack].slice(0, 40));
    future.set(rest);
    workspace.patchSession({ annotations: next });
  };

  const deleteSelected = () => {
    if (selectedAnnotationId()) {
      removeAnnotation(selectedAnnotationId()!);
    }
  };

  return {
    annotations,
    activeTool,
    selectedAnnotationId,
    canUndo,
    canRedo,
    setTool: (tool: AnnotationTool) => activeTool.set(tool),
    clearTool: () => activeTool.set('select'),
    selectAnnotation: (annotationId: string | null) => selectedAnnotationId.set(annotationId),
    addAnnotation,
    updateAnnotation,
    removeAnnotation,
    deleteSelected,
    undo,
    redo
  };
}

export function useRecordingState(
  workspace: WorkspaceStateApi,
  recordingService: DocumentWorkspaceRecordingService
) {
  const destroyRef = inject(DestroyRef);
  let hydratedSessionId: string | null = null;

  effect(() => {
    const current = workspace.session();
    if (!current) {
      return;
    }
    if (hydratedSessionId !== current.id) {
      recordingService.hydrate(current.recording);
      hydratedSessionId = current.id;
    }
  });

  const unsubscribe = recordingService.subscribe((nextState) => {
    if (!workspace.session()) {
      return;
    }
    workspace.patchSession({ recording: nextState });
  });

  destroyRef.onDestroy(() => {
    unsubscribe();
    recordingService.dispose();
  });

  return {
    recording: computed(() => workspace.session()?.recording ?? createDefaultRecordingState()),
    startRecording: (captureMode?: RecordingCaptureMode) => recordingService.start(captureMode),
    pauseRecording: () => recordingService.pause(),
    resumeRecording: () => recordingService.resume(),
    stopRecording: () => recordingService.stop()
  };
}

export function useWorkspacePersistence(
  session: Signal<DocumentSession | null>,
  persistence: DocumentWorkspacePersistenceService
) {
  const destroyRef = inject(DestroyRef);
  const saveState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastSavedAt = signal<string | null>(null);
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let saveStateTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSignature: string | null = null;

  const flushSave = async (current: DocumentSession | null) => {
    if (!current) {
      return;
    }

    const signature = buildPersistenceSignature(current);
    if (signature === lastSignature) {
      return;
    }

    saveState.set('saving');
    try {
      await persistence.persistSession(current);
      lastSignature = signature;
      saveState.set('saved');
      lastSavedAt.set(new Date().toISOString());
      if (saveStateTimer) {
        clearTimeout(saveStateTimer);
      }
      saveStateTimer = setTimeout(() => {
        saveState.set('idle');
      }, 1800);
    } catch (error) {
      console.error('Failed to persist workspace session', error);
      saveState.set('error');
    }
  };

  effect(() => {
    const current = session();
    if (!current) {
      return;
    }

    if (saveTimer) {
      clearTimeout(saveTimer);
    }

    saveTimer = setTimeout(() => {
      void flushSave(current);
    }, 320);
  });

  destroyRef.onDestroy(() => {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    if (saveStateTimer) {
      clearTimeout(saveStateTimer);
    }
  });

  return {
    saveState,
    lastSavedAt,
    saveNow: async () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      await flushSave(session());
    },
    restore: () => persistence.loadWorkspace()
  };
}

function buildPersistenceSignature(session: DocumentSession): string {
  return JSON.stringify({
    ...session,
    updatedAt: undefined,
    recording: {
      ...session.recording,
      blobUrl: undefined,
      updatedAt: undefined,
      elapsedMs:
        session.recording.status === 'recording' || session.recording.status === 'paused'
          ? Math.floor(session.recording.elapsedMs / 10000) * 10000
          : session.recording.elapsedMs
    }
  });
}

export function useAISelectionActions(
  workspace: WorkspaceStateApi,
  aiService: DocumentWorkspaceAIService
) {
  const isBusy = signal<'idle' | 'explain' | 'ask' | 'simplify'>('idle');
  const error = signal<string | null>(null);
  const responses = computed(() => workspace.session()?.aiResponses ?? []);
  const threads = computed(() => workspace.session()?.aiThreads ?? []);
  const activeThread = computed(() => {
    const session = workspace.session();
    if (!session?.activeAIThreadId) {
      return null;
    }
    return session.aiThreads.find((thread) => thread.id === session.activeAIThreadId) ?? null;
  });

  const writeResponse = (item: AIResponseItem) => {
    workspace.updateSession((current) => ({
      ...current,
      aiResponses: [item, ...current.aiResponses].slice(0, 20),
      panelVisibility: {
        ...current.panelVisibility,
        ai: true
      },
      activeRightPanel: 'ai'
    }));
  };

  const openThreadForSelection = (selection: SelectedTextContext) => {
    let resolvedThreadId = '';
    workspace.updateSession((current) => {
      const existing = current.aiThreads.find((thread) => thread.selectionKey === selection.selectionKey);
      if (existing) {
        resolvedThreadId = existing.id;
        return {
          ...current,
          activeAIThreadId: existing.id,
          panelVisibility: {
            ...current.panelVisibility,
            ai: true
          },
          activeRightPanel: 'ai'
        };
      }

      const thread = createSelectionThread(selection);
      resolvedThreadId = thread.id;
      return {
        ...current,
        aiThreads: [thread, ...current.aiThreads].slice(0, 12),
        activeAIThreadId: thread.id,
        panelVisibility: {
          ...current.panelVisibility,
          ai: true
        },
        activeRightPanel: 'ai'
      };
    });
    return resolvedThreadId;
  };

  const openGeneralThread = () => {
    let resolvedThreadId = '';
    workspace.updateSession((current) => {
      const existing = current.aiThreads.find((thread) => thread.scope === 'general');
      if (existing) {
        resolvedThreadId = existing.id;
        return {
          ...current,
          activeAIThreadId: existing.id,
          panelVisibility: {
            ...current.panelVisibility,
            ai: true
          },
          activeRightPanel: 'ai'
        };
      }

      const thread = createGeneralThread();
      resolvedThreadId = thread.id;
      return {
        ...current,
        aiThreads: [thread, ...current.aiThreads].slice(0, 12),
        activeAIThreadId: thread.id,
        panelVisibility: {
          ...current.panelVisibility,
          ai: true
        },
        activeRightPanel: 'ai'
      };
    });
    return resolvedThreadId;
  };

  const appendMessages = (threadId: string, messages: AIThreadMessage[]) => {
    workspace.updateSession((current) => ({
      ...current,
      aiThreads: current.aiThreads.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              messages: [...thread.messages, ...messages],
              updatedAt: new Date().toISOString()
            }
          : thread
      ),
      activeAIThreadId: threadId,
      panelVisibility: {
        ...current.panelVisibility,
        ai: true
      },
      activeRightPanel: 'ai'
    }));
  };

  const replacePendingAssistantMessage = (
    threadId: string,
    pendingId: string,
    nextMessage: AIThreadMessage
  ) => {
    workspace.updateSession((current) => ({
      ...current,
      aiThreads: current.aiThreads.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              messages: thread.messages.map((message) => (message.id === pendingId ? nextMessage : message)),
              updatedAt: new Date().toISOString()
            }
          : thread
      )
    }));
  };

  const run = async (
    mode: 'explain' | 'ask' | 'simplify',
    task: Promise<AIResponseItem>
  ): Promise<AIResponseItem | null> => {
    isBusy.set(mode);
    error.set(null);
    try {
      const response = await task;
      writeResponse(response);
      return response;
    } catch (reason) {
      console.error(`Document workspace ${mode} failed`, reason);
      error.set(`Unable to ${mode} the selected text right now.`);
      return null;
    } finally {
      isBusy.set('idle');
    }
  };

  return {
    responses,
    threads,
    activeThread,
    isBusy,
    error,
    openGeneralThread,
    openThreadForSelection,
    explainSelection: (selection: SelectedTextContext) =>
      run('explain', aiService.explainSelectedText(selection)),
    simplifySelection: (selection: SelectedTextContext) =>
      run('simplify', aiService.simplifySelectedText(selection)),
    askSelection: async (selection: SelectedTextContext, question: string) => {
      const threadId = openThreadForSelection(selection);
      const userMessage = createThreadMessage('user', question);
      const pendingAssistantMessage = createThreadMessage('assistant', 'Thinking about this selection...', 'pending');
      appendMessages(threadId, [userMessage, pendingAssistantMessage]);

      isBusy.set('ask');
      error.set(null);
      try {
        const answer = await aiService.askAboutSelection(selection, question);
        replacePendingAssistantMessage(
          threadId,
          pendingAssistantMessage.id,
          createThreadMessage('assistant', answer, 'complete')
        );
      } catch (reason) {
        console.error('Document workspace ask failed', reason);
        error.set('Unable to continue this selection conversation right now.');
        replacePendingAssistantMessage(
          threadId,
          pendingAssistantMessage.id,
          createThreadMessage('assistant', 'The assistant could not answer this selection right now.', 'error')
        );
      } finally {
        isBusy.set('idle');
      }
    },
    askGeneral: async (
      question: string,
      context: {
        fileName?: string;
        currentPage?: number;
        pageSummary?: string;
        pageText?: string;
      } = {}
    ) => {
      const threadId = openGeneralThread();
      const userMessage = createThreadMessage('user', question);
      const pendingAssistantMessage = createThreadMessage('assistant', 'Thinking about your document question...', 'pending');
      appendMessages(threadId, [userMessage, pendingAssistantMessage]);

      isBusy.set('ask');
      error.set(null);
      try {
        const answer = await aiService.askGeneralWorkspaceQuestion(question, context);
        replacePendingAssistantMessage(
          threadId,
          pendingAssistantMessage.id,
          createThreadMessage('assistant', answer, 'complete')
        );
      } catch (reason) {
        console.error('Document workspace general ask failed', reason);
        error.set('Unable to continue this document conversation right now.');
        replacePendingAssistantMessage(
          threadId,
          pendingAssistantMessage.id,
          createThreadMessage('assistant', 'The assistant could not answer this document question right now.', 'error')
        );
      } finally {
        isBusy.set('idle');
      }
    },
    clearResponses: () =>
      workspace.patchSession({
        aiResponses: [],
        aiThreads: [],
        activeAIThreadId: null
      })
  };
}
