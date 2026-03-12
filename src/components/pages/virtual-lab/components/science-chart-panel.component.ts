import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelConfig } from '../models/virtual-lab.models';

@Component({
  selector: 'app-science-chart-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (config()?.chart; as chart) {
      <div class="space-y-4">
        <div class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <p class="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{{ chart.title }}</p>
          <p class="mt-2 text-sm font-medium text-slate-300">{{ chart.xLabel }} vs {{ chart.yLabel }}</p>
        </div>

        <div class="rounded-[1.5rem] border border-white/10 bg-slate-950/80 p-4">
          <div class="space-y-3">
            @for (point of chart.points; track point.label) {
              <div>
                <div class="mb-1 flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>{{ point.label }}</span>
                  <span>{{ point.value }}</span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-white/10">
                  <div class="h-full rounded-full bg-cyan-400" [style.width.%]="point.value"></div>
                </div>
                @if (point.emphasis) {
                  <p class="mt-1 text-[11px] font-medium text-cyan-200">{{ point.emphasis }}</p>
                }
              </div>
            }
          </div>
        </div>

        <div class="rounded-[1.4rem] border border-cyan-400/20 bg-cyan-500/10 p-4">
          <p class="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">Insight</p>
          <p class="mt-2 text-sm font-medium leading-6 text-white">{{ chart.insight }}</p>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ScienceChartPanelComponent {
  readonly config = input<PanelConfig | null>(null);
}
