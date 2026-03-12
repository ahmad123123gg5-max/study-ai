import { Injectable } from '@angular/core';
import { ClinicalTimelineEvent, SimulationScenarioConfig } from '../models/virtual-lab.models';
import {
  ClinicalActionLogEntry,
  ClinicalSimulationState,
  ClinicalTreatmentId,
  ClinicalTreatmentResolution
} from './clinical-simulation.models';

export interface ClinicalTreatmentOutcome {
  message: string;
  resolution: ClinicalTreatmentResolution;
  logEntry: ClinicalActionLogEntry;
  timeline: ClinicalTimelineEvent;
}

@Injectable({ providedIn: 'root' })
export class ClinicalTreatmentEngineService {
  applyTreatment(state: ClinicalSimulationState, target: ClinicalTreatmentId): ClinicalTreatmentOutcome {
    const resolution = state.definition.applyTreatment(target, state);

    if (resolution.startIntervention) {
      state.activeInterventions.set(target, resolution.startIntervention);
    }
    if (resolution.stopInterventionId) {
      state.activeInterventions.delete(resolution.stopInterventionId);
    }
    if (resolution.applied) {
      state.completedInterventions.add(target);
      if (state.definition.expectations.keyTreatments.includes(target)) {
        state.score.treatment = this.clamp(state.score.treatment + (resolution.dangerous ? -6 : 14), 0, 100);
      }
    }
    if (resolution.scoreEffects) {
      for (const [key, value] of Object.entries(resolution.scoreEffects)) {
        const metric = key as keyof ClinicalSimulationState['score'];
        state.score[metric] = this.clamp(state.score[metric] + (value || 0), 0, 100);
      }
    }

    const timeline: ClinicalTimelineEvent = {
      id: crypto.randomUUID(),
      timeLabel: this.timeLabel(state.tickCount + 5, state.config.language),
      title: resolution.dangerous
        ? this.t(state.config.language, 'تدخل ضار', 'Harmful intervention')
        : this.t(state.config.language, 'تدخل علاجي', 'Therapeutic intervention'),
      detail: resolution.message,
      tone: resolution.dangerous ? 'critical' : resolution.alreadyActive ? 'neutral' : 'positive'
    };

    const logEntry: ClinicalActionLogEntry = {
      id: crypto.randomUUID(),
      kind: target === 'monitor' ? 'monitor' : 'treatment',
      label: resolution.message,
      detail: resolution.immediateEffects.join(' | ') || resolution.message,
      effectSummary: resolution.immediateEffects,
      createdAt: Date.now()
    };

    return {
      message: resolution.message,
      resolution,
      logEntry,
      timeline
    };
  }

  tick(state: ClinicalSimulationState) {
    state.tickCount += 1;

    const base = state.definition.deteriorationPerTick;
    const multiplier = state.lens.deteriorationMultiplier * (state.config.difficulty === 'easy' ? 0.82 : state.config.difficulty === 'hard' ? 1.14 : state.config.difficulty === 'expert' ? 1.22 : 1);

    for (const [dimension, value] of Object.entries(base)) {
      const key = dimension as keyof ClinicalSimulationState['physiology'];
      state.physiology[key] = this.clamp(state.physiology[key] + ((value || 0) * multiplier), 0, 100);
    }

    this.applyOngoingInterventions(state);
    this.applyDelayedBonuses(state);

    state.vitals = state.definition.resolveVitals(state);
    state.severity = state.definition.resolveSeverity(state);
    state.diagnosticHypotheses = state.definition.buildDifferentials(state);

    if (state.severity === 'stable') {
      state.patientStableTicks += 1;
      state.score.timing = this.clamp(state.score.timing + 2, 0, 100);
    } else {
      state.patientStableTicks = 0;
    }

    state.lastUpdatedAt = Date.now();
  }

  private applyOngoingInterventions(state: ClinicalSimulationState) {
    for (const [id] of state.activeInterventions.entries()) {
      switch (id) {
        case 'oxygen':
          state.physiology.oxygenation = this.clamp(state.physiology.oxygenation - 1.4, 0, 100);
          break;
        case 'iv-fluids':
          state.physiology.perfusion = this.clamp(state.physiology.perfusion - 1.2, 0, 100);
          break;
        case 'monitor':
          state.score.safety = this.clamp(state.score.safety + 0.4, 0, 100);
          break;
        default:
          break;
      }
    }
  }

  private applyDelayedBonuses(state: ClinicalSimulationState) {
    if (state.completedInterventions.has('antibiotics')) {
      state.physiology.infection = this.clamp(state.physiology.infection - 0.8, 0, 100);
    }
    if (state.completedInterventions.has('steroids')) {
      state.physiology.ventilation = this.clamp(state.physiology.ventilation - 0.4, 0, 100);
    }
    if (state.completedInterventions.has('oxytocin')) {
      state.physiology.bleeding = this.clamp(state.physiology.bleeding - 0.8, 0, 100);
    }
  }

  private timeLabel(seconds: number, language: SimulationScenarioConfig['language']) {
    return language === 'ar' ? `+${seconds} ث` : `+${seconds}s`;
  }

  private t(language: SimulationScenarioConfig['language'], arabic: string, english: string) {
    return language === 'ar' ? arabic : english;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }
}
