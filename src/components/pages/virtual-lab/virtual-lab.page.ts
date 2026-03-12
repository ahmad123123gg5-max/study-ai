import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocalizationService } from '../../../services/localization.service';
import { ClinicalProgressPageComponent } from './pages/clinical-progress-page.component';
import { ClinicalCaseReviewPageComponent } from './pages/clinical-case-review-page.component';
import { SimulationChatPageComponent } from './pages/simulation-chat-page.component';
import { SimulationSetupPageComponent } from './pages/simulation-setup-page.component';
import { VirtualLabSessionService } from './services/virtual-lab-session.service';

@Component({
  selector: 'app-virtual-lab-page',
  standalone: true,
  imports: [
    CommonModule,
    ClinicalProgressPageComponent,
    ClinicalCaseReviewPageComponent,
    SimulationSetupPageComponent,
    SimulationChatPageComponent
  ],
  template: `
    <div class="relative flex h-full min-h-0 flex-col overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.15),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,_rgba(2,6,23,0.96),_rgba(15,23,42,1))]">
      <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:56px_56px] opacity-20"></div>

      <div class="relative z-10 flex items-center justify-between px-4 py-4 md:px-6">
        <button type="button" (click)="back.emit()" class="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10">
          <i class="fa-solid fa-arrow-left"></i>
          <span>{{ ui('العودة إلى اللوحة', 'Back to Overview') }}</span>
        </button>

        <div class="flex flex-wrap justify-end gap-2">
          <button type="button" (click)="session.openProgressPage()" class="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/16">
            <i class="fa-solid fa-notes-medical"></i>
            <span>{{ ui('Clinical Progress', 'Clinical Progress') }}</span>
          </button>

          @if (session.route() === 'simulation-session' || session.route() === 'simulation-progress' || session.route() === 'simulation-review') {
            <button type="button" (click)="session.resetToSetup()" class="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10">
              <i class="fa-solid fa-sliders"></i>
              <span>{{ ui('إعداد المحاكاة', 'Simulation Setup') }}</span>
            </button>
          }
        </div>
      </div>

      <div [class]="contentClass()">
        @switch (session.route()) {
          @case ('simulation-session') { <app-simulation-chat-page></app-simulation-chat-page> }
          @case ('simulation-progress') { <app-clinical-progress-page></app-clinical-progress-page> }
          @case ('simulation-review') { <app-clinical-case-review-page></app-clinical-case-review-page> }
          @default { <app-simulation-setup-page></app-simulation-setup-page> }
        }
      </div>
    </div>
  `,
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VirtualLabPage {
  readonly back = output<void>();
  readonly session = inject(VirtualLabSessionService);
  private readonly localization = inject(LocalizationService);
  readonly isArabic = computed(() => this.localization.currentLanguage() === 'ar');
  readonly isImmersiveRoute = computed(() => this.session.route() === 'simulation-session');
  readonly contentClass = computed(() => this.isImmersiveRoute()
    ? 'relative z-10 min-h-0 flex-1 overflow-hidden'
    : 'relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden');

  ui(arabic: string, english: string) {
    return this.isArabic() ? arabic : english;
  }
}
