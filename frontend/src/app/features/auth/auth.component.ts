import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.css',
})
export class AuthComponent {
  isLogin = signal(true);
  email = '';
  password = '';
  displayName = '';
  error = signal('');
  loading = signal(false);

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  toggleMode() {
    this.isLogin.update((v) => !v);
    this.error.set('');
  }

  submit() {
    this.loading.set(true);
    this.error.set('');
    const obs = this.isLogin()
      ? this.auth.login(this.email, this.password)
      : this.auth.register(this.email, this.password, this.displayName);

    obs.subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/feed']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Une erreur est survenue');
      },
    });
  }
}
