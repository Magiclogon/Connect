import { Component, ElementRef, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { ChatService } from '../../core/services/chat.service';
import { AvatarComponent } from '../../shared/avatar.component';

interface User {
  id: string;
  displayName: string;
  avatarMediaId?: string | null;
}

interface Message {
  senderId: string;
  type: string;
  content: string;
  mediaId?: string | null;
  createdAt: string;
  sender: User;
}

interface Conversation {
  id: string;
  otherParticipant?: User;
  messages: Message[];
  unreadCount: number;
}

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [FormsModule, AvatarComponent, RouterLink],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.css',
})
export class MessagesComponent implements OnInit, OnDestroy {
  conversations = signal<Conversation[]>([]);
  activeConv = signal<Conversation | null>(null);
  messageText = '';
  selectedFile: File | null = null;
  private sub?: Subscription;
  private meId = JSON.parse(localStorage.getItem('sm_user') || '{}')?.id;
  @ViewChild('messagesContainer') messagesContainer?: ElementRef<HTMLDivElement>;

  constructor(
    public api: ApiService,
    private chat: ChatService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadConversations();
    this.sub = this.chat.onNewMessage().subscribe((data) => {
      const conv = this.activeConv();
      if (conv && data.conversationId === conv.id) {
        this.appendMessageToActive(data.message as Message);
      }
      this.loadConversations();
    });
    this.route.params.subscribe((params) => {
      if (params['conversationId']) {
        this.openConversation(params['conversationId']);
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  loadConversations() {
    this.api.get<Conversation[]>('/messages/conversations').subscribe({
      next: (data) => this.conversations.set(data),
    });
  }

  openConversation(id: string) {
    const existing = this.conversations().find((c) => c.id === id);
    if (existing) {
      this.activeConv.set(existing);
      this.chat.joinConversation(id);
      this.api.post(`/messages/conversations/${id}/read`, {}).subscribe();
      setTimeout(() => this.scrollToBottom(), 0);
      return;
    }
    this.api.get<Conversation>(`/messages/conversations/${id}`).subscribe({
      next: (conv) => {
        this.activeConv.set(conv);
        this.chat.joinConversation(id);
        setTimeout(() => this.scrollToBottom(), 0);
      },
    });
  }

  loadConversation(id: string) {
    const conv = this.conversations().find((c) => c.id === id);
    if (conv) {
      this.activeConv.set({ ...conv });
    }
  }

  selectConv(conv: Conversation) {
    this.router.navigate(['/messages', conv.id]);
    this.openConversation(conv.id);
  }

  async send() {
    const conv = this.activeConv();
    if (!conv) return;

    const sendMsg = async (type: string, content?: string, mediaId?: string) => {
      const payload = { conversationId: conv.id, type, content, mediaId };
      const sent = (await this.chat.sendMessage(payload)) as Message;
      this.appendMessageToActive(sent);
      this.messageText = '';
      this.selectedFile = null;
      this.loadConversations();
      this.scrollToBottom();
    };

    if (this.selectedFile) {
      this.api.upload(this.selectedFile).subscribe({
        next: (res) => {
          const type = this.selectedFile!.type.startsWith('video') ? 'video' : 'image';
          void sendMsg(type, this.messageText, res.mediaId);
        },
        error: (err) => alert(this.api.uploadErrorMessage(err)),
      });
    } else if (this.messageText.trim()) {
      void sendMsg('text', this.messageText);
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] || null;
  }

  isMine(msg: Message): boolean {
    return msg.senderId === this.meId;
  }

  private appendMessageToActive(message: Message) {
    const conv = this.activeConv();
    if (!conv) return;
    const exists = conv.messages.some(
      (m) =>
        m.senderId === message.senderId &&
        m.createdAt === message.createdAt &&
        m.content === message.content &&
        m.type === message.type,
    );
    if (exists) return;
    const updated = { ...conv, messages: [...conv.messages, message] };
    this.activeConv.set(updated);
    this.scrollToBottom();
  }

  private scrollToBottom() {
    const el = this.messagesContainer?.nativeElement;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }
}
