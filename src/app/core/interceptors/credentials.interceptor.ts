import { HttpInterceptorFn } from "@angular/common/http";
import { environment } from "../../../environments/environment";

export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
    // Só o nosso backend recebe o cookie de sessão. APIs públicas respondem com
    // Allow-Origin *, e o navegador recusa requisição credenciada nesse caso.
    if (!req.url.startsWith(environment.apiUrl)) {
        return next(req);
    }

    return next(req.clone({ withCredentials: true }));
}
