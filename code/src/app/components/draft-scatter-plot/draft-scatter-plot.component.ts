import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as d3 from 'd3';

@Component({
  selector: 'app-draft-scatter-plot',
  templateUrl: './draft-scatter-plot.component.html',
  styleUrls: ['./draft-scatter-plot.component.scss']
})
export class DraftScatterPlotComponent {
  @ViewChild('visualizationSvg') svgElement!: ElementRef<SVGSVGElement>;
      isLoading = true;
      displayMode: 'première ronde' | 'top cinq' = 'première ronde';
    
      private margin = { top: 50, right: 50, bottom: 70, left: 80 };
      private width = 900 - this.margin.left - this.margin.right;
      private height = 500 - this.margin.top - this.margin.bottom;
      private svg: any;
      private teamSeasonData: any[] = [];
    
      private stanleyCupWinners = [
        'Toronto Maple Leafs-1963',
        'Toronto Maple Leafs-1964',
        'Montreal Canadiens-1965',
        'Montreal Canadiens-1966',
        'Toronto Maple Leafs-1967',
        'Montreal Canadiens-1968',
        'Montreal Canadiens-1969',
        'Boston Bruins-1970',
        'Montreal Canadiens-1971',
        'Boston Bruins-1972',
        'Montreal Canadiens-1973',
        'Philadelphia Flyers-1974',
        'Philadelphia Flyers-1975',
        'Montreal Canadiens-1976',
        'Montreal Canadiens-1977',
        'Montreal Canadiens-1978',
        'Montreal Canadiens-1979',
        'New York Islanders-1980',
        'New York Islanders-1981',
        'New York Islanders-1982',
        'New York Islanders-1983',
        'Edmonton Oilers-1984',
        'Edmonton Oilers-1985',
        'Montreal Canadiens-1986',
        'Edmonton Oilers-1987',
        'Edmonton Oilers-1988',
        'Calgary Flames-1989',
        'Edmonton Oilers-1990',
        'Pittsburgh Penguins-1991',
        'Pittsburgh Penguins-1992',
        'Montreal Canadiens-1993',
        'New York Rangers-1994',
        'New Jersey Devils-1995',
        'Colorado Avalanche-1996',
        'Detroit Red Wings-1997',
        'Detroit Red Wings-1998',
        'Dallas Stars-1999',
        'New Jersey Devils-2000',
        'Colorado Avalanche-2001',
        'Detroit Red Wings-2002',
        'New Jersey Devils-2003',
        'Tampa Bay Lightning-2004',
        // 2005 : Saison annulée en raison d'un lock-out
        'Carolina Hurricanes-2006',
        'Anaheim Ducks-2007',
        'Detroit Red Wings-2008',
        'Pittsburgh Penguins-2009',
        'Chicago Blackhawks-2010',
        'Boston Bruins-2011',
        'Los Angeles Kings-2012',
        'Chicago Blackhawks-2013',
        'Los Angeles Kings-2014',
        'Chicago Blackhawks-2015',
        'Pittsburgh Penguins-2016',
        'Pittsburgh Penguins-2017',
        'Washington Capitals-2018',
        'St. Louis Blues-2019',
        'Tampa Bay Lightning-2020',
        'Tampa Bay Lightning-2021',
        'Colorado Avalanche-2022',
      ];
    
      constructor(private http: HttpClient) {}
    
      ngAfterViewInit(): void {
        this.loadData();
      }
    
      private loadData(): void {
        this.http.get('assets/nhldraft.csv', { responseType: 'text' })
          .subscribe({
            next: (csvText) => {
              const csvData = d3.csvParse(csvText);
              this.teamSeasonData = this.processData(csvData);
              this.isLoading = false;
              this.renderScatterPlot();
            },
            error: (error) => {
              console.error('Error loading data:', error);
              d3.select('.loading')
                .html(`
                  <strong>Erreur lors du chargement des données</strong><br>
                  Vérifiez que le fichier nhldraft.csv est bien présent dans le dossier assets.
                `)
                .style('color', 'red');
            }
          });
      }
    
      private processData(data: any[]): any[] {
        data.forEach((d) => {
          d.year = +d.year;
          d.overall_pick = +d.overall_pick;
          d.points = +d.points || 0;
          d.games_played = +d.games_played || 0;
          d.goals = +d.goals || 0;
          d.assists = +d.assists || 0;
        });
    
        const teamSeasons: { [key: string]: any } = {};
        const seasons = [...new Set(data.map((d) => d.year))].sort();
        const nhlTeams = [...new Set(data.map((d) => d.team))];
    
        nhlTeams.forEach((team) => {
          seasons.forEach((year) => {
            const seasonKey = `${team}-${year}`;
            const teamData = data.filter((d) => d.team === team && d.year === year);
    
            if (teamData.length > 0) {
              const firstRoundPicks = teamData.filter((d) => d.overall_pick <= 31);
              const topFivePicks = teamData.filter((d) => d.overall_pick <= 5);
              const totalPoints = teamData.reduce((sum, player) => sum + player.points, 0);
              const seasonPoints = Math.min(130, Math.max(65, Math.floor(totalPoints / 10)));
              const wonStanleyCup = this.stanleyCupWinners.includes(`${team}-${year}`);
    
              if (seasonPoints !== 65) {
                teamSeasons[seasonKey] = {
                  team, year,
                  firstRoundPicksCount: firstRoundPicks.length,
                  topFivePicksCount: topFivePicks.length,
                  seasonPoints, wonStanleyCup
                };
              }
            }
          });
        });
    
        return Object.values(teamSeasons);
      }
    
      private renderScatterPlot(): void {
        this.svg = d3.select(this.svgElement.nativeElement)
          .attr('width', this.width + this.margin.left + this.margin.right)
          .attr('height', this.height + this.margin.top + this.margin.bottom)
          .append('g')
          .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);
    
        const xValues = [...new Set(this.teamSeasonData.map((d) =>
          this.displayMode === 'première ronde' ? d.firstRoundPicksCount : d.topFivePicksCount
        ))].sort((a, b) => a - b);
        const xMax = Math.max(8, d3.max(xValues) + 1);
    
        const xScale = d3.scalePoint()
          .domain([0, 1, 2, 3, 4, 5, 6, 7, 8].slice(0, xMax + 1).map(String))
          .range([0, this.width])
          .padding(1.3);
    
        const xAdjust: { [key: string]: number } = {};
        xAdjust[0] = 0;
        xAdjust[1] = this.width * 0.28;
        xAdjust[2] = this.width * 0.43;
        for (let i = 3; i <= xMax; i++) {
          xAdjust[i] = this.width * ((i + 0.39) / 10 + 0.22);
        }
    
        const filteredYValues = this.teamSeasonData.map((d) => d.seasonPoints).filter((y) => y !== 65);
        const yMin = Math.max(60, d3.min(filteredYValues) - 5);
        const yMax = d3.max(filteredYValues) + 10;
    
        const yScale = d3.scaleLinear()
          .domain([yMin, yMax])
          .range([this.height, 0])
          .nice();
    
        this.svg.append('g')
          .attr('class', 'grid-lines')
          .selectAll('line')
          .data(xValues)
          .enter()
          .append('line')
          .attr('x1', (d: string) => xAdjust[d] || xScale(d))
          .attr('y1', 0)
          .attr('x2', (d: string) => xAdjust[d] || xScale(d))
          .attr('y2', this.height)
          .attr('stroke', '#e0e0e0')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '3,3');
    
        const xAxis = this.svg.append('g')
          .attr('transform', `translate(0, ${this.height})`);
        xAxis.append('line')
          .attr('x1', 0)
          .attr('y1', 0)
          .attr('x2', this.width)
          .attr('y2', 0)
          .attr('stroke', 'black')
          .attr('stroke-width', 1);
    
        xValues.forEach((d) => {
          const xPos = xAdjust[d] || xScale(d);
          xAxis.append('line')
            .attr('x1', xPos)
            .attr('y1', 0)
            .attr('x2', xPos)
            .attr('y2', 6)
            .attr('stroke', 'black');
          xAxis.append('text')
            .attr('x', xPos)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('font-weight', 'bold')
            .text(d);
        });
    
        this.svg.append('g')
          .call(d3.axisLeft(yScale))
          .selectAll('text')
          .attr('font-weight', 'bold');
    
        this.svg.append('text')
          .attr('text-anchor', 'middle')
          .attr('x', this.width / 2)
          .attr('y', this.height + this.margin.bottom - 10)
          .style('font-size', '14px')
          .style('font-weight', 'bold')
          .text(`NOMBRE DE JOUEURS DE ${this.displayMode.toUpperCase()}`);
    
        this.svg.append('text')
          .attr('text-anchor', 'middle')
          .attr('transform', 'rotate(-90)')
          .attr('x', -this.height / 2)
          .attr('y', -this.margin.left + 20)
          .style('font-size', '14px')
          .style('font-weight', 'bold')
          .text('NOMBRE TOTAL DE POINTS ACCUMULÉS');
    
        this.svg.append('text')
          .attr('text-anchor', 'middle')
          .attr('x', this.width / 2)
          .attr('y', -this.margin.top / 2)
          .style('font-size', '16px')
          .style('font-weight', 'bold')
          .text('TOUTES LES ANNÉES (1963-2022)');
    
        const nodeData = this.teamSeasonData.map((d) => ({
          id: `${d.team}-${d.year}`,
          team: d.team,
          year: d.year,
          firstRoundPicksCount: d.firstRoundPicksCount,
          topFivePicksCount: d.topFivePicksCount,
          seasonPoints: d.seasonPoints,
          wonStanleyCup: d.wonStanleyCup,
          xValue: this.displayMode === 'première ronde' ? d.firstRoundPicksCount : d.topFivePicksCount,
          x: xScale(this.displayMode === 'première ronde' ? d.firstRoundPicksCount : d.topFivePicksCount),
          y: yScale(d.seasonPoints)
        }));
    
        const xGroups: { [key: number]: any[] } = {};
        xValues.forEach((val) => {
          xGroups[val] = nodeData.filter((d) => d.xValue === val);
        });
    
        const simulation = d3.forceSimulation(nodeData)
          .force('x', d3.forceX().x((d) => {
            const node = d as { xValue: number };
            return xAdjust[node.xValue] || xScale(node.xValue.toString()) || 0;
          }).strength(0.8))
          .force('y', d3.forceY().y((d) => yScale((d as any).seasonPoints)).strength(0.8))
          .force('collision', d3.forceCollide().radius(7).strength(0.8))
          .alpha(0.5)
          .alphaDecay(0.05)
          .force('cluster', (alpha) => {
            for (const d of nodeData) {
              const group = xGroups[d.xValue];
              if (group.length > 1) {
                const sumY = group.reduce((sum, g) => sum + g.y, 0);
                const centerY = sumY / group.length;
                d.y += (centerY - d.y) * alpha * 0.1;
              }
            }
          })
          .force('boundary', () => {
            for (const d of nodeData) {
              const margin = 10;
              d.x = Math.max(margin, Math.min(this.width - margin, d.x ?? 0));
              d.y = Math.max(margin, Math.min(this.height - margin, d.y));
              const xPos = xAdjust[d.xValue] || xScale(d.xValue) || 0; // Default to 0 if undefined
              let maxDistance = d.xValue === 0 ? 45 : d.xValue === 1 ? 35 : d.xValue === 2 ? 35 : 20;
              if (Math.abs(d.x - xPos) > maxDistance) {
                d.x = xPos + (d.x > xPos ? maxDistance : -maxDistance);
              }
            }
          });
    
        const circles = this.svg.selectAll('.point')
          .data(nodeData)
          .enter()
          .append('circle')
          .attr('class', 'point')
          .attr('r', 5)
          .style('fill', (d: { wonStanleyCup: any; }) => d.wonStanleyCup ? '#F9A826' : '#000')
          .style('opacity', 0.8)
          .style('stroke', 'white')
          .style('stroke-width', 0.5)
          .on('mouseover', (event: { currentTarget: any; }, d: any) => {
            this.showTooltip(event, d);
            d3.select(event.currentTarget)
              .attr('r', 8)
              .style('opacity', 1)
              .style('stroke-width', 1);
          })
          .on('mouseout', (event: { currentTarget: any; }) => {
            this.hideTooltip();
            d3.select(event.currentTarget)
              .attr('r', 5)
              .style('opacity', 0.8)
              .style('stroke-width', 0.5);
          });
    
        simulation.on('tick', () => {
          circles.attr('cx', (d: { x: any; }) => d.x).attr('cy', (d: { y: any; }) => d.y);
        });
    
        setTimeout(() => simulation.stop(), 2000);
    
        const legend = this.svg.append('g')
          .attr('class', 'legend')
          .attr('transform', `translate(${this.width - 250}, -50)`);
        legend.append('rect')
          .attr('width', 300)
          .attr('height', 60)
          .attr('fill', 'white')
          .attr('stroke', '#ccc')
          .attr('stroke-width', 1)
          .attr('rx', 5);
        legend.append('circle')
          .attr('cx', 20)
          .attr('cy', 20)
          .attr('r', 5)
          .style('fill', '#F9A826')
          .style('stroke', 'white')
          .style('stroke-width', 0.5);
        legend.append('text')
          .attr('x', 35)
          .attr('y', 25)
          .text('Équipe qui a remporté la Coupe Stanley')
          .style('font-size', '12px');
        legend.append('circle')
          .attr('cx', 20)
          .attr('cy', 40)
          .attr('r', 5)
          .style('fill', '#000')
          .style('stroke', 'white')
          .style('stroke-width', 0.5);
        legend.append('text')
          .attr('x', 35)
          .attr('y', 45)
          .text("Équipe qui n'a pas remporté la Coupe Stanley")
          .style('font-size', '12px');
      }
    
      private showTooltip(event: any, d: any): void {
        let tooltip = d3.select('body').select('.tooltip');
        // if (tooltip.empty()) {
        //   tooltip = d3.select('body').append('div').attr('class', 'tooltip');
        // }
        tooltip.html(`
          <strong>${d.team}</strong><br>
          Saison: ${d.year}-${d.year + 1}<br>
          Nombre de joueurs repêchés en ${this.displayMode}: <strong>${this.displayMode === 'première ronde' ? d.firstRoundPicksCount : d.topFivePicksCount}</strong><br>
          Points en saison régulière: <strong>${d.seasonPoints}</strong><br>
          ${d.wonStanleyCup ? '<span style="color:#F9A826; font-weight:bold;">A remporté la Coupe Stanley</span>' : ''}
        `)
          .style('left', event.pageX + 15 + 'px')
          .style('top', event.pageY - 15 + 'px')
          .transition()
          .duration(200)
          .style('opacity', 1);
      }
    
      private hideTooltip(): void {
        d3.select('.tooltip')
          .transition()
          .duration(200)
          .style('opacity', 0);
      }
    
      setDisplayMode(mode: 'première ronde' | 'top cinq'): void {
        this.displayMode = mode;
        this.svg.selectAll('*').remove();
        this.renderScatterPlot();
      }
    }