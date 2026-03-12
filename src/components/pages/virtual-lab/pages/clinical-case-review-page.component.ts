import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocalizationService } from '../../../../services/localization.service';
import { ClinicalRecordService } from '../services/clinical-record.service';
import { VirtualLabSessionService } from '../services/virtual-lab-session.service';

@Component({
  selector: 'app-clinical-case-review-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          (click)="session.openProgressPage()"
          class="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
        >
          <i class="fa-solid" [class.fa-arrow-right]="isArabic()" [class.fa-arrow-left]="!isArabic()"></i>
          <span>{{ ui('العودة إلى السجل', 'Back to Progress') }}</span>
        </button>
      </div>

      @if (records.loadingReview()) {
        <div class="rounded-[2rem] border border-white/10 bg-slate-950/78 px-6 py-16 text-center text-slate-400">
          {{ ui('جارٍ تحميل مراجعة الحالة...', 'Loading case review...') }}
        </div>
      } @else if (record(); as current) {
        <section class="rounded-[2.2rem] border border-white/10 bg-slate-950/78 p-6 shadow-2xl">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="space-y-3">
              <p class="text-[11px] font-black uppercase tracking-[0.32em] text-cyan-300">{{ ui('Case Review', 'Case Review') }}</p>
              <h1 class="text-3xl font-black tracking-tight text-white md:text-4xl">{{ current.title }}</h1>
              <p class="text-sm text-slate-400">{{ current.disease }} · {{ current.specialtyTrack }}</p>
              <p class="max-w-3xl text-base leading-8 text-slate-200">{{ current.caseDescription }}</p>
            </div>

            <div class="grid gap-3 md:min-w-[220px]">
              <div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                <p class="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">{{ ui('النتيجة', 'Score') }}</p>
                <p class="mt-2 text-3xl font-black text-white">{{ current.score }}</p>
              </div>
              <div class="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-center">
                <p class="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100">{{ ui('المستوى السريري', 'Clinical Tier') }}</p>
                <p class="mt-2 text-2xl font-black text-white">{{ tierLabel(current.levelTier) }}</p>
              </div>
            </div>
          </div>
        </section>

        <section class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <div class="space-y-4">
            <article class="rounded-[1.8rem] border border-white/10 bg-slate-950/72 p-5">
              <h2 class="text-sm font-black uppercase tracking-[0.24em] text-slate-400">{{ ui('القرارات التي اتخذها الطالب', 'Student Decisions') }}</h2>
              <div class="mt-4 space-y-2">
                @for (decision of studentDecisions(); track decision) {
                  <div class="rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm leading-7 text-slate-100">{{ decision }}</div>
                }
              </div>
            </article>

            <div class="grid gap-4 lg:grid-cols-2">
              <article class="rounded-[1.8rem] border border-emerald-400/15 bg-emerald-500/5 p-5">
                <h2 class="text-sm font-black uppercase tracking-[0.24em] text-emerald-200">{{ ui('الخطوات الصحيحة', 'Correct Steps') }}</h2>
                <div class="mt-4 space-y-2">
                  @for (item of withFallback(current.correctDecisions, ui('لم يتم تسجيل قرارات صحيحة كافية.', 'No strong correct decisions were captured.')); track item) {
                    <div class="rounded-2xl border border-emerald-400/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100">{{ item }}</div>
                  }
                </div>
              </article>

              <article class="rounded-[1.8rem] border border-rose-400/15 bg-rose-500/5 p-5">
                <h2 class="text-sm font-black uppercase tracking-[0.24em] text-rose-200">{{ ui('الأخطاء المرتكبة', 'Mistakes') }}</h2>
                <div class="mt-4 space-y-2">
                  @for (item of withFallback(current.mistakes, ui('لا توجد أخطاء كبيرة مسجلة.', 'No major mistakes were recorded.')); track item) {
                    <div class="rounded-2xl border border-rose-400/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100">{{ item }}</div>
                  }
                </div>
              </article>
            </div>

            <article class="rounded-[1.8rem] border border-indigo-400/15 bg-indigo-500/5 p-5">
              <h2 class="text-sm font-black uppercase tracking-[0.24em] text-indigo-100">{{ ui('الشرح الطبي التعليمي', 'Educational Medical Explanation') }}</h2>
              <p class="mt-4 text-base leading-8 text-slate-100">{{ current.educationalAnalysis || current.finalEvaluation || ui('لا يتوفر شرح إضافي لهذه الحالة.', 'No additional explanation is available for this case.') }}</p>
            </article>
          </div>

          <div class="space-y-4">
            <article class="rounded-[1.8rem] border border-white/10 bg-slate-950/72 p-5">
              <h2 class="text-sm font-black uppercase tracking-[0.24em] text-slate-400">{{ ui('ملخص الحالة', 'Case Snapshot') }}</h2>
              <div class="mt-4 space-y-3 text-sm leading-7 text-slate-200">
                <p>{{ ui('التاريخ', 'Date') }}: {{ formatDate(current.date) }}</p>
                <p>{{ ui('المدة', 'Time Spent') }}: {{ formatDuration(current.timeSpentSeconds) }}</p>
                <p>{{ ui('مستوى الصعوبة', 'Difficulty') }}: {{ difficultyLabel(current.difficulty) }}</p>
                <p>{{ ui('خيارات العلاج', 'Treatment Choices') }}: {{ current.treatmentChoices.join(' | ') || ui('غير مسجلة', 'Not recorded') }}</p>
              </div>
            </article>

            @if (current.generatedCase) {
              <article class="rounded-[1.8rem] border border-white/10 bg-slate-950/72 p-5">
                <h2 class="text-sm font-black uppercase tracking-[0.24em] text-slate-400">{{ ui('بيانات الحالة الأصلية', 'Original Case Data') }}</h2>
                <div class="mt-4 space-y-2 text-sm leading-7 text-slate-200">
                  <p>{{ ui('العمر', 'Age') }}: {{ current.generatedCase.patientAge }}</p>
                  <p>{{ ui('الشدة', 'Severity') }}: {{ current.generatedCase.severity }}</p>
                  <p>{{ ui('المضاعفة', 'Complication') }}: {{ current.generatedCase.complication }}</p>
                  <p>{{ ui('الخلفية المرضية', 'Medical History') }}: {{ current.generatedCase.medicalHistory.join(' | ') }}</p>
                </div>
                <div class="mt-4 grid gap-2">
                  @for (lab of current.generatedCase.labs; track lab.id) {
                    <div class="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                      <div class="flex items-center justify-between gap-3">
                        <p class="font-black text-white">{{ lab.label }}</p>
                        <span
                          class="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                          [class.bg-emerald-500/10]="lab.status === 'normal'"
                          [class.text-emerald-100]="lab.status === 'normal'"
                          [class.bg-amber-500/10]="lab.status === 'watch'"
                          [class.text-amber-100]="lab.status === 'watch'"
                          [class.bg-rose-500/10]="lab.status === 'critical'"
                          [class.text-rose-100]="lab.status === 'critical'"
                        >
                          {{ lab.status }}
                        </span>
                      </div>
                      <p class="mt-2 text-sm text-slate-300">{{ lab.value }}</p>
                    </div>
                  }
                </div>
              </article>
            }
          </div>
        </section>
      } @else {
        <div class="rounded-[2rem] border border-white/10 bg-slate-950/78 px-6 py-16 text-center text-slate-500">
          {{ ui('لم يتم العثور على مراجعة لهذه الحالة.', 'No review was found for this case.') }}
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClinicalCaseReviewPageComponent {
  readonly session = inject(VirtualLabSessionService);
  readonly records = inject(ClinicalRecordService);
  private readonly localization = inject(LocalizationService);
  readonly isArabic = computed(() => this.localization.currentLanguage() === 'ar');
  readonly record = computed(() => this.records.activeReview());
  readonly studentDecisions = computed(() => {
    const record = this.records.activeReview();
    if (!record) {
      return [];
    }

    const userDecisions = record.transcript
      .filter((entry) => entry.role === 'user')
      .map((entry) => entry.text)
      .filter(Boolean);

    return userDecisions.length > 0
      ? userDecisions
      : record.treatmentChoices;
  });

  constructor() {
    effect(() => {
      if (this.session.route() !== 'simulation-review') {
        return;
      }

      const reviewId = this.session.reviewRecordId();
      if (!reviewId) {
        return;
      }

      void this.records.loadReview(reviewId);
    });
  }

  withFallback(values: string[], fallback: string) {
    return values.length > 0 ? values : [fallback];
  }

  difficultyLabel(value: string) {
    if (value === 'expert') return this.ui('خبير', 'Expert');
    if (value === 'hard') return this.ui('صعب', 'Hard');
    if (value === 'medium') return this.ui('متوسط', 'Medium');
    return this.ui('سهل', 'Easy');
  }

  tierLabel(value: string) {
    if (value === 'platinum') return 'Platinum';
    if (value === 'gold') return 'Gold';
    if (value === 'silver') return 'Silver';
    return 'Bronze';
  }

  formatDate(value: string) {
    const locale = this.isArabic() ? 'ar-EG' : 'en-US';
    return new Date(value).toLocaleString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDuration(seconds: number) {
    const mins = Math.max(0, Math.round(seconds / 60));
    if (mins < 60) {
      return this.ui(`${mins} دقيقة`, `${mins} min`);
    }

    const hours = (mins / 60).toFixed(1);
    return this.ui(`${hours} ساعة`, `${hours} h`);
  }

  ui(arabic: string, english: string) {
    return this.isArabic() ? arabic : english;
  }
}
