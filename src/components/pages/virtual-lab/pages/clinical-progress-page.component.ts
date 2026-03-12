import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocalizationService } from '../../../../services/localization.service';
import { ClinicalRecordService } from '../services/clinical-record.service';
import { VirtualLabSessionService } from '../services/virtual-lab-session.service';

@Component({
  selector: 'app-clinical-progress-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <section class="rounded-[2.2rem] border border-white/10 bg-slate-950/78 p-6 shadow-2xl">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div class="space-y-3">
            <p class="text-[11px] font-black uppercase tracking-[0.32em] text-cyan-300">{{ ui('سجل سريري', 'Student Clinical Record') }}</p>
            <h1 class="text-3xl font-black tracking-tight text-white md:text-4xl">{{ ui('Clinical Progress', 'Clinical Progress') }}</h1>
            <p class="max-w-3xl text-sm leading-7 text-slate-300">
              {{ ui('كل الحالات التي أتمها الطالب، مع الإحصائيات، الصعوبة، والقدرة على مراجعة القرارات الطبية السابقة.', 'Every completed case with statistics, difficulty, and a direct review path for prior clinical decisions.') }}
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <div class="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-center">
              <p class="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">{{ ui('المستوى السريري', 'Clinical Tier') }}</p>
              <p class="mt-1 text-2xl font-black text-white">{{ levelLabel() }}</p>
            </div>
            <button
              type="button"
              (click)="session.resetToSetup()"
              class="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
            >
              {{ ui('حالة جديدة', 'New Case') }}
            </button>
          </div>
        </div>
      </section>

      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        @for (card of statCards(); track card.label) {
          <div class="rounded-[1.8rem] border border-white/10 bg-slate-950/72 p-5 shadow-xl">
            <p class="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{{ card.label }}</p>
            <p class="mt-3 text-3xl font-black text-white">{{ card.value }}</p>
            @if (card.note) {
              <p class="mt-2 text-sm leading-6 text-slate-400">{{ card.note }}</p>
            }
          </div>
        }
      </section>

      <section class="rounded-[2rem] border border-white/10 bg-slate-950/78 p-5 shadow-2xl">
        <div class="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 class="text-xl font-black text-white">{{ ui('قائمة الحالات', 'Case List') }}</h2>
            <p class="text-sm text-slate-400">{{ ui('تحميل تدريجي للحالات السابقة بدون سحب كل السجل دفعة واحدة.', 'History is loaded progressively instead of fetching everything at once.') }}</p>
          </div>
          <button
            type="button"
            (click)="reload()"
            class="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-white/10"
          >
            {{ ui('تحديث', 'Refresh') }}
          </button>
        </div>

        @if (records.loadingProgress() && records.progressItems().length === 0) {
          <div class="py-16 text-center text-slate-400">{{ ui('جارٍ تحميل السجل السريري...', 'Loading clinical progress...') }}</div>
        } @else if (records.progressItems().length === 0) {
          <div class="py-16 text-center text-slate-500">
            <p class="text-lg font-black text-white">{{ ui('لا توجد حالات مكتملة بعد', 'No completed cases yet') }}</p>
            <p class="mt-2 text-sm">{{ ui('ابدأ أول حالة من إعداد المحاكاة وسيظهر سجلّك هنا.', 'Start your first simulation from setup and your record will appear here.') }}</p>
          </div>
        } @else {
          <div class="mt-5 space-y-3">
            @for (record of records.progressItems(); track record.recordId) {
              <article class="rounded-[1.6rem] border border-white/10 bg-white/5 p-4 transition hover:border-cyan-400/20 hover:bg-white/[0.07]">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div class="space-y-2">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="text-lg font-black text-white">{{ record.title }}</p>
                      <span class="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-black text-cyan-100">{{ record.specialtyTrack }}</span>
                      <span class="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-[10px] font-black text-slate-200">{{ difficultyLabel(record.difficulty) }}</span>
                    </div>
                    <p class="text-sm text-slate-400">{{ record.disease }}</p>
                    <div class="flex flex-wrap gap-4 text-xs font-bold text-slate-500">
                      <span>{{ ui('الدرجة', 'Score') }}: {{ record.score }}</span>
                      <span>{{ ui('المدة', 'Time') }}: {{ formatDuration(record.timeSpentSeconds) }}</span>
                      <span>{{ ui('التاريخ', 'Date') }}: {{ formatDate(record.date) }}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    (click)="session.openReviewPage(record.recordId)"
                    class="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:scale-[1.01]"
                  >
                    <i class="fa-solid fa-book-medical"></i>
                    <span>{{ ui('عرض التفاصيل', 'View Details') }}</span>
                  </button>
                </div>
              </article>
            }
          </div>

          @if (records.hasMore()) {
            <div class="mt-5 flex justify-center">
              <button
                type="button"
                (click)="loadMore()"
                [disabled]="records.loadingProgress()"
                class="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10 disabled:opacity-60"
              >
                {{ records.loadingProgress() ? ui('جارٍ التحميل...', 'Loading...') : ui('تحميل المزيد', 'Load More') }}
              </button>
            </div>
          }
        }
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClinicalProgressPageComponent {
  readonly session = inject(VirtualLabSessionService);
  readonly records = inject(ClinicalRecordService);
  private readonly localization = inject(LocalizationService);
  readonly isArabic = computed(() => this.localization.currentLanguage() === 'ar');
  readonly levelLabel = computed(() => {
    const level = this.records.stats().levelTier;
    if (level === 'platinum') return 'Platinum';
    if (level === 'gold') return 'Gold';
    if (level === 'silver') return 'Silver';
    return 'Bronze';
  });
  readonly statCards = computed(() => {
    const stats = this.records.stats();
    return [
      {
        label: this.ui('إجمالي الحالات', 'Total Cases'),
        value: `${stats.totalCasesCompleted}`,
        note: this.ui('الحالات المكتملة داخل السجل السريري', 'Completed cases inside the clinical record')
      },
      {
        label: this.ui('متوسط النتيجة', 'Average Score'),
        value: `${stats.averageScore}`,
        note: this.ui(`أفضل ${stats.bestScore} / أسوأ ${stats.worstScore}`, `Best ${stats.bestScore} / Worst ${stats.worstScore}`)
      },
      {
        label: this.ui('إجمالي ساعات التدريب', 'Total Practice Hours'),
        value: `${stats.totalHoursPracticed}`,
        note: this.ui(`الأكثر ممارسة: ${stats.mostPracticedSpecialty}`, `Most practiced: ${stats.mostPracticedSpecialty}`)
      },
      {
        label: this.ui('التخصص الأكثر تكراراً', 'Most Practiced Specialty'),
        value: stats.mostPracticedSpecialty,
        note: this.records.stats().specialtyBreakdown.slice(0, 3).map((item) => `${item.specialty}: ${item.count}`).join(' | ')
      },
      {
        label: this.ui('الصعوبة الموصى بها', 'Recommended Difficulty'),
        value: this.difficultyLabel(stats.recommendedDifficulty),
        note: this.ui('مرتبطة بالمستوى السريري الحالي', 'Aligned with the current clinical tier')
      }
    ];
  });

  constructor() {
    effect(() => {
      if (this.session.route() !== 'simulation-progress') {
        return;
      }

      if (this.records.progressItems().length === 0 && !this.records.loadingProgress()) {
        void this.records.loadProgress(true);
      }
    });
  }

  async reload() {
    await this.records.loadProgress(true);
  }

  async loadMore() {
    await this.records.loadProgress(false);
  }

  difficultyLabel(value: string) {
    if (value === 'expert') return this.ui('خبير', 'Expert');
    if (value === 'hard') return this.ui('صعب', 'Hard');
    if (value === 'medium') return this.ui('متوسط', 'Medium');
    return this.ui('سهل', 'Easy');
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
