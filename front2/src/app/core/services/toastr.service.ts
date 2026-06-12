import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ToastrService {
  readonly toasts = signal<Toast[]>([]);

  success(message: string, title?: string, duration = 4000) {
    this.addToast('success', message, title, duration);
  }

  error(message: string, title?: string, duration = 4000) {
    this.addToast('error', message, title, duration);
  }

  warning(message: string, title?: string, duration = 4000) {
    this.addToast('warning', message, title, duration);
  }

  info(message: string, title?: string, duration = 4000) {
    this.addToast('info', message, title, duration);
  }

  remove(id: string) {
    this.toasts.update(current => current.filter(t => t.id !== id));
  }

  private addToast(type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string, duration?: number) {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const newToast: Toast = { id, type, title, message, duration };

    this.toasts.update(current => [...current, newToast]);

    if (duration && duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }
  }
}
