import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddOptionPage } from './add-option-page';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NavController } from '@ionic/angular';
import { DecisionState } from '../../state/decision-state';

describe('AddOptionPage', () => {
  let component: AddOptionPage;
  let fixture: ComponentFixture<AddOptionPage>;
  let http: HttpTestingController;
  let navigateBack: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    navigateBack = vi.fn().mockResolvedValue(true);
    await TestBed.configureTestingModule({
      imports: [AddOptionPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'decision-1' }) } } },
        { provide: NavController, useValue: { navigateBack } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddOptionPage);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  const isCreate = (request: { method: string; url: string }) =>
    request.method === 'POST' && request.url.endsWith('/decisions/decision-1/options');

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sends one request for repeated submissions and disables the button until success', () => {
    component.optionForm.controls.title.setValue('Laptop');
    const invalidate = vi.spyOn(TestBed.inject(DecisionState), 'invalidateDecision');
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('ion-button[type="submit"]');
    expect(button.disabled).toBe(false);
    component.onAddOption();
    component.onAddOption();
    fixture.detectChanges();
    expect(component.isSubmitting()).toBe(true);
    expect(button.disabled).toBe(true);
    const request = http.expectOne(isCreate);
    expect(request.request.body.title).toBe('Laptop');
    request.flush({ id: 'option-1' });
    fixture.detectChanges();
    expect(component.isSubmitting()).toBe(false);
    expect(button.disabled).toBe(false);
    expect(invalidate).toHaveBeenCalledExactlyOnceWith('decision-1');
    expect(navigateBack).toHaveBeenCalledExactlyOnceWith(['/decisions', 'decision-1']);
  });

  it('unlocks after failure, preserves the form and allows a retry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    component.optionForm.controls.title.setValue('Laptop');
    component.onAddOption();
    http.expectOne(isCreate).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(component.isSubmitting()).toBe(false);
    expect(component.optionSubmitError()).toBeTruthy();
    expect(component.optionForm.controls.title.value).toBe('Laptop');
    expect(navigateBack).not.toHaveBeenCalled();
    component.onAddOption();
    expect(component.optionSubmitError()).toBeNull();
    expect(component.isSubmitting()).toBe(true);
    http.expectOne(isCreate).flush({ id: 'option-1' });
    expect(component.isSubmitting()).toBe(false);
  });

  it('does not lock or send a request for an invalid form', () => {
    component.onAddOption();
    expect(component.optionForm.controls.title.touched).toBe(true);
    expect(component.isSubmitting()).toBe(false);
    http.expectNone(isCreate);
  });
});
