import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastrService } from '../../core/services/toastr.service';
import { Role } from '../../core/models/user.model';
import { WelcomeTourComponent } from '../../shared/components/welcome-tour/welcome-tour.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, WelcomeTourComponent],
  templateUrl: './main-layout.component.html'
})
export class MainLayoutComponent {
  protected readonly authService = inject(AuthService);
  protected readonly themeService = inject(ThemeService);
  protected readonly toastrService = inject(ToastrService);

  readonly isSidebarOpen = signal<boolean>(true);

  toggleSidebar() {
    this.isSidebarOpen.update(v => !v);
  }

  getRoleLabel(role: Role): string {
    switch (role) {
      case 'ADMIN': return 'Administrador';
      case 'DIAGRAMADOR': return 'Diagramador';
      case 'FUNCIONARIO': return 'Funcionario';
      case 'CLIENTE': return 'Cliente';
      default: return role;
    }
  }

  getAvatarBgClass(role: Role): string {
    switch (role) {
      case 'ADMIN': return 'bg-indigo-600';
      case 'DIAGRAMADOR': return 'bg-teal-600';
      case 'FUNCIONARIO': return 'bg-blue-600';
      case 'CLIENTE': return 'bg-slate-600';
      default: return 'bg-slate-500';
    }
  }

  getToastClasses(type: string): string {
    switch (type) {
      case 'success':
        return 'bg-emerald-50/90 dark:bg-[#0f2d1e]/90 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60';
      case 'error':
        return 'bg-red-50/90 dark:bg-[#341111]/90 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900/60';
      case 'warning':
        return 'bg-amber-50/90 dark:bg-[#2d220f]/90 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/60';
      default:
        return 'bg-blue-50/90 dark:bg-[#0f212d]/90 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900/60';
    }
  }
}
