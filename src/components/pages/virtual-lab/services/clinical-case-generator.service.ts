import { Injectable } from '@angular/core';
import { SimulationScenarioConfig } from '../models/virtual-lab.models';
import {
  ClinicalGenerationResult,
  ClinicalPhysiologyState,
  ClinicalSimulationState,
  ClinicalSpecialtyLens,
  ClinicalTreatmentId
} from './clinical-simulation.models';
import { ClinicalCaseLibraryService } from './clinical-case-library.service';

@Injectable({ providedIn: 'root' })
export class ClinicalCaseGeneratorService {
  constructor(private readonly library: ClinicalCaseLibraryService) {}

  generate(config: SimulationScenarioConfig): ClinicalGenerationResult {
    const context = this.library.createContext(config);
    const physiology = this.buildInitialPhysiology(context.config.difficulty, context.definition.basePhysiology, context.lens);
    const state: ClinicalSimulationState = {
      config,
      definition: context.definition,
      lens: context.lens,
      seed: context.seed,
      patientChart: context.definition.generatePatientChart(context),
      physiology,
      vitals: {
        heartRate: 0,
        respiratoryRate: 0,
        bloodPressureSystolic: 0,
        bloodPressureDiastolic: 0,
        oxygenSaturation: 0,
        temperatureCelsius: 0,
        mentalStatus: ''
      },
      severity: 'concerning',
      score: {
        history: 20,
        exam: 20,
        tests: 20,
        diagnosis: 20,
        treatment: 20,
        timing: 20,
        safety: 20
      },
      startedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      tickCount: 0,
      stepIndex: 1,
      estimatedTotalSteps: this.estimatedSteps(config),
      status: 'active',
      patientStableTicks: 0,
      requestedHistory: new Set(),
      requestedExams: new Map(context.definition.initialHighlightedExams(context).map((exam) => [exam.id as never, exam])),
      requestedInvestigations: new Map(),
      activeInterventions: new Map(),
      completedInterventions: new Set<ClinicalTreatmentId>(),
      diagnosticHypotheses: [],
      diagnosisAttempts: [],
      timeline: [{
        id: crypto.randomUUID(),
        timeLabel: this.timeLabel(0, config.language),
        title: config.language === 'ar' ? 'بداية الحالة' : 'Case Opened',
        detail: context.definition.overview[config.language],
        tone: 'neutral'
      }],
      mistakes: [],
      strengths: [],
      latestAlerts: [],
      latestFeedback: null,
      dosageCalculatorVisible: false,
      lastClinicianResponse: '',
      actionLog: []
    };

    state.vitals = state.definition.resolveVitals(state);
    state.severity = state.definition.resolveSeverity(state);
    state.diagnosticHypotheses = state.definition.buildDifferentials(state);
    state.latestAlerts = this.initialAlerts(state, context.lens);

    return { state, context };
  }

  private buildInitialPhysiology(
    difficulty: SimulationScenarioConfig['difficulty'],
    base: Partial<ClinicalPhysiologyState>,
    lens: ClinicalSpecialtyLens
  ): ClinicalPhysiologyState {
    const offset = difficulty === 'easy' ? -10 : difficulty === 'expert' ? 16 : difficulty === 'hard' ? 8 : 0;
    const scaled = lens.deteriorationMultiplier > 1.18 ? offset + 4 : offset;
    const create = (value?: number) => this.clamp((value || 0) + scaled, 0, 100);

    return {
      oxygenation: create(base.oxygenation),
      ventilation: create(base.ventilation),
      perfusion: create(base.perfusion),
      infection: create(base.infection),
      metabolic: create(base.metabolic),
      pain: create(base.pain),
      neurologic: create(base.neurologic),
      bleeding: create(base.bleeding),
      coronary: create(base.coronary),
      allergic: create(base.allergic)
    };
  }

  private estimatedSteps(config: SimulationScenarioConfig) {
    const difficultyBase = config.difficulty === 'easy' ? 6 : config.difficulty === 'hard' ? 9 : config.difficulty === 'expert' ? 10 : 8;
    const durationBonus = config.durationMinutes === 15 ? 4 : config.durationMinutes === 10 ? 2 : 0;
    return difficultyBase + durationBonus;
  }

  private initialAlerts(state: ClinicalSimulationState, lens: ClinicalSpecialtyLens) {
    const alerts: string[] = [];
    if (state.severity === 'critical') {
      alerts.push(state.config.language === 'ar'
        ? 'الحالة دخلت بدرجة عالية من الخطورة وتحتاج تدخلات فورية.'
        : 'The case opens in a high-risk state and needs immediate action.');
    }
    if (lens.id === 'emergency' || lens.id === 'icu') {
      alerts.push(state.config.language === 'ar'
        ? 'الوقت عامل حاسم؛ التأخير سيغيّر مسار المريض.'
        : 'Time matters; delay will change the patient course.');
    }
    return alerts;
  }

  private timeLabel(seconds: number, language: SimulationScenarioConfig['language']) {
    return language === 'ar' ? `+${seconds} ث` : `+${seconds}s`;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }
}
