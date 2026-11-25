import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const initialized = signal(false);
  const user = signal<{ id: string } | null>(null);
  const isRecoverySession = signal(false);

  beforeEach(() => {
    initialized.set(false);
    user.set(null);
    isRecoverySession.set(false);
    TestBed.configureTestingModule({ providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { initialized, user, isRecoverySession } },
    ] });
  });

  function subscribe() {
    const next = vi.fn();
    const complete = vi.fn();
    const result = TestBed.runInInjectionContext(() => authGuard(
      {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot,
    )) as Observable<unknown>;
    const subscription = result.subscribe({ next, complete });
    TestBed.tick();
    return { next, complete, subscription };
  }

  it('waits for initialization then allows the restored user exactly once', () => {
    const result = subscribe();
    expect(result.next).not.toHaveBeenCalled();
    expect(result.complete).not.toHaveBeenCalled();
    user.set({ id: 'user-1' });
    initialized.set(true);
    TestBed.tick();
    expect(result.next).toHaveBeenCalledExactlyOnceWith(true);
    expect(result.complete).toHaveBeenCalledTimes(1);
    expect(result.subscription.closed).toBe(true);
    user.set(null);
    initialized.set(false);
    initialized.set(true);
    TestBed.tick();
    expect(result.next).toHaveBeenCalledTimes(1);
  });

  it('returns the auth UrlTree when initialization finishes without a user', () => {
    const result = subscribe();
    initialized.set(true);
    TestBed.tick();
    expect(result.next).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(Router).serializeUrl(result.next.mock.calls[0][0])).toBe('/auth');
    expect(result.complete).toHaveBeenCalledTimes(1);
  });

  it('keeps a recovery session on the reset route', () => {
    user.set({ id: 'user-1' });
    isRecoverySession.set(true);
    initialized.set(true);
    const result = subscribe();
    expect(TestBed.inject(Router).serializeUrl(result.next.mock.calls[0][0])).toBe('/reset-password');
  });

  it('handles a service that is already initialized', () => {
    initialized.set(true);
    user.set({ id: 'user-1' });
    const result = subscribe();
    expect(result.next).toHaveBeenCalledExactlyOnceWith(true);
    expect(result.subscription.closed).toBe(true);
  });

  it('does not emit after the router cancels its subscription while waiting', () => {
    const result = subscribe();
    result.subscription.unsubscribe();
    initialized.set(true);
    TestBed.tick();
    expect(result.next).not.toHaveBeenCalled();
    expect(result.subscription.closed).toBe(true);
  });
});
