import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { firstValueFrom } from "rxjs";
import { User, UserRequest, UserUpdateRequest } from "../models/user";

/**
 * Administração de contas. Todas as rotas abaixo exigem ADMIN no backend
 * (@PreAuthorize), então o front só esconde o que o servidor já recusaria.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = `${environment.apiUrl}/users`;

    async getAll(): Promise<User[]> {
        return firstValueFrom(this.http.get<User[]>(this.apiUrl));
    }

    async getById(id: number): Promise<User> {
        return firstValueFrom(this.http.get<User>(`${this.apiUrl}/${id}`));
    }

    async create(request: UserRequest): Promise<User> {
        return firstValueFrom(this.http.post<User>(this.apiUrl, request));
    }

    async update(id: number, request: UserUpdateRequest): Promise<User> {
        return firstValueFrom(this.http.put<User>(`${this.apiUrl}/${id}`, request));
    }

    async inactivate(id: number): Promise<User> {
        return firstValueFrom(
            this.http.patch<User>(`${this.apiUrl}/${id}/inactivate`, {})
        );
    }

    async activate(id: number): Promise<User> {
        return firstValueFrom(
            this.http.patch<User>(`${this.apiUrl}/${id}/activate`, {})
        );
    }
}
