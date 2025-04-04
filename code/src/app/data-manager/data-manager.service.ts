import { Injectable } from '@angular/core';
import * as d3 from 'd3';

export interface PlayerData {
  year: number;
  nationality: string;
  points: number;
  goals: number;
  assists: number;
  games_played: number;
  age: number;
  stat: number;
  yearGroup: string;
}

@Injectable({
  providedIn: 'root'
})
export class DataManagerService {
  // Reads CSV data from the given URL, preprocesses it based on the selected metric,
  // and calculates the maximum points per match (used for the common x-axis)
  loadDataForHistogram(csvUrl: string, selectedMetric: 'points' | 'goals' | 'assists'): Promise<{ data: PlayerData[], pointsMax: number }> {
    return d3.csv(csvUrl).then(rawData => {
      // Calculate pointsMax from the "points" column regardless of the selected metric
      const pointsMax = d3.max(rawData, d => {
        const gp = +d['games_played'];
        return gp > 0 ? Math.round((+d['points'] / gp) * 100) / 100 : 0;
      }) || 1;
      
      // Process each CSV record: convert strings to numbers, compute the stat, and assign a year group.
      const processed: (PlayerData | null)[] = rawData.map(d => {
        if (d[selectedMetric] === "" || d[selectedMetric] == null) return null;
        if (d['games_played'] === "" || d['games_played'] == null) return null;
        const year = +d['year'];
        const nationality = d['nationality'];
        const points = +d['points'];
        const goals = +d['goals'];
        const assists = +d['assists'];
        const gp = +d['games_played'];
        const age = (d['age'] === "" || d['age'] == null) ? 19 : +d['age'];
        let stat = 0;
        if (gp > 0) {
          if (selectedMetric === 'points') stat = points / gp;
          else if (selectedMetric === 'goals') stat = goals / gp;
          else if (selectedMetric === 'assists') stat = assists / gp;
        }
        stat = Math.round(stat * 100) / 100;
        const yearGroup = this.getYearGroup(year);
        return { year, nationality, points, goals, assists, games_played: gp, age, stat, yearGroup };
      });
      const data = processed.filter(d => d !== null && d.stat > 0) as PlayerData[];
      return { data, pointsMax };
    });
  }

  // Returns the 5-year group string for a given year
  private getYearGroup(year: number): string {
    const baseYear = 1963;
    const offset = year - baseYear;
    const groupIndex = Math.floor(offset / 5);
    const startYear = baseYear + groupIndex * 5;
    let endYear = startYear + 4;
    if (endYear > 2022) { endYear = 2022; }
    return `${startYear}-${endYear}`;
  }
}
