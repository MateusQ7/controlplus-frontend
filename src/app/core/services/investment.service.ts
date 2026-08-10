import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { environment } from "../../../environments/environment";
import {
    Investment,
    InvestmentMovement,
    InvestmentMovementRequest,
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
     * Aportes e resgates de uma posição. O backend recusa o resgate maior que o saldo
     * da data e a movimentação fora da vida do papel — a tela mostra a mensagem dele.
     */
    async getMovements(investmentId: number): Promise<InvestmentMovement[]> {
        return firstValueFrom(
            this.http.get<InvestmentMovement[]>(this.movementsUrl(investmentId))
        );
    }

    async addMovement(
        investmentId: number,
        request: InvestmentMovementRequest,
    ): Promise<InvestmentMovement> {
        return firstValueFrom(
            this.http.post<InvestmentMovement>(this.movementsUrl(investmentId), request)
        );
    }

    async updateMovement(
        investmentId: number,
        movementId: number,
        request: InvestmentMovementRequest,
    ): Promise<InvestmentMovement> {
        return firstValueFrom(
            this.http.put<InvestmentMovement>(
                `${this.movementsUrl(investmentId)}/${movementId}`,
                request,
            )
        );
    }

    async deleteMovement(investmentId: number, movementId: number): Promise<void> {
        await firstValueFrom(
            this.http.delete<void>(`${this.movementsUrl(investmentId)}/${movementId}`)
        );
    }

    private movementsUrl(investmentId: number): string {
        return `${this.apiUrl}/${investmentId}/movements`;
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