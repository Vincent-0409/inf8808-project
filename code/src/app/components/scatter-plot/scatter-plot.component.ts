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

    // Add a "break" marker on the Y-axis ---
    const breakSize = 6;          // size of the zigzag
    const y0 = yScale(20);        // vertical position where the break occurs

    // Create a small zigzag path with three segments
    const breakPath = d3.path();
    breakPath.moveTo(-breakSize, y0 - breakSize);
    breakPath.lineTo( breakSize, y0        );
    breakPath.lineTo(-breakSize, y0 + breakSize);

    yGroup.append('path')
      .attr('d', breakPath.toString())
      .attr('stroke', '#000')
      .attr('stroke-width', 2)
      .attr('fill', 'none');

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
 * - the scatter points 
 * - highlights champions by bringing them to the front
 */
updateChart(): void {
  // 1) Compute new X-scale based on selected metric (first-round vs top-5)
  const maxX = d3.max(this.chartData, d => this.useTop5 ? d.top5Count : d.draftCount) || 1;
  const xScale = d3.scaleLinear()
    .domain([0, maxX])
    .range([0, this.width]);

  // 2) Configure X-axis with integer ticks
  const xAxis = d3.axisBottom<number>(xScale)
    .tickValues(d3.range(0, maxX + 1, 1))
    .tickFormat(d3.format('d'))
    .tickSizeInner(6)
    .tickSizeOuter(0);

  // 3) Select or create the X-axis group
  let xGroup = this.svg.select<SVGGElement>('.x-axis');
  if (xGroup.empty()) {
    xGroup = this.svg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${this.height})`);
  }
  xGroup.call(xAxis);                // draw ticks and labels
  xGroup.select('.domain').remove(); // remove default axis line

  // 4) Redraw custom horizontal baseline
  xGroup.selectAll('line.baseline').remove();
  xGroup.append('line')
    .attr('class', 'baseline')
    .attr('x1', 0).attr('y1', 0)
    .attr('x2', this.width).attr('y2', 0)
    .attr('stroke', '#000');

  // 5) Update or create X-axis label
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

  // 6) Prepare Y-scale for point positioning
  const maxPts = d3.max(this.chartData, d => d.points) || 1;
  const yScale = d3.scaleLinear()
    .domain([20, maxPts])
    .range([this.height, 0]);

  // 7) Data-join for scatter points, keyed by season+teamAbbr
  const circles = this.svg.selectAll<SVGCircleElement, ScatterData>('circle')
    .data(this.chartData, d => d.season + d.teamAbbr);

  circles.exit().remove(); // remove old points

  // 8) Transition existing circles to new X positions
  circles.transition().duration(500)
    .attr('cx', d => xScale(this.useTop5 ? d.top5Count : d.draftCount));

  // 9) Append new circles
  const enter = circles.enter().append('circle')
    .attr('r', 3)
    .attr('fill', d => d.isChampion ? this.championColor : 'black')
    .attr('cx', d => xScale(this.useTop5 ? d.top5Count : d.draftCount))
    .attr('cy', d => yScale(d.points));

  // 10) Merge enter + update to attach hover/tooltip
  const containerNode = document.getElementById('chartContainer')!;
  enter.merge(circles as any)
    .on('mouseover', (event, d) => {
      // enlarge circle
      d3.select(event.currentTarget as SVGCircleElement)
        .transition().duration(100)
        .attr('r', 6);

      // compute mouse position relative to chartContainer
      const [x, y] = d3.pointer(event, containerNode);

      // build tooltip
      let html = `<strong>${d.teamFullName}</strong><br/>`;
      if (d.isChampion) {
        html += `<span style="color:${this.championColor}; font-weight:bold;">Champion de la Coupe Stanley</span><br/>`;
      }
      html +=
        `Saison : ${d.season}<br/>` +
        `Points en saison régulière : ${d.points}<br/>` +
        `Nombre de joueurs repêché en 1ʳᵉ ronde : ${d.draftCount}<br/>` +
        `Nombre de joueurs dans le Top 5 : ${d.top5Count}`;

      // show & populate tooltip
      d3.select('#chartTooltip')
        .style('left', `${x + 10}px`)
        .style('top',  `${y - 28}px`)
        .style('opacity', 1)
        .html(html);
    })
    .on('mousemove', event => {
      // reposition tooltip on move
      const [x, y] = d3.pointer(event, containerNode);
      d3.select('#chartTooltip')
        .style('left', `${x + 10}px`)
        .style('top',  `${y - 28}px`);
    })
    .on('mouseout', event => {
      // restore circle size
      d3.select(event.currentTarget as SVGCircleElement)
        .transition().duration(100)
        .attr('r', 3);

      // hide tooltip
      d3.select('#chartTooltip')
        .style('opacity', 0);
    });

    // 11) Bring champion points to the front layer
    this.svg.selectAll('circle')
      .filter(function() {
        return d3.select(this).attr('fill') === '#FF8C00';
      })
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
