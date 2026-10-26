export interface PastRun {
  date: string;
  track: string;
  distance: number;
  classGrade: string;
  finish: string;
  margin: string;
  jockey: string;
  weight: number;
  trackRating: string;
  startingPrice: string;
}

export interface RaceRunner {
  tabNumber: number;
  horseName: string;
  barrier: number;
  jockey: string;
  trainer: string;
  weight: number;
  form: string;
  finishPosition: number; // 1, 2, 3, 4 or 0 for unplaced/upcoming
  margin: string;
  nswTabWin: number;
  nswTabPlace: number;
  fixedWin: number;
  fixedPlace?: number;
  openingOdds?: number;
  previousOdds?: number;
  oddsTrend?: "shortening" | "drifting" | "steady";
  lastOddsChange?: number;
  flucs?: string[];
  marketSupport?: "Firming" | "Drifting" | "Steady";
  sectional600m?: string;
  silkPrimary?: string;
  silkSecondary?: string;
  // Comprehensive Form Guide fields
  ageSex?: string;
  sireDam?: string;
  damsire?: string;
  headgear?: string;
  owner?: string;
  officialRating?: number;
  rpr?: number;
  tsr?: number;
  daysSinceLastRun?: number;
  trainer14DayWinPct?: string;
  careerRecord?: string;
  prizeMoneyEarned?: string;
  trackDistRecord?: string;
  wetTrackRecord?: string;
  firstUpSecondUp?: string;
  speedMapPosition?: "Leader" | "On Pace" | "Midfield" | "Backmarker";
  speedMapRole?: "Leader" | "Stalker" | "Backmarker";
  careerClosingSpeed?: number; // e.g. 61.8 (km/h)
  closingSpeedL600?: number; // e.g. 34.9 (seconds)
  speedRating?: number;
  formComment?: string;
  lastStarts?: PastRun[];
  isScratched?: boolean;
}

export interface ExoticDividend {
  poolType: string;
  combination: string;
  dividend: number;
}

export interface RaceEvent {
  raceNumber: number;
  raceName: string;
  startTime: string;
  distance: number;
  classGrade: string;
  classLevel?: string;
  pattern?: string;
  ageBand?: string;
  surface?: string;
  bigRace?: boolean;
  prizeMoney: string;
  status: string;
  winningTime?: string;
  last600m?: string;
  winBook?: number;
  substitute?: number;
  scratchings?: number;
  resultedTime?: string;
  tip?: string;
  verdict?: string;
  bettingForecast?: string;
  fieldSize?: number;
  runners: RaceRunner[];
  exotics: ExoticDividend[];
}

export interface RaceMeeting {
  id: string;
  venue: string;
  state: string;
  tier?: "Metro" | "Metropolitan" | "Provincial" | "Country";
  meetingCode?: string;
  dayOfWeek?: string;
  date: string;
  trackCondition?: string;
  trackRating?: string;
  weather: string;
  railPosition: string;
  dataIntegrityVerified?: boolean;
  races: RaceEvent[];
}

/**
 * 3 horses selected in order of preference (1st, 2nd, 3rd) for a single race on a card.
 * Values store the runner's `tabNumber` (or null if not yet chosen).
 */
export interface RaceSelectionTrio {
  firstPref: number | null;
  secondPref: number | null;
  thirdPref: number | null;
  updatedAt?: string;
}

/**
 * A user/punter's selections across all meetings and races.
 * Keyed by meeting.id -> raceNumber -> RaceSelectionTrio
 */
export interface PunterProfile {
  id: string;
  name: string;
  role: string;
  selectionsByMeeting: Record<string, Record<number, RaceSelectionTrio>>;
  /**
   * Optional Joker Round selection per meeting (keyed by meeting.id -> raceNumber | null).
   * When a user nominates a Joker race, they receive double points (2x) for all successful selections (1st, 2nd, or 3rd).
   */
  jokerRaceByMeeting?: Record<string, number | null>;
  jokerUpdatedAtByMeeting?: Record<string, string>;
  autoSubEnabled?: boolean;
  cupAllocationsByMeeting?: Record<string, Record<number, import("./cupMode").CupAllocatedPickInfo>>;
  updatedAt?: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}
