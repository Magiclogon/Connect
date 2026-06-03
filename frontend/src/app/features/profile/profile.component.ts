import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { AvatarComponent } from '../../shared/avatar.component';

interface Profile {
  id: string;
  displayName: string;
  email: string;
  bio: string;
  avatarMediaId: string | null;
  coverMediaId: string | null;
  address: string;
  city: string;
  workplace: string;
  website: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, AvatarComponent, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent implements OnInit {
  profile = signal<Profile | null>(null);
  friendCount = signal(0);
  friends = signal<Profile[]>([]);
  posts = signal<
    {
      id: string;
      content: string;
      createdAt: string;
      media: { type: string; mediaId?: string | null }[];
      author: { id: string; displayName: string; avatarMediaId?: string | null };
    }[]
  >([]);
  isOwnProfile = signal(true);
  displayName = '';
  bio = '';
  address = '';
  city = '';
  workplace = '';
  website = '';
  saved = signal(false);
  profileUserId = '';

  constructor(
    public auth: AuthService,
    public api: ApiService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const me = this.auth.currentUser();
      const id = params['id'] || me?.id || '';
      this.profileUserId = id;
      this.loadProfile(id);
    });
  }

  loadProfile(id: string) {
    const me = this.auth.currentUser();
    this.isOwnProfile.set(me?.id === id);
    this.api.get<{ user: Profile; friendCount: number; friends: Profile[]; isOwnProfile: boolean }>(`/users/${id}/full`).subscribe({
      next: (data) => {
        this.profile.set(data.user);
        this.friendCount.set(data.friendCount);
        this.friends.set(data.friends || []);
        this.isOwnProfile.set(data.isOwnProfile);
        this.displayName = data.user.displayName || '';
        this.bio = data.user.bio || '';
        this.address = data.user.address || '';
        this.city = data.user.city || '';
        this.workplace = data.user.workplace || '';
        this.website = data.user.website || '';
      },
    });
    this.api.get<{ id: string; content: string; createdAt: string; media: { type: string; mediaId?: string | null }[]; author: { id: string; displayName: string; avatarMediaId?: string | null } }[]>(
      `/posts/user/${id}`,
    ).subscribe({
      next: (data) => this.posts.set(data),
      error: () => this.posts.set([]),
    });
  }

  save() {
    this.api.put<Profile>('/users/me', {
      displayName: this.displayName,
      bio: this.bio,
      address: this.address,
      city: this.city,
      workplace: this.workplace,
      website: this.website,
    }).subscribe({
      next: (p) => {
        this.profile.set(p);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2000);
        const user = this.auth.currentUser();
        if (user) {
          localStorage.setItem('sm_user', JSON.stringify({ ...user, displayName: p.displayName }));
        }
      },
    });
  }

  uploadAvatar(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.upload(file).subscribe({
      next: (res) => {
        this.api.put<Profile>('/users/me', { avatarMediaId: res.mediaId }).subscribe({
          next: (p) => this.profile.set(p),
        });
      },
      error: (err) => alert(this.api.uploadErrorMessage(err)),
    });
  }

  uploadCover(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.api.upload(file).subscribe({
      next: (res) => {
        this.api.put<Profile>('/users/me', { coverMediaId: res.mediaId }).subscribe({
          next: (p) => this.profile.set(p),
        });
      },
      error: (err) => alert(this.api.uploadErrorMessage(err)),
    });
  }
}
