import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../config/env';
import { Observable } from 'rxjs';
import { Project } from '../interfaces/project.interface';

@Injectable({
  providedIn: 'root'
})
export class AssignmentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/projects`;

  // Obtener todos los proyectos del sistema (para el admin)
  getAllProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.apiUrl}/all`);
  }

  // Asignar un proyecto a un funcionario
  assignProject(projectId: string, userId: string, username: string): Observable<Project> {
    return this.http.patch<Project>(`${this.apiUrl}/${projectId}/assign`, null, {
      params: { userId, username }
    });
  }
}
