import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DecisionDetailPage } from './decision-detail-page';

describe('DecisionDetailPage', () => {
  let component: DecisionDetailPage;
  let fixture: ComponentFixture<DecisionDetailPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DecisionDetailPage],
    }).compileComponents();

    fixture = TestBed.createComponent(DecisionDetailPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
