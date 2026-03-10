import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SelectedTextContext } from '../document-workspace.types';

export type SelectionAction =
  | 'explain'
  | 'translate'
  | 'ask'
  | 'simplify'
  | 'highlight'
  | 'add-note'
  | 'copy';

@Component({
  selector: 'app-floating-selection-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (selection()) {
      <div
        role="toolbar"
        aria-label="Selected text actions"
        class="fixed z-[120] flex max-w-[min(680px,calc(100vw-2rem))] flex-wrap items-center gap-1.5 rounded-[1.6rem] border border-slate-200/90 bg-white/96 px-2 py-2 shadow-[0_28px_90px_-36px_rgba(15,23,42,0.45)] backdrop-blur"
        [style.left.px]="menuLeft()"
        [style.top.px]="menuTop()"
      >
        @for (item of actions; track item.id) {
          <button
            (click)="action.emit(item.id)"
            type="button"
            [disabled]="isDisabled(item.id)"
            [attr.aria-label]="item.label"
            class="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-slate-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 focus-visible:ring-offset-2 hover:bg-slate-900 hover:text-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <i [class]="item.icon"></i>
            {{ item.label }}
          </button>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FloatingSelectionMenuComponent {
  selection = input<SelectedTextContext | null>(null);
  busy = input(false);
  action = output<SelectionAction>();
  private readonly viewport = signal(this.readViewport());

  protected readonly actions: Array<{ id: SelectionAction; label: string; icon: string }> = [
    { id: 'explain', label: 'Explain', icon: 'fa-solid fa-sparkles' },
    { id: 'translate', label: 'Translate', icon: 'fa-solid fa-language' },
    { id: 'ask', label: 'Ask AI', icon: 'fa-solid fa-comments' },
    { id: 'simplify', label: 'Simplify', icon: 'fa-solid fa-wand-magic-sparkles' },
    { id: 'highlight', label: 'Highlight', icon: 'fa-solid fa-highlighter' },
    { id: 'add-note', label: 'Add note', icon: 'fa-solid fa-note-sticky' },
    { id: 'copy', label: 'Copy', icon: 'fa-solid fa-copy' }
  ];

  protected menuLeft = computed(() => {
    const rect = this.selection()?.rect;
    if (!rect) {
      return 0;
    }
    const viewport = this.viewport();
    const estimatedWidth = Math.min(620, Math.max(320, viewport.width - 32));
    return Math.min(Math.max(16, rect.x - estimatedWidth / 2), Math.max(16, viewport.width - estimatedWidth - 16));
  });

  protected menuTop = computed(() => {
    const rect = this.selection()?.rect;
    if (!rect) {
      return 0;
    }
    const viewport = this.viewport();
    const preferredTop = rect.y - 76;
    if (preferredTop >= 16) {
      return preferredTop;
    }
    return Math.min(viewport.height - 88, rect.y + rect.height + 16);
  });

  protected isDisabled(action: SelectionAction) {
    return this.busy() && (action === 'explain' || action === 'translate' || action === 'ask' || action === 'simplify');
  }

  @HostListener('window:resize')
  protected handleResize() {
    this.viewport.set(this.readViewport());
  }

  private readViewport() {
    if (typeof window === 'undefined') {
      return { width: 1280, height: 720 };
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }
}
