
import { Component, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';
import { LocalizationService } from '../services/localization.service';

interface PromoFeedback {
  type: 'success' | 'error';
  message: string;
  activationDate?: string;
  expirationDate?: string;
  durationDays?: number;
}

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center p-6 bg-slate-950 relative overflow-hidden">
      <!-- Animated Background Circles -->
      <div class="absolute inset-0 z-0">
        <div class="absolute top-1/4 left-1/4 w-[50rem] h-[50rem] bg-indigo-600/10 rounded-full blur-[150px] animate-pulse"></div>
        <div class="absolute bottom-1/4 right-1/4 w-[50rem] h-[50rem] bg-purple-600/10 rounded-full blur-[150px] animate-pulse delay-700"></div>
      </div>

      <div class="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-0 glass rounded-[4rem] border border-white/5 shadow-3xl overflow-hidden relative z-10 animate-in zoom-in duration-700">
        
        <!-- Left: Platform Showcase (The Powerful Side) -->
        <div class="hidden lg:flex flex-col justify-center p-24 bg-gradient-to-br from-indigo-600/20 to-slate-900 border-e border-white/5 relative overflow-hidden">
          <div class="relative z-10 space-y-12 text-right">
            <div class="w-24 h-24 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white text-5xl font-black shadow-2xl mb-12">S</div>
            <h2 class="text-6xl font-black text-white leading-tight tracking-tighter">{{ t('Technology Sovereignty Gateway') }}</h2>
            <p class="text-slate-400 text-2xl leading-relaxed font-bold">{{ t("Join a community of more than 800,000 researchers using the world's most powerful AI technologies.") }}</p>
            
            <div class="space-y-10 pt-16">
              @for (point of infoPoints; track point.label) {
                <div class="flex items-center gap-6 justify-end group">
                  <span class="text-lg font-black text-slate-300 group-hover:text-white transition">{{ point.label }}</span>
                  <div class="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-2xl shadow-xl border border-white/10 group-hover:scale-110 transition" [class.text-indigo-400]="point.color === 'indigo'" [class.text-emerald-400]="point.color === 'emerald'" [class.text-amber-400]="point.color === 'amber'">
                    <i [class]="point.icon"></i>
                  </div>
                </div>
              }
            </div>
          </div>
          <i class="fa-solid fa-atom absolute -left-20 -bottom-20 text-[30rem] opacity-5 rotate-12"></i>
        </div>

        <!-- Right: Auth Form (The Minimal Side) -->
        <div class="p-16 md:p-24 flex flex-col justify-center bg-slate-900/40 backdrop-blur-3xl">
          @if (step() === 'form') {
            <div class="text-center mb-16">
              <h3 class="text-5xl font-black text-white mb-4 tracking-tighter">{{ isLogin() ? t('Sign In') : t('Create a New Account') }}</h3>
              <p class="text-slate-500 text-xl font-bold">{{ isLogin() ? t('If you are not registered yet, click "Create Account" first.') : t('Create your account once and keep all your progress and levels.') }}</p>
              <div class="mt-6">
                <button (click)="openPromoModal()" class="text-indigo-400 font-black text-sm uppercase tracking-[0.5em] hover:underline">
                  تفعيل كود
                </button>
              </div>
            </div>

            <div class="space-y-8 text-right">
              @if (!isLogin()) {
                <div class="animate-in slide-in-from-top-10 duration-500">
                  <label class="block text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 mr-4">{{ t('Full Name') }}</label>
                  <input type="text" [(ngModel)]="fullName" class="w-full p-6 rounded-[1.8rem] bg-slate-950 text-white border border-white/5 focus:ring-4 ring-indigo-600/20 outline-none transition text-xl font-bold" [placeholder]="t('Full Name')">
                </div>
              }
              
              <div>
                <label class="block text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 mr-4">{{ t('Email') }}</label>
                <input type="email" [(ngModel)]="email" class="w-full p-6 rounded-[1.8rem] bg-slate-950 text-white border border-white/5 focus:ring-4 ring-indigo-600/20 outline-none transition text-xl font-bold" placeholder="name@domain.com">
              </div>

              <div>
                <div class="flex justify-between items-center mb-4 px-4">
                   <button class="text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:underline">{{ t('Forgot password?') }}</button>
                   <label class="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">{{ t('Password') }}</label>
                </div>
                <input type="password" [(ngModel)]="password" class="w-full p-6 rounded-[1.8rem] bg-slate-950 text-white border border-white/5 focus:ring-4 ring-indigo-600/20 outline-none transition text-xl font-bold" placeholder="••••••••">
              </div>

              <button (click)="submit()" [disabled]="isBusy()" class="w-full bg-indigo-600 text-white py-8 rounded-[2rem] font-black text-2xl hover:scale-105 active:scale-95 transition shadow-[0_30px_60px_rgba(79,70,229,0.3)] mt-8 disabled:opacity-50">
                @if (isBusy()) {
                  <i class="fa-solid fa-spinner animate-spin"></i>
                } @else {
                  {{ isLogin() ? t('Sign In') : t('Create My Account') }}
                }
              </button>

              <div class="relative py-10 flex items-center justify-center">
                <div class="absolute inset-x-0 h-px bg-white/5"></div>
                <span class="relative bg-slate-900 px-6 text-[10px] font-black text-slate-600 uppercase tracking-[0.5em]">{{ t('Or continue with') }}</span>
              </div>

              <div class="grid grid-cols-1 gap-6">
                <button (click)="loginWithGoogle()" [disabled]="isBusy()" class="flex items-center justify-center gap-4 p-5 rounded-2xl glass border border-white/5 hover:bg-white/5 transition font-black text-xs text-white uppercase tracking-widest disabled:opacity-50">
                  <i class="fa-brands fa-google text-lg"></i> Google
                </button>
              </div>
            </div>

            <p class="mt-20 text-center text-slate-400 text-lg font-bold">
              {{ isLogin() ? t("Don't have an account?") : t('Already have an account?') }}
              <button (click)="isLogin.set(!isLogin())" class="text-indigo-400 hover:underline mr-3">{{ isLogin() ? t('Create Account') : t('Sign In') }}</button>
            </p>
          } @else if (step() === 'verify') {
            <div class="text-center animate-in zoom-in duration-500">
              <div class="w-24 h-24 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center text-4xl mx-auto mb-10">
                <i class="fa-solid fa-envelope-circle-check"></i>
              </div>
              <h3 class="text-4xl font-black text-white mb-4 tracking-tighter">{{ t('Verify Your Email') }}</h3>
              <p class="text-slate-500 text-xl font-bold mb-12">{{ t('We sent the verification link to') }} <br><span class="text-white">{{ email }}</span></p>
              
              <div class="p-8 glass border border-white/5 rounded-3xl mb-12">
                <p class="text-slate-400 font-bold leading-relaxed">{{ t('Please click the link sent to your email to activate your account. Once clicked, you can return here and sign in.') }}</p>
              </div>

              <button (click)="isLogin.set(true); step.set('form')" class="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black text-xl hover:scale-105 transition shadow-xl mb-8">
                {{ t('Back to Sign In') }}
              </button>

              <p class="text-slate-500 font-bold">
                {{ t("Didn't receive the link?") }}
                <button (click)="resendVerification()" class="text-indigo-400 hover:underline mr-2">{{ t('Resend') }}</button>
              </p>
            </div>
          }
        </div>
      </div>
      @if (promoModalOpen()) {
        <div class="fixed inset-0 bg-black/80 backdrop-blur-2xl z-[400] flex items-center justify-center p-6">
          <div class="bg-slate-900 w-full max-w-xl rounded-[2.5rem] border border-white/10 shadow-3xl overflow-hidden animate-in zoom-in-95 duration-500">
            <div class="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <p class="text-xs font-black text-slate-500 uppercase tracking-[0.4em]">كود PRO</p>
                <h3 class="text-2xl font-black text-white">تفعيل كود مجاني</h3>
              </div>
              <button (click)="closePromoModal()" class="w-10 h-10 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20 transition">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div class="p-6 space-y-4 text-right">
              <p class="text-sm text-slate-400">
                أدخل الكود الذي تلقيته لتفعيل اشتراك PRO لمدة 14 يوماً بدءاً من لحظة التفعيل.
              </p>
              <div class="space-y-2">
                <label class="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">الكود</label>
                <input
                  type="text"
                  [(ngModel)]="promoCodeInput"
                  class="w-full p-4 rounded-2xl bg-slate-950 border border-white/10 focus:ring-4 ring-indigo-600/20 text-white text-sm outline-none"
                  placeholder="FREE14-XXXXXX"
                >
              </div>
              <button
                (click)="redeemPromoCode()"
                [disabled]="promoBusy()"
                class="w-full py-4 rounded-2xl font-black text-lg transition border border-white/20 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                @if (promoBusy()) {
                  <i class="fa-solid fa-spinner animate-spin"></i>
                } @else {
                  تفعيل الكود
                }
              </button>
              @if (promoFeedback()) {
                <p
                  [class.text-emerald-400]="promoFeedback()?.type === 'success'"
                  [class.text-rose-400]="promoFeedback()?.type === 'error'"
                  class="text-sm font-black uppercase tracking-[0.3em]"
                >
                  {{ promoFeedback()?.message }}
                </p>
              }
              @if (promoFeedback() && promoFeedback()?.type === 'success') {
                <div class="space-y-1 text-sm text-slate-200">
                  <p class="font-black text-white">{{ promoFeedback()?.durationDays || 14 }} يوماً كاملة من PRO تم منحها.</p>
                  <p>تاريخ بدء الاشتراك: {{ formatPromoDate(promoFeedback()?.activationDate) }}</p>
                  <p>تاريخ انتهاء الاشتراك: {{ formatPromoDate(promoFeedback()?.expirationDate) }}</p>
                  @if (promoFeedback()?.expirationDate) {
                    <p class="text-xs text-slate-400">
                      {{ formatPromoRemainingDays(promoFeedback()?.expirationDate) }}
                    </p>
                  }
                </div>
              }
              @if (!auth.currentUser()) {
                <p class="text-xs font-black text-amber-300">
                  يجب تسجيل الدخول أولاً لتفعيل الكود. لا تقلق، سيُبقي النظام هذه النافذة مفتوحة بعد الانتهاء.
                </p>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`:host { display: block; } .shadow-3xl { box-shadow: 0 80px 160px rgba(0,0,0,0.7); }`]
})
export class AuthComponent {
  auth = inject(AuthService);
  ns = inject(NotificationService);
  localization = inject(LocalizationService);
  authSuccess = output<void>();
  
  isLogin = signal(true);
  isBusy = signal(false);
  step = signal<'form' | 'verify'>('form');
  promoModalOpen = signal(false);
  promoBusy = signal(false);
  promoCodeInput = '';
  promoFeedback = signal<PromoFeedback | null>(null);
  
  fullName = '';
  email = '';
  password = '';
  private readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  readonly t = (text: string) => this.localization.phrase(text);

  private readonly infoPointBlueprints = [
    { label: 'Persistent and archived smart conversations', icon: 'fa-solid fa-brain', color: 'indigo' },
    { label: 'Automatic saving for learning sessions', icon: 'fa-solid fa-cloud-arrow-up', color: 'emerald' },
    { label: 'Precise and documented academic research tools', icon: 'fa-solid fa-microscope', color: 'amber' }
  ] as const;

  get infoPoints() {
    return this.infoPointBlueprints.map((point) => ({
      ...point,
      label: this.t(point.label)
    }));
  }

  async loginWithGoogle() {
    try {
      this.isBusy.set(true);
      await this.auth.loginWithGoogle();
      this.ns.show(this.t('Signed in'), this.t('Welcome back via Google'), 'success', 'fa-check-circle');
      this.authSuccess.emit();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : this.t('Google sign-in failed');
      this.ns.show(this.t('Sign-in error'), message, 'error', 'fa-circle-exclamation');
    } finally {
      this.isBusy.set(false);
    }
  }

  async submit() {
    const normalizedEmail = this.email.trim().toLowerCase();
    const normalizedPassword = this.password.trim();
    const normalizedName = this.fullName.trim();

    if (!normalizedEmail || !normalizedPassword) {
      this.ns.show(this.t('Missing information'), this.t('Please enter email and password.'), 'warning', 'fa-triangle-exclamation');
      return;
    }

    if (!this.emailPattern.test(normalizedEmail)) {
      this.ns.show(this.t('Invalid email address'), this.t('Please enter a real email address in a valid format.'), 'warning', 'fa-triangle-exclamation');
      return;
    }

    if (normalizedPassword.length < 6) {
      this.ns.show(this.t('Invalid password'), this.t('Password must be at least 6 characters.'), 'warning', 'fa-triangle-exclamation');
      return;
    }

    if (!this.isLogin() && !normalizedName) {
      this.ns.show(this.t('Missing information'), this.t('Please enter your full name.'), 'warning', 'fa-triangle-exclamation');
      return;
    }

    this.email = normalizedEmail;
    this.password = normalizedPassword;
    this.fullName = normalizedName;

    this.isBusy.set(true);
    try {
      if (this.isLogin()) {
        await this.auth.signIn(normalizedEmail, normalizedPassword);
        this.ns.show(this.t('Signed in'), this.t('Welcome back to your smart workspace'), 'success', 'fa-check-circle');
        this.authSuccess.emit();
      } else {
        await this.auth.signUp(normalizedEmail, normalizedPassword, normalizedName);
        this.ns.show(this.t('Account created'), this.t('Your account is ready and you can start immediately.'), 'success', 'fa-paper-plane');
        this.authSuccess.emit();
      }
    } catch (err: unknown) {
      console.error(err);
      let message = err instanceof Error ? err.message : this.t('Operation failed. Please try again later.');
      if (message.includes('Account not found')) message = this.t('This email is not registered yet. Click "Create Account" first.');
      if (message.includes('Invalid email address')) message = this.t('The email address format is invalid.');
      if (message.includes('Invalid credentials')) message = this.t('The email or password is incorrect.');
      if (message.includes('Incorrect password')) message = this.t('The password is incorrect.');
      if (message.includes('Password login is not available')) message = this.t('This account is linked to Google sign-in. Use Google to continue.');
      if (message.includes('Password must be at least 6 characters')) message = this.t('Password must be at least 6 characters.');
      if (message.includes('Name is required')) message = this.t('Please enter your full name correctly.');
      if (message.includes('User already exists')) message = this.t('This email is already in use.');
      this.ns.show(this.t('Operation error'), message, 'error', 'fa-circle-exclamation');
    } finally {
      this.isBusy.set(false);
    }
  }

  openPromoModal() {
    this.promoCodeInput = '';
    this.promoFeedback.set(null);
    this.promoModalOpen.set(true);
  }

  closePromoModal() {
    this.promoModalOpen.set(false);
  }

  // هذه الطريقة تتحقق من الكود وتستدعي واجهة التفعيل ثم تعرض التواريخ والرسائل المناسبة
  async redeemPromoCode() {
    if (this.promoBusy()) {
      return;
    }

    const trimmedCode = this.promoCodeInput.trim();
    if (!trimmedCode) {
      this.promoFeedback.set({ type: 'error', message: 'الرجاء إدخال الكود قبل المتابعة.' });
      return;
    }

    if (!this.auth.currentUser()) {
      this.promoFeedback.set({ type: 'error', message: 'يجب تسجيل الدخول أولاً لتفعيل الكود' });
      return;
    }

    this.promoBusy.set(true);
    this.promoFeedback.set(null);

    try {
      const response = await fetch('/api/promo/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmedCode })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          payload && typeof payload.error === 'string'
            ? payload.error
            : response.status === 401
              ? 'يجب تسجيل الدخول أولاً لتفعيل الكود'
              : 'فشل التفعيل. حاول مرة أخرى';
        this.promoFeedback.set({ type: 'error', message });
        return;
      }

      const message =
        payload && typeof payload.message === 'string'
          ? payload.message
          : 'تم تفعيل الكود بنجاح';
      this.promoFeedback.set({
        type: 'success',
        message,
        activationDate: typeof payload.activationDate === 'string' ? payload.activationDate : undefined,
        expirationDate: typeof payload.expirationDate === 'string' ? payload.expirationDate : undefined,
        durationDays: typeof payload.durationDays === 'number' ? payload.durationDays : undefined
      });
      this.promoCodeInput = '';
      await this.auth.refreshSession();
    } catch (error) {
      console.error('Promo redeem failed', error);
      const message = error instanceof Error ? error.message : 'فشل التفعيل. حاول مرة أخرى';
      this.promoFeedback.set({ type: 'error', message });
    } finally {
      this.promoBusy.set(false);
    }
  }

  private formatPromoDate(value?: string | null): string {
    if (!value) {
      return '';
    }
    return new Date(value).toLocaleString('ar-EG', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private formatPromoRemainingDays(value?: string | null): string {
    if (!value) {
      return '';
    }
    const target = Date.parse(value);
    if (!Number.isFinite(target)) {
      return '';
    }
    const diff = Math.max(0, Math.ceil((target - Date.now()) / (24 * 60 * 60 * 1000)));
    if (diff === 1) {
      return 'يوماً واحداً متبقياً';
    }
    return `${diff} أيام متبقية`;
  }

  async resendVerification() {
    this.ns.show(this.t('Information'), this.t('Email verification is not enabled in this version.'), 'info', 'fa-circle-info');
  }
}

