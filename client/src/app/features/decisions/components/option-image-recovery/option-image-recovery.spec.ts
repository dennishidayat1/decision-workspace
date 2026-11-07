import { Component, computed, inject, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DecisionApi } from '../../services/decision-api';
import { DecisionState } from '../../state/decision-state';
import { DecisionOption } from '../../models/decision-option';
import { OptionImageRecoveryControl } from './option-image-recovery';

@Component({
  imports: [OptionImageRecoveryControl],
  template: `
    @if (api.getOptionImageUrl(option()); as image) {
      <img [src]="image" (error)="api.markImageFailed(image)" />
    }
    <app-option-image-recovery [option]="option()" [blocked]="blocked()"
      (confirmationRequested)="confirmed.set(true)" />
    <app-option-image-recovery [option]="option()" [blocked]="blocked()" />
  `,
})
class RecoveryHost {
  readonly api = inject(DecisionApi);
  private readonly state = inject(DecisionState);
  readonly option = computed(() => this.state.options()[0]);
  readonly blocked = signal(false);
  readonly confirmed = signal(false);
}

describe('Option image recovery rendering', () => {
  const cdn = 'https://p16-images-sign-sg.tokopedia-static.net/product.jpg';
  const stored = 'https://example.supabase.co/storage/v1/object/public/marketplace-images/imports/new.jpg';
  let fixture: ComponentFixture<RecoveryHost>;
  let http: HttpTestingController;
  let state: DecisionState;
  let option: DecisionOption;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), DecisionApi] }).compileComponents();
    state = TestBed.inject(DecisionState);
    option = { id: 'option', decisionId: 'decision', title: 'Product', thumbnailUrl: cdn, imageUrl: cdn,
      sourceUrl: 'https://www.tokopedia.com/shop/product', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z' };
    state.options.set([option]);
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RecoveryHost);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  async function failImage(): Promise<void> {
    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    await fixture.whenStable();
  }

  it('starts one automatic request across duplicate views and displays the recovered image', async () => {
    await failImage();
    const request = http.expectOne(req => req.url.endsWith('/refresh-image'));
    request.flush({ ...option, imageUrl: stored, thumbnailUrl: stored, updatedAt: '2026-11-03T00:00:00Z' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(stored);
    expect(fixture.nativeElement.querySelector('ion-button')).toBeNull();
  });

  it('hides the icon while pending, restores it after each failure, and hides it after success', async () => {
    expect(fixture.nativeElement.querySelector('ion-button')).toBeNull();
    await failImage();
    expect(fixture.nativeElement.querySelector('ion-button')).toBeNull();
    http.expectOne(req => req.url.endsWith('/refresh-image')).error(new ProgressEvent('error'));
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('ion-button');
    expect(button.shadowRoot.querySelector('button').getAttribute('aria-label')).toBe('Retry marketplace image recovery');
    http.expectNone(req => req.url.endsWith('/refresh-image'));
    button.click();
    await fixture.whenStable();
    const retry = http.expectOne(req => req.url.endsWith('/refresh-image'));
    expect(fixture.nativeElement.querySelector('ion-button')).toBeNull();
    retry.flush({ code: 'image_storage_failed', message: 'Unable to save the image.' },
      { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    const retryAgain = fixture.nativeElement.querySelector('ion-button');
    expect(retryAgain).not.toBeNull();
    expect(retryAgain.title).toBe('Unable to save the image.');
    http.expectNone(req => req.url.endsWith('/refresh-image'));
    retryAgain.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('ion-button')).toBeNull();
    http.expectOne(req => req.url.endsWith('/refresh-image')).flush({ ...option,
      imageUrl: stored, thumbnailUrl: stored, updatedAt: '2026-11-03T00:00:00Z' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(stored);
    expect(fixture.nativeElement.querySelector('ion-button')).toBeNull();
  });

  it('uses a working thumbnail fallback without an automatic upload', async () => {
    state.options.set([{ ...option, imageUrl: stored }]);
    await fixture.whenStable();
    await failImage();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(stored);
    http.expectNone(req => req.url.endsWith('/refresh-image'));
    await failImage();
    http.expectNone(req => req.url.endsWith('/refresh-image')); // Durable images are never automatically recovered.
  });

  it('waits until editing ends before attempting automatic recovery', async () => {
    fixture.componentInstance.blocked.set(true);
    await fixture.whenStable();
    await failImage();
    http.expectNone(req => req.url.endsWith('/refresh-image'));
    fixture.componentInstance.blocked.set(false);
    await fixture.whenStable();
    http.expectOne(req => req.url.endsWith('/refresh-image')).flush({ ...option, imageUrl: stored, thumbnailUrl: stored });
  });

  it('routes retry to existing confirmation when the server protects a thumbnail', async () => {
    await failImage();
    http.expectOne(req => req.url.endsWith('/refresh-image')).flush(
      { code: 'thumbnail_confirmation_required' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    fixture.nativeElement.querySelector('ion-button').click();
    expect(fixture.componentInstance.confirmed()).toBe(true);
    http.expectNone(req => req.url.endsWith('/refresh-image'));
  });
});
