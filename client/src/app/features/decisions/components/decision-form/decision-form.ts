import {
  Component,
  input,
} from '@angular/core';

import {
  FormControl,
  ReactiveFormsModule,
} from '@angular/forms';

import {
  IonAccordion,
  IonAccordionGroup,
  IonInput,
  IonItem,
  IonLabel,
  IonTextarea,
} from '@ionic/angular';

@Component({
  selector: 'app-decision-form',
  imports: [
    ReactiveFormsModule,

    IonAccordion,
    IonAccordionGroup,
    IonInput,
    IonItem,
    IonLabel,
    IonTextarea,
  ],
  templateUrl: './decision-form.html',
  styleUrl: './decision-form.scss',
})
export class DecisionForm {
  readonly question =
    input.required<FormControl<string>>();

  readonly category =
    input.required<FormControl<string>>();

  readonly context =
    input.required<FormControl<string>>();
}