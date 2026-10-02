import { TestBed } from '@angular/core/testing';
import { DecisionState } from './decision-state';

describe('DecisionState', () => {
  let service: DecisionState;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DecisionState);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
