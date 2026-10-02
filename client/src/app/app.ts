import { Component, signal } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';

@Component({
  imports: [IonApp, IonRouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('decision-workspace-web');
}
