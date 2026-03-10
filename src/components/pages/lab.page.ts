import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, output, signal } from '@angular/core';
import {
  AIFileAttachment,
  AIService,
  LabScenarioDifficulty,
  LabScenario,
  LabScenarioChoice,
  LabScenarioConsequenceLevel,
  LabScenarioReading,
} from '../../services/ai.service';
import { NotificationService } from '../../services/notification.service';
import { UpgradeModal } from '../shared/upgrade-modal.component';
import { LocalizationService } from '../../services/localization.service';
import { LanguageCode, normalizeLanguageCode } from '../../i18n/language-config';

interface LabHistoryItem {
  title: string;
  discipline: string;
  subject: string;
  scenario: LabScenario;
  timestamp: string;
}

interface ScenarioDecisionRecord {
  stepId: string;
  stepTitle: string;
  choiceText: string;
  outcome: string;
  scoreImpact: number;
  consequenceLevel: LabScenarioConsequenceLevel;
}

interface RandomizedChoiceView {
  originalIndex: number;
  text: string;
}

@Component({
  selector: 'app-lab-page',
  standalone: true,
  imports: [CommonModule, UpgradeModal],
  template: `
    <div class="mx-auto max-w-6xl space-y-10 animate-in fade-in duration-700 pb-20">
      <div class="relative overflow-hidden rounded-[4rem] border border-white/5 bg-slate-950 p-12 text-white shadow-3xl md:p-16">
        <div class="relative z-10 max-w-3xl space-y-6 text-right">
          <div class="inline-flex items-center gap-3 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-6 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">
            <i class="fa-solid fa-flask-vial"></i> مختبر السيناريوهات التفاعلية
          </div>
          <h2 class="text-4xl font-black leading-tight md:text-5xl">
            محاكاة واقعية <span class="text-emerald-500">داخل بيئة العمل</span>
          </h2>
          <p class="text-lg font-bold text-slate-400">
            اختر تخصصك والمهارة العملية، ثم ادخل مباشرة في موقف حقيقي متعدد القرارات والنتائج.
          </p>
        </div>
        <i class="fa-solid fa-hospital absolute -left-10 -bottom-10 text-[20rem] opacity-5"></i>
      </div>

      @if (!currentScenario()) {
        <div class="grid grid-cols-1 gap-8 lg:grid-cols-4">
          <div class="animate-in slide-in-from-bottom space-y-10 rounded-[3.5rem] border border-white/10 bg-slate-900 p-10 shadow-2xl md:p-16 lg:col-span-3">
            <div class="flex items-center justify-between border-b border-white/5 pb-8">
              <div class="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-2">
                <i class="fa-solid fa-language text-emerald-300"></i>
                <select
                  data-no-i18n
                  [value]="selectedLang()"
                  (change)="onLanguageChange($any($event.target).value)"
                  class="bg-transparent text-sm font-black text-white outline-none"
                >
                  @for (language of localization.supportedLanguages; track language.code) {
                    <option [value]="language.code" class="bg-slate-950 text-white">{{ language.nativeName }}</option>
                  }
                </select>
              </div>
              <div class="space-y-2 text-right">
                <h3 class="text-2xl font-black text-white">بناء سيناريو تفاعلي</h3>
                <p class="font-bold text-slate-500">أدخل التخصص والموقف العملي ليبدأ التدريب من لحظة الحدث الحقيقي.</p>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div class="space-y-4 text-right">
                <label class="text-xs font-black uppercase tracking-widest text-slate-400">التخصص / مجال العمل</label>
                <input
                  #discipline
                  type="text"
                  [placeholder]="selectedLang() === 'ar' ? 'مثال: التمريض، القانون، الأمن السيبراني، هندسة السيارات...' : 'Example: Nursing, Law, Cybersecurity, Automotive Engineering...'"
                  class="w-full rounded-2xl border border-white/10 bg-slate-950 p-6 font-bold text-white outline-none transition focus:ring-2 ring-emerald-500"
                >
              </div>
              <div class="space-y-4 text-right">
                <label class="text-xs font-black uppercase tracking-widest text-slate-400">الموقف أو المهارة العملية</label>
                <input
                  #subject
                  type="text"
                  [placeholder]="selectedLang() === 'ar' ? 'مثال: استقبال مريض طارئ، استجواب شاهد، احتواء هجوم إلكتروني...' : 'Example: Emergency patient intake, Witness questioning, Containing a cyberattack...'"
                  class="w-full rounded-2xl border border-white/10 bg-slate-950 p-6 font-bold text-white outline-none transition focus:ring-2 ring-emerald-500"
                >
              </div>
            </div>

            <div class="space-y-4 text-right">
              <label class="text-xs font-black uppercase tracking-widest text-slate-400">
                {{ selectedLang() === 'ar' ? 'مستوى السيناريو' : 'Scenario Difficulty' }}
              </label>
              <div class="flex flex-wrap justify-end gap-3">
                <button
                  (click)="selectedDifficulty.set('easy')"
                  [class.border-emerald-400/40]="selectedDifficulty() === 'easy'"
                  [class.bg-emerald-500/10]="selectedDifficulty() === 'easy'"
                  class="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-white transition hover:border-emerald-400/30"
                >
                  {{ selectedLang() === 'ar' ? 'سهل' : 'Easy' }}
                </button>
                <button
                  (click)="selectedDifficulty.set('medium')"
                  [class.border-amber-400/40]="selectedDifficulty() === 'medium'"
                  [class.bg-amber-500/10]="selectedDifficulty() === 'medium'"
                  class="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-white transition hover:border-amber-400/30"
                >
                  {{ selectedLang() === 'ar' ? 'متوسط' : 'Medium' }}
                </button>
                <button
                  (click)="selectedDifficulty.set('hard')"
                  [class.border-rose-400/40]="selectedDifficulty() === 'hard'"
                  [class.bg-rose-500/10]="selectedDifficulty() === 'hard'"
                  class="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-white transition hover:border-rose-400/30"
                >
                  {{ selectedLang() === 'ar' ? 'صعب' : 'Hard' }}
                </button>
              </div>
              <p class="text-sm font-bold text-slate-500">
                {{ selectedLang() === 'ar'
                  ? 'السهل يعطي مؤشرات أوضح وقرارات مباشرة، والمتوسط يضيف غموضًا معتدلًا، والصعب يرفع التعقيد ويضيف ضغطًا أكبر.'
                  : 'Easy gives clearer indicators and direct decisions, medium adds moderate ambiguity, and hard increases complexity and pressure.' }}
              </p>
            </div>

            <div class="space-y-4 text-right">
              <label class="text-xs font-black uppercase tracking-widest text-slate-400">ملف مرجعي للحالة (اختياري)</label>
              <div class="group relative cursor-pointer" (click)="fileInput.click()">
                <input #fileInput type="file" class="hidden" (change)="onFileSelected($event)" multiple>
                <div class="relative flex w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border-2 border-dashed border-white/10 bg-slate-950 p-8 transition group-hover:border-emerald-500/50">
                  @if (selectedFiles().length > 0) {
                    <i class="fa-solid fa-bolt-lightning text-3xl text-emerald-500"></i>
                  } @else {
                    <i class="fa-solid fa-cloud-arrow-up text-3xl text-slate-600 transition group-hover:text-emerald-500"></i>
                  }
                  <p class="font-bold text-slate-500">
                    @if (selectedFiles().length > 0) {
                      <span class="font-black text-emerald-400">
                        {{ selectedLang() === 'ar' ? 'تم ربط' : 'Attached' }} {{ selectedFiles().length }} {{ selectedLang() === 'ar' ? 'ملفات مرجعية' : 'reference files' }}
                      </span>
                    } @else {
                      {{ selectedLang() === 'ar' ? 'اسحب الملفات هنا أو انقر لإرفاق ملفات تدعم السيناريو (صوت، PDF، صور).' : 'Drag files here or click to attach supporting files for the scenario (audio, PDF, images).' }}
                    }
                  </p>
                </div>
              </div>
            </div>

            <button
              (click)="createLab(discipline.value, subject.value)"
              [disabled]="isBusy()"
              class="flex w-full items-center justify-center gap-4 rounded-2xl bg-emerald-600 py-6 text-xl font-black text-white shadow-2xl shadow-emerald-500/20 transition hover:scale-[1.02] disabled:opacity-50"
            >
              @if (isBusy()) {
                <i class="fa-solid fa-spinner animate-spin"></i>
                {{ selectedLang() === 'ar' ? 'يتم بناء السيناريو...' : 'Building the scenario...' }}
              } @else {
                <i class="fa-solid fa-bolt"></i>
                {{ selectedLang() === 'ar' ? 'ابدأ المحاكاة الآن' : 'Start the simulation now' }}
              }
            </button>
          </div>

          <div class="space-y-6 rounded-[3rem] border border-white/5 bg-slate-900/50 p-8 lg:col-span-1">
            <div class="flex items-center justify-between border-b border-white/5 pb-4">
              <button (click)="clearHistory()" class="text-[10px] font-black uppercase tracking-widest text-rose-500 transition-colors hover:text-rose-400">
                {{ selectedLang() === 'ar' ? 'مسح السجل' : 'Clear History' }}
              </button>
              <h4 class="font-black text-white">{{ selectedLang() === 'ar' ? 'سجل السيناريوهات' : 'Scenario History' }}</h4>
            </div>
            <div class="space-y-3">
              @for (entry of labHistory(); track entry.timestamp) {
                <button
                  (click)="loadFromHistory(entry)"
                  class="group w-full rounded-2xl border border-white/5 bg-slate-950/50 p-4 text-right transition hover:border-emerald-500/30"
                >
                  <p class="text-sm font-bold text-white transition group-hover:text-emerald-400">{{ entry.title }}</p>
                  <p class="text-[10px] text-slate-500">{{ entry.discipline }} - {{ entry.timestamp | date:'short' }}</p>
                </button>
              } @empty {
                <p class="py-10 text-center text-sm font-bold italic text-slate-600">
                  {{ selectedLang() === 'ar' ? 'لا يوجد سجل حالياً' : 'No scenarios yet' }}
                </p>
              }
            </div>
          </div>
        </div>
      }

      @if (currentScenario()) {
        <div class="mb-6 flex justify-start">
          <button (click)="exitScenario()" class="flex items-center gap-2 font-black text-slate-400 transition hover:text-white">
            <i class="fa-solid fa-arrow-right"></i> {{ selectedLang() === 'ar' ? 'العودة للرئيسية' : 'Back to Lab Home' }}
          </button>
        </div>

        <div class="grid grid-cols-1 gap-10 animate-in zoom-in duration-500 lg:grid-cols-3">
          <div class="space-y-8 lg:col-span-2">
            <div class="group relative aspect-video overflow-hidden rounded-[3.5rem] border border-white/10 bg-slate-950 shadow-2xl">
              @if (labImage()) {
                <img
                  [src]="labImage()"
                  class="h-full w-full animate-pan-slow object-cover opacity-60 transition-all duration-1000"
                  [style.animation-play-state]="isFailed() ? 'paused' : 'running'"
                >
              } @else {
                <div class="flex h-full w-full items-center justify-center text-slate-800">
                  <i class="fa-solid fa-city text-8xl"></i>
                </div>
              }
              <div class="absolute inset-0 z-20 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
              <div class="absolute bottom-8 left-8 right-8 z-30 text-right">
                <div class="mb-3 flex flex-wrap justify-end gap-2">
                  <span class="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-amber-100">
                    {{ difficultyLabel(currentScenario()?.difficulty || 'medium') }}
                  </span>
                  <span class="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-100">
                    {{ currentScenario()?.environment }}
                  </span>
                  <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-slate-200">
                    {{ selectedLang() === 'ar' ? 'سيناريو متفرع' : 'Branching Scenario' }}
                  </span>
                </div>
                <h3 class="mb-2 text-3xl font-black text-white">{{ currentScenario()?.title }}</h3>
                <p class="font-bold text-slate-300">{{ currentScenario()?.description }}</p>
                <p class="mt-3 max-w-4xl text-sm font-semibold leading-8 text-slate-200">{{ currentScenario()?.openingSituation }}</p>
              </div>
            </div>

            <div class="relative overflow-hidden rounded-[3.5rem] border border-white/10 bg-slate-900 p-10 shadow-2xl">
              @if (isFailed()) {
                <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-rose-600/90 p-10 text-center backdrop-blur-md animate-in fade-in duration-300">
                  <i class="fa-solid fa-triangle-exclamation mb-6 text-7xl text-white animate-bounce"></i>
                  <h4 class="mb-4 text-3xl font-black text-white">{{ selectedLang() === 'ar' ? 'انتهى السيناريو بنتيجة حرجة' : 'Scenario Ended Critically' }}</h4>
                  <p class="mb-4 text-xl font-bold text-white">{{ lastChoiceOutcome()?.outcome }}</p>
                  <p class="mb-8 max-w-2xl text-sm font-semibold leading-8 text-rose-50">{{ currentScenario()?.finalEvaluation?.recommendedAction }}</p>
                  <div class="flex flex-wrap items-center justify-center gap-3">
                    <button (click)="handleRetry()" class="rounded-2xl bg-white px-12 py-4 text-lg font-black text-rose-600 shadow-xl transition hover:scale-105">
                      {{ selectedLang() === 'ar' ? 'إعادة المحاولة' : 'Retry Scenario' }}
                    </button>
                    <button (click)="exitScenario()" class="rounded-2xl border border-white/20 bg-white/10 px-12 py-4 text-lg font-black text-white transition hover:bg-white/20">
                      {{ selectedLang() === 'ar' ? 'إنهاء' : 'Close' }}
                    </button>
                  </div>
                </div>
              }

              @if (isComplete()) {
                <div class="absolute inset-0 z-20 overflow-y-auto bg-emerald-600/92 p-8 text-right text-white backdrop-blur-md animate-in fade-in duration-300 md:p-10">
                  <div class="flex flex-col items-center text-center">
                    <i class="fa-solid fa-trophy mb-6 text-7xl text-white animate-bounce"></i>
                    <h4 class="mb-3 text-3xl font-black">
                      {{ scorePercent() >= (currentScenario()?.passingScore || 70)
                        ? (selectedLang() === 'ar' ? 'أنهيت السيناريو بنجاح' : 'Scenario Completed Successfully')
                        : (selectedLang() === 'ar' ? 'أنهيت السيناريو لكن تحتاج دعمًا إضافيًا' : 'Scenario Completed, but More Practice Is Needed') }}
                    </h4>
                    <p class="mb-6 text-5xl font-black">{{ scorePercent() }}%</p>
                    <p class="mb-8 max-w-3xl text-lg font-bold leading-9">{{ evaluationSummary() }}</p>
                  </div>

                  <div class="grid gap-6 md:grid-cols-2">
                    <div class="rounded-[2rem] border border-white/15 bg-white/10 p-6">
                      <h5 class="mb-4 text-lg font-black">{{ selectedLang() === 'ar' ? 'نقاط القوة' : 'Strengths' }}</h5>
                      <div class="space-y-3">
                        @for (item of finalStrengths(); track item) {
                          <div class="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold leading-7">{{ item }}</div>
                        }
                      </div>
                    </div>
                    <div class="rounded-[2rem] border border-white/15 bg-white/10 p-6">
                      <h5 class="mb-4 text-lg font-black">{{ selectedLang() === 'ar' ? 'ما يحتاج تحسينًا' : 'Needs Improvement' }}</h5>
                      <div class="space-y-3">
                        @for (item of finalImprovements(); track item) {
                          <div class="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold leading-7">{{ item }}</div>
                        }
                      </div>
                    </div>
                  </div>

                  <div class="mt-6 rounded-[2rem] border border-white/15 bg-white/10 p-6 text-center">
                    <p class="text-sm font-bold leading-8">{{ currentScenario()?.finalEvaluation?.recommendedAction }}</p>
                  </div>

                  <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <button (click)="handleRetry()" class="rounded-2xl bg-white px-10 py-4 text-lg font-black text-emerald-600 shadow-xl transition hover:scale-105">
                      {{ selectedLang() === 'ar' ? 'إعادة السيناريو' : 'Replay Scenario' }}
                    </button>
                    <button (click)="exitScenario()" class="rounded-2xl border border-white/20 bg-white/10 px-10 py-4 text-lg font-black text-white transition hover:bg-white/20">
                      {{ selectedLang() === 'ar' ? 'العودة للرئيسية' : 'Back to Home' }}
                    </button>
                  </div>
                </div>
              }

              <div class="space-y-8">
                <div class="flex items-center justify-between border-b border-white/5 pb-6">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                      {{ selectedLang() === 'ar' ? 'المشهد' : 'Scene' }} {{ currentStepIndex() + 1 }} {{ selectedLang() === 'ar' ? 'من' : 'of' }} {{ currentScenario()?.steps?.length || 0 }}
                    </span>
                    <span
                      class="rounded-full border px-4 py-1 text-[10px] font-black uppercase tracking-widest"
                      [class.border-emerald-400/20]="scorePercent() >= (currentScenario()?.passingScore || 70)"
                      [class.bg-emerald-500/10]="scorePercent() >= (currentScenario()?.passingScore || 70)"
                      [class.text-emerald-200]="scorePercent() >= (currentScenario()?.passingScore || 70)"
                      [class.border-amber-400/20]="scorePercent() < (currentScenario()?.passingScore || 70)"
                      [class.bg-amber-500/10]="scorePercent() < (currentScenario()?.passingScore || 70)"
                      [class.text-amber-100]="scorePercent() < (currentScenario()?.passingScore || 70)"
                    >
                      {{ selectedLang() === 'ar' ? 'التقييم الحالي' : 'Current Score' }} {{ scorePercent() }}%
                    </span>
                  </div>
                  <h4 class="text-xl font-black text-white">{{ selectedLang() === 'ar' ? 'الموقف الحالي' : 'Current Situation' }}</h4>
                </div>

                @if (activeStep(); as step) {
                  <div class="space-y-6 text-right">
                    <div class="rounded-[2.2rem] border border-white/10 bg-slate-950/70 p-6">
                      <p class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{{ step.title }}</p>
                      <p class="mt-4 text-2xl font-bold leading-relaxed text-slate-100">{{ step.situation }}</p>
                    </div>

                    @if (step.readings?.length) {
                      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                        @for (reading of step.readings; track reading.label + reading.value) {
                          <div
                            class="rounded-[1.8rem] border p-5 text-right"
                            [class.border-emerald-400/20]="reading.status === 'normal'"
                            [class.bg-emerald-500/10]="reading.status === 'normal'"
                            [class.border-amber-400/20]="reading.status === 'watch'"
                            [class.bg-amber-500/10]="reading.status === 'watch'"
                            [class.border-rose-400/20]="reading.status === 'critical'"
                            [class.bg-rose-500/10]="reading.status === 'critical'"
                          >
                            <div class="flex items-center justify-between gap-3">
                              <span
                                class="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em]"
                                [class.bg-emerald-500/20]="reading.status === 'normal'"
                                [class.text-emerald-100]="reading.status === 'normal'"
                                [class.bg-amber-500/20]="reading.status === 'watch'"
                                [class.text-amber-100]="reading.status === 'watch'"
                                [class.bg-rose-500/20]="reading.status === 'critical'"
                                [class.text-rose-100]="reading.status === 'critical'"
                              >
                                {{ readingStatusLabel(reading.status) }}
                              </span>
                              <p class="text-sm font-black text-white">{{ reading.label }}</p>
                            </div>
                            <p class="mt-4 text-2xl font-black text-white">{{ reading.value }}</p>
                            @if (reading.note) {
                              <p class="mt-2 text-xs font-semibold leading-6 text-slate-300">{{ reading.note }}</p>
                            }
                          </div>
                        }
                      </div>
                    }

                    <div class="rounded-[2.2rem] border border-cyan-400/20 bg-cyan-500/10 p-6">
                      <p class="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-100">{{ selectedLang() === 'ar' ? 'قرارك الآن' : 'Your Decision Now' }}</p>
                      <p class="mt-4 text-xl font-black leading-relaxed text-white">{{ step.decisionPrompt }}</p>
                    </div>

                    @if (lastChoiceOutcome() && !isFailed() && !isComplete()) {
                      <div
                        class="rounded-[2rem] border p-5"
                        [class.border-emerald-400/20]="lastChoiceOutcome()?.consequenceLevel === 'positive'"
                        [class.bg-emerald-500/10]="lastChoiceOutcome()?.consequenceLevel === 'positive'"
                        [class.border-rose-400/20]="lastChoiceOutcome()?.consequenceLevel !== 'positive'"
                        [class.bg-rose-500/10]="lastChoiceOutcome()?.consequenceLevel !== 'positive'"
                      >
                        <p
                          class="text-[10px] font-black uppercase tracking-[0.3em]"
                          [class.text-emerald-100]="lastChoiceOutcome()?.consequenceLevel === 'positive'"
                          [class.text-rose-100]="lastChoiceOutcome()?.consequenceLevel !== 'positive'"
                        >
                          {{ lastChoiceOutcome()?.consequenceLevel === 'positive'
                            ? (selectedLang() === 'ar' ? 'قرار صحيح' : 'Correct Decision')
                            : (selectedLang() === 'ar' ? 'اختيار غير صحيح' : 'Incorrect Decision') }}
                        </p>
                        <p class="mt-3 text-sm font-semibold leading-8 text-white">{{ lastChoiceOutcome()?.outcome }}</p>
                        @if (lastChoiceOutcome()?.consequenceLevel !== 'positive') {
                          <p class="mt-3 text-xs font-black leading-7 text-rose-100">
                            {{ selectedLang() === 'ar'
                              ? 'سبب الخطأ: هذا القرار ترك خطراً قائماً أو أحدث أثراً مهنياً سلبياً. راجع التفسير قبل متابعة المشهد التالي.'
                              : 'Why this was wrong: the decision left a risk unresolved or created a harmful professional consequence. Review the explanation before moving on.' }}
                          </p>
                        }
                        @if (isResolvingChoice()) {
                          <p
                            class="mt-3 text-[11px] font-black uppercase tracking-[0.25em]"
                            [class.text-emerald-100]="lastChoiceOutcome()?.consequenceLevel === 'positive'"
                            [class.text-rose-100]="lastChoiceOutcome()?.consequenceLevel !== 'positive'"
                          >
                            {{ selectedLang() === 'ar' ? 'جاري تحديث المشهد التالي...' : 'Loading the next scene...' }}
                          </p>
                        }
                      </div>
                    }

                    <div class="grid grid-cols-1 gap-4 pt-2">
                      @for (choice of randomizedOptions(); track choice.originalIndex; let choiceNumber = $index) {
                        <button
                          (click)="handleChoice(choice.originalIndex)"
                          [disabled]="isFailed() || isComplete() || isResolvingChoice()"
                          class="group flex w-full items-center justify-between rounded-2xl border-2 border-slate-800 p-6 text-right font-bold transition-all hover:border-emerald-500 hover:bg-emerald-500/5 disabled:opacity-40"
                        >
                          <span class="text-lg text-white">{{ choice.text }}</span>
                          <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-xs transition group-hover:bg-emerald-500 group-hover:text-white">
                            {{ choiceNumber + 1 }}
                          </span>
                        </button>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>

          <div class="space-y-8">
            <div class="space-y-8 rounded-[3rem] border border-white/10 bg-slate-900 p-8 shadow-2xl">
              <div class="border-b border-white/5 pb-4 text-right">
                <h4 class="text-lg font-black text-white">{{ selectedLang() === 'ar' ? 'معطيات البيئة' : 'Scene Elements' }}</h4>
                <p class="mt-2 text-sm font-bold text-slate-500">{{ currentScenario()?.environment }}</p>
              </div>
              <div class="grid grid-cols-1 gap-4">
                @for (item of currentScenario()?.items || []; track item.name) {
                  <div class="rounded-3xl border border-white/5 bg-slate-950 p-5 transition hover:border-emerald-500/30">
                    <div class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-xl text-emerald-500">
                      <i [class]="item.icon"></i>
                    </div>
                    <p class="text-sm font-black text-white">{{ item.name }}</p>
                    @if (item.role) {
                      <p class="mt-2 text-xs font-semibold leading-6 text-slate-400">{{ item.role }}</p>
                    }
                  </div>
                }
              </div>
            </div>

            <div class="space-y-6 rounded-[3rem] border border-white/10 bg-slate-900 p-8 shadow-2xl">
              <div class="border-b border-white/5 pb-4 text-right">
                <h4 class="text-lg font-black text-white">{{ selectedLang() === 'ar' ? 'سجل القرارات' : 'Decision Trail' }}</h4>
                <p class="mt-2 text-sm font-bold text-slate-500">{{ selectedLang() === 'ar' ? 'القرارات الأخيرة وتأثيرها على مسار الحالة.' : 'Recent decisions and how they affected the scenario.' }}</p>
              </div>

              <div class="space-y-4">
                @for (decision of recentDecisions(); track decision.stepId + decision.choiceText + decision.outcome) {
                  <div
                    class="rounded-[1.8rem] border p-4 text-right"
                    [class.border-emerald-400/20]="decision.consequenceLevel === 'positive'"
                    [class.bg-emerald-500/10]="decision.consequenceLevel === 'positive'"
                    [class.border-amber-400/20]="decision.consequenceLevel === 'warning'"
                    [class.bg-amber-500/10]="decision.consequenceLevel === 'warning'"
                    [class.border-rose-400/20]="decision.consequenceLevel === 'critical'"
                    [class.bg-rose-500/10]="decision.consequenceLevel === 'critical'"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <span
                        class="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em]"
                        [class.bg-emerald-500/20]="decision.consequenceLevel === 'positive'"
                        [class.text-emerald-100]="decision.consequenceLevel === 'positive'"
                        [class.bg-amber-500/20]="decision.consequenceLevel === 'warning'"
                        [class.text-amber-100]="decision.consequenceLevel === 'warning'"
                        [class.bg-rose-500/20]="decision.consequenceLevel === 'critical'"
                        [class.text-rose-100]="decision.consequenceLevel === 'critical'"
                      >
                        {{ consequenceLabel(decision.consequenceLevel) }}
                      </span>
                      <p class="text-sm font-black text-white">{{ decision.stepTitle }}</p>
                    </div>
                    <p class="mt-3 text-sm font-bold text-slate-100">{{ decision.choiceText }}</p>
                    <p class="mt-2 text-xs font-semibold leading-6 text-slate-300">{{ decision.outcome }}</p>
                  </div>
                } @empty {
                  <div class="rounded-[1.8rem] border border-dashed border-white/10 bg-slate-950/50 px-4 py-8 text-center text-sm font-bold text-slate-500">
                    {{ selectedLang() === 'ar' ? 'لم يبدأ سجل القرارات بعد.' : 'The decision trail has not started yet.' }}
                  </div>
                }
              </div>
            </div>

            <div class="relative overflow-hidden rounded-[3rem] bg-emerald-600 p-8 text-white shadow-2xl">
              <div class="relative z-10 text-right">
                <h4 class="mb-3 text-lg font-black">{{ selectedLang() === 'ar' ? 'توجيه المدرب' : 'Coach Guidance' }}</h4>
                <p class="text-sm font-bold leading-8 opacity-95">
                  {{ isComplete() || isFailed()
                    ? currentScenario()?.finalEvaluation?.recommendedAction
                    : (selectedLang() === 'ar'
                      ? 'لا تفكر بطريقة ماذا أجهز. فكّر في ما الذي وقع الآن، وما القرار الذي يحمي السلامة أو الجودة أو الحق المهني أولاً.'
                      : 'Do not think in terms of what to prepare. Think in terms of what just happened and which decision protects safety, quality, or professional duty first.') }}
                </p>
              </div>
              <i class="fa-solid fa-lightbulb absolute -left-4 -bottom-4 text-8xl opacity-10"></i>
            </div>
          </div>
        </div>
      }

      @if (showUpgradeModal()) {
        <app-upgrade-modal
          [title]="selectedLang() === 'ar' ? 'تم الوصول للحد اليومي' : 'Daily Limit Reached'"
          [message]="upgradeMessage()"
          icon="fa-solid fa-flask-vial"
          (closeModal)="showUpgradeModal.set(false)"
          (upgradePlan)="onUpgradeRequested()"
        />
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .shadow-3xl {
      box-shadow: 0 40px 100px -20px rgba(0, 0, 0, 0.5);
    }

    @keyframes pan {
      0% { transform: scale(1.1) translateX(-5%); }
      50% { transform: scale(1.2) translateX(5%); }
      100% { transform: scale(1.1) translateX(-5%); }
    }

    .animate-pan-slow {
      animation: pan 10s ease-in-out infinite;
    }
  `]
})
export class LabPage {
  private readonly ai = inject(AIService);
  private readonly ns = inject(NotificationService);
  public readonly localization = inject(LocalizationService);

  back = output<void>();

  isBusy = signal(false);
  currentScenario = signal<LabScenario | null>(null);
  labImage = signal('');
  currentStepId = signal<string | null>(null);
  isFailed = signal(false);
  isComplete = signal(false);
  selectedLang = signal<LanguageCode>(this.localization.currentLanguage());
  selectedDifficulty = signal<LabScenarioDifficulty>((() => {
    const stored = localStorage.getItem('smartedge_lab_difficulty');
    return stored === 'easy' || stored === 'hard' || stored === 'medium' ? stored : 'medium';
  })());
  selectedFiles = signal<AIFileAttachment[]>([]);
  scenarioScore = signal(0);
  lastChoiceOutcome = signal<ScenarioDecisionRecord | null>(null);
  attemptRecorded = signal(false);
  decisionTrail = signal<ScenarioDecisionRecord[]>([]);
  labHistory = signal<LabHistoryItem[]>(this.loadLabHistory());
  randomizedOptions = signal<RandomizedChoiceView[]>([]);
  isResolvingChoice = signal(false);

  showUpgradeModal = signal(false);
  upgradeMessage = signal('');
  private pendingStepTransitionTimeout: number | null = null;

  readonly activeStep = computed(() => {
    const scenario = this.currentScenario();
    if (!scenario) return null;
    const currentStepId = this.currentStepId();
    return scenario.steps.find(step => step.id === currentStepId) || scenario.steps[0] || null;
  });

  readonly currentStepIndex = computed(() => {
    const scenario = this.currentScenario();
    const step = this.activeStep();
    if (!scenario || !step) return 0;
    return Math.max(0, scenario.steps.findIndex(candidate => candidate.id === step.id));
  });

  readonly recentDecisions = computed(() => this.decisionTrail().slice(-4).reverse());

  readonly scorePercent = computed(() => {
    const scenario = this.currentScenario();
    const decisions = this.decisionTrail();
    if (!scenario || decisions.length === 0) return 0;

    const scoreWindow = decisions.reduce((acc, decision) => {
      const step = scenario.steps.find(item => item.id === decision.stepId);
      if (!step) {
        return {
          current: acc.current + decision.scoreImpact,
          min: acc.min - 20,
          max: acc.max + 20
        };
      }

      const impacts = step.choices.map(choice => choice.scoreImpact);
      return {
        current: acc.current + decision.scoreImpact,
        min: acc.min + Math.min(...impacts),
        max: acc.max + Math.max(...impacts)
      };
    }, { current: 0, min: 0, max: 0 });

    if (scoreWindow.max === scoreWindow.min) {
      return scoreWindow.current >= 0 ? 100 : 0;
    }

    const normalized = ((scoreWindow.current - scoreWindow.min) / (scoreWindow.max - scoreWindow.min)) * 100;
    return Math.max(0, Math.min(100, Math.round(normalized)));
  });

  readonly finalStrengths = computed(() => {
    const dynamic = this.decisionTrail()
      .filter(decision => decision.consequenceLevel === 'positive')
      .map(decision => decision.choiceText)
      .filter((value, index, list) => value && list.indexOf(value) === index)
      .slice(0, 4);

    if (dynamic.length > 0) {
      return dynamic;
    }

    return this.currentScenario()?.finalEvaluation?.strengths || [];
  });

  readonly finalImprovements = computed(() => {
    const dynamic = this.decisionTrail()
      .filter(decision => decision.consequenceLevel !== 'positive')
      .map(decision => decision.choiceText)
      .filter((value, index, list) => value && list.indexOf(value) === index)
      .slice(0, 4);

    if (dynamic.length > 0) {
      return dynamic;
    }

    return this.currentScenario()?.finalEvaluation?.improvements || [];
  });

  readonly evaluationSummary = computed(() => {
    const scenario = this.currentScenario();
    if (!scenario) return '';

    const baseSummary = scenario.finalEvaluation?.summary || '';
    const score = this.scorePercent();
    const passingScore = scenario.passingScore || 70;

    if (this.isFailed()) {
      return this.selectedLang() === 'ar'
        ? `${baseSummary} انتهى المسار الحالي لأن أحد القرارات قاد إلى نتيجة حرجة.`
        : `${baseSummary} The current path ended because one of your decisions led to a critical outcome.`;
    }

    if (score >= passingScore) {
      return baseSummary;
    }

    return this.selectedLang() === 'ar'
      ? `${baseSummary} أكملت السيناريو، لكن جودة القرار ما زالت تحتاج مراجعة أعمق في اللحظات الحساسة.`
      : `${baseSummary} You completed the scenario, but the quality of decision-making still needs stronger judgment in the most sensitive moments.`;
  });

  onUpgradeRequested = () => {
    this.showUpgradeModal.set(false);
    this.exitScenario();
    this.back.emit();
  };

  constructor() {
    effect(() => {
      localStorage.setItem('lab_history', JSON.stringify(this.labHistory()));
    });

    effect(() => {
      localStorage.setItem('smartedge_lab_difficulty', this.selectedDifficulty());
    });

    effect(() => {
      const currentLanguage = normalizeLanguageCode(this.localization.currentLanguage());
      if (this.selectedLang() !== currentLanguage) {
        this.selectedLang.set(currentLanguage);
      }
    });
  }

  onLanguageChange(language: string) {
    const normalized = normalizeLanguageCode(language);
    this.selectedLang.set(normalized);
    void this.localization.setLanguage(normalized);
  }

  async createLab(discipline: string, subject: string) {
    if (!discipline.trim() || !subject.trim()) {
      this.ns.show(
        this.selectedLang() === 'ar' ? 'بيانات ناقصة' : 'Missing Input',
        this.selectedLang() === 'ar'
          ? 'أدخل التخصص والموقف العملي أولاً.'
          : 'Enter the discipline and the practical scenario first.',
        'warning',
        'fa-solid fa-circle-exclamation'
      );
      return;
    }

    const limitCheck = this.ai.checkLimit('virtualLabSimulations');
    if (!limitCheck.allowed) {
      this.upgradeMessage.set(limitCheck.message);
      this.showUpgradeModal.set(true);
      return;
    }

    this.isBusy.set(true);

    try {
      const scenario = await this.ai.generatePracticalLab(
        discipline.trim(),
        subject.trim(),
        this.selectedLang(),
        this.selectedFiles(),
        this.selectedDifficulty()
      );

      this.startScenario(scenario);
      this.selectedFiles.set([]);

      const historyItem: LabHistoryItem = {
        title: scenario.title,
        discipline: discipline.trim(),
        subject: subject.trim(),
        scenario,
        timestamp: new Date().toISOString()
      };

      this.labHistory.update(history => [historyItem, ...history.slice(0, 9)]);
      this.ai.incrementUsage('virtualLabSimulations');

      this.ns.show(
        this.selectedLang() === 'ar' ? 'السيناريو جاهز' : 'Scenario Ready',
        this.selectedLang() === 'ar'
          ? `تم إنشاء ${scenario.title}`
          : `${scenario.title} is ready`,
        'success',
        'fa-solid fa-flask-vial'
      );
    } catch (error) {
      console.error(error);
      this.ns.show(
        this.selectedLang() === 'ar' ? 'تعذر إنشاء السيناريو' : 'Could Not Build Scenario',
        this.selectedLang() === 'ar'
          ? 'حدث خطأ أثناء إنشاء المحاكاة. حاول مرة أخرى.'
          : 'An error happened while generating the simulation. Try again.',
        'error',
        'fa-solid fa-triangle-exclamation'
      );
    } finally {
      this.isBusy.set(false);
    }
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    const filePromises = Array.from(files as FileList).map((file) => new Promise<AIFileAttachment>((resolve) => {
      const reader = new FileReader();
      reader.onload = (readerEvent: ProgressEvent<FileReader>) => {
        const raw = typeof readerEvent.target?.result === 'string' ? readerEvent.target.result : '';
        const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
        resolve({
          data: base64,
          mimeType: file.type || 'application/octet-stream',
          name: file.name
        });
      };
      reader.readAsDataURL(file);
    }));

    const results = await Promise.all(filePromises);
    this.selectedFiles.update(current => [...current, ...results]);
    input.value = '';
  }

  loadFromHistory(item: LabHistoryItem) {
    const scenario = this.ai.normalizeLabScenarioSnapshot(item.scenario, item.discipline, item.subject, this.selectedLang());
    this.startScenario(scenario);
  }

  clearHistory() {
    const shouldClear = window.confirm(
      this.selectedLang() === 'ar'
        ? 'هل أنت متأكد من مسح سجل السيناريوهات؟'
        : 'Are you sure you want to clear the scenario history?'
    );

    if (!shouldClear) return;
    this.labHistory.set([]);
    localStorage.removeItem('lab_history');
  }

  handleRetry() {
    if (this.ai.userPlan() === 'free') {
      this.upgradeMessage.set(this.selectedLang() === 'ar'
        ? 'المستخدمون المجانيون لا يمكنهم إعادة المحاولة داخل نفس السيناريو. اشترك في Pro للحصول على محاولات غير محدودة.'
        : 'Free users cannot retry inside the same scenario. Upgrade to Pro for unlimited replays.');
      this.showUpgradeModal.set(true);
      return;
    }

    const scenario = this.currentScenario();
    if (!scenario) return;
    this.startScenario(scenario);
  }

  handleChoice(choiceIndex: number) {
    const scenario = this.currentScenario();
    const step = this.activeStep();
    if (!scenario || !step || this.isFailed() || this.isComplete() || this.isResolvingChoice()) {
      return;
    }

    const choice = step.choices[choiceIndex];
    if (!choice) {
      return;
    }

    this.clearPendingStepTransition();
    this.isResolvingChoice.set(true);

    const decision: ScenarioDecisionRecord = {
      stepId: step.id,
      stepTitle: step.title,
      choiceText: choice.text,
      outcome: choice.outcome,
      scoreImpact: choice.scoreImpact,
      consequenceLevel: choice.consequenceLevel
    };

    this.scenarioScore.update(score => score + choice.scoreImpact);
    this.decisionTrail.update(history => [...history, decision]);
    this.lastChoiceOutcome.set(decision);
    this.playChoiceSound(choice);

    const nextStepId = choice.nextStepId && scenario.steps.some(item => item.id === choice.nextStepId)
      ? choice.nextStepId
      : null;

    if (!nextStepId) {
      if (choice.consequenceLevel === 'critical') {
        this.isFailed.set(true);
        this.recordScenarioOutcome('failed');
      } else {
        this.isComplete.set(true);
        this.recordScenarioOutcome('complete');
      }
      this.isResolvingChoice.set(false);
      return;
    }

    if (choice.consequenceLevel === 'warning') {
      this.pendingStepTransitionTimeout = window.setTimeout(() => {
        this.moveToStep(nextStepId);
      }, 1400);
      return;
    }

    this.moveToStep(nextStepId);
  }

  consequenceLabel(level: LabScenarioConsequenceLevel) {
    if (this.selectedLang() === 'ar') {
      return level === 'positive' ? 'قرار صحيح' : level === 'warning' ? 'قرار خاطئ' : 'خطأ حرج';
    }
    return level === 'positive' ? 'Correct Move' : level === 'warning' ? 'Wrong Move' : 'Critical Error';
  }

  difficultyLabel(level: LabScenarioDifficulty) {
    if (this.selectedLang() === 'ar') {
      return level === 'easy' ? 'سهل' : level === 'hard' ? 'صعب' : 'متوسط';
    }

    return level === 'easy' ? 'Easy' : level === 'hard' ? 'Hard' : 'Medium';
  }

  readingStatusLabel(status: LabScenarioReading['status']) {
    if (this.selectedLang() === 'ar') {
      return status === 'normal' ? 'مستقر' : status === 'critical' ? 'حرج' : 'مراقبة';
    }

    return status === 'normal' ? 'Stable' : status === 'critical' ? 'Critical' : 'Watch';
  }

  exitScenario() {
    this.clearPendingStepTransition();
    this.currentScenario.set(null);
    this.currentStepId.set(null);
    this.isFailed.set(false);
    this.isComplete.set(false);
    this.scenarioScore.set(0);
    this.lastChoiceOutcome.set(null);
    this.decisionTrail.set([]);
    this.randomizedOptions.set([]);
    this.attemptRecorded.set(false);
    this.labImage.set('');
    this.isResolvingChoice.set(false);
  }

  private startScenario(scenario: LabScenario) {
    this.clearPendingStepTransition();
    this.currentScenario.set(scenario);
    this.selectedDifficulty.set(scenario.difficulty || 'medium');
    this.currentStepId.set(scenario.steps[0]?.id || null);
    this.isFailed.set(false);
    this.isComplete.set(false);
    this.scenarioScore.set(0);
    this.lastChoiceOutcome.set(null);
    this.decisionTrail.set([]);
    this.randomizedOptions.set([]);
    this.attemptRecorded.set(false);
    this.labImage.set('');
    this.isResolvingChoice.set(false);
    this.shuffleOptions();
  }

  private moveToStep(nextStepId: string) {
    this.currentStepId.set(nextStepId);
    this.shuffleOptions();
    this.isResolvingChoice.set(false);
    this.pendingStepTransitionTimeout = null;
  }

  private shuffleOptions() {
    const step = this.activeStep();
    if (!step) {
      this.randomizedOptions.set([]);
      return;
    }

    const options = step.choices.map((choice, index) => ({
      originalIndex: index,
      text: choice.text
    }));

    for (let i = options.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }

    this.randomizedOptions.set(options);
  }

  private recordScenarioOutcome(type: 'complete' | 'failed') {
    if (this.attemptRecorded()) {
      return;
    }

    this.attemptRecorded.set(true);
    const score = this.scorePercent();

    this.ai.addPerformanceRecord({
      date: new Date().toISOString(),
      score,
      type: 'simulation',
      subject: this.currentScenario()?.title
    });

    if (type === 'complete') {
      this.ai.simulationsCompleted.update(value => value + 1);
    }
  }

  private playChoiceSound(choice: LabScenarioChoice) {
    const successUrl = 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73456.mp3';
    const failUrl = 'https://cdn.pixabay.com/audio/2022/03/10/audio_783ed375da.mp3';
    const url = choice.consequenceLevel === 'positive' ? successUrl : failUrl;
    const audio = new Audio(url);
    audio.play().catch(error => console.error('Sound play failed', error));
  }

  private clearPendingStepTransition() {
    if (this.pendingStepTransitionTimeout) {
      window.clearTimeout(this.pendingStepTransitionTimeout);
      this.pendingStepTransitionTimeout = null;
    }
  }

  private loadLabHistory(): LabHistoryItem[] {
    const raw = localStorage.getItem('lab_history');
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw) as Array<Partial<LabHistoryItem>>;
      if (!Array.isArray(parsed)) return [];

      return parsed.map((entry, index) => {
        const discipline = String(entry?.discipline || '').trim() || (this.selectedLang() === 'ar' ? 'تخصص عام' : 'General Discipline');
        const subject = String(entry?.subject || '').trim() || (this.selectedLang() === 'ar' ? 'سيناريو مهني' : 'Professional Scenario');
        const scenario = this.ai.normalizeLabScenarioSnapshot(entry?.scenario, discipline, subject, this.selectedLang());
        return {
          title: String(entry?.title || scenario.title || `${discipline} Scenario`).trim(),
          discipline,
          subject,
          scenario,
          timestamp: String(entry?.timestamp || new Date(Date.now() - (index * 60_000)).toISOString())
        };
      }).slice(0, 10);
    } catch {
      return [];
    }
  }
}
