import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkflowService } from '../../services/workflow.service';
import { ProjectService } from '../../services/project.service';
import { AuthService } from '../../services/auth.service';
import { ProcessInstance } from '../../interfaces/process.interface';
import { NotificationService } from '../../services/notification.service';
import * as joint from 'jointjs';

@Component({
  selector: 'app-process-execution',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './process-execution.component.html',
  styleUrl: './process-execution.component.css'
})
export class ProcessExecutionComponent implements OnInit {
  private workflowService = inject(WorkflowService);
  private projectService = inject(ProjectService);
  public authService = inject(AuthService);
  private notificationService = inject(NotificationService);

  public myProcesses = signal<ProcessInstance[]>([]);
  public assignedProjects = signal<any[]>([]);
  public selectedInstance = signal<ProcessInstance | null>(null);
  public currentProjectData: any = null;
  
  // Datos del formulario actual
  public formData: any = {};
  public currentFields: any[] = [];
  public outgoingOptions = signal<any[]>([]);

  ngOnInit() {
    this.loadMyProcesses();
    this.loadAssignedProjects();
  }

  loadMyProcesses() {
    this.workflowService.getMyProcesses().subscribe({
      next: (processes) => this.myProcesses.set(processes),
      error: (err) => this.notificationService.error('Error al cargar procesos')
    });
  }

  loadAssignedProjects() {
    this.projectService.loadProjects().subscribe(projects => {
      const userId = this.authService.currentUser()?.id;
      const assigned = projects.filter(p => p.assignedOfficialId === userId);
      this.assignedProjects.set(assigned);
    });
  }

  startNewProcess(project: any) {
    this.workflowService.startProcess(project.id).subscribe({
      next: (instance) => {
        this.notificationService.success(`Trámite iniciado: ${instance.trackingCode}`);
        this.loadMyProcesses();
        this.selectInstance(instance);
      },
      error: (err) => this.notificationService.error('Error al iniciar el trámite')
    });
  }

  selectInstance(instance: ProcessInstance) {
    this.selectedInstance.set(instance);
    this.formData = { ...instance.data };
    
    // Cargar el diagrama para extraer metadatos del nodo actual
    this.projectService.getProjectById(instance.projectId).subscribe(project => {
      this.currentProjectData = project.data;
      this.extractCurrentNodeInfo(instance.currentNodeId);
    });
  }

  public currentNodeLabel = signal<string>('Cargando...');

  extractCurrentNodeInfo(nodeId: string) {
    if (!this.currentProjectData) return;
    
    const data = typeof this.currentProjectData === 'string' 
      ? JSON.parse(this.currentProjectData) 
      : this.currentProjectData;
      
    const cells = data.cells || [];
    const currentNode = cells.find((c: any) => c.id === nodeId);
    
    if (currentNode) {
      // Extraer el texto del nodo (puede estar en attrs.label.text o ser un InitialNode)
      this.currentNodeLabel.set(
        currentNode.attrs?.label?.text || 
        (currentNode.type === 'standard.Circle' ? 'Inicio del Proceso' : 'Paso sin nombre')
      );

      this.currentFields = currentNode.formFields || [];
      
      // Inicializar campos vacíos
      this.currentFields.forEach(f => {
        if (this.formData[f.label] === undefined) {
          this.formData[f.label] = '';
        }
      });
      
      console.log('Nodo actual detectado:', this.currentNodeLabel(), 'Campos:', this.currentFields.length);

      // Buscar opciones de salida (flechas)
      const options = cells.filter((c: any) => 
        c.type === 'standard.Link' && 
        c.source && 
        c.source.id === nodeId
      ).map((link: any) => {
        return {
          label: link.labels?.[0]?.attrs?.text?.text || 'Continuar',
          targetId: link.target.id
        };
      });
      this.outgoingOptions.set(options);

    } else {
      this.currentNodeLabel.set('Nodo no encontrado');
      this.currentFields = [];
    }
  }

  advance(optionLabel?: string) {
    const instance = this.selectedInstance();
    if (instance) {
      const dataToSend = { ...this.formData };
      if (optionLabel && optionLabel !== 'Continuar') {
        // Metemos la decisión en los datos para que el backend la encuentre
        dataToSend['_decision'] = optionLabel;
      }

      this.workflowService.advanceProcess(instance.id, dataToSend).subscribe({
        next: (updated) => {
          this.notificationService.success('Paso completado');
          this.selectInstance(updated);
          this.loadMyProcesses();
        },
        error: (err) => this.notificationService.error('Error al avanzar el proceso')
      });
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'IN_PROGRESS': return 'badge-warning';
      case 'COMPLETED': return 'badge-success';
      default: return 'badge-secondary';
    }
  }
}
