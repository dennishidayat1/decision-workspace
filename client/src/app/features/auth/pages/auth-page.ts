import {
  Component,
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
  NavController,
} from '@ionic/angular';

import { AuthService } from '../../../core/auth/auth.service';

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

  readonly errorMessage =
    signal<string | null>(null);

  readonly successMessage =
    signal<string | null>(null);

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
    this.mode.update(mode =>
      mode === 'login'
        ? 'register'
        : 'login',
    );

    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  async submit(): Promise<void> {
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

    if (this.mode() === 'login') {
      const { error } =
        await this.authService.signIn(
          email.trim(),
          password,
        );

      this.submitting.set(false);

      if (error) {
        this.errorMessage.set(
          error.message,
        );

        return;
      }

      this.navController.navigateRoot(
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

    this.submitting.set(false);

    if (error) {
      this.errorMessage.set(
        error.message,
      );

      return;
    }

    if (data.session) {
      this.form.reset();

      this.navController.navigateRoot(
        '/decisions',
      );

      return;
    }

    this.form.reset();

    this.successMessage.set(
      'Sign up submitted. Check your email if confirmation is required.',
    );
  }
}