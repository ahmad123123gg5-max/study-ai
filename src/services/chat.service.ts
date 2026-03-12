
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

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  mode?: ConversationMode;
  context?: ConversationContext;
}

export interface PendingTutorLaunch {
  title: string;
  context: ConversationContext;
  userVisibleText: string;
  requestText: string;
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
          .map((conversation) => ({
            ...conversation,
            mode: 'text' as ConversationMode,
            messages: Array.isArray(conversation.messages)
              ? conversation.messages.map(message => ({
                ...message,
                createdAt: typeof message.createdAt === 'number' ? message.createdAt : conversation.createdAt
              }))
              : []
          }));
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
        if (this.DEFAULT_TITLES.has(c.title) && messages.length > 0) {
          newTitle = messages[0].text.substring(0, 30) + '...';
        }
        return { ...c, messages, title: newTitle };
      }
      return c;
    }));
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

  queueTutorLaunch(launch: PendingTutorLaunch) {
    this.pendingTutorLaunch.set(launch);
  }

  consumePendingTutorLaunch() {
    const pending = this.pendingTutorLaunch();
    this.pendingTutorLaunch.set(null);
    return pending;
  }
}
