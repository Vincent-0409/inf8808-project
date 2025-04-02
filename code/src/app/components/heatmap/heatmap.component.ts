import { Component, OnInit } from '@angular/core';
import * as d3 from 'd3';
import * as d3Chromatic from 'd3-scale-chromatic';
import { DataPreprocessingService, DraftPlayer } from '../../services/preprocessing/preprocessing.service';

@Component({
  selector: 'app-heatmap',
  templateUrl: './heatmap.component.html',
  styleUrls: ['./heatmap.component.scss']
})
export class HeatmapComponent implements OnInit {
  private data: { year: number; stat: string; correlation: number }[] = [];
  private svg: any;
  private margin = { top: 35, right: 200, bottom: 35, left: 200 };
  private xScale = d3.scaleBand().padding(0.05);
  private yScale = d3.scaleBand().padding(0.2);
  private colorScale = d3.scaleSequential(d3Chromatic.interpolatePiYG);

  constructor(private dataService: DataPreprocessingService) {}

  ngOnInit(): void {
    this.dataService.loadDraftData().subscribe(players => {
      this.data = this.dataService.getSpearmanCorrelationByYear(players);
      console.log(this.data);
      this.renderHeatmap();
    });
  }

  private generateG() {
    return d3.select('.graph')
      .select('svg')
      .append('g')
      .attr('id', 'graph-g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
  }

  private setColorScaleDomain() {
    this.colorScale.domain([-1, 1]);
  }

  private renderHeatmap() {
    const years = [...new Set(this.data.map(d => String(d.year)))];
    const stats = ['games_played', 'goals', 'assists', 'points'];

    this.setColorScaleDomain();

    this.xScale.domain(years).range([0, 800]);
    this.yScale.domain(stats).range([0, 400]);

    const g = this.generateG();

    g.selectAll('rect')
      .data(this.data)
      .enter()
      .append('rect')
      .attr('class', 'cell')
      .attr('x', d => this.xScale(String(d.year))!)
      .attr('y', d => this.yScale(d.stat)!)
      .attr('width', this.xScale.bandwidth())
      .attr('height', this.yScale.bandwidth())
      .attr('fill', d => this.colorScale(d.correlation));
  }
}