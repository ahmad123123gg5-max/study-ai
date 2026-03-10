
import { Component, output, signal, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AIService } from '../services/ai.service';

type DashboardModule = 'overview' | 'tutor' | 'research' | 'scheduler' | 'focus' | 'analytics' | 'admin';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      
      <!-- Sidebar Nav -->
      <aside class="w-20 lg:w-72 glass border-e dark:border-slate-800 flex flex-col p-4 lg:p-6 h-full z-50">
        <div class="flex items-center gap-3 mb-10 px-2">
          <div class="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-lg shadow-indigo-500/20 shrink-0">S</div>
          <span class="text-xl font-bold tracking-tight hidden lg:block">SmartEdge <span class="text-indigo-600">AI</span></span>
        </div>

        <nav class="flex-1 space-y-1 overflow-y-auto no-scrollbar">
          @for (item of menuItems; track item.id) {
            <button (click)="activeModule.set(item.id)" 
                    [class.bg-indigo-600]="activeModule() === item.id" 
                    [class.text-white]="activeModule() === item.id"
                    [class.shadow-xl]="activeModule() === item.id"
                    [class.shadow-indigo-500/20]="activeModule() === item.id"
                    class="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-all duration-300 group">
              <i [class]="item.icon + ' text-xl w-6 text-center'"></i>
              <span class="font-semibold hidden lg:block">{{ item.label }}</span>
            </button>
          }
        </nav>

        <div class="mt-auto pt-6 border-t dark:border-slate-800">
          <button (click)="logout.emit()" class="w-full flex items-center gap-4 p-4 rounded-2xl text-rose-500 hover:bg-rose-500/10 transition-all">
            <i class="fa-solid fa-right-from-bracket text-xl w-6 text-center"></i>
            <span class="font-semibold hidden lg:block">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      <!-- Main Stage -->
      <main class="flex-1 flex flex-col min-w-0">
        <!-- Top Navigation Bar -->
        <header class="h-20 glass border-b dark:border-slate-800 flex items-center justify-between px-8 shrink-0 z-40">
          <div class="flex items-center gap-4">
            <h2 class="text-xl font-bold capitalize">{{ activeModuleLabel() }}</h2>
          </div>
          
          <div class="flex items-center gap-6">
            <div class="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-4 py-2 rounded-xl">
               <i class="fa-solid fa-coins text-amber-500"></i>
               <span class="font-bold">2,450 XP</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center overflow-hidden border-2 border-indigo-500">
                <img src="https://picsum.photos/100" alt="Avatar">
              </div>
              <div class="hidden lg:block">
                <p class="text-sm font-bold leading-tight">د. محمد العتيبي</p>
                <p class="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Premium Student</p>
              </div>
            </div>
          </div>
        </header>

        <!-- Module Content Container -->
        <div class="flex-1 overflow-y-auto p-6 lg:p-10 no-scrollbar relative">
          
          @switch (activeModule()) {
            @case ('overview') {
              <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <!-- Welcome & Stats -->
                <div class="lg:col-span-3 space-y-6">
                  <div class="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
                    <div class="relative z-10 max-w-xl">
                      <h1 class="text-4xl font-black mb-4 leading-tight">أهلاً بك في مستقبل التعلم الذكي 🚀</h1>
                      <p class="text-indigo-100 text-lg mb-8 opacity-90">لقد قطعت 85% من مسارك التعليمي هذا الأسبوع. واصل التقدم لتحقيق أهدافك.</p>
                      <button (click)="activeModule.set('tutor')" class="bg-white text-indigo-600 px-8 py-4 rounded-2xl font-black text-lg hover:scale-105 transition shadow-2xl">تحدث مع المعلم الذكي</button>
                    </div>
                    <i class="fa-solid fa-microchip absolute -right-10 -bottom-10 text-[20rem] opacity-10 rotate-12"></i>
                  </div>
                  
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border dark:border-slate-800 shadow-sm">
                      <p class="text-slate-500 font-bold mb-4 uppercase tracking-wider text-xs">ساعات التركيز</p>
                      <h3 class="text-4xl font-black">42.5 <span class="text-lg font-bold text-slate-400">ساعة</span></h3>
                      <div class="mt-4 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div class="w-3/4 h-full bg-emerald-500"></div>
                      </div>
                    </div>
                    <div class="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border dark:border-slate-800 shadow-sm">
                      <p class="text-slate-500 font-bold mb-4 uppercase tracking-wider text-xs">المقررات المكتملة</p>
                      <h3 class="text-4xl font-black">12 <span class="text-lg font-bold text-slate-400">مقرر</span></h3>
                      <div class="mt-4 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div class="w-1/2 h-full bg-indigo-500"></div>
                      </div>
                    </div>
                    <div class="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border dark:border-slate-800 shadow-sm">
                      <p class="text-slate-500 font-bold mb-4 uppercase tracking-wider text-xs">معدل الدقة</p>
                      <h3 class="text-4xl font-black">94<span class="text-lg font-bold text-slate-400">%</span></h3>
                      <div class="mt-4 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div class="w-[94%] h-full bg-purple-500"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Action Sidebar -->
                <div class="space-y-6">
                  <div class="bg-slate-100 dark:bg-slate-900 p-6 rounded-[2rem] border dark:border-slate-800">
                    <h4 class="font-bold mb-4 flex items-center justify-between">
                      المقرر النشط
                      <span class="text-indigo-500 text-xs">عرض الكل</span>
                    </h4>
                    <div class="space-y-3">
                      <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700 flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500"><i class="fa-solid fa-dna"></i></div>
                        <div>
                          <p class="font-bold text-sm">علم الجينات</p>
                          <p class="text-[10px] text-slate-500">الوحدة 4: الحمض النووي</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            }

            @case ('tutor') {
              <div class="max-w-4xl mx-auto h-[calc(100vh-14rem)] flex flex-col glass rounded-[2.5rem] overflow-hidden border dark:border-slate-800">
                <div class="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                   <div class="flex items-center gap-3">
                      <div class="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white"><i class="fa-solid fa-robot"></i></div>
                      <div>
                        <h3 class="font-bold">المعلم الذكي</h3>
                        <p class="text-[10px] text-emerald-500 font-bold uppercase">متصل الآن - يدعم العربية</p>
                      </div>
                   </div>
                   <button (click)="chatHistory.set([])" class="text-slate-400 hover:text-rose-500 transition"><i class="fa-solid fa-trash-can"></i></button>
                </div>
                
                <div class="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar" #chatScrollContainer>
                  @if (chatHistory().length === 0) {
                    <div class="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
                       <i class="fa-solid fa-comment-dots text-6xl text-indigo-500 mb-2"></i>
                       <h4 class="text-xl font-bold">ابدأ محادثة مع معلمك الشخصي</h4>
                       <p class="max-w-xs">يمكنك السؤال عن أي موضوع أكاديمي، أو طلب شرح لمعادلة، أو حتى تلخيص مقال.</p>
                    </div>
                  }
                  @for (msg of chatHistory(); track msg) {
                    <div class="flex" [class.justify-end]="msg.role === 'user'">
                      <div [class.bg-indigo-600]="msg.role === 'user'" 
                           [class.text-white]="msg.role === 'user'" 
                           [class.bg-white]="msg.role === 'model'" 
                           [class.dark:bg-slate-900]="msg.role === 'model'" 
                           class="max-w-[85%] p-5 rounded-[1.5rem] shadow-sm border dark:border-slate-800 text-sm md:text-base leading-relaxed">
                        {{ msg.text }}
                      </div>
                    </div>
                  }
                  @if (isThinking()) {
                    <div class="flex justify-start">
                      <div class="bg-white dark:bg-slate-900 p-4 rounded-2xl flex gap-2">
                        <div class="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                        <div class="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-75"></div>
                        <div class="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-150"></div>
                      </div>
                    </div>
                  }
                </div>

                <div class="p-6 bg-slate-50 dark:bg-slate-900/50 border-t dark:border-slate-800">
                  <div class="flex gap-4">
                    <input #chatIn (keyup.enter)="sendChat(chatIn.value); chatIn.value = ''" type="text" placeholder="اكتب سؤالك هنا..." class="flex-1 p-4 rounded-2xl bg-white dark:bg-slate-950 border-none shadow-sm focus:ring-2 ring-indigo-500 outline-none transition">
                    <button (click)="sendChat(chatIn.value); chatIn.value = ''" class="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition">
                      <i class="fa-solid fa-paper-plane"></i>
                    </button>
                  </div>
                </div>
              </div>
            }

            @case ('focus') {
              <div class="max-w-2xl mx-auto py-10">
                <div class="bg-white dark:bg-slate-900 p-12 rounded-[4rem] border dark:border-slate-800 shadow-2xl text-center relative overflow-hidden">
                  <div class="relative z-10">
                    <h3 class="text-xl font-black text-indigo-500 uppercase tracking-[0.2em] mb-12">Focus Session</h3>
                    <div class="text-[8rem] font-black tracking-tighter tabular-nums leading-none mb-12">{{ timeDisplay() }}</div>
                    <div class="flex gap-4 justify-center">
                      <button (click)="toggleTimer()" class="bg-indigo-600 text-white px-12 py-5 rounded-3xl font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-indigo-500/30">
                        {{ timerActive() ? 'إيقاف مؤقت' : 'ابدأ الجلسة' }}
                      </button>
                      <button (click)="resetTimer()" class="bg-slate-100 dark:bg-slate-800 px-12 py-5 rounded-3xl font-black text-xl hover:bg-rose-500 hover:text-white transition-all">
                        إعادة تعيين
                      </button>
                    </div>
                  </div>
                  
                  <!-- Progress Ring Background -->
                  <svg class="absolute inset-0 w-full h-full opacity-5 pointer-events-none transform -rotate-90">
                    <circle cx="50%" cy="50%" r="45%" fill="none" stroke="currentColor" stroke-width="40" class="text-indigo-600" [style.stroke-dasharray]="'1000'" [style.stroke-dashoffset]="timerProgress()"></circle>
                  </svg>
                </div>
                
                <div class="grid grid-cols-2 gap-4 mt-8">
                   <div class="glass p-8 rounded-[2.5rem] text-center border dark:border-slate-800">
                     <p class="text-slate-500 font-bold text-xs uppercase mb-2">جلسات اليوم</p>
                     <p class="text-4xl font-black">04</p>
                   </div>
                   <div class="glass p-8 rounded-[2.5rem] text-center border dark:border-slate-800">
                     <p class="text-slate-500 font-bold text-xs uppercase mb-2">إجمالي الدقائق</p>
                     <p class="text-4xl font-black">100</p>
                   </div>
                </div>
              </div>
            }
          }
        </div>
      </main>
    </div>
  `,
  host: { 'class': 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  logout = output<void>();
  activeModule = signal<DashboardModule>('overview');
  private aiService = inject(AIService);

  menuItems = [
    { id: 'overview', label: 'الرئيسية', icon: 'fa-solid fa-house' },
    { id: 'tutor', label: 'المعلم الذكي', icon: 'fa-solid fa-robot' },
    { id: 'research', label: 'الباحث الأكاديمي', icon: 'fa-solid fa-microscope' },
    { id: 'scheduler', label: 'الجدول الدراسي', icon: 'fa-solid fa-calendar' },
    { id: 'focus', label: 'نظام بومودورو', icon: 'fa-solid fa-clock' },
    { id: 'analytics', label: 'التحليلات', icon: 'fa-solid fa-chart-pie' },
    { id: 'admin', label: 'الإدارة', icon: 'fa-solid fa-user-shield' }
  ];

  activeModuleLabel = computed(() => {
    return this.menuItems.find(i => i.id === this.activeModule())?.label || 'Dashboard';
  });

  // Chat Module Logic
  chatHistory = signal<{role: 'user' | 'model', text: string}[]>([]);
  isThinking = signal(false);

  async sendChat(text: string) {
    if (!text.trim()) return;
    this.chatHistory.update(h => [...h, { role: 'user', text }]);
    this.isThinking.set(true);
    try {
      const resp = await this.aiService.chat(text, '', this.chatHistory().map(h => ({ role: h.role, parts: [{ text: h.text }] })));
      this.chatHistory.update(h => [...h, { role: 'model', text: resp }]);
    } catch (e) {
      console.error(e);
    } finally {
      this.isThinking.set(false);
    }
  }

  // Focus Module Logic
  timerActive = signal(false);
  timeLeft = signal(25 * 60);
  timerInterval: ReturnType<typeof setInterval> | undefined;
  timeDisplay = computed(() => {
    const mins = Math.floor(this.timeLeft() / 60);
    const secs = this.timeLeft() % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });
  timerProgress = computed(() => {
    return (this.timeLeft() / (25 * 60)) * 1000;
  });

  toggleTimer() {
    if (this.timerActive()) {
      this.timerActive.set(false);
      clearInterval(this.timerInterval);
    } else {
      this.timerActive.set(true);
      this.timerInterval = setInterval(() => {
        if (this.timeLeft() > 0) this.timeLeft.update(t => t - 1);
        else this.resetTimer();
      }, 1000);
    }
  }

  resetTimer() {
    this.timerActive.set(false);
    this.timeLeft.set(25 * 60);
    clearInterval(this.timerInterval);
  }
}

