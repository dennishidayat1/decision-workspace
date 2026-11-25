import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DecisionDetailPage } from './decision-detail-page';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { IonModal } from '@ionic/angular';
import { By } from '@angular/platform-browser';

describe('DecisionDetailPage', () => {
  let component: DecisionDetailPage;
  let fixture: ComponentFixture<DecisionDetailPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DecisionDetailPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DecisionDetailPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the option-exit decision for modal dismissals and decision-route exits', async () => {
    const leave = vi.fn().mockResolvedValue(false);
    vi.spyOn(component as unknown as { optionDetail: () => { canLeave: () => Promise<boolean> } }, 'optionDetail')
      .mockReturnValue({ canLeave: leave });
    fixture.detectChanges();
    const modal = fixture.debugElement.queryAll(By.directive(IonModal))
      .map(element => element.componentInstance as IonModal)
      .find(modal => modal.canDismiss === component.canDismissOption)!;
    expect(modal).toBeDefined();
    expect(await component.canDismissOption()).toBe(false);
    expect(await component.canLeave()).toBe(false);
    expect(leave).toHaveBeenCalledTimes(2);
    component.selectedOptionId.set('option');
    vi.spyOn(modal, 'dismiss').mockResolvedValue(false);
    await component.closeOptionPanel();
    expect(component.selectedOptionId()).toBe('option');
    component.onOptionPanelDismissed();
    expect(component.selectedOptionId()).toBeNull();
  });
});
