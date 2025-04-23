import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, shareReplay } from 'rxjs';
import * as d3 from 'd3';

export interface DraftPlayer {
  id: number;
  year: number;
  overall_pick: number;
  team: string;
  player: string;
  nationality: string;
  position: string;
  age: number;
  to_year: number | null;
  amateur_team: string;
  games_played: number | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  plus_minus: number | null;
  penalties_minutes: number | null;
  goalie_games_played: number | null;
  goalie_wins: number | null;
  goalie_losses: number | null;
  goalie_ties_overtime: number | null;
  save_percentage: number | null;
  goals_against_average: number | null;
  point_shares: number | null;
}

export interface HistogramData {
  year: number;
  nationality: string;
  age: number;
  stat: number;
  yearGroup: string;
}

@Injectable({
  providedIn: 'root'
})
export class DataPreprocessingService {
  private draftData: Observable<DraftPlayer[]> | null = null;
  private dataPath = 'assets/data/nhldraft.csv';

  constructor(private http: HttpClient) { }

  // Loads and parses the draft CSV data, caches the result
  loadDraftData(): Observable<DraftPlayer[]> {
    if (!this.draftData) {
      this.draftData = from(d3.csv(this.dataPath, this.parseRow)).pipe(
        shareReplay(1)
      );
    }
    return this.draftData;
  }
  // Parses a row from the CSV into a DraftPlayer object
  private parseRow(d: any): DraftPlayer {
    return {
      id: +d.id,
      year: +d.year,
      overall_pick: +d.overall_pick,
      team: d.team,
      player: d.player,
      nationality: d.nationality,
      position: d.position,
      age: +d.age,
      to_year: d.to_year ? +d.to_year : null,
      amateur_team: d.amateur_team,
      games_played: d.games_played ? +d.games_played : null,
      goals: d.goals ? +d.goals : null,
      assists: d.assists ? +d.assists : null,
      points: d.points ? +d.points : null,
      plus_minus: d.plus_minus ? +d.plus_minus : null,
      penalties_minutes: d.penalties_minutes ? +d.penalties_minutes : null,
      goalie_games_played: d.goalie_games_played ? +d.goalie_games_played : null,
      goalie_wins: d.goalie_wins ? +d.goalie_wins : null,
      goalie_losses: d.goalie_losses ? +d.goalie_losses : null,
      goalie_ties_overtime: d.goalie_ties_overtime ? +d.goalie_ties_overtime : null,
      save_percentage: d.save_percentage ? +d.save_percentage : null,
      goals_against_average: d.goals_against_average ? +d.goals_against_average : null,
      point_shares: d.point_shares ? +d.point_shares : null,
    };
  }

  /**
   * Transform a list of draft players into structured histogram data.
   * For each player, this computes the per-game stat (based on selected metric),
   * filters out those without games played or invalid stats,
   * and assigns them to a 5-year group for visualization.
   */
  prepareHistogramData(
    players: DraftPlayer[],
    metric: 'points' | 'goals' | 'assists'
  ): HistogramData[] {
    return players
      .map(p => {
        const gp = p.games_played ?? 0;
        if (gp === 0) return null;
        let stat = 0;
        switch (metric) {
          case 'points': stat = (p.points ?? 0) / gp; break;
          case 'goals': stat = (p.goals ?? 0) / gp; break;
          case 'assists': stat = (p.assists ?? 0) / gp; break;
        }
        stat = Math.round(stat * 100) / 100;
        return {
          year: p.year,
          nationality: p.nationality,
          age: p.age,
          stat,
          yearGroup: this.getYearGroup(p.year)
        } as HistogramData;
      })
      .filter((d): d is HistogramData => d !== null && d.stat > 0);
  }
  /**
   * Assign a draft year to a 5-year group (e.g. "2000-2004").
   * This is used to group players visually in the histogram by draft era.
   */
  public getYearGroup(year: number): string {
    const base = 1963;
    const idx = Math.floor((year - base) / 5);
    const start = base + idx * 5;
    const end = Math.min(start + 4, new Date().getFullYear());
    return `${start}-${end}`;
  }

  // Filters players by a draft year range
  filterPlayersByDraftYear(players: DraftPlayer[], minYear: number, maxYear: number): DraftPlayer[] {
    return players.filter(p => p.year >= minYear && p.year <= maxYear);
  }

  // Filters players by a list of positions
  filterPlayersByPosition(players: DraftPlayer[], positions: string[]): DraftPlayer[] {
    return players.filter(p => positions.includes(p.position));
  }
  
  // Checks if a player is considered a regular based on games played
  isRegularPlayer(player: DraftPlayer, gamesThreshold: number = 300): boolean {
    return player.games_played !== null && player.games_played >= gamesThreshold;
  }

  // Calculates per-game scoring stats for a player
  calculatePerGameStats(player: DraftPlayer): { 
    goalsPerGame: number; 
    assistsPerGame: number; 
    pointsPerGame: number;
  } {
    const gamesPlayed = player.games_played || 0;
    if (gamesPlayed === 0) {
      return { goalsPerGame: 0, assistsPerGame: 0, pointsPerGame: 0 };
    }
    
    return {
      goalsPerGame: (player.goals || 0) / gamesPlayed,
      assistsPerGame: (player.assists || 0) / gamesPlayed,
      pointsPerGame: (player.points || 0) / gamesPlayed
    };
  }

  // Filters out goalies from the player list
  filterGoalies(players: DraftPlayer[]): DraftPlayer[] {
    return players.filter(p => p.position !== 'G');
  }

  // Groups players by their draft year
  groupPlayersByYear(players: DraftPlayer[]): Record<number, DraftPlayer[]> {
    return players.reduce((acc, player) => {
      if (!acc[player.year]) {
        acc[player.year] = [];
      }
      acc[player.year].push(player);
      return acc;
    }, {} as Record<number, DraftPlayer[]>);
  }

  // Sorts and ranks players by a given stat in descending order
  rankPlayersByStat(players: DraftPlayer[], stat: keyof DraftPlayer): DraftPlayer[] {
    return [...players]
      .filter(p => p[stat] !== null)
      .sort((a, b) => (b[stat] as number) - (a[stat] as number));
  }

  // Calculates the Spearman rank correlation between two arrays
  calculateSpearmanCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) { return 0;}
    
    const n = x.length;
    const rankDiffs = x.map((_, i) => (x[i] - y[i]) ** 2);
    const sumDiffs = rankDiffs.reduce((sum, d) => sum + d, 0);
    
    return 1 - ((6 * sumDiffs) / (n * (n ** 2 - 1)));
  }

  // Computes Spearman correlation by year for several performance stats
  getSpearmanCorrelationByYear(players: DraftPlayer[]): { year: number; stat: string; correlation: number; nb_players_considered: number; }[] {
    const filteredPlayersByYear = this.filterPlayersByDraftYear(players, 1963, 2018);
    const filteredPlayers = this.filterGoalies(filteredPlayersByYear);
  
    const groupedByYear = this.groupPlayersByYear(filteredPlayers);
  
    const stats = ['games_played', 'goals', 'assists', 'points'] as const;
    let results: { year: number; stat: string; correlation: number; nb_players_considered: number; }[] = [];
  
    Object.entries(groupedByYear).forEach(([year, yearPlayers]) => {
      stats.forEach(stat => {
        const rankedByStat = this.rankPlayersByStat(yearPlayers, stat);
        const nb_players_considered = rankedByStat.length;
  
        const statRanks: number[] = rankedByStat.map((_, index) => index + 1);
        const overallPicks: number[] = rankedByStat.map(player => player.overall_pick!);
  
        const sortedDraft = [...overallPicks].sort((a, b) => a - b);
        const draftRanks = overallPicks.map(pick => sortedDraft.indexOf(pick) + 1);
  
        const correlation = this.calculateSpearmanCorrelation(draftRanks, statRanks);
  
        results.push({ year: Number(year), stat, correlation,  nb_players_considered });
      });
    });
  
    return results;
  }
}