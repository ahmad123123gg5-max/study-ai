import { ChangeDetectionStrategy, Component, ElementRef, effect, input, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SimulationMessage } from '../models/virtual-lab.models';

@Component({
  selector: 'app-simulation-message-list',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      #scroller
      class="flex h-full flex-col gap-3 overflow-y-auto pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(71,85,105,0.95)_transparent] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600/90 [&::-webkit-scrollbar-track]:bg-transparent"
      [attr.dir]="language() === 'ar' ? 'rtl' : 'ltr'"
    >
      @for (message of messages(); track message.id) {
        <div class="flex" [class.justify-end]="message.role === 'user'">
          <div
            class="max-w-[98%] rounded-[1.9rem] px-5 py-4 shadow-lg md:max-w-[92%] lg:max-w-[90%]"
            [class.bg-indigo-500]="message.role === 'user'"
            [class.text-white]="message.role === 'user'"
            [class.bg-slate-900]="message.role === 'assistant'"
            [class.border]="message.role !== 'user'"
            [class.border-white/10]="message.role !== 'user'"
            [class.text-slate-100]="message.role !== 'user'"
            [class.bg-amber-500/10]="message.role === 'system'"
            [class.border-amber-400/20]="message.role === 'system'"
          >
            <p class="mb-2 text-[11px] font-black uppercase tracking-[0.24em]"
               [class.text-indigo-100]="message.role === 'user'"
               [class.text-slate-400]="message.role === 'assistant'"
               [class.text-amber-200]="message.role === 'system'">
              {{ roleLabel(message.role) }}
            </p>
            <p class="whitespace-pre-wrap text-[16px] font-medium leading-8 text-balance md:text-[18px]">{{ message.text }}</p>
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimulationMessageListComponent {
  readonly messages = input<SimulationMessage[]>([]);
  readonly language = input<'ar' | 'en'>('en');
  private readonly scroller = viewChild<ElementRef<HTMLDivElement>>('scroller');

  constructor() {
    effect(() => {
      this.messages();
      queueMicrotask(() => {
        const element = this.scroller()?.nativeElement;
        if (element) {
          element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
        }
      });
    });
  }

  roleLabel(role: SimulationMessage['role']) {
    if (this.language() === 'ar') {
      if (role === 'user') return 'أنت';
      if (role === 'system') return 'النظام';
      return 'المحاكاة';
    }

    if (role === 'user') return 'You';
    if (role === 'system') return 'System';
    return 'Simulation';
  }
}
