import { Injectable, signal } from '@angular/core';
import {
  APP_LANGUAGE_STORAGE_KEY,
  LEGACY_LANGUAGE_STORAGE_KEY,
  LanguageCode,
  normalizeLanguageCode
} from '../i18n/language-config';

type UserPlan = 'free' | 'pro';
type PremiumSource = 'promo_code' | 'paid' | 'permanent' | null;

export interface UserProfile {
  name?: string;
  email?: string | null;
  xp: number;
  level: number;
  role: 'student' | 'teacher' | 'admin';
  plan?: UserPlan;
  subscriptionPlan?: UserPlan;
  subscriptionStatus?: 'active' | 'inactive';
  premiumSource?: PremiumSource;
  proAccessStartAt?: string | null;
  proAccessEndAt?: string | null;
  hasUsedPromoTrial?: boolean;
  promoCodeUsed?: string | null;
  createdAt?: string;
  preferredLanguage?: LanguageCode;
}

interface ServerUser {
  id: string;
  email: string;
  name: string;
  xp: number;
  level: number;
  plan?: UserPlan;
  subscriptionPlan?: UserPlan;
  subscriptionStatus?: 'active' | 'inactive';
  premiumSource?: PremiumSource;
  proAccessStartAt?: string | null;
  proAccessEndAt?: string | null;
  hasUsedPromoTrial?: boolean;
  promoCodeUsed?: string | null;
  unlockedAchievements: string[];
  history: unknown[];
  preferredLanguage?: LanguageCode;
}

interface OAuthPopupMessage {
  source?: string;
  status?: 'success' | 'error';
  provider?: 'google';
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API_BASE = this.resolveApiBase();
  private readonly AUTH_API_BASE = `${this.API_BASE}/auth`;
  private readonly USER_API_BASE = `${this.API_BASE}/user`;

  // Retained for compatibility with existing templates. Real auth mode is always used.
  isMockMode = signal(false);

  currentUser = signal<{ id: string; email: string; name: string } | null>(null);
  userProfile = signal<UserProfile | null>(null);

  constructor() {
    void this.refreshSession().catch((error) => {
      console.error('Failed to restore session:', error);
    });
  }

  private resolveApiBase(): string {
    return '/api';
  }

  private getStoredRole(): UserProfile['role'] {
    const role = localStorage.getItem('smartedge_user_role');
    if (role === 'teacher' || role === 'admin') {
      return role;
    }
    return 'student';
  }

  private applyAuthState(user: ServerUser | null): void {
    if (!user) {
      this.currentUser.set(null);
      this.userProfile.set(null);
      return;
    }

    const role = this.getStoredRole();
    const plan: UserPlan = user.plan === 'pro' ? 'pro' : 'free';
    localStorage.setItem('smartedge_user_plan', plan);
    const language = normalizeLanguageCode(user.preferredLanguage);
    localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
    localStorage.setItem(LEGACY_LANGUAGE_STORAGE_KEY, language);
    this.currentUser.set({
      id: user.id,
      email: user.email,
      name: user.name
    });
    this.userProfile.set({
      name: user.name,
      email: user.email,
      xp: Number.isFinite(user.xp) ? user.xp : 0,
      level: Number.isFinite(user.level) ? Math.max(1, user.level) : 1,
      role,
      plan,
      subscriptionPlan: user.subscriptionPlan === 'pro' ? 'pro' : 'free',
      subscriptionStatus: user.subscriptionStatus === 'active' ? 'active' : 'inactive',
      premiumSource: user.premiumSource || null,
      proAccessStartAt: user.proAccessStartAt || null,
      proAccessEndAt: user.proAccessEndAt || null,
      hasUsedPromoTrial: Boolean(user.hasUsedPromoTrial),
      promoCodeUsed: user.promoCodeUsed || null,
      preferredLanguage: normalizeLanguageCode(user.preferredLanguage)
    });
  }

  private async parseJson<T>(response: Response): Promise<T | null> {
    try {
      return await response.json() as T;
    } catch {
      return null;
    }
  }

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {})
      }
    });

    const payload = await this.parseJson<Record<string, unknown>>(response);

    if (!response.ok) {
      const message =
        payload && typeof payload['error'] === 'string'
          ? payload.error
          : `Request failed (${response.status})`;
      throw new Error(message);
    }

    return payload as T;
  }

  async refreshSession(): Promise<{ id: string; email: string; name: string } | null> {
    const response = await fetch(`${this.AUTH_API_BASE}/me`, {
      method: 'GET',
      credentials: 'include'
    });

    if (response.status === 401) {
      this.applyAuthState(null);
      return null;
    }

    const payload = await this.parseJson<{ user?: ServerUser; error?: string }>(response);

    if (!response.ok) {
      this.applyAuthState(null);
      throw new Error(payload?.error || `Session check failed (${response.status})`);
    }

    const user = payload?.user || null;
    this.applyAuthState(user);
    return this.currentUser();
  }

  async signUp(email: string, pass: string, name: string): Promise<{ user: { id: string; email: string; name: string } }> {
    const payload = await this.request<{ user: ServerUser }>(`${this.AUTH_API_BASE}/signup`, {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: pass,
        name
      })
    });

    this.applyAuthState(payload.user);
    return { user: this.currentUser()! };
  }

  async signIn(email: string, pass: string): Promise<{ user: { id: string; email: string; name: string } }> {
    const payload = await this.request<{ user: ServerUser }>(`${this.AUTH_API_BASE}/login`, {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: pass
      })
    });

    this.applyAuthState(payload.user);
    return { user: this.currentUser()! };
  }

  async loginWithGoogle(): Promise<{ id: string; email: string; name: string }> {
    return new Promise((resolve, reject) => {
      const width = 520;
      const height = 680;
      const left = Math.max(0, Math.floor((window.screen.width - width) / 2));
      const top = Math.max(0, Math.floor((window.screen.height - height) / 2));
      const popup = window.open(
        `${this.AUTH_API_BASE}/oauth/google/start?origin=${encodeURIComponent(window.location.origin)}`,
        'studyvex-google-auth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        reject(new Error('Failed to open Google login window. Please allow popups and try again.'));
        return;
      }

      let finished = false;

      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        window.clearInterval(popupWatcher);
        window.clearTimeout(timeoutId);
      };

      const onFailure = (message: string) => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(new Error(message));
      };

      const wait = (ms: number) => new Promise<void>((done) => window.setTimeout(done, ms));
      const refreshSessionWithRetry = async (): Promise<{ id: string; email: string; name: string } | null> => {
        const delays = [0, 250, 600, 1200];
        for (let attempt = 0; attempt < delays.length; attempt += 1) {
          if (delays[attempt] > 0) {
            await wait(delays[attempt]);
          }
          const user = await this.refreshSession().catch(() => null);
          if (user) {
            return user;
          }
        }
        return null;
      };

      const onMessage = async (event: MessageEvent<OAuthPopupMessage>) => {
        const data = event.data;
        if (!data || data.source !== 'studyvex-oauth' || data.provider !== 'google') {
          return;
        }

        if (finished) return;
        finished = true;
        cleanup();

        if (data.status !== 'success') {
          reject(new Error(data.message || 'Google login failed'));
          return;
        }

        try {
          const user = await refreshSessionWithRetry();
          if (!user) {
            throw new Error('Google login completed but session was not created');
          }
          resolve(user);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Failed to restore session after Google login'));
        }
      };

      window.addEventListener('message', onMessage);

      const popupWatcher = window.setInterval(() => {
        if (finished) return;
        if (popup.closed) {
          onFailure('Google login window was closed before completing sign-in');
        }
      }, 400);

      const timeoutId = window.setTimeout(() => {
        onFailure('Google login timed out. Please try again.');
      }, 2 * 60 * 1000);
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request<{ success: boolean }>(`${this.AUTH_API_BASE}/logout`, {
        method: 'POST'
      });
    } finally {
      this.applyAuthState(null);
    }
  }

  async changePassword(currentPass: string, newPass: string): Promise<void> {
    await this.request<{ success: boolean }>(`${this.AUTH_API_BASE}/change-password`, {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: currentPass,
        newPassword: newPass
      })
    });
  }

  async updateProfile(data: Partial<UserProfile>): Promise<void> {
    if (!this.currentUser()) {
      return;
    }

    const payload: Record<string, unknown> = {};

    if (typeof data.name === 'string' && data.name.trim()) {
      payload['name'] = data.name.trim();
    }
    if (typeof data.xp === 'number' && Number.isFinite(data.xp)) {
      payload['xp'] = Math.max(0, Math.floor(data.xp));
    }
    if (typeof data.level === 'number' && Number.isFinite(data.level)) {
      payload['level'] = Math.max(1, Math.floor(data.level));
    }
    if (typeof data.preferredLanguage === 'string' && data.preferredLanguage.trim()) {
      payload['preferredLanguage'] = normalizeLanguageCode(data.preferredLanguage);
    }
    if (data.role) {
      localStorage.setItem('smartedge_user_role', data.role);
    }

    if (Object.keys(payload).length === 0) {
      const current = this.userProfile();
      if (current && data.role) {
        this.userProfile.set({ ...current, role: data.role });
      }
      return;
    }

    const response = await this.request<{ user: ServerUser }>(`${this.USER_API_BASE}/data`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    this.applyAuthState(response.user);
    if (data.role && this.userProfile()) {
      this.userProfile.set({
        ...this.userProfile()!,
        role: data.role
      });
    }
  }
}
