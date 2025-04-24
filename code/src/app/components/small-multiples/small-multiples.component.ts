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
  
  private animationTimer: any;

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
    // Store previous state for animation
    const previousState = this.isPositionSplit;
    this.isPositionSplit = isSplit;
    
    // Clear any existing timers to prevent overlapping animations
    if (this.animationTimer) {
      cancelAnimationFrame(this.animationTimer);
      this.animationTimer = null;
    }
    
    this.ngZone.onStable.pipe(take(1)).subscribe(() => {
      // For each stat config, animate the transition
      this.statConfigs.forEach(config => {
        const elementId = isSplit ? 
          `chart-split-${config.key || 'custom'}` : 
          `chart-${config.key || 'custom'}`;
        const element = document.getElementById(elementId);
        
        if (element && this.players && this.players.length > 0) {
          this.animateChartTransition(previousState, isSplit, config, elementId);
        }
      });
    });
  }

  animateChartTransition(fromSplit: boolean, toSplit: boolean, config: StatConfig, elementId: string): void {
    if (!this.players || this.players.length === 0) return;
    
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const containerWidth = element.clientWidth;
    const containerHeight = element.clientHeight;
    
    this.width = containerWidth - this.margin.left - this.margin.right;
    this.height = containerHeight - this.margin.top - this.margin.bottom;
    
    // Préparation des données pour les deux états
    const draftPositions = Array.from({ length: 217 }, (_, i) => i + 1);
    
    // Données pour la vue joueurs
    const allPlayersData = draftPositions.map(pos => {
      const playersAtPosition = this.players.filter(p => p.overall_pick === pos);
      let value = 0;
      
      if (config.customCalculation) {
        value = config.customCalculation(playersAtPosition);
      } else if (config.key) {
        value = this.calculateAverage(playersAtPosition, config.key);
      }
      
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
    
    // Données pour la vue attaquants/défenseurs
    const forwards = this.players.filter(p => this.positionGroups.forwards.includes(p.position));
    const defenders = this.players.filter(p => this.positionGroups.defenders.includes(p.position));
    
    const splitData = draftPositions.map(pos => {
      const forwardsAtPosition = forwards.filter(p => p.overall_pick === pos);
      const defendersAtPosition = defenders.filter(p => p.overall_pick === pos);
      
      let forwardsValue = 0;
      if (config.customCalculation) {
        forwardsValue = config.customCalculation(forwardsAtPosition);
      } else if (config.key) {
        forwardsValue = this.calculateAverage(forwardsAtPosition, config.key);
      }
      
      let forwardsStdDev = 0;
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
      if (config.customCalculation) {
        defendersValue = config.customCalculation(defendersAtPosition);
      } else if (config.key) {
        defendersValue = this.calculateAverage(defendersAtPosition, config.key);
      }
      
      let defendersStdDev = 0;
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
    
    // Échelles pour les axes
    const x = d3.scaleLinear()
      .domain([1, 217])
      .range([0, this.width]);
    
    // Trouvons la valeur maximale entre les deux ensembles de données pour l'échelle Y
    const maxValuePlayers = d3.max(allPlayersData, d => d.value + d.stdDev) || 0;
    const maxForwardValue = d3.max(splitData, d => d.forwards.value + d.forwards.stdDev) || 0;
    const maxDefenderValue = d3.max(splitData, d => d.defenders.value + d.defenders.stdDev) || 0;
    const maxValue = Math.max(maxValuePlayers, maxForwardValue, maxDefenderValue);
    
    const y = d3.scaleLinear()
      .domain([0, maxValue * 1.1])
      .range([this.height, 0]);
    
    // Créer le SVG
    d3.select(`#${elementId}`).selectAll("*").remove();
    
    const svg = d3.select(`#${elementId}`)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
    
    // Ajout du titre
    svg.append('text')
      .attr('x', this.width / 2)
      .attr('y', -10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text(config.label);
    
    // Ajout des axes et lignes des tours
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
    
    // Créer les données intermédiaires pour l'animation
    // Ces données seront utilisées pour interpoler entre les deux états
    const createInterpolatedData = (t: number) => {
      return draftPositions.map(pos => {
        const allData = allPlayersData.find(d => d.position === pos) || 
          { position: pos, value: 0, stdDev: 0, count: 0 };
        const splData = splitData.find(d => d.position === pos) || {
          position: pos,
          forwards: { value: 0, stdDev: 0, count: 0 },
          defenders: { value: 0, stdDev: 0, count: 0 }
        };
        
        // Interpolation pour les valeurs d'attaquants
        const forwardInterpValue = toSplit ? 
          allData.value * (1 - t) + splData.forwards.value * t :
          splData.forwards.value * (1 - t) + allData.value * t;
        
        const forwardInterpStdDev = toSplit ? 
          allData.stdDev * (1 - t) + splData.forwards.stdDev * t :
          splData.forwards.stdDev * (1 - t) + allData.stdDev * t;
        
        // Interpolation pour les valeurs de défenseurs
        const defenderInterpValue = toSplit ? 
          allData.value * (1 - t) + splData.defenders.value * t :
          splData.defenders.value * (1 - t) + allData.value * t;
        
        const defenderInterpStdDev = toSplit ? 
          allData.stdDev * (1 - t) + splData.defenders.stdDev * t :
          splData.defenders.stdDev * (1 - t) + allData.stdDev * t;
        
        // Combiner pour l'état intermédiaire
        return {
          position: pos,
          all: {
            value: allData.value,
            stdDev: allData.stdDev
          },
          forwards: {
            value: forwardInterpValue,
            stdDev: forwardInterpStdDev
          },
          defenders: {
            value: defenderInterpValue,
            stdDev: defenderInterpStdDev
          }
        };
      });
    };
    
    // Créer les générateurs de courbes et de zones
    const allAreaGenerator = d3.area<any>()
      .x(d => x(d.position))
      .y0(d => y(Math.max(0, d.all.value - d.all.stdDev)))
      .y1(d => y(d.all.value + d.all.stdDev))
      .curve(d3.curveMonotoneX);
    
    const allLineGenerator = d3.line<any>()
      .x(d => x(d.position))
      .y(d => y(d.all.value))
      .curve(d3.curveMonotoneX);
    
    const forwardsAreaGenerator = d3.area<any>()
      .x(d => x(d.position))
      .y0(d => y(Math.max(0, d.forwards.value - d.forwards.stdDev)))
      .y1(d => y(d.forwards.value + d.forwards.stdDev))
      .curve(d3.curveMonotoneX);
    
    const forwardsLineGenerator = d3.line<any>()
      .x(d => x(d.position))
      .y(d => y(d.forwards.value))
      .curve(d3.curveMonotoneX);
    
    const defendersAreaGenerator = d3.area<any>()
      .x(d => x(d.position))
      .y0(d => y(Math.max(0, d.defenders.value - d.defenders.stdDev)))
      .y1(d => y(d.defenders.value + d.defenders.stdDev))
      .curve(d3.curveMonotoneX);
    
    const defendersLineGenerator = d3.line<any>()
      .x(d => x(d.position))
      .y(d => y(d.defenders.value))
      .curve(d3.curveMonotoneX);
    
    // Créer les éléments SVG pour l'animation
    const allArea = svg.append('path')
      .attr('class', 'area-all')
      .attr('fill', '#ccc')
      .attr('fill-opacity', 0.5);
    
    const allLine = svg.append('path')
      .attr('class', 'line-all')
      .attr('fill', 'none')
      .attr('stroke', 'black')
      .attr('stroke-width', 2);
    
    const forwardsArea = svg.append('path')
      .attr('class', 'area-forwards')
      .attr('fill', this.colors.forwards)
      .attr('fill-opacity', 0.3);
    
    const forwardsLine = svg.append('path')
      .attr('class', 'line-forwards')
      .attr('fill', 'none')
      .attr('stroke', this.colors.forwards)
      .attr('stroke-width', 2);
    
    const defendersArea = svg.append('path')
      .attr('class', 'area-defenders')
      .attr('fill', this.colors.defenders)
      .attr('fill-opacity', 0.3);
    
    const defendersLine = svg.append('path')
      .attr('class', 'line-defenders')
      .attr('fill', 'none')
      .attr('stroke', this.colors.defenders)
      .attr('stroke-width', 2);
    
    // Si une position est sélectionnée, ajouter les cercles de surbrillance
    const allCircle = svg.append('circle')
      .attr('class', 'circle-all')
      .attr('r', 6)
      .attr('fill', 'none')
      .attr('stroke', 'purple')
      .attr('stroke-width', 2)
      .attr('opacity', 0);
    
    const forwardsCircle = svg.append('circle')
      .attr('class', 'circle-forwards')
      .attr('r', 6)
      .attr('fill', 'none')
      .attr('stroke', this.colors.forwards)
      .attr('stroke-width', 2)
      .attr('opacity', 0);
    
    const defendersCircle = svg.append('circle')
      .attr('class', 'circle-defenders')
      .attr('r', 6)
      .attr('fill', 'none')
      .attr('stroke', this.colors.defenders)
      .attr('stroke-width', 2)
      .attr('opacity', 0);
    
    // Effectuer l'animation
    const duration = 1000;
    const delay = 0;
    
    let startTime: number;
    
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(elapsed / duration, 1);
      
      const interpolatedData = createInterpolatedData(t);
      
      if (fromSplit === false && toSplit === true) {
        // Animation de Vue joueurs -> Vue attaquants/défenseurs
        allArea.style('opacity', 1 - t)
          .attr('d', allAreaGenerator(interpolatedData));
        
        allLine.style('opacity', 1 - t)
          .attr('d', allLineGenerator(interpolatedData));
        
        forwardsArea.style('opacity', t)
          .attr('d', forwardsAreaGenerator(interpolatedData));
        
        forwardsLine.style('opacity', t)
          .attr('d', forwardsLineGenerator(interpolatedData));
        
        defendersArea.style('opacity', t)
          .attr('d', defendersAreaGenerator(interpolatedData));
        
        defendersLine.style('opacity', t)
          .attr('d', defendersLineGenerator(interpolatedData));
      } else {
        // Animation de Vue attaquants/défenseurs -> Vue joueurs
        allArea.style('opacity', t)
          .attr('d', allAreaGenerator(interpolatedData));
        
        allLine.style('opacity', t)
          .attr('d', allLineGenerator(interpolatedData));
        
        forwardsArea.style('opacity', 1 - t)
          .attr('d', forwardsAreaGenerator(interpolatedData));
        
        forwardsLine.style('opacity', 1 - t)
          .attr('d', forwardsLineGenerator(interpolatedData));
        
        defendersArea.style('opacity', 1 - t)
          .attr('d', defendersAreaGenerator(interpolatedData));
        
        defendersLine.style('opacity', 1 - t)
          .attr('d', defendersLineGenerator(interpolatedData));
      }
      
      // Animer les cercles si une position est sélectionnée
      if (this.selectedDraftPosition) {
        const selectedData = interpolatedData.find(d => d.position === this.selectedDraftPosition);
        
        if (selectedData) {
          if (fromSplit === false && toSplit === true) {
            // Animation de Vue joueurs -> Vue attaquants/défenseurs
            allCircle
              .attr('cx', x(selectedData.position))
              .attr('cy', y(selectedData.all.value))
              .style('opacity', 1 - t);
            
            forwardsCircle
              .attr('cx', x(selectedData.position))
              .attr('cy', y(selectedData.forwards.value))
              .style('opacity', t);
            
            defendersCircle
              .attr('cx', x(selectedData.position))
              .attr('cy', y(selectedData.defenders.value))
              .style('opacity', t);
          } else {
            // Animation de Vue attaquants/défenseurs -> Vue joueurs
            allCircle
              .attr('cx', x(selectedData.position))
              .attr('cy', y(selectedData.all.value))
              .style('opacity', t);
            
            forwardsCircle
              .attr('cx', x(selectedData.position))
              .attr('cy', y(selectedData.forwards.value))
              .style('opacity', 1 - t);
            
            defendersCircle
              .attr('cx', x(selectedData.position))
              .attr('cy', y(selectedData.defenders.value))
              .style('opacity', 1 - t);
          }
        }
      }
      
      if (t < 1) {
        this.animationTimer = requestAnimationFrame(animate);
      } else {
        // Fin de l'animation
        // Configurer le comportement interactif pour le tooltip et la sélection
        this.setupInteractivity(svg, x, y, toSplit ? splitData : allPlayersData, toSplit, config, elementId);
      }
    };
    
    this.animationTimer = requestAnimationFrame(animate);
  }
  
  private setupInteractivity(svg: any, x: any, y: any, data: any[], isSplit: boolean, config: StatConfig, elementId: string): void {
    const tooltip = d3.select('#chart-tooltip');
    
    svg.append('rect')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('opacity', 0)
      .on('mousemove', (event: any) => {
        const [mouseX] = d3.pointer(event);
        const position = Math.round(x.invert(mouseX));
        
        if (isSplit) {
          // Logique du tooltip pour la vue séparée
          const dataPoint = data.find(d => d.position === position);
          
          if (dataPoint) {
            const tooltipX = event.clientX + 15;
            const tooltipY = event.clientY - 20;
            
            tooltip.style('opacity', 1)
              .style('left', `${tooltipX}px`)
              .style('top', `${tooltipY}px`);
            
            tooltip.select('#draft-position').text(position.toString());
            
            const forwardsAtPosition = this.players.filter(p => 
              p.overall_pick === position && 
              this.positionGroups.forwards.includes(p.position)
            );
            
            const defendersAtPosition = this.players.filter(p => 
              p.overall_pick === position && 
              this.positionGroups.defenders.includes(p.position)
            );
            
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
              .attr('cx', x(position))
              .attr('cy', y(dataPoint.forwards.value))
              .attr('r', 6)
              .attr('fill', 'none')
              .attr('stroke', this.colors.forwards)
              .attr('stroke-width', 2);
              
            svg.append('circle')
              .attr('class', 'hover-circle hover-circle-defenders')
              .attr('cx', x(position))
              .attr('cy', y(dataPoint.defenders.value))
              .attr('r', 6)
              .attr('fill', 'none')
              .attr('stroke', this.colors.defenders)
              .attr('stroke-width', 2);
          }
        } else {
          // Logique du tooltip pour la vue combinée
          const dataPoint = data.find(d => d.position === position);
          
          if (dataPoint) {
            const tooltipX = event.clientX + 15;
            const tooltipY = event.clientY - 20;
            
            tooltip.style('opacity', 1)
              .style('left', `${tooltipX}px`)
              .style('top', `${tooltipY}px`);
            
            tooltip.select('#draft-position').text(position.toString());
            
            const playersAtPosition = this.players.filter(p => p.overall_pick === position);
            
            tooltip.select('#avg-games').text(this.calculateAverage(playersAtPosition, 'games_played').toFixed(0));
            tooltip.select('#avg-goals').text(this.calculateAverage(playersAtPosition, 'goals').toFixed(1));
            tooltip.select('#avg-assists').text(this.calculateAverage(playersAtPosition, 'assists').toFixed(1));
            tooltip.select('#regular-player-pct').text(this.calculateRegularPlayerPercentage(playersAtPosition).toFixed(1));
            
            svg.selectAll('.hover-circle').remove();
            svg.append('circle')
              .attr('class', 'hover-circle')
              .attr('cx', x(position))
              .attr('cy', y(dataPoint.value))
              .attr('r', 6)
              .attr('fill', 'none')
              .attr('stroke', 'blue')
              .attr('stroke-width', 2);
          }
        }
      })
      .on('mouseout', () => {
        tooltip.style('opacity', 0);
        svg.selectAll('.hover-circle').remove();
      })
      .on('click', (event: any) => {
        const [mouseX] = d3.pointer(event);
        const position = Math.round(x.invert(mouseX));
        
        this.ngZone.run(() => {
          this.selectedDraftPosition = position;
          svg.selectAll('.selected-circle').remove();
          
          if (isSplit) {
            const dataPoint = data.find(d => d.position === position);
            if (dataPoint) {
              svg.append('circle')
                .attr('class', 'selected-circle selected-circle-forwards')
                .attr('cx', x(position))
                .attr('cy', y(dataPoint.forwards.value))
                .attr('r', 6)
                .attr('fill', 'none')
                .attr('stroke', this.colors.forwards)
                .attr('stroke-width', 2);
                
              svg.append('circle')
                .attr('class', 'selected-circle selected-circle-defenders')
                .attr('cx', x(position))
                .attr('cy', y(dataPoint.defenders.value))
                .attr('r', 6)
                .attr('fill', 'none')
                .attr('stroke', this.colors.defenders)
                .attr('stroke-width', 2);
            }
          } else {
            const dataPoint = data.find(d => d.position === position);
            if (dataPoint) {
              svg.append('circle')
                .attr('class', 'selected-circle')
                .attr('cx', x(position))
                .attr('cy', y(dataPoint.value))
                .attr('r', 6)
                .attr('fill', 'none')
                .attr('stroke', 'purple')
                .attr('stroke-width', 2);
            }
          }
        });
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