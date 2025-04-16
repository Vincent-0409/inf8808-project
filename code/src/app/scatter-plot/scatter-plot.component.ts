import { Component, AfterViewInit } from '@angular/core';
import * as d3 from 'd3';

// Interface pour représenter un point du scatter plot
interface ScatterData {
  season: string;       // ex: "2010-11"
  teamAbbr: string;     // ex: "CAR"
  teamFullName: string; // ex: "Carolina Hurricanes"
  draftCount: number;   // Nombre de joueurs repêchés en première ronde (overall_pick < 31)
  top5Count: number;    // Nombre de joueurs repêchés dans le top 5 (overall_pick < 5)
  points: number;       // Nombre de points au classement
}

// Glossaire des équipes
const nhlTeams: { [abbreviation: string]: string } = {
  ANA: "Anaheim Ducks",
  BOS: "Boston Bruins",
  BUF: "Buffalo Sabres",
  CAR: "Carolina Hurricanes",
  CBJ: "Columbus Blue Jackets",
  CGY: "Calgary Flames",
  CHI: "Chicago Blackhawks",
  COL: "Colorado Avalanche",
  DAL: "Dallas Stars",
  DET: "Detroit Red Wings",
  EDM: "Edmonton Oilers",
  FLA: "Florida Panthers",
  LAK: "Los Angeles Kings",
  MIN: "Minnesota Wild",
  MTL: "Montreal Canadiens",
  NJD: "New Jersey Devils",
  NSH: "Nashville Predators",
  NYI: "New York Islanders",
  NYR: "New York Rangers",
  OTT: "Ottawa Senators",
  PHI: "Philadelphia Flyers",
  PIT: "Pittsburgh Penguins",
  SEA: "Seattle Kraken",
  SJS: "San Jose Sharks",
  STL: "St. Louis Blues",
  TBL: "Tampa Bay Lightning",
  TOR: "Toronto Maple Leafs",
  VAN: "Vancouver Canucks",
  VEG: "Vegas Golden Knights",
  WPG: "Winnipeg Jets",
  WSH: "Washington Capitals"
};

// Dictionnaire des champions (coupe Stanley) par année
const nhlChampions: { [year: number]: string } = {
  2008: "Detroit Red Wings",
  2009: "Pittsburgh Penguins",
  2010: "Chicago Blackhawks",
  2011: "Boston Bruins",
  2012: "Los Angeles Kings",
  2013: "Chicago Blackhawks",
  2014: "Los Angeles Kings",
  2015: "Chicago Blackhawks",
  2016: "Pittsburgh Penguins",
  2017: "Pittsburgh Penguins",
  2018: "Washington Capitals",
  2019: "St. Louis Blues",
  2020: "Tampa Bay Lightning",
  2021: "Tampa Bay Lightning"
};

// Couleur pour les équipes championnes
const championColor = "#FF8C00";

@Component({
  selector: 'app-scatter-plot',
  templateUrl: './scatter-plot.component.html',
  styleUrls: ['./scatter-plot.component.scss']
})
export class ScatterPlotComponent implements AfterViewInit {

  // false => utiliser draftCount (première ronde), true => top5Count
  useTop5: boolean = false;

  // Données calculées (fusion des CSV)
  chartData: ScatterData[] = [];

  // Dimensions intérieures du graphique
  private margin = { top: 20, right: 20, bottom: 60, left: 70 };
  private width = 800 - this.margin.left - this.margin.right;
  private height = 600 - this.margin.top - this.margin.bottom;

  constructor() {}

  ngAfterViewInit() {
    this.loadData();
  }

  /**
   * Convertit une année (ex: 2008) en saison ("2008-09")
   */
  private convertYearToSeason(year: number): string {
    return `${year}-${(year + 1).toString().slice(-2)}`;
  }

  private async loadData() {
    try {
      const draftData = await d3.csv('assets/data/nhldraft.csv');
      const seasonsData = await d3.csv('assets/data/seasons.csv');

      // Charger les fichiers skaters de 2008 à 2021
      const skatersPromises = [];
      for (let y = 2008; y <= 2021; y++) {
        skatersPromises.push(d3.csv(`assets/data/skaters_${y}.csv`));
      }
      const skatersDataArray = await Promise.all(skatersPromises);

      // Map pour overall_pick (comparaison en minuscules)
      const draftMap = new Map<string, number>();
      draftData.forEach(row => {
        const playerName = row['player']?.toLowerCase().trim();
        if (playerName) {
          draftMap.set(playerName, +row['overall_pick']);
        }
      });

      // Comptage de joueurs : première ronde (<31) et top 5 (<5)
      const draftCounts: { [key: string]: Set<string> } = {};
      const top5Counts: { [key: string]: Set<string> } = {};

      skatersDataArray.forEach((skaters, idx) => {
        const year = 2008 + idx;
        const seasonStr = this.convertYearToSeason(year);
        skaters.forEach(row => {
          const team = row['team']?.trim();
          const playerName = row['name']?.trim();
          if (!team || !playerName) return;
          const key = `${seasonStr}_${team}`;
          if (!draftCounts[key]) draftCounts[key] = new Set<string>();
          if (!top5Counts[key]) top5Counts[key] = new Set<string>();

          if (!draftCounts[key].has(playerName)) {
            const overallPick = draftMap.get(playerName.toLowerCase());
            if (overallPick !== undefined) {
              if (overallPick < 31) {
                draftCounts[key].add(playerName);
              }
              if (overallPick < 5) {
                top5Counts[key].add(playerName);
              }
            }
          }
        });
      });

      // Construction du tableau final en fusionnant avec seasonsData
      const scatterData: ScatterData[] = [];
      seasonsData.forEach(row => {
        const seasonStr = row['Season']; // ex: "2008-09"
        const startYear = parseInt(seasonStr.substring(0, 4), 10);
        if (startYear < 2008 || startYear > 2021) return;
        Object.keys(nhlTeams).forEach(teamAbbr => {
          const pointsStr = row[teamAbbr];
          if (!pointsStr || pointsStr === '') return;
          const points = +pointsStr;
          const key = `${seasonStr}_${teamAbbr}`;
          const draftCount = draftCounts[key] ? draftCounts[key].size : 0;
          const top5Count = top5Counts[key] ? top5Counts[key].size : 0;
          scatterData.push({
            season: seasonStr,
            teamAbbr,
            teamFullName: nhlTeams[teamAbbr],
            draftCount,
            top5Count,
            points
          });
        });
      });

      this.chartData = scatterData;
      this.drawChart(); // Dessiner initialement
    } catch (error) {
      console.error('Erreur de chargement / traitement des données', error);
    }
  }

  /**
   * Dessine le graphique (création unique du SVG et des éléments)
   */
  drawChart() {
    // Efface l'ancien contenu
    d3.select('#scatterPlot').selectAll('*').remove();

    // Calcul de la métrique X en fonction du toggle
    const maxX = d3.max(this.chartData, d => this.useTop5 ? d.top5Count : d.draftCount) || 1;
    // Échelle X sans .nice() pour obtenir uniquement des valeurs entières
    const xScale = d3.scaleLinear()
      .domain([0, maxX])
      .range([0, this.width]);
    const maxPoints = d3.max(this.chartData, d => d.points) || 1;
    const yScale = d3.scaleLinear()
      .domain([20, maxPoints])
      .range([this.height, 0]);

    // Création du SVG et du groupe principal
    const svg = d3.select('#scatterPlot')
      .append('svg')
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.height + this.margin.top + this.margin.bottom);
    const mainGroup = svg.append('g')
      .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);

    // Axe X avec ticks entiers
    const xAxis = d3.axisBottom<number>(xScale)
      .tickValues(d3.range(0, maxX + 1, 1))
      .tickFormat(d3.format('d'));
    const xAxisG = mainGroup.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${this.height})`)
      .call((g: any) => xAxis(g));
    xAxisG.select('.domain').remove();
    xAxisG.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', this.width)
      .attr('y2', 0)
      .attr('stroke', '#000')
      .attr('stroke-width', 1);

    // Titre axe X
    mainGroup.append('text')
      .attr('class', 'x axis-title')
      .attr('x', this.width / 2)
      .attr('y', this.height + 40)
      .attr('text-anchor', 'middle')
      .text(this.useTop5 ? 'Nombre de joueurs dans le Top 5' : 'Nombre de joueurs de première ronde');

    // Axe Y
    const yAxis = d3.axisLeft<number>(yScale).ticks(6);
    const yAxisG = mainGroup.append('g')
      .attr('class', 'y-axis')
      .call((g: any) => yAxis(g));
    yAxisG.select('.domain').remove();
    yAxisG.append('line')
      .attr('x1', 0)
      .attr('y1', yScale(20))
      .attr('x2', 0)
      .attr('y2', yScale(maxPoints))
      .attr('stroke', '#000')
      .attr('stroke-width', 1);

    // Titre axe Y
    mainGroup.append('text')
      .attr('class', 'y axis-title')
      .attr('transform', 'rotate(-90)')
      .attr('x', -this.height / 2)
      .attr('y', -50)
      .attr('text-anchor', 'middle')
      .text('Nombre de points accumulés en saison régulière');

    // Brisure de l'axe Y (zigzag) à la valeur 20
    const breakY = yScale(20);
    mainGroup.append('path')
      .attr('class', 'axis-break')
      .attr('d', `M -10,${breakY - 4} l 8,4 l -8,4`)
      .attr('stroke', '#000')
      .attr('stroke-width', 1)
      .attr('fill', 'none');

    // Récupération du tooltip
    const tooltip = d3.select('#chartTooltip');

    // Sélectionner les cercles avec typage générique
    const circles = mainGroup.selectAll<SVGCircleElement, ScatterData>('circle')
      .data(this.chartData)
      .enter()
      .append('circle')
      .attr('cx', (d: ScatterData) => xScale(this.useTop5 ? d.top5Count : d.draftCount))
      .attr('cy', (d: ScatterData) => yScale(d.points))
      .attr('r', 3)
      .attr('fill', (d: ScatterData) => {
        const year = parseInt(d.season.substring(0, 4), 10);
        return (nhlChampions[year] === d.teamFullName) ? championColor : 'black';
      })
      .on('mouseover', (event, d: ScatterData) => {
        d3.select(event.currentTarget).transition().duration(100).attr('r', 5);
        tooltip
          .style('opacity', '1')
          .html(`
            <strong>${d.teamFullName}</strong><br/>
            Saison: ${d.season}<br/>
            Points: ${d.points}<br/>
            1ère ronde: ${d.draftCount}<br/>
            Top 5: ${d.top5Count}
          `);
      })
      .on('mousemove', (event) => {
        const containerSel = d3.select('#chartContainer');
        const [mx, my] = d3.pointer(event, containerSel.node());
        tooltip
          .style('left', (mx + 10) + 'px')
          .style('top', (my - 20) + 'px');
      })
      .on('mouseout', (event) => {
        d3.select(event.currentTarget).transition().duration(100).attr('r', 3);
        tooltip.style('opacity', '0');
      });

    // Faire passer les points champions au premier plan
    circles.filter((d: ScatterData) => {
      const year = parseInt(d.season.substring(0, 4), 10);
      return nhlChampions[year] === d.teamFullName;
    }).raise();
  }

  /**
   * Lors du changement du toggle, on met à jour la position des points et l'axe X avec une transition.
   */
  updateChart() {
    // Récupérer le groupe principal existant
    const mainGroup = d3.select('#scatterPlot svg g');
    if (mainGroup.empty()) return;

    // Calculer la nouvelle échelle X en fonction de la métrique choisie
    const maxX = d3.max(this.chartData, d => this.useTop5 ? d.top5Count : d.draftCount) || 1;
    const xScale = d3.scaleLinear().domain([0, maxX]).range([0, this.width]);

    // Création de l'axe X avec ticks entiers
    const xAxis = d3.axisBottom<number>(xScale)
      .tickValues(d3.range(0, maxX + 1, 1))
      .tickFormat(d3.format('d'));

    // Sélection de l'axe X existant
    const xAxisGroup = mainGroup.select('.x-axis');
    // Supprimer tous les éléments enfants de l'axe pour repartir sur une base propre
    xAxisGroup.selectAll("*").remove();
    // Appliquer l'axe mis à jour sur le groupe
    xAxisGroup.call((g: any) => xAxis(g));
    // Recréer la ligne horizontale personnalisée
    xAxisGroup.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', this.width)
      .attr('y2', 0)
      .attr('stroke', '#000')
      .attr('stroke-width', 1);

    // Mettre à jour le titre de l'axe X
    mainGroup.select('.x.axis-title')
      .text(this.useTop5 ? 'Nombre de joueurs dans le Top 5' : 'Nombre de joueurs de première ronde');

    // Transition des positions horizontales des cercles (points)
    mainGroup.selectAll<SVGCircleElement, ScatterData>('circle')
      .transition().duration(500)
      .attr('cx', (d: ScatterData) => xScale(this.useTop5 ? d.top5Count : d.draftCount));
  }
}
