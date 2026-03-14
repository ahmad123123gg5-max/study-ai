
import { Injectable, signal, computed, inject } from '@angular/core';
import { AIService } from './ai.service';
import { NotificationService } from './notification.service';
import { LocalizationService } from './localization.service';

export interface TimerPreset {
  id: string;
  label: string;
  duration: number;
  icon: string;
}

@Injectable({
  providedIn: 'root'
})
export class TimerService {
  private ai = inject(AIService);
  private ns = inject(NotificationService);
  private localization = inject(LocalizationService);

  timeLeft = signal(25 * 60);
  totalTime = signal(25 * 60);
  isActive = signal(false);
  currentPresetId = signal('pomodoro');
  isGeneratingAdvice = signal(false);
  aiAdvice = signal('');
  
  // New: Track current task and elapsed time
  activeTaskId = signal<string | null>(null);
  elapsedSeconds = signal(0);
  timerCompleted = signal<string | null>(null); // Emits taskId when complete

  private timerInterval: ReturnType<typeof setInterval> | null = null;

  private readonly presetBlueprints: TimerPreset[] = [
    { id: 'pomodoro', label: 'Pomodoro (Focus)', duration: 25, icon: 'fa-solid fa-brain' },
    { id: 'short_break', label: 'Short Break', duration: 5, icon: 'fa-solid fa-coffee' },
    { id: 'long_break', label: 'Deep Break', duration: 15, icon: 'fa-solid fa-couch' }
  ];

  presets = computed(() => this.presetBlueprints.map((preset) => ({
    ...preset,
    label: this.localization.phrase(preset.label)
  })));

  progress = computed(() => this.timeLeft() / this.totalTime());

  currentMode = computed(() => {
    const p = this.presets().find(p => p.id === this.currentPresetId());
    return p ? p.label : this.localization.phrase('Custom');
  });

  constructor() {
    this.aiAdvice.set(this.localization.phrase('Start your session now, focus is the key to creativity.'));
    this.refreshAdvice();
  }

  toggleTimer() {
    if (this.isActive()) {
      this.stopTimer();
    } else {
      this.startTimer();
    }
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.isActive.set(true);
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds.update(s => {
        const newSeconds = s + 1;
        // Award 1 XP for every 60 seconds
        if (newSeconds % 60 === 0) {
          this.ai.awardXPForAction('smartTimerMinute', 1);
        }
        return newSeconds;
      });
      this.timeLeft.update(t => {
        if (t <= 0) {
          this.stopTimer();
          this.onTimerComplete();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  stopTimer() {
    this.isActive.set(false);
    if (this.timerInterval) clearInterval(this.timerInterval);
    // If we stop, we might want to sync the elapsed time back to the task
    // But we'll handle that in the page or via an effect if needed
  }

  resetTimer() {
    this.stopTimer();
    this.timeLeft.set(this.totalTime());
  }

  setPreset(preset: TimerPreset) {
    this.currentPresetId.set(preset.id);
    this.totalTime.set(preset.duration * 60);
    this.timeLeft.set(preset.duration * 60);
    this.stopTimer();
    this.refreshAdvice();
  }

  setCustomTime(mins: number) {
    if (isNaN(mins) || mins <= 0) return;
    this.currentPresetId.set('custom');
    this.totalTime.set(mins * 60);
    this.timeLeft.set(mins * 60);
    this.stopTimer();
    this.refreshAdvice();
  }

  startCustomTimer(mins: number, taskId?: string, remainingSeconds?: number) {
    this.activeTaskId.set(taskId || null);
    this.elapsedSeconds.set(0);
    this.timerCompleted.set(null);
    
    if (remainingSeconds !== undefined && remainingSeconds > 0) {
      this.totalTime.set(mins * 60);
      this.timeLeft.set(remainingSeconds);
      this.currentPresetId.set('custom');
      this.stopTimer();
      this.refreshAdvice();
    } else {
      this.setCustomTime(mins);
    }
    this.startTimer();
  }

  async refreshAdvice() {
    this.isGeneratingAdvice.set(true);
    try {
      const lang = this.ai.getLanguageName();
      const mode = this.currentMode();
      const prompt = `Give a short, powerful, and smart motivational advice for a student who is in "${mode}" mode. 
                     The advice should be scientific yet inspiring. 
                     Respond strictly in ${lang}. Max 15 words.`;
      const advice = await this.ai.chat(prompt, 'You are a world-class productivity coach.');
      this.aiAdvice.set(advice);
    } catch (e) {
      console.error(e);
    } finally {
      this.isGeneratingAdvice.set(false);
    }
  }

  resetTimerCompleted() {
    this.timerCompleted.set(null);
  }

  private onTimerComplete() {
    this.refreshAdvice();
    if (this.activeTaskId()) {
      this.timerCompleted.set(this.activeTaskId());
    }
    
    this.ns.show(
      this.localization.phrase('Time is up!'),
      this.localization.phrase('Take a break or start a new session.'),
      'info',
      'fa-stopwatch'
    );
  }
}
