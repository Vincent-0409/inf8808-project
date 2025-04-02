import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SmallMultiplesComponent } from './small-multiples.component';

describe('SmallMultiplesComponent', () => {
  let component: SmallMultiplesComponent;
  let fixture: ComponentFixture<SmallMultiplesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SmallMultiplesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SmallMultiplesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
