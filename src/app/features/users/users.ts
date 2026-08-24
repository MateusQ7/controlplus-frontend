import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { Role, User } from '../../core/models/user';
import { messageFor } from '../../core/utils/period';
import { Modal } from '../../shared/components/modal/modal';

const CREATED_AT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

@Component({
  selector: 'app-users',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class Users {

  private readonly users = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly items = signal<User[]>([]);

  protected readonly search = signal('');

  protected readonly editing = signal<User | 'new' | null>(null);
  /** Alvo do modal de confirmação, junto do sentido da troca. */
  protected readonly toggling = signal<User | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.minLength(8), Validators.maxLength(72)]],
    role: ['USER' as Role, [Validators.required]],
  });

  protected readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.items();

    if (term.length === 0) {
      return list;
    }

    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.email.toLowerCase().includes(term)
    );
  });

  protected readonly activeCount = computed(
    () => this.items().filter((item) => item.active).length
  );

  protected readonly inactiveCount = computed(
    () => this.items().length - this.activeCount()
  );

  protected readonly modalTitle = computed(() =>
    this.editing() === 'new' ? 'Novo usuário' : 'Editar usuário'
  );

  /** Editar a si mesmo trava o papel: o backend recusa um admin se rebaixando. */
  protected readonly editingSelf = computed(() => {
    const target = this.editing();
    return target !== null && target !== 'new' && this.isSelf(target);
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      this.items.set(await this.users.getAll());
    } catch (error) {
      this.errorMessage.set(messageFor(error, 'Não foi possível carregar os usuários.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected isSelf(user: User): boolean {
    return this.auth.user()?.id === user.id;
  }

  protected createdLabel(isoDateTime: string): string {
    const date = new Date(isoDateTime);
    return Number.isNaN(date.getTime()) ? '—' : CREATED_AT.format(date);
  }

  protected roleLabel(role: Role): string {
    return role === 'ADMIN' ? 'Admin' : 'Usuário';
  }

  protected openNew(): void {
    this.form.reset({ name: '', email: '', password: '', role: 'USER' });
    // Na criação a senha é obrigatória; na edição, em branco mantém a atual.
    this.form.controls.password.addValidators(Validators.required);
    this.form.controls.password.updateValueAndValidity();
    this.form.controls.role.enable();
    this.formError.set(null);
    this.editing.set('new');
  }

  protected openEdit(user: User): void {
    this.form.reset({ name: user.name, email: user.email, password: '', role: user.role });
    this.form.controls.password.removeValidators(Validators.required);
    this.form.controls.password.updateValueAndValidity();

    if (this.isSelf(user)) {
      this.form.controls.role.disable();
    } else {
      this.form.controls.role.enable();
    }

    this.formError.set(null);
    this.editing.set(user);
  }

  protected closeForm(): void {
    this.editing.set(null);
  }

  protected async save(): Promise<void> {
    if (this.saving()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const target = this.editing();
    // getRawValue traz o papel mesmo desabilitado — é ele que o backend exige.
    const { name, email, password, role } = this.form.getRawValue();

    try {
      if (target === 'new') {
        await this.users.create({ name: name.trim(), email: email.trim(), password, role });
      } else if (target) {
        await this.users.update(target.id, {
          name: name.trim(),
          email: email.trim(),
          password: password.length > 0 ? password : null,
          role,
        });
      }

      this.editing.set(null);
      await this.load();
      await this.refreshOwnSession(target);
    } catch (error) {
      this.formError.set(messageFor(error, 'Não foi possível salvar o usuário.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected askToggle(user: User): void {
    this.formError.set(null);
    this.toggling.set(user);
  }

  protected cancelToggle(): void {
    this.toggling.set(null);
  }

  protected async confirmToggle(): Promise<void> {
    const target = this.toggling();
    if (!target || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    try {
      if (target.active) {
        await this.users.inactivate(target.id);
      } else {
        await this.users.activate(target.id);
      }

      this.toggling.set(null);
      await this.load();
    } catch (error) {
      this.formError.set(
        messageFor(error, 'Não foi possível alterar a situação do usuário.')
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected invalid(field: 'name' | 'email' | 'password'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  /** Editar a própria conta muda o nome exibido na casca — recarrega a sessão. */
  private async refreshOwnSession(target: User | 'new' | null): Promise<void> {
    if (target && target !== 'new' && this.isSelf(target)) {
      await this.auth.checkSession();
    }
  }
}
