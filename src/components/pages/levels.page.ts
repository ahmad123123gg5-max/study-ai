import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AIService } from '../../services/ai.service';
import { LocalizationService } from '../../services/localization.service';

@Component({
  selector: 'app-levels-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-4xl mx-auto space-y-8 md:space-y-12 pb-32 animate-in fade-in duration-1000">
      
      <!-- Header Section -->
      <div class="text-center space-y-2 md:space-y-4">
        <h2 class="text-3xl md:text-5xl font-black text-white tracking-tighter">{{ t('True Student Level') }}</h2>
        <p class="text-slate-400 font-bold text-sm md:text-lg">{{ t('Track your academic progress and reach the top') }}</p>
      </div>

      <!-- Level Card -->
      <div class="relative group">
        <div class="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 rounded-2xl md:rounded-[3rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
        <div class="relative glass p-6 md:p-12 rounded-2xl md:rounded-[3rem] border border-white/10 shadow-3xl overflow-hidden text-center space-y-6 md:space-y-8">
          
          <!-- Rank Icon -->
          <div class="relative mx-auto w-32 h-32 md:w-48 md:h-48 flex items-center justify-center">
             <div [class]="'absolute inset-0 rounded-full opacity-20 animate-pulse ' + currentTier().color"></div>
             <div class="absolute inset-2 md:inset-4 border-2 md:border-4 border-white/10 rounded-full animate-spin-slow"></div>
             <i [class]="'fa-solid ' + currentTier().icon + ' text-5xl md:text-8xl drop-shadow-[0_0_30px_rgba(255,255,255,0.5)] ' + currentTier().textColor"></i>
          </div>

          <div class="space-y-1 md:space-y-2">
            <h3 class="text-3xl md:text-6xl font-black text-white tracking-tighter">{{ t(currentTier().name) }} {{ currentTier().rank }}</h3>
            <p class="text-indigo-400 font-black text-base md:text-xl uppercase tracking-widest">{{ t('Level') }} {{ ai.userLevel() }}</p>
          </div>

          <!-- Progress Bar -->
          <div class="space-y-3 md:space-y-4">
            <div class="flex justify-between items-end px-2">
              <span class="text-[8px] md:text-xs font-black text-slate-500 uppercase tracking-widest">{{ t('Current Progress') }}</span>
              <span class="text-white font-black text-lg md:text-2xl tabular-nums">{{ ai.userXP() }} <span class="text-slate-600 text-[10px] md:text-sm">/ {{ ai.getNextLevelXP() }} XP</span></span>
            </div>
            <div class="relative h-4 md:h-6 w-full bg-black/40 rounded-full p-0.5 md:p-1 border border-white/5">
              <div class="h-full bg-gradient-to-r from-indigo-600 to-purple-500 rounded-full transition-all duration-1000 relative overflow-hidden"
                   [style.width.%]="(ai.userXP() / ai.getNextLevelXP()) * 100">
                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2 md:gap-4 pt-4 md:pt-8">
            <div class="glass p-3 md:p-6 rounded-xl md:rounded-2xl border border-white/5 space-y-0.5 md:space-y-1">
              <p class="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">{{ t('Total XP') }}</p>
              <p class="text-sm md:text-2xl font-black text-white">{{ ai.userXP() }}</p>
            </div>
            <div class="glass p-3 md:p-6 rounded-xl md:rounded-2xl border border-white/5 space-y-0.5 md:space-y-1">
              <p class="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">{{ t('Rank') }}</p>
              <p class="text-sm md:text-2xl font-black text-indigo-400 truncate">{{ t(currentTier().name) }}</p>
            </div>
            <div class="glass p-3 md:p-6 rounded-xl md:rounded-2xl border border-white/5 space-y-0.5 md:space-y-1">
              <p class="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest">{{ t('Level') }}</p>
              <p class="text-sm md:text-2xl font-black text-amber-500">{{ ai.userLevel() }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Tiers Preview -->
      <div class="space-y-8">
        <h3 class="text-2xl font-black text-white px-4">{{ t('Rank Roadmap') }}</h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          @for (tier of allTiers; track tier.name) {
            <div class="glass p-6 rounded-3xl border border-white/5 flex flex-col items-center gap-4 transition-all hover:scale-105"
                 [class.opacity-40]="!isReached(tier)">
              <div [class]="'w-16 h-16 rounded-2xl flex items-center justify-center text-2xl ' + tier.color + ' ' + tier.textColor">
                <i [class]="'fa-solid ' + tier.icon"></i>
              </div>
              <div class="text-center">
                <p class="font-black text-white">{{ t(tier.name) }}</p>
                <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{{ t('Level') }} {{ tier.minLvl }}+</p>
              </div>
            </div>
          }
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; }
    .shadow-3xl { box-shadow: 0 40px 100px -20px rgba(0,0,0,0.6); }
    .animate-spin-slow { animation: spin 10s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .animate-shimmer { animation: shimmer 2s linear infinite; }
    @keyframes shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LevelsPage {
  ai = inject(AIService);
  private localization = inject(LocalizationService);
  readonly t = (text: string) => this.localization.phrase(text);

  allTiers = [
    { name: 'Bronze', icon: 'fa-helmet-battle', color: 'bg-orange-900', textColor: 'text-orange-400', minLvl: 1 },
    { name: 'Silver', icon: 'fa-shield-halved', color: 'bg-slate-400', textColor: 'text-slate-100', minLvl: 5 },
    { name: 'Gold', icon: 'fa-medal', color: 'bg-amber-500', textColor: 'text-amber-100', minLvl: 9 },
    { name: 'Platinum', icon: 'fa-crown', color: 'bg-cyan-400', textColor: 'text-cyan-50', minLvl: 13 },
    { name: 'Diamond', icon: 'fa-gem', color: 'bg-blue-400', textColor: 'text-blue-50', minLvl: 17 },
    { name: 'Crown', icon: 'fa-crown', color: 'bg-indigo-500', textColor: 'text-white', minLvl: 21 },
    { name: 'Star', icon: 'fa-star', color: 'bg-purple-600', textColor: 'text-white', minLvl: 25 },
    { name: 'Conqueror', icon: 'fa-trophy', color: 'bg-rose-600', textColor: 'text-white', minLvl: 29 }
  ];

  currentTier = computed(() => {
    const lvl = this.ai.userLevel();
    const tierIdx = Math.min(Math.floor((lvl - 1) / 4), this.allTiers.length - 1);
    const rankIdx = 3 - ((lvl - 1) % 4);
    const ranks = ['I', 'II', 'III', 'IV'];
    
    return { 
      ...this.allTiers[tierIdx], 
      rank: tierIdx >= 5 ? '' : ranks[rankIdx] 
    };
  });

  isReached(tier: { minLvl: number }): boolean {
    return this.ai.userLevel() >= tier.minLvl;
  }
}
