import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OptionInfoForm } from './option-info-form';

describe('OptionInfoForm', () => {
  let component: OptionInfoForm;
  let fixture: ComponentFixture<OptionInfoForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OptionInfoForm],
    }).compileComponents();

    fixture = TestBed.createComponent(OptionInfoForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
