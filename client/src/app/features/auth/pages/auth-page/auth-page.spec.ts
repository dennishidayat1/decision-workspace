import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavController } from '@ionic/angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthPage } from './auth-page';

describe('AuthPage request handling', () => {
  let auth: {
    initializationError: ReturnType<typeof signal<string | null>>;
    signIn: ReturnType<typeof vi.fn>;
    signUp: ReturnType<typeof vi.fn>;
    resetPassword: ReturnType<typeof vi.fn>;
  };
  let navigateRoot: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    auth = {
      initializationError: signal<string | null>(null),
      signIn: vi.fn(),
      signUp: vi.fn(),
      resetPassword: vi.fn(),
    };
    navigateRoot = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({ imports: [AuthPage], providers: [
      { provide: AuthService, useValue: auth },
      { provide: NavController, useValue: { navigateRoot } },
    ] });
  });
  function create(mode: 'login' | 'register' = 'login') {
    const fixture = TestBed.createComponent(AuthPage);
    fixture.componentInstance.mode.set(mode);
    fixture.componentInstance.form.setValue({ email: 'developer@example.com', password: 'password123' });
    return fixture;
  }

  it('displays initialization failure and removes it when recovery clears the signal', () => {
    const fixture = create();
    auth.initializationError.set('Reload and try again.');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Reload and try again.');
    auth.initializationError.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it.each(['login', 'register'] as const)('handles rejected %s requests and permits retry', async mode => {
    const fixture = create(mode);
    const page = fixture.componentInstance;
    const request = mode === 'login' ? auth.signIn : auth.signUp;
    request.mockRejectedValueOnce(new Error('Internal details'));
    await page.submit();
    fixture.detectChanges();
    expect(page.submitting()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Check your connection');
    expect(page.form.controls.password.value).toBe('password123');
    expect(navigateRoot).not.toHaveBeenCalled();
    request.mockResolvedValue({ data: { session: {} }, error: null });
    await page.submit();
    expect(request).toHaveBeenCalledTimes(2);
    expect(page.submitting()).toBe(false);
    expect(page.errorMessage()).toBeNull();
    expect(navigateRoot).toHaveBeenCalledExactlyOnceWith('/decisions');
  });

  it.each(['login', 'register'] as const)('preserves returned %s errors without navigating', async mode => {
    const page = create(mode).componentInstance;
    (mode === 'login' ? auth.signIn : auth.signUp).mockResolvedValue({ data: { session: null }, error: { message: 'Request denied' } });
    await page.submit();
    expect(page.errorMessage()).toBe('Request denied');
    expect(page.submitting()).toBe(false);
    expect(navigateRoot).not.toHaveBeenCalled();
  });

  it('blocks duplicate submits and mode changes until the request settles', async () => {
    let resolve!: (result: unknown) => void;
    auth.signIn.mockReturnValue(new Promise(done => { resolve = done; }));
    const fixture = create();
    const page = fixture.componentInstance;
    const pending = page.submit();
    await page.submit();
    page.switchMode();
    fixture.detectChanges();
    expect(page.mode()).toBe('login');
    expect(auth.signIn).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('ion-button[type="submit"]').disabled).toBe(true);
    resolve({ error: null });
    await pending;
    expect(page.submitting()).toBe(false);
  });

  it('keeps registration confirmation behavior when no session is returned', async () => {
    const page = create('register').componentInstance;
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    await page.submit();
    expect(page.successMessage()).toContain('Check your email');
    expect(page.form.controls.password.value).toBe('');
    expect(navigateRoot).not.toHaveBeenCalled();
    expect(page.submitting()).toBe(false);
  });

  it('does not submit an invalid form', async () => {
    const page = create().componentInstance;
    page.form.controls.email.setValue('invalid');
    await page.submit();
    expect(page.form.controls.email.touched).toBe(true);
    expect(auth.signIn).not.toHaveBeenCalled();
    expect(page.submitting()).toBe(false);
  });

  it('requests a reset from the login button without a password or navigation', async () => {
    const fixture = create();
    const page = fixture.componentInstance;
    page.form.controls.password.setValue('');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.auth-action').click();
    await page.resetPasswordForEmail();
    expect(auth.resetPassword).toHaveBeenCalledExactlyOnceWith('developer@example.com');
    expect(page.successMessage()).toContain('If an account exists');
    expect(navigateRoot).not.toHaveBeenCalled();
  });

  it('validates the email and allows retry after a failed reset request', async () => {
    const page = create().componentInstance;
    page.form.controls.email.setValue('invalid');
    await page.resetPasswordForEmail();
    expect(page.errorMessage()).toContain('Enter a valid email');
    expect(auth.resetPassword).not.toHaveBeenCalled();
    page.form.controls.email.setValue('developer@example.com');
    auth.resetPassword.mockRejectedValueOnce(new Error('Request failed'));
    await page.resetPasswordForEmail();
    expect(page.errorMessage()).toContain('Unable to send');
    expect(page.requestingReset()).toBe(false);
    await page.resetPasswordForEmail();
    expect(page.successMessage()).toContain('receive a password reset link');
  });
});
