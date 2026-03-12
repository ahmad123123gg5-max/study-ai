import { Injectable, computed, signal } from '@angular/core';
import { TimerConfig } from '../models/virtual-lab.models';

@Injectable({ providedIn: 'root' })
export class VirtualLabTimerService {
  private intervalId: number | null = null;
  private expireHandler: (() => void) | null = null;

  readonly config = signal<TimerConfig | null>(null);
  readonly timeLeftSeconds = signal(0);
  readonly activeToken = signal<string | null>(null);
  readonly isRunning = signal(false);

  readonly hasTimer = computed(() => !!this.config()?.enabled);
  readonly formattedTime = computed(() => {
    const totalSeconds = Math.max(0, this.timeLeftSeconds());
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  arm(config: TimerConfig | null, promptToken: string, onExpire: () => void) {
    this.stop();
    this.config.set(config);
    this.activeToken.set(promptToken);
    this.expireHandler = onExpire;

    if (!config?.enabled || !config.autoStart) {
      this.timeLeftSeconds.set(Math.max(0, config?.seconds || 0));
      return;
    }

    this.timeLeftSeconds.set(Math.max(0, Math.round(config.seconds)));
    this.isRunning.set(true);
    this.intervalId = window.setInterval(() => {
      this.timeLeftSeconds.update((current) => {
        if (current <= 1) {
          this.finish();
          return 0;
        }

        return current - 1;
      });
    }, 1000);
  }

  stop() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning.set(false);
  }

  clear() {
    this.stop();
    this.config.set(null);
    this.activeToken.set(null);
    this.timeLeftSeconds.set(0);
    this.expireHandler = null;
  }

  private finish() {
    const handler = this.expireHandler;
    this.stop();
    this.expireHandler = null;
    if (handler) {
      handler();
    }
  }
}
