
import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocalizationService } from '../../services/localization.service';

@Component({
  selector: 'app-upgrade-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/80 backdrop-blur-xl z-[999] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div (click)="closeModal.emit()" class="bg-slate-900 border border-white/10 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
        <!-- Header Image/Icon -->
        <div class="h-48 bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center relative overflow-hidden">
          <div class="absolute inset-0 opacity-20">
            <div class="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent scale-150"></div>
          </div>
          <div class="w-24 h-24 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center text-white text-5xl shadow-2xl border border-white/20 z-10">
            <i [class]="icon()"></i>
          </div>
          <!-- Floating Particles -->
          <div class="absolute top-10 left-10 w-2 h-2 bg-white rounded-full animate-ping"></div>
          <div class="absolute bottom-10 right-10 w-3 h-3 bg-indigo-300 rounded-full animate-pulse"></div>
        </div>

        <!-- Content -->
        <div class="p-8 text-center space-y-6">
          <div class="space-y-2">
            <h3 class="text-2xl font-black text-white tracking-tight">{{ t(title()) }}</h3>
            <p class="text-slate-400 leading-relaxed">{{ t(message()) }}</p>
          </div>

          <!-- Feature List (Pro Benefits) -->
          <div class="bg-slate-950/50 rounded-2xl p-4 border border-white/5 text-left space-y-3">
            <div class="flex items-center gap-3 text-xs font-bold text-slate-300">
              <i class="fa-solid fa-circle-check text-emerald-500"></i>
              <span>{{ t('Full access to all virtual labs') }}</span>
            </div>
            <div class="flex items-center gap-3 text-xs font-bold text-slate-300">
              <i class="fa-solid fa-circle-check text-emerald-500"></i>
              <span>{{ t('30 daily AI Teacher questions') }}</span>
            </div>
            <div class="flex items-center gap-3 text-xs font-bold text-slate-300">
              <i class="fa-solid fa-circle-check text-emerald-500"></i>
              <span>{{ t('Advanced analytics & recommendations') }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-col gap-3 pt-2">
            <button (click)="upgradePlan.emit()" 
                    class="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-5 rounded-2xl font-black text-lg transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-indigo-600/20">
              {{ t('Upgrade to Pro ($15)') }}
            </button>
            <button (click)="closeModal.emit()" 
                    class="w-full bg-transparent hover:bg-white/5 text-slate-500 p-4 rounded-2xl font-bold text-sm transition-all">
              {{ t('Maybe later') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class UpgradeModal {
  private readonly localization = inject(LocalizationService);
  readonly t = (text: string) => this.localization.phrase(text);
  
  title = input<string>('Upgrade required');
  message = input<string>('');
  icon = input<string>('fa-solid fa-lock');
  
  closeModal = output<void>();
  upgradePlan = output<void>();
}
