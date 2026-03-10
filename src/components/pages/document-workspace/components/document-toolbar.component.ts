import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentSession } from '../document-workspace.types';

@Component({
  selector: 'app-document-toolbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header
      class="sticky top-3 z-[60] flex items-center gap-2 rounded-[1.2rem] border border-white/10 bg-slate-950/72 px-3 py-2 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      role="banner"
      aria-label="Document bar"
    >
      <div class="flex items-center gap-2">
        <button
          type="button"
          (click)="back.emit()"
          aria-label="Back to dashboard overview"
          class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-indigo-400/35 hover:bg-indigo-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/15 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <i class="fa-solid fa-arrow-left text-sm"></i>
        </button>

        <button
          type="button"
          (click)="openFile.emit()"
          aria-label="Open document file"
          class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-indigo-400/35 hover:bg-indigo-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/15 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <i class="fa-solid fa-folder-open text-sm"></i>
        </button>

        <button
          type="button"
          (click)="save.emit()"
          aria-label="Save workspace"
          class="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-indigo-400/35 hover:bg-indigo-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/15 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <i class="fa-solid fa-floppy-disk text-sm"></i>
        </button>

        <button
          type="button"
          (click)="reset.emit()"
          aria-label="Clear current workspace"
          class="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-300 transition hover:border-rose-400/35 hover:bg-rose-500/15 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/15 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <i class="fa-solid fa-trash-can text-sm"></i>
        </button>
      </div>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-white">
          {{ session()?.fileName || 'Open a study document' }}
        </p>
        <p class="truncate text-[11px] text-slate-400">
          {{ session() ? 'Study workspace' : 'Choose the file you want to study first' }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        @if (session()) {
          <div class="hidden sm:flex items-center gap-1 rounded-[1rem] border border-white/10 bg-white/5 px-1.5 py-1">
            <button
              type="button"
              (click)="previousPage.emit()"
              [disabled]="(session()?.currentPage || 1) <= 1"
              aria-label="Previous page"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-200 transition hover:bg-indigo-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i class="fa-solid fa-chevron-left text-xs"></i>
            </button>

            <input
              type="number"
              min="1"
              [max]="session()?.totalPages || 1"
              [value]="pageInputValue()"
              (input)="updatePageDraft($any($event.target).value)"
              (change)="submitPageInput($any($event.target).value)"
              (keydown.enter)="submitPageInput($any($event.target).value)"
              class="h-8 w-14 rounded-lg border border-white/10 bg-slate-950/55 px-2 text-center text-xs font-semibold text-white outline-none transition focus:border-indigo-400/40"
              aria-label="Current page number"
            />

            <span class="min-w-[2.8rem] text-center text-[11px] font-medium text-slate-300">
              / {{ session()?.totalPages }}
            </span>

            <button
              type="button"
              (click)="nextPage.emit()"
              [disabled]="(session()?.currentPage || 1) >= (session()?.totalPages || 1)"
              aria-label="Next page"
              class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-200 transition hover:bg-indigo-500/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <i class="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>

          <span class="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 sm:hidden">
            {{ session()?.currentPage }}/{{ session()?.totalPages }}
          </span>
        }

        <button
          type="button"
          (click)="toggleTools.emit()"
          aria-label="Toggle reader tools"
          class="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-indigo-400/35 hover:bg-indigo-500/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/15 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          [class.border-indigo-400/35]="toolsExpanded()"
          [class.bg-indigo-500/10]="toolsExpanded()"
          [class.text-white]="toolsExpanded()"
        >
          <i class="fa-solid fa-sliders text-sm"></i>
        </button>
      </div>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentToolbarComponent {
  session = input<DocumentSession | null>(null);
  toolsExpanded = input(true);

  back = output<void>();
  openFile = output<void>();
  save = output<void>();
  reset = output<void>();
  toggleTools = output<void>();
  previousPage = output<void>();
  nextPage = output<void>();
  jumpToPage = output<number>();

  protected readonly pageInputValue = signal('1');

  constructor() {
    effect(() => {
      this.pageInputValue.set(String(this.session()?.currentPage || 1));
    });
  }

  protected submitPageInput(value: string) {
    const session = this.session();
    if (!session) {
      return;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      this.pageInputValue.set(String(session.currentPage));
      return;
    }

    const nextPage = Math.min(session.totalPages, Math.max(1, Math.floor(parsed)));
    this.pageInputValue.set(String(nextPage));
    this.jumpToPage.emit(nextPage);
  }

  protected updatePageDraft(value: string) {
    this.pageInputValue.set(value);
  }
}
