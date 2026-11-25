import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditDecisionPage } from './edit-decision-page';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('EditDecisionPage', () => {
  let component: EditDecisionPage;
  let fixture: ComponentFixture<EditDecisionPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditDecisionPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(EditDecisionPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
