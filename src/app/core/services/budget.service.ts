import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { firstValueFrom } from "rxjs";
import { Budget, BudgetRequest } from "../models/budget";

@Injectable({ providedIn: 'root' })
export class BudgetService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/budgets`;

    /** referenceMonth no formato yyyy-MM, como o backend espera. */
    async getByMonth(referenceMonth: string): Promise<Budget[]> {
        return firstValueFrom(
            this.http.get<Budget[]>(this.apiUrl, {
                params: new HttpParams().set('referenceMonth', referenceMonth)
            })
        );
    }

    async create(request: BudgetRequest): Promise<Budget> {
        return firstValueFrom(this.http.post<Budget>(this.apiUrl, request));
    }

    /** O backend só aceita novo limite: categoria e mês são imutáveis. */
    async updateLimit(id: number, limitAmount: number): Promise<Budget> {
        return firstValueFrom(
            this.http.put<Budget>(`${this.apiUrl}/${id}`, { limitAmount })
        );
    }

    async delete(id: number): Promise<void> {
        await firstValueFrom(this.http.delete<void>(`${this.apiUrl}/${id}`));
    }
}
