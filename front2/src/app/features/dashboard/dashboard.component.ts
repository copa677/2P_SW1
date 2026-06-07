import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { RoleService } from '../../core/services/role.service';
import { Role } from '../../core/models/user.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
  protected readonly authService = inject(AuthService);
  protected readonly userService = inject(UserService);
  protected readonly roleService = inject(RoleService);

  getRoleLabel(role: Role): string {
    switch (role) {
      case 'ADMIN': return 'Administrador';
      case 'DIAGRAMADOR': return 'Diagramador';
      case 'FUNCIONARIO': return 'Funcionario';
      case 'CLIENTE': return 'Cliente';
      default: return role;
    }
  }

  getActivePermissionsCount(): number {
    const user = this.authService.currentUser();
    if (!user) return 0;
    
    // Si es admin, tiene todas las acciones de todas las pestañas
    if (user.rol === 'ADMIN') {
      return this.roleService.tabs.length * this.roleService.actions.length;
    }
    
    return user.permisos ? user.permisos.length : 0;
  }
}
