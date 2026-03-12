import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AIService, InformationReliabilityLevel, KnowledgeValidationReport } from '../../services/ai.service';
import { LocalizationService } from '../../services/localization.service';

@Component({
  selector: 'app-knowledge-reliability-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (report(); as current) {
      <div class="pointer-events-none fixed inset-x-4 top-4 z-[190] md:left-6 md:right-auto md:w-[24rem]">
        <div class="pointer-events-auto rounded-[2rem] border border-white/10 bg-slate-950/92 p-5 shadow-2xl shadow-black/35 backdrop-blur-2xl">
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-1">
              <p class="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">{{ ui('نظام التحقق العلمي', 'Knowledge Validation System') }}</p>
              <h3 class="text-sm font-black text-white">{{ ui('Information Reliability Score', 'Information Reliability Score') }}</h3>
            </div>
            <span [class]="levelClass(current.level)" class="inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] border">
              {{ levelLabel(current.level) }}
            </span>
          </div>

          <div class="mt-4 flex items-end justify-between gap-3">
            <div>
              <p class="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{{ ui('درجة الموثوقية', 'Reliability Score') }}</p>
              <p class="text-3xl font-black text-white">{{ current.score }}<span class="text-base text-slate-500">/100</span></p>
            </div>
            <div class="text-right">
              <p class="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">{{ ui('المجال', 'Domain') }}</p>
              <p class="text-sm font-bold text-slate-200">{{ domainLabel(current) }}</p>
            </div>
          </div>

          <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
            <div class="h-full rounded-full transition-all duration-500" [class]="scoreBarClass(current.level)" [style.width.%]="current.score"></div>
          </div>

          <p class="mt-4 text-xs leading-6 text-slate-300">{{ current.summary }}</p>

          <div class="mt-4 flex flex-wrap gap-2">
            @for (source of current.sourceFamilies.slice(0, 3); track source) {
              <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold text-slate-300">{{ source }}</span>
            }
            @if (current.medicalSafetyApplied) {
              <span class="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black text-amber-300">{{ ui('Medical Safety Logic', 'Medical Safety Logic') }}</span>
            }
          </div>

          @if (current.warnings.length > 0) {
            <div class="mt-4 rounded-[1.3rem] border border-amber-500/15 bg-amber-500/8 px-4 py-3">
              <p class="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300">{{ ui('يحتاج مراجعة', 'Needs Attention') }}</p>
              <p class="mt-1 text-xs leading-6 text-amber-100">{{ current.warnings[0] }}</p>
            </div>
          }
        </div>
      </div>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KnowledgeReliabilityBannerComponent {
  readonly ai = inject(AIService);
  private readonly localization = inject(LocalizationService);
  readonly report = computed(() => this.ai.lastKnowledgeValidation());

  ui(arabic: string, english: string) {
    return this.localization.currentLanguage() === 'ar' ? arabic : english;
  }

  levelLabel(level: InformationReliabilityLevel) {
    if (level === 'high') {
      return this.ui('موثوقية عالية', 'High reliability');
    }

    if (level === 'medium') {
      return this.ui('موثوقية متوسطة', 'Medium reliability');
    }

    return this.ui('يحتاج تحققاً', 'Needs verification');
  }

  levelClass(level: InformationReliabilityLevel) {
    if (level === 'high') {
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    }

    if (level === 'medium') {
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    }

    return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  }

  scoreBarClass(level: InformationReliabilityLevel) {
    if (level === 'high') {
      return 'bg-emerald-400';
    }

    if (level === 'medium') {
      return 'bg-amber-400';
    }

    return 'bg-rose-400';
  }

  domainLabel(report: KnowledgeValidationReport) {
    if (report.domain === 'medical') {
      return this.ui('طبي وتمريضي', 'Medical');
    }

    if (report.domain === 'engineering') {
      return this.ui('هندسي', 'Engineering');
    }

    if (report.domain === 'law') {
      return this.ui('قانوني', 'Law');
    }

    if (report.domain === 'general_science') {
      return this.ui('علوم عامة', 'General Science');
    }

    return this.ui('أكاديمي عام', 'General Academic');
  }
}
