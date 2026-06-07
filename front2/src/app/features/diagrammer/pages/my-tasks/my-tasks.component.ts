import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ProcessExecutionService, TaskInstance } from '../../../../core/services/process-execution.service';
import { DiagramService } from '../../../../core/services/diagram.service';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-my-tasks',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-tasks.component.html'
})
export class MyTasksComponent implements OnInit {
  private readonly processExecService = inject(ProcessExecutionService);
  protected readonly diagramService = inject(DiagramService);
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly tasks = signal<TaskInstance[]>([]);
  readonly loading = signal<boolean>(false);

  ngOnInit() {
    this.diagramService.loadProjects().subscribe();
    this.loadTasks();
  }

  loadTasks() {
    this.loading.set(true);
    this.processExecService.getMyPendingTasks().subscribe({
      next: (data) => {
        this.tasks.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar la bandeja de entrada', err);
        this.loading.set(false);
      }
    });
  }

  getProjectName(projectId: string): string {
    const diag = this.diagramService.diagrams().find(d => d.id === projectId);
    return diag ? diag.name : 'Flujo de Negocio';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString();
    } catch {
      return dateStr;
    }
  }

  executeTask(taskId: string) {
    this.router.navigate(['/mis-tareas/ejecutar', taskId]);
  }
}
