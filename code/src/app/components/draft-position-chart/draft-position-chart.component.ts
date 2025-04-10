import { Component, Input, OnChanges, SimpleChanges, ElementRef, ViewChild } from '@angular/core';
import { DraftPlayer } from '../../services/preprocessing/preprocessing.service';
import * as d3 from 'd3';

export interface StatConfig {
  key?: keyof DraftPlayer;
  label: string;
  format?: (value: number) => string;
  customCalculation?: (players: DraftPlayer[]) => number;
}

@Component({
  selector: 'app-draft-position-chart',
  templateUrl: './draft-position-chart.component.html',
  styleUrls: ['./draft-position-chart.component.scss']
})
export class DraftPositionChartComponent implements OnChanges {
  @Input() players: DraftPlayer[] = [];
  @Input() statConfig: StatConfig = { key: 'games_played', label: 'Matchs joués' };
  @Input() title: string = '';
  @Input() yAxisLabel: string = '';
  @Input() splitByPosition: boolean = false;
  
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef;

  // Catégories de positions
  private forwardPositions = ['C', 'LW', 'RW'];
  private defensePositions = ['D'];
  private goaliePositions = ['G'];

  // Données agrégées
  private aggregatedData: any[] = [];
  private positionData: { [key: string]: any[] } = {};

  // Constantes pour les marges et dimensions
  private margin = { top: 30, right: 50, bottom: 40, left: 50 };
  private width = 800;
  private height = 400;
  
  // Variables pour stocker les éléments SVG
  private svg: any;
  private xScale: any;
  private yScale: any;
  private line: any;
  private tooltip: any;

  constructor() {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['players'] && !changes['players'].firstChange) || 
        (changes['statConfig'] && !changes['statConfig'].firstChange) ||
        (changes['splitByPosition'] && !changes['splitByPosition'].firstChange)) {
      this.processData();
      this.renderChart();
    }
  }

  ngAfterViewInit(): void {
    this.initChart();
    this.processData();
    this.renderChart();
  }

  private initChart(): void {
    // Nettoyer le conteneur
    d3.select(this.chartContainer.nativeElement).selectAll('*').remove();

    // Calculer les dimensions réelles
    const element = this.chartContainer.nativeElement;
    this.width = element.offsetWidth - this.margin.left - this.margin.right;
    this.height = element.offsetHeight - this.margin.top - this.margin.bottom;

    // Créer le SVG
    this.svg = d3.select(element)
      .append('svg')
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.height + this.margin.top + this.margin.bottom)
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    // Ajouter le titre
    this.svg.append('text')
      .attr('class', 'chart-title')
      .attr('x', this.width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .text(this.title || `${this.statConfig.label} par position au repêchage`);

    // Créer les axes
    this.xScale = d3.scaleLinear()
      .range([0, this.width]);

    this.yScale = d3.scaleLinear()
      .range([this.height, 0]);

    // Ajouter les axes
    this.svg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0,${this.height})`)
      .append('text')
      .attr('class', 'axis-label')
      .attr('x', this.width / 2)
      .attr('y', 35)
      .attr('text-anchor', 'middle')
      .text('Position au repêchage');

    this.svg.append('g')
      .attr('class', 'y-axis')
      .append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', -40)
      .attr('x', -this.height / 2)
      .attr('text-anchor', 'middle')
      .text(this.yAxisLabel || this.statConfig.label);

    // Créer le générateur de ligne
    this.line = d3.line()
      .x((d: any) => this.xScale(d.overallPick))
      .y((d: any) => this.yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Créer un tooltip
    this.tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background-color', 'white')
      .style('border', '1px solid #ddd')
      .style('border-radius', '4px')
      .style('padding', '8px')
      .style('pointer-events', 'none');
  }

  private processData(): void {
    this.aggregatedData = [];
    this.positionData = {
      forwards: [],
      defense: [],
      goalies: []
    };
  
    const groupedByPick = this.players.reduce((acc, player) => {
      if (!acc[player.overall_pick]) {
        acc[player.overall_pick] = [];
      }
      acc[player.overall_pick].push(player);
      return acc;
    }, {} as { [pick: number]: DraftPlayer[] });
  
    const isCustom = !!this.statConfig.customCalculation;
  
    Object.keys(groupedByPick).forEach(pickStr => {
      const pick = parseInt(pickStr);
      const players = groupedByPick[pick];
  
      const forwards = players.filter(p => this.forwardPositions.includes(p.position));
      const defense = players.filter(p => this.defensePositions.includes(p.position));
      const goalies = players.filter(p => this.goaliePositions.includes(p.position));
  
      const calculate = (group: DraftPlayer[]) =>
        isCustom
          ? this.statConfig.customCalculation!(group)
          : this.calculateAverage(group, this.statConfig.key!);
  
      this.aggregatedData.push({
        overallPick: pick,
        count: players.length,
        value: calculate(players)
      });
  
      this.positionData['forwards'].push({
        overallPick: pick,
        count: forwards.length,
        value: calculate(forwards)
      });
  
      this.positionData['defense'].push({
        overallPick: pick,
        count: defense.length,
        value: calculate(defense)
      });
  
      this.positionData['goalies'].push({
        overallPick: pick,
        count: goalies.length,
        value: calculate(goalies)
      });
    });
  
    this.aggregatedData.sort((a, b) => a.overallPick - b.overallPick);
    this.positionData['forwards'].sort((a, b) => a.overallPick - b.overallPick);
    this.positionData['defense'].sort((a, b) => a.overallPick - b.overallPick);
    this.positionData['goalies'].sort((a, b) => a.overallPick - b.overallPick);
  }
  
  private calculateAverage(players: DraftPlayer[], key: keyof DraftPlayer): number {
    if (!players.length) return 0;
    
    const validPlayers = players.filter(p => p[key] !== null);
    if (!validPlayers.length) return 0;
    
    const sum = validPlayers.reduce((acc, player) => {
      return acc + (player[key] as number);
    }, 0);
    
    return sum / validPlayers.length;
  }

  private renderChart(): void {
    if (!this.svg) return;

    // Nettoyer le graphique existant
    this.svg.selectAll('.line').remove();
    this.svg.selectAll('.dot').remove();
    this.svg.selectAll('.round-separator').remove();

    // Mise à jour des domaines
    const allData = this.splitByPosition
      ? [...this.positionData['forwards'], ...this.positionData['defense']]
      : this.aggregatedData;
    
    const maxPick = d3.max(allData, (d: any) => d.overallPick) || 31;
    const maxValue = d3.max(allData, (d: any) => d.value) || 0;
    
    this.xScale.domain([1, maxPick]);
    this.yScale.domain([0, maxValue * 1.1]);
    
    // Mise à jour des axes
    this.svg.select('.x-axis')
      .transition()
      .duration(300)
      .call(d3.axisBottom(this.xScale).ticks(10).tickFormat((d) => d.toString()));
    
    this.svg.select('.y-axis')
      .transition()
      .duration(300)
      .call(d3.axisLeft(this.yScale));
    
    // Ajouter les séparateurs de ronde (chaque ronde a 31 joueurs sélectionnés)
    // TODO: Ajuster la position des séparateurs
    const rounds = Math.ceil(maxPick / 31);
    for (let i = 1; i < rounds; i++) {
      this.svg.append('line')
        .attr('class', 'round-separator')
        .attr('x1', this.xScale(i * 31 + 0.5))
        .attr('y1', 0)
        .attr('x2', this.xScale(i * 31 + 0.5))
        .attr('y2', this.height)
        .style('stroke', '#ccc')
        .style('stroke-dasharray', '4,4')
        .style('stroke-width', 1);
      
      this.svg.append('text')
        .attr('class', 'round-label')
        .attr('x', this.xScale(i * 31 + 0.5) - 20)
        .attr('y', 15)
        .text(`Ronde ${i+1}`);
    }
    
    if (this.splitByPosition) {
      // Dessiner les lignes pour chaque groupe de position
      this.drawPositionLine(this.positionData['forwards'], 'steelblue', 'Attaquants');
      this.drawPositionLine(this.positionData['defense'], 'green', 'Défenseurs');
    } else {
      // Dessiner une seule ligne pour tous les joueurs
      this.drawPositionLine(this.aggregatedData, 'black', 'Tous les joueurs');
    }
  }

  private drawPositionLine(data: any[], color: string, label: string): void {
    this.svg.append('path')
      .datum(data)
      .attr('class', 'line')
      .attr('d', this.line)
      .style('fill', 'none')
      .style('stroke', color)
      .style('stroke-width', 2)
      .style('opacity', 0)
      .transition()
      .duration(500)
      .style('opacity', 1);
    
    // Ajouter des points
    this.svg.selectAll(`.dot-${label.toLowerCase().replace(' ', '-')}`)
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', (d: any) => this.xScale(d.overallPick))
      .attr('cy', (d: any) => this.yScale(d.value))
      .attr('r', 4)
      .style('fill', color)
      .style('opacity', 0)
      .transition()
      .duration(500)
      .style('opacity', 1)
      .on('mouseover', (event: any, d: any) => {
        this.tooltip.transition()
          .duration(200)
          .style('opacity', .9);
        
        let formattedValue = d.value.toFixed(2);
        if (this.statConfig.format) {
          formattedValue = this.statConfig.format(d.value);
        }
        
        this.tooltip.html(`
          <strong>Position au repêchage:</strong> ${d.overallPick}<br>
          <strong>Groupe:</strong> ${label}<br>
          <strong>${this.statConfig.label}:</strong> ${formattedValue}<br>
          <strong>Nombre de joueurs:</strong> ${d.count}
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', () => {
        this.tooltip.transition()
          .duration(500)
          .style('opacity', 0);
      });
    
    
    const legendX = this.width - 150;
    const legendY = 20 + (this.splitByPosition ? [...this.positionData['forwards'], ...this.positionData['defense']].indexOf(data[0]) * 20 : 0);
    
    this.svg.append('line')
      .attr('x1', legendX)
      .attr('y1', legendY)
      .attr('x2', legendX + 20)
      .attr('y2', legendY)
      .style('stroke', color)
      .style('stroke-width', 2);
    
    this.svg.append('text')
      .attr('x', legendX + 25)
      .attr('y', legendY + 4)
      .text(label)
      .style('font-size', '12px');
  }
}