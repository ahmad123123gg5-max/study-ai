import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkspaceViewMode } from '../document-workspace.types';

@Component({
  selector: 'app-view-mode-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm">
      @for (option of options; track option.id) {
        <button
          (click)="modeChange.emit(option.id)"
          class="rounded-full px-3 py-2 text-xs font-semibold transition"
          [class.bg-slate-900]="mode() === option.id"
          [class.text-white]="mode() === option.id"
          [class.text-slate-600]="mode() !== option.id"
          [class.hover:text-slate-900]="mode() !== option.id"
        >
          <i [class]="option.icon + ' mr-2'"></i>{{ option.label }}
        </button>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ViewModeToggleComponent {
  mode = input<WorkspaceViewMode>('reading');
  modeChange = output<WorkspaceViewMode>();

  protected readonly options: Array<{ id: WorkspaceViewMode; label: string; icon: string }> = [
    { id: 'reading', label: 'Read', icon: 'fa-solid fa-book-open' },
    { id: 'annotation', label: 'Annotate', icon: 'fa-solid fa-pen-ruler' },
    { id: 'translation', label: 'Translate', icon: 'fa-solid fa-language' },
    { id: 'focus', label: 'Focus', icon: 'fa-solid fa-expand' }
  ];
}
