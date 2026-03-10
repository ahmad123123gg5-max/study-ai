
import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AIService } from '../../services/ai.service';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-4xl mx-auto space-y-8 pb-20 animate-in fade-in duration-700">
      
      <!-- Instagram-style Profile Header -->
      <div class="bg-slate-900 rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden">
        <!-- Cover Photo -->
        <div class="h-48 md:h-64 bg-slate-800 relative group">
          @if (ai.coverImage()) {
            <img [src]="ai.coverImage()" class="w-full h-full object-cover">
          } @else {
            <div class="w-full h-full bg-gradient-to-r from-indigo-900 to-slate-900 flex items-center justify-center">
              <i class="fa-solid fa-image text-4xl text-white/10"></i>
            </div>
          }
          <button (click)="coverInput.click()" class="absolute bottom-4 right-4 bg-black/50 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-black border border-white/10 hover:bg-black/70 transition flex items-center gap-2">
            <i class="fa-solid fa-camera"></i>
            تغيير الغلاف
          </button>
          <input #coverInput type="file" class="hidden" (change)="onImageSelected($event, 'cover')">
        </div>
        
        <div class="px-6 md:px-12 pb-10">
          <div class="flex flex-col md:flex-row items-start md:items-end gap-6 md:gap-10 -mt-16 md:-mt-20 relative z-10">
            <!-- Profile Picture -->
            <div class="relative group">
              <div class="w-32 h-32 md:w-44 md:h-44 rounded-full border-4 md:border-8 border-slate-900 bg-slate-800 overflow-hidden shadow-2xl relative">
                @if (ai.profileImage()) {
                  <img [src]="ai.profileImage()" class="w-full h-full object-cover">
                } @else {
                  <div class="w-full h-full flex items-center justify-center text-slate-600">
                    <i class="fa-solid fa-user text-5xl"></i>
                  </div>
                }
                <!-- Level Badge Overlay -->
                <div class="absolute bottom-0 inset-x-0 bg-indigo-600/90 py-1 text-center">
                  <span class="text-[10px] font-black text-white uppercase tracking-tighter">Lvl {{ ai.userLevel() }}</span>
                </div>
              </div>
              <button (click)="profileInput.click()" class="absolute bottom-1 right-1 md:bottom-2 md:right-2 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center border-4 border-slate-900 hover:scale-110 transition shadow-lg z-20">
                <i class="fa-solid fa-camera text-xs"></i>
              </button>
              <input #profileInput type="file" class="hidden" (change)="onImageSelected($event, 'profile')">
            </div>

            <!-- Profile Info -->
            <div class="flex-1 space-y-4 pb-2">
              <div class="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <div class="space-y-1">
                  <div class="flex items-center gap-3">
                    @if (isEditingName()) {
                      <input #nameInput [value]="ai.userName()" (blur)="saveName(nameInput.value)" (keyup.enter)="saveName(nameInput.value)" 
                             class="bg-slate-800 border border-indigo-500/50 rounded-xl px-4 py-1 text-2xl font-black text-white outline-none focus:ring-2 ring-indigo-500">
                    } @else {
                      <h2 (click)="isEditingName.set(true)" class="text-2xl md:text-3xl font-black text-white cursor-pointer hover:text-indigo-400 transition tracking-tighter">{{ ai.userName() }}</h2>
                    }
                    <i class="fa-solid fa-circle-check text-indigo-500 text-lg"></i>
                  </div>
                  
                  <div class="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                    @if (isEditingSpec()) {
                      <input #specInput [value]="ai.specialization()" (blur)="saveSpec(specInput.value)" (keyup.enter)="saveSpec(specInput.value)"
                             class="bg-slate-800 border border-indigo-500/50 rounded-lg px-2 py-0.5 text-xs outline-none" placeholder="التخصص...">
                    } @else {
                      <span (click)="isEditingSpec.set(true)" class="cursor-pointer hover:underline">{{ ai.specialization() || 'أضف تخصصك' }}</span>
                    }
                  </div>
                </div>

                <div class="flex gap-2">
                  <button (click)="isEditingData.set(true)" class="bg-slate-800 hover:bg-slate-700 text-white px-6 py-2 rounded-xl text-sm font-black transition border border-white/5">تعديل الملف</button>
                  <button (click)="showPrivacy.set(true)" class="bg-slate-800 hover:bg-slate-700 text-white p-2 rounded-xl transition border border-white/5"><i class="fa-solid fa-cog"></i></button>
                </div>
              </div>

              <!-- Bio & Link -->
              <div class="space-y-2 text-right">
                @if (isEditingBio()) {
                  <textarea #bioInput [value]="ai.bio()" (blur)="saveBio(bioInput.value)" (keyup.enter)="saveBio(bioInput.value)"
                            class="w-full bg-slate-800 border border-indigo-500/50 rounded-xl px-4 py-2 text-sm text-slate-300 outline-none focus:ring-2 ring-indigo-500" placeholder="اكتب نبذة عنك..."></textarea>
                } @else {
                  <p (click)="isEditingBio.set(true)" class="text-sm text-slate-300 font-medium cursor-pointer hover:text-white transition leading-relaxed">
                    {{ ai.bio() || 'اكتب جملة مميزة تعبر عنك هنا...' }}
                  </p>
                }

                @if (isEditingLink()) {
                  <input #linkInput [value]="ai.link()" (blur)="saveLink(linkInput.value)" (keyup.enter)="saveLink(linkInput.value)"
                         class="w-full bg-slate-800 border border-indigo-500/50 rounded-xl px-4 py-1 text-xs text-indigo-400 outline-none" placeholder="أضف رابط (مثلاً: LinkedIn)...">
                } @else {
                  <a (click)="isEditingLink.set(true); $event.preventDefault()" [href]="ai.link() || '#'" class="text-xs font-black text-indigo-400 hover:underline flex items-center justify-end gap-2">
                    {{ ai.link() || 'أضف رابطاً خاصاً بك' }}
                    <i class="fa-solid fa-link"></i>
                  </a>
                }
              </div>
            </div>
          </div>

          <!-- Stats Summary -->
          <div class="flex justify-around md:justify-start md:gap-16 pt-8 border-t border-white/5 mt-8">
            <div class="text-center md:text-right">
              <div class="flex items-center gap-2 justify-center md:justify-end">
                <i [class]="'fa-solid ' + currentTier().icon + ' ' + currentTier().color"></i>
                <p class="text-xl font-black text-white">{{ currentTier().name }}</p>
              </div>
              <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">الرتبة الحالية</p>
            </div>
            <div class="text-center md:text-right">
              <p class="text-xl font-black text-white tabular-nums">{{ ai.userXP() }}</p>
              <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">نقاط خبرة</p>
            </div>
            <div class="text-center md:text-right">
              <p class="text-xl font-black text-white tabular-nums">{{ ai.currentSubjects().length }}</p>
              <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">مواد</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions Grid -->
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        <button (click)="navigateTo('planner')" class="group bg-slate-900 p-6 rounded-3xl border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all text-center space-y-3 shadow-xl">
          <div class="w-12 h-12 bg-emerald-600/20 rounded-2xl flex items-center justify-center text-emerald-500 mx-auto group-hover:scale-110 transition">
            <i class="fa-solid fa-tasks text-xl"></i>
          </div>
          <p class="text-xs font-black text-white">إدارة المهام</p>
        </button>
        <button (click)="navigateTo('planner')" class="group bg-slate-900 p-6 rounded-3xl border border-white/5 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all text-center space-y-3 shadow-xl">
          <div class="w-12 h-12 bg-amber-600/20 rounded-2xl flex items-center justify-center text-amber-500 mx-auto group-hover:scale-110 transition">
            <i class="fa-solid fa-calendar-days text-xl"></i>
          </div>
          <p class="text-xs font-black text-white">جدول</p>
        </button>
        <button (click)="navigateTo('research')" class="group bg-slate-900 p-6 rounded-3xl border border-white/5 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all text-center space-y-3 shadow-xl">
          <div class="w-12 h-12 bg-purple-600/20 rounded-2xl flex items-center justify-center text-purple-500 mx-auto group-hover:scale-110 transition">
            <i class="fa-solid fa-microscope text-xl"></i>
          </div>
          <p class="text-xs font-black text-white">أبحاث أكاديمية</p>
        </button>
      </div>

      <!-- Content Tabs (Subjects & History) -->
      @if (ai.isPublicProfile()) {
        <div class="space-y-6">
          <div class="flex justify-center border-b border-white/5">
            <button (click)="activeTab.set('subjects')" [class.border-indigo-500]="activeTab() === 'subjects'" [class.text-white]="activeTab() === 'subjects'" class="px-8 py-4 border-b-2 border-transparent text-slate-500 font-black text-sm transition">المواد</button>
            <button (click)="activeTab.set('history')" [class.border-indigo-500]="activeTab() === 'history'" [class.text-white]="activeTab() === 'history'" class="px-8 py-4 border-b-2 border-transparent text-slate-500 font-black text-sm transition">سجل الأداء</button>
          </div>

          @if (activeTab() === 'subjects') {
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500">
              @for (subject of ai.currentSubjects(); track subject.name) {
                <div class="bg-slate-900 p-6 rounded-3xl border border-white/5 space-y-4 shadow-lg">
                  <div class="flex justify-between items-center">
                    <span class="bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-[10px] font-black border border-indigo-500/20">Lvl {{ subject.level }}</span>
                    <div class="flex items-center gap-3">
                      <button (click)="removeSubject(subject.name)" class="text-slate-600 hover:text-rose-500 transition"><i class="fa-solid fa-trash-can text-xs"></i></button>
                      <h4 class="text-lg font-black text-white">{{ subject.name }}</h4>
                    </div>
                  </div>
                  <div class="h-2 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                    <div class="h-full bg-indigo-500 rounded-full transition-all duration-1000" [style.width.%]="subject.xp % 100"></div>
                  </div>
                </div>
              }
              <button (click)="addSubject()" class="border-2 border-dashed border-white/5 rounded-3xl p-6 flex flex-col items-center justify-center gap-3 text-slate-500 hover:border-indigo-500/50 hover:text-indigo-400 transition group">
                <i class="fa-solid fa-plus text-2xl group-hover:scale-110 transition"></i>
                <span class="text-xs font-black uppercase tracking-widest">إضافة مادة جديدة</span>
              </button>
            </div>
          } @else {
            <div class="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
              <div class="flex justify-between items-center mb-4">
                <button (click)="clearPerformanceHistory()" class="text-[10px] font-black text-rose-500 hover:text-rose-400 transition-colors uppercase tracking-widest">مسح السجل</button>
                <h4 class="text-white font-black text-right">سجل الأداء الأكاديمي</h4>
              </div>
              @for (record of ai.performanceHistory(); track record.date) {
                <div class="bg-slate-900 p-5 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-indigo-500/30 transition">
                  <div class="flex items-center gap-6">
                    <div class="text-right">
                      <p class="text-lg font-black text-white tabular-nums">{{ record.score }}%</p>
                      <p class="text-[10px] font-black text-slate-500">النتيجة</p>
                    </div>
                    <div class="text-2xl">
                      {{ ai.getFace(record.score) }}
                    </div>
                    <div [class]="'w-10 h-10 rounded-xl flex items-center justify-center text-white ' + getRecordColor(record.type)">
                      <i [class]="'fa-solid ' + getRecordIcon(record.type)"></i>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="flex items-center gap-2 justify-end">
                      <span class="text-xs font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">{{ record.grade || ai.getGrade(record.score) }}</span>
                      <p class="text-sm font-bold text-white">{{ record.subject || getRecordLabel(record.type) }}</p>
                    </div>
                    <p class="text-[10px] text-slate-500 font-bold">{{ formatDate(record.date) }}</p>
                  </div>
                </div>
              } @empty {
                <div class="text-center py-20 opacity-30">
                  <i class="fa-solid fa-history text-5xl mb-4"></i>
                  <p class="font-bold">لا يوجد سجل أداء حالياً</p>
                </div>
              }
            </div>
          }
        </div>
      } @else {
        <div class="bg-slate-900/50 border border-white/5 rounded-[2rem] p-12 text-center space-y-4 animate-in fade-in duration-500">
          <div class="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center text-slate-600 mx-auto">
            <i class="fa-solid fa-lock text-3xl"></i>
          </div>
          <h3 class="text-xl font-black text-white">هذا الملف الشخصي خاص</h3>
          <p class="text-sm text-slate-500 font-bold">قم بتفعيل "ملف شخصي عام" من الإعدادات لمشاركة تقدمك.</p>
        </div>
      }
    </div>

    <!-- Privacy Settings Modal -->
    @if (showPrivacy()) {
      <div class="fixed inset-0 bg-black/80 backdrop-blur-xl z-[300] flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div class="bg-slate-900 w-full max-w-lg rounded-[2.5rem] border border-white/10 shadow-3xl overflow-hidden animate-in zoom-in-95 duration-500">
          <div class="p-8 border-b border-white/5 flex justify-between items-center bg-slate-950/50">
            <h3 class="text-xl font-black text-white">إعدادات الخصوصية</h3>
            <button (click)="showPrivacy.set(false)" class="w-10 h-10 rounded-full glass hover:bg-rose-500 transition"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="p-8 space-y-6">
            <div class="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-white/5">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center text-indigo-500"><i class="fa-solid fa-eye"></i></div>
                <div class="text-right">
                  <p class="text-sm font-black text-white">ملف شخصي عام</p>
                  <p class="text-[10px] text-slate-500">السماح للآخرين برؤية تقدمك</p>
                </div>
              </div>
              <button (click)="ai.isPublicProfile.set(!ai.isPublicProfile())" 
                      [class]="ai.isPublicProfile() ? 'bg-indigo-600' : 'bg-slate-700'"
                      class="w-12 h-6 rounded-full relative transition-colors">
                <div [class]="ai.isPublicProfile() ? 'right-1' : 'left-1'" 
                     class="absolute top-1 w-4 h-4 bg-white rounded-full transition-all"></div>
              </button>
            </div>
            <div class="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-white/5">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-emerald-600/20 rounded-xl flex items-center justify-center text-emerald-500"><i class="fa-solid fa-chart-line"></i></div>
                <div class="text-right">
                  <p class="text-sm font-black text-white">مشاركة الإحصائيات</p>
                  <p class="text-[10px] text-slate-500">مشاركة نتائج الاختبارات مع المعلمين</p>
                </div>
              </div>
              <button (click)="ai.shareStats.set(!ai.shareStats())"
                      [class]="ai.shareStats() ? 'bg-emerald-600' : 'bg-slate-700'"
                      class="w-12 h-6 rounded-full relative transition-colors">
                <div [class]="ai.shareStats() ? 'right-1' : 'left-1'" 
                     class="absolute top-1 w-4 h-4 bg-white rounded-full transition-all"></div>
              </button>
            </div>
            <button (click)="clearAllData()" class="w-full p-4 rounded-2xl bg-rose-600/10 border border-rose-500/20 text-rose-500 font-black text-sm hover:bg-rose-600 hover:text-white transition flex items-center justify-center gap-3">
              <i class="fa-solid fa-trash-can"></i>
              مسح جميع البيانات والبدء من جديد
            </button>
          </div>
          <div class="p-8 bg-slate-950/50 border-t border-white/5 text-center">
            <button (click)="showPrivacy.set(false)" class="bg-indigo-600 text-white px-10 py-3 rounded-xl font-black shadow-lg">حفظ الإعدادات</button>
          </div>
        </div>
      </div>
    }

    <!-- Edit Data Modal -->
    @if (isEditingData()) {
      <div class="fixed inset-0 bg-black/80 backdrop-blur-xl z-[300] flex items-center justify-center p-6 animate-in fade-in duration-300">
        <div class="bg-slate-900 w-full max-w-lg rounded-[2.5rem] border border-white/10 shadow-3xl overflow-hidden animate-in zoom-in-95 duration-500">
          <div class="p-8 border-b border-white/5 flex justify-between items-center bg-slate-950/50">
            <h3 class="text-xl font-black text-white">تعديل البيانات الشخصية</h3>
            <button (click)="isEditingData.set(false)" class="w-10 h-10 rounded-full glass hover:bg-rose-500 transition"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="p-8 space-y-4">
            <div class="space-y-2 text-right">
              <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest">الاسم الكامل</label>
              <input #nInput [value]="ai.userName()" class="w-full bg-slate-950 border border-white/10 p-4 rounded-xl text-white outline-none focus:ring-2 ring-indigo-500">
            </div>
            <div class="space-y-2 text-right">
              <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest">التخصص</label>
              <input #sInput [value]="ai.specialization()" class="w-full bg-slate-950 border border-white/10 p-4 rounded-xl text-white outline-none focus:ring-2 ring-indigo-500">
            </div>
            <div class="space-y-2 text-right">
              <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest">النبذة التعريفية</label>
              <textarea #bInput [value]="ai.bio()" class="w-full bg-slate-950 border border-white/10 p-4 rounded-xl text-white outline-none focus:ring-2 ring-indigo-500 h-24"></textarea>
            </div>
            <div class="space-y-2 text-right">
              <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest">الرابط</label>
              <input #lInput [value]="ai.link()" class="w-full bg-slate-950 border border-white/10 p-4 rounded-xl text-white outline-none focus:ring-2 ring-indigo-500">
            </div>
          </div>
          <div class="p-8 bg-slate-950/50 border-t border-white/5 text-center">
            <button (click)="saveAllData(nInput.value, sInput.value, bInput.value, lInput.value)" class="bg-indigo-600 text-white px-10 py-3 rounded-xl font-black shadow-lg">حفظ التغييرات</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .shadow-3xl { box-shadow: 0 40px 100px -20px rgba(0,0,0,0.5); }
  `]
})
export class ProfilePage {
  ai = inject(AIService);

  isEditingName = signal(false);
  isEditingSpec = signal(false);
  isEditingBio = signal(false);
  isEditingLink = signal(false);
  isEditingData = signal(false);
  showPrivacy = signal(false);
  activeTab = signal<'subjects' | 'history'>('subjects');

  currentTier = computed(() => {
    const xp = this.ai.userXP();
    if (xp < 500) return { name: 'مبتدئ', icon: 'fa-seedling', color: 'text-emerald-400', nextXP: 500 };
    if (xp < 2000) return { name: 'مستكشف', icon: 'fa-compass', color: 'text-blue-400', nextXP: 2000 };
    if (xp < 5000) return { name: 'باحث', icon: 'fa-microscope', color: 'text-purple-400', nextXP: 5000 };
    if (xp < 10000) return { name: 'عالم', icon: 'fa-atom', color: 'text-amber-400', nextXP: 10000 };
    return { name: 'أسطورة', icon: 'fa-crown', color: 'text-rose-400', nextXP: Infinity };
  });

  saveName(val: string) {
    if (val.trim()) this.ai.userName.set(val);
    this.isEditingName.set(false);
  }

  saveSpec(val: string) {
    if (val.trim()) this.ai.specialization.set(val);
    this.isEditingSpec.set(false);
  }

  saveBio(val: string) {
    this.ai.bio.set(val);
    this.isEditingBio.set(false);
  }

  saveLink(val: string) {
    this.ai.link.set(val);
    this.isEditingLink.set(false);
  }

  saveAllData(name: string, spec: string, bio: string, link: string) {
    this.ai.userName.set(name);
    this.ai.specialization.set(spec);
    this.ai.bio.set(bio);
    this.ai.link.set(link);
    this.isEditingData.set(false);
  }

  onImageSelected(event: Event, type: 'profile' | 'cover') {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        if (type === 'profile') this.ai.profileImage.set(e.target?.result as string);
        else this.ai.coverImage.set(e.target?.result as string);
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  addSubject() {
    const name = prompt('أدخل اسم المادة الجديدة:');
    if (name && name.trim()) {
      const exists = this.ai.currentSubjects().find(s => s.name.toLowerCase() === name.toLowerCase());
      if (!exists) {
        this.ai.currentSubjects.update(s => [...s, { name, level: 1, xp: 0, importance: 'medium' }]);
      }
    }
  }

  removeSubject(name: string) {
    if (confirm(`هل أنت متأكد من حذف مادة ${name}؟`)) {
      this.ai.currentSubjects.update(s => s.filter(sub => sub.name !== name));
    }
  }

  clearPerformanceHistory() {
    if (confirm('هل أنت متأكد من مسح سجل الأداء؟')) {
      this.ai.performanceHistory.set([]);
    }
  }

  navigateTo(page: string) {
    (window as unknown as { appComponent?: { activePage: { set: (p: string) => void } } }).appComponent?.activePage.set(page);
  }

  clearAllData() {
    if (confirm('هل أنت متأكد من مسح جميع بياناتك؟ لا يمكن التراجع عن هذه الخطوة.')) {
      this.ai.userName.set('أحمد العتيبي');
      this.ai.specialization.set('');
      this.ai.bio.set('');
      this.ai.link.set('');
      this.ai.profileImage.set('');
      this.ai.coverImage.set('');
      this.ai.currentSubjects.set([]);
      this.ai.performanceHistory.set([]);
      this.ai.simulationsCompleted.set(0);
      this.ai.totalStudyHours.set(0);
      this.ai.userXP.set(0);
      this.ai.userLevel.set(1);
      this.showPrivacy.set(false);
    }
  }

  getRecordIcon(type: string) {
    switch (type) {
      case 'simulation': return 'fa-flask-vial';
      case 'study': return 'fa-book-open';
      default: return 'fa-star';
    }
  }

  getRecordColor(type: string) {
    switch (type) {
      case 'simulation': return 'bg-emerald-600';
      case 'study': return 'bg-amber-600';
      default: return 'bg-slate-600';
    }
  }

  getRecordLabel(type: string) {
    switch (type) {
      case 'simulation': return 'محاكاة عملية';
      case 'study': return 'جلسة دراسة';
      default: return 'نشاط';
    }
  }

  formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('ar-EG', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }
}

