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

/**
 * Rampa das barras: mais forte no maior gasto, esmaecendo daí. Os valores são
 * tokens do tema, não hex — no escuro a rampa inverte (clara para escura).
 */
const BAR_RAMP = ['var(--bar-1)', 'var(--bar-2)', 'var(--bar-3)', 'var(--bar-4)'];

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
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
  protected readonly previous = signal<Summary | null>(null);
  protected readonly expenseByCategory = signal<CategorySummary[]>([]);
  protected readonly monthBudgets = signal<Budget[]>([]);
  protected readonly recent = signal<Transaction[]>([]);

  protected readonly monthLabel = computed(() => monthLabel(this.referenceMonth()));

  protected readonly previousLabel = computed(() => {
    const current = this.referenceMonth();
    return MONTH_ONLY.format(new Date(current.getFullYear(), current.getMonth() - 1, 1));
  });

  /** Bloqueia avançar para meses no futuro. */
  protected readonly canGoForward = computed(
    () => this.referenceMonth() < startOfMonth(new Date())
  );

  /**
   * Variação do saldo contra o mês anterior. null quando não dá para calcular:
   * sem mês anterior carregado, ou saldo anterior zero (divisão sem sentido).
   */
  protected readonly delta = computed(() => {
    const now = this.summary()?.balance;
    const before = this.previous()?.balance;

    if (now === undefined || before === undefined || before === 0) {
      return null;
    }

    return ((now - before) / Math.abs(before)) * 100;
  });

  /** Maior gasto do período — é a escala das barras. */
  private readonly topExpense = computed(() =>
    Math.max(0, ...this.expenseByCategory().map((item) => item.total))
  );

  /** Receita e despesa dividem a mesma escala, senão as barras não se comparam. */
  private readonly flowScale = computed(() =>
    Math.max(this.summary()?.totalIncome ?? 0, this.summary()?.totalExpense ?? 0)
  );

  protected readonly incomeWidth = computed(() =>
    this.share(this.summary()?.totalIncome ?? 0, this.flowScale())
  );

  protected readonly expenseWidth = computed(() =>
    this.share(this.summary()?.totalExpense ?? 0, this.flowScale())
  );

  protected readonly money = money;

  constructor() {
    void this.load();
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
        this.transactions.getByPeriod(startDate, endDate, 0, 5),
        // O mês anterior só alimenta a variação: se falhar, o resto continua.
        this.transactions
          .getSummary(toIsoDate(before), toIsoDate(endOfMonth(before)))
          .catch(() => null),
      ]);

      this.summary.set(summary);
      this.expenseByCategory.set([...byCategory].sort((a, b) => b.total - a.total));
      this.monthBudgets.set(budgets);
      this.recent.set(page.content);
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

  /** Largura da barra em %, proporcional ao maior gasto. */
  protected barWidth(total: number): string {
    return this.share(total, this.topExpense());
  }

  /** Cor da barra pela posição no ranking; do 4º em diante repete o último passo. */
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
