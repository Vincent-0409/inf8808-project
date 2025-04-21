import { Component, OnInit, AfterViewInit, HostListener } from '@angular/core';
import { DataPreprocessingService, DraftPlayer } from '../../services/preprocessing/preprocessing.service';
import { NgZone } from '@angular/core';
import { take } from 'rxjs/operators';

import * as d3 from 'd3';

interface ChartDataPoint {
  position: number;
  value: number;
  stdDev: number;
  count: number;
}

interface SplitChartDataPoint {
  position: number;
  forwards: {
    value: number;
    stdDev: number;
    count: number;
  };
  defenders: {
    value: number;
    stdDev: number;
    count: number;
  };
}

export interface StatConfig {
  key?: keyof DraftPlayer;
  label: string;
  format?: (value: number) => string;
  customCalculation?: (players: DraftPlayer[]) => number;
}

interface GroupSummary {
  avgGames: number;
  avgGoals: number;
  avgAssists: number;
  regularPlayerPct: number;
}

interface SplitSummary {
  forwards: GroupSummary;
  defenders: GroupSummary;
}

@Component({
  selector: 'app-small-multiples',
  templateUrl: './small-multiples.component.html',
  styleUrls: ['./small-multiples.component.scss']
})
export class SmallMultiplesComponent implements OnInit, AfterViewInit {
  players: DraftPlayer[] = [];
  groupedPlayers: { [year: number]: DraftPlayer[] } = {};
  
  // Configuration des statistiques à afficher
  statConfigs: StatConfig[] = [
    { 
      key: 'games_played', 
      label: 'Matchs joués',
      format: (value: number) => value.toFixed(0)
    },
    { 
      key: 'goals', 
      label: 'Buts',
      format: (value: number) => value.toFixed(1)
    },
    { 
      key: 'assists', 
      label: 'Passes décisives',
      format: (value: number) => value.toFixed(1)
    },
    { 
      label: 'Pourcentage de joueurs réguliers', 
      format: (value: number) => value.toFixed(1) + '%',
      customCalculation: this.calculateRegularPlayerPercentage.bind(this)
    },
    { 
      key: 'point_shares', 
      label: 'Contribution aux points',
      format: (value: number) => value.toFixed(2)
    }
  ];
  
  isPositionSplit: boolean = false;
  yearRange: { min: number, max: number } = { min: 2000, max: 2022 };
  selectedDraftPosition: number | null = 1;
  positionGroups = {
    forwards: ['C', 'LW', 'RW', 'F'],
    defenders: ['D', 'G']
  };

  private margin = { top: 30, right: 30, bottom: 50, left: 60 };
  private width = 0;
  private height = 0;
  
  // Couleurs pour les différentes catégories de joueurs
  private colors = {
    forwards: '#ff7f0e',  // orange
    defenders: '#2ca02c'  // vert
  };

  constructor(
    private dataService: DataPreprocessingService,
    private ngZone: NgZone
  ) {}
  

  ngOnInit(): void {
    this.dataService.loadDraftData().subscribe(data => {
      this.players = data;
      this.groupPlayersByYear();
      
      // Filtrer les joueurs par plage d'années
      this.filterPlayersByYearRange();
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.renderCharts();
    }, 500);
  }

  // Si le fenêtre est redimensionnée, on doit re-rendre les graphiques
  @HostListener('window:resize')
  onResize() {
    setTimeout(() => {
        this.renderCharts();
    }, 100);
  }

  getYears(): string[] {
    return Object.keys(this.groupedPlayers);
  }

  groupPlayersByYear(): void {
    this.groupedPlayers = this.players.reduce((acc, player) => {
      if (!acc[player.year]) {
        acc[player.year] = [];
      }
      acc[player.year].push(player);
      return acc;
    }, {} as { [year: number]: DraftPlayer[] });
  }
  
  calculateRegularPlayerPercentage(players: DraftPlayer[]): number {
    if (!players.length) return 0;
    
    const regularPlayers = players.filter(player => 
      this.dataService.isRegularPlayer(player, 300)
    );
    
    return (regularPlayers.length / players.length) * 100;
  }
  
  updateYearRange(min: number, max: number): void {
    min = this.validateYearInput(min, 1963, 2022);
    max = this.validateYearInput(max, 1963, 2022);
    
    if (min > max) {
      const temp = min;
      min = max;
      max = temp;
    }
    
    this.yearRange.min = min;
    this.yearRange.max = max;
    
    this.dataService.loadDraftData().pipe(take(1)).subscribe(allPlayers => {
      this.players = this.dataService.filterPlayersByDraftYear(
        allPlayers, 
        this.yearRange.min, 
        this.yearRange.max
      );
      
      this.renderCharts();
    });
  }
  
  validateYearInput(value: number, min: number, max: number): number {
    const parsedValue = parseInt(value.toString(), 10);
    
    if (isNaN(parsedValue)) {
      return min;
    }
    
    return Math.max(min, Math.min(max, parsedValue));
  }
  
  filterPlayersByYearRange(): void {
    const filteredPlayers = this.dataService.filterPlayersByDraftYear(
      this.players, 
      this.yearRange.min, 
      this.yearRange.max
    );
    
    this.players = filteredPlayers;
  }
  
  onTabChange(isSplit: boolean): void {
    this.isPositionSplit = isSplit;
    this.ngZone.onStable.pipe(take(1)).subscribe(() => {
      const container = document.querySelector('.charts-container');
      if (container) {
        setTimeout(() => {
          this.renderCharts();

        }, 300);
      } else {
        this.renderCharts();
      }
    });
  }

  renderCharts(): void {
    if (!this.players || this.players.length === 0) return;

    d3.selectAll('.chart-content svg').remove();

    if (this.isPositionSplit) {
      this.statConfigs.forEach(config => {
        this.renderSplitChart(config, `chart-split-${config.key || 'custom'}`);
      });
    } else {
      this.statConfigs.forEach(config => {
        this.renderChart(config, this.players, `chart-${config.key || 'custom'}`);
      });
    }
  }

  renderSplitChart(config: StatConfig, elementId: string): void {
    const element = document.getElementById(elementId);
    if (!element) return;

    const containerWidth = element.clientWidth;
    const containerHeight = element.clientHeight;
    
    this.width = containerWidth - this.margin.left - this.margin.right;
    this.height = containerHeight - this.margin.top - this.margin.bottom;

    d3.select(element).selectAll("*").remove();

    const svg = d3.select(element)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    // Ajout du titre du graphique dans le SVG
    svg.append('text')
      .attr('x', this.width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text(config.label);

    const forwards = this.players.filter(p => this.positionGroups.forwards.includes(p.position));
    const defenders = this.players.filter(p => this.positionGroups.defenders.includes(p.position));

    // Préparer les données par position de repêchage
    const draftPositions = Array.from({ length: 217 }, (_, i) => i + 1);
    const splitData: SplitChartDataPoint[] = draftPositions.map(pos => {
      const forwardsAtPosition = forwards.filter(p => p.overall_pick === pos);
      const defendersAtPosition = defenders.filter(p => p.overall_pick === pos);
      
      let forwardsValue = 0;
      let forwardsStdDev = 0;
      if (config.customCalculation) {
        forwardsValue = config.customCalculation(forwardsAtPosition);
      } else if (config.key) {
        forwardsValue = this.calculateAverage(forwardsAtPosition, config.key);
      }
      
      if (forwardsAtPosition.length > 1 && config.key) {
        const values = forwardsAtPosition.map(p => {
          const val = p[config.key as keyof DraftPlayer];
          return val !== null ? val as number : 0;
        });
        
        if (values.length > 1) {
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          forwardsStdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length);
        }
      }
      
      let defendersValue = 0;
      let defendersStdDev = 0;
      if (config.customCalculation) {
        defendersValue = config.customCalculation(defendersAtPosition);
      } else if (config.key) {
        defendersValue = this.calculateAverage(defendersAtPosition, config.key);
      }
      
      if (defendersAtPosition.length > 1 && config.key) {
        const values = defendersAtPosition.map(p => {
          const val = p[config.key as keyof DraftPlayer];
          return val !== null ? val as number : 0;
        });
        
        if (values.length > 1) {
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          defendersStdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length);
        }
      }
      
      return {
        position: pos,
        forwards: {
          value: forwardsValue,
          stdDev: forwardsStdDev,
          count: forwardsAtPosition.length
        },
        defenders: {
          value: defendersValue,
          stdDev: defendersStdDev,
          count: defendersAtPosition.length
        }
      };
    });

    const x = d3.scaleLinear()
      .domain([1, 217])
      .range([0, this.width]);

    const maxForwardValue = d3.max(splitData, d => d.forwards.value + d.forwards.stdDev) || 0;
    const maxDefenderValue = d3.max(splitData, d => d.defenders.value + d.defenders.stdDev) || 0;
    const maxValue = Math.max(maxForwardValue, maxDefenderValue);

    const y = d3.scaleLinear()
      .domain([0, maxValue * 1.1])
      .range([this.height, 0]);

    svg.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${this.height})`)
      .call(d3.axisBottom(x)
        .tickValues([1, 31, 62, 93, 124, 155, 186, 217])
        .tickFormat(d => d.toString())
      );

    svg.append('g')
      .attr('class', 'axis')
      .call(d3.axisLeft(y));

    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', this.width / 2)
      .attr('y', this.height + this.margin.bottom - 10)
      .text('Position au repêchage');

    const rounds = [1, 31, 62, 93, 124, 155, 186, 217];
    rounds.forEach(pos => {
      svg.append('line')
        .attr('x1', x(pos))
        .attr('y1', 0)
        .attr('x2', x(pos))
        .attr('y2', this.height)
        .attr('stroke', '#999')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3');
    });

    const roundLabels = [1, 2, 3, 4, 5, 6, 7];
    roundLabels.forEach((round, i) => {
      const pos = rounds[i];
      svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', i === 0 ? x(pos + 15) : x(pos + (rounds[i+1] - pos) / 2))
        .attr('y', 15)
        .text(`Ronde ${round}`);
    });

    const forwardsAreaGenerator = d3.area<SplitChartDataPoint>()
      .x(d => x(d.position))
      .y0(d => y(Math.max(0, d.forwards.value - d.forwards.stdDev)))
      .y1(d => y(d.forwards.value + d.forwards.stdDev))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(splitData)
      .attr('class', 'area-forwards')
      .attr('d', forwardsAreaGenerator);

    const defendersAreaGenerator = d3.area<SplitChartDataPoint>()
      .x(d => x(d.position))
      .y0(d => y(Math.max(0, d.defenders.value - d.defenders.stdDev)))
      .y1(d => y(d.defenders.value + d.defenders.stdDev))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(splitData)
      .attr('class', 'area-defenders')
      .attr('d', defendersAreaGenerator);

    const forwardsLineGenerator = d3.line<SplitChartDataPoint>()
      .x(d => x(d.position))
      .y(d => y(d.forwards.value))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(splitData)
      .attr('class', 'line-forwards')
      .attr('fill', 'none')
      .attr('d', forwardsLineGenerator);


    const defendersLineGenerator = d3.line<SplitChartDataPoint>()
      .x(d => x(d.position))
      .y(d => y(d.defenders.value))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(splitData)
      .attr('class', 'line-defenders')
      .attr('fill', 'none')
      .attr('d', defendersLineGenerator);

    // Si la position sélectionnée est définie, ajouter des cercles pour la mettre en évidence
    if (this.selectedDraftPosition) {
      const selectedData = splitData.find(d => d.position === this.selectedDraftPosition);
      if (selectedData) {
        svg.append('circle')
          .attr('cx', x(selectedData.position))
          .attr('cy', y(selectedData.forwards.value))
          .attr('r', 6)
          .attr('fill', 'none')
          .attr('stroke', this.colors.forwards)
          .attr('stroke-width', 2);

        svg.append('circle')
          .attr('cx', x(selectedData.position))
          .attr('cy', y(selectedData.defenders.value))
          .attr('r', 6)
          .attr('fill', 'none')
          .attr('stroke', this.colors.defenders)
          .attr('stroke-width', 2);
      }
    }

    const tooltip = d3.select('#chart-tooltip');
    
    svg.append('rect')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('opacity', 0)
      .on('mousemove', (event) => {
        const [mouseX] = d3.pointer(event);
        const position = Math.round(x.invert(mouseX));
        const dataPoint = splitData.find(d => d.position === position);
        
        if (dataPoint) {          
          const tooltipX = event.clientX + 15;
          const tooltipY = event.clientY - 20;
          
          tooltip.style('opacity', 1)
              .style('left', `${tooltipX}px`)
              .style('top', `${tooltipY}px`);
          
          tooltip.select('#draft-position').text(dataPoint.position.toString());
          
          const forwardsAtPosition = this.players
            .filter(p => p.overall_pick === dataPoint.position && this.positionGroups.forwards.includes(p.position));
          const defendersAtPosition = this.players
            .filter(p => p.overall_pick === dataPoint.position && this.positionGroups.defenders.includes(p.position));
          
          tooltip.select('#avg-games-forwards').text(this.calculateAverage(forwardsAtPosition, 'games_played').toFixed(0));
          tooltip.select('#avg-goals-forwards').text(this.calculateAverage(forwardsAtPosition, 'goals').toFixed(1));
          tooltip.select('#avg-assists-forwards').text(this.calculateAverage(forwardsAtPosition, 'assists').toFixed(1));
          tooltip.select('#regular-player-pct-forwards').text(this.calculateRegularPlayerPercentage(forwardsAtPosition).toFixed(1));

          tooltip.select('#avg-games-defenders').text(this.calculateAverage(defendersAtPosition, 'games_played').toFixed(0));
          tooltip.select('#avg-goals-defenders').text(this.calculateAverage(defendersAtPosition, 'goals').toFixed(1));
          tooltip.select('#avg-assists-defenders').text(this.calculateAverage(defendersAtPosition, 'assists').toFixed(1));
          tooltip.select('#regular-player-pct-defenders').text(this.calculateRegularPlayerPercentage(defendersAtPosition).toFixed(1));

          svg.selectAll('.hover-circle').remove();
          svg.append('circle')
            .attr('class', 'hover-circle hover-circle-forwards')
            .attr('cx', x(dataPoint.position))
            .attr('cy', y(dataPoint.forwards.value))
            .attr('r', 6)
            .attr('fill', 'none')
            .attr('stroke', this.colors.forwards)
            .attr('stroke-width', 2);
            
          svg.append('circle')
            .attr('class', 'hover-circle hover-circle-defenders')
            .attr('cx', x(dataPoint.position))
            .attr('cy', y(dataPoint.defenders.value))
            .attr('r', 6)
            .attr('fill', 'none')
            .attr('stroke', this.colors.defenders)
            .attr('stroke-width', 2);
        }
      })
      .on('mouseout', () => {
        tooltip.style('opacity', 0);
        svg.selectAll('.hover-circle').remove();
      })
      .on('click', (event) => {
        const [mouseX] = d3.pointer(event);
        const position = Math.round(x.invert(mouseX));
        this.selectedDraftPosition = position;
        
        this.ngZone.run(() => {
          this.selectedDraftPosition = position;
          this.renderCharts();
        });
      });
  }

  renderChart(config: StatConfig, players: DraftPlayer[], elementId: string): void {
    const element = document.getElementById(elementId);
    if (!element) return;

    const containerWidth = element.clientWidth;
    const containerHeight = element.clientHeight;
    
    this.width = containerWidth - this.margin.left - this.margin.right;
    this.height = containerHeight - this.margin.top - this.margin.bottom;

    d3.select(element).selectAll("*").remove();

    const svg = d3.select(element)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
  

    // Ajout du titre du graphique dans le SVG
    svg.append('text')
      .attr('x', this.width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text(config.label);

    // Préparer les données par position de repêchage
    const draftPositions = Array.from({ length: 217 }, (_, i) => i + 1);
    const data: ChartDataPoint[] = draftPositions.map(pos => {
      const playersAtPosition = players.filter(p => p.overall_pick === pos);
      let value = 0;
      
      if (config.customCalculation) {
        value = config.customCalculation(playersAtPosition);
      } else if (config.key) {
        value = this.calculateAverage(playersAtPosition, config.key);
      }
      
      // Calculer l'écart-type
      let stdDev = 0;
      if (playersAtPosition.length > 1 && config.key) {
        const values = playersAtPosition.map(p => {
          const val = p[config.key as keyof DraftPlayer];
          return val !== null ? val as number : 0;
        });        
        
        if (values.length > 1) {
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          stdDev = Math.sqrt(values.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / values.length);
        }
      }
      
      return {
        position: pos,
        value,
        stdDev,
        count: playersAtPosition.length
      };
    });

   
    const x = d3.scaleLinear()
      .domain([1, 217])
      .range([0, this.width]);

    const maxValue = d3.max(data, d => d.value + d.stdDev) || 0;
    const y = d3.scaleLinear()
      .domain([0, maxValue * 1.1])
      .range([this.height, 0]);

    svg.append('g')
      .attr('transform', `translate(0,${this.height})`)
      .call(d3.axisBottom(x)
        .tickValues([1, 31, 62, 93, 124, 155, 186, 217])
        .tickFormat(d => d.toString())
      );

    svg.append('g')
      .call(d3.axisLeft(y));

    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', this.width / 2)
      .attr('y', this.height + this.margin.bottom - 10)
      .text('Position au repêchage');

    const rounds = [1, 31, 62, 93, 124, 155, 186, 217];
    rounds.forEach(pos => {
      svg.append('line')
        .attr('x1', x(pos))
        .attr('y1', 0)
        .attr('x2', x(pos))
        .attr('y2', this.height)
        .attr('stroke', '#999')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3');
    });

    const roundLabels = [1, 2, 3, 4, 5, 6, 7];
    roundLabels.forEach((round, i) => {
      const pos = rounds[i];
      svg.append('text')
        .attr('text-anchor', 'middle')
        .attr('x', i === 0 ? x(pos + 15) : x(pos + (rounds[i+1] - pos) / 2))
        .attr('y', 15)
        .text(`Ronde ${round}`);
    });

    // Ajouter la zone d'écart-type
    const areaGenerator = d3.area<ChartDataPoint>()
      .x(d => x(d.position))
      .y0(d => y(Math.max(0, d.value - d.stdDev)))
      .y1(d => y(d.value + d.stdDev))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(data)
      .attr('fill', '#ccc')
      .attr('fill-opacity', 0.5)
      .attr('d', areaGenerator);

    // Ajouter la ligne de moyenne
    const lineGenerator = d3.line<ChartDataPoint>()
      .x(d => x(d.position))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', 2)
      .attr('d', lineGenerator);

    // Si la position sélectionnée est définie, ajouter un cercle pour la mettre en évidence
    if (this.selectedDraftPosition) {
      const selectedData = data.find(d => d.position === this.selectedDraftPosition);
      if (selectedData) {
        svg.append('circle')
          .attr('cx', x(selectedData.position))
          .attr('cy', y(selectedData.value))
          .attr('r', 6)
          .attr('fill', 'none')
          .attr('stroke', 'purple')
          .attr('stroke-width', 2);
      }
    }

    // Ajouter une zone interactive pour afficher les infobulles
    const tooltip = d3.select('#chart-tooltip');
    
    svg.append('rect')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('opacity', 0)
      .on('mousemove', (event) => {
        const [mouseX] = d3.pointer(event);
        const position = Math.round(x.invert(mouseX));
        const dataPoint = data.find(d => d.position === position);
        
        if (dataPoint) {          
          const tooltipX = event.clientX + 15;
          const tooltipY = event.clientY - 20;
          
          tooltip.style('opacity', 1)
              .style('left', `${tooltipX}px`)
              .style('top', `${tooltipY}px`);
          
          tooltip.select('#draft-position').text(dataPoint.position.toString());
          
          const playersAtPosition = players.filter(p => p.overall_pick === dataPoint.position);
          
          tooltip.select('#avg-games').text(this.calculateAverage(playersAtPosition, 'games_played').toFixed(0));
          tooltip.select('#avg-goals').text(this.calculateAverage(playersAtPosition, 'goals').toFixed(1));
          tooltip.select('#avg-assists').text(this.calculateAverage(playersAtPosition, 'assists').toFixed(1));
          tooltip.select('#regular-player-pct').text(this.calculateRegularPlayerPercentage(playersAtPosition).toFixed(1));
          
          // Ajouter un cercle temporaire pour indiquer la position survolée
          svg.selectAll('.hover-circle').remove();
          svg.append('circle')
            .attr('class', 'hover-circle')
            .attr('cx', x(dataPoint.position))
            .attr('cy', y(dataPoint.value))
            .attr('r', 6)
            .attr('fill', 'none')
            .attr('stroke', 'blue')
            .attr('stroke-width', 2);
        }
      })
      .on('mouseout', () => {
        tooltip.style('opacity', 0);
        svg.selectAll('.hover-circle').remove();
      })
      .on('click', (event) => {
        const [mouseX] = d3.pointer(event);
        const position = Math.round(x.invert(mouseX));
        
        this.ngZone.run(() => {
          this.selectedDraftPosition = position;
          this.renderCharts();
        });
      });
  }

  calculateAverage(players: DraftPlayer[], key: keyof DraftPlayer): number {
    if (!players.length) return 0;
    
    const values = players.map(p => (p[key] !== null ? (p[key] as number) : 0));
    
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  get selectedSummary() {
    if (!this.selectedDraftPosition) {
      return null;
    }
    const playersAtPos = this.players.filter(p => p.overall_pick === this.selectedDraftPosition);
    return {
      position: this.selectedDraftPosition,
      avgGames: playersAtPos.length ? this.calculateAverage(playersAtPos, 'games_played') : 0,
      avgGoals: playersAtPos.length ? this.calculateAverage(playersAtPos, 'goals') : 0,
      avgAssists: playersAtPos.length ? this.calculateAverage(playersAtPos, 'assists') : 0,
      regularPlayerPct: playersAtPos.length ? this.calculateRegularPlayerPercentage(playersAtPos) : 0
    };
  }

  get selectedSplitSummary(): SplitSummary | null {
    if (!this.selectedDraftPosition) {
      return null;
    }
    
    const forwardsAtPos = this.players.filter(p => 
      p.overall_pick === this.selectedDraftPosition && 
      this.positionGroups.forwards.includes(p.position)
    );
    
    const defendersAtPos = this.players.filter(p => 
      p.overall_pick === this.selectedDraftPosition && 
      this.positionGroups.defenders.includes(p.position)
    );
    
    return {
      forwards: {
        avgGames: forwardsAtPos.length ? this.calculateAverage(forwardsAtPos, 'games_played') : 0,
        avgGoals: forwardsAtPos.length ? this.calculateAverage(forwardsAtPos, 'goals') : 0,
        avgAssists: forwardsAtPos.length ? this.calculateAverage(forwardsAtPos, 'assists') : 0,
        regularPlayerPct: forwardsAtPos.length ? this.calculateRegularPlayerPercentage(forwardsAtPos) : 0
      },
      defenders: {
        avgGames: defendersAtPos.length ? this.calculateAverage(defendersAtPos, 'games_played') : 0,
        avgGoals: defendersAtPos.length ? this.calculateAverage(defendersAtPos, 'goals') : 0,
        avgAssists: defendersAtPos.length ? this.calculateAverage(defendersAtPos, 'assists') : 0,
        regularPlayerPct: defendersAtPos.length ? this.calculateRegularPlayerPercentage(defendersAtPos) : 0
      }
    };
  }
}