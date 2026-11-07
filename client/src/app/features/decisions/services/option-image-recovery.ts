import { inject, Injectable, signal } from '@angular/core';
import { Observable, finalize, shareReplay, tap, throwError } from 'rxjs';
import { DecisionApi } from './decision-api';
import { DecisionState } from '../state/decision-state';
import { DecisionOption } from '../models/decision-option';

interface RecoveryStatus {
  pending: boolean;
  failed: boolean;
  message?: string;
  code?: string;
}

@Injectable({ providedIn: 'root' })
export class OptionImageRecovery {
  private readonly api = inject(DecisionApi);
  private readonly state = inject(DecisionState);
  readonly lifecycle = this.state.workspaceLoadVersion;
  private epoch = -1;
  private readonly attempted = new Set<string>();
  private readonly inFlight = new Map<string, Observable<DecisionOption>>();
  private readonly statuses = signal<ReadonlyMap<string, RecoveryStatus>>(new Map());

  private key(option: DecisionOption): string { return `${option.decisionId}/${option.id}`; }

  pending(option: DecisionOption): boolean { return this.statuses().get(this.key(option))?.pending ?? false; }
  failed(option: DecisionOption): boolean { return this.statuses().get(this.key(option))?.failed ?? false; }
  message(option: DecisionOption): string | undefined { return this.statuses().get(this.key(option))?.message; }

  customized(option: DecisionOption): boolean {
    return !!option.thumbnailUrl?.trim() && option.thumbnailUrl.trim() !== option.imageUrl?.trim();
  }

  needsConfirmation(option: DecisionOption): boolean {
    return this.customized(option) || this.statuses().get(this.key(option))?.code === 'thumbnail_confirmation_required';
  }

  private isMarketplaceImage(value: string): boolean {
    try {
      const url = new URL(value);
      // Match the existing marketplace proxy/import allowlist, never a storage URL.
      return url.protocol === 'https:' && !url.username && !url.password &&
        (url.hostname === 'tokopedia-static.net' || url.hostname.endsWith('.tokopedia-static.net'));
    } catch { return false; }
  }

  private syncLifecycle(): void {
    const epoch = this.lifecycle();
    if (epoch === this.epoch) return;
    this.epoch = epoch;
    this.attempted.clear();
    this.statuses.update(statuses => new Map([...statuses].filter(([, status]) => status.pending)));
  }

  tryAutomatic(option: DecisionOption): void {
    this.syncLifecycle();
    const key = this.key(option);
    const candidates = [option.thumbnailUrl?.trim(), option.imageUrl?.trim()].filter((url): url is string => !!url);
    if (this.attempted.has(key) || this.inFlight.has(key) || this.customized(option) ||
        !this.api.supportsMarketplaceSource(option.sourceUrl) || candidates.length === 0 ||
        !candidates.every(url => this.isMarketplaceImage(url)) || this.api.getOptionImageUrl(option) !== null) return;
    // A null selection with nonempty valid candidates means image errors were recorded.
    this.refresh(option).subscribe({ error: () => { /* Retry is explicit after this attempt. */ } });
  }

  refresh(option: DecisionOption, replaceThumbnail = false): Observable<DecisionOption> {
    this.syncLifecycle();
    const key = this.key(option);
    const pending = this.inFlight.get(key);
    if (pending) return pending;
    if (this.needsConfirmation(option) && !replaceThumbnail)
      return throwError(() => ({ error: { code: 'thumbnail_confirmation_required', message: 'Confirm replacement of your current thumbnail.' } }));
    if (!this.api.supportsMarketplaceSource(option.sourceUrl))
      return throwError(() => ({ error: { code: 'source_url_unsupported', message: 'No supported marketplace source is saved for this option.' } }));
    // Manual requests also consume the automatic attempt for this lifecycle.
    this.attempted.add(key);
    const request = this.api.refreshOptionImage(option.decisionId, option.id, option.updatedAt, replaceThumbnail).pipe(
      tap({
        next: updated => {
          this.api.clearImageFailures(updated.thumbnailUrl, updated.imageUrl);
          const current = this.state.options().find(item => item.id === option.id && item.decisionId === option.decisionId);
          // Do not replace a newer local response or unrelated option fields.
          if (current && current.updatedAt === option.updatedAt) {
            this.state.updateOption({ ...current, imageUrl: updated.imageUrl,
              thumbnailUrl: updated.thumbnailUrl, updatedAt: updated.updatedAt });
          }
          this.setStatus(key, { pending: false, failed: false });
        },
        error: error => this.setStatus(key, { pending: false, failed: true, code: error.error?.code,
          message: error.error?.message ?? 'Unable to refresh the image. Try again manually.' }),
      }),
      finalize(() => this.inFlight.delete(key)),
      // Keep one request alive across subscribing views; unmounting must not restart an upload.
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.inFlight.set(key, request);
    this.setStatus(key, { pending: true, failed: false });
    return request;
  }

  private setStatus(key: string, status: RecoveryStatus): void {
    this.statuses.update(statuses => new Map(statuses).set(key, status));
  }
}
