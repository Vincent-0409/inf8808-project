import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import * as d3 from 'd3';
import { DataManagerService, PlayerData } from '../../services/data-manager/data-manager.service';

@Component({
  selector: 'app-histogram',
  templateUrl: './histogram.component.html',
  styleUrls: ['./histogram.component.scss']
})
export class HistogramComponent implements OnInit, AfterViewInit {

  @ViewChild('chart') private chartContainer!: ElementRef<SVGSVGElement>;

  // Dimensions and margins
  private margin = { top: 20, right: 30, bottom: 50, left: 80 };
  private width = window.innerWidth * 0.95;
  private height = 1200; // initial height (will be recalculated)
  private circleSpacing = 5
  private circleRadius = 2

  private svg!: d3.Selection<SVGGElement, unknown, any, any>;
  rawData: any[] = [];
  pointsMax: number = 1;

  // Selected options
  selectedMetric: 'points' | 'goals' | 'assists' = 'points';
  selectedGrouping: 'nationality' | 'age' = 'nationality';

  private allData: PlayerData[] = [];

  constructor(private dataManager: DataManagerService) { }

  ngOnInit(): void { }

  ngAfterViewInit(): void {
    this.createSvg();
    this.dataManager.loadRawDataForHistogram('assets/nhldraft.csv')
      .then(result => {
        this.rawData = result.rawData;
        this.pointsMax = result.pointsMax;
        this.allData = this.dataManager.processDataForHistogram(this.rawData, this.selectedMetric);
        this.drawChart(this.allData);
      })
      .catch(error => console.error("CSV load error:", error));
  }

  // Called when the metric dropdown changes
  onMetricChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedMetric = selectElement.value as 'points' | 'goals' | 'assists';
    this.redraw();
  }

  // Called when the grouping toggle changes
  onGroupingToggle(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.selectedGrouping = inputElement.checked ? 'age' : 'nationality';
    this.redraw();
  }

  // Redraws the chart
  private redraw(): void {
    this.svg.selectAll("*").remove();
    this.allData = this.dataManager.processDataForHistogram(this.rawData, this.selectedMetric);
    this.drawChart(this.allData);
  }

  // Creates the SVG element and main group
  private createSvg(): void {
    this.svg = d3.select(this.chartContainer.nativeElement)
      .attr('width', this.width)
      .attr('height', this.height)
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
  }

  // Computes layout parameters: year groups, fixed group height, inner dimensions
  private computeLayout(data: PlayerData[]): { yearGroups: string[], fixedGroupHeight: number, innerHeight: number, innerWidth: number } {
    const yearGroups = Array.from(new Set(data.map(d => d.yearGroup)))
      .sort((a, b) => +a.split('-')[0] - +b.split('-')[0]);
    const nested = d3.group(data, d => d.yearGroup, d => d.stat);
    let globalMaxStack = 0;
    nested.forEach(mapStat => {
      mapStat.forEach(playersArray => {
        globalMaxStack = Math.max(globalMaxStack, playersArray.length);
      });
    });
    const fixedGroupHeight = ((globalMaxStack + 1) * this.circleSpacing) + 10;
    const innerHeight = yearGroups.length * fixedGroupHeight;
    const innerWidth = this.width - this.margin.left - this.margin.right;
    const newHeight = this.margin.top + this.margin.bottom + innerHeight;
    d3.select(this.chartContainer.nativeElement).attr('height', newHeight);
    return { yearGroups, fixedGroupHeight, innerHeight, innerWidth };
  }

  // Draws vertical and horizontal axes and group labels
  private drawAxes(layout: { yearGroups: string[], fixedGroupHeight: number, innerHeight: number, innerWidth: number }): d3.ScaleLinear<number, number> {
    // Draw common vertical axis without ticks and its title
    const yLinear = d3.scaleLinear()
      .domain([0, layout.innerHeight])
      .range([0, layout.innerHeight]);
    this.svg.append('g').call(d3.axisLeft(yLinear).tickValues([]));
    this.svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -this.margin.left + 55)
      .attr("x", -layout.innerHeight / 2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .text("Années de repêchage");
    // Setup x-axis scale with common domain based on pointsMax
    const xScale = d3.scaleLinear()
      .domain([0, this.pointsMax])
      .range([0, layout.innerWidth]);
    const tickValues = d3.range(0.1, this.pointsMax, 0.1);
    layout.yearGroups.forEach((groupLabel, i) => {
      const groupY = i * layout.fixedGroupHeight;
      this.svg.append('g')
        .attr('transform', `translate(0, ${groupY + layout.fixedGroupHeight})`)
        .call(d3.axisBottom(xScale).tickValues(tickValues))
        .selectAll('path, line')
        .style('stroke-dasharray', i < layout.yearGroups.length - 1 ? '3,3' : '')
        .style('stroke', i < layout.yearGroups.length - 1 ? 'lightgray' : '');
      this.svg.append('text')
        .attr('x', -this.margin.left + 5)
        .attr('y', groupY + layout.fixedGroupHeight / 2)
        .attr('dy', '.35em')
        .text(groupLabel)
        .style('font-size', '12px')
        .style('text-anchor', 'start');
    });
    // Draw non-interactive x-axis title
    this.svg.append("text")
      .attr("x", layout.innerWidth / 2)
      .attr("y", layout.innerHeight + this.margin.bottom - 10)
      .attr("text-anchor", "middle")
      .text(this.getXAxisLabel());
    return xScale;
  }

  // Returns the x-axis title using switch-case based on selected metric
  private getXAxisLabel(): string {
    switch(this.selectedMetric) {
      case 'points': return "Points par match";
      case 'goals': return "Buts par match";
      case 'assists': return "Passes par match";
      default: return "";
    }
  }

  // Returns ordering and coloring functions based on grouping mode
  private getOrderAndColor(): { getOrder: (p: PlayerData) => number, getColor: (p: PlayerData) => string } {
    if (this.selectedGrouping === 'nationality') {
      return {
        getOrder: (p: PlayerData) => {
          switch(p.nationality) {
            case 'CA': return 1;
            case 'US': return 2;
            default: return 3;
          }
        },
        getColor: (p: PlayerData) => {
          switch(p.nationality) {
            case 'CA': return 'red';
            case 'US': return 'blue';
            default: return 'green';
          }
        }
      };
    } else {
      return {
        getOrder: (p: PlayerData) => {
          if (p.age <= 18) return 1;
          else if (p.age === 19) return 2;
          else return 3;
        },
        getColor: (p: PlayerData) => {
          if (p.age <= 18) return '#d3d3d3';
          else if (p.age === 19) return '#808080';
          else return '#2f2f2f';
        }
      };
    }
  }

  // Draws circles (data points) for each bin within each year group
  private drawCircles(layout: { yearGroups: string[], fixedGroupHeight: number, innerHeight: number, innerWidth: number }, xScale: d3.ScaleLinear<number, number>): void {
    const { getOrder, getColor } = this.getOrderAndColor();
    const nested = d3.group(this.allData, d => d.yearGroup, d => d.stat);
    nested.forEach((mapStat, currentGroup) => {
      const groupIndex = layout.yearGroups.indexOf(currentGroup);
      if (groupIndex === -1) return;
      const groupY = groupIndex * layout.fixedGroupHeight;
      const groupBandBottom = groupY + layout.fixedGroupHeight;
      mapStat.forEach((playersArray, currentStat) => {
        playersArray.sort((a, b) => getOrder(a) - getOrder(b));
        playersArray.forEach((player, i) => {
          const cx = xScale(currentStat);
          const cy = groupBandBottom - (i + 1) * this.circleSpacing;
          this.svg.append('circle')
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('r', this.circleRadius)
            .attr('fill', getColor(player));
        });
      });
    });
  }

  // Main drawChart function that combines layout, axes, circles, and legend drawing
  private drawChart(data: PlayerData[]): void {
    const layout = this.computeLayout(data);
    const xScale = this.drawAxes(layout);
    this.drawCircles(layout, xScale);
    this.addLegend(layout.innerWidth, layout.innerHeight);
  }

  // Adds a legend rectangle at the top right of the chart
  private addLegend(innerWidth: number, innerHeight: number): void {
    const legendData = this.selectedGrouping === 'nationality' ? [
      { label: 'Canada', color: 'red' },
      { label: 'États-Unis', color: 'blue' },
      { label: 'Autres', color: 'green' }
    ] : [
      { label: '≤18 ans', color: '#d3d3d3' },
      { label: '19 ans', color: '#808080' },
      { label: '≥20 ans', color: '#2f2f2f' }
    ];
    const legendWidth = 120;
    const legendItemHeight = 20;
    const legendHeight = legendData.length * legendItemHeight + 10;
    const legendX = innerWidth - legendWidth - 10;
    const legendY = 10;
    const legendGroup = this.svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${legendX},${legendY})`);
    legendGroup.append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', 'white')
      .attr('stroke', 'black')
      .attr('stroke-width', 1);
    legendData.forEach((d, i) => {
      const yPos = 5 + i * legendItemHeight;
      legendGroup.append('rect')
        .attr('x', 5)
        .attr('y', yPos)
        .attr('width', 15)
        .attr('height', 15)
        .attr('fill', d.color);
      legendGroup.append('text')
        .attr('x', 25)
        .attr('y', yPos + 12)
        .text(d.label)
        .style('font-size', '12px');
    });
  }
}
