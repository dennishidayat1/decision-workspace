import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter } from '@angular/router';
import { SwUpdate, VersionEvent, UnrecoverableStateEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the Ionic app shell and router outlet', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('ion-app ion-router-outlet')).not.toBeNull();
  });

  it('shows an offline notice and clears it on reconnect', async () => {
    const online = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    try {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('offline');

      online.mockReturnValue(true);
      window.dispatchEvent(new Event('online'));
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();
    } finally {
      online.mockRestore();
    }
  });

  it('offers a reload when an update is ready or the current version is broken', async () => {
    const versionUpdates = new Subject<VersionEvent>();
    const unrecoverable = new Subject<UnrecoverableStateEvent>();
    TestBed.overrideProvider(SwUpdate, {
      useValue: { isEnabled: true, versionUpdates, unrecoverable },
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'previous' },
      latestVersion: { hash: 'latest' },
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('update is ready');
    expect(fixture.nativeElement.querySelector('.app-notice ion-button').textContent).toContain('Reload');

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'Missing bundle' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('can’t continue');
  });
});
