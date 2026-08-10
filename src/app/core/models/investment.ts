/**
 * CDI e SELIC são contratados como percentual do índice (120% do CDI); IPCA é
 * índice mais spread; FIXED não tem índice nenhum, a taxa inteira é do contrato.
 */
export type IndexType = 'CDI' | 'SELIC' | 'IPCA' | 'FIXED';

export interface Investment {
  id: number;
  name: string;
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

export interface ProjectionMonth {
  /** yyyy-MM */
  referenceMonth: string;
  grossBalance: number;
  grossEarnings: number;
  incomeTax: number;
  netBalance: number;
  netEarningsInMonth: number;
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
  principal: number;
  currentGrossBalance: number;
  currentNetBalance: number;
  months: ProjectionMonth[];
}

export interface PortfolioProjection {
  totalPrincipal: number;
  currentGrossBalance: number;
  currentNetBalance: number;
  totals: ProjectionMonth[];
  investments: InvestmentProjection[];
}
