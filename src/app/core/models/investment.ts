/**
 * CDI e SELIC são contratados como percentual do índice (120% do CDI); IPCA é
 * índice mais spread; FIXED não tem índice nenhum, a taxa inteira é do contrato.
 */
export type IndexType = 'CDI' | 'SELIC' | 'IPCA' | 'FIXED';

/** Aporte põe dinheiro na posição; resgate tira. O valor é sempre positivo. */
export type MovementType = 'CONTRIBUTION' | 'WITHDRAWAL';

export interface Investment {
  id: number;
  name: string;
  /** Valor de abertura, na data da aplicação. */
  principal: number;
  /** yyyy-MM-dd */
  investedAt: string;
  /** yyyy-MM-dd; null quando não tem vencimento. */
  maturity: string | null;
  indexType: IndexType;
  /** Percentual do índice, ex.: 120 para "120% do CDI". Null fora de CDI/SELIC. */
  indexPercent: number | null;
  /** Spread anual: o "+ 6" de "IPCA + 6%", ou a taxa inteira quando FIXED. */
  spread: number | null;
  taxable: boolean;
  /** Pronto do backend, ex.: "120% do CDI". */
  rateLabel: string;
  /** Aportes já feitos até hoje; os datados à frente ficam de fora. */
  totalContributed: number;
  /** Resgates já feitos até hoje. */
  totalWithdrawn: number;
  /** principal + totalContributed - totalWithdrawn. */
  netInvested: number;
  /** Movimentações cadastradas, incluindo as com data futura. */
  movementCount: number;
}

export interface InvestmentRequest {
  name: string;
  principal: number;
  investedAt: string;
  maturity: string | null;
  indexType: IndexType;
  indexPercent: number | null;
  spread: number | null;
  taxable: boolean;
}

export interface InvestmentMovement {
  id: number;
  investmentId: number;
  type: MovementType;
  amount: number;
  /** yyyy-MM-dd */
  occurredAt: string;
  note: string | null;
}

export interface InvestmentMovementRequest {
  type: MovementType;
  amount: number;
  occurredAt: string;
  note: string | null;
}

export interface ProjectionMonth {
  /** yyyy-MM */
  referenceMonth: string;
  grossBalance: number;
  /** Rendimento ainda dentro da posição; um resgate leva a parte dele que sai. */
  grossEarnings: number;
  incomeTax: number;
  netBalance: number;
  /** Ganho do mês já sem os aportes e resgates do período. */
  netEarningsInMonth: number;
  /** Aplicado e não resgatado até o fim do mês. */
  netInvested: number;
}

export interface InvestmentProjection {
  investmentId: number;
  name: string;
  indexType: IndexType;
  rateLabel: string;
  /** Taxa do índice usada, em % a.a. Null em FIXED. */
  indexAnnualPercent: number | null;
  /** Data a que o índice se refere, yyyy-MM-dd. Null em FIXED. */
  indexReferenceDate: string | null;
  /** True quando o backend caiu no último valor guardado em vez de consultar o BCB. */
  indexStale: boolean;
  effectiveAnnualPercent: number;
  effectiveMonthlyPercent: number;
  /** Abertura mais aportes menos resgates, na data de hoje. */
  netInvested: number;
  currentGrossBalance: number;
  currentNetBalance: number;
  months: ProjectionMonth[];
}

export interface PortfolioProjection {
  totalNetInvested: number;
  currentGrossBalance: number;
  currentNetBalance: number;
  totals: ProjectionMonth[];
  investments: InvestmentProjection[];
}
