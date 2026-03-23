
import { Component, signal, ChangeDetectionStrategy, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LandingComponent } from './components/landing.component';
import { AuthComponent } from './components/auth.component';
import { SidebarComponent } from './components/layout/sidebar.component';
import { AIService, UsageStats } from './services/ai.service';
import { ChatService } from './services/chat.service';
import { AuthService } from './services/auth.service';
import { LocalizationService } from './services/localization.service';
import { NavigationHistoryService } from './services/navigation-history.service';
import { LanguageCode } from './i18n/language-config';

// Page Components
import { TutorPage } from './components/pages/tutor.page';
import { ResearchPage } from './components/pages/research.page';
import { SubscriptionPage } from './components/pages/subscription.page';
import { ProfilePage } from './components/pages/profile.page';
import { AdminPage } from './components/pages/admin.page';
import { TeacherPage } from './components/pages/teacher.page';
import { SettingsPage } from './components/pages/settings.page';
import { NotificationsPage } from './components/pages/notifications.page';
import { MarketplacePage } from './components/pages/marketplace.page';
import { ContentTransformPage } from './components/pages/content-transform.page';
import { FileTranslatorPage } from './components/pages/file-translator.page';
import { FileStudyPage } from './components/pages/file-study.page';
import { PlannerPage } from './components/pages/planner.page';
import { LevelsPage } from './components/pages/levels.page';
import { TimerPage } from './components/pages/timer.page';
import { FlashcardsPage } from './components/pages/flashcards.page';
import { MindMapPage } from './components/pages/mindmap.page';
import { QuizPage } from './components/pages/quiz.page';
import { AuroraBgComponent } from './components/shared/aurora-bg.component';
import { AchievementNotificationComponent } from './components/layout/achievement-notification.component';
import { VirtualLabPage } from './components/pages/virtual-lab/virtual-lab.page';

export type AppView = 'landing' | 'auth' | 'dashboard';
export type DashboardPage = 
  'overview' | 'tutor' | 'research' | 
  'levels' |
  'subscription' | 'profile' | 'admin' | 'teacher' | 'settings' | 
  'notifications' | 'marketplace' | 
  'transform' | 'file-translator' | 'file-study' | 'lab' | 'planner' | 'timer' | 'flashcards' | 'mindmap' | 'quiz';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, LandingComponent, AuthComponent, SidebarComponent,
    TutorPage, ResearchPage, 
    SubscriptionPage, ProfilePage, LevelsPage,
    AdminPage, TeacherPage, SettingsPage, NotificationsPage, 
    MarketplacePage,
    ContentTransformPage, FileTranslatorPage, FileStudyPage, VirtualLabPage,
    PlannerPage, TimerPage, FlashcardsPage, MindMapPage, QuizPage, AuroraBgComponent, AchievementNotificationComponent
  ],
  template: `
    <div
      [class.dark]="isDarkMode()"
      [dir]="localization.direction()"
      [attr.lang]="language()"
      class="smartedge-locale-root relative min-h-screen transition-colors duration-500"
      [class.text-white]="true"
    >
      <app-aurora-bg></app-aurora-bg>
      <app-achievement-notification></app-achievement-notification>
      
      <!-- Global Switchers -->
      <div class="fixed bottom-6 right-6 z-[200] flex gap-4">
          <div class="relative">
            <button (click)="languageMenuOpen.update(v => !v)" class="min-w-[12rem] rounded-2xl glass shadow-3xl flex items-center justify-between gap-3 px-4 py-3 font-black text-indigo-200 hover:scale-[1.02] active:scale-95 transition border border-white/5">
              <i class="fa-solid fa-language text-indigo-400"></i>
              <div class="flex-1 text-right">
                <p class="text-[9px] uppercase tracking-[0.28em] text-slate-500">{{ localization.coreText('language.switcher') }}</p>
                <p class="text-sm text-white" data-no-i18n>{{ currentLanguageMeta().nativeName }}</p>
              </div>
              <i class="fa-solid fa-chevron-up text-[10px] text-slate-500 transition" [class.rotate-180]="!languageMenuOpen()"></i>
            </button>
            @if (languageMenuOpen()) {
              <div class="absolute bottom-[calc(100%+0.75rem)] right-0 w-72 max-h-[28rem] overflow-y-auto rounded-[2rem] border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-2xl">
                <div class="px-3 pb-3 text-right">
                  <p class="text-[10px] font-black uppercase tracking-[0.32em] text-indigo-300">{{ localization.coreText('language.current') }}</p>
                  <p class="mt-2 text-sm font-bold text-white">{{ currentLanguageMeta().nativeName }}</p>
                  <p class="text-[11px] text-slate-500">{{ localization.coreText('language.choose') }}</p>
                </div>
                <div class="space-y-1" data-no-i18n>
                  @for (item of localization.supportedLanguages; track item.code) {
                    <button
                      (click)="setLanguage(item.code)"
                      [class.bg-indigo-500/15]="language() === item.code"
                      [class.border-indigo-500/30]="language() === item.code"
                      class="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/5 px-4 py-3 text-right transition hover:border-white/15 hover:bg-white/5"
                    >
                      <span class="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{{ item.englishName }}</span>
                      <div>
                        <p class="text-sm font-black text-white">{{ item.nativeName }}</p>
                        <p class="text-[10px] text-slate-500">{{ item.direction === 'rtl' ? 'RTL' : 'LTR' }}</p>
                      </div>
                    </button>
                  }
                </div>
              </div>
            }
          </div>
          <button (click)="toggleTheme()" class="w-14 h-14 rounded-2xl glass shadow-3xl flex items-center justify-center text-amber-500 hover:scale-110 active:scale-90 transition border border-white/5">
            <i class="fa-solid text-xl" [class.fa-moon]="!isDarkMode()" [class.fa-sun]="isDarkMode()"></i>
          </button>
      </div>

      <!-- Main Router Emulator -->
      @if (view() === 'landing') {
        <app-landing (started)="setView('auth')"></app-landing>
      } @else if (view() === 'auth') {
        <app-auth (authSuccess)="setView('dashboard')"></app-auth>
      } @else if (view() === 'dashboard') {
        <div class="flex h-screen overflow-hidden">
          <!-- Sidebar Backdrop for Mobile -->
          @if (!sidebarCollapsed()) {
            <div (click)="toggleSidebar()" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] lg:hidden animate-in fade-in duration-300"></div>
          }

          <app-sidebar [activePage]="activePage()" 
                       [isCollapsed]="sidebarCollapsed()" 
                       (toggleSidebar)="toggleSidebar()"
                       (pageChange)="setActivePage($event)" 
                       (logout)="handleLogout()"></app-sidebar>
          
          <main class="flex-1 overflow-y-auto no-scrollbar relative">
            @if (activePage() !== 'tutor' && activePage() !== 'flashcards' && activePage() !== 'mindmap' && activePage() !== 'lab' && activePage() !== 'file-study' && activePage() !== 'file-translator') {
              <header class="sticky top-0 z-40 h-20 md:h-24 glass border-b border-white/5 flex items-center justify-between px-6 md:px-12 backdrop-blur-3xl transition-all shadow-2xl">
                <div class="flex items-center gap-3 md:gap-6">
                   <!-- Sidebar Toggle -->
                   <button (click)="toggleSidebar()" 
                           class="w-10 h-10 md:w-12 md:h-12 rounded-xl glass hover:bg-white/10 flex items-center justify-center text-white transition shadow-lg border border-white/5">
                     <i class="fa-solid fa-bars"></i>
                   </button>

                   @if (activePage() !== 'overview') {
                      <button (click)="goBackFromHeader()" 
                           class="group w-10 h-10 md:w-12 md:h-12 rounded-xl bg-white/5 hover:bg-indigo-600 transition-all duration-300 flex items-center justify-center text-white shadow-lg border border-white/10 active:scale-90">
                        <i class="fa-solid transition-transform duration-300" 
                           [class.group-hover:-translate-x-1]="!isRtl()"
                           [class.group-hover:translate-x-1]="isRtl()"
                           [class.fa-arrow-right]="isRtl()" 
                           [class.fa-arrow-left]="!isRtl()"></i>
                      </button>
                   }
                   <div class="w-1.5 h-8 md:w-2 md:h-10 bg-indigo-600 rounded-full"></div>
                   <h1 class="text-lg md:text-2xl font-black capitalize text-white tracking-tight truncate max-w-[150px] md:max-w-none">{{ getPageTitle(activePage()) }}</h1>
                </div>
                <div class="flex items-center gap-2 md:gap-8">
                  <!-- Attempts Left Badge -->
                  @if (ai.userPlan() === 'free') {
                    <div class="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                      <i class="fa-solid fa-bolt-lightning text-xs"></i>
                      <span class="text-[10px] font-black uppercase tracking-widest">
                        {{ t('Attempts Left:') }}
                        {{ ai.getRemainingAttemptsLabel(getFeatureKey(activePage())) }}
                      </span>
                    </div>
                  }
                  
                  <button (click)="activePage.set('subscription')" class="hidden sm:flex items-center gap-2 glass p-2 px-4 rounded-xl border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition shadow-lg">
                     <i class="fa-solid fa-credit-card"></i>
                     <span class="font-black text-xs uppercase tracking-widest">{{ t('Subscriptions') }}</span>
                  </button>
                  <div class="flex items-center gap-2 md:gap-3 glass p-2 px-3 md:px-6 rounded-2xl border border-white/10">
                     <i class="fa-solid fa-coins text-amber-400 text-xs md:text-lg"></i>
                     <span class="font-black text-[10px] md:text-sm text-white tabular-nums">{{ ai.userXP() }} XP</span>
                  </div>
                  <button (click)="activePage.set('profile')" class="flex items-center gap-2 md:gap-4 glass p-1.5 md:p-2 px-2 md:px-6 rounded-2xl hover:bg-white/10 transition border border-white/10 shadow-xl">
                    <div class="w-7 h-7 md:w-10 md:h-10 rounded-lg md:rounded-xl shadow-md border border-white/10 overflow-hidden flex items-center justify-center bg-slate-800">
                      @if (ai.profileImage()) {
                        <img [src]="ai.profileImage()" class="w-full h-full object-cover">
                      } @else {
                        <i class="fa-solid fa-user text-slate-500 text-xs md:text-sm"></i>
                      }
                    </div>
                    <div class="hidden sm:block text-right">
                      <p class="text-xs md:text-sm font-black text-white truncate max-w-[80px] md:max-w-none">{{ ai.userName() }}</p>
                      <p class="text-[8px] md:text-[9px] text-slate-500 uppercase tracking-widest font-black">{{ t('Pro Student') }}</p>
                    </div>
                  </button>
                </div>
              </header>
            }

            <div [class]="activePage() === 'tutor' || activePage() === 'flashcards' || activePage() === 'mindmap' || activePage() === 'lab' || activePage() === 'file-study' || activePage() === 'file-translator' ? 'h-screen' : 'h-[calc(100vh-5rem)] md:h-[calc(100vh-6rem)]'"
                 class="relative overflow-x-hidden">
              <div class="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
                @switch (activePage()) {
                  @case ('overview') { 
                    <div class="p-6 md:p-12 space-y-12 md:space-y-16">
                      <!-- Hero Section -->
                      <div class="bg-gradient-to-br from-indigo-600 via-indigo-900 to-slate-950 p-8 md:p-16 rounded-[2.5rem] md:rounded-[4.5rem] text-white shadow-3xl relative overflow-hidden group border border-white/10">
                         <div class="relative z-10 space-y-6 md:space-y-8">
                            <h2 class="text-4xl md:text-7xl font-black tracking-tighter leading-tight md:leading-none">{{ t('Welcome to') }} <br> <span class="text-indigo-400">{{ t('StudyVex AI') }}</span></h2>
                            <p class="text-indigo-100 text-lg md:text-2xl opacity-90 leading-relaxed font-bold max-w-2xl">{{ t('Explore premium AI study tools and start learning smarter today.') }}</p>
                            <div class="flex flex-col sm:flex-row gap-4 md:gap-6">
                               <button (click)="activePage.set('tutor')" class="bg-white text-slate-950 px-8 md:px-12 py-4 md:py-5 rounded-2xl md:rounded-[2rem] font-black text-lg md:text-xl hover:scale-105 transition shadow-2xl">{{ t('Start a learning session') }}</button>
                            </div>
                         </div>
                         <!-- Decorative element -->
                         <div class="absolute -right-20 -bottom-20 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] group-hover:bg-indigo-500/30 transition-all duration-1000"></div>
                      </div>

                      <!-- Navigation Grid -->
                      <div class="space-y-12">
                        <div class="flex items-center gap-4">
                          <div class="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                          <h3 class="text-xl md:text-2xl font-black text-white">{{ t('Quick access to tools') }}</h3>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                          @for (item of filteredNavItems; track item.id) {
                            <button (click)="setActivePage(item.id)" 
                                    class="group relative flex items-start gap-6 p-8 rounded-[2.5rem] glass border border-white/5 hover:border-indigo-500/30 hover:bg-white/5 transition-all duration-500 hover:-translate-y-2 shadow-xl text-right">
                              <div [class]="'w-16 h-16 md:w-20 md:h-20 rounded-3xl ' + item.color + ' flex items-center justify-center text-white text-2xl md:text-3xl shadow-lg group-hover:scale-110 transition-transform duration-500 shrink-0'">
                                <i [class]="'fa-solid ' + item.icon"></i>
                              </div>
                              <div class="space-y-2">
                                <h4 class="text-lg font-black text-white group-hover:text-indigo-400 transition-colors">{{ item.label }}</h4>
                                <p class="text-xs text-slate-500 font-bold leading-relaxed">{{ item.desc }}</p>
                              </div>
                              
                              <!-- Hover Glow -->
                              <div class="absolute inset-0 rounded-[2.5rem] bg-indigo-500/0 group-hover:bg-indigo-500/5 transition-colors duration-500"></div>
                            </button>
                          }
                        </div>
                      </div>
                    </div>
                  }
                  @case ('tutor') { <app-tutor-page (back)="goBackFromPage()" (openFlashcards)="activePage.set('flashcards')" (openMindMap)="activePage.set('mindmap')" (openVirtualLab)="activePage.set('lab')" (openFileStudy)="activePage.set('file-study')" /> }
                  @case ('research') { <div class="p-6 md:p-12"><app-research-page (back)="goBackFromPage()" (openFlashcards)="activePage.set('flashcards')" (openMindMap)="activePage.set('mindmap')" /></div> }
                  @case ('levels') { <div class="p-6 md:p-12"><app-levels-page /></div> }
                  @case ('subscription') { <div class="p-6 md:p-12"><app-subscription-page /></div> }
                  @case ('profile') { <div class="p-6 md:p-12"><app-profile-page /></div> }
                  @case ('admin') { <div class="p-6 md:p-12"><app-admin-page /></div> }
                  @case ('teacher') { <div class="p-6 md:p-12"><app-teacher-page /></div> }
                  @case ('settings') { <div class="p-6 md:p-12"><app-settings-page /></div> }
                  @case ('notifications') { <div class="p-6 md:p-12"><app-notifications-page /></div> }
                  @case ('marketplace') { <div class="p-6 md:p-12"><app-marketplace-page /></div> }
                  @case ('transform') { <div class="p-6 md:p-12"><app-content-transform-page (back)="goBackFromPage()" (openFlashcards)="activePage.set('flashcards')" (openMindMap)="activePage.set('mindmap')" (openTutor)="activePage.set('tutor')" /></div> }
                  @case ('file-translator') { <app-file-translator-page (back)="goBackFromPage()" (openTutor)="activePage.set('tutor')" (openFlashcards)="activePage.set('flashcards')" /> }
                  @case ('file-study') { <app-file-study-page (back)="goBackFromPage('tutor')" (openTutor)="activePage.set('tutor')" /> }
                  @case ('lab') { <app-virtual-lab-page (back)="goBackFromPage()" /> }
                  @case ('planner') { <app-planner-page (pageChange)="setActivePage($event)" /> }
                  @case ('timer') { <div class="p-6 md:p-12"><app-timer-page /></div> }
                  @case ('flashcards') { <app-flashcards-page (back)="goBackFromPage($event)" /> }
                  @case ('mindmap') { <app-mindmap-page (back)="goBackFromPage($event)" (openFlashcards)="activePage.set('flashcards')" /> }
                  @case ('quiz') { <div class="p-6 md:p-12"><app-quiz-page /></div> }
                }
              </div>
            </div>
          </main>
        </div>
      }
    </div>
  `,
  host: { 'class': 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  public ai = inject(AIService);
  public chatService = inject(ChatService);
  private auth = inject(AuthService);
  public localization = inject(LocalizationService);
  private readonly navigationHistory = inject(NavigationHistoryService);
  private readonly handleHashChange = () => {
    const page = this.resolvePageFromHash(window.location.hash);
    if (page) {
      this.activePage.set(page);
    }
  };
  
  view = signal<AppView>('landing'); 
  activePage = signal<DashboardPage>('overview'); 
  sidebarCollapsed = signal(true);
  isDarkMode = signal(true);
  language = computed(() => this.localization.currentLanguage());
  isRtl = computed(() => this.localization.direction() === 'rtl');
  currentLanguageMeta = computed(() => this.localization.currentLanguageMeta());
  languageMenuOpen = signal(false);
  readonly t = (text: string) => this.localization.phrase(text);

  private readonly navItemBlueprints: Array<{ id: DashboardPage; label: string; icon: string; color: string; desc: string }> = [
    { id: 'tutor', label: 'AI Tutor', icon: 'fa-robot', color: 'bg-indigo-500', desc: 'Command Center: Control your learning path with AI assistance.' },
    { id: 'levels', label: 'Student Level', icon: 'fa-chart-simple', color: 'bg-amber-500', desc: 'Command Center: Review your true level and academic progress.' },
    { id: 'planner', label: 'Study Planner', icon: 'fa-map-location-dot', color: 'bg-blue-500', desc: 'Command Center: An intelligent roadmap to manage your time and resources.' },
    { id: 'timer', label: 'Smart Timer', icon: 'fa-stopwatch', color: 'bg-rose-500', desc: 'Command Center: Advanced focus tools to improve the efficiency of your study sessions.' },
    { id: 'quiz', label: 'AI Exam', icon: 'fa-clipboard-question', color: 'bg-fuchsia-500', desc: 'Command Center: Build smart exams from your topic or uploaded files with review and error analysis.' },
    { id: 'research', label: 'Academic Research', icon: 'fa-microscope', color: 'bg-purple-500', desc: 'Command Center: Your gateway to global knowledge and trusted sources.' },
    { id: 'file-study', label: 'Explain File', icon: 'fa-book-open-reader', color: 'bg-cyan-400', desc: 'Command Center: Study a PDF with a calm reader on one side and a live page explanation on the other.' },
    { id: 'transform', label: 'Content Transform', icon: 'fa-wand-magic-sparkles', color: 'bg-orange-500', desc: 'Command Center: Transform your raw material into summaries and mind maps.' },
    { id: 'file-translator', label: 'Smart File Translator', icon: 'fa-language', color: 'bg-cyan-500', desc: 'Command Center: Translate medical and academic files with bilingual preview and export support.' },
    { id: 'lab', label: 'Virtual Lab', icon: 'fa-flask', color: 'bg-teal-500', desc: 'Command Center: A realistic professional simulation with sequential decisions inside authentic work environments.' },
    { id: 'teacher', label: 'Teacher Panel', icon: 'fa-chalkboard-user', color: 'bg-sky-500', desc: 'Command Center: Integrated supervision tools for managing the learning process.' },
    { id: 'settings', label: 'Settings', icon: 'fa-gear', color: 'bg-zinc-500', desc: 'Command Center: Customize your workspace to fit your needs.' },
    { id: 'profile', label: 'Profile', icon: 'fa-user', color: 'bg-indigo-400', desc: 'Command Center: Review your academic identity and track your overall progress.' },
  ];

  get filteredNavItems() {
    return this.navItemBlueprints.filter(item => {
      if (!this.canAccessPage(item.id)) return false;
      if (item.id === 'admin') return this.ai.userRole() === 'admin';
      if (item.id === 'teacher') return this.ai.userRole() === 'teacher' || this.ai.userRole() === 'admin';
      return true;
    }).map((item) => ({
      ...item,
      label: item.id === 'file-study'
        ? (this.localization.currentLanguage() === 'ar' ? 'اشرح ملف' : 'Explain File')
        : this.t(item.label),
      desc: this.t(item.desc)
    }));
  }

  constructor() {
    (window as unknown as Record<string, unknown>)['appComponent'] = this;
    queueMicrotask(() => this.localization.observeDocument(document.body));

    const hashPage = this.resolvePageFromHash(window.location.hash);
    if (hashPage) {
      this.activePage.set(hashPage);
    } else {
      const storedPage = localStorage.getItem('smartedge_active_page');
      if (this.isDashboardPage(storedPage)) {
        this.activePage.set(storedPage);
      }
    }
    window.addEventListener('hashchange', this.handleHashChange);

    // Handle Stripe Success
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      this.ai.upgradeToPro();
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    effect(() => {
      const user = this.auth.currentUser();
      if (user && this.view() !== 'dashboard') {
        this.view.set('dashboard');
      }
      if (!user && this.view() === 'dashboard') {
        this.navigationHistory.clear();
        this.view.set('landing');
      }
    });

    effect(() => {
      localStorage.setItem('smartedge_active_page', this.activePage());
    });

    effect(() => {
      if (this.view() !== 'dashboard') {
        return;
      }

      this.navigationHistory.recordVisit(this.activePage());
    });

    effect(() => {
      if (this.view() !== 'dashboard') {
        return;
      }

      const nextHash = this.pageToHash(this.activePage());
      if (this.activePage() === 'lab') {
        const currentHash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
        if (currentHash === 'dashboard/lab' || currentHash.startsWith('dashboard/lab/')) {
          return;
        }
      }

      if (window.location.hash !== nextHash) {
        window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}${nextHash}`);
      }
    });
  }

  toggleTheme() { this.isDarkMode.update(v => !v); }
  toggleSidebar() { this.sidebarCollapsed.update(v => !v); }
  async setLanguage(language: LanguageCode) {
    await this.localization.setLanguage(language);
    this.languageMenuOpen.set(false);
  }
  setView(v: AppView) { this.view.set(v); }
  setActivePage(page: DashboardPage | string) {
    if (this.isDashboardPage(page)) {
      this.activePage.set(page);
    }
  }
  
  async handleLogout() {
    try {
      await this.auth.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      this.navigationHistory.clear();
      this.activePage.set('overview');
      this.setView('landing');
    }
  }

  goBackFromHeader() {
    this.goBackFromPage();
  }

  goBackFromPage(fallbackPage?: DashboardPage | string | null) {
    const currentPage = this.activePage();
    const explicitFallback = this.isDashboardPage(fallbackPage || null) ? fallbackPage : null;
    const fallback = explicitFallback || this.defaultFallbackFor(currentPage);
    const target = this.navigationHistory.back(currentPage, fallback);
    if (this.isDashboardPage(target)) {
      this.activePage.set(target);
    }
  }

  getPageTitle(page: DashboardPage): string {
    const titles: Record<DashboardPage, string> = {
      overview: 'Overview',
      tutor: 'AI Tutor',
      research: 'Academic Research',
      levels: 'Student Level',
      subscription: 'Subscriptions',
      profile: 'Profile',
      admin: 'Admin',
      teacher: 'Teacher Panel',
      settings: 'Settings',
      notifications: 'Notifications',
      marketplace: 'Marketplace',
      transform: 'Content Transform',
      'file-translator': 'Smart File Translator',
      'file-study': this.localization.currentLanguage() === 'ar' ? 'اشرح ملف' : 'Explain File',
      lab: 'Virtual Lab',
      planner: 'Study Planner',
      timer: 'Smart Timer',
      'flashcards': 'Smart Flashcards',
      'mindmap': 'Smart Mind Map',
      quiz: 'AI Exam'
    };
    return this.t(titles[page]);
  }

  getFeatureKey(page: DashboardPage): keyof Omit<UsageStats, 'lastResetDate'> {
    const map: Record<string, keyof Omit<UsageStats, 'lastResetDate'>> = {
      tutor: 'aiTeacherQuestions',
      research: 'academicResearch',
      transform: 'contentLabConversions',
      'file-translator': 'contentLabConversions',
      'file-study': 'aiTeacherQuestions',
      lab: 'virtualLabSimulations',
      quiz: 'smartTests',
      'flashcards': 'aiTeacherQuestions',
      'mindmap': 'aiTeacherQuestions'
    };
    return map[page] || 'aiTeacherQuestions';
  }

  private isDashboardPage(value: string | null): value is DashboardPage {
    if (!value) {
      return false;
    }
    if (value === 'quiz' && !this.canAccessPage('quiz')) {
      return false;
    }

    return value === 'overview' ||
      value === 'tutor' ||
      value === 'research' ||
      value === 'levels' ||
      value === 'subscription' ||
      value === 'profile' ||
      value === 'admin' ||
      value === 'teacher' ||
      value === 'settings' ||
      value === 'notifications' ||
      value === 'marketplace' ||
      value === 'transform' ||
      value === 'file-translator' ||
      value === 'file-study' ||
      value === 'lab' ||
      value === 'planner' ||
      value === 'timer' ||
      value === 'flashcards' ||
      value === 'mindmap' ||
      value === 'quiz';
  }

  private canAccessPage(page: DashboardPage): boolean {
    if (page === 'quiz') {
      return this.ai.isFeatureEnabled('aiExam');
    }
    return true;
  }

  private defaultFallbackFor(page: DashboardPage): DashboardPage {
    switch (page) {
      case 'flashcards':
        return 'overview';
      case 'mindmap':
        return 'overview';
      case 'file-study':
        return 'tutor';
      default:
        return 'overview';
    }
  }

  private pageToHash(page: DashboardPage): string {
    return `#dashboard/${page}`;
  }

  private resolvePageFromHash(hash: string): DashboardPage | null {
    const normalized = hash.replace(/^#/, '').trim().toLowerCase();
    if (!normalized.startsWith('dashboard/')) {
      return null;
    }

    const route = normalized.slice('dashboard/'.length).split('/')[0];
    return this.isDashboardPage(route) ? route : null;
  }
}

