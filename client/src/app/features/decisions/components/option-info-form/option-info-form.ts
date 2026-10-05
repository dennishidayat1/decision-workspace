import {
  Component,
  input,
  signal,
} from '@angular/core';

import {
  FormControl,
  ReactiveFormsModule,
} from '@angular/forms';

import {
  IonButton,
  IonCol,
  IonGrid,
  IonIcon,
  IonInput,
  IonLabel,
  IonNote,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTextarea,
} from '@ionic/angular';

import { addIcons } from 'ionicons';
import {
  addOutline,
  chevronDownOutline,
  imageOutline,
} from 'ionicons/icons';

type OptionInfoControls = {
  title: FormControl<string>;
  url: FormControl<string>;
  thumbnailUrl: FormControl<string>;
  description: FormControl<string>;
  price: FormControl<number | null>;
  currency: FormControl<string>;
};

addIcons({
  addOutline,
  chevronDownOutline,
  imageOutline,
});

@Component({
  selector: 'app-option-info-form',

  imports: [
    ReactiveFormsModule,

    IonButton,
    IonCol,
    IonGrid,
    IonIcon,
    IonInput,
    IonLabel,
    IonNote,
    IonRow,
    IonSelect,
    IonSelectOption,
    IonText,
    IonTextarea,
  ],

  templateUrl: './option-info-form.html',
  styleUrl: './option-info-form.scss',
})
export class OptionInfoForm {
  readonly controls =
    input.required<OptionInfoControls>();

  readonly showExtraDetails = signal(false);

  toggleExtraDetails(): void {
    this.showExtraDetails.update(
      (current) => !current,
    );
  }
}