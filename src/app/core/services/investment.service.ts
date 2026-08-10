import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";
import {
    Investment,
    InvestmentProjection,
    InvestmentRequest,
    PortfolioProjection,
} from "../models/investment";

@Injectable({ providedIn: 'root' })
export class InvestmentService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/investments`;

    async getAll(): Promise<Investment[]> {
        return firstValueFrom(this.http.get<Investment[]>(this.apiUrl));
    }

    async create(request: InvestmentRequest): Promise<Investment> {
        return firstValueFrom(this.http.post<Investment>(this.apiUrl, request));
    }

    async update(id: number, request: InvestmentRequest): Promise<Investment> {
        return firstValueFrom(this.http.put<Investment>(`${this.apiUrl}/${id}`, request));
    }

    async delete(id: number): Promise<void> {
        await firstValueFrom(this.http.delete<void>(`${this.apiUrl}/${id}`));
    }

    /**
     * Carteira inteira, com os totais mês a mês já somados. Devolve 503 quando o
     * índice é desconhecido e o Banco Central está fora — a tela trata como aviso.
     */
    async getPortfolioProjection(months: number): Promise<PortfolioProjection> {
        return firstValueFrom(
            this.http.get<PortfolioProjection>(`${this.apiUrl}/projection`, {
                params: new HttpParams().set('months', months)
            })
        );
    }

    async getProjection(id: number, months: number): Promise<InvestmentProjection> {
        return firstValueFrom(
            this.http.get<InvestmentProjection>(`${this.apiUrl}/${id}/projection`, {
                params: new HttpParams().set('months', months)
            })
        );
    }
}