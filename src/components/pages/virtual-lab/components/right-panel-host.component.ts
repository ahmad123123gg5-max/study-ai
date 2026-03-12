import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PanelConfig } from '../models/virtual-lab.models';
import { BusinessMetricsPanelComponent } from './business-metrics-panel.component';
import { EcgPanelComponent } from './ecg-panel.component';
import { GenericInsightPanelComponent } from './generic-insight-panel.component';
import { LawEvidencePanelComponent } from './law-evidence-panel.component';
import { MedicalMonitorPanelComponent } from './medical-monitor-panel.component';
import { OperationsBoardPanelComponent } from './operations-board-panel.component';
import { ProgrammingConsolePanelComponent } from './programming-console-panel.component';
import { ScienceChartPanelComponent } from './science-chart-panel.component';

@Component({
  selector: 'app-right-panel-host',
  standalone: true,
  imports: [
    CommonModule,
    MedicalMonitorPanelComponent,
    EcgPanelComponent,
    ProgrammingConsolePanelComponent,
    BusinessMetricsPanelComponent,
    LawEvidencePanelComponent,
    ScienceChartPanelComponent,
    OperationsBoardPanelComponent,
    GenericInsightPanelComponent
  ],
  template: `
    @if (config(); as panel) {
      <section class="flex h-full min-h-0 flex-col rounded-[1.8rem] border border-white/10 bg-slate-950/85 p-4 shadow-xl">
        <div class="mb-4 shrink-0 border-b border-white/10 pb-4">
          <p class="text-[11px] font-black uppercase tracking-[0.26em] text-slate-500">Dynamic Visual Panel</p>
          <h3 class="mt-2 text-xl font-black text-white">{{ panel.title }}</h3>
          <p class="mt-1 text-sm font-medium text-slate-400">{{ panel.subtitle }}</p>
          <p class="mt-3 text-sm font-medium leading-7 text-slate-300">{{ panel.summary }}</p>
        </div>

        <div class="min-h-0 flex-1 overflow-hidden">
          @switch (panel.type) {
            @case ('medical-monitor') { <app-medical-monitor-panel [config]="panel"></app-medical-monitor-panel> }
            @case ('ecg') { <app-ecg-panel [config]="panel"></app-ecg-panel> }
            @case ('programming-console') { <app-programming-console-panel [config]="panel"></app-programming-console-panel> }
            @case ('business-metrics') { <app-business-metrics-panel [config]="panel"></app-business-metrics-panel> }
            @case ('law-evidence') { <app-law-evidence-panel [config]="panel"></app-law-evidence-panel> }
            @case ('science-chart') { <app-science-chart-panel [config]="panel"></app-science-chart-panel> }
            @case ('operations-board') { <app-operations-board-panel [config]="panel"></app-operations-board-panel> }
            @default { <app-generic-insight-panel [config]="panel"></app-generic-insight-panel> }
          }
        </div>
      </section>
    } @else {
      <section class="h-full rounded-[1.8rem] border border-dashed border-white/10 bg-slate-950/50 p-6 text-center text-sm font-medium text-slate-500">
        Visual panel data will appear here as the scenario unfolds.
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RightPanelHostComponent {
  readonly config = input<PanelConfig | null>(null);
}
