import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HistogramComponent } from './histogram/histogram.component';
import { HeatmapComponent } from './components/heatmap/heatmap.component';
import { SmallMultiplesComponent } from './components/small-multiples/small-multiples.component';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  declarations: [
    AppComponent,
    HistogramComponent,
    HeatmapComponent,
    SmallMultiplesComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HttpClientModule
  ],
  providers: [],
  bootstrap: [AppComponent, HeatmapComponent]
})
export class AppModule { }
