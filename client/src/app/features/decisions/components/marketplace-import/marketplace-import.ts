import {
  Component,
  inject,
  output,
  signal,
} from '@angular/core';
import {
  FormControl,
  ReactiveFormsModule,
} from '@angular/forms';

import {
  IonButton,
  IonIcon,
  IonInput,
  IonModal,
  IonSpinner,
  IonText,
  IonNote,
} from '@ionic/angular';

import {
  closeOutline,
  bagHandleOutline,
  imageOutline,
  openOutline,
} from 'ionicons/icons';

import { addIcons } from 'ionicons';

import { DecisionApi } from '../../services/decision-api';
import { MarketplaceLinkPreviewResponse } from '../../models/marketplace-link-preview-response';

addIcons({
  closeOutline,
  bagHandleOutline,
  imageOutline,
  openOutline,
});

@Component({
  selector: 'app-marketplace-import-form',
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonIcon,
    IonInput,
    IonModal,
    IonSpinner,
    IonText,
    IonNote,
  ],
  templateUrl: './marketplace-import.html',
  styleUrl: './marketplace-import.scss',
})
export class MarketplaceImportForm {
  private readonly decisionApi = inject(DecisionApi);

  readonly productSelected = output<MarketplaceLinkPreviewResponse>();

  readonly isOpen = signal(false);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly preview = signal<MarketplaceLinkPreviewResponse | null>(null);

  readonly urlControl = new FormControl('', {nonNullable: true });

  retry(): void {
    this.error.set(null);
    this.preview.set(null);
  }

  open(): void {
    this.error.set(null);
    this.preview.set(null);
    this.urlControl.setValue('');
    this.isOpen.set(true);
  }

  close(): void {
    if (this.isLoading()) {
      return;
    }

    this.isOpen.set(false);
    this.reset();
  }

  previewLink(): void {
    const url = this.urlControl.value.trim();

    if (!url) {
      this.error.set(
        'Paste a Shopee or Tokopedia product link.',
      );
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);
    this.preview.set(null);

    this.decisionApi
      .previewMarketplaceLink({ url })
      .subscribe({
        next: (preview) => {
          this.preview.set(preview);
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error(
            'Failed to preview marketplace link:',
            error,
          );

          this.error.set(
            'We couldn’t import this product. Check the link and try again.',
          );

          this.isLoading.set(false);
        },
      });
  }

  useProduct(): void {
    const preview = this.preview();

    if (!preview) {
      return;
    }

    this.productSelected.emit(preview);
    this.isOpen.set(false);
    this.reset();
  }

  private reset(): void {
    this.error.set(null);
    this.preview.set(null);
    this.urlControl.setValue('');
  }
}