import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FlowAssignmentService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/flow-assignments`;

  getAssignmentByProjectId(projectId: string): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/project/${projectId}`);
  }

  saveAssignment(payload: any): Observable<any> {
    return this.http.post<any>(this.API_URL, payload);
  }
}
