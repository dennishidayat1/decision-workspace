import { TestBed } from '@angular/core/testing';
import { DecisionState } from './decision-state';
import { Subject } from 'rxjs';
import { DecisionApi } from '../services/decision-api';
import { DecisionWorkspaceResponse } from '../models/decision-workspace-response';

describe('DecisionState', () => {
  let service: DecisionState;
  let requests: Subject<DecisionWorkspaceResponse>[];
  const workspace = (id: string) => ({ decision: { id }, options: [], attributes: [], scores: [], criteria: [] }) as unknown as DecisionWorkspaceResponse;

  beforeEach(() => {
    requests = [];
    TestBed.configureTestingModule({ providers: [{ provide: DecisionApi, useValue: {
      getDecisionWorkspace: () => {
        const request = new Subject<DecisionWorkspaceResponse>();
        requests.push(request);
        return request;
      },
    } }] });
    service = TestBed.inject(DecisionState);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it.each(['success', 'error'])('ignores stale %s responses after switching decisions', outcome => {
    service.ensureDecisionLoaded('a');
    service.ensureDecisionLoaded('b');
    requests[1].next(workspace('b'));
    if (outcome === 'success') requests[0].next(workspace('a'));
    else requests[0].error({ status: 404 });
    expect(service.decision()?.id).toBe('b');
    expect(service.loadStatus()).toBe('loaded');
    expect(service.loadErrorStatus()).toBeNull();
  });

  it('rejects stale responses after switching away and back to the same ID', () => {
    service.ensureDecisionLoaded('a');
    service.ensureDecisionLoaded('b');
    service.ensureDecisionLoaded('a');
    requests[0].next(workspace('a'));
    expect(service.loadStatus()).toBe('loading');
    requests[2].next(workspace('a'));
    expect(service.loadStatus()).toBe('loaded');
  });

  it('deduplicates active loads and clears the previous decision on switching', () => {
    service.ensureDecisionLoaded('a');
    requests[0].next(workspace('a'));
    service.ensureDecisionLoaded('b');
    service.ensureDecisionLoaded('b');
    expect(requests).toHaveLength(2);
    expect(service.decision()).toBeNull();
    expect(service.options()).toEqual([]);
  });

  it('ignores invalidated responses even when the decision ID is unchanged', () => {
    service.ensureDecisionLoaded('a');
    service.invalidateDecision('a');
    service.ensureDecisionLoaded('a');
    requests[0].next(workspace('a'));
    expect(service.loadStatus()).toBe('loading');
    requests[1].next(workspace('a'));
    expect(service.loadStatus()).toBe('loaded');
  });

  it('clears workspace data and errors and advances the recovery lifecycle', () => {
    service.ensureDecisionLoaded('a');
    requests[0].next(workspace('a'));
    service.options.set([{ id: 'option', decisionId: 'a', title: 'Saved option', createdAt: '', updatedAt: '' }]);
    service.criteria.set([{ id: 'criterion', decisionId: 'a', name: 'Cost', importance: 1, context: null, createdAt: '', updatedAt: '' }]);
    service.optionAttributes.set({ option: [] });
    service.optionScores.set({ option: [] });
    service.loadErrorStatus.set(503);
    const version = service.workspaceLoadVersion();
    service.resetWorkspace();
    expect(service.decision()).toBeNull();
    expect(service.options()).toEqual([]);
    expect(service.criteria()).toEqual([]);
    expect(service.optionAttributes()).toEqual({});
    expect(service.optionScores()).toEqual({});
    expect(service.decisionId()).toBeNull();
    expect(service.loadStatus()).toBe('idle');
    expect(service.loadErrorStatus()).toBeNull();
    expect(service.workspaceLoadVersion()).toBe(version + 1);
  });

  it.each(['success', 'error'])('rejects a late %s after reset without a replacement request', outcome => {
    service.ensureDecisionLoaded('a');
    service.resetWorkspace();
    if (outcome === 'success') requests[0].next(workspace('a'));
    else requests[0].error({ status: 503 });
    expect(service.decision()).toBeNull();
    expect(service.decisionId()).toBeNull();
    expect(service.loadStatus()).toBe('idle');
    expect(service.loadErrorStatus()).toBeNull();
  });

  it('reloads the same decision after reset and rejects its earlier request', () => {
    service.ensureDecisionLoaded('a');
    service.resetWorkspace();
    service.ensureDecisionLoaded('a');
    expect(requests).toHaveLength(2);
    requests[0].next(workspace('a'));
    expect(service.decision()).toBeNull();
    expect(service.loadStatus()).toBe('loading');
    requests[1].next(workspace('a'));
    expect(service.decision()?.id).toBe('a');
    expect(service.loadStatus()).toBe('loaded');
  });
});
