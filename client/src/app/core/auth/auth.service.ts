import {
  Injectable,
  signal,
} from '@angular/core';

import {
  AuthChangeEvent,
  Session,
  User,
  createClient,
} from '@supabase/supabase-js';

import {
  environment,
} from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private readonly supabase =
    createClient(
      environment.supabaseUrl,
      environment.supabaseKey,
    );


  readonly session =
    signal<Session | null>(null);

  readonly user =
    signal<User | null>(null);

  readonly initialized =
    signal(false);


  constructor() {
    this.initializeAuth();
  }


  private async initializeAuth(): Promise<void> {

    const {
      data: { session },
    } =
      await this.supabase.auth.getSession();

    this.setSession(session);

    this.supabase.auth.onAuthStateChange(
      (
        _event: AuthChangeEvent,
        session: Session | null,
      ) => {
        this.setSession(session);
      },
    );

    this.initialized.set(true);
  }


  private setSession(
    session: Session | null,
  ): void {

    this.session.set(session);

    this.user.set(
      session?.user ?? null,
    );
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
    await this.supabase.auth.signOut();
  }


  get accessToken(): string | null {
    return (
      this.session()?.access_token ??
      null
    );
  }
}