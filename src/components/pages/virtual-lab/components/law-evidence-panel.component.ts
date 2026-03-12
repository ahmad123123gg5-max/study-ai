import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelConfig } from '../models/virtual-lab.models';

@Component({
  selector: 'app-law-evidence-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (config()?.evidence; as evidencePanel) {
      <div class="space-y-4">
        <div class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <p class="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Hearing Stage</p>
          <p class="mt-2 text-base font-black text-white">{{ evidencePanel.hearingStage }}</p>
        </div>

        <div class="space-y-3">
          @for (item of evidencePanel.evidence; track item.title) {
            <div class="rounded-[1.4rem] border border-white/10 bg-slate-950/80 p-4">
              <div class="flex items-center justify-between gap-3">
                <p class="font-black text-white">{{ item.title }}</p>
                <span class="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em]"
                      [class.bg-emerald-500/15]="item.weight === 'high'"
                      [class.text-emerald-200]="item.weight === 'high'"
                      [class.bg-amber-500/15]="item.weight === 'medium'"
                      [class.text-amber-200]="item.weight === 'medium'"
                      [class.bg-slate-500/15]="item.weight === 'low'"
                      [class.text-slate-200]="item.weight === 'low'">
                  {{ item.weight }}
                </span>
              </div>
              <p class="mt-2 text-sm font-medium leading-6 text-slate-300">{{ item.detail }}</p>
            </div>
          }
        </div>

        <div class="rounded-[1.4rem] border border-indigo-400/20 bg-indigo-500/10 p-4">
          <p class="text-[11px] font-black uppercase tracking-[0.24em] text-indigo-200">Procedural Note</p>
          <p class="mt-2 text-sm font-medium leading-6 text-white">{{ evidencePanel.proceduralNote }}</p>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LawEvidencePanelComponent {
  readonly config = input<PanelConfig | null>(null);
}
