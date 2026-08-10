export interface MarketIndicator {
  label: string;
  value: string;
  /** Data de referência do próprio dado, em dd/mm/aaaa — não é a data da consulta. */
  reference: string;
  /** Variação percentual do dia, quando a fonte informa. */
  change?: number;
  /** Marca o valor com a cor da marca — usado no primeiro câmbio de cada grupo. */
  highlight?: boolean;
}

export interface MarketSnapshot {
  indicators: MarketIndicator[];
  /** Quando o front buscou os números, em dd/mm/aaaa HH:mm. */
  fetchedAt: string;
}

/** Item de https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados/ultimos/1 */
export interface SgsPoint {
  data: string;
  valor: string;
}

/** Uma cotação de https://economia.awesomeapi.com.br/last/{pares} */
export interface AwesomeQuote {
  bid: string;
  pctChange: string;
  create_date: string;
}

/** A resposta chega com uma chave por par, sem hífen: USDBRL, EURBRL… */
export type AwesomeResponse = Record<string, AwesomeQuote>;
