
import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AIService } from '../../services/ai.service';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { LocalizationService } from '../../services/localization.service';
import { LanguageCode } from '../../i18n/language-config';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      <div class="flex justify-between items-center">
        <h2 class="text-3xl font-black text-white">{{ t('Settings') }} ⚙️</h2>
        @if (saved()) {
          <span class="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl text-xs font-black animate-in slide-in-from-right">{{ t('Changes saved successfully!') }}</span>
        }
      </div>
      
      <div class="glass p-10 rounded-[3rem] border border-white/5 space-y-10 shadow-xl">
         <!-- Profile Section -->
         <section class="text-right">
            <h4 class="font-black text-indigo-500 uppercase tracking-widest text-xs mb-8">{{ t('Profile settings') }}</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div class="space-y-3">
                  <label class="text-xs font-black text-slate-400 px-2 uppercase tracking-widest">{{ t('Full Name') }}</label>
                  <input type="text" [(ngModel)]="ai.userName" class="w-full bg-slate-950 text-white p-5 rounded-2xl border border-white/10 focus:ring-2 ring-indigo-500 outline-none transition">
               </div>
               <div class="space-y-3">
                  <label class="text-xs font-black text-slate-400 px-2 uppercase tracking-widest">{{ t('Email') }}</label>
                  <input type="email" [(ngModel)]="ai.userEmail" class="w-full bg-slate-950 text-white p-5 rounded-2xl border border-white/10 focus:ring-2 ring-indigo-500 outline-none transition">
               </div>
               <div class="space-y-3">
                  <label class="text-xs font-black text-slate-400 px-2 uppercase tracking-widest">{{ t('Study specialization') }}</label>
                  <input type="text" [(ngModel)]="ai.specialization" class="w-full bg-slate-950 text-white p-5 rounded-2xl border border-white/10 focus:ring-2 ring-indigo-500 outline-none transition">
               </div>
               <div class="space-y-3">
                  <label class="text-xs font-black text-slate-400 px-2 uppercase tracking-widest">{{ t('Preferred language') }}</label>
                  <select [(ngModel)]="selectedLanguage" data-no-i18n class="w-full bg-slate-950 text-white p-5 rounded-2xl border border-white/10 focus:ring-2 ring-indigo-500 outline-none transition">
                    @for (language of localization.supportedLanguages; track language.code) {
                      <option [value]="language.code">{{ language.nativeName }}</option>
                    }
                  </select>
               </div>
            </div>
            <div class="mt-8 space-y-3">
               <label class="text-xs font-black text-slate-400 px-2 uppercase tracking-widest">{{ t('Personal bio') }}</label>
               <textarea [(ngModel)]="ai.bio" class="w-full bg-slate-950 text-white p-5 rounded-2xl border border-white/10 focus:ring-2 ring-indigo-500 outline-none transition h-32 resize-none"></textarea>
            </div>
         </section>

         <!-- Security Section -->
         <section class="pt-10 border-t border-white/5 text-right">
            <h4 class="font-black text-indigo-500 uppercase tracking-widest text-xs mb-8">{{ t('Security & privacy') }}</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
               <div class="flex items-center justify-between p-5 bg-slate-950 rounded-2xl border border-white/5">
                  <span class="text-sm font-bold text-slate-300">{{ t('Public profile') }}</span>
                  <input type="checkbox" [(ngModel)]="ai.isPublicProfile" class="w-6 h-6 rounded bg-slate-800 border-white/10 text-indigo-600 focus:ring-indigo-500">
               </div>
               <div class="flex items-center justify-between p-5 bg-slate-950 rounded-2xl border border-white/5">
                  <span class="text-sm font-bold text-slate-300">{{ t('Share statistics') }}</span>
                  <input type="checkbox" [(ngModel)]="ai.shareStats" class="w-6 h-6 rounded bg-slate-800 border-white/10 text-indigo-600 focus:ring-indigo-500">
               </div>
            </div>
            
            <div class="flex flex-wrap gap-4">
               <button (click)="save()" [disabled]="isSaving()" 
                       class="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-indigo-500/20 hover:scale-105 transition disabled:opacity-50">
                  {{ isSaving() ? t('Saving...') : t('Save all changes') }}
               </button>
               <button (click)="showPasswordModal.set(true)" class="bg-slate-800 text-white px-8 py-4 rounded-2xl font-black border border-white/10 hover:bg-slate-700 transition">{{ t('Change password') }}</button>
            </div>
         </section>
      </div>

      <!-- Password Modal -->
      @if (showPasswordModal()) {
        <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div class="bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-white/10 shadow-4xl overflow-hidden animate-in zoom-in-95 duration-500">
            <div class="p-8 space-y-6 text-right">
              <h3 class="text-2xl font-black text-white">{{ t('Change password') }}</h3>
              <div class="space-y-4">
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest">{{ t('Current password') }}</label>
                  <input type="password" [(ngModel)]="currentPass" class="w-full bg-slate-950 text-white p-4 rounded-xl border border-white/10 outline-none focus:border-indigo-500">
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest">{{ t('New password') }}</label>
                  <input type="password" [(ngModel)]="newPass" class="w-full bg-slate-950 text-white p-4 rounded-xl border border-white/10 outline-none focus:border-indigo-500">
                </div>
                <div class="space-y-2">
                  <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest">{{ t('Confirm new password') }}</label>
                  <input type="password" [(ngModel)]="confirmPass" class="w-full bg-slate-950 text-white p-4 rounded-xl border border-white/10 outline-none focus:border-indigo-500">
                </div>
              </div>
              <div class="flex gap-3 pt-4">
                <button (click)="showPasswordModal.set(false)" class="flex-1 py-4 bg-white/5 text-white rounded-2xl font-black hover:bg-white/10 transition-all">{{ t('Cancel') }}</button>
                <button (click)="confirmPasswordChange()" [disabled]="isSaving()" class="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-600/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                  {{ isSaving() ? t('Updating...') : t('Update') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class SettingsPage {
  public ai = inject(AIService);
  public localization = inject(LocalizationService);
  private auth = inject(AuthService);
  private ns = inject(NotificationService);
  readonly t = (text: string) => this.localization.phrase(text);

  isSaving = signal(false);
  saved = signal(false);
  showPasswordModal = signal(false);

  currentPass = '';
  newPass = '';
  confirmPass = '';
  selectedLanguage: LanguageCode = this.localization.currentLanguage();

  async save() {
    this.isSaving.set(true);
    setTimeout(async () => {
      await this.localization.setLanguage(this.selectedLanguage);
      this.ai.saveProfile();
      this.isSaving.set(false);
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 3000);
    }, 1200);
  }

  async confirmPasswordChange() {
    if (!this.currentPass || !this.newPass || !this.confirmPass) {
      this.ns.show(this.t('Missing information'), this.t('Please fill in all fields.'), 'warning', 'fa-triangle-exclamation');
      return;
    }

    if (this.newPass !== this.confirmPass) {
      this.ns.show(this.t('Password confirmation error'), this.t('The new passwords do not match.'), 'error', 'fa-xmark');
      return;
    }

    this.isSaving.set(true);
    try {
      await this.auth.changePassword(this.currentPass, this.newPass);
      this.ns.show(this.t('Updated'), this.t('Your password has been changed successfully and is now active.'), 'success', 'fa-shield-check');
      this.showPasswordModal.set(false);
      this.currentPass = '';
      this.newPass = '';
      this.confirmPass = '';
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : this.t('Check your current password and try again.');
      this.ns.show(this.t('Update failed'), message, 'error', 'fa-circle-exclamation');
    } finally {
      this.isSaving.set(false);
    }
  }
}

