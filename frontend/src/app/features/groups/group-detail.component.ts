import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AvatarComponent } from '../../shared/avatar.component';

interface Group {
  id: string;
  name: string;
  description: string;
  memberCount: number;
}

interface User {
  id: string;
  displayName: string;
  avatarMediaId?: string | null;
  role?: string;
}

interface Post {
  id: string;
  content: string;
  media: { type: string; mediaId?: string | null }[];
  author: User;
  createdAt: string;
}

@Component({
  selector: 'app-group-detail',
  standalone: true,
  imports: [FormsModule, AvatarComponent, RouterLink],
  templateUrl: './group-detail.component.html',
  styleUrl: './group-detail.component.css',
})
export class GroupDetailComponent implements OnInit {
  group = signal<Group | null>(null);
  members = signal<User[]>([]);
  posts = signal<Post[]>([]);
  newPost = '';
  groupId = '';

  constructor(
    public api: ApiService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.route.params.subscribe((p) => {
      this.groupId = p['id'];
      this.load();
    });
  }

  load() {
    this.api.get<Group[]>(`/groups/mine`).subscribe((groups) => {
      const g = groups.find((x) => x.id === this.groupId);
      if (g) this.group.set(g);
    });
    this.api.get<Group[]>(`/groups/discover`).subscribe((groups) => {
      const g = groups.find((x) => x.id === this.groupId);
      if (g && !this.group()) this.group.set(g);
    });
    this.api.get<User[]>(`/groups/${this.groupId}/members`).subscribe((m) => this.members.set(m));
    this.api.get<Post[]>(`/groups/${this.groupId}/posts`).subscribe((p) => this.posts.set(p));
  }

  createPost() {
    this.api.post(`/groups/${this.groupId}/posts`, { content: this.newPost }).subscribe({
      next: () => {
        this.newPost = '';
        this.api.get<Post[]>(`/groups/${this.groupId}/posts`).subscribe((p) => this.posts.set(p));
      },
    });
  }
}
