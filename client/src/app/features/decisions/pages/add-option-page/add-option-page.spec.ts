import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddOptionPage } from './add-option-page';

describe('AddOptionPage', () => {
  let component: AddOptionPage;
  let fixture: ComponentFixture<AddOptionPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddOptionPage],
    }).compileComponents();

    fixture = TestBed.createComponent(AddOptionPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
