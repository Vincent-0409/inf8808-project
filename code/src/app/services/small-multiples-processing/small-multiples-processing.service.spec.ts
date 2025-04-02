import { TestBed } from '@angular/core/testing';

import { SmallMultiplesProcessingService } from './small-multiples-processing.service';

describe('SmallMultiplesProcessingService', () => {
  let service: SmallMultiplesProcessingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SmallMultiplesProcessingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
