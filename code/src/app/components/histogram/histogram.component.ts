import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import * as d3 from 'd3';
import { DataPreprocessingService, DraftPlayer } from '../../services/preprocessing/preprocessing.service';

/**
 * Flat data structure for each circle in the histogram.
 * - id: unique player identifier for D3 data-join
 * - stat: rounded per-game metric value
 * - yearGroup: 5-year bin label (e.g. "2000-2004")
 * - orderIndex: stack position within its bin
 * - color: fill color based on grouping
 */
interface FlatDatum {
  id: number;
  stat: number;
  yearGroup: string;
  orderIndex: number;
  color: string;
}

@Component({
  selector: 'app-histogram',
  templateUrl: './histogram.component.html',
  styleUrls: ['./histogram.component.scss']
})
export class HistogramComponent implements AfterViewInit {
  @ViewChild('chart', { static: true })
  private chartContainer!: ElementRef<SVGSVGElement>;

  // Margins around the drawing area
  private readonly margin = { top: 20, right: 30, bottom: 50, left: 100 };
  // Total width (95% of viewport) and initial height (recalculated later)
  private width = window.innerWidth * 0.95;
  private height = 1200;

  // Spacing and size for each circle
  private readonly circleSpacing = 5;
  private readonly circleRadius = 2;

  // Full SVG <g> container
  private svg!: d3.Selection<SVGGElement, unknown, null, undefined>;

  // Raw data loaded from CSV and derived structures
  private rawPlayers: DraftPlayer[] = [];
  private statMax = 1;  // maximum stat value for x-axis domain
  private binnedData: { stat: number; yearGroup: string; players: DraftPlayer[] }[] = [];

  // User-controlled options
  selectedMetric: 'points' | 'goals' | 'assists' = 'points';
  selectedGrouping: 'nationality' | 'age' = 'nationality';

  constructor(private preprocessing: DataPreprocessingService) {}

  /** 
   * Lifecycle hook: initialize SVG and load data on component render.
   */
  ngAfterViewInit(): void {
    this.initSvg();
    this.preprocessing.loadDraftData().subscribe(players => {
      this.rawPlayers = players;
      this.processAndRender();
    });
  }

  /**
   * Handler for metric selection change.
   * Triggers data re-processing and animated update.
   */
  onMetricChange(evt: Event): void {
    this.selectedMetric = (evt.target as HTMLSelectElement).value as any;
    this.processAndRender();
  }

  /**
   * Handler for grouping toggle (nationality vs age).
   * Triggers data re-processing and animated update.
   */
  onGroupingToggle(evt: Event): void {
    this.selectedGrouping = (evt.target as HTMLInputElement).checked
      ? 'age'
      : 'nationality';
    this.processAndRender();
  }

  /**
   * Core pipeline:
   * 1) Compute per-game stats & filter invalid entries.
   * 2) Determine x-axis max and 5-year bins.
   * 3) Nest data by bin for stacking.
   * 4) Draw axes & legend, then animate circles.
   */
  private processAndRender(): void {
    // 1) Compute and filter
    const withStats = this.rawPlayers
      .map(p => {
        const perGame = this.preprocessing.calculatePerGameStats(p);
        const value = this.selectedMetric === 'points'
          ? perGame.pointsPerGame
          : this.selectedMetric === 'goals'
            ? perGame.goalsPerGame
            : perGame.assistsPerGame;
        return { ...p, stat: Math.round(value * 100) / 100 } as DraftPlayer & { stat: number };
      })
      .filter(p => p.stat > 0);

    // 2) Update x-axis domain
    this.statMax = d3.max(withStats, d => d.stat) || 1;

    // 3) Compute unique 5-year bins
    const yearGroups = Array.from(new Set(
      withStats.map(d => this.preprocessing.getYearGroup(d.year))
    )).sort((a, b) => +a.split('-')[0] - +b.split('-')[0]);

    // 4) Nest data for stacking
    this.binnedData = [];
    const nested = d3.group(withStats,
      d => this.preprocessing.getYearGroup(d.year),
      d => d.stat
    );
    nested.forEach((mapStat, yearGroup) => {
      mapStat.forEach(players => {
        this.binnedData.push({ yearGroup, stat: players[0].stat, players });
      });
    });

    // 5) Render axes (static per update)
    this.drawAxes(yearGroups);
    // 6) Animate circles based on new data
    this.updateCircles(yearGroups);
    // 7) Draw legend for color coding
    this.drawLegend();
  }

  /**
   * Initialize the SVG container and apply margin transform.
   */
  private initSvg(): void {
    this.svg = d3.select<SVGSVGElement, unknown>(this.chartContainer.nativeElement)
      .attr('width', this.width)
      .attr('height', this.height)
      .append<SVGGElement>('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
  }

  /**
   * Draw or update both vertical and horizontal axes:
   * - Vertical axis without ticks + rotated label.
   * - Horizontal axes repeated per 5-year bin with dashed separators.
   * - Bottom x-axis title.
   */
  private drawAxes(yearGroups: string[]): void {
    // Compute dimensions
    const groupH = this.computeGroupHeight(yearGroups);
    const innerH = yearGroups.length * groupH;
    const innerW = this.width - this.margin.left - this.margin.right;

    // Resize outer <svg> height to fit bands
    d3.select(this.chartContainer.nativeElement)
      .attr('height', this.margin.top + this.margin.bottom + innerH);

    // Remove old axes and labels
    this.svg.selectAll('.y-axis, .y-axis-label, .x-axis, .x-axis-title, .group-label').remove();

    // Vertical axis line and label
    const yScale = d3.scaleLinear().domain([0, innerH]).range([0, innerH]);
    this.svg.append('g')
      .attr('class', 'y-axis')
      .call(d3.axisLeft(yScale).tickValues([]));
    this.svg.append('text')
      .attr('class', 'y-axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', -this.margin.left)
      .attr('x', -innerH / 2)
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .text('Années de repêchage');

    // Horizontal axes for each bin
    const xScale = d3.scaleLinear().domain([0, this.statMax]).range([0, innerW]);
    const ticks = d3.range(0.1, this.statMax, 0.1);
    yearGroups.forEach((label, i) => {
      const yPos = (i + 1) * groupH;
      const axisG = this.svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0, ${yPos})`)
        .call(d3.axisBottom(xScale).tickValues(ticks));

      // Dashed separators between bins
      if (i < yearGroups.length - 1) {
        axisG.selectAll('path, line')
          .style('stroke-dasharray', '3,3')
          .style('stroke', 'lightgray');
      }

      // Bin label on left
      this.svg.append('text')
        .attr('class', 'group-label')
        .attr('x', '-10ex')
        .attr('y', yPos - groupH / 2)
        .attr('dy', '.35em')
        .style('font-size', '12px')
        .style('text-anchor', 'start')
        .text(label);
    });

    // Bottom x-axis title
    this.svg.append('text')
      .attr('class', 'x-axis-title')
      .attr('x', innerW / 2)
      .attr('y', innerH + this.margin.bottom - 10)
      .attr('text-anchor', 'middle')
      .text(this.getXAxisLabel());
  }

  /**
   * Bind flattened data to circles and animate:
   * - Exit: shrink and remove old circles.
   * - Update: move existing circles to new x/y.
   * - Enter: fade in new circles if any.
   */
  private updateCircles(yearGroups: string[]): void {
    const groupH = this.computeGroupHeight(yearGroups);
    const innerW = this.width - this.margin.left - this.margin.right;
    const xScale = d3.scaleLinear().domain([0, this.statMax]).range([0, innerW]);
    const { getOrder, getColor } = this.getOrderAndColor();

    // Flatten nested data for data-join
    const flatData: FlatDatum[] = [];
    this.binnedData.forEach(bin => {
      const sorted = bin.players.sort((a, b) => getOrder(a) - getOrder(b));
      sorted.forEach((p, i) => {
        flatData.push({
          id: p.id!,
          stat: bin.stat,
          yearGroup: bin.yearGroup,
          orderIndex: i,
          color: getColor(p)
        });
      });
    });

    const circles = this.svg.selectAll<SVGCircleElement, FlatDatum>('circle')
      .data(flatData, d => d.id.toString());

    // Exit old points
    circles.exit()
      .transition().duration(500)
        .attr('r', 0)
      .remove();

    // Update existing points
    circles.transition().duration(750)
      .attr('cx', d => xScale(d.stat))
      .attr('cy', d => {
        const idx = yearGroups.indexOf(d.yearGroup);
        return (idx + 1) * groupH - (d.orderIndex + 1) * this.circleSpacing;
      })
      .attr('fill', d => d.color);

    // Enter new points
    circles.enter()
      .append('circle')
        .attr('cx', d => xScale(d.stat))
        .attr('cy', d => {
          const idx = yearGroups.indexOf(d.yearGroup);
          return (idx + 1) * groupH - (d.orderIndex + 1) * this.circleSpacing;
        })
        .attr('r', 0)
        .attr('fill', d => d.color)
      .transition().duration(500)
        .attr('r', this.circleRadius);
  }

  /**
   * Draw the color legend at top-right:
   * - Maps grouping categories to colors.
   */
  private drawLegend(): void {
    const innerW = this.width - this.margin.left - this.margin.right;
    const items = this.selectedGrouping === 'nationality'
      ? [
          { label: 'Canada', color: 'red' },
          { label: 'États-Unis', color: 'blue' },
          { label: 'Autres', color: 'green' }
        ]
      : [
          { label: '≤18 ans', color: '#d3d3d3' },
          { label: '19 ans',  color: '#808080' },
          { label: '≥20 ans', color: '#2f2f2f' }
        ];

    // Remove old legend group
    this.svg.selectAll('.legend').remove();

    const boxW = 120;
    const itemH = 20;
    const boxH = items.length * itemH + 10;
    const x0 = innerW - boxW - 10;
    const y0 = 10;

    const legend = this.svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${x0},${y0})`);

    legend.append('rect')
      .attr('width', boxW)
      .attr('height', boxH)
      .attr('fill', 'white')
      .attr('stroke', 'black');

    items.forEach((d, i) => {
      const y = 5 + i * itemH;
      legend.append('rect')
        .attr('x', 5).attr('y', y)
        .attr('width', 15).attr('height', 15)
        .attr('fill', d.color);
      legend.append('text')
        .attr('x', 25).attr('y', y + 12)
        .style('font-size', '12px')
        .text(d.label);
    });
  }

  /**
   * Compute fixed height per 5-year bin based on max stack size.
   */
  private computeGroupHeight(yearGroups: string[]): number {
    const maxStack = d3.max(this.binnedData, d => d.players.length) || 1;
    return ((maxStack + 1) * this.circleSpacing) + 10;
  }

  /**
   * Return x-axis title depending on selected metric.
   */
  private getXAxisLabel(): string {
    return this.selectedMetric === 'points'
      ? 'Points par match'
      : this.selectedMetric === 'goals'
        ? 'Buts par match'
        : 'Passes par match';
  }

  /**
   * Return ordering + color functions for current grouping
   */
  private getOrderAndColor(): {
    getOrder: (p: DraftPlayer) => number;
    getColor: (p: DraftPlayer) => string;
  } {
    if (this.selectedGrouping === 'nationality') {
      return {
        getOrder: p => p.nationality === 'CA' ? 1 : p.nationality === 'US' ? 2 : 3,
        getColor: p => p.nationality === 'CA' ? 'red'
                     : p.nationality === 'US' ? 'blue' : 'green'
      };
    } else {
      return {
        getOrder: p => p.age <= 18 ? 1 : p.age === 19 ? 2 : 3,
        getColor: p => p.age <= 18 ? '#d3d3d3'
                     : p.age === 19 ? '#808080' : '#2f2f2f'
      };
    }
  }
}
