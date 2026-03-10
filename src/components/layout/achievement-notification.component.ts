import { Component, inject, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AIService } from '../../services/ai.service';
import { NotificationService } from '../../services/notification.service';
import { LocalizationService } from '../../services/localization.service';
import { animate } from "motion";

@Component({
  selector: 'app-achievement-notification',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- General Notifications Tray -->
    <div class="fixed top-6 right-6 z-[2000] flex flex-col gap-4 pointer-events-none w-full max-w-sm">
      @for (notif of ns.notifications(); track notif.id) {
        <div [id]="'notif-' + notif.id" 
             class="pointer-events-auto glass p-6 rounded-2xl border border-white/10 shadow-3xl flex items-start gap-4 animate-in slide-in-from-right-8 duration-500">
          <div [class]="'w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ' + getBgColor(notif.type)">
            <i [class]="'fa-solid ' + notif.icon"></i>
          </div>
          <div class="space-y-1">
            <h4 class="font-black text-white text-sm">{{ notif.title }}</h4>
            <p class="text-xs text-slate-400 font-bold leading-relaxed">{{ notif.message }}</p>
          </div>
          <button (click)="ns.remove(notif.id)" class="text-slate-600 hover:text-white transition ml-auto">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      }
    </div>

    <!-- Level Up Notification -->
    @if (levelUp()) {
      <div class="fixed inset-0 z-[1001] flex items-center justify-center pointer-events-none overflow-hidden">
        <div class="absolute inset-0 bg-indigo-950/80 backdrop-blur-2xl animate-in fade-in duration-700"></div>
        <div id="level-card" class="relative w-full max-w-2xl p-16 text-center space-y-12 transform scale-50 opacity-0">
          
          <!-- Explosion Effect -->
          <div class="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 blur-[150px] opacity-30 animate-pulse"></div>
          
          <div class="relative mx-auto w-64 h-64 flex items-center justify-center">
            <!-- 3D Rotating Ring -->
            <div class="absolute inset-0 border-8 border-dashed border-amber-400/30 rounded-full animate-spin-slow"></div>
            <div class="absolute inset-4 border-4 border-white/20 rounded-full animate-spin-reverse"></div>
            
            <div class="relative z-10 bg-gradient-to-br from-amber-400 to-amber-700 w-48 h-48 rounded-full flex flex-col items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.5)] border-4 border-white/30">
              <span class="text-white text-xl font-black uppercase tracking-widest">{{ t('Level') }}</span>
              <span class="text-white text-8xl font-black drop-shadow-2xl">{{ levelUp() }}</span>
            </div>
          </div>

          <div class="space-y-6 relative z-10">
            <h3 class="text-2xl font-black text-amber-400 uppercase tracking-[0.4em] animate-in slide-in-from-top-8 duration-1000">{{ t('New Upgrade!') }}</h3>
            <h2 class="text-7xl font-black text-white tracking-tighter animate-in zoom-in duration-1000 delay-300">{{ t('You reached the next level') }}</h2>
            <p class="text-indigo-200 text-xl font-bold animate-in fade-in duration-1000 delay-700">{{ t('Keep learning to reach the highest royal ranks') }}</p>
          </div>

          <div class="flex justify-center gap-4 animate-in slide-in-from-bottom-8 duration-1000 delay-1000">
             @for (i of [1,2,3]; track i) {
               <div class="w-3 h-3 bg-white rounded-full animate-ping" [style.animation-delay]="i * 0.2 + 's'"></div>
             }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .animate-spin-slow { animation: spin 8s linear infinite; }
    .animate-spin-reverse { animation: spin-rev 6s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes spin-rev { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
    .glass {
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
  `]
})
export class AchievementNotificationComponent {
  ai = inject(AIService);
  ns = inject(NotificationService);
  private readonly localization = inject(LocalizationService);
  levelUp = signal<number | null>(null);
  readonly t = (text: string) => this.localization.phrase(text);

  getBgColor(type: string) {
    switch (type) {
      case 'success': return 'bg-emerald-500 text-white';
      case 'error': return 'bg-rose-500 text-white';
      case 'warning': return 'bg-amber-500 text-white';
      default: return 'bg-indigo-500 text-white';
    }
  }

  constructor() {
    // Level Up Effect
    effect(() => {
      const lvl = this.ai.lastLevelUp();
      if (lvl) {
        this.levelUp.set(lvl);
        setTimeout(() => {
          const card = document.getElementById('level-card');
          if (card) {
            animate(card, { scale: [0.5, 1.2, 1], opacity: [0, 1] }, { duration: 1, ease: [0.22, 1, 0.36, 1] });
            setTimeout(() => {
              animate(card, { scale: 1.5, opacity: 0 }, { duration: 0.8, ease: "easeIn" }).finished.then(() => {
                this.levelUp.set(null);
              });
            }, 5000);
          }
        }, 50);
      }
    });
  }
}

