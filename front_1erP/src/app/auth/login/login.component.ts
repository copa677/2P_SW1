import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);

  email = '';
  password = '';
  error = signal<string | null>(null);
  isLoading = signal<boolean>(false);

  onSubmit() {
    this.isLoading.set(true);
    this.error.set(null);

    // Simulamos una pequeña latencia para mejorar la experiencia de usuario
    setTimeout(() => {
      this.authService.login(this.email, this.password).subscribe(success => {
        if (success) {
          this.notificationService.success('¡Bienvenido de nuevo!');
          this.router.navigate(['/dashboard']);
        } else {
          this.notificationService.error('Las credenciales ingresadas son incorrectas.');
          this.error.set('Correo o contraseña incorrectos.');
          this.isLoading.set(false);
        }
      });
    }, 800);
  }
}
