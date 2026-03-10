
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-3xl mx-auto space-y-8">
      <h2 class="text-3xl font-black">الإشعارات 🔔</h2>
      <div class="space-y-4">
        @for (i of [1,2,3,4,5]; track i) {
          <div class="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border dark:border-slate-800 shadow-sm flex items-start gap-4">
            <div class="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-500 shrink-0"><i class="fa-solid fa-message"></i></div>
            <div class="flex-1">
              <p class="font-bold text-sm mb-1">المعلم الذكي قام بالرد على سؤالك</p>
              <p class="text-xs text-slate-500 leading-relaxed">بناءً على طلبك، قمت بتجهيز ملخص شامل لوحدة "التشريح الوصفي". يمكنك الاطلاع عليه الآن.</p>
              <p class="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-widest">منذ 20 دقيقة</p>
            </div>
            <div class="w-2 h-2 bg-indigo-500 rounded-full"></div>
          </div>
        }
      </div>
    </div>
  `
})
export class NotificationsPage {}

