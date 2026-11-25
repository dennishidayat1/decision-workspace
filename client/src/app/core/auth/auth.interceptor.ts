import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = new URL(environment.apiUrl);
  let target: URL;
  try { target = new URL(req.url, globalThis.location?.href ?? environment.apiUrl); } catch { return next(req); }
  if (target.origin !== api.origin ||
    !(target.pathname === api.pathname || target.pathname.startsWith(`${api.pathname}/`))) return next(req);
  const authService = inject(AuthService);
  const token = authService.accessToken;

  if (!token) {
    return next(req);
  }

  const authenticatedRequest = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  return next(authenticatedRequest);
};
