import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelConfig } from '../models/virtual-lab.models';

@Component({
  selector: 'app-business-metrics-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (config()?.metrics; as metricsPanel) {
      <div class="space-y-4">
        <div class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <p class="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Headline</p>
          <p class="mt-2 text-base font-black text-white">{{ metricsPanel.headline }}</p>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          @for (metric of metricsPanel.metrics; track metric.label) {
            <div class="rounded-[1.4rem] border border-white/10 bg-slate-950/80 p-4">
              <p class="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{{ metric.label }}</p>
              <p class="mt-2 text-2xl font-black text-white">{{ metric.value }}</p>
              <p class="mt-2 text-sm font-bold"
                 [class.text-emerald-300]="metric.trend === 'up'"
                 [class.text-rose-300]="metric.trend === 'down'"
                 [class.text-slate-300]="metric.trend === 'steady'">
                {{ metric.delta }}
              </p>
            </div>
          }
        </div>

        <div class="rounded-[1.4rem] border border-emerald-400/20 bg-emerald-500/10 p-4">
          <p class="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-200">Recommendation</p>
          <p class="mt-2 text-sm font-medium leading-6 text-white">{{ metricsPanel.recommendation }}</p>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BusinessMetricsPanelComponent {
  readonly config = input<PanelConfig | null>(null);
}
