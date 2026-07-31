import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { firstValueFrom } from "rxjs";
import { CategorySummary, Summary, Transaction, TransactionRequest } from "../models/transaction";
import { PageResponse } from "../models/page-response";
import { TransactionType } from "../models/transaction-type";

@Injectable({ providedIn: 'root' })
export class TransactionService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/transactions`;

    async create(request: TransactionRequest): Promise<Transaction> {
        return firstValueFrom(this.http.post<Transaction>(this.apiUrl, request));
    }

    async update(id: number, request: TransactionRequest): Promise<Transaction> {
        return firstValueFrom(this.http.put<Transaction>(`${this.apiUrl}/${id}`, request));
    }

    async delete(id: number): Promise<void> {
        await firstValueFrom(this.http.delete<void>(`${this.apiUrl}/${id}`));
    }

    async getSummary(startDate: string, endDate: string): Promise<Summary> {
        return firstValueFrom(
            this.http.get<Summary>(`${this.apiUrl}/summary`, {
                params: new HttpParams().set('startDate', startDate).set('endDate', endDate)
            })
        );
    }

    async getSummaryByCategory(
        type: TransactionType,
        startDate: string,
        endDate: string
    ): Promise<CategorySummary[]> {
        return firstValueFrom(
            this.http.get<CategorySummary[]>(`${this.apiUrl}/summary/by-category`, {
                params: new HttpParams()
                    .set('type', type)
                    .set('startDate', startDate)
                    .set('endDate', endDate)
            })
        );
    }

    async getByPeriod(
        startDate: string,
        endDate: string,
        page = 0,
        size = 50
    ): Promise<PageResponse<Transaction>> {
        return firstValueFrom(
            this.http.get<PageResponse<Transaction>>(`${this.apiUrl}/period`, {
                params: new HttpParams()
                    .set('startDate', startDate)
                    .set('endDate', endDate)
                    .set('page', page)
                    .set('size', size)
            })
        );
    }
}
