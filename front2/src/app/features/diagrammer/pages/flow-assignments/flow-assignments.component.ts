import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DiagramService, Diagram } from '../../../../core/services/diagram.service';
import { UserService } from '../../../../core/services/user.service';
import { AuthService } from '../../../../core/services/auth.service';
import { FlowAssignmentService } from '../../../../core/services/flow-assignment.service';
import { User } from '../../../../core/models/user.model';

export interface LaneAssignment {
  calleId: string;
  calleNombre: string;
  assignedUserId: string;
  rol: 'ADMIN' | 'FUNCIONARIO' | 'DIAGRAMADOR' | 'CLIENTE';
}

export interface FlowAssignment {
  id?: string;
  projectId: string;
  projectName: string;
  assignments: LaneAssignment[];
  configuredBy?: string;
  updatedAt?: string;
}

@Component({
  selector: 'app-flow-assignments',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './flow-assignments.component.html'
})
export class FlowAssignmentsComponent implements OnInit {
  protected readonly diagramService = inject(DiagramService);
  protected readonly userService = inject(UserService);
  protected readonly authService = inject(AuthService);
  private readonly flowAssignmentService = inject(FlowAssignmentService);

  readonly selectedProjectId = signal<string>('');
  readonly selectedProjectLanes = signal<any[]>([]);
  readonly currentAssignments = signal<Record<string, string>>({}); // { calleId: assignedUserId }
  
  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly statusMessage = signal<string>('');
  readonly statusType = signal<'success' | 'error' | ''>('');

  // Computed: filter officials (FUNCIONARIO / ADMIN)
  readonly officials = computed(() => {
    return this.userService.users().filter(u => u.rol === 'FUNCIONARIO' || u.rol === 'ADMIN');
  });

  // Computed: filter clients (CLIENTE)
  readonly clients = computed(() => {
    return this.userService.users().filter(u => u.rol === 'CLIENTE');
  });

  ngOnInit() {
    // Asegurar que los datos estén cargados
    this.diagramService.loadProjects().subscribe();
    this.userService.loadUsers().subscribe();
  }

  onProjectChange() {
    const projectId = this.selectedProjectId();
    this.selectedProjectLanes.set([]);
    this.currentAssignments.set({});
    this.statusMessage.set('');
    this.statusType.set('');

    if (!projectId) return;

    const project = this.diagramService.diagrams().find(d => d.id === projectId);
    if (!project) return;

    // Parsear calles del diagrama
    try {
      const parsed = JSON.parse(project.data);
      const lanes = parsed.calles || [];
      this.selectedProjectLanes.set(lanes);
      
      // Cargar asignaciones guardadas en backend
      this.loading.set(true);
      this.flowAssignmentService.getAssignmentByProjectId(projectId).subscribe({
        next: (savedAssignment: FlowAssignment) => {
          this.loading.set(false);
          if (savedAssignment && savedAssignment.assignments) {
            const mapped: Record<string, string> = {};
            savedAssignment.assignments.forEach(a => {
              mapped[a.calleId] = a.assignedUserId;
            });
            this.currentAssignments.set(mapped);
          }
        },
        error: (err) => {
          this.loading.set(false);
          // 404 es esperado si no se ha configurado aún, no es un error real
          console.log('No se encontraron asignaciones previas para este proyecto.');
        }
      });
    } catch (e) {
      console.error('Error al parsear el JSON del diagrama', e);
      this.statusMessage.set('El diagrama seleccionado tiene un formato inválido.');
      this.statusType.set('error');
    }
  }

  isClientLane(laneName: string): boolean {
    if (!laneName) return false;
    const nameLower = laneName.toLowerCase();
    return nameLower === 'cliente' || nameLower === 'clientes';
  }

  saveAssignments() {
    const projectId = this.selectedProjectId();
    if (!projectId) return;

    const project = this.diagramService.diagrams().find(d => d.id === projectId);
    if (!project) return;

    const lanes = this.selectedProjectLanes();
    const assMap = this.currentAssignments();
    const laneAssignments: LaneAssignment[] = [];

    for (const lane of lanes) {
      const isClient = this.isClientLane(lane.nombre);
      const assignedUserId = assMap[lane.id] || '';
      
      if (!isClient && !assignedUserId) {
        this.statusMessage.set(`Por favor, asigne un funcionario a la calle: "${lane.nombre}".`);
        this.statusType.set('error');
        return;
      }

      laneAssignments.push({
        calleId: lane.id,
        calleNombre: lane.nombre,
        assignedUserId: isClient ? '' : assignedUserId, // Si es cliente se resuelve automáticamente
        rol: isClient ? 'CLIENTE' : 'FUNCIONARIO'
      });
    }

    const payload: FlowAssignment = {
      projectId: projectId,
      projectName: project.name,
      assignments: laneAssignments,
      configuredBy: this.authService.currentUser()?.nombres || 'Admin'
    };

    this.saving.set(true);
    this.statusMessage.set('');
    this.statusType.set('');

    this.flowAssignmentService.saveAssignment(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.statusMessage.set('Asignaciones guardadas correctamente.');
        this.statusType.set('success');
      },
      error: (err) => {
        this.saving.set(false);
        this.statusMessage.set('Error al guardar las asignaciones.');
        this.statusType.set('error');
        console.error(err);
      }
    });
  }
}
