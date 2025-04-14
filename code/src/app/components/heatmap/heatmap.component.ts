import { Component, OnInit } from '@angular/core';
import * as d3 from 'd3';
import * as d3Chromatic from 'd3-scale-chromatic';
import { DataPreprocessingService, DraftPlayer } from '../../services/preprocessing/preprocessing.service';
import { sliderRight } from 'd3-simple-slider';

type HeatmapData = { year: number; stat: string; correlation: number; nb_players_considered: number };

@Component({
  selector: 'app-heatmap',
  templateUrl: './heatmap.component.html',
  styleUrls: ['./heatmap.component.scss']
})
export class HeatmapComponent implements OnInit {
  private data: HeatmapData[] = [];
  private margin = { top: 35, right: 200, bottom: 80, left: 200 };
  private xScale: d3.ScaleBand<string> = d3.scaleBand<string>().padding(0.05);
  private yScale: d3.ScaleBand<string> = d3.scaleBand<string>().padding(0.01);
  private colorScale: any = d3.scaleSequential(d3Chromatic.interpolatePiYG);

  private bounds: any;
  private graphSize: any;
  private svgSize: {
    width: number,
    height: number
  } = { width: window.innerWidth * 0.9, height: 650 };

  private sliderScale: d3.ScaleLinear<number, number> = d3.scaleLinear();
  private minValue: number = -1;
  private maxValue: number = 1;

  private grayOverlayTop: any;
  private grayOverlayBottom: any;

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

    this.xScale.domain(years).range([0, 400]);
    this.yScale.domain(stats).range([0, 80]);

    const g = this.generateG();

    g.append('g')
      .attr('class', 'x axis')
  
    g.append('g')
      .attr('class', 'y axis')

    g.selectAll('rect')
      .data(this.data)
      .enter()
      .append('rect')
      .attr('class', 'cell');

    this.updateRects();
  
    this.setSizing()
    this.build()
  }

  private updateRects() {
    d3.selectAll<SVGRectElement, HeatmapData>('.cell')
    .attr('x', d => this.xScale(String(d.year))!)
    .attr('y', d => this.yScale(d.stat)!)
    .attr('width', this.xScale.bandwidth())
    .attr('height', this.yScale.bandwidth())
    .attr('fill', d => {
      if (d.correlation >= this.minValue && d.correlation <= this.maxValue) {
        return this.colorScale(d.correlation);
      } else {
        const originalColor = d3.hsl(this.colorScale(d.correlation));
        return d3.hsl(0, 0, originalColor.l).toString();
      }
    });
  }

  private setSizing () {
    const graphElement = d3.select('.graph').node() as HTMLElement | null;
    this.bounds = graphElement?.getBoundingClientRect();

    this.svgSize = {
      width: this.bounds.width,
      height: 550
    }

    this.graphSize = {
      width: this.svgSize.width - this.margin.right - this.margin.left,
      height: this.svgSize.height - this.margin.bottom - this.margin.top
    }

    this.setCanvasSize(this.svgSize.width, this.svgSize.height)
  }

  private setCanvasSize (width: number, height: number) {
    d3.select('#heatmap').select('svg')
      .attr('width', width)
      .attr('height', height)
  }

  private build() {
    this.updateXScale();
    this.updateYScale();

    this.drawXAxis();
    this.drawYAxis();

    // X axis label
    d3.select('#graph-g')
    .append('text')
    .attr('class', 'x-axis-label')
    .attr('x', this.graphSize.width / 2)
    .attr('y', this.graphSize.height + 60)
    .attr('text-anchor', 'middle')
    .text('Année de repêchage');

    // Y axis label
    d3.select('#graph-g')
    .append('text')
    .attr('class', 'y-axis-label')
    .attr('x', -this.graphSize.height / 2)
    .attr('y', -60)
    .attr('transform', 'rotate(-90)')
    .attr('text-anchor', 'middle')
    .text('Statistiques');

    this.updateRects();

    this.setRectHandler();

    this.initGradient()
    this.initLegendBar()
    this.initLegendAxis()

    const legendX = this.margin.left + this.graphSize.width + 50;

    this.drawLegend(
      legendX,
      this.margin.top,
      this.graphSize.height,
      15,
      'url(#gradient)'
    );

    this.initSlider(legendX+25, this.margin.top-this.graphSize.height, this.graphSize.height);
  }

  private updateXScale() {
    const years = Array.from(new Set(this.data.map(d => d.year))).sort()
    this.xScale.domain(years.map(year => String(year))).range([0, this.graphSize.width])
  }

  private updateYScale() {
    const stats = ['goals', 'assists', 'points', 'games_played'];
    this.yScale.domain(stats).range([0, this.graphSize.height])
  }

  private drawXAxis() {
    const xAxis = d3.axisBottom(this.xScale);

    d3.select<SVGGElement, unknown>('.x.axis')
      .attr('transform', `translate(0, ${this.graphSize.height})`)
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "middle")
      .attr("transform", "rotate(45)")
      .attr("dy", "0.5em") 
      .attr("dx", "1.5em");
  }

  private drawYAxis() {
    const yAxis = d3.axisLeft(this.yScale)
      .tickFormat(d => this.getStatLabel(d));

    d3.select<SVGGElement, unknown>('.y.axis')
      .attr('transform', `translate(0, 0)`)
      .call(yAxis);
  }

  private setRectHandler(): void {
    const tooltip = d3.select('#tooltip');
  
    d3.selectAll<SVGRectElement, HeatmapData>('.cell')
      .on('mouseover', (event, d: HeatmapData) => {
        tooltip
          .style('opacity', 1)
          .html(`
            <strong>Année :</strong> ${d.year}<br/>
            <strong>Statistique :</strong> ${this.getStatLabel(d.stat)}<br/>
            <strong>Corrélation :</strong> ${d.correlation.toFixed(2)}
          `);
  
        this.selectTicks(d.stat, d.year);
  
        d3.select(event.currentTarget as SVGRectElement)
          .raise()
          .attr('stroke', 'rgb(69, 69, 69)')
          .attr('stroke-width', 2);
      })
      .on('mousemove', (event) => {
        const tooltipNode = tooltip.node() as HTMLElement;
        const tooltipWidth = tooltipNode?.offsetWidth || 150;
        const tooltipHeight = tooltipNode?.offsetHeight || 80;
  
        tooltip
          .style('left', `${event.pageX - tooltipWidth / 2}px`)
          .style('top', `${event.pageY - tooltipHeight - 10}px`);
      })
      .on('mouseout', (event) => {
        tooltip.style('opacity', 0);
        this.unselectTicks();
  
        d3.select(event.currentTarget as SVGRectElement)
          .attr('stroke', 'none')
          .attr('stroke-width', null);
      });
  }
  

  private getStatLabel(stat: string): string {
    const statLabels: Record<string, string> = {
      games_played: 'Matchs joués',
      goals: 'Buts',
      assists: 'Passes',
      points: 'Points'
    };
    return statLabels[stat] ?? stat;
  }
  
  private selectTicks(stat: string, year: number): void {
    d3.selectAll('.x.axis .tick text')
      .filter(d => d === String(year))
      .attr('font-weight', 'bold');
  
    d3.selectAll('.y.axis .tick text')
      .filter(d => d === stat)
      .attr('font-weight', 'bold');
  }
  
  private unselectTicks(): void {
    d3.selectAll('.x.axis .tick text, .y.axis .tick text')
      .attr('font-weight', 'normal');
  }

  private initGradient() {
    const svg = d3.select('.heatmap-svg');
  
    const defs = svg.append('defs');
  
    const linearGradient = defs
      .append('linearGradient')
      .attr('id', 'gradient')
      .attr('x1', 0)
      .attr('y1', 1)
      .attr('x2', 0)
      .attr('y2', 0);

    type GradientStop = {
      offset: string;
      color: string;
    };
    
    const stops: GradientStop[] = this.colorScale.ticks().map((tick: any, i: number, nodes: string | any[]) => ({
      offset: `${100 * (i / nodes.length)}%`,
      color: this.colorScale(tick)
    }));
    
    linearGradient
      .selectAll<SVGStopElement, GradientStop>('stop')
      .data(stops)
      .join('stop')
      .attr('offset', d => d.offset)
      .attr('stop-color', d => d.color);
  }

  private initLegendBar() {
    const svg = d3.select('.heatmap-svg');
    svg.append('rect').attr('class', 'legend bar');
  }

  private initLegendAxis() {
    const svg = d3.select('.heatmap-svg');
    svg
      .append('g')
      .attr('class', 'legend axis');
  }

  private drawLegend(
    x: number,
    y: number,
    height: number,
    width: number,
    fill: string
  ) {
    const svg = d3.select('.heatmap-svg');
  
    svg.select('.legend.bar')
      .attr('x', x)
      .attr('y', y)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', fill);
  
    const legendScale = d3.scaleLinear()
      .domain(this.colorScale.domain())
      .range([height, 0]);
  
    const legendAxis = d3.axisLeft(legendScale)
      .ticks(5);

    (svg.select('.legend.axis') as d3.Selection<SVGGElement, unknown, HTMLElement, undefined>)
      .attr('transform', `translate(${x - width + 10}, ${y})`)
      .call(legendAxis);
    
    this.grayOverlayTop = svg.append('rect')
      .attr('class', 'legend-overlay top')
      .attr('x', x)
      .attr('y', y)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'none');

    this.grayOverlayBottom = svg.append('rect')
      .attr('class', 'legend-overlay bottom')
      .attr('x', x)
      .attr('y', y)
      .attr('height', height)
      .attr('width', width)
      .attr('fill', 'none');
  }

  private initSlider(x: number, y: number, height: number) {
    const svg = d3.select('.heatmap-svg');

    this.sliderScale = d3.scaleLinear()
      .domain(this.colorScale.domain())
      .range([height, 0]);
    
    const slider = (sliderRight(this.sliderScale) as any)
      .min(1)
      .max(-1)
      .height(height)
      .default([-1, 1])
      .step(0.01)
      .ticks(0)
      .fill('none')
      .on('onchange', (val: [number, number]) => {
        this.minValue = val[0];
        this.maxValue = val[1];
        this.updateRects();
        this.updateSliderOverlays(height);
      });

    svg.append('g')
    .attr('transform', `translate(${x}, ${y})`)
    .call(slider);
  }

  private updateSliderOverlays(height: number) {
    const minY = this.sliderScale(this.minValue);
    const maxY = this.sliderScale(this.maxValue);

    this.grayOverlayTop
      .attr('height', maxY)
      .attr('fill', 'rgba(117, 117, 117, 0.7)');

    this.grayOverlayBottom
      .attr('y', this.margin.top + minY)
      .attr('height', height - minY)
      .attr('fill', 'rgba(117, 117, 117, 0.7)');
  }
}