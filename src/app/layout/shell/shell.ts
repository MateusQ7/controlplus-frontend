import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface NavItem {
  path: string;
  label: string;
  /** Endpoint do backend que alimenta a tela — serve de documentação viva. */
  source: string;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly menuOpen = signal(false);

  protected readonly nav: NavItem[] = [
    { path: '/dashboard', label: 'Visão geral', source: '/transactions/summary' },
    { path: '/lancamentos', label: 'Lançamentos', source: '/transactions/period' },
    { path: '/orcamentos', label: 'Orçamentos', source: '/budgets' },
    { path: '/categorias', label: 'Categorias', source: '/categories' },
  ];

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected async logout(): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      await this.router.navigate(['/login']);
    }
  }
}
