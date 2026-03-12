import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SimulationSessionMeta, TimerConfig } from '../models/virtual-lab.models';
import { TimerBadgeComponent } from './timer-badge.component';

@Component({
  selector: 'app-simulation-header',
  standalone: true,
  imports: [CommonModule, TimerBadgeComponent],
  template: `
    <header class="flex flex-wrap items-center justify-between gap-3 rounded-[1.8rem] border border-white/10 bg-slate-950/80 px-4 py-3 shadow-xl md:px-5">
      <div class="flex min-w-0 items-center gap-3">
        <button type="button" (click)="back.emit()" class="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white transition hover:bg-white/10">
          <i class="fa-solid" [class.fa-arrow-right]="language() === 'ar'" [class.fa-arrow-left]="language() !== 'ar'"></i>
        </button>
        <div class="min-w-0">
          <h2 class="truncate text-lg font-black tracking-tight text-white md:text-[1.65rem]">{{ meta()?.title }}</h2>
          <p class="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">{{ meta()?.role }}</p>
          @if (meta()?.consultantLabel || meta()?.difficultyLabel) {
            <div class="mt-2 flex flex-wrap gap-2">
              @if (meta()?.difficultyLabel) {
                <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black text-slate-200">{{ meta()?.difficultyLabel }}</span>
              }
              @if (meta()?.consultantLabel) {
                <span class="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[10px] font-black text-cyan-100">{{ meta()?.consultantLabel }}</span>
              }
              @if (meta()?.patientLabel) {
                <span class="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black text-emerald-100">{{ meta()?.patientLabel }}</span>
              }
              @if (meta()?.phaseLabel) {
                <span class="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black text-amber-100">{{ meta()?.phaseLabel }}</span>
              }
            </div>
          }
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="hidden rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-300 md:block">
          {{ meta()?.setting }}
        </div>
        <div class="hidden rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-slate-300 md:block">
          {{ ui('المرحلة', 'Stage') }} {{ meta()?.stepIndex }} / {{ meta()?.estimatedTotalSteps }}
        </div>
        <div class="inline-flex items-center gap-3 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-3 py-2 text-white">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-200">
            <i class="fa-solid fa-chart-line"></i>
          </div>
          <div class="leading-none">
            <p class="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-200/80">{{ ui('النتيجة', 'Score') }}</p>
            <p class="mt-1 text-xl font-black tabular-nums">{{ score() }}</p>
          </div>
        </div>
        <app-timer-badge [timer]="timer()" [formattedTime]="formattedTime()"></app-timer-badge>
        <button type="button" (click)="togglePanel.emit()" class="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-black text-white transition hover:bg-white/10 lg:hidden">
          <i class="fa-solid fa-wave-square"></i>
          <span>{{ ui('اللوحة', 'Panel') }}</span>
        </button>
      </div>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimulationHeaderComponent {
  readonly meta = input<SimulationSessionMeta | null>(null);
  readonly timer = input<TimerConfig | null>(null);
  readonly formattedTime = input('0:00');
  readonly score = input(50);
  readonly language = input<'ar' | 'en'>('en');
  readonly back = output<void>();
  readonly togglePanel = output<void>();

  ui(arabic: string, english: string) {
    return this.language() === 'ar' ? arabic : english;
  }
}
