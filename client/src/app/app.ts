import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { IonApp, IonButton, IonRouterOutlet } from '@ionic/angular';
import { fromEvent, merge, timer } from 'rxjs';
import { keepIosInputVisible } from './layout/keep-ios-input-visible';

@Component({
  imports: [IonApp, IonButton, IonRouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly document = inject(DOCUMENT);
  private readonly browser = this.document.defaultView!;
  private readonly updates = inject(SwUpdate, { optional: true });

  protected readonly online = signal(this.browser.navigator.onLine);
  protected readonly versionReady = signal(false);
  protected readonly reloadRequired = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(keepIosInputVisible(this.browser));
    const connectivity = merge(
      fromEvent(this.browser, 'online'),
      fromEvent(this.browser, 'offline'),
    );
    connectivity.pipe(takeUntilDestroyed()).subscribe(() => {
      this.online.set(this.browser.navigator.onLine);
    });

    const updates = this.updates;
    if (!updates?.isEnabled) return;

    updates.versionUpdates.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event.type === 'VERSION_READY') this.versionReady.set(true);
    });
    updates.unrecoverable.pipe(takeUntilDestroyed()).subscribe(() => {
      this.reloadRequired.set(true);
    });

    // Check again when an installed app returns to the foreground or regains connectivity.
    merge(
      fromEvent(this.document, 'visibilitychange'),
      fromEvent(this.browser, 'online'),
      timer(60_000, 60 * 60_000),
    ).pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.online() && this.document.visibilityState === 'visible') {
        // Angular coalesces concurrent checks. A later trigger retries transient failures.
        void updates.checkForUpdate().catch(() => {});
      }
    });
  }

  protected reload(): void {
    this.browser.location.reload();
  }
}
