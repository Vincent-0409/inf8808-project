import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DraftScatterPlotComponent } from './draft-scatter-plot.component';

describe('DraftScatterPlotComponent', () => {
  let component: DraftScatterPlotComponent;
  let fixture: ComponentFixture<DraftScatterPlotComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DraftScatterPlotComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DraftScatterPlotComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
