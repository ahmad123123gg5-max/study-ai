import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelConfig } from '../models/virtual-lab.models';

@Component({
  selector: 'app-generic-insight-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4">
      @for (card of config()?.insights?.cards || []; track card.label) {
        <div class="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
          <p class="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{{ card.label }}</p>
          <p class="mt-2 text-lg font-black text-white">{{ card.value }}</p>
          @if (card.note) {
            <p class="mt-2 text-sm font-medium leading-6 text-slate-400">{{ card.note }}</p>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GenericInsightPanelComponent {
  readonly config = input<PanelConfig | null>(null);
}
