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

  // Reads CSV and returns raw data along with pointsMax for histogram
  loadRawDataForHistogram(csvUrl: string): Promise<{ rawData: any[], pointsMax: number }> {
    return d3.csv(csvUrl).then(rawData => {
      const pointsMax = d3.max(rawData, d => {
        const gp = +d['games_played'];
        return gp > 0 ? Math.round((+d['points'] / gp) * 100) / 100 : 0;
      }) || 1;
      return { rawData, pointsMax };
    });
  }

  // Processes raw CSV data based on the selected metric for histogram
  processDataForHistogram(rawData: any[], selectedMetric: 'points' | 'goals' | 'assists'): PlayerData[] {
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
        switch(selectedMetric) {
          case 'points': stat = points / gp; break;
          case 'goals': stat = goals / gp; break;
          case 'assists': stat = assists / gp; break;
        }
      }
      stat = Math.round(stat * 100) / 100;
      const yearGroup = this.getYearGroup(year);
      return { year, nationality, points, goals, assists, games_played: gp, age, stat, yearGroup };
    });
    return processed.filter(d => d !== null && d.stat > 0) as PlayerData[];
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
