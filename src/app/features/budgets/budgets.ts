import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BudgetService } from '../../core/services/budget.service';
import { CategoryService } from '../../core/services/category.service';
import { Budget } from '../../core/models/budget';
import { Category } from '../../core/models/category';
import { BudgetStatus } from '../../core/models/transaction-type';
import {
  messageFor,
  money,
  monthLabel,
  startOfMonth,
  toIsoMonth,
} from '../../core/utils/period';
import { Modal } from '../../shared/components/modal/modal';

@Component({
  selector: 'app-budgets',
  imports: [ReactiveFormsModule, Modal],
  templateUrl: './budgets.html',
  styleUrl: './budgets.css',
})
export class Budgets {

  private readonly budgets = inject(BudgetService);
  private readonly categories = inject(CategoryService);
  private readonly fb = inject(FormBuilder);

  private readonly referenceMonth = signal(startOfMonth(new Date()));

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly items = signal<Budget[]>([]);
  protected readonly expenseCategories = signal<Category[]>([]);

  protected readonly editing = signal<Budget | 'new' | null>(null);
  protected readonly removing = signal<Budget | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    categoryId: [null as number | null, [Validators.required]],
    limitAmount: [null as number | null, [Validators.required, Validators.min(0.01)]],
  });

  protected readonly monthLabel = computed(() => monthLabel(this.referenceMonth()));

  protected readonly totalLimit = computed(() =>
    this.items().reduce((sum, budget) => sum + budget.limitAmount, 0)
  );

  protected readonly totalSpent = computed(() =>
    this.items().reduce((sum, budget) => sum + budget.spentAmount, 0)
  );

  /** Uma categoria só pode ter um orçamento por mês — as já usadas saem da lista. */
  protected readonly availableCategories = computed(() => {
    const taken = new Set(this.items().map((budget) => budget.category.id));
    return this.expenseCategories().filter((category) => !taken.has(category.id));
  });

  protected readonly isNew = computed(() => this.editing() === 'new');

  protected readonly editingBudget = computed(() => {
    const target = this.editing();
    return target && target !== 'new' ? target : null;
  });

  protected readonly money = money;

  constructor() {
    void this.load();
    void this.loadCategories();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const result = await this.budgets.getByMonth(toIsoMonth(this.referenceMonth()));
      // Estourados primeiro — é o que exige ação.
      this.items.set([...result].sort((a, b) => b.usagePercentage - a.usagePercentage));
    } catch (error) {
      this.errorMessage.set(messageFor(error, 'Não foi possível carregar os orçamentos.'));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadCategories(): Promise<void> {
    try {
      const result = await this.categories.getAll();
      this.expenseCategories.set(
        result
          .filter((category) => category.type === 'EXPENSE')
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      );
    } catch {
      // O formulário avisa sozinho quando não há categoria disponível.
    }
  }

  protected shiftMonth(offset: number): void {
    const current = this.referenceMonth();
    this.referenceMonth.set(new Date(current.getFullYear(), current.getMonth() + offset, 1));
    void this.load();
  }

  protected openNew(): void {
    this.form.reset({ categoryId: null, limitAmount: null });
    this.form.controls.categoryId.enable();
    this.formError.set(null);
    this.editing.set('new');
  }

  protected openEdit(budget: Budget): void {
    this.form.reset({ categoryId: budget.category.id, limitAmount: budget.limitAmount });
    // O backend só aceita novo limite; categoria e mês são imutáveis.
    this.form.controls.categoryId.disable();
    this.formError.set(null);
    this.editing.set(budget);
  }

  protected closeForm(): void {
    this.form.controls.categoryId.enable();
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

    const raw = this.form.getRawValue();
    const target = this.editing();

    try {
      if (target === 'new') {
        await this.budgets.create({
          categoryId: Number(raw.categoryId),
          limitAmount: raw.limitAmount!,
          referenceMonth: toIsoMonth(this.referenceMonth()),
        });
      } else if (target) {
        await this.budgets.updateLimit(target.id, raw.limitAmount!);
      }

      this.closeForm();
      await this.load();
    } catch (error) {
      this.formError.set(messageFor(error, 'Não foi possível salvar o orçamento.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected askRemove(budget: Budget): void {
    this.formError.set(null);
    this.removing.set(budget);
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
      await this.budgets.delete(target.id);
      this.removing.set(null);
      await this.load();
    } catch (error) {
      this.formError.set(messageFor(error, 'Não foi possível excluir o orçamento.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected meterWidth(percentage: number): string {
    return `${Math.min(100, Math.max(0, percentage))}%`;
  }

  protected statusLabel(status: BudgetStatus): string {
    switch (status) {
      case 'OK':
        return 'No limite';
      case 'WARNING':
        return 'Atenção';
      case 'EXCEED':
        return 'Estourado';
    }
  }

  protected invalid(field: 'categoryId' | 'limitAmount'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }
}
