import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelConfig } from '../models/virtual-lab.models';

@Component({
  selector: 'app-operations-board-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (config()?.operations; as operations) {
      <div class="space-y-4">
        <div class="rounded-[1.5rem] border border-cyan-400/15 bg-cyan-500/5 p-4">
          <p class="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-200">{{ ui('مرحلة التشغيل', 'Operational Phase') }}</p>
          <h4 class="mt-2 text-xl font-black text-white">{{ operations.phase }}</h4>
          <p class="mt-2 text-sm leading-7 text-slate-300">{{ operations.headline }}</p>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p class="text-[11px] font-black uppercase tracking-[0.26em] text-slate-400">{{ ui('الأولويات الحية', 'Live Priorities') }}</p>
            <div class="mt-4 space-y-3">
              @for (item of operations.priorities; track item.label) {
                <div class="rounded-[1.2rem] border px-4 py-3"
                     [class.border-rose-400/20]="item.status === 'critical'"
                     [class.bg-rose-500/8]="item.status === 'critical'"
                     [class.border-amber-400/20]="item.status === 'watch'"
                     [class.bg-amber-500/8]="item.status === 'watch'"
                     [class.border-emerald-400/20]="item.status === 'ready'"
                     [class.bg-emerald-500/8]="item.status === 'ready'">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="text-sm font-black text-white">{{ item.label }}</p>
                      <p class="mt-1 text-sm leading-7 text-slate-300">{{ item.detail }}</p>
                    </div>
                    <span class="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]"
                          [class.bg-rose-500/15]="item.status === 'critical'"
                          [class.text-rose-200]="item.status === 'critical'"
                          [class.bg-amber-500/15]="item.status === 'watch'"
                          [class.text-amber-200]="item.status === 'watch'"
                          [class.bg-emerald-500/15]="item.status === 'ready'"
                          [class.text-emerald-200]="item.status === 'ready'">
                      {{ statusLabel(item.status) }}
                    </span>
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p class="text-[11px] font-black uppercase tracking-[0.26em] text-slate-400">{{ ui('الجهات المشاركة', 'Actors in Play') }}</p>
            <div class="mt-4 space-y-3">
              @for (actor of operations.actors; track actor.role) {
                <div class="rounded-[1.2rem] border border-white/8 bg-slate-950/80 px-4 py-3">
                  <p class="text-sm font-black text-white">{{ actor.role }}</p>
                  <p class="mt-1 text-sm leading-7 text-slate-300">{{ actor.status }}</p>
                </div>
              }
            </div>
          </div>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p class="text-[11px] font-black uppercase tracking-[0.26em] text-slate-400">{{ ui('القيود', 'Constraints') }}</p>
            <div class="mt-4 space-y-2">
              @for (constraint of operations.constraints; track constraint) {
                <div class="rounded-xl border border-white/8 bg-slate-950/80 px-4 py-3 text-sm leading-7 text-slate-200">{{ constraint }}</div>
              }
            </div>
          </div>

          <div class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
            <p class="text-[11px] font-black uppercase tracking-[0.26em] text-slate-400">{{ ui('الأدوات أو المحاور', 'Tools or Focus Areas') }}</p>
            <div class="mt-4 flex flex-wrap gap-2">
              @for (tool of operations.tools; track tool) {
                <span class="rounded-full border border-cyan-400/15 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-100">{{ tool }}</span>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OperationsBoardPanelComponent {
  readonly config = input<PanelConfig | null>(null);

  ui(arabic: string, english: string) {
    return this.isArabic() ? arabic : english;
  }

  statusLabel(value: 'critical' | 'watch' | 'ready') {
    if (this.isArabic()) {
      if (value === 'critical') return 'حرج';
      if (value === 'watch') return 'مراقبة';
      return 'جاهز';
    }

    if (value === 'critical') return 'Critical';
    if (value === 'watch') return 'Watch';
    return 'Ready';
  }

  private isArabic() {
    const panel = this.config();
    return /[\u0600-\u06FF]/.test(panel?.title || '') || /[\u0600-\u06FF]/.test(panel?.summary || '');
  }
}
