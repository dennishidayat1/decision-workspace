import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CriteriaForm } from './criteria-form';
import { createDecisionForm } from '../../forms/decision-form';

describe('CriteriaForm', () => {
  let component: CriteriaForm;
  let fixture: ComponentFixture<CriteriaForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CriteriaForm],
    }).compileComponents();

    fixture = TestBed.createComponent(CriteriaForm);
    fixture.componentRef.setInput('criteria', createDecisionForm().controls.criteria);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
