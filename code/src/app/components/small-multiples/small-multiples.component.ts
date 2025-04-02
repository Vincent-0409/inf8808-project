import { Component } from '@angular/core';
import { DataPreprocessingService, DraftPlayer } from '../../services/preprocessing/preprocessing.service';

@Component({
  selector: 'app-small-multiples',
  templateUrl: './small-multiples.component.html',
  styleUrls: ['./small-multiples.component.scss']
})
export class SmallMultiplesComponent {
  players: DraftPlayer[] = [];
  groupedPlayers: { [year: number]: DraftPlayer[] } = {};

  constructor(private dataService: DataPreprocessingService) {}

  ngOnInit(): void {
    this.dataService.loadDraftData().subscribe(data => {
      console.log(data)
      this.players = data;
      this.groupPlayersByYear();
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
}