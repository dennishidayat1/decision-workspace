import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OptionDetailPage } from './option-detail-page';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NavController } from '@ionic/angular';
import { DecisionApi } from '../../services/decision-api';
import { DecisionState } from '../../state/decision-state';
import { DecisionOption } from '../../models/decision-option';
import { OptionImageRecovery } from '../../services/option-image-recovery';

describe('OptionDetailPage', () => {
  let component: OptionDetailPage;
  let fixture: ComponentFixture<OptionDetailPage>;
  let state: DecisionState;
  let http: HttpTestingController;
  const original: DecisionOption = {
    id: 'option', decisionId: 'decision', title: 'Saved option',
    sourceUrl: 'https://www.tokopedia.com/shop/product',
    thumbnailUrl: 'https://images.example/old.jpg', imageUrl: 'https://images.example/old.jpg',
    createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OptionDetailPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), DecisionApi,
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'decision', optionId: 'option' }) } } },
        { provide: NavController, useValue: { navigateBack: () => {} } },
      ],
    }).overrideComponent(OptionDetailPage, { set: { template: '' } }).compileComponents();

    state = TestBed.inject(DecisionState);
    state.options.set([{ ...original }]);
    state.loadStatus.set('loaded');
    http = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(OptionDetailPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('requires explicit confirmation for a potentially customized thumbnail', () => {
    state.options.set([{ ...original, thumbnailUrl: 'https://images.example/custom.jpg' }]);
    component.refreshImage();
    expect(component.confirmImageReplacement()).toBe(true);
    http.expectNone(req => req.url.endsWith('/refresh-image'));
    component.refreshImage(true);
    const request = http.expectOne(req => req.url.endsWith('/refresh-image'));
    expect(request.request.body.replaceThumbnail).toBe(true);
    request.flush(original);
  });

  it('updates shared state and image selection without reloading', () => {
    const api = TestBed.inject(DecisionApi);
    const recovered = { ...original, thumbnailUrl: 'https://storage.example/new.jpg', imageUrl: 'https://storage.example/new.jpg', updatedAt: '2026-11-03T00:00:00Z' };
    api.markImageFailed(recovered.imageUrl);
    component.refreshImage();
    expect(component.refreshingImage()).toBe(true);
    const request = http.expectOne(req => req.url.endsWith('/refresh-image'));
    expect(request.request.body.expectedUpdatedAt).toBe(original.updatedAt);
    request.flush(recovered);
    expect(state.options()[0]).toEqual(recovered);
    expect(api.getOptionImageUrl(component.option()!)).toBe(recovered.imageUrl);
    expect(component.refreshingImage()).toBe(false);
    component.toggleBasicEdit();
    expect(component.optionForm.controls.thumbnailUrl.value).toBe(recovered.thumbnailUrl);
  });

  it('preserves state and shows the backend failure message', () => {
    component.refreshImage();
    http.expectOne(req => req.url.endsWith('/refresh-image')).flush(
      { code: 'image_storage_failed', message: 'Image storage unavailable.' }, { status: 502, statusText: 'Bad Gateway' });
    expect(state.options()[0]).toEqual(original);
    expect(component.imageRefreshError()).toBe('Image storage unavailable.');
    expect(component.refreshingImage()).toBe(false);
  });

  it('clears a previous inline error when recovery is retried through the image control', async () => {
    component.refreshImage();
    http.expectOne(req => req.url.endsWith('/refresh-image')).error(new ProgressEvent('error'));
    expect(component.imageRefreshError()).toBeTruthy();
    TestBed.inject(OptionImageRecovery).refresh(state.options()[0]).subscribe();
    expect(component.refreshingImage()).toBe(true);
    await fixture.whenStable();
    expect(component.imageRefreshError()).toBeNull();
    http.expectOne(req => req.url.endsWith('/refresh-image')).flush(original);
    expect(component.refreshingImage()).toBe(false);
  });

  it('keeps pending state scoped to the displayed option while another option finishes recovery', async () => {
    component.refreshImage();
    const firstRequest = http.expectOne(req => req.url.endsWith('/options/option/refresh-image'));
    const second = { ...original, id: 'second' };
    state.options.set([original, second]);
    fixture.componentRef.setInput('panelOptionId', second.id);
    await fixture.whenStable();
    expect(component.refreshingImage()).toBe(false);
    component.refreshImage();
    const secondRequest = http.expectOne(req => req.url.endsWith('/options/second/refresh-image'));
    expect(component.refreshingImage()).toBe(true);
    firstRequest.flush(original);
    expect(component.refreshingImage()).toBe(true);
    secondRequest.flush(second);
    expect(component.refreshingImage()).toBe(false);
  });

  it('blocks requests during editing and duplicate refreshes', () => {
    component.editingBasic.set(true);
    component.refreshImage();
    http.expectNone(req => req.url.endsWith('/refresh-image'));
    component.editingBasic.set(false);
    component.refreshImage();
    component.refreshImage();
    component.toggleBasicEdit();
    expect(component.editingBasic()).toBe(false);
    http.expectOne(req => req.url.endsWith('/refresh-image')).flush(original);
  });

  it('only offers recovery for a saved supported source', () => {
    state.options.set([{ ...original, sourceUrl: undefined }]);
    expect(component.canRefreshImage()).toBe(false);
    component.refreshImage();
    http.expectNone(req => req.url.endsWith('/refresh-image'));
  });

  it('uses the version captured when editing began rather than a later state version', () => {
    component.toggleBasicEdit();
    state.options.set([{ ...original, updatedAt: '2026-11-04T00:00:00Z' }]);
    component.saveBasicDetails();
    const request = http.expectOne(req => req.method === 'PUT');
    expect(request.request.body.expectedUpdatedAt).toBe(original.updatedAt);
    request.flush(original);
  });

  it('supports the embedded panel using the same recovery operation', async () => {
    fixture.componentRef.setInput('presentation', 'panel');
    fixture.componentRef.setInput('panelDecisionId', 'decision');
    fixture.componentRef.setInput('panelOptionId', 'option');
    await fixture.whenStable();
    component.refreshImage();
    http.expectOne(req => req.url.endsWith('/decisions/decision/options/option/refresh-image')).flush(original);
  });
});
