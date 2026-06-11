import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DiagramChatRequest {
  message: string;
  state: any;
  history?: any[];
}

export interface DiagramChatResponse {
  response: string;
  diagram: any;
}

@Injectable({
  providedIn: 'root'
})
export class AgentService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.iaApiUrl}/agent`;

  postDiagramChat(message: string, state: any, history?: any[]): Observable<DiagramChatResponse> {
    const payload: DiagramChatRequest = {
      message,
      state,
      history
    };
    return this.http.post<DiagramChatResponse>(`${this.API_URL}/diagram-chat`, payload);
  }
}
