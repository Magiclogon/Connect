import { Component, Input } from '@angular/core';
import { ApiService } from '../core/services/api.service';

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    <div class="avatar" [class.avatar-lg]="size === 'lg'">
      @if (mediaId) {
        <img [src]="api.mediaUrl(mediaId)" [alt]="name" />
      } @else {
        {{ initial }}
      }
    </div>
  `,
})
export class AvatarComponent {
  @Input() name = '?';
  @Input() mediaId = '';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  constructor(public api: ApiService) {}

  get initial(): string {
    return (this.name || '?').charAt(0).toUpperCase();
  }
}
