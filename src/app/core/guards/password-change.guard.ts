import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../services/auth.service";

/**
 * A tela de troca obrigatória só existe enquanto a conta está travada. Fora
 * disso ela não tem o que fazer, então devolve o usuário ao lugar certo.
 */
export const passwordChangeGuard: CanActivateFn = async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated() && !(await auth.checkSession())) {
        return router.createUrlTree(['/login']);
    }

    if (!auth.mustChangePassword()) {
        return router.createUrlTree(['/dashboard']);
    }

    return true;
};
