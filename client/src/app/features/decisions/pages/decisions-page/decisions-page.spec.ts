import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DecisionsPage } from './decisions-page';

describe('DecisionsPage', () => {
  let component: DecisionsPage;
  let fixture: ComponentFixture<DecisionsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DecisionsPage],
    }).compileComponents();

    fixture = TestBed.createComponent(DecisionsPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
