import { TestBed, inject } from '@angular/core/testing';

import { TimeLockService } from './time-lock.service';

describe('TimeLockService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TimeLockService]
    });
  });

  it('should be created', inject([TimeLockService], (service: TimeLockService) => {
    expect(service).toBeTruthy();
  }));
});
