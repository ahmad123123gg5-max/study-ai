import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslationBlock, TranslationPageEntry } from '../document-workspace.types';
import { EmptyStateComponent } from './empty-state.component';

@Component({
  selector: 'app-translation-panel',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent],
  template: `
    <section class="flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white shadow-[0_32px_90px_-40px_rgba(15,23,42,0.35)]" aria-label="Translation workspace panel">
      <header class="space-y-2 border-b border-slate-200 px-5 py-4">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Translation Workspace</p>
          <h3 class="mt-1 text-lg font-semibold text-slate-900">Linked translations</h3>
          <p class="mt-2 text-sm leading-6 text-slate-500">
            Original blocks stay visible first, and translated lines stay attached directly beneath them.
          </p>
          @if (selectedTranslation() || pageEntry()) {
            <div class="mt-3 flex flex-wrap gap-2">
              <span class="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
                From {{ sourceLanguageLabel() }}
              </span>
              <span class="rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-medium text-indigo-700">
                To {{ targetLanguageLabel() }}
              </span>
            </div>
          }
        </div>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        @if (selectedTranslation()) {
          <article class="mb-4 rounded-[1.75rem] border border-indigo-200 bg-indigo-50 p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-500">Selected text translation</p>
                <p class="mt-1 text-xs text-indigo-700">Target: {{ selectedTranslation()!.targetLanguage === 'ar' ? 'Arabic' : 'English' }}</p>
              </div>
              <div class="flex gap-2">
                <button
                  (click)="copySelection.emit(selectedTranslation()!)"
                  type="button"
                  class="rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 focus-visible:ring-offset-2"
                >
                  Copy
                </button>
                <button
                  (click)="saveSelectionAsNote.emit(selectedTranslation()!)"
                  type="button"
                  class="rounded-full bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 focus-visible:ring-offset-2"
                >
                  Add to notes
                </button>
              </div>
            </div>
            <p class="mt-3 rounded-2xl bg-white px-3 py-2 text-sm text-slate-600">{{ selectedTranslation()?.sourceText }}</p>
            <p class="mt-3 text-sm leading-6 text-slate-900">{{ selectedTranslation()?.translatedText }}</p>
          </article>
        }

        @if (loading() || pageEntry()?.status === 'loading') {
          <div class="rounded-[1.6rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Translating the current page and preparing aligned text blocks for the active view.
          </div>
        } @else if (pageEntry()?.status === 'error') {
          <div class="rounded-[1.6rem] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {{ pageEntry()?.errorMessage || 'Translation is temporarily unavailable for this page.' }}
          </div>
        } @else if (pageEntry()?.status === 'unavailable') {
          <div class="rounded-[1.6rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            This page has no extracted text blocks available for translation yet.
          </div>
        }

        @if (pageEntry()?.blocks?.length) {
          <div class="mb-3 flex items-center justify-between">
            <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Cached page translation
            </p>
            <div class="flex items-center gap-2">
              <span class="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
                Ready
              </span>
              <span class="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">
                {{ pageEntry()!.targetLanguage === 'ar' ? 'Arabic' : 'English' }}
              </span>
            </div>
          </div>
          <div class="space-y-3">
            @for (item of pageEntry()!.blocks; track item.id) {
              <article class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Original</p>
                <p class="mt-2 text-sm font-medium text-slate-600">{{ item.sourceText }}</p>
                <div class="my-3 h-px bg-slate-200"></div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-600">
                  {{ item.targetLanguage === 'ar' ? 'Arabic translation' : 'English translation' }}
                </p>
                <p class="mt-2 text-sm leading-6 text-slate-900">{{ item.translatedText }}</p>
              </article>
            }
          </div>
        } @else if (!selectedTranslation() && !loading()) {
          <app-document-empty-state
            icon="fa-solid fa-language"
            eyebrow="Inline and side-by-side ready"
            title="No translation yet"
            description="Translate the selected text or the current page. The viewer can render the translated blocks inline or side-by-side."
          />
        }
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TranslationPanelComponent {
  selectedTranslation = input<TranslationBlock | null>(null);
  pageEntry = input<TranslationPageEntry | null>(null);
  loading = input(false);

  copySelection = output<TranslationBlock>();
  saveSelectionAsNote = output<TranslationBlock>();

  protected sourceLanguageLabel(): string {
    const language = this.selectedTranslation()?.sourceLanguage || this.pageEntry()?.sourceLanguage;
    return language === 'ar' ? 'Arabic' : 'English';
  }

  protected targetLanguageLabel(): string {
    const language = this.selectedTranslation()?.targetLanguage || this.pageEntry()?.targetLanguage;
    return language === 'ar' ? 'Arabic' : 'English';
  }
}
