import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-document-error-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex h-full min-h-[240px] flex-col items-center justify-center rounded-[2rem] border border-rose-200 bg-rose-50/80 px-8 py-10 text-center shadow-[0_24px_80px_-32px_rgba(244,63,94,0.25)]">
      <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600 text-white">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <h3 class="text-xl font-semibold text-rose-950">{{ title() }}</h3>
      <p class="mt-3 max-w-md text-sm leading-6 text-rose-800/80">{{ description() }}</p>
      <button
        (click)="retry.emit()"
        class="mt-6 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
      >
        Try again
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ErrorStateComponent {
  title = input('Unable to load this document');
  description = input('The workspace could not restore the file or its session state.');
  retry = output<void>();
}
