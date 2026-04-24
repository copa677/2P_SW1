import { Injectable, signal } from '@angular/core';
import { Toast, ToastType, ConfirmDialog } from '../interfaces/notification.interface';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private toastCounter = 0;
  
  // Lista reactiva de toasts
  public toasts = signal<Toast[]>([]);
  
  // Estado del diálogo de confirmación actual
  public currentConfirm = signal<ConfirmDialog | null>(null);

  /**
   * Muestra un aviso temporal (Toast)
   */
  showToast(message: string, type: ToastType = 'info', duration: number = 4000) {
    const id = ++this.toastCounter;
    const newToast: Toast = { id, message, type, duration };
    
    this.toasts.update(current => [...current, newToast]);

    // Auto-eliminación tras el tiempo especificado
    setTimeout(() => {
      this.removeToast(id);
    }, duration);
  }

  success(message: string) { this.showToast(message, 'success'); }
  error(message: string) { this.showToast(message, 'error'); }
  info(message: string) { this.showToast(message, 'info'); }
  warn(message: string) { this.showToast(message, 'warning'); }

  removeToast(id: number) {
    this.toasts.update(current => current.filter(t => t.id !== id));
  }

  /**
   * Muestra un diálogo de confirmación y devuelve una promesa con la decisión del usuario
   */
  confirm(
    message: string, 
    title: string = 'Confirmar acción', 
    confirmLabel: string = 'Aceptar', 
    cancelLabel: string = 'Cancelar',
    type: 'primary' | 'danger' = 'primary'
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.currentConfirm.set({
        title,
        message,
        confirmLabel,
        cancelLabel,
        type,
        resolve: (value: boolean) => {
          this.currentConfirm.set(null);
          resolve(value);
        }
      });
    });
  }
}
