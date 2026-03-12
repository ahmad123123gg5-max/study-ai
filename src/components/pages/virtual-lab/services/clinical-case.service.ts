import { Injectable, isDevMode } from '@angular/core';
import { ClinicalAiCase, ScenarioConfig } from '../models/virtual-lab.models';

@Injectable({ providedIn: 'root' })
export class ClinicalCaseService {
  private readonly apiBase = '/api/clinical-simulation';

  async generateCase(config: ScenarioConfig, language: 'ar' | 'en'): Promise<ClinicalAiCase> {
    const requestId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const timestamp = Date.now();
    const seed = `${timestamp}-${Math.random().toString(36).slice(2)}-${requestId.slice(0, 8)}`;
    const requestedTopic = config.scenario?.trim() || '';

    if (typeof window !== 'undefined' && isDevMode()) {
      console.info('[clinical-simulation] generate-case request', {
        requestId,
        sessionId,
        timestamp,
        seed,
        specialty: config.specialty,
        requestedTopic,
        difficulty: config.difficulty
      });
    }

    const response = await fetch(`${this.apiBase}/generate-case?rid=${encodeURIComponent(requestId)}&ts=${timestamp}`, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        'X-Request-Id': requestId
      },
      body: JSON.stringify({
        requestId,
        sessionId,
        timestamp,
        seed,
        specialty: config.specialty,
        requestedTopic,
        difficulty: config.difficulty,
        language,
        learnerLevel: '',
        simulationMode: 'clinical-simulation',
        encounterType: '',
        patientAgePreference: '',
        patientGenderPreference: '',
        careSetting: '',
        focusArea: ''
      })
    });

    const payload = await response.json().catch(() => null) as { case?: ClinicalAiCase; error?: string } | null;
    if (!response.ok || !payload?.case) {
      throw new Error(payload?.error || `Clinical case generation failed (${response.status})`);
    }

    if (typeof window !== 'undefined' && isDevMode()) {
      console.info('[clinical-simulation] generate-case response', {
        requestId,
        sessionId,
        caseId: payload.case.caseId,
        specialty: payload.case.specialty,
        requestedTopic: payload.case.requestedTopic,
        difficulty: payload.case.difficulty
      });
    }

    return payload.case;
  }
}
