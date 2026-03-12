import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelConfig } from '../models/virtual-lab.models';

@Component({
  selector: 'app-ecg-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (config()?.ecg; as ecg) {
      <div class="space-y-4">
        <div class="overflow-hidden rounded-[1.6rem] border border-emerald-400/20 bg-slate-950 shadow-inner">
          <img [src]="assetPath()" [alt]="ecg.caption" class="h-auto w-full">
        </div>

        <div class="grid grid-cols-2 gap-2">
          @for (preset of presets; track preset.value) {
            <div class="rounded-2xl border px-3 py-2 text-center text-xs font-black uppercase tracking-[0.22em]"
                 [class.border-emerald-400]="ecg.preset === preset.value"
                 [class.bg-emerald-500/10]="ecg.preset === preset.value"
                 [class.text-emerald-200]="ecg.preset === preset.value"
                 [class.border-white/10]="ecg.preset !== preset.value"
                 [class.text-slate-400]="ecg.preset !== preset.value">
              {{ preset.label }}
            </div>
          }
        </div>

        <div class="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
          <p class="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Interpretation Cue</p>
          <p class="mt-2 text-sm font-medium leading-6 text-white">{{ ecg.caption }}</p>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EcgPanelComponent {
  readonly config = input<PanelConfig | null>(null);

  readonly presets = [
    { value: 'normal', label: 'Normal' },
    { value: 'stemi', label: 'STEMI' },
    { value: 'af', label: 'AF' },
    { value: 'vtach', label: 'VTach' }
  ] as const;

  readonly assetPath = computed(() => {
    const preset = this.config()?.ecg?.preset || 'normal';
    return `assets/virtual-lab/ecg/${preset}.svg`;
  });
}
