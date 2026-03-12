import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerConfig } from '../models/virtual-lab.models';

@Component({
  selector: 'app-timer-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="inline-flex items-center gap-3 rounded-2xl border px-4 py-2 text-sm font-black transition-all duration-300"
         [class.border-rose-400/30]="timer()?.enabled"
         [class.bg-rose-500/10]="timer()?.enabled"
         [class.text-rose-100]="timer()?.enabled"
         [class.border-white/10]="!timer()?.enabled"
         [class.bg-white/5]="!timer()?.enabled"
         [class.text-slate-300]="!timer()?.enabled"
         [class.shadow-[0_0_24px_rgba(244,63,94,0.12)]]="timer()?.mode === 'case'">
      <i class="fa-solid" [class.fa-hourglass-half]="timer()?.enabled" [class.fa-infinity]="!timer()?.enabled" [class.animate-pulse]="timer()?.mode === 'case'"></i>
      <div class="leading-none">
        <p class="text-[10px] font-black uppercase tracking-[0.24em] opacity-80">{{ caption() }}</p>
        <p class="mt-1 text-base font-black tabular-nums">{{ label() }}</p>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimerBadgeComponent {
  readonly timer = input<TimerConfig | null>(null);
  readonly formattedTime = input('0:00');
  readonly label = computed(() => this.timer()?.enabled ? this.formattedTime() : 'Untimed');
  readonly caption = computed(() => this.timer()?.enabled ? (this.timer()?.label || 'Timer') : 'Timer');
}
