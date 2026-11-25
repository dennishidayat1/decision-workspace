import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { NavController } from '@ionic/angular';
import { appConfig } from './app.config';
import { AuthService } from './core/auth/auth.service';
import { DecisionState } from './features/decisions/state/decision-state';
import { DecisionWorkspaceResponse } from './features/decisions/models/decision-workspace-response';

describe('Account isolation bootstrap integration', () => {
  let identity: BehaviorSubject<string | null>;
  let isRecoverySession: ReturnType<typeof signal<boolean>>;
  let isCleaningUpRecovery: ReturnType<typeof signal<boolean>>;
  let state: DecisionState;
  let http: HttpTestingController;
  let navigateRoot: ReturnType<typeof vi.fn>;
  const workspace = { decision: { id: 'decision' }, options: [], criteria: [], attributes: [], scores: [] } as unknown as DecisionWorkspaceResponse;

  beforeEach(() => {
    identity = new BehaviorSubject<string | null>('user-a');
    isRecoverySession = signal(false);
    isCleaningUpRecovery = signal(false);
    navigateRoot = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({ providers: [
      ...appConfig.providers,
      { provide: AuthService, useValue: {
        identityChanges: identity.asObservable(), isRecoverySession, isCleaningUpRecovery, accessToken: 'test',
      } },
      provideHttpClientTesting(),
      { provide: NavController, useValue: { navigateRoot } },
    ] });
    state = TestBed.inject(DecisionState);
    http = TestBed.inject(HttpTestingController);
    expect(navigateRoot).not.toHaveBeenCalled();
  });
  afterEach(() => http.verify());

  it('clears the previous workspace without redirecting an incoming recovery session', () => {
    state.ensureDecisionLoaded('decision');
    http.expectOne(req => req.url.endsWith('/workspace')).flush(workspace);
    isRecoverySession.set(true);
    identity.next('user-b');
    expect(state.decision()).toBeNull();
    expect(navigateRoot).not.toHaveBeenCalled();

    isRecoverySession.set(false);
    identity.next(null);
    expect(navigateRoot).toHaveBeenCalledWith('/auth', { animated: false });
  });

  it('keeps the reset page in place when the recovery session is signed out', () => {
    isCleaningUpRecovery.set(true);
    identity.next(null);
    expect(navigateRoot).not.toHaveBeenCalled();
  });

  it('clears loaded state synchronously on logout and reloads the same ID for another user', () => {
    state.ensureDecisionLoaded('decision');
    http.expectOne(req => req.url.endsWith('/workspace')).flush(workspace);
    identity.next(null);
    expect(state.decision()).toBeNull();
    expect(state.loadStatus()).toBe('idle');
    expect(navigateRoot).toHaveBeenCalledWith('/auth', { animated: false });
    identity.next('user-b');
    state.ensureDecisionLoaded('decision');
    http.expectOne(req => req.url.endsWith('/workspace')).flush(workspace);
    expect(state.decision()?.id).toBe('decision');
  });

  it.each(['success', 'error'])('rejects an old %s across A to B to A transitions', outcome => {
    state.ensureDecisionLoaded('decision');
    const old = http.expectOne(req => req.url.endsWith('/workspace'));
    identity.next('user-b');
    identity.next('user-a');
    state.ensureDecisionLoaded('decision');
    const current = http.expectOne(req => req.url.endsWith('/workspace'));
    if (outcome === 'success') old.flush(workspace);
    else old.flush({}, { status: 403, statusText: 'Forbidden' });
    expect(state.decision()).toBeNull();
    expect(state.loadStatus()).toBe('loading');
    current.flush(workspace);
    expect(state.loadStatus()).toBe('loaded');
  });
});
