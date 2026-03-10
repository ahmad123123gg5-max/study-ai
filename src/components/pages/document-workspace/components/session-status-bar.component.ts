import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DocumentSession } from '../document-workspace.types';

@Component({
  selector: 'app-session-status-bar',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="flex flex-wrap items-center gap-2 rounded-[1.5rem] border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur">
      <span class="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
        {{ session()?.focusMode ? 'Focus' : (session()?.viewMode || 'reading' | titlecase) }} mode
      </span>
      <span class="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
        {{ session()?.translationViewMode || 'original' | titlecase }}
      </span>
      <span class="rounded-full px-3 py-1 font-medium"
        [class.bg-emerald-50]="saveState() === 'saved'"
        [class.text-emerald-700]="saveState() === 'saved'"
        [class.bg-amber-50]="saveState() === 'saving'"
        [class.text-amber-700]="saveState() === 'saving'"
        [class.bg-rose-50]="saveState() === 'error'"
        [class.text-rose-700]="saveState() === 'error'"
        [class.bg-slate-100]="saveState() === 'idle'"
        [class.text-slate-600]="saveState() === 'idle'"
      >
        {{ saveLabel() }}
      </span>
      <span class="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
        Page {{ session()?.currentPage || 1 }} of {{ session()?.totalPages || 0 }}
      </span>
      @if (session()?.activeRightPanel) {
        <span class="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
          {{ session()?.activeRightPanel | titlecase }} panel
        </span>
      }
      @if (session()?.recording?.status === 'recording') {
        <span class="rounded-full bg-rose-50 px-3 py-1 font-medium text-rose-700">
          Recording live
        </span>
      } @else if (session()?.recording?.status === 'paused') {
        <span class="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-700">
          Recording paused
        </span>
      } @else if (session()?.recording?.status === 'stopped' && session()?.recording?.fileName) {
        <span class="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
          Recording saved
        </span>
      }
      @if (selectionText()) {
        <span class="rounded-full bg-indigo-50 px-3 py-1 font-medium text-indigo-700">
          Selection: {{ selectionText()?.length }} chars
        </span>
      }
      @if (lastSavedAt()) {
        <span class="ml-auto text-slate-400">Saved {{ lastSavedAt() | date:'shortTime' }}</span>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SessionStatusBarComponent {
  session = input<DocumentSession | null>(null);
  saveState = input<'idle' | 'saving' | 'saved' | 'error'>('idle');
  lastSavedAt = input<string | null>(null);
  selectionText = input<string | null>(null);

  saveLabel = computed(() => {
    switch (this.saveState()) {
      case 'saving':
        return 'Saving session';
      case 'saved':
        return 'Session saved';
      case 'error':
        return 'Save failed';
      default:
        return 'Autosave ready';
    }
  });
}
