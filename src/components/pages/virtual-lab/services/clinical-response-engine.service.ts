import { Injectable } from '@angular/core';
import { GeneratedClinicalCase } from '../models/virtual-lab.models';

@Injectable({ providedIn: 'root' })
export class ClinicalResponseEngineService {
  buildOpeningMessage(args: {
    language: 'ar' | 'en';
    role: string;
    setting: string;
    openingMessage: string;
    nextPrompt: string;
    generatedCase: GeneratedClinicalCase | null;
  }): string {
    const investigations = args.generatedCase?.recommendedInvestigations.slice(0, 2).join(args.language === 'ar' ? '، ' : ', ');
    const addendum = investigations
      ? args.language === 'ar'
        ? `الفحوصات المرجحة الآن: ${investigations}.`
        : `Likely investigations now: ${investigations}.`
      : '';

    return [args.role, args.setting, args.openingMessage, addendum, args.nextPrompt]
      .filter(Boolean)
      .join('\n\n');
  }

  buildPromptHint(generatedCase: GeneratedClinicalCase | null, language: 'ar' | 'en'): string {
    if (!generatedCase) {
      return '';
    }

    const focus = generatedCase.learningFocus[0];
    if (!focus) {
      return '';
    }

    return language === 'ar'
      ? `تذكير سريري: ${focus}.`
      : `Clinical cue: ${focus}.`;
  }
}
