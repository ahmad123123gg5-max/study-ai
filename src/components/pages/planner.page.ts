
import { Component, signal, computed, inject, output, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { animate, stagger } from 'motion';
import { TimerService } from '../../services/timer.service';
import { AIService, StudyPlanDay } from '../../services/ai.service';

interface DailyTask {
  id: string;
  subject: string;
  learningObjective: string;
  skill: string;
  duration: number; // current target in minutes (shrinks as student studies)
  originalDuration: number; // original target in minutes
  remainingSeconds: number; // remaining time in seconds
  actualDuration: number; // total spent in seconds
  day: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  understood: boolean;
  rescheduledCount: number;
  createdAt: number; // Timestamp of task creation
  isImportant?: boolean;
  isOverdue?: boolean;
}

@Component({
  selector: 'app-planner-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="relative min-h-screen p-4 md:p-6 lg:p-12 space-y-8 md:space-y-12">
      
      <!-- Header Section -->
      <div class="text-center space-y-2 md:space-y-4">
        <p class="text-indigo-400 font-black uppercase tracking-[0.3em] text-[8px] md:text-sm animate-pulse">Plan your success</p>
        <h1 class="text-2xl md:text-7xl font-black tracking-tighter text-white">مخطط <span class="text-emerald-400">الدراسة اليومي</span></h1>
        <p class="text-sm md:text-2xl text-slate-400 font-medium">نظم موادك الدراسية وحدد أهدافك الزمنية</p>
      </div>

      <!-- Study Plan Generation / Controls -->
      <div class="max-w-4xl mx-auto glass p-4 md:p-8 rounded-2xl md:rounded-[3rem] border border-white/10 shadow-4xl space-y-4 md:space-y-6 text-center">
        <h2 class="text-xl md:text-2xl font-black text-white">مخطط الدراسة الذكي</h2>
        <p class="text-xs md:text-base text-slate-400">أدخل المواد الدراسية، أهميتها، وعدد ساعات الدراسة اليومية لإنشاء خطتك.</p>
        
        <!-- Subject Input -->
        <div class="space-y-3 md:space-y-4">
          @for (subject of ai.currentSubjects(); track $index) {
            <div class="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center">
              <input type="text" [value]="subject.name" (input)="updateSubjectName($index, $any($event.target).value)" placeholder="اسم المادة" 
                     class="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 md:py-3 text-sm md:text-base text-white outline-none focus:ring-2 ring-indigo-500 transition">
              <div class="flex w-full sm:w-auto gap-2">
                <select [value]="subject.importance || 'medium'" (change)="updateSubjectImportance($index, $any($event.target).value)"
                        class="flex-1 sm:w-32 bg-slate-900 border border-white/10 rounded-xl px-4 py-2 md:py-3 text-sm md:text-base text-white outline-none focus:ring-2 ring-indigo-500 transition appearance-none">
                  <option value="high">عالية</option>
                  <option value="medium">متوسطة</option>
                  <option value="low">منخفضة</option>
                </select>
                <button (click)="removeSubject($index)" class="bg-rose-600 text-white w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0">
                  <i class="fa-solid fa-trash text-sm md:text-base"></i>
                </button>
              </div>
            </div>
          }
          <button (click)="addSubject()" class="bg-indigo-600 text-white py-2 px-6 rounded-xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 mx-auto text-sm md:text-base">
            <i class="fa-solid fa-plus"></i>
            إضافة مادة
          </button>
        </div>

        <!-- Daily Hours & Plan Type -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div class="space-y-1 md:space-y-2">
            <label class="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">ساعات الدراسة اليومية</label>
            <input type="number" [(ngModel)]="totalDailyHours" placeholder="مثال: 4" 
                   class="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 md:py-3 text-sm md:text-base text-white outline-none focus:ring-2 ring-indigo-500 transition font-black text-center">
          </div>
          <div class="space-y-1 md:space-y-2">
            <label class="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">تاريخ البدء</label>
            <input type="date" [(ngModel)]="startDate" 
                   class="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 md:py-3 text-sm md:text-base text-white outline-none focus:ring-2 ring-indigo-500 transition">
          </div>
          <div class="space-y-1 md:space-y-2">
            <label class="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">تاريخ الانتهاء</label>
            <input type="date" [(ngModel)]="endDate" 
                   class="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 md:py-3 text-sm md:text-base text-white outline-none focus:ring-2 ring-indigo-500 transition">
          </div>
          <div class="space-y-1 md:space-y-2">
            <label class="text-[8px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">نوع الخطة</label>
            <select [(ngModel)]="planType" 
                    class="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 md:py-3 text-sm md:text-base text-white outline-none focus:ring-2 ring-indigo-500 transition appearance-none">
              <option value="daily">يومية</option>
              <option value="weekly">أسبوعية</option>
              <option value="monthly">شهرية</option>
            </select>
          </div>
        </div>

        <div class="flex flex-wrap gap-4 justify-center mt-8">
          <button (click)="generateStudyPlan()" 
                  [disabled]="isGenerating()"
                  class="bg-emerald-600 text-white py-3 px-8 rounded-xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
            <i class="fa-solid fa-arrows-rotate" [class.animate-spin]="isGenerating()"></i>
            {{ isGenerating() ? 'جاري إنشاء الخطة...' : 'إنشاء الخطة الدراسية' }}
          </button>
          
          <button (click)="clearAllTasks()" 
                  class="bg-rose-600/10 text-rose-500 border border-rose-500/20 py-3 px-8 rounded-xl font-black hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-3">
            <i class="fa-solid fa-trash-can"></i>
            مسح كافة المهام
          </button>
        </div>
      </div>

      <!-- Loading Overlay -->
      @if (isGenerating()) {
        <div class="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-500">
          <div class="relative">
            <div class="w-32 h-32 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <i class="fa-solid fa-brain text-4xl text-indigo-400 animate-pulse"></i>
            </div>
          </div>
          <div class="mt-8 text-center space-y-2">
            <h2 class="text-2xl font-black text-white tracking-tighter">جاري إنشاء خطتك الدراسية الذكية</h2>
            <p class="text-slate-400 font-medium">نقوم بتحليل المواد وتوزيع الساعات بدقة...</p>
          </div>
        </div>
      }

      <!-- Task Info Modal -->
      @if (selectedTaskForInfo()) {
        @let task = selectedTaskForInfo();
        <div class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div class="bg-slate-900 w-full max-w-lg rounded-[2.5rem] border border-white/10 shadow-4xl overflow-hidden animate-in zoom-in-95 duration-500">
            <div class="p-8 space-y-6">
              <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xl">
                  <i class="fa-solid fa-circle-info"></i>
                </div>
                <div>
                  <h2 class="text-2xl font-black text-white">{{ task?.subject }}</h2>
                  <p class="text-xs text-slate-500 font-black uppercase tracking-widest">تفاصيل المهمة / Task Details</p>
                </div>
              </div>

              <div class="space-y-4 py-4">
                <div class="glass p-4 rounded-2xl border border-white/5">
                  <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">هدف التعلم / Learning Objective</p>
                  <p class="text-white font-bold">{{ task?.learningObjective }}</p>
                </div>
                <div class="glass p-4 rounded-2xl border border-white/5">
                  <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">المهارة المستهدفة / Target Skill</p>
                  <p class="text-white font-bold">{{ task?.skill }}</p>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div class="glass p-4 rounded-2xl border border-white/5">
                    <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">المدة / Duration</p>
                    <p class="text-white font-bold">{{ task?.originalDuration }} دقيقة</p>
                  </div>
                  <div class="glass p-4 rounded-2xl border border-white/5">
                    <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">التاريخ / Date</p>
                    <p class="text-white font-bold">{{ getDisplayDate(task?.date || '') }}</p>
                  </div>
                </div>
              </div>

              <div class="flex gap-3">
                <button (click)="selectedTaskForInfo.set(null)" class="flex-1 py-4 bg-white/5 text-white rounded-2xl font-black hover:bg-white/10 transition-all">إغلاق</button>
                <button (click)="askTutorAboutTask()" class="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all">اسأل المعلم</button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- Plan Summary -->
      @if (planSummary()) {
        <div id="plan-summary" class="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-4">
          <div class="glass p-6 rounded-3xl border border-indigo-500/20 bg-indigo-500/5 text-center space-y-1">
            <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">إجمالي الساعات</p>
            <p class="text-2xl font-black text-white tabular-nums">{{ planSummary()?.totalHours?.toFixed(1) }}</p>
          </div>
          <div class="glass p-6 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 text-center space-y-1">
            <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">عدد الأيام</p>
            <p class="text-2xl font-black text-white tabular-nums">{{ planSummary()?.daysCount }}</p>
          </div>
          <div class="glass p-6 rounded-3xl border border-amber-500/20 bg-amber-500/5 text-center space-y-1">
            <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">عدد المهام</p>
            <p class="text-2xl font-black text-white tabular-nums">{{ planSummary()?.tasksCount }}</p>
          </div>
          <div class="glass p-6 rounded-3xl border border-purple-500/20 bg-purple-500/5 text-center space-y-1">
            <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">عدد المواد</p>
            <p class="text-2xl font-black text-white tabular-nums">{{ planSummary()?.subjectsCount }}</p>
          </div>
        </div>
      }

      <!-- Daily Planner Grid -->
      <div class="max-w-6xl mx-auto py-10 space-y-20">
        @for (dateStr of allPlannedDates(); track dateStr) {
          @let dayTasks = getTasksForDate(dateStr);
          @if (dayTasks.length > 0) {
            <div class="day-section space-y-8">
              <div class="flex items-center gap-6">
                <div class="w-20 h-20 rounded-3xl bg-indigo-600 flex flex-col items-center justify-center text-white shadow-2xl">
                  <span class="text-xs font-black uppercase">{{ getDayNameFromDate(dateStr).substring(0, 3) }}</span>
                  <span class="text-2xl font-black">{{ getDayNumberFromDateStr(dateStr) }}</span>
                </div>
                <div>
                  <h3 class="text-3xl font-black text-white">{{ getDayNameFromDate(dateStr) }}</h3>
                  <p class="text-slate-500 font-bold">{{ getDisplayDate(dateStr) }}</p>
                </div>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <!-- Pending Tasks -->
                <div class="space-y-6">
                  <div class="flex items-center gap-3 px-4">
                    <div class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                    <h4 class="text-sm font-black text-slate-400 uppercase tracking-widest">المهام الغير منجزة</h4>
                  </div>
                  <div class="space-y-4">
                    @for (task of getTasksForDate(dateStr, false); track task.id) {
                      <div class="group glass p-6 rounded-[2rem] border border-white/5 hover:border-indigo-500/30 transition-all relative overflow-hidden"
                           [class.border-amber-500/40]="task.isImportant"
                           [class.bg-amber-500/5]="task.isImportant">
                        
                        @if (task.isImportant) {
                          <div class="absolute top-0 right-0 bg-amber-500 text-slate-950 px-4 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest z-20 flex items-center gap-2">
                            <i class="fa-solid fa-star text-[8px]"></i>
                            مهمة هامة / Important
                          </div>
                        }

                        <div class="flex justify-between items-center relative z-10">
                          <div class="space-y-1">
                            <div class="flex items-center gap-2">
                              <h4 class="text-white font-black text-xl">{{ task.subject }}</h4>
                              @if (task.isOverdue) {
                                <span class="bg-rose-500/20 text-rose-400 text-[8px] px-2 py-0.5 rounded-full font-black uppercase border border-rose-500/30">متأخرة / Overdue</span>
                              }
                            </div>
                            <p class="text-slate-500 text-xs">الهدف: {{ task.learningObjective }}</p>
                            <p class="text-slate-500 text-xs">المهارة: {{ task.skill }}</p>
                            <div class="flex items-center gap-3">
                              <span class="text-[10px] font-black text-slate-500 uppercase">المتبقي: {{ formatActualTime(task.remainingSeconds) }}</span>
                              <div class="w-1 h-1 rounded-full bg-slate-800"></div>
                              <span class="text-[10px] font-black text-emerald-400 uppercase">المنجز: {{ formatActualTime(task.actualDuration) }}</span>
                              <div class="w-1 h-1 rounded-full bg-slate-800"></div>
                              <span class="text-[10px] font-black text-indigo-400 uppercase">المطلوب: {{ task.duration }} د</span>
                            </div>
                          </div>
                          <div class="flex gap-2">
                            @if (!task.completed) {
                              <button (click)="startStudySession(task)" 
                                      class="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:scale-110 transition shadow-lg shadow-emerald-500/20">
                                <i class="fa-solid fa-play text-xs"></i>
                              </button>
                              <button (click)="openPostSessionEvaluation(task)" 
                                      class="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center hover:scale-110 transition shadow-lg shadow-indigo-500/20">
                                <i class="fa-solid fa-clipboard-question text-xs"></i>
                              </button>
                            }
                            <button (click)="editTask(task)" 
                                    class="w-10 h-10 rounded-xl bg-white/5 text-slate-400 flex items-center justify-center hover:bg-white/10 hover:text-white transition shadow-lg">
                              <i class="fa-solid fa-pen-to-square text-xs"></i>
                            </button>
                            <button (click)="removeTask(task.id)" 
                                    class="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center hover:scale-110 transition shadow-lg shadow-rose-600/20">
                              <i class="fa-solid fa-trash text-xs"></i>
                            </button>
                          </div>
                        </div>
                        <!-- Progress Bar -->
                        <div class="mt-6 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                          <div class="h-full bg-indigo-500 transition-all duration-1000" 
                               [style.width.%]="((task.originalDuration * 60 - task.remainingSeconds) / (task.originalDuration * 60)) * 100"></div>
                        </div>
                      </div>
                    } @empty {
                      <div class="glass p-12 rounded-[2rem] border border-dashed border-white/5 flex flex-col items-center justify-center text-slate-600 opacity-50">
                        <i class="fa-solid fa-check-double text-3xl mb-4"></i>
                        <p class="text-xs font-black uppercase tracking-widest">لا توجد مهام معلقة</p>
                      </div>
                    }
                  </div>
                </div>

                <!-- Completed Tasks -->
                <div class="space-y-6">
                  <div class="flex items-center gap-3 px-4">
                    <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <h4 class="text-sm font-black text-slate-400 uppercase tracking-widest">المهام المنجزة</h4>
                  </div>
                  <div class="space-y-4">
                    @for (task of getTasksForDate(dateStr, true); track task.id) {
                      <div class="glass p-6 rounded-[2rem] border border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden">
                        <div class="flex justify-between items-center relative z-10">
                          <div class="space-y-1">
                            <div class="flex items-center gap-3">
                              <h4 class="text-white font-black text-xl line-through opacity-50">{{ task.subject }}</h4>
                              @if (task.understood) {
                                <i class="fa-solid fa-face-smile text-emerald-400"></i>
                              } @else {
                                <i class="fa-solid fa-face-frown text-rose-400"></i>
                              }
                            </div>
                            <p class="text-emerald-400/60 text-[10px] font-black uppercase">تم الإنجاز بنجاح • المجموع: {{ formatActualTime(task.actualDuration) }}</p>
                          </div>
                          <div class="flex gap-2">
                            <button (click)="editTask(task)" 
                                    class="w-10 h-10 rounded-xl bg-white/5 text-slate-400 flex items-center justify-center hover:bg-white/10 hover:text-white transition shadow-lg">
                              <i class="fa-solid fa-pen-to-square text-xs"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    } @empty {
                      <div class="glass p-12 rounded-[2rem] border border-dashed border-white/5 flex flex-col items-center justify-center text-slate-600 opacity-30">
                        <i class="fa-solid fa-hourglass text-3xl mb-4"></i>
                        <p class="text-xs font-black uppercase tracking-widest">لم تكتمل أي مهمة بعد</p>
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
          }
        }
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; }
    .glass {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
    .day-card {
      transform-style: preserve-3d;
      perspective: 1000px;
    }
  `]
})
export class PlannerPage {
  private timerService = inject(TimerService);
  ai = inject(AIService);
  
  pageChange = output<string>();
  isGenerating = signal(false);
  selectedTaskForInfo = signal<DailyTask | null>(null);

  weekDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  tasks = signal<DailyTask[]>([]);
  allTasksHistory = signal<DailyTask[]>([]); // New signal for all tasks, including past days
  studyPlan = signal<StudyPlanDay[]>([]);
  today = computed(() => this.weekDays[new Date().getDay()]);
  
  allPlannedDates = computed(() => {
    const tasks = this.allTasksHistory();
    const dates = [...new Set(tasks.map(t => t.date))];
    return dates.sort((a, b) => {
      const taskA = tasks.find(t => t.date === a);
      const taskB = tasks.find(t => t.date === b);
      if (taskA && taskB) {
        return new Date(taskA.date).getTime() - new Date(taskB.date).getTime();
      }
      return 0;
    });
  });

  totalDailyHours = signal<number>(4);
  planType = signal<'daily' | 'weekly' | 'monthly'>('weekly');
  startDate = signal<string>(new Date().toISOString().split('T')[0]);
  endDate = signal<string>(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  planSummary = computed(() => {
    const tasks = this.allTasksHistory();
    if (tasks.length === 0) return null;
    const totalHours = tasks.reduce((acc, t) => acc + t.originalDuration, 0) / 60;
    const subjects = [...new Set(tasks.map(t => t.subject))];
    const days = [...new Set(tasks.map(t => t.date))].length;
    return { totalHours, subjectsCount: subjects.length, daysCount: days, tasksCount: tasks.length };
  });

  constructor() {
    const savedTasks = localStorage.getItem('smartedge_daily_tasks');
    if (savedTasks) {
      const parsed = JSON.parse(savedTasks);
      this.allTasksHistory.set(parsed);
      this.autoAdjustSchedule();
      this.tasks.set(this.allTasksHistory());
    } else {
      this.generateStudyPlan(); 
    }

    effect(() => {
      if (this.tasks().length > 0) {
        untracked(() => this.animateEntrance());
      }
    });

    // Effect to sync remaining time from TimerService to the active task
    effect(() => {
      const activeId = this.timerService.activeTaskId();
      const timeLeft = this.timerService.timeLeft();
      
      if (activeId) {
        untracked(() => {
          this.allTasksHistory.update(currentTasks => {
            const updated = currentTasks.map(t => {
              if (t.id === activeId) {
                const spentSoFar = (t.originalDuration * 60) - timeLeft;
                return { 
                  ...t, 
                  remainingSeconds: timeLeft,
                  duration: Math.ceil(timeLeft / 60), // Shrink the task duration
                  actualDuration: Math.max(t.actualDuration, spentSoFar)
                };
              }
              return t;
            });
            return updated;
          });
          this.saveTasks();
        });
      }
    }, { allowSignalWrites: true });

    // Effect to handle timer completion
    effect(() => {
      const completedId = this.timerService.timerCompleted();
      if (completedId) {
        untracked(() => {
          this.allTasksHistory.update(currentTasks => {
            const updated = currentTasks.map(t => {
              if (t.id === completedId) {
                const hours = t.originalDuration / 60;
                const studyXp = Math.floor(t.originalDuration / 2);
                this.ai.totalStudyHours.update(h => h + hours);
                this.ai.awardXPForAction('studyPlan', studyXp, {
                  fingerprint: `study:${t.id}:${t.subject}`
                });
                this.ai.updateSubjectXP(t.subject, studyXp);
                this.ai.addPerformanceRecord({
                  date: new Date().toISOString(),
                  score: 100,
                  type: 'study',
                  subject: t.subject,
                  grade: 'A+'
                });
                return { ...t, completed: true, remainingSeconds: 0 };
              }
              return t;
            });
            return updated;
          });
          this.saveTasks();
          this.timerService.resetTimerCompleted();
        });
      }
    }, { allowSignalWrites: true });
  }

  autoAdjustSchedule() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = this.formatDate(today);
    const todayName = this.weekDays[today.getDay()];

    let hasChanges = false;
    
    this.allTasksHistory.update(currentTasks => {
      return currentTasks.map(task => {
        const taskDate = new Date(task.date);
        taskDate.setHours(0, 0, 0, 0);

        // If task is in the past and not completed, move it to today and mark as important
        if (taskDate < today && !task.completed) {
          hasChanges = true;
          return {
            ...task,
            date: todayStr,
            day: todayName,
            isImportant: true,
            isOverdue: true,
            rescheduledCount: task.rescheduledCount + 1
          };
        }
        return task;
      });
    });

    if (hasChanges) {
      this.saveTasks();
    }
  }

  getTasksForDate(dateStr: string, completed?: boolean) {
    const tasks = this.allTasksHistory().filter(t => t.date === dateStr);
    if (completed === undefined) return tasks;
    return tasks.filter(t => t.completed === completed);
  }

  getTaskCountsForDate(dateStr: string): { completed: number, uncompleted: number } {
    const tasks = this.getTasksForDate(dateStr);
    const completed = tasks.filter(t => t.completed).length;
    const uncompleted = tasks.filter(t => !t.completed).length;
    return { completed, uncompleted };
  }

  isDateFinished(dateStr: string): boolean {
    const tasks = this.getTasksForDate(dateStr);
    return tasks.length > 0 && tasks.every(t => t.completed);
  }

  getDayNameFromDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const dayIndex = date.getDay();
    if (isNaN(dayIndex)) return '';
    return this.weekDays[dayIndex] || '';
  }

  async generateStudyPlan() {
    const subjectsToPlan = this.ai.currentSubjects().map(s => ({ name: s.name, importance: s.importance || 'medium' }));
    if (subjectsToPlan.length === 0 || this.totalDailyHours() <= 0) {
      alert('الرجاء إدخال المواد وساعات الدراسة اليومية.');
      return;
    }

    this.isGenerating.set(true);
    try {
      const plan = await this.ai.generateStudyPlan(
        subjectsToPlan,
        this.totalDailyHours(),
        this.planType(),
        this.startDate(),
        this.endDate()
      );
      this.studyPlan.set(plan);

      const newDailyTasks: DailyTask[] = [];
      const startDate = new Date(this.startDate());

      plan.forEach((dayPlan, index) => {
        const targetDate = new Date(startDate);
        targetDate.setDate(startDate.getDate() + index);
        const formattedDate = this.formatDate(targetDate);
        const dayName = this.weekDays[targetDate.getDay()];

        dayPlan.tasks.forEach(task => {
          const duration = task.durationMinutes || 25;
          newDailyTasks.push({
            id: Math.random().toString(36).substring(7),
            subject: task.topic,
            learningObjective: task.type, 
            skill: task.type, 
            duration: duration, 
            originalDuration: duration,
            remainingSeconds: duration * 60,
            actualDuration: 0,
            day: dayName, 
            date: formattedDate, 
            completed: false,
            understood: false,
            rescheduledCount: 0,
            createdAt: Date.now(),
          });
        });
      });
      
      // Replace existing tasks with the new plan (as requested: start new month/plan)
      this.tasks.set(newDailyTasks);
      this.allTasksHistory.set(newDailyTasks);
      this.saveTasks();
      
      // Scroll to plan summary
      setTimeout(() => {
        document.getElementById('plan-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (error) {
      console.error('Failed to generate study plan:', error);
    } finally {
      this.isGenerating.set(false);
    }
  }

  addSubject() {
    this.ai.currentSubjects.update(s => [...s, { name: 'مادة جديدة', level: 1, xp: 0, importance: 'medium' }]);
  }

  removeSubject(index: number) {
    this.ai.currentSubjects.update(s => s.filter((_, i) => i !== index));
  }

  updateSubjectName(index: number, newName: string) {
    this.ai.currentSubjects.update(subjects => subjects.map((s, i) => i === index ? { ...s, name: newName } : s));
  }

  updateSubjectImportance(index: number, importance: string) {
    this.ai.currentSubjects.update(subjects => subjects.map((s, i) => i === index ? { ...s, importance: importance as 'high' | 'medium' | 'low' } : s));
  }

  private animateEntrance() {
    const elements = document.querySelectorAll('.day-section');
    if (elements.length === 0) return;

    animate(
      elements,
      { opacity: [0, 1], y: [50, 0], scale: [0.9, 1] },
      { delay: stagger(0.1), duration: 0.8, ease: 'easeOut' }
    );
  }

  editTask(task: DailyTask) {
    const newSubject = prompt('تعديل اسم المادة:', task.subject);
    if (newSubject === null) return;
    
    const newObjective = prompt('تعديل هدف التعلم:', task.learningObjective);
    if (newObjective === null) return;

    const newSkill = prompt('تعديل المهارة:', task.skill);
    if (newSkill === null) return;

    const newDurationStr = prompt('تعديل المدة (بالدقائق):', task.duration.toString());
    if (newDurationStr === null) return;
    
    const newDuration = parseInt(newDurationStr);
    if (isNaN(newDuration) || newDuration <= 0) return;

    this.tasks.update(currentTasks => {
      return currentTasks.map(t => {
        if (t.id === task.id) {
          const durationDiff = (newDuration * 60) - (task.originalDuration * 60);
          return { 
            ...t, 
            subject: newSubject, 
            learningObjective: newObjective,
            skill: newSkill,
            duration: newDuration, // This will be the new remaining if we reset
            originalDuration: newDuration,
            remainingSeconds: Math.max(0, t.remainingSeconds + durationDiff)
          };
        }
        return t;
      });
    });
    this.saveTasks();
  }

  getDayDate(input: string | Date): string {
    let targetDate: Date;
    if (typeof input === 'string') {
      // If input is a day name, calculate the date relative to today
      const today = new Date();
      const todayIndex = today.getDay(); // 0 is Sunday
      const targetIndex = this.weekDays.indexOf(input);
      
      const diff = targetIndex - todayIndex;
      targetDate = new Date(today);
      targetDate.setDate(today.getDate() + diff);
    } else {
      // If input is a Date object
      targetDate = input;
    }
    
    return targetDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
  }

  getDayNumberFromDate(date: Date): string {
    return date.toLocaleDateString('ar-EG', { day: 'numeric' });
  }

  getSampleDateForDay(dayName: string): Date {
    const task = this.allTasksHistory().find(t => t.day === dayName);
    return task ? new Date(task.date) : new Date(); // Fallback to today if no task found
  }

  getDayNumberFromDateStr(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('ar-EG', { day: 'numeric' });
  }

  isTaskEditable(): boolean {
    return true;
  }

  formatActualTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getDisplayDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  clearAllTasks() {
    if (confirm('هل أنت متأكد من مسح كافة المهام؟ لا يمكن التراجع عن هذا الإجراء.')) {
      this.allTasksHistory.set([]);
      this.tasks.set([]);
      this.saveTasks();
    }
  }

  removeTask(id: string) {
    this.allTasksHistory.update(tasks => tasks.filter(task => task.id !== id));
    this.tasks.update(tasks => tasks.filter(task => task.id !== id));
    this.saveTasks();
  }

  startStudySession(task: DailyTask) {
    this.timerService.startCustomTimer(task.duration, task.id, task.remainingSeconds);
    this.pageChange.emit('timer');
  }

  openPostSessionEvaluation(task: DailyTask) {
    this.selectedTaskForInfo.set(task);
  }

  askTutorAboutTask() {
    this.selectedTaskForInfo.set(null);
    // Logic to switch to tutor and ask about this task
    // For now, we just switch to tutor
    this.pageChange.emit('tutor');
  }

  rescheduleTask(task: DailyTask) {
    const currentDate = new Date(task.date);
    const nextDate = new Date(currentDate);
    nextDate.setDate(currentDate.getDate() + 1);
    const nextDateStr = this.formatDate(nextDate);
    const nextDayName = this.weekDays[nextDate.getDay()];

    const rescheduledTask: DailyTask = {
      ...task,
      id: Math.random().toString(36).substring(7), // New ID for the rescheduled task
      day: nextDayName,
      date: nextDateStr,
      completed: false,
      understood: false,
      remainingSeconds: task.originalDuration * 60, // Reset timer
      actualDuration: 0,
      rescheduledCount: task.rescheduledCount + 1,
      createdAt: Date.now()
    };

    this.allTasksHistory.update(currentTasks => [...currentTasks, rescheduledTask]);
    this.saveTasks();
  }

  private saveTasks() {
    localStorage.setItem('smartedge_daily_tasks', JSON.stringify(this.allTasksHistory()));
  }
}
