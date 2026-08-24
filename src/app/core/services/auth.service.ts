import { HttpClient } from "@angular/common/http";
import { computed, inject, Injectable, signal } from "@angular/core";
import { environment } from "../../../environments/environment";
import { firstValueFrom } from "rxjs";
import { User } from "../models/user";

/**
 * O backend omite passwordChangeRequired nas respostas em que o estado não é
 * conhecido — daí o campo opcional.
 */
interface LoginResponse {
    message: string;
    passwordChangeRequired?: boolean;
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

    /**
     * Conta com senha temporária. Enquanto for verdade o PasswordChangeRequiredFilter
     * responde 403 em tudo fora de /auth/change-password, /auth/logout, /auth/refresh
     * e /users/me — então a única tela útil é a de troca de senha.
     */
    readonly mustChangePassword = computed(
        () => this.currentUser()?.passwordChangeRequired === true
    )

    /** Devolve true quando a senha usada era temporária e precisa ser trocada. */
    async login(email: string, password: string): Promise<boolean> {
        await firstValueFrom(
            this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email, password })
        )
        this.authenticated.set(true)
        // O login só devolve mensagem e o aviso de senha temporária; quem traz
        // nome, papel e o mesmo aviso já em forma de usuário é o /users/me.
        await this.checkSession()
        return this.mustChangePassword()
    }

    /** Troca a senha da conta autenticada e libera o resto da API. */
    async changePassword(currentPassword: string, newPassword: string): Promise<void> {
        await firstValueFrom(
            this.http.post<LoginResponse>(`${this.apiUrl}/auth/change-password`, {
                currentPassword,
                newPassword,
            })
        )
        // A troca emite tokens novos; o /users/me confirma que a trava caiu.
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
