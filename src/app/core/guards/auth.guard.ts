import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";

export const authGuard: CanActivateFn = async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    // O token vive num cookie HttpOnly, então o front não consegue lê-lo:
    // a única forma de saber se a sessão vale é perguntar ao backend.
    if (!auth.isAuthenticated() && !(await auth.checkSession())) {
        return router.createUrlTree(['/login']);
    }

    // Senha temporária tranca o resto da API no backend; mandar para a tela de
    // troca evita uma casca inteira de links que só responderiam 403.
    if (auth.mustChangePassword()) {
        return router.createUrlTree(['/trocar-senha']);
    }

    return true;
};
