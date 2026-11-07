import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarketplaceImportForm } from './marketplace-import';
import { provideHttpClient } from '@angular/common/http';
import { DecisionApi } from '../../services/decision-api';

describe('MarketplaceImport', () => {
  let component: MarketplaceImportForm;
  let fixture: ComponentFixture<MarketplaceImportForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketplaceImportForm],
      providers: [provideHttpClient(), DecisionApi],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketplaceImportForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
