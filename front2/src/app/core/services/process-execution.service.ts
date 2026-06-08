import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TaskInstance {
  id: string;
  processInstanceId: string;
  projectId: string;
  nodeId: string;
  nodeLabel: string;
  calleId: string;
  assignedUserId: string;
  status: string; // PENDING, COMPLETED, CANCELLED
  createdAt: string;
}

export interface ProcessInstance {
  id: string;
  projectId: string;
  projectName: string;
  trackingCode: string;
  status: string; // IN_PROGRESS, COMPLETED, CANCELLED
  initiatorId: string;
  initiatorName: string;
  currentNodeId?: string;
  currentLaneName?: string;
  startDate: string;
  endDate?: string;
  data: Record<string, any>;
}

@Injectable({
  providedIn: 'root'
})
export class ProcessExecutionService {
  private readonly http = inject(HttpClient);
  private readonly TASKS_API = `${environment.apiUrl}/tasks`;
  private readonly PROCESS_API = `${environment.apiUrl}/process`;

  getMyPendingTasks(): Observable<TaskInstance[]> {
    return this.http.get<TaskInstance[]>(`${this.TASKS_API}/my-pending`);
  }

  getTaskById(id: string): Observable<TaskInstance> {
    return this.http.get<TaskInstance>(`${this.TASKS_API}/${id}`);
  }

  getProcessById(id: string): Observable<ProcessInstance> {
    return this.http.get<ProcessInstance>(`${this.PROCESS_API}/${id}`);
  }

  startProcess(projectId: string): Observable<ProcessInstance> {
    return this.http.post<ProcessInstance>(`${this.PROCESS_API}/start/${projectId}`, {});
  }

  advanceProcess(instanceId: string, payload: any): Observable<ProcessInstance> {
    return this.http.post<ProcessInstance>(`${this.PROCESS_API}/${instanceId}/advance`, payload);
  }

  getTasksByProcess(processInstanceId: string): Observable<TaskInstance[]> {
    return this.http.get<TaskInstance[]>(`${this.TASKS_API}/process/${processInstanceId}`);
  }

  getProcessHistory(instanceId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.PROCESS_API}/${instanceId}/history`);
  }
}
