import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AIService } from '../../../../services/ai.service';
import { LocalizationService } from '../../../../services/localization.service';
import { ScenarioConfig } from '../models/virtual-lab.models';
import { SetupFormComponent } from '../components/setup-form.component';
import { ClinicalRecordService } from '../services/clinical-record.service';
import { SpecialtyProfileService } from '../services/specialty-profile.service';
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
        [title]="ui('ابنِ حالة سريرية واقعية ومتكاملة قبل الدخول', 'Build a realistic clinical case before entry')"
        [subtitle]="ui('اكتب التخصص الصحي أو الطبي، ثم اكتب الحالة أو الموضوع المرضي، واختر مستوى الصعوبة والزمن. سيُنشئ النظام مريضاً افتراضياً متكاملاً مع chart، vitals، فحوصات، استجابة علاجية، وتقييم تعليمي نهائي.', 'Enter the medical/health specialty, then the case topic, then choose difficulty and duration. The system will generate a full virtual patient with a chart, vitals, investigations, treatment response, and a final educational evaluation.')"
        [specialtyLabel]="ui('التخصص الطبي / الصحي', 'Medical / Health Specialty')"
        [specialtyPlaceholder]="ui('مثال: Nursing, Medicine, Emergency, ICU, Pediatrics, Surgery, Obstetrics', 'Example: Nursing, Medicine, Emergency, ICU, Pediatrics, Surgery, Obstetrics')"
        [scenarioLabel]="ui('الحالة أو الموضوع المرضي', 'Clinical Case / Disease Topic')"
        [scenarioPlaceholder]="ui('مثال: COPD exacerbation, Myocardial infarction, Septic shock, Acute asthma', 'Example: COPD exacerbation, Myocardial infarction, Septic shock, Acute asthma')"
        [difficultyLabel]="ui('مستوى الصعوبة', 'Difficulty')"
        [durationLabel]="ui('مدة المختبر', 'Lab Duration')"
        [submitLabel]="ui('ابدأ المختبر السريري', 'Start Clinical Lab')"
        [loadingLabel]="ui('جارٍ فتح الجلسة', 'Opening session')"
        [helperText]="ui('تظل الحالة نشطة طوال الزمن المحدد، وتتغير العلامات والنتائج حسب قراراتك العلاجية والتشخيصية.', 'The case stays active for the full selected duration, and the vitals/results change according to your diagnostic and therapeutic decisions.')"
        [examplesTitle]="ui('أمثلة سريرية جاهزة', 'Ready clinical examples')"
        [examples]="examples"
        [initialValue]="session.simulationConfig()"
        [errorMessage]="errorMessage()"
        [busy]="starting()"
        (submitted)="handleSubmit($event)"
      ></app-setup-form>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SimulationSetupPageComponent {
  readonly session = inject(VirtualLabSessionService);
  private readonly localization = inject(LocalizationService);
  private readonly ai = inject(AIService);
  private readonly clinicalRecords = inject(ClinicalRecordService);
  private readonly profiles = inject(SpecialtyProfileService);
  readonly errorMessage = signal('');
  readonly starting = signal(false);
  readonly isArabic = computed(() => this.localization.currentLanguage() === 'ar');

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
      const language = this.isArabic() ? 'ar' : 'en';
      const baseConfig = {
        ...config,
        language
      } as const;
      const usesMedicalRuntime = this.profiles.shouldUseMedicalRuntime(baseConfig);

      if (usesMedicalRuntime) {
        const generatedCase = await this.clinicalRecords.requestNextCase(config, language);
        this.session.openSimulationSession({
          ...config,
          language,
          generatedCase
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

  ui(arabic: string, english: string) {
    return this.isArabic() ? arabic : english;
  }
}
