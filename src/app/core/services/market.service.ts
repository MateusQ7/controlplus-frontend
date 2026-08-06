import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom, timeout } from "rxjs";
import { AwesomeQuote, MarketIndicator, MarketSnapshot, SgsPoint } from "../models/market";

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

const sgsUrl = (code: number) =>
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados/ultimos/1?formato=json`;

const DOLLAR_URL = 'https://economia.awesomeapi.com.br/last/USD-BRL';

/** A faixa é decorativa: não pode segurar a tela de login se a API travar. */
const REQUEST_TIMEOUT = 5000;

const CACHE_KEY = 'controlplus:market';

const PERCENT = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface CachedSnapshot extends MarketSnapshot {
    day: string;
}

/**
 * Indicadores de mercado da faixa do login. Fontes públicas, sem chave:
 * Banco Central (taxas) e AwesomeAPI (dólar). Nenhuma das duas recebe cookie —
 * ver credentialsInterceptor.
 */
@Injectable({ providedIn: 'root' })
export class MarketService {
    private readonly http = inject(HttpClient);

    async getSnapshot(): Promise<MarketSnapshot | null> {
        const cached = this.readCache();
        if (cached) {
            return cached;
        }

        // allSettled e não all: se só o dólar cair, as taxas ainda aparecem.
        const results = await Promise.allSettled([
            ...SGS_SERIES.map((series) => this.fetchSeries(series.code, series.label)),
            this.fetchDollar(),
        ]);

        const indicators = results
            .filter((result) => result.status === 'fulfilled')
            .map((result) => result.value);

        if (indicators.length === 0) {
            return null;
        }

        const snapshot: MarketSnapshot = { indicators, fetchedAt: formatDate(new Date()) };

        // Só guarda resultado completo — parcial volta a tentar no próximo acesso.
        if (indicators.length === results.length) {
            this.writeCache(snapshot);
        }

        return snapshot;
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

    private async fetchDollar(): Promise<MarketIndicator> {
        const quote = await firstValueFrom(
            this.http.get<AwesomeQuote>(DOLLAR_URL).pipe(timeout(REQUEST_TIMEOUT))
        );

        const bid = Number(quote.USDBRL?.bid);
        if (!Number.isFinite(bid)) {
            throw new Error('Cotação do dólar inválida');
        }

        // create_date vem como "2026-08-03 15:48:49".
        const [day] = (quote.USDBRL.create_date ?? '').split(' ');
        const [year, month, date] = day.split('-');

        return {
            label: 'Dólar',
            value: BRL.format(bid),
            reference: date ? `${date}/${month}/${year}` : formatDate(new Date()),
            highlight: true,
        };
    }

    private readCache(): MarketSnapshot | null {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) {
                return null;
            }

            const cached = JSON.parse(raw) as CachedSnapshot;
            return cached.day === cacheDay() ? cached : null;
        } catch {
            // localStorage bloqueado ou JSON corrompido: segue e busca de novo.
            return null;
        }
    }

    private writeCache(snapshot: MarketSnapshot): void {
        try {
            const payload: CachedSnapshot = { ...snapshot, day: cacheDay() };
            localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
        } catch {
            // Sem espaço ou sem permissão: cache é otimização, não requisito.
        }
    }
}

function formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${date.getFullYear()}`;
}

/** Chave de validade do cache: uma busca por dia basta. */
function cacheDay(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}
