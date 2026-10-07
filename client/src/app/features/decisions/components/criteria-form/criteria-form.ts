import {
  Component,
  input,
  signal,
} from '@angular/core';

import {
  FormArray,
  ReactiveFormsModule,
} from '@angular/forms';

import {
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonRange,
  IonTextarea,
} from '@ionic/angular';

import {
  addOutline,
  trashOutline,
} from 'ionicons/icons';

import {
  addIcons,
} from 'ionicons';

import {
  createCriterionDraftForm,
  CriterionDraftFormGroup,
} from '../../forms/decision-form';


addIcons({
  addOutline,
  trashOutline,
});


@Component({
  selector: 'app-criteria-form',
  imports: [
    ReactiveFormsModule,

    IonAccordion,
    IonAccordionGroup,
    IonButton,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonRange,
    IonTextarea,
  ],
  templateUrl: './criteria-form.html',
  styleUrl: './criteria-form.scss',
})
export class CriteriaForm {
  readonly criteria = input.required<FormArray<CriterionDraftFormGroup>>();
  readonly expandedAccordionValue = signal<string | null>(null);


  addCriterion(): void {
    if (this.hasIncompleteCriterion()) {
      return;
    }

    const criterion =
      createCriterionDraftForm();

    this.criteria().push(criterion);

    const newIndex =
      this.criteria().length - 1;

    this.expandedAccordionValue.set(
      newIndex.toString(),
    );
  }


  removeCriterion(
    criterion: CriterionDraftFormGroup,
  ): void {
    const index =
      this.criteria().controls.indexOf(criterion);

    if (index === -1) {
      return;
    }

    this.criteria().removeAt(index);

    this.expandedAccordionValue.set(null);
  }


  finishCriterion(
    criterion: CriterionDraftFormGroup,
  ): void {
    if (!criterion.controls.name.value.trim()) {
      criterion.controls.name.markAsTouched();
      return;
    }

    this.expandedAccordionValue.set(null);
  }


  onAccordionChange(
    value: unknown,
  ): void {
    const next =
      Array.isArray(value)
        ? value[0]
        : value;

    this.expandedAccordionValue.set(
      typeof next === 'string'
        ? next
        : null,
    );
  }


  hasIncompleteCriterion(): boolean {
    return this.criteria().controls.some(
      (criterion) =>
        !criterion.controls.name.value.trim(),
    );
  }
}