import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-document-loading-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex h-full min-h-[240px] flex-col items-center justify-center gap-5 rounded-[2rem] border border-slate-200 bg-white/90 p-10 text-center">
      <div class="relative h-12 w-12">
        <div class="absolute inset-0 rounded-full border-4 border-slate-200"></div>
        <div class="absolute inset-0 animate-spin rounded-full border-4 border-slate-900 border-t-transparent"></div>
      </div>
      <div class="space-y-2">
        <h3 class="text-lg font-semibold text-slate-900">{{ title() }}</h3>
        <p class="max-w-md text-sm text-slate-500">{{ description() }}</p>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingStateComponent {
  title = input('Preparing document workspace');
  description = input('Loading pages, text layers, and your saved study state.');
}
