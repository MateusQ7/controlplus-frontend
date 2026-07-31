import { HttpErrorResponse } from '@angular/common/http';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const MONTH = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const DAY = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });

export function startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** Data local em yyyy-MM-dd — toISOString() converte para UTC e erra o dia. */
export function toIsoDate(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

/** Formato yyyy-MM, como o backend espera em referenceMonth. */
export function toIsoMonth(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(date: Date): string {
    return MONTH.format(date);
}

export function money(value: number | null | undefined): string {
    return BRL.format(value ?? 0);
}

export function dayLabel(isoDate: string): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    return DAY.format(new Date(year, month - 1, day));
}

export function messageFor(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
        if (error.status === 0) {
            return 'Não foi possível falar com o servidor. Ele está rodando?';
        }

        const backendMessage = error.error?.message;
        if (typeof backendMessage === 'string' && backendMessage.length > 0) {
            return backendMessage;
        }
    }

    return fallback;
}
