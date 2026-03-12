import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SimulationCaseSummary } from '../models/virtual-lab.models';

@Component({
  selector: 'app-simulation-case-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (summary(); as report) {
      <section class="flex h-full min-h-0 flex-col overflow-y-auto rounded-[2rem] border border-white/10 bg-slate-950/88 p-5 shadow-2xl md:p-6 [scrollbar-width:thin] [scrollbar-color:rgba(71,85,105,0.95)_transparent] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600/90 [&::-webkit-scrollbar-track]:bg-transparent">
        <div class="rounded-[1.8rem] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 p-5">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="space-y-3">
              <p class="text-[11px] font-black uppercase tracking-[0.34em] text-slate-400">{{ ui('تقرير ختامي', 'Case Summary') }}</p>
              <h2 class="text-2xl font-black text-white md:text-3xl">{{ report.title }}</h2>
              <p class="text-sm font-semibold text-slate-400">{{ report.subtitle }}</p>
              <p class="max-w-3xl text-base leading-8 text-slate-200">{{ report.patientCourse }}</p>
            </div>

            <div class="grid min-w-[220px] gap-3">
              <div class="rounded-[1.3rem] border px-4 py-3 text-center"
                   [class.border-emerald-400/30]="report.result === 'success'"
                   [class.bg-emerald-500/10]="report.result === 'success'"
                   [class.text-emerald-100]="report.result === 'success'"
                   [class.border-sky-400/30]="report.result === 'partial'"
                   [class.bg-sky-500/10]="report.result === 'partial'"
                   [class.text-sky-100]="report.result === 'partial'"
                   [class.border-rose-400/30]="report.result === 'failure' || report.result === 'deteriorated'"
                   [class.bg-rose-500/10]="report.result === 'failure' || report.result === 'deteriorated'"
                   [class.text-rose-100]="report.result === 'failure' || report.result === 'deteriorated'">
                <p class="text-[11px] font-black uppercase tracking-[0.28em]">{{ ui('النتيجة', 'Outcome') }}</p>
                <p class="mt-2 text-2xl font-black">{{ report.outcomeLabel }}</p>
              </div>

              <div class="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-3 text-center text-white">
                <p class="text-[11px] font-black uppercase tracking-[0.28em] text-slate-400">{{ ui('الدرجة', 'Score') }}</p>
                <p class="mt-2 text-2xl font-black">{{ report.score }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <div class="space-y-4">
            <div class="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
              <h3 class="text-sm font-black uppercase tracking-[0.26em] text-slate-400">{{ ui('ماذا حدث', 'What Happened') }}</h3>
              <div class="mt-4 space-y-3">
                @for (item of report.whatHappened; track item) {
                  <div class="rounded-2xl border border-white/8 bg-slate-900/80 px-4 py-3 text-sm leading-7 text-slate-200">{{ item }}</div>
                }
              </div>
            </div>

            <div class="grid gap-4 lg:grid-cols-2">
              <div class="rounded-[1.6rem] border border-emerald-400/15 bg-emerald-500/5 p-5">
                <h3 class="text-sm font-black uppercase tracking-[0.26em] text-emerald-200">{{ report.correctActionsLabel || ui('القرارات الصحيحة', 'Correct Decisions') }}</h3>
                <div class="mt-4 space-y-2">
                  @for (item of safeList(report.correctActions, ui('لم تُسجل قرارات صحيحة كافية.', 'No strong correct decisions were captured.')); track item) {
                    <div class="rounded-2xl border border-emerald-400/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100">{{ item }}</div>
                  }
                </div>
              </div>

              <div class="rounded-[1.6rem] border border-rose-400/15 bg-rose-500/5 p-5">
                <h3 class="text-sm font-black uppercase tracking-[0.26em] text-rose-200">{{ report.incorrectActionsLabel || ui('القرارات الخاطئة', 'Incorrect Decisions') }}</h3>
                <div class="mt-4 space-y-2">
                  @for (item of safeList(report.incorrectActions, ui('لم تُسجل أخطاء مباشرة كبيرة.', 'No major incorrect actions were recorded.')); track item) {
                    <div class="rounded-2xl border border-rose-400/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100">{{ item }}</div>
                  }
                </div>
              </div>
            </div>

            <div class="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
              <h3 class="text-sm font-black uppercase tracking-[0.26em] text-slate-400">{{ ui('تحليل تعليمي', 'Educational Analysis') }}</h3>
              <p class="mt-4 text-base leading-8 text-slate-200">{{ report.educationalAnalysis }}</p>
            </div>

            @if (report.idealPlan && report.idealPlan.length > 0) {
              <div class="rounded-[1.6rem] border border-indigo-400/15 bg-indigo-500/5 p-5">
                <h3 class="text-sm font-black uppercase tracking-[0.26em] text-indigo-200">{{ report.idealPlanLabel || ui('الخطة المثالية', 'Ideal Management Plan') }}</h3>
                <div class="mt-4 space-y-2">
                  @for (item of report.idealPlan; track item) {
                    <div class="rounded-2xl border border-indigo-400/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100">{{ item }}</div>
                  }
                </div>
              </div>
            }
          </div>

          <div class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
                <p class="text-[11px] font-black uppercase tracking-[0.26em] text-slate-400">{{ report.initialSnapshotLabel || ui('المؤشرات الأولية', 'Initial Snapshot') }}</p>
                <div class="mt-4 space-y-2 text-sm leading-7 text-slate-100">
                  @for (item of initialSnapshotItems(report); track item) {
                    <p>{{ item }}</p>
                  }
                </div>
              </div>

              <div class="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
                <p class="text-[11px] font-black uppercase tracking-[0.26em] text-slate-400">{{ report.finalSnapshotLabel || ui('المؤشرات النهائية', 'Final Snapshot') }}</p>
                <div class="mt-4 space-y-2 text-sm leading-7 text-slate-100">
                  @for (item of finalSnapshotItems(report); track item) {
                    <p>{{ item }}</p>
                  }
                </div>
              </div>
            </div>

            <div class="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
              <h3 class="text-sm font-black uppercase tracking-[0.26em] text-slate-400">{{ report.impactLabel || ui('تأثير القرارات على الحالة', 'Decision Impact') }}</h3>
              <div class="mt-4 space-y-2">
                @for (item of report.vitalsImpact; track item) {
                  <div class="rounded-2xl border border-white/8 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100">{{ item }}</div>
                }
              </div>
            </div>

            @if (report.performanceDimensions && report.performanceDimensions.length > 0) {
              <div class="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
                <h3 class="text-sm font-black uppercase tracking-[0.26em] text-slate-400">{{ ui('أبعاد الأداء', 'Performance Dimensions') }}</h3>
                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                  @for (metric of report.performanceDimensions; track metric.label) {
                    <div class="rounded-2xl border border-white/8 bg-slate-950/80 px-4 py-3">
                      <p class="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{{ metric.label }}</p>
                      <p class="mt-2 text-xl font-black text-white">{{ metric.value }}</p>
                      @if (metric.note) {
                        <p class="mt-2 text-sm leading-7 text-slate-300">{{ metric.note }}</p>
                      }
                    </div>
                  }
                </div>
              </div>
            }

            @if (report.timelineHighlights && report.timelineHighlights.length > 0) {
              <div class="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
                <h3 class="text-sm font-black uppercase tracking-[0.26em] text-slate-400">{{ report.timelineLabel || ui('الخط الزمني السريري', 'Clinical Timeline') }}</h3>
                <div class="mt-4 space-y-2">
                  @for (item of report.timelineHighlights; track item) {
                    <div class="rounded-2xl border border-white/8 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100">{{ item }}</div>
                  }
                </div>
              </div>
            }

            <div class="grid gap-4">
              <div class="rounded-[1.6rem] border border-sky-400/15 bg-sky-500/5 p-5">
                <h3 class="text-sm font-black uppercase tracking-[0.26em] text-sky-200">{{ ui('نقاط القوة', 'Strengths') }}</h3>
                <div class="mt-4 space-y-2">
                  @for (item of report.strengths; track item) {
                    <div class="rounded-2xl border border-sky-400/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100">{{ item }}</div>
                  }
                </div>
              </div>

              <div class="rounded-[1.6rem] border border-amber-400/15 bg-amber-500/5 p-5">
                <h3 class="text-sm font-black uppercase tracking-[0.26em] text-amber-200">{{ ui('أخطاء يجب تجنبها', 'Mistakes To Avoid') }}</h3>
                <div class="mt-4 space-y-2">
                  @for (item of report.mistakesToAvoid; track item) {
                    <div class="rounded-2xl border border-amber-400/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100">{{ item }}</div>
                  }
                </div>
              </div>

              @if (report.criticalMistakes && report.criticalMistakes.length > 0) {
                <div class="rounded-[1.6rem] border border-rose-400/15 bg-rose-500/5 p-5">
                  <h3 class="text-sm font-black uppercase tracking-[0.26em] text-rose-200">{{ report.criticalMistakesLabel || ui('أخطاء حرجة', 'Critical Mistakes') }}</h3>
                  <div class="mt-4 space-y-2">
                    @for (item of report.criticalMistakes; track item) {
                      <div class="rounded-2xl border border-rose-400/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100">{{ item }}</div>
                    }
                  </div>
                </div>
              }

              <div class="rounded-[1.6rem] border border-indigo-400/15 bg-indigo-500/5 p-5">
                <h3 class="text-sm font-black uppercase tracking-[0.26em] text-indigo-200">{{ report.recommendationsLabel || ui('التوصية المهنية', 'Recommended Professional Approach') }}</h3>
                <div class="mt-4 space-y-2">
                  @for (item of report.recommendations; track item) {
                    <div class="rounded-2xl border border-indigo-400/10 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-100">{{ item }}</div>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimulationCaseSummaryComponent {
  readonly summary = input<SimulationCaseSummary | null>(null);
  readonly language = input<'ar' | 'en'>('en');

  ui(arabic: string, english: string) {
    return this.language() === 'ar' ? arabic : english;
  }

  safeList(values: string[], fallback: string) {
    return values.length > 0 ? values : [fallback];
  }

  formatSeverity(value: string) {
    if (value === 'stable') return this.ui('مستقرة', 'Stable');
    if (value === 'concerning') return this.ui('مقلقة', 'Concerning');
    if (value === 'unstable') return this.ui('غير مستقرة', 'Unstable');
    return this.ui('حرجة', 'Critical');
  }

  initialSnapshotItems(report: SimulationCaseSummary) {
    if (report.initialSnapshot && report.initialSnapshot.length > 0) {
      return report.initialSnapshot;
    }

    if (!report.initialVitals) {
      return [this.ui('لا تتوفر لقطة افتتاحية إضافية.', 'No opening snapshot is available.')];
    }

    return [
      `HR ${report.initialVitals.heartRate} bpm`,
      `SpO2 ${report.initialVitals.oxygenSaturation}%`,
      `RR ${report.initialVitals.respiratoryRate}/min`,
      `BP ${report.initialVitals.bloodPressureSystolic}/${report.initialVitals.bloodPressureDiastolic}`,
      `${this.ui('الشدة', 'Severity')}: ${this.formatSeverity(report.initialVitals.severity)}`
    ];
  }

  finalSnapshotItems(report: SimulationCaseSummary) {
    if (report.finalSnapshot && report.finalSnapshot.length > 0) {
      return report.finalSnapshot;
    }

    if (!report.finalVitals) {
      return [this.ui('لا تتوفر لقطة ختامية إضافية.', 'No closing snapshot is available.')];
    }

    return [
      `HR ${report.finalVitals.heartRate} bpm`,
      `SpO2 ${report.finalVitals.oxygenSaturation}%`,
      `RR ${report.finalVitals.respiratoryRate}/min`,
      `BP ${report.finalVitals.bloodPressureSystolic}/${report.finalVitals.bloodPressureDiastolic}`,
      `${this.ui('الشدة', 'Severity')}: ${this.formatSeverity(report.finalVitals.severity)}`
    ];
  }
}
