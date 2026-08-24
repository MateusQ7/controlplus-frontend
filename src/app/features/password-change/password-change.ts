import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { ThemeToggle } from '../../shared/components/theme-toggle/theme-toggle';

/** A confirmação vive no grupo porque depende de dois campos, não de um. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const next = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;

  return next && confirm && next !== confirm ? { mismatch: true } : null;
}

/** Repetir a senha temporária é recusado pelo backend — avisa antes de ir. */
function passwordIsNew(group: AbstractControl): ValidationErrors | null {
  const current = group.get('currentPassword')?.value;
  const next = group.get('newPassword')?.value;

  return current && next && current === next ? { reused: true } : null;
}

@Component({
  selector: 'app-password-change',
  imports: [ReactiveFormsModule, ThemeToggle],
  templateUrl: './password-change.html',
  styleUrl: './password-change.css',
})
export class PasswordChange {

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: [
        '',
        [Validators.required, Validators.minLength(8), Validators.maxLength(72)],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordsMatch, passwordIsNew] }
  );

  protected async submit(): Promise<void> {
    if (this.loading()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { currentPassword, newPassword } = this.form.getRawValue();

    try {
      await this.auth.changePassword(currentPassword, newPassword);
      await this.router.navigate(['/dashboard']);
    } catch (error) {
      this.errorMessage.set(this.messageFor(error));
    } finally {
      this.loading.set(false);
    }
  }

  /** Sair é a única saída além de trocar a senha, então precisa estar à mão. */
  protected async logout(): Promise<void> {
    try {
      await this.auth.logout();
    } finally {
      await this.router.navigate(['/login']);
    }
  }

  protected invalid(field: 'currentPassword' | 'newPassword' | 'confirmPassword'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  protected showMismatch(): boolean {
    return this.form.hasError('mismatch') && this.form.controls.confirmPassword.touched;
  }

  protected showReused(): boolean {
    return this.form.hasError('reused') && this.form.controls.newPassword.touched;
  }

  /**
   * As duas recusas previsíveis do backend chegam em inglês; traduzir aqui evita
   * que a tela mais sensível do fluxo fale outra língua.
   */
  private messageFor(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Não foi possível falar com o servidor. Ele está rodando?';
      }

      const backendMessage: string = error.error?.message ?? '';

      if (backendMessage.includes('Current password')) {
        return 'A senha atual não confere.';
      }

      if (backendMessage.includes('must be different')) {
        return 'A nova senha precisa ser diferente da atual.';
      }

      if (backendMessage.length > 0) {
        return backendMessage;
      }
    }

    return 'Não foi possível trocar a senha. Tente de novo.';
  }
}
