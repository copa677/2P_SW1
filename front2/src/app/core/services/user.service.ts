import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { User, Role } from '../models/user.model';
import { RoleService } from './role.service';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly roleService = inject(RoleService);
  private readonly API_URL = `${environment.apiUrl}/users`;
  private readonly AUTH_URL = `${environment.apiUrl}/auth`;

  private readonly _users = signal<User[]>([]);
  readonly users = this._users.asReadonly();

  constructor() {
    this.loadUsers().subscribe({
      error: err => console.error('Could not load users, unauthorized or offline', err)
    });
  }

  loadUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.API_URL).pipe(
      tap(data => this._users.set(data))
    );
  }

  // Insertar usuario
  addUser(user: Omit<User, 'id' | 'permisos'>) {
    const initialPerms = this.roleService.getPresetPermissions(user.rol);
    const registerPayload = {
      nombres: user.nombres,
      apellidos: user.apellidos,
      correo: user.correo,
      password: user.password || '123456', // contraseña por defecto
      rol: user.rol,
      permisos: initialPerms
    };

    this.http.post(`${this.AUTH_URL}/register`, registerPayload).subscribe({
      next: () => this.loadUsers().subscribe(),
      error: err => console.error('Error adding user', err)
    });
  }

  // Editar usuario
  updateUser(updatedUser: User) {
    const existing = this._users().find(u => u.id === updatedUser.id);
    let finalPermisos = updatedUser.permisos;
    if (existing && existing.rol !== updatedUser.rol) {
      finalPermisos = this.roleService.getPresetPermissions(updatedUser.rol);
    }

    const payload = {
      ...updatedUser,
      permisos: finalPermisos
    };

    this.http.put<User>(`${this.API_URL}/${updatedUser.id}`, payload).subscribe({
      next: () => this.loadUsers().subscribe(),
      error: err => console.error('Error updating user', err)
    });
  }

  // Actualizar los permisos granulares de un usuario
  updateUserPermissions(userId: string, permissions: string[]) {
    const user = this._users().find(u => u.id === userId);
    if (user) {
      const payload = {
        ...user,
        permisos: permissions
      };
      this.http.put<User>(`${this.API_URL}/${userId}`, payload).subscribe({
        next: () => this.loadUsers().subscribe(),
        error: err => console.error('Error updating user permissions', err)
      });
    }
  }

  // Restablecer permisos de un usuario al preset de su rol
  resetUserPermissionsToPreset(userId: string) {
    const user = this._users().find(u => u.id === userId);
    if (user) {
      this.updateUserPermissions(userId, this.roleService.getPresetPermissions(user.rol));
    }
  }

  // Eliminar usuario
  deleteUser(userId: string) {
    this.http.delete<void>(`${this.API_URL}/${userId}`).subscribe({
      next: () => this.loadUsers().subscribe(),
      error: err => console.error('Error deleting user', err)
    });
  }
}
