import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DecisionApi } from './decision-api';
import { OptionImageRecovery } from './option-image-recovery';
import { DecisionState } from '../state/decision-state';
import { DecisionOption } from '../models/decision-option';

describe('OptionImageRecovery', () => {
  const cdn = 'https://p16-images-sign-sg.tokopedia-static.net/product.jpg?expired=1';
  const stored = 'https://example.supabase.co/storage/v1/object/public/marketplace-images/imports/new.jpg';
  let option: DecisionOption;
  let state: DecisionState;
  let api: DecisionApi;
  let recovery: OptionImageRecovery;
  let http: HttpTestingController;
  const endpoint = (url: string) => url.endsWith('/decisions/decision/options/option/refresh-image');

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), DecisionApi] });
    api = TestBed.inject(DecisionApi);
    state = TestBed.inject(DecisionState);
    recovery = TestBed.inject(OptionImageRecovery);
    http = TestBed.inject(HttpTestingController);
    option = { id: 'option', decisionId: 'decision', title: 'Saved title', price: 123,
      sourceUrl: 'https://www.tokopedia.com/shop/product', thumbnailUrl: cdn, imageUrl: cdn,
      createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z' };
    state.options.set([option]);
  });

  afterEach(() => http.verify());

  function failImages(value = option): void {
    for (let image = api.getOptionImageUrl(value); image; image = api.getOptionImageUrl(value)) api.markImageFailed(image);
  }

  it('recovers only after an image-loading failure and updates only image state', () => {
    recovery.tryAutomatic(option);
    http.expectNone(req => endpoint(req.url));
    const attributes = state.optionAttributes();
    const scores = state.optionScores();
    const criteria = state.criteria();
    failImages();
    recovery.tryAutomatic(option);
    const request = http.expectOne(req => endpoint(req.url));
    expect(request.request.body).toEqual({ expectedUpdatedAt: option.updatedAt, replaceThumbnail: false });
    request.flush({ ...option, title: 'Must not replace local unrelated fields', price: 999,
      thumbnailUrl: stored, imageUrl: stored, updatedAt: '2026-11-03T00:00:00Z' });
    expect(state.options()[0]).toEqual({ ...option, thumbnailUrl: stored, imageUrl: stored, updatedAt: '2026-11-03T00:00:00Z' });
    expect(state.optionAttributes()).toBe(attributes);
    expect(state.optionScores()).toBe(scores);
    expect(state.criteria()).toBe(criteria);
    expect(api.getOptionImageUrl(state.options()[0])).toBe(stored);
  });

  it('deduplicates automatic and manual callers and allows no automatic loop', () => {
    failImages();
    recovery.tryAutomatic(option);
    recovery.tryAutomatic(option);
    recovery.refresh(option).subscribe();
    http.expectOne(req => endpoint(req.url)).flush({ ...option, thumbnailUrl: stored, imageUrl: stored });
    recovery.tryAutomatic(option);
    http.expectNone(req => endpoint(req.url));
  });

  it('waits for a secondary image and never recovers while it is working', () => {
    option = { ...option, thumbnailUrl: undefined, imageUrl: cdn + '&secondary=1' };
    state.options.set([option]);
    recovery.tryAutomatic(option);
    http.expectNone(req => endpoint(req.url));
    failImages();
    recovery.tryAutomatic(option);
    http.expectOne(req => endpoint(req.url)).flush({ ...option, thumbnailUrl: stored, imageUrl: stored });
  });

  it('preserves customized thumbnails even when all images fail', () => {
    option = { ...option, thumbnailUrl: 'https://user.example/custom.jpg' };
    failImages();
    recovery.tryAutomatic(option);
    let errorCode: string | undefined;
    recovery.refresh(option).subscribe({ error: error => errorCode = error.error.code });
    expect(errorCode).toBe('thumbnail_confirmation_required');
    http.expectNone(req => endpoint(req.url));
    recovery.refresh(option, true).subscribe();
    const request = http.expectOne(req => endpoint(req.url));
    expect(request.request.body.replaceThumbnail).toBe(true);
    request.flush({ ...option, thumbnailUrl: stored, imageUrl: stored });
  });

  it('treats two different marketplace thumbnails as potentially customized', () => {
    option = { ...option, thumbnailUrl: cdn + '&selected=variant' };
    failImages();
    recovery.tryAutomatic(option);
    http.expectNone(req => endpoint(req.url));
  });

  it('never automatically recovers failed Supabase images or external images', () => {
    for (const image of [stored, 'https://user.example/custom.jpg']) {
      const value = { ...option, thumbnailUrl: image, imageUrl: image };
      failImages(value);
      recovery.tryAutomatic(value);
    }
    // A failed legacy thumbnail must not trigger recovery of a failed durable fallback either.
    const mixed = { ...option, imageUrl: stored };
    failImages(mixed);
    recovery.tryAutomatic(mixed);
    http.expectNone(req => endpoint(req.url));
  });

  it('skips missing sources, unsupported sources, and absent images', () => {
    failImages();
    for (const value of [{ ...option, sourceUrl: undefined }, { ...option, sourceUrl: 'https://unsupported.example/a' },
      { ...option, imageUrl: undefined, thumbnailUrl: undefined }]) recovery.tryAutomatic(value);
    http.expectNone(req => endpoint(req.url));
  });

  it('retains failure state, prevents repeats, and permits an explicit manual retry', () => {
    failImages();
    recovery.tryAutomatic(option);
    http.expectOne(req => endpoint(req.url)).flush({ message: 'Storage unavailable' }, { status: 502, statusText: 'Bad Gateway' });
    expect(recovery.failed(option)).toBe(true);
    expect(recovery.message(option)).toBe('Storage unavailable');
    expect(state.options()[0]).toEqual(option);
    recovery.tryAutomatic(option);
    http.expectNone(req => endpoint(req.url));
    recovery.refresh(option).subscribe();
    http.expectOne(req => endpoint(req.url)).flush({ ...option, thumbnailUrl: stored, imageUrl: stored });
    expect(recovery.failed(option)).toBe(false);
  });

  it('handles offline failures without retry loops', () => {
    failImages();
    recovery.tryAutomatic(option);
    http.expectOne(req => endpoint(req.url)).error(new ProgressEvent('error'));
    expect(recovery.failed(option)).toBe(true);
    recovery.tryAutomatic(option);
    http.expectNone(req => endpoint(req.url));
  });

  it('preserves newer state on concurrency conflicts and delayed success responses', () => {
    failImages();
    recovery.tryAutomatic(option);
    http.expectOne(req => endpoint(req.url)).flush({ code: 'option_conflict', message: 'Reload this option.' }, { status: 409, statusText: 'Conflict' });
    expect(state.options()[0]).toEqual(option);
    recovery.refresh(option).subscribe();
    const delayed = http.expectOne(req => endpoint(req.url));
    const newer = { ...option, thumbnailUrl: 'https://user.example/new-choice.jpg', updatedAt: '2026-11-05T00:00:00Z' };
    state.options.set([newer]);
    delayed.flush({ ...option, thumbnailUrl: stored, imageUrl: stored, updatedAt: '2026-11-03T00:00:00Z' });
    expect(state.options()[0]).toEqual(newer);
  });

  it('shares the attempt limit across view remounts but allows a new workspace load', () => {
    failImages();
    recovery.tryAutomatic(option);
    http.expectOne(req => endpoint(req.url)).flush({}, { status: 502, statusText: 'Bad Gateway' });
    recovery.tryAutomatic({ ...option });
    http.expectNone(req => endpoint(req.url));
    state.workspaceLoadVersion.update(version => version + 1);
    recovery.tryAutomatic(option);
    http.expectOne(req => endpoint(req.url)).flush({ ...option, thumbnailUrl: stored, imageUrl: stored });
  });

  it('preserves server-side replacement confirmation requirements', () => {
    failImages();
    recovery.tryAutomatic(option);
    http.expectOne(req => endpoint(req.url)).flush({ code: 'thumbnail_confirmation_required', message: 'Confirm replacement.' }, { status: 409, statusText: 'Conflict' });
    expect(recovery.needsConfirmation(option)).toBe(true);
  });
});
