import { Component, effect, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from 'docx';
import {
  AcademicResearchResult,
  AcademicResearchSource,
  AcademicResearchTable,
  AIService
} from '../../services/ai.service';
import { FlashcardsService } from '../../services/flashcards.service';
import { MindMapService } from '../../services/mindmap.service';
import { UpgradeModal } from '../shared/upgrade-modal.component';
import { LocalizationService } from '../../services/localization.service';
import { LanguageCode, getLanguageDirection, normalizeLanguageCode } from '../../i18n/language-config';

type LegacyResearchResult = {
  text: string;
  sources: Array<{ title: string; uri: string }>;
};

type StoredResearchResult = AcademicResearchResult | LegacyResearchResult;

interface SearchHistory {
  query: string;
  timestamp: string;
  level: string;
  language: LanguageCode;
  result: StoredResearchResult;
}

@Component({
  selector: 'app-research-page',
  standalone: true,
  imports: [CommonModule, UpgradeModal],
  template: `
    <div class="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      <div class="bg-slate-950 rounded-[4rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl border border-white/5">
        <div class="relative z-10 space-y-10 max-w-4xl mx-auto">
          <div class="inline-flex items-center gap-3 bg-indigo-500/10 text-indigo-400 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-500/20">
            <i class="fa-solid fa-microscope"></i> {{ t('Advanced Academic Search Engine') }}
          </div>

          <div class="space-y-4">
            <h2 class="text-4xl md:text-6xl font-black text-white tracking-tighter leading-tight">
              {{ t('Search the global databases with extreme precision') }}
            </h2>
            <p class="text-slate-500 text-lg font-bold">{{ t('Retrieve information from original and trusted sources in seconds.') }}</p>
          </div>

          <div class="space-y-6">
            <div class="relative group">
              <input
                #searchQuery
                type="text"
                (keyup.enter)="search(searchQuery.value)"
                [placeholder]="t('Example: artificial intelligence in medicine...')"
                class="w-full bg-white/5 border border-white/10 p-6 md:p-8 rounded-[2.5rem] outline-none focus:ring-4 ring-indigo-500/20 focus:bg-white/10 transition-all text-white text-xl md:text-2xl text-center font-bold shadow-2xl"
              >
              <button
                (click)="search(searchQuery.value)"
                [disabled]="isBusy()"
                class="absolute left-4 top-1/2 -translate-y-1/2 w-14 h-14 md:w-16 md:h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition shadow-xl disabled:opacity-50"
              >
                <i class="fa-solid fa-magnifying-glass text-xl" [class.fa-spinner]="isBusy()" [class.animate-spin]="isBusy()"></i>
              </button>
            </div>

            <div class="flex flex-wrap justify-center gap-4">
              <div class="flex bg-white/5 p-1.5 rounded-2xl border border-white/10">
                @for (lvl of levels; track lvl.id) {
                  <button
                    (click)="selectedLevel.set(lvl.id)"
                    [class.bg-indigo-600]="selectedLevel() === lvl.id"
                    [class.text-white]="selectedLevel() === lvl.id"
                    class="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white/5"
                  >
                    {{ lvl.label }}
                  </button>
                }
              </div>

              <div class="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2">
                <i class="fa-solid fa-language text-indigo-300"></i>
                <select
                  data-no-i18n
                  [value]="selectedLang()"
                  (change)="onLanguageChange($any($event.target).value)"
                  class="bg-transparent text-sm font-black text-white outline-none"
                >
                  @for (language of localization.supportedLanguages; track language.code) {
                    <option [value]="language.code" class="bg-slate-950 text-white">{{ language.nativeName }}</option>
                  }
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="absolute top-0 right-0 w-96 h-96 bg-indigo-600/5 rounded-full blur-[120px]"></div>
        <div class="absolute bottom-0 left-0 w-96 h-96 bg-emerald-600/5 rounded-full blur-[120px]"></div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div class="lg:col-span-1 space-y-6">
          <div class="flex items-center justify-between px-4">
            <h3 class="text-sm font-black text-white uppercase tracking-widest">{{ t('Search History') }}</h3>
            <button (click)="clearHistory()" class="text-[10px] text-rose-500 font-bold hover:underline">{{ t('Clear All') }}</button>
          </div>

          <div class="space-y-3 max-h-[600px] overflow-y-auto no-scrollbar pr-2">
            @for (item of history(); track item.timestamp) {
              <button
                (click)="loadFromHistory(item)"
                [class.border-indigo-500/50]="searchResult()?.text === item.result.text"
                class="w-full text-right p-5 rounded-3xl glass border border-white/5 hover:border-white/20 transition group"
              >
                <p class="text-xs font-black text-white truncate mb-2">{{ item.query }}</p>
                <div class="flex items-center justify-between text-[9px] font-bold text-slate-500">
                  <span>{{ item.timestamp | date:'shortTime' }}</span>
                  <span class="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full">{{ getLevelLabel(item.level) }}</span>
                </div>
              </button>
            } @empty {
              <div class="text-center py-10 opacity-20">
                <i class="fa-solid fa-history text-3xl mb-4 block"></i>
                <p class="text-xs font-bold">{{ t('No records yet') }}</p>
              </div>
            }
          </div>
        </div>

        <div class="lg:col-span-3 space-y-8">
          @if (isBusy()) {
            <div class="py-20 text-center space-y-6 bg-slate-900/50 rounded-[4rem] border border-white/5">
              <div class="flex justify-center gap-2">
                <div class="w-3 h-12 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0s"></div>
                <div class="w-3 h-12 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
                <div class="w-3 h-12 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
              </div>
              <p class="text-indigo-400 font-black uppercase tracking-widest text-xs">{{ t('Retrieving data from original sources...') }}</p>
            </div>
          }

          @if (searchResult() && !isBusy()) {
            <div class="space-y-8 animate-in slide-in-from-bottom duration-700">
              <div class="flex flex-col md:flex-row justify-between items-end gap-6">
                <div class="text-right space-y-2">
                  <h3 class="text-2xl font-black text-white">{{ t('Retrieved Search Results') }}</h3>
                  <p class="text-slate-500 font-bold text-sm">{{ researchResultSummary() }}</p>
                </div>
                <div class="flex flex-wrap gap-3">
                  <button
                    (click)="openResultAsMindMap()"
                    class="flex items-center gap-3 bg-cyan-600/10 text-cyan-300 px-6 py-3 rounded-2xl font-black hover:bg-cyan-600 hover:text-slate-950 transition border border-cyan-500/20 shadow-lg"
                  >
                    <i class="fa-solid fa-diagram-project"></i> {{ t('Mind Map') }}
                  </button>
                  <button
                    (click)="openResultAsFlashcards()"
                    class="flex items-center gap-3 bg-emerald-600/10 text-emerald-400 px-6 py-3 rounded-2xl font-black hover:bg-emerald-600 hover:text-white transition border border-emerald-500/20 shadow-lg"
                  >
                    <i class="fa-regular fa-clone"></i> {{ t('Flashcards') }}
                  </button>
                  <button
                    (click)="exportWord()"
                    class="flex items-center gap-3 bg-blue-600/10 text-blue-500 px-6 py-3 rounded-2xl font-black hover:bg-blue-600 hover:text-white transition border border-blue-500/20 shadow-lg"
                  >
                    <i class="fa-solid fa-file-word"></i> {{ t('Export Word') }}
                  </button>
                </div>
              </div>

              <div id="capture-area" class="bg-slate-900 rounded-[4rem] p-10 md:p-20 border border-white/10 shadow-3xl space-y-12 relative overflow-hidden">
                <div class="hidden print:block border-b border-white/10 pb-10 mb-10">
                  <h1 class="text-4xl font-black text-white mb-4">{{ searchResult()?.title || currentQuery() }}</h1>
                  <p class="text-slate-400">{{ t('Academic Research Report') }}</p>
                  <p class="text-slate-400">{{ t('Level') }}: {{ selectedLevel() }} | {{ t('Language') }}: {{ selectedLang() }}</p>
                </div>

                <div class="space-y-6 text-right" [dir]="selectedLanguageDirection()">
                  <div class="space-y-4 border-b border-white/5 pb-10">
                    <div class="flex flex-wrap items-center justify-end gap-3">
                      <span class="px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-300 text-[10px] font-black uppercase tracking-[0.3em] border border-indigo-500/20">
                        {{ getLevelLabel(selectedLevel()) }}
                      </span>
                      <span class="px-4 py-2 rounded-full bg-white/5 text-slate-300 text-[10px] font-black uppercase tracking-[0.3em] border border-white/10">
                        {{ t('Complete Structured Research') }}
                      </span>
                    </div>
                    <h1 class="text-3xl md:text-5xl font-black text-white leading-tight">
                      {{ searchResult()?.title || currentQuery() }}
                    </h1>
                    <p class="text-slate-400 text-lg font-bold">
                      {{ currentQuery() }}
                    </p>
                  </div>

                  <section class="rounded-[2.5rem] border border-indigo-500/20 bg-indigo-500/5 p-6 md:p-8 space-y-4">
                    <div class="flex items-center justify-between gap-4">
                      <span class="text-[10px] font-black uppercase tracking-[0.35em] text-indigo-300">{{ t('Executive Summary') }}</span>
                      <h2 class="text-2xl font-black text-white">{{ t('Executive Summary') }}</h2>
                    </div>
                    <p class="text-lg md:text-xl text-slate-200 leading-[1.9] font-medium">{{ searchResult()?.executiveSummary }}</p>
                  </section>

                  <div class="space-y-8">
                    @for (section of searchResult()?.sections; track section.heading + $index) {
                      <section class="rounded-[2.5rem] border border-white/8 bg-white/[0.03] p-6 md:p-8 space-y-6 relative overflow-hidden">
                        <div class="absolute inset-y-0 right-0 w-1 bg-indigo-500/30"></div>
                        <div class="flex items-center justify-between gap-4">
                          <span class="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-300 flex items-center justify-center text-sm font-black border border-indigo-500/20">
                            {{ $index + 1 }}
                          </span>
                          <h2 class="text-2xl md:text-3xl font-black text-white">{{ section.heading }}</h2>
                        </div>

                        <div class="space-y-5">
                          @for (paragraph of section.paragraphs; track paragraph + $index) {
                            <p class="text-lg md:text-xl text-slate-200 leading-[1.9] font-medium">{{ paragraph }}</p>
                          }
                        </div>

                        @if (section.bullets?.length) {
                          <ul class="space-y-3">
                            @for (bullet of section.bullets; track bullet + $index) {
                              <li class="flex items-start justify-end gap-3 text-slate-300">
                                <span class="text-base leading-7">{{ bullet }}</span>
                                <span class="mt-2 w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
                              </li>
                            }
                          </ul>
                        }
                      </section>
                    }
                  </div>

                  @if (searchResult()?.tables?.length) {
                    <section class="space-y-6 pt-2">
                      <div class="flex items-center justify-between">
                        <span class="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-300">{{ t('Research Tables') }}</span>
                        <h2 class="text-2xl md:text-3xl font-black text-white">{{ t('Research Tables') }}</h2>
                      </div>

                      <div class="space-y-6">
                        @for (table of searchResult()?.tables; track table.title + $index) {
                          <div class="rounded-[2.5rem] border border-cyan-500/20 bg-cyan-500/5 p-5 md:p-7 space-y-4">
                            <div class="flex items-center justify-between gap-4">
                              <span class="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-300">{{ t('Table') }} {{ $index + 1 }}</span>
                              <h3 class="text-xl md:text-2xl font-black text-white">{{ table.title }}</h3>
                            </div>

                            <div class="overflow-x-auto rounded-[1.75rem] border border-white/10 bg-slate-950/70">
                              <table class="research-table min-w-full text-sm text-right">
                                <thead>
                                  <tr>
                                    @for (column of table.columns; track column + $index) {
                                      <th class="px-5 py-4 bg-cyan-500/10 text-cyan-200 font-black whitespace-nowrap border-b border-white/10">
                                        {{ column }}
                                      </th>
                                    }
                                  </tr>
                                </thead>
                                <tbody>
                                  @for (row of table.rows; track $index) {
                                    <tr class="border-b border-white/5 last:border-0">
                                      @for (cell of row; track cell + $index) {
                                        <td class="px-5 py-4 text-slate-200 align-top whitespace-pre-line">
                                          {{ cell }}
                                        </td>
                                      }
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>

                            @if (table.summary) {
                              <p class="text-sm md:text-base text-slate-300 leading-8">{{ table.summary }}</p>
                            }
                          </div>
                        }
                      </div>
                    </section>
                  }

                  <section class="rounded-[2.5rem] border border-emerald-500/20 bg-emerald-500/5 p-6 md:p-8 space-y-4">
                    <div class="flex items-center justify-between gap-4">
                      <span class="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-300">{{ t('Conclusion') }}</span>
                      <h2 class="text-2xl font-black text-white">{{ t('Conclusion') }}</h2>
                    </div>
                    <p class="text-lg md:text-xl text-slate-200 leading-[1.9] font-medium">{{ searchResult()?.conclusion }}</p>
                  </section>
                </div>

                <div class="pt-10 border-t border-white/5 space-y-8" [dir]="selectedLanguageDirection()">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">{{ t('Bibliography') }}</span>
                    <h4 class="text-2xl font-black text-white text-right">{{ t('Trusted References') }}</h4>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    @for (source of searchResult()?.sources; track source.uri) {
                      <a
                        [href]="source.uri"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="flex items-start justify-between gap-4 p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition group shadow-lg"
                      >
                        <i class="fa-solid fa-arrow-up-right-from-square text-slate-600 group-hover:text-indigo-400 mt-1"></i>
                        <div class="text-right space-y-2">
                          <p class="text-sm font-black text-white leading-6">{{ source.title }}</p>
                          <p class="text-[11px] text-slate-400 leading-5">
                            {{ formatSourceMeta(source) }}
                          </p>
                          <p class="text-[10px] text-slate-500 break-all">{{ source.uri }}</p>
                          @if (source.credibilityNote) {
                            <p class="text-[11px] text-indigo-300">{{ source.credibilityNote }}</p>
                          }
                        </div>
                      </a>
                    }
                  </div>
                </div>

                <div class="absolute top-10 left-10 opacity-5 pointer-events-none">
                  <div class="text-6xl font-black text-white rotate-12">SmartEdge AI</div>
                </div>
              </div>
            </div>
          } @else if (!isBusy() && !searchResult()) {
            <div class="py-40 text-center space-y-8 opacity-20">
              <i class="fa-solid fa-magnifying-glass text-8xl block"></i>
              <p class="text-2xl font-black">{{ t('Start academic research now') }}</p>
            </div>
          }
        </div>
      </div>

      @if (showUpgradeModal()) {
        <app-upgrade-modal
          [title]="t('Daily Limit Reached')"
          [message]="upgradeMessage()"
          icon="fa-solid fa-microscope"
          (closeModal)="showUpgradeModal.set(false)"
          (upgradePlan)="onUpgradeRequested()"
        >
        </app-upgrade-modal>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .shadow-3xl { box-shadow: 0 40px 100px -20px rgba(0,0,0,0.5); }
    .research-table { border-collapse: separate; border-spacing: 0; }
    .research-table th:first-child { border-top-right-radius: 1.25rem; }
    .research-table th:last-child { border-top-left-radius: 1.25rem; }
    .research-table td + td,
    .research-table th + th { border-right: 1px solid rgba(255,255,255,0.05); }
  `]
})
export class ResearchPage {
  private ai = inject(AIService);
  private flashcardsService = inject(FlashcardsService);
  private mindMapService = inject(MindMapService);
  public localization = inject(LocalizationService);
  readonly t = (text: string, language: LanguageCode = this.selectedLang()) => this.localization.phrase(text, language);

  back = output<void>();
  openFlashcards = output<void>();
  openMindMap = output<void>();

  searchResult = signal<AcademicResearchResult | null>(null);
  isBusy = signal(false);
  searchTime = signal<string>('0');
  currentQuery = signal('');

  selectedLevel = signal('academic');
  selectedLang = signal<LanguageCode>(this.localization.currentLanguage());
  history = signal<SearchHistory[]>([]);

  showUpgradeModal = signal(false);
  upgradeMessage = signal('');
  onUpgradeRequested = () => {
    this.showUpgradeModal.set(false);
    this.back.emit();
  };

  readonly levelBlueprints = [
    { id: 'academic', label: 'Academic' },
    { id: 'university', label: 'University' },
    { id: 'high_school', label: 'High School' },
    { id: 'summarized', label: 'Summary' }
  ] as const;

  get levels() {
    return this.levelBlueprints.map((level) => ({
      ...level,
      label: this.t(level.label)
    }));
  }

  constructor() {
    const saved = localStorage.getItem('smartedge_research_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.history.set(parsed.map((item) => this.hydrateHistoryItem(item)).filter((item): item is SearchHistory => !!item));
        }
      } catch {
        localStorage.removeItem('smartedge_research_history');
      }
    }

    effect(() => {
      localStorage.setItem('smartedge_research_history', JSON.stringify(this.history()));
    });

    effect(() => {
      const currentLanguage = normalizeLanguageCode(this.localization.currentLanguage());
      if (this.selectedLang() !== currentLanguage) {
        this.selectedLang.set(currentLanguage);
      }
    });
  }

  onLanguageChange(language: string) {
    const normalized = normalizeLanguageCode(language);
    this.selectedLang.set(normalized);
    void this.localization.setLanguage(normalized);
  }

  async search(query: string) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      return;
    }

    const limitCheck = this.ai.checkLimit('academicResearch');
    if (!limitCheck.allowed) {
      this.upgradeMessage.set(limitCheck.message);
      this.showUpgradeModal.set(true);
      return;
    }

    this.currentQuery.set(normalizedQuery);
    const startTime = performance.now();
    this.isBusy.set(true);
    this.searchResult.set(null);

    try {
      const rawResult = await this.ai.academicSearch(normalizedQuery, this.selectedLevel(), this.selectedLang());
      const result = this.hydrateResearchResult(rawResult, normalizedQuery, this.selectedLevel(), this.selectedLang());

      this.searchResult.set(result);
      this.ai.incrementUsage('academicResearch');
      const fingerprint = `research:${normalizedQuery.slice(0, 60)}:${this.selectedLevel()}:${this.selectedLang()}`;
      this.ai.awardXPForAction('academicResearch', 15, { fingerprint });

      const endTime = performance.now();
      this.searchTime.set(((endTime - startTime) / 1000).toFixed(2));

      const historyItem: SearchHistory = {
        query: normalizedQuery,
        timestamp: new Date().toISOString(),
        level: this.selectedLevel(),
        language: this.selectedLang(),
        result
      };
      this.history.update((history) => [historyItem, ...history.slice(0, 19)]);
    } catch (error) {
      console.error(error);
      alert(this.t('An error occurred during academic search. Please try again later.'));
    } finally {
      this.isBusy.set(false);
    }
  }

  loadFromHistory(item: SearchHistory) {
    const normalizedItem = this.hydrateHistoryItem(item);
    if (!normalizedItem) {
      return;
    }

    this.searchResult.set(normalizedItem.result as AcademicResearchResult);
    this.currentQuery.set(normalizedItem.query);
    this.selectedLevel.set(normalizedItem.level);
    this.selectedLang.set(normalizedItem.language);
    this.searchTime.set('0.00');
  }

  clearHistory() {
    if (confirm(this.t('Are you sure you want to clear research history?'))) {
      this.history.set([]);
    }
  }

  openResultAsFlashcards() {
    const result = this.searchResult();
    if (!result?.text?.trim()) {
      return;
    }

    this.flashcardsService.openFromSource({
      sourceText: result.text,
      sourceType: 'research',
      sourceTitle: this.currentQuery() || this.t('From Academic Research'),
      language: this.selectedLang(),
      groupName: this.currentQuery() || this.t('Research Flashcards')
    });
    this.openFlashcards.emit();
  }

  openResultAsMindMap() {
    const result = this.searchResult();
    if (!result?.text?.trim()) {
      return;
    }

    this.mindMapService.openFromSource({
      sourceText: result.text,
      sourceType: 'research',
      sourceTitle: this.currentQuery() || this.t('From Academic Research'),
      language: this.selectedLang(),
      mapName: this.currentQuery() || this.t('Research Mind Map')
    });
    this.openMindMap.emit();
  }

  formatSourceMeta(source: AcademicResearchSource): string {
    const parts = [source.publisher, source.year].filter(Boolean);
    return parts.length > 0 ? parts.join(' • ') : this.t('Trusted source');
  }

  researchResultSummary(): string {
    const result = this.searchResult();
    if (!result) {
      return '';
    }

    return `${this.t('Found')} ${result.sources.length} ${this.t('trusted sources')} ${this.t('and')} ${result.sections.length} ${this.t('connected sections')} ${this.t('in')} ${this.searchTime()} ${this.t('seconds')}.`;
  }

  getLevelLabel(levelId: string): string {
    return this.levels.find((level) => level.id === levelId)?.label || levelId;
  }

  selectedLanguageDirection() {
    return getLanguageDirection(this.selectedLang());
  }

  async exportWord() {
    const result = this.searchResult();
    if (!result) {
      return;
    }

    const directionAlignment = this.selectedLanguageDirection() === 'rtl' ? AlignmentType.RIGHT : AlignmentType.LEFT;
    const children: Array<Paragraph | Table> = [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: result.title || this.currentQuery(),
            bold: true,
            color: '2563eb',
            size: 48
          })
        ],
        spacing: { after: 200 }
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: this.currentQuery(),
            italics: true,
            color: '64748b',
            size: 24
          })
        ],
        spacing: { after: 160 }
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: this.t('Complete Academic Research Report'),
            size: 26,
            color: '475569'
          })
        ],
        spacing: { after: 400 }
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: directionAlignment,
          children: [
            new TextRun({
              text: this.t('Executive Summary'),
              bold: true,
              size: 30
            })
        ],
        spacing: { before: 120, after: 160 }
      }),
      new Paragraph({
        alignment: directionAlignment,
        children: [new TextRun({ text: result.executiveSummary, size: 24, font: 'Arial' })],
        spacing: { after: 280, line: 360 }
      })
    ];

    result.sections.forEach((section) => {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          alignment: directionAlignment,
          children: [new TextRun({ text: section.heading, bold: true, size: 30 })],
          spacing: { before: 240, after: 180 }
        })
      );

      section.paragraphs.forEach((paragraph) => {
        children.push(
          new Paragraph({
            alignment: directionAlignment,
            children: [new TextRun({ text: paragraph, size: 24, font: 'Arial' })],
            spacing: { after: 180, line: 360 }
          })
        );
      });

      (section.bullets || []).forEach((bullet) => {
        children.push(
          new Paragraph({
            alignment: directionAlignment,
            bullet: { level: 0 },
            children: [new TextRun({ text: bullet, size: 22, font: 'Arial' })],
            spacing: { after: 120, line: 320 }
          })
        );
      });
    });

    if (result.tables.length > 0) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          alignment: directionAlignment,
          children: [
            new TextRun({
              text: this.t('Research Tables'),
              bold: true,
              size: 30
            })
          ],
          spacing: { before: 240, after: 180 }
        })
      );

      result.tables.forEach((table) => {
        children.push(
          new Paragraph({
            alignment: directionAlignment,
            children: [new TextRun({ text: table.title, bold: true, size: 26, color: '0f766e' })],
            spacing: { before: 120, after: 120 }
          }),
          this.createWordTable(table)
        );

        if (table.summary?.trim()) {
          children.push(
            new Paragraph({
              alignment: directionAlignment,
              children: [new TextRun({ text: table.summary, size: 20, color: '475569', font: 'Arial' })],
              spacing: { before: 120, after: 220 }
            })
          );
        } else {
          children.push(new Paragraph({ spacing: { after: 220 } }));
        }
      });
    }

    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: directionAlignment,
        children: [
          new TextRun({
            text: this.t('Conclusion'),
            bold: true,
            size: 30
          })
        ],
        spacing: { before: 240, after: 160 }
      }),
      new Paragraph({
        alignment: directionAlignment,
        children: [new TextRun({ text: result.conclusion, size: 24, font: 'Arial' })],
        spacing: { after: 280, line: 360 }
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        alignment: directionAlignment,
        children: [
          new TextRun({
            text: this.t('References'),
            bold: true,
            size: 30
          })
        ],
        spacing: { before: 240, after: 160 }
      })
    );

    result.sources.forEach((source) => {
      const sourceMeta = [source.publisher, source.year, source.uri].filter(Boolean).join(' | ');
      children.push(
        new Paragraph({
          alignment: directionAlignment,
          children: [
            new TextRun({ text: source.title, bold: true, size: 22 }),
            new TextRun({ text: sourceMeta ? ` - ${sourceMeta}` : '', size: 20, color: '64748b' })
          ],
          spacing: { after: 120, line: 320 }
        })
      );
    });

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 }
          }
        },
        children
      }]
    });

    const blob = await Packer.toBlob(doc);
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.buildWordFileName(this.currentQuery() || result.title)}.docx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  private hydrateHistoryItem(item: unknown): SearchHistory | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const candidate = item as Partial<SearchHistory>;
    const query = typeof candidate.query === 'string' ? candidate.query : '';
    const level = typeof candidate.level === 'string' ? candidate.level : 'academic';
    const language = normalizeLanguageCode(candidate.language);
    const timestamp = typeof candidate.timestamp === 'string' ? candidate.timestamp : new Date().toISOString();

    return {
      query,
      level,
      language,
      timestamp,
      result: this.hydrateResearchResult(candidate.result, query, level, language)
    };
  }

  private hydrateResearchResult(
    result: StoredResearchResult | null | undefined,
    query: string,
    level: string,
    language: LanguageCode
  ): AcademicResearchResult {
    return this.ai.normalizeAcademicResearchResult(result, query, level, language);
  }

  private buildWordFileName(value: string): string {
    const normalized = value
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
      .replace(/\s+/g, '-')
      .trim()
      .slice(0, 80);

    return normalized || 'academic-research';
  }

  private createWordTable(table: AcademicResearchTable): Table {
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'cbd5e1' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'cbd5e1' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'cbd5e1' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'cbd5e1' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'e2e8f0' }
      },
      rows: [
        new TableRow({
          tableHeader: true,
          children: table.columns.map((column) => this.createWordTableCell(column, true))
        }),
        ...table.rows.map((row) => new TableRow({
          children: table.columns.map((_, index) => this.createWordTableCell(row[index] || '', false))
        }))
      ]
    });
  }

  private createWordTableCell(text: string, isHeader: boolean): TableCell {
    return new TableCell({
      shading: isHeader
        ? { type: ShadingType.CLEAR, fill: '0f766e', color: 'FFFFFF' }
        : undefined,
      margins: { top: 140, bottom: 140, left: 120, right: 120 },
      children: [
        new Paragraph({
          alignment: isHeader ? AlignmentType.CENTER : (this.selectedLanguageDirection() === 'rtl' ? AlignmentType.RIGHT : AlignmentType.LEFT),
          children: [
            new TextRun({
              text: text || ' ',
              bold: isHeader,
              color: isHeader ? 'FFFFFF' : '0f172a',
              size: isHeader ? 22 : 20,
              font: 'Arial'
            })
          ]
        })
      ]
    });
  }
}
