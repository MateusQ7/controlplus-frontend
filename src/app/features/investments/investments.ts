import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InvestmentService } from '../../core/services/investment.service';
import {
  IndexType,
  Investment,
  InvestmentMovement,
  InvestmentProjection,
  MovementType,
  PortfolioProjection,
  ProjectionMonth,
} from '../../core/models/investment';
import { messageFor, money, toIsoDate } from '../../core/utils/period';
import { Modal } from '../../shared/components/modal/modal';
import { CurrencyMask } from '../../shared/directives/currency-mask';

const SHORT_MONTH = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' });
const LONG_MONTH = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const DAY = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const HORIZONS = [6, 12, 24, 36] as const;

const INDEX_TYPES: readonly { value: IndexType; label: string }[] = [
  { value: 'CDI', label: 'CDI' },
  { value: 'SELIC', label: 'Selic' },
  { value: 'IPCA', label: 'IPCA' },
  { value: 'FIXED', label: 'Prefixado' },
];

const MOVEMENT_TYPES: readonly { value: MovementType; label: string }[] = [
  { value: 'CONTRIBUTION', label: 'Aporte' },
  { value: 'WITHDRAWAL', label: 'Resgate' },
];

const CHART_WIDTH = 100;
const CHART_HEIGHT = 40;
const CHART_TOP = 2;
const CHART_BOTTOM = 38;

interface InvestmentRow {
  investment: Investment;
  projection: InvestmentProjection | null;
}

interface IndexSource {
  label: string;
  annual: string;
  reference: string;
  stale: boolean;
}

interface Chart {
  gross: string;
  net: string;
  area: string;
  max: number;
  min: number;
  firstLabel: string;
  lastLabel: string;
}

@Component({
  selector: 'app-investments',
  imports: [ReactiveFormsModule, Modal, CurrencyMask],
  templateUrl: './investments.html',
  styleUrl: './investments.css',
})
export class Investments {

  private readonly investments = inject(InvestmentService);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly projectionError = signal<string | null>(null);

  protected readonly items = signal<Investment[]>([]);
  protected readonly projection = signal<PortfolioProjection | null>(null);
  protected readonly horizon = signal<number>(12);

  protected readonly editing = signal<Investment | 'new' | null>(null);
  protected readonly removing = signal<Investment | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly selectedIndex = signal<IndexType>('CDI');

  protected readonly managing = signal<Investment | null>(null);
  protected readonly movements = signal<InvestmentMovement[]>([]);
  protected readonly movementsLoading = signal(false);
  protected readonly editingMovement = signal<InvestmentMovement | 'new' | null>(null);
  protected readonly removingMovement = signal<InvestmentMovement | null>(null);
  protected readonly movementError = signal<string | null>(null);
  private movementsChanged = false;

  protected readonly horizons = HORIZONS;
  protected readonly indexTypes = INDEX_TYPES;
  protected readonly movementTypes = MOVEMENT_TYPES;
  protected readonly money = money;
  protected readonly abs = Math.abs;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    principal: [null as number | null, [Validators.required, Validators.min(0.01)]],
    investedAt: [toIsoDate(new Date()), [Validators.required]],
    maturity: [null as string | null],
    indexType: ['CDI' as IndexType, [Validators.required]],
    indexPercent: [null as number | null],
    spread: [null as number | null],
    taxable: [true],
  });

  protected readonly movementForm = this.fb.nonNullable.group({
    type: ['CONTRIBUTION' as MovementType, [Validators.required]],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    occurredAt: [toIsoDate(new Date()), [Validators.required]],
    note: [''],
  });

  protected readonly isNew = computed(() => this.editing() === 'new');

  protected readonly isNewMovement = computed(() => this.editingMovement() === 'new');

  protected readonly rows = computed<InvestmentRow[]>(() => {
    const byId = new Map(
      (this.projection()?.investments ?? []).map((item) => [item.investmentId, item])
    );

    return this.items().map((investment) => ({
      investment,
      projection: byId.get(investment.id) ?? null,
    }));
  });

  protected readonly totals = computed<ProjectionMonth[]>(
    () => this.projection()?.totals ?? []
  );

  protected readonly finalMonth = computed<ProjectionMonth | null>(() => {
    const totals = this.totals();
    return totals.length > 0 ? totals[totals.length - 1] : null;
  });

  protected readonly projectedGain = computed(() => {
    const current = this.projection()?.currentNetBalance;
    const final = this.finalMonth()?.netBalance;

    return current === undefined || final === undefined ? null : final - current;
  });

  protected readonly indexSources = computed<IndexSource[]>(() => {
    const found = new Map<IndexType, IndexSource>();

    for (const item of this.projection()?.investments ?? []) {
      if (item.indexAnnualPercent === null || item.indexReferenceDate === null) {
        continue;
      }

      if (!found.has(item.indexType)) {
        found.set(item.indexType, {
          label: INDEX_TYPES.find((type) => type.value === item.indexType)?.label
            ?? item.indexType,
          annual: this.percent(item.indexAnnualPercent),
          reference: this.dayLabel(item.indexReferenceDate),
          stale: item.indexStale,
        });
      }
    }

    return [...found.values()];
  });

  protected readonly hasStaleIndex = computed(() =>
    this.indexSources().some((source) => source.stale)
  );

  protected readonly chart = computed<Chart | null>(() => {
    const totals = this.totals();

    if (totals.length < 2) {
      return null;
    }

    const gross = totals.map((month) => month.grossBalance);
    const net = totals.map((month) => month.netBalance);

    const min = Math.min(...net, this.projection()?.totalNetInvested ?? 0);
    const max = Math.max(...gross);

    const netPath = this.pathOf(net, min, max);

    return {
      gross: this.pathOf(gross, min, max),
      net: netPath,
      area: `${netPath} L${CHART_WIDTH},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z`,
      min,
      max,
      firstLabel: this.shortMonth(totals[0].referenceMonth),
      lastLabel: this.shortMonth(totals[totals.length - 1].referenceMonth),
    };
  });

  constructor() {
    this.form.controls.indexType.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((type) => this.applyRateRules(type));

    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      this.items.set(await this.investments.getAll());
      await this.loadProjection();
    } catch (error) {
      this.errorMessage.set(messageFor(error, 'Não foi possível carregar os investimentos.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async setHorizon(months: number): Promise<void> {
    if (months === this.horizon()) {
      return;
    }

    this.horizon.set(months);
    await this.loadProjection();
  }

  private async loadProjection(): Promise<void> {
    this.projectionError.set(null);

    if (this.items().length === 0) {
      this.projection.set(null);
      return;
    }

    try {
      this.projection.set(await this.investments.getPortfolioProjection(this.horizon()));
    } catch (error) {
      this.projection.set(null);
      this.projectionError.set(
        messageFor(error, 'Não foi possível calcular a projeção agora.')
      );
    }
  }

  protected openNew(): void {
    this.form.reset({
      name: '',
      principal: null,
      investedAt: toIsoDate(new Date()),
      maturity: null,
      indexType: 'CDI',
      indexPercent: null,
      spread: null,
      taxable: true,
    });
    this.applyRateRules('CDI');
    this.formError.set(null);
    this.editing.set('new');
  }

  protected openEdit(investment: Investment): void {
    this.form.reset({
      name: investment.name,
      principal: investment.principal,
      investedAt: investment.investedAt,
      maturity: investment.maturity,
      indexType: investment.indexType,
      indexPercent: investment.indexPercent,
      spread: investment.spread,
      taxable: investment.taxable,
    });
    this.applyRateRules(investment.indexType);
    this.formError.set(null);
    this.editing.set(investment);
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

    const raw = this.form.getRawValue();
    const percentageOfIndex = this.isPercentageOfIndex(raw.indexType);
    const target = this.editing();

    const request = {
      name: raw.name.trim(),
      principal: raw.principal!,
      investedAt: raw.investedAt,
      maturity: raw.maturity || null,
      indexType: raw.indexType,
      indexPercent: percentageOfIndex ? raw.indexPercent : null,
      spread: percentageOfIndex ? null : raw.spread,
      taxable: raw.taxable,
    };

    try {
      if (target === 'new') {
        await this.investments.create(request);
      } else if (target) {
        await this.investments.update(target.id, request);
      }

      this.closeForm();
      await this.load();
    } catch (error) {
      this.formError.set(messageFor(error, 'Não foi possível salvar o investimento.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected askRemove(investment: Investment): void {
    this.formError.set(null);
    this.removing.set(investment);
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
      await this.investments.delete(target.id);
      this.removing.set(null);
      await this.load();
    } catch (error) {
      this.formError.set(messageFor(error, 'Não foi possível excluir o investimento.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async openMovements(investment: Investment): Promise<void> {
    this.managing.set(investment);
    this.movements.set([]);
    this.movementError.set(null);
    this.removingMovement.set(null);
    this.movementsChanged = false;
    this.startMovement();

    this.movementsLoading.set(true);

    try {
      this.movements.set(await this.investments.getMovements(investment.id));
    } catch (error) {
      this.movementError.set(
        messageFor(error, 'Não foi possível carregar as movimentações.')
      );
    } finally {
      this.movementsLoading.set(false);
    }
  }

  protected async closeMovements(): Promise<void> {
    this.managing.set(null);
    this.editingMovement.set(null);
    this.removingMovement.set(null);

    if (this.movementsChanged) {
      this.movementsChanged = false;
      await this.load();
    }
  }

  protected startMovement(): void {
    const investment = this.managing();

    this.movementForm.reset({
      type: 'CONTRIBUTION',
      occurredAt: this.defaultMovementDate(investment),
      amount: null,
      note: '',
    });
    this.editingMovement.set('new');
  }

  protected editMovement(movement: InvestmentMovement): void {
    this.movementForm.reset({
      type: movement.type,
      amount: movement.amount,
      occurredAt: movement.occurredAt,
      note: movement.note ?? '',
    });
    this.movementError.set(null);
    this.removingMovement.set(null);
    this.editingMovement.set(movement);
  }

  protected async saveMovement(): Promise<void> {
    const investment = this.managing();
    const target = this.editingMovement();

    if (!investment || !target || this.saving()) {
      return;
    }

    if (this.movementForm.invalid) {
      this.movementForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.movementError.set(null);

    const raw = this.movementForm.getRawValue();
    const request = {
      type: raw.type,
      amount: raw.amount!,
      occurredAt: raw.occurredAt,
      note: raw.note.trim() || null,
    };

    try {
      if (target === 'new') {
        await this.investments.addMovement(investment.id, request);
      } else {
        await this.investments.updateMovement(investment.id, target.id, request);
      }

      await this.reloadMovements(investment);
      this.startMovement();
    } catch (error) {
      this.movementError.set(
        messageFor(error, 'Não foi possível salvar a movimentação.')
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected askRemoveMovement(movement: InvestmentMovement): void {
    this.movementError.set(null);
    this.removingMovement.set(movement);
  }

  protected cancelRemoveMovement(): void {
    this.removingMovement.set(null);
  }

  protected async confirmRemoveMovement(): Promise<void> {
    const investment = this.managing();
    const target = this.removingMovement();

    if (!investment || !target || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.movementError.set(null);

    try {
      await this.investments.deleteMovement(investment.id, target.id);
      this.removingMovement.set(null);

      await this.reloadMovements(investment);

      if (this.editingMovement() === target) {
        this.startMovement();
      }
    } catch (error) {
      this.movementError.set(
        messageFor(error, 'Não foi possível excluir a movimentação.')
      );
    } finally {
      this.saving.set(false);
    }
  }

  protected movementLabel(type: MovementType): string {
    return type === 'CONTRIBUTION' ? 'Aporte' : 'Resgate';
  }

  protected invalidMovement(field: 'amount' | 'occurredAt'): boolean {
    const control = this.movementForm.controls[field];
    return control.invalid && control.touched;
  }

  private async reloadMovements(investment: Investment): Promise<void> {
    this.movementsChanged = true;
    this.movements.set(await this.investments.getMovements(investment.id));
  }

  private defaultMovementDate(investment: Investment | null): string {
    const today = toIsoDate(new Date());

    return investment && investment.investedAt > today ? investment.investedAt : today;
  }

  protected isPercentageOfIndex(type: IndexType): boolean {
    return type === 'CDI' || type === 'SELIC';
  }

  protected spreadLabel(): string {
    return this.selectedIndex() === 'IPCA' ? 'Taxa acima do IPCA' : 'Taxa anual';
  }

  protected percent(value: number | null | undefined): string {
    return value === null || value === undefined
      ? '—'
      : `${value.toFixed(2).replace('.', ',')}%`;
  }

  protected shortMonth(isoMonth: string): string {
    const [year, month] = isoMonth.split('-').map(Number);
    return SHORT_MONTH.format(new Date(year, month - 1, 1)).replace('.', '');
  }

  protected longMonth(isoMonth: string): string {
    const [year, month] = isoMonth.split('-').map(Number);
    return LONG_MONTH.format(new Date(year, month - 1, 1));
  }

  protected dayLabel(isoDate: string): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    return DAY.format(new Date(year, month - 1, day));
  }

  protected invalid(field: 'name' | 'principal' | 'investedAt' | 'indexPercent' | 'spread'): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  private applyRateRules(type: IndexType): void {
    this.selectedIndex.set(type);

    const { indexPercent, spread } = this.form.controls;
    const percentageOfIndex = this.isPercentageOfIndex(type);

    const used = percentageOfIndex ? indexPercent : spread;
    const unused = percentageOfIndex ? spread : indexPercent;

    used.setValidators([Validators.required, Validators.min(0.01)]);
    unused.clearValidators();
    unused.setValue(null, { emitEvent: false });

    used.updateValueAndValidity({ emitEvent: false });
    unused.updateValueAndValidity({ emitEvent: false });
  }

  private pathOf(values: number[], min: number, max: number): string {
    const span = max - min || 1;
    const usableHeight = CHART_BOTTOM - CHART_TOP;

    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * CHART_WIDTH;
        const y = CHART_BOTTOM - ((value - min) / span) * usableHeight;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }
}
