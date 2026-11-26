import { MobileAccountHeader } from '../../../../layout/app-layout/mobile-account-header';
import { Component, inject, signal } from '@angular/core';
import { DecisionApi } from '../../../decisions/services/decision-api';
import { Decision } from '../../../decisions/models/decision';
import { finalize } from 'rxjs';
import { RouterLink } from '@angular/router';

import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonRow,
} from '@ionic/angular';

import { addIcons } from 'ionicons';

import {
  addOutline,
  arrowForwardOutline,
  layersOutline,
  bagHandleOutline,
  refreshOutline,
} from 'ionicons/icons';

addIcons({
  addOutline,
  arrowForwardOutline,
  layersOutline,
  bagHandleOutline,
  refreshOutline,
});

@Component({
  imports: [
    MobileAccountHeader,
    RouterLink,

    IonButton,
    IonCard,
    IonCardContent,
    IonCol,
    IonContent,
    IonGrid,
    IonIcon,
    IonRow,
  ],
  selector: 'app-decisions-page',
  templateUrl: './decisions-page.html',
  styleUrl: './decisions-page.scss',
})
export class DecisionsPage {

  ionViewWillEnter(): void {
    this.loadDecisions();
  }

  private readonly decisionApi = inject(DecisionApi);

  readonly decisions = signal<Decision[]>([]);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);

  protected loadDecisions(): void {
    if (this.isLoading()) return;
    this.isLoading.set(true);
    this.loadError.set(null);

    this.decisionApi.getAllDecisions().pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (decisions) => {
        this.decisions.set(decisions);
      },
      error: (error) => {
        this.loadError.set('Failed to load decisions. Please try again later.');
        console.error('Failed to load decisions:', error);
      },
    });
  }
}





