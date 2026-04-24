import { Injectable, inject, signal } from '@angular/core';
import { Client, Message } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../config/env';

export interface CollaborationUser {
  id: string;
  username: string;
  color: string;
  initials: string;
}

export interface CollaborationMessage {
  type: 'MOVE' | 'ADD' | 'DELETE' | 'PROJECT_UPDATED' | 'USER_JOINED' | 'USER_LEFT' | 'CURSOR' | 'LOCK' | 'UNLOCK' | 'COMMIT' | 'CLEAR';
  projectId: string;
  userId: string;
  username: string;
  payload: any;
}

@Injectable({
  providedIn: 'root'
})
export class CollaborationService {
  private authService = inject(AuthService);
  private stompClient: Client | null = null;

  // Estados reactivos de la colaboración
  public isConnected = signal<boolean>(false);
  public activeUsers = signal<CollaborationUser[]>([]);
  public remoteCursors = signal<Map<string, {x: number, y: number, username: string, color: string}>>(new Map());
  public activeLocks = signal<Map<string, {userId: string, username: string}>>(new Map());
  
  public messages$ = new Subject<CollaborationMessage>();

  private lastCursorUpdate = 0;

  connect(projectId: string) {
    if (this.stompClient && this.stompClient.active) {
      return;
    }

    const token = this.authService.getToken();
    const user = this.authService.currentUser();

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(`${environment.apiUrl.replace('/api', '')}/ws-uml`),
      connectHeaders: {
        Authorization: `Bearer ${token}`
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    });

    this.stompClient.onConnect = (frame) => {
      this.isConnected.set(true);

      this.stompClient?.subscribe(`/topic/project/${projectId}`, (message: Message) => {
        if (message.body) {
          const collabMsg: CollaborationMessage = JSON.parse(message.body);
          if (collabMsg.userId !== user?.id) {
            this.handleIncomingMessage(collabMsg);
          }
        }
      });

      this.sendPresence(projectId, 'USER_JOINED');
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

  private handleIncomingMessage(msg: CollaborationMessage) {
    switch (msg.type) {
      case 'CURSOR':
        this.updateRemoteCursor(msg);
        break;
      case 'LOCK':
        this.updateLock(msg.payload.cellId, msg.userId, msg.username);
        break;
      case 'UNLOCK':
      case 'COMMIT':
        this.releaseLock(msg.payload.cellId);
        if (msg.type === 'COMMIT') this.messages$.next(msg);
        break;
      case 'USER_JOINED':
        this.addUserToPresence(msg);
        this.messages$.next(msg);
        // Responder con nuestra propia presencia para que el nuevo nos vea
        this.sendPresence(msg.projectId, 'USER_JOINED');
        break;
      case 'USER_LEFT':
        this.removeUserFromPresence(msg.userId);
        this.messages$.next(msg);
        break;
      default:
        this.messages$.next(msg);
    }
  }

  // --- Gestión de Punteros ---
  sendCursor(projectId: string, x: number, y: number) {
    const now = Date.now();
    if (now - this.lastCursorUpdate < 100) return; // Throttle 10Hz
    this.lastCursorUpdate = now;

    this.sendMessage(projectId, 'CURSOR', { x, y });
  }

  private updateRemoteCursor(msg: CollaborationMessage) {
    this.remoteCursors.update(current => {
      const newMap = new Map(current);
      const user = this.activeUsers().find(u => u.id === msg.userId);
      newMap.set(msg.userId, { 
        x: msg.payload.x, 
        y: msg.payload.y, 
        username: msg.username,
        color: user?.color || this.getUserColor(msg.userId) 
      });
      return newMap;
    });
  }

  // --- Gestión de Bloqueos ---
  lockCell(projectId: string, cellId: string) {
    this.sendMessage(projectId, 'LOCK', { cellId });
  }

  unlockCell(projectId: string, cellId: string) {
    this.sendMessage(projectId, 'UNLOCK', { cellId });
  }

  commitChange(projectId: string, cellId: string, cellData: any) {
    this.sendMessage(projectId, 'COMMIT', { cellId, ...cellData });
  }

  private updateLock(cellId: string, userId: string, username: string) {
    this.activeLocks.update(current => {
      const newMap = new Map(current);
      newMap.set(cellId, { userId, username });
      return newMap;
    });
  }

  private releaseLock(cellId: string) {
    this.activeLocks.update(current => {
      const newMap = new Map(current);
      newMap.delete(cellId);
      return newMap;
    });
  }

  // --- Gestión de Presencia ---
  private addUserToPresence(msg: CollaborationMessage) {
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
    this.remoteCursors.update(cursors => {
      const newMap = new Map(cursors);
      newMap.delete(userId);
      return newMap;
    });
    // Limpiar locks de este usuario
    this.activeLocks.update(locks => {
      const newMap = new Map(locks);
      for (const [cellId, lock] of newMap.entries()) {
        if (lock.userId === userId) newMap.delete(cellId);
      }
      return newMap;
    });
  }

  sendMessage(projectId: string, type: string, payload: any) {
    if (!this.stompClient || !this.stompClient.connected) return;
    const user = this.authService.currentUser();
    const message = {
      type,
      projectId,
      userId: user?.id || '',
      username: user?.nombres || 'Usuario',
      payload
    };
    this.stompClient.publish({
      destination: `/app/project/${projectId}/update`,
      body: JSON.stringify(message)
    });
  }

  private sendPresence(projectId: string, type: 'USER_JOINED' | 'USER_LEFT') {
    this.sendMessage(projectId, type, null);
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
    this.remoteCursors.set(new Map());
    this.activeLocks.set(new Map());
  }

  disconnect() {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.isConnected.set(false);
      this.clearState();
    }
  }
}
