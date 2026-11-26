import { Component } from '@angular/core';
import { IonButtons, IonHeader, IonMenuButton, IonToolbar } from '@ionic/angular';

@Component({
  selector: 'app-mobile-account-header',
  imports: [IonButtons, IonHeader, IonMenuButton, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="end">
          <ion-menu-button menu="account-menu" [autoHide]="false" aria-label="Open account menu" />
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
  `,
  styles: `
    :host { display: block; }
    ion-toolbar {
      --background: #fff;
      --border-color: #e1e7e3;
      --min-height: 56px;
      --padding-end: 20px;
    }
    ion-menu-button { min-height: 44px; }
    @media (min-width: 992px) {
      :host { display: none; }
    }
  `,
})
export class MobileAccountHeader {}
