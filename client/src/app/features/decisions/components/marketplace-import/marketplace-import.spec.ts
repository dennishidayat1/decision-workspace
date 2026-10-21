import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarketplaceImport } from './marketplace-import';

describe('MarketplaceImport', () => {
  let component: MarketplaceImport;
  let fixture: ComponentFixture<MarketplaceImport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketplaceImport],
    }).compileComponents();

    fixture = TestBed.createComponent(MarketplaceImport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
