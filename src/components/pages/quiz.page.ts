import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { AIFileAttachment, AIService, ImprovementPlan, QuizDifficulty, QuizQuestion, QuizQuestionType } from '../../services/ai.service';
import { NotificationService } from '../../services/notification.service';
import { UpgradeModal } from '../shared/upgrade-modal.component';

type QuizView = 'home' | 'config' | 'active' | 'results' | 'review';

interface QuizAttempt {
  id: string;
  date: number;
  score: number;
  xpChange: number;
  questions: QuizQuestion[];
  userAnswers: Array<number | null>;
}

interface SavedMaterial {
  id: string;
  name: string;
  history: QuizAttempt[];
}

@Component({
  selector: 'app-quiz-page',
  standalone: true,
  imports: [CommonModule, UpgradeModal],
  template: `
    @if (aiHelpContext()) {
      <div class="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-lg">
        <div class="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2.2rem] border border-white/10 bg-slate-900 shadow-2xl">
          <div class="flex items-center justify-between border-b border-white/5 px-6 py-5">
            <div class="text-right"><h3 class="font-black text-white">{{ ui('مساعد الاختبار', 'Exam Assistant') }}</h3><p class="text-xs font-bold text-slate-500">{{ aiHelpContext()?.q?.q }}</p></div>
            <button (click)="closeAiHelp()" class="h-10 w-10 rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-rose-500"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="flex-1 space-y-4 overflow-y-auto p-6 no-scrollbar">
            @for (msg of aiHelpHistory(); track msg.role + '-' + $index) {
              <div class="flex" [class.justify-end]="msg.role === 'user'"><div class="max-w-[85%] rounded-[1.4rem] px-4 py-3 text-sm font-medium leading-7 text-white" [class.bg-indigo-600]="msg.role === 'user'" [class.bg-slate-800]="msg.role !== 'user'">{{ msg.text }}</div></div>
            }
            @if (isAiHelping()) { <div class="rounded-[1.4rem] bg-slate-800 px-4 py-3 text-sm font-bold text-slate-300">{{ ui('جاري التفكير...', 'Thinking...') }}</div> }
          </div>
          <div class="border-t border-white/5 p-4"><div class="flex gap-3"><input #aiInput (keyup.enter)="sendAiHelp(aiInput.value); aiInput.value=''" [placeholder]="ui('اطلب توضيحاً أكثر...', 'Ask for more detail...')" class="flex-1 rounded-2xl border border-white/10 bg-slate-800 px-4 py-4 text-sm font-semibold text-white outline-none focus:border-indigo-500"><button (click)="sendAiHelp(aiInput.value); aiInput.value=''" [disabled]="isAiHelping()" class="h-14 w-14 rounded-2xl bg-indigo-600 text-white disabled:opacity-50"><i class="fa-solid fa-paper-plane"></i></button></div></div>
        </div>
      </div>
    }

    <div class="mx-auto max-w-7xl space-y-8 pb-20">
      @switch (view()) {
        @case ('home') {
          <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <aside class="rounded-[2.3rem] border border-white/10 bg-slate-900 p-6 shadow-2xl">
              <div class="mb-5 flex items-center justify-between"><button (click)="clearAllMaterials()" class="text-[10px] font-black uppercase tracking-[0.24em] text-rose-400 hover:text-rose-300">{{ ui('مسح الكل', 'Clear All') }}</button><div class="text-right"><h3 class="text-lg font-black text-white">{{ ui('المواد المحفوظة', 'Saved Materials') }}</h3><p class="text-xs font-bold text-slate-500">{{ savedMaterials().length }}</p></div></div>
              <div class="space-y-3 max-h-[55vh] overflow-y-auto no-scrollbar">
                @for (material of savedMaterials(); track material.id) {
                  <button (click)="selectMaterial(material)" class="flex w-full items-center justify-between rounded-[1.4rem] border p-4 text-right transition" [class.border-indigo-400/30]="selectedMaterial()?.id === material.id" [class.bg-indigo-600/15]="selectedMaterial()?.id === material.id" [class.border-white/5]="selectedMaterial()?.id !== material.id" [class.bg-slate-950/60]="selectedMaterial()?.id !== material.id"><i class="fa-solid fa-book text-indigo-400"></i><div class="min-w-0"><p class="truncate text-sm font-black text-white">{{ material.name }}</p><p class="text-[10px] font-bold text-slate-500">{{ material.history.length }} {{ ui('محاولات', 'attempts') }}</p></div></button>
                } @empty {
                  <div class="rounded-[1.6rem] border border-dashed border-white/10 bg-slate-950/50 px-4 py-10 text-center text-sm font-bold text-slate-500">{{ ui('لا توجد مواد محفوظة بعد.', 'No saved materials yet.') }}</div>
                }
              </div>
            </aside>

            <section class="rounded-[2.6rem] border border-white/10 bg-slate-900 p-6 shadow-2xl lg:col-span-2">
              @if (selectedMaterial(); as material) {
                <div class="space-y-8">
                  <div class="flex flex-wrap items-center justify-between gap-4"><div class="text-right"><h2 class="text-3xl font-black text-white">{{ material.name }}</h2><p class="text-sm font-bold text-slate-500">{{ ui('تابع النتائج وأنشئ اختباراً جديداً.', 'Track results and create a new exam.') }}</p></div><button (click)="createQuizForMaterial(material)" class="rounded-[1.6rem] bg-indigo-600 px-6 py-4 font-black text-white hover:scale-[1.02]">{{ ui('اختبار جديد', 'New Exam') }}</button></div>
                  <div class="grid grid-cols-1 gap-5 md:grid-cols-3">
                    <div class="rounded-[1.8rem] border border-indigo-400/20 bg-indigo-500/10 p-6 text-center"><p class="text-[10px] font-black uppercase tracking-[0.28em] text-indigo-200">{{ ui('متوسط الأداء', 'Average Score') }}</p><p class="mt-4 text-5xl font-black" [class]="getScoreColor(averageScore())">{{ averageScore() }}%</p></div>
                    <div class="rounded-[1.8rem] border border-white/10 bg-slate-950/70 p-6 text-center"><p class="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">{{ ui('عدد الاختبارات', 'Attempts') }}</p><p class="mt-4 text-5xl font-black text-white">{{ material.history.length }}</p></div>
                    <div class="rounded-[1.8rem] border border-white/10 bg-slate-950/70 p-6 text-center"><p class="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">XP</p><p class="mt-4 text-5xl font-black text-white">{{ material.history.reduce(totalXp, 0) }}</p></div>
                  </div>
                  <div class="space-y-3 max-h-[45vh] overflow-y-auto no-scrollbar">@for (attempt of material.history; track attempt.id) { <button (click)="reviewAttempt(attempt)" class="flex w-full items-center justify-between rounded-[1.4rem] border border-white/5 bg-slate-950/60 p-4 text-right transition hover:border-indigo-500/30 hover:bg-white/5"><div class="flex items-center gap-3"><i class="fa-solid fa-history text-indigo-400"></i><div><p class="text-sm font-black text-white">{{ formatDate(attempt.date) }}</p><p class="text-[10px] font-bold text-slate-500">{{ attempt.questions.length }} {{ ui('أسئلة', 'questions') }}</p></div></div><div class="text-left"><p class="text-lg font-black" [class]="getScoreColor(attempt.score)">{{ attempt.score }}%</p><p class="text-[10px] font-bold" [class.text-emerald-400]="attempt.xpChange >= 0" [class.text-rose-400]="attempt.xpChange < 0">{{ attempt.xpChange >= 0 ? '+' : '' }}{{ attempt.xpChange }} XP</p></div></button> }</div>
                </div>
              } @else {
                <div class="flex min-h-[60vh] flex-col justify-between gap-8">
                  <div class="rounded-[2.6rem] border border-indigo-500/20 bg-gradient-to-br from-indigo-600 via-slate-900 to-slate-950 p-8 text-right text-white shadow-2xl"><p class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em]">AI Exam</p><h2 class="mt-5 text-4xl font-black leading-tight">{{ ui('ابنِ اختبارك الذكي من موضوعك أو ملفاتك', 'Build a smart exam from your topic or files') }}</h2><p class="mt-4 text-base font-bold leading-8 text-indigo-100/90">{{ ui('أنشئ اختباراً، احفظ محاولاتك، ثم راجع الأخطاء مع مساعد ذكي.', 'Generate an exam, save attempts, and review mistakes with AI help.') }}</p></div>
                  <div class="flex justify-start"><button (click)="openNewQuizConfig()" class="rounded-[1.8rem] bg-indigo-600 px-8 py-5 text-lg font-black text-white shadow-xl shadow-indigo-500/20 hover:scale-[1.02]">{{ ui('ابدأ اختباراً جديداً', 'Start New Exam') }}</button></div>
                </div>
              }
            </section>
          </div>
        }

        @case ('config') {
          <div class="relative overflow-hidden rounded-[2.6rem] border border-white/10 bg-slate-900 p-6 shadow-2xl md:p-8">
            @if (isBusy()) { <div class="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur-xl"><div class="w-full max-w-xl rounded-[2rem] border border-white/10 bg-slate-900/80 p-8 text-center"><h3 class="text-3xl font-black text-white">{{ loadingMessage() }}</h3><div class="mt-6 h-4 overflow-hidden rounded-full border border-white/10 bg-slate-800"><div class="h-full rounded-full bg-indigo-600 transition-all duration-300" [style.width.%]="loadingProgress()"></div></div><p class="mt-4 text-2xl font-black text-white">{{ loadingProgress().toFixed(0) }}%</p></div></div> }
            <button (click)="view.set('home')" class="mb-8 flex items-center gap-2 text-sm font-black text-slate-400 hover:text-white"><i class="fa-solid fa-arrow-right" [class.fa-arrow-left]="!isArabicUi()"></i>{{ ui('العودة', 'Back') }}</button>
            <div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <div class="space-y-5">
                <div class="text-right"><h2 class="text-3xl font-black text-white">{{ ui('إعداد الاختبار', 'Exam Setup') }}</h2></div>
                <input #subject [value]="activeSubject()" [readonly]="!!activeSubject()" [placeholder]="ui('اسم المادة', 'Subject Name')" class="w-full rounded-2xl border border-white/10 bg-slate-950 px-5 py-4 text-white outline-none focus:border-indigo-500" [class.cursor-not-allowed]="!!activeSubject()">
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2"><input #timer type="number" min="1" [placeholder]="ui('الوقت بالدقائق', 'Time in minutes')" value="10" class="w-full rounded-2xl border border-white/10 bg-slate-950 px-5 py-4 text-white outline-none focus:border-indigo-500"><input #count type="number" min="1" max="50" [placeholder]="ui('عدد الأسئلة', 'Question count')" value="10" class="w-full rounded-2xl border border-white/10 bg-slate-950 px-5 py-4 text-white outline-none focus:border-indigo-500"></div>
                <div class="grid grid-cols-1 gap-4 md:grid-cols-3"><select #lang (change)="quizLanguage.set(lang.value === 'en' ? 'en' : 'ar')" class="w-full rounded-2xl border border-white/10 bg-slate-950 px-5 py-4 text-white outline-none focus:border-indigo-500"><option value="ar">{{ ui('العربية', 'Arabic') }}</option><option value="en">English</option></select><select #difficulty (change)="quizDifficulty.set(castDifficulty(difficulty.value))" class="w-full rounded-2xl border border-white/10 bg-slate-950 px-5 py-4 text-white outline-none focus:border-indigo-500"><option value="easy">{{ ui('سهل', 'Easy') }}</option><option value="medium" selected>{{ ui('متوسط', 'Medium') }}</option><option value="hard">{{ ui('صعب', 'Hard') }}</option><option value="legendary">{{ ui('أسطوري', 'Legendary') }}</option></select><select #qType (change)="quizType.set(qType.value === 'true_false' ? 'true_false' : 'mcq')" class="w-full rounded-2xl border border-white/10 bg-slate-950 px-5 py-4 text-white outline-none focus:border-indigo-500"><option value="mcq">{{ ui('اختيارات متعددة', 'Multiple Choice') }}</option><option value="true_false">{{ ui('صح / خطأ', 'True / False') }}</option></select></div>
              </div>
              <div class="flex flex-col gap-5">
                <label class="group relative flex min-h-[20rem] cursor-pointer flex-col overflow-hidden rounded-[2rem] border-2 border-dashed border-white/10 bg-slate-950/70 transition hover:border-indigo-500/50"><input type="file" multiple (change)="onFileSelected($event)" class="absolute inset-0 opacity-0">@if (selectedFiles().length === 0) { <div class="flex flex-1 flex-col items-center justify-center p-8 text-center text-slate-500"><i class="fa-solid fa-cloud-arrow-up text-5xl transition group-hover:text-indigo-400"></i><p class="mt-6 text-lg font-black text-white">{{ ui('ارفع ملفاتك هنا', 'Upload your files here') }}</p></div> } @else { <div class="flex flex-1 flex-col p-6"><p class="mb-4 text-center text-lg font-black text-white">{{ selectedFiles().length }} {{ ui('ملفات جاهزة', 'files ready') }}</p><div class="flex-1 space-y-3 overflow-y-auto no-scrollbar">@for (file of selectedFiles(); track file.name + '-' + file.size + '-' + file.lastModified; let i = $index) { <div class="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-800/80 p-3 text-right"><button (click)="removeFile($event, i)" class="flex h-8 w-8 items-center justify-center rounded-full text-rose-400 hover:bg-rose-500/20"><i class="fa-solid fa-trash-can text-xs"></i></button><div class="min-w-0 flex-1"><p class="truncate text-sm font-bold text-white">{{ file.name }}</p><p class="text-[10px] font-bold text-slate-500">{{ formatFileSize(file.size) }}</p></div><i class="fa-solid fa-file-lines text-indigo-400"></i></div> }</div></div> }</label>
                <button (click)="startQuizGeneration(subject.value, count.value, timer.value)" [disabled]="isBusy()" class="rounded-[1.8rem] bg-indigo-600 px-6 py-5 text-xl font-black text-white shadow-xl shadow-indigo-500/20 disabled:opacity-50">{{ isBusy() ? ui('جاري البناء...', 'Building...') : ui('ابدأ الاختبار الذكي', 'Start Smart Exam') }}</button>
              </div>
            </div>
          </div>
        }

        @case ('active') {
          <div class="rounded-[2.6rem] border border-white/10 bg-slate-900 p-6 shadow-2xl md:p-8">
            @if (currentQuestion(); as question) {
              <div class="flex min-h-[70vh] flex-col">
                <div class="mb-8 flex flex-wrap items-center justify-between gap-4"><div class="flex items-center gap-4"><span class="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-indigo-100">{{ ui('سؤال', 'Question') }} {{ currentQuestionIndex() + 1 }} / {{ questions().length }}</span><div class="flex items-center gap-2 rounded-full border border-white/10 bg-slate-800 px-4 py-2"><i class="fa-solid fa-clock animate-pulse text-rose-400"></i><span class="font-mono text-sm font-black text-white">{{ formatTime(timeLeft()) }}</span></div></div><div class="text-right"><p class="text-sm font-black text-white">{{ activeSubject() }}</p><p class="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">{{ quizDifficulty() }}</p></div></div>
                <div class="mb-8 h-2 overflow-hidden rounded-full bg-slate-800"><div class="h-full rounded-full bg-indigo-500 transition-all duration-300" [style.width.%]="progressPercent()"></div></div>
                <div class="flex-1 space-y-6"><div class="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 text-right"><h3 class="text-2xl font-black leading-relaxed text-white">{{ question.q }}</h3></div><div class="grid grid-cols-1 gap-4">@for (opt of question.o; track question.id + '-' + $index; let i = $index) { <button (click)="selectAnswer(i)" class="flex w-full items-center justify-between rounded-[1.5rem] border-2 p-5 text-right font-bold text-white transition" [class.border-indigo-500]="currentUserAnswer() === i" [class.bg-indigo-900/40]="currentUserAnswer() === i" [class.border-slate-800]="currentUserAnswer() !== i" [class.bg-slate-950/70]="currentUserAnswer() !== i"><span>{{ opt }}</span><span class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-xs font-black">{{ optionLabel(i) }}</span></button> }</div></div>
                <div class="mt-10 flex justify-start" [class.justify-end]="quizLanguage() === 'ar'">@if (currentQuestionIndex() < questions().length - 1) { <button (click)="nextQuestion()" [disabled]="currentUserAnswer() === null" class="rounded-2xl bg-indigo-600 px-8 py-4 font-black text-white disabled:opacity-30">{{ ui('التالي', 'Next') }}</button> } @else { <button (click)="finishQuiz()" [disabled]="currentUserAnswer() === null" class="rounded-2xl bg-emerald-600 px-8 py-4 font-black text-white disabled:opacity-30">{{ ui('إنهاء وتسليم', 'Finish & Submit') }}</button> }</div>
              </div>
            }
          </div>
        }

        @case ('results') {
          <div class="space-y-8 rounded-[2.6rem] border border-white/10 bg-slate-900 p-6 shadow-2xl md:p-8">
            <div class="text-center"><h2 class="text-4xl font-black text-white">{{ ui('النتيجة النهائية', 'Final Result') }}</h2><p class="mt-4 text-7xl font-black" [class]="getScoreColor(finalScore())">{{ finalScore() }}%</p><p class="mt-4 text-lg font-black" [class.text-emerald-400]="xpChange() >= 0" [class.text-rose-400]="xpChange() < 0">{{ xpChange() >= 0 ? '+' : '' }}{{ xpChange() }} XP</p></div>
            @if (isAnalyzing()) { <div class="rounded-[2rem] border border-indigo-400/20 bg-indigo-500/10 p-8 text-center"><p class="text-xl font-black text-white">{{ ui('جاري تحليل الأخطاء...', 'Analyzing mistakes...') }}</p></div> } @else if (improvementPlan(); as plan) { <div class="grid grid-cols-1 gap-6 lg:grid-cols-2"><div class="space-y-4 rounded-[2rem] border border-white/10 bg-slate-950/70 p-6"><p class="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300">{{ ui('نقاط الضعف', 'Weak Points') }}</p>@for (point of plan.weakPoints; track point.topic + '-' + $index) { <div class="rounded-[1.4rem] border border-white/5 bg-slate-900/70 p-4 text-right"><p class="font-black text-white">{{ point.topic }}</p><p class="mt-3 text-sm font-medium leading-7 text-slate-300">{{ point.explanation }}</p></div> }</div><div class="space-y-6"><div class="rounded-[2rem] border border-indigo-400/20 bg-indigo-500/10 p-6 text-right"><p class="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200">{{ ui('نصيحة عامة', 'Overall Advice') }}</p><p class="mt-4 font-bold leading-8 text-white">{{ plan.overallAdvice }}</p></div><div class="rounded-[2rem] border border-emerald-400/20 bg-emerald-500/10 p-6 text-right"><p class="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-200">{{ ui('الخطوات القادمة', 'Next Steps') }}</p><div class="mt-4 space-y-3">@for (step of plan.nextSteps; track step + '-' + $index) { <div class="rounded-2xl border border-emerald-400/10 bg-black/10 px-4 py-3 text-sm font-bold text-white">{{ step }}</div> }</div></div></div></div> }
            <div class="space-y-5">@for (q of questions(); track q.id; let i = $index) { <div class="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 text-right"><p class="font-black text-white">{{ i + 1 }}. {{ q.q }}</p><div class="mt-4 space-y-2">@for (opt of q.o; track q.id + '-result-' + $index; let j = $index) { <div class="rounded-xl px-4 py-3 text-sm font-semibold" [class.bg-emerald-500/20]="j === q.a" [class.text-emerald-200]="j === q.a" [class.bg-rose-500/20]="j !== q.a && j === userAnswers()[i]" [class.text-rose-200]="j !== q.a && j === userAnswers()[i]" [class.bg-white/5]="j !== q.a && j !== userAnswers()[i]" [class.text-slate-300]="j !== q.a && j !== userAnswers()[i]"><span class="mr-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{{ optionLabel(j) }}</span>{{ opt }}</div> }</div><div class="mt-4 border-t border-white/10 pt-4"><p class="text-sm font-medium leading-7 text-slate-300"><span class="font-black text-indigo-300">{{ ui('الشرح', 'Explanation') }}:</span> {{ q.e }}</p><button (click)="openAiHelp(q, userAnswers()[i])" class="mt-3 text-sm font-black text-indigo-300 hover:text-indigo-200"><i class="fa-solid fa-brain"></i> {{ ui('اسأل المساعد الذكي', 'Ask AI Assistant') }}</button></div></div> }</div>
            <div class="flex justify-center"><button (click)="reset()" class="rounded-2xl bg-indigo-600 px-8 py-4 font-black text-white hover:scale-[1.02]">{{ ui('العودة للرئيسية', 'Back To Home') }}</button></div>
          </div>
        }

        @case ('review') {
          <div class="space-y-6 rounded-[2.6rem] border border-white/10 bg-slate-900 p-6 shadow-2xl md:p-8">
            <div class="flex flex-wrap items-center justify-between gap-4"><button (click)="view.set('home')" class="flex items-center gap-2 text-sm font-black text-slate-400 hover:text-white"><i class="fa-solid fa-arrow-right" [class.fa-arrow-left]="!isArabicUi()"></i>{{ ui('العودة للسجل', 'Back To History') }}</button><div class="text-center"><h2 class="text-2xl font-black text-white">{{ ui('مراجعة المحاولة', 'Attempt Review') }}</h2><p class="text-xs font-bold text-slate-500">{{ formatDate(activeAttempt()?.date || 0) }}</p></div><div class="text-2xl font-black" [class]="getScoreColor(activeAttempt()?.score || 0)">{{ activeAttempt()?.score || 0 }}%</div></div>
            <div class="space-y-5">@for (q of activeAttempt()?.questions || []; track q.id; let i = $index) { <div class="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 text-right"><p class="font-black text-white">{{ i + 1 }}. {{ q.q }}</p><div class="mt-4 space-y-2">@for (opt of q.o; track q.id + '-review-' + $index; let j = $index) { <div class="rounded-xl px-4 py-3 text-sm font-semibold" [class.bg-emerald-500/20]="j === q.a" [class.text-emerald-200]="j === q.a" [class.bg-rose-500/20]="j !== q.a && j === activeAttempt()?.userAnswers?.[i]" [class.text-rose-200]="j !== q.a && j === activeAttempt()?.userAnswers?.[i]" [class.bg-white/5]="j !== q.a && j !== activeAttempt()?.userAnswers?.[i]" [class.text-slate-300]="j !== q.a && j !== activeAttempt()?.userAnswers?.[i]"><span class="mr-2 text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{{ optionLabel(j) }}</span>{{ opt }}</div> }</div><div class="mt-4 border-t border-white/10 pt-4"><p class="text-sm font-medium leading-7 text-slate-300"><span class="font-black text-indigo-300">{{ ui('الشرح', 'Explanation') }}:</span> {{ q.e }}</p><button (click)="openAiHelp(q, activeAttempt()?.userAnswers?.[i] ?? null)" class="mt-3 text-sm font-black text-indigo-300 hover:text-indigo-200"><i class="fa-solid fa-brain"></i> {{ ui('اسأل المساعد الذكي', 'Ask AI Assistant') }}</button></div></div> }</div>
          </div>
        }
      }
    </div>

    @if (showUpgradeModal()) { <app-upgrade-modal [title]="ui('تم الوصول للحد اليومي', 'Daily Limit Reached')" [message]="upgradeMessage()" icon="fa-solid fa-graduation-cap" (closeModal)="showUpgradeModal.set(false)" (upgradePlan)="onUpgradeRequested()" /> }
  `
})
export class QuizPage {
  private readonly ai = inject(AIService);
  private readonly ns = inject(NotificationService);
  private readonly storageKey = 'smartedge_quiz_materials_v1';

  view = signal<QuizView>('home');
  isBusy = signal(false);
  questions = signal<QuizQuestion[]>([]);
  userAnswers = signal<Array<number | null>>([]);
  currentQuestionIndex = signal(0);
  finalScore = signal(0);
  xpChange = signal(0);
  selectedFiles = signal<File[]>([]);
  quizLanguage = signal<'ar' | 'en'>('ar');
  quizType = signal<QuizQuestionType>('mcq');
  quizDifficulty = signal<QuizDifficulty>('medium');
  quizDuration = signal(10);
  timeLeft = signal(0);
  loadingProgress = signal(0);
  loadingMessage = signal('');
  savedMaterials = signal<SavedMaterial[]>([]);
  selectedMaterial = signal<SavedMaterial | null>(null);
  activeAttempt = signal<QuizAttempt | null>(null);
  activeSubject = signal('');
  aiHelpContext = signal<{ q: QuizQuestion; a: number | null } | null>(null);
  aiHelpHistory = signal<Array<{ role: 'user' | 'model'; text: string }>>([]);
  isAiHelping = signal(false);
  improvementPlan = signal<ImprovementPlan | null>(null);
  isAnalyzing = signal(false);
  showUpgradeModal = signal(false);
  upgradeMessage = signal('');
  private timerInterval: number | null = null;

  readonly isArabicUi = computed(() => this.ai.currentLanguage() === 'ar');
  readonly averageScore = computed(() => {
    const history = this.selectedMaterial()?.history || [];
    return history.length === 0 ? 0 : Math.round(history.reduce((sum, attempt) => sum + attempt.score, 0) / history.length);
  });
  readonly currentQuestion = computed(() => this.questions()[Math.max(0, Math.min(this.currentQuestionIndex(), Math.max(0, this.questions().length - 1)))] || null);
  readonly currentUserAnswer = computed(() => this.userAnswers()[this.currentQuestionIndex()] ?? null);
  readonly progressPercent = computed(() => this.questions().length === 0 ? 0 : ((this.currentQuestionIndex() + 1) / this.questions().length) * 100);

  onUpgradeRequested = () => { this.showUpgradeModal.set(false); this.view.set('home'); };
  readonly totalXp = (sum: number, attempt: QuizAttempt) => sum + attempt.xpChange;

  constructor() {
    this.loadMaterials();

    effect(() => {
      this.saveMaterials();
    });

    effect(() => {
      if (this.view() !== 'active') {
        this.clearTimer();
      }
    });
  }

  ui(arabic: string, english: string): string {
    return this.isArabicUi() ? arabic : english;
  }

  castDifficulty(value: string): QuizDifficulty {
    if (value === 'easy' || value === 'hard' || value === 'legendary') {
      return value;
    }

    return 'medium';
  }

  private loadMaterials() {
    const saved = localStorage.getItem(this.storageKey);
    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved) as SavedMaterial[];
      if (!Array.isArray(parsed)) {
        return;
      }

      this.savedMaterials.set(parsed.map((material) => ({
        id: String(material.id || crypto.randomUUID()),
        name: String(material.name || this.ui('مادة غير مسماة', 'Untitled Subject')),
        history: Array.isArray(material.history)
          ? material.history.map((attempt) => ({
            id: String(attempt.id || crypto.randomUUID()),
            date: Number(attempt.date || Date.now()),
            score: Number(attempt.score || 0),
            xpChange: Number(attempt.xpChange || 0),
            questions: Array.isArray(attempt.questions)
              ? attempt.questions.map((question, index) => ({
                id: String(question?.id || `quiz_${index + 1}`),
                q: String(question?.q || ''),
                o: Array.isArray(question?.o) ? question.o.map((option) => String(option)) : [],
                a: Number(question?.a || 0),
                e: String(question?.e || '')
              }))
              : [],
            userAnswers: Array.isArray(attempt.userAnswers)
              ? attempt.userAnswers.map((answer) => typeof answer === 'number' ? answer : null)
              : []
          }))
          : []
      })));
    } catch (error) {
      console.error('Failed to load saved quiz materials', error);
    }
  }

  private saveMaterials() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.savedMaterials()));
  }

  openNewQuizConfig() {
    this.activeSubject.set('');
    this.selectedFiles.set([]);
    this.questions.set([]);
    this.userAnswers.set([]);
    this.currentQuestionIndex.set(0);
    this.improvementPlan.set(null);
    this.activeAttempt.set(null);
    this.view.set('config');
  }

  clearAllMaterials() {
    if (!confirm(this.ui('هل أنت متأكد من مسح كافة المواد المحفوظة؟', 'Are you sure you want to clear all saved materials?'))) {
      return;
    }

    this.savedMaterials.set([]);
    this.selectedMaterial.set(null);
    localStorage.removeItem(this.storageKey);
  }

  selectMaterial(material: SavedMaterial) {
    this.selectedMaterial.set(material);
    this.activeAttempt.set(null);
  }

  reviewAttempt(attempt: QuizAttempt) {
    this.activeAttempt.set({
      ...attempt,
      questions: attempt.questions.map((question) => ({ ...question, o: [...question.o] })),
      userAnswers: [...attempt.userAnswers]
    });
    this.view.set('review');
  }

  createQuizForMaterial(material: SavedMaterial | null) {
    if (!material) {
      return;
    }

    this.activeSubject.set(material.name);
    this.selectedFiles.set([]);
    this.questions.set([]);
    this.userAnswers.set([]);
    this.currentQuestionIndex.set(0);
    this.improvementPlan.set(null);
    this.view.set('config');
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) {
      return;
    }

    const incomingFiles = Array.from(input.files);
    this.selectedFiles.update((current) => {
      const uniqueNewFiles = incomingFiles.filter((candidate) => !current.some((existing) =>
        existing.name === candidate.name &&
        existing.size === candidate.size &&
        existing.lastModified === candidate.lastModified
      ));
      return [...current, ...uniqueNewFiles];
    });
    input.value = '';
  }

  removeFile(event: Event, indexToRemove: number) {
    event.preventDefault();
    event.stopPropagation();
    this.selectedFiles.update((current) => current.filter((_, index) => index !== indexToRemove));
  }

  async startQuizGeneration(topicInput: string, countInput: string, durationInput: string) {
    const topic = (topicInput || this.activeSubject()).trim();
    const count = Math.max(1, Math.min(50, Number.parseInt(countInput, 10) || 10));
    const duration = Math.max(1, Number.parseInt(durationInput, 10) || 10);

    if (!topic) {
      alert(this.ui('يرجى إدخال اسم المادة.', 'Please enter a subject name.'));
      return;
    }

    const limitCheck = this.ai.checkLimit('smartTests');
    if (!limitCheck.allowed) {
      this.upgradeMessage.set(limitCheck.message);
      this.showUpgradeModal.set(true);
      return;
    }

    this.activeSubject.set(topic);
    this.quizDuration.set(duration);
    this.isBusy.set(true);
    this.loadingProgress.set(10);
    this.loadingMessage.set(this.ui('جاري تجهيز الملفات...', 'Preparing files...'));

    try {
      const attachments: AIFileAttachment[] = [];
      for (const file of this.selectedFiles()) {
        const base64 = await this.fileToBase64(file);
        attachments.push({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          data: base64.split(',')[1] || ''
        });
      }

      this.loadingProgress.set(55);
      this.loadingMessage.set(this.ui('جاري إنشاء أسئلة الاختبار...', 'Generating exam questions...'));

      const questions = await this.ai.generateQuiz(
        topic,
        count,
        attachments,
        this.quizLanguage(),
        this.quizType(),
        this.quizDifficulty()
      );

      const normalizedQuestions = questions.map((question, index) => ({
        ...question,
        id: question.id || `quiz_${index + 1}`,
        o: [...question.o]
      }));

      this.questions.set(normalizedQuestions);
      this.userAnswers.set(Array.from({ length: normalizedQuestions.length }, () => null));
      this.currentQuestionIndex.set(0);
      this.finalScore.set(0);
      this.xpChange.set(0);
      this.improvementPlan.set(null);
      this.loadingProgress.set(100);
      this.loadingMessage.set(this.ui('تم تجهيز الاختبار.', 'Exam is ready.'));
      this.startTimer(duration);
      this.view.set('active');
    } catch (error) {
      console.error('Quiz generation failed', error);
      alert(this.ui('فشل إنشاء الاختبار. حاول مرة أخرى.', 'Failed to generate the exam. Try again.'));
    } finally {
      this.isBusy.set(false);
      this.loadingProgress.set(0);
      this.loadingMessage.set('');
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  private startTimer(minutes: number) {
    this.clearTimer();
    this.timeLeft.set(Math.max(1, minutes) * 60);
    this.timerInterval = window.setInterval(() => {
      this.timeLeft.update((current) => {
        if (current <= 1) {
          this.clearTimer();
          this.finishQuiz();
          return 0;
        }

        return current - 1;
      });
    }, 1000);
  }

  private clearTimer() {
    if (this.timerInterval !== null) {
      window.clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  formatTime(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  optionLabel(index: number): string {
    const arabicLabels = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
    return this.quizLanguage() === 'ar'
      ? (arabicLabels[index] || `${index + 1}`)
      : String.fromCharCode(65 + index);
  }

  selectAnswer(index: number) {
    this.userAnswers.update((answers) => {
      const next = [...answers];
      next[this.currentQuestionIndex()] = index;
      return next;
    });
  }

  nextQuestion() {
    if (this.currentQuestionIndex() < this.questions().length - 1) {
      this.currentQuestionIndex.update((current) => current + 1);
    }
  }

  finishQuiz() {
    if (this.questions().length === 0) {
      return;
    }

    this.clearTimer();

    const answers = [...this.userAnswers()];
    const questionSnapshot = this.questions().map((question) => ({ ...question, o: [...question.o] }));
    const correctCount = questionSnapshot.reduce((count, question, index) => count + (question.a === answers[index] ? 1 : 0), 0);
    const score = Math.round((correctCount / questionSnapshot.length) * 100);
    const xpDelta = score >= 50 ? correctCount * 5 : -(questionSnapshot.length - correctCount) * 2;

    this.finalScore.set(score);
    this.xpChange.set(xpDelta);
    this.ai.quizzesCompleted.update((count) => count + 1);
    this.ai.addXP(xpDelta);
    this.ai.addPerformanceRecord({
      date: new Date().toISOString(),
      score,
      type: 'quiz',
      subject: this.activeSubject(),
      grade: this.ai.getGrade(score)
    });

    const attempt: QuizAttempt = {
      id: crypto.randomUUID(),
      date: Date.now(),
      score,
      xpChange: xpDelta,
      questions: questionSnapshot,
      userAnswers: answers
    };

    const subjectName = this.activeSubject();
    const existingMaterial = this.savedMaterials().find((material) => material.name === subjectName);
    if (existingMaterial) {
      this.savedMaterials.update((materials) => materials.map((material) => material.id === existingMaterial.id
        ? { ...material, history: [attempt, ...material.history] }
        : material
      ));
    } else {
      const createdMaterial: SavedMaterial = {
        id: crypto.randomUUID(),
        name: subjectName,
        history: [attempt]
      };
      this.savedMaterials.update((materials) => [createdMaterial, ...materials]);
    }

    this.selectedMaterial.set(this.savedMaterials().find((material) => material.name === subjectName) || null);
    this.view.set('results');
    this.ai.incrementUsage('smartTests');

    this.isAnalyzing.set(true);
    this.improvementPlan.set(null);
    void this.ai.analyzeQuizErrors(questionSnapshot, answers, subjectName, this.quizLanguage())
      .then((plan) => this.improvementPlan.set(plan))
      .catch((error) => console.error('Quiz analysis failed', error))
      .finally(() => this.isAnalyzing.set(false));

    this.ns.show(
      this.ui('اكتمل الاختبار', 'Exam Completed'),
      this.ui(`أنهيت اختبار ${subjectName} بنتيجة ${score}%`, `You completed the ${subjectName} exam with ${score}%`),
      score >= 50 ? 'success' : 'warning',
      'fa-clipboard-question'
    );
  }

  openAiHelp(question: QuizQuestion, answer: number | null) {
    this.aiHelpContext.set({ q: { ...question, o: [...question.o] }, a: answer });
    this.aiHelpHistory.set([]);
  }

  closeAiHelp() {
    this.aiHelpContext.set(null);
    this.aiHelpHistory.set([]);
    this.isAiHelping.set(false);
  }

  async sendAiHelp(text: string) {
    const promptText = text.trim();
    const context = this.aiHelpContext();
    if (!promptText || !context) {
      return;
    }

    this.isAiHelping.set(true);
    this.aiHelpHistory.update((history) => [...history, { role: 'user', text: promptText }]);

    const userAnswerText = typeof context.a === 'number'
      ? context.q.o[context.a] || this.ui('إجابة غير معروفة', 'Unknown answer')
      : this.ui('لم تتم الإجابة', 'No answer selected');
    const system = this.ui(
      'أنت مدرس خبير. اشرح الفكرة وراء الإجابة الصحيحة بوضوح، واذكر سبب خطأ الخيارات الأخرى عند الحاجة.',
      'You are an expert tutor. Explain the idea behind the correct answer clearly and mention why the other options are wrong when useful.'
    );
    const prompt = [
      `Question: ${context.q.q}`,
      `Options: ${context.q.o.join(' | ')}`,
      `User answer: ${userAnswerText}`,
      `Correct answer: ${context.q.o[context.q.a] || ''}`,
      `Explanation: ${context.q.e}`,
      `Student request: ${promptText}`,
      `Respond in ${this.quizLanguage() === 'ar' ? 'Arabic' : 'English'}.`
    ].join('\n');

    try {
      const reply = await this.ai.chat(prompt, system);
      this.aiHelpHistory.update((history) => [...history, { role: 'model', text: reply }]);
    } catch (error) {
      console.error('AI help failed', error);
      this.aiHelpHistory.update((history) => [
        ...history,
        { role: 'model', text: this.ui('تعذر الحصول على شرح إضافي حالياً.', 'Unable to fetch extra explanation right now.') }
      ]);
    } finally {
      this.isAiHelping.set(false);
    }
  }

  reset() {
    this.clearTimer();
    this.view.set('home');
    this.questions.set([]);
    this.userAnswers.set([]);
    this.currentQuestionIndex.set(0);
    this.finalScore.set(0);
    this.xpChange.set(0);
    this.selectedFiles.set([]);
    this.activeAttempt.set(null);
    this.activeSubject.set('');
    this.aiHelpContext.set(null);
    this.aiHelpHistory.set([]);
    this.improvementPlan.set(null);
    this.isAnalyzing.set(false);
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString(this.isArabicUi() ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  getScoreColor(score: number): string {
    if (score >= 80) {
      return 'text-emerald-400';
    }

    if (score >= 50) {
      return 'text-amber-400';
    }

    return 'text-rose-400';
  }
}
