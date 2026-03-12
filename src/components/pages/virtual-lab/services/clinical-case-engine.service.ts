import { Injectable } from '@angular/core';
import { GeneratedClinicalCase, MedicalSeverity, SimulationScenarioConfig } from '../models/virtual-lab.models';

interface ProblemSeed {
  score: number;
  decay: number;
}

export interface ClinicalGeneratedProfile {
  title: string;
  role: string;
  setting: string;
  objective: string;
  openingMessage: string;
  standardOfCare: string[];
  idealVitals: {
    heartRate: number;
    oxygenSaturation: number;
    respiratoryRate: number;
    systolic: number;
    diastolic: number;
    temperatureCelsius: number;
  };
  initialProblems: {
    airway: ProblemSeed;
    oxygenation: ProblemSeed;
    perfusion: ProblemSeed;
    rhythm: ProblemSeed;
    monitoring: ProblemSeed;
  };
  ecgBySeverity: Record<MedicalSeverity, 'normal' | 'stemi' | 'af' | 'vtach'>;
  estimatedTotalSteps: number;
}

@Injectable({ providedIn: 'root' })
export class ClinicalCaseEngineService {
  profileForCase(config: SimulationScenarioConfig, generatedCase: GeneratedClinicalCase | null): ClinicalGeneratedProfile | null {
    if (!generatedCase) {
      return null;
    }

    const language = config.language;
    const title = generatedCase.title;
    const role = language === 'ar'
      ? `أنت الممرض/ة المسؤول/ة عن التعامل مع ${generatedCase.diseaseLabel} داخل ${generatedCase.specialtyTrack}.`
      : `You are the nurse responsible for managing ${generatedCase.diseaseLabelEn} inside ${generatedCase.specialtyTrack}.`;
    const setting = language === 'ar'
      ? `المشهد يبدأ مع ${generatedCase.chiefComplaint}، وبيانات المريض توحي بـ ${generatedCase.source} مع ${generatedCase.complication}.`
      : `The scene opens with ${generatedCase.chiefComplaint}, and the patient data points to ${generatedCase.source} with ${generatedCase.complication}.`;
    const objective = language === 'ar'
      ? `ثبّت المريض، امنع التدهور، وحقق استجابة علاجية تتماشى مع ${generatedCase.treatmentResponse}.`
      : `Stabilize the patient, prevent deterioration, and steer the case toward ${generatedCase.treatmentResponse}.`;

    const standardOfCare = [
      generatedCase.learningFocus[0],
      generatedCase.learningFocus[1] || generatedCase.recommendedInvestigations[0],
      generatedCase.recommendedInvestigations[0] || generatedCase.learningFocus[2]
    ].filter(Boolean);

    return {
      title,
      role,
      setting,
      objective,
      openingMessage: generatedCase.openingMessage,
      standardOfCare,
      idealVitals: {
        heartRate: generatedCase.runtimeCategory === 'cardiac' ? 82 : generatedCase.runtimeCategory === 'shock' ? 88 : 90,
        oxygenSaturation: generatedCase.runtimeCategory === 'respiratory' ? 98 : 97,
        respiratoryRate: generatedCase.runtimeCategory === 'respiratory' ? 18 : generatedCase.runtimeCategory === 'seizure' ? 20 : 17,
        systolic: 118,
        diastolic: 76,
        temperatureCelsius: 37.0
      },
      initialProblems: this.problemSeeds(generatedCase),
      ecgBySeverity: this.ecgSeeds(generatedCase),
      estimatedTotalSteps: config.durationMinutes === 15 ? 9 : config.durationMinutes === 10 ? 7 : 5
    };
  }

  private problemSeeds(generatedCase: GeneratedClinicalCase): ClinicalGeneratedProfile['initialProblems'] {
    switch (generatedCase.runtimeCategory) {
      case 'shock':
        return {
          airway: { score: 76, decay: 0.18 },
          oxygenation: { score: 60, decay: 0.46 },
          perfusion: { score: generatedCase.severity.toLowerCase().includes('shock') ? 18 : 26, decay: 1.2 },
          rhythm: { score: 58, decay: 0.72 },
          monitoring: { score: 42, decay: 0.42 }
        };
      case 'cardiac':
        return {
          airway: { score: 80, decay: 0.12 },
          oxygenation: { score: 68, decay: 0.34 },
          perfusion: { score: 42, decay: 0.76 },
          rhythm: { score: 22, decay: 1.15 },
          monitoring: { score: 40, decay: 0.48 }
        };
      case 'seizure':
        return {
          airway: { score: 42, decay: 0.72 },
          oxygenation: { score: 40, decay: 1.02 },
          perfusion: { score: 62, decay: 0.4 },
          rhythm: { score: 56, decay: 0.46 },
          monitoring: { score: 36, decay: 0.52 }
        };
      default:
        return {
          airway: { score: 50, decay: 0.7 },
          oxygenation: { score: 38, decay: 1.08 },
          perfusion: { score: 58, decay: 0.44 },
          rhythm: { score: 74, decay: 0.28 },
          monitoring: { score: 40, decay: 0.42 }
        };
    }
  }

  private ecgSeeds(generatedCase: GeneratedClinicalCase): ClinicalGeneratedProfile['ecgBySeverity'] {
    if (generatedCase.runtimeCategory === 'cardiac') {
      if (generatedCase.diseaseKey === 'stemi') {
        return { stable: 'normal', concerning: 'stemi', unstable: 'stemi', critical: 'vtach' };
      }
      return { stable: 'normal', concerning: 'af', unstable: 'af', critical: 'vtach' };
    }

    if (generatedCase.runtimeCategory === 'shock') {
      return { stable: 'normal', concerning: 'normal', unstable: 'stemi', critical: 'vtach' };
    }

    return { stable: 'normal', concerning: 'normal', unstable: 'af', critical: 'vtach' };
  }
}
