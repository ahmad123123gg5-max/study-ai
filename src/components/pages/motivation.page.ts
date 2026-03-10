
import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AIService } from '../../services/ai.service';

interface Goal {
  id: string;
  text: string;
  completed: boolean;
}

@Component({
  selector: 'app-motivation-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Main Immersive Canvas -->
    <div class="max-w-7xl mx-auto h-[calc(100vh-10rem)] flex flex-col lg:flex-row gap-0 animate-in fade-in duration-1000 relative transition-all overflow-hidden bg-slate-950/40 rounded-[3rem] border border-white/5">
      
      <!-- 1. INSPIRATION CORE (Replaces Chat) -->
      <div class="flex-1 flex flex-col relative bg-slate-950/10 h-full overflow-hidden">
        
        <!-- Subtle HUD -->
        <div class="absolute top-10 left-10 right-10 z-30 flex justify-between items-center pointer-events-none">
          <div class="pointer-events-auto glass p-4 px-8 rounded-2xl border border-white/5 flex items-center gap-4">
             <i class="fa-solid fa-sparkles text-indigo-400 animate-pulse"></i>
             <span class="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">{{ uiLabels().engineStatus }}</span>
          </div>
          
          <div class="pointer-events-auto glass p-4 px-10 rounded-[2rem] border border-indigo-500/10 flex items-center gap-6 shadow-3xl">
             <div class="text-right">
                <p class="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Energy XP</p>
                <p class="text-2xl font-black text-white leading-none">{{ combinedScore() }}</p>
             </div>
          </div>
        </div>

        <!-- Central Energy Orb (Abstracted - No Robot Icon) -->
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
           <div #orbContainer class="w-[45rem] h-[45rem] relative flex items-center justify-center">
              @for (p of particles; track p.id) {
                <div class="absolute w-1 h-1 rounded-full blur-[1px] animate-pulse"
                     [style.backgroundColor]="orbHexColor()"
                     [style.left]="p.x + '%'"
                     [style.top]="p.y + '%'"
                     [style.opacity]="p.opacity"
                     [style.animationDelay]="p.delay + 's'"></div>
              }
              <div [class]="'w-80 h-80 rounded-full flex items-center justify-center shadow-[0_0_150px_rgba(99,102,241,0.2)] border border-white/5 transition-all duration-[3s] ' + orbColor()">
                 <div class="w-full h-full rounded-full animate-pulse opacity-40 bg-gradient-to-t from-transparent to-white/20"></div>
              </div>
           </div>
        </div>

        <!-- THE MOTIVATION STAGE -->
        <div class="mt-auto p-20 z-20 flex flex-col items-center w-full max-w-5xl mx-auto text-center space-y-12">
           
           <!-- Large Quote Display -->
           <div class="relative group min-h-[15rem] flex items-center justify-center">
              @if (isThinking()) {
                <div class="animate-pulse space-y-4">
                   <div class="h-4 w-64 bg-white/10 rounded-full mx-auto"></div>
                   <div class="h-4 w-48 bg-white/10 rounded-full mx-auto"></div>
                </div>
              } @else {
                <h1 class="text-4xl md:text-6xl font-black text-white leading-[1.1] tracking-tighter animate-in slide-in-from-bottom-10 duration-1000">
                  <span class="block mb-4 opacity-30 text-2xl font-bold tracking-widest uppercase">{{ uiLabels().quotePrefix }}</span>
                  "{{ currentMotivation() }}"
                </h1>
              }
              <!-- Decorative Quote Marks -->
              <i class="fa-solid fa-quote-right absolute -top-10 -right-10 text-9xl text-indigo-600/10 -z-10"></i>
           </div>

           <!-- Action Button: Only One Button -->
           <button (click)="generateFreshMotivation()" 
                   [disabled]="isThinking()"
                   class="group relative bg-white text-slate-950 px-16 py-7 rounded-[2.5rem] font-black text-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_50px_rgba(255,255,255,0.1)] disabled:opacity-50 overflow-hidden">
              <span class="relative z-10 flex items-center gap-4">
                {{ uiLabels().refreshBtn }}
                <i class="fa-solid fa-bolt-lightning group-hover:rotate-12 transition"></i>
              </span>
              <div class="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition duration-500 -z-0"></div>
           </button>
        </div>
      </div>

      <!-- 2. SIDE PANEL: MANUAL GOALS -->
      <div class="w-full lg:w-[30rem] p-12 bg-slate-950/80 border-l border-white/5 flex flex-col h-full animate-in slide-in-from-right duration-700 shrink-0 backdrop-blur-3xl shadow-[-50px_0_100px_rgba(0,0,0,0.5)]">
         <div class="flex justify-between items-start mb-16">
            <div>
               <h3 class="text-4xl font-black text-white tracking-tighter">{{ uiLabels().goalsTitle }}</h3>
               <p class="text-[9px] font-black text-indigo-500 uppercase tracking-[0.5em] mt-2 italic">Self-Managed Dashboard</p>
            </div>
            <!-- ADD GOAL (+) -->
            <button (click)="addGoalPrompt()" class="w-16 h-16 rounded-2xl bg-indigo-600 text-white shadow-2xl hover:scale-110 active:scale-90 transition flex items-center justify-center group">
              <i class="fa-solid fa-plus text-2xl group-hover:rotate-90 transition-transform"></i>
            </button>
         </div>
         
         <div class="flex-1 overflow-y-auto space-y-12 no-scrollbar">
            <!-- In Progress -->
            <div class="space-y-6">
              <p class="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] px-4">{{ uiLabels().activeTasks }}</p>
              @if (incompleteGoals().length === 0) {
                <div (click)="addGoalPrompt()" class="p-10 border-2 border-dashed border-white/5 rounded-[3rem] text-center opacity-20 hover:opacity-40 transition cursor-pointer">
                   <i class="fa-solid fa-circle-plus text-4xl mb-4"></i>
                   <p class="text-xs font-bold">{{ uiLabels().emptyGoals }}</p>
                </div>
              }
              @for (goal of incompleteGoals(); track goal.id) {
                <div class="p-8 rounded-[3rem] bg-slate-900 border border-white/5 flex items-center gap-6 group hover:border-indigo-500/30 transition animate-in slide-in-from-right-4">
                   <button (click)="toggleGoal(goal.id)" class="w-12 h-12 rounded-xl bg-slate-950 border border-white/10 flex items-center justify-center text-indigo-500 transition shadow-lg"><i class="fa-solid fa-circle text-[8px]"></i></button>
                   <span class="flex-1 font-bold text-white text-lg text-right">{{ goal.text }}</span>
                   <button (click)="removeGoal(goal.id)" class="opacity-0 group-hover:opacity-100 text-rose-500 transition px-2 hover:scale-125"><i class="fa-solid fa-trash-can"></i></button>
                </div>
              }
            </div>

            <!-- Done -->
            @if (completedGoals().length > 0) {
              <div class="space-y-6">
                <p class="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] px-4">{{ uiLabels().completedTasks }}</p>
                @for (goal of completedGoals(); track goal.id) {
                  <div class="p-8 rounded-[3rem] bg-slate-900/40 border border-white/5 flex items-center gap-6 group transition opacity-50">
                     <button (click)="toggleGoal(goal.id)" class="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-2xl"><i class="fa-solid fa-check text-sm"></i></button>
                     <span class="flex-1 font-bold text-white text-lg line-through text-right">{{ goal.text }}</span>
                     <button (click)="removeGoal(goal.id)" class="opacity-0 group-hover:opacity-100 text-rose-500 transition px-2 hover:scale-125"><i class="fa-solid fa-trash-can"></i></button>
                  </div>
                }
              </div>
            }
         </div>

         <!-- Statistics Footer -->
         <div class="pt-10 border-t border-white/10 mt-10">
            <div class="flex justify-between items-center mb-6">
               <span class="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">{{ uiLabels().progressLabel }}</span>
               <span class="text-3xl font-black text-white">{{ completionPercentage() }}%</span>
            </div>
            <div class="h-4 bg-slate-950 rounded-full overflow-hidden border border-white/10 p-[2px]">
               <div class="h-full bg-indigo-600 rounded-full transition-all duration-[2s] shadow-[0_0_25px_rgba(99,102,241,0.4)]" [style.width]="completionPercentage() + '%'"></div>
            </div>
         </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; perspective: 2500px; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .orb-blue { background: radial-gradient(circle, #6366f1 0%, transparent 80%); }
    .orb-rose { background: radial-gradient(circle, #f43f5e 0%, transparent 80%); }
    .orb-emerald { background: radial-gradient(circle, #10b981 0%, transparent 80%); }
  `]
})
export class MotivationPage implements OnInit {
  private ai = inject(AIService);

  currentMotivation = signal<string>('');
  isThinking = signal(false);
  motivationScore = signal(90);
  orbColor = signal('orb-blue');
  orbHexColor = signal('#6366f1');

  // Manual goals - totally user managed
  goals = signal<Goal[]>([]);

  particles = Array.from({ length: 40 }).map((_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    opacity: 0.2 + Math.random() * 0.4,
    delay: Math.random() * 8
  }));

  incompleteGoals = computed(() => this.goals().filter(g => !g.completed));
  completedGoals = computed(() => this.goals().filter(g => g.completed));
  completionPercentage = computed(() => {
    const list = this.goals();
    if (list.length === 0) return 0;
    return Math.round((list.filter(g => g.completed).length / list.length) * 100);
  });
  combinedScore = computed(() => Math.round((this.motivationScore() + (this.goals().length > 0 ? this.completionPercentage() : 0)) / (this.goals().length > 0 ? 2 : 1.2)));

  uiLabels = computed(() => {
    const isAr = this.ai.currentLanguage() === 'ar';
    return isAr ? {
      engineStatus: 'نظام الإلهام نشط',
      quotePrefix: 'إلهام اليوم',
      refreshBtn: 'توليد رسالة جديدة',
      goalsTitle: 'أهدافي الخاصة',
      activeTasks: 'مهام قيد الإنجاز',
      completedTasks: 'إنجازاتي اليوم',
      emptyGoals: 'أضف هدفاً يدوياً الآن',
      progressLabel: 'معدل الإنجاز الشخصي'
    } : {
      engineStatus: 'Inspiration Engine: Online',
      quotePrefix: 'Insight of the Day',
      refreshBtn: 'Generate New Insight',
      goalsTitle: 'Personal Goals',
      activeTasks: 'In Progress',
      completedTasks: 'Achievements',
      emptyGoals: 'Add a manual goal',
      progressLabel: 'Personal Success Rate'
    };
  });

  async ngOnInit() {
    await this.generateFreshMotivation();
  }

  async generateFreshMotivation() {
    this.isThinking.set(true);
    try {
      const context = this.ai.currentLanguage() === 'ar' ? 
        'رسالة تحفيزية قوية جداً وقصيرة (بحد أقصى 15 كلمة) تلمس الروح وتعطي طاقة للنجاح' : 
        'A very powerful and short motivational message (max 15 words) that touches the soul and gives energy for success';
      
      const quote = await this.ai.getMotivation('أحمد', context);
      this.currentMotivation.set(quote);
      
      // Update visual feedback
      const score = 70 + Math.random() * 30;
      this.motivationScore.set(Math.round(score));
      this.updateOrb(score);
    } catch (e) {
      console.error(e);
      this.currentMotivation.set(this.ai.currentLanguage() === 'ar' ? 'أنت قادر على تحقيق المستحيل، فقط ابدأ.' : 'You are capable of achieving the impossible, just start.');
    } finally {
      this.isThinking.set(false);
    }
  }

  updateOrb(score: number) {
    if (score > 85) { this.orbColor.set('orb-emerald'); this.orbHexColor.set('#10b981'); }
    else if (score > 60) { this.orbColor.set('orb-blue'); this.orbHexColor.set('#6366f1'); }
    else { this.orbColor.set('orb-rose'); this.orbHexColor.set('#f43f5e'); }
  }

  // MANUAL GOAL METHODS
  toggleGoal(id: string) { this.goals.update(list => list.map(g => g.id === id ? { ...g, completed: !g.completed } : g)); }
  
  addGoalPrompt() {
    const text = prompt(this.ai.currentLanguage() === 'ar' ? 'ما هو الهدف أو المهمة التي تود إضافتها يدوياً؟' : 'Enter your manual goal/task:');
    if (text && text.trim()) {
      this.goals.update(list => [...list, { id: Date.now().toString(), text, completed: false }]);
    }
  }

  removeGoal(id: string) {
    this.goals.update(list => list.filter(g => g.id !== id));
  }
}

