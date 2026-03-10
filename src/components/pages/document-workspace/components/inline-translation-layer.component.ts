import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentPageData, TranslationPageEntry, TranslationViewMode } from '../document-workspace.types';

@Component({
  selector: 'app-inline-translation-layer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_32px_90px_-40px_rgba(15,23,42,0.2)]">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Translation reading layer</p>
          <h4 class="mt-1 text-lg font-semibold text-slate-900">Page {{ page()?.pageNumber }}</h4>
          <p class="mt-2 text-sm text-slate-500">
            {{ mode() === 'inline'
              ? 'Original text stays first, and the translation appears directly beneath each line.'
              : 'Original and translated text stay aligned side by side for easier comparison.' }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <span class="rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
            {{ mode() === 'inline' ? 'Inline pairing' : 'Side by side' }}
          </span>
          <span class="rounded-full bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
            {{ languageLabel() }}
          </span>
        </div>
      </div>

      @if (entry()?.status === 'loading') {
        <div class="space-y-3">
          @for (skeleton of skeletonRows; track skeleton) {
            <div class="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4">
              <div class="h-4 w-3/4 animate-pulse rounded-full bg-slate-200"></div>
              <div class="mt-2 h-4 w-1/2 animate-pulse rounded-full bg-indigo-100"></div>
            </div>
          }
        </div>
      } @else if (entry()?.status === 'unavailable') {
        <div class="rounded-[1.4rem] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          This page has no extracted text blocks available for inline translation.
        </div>
      } @else if (mode() === 'inline') {
        <div class="space-y-4">
          @for (block of page()?.blocks || []; track block.id) {
            <article class="rounded-[1.35rem] border border-slate-200 bg-slate-50/80 px-4 py-4">
              <p
                class="text-base leading-7 text-slate-900"
                [attr.dir]="block.direction || directionFor(block.text)"
                [class.text-right]="(block.direction || directionFor(block.text)) === 'rtl'"
              >
                {{ block.text }}
              </p>
              <p
                class="mt-2 border-s border-indigo-200 ps-3 text-sm leading-6 text-indigo-700"
                [attr.dir]="translationDirection()"
                [class.text-right]="translationDirection() === 'rtl'"
              >
                {{ translationFor(block.id) }}
              </p>
            </article>
          }
        </div>
      } @else {
        <div class="space-y-3">
          @for (block of page()?.blocks || []; track block.id) {
            <article class="grid gap-3 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-4 lg:grid-cols-2">
              <div>
                <p
                  class="text-sm leading-6 text-slate-800"
                  [attr.dir]="block.direction || directionFor(block.text)"
                  [class.text-right]="(block.direction || directionFor(block.text)) === 'rtl'"
                >
                  {{ block.text }}
                </p>
              </div>
              <div class="rounded-[1.1rem] bg-white px-3 py-3">
                <p
                  class="text-sm leading-6 text-indigo-700"
                  [attr.dir]="translationDirection()"
                  [class.text-right]="translationDirection() === 'rtl'"
                >
                  {{ translationFor(block.id) }}
                </p>
              </div>
            </article>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InlineTranslationLayerComponent {
  page = input<DocumentPageData | null>(null);
  entry = input<TranslationPageEntry | null>(null);
  mode = input<Exclude<TranslationViewMode, 'original'>>('inline');
  protected readonly skeletonRows = [1, 2, 3];
  protected readonly translationMap = computed(() => {
    const entry = this.entry();
    return new Map((entry?.blocks || []).map((item) => [item.blockId, item.translatedText]));
  });

  protected translationFor(blockId: string): string {
    const translated = this.translationMap().get(blockId);
    return translated || 'Translation pending for this text block.';
  }

  protected languageLabel(): string {
    return this.entry()?.targetLanguage === 'ar' ? 'Arabic translation' : 'English translation';
  }

  protected translationDirection(): 'rtl' | 'ltr' {
    return this.entry()?.targetLanguage === 'ar' ? 'rtl' : 'ltr';
  }

  protected directionFor(text: string): 'rtl' | 'ltr' {
    return /[\u0600-\u06FF]/.test(text) ? 'rtl' : 'ltr';
  }
}
