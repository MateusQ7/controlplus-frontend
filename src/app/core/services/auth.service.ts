import { HttpClient } from "@angular/common/http";
import { inject, Injectable, signal } from "@angular/core";
import { environment } from "../../../environments/environment";
import { firstValueFrom } from "rxjs";

interface LoginResponse {
    message: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly http = inject(HttpClient);
    private readonly apiUrl = environment.apiUrl;

    private readonly authenticated = signal(false)
    private readonly currentUser = signal<string | null>(null)

    readonly isAuthenticated = this.authenticated.asReadonly()
    readonly user = this.currentUser.asReadonly()

    async login(email: string, password: string): Promise<void> {
        await firstValueFrom(
            this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email, password })
        )
        this.authenticated.set(true)
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
            const body = await firstValueFrom(
                this.http.get(`${this.apiUrl}/users/me`, { responseType: 'text' })
            );
            this.authenticated.set(true);
            // O endpoint devolve "Authenticated user: <email>" em texto puro.
            this.currentUser.set(body.replace(/^Authenticated user:\s*/, '').trim() || null);
            return true;
        } catch {
            this.authenticated.set(false);
            this.currentUser.set(null);
            return false;
        }
    }
}