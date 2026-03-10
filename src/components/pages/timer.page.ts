
import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerService } from '../../services/timer.service';
import { LocalizationService } from '../../services/localization.service';

@Component({
  selector: 'app-timer-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700 pb-20">
      <div class="text-center space-y-4">
        <h2 class="text-4xl md:text-6xl font-black text-white tracking-tighter">{{ uiLabels().title }} ⏱️</h2>
        <p class="text-slate-400 font-bold text-lg md:text-xl">{{ uiLabels().subtitle }}</p>
      </div>

      <!-- Main Timer Display -->
      <div class="relative flex flex-col items-center justify-center py-20">
        <!-- Progress Ring -->
        <div class="relative w-64 h-64 md:w-96 md:h-96">
          <svg class="w-full h-full transform -rotate-90">
            <circle class="text-slate-900" stroke-width="12" stroke="currentColor" fill="transparent" r="45%" cx="50%" cy="50%"></circle>
            <circle class="text-indigo-600 transition-all duration-1000" 
                    stroke-width="12" 
                    [attr.stroke-dasharray]="circumference()" 
                    [attr.stroke-dashoffset]="circumference() * (1 - timer.progress())" 
                    stroke-linecap="round" 
                    stroke="currentColor" 
                    fill="transparent" 
                    r="45%" cx="50%" cy="50%"></circle>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center space-y-2">
            <span class="text-6xl md:text-8xl font-black text-white tabular-nums">{{ formatTime(timer.timeLeft()) }}</span>
            <span class="text-xs md:text-sm font-black text-slate-500 uppercase tracking-[0.3em]">{{ timer.currentMode() }}</span>
            @if (timer.isActive()) {
              <div class="flex items-center gap-1 text-amber-400 animate-bounce mt-2">
                <i class="fa-solid fa-coins text-[10px]"></i>
                <span class="text-[10px] font-black">{{ t('+1 XP / min') }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Controls -->
        <div class="flex gap-6 mt-12">
          <button (click)="timer.toggleTimer()" 
                  class="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-white text-3xl shadow-3xl transition-all hover:scale-110 active:scale-90"
                  [class.bg-indigo-600]="!timer.isActive()"
                  [class.bg-rose-600]="timer.isActive()">
            <i class="fa-solid" [class.fa-play]="!timer.isActive()" [class.fa-pause]="timer.isActive()"></i>
          </button>
          <button (click)="timer.resetTimer()" 
                  class="w-20 h-20 md:w-24 md:h-24 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-400 text-2xl hover:text-white transition-all hover:scale-110 active:scale-90">
            <i class="fa-solid fa-rotate-right"></i>
          </button>
        </div>
      </div>

      <!-- Custom Time Input -->
      <div class="glass p-8 rounded-[2.5rem] border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="text-right">
          <h4 class="text-white font-black text-lg">{{ uiLabels().customTimeTitle }}</h4>
          <p class="text-slate-500 text-xs font-bold">{{ uiLabels().customTimeSubtitle }}</p>
        </div>
        <div class="flex items-center gap-4">
          <input #customMin type="number" 
                 [placeholder]="uiLabels().minutes" 
                 class="w-32 p-4 bg-slate-950 rounded-xl border border-white/10 outline-none focus:ring-2 ring-indigo-500 text-white text-center font-black"
                 min="1" max="300">
          <button (click)="timer.setCustomTime(+customMin.value)" 
                  class="bg-indigo-600 text-white px-8 py-4 rounded-xl font-black hover:scale-105 transition shadow-xl">
            {{ uiLabels().setBtn }}
          </button>
        </div>
      </div>

      <!-- Smart Presets -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        @for (preset of timer.presets(); track preset.id) {
          <button (click)="timer.setPreset(preset)" 
                  class="glass p-8 rounded-[2.5rem] border border-white/5 text-right space-y-4 hover:bg-white/5 transition-all group"
                  [class.border-indigo-500/50]="timer.currentPresetId() === preset.id">
            <div class="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition">
              <i [class]="preset.icon"></i>
            </div>
            <div>
              <h4 class="text-white font-black text-lg">{{ preset.label }}</h4>
              <p class="text-slate-500 text-xs font-bold">{{ preset.duration }} {{ uiLabels().minutes }}</p>
            </div>
          </button>
        }
      </div>

      <!-- Smart AI Insight -->
      <div class="glass p-10 rounded-[4rem] border border-indigo-500/20 bg-indigo-600/5 relative overflow-hidden group">
        <div class="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
          <div class="text-right space-y-4 flex-1">
            <div class="inline-flex items-center gap-3 bg-indigo-500/20 text-indigo-400 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/30">
              <i class="fa-solid fa-brain"></i> {{ uiLabels().aiAdviceTitle }}
            </div>
            <p class="text-white font-bold text-lg md:text-xl leading-relaxed italic">
              "{{ timer.aiAdvice() }}"
            </p>
          </div>
          <button (click)="timer.refreshAdvice()" 
                  [disabled]="timer.isGeneratingAdvice()"
                  class="w-14 h-14 rounded-2xl glass border border-white/10 flex items-center justify-center text-indigo-400 hover:bg-white/10 transition disabled:opacity-50">
            <i class="fa-solid fa-wand-magic-sparkles" [class.animate-spin]="timer.isGeneratingAdvice()"></i>
          </button>
        </div>
        <div class="absolute -right-20 -bottom-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px]"></div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .shadow-3xl { box-shadow: 0 20px 40px rgba(79,70,229,0.3); }
  `]
})
export class TimerPage {
  timer = inject(TimerService);
  private readonly localization = inject(LocalizationService);

  circumference = signal(2 * Math.PI * 45);
  readonly t = (text: string) => this.localization.phrase(text);

  uiLabels = computed(() => {
    return {
      title: this.t('Smart Timer'),
      subtitle: this.t('Organize your time smartly with global focus techniques'),
      minutes: this.t('minute'),
      aiAdviceTitle: this.t('AI Insight'),
      customTimeTitle: this.t('Custom Time'),
      customTimeSubtitle: this.t('Set the minutes that fit your schedule'),
      setBtn: this.t('Set')
    };
  });

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

