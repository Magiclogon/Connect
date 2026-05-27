import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';

interface Group {
  id: string;
  name: string;
  description: string;
  memberCount: number;
}

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './groups.component.html',
  styleUrl: './groups.component.css',
})
export class GroupsComponent implements OnInit {
  myGroups = signal<Group[]>([]);
  discover = signal<Group[]>([]);
  showCreate = signal(false);
  newName = '';
  newDesc = '';

  constructor(
    private api: ApiService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.api.get<Group[]>('/groups/mine').subscribe((d) => this.myGroups.set(d));
    this.api.get<Group[]>('/groups/discover').subscribe((d) => this.discover.set(d));
  }

  create() {
    this.api.post<Group>('/groups', { name: this.newName, description: this.newDesc }).subscribe({
      next: (g) => {
        this.showCreate.set(false);
        this.newName = '';
        this.newDesc = '';
        this.load();
        this.router.navigate(['/groups', g.id]);
      },
    });
  }

  join(id: string) {
    this.api.post(`/groups/${id}/join`, {}).subscribe({ next: () => this.load() });
  }
}
