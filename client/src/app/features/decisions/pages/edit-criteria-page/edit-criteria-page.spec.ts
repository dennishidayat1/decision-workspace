import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditCriteriaPage } from './edit-criteria-page';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('EditCriteriaPage', () => {
  let component: EditCriteriaPage;
  let fixture: ComponentFixture<EditCriteriaPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditCriteriaPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(EditCriteriaPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
