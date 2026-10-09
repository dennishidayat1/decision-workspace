import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditDecisionPage } from './edit-decision-page';

describe('EditDecisionPage', () => {
  let component: EditDecisionPage;
  let fixture: ComponentFixture<EditDecisionPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditDecisionPage],
    }).compileComponents();

    fixture = TestBed.createComponent(EditDecisionPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
