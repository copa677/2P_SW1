import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../config/env';
import { Project } from '../interfaces/project.interface';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/projects`;

  public projects = signal<Project[]>([]);

  constructor() {
    // No cargamos automáticamente al iniciar, el Dashboard lo llamará
  }

  loadProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(this.API_URL).pipe(
      tap(data => this.projects.set(data))
    );
  }

  getProjectById(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.API_URL}/${id}`);
  }

  createProject(name: string, description: string = ''): Observable<Project> {
    return this.http.post<Project>(this.API_URL, { name, description }).pipe(
      tap(newProject => {
        this.projects.update(current => [...current, newProject]);
      })
    );
  }

  updateProject(id: string, project: Project): Observable<Project> {
    return this.http.put<Project>(`${this.API_URL}/${id}`, project).pipe(
      tap(updated => {
        this.projects.update(current =>
          current.map(p => p.id === id ? updated : p)
        );
      })
    );
  }

  deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`).pipe(
      tap(() => {
        this.projects.update(current => current.filter(p => p.id !== id));
      })
    );
  }

  joinProject(id: string): Observable<Project> {
    return this.http.post<Project>(`${this.API_URL}/${id}/join`, {}).pipe(
      tap((newSharedProject) => {
        this.projects.update(current => [...current, newSharedProject]);
      })
    );
  }

  // Método auxiliar para el editor que no devuelve observable sino que se encarga del guardado
  saveProject(project: Project) {
    if (project.id) {
      this.updateProject(project.id, project).subscribe({
        next: () => console.log('Proyecto guardado en el servidor'),
        error: (err) => console.error('Error al guardar proyecto', err)
      });
    }
  }
}
