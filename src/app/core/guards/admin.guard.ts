import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";

/**
 * Roda depois do authGuard: a sessão já foi resolvida, então o papel em memória
 * veio do /users/me. Quem autoriza de verdade continua sendo o backend.
 */
export const adminGuard: CanActivateFn = async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
        await auth.checkSession();
    }

    if (auth.isAdmin()) {
        return true;
    }

    return router.createUrlTree(['/dashboard']);
};
