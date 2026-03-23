
import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocalizationService } from '../services/localization.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative min-h-screen bg-slate-950 text-white overflow-hidden selection:bg-indigo-500 selection:text-white pb-40">
      
      <!-- 3D Animated Background Core -->
      <div class="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div class="absolute top-[-20%] left-[-10%] w-[80rem] h-[80rem] bg-indigo-600/20 rounded-full blur-[150px] animate-pulse"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-[70rem] h-[70rem] bg-purple-600/20 rounded-full blur-[150px] animate-pulse delay-1000"></div>
        <div class="absolute top-[40%] left-[50%] -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] animate-bounce duration-[15s]"></div>
      </div>

      <!-- 3D Animated Background Core -->
      <div class="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div class="absolute top-[-20%] left-[-10%] w-[80rem] h-[80rem] bg-indigo-600/20 rounded-full blur-[150px] animate-pulse"></div>
        <div class="absolute bottom-[-10%] right-[-10%] w-[70rem] h-[70rem] bg-purple-600/20 rounded-full blur-[150px] animate-pulse delay-1000"></div>
        <div class="absolute top-[40%] left-[50%] -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] animate-bounce duration-[15s]"></div>
      </div>

      <!-- Navigation HUB -->
      <nav class="fixed top-0 w-full z-50 glass border-b border-white/5 px-4 md:px-12 py-3 md:py-8 backdrop-blur-[100px]">
        <div class="max-w-[100rem] mx-auto flex items-center justify-between">
          <div class="flex items-center gap-2 md:gap-6">
             <div class="w-8 h-8 md:w-14 md:h-14 bg-indigo-600 rounded-lg md:rounded-2xl flex items-center justify-center text-white font-black text-lg md:text-3xl shadow-[0_0_40px_rgba(79,70,229,0.5)] transform hover:rotate-12 transition">S</div>
             <span class="text-xl md:text-4xl font-black tracking-tighter text-white">StudyVex <span class="text-indigo-400">AI</span></span>
          </div>
          <div class="hidden lg:flex items-center gap-16 font-black text-xs uppercase tracking-[0.4em] text-slate-500">
             <button (click)="scrollTo('features')" class="hover:text-indigo-400 transition">{{ t('Sovereign Features') }}</button>
             <button (click)="scrollTo('legal')" class="hover:text-indigo-400 transition">{{ t('Copyright') }}</button>
             <button (click)="scrollTo('contact')" class="hover:text-indigo-400 transition">{{ t('Contact Us') }}</button>
          </div>
          <div class="flex items-center gap-3 md:gap-6">
             <button (click)="started.emit()" class="text-white font-black text-[10px] md:text-sm uppercase tracking-widest hover:text-indigo-400 transition px-2 md:px-6">{{ t('Sign In') }}</button>
             <button (click)="started.emit()" class="bg-indigo-600 text-white px-6 md:px-12 py-3 md:py-5 rounded-xl md:rounded-[2rem] font-black text-sm md:text-lg hover:scale-110 active:scale-95 transition shadow-[0_25px_50px_rgba(79,70,229,0.4)]">{{ t('Start') }}</button>
          </div>
        </div>
      </nav>

      <!-- Hero Cinematic Experience -->
      <section class="relative pt-32 md:pt-72 pb-20 md:pb-60 px-4 md:px-8 z-10">
        <div class="max-w-[90rem] mx-auto text-center">
          <div class="inline-flex items-center gap-2 md:gap-4 bg-white/5 border border-white/10 px-4 md:px-10 py-2 md:py-4 rounded-full font-black text-[7px] md:text-[10px] uppercase tracking-[0.2em] md:tracking-[0.5em] text-indigo-400 mb-6 md:mb-12 animate-in slide-in-from-top duration-700">
             <span class="w-1.5 h-1.5 md:w-2.5 md:h-2.5 bg-indigo-500 rounded-full animate-ping"></span>
             {{ t('StudyVex AI') }}
          </div>
          <h1 class="text-3xl md:text-7xl lg:text-[7rem] font-black leading-[1.2] md:leading-[0.9] mb-6 md:mb-12 tracking-tighter text-white animate-in zoom-in duration-1000">
             <span class="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400">{{ t('Your AI Study Platform for Smarter Learning') }}</span>
          </h1>
          <p class="text-base md:text-2xl text-slate-400 max-w-4xl mx-auto mb-8 md:mb-16 leading-relaxed font-bold animate-in fade-in slide-in-from-bottom-10 duration-1000">
             {{ t('StudyVex AI helps students worldwide learn faster with AI tutoring, quizzes, flashcards, summaries, study plans, academic tools, and virtual lab experiences.') }}
          </p>
          <div class="flex flex-col sm:flex-row justify-center gap-4 md:gap-8 animate-in fade-in duration-1000 delay-500">
             <button (click)="started.emit()" class="bg-indigo-600 text-white px-6 md:px-12 py-4 md:py-6 rounded-xl md:rounded-[2.5rem] font-black text-base md:text-xl hover:scale-105 transition shadow-[0_45px_90px_rgba(79,70,229,0.5)] flex items-center gap-3 md:gap-4 justify-center">
                {{ t('Start now for free') }} <i class="fa-solid fa-bolt-lightning text-amber-400"></i>
             </button>
             <button (click)="scrollTo('features')" class="glass border border-white/10 text-white px-6 md:px-12 py-4 md:py-6 rounded-xl md:rounded-[2.5rem] font-black text-base md:text-xl hover:bg-white/5 transition flex items-center gap-3 md:gap-4 justify-center">
                {{ t('Explore features') }} <i class="fa-solid fa-cubes-stacked"></i>
             </button>
          </div>

          <!-- Hero Image Box Removed -->
        </div>
      </section>

      <!-- Features Grid -->
      <section id="features" class="py-20 md:py-40 px-4 md:px-8 relative z-10 scroll-mt-32">
         <div class="max-w-[90rem] mx-auto space-y-12 md:space-y-24">
            <div class="text-center space-y-4 mb-12 md:mb-24">
               <h2 class="text-3xl md:text-6xl font-black text-white tracking-tighter">{{ t('Built for focused learners everywhere') }}</h2>
               <p class="text-base md:text-xl text-slate-500 font-bold max-w-3xl mx-auto italic">{{ t('Premium AI study workflows designed for students worldwide across tutoring, planning, revision, and applied practice.') }}</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
               @for (f of featuresSet1; track f.title) {
                 <div class="group p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] bg-slate-900/40 border border-white/5 hover:border-indigo-500/50 hover:bg-indigo-950/20 transition-all duration-700 hover:-translate-y-4 md:hover:-translate-y-8 shadow-2xl relative overflow-hidden">
                    <div class="w-16 h-16 md:w-20 md:h-20 bg-indigo-600 rounded-2xl md:rounded-[1.5rem] flex items-center justify-center text-white text-2xl md:text-3xl mb-8 md:mb-10 group-hover:rotate-[15deg] transition-transform shadow-[0_20px_40px_rgba(79,70,229,0.3)]">
                       <i [class]="f.icon"></i>
                    </div>
                    <h3 class="text-xl md:text-2xl font-black mb-4 md:mb-6 text-white text-right leading-tight">{{ f.title }}</h3>
                    <p class="text-slate-400 text-base md:text-lg leading-relaxed font-bold text-right italic">{{ f.desc }}</p>
                    <div class="absolute -right-20 -bottom-20 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] group-hover:bg-indigo-500/10 transition"></div>
                 </div>
               }
            </div>
         </div>
      </section>

      <!-- Legal & Copyright -->
      <section id="legal" class="py-40 px-8 border-t border-white/5 relative z-10">
         <div class="max-w-[90rem] mx-auto text-right">
            <h2 class="text-4xl font-black text-white tracking-tighter mb-8">{{ t('Copyright and publishing rights') }}</h2>
            <p class="text-xl text-slate-400 font-bold leading-relaxed max-w-4xl ml-auto">{{ t('StudyVex AI is a globally protected trademark. All algorithms, user interfaces, and educational content are exclusive intellectual property of the platform and protected under international IP laws.') }}</p>
         </div>
      </section>

      <!-- Global Footer -->
      <footer id="contact" class="py-40 px-8 bg-slate-950 border-t border-white/5 relative z-10 text-right">
        <div class="max-w-[100rem] mx-auto grid grid-cols-1 md:grid-cols-3 gap-32">
          <div class="col-span-1">
             <div class="flex items-center gap-6 justify-end mb-12">
                <span class="text-5xl font-black text-white tracking-tighter">StudyVex <span class="text-indigo-400">AI</span></span>
                <div class="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-3xl">S</div>
             </div>
             <p class="text-slate-400 text-2xl font-bold leading-relaxed max-w-lg ml-auto italic">{{ t('StudyVex AI delivers premium AI learning experiences for students worldwide, combining advanced technology with clear academic guidance.') }}</p>
          </div>
          <div>
             <h4 class="font-black text-white text-2xl mb-12">{{ t('Access') }}</h4>
             <ul class="space-y-8 text-slate-600 font-black text-sm uppercase tracking-[0.3em]">
                <li><button class="hover:text-indigo-400 transition">{{ t('Library') }}</button></li>
                <li><button class="hover:text-indigo-400 transition">{{ t('Lab') }}</button></li>
             </ul>
          </div>
          <div>
             <h4 class="font-black text-white text-2xl mb-12">{{ t('Support') }}</h4>
             <ul class="space-y-8 text-slate-600 font-black text-sm uppercase tracking-[0.3em]">
                <li><a href="mailto:support@studyvex.ai" class="hover:text-indigo-400 transition">support@studyvex.ai</a></li>
                <li><span class="text-slate-500">{{ t('Available worldwide') }}</span></li>
             </ul>
          </div>
        </div>
        <div class="max-w-[100rem] mx-auto mt-40 pt-16 border-t border-white/5 text-center text-slate-700 font-black text-xs uppercase tracking-[0.8em]">
           &copy; 2025 StudyVex AI Technologies. {{ t('All rights reserved.') }}
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .shadow-3xl { box-shadow: 0 80px 160px rgba(0,0,0,0.7); }
    .perspective-1000 { perspective: 2500px; }
    .rotate-x-12 { transform: rotateX(15deg); }
    @keyframes slow-pan {
      0% { transform: scale(1.1) translate(0, 0); }
      50% { transform: scale(1.2) translate(-1%, -1%); }
      100% { transform: scale(1.1) translate(0, 0); }
    }
    .animate-slow-pan {
      animation: slow-pan 20s ease-in-out infinite;
    }
  `]
})
export class LandingComponent {
  private readonly localization = inject(LocalizationService);

  constructor() {
    console.log('LandingComponent initialized');
  }
  started = output<void>();
  readonly t = (text: string) => this.localization.phrase(text);

  private readonly featureBlueprints = [
    {
      title: 'AI Tutoring That Adapts',
      icon: 'fa-solid fa-brain',
      desc: 'Personalized tutoring that remembers your study context and responds with clear, structured guidance.'
    },
    {
      title: 'Smart Revision Workflows',
      icon: 'fa-solid fa-bolt',
      desc: 'Generate quizzes, flashcards, summaries, and study plans that keep every session organized and efficient.'
    },
    {
      title: 'Virtual Labs and Research Tools',
      icon: 'fa-solid fa-book-atlas',
      desc: 'Move from theory to practice with academic research support and immersive virtual lab experiences.'
    }
  ] as const;

  get featuresSet1() {
    return this.featureBlueprints.map((feature) => ({
      ...feature,
      title: this.t(feature.title),
      desc: this.t(feature.desc)
    }));
  }

  scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}

