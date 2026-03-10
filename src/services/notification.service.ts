import { Injectable, signal } from '@angular/core';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  icon: string;
  timestamp: Date;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  notifications = signal<AppNotification[]>([]);

  show(title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', icon: string = 'fa-bell') {
    const id = Math.random().toString(36).substring(7);
    const notification: AppNotification = {
      id,
      title,
      message,
      type,
      icon,
      timestamp: new Date()
    };

    this.notifications.update(n => [notification, ...n]);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      this.remove(id);
    }, 5000);
  }

  remove(id: string) {
    this.notifications.update(n => n.filter(item => item.id !== id));
  }
}
