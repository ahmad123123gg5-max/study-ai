import { Injectable } from '@angular/core';
import {
  DocumentSession,
  RecordingSessionState,
  SavedWorkspacePayload,
  TranslationPageEntry
} from '../document-workspace.types';

const DB_NAME = 'smartedge-document-workspace';
const DB_VERSION = 1;
const FILE_STORE = 'workspace-files';
const SESSION_KEY = 'smartedge_document_workspace_session_v2';

interface PersistedWorkspaceEnvelope {
  version: 2;
  savedAt: string;
  session: DocumentSession;
}

@Injectable({ providedIn: 'root' })
export class DocumentWorkspacePersistenceService {
  async persistSession(session: DocumentSession): Promise<void> {
    const envelope: PersistedWorkspaceEnvelope = {
      version: 2,
      savedAt: new Date().toISOString(),
      session
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(envelope));
  }

  async persistFile(fileId: string, file: File): Promise<void> {
    const db = await this.openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(FILE_STORE, 'readwrite');
      const store = transaction.objectStore(FILE_STORE);
      store.put(file, fileId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async loadWorkspace(): Promise<SavedWorkspacePayload> {
    const raw = localStorage.getItem(SESSION_KEY) || localStorage.getItem('smartedge_document_workspace_session_v1');
    if (!raw) {
      return { session: null, file: null };
    }

    try {
      const parsed = JSON.parse(raw) as PersistedWorkspaceEnvelope | DocumentSession;
      const session = this.normalizeSession('session' in parsed ? parsed.session : parsed);
      const file = await this.loadFile(session.fileId);
      return { session, file };
    } catch (error) {
      console.warn('Corrupt document workspace session was cleared.', error);
      await this.clearWorkspaceStorageOnly();
      return { session: null, file: null };
    }
  }

  async loadFile(fileId: string): Promise<File | null> {
    try {
      const db = await this.openDatabase();
      return new Promise<File | null>((resolve, reject) => {
        const transaction = db.transaction(FILE_STORE, 'readonly');
        const store = transaction.objectStore(FILE_STORE);
        const request = store.get(fileId);
        request.onsuccess = () => resolve((request.result as File) ?? null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('Workspace file could not be restored from IndexedDB.', error);
      return null;
    }
  }

  async clearWorkspace(): Promise<void> {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PersistedWorkspaceEnvelope;
        if (parsed?.session?.fileId) {
          await this.deleteFile(parsed.session.fileId);
        }
      } catch (error) {
        console.warn('Workspace file cleanup skipped because saved session data was invalid.', error);
      }
    }
    await this.clearWorkspaceStorageOnly();
  }

  private normalizeSession(input: Partial<DocumentSession>): DocumentSession {
    const translationEntries = Object.entries(input.pageTranslations || {}).reduce<Record<number, TranslationPageEntry>>(
      (result, [key, value]) => {
        const pageNumber = Number(key);
        if (!Number.isFinite(pageNumber)) {
          return result;
        }
        const entry = value as Partial<TranslationPageEntry>;
        result[pageNumber] = {
          pageNumber,
          sourceLanguage: entry.sourceLanguage || 'en',
          targetLanguage: entry.targetLanguage || 'ar',
          status: entry.status || (entry.blocks?.length ? 'ready' : 'idle'),
          blocks: Array.isArray(entry.blocks) ? entry.blocks.filter((block) => block?.id && block?.sourceText) : [],
          createdAt: entry.createdAt,
          errorMessage: entry.errorMessage
        };
        return result;
      },
      {}
    );

    return {
      id: input.id || crypto.randomUUID(),
      fileId: input.fileId || crypto.randomUUID(),
      fileName: input.fileName || 'Recovered document',
      sourceType: input.sourceType || 'pdf',
      currentPage: Math.max(1, Number(input.currentPage || 1)),
      totalPages: Math.max(0, Number(input.totalPages || 0)),
      zoom: Number(input.zoom || 1),
      fitMode: input.fitMode || 'width',
      viewMode: input.viewMode || 'reading',
      translationViewMode: input.translationViewMode || 'original',
      panelVisibility: {
        thumbnails: input.panelVisibility?.thumbnails ?? true,
        ai: input.panelVisibility?.ai ?? false,
        translation: input.panelVisibility?.translation ?? false,
        notes: input.panelVisibility?.notes ?? false
      },
      focusMode: Boolean(input.focusMode),
      activeRightPanel:
        input.activeRightPanel === 'ai' || input.activeRightPanel === 'translation' || input.activeRightPanel === 'notes'
          ? input.activeRightPanel
          : null,
      annotations: Array.isArray(input.annotations) ? input.annotations.filter((item) => item?.id && item?.pageNumber) : [],
      notes: Array.isArray(input.notes) ? input.notes.filter((item) => item?.id && item?.title !== undefined) : [],
      aiResponses: (Array.isArray(input.aiResponses) ? input.aiResponses : []).map((item) => ({
        ...item,
        source: 'selected-text',
        voiceSupported: item.voiceSupported ?? item.kind === 'explain'
      })),
      aiThreads: Array.isArray(input.aiThreads)
        ? input.aiThreads
            .filter((item) => item?.id && (item?.scope === 'general' || item?.selection))
            .map((item) => ({
              ...item,
              scope: item.scope === 'general' ? 'general' : 'selection',
              selection: item.scope === 'general' ? null : item.selection,
              title:
                item.title ||
                (item.scope === 'general'
                  ? 'General document assistant'
                  : item.selection?.text?.slice(0, 72) || 'Selected text')
            }))
        : [],
      activeAIThreadId: typeof input.activeAIThreadId === 'string' ? input.activeAIThreadId : null,
      selectedTextTranslation: input.selectedTextTranslation || null,
      pageTranslations: translationEntries,
      recording: this.normalizeRecordingState(input.recording),
      translationSourceLanguage: input.translationSourceLanguage || 'auto',
      translationTargetLanguage: input.translationTargetLanguage || 'ar',
      selectableTextAvailable: input.selectableTextAvailable ?? true,
      updatedAt: input.updatedAt || new Date().toISOString()
    };
  }

  private normalizeRecordingState(
    input?: Partial<RecordingSessionState>
  ): RecordingSessionState {
    return {
      sessionId: input?.sessionId || crypto.randomUUID(),
      documentId: input?.documentId,
      workspaceSessionId: input?.workspaceSessionId,
      captureMode: input?.captureMode || 'microphone',
      status: input?.status || 'idle',
      permission: input?.permission || 'unknown',
      startedAt: input?.startedAt,
      pausedAt: input?.pausedAt,
      stoppedAt: input?.stoppedAt,
      elapsedMs: Number(input?.elapsedMs || 0),
      mimeType: input?.mimeType,
      chunks: Number(input?.chunks || 0),
      blobUrl: undefined,
      fileName: input?.fileName,
      lastError: input?.lastError,
      restoredFromInterruptedSession: input?.restoredFromInterruptedSession,
      updatedAt: input?.updatedAt || new Date().toISOString()
    };
  }

  private async deleteFile(fileId: string): Promise<void> {
    const db = await this.openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(FILE_STORE, 'readwrite');
      const store = transaction.objectStore(FILE_STORE);
      store.delete(fileId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  private async openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(FILE_STORE)) {
          database.createObjectStore(FILE_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async clearWorkspaceStorageOnly(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('smartedge_document_workspace_session_v1');
  }
}
