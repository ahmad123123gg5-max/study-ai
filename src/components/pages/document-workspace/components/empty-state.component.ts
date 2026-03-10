import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-document-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="flex h-full min-h-[240px] flex-col items-center justify-center rounded-[2rem] border border-slate-200/80 bg-white/85 px-8 py-10 text-center shadow-[0_24px_80px_-32px_rgba(15,23,42,0.25)]"
    >
      <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
        <i [class]="icon()"></i>
      </div>
      @if (eyebrow()) {
        <p class="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">{{ eyebrow() }}</p>
      }
      <h3 class="text-xl font-semibold tracking-tight text-slate-900">{{ title() }}</h3>
      <p class="mt-3 max-w-md text-sm leading-6 text-slate-500">{{ description() }}</p>
      <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyStateComponent {
  icon = input('fa-solid fa-book-open');
  eyebrow = input('');
  title = input('Nothing here yet');
  description = input('Open a document to start studying in the workspace.');
}
