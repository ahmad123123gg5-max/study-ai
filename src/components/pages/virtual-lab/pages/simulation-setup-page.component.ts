import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AIService } from '../../../../services/ai.service';
import { LocalizationService } from '../../../../services/localization.service';
import { ScenarioConfig } from '../models/virtual-lab.models';
import { SetupFormComponent } from '../components/setup-form.component';
import { ClinicalCaseService } from '../services/clinical-case.service';
import { SpecialtyProfileService } from '../services/specialty-profile.service';
import { SimulationEngineService } from '../services/simulation-engine.service';
import { VirtualLabSessionService } from '../services/virtual-lab-session.service';

@Component({
  selector: 'app-simulation-setup-page',
  standalone: true,
  imports: [CommonModule, SetupFormComponent],
  template: `
    <div class="mx-auto flex min-h-full w-full max-w-4xl items-start px-4 py-8 md:px-8 md:py-10">
      <app-setup-form
        class="w-full"
        [eyebrow]="ui('تهيئة المختبر السريري', 'Clinical Lab Setup')"
        [title]="ui('ابنِ حالة سريرية فورية وواقعية', 'Generate a real-time clinical case')"
        [subtitle]="ui('اكتب التخصص الطبي، ثم اكتب الحالة إن أردت (اختياري)، واختر مستوى الصعوبة والزمن. عند البدء سيولّد الذكاء الاصطناعي الحالة فوراً مع vitals، فحص سريري، وتفاصيل تعليمية كاملة.', 'Enter the medical specialty, optionally provide a case topic, then choose difficulty and duration. On start, AI generates a fresh clinical case with vitals, exam findings, and full educational detail.')"
        [specialtyLabel]="ui('التخصص الطبي / الصحي', 'Medical / Health Specialty')"
        [specialtyPlaceholder]="ui('مثال: Nursing, Medicine, Emergency, ICU, Pediatrics, Surgery, Obstetrics', 'Example: Nursing, Medicine, Emergency, ICU, Pediatrics, Surgery, Obstetrics')"
        [scenarioLabel]="ui('الحالة أو الموضوع المرضي (اختياري)', 'Clinical Case / Disease Topic (Optional)')"
        [scenarioPlaceholder]="ui('مثال: COPD exacerbation, Myocardial infarction, Septic shock، أو اتركه فارغاً لحالة عشوائية', 'Example: COPD exacerbation, Myocardial infarction, Septic shock, or leave blank for a random case')"
        [imageLabel]="ui('الصور المرجعية المحلية', 'Local Reference Images')"
        [imageHelperText]="ui('أرفق صورًا مرجعية للمشهد إذا أردت. ستبقى محلية داخل الصفحة.', 'Attach local reference images for the case if you want. They stay on the page only.')"
        [imageNote]="ui('الصور لا تُرسل إلى الـ API. يستخدم المختبر الموضوع الذي كتبته لتوليد الجلسة، بينما تبقى الصور للعرض المحلي فقط.', 'Images are not sent to the API. The lab uses your written topic to generate the session while the images remain local-only.')"
        [imageCountLabel]="ui('صور', 'images')"
        [difficultyLabel]="ui('مستوى الصعوبة', 'Difficulty')"
        [durationLabel]="ui('مدة المختبر', 'Lab Duration')"
        [submitLabel]="ui('ابدأ المختبر السريري', 'Start Clinical Lab')"
        [loadingLabel]="ui('جارٍ توليد الحالة السريرية', 'Generating clinical case')"
        [helperText]="ui('تظل الحالة نشطة طوال الزمن المحدد، وتتغير العلامات والنتائج حسب قراراتك العلاجية والتشخيصية.', 'The case stays active for the full selected duration, and the vitals/results change according to your diagnostic and therapeutic decisions.')"
        [examplesTitle]="ui('أمثلة سريرية جاهزة', 'Ready clinical examples')"
        [examples]="examples"
        [initialValue]="session.simulationConfig()"
        [errorMessage]="errorMessage()"
        [busy]="starting()"
        (submitted)="handleSubmit($event)"
      ></app-setup-form>

      @if (canResume()) {
        <div class="mt-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
          <div>
            <p class="text-sm font-black text-white">{{ ui('لديك حالة سريرية جارية', 'You have an active clinical case') }}</p>
            <p class="mt-1 text-xs font-medium text-slate-400">{{ ui('يمكنك متابعة نفس الحالة دون توليد حالة جديدة.', 'Resume the same case without generating a new one.') }}</p>
          </div>
          <button
            type="button"
            (click)="resumeCurrentCase()"
            class="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-5 py-3 text-xs font-black text-emerald-100 transition hover:bg-emerald-500/20"
          >
            <i class="fa-solid fa-rotate-right"></i>
            <span>{{ ui('إكمال الحالة الحالية', 'Resume Current Case') }}</span>
          </button>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimulationSetupPageComponent {
  readonly session = inject(VirtualLabSessionService);
  private readonly localization = inject(LocalizationService);
  private readonly ai = inject(AIService);
  private readonly clinicalCaseApi = inject(ClinicalCaseService);
  private readonly profiles = inject(SpecialtyProfileService);
  private readonly engine = inject(SimulationEngineService);
  readonly errorMessage = signal('');
  readonly starting = signal(false);
  readonly isArabic = computed(() => this.localization.currentLanguage() === 'ar');
  readonly canResume = computed(() => !!this.session.simulationConfig()?.clinicalCase || !!this.session.simulationConfig()?.generatedCase);

  readonly examples = [
    'Nursing + Hypoglycemia',
    'Nursing + COPD exacerbation',
    'Medicine + Myocardial infarction',
    'Emergency + Anaphylaxis',
    'ICU + Septic shock',
    'Pediatrics + Acute asthma',
    'Surgery + Acute appendicitis',
    'Obstetrics + Postpartum hemorrhage'
  ];

  async handleSubmit(config: ScenarioConfig) {
    const limit = this.ai.checkLimit('virtualLabSimulations');
    if (!limit.allowed) {
      this.errorMessage.set(limit.message);
      return;
    }

    this.errorMessage.set('');
    this.starting.set(true);

    try {
      this.engine.reset();
      this.session.resetSimulationState();

      const language = this.isArabic() ? 'ar' : 'en';
      const baseConfig = {
        ...config,
        language
      } as const;
      const category = this.profiles.categorizeSpecialty(baseConfig.specialty, baseConfig.scenario);
      const isMedical = category === 'medical';

      if (isMedical) {
        const clinicalCase = await this.clinicalCaseApi.generateCase(config, language);
        this.session.openSimulationSession({
          ...config,
          scenario: config.scenario?.trim() || clinicalCase.requestedTopic || clinicalCase.title,
          language,
          clinicalCase,
          generatedCase: null
        });
        return;
      }

      this.session.openSimulationSession(baseConfig);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : this.ui('تعذر تجهيز الحالة السريرية الآن.', 'Failed to prepare the clinical case.')
      );
    } finally {
      this.starting.set(false);
    }
  }

  resumeCurrentCase() {
    this.errorMessage.set('');
    this.session.resumeSimulationSession();
  }

  ui(arabic: string, english: string) {
    return this.isArabic() ? arabic : english;
  }
}
