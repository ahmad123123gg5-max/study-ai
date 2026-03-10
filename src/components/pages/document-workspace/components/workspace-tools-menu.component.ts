import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  RecordingSessionState,
  RightPanelKey,
  TranslationViewMode,
  WorkspaceToolKey
} from '../document-workspace.types';

interface WorkspaceToolItem {
  id: WorkspaceToolKey;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-workspace-tools-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section
      class="overflow-x-auto rounded-[1.15rem] border border-white/10 bg-slate-950/74 px-2 py-2 shadow-[0_18px_54px_-32px_rgba(0,0,0,0.62)] backdrop-blur-xl"
      [class.ring-1]="open()"
      [ngClass]="{ 'ring-indigo-400/30': open() }"
      role="toolbar"
      aria-label="Workspace tools"
    >
      <div class="flex min-w-max items-center gap-2">
        <div class="flex items-center gap-1.5">
          @for (tool of primaryTools; track tool.id) {
            <button
              type="button"
              (click)="select.emit(tool.id)"
              class="inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/20"
              [ngClass]="
                isActive(tool.id)
                  ? ['border-indigo-400/45', 'bg-indigo-600/18', 'text-white']
                  : ['border-white/10', 'bg-white/5', 'text-slate-200 hover:border-indigo-400/30 hover:bg-indigo-500/10 hover:text-white']
              "
              [attr.aria-pressed]="isActive(tool.id)"
            >
              <i [class]="tool.icon + ' text-sm'"></i>
              <span class="hidden md:inline">{{ tool.label }}</span>
            </button>
          }
        </div>

        <span class="h-7 w-px bg-white/10" aria-hidden="true"></span>

        <div class="flex items-center gap-1.5">
          @for (tool of utilityTools; track tool.id) {
            <button
              type="button"
              (click)="select.emit(tool.id)"
              class="inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/20"
              [ngClass]="
                isActive(tool.id)
                  ? ['border-indigo-400/45', 'bg-indigo-600/18', 'text-white']
                  : ['border-white/10', 'bg-white/5', 'text-slate-200 hover:border-indigo-400/30 hover:bg-indigo-500/10 hover:text-white']
              "
              [attr.aria-pressed]="isActive(tool.id)"
            >
              <i [class]="tool.icon + ' text-sm'"></i>
              <span class="hidden lg:inline">{{ tool.label }}</span>
            </button>
          }
        </div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkspaceToolsMenuComponent {
  open = input(false);
  activeTool = input<WorkspaceToolKey | null>(null);
  activeRightPanel = input<RightPanelKey>(null);
  translationMode = input<TranslationViewMode>('original');
  recordingState = input<RecordingSessionState | null>(null);
  focusMode = input(false);

  toggle = output<void>();
  select = output<WorkspaceToolKey>();
  close = output<void>();

  protected readonly primaryTools: WorkspaceToolItem[] = [
    { id: 'reader', label: 'Reader', icon: 'fa-solid fa-book-open' },
    { id: 'draw', label: 'Draw', icon: 'fa-solid fa-pen' },
    { id: 'highlight', label: 'Highlight', icon: 'fa-solid fa-highlighter' },
    { id: 'shapes', label: 'Shapes', icon: 'fa-regular fa-square' },
    { id: 'arrow', label: 'Arrow', icon: 'fa-solid fa-arrow-right-long' },
    { id: 'text-note', label: 'Text / Note', icon: 'fa-solid fa-notes-medical' },
    { id: 'eraser', label: 'Eraser', icon: 'fa-solid fa-eraser' }
  ];

  protected readonly utilityTools: WorkspaceToolItem[] = [
    { id: 'translate', label: 'Translate', icon: 'fa-solid fa-language' },
    { id: 'notes', label: 'Notes', icon: 'fa-solid fa-note-sticky' },
    { id: 'recorder', label: 'Record', icon: 'fa-solid fa-microphone-lines' },
    { id: 'focus', label: 'Focus', icon: 'fa-solid fa-expand' }
  ];

  protected isActive(tool: WorkspaceToolKey): boolean {
    if (tool === 'translate') {
      return this.activeTool() === 'translate' || this.translationMode() !== 'original';
    }

    if (tool === 'notes') {
      return this.activeRightPanel() === 'notes';
    }

    if (tool === 'recorder') {
      const status = this.recordingState()?.status;
      return this.activeTool() === 'recorder' || status === 'recording' || status === 'paused';
    }

    if (tool === 'focus') {
      return this.focusMode();
    }

    return this.activeTool() === tool;
  }
}
