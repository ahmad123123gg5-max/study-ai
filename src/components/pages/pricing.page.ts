
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pricing-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-6xl mx-auto space-y-16 py-10">
      <div class="text-center">
        <h2 class="text-5xl font-black mb-4 tracking-tighter text-white">اختر خطة نجاحك</h2>
        <p class="text-slate-500 text-xl font-medium">ابدأ رحلة التعلم الذكي اليوم مع خطط مرنة تناسب الجميع</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        @for (plan of plans; track plan.name) {
          <div [class.ring-4]="plan.popular" [class.ring-indigo-600]="plan.popular" 
               class="bg-slate-900 p-10 rounded-[4rem] border border-white/5 shadow-xl relative flex flex-col transition-transform hover:scale-[1.02]">
            @if (plan.popular) {
              <span class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest">الأكثر شيوعاً</span>
            }
            <div class="mb-10 text-right">
              <h3 class="text-2xl font-black mb-4 text-white">{{ plan.name }}</h3>
              <div class="flex items-baseline gap-2 justify-end">
                <span class="text-5xl font-black text-white">{{ plan.price }}</span>
                <span class="text-slate-500 font-bold">ريال / شهر</span>
              </div>
            </div>
            <ul class="space-y-4 mb-12 flex-1 text-right">
              @for (feat of plan.features; track feat) {
                <li class="flex items-center justify-end gap-3 text-sm font-bold text-slate-300">
                  <span>{{ feat }}</span>
                  <i class="fa-solid fa-check text-emerald-500"></i>
                </li>
              }
            </ul>
            <button (click)="subscribe(plan)" 
                    [disabled]="loadingPlan() === plan.name"
                    [class.bg-indigo-600]="plan.popular" 
                    [class.text-white]="plan.popular" 
                    [class.bg-white]="!plan.popular"
                    [class.text-slate-950]="!plan.popular"
                    class="w-full py-5 rounded-[2rem] font-black text-lg hover:scale-105 transition shadow-2xl disabled:opacity-50">
               {{ loadingPlan() === plan.name ? 'جاري المعالجة...' : (subscribedPlan() === plan.name ? 'خطتك الحالية' : 'اشترك الآن') }}
            </button>
          </div>
        }
      </div>

      <!-- Institution Trial Section -->
      <div class="glass p-12 rounded-[4rem] border border-indigo-500/20 bg-indigo-600/5 relative overflow-hidden group">
        <div class="relative z-10 flex flex-col md:flex-row justify-between items-center gap-12">
          <div class="text-right space-y-6 flex-1">
            <div class="inline-flex items-center gap-3 bg-indigo-500/20 text-indigo-400 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/30">
              <i class="fa-solid fa-building-columns"></i> عرض خاص للمؤسسات
            </div>
            <h3 class="text-3xl font-black text-white">فترة تجريبية مجانية للمؤسسات التعليمية</h3>
            <p class="text-slate-400 font-bold text-lg leading-relaxed">
              فعل العرض التجريبي لمؤسستك الآن لتمكين طلابك من الوصول إلى أدوات StudyVex المتقدمة.
            </p>
            <div class="flex flex-col sm:flex-row gap-4 max-w-xl ml-auto">
              <input #instEmail type="email" placeholder="البريد الإلكتروني للمؤسسة" 
                     class="flex-1 bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:ring-2 ring-indigo-500 transition">
              <button (click)="activateTrial(instEmail.value)" 
                      class="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black hover:scale-105 transition shadow-2xl shrink-0">
                تفعيل العرض
              </button>
            </div>
          </div>
          <div class="w-32 h-32 md:w-48 md:h-48 bg-indigo-500/10 rounded-full flex items-center justify-center text-indigo-400 text-5xl md:text-7xl shadow-inner border border-white/5">
            <i class="fa-solid fa-school-flag"></i>
          </div>
        </div>
        <div class="absolute -left-20 -bottom-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px]"></div>
      </div>

      @if (showSuccess()) {
        <div class="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div class="bg-slate-900 border border-white/10 p-12 rounded-[3.5rem] text-center max-w-sm shadow-2xl">
            <div class="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white text-3xl mx-auto mb-6"><i class="fa-solid fa-check"></i></div>
            <h3 class="text-2xl font-black text-white mb-2">تم الاشتراك بنجاح!</h3>
            <p class="text-slate-400 mb-8 font-bold">استعد لتجربة تعليمية لا مثيل لها مع مميزاتك الجديدة.</p>
            <button (click)="showSuccess.set(false)" class="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black">فلنبدأ</button>
          </div>
        </div>
      }
    </div>
  `
})
export class PricingPage {
  loadingPlan = signal<string | null>(null);
  subscribedPlan = signal<string>('الطالب الحر');
  showSuccess = signal(false);

  plans = [
    { name: 'الخطة المجانية', price: '0', features: ['وصول محدود للمعلم الذكي', '5 اختبارات شهرياً', 'المكتبة الأساسية'] },
    { name: 'باقة الطالب ($5)', price: '5', features: ['وصول موسع للمعلم الذكي', '20 اختبار شهرياً', 'المترجم الأكاديمي'], popular: false },
    { name: 'باقة المحترف ($10)', price: '10', features: ['وصول غير محدود للمعلم الذكي', 'اختبارات لا محدودة', 'المترجم الأكاديمي', 'الباحث الأكاديمي', 'مدرب اللغات'], popular: true },
  ];

  subscribe(plan: { name: string }) {
    if (this.subscribedPlan() === plan.name) return;
    this.loadingPlan.set(plan.name);
    setTimeout(() => {
      this.subscribedPlan.set(plan.name);
      this.loadingPlan.set(null);
      this.showSuccess.set(true);
    }, 1500);
  }

  activateTrial(email: string) {
    if (!email || !email.includes('@')) {
      alert('يرجى إدخال بريد إلكتروني صحيح للمؤسسة');
      return;
    }
    alert(`تم إرسال طلب تفعيل الفترة التجريبية للمؤسسة إلى: ${email}. سيتم التواصل معكم قريباً.`);
  }
}

