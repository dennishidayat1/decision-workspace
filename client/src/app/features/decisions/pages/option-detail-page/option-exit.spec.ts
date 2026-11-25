import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { AlertController, NavController } from '@ionic/angular';
import { RouterTestingHarness } from '@angular/router/testing';
import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { OptionDetailPage } from './option-detail-page';
import { DecisionState } from '../../state/decision-state';
import { pendingChangesGuard } from '../../../../core/auth/pending-changes.guard';

@Component({ template: 'Destination' })
class Destination {}

describe('Option detail exit decisions', () => {
  let fixture: ComponentFixture<OptionDetailPage>;
  let page: OptionDetailPage;
  let state: DecisionState;
  let create: ReturnType<typeof vi.fn>;
  let finish: (value: { role: string }) => void;
  let navigateBack: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    create = vi.fn().mockImplementation(async () => ({
      present: vi.fn().mockResolvedValue(undefined),
      onDidDismiss: () => new Promise<{ role: string }>(resolve => { finish = resolve; }),
      dismiss: vi.fn().mockImplementation(async (_data, role) => { if (role) finish?.({ role }); return true; }),
    }));
    navigateBack = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({ imports: [OptionDetailPage], providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: AlertController, useValue: { create } },
      { provide: NavController, useValue: { navigateBack } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'd', optionId: 'o' }) } } },
    ] });
    state = TestBed.inject(DecisionState);
    state.decisionId.set('d');
    state.loadStatus.set('loaded');
    state.options.set([{ id: 'o', decisionId: 'd', title: 'Original', createdAt: '', updatedAt: '1' }]);
    fixture = TestBed.createComponent(OptionDetailPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  function edit() {
    page.toggleBasicEdit();
    page.optionForm.controls.title.setValue('Changed');
  }
  async function answer(role: string) {
    await Promise.resolve();
    await Promise.resolve();
    finish({ role });
  }

  it('allows read mode, unchanged defaults, and edits reverted to the original value without prompting', async () => {
    expect(await page.canLeave()).toBe(true);
    page.toggleBasicEdit();
    expect(await page.canLeave()).toBe(true);
    page.optionForm.controls.title.setValue('Changed');
    page.optionForm.controls.title.setValue('Original');
    expect(await page.canLeave()).toBe(true);
    expect(create).not.toHaveBeenCalled();
  });

  it('shares concurrent decisions, preserves declined edits and permits a later confirmation', async () => {
    edit();
    const first = page.canLeave();
    expect(page.canLeave()).toBe(first);
    await answer('cancel');
    expect(await first).toBe(false);
    expect(page.optionForm.controls.title.value).toBe('Changed');
    expect(page.editingBasic()).toBe(true);
    const retry = page.canLeave();
    await answer('discard');
    expect(await retry).toBe(true);
    expect(page.editingBasic()).toBe(false);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('blocks saving and image recovery, including when either starts during confirmation', async () => {
    page.savingBasic.set(true);
    expect(await page.canLeave()).toBe(false);
    page.savingBasic.set(false);
    const refresh = vi.spyOn(page, 'refreshingImage').mockReturnValue(true);
    expect(await page.canLeave()).toBe(false);
    refresh.mockRestore();
    edit();
    const pending = page.canLeave();
    page.savingBasic.set(true);
    await answer('discard');
    expect(await pending).toBe(false);
    expect(page.editingBasic()).toBe(true);
  });

  it('rejects stale approval if values or account context change', async () => {
    edit();
    let pending = page.canLeave();
    page.optionForm.controls.title.setValue('Newer edits');
    await answer('discard');
    expect(await pending).toBe(false);
    pending = page.canLeave();
    state.resetWorkspace();
    await answer('discard');
    expect(await pending).toBe(false);
    // Forced logout remains possible even if an old editor had unsaved data.
    expect(await page.canLeave()).toBe(true);
  });

  it('keeps the edit-start baseline when shared state changes', async () => {
    page.toggleBasicEdit();
    state.options.update(options => options.map(option => ({ ...option, title: 'Remote title' })));
    expect(page.hasUnsavedBasicChanges()).toBe(false);
    page.optionForm.controls.title.setValue('Remote title');
    expect(page.hasUnsavedBasicChanges()).toBe(true);
  });

  it('fails closed after dialog errors and permits a fresh attempt', async () => {
    edit();
    create.mockRejectedValueOnce(new Error('Dialog failed'));
    expect(await page.canLeave()).toBe(false);
    const retry = page.canLeave();
    await answer('cancel');
    expect(await retry).toBe(false);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('protects direct close actions and browser refresh', async () => {
    edit();
    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    page.protectBrowserExit(event);
    expect(event.defaultPrevented).toBe(true);
    const pending = page.backToDecision();
    await answer('cancel');
    await pending;
    expect(navigateBack).not.toHaveBeenCalled();
  });

  it('protects attribute edits and score-comment drafts and clears discarded drafts', async () => {
    page.toggleAttributesEdit();
    expect(page.hasUnsavedChanges()).toBe(false);
    page.optionForm.controls.attributes.push(new FormGroup({
      name: new FormControl('Color', { nonNullable: true }),
      value: new FormControl('Green', { nonNullable: true }),
    }));
    expect(page.hasUnsavedChanges()).toBe(true);
    let pending = page.canLeave();
    await answer('discard');
    expect(await pending).toBe(true);
    page.optionForm.controls.scores.push(new FormGroup({
      criterionId: new FormControl('criterion', { nonNullable: true }),
      score: new FormControl<number | null>(null),
      comment: new FormControl('Draft', { nonNullable: true }),
    }));
    expect(page.hasUnsavedChanges()).toBe(true);
    pending = page.canLeave();
    await answer('discard');
    expect(await pending).toBe(true);
    expect(page.hasUnsavedChanges()).toBe(false);
    expect(await page.canLeave()).toBe(true);
  });
});

describe('Option detail route exit integration', () => {
  it('keeps the actual option route active when the user declines to discard', async () => {
    const create = vi.fn().mockResolvedValue({
      present: async () => {}, onDidDismiss: async () => ({ role: 'cancel' }), dismiss: async () => true,
    });
    TestBed.configureTestingModule({ providers: [
      provideRouter([
        { path: 'decisions/:id/options/:optionId', component: OptionDetailPage, canDeactivate: [pendingChangesGuard] },
        { path: 'destination', component: Destination },
      ]), provideHttpClient(), provideHttpClientTesting(),
      { provide: AlertController, useValue: { create } },
      { provide: NavController, useValue: { navigateBack: vi.fn() } },
    ] });
    const state = TestBed.inject(DecisionState);
    state.decisionId.set('d');
    state.loadStatus.set('loaded');
    state.options.set([{ id: 'o', decisionId: 'd', title: 'Original', createdAt: '', updatedAt: '' }]);
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/decisions/d/options/o', OptionDetailPage);
    page.toggleBasicEdit();
    page.optionForm.controls.title.setValue('Changed');
    await harness.navigateByUrl('/destination');
    expect(harness.routeDebugElement?.componentInstance).toBe(page);
    expect(create).toHaveBeenCalledTimes(1);
    create.mockResolvedValue({
      present: async () => {}, onDidDismiss: async () => ({ role: 'discard' }), dismiss: async () => true,
    });
    await harness.navigateByUrl('/destination', Destination);
    expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(Destination);
  });
});
