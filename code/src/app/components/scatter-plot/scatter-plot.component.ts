import { Component, AfterViewInit } from '@angular/core';
import * as d3 from 'd3';
import { DataPreprocessingService, ScatterData } from '../../services/preprocessing/preprocessing.service';

@Component({
  selector: 'app-scatter-plot',
  templateUrl: './scatter-plot.component.html',
  styleUrls: ['./scatter-plot.component.scss']
})
export class ScatterPlotComponent implements AfterViewInit {

  /** Toggle between first-round picks (false) and top-5 picks (true) */
  useTop5 = false;

  /** Preprocessed data */
  private chartData: ScatterData[] = [];

  // Margins around the drawing area
  private margin = { top: 20, right: 20, bottom: 60, left: 70 };
  // Inner width and height of chart area
  private width  = 800 - this.margin.left - this.margin.right;
  private height = 600 - this.margin.top  - this.margin.bottom;

  /** Main SVG group */
  private svg!: d3.Selection<SVGGElement, unknown, any, any>;

  /** Color to highlight Stanley Cup champions */
  private readonly championColor = '#FF8C00';

  constructor(private preprocessing: DataPreprocessingService) {}

  /**
   * After view initialization:
   * 1) load and preprocess data
   * 2) initialize static chart elements
   * 3) draw points and X-axis
   */
  ngAfterViewInit(): void {
    this.preprocessing.getScatterData().subscribe(data => {
      this.chartData = data;
      this.initChart();
      this.updateChart();
    });
  }

  /**
   * Create the SVG container and draw the static Y-axis.
   *
   */
  private initChart(): void {
    // Clear any previous SVG
    d3.select('#scatterPlot').selectAll('*').remove();

    // Create SVG and translate group by margins
    this.svg = d3.select('#scatterPlot')
      .append('svg')
        .attr('width',  this.width + this.margin.left + this.margin.right)
        .attr('height', this.height + this.margin.top  + this.margin.bottom)
      .append('g')
        .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    // Y-scale: point totals, starting at 20 to ignore low-end clutter
    const maxPts = d3.max(this.chartData, d => d.points) || 1;
    const yScale = d3.scaleLinear()
      .domain([20, maxPts])
      .range([this.height, 0]);

    // Draw Y-axis with ticks
    const yAxis = d3.axisLeft(yScale).ticks(6);
    const yGroup = this.svg.append('g').call(yAxis);
    yGroup.select('.domain').remove(); // remove default axis line

    // Add custom vertical baseline
    yGroup.append('line')
      .attr('x1', 0).attr('y1', yScale(20))
      .attr('x2', 0).attr('y2', yScale(maxPts))
      .attr('stroke', '#000');

    // Y-axis label
    this.svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -this.height / 2)
      .attr('y', -50)
      .attr('text-anchor', 'middle')
      .text('Points accumulés en saison régulière');
  }

  /**
   * Draws or updates:
   * - the X-axis
   * - the scatter points (with transition)
   * - highlights champions by bringing them to the front
   */
  updateChart(): void {
    // 1) Compute new X-scale based on selected metric
    const maxX = d3.max(this.chartData, d => this.useTop5 ? d.top5Count : d.draftCount) || 1;
    const xScale = d3.scaleLinear()
      .domain([0, maxX])
      .range([0, this.width]);

    // 2) Configure X-axis with integer ticks
    //    tickSizeInner ensures visible tick marks; tickSizeOuter hides end ticks if desired
    const xAxis = d3.axisBottom<number>(xScale)
      .tickValues(d3.range(0, maxX + 1, 1))
      .tickFormat(d3.format('d'))
      .tickSizeInner(6)
      .tickSizeOuter(0);

    // Select or create X-axis group
    let xGroup = this.svg.select<SVGGElement>('.x-axis');
    if (xGroup.empty()) {
      xGroup = this.svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${this.height})`);
    }

    // Call the axis generator to (re)draw ticks and labels
    xGroup.call(xAxis);

    // Remove only the default domain path, not the tick lines
    xGroup.select('.domain').remove();

    // Add a custom horizontal baseline for clarity
    xGroup.append('line')
      .attr('x1', 0).attr('y1', 0)
      .attr('x2', this.width).attr('y2', 0)
      .attr('stroke', '#000');

    // 3) Update X-axis label
    let xLabel = this.svg.select<SVGTextElement>('.x-title');
    if (xLabel.empty()) {
      xLabel = this.svg.append('text')
        .attr('class', 'x-title')
        .attr('text-anchor', 'middle')
        .attr('y', this.height + 40);
    }
    xLabel
      .attr('x', this.width / 2)
      .text(this.useTop5
        ? 'Nombre de joueurs dans le Top 5'
        : 'Nombre de joueurs de première ronde');

    // 4) Data-join for scatter points, keyed by season+teamAbbr
    const circles = this.svg.selectAll<SVGCircleElement, ScatterData>('circle')
      .data(this.chartData, d => d.season + d.teamAbbr);

    // Remove outdated circles
    circles.exit().remove();

    // Transition existing circles to new X positions
    circles.transition().duration(500)
      .attr('cx', d => xScale(this.useTop5 ? d.top5Count : d.draftCount));

    // Y-scale for point positioning
    const maxPts = d3.max(this.chartData, d => d.points) || 1;
    const yScale = d3.scaleLinear()
      .domain([20, maxPts])
      .range([this.height, 0]);

    // Append new circles
    circles.enter().append('circle')
      .attr('r', 3).attr('fill', d => d.isChampion ? this.championColor : 'black')
      .attr('cx', d => xScale(this.useTop5 ? d.top5Count : d.draftCount))
      .attr('cy', d => yScale(d.points));

    // 5) Bring champion points to the front layer
    this.svg.selectAll('circle')
      .filter(function() { return d3.select(this).attr('fill') === '#FF8C00'; })
      .raise();
  }

  /**
   * Handler for toggle button:
   * flips the metric and re-renders the chart with transition.
   */
  onToggle(): void {
    this.useTop5 = !this.useTop5;
    this.updateChart();
  }
}
