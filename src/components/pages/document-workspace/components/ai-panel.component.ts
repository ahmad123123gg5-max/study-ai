import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AIResponseItem,
  AISelectionThread,
  SelectedTextContext,
  VoicePlaybackState
} from '../document-workspace.types';
import { EmptyStateComponent } from './empty-state.component';

@Component({
  selector: 'app-ai-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent],
  template: `
    <section class="flex h-full min-h-[30rem] flex-col bg-transparent text-white" aria-label="Document AI panel">
      <header class="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-indigo-300/80">Chat</p>
          <h3 class="mt-1 text-lg font-semibold text-white">Study copilot</h3>
        </div>
        <button
          (click)="clear.emit()"
          type="button"
          aria-label="Clear AI results"
          class="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-indigo-400/35 hover:bg-indigo-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/15 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          Clear
        </button>
      </header>

      @if (selectionContext()) {
        <div class="border-b border-white/10 px-5 py-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            {{ activeThread()?.scope === 'selection' ? 'Selection thread' : 'Selected text' }}
          </p>
          <div class="mt-2 rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-semibold text-white">Page {{ selectionContext()?.pageNumber }}</p>
              <span class="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] font-medium text-slate-400">
                Selected text only
              </span>
            </div>
            <p class="mt-3 text-sm leading-6 text-slate-200">
              "{{ selectionContext()?.text }}"
            </p>
            @if (selectionContext()?.surroundingText) {
              <p class="mt-3 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs leading-5 text-slate-400">
                {{ selectionContext()?.surroundingText }}
              </p>
            }
          </div>
        </div>
      } @else {
        <div class="border-b border-white/10 px-5 py-4">
          <div class="rounded-[1.2rem] border border-white/10 bg-white/5 p-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">General chat</p>
                <p class="mt-1 text-sm font-semibold text-white">{{ activeThread()?.title || 'Ask anything about this document' }}</p>
              </div>
              <span class="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] font-medium text-slate-400">
                Full workspace
              </span>
            </div>
            <p class="mt-3 text-sm leading-6 text-slate-300">
              Ask for explanation, summary, quiz help, translation guidance, or anything related to the current document.
            </p>
          </div>
        </div>
      }

      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
        @if (activeThread()) {
          <section class="space-y-3">
            <div class="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              <span class="h-2 w-2 rounded-full bg-slate-900"></span>
              {{ activeThread()?.scope === 'selection' ? 'Contextual selection thread' : 'Document conversation' }}
            </div>
            @for (message of activeThread()!.messages; track message.id) {
              <div
                class="rounded-[1.5rem] px-4 py-3"
                [class.ml-8]="message.role === 'assistant'"
                [class.mr-8]="message.role === 'user'"
                [class.bg-indigo-600]="message.role === 'user'"
                [class.text-white]="message.role === 'user'"
                [ngClass]="
                  message.status === 'error'
                    ? ['border-rose-400/30', message.role === 'assistant' ? 'bg-white/5' : '']
                    : message.role === 'assistant'
                      ? ['bg-white/5', 'border-white/10']
                      : []
                "
                [class.text-slate-100]="message.role === 'assistant'"
                [class.border]="message.role === 'assistant'"
              >
                <div class="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]"
                  [ngClass]="message.role === 'user' ? 'text-white/70' : ''"
                  [class.text-slate-400]="message.role === 'assistant' && message.status !== 'error'"
                  [class.text-rose-300]="message.status === 'error'"
                >
                  <span>{{ message.role === 'user' ? 'Student' : 'Assistant' }}</span>
                  @if (message.status === 'pending') {
                    <span class="flex items-center gap-2">
                      <span class="h-2 w-2 animate-pulse rounded-full bg-current"></span>
                      Thinking
                    </span>
                  }
                </div>
                <p class="whitespace-pre-wrap text-sm leading-6">{{ message.text }}</p>
              </div>
            } @empty {
              <div class="rounded-[1.6rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                {{ activeThread()?.scope === 'selection'
                  ? 'Ask a question about this selected text. Follow-up questions stay tied to the same passage.'
                  : 'Start a document conversation. You can ask anything from this workspace panel.' }}
              </div>
            }
          </section>
        }

        @if (loading()) {
          <div class="mt-4 rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
            <div class="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              <span class="h-2 w-2 animate-pulse rounded-full bg-slate-900"></span>
              {{ activeThread()?.scope === 'general' ? 'Working on document question' : 'Working on selection' }}
            </div>
            <p class="text-sm text-slate-300">
              {{ activeThread()?.scope === 'general'
                ? 'Generating a response for your current document question.'
                : 'Generating a focused response for the selected passage.' }}
            </p>
          </div>
        }

        @if (error()) {
          <div class="mt-4 rounded-[1.6rem] border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-200">
            {{ error() }}
          </div>
        }

        @if (responses().length > 0) {
          <section class="mt-5 space-y-4">
            <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              <span class="h-2 w-2 rounded-full bg-indigo-500"></span>
              Explain and simplify results
            </div>
            @for (item of responses(); track item.id) {
              <article
                class="rounded-[1.75rem] border p-4 shadow-sm"
                [ngClass]="item.kind === 'explain' ? ['border-indigo-400/20', 'bg-indigo-500/10'] : ['border-emerald-400/20', 'bg-emerald-500/10']"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p
                      class="text-[11px] font-semibold uppercase tracking-[0.24em]"
                      [class.text-indigo-300]="item.kind === 'explain'"
                      [class.text-emerald-300]="item.kind === 'simplify'"
                    >
                      {{ item.kind === 'explain' ? 'Explain' : 'Simplify' }}
                    </p>
                    <h4 class="mt-1 text-base font-semibold text-white">{{ item.title }}</h4>
                  </div>
                  <div class="flex items-center gap-2">
                    @if (item.voiceSupported) {
                      <button
                        (click)="playVoice.emit(item)"
                        type="button"
                        class="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 shadow-sm transition hover:border-indigo-400/35 hover:bg-indigo-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/15 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        [class.bg-indigo-600]="voiceState().itemId === item.id && voiceState().status === 'playing'"
                        [class.text-white]="voiceState().itemId === item.id && voiceState().status === 'playing'"
                        [title]="voiceButtonLabel(item.id)"
                        [attr.aria-label]="voiceButtonLabel(item.id)"
                      >
                        @if (voiceState().itemId === item.id && voiceState().status === 'loading') {
                          <i class="fa-solid fa-spinner animate-spin"></i>
                        } @else if (voiceState().itemId === item.id && voiceState().status === 'playing') {
                          <i class="fa-solid fa-wave-square"></i>
                        } @else {
                          <i class="fa-solid fa-volume-high"></i>
                        }
                      </button>
                    }
                    <button
                      (click)="copyResult.emit(item)"
                      type="button"
                      class="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 shadow-sm transition hover:border-indigo-400/35 hover:bg-indigo-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/15 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    >
                      Copy
                    </button>
                    <button
                      (click)="saveResultAsNote.emit(item)"
                      type="button"
                      class="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 shadow-sm transition hover:border-indigo-400/35 hover:bg-indigo-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/15 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    >
                      Add to notes
                    </button>
                  </div>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <span class="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] font-medium text-slate-400">Page {{ item.pageNumber }}</span>
                  <span class="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] font-medium text-slate-400">From selected text</span>
                </div>
                <p class="mt-3 rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-400">
                  "{{ item.selectionText }}"
                </p>
                <p class="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-100">{{ item.response }}</p>
              </article>
            }
          </section>
        }

        @if (!loading() && !responses().length && !activeThread() && !activeSelection()) {
          <app-document-empty-state
            icon="fa-solid fa-sparkles"
            eyebrow="Document and selection"
            title="No AI result yet"
            description="Ask anything from the right panel, or select a word, sentence, or short paragraph to get focused help."
          />
        }
      </div>

      <div class="border-t border-white/10 p-4">
        <div class="flex gap-2">
          <input
            [(ngModel)]="draftQuestion"
            [placeholder]="questionPlaceholder()"
            [attr.aria-label]="questionPlaceholder()"
            class="h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400/40 focus-visible:ring-2 focus-visible:ring-indigo-400/10"
          />
          <button
            (click)="submitQuestion()"
            type="button"
            [disabled]="!draftQuestion.trim() || loading()"
            class="rounded-2xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/15 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ask
          </button>
        </div>
        @if (voiceState().status === 'error') {
          <p class="mt-3 text-xs text-rose-300">{{ voiceState().errorMessage }}</p>
        }
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AIPanelComponent {
  responses = input<AIResponseItem[]>([]);
  loading = input(false);
  error = input<string | null>(null);
  activeSelection = input<SelectedTextContext | null>(null);
  activeThread = input<AISelectionThread | null>(null);
  voiceState = input<VoicePlaybackState>({
    status: 'idle',
    itemId: null
  });

  playVoice = output<AIResponseItem>();
  copyResult = output<AIResponseItem>();
  saveResultAsNote = output<AIResponseItem>();
  askFollowUp = output<string>();
  clear = output<void>();

  protected draftQuestion = '';
  protected readonly selectionContext = computed(() => this.activeThread()?.selection || this.activeSelection());

  protected submitQuestion() {
    const question = this.draftQuestion.trim();
    if (!question) {
      return;
    }
    this.askFollowUp.emit(question);
    this.draftQuestion = '';
  }

  protected voiceButtonLabel(itemId: string): string {
    if (this.voiceState().itemId !== itemId) {
      return 'Play voice explanation';
    }
    if (this.voiceState().status === 'loading') {
      return 'Preparing voice explanation';
    }
    if (this.voiceState().status === 'playing') {
      return 'Playing voice explanation';
    }
    return 'Play voice explanation';
  }

  protected questionPlaceholder(): string {
    return this.activeThread()?.scope === 'selection' || this.activeSelection()
      ? 'Ask something about this selected text'
      : 'Ask anything about this document';
  }
}
