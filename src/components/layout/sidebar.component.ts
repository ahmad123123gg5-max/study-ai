
import { Component, input, output, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AIService } from '../../services/ai.service';
import { LocalizationService } from '../../services/localization.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside [class.w-0]="isCollapsed()" [class.border-none]="isCollapsed()" [class.lg:w-80]="!isCollapsed()" [class.w-80]="!isCollapsed()"
           class="fixed lg:relative h-full glass border-e border-white/5 flex flex-col z-50 transition-all duration-500 overflow-y-auto no-scrollbar bg-white/5 shadow-2xl">
      
      <!-- Content - Only visible when NOT collapsed -->
      @if (!isCollapsed()) {
        <div class="p-4 flex flex-col items-center h-full">
          <div class="w-full flex items-center justify-between mb-6">
            <div class="flex items-center gap-4 overflow-hidden transition-all duration-500">
              <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-2xl shadow-indigo-500/20 shrink-0 transform hover:rotate-6 transition">S</div>
              <span class="text-xl font-black tracking-tighter text-white whitespace-nowrap">SmartEdge <span class="text-indigo-400">AI</span></span>
            </div>
            <button (click)="toggleSidebar.emit()" class="w-12 h-12 rounded-xl glass hover:bg-white/10 transition flex items-center justify-center text-white text-xl shrink-0">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <nav class="w-full flex-1 px-2 space-y-10 mt-6 animate-in fade-in duration-500">
            @for (section of filteredNavSections; track section.label) {
              <div>
                <p class="px-4 text-[9px] font-black uppercase tracking-[0.4em] text-slate-600 mb-4 whitespace-nowrap">{{ section.label }}</p>
                <div class="space-y-2">
                  @for (item of section.items; track item.id) {
                    <button (click)="onItemClick(item.id)" 
                            [class.bg-indigo-600]="isItemActive(item.id)" 
                            [class.text-white]="isItemActive(item.id)"
                            [class.shadow-3xl]="isItemActive(item.id)"
                            class="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all duration-300 group text-slate-400 relative">
                      <i [class]="item.icon + ' text-xl w-6 text-center group-hover:text-indigo-400 transition ' + (isItemActive(item.id) ? 'text-white' : '')"></i>
                      <span class="font-bold text-sm group-hover:text-white transition tracking-tight whitespace-nowrap">{{ item.label }}</span>
                    </button>
                  }
                </div>
              </div>
            }
          </nav>

          <div class="w-full p-4 mt-auto border-t border-white/5 bg-slate-950/20 animate-in fade-in duration-500">
            <button (click)="logout.emit()" class="w-full flex items-center gap-4 p-4 rounded-2xl text-rose-500 hover:bg-rose-500/10 transition-all group">
              <i class="fa-solid fa-right-from-bracket text-xl w-6 text-center group-hover:rotate-12 transition"></i>
              <span class="font-black uppercase tracking-widest text-[10px] whitespace-nowrap">{{ t('Sign Out') }}</span>
            </button>
          </div>
        </div>
      }
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`.shadow-3xl { box-shadow: 0 20px 40px rgba(79,70,229,0.3); }`]
})
export class SidebarComponent {
  ai = inject(AIService);
  private readonly localization = inject(LocalizationService);
  activePage = input.required<string>();
  isCollapsed = input.required<boolean>();
  pageChange = output<string>();
  logout = output<void>();
  toggleSidebar = output<void>();
  readonly t = (text: string) => this.localization.phrase(text);

  onItemClick(id: string) {
    this.pageChange.emit(id);
    // Auto-close on navigation as requested
    this.toggleSidebar.emit();
  }

  isItemActive(id: string) {
    return this.activePage() === id;
  }

  get filteredNavSections() {
    return this.navSectionBlueprints.map(section => ({
      ...section,
      label: this.t(section.label),
      items: section.items.filter(item => {
        if (item.id === 'admin') return this.ai.userRole() === 'admin';
        if (item.id === 'teacher') return this.ai.userRole() === 'teacher' || this.ai.userRole() === 'admin';
        return true;
      }).map((item) => ({
        ...item,
        label: this.t(item.label)
      }))
    })).filter(section => section.items.length > 0);
  }

  private readonly navSectionBlueprints = [
    { label: 'Core & Analytics', items: [
      { id: 'overview', label: 'Smart Command Center', icon: 'fa-solid fa-chart-line' },
      { id: 'levels', label: 'Student Level', icon: 'fa-solid fa-chart-simple' },
      { id: 'profile', label: 'Profile', icon: 'fa-solid fa-user' },
    ]},
    { label: 'Learning Tools', items: [
      { id: 'tutor', label: 'AI Tutor', icon: 'fa-solid fa-brain' },
      { id: 'quiz', label: 'AI Exam', icon: 'fa-solid fa-clipboard-question' },
      { id: 'timer', label: 'Smart Timer', icon: 'fa-solid fa-stopwatch' },
      { id: 'planner', label: 'Study Planner', icon: 'fa-solid fa-calendar-check' },
      { id: 'research', label: 'Research Lab', icon: 'fa-solid fa-microscope' },
    ]},
    { label: 'Advanced Labs', items: [
      { id: 'lab', label: 'Virtual Lab', icon: 'fa-solid fa-flask-vial' },
      { id: 'transform', label: 'Content Lab', icon: 'fa-solid fa-wand-magic-sparkles' },
    ]},
    { label: 'Settings & Administration', items: [
      { id: 'subscription', label: 'Subscriptions', icon: 'fa-solid fa-credit-card' },
      { id: 'settings', label: 'Settings', icon: 'fa-solid fa-gear' },
      { id: 'teacher', label: 'Teacher Panel', icon: 'fa-solid fa-chalkboard-user' },
      { id: 'admin', label: 'Admin Panel', icon: 'fa-solid fa-user-shield' },
    ]}
  ] as const;
}

