import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OptionDetailPage } from './option-detail-page';

describe('OptionDetailPage', () => {
  let component: OptionDetailPage;
  let fixture: ComponentFixture<OptionDetailPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OptionDetailPage],
    }).compileComponents();

    fixture = TestBed.createComponent(OptionDetailPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
