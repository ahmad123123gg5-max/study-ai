
import { Component, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AIService } from '../../services/ai.service';

type CourseView = 'list' | 'details' | 'classroom';

interface Module {
  id: string;
  title: string;
  duration: string;
  completed: boolean;
  content: string;
}

interface Course {
  id: number;
  title: string;
  subtitle: string;
  desc: string;
  category: string;
  duration: string;
  level: 'مبتدئ' | 'متوسط' | 'متقدم';
  image: string;
  rating: number;
  students: number;
  instructor: {
    name: string;
    avatar: string;
    role: string;
  };
  modules: Module[];
}

@Component({
  selector: 'app-courses-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700 pb-20">
      
      @switch (view()) {
        <!-- 1. COURSE LIST VIEW -->
        @case ('list') {
          <div class="space-y-12 animate-in slide-in-from-bottom-10 duration-700">
            <!-- Hero Banner -->
            <div class="relative bg-slate-900 rounded-[4rem] p-16 border border-white/10 shadow-[0_0_150px_rgba(79,70,229,0.15)] overflow-hidden">
               <div class="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-16">
                  <div class="text-right space-y-8 max-w-3xl">
                     <div class="inline-flex items-center gap-3 bg-indigo-500/10 text-indigo-400 px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.4em] border border-indigo-500/20">
                        <span class="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>
                        StudyVex Academic Cloud: Online
                     </div>
                     <h2 class="text-7xl md:text-9xl font-black text-white leading-[0.85] tracking-tighter">
                        اصنع <span class="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-500">مستقبلك</span> بالمعرفة
                     </h2>
                     <p class="text-slate-400 text-2xl font-medium leading-relaxed max-w-2xl">أكثر من 500 دورة تخصصية يقودها الذكاء الاصطناعي لضمان وصولك إلى قمة هرم الإبداع المهني والأكاديمي.</p>
                     
                     <div class="flex flex-wrap gap-6 pt-6">
                        <div class="flex items-center gap-4 glass px-8 py-4 rounded-[1.5rem]">
                           <i class="fa-solid fa-users text-indigo-500 text-2xl"></i>
                           <div class="text-right">
                              <p class="text-[10px] font-black text-slate-500 uppercase">الطلاب النشطين</p>
                              <p class="text-xl font-black text-white">+1.2M</p>
                           </div>
                        </div>
                        <div class="flex items-center gap-4 glass px-8 py-4 rounded-[1.5rem]">
                           <i class="fa-solid fa-star text-amber-500 text-2xl"></i>
                           <div class="text-right">
                              <p class="text-[10px] font-black text-slate-500 uppercase">تقييم المنصة</p>
                              <p class="text-xl font-black text-white">4.9/5.0</p>
                           </div>
                        </div>
                     </div>
                  </div>
                  
                  <div class="w-full lg:w-[35rem] shrink-0">
                    <div class="relative group">
                       <input (input)="searchTerm.set($any($event.target).value)" 
                              type="text" placeholder="ما هي المهارة التي تود إتقانها؟" 
                              class="w-full bg-slate-950 text-white p-10 pr-20 rounded-[3rem] border-2 border-white/5 outline-none focus:border-indigo-500/50 focus:ring-8 ring-indigo-500/5 transition-all text-2xl font-bold shadow-3xl placeholder:opacity-30">
                       <i class="fa-solid fa-magnifying-glass absolute right-8 top-1/2 -translate-y-1/2 text-indigo-500 text-4xl group-focus-within:scale-110 transition-transform"></i>
                    </div>
                  </div>
               </div>
               <div class="absolute -top-60 -left-60 w-[1000px] h-[1000px] bg-indigo-600/10 rounded-full blur-[200px]"></div>
            </div>

            <!-- Categories -->
            <div class="flex flex-wrap justify-center gap-6">
               @for (cat of categories; track cat) {
                  <button (click)="activeCategory.set(cat)" 
                          [class.bg-indigo-600]="activeCategory() === cat"
                          [class.text-white]="activeCategory() === cat"
                          [class.border-indigo-500]="activeCategory() === cat"
                          class="px-10 py-5 rounded-[1.8rem] glass text-sm font-black hover:bg-white/10 transition border border-white/5 tracking-widest uppercase text-slate-400 hover:text-white">
                    {{ cat }}
                  </button>
               }
            </div>

            <!-- Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 px-2">
               @for (course of filteredCourses(); track course.id) {
                  <div (click)="selectCourse(course)" 
                       class="group bg-slate-900 rounded-[4rem] overflow-hidden border border-white/5 cursor-pointer hover:shadow-[0_60px_100px_rgba(0,0,0,0.5)] transition-all duration-700 hover:-translate-y-6">
                     <div class="h-80 relative overflow-hidden">
                        <img [src]="course.image" class="w-full h-full object-cover transition duration-[2s] group-hover:scale-110 group-hover:brightness-50">
                        <div class="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-slate-900 to-transparent">
                           <div class="flex gap-3">
                              <span class="bg-indigo-600 text-white text-[10px] font-black px-6 py-2 rounded-full uppercase tracking-widest shadow-2xl">{{ course.category }}</span>
                              <span class="glass text-white text-[10px] font-black px-6 py-2 rounded-full uppercase tracking-widest">{{ course.level }}</span>
                           </div>
                        </div>
                        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-indigo-900/40 backdrop-blur-sm">
                           <div class="w-24 h-24 bg-white text-indigo-600 rounded-full flex items-center justify-center text-4xl shadow-3xl animate-in zoom-in-75">
                              <i class="fa-solid fa-play ml-2"></i>
                           </div>
                        </div>
                     </div>
                     <div class="p-12 space-y-8">
                        <div class="flex justify-between items-center">
                           <div class="flex items-center gap-3">
                              <img [src]="course.instructor.avatar" class="w-10 h-10 rounded-full border-2 border-indigo-500/20">
                              <span class="text-xs font-black text-slate-400 uppercase tracking-widest">{{ course.instructor.name }}</span>
                           </div>
                           <div class="flex items-center gap-2 text-amber-500 font-black text-sm">
                              <i class="fa-solid fa-star"></i> {{ course.rating }}
                           </div>
                        </div>
                        <h3 class="text-3xl font-black text-white leading-tight group-hover:text-indigo-400 transition tracking-tighter">{{ course.title }}</h3>
                        <p class="text-slate-400 text-lg leading-relaxed line-clamp-2 font-medium">{{ course.desc }}</p>
                        <div class="pt-8 border-t border-white/5 flex justify-between items-center">
                           <div class="flex flex-col gap-1">
                              <span class="text-sm font-black text-white">{{ course.duration }}</span>
                              <span class="text-[10px] font-black text-slate-600 uppercase tracking-widest">محتوى تعليمي مكثف</span>
                           </div>
                           <button class="bg-white/5 hover:bg-indigo-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center transition shadow-xl">
                              <i class="fa-solid fa-arrow-left text-xl"></i>
                           </button>
                        </div>
                     </div>
                  </div>
               }
            </div>
          </div>
        }

        <!-- 2. COURSE DETAILS VIEW -->
        @case ('details') {
          <div class="animate-in slide-in-from-bottom-20 duration-1000 max-w-6xl mx-auto space-y-20">
             <button (click)="view.set('list')" class="flex items-center gap-6 text-slate-500 hover:text-white transition font-black text-2xl group">
                <i class="fa-solid fa-arrow-right group-hover:translate-x-3 transition"></i> العودة للأكاديمية
             </button>

             <div class="grid grid-cols-1 lg:grid-cols-12 gap-24">
                <div class="lg:col-span-7 space-y-16 text-right">
                   <div class="space-y-10">
                      <div class="flex justify-end gap-4">
                         <span class="bg-indigo-600/10 text-indigo-400 px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest border border-indigo-500/20">{{ selectedCourse()?.category }}</span>
                         <span class="bg-emerald-600/10 text-emerald-400 px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest border border-emerald-500/20">اعتماد StudyVex</span>
                      </div>
                      <h2 class="text-8xl font-black text-white tracking-tighter leading-[0.85]">{{ selectedCourse()?.title }}</h2>
                      <p class="text-4xl font-bold text-slate-400 leading-relaxed">{{ selectedCourse()?.subtitle }}</p>
                   </div>

                   <div class="grid grid-cols-3 gap-8 border-y border-white/5 py-12">
                      <div class="text-center">
                         <p class="text-[10px] font-black text-slate-600 uppercase mb-4 tracking-[0.3em]">المستوى التعليمي</p>
                         <p class="text-3xl font-black text-indigo-400">{{ selectedCourse()?.level }}</p>
                      </div>
                      <div class="text-center border-x border-white/10">
                         <p class="text-[10px] font-black text-slate-600 uppercase mb-4 tracking-[0.3em]">إجمالي المحتوى</p>
                         <p class="text-3xl font-black text-white">{{ selectedCourse()?.modules?.length }} وحدات</p>
                      </div>
                      <div class="text-center">
                         <p class="text-[10px] font-black text-slate-600 uppercase mb-4 tracking-[0.3em]">لغة التدريس</p>
                         <p class="text-3xl font-black text-emerald-400">العربية</p>
                      </div>
                   </div>

                   <div class="space-y-12">
                      <h3 class="text-5xl font-black text-white flex items-center gap-6 justify-end">منهج المسار التعليمي <i class="fa-solid fa-route text-indigo-500"></i></h3>
                      <div class="space-y-6">
                         @for (mod of selectedCourse()?.modules; track mod.id; let i = $index) {
                            <div class="glass p-10 rounded-[3rem] border border-white/5 flex items-center justify-between group hover:bg-white/5 transition hover:shadow-2xl">
                               <div class="flex items-center gap-10">
                                  <div class="w-16 h-16 rounded-[1.5rem] bg-slate-950 flex items-center justify-center text-slate-500 font-black text-2xl group-hover:text-indigo-400 transition shadow-inner">
                                    {{ i + 1 }}
                                  </div>
                                  <div class="text-right">
                                     <h4 class="text-2xl font-black text-white mb-2">{{ mod.title }}</h4>
                                     <p class="text-sm text-slate-500 font-bold uppercase tracking-widest">{{ mod.duration }} • فيديو بجودة 4K</p>
                                  </div>
                               </div>
                               <i class="fa-solid fa-circle-play text-4xl text-slate-700 group-hover:text-indigo-500 transition"></i>
                            </div>
                         }
                      </div>
                   </div>
                </div>

                <div class="lg:col-span-5">
                   <div class="sticky top-32 space-y-12">
                      <div class="aspect-video rounded-[4rem] overflow-hidden shadow-[0_100px_150px_rgba(0,0,0,0.8)] border-8 border-white/5 bg-slate-900 group relative">
                         <img [src]="selectedCourse()?.image" class="w-full h-full object-cover shadow-2xl transition duration-[2s] group-hover:scale-105">
                         <div class="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-6 opacity-0 group-hover:opacity-100 transition duration-700 backdrop-blur-md">
                            <i class="fa-solid fa-lock text-7xl text-white/30"></i>
                            <span class="text-white font-black text-xl uppercase tracking-widest">الدورة مقفلة حالياً</span>
                         </div>
                      </div>
                      <div class="bg-slate-900 p-16 rounded-[5rem] border border-white/5 space-y-12 shadow-3xl text-right">
                         <div class="space-y-4">
                            <p class="text-xs font-black text-slate-600 uppercase tracking-[0.5em]">استثمار مدى الحياة</p>
                            <h4 class="text-7xl font-black text-white">99 <span class="text-2xl text-slate-500 font-bold uppercase ml-2">SAR</span></h4>
                         </div>
                         <button (click)="view.set('classroom')" class="w-full py-10 bg-indigo-600 text-white rounded-[3rem] font-black text-3xl hover:scale-105 transition shadow-[0_40px_80px_rgba(79,70,229,0.5)] flex items-center justify-center gap-6">
                            <i class="fa-solid fa-bolt-lightning"></i> ابدأ التعلم الآن
                         </button>
                         <div class="space-y-6">
                            <div class="flex items-center gap-4 justify-end text-slate-400 font-bold text-lg">شهادة معتمدة من StudyVex <i class="fa-solid fa-certificate text-indigo-500"></i></div>
                            <div class="flex items-center gap-4 justify-end text-slate-400 font-bold text-lg">تحديثات مدى الحياة <i class="fa-solid fa-infinity text-emerald-500"></i></div>
                            <div class="flex items-center gap-4 justify-end text-slate-400 font-bold text-lg">معلم ذكي خاص بكل وحدة <i class="fa-solid fa-brain text-purple-500"></i></div>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        }

        <!-- 3. CLASSROOM VIEW -->
        @case ('classroom') {
          <div class="fixed inset-0 z-[100] bg-slate-950 flex flex-col animate-in zoom-in-95 duration-700 overflow-hidden">
             <!-- Header -->
             <div class="h-32 glass border-b border-white/10 flex items-center justify-between px-20 shrink-0 z-20 backdrop-blur-3xl shadow-2xl">
                <div class="flex items-center gap-16">
                   <button (click)="view.set('details')" class="w-20 h-20 rounded-[2.5rem] glass hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center text-white border border-white/10 shadow-3xl">
                      <i class="fa-solid fa-xmark text-4xl"></i>
                   </button>
                   <div class="h-20 w-px bg-white/10"></div>
                   <div class="text-right">
                      <h3 class="font-black text-white text-5xl line-clamp-1 max-w-2xl tracking-tighter">{{ selectedCourse()?.title }}</h3>
                      <p class="text-[10px] text-indigo-400 font-black uppercase tracking-[0.5em] mt-2">الوحدة {{ activeModuleIndex() + 1 }}: {{ selectedCourse()?.modules?.[activeModuleIndex()]?.title }}</p>
                   </div>
                </div>
                <div class="flex items-center gap-12">
                   <div class="flex flex-col items-end gap-3">
                      <span class="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">المسار المكتمل</span>
                      <div class="w-64 h-3 bg-slate-900 rounded-full overflow-hidden border border-white/10 shadow-inner">
                         <div class="h-full bg-indigo-500 transition-all duration-[2s] shadow-[0_0_20px_rgba(99,102,241,0.5)]" 
                              [style.width]="(activeModuleIndex() + 1) / (selectedCourse()?.modules?.length || 1) * 100 + '%'"></div>
                      </div>
                   </div>
                   <button class="bg-emerald-600 text-white px-12 py-6 rounded-[2.5rem] font-black text-xl hover:scale-105 transition shadow-2xl shadow-emerald-500/30">تحميل الحقيبة</button>
                </div>
             </div>

             <div class="flex-1 flex overflow-hidden">
                <!-- Syllabus Sidebar -->
                <div class="w-[42rem] glass border-l border-white/10 flex flex-col bg-slate-900/40 backdrop-blur-[100px] relative z-10 shrink-0 shadow-[-50px_0_100px_rgba(0,0,0,0.5)]">
                   <div class="p-14 border-b border-white/10 bg-slate-950/40">
                      <h4 class="text-white font-black text-3xl tracking-tighter flex items-center gap-4">
                         <i class="fa-solid fa-list-check text-indigo-500"></i> خريطة المنهج
                      </h4>
                   </div>
                   <div class="flex-1 overflow-y-auto p-8 space-y-4 no-scrollbar">
                      @for (mod of selectedCourse()?.modules; track mod.id; let i = $index) {
                         <button (click)="activeModuleIndex.set(i)" 
                                 [class.bg-indigo-600]="activeModuleIndex() === i"
                                 [class.bg-slate-900]="activeModuleIndex() !== i"
                                 [class.scale-95]="activeModuleIndex() !== i"
                                 class="w-full text-right p-8 rounded-[2.5rem] border border-white/5 transition-all flex items-center gap-8 group hover:scale-100">
                            <div class="w-14 h-14 rounded-2xl bg-slate-950 flex items-center justify-center text-lg font-black text-slate-600 group-hover:text-indigo-400 transition"
                                 [class.text-indigo-100]="activeModuleIndex() === i">
                               {{ i + 1 }}
                            </div>
                            <div class="flex-1">
                               <p class="font-black text-white text-xl tracking-tight" [class.text-indigo-100]="activeModuleIndex() === i">{{ mod.title }}</p>
                               <span class="text-[9px] font-black text-slate-600 uppercase tracking-widest group-hover:text-indigo-300 transition">{{ mod.duration }} • درس تخصصي</span>
                            </div>
                            @if (mod.completed || activeModuleIndex() > i) {
                               <div class="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-2xl animate-in zoom-in"><i class="fa-solid fa-check text-xs"></i></div>
                            }
                         </button>
                      }
                   </div>
                </div>

                <!-- Learning Core -->
                <div class="flex-1 bg-slate-950 p-16 overflow-y-auto no-scrollbar relative flex justify-center">
                   <div class="max-w-6xl w-full space-y-16">
                      <!-- Cinema Video Player -->
                      <div class="aspect-video bg-black rounded-[4rem] shadow-[0_100px_200px_rgba(0,0,0,0.8)] border-[12px] border-white/5 relative overflow-hidden group">
                         <img [src]="selectedCourse()?.image" class="w-full h-full object-cover opacity-20 blur-xl">
                         <div class="absolute inset-0 flex flex-col items-center justify-center gap-8">
                            <div class="w-40 h-40 bg-white text-slate-950 rounded-full flex items-center justify-center text-6xl shadow-3xl cursor-pointer hover:scale-110 active:scale-95 transition-all group-hover:rotate-6">
                               <i class="fa-solid fa-play ml-4"></i>
                            </div>
                            <h2 class="text-4xl font-black text-white tracking-widest uppercase opacity-20 group-hover:opacity-100 transition duration-700">اضغط لبدء الدرس</h2>
                         </div>
                         <!-- Telemetry HUD -->
                         <div class="absolute top-10 right-10 flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div class="glass px-6 py-3 rounded-2xl text-[10px] font-black text-white tracking-widest border border-white/20">4K HDR</div>
                            <div class="glass px-6 py-3 rounded-2xl text-[10px] font-black text-emerald-400 tracking-widest border border-emerald-500/20">AUTO-SYNC: ON</div>
                         </div>
                      </div>

                      <div class="grid grid-cols-1 lg:grid-cols-12 gap-16">
                         <div class="lg:col-span-7 space-y-12 text-right">
                            <div class="space-y-6">
                               <h2 class="text-6xl font-black text-white tracking-tighter">أهداف الجلسة الحالية</h2>
                               <p class="text-3xl text-slate-400 leading-relaxed font-medium">في هذه الوحدة الرقمية، سنقوم بتفكيك المفاهيم المعقدة المتعلقة بـ "{{ selectedCourse()?.modules?.[activeModuleIndex()]?.title }}". تم تصميم هذا المحتوى ليكون تطبيقياً بنسبة 100%.</p>
                            </div>
                            <div class="bg-indigo-600/5 p-12 rounded-[4rem] border border-indigo-500/20 relative overflow-hidden">
                               <h4 class="text-indigo-400 font-black text-2xl mb-8 flex items-center gap-4 justify-end">المخرجات التعليمية المتوقعة <i class="fa-solid fa-bullseye text-indigo-500"></i></h4>
                               <ul class="space-y-6 text-slate-200 font-bold text-2xl">
                                  <li class="flex items-center gap-6 justify-end">القدرة على تحليل الهيكل النظري بدقة <i class="fa-solid fa-circle-check text-emerald-500 text-sm"></i></li>
                                  <li class="flex items-center gap-6 justify-end">تطبيق النماذج العملية في بيئة محاكاة <i class="fa-solid fa-circle-check text-emerald-500 text-sm"></i></li>
                                  <li class="flex items-center gap-6 justify-end">اتخاذ قرارات تقنية مبنية على البيانات <i class="fa-solid fa-circle-check text-emerald-500 text-sm"></i></li>
                               </ul>
                               <i class="fa-solid fa-dna absolute -left-20 -bottom-20 text-[20rem] opacity-5"></i>
                            </div>
                         </div>

                         <!-- AI Sidekick Tutor -->
                         <div class="lg:col-span-5">
                            <div class="glass border border-white/10 rounded-[4rem] overflow-hidden flex flex-col bg-slate-900/60 shadow-3xl h-[600px] backdrop-blur-3xl">
                               <div class="p-10 border-b border-white/10 bg-slate-950/40 flex items-center gap-6">
                                  <div class="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-3xl animate-pulse ring-4 ring-indigo-500/20"><i class="fa-solid fa-brain text-3xl"></i></div>
                                  <div class="text-right flex-1">
                                     <h5 class="text-white font-black text-2xl tracking-tight">المعلم المساعد الذكي</h5>
                                     <p class="text-[8px] text-emerald-400 font-black uppercase tracking-[0.4em] mt-1 italic">Context-Aware Intelligence</p>
                                  </div>
                               </div>
                               <div class="flex-1 p-10 overflow-y-auto no-scrollbar space-y-8" #chatContainer>
                                  <div class="bg-indigo-600/10 p-8 rounded-[2rem] rounded-tr-none border border-indigo-500/10">
                                     <p class="text-xl text-indigo-100 leading-relaxed font-bold text-right">أهلاً بك! أنا "مساعدك الأكاديمي". لقد قمت بتحليل محتوى الدرس الحالي، وأنا مستعد لتوضيح أي نقطة تقنية أو حتى توليد أمثلة إضافية لك.</p>
                                  </div>
                                  @for (msg of chatMessages(); track msg) {
                                     <div class="flex" [class.justify-end]="msg.role === 'user'">
                                        <div [class.bg-indigo-600]="msg.role === 'user'" 
                                             [class.bg-slate-800]="msg.role === 'model'"
                                             [class.rounded-tr-none]="msg.role === 'user'"
                                             [class.rounded-tl-none]="msg.role === 'model'"
                                             class="max-w-[90%] p-8 rounded-[2.5rem] text-xl font-bold text-white shadow-2xl border border-white/5">
                                           {{ msg.text }}
                                        </div>
                                     </div>
                                  }
                               </div>
                               <div class="p-10 bg-slate-950/80 border-t border-white/10 backdrop-blur-3xl">
                                  <div class="relative">
                                     <input #aiInput (keyup.enter)="askAI(aiInput.value); aiInput.value = ''"
                                            type="text" placeholder="ما الذي لم تفهمه في هذا الدرس؟" 
                                            class="w-full bg-slate-900 text-white p-8 pr-20 rounded-[2.5rem] outline-none focus:ring-4 ring-indigo-600/30 transition-all text-xl font-medium shadow-inner placeholder:opacity-30">
                                     <button (click)="askAI(aiInput.value); aiInput.value = ''"
                                             class="absolute left-6 top-1/2 -translate-y-1/2 w-16 h-16 bg-indigo-600 rounded-2xl text-white text-3xl hover:scale-110 active:scale-95 transition shadow-3xl">
                                        <i class="fa-solid fa-bolt"></i>
                                     </button>
                                  </div>
                               </div>
                            </div>
                         </div>
                      </div>
                      
                      <!-- Navigation -->
                      <div class="flex justify-between items-center py-16 border-t border-white/5">
                         <button (click)="prevModule()" [disabled]="activeModuleIndex() === 0" class="flex items-center gap-6 text-slate-500 hover:text-white disabled:opacity-10 transition font-black text-4xl group">
                            <i class="fa-solid fa-chevron-right group-hover:translate-x-6 transition-transform"></i> الدرس السابق
                         </button>
                         <button (click)="nextModule()" class="bg-emerald-600 text-white px-20 py-8 rounded-[3rem] font-black text-3xl hover:scale-105 transition shadow-[0_50px_100px_rgba(16,185,129,0.3)] flex items-center justify-center gap-8">
                            تم استيعاب المحتوى، التالي <i class="fa-solid fa-chevron-left animate-pulse"></i>
                         </button>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .shadow-3xl { box-shadow: 0 50px 100px rgba(0,0,0,0.7); }
    .no-scrollbar::-webkit-scrollbar { display: none; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CoursesPage {
  private ai = inject(AIService);
  
  view = signal<CourseView>('list');
  searchTerm = signal('');
  activeCategory = signal('جميع المسارات');
  selectedCourse = signal<Course | null>(null);
  activeModuleIndex = signal(0);
  chatMessages = signal<{role: 'user' | 'model', text: string}[]>([]);

  categories = ['جميع المسارات', 'الطب الرقمي', 'هندسة الأنظمة', 'الذكاء الاصطناعي', 'التصميم الإبداعي', 'إدارة المشاريع'];

  allCourses = [
    { 
      id: 1, 
      title: 'الفيزيولوجيا الطبية المتقدمة', 
      subtitle: 'رحلة تفصيلية في آليات العمل البيولوجي للجسم البشري بأحدث الأبحاث.',
      desc: 'دراسة عميقة ومعمقة للأنظمة الحيوية، التركيز على التوازن الديناميكي (Homeostasis) وكيفية تفاعل الأعضاء تحت الضغوط المرضية المختلفة.', 
      category: 'الطب الرقمي', 
      duration: '24 ساعة', 
      level: 'متقدم' as const,
      image: 'https://picsum.photos/1200/800?medical=1',
      rating: 4.9,
      students: 15400,
      instructor: { name: 'د. سارة المنصور', avatar: 'https://picsum.photos/100/100?u=sara', role: 'أستاذ مشارك في علم الأنسجة' },
      modules: [
        { id: '1-1', title: 'التوازن الحيوي والبيئة الداخلية للجسم', duration: '55 دقيقة', completed: true, content: 'شرح مفصل لآليات التغذية الراجعة.' },
        { id: '1-2', title: 'فيزيولوجيا الإشارات العصبية الكيميائية', duration: '120 دقيقة', completed: false, content: 'تحليل النواقل العصبية.' },
        { id: '1-3', title: 'الديناميكا الدموية والتبادل الغازي الرئوي', duration: '90 دقيقة', completed: false, content: 'تغطية كاملة للدورة الدموية.' }
      ]
    },
    { 
      id: 2, 
      title: 'هندسة النماذج اللغوية الضخمة', 
      subtitle: 'كيف تبني وتدرب وتطور نماذج AI قوية على مستوى المنصات الكبرى من الصفر.',
      desc: 'دورة تقنية من الطراز الرفيع تغطي بنية Transformers، تقنيات RAG، والتعلم المعزز RLHF لتحسين الاستجابة الذكية.', 
      category: 'الذكاء الاصطناعي', 
      duration: '35 ساعة', 
      level: 'متقدم' as const,
      image: 'https://picsum.photos/1200/800?ai=1',
      rating: 5.0,
      students: 8200,
      instructor: { name: 'م. خالد الفهد', avatar: 'https://picsum.photos/100/100?u=khaled', role: 'كبير مهندسي الذكاء الاصطناعي' },
      modules: [
        { id: '2-1', title: 'أسس معالجة اللغات الطبيعية الحديثة', duration: '80 دقيقة', completed: false, content: 'من Word2Vec إلى GPT.' },
        { id: '2-2', title: 'بنية الـ Transformer والاهتمام الذاتي', duration: '150 دقيقة', completed: false, content: 'الغوص في التفاصيل الرياضية.' }
      ]
    },
    { 
      id: 3, 
      title: 'أساسيات الجراحة المجهرية', 
      subtitle: 'تعلم الدقة والمهارة في العمليات الجراحية الدقيقة بمساعدة الروبوت.',
      desc: 'مقدمة شاملة عن تقنيات الجراحة الدقيقة، استخدام المجهر الجراحي، والتعامل مع الأنسجة الحساسة في غرف العمليات الحديثة.', 
      category: 'الطب الرقمي', 
      duration: '18 ساعة', 
      level: 'متوسط' as const,
      image: 'https://picsum.photos/1200/800?surgery=1',
      rating: 4.8,
      students: 3100,
      instructor: { name: 'د. فيصل العتيبي', avatar: 'https://picsum.photos/100/100?u=faisal', role: 'استشاري جراحة دقيقة' },
      modules: [
        { id: '3-1', title: 'قواعد التعقيم الجراحي والمجهري', duration: '60 دقيقة', completed: false, content: 'بروتوكولات غرف العمليات.' },
        { id: '3-2', title: 'تقنيات خياطة الأوعية الدموية الدقيقة', duration: '100 دقيقة', completed: false, content: 'تطبيق عملي.' }
      ]
    }
  ];

  filteredCourses = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const cat = this.activeCategory();
    let courses = this.allCourses;

    if (cat !== 'جميع المسارات') {
      courses = courses.filter(c => c.category === cat);
    }

    if (term) {
      courses = courses.filter(c => 
        c.title.toLowerCase().includes(term) || 
        c.desc.toLowerCase().includes(term)
      );
    }
    return courses;
  });

  selectCourse(course: Course) {
    this.selectedCourse.set(course);
    this.view.set('details');
  }

  nextModule() {
    const course = this.selectedCourse();
    if (course && this.activeModuleIndex() < course.modules.length - 1) {
      this.activeModuleIndex.update(i => i + 1);
      this.chatMessages.set([]);
    } else {
      alert('تهانينا! لقد أكملت كافة متطلبات هذا المسار التعليمي. جاري تجهيز شهادتك الذكية.');
      this.view.set('list');
    }
  }

  prevModule() {
    if (this.activeModuleIndex() > 0) {
      this.activeModuleIndex.update(i => i - 1);
      this.chatMessages.set([]);
    }
  }

  async askAI(q: string) {
    if (!q.trim() || !this.selectedCourse()) return;
    this.chatMessages.update(msgs => [...msgs, { role: 'user', text: q }]);
    try {
      const lessonTitle = this.selectedCourse()?.modules?.[this.activeModuleIndex()]?.title;
      const resp = await this.ai.chat(q, `You are the specialized academic tutor for the high-end professional course "${this.selectedCourse()?.title}". 
      The student is currently watching the module: "${lessonTitle}". 
      Provide deep, precise, and doctoral-level explanations in Arabic. If they ask for examples, generate relevant industry scenarios.`);
      this.chatMessages.update(msgs => [...msgs, { role: 'model', text: resp }]);
    } catch {
      this.chatMessages.update(msgs => [...msgs, { role: 'model', text: 'عذراً، واجهت مشكلة في الربط مع العقل الاصطناعي حالياً.' }]);
    }
  }
}

