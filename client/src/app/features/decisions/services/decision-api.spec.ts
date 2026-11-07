import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { DecisionApi } from './decision-api';
import { DecisionOption } from '../models/decision-option';

describe('DecisionApi image selection', () => {
  let api: DecisionApi;
  const legacy = 'https://p16-images-sign-sg.tokopedia-static.net/image.jpeg?a=1&signature=a%2Bb';
  const stored = 'https://example.supabase.co/storage/v1/object/public/marketplace-images/imports/image.jpg';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), DecisionApi] });
    api = TestBed.inject(DecisionApi);
  });

  it('loads stored images directly and preserves the full nested CDN query', () => {
    expect(api.getMarketplaceImageUrl(stored)).toBe(stored);
    const proxy = new URL(api.getMarketplaceImageUrl(legacy)!);
    expect(proxy.pathname).toBe('/api/marketplace/image');
    expect(proxy.searchParams.get('url')).toBe(legacy);
  });

  it('prefers the editable thumbnail and falls back to imported metadata only when absent', () => {
    const option = { thumbnailUrl: stored, imageUrl: legacy } as DecisionOption;
    expect(api.getOptionImageUrl(option)).toBe(stored);
    expect(api.getOptionImageUrl({ ...option, thumbnailUrl: ' ' })).toBe(api.getMarketplaceImageUrl(legacy));
  });

  it('falls back after a primary error and stops after both URLs fail', () => {
    const option = { thumbnailUrl: legacy, imageUrl: stored } as DecisionOption;
    api.markImageFailed(api.getOptionImageUrl(option)!);
    expect(api.getOptionImageUrl(option)).toBe(stored);
    expect(api.getMarketplaceImageUrl(legacy)).toBeNull();
    expect(api.getOptionImageUrl({ ...option, thumbnailUrl: stored })).toBe(stored);
    api.markImageFailed(stored);
    expect(api.getOptionImageUrl(option)).toBeNull();
    expect(api.getOptionImageUrl(option)).toBeNull();
  });

  it('does not retry identical primary and secondary URLs', () => {
    const option = { thumbnailUrl: legacy, imageUrl: legacy } as DecisionOption;
    api.markImageFailed(api.getOptionImageUrl(option)!);
    expect(api.getOptionImageUrl(option)).toBeNull();
  });

  it('updates Angular bindings through the failure signal', async () => {
    const fixture = TestBed.createComponent(ImageFallbackHost);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(api.getMarketplaceImageUrl(legacy));
    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(stored);
    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });

  it('invalidates computed selection when a failed image is recovered', () => {
    const selected = computed(() => api.getOptionImageUrl({ thumbnailUrl: stored } as DecisionOption));
    api.markImageFailed(stored);
    expect(selected()).toBeNull();
    api.clearImageFailures(stored);
    expect(selected()).toBe(stored);
  });

  it('only offers recovery for supported HTTPS marketplace sources', () => {
    expect(api.supportsMarketplaceSource('https://www.tokopedia.com/shop/product')).toBe(true);
    expect(api.supportsMarketplaceSource('https://shp.ee/abc')).toBe(true);
    for (const url of [undefined, 'http://tokopedia.com/a', 'https://tokopedia.com.evil.test/a', 'https://user@tokopedia.com/a'])
      expect(api.supportsMarketplaceSource(url)).toBe(false);
  });

  it('sends the recovery version and explicit replacement intent', () => {
    api.refreshOptionImage('decision', 'option', 'version', true).subscribe();
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne(req => req.url.endsWith('/decisions/decision/options/option/refresh-image'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ expectedUpdatedAt: 'version', replaceThumbnail: true });
    request.flush({});
    http.verify();
  });

  it('suppresses failed public URLs and handles missing images', () => {
    api.markImageFailed(stored);
    expect(api.getMarketplaceImageUrl(stored)).toBeNull();
    expect(api.getMarketplaceImageUrl(null)).toBeNull();
  });
});

@Component({
  template: `@if (api.getOptionImageUrl(option); as image) { <img [src]="image" (error)="api.markImageFailed(image)" /> }`,
})
class ImageFallbackHost {
  readonly api = inject(DecisionApi);
  readonly option = {
    thumbnailUrl: 'https://p16-images-sign-sg.tokopedia-static.net/image.jpeg?a=1&signature=a%2Bb',
    imageUrl: 'https://example.supabase.co/storage/v1/object/public/marketplace-images/imports/image.jpg',
  } as DecisionOption;
}
