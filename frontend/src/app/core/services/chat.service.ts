import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private socket: Socket | null = null;

  constructor(private auth: AuthService) {}

  connect(): Socket {
    if (this.socket?.connected) return this.socket;
    this.socket = io(environment.wsUrl, {
      auth: { token: this.auth.getToken() },
      transports: ['websocket', 'polling'],
    });
    return this.socket;
  }

  joinConversation(conversationId: string) {
    this.connect().emit('joinConversation', conversationId);
  }

  sendMessage(data: {
    conversationId: string;
    type: string;
    content?: string;
    mediaId?: string;
  }): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const socket = this.connect();
      socket.timeout(5000).emit('sendMessage', data, (err: unknown, response: unknown) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(response);
      });
    });
  }

  onNewMessage(): Observable<{ conversationId: string; message: unknown }> {
    return new Observable((subscriber) => {
      const socket = this.connect();
      const handler = (data: { conversationId: string; message: unknown }) => {
        subscriber.next(data);
      };
      socket.on('newMessage', handler);
      return () => socket.off('newMessage', handler);
    });
  }

  onNotification(): Observable<unknown> {
    return new Observable((subscriber) => {
      const socket = this.connect();
      const handler = (data: unknown) => subscriber.next(data);
      socket.on('notification', handler);
      return () => socket.off('notification', handler);
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}
