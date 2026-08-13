import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TransactionService } from '../../core/services/transaction.service';
import { BudgetService } from '../../core/services/budget.service';
import { CategorySummary, Summary, Transaction } from '../../core/models/transaction';
import { Budget } from '../../core/models/budget';
import {
  endOfMonth,
  messageFor,
  money,
  monthLabel,
  startOfMonth,
  toIsoDate,
  toIsoMonth,
} from '../../core/utils/period';

const MONTH_ONLY = new Intl.DateTimeFormat('pt-BR', { month: 'long' });
const SHORT_DAY = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

const BAR_RAMP = ['var(--bar-1)', 'var(--bar-2)', 'var(--bar-3)', 'var(--bar-4)'];

const RECENT_PAGE_SIZE = 4;

const RECENT_PAGES = 3;

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {

  private readonly transactions = inject(TransactionService);
  private readonly budgets = inject(BudgetService);

  private readonly referenceMonth = signal(startOfMonth(new Date()));

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly summary = signal<Summary | null>(null);
  protected readonly previous = signal<Summary | null>(null);
  protected readonly expenseByCategory = signal<CategorySummary[]>([]);
  protected readonly monthBudgets = signal<Budget[]>([]);
  protected readonly recent = signal<Transaction[]>([]);

  protected readonly monthLabel = computed(() => monthLabel(this.referenceMonth()));

  protected readonly previousLabel = computed(() => {
    const current = this.referenceMonth();
    return MONTH_ONLY.format(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  });

  protected readonly canGoForward = computed(
    () => this.referenceMonth() < startOfMonth(new Date())
  );

  protected readonly delta = computed(() => {
    const now = this.summary()?.balance;
    const before = this.previous()?.balance;

    if (now === undefined || before === undefined || before === 0) {
      return null;
    }

    return ((now - before) / Math.abs(before)) * 100;
  });

  private readonly topExpense = computed(() =>
    Math.max(0, ...this.expenseByCategory().map((item) => item.total))
  );

  private readonly flowScale = computed(() =>
    Math.max(
      this.summary()?.totalIncome ?? 0,
      this.summary()?.totalExpense ?? 0,
      this.summary()?.totalInvested ?? 0
    )
  );

  protected readonly incomeWidth = computed(() =>
    this.share(this.summary()?.totalIncome ?? 0, this.flowScale())
  );

  protected readonly expenseWidth = computed(() =>
    this.share(this.summary()?.totalExpense ?? 0, this.flowScale())
  );

  protected readonly investedWidth = computed(() =>
    this.share(this.summary()?.totalInvested ?? 0, this.flowScale())
  );

  private readonly recentPage = signal(0);

  protected readonly recentPages = computed(() =>
    Math.max(1, Math.ceil(this.recent().length / RECENT_PAGE_SIZE))
  );

  protected readonly recentSlice = computed(() => {
    const start = this.recentPage() * RECENT_PAGE_SIZE;
    const page = this.recent().slice(start, start + RECENT_PAGE_SIZE);

    return Array.from(
      { length: RECENT_PAGE_SIZE },
      (_, index): Transaction | null => page[index] ?? null
    );
  });

  protected readonly recentLabel = computed(
    () => `${this.recentPage() + 1} de ${this.recentPages()}`
  );

  protected readonly onFirstRecent = computed(() => this.recentPage() === 0);
  protected readonly onLastRecent = computed(
    () => this.recentPage() >= this.recentPages() - 1
  );

  protected readonly money = money;

  constructor() {
    void this.load();
  }

  protected shiftRecent(offset: number): void {
    this.recentPage.update((current) =>
      Math.min(this.recentPages() - 1, Math.max(0, current + offset))
    );
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    const month = this.referenceMonth();
    const startDate = toIsoDate(month);
    const endDate = toIsoDate(endOfMonth(month));

    const before = new Date(month.getFullYear(), month.getMonth() - 1, 1);

    try {
      const [summary, byCategory, budgets, page, previous] = await Promise.all([
        this.transactions.getSummary(startDate, endDate),
        this.transactions.getSummaryByCategory('EXPENSE', startDate, endDate),
        this.budgets.getByMonth(toIsoMonth(month)),
        this.transactions.getByPeriod(
          startDate,
          endDate,
          0,
          RECENT_PAGE_SIZE * RECENT_PAGES
        ),
        this.transactions
          .getSummary(toIsoDate(before), toIsoDate(endOfMonth(before)))
          .catch(() => null),
      ]);

      this.summary.set(summary);
      this.expenseByCategory.set([...byCategory].sort((a, b) => b.total - a.total));
      this.monthBudgets.set(budgets);
      this.recent.set(page.content);
      this.recentPage.set(0);
      this.previous.set(previous);
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

  protected barWidth(total: number): string {
    return this.share(total, this.topExpense());
  }

  protected barColor(index: number): string {
    return BAR_RAMP[Math.min(index, BAR_RAMP.length - 1)];
  }

  protected meterWidth(percentage: number): string {
    return `${Math.min(100, Math.max(0, percentage))}%`;
  }

  protected shortDay(isoDate: string): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    return SHORT_DAY.format(new Date(year, month - 1, day));
  }

  protected deltaLabel(value: number): string {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1).replace('.', ',')}%`;
  }

  private share(value: number, scale: number): string {
    return scale > 0 ? `${(value / scale) * 100}%` : '0%';
  }
}
