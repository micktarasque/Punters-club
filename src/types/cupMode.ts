export interface CupTournamentState {
  isActive: boolean;
  name: string;
  meetingId: string;
  participants: string[];
  // Keyed by raceNumber -> { [punterName]: tabNumber } (the final unique drafted pick) for active meeting
  selectionsByRace: Record<number, Record<string, number>>;
  // Keyed by raceNumber -> { [punterName]: number[] } (the 8-horse ordered preference array) for active meeting
  userPreferencesByRace?: Record<number, Record<string, number[]>>;
  // Multi-meeting partitioned preferences: meetingId -> raceNumber -> punterName -> preferences
  userPreferencesByMeeting?: Record<string, Record<number, Record<string, number[]>>>;
  // Multi-meeting partitioned draft picks: meetingId -> raceNumber -> punterName -> tabNumber
  selectionsByMeeting?: Record<string, Record<number, Record<string, number>>>;
  // Multi-meeting partitioned draft details: meetingId -> raceNumber -> punterName -> detail
  draftResolutionDetailsByMeeting?: Record<
    string,
    Record<
      number,
      Record<
        string,
        {
          tabNumber: number;
          preferenceRankUsed: number;
          wasFallback: boolean;
          originallyWantedTab?: number;
          originallyTakenBy?: string;
        }
      >
    >
  >;
  // Records how each drafted runner was resolved (1st preference, or fallback to 2nd, 3rd, etc.)
  draftResolutionDetails?: Record<
    number,
    Record<
      string,
      {
        tabNumber: number;
        preferenceRankUsed: number;
        wasFallback: boolean;
        originallyWantedTab?: number;
        originallyTakenBy?: string;
      }
    >
  >;
  draftType: "snake" | "fixed";
  activeRaceNumber: number;
  activeDraftIndex: number;
  draftStepCursor?: {
    meetingId?: string;
    meetingVenue?: string;
    raceNumber: number;
    punterName: string;
    stepIndex: number;
    totalSteps: number;
    isComplete: boolean;
  };
  lastDraftStepCallout?: string;
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

export interface CupAllocatedPickInfo {
  tabNumber: number;
  preferenceRankUsed: number;
  wasFallback: boolean;
  originallyWantedTab?: number;
  originallyTakenBy?: string;
}
