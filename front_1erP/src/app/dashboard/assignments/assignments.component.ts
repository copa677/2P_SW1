import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AssignmentService } from '../../services/assignment.service';
import { UserService } from '../../services/user.service';
import { Project } from '../../interfaces/project.interface';
import { User } from '../../interfaces/user.interface';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-assignments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assignments.component.html',
  styleUrl: './assignments.component.css'
})
export class AssignmentsComponent implements OnInit {
  private assignmentService = inject(AssignmentService);
  private userService = inject(UserService);
  private notificationService = inject(NotificationService);

  projects = signal<Project[]>([]);
  officials = signal<User[]>([]);
  
  selectedProjectId = signal<string>('');
  selectedUserId = signal<string>('');
  isLoading = signal<boolean>(false);

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);
    
    // Cargar todos los proyectos
    this.assignmentService.getAllProjects().subscribe({
      next: (data) => this.projects.set(data),
      error: () => this.notificationService.error('Error al cargar proyectos')
    });

    // Cargar usuarios y filtrar por FUNCIONARIO
    this.userService.getAllUsers().subscribe({
      next: (data) => {
        this.officials.set(data.filter(u => u.rol === 'FUNCIONARIO' && u.activo));
        this.isLoading.set(false);
      },
      error: () => {
        this.notificationService.error('Error al cargar funcionarios');
        this.isLoading.set(false);
      }
    });
  }

  assign() {
    if (!this.selectedProjectId() || !this.selectedUserId()) return;

    const official = this.officials().find(u => u.id === this.selectedUserId());
    if (!official) return;

    this.assignmentService.assignProject(
      this.selectedProjectId(), 
      this.selectedUserId(), 
      `${official.nombres} ${official.apellidos}`
    ).subscribe({
      next: () => {
        this.notificationService.success('Flujo asignado correctamente');
        this.loadData(); // Recargar para ver los cambios
        this.selectedProjectId.set('');
        this.selectedUserId.set('');
      },
      error: () => this.notificationService.error('Error al realizar la asignación')
    });
  }
}
