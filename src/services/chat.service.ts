import { Injectable, signal, effect, inject } from '@angular/core';
import { LocalizationService } from './localization.service';
import { GroundingMetadata } from './grounding.models';
import { SUPPORTED_LANGUAGES } from '../i18n/language-config';

export type ConversationMode = 'text';

export interface Message {
  role: 'user' | 'model';
  text: string;
  files?: { data: string, mimeType: string, name: string }[];
  createdAt?: number;
  grounding?: GroundingMetadata | null;
}

export interface ConversationContext {
  specialization: string;
  subject: string;
  lesson: string;
  helpType: string;
}

export interface TutorTeachingUnit {
  id: string;
  label: string;
  kind: 'slide' | 'page' | 'section' | 'chunk' | 'visual';
  sourceName: string;
  order: number;
  text: string;
  title?: string;
  category?: 'content' | 'title' | 'reference' | 'ending' | 'low-value' | 'image-heavy';
  isMeaningful?: boolean;
  actualSlideNumber?: number;
}

export interface TutorFileTeachingState {
  active: boolean;
  documentId?: string;
  documentName?: string;
  chapterId?: string;
  sourceNames: string[];
  units: TutorTeachingUnit[];
  meaningfulUnitIds?: string[];
  coveredUnitIds?: string[];
  currentUnitIndex: number;
  currentUnitLabel: string;
  mode: 'slide' | 'page' | 'section' | 'chunk' | 'visual';
  totalSlides?: number;
  currentSlideNumber?: number;
  totalUnitCount?: number;
  extractionState?: 'queued' | 'reading' | 'ready' | 'limited';
  nextActionHint?: string;
  chapterCompleted?: boolean;
}

export interface TutorSessionState {
  topic: string;
  explainedSubtopics: string[];
  currentDepth: number; // 0:overview, 1:core, 2:deep, 3:application, 4:summary
  lastIntent: string;
  mcqHistory: Array<{question: string, correct: string, explanation: string}>;
  currentSubtopic?: string;
  studentStage?: 'foundation' | 'guided' | 'applied' | 'advanced' | 'review';
  studentProfileEstimate?: 'beginner' | 'intermediate' | 'advanced';
  nextSuggestedStep?: string;
  recentFocus?: string[];
  lastTutorResponseSummary?: string;
  fileTeaching?: TutorFileTeachingState | null;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  mode?: ConversationMode;
  context?: ConversationContext;
  tutorState?: TutorSessionState;
}

export interface PendingTutorLaunch {
  title: string;
  context: ConversationContext;
  userVisibleText: string;
  requestText: string;
  files?: Array<{
    id: string;
    data: string;
    mimeType: string;
    name: string;
    status?: 'reading' | 'starting' | 'ready' | 'limited' | 'error';
    totalUnits?: number;
    currentPreparedUnits?: number;
    extractedText?: string;
    teachingUnits?: TutorTeachingUnit[];
    teachingMode?: TutorTeachingUnit['kind'];
  }>;
}

type StoredConversation = Omit<Conversation, 'mode'> & {
  mode?: string;
};

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly localization = inject(LocalizationService);
  private STORAGE_KEY = 'smartedge_chats_v1';
  private readonly DEFAULT_TITLES = new Set(
    SUPPORTED_LANGUAGES.map((language) => this.localization.phrase('New Chat', language.code))
  );
  private readonly FALLBACK_TITLE = this.localization.phrase('New Chat');
  
  conversations = signal<Conversation[]>([]);
  activeChatId = signal<string | null>(null);
  pendingTutorLaunch = signal<PendingTutorLaunch | null>(null);

  constructor() {
    this.loadFromStorage();
    
    // Auto-save effect whenever conversations change
    effect(() => {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.conversations()));
    });
  }

  private loadFromStorage() {
    localStorage.removeItem('smartedge_voice_tutor_sessions_v1');

    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const parsed = (JSON.parse(saved) as StoredConversation[])
          .filter((conversation) => conversation.mode !== 'voice' && conversation.mode !== 'voice_tutor')
          .map((conversation) => {
            const messages = Array.isArray(conversation.messages)
              ? conversation.messages.map(message => ({
                ...message,
                createdAt: typeof message.createdAt === 'number' ? message.createdAt : conversation.createdAt
              }))
              : [];

            return {
              ...conversation,
              title: this.shouldRefreshAutoTitle(conversation.title, messages)
                ? this.buildAutoTitle(messages)
                : conversation.title,
              mode: 'text' as ConversationMode,
              messages
            };
          });
        this.conversations.set(parsed);
        if (parsed.length > 0) {
          this.activeChatId.set(parsed[0].id);
        }
      } catch (e) {
        console.error('Failed to load chats', e);
      }
    }
  }

  createNewChat(initialTitle: string = this.localization.phrase('New Chat'), context?: ConversationContext, mode: ConversationMode = 'text') {
    const newChat: Conversation = {
      id: Date.now().toString(),
      title: initialTitle,
      messages: [],
      createdAt: Date.now(),
      mode,
      context: context
    };
    this.conversations.update(list => [newChat, ...list]);
    this.activeChatId.set(newChat.id);
    return newChat;
  }

  updateActiveChatMessages(messages: Message[]) {
    const activeId = this.activeChatId();
    if (!activeId) return;

    this.updateChatMessages(activeId, messages);
  }

  updateChatMessages(chatId: string, messages: Message[]) {
    this.conversations.update(list => list.map(c => {
      if (c.id === chatId) {
        // Update title based on first message if it's still default
        let newTitle = c.title;
        if (this.shouldRefreshAutoTitle(c.title, c.messages) && messages.length > 0) {
          newTitle = this.buildAutoTitle(messages);
        }
        return { ...c, messages, title: newTitle };
      }
      return c;
    }));
  }

  private buildAutoTitle(messages: Message[]): string {
    const sourceText = messages
      .find((message) => message.role === 'user' && message.text.trim())
      ?.text.trim() || messages[0]?.text.trim() || '';

    if (!sourceText) {
      return this.FALLBACK_TITLE;
    }

    const normalized = sourceText.replace(/\s+/g, ' ').trim();
    const words = normalized.split(' ').filter(Boolean);

    if (words.length <= 8 && normalized.length <= 72) {
      return normalized;
    }

    const byWords = words.slice(0, 8).join(' ');
    const byChars = normalized.slice(0, 72).trimEnd();
    const baseTitle = byWords.length >= byChars.length ? byWords : byChars;

    return baseTitle === normalized ? baseTitle : `${baseTitle}...`;
  }

  private shouldRefreshAutoTitle(title: string, messages: Message[]): boolean {
    if (this.DEFAULT_TITLES.has(title)) {
      return true;
    }

    return title === this.buildLegacyAutoTitle(messages);
  }

  private buildLegacyAutoTitle(messages: Message[]): string {
    const legacySource = messages[0]?.text ?? '';
    return legacySource ? `${legacySource.substring(0, 30)}...` : '';
  }

  renameChat(chatId: string, title: string) {
    const nextTitle = title.trim();
    if (!nextTitle) return;

    this.conversations.update(list => list.map(conversation =>
      conversation.id === chatId
        ? { ...conversation, title: nextTitle }
        : conversation
    ));
  }

  deleteChat(id: string) {
    this.conversations.update(list => list.filter(c => c.id !== id));
    if (this.activeChatId() === id) {
      const remaining = this.conversations();
      this.activeChatId.set(remaining.length > 0 ? remaining[0].id : null);
    }
  }

  clearAllConversations() {
    this.conversations.set([]);
    this.activeChatId.set(null);
    localStorage.removeItem(this.STORAGE_KEY);
  }

getActiveChat() {
    return this.conversations().find(c => c.id === this.activeChatId());
  }

  public getTutorState(chatId: string): TutorSessionState | null {
    const chat = this.conversations().find(c => c.id === chatId);
    return chat?.tutorState || null;
  }

  public updateTutorState(chatId: string, tutorState: TutorSessionState) {
    this.conversations.update(list =>
      list.map(c => {
        if (c.id === chatId) {
          return { ...c, tutorState };
        }
        return c;
      })
    );
  }

  queueTutorLaunch(launch: PendingTutorLaunch) {
    this.pendingTutorLaunch.set(launch);
  }

  consumePendingTutorLaunch() {
    const pending = this.pendingTutorLaunch();
    this.pendingTutorLaunch.set(null);
    return pending;
  }
}


