import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { RoleService } from '../../core/services/role.service';
import { DiagramService } from '../../core/services/diagram.service';
import { DashboardIaService } from '../../core/services/dashboard-ia.service';
import { SpeechService } from '../../core/services/speech.service';
import { Role } from '../../core/models/user.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe, FormsModule],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  protected readonly authService = inject(AuthService);
  protected readonly userService = inject(UserService);
  protected readonly roleService = inject(RoleService);
  protected readonly diagramService = inject(DiagramService);
  private readonly iaService = inject(DashboardIaService);
  protected readonly speechService = inject(SpeechService);
  private readonly route = inject(ActivatedRoute);

  // Pestañas Horizontales
  readonly activeTab = signal<'general' | 'ia'>('general');

  // Signals para voz
  readonly isListeningSpeech = signal<boolean>(false);
  readonly speechError = signal<string>('');

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'ia') {
        this.activeTab.set('ia');
      } else {
        this.activeTab.set('general');
      }
    });
  }

  toggleSpeechListening() {
    if (this.isListeningSpeech()) {
      this.speechService.stopListening();
      this.isListeningSpeech.set(false);
    } else {
      this.isListeningSpeech.set(true);
      this.speechError.set('');
      this.speechService.startListening()
        .then((text) => {
          this.isListeningSpeech.set(false);
          this.filterPrompt.set(text);
        })
        .catch((err) => {
          console.error('Error en reconocimiento de voz:', err);
          this.speechError.set('Error al escuchar el micrófono. Intenta de nuevo.');
          this.isListeningSpeech.set(false);
        });
    }
  }

  // Signals para Reportes IA y Auditoría
  readonly selectedProjectId = signal<string>('');
  readonly filterPrompt = signal<string>('');
  readonly iaMetrics = signal<any>(null);
  readonly isLoadingMetrics = signal<boolean>(false);
  readonly isDownloadingReport = signal<boolean>(false);
  readonly isTraining = signal<boolean>(false);
  readonly trainingStatus = signal<string>('');

  // Paginación
  readonly currentPage = signal<number>(1);
  readonly pageSize = 10;

  readonly paginatedAnomalies = computed(() => {
    const metrics = this.iaMetrics();
    if (!metrics || !metrics.anomalies) return [];
    const start = (this.currentPage() - 1) * this.pageSize;
    const end = start + this.pageSize;
    return metrics.anomalies.slice(start, end);
  });

  readonly totalPages = computed(() => {
    const metrics = this.iaMetrics();
    if (!metrics || !metrics.anomalies) return 1;
    return Math.max(1, Math.ceil(metrics.anomalies.length / this.pageSize));
  });

  readonly showingStart = computed(() => {
    const metrics = this.iaMetrics();
    if (!metrics || !metrics.anomalies || metrics.anomalies.length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize + 1;
  });

  readonly showingEnd = computed(() => {
    const metrics = this.iaMetrics();
    if (!metrics || !metrics.anomalies) return 0;
    return Math.min(this.currentPage() * this.pageSize, metrics.anomalies.length);
  });

  getRoleLabel(role: Role): string {
    switch (role) {
      case 'ADMIN': return 'Administrador';
      case 'DIAGRAMADOR': return 'Diagramador';
      case 'FUNCIONARIO': return 'Funcionario';
      case 'CLIENTE': return 'Cliente';
      default: return role;
    }
  }

  getActivePermissionsCount(): number {
    const user = this.authService.currentUser();
    if (!user) return 0;
    
    // Si es admin, tiene todas las acciones de todas las pestañas
    if (user.rol === 'ADMIN') {
      return this.roleService.tabs.length * this.roleService.actions.length;
    }
    
    return user.permisos ? user.permisos.length : 0;
  }

  // --- MÉTODOS DE REPORTES IA ---
  onProjectSelected(event: Event) {
    const target = event.target as HTMLSelectElement;
    const projectId = target.value;
    
    this.selectedProjectId.set(projectId);
    this.filterPrompt.set(''); // Reset prompt al cambiar de proyecto
    this.currentPage.set(1); // Reset de página
    
    if (!projectId) {
      this.iaMetrics.set(null);
      return;
    }

    this.loadMetrics(projectId);
  }

  onApplyPromptFilter() {
    const projectId = this.selectedProjectId();
    if (!projectId) return;
    this.currentPage.set(1); // Reset de página al filtrar
    this.loadMetrics(projectId, this.filterPrompt());
  }

  loadMetrics(projectId: string, prompt?: string) {
    this.isLoadingMetrics.set(true);
    this.currentPage.set(1); // Reset de página al cargar métricas
    this.iaService.getIAMetrics(projectId, prompt).subscribe({
      next: (res) => {
        this.iaMetrics.set(res);
        this.isLoadingMetrics.set(false);
      },
      error: (err) => {
        console.error('Error al cargar métricas de IA:', err);
        this.isLoadingMetrics.set(false);
      }
    });
  }

  downloadPDFReport() {
    const projectId = this.selectedProjectId();
    if (!projectId) return;

    this.isDownloadingReport.set(true);
    
    const diag = this.diagramService.diagrams().find(d => d.id === projectId);
    const projectName = diag ? diag.name.replace(/\s+/g, '_') : 'proyecto';

    this.iaService.downloadIAReport(projectId, this.filterPrompt()).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_optimizacion_${projectName}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.isDownloadingReport.set(false);
      },
      error: (err) => {
        console.error('Error descargando reporte PDF:', err);
        this.isDownloadingReport.set(false);
      }
    });
  }

  trainModels() {
    const projectId = this.selectedProjectId();
    if (!projectId) return;

    this.isTraining.set(true);
    this.trainingStatus.set('Entrenando modelos...');

    this.iaService.trainDLModels(projectId).subscribe({
      next: (res) => {
        this.trainingStatus.set('¡Entrenamiento completado!');
        setTimeout(() => {
          this.trainingStatus.set('');
          this.isTraining.set(false);
        }, 3000);
        this.loadMetrics(projectId, this.filterPrompt());
      },
      error: (err) => {
        console.error('Error al entrenar los modelos:', err);
        this.trainingStatus.set('Error en el entrenamiento');
        setTimeout(() => {
          this.trainingStatus.set('');
          this.isTraining.set(false);
        }, 3000);
      }
    });
  }
}
