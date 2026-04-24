import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-wrapper">
      @for (toast of notificationService.toasts(); track toast.id) {
        <div class="toast" [class]="toast.type" (click)="notificationService.removeToast(toast.id)">
          <div class="toast-icon">
            @switch (toast.type) {
              @case ('success') { <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> }
              @case ('error') { <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg> }
              @case ('warning') { <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg> }
              @default { <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> }
            }
          </div>
          <div class="toast-content">{{ toast.message }}</div>
          <button class="toast-close" (click)="notificationService.removeToast(toast.id); $event.stopPropagation()">×</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-wrapper {
      position: fixed;
      top: 1.5rem;
      right: 1.5rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      pointer-events: none;
    }

    .toast {
      pointer-events: auto;
      min-width: 280px;
      max-width: 400px;
      padding: 1rem;
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      cursor: pointer;
      animation: slideIn 0.3s ease-out;
      transition: transform 0.2s, opacity 0.2s;
    }

    .toast:hover {
      transform: translateY(-2px);
    }

    .toast-icon {
      flex-shrink: 0;
    }

    .toast-content {
      flex-grow: 1;
      font-size: 0.875rem;
      font-weight: 500;
      color: #1e293b;
    }

    .toast-close {
      background: none;
      border: none;
      font-size: 1.25rem;
      color: #94a3b8;
      cursor: pointer;
      padding: 0.25rem;
      line-height: 1;
    }

    /* Types style */
    .success { border-left: 4px solid #22c55e; }
    .success .toast-icon { color: #22c55e; }
    
    .error { border-left: 4px solid #ef4444; }
    .error .toast-icon { color: #ef4444; }
    
    .warning { border-left: 4px solid #f59e0b; }
    .warning .toast-icon { color: #f59e0b; }
    
    .info { border-left: 4px solid #3b82f6; }
    .info .toast-icon { color: #3b82f6; }

    @keyframes slideIn {
      from { transform: translateX(20px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `]
})
export class ToastContainerComponent {
  public notificationService = inject(NotificationService);
}
