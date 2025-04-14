import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DraftPositionChartComponent } from './draft-position-chart.component';

describe('DraftPositionChartComponent', () => {
  let component: DraftPositionChartComponent;
  let fixture: ComponentFixture<DraftPositionChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DraftPositionChartComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DraftPositionChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
