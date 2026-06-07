import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { User, Role } from '../../core/models/user.model';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './users.component.html'
})
export class UsersComponent {
  protected readonly userService = inject(UserService);
  protected readonly authService = inject(AuthService);

  // Estados locales para control de modals
  readonly showModal = signal<boolean>(false);
  readonly isEditMode = signal<boolean>(false);
  readonly userToDelete = signal<User | null>(null);

  // Formulario vinculado a ngModel
  formData: Omit<User, 'id' | 'permisos'> & { id?: string; permisos?: string[] } = {
    nombres: '',
    apellidos: '',
    correo: '',
    password: '',
    rol: 'CLIENTE'
  };

  // Permisos dinámicos
  canCreate() {
    return this.authService.hasPermission('usuarios', 'crear');
  }

  canEdit() {
    return this.authService.hasPermission('usuarios', 'editar');
  }

  canDelete() {
    return this.authService.hasPermission('usuarios', 'eliminar');
  }

  // Modales
  openAddModal() {
    this.isEditMode.set(false);
    this.formData = {
      nombres: '',
      apellidos: '',
      correo: '',
      password: '',
      rol: 'CLIENTE'
    };
    this.showModal.set(true);
  }

  openEditModal(user: User) {
    this.isEditMode.set(true);
    this.formData = { ...user };
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  saveUser() {
    // Validaciones básicas de formulario
    if (!this.formData.nombres || !this.formData.apellidos || !this.formData.correo) {
      return;
    }

    if (this.isEditMode() && this.formData.id) {
      this.userService.updateUser(this.formData as User);
    } else {
      this.userService.addUser(this.formData as Omit<User, 'id' | 'permisos'>);
    }

    this.closeModal();
  }

  confirmDelete(user: User) {
    this.userToDelete.set(user);
  }

  cancelDelete() {
    this.userToDelete.set(null);
  }

  executeDelete() {
    const user = this.userToDelete();
    if (user) {
      this.userService.deleteUser(user.id);
      this.userToDelete.set(null);
    }
  }

  // Clases y Labels estéticos
  getRoleLabel(role: Role): string {
    switch (role) {
      case 'ADMIN': return 'Admin';
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
