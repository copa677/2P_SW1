import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../interfaces/user.interface';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-users-mgmt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users-mgmt.component.html',
  styleUrl: './users-mgmt.component.css'
})
export class UsersMgmtComponent implements OnInit {
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);

  users = signal<User[]>([]);
  isLoading = signal<boolean>(false);
  
  // Estado para el modal de creación
  showCreateModal = signal<boolean>(false);
  newUser = {
    nombres: '',
    apellidos: '',
    correo: '',
    password: '',
    rol: 'DIAGRAMADOR'
  };

  ngOnInit() {
    this.loadUsers();
  }

  createUser() {
    if (!this.newUser.nombres || !this.newUser.correo || !this.newUser.password) {
      this.notificationService.error('Por favor rellene los campos obligatorios');
      return;
    }

    this.isLoading.set(true);
    this.authService.register(this.newUser).subscribe({
      next: () => {
        this.notificationService.success('Usuario creado correctamente');
        this.showCreateModal.set(false);
        this.resetNewUser();
        this.loadUsers();
      },
      error: (err: any) => {
        this.notificationService.error(err.error?.message || 'Error al crear usuario');
        this.isLoading.set(false);
      }
    });
  }

  private resetNewUser() {
    this.newUser = {
      nombres: '',
      apellidos: '',
      correo: '',
      password: '',
      rol: 'DIAGRAMADOR'
    };
  }

  loadUsers() {
    this.isLoading.set(true);
    this.userService.getAllUsers().subscribe({
      next: (data) => {
        this.users.set(data);
        this.isLoading.set(false);
      },
      error: (err: any) => {
        this.notificationService.error('Error al cargar usuarios');
        this.isLoading.set(false);
      }
    });
  }

  async toggleUserStatus(user: User) {
    const action = user.activo ? 'desactivar' : 'activar';
    const confirmed = await this.notificationService.confirm(
      `¿Estás seguro de que deseas ${action} al usuario ${user.nombres}?`,
      'Cambiar Estado',
      action.toUpperCase(),
      'Cancelar',
      user.activo ? 'danger' : 'primary'
    );

    if (confirmed) {
      const updatedUser = { ...user, activo: !user.activo };
      this.userService.updateUser(user.id, updatedUser).subscribe({
        next: () => {
          this.notificationService.success(`Usuario ${user.nombres} ${action}ado`);
          this.loadUsers();
        }
      });
    }
  }

  updateRole(user: User, newRole: any) {
    const updatedUser = { ...user, rol: newRole };
    this.userService.updateUser(user.id, updatedUser).subscribe({
      next: () => {
        this.notificationService.success('Rol actualizado correctamente');
        this.loadUsers();
      }
    });
  }

  async deleteUser(user: User) {
    const confirmed = await this.notificationService.confirm(
      `¿Eliminar definitivamente a ${user.nombres}? Esta acción no se puede deshacer.`,
      'Eliminar Usuario',
      'Eliminar',
      'Cancelar',
      'danger'
    );

    if (confirmed) {
      this.userService.deleteUser(user.id).subscribe({
        next: () => {
          this.notificationService.success('Usuario eliminado');
          this.loadUsers();
        }
      });
    }
  }
}
