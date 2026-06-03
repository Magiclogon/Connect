import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AvatarComponent } from '../../shared/avatar.component';

interface User {
  id: string;
  displayName: string;
  email: string;
  avatarMediaId?: string | null;
  bio?: string;
}

interface SuggestedUser extends User {
  mutualFriends: number;
  sharedGroups: number;
  recommendationReason: 'mutual_friends' | 'shared_groups' | 'both';
}

@Component({
  selector: 'app-friends',
  standalone: true,
  imports: [FormsModule, AvatarComponent, RouterLink],
  templateUrl: './friends.component.html',
  styleUrl: './friends.component.css',
})
export class FriendsComponent implements OnInit {
  friends = signal<User[]>([]);
  pending = signal<User[]>([]);
  sent = signal<User[]>([]);
  suggestions = signal<SuggestedUser[]>([]);
  searchResults = signal<User[]>([]);
  searchQuery = '';
  activeTab = signal<'friends' | 'requests' | 'suggestions' | 'search'>('friends');
  actionLoading = signal(false);
  actionError = signal<string>('');

  constructor(
    private api: ApiService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.api.get<User[]>('/friends').subscribe((d) => this.friends.set(d));
    this.api.get<User[]>('/friends/requests/pending').subscribe((d) => this.pending.set(d));
    this.api.get<User[]>('/friends/requests/sent').subscribe((d) => this.sent.set(d));
    this.loadSuggestions();
  }

  loadSuggestions() {
    this.api.get<SuggestedUser[]>('/friends/suggestions').subscribe({
      next: (d) => this.suggestions.set(d || []),
    });
  }

  search() {
    if (!this.searchQuery.trim()) return;
    this.api.get<User[]>(`/users/search?q=${encodeURIComponent(this.searchQuery)}`).subscribe({
      next: (d) => this.searchResults.set(d),
    });
  }

  sendRequest(userId: string) {
    this.actionError.set('');
    this.actionLoading.set(true);
    this.api.post('/friends/request', { toUserId: userId }).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.loadAll();
        this.loadSuggestions();
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.actionError.set(err?.error?.message || 'Impossible d’envoyer la demande.');
      },
    });
  }

  accept(userId: string) {
    this.actionError.set('');
    this.actionLoading.set(true);
    this.api.post(`/friends/accept/${userId}`, {}).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.loadAll();
        this.loadSuggestions();
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.actionError.set(err?.error?.message || 'Impossible d’accepter la demande.');
      },
    });
  }

  reject(userId: string) {
    this.actionError.set('');
    this.actionLoading.set(true);
    this.api.post(`/friends/reject/${userId}`, {}).subscribe({
      next: () => {
        this.actionLoading.set(false);
        this.loadAll();
        this.loadSuggestions();
      },
      error: (err) => {
        this.actionLoading.set(false);
        this.actionError.set(err?.error?.message || 'Impossible de refuser la demande.');
      },
    });
  }

  isSent(userId: string): boolean {
    return this.sent().some((u) => u.id === userId);
  }

  isFriend(userId: string): boolean {
    return this.friends().some((u) => u.id === userId);
  }

  message(userId: string) {
    this.api.post<{ id: string }>(`/messages/conversations/${userId}`, {}).subscribe({
      next: (conv) => this.router.navigate(['/messages', conv.id]),
    });
  }
}
