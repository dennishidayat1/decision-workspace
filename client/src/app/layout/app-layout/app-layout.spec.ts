import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppLayout } from './app-layout';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MenuController, PopoverController, ToastController } from '@ionic/angular';
import { AuthService } from '../../core/auth/auth.service';

describe('AppLayout', () => {
  let component: AppLayout;
  let fixture: ComponentFixture<AppLayout>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppLayout],
      providers: [provideRouter([]),
        { provide: PopoverController, useValue: { getTop: vi.fn().mockResolvedValue(undefined) } },
        { provide: AuthService, useValue: { user: signal(null), signOut: vi.fn().mockResolvedValue(undefined) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppLayout);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('dismisses the account controls and shows a toast when sign-out fails', async () => {
    const close = vi.spyOn(TestBed.inject(MenuController), 'close').mockResolvedValue(true);
    const popover = document.createElement('ion-popover');
    const dismiss = popover.dismiss = vi.fn().mockResolvedValue(true);
    vi.mocked(TestBed.inject(PopoverController).getTop).mockResolvedValue(popover);
    const signOut = vi.mocked(TestBed.inject(AuthService).signOut);
    signOut.mockRejectedValue(new Error('Sign-out failed'));
    const toast = document.createElement('ion-toast');
    const present = toast.present = vi.fn().mockResolvedValue(undefined);
    const create = vi.spyOn(TestBed.inject(ToastController), 'create').mockResolvedValue(toast);

    await component.signOut();

    expect(close).toHaveBeenCalledWith('account-menu');
    expect(close).toHaveBeenCalledBefore(dismiss);
    expect(dismiss).toHaveBeenCalledBefore(signOut);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Unable to sign out. Please try again.',
    }));
    expect(present).toHaveBeenCalledOnce();
  });

  it('provides an explicitly named mobile account-menu trigger', () => {
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector('ion-menu-button[menu="account-menu"]');
    expect(trigger).not.toBeNull();
    expect(trigger.shadowRoot?.querySelector('button')?.getAttribute('aria-label') ??
      trigger.getAttribute('aria-label')).toBe('Open account menu');
  });
});
