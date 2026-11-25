import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../../../core/auth/auth.service';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonButton,
  IonContent,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonLabel,
  IonSpinner,
  IonText,
  NavController,
} from '@ionic/angular';

@Component({
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonContent,
    IonInput,
    IonInputPasswordToggle,
    IonItem,
    IonLabel,
    IonSpinner,
    IonText,
  ],
  selector: 'app-reset-password',
  styleUrls: ['../auth-page/auth-page.scss', './reset-password.scss'],
  templateUrl: './reset-password.html',
})
export class ResetPassword {
  private readonly authService = inject(AuthService);
  private readonly navController = inject(NavController);

  readonly initialized = this.authService.initialized;
  readonly isRecoverySession = this.authService.isRecoverySession;
  readonly recoveryLinkError = this.authService.recoveryLinkError;
  readonly isLoading = signal(false);
  readonly successMsg = signal('');
  readonly errorMsg = signal('');

  readonly form = new FormGroup({
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.minLength(8),
        Validators.maxLength(32),
        Validators.required,
      ],
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
      ],
    }),
  }, (control: AbstractControl) => {
    const newPassword = control.get('newPassword')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    return newPassword !== confirmPassword ? { passwordMismatch: true } : null;
  });

  async submit(): Promise<void> {
    if (!this.isRecoverySession() || this.isLoading() || this.successMsg()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    this.errorMsg.set('');

    try {
      await this.authService.updatePassword(this.form.controls.newPassword.value);
      this.form.reset();
      this.successMsg.set('Password updated. Sign in with your new password.');
      try {
        await this.authService.endRecovery();
      } catch {
        this.errorMsg.set('Your password was saved. Select Back to Login to retry ending the recovery session.');
      }
    } catch {
      this.errorMsg.set('Unable to update your password. Try a different password or request a new reset link.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async goToLogin(): Promise<void> {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    this.errorMsg.set('');
    try {
      if (this.isRecoverySession()) await this.authService.endRecovery();
      const navigated = await this.navController.navigateRoot('/auth');
      if (!navigated) this.errorMsg.set('Unable to return to login. Please try again.');
    } catch {
      this.errorMsg.set('Unable to return to login. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
