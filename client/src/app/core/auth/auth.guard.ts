import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
} from '@angular/router';

import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  while (!authService.initialized()) {
    await new Promise(resolve =>
      setTimeout(resolve, 20),
    );
  }

  if (authService.user()) {
    return true;
  }

  return router.createUrlTree([
    '/auth',
  ]);
};