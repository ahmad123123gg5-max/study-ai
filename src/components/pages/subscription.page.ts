
import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AIService } from '../../services/ai.service';
import { LocalizationService } from '../../services/localization.service';
import { AuthService } from '../../services/auth.service';

interface SubscriptionPromoFeedback {
  type: 'success' | 'error';
  message: string;
  activationDate?: string;
  expirationDate?: string;
}

@Component({
  selector: 'app-subscription-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-950 p-4 md:p-8 lg:p-12 animate-in fade-in duration-700">
      <div class="max-w-6xl mx-auto space-y-12">
        
        <!-- Header -->
        <div class="text-center space-y-4">
          <h1 class="text-4xl md:text-6xl font-black text-white tracking-tighter">
            {{ t('Choose Your Learning Plan') }}
          </h1>
          <p class="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto">
            {{ t('Unlock new learning horizons with advanced AI features') }}
          </p>
        </div>

        <div class="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-6 space-y-6 max-w-4xl mx-auto text-right">
          <div class="space-y-2">
            <p class="text-xs font-black text-slate-500 uppercase tracking-[0.4em]">كود ترويجي</p>
            <h3 class="text-xl font-black text-white">أدخل الكود لتفعيل PRO لمدة 14 يوماً</h3>
          </div>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <input
              type="text"
              [(ngModel)]="promoCodeInput"
              class="w-full rounded-2xl bg-slate-950 border border-white/10 p-4 text-white placeholder:text-slate-500 outline-none transition"
              placeholder="FREE14-XXXXXX"
            />
            <button
              (click)="redeemPromoCode()"
              [disabled]="promoBusy()"
              class="rounded-2xl bg-indigo-600 hover:bg-indigo-500 transition font-black px-6 text-white disabled:opacity-60 disabled:cursor-not-allowed"
            >
              @if (promoBusy()) {
                <i class="fa-solid fa-spinner animate-spin"></i>
              } @else {
                تفعيل الكود
              }
            </button>
          </div>
          @if (promoFeedback()) {
            <div class="text-xs font-black uppercase tracking-[0.3em]"
                 [class.text-emerald-400]="promoFeedback()?.type === 'success'"
                 [class.text-rose-400]="promoFeedback()?.type === 'error'">
              {{ promoFeedback()?.message }}
            </div>
          }
          @if (promoFeedback() && promoFeedback()?.type === 'success') {
            <div class="text-slate-300 text-sm space-y-1">
              <p>تاريخ بدء الاشتراك: {{ formatPromoDate(promoFeedback()?.activationDate) }}</p>
              <p>تاريخ انتهاء الاشتراك: {{ formatPromoDate(promoFeedback()?.expirationDate) }}</p>
            </div>
          }
          @if (!auth.currentUser()) {
            <p class="text-xs text-amber-300 font-black">يجب تسجيل الدخول أولاً لتفعيل الكود.</p>
          }
        </div>

        <!-- Plans Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          
          <!-- Free Plan -->
          <div class="bg-slate-900/50 border border-white/5 rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden group">
            <div class="space-y-2">
              <h3 class="text-2xl font-black text-white">{{ t('Free Plan') }}</h3>
              <div class="flex items-baseline gap-1">
                <span class="text-4xl font-black text-white">0$</span>
                <span class="text-slate-500 font-bold">/{{ t('month') }}</span>
              </div>
            </div>

            <div class="space-y-4">
              <div class="flex items-center gap-3 text-sm text-slate-300">
                <i class="fa-solid fa-check text-emerald-500"></i>
                <span>{{ t('7 daily AI Teacher questions') }}</span>
              </div>
              <div class="flex items-center gap-3 text-sm text-slate-300">
                <i class="fa-solid fa-check text-emerald-500"></i>
                <span>{{ t('1 lab simulation (Beginner level)') }}</span>
              </div>
              <div class="flex items-center gap-3 text-sm text-slate-300">
                <i class="fa-solid fa-check text-emerald-500"></i>
                <span>{{ t('1 smart test total') }}</span>
              </div>
              <div class="flex items-center gap-3 text-sm text-slate-400 opacity-50">
                <i class="fa-solid fa-xmark text-rose-500"></i>
                <span>{{ t('Advanced performance analytics') }}</span>
              </div>
            </div>

            <button [disabled]="ai.userPlan() === 'free'"
                    class="w-full py-4 rounded-2xl font-black transition-all border border-white/10 text-white disabled:bg-white/5 disabled:text-slate-500">
              {{ ai.userPlan() === 'free' ? t('Current Plan') : t('Stay Free') }}
            </button>
          </div>

          <!-- Pro Plan -->
          <div class="bg-indigo-600 rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden shadow-2xl shadow-indigo-500/20 ring-4 ring-indigo-500/50">
            <div class="absolute top-0 right-0 p-4">
              <span class="bg-white text-indigo-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{{ t('Recommended') }}</span>
            </div>
            
            <div class="space-y-2">
              <h3 class="text-2xl font-black text-white">{{ t('Pro Plan') }}</h3>
              <div class="flex items-baseline gap-1">
                <span class="text-4xl font-black text-white">15$</span>
                <span class="text-indigo-200 font-bold">/{{ t('month') }}</span>
              </div>
            </div>

            <div class="space-y-4">
              <div class="flex items-center gap-3 text-sm text-white">
                <i class="fa-solid fa-circle-check text-indigo-200"></i>
                <span>{{ t('30 daily AI Teacher questions') }}</span>
              </div>
              <div class="flex items-center gap-3 text-sm text-white">
                <i class="fa-solid fa-circle-check text-indigo-200"></i>
                <span>{{ t('5 daily simulations (All levels)') }}</span>
              </div>
              <div class="flex items-center gap-3 text-sm text-white">
                <i class="fa-solid fa-circle-check text-indigo-200"></i>
                <span>{{ t('10 daily tests + error analysis') }}</span>
              </div>
              <div class="flex items-center gap-3 text-sm text-white">
                <i class="fa-solid fa-circle-check text-indigo-200"></i>
                <span>{{ t('Full analytics & smart recommendations') }}</span>
              </div>
            </div>

            @if (ai.userPlan() !== 'pro') {
              <button (click)="showPaymentForm.set(true)"
                      class="w-full py-4 rounded-2xl font-black bg-white text-indigo-600 hover:scale-[1.02] active:scale-95 transition-all shadow-xl">
                {{ t('Subscribe Now') }}
              </button>
            }
            
            @if (ai.userPlan() === 'pro') {
              <div class="text-center py-4 bg-white/10 rounded-2xl border border-white/20">
                <span class="text-white font-black">{{ t('You are a Pro member ✨') }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Payment Form Modal -->
        @if (showPaymentForm()) {
          <div class="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div class="bg-slate-900 border border-white/10 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
              <div class="p-8 space-y-8">
                <div class="flex justify-between items-center">
                  <h3 class="text-2xl font-black text-white">{{ t('Payment Details') }}</h3>
                  <button (click)="showPaymentForm.set(false)" class="text-slate-500 hover:text-white transition">
                    <i class="fa-solid fa-xmark text-xl"></i>
                  </button>
                </div>

                <div class="space-y-6">
                  <!-- Card Types -->
                  <div class="flex gap-4 items-center grayscale opacity-50">
                    <i class="fa-brands fa-cc-visa text-4xl text-white"></i>
                    <i class="fa-brands fa-cc-mastercard text-4xl text-white"></i>
                    <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">{{ t('Visa / MasterCard Only') }}</span>
                  </div>

                  <div class="space-y-4">
                    <div class="space-y-2">
                      <label class="text-xs font-black text-slate-500 uppercase tracking-widest">{{ t('Cardholder Name') }}</label>
                      <input type="text" class="w-full bg-slate-950 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-indigo-500" placeholder="John Doe">
                    </div>
                    
                    <div class="space-y-2">
                      <label class="text-xs font-black text-slate-500 uppercase tracking-widest">{{ t('Card Number') }}</label>
                      <div class="relative">
                        <input type="text" class="w-full bg-slate-950 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-indigo-500" placeholder="0000 0000 0000 0000">
                        <i class="fa-solid fa-credit-card absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                      </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                      <div class="space-y-2">
                        <label class="text-xs font-black text-slate-500 uppercase tracking-widest">{{ t('Expiry Date') }}</label>
                        <input type="text" class="w-full bg-slate-950 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-indigo-500" placeholder="MM/YY">
                      </div>
                      <div class="space-y-2">
                        <label class="text-xs font-black text-slate-500 uppercase tracking-widest">{{ t('CVV') }}</label>
                        <input type="text" class="w-full bg-slate-950 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-indigo-500" placeholder="123">
                      </div>
                    </div>
                  </div>

                  <div class="bg-indigo-600/10 p-4 rounded-xl border border-indigo-500/20 flex items-center justify-between">
                    <span class="text-slate-300 text-sm">{{ t('Total Due') }}</span>
                    <span class="text-white font-black text-xl">$15.00</span>
                  </div>

                  <button (click)="processPayment()" 
                          [disabled]="isProcessing()"
                          class="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-5 rounded-2xl font-black text-lg transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50">
                    @if (isProcessing()) {
                      <i class="fa-solid fa-circle-notch animate-spin mr-2"></i>
                    }
                    {{ isProcessing() ? t('Processing...') : t('Complete Payment & Upgrade') }}
                  </button>

                  <p class="text-[10px] text-slate-500 text-center leading-relaxed">
                    {{ t('By clicking "Complete Payment", you agree to our Terms of Service. Your subscription will automatically renew monthly. Cancel anytime.') }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class SubscriptionPage {
  ai = inject(AIService);
  private readonly localization = inject(LocalizationService);
  readonly t = (text: string) => this.localization.phrase(text);
  readonly auth = inject(AuthService);
  
  showPaymentForm = signal(false);
  isProcessing = signal(false);
  promoCodeInput = '';
  promoBusy = signal(false);
  promoFeedback = signal<SubscriptionPromoFeedback | null>(null);

  async processPayment() {
    this.isProcessing.set(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId: 'pro_monthly',
          email: this.ai.userEmail()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { id } = await response.json();
      const stripe = Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');
      await stripe.redirectToCheckout({ sessionId: id });
    } catch (err: unknown) {
      console.error(err);
      alert(this.t('Failed to start payment process'));
    } finally {
      this.isProcessing.set(false);
    }
  }

  async redeemPromoCode() {
    if (this.promoBusy()) {
      return;
    }

    if (!this.auth.currentUser()) {
      this.promoFeedback.set({ type: 'error', message: 'يجب تسجيل الدخول أولاً لتفعيل الكود.' });
      return;
    }

    const trimmedCode = this.promoCodeInput.trim();
    if (!trimmedCode) {
      this.promoFeedback.set({ type: 'error', message: 'الرجاء إدخال الكود قبل الضغط.' });
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
            : 'فشل التفعيل. حاول مرة أخرى';
        this.promoFeedback.set({ type: 'error', message });
        return;
      }

      this.promoFeedback.set({
        type: 'success',
        message: payload.message || 'تم تفعيل الكود بنجاح.',
        activationDate: typeof payload.activationDate === 'string' ? payload.activationDate : undefined,
        expirationDate: typeof payload.expirationDate === 'string' ? payload.expirationDate : undefined
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

  formatPromoDate(value?: string | null): string {
    if (!value) return '';
    return this.ai.formatLocalDateTime(value);
  }
}
