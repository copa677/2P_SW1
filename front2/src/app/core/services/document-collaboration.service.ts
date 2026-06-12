import { Injectable, inject, signal } from '@angular/core';
import { Client, Message } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface CollaborationUser {
  id: string;
  username: string;
  color: string;
  initials: string;
}

export interface DocumentCollaborationMessage {
  type: 'TEXT_CHANGE' | 'CELL_CHANGE' | 'CELL_LOCK' | 'CELL_UNLOCK' | 'USER_JOINED' | 'USER_LEFT';
  projectId: string; // En el controlador backend se llama projectId genéricamente en DTO, mapearemos documentId aquí
  userId: string;
  username: string;
  payload: any;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentCollaborationService {
  private authService = inject(AuthService);
  private stompClient: Client | null = null;

  public isConnected = signal<boolean>(false);
  public activeUsers = signal<CollaborationUser[]>([]);
  public messages$ = new Subject<DocumentCollaborationMessage>();

  connect(documentId: string) {
    if (this.stompClient && this.stompClient.active) {
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('uml_token') : null;
    const user = this.authService.currentUser();

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(`${environment.apiUrl.replace('/api/v1', '')}/ws-uml`),
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    });

    this.stompClient.onConnect = (frame) => {
      this.isConnected.set(true);

      // Suscribirse a las actualizaciones de contenido del documento
      this.stompClient?.subscribe(`/topic/document/${documentId}`, (message: Message) => {
        if (message.body) {
          const collabMsg: DocumentCollaborationMessage = JSON.parse(message.body);
          if (collabMsg.userId !== user?.id) {
            this.handleIncomingMessage(collabMsg);
          }
        }
      });

      // Suscribirse a la presencia
      this.stompClient?.subscribe(`/topic/document/${documentId}/presence`, (message: Message) => {
        if (message.body) {
          const collabMsg: DocumentCollaborationMessage = JSON.parse(message.body);
          if (collabMsg.userId !== user?.id) {
            this.handleIncomingMessage(collabMsg);
          }
        }
      });

      this.sendPresence(documentId, 'USER_JOINED');
    };

    this.stompClient.onStompError = (frame) => {
      this.isConnected.set(false);
    };

    this.stompClient.onDisconnect = () => {
      this.isConnected.set(false);
      this.clearState();
    };

    this.stompClient.activate();
  }

  private handleIncomingMessage(msg: DocumentCollaborationMessage) {
    switch (msg.type) {
      case 'USER_JOINED':
        this.addUserToPresence(msg);
        this.messages$.next(msg);
        // Responder con presencia propia para que el recién ingresado nos registre
        this.sendPresence(msg.projectId, 'USER_JOINED');
        break;
      case 'USER_LEFT':
        this.removeUserFromPresence(msg.userId);
        this.messages$.next(msg);
        break;
      default:
        // Mensajes de cambios de contenido (TEXT_CHANGE, CELL_CHANGE, CELL_LOCK, CELL_UNLOCK)
        this.messages$.next(msg);
    }
  }

  sendMessage(documentId: string, type: 'TEXT_CHANGE' | 'CELL_CHANGE' | 'CELL_LOCK' | 'CELL_UNLOCK', payload: any) {
    if (!this.stompClient || !this.stompClient.connected) return;
    const user = this.authService.currentUser();
    const message = {
      type,
      projectId: documentId, // Reutilizamos el campo projectId en el DTO del backend
      userId: user?.id || '',
      username: user ? `${user.nombres} ${user.apellidos}` : 'Usuario',
      payload
    };
    this.stompClient.publish({
      destination: `/app/document/${documentId}/update`,
      body: JSON.stringify(message)
    });
  }

  private sendPresence(documentId: string, type: 'USER_JOINED' | 'USER_LEFT') {
    if (!this.stompClient || !this.stompClient.connected) return;
    const user = this.authService.currentUser();
    const message = {
      type,
      projectId: documentId,
      userId: user?.id || '',
      username: user ? `${user.nombres} ${user.apellidos}` : 'Usuario',
      payload: null
    };
    this.stompClient.publish({
      destination: `/app/document/${documentId}/presence`,
      body: JSON.stringify(message)
    });
  }

  private addUserToPresence(msg: DocumentCollaborationMessage) {
    this.activeUsers.update(users => {
      if (users.find(u => u.id === msg.userId)) return users;
      return [...users, {
        id: msg.userId,
        username: msg.username,
        color: this.getUserColor(msg.userId),
        initials: this.getInitials(msg.username)
      }];
    });
  }

  private removeUserFromPresence(userId: string) {
    this.activeUsers.update(users => users.filter(u => u.id !== userId));
  }

  private getUserColor(userId: string): string {
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#10b981', 
      '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#f43f5e'
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  private getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) || 'U';
  }

  private clearState() {
    this.activeUsers.set([]);
  }

  disconnect(documentId?: string) {
    if (this.stompClient) {
      if (documentId && this.stompClient.connected) {
        this.sendPresence(documentId, 'USER_LEFT');
      }
      
      this.stompClient.deactivate();
      this.isConnected.set(false);
      this.clearState();
      this.stompClient = null;
    }
  }
}
