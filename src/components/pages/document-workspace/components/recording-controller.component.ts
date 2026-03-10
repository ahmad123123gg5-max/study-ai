import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecordingSessionState } from '../document-workspace.types';

@Component({
  selector: 'app-recording-controller',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm" aria-live="polite">
      <div
        class="flex h-8 items-center gap-2 rounded-full px-3"
        [class.bg-rose-50]="isActive()"
        [class.text-rose-700]="isActive()"
        [class.bg-amber-50]="isPaused()"
        [class.text-amber-700]="isPaused()"
        [class.bg-slate-100]="!isActive() && !isPaused()"
        [class.text-slate-600]="!isActive() && !isPaused()"
      >
        <span
          class="h-2.5 w-2.5 rounded-full"
          [class.animate-pulse]="isActive()"
          [class.bg-rose-500]="isActive()"
          [class.bg-amber-500]="isPaused()"
          [class.bg-slate-400]="!isActive() && !isPaused()"
        ></span>
        <span class="text-[11px] font-semibold uppercase tracking-[0.22em]">
          {{ isActive() ? 'Recording' : isPaused() ? 'Paused' : 'Recorder' }}
        </span>
      </div>

      <span class="min-w-[68px] text-center text-sm font-semibold tabular-nums text-slate-700" aria-label="Recording time elapsed">
        {{ elapsedLabel() }}
      </span>

      @if (isActive() || isPaused()) {
        <span class="hidden rounded-full bg-slate-100 px-3 py-2 text-[11px] font-medium text-slate-600 xl:inline-flex">
          Session-wide
        </span>
      }

      @if (state().status === 'idle' || state().status === 'stopped') {
        <button
          (click)="start.emit()"
          type="button"
          aria-label="Start lecture recording"
          class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 focus-visible:ring-offset-2"
          title="Start recording"
        >
          <i class="fa-solid fa-microphone"></i>
        </button>
      }

      @if (state().status === 'recording') {
        <button
          (click)="pause.emit()"
          type="button"
          aria-label="Pause lecture recording"
          class="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 text-white transition hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/20 focus-visible:ring-offset-2"
          title="Pause recording"
        >
          <i class="fa-solid fa-pause"></i>
        </button>
      }

      @if (state().status === 'paused') {
        <button
          (click)="resume.emit()"
          type="button"
          aria-label="Resume lecture recording"
          class="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/20 focus-visible:ring-offset-2"
          title="Resume recording"
        >
          <i class="fa-solid fa-play"></i>
        </button>
      }

      @if (state().status === 'recording' || state().status === 'paused') {
        <button
          (click)="stop.emit()"
          type="button"
          aria-label="Stop lecture recording"
          class="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 text-white transition hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/20 focus-visible:ring-offset-2"
          title="Stop recording"
        >
          <i class="fa-solid fa-stop"></i>
        </button>
      }

      @if (state().blobUrl) {
        <a
          [href]="state().blobUrl"
          [download]="state().fileName || 'lecture-recording.webm'"
          class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 focus-visible:ring-offset-2"
          title="Download recording"
        >
          <i class="fa-solid fa-download"></i>
        </a>
      }

      @if (state().permission === 'denied' || state().permission === 'unsupported') {
        <span class="rounded-full bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">
          {{ state().permission === 'denied' ? 'Mic denied' : 'Not supported' }}
        </span>
      }

      @if (state().restoredFromInterruptedSession) {
        <span class="rounded-full bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
          Recovered metadata
        </span>
      }

      @if (state().status === 'stopped' && state().blobUrl) {
        <span class="rounded-full bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">
          Saved locally
        </span>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecordingControllerComponent {
  state = input.required<RecordingSessionState>();

  start = output<void>();
  pause = output<void>();
  resume = output<void>();
  stop = output<void>();

  isActive = computed(() => this.state().status === 'recording');
  isPaused = computed(() => this.state().status === 'paused');
  elapsedLabel = computed(() => this.formatDuration(this.state().elapsedMs));

  private formatDuration(value: number): string {
    const totalSeconds = Math.floor(value / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
}
