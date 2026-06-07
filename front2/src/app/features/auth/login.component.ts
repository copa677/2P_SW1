import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  password = '';
  errorMessage = signal<string>('');

  onSubmit() {
    this.errorMessage.set('');
    if (!this.username) {
      this.errorMessage.set('Por favor, ingresa el correo.');
      return;
    }

    this.authService.login(this.username, this.password).subscribe(success => {
      if (success) {
        this.router.navigate(['/dashboard']);
      } else {
        this.errorMessage.set('Credenciales incorrectas.');
      }
    });
  }

  quickLogin(role: string) {
    let email = '';
    let pass = role;
    if (role === 'admin') email = 'admin@politicas.com';
    else if (role === 'diagramador') email = 'beatriz.m@politicas.com';
    else if (role === 'funcionario') email = 'carlos.f@politicas.com';
    else if (role === 'cliente') email = 'doris.g@gmail.com';

    this.errorMessage.set('');
    
    this.authService.login(email, pass).subscribe(success => {
      if (success) {
        this.router.navigate(['/dashboard']);
      } else {
        this.errorMessage.set('No se pudo iniciar sesión con la cuenta de prueba.');
      }
    });
  }
}
