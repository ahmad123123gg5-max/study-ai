
import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AIService } from '../../services/ai.service';
import { LocalizationService } from '../../services/localization.service';

@Component({
  selector: 'app-teacher-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">
      @if (ai.userRole() !== 'teacher' && ai.userRole() !== 'admin') {
        <div class="bg-slate-900 p-16 rounded-[4rem] border border-white/10 text-center shadow-2xl space-y-8">
           <div class="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 text-4xl mx-auto border border-rose-500/20">
             <i class="fa-solid fa-lock"></i>
           </div>
           <div class="space-y-4">
             <h2 class="text-3xl font-black text-white">{{ t('This area is locked') }}</h2>
             <p class="text-slate-400 font-bold text-lg">{{ t('Teacher panel is available only to authorized faculty members.') }}</p>
           </div>
           <button (click)="goHome()" class="bg-white text-slate-950 px-10 py-4 rounded-2xl font-black hover:scale-105 transition shadow-2xl">{{ t('Back to Home') }}</button>
        </div>
      } @else {
        <div class="flex flex-col md:flex-row justify-between items-center gap-6">
           <h2 class="text-4xl font-black text-white">{{ uiLabels().title }} 👨‍🏫</h2>
           <div class="flex gap-4">
              <button class="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition">
                 <i class="fa-solid fa-plus mr-2"></i> {{ uiLabels().newExam }}
              </button>
           </div>
        </div>

        <!-- Academic Dashboard -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
           @for (stat of stats(); track stat.label) {
              <div class="bg-slate-900 p-8 rounded-[3rem] border border-white/5 relative overflow-hidden group">
                 <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{{ stat.label }}</p>
                 <p class="text-3xl font-black text-white" [class.text-emerald-400]="stat.color === 'emerald'">{{ stat.value }}</p>
              </div>
           }
        </div>

        <!-- General Academic Progress (Non-Personal) -->
        <div class="bg-slate-900 p-10 rounded-[4rem] border border-white/10 text-right shadow-2xl space-y-10">
           <div class="flex justify-between items-center border-b border-white/5 pb-8">
              <h3 class="text-2xl font-black text-white">{{ uiLabels().recordsTitle }}</h3>
              <span class="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{{ t('Global Academic Monitoring') }}</span>
           </div>

           <div class="py-20 text-center opacity-30">
              <p class="text-xl font-bold">{{ t('Personal goal records are hidden based on the new privacy policy.') }}</p>
              <p class="text-sm mt-2">{{ t('Only aggregated academic statistics are shown.') }}</p>
           </div>
        </div>
      }
    </div>
  `,
  styles: [`:host { display: block; }`]
})
export class TeacherPage {
  ai = inject(AIService);
  private readonly localization = inject(LocalizationService);
  readonly t = (text: string) => this.localization.phrase(text);

  goHome() {
    // This is a hacky way to access parent component, but works for this demo
    ((window as unknown as Record<string, unknown>)['appComponent'] as { activePage: { set: (page: string) => void } })?.activePage.set('overview');
  }

  private readonly statBlueprints = [
    { label: 'Total Students', value: '142', icon: 'fa-solid fa-users', color: 'white' },
    { label: 'Overall Success Rate', value: '89%', icon: 'fa-solid fa-graduation-cap', color: 'emerald' },
    { label: 'Completed Assessments', value: '4.2k', icon: 'fa-solid fa-check-double', color: 'white' },
    { label: 'Platform Engagement', value: '92%', icon: 'fa-solid fa-bolt', color: 'white' }
  ] as const;

  stats = computed(() => this.statBlueprints.map((stat) => ({
    ...stat,
    label: this.t(stat.label)
  })));

  uiLabels = computed(() => {
    return {
      title: this.t('Academic Supervision Portal'),
      newExam: this.t('Create Institutional Exam'),
      recordsTitle: this.t('Global Academic Performance Analytics')
    };
  });
}

