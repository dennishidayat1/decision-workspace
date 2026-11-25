import { ApplicationConfig, inject, isDevMode, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
import { Capacitor } from '@capacitor/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from './core/auth/auth.service';
import { DecisionState } from './features/decisions/state/decision-state';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AlertController, NavController, provideIonicAngular } from '@ionic/angular';
import { authInterceptor } from './core/auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !Capacitor.isNativePlatform(),
      registrationStrategy: 'registerWhenStable:30000',
      updateViaCache: 'none',
    }),
    provideAppInitializer(() => {
      const auth = inject(AuthService);
      const state = inject(DecisionState);
      const nav = inject(NavController);
      let previousUserId: string | null = null;
      auth.identityChanges.pipe(takeUntilDestroyed()).subscribe(userId => {
        state.resetWorkspace();
        // Preserve initial deep links; discard retained pages of a departing user.
        if (previousUserId !== null && !auth.isRecoverySession() && !auth.isCleaningUpRecovery()) {
          void nav.navigateRoot(userId ? '/decisions' : '/auth', { animated: false })
            .catch(() => console.error('Unable to navigate after account change.'));
        }
        previousUserId = userId;
      });
      return auth.recoveryCallbackReady;
    }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    provideIonicAngular(),
    AlertController,
  ]
};
