
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocalizationService } from '../../services/localization.service';

@Component({
  selector: 'app-admin-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div class="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 class="text-3xl font-black text-white">{{ t('Admin Panel Shield') }} 🛡️</h2>
        <div class="flex gap-2">
           <button (click)="addUser()" class="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:scale-105 transition">{{ t('Add New User') }}</button>
           <button (click)="exportData()" class="bg-slate-800 text-white px-6 py-3 rounded-2xl font-black border border-white/10 hover:bg-slate-700 transition"><i class="fa-solid fa-file-export mr-2"></i>{{ t('Export') }}</button>
        </div>
      </div>

      <div class="bg-slate-900 rounded-[3rem] border border-white/10 shadow-xl overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-right">
            <thead class="bg-slate-950 border-b border-white/5">
              <tr>
                <th class="p-6 font-black text-xs uppercase tracking-widest text-slate-500">{{ t('User') }}</th>
                <th class="p-6 font-black text-xs uppercase tracking-widest text-slate-500">{{ t('Role') }}</th>
                <th class="p-6 font-black text-xs uppercase tracking-widest text-slate-500">{{ t('Subscription') }}</th>
                <th class="p-6 font-black text-xs uppercase tracking-widest text-slate-500">{{ t('Status') }}</th>
                <th class="p-6 font-black text-xs uppercase tracking-widest text-slate-500">{{ t('Actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              @for (u of users(); track u.id) {
                <tr class="hover:bg-white/5 transition group">
                  <td class="p-6 font-bold text-white text-sm">{{ u.name }}</td>
                  <td class="p-6 text-xs font-black text-indigo-400 uppercase tracking-widest">{{ u.role }}</td>
                  <td class="p-6 text-xs font-bold text-slate-400">{{ u.plan }}</td>
                  <td class="p-6"><span class="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-black uppercase">{{ t('Active') }}</span></td>
                  <td class="p-6">
                     <div class="flex gap-2 justify-end">
                        <button (click)="editUser(u)" class="w-8 h-8 rounded-lg glass flex items-center justify-center text-indigo-400 hover:bg-indigo-600 hover:text-white transition"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button (click)="deleteUser(u.id)" class="w-8 h-8 rounded-lg glass flex items-center justify-center text-rose-400 hover:bg-rose-600 hover:text-white transition"><i class="fa-solid fa-trash text-xs"></i></button>
                     </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class AdminPage {
  private readonly localization = inject(LocalizationService);
  readonly t = (text: string) => this.localization.phrase(text);

  users = signal([
    { id: 1, name: 'سارة خالد', role: 'Student', plan: 'University' },
    { id: 2, name: 'فهد المنصور', role: 'Teacher', plan: 'Institutional' },
    { id: 3, name: 'مريم علي', role: 'Admin', plan: 'Enterprise' },
  ]);

  addUser() {
    alert(this.t('A new user creation dialog will open.'));
  }

  editUser(u: { id: number, name: string, role: string, plan: string }) {
    alert(`${this.t('Edit user:')} ${u.name}`);
  }

  deleteUser(id: number) {
    if (confirm(this.t('Are you sure you want to delete this user?'))) {
      this.users.update(list => list.filter(u => u.id !== id));
    }
  }

  exportData() {
    alert(this.t('Preparing the data file for CSV export...'));
  }
}

