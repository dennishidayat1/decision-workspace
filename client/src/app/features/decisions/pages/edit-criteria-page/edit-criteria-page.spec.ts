import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditCriteriaPage } from './edit-criteria-page';

describe('EditCriteriaPage', () => {
  let component: EditCriteriaPage;
  let fixture: ComponentFixture<EditCriteriaPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditCriteriaPage],
    }).compileComponents();

    fixture = TestBed.createComponent(EditCriteriaPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
