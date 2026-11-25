import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NavController } from '@ionic/angular';
import { AuthService } from '../../../../core/auth/auth.service';
import { ResetPassword } from './reset-password';

describe('ResetPassword', () => {
  let component: ResetPassword;
  let fixture: ComponentFixture<ResetPassword>;
  let isRecoverySession: ReturnType<typeof signal<boolean>>;
  let updatePassword: ReturnType<typeof vi.fn>;
  let endRecovery: ReturnType<typeof vi.fn>;
  let navigateRoot: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    isRecoverySession = signal(false);
    updatePassword = vi.fn().mockResolvedValue(undefined);
    endRecovery = vi.fn().mockImplementation(async () => { isRecoverySession.set(false); });
    navigateRoot = vi.fn().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [ResetPassword],
      providers: [
        { provide: AuthService, useValue: {
          initialized: signal(true),
          isRecoverySession,
          recoveryLinkError: signal(null),
          updatePassword,
          endRecovery,
        } },
        { provide: NavController, useValue: { navigateRoot } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPassword);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('offers a way back from an invalid link without signing out an unrelated session', async () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('invalid, expired, or already used');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    await component.goToLogin();
    expect(endRecovery).not.toHaveBeenCalled();
    expect(navigateRoot).toHaveBeenCalledExactlyOnceWith('/auth');
  });

  it('validates confirmation before updating and keeps success visible after cleanup', async () => {
    isRecoverySession.set(true);
    component.form.setValue({ newPassword: 'valid-password', confirmPassword: 'different-password' });
    await component.submit();
    expect(updatePassword).not.toHaveBeenCalled();
    expect(component.form.controls.confirmPassword.touched).toBe(true);

    component.form.controls.confirmPassword.setValue('valid-password');
    await Promise.all([component.submit(), component.submit()]);
    expect(updatePassword).toHaveBeenCalledExactlyOnceWith('valid-password');
    expect(endRecovery).toHaveBeenCalledOnce();
    expect(navigateRoot).not.toHaveBeenCalled();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Password updated.');

    await component.goToLogin();
    expect(endRecovery).toHaveBeenCalledOnce();
    expect(navigateRoot).toHaveBeenCalledExactlyOnceWith('/auth');
  });

  it('lets Back to Login retry cleanup after a successful password update', async () => {
    endRecovery.mockRejectedValueOnce(new Error('Cleanup failed'));
    isRecoverySession.set(true);
    component.form.setValue({ newPassword: 'valid-password', confirmPassword: 'valid-password' });
    await component.submit();
    expect(component.successMsg()).toContain('Password updated.');
    expect(component.errorMsg()).toContain('retry ending the recovery session');
    await component.goToLogin();
    expect(endRecovery).toHaveBeenCalledTimes(2);
    expect(updatePassword).toHaveBeenCalledOnce();
    expect(navigateRoot).toHaveBeenCalledExactlyOnceWith('/auth');
  });
});
