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
import { MainPageComponent } from './pages/main-page/main-page.component';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { DraftScatterPlotComponent } from './components/draft-scatter-plot/draft-scatter-plot.component';

@NgModule({
  declarations: [
    AppComponent,
    HistogramComponent,
    HeatmapComponent,
    SmallMultiplesComponent,
    DraftPositionChartComponent,
    MaterialPageComponent,
    MainPageComponent,
    DraftScatterPlotComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    BrowserAnimationsModule,
    [MatToolbarModule, MatCardModule],
  ],
  providers: [],
  bootstrap: [AppComponent, HeatmapComponent]
})
export class AppModule { }
