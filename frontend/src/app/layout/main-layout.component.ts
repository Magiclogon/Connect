import { Component, OnDestroy, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ChatService } from '../core/services/chat.service';
import { ApiService } from '../core/services/api.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIf],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  suggestions: {
    id: string;
    displayName: string;
    mutualFriends?: number;
    sharedGroups?: number;
    recommendationReason?: 'mutual_friends' | 'shared_groups' | 'both';
  }[] = [];
  notifications: { id: string; message: string; read: boolean; createdAt: string }[] = [];
  unreadMessages = 0;
  unreadNotifications = 0;
  private msgSub?: Subscription;
  private notifSub?: Subscription;

  constructor(
    public auth: AuthService,
    private chat: ChatService,
    private api: ApiService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.chat.connect();
    this.loadSuggestions();
    this.loadUnreadMessages();
    this.loadNotifications();
    this.msgSub = this.chat.onNewMessage().subscribe(() => {
      this.loadUnreadMessages();
      if (!this.router.url.startsWith('/messages')) this.playMessageSound();
    });
    this.notifSub = this.chat.onNotification().subscribe(() => {
      this.loadNotifications();
    });
  }

  ngOnDestroy() {
    this.msgSub?.unsubscribe();
    this.notifSub?.unsubscribe();
    this.chat.disconnect();
  }

  logout() {
    this.auth.logout();
  }

  loadSuggestions() {
    this.api.get<
      {
        id: string;
        displayName: string;
        mutualFriends?: number;
        sharedGroups?: number;
        recommendationReason?: 'mutual_friends' | 'shared_groups' | 'both';
      }[]
    >('/friends/suggestions').subscribe({
      next: (data) => (this.suggestions = data),
    });
  }

  addSuggestedFriend(userId: string) {
    this.api.post('/friends/request', { toUserId: userId }).subscribe({
      next: () => this.loadSuggestions(),
    });
  }

  loadUnreadMessages() {
    this.api.get<number>('/messages/unread-count').subscribe({
      next: (count) => (this.unreadMessages = Number(count) || 0),
    });
  }

  loadNotifications() {
    this.api.get<unknown[]>('/notifications').subscribe({
      next: (items) => {
        this.notifications = (items as { id: string; message: string; read: boolean; createdAt: string }[]) || [];
        this.unreadNotifications = this.notifications.filter((n) => !n.read).length;
      },
    });
  }

  markNotificationsRead() {
    this.api.post('/notifications/read-all', {}).subscribe({
      next: () => this.loadNotifications(),
    });
  }

  private playMessageSound() {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.03;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }
}
