import { Component, computed, inject, signal } from '@angular/core';
import { TransactionService } from '../../core/services/transaction.service';
import { BudgetService } from '../../core/services/budget.service';
import { CategorySummary, Summary, Transaction } from '../../core/models/transaction';
import { Budget } from '../../core/models/budget';
import { BudgetStatus } from '../../core/models/transaction-type';
import {
  dayLabel,
  endOfMonth,
  messageFor,
  money,
  monthLabel,
  startOfMonth,
  toIsoDate,
  toIsoMonth,
} from '../../core/utils/period';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {

  private readonly transactions = inject(TransactionService);
  private readonly budgets = inject(BudgetService);

  /** Sempre o dia 1 do mês em foco. */
  private readonly referenceMonth = signal(startOfMonth(new Date()));

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly summary = signal<Summary | null>(null);
  protected readonly expenseByCategory = signal<CategorySummary[]>([]);
  protected readonly monthBudgets = signal<Budget[]>([]);
  protected readonly recent = signal<Transaction[]>([]);

  protected readonly monthLabel = computed(() => monthLabel(this.referenceMonth()));

  /** Bloqueia avançar para meses no futuro. */
  protected readonly canGoForward = computed(
    () => this.referenceMonth() < startOfMonth(new Date())
  );

  /** Maior gasto do período — é a escala das barras. */
  private readonly topExpense = computed(() =>
    Math.max(0, ...this.expenseByCategory().map((item) => item.total))
  );

  protected readonly money = money;
  protected readonly dayLabel = dayLabel;

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    const month = this.referenceMonth();
    const startDate = toIsoDate(month);
    const endDate = toIsoDate(endOfMonth(month));

    try {
      const [summary, byCategory, budgets, page] = await Promise.all([
        this.transactions.getSummary(startDate, endDate),
        this.transactions.getSummaryByCategory('EXPENSE', startDate, endDate),
        this.budgets.getByMonth(toIsoMonth(month)),
        this.transactions.getByPeriod(startDate, endDate, 0, 8),
      ]);

      this.summary.set(summary);
      this.expenseByCategory.set([...byCategory].sort((a, b) => b.total - a.total));
      this.monthBudgets.set(budgets);
      this.recent.set(page.content);
    } catch (error) {
      this.errorMessage.set(messageFor(error, 'Não foi possível carregar os dados do mês.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected shiftMonth(offset: number): void {
    const current = this.referenceMonth();
    this.referenceMonth.set(new Date(current.getFullYear(), current.getMonth() + offset, 1));
    void this.load();
  }

  /** Largura da barra em %, proporcional ao maior gasto. */
  protected barWidth(total: number): string {
    const top = this.topExpense();
    return top > 0 ? `${(total / top) * 100}%` : '0%';
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
}
