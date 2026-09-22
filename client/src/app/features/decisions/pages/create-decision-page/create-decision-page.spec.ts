import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateDecisionPage } from './create-decision-page';

describe('CreateDecisionPage', () => {
  let component: CreateDecisionPage;
  let fixture: ComponentFixture<CreateDecisionPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateDecisionPage],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateDecisionPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
