import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/auth.component').then((m) => m.AuthComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      { path: '', redirectTo: 'feed', pathMatch: 'full' },
      {
        path: 'feed',
        loadComponent: () => import('./features/feed/feed.component').then((m) => m.FeedComponent),
      },
      {
        path: 'friends',
        loadComponent: () => import('./features/friends/friends.component').then((m) => m.FriendsComponent),
      },
      {
        path: 'messages',
        loadComponent: () => import('./features/messages/messages.component').then((m) => m.MessagesComponent),
      },
      {
        path: 'messages/:conversationId',
        loadComponent: () => import('./features/messages/messages.component').then((m) => m.MessagesComponent),
      },
      {
        path: 'groups',
        loadComponent: () => import('./features/groups/groups.component').then((m) => m.GroupsComponent),
      },
      {
        path: 'groups/:id',
        loadComponent: () => import('./features/groups/group-detail.component').then((m) => m.GroupDetailComponent),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
      {
        path: 'profile/:id',
        loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
