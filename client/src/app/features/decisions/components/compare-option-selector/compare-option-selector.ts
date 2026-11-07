import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  effect
} from '@angular/core';

import {
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';

import { DecisionOption } from '../../models/decision-option';

@Component({
  selector: 'app-compare-option-selector',
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonCheckbox,
    IonLabel,
    IonNote,
  ],
  templateUrl: './compare-option-selector.html',
  styleUrl: './compare-option-selector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareOptionSelector {

  readonly options = input.required<DecisionOption[]>();
  
  constructor() {
    effect(() => {
      this.selectedIds.set(
        this.initialSelectedIds().slice(0, 4),
      );
    });
  }

  readonly initialSelectedIds = input<string[]>([]);
  readonly confirmSelection = output<string[]>();
  readonly dismissRequested = output<void>();
  readonly searchTerm = signal('');
  readonly selectedIds = signal<string[]>([]);

  readonly filteredOptions = computed(() => {
    const term =
      this.searchTerm()
        .trim()
        .toLowerCase();

    if (!term) {
      return this.options();
    }

    return this.options().filter(option =>
      option.title
        .toLowerCase()
        .includes(term),
    );
  });

  readonly canCompare = computed(() =>
    this.selectedIds().length >= 2,
  );

  readonly selectionCount = computed(() =>
    this.selectedIds().length,
  );

  toggleOption(optionId: string): void {
    const selected =
      this.selectedIds();

    if (selected.includes(optionId)) {
      this.selectedIds.set(
        selected.filter(
          id => id !== optionId,
        ),
      );

      return;
    }

    if (selected.length >= 4) {
      return;
    }

    this.selectedIds.set([
      ...selected,
      optionId,
    ]);
  }

  isSelected(optionId: string): boolean {
    return this.selectedIds()
      .includes(optionId);
  }

  submit(): void {
    if (!this.canCompare()) {
      return;
    }

    this.confirmSelection.emit(
      this.selectedIds(),
    );
  }

  close(): void {
    this.dismissRequested.emit();
  }
}