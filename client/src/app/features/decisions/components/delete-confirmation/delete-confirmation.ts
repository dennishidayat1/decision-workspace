import { Component, input, output } from '@angular/core';
import { IonButton, IonIcon, IonModal } from '@ionic/angular';
import { closeOutline } from 'ionicons/icons';

@Component({
  selector: 'app-delete-confirmation',
  imports: [IonButton, IonIcon, IonModal],
  templateUrl: './delete-confirmation.html',
  styleUrl: './delete-confirmation.scss',
})
export class DeleteConfirmation {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly action = input.required<string>();
  readonly busy = input(false);
  readonly error = input('');
  readonly dismissed = output();
  readonly confirmed = output();
  protected readonly closeOutline = closeOutline;
}
