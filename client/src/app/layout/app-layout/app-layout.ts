import {
  Component,
  inject,
} from '@angular/core';

import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonMenu,
  IonMenuButton,
  IonPopover,
  IonRouterOutlet,
  IonToolbar,
  MenuController,
  PopoverController,
  ToastController,
} from '@ionic/angular';

import {
  logOutOutline,
} from 'ionicons/icons';

import {
  AuthService,
} from '../../core/auth/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonMenu,
    IonMenuButton,
    IonPopover,
    IonRouterOutlet,
    IonToolbar,
  ],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.scss',
})
export class AppLayout {
  private readonly authService = inject(AuthService);
  private readonly menuController = inject(MenuController);
  private readonly popoverController = inject(PopoverController);
  private readonly toastController = inject(ToastController);

  readonly logOutOutline = logOutOutline;

  get userEmail(): string {
    return (
      this.authService.user()?.email ??
      'Signed in'
    );
  }

  get userInitial(): string {
    const email =
      this.authService.user()?.email;

    return email
      ? email.charAt(0).toUpperCase()
      : '?';
  }

  async signOut(): Promise<void> {
    await this.menuController.close(
      'account-menu',
    );

    const popover =
      await this.popoverController.getTop();

    if (popover) {
      await popover.dismiss();
    }

    try {
      await this.authService.signOut();
    } catch {
      const toast = await this.toastController.create({
        message: 'Unable to sign out. Please try again.',
        duration: 2500,
        position: 'bottom',
      });
      await toast.present();
    }
  }
}
