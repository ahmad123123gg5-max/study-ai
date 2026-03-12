import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelConfig } from '../models/virtual-lab.models';

@Component({
  selector: 'app-programming-console-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (config()?.console; as consolePanel) {
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-[1.3rem] border border-white/10 bg-white/5 p-4">
            <p class="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Environment</p>
            <p class="mt-2 text-sm font-black text-white">{{ consolePanel.environment }}</p>
          </div>
          <div class="rounded-[1.3rem] border border-white/10 bg-white/5 p-4">
            <p class="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Focus File</p>
            <p class="mt-2 break-all text-sm font-black text-white">{{ consolePanel.focusFile }}</p>
          </div>
        </div>

        <div class="rounded-[1.5rem] border border-white/10 bg-slate-950 p-4">
          <div class="mb-3 flex items-center justify-between">
            <p class="text-xs font-black uppercase tracking-[0.24em] text-emerald-300">Live Output</p>
            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
              {{ consolePanel.status }}
            </span>
          </div>
          <div class="space-y-2 font-mono text-xs leading-6">
            @for (line of consolePanel.logs; track line.text) {
              <p [class.text-emerald-300]="line.level === 'success'"
                 [class.text-rose-300]="line.level === 'error'"
                 [class.text-amber-300]="line.level === 'warn'"
                 [class.text-slate-300]="line.level === 'info'">
                [{{ line.level.toUpperCase() }}] {{ line.text }}
              </p>
            }
          </div>
        </div>

        <div class="rounded-[1.4rem] border border-cyan-400/20 bg-cyan-500/10 p-4">
          <p class="text-[11px] font-black uppercase tracking-[0.24em] text-cyan-200">Next Hint</p>
          <p class="mt-2 text-sm font-medium leading-6 text-white">{{ consolePanel.nextHint }}</p>
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProgrammingConsolePanelComponent {
  readonly config = input<PanelConfig | null>(null);
}
