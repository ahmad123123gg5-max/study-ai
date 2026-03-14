
import { Injectable, signal, effect, inject } from '@angular/core';
import { AuthService } from './auth.service';
import {
  GroundingMetadata,
  AIChatRequestOptions,
  AIChatResponsePayload
} from './grounding.models';
import {
  getLanguageName,
  getSpeechRecognitionLocale,
  normalizeLanguageCode,
  LanguageCode,
  DEFAULT_LANGUAGE
} from '../i18n/language-config';

import { NotificationService } from '../services/notification.service';

export interface BookMetadata {
  id: string;
  title: string;
  subtitle?: string;
  authors: string[];
  description: string;
  isbn10?: string;
  isbn13: string;
  publisher: string;
  publicationYear: number;
  language: string;
  pageCount: number;
  categories: string[];
  coverImage: string;
  previewLink?: string;
  isPublicDomain: boolean;
  rating: number;
}

export interface TutorConversationRecord {
  timestamp: string;
  userMessage: string;
  aiResponse: string;
  studentName: string;
  topic: string;
}

// Fixed missing exports for Planner and Conversation pages
export interface StudyPlanTask {
  durationMinutes: number;
  topic: string;
  type: string;
  importance: 'high' | 'medium' | 'low';
}

export interface StudyPlanDay {
  day: string;
  tasks: StudyPlanTask[];
  dailyHours: number;
  isFinished: boolean;
  completedTaskCount: number;
  uncompletedTaskCount: number;
}

export interface LanguageCorrection {
  original: string;
  corrected: string;
  explanation: string;
  pronunciationTips: string;
}

export interface AcademicResearchSource {
  title: string;
  uri: string;
  publisher?: string;
  year?: string;
  credibilityNote?: string;
}

export interface AcademicResearchSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface AcademicResearchTable {
  title: string;
  columns: string[];
  rows: string[][];
  summary?: string;
}

export interface AcademicResearchResult {
  title: string;
  executiveSummary: string;
  sections: AcademicResearchSection[];
  tables: AcademicResearchTable[];
  conclusion: string;
  sources: AcademicResearchSource[];
  text: string;
}

export interface ClinicalCase {
  vitals: { bp: string; heartRate: number; temp: number };
  patientInfo: string;
  questions: { options: string[]; answer: number }[];
}

export type QuizQuestionType = 'mcq' | 'true_false';
export type QuizDifficulty = 'easy' | 'medium' | 'hard' | 'legendary';

export interface QuizQuestion {
  id: string;
  q: string;
  o: string[];
  a: number;
  e: string;
  t?: QuizQuestionType;
}

export type LabScenarioDifficulty = 'easy' | 'medium' | 'hard';
export type LabScenarioConsequenceLevel = 'positive' | 'warning' | 'critical';
export type LabScenarioReadingStatus = 'normal' | 'watch' | 'critical';

export interface LabScenarioReading {
  label: string;
  value: string;
  note?: string;
  status: LabScenarioReadingStatus;
}

export interface LabScenarioChoice {
  id: string;
  text: string;
  outcome: string;
  nextStepId: string | null;
  scoreImpact: number;
  consequenceLevel: LabScenarioConsequenceLevel;
}

export interface LabScenarioStep {
  id: string;
  title: string;
  situation: string;
  decisionPrompt: string;
  readings: LabScenarioReading[];
  choices: LabScenarioChoice[];
}

export interface LabScenarioEvaluation {
  summary: string;
  strengths: string[];
  improvements: string[];
  recommendedAction: string;
}

export interface LabScenarioItem {
  name: string;
  icon: string;
  role?: string;
}

export interface LabScenario {
  title: string;
  description: string;
  environment: string;
  openingSituation: string;
  imagePrompt: string;
  difficulty: LabScenarioDifficulty;
  steps: LabScenarioStep[];
  items: LabScenarioItem[];
  finalEvaluation: LabScenarioEvaluation;
  passingScore: number;
}

export interface SubjectLevel {
  name: string;
  level: number;
  xp: number;
  importance?: 'high' | 'medium' | 'low';
}

export interface PerformanceRecord {
  date: string;
  score: number;
  type: 'simulation' | 'study' | 'quiz';
  subject?: string;
  grade?: string;
}

export interface UsageStats {
  aiTeacherQuestions: number;
  smartTests: number;
  virtualLabSimulations: number;
  academicResearch: number;
  contentLabConversions: number;
  lastResetDate: string;
}

export type FeatureFlag = 'aiExam';

export type XPActionType =
  | 'aiTutorChat'
  | 'flashcards'
  | 'mindmap'
  | 'studyPlan'
  | 'virtualLabSimulation'
  | 'academicResearch'
  | 'contentLab'
  | 'quizAttempt'
  | 'smartTimerMinute';

export interface XPRewardOptions {
  fingerprint?: string;
  cooldownMs?: number;
  allowNegative?: boolean;
}

export type UserPlan = 'free' | 'pro';

export interface AIFileAttachment {
  data: string;
  mimeType: string;
  name?: string;
}

export interface ImprovementPlan {
  weakPoints: Array<{
    topic: string;
    page?: number;
    slide?: number;
    part?: string;
    explanation: string;
    visualPrompt?: string;
    visualUrl?: string;
  }>;
  overallAdvice: string;
  nextSteps: string[];
}

type ChatHistoryEntry = {
  role: string;
  parts: { text?: string; inlineData?: { data: string; mimeType: string } }[];
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const UNLIMITED_USAGE_EMAILS = new Set<string>([
  normalizeEmail('ahmad123123gg5@gmail.com')
]);

@Injectable({ providedIn: 'root' })
export class AIService {
  // Profile Signals
  userName = signal<string>(localStorage.getItem('smartedge_user_name') || 'أحمد العتيبي');
  userEmail = signal<string>(localStorage.getItem('smartedge_user_email') || 'ahmed@example.com');
  specialization = signal<string>(localStorage.getItem('smartedge_specialization') || '');
  bio = signal<string>(localStorage.getItem('smartedge_bio') || '');
  link = signal<string>(localStorage.getItem('smartedge_link') || '');
  profileImage = signal<string>(localStorage.getItem('smartedge_profile_image') || '');
  coverImage = signal<string>(localStorage.getItem('smartedge_cover_image') || '');
  
  // Privacy Signals
  isPublicProfile = signal<boolean>(localStorage.getItem('smartedge_is_public') !== 'false');
  shareStats = signal<boolean>(localStorage.getItem('smartedge_share_stats') === 'true');
  
  currentSubjects = signal<SubjectLevel[]>([]);
  quizzesCompleted = signal<number>(0);
  simulationsCompleted = signal<number>(0);
  totalStudyHours = signal<number>(0);
  performanceHistory = signal<PerformanceRecord[]>([]);

  currentLanguage = signal<LanguageCode>(normalizeLanguageCode(localStorage.getItem('smartedge_user_lang') || DEFAULT_LANGUAGE));
  lastGrounding = signal<GroundingMetadata | null>(null);

  saveProfile() {
    localStorage.setItem('smartedge_user_name', this.userName());
    localStorage.setItem('smartedge_user_email', this.userEmail());
    localStorage.setItem('smartedge_specialization', this.specialization());
    localStorage.setItem('smartedge_bio', this.bio());
    localStorage.setItem('smartedge_link', this.link());
    localStorage.setItem('smartedge_profile_image', this.profileImage());
    localStorage.setItem('smartedge_cover_image', this.coverImage());
    localStorage.setItem('smartedge_is_public', String(this.isPublicProfile()));
    localStorage.setItem('smartedge_share_stats', String(this.shareStats()));
    localStorage.setItem('smartedge_user_lang', normalizeLanguageCode(this.currentLanguage()));
    
    this.ns.show(
      this.currentLanguage() === 'ar' ? 'تم الحفظ' : 'Saved',
      this.currentLanguage() === 'ar' ? 'تم تحديث إعداداتك بنجاح' : 'Your settings have been updated successfully',
      'success'
    );
  }
  
  private auth = inject(AuthService);
  private ns = inject(NotificationService);

  // سجلات المحادثات للمعلم
  tutorConversationHistory = signal<TutorConversationRecord[]>([]);

  // Gamification State - Initialized to 0 and persisted
  userXP = signal<number>(0);
  userLevel = signal<number>(1);
  lastLevelUp = signal<number | null>(null);
  userRole = signal<'student' | 'teacher' | 'admin'>('student');

  // Subscription State
  userPlan = signal<UserPlan>('free');
  usageStats = signal<UsageStats>({
    aiTeacherQuestions: 0,
    smartTests: 0,
    virtualLabSimulations: 0,
    academicResearch: 0,
    contentLabConversions: 0,
    lastResetDate: new Date().toDateString()
  });

  private readonly legacyLevelXp = [0, 50, 150, 350, 750, 1750, 3750, 7750, 15750, 31750];
  private readonly xpThresholdCache = new Map<number, number>();
  private readonly xpFingerprintTtlMs = 5 * 60 * 1000;
  private readonly xpActionCooldowns: Record<XPActionType, number> = {
    aiTutorChat: 20_000,
    flashcards: 12_000,
    mindmap: 12_000,
    studyPlan: 15_000,
    virtualLabSimulation: 5_000,
    academicResearch: 10_000,
    contentLab: 8_000,
    quizAttempt: 10_000,
    smartTimerMinute: 55_000
  };
  private xpActionTimestamps = new Map<XPActionType, number>();
  private xpFingerprintHistory = new Map<string, number>();
  private readonly featureFlags: Record<FeatureFlag, boolean> = {
    aiExam: false
  };

  constructor() {
    // Load local data as fallback
    const localXP = parseInt(localStorage.getItem('smartedge_user_xp') || '0');
    const localLevel = parseInt(localStorage.getItem('smartedge_user_level') || '1');
    const localRole = (localStorage.getItem('smartedge_user_role') as 'student' | 'teacher' | 'admin') || 'student';
    
    this.userXP.set(localXP);
    this.userLevel.set(localLevel);
    this.userRole.set(localRole);

    // Load Subscription Data
    const localPlan = (localStorage.getItem('smartedge_user_plan') as UserPlan) || 'free';
    const localUsage = localStorage.getItem('smartedge_usage_stats');
    this.userPlan.set(localPlan);
    if (localUsage) {
      const stats = JSON.parse(localUsage) as Partial<UsageStats>;
      // Check for daily reset
      if (stats.lastResetDate !== new Date().toDateString()) {
        this.usageStats.set({
          aiTeacherQuestions: 0,
          smartTests: 0,
          virtualLabSimulations: 0,
          academicResearch: 0,
          contentLabConversions: 0,
          lastResetDate: new Date().toDateString()
        });
      } else {
        this.usageStats.set({
          aiTeacherQuestions: Number(stats.aiTeacherQuestions || 0),
          smartTests: Number(stats.smartTests || 0),
          virtualLabSimulations: Number(stats.virtualLabSimulations || 0),
          academicResearch: Number(stats.academicResearch || 0),
          contentLabConversions: Number(stats.contentLabConversions || 0),
          lastResetDate: typeof stats.lastResetDate === 'string' ? stats.lastResetDate : new Date().toDateString()
        });
      }
    }

    // Load Profile Data
    this.userName.set(localStorage.getItem('smartedge_user_name') || 'أحمد العتيبي');
    this.userEmail.set(localStorage.getItem('smartedge_user_email') || 'ahmed@example.com');
    this.specialization.set(localStorage.getItem('smartedge_specialization') || '');
    this.bio.set(localStorage.getItem('smartedge_bio') || '');
    this.link.set(localStorage.getItem('smartedge_link') || '');
    this.profileImage.set(localStorage.getItem('smartedge_profile_image') || '');
    this.coverImage.set(localStorage.getItem('smartedge_cover_image') || '');
    this.isPublicProfile.set(localStorage.getItem('smartedge_is_public') !== 'false');
    this.shareStats.set(localStorage.getItem('smartedge_share_stats') === 'true');
    this.currentLanguage.set(normalizeLanguageCode(localStorage.getItem('smartedge_user_lang') || DEFAULT_LANGUAGE));
    
    const localSubjects = localStorage.getItem('smartedge_subjects');
    if (localSubjects) this.currentSubjects.set(JSON.parse(localSubjects));

    this.quizzesCompleted.set(parseInt(localStorage.getItem('smartedge_quiz_count') || '0'));
    this.simulationsCompleted.set(parseInt(localStorage.getItem('smartedge_sims_count') || '0'));
    this.totalStudyHours.set(parseFloat(localStorage.getItem('smartedge_study_hours') || '0'));
    const localHistory = localStorage.getItem('smartedge_performance_history');
    if (localHistory) {
      const parsedHistory = JSON.parse(localHistory) as Array<PerformanceRecord | { type?: string }>;
      this.performanceHistory.set(
        parsedHistory.filter((record): record is PerformanceRecord =>
          record.type === 'simulation' || record.type === 'study' || record.type === 'quiz'
        )
      );
    }

    // Sync with AuthService profile
    effect(() => {
      const profile = this.auth.userProfile();
      if (profile) {
        if (this.userXP() !== (profile.xp || 0)) this.userXP.set(profile.xp || 0);
        if (this.userLevel() !== (profile.level || 1)) this.userLevel.set(profile.level || 1);
        if (this.userRole() !== (profile.role || 'student')) this.userRole.set(profile.role || 'student');
        if ((profile.plan === 'pro' || profile.plan === 'free') && this.userPlan() !== profile.plan) {
          this.userPlan.set(profile.plan);
        }
        if (profile.name) this.userName.set(profile.name);
        if (profile.email) this.userEmail.set(profile.email);
        if (profile.preferredLanguage && this.currentLanguage() !== profile.preferredLanguage) {
          this.currentLanguage.set(normalizeLanguageCode(profile.preferredLanguage));
        }
      }
    });

    // Persist changes to Firestore if logged in, otherwise localStorage
    effect(() => {
      const xp = this.userXP();
      const level = this.userLevel();
      const role = this.userRole();

      localStorage.setItem('smartedge_user_xp', xp.toString());
      localStorage.setItem('smartedge_user_level', level.toString());
      localStorage.setItem('smartedge_user_role', role);

      // Persist Subscription Data
      localStorage.setItem('smartedge_user_plan', this.userPlan());
      localStorage.setItem('smartedge_usage_stats', JSON.stringify(this.usageStats()));

      // Persist Profile Data
      localStorage.setItem('smartedge_user_name', this.userName());
      localStorage.setItem('smartedge_user_email', this.userEmail());
      localStorage.setItem('smartedge_specialization', this.specialization());
      localStorage.setItem('smartedge_bio', this.bio());
      localStorage.setItem('smartedge_link', this.link());
      localStorage.setItem('smartedge_profile_image', this.profileImage());
      localStorage.setItem('smartedge_cover_image', this.coverImage());
      localStorage.setItem('smartedge_is_public', this.isPublicProfile().toString());
      localStorage.setItem('smartedge_share_stats', this.shareStats().toString());
      localStorage.setItem('smartedge_user_lang', normalizeLanguageCode(this.currentLanguage()));
      
      localStorage.setItem('smartedge_subjects', JSON.stringify(this.currentSubjects()));
      localStorage.setItem('smartedge_quiz_count', this.quizzesCompleted().toString());
      localStorage.setItem('smartedge_sims_count', this.simulationsCompleted().toString());
      localStorage.setItem('smartedge_study_hours', this.totalStudyHours().toString());
      localStorage.setItem('smartedge_performance_history', JSON.stringify(this.performanceHistory()));

      if (this.auth.currentUser()) {
        const currentProfile = this.auth.userProfile();
        if (currentProfile && (currentProfile.xp !== xp || currentProfile.level !== level || currentProfile.role !== role)) {
          this.auth.updateProfile({ xp, level, role });
        }
      }
    });
  }

  addPerformanceRecord(record: PerformanceRecord) {
    this.performanceHistory.update(h => [record, ...h].slice(0, 50));
  }

  updateSubjectXP(subjectName: string, xpAmount: number) {
    this.currentSubjects.update(subjects => {
      return subjects.map(s => {
        if (s.name === subjectName) {
          const newXP = s.xp + xpAmount;
          const newLevel = Math.floor(newXP / 100) + 1;
          return { ...s, xp: newXP, level: newLevel };
        }
        return s;
      });
    });
  }

  getXPRequiredForLevel(level: number): number {
    const normalizedLevel = Math.max(1, Math.floor(level));
    const legacyIndex = normalizedLevel - 1;
    if (legacyIndex < this.legacyLevelXp.length) {
      return this.legacyLevelXp[legacyIndex];
    }

    const cached = this.xpThresholdCache.get(normalizedLevel);
    if (cached !== undefined) {
      return cached;
    }

    const lastLegacyLevel = this.legacyLevelXp.length;
    let xp = this.legacyLevelXp[lastLegacyLevel - 1];
    const extraLevels = normalizedLevel - lastLegacyLevel;
    for (let offset = 1; offset <= extraLevels; offset += 1) {
      xp += this.computeExtraLevelIncrement(offset);
    }

    this.xpThresholdCache.set(normalizedLevel, xp);
    return xp;
  }

  getNextLevelXP(): number {
    return this.getXPRequiredForLevel(this.userLevel() + 1);
  }

  getProgressToNextLevel(): number {
    const currentLevel = this.userLevel();
    const currentXp = this.getXPRequiredForLevel(currentLevel);
    const nextXp = this.getXPRequiredForLevel(currentLevel + 1);
    const delta = Math.max(1, nextXp - currentXp);
    const progress = (this.userXP() - currentXp) / delta;
    return Math.min(1, Math.max(0, progress));
  }

  private addXP(amount: number) {
    if (!Number.isFinite(amount) || amount === 0) {
      return;
    }

    this.userXP.update((xp) => {
      const newXP = xp + amount;
      let nextLevel = this.userLevel();
      let nextThreshold = this.getXPRequiredForLevel(nextLevel + 1);

      while (newXP >= nextThreshold) {
        nextLevel += 1;
        this.userLevel.set(nextLevel);
        this.lastLevelUp.set(nextLevel);
        setTimeout(() => this.lastLevelUp.set(null), 5000);
        nextThreshold = this.getXPRequiredForLevel(nextLevel + 1);
      }

      return newXP;
    });
  }

  awardXPForAction(action: XPActionType, amount: number, options: XPRewardOptions = {}): boolean {
    if (!Number.isFinite(amount) || amount === 0) {
      return false;
    }

    if (amount < 0 && !options.allowNegative) {
      return false;
    }

    const now = Date.now();
    const cooldown = Math.max(0, options.cooldownMs ?? this.xpActionCooldowns[action] ?? 0);
    const lastAction = this.xpActionTimestamps.get(action) || 0;
    if (now - lastAction < cooldown) {
      return false;
    }

    const fingerprint = options.fingerprint;
    if (fingerprint) {
      const lastFingerprint = this.xpFingerprintHistory.get(fingerprint);
      if (lastFingerprint && now - lastFingerprint < this.xpFingerprintTtlMs) {
        return false;
      }
      this.xpFingerprintHistory.set(fingerprint, now);
    }

    this.xpActionTimestamps.set(action, now);
    this.pruneExpiredFingerprints();
    this.addXP(amount);
    return true;
  }

  private pruneExpiredFingerprints() {
    const now = Date.now();
    for (const [key, timestamp] of this.xpFingerprintHistory.entries()) {
      if (now - timestamp > this.xpFingerprintTtlMs) {
        this.xpFingerprintHistory.delete(key);
      }
    }
  }

  private computeExtraLevelIncrement(offset: number): number {
    const base = 850;
    const curve = 1.18;
    const earlyBoost = Math.max(0, 380 - offset * 18);
    return Math.floor(base * Math.pow(offset, curve) + earlyBoost);
  }

  resetProgress() {
    this.userXP.set(0);
    this.userLevel.set(1);
  }

  resetXP() {
    this.userXP.set(0);
  }

  hasUnlimitedUsageAccess(): boolean {
    return UNLIMITED_USAGE_EMAILS.has(normalizeEmail(this.userEmail()));
  }

  isFeatureEnabled(flag: FeatureFlag): boolean {
    return Boolean(this.featureFlags[flag]);
  }

  getRemainingAttempts(feature: keyof Omit<UsageStats, 'lastResetDate'>): number {
    if (this.hasUnlimitedUsageAccess()) {
      return Number.POSITIVE_INFINITY;
    }

    const plan = this.userPlan();
    const stats = this.usageStats();
    const current = stats[feature];

    const limits = {
      free: {
        aiTeacherQuestions: 7,
        smartTests: 1,
        virtualLabSimulations: 1,
        academicResearch: 1,
        contentLabConversions: 1
      },
      pro: {
        aiTeacherQuestions: 30,
        smartTests: 10,
        virtualLabSimulations: 5,
        academicResearch: 2,
        contentLabConversions: 100
      }
    };

    const limit = limits[plan][feature];
    return Math.max(0, limit - current);
  }

  getRemainingAttemptsLabel(feature: keyof Omit<UsageStats, 'lastResetDate'>): string {
    const remaining = this.getRemainingAttempts(feature);
    if (Number.isFinite(remaining)) {
      return String(remaining);
    }

    return this.currentLanguage() === 'ar' ? 'غير محدود' : 'Unlimited';
  }

  // Subscription Logic
  checkLimit(feature: keyof Omit<UsageStats, 'lastResetDate'>): { allowed: boolean, message: string, remaining: number } {
    const remaining = this.getRemainingAttempts(feature);
    const isAllowed = remaining > 0;

    let message = '';
    if (!isAllowed) {
      if (feature === 'aiTeacherQuestions') {
        message = this.currentLanguage() === 'ar' 
          ? "⚠️ لقد وصلت إلى الحد اليومي للمعلم الذكي. اشترك في Pro لفتح 30 سؤالاً يومياً."
          : "⚠️ You’ve reached today’s AI Teacher limit. Upgrade to Pro and unlock 30 smart questions per day.";
      } else if (feature === 'smartTests') {
        message = this.currentLanguage() === 'ar'
          ? "📝 لقد استهلكت حد الاختبارات الذكية. باقة Pro تمنحك 10 اختبارات يومياً مع تحليل أخطاء."
          : "📝 You have used your smart test limit. Pro unlocks 10 daily tests with error analysis.";
      } else if (feature === 'virtualLabSimulations') {
        message = this.currentLanguage() === 'ar'
          ? "🔬 لقد أكملت محاكاتك المجانية. يحصل مستخدمو Pro على 5 محاكاة يومياً."
          : "🔬 You completed your free simulation. Pro users access 5 simulations daily across all levels.";
      } else if (feature === 'academicResearch') {
        message = this.currentLanguage() === 'ar'
          ? "📚 بحثك الأكاديمي المجاني قد اكتمل. أنشئ أبحاثاً احترافية يومية مع Pro."
          : "📚 Your free academic research is complete. Generate daily professional research with Pro.";
      } else if (feature === 'contentLabConversions') {
        message = this.currentLanguage() === 'ar'
          ? "🧪 لقد وصلت إلى حد تحويل المحتوى. مستخدمو Pro لديهم وصول غير محدود."
          : "🧪 You've reached the content conversion limit. Pro users have unlimited access.";
      }
    }

    return { allowed: isAllowed, message, remaining };
  }

  incrementUsage(feature: keyof Omit<UsageStats, 'lastResetDate'>) {
    if (this.hasUnlimitedUsageAccess()) {
      return;
    }

    this.usageStats.update(stats => ({
      ...stats,
      [feature]: stats[feature] + 1
    }));
  }

  upgradeToPro() {
    this.userPlan.set('pro');
    this.ns.show(
      this.currentLanguage() === 'ar' ? 'تمت الترقية بنجاح!' : 'Upgrade Successful!',
      this.currentLanguage() === 'ar' ? 'أنت الآن مشترك في باقة Pro. استمتع بكافة الميزات.' : 'You are now a Pro member. Enjoy all features.',
      'success'
    );
  }

  getGrade(score: number): string {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  getFace(score: number): string {
    if (score >= 90) return '🤩';
    if (score >= 80) return '😊';
    if (score >= 70) return '🙂';
    if (score >= 60) return '😐';
    if (score >= 50) return '😟';
    return '😢';
  }

  private get languageName(): string {
    return getLanguageName(this.currentLanguage());
  }

  getLanguageName(language: LanguageCode | string | null | undefined = this.currentLanguage()): string {
    return getLanguageName(language);
  }

  getSpeechRecognitionLocale(language: LanguageCode | string | null | undefined = this.currentLanguage()): string {
    return getSpeechRecognitionLocale(language);
  }

  private async retry<T>(fn: () => Promise<T>, retries: number = 3, delay: number = 2000): Promise<T> {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error as { message?: string };
      if (retries > 0 && (err.message?.includes('429') || err.message?.toLowerCase().includes('rate exceeded') || err.message?.toLowerCase().includes('quota'))) {
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.retry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  private resolveModel(model?: string): string | undefined {
    if (!model) return undefined;
    const trimmed = model.trim().toLowerCase();
    if (trimmed.startsWith('gpt-') || trimmed.startsWith('o1') || trimmed.startsWith('o3')) {
      return model.trim();
    }
    return undefined;
  }

  private extractJsonPayload(raw: string): string {
    const text = raw.trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) return fenced[1].trim();

    const objStart = text.indexOf('{');
    const arrStart = text.indexOf('[');
    let start = -1;

    if (objStart >= 0 && arrStart >= 0) start = Math.min(objStart, arrStart);
    else start = Math.max(objStart, arrStart);
    if (start < 0) return text;

    const objEnd = text.lastIndexOf('}');
    const arrEnd = text.lastIndexOf(']');
    const end = Math.max(objEnd, arrEnd);

    if (end < start) return text;
    return text.slice(start, end + 1).trim();
  }

  private parseJsonResponse<T>(raw: string): T {
    const payload = this.extractJsonPayload(raw);
    return JSON.parse(payload) as T;
  }

  private async chatViaSiteAIEndpointDetailed(
    message: string,
    systemInstruction: string,
    history: ChatHistoryEntry[] = [],
    jsonMode: boolean = false,
    model?: string,
    files: AIFileAttachment[] = [],
    maxTokens?: number,
    requestOptions: AIChatRequestOptions = {}
  ): Promise<AIChatResponsePayload> {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        systemInstruction,
        history,
        jsonMode,
        model,
        files,
        maxTokens: requestOptions.maxTokens ?? maxTokens,
        temperature: requestOptions.temperature,
        featureHint: requestOptions.featureHint,
        knowledgeMode: requestOptions.knowledgeMode
      })
    });

    const payload = await response.json().catch(() => null) as AIChatResponsePayload | null;
    this.lastGrounding.set(payload?.grounding || null);

    if (!response.ok || !payload?.text) {
      throw new Error(payload?.error || `AI proxy request failed (${response.status})`);
    }

    return payload;
  }

  private async chatViaSiteAIEndpoint(
    message: string,
    systemInstruction: string,
    history: ChatHistoryEntry[] = [],
    jsonMode: boolean = false,
    model?: string,
    files: AIFileAttachment[] = [],
    maxTokens?: number,
    requestOptions: AIChatRequestOptions = {}
  ): Promise<string> {
    const payload = await this.chatViaSiteAIEndpointDetailed(
      message,
      systemInstruction,
      history,
      jsonMode,
      model,
      files,
      maxTokens,
      requestOptions
    );
    return payload.text;
  }

  private async jsonViaSiteAIEndpoint<T>(
    message: string,
    systemInstruction: string,
    model?: string,
    files: AIFileAttachment[] = [],
    maxTokens?: number,
    humanLanguage?: string | null,
    requestOptions: AIChatRequestOptions = {}
  ): Promise<T> {
    const languageGuard = humanLanguage?.trim()
      ? `\nAll user-facing prose, explanations, summaries, recommendations, labels, scenarios, and question text must be generated directly in ${humanLanguage.trim()} from the start, not translated afterwards.\nKeep JSON keys and any explicitly requested enum/code values exactly as requested.`
      : '';
    const strictInstruction = `${systemInstruction}${languageGuard}\nReturn strictly valid JSON with no markdown fences and no extra text.`;
    const text = await this.chatViaSiteAIEndpoint(message, strictInstruction, [], true, model, files, maxTokens, requestOptions);
    return this.parseJsonResponse<T>(text);
  }

  private async transcribeViaSiteAIEndpoint(base64Data: string, mimeType: string): Promise<string> {
    const response = await fetch('/api/ai/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, mimeType })
    });

    const payload = await response.json().catch(() => null) as { text?: string; error?: string } | null;
    if (!response.ok) {
      throw new Error(payload?.error || `AI transcription failed (${response.status})`);
    }

    return payload?.text || '';
  }

  private async imageViaSiteAIEndpoint(): Promise<string> {
    // Image generation is disabled.
    return '';
  }

  async chat(
    message: string,
    systemInstruction: string,
    history: ChatHistoryEntry[] = [],
    model: string = 'gpt-4o-mini',
    files: AIFileAttachment[] = [],
    requestOptions: AIChatRequestOptions = {}
  ): Promise<string> {
    return this.retry(async () => {
      const enforcedInstruction = `${systemInstruction}. CRITICAL: You MUST respond strictly in ${this.languageName}.`;
      const filesNotice = files.length > 0
        ? `\n[Attachment count: ${files.length}. Summarize based on user message context.]`
        : '';

      const text = await this.chatViaSiteAIEndpoint(
        `${message}${filesNotice}`,
        enforcedInstruction,
        history,
        false,
        this.resolveModel(model),
        files,
        requestOptions.maxTokens,
        requestOptions
      );

      this.ns.show(
        this.currentLanguage() === 'ar' ? 'رسالة من المعلم الذكي' : 'Message from AI Tutor',
        this.currentLanguage() === 'ar' ? 'لقد تلقيت رداً جديداً' : 'You have received a new response',
        'info',
        'fa-robot'
      );

      return text;
    });
  }

  async *chatStream(
    message: string,
    systemInstruction: string,
    history: ChatHistoryEntry[] = [],
    model: string = 'gpt-4o-mini',
    files: AIFileAttachment[] = [],
    requestOptions: AIChatRequestOptions = {}
  ) {
    this.lastGrounding.set(null);

    const enforcedInstruction = `${systemInstruction}. CRITICAL: You MUST respond strictly in ${this.languageName}.`;
    const filesNotice = files.length > 0
      ? `\n[Attachment count: ${files.length}. Summarize based on user message context.]`
      : '';

    const response = await fetch('/api/ai/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `${message}${filesNotice}`,
        systemInstruction: enforcedInstruction,
        history,
        jsonMode: false,
        model: this.resolveModel(model),
        files,
        maxTokens: requestOptions.maxTokens,
        featureHint: requestOptions.featureHint,
        knowledgeMode: requestOptions.knowledgeMode
      })
    });

    if (!response.ok || !response.body) {
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      throw new Error(payload?.error || `AI stream request failed (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const processStreamLine = (rawLine: string): string | GroundingMetadata | null => {
      const line = rawLine.trim();
      if (!line) {
        return null;
      }

      const payload = JSON.parse(line) as {
        type?: string;
        delta?: string;
        error?: string;
        grounding?: GroundingMetadata | null;
      };

      if (payload.type === 'error') {
        throw new Error(payload.error || 'AI stream failed');
      }

      if (payload.type === 'meta') {
        return payload.grounding || null;
      }

      if (payload.type === 'chunk' && typeof payload.delta === 'string' && payload.delta.length > 0) {
        return payload.delta;
      }

      return null;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const processed = processStreamLine(rawLine);
        if (typeof processed === 'string') {
          yield processed;
        } else {
          this.lastGrounding.set(processed || null);
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      for (const rawLine of buffer.split('\n')) {
        const processed = processStreamLine(rawLine);
        if (typeof processed === 'string') {
          yield processed;
        } else {
          this.lastGrounding.set(processed || null);
        }
      }
    }
  }

  saveConversation(record: TutorConversationRecord) {
    this.tutorConversationHistory.update(history => [record, ...history]);
  }

  async analyzeMood(text: string): Promise<{ mood: string; score: number; color: string; advice: string }> {
    return this.retry(async () => {
      const result = await this.jsonViaSiteAIEndpoint<{ mood: string; score: number; color: string; advice: string }>(
        `Analyze the emotional state in this text and respond in ${this.languageName}: "${text}".`,
        'Return JSON object with keys: mood, score (0-100), color (hex), advice.',
        undefined,
        [],
        undefined,
        this.languageName,
        { knowledgeMode: 'off' }
      );

      return {
        mood: result.mood || 'Neutral',
        score: Number.isFinite(result.score) ? result.score : 50,
        color: result.color || '#64748b',
        advice: result.advice || 'Keep going.'
      };
    });
  }

  async analyzeTutorTest(messages: { role: string, text: string }[], topic: string): Promise<ImprovementPlan> {
    return this.retry(async () => {
      const historyText = messages.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
      const plan = await this.jsonViaSiteAIEndpoint<ImprovementPlan>(
        `Topic: ${topic}\nSession:\n${historyText}`,
        'Analyze weaknesses and return JSON with keys: weakPoints[], overallAdvice, nextSteps[]. weakPoint keys: topic,page,slide,part,explanation,visualPrompt.',
        undefined,
        [],
        undefined,
        this.languageName,
        { featureHint: 'tutor', knowledgeMode: 'strict' }
      );

      return {
        weakPoints: (plan.weakPoints || []).map((wp) => ({ ...wp, visualUrl: '' })),
        overallAdvice: plan.overallAdvice || '',
        nextSteps: Array.isArray(plan.nextSteps) ? plan.nextSteps : []
      };
    });
  }

  async generateQuiz(
    topic: string,
    count: number,
    files: AIFileAttachment[] = [],
    language: LanguageCode = this.currentLanguage(),
    type: QuizQuestionType = 'mcq',
    difficulty: QuizDifficulty = 'medium'
  ): Promise<QuizQuestion[]> {
    const normalizedLanguage = normalizeLanguageCode(language);
    const safeCount = Math.max(1, Math.min(50, Math.round(count || 10)));
    const humanLanguage = this.getLanguageName(normalizedLanguage);
    const difficultyGuidance = this.buildQuizDifficultyGuidance(difficulty);
    const sourceGuidance = this.buildQuizSourceGuidance(files.length);
    const generationNonce = crypto.randomUUID();

    try {
      const payload = await this.retry(async () => this.jsonViaSiteAIEndpoint<{ questions?: unknown[] }>(
        [
          `Create a ${type === 'true_false' ? 'true/false' : 'multiple-choice'} test for the topic "${topic}".`,
          `Generate exactly ${safeCount} questions.`,
          `Difficulty level: ${difficulty}.`,
          `Variation seed: ${generationNonce}. Use it only to diversify question selection and wording. Do not mention it in the output.`,
          difficultyGuidance,
          type === 'true_false'
            ? 'Each question must be objectively answerable as true or false.'
            : 'Each question must include exactly 4 distinct options with one correct answer.',
          'Questions must be faithful to the source/topic and avoid duplicates.',
          sourceGuidance,
          type === 'mcq'
            ? 'Vary the question stems naturally. Rotate across first action, priority intervention, next best step, most concerning finding, what should be done first, and most appropriate response. Avoid repeating the same opening wording across consecutive questions.'
            : 'Vary the wording and do not repeat the same statement structure across consecutive questions.',
          'Explanations must be concise but educational.',
          files.length > 0
            ? `Use the attached files as the primary source material. Attachment count: ${files.length}.`
            : 'If no files are attached, build the test from the topic itself.'
        ].join(' '),
        `Return JSON with key questions.
Each question object must include:
- id
- q
- o
- a
- e
Rules:
- q = question text
- o = options array
- a = zero-based answer index
- e = brief explanation
- Do not repeat the same prompt or same option set.
- For true_false, options must be the localized equivalents of true and false only.
- For mcq, options length must be exactly 4.
- If files are attached, ground every question and explanation in the attached source content, not generic background knowledge.
- If multiple files are attached, cover the meaningful content across all of them rather than repeating one narrow section.
- Do not ask about facts that are absent from the provided source material.
- Keep user-facing content directly in ${humanLanguage}.`,
        undefined,
        files,
        undefined,
        humanLanguage,
        { featureHint: 'quiz', knowledgeMode: 'strict', temperature: 0.6 }
      ));

      return this.normalizeQuizQuestions(payload?.questions, topic, safeCount, normalizedLanguage, type, difficulty);
    } catch (error) {
      console.error('Quiz generation failed, using fallback questions', error);
      return this.buildFallbackQuizQuestions(topic, safeCount, normalizedLanguage, type, difficulty);
    }
  }

  private buildQuizDifficultyGuidance(difficulty: QuizDifficulty): string {
    switch (difficulty) {
      case 'easy':
        return 'Easy means clear, normal, accessible questions for an average student. They should be straightforward, but not trivial or childish.';
      case 'hard':
        return 'Hard means high-level questions that demand precise comprehension, close reading of the source, and strong distinction between similar ideas.';
      case 'legendary':
        return 'Legendary means elite difficulty: subtle distractors, multi-step reasoning, and very strong source comprehension while remaining fully grounded in the material.';
      case 'medium':
      default:
        return 'Medium means questions for a student who studied the material once or twice and can handle moderate conceptual depth.';
    }
  }

  private buildQuizSourceGuidance(fileCount: number): string {
    if (fileCount <= 0) {
      return 'If no attachments exist, derive the exam from the topic itself.';
    }

    return [
      'Treat the attached files as the source of truth for the exam.',
      'Read every attachment before writing the final questions.',
      'Build the exam from the content inside the files, not from the topic name alone.',
      'If several attachments exist, distribute the questions across the main ideas found in all readable files.',
      'Do not ignore a file just because another file is longer.'
    ].join(' ');
  }

  async analyzeQuizErrors(
    questions: QuizQuestion[],
    userAnswers: Array<number | null>,
    topic: string,
    language: LanguageCode = this.currentLanguage()
  ): Promise<ImprovementPlan> {
    const normalizedLanguage = normalizeLanguageCode(language);
    const missed = questions
      .map((question, index) => ({
        question,
        userAnswerIndex: userAnswers[index] ?? null
      }))
      .filter((entry) => entry.userAnswerIndex !== entry.question.a);

    if (missed.length === 0) {
      return this.buildFallbackQuizImprovementPlan([], topic, normalizedLanguage);
    }

    try {
      const humanLanguage = this.getLanguageName(normalizedLanguage);
      const plan = await this.retry(async () => this.jsonViaSiteAIEndpoint<ImprovementPlan>(
        `Topic: ${topic}
Missed quiz questions:
${missed.map((entry, index) => [
  `Question ${index + 1}: ${entry.question.q}`,
  `Options: ${entry.question.o.join(' | ')}`,
  `User answer: ${typeof entry.userAnswerIndex === 'number' ? entry.question.o[entry.userAnswerIndex] || 'Unknown option' : 'No answer'}`,
  `Correct answer: ${entry.question.o[entry.question.a] || ''}`,
  `Explanation: ${entry.question.e}`
].join('\n')).join('\n\n')}`,
        `Analyze the student's weaknesses based on the wrong quiz answers.
Return JSON with keys: weakPoints[], overallAdvice, nextSteps[].
Each weakPoint may include: topic, page, slide, part, explanation, visualPrompt.
Do not invent precise page/slide values unless grounded in the prompt.
Write user-facing content directly in ${humanLanguage}.`,
        undefined,
        [],
        undefined,
        humanLanguage
      ));

      return {
        weakPoints: Array.isArray(plan.weakPoints)
          ? plan.weakPoints.map((point, index) => ({
            topic: point.topic || (normalizedLanguage === 'ar' ? `محور ${index + 1}` : `Topic ${index + 1}`),
            page: Number.isFinite(point.page) ? point.page : undefined,
            slide: Number.isFinite(point.slide) ? point.slide : undefined,
            part: typeof point.part === 'string' && point.part.trim() ? point.part.trim() : undefined,
            explanation: point.explanation || (normalizedLanguage === 'ar' ? 'تحتاج هذه النقطة إلى مراجعة إضافية.' : 'This area needs another review.'),
            visualPrompt: typeof point.visualPrompt === 'string' && point.visualPrompt.trim() ? point.visualPrompt.trim() : undefined,
            visualUrl: ''
          }))
          : [],
        overallAdvice: typeof plan.overallAdvice === 'string' && plan.overallAdvice.trim()
          ? plan.overallAdvice.trim()
          : this.buildFallbackQuizImprovementPlan(missed, topic, normalizedLanguage).overallAdvice,
        nextSteps: Array.isArray(plan.nextSteps) && plan.nextSteps.length > 0
          ? plan.nextSteps.filter((step): step is string => typeof step === 'string').map((step) => step.trim()).filter(Boolean).slice(0, 4)
          : this.buildFallbackQuizImprovementPlan(missed, topic, normalizedLanguage).nextSteps
      };
    } catch (error) {
      console.error('Quiz analysis failed, using fallback plan', error);
      return this.buildFallbackQuizImprovementPlan(missed, topic, normalizedLanguage);
    }
  }

  private normalizeQuizQuestions(
    input: unknown,
    topic: string,
    requestedCount: number,
    language: LanguageCode,
    type: QuizQuestionType,
    difficulty: QuizDifficulty
  ): QuizQuestion[] {
    const rawQuestions = Array.isArray(input) ? input : [];
    const seenSignatures = new Set<string>();
    const normalized = Array.from({ length: requestedCount }, (_, index) => {
      const candidate = rawQuestions[index];
      const parsed = candidate && typeof candidate === 'object' ? candidate as Record<string, unknown> : {};
      const fallback = this.buildFallbackQuizQuestion(topic, index, requestedCount, language, type, difficulty);
      const extractedPrompt = this.extractQuizPromptAndInlineOptions(this.pickQuizPrompt(parsed, fallback.q), type);
      const prompt = extractedPrompt.prompt || fallback.q;
      const options = this.normalizeQuizOptions(parsed, extractedPrompt.options, fallback.o, language, type);
      const answerIndex = this.normalizeQuizAnswerIndex(parsed, options, fallback.a, language, type);
      const explanation = this.pickQuizExplanation(parsed, fallback.e);

      let question: QuizQuestion = {
        id: typeof parsed.id === 'string' && parsed.id.trim() ? parsed.id.trim() : `quiz_${index + 1}`,
        q: prompt,
        o: options.map((option) => `${option}`),
        a: answerIndex,
        e: explanation,
        t: type
      };

      const signature = this.buildQuizQuestionSignature(question);
      const uniqueOptions = new Set(question.o.map((option) => this.normalizeQuizTextKey(option))).size;
      if (!question.q.trim() || uniqueOptions < question.o.length || seenSignatures.has(signature)) {
        question = {
          ...fallback,
          id: question.id
        };
      }

      seenSignatures.add(this.buildQuizQuestionSignature(question));
      return question;
    });

    return normalized.length > 0 ? normalized : this.buildFallbackQuizQuestions(topic, requestedCount, language, type, difficulty);
  }

  private pickQuizPrompt(candidate: Record<string, unknown>, fallback: string): string {
    const direct = typeof candidate.q === 'string' && candidate.q.trim()
      ? candidate.q.trim()
      : typeof candidate.question === 'string' && candidate.question.trim()
        ? candidate.question.trim()
        : typeof candidate.prompt === 'string' && candidate.prompt.trim()
          ? candidate.prompt.trim()
          : '';
    return direct || fallback;
  }

  private pickQuizExplanation(candidate: Record<string, unknown>, fallback: string): string {
    const explanation = typeof candidate.e === 'string' && candidate.e.trim()
      ? candidate.e.trim()
      : typeof candidate.explanation === 'string' && candidate.explanation.trim()
        ? candidate.explanation.trim()
        : '';
    return explanation || fallback;
  }

  private extractQuizPromptAndInlineOptions(prompt: string, type: QuizQuestionType): { prompt: string; options: string[] } {
    const text = typeof prompt === 'string' ? prompt.trim() : '';
    if (!text || type === 'true_false') {
      return { prompt: text, options: [] };
    }

    const lines = text
      .split(/\r?\n/g)
      .map((line) => this.sanitizeQuizTextFragment(line))
      .filter(Boolean);
    const firstOptionIndex = lines.findIndex((line) => this.matchInlineQuizOptionLine(line) !== null);
    if (firstOptionIndex < 0) {
      return { prompt: text, options: [] };
    }

    const options: string[] = [];
    for (let index = firstOptionIndex; index < lines.length; index += 1) {
      const option = this.matchInlineQuizOptionLine(lines[index]);
      if (!option) {
        break;
      }
      options.push(option);
      if (options.length === 4) {
        break;
      }
    }

    if (options.length !== 4) {
      return { prompt: text, options: [] };
    }

    const promptLines = lines.slice(0, firstOptionIndex);
    return {
      prompt: promptLines.join(' ').trim() || text,
      options
    };
  }

  private matchInlineQuizOptionLine(line: string): string | null {
    const patterns = [
      /^[\-\*\u2022]?\s*(?:(?:option|choice)\s*)?([A-Da-d]|[1-4]|[أابجدهـهو])\s*[\)\].:-]\s*(.+)$/iu,
      /^[\-\*\u2022]?\s*(?:الخيار\s*)?([1-4]|[أابجدهـهو])\s*[\)\].:-]\s*(.+)$/iu
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[2]) {
        const cleaned = this.stripQuizOptionPrefix(match[2]);
        if (cleaned) {
          return cleaned;
        }
      }
    }

    return null;
  }

  private normalizeQuizOptions(
    candidate: Record<string, unknown>,
    inlineOptions: string[],
    fallback: string[],
    language: LanguageCode,
    type: QuizQuestionType
  ): string[] {
    if (type === 'true_false') {
      return [...this.buildTrueFalseOptions(language)];
    }

    const directOptions = this.cleanQuizOptionList(this.collectQuizStructuredOptions(candidate));
    if (this.hasValidQuizOptionSet(directOptions)) {
      return [...directOptions];
    }

    const extractedOptions = this.cleanQuizOptionList(inlineOptions);
    if (this.hasValidQuizOptionSet(extractedOptions)) {
      return [...extractedOptions];
    }

    const mergedOptions = this.cleanQuizOptionList([...directOptions, ...extractedOptions]);
    if (this.hasValidQuizOptionSet(mergedOptions)) {
      return [...mergedOptions];
    }

    return [...fallback];
  }

  private normalizeQuizAnswerIndex(
    candidate: Record<string, unknown>,
    options: string[],
    fallback: number,
    language: LanguageCode,
    type: QuizQuestionType
  ): number {
    const textualAnswerFields = [
      candidate.answer,
      candidate.correctAnswer,
      candidate.correct_option,
      candidate.correctOption,
      candidate.correct_choice,
      candidate.correctChoice,
      candidate.solution
    ];
    for (const field of textualAnswerFields) {
      const resolved = this.resolveQuizAnswerFromText(field, options, language, type);
      if (resolved !== null) {
        return resolved;
      }
    }

    const numericAnswerFields = [
      candidate.a,
      candidate.answerIndex,
      candidate.correctIndex,
      candidate.correctOptionIndex
    ];
    for (const field of numericAnswerFields) {
      const resolved = this.resolveZeroBasedQuizAnswer(field, options.length);
      if (resolved !== null) {
        return resolved;
      }
    }

    return Math.max(0, Math.min(options.length - 1, fallback));
  }

  private buildFallbackQuizQuestions(
    topic: string,
    count: number,
    language: LanguageCode,
    type: QuizQuestionType,
    difficulty: QuizDifficulty
  ): QuizQuestion[] {
    return Array.from({ length: count }, (_, index) => this.buildFallbackQuizQuestion(topic, index, count, language, type, difficulty));
  }

  private buildFallbackQuizQuestion(
    topic: string,
    index: number,
    total: number,
    language: LanguageCode,
    type: QuizQuestionType,
    difficulty: QuizDifficulty
  ): QuizQuestion {
    const stepLabel = language === 'ar' ? `السؤال ${index + 1}` : `Question ${index + 1}`;
    const trueFalseOptions = this.buildTrueFalseOptions(language);
    const difficultyTone = this.buildFallbackQuizDifficultyTone(difficulty, language);

    if (type === 'true_false') {
      const statements = language === 'ar'
        ? [
          `يركز ${topic} ${difficultyTone} على فهم المفهوم الأساسي قبل حفظ التفاصيل.`,
          `يمكن إتقان ${topic} ${difficultyTone} دون مراجعة الأمثلة التطبيقية.`,
          `ربط السبب بالنتيجة يساعد في تثبيت فهم ${topic} حتى ${difficultyTone}.`,
          `مراجعة الأخطاء في ${topic} أقل أهمية من قراءة الملخص فقط ${difficultyTone}.`
        ]
        : [
          `${topic} depends on understanding the core idea before memorizing details, even ${difficultyTone}.`,
          `${topic} can be mastered ${difficultyTone} without reviewing practical examples.`,
          `Linking causes to results improves understanding of ${topic}, including situations ${difficultyTone}.`,
          `Reviewing mistakes in ${topic} is less important than reading the summary alone ${difficultyTone}.`
        ];
      const statement = statements[index % statements.length];
      const answerIndex = index % 2 === 0 ? 0 : 1;

      return {
        id: `quiz_${index + 1}`,
        q: statement,
        o: [...trueFalseOptions],
        a: answerIndex,
        t: 'true_false',
        e: language === 'ar'
          ? `هذا السؤال يراجع مبدأًا أساسيًا في ${topic} ضمن ${stepLabel} من ${total}.`
          : `This question reviews a core principle of ${topic} in ${stepLabel} of ${total}.`
      };
    }

    const questionPrompt = this.buildFallbackQuizStem(topic, index, total, language, difficulty);
    const correctOption = language === 'ar'
      ? `ابدأ بتحديد الخطر أو الأولوية الأعلى في ${topic} ثم اتخذ الخطوة الأكثر أمانًا بناءً على المعطيات.`
      : `Start by identifying the highest-priority risk in ${topic}, then take the safest evidence-based next move.`;
    const distractors = language === 'ar'
      ? this.buildFallbackQuizDistractors(topic, difficulty, true)
      : this.buildFallbackQuizDistractors(topic, difficulty, false);
    const answerIndex = index % 4;
    const options = [...distractors];
    options.splice(answerIndex, 0, correctOption);

    return {
      id: `quiz_${index + 1}`,
      q: questionPrompt,
      o: options,
      a: answerIndex,
      t: 'mcq',
      e: language === 'ar'
        ? `الإجابة الصحيحة في ${stepLabel} تؤكد أن القرار الأقوى يبدأ دائمًا بتحديد الأولوية الأخطر في ${topic} ثم التحرك عليها مباشرة.`
        : `The correct answer in ${stepLabel} shows that the strongest move in ${topic} starts by identifying the top priority and acting on it directly.`
    };
  }

  private buildFallbackQuizStem(
    topic: string,
    index: number,
    total: number,
    language: LanguageCode,
    difficulty: QuizDifficulty
  ): string {
    const hardTag = difficulty === 'legendary'
      ? (language === 'ar' ? 'في موقف شديد التعقيد والدقة' : 'in a highly complex, precision-heavy scenario')
      : difficulty === 'hard'
        ? (language === 'ar' ? 'في موقف عالي الضغط' : 'in a high-pressure scene')
        : difficulty === 'easy'
          ? (language === 'ar' ? 'في موقف واضح المعالم' : 'in a clearer scene')
          : (language === 'ar' ? 'في موقف واقعي متوازن' : 'in a balanced realistic scene');
    const stems = language === 'ar'
      ? [
        `ما الإجراء الأول الأكثر ملاءمة في ${topic} ${hardTag} ضمن السؤال ${index + 1} من ${total}؟`,
        `ما التدخل ذو الأولوية في سيناريو متعلق بـ ${topic} ${hardTag}؟`,
        `ما الخطوة التالية الأفضل عند التعامل مع ${topic} ${hardTag}؟`,
        `أي مؤشر في ${topic} ${hardTag} يستحق أكبر قدر من الانتباه الآن؟`,
        `ما الاستجابة الأكثر مناسبة في حالة ترتبط بـ ${topic} ${hardTag}؟`,
        `ما الذي يجب فعله أولاً للحفاظ على سلامة القرار في ${topic} ${hardTag}؟`
      ]
      : [
        `What is the most appropriate first action in ${topic} ${hardTag} for question ${index + 1} of ${total}?`,
        `What is the priority intervention in a scenario involving ${topic} ${hardTag}?`,
        `What is the next best step when managing ${topic} ${hardTag}?`,
        `Which signal in ${topic} ${hardTag} deserves the most concern right now?`,
        `What is the most appropriate response in a case related to ${topic} ${hardTag}?`,
        `What should be done first to preserve sound judgment in ${topic} ${hardTag}?`
      ];

    return stems[index % stems.length];
  }

  private buildFallbackQuizDistractors(topic: string, difficulty: QuizDifficulty, arabic: boolean): string[] {
    if (arabic) {
      if (difficulty === 'legendary') {
        return [
          `اختيار خطوة تبدو دقيقة في ${topic} لكنها تتجاهل تفصيلاً حاسماً غيّر معنى المعطيات الأصلية.`,
          `بناء قرار متقدم في ${topic} على استنتاج غير مدعوم نصاً رغم أن الملف يوجّه إلى خيار آخر.`,
          `الانشغال بتفصيل ثانوي معقّد في ${topic} قبل تثبيت الأساس الأكثر تأثيراً في الحكم النهائي.`
        ];
      }

      if (difficulty === 'hard') {
        return [
          `التحرك مباشرة إلى خطوة جذابة في ${topic} قبل إعادة ترتيب الأولويات الحقيقية.`,
          `تأجيل القرار في ${topic} حتى تتوافر كل التفاصيل حتى لو ازداد الخطر.`,
          `اتباع إجراء مألوف في ${topic} من دون التأكد من أنه يناسب السياق الحالي.`
        ];
      }

      if (difficulty === 'easy') {
        return [
          `الانتظار من دون تقييم الأولويات في ${topic}.`,
          `اختيار استجابة عامة في ${topic} من غير مراجعة المعطيات الحالية.`,
          `الاعتماد على التخمين بدل تحليل ما يحدث في ${topic}.`
        ];
      }

      return [
        `التركيز على خطوة ثانوية في ${topic} قبل معالجة الخطر الرئيسي.`,
        `تأجيل الحسم في ${topic} رغم أن المؤشرات الحالية تكفي لاتخاذ قرار أولي.`,
        `اختيار تصرف يبدو نشطًا في ${topic} لكنه لا يعالج أصل المشكلة.`
      ];
    }

    if (difficulty === 'legendary') {
      return [
        `Choosing a highly technical move in ${topic} that ignores the decisive detail in the source.`,
        `Building an advanced response in ${topic} on an inference the file never actually supports.`,
        `Focusing on a sophisticated but secondary detail in ${topic} before securing the core judgment.`
      ];
    }

    if (difficulty === 'hard') {
      return [
        `Jump straight to an attractive intervention in ${topic} before reordering the true priorities.`,
        `Delay the decision in ${topic} until every detail is available, even while risk is rising.`,
        `Apply a familiar move in ${topic} without confirming that it fits the current context.`
      ];
    }

    if (difficulty === 'easy') {
      return [
        `Wait without assessing the priorities in ${topic}.`,
        `Choose a generic response in ${topic} without checking the current facts.`,
        `Rely on guessing instead of analyzing what is happening in ${topic}.`
      ];
    }

    return [
      `Focus on a secondary move in ${topic} before addressing the main threat.`,
      `Delay committing in ${topic} even though the current signals support an initial decision.`,
      `Pick an action that looks active in ${topic} but does not address the actual problem.`
    ];
  }

  private buildFallbackQuizDifficultyTone(difficulty: QuizDifficulty, language: LanguageCode): string {
    if (difficulty === 'legendary') {
      return language === 'ar' ? 'بمستوى نخبوي شديد الدقة' : 'at an elite precision-heavy level';
    }

    if (difficulty === 'hard') {
      return language === 'ar' ? 'بمستوى ضغط مرتفع' : 'under higher pressure';
    }

    if (difficulty === 'easy') {
      return language === 'ar' ? 'بإشارات أوضح' : 'with clearer signals';
    }

    return language === 'ar' ? 'بضغط متوازن' : 'under balanced pressure';
  }

  private buildFallbackQuizImprovementPlan(
    missed: Array<{ question: QuizQuestion; userAnswerIndex: number | null }>,
    topic: string,
    language: LanguageCode
  ): ImprovementPlan {
    const weakPoints = missed.slice(0, 3).map((entry, index) => ({
      topic: language === 'ar' ? `مراجعة ${index + 1}` : `Review ${index + 1}`,
      part: entry.question.q,
      explanation: language === 'ar'
        ? `أخطأت في هذا السؤال، لذا تحتاج إلى مراجعة تفسير الإجابة الصحيحة والتركيز على سبب صحة الخيار ${entry.question.o[entry.question.a]}.`
        : `You missed this question, so review the explanation and focus on why the correct option "${entry.question.o[entry.question.a]}" is right.`,
      visualPrompt: language === 'ar'
        ? `مخطط مبسط يوضح فكرة السؤال حول ${topic}`
        : `A simple visual explaining the idea behind this ${topic} question`,
      visualUrl: ''
    }));

    return {
      weakPoints,
      overallAdvice: language === 'ar'
        ? `ركّز في ${topic} على فهم الفكرة قبل اختيار الإجابة، ثم راجع شرح كل سؤال أخطأت فيه بدل الاكتفاء بالنتيجة النهائية.`
        : `In ${topic}, focus on understanding the idea before selecting an answer, then review each missed explanation instead of relying only on the final score.`,
      nextSteps: language === 'ar'
        ? [
          'أعد قراءة شرح الأسئلة الخاطئة واحدة واحدة.',
          'حوّل النقاط الضعيفة إلى بطاقات مراجعة قصيرة.',
          'أعد الاختبار بعد مراجعة الأمثلة والتعاريف الأساسية.'
        ]
        : [
          'Re-read the explanations for the missed questions one by one.',
          'Turn the weak areas into short revision cards.',
          'Retake the quiz after reviewing the core examples and definitions.'
        ]
    };
  }

  private buildTrueFalseOptions(language: LanguageCode): [string, string] {
    return language === 'ar' ? ['صح', 'خطأ'] : ['True', 'False'];
  }

  private collectQuizStructuredOptions(candidate: Record<string, unknown>): unknown[] {
    const collected: unknown[] = [];
    const arrayLikeSources = [
      candidate.o,
      candidate.options,
      candidate.choices,
      candidate.answers,
      candidate.items,
      candidate.alternatives
    ];

    for (const source of arrayLikeSources) {
      if (Array.isArray(source)) {
        collected.push(...source);
      } else if (source && typeof source === 'object') {
        collected.push(...this.collectQuizOptionsFromObject(source as Record<string, unknown>));
      }
    }

    collected.push(...this.collectQuizOptionsFromObject(candidate, true));
    return collected;
  }

  private collectQuizOptionsFromObject(
    candidate: Record<string, unknown>,
    topLevel: boolean = false
  ): unknown[] {
    const orderedKeys = topLevel
      ? ['optionA', 'optionB', 'optionC', 'optionD', 'choiceA', 'choiceB', 'choiceC', 'choiceD', 'option1', 'option2', 'option3', 'option4']
      : ['A', 'B', 'C', 'D', 'a', 'b', 'c', 'd', '1', '2', '3', '4', 'optionA', 'optionB', 'optionC', 'optionD', 'choiceA', 'choiceB', 'choiceC', 'choiceD', 'option1', 'option2', 'option3', 'option4'];

    return orderedKeys
      .map((key) => candidate[key])
      .filter((value) => value !== undefined && value !== null);
  }

  private cleanQuizOptionList(values: unknown[]): string[] {
    const cleaned: string[] = [];
    const seen = new Set<string>();

    for (const value of values) {
      const option = this.coerceQuizOptionText(value);
      if (!option) {
        continue;
      }

      const key = this.normalizeQuizTextKey(option);
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      cleaned.push(option);
      if (cleaned.length === 4) {
        break;
      }
    }

    return cleaned;
  }

  private hasValidQuizOptionSet(options: string[]): boolean {
    return options.length === 4;
  }

  private coerceQuizOptionText(value: unknown): string {
    if (typeof value === 'string') {
      return this.stripQuizOptionPrefix(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return this.stripQuizOptionPrefix(String(value));
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      for (const key of ['text', 'label', 'option', 'value', 'content', 'answer', 'title', 'name']) {
        const nested = record[key];
        if (typeof nested === 'string' && nested.trim()) {
          return this.stripQuizOptionPrefix(nested);
        }
      }
    }

    return '';
  }

  private resolveQuizAnswerFromText(
    value: unknown,
    options: string[],
    language: LanguageCode,
    type: QuizQuestionType
  ): number | null {
    const answerText = this.coerceQuizAnswerText(value);
    if (!answerText) {
      return null;
    }

    const normalizedAnswer = this.normalizeQuizTextKey(answerText);
    const optionIndex = options.findIndex((option) => this.normalizeQuizTextKey(option) === normalizedAnswer);
    if (optionIndex >= 0) {
      return optionIndex;
    }

    const labeledIndex = this.parseQuizAnswerLabel(answerText, options.length);
    if (labeledIndex !== null) {
      return labeledIndex;
    }

    if (type === 'true_false') {
      const trueValues = new Set(
        [this.buildTrueFalseOptions(language)[0], 'true', 'صح', 'صحيح']
          .map((item) => this.normalizeQuizTextKey(item))
      );
      const falseValues = new Set(
        [this.buildTrueFalseOptions(language)[1], 'false', 'خطأ', 'غلط']
          .map((item) => this.normalizeQuizTextKey(item))
      );
      if (trueValues.has(normalizedAnswer)) return 0;
      if (falseValues.has(normalizedAnswer)) return 1;
    }

    return null;
  }

  private resolveZeroBasedQuizAnswer(value: unknown, optionCount: number): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.min(optionCount - 1, Math.floor(value)));
    }

    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.min(optionCount - 1, Math.floor(parsed)));
      }
    }

    return null;
  }

  private coerceQuizAnswerText(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }

    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      for (const key of ['text', 'label', 'value', 'answer', 'option']) {
        const nested = record[key];
        if (typeof nested === 'string' && nested.trim()) {
          return nested.trim();
        }
      }
    }

    return '';
  }

  private parseQuizAnswerLabel(value: string, optionCount: number): number | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^[A-D]$/i.test(trimmed)) {
      return Math.min(optionCount - 1, trimmed.toUpperCase().charCodeAt(0) - 65);
    }

    const arabicLabelMap: Record<string, number> = {
      'أ': 0,
      'ا': 0,
      'ب': 1,
      'ج': 2,
      'د': 3,
      'ه': 4,
      'هـ': 4,
      'و': 5
    };
    if (trimmed in arabicLabelMap) {
      return Math.min(optionCount - 1, arabicLabelMap[trimmed]);
    }

    if (/^\d+$/.test(trimmed)) {
      const parsed = Number(trimmed);
      if (parsed >= 1 && parsed <= optionCount) {
        return parsed - 1;
      }
      if (parsed >= 0 && parsed < optionCount) {
        return parsed;
      }
    }

    return null;
  }

  private stripQuizOptionPrefix(value: string): string {
    return this.sanitizeQuizTextFragment(
      value.replace(/^[\-\*\u2022]?\s*(?:(?:option|choice|الخيار)\s*)?(?:[A-Da-d]|[1-4]|[أابجدهـهو])\s*[\)\].:-]\s*/iu, '')
    );
  }

  private sanitizeQuizTextFragment(value: string): string {
    return value
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private buildQuizQuestionSignature(question: QuizQuestion): string {
    return `${this.normalizeQuizTextKey(question.q)}::${question.o.map((option) => this.normalizeQuizTextKey(option)).sort().join('|')}`;
  }

  private normalizeQuizTextKey(value: string): string {
    return value.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  async globalSearch(query: string): Promise<BookMetadata[]> {
    return this.retry(async () => {
      const results = await this.jsonViaSiteAIEndpoint<Record<string, unknown>[]>(
        `Search query: ${query}`,
        'Return a JSON array of books with keys: id,title,authors,description,isbn13,publisher,publicationYear,language,pageCount,categories.'
      );

      return (Array.isArray(results) ? results : []).map(book => ({
        ...book as unknown as BookMetadata,
        id: String(book['id'] || crypto.randomUUID()),
        title: String(book['title'] || 'Unknown Book'),
        authors: Array.isArray(book['authors']) ? book['authors'] as string[] : ['Unknown'],
        description: String(book['description'] || ''),
        isbn13: String(book['isbn13'] || ''),
        publisher: String(book['publisher'] || ''),
        publicationYear: Number(book['publicationYear'] || 0),
        language: String(book['language'] || this.languageName),
        pageCount: Number(book['pageCount'] || 0),
        categories: Array.isArray(book['categories']) ? book['categories'] as string[] : [],
        rating: 4.5,
        isPublicDomain: true,
        coverImage: `https://covers.openlibrary.org/b/isbn/${String(book['isbn13'] || '')}-L.jpg`
      }));
    });
  }

  async academicHelper(query: string, task: string): Promise<string> {
    return this.retry(async () => {
      return this.chatViaSiteAIEndpoint(
        `Task: ${task}. Topic: ${query}.`,
        `You are an academic helper. Respond in ${this.languageName}.`,
        []
      );
    });
  }

  async generateStudyPlan(subjects: { name: string, importance: 'high' | 'medium' | 'low' }[], totalDailyHours: number, planType: 'daily' | 'weekly' | 'monthly', startDate?: string, endDate?: string): Promise<StudyPlanDay[]> {
    return this.retry(async () => {
      const subjectList = subjects.map(s => `${s.name} (Importance: ${s.importance})`).join(', ');
      const dateRange = (startDate && endDate) ? `from ${startDate} to ${endDate}` : `for a ${planType} period`;
      const prompt = `Create a study plan ${dateRange} for the following subjects: ${subjectList}. 
      CRITICAL: Allocate EXACTLY ${totalDailyHours} hours of study for EACH AND EVERY day in the plan. 
      Do NOT divide ${totalDailyHours} hours across the entire period; instead, ensure every single day has tasks totaling ${totalDailyHours} hours.
      Each task should have a topic, type (e.g., 'reading', 'practice', 'revision'), importance (high, medium, low), and durationMinutes (integer).
      The sum of durationMinutes for all tasks in a single day MUST equal ${totalDailyHours * 60} minutes.
      For each day, also include 'isFinished' (boolean), 'completedTaskCount' (number), and 'uncompletedTaskCount' (number). 
      Respond strictly in JSON format, in ${this.languageName}.`;

      const result = await this.jsonViaSiteAIEndpoint<StudyPlanDay[]>(
        prompt,
        'Return a JSON array. Each day keys: day,dailyHours,isFinished,completedTaskCount,uncompletedTaskCount,tasks[]. Task keys: durationMinutes,topic,type,importance.',
        undefined,
        [],
        undefined,
        this.languageName
      );

      return Array.isArray(result) ? result : [];
    });
  }

  async transformContent(text: string, type: string): Promise<string> {
    return this.retry(async () => {
      return this.chatViaSiteAIEndpoint(
        `Transform this content to ${type}: ${text}`,
        `You are a content transformation assistant. Respond in ${this.languageName}.`,
        []
      );
    });
  }

  async transcribeAudio(base64Data: string, mimeType: string): Promise<string> {
    return this.retry(async () => {
      return this.transcribeViaSiteAIEndpoint(base64Data, mimeType);
    });
  }

  async analyzeLanguage(text: string): Promise<LanguageCorrection> {
    return this.retry(async () => {
      const result = await this.jsonViaSiteAIEndpoint<LanguageCorrection>(
        `Analyze this sentence for grammar and pronunciation: "${text}".`,
        'Return JSON with keys: original, corrected, explanation, pronunciationTips.',
        undefined,
        [],
        undefined,
        this.languageName
      );

      return {
        original: result.original || text,
        corrected: result.corrected || text,
        explanation: result.explanation || '',
        pronunciationTips: result.pronunciationTips || ''
      };
    });
  }

  async generateSimulation(specialty: string): Promise<ClinicalCase> {
    return this.retry(async () => {
      const result = await this.jsonViaSiteAIEndpoint<ClinicalCase>(
        `Generate a clinical simulation for specialty: ${specialty}. Language: ${this.languageName}.`,
        'Return JSON with keys: vitals{bp,heartRate,temp}, patientInfo, questions[{options,answer}].',
        undefined,
        [],
        undefined,
        this.languageName
      );

      return {
        vitals: {
          bp: result?.vitals?.bp || '120/80',
          heartRate: Number(result?.vitals?.heartRate || 80),
          temp: Number(result?.vitals?.temp || 37)
        },
        patientInfo: result?.patientInfo || '',
        questions: Array.isArray(result?.questions) ? result.questions : []
      };
    });
  }

  async generatePracticalLab(
    discipline: string,
    subject: string,
    language: string = 'ar',
    files: AIFileAttachment[] = [],
    difficulty: LabScenarioDifficulty = 'medium'
  ): Promise<LabScenario> {
    return this.retry(async () => {
      const langName = this.getLanguageName(language);
      const plan = this.userPlan();
      const difficultyConfig = this.getLabDifficultyConfig(difficulty);
      const levelInstruction = plan === 'free'
        ? 'Level: Solid beginner-to-intermediate scenario-based training (realistic, rigorous, but safe and clear).'
        : 'Level: Professional/Advanced scenario-based simulation (complex branching decisions, strict realism, real-world pressure, deep technical depth).';
      const difficultyInstruction = difficulty === 'easy'
        ? 'Difficulty: easy. Keep the case clear, with more obvious indicators, direct decision-making, and 4 to 5 steps.'
        : difficulty === 'hard'
          ? 'Difficulty: hard. Use layered pressure, conflicting indicators, tighter judgment, and 6 to 7 steps.'
          : 'Difficulty: medium. Use moderate ambiguity, realistic pressure, and 5 to 6 steps.';
      const filesHint = files.length > 0 ? `Attached files count: ${files.length}.` : '';
      const maxTokens = 3200;

      const result = await this.jsonViaSiteAIEndpoint<Record<string, unknown>>(
        [
          `Create a complete scenario-based workplace simulation for discipline "${discipline}" and subject "${subject}".`,
          levelInstruction,
          difficultyInstruction,
          filesHint,
          `Language: ${langName}.`,
          'The user must feel inside a real workplace scene such as a hospital, courtroom, street, company, workshop, or control room, depending on the discipline.',
          'Do NOT build the scenario around preparation checklists or asking what tools to prepare.',
          'Replace setup-style wording with immediate incident-style wording such as: this situation happened, what will you do now?',
          'Start with a realistic opening situation, then continue with branching decisions and consequences.',
          `Use ${difficultyConfig.stepCount} to ${difficultyConfig.stepCount + 1} scenario steps with clear progression and realistic consequences.`,
          'Each step must have a unique id and must move the scene forward with a new development.',
          'Do not repeat the same situation, decision prompt, or the same answer set across consecutive steps.',
          'Every step must include 3 to 5 scene readings or indicators relevant to the discipline. At least 2 readings in each step must be numeric or measurable.',
          'Examples of valid readings: heart rate, blood pressure, lab values, queue length, pressure, distance, log volume, timeline gap, response time, temperature, affected devices.',
          'The readings must evolve from step to step and must not stay frozen across the whole scenario.',
          'Each step must include exactly 3 choices.',
          'Each choice must include a realistic outcome, a score impact, and the id of the next step or null if the scenario ends.',
          'Some wrong decisions may continue with a warning branch, while critical decisions may end the scenario early.',
          'nextStepId must point only to a later step id or be null.',
          'Finish with a final evaluation summary, strengths, improvements, and recommended next action.'
        ].join(' '),
        'Return JSON with keys: title, description, environment, openingSituation, imagePrompt, difficulty, passingScore, steps[{id,title,situation,decisionPrompt,readings[{label,value,note,status}],choices[{text,outcome,nextStepId,scoreImpact,consequenceLevel}]}], items[{name,icon,role}], finalEvaluation{summary,strengths,improvements,recommendedAction}.',
        undefined,
        files,
        maxTokens,
        langName
      );

      this.logLabDebug('Raw AI lab response', this.buildLabScenarioDebugSummary(result));
      const normalized = this.normalizeLabScenarioSnapshot(result, discipline, subject, language, difficulty);
      this.logLabDebug('Normalized lab scenario', this.buildLabScenarioDebugSummary(normalized));
      return normalized;
    });
  }

  normalizeLabScenarioSnapshot(
    input: unknown,
    discipline: string,
    subject: string,
    language: string = this.currentLanguage(),
    requestedDifficulty?: LabScenarioDifficulty
  ): LabScenario {
    const candidate = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const difficulty = this.normalizeLabDifficulty(requestedDifficulty ?? candidate.difficulty);
    const targetStepCount = Math.max(
      Array.isArray(candidate.steps) ? candidate.steps.length : 0,
      this.getLabDifficultyConfig(difficulty).stepCount
    );
    const fallback = this.buildFallbackLabScenario(discipline, subject, language, difficulty, targetStepCount);

    const rawSteps = Array.isArray(candidate.steps) ? candidate.steps : [];
    const provisionalSteps = rawSteps.length > 0
      ? rawSteps.map((step, stepIndex) => this.normalizeLabStep(step, stepIndex, rawSteps.length, language))
      : fallback.steps.map((step) => this.cloneLabStep(step));
    const canonicalStepIds = Array.from({ length: Math.max(provisionalSteps.length, fallback.steps.length) }, (_, stepIndex) =>
      this.buildCanonicalLabStepId(stepIndex)
    );
    const stepAliasLookup = this.buildLabStepAliasLookup(provisionalSteps, canonicalStepIds);
    const steps = Array.from({ length: canonicalStepIds.length }, (_, stepIndex) => {
      const canonicalStepId = canonicalStepIds[stepIndex];
      const step = provisionalSteps[stepIndex] || fallback.steps[stepIndex] || fallback.steps[fallback.steps.length - 1];
      const fallbackStep = fallback.steps[stepIndex] || fallback.steps[fallback.steps.length - 1];
      const rawStep = rawSteps[stepIndex];
      const fallbackNextStepId = canonicalStepIds[stepIndex + 1] || null;
      const readings = this.normalizeLabReadings(
        rawStep && typeof rawStep === 'object' ? (rawStep as Record<string, unknown>).readings : null,
        discipline,
        subject,
        language,
        difficulty,
        stepIndex
      );
      const choiceSource = Array.isArray(step.choices) && step.choices.length > 0 ? step.choices : fallbackStep.choices;
      const choices = choiceSource.slice(0, 3).map((choice, choiceIndex) => {
        const requestedNext = this.resolveCanonicalLabNextStepId(
          choice.nextStepId,
          stepIndex,
          canonicalStepIds,
          stepAliasLookup
        );
        const nextStepId = requestedNext ?? (choice.consequenceLevel === 'critical' ? null : fallbackNextStepId);

        return this.cloneLabChoice(canonicalStepId, {
          ...choice,
          nextStepId,
          scoreImpact: Math.max(-30, Math.min(20, Number.isFinite(choice.scoreImpact) ? choice.scoreImpact : (choiceIndex === 0 ? 12 : -10)))
        }, choiceIndex);
      });

      return this.cloneLabStep(step, {
        id: canonicalStepId,
        readings,
        choices
      });
    });
    const stableSteps = this.validateNormalizedLabSteps(
      this.ensureLabScenarioVariety(steps, fallback.steps, language),
      fallback.steps,
      language
    );

    const items = this.normalizeLabItems(candidate.items, discipline, subject, language);
    const title = typeof candidate.title === 'string' && candidate.title.trim()
      ? candidate.title.trim()
      : fallback.title;
    const description = typeof candidate.description === 'string' && candidate.description.trim()
      ? candidate.description.trim()
      : fallback.description;
    const environment = typeof candidate.environment === 'string' && candidate.environment.trim()
      ? candidate.environment.trim()
      : fallback.environment;
    const openingSituation = typeof candidate.openingSituation === 'string' && candidate.openingSituation.trim()
      ? candidate.openingSituation.trim()
      : fallback.openingSituation;
    const imagePrompt = typeof candidate.imagePrompt === 'string' && candidate.imagePrompt.trim()
      ? candidate.imagePrompt.trim()
      : `${environment} ${discipline} ${subject} realistic workplace simulation`;
    const passingScore = typeof candidate.passingScore === 'number' && Number.isFinite(candidate.passingScore)
      ? Math.max(45, Math.min(90, Math.round(candidate.passingScore)))
      : fallback.passingScore;

    return {
      title,
      description,
      environment,
      openingSituation,
      imagePrompt,
      difficulty,
      steps: stableSteps.length > 0
        ? stableSteps.map((step) => this.cloneLabStep(step))
        : fallback.steps.map((step, index) => this.cloneLabStep(step, {
          id: this.buildCanonicalLabStepId(index),
          choices: step.choices.map((choice, choiceIndex) => this.cloneLabChoice(this.buildCanonicalLabStepId(index), {
            ...choice,
            nextStepId: choice.nextStepId && canonicalStepIds.includes(choice.nextStepId) ? choice.nextStepId : null
          }, choiceIndex))
        })),
      items,
      finalEvaluation: this.normalizeLabEvaluation(candidate.finalEvaluation, discipline, subject, language),
      passingScore
    };
  }

  private buildCanonicalLabStepId(stepIndex: number): string {
    return `step_${stepIndex + 1}`;
  }

  private buildCanonicalLabChoiceId(stepId: string, choiceIndex: number): string {
    return `${stepId}_choice_${choiceIndex + 1}`;
  }

  private cloneLabChoice(stepId: string, choice: LabScenarioChoice, choiceIndex: number): LabScenarioChoice {
    return {
      id: this.buildCanonicalLabChoiceId(stepId, choiceIndex),
      text: String(choice.text || '').trim(),
      outcome: String(choice.outcome || '').trim(),
      nextStepId: choice.nextStepId ? String(choice.nextStepId).trim() : null,
      scoreImpact: Number.isFinite(choice.scoreImpact) ? Math.round(choice.scoreImpact) : 0,
      consequenceLevel: choice.consequenceLevel
    };
  }

  private cloneLabStep(
    step: LabScenarioStep,
    overrides: Partial<Omit<LabScenarioStep, 'readings' | 'choices'>> & {
      readings?: LabScenarioReading[];
      choices?: LabScenarioChoice[];
    } = {}
  ): LabScenarioStep {
    const nextId = overrides.id ?? step.id;
    const readings = (overrides.readings ?? step.readings ?? []).map((reading) => ({
      ...reading,
      label: String(reading.label || '').trim(),
      value: String(reading.value || '').trim(),
      note: typeof reading.note === 'string' && reading.note.trim() ? reading.note.trim() : undefined
    }));
    const choices = (overrides.choices ?? step.choices ?? []).map((choice, choiceIndex) =>
      this.cloneLabChoice(nextId, choice, choiceIndex)
    );

    return {
      ...step,
      ...overrides,
      id: nextId,
      title: String((overrides.title ?? step.title) || '').trim(),
      situation: String((overrides.situation ?? step.situation) || '').trim(),
      decisionPrompt: String((overrides.decisionPrompt ?? step.decisionPrompt) || '').trim(),
      readings,
      choices
    };
  }

  private buildLabStepAliasLookup(
    steps: LabScenarioStep[],
    canonicalStepIds: string[]
  ): Map<string, number[]> {
    const aliases = new Map<string, number[]>();

    steps.forEach((step, stepIndex) => {
      const possibleAliases = new Set([
        step.id,
        canonicalStepIds[stepIndex],
        `${stepIndex + 1}`,
        `scene_${stepIndex + 1}`,
        `stage_${stepIndex + 1}`,
        `step_${stepIndex + 1}`
      ]);

      possibleAliases.forEach((alias) => {
        const key = this.normalizeLabStepAlias(alias);
        if (!key) {
          return;
        }

        const existing = aliases.get(key) || [];
        aliases.set(key, [...existing, stepIndex]);
      });
    });

    return aliases;
  }

  private resolveCanonicalLabNextStepId(
    nextStepId: string | null,
    currentStepIndex: number,
    canonicalStepIds: string[],
    stepAliasLookup: Map<string, number[]>
  ): string | null {
    const normalized = this.normalizeLabStepAlias(nextStepId);
    if (!normalized) {
      return null;
    }

    const directMatches = stepAliasLookup.get(normalized) || [];
    const directForwardMatch = directMatches.find((index) => index > currentStepIndex);
    if (typeof directForwardMatch === 'number') {
      return canonicalStepIds[directForwardMatch] || null;
    }

    const numericMatch = normalized.match(/(\d+)/);
    if (!numericMatch) {
      return null;
    }

    const parsedIndex = Number.parseInt(numericMatch[1], 10) - 1;
    if (!Number.isFinite(parsedIndex) || parsedIndex <= currentStepIndex || parsedIndex >= canonicalStepIds.length) {
      return null;
    }

    return canonicalStepIds[parsedIndex] || null;
  }

  private normalizeLabStepAlias(value: unknown): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  private normalizeLabStep(step: unknown, stepIndex: number, stepCount: number, language: string): LabScenarioStep {
    const candidate = step && typeof step === 'object' ? step as Record<string, unknown> : {};
    const stepId = typeof candidate.id === 'string' && candidate.id.trim()
      ? candidate.id.trim()
      : `step_${stepIndex + 1}`;
    const fallbackNextStepId = stepIndex < stepCount - 1 ? `step_${stepIndex + 2}` : null;
    const legacyOptions = this.normalizeLegacyLabChoices(candidate, fallbackNextStepId, language, stepIndex);
    const rawChoices = Array.isArray(candidate.choices) && candidate.choices.length > 0
      ? candidate.choices
      : legacyOptions;

    const choices = rawChoices
      .slice(0, 3)
      .map((choice, choiceIndex) => this.normalizeLabChoice(choice, stepId, fallbackNextStepId, language, choiceIndex))
      .slice(0, 3);

    while (choices.length < 3) {
      choices.push(this.normalizeLabChoice(null, stepId, fallbackNextStepId, language, choices.length));
    }

    return {
      id: stepId,
      title: typeof candidate.title === 'string' && candidate.title.trim()
        ? candidate.title.trim()
        : (language === 'ar' ? `المشهد ${stepIndex + 1}` : `Scene ${stepIndex + 1}`),
      situation: typeof candidate.situation === 'string' && candidate.situation.trim()
        ? candidate.situation.trim()
        : typeof candidate.instruction === 'string' && candidate.instruction.trim()
          ? candidate.instruction.trim()
          : (language === 'ar' ? `حدث تطور مهم في الحالة عند المرحلة ${stepIndex + 1}.` : `A key development happened in the case during stage ${stepIndex + 1}.`),
      decisionPrompt: typeof candidate.decisionPrompt === 'string' && candidate.decisionPrompt.trim()
        ? candidate.decisionPrompt.trim()
        : (language === 'ar' ? 'حدثت هذه الحالة، ماذا ستفعل الآن؟' : 'This situation just happened. What will you do now?'),
      readings: [],
      choices
    };
  }

  private normalizeLabChoice(
    choice: unknown,
    stepId: string,
    fallbackNextStepId: string | null,
    language: string,
    choiceIndex: number
  ): LabScenarioChoice {
    const candidate = choice && typeof choice === 'object' ? choice as Record<string, unknown> : {};
    const consequenceLevel = this.normalizeLabConsequenceLevel(candidate.consequenceLevel, choiceIndex);
    const fallbackChoiceText = language === 'ar'
      ? `قرار محتمل ${choiceIndex + 1}`
      : `Possible decision ${choiceIndex + 1}`;

    return {
      id: this.buildCanonicalLabChoiceId(stepId, choiceIndex),
      text: typeof candidate.text === 'string' && candidate.text.trim()
        ? candidate.text.trim()
        : fallbackChoiceText,
      outcome: typeof candidate.outcome === 'string' && candidate.outcome.trim()
        ? candidate.outcome.trim()
        : (consequenceLevel === 'positive'
          ? (language === 'ar' ? 'هذا القرار يسيطر على الحالة ويقودك إلى المرحلة التالية.' : 'This decision stabilizes the situation and moves you to the next stage.')
          : consequenceLevel === 'warning'
            ? (language === 'ar' ? 'هذا القرار يخفف الخطر جزئيًا لكنه يترك أثرًا يحتاج متابعة.' : 'This decision partially reduces the risk but leaves consequences to manage.')
            : (language === 'ar' ? 'هذا القرار يؤدي إلى تدهور حرج في الحالة.' : 'This decision causes a critical deterioration in the situation.')),
      nextStepId: typeof candidate.nextStepId === 'string' && candidate.nextStepId.trim()
        ? candidate.nextStepId.trim()
        : (consequenceLevel === 'critical' ? null : fallbackNextStepId),
      scoreImpact: typeof candidate.scoreImpact === 'number' && Number.isFinite(candidate.scoreImpact)
        ? Math.round(candidate.scoreImpact)
        : (consequenceLevel === 'positive' ? 12 : consequenceLevel === 'warning' ? -6 : -22),
      consequenceLevel
    };
  }

  private normalizeLegacyLabChoices(
    step: Record<string, unknown>,
    fallbackNextStepId: string | null,
    language: string,
    stepIndex: number
  ): Array<Record<string, unknown>> {
    const rawOptions = Array.isArray(step.options)
      ? step.options.filter((option): option is string => typeof option === 'string').map(option => option.trim()).filter(Boolean)
      : [];
    const correctOption = typeof step.correctOption === 'number' && Number.isFinite(step.correctOption)
      ? Math.max(0, Math.min(2, Math.floor(step.correctOption)))
      : 0;
    const legacyFailure = typeof step.failureConsequence === 'string' && step.failureConsequence.trim()
      ? step.failureConsequence.trim()
      : (language === 'ar'
        ? 'هذا القرار يخلق أثرًا سلبيًا على سلامة الحالة أو جودتها.'
        : 'This decision creates a negative impact on safety or quality.');

    return rawOptions.slice(0, 3).map((option, optionIndex) => ({
      text: option,
      outcome: optionIndex === correctOption
        ? (language === 'ar'
          ? `هذا القرار هو الأنسب في المشهد ${stepIndex + 1} ويدفع الحالة إلى الأمام بشكل صحيح.`
          : `This is the strongest decision for scene ${stepIndex + 1} and moves the case forward correctly.`)
        : legacyFailure,
      nextStepId: optionIndex === correctOption || fallbackNextStepId ? fallbackNextStepId : null,
      scoreImpact: optionIndex === correctOption ? 12 : -12,
      consequenceLevel: optionIndex === correctOption ? 'positive' : (fallbackNextStepId ? 'warning' : 'critical')
    }));
  }

  private normalizeLabConsequenceLevel(value: unknown, choiceIndex: number): LabScenarioConsequenceLevel {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'positive' || normalized === 'warning' || normalized === 'critical') {
      return normalized;
    }
    return choiceIndex === 0 ? 'positive' : choiceIndex === 1 ? 'warning' : 'critical';
  }

  private normalizeLabDifficulty(value: unknown): LabScenarioDifficulty {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'easy' || normalized === 'medium' || normalized === 'hard') {
      return normalized;
    }
    return 'medium';
  }

  private getLabDifficultyConfig(difficulty: LabScenarioDifficulty) {
    if (difficulty === 'easy') {
      return {
        stepCount: 4,
        passingScore: 65,
        positiveImpact: 15,
        warningImpact: -4,
        criticalImpact: -18
      };
    }

    if (difficulty === 'hard') {
      return {
        stepCount: 6,
        passingScore: 80,
        positiveImpact: 10,
        warningImpact: -10,
        criticalImpact: -28
      };
    }

    return {
      stepCount: 5,
      passingScore: 72,
      positiveImpact: 12,
      warningImpact: -7,
      criticalImpact: -24
    };
  }

  private ensureLabScenarioVariety(
    steps: LabScenarioStep[],
    fallbackSteps: LabScenarioStep[],
    language: string
  ): LabScenarioStep[] {
    const stabilized: LabScenarioStep[] = [];
    const seenSignatures = new Set<string>();

    steps.forEach((step, stepIndex) => {
      const fallback = fallbackSteps[stepIndex] || fallbackSteps[fallbackSteps.length - 1];
      const previous = stabilized[stabilized.length - 1];
      const repeatedPrompt = previous
        ? this.normalizeLabTextKey(previous.decisionPrompt) === this.normalizeLabTextKey(step.decisionPrompt)
        : false;
      const repeatedChoiceSet = previous
        ? this.buildLabChoiceSetSignature(previous.choices) === this.buildLabChoiceSetSignature(step.choices)
        : false;
      const repeatedSituation = previous
        ? this.normalizeLabTextKey(previous.situation) === this.normalizeLabTextKey(step.situation)
        : false;
      const uniqueChoices = new Set(step.choices.map((choice) => this.normalizeLabTextKey(choice.text))).size;
      const currentSignature = this.buildLabStepSignature(step);

      let nextStep = (seenSignatures.has(currentSignature) || repeatedChoiceSet || (repeatedPrompt && repeatedSituation) || uniqueChoices < 3)
        ? this.cloneLabStep(fallback, { id: step.id })
        : this.cloneLabStep(step);

      if (this.isGenericLabSituation(nextStep.situation, language)) {
        nextStep = this.cloneLabStep(nextStep, { situation: fallback.situation });
      }

      if (this.isGenericLabDecisionPrompt(nextStep.decisionPrompt, language) || repeatedPrompt) {
        nextStep = this.cloneLabStep(nextStep, { decisionPrompt: fallback.decisionPrompt });
      }

      if ((nextStep.readings || []).filter((reading) => /\d/.test(reading.value)).length < 2) {
        nextStep = this.cloneLabStep(nextStep, { readings: fallback.readings });
      }

      if (new Set(nextStep.choices.map((choice) => this.normalizeLabTextKey(choice.text))).size < 3) {
        nextStep = this.cloneLabStep(nextStep, { choices: fallback.choices });
      }

      stabilized.push(nextStep);
      seenSignatures.add(this.buildLabStepSignature(nextStep));
    });

    return stabilized;
  }

  private normalizeLabTextKey(value: string): string {
    return value.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  private buildLabChoiceSetSignature(choices: LabScenarioChoice[]): string {
    return choices
      .map((choice) => this.normalizeLabTextKey(choice.text))
      .sort()
      .join('|');
  }

  private buildLabStepSignature(step: LabScenarioStep): string {
    return [
      this.normalizeLabTextKey(step.title),
      this.normalizeLabTextKey(step.situation),
      this.normalizeLabTextKey(step.decisionPrompt),
      this.buildLabChoiceSetSignature(step.choices)
    ].join('||');
  }

  private buildLabPromptAndChoiceSignature(step: LabScenarioStep): string {
    return [
      this.normalizeLabTextKey(step.decisionPrompt),
      this.buildLabChoiceSetSignature(step.choices)
    ].join('||');
  }

  private validateNormalizedLabSteps(
    steps: LabScenarioStep[],
    fallbackSteps: LabScenarioStep[],
    language: string
  ): LabScenarioStep[] {
    const seenPromptAndChoiceSignatures = new Set<string>();
    const repairedSteps = steps.map((step, stepIndex) => {
      const fallback = fallbackSteps[stepIndex] || fallbackSteps[fallbackSteps.length - 1];
      const normalizedStep = this.cloneLabStep(step, {
        id: this.buildCanonicalLabStepId(stepIndex)
      });
      const promptAndChoiceSignature = this.buildLabPromptAndChoiceSignature(normalizedStep);
      const hasPrompt = !!normalizedStep.decisionPrompt.trim();
      const hasSituation = !!normalizedStep.situation.trim();
      const uniqueChoices = new Set(normalizedStep.choices.map((choice) => this.normalizeLabTextKey(choice.text))).size;
      const duplicateDataDetected = seenPromptAndChoiceSignatures.has(promptAndChoiceSignature);

      if (!hasPrompt || !hasSituation || uniqueChoices < 3 || duplicateDataDetected) {
        const repaired = this.cloneLabStep(fallback, {
          id: normalizedStep.id
        });

        this.warnLabDebug(
          duplicateDataDetected
            ? `Duplicate lab step content detected and repaired at step ${stepIndex + 1}`
            : `Incomplete lab step detected and repaired at step ${stepIndex + 1}`,
          this.buildLabStepDebugSummary(normalizedStep)
        );

        seenPromptAndChoiceSignatures.add(this.buildLabPromptAndChoiceSignature(repaired));
        return repaired;
      }

      seenPromptAndChoiceSignatures.add(promptAndChoiceSignature);
      return normalizedStep;
    });

    return repairedSteps.map((step) => {
      const duplicateMatches = repairedSteps.filter((candidate) =>
        this.buildLabPromptAndChoiceSignature(candidate) === this.buildLabPromptAndChoiceSignature(step)
      ).length;

      if (duplicateMatches > 1) {
        this.warnLabDebug('Repeated prompt/options survived normalization', this.buildLabStepDebugSummary(step));
      }

      if (this.isGenericLabDecisionPrompt(step.decisionPrompt, language) || this.isGenericLabSituation(step.situation, language)) {
        this.warnLabDebug('Generic lab step copy detected after normalization', this.buildLabStepDebugSummary(step));
      }

      return this.cloneLabStep(step);
    });
  }

  private buildLabStepDebugSummary(step: LabScenarioStep) {
    return {
      id: step.id,
      title: step.title,
      situation: step.situation,
      decisionPrompt: step.decisionPrompt,
      choices: step.choices.map((choice) => ({
        id: choice.id,
        text: choice.text,
        nextStepId: choice.nextStepId,
        consequenceLevel: choice.consequenceLevel
      }))
    };
  }

  private buildLabScenarioDebugSummary(input: unknown) {
    const candidate = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const rawSteps = Array.isArray(candidate.steps) ? candidate.steps : [];

    return {
      title: typeof candidate.title === 'string' ? candidate.title : '',
      difficulty: typeof candidate.difficulty === 'string' ? candidate.difficulty : '',
      stepCount: rawSteps.length,
      steps: rawSteps.map((rawStep, stepIndex) => {
        const stepCandidate = rawStep && typeof rawStep === 'object' ? rawStep as Record<string, unknown> : {};
        const rawChoices = Array.isArray(stepCandidate.choices)
          ? stepCandidate.choices
          : Array.isArray(stepCandidate.options)
            ? stepCandidate.options
            : [];

        return {
          index: stepIndex,
          id: typeof stepCandidate.id === 'string' ? stepCandidate.id : '',
          title: typeof stepCandidate.title === 'string' ? stepCandidate.title : '',
          situation: typeof stepCandidate.situation === 'string'
            ? stepCandidate.situation
            : typeof stepCandidate.instruction === 'string'
              ? stepCandidate.instruction
              : '',
          decisionPrompt: typeof stepCandidate.decisionPrompt === 'string' ? stepCandidate.decisionPrompt : '',
          choices: rawChoices.map((choice) => {
            if (typeof choice === 'string') {
              return choice;
            }
            return choice && typeof choice === 'object' && typeof (choice as Record<string, unknown>).text === 'string'
              ? (choice as Record<string, unknown>).text
              : '';
          })
        };
      })
    };
  }

  private logLabDebug(message: string, payload: unknown) {
    console.debug(`[Lab Debug] ${message}`, payload);
  }

  private warnLabDebug(message: string, payload: unknown) {
    console.warn(`[Lab Debug] ${message}`, payload);
  }

  private isGenericLabSituation(situation: string, language: string): boolean {
    const normalized = this.normalizeLabTextKey(situation);
    return language === 'ar'
      ? normalized.startsWith('حدث تطور مهم في الحالة')
      : normalized.startsWith('a key development happened in the case');
  }

  private isGenericLabDecisionPrompt(prompt: string, language: string): boolean {
    const normalized = this.normalizeLabTextKey(prompt);
    return normalized === this.normalizeLabTextKey(
      language === 'ar'
        ? 'حدثت هذه الحالة، ماذا ستفعل الآن؟'
        : 'This situation just happened. What will you do now?'
    );
  }

  private normalizeLabReadings(
    readingsInput: unknown,
    discipline: string,
    subject: string,
    language: string,
    difficulty: LabScenarioDifficulty,
    stepIndex: number
  ): LabScenarioReading[] {
    const rawReadings = Array.isArray(readingsInput) ? readingsInput : [];
    const normalized = rawReadings.map((reading, index) => {
      const candidate = reading && typeof reading === 'object' ? reading as Record<string, unknown> : {};
      const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
      const value = typeof candidate.value === 'string' ? candidate.value.trim() : '';
      const note = typeof candidate.note === 'string' ? candidate.note.trim() : '';

      return {
        label: label || (language === 'ar' ? `مؤشر ${index + 1}` : `Indicator ${index + 1}`),
        value,
        note: note || undefined,
        status: this.normalizeLabReadingStatus(candidate.status) || 'watch'
      };
    });

    if (normalized.length >= 3 && normalized.filter((reading) => /\d/.test(reading.value)).length >= 2) {
      return normalized.slice(0, 5);
    }

    return this.buildFallbackLabReadings(discipline, subject, language, difficulty, stepIndex);
  }

  private normalizeLabReadingStatus(value: unknown): LabScenarioReadingStatus {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'normal' || normalized === 'watch' || normalized === 'critical') {
      return normalized;
    }
    return 'watch';
  }

  private buildFallbackLabReadings(
    discipline: string,
    subject: string,
    language: string,
    difficulty: LabScenarioDifficulty,
    stepIndex: number
  ): LabScenarioReading[] {
    const difficultyIndex = difficulty === 'easy' ? 0 : difficulty === 'hard' ? 2 : 1;
    const domain = this.detectLabScenarioDomain(discipline, subject);

    if (domain === 'medical') {
      const heartRate = 88 + (stepIndex * 7) + (difficultyIndex * 8);
      const systolic = 122 - (stepIndex * 4) - (difficultyIndex * 6);
      const diastolic = 78 - (stepIndex * 2) - (difficultyIndex * 3);
      const oxygen = 98 - stepIndex - (difficultyIndex * 2);
      const temp = (36.8 + (stepIndex * 0.2) + (difficultyIndex * 0.35)).toFixed(1);
      const marker = (1.6 + (stepIndex * 0.6) + (difficultyIndex * 0.7)).toFixed(1);

      return [
        {
          label: language === 'ar' ? 'معدل النبض' : 'Heart Rate',
          value: `${heartRate} bpm`,
          note: language === 'ar' ? 'يتغير مع ضغط الحالة' : 'Responds quickly to case pressure',
          status: heartRate >= 128 ? 'critical' : heartRate >= 108 ? 'watch' : 'normal'
        },
        {
          label: language === 'ar' ? 'ضغط الدم' : 'Blood Pressure',
          value: `${Math.max(86, systolic)}/${Math.max(52, diastolic)} mmHg`,
          note: language === 'ar' ? 'انخفاضه يهدد الاستقرار' : 'Lower values threaten stability',
          status: systolic <= 92 ? 'critical' : systolic <= 104 ? 'watch' : 'normal'
        },
        {
          label: language === 'ar' ? 'تشبع الأكسجين' : 'Oxygen Saturation',
          value: `${Math.max(84, oxygen)}%`,
          note: language === 'ar' ? 'مؤشر مباشر على الأمان الفوري' : 'Direct indicator of immediate safety',
          status: oxygen <= 90 ? 'critical' : oxygen <= 95 ? 'watch' : 'normal'
        },
        {
          label: language === 'ar' ? 'درجة الحرارة' : 'Temperature',
          value: `${temp} °C`,
          note: language === 'ar' ? 'تزداد مع شدة التدهور' : 'Rises with worsening severity',
          status: Number(temp) >= 39 ? 'critical' : Number(temp) >= 37.9 ? 'watch' : 'normal'
        },
        {
          label: language === 'ar' ? 'مؤشر مخبري' : 'Lab Marker',
          value: `${marker} mmol/L`,
          note: language === 'ar' ? 'قراءة مخبرية مرتبطة بحدة الحالة' : 'Lab-linked measure of case severity',
          status: Number(marker) >= 4 ? 'critical' : Number(marker) >= 2.5 ? 'watch' : 'normal'
        }
      ];
    }

    if (domain === 'cyber') {
      const requests = 900 + (stepIndex * 550) + (difficultyIndex * 700);
      const cpu = 46 + (stepIndex * 8) + (difficultyIndex * 10);
      const endpoints = 2 + stepIndex + (difficultyIndex * 2);
      const logGap = 3 + (stepIndex * 4) + (difficultyIndex * 5);
      const failedAuth = 18 + (stepIndex * 11) + (difficultyIndex * 15);

      return [
        {
          label: language === 'ar' ? 'الطلبات الخبيثة' : 'Malicious Requests',
          value: `${requests}/min`,
          note: language === 'ar' ? 'الحجم يرتفع مع انتشار الهجوم' : 'Volume rises as the attack spreads',
          status: requests >= 2600 ? 'critical' : requests >= 1500 ? 'watch' : 'normal'
        },
        {
          label: language === 'ar' ? 'حمل الخادم' : 'Server CPU Load',
          value: `${Math.min(99, cpu)}%`,
          note: language === 'ar' ? 'ضغط مباشر على الخدمة' : 'Direct pressure on service continuity',
          status: cpu >= 85 ? 'critical' : cpu >= 65 ? 'watch' : 'normal'
        },
        {
          label: language === 'ar' ? 'الأجهزة المتأثرة' : 'Affected Endpoints',
          value: `${endpoints}`,
          note: language === 'ar' ? 'عدد الأجهزة التي ظهرت عليها آثار الاختراق' : 'Endpoints already showing compromise',
          status: endpoints >= 7 ? 'critical' : endpoints >= 4 ? 'watch' : 'normal'
        },
        {
          label: language === 'ar' ? 'فجوة السجلات' : 'Log Gap',
          value: `${logGap} min`,
          note: language === 'ar' ? 'اتساع الفجوة يعني ضعف الرؤية' : 'A wider gap means weaker visibility',
          status: logGap >= 15 ? 'critical' : logGap >= 8 ? 'watch' : 'normal'
        },
        {
          label: language === 'ar' ? 'محاولات الدخول الفاشلة' : 'Failed Auth Attempts',
          value: `${failedAuth}`,
          note: language === 'ar' ? 'إشارة على النشاط العدائي المستمر' : 'Signal of sustained hostile activity',
          status: failedAuth >= 70 ? 'critical' : failedAuth >= 35 ? 'watch' : 'normal'
        }
      ];
    }

    if (domain === 'legal') {
      const contradictions = 1 + stepIndex + difficultyIndex;
      const timelineGap = 8 + (stepIndex * 6) + (difficultyIndex * 8);
      const evidenceItems = 1 + stepIndex + difficultyIndex;
      const blindSpot = 12 + (stepIndex * 5) + (difficultyIndex * 7);
      const deadline = 26 - (stepIndex * 3) - (difficultyIndex * 4);

      return [
        {
          label: language === 'ar' ? 'التناقضات في الإفادات' : 'Statement Contradictions',
          value: `${contradictions}`,
          note: language === 'ar' ? 'كل زيادة تحتاج فحصًا أعمق' : 'Each increase requires deeper verification',
          status: contradictions >= 5 ? 'critical' : contradictions >= 3 ? 'watch' : 'normal'
        },
        {
          label: language === 'ar' ? 'الفجوة الزمنية' : 'Timeline Gap',
          value: `${timelineGap} min`,
          note: language === 'ar' ? 'الفجوة الكبيرة تُضعف الرواية' : 'Larger gaps weaken the narrative',
          status: timelineGap >= 28 ? 'critical' : timelineGap >= 16 ? 'watch' : 'normal'
        },
        {
          label: language === 'ar' ? 'أدلة غير موثقة' : 'Unverified Evidence Items',
          value: `${evidenceItems}`,
          note: language === 'ar' ? 'تراكمها يرفع المخاطر الإجرائية' : 'Accumulation raises procedural risk',
          status: evidenceItems >= 5 ? 'critical' : evidenceItems >= 3 ? 'watch' : 'normal'
        },
        {
          label: language === 'ar' ? 'منطقة عمياء في التسجيل' : 'CCTV Blind Spot',
          value: `${blindSpot} m`,
          note: language === 'ar' ? 'كلما زادت المنطقة زادت الحاجة للبدائل' : 'Longer blind spots require stronger substitutes',
          status: blindSpot >= 30 ? 'critical' : blindSpot >= 18 ? 'watch' : 'normal'
        },
        {
          label: language === 'ar' ? 'الوقت المتبقي إجرائياً' : 'Procedural Deadline',
          value: `${Math.max(6, deadline)} min`,
          note: language === 'ar' ? 'الوقت القصير يضغط على القرار' : 'Shorter windows tighten judgment',
          status: deadline <= 8 ? 'critical' : deadline <= 15 ? 'watch' : 'normal'
        }
      ];
    }

    if (domain === 'engineering') {
      const pressure = 78 + (stepIndex * 6) + (difficultyIndex * 10);
      const surfaceTemp = 48 + (stepIndex * 7) + (difficultyIndex * 9);
      const vibration = (1.8 + (stepIndex * 0.9) + (difficultyIndex * 1.2)).toFixed(1);
      const load = (1.2 + (stepIndex * 0.3) + (difficultyIndex * 0.4)).toFixed(1);
      const defect = (0.8 + (stepIndex * 0.7) + (difficultyIndex * 0.9)).toFixed(1);

      return [
        {
          label: language === 'ar' ? 'الضغط التشغيلي' : 'Operating Pressure',
          value: `${pressure} psi`,
          note: language === 'ar' ? 'ارتفاعه قد يهدد السلامة' : 'Higher values may threaten safety',
          status: pressure >= 108 ? 'critical' : pressure >= 90 ? 'watch' : 'normal'
        },
        {
          label: language === 'ar' ? 'الحرارة السطحية' : 'Surface Temperature',
          value: `${surfaceTemp} °C`,
          note: language === 'ar' ? 'الزيادة تشير إلى إجهاد متصاعد' : 'Higher values suggest escalating stress',
          status: surfaceTemp >= 80 ? 'critical' : surfaceTemp >= 62 ? 'watch' : 'normal'
        },
        {
          label: language === 'ar' ? 'الاهتزاز' : 'Vibration',
          value: `${vibration} mm/s`,
          note: language === 'ar' ? 'ارتفاعه يسبق الأعطال غالبًا' : 'Rising values often precede failures',
          status: Number(vibration) >= 5.2 ? 'critical' : Number(vibration) >= 3 ? 'watch' : 'normal'
        },
        {
          label: language === 'ar' ? 'الحمل الحالي' : 'Current Load',
          value: `${load} t`,
          note: language === 'ar' ? 'يرتبط مباشرة بحدود التشغيل' : 'Directly tied to operating limits',
          status: Number(load) >= 2.6 ? 'critical' : Number(load) >= 1.8 ? 'watch' : 'normal'
        },
        {
          label: language === 'ar' ? 'اتساع العيب' : 'Defect Width',
          value: `${defect} mm`,
          note: language === 'ar' ? 'اتساعه يغيّر قرار الاستمرار أو الإيقاف' : 'Width changes the stop-or-continue decision',
          status: Number(defect) >= 3.4 ? 'critical' : Number(defect) >= 1.8 ? 'watch' : 'normal'
        }
      ];
    }

    const queue = 14 + (stepIndex * 8) + (difficultyIndex * 10);
    const sla = 42 - (stepIndex * 4) - (difficultyIndex * 5);
    const budget = (2.5 + (stepIndex * 1.4) + (difficultyIndex * 1.8)).toFixed(1);
    const errorRate = (1.2 + (stepIndex * 0.8) + (difficultyIndex * 1.0)).toFixed(1);
    const complaints = 3 + (stepIndex * 2) + (difficultyIndex * 3);

    return [
      {
        label: language === 'ar' ? 'حجم التراكم' : 'Queue Volume',
        value: `${queue}`,
        note: language === 'ar' ? 'ارتفاعه يضغط على الخدمة' : 'Higher values pressure throughput',
        status: queue >= 42 ? 'critical' : queue >= 24 ? 'watch' : 'normal'
      },
      {
        label: language === 'ar' ? 'الوقت المتبقي على الالتزام' : 'SLA Remaining',
        value: `${Math.max(8, sla)} min`,
        note: language === 'ar' ? 'الوقت القصير يرفع كلفة الخطأ' : 'Shorter windows raise the cost of error',
        status: sla <= 10 ? 'critical' : sla <= 20 ? 'watch' : 'normal'
      },
      {
        label: language === 'ar' ? 'الانحراف المالي' : 'Budget Drift',
        value: `${budget}%`,
        note: language === 'ar' ? 'الزيادة تعني فقدان السيطرة' : 'Higher drift means weaker control',
        status: Number(budget) >= 8 ? 'critical' : Number(budget) >= 4.5 ? 'watch' : 'normal'
      },
      {
        label: language === 'ar' ? 'معدل الخطأ' : 'Error Rate',
        value: `${errorRate}%`,
        note: language === 'ar' ? 'يعكس جودة التنفيذ الحالية' : 'Reflects current execution quality',
        status: Number(errorRate) >= 4.5 ? 'critical' : Number(errorRate) >= 2.4 ? 'watch' : 'normal'
      },
      {
        label: language === 'ar' ? 'الشكاوى المفتوحة' : 'Open Complaints',
        value: `${complaints}`,
        note: language === 'ar' ? 'تزيد مع سوء الإغلاق والمتابعة' : 'Climbs when closure quality drops',
        status: complaints >= 12 ? 'critical' : complaints >= 6 ? 'watch' : 'normal'
      }
    ];
  }

  private detectLabScenarioDomain(discipline: string, subject: string): 'medical' | 'cyber' | 'legal' | 'engineering' | 'business' {
    const source = `${discipline} ${subject}`.toLowerCase();

    if (/(طب|تمريض|صيدل|مريض|تحاليل|مخبري|طوارئ|اسعاف|علاج|سريري|medical|nurs|pharma|patient|clinical|emergency|health)/.test(source)) {
      return 'medical';
    }

    if (/(سيبر|أمن|شبك|خادم|اختراق|هجوم|رقمي|معلومات|برمج|cyber|security|incident|network|server|breach|malware|forensic|it)/.test(source)) {
      return 'cyber';
    }

    if (/(قانون|محكم|تحقيق|شاهد|شرطة|حقوق|قضائ|مرافعة|legal|law|court|witness|investigat|police|evidence|compliance)/.test(source)) {
      return 'legal';
    }

    if (/(هندس|سيارات|ميكاني|كهرب|مدني|طريق|ورشة|مصنع|ضغط|جسر|محرك|engineering|mechanic|automotive|electrical|civil|workshop|factory|machine|pressure|bridge)/.test(source)) {
      return 'engineering';
    }

    return 'business';
  }

  private normalizeLabItems(itemsInput: unknown, discipline: string, subject: string, language: string): LabScenarioItem[] {
    const rawItems = Array.isArray(itemsInput) ? itemsInput : [];
    const normalized = rawItems.map((item, index) => {
      const candidate = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return {
        name: typeof candidate.name === 'string' && candidate.name.trim()
          ? candidate.name.trim()
          : (language === 'ar' ? `عنصر بيئة ${index + 1}` : `Scene element ${index + 1}`),
        icon: typeof candidate.icon === 'string' && candidate.icon.trim()
          ? candidate.icon.trim()
          : this.defaultLabIcon(index),
        role: typeof candidate.role === 'string' && candidate.role.trim()
          ? candidate.role.trim()
          : undefined
      } satisfies LabScenarioItem;
    }).filter(item => item.name);

    if (normalized.length > 0) {
      return normalized.slice(0, 8);
    }

    return [
      {
        name: language === 'ar' ? `بيئة ${discipline}` : `${discipline} environment`,
        icon: 'fa-solid fa-building',
        role: language === 'ar' ? 'سياق العمل المحيط بالحالة' : 'Workplace context surrounding the case'
      },
      {
        name: subject,
        icon: 'fa-solid fa-diagram-project',
        role: language === 'ar' ? 'المحور المهني الأساسي للمشهد' : 'Main professional focus of the scene'
      },
      {
        name: language === 'ar' ? 'الشخصيات المعنية' : 'Stakeholders',
        icon: 'fa-solid fa-user-group',
        role: language === 'ar' ? 'الأطراف التي تتأثر بقرارك' : 'People affected by your decision'
      },
      {
        name: language === 'ar' ? 'مؤشرات الخطر' : 'Risk indicators',
        icon: 'fa-solid fa-triangle-exclamation',
        role: language === 'ar' ? 'الإشارات التي يجب مراقبتها أثناء التقدم' : 'Signals you need to monitor as the case evolves'
      }
    ];
  }

  private normalizeLabEvaluation(
    evaluationInput: unknown,
    discipline: string,
    subject: string,
    language: string
  ): LabScenarioEvaluation {
    const candidate = evaluationInput && typeof evaluationInput === 'object'
      ? evaluationInput as Record<string, unknown>
      : {};

    const strengths = Array.isArray(candidate.strengths)
      ? candidate.strengths.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 4)
      : [];
    const improvements = Array.isArray(candidate.improvements)
      ? candidate.improvements.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 4)
      : [];

    return {
      summary: typeof candidate.summary === 'string' && candidate.summary.trim()
        ? candidate.summary.trim()
        : (language === 'ar'
          ? `هذا السيناريو يقيس قدرتك على اتخاذ قرار مهني صحيح تحت ضغط داخل مجال ${discipline} في موضوع ${subject}.`
          : `This scenario measures your ability to make sound professional decisions under pressure in ${discipline} around ${subject}.`),
      strengths: strengths.length > 0
        ? strengths
        : [
          language === 'ar' ? 'قراءة الموقف قبل التصرف.' : 'Reading the situation before acting.',
          language === 'ar' ? 'تحديد الأولوية المهنية الصحيحة.' : 'Choosing the correct professional priority.'
        ],
      improvements: improvements.length > 0
        ? improvements
        : [
          language === 'ar' ? 'تقليل التردد عند ظهور مؤشرات الخطر.' : 'Reduce hesitation when risk indicators appear.',
          language === 'ar' ? 'ربط القرار بالأثر على من حولك.' : 'Connect each decision to its impact on others.'
        ],
      recommendedAction: typeof candidate.recommendedAction === 'string' && candidate.recommendedAction.trim()
        ? candidate.recommendedAction.trim()
        : (language === 'ar'
          ? 'أعد السيناريو وركّز على الموقف ثم العواقب قبل اختيار القرار التالي.'
          : 'Replay the scenario and focus on the situation first, then on consequences before choosing the next move.')
    };
  }

  private buildFallbackLabScenario(
    discipline: string,
    subject: string,
    language: string,
    difficulty: LabScenarioDifficulty = 'medium',
    stepCount: number = this.getLabDifficultyConfig(difficulty).stepCount
  ): LabScenario {
    const config = this.getLabDifficultyConfig(difficulty);
    const safeStepCount = Math.max(config.stepCount, stepCount);
    const openingReadings = this.buildFallbackLabReadings(discipline, subject, language, difficulty, 0).slice(0, 3);

    return {
      title: language === 'ar'
        ? `محاكاة ${this.labDifficultyLabel(difficulty, language)} في ${discipline}`
        : `${this.labDifficultyLabel(difficulty, language)} ${discipline} simulation`,
      description: language === 'ar'
        ? `تدخل في موقف مهني متدرج حول ${subject} مع بيانات رقمية وقرارات تتغير حسب مستوى الصعوبة ${this.labDifficultyLabel(difficulty, language)}.`
        : `Enter a progressive workplace scenario about ${subject} with measurable indicators and decisions tuned for ${this.labDifficultyLabel(difficulty, language)} difficulty.`,
      environment: language === 'ar'
        ? `بيئة عمل مرتبطة بتخصص ${discipline}`
        : `${discipline} workplace environment`,
      openingSituation: language === 'ar'
        ? `بدأت الحالة فعليًا، والمؤشرات الأولى تُظهر ${openingReadings[0]?.label}: ${openingReadings[0]?.value}، ${openingReadings[1]?.label}: ${openingReadings[1]?.value}، و${openingReadings[2]?.label}: ${openingReadings[2]?.value}. عليك أن تبني قرارك الأول مباشرة على هذه المعطيات.`
        : `The case is already active, and the first readings show ${openingReadings[0]?.label}: ${openingReadings[0]?.value}, ${openingReadings[1]?.label}: ${openingReadings[1]?.value}, and ${openingReadings[2]?.label}: ${openingReadings[2]?.value}. Your first decision must be built directly on these indicators.`,
      imagePrompt: `${discipline} ${subject} realistic workplace simulation ${difficulty}`,
      difficulty,
      passingScore: config.passingScore,
      steps: Array.from({ length: safeStepCount }, (_, stepIndex) =>
        this.buildFallbackLabStep(discipline, subject, language, difficulty, stepIndex, safeStepCount)
      ),
      items: this.normalizeLabItems(null, discipline, subject, language),
      finalEvaluation: this.normalizeLabEvaluation(null, discipline, subject, language)
    };
  }

  private buildFallbackLabStep(
    discipline: string,
    subject: string,
    language: string,
    difficulty: LabScenarioDifficulty,
    stepIndex: number,
    totalSteps: number
  ): LabScenarioStep {
    const config = this.getLabDifficultyConfig(difficulty);
    const stepId = this.buildCanonicalLabStepId(stepIndex);
    const nextStepId = stepIndex < totalSteps - 1 ? this.buildCanonicalLabStepId(stepIndex + 1) : null;
    const readings = this.buildFallbackLabReadings(discipline, subject, language, difficulty, stepIndex);
    const primary = readings[0];
    const secondary = readings[1];
    const tertiary = readings[2];
    const titlesAr = ['التقييم الأولي', 'تحديث المؤشرات', 'تعقيد إضافي', 'قرار محوري', 'تحقق تحت ضغط', 'إغلاق نهائي'];
    const titlesEn = ['Initial Assessment', 'Indicator Update', 'Added Complication', 'Decision Pivot', 'Pressure Verification', 'Final Closure'];
    const phaseTitle = language === 'ar'
      ? (titlesAr[stepIndex] || `المشهد ${stepIndex + 1}`)
      : (titlesEn[stepIndex] || `Scene ${stepIndex + 1}`);

    let situation = '';
    if (stepIndex === 0) {
      situation = language === 'ar'
        ? `وصلت إلى المشهد وظهرت أمامك مؤشرات أولية واضحة: ${primary.label} = ${primary.value}، ${secondary.label} = ${secondary.value}، ${tertiary.label} = ${tertiary.value}. الضغط مرتفع لأن موضوع ${subject} يتطور الآن داخل بيئة ${discipline}.`
        : `You arrive at the scene and the first measurable indicators are already visible: ${primary.label} = ${primary.value}, ${secondary.label} = ${secondary.value}, and ${tertiary.label} = ${tertiary.value}. Pressure is high because ${subject} is actively unfolding inside a ${discipline} environment.`;
    } else if (stepIndex === totalSteps - 1) {
      situation = language === 'ar'
        ? `اقتربت من نهاية السيناريو، لكن بيانات الإغلاق ما زالت تحتاج حكمًا مهنيًا دقيقًا: ${primary.label} = ${primary.value}، ${secondary.label} = ${secondary.value}، ${tertiary.label} = ${tertiary.value}. أي تسرع الآن قد يفسد ما بُني سابقًا.`
        : `You are close to finishing the scenario, but the closing data still demands precise professional judgment: ${primary.label} = ${primary.value}, ${secondary.label} = ${secondary.value}, and ${tertiary.label} = ${tertiary.value}. A rushed decision here can undo earlier gains.`;
    } else if (stepIndex === 2 && difficulty !== 'easy') {
      situation = language === 'ar'
        ? `ظهر تعقيد إضافي في منتصف الحالة، وأصبحت القراءات الحالية أكثر حساسية: ${primary.label} = ${primary.value}، ${secondary.label} = ${secondary.value}، ${tertiary.label} = ${tertiary.value}. لم يعد يكفي اتخاذ قرار سريع دون تفسير أثره.`
        : `An additional complication emerges mid-case, and the current readings are now more sensitive: ${primary.label} = ${primary.value}, ${secondary.label} = ${secondary.value}, and ${tertiary.label} = ${tertiary.value}. A quick decision alone is no longer enough without understanding its impact.`;
    } else {
      situation = language === 'ar'
        ? `بعد القرار السابق تغيرت معطيات المشهد إلى ${primary.label} = ${primary.value}، ${secondary.label} = ${secondary.value}، و${tertiary.label} = ${tertiary.value}. الحالة لا تزال قابلة للسيطرة، لكن هامش الخطأ أصبح أضيق.`
        : `After the previous decision, the scene shifted to ${primary.label} = ${primary.value}, ${secondary.label} = ${secondary.value}, and ${tertiary.label} = ${tertiary.value}. The case remains manageable, but the margin for error is now smaller.`;
    }

    const decisionPrompt = stepIndex === totalSteps - 1
      ? (language === 'ar'
        ? `في مرحلة ${phaseTitle}، ومع بقاء ${primary.label} عند ${primary.value} و${secondary.label} عند ${secondary.value}، ما الإغلاق المهني الأكثر أمانًا وقابلية للدفاع عنه؟`
        : `During ${phaseTitle}, with ${primary.label} at ${primary.value} and ${secondary.label} at ${secondary.value}, what is the safest and most defensible professional close-out?`)
      : difficulty === 'easy'
        ? (language === 'ar'
          ? `في ${phaseTitle}، وبالاعتماد على ${primary.label} = ${primary.value} و${secondary.label} = ${secondary.value}، ما الخطوة الأبسط والأكثر مباشرة الآن؟`
          : `In ${phaseTitle}, with ${primary.label} = ${primary.value} and ${secondary.label} = ${secondary.value}, what is the simplest and most direct next move now?`)
        : difficulty === 'hard'
          ? (language === 'ar'
            ? `في ${phaseTitle}، كيف توازن بين ${primary.label} = ${primary.value} و${tertiary.label} = ${tertiary.value} لحماية النتيجة تحت الضغط؟`
            : `In ${phaseTitle}, which decision best balances ${primary.label} = ${primary.value} with ${tertiary.label} = ${tertiary.value} to protect the outcome under pressure?`)
          : (language === 'ar'
            ? `في ${phaseTitle}، أي قرار مهني يجب أن يتقدم الآن مع ${primary.label} = ${primary.value} و${secondary.label} = ${secondary.value}؟`
            : `In ${phaseTitle}, which professional decision should take priority now with ${primary.label} = ${primary.value} and ${secondary.label} = ${secondary.value}?`);

    const positiveText = stepIndex === totalSteps - 1
      ? (language === 'ar'
        ? `أراجع ${primary.label} (${primary.value}) و${secondary.label} (${secondary.value}) مراجعة ختامية، أوثّق ما تغيّر في ${phaseTitle}، ثم أغلق الحالة رسميًا.`
        : `Perform a final review of ${primary.label} (${primary.value}) and ${secondary.label} (${secondary.value}), document what changed in ${phaseTitle}, and then close the case formally.`)
      : (language === 'ar'
        ? `أربط قراري في ${phaseTitle} مباشرة بـ ${primary.label} (${primary.value})، وأضع نقطة تحقق سريعة لـ ${secondary.label} (${secondary.value}) قبل الانتقال.`
        : `Tie the decision in ${phaseTitle} directly to ${primary.label} (${primary.value}) and set an immediate check on ${secondary.label} (${secondary.value}) before moving on.`);

    const warningText = stepIndex === totalSteps - 1
      ? (language === 'ar'
        ? `أغلق الحالة بعد تحسن جزئي فقط في ${primary.label} (${primary.value}) من دون مراجعة كافية لـ ${secondary.label} (${secondary.value}).`
        : `Close the case after only partial improvement in ${primary.label} (${primary.value}) without a sufficient review of ${secondary.label} (${secondary.value}).`)
      : (language === 'ar'
        ? `أتعامل في ${phaseTitle} مع المؤشر الأسرع ظهورًا فقط، وأؤجل التحقق من ${secondary.label} (${secondary.value}) و${tertiary.label} (${tertiary.value}).`
        : `In ${phaseTitle}, address only the most visible indicator and postpone checking ${secondary.label} (${secondary.value}) and ${tertiary.label} (${tertiary.value}).`);

    const criticalText = stepIndex === totalSteps - 1
      ? (language === 'ar'
        ? `أعلن انتهاء المشكلة فورًا في ${phaseTitle} من دون التأكد من ${primary.label} (${primary.value}) أو أثر القرار النهائي على من حولي.`
        : `Declare the issue resolved immediately in ${phaseTitle} without verifying ${primary.label} (${primary.value}) or the downstream effect of the final decision.`)
      : (language === 'ar'
        ? `أتجاهل في ${phaseTitle} قراءات ${primary.label} (${primary.value}) و${secondary.label} (${secondary.value}) وأعتمد على الانطباع العام فقط.`
        : `In ${phaseTitle}, ignore the current ${primary.label} (${primary.value}) and ${secondary.label} (${secondary.value}) readings and rely only on general impression.`);

    const positiveOutcome = stepIndex === totalSteps - 1
      ? (language === 'ar'
        ? `أغلقت الحالة بعد مراجعة نهائية منضبطة في ${phaseTitle}، وأثبتت أن ${primary.label} عند ${primary.value} لم يعد يهدد المسار.`
        : `You closed the case with disciplined final verification in ${phaseTitle}, showing that ${primary.label} at ${primary.value} no longer threatens the outcome.`)
      : (language === 'ar'
        ? `اعتمدت في ${phaseTitle} على المؤشرات الصحيحة، فتم احتواء الخطر المرتبط بـ ${primary.label} (${primary.value}) مع متابعة مباشرة لـ ${secondary.label} (${secondary.value}).`
        : `In ${phaseTitle}, you acted on the right indicators, containing the risk tied to ${primary.label} (${primary.value}) while directly monitoring ${secondary.label} (${secondary.value}).`);

    const warningOutcome = stepIndex === totalSteps - 1
      ? (language === 'ar'
        ? `تم الإغلاق في ${phaseTitle}، لكن بقيت ملاحظة مهنية لأن ${primary.label} (${primary.value}) لم يُراجع بما يكفي قبل إنهاء الحالة.`
        : `The case was closed in ${phaseTitle}, but a professional concern remained because ${primary.label} (${primary.value}) was not reviewed thoroughly enough before closure.`)
      : (language === 'ar'
        ? `خفضت الضغط مؤقتًا في ${phaseTitle}، لكن تأجيل مراجعة ${secondary.label} (${secondary.value}) و${tertiary.label} (${tertiary.value}) ترك ثغرة ستعود لاحقًا.`
        : `You reduced pressure temporarily in ${phaseTitle}, but postponing ${secondary.label} (${secondary.value}) and ${tertiary.label} (${tertiary.value}) left a gap that will return later.`);

    const criticalOutcome = stepIndex === totalSteps - 1
      ? (language === 'ar'
        ? `أُعلن الإغلاق مبكرًا في ${phaseTitle} ثم ظهر أن ${primary.label} (${primary.value}) و${secondary.label} (${secondary.value}) ما زالا خارج السيطرة، فانتهى السيناريو بنتيجة حرجة.`
        : `Closure was declared too early in ${phaseTitle}, and it became clear that ${primary.label} (${primary.value}) and ${secondary.label} (${secondary.value}) were still out of control, ending the scenario critically.`)
      : (language === 'ar'
        ? `تجاهل ${primary.label} (${primary.value}) في ${phaseTitle} أدى إلى تدهور حرج وسحب السيطرة من المشهد الحالي.`
        : `Ignoring ${primary.label} (${primary.value}) in ${phaseTitle} caused a critical deterioration and removed control from the current scene.`);

    return {
      id: stepId,
      title: phaseTitle,
      situation,
      decisionPrompt,
      readings,
      choices: [
        {
          id: this.buildCanonicalLabChoiceId(stepId, 0),
          text: positiveText,
          outcome: positiveOutcome,
          nextStepId,
          scoreImpact: config.positiveImpact,
          consequenceLevel: 'positive'
        },
        {
          id: this.buildCanonicalLabChoiceId(stepId, 1),
          text: warningText,
          outcome: warningOutcome,
          nextStepId,
          scoreImpact: config.warningImpact,
          consequenceLevel: 'warning'
        },
        {
          id: this.buildCanonicalLabChoiceId(stepId, 2),
          text: criticalText,
          outcome: criticalOutcome,
          nextStepId: null,
          scoreImpact: config.criticalImpact,
          consequenceLevel: 'critical'
        }
      ]
    };
  }

  private labDifficultyLabel(difficulty: LabScenarioDifficulty, language: string): string {
    if (language === 'ar') {
      return difficulty === 'easy' ? 'سهل' : difficulty === 'hard' ? 'صعب' : 'متوسط';
    }

    return difficulty === 'easy' ? 'Easy' : difficulty === 'hard' ? 'Hard' : 'Medium';
  }

  private defaultLabIcon(index: number) {
    return [
      'fa-solid fa-building',
      'fa-solid fa-user-group',
      'fa-solid fa-clipboard-check',
      'fa-solid fa-shield-heart',
      'fa-solid fa-scale-balanced',
      'fa-solid fa-briefcase',
      'fa-solid fa-stethoscope',
      'fa-solid fa-screwdriver-wrench'
    ][index % 8];
  }

  async generateLabImage(prompt: string): Promise<string> {
    void prompt;
    return '';
  }

  async getPageContent(book: BookMetadata, page: number): Promise<string> {
    return this.retry(async () => {
      return this.chatViaSiteAIEndpoint(
        `Simulate educational page content for page ${page} from book "${book.title}" by ${book.authors.join(', ')}.`,
        `Respond in ${book.language || this.languageName}. Keep it academically clear.`,
        []
      );
    });
  }

  async askAboutPage(bookTitle: string, pageContent: string, query: string): Promise<string> {
    return this.retry(async () => {
      return this.chatViaSiteAIEndpoint(
        `Book: ${bookTitle}\nPage Content: ${pageContent}\nQuestion: ${query}`,
        `You are an academic tutor. Respond in ${this.languageName}.`,
        [],
        false,
        undefined,
        [],
        undefined,
        { featureHint: 'knowledge', knowledgeMode: 'strict' }
      );
    });
  }

  async getMotivation(name: string, context: string): Promise<string> {
    return this.retry(async () => {
      return this.chatViaSiteAIEndpoint(
        `User Name: ${name}. Context/Mood: ${context}.`,
        `Generate a short, powerful motivational quote in ${this.languageName}.`,
        [],
        false,
        undefined,
        [],
        undefined,
        { knowledgeMode: 'off' }
      );
    });
  }

  async academicSearch(query: string, level: string = 'academic', language: string = 'ar'): Promise<AcademicResearchResult> {
    return this.retry(async () => {
      const langName = this.getLanguageName(language);
      const levelGuide: Record<string, string> = {
        academic: 'Deep academic depth with theory, evidence, critique, and research framing.',
        university: 'University depth with strong conceptual explanation, applied examples, and structured analysis.',
        high_school: 'High-school depth with simpler language, clearer transitions, and educational examples.',
        summarized: 'Concise but still complete from introduction to conclusion, with compressed sections.'
      };

      const maxTokens = 4200;
      const guidance = levelGuide[level] || levelGuide['academic'];
      const message = [
        `Research topic: "${query}".`,
        `Level: ${level}.`,
        `Language: ${langName}.`,
        guidance,
        'Create a full research paper from introduction to conclusion, not a loose explanation.',
        'Use academically structured sections with coherent transitions.',
        'If comparison, classification, chronology, metrics, or methods would help understanding, include one or more well-formed tables.',
        'Sources must be real-looking credible URLs from trustworthy domains only. Avoid fake or placeholder links.',
        'Every section must be substantive enough to feel like a complete integrated research output.'
      ].join(' ');

      const instructions = [
        'Return JSON with keys: title, executiveSummary, sections[{heading,paragraphs,bullets}], tables[{title,columns,rows,summary}], conclusion, sources[{title,uri,publisher,year,credibilityNote}].',
        'Return JSON with keys: title, sections, conclusion, tables, sources. Each section must include heading and paragraphs. Add executiveSummary if possible.'
      ];

      let bestResult: AcademicResearchResult | null = null;
      let lastError: unknown = null;

      for (const instruction of instructions) {
        try {
          const raw = await this.jsonViaSiteAIEndpoint<Record<string, unknown>>(
            message,
            instruction,
            undefined,
            [],
            maxTokens,
            langName
          );

          const normalized = this.normalizeAcademicResearchResult(raw, query, level, language);
          if (!bestResult || normalized.sections.length > bestResult.sections.length || normalized.sources.length > bestResult.sources.length) {
            bestResult = normalized;
          }

          if (normalized.sections.length >= 4 && normalized.sources.length >= 2) {
            return normalized;
          }
        } catch (error) {
          lastError = error;
        }
      }

      if (bestResult) {
        return bestResult;
      }

      if (lastError) {
        throw lastError;
      }

      return this.normalizeAcademicResearchResult(null, query, level, language);
    });
  }

  normalizeAcademicResearchResult(
    input: unknown,
    query: string,
    level: string,
    language: string = this.currentLanguage()
  ): AcademicResearchResult {
    const candidate = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const rawSections = Array.isArray(candidate.sections) ? candidate.sections : [];
    const rawTables = Array.isArray(candidate.tables) ? candidate.tables : [];
    const rawSources = Array.isArray(candidate.sources) ? candidate.sources : [];
    const legacyText = typeof candidate.text === 'string' ? candidate.text.trim() : '';

    const sections = rawSections.length > 0
      ? rawSections.map((section, index) => this.normalizeAcademicResearchSection(section, index, language)).filter(section => section.paragraphs.length > 0)
      : this.buildSectionsFromLegacyResearchText(legacyText, language);
    const tables = rawTables
      .map((table, index) => this.normalizeAcademicResearchTable(table, index, language))
      .filter(table => table.columns.length >= 2 && table.rows.length > 0);
    const sources = rawSources
      .map(source => this.normalizeAcademicResearchSource(source))
      .filter((source): source is AcademicResearchSource => !!source)
      .filter((source, index, list) => list.findIndex(item => item.uri === source.uri) === index)
      .slice(0, 12);

    const title = typeof candidate.title === 'string' && candidate.title.trim()
      ? candidate.title.trim()
      : (language === 'ar' ? `بحث أكاديمي حول ${query}` : `Academic Research on ${query}`);
    const executiveSummary = typeof candidate.executiveSummary === 'string' && candidate.executiveSummary.trim()
      ? candidate.executiveSummary.trim()
      : this.buildDefaultResearchSummary(query, level, language);
    const conclusion = typeof candidate.conclusion === 'string' && candidate.conclusion.trim()
      ? candidate.conclusion.trim()
      : this.buildDefaultResearchConclusion(query, language);

    const result: AcademicResearchResult = {
      title,
      executiveSummary,
      sections: sections.length > 0 ? sections : this.buildFallbackResearchSections(query, level, language),
      tables,
      conclusion,
      sources,
      text: ''
    };

    result.text = this.buildAcademicResearchText(result, language);
    return result;
  }

  private normalizeAcademicResearchSection(section: unknown, index: number, language: string): AcademicResearchSection {
    const candidate = section && typeof section === 'object' ? section as Record<string, unknown> : {};
    const paragraphs = Array.isArray(candidate.paragraphs)
      ? candidate.paragraphs.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean)
      : [];
    const bullets = Array.isArray(candidate.bullets)
      ? candidate.bullets.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 8)
      : [];

    return {
      heading: typeof candidate.heading === 'string' && candidate.heading.trim()
        ? candidate.heading.trim()
        : (language === 'ar' ? `قسم ${index + 1}` : `Section ${index + 1}`),
      paragraphs,
      bullets
    };
  }

  private normalizeAcademicResearchTable(table: unknown, index: number, language: string): AcademicResearchTable {
    const candidate = table && typeof table === 'object' ? table as Record<string, unknown> : {};
    const columns = Array.isArray(candidate.columns)
      ? candidate.columns.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean).slice(0, 6)
      : [];
    const rows = Array.isArray(candidate.rows)
      ? candidate.rows
        .filter((row): row is unknown[] => Array.isArray(row))
        .map(row => row.map(cell => String(cell ?? '').trim()).slice(0, columns.length || 6))
        .filter(row => row.some(Boolean))
        .map(row => {
          const normalizedRow = [...row];
          while (normalizedRow.length < columns.length) {
            normalizedRow.push('');
          }
          return normalizedRow;
        })
        .slice(0, 12)
      : [];

    return {
      title: typeof candidate.title === 'string' && candidate.title.trim()
        ? candidate.title.trim()
        : (language === 'ar' ? `جدول ${index + 1}` : `Table ${index + 1}`),
      columns,
      rows,
      summary: typeof candidate.summary === 'string' && candidate.summary.trim() ? candidate.summary.trim() : undefined
    };
  }

  private normalizeAcademicResearchSource(source: unknown): AcademicResearchSource | null {
    const candidate = source && typeof source === 'object' ? source as Record<string, unknown> : {};
    const uri = String(candidate.uri || '').trim();
    if (!this.isLikelyValidResearchUrl(uri)) {
      return null;
    }

    return {
      title: String(candidate.title || '').trim() || uri,
      uri,
      publisher: String(candidate.publisher || '').trim() || undefined,
      year: String(candidate.year || '').trim() || undefined,
      credibilityNote: String(candidate.credibilityNote || '').trim() || undefined
    };
  }

  private buildAcademicResearchText(result: AcademicResearchResult, language: string): string {
    const lines: string[] = [
      result.title,
      '',
      language === 'ar' ? 'الملخص التنفيذي' : 'Executive Summary',
      result.executiveSummary,
      ''
    ];

    result.sections.forEach((section) => {
      lines.push(section.heading);
      lines.push(...section.paragraphs);
      if (section.bullets && section.bullets.length > 0) {
        section.bullets.forEach((bullet) => {
          lines.push(language === 'ar' ? `- ${bullet}` : `- ${bullet}`);
        });
      }
      lines.push('');
    });

    if (result.tables.length > 0) {
      lines.push(language === 'ar' ? 'الجداول' : 'Tables');
      lines.push('');
      result.tables.forEach((table) => {
        lines.push(table.title);
        lines.push(table.columns.join(' | '));
        table.rows.forEach((row) => lines.push(row.join(' | ')));
        if (table.summary) {
          lines.push(table.summary);
        }
        lines.push('');
      });
    }

    lines.push(language === 'ar' ? 'الخاتمة' : 'Conclusion');
    lines.push(result.conclusion);
    lines.push('');

    if (result.sources.length > 0) {
      lines.push(language === 'ar' ? 'المراجع' : 'References');
      result.sources.forEach((source) => {
        const meta = [source.publisher, source.year].filter(Boolean).join(' - ');
        lines.push(meta ? `${source.title} (${meta}) - ${source.uri}` : `${source.title} - ${source.uri}`);
      });
    }

    return lines.join('\n').trim();
  }

  private buildSectionsFromLegacyResearchText(text: string, language: string): AcademicResearchSection[] {
    const chunks = text
      .split(/\n\s*\n/g)
      .map(chunk => chunk.trim())
      .filter(Boolean);

    if (chunks.length === 0) {
      return [];
    }

    const sectionHeadings = language === 'ar'
      ? ['مقدمة', 'الخلفية النظرية', 'التحليل والمناقشة', 'التطبيقات العملية', 'التحديات والقيود']
      : ['Introduction', 'Theoretical Background', 'Analysis and Discussion', 'Practical Applications', 'Challenges and Limitations'];

    return chunks.slice(0, 5).map((chunk, index) => ({
      heading: sectionHeadings[index] || (language === 'ar' ? `قسم ${index + 1}` : `Section ${index + 1}`),
      paragraphs: [chunk],
      bullets: []
    }));
  }

  private buildFallbackResearchSections(query: string, level: string, language: string): AcademicResearchSection[] {
    const levelTone = level === 'high_school'
      ? (language === 'ar' ? 'بصياغة تعليمية أوضح ومبسطة' : 'with clearer and simpler educational wording')
      : level === 'summarized'
        ? (language === 'ar' ? 'بصيغة مركزة لكنها كاملة' : 'in a concise but complete format')
        : (language === 'ar' ? 'بصياغة أكاديمية منظمة' : 'in an organized academic format');

    return [
      {
        heading: language === 'ar' ? 'المقدمة' : 'Introduction',
        paragraphs: [
          language === 'ar'
            ? `يتناول هذا البحث موضوع ${query} ${levelTone}، مع التركيز على أهميته النظرية والتطبيقية.`
            : `This research addresses ${query} ${levelTone}, focusing on its theoretical and practical importance.`
        ]
      },
      {
        heading: language === 'ar' ? 'المناقشة والتحليل' : 'Discussion and Analysis',
        paragraphs: [
          language === 'ar'
            ? `يعرض هذا القسم الأبعاد الرئيسية للموضوع، والعوامل المؤثرة فيه، وكيفية فهمه ضمن إطار معرفي منظم.`
            : 'This section presents the major dimensions of the topic, the factors influencing it, and how it can be understood within a structured knowledge framework.'
        ]
      },
      {
        heading: language === 'ar' ? 'التطبيقات والتحديات' : 'Applications and Challenges',
        paragraphs: [
          language === 'ar'
            ? 'يبيّن هذا القسم التطبيقات العملية للموضوع، إضافة إلى أبرز التحديات أو القيود التي تؤثر في تنفيذه أو تقييمه.'
            : 'This section highlights the practical applications of the topic as well as the major challenges or constraints affecting its implementation or evaluation.'
        ]
      }
    ];
  }

  // ...existing code...
  private buildDefaultResearchSummary(query: string, level: string, language: string) {
    if (language === 'ar') {
      return `يقدم هذا البحث عرضًا منظمًا لموضوع ${query} بحسب مستوى ${level}، مع إبراز الفكرة الأساسية، أوجه التطبيق، وأهم النقاط التي يجب على الطالب فهمها بوضوح.`;
    }
    return `This research provides a structured treatment of ${query} at the ${level} level, highlighting the core idea, applications, and the main points a student should understand clearly.`;
  }

  private buildDefaultResearchConclusion(query: string, language: string): string {
    if (language === 'ar') {
      return `خاتمة هذا البحث حول ${query} تؤكد أهمية استمرار الدراسة والمراجعة التطبيقية، مع التركيز على النقاط الرئيسية والاستنتاجات العملية.`;
    }

    return `Conclusion for ${query} emphasizes the value of continued study and practical application, summarizing the core insights and next steps for learners.`;
  }

  private isLikelyValidResearchUrl(uri: string): boolean {
    if (!/^https?:\/\//i.test(uri)) {
      return false;
    }

    if (/example\.com|localhost|127\.0\.0\.1|your[-_ ]?source|insert[-_ ]?link/i.test(uri)) {
      return false;
    }

    try {
      const url = new URL(uri);
      const host = url.hostname.toLowerCase();

      if (!host.includes('.') || host.length < 6) {
        return false;
      }

      if (/(youtube\.com|youtu\.be|facebook\.com|instagram\.com|tiktok\.com|x\.com|twitter\.com|whatsapp\.com|drive\.google\.com|dropbox\.com)/i.test(host)) {
        return false;
      }

      const trustedDomainPatterns = [
        /\.edu$/i,
        /\.gov$/i,
        /doi\.org$/i,
        /cdc\.gov$/i,
        /ncbi\.nlm\.nih\.gov$/i,
        /pubmed\.ncbi\.nlm\.nih\.gov$/i,
        /medscape\.com$/i,
        /uptodate\.com$/i,
        /sciencedirect\.com$/i,
        /springer\.com$/i,
        /nature\.com$/i,
        /wiley\.com$/i,
        /frontiersin\.org$/i,
        /tandfonline\.com$/i,
        /sagepub\.com$/i,
        /jamanetwork\.com$/i,
        /thelancet\.com$/i,
        /nejm\.org$/i,
        /ieee\.org$/i,
        /standards\.ieee\.org$/i,
        /acm\.org$/i,
        /iso\.org$/i,
        /mit\.edu$/i,
        /semanticscholar\.org$/i,
        /arxiv\.org$/i,
        /jstor\.org$/i,
        /cambridge\.org$/i,
        /oup\.com$/i,
        /oxfordacademic\.com$/i,
        /plos\.org$/i,
        /bmj\.com$/i,
        /mdpi\.com$/i,
        /legislation\.gov\.uk$/i,
        /eur-lex\.europa\.eu$/i,
        /congress\.gov$/i,
        /loc\.gov$/i,
        /worldbank\.org$/i,
        /who\.int$/i,
        /oecd\.org$/i,
        /un\.org$/i,
        /unesco\.org$/i,
        /nih\.gov$/i
      ];

      return trustedDomainPatterns.some((pattern) => pattern.test(host));
    } catch {
      return false;
    }
  }
}
