import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (notificationService.currentConfirm(); as dialog) {
      <div class="dialog-overlay" (click)="dialog.resolve(false)">
        <div class="dialog-content" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h3>{{ dialog.title }}</h3>
          </div>
          <div class="dialog-body">
            <p>{{ dialog.message }}</p>
          </div>
          <div class="dialog-footer">
            <button class="btn-cancel" (click)="dialog.resolve(false)">
              {{ dialog.cancelLabel || 'Cancelar' }}
            </button>
            <button 
              [class]="dialog.type === 'danger' ? 'btn-confirm-danger' : 'btn-confirm-primary'" 
              (click)="dialog.resolve(true)">
              {{ dialog.confirmLabel || 'Aceptar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(4px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
    }

    .dialog-content {
      background: white;
      width: 90%;
      max-width: 440px;
      border-radius: 1rem;
      padding: 1.5rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      animation: scaleIn 0.2s cubic-bezier(0.165, 0.84, 0.44, 1);
    }

    .dialog-header h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1.25rem;
      color: #0f172a;
      font-weight: 700;
    }

    .dialog-body p {
      margin: 0 0 1.5rem 0;
      color: #64748b;
      line-height: 1.5;
      font-size: 0.95rem;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }

    button {
      padding: 0.625rem 1.25rem;
      border-radius: 0.5rem;
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .btn-cancel {
      background: #f1f5f9;
      color: #64748b;
    }

    .btn-cancel:hover {
      background: #e2e8f0;
    }

    .btn-confirm-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-confirm-primary:hover {
      background: #2563eb;
    }

    .btn-confirm-danger {
      background: #ef4444;
      color: white;
    }

    .btn-confirm-danger:hover {
      background: #dc2626;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes scaleIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `]
})
export class ConfirmDialogComponent {
  public notificationService = inject(NotificationService);
}
