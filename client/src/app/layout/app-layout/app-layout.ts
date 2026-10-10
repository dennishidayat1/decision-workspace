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
  IonPopover,
  IonRouterOutlet,
  IonToolbar,
  MenuController,
  NavController,
  PopoverController,
} from '@ionic/angular';

import {
  layersOutline,
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
    IonPopover,
    IonRouterOutlet,
    IonToolbar,
  ],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.scss',
})
export class AppLayout {
  private readonly authService =
    inject(AuthService);

  private readonly navController =
    inject(NavController);

  private readonly menuController =
    inject(MenuController);

  private readonly popoverController =
    inject(PopoverController);

  readonly layersOutline =
    layersOutline;

  readonly logOutOutline =
    logOutOutline;

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

    await this.authService.signOut();

    this.navController.navigateRoot(
      '/auth',
    );
  }
}