import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, map, catchError, of } from 'rxjs';
import { User, Role } from '../models/user.model';
import { environment } from '../../../environments/environment';

interface LoginResponse {
  access_token: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly AUTH_URL = `${environment.apiUrl}/auth`;

  private readonly _currentUser = signal<User | null>(null);

  // Exponer señal del usuario actual
  readonly currentUser = this._currentUser.asReadonly();

  // Verifica si hay un usuario logueado
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  constructor() {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('uml_user');
      const token = localStorage.getItem('uml_token');
      if (savedUser && token) {
        try {
          this._currentUser.set(JSON.parse(savedUser));
        } catch (e) {
          console.error('Error parsing session user', e);
        }
      }
    }
  }

  // Iniciar sesión
  login(correo: string, password?: string): Observable<boolean> {
    return this.http.post<LoginResponse>(`${this.AUTH_URL}/login`, { correo, password }).pipe(
      tap(response => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('uml_token', response.access_token);
          localStorage.setItem('uml_user', JSON.stringify(response.user));
        }
        this._currentUser.set(response.user);
      }),
      map(() => true),
      catchError(err => {
        console.error('Login error', err);
        return of(false);
      })
    );
  }

  // Cerrar sesión
  logout() {
    this._currentUser.set(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('uml_token');
      localStorage.removeItem('uml_user');
    }
    this.router.navigate(['/login']);
  }

  // Comprobar si el usuario actual posee un permiso dinámico específico
  hasPermission(tab: string, action: string): boolean {
    const user = this.currentUser();
    if (!user) return false;
    
    // Si es administrador, le otorgamos pase libre por defecto a todo
    if (user.rol === 'ADMIN') return true;

    const permKey = `${tab}:${action}`;
    return user.permisos && user.permisos.includes(permKey);
  }
}
