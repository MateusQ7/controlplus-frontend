import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoryService } from '../../core/services/category.service';
import { Category } from '../../core/models/category';
import { TransactionType } from '../../core/models/transaction-type';
import { messageFor } from '../../core/utils/period';
import { Modal } from '../../shared/components/modal/modal';

@Component({
  selector: 'app-categories',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './categories.html',
  styleUrl: './categories.css',
})
export class Categories {

  private readonly categories = inject(CategoryService);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly items = signal<Category[]>([]);

  /** null = fechado; Category = editando; 'new' = criando. */
  protected readonly editing = signal<Category | 'new' | null>(null);
  protected readonly removing = signal<Category | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    type: ['EXPENSE' as TransactionType, [Validators.required]],
  });

  protected readonly income = computed(() =>
    this.items().filter((item) => item.type === 'INCOME')
  );

  protected readonly expense = computed(() =>
    this.items().filter((item) => item.type === 'EXPENSE')
  );

  protected readonly investment = computed(() =>
    this.items().filter((item) => item.type === 'INVESTMENT')
  );

  protected readonly modalTitle = computed(() =>
    this.editing() === 'new' ? 'Nova categoria' : 'Editar categoria'
  );

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const result = await this.categories.getAll();
      this.items.set([...result].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    } catch (error) {
      this.errorMessage.set(messageFor(error, 'Não foi possível carregar as categorias.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected openNew(type: TransactionType): void {
    this.form.reset({ name: '', type });
    this.formError.set(null);
    this.editing.set('new');
  }

  protected openEdit(category: Category): void {
    this.form.reset({ name: category.name, type: category.type });
    this.formError.set(null);
    this.editing.set(category);
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
    const payload = this.form.getRawValue();

    try {
      if (target === 'new') {
        await this.categories.create(payload);
      } else if (target) {
        await this.categories.update(target.id, payload);
      }

      this.editing.set(null);
      await this.load();
    } catch (error) {
      this.formError.set(messageFor(error, 'Não foi possível salvar a categoria.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected askRemove(category: Category): void {
    this.formError.set(null);
    this.removing.set(category);
  }

  protected cancelRemove(): void {
    this.removing.set(null);
  }

  protected async confirmRemove(): Promise<void> {
    const target = this.removing();
    if (!target || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    try {
      await this.categories.delete(target.id);
      this.removing.set(null);
      await this.load();
    } catch (error) {
      this.formError.set(
        messageFor(error, 'Não foi possível excluir. A categoria pode estar em uso.')
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected showNameError(): boolean {
    const control = this.form.controls.name;
    return control.invalid && control.touched;
  }
}
