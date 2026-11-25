import {
  Injectable,
  signal,
} from '@angular/core';

import {
  AuthChangeEvent,
  Session,
  User,
  createClient,
  isAuthRetryableFetchError,
} from '@supabase/supabase-js';

import {
  environment,
} from '../../../environments/environment';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private readonly supabase =
    createClient(
      environment.supabaseUrl,
      environment.supabaseKey,
    );


  readonly session = signal<Session | null>(null);
  readonly isRecoverySession = signal(false);
  readonly recoveryLinkError = signal<string | null>(null);
  private readonly cleaningUpRecovery = signal(false);
  readonly isCleaningUpRecovery = this.cleaningUpRecovery.asReadonly();
  readonly recoveryCallbackReady: Promise<void> | undefined;

  readonly user = signal<User | null>(null);

  readonly initialized = signal(false);
  readonly initializationError = signal<string | null>(null);
  private readonly identitySubject = new BehaviorSubject<string | null>(null);
  readonly identityChanges = this.identitySubject.asObservable();


  constructor() {
    const url = new URL(window.location.href);
    const parameters = new URLSearchParams(url.hash.slice(1));
    url.searchParams.forEach((value, key) => parameters.set(key, value));
    const isRecoveryRedirect = parameters.get('type') === 'recovery';
    const isRecoveryCallback = isRecoveryRedirect || (
      url.pathname === '/reset-password' &&
      ['access_token', 'code', 'error', 'error_code', 'error_description', 'type']
        .some(key => parameters.has(key))
    );
    const initialization = this.initializeAuth(
      isRecoveryCallback,
      isRecoveryRedirect && Boolean(parameters.get('access_token')),
    );
    if (isRecoveryCallback) this.recoveryCallbackReady = initialization;
  }


  private async initializeAuth(isRecoveryCallback: boolean, expectsRecoveryEvent: boolean): Promise<void> {

    this.initializationError.set(null);
    let authEventVersion = 0;
    let restoreVersion = -1;
    let recoveryReceived: () => void;
    const recoveryEvent = new Promise<void>(resolve => { recoveryReceived = resolve; });

    try {

      this.supabase.auth.onAuthStateChange(
        (
          event: AuthChangeEvent,
          session: Session | null,
        ) => {
          authEventVersion++;
          const previousUserId = this.user()?.id ?? null;

          if (event === 'PASSWORD_RECOVERY' && session) {
            this.isRecoverySession.set(true);
          } else if (event === 'SIGNED_OUT' || !session || previousUserId !== session.user.id) {
            this.isRecoverySession.set(false);
          }

          // Identity subscribers need the recovery state for the incoming session.
          this.setSession(session);
          if (event === 'PASSWORD_RECOVERY' && session) recoveryReceived();
        },
      );

      if (isRecoveryCallback) {
        const { error } = await this.supabase.auth.initialize();
        if (error && isAuthRetryableFetchError(error)) {
          this.recoveryLinkError.set('Unable to verify the reset link. Check your connection, then request a new link.');
        }
        // Supabase announces a successful implicit recovery after initialization resolves.
        if (!error && expectsRecoveryEvent) {
          await recoveryEvent;
          return;
        }
      }

      restoreVersion = authEventVersion;
      const {
        data: { session },
        error,
      } = await this.supabase.auth.getSession();

      // An auth event received while restoring is newer than this snapshot.
      if (restoreVersion !== authEventVersion) return;

      if (error) {
        throw error;
      }

      this.setSession(session);
    } catch {
      if (restoreVersion >= 0 && restoreVersion !== authEventVersion) return;
      this.setSession(null);
      this.initializationError.set(
        'Unable to restore your session. Reload and try again.'
      );
    } finally {
      if (isRecoveryCallback) {
        // Put recovery on its public route before Angular starts initial navigation.
        window.history.replaceState(window.history.state, '', '/reset-password');
      }
      this.initialized.set(true);
    }
  }


  private setSession(
    session: Session | null,
  ): void {

    this.session.set(session);
    if (session) this.initializationError.set(null);

    this.user.set(
      session?.user ?? null,
    );
    const userId = session?.user.id ?? null;
    if (this.identitySubject.value !== userId) this.identitySubject.next(userId);
  }


  async signIn(
    email: string,
    password: string,
  ) {

    return this.supabase.auth
      .signInWithPassword({
        email,
        password,
      });
  }


  async signUp(
    email: string,
    password: string,
  ) {

    return this.supabase.auth
      .signUp({
        email,
        password,
      });
  }


  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }

  async endRecovery(): Promise<void> {
    if (!this.isRecoverySession()) return;

    this.cleaningUpRecovery.set(true);
    try {
      const { error } = await this.supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } finally {
      this.cleaningUpRecovery.set(false);
    }
  }


  get accessToken(): string | null {
    return (
      this.session()?.access_token ??
      null
    );
  }

  async resetPassword(email: string) {
    const { data, error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });

    if (error) {
      throw error;
    }

    return data
  }

  async updatePassword(newPassword: string) {
    if (!this.isRecoverySession()) throw new Error('No active recovery session.');

    const { data, error } = await this.supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      throw error;
    }

    return data
  }
}
