import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Diagram {
  id: string;
  name: string;
  creatorId: string;
  creatorName: string;
  createdAt: string;
  data: string; // Serialización en JSON del Graph de JointJS: {"cells": [...]}
  collaboratorIds?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class DiagramService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/projects`;

  private readonly _diagrams = signal<Diagram[]>([]);
  readonly diagrams = this._diagrams.asReadonly();

  constructor() {
    this.loadProjects().subscribe({
      error: err => console.error('Could not load diagrams, unauthorized or offline', err)
    });
  }

  loadProjects(): Observable<any[]> {
    return this.http.get<any[]>(this.API_URL).pipe(
      tap(projects => {
        const mapped = projects.map(p => this.mapProjectToDiagram(p));
        this._diagrams.set(mapped);
      })
    );
  }

  private mapProjectToDiagram(proj: any): Diagram {
    return {
      id: proj.id,
      name: proj.name,
      creatorId: proj.ownerId || '',
      creatorName: proj.assignedOfficialName || 'Usuario',
      createdAt: proj.createdAt ? new Date(proj.createdAt).toLocaleDateString() : new Date().toLocaleDateString(),
      data: proj.data ? (typeof proj.data === 'string' ? proj.data : JSON.stringify(proj.data)) : JSON.stringify({ cells: [] }),
      collaboratorIds: proj.collaboratorIds || []
    };
  }

  // Crear diagrama (retorna observable)
  createDiagram(name: string, creatorId: string, creatorName: string): Observable<any> {
    const payload = {
      name,
      description: 'Creado desde Diagrammer Editor'
    };

    return this.http.post<any>(this.API_URL, payload).pipe(
      tap(newProj => {
        const diag = this.mapProjectToDiagram(newProj);
        this._diagrams.update(prev => [diag, ...prev]);
      })
    );
  }

  // Guardar datos del canvas de JointJS
  saveDiagramData(id: string, dataJson: string) {
    let parsedData = {};
    try {
      parsedData = JSON.parse(dataJson);
    } catch (e) {
      console.error('Error parsing JointJS cells', e);
    }

    const existing = this._diagrams().find(d => d.id === id);

    const payload = {
      name: existing ? existing.name : 'Diagrama sin nombre',
      description: 'Creado desde Diagrammer Editor',
      data: parsedData
    };

    this.http.put<any>(`${this.API_URL}/${id}`, payload).subscribe({
      next: (updatedProj) => {
        const diag = this.mapProjectToDiagram(updatedProj);
        this._diagrams.update(prev =>
          prev.map(d => (d.id === id ? diag : d))
        );
        console.log('Proyecto guardado en el servidor');
      },
      error: (err) => console.error('Error al guardar proyecto', err)
    });
  }

  // Unirse a un proyecto mediante su ID/código de sala
  joinProject(id: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/${id}/join`, {}).pipe(
      tap(joinedProj => {
        const diag = this.mapProjectToDiagram(joinedProj);
        this._diagrams.update(prev => {
          if (prev.some(d => d.id === diag.id)) {
            return prev.map(d => d.id === diag.id ? diag : d);
          }
          return [diag, ...prev];
        });
      })
    );
  }

  // Eliminar diagrama
  deleteDiagram(id: string) {
    this.http.delete<void>(`${this.API_URL}/${id}`).subscribe({
      next: () => {
        this._diagrams.update(prev => prev.filter(d => d.id !== id));
      },
      error: err => console.error('Error deleting project', err)
    });
  }
}
