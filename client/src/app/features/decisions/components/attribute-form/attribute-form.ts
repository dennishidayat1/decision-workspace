import { Component, effect, input } from '@angular/core';
import {
  ReactiveFormsModule,
  FormArray,
  FormControl,
  FormGroup,
} from '@angular/forms';
import {
  IonButton,
  IonInput,
  IonGrid,
  IonRow,
  IonCol,
} from '@ionic/angular';
import { IonIcon } from '@ionic/angular';

import { addIcons } from 'ionicons';
import {
  addOutline,
  close,
} from 'ionicons/icons';

addIcons({
  addOutline,
  close,
});

export type AttributeFormGroup = FormGroup<{
  name: FormControl<string>;
  value: FormControl<string>;
}>;

@Component({
  imports: [
    ReactiveFormsModule,
    IonInput,
    IonButton,
    IonGrid,
    IonRow,
    IonCol,
    IonIcon
  ],
  selector: 'app-attribute-form',
  styleUrl: './attribute-form.scss',
  templateUrl: './attribute-form.html',
})

export class AttributeForm {
  readonly attributes = input.required<FormArray<AttributeFormGroup>>();
  readonly suggestedAttributeNames = input<readonly string[]>([]);

  addAttribute(name = ''): void {
    this.attributes().push(
      new FormGroup({
        name: new FormControl(name, { nonNullable: true }),
        value: new FormControl('', { nonNullable: true }),
      }),
    );
  }

  removeAttribute(index: number): void {
    this.attributes().removeAt(index);
  }

private readonly populateSuggestedAttributes = effect(() => {
  const suggestions = this.suggestedAttributeNames();
  const attributes = this.attributes();

  const existingNames = new Set(
    attributes.controls.map((attribute) =>
      attribute.controls.name.value.trim().toLowerCase(),
    ),
  );

  for (const name of suggestions) {
    const normalizedName = name.trim().toLowerCase();

    if (!normalizedName || existingNames.has(normalizedName)) {
      continue;
    }

    this.addAttribute(name.trim());

    existingNames.add(normalizedName);
  }
});
}
