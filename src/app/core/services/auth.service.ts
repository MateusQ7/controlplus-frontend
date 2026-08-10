import { HttpClient } from "@angular/common/http";
import { computed, inject, Injectable, signal } from "@angular/core";
import { environment } from "../../../environments/environment";
import { firstValueFrom } from "rxjs";
import { User } from "../models/user";

interface LoginResponse {
    message: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = environment.apiUrl;

    private readonly authenticated = signal(false)
    private readonly currentUser = signal<User | null>(null)

    readonly isAuthenticated = this.authenticated.asReadonly()
    readonly user = this.currentUser.asReadonly()

    /**
     * Só decide o que a interface mostra. Quem autoriza de verdade é o backend,
     * via @PreAuthorize — o papel vem do JWT, que está em cookie HttpOnly e o
     * front não consegue ler.
     */
    readonly isAdmin = computed(() => this.currentUser()?.role === 'ADMIN')

    async login(email: string, password: string): Promise<void> {
        await firstValueFrom(
            this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email, password })
        )
        this.authenticated.set(true)
        // O login só devolve mensagem; quem traz nome e papel é o /users/me.
        await this.checkSession()
    }

    async logout(): Promise<void> {
        try {
            await firstValueFrom(this.http.post(`${this.apiUrl}/auth/logout`, {}));
        } finally {
            this.authenticated.set(false);
            this.currentUser.set(null);
        }
    }

    async checkSession(): Promise<boolean> {
        try {
            const user = await firstValueFrom(
                this.http.get<User>(`${this.apiUrl}/users/me`)
            );
            this.authenticated.set(true);
            this.currentUser.set(user);
            return true;
        } catch {
            this.authenticated.set(false);
            this.currentUser.set(null);
            return false;
        }
    }
}
