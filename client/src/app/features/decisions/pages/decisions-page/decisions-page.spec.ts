import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DecisionsPage } from './decisions-page';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Decision } from '../../models/decision';

describe('DecisionsPage', () => {
  let component: DecisionsPage;
  let fixture: ComponentFixture<DecisionsPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DecisionsPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(DecisionsPage);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('requests only the decision list on every page entry', () => {
    const decisions: Decision[] = [{
      id: 'decision', title: 'Choose a laptop', question: 'Which laptop?',
      status: 'draft', createdAt: '', updatedAt: '',
    }];
    for (let entry = 0; entry < 2; entry++) {
      component.ionViewWillEnter();
      expect(component.isLoading()).toBe(true);
      const requests = http.match(() => true);
      expect(requests).toHaveLength(1);
      expect(requests[0].request.method).toBe('GET');
      expect(requests[0].request.url).toMatch(/\/api\/decisions$/);
      requests[0].flush(decisions);
      expect(component.decisions()).toEqual(decisions);
      expect(component.isLoading()).toBe(false);
      expect(component.loadError()).toBeNull();
    }
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Choose a laptop');
  });

  it('preserves the list error state and clears loading when the API fails', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      component.ionViewWillEnter();
      http.expectOne(req => req.url.endsWith('/decisions')).flush({}, {
        status: 503, statusText: 'Service Unavailable',
      });
      expect(component.isLoading()).toBe(false);
      expect(component.loadError()).toBe('Failed to load decisions. Please try again later.');
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(component.loadError());
    } finally {
      log.mockRestore();
    }
  });
});
