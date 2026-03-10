
import { Injectable, signal, computed } from '@angular/core';

export interface StudyTask {
  id: string;
  title: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  startTime: string;
  duration: string;
  status: 'pending' | 'completed' | 'missed';
  date: string;
}

export interface UserStats {
  streak: number;
  xp: number;
  level: number;
  completionRate: number;
  productivityIndex: number;
}

@Injectable({
  providedIn: 'root'
})
export class SmartSchedulerService {
  tasks = signal<StudyTask[]>(this.loadTasks());
  stats = signal<UserStats>(this.loadStats());
  
  selectedDate = signal<string>(new Date().toISOString().split('T')[0]);

  dailyTasks = computed(() => {
    return this.tasks().filter(t => t.date === this.selectedDate());
  });

  completionPercentage = computed(() => {
    const daily = this.dailyTasks();
    if (daily.length === 0) return 0;
    const completed = daily.filter(t => t.status === 'completed').length;
    return Math.round((completed / daily.length) * 100);
  });

  constructor() {
    // Auto-save effect could be added here if using signals effect
  }

  private loadTasks(): StudyTask[] {
    const saved = localStorage.getItem('smart_study_tasks');
    if (saved) return JSON.parse(saved);
    
    // Default mock data
    return [
      { id: '1', title: 'مراجعة الميكانيكا الكمية', subject: 'الفيزياء', difficulty: 'hard', startTime: '09:00', duration: '60m', status: 'completed', date: new Date().toISOString().split('T')[0] },
      { id: '2', title: 'تفاعلات الأكسدة', subject: 'الكيمياء', difficulty: 'medium', startTime: '11:00', duration: '45m', status: 'pending', date: new Date().toISOString().split('T')[0] },
      { id: '3', title: 'تحليل الاقتصاد الكلي', subject: 'الاقتصاد', difficulty: 'easy', startTime: '14:00', duration: '30m', status: 'missed', date: new Date().toISOString().split('T')[0] },
    ];
  }

  private loadStats(): UserStats {
    const saved = localStorage.getItem('smart_study_stats');
    if (saved) return JSON.parse(saved);
    return { streak: 5, xp: 1250, level: 4, completionRate: 85, productivityIndex: 92 };
  }

  save() {
    localStorage.setItem('smart_study_tasks', JSON.stringify(this.tasks()));
    localStorage.setItem('smart_study_stats', JSON.stringify(this.stats()));
  }

  addTask(task: StudyTask) {
    this.tasks.update(t => [...t, task]);
    this.save();
  }

  updateTaskStatus(id: string, status: 'completed' | 'missed' | 'pending') {
    this.tasks.update(tasks => tasks.map(t => t.id === id ? { ...t, status } : t));
    this.save();
  }

  generateAISchedule(subjects: string[], difficulty: string, days: string[]) {
    // Mocking AI generation for multiple subjects across multiple days
    const newTasks: StudyTask[] = [];
    
    days.forEach(date => {
      subjects.forEach((subject, index) => {
        newTasks.push({
          id: Math.random().toString(36).substr(2, 9),
          title: `جلسة ${subject} مكثفة`,
          subject: subject,
          difficulty: difficulty as 'easy' | 'medium' | 'hard',
          startTime: `${9 + index * 2}:00`,
          duration: '90m',
          status: 'pending',
          date: date
        });
      });
    });

    this.tasks.update(t => [...t, ...newTasks]);
    this.save();
  }
}
