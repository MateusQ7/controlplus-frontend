import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MarketService } from '../../core/services/market.service';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle';
import { MarketSnapshot } from '../../core/models/market';

const ROTATION_MS = 45_000;

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, ThemeToggle],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly market = inject(MarketService);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly market$ = signal<MarketSnapshot | null>(null);

  private readonly destroyRef = inject(DestroyRef);
  private group = 0;

  constructor() {
    void this.showGroup();
    this.startRotation();
  }

  private startRotation(): void {
    const timer = setInterval(() => {
      if (document.hidden) {
        return;
      }

      this.group += 1;
      void this.showGroup();
    }, ROTATION_MS);

    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  private async showGroup(): Promise<void> {
    try {
      const snapshot = await this.market.getGroup(this.group);

      if (snapshot) {
        this.market$.set(snapshot);
      }
    } catch {
    }
  }

  protected changeLabel(change: number): string {
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(2).replace('.', ',')}%`;
  }

  protected async submit(): Promise<void> {
    if (this.loading()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Preencha o e-mail e a senha.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { email, password } = this.form.getRawValue();

    try {
      await this.auth.login(email, password);
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected showEmailError(): boolean {
    const control = this.form.controls.email;
    return control.invalid && control.touched;
  }

  protected showPasswordError(): boolean {
    const control = this.form.controls.password;
    return control.invalid && control.touched;
  }

  private messageFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        return 'E-mail ou senha incorretos.';
      }

      if (error.status === 0) {
        return 'Não foi possível falar com o servidor. Ele está rodando?';
      }

      const backendMessage = error.error?.message;
      if (typeof backendMessage === 'string' && backendMessage.length > 0) {
        return backendMessage;
      }
    }

    return 'Algo deu errado ao entrar. Tente de novo.';
  }
}
