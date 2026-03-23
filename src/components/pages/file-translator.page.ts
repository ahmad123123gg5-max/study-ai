import { CommonModule } from '@angular/common';
import { Component, computed, effect, ElementRef, HostListener, inject, OnDestroy, output, signal, ViewChild } from '@angular/core';
import { jsPDF } from 'jspdf';
import { LocalizationService } from '../../services/localization.service';
import { NotificationService } from '../../services/notification.service';
import {
  FileTranslationRequest,
  FileTranslationResult,
  FileTranslatorService,
  StreamingTranslationEvent,
  TranslationUnit,
  ViewMode
} from '../../services/file-translator.service';

type ScreenMode = 'setup' | 'workspace';
type PipelineStage = 'idle' | 'uploading' | 'extracting' | 'translating' | 'preview';
type MobileCompareMode = 'split' | 'original' | 'translated';
type PdfFitMode = 'width' | 'page' | 'custom';
type TranslationDisplayMode = 'bilingual' | 'translated' | 'side-by-side';

interface RenderedPdfPage {
  url: string;
  width: number;
  height: number;
}

interface ImmersiveBlockView {
  id: string;
  kind: TranslationUnit['kind'];
  sourceText: string;
  translatedText: string;
  tableData?: TranslationUnit['tableData'];
}

@Component({
  selector: 'app-file-translator-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="translator-shell min-h-screen px-4 py-6 md:px-8 md:py-8" [dir]="isRtl() ? 'rtl' : 'ltr'">
      @if (screenMode() === 'setup') {
        <div class="mx-auto max-w-3xl space-y-6">
          <div class="toolbar-group">
            <button (click)="handleBack()" class="nav-btn nav-btn-ghost">{{ t('رجوع') }}</button>
          </div>

          <section class="hero-card rounded-[2rem] border border-white/10 p-6 text-center md:p-8">
            <span class="hero-badge"><i class="fa-solid fa-language"></i>{{ t('Smart File Translator') }}</span>
            <h1 class="mt-4 text-3xl font-black tracking-tight text-white md:text-5xl">{{ t('ترجمة ملفات احترافية') }}</h1>
            <p class="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              {{ t('هذه الصفحة مخصصة لترجمة الملفات فقط. ارفع الملف، اختر اللغة الهدف، وسيتم تجهيز نسخة مترجمة تحافظ على بنية الصفحة قدر الإمكان.') }}
            </p>
          </section>

          <section class="rounded-[2rem] border border-white/10 bg-slate-950/60 p-5 md:p-6">
            <div class="space-y-5">
              <div class="rounded-[1.5rem] border border-dashed border-cyan-400/20 bg-cyan-400/5 p-5">
                <input #filePicker class="hidden" type="file" accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation" (change)="onFileSelected($event)">
                <button (click)="filePicker.click()" class="flex w-full flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-white/10 bg-slate-900/70 px-5 py-10 text-center transition hover:border-cyan-400/30 hover:bg-white/5">
                  <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300"><i class="fa-solid fa-file-arrow-up text-2xl"></i></span>
                  <div>
                    <p class="font-black text-white">{{ selectedFile()?.name || t('اختر ملفًا للترجمة') }}</p>
                    <p class="mt-1 text-xs text-slate-400">{{ t('PDF / DOCX / PPTX') }}</p>
                  </div>
                </button>
                @if (selectedFile()) {
                  <div class="selected-file-card mt-4">
                    <div>
                      <p class="selected-file-title">{{ t('الملف المحدد') }}</p>
                      <p class="selected-file-name">{{ selectedFile()!.name }}</p>
                    </div>
                    <div class="selected-file-meta">
                      <span>{{ selectedFileExtension() }}</span>
                      <span>{{ selectedFileSizeLabel() }}</span>
                    </div>
                  </div>
                }
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <label class="field">
                  <span>{{ t('لغة الملف') }}</span>
                  <div class="simple-static-field">{{ t('تلقائي') }}</div>
                </label>
                <label class="field">
                  <span>{{ t('اللغة الهدف') }}</span>
                  <select [value]="targetLanguage()" (change)="targetLanguage.set($any($event.target).value)">
                    @for (lang of languages; track lang.code) {
                      <option [value]="lang.code">{{ lang.label }}</option>
                    }
                  </select>
                </label>
              </div>

              <button (click)="startTranslationNow()" [disabled]="isBusy() || !selectedFile()" class="primary-btn">
                <i class="fa-solid" [class.fa-spinner]="isBusy()" [class.animate-spin]="isBusy()" [class.fa-wand-magic-sparkles]="!isBusy()"></i>
                {{ isBusy() ? activeStatusLabel() : t('ابدأ الترجمة') }}
              </button>

              @if (errorMessage()) {
                <div class="rounded-[1.25rem] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                  <p class="font-black">{{ t('حدث خطأ أثناء المعالجة') }}</p>
                  <p class="mt-2 leading-7">{{ errorMessage() }}</p>
                </div>
              }
            </div>
          </section>
        </div>
      } @else {
        <div class="mx-auto max-w-[1600px] space-y-5">
          <section class="workspace-hero">
            <div>
              <span class="hero-badge"><i class="fa-solid fa-file-lines"></i>{{ t('صفحة ترجمة الملفات') }}</span>
              <h2>{{ selectedFile()?.name || t('ملف بدون اسم') }}</h2>
              <p>{{ t('عرض أصل الملف والترجمة بشكل متقابل مع جودة PDF أفضل، تنقل أوضح، وتحكم بالتكبير والتصغير.') }}</p>
            </div>
            <div class="hero-stats">
              <div class="stat"><span>{{ t('النوع') }}</span><strong>{{ selectedFileExtension() }}</strong></div>
              <div class="stat"><span>{{ t('اللغة الهدف') }}</span><strong>{{ displayTargetLanguage() }}</strong></div>
              <div class="stat"><span>{{ t('الصفحة الحالية') }}</span><strong>{{ currentPageNumber() }} / {{ totalPageCount() || 1 }}</strong></div>
            </div>
          </section>

          <section class="toolbar">
            <div class="toolbar-group">
              <button (click)="handleBack()" class="nav-btn nav-btn-ghost">{{ t('رجوع') }}</button>
              <button (click)="goPrev()" [disabled]="currentGroupIndex() <= 0" class="nav-btn">{{ t('السابق') }}</button>
              <button (click)="goNext()" [disabled]="currentGroupIndex() >= maxGroupIndex()" class="nav-btn">{{ t('التالي') }}</button>
            </div>

            <div class="toolbar-group">
              @if (totalPageCount() > 0) {
                <label class="page-jump-wrap">
                  <span>{{ t('اذهب إلى') }}</span>
                  <input #pageJumpInput class="page-jump-input" type="number" min="1" [max]="totalPageCount()" [value]="currentPageNumber()" (keydown.enter)="jumpToPage(pageJumpInput.value)">
                </label>
                <button (click)="jumpToPage(pageJumpInput.value)" class="nav-btn">{{ t('اذهب') }}</button>
                <span class="page-count-label">{{ currentPageNumber() }} / {{ totalPageCount() }}</span>
              }
            </div>

            @if (isPdfFile()) {
              <div class="toolbar-group">
                <button (click)="setFitMode('width')" class="nav-btn" [class.nav-btn-active]="viewerFitMode() === 'width'">{{ t('ملء العرض') }}</button>
                <button (click)="setFitMode('page')" class="nav-btn" [class.nav-btn-active]="viewerFitMode() === 'page'">{{ t('ملء الصفحة') }}</button>
                <button (click)="zoomOut()" class="nav-btn"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
                <button (click)="zoomIn()" class="nav-btn"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
                <button (click)="resetZoom()" class="nav-btn nav-btn-ghost">{{ zoomLabel() }}</button>
              </div>
            }
          </section>

          <section class="translation-mode-bar">
            <span class="mode-bar-label">{{ t('وضع عرض الترجمة') }}</span>
            <div class="translation-mode-group">
              <button (click)="translationDisplayMode.set('bilingual')" class="nav-btn" [class.nav-btn-active]="translationDisplayMode() === 'bilingual'">{{ t('ثنائي متتابع') }}</button>
              <button (click)="translationDisplayMode.set('translated')" class="nav-btn" [class.nav-btn-active]="translationDisplayMode() === 'translated'">{{ t('الترجمة فقط') }}</button>
              <button (click)="translationDisplayMode.set('side-by-side')" class="nav-btn" [class.nav-btn-active]="translationDisplayMode() === 'side-by-side'">{{ t('نصان متقابلان') }}</button>
            </div>
          </section>

          @if (isPdfFile()) {
            <section class="mobile-toggle">
              <button (click)="mobileCompareMode.set('original')" [class.is-active]="mobileCompareMode() === 'original'">{{ t('الأصل') }}</button>
              <button (click)="mobileCompareMode.set('translated')" [class.is-active]="mobileCompareMode() === 'translated'">{{ t('الترجمة') }}</button>
              <button (click)="mobileCompareMode.set('split')" [class.is-active]="mobileCompareMode() === 'split'">{{ t('مقارنة') }}</button>
            </section>
          }

          <div class="compare-grid" [class.mobile-original-only]="mobileCompareMode() === 'original'" [class.mobile-translated-only]="mobileCompareMode() === 'translated'">
            <article class="compare-card original-card">
              <div class="compare-head">
                <div>
                  <p>{{ t('الملف الأصلي') }}</p>
                  <span>{{ currentPageLabel() }}</span>
                </div>
                @if (isPdfFile()) { <strong class="compare-chip">{{ t('PDF واضح') }}</strong> }
              </div>
              <div class="compare-body" [class.fit-page]="viewerFitMode() === 'page'">
                @if (isPdfFile()) {
                  @if (originalPageImageUrl()) {
                    <div #originalPageStage class="page-stage" [class.fit-page]="viewerFitMode() === 'page'">
                      <div class="page-sheet" [class.fit-page]="viewerFitMode() === 'page'">
                        <img class="page-image" [src]="originalPageImageUrl()!" [alt]="selectedFile()?.name || 'original page'">
                      </div>
                    </div>
                  } @else {
                    <div class="translation-loader-shell"><div class="translation-loader-spinner"></div><p class="processing-title">{{ t('جاري تجهيز الصفحة الأصلية...') }}</p></div>
                  }
                } @else if (currentGroup()) {
                  <div class="document-sheet">
                    <div class="document-sheet-head">{{ currentPageLabel() }}</div>
                    <div class="document-sheet-body prose-text" dir="auto">{{ currentGroup()!.sourceText }}</div>
                  </div>
                } @else {
                  <div class="translation-loader-shell"><div class="translation-loader-spinner"></div><p class="processing-title">{{ t('جاري قراءة الملف...') }}</p></div>
                }
              </div>
            </article>

            <article class="compare-card translated-card">
              <div class="compare-head">
                <div>
                  <p>{{ t('الترجمة') }}</p>
                  <span>{{ currentPageLabel() }}</span>
                </div>
                <strong class="compare-chip compare-chip-translate">{{ t('Immersive Reading') }}</strong>
              </div>
              <div class="compare-body" [class.fit-page]="viewerFitMode() === 'page'">
                @if (result() && currentGroup() && immersiveBlocks().length) {
                  <div class="immersive-sheet" [class.immersive-side-by-side]="translationDisplayMode() === 'side-by-side'">
                    <div class="immersive-sheet-head">
                      <div>
                        <strong>{{ t('قراءة ترجمة غامرة') }}</strong>
                        <p>{{ t('الترجمة مرتبطة بكل بلوك نصي بنفس تدفق القراءة.') }}</p>
                      </div>
                      <span>{{ currentPageLabel() }}</span>
                    </div>

                    <div class="immersive-sheet-body" [attr.dir]="translationDisplayMode() === 'translated' ? (isTargetLanguageRtl() ? 'rtl' : 'ltr') : 'ltr'">
                      @for (block of immersiveBlocks(); track block.id) {
                        <section
                          class="immersive-block"
                          [class.immersive-block-heading]="block.kind === 'heading'"
                          [class.immersive-block-bullet]="block.kind === 'bullet'"
                          [class.immersive-block-label]="block.kind === 'label'"
                          [class.immersive-block-table]="block.kind === 'table'"
                          [class.immersive-block-side]="translationDisplayMode() === 'side-by-side'"
                        >
                          @if (block.kind === 'table' && block.tableData) {
                            @if (translationDisplayMode() === 'translated') {
                              <div class="immersive-table-scroll" dir="ltr">
                                <table class="immersive-table">
                                  @if (block.tableData.headers.length) {
                                    <thead>
                                      @for (headerRow of block.tableData.headers; track $index) {
                                        <tr>
                                          @for (cell of headerRow; track $index) {
                                            <th>
                                              <div class="table-cell-translation" [attr.dir]="isTargetLanguageRtl() ? 'rtl' : 'ltr'">{{ cell.translatedText }}</div>
                                            </th>
                                          }
                                        </tr>
                                      }
                                    </thead>
                                  }
                                  <tbody>
                                    @for (row of block.tableData.rows; track $index) {
                                      <tr>
                                        @for (cell of row; track $index) {
                                          <td>
                                            <div class="table-cell-translation" [attr.dir]="isTargetLanguageRtl() ? 'rtl' : 'ltr'">{{ cell.translatedText }}</div>
                                          </td>
                                        }
                                      </tr>
                                    }
                                  </tbody>
                                </table>
                              </div>
                            } @else if (translationDisplayMode() === 'side-by-side') {
                              <div class="immersive-table-pair">
                                <div class="immersive-table-panel">
                                  <div class="immersive-table-panel-title">{{ t('الأصل') }}</div>
                                  <div class="immersive-table-scroll" dir="ltr">
                                    <table class="immersive-table">
                                      @if (block.tableData.headers.length) {
                                        <thead>
                                          @for (headerRow of block.tableData.headers; track $index) {
                                            <tr>
                                              @for (cell of headerRow; track $index) {
                                                <th>
                                                  <div class="table-cell-original" dir="auto">{{ cell.sourceText }}</div>
                                                </th>
                                              }
                                            </tr>
                                          }
                                        </thead>
                                      }
                                      <tbody>
                                        @for (row of block.tableData.rows; track $index) {
                                          <tr>
                                            @for (cell of row; track $index) {
                                              <td>
                                                <div class="table-cell-original" dir="auto">{{ cell.sourceText }}</div>
                                              </td>
                                            }
                                          </tr>
                                        }
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                <div class="immersive-table-panel">
                                  <div class="immersive-table-panel-title">{{ t('الترجمة') }}</div>
                                  <div class="immersive-table-scroll" dir="ltr">
                                    <table class="immersive-table">
                                      @if (block.tableData.headers.length) {
                                        <thead>
                                          @for (headerRow of block.tableData.headers; track $index) {
                                            <tr>
                                              @for (cell of headerRow; track $index) {
                                                <th>
                                                  <div class="table-cell-translation" [attr.dir]="isTargetLanguageRtl() ? 'rtl' : 'ltr'">{{ cell.translatedText }}</div>
                                                </th>
                                              }
                                            </tr>
                                          }
                                        </thead>
                                      }
                                      <tbody>
                                        @for (row of block.tableData.rows; track $index) {
                                          <tr>
                                            @for (cell of row; track $index) {
                                              <td>
                                                <div class="table-cell-translation" [attr.dir]="isTargetLanguageRtl() ? 'rtl' : 'ltr'">{{ cell.translatedText }}</div>
                                              </td>
                                            }
                                          </tr>
                                        }
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            } @else {
                              <div class="immersive-table-scroll" dir="ltr">
                                <table class="immersive-table">
                                  @if (block.tableData.headers.length) {
                                    <thead>
                                      @for (headerRow of block.tableData.headers; track $index) {
                                        <tr>
                                          @for (cell of headerRow; track $index) {
                                            <th>
                                              <div class="table-cell-original" dir="auto">{{ cell.sourceText }}</div>
                                              <div class="table-cell-translation" [attr.dir]="isTargetLanguageRtl() ? 'rtl' : 'ltr'">{{ cell.translatedText }}</div>
                                            </th>
                                          }
                                        </tr>
                                      }
                                    </thead>
                                  }
                                  <tbody>
                                    @for (row of block.tableData.rows; track $index) {
                                      <tr>
                                        @for (cell of row; track $index) {
                                          <td>
                                            <div class="table-cell-original" dir="auto">{{ cell.sourceText }}</div>
                                            <div class="table-cell-translation" [attr.dir]="isTargetLanguageRtl() ? 'rtl' : 'ltr'">{{ cell.translatedText }}</div>
                                          </td>
                                        }
                                      </tr>
                                    }
                                  </tbody>
                                </table>
                              </div>
                            }
                          } @else if (translationDisplayMode() === 'translated') {
                            <div class="immersive-translated-only" [attr.dir]="isTargetLanguageRtl() ? 'rtl' : 'ltr'">
                              <p>{{ block.translatedText }}</p>
                            </div>
                          } @else if (translationDisplayMode() === 'side-by-side') {
                            <div class="immersive-columns">
                              <div class="immersive-column immersive-source" dir="auto">
                                <p>{{ block.sourceText }}</p>
                              </div>
                              <div class="immersive-column immersive-translation" [attr.dir]="isTargetLanguageRtl() ? 'rtl' : 'ltr'">
                                <p>{{ block.translatedText }}</p>
                              </div>
                            </div>
                          } @else {
                            <div class="immersive-stack">
                              <div class="immersive-source" dir="auto">
                                <p>{{ block.sourceText }}</p>
                              </div>
                              <div class="immersive-translation" [attr.dir]="isTargetLanguageRtl() ? 'rtl' : 'ltr'">
                                <p>{{ block.translatedText }}</p>
                              </div>
                            </div>
                          }
                        </section>
                      }
                    </div>
                  </div>
                } @else {
                  <div class="translation-loader-shell">
                    <div class="translation-loader-spinner"></div>
                    <p class="processing-title">{{ t('جاري بناء الصفحة المترجمة...') }}</p>
                    <p class="processing-subtitle">{{ stageText() || activeStatusLabel() }}</p>
                  </div>
                }
              </div>
            </article>
          </div>

          <section class="footer-card">
            <div class="footer-meta">
              <span>{{ t('الإجمالي') }}: {{ totalPageCount() || currentUnits().length || 0 }}</span>
              <span>{{ t('الحالة') }}: {{ stageText() || activeStatusLabel() }}</span>
            </div>
            <div class="footer-actions">
              <button (click)="downloadTranslatedOnly()" [disabled]="downloadBusy() || !result()?.isComplete" class="export-btn">{{ t('تحميل النسخة المترجمة') }}</button>
              <button (click)="downloadBilingual()" [disabled]="downloadBusy() || !result()?.isComplete" class="export-btn export-btn-secondary">{{ t('تحميل نسخة ثنائية اللغة') }}</button>
            </div>
          </section>
        </div>
      }
    </div>
  `,
  styles: [`
    :host{display:block}.translator-shell{background:radial-gradient(circle at top right,rgba(6,182,212,.18),transparent 32%),radial-gradient(circle at bottom left,rgba(59,130,246,.16),transparent 28%),linear-gradient(180deg,#04111f 0%,#020617 100%);color:#e2e8f0}.hero-card,.workspace-hero{background:linear-gradient(135deg,rgba(8,47,73,.95),rgba(15,23,42,.9));box-shadow:0 24px 80px rgba(2,6,23,.45)}.hero-badge{display:inline-flex;align-items:center;gap:.55rem;border-radius:999px;border:1px solid rgba(34,211,238,.22);background:rgba(34,211,238,.1);padding:.5rem .9rem;color:#cffafe;font-size:.74rem;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.field{display:grid;gap:.65rem}.field span,.selected-file-title{font-size:.72rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#94a3b8}.field select,.simple-static-field{border:1px solid rgba(255,255,255,.08);background:rgba(15,23,42,.9);color:#fff;border-radius:1rem;padding:.9rem 1rem;width:100%}.selected-file-card{display:flex;justify-content:space-between;gap:1rem;align-items:center;border-radius:1rem;border:1px solid rgba(34,211,238,.16);background:rgba(8,47,73,.4);padding:.9rem 1rem}.selected-file-name{margin-top:.35rem;color:#fff;font-weight:800;word-break:break-word}.selected-file-meta{color:#cbd5e1;font-size:.84rem;font-weight:700;display:flex;gap:.8rem;flex-wrap:wrap}.primary-btn{display:flex;width:100%;align-items:center;justify-content:center;gap:.75rem;border-radius:1.4rem;background:linear-gradient(90deg,#06b6d4,#3b82f6);padding:1rem 1.25rem;color:#020617;font-weight:900}.workspace-hero{border:1px solid rgba(255,255,255,.08);border-radius:2rem;padding:1.35rem;display:grid;gap:1.15rem}.workspace-hero h2{margin:.9rem 0 0;color:#fff;font-size:clamp(1.5rem,2vw,2.25rem);font-weight:900;word-break:break-word}.workspace-hero p{margin:.8rem 0 0;color:#cbd5e1;line-height:1.85;max-width:70ch}.hero-stats{display:grid;gap:.85rem;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.stat{border-radius:1.25rem;border:1px solid rgba(255,255,255,.08);background:rgba(15,23,42,.72);padding:1rem 1.05rem;display:grid;gap:.35rem}.stat span{font-size:.72rem;color:#94a3b8;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.stat strong{color:#fff;font-size:1rem;font-weight:900}.toolbar{display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap}.toolbar-group{display:flex;align-items:center;gap:.7rem;flex-wrap:wrap}.translation-mode-bar{display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap}.translation-mode-group{display:flex;gap:.7rem;flex-wrap:wrap}.mode-bar-label{color:#cbd5e1;font-weight:900;font-size:.88rem}.page-jump-wrap{display:inline-flex;align-items:center;gap:.6rem;color:#cbd5e1;font-weight:800}.page-jump-input{width:96px;border-radius:.95rem;border:1px solid rgba(255,255,255,.08);background:rgba(15,23,42,.82);color:#fff;padding:.82rem .9rem;text-align:center;font-weight:800}.page-count-label{color:#cbd5e1;font-weight:900;font-size:.95rem}.nav-btn,.export-btn{border-radius:1rem;border:1px solid rgba(255,255,255,.08);background:rgba(15,23,42,.86);color:#fff;padding:.9rem 1rem;font-weight:800}.nav-btn-active{border-color:rgba(34,211,238,.4);background:rgba(34,211,238,.14);color:#ecfeff}.nav-btn-ghost{background:rgba(2,6,23,.58)}.mobile-toggle{display:none;gap:.5rem;grid-template-columns:repeat(3,minmax(0,1fr))}.mobile-toggle button{border-radius:1rem;border:1px solid rgba(255,255,255,.08);background:rgba(15,23,42,.86);color:#cbd5e1;padding:.85rem .9rem;font-weight:900}.mobile-toggle .is-active{border-color:rgba(34,211,238,.35);background:rgba(34,211,238,.12);color:#fff}.compare-grid{display:grid;gap:1.1rem;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)}@media (max-width:1099px){.compare-grid{grid-template-columns:minmax(0,1fr)}}.compare-card{border:1px solid rgba(255,255,255,.08);background:rgba(2,6,23,.78);border-radius:1.9rem;overflow:hidden;min-height:84vh;display:flex;flex-direction:column}.compare-head{display:flex;justify-content:space-between;gap:1rem;align-items:center;padding:1.1rem 1.25rem;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(15,23,42,.92);color:#fff}.compare-head p{margin:0;font-size:1rem;font-weight:900}.compare-head span{display:block;margin-top:.25rem;color:#cbd5e1;font-size:.86rem;font-weight:700}.compare-chip{border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);padding:.45rem .8rem;font-size:.72rem;font-weight:900;color:#cbd5e1;white-space:nowrap}.compare-chip-translate{color:#e9d5ff;border-color:rgba(216,180,254,.18);background:rgba(88,28,135,.18)}.compare-body{padding:.45rem;overflow:auto;display:grid;gap:.75rem;flex:1;align-content:stretch;background:linear-gradient(180deg,rgba(15,23,42,.45),rgba(2,6,23,.22))}.page-stage{width:100%;min-height:calc(84vh - 120px);height:100%;display:flex;justify-content:flex-start;align-items:flex-start;overflow:auto;border-radius:1rem;background:linear-gradient(180deg,#0f172a 0%,#111827 100%);border:1px solid rgba(255,255,255,.06);padding:.1rem}.page-stage.fit-page{justify-content:center;align-items:flex-start}.page-sheet{flex:0 0 auto;min-width:100%;width:max-content;max-width:none;background:#fff;overflow:visible}.page-sheet.fit-page{min-width:0;width:max-content;max-width:none;max-height:none}.page-image{display:block;max-width:none;width:auto;height:auto;background:#fff}.document-sheet{width:100%;min-height:calc(84vh - 120px);margin:0 auto;background:#fff;border-radius:1rem;overflow:hidden;border:1px solid rgba(15,23,42,.08)}.document-sheet-head{background:linear-gradient(135deg,#34c3d7,#2aa6d4);color:#fff;padding:1rem 1.25rem;font-weight:900}.document-sheet-body{color:#0f172a;padding:2rem;line-height:1.95}.immersive-sheet{width:100%;min-height:calc(84vh - 120px);margin:0 auto;background:#fff;border-radius:1rem;overflow:hidden}.immersive-sheet-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;padding:1rem 1.25rem;border-bottom:1px solid rgba(226,232,240,.9);background:#fff}.immersive-sheet-head strong{display:block;color:#0f172a;font-size:1rem}.immersive-sheet-head p{margin:.35rem 0 0;color:#64748b;line-height:1.7;font-size:.9rem}.immersive-sheet-head span{color:#475569;font-weight:800}.immersive-sheet-body{padding:1.75rem 1.9rem;display:grid;gap:0}.immersive-block{padding:0 0 1.1rem;margin:0 0 1.1rem;border-bottom:0}.immersive-block:last-child{margin-bottom:0;padding-bottom:0}.immersive-block-heading .immersive-source p{font-size:1.14rem;font-weight:700;line-height:1.72}.immersive-block-heading .immersive-translation p,.immersive-block-heading .immersive-translated-only p{font-size:1.04rem;font-weight:600;line-height:1.76}.immersive-block-bullet .immersive-source p::before,.immersive-block-bullet .immersive-translation p::before,.immersive-block-bullet .immersive-translated-only p::before{content:'• ';color:inherit}.immersive-block-label .immersive-source p,.immersive-block-label .immersive-translation p,.immersive-block-label .immersive-translated-only p{font-weight:700}.immersive-stack,.immersive-columns{display:grid}.immersive-stack{gap:.55rem}.immersive-columns{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1.35rem}.immersive-column{padding:0;border:0;background:transparent}.immersive-source{color:#0f172a}.immersive-source p,.immersive-translation p,.immersive-translated-only p{margin:0;white-space:pre-wrap;overflow-wrap:break-word;text-wrap:pretty}.immersive-source p{font-weight:650;font-size:1rem;line-height:1.9;letter-spacing:.002em}.immersive-translation{color:#5f6774}.immersive-translation p,.immersive-translated-only p{font-size:.95rem;line-height:1.82;letter-spacing:.001em}.immersive-translated-only{color:#334155}.immersive-stack .immersive-source{padding-bottom:0}.immersive-stack .immersive-translation{padding-top:0}.immersive-block-table{margin-top:.35rem}.immersive-table-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1rem}.immersive-table-panel-title{margin-bottom:.55rem;color:#64748b;font-size:.78rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.immersive-table-scroll{overflow:auto}.immersive-table{width:100%;border-collapse:collapse;table-layout:fixed;background:#fff;color:#0f172a}.immersive-table th,.immersive-table td{border:1px solid rgba(148,163,184,.6);padding:.68rem .72rem;vertical-align:top;text-align:left}.immersive-table th{background:#f8fafc;font-weight:700}.table-cell-original,.table-cell-translation{white-space:pre-wrap;overflow-wrap:anywhere}.table-cell-original{font-size:.95rem;line-height:1.72;font-weight:650;color:#0f172a}.table-cell-translation{margin-top:.4rem;font-size:.88rem;line-height:1.7;color:#5f6774}.immersive-table th .table-cell-translation,.immersive-table td .table-cell-translation{margin-top:.34rem}.prose-text{white-space:pre-wrap;overflow-wrap:break-word}.text-block{padding:0 0 1.1rem;margin-bottom:1.1rem;border-bottom:1px solid rgba(148,163,184,.18)}.text-block:last-child{border-bottom:0;margin-bottom:0;padding-bottom:0}.text-block-heading p{font-size:1.2rem;font-weight:900;line-height:1.7}.text-block-label{color:#64748b;font-size:.74rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase;margin-bottom:.55rem}.text-block p{margin:0;white-space:pre-wrap}.translation-loader-shell{display:grid;place-items:center;align-content:center;min-height:620px;text-align:center;padding:1rem;gap:1rem}.translation-loader-spinner{width:72px;height:72px;border-radius:999px;border:4px solid rgba(255,255,255,.12);border-top-color:#22d3ee;border-right-color:#38bdf8;animation:translator-spin .9s linear infinite}@keyframes translator-spin{to{transform:rotate(360deg)}}.processing-title{color:#fff;font-size:1.1rem;font-weight:900}.processing-subtitle{color:#cbd5e1;line-height:1.8}.footer-card{border-radius:1.6rem;border:1px solid rgba(255,255,255,.08);background:rgba(2,6,23,.72);padding:1rem 1.15rem;display:flex;justify-content:space-between;gap:1rem;align-items:center;flex-wrap:wrap}.footer-meta{display:flex;gap:.9rem;flex-wrap:wrap;color:#cbd5e1;font-weight:800}.footer-actions{display:flex;gap:.8rem;flex-wrap:wrap}.export-btn{background:linear-gradient(135deg,rgba(34,211,238,.18),rgba(59,130,246,.18));border-color:rgba(34,211,238,.2)}.export-btn-secondary{background:rgba(15,23,42,.86)}@media (max-width:1099px){.mobile-toggle{display:grid}.compare-card{min-height:72vh}.page-stage,.document-sheet,.immersive-sheet{min-height:calc(72vh - 88px)}.immersive-columns,.immersive-table-pair{grid-template-columns:minmax(0,1fr)}.compare-grid.mobile-original-only .translated-card,.compare-grid.mobile-translated-only .original-card{display:none}}@media (max-width:767px){.document-sheet-body,.immersive-sheet-body{padding:1rem}.page-stage{padding:.08rem}.compare-chip{display:none}.translation-mode-bar{align-items:flex-start}.translation-mode-group{width:100%}.translation-mode-group .nav-btn{flex:1 1 180px}.immersive-source p{font-size:.98rem;line-height:1.86}.immersive-translation p,.immersive-translated-only p{font-size:.93rem;line-height:1.8}.immersive-table th,.immersive-table td{padding:.58rem}}
  `]
})
export class FileTranslatorPage implements OnDestroy {
  private readonly localization = inject(LocalizationService);
  private readonly notifications = inject(NotificationService);
  private readonly translator = inject(FileTranslatorService);
  @ViewChild('originalPageStage') private originalPageStage?: ElementRef<HTMLDivElement>;

  back = output<void>();
  openTutor = output<void>();
  openFlashcards = output<void>();

  readonly t = (text: string) => this.localization.phrase(text);
  readonly isRtl = computed(() => this.localization.direction() === 'rtl');
  readonly screenMode = signal<ScreenMode>('setup');
  readonly selectedFile = signal<File | null>(null);
  readonly targetLanguage = signal('ar');
  readonly activeStage = signal<PipelineStage>('idle');
  readonly result = signal<FileTranslationResult | null>(null);
  readonly currentGroupIndex = signal(0);
  readonly errorMessage = signal('');
  readonly progressPercent = signal(0);
  readonly progressDetail = signal('');
  readonly stageText = signal('');
  readonly totalGroups = signal(0);
  readonly completedGroups = signal(0);
  readonly totalUnits = signal(0);
  readonly completedUnits = signal(0);
  readonly isStreaming = signal(false);
  readonly downloadBusy = signal(false);
  readonly originalPageImageUrl = signal<string | null>(null);
  readonly translatedPageImageUrl = signal<string | null>(null);
  readonly originalPdfPageCount = signal(0);
  readonly mobileCompareMode = signal<MobileCompareMode>('split');
  readonly viewerFitMode = signal<PdfFitMode>('width');
  readonly viewerZoomPercent = signal(100);
  readonly translationDisplayMode = signal<TranslationDisplayMode>('bilingual');
  readonly viewerResizeTick = signal(0);

  private activeAbortController: AbortController | null = null;
  private currentUploadBase64 = '';
  private progressPulseId: ReturnType<typeof setInterval> | null = null;
  private hasLiveServerEvent = false;
  private originalPageRenderToken = 0;
  private translatedPageRenderToken = 0;
  private pdfDocumentKey: string | null = null;
  private pdfDocumentPromise: Promise<any> | null = null;
  private pdfDocumentRef: any | null = null;
  private readonly originalPageCache = new Map<string, RenderedPdfPage>();
  private readonly translatedPageCache = new Map<string, RenderedPdfPage>();

  readonly isBusy = computed(() => this.activeStage() !== 'idle');
  readonly selectedFileExtension = computed(() => this.selectedFile()?.name.split('.').pop()?.toUpperCase() || 'FILE');
  readonly selectedFileSizeLabel = computed(() => this.formatFileSize(this.selectedFile()?.size || 0));
  readonly isPdfFile = computed(() => this.selectedFileExtension() === 'PDF');
  readonly totalPageCount = computed(() => {
    const result = this.result();
    if (this.isPdfFile()) {
      return Math.max(this.originalPdfPageCount(), result?.totalGroups || result?.groups.length || 0);
    }
    return result?.groups.length || 0;
  });
  readonly currentPageNumber = computed(() => Math.min(Math.max(this.currentGroupIndex() + 1, 1), Math.max(this.totalPageCount(), 1)));
  readonly currentGroup = computed(() => {
    const result = this.result();
    if (!result) return null;
    if (this.isPdfFile()) {
      return result.groups.find((group) => group.index === this.currentPageNumber()) || null;
    }
    return result.groups[this.currentGroupIndex()] || null;
  });
  readonly currentUnits = computed(() => {
    const group = this.currentGroup();
    const result = this.result();
    if (!group || !result) return [] as TranslationUnit[];
    return group.unitIds.map((id) => result.units.find((unit) => unit.id === id)).filter((unit): unit is TranslationUnit => !!unit);
  });
  readonly currentPageLabel = computed(() => {
    if (this.isPdfFile() && this.totalPageCount() > 0) {
      return `${this.t('الصفحة')} ${this.currentPageNumber()}`;
    }
    return this.currentGroup()?.label || this.selectedFile()?.name || this.t('قيد المعالجة');
  });
  readonly immersiveBlocks = computed<ImmersiveBlockView[]>(() =>
    this.currentUnits().map((unit) => ({
      id: unit.id,
      kind: unit.kind,
      sourceText: unit.sourceText,
      translatedText: unit.translatedText,
      tableData: unit.tableData
    }))
  );
  readonly zoomLabel = computed(() => this.viewerFitMode() === 'custom' ? `${this.viewerZoomPercent()}%` : this.viewerFitMode() === 'page' ? this.t('ملء الصفحة') : this.t('ملء العرض'));
  readonly languages = [
    { code: 'ar', label: 'العربية' },
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
    { code: 'es', label: 'Español' }
  ];
  readonly activeStatusLabel = computed(() => ({
    idle: this.t('جاهز'),
    uploading: this.t('جاري تجهيز الملف'),
    extracting: this.t('جاري استخراج النص'),
    translating: this.t('جاري الترجمة'),
    preview: this.t('جاري تجهيز المعاينة')
  }[this.activeStage()]));

  constructor() {
    effect(() => {
      const file = this.selectedFile();
      const pageNumber = this.currentPageNumber();
      this.viewerFitMode();
      this.viewerZoomPercent();
      this.viewerResizeTick();
      if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
        this.originalPageImageUrl.set(null);
        this.translatedPageImageUrl.set(null);
        return;
      }
      void this.renderOriginalPageBackground(file, pageNumber);
      this.translatedPageImageUrl.set(null);
      this.preloadNearbyPages(file, pageNumber);
    });
  }

  ngOnDestroy(): void {
    this.stopProgressPulse();
    this.disposePdfDocument();
    this.clearRenderedPageCaches();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.activeAbortController?.abort();
    this.disposePdfDocument();
    this.clearRenderedPageCaches();
    this.selectedFile.set(file);
    this.result.set(null);
    this.errorMessage.set('');
    this.progressPercent.set(0);
    this.progressDetail.set('');
    this.stageText.set('');
    this.currentGroupIndex.set(0);
    this.currentUploadBase64 = '';
    this.originalPdfPageCount.set(0);
    this.mobileCompareMode.set('split');
    this.viewerFitMode.set('width');
    this.viewerZoomPercent.set(100);
    this.translationDisplayMode.set('bilingual');
    if (file) {
      this.screenMode.set('workspace');
      void this.loadPdfPageCount(file);
      queueMicrotask(() => void this.translateFile());
    }
    input.value = '';
  }

  startTranslationNow() {
    this.screenMode.set('workspace');
    void this.translateFile();
  }

  async translateFile() {
    const file = this.selectedFile();
    if (!file) return;
    this.activeAbortController?.abort();
    this.activeAbortController = new AbortController();
    this.result.set(null);
    this.errorMessage.set('');
    this.activeStage.set('uploading');
    this.isStreaming.set(true);
    this.progressPercent.set(2);
    this.progressDetail.set(`${file.name} • ${this.formatFileSize(file.size)}`);
    this.stageText.set(this.t('جاري تجهيز الملف وبدء الترجمة...'));
    this.totalGroups.set(0);
    this.completedGroups.set(0);
    this.totalUnits.set(0);
    this.completedUnits.set(0);
    this.hasLiveServerEvent = false;
    this.startProgressPulse();

    try {
      const base64Data = await this.translator.fileToBase64(file);
      this.currentUploadBase64 = base64Data;
      this.progressPercent.set(Math.max(this.progressPercent(), 8));
      const baseRequest: FileTranslationRequest = {
        fileName: file.name,
        mimeType: file.type || this.detectMimeType(file.name),
        base64Data,
        sourceLanguage: 'auto',
        targetLanguage: this.targetLanguage(),
        translationMode: 'general',
        keepEnglishTerms: false,
        viewMode: this.resolveDefaultViewMode(file.name),
        glossaryEntries: [],
        ocrPageImages: []
      };
      const previewResult = await Promise.race([
        this.translator.translate({ ...baseRequest, previewGroupLimit: 1 }),
        new Promise<FileTranslationResult>((_, reject) => {
          setTimeout(() => reject(new Error('PREVIEW_TIMEOUT')), 20000);
        })
      ]);
      const hydratedPreview = { ...previewResult, originalBufferBase64: previewResult.originalBufferBase64 || this.currentUploadBase64 };
      this.result.set(hydratedPreview);
      this.currentGroupIndex.set(0);
      this.completedGroups.set(Math.max(1, hydratedPreview.groups.length));
      this.totalGroups.set(Math.max(hydratedPreview.groups.length, this.totalGroups()));
      this.completedUnits.set(hydratedPreview.units.length);
      this.totalUnits.set(Math.max(hydratedPreview.units.length, this.totalUnits()));
      this.activeStage.set('translating');
      this.stageText.set(this.t('تم عرض أول صفحة، وجارٍ استكمال بقية الصفحات...'));
      this.progressDetail.set(this.t('يتم الآن إكمال الترجمة لبقية الملف في الخلفية.'));
      this.progressPercent.set(Math.max(this.progressPercent(), 35));

      const finalResult = await this.fetchFullTranslation(baseRequest);
      this.result.set({ ...finalResult, originalBufferBase64: finalResult.originalBufferBase64 || this.currentUploadBase64 });
      if ((finalResult.groups?.length || 0) > 0) {
        this.currentGroupIndex.set(Math.min(this.currentGroupIndex(), Math.max(0, finalResult.groups.length - 1)));
      }
      this.totalGroups.set(finalResult.totalGroups || finalResult.groups.length);
      this.completedGroups.set(finalResult.totalGroups || finalResult.groups.length);
      this.totalUnits.set(finalResult.totalUnits || finalResult.units.length);
      this.completedUnits.set(finalResult.totalUnits || finalResult.units.length);
      this.stageText.set(this.t('اكتملت الترجمة بالكامل'));
      this.progressDetail.set(this.t('أصبحت كل الصفحات متاحة الآن للتنقل المباشر.'));
      this.notifications.show(this.t('الترجمة جاهزة'), this.t('تم تجهيز الترجمة بنجاح.'), 'success', 'fa-language');
    } catch (error) {
      const message = error instanceof Error && error.message === 'PREVIEW_TIMEOUT'
        ? this.t('تأخر تجهيز أول صفحة أكثر من المتوقع. حاول إعادة المحاولة أو استخدم ملفًا أخف قليلًا.')
        : error instanceof Error ? error.message : this.t('تعذر إكمال الترجمة.');
      this.errorMessage.set(message);
      this.notifications.show(this.t('فشل الترجمة'), message, 'error', 'fa-triangle-exclamation');
    } finally {
      this.stopProgressPulse();
      this.isStreaming.set(false);
      this.activeStage.set('idle');
      this.activeAbortController = null;
    }
  }

  private async translateWithRecovery(request: FileTranslationRequest): Promise<FileTranslationResult | null> {
    const streamingTimeoutMs = 8000;
    try {
      return await Promise.race([
        this.translator.streamTranslate(request, { onEvent: (event) => this.handleStreamingEvent(event) }, this.activeAbortController?.signal),
        new Promise<null>((_, reject) => {
          setTimeout(() => {
            if (!this.hasLiveServerEvent) reject(new Error('STREAM_TIMEOUT'));
          }, streamingTimeoutMs);
        })
      ]);
    } catch (error) {
      this.progressPercent.set(Math.max(this.progressPercent(), 20));
      this.stageText.set(this.t('التحويل إلى المسار الاحتياطي'));
      this.progressDetail.set(
        error instanceof Error && error.message === 'STREAM_TIMEOUT'
          ? this.t('لم يصل بث مباشر من السيرفر، جارٍ إكمال الترجمة عبر المسار العادي.')
          : this.t('تعذر إكمال البث المباشر، جارٍ المحاولة عبر المسار العادي.')
      );
      return this.translator.translate(request);
    }
  }

  private async fetchFullTranslation(request: FileTranslationRequest): Promise<FileTranslationResult> {
    try {
      const translated = await this.translator.translate(request);
      const groupCount = translated.groups?.length || 0;
      const unitCount = translated.units?.length || 0;
      const totalGroups = translated.totalGroups || groupCount;
      const totalUnits = translated.totalUnits || unitCount;
      const completedGroups = translated.completedGroups || groupCount;
      if (
        translated.isComplete === false ||
        !groupCount ||
        !unitCount ||
        totalGroups > groupCount ||
        totalUnits > unitCount ||
        completedGroups < totalGroups
      ) {
        throw new Error('INCOMPLETE_FINAL_RESULT');
      }
      return translated;
    } catch {
      const streamed = await this.translateWithRecovery(request);
      if (!streamed) throw new Error(this.t('تعذر جلب كل صفحات الترجمة.'));
      return streamed;
    }
  }

  private handleStreamingEvent(event: StreamingTranslationEvent) {
    this.hasLiveServerEvent = true;
    this.stopProgressPulse();
    if (event.type === 'job_started') {
      this.progressPercent.set(Math.max(this.progressPercent(), 12));
      this.stageText.set(this.t('تم استلام الملف وبدأت المعالجة'));
      return;
    }
    if (event.type === 'progress') {
      this.progressPercent.set(Math.max(10, Math.min(100, Math.round(event.percent || 0))));
      this.progressDetail.set(event.detail || '');
      this.stageText.set(event.stageLabel || this.activeStatusLabel());
      this.totalGroups.set(event.totalGroups || this.totalGroups());
      this.completedGroups.set(event.completedGroups || this.completedGroups());
      this.totalUnits.set(event.totalUnits || this.totalUnits());
      this.completedUnits.set(event.completedUnits || this.completedUnits());
      if (event.stage === 'extracting') this.activeStage.set('extracting');
      if (event.stage === 'translating' || event.stage === 'cache') this.activeStage.set('translating');
      if (event.stage === 'preview') this.activeStage.set('preview');
      return;
    }
    if (event.type === 'group_ready' && event.group && event.units) {
      const previous = this.result() || this.createEmptyResult();
      const groups = Array.from(new Map([...previous.groups, event.group].map((group) => [group.index, group])).values()).sort((a, b) => a.index - b.index);
      const units = Array.from(new Map([...previous.units, ...event.units].map((unit) => [unit.id, unit])).values()).sort((a, b) => a.order - b.order);
      this.result.set({ ...previous, groups, units, totalGroups: event.totalGroups || groups.length, totalUnits: event.totalUnits || units.length });
      if (groups.length === 1) this.currentGroupIndex.set(0);
      return;
    }
    if (event.type === 'complete' && event.result) {
      this.progressPercent.set(100);
      this.stageText.set(this.t('اكتملت الترجمة'));
      this.result.set({ ...event.result, originalBufferBase64: event.result.originalBufferBase64 || this.currentUploadBase64 });
      if ((event.result.groups?.length || 0) > 0) {
        this.currentGroupIndex.set(Math.min(this.currentGroupIndex(), Math.max(0, event.result.groups.length - 1)));
      }
    }
  }

  private createEmptyResult(): FileTranslationResult {
    return {
      documentId: `draft-${Date.now()}`,
      fileName: this.selectedFile()?.name || 'translation',
      fileType: this.resolveDefaultViewMode(this.selectedFile()?.name || '') === 'slide' ? 'pptx' : this.selectedFileExtension() === 'DOCX' ? 'docx' : 'pdf',
      sourceLanguage: 'auto',
      targetLanguage: this.targetLanguage(),
      translationMode: 'general',
      viewMode: this.resolveDefaultViewMode(this.selectedFile()?.name || ''),
      keepEnglishTerms: false,
      warnings: [],
      units: [],
      groups: [],
      totalGroups: 0,
      totalUnits: 0,
      originalBufferBase64: this.currentUploadBase64,
      isComplete: false,
      cacheStatus: 'miss'
    };
  }

  goPrev() { this.currentGroupIndex.update((value) => Math.max(0, value - 1)); }
  goNext() { this.currentGroupIndex.update((value) => Math.min(this.maxGroupIndex(), value + 1)); }
  jumpToPage(value: string | number) {
    const total = this.totalPageCount();
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > total) return;
    this.currentGroupIndex.set(parsed - 1);
  }
  maxGroupIndex() { return Math.max(0, this.totalPageCount() - 1); }
  handleBack() { this.back.emit(); }
  setFitMode(mode: PdfFitMode) {
    this.viewerFitMode.set(mode);
    if (mode !== 'custom') this.viewerZoomPercent.set(100);
    this.clearRenderedPageCaches();
    this.viewerResizeTick.update((value) => value + 1);
  }
  zoomIn() {
    const next = Math.min(240, this.viewerFitMode() === 'custom' ? this.viewerZoomPercent() + 15 : 115);
    this.viewerFitMode.set('custom');
    this.viewerZoomPercent.set(next);
    this.clearRenderedPageCaches();
    this.viewerResizeTick.update((value) => value + 1);
  }
  zoomOut() {
    const next = Math.max(60, (this.viewerFitMode() === 'custom' ? this.viewerZoomPercent() : 100) - 15);
    this.viewerFitMode.set('custom');
    this.viewerZoomPercent.set(next);
    this.clearRenderedPageCaches();
    this.viewerResizeTick.update((value) => value + 1);
  }
  resetZoom() {
    this.viewerFitMode.set('width');
    this.viewerZoomPercent.set(100);
    this.clearRenderedPageCaches();
    this.viewerResizeTick.update((value) => value + 1);
  }
  isTargetLanguageRtl(): boolean { return /^(ar|he|ur)\b/i.test(this.targetLanguage()); }
  async downloadTranslatedOnly() { await this.download('translated'); }
  async downloadBilingual() { await this.download('bilingual'); }

  private async download(format: 'translated' | 'bilingual') {
    const result = this.result();
    if (!result) return;
    this.downloadBusy.set(true);
    try {
      if (result.fileType === 'pdf' && this.selectedFile()) {
        const exported = await this.exportDisplayedPdf(format);
        this.translator.downloadBlob(exported.blob, exported.fileName);
        return;
      }
      const exported = await this.translator.export(result, format);
      this.translator.downloadBlob(exported.blob, exported.fileName);
    } finally {
      this.downloadBusy.set(false);
    }
  }

  private async exportDisplayedPdf(format: 'translated' | 'bilingual'): Promise<{ fileName: string; blob: Blob }> {
    const file = this.selectedFile();
    const result = this.result();
    if (!file || !result) throw new Error(this.t('لا يوجد ملف جاهز للتصدير.'));
    const pdfDocument = await this.getPdfDocument(file);
    const exportPdf = new jsPDF({
      orientation: format === 'bilingual' ? 'landscape' : 'portrait',
      unit: 'pt',
      format: 'a4',
      compress: true
    });
    const totalPages = Math.max(this.totalPageCount(), pdfDocument.numPages || 0);
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      if (pageNumber > 1) exportPdf.addPage();
      const originalCanvas = await this.renderPdfCanvasFromDocument(pdfDocument, pageNumber);
      const translatedCanvas = this.buildTranslatedPdfCanvas(originalCanvas, result, pageNumber);
      if (format === 'bilingual') {
        this.drawCanvasIntoPdf(exportPdf, originalCanvas, 36, 36, (exportPdf.internal.pageSize.getWidth() - 108) / 2, exportPdf.internal.pageSize.getHeight() - 72);
        this.drawCanvasIntoPdf(exportPdf, translatedCanvas, exportPdf.internal.pageSize.getWidth() / 2 + 18, 36, (exportPdf.internal.pageSize.getWidth() - 108) / 2, exportPdf.internal.pageSize.getHeight() - 72);
      } else {
        this.drawCanvasIntoPdf(exportPdf, translatedCanvas, 32, 32, exportPdf.internal.pageSize.getWidth() - 64, exportPdf.internal.pageSize.getHeight() - 64);
      }
    }
    const baseName = result.fileName.replace(/\.[^.]+$/, '');
    return { fileName: `${baseName}-${format === 'bilingual' ? 'bilingual' : 'translated'}.pdf`, blob: exportPdf.output('blob') };
  }

  private startProgressPulse() {
    this.stopProgressPulse();
    this.progressPulseId = setInterval(() => {
      if (this.hasLiveServerEvent) return;
      this.progressPercent.update((value) => Math.min(18, value + (value < 10 ? 2 : 1)));
    }, 500);
  }

  private stopProgressPulse() {
    if (this.progressPulseId) {
      clearInterval(this.progressPulseId);
      this.progressPulseId = null;
    }
  }

  private async loadPdfPageCount(file: File): Promise<void> {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      this.originalPdfPageCount.set(0);
      return;
    }
    try {
      const pdfDocument = await this.getPdfDocument(file);
      this.originalPdfPageCount.set(pdfDocument.numPages || 0);
    } catch {
      this.originalPdfPageCount.set(0);
    }
  }

  private async getPdfDocument(file: File): Promise<any> {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (this.pdfDocumentPromise && this.pdfDocumentKey === key) return this.pdfDocumentPromise;
    this.disposePdfDocument();
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = 'assets/pdfjs/build/pdf.worker.min.mjs';
    this.pdfDocumentKey = key;
    this.pdfDocumentPromise = pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
      cMapUrl: 'assets/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'assets/pdfjs/standard_fonts/'
    }).promise.then((documentRef: any) => {
      this.pdfDocumentRef = documentRef;
      return documentRef;
    });
    return this.pdfDocumentPromise;
  }

  private disposePdfDocument() {
    const existing = this.pdfDocumentRef;
    this.pdfDocumentKey = null;
    this.pdfDocumentPromise = null;
    this.pdfDocumentRef = null;
    if (existing?.destroy) void existing.destroy();
  }

  private clearRenderedPageCaches() {
    this.originalPageCache.forEach((entry) => URL.revokeObjectURL(entry.url));
    this.translatedPageCache.forEach((entry) => URL.revokeObjectURL(entry.url));
    this.originalPageCache.clear();
    this.translatedPageCache.clear();
    this.originalPageImageUrl.set(null);
    this.translatedPageImageUrl.set(null);
  }

  private preloadNearbyPages(file: File, pageNumber: number) {
    if (!this.isPdfFile()) return;
    [pageNumber - 1, pageNumber + 1]
      .filter((page) => page >= 1 && page <= this.totalPageCount())
      .forEach((page) => {
        void this.renderOriginalPageBackground(file, page, true);
      });
  }

  private getPdfStageMetrics(): { width: number; height: number } {
    const stage = this.originalPageStage?.nativeElement;
    const measuredWidth = stage?.clientWidth || 0;
    const measuredHeight = stage?.clientHeight || 0;
    return {
      width: Math.max(320, measuredWidth || Math.round(window.innerWidth * 0.56)),
      height: Math.max(420, measuredHeight || Math.round(window.innerHeight * 0.78))
    };
  }

  private getRenderCacheKey(pageNumber: number): string {
    const metrics = this.getPdfStageMetrics();
    const widthBucket = Math.round(metrics.width / 24) * 24;
    const heightBucket = Math.round(metrics.height / 24) * 24;
    const zoomPart = this.viewerFitMode() === 'custom' ? this.viewerZoomPercent() : 100;
    return `${pageNumber}:${this.viewerFitMode()}:${zoomPart}:${widthBucket}x${heightBucket}`;
  }

  private async renderOriginalPageBackground(file: File, pageNumber: number, preload: boolean = false): Promise<void> {
    const cacheKey = this.getRenderCacheKey(pageNumber);
    const cached = this.originalPageCache.get(cacheKey);
    if (cached) {
      if (!preload && pageNumber === this.currentPageNumber()) this.originalPageImageUrl.set(cached.url);
      return;
    }
    const token = ++this.originalPageRenderToken;
    try {
      const pdfDocument = await this.getPdfDocument(file);
      if (!this.originalPdfPageCount()) this.originalPdfPageCount.set(pdfDocument.numPages || 0);
      const rendered = await this.renderPdfPageToImage(pdfDocument, pageNumber);
      this.originalPageCache.set(cacheKey, rendered);
      if (!preload && token === this.originalPageRenderToken && pageNumber === this.currentPageNumber()) {
        this.originalPageImageUrl.set(rendered.url);
      }
    } catch {
      if (!preload && token === this.originalPageRenderToken) this.originalPageImageUrl.set(null);
    }
  }

  private async renderTranslatedPageBackground(file: File, pageNumber: number, preload: boolean = false): Promise<void> {
    const cacheKey = this.getRenderCacheKey(pageNumber);
    const cached = this.translatedPageCache.get(cacheKey);
    if (cached) {
      if (!preload && pageNumber === this.currentPageNumber()) this.translatedPageImageUrl.set(cached.url);
      return;
    }
    const result = this.result();
    if (!result) {
      if (!preload) this.translatedPageImageUrl.set(null);
      return;
    }
    const token = ++this.translatedPageRenderToken;
    try {
      const pdfDocument = await this.getPdfDocument(file);
      const originalCanvas = await this.renderPdfCanvasFromDocument(pdfDocument, pageNumber);
      const translatedCanvas = this.buildTranslatedPdfCanvas(originalCanvas, result, pageNumber);
      const rendered = this.canvasToObjectUrl(translatedCanvas);
      this.translatedPageCache.set(cacheKey, rendered);
      if (!preload && token === this.translatedPageRenderToken && pageNumber === this.currentPageNumber()) {
        this.translatedPageImageUrl.set(rendered.url);
      }
    } catch {
      if (!preload && token === this.translatedPageRenderToken) this.translatedPageImageUrl.set(null);
    }
  }

  private computeViewerRenderScale(pageWidth: number, pageHeight: number): number {
    const metrics = this.getPdfStageMetrics();
    const availableWidth = Math.max(280, metrics.width - 4);
    const availableHeight = Math.max(360, metrics.height - 4);
    const fitWidthScale = availableWidth / Math.max(pageWidth, 1);
    const fitPageScale = Math.min(fitWidthScale, availableHeight / Math.max(pageHeight, 1));

    if (this.viewerFitMode() === 'page') {
      return Math.max(0.8, fitPageScale);
    }

    if (this.viewerFitMode() === 'custom') {
      return Math.max(0.8, fitWidthScale * (this.viewerZoomPercent() / 100));
    }

    return Math.max(0.8, fitWidthScale);
  }

  private async renderPdfPageToImage(pdfDocument: any, pageNumber: number): Promise<RenderedPdfPage> {
    const canvas = await this.renderPdfCanvasFromDocument(pdfDocument, pageNumber);
    return this.canvasToObjectUrl(canvas);
  }

  private canvasToObjectUrl(canvas: HTMLCanvasElement): RenderedPdfPage {
    const blob = this.dataUrlToBlob(canvas.toDataURL('image/png', 1));
    return { url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height };
  }

  private dataUrlToBlob(dataUrl: string): Blob {
    const [header, data] = dataUrl.split(',');
    const mime = header.match(/data:(.*?);base64/)?.[1] || 'image/png';
    const raw = atob(data);
    const bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
    return new Blob([bytes], { type: mime });
  }

  private async renderPdfCanvasFromDocument(pdfDocument: any, pageNumber: number): Promise<HTMLCanvasElement> {
    const page = await pdfDocument.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const displayScale = this.computeViewerRenderScale(baseViewport.width, baseViewport.height);
    const viewport = page.getViewport({ scale: displayScale });
    const outputScale = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width * outputScale);
    canvas.height = Math.ceil(viewport.height * outputScale);
    canvas.style.width = `${Math.ceil(viewport.width)}px`;
    canvas.style.height = `${Math.ceil(viewport.height)}px`;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas context unavailable');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
    await page.render({ canvasContext: context, viewport, canvas }).promise;
    return canvas;
  }

  private buildTranslatedPdfCanvas(originalCanvas: HTMLCanvasElement, result: FileTranslationResult, pageNumber: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = originalCanvas.width;
    canvas.height = originalCanvas.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return originalCanvas;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(originalCanvas, 0, 0);
    const group = result.groups.find((entry) => entry.index === pageNumber);
    if (!group) return canvas;
    const units = group.unitIds.map((unitId) => result.units.find((unit) => unit.id === unitId)).filter((unit): unit is TranslationUnit => !!unit);
    const layoutUnits = units.filter((unit) => unit.layout);
    if (!layoutUnits.length) {
      this.drawFallbackTranslatedText(context, canvas.width, canvas.height, units.map((unit) => unit.translatedText).filter(Boolean));
      return canvas;
    }
    layoutUnits.forEach((unit) => {
      const layout = unit.layout!;
      const x = Math.max(0, (layout.x / layout.pageWidth) * canvas.width);
      const y = Math.max(0, (layout.y / layout.pageHeight) * canvas.height);
      const width = Math.max(80, (layout.width / layout.pageWidth) * canvas.width);
      const height = Math.max(24, (layout.height / layout.pageHeight) * canvas.height);
      this.drawTranslatedTextBlock(context, x, y, width, height, unit);
    });
    return canvas;
  }

  private drawTranslatedTextBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    unit: TranslationUnit
  ): void {
    const layout = unit.layout;
    const paddingX = Math.max(10, Math.round(width * 0.03));
    const paddingY = Math.max(5, Math.round(height * 0.12));
    const align: CanvasTextAlign = this.isTargetLanguageRtl() ? 'right' : layout?.textAlign === 'center' ? 'center' : 'left';
    const baseFontSize = layout?.fontSize
      ? Math.max(11, Math.min(28, (layout.fontSize / Math.max(layout.pageHeight, 1)) * context.canvas.height * 0.95))
      : Math.max(12, Math.min(24, height * 0.62));
    const fontSize = unit.kind === 'heading' ? Math.min(34, baseFontSize * 1.08) : baseFontSize;
    const lineHeight = fontSize * (unit.kind === 'heading' ? 1.28 : 1.36);
    const availableWidth = Math.max(40, width - paddingX * 2);
    const maxLines = Math.max(1, Math.round((height - paddingY * 2) / lineHeight) + 1);
    const lines = this.wrapCanvasText(context, unit.translatedText || unit.sourceText, availableWidth, fontSize, maxLines);
    const blockHeight = Math.max(height + 4, lines.length * lineHeight + paddingY * 2);

    context.save();
    context.fillStyle = '#ffffff';
    context.fillRect(x - 2, y - 1, width + 4, blockHeight + 2);
    context.font = `${unit.kind === 'heading' ? '700' : '500'} ${fontSize}px Arial`;
    context.fillStyle = '#0f172a';
    context.textAlign = align;
    context.textBaseline = 'top';
    const originX = align === 'right' ? x + width - paddingX : align === 'center' ? x + width / 2 : x + paddingX;
    lines.forEach((line, index) => {
      context.fillText(line, originX, y + paddingY + index * lineHeight, availableWidth);
    });
    context.restore();
  }

  private drawFallbackTranslatedText(context: CanvasRenderingContext2D, width: number, height: number, lines: string[]): void {
    if (!lines.length) return;
    context.save();
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#0f172a';
    const fontSize = Math.max(18, Math.min(28, Math.round(width * 0.025)));
    const lineHeight = fontSize * 1.5;
    context.font = `500 ${fontSize}px Arial`;
    context.textAlign = this.isTargetLanguageRtl() ? 'right' : 'left';
    context.textBaseline = 'top';
    let cursorY = 56;
    lines.forEach((line) => {
      const wrapped = this.wrapCanvasText(context, line, width - 96, fontSize, 12);
      wrapped.forEach((part) => {
        context.fillText(part, this.isTargetLanguageRtl() ? width - 48 : 48, cursorY, width - 96);
        cursorY += lineHeight;
      });
      cursorY += 10;
    });
    context.restore();
  }

  private wrapCanvasText(
    context: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    fontSize: number,
    maxLines: number
  ): string[] {
    const paragraphs = (text || '').split('\n').map((line) => line.trim()).filter(Boolean);
    if (!paragraphs.length) return [''];
    const previousFont = context.font;
    context.font = previousFont.includes(`${fontSize}px`) ? previousFont : `500 ${fontSize}px Arial`;
    const lines: string[] = [];
    for (const paragraph of paragraphs) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      let current = '';
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (context.measureText(candidate).width <= maxWidth || !current) {
          current = candidate;
          continue;
        }
        lines.push(current);
        current = word;
        if (lines.length >= maxLines) break;
      }
      if (lines.length >= maxLines) break;
      if (current) lines.push(current);
      if (lines.length >= maxLines) break;
    }
    context.font = previousFont;
    return lines.slice(0, maxLines);
  }

  private drawCanvasIntoPdf(pdf: jsPDF, canvas: HTMLCanvasElement, x: number, y: number, maxWidth: number, maxHeight: number): void {
    const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
    pdf.addImage(canvas.toDataURL('image/png', 0.98), 'PNG', x, y, canvas.width * scale, canvas.height * scale, undefined, 'FAST');
  }

  private resolveDefaultViewMode(fileName: string): ViewMode { return fileName.toLowerCase().endsWith('.pptx') ? 'slide' : 'page'; }

  private detectMimeType(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (lower.endsWith('.pptx')) return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    return 'application/octet-stream';
  }

  private formatFileSize(size: number): string {
    if (!size) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = size;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    const rounded = value >= 10 || unitIndex === 0 ? Math.round(value) : Number(value.toFixed(1));
    return `${rounded} ${units[unitIndex]}`;
  }

  displayTargetLanguage() { return this.languages.find((lang) => lang.code === this.targetLanguage())?.label || this.targetLanguage(); }

  @HostListener('window:resize')
  handleWindowResize() {
    if (!this.isPdfFile()) return;
    this.clearRenderedPageCaches();
    this.viewerResizeTick.update((value) => value + 1);
  }

  @HostListener('window:keydown', ['$event'])
  handleWindowKeydown(event: KeyboardEvent) {
    if (this.screenMode() !== 'workspace' || this.totalPageCount() <= 0) return;
    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase() || '';
    if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) return;
    if (event.key === 'ArrowRight') {
      this.isRtl() ? this.goPrev() : this.goNext();
      event.preventDefault();
      return;
    }
    if (event.key === 'ArrowLeft') {
      this.isRtl() ? this.goNext() : this.goPrev();
      event.preventDefault();
      return;
    }
    if (event.key === '+' || event.key === '=') {
      this.zoomIn();
      event.preventDefault();
      return;
    }
    if (event.key === '-') {
      this.zoomOut();
      event.preventDefault();
    }
  }
}
