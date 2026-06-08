import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ProcessExecutionService, TaskInstance } from '../../core/services/process-execution.service';
import { DiagramService } from '../../core/services/diagram.service';
import { AuthService } from '../../core/services/auth.service';
import { FlowAssignmentService } from '../../core/services/flow-assignment.service';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

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
  private readonly flowAssignmentService = inject(FlowAssignmentService);
  private readonly router = inject(Router);

  readonly tasks = signal<TaskInstance[]>([]);
  readonly projects = signal<any[]>([]); // Proyectos que el usuario puede iniciar
  readonly loading = signal<boolean>(false);
  readonly initiating = signal<string>(''); // ID del proyecto iniciándose

  ngOnInit() {
    this.loading.set(true);
    this.diagramService.loadProjects().subscribe({
      next: () => {
        this.loadTasks();
      },
      error: () => {
        this.loadTasks();
      }
    });
  }

  loadTasks() {
    this.loading.set(true);
    this.processExecService.getMyPendingTasks().subscribe({
      next: (data) => {
        this.tasks.set(data);
        this.loadProjectsAvailableToInitiate();
      },
      error: (err) => {
        console.error('Error al cargar la bandeja de entrada', err);
        this.loading.set(false);
      }
    });
  }

  loadProjectsAvailableToInitiate() {
    const diagrams = this.diagramService.diagrams();
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      this.projects.set([]);
      this.loading.set(false);
      return;
    }

    const checks$: any[] = [];

    diagrams.forEach(diag => {
      let parsed: any;
      try {
        parsed = JSON.parse(diag.data);
      } catch (e) {
        return; // Diagrama inválido
      }

      // Buscar el nodo de inicio
      const startNode = parsed.elementos?.find((el: any) => el.tipo === 'start');
      if (!startNode) return;

      const startLaneId = startNode.calleId;
      const startLane = parsed.calles?.find((c: any) => c.id === startLaneId);
      if (!startLane) return;

      const startLaneName = startLane.nombre || '';
      const isClientLane = startLaneName.toLowerCase() === 'cliente' || startLaneName.toLowerCase() === 'clientes';

      if (isClientLane && (currentUser.rol === 'CLIENTE' || currentUser.rol === 'ADMIN')) {
        checks$.push(of({ project: diag, canStart: true }));
      } else if (currentUser.rol === 'ADMIN') {
        checks$.push(of({ project: diag, canStart: true }));
      } else {
        // Consultar asignaciones
        const check = this.flowAssignmentService.getAssignmentByProjectId(diag.id).pipe(
          map(assignment => {
            if (assignment && assignment.assignments) {
              const laneAssign = assignment.assignments.find((a: any) => a.calleId === startLaneId);
              const canStart = laneAssign && laneAssign.assignedUserId === currentUser.id;
              return { project: diag, canStart: !!canStart };
            }
            return { project: diag, canStart: false };
          }),
          catchError(() => of({ project: diag, canStart: false }))
        );
        checks$.push(check);
      }
    });

    if (checks$.length === 0) {
      this.projects.set([]);
      this.loading.set(false);
      return;
    }

    forkJoin(checks$).subscribe({
      next: (results) => {
        const available = results
          .filter(r => r.canStart)
          .map(r => r.project);
        this.projects.set(available);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error al evaluar proyectos iniciables', err);
        this.loading.set(false);
      }
    });
  }

  startFlow(projectId: string) {
    this.initiating.set(projectId);
    this.processExecService.startProcess(projectId).subscribe({
      next: (instance) => {
        this.initiating.set('');
        // Al iniciar, redirigimos directamente al visor/ejecutor del proceso
        this.router.navigate(['/mis-tareas/seguimiento', instance.id]);
      },
      error: (err) => {
        console.error('Error al iniciar el flujo', err);
        this.initiating.set('');
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
