import { Component, OnInit } from '@angular/core';
import * as d3 from 'd3';
import * as d3Chromatic from 'd3-scale-chromatic'

@Component({
  selector: 'app-heatmap',
  templateUrl: './heatmap.component.html',
  styleUrls: ['./heatmap.component.scss']
})
export class HeatmapComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

  private svg: any;
  private margin = { top: 35, right: 200, bottom: 35, left: 200 };
  private xScale = d3.scaleBand().padding(0.05)
  private yScale = d3.scaleBand().padding(0.2)
  private colorScale = d3.scaleSequential(d3Chromatic.interpolatePiYG)

  private generateG() {
    return d3.select('.graph')
    .select('svg')
    .append('g')
    .attr('id', 'graph-g')
    .attr('transform',
      'translate(' + this.margin.left + ',' + this.margin.top + ')')
  }

  private setColorScaleDomain() {
    this.colorScale.domain([-1, 1])
  }

  

}
