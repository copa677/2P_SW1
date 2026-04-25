import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ProjectService } from '../services/project.service';
import { Project } from '../interfaces/project.interface';
import { AuthService } from '../services/auth.service';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../services/notification.service';
import { UsersMgmtComponent } from './users-mgmt/users-mgmt.component';
import { AssignmentsComponent } from './assignments/assignments.component';
import { ProcessExecutionComponent } from './process-execution/process-execution.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FormsModule, 
    UsersMgmtComponent, 
    AssignmentsComponent,
    ProcessExecutionComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  public projectService = inject(ProjectService);
  public authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  // Vistas: 'projects' | 'users' | 'assignments' | 'execution'
  currentView = signal<string>('projects');

  showCreateModal = signal<boolean>(false);
  showJoinModal = signal<boolean>(false);
  newProjectName = '';
  newProjectDescription = '';
  joinProjectId = '';

  setView(view: string) {
    this.currentView.set(view);
  }

  ngOnInit() {
    this.projectService.loadProjects().subscribe({
      error: (err) => console.error('Error loading projects', err)
    });
  }

  joinProject() {
    if (this.joinProjectId.trim()) {
      this.projectService.joinProject(this.joinProjectId.trim()).subscribe({
        next: (project) => {
          this.notificationService.success(`Te has unido al proyecto: ${project.name}`);
          this.showJoinModal.set(false);
          this.joinProjectId = '';
        },
        error: (err) => {
          const errMsg = err.error?.message || 'ID de proyecto inválido o ya eres colaborador';
          this.notificationService.error(errMsg);
        }
      });
    }
  }

  createNewProject() {
    if (this.newProjectName.trim()) {
      this.projectService.createProject(this.newProjectName, this.newProjectDescription).subscribe({
        next: (project) => {
          this.notificationService.success('Proyecto creado correctamente');
          this.router.navigate(['/editor', project.id]);
        },
        error: (err) => {
          this.notificationService.error('Error al crear el proyecto');
          console.error('Error creating project', err);
        }
      });
    }
  }

  async deleteProject(event: Event, id: string | undefined) {
    event.stopPropagation();
    if (!id) return;

    const confirmed = await this.notificationService.confirm(
      '¿Estás seguro de que deseas eliminar este proyecto? Esta acción no se puede deshacer.',
      'Eliminar Proyecto',
      'Eliminar Proyecto',
      'Cancelar',
      'danger'
    );

    if (confirmed) {
      this.projectService.deleteProject(id).subscribe({
        next: () => this.notificationService.success('Proyecto eliminado'),
        error: (err) => {
          this.notificationService.error('Error al eliminar el proyecto');
          console.error('Error deleting project', err);
        }
      });
    }
  }

  logout() {
    this.authService.logout();
  }
}
