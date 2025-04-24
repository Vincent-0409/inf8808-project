import { Injectable } from '@angular/core';
import * as d3 from 'd3';
import { Observable, forkJoin, from } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

/**
 * Raw draft player as parsed from nhldraft.csv
 */
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

/**
 * Data structure for each point in the scatter plot
 */
export interface ScatterData {
  season: string;
  teamAbbr: string;
  teamFullName: string;
  draftCount: number;
  top5Count: number;
  points: number;
}

/**
 * Data structure for each point in the histogram
 */
export interface HistogramData {
  year: number;
  nationality: string;
  age: number;
  stat: number;
  yearGroup: string;
}

/** Intermediate structure pairing a season year with its skater rows */
interface SkaterSet {
  year: number;
  rows: any[];
}

@Injectable({
  providedIn: 'root'
})
export class DataPreprocessingService {
  private draftCache$?: Observable<DraftPlayer[]>;

  /** Map of team abbreviations to full names */
  private readonly nhlTeams: { [abbr: string]: string } = {
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

  /** Stanley Cup champions by season start year */
  private readonly nhlChampions: { [year: number]: string } = {
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

  constructor() { }

  /**
   * Load and parse nhldraft.csv.
   * Caches the result so multiple subscribers share the same data.
   */
  loadDraftData(): Observable<DraftPlayer[]> {
    if (!this.draftCache$) {
      this.draftCache$ = from(
        d3.csv('assets/data/nhldraft.csv', this.parseDraftRow.bind(this))
      ).pipe(
        shareReplay(1)
      );
    }
    return this.draftCache$;
  }

  /** Parse a single row of nhldraft.csv into a DraftPlayer */
  private parseDraftRow(row: any): DraftPlayer {
    return {
      id: +row.id,
      year: +row.year,
      overall_pick: +row.overall_pick,
      team: row.team,
      player: row.player,
      nationality: row.nationality,
      position: row.position,
      age: +row.age,
      to_year: row.to_year ? +row.to_year : null,
      amateur_team: row.amateur_team,
      games_played: row.games_played ? +row.games_played : null,
      goals: row.goals ? +row.goals : null,
      assists: row.assists ? +row.assists : null,
      points: row.points ? +row.points : null,
      plus_minus: row.plus_minus ? +row.plus_minus : null,
      penalties_minutes: row.penalties_minutes ? +row.penalties_minutes : null,
      goalie_games_played: row.goalie_games_played ? +row.goalie_games_played : null,
      goalie_wins: row.goalie_wins ? +row.goalie_wins : null,
      goalie_losses: row.goalie_losses ? +row.goalie_losses : null,
      goalie_ties_overtime: row.goalie_ties_overtime ? +row.goalie_ties_overtime : null,
      save_percentage: row.save_percentage ? +row.save_percentage : null,
      goals_against_average: row.goals_against_average ? +row.goals_against_average : null,
      point_shares: row.point_shares ? +row.point_shares : null,
    };
  }

  /** Load seasons.csv as array of records */
  private loadSeasonsData(): Observable<Record<string,string>[]> {
    return from(
      d3.csv('assets/data/seasons.csv') as Promise<Record<string,string>[]>
    );
  }

  /** Load skaters_{year}.csv as array of records */
  private loadSkatersByYear(year: number): Observable<Record<string,string>[]> {
    return from(
      d3.csv(`assets/data/skaters_${year}.csv`) as Promise<Record<string,string>[]>
    );
  }

  /**
   * Build the full ScatterData array by combining:
   * 1) draft picks
   * 2) season standings
   * 3) skater rosters by year
   */
  getScatterData(): Observable<ScatterData[]> {
    const draft$   = this.loadDraftData();
    const seasons$ = this.loadSeasonsData();

    // Load all skater CSVs in parallel; result is an array of row arrays
    const years = Array.from({ length: 2021 - 2008 + 1 }, (_, i) => 2008 + i);
    const skaterArrays$ = forkJoin(
      years.map(year => this.loadSkatersByYear(year))
    );

    return forkJoin({ draft: draft$, seasons: seasons$, skaterRows: skaterArrays$ }).pipe(
      map(({ draft, seasons, skaterRows }) => {
        // 1) Map player name → overall_pick
        const pickMap = new Map<string,number>();
        draft.forEach(p => {
          const key = p.player.toLowerCase().trim();
          pickMap.set(key, p.overall_pick);
        });

        // 2) Count first-round and top-5 picks per (season, team)
        const draftCounts: Record<string,Set<string>> = {};
        const top5Counts:  Record<string,Set<string>> = {};

        skaterRows.forEach((rows, idx) => {
          const year   = years[idx];
          const season = this.convertYearToSeason(year);
          rows.forEach(r => {
            const team   = (r['team'] || '').trim();
            const player = (r['name'] || '').trim();
            if (!team || !player) return;

            const key = `${season}_${team}`;
            draftCounts[key] ||= new Set<string>();
            top5Counts[key]  ||= new Set<string>();

            if (!draftCounts[key].has(player)) {
              const pick = pickMap.get(player.toLowerCase());
              if (pick != null) {
                if (pick < 31) draftCounts[key].add(player);
                if (pick < 5)  top5Counts[key].add(player);
              }
            }
          });
        });

        // 3) Merge with seasons.csv to produce ScatterData[]
        const result: ScatterData[] = [];
        seasons.forEach(row => {
          const season = row['Season'];
          const startY = parseInt(season.slice(0,4), 10);
          if (startY < 2008 || startY > 2021) return;

          Object.entries(row).forEach(([abbr, pts]) => {
            if (abbr === 'Season' || pts === '') return;
            const key = `${season}_${abbr}`;
            result.push({
              season,
              teamAbbr:     abbr,
              teamFullName: this.nhlTeams[abbr],
              draftCount:   draftCounts[key]?.size  || 0,
              top5Count:    top5Counts[key]?.size   || 0,
              points:       +pts
            });
          });
        });

        return result;
      })
    );
  }

  /** Convert a year (e.g. 2008) into a season string "2008-09" */
  private convertYearToSeason(year: number): string {
    return `${year}-${(year + 1).toString().slice(-2)}`;
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