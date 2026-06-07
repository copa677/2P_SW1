import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { Role } from '../../core/models/user.model';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './main-layout.component.html'
})
export class MainLayoutComponent {
  protected readonly authService = inject(AuthService);
  protected readonly themeService = inject(ThemeService);

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
}
