import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RoleService } from '../../core/services/role.service';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { Role, User } from '../../core/models/user.model';

@Component({
  selector: 'app-permisos',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './permisos.component.html'
})
export class PermisosComponent {
  protected readonly roleService = inject(RoleService);
  protected readonly userService = inject(UserService);
  protected readonly authService = inject(AuthService);

  // Señales para controlar la selección actual del dropdown de Usuario y Pestaña
  readonly selectedUserId = signal<string>('');
  readonly selectedTabId = signal<string>('dashboard');

  // Computed Signal: Obtiene el usuario seleccionado reactivamente
  readonly selectedUser = computed(() => {
    const list = this.userService.users();
    if (list.length === 0) return null;
    const currentId = this.selectedUserId();
    const found = list.find(u => u.id === currentId);
    if (found) return found;
    return list[0];
  });

  canEdit(): boolean {
    return this.authService.hasPermission('permisos', 'editar');
  }

  isSelectedUserAdmin(): boolean {
    const user = this.selectedUser();
    return user ? user.rol === 'ADMIN' : false;
  }

  // Comprobar si una acción está autorizada para el usuario y pestaña seleccionados
  isActionChecked(actionId: string): boolean {
    const user = this.selectedUser();
    if (!user) return false;
    
    // El administrador tiene todo marcado siempre
    if (user.rol === 'ADMIN') return true;

    const permKey = `${this.selectedTabId()}:${actionId}`;
    return user.permisos && user.permisos.includes(permKey);
  }

  // Cambiar usuario seleccionado
  onUserChange(userId: string) {
    this.selectedUserId.set(userId);
  }

  // Cambiar pestaña seleccionada
  onTabChange(tabId: string) {
    this.selectedTabId.set(tabId);
  }

  // Alternar permisos dinámicos en caliente para el usuario seleccionado
  togglePermission(actionId: string) {
    const user = this.selectedUser();
    if (!user || !this.canEdit() || user.rol === 'ADMIN') return;

    const permKey = `${this.selectedTabId()}:${actionId}`;
    let updatedPerms: string[];

    if (user.permisos && user.permisos.includes(permKey)) {
      updatedPerms = user.permisos.filter(p => p !== permKey);
    } else {
      updatedPerms = user.permisos ? [...user.permisos, permKey] : [permKey];
    }

    this.userService.updateUserPermissions(user.id, updatedPerms);
  }

  // Restablecer permisos de fábrica (Presets por Rol)
  resetPermissions() {
    const user = this.selectedUser();
    if (!user || !this.canEdit()) return;
    this.userService.resetUserPermissionsToPreset(user.id);
  }

  // Clases y badges estéticos
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

  getRoleBadgeClass(role: Role): string {
    switch (role) {
      case 'ADMIN': return 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400';
      case 'DIAGRAMADOR': return 'bg-teal-50 border-teal-200 text-teal-700 dark:bg-teal-950/20 dark:border-teal-900/40 dark:text-teal-400';
      case 'FUNCIONARIO': return 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-400';
      case 'CLIENTE': return 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-900/20 dark:border-slate-800/40 dark:text-slate-400';
      default: return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  }
}
