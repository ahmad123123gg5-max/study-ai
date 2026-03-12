import { Injectable, effect, signal } from '@angular/core';
import { SimulationScenarioConfig, VirtualLabRoute } from '../models/virtual-lab.models';

@Injectable({ providedIn: 'root' })
export class VirtualLabSessionService {
  private readonly simulationStorageKey = 'smartedge_virtual_lab_sim_config_v1';
  private readonly routeBase = '#dashboard/lab';

  readonly route = signal<VirtualLabRoute>('simulation-setup');
  readonly reviewRecordId = signal<string | null>(null);
  readonly simulationConfig = signal<SimulationScenarioConfig | null>(
    this.loadConfig()
  );

  constructor() {
    if (typeof window !== 'undefined') {
      this.syncRouteFromHash(window.location.hash);
      window.addEventListener('hashchange', this.handleHashChange);
    }

    effect(() => {
      this.persistConfig(this.simulationStorageKey, this.simulationConfig());
    });
  }

  resetToSetup() {
    this.reviewRecordId.set(null);
    this.routeTo('simulation-setup');
  }

  resetSimulationState() {
    this.reviewRecordId.set(null);
    this.simulationConfig.set(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.simulationStorageKey);
    }
  }

  openSimulationSession(config: SimulationScenarioConfig) {
    this.simulationConfig.set(config);
    this.reviewRecordId.set(null);
    this.routeTo('simulation-session');
  }

  resumeSimulationSession() {
    if (!this.simulationConfig()) {
      return;
    }
    this.reviewRecordId.set(null);
    this.routeTo('simulation-session');
  }

  openProgressPage() {
    this.reviewRecordId.set(null);
    this.routeTo('simulation-progress');
  }

  openReviewPage(recordId: string) {
    this.reviewRecordId.set(recordId.trim() || null);
    this.routeTo('simulation-review');
  }

  routeTo(route: VirtualLabRoute, replaceState: boolean = true) {
    this.route.set(route);
    this.syncHash(route, replaceState);
  }

  private readonly handleHashChange = () => {
    this.syncRouteFromHash(window.location.hash);
  };

  private syncRouteFromHash(hash: string) {
    const nextRoute = this.parseHash(hash);
    if (nextRoute) {
      this.route.set(nextRoute);
    }
  }

  private parseHash(hash: string): VirtualLabRoute | null {
    const normalized = hash.replace(/^#/, '').trim().toLowerCase();
    if (!normalized.startsWith('dashboard/lab')) {
      return null;
    }

    if (normalized.startsWith('dashboard/lab/simulation/session')) {
      this.reviewRecordId.set(null);
      return 'simulation-session';
    }

    if (normalized.startsWith('dashboard/lab/progress/review/')) {
      const reviewId = normalized.slice('dashboard/lab/progress/review/'.length).trim();
      this.reviewRecordId.set(reviewId || null);
      return 'simulation-review';
    }

    if (normalized.startsWith('dashboard/lab/progress')) {
      this.reviewRecordId.set(null);
      return 'simulation-progress';
    }

    this.reviewRecordId.set(null);
    return 'simulation-setup';
  }

  private syncHash(route: VirtualLabRoute, replaceState: boolean) {
    if (typeof window === 'undefined') {
      return;
    }

    const nextHash = this.buildHash(route);
    if ((window.location.hash || '') === nextHash) {
      return;
    }

    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
    if (replaceState) {
      window.history.replaceState({}, document.title, nextUrl);
      return;
    }

    window.history.pushState({}, document.title, nextUrl);
  }

  private buildHash(route: VirtualLabRoute): string {
    switch (route) {
      case 'simulation-session':
        return `${this.routeBase}/simulation/session`;
      case 'simulation-progress':
        return `${this.routeBase}/progress`;
      case 'simulation-review':
        return `${this.routeBase}/progress/review/${encodeURIComponent(this.reviewRecordId() || '')}`;
      default:
        return this.routeBase;
    }
  }

  private loadConfig(): SimulationScenarioConfig | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = localStorage.getItem(this.simulationStorageKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const specialty = typeof parsed.specialty === 'string' ? parsed.specialty.trim() : '';
      const scenario = typeof parsed.scenario === 'string' ? parsed.scenario.trim() : '';
      const difficulty = parsed.difficulty === 'easy' || parsed.difficulty === 'medium' || parsed.difficulty === 'hard' || parsed.difficulty === 'expert'
        ? parsed.difficulty
        : 'medium';
      const durationMinutes = parsed.durationMinutes === 5 || parsed.durationMinutes === 10 || parsed.durationMinutes === 15
        ? parsed.durationMinutes
        : 10;
      const language = parsed.language === 'ar' ? 'ar' : 'en';
      const generatedCase = parsed.generatedCase && typeof parsed.generatedCase === 'object'
        ? parsed.generatedCase as SimulationScenarioConfig['generatedCase']
        : null;
      const clinicalCase = parsed.clinicalCase && typeof parsed.clinicalCase === 'object'
        ? parsed.clinicalCase as SimulationScenarioConfig['clinicalCase']
        : null;

      if (!specialty) {
        return null;
      }

      return {
        specialty,
        scenario,
        difficulty,
        durationMinutes,
        language,
        generatedCase,
        clinicalCase,
        referenceImages: []
      };
    } catch {
      return null;
    }
  }

  private persistConfig(storageKey: string, config: SimulationScenarioConfig | null) {
    if (typeof window === 'undefined') {
      return;
    }

    if (!config) {
      localStorage.removeItem(storageKey);
      return;
    }

    const persistedConfig: SimulationScenarioConfig = {
      ...config,
      referenceImages: []
    };

    localStorage.setItem(storageKey, JSON.stringify(persistedConfig));
  }
}
