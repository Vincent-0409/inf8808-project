import { Component, OnInit } from '@angular/core';
import { DataPreprocessingService, DraftPlayer } from '../../services/preprocessing/preprocessing.service';
import { StatConfig } from '../draft-position-chart/draft-position-chart.component';

@Component({
  selector: 'app-small-multiples',
  templateUrl: './small-multiples.component.html',
  styleUrls: ['./small-multiples.component.scss']
})
export class SmallMultiplesComponent implements OnInit {
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

  constructor(private dataService: DataPreprocessingService) {}

  ngOnInit(): void {
    this.dataService.loadDraftData().subscribe(data => {
      this.players = data;
      this.groupPlayersByYear();
      
      // Filtrer les joueurs par plage d'années
      const filteredPlayers = this.dataService.filterPlayersByDraftYear(
        this.players, 
        this.yearRange.min, 
        this.yearRange.max
      );
      
      this.players = filteredPlayers;
    });
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
    this.yearRange.min = min;
    this.yearRange.max = max;
    
    const filteredPlayers = this.dataService.filterPlayersByDraftYear(
      this.players, 
      this.yearRange.min, 
      this.yearRange.max
    );
    
    this.players = filteredPlayers;
  }
  
  togglePositionSplit(): void {
    this.isPositionSplit = !this.isPositionSplit;
  }
}