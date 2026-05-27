import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AvatarComponent } from '../../shared/avatar.component';

interface User {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

interface Post {
  id: string;
  content: string;
  media: { type: string; url?: string; text?: string }[];
  reactions: { userId: string; type: string }[];
  comments: {
    id: string;
    content: string;
    author: User;
    mediaUrl?: string;
    mediaType?: string;
    reactions: { userId: string; type: string }[];
    replies: { id: string; content: string; author: User; mediaUrl?: string; mediaType?: string }[];
  }[];
  author: User;
  createdAt: string;
}

interface StoryGroup {
  author: User;
  stories: { id: string; type: string; mediaUrl?: string; text?: string; backgroundColor?: string }[];
}

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [FormsModule, AvatarComponent, DatePipe, RouterLink],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.css',
})
export class FeedComponent implements OnInit {
  posts = signal<Post[]>([]);
  stories = signal<StoryGroup[]>([]);
  newPost = '';
  selectedFile: File | null = null;
  commentTexts: Record<string, string> = {};
  replyTexts: Record<string, string> = {};
  showReplyFor: Record<string, boolean> = {};
  showStoryModal = signal(false);
  storyType = signal<'text' | 'image' | 'video'>('text');
  storyText = '';
  storyFile: File | null = null;
  viewingStory: StoryGroup | null = null;
  storyIndex = 0;
  loading = signal(true);
  postError = signal('');
  showReactionsModal = signal(false);
  reactionsForPostId = signal<string | null>(null);
  reactionsDetail = signal<{ user: User; type: string }[]>([]);

  reactionTypes = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
  reactionLabels: Record<string, string> = {
    like: '👍',
    love: '❤️',
    haha: '😂',
    wow: '😮',
    sad: '😢',
    angry: '😠',
  };

  constructor(public api: ApiService) {}

  ngOnInit() {
    this.loadFeed();
    this.loadStories();
  }

  loadFeed() {
    this.api.get<Post[]>('/posts/feed').subscribe({
      next: (data) => { this.posts.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  loadStories() {
    this.api.get<StoryGroup[]>('/stories/feed').subscribe({
      next: (data) => this.stories.set(data),
    });
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] || null;
  }

  createPost() {
    if (!this.newPost.trim() && !this.selectedFile) {
      this.postError.set('La publication ne peut pas être vide.');
      return;
    }
    this.postError.set('');
    const media: { type: string; url?: string; text?: string }[] = [];
    const publish = (mediaItems: typeof media) => {
      this.api.post('/posts', { content: this.newPost.trim(), media: mediaItems }).subscribe({
        next: () => {
          this.newPost = '';
          this.selectedFile = null;
          this.loadFeed();
        },
        error: (err) => this.postError.set(err.error?.message || 'Publication refusée.'),
      });
    };

    if (this.selectedFile) {
      this.api.upload(this.selectedFile).subscribe({
        next: (res) => {
          const type = this.selectedFile!.type.startsWith('video') ? 'video' : 'image';
          media.push({ type, url: res.url });
          publish(media);
        },
      });
    } else {
      publish(media);
    }
  }

  react(postId: string, type: string) {
    this.api.post<Post>(`/posts/${postId}/reactions`, { type }).subscribe({
      next: (updated) => {
        this.posts.update((posts) => posts.map((p) => (p.id === postId ? updated : p)));
      },
    });
  }

  openReactions(postId: string) {
    this.reactionsForPostId.set(postId);
    this.api.get<{ user: User; type: string }[]>(`/posts/${postId}/reactions`).subscribe({
      next: (items) => {
        this.reactionsDetail.set(items || []);
        this.showReactionsModal.set(true);
      },
    });
  }

  comment(postId: string) {
    const content = this.commentTexts[postId];
    if (!content?.trim()) return;
    this.api.post<Post>(`/posts/${postId}/comments`, { content }).subscribe({
      next: (updated) => {
        this.commentTexts[postId] = '';
        this.posts.update((posts) => posts.map((p) => (p.id === postId ? updated : p)));
      },
    });
  }

  reactComment(postId: string, commentId: string, type: string) {
    this.api
      .post<Post>(`/posts/${postId}/comments/${commentId}/reactions`, { type })
      .subscribe({
        next: (updated) =>
          this.posts.update((posts) => posts.map((p) => (p.id === postId ? updated : p))),
      });
  }

  toggleReply(commentId: string) {
    this.showReplyFor[commentId] = !this.showReplyFor[commentId];
  }

  reply(postId: string, commentId: string) {
    const content = this.replyTexts[commentId];
    if (!content?.trim()) return;
    this.api
      .post<Post>(`/posts/${postId}/comments/${commentId}/replies`, { content })
      .subscribe({
        next: (updated) => {
          this.replyTexts[commentId] = '';
          this.posts.update((posts) => posts.map((p) => (p.id === postId ? updated : p)));
        },
      });
  }

  openStoryCreator() {
    this.showStoryModal.set(true);
  }

  onStoryFile(event: Event) {
    const input = event.target as HTMLInputElement;
    this.storyFile = input.files?.[0] || null;
  }

  publishStory() {
    const publish = (mediaUrl?: string) => {
      this.api
        .post('/stories', {
          type: this.storyType(),
          text: this.storyText,
          mediaUrl,
          backgroundColor: '#6366f1',
        })
        .subscribe({
          next: () => {
            this.showStoryModal.set(false);
            this.storyText = '';
            this.storyFile = null;
            this.loadStories();
          },
        });
    };

    if (this.storyFile && this.storyType() !== 'text') {
      this.api.upload(this.storyFile).subscribe({
        next: (res) => publish(res.url),
      });
    } else {
      publish();
    }
  }

  viewStories(group: StoryGroup) {
    this.viewingStory = group;
    this.storyIndex = 0;
  }

  closeStoryViewer() {
    this.viewingStory = null;
  }

  nextStory() {
    if (!this.viewingStory) return;
    if (this.storyIndex < this.viewingStory.stories.length - 1) {
      this.storyIndex++;
    } else {
      this.closeStoryViewer();
    }
  }

  getMyReaction(post: Post): string | null {
    const userId = localStorage.getItem('sm_user');
    if (!userId) return null;
    const parsed = JSON.parse(userId);
    const r = post.reactions.find((x) => x.userId === parsed.id);
    return r?.type || null;
  }
}
