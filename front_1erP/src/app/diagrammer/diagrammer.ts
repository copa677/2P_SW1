import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { CanvasComponent } from './components/canvas/canvas.component';
import { PropertiesComponent } from './components/properties/properties.component';
import { DiagramService } from './services/diagram.service';
import { ProjectService } from '../services/project.service';
import { Project } from '../interfaces/project.interface';
import { NotificationService } from '../services/notification.service';
import { CollaborationService } from '../services/collaboration.service';
import { Subscription } from 'rxjs';
import { SpeechService } from './services/speech.service';
import { AIService } from './services/ai.service';

@Component({
  selector: 'app-diagrammer',
  standalone: true,
  imports: [CommonModule, ToolbarComponent, CanvasComponent, PropertiesComponent, RouterModule],
  templateUrl: './diagrammer.html',
  styleUrl: './diagrammer.css'
})
export class DiagrammerComponent implements OnInit, OnDestroy {
  public diagramService = inject(DiagramService);
  public collabService = inject(CollaborationService);
  private projectService = inject(ProjectService);
  private notificationService = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private speechService = inject(SpeechService);
  private aiService = inject(AIService);

  private subscriptions: Subscription = new Subscription();
  currentProject?: Project;
  
  // Estados de UI
  public isSidebarCollapsed = false;
  public isAIPanelOpen = false;
  public aiResponse: string = '';
  public isListening = false;

  ngOnInit() {
    this.route.params.subscribe(params => {
      const id = params['id'];
      this.diagramService.currentProjectId = id; // Guardar ID global
      
      this.projectService.getProjectById(id).subscribe({
        next: (project) => {
          this.currentProject = project;
          
          // Conectarse a la colaboración en tiempo real
          this.collabService.connect(id);
          this.setupCollaboration();

          if (project.data) {
            setTimeout(() => {
              this.diagramService.importJSON(project.data);
            }, 100);
          }
        },
        error: (err) => {
          console.error('Error loading project', err);
          this.notificationService.error('No se pudo cargar el proyecto');
          this.router.navigate(['/dashboard']);
        }
      });
    });
  }

  ngOnDestroy() {
    this.collabService.disconnect();
    this.diagramService.currentProjectId = null;
    this.subscriptions.unsubscribe();
  }

  private setupCollaboration() {
    // 1. Escuchar cambios locales (solo ADD, REMOVE, UPDATE directos)
    this.subscriptions.add(
      this.diagramService.graphChange$.subscribe((change: any) => {
        if (this.currentProject?.id) {
          if (change.type === 'COMMIT') {
              this.collabService.commitChange(this.currentProject.id, change.cell.id, change.cell);
          } else if (change.type === 'CLEAR') {
              this.collabService.sendMessage(this.currentProject.id, 'CLEAR', null);
          } else {
              // ADD / REMOVE
              this.collabService.sendMessage(this.currentProject.id, change.type, change.cell);
          }
        }
      })
    );

    // 2. Escuchar mensajes del socket y aplicarlos al lienzo
    this.subscriptions.add(
      this.collabService.messages$.subscribe(msg => {
        this.applyRemoteChange(msg);
      })
    );
  }

  private applyRemoteChange(msg: any) {
    const { type, payload } = msg;

    if (type === 'COMMIT') {
        const cellId = payload.cellId || payload.id;
        const cell = this.diagramService.graph.getCell(cellId);
        
        if (cell) {
            // Limpiar el payload de metadatos de mensajería para no ensuciar el modelo de JointJS
            const cleanData = { ...payload };
            delete cleanData.cellId;
            delete cleanData.projectId;
            delete cleanData.userId;
            delete cleanData.username;
            delete cleanData.type; // JointJS mantendrá su tipo original, no queremos cambiarlo

            // Usar prop() para un "Deep Merge" (fusión profunda). 
            // Esto preserva los atributos 'ref' de JointJS que mantienen el diseño y el centro del texto.
            (cell as any).prop(cleanData, { remote: true });
        }
    } else if (type === 'ADD') {
      if (!this.diagramService.graph.getCell(payload.id)) {
        this.diagramService.graph.addCell(payload, { remote: true });
      }
    } else if (type === 'MOVE') {
      const cell = this.diagramService.graph.getCell(payload.id) as any;
      if (cell && cell.position) cell.position(payload.x, payload.y);
    } else if (type === 'REMOVE') {
      const cell = this.diagramService.graph.getCell(payload.id);
      if (cell) {
        cell.remove({ remote: true });
      }
    } else if (type === 'CLEAR') {
        this.diagramService.graph.clear({ remote: true });
        this.notificationService.info(`El lienzo ha sido limpiado por ${msg.username}`);
    } else if (type === 'USER_JOINED') {
      // Notificación ya manejada por la barra de presencia visualmente, pero podemos dejar el log
    }
  }

  get elementCount() {
    return this.diagramService.graph.getCells().length;
  }

  async clearCanvas() {
    const confirmed = await this.notificationService.confirm(
      '¿Estás seguro de que deseas limpiar todo el lienzo? Esta acción eliminará todos los elementos actuales.',
      'Limpiar Lienzo',
      'Limpiar Todo',
      'Mantener diagrama',
      'danger'
    );

    if (confirmed) {
      this.diagramService.graph.clear();
      this.diagramService.closeProperties();
      this.notificationService.info('Lienzo limpiado');
    }
  }

  saveProject() {
    if (this.currentProject && this.currentProject.id) {
      const data = this.diagramService.exportJSON();
      
      const updatedProject: Project = {
        ...this.currentProject,
        data: data,
        elementCount: this.elementCount
      };

      this.loadProject(updatedProject);
    }
  }

  toggleSidebar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  toggleAIPanel() {
    this.isAIPanelOpen = !this.isAIPanelOpen;
  }

  async startVoiceCommand() {
    try {
      this.isListening = true;
      this.aiResponse = 'Escuchando...';
      const text = await this.speechService.startListening();
      this.isListening = false;
      await this.sendAICommand(text);
    } catch (err: any) {
      this.isListening = false;
      this.aiResponse = `Error de Voz: ${err}`;
      console.error('Speech Error:', err);
    }
  }

  async sendAICommand(text: string) {
    if (!text || text.trim() === '') return;
    
    this.aiResponse = `Procesando comando: "${text}"...`;
    
    try {
      const result = await this.aiService.sendPrompt(text);
      if (result.success) {
        this.aiResponse = `IA: He ejecutado ${result.count} acciones en el diagrama.`;
      } else {
        this.aiResponse = `IA: ${result.error || 'No pude entender el comando.'}`;
      }
    } catch (err: any) {
      this.aiResponse = `Error de IA: ${err.message || 'Error desconocido'}`;
      console.error('AI Error:', err);
    }
  }

  private loadProject(updatedProject: Project) {
    if (this.currentProject?.id) {
      this.projectService.updateProject(this.currentProject.id as string, updatedProject).subscribe({
        next: (saved) => {
          this.currentProject = saved;
          this.notificationService.success('Proyecto guardado correctamente');
        },
        error: (err) => {
          console.error('Error saving project', err);
          this.notificationService.error('Error al guardar el proyecto');
        }
      });
    }
  }

  downloadJSON() {
    const data = this.diagramService.exportJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.currentProject?.name || 'diagrama'}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
    this.notificationService.info('Archivo JSON generado');
  }

  copyProjectId() {
    if (this.currentProject?.id) {
      navigator.clipboard.writeText(this.currentProject.id);
      this.notificationService.success('ID del proyecto copiado al portapapeles');
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e: any) => {
        try {
          const json = JSON.parse(e.target.result);
          this.diagramService.importJSON(json);
          this.notificationService.success('Diagrama cargado con éxito');
          input.value = '';
        } catch (err) {
          this.notificationService.error('Error: El archivo no es un JSON válido');
          input.value = '';
        }
      };
      reader.readAsText(file);
    }
  }
}
