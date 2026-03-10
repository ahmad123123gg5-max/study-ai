import type { PageViewport, PDFDocumentProxy } from 'pdfjs-dist';
import type { TextContent } from 'pdfjs-dist/types/src/display/api';

export type WorkspaceViewMode = 'reading' | 'annotation' | 'translation' | 'focus';
export type TranslationViewMode = 'original' | 'side-by-side' | 'inline';
export type DocumentFitMode = 'manual' | 'width' | 'page';
export type WorkspaceSourceType = 'sample' | 'pdf' | 'ppt';
export type RightPanelKey = 'ai' | 'translation' | 'notes' | null;
export type TargetLanguage = 'ar' | 'en';
export type WorkspaceLanguage = 'auto' | 'ar' | 'en';
export type DocumentTextDirection = 'rtl' | 'ltr';
export type RecordingPermissionState = 'unknown' | 'granted' | 'denied' | 'unsupported';
export type RecordingCaptureMode = 'microphone' | 'screen';
export type WorkspaceToolKey =
  | 'reader'
  | 'draw'
  | 'highlight'
  | 'shapes'
  | 'arrow'
  | 'text-note'
  | 'sticky-note'
  | 'eraser'
  | 'ai'
  | 'translate'
  | 'notes'
  | 'focus'
  | 'recorder';
export type AnnotationTool =
  | 'select'
  | 'highlight'
  | 'underline'
  | 'free-draw'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'text-note'
  | 'sticky-note'
  | 'eraser';

export interface ViewerSelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DocumentTextBlock {
  id: string;
  text: string;
  language: Exclude<WorkspaceLanguage, 'auto'>;
  direction: DocumentTextDirection;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  lineIndex: number;
  readingOrder: number;
}

export interface DocumentPageData {
  pageNumber: number;
  width: number;
  height: number;
  summary: string;
  text: string;
  blocks: DocumentTextBlock[];
  viewport?: PageViewport;
  textContent?: TextContent;
}

export interface SelectedTextContext {
  id: string;
  selectionKey: string;
  pageNumber: number;
  text: string;
  pageText: string;
  summary: string;
  surroundingText: string;
  contextBefore: string;
  contextAfter: string;
  rect: ViewerSelectionRect;
  fragments: ViewerSelectionRect[];
  blockIds: string[];
  anchorBlockId?: string;
  createdAt: string;
}

export interface AIResponseItem {
  id: string;
  kind: 'explain' | 'simplify';
  title: string;
  prompt: string;
  response: string;
  pageNumber: number;
  selectionText: string;
  source: 'selected-text';
  createdAt: string;
  voiceSupported: boolean;
}

export interface AIThreadMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  status: 'pending' | 'complete' | 'error';
}

export interface AISelectionThread {
  id: string;
  scope: 'selection' | 'general';
  selectionKey: string;
  selection: SelectedTextContext | null;
  title: string;
  messages: AIThreadMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface VoicePlaybackState {
  status: 'idle' | 'loading' | 'playing' | 'error';
  itemId: string | null;
  errorMessage?: string;
}

export interface TranslationBlock {
  id: string;
  sourceText: string;
  translatedText: string;
  pageNumber: number;
  sourceLanguage: Exclude<WorkspaceLanguage, 'auto'>;
  targetLanguage: TargetLanguage;
  blockId?: string;
  orderIndex: number;
  bounds?: ViewerSelectionRect;
  mode: 'selection' | 'page' | 'inline';
  createdAt: string;
}

export interface TranslationPageEntry {
  pageNumber: number;
  sourceLanguage: Exclude<WorkspaceLanguage, 'auto'>;
  targetLanguage: TargetLanguage;
  status: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
  blocks: TranslationBlock[];
  createdAt?: string;
  errorMessage?: string;
}

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface AnnotationItem {
  id: string;
  type:
    | 'highlight'
    | 'underline'
    | 'free-draw'
    | 'rectangle'
    | 'circle'
    | 'arrow'
    | 'text-note'
    | 'sticky-note';
  pageNumber: number;
  color: string;
  text?: string;
  fragments?: ViewerSelectionRect[];
  bounds?: ViewerSelectionRect;
  points?: AnnotationPoint[];
  startPoint?: AnnotationPoint;
  endPoint?: AnnotationPoint;
  noteIcon?: string;
  noteOpen?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudyNote {
  id: string;
  type: 'anchored' | 'general';
  title: string;
  content: string;
  pageNumber?: number;
  anchorText?: string;
  anchorRect?: ViewerSelectionRect;
  createdAt: string;
  updatedAt: string;
}

export interface RecordingSessionState {
  sessionId: string;
  documentId?: string;
  workspaceSessionId?: string;
  captureMode: RecordingCaptureMode;
  status: 'idle' | 'recording' | 'paused' | 'stopped';
  permission: RecordingPermissionState;
  startedAt?: string;
  pausedAt?: string;
  stoppedAt?: string;
  elapsedMs: number;
  mimeType?: string;
  chunks?: number;
  blobUrl?: string;
  fileName?: string;
  lastError?: string;
  restoredFromInterruptedSession?: boolean;
  updatedAt: string;
}

export interface PanelVisibilityState {
  thumbnails: boolean;
  ai: boolean;
  translation: boolean;
  notes: boolean;
}

export interface DocumentSession {
  id: string;
  fileId: string;
  fileName: string;
  sourceType: WorkspaceSourceType;
  currentPage: number;
  totalPages: number;
  zoom: number;
  fitMode: DocumentFitMode;
  viewMode: WorkspaceViewMode;
  translationViewMode: TranslationViewMode;
  panelVisibility: PanelVisibilityState;
  focusMode: boolean;
  activeRightPanel: RightPanelKey;
  annotations: AnnotationItem[];
  notes: StudyNote[];
  aiResponses: AIResponseItem[];
  aiThreads: AISelectionThread[];
  activeAIThreadId: string | null;
  selectedTextTranslation: TranslationBlock | null;
  pageTranslations: Record<number, TranslationPageEntry>;
  recording: RecordingSessionState;
  translationSourceLanguage: WorkspaceLanguage;
  translationTargetLanguage: TargetLanguage;
  selectableTextAvailable: boolean;
  updatedAt: string;
}

export interface LoadedDocumentResource {
  fileId: string;
  fileName: string;
  sourceType: WorkspaceSourceType;
  file: File;
  objectUrl?: string;
  pdfDocument: PDFDocumentProxy;
  pages: DocumentPageData[];
  totalPages: number;
}

export interface SavedWorkspacePayload {
  session: DocumentSession | null;
  file: File | null;
}
