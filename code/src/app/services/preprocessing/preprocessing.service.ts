import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, filter, from, shareReplay } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})
export class DataPreprocessingService {
  private draftData: Observable<DraftPlayer[]> | null = null;
  private dataPath = 'assets/data/nhldraft.csv';

  constructor(private http: HttpClient) { }

  loadDraftData(): Observable<DraftPlayer[]> {
    if (!this.draftData) {
      this.draftData = from(d3.csv(this.dataPath, this.parseRow)).pipe(shareReplay(1));
    }
    return this.draftData;
  }

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

  filterPlayersByDraftYear(players: DraftPlayer[], minYear: number, maxYear: number): DraftPlayer[] {
    return players.filter(p => p.year >= minYear && p.year <= maxYear);
  }

  filterPlayersByPosition(players: DraftPlayer[], positions: string[]): DraftPlayer[] {
    return players.filter(p => positions.includes(p.position));
  }
  
  // ecq un gamesThreshold de 300 est bon?
  isRegularPlayer(player: DraftPlayer, gamesThreshold: number = 300): boolean {
    return player.games_played !== null && player.games_played >= gamesThreshold;
  }

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

  // for heatmap
  filterGoalies(players: DraftPlayer[]): DraftPlayer[] {
    return players.filter(p => p.position !== 'G');
  }

  // for heatmap
  groupPlayersByYear(players: DraftPlayer[]): Record<number, DraftPlayer[]> {
    return players.reduce((acc, player) => {
      if (!acc[player.year]) {
        acc[player.year] = [];
      }
      acc[player.year].push(player);
      return acc;
    }, {} as Record<number, DraftPlayer[]>);
  }

  // for heatmap
  rankPlayersByStat(players: DraftPlayer[], stat: keyof DraftPlayer): DraftPlayer[] {
    return [...players]
      .filter(p => p[stat] !== null)
      .sort((a, b) => (b[stat] as number) - (a[stat] as number));
  }

  // for heatmap
  calculateSpearmanCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) {
      console.log("shits offfffffffffffffffffffffffffffff")
      return 0;
    }
    
    const n = x.length;
    const rankDiffs = x.map((_, i) => (x[i] - y[i]) ** 2);
    const sumDiffs = rankDiffs.reduce((sum, d) => sum + d, 0);
    
    return 1 - ((6 * sumDiffs) / (n * (n ** 2 - 1)));
  }

  // for heatmap
  // getSpearmanCorrelationByYear(players: DraftPlayer[]): { year: number; stat: string; correlation: number }[] {
  //   const filteredPlayersByYear = this.filterPlayersByDraftYear(players, 1963, 2018);
  //   const filteredPlayers = this.filterGoalies(filteredPlayersByYear);
  //   console.log("without goalie", filteredPlayers);

  //   const groupedByYear = this.groupPlayersByYear(filteredPlayers);
  //   console.log("transformed to by year", groupedByYear);
  
  //   const stats = ['games_played', 'goals', 'assists', 'points'] as const;
  //   let results: { year: number; stat: string; correlation: number }[] = [];

  //   Object.entries(groupedByYear).forEach(([year, yearPlayers]) => {
  //     console.log("Year: ", year)
  //     stats.forEach(stat => {
  //       console.log("stat: ", stat)
  //       // Get only players who have non-null stat values
  //       const statRankedPlayers = this.rankPlayersByStat(yearPlayers, stat);
  //       console.log("statRankedplayers:", statRankedPlayers)
  
  //       // Extract their overall_pick values and rank those
  //       const draftRankedPlayers = [...statRankedPlayers]
  //         .sort((a, b) => (a.overall_pick as number) - (b.overall_pick as number));
  //       console.log("ranked draft picks:", draftRankedPlayers)
  
  //       // Build the ranks for Spearman
  //       const statRanks = statRankedPlayers.map((_, i) => i + 1);
  //       console.log("statranks: ", statRanks)
  //       const draftRanks = statRankedPlayers.map(player =>
  //         draftRankedPlayers.findIndex(p => p.id === player.id) + 1
  //       );
  //       console.log("draftranks: ", draftRanks)
  
  //       const correlation = this.calculateSpearmanCorrelation(draftRanks, statRanks);
  //       results.push({ year: Number(year), stat, correlation });
  //     });
  //   });
  
  //   return results;
  // }

  // for heatmap
  // TODO: 
  // Maybe filter out the correlations for years or stats of years that 
  // have fewer than a set number of samples used for calculation.
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
  
        // console.log(`Year: ${year}, Stat: ${stat}`);
        // console.log("Stat Ranks:", statRanks);
        // console.log("Draft Ranks (re-ranked picks):", draftRanks);
        // console.log("Correlation:", correlation);
        // console.log("-----------------------------");
  
        results.push({ year: Number(year), stat, correlation,  nb_players_considered });
      });
    });
  
    return results;
  }
  
}