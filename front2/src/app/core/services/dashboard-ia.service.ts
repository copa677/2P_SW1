import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DashboardIaService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/dashboard`;

  /**
   * Obtiene las estadísticas generales consolidadas del sistema.
   */
  getGeneralStats(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/general-stats`);
  }

  /**
   * Obtiene las métricas calculadas por el motor de Deep Learning.
   */
  getIAMetrics(projectId: string, prompt?: string): Observable<any> {
    const params: any = { projectId };
    if (prompt) {
      params.prompt = prompt;
    }
    return this.http.get<any>(`${this.API_URL}/ia-metrics`, { params });
  }

  /**
   * Gatilla el reentrenamiento en caliente de las redes neuronales en FastAPI.
   */
  trainDLModels(projectId: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/ia-train`, null, {
      params: { projectId }
    });
  }

  /**
   * Descarga el reporte PDF generado por el servicio de reportes de FastAPI.
   */
  downloadIAReport(projectId: string, prompt?: string): Observable<Blob> {
    const params: any = {};
    if (prompt) {
      params.prompt = prompt;
    }
    return this.http.get(`${this.API_URL}/ia-report/${projectId}`, {
      params,
      responseType: 'blob'
    });
  }
}
