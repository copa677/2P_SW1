import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, map, catchError, of } from 'rxjs';
import { environment } from '../config/env';
import { User, TokenResponse } from '../interfaces/user.interface';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly AUTH_URL = `${environment.apiUrl}/v1/auth`;

  public currentUser = signal<User | null>(null);
  public isAuthenticated = signal<boolean>(false);

  constructor() {
    this.checkSession();
  }

  private checkSession() {
    const token = localStorage.getItem('uml_token');
    const userJson = localStorage.getItem('uml_user');
    
    if (token && userJson) {
      this.currentUser.set(JSON.parse(userJson));
      this.isAuthenticated.set(true);
    }
  }

  login(correo: string, password: string): Observable<boolean> {
    return this.http.post<TokenResponse>(`${this.AUTH_URL}/login`, { correo, password }).pipe(
      tap(response => {
        localStorage.setItem('uml_token', response.access_token);
        localStorage.setItem('uml_user', JSON.stringify(response.user));
        
        this.currentUser.set(response.user);
        this.isAuthenticated.set(true);
      }),
      map(() => true),
      catchError(err => {
        console.error('Login error', err);
        return of(false);
      })
    );
  }

  register(userData: any): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${this.AUTH_URL}/register`, userData);
  }

  logout() {
    localStorage.removeItem('uml_token');
    localStorage.removeItem('uml_user');
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('uml_token');
  }
}
