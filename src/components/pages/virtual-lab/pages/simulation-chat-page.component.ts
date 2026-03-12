import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RightPanelHostComponent } from '../components/right-panel-host.component';
import { SimulationCaseSummaryComponent } from '../components/simulation-case-summary.component';
import { SimulationHeaderComponent } from '../components/simulation-header.component';
import { SimulationInputComponent } from '../components/simulation-input.component';
import { SimulationMessageListComponent } from '../components/simulation-message-list.component';
import { SimulationEngineService } from '../services/simulation-engine.service';
import { VirtualLabSessionService } from '../services/virtual-lab-session.service';

@Component({
  selector: 'app-simulation-chat-page',
  standalone: true,
  imports: [
    CommonModule,
    SimulationHeaderComponent,
    SimulationCaseSummaryComponent,
    SimulationMessageListComponent,
    SimulationInputComponent,
    RightPanelHostComponent
  ],
  template: `
    <div class="relative flex h-full min-h-0 flex-col gap-3 overflow-hidden px-3 py-3 md:px-5 md:py-5">
      @if (criticalAlert()) {
        <div class="pointer-events-none absolute inset-0 z-[80] overflow-hidden">
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.30),transparent_26%),radial-gradient(circle_at_top_right,rgba(239,68,68,0.24),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(239,68,68,0.24),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(239,68,68,0.32),transparent_28%)] animate-pulse"></div>
          <div class="absolute inset-0 rounded-[2rem] border border-rose-400/25 shadow-[inset_0_0_140px_rgba(239,68,68,0.16),0_0_80px_rgba(239,68,68,0.08)] animate-[pulse_1.1s_ease-in-out_infinite]"></div>
        </div>
        <div class="pointer-events-none absolute inset-x-4 top-24 z-[111] flex justify-center px-4 md:px-5">
          <div class="w-full max-w-3xl rounded-[1.5rem] border border-rose-400/35 bg-rose-500/20 px-5 py-4 text-rose-50 shadow-2xl backdrop-blur-xl">
            <div class="flex items-start gap-4">
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-rose-300/20 bg-black/20 text-lg">
                <i class="fa-solid fa-triangle-exclamation animate-pulse"></i>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-black uppercase tracking-[0.28em] opacity-80">{{ ui('إنذار حرج', 'Critical Alert') }}</p>
                <p class="mt-2 text-base font-semibold leading-7">
                  {{ ui('الحالة دخلت مرحلة شديدة الخطورة. ما زال لديك وقت للتدخل، لكن يجب أن تتحرك الآن قبل انتهاء المؤقت.', 'The case has entered a severe critical state. You still have time to intervene, but you need to act now before the timer ends.') }}
                </p>
              </div>
            </div>
          </div>
        </div>
      }

      <app-simulation-header
        [meta]="engine.sessionMeta()"
        [timer]="engine.timer.config()"
        [formattedTime]="engine.timer.formattedTime()"
        [score]="engine.currentScore()"
        [language]="language()"
        (back)="handleBack()"
        (togglePanel)="mobilePanelOpen.set(true)"
      ></app-simulation-header>

      @if (engine.activeFeedback(); as feedback) {
        <div class="pointer-events-none absolute inset-x-0 top-24 z-[110] flex justify-center px-4 md:px-5">
          <div
            class="w-full max-w-2xl rounded-[1.5rem] border px-5 py-4 shadow-2xl backdrop-blur-xl transition-all duration-300"
            [class.border-emerald-400/30]="feedback.tone === 'positive'"
            [class.bg-emerald-500/18]="feedback.tone === 'positive'"
            [class.text-emerald-50]="feedback.tone === 'positive'"
            [class.border-sky-400/30]="feedback.tone === 'neutral'"
            [class.bg-sky-500/16]="feedback.tone === 'neutral'"
            [class.text-sky-50]="feedback.tone === 'neutral'"
            [class.border-rose-400/40]="feedback.tone === 'negative'"
            [class.bg-rose-500/20]="feedback.tone === 'negative'"
            [class.text-rose-50]="feedback.tone === 'negative'"
          >
            <div class="flex items-start gap-4">
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-lg">
                <i class="{{ feedback.icon }}"></i>
              </div>
              <div class="min-w-0">
                <p class="text-sm font-black uppercase tracking-[0.28em] opacity-80">{{ feedback.title }}</p>
                <p class="mt-2 text-base font-semibold leading-7">{{ feedback.message }}</p>
              </div>
            </div>
          </div>
        </div>
      }

      @if (engine.caseSummary(); as summary) {
        <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <app-simulation-case-summary [summary]="summary" [language]="language()"></app-simulation-case-summary>
          <div class="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              (click)="session.openProgressPage()"
              class="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/16"
            >
              {{ ui('اذهب إلى السجل السريري', 'Open Clinical Progress') }}
            </button>
            <button
              type="button"
              (click)="startNewCase()"
              class="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
            >
              {{ ui('ابدأ حالة جديدة', 'Start New Case') }}
            </button>
          </div>
        </div>
      } @else {
        <div class="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]">
          <section class="flex h-full min-h-0 flex-col gap-2.5 rounded-[2rem] border border-white/10 bg-slate-950/78 p-2 shadow-xl md:p-2.5"
                   [ngClass]="criticalShellClasses()">
            <div class="flex flex-wrap items-center gap-2 rounded-[1.4rem] border border-white/8 bg-white/5 px-4 py-2.5">
              <span class="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-black text-cyan-100">{{ engine.sessionMeta()?.specialtyLabel || engine.sessionMeta()?.title }}</span>
              <span class="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-[11px] font-black text-slate-200">{{ engine.sessionMeta()?.difficultyLabel }}</span>
              <span class="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-100">{{ engine.sessionMeta()?.coachLabel }}</span>
            </div>

            @if (referenceImages().length > 0) {
              <div class="rounded-[1.4rem] border border-white/10 bg-white/[0.03] p-3">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <p class="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">{{ ui('صور مرجعية محلية', 'Local Reference Images') }}</p>
                  <span class="text-[11px] font-bold text-cyan-100">{{ referenceImages().length }} {{ ui('صورة', 'image(s)') }}</span>
                </div>
                <div class="flex gap-3 overflow-x-auto pb-1">
                  @for (image of referenceImages(); track image.id) {
                    <div class="w-28 shrink-0 overflow-hidden rounded-[1.1rem] border border-white/10 bg-slate-900/80">
                      <div class="aspect-square overflow-hidden">
                        <img [src]="image.dataUrl" [alt]="image.name" class="h-full w-full object-cover">
                      </div>
                      <p class="truncate px-3 py-2 text-[11px] font-semibold text-slate-300">{{ image.name }}</p>
                    </div>
                  }
                </div>
              </div>
            }

            <div class="min-h-0 flex-1 overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950/94 p-3 md:p-4">
              <app-simulation-message-list [messages]="engine.messages()" [language]="language()"></app-simulation-message-list>
            </div>

            <app-simulation-input
              [busy]="engine.isBusy()"
              [disabled]="engine.isBusy() || engine.isComplete()"
              [canRequestOptions]="canRequestOptions()"
              [quickOptions]="engine.quickOptions()"
              [language]="language()"
              [placeholder]="inputPlaceholder()"
              (submitted)="engine.submitResponse($event)"
              (optionsRequested)="engine.requestOptions()"
            ></app-simulation-input>
          </section>

          <div class="hidden min-h-0 md:block">
            <div class="sticky top-0 h-full min-h-0">
              <app-right-panel-host [config]="engine.panelConfig()"></app-right-panel-host>
            </div>
          </div>
        </div>
      }
    </div>

    @if (mobilePanelOpen()) {
      <div class="fixed inset-0 z-[120] bg-black/65 backdrop-blur-sm md:hidden" (click)="mobilePanelOpen.set(false)"></div>
      <div class="fixed inset-x-0 bottom-0 z-[121] max-h-[78vh] overflow-y-auto rounded-t-[2rem] border border-white/10 bg-slate-950 p-4 shadow-2xl md:hidden">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-black text-white">{{ ui('اللوحة البصرية', 'Visual Panel') }}</h3>
          <button type="button" (click)="mobilePanelOpen.set(false)" class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <app-right-panel-host [config]="engine.panelConfig()"></app-right-panel-host>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimulationChatPageComponent implements OnDestroy {
  readonly session = inject(VirtualLabSessionService);
  readonly engine = inject(SimulationEngineService);
  readonly mobilePanelOpen = signal(false);
  readonly language = computed<'ar' | 'en'>(() => this.session.simulationConfig()?.language === 'ar' ? 'ar' : 'en');
  readonly referenceImages = computed(() => this.session.simulationConfig()?.referenceImages || []);
  readonly criticalAlert = computed(() => {
    const panel = this.engine.panelConfig();
    return this.engine.isMedicalSession()
      && !this.engine.isComplete()
      && panel?.type === 'medical-monitor'
      && panel.monitor?.severity === 'critical';
  });
  readonly canRequestOptions = computed(() => {
    const messages = this.engine.messages();
    return messages.length > 0
      && messages[messages.length - 1]?.role !== 'user'
      && !this.engine.isBusy()
      && !this.engine.isComplete();
  });
  readonly inputPlaceholder = computed(() => {
    if (this.engine.isComplete()) {
      return this.ui('انتهى هذا المسار من المحاكاة.', 'This simulation path has ended.');
    }

    if (this.engine.isBusy()) {
      return this.ui('تجري معالجة آخر خطوة...', 'Simulation is processing the last move...');
    }

    return this.ui(
      'اكتب الإجراء التالي، أو سجّل صوتك، أو اطلب خيارات.',
      'Type your next action, use voice input, or request options.'
    );
  });

  private sessionKey: string | null = null;

  constructor() {
    effect(() => {
      if (this.session.route() !== 'simulation-session') {
        return;
      }

      const config = this.session.simulationConfig();
      if (!config) {
        this.session.routeTo('simulation-setup');
        return;
      }

      const nextKey = JSON.stringify(config);
      if (this.sessionKey === nextKey && this.engine.messages().length > 0) {
        return;
      }

      this.sessionKey = nextKey;
      void this.engine.startSession(config);
    });
  }

  handleBack() {
    this.mobilePanelOpen.set(false);
    this.session.routeTo('simulation-setup');
  }

  startNewCase() {
    this.engine.reset();
    this.mobilePanelOpen.set(false);
    this.session.resetSimulationState();
    this.session.routeTo('simulation-setup');
  }

  ui(arabic: string, english: string) {
    return this.language() === 'ar' ? arabic : english;
  }

  criticalShellClasses() {
    return {
      'border-rose-400/35 shadow-[0_0_60px_rgba(239,68,68,0.08)]': this.criticalAlert()
    };
  }

  ngOnDestroy() {
    this.engine.reset();
  }
}
