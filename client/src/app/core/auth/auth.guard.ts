import { inject } from '@angular/core';
import {
  CanActivateFn,
  Router,
} from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, take, map } from 'rxjs';

import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const initialized$ = toObservable(authService.initialized);

  return initialized$.pipe(
    filter(value => value === true),
    take(1),
    map(() => {
      if (authService.isRecoverySession()) {
        return router.createUrlTree(['/reset-password']);
      }
      if (authService.user()) {
        return true;
      }

      return router.createUrlTree(['/auth']);
    })
  );
};
