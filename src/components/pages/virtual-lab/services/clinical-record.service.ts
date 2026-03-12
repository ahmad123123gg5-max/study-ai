import { Injectable, signal } from '@angular/core';
import {
  ClinicalProgressStats,
  ClinicalRecordSummary,
  GeneratedClinicalCase,
  ScenarioConfig,
  ScenarioDifficulty
} from '../models/virtual-lab.models';

interface ClinicalProgressResponse {
  items: ClinicalRecordSummary[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
  stats: ClinicalProgressStats;
}

interface NextClinicalCaseResponse {
  case: GeneratedClinicalCase;
  stats: ClinicalProgressStats;
}

interface SaveClinicalRecordResponse {
  record: ClinicalRecordSummary;
  stats: ClinicalProgressStats;
}

export interface PersistClinicalRecordInput {
  recordId?: string;
  caseId: string;
  signature: string;
  specialty: string;
  specialtyTrack: string;
  disease: string;
  difficulty: ScenarioDifficulty;
  score: number;
  status: 'completed' | 'failed';
  date: string;
  timeSpentSeconds: number;
  mistakes: string[];
  correctDecisions: string[];
  treatmentChoices: string[];
  title: string;
  caseDescription: string;
  finalEvaluation: string;
  educationalAnalysis: string;
  transcript: Array<{ role: 'assistant' | 'user' | 'system'; text: string; timestamp?: number }>;
  summary: Record<string, unknown> | null;
  generatedCase: GeneratedClinicalCase | null;
}

const EMPTY_STATS: ClinicalProgressStats = {
  totalCasesCompleted: 0,
  averageScore: 0,
  bestScore: 0,
  worstScore: 0,
  totalHoursPracticed: 0,
  mostPracticedSpecialty: 'None',
  specialtyBreakdown: [],
  levelTier: 'bronze',
  recommendedDifficulty: 'easy'
};

@Injectable({ providedIn: 'root' })
export class ClinicalRecordService {
  private readonly apiBase = '/api/virtual-lab';
  private readonly recordCache = new Map<string, ClinicalRecordSummary>();

  readonly progressItems = signal<ClinicalRecordSummary[]>([]);
  readonly stats = signal<ClinicalProgressStats>({ ...EMPTY_STATS });
  readonly total = signal(0);
  readonly hasMore = signal(false);
  readonly nextCursor = signal<string | null>(null);
  readonly activeReview = signal<ClinicalRecordSummary | null>(null);
  readonly loadingProgress = signal(false);
  readonly loadingReview = signal(false);
  readonly savingRecord = signal(false);

  async requestNextCase(config: ScenarioConfig, language: 'ar' | 'en'): Promise<GeneratedClinicalCase> {
    const response = await this.request<NextClinicalCaseResponse>(`${this.apiBase}/cases/next`, {
      method: 'POST',
      body: JSON.stringify({
        specialty: config.specialty,
        scenario: config.scenario,
        difficulty: config.difficulty,
        language
      })
    });

    this.stats.set(response.stats || { ...EMPTY_STATS });
    return response.case;
  }

  async saveRecord(input: PersistClinicalRecordInput): Promise<ClinicalRecordSummary> {
    this.savingRecord.set(true);
    try {
      const response = await this.request<SaveClinicalRecordResponse>(`${this.apiBase}/records`, {
        method: 'POST',
        body: JSON.stringify(input)
      });

      const saved = response.record;
      this.recordCache.set(saved.recordId, saved);
      this.recordCache.set(saved.caseId, saved);
      this.stats.set(response.stats || this.stats());

      if (this.progressItems().length > 0) {
        const nextItems = [saved, ...this.progressItems().filter((item) => item.caseId !== saved.caseId && item.recordId !== saved.recordId)];
        this.progressItems.set(nextItems);
        this.total.update((value) => Math.max(value, nextItems.length));
      }

      return saved;
    } finally {
      this.savingRecord.set(false);
    }
  }

  async loadProgress(reset: boolean = false, limit: number = 12): Promise<void> {
    if (this.loadingProgress()) {
      return;
    }

    if (!reset && this.progressItems().length > 0 && !this.hasMore()) {
      return;
    }

    this.loadingProgress.set(true);
    try {
      const cursor = reset ? null : this.nextCursor();
      const query = new URLSearchParams();
      query.set('limit', String(limit));
      if (cursor) {
        query.set('cursor', cursor);
      }

      const response = await this.request<ClinicalProgressResponse>(`${this.apiBase}/progress?${query.toString()}`, {
        method: 'GET'
      });

      const merged = reset
        ? response.items
        : [...this.progressItems(), ...response.items.filter((item) => !this.recordCache.has(item.recordId))];

      merged.forEach((item) => {
        this.recordCache.set(item.recordId, item);
        this.recordCache.set(item.caseId, item);
      });

      this.progressItems.set(merged);
      this.stats.set(response.stats || { ...EMPTY_STATS });
      this.total.set(response.total || merged.length);
      this.hasMore.set(Boolean(response.hasMore));
      this.nextCursor.set(response.nextCursor || null);
    } finally {
      this.loadingProgress.set(false);
    }
  }

  async loadReview(recordId: string): Promise<ClinicalRecordSummary | null> {
    if (!recordId.trim()) {
      this.activeReview.set(null);
      return null;
    }

    const cached = this.recordCache.get(recordId);
    if (cached) {
      this.activeReview.set(cached);
      return cached;
    }

    this.loadingReview.set(true);
    try {
      const response = await this.request<{ record: ClinicalRecordSummary; stats: ClinicalProgressStats }>(`${this.apiBase}/progress/${encodeURIComponent(recordId)}`, {
        method: 'GET'
      });

      this.recordCache.set(response.record.recordId, response.record);
      this.recordCache.set(response.record.caseId, response.record);
      this.activeReview.set(response.record);
      this.stats.set(response.stats || this.stats());
      return response.record;
    } finally {
      this.loadingReview.set(false);
    }
  }

  clearReview() {
    this.activeReview.set(null);
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {})
      }
    });

    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      const message = payload && typeof payload['error'] === 'string'
        ? payload.error
        : `Clinical request failed (${response.status})`;
      throw new Error(message);
    }

    return payload as T;
  }
}
