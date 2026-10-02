import { Component, effect, input } from '@angular/core';
import {
  ReactiveFormsModule,
  FormArray,
  FormControl,
  FormGroup,
} from '@angular/forms';
import { IonButton, IonInput } from '@ionic/angular';

export type AttributeFormGroup = FormGroup<{
  name: FormControl<string>;
  value: FormControl<string>;
}>;

@Component({
  imports: [
    ReactiveFormsModule,
    IonInput,
    IonButton
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
      if (!existingNames.has(name.trim().toLowerCase())) {
        this.addAttribute(name);
      }
    }
  });
}
