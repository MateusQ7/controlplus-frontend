export interface MarketIndicator {
  label: string;
  value: string;
  /** Data de referência do próprio dado, em dd/mm/aaaa — não é a data da consulta. */
  reference: string;
  /** Marca o valor com a cor da marca — hoje só o dólar. */
  highlight?: boolean;
}

export interface MarketSnapshot {
  indicators: MarketIndicator[];
  /** Quando o front buscou os números, em dd/mm/aaaa. */
  fetchedAt: string;
}

/** Item de https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados/ultimos/1 */
export interface SgsPoint {
  data: string;
  valor: string;
}

/** Resposta de https://economia.awesomeapi.com.br/last/USD-BRL */
export interface AwesomeQuote {
  USDBRL: {
    bid: string;
    create_date: string;
  };
}
