import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom, timeout } from "rxjs";
import {
    AwesomeResponse,
    MarketIndicator,
    MarketSnapshot,
    SgsPoint,
} from "../models/market";

/**
 * Séries do SGS (Sistema Gerenciador de Séries Temporais) do Banco Central.
 * Fonte oficial e pública, sem chave. Cada resposta traz a data de referência
 * do dado — é por isso que usamos o SGS direto em vez de um invólucro: sem a
 * data não dá para afirmar de quando é o número.
 */
const SGS_SERIES = [
    // Anualizada de hoje, não acumulado de 12 meses — não existe série disso.
    { code: 4389, label: 'CDI a.a.' },
    { code: 13522, label: 'IPCA 12M' },
    { code: 432, label: 'Selic meta' },
] as const;

/** Pares da AwesomeAPI. Uma requisição só traz todos. */
const QUOTES = [
    { pair: 'USD-BRL', key: 'USDBRL', label: 'Dólar' },
    { pair: 'EUR-BRL', key: 'EURBRL', label: 'Euro' },
    { pair: 'CHF-BRL', key: 'CHFBRL', label: 'Franco suíço' },
    { pair: 'GBP-BRL', key: 'GBPBRL', label: 'Libra' },
    { pair: 'BTC-BRL', key: 'BTCBRL', label: 'Bitcoin' },
] as const;

type QuoteKey = (typeof QUOTES)[number]['key'];

/**
 * O que cada rodada do rodapé mostra. As taxas do Banco Central abrem, o
 * câmbio fecha; assim cada grupo tem quatro células e nenhuma fica vazia.
 */
const GROUPS: readonly QuoteKey[][] = [
    ['USDBRL'],
    ['EURBRL', 'CHFBRL', 'GBPBRL', 'BTCBRL'],
];

const sgsUrl = (code: number) =>
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`;

const quotesUrl = () =>
    `https://economia.awesomeapi.com.br/last/${QUOTES.map((q) => q.pair).join(',')}`;

/** A faixa é decorativa: não pode segurar a tela de login se a API travar. */
const REQUEST_TIMEOUT = 5000;

const CACHE_KEY = 'controlplus:market-rates';

const PERCENT = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** O bitcoin passa de cem mil: centavos ali só poluem. */
const BRL_WHOLE = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
});

interface CachedRates {
    day: string;
    indicators: MarketIndicator[];
}

/**
 * Indicadores de mercado da faixa do login. Fontes públicas, sem chave:
 * Banco Central (taxas) e AwesomeAPI (câmbio e cripto). Nenhuma das duas recebe
 * cookie — ver credentialsInterceptor.
 */
@Injectable({ providedIn: 'root' })
export class MarketService {
    private readonly http = inject(HttpClient);

    /** Quantas rodadas o rodapé tem. */
    readonly groupCount = GROUPS.length;

    /**
     * Monta a rodada pedida. As taxas do Banco Central saem do cache do dia —
     * são séries diárias ou mensais, buscar de novo a cada rodada seria inútil.
     * O câmbio é sempre buscado na hora, porque muda durante o pregão.
     */
    async getGroup(index: number): Promise<MarketSnapshot | null> {
        const wanted = GROUPS[index % GROUPS.length];
        const isFirstGroup = index % GROUPS.length === 0;

        const [rates, quotes] = await Promise.allSettled([
            isFirstGroup ? this.getRates() : Promise.resolve([]),
            this.fetchQuotes(wanted),
        ]);

        const indicators = [
            ...(rates.status === 'fulfilled' ? rates.value : []),
            ...(quotes.status === 'fulfilled' ? quotes.value : []),
        ];

        if (indicators.length === 0) {
            return null;
        }

        return { indicators, fetchedAt: stamp(new Date()) };
    }

    private async getRates(): Promise<MarketIndicator[]> {
        const cached = this.readCache();
        if (cached) {
            return cached;
        }

        // Em série, não em paralelo: três chamadas simultâneas ao mesmo host do
        // BCB caem em limitação de rajada e uma das séries volta vazia. Roda uma
        // vez por dia por causa do cache, então o custo de esperar é irrelevante.
        const indicators: MarketIndicator[] = [];

        for (const series of SGS_SERIES) {
            try {
                indicators.push(await this.fetchSeries(series.code, series.label));
            } catch {
                // Uma série fora não derruba as outras.
            }
        }

        // Só guarda resultado completo — parcial volta a tentar no próximo acesso.
        if (indicators.length === SGS_SERIES.length) {
            this.writeCache(indicators);
        }

        return indicators;
    }

    private async fetchSeries(code: number, label: string): Promise<MarketIndicator> {
        const points = await firstValueFrom(
            this.http.get<SgsPoint[]>(sgsUrl(code)).pipe(timeout(REQUEST_TIMEOUT))
        );

        const point = points?.[0];
        const value = Number(point?.valor);

        if (!point?.data || !Number.isFinite(value)) {
            throw new Error(`Série ${code} veio vazia ou inválida`);
        }

        // O SGS já devolve a data em dd/mm/aaaa.
        return { label, value: `${PERCENT.format(value)}%`, reference: point.data };
    }

    private async fetchQuotes(wanted: readonly QuoteKey[]): Promise<MarketIndicator[]> {
        const response = await firstValueFrom(
            this.http.get<AwesomeResponse>(quotesUrl()).pipe(timeout(REQUEST_TIMEOUT))
        );

        return wanted.flatMap((key, position) => {
            const meta = QUOTES.find((quote) => quote.key === key);
            const quote = response?.[key];
            const bid = Number(quote?.bid);

            // Um par ausente ou quebrado some da faixa em vez de virar NaN.
            if (!meta || !Number.isFinite(bid)) {
                return [];
            }

            const change = Number(quote.pctChange);
            const formatter = bid >= 1000 ? BRL_WHOLE : BRL;

            return [{
                label: meta.label,
                value: formatter.format(bid),
                reference: dayOf(quote.create_date),
                change: Number.isFinite(change) ? change : undefined,
                highlight: position === 0,
            }];
        });
    }

    private readCache(): MarketIndicator[] | null {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) {
                return null;
            }

            const cached = JSON.parse(raw) as CachedRates;
            return cached.day === cacheDay() ? cached.indicators : null;
        } catch {
            // localStorage bloqueado ou JSON corrompido: segue e busca de novo.
            return null;
        }
    }

    private writeCache(indicators: MarketIndicator[]): void {
        try {
            const payload: CachedRates = { day: cacheDay(), indicators };
            localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
        } catch {
            // Sem espaço ou sem permissão: cache é otimização, não requisito.
        }
    }
}

/** "2026-08-07 10:25:23" vem da AwesomeAPI; queremos só dd/mm/aaaa. */
function dayOf(createDate: string | undefined): string {
    const [day] = (createDate ?? '').split(' ');
    const [year, month, date] = day.split('-');
    return date ? `${date}/${month}/${year}` : stampDate(new Date());
}

function stampDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
}

/** Com atualização a cada rodada, a hora passa a importar tanto quanto o dia. */
function stamp(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${stampDate(date)} ${hours}:${minutes}`;
}

/** Chave de validade do cache das taxas: uma busca por dia basta. */
function cacheDay(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}
