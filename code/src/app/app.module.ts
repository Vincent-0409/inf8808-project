import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HistogramComponent } from './components/histogram/histogram.component';
import { HeatmapComponent } from './components/heatmap/heatmap.component';
import { SmallMultiplesComponent } from './components/small-multiples/small-multiples.component';
import { HttpClientModule } from '@angular/common/http';
import { DraftPositionChartComponent } from './components/draft-position-chart/draft-position-chart.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MaterialPageComponent } from './pages/material-page/material-page.component';

@NgModule({
  declarations: [
    AppComponent,
    HistogramComponent,
    HeatmapComponent,
    SmallMultiplesComponent,
    DraftPositionChartComponent,
    MaterialPageComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    BrowserAnimationsModule
  ],
  providers: [],
  bootstrap: [AppComponent, HeatmapComponent]
})
export class AppModule { }
