import { Component, inject, signal, effect } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { DiagramService } from '../../core/services/diagram.service';
import { DashboardIaService } from '../../core/services/dashboard-ia.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './reports.component.html'
})
export class ReportsComponent {
  protected readonly diagramService = inject(DiagramService);
  private readonly iaService = inject(DashboardIaService);
  protected readonly authService = inject(AuthService);

  // Signals reactivas para la vista
  readonly selectedProjectId = signal<string>('');
  readonly iaMetrics = signal<any>(null);
  readonly isLoadingMetrics = signal<boolean>(false);
  readonly isDownloadingReport = signal<boolean>(false);
  readonly isTraining = signal<boolean>(false);
  readonly trainingStatus = signal<string>('');

  onProjectSelected(event: Event) {
    const target = event.target as HTMLSelectElement;
    const projectId = target.value;
    
    this.selectedProjectId.set(projectId);
    
    if (!projectId) {
      this.iaMetrics.set(null);
      return;
    }

    this.loadMetrics(projectId);
  }

  loadMetrics(projectId: string) {
    this.isLoadingMetrics.set(true);
    this.iaService.getIAMetrics(projectId).subscribe({
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

    this.iaService.downloadIAReport(projectId).subscribe({
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
        // Recargar métricas tras el entrenamiento
        this.loadMetrics(projectId);
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
