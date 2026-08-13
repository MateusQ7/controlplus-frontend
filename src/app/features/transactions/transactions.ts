import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { TransactionService } from '../../core/services/transaction.service';
import { CategoryService } from '../../core/services/category.service';
import { Transaction } from '../../core/models/transaction';
import { Category } from '../../core/models/category';
import { TransactionType } from '../../core/models/transaction-type';
import {
  dayLabel,
  endOfMonth,
  messageFor,
  money,
  monthLabel,
  startOfMonth,
  toIsoDate,
} from '../../core/utils/period';
import { Modal } from '../../shared/components/modal/modal';
import { CurrencyMask } from '../../shared/directives/currency-mask';

const PAGE_SIZE = 25;

const TYPE_LABEL: Record<TransactionType, string> = {
  INCOME: 'Receita',
  EXPENSE: 'Despesa',
  INVESTMENT: 'Investimento',
};

const TYPE_TONE: Record<TransactionType, string> = {
  INCOME: 'income',
  EXPENSE: 'expense',
  INVESTMENT: 'invest',
};

@Component({
  selector: 'app-transactions',
  imports: [ReactiveFormsModule, Modal, CurrencyMask],
  templateUrl: './transactions.html',
  styleUrl: './transactions.css',
})
export class Transactions {

  private readonly transactions = inject(TransactionService);
  private readonly categories = inject(CategoryService);
  private readonly fb = inject(FormBuilder);

  private readonly referenceMonth = signal(startOfMonth(new Date()));
  private readonly page = signal(0);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly items = signal<Transaction[]>([]);
  protected readonly totalElements = signal(0);
  protected readonly totalPages = signal(0);
  protected readonly isLast = signal(true);
  protected readonly allCategories = signal<Category[]>([]);

  protected readonly editing = signal<Transaction | 'new' | null>(null);
  protected readonly removing = signal<Transaction | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    description: ['', [Validators.required, Validators.maxLength(120)]],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    date: ['', [Validators.required]],
    type: ['EXPENSE' as TransactionType, [Validators.required]],
    categoryId: [null as number | null, [Validators.required]],
  });

  private readonly selectedType = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });

  protected readonly availableCategories = computed(() =>
    this.allCategories().filter((category) => category.type === this.selectedType())
  );

  protected readonly monthLabel = computed(() => monthLabel(this.referenceMonth()));
  protected readonly canGoForward = computed(
    () => this.referenceMonth() < startOfMonth(new Date())
  );

  protected readonly pageLabel = computed(() =>
    this.totalPages() === 0 ? '—' : `${this.page() + 1} de ${this.totalPages()}`
  );

  protected readonly modalTitle = computed(() =>
    this.editing() === 'new' ? 'Novo lançamento' : 'Editar lançamento'
  );

  protected readonly money = money;
  protected readonly dayLabel = dayLabel;

  protected typeLabel(type: TransactionType): string {
    return TYPE_LABEL[type];
  }

  protected typeTone(type: TransactionType): string {
    return TYPE_TONE[type];
  }

  protected typeSign(type: TransactionType): string {
    return type === 'INCOME' ? '+' : '−';
  }

  constructor() {
    void this.load();
    void this.loadCategories();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    const month = this.referenceMonth();

    try {
      const result = await this.transactions.getByPeriod(
        toIsoDate(month),
        toIsoDate(endOfMonth(month)),
        this.page(),
        PAGE_SIZE
      );

      this.items.set(result.content);
      this.totalElements.set(result.totalElements);
      this.totalPages.set(result.totalPages);
      this.isLast.set(result.last);
    } catch (error) {
      this.errorMessage.set(messageFor(error, 'Não foi possível carregar os lançamentos.'));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadCategories(): Promise<void> {
    try {
      const result = await this.categories.getAll();
      this.allCategories.set([...result].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
    } catch {
      return
    }
  }

  protected shiftMonth(offset: number): void {
    const current = this.referenceMonth();
    this.referenceMonth.set(new Date(current.getFullYear(), current.getMonth() + offset, 1));
    this.page.set(0);
    void this.load();
  }

  protected shiftPage(offset: number): void {
    this.page.update((current) => Math.max(0, current + offset));
    void this.load();
  }

  protected get firstPage(): boolean {
    return this.page() === 0;
  }

  protected openNew(): void {
    const month = this.referenceMonth();
    const today = new Date();
    const sameMonth = startOfMonth(today).getTime() === month.getTime();

    this.form.reset({
      description: '',
      amount: null,
      date: toIsoDate(sameMonth ? today : month),
      type: 'EXPENSE',
      categoryId: null,
    });
    this.formError.set(null);
    this.editing.set('new');
  }

  protected openEdit(transaction: Transaction): void {
    this.form.reset({
      description: transaction.description,
      amount: transaction.amount,
      date: transaction.date,
      type: transaction.type,
      categoryId: transaction.category.id,
    });
    this.formError.set(null);
    this.editing.set(transaction);
  }

  protected closeForm(): void {
    this.editing.set(null);
  }

  protected onTypeChange(): void {
    this.form.controls.categoryId.setValue(null);
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
    const payload = {
      description: raw.description,
      amount: raw.amount!,
      date: raw.date,
      type: raw.type,
      categoryId: Number(raw.categoryId),
    };

    const target = this.editing();

    try {
      if (target === 'new') {
        await this.transactions.create(payload);
      } else if (target) {
        await this.transactions.update(target.id, payload);
      }

      this.editing.set(null);
      await this.load();
    } catch (error) {
      this.formError.set(messageFor(error, 'Não foi possível salvar o lançamento.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected askRemove(transaction: Transaction): void {
    this.formError.set(null);
    this.removing.set(transaction);
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
      await this.transactions.delete(target.id);
      this.removing.set(null);

      if (this.items().length === 1 && this.page() > 0) {
        this.page.update((current) => current - 1);
      }

      await this.load();
    } catch (error) {
      this.formError.set(messageFor(error, 'Não foi possível excluir o lançamento.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected invalid(field: 'description' | 'amount' | 'date' | 'categoryId'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }
}
