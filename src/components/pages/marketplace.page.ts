
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-marketplace-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700">
      <div class="bg-gradient-to-r from-emerald-600 to-indigo-600 p-12 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden">
        <div class="relative z-10 text-right">
          <h2 class="text-4xl font-black mb-4">متجر أدوات الذكاء الاصطناعي 🛒</h2>
          <p class="text-indigo-100 max-w-md ml-auto opacity-90">وسع إمكانيات منصتك التعليمية عبر تحميل نماذج ذكاء اصطناعي متخصصة ومقربة من تخصصك.</p>
        </div>
        <i class="fa-solid fa-cubes absolute -left-10 -bottom-10 text-[20rem] opacity-10"></i>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        @for (item of tools; track item.id) {
          <div class="bg-slate-900 p-8 rounded-[3rem] border border-white/5 shadow-sm hover:shadow-2xl transition duration-500 group">
            <div class="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-2xl text-indigo-500 mb-6 group-hover:scale-110 group-hover:rotate-6 transition duration-500"><i [class]="item.icon"></i></div>
            <h4 class="text-xl font-black mb-2 text-white text-right">{{ item.name }}</h4>
            <p class="text-sm text-slate-400 mb-8 leading-relaxed text-right">{{ item.desc }}</p>
            
            <button (click)="install(item)" 
                    [disabled]="item.installing || item.installed"
                    [class.bg-emerald-600]="item.installed"
                    [class.bg-indigo-600]="!item.installed"
                    class="w-full text-white py-4 rounded-2xl font-black shadow-lg transition-all hover:scale-105 disabled:opacity-50">
               @if (item.installing) {
                 <i class="fa-solid fa-circle-notch animate-spin mr-2"></i> جاري التثبيت...
               } @else if (item.installed) {
                 <i class="fa-solid fa-check mr-2"></i> تم التثبيت
               } @else {
                 تثبيت الأداة
               }
            </button>
          </div>
        }
      </div>
    </div>
  `
})
export class MarketplacePage {
  tools = [
    { id: 1, name: 'نموذج البرمجة المتقدم', icon: 'fa-solid fa-code', desc: 'نموذج متخصص في تصحيح الأكواد وشرح الخوارزميات المعقدة بلغات C++ و Java.', installing: false, installed: false },
    { id: 2, name: 'مساعد التشخيص الطبي', icon: 'fa-solid fa-microscope', desc: 'أداة تحليل الحالات السريرية بناءً على أحدث البروتوكولات الطبية العالمية.', installing: false, installed: true },
    { id: 3, name: 'محلل البيانات الإحصائي', icon: 'fa-solid fa-chart-line', desc: 'استخرج الأنماط من مجموعات البيانات الضخمة وحولها إلى رسوم بيانية تفاعلية.', installing: false, installed: false }
  ];

  install(item: { installed: boolean; installing: boolean }) {
    if (item.installed) return;
    item.installing = true;
    setTimeout(() => {
      item.installing = false;
      item.installed = true;
    }, 2000);
  }
}

