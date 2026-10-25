export interface CupTournamentState {
  isActive: boolean;
  name: string;
  meetingId: string;
  participants: string[];
  // Keyed by raceNumber -> { [punterName]: tabNumber }
  selectionsByRace: Record<number, Record<string, number>>;
  draftType: "snake" | "fixed";
  activeRaceNumber: number;
  activeDraftIndex: number;
  updatedAt: string;
}

export interface CupUserRaceOutcome {
  raceNumber: number;
  punterName: string;
  tabNumber: number;
  horseName: string;
  barrier: number;
  jockey: string;
  trainer: string;
  fixedWin: number;
  finishPosition: number;
  isWon: boolean;
  isPlaced: boolean;
  points: number;
  dollarReturn: number;
  netProfit: number;
}

export interface CupUserLeaderboardEntry {
  punterName: string;
  rank: number;
  totalPicks: number;
  winCount: number;
  placeCount: number;
  strikeRatePct: number;
  totalPoints: number;
  totalDollarReturn: number;
  totalOutlay: number;
  netProfit: number;
  raceOutcomes: CupUserRaceOutcome[];
}

export interface CupSyndicateTrifectaOutcome {
  raceNumber: number;
  raceName: string;
  status: string;
  boxedRunners: Array<{
    tabNumber: number;
    horseName: string;
    punterName: string;
    finishPosition: number;
  }>;
  totalCombinations: number;
  flexiStake: number;
  flexiPercentage: number;
  officialTrifectaDividend: number;
  isStruck: boolean;
  flexiPayout: number;
  netProfit: number;
}
