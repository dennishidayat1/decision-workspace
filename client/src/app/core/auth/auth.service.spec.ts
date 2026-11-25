import { TestBed } from '@angular/core/testing';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { AuthService } from './auth.service';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  initialize: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
  onAuthStateChange: vi.fn(),
}));
vi.mock('@supabase/supabase-js', () => ({
  isAuthRetryableFetchError: (error: Error) => error.name === 'AuthRetryableFetchError',
  createClient: () => ({ auth }),
}));

describe('AuthService initialization', () => {
  let listener: (event: AuthChangeEvent, session: Session | null) => void;
  const session = { access_token: 'test-token', user: { id: 'user-1' } } as Session;

  beforeEach(() => {
    auth.initialize.mockReset().mockResolvedValue({ error: null });
    auth.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null });
    auth.onAuthStateChange.mockReset().mockImplementation(callback => {
      listener = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    TestBed.configureTestingModule({});
  });
  afterEach(() => window.history.replaceState(null, '', '/'));

  it.each(['/reset-password', '/', '/decisions', '/auth'])(
    'waits for the deferred recovery event when the callback lands on %s',
    async path => {
      window.history.replaceState(null, '', `${path}#type=recovery&access_token=fixture`);
      const service = TestBed.inject(AuthService);
      listener('INITIAL_SESSION', session);
      await Promise.resolve();
      expect(service.initialized()).toBe(false);
      expect(service.isRecoverySession()).toBe(false);

      listener('PASSWORD_RECOVERY', session);
      await service.recoveryCallbackReady;

      expect(service.initialized()).toBe(true);
      expect(service.isRecoverySession()).toBe(true);
      expect(window.location.pathname).toBe('/reset-password');
      expect(window.location.hash).toBe('');
    },
  );

  it('does not treat a normal sign-in callback as recovery', async () => {
    window.history.replaceState(null, '', '/decisions#type=signup&access_token=fixture');
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    const service = TestBed.inject(AuthService);
    await Promise.resolve();
    expect(service.recoveryCallbackReady).toBeUndefined();
    expect(service.isRecoverySession()).toBe(false);
    expect(service.user()).toBe(session.user);
    expect(window.location.pathname).toBe('/decisions');
  });

  it('rejects an expired recovery callback on the workspace even with a restored session', async () => {
    window.history.replaceState(null, '', '/decisions#type=recovery&error_code=otp_expired');
    auth.initialize.mockResolvedValue({ error: new Error('Expired') });
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    const service = TestBed.inject(AuthService);
    await service.recoveryCallbackReady;
    expect(service.user()).toBe(session.user);
    expect(service.isRecoverySession()).toBe(false);
    expect(window.location.pathname).toBe('/reset-password');
    expect(window.location.hash).toBe('');
    await expect(service.updatePassword('unused-password')).rejects.toThrow('No active recovery session.');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('requests a recovery email with the current web origin and reset route', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const service = TestBed.inject(AuthService);
    await service.resetPassword('developer@example.com');
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('developer@example.com', {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  });

  it('reports a recoverable network failure without treating it as an expired link', async () => {
    window.history.replaceState(null, '', '/reset-password#type=recovery&access_token=fixture');
    const error = new Error('Transport failure');
    error.name = 'AuthRetryableFetchError';
    auth.initialize.mockResolvedValue({ error });
    const service = TestBed.inject(AuthService);
    await service.recoveryCallbackReady;
    expect(service.recoveryLinkError()).toContain('Check your connection');
    expect(service.isRecoverySession()).toBe(false);
    expect(window.location.hash).toBe('');
  });

  it('keeps recovery active through the password update and ends only the current session', async () => {
    auth.updateUser.mockResolvedValue({ data: {}, error: null });
    const service = TestBed.inject(AuthService);
    await Promise.resolve();
    listener('PASSWORD_RECOVERY', session);
    await service.updatePassword('unused-password');
    expect(service.isRecoverySession()).toBe(true);

    auth.signOut.mockImplementation(async () => {
      expect(service.isCleaningUpRecovery()).toBe(true);
      listener('SIGNED_OUT', null);
      return { error: null };
    });
    await service.endRecovery();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(service.isRecoverySession()).toBe(false);
    expect(service.isCleaningUpRecovery()).toBe(false);
  });

  it('waits for restoration and restores the session and user', async () => {
    let resolve!: (result: unknown) => void;
    auth.getSession.mockReturnValue(new Promise(done => { resolve = done; }));
    const service = TestBed.inject(AuthService);
    expect(service.initialized()).toBe(false);
    expect(service.initializationError()).toBeNull();
    expect(auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    resolve({ data: { session }, error: null });
    await Promise.resolve();
    expect(service.initialized()).toBe(true);
    expect(service.session()).toBe(session);
    expect(service.user()).toBe(session.user);
    expect(service.accessToken).toBe('test-token');
  });

  it('treats a successful empty session as signed out, without an error', async () => {
    const service = TestBed.inject(AuthService);
    await Promise.resolve();
    expect(service.initialized()).toBe(true);
    expect(service.session()).toBeNull();
    expect(service.user()).toBeNull();
    expect(service.initializationError()).toBeNull();
  });

  it.each(['returned', 'rejected'])('contains a %s error and keeps later auth updates working', async failure => {
    const error = new Error('Sensitive internal error');
    if (failure === 'returned') auth.getSession.mockResolvedValue({ data: { session }, error });
    else auth.getSession.mockRejectedValue(error);
    const service = TestBed.inject(AuthService);
    await Promise.resolve();
    expect(service.initialized()).toBe(true);
    expect(service.session()).toBeNull();
    expect(service.user()).toBeNull();
    expect(service.initializationError()).toBe('Unable to restore your session. Reload and try again.');
    expect(auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    listener('SIGNED_IN', session);
    expect(service.session()).toBe(session);
    expect(service.initializationError()).toBeNull();
    expect(service.user()).toBe(session.user);
    listener('SIGNED_OUT', null);
    expect(service.accessToken).toBeNull();
    expect(service.user()).toBeNull();
  });

  it('contains synchronous listener-registration errors and finishes initialization', () => {
    auth.onAuthStateChange.mockImplementation(() => { throw new Error('Registration failed'); });
    const service = TestBed.inject(AuthService);
    expect(service.initialized()).toBe(true);
    expect(service.initializationError()).toBeTruthy();
    expect(service.session()).toBeNull();
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it('emits identity changes synchronously but preserves same-user token refreshes', async () => {
    const service = TestBed.inject(AuthService);
    await Promise.resolve();
    const identities: (string | null)[] = [];
    const subscription = service.identityChanges.subscribe(id => identities.push(id));
    listener('SIGNED_IN', session);
    listener('TOKEN_REFRESHED', { ...session, access_token: 'new-token' });
    listener('SIGNED_IN', { ...session, user: { ...session.user, id: 'user-2' } });
    listener('SIGNED_OUT', null);
    listener('SIGNED_IN', session);
    expect(identities).toEqual([null, 'user-1', 'user-2', null, 'user-1']);
    subscription.unsubscribe();
  });

  it('publishes recovery before an identity change and clears it on a later account switch', async () => {
    const service = TestBed.inject(AuthService);
    await Promise.resolve();
    const otherSession = { ...session, user: { ...session.user, id: 'user-2' } };
    listener('SIGNED_IN', session);

    const recoveryStates: boolean[] = [];
    const subscription = service.identityChanges.subscribe(() => {
      recoveryStates.push(service.isRecoverySession());
    });
    listener('PASSWORD_RECOVERY', otherSession);
    listener('TOKEN_REFRESHED', { ...otherSession, access_token: 'new-token' });
    expect(service.isRecoverySession()).toBe(true);
    listener('SIGNED_IN', session);

    expect(recoveryStates).toEqual([false, true, false]);
    subscription.unsubscribe();
  });

  it.each(['success', 'error'])('does not let stale initialization %s overwrite a newer sign-in', async outcome => {
    let resolve!: (result: unknown) => void;
    let reject!: (error: unknown) => void;
    auth.getSession.mockReturnValue(new Promise((done, fail) => { resolve = done; reject = fail; }));
    const service = TestBed.inject(AuthService);
    listener('SIGNED_IN', session);
    if (outcome === 'success') resolve({ data: { session: null }, error: null });
    else reject(new Error('Old restoration failed'));
    await Promise.resolve();
    expect(service.session()).toBe(session);
    expect(service.initializationError()).toBeNull();
    expect(service.initialized()).toBe(true);
  });
});
