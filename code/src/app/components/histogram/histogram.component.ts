import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import * as d3 from 'd3';
import { DataPreprocessingService, DraftPlayer } from '../../services/preprocessing/preprocessing.service';

@Component({
  selector: 'app-histogram',
  templateUrl: './histogram.component.html',
  styleUrls: ['./histogram.component.scss']
})
export class HistogramComponent implements AfterViewInit {

  @ViewChild('chart', { static: true })
  private chartContainer!: ElementRef<SVGSVGElement>;

  // Margins around the drawable area
  private readonly margin = { top: 20, right: 30, bottom: 50, left: 100 };
  // Width fills 95% of viewport; height recalculated per data
  private width = window.innerWidth * 0.95;
  private height = 1200;

  // Spacing and size for each circle
  private readonly circleSpacing = 5;
  private readonly circleRadius = 2;

  // Full SVG <g> container
  private svg!: d3.Selection<SVGGElement, unknown, null, undefined>;

  // Raw loaded data & derived values
  private rawPlayers: DraftPlayer[] = [];
  private statMax = 1;
  private binnedData: { stat: number; yearGroup: string; players: DraftPlayer[] }[] = [];

  // UI selections
  selectedMetric: 'points' | 'goals' | 'assists' = 'points';
  selectedGrouping: 'nationality' | 'age' = 'nationality';

  constructor(private preprocessing: DataPreprocessingService) {}

  ngAfterViewInit(): void {
    this.initSvg();
    this.preprocessing.loadDraftData().subscribe(players => {
      this.rawPlayers = players;
      this.processAndDraw(); 
    });
  }

  /** Handler when metric dropdown changes */
  onMetricChange(evt: Event): void {
    this.selectedMetric = (evt.target as HTMLSelectElement).value as any;
    this.processAndDraw();
  }

  /** Handler when grouping toggle changes */
  onGroupingToggle(evt: Event): void {
    this.selectedGrouping = (evt.target as HTMLInputElement).checked ? 'age' : 'nationality';
    this.processAndDraw();
  }

  /** Prepare data, clear old chart, then render new histogram */
  private processAndDraw(): void {
    this.svg.selectAll('*').remove();

    // Compute per-game stat and year grouping
    const withStats = this.rawPlayers
      .map(p => {
        const perGame = this.preprocessing.calculatePerGameStats(p);
        const value = perGame[
          this.selectedMetric === 'points' ? 'pointsPerGame'
          : this.selectedMetric === 'goals'  ? 'goalsPerGame'
          : 'assistsPerGame'
        ];
        return { ...p, stat: Math.round(value * 100) / 100 } as DraftPlayer & { stat: number };
      })
      .filter(p => p.stat > 0);

    // Determine maximum stat for x‑axis scale
    this.statMax = d3.max(withStats, d => d.stat) || 1;

    // Group into 5‑year bins
    const yearGroups = Array.from(new Set(withStats.map(d => this.getYearGroup(d.year))))
      .sort((a, b) => +a.split('-')[0] - +b.split('-')[0]);

    // Nest by yearGroup & stat value
    this.binnedData = [];
    const nested = d3.group(withStats, d => this.getYearGroup(d.year), d => d.stat);
    nested.forEach((mapStat, yearGroup) => {
      mapStat.forEach(players => {
        this.binnedData.push({ yearGroup, stat: players[0].stat, players });
      });
    });

    this.drawChart(yearGroups);
  }

  /** Initialize main SVG and translate for margins */
  private initSvg(): void {
    this.svg = d3.select(this.chartContainer.nativeElement)
      .attr('width', this.width)
      .attr('height', this.height)
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
  }

  /** Draw full histogram: axes, circles, legend */
  private drawChart(yearGroups: string[]): void {
    const groupHeight = this.computeGroupHeight(yearGroups);
    const innerHeight = yearGroups.length * groupHeight;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    // Resize SVG to fit data
    d3.select(this.chartContainer.nativeElement)
      .attr('height', this.margin.top + this.margin.bottom + innerHeight);

    // 1) draw axes and labels
    const xScale = this.drawAxes(yearGroups, groupHeight, innerWidth, innerHeight);

    // 2) draw one circle per player in correct bin
    this.drawCircles(yearGroups, groupHeight, xScale);

    // 3) add color legend at top right
    this.drawLegend(innerWidth);
  }

  /** Compute fixed height per year group based on max stack */
  private computeGroupHeight(yearGroups: string[]): number {
    // find maximum stack size across all bins
    const maxStack = d3.max(this.binnedData, d => d.players.length) || 1;
    return ((maxStack + 1) * this.circleSpacing) + 10;
  }

  /**
   * Draw vertical group labels and horizontal axes.
   * - vertical: year-range text on left
   * - horizontal: ticks repeated per group, dashed lines except last
   */
  private drawAxes(
    yearGroups: string[],
    groupHeight: number,
    innerWidth: number,
    innerHeight: number
  ): d3.ScaleLinear<number, number> {
    // vertical axis (just a line), plus rotated title
    const y = d3.scaleLinear().domain([0, innerHeight]).range([0, innerHeight]);
    this.svg.append('g').call(d3.axisLeft(y).tickValues([]));
    this.svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -this.margin.left)
      .attr('x', -innerHeight / 2)
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .text('Années de repêchage');

    // horizontal scale
    const x = d3.scaleLinear().domain([0, this.statMax]).range([0, innerWidth]);
    const ticks = d3.range(0.1, this.statMax, 0.1);

    yearGroups.forEach((label, i) => {
      const yPos = i * groupHeight + groupHeight;
      const axis = this.svg.append('g')
        .attr('transform', `translate(0, ${yPos})`)
        .call(d3.axisBottom(x).tickValues(ticks));
      // apply dashed grid only on internal separators
      if (i < yearGroups.length - 1) {
        axis.selectAll('path, line')
          .style('stroke-dasharray', '3,3')
          .style('stroke', 'lightgray');
      }
      // year‑range text beside each band
      this.svg.append('text')
        .attr('x', '-10ex')
        .attr('y', yPos - groupHeight / 2)
        .attr('dy', '.35em')
        .style('font-size', '12px')
        .style('text-anchor', 'start')
        .text(label);
    });

    // x-axis title at bottom
    this.svg.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + this.margin.bottom - 10)
      .attr('text-anchor', 'middle')
      .text(this.getXAxisLabel());

    return x;
  }

  /** Place one circle per player into its stat‑bin and year‑band */
  private drawCircles(
    yearGroups: string[],
    groupHeight: number,
    xScale: d3.ScaleLinear<number, number>
  ): void {
    const { getOrder, getColor } = this.getOrderAndColor();
    // iterate each bin
    this.binnedData.forEach(bin => {
      const idx = yearGroups.indexOf(bin.yearGroup);
      if (idx < 0) return;
      // sort within bin for consistent stacking
      const sorted = bin.players.sort((a, b) => getOrder(a) - getOrder(b));
      sorted.forEach((p, i) => {
        const cx = xScale(bin.stat);
        const cy = (idx + 1) * groupHeight - (i + 1) * this.circleSpacing;
        this.svg.append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', this.circleRadius)
          .attr('fill', getColor(p));
      });
    });
  }

  /** Draw color legend matching current grouping */
  private drawLegend(innerWidth: number): void {
    const items = this.selectedGrouping === 'nationality'
      ? [{ label: 'Canada',   color: 'red' }]
        .concat([{ label: 'États-Unis', color: 'blue' }, { label: 'Autres', color: 'green' }])
      : [{ label: '≤18 ans',   color: '#d3d3d3' }]
        .concat([{ label: '19 ans', color: '#808080' }, { label: '≥20 ans', color: '#2f2f2f' }]);

    const boxW = 120, itemH = 20, boxH = items.length * itemH + 10;
    const x0 = innerWidth - boxW - 10, y0 = 10;

    const legend = this.svg.append('g')
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

  /** Label for x-axis based on chosen metric */
  private getXAxisLabel(): string {
    return this.selectedMetric === 'points'
      ? 'Points par match'
      : this.selectedMetric === 'goals'
        ? 'Buts par match'
        : 'Passes par match';
  }

  /** Return ordering + color functions for current grouping */
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
        getColor: p => p.age <= 18 ? '#d3d3d3' : p.age === 19 ? '#808080' : '#2f2f2f'
      };
    }
  }

  /** Determine 5‑year bin label */
  private getYearGroup(year: number): string {
    const start = 1963 + Math.floor((year - 1963) / 5) * 5;
    const end = Math.min(start + 4, 2022);
    return `${start}-${end}`;
  }
}
