import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy, ElementRef, HostListener, ViewChild, computed, effect, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalizationService } from '../../services/localization.service';
import {
  FileStudyDocument,
  FileStudyExplainMode,
  FileStudyExplainStyle,
  FileStudyExplanation,
  FileStudyLanguage,
  FileStudyService
} from '../../services/file-study.service';

interface FileStudySidebarEntry extends FileStudyExplanation {
  id: string;
}

@Component({
  selector: 'app-file-study-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-slate-950 px-4 py-5 md:px-6 md:py-6" [dir]="isRtl() ? 'rtl' : 'ltr'">
      <div class="mx-auto max-w-[1600px]">
        @if (phase() !== 'study') {
          <div class="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center justify-center">
            <section class="w-full rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)] backdrop-blur-2xl md:p-8">
              <div class="space-y-6">
                <div class="space-y-3">
                  <button (click)="back.emit()" class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-200 transition hover:bg-white/10">
                    <i class="fa-solid" [class.fa-arrow-right]="isRtl()" [class.fa-arrow-left]="!isRtl()"></i>
                    {{ labels().back }}
                  </button>
                  <div class="space-y-2">
                    <p class="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-indigo-200">
                      <i class="fa-solid fa-book-open-reader"></i>
                      {{ labels().pageEyebrow }}
                    </p>
                    <h1 class="text-3xl font-black tracking-tight text-white md:text-5xl">{{ labels().pageTitle }}</h1>
                    <p class="max-w-2xl text-sm leading-7 text-slate-300 md:text-base">{{ labels().pageSubtitle }}</p>
                  </div>
                </div>

                <div class="rounded-[1.6rem] border border-dashed border-white/15 bg-slate-950/50 p-5">
                  <input #filePicker type="file" accept=".pdf,application/pdf" class="hidden" (change)="onFileSelected($event)">
                  <button (click)="filePicker.click()" class="flex w-full flex-col items-center justify-center gap-3 rounded-[1.3rem] border border-white/10 bg-white/[0.03] px-5 py-10 text-center transition hover:border-indigo-400/30 hover:bg-white/[0.05]">
                    <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-200">
                      <i class="fa-solid fa-file-arrow-up text-2xl"></i>
                    </span>
                    <div class="space-y-1">
                      <p class="font-black text-white">{{ selectedFile()?.name || labels().uploadCta }}</p>
                      <p class="text-xs text-slate-400">{{ labels().uploadHint }}</p>
                    </div>
                  </button>
                </div>

                @if (selectedFile()) {
                  <div class="flex items-center justify-between rounded-[1.3rem] border border-white/10 bg-slate-950/45 px-4 py-3">
                    <div>
                      <p class="text-sm font-black text-white">{{ selectedFile()!.name }}</p>
                      <p class="text-xs text-slate-400">{{ formatFileSize(selectedFile()!.size) }}</p>
                    </div>
                    <button (click)="clearSelectedFile()" class="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1.5 text-xs font-black text-rose-100 transition hover:bg-rose-500/20">
                      {{ labels().removeFile }}
                    </button>
                  </div>
                }

                <div class="grid gap-4 md:grid-cols-2">
                  <label class="field">
                    <span>{{ labels().languageLabel }}</span>
                    <select [ngModel]="selectedLanguage()" (ngModelChange)="selectedLanguage.set($event)">
                      <option value="ar">{{ labels().arabic }}</option>
                      <option value="en">{{ labels().english }}</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>{{ labels().depthLabel }}</span>
                    <select [ngModel]="selectedStyle()" (ngModelChange)="selectedStyle.set($event)">
                      <option value="simple">{{ labels().depthSimple }}</option>
                      <option value="medium">{{ labels().depthMedium }}</option>
                      <option value="deep">{{ labels().depthDeep }}</option>
                    </select>
                  </label>
                </div>

                @if (uploadError()) {
                  <div class="rounded-[1.25rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {{ uploadError() }}
                  </div>
                }

                @if (phase() === 'preparing') {
                  <div class="rounded-[1.4rem] border border-white/10 bg-slate-950/55 px-4 py-4">
                    <div class="flex items-center justify-between gap-3 text-sm text-slate-200">
                      <span class="font-black">{{ statusLabel() }}</span>
                      @if (preparationPercent() > 0) {
                        <span class="text-xs font-black text-slate-400">{{ preparationPercent() }}%</span>
                      }
                    </div>
                    <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                      <div class="h-full rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-cyan-300 transition-all duration-500" [style.width.%]="preparationPercent()"></div>
                    </div>
                  </div>
                }

                <div class="flex flex-col gap-3 sm:flex-row">
                  <button
                    (click)="startStudy()"
                    [disabled]="!selectedFile() || phase() === 'preparing'"
                    class="flex-1 rounded-[1.3rem] bg-white px-5 py-4 text-sm font-black text-slate-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {{ phase() === 'preparing' ? labels().preparing : labels().startStudy }}
                  </button>
                  <button
                    (click)="openTutor.emit()"
                    class="rounded-[1.3rem] border border-white/10 bg-white/5 px-5 py-4 text-sm font-black text-white transition hover:bg-white/10"
                  >
                    {{ labels().backToTutor }}
                  </button>
                </div>
              </div>
            </section>
          </div>
        } @else {
          <div class="flex min-h-[calc(100vh-3rem)] flex-col gap-4">
            <header class="rounded-[1.7rem] border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_20px_60px_rgba(2,6,23,0.35)] backdrop-blur-2xl md:px-5">
              <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div class="space-y-2">
                  <div class="flex flex-wrap items-center gap-2">
                    <button (click)="back.emit()" class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-black text-slate-200 transition hover:bg-white/10">
                      <i class="fa-solid" [class.fa-arrow-right]="isRtl()" [class.fa-arrow-left]="!isRtl()"></i>
                      {{ labels().back }}
                    </button>
                    <button (click)="resetSession()" class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-black text-slate-200 transition hover:bg-white/10">
                      <i class="fa-solid fa-rotate-left"></i>
                      {{ labels().changeFile }}
                    </button>
                  </div>
                  <div>
                    <p class="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{{ labels().studyMode }}</p>
                    <h2 class="text-lg font-black text-white md:text-2xl">{{ document()!.fileName }}</h2>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                  <div class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-slate-200">
                    {{ slideIndicator() }}
                  </div>
                  <div class="min-w-[160px]">
                    <div class="mb-2 flex items-center justify-between text-[11px] font-black text-slate-400">
                      <span>{{ labels().progress }}</span>
                      <span>{{ progressPercent() }}%</span>
                    </div>
                    <div class="h-2 overflow-hidden rounded-full bg-white/5">
                      <div class="h-full rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-cyan-300 transition-all duration-500" [style.width.%]="progressPercent()"></div>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            @if (isMobileLayout()) {
              <div class="inline-flex w-full rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-1">
                <button (click)="mobileTab.set('document')" [class.bg-white]="mobileTab() === 'document'" [class.text-slate-950]="mobileTab() === 'document'" class="flex-1 rounded-[1rem] px-4 py-3 text-sm font-black text-slate-300 transition">
                  {{ labels().documentTab }}
                </button>
                <button (click)="mobileTab.set('notes')" [class.bg-white]="mobileTab() === 'notes'" [class.text-slate-950]="mobileTab() === 'notes'" class="flex-1 rounded-[1rem] px-4 py-3 text-sm font-black text-slate-300 transition">
                  {{ labels().explanationTab }}
                </button>
              </div>
            }

            <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              @if (!isMobileLayout() || mobileTab() === 'document') {
                <section class="flex min-h-[60vh] flex-col overflow-hidden rounded-[1.9rem] border border-white/10 bg-white/[0.03] shadow-[0_20px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl">
                  <div class="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3 md:px-5">
                    <div>
                      <p class="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{{ labels().documentTab }}</p>
                      <p class="text-sm font-bold text-white">{{ currentPageTitle() }}</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <button (click)="goToPreviousPage()" [disabled]="currentPage() <= 1" class="viewer-btn">
                        <i class="fa-solid" [class.fa-chevron-right]="isRtl()" [class.fa-chevron-left]="!isRtl()"></i>
                      </button>
                      <div class="rounded-full border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-black text-slate-200">
                        {{ slideIndicator() }}
                      </div>
                      <div class="jump-box">
                        <input #pageJumpInput type="number" min="1" [max]="totalPages()" [value]="currentPage()" (keydown.enter)="jumpToPage(pageJumpInput.value)">
                        <button type="button" class="jump-btn" (click)="jumpToPage(pageJumpInput.value)">{{ pageJumpLabel() }}</button>
                      </div>
                      <button (click)="goToNextPage()" [disabled]="currentPage() >= totalPages()" class="viewer-btn">
                        <i class="fa-solid" [class.fa-chevron-left]="isRtl()" [class.fa-chevron-right]="!isRtl()"></i>
                      </button>
                    </div>
                  </div>

                  <div #viewerScroller class="relative flex-1 overflow-auto bg-slate-950/60 p-3 md:p-5" (scroll)="onViewerScroll()">
                    @if (isRenderingPage()) {
                      <div class="absolute inset-x-0 top-4 z-10 mx-auto w-fit rounded-full border border-white/10 bg-slate-900/90 px-4 py-2 text-xs font-black text-slate-200 shadow-lg">
                        {{ labels().renderingPage }}
                      </div>
                    }
                    @if (viewerError()) {
                      <div class="mx-auto mt-10 max-w-lg rounded-[1.4rem] border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                        <p class="font-black">{{ labels().viewerErrorTitle }}</p>
                        <p class="mt-2 leading-7">{{ viewerError() }}</p>
                        <button (click)="rerenderCurrentPage()" class="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white transition hover:bg-white/10">
                          {{ labels().retry }}
                        </button>
                      </div>
                    } @else {
                      <div class="flex min-h-full items-start justify-center">
                        <div class="pdf-page-shell shadow-[0_24px_80px_rgba(15,23,42,0.45)]">
                          <canvas #pdfCanvas class="pdf-page-canvas transition-opacity duration-300" [class.opacity-80]="isRenderingPage()"></canvas>
                          <div #textLayer class="pdf-text-layer"></div>
                        </div>
                      </div>
                    }
                  </div>
                </section>
              }

              @if (!isMobileLayout() || mobileTab() === 'notes') {
                <aside class="flex min-h-[60vh] flex-col overflow-hidden rounded-[1.9rem] border border-white/10 bg-white/[0.04] shadow-[0_20px_60px_rgba(2,6,23,0.35)] backdrop-blur-2xl">
                  <div class="border-b border-white/5 px-4 py-4 md:px-5">
                    <div class="flex items-start justify-between gap-3">
                      <div class="space-y-2">
                        <p class="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{{ labels().explanationTab }}</p>
                        <h3 class="text-base font-black text-white">{{ currentPageTitle() }}</h3>
                      </div>
                      <span class="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                        [class.border-emerald-400/20]="currentPageGrounded()"
                        [class.bg-emerald-400/10]="currentPageGrounded()"
                        [class.text-emerald-100]="currentPageGrounded()"
                        [class.border-amber-400/20]="!currentPageGrounded()"
                        [class.bg-amber-400/10]="!currentPageGrounded()"
                        [class.text-amber-100]="!currentPageGrounded()">
                        {{ currentPageGrounded() ? labels().groundedBadge : labels().limitedBadge }}
                      </span>
                    </div>
                  </div>

                  <div class="flex-1 overflow-y-auto px-4 py-4 md:px-5">
                    @if (explanationError()) {
                      <div class="rounded-[1.4rem] border border-rose-500/20 bg-rose-500/10 px-4 py-4 text-sm text-rose-100">
                        <p class="font-black">{{ labels().aiErrorTitle }}</p>
                        <p class="mt-2 leading-7">{{ explanationError() }}</p>
                        <button (click)="reloadCurrentPageExplanation()" class="mt-4 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white transition hover:bg-white/10">
                          {{ labels().retry }}
                        </button>
                      </div>
                    } @else if (currentEntries().length === 0 && isExplaining()) {
                      <div class="space-y-3">
                        <div class="h-5 w-32 rounded-full bg-white/10 shimmer"></div>
                        <div class="h-20 rounded-[1.2rem] bg-white/[0.04] shimmer"></div>
                        <div class="h-20 rounded-[1.2rem] bg-white/[0.04] shimmer"></div>
                      </div>
                    } @else if (currentEntries().length === 0) {
                      <div class="rounded-[1.4rem] border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-7 text-slate-300">
                        {{ labels().emptyExplanation }}
                      </div>
                    } @else {
                      <div class="space-y-4">
                        @for (entry of currentEntries(); track entry.id) {
                          <article class="rounded-[1.5rem] border border-white/10 bg-slate-950/45 px-4 py-4 transition-all duration-300">
                            <div class="space-y-3">
                              <div class="flex items-center justify-between gap-3">
                                <h4 class="text-sm font-black text-white">{{ entry.title }}</h4>
                                <span class="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{{ labels().fromPage }} {{ entry.pageNumber }}</span>
                              </div>
                              <p class="text-sm leading-7 text-slate-200">{{ entry.summary }}</p>
                              @if (entry.lineItems?.length) {
                                <div class="space-y-3">
                                  @for (item of entry.lineItems!; track item.source + item.explanation) {
                                    <div class="rounded-[1.1rem] border border-white/10 bg-white/[0.03] px-3 py-3">
                                      <p class="line-source" dir="auto">{{ item.source }}</p>
                                      <p class="line-explanation">{{ item.explanation }}</p>
                                      @if (item.translation) {
                                        <p class="line-translation" dir="auto">{{ item.translation }}</p>
                                      }
                                    </div>
                                  }
                                </div>
                              }
                              @if (entry.keyPoints.length > 0) {
                                <ul class="space-y-2">
                                  @for (point of entry.keyPoints; track point) {
                                    <li class="flex items-start gap-2 text-sm leading-7 text-slate-300">
                                      <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300"></span>
                                      <span>{{ point }}</span>
                                    </li>
                                  }
                                </ul>
                              }
                              @if (entry.note) {
                                <div class="rounded-[1rem] border border-white/10 bg-white/[0.03] px-3 py-3 text-xs leading-6 text-slate-400">{{ entry.note }}</div>
                              }
                            </div>
                          </article>
                        }
                      </div>
                    }
                  </div>

                  <div class="border-t border-white/5 px-4 py-4 md:px-5">
                    <div class="flex flex-wrap gap-2">
                      <button (click)="runQuickAction('simple')" [disabled]="isExplaining()" class="action-chip">{{ labels().simplify }}</button>
                      <button (click)="runQuickAction('detailed')" [disabled]="isExplaining()" class="action-chip">{{ labels().deepen }}</button>
                      <button (click)="runQuickAction('questions')" [disabled]="isExplaining()" class="action-chip">{{ labels().questions }}</button>
                    </div>
                    <form class="mt-3 space-y-3" (ngSubmit)="submitFreeQuestion()">
                      <textarea rows="3" [ngModel]="freeQuestion()" (ngModelChange)="freeQuestion.set($event)" name="freeQuestion"
                        [placeholder]="labels().questionPlaceholder"
                        class="min-h-[92px] w-full resize-none rounded-[1.2rem] border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-indigo-400/40"></textarea>
                      <div class="flex items-center justify-between gap-3">
                        <p class="text-[11px] leading-6 text-slate-500">{{ labels().questionHint }}</p>
                        <button type="submit" [disabled]="isExplaining() || !freeQuestion().trim()" class="rounded-full bg-white px-4 py-2 text-xs font-black text-slate-950 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50">
                          {{ labels().askAboutPage }}
                        </button>
                      </div>
                    </form>
                  </div>
                </aside>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .field span {
      display: block;
      margin-bottom: 0.5rem;
      font-size: 0.72rem;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: rgb(148 163 184);
    }

    .field select {
      width: 100%;
      border-radius: 1rem;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(15, 23, 42, 0.78);
      padding: 0.95rem 1rem;
      color: white;
      outline: none;
      transition: border-color 180ms ease, background 180ms ease;
    }

    .field select:focus {
      border-color: rgba(129, 140, 248, 0.45);
    }

    .viewer-btn {
      display: inline-flex;
      height: 2.6rem;
      width: 2.6rem;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(15, 23, 42, 0.62);
      color: white;
      transition: background 180ms ease, transform 180ms ease, opacity 180ms ease;
    }

    .viewer-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
      transform: translateY(-1px);
    }

    .viewer-btn:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .jump-box {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(15, 23, 42, 0.62);
      padding: 0.28rem;
    }

    .jump-box input {
      width: 72px;
      border: 0;
      background: transparent;
      color: white;
      padding: 0.45rem 0.65rem;
      outline: none;
      font-size: 0.78rem;
      font-weight: 900;
    }

    .jump-btn {
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(255, 255, 255, 0.08);
      color: white;
      padding: 0.45rem 0.8rem;
      font-size: 0.72rem;
      font-weight: 900;
    }

    .action-chip {
      border-radius: 9999px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.05);
      padding: 0.6rem 0.95rem;
      font-size: 0.72rem;
      font-weight: 900;
      color: rgb(226 232 240);
      transition: background 180ms ease, transform 180ms ease, opacity 180ms ease;
    }

    .action-chip:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.1);
      transform: translateY(-1px);
    }

    .action-chip:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .shimmer {
      position: relative;
      overflow: hidden;
    }

    .shimmer::after {
      content: '';
      position: absolute;
      inset: 0;
      transform: translateX(-100%);
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
      animation: shimmerMove 1.4s infinite;
    }

    @keyframes shimmerMove {
      100% {
        transform: translateX(100%);
      }
    }

    .pdf-page-shell {
      position: relative;
      display: inline-block;
      width: max-content;
      max-width: none;
      flex: 0 0 auto;
      border-radius: 1rem;
      overflow: hidden;
      background: white;
    }

    .pdf-page-canvas {
      display: block;
      max-width: none;
      width: auto;
      height: auto;
      border-radius: 1rem;
      background: white;
    }

    .pdf-text-layer {
      --min-font-size: 1;
      --text-scale-factor: calc(var(--total-scale-factor, 1) * var(--min-font-size));
      --min-font-size-inv: calc(1 / var(--min-font-size));
      display: none;
    }

    .pdf-text-layer :is(span, br) {
      display: none;
    }

    .pdf-text-layer > :not(.markedContent),
    .pdf-text-layer .markedContent span:not(.markedContent) {
      display: none;
    }

    .pdf-text-layer .markedContent {
      display: none;
    }

    .pdf-text-layer ::selection {
      background: rgba(59, 130, 246, 0.25);
    }

    .line-source {
      color: white;
      font-size: 0.88rem;
      font-weight: 900;
      line-height: 1.9;
      white-space: pre-wrap;
      word-break: normal;
      overflow-wrap: break-word;
      unicode-bidi: plaintext;
    }

    .line-explanation {
      margin-top: 0.55rem;
      color: rgb(203 213 225);
      font-size: 0.88rem;
      line-height: 1.9;
    }

    .line-translation {
      margin-top: 0.55rem;
      color: rgb(147 197 253);
      font-size: 0.8rem;
      line-height: 1.8;
      white-space: pre-wrap;
      word-break: normal;
      overflow-wrap: break-word;
      unicode-bidi: plaintext;
    }
  `]
})
export class FileStudyPage {
  private readonly localization = inject(LocalizationService);
  private readonly fileStudy = inject(FileStudyService);

  @ViewChild('pdfCanvas') private pdfCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('textLayer') private textLayer?: ElementRef<HTMLDivElement>;
  @ViewChild('viewerScroller') private viewerScroller?: ElementRef<HTMLDivElement>;

  back = output<void>();
  openTutor = output<void>();

  readonly isRtl = computed(() => this.localization.direction() === 'rtl');
  readonly phase = signal<'upload' | 'preparing' | 'study'>('upload');
  readonly selectedFile = signal<File | null>(null);
  readonly selectedLanguage = signal<FileStudyLanguage>(this.localization.currentLanguage() === 'ar' ? 'ar' : 'en');
  readonly selectedStyle = signal<FileStudyExplainStyle>('medium');
  readonly document = signal<FileStudyDocument | null>(null);
  readonly currentPageIndex = signal(0);
  readonly renderedPageNumber = signal(1);
  readonly mobileTab = signal<'document' | 'notes'>('document');
  readonly statusLabel = signal('');
  readonly preparationPercent = signal(0);
  readonly uploadError = signal('');
  readonly explanationError = signal('');
  readonly viewerError = signal('');
  readonly isExplaining = signal(false);
  readonly isRenderingPage = signal(false);
  readonly freeQuestion = signal('');
  readonly viewportWidth = signal(typeof window === 'undefined' ? 1280 : window.innerWidth);

  private readonly explanationThreads = signal<Record<number, FileStudySidebarEntry[]>>({});
  private readonly explanationRequestCache = new Map<string, FileStudySidebarEntry>();
  private explanationSequence = 0;
  private renderSequence = 0;
  private lastViewerScrollTop = 0;
  private scrollNavigationLockUntil = 0;
  private pendingScrollAnchor: 'top' | 'bottom' | null = null;

  readonly totalPages = computed(() => this.document()?.totalPages || 0);
  readonly currentPage = computed(() => this.currentPageIndex() + 1);
  readonly currentEntries = computed(() => this.explanationThreads()[this.currentPage()] || []);
  readonly currentPageGrounded = computed(() => {
    const entries = this.currentEntries();
    return entries.length === 0 ? true : entries[0].status === 'grounded';
  });
  readonly isMobileLayout = computed(() => this.viewportWidth() < 1024);
  readonly progressPercent = computed(() => {
    const total = this.totalPages();
    const page = this.renderedPageNumber();
    if (!total) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round((page / total) * 100)));
  });
  readonly slideIndicator = computed(() => {
    const total = this.totalPages();
    const page = this.renderedPageNumber();
    return this.localization.currentLanguage() === 'ar'
      ? `الصفحة ${page} من ${total || 0}`
      : `Page ${page} of ${total || 0}`;
  });
  readonly currentPageTitle = computed(() => {
    const page = this.document()?.pages.find(item => item.pageNumber === this.renderedPageNumber());
    return page?.heading || this.slideIndicator();
  });
  readonly labels = computed(() => {
    const ar = this.localization.currentLanguage() === 'ar';
    return {
      back: ar ? 'رجوع' : 'Back',
      pageEyebrow: ar ? 'اشرح ملف' : 'Explain File',
      pageTitle: ar ? 'افتح الملف مع المعلم الذكي' : 'Open a file with Smart Tutor',
      pageSubtitle: ar
        ? 'واجهة هادئة ومباشرة لدراسة ملفات PDF، مع شرح بسيط للصفحة الحالية يتجدد تلقائيًا أثناء القراءة.'
        : 'A calm study workspace for PDF files, with a focused explanation sidebar that updates automatically with the current page.',
      uploadCta: ar ? 'اختر ملف PDF' : 'Choose a PDF file',
      uploadHint: ar ? 'ملف واحد فقط في المرحلة الحالية' : 'One PDF file for this first version',
      removeFile: ar ? 'إزالة الملف' : 'Remove file',
      languageLabel: ar ? 'لغة الشرح' : 'Explanation language',
      depthLabel: ar ? 'مستوى الشرح' : 'Explanation depth',
      arabic: ar ? 'العربية' : 'Arabic',
      english: ar ? 'الإنجليزية' : 'English',
      depthSimple: ar ? 'مبسط' : 'Simple',
      depthMedium: ar ? 'متوسط' : 'Medium',
      depthDeep: ar ? 'عميق' : 'Deep',
      preparing: ar ? 'جاري التجهيز...' : 'Preparing...',
      startStudy: ar ? 'ابدأ الدراسة' : 'Start studying',
      backToTutor: ar ? 'العودة للمعلم الذكي' : 'Back to Smart Tutor',
      studyMode: ar ? 'وضع دراسة الملف' : 'File study mode',
      progress: ar ? 'التقدم' : 'Progress',
      documentTab: ar ? 'الملف' : 'Document',
      explanationTab: ar ? 'الشرح' : 'Explanation',
      groundedBadge: ar ? 'مستند إلى الصفحة الحالية' : 'Grounded on this page',
      limitedBadge: ar ? 'النص محدود في هذه الصفحة' : 'Limited text on this page',
      fromPage: ar ? 'من الصفحة' : 'From page',
      simplify: ar ? 'تبسيط' : 'Simplify',
      deepen: ar ? 'تفصيل أكثر' : 'More detail',
      questions: ar ? 'أسئلة' : 'Questions',
      questionPlaceholder: ar ? 'اسأل عن هذه الصفحة...' : 'Ask about this page...',
      questionHint: ar ? 'السؤال سيرتبط بالصفحة الحالية فقط.' : 'Your question will be tied to the current page only.',
      askAboutPage: ar ? 'إرسال' : 'Ask',
      emptyExplanation: ar ? 'سيظهر شرح الصفحة الحالية هنا بشكل تلقائي بعد تجهيزها.' : 'The current page explanation will appear here automatically once it is ready.',
      aiErrorTitle: ar ? 'تعذر توليد الشرح' : 'Could not generate the explanation',
      viewerErrorTitle: ar ? 'تعذر عرض الصفحة' : 'Could not render this page',
      retry: ar ? 'إعادة المحاولة' : 'Retry',
      renderingPage: ar ? 'جاري عرض الصفحة...' : 'Rendering page...',
      readingDocument: ar ? 'جاري قراءة الملف...' : 'Reading document...',
      extractingPages: ar ? 'جاري تجهيز الصفحات...' : 'Preparing pages...',
      changeFile: ar ? 'اختيار ملف آخر' : 'Choose another file'
    };
  });

  constructor() {
    effect(() => {
      if (this.phase() !== 'study') {
        return;
      }

      const document = this.document();
      const currentPage = this.currentPage();
      if (!document) {
        return;
      }

      const maxPage = document.totalPages || 1;
      if (currentPage > maxPage) {
        this.setCurrentPage(maxPage);
        return;
      }

      setTimeout(() => {
        void this.renderCurrentPage(document.documentId, currentPage);
      }, 0);
      void this.ensurePageExplanation('basic');
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.viewportWidth.set(window.innerWidth);
  }

  onViewerScroll(): void {
    const scroller = this.viewerScroller?.nativeElement;
    if (!scroller) {
      return;
    }

    const now = Date.now();
    const currentTop = scroller.scrollTop;
    const delta = currentTop - this.lastViewerScrollTop;
    this.lastViewerScrollTop = currentTop;

    if (this.isRenderingPage() || now < this.scrollNavigationLockUntil) {
      return;
    }

    const maxScrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    if (delta > 0 && maxScrollTop > 0 && currentTop >= maxScrollTop - 12 && this.currentPage() < this.totalPages()) {
      this.scrollNavigationLockUntil = now + 350;
      this.setCurrentPage(this.currentPage() + 1, 'top');
      return;
    }

    if (delta < 0 && currentTop <= 12 && this.currentPage() > 1) {
      this.scrollNavigationLockUntil = now + 350;
      this.setCurrentPage(this.currentPage() - 1, 'bottom');
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] || null;
    if (!file) {
      return;
    }

    this.uploadError.set('');
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.uploadError.set(this.localization.currentLanguage() === 'ar'
        ? 'المرحلة الحالية تدعم PDF فقط.'
        : 'This first version currently supports PDF files only.');
      return;
    }

    this.selectedFile.set(file);
  }

  clearSelectedFile(): void {
    this.selectedFile.set(null);
    this.uploadError.set('');
  }

  async startStudy(): Promise<void> {
    const file = this.selectedFile();
    if (!file) {
      return;
    }

    this.uploadError.set('');
    this.phase.set('preparing');
    this.statusLabel.set(this.labels().readingDocument);
    this.preparationPercent.set(8);
    this.explanationThreads.set({});
    this.explanationRequestCache.clear();
    this.explanationError.set('');
    this.viewerError.set('');
    this.freeQuestion.set('');
    this.mobileTab.set('document');

    try {
      const document = await this.fileStudy.parsePdf(file, {
        onProgress: ({ currentPage, totalPages }) => {
          const ratio = totalPages > 0 ? currentPage / totalPages : 0;
          this.statusLabel.set(this.labels().extractingPages);
          this.preparationPercent.set(Math.max(10, Math.min(92, Math.round(ratio * 92))));
        }
      });

      this.document.set(document);
      this.renderedPageNumber.set(1);
      this.setCurrentPage(1, 'top', true);
      this.phase.set('study');
      this.statusLabel.set('');
      this.preparationPercent.set(100);
    } catch (error) {
      console.error('File study preparation failed', error);
      this.phase.set('upload');
      this.uploadError.set(this.localization.currentLanguage() === 'ar'
        ? 'تعذر تجهيز الملف. حاول ملف PDF آخر أو أعد المحاولة.'
        : 'Could not prepare this file. Try another PDF or retry.');
    }
  }

  resetSession(): void {
    const documentId = this.document()?.documentId;
    if (documentId) {
      this.fileStudy.clearDocument(documentId);
    }
    this.selectedFile.set(null);
    this.phase.set('upload');
    this.document.set(null);
    this.currentPageIndex.set(0);
    this.renderedPageNumber.set(1);
    this.explanationThreads.set({});
    this.explanationRequestCache.clear();
    this.explanationError.set('');
    this.viewerError.set('');
    this.statusLabel.set('');
    this.preparationPercent.set(0);
    this.freeQuestion.set('');
  }

  goToNextPage(): void {
    if (this.currentPage() >= this.totalPages()) {
      return;
    }
    this.setCurrentPage(this.currentPage() + 1, 'top');
  }

  goToPreviousPage(): void {
    if (this.currentPage() <= 1) {
      return;
    }
    this.setCurrentPage(this.currentPage() - 1, 'top');
  }

  jumpToPage(value: string): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return;
    }
    this.setCurrentPage(parsed, 'top');
  }

  rerenderCurrentPage(): void {
    const document = this.document();
    if (!document) {
      return;
    }
    this.viewerError.set('');
    void this.renderCurrentPage(document.documentId, this.currentPage());
  }

  reloadCurrentPageExplanation(): void {
    this.explanationError.set('');
    void this.ensurePageExplanation('basic', undefined, true);
  }

  async runQuickAction(mode: 'simple' | 'detailed' | 'questions'): Promise<void> {
    await this.ensurePageExplanation(mode);
  }

  async submitFreeQuestion(): Promise<void> {
    const question = this.freeQuestion().trim();
    if (!question) {
      return;
    }
    this.freeQuestion.set('');
    await this.ensurePageExplanation('ask', question);
  }

  formatFileSize(size: number): string {
    if (size < 1024 * 1024) {
      return `${Math.round(size / 1024)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  pageJumpLabel(): string {
    return this.localization.currentLanguage() === 'ar' ? 'اذهب' : 'Go';
  }

  private async renderCurrentPage(documentId: string, pageNumber: number): Promise<void> {
    const canvas = this.pdfCanvas?.nativeElement;
    const textLayer = this.textLayer?.nativeElement;
    if (!canvas || !textLayer) {
      return;
    }

    const token = ++this.renderSequence;
    this.isRenderingPage.set(true);
    this.viewerError.set('');

    try {
      await this.fileStudy.renderPageToCanvas(documentId, pageNumber, canvas, textLayer);
      if (token !== this.renderSequence) {
        return;
      }
      this.renderedPageNumber.set(pageNumber);
      this.applyPendingScrollAnchor();
    } catch (error) {
      console.error('File study page render failed', error);
      if (token === this.renderSequence) {
        this.viewerError.set(this.localization.currentLanguage() === 'ar'
          ? 'تعذر عرض الصفحة الحالية. يمكنك إعادة المحاولة أو الانتقال إلى صفحة أخرى.'
          : 'Could not render the current page. You can retry or move to another page.');
      }
    } finally {
      if (token === this.renderSequence) {
        this.isRenderingPage.set(false);
      }
    }
  }

  private async ensurePageExplanation(mode: FileStudyExplainMode, question?: string, forceReload: boolean = false): Promise<void> {
    const document = this.document();
    const pageNumber = this.currentPage();
    if (!document) {
      return;
    }

    const cacheKey = mode === 'ask'
      ? [pageNumber, mode, this.selectedLanguage(), this.selectedStyle(), (question || '').trim().toLowerCase()].join('::')
      : [pageNumber, mode, this.selectedLanguage(), this.selectedStyle()].join('::');
    if (!forceReload && this.explanationRequestCache.has(cacheKey)) {
      if (mode === 'basic') {
        return;
      }
      this.appendEntryForPage(pageNumber, this.explanationRequestCache.get(cacheKey)!);
      return;
    }

    const token = ++this.explanationSequence;
    this.isExplaining.set(true);
    this.explanationError.set('');

    try {
      const response = await this.fileStudy.explainPage({
        documentId: document.documentId,
        pageNumber,
        language: this.selectedLanguage(),
        explainStyle: this.selectedStyle(),
        mode,
        userQuestion: question
      });

      if (token !== this.explanationSequence || pageNumber !== this.currentPage() || document.documentId !== this.document()?.documentId) {
        return;
      }

      const entry: FileStudySidebarEntry = {
        ...response,
        id: `${pageNumber}-${mode}-${question || 'auto'}-${Date.now()}`
      };

      this.explanationRequestCache.set(cacheKey, entry);
      this.appendEntryForPage(pageNumber, entry, mode !== 'ask');
    } catch (error) {
      console.error('File study explanation request failed', error);
      if (token === this.explanationSequence) {
        this.explanationError.set(this.localization.currentLanguage() === 'ar'
          ? 'تعذر توليد شرح الصفحة الحالية الآن. يمكنك إعادة المحاولة أو متابعة القراءة.'
          : 'Could not generate the explanation for this page right now. You can retry or keep reading.');
      }
    } finally {
      if (token === this.explanationSequence) {
        this.isExplaining.set(false);
      }
    }
  }

  private appendEntryForPage(pageNumber: number, entry: FileStudySidebarEntry, replaceBaseEntry: boolean = false): void {
    const state = { ...this.explanationThreads() };
    const current = [...(state[pageNumber] || [])];

    if (replaceBaseEntry) {
      state[pageNumber] = [entry];
    } else {
      const exists = current.some(item => item.mode === entry.mode && item.question === entry.question && item.summary === entry.summary);
      state[pageNumber] = exists ? current : [...current, entry];
    }

    this.explanationThreads.set(state);
  }

  private setCurrentPage(pageNumber: number, scrollAnchor: 'top' | 'bottom' | null = null, force: boolean = false): void {
    const total = this.totalPages();
    const nextPage = Math.max(1, Math.min(pageNumber, total || 1));
    const nextIndex = nextPage - 1;
    if (!force && nextIndex === this.currentPageIndex()) {
      return;
    }

    this.pendingScrollAnchor = scrollAnchor;
    this.currentPageIndex.set(nextIndex);
  }

  private applyPendingScrollAnchor(): void {
    const scroller = this.viewerScroller?.nativeElement;
    if (!scroller || !this.pendingScrollAnchor) {
      return;
    }

    scroller.scrollTop = this.pendingScrollAnchor === 'bottom'
      ? Math.max(0, scroller.scrollHeight - scroller.clientHeight)
      : 0;
    this.lastViewerScrollTop = scroller.scrollTop;
    this.pendingScrollAnchor = null;
  }
}
