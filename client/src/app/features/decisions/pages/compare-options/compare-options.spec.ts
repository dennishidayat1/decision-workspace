import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { NavController } from '@ionic/angular';
import { CompareOptions } from './compare-options';
import { DecisionState } from '../../state/decision-state';
import { DecisionWorkspaceResponse } from '../../models/decision-workspace-response';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../../app.routes';

describe('CompareOptions route correctness', () => {
  let fixture: ComponentFixture<CompareOptions>;
  let page: CompareOptions;
  let http: HttpTestingController;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let query: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigateBack: ReturnType<typeof vi.fn>;
  const workspace = (id = 'a'): DecisionWorkspaceResponse => ({
    decision: { id, title: id, question: id, status: 'draft', createdAt: '', updatedAt: '' },
    options: ['one', 'two', 'three', 'four', 'five'].map(key => ({
      id: `${id}-${key}`, decisionId: id, title: `${id} ${key}`, createdAt: '', updatedAt: '',
    })), criteria: [], attributes: [], scores: [],
  });
  const request = (id = 'a') => http.expectOne(req => req.url.endsWith(`/decisions/${id}/workspace`));
  const render = () => { fixture.detectChanges(); return fixture.nativeElement as HTMLElement; };
  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({ id: 'a' }));
    query = new BehaviorSubject(convertToParamMap({ options: 'a-one,a-two' }));
    navigateBack = vi.fn();
    TestBed.configureTestingModule({ imports: [CompareOptions], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: NavController, useValue: { navigateBack } },
      { provide: ActivatedRoute, useValue: {
        paramMap: params, queryParamMap: query, snapshot: { queryParamMap: query.value },
      } },
    ] });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  function create() {
    fixture = TestBed.createComponent(CompareOptions);
    page = fixture.componentInstance;
  }
  it('loads direct navigation with empty state and renders only after the response', () => {
    create();
    expect(render().textContent).toContain('Loading decision');
    expect(render().querySelector('table')).toBeNull();
    request().flush(workspace());
    expect(render().querySelectorAll('thead th')).toHaveLength(3);
    expect(page.selectedOptionIds()).toEqual(['a-one', 'a-two']);
    page.ionViewWillEnter();
    http.expectNone(req => req.url.endsWith('/workspace'));
  });
  it('hides another cached decision and reacts to route changes', () => {
    TestBed.inject(DecisionState).ensureDecisionLoaded('old');
    request('old').flush(workspace('old'));
    create();
    expect(page.options()).toEqual([]);
    expect(render().textContent).not.toContain('old one');
    request().flush(workspace());
    params.next(convertToParamMap({ id: 'b' }));
    query.next(convertToParamMap({ options: 'b-one,b-two' }));
    expect(page.selectedOptions()).toEqual([]);
    expect(render().querySelector('table')).toBeNull();
    request('b').flush(workspace('b'));
    expect(page.decision()?.id).toBe('b');
    expect(page.selectedOptionIds()).toEqual(['b-one', 'b-two']);
  });
  it('deduplicates IDs, rejects unavailable options and caps valid selections at four', () => {
    query.next(convertToParamMap({ options: 'missing, a-one ,a-one,a-two,a-three,a-four,a-five' }));
    create();
    request().flush(workspace());
    expect(page.selectedOptionIds()).toEqual(['a-one', 'a-two', 'a-three', 'a-four']);
    expect(render().textContent).toContain('Some selected options are unavailable');
    expect(render().querySelectorAll('thead th')).toHaveLength(5);
  });
  it('shows the existing selection state for fewer than two available options', () => {
    query.next(convertToParamMap({ options: 'missing,a-one' }));
    create();
    request().flush(workspace());
    expect(render().querySelector('table')).toBeNull();
    expect(render().textContent).toContain('Choose at least two options');
    page.openSelector();
    expect(page.selectorOpen()).toBe(true);
  });
  it.each([
    [0, 'Unable to load'], [500, 'Unable to load'], [404, 'not found'],
    [400, 'invalid'], [401, 'do not have access'], [403, 'do not have access'],
  ])('handles HTTP %s and retries without stale data', (status, message) => {
    create();
    request().flush({}, { status: Number(status), statusText: 'Failure' });
    expect(render().querySelector('[role="alert"]')?.textContent).toContain(String(message));
    expect(render().querySelector('table')).toBeNull();
    page.openSelector();
    expect(page.selectorOpen()).toBe(false);
    (render().querySelector('[role="alert"] ion-button') as HTMLElement).click();
    expect(render().textContent).toContain('Loading decision');
    request().flush(workspace());
    expect(render().querySelector('table')).not.toBeNull();
  });
  it('handles a missing decision ID and returns to the list', () => {
    params.next(convertToParamMap({}));
    create();
    expect(render().textContent).toContain('missing a decision ID');
    http.expectNone(req => req.url.endsWith('/workspace'));
    page.goBack();
    expect(navigateBack).toHaveBeenCalledWith(['/decisions']);
  });
  it('returns to the requested decision without relying on browser history', () => {
    create();
    request().flush(workspace());
    page.goBack();
    expect(navigateBack).toHaveBeenCalledWith(['/decisions', 'a']);
  });
  it('validates selector output before updating the URL', () => {
    create();
    request().flush(workspace());
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    page.updateComparison(['a-one', 'missing', 'a-one', 'a-two']);
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { options: 'a-one,a-two' } }));
  });

  it('preserves weighted scoring over rated criteria only', () => {
    create();
    const response = workspace();
    response.criteria = [1, 2, 3].map(n => ({
      id: `criterion-${n}`, decisionId: 'a', name: `Criterion ${n}`, importance: n,
      context: null, createdAt: '', updatedAt: '',
    }));
    response.scores = [
      { decisionOptionId: 'a-one', criterionId: 'criterion-1', score: 5, createdAt: '', updatedAt: '' },
      { decisionOptionId: 'a-one', criterionId: 'criterion-2', score: 2, createdAt: '', updatedAt: '' },
    ];
    request().flush(response);
    expect(page.weightedScore('a-one')).toBe(3);
    expect(page.weightedScore('a-two')).toBeNull();
    expect(page.scoreFor('a-one', 'criterion-3')).toBeNull();
  });
});

describe('Comparison URL navigation', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    const comparisonRoute = routes.find(route => route.children)?.children?.find(route => route.path === 'decisions/:id/compare');
    if (!comparisonRoute) throw new Error('Comparison route is missing');
    TestBed.configureTestingModule({ providers: [
      provideRouter([comparisonRoute]), provideHttpClient(), provideHttpClientTesting(),
      { provide: NavController, useValue: { navigateBack: vi.fn() } },
    ] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('opens the actual lazy comparison route directly and switches its decision ID', async () => {
    const harness = await RouterTestingHarness.create();
    for (const id of ['a', 'b']) {
      const page = await harness.navigateByUrl(`/decisions/${id}/compare?options=${id}-one,${id}-two`, CompareOptions);
      expect(page.workspaceReady()).toBe(false);
      const response: DecisionWorkspaceResponse = {
        decision: { id, title: id, question: id, status: 'draft', createdAt: '', updatedAt: '' },
        options: ['one', 'two'].map(key => ({ id: `${id}-${key}`, decisionId: id, title: key, createdAt: '', updatedAt: '' })),
        criteria: [], scores: [], attributes: [],
      };
      http.expectOne(req => req.url.endsWith(`/decisions/${id}/workspace`)).flush(response);
      harness.detectChanges();
      expect(page.decision()?.id).toBe(id);
      expect(harness.routeNativeElement?.querySelectorAll('thead th')).toHaveLength(3);
    }
  });
});
