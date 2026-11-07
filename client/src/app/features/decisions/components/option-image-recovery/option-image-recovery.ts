import { Component, effect, inject, input, output, untracked } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { refreshOutline } from 'ionicons/icons';
import { DecisionOption } from '../../models/decision-option';
import { DecisionApi } from '../../services/decision-api';
import { OptionImageRecovery } from '../../services/option-image-recovery';

addIcons({ refreshOutline });

@Component({
  selector: 'app-option-image-recovery',
  imports: [IonButton, IonIcon],
  template: `
    @if (recovery.failed(option())) {
      <ion-button type="button" fill="solid" size="small" shape="round"
        aria-label="Retry marketplace image recovery"
        [title]="recovery.message(option()) || 'Refresh image from marketplace'"
        [disabled]="blocked() || recovery.pending(option())"
        (keydown.enter)="$event.stopPropagation()" (click)="retry($event)">
        <ion-icon slot="icon-only" name="refresh-outline" />
      </ion-button>
    }
  `,
  styles: `
    :host { position: absolute; inset: 0; display: flex; align-items: center;
      justify-content: center; pointer-events: none; }
    ion-button { pointer-events: auto; }
  `,
})
export class OptionImageRecoveryControl {
  readonly option = input.required<DecisionOption>();
  readonly blocked = input(false);
  readonly confirmationRequested = output<void>();
  protected readonly recovery = inject(OptionImageRecovery);
  private readonly api = inject(DecisionApi);

  private readonly automatic = effect(() => {
    const option = this.option();
    const blocked = this.blocked();
    this.api.getOptionImageUrl(option); // Track image-loading failures and fallback selection.
    this.recovery.lifecycle();
    if (!blocked) untracked(() => this.recovery.tryAutomatic(option));
  });

  retry(event: Event): void {
    event.stopPropagation();
    if (this.blocked() || this.recovery.pending(this.option())) return;
    if (this.recovery.needsConfirmation(this.option())) {
      this.confirmationRequested.emit();
      return;
    }
    this.recovery.refresh(this.option()).subscribe({ error: () => {} });
  }
}
