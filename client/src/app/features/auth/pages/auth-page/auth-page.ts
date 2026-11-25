import {
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import {
  IonButton,
  IonContent,
  IonInput,
  IonText,
  IonItem,
  IonLabel,
  IonSpinner,
  NavController,
} from '@ionic/angular';

import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-auth-page',
  standalone: true,

  imports: [
    ReactiveFormsModule,
    IonContent,
    IonInput,
    IonButton,
    IonText,
    IonItem,
    IonLabel,
    IonSpinner,
  ],

  templateUrl: './auth-page.html',
  styleUrl: './auth-page.scss',
})
export class AuthPage {
  private readonly authService =
    inject(AuthService);

  private readonly navController =
    inject(NavController);

  readonly mode =
    signal<'login' | 'register'>('login');

  readonly submitting =
    signal(false);
  readonly initializationError = this.authService.initializationError;

  readonly errorMessage =
    signal<string | null>(null);

  readonly successMessage =
    signal<string | null>(null);

  readonly requestingReset = signal(false);
  readonly busy = computed(() => this.submitting() || this.requestingReset());

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.email,
      ],
    }),

    password: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(6),
      ],
    }),
  });

  switchMode(): void {
    if (this.busy()) return;
    this.mode.update(mode =>
      mode === 'login'
        ? 'register'
        : 'login',
    );

    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const {
      email,
      password,
    } = this.form.getRawValue();

    try {
      if (this.mode() === 'login') {
        const { error } =
          await this.authService.signIn(
            email.trim(),
            password,
          );

        if (error) {
          this.errorMessage.set(
            error.message,
          );

          return;
        }

        await this.navController.navigateRoot(
          '/decisions',
        );

        return;
      }

      const {
        data,
        error,
      } =
        await this.authService.signUp(
          email.trim(),
          password,
        );

      if (error) {
        this.errorMessage.set(
          error.message,
        );

        return;
      }

      if (data.session) {
        this.form.reset();

        await this.navController.navigateRoot(
          '/decisions',
        );

        return;
      }

      this.form.reset();

      this.successMessage.set(
        'Sign up submitted. Check your email if confirmation is required.',
      );
    } catch {
      this.errorMessage.set('Unable to complete your request. Check your connection and try again.');
    } finally {
      this.submitting.set(false);
    }
  }

  async resetPasswordForEmail(): Promise<void> {
    if (this.busy() || this.mode() !== 'login') return;

    const email = this.form.controls.email;
    this.errorMessage.set(null);
    this.successMessage.set(null);
    if (email.invalid) {
      email.markAsTouched();
      this.errorMessage.set('Enter a valid email address to receive a password reset link.');
      return;
    }

    this.requestingReset.set(true);

    try {
      await this.authService.resetPassword(email.value.trim());
      this.successMessage.set("If an account exists for this email, you'll receive a password reset link.");
    } catch {
      this.errorMessage.set('Unable to send a password reset email. Please try again in a moment.');
    } finally {
      this.requestingReset.set(false);
    }
  }
}
