import type { PunterProfile, RaceMeeting } from "../types/racing.ts";
import { isRaceOfficialOrCompleted } from "../data/seedNswTab.ts";
import {
  DEFAULT_QUADDIE_BUY_IN_PER_USER,
  evaluateCombinedQuaddieForMeeting,
  evaluateCombinedTrifectaForRace,
  evaluateRaceTrio,
  formatDollarReturn,
  getFeatureRaceNumberForMeeting,
  getPunterJokerForMeeting,
  getPunterSelectionsForMeeting,
} from "./scoring.ts";
import { safeJsonParse } from "./safeFetchJson.ts";

export const SIX_MONTHS_RETENTION_MS = 180 * 24 * 60 * 60 * 1000; // 180 days (6 months)
export const STORAGE_KEY_RACE_REPORTS_ARCHIVE =
  "turfsheet_completed_participated_reports_6m_v6";
export const REPORT_SENDER_NAME = "Punters Club results";
export const DEFAULT_REPORT_EMAIL_RECIPIENTS = [
  "bobbydazzler83@gmail.com",
  "markstead@me.com",
];

export interface ReportUserStandingRow {
  punterId: string;
  punterName: string;
  role: string;
  rank: number;
  racesParticipated: number;
  selectedHorsesCount: number; // e.g. 30 horses across a 10-race card
  rawEachWayUnitsOutlay: number; // selectedHorsesCount * 2 ($1 Win + $1 Place per horse)
  parScoreUnits: number; // NTD-adjusted $1 Each-Way Par Score for participated races (e.g. 60u on a 10-race standard card)
  fullCardParScoreUnits: number; // Full card $1 Each-Way Par Score across all races on the card
  eachWayDollarReturn: number; // $1 Each-Way return ($1W + $1P on all selected horses; 3rd pays $0 on NTD <=7 runner races)
  eachWayNetVsPar: number; // eachWayDollarReturn - parScoreUnits
  eachWayReturnRatePct: number; // (eachWayDollarReturn / parScoreUnits) * 100
  winnersPicked: number;
  podiumsPicked: number;
  firstPrefHits: number;
  secondPrefHits: number;
  thirdPrefHits: number;
  jokerRaceNumber: number | null;
  jokerTriggered: boolean;
  jokerBonusPoints: number;
  totalPoints: number;
  totalDollarReturn: number;
  strikeRatePct: number;
  winStrikeRatePct?: number;
  avgPtsPerRace?: number;
  // User Favourite Selection Tendency Metrics
  favouritesSelectedCount: number; // Number of races where user selected the #1 market favourite
  favouriteFirstPrefCount: number; // Number of races where user's 1st Pref was the #1 market favourite
  favouriteSelectionRatePct: number; // % of participated races where user picked the favourite
  top3MarketPicksCount: number; // Picks from top 3 in market betting
  top3MarketSharePct: number; // % of user's total picks in top 3 market elects
  valueLongshotPicksCount: number; // Picks at $10.00+ Win odds
  avgSelectedRunnerOdds: number; // Mean Win odds ($) of all horses selected by user
  favouriteHitsCount: number; // Times backing the favourite resulted in a podium
  favouriteTendencyLabel: string;
  favouriteTendencyAssessment: string;
}

export interface ReportRaceRow {
  raceNumber: number;
  raceName: string;
  startTime: string;
  distance: number;
  classGrade: string;
  fieldSize?: number;
  isNtdRace?: boolean; // True when 5 <= fieldSize <= 7 (No Third Dividend) or <=4
  raceParUnits?: number; // 6u standard (8+ runners), 5u NTD (5-7 runners), 3u Win-only (<=4 runners)
  favouriteRunnerText?: string;
  didFavouriteWin?: boolean;
  winningBarrier?: number;
  winningJockey?: string;
  winningTrainer?: string;
  podium: {
    first: string;
    second: string;
    third: string;
    firstWinOdds: number;
  };
  userCells: Array<{
    punterId: string;
    punterName: string;
    hasParticipated: boolean;
    picksSummary: string;
    hitSummary: string;
    isJokerRace: boolean;
    jokerTriggered: boolean;
    points: number;
    dollarReturn: number;
    eachWayRaceReturn?: number;
    raceParUnits?: number;
    pickedFavourite?: boolean;
  }>;
  trifecta: {
    poolRunnersText: string;
    poolCount: number;
    boxedCombinations: number;
    officialCombination: string;
    officialDividend: number;
    isHit: boolean;
    hitCount: number; // 0, 1, 2, or 3
    betAmount: number;
    flexiReturnOnBet: number;
  };
}

export interface ReportQuaddieLegSummary {
  legIndex: number;
  raceNumber: number;
  raceName: string;
  isResulted: boolean;
  winnerText: string;
  winnerOdds: number;
  runnerCount: number;
  runnersText: string;
  fieldSize: number;
  fieldCoveragePct: number;
  isHit: boolean;
  winningSource: "user" | "extra" | "both" | "missed" | "pending";
}

export interface ReportQuaddieSummary {
  buyInPerUser: number;
  participatingUsersCount: number;
  betAmount: number;
  totalCombinations: number;
  flexiPercentage: number;
  completedLegsCount: number;
  hitLegsCount: number;
  isAlive: boolean;
  isWon: boolean;
  combinationString: string;
  officialOrEstimatedDividend: number;
  isOfficialDividend: boolean;
  flexiPayout: number;
  flexiPayoutPerUser: number;
  netProfit: number;
  netProfitPerUser: number;
  declaredQuaddieLabel?: string;
  verificationSource?: string;
  legs: ReportQuaddieLegSummary[];
}

export interface ReportCardJockeyTrainerEntry {
  name: string;
  wins: number;
  seconds: number;
  thirds: number;
  podiums: number;
  winningRacesText: string;
  avgWinningOdds: number;
}

export interface ReportCardTrackAssessment {
  venue: string;
  raceDate: string;
  totalRacesOnCard: number;
  completedRacesCount: number;
  avgFieldSize: number;
  // $1 Each-Way Par Score & NTD (No Third Dividend) Telemetry
  standardThreePlaceRacesCount: number; // >= 8 runners (6 units par per race)
  ntdRacesCount: number; // <= 7 runners (No Third Dividend — 5 units par for 5-7 runners)
  ntdRaceNumbers: number[];
  rawFullCardUnits: number; // totalRacesOnCard * 3 horses * 2 units (e.g. 60u for 10 races)
  cardParScoreUnits: number; // NTD-adjusted Par Score in units (e.g. 60u standard or reduced by 1u per NTD race)
  parScoreExplanation: string;
  // Favourite Win & Place Assessment
  favouriteWinsCount: number;
  favouriteWinRatePct: number;
  favouritePlacedCount: number;
  favouritePlaceRatePct: number;
  winningFavouritesList: string[];
  avgWinningOdds: number;
  shortestWinnerText: string;
  longestWinnerText: string;
  marketBiasVerdict: string;
  // Winning Barrier Assessment
  avgWinningBarrier: number;
  mostSuccessfulBarriers: Array<{
    barrier: number;
    wins: number;
    podiums: number;
    racesText: string;
  }>;
  barrierZones: {
    inside1To4Wins: number;
    inside1To4Pct: number;
     inside1To4Podiums: number;
    middle5To8Wins: number;
    middle5To8Pct: number;
    middle5To8Podiums: number;
    outside9PlusWins: number;
    outside9PlusPct: number;
    outside9PlusPodiums: number;
  };
  barrierBiasVerdict: string;
  // Winning Jockeys & Trainers Assessment
  leadingJockeys: ReportCardJockeyTrainerEntry[];
  jockeyAssessmentText: string;
  leadingTrainers: ReportCardJockeyTrainerEntry[];
  trainerAssessmentText: string;
  // Additional Track / Distance Metrics
  sprintWinnerAvgBarrier: number;
  stayingWinnerAvgBarrier: number;
  overallCardProfileSummary: string;
}

export interface ReportAnalyticsMetrics {
  syndicateTotalPoints: number;
  syndicateTotalCashReturn: number;
  syndicateEachWayTotalReturn?: number;
  syndicateEachWayParUnits?: number;
  syndicateEachWayReturnRatePct?: number;
  syndicateWinPlaceOutlay: number;
  syndicateStrikeRatePct: number;
  syndicateWinRatePct: number;
  avgWinningRunnerOdds: number;
  highestSingleRaceCollect: {
    raceNumber: number;
    punterName: string;
    dollarReturn: number;
    points: number;
  };
  bestTrifectaRace: {
    raceNumber: number;
    isHit: boolean;
    hitCount: number;
    dividend: number;
    flexiCollect: number;
  } | null;
  combinedExoticsOutlay: number;
  combinedExoticsReturn: number;
  combinedExoticsNetProfit: number;
  combinedExoticsRoiPct: number;
}

export interface NextMajorMeetPreview {
  headline: string;
  introHook: string;
  sydneyNextMeet: {
    venue: string;
    dateLabel: string;
    carnivalTitle: string;
    featureRaces: string[];
    stakesHighlight: string;
    hypePitch: string;
  };
  melbourneNextMeet: {
    venue: string;
    dateLabel: string;
    carnivalTitle: string;
    featureRaces: string[];
    stakesHighlight: string;
    hypePitch: string;
  };
  closingRallyCry: string;
}

export interface TechnicalFunnyAssessment {
  headline: string;
  upfrontParagraphs: string[];
  executiveSummary: string;
  punterRoastsAndPraises: Array<{
    punterName: string;
    badge: string;
    commentary: string;
  }>;
  trifectaVerdict: string;
  quaddieVerdict?: string;
  favouriteTendencyVerdict?: string;
  cardTrackVerdict?: string;
  stewardsFunnyConclusion: string;
  nextMajorMeetsPreview: NextMajorMeetPreview;
}

export interface SavedRaceReport {
  id: string;
  meetingId: string;
  venue: string;
  state: string;
  raceDate: string; // YYYY-MM-DD
  createdAtIso: string;
  updatedAtIso: string;
  expiresAtIso: string; // +6 months (180 days)
  isRetroactive: boolean;
  trifectaBetAmount: number;
  participatingUsers: string[];
  completedParticipatedRacesCount: number;
  totalCardRacesCount: number;
  standings: ReportUserStandingRow[];
  raceRows: ReportRaceRow[];
  trifectaSummary: {
    racesEvaluated: number;
    trifectaHits: number;
    nearMisses2Of3: number;
    totalOutlay: number;
    totalFlexiReturn: number;
    netProfit: number;
    totalCapturedUnitDividends: number;
  };
  quaddieSummary?: ReportQuaddieSummary;
  cardTrackAssessment?: ReportCardTrackAssessment;
  analytics?: ReportAnalyticsMetrics;
  assessment: TechnicalFunnyAssessment;
  lastEmailedAtIso?: string;
  lastEmailedTo?: string[];
}

/**
 * Computes the $1 Each-Way Par Units for a single race given the number of selected horses (default 3)
 * and the race's field size.
 * - Standard race (>= 8 runners): pays 1st, 2nd, 3rd place dividends -> 1u Win + 1u Place = 2u per horse (3 horses = 6u).
 * - NTD race (5 to 7 runners, "No Third Dividend"): only 2 place dividends paid -> when 3 horses are selected,
 *   3 Win units + 2 Placeable units = 5u par (or for k<=2 horses, 2u per horse).
 * - Win-only field (<= 4 runners, no place pool): 1u Win per horse (3 horses = 3u par).
 */
export function computeRaceEachWayParUnits(
  fieldSize: number,
  horsesSelectedInRace: number = 3
): { parUnits: number; isNtd: boolean; placeGettersPaid: number } {
  const count = Math.max(0, horsesSelectedInRace);
  if (count === 0) {
    return {
      parUnits: 0,
      isNtd: fieldSize <= 7,
      placeGettersPaid: fieldSize >= 8 ? 3 : fieldSize >= 5 ? 2 : 0,
    };
  }
  if (fieldSize <= 4) {
    // Win only — no place dividend paid
    return {
      parUnits: count * 1,
      isNtd: true,
      placeGettersPaid: 0,
    };
  }
  if (fieldSize <= 7) {
    // NTD (No Third Dividend) — only 1st & 2nd pay place dividends
    const winUnits = count;
    const effectivePlaceUnits = Math.min(2, count);
    return {
      parUnits: winUnits + effectivePlaceUnits,
      isNtd: true,
      placeGettersPaid: 2,
    };
  }
  // Standard 8+ runner field — 1st, 2nd & 3rd pay place dividends (3 horses * 2u = 6u per race; 10 races = 60u)
  return {
    parUnits: count * 2,
    isNtd: false,
    placeGettersPaid: 3,
  };
}

/**
 * Computes a comprehensive Race Card Track & Market Assessment:
 * - How often the Favourite won and placed
 * - Which barrier winners typically jumped from (Inside 1-4 vs Middle 5-8 vs Outside 9+)
 * - Which Jockeys rode the winners
 * - Which Trainers trained the winners
 * - $1 Each-Way Par Score & NTD (No Third Dividend) race count
 */
export function buildCardTrackAndMarketAssessment(
  meeting: RaceMeeting,
  evaluatedRaces?: RaceMeeting["races"]
): ReportCardTrackAssessment {
  const allRaces = [...(meeting.races || [])].sort(
    (a, b) => a.raceNumber - b.raceNumber
  );
  const completedRaces = (
    evaluatedRaces && evaluatedRaces.length > 0 ? evaluatedRaces : allRaces
  ).filter(
    (r) =>
      isRaceOfficialOrCompleted(r, meeting.date) &&
      r.runners.some((ru) => ru.finishPosition === 1)
  );
  const targetRaces = completedRaces.length > 0 ? completedRaces : allRaces;

  let totalFieldRunners = 0;
  let standardThreePlaceRacesCount = 0;
  let ntdRacesCount = 0;
  const ntdRaceNumbers: number[] = [];
  let cardParScoreUnits = 0;
  const rawFullCardUnits = allRaces.length * 6;

  for (const r of allRaces) {
    const fSize = (r.runners || []).length;
    totalFieldRunners += fSize;
    const parInfo = computeRaceEachWayParUnits(fSize, 3);
    cardParScoreUnits += parInfo.parUnits;
    if (parInfo.isNtd) {
      ntdRacesCount += 1;
      ntdRaceNumbers.push(r.raceNumber);
    } else {
      standardThreePlaceRacesCount += 1;
    }
  }

  const avgFieldSize =
    allRaces.length > 0
      ? Number((totalFieldRunners / allRaces.length).toFixed(1))
      : 0;

  let favouriteWinsCount = 0;
  let favouritePlacedCount = 0;
  const winningFavouritesList: string[] = [];
  let winningOddsSum = 0;
  let shortestWinner = { text: "—", odds: Infinity };
  let longestWinner = { text: "—", odds: 0 };

  let winningBarrierSum = 0;
  let sprintBarrierSum = 0;
  let sprintCount = 0;
  let stayingBarrierSum = 0;
  let stayingCount = 0;

  const barrierMap = new Map<
    number,
    { barrier: number; wins: number; podiums: number; races: number[] }
  >();
  let inside1To4Wins = 0;
  let inside1To4Podiums = 0;
  let middle5To8Wins = 0;
  let middle5To8Podiums = 0;
  let outside9PlusWins = 0;
  let outside9PlusPodiums = 0;

  const jockeyMap = new Map<
    string,
    {
      name: string;
      wins: number;
      seconds: number;
      thirds: number;
      podiums: number;
      winningRaces: string[];
      winOddsSum: number;
    }
  >();

  const trainerMap = new Map<
    string,
    {
      name: string;
      wins: number;
      seconds: number;
      thirds: number;
      podiums: number;
      winningRaces: string[];
      winOddsSum: number;
    }
  >();

  for (const r of targetRaces) {
    const runners = r.runners || [];
    if (runners.length === 0) continue;

    // Identify market favourite(s) by shortest win odds
    const minOdds = Math.min(
      ...runners.map(
        (ru) => Number(ru.nswTabWin || ru.fixedWin) || 999
      )
    );
    const favRunners = runners.filter(
      (ru) =>
        Math.abs((Number(ru.nswTabWin || ru.fixedWin) || 999) - minOdds) <=
        0.05
    );

    const favWon = favRunners.some((ru) => ru.finishPosition === 1);
    const favPlaced = favRunners.some(
      (ru) => ru.finishPosition >= 1 && ru.finishPosition <= 3
    );

    if (favWon) {
      favouriteWinsCount += 1;
      const wFav = favRunners.find((ru) => ru.finishPosition === 1) || favRunners[0];
      winningFavouritesList.push(
        `R${r.raceNumber} #${wFav.tabNumber} ${wFav.horseName} ($${(
          Number(wFav.nswTabWin || wFav.fixedWin) || minOdds
        ).toFixed(2)})`
      );
    }
    if (favPlaced) {
      favouritePlacedCount += 1;
    }

    const first = runners.find((ru) => ru.finishPosition === 1);
    const second = runners.find((ru) => ru.finishPosition === 2);
    const third = runners.find((ru) => ru.finishPosition === 3);

    if (first) {
      const wOdds = Number(first.nswTabWin || first.fixedWin) || 0;
      winningOddsSum += wOdds;
      const label = `R${r.raceNumber} #${first.tabNumber} ${first.horseName} ($${wOdds.toFixed(2)})`;
      if (wOdds > 0 && wOdds < shortestWinner.odds) {
        shortestWinner = { text: label, odds: wOdds };
      }
      if (wOdds > longestWinner.odds) {
        longestWinner = { text: label, odds: wOdds };
      }

      const b = Math.max(1, Number(first.barrier) || first.tabNumber || 1);
      winningBarrierSum += b;
      if (r.distance <= 1350) {
        sprintBarrierSum += b;
        sprintCount += 1;
      } else {
        stayingBarrierSum += b;
        stayingCount += 1;
      }

      if (b <= 4) inside1To4Wins += 1;
      else if (b <= 8) middle5To8Wins += 1;
      else outside9PlusWins += 1;
    }

    for (const pRunner of [first, second, third].filter(Boolean)) {
      if (!pRunner) continue;
      const b = Math.max(1, Number(pRunner.barrier) || pRunner.tabNumber || 1);
      if (b <= 4) inside1To4Podiums += 1;
      else if (b <= 8) middle5To8Podiums += 1;
      else outside9PlusPodiums += 1;

      const bEntry = barrierMap.get(b) || {
        barrier: b,
        wins: 0,
        podiums: 0,
        races: [],
      };
      bEntry.podiums += 1;
      if (pRunner.finishPosition === 1) {
        bEntry.wins += 1;
        bEntry.races.push(r.raceNumber);
      }
      barrierMap.set(b, bEntry);

      // Jockey tracking
      const jName = (pRunner.jockey || "TBA").trim();
      if (jName && jName !== "TBA") {
        const jEntry = jockeyMap.get(jName) || {
          name: jName,
          wins: 0,
          seconds: 0,
          thirds: 0,
          podiums: 0,
          winningRaces: [],
          winOddsSum: 0,
        };
        jEntry.podiums += 1;
        if (pRunner.finishPosition === 1) {
          jEntry.wins += 1;
          jEntry.winningRaces.push(
            `R${r.raceNumber} #${pRunner.tabNumber} ${pRunner.horseName}`
          );
          jEntry.winOddsSum += Number(pRunner.nswTabWin || pRunner.fixedWin) || 0;
        } else if (pRunner.finishPosition === 2) {
          jEntry.seconds += 1;
        } else if (pRunner.finishPosition === 3) {
          jEntry.thirds += 1;
        }
        jockeyMap.set(jName, jEntry);
      }

      // Trainer tracking
      const tName = (pRunner.trainer || "TBA").trim();
      if (tName && tName !== "TBA") {
        const tEntry = trainerMap.get(tName) || {
          name: tName,
          wins: 0,
          seconds: 0,
          thirds: 0,
          podiums: 0,
          winningRaces: [],
          winOddsSum: 0,
        };
        tEntry.podiums += 1;
        if (pRunner.finishPosition === 1) {
          tEntry.wins += 1;
          tEntry.winningRaces.push(
            `R${r.raceNumber} #${pRunner.tabNumber} ${pRunner.horseName}`
          );
          tEntry.winOddsSum += Number(pRunner.nswTabWin || pRunner.fixedWin) || 0;
        } else if (pRunner.finishPosition === 2) {
          tEntry.seconds += 1;
        } else if (pRunner.finishPosition === 3) {
          tEntry.thirds += 1;
        }
        trainerMap.set(tName, tEntry);
      }
    }
  }

  const denom = Math.max(1, targetRaces.length);
  const favouriteWinRatePct = Math.round((favouriteWinsCount / denom) * 100);
  const favouritePlaceRatePct = Math.round((favouritePlacedCount / denom) * 100);
  const avgWinningOdds = Number((winningOddsSum / denom).toFixed(2));
  const avgWinningBarrier = Number((winningBarrierSum / denom).toFixed(1));

  const inside1To4Pct = Math.round((inside1To4Wins / denom) * 100);
  const middle5To8Pct = Math.round((middle5To8Wins / denom) * 100);
  const outside9PlusPct = Math.max(0, 100 - inside1To4Pct - middle5To8Pct);

  const mostSuccessfulBarriers = Array.from(barrierMap.values())
    .sort((a, b) => b.wins - a.wins || b.podiums - a.podiums || a.barrier - b.barrier)
    .slice(0, 4)
    .map((b) => ({
      barrier: b.barrier,
      wins: b.wins,
      podiums: b.podiums,
      racesText: b.races.length > 0 ? b.races.map((rn) => `R${rn}`).join(", ") : "Placed",
    }));

  const leadingJockeys: ReportCardJockeyTrainerEntry[] = Array.from(
    jockeyMap.values()
  )
    .sort((a, b) => b.wins - a.wins || b.podiums - a.podiums || b.seconds - a.seconds)
    .slice(0, 5)
    .map((j) => ({
      name: j.name,
      wins: j.wins,
      seconds: j.seconds,
      thirds: j.thirds,
      podiums: j.podiums,
      winningRacesText:
        j.winningRaces.length > 0 ? j.winningRaces.join(", ") : "Minor placings",
      avgWinningOdds:
        j.wins > 0 ? Number((j.winOddsSum / j.wins).toFixed(2)) : 0,
    }));

  const leadingTrainers: ReportCardJockeyTrainerEntry[] = Array.from(
    trainerMap.values()
  )
    .sort((a, b) => b.wins - a.wins || b.podiums - a.podiums || b.seconds - a.seconds)
    .slice(0, 5)
    .map((t) => ({
      name: t.name,
      wins: t.wins,
      seconds: t.seconds,
      thirds: t.thirds,
      podiums: t.podiums,
      winningRacesText:
        t.winningRaces.length > 0 ? t.winningRaces.join(", ") : "Minor placings",
      avgWinningOdds:
        t.wins > 0 ? Number((t.winOddsSum / t.wins).toFixed(2)) : 0,
    }));

  const marketBiasVerdict =
    favouriteWinRatePct >= 40
      ? `Favourite-Friendly Track (${favouriteWinsCount}/${targetRaces.length} = ${favouriteWinRatePct}% Fav Wins; ${favouritePlaceRatePct}% Fav Placed; Avg Winner $${avgWinningOdds.toFixed(2)})`
      : favouriteWinRatePct >= 25
      ? `Balanced Market Card (${favouriteWinsCount}/${targetRaces.length} = ${favouriteWinRatePct}% Fav Wins vs 33% Aus Benchmark; Avg Winner $${avgWinningOdds.toFixed(2)})`
      : `Value & Blowout Dominated Card (Only ${favouriteWinsCount}/${targetRaces.length} = ${favouriteWinRatePct}% Fav Wins; Avg Winner $${avgWinningOdds.toFixed(2)}; Longest ${longestWinner.text})`;

  const topBarrier = mostSuccessfulBarriers[0];
  const barrierBiasVerdict =
    inside1To4Pct >= 50
      ? `Inside Rail Bias: ${inside1To4Wins}/${targetRaces.length} (${inside1To4Pct}%) winners jumped from Barriers 1–4 (Avg Winning Gate: ${avgWinningBarrier}${topBarrier ? `; Top Gate: Barrier ${topBarrier.barrier} with ${topBarrier.wins}W` : ""}).`
      : middle5To8Pct >= 45
      ? `Middle-Gate Blending Track: ${middle5To8Wins}/${targetRaces.length} (${middle5To8Pct}%) winners jumped from Barriers 5–8 (Avg Winning Gate: ${avgWinningBarrier}${topBarrier ? `; Top Gate: Barrier ${topBarrier.barrier} with ${topBarrier.wins}W` : ""}).`
      : `Middle-to-Outside Swooper Corridor: Avg Winning Gate ${avgWinningBarrier} (Inside 1–4: ${inside1To4Pct}%, Middle 5–8: ${middle5To8Pct}%, Wide 9+: ${outside9PlusPct}%${topBarrier ? `; Top Gate: Barrier ${topBarrier.barrier} with ${topBarrier.wins}W` : ""}).`;

  const topJockey = leadingJockeys[0];
  const secondJockey = leadingJockeys[1];
  const jockeyAssessmentText = topJockey
    ? `Leading Jockey: ${topJockey.name} rode ${topJockey.wins} winner(s) and ${topJockey.podiums} podium(s) [${topJockey.winningRacesText}]${
        secondJockey
          ? `, followed by ${secondJockey.name} (${secondJockey.wins}W, ${secondJockey.podiums}P).`
          : "."
      }`
    : "Jockey honours were evenly split across the card.";

  const topTrainer = leadingTrainers[0];
  const secondTrainer = leadingTrainers[1];
  const trainerAssessmentText = topTrainer
    ? `Leading Stable: ${topTrainer.name} prepared ${topTrainer.wins} winner(s) and ${topTrainer.podiums} podium(s) [${topTrainer.winningRacesText}]${
        secondTrainer
          ? `, ahead of ${secondTrainer.name} (${secondTrainer.wins}W, ${secondTrainer.podiums}P).`
          : "."
      }`
    : "Training honours were shared across participating stables.";

  const parScoreExplanation =
    ntdRacesCount > 0
      ? `${allRaces.length} races on card (${standardThreePlaceRacesCount} standard 8+ runner races @ 6u + ${ntdRacesCount} NTD ≤7-runner race(s) [R${ntdRaceNumbers.join(", R")}] @ 5u where 3rd pays No Third Dividend) = ${cardParScoreUnits} Units ($${cardParScoreUnits.toFixed(2)}) Par Score.`
      : `${allRaces.length} standard races × 3 horses/race = ${allRaces.length * 3} horses × 2 units ($1 Win + $1 Place Each-Way) = ${cardParScoreUnits} Units ($${cardParScoreUnits.toFixed(2)}) Par Score.`;

  const sprintWinnerAvgBarrier =
    sprintCount > 0 ? Number((sprintBarrierSum / sprintCount).toFixed(1)) : avgWinningBarrier;
  const stayingWinnerAvgBarrier =
    stayingCount > 0 ? Number((stayingBarrierSum / stayingCount).toFixed(1)) : avgWinningBarrier;

  const overallCardProfileSummary = `${meeting.venue} (${allRaces.length}R, Avg Field ${avgFieldSize}): ${marketBiasVerdict}. ${barrierBiasVerdict} ${jockeyAssessmentText} ${trainerAssessmentText}`;

  return {
    venue: meeting.venue,
    raceDate: meeting.date,
    totalRacesOnCard: allRaces.length,
    completedRacesCount: targetRaces.length,
    avgFieldSize,
    standardThreePlaceRacesCount,
    ntdRacesCount,
    ntdRaceNumbers,
    rawFullCardUnits,
    cardParScoreUnits,
    parScoreExplanation,
    favouriteWinsCount,
    favouriteWinRatePct,
    favouritePlacedCount,
    favouritePlaceRatePct,
    winningFavouritesList,
    avgWinningOdds,
    shortestWinnerText: shortestWinner.odds < Infinity ? shortestWinner.text : "—",
    longestWinnerText: longestWinner.odds > 0 ? longestWinner.text : "—",
    marketBiasVerdict,
    avgWinningBarrier,
    mostSuccessfulBarriers,
    barrierZones: {
      inside1To4Wins,
      inside1To4Pct,
      inside1To4Podiums,
      middle5To8Wins,
      middle5To8Pct,
      middle5To8Podiums,
      outside9PlusWins,
      outside9PlusPct,
      outside9PlusPodiums,
    },
    barrierBiasVerdict,
    leadingJockeys,
    jockeyAssessmentText,
    leadingTrainers,
    trainerAssessmentText,
    sprintWinnerAvgBarrier,
    stayingWinnerAvgBarrier,
    overallCardProfileSummary,
  };
}

/**
 * Concise upcoming Sydney & Melbourne major race meets preview based on report date.
 */
export function buildNextMajorMeetsPreview(raceDate: string): NextMajorMeetPreview {
  if (raceDate <= "2026-09-26") {
    return {
      headline: "Next Major Feature Cards: Epsom Handicap (Sydney) & Turnbull Stakes (Melbourne)",
      introHook:
        "Group 1 mile and middle-distance contenders step out across Royal Randwick and Flemington next Saturday.",
      sydneyNextMeet: {
        venue: "Royal Randwick (NSW)",
        dateLabel: "Epsom & Metropolitan Group 1 Day",
        carnivalTitle: "Sydney Everest Carnival — Group 1 Mile & Staying Showdown",
        featureRaces: [
          "G1 TAB Epsom Handicap (1600m · $1.5M)",
          "G1 The Metropolitan (2400m · $750K)",
          "G1 Flight Stakes (1600m · $750K)",
          "G2 Premiere Stakes (1200m · Everest Lead-Up)",
        ],
        stakesHighlight: "$5.2M+ Randwick Stakes",
        hypePitch:
          "High-tempo Randwick mile handicaps historically produce strong Trifecta and Quaddie value.",
      },
      melbourneNextMeet: {
        venue: "Flemington (VIC)",
        dateLabel: "Turnbull Stakes Day",
        carnivalTitle: "Melbourne Spring Carnival — WFA & Cup Qualifiers",
        featureRaces: [
          "G1 Turnbull Stakes (2000m · $750K)",
          "G2 Gilgai Stakes (1200m · $300K)",
          "G2 Edward Manifold Stakes (1600m)",
          "Bart Cummings (2520m · Melbourne Cup Qualifier)",
        ],
        stakesHighlight: "$4.8M+ Flemington Stakes",
        hypePitch:
          "Key Caulfield Cup, Cox Plate, and Melbourne Cup prospects clash over 2000m.",
      },
      closingRallyCry:
        "NEXT MEET FOCUS: Lock in 1st–3rd preferences, 2× Joker nominations, and Quaddie legs ahead of Race 1.",
    };
  }

  if (raceDate <= "2026-10-16") {
    return {
      headline: "Next Feature Cards: $20M The Everest (Randwick) & $5M Caulfield Cup (Melbourne)",
      introHook:
        "Australia's richest turf sprint in Sydney pairs with the world's richest 2400m handicap in Melbourne.",
      sydneyNextMeet: {
        venue: "Royal Randwick (NSW)",
        dateLabel: "Saturday 17 Oct 2026 · The Everest Day",
        carnivalTitle: "$20M The Everest & $5M G1 King Charles III Stakes",
        featureRaces: [
          "The Everest (1200m WFA · $20,000,000)",
          "G1 King Charles III Stakes (1600m WFA · $5,000,000)",
          "The Kosciuszko (1200m · $2,000,000)",
          "G3 Sydney Stakes (1200m · $2,000,000)",
        ],
        stakesHighlight: "$30.5M+ Sydney Card",
        hypePitch:
          "Capacity 12-runner WFA sprint field at Randwick creates prime Boxed Trifecta and Quaddie pools.",
      },
      melbourneNextMeet: {
        venue: "Caulfield (VIC)",
        dateLabel: "Saturday 17 Oct 2026 · Caulfield Cup Finale",
        carnivalTitle: "$5,000,000 Group 1 Caulfield Cup (2400m)",
        featureRaces: [
          "G1 Caulfield Cup (2400m · $5,000,000)",
          "G1 Thousand Guineas (1600m · $1,500,000)",
          "G2 Caulfield Sprint (1000m · $300,000)",
          "G2 Tristarc Stakes (1400m · $300,000)",
        ],
        stakesHighlight: "$8.2M+ Caulfield Card",
        hypePitch:
          "18-runner staying handicap across a high-pressure 2400m tests wide Quaddie and Trifecta combinations.",
      },
      closingRallyCry:
        "NEXT MEET FOCUS: Enter 1st, 2nd & 3rd preferences early and review Combined Trifecta and Quaddie coverage.",
    };
  }

  return {
    headline: "Next Feature Cards: $10M Golden Eagle, Cox Plate & Melbourne Cup Carnival",
    introHook:
      "Championship Group 1 cards headline Rosehill, Moonee Valley, and Flemington Cup Week.",
    sydneyNextMeet: {
      venue: "Rosehill & Randwick (NSW)",
      dateLabel: "Golden Eagle & Five Diamonds",
      carnivalTitle: "$10M Golden Eagle (1500m) & $2M Five Diamonds",
      featureRaces: [
        "The Golden Eagle (1500m 4YO · $10,000,000)",
        "Russell Balding Stakes (1300m · $3,000,000)",
        "The Five Diamonds (1800m 5YO · $2,000,000)",
        "G2 Hot Danish Stakes & Golden Gift",
      ],
      stakesHighlight: "$16M+ Sydney Stakes",
      hypePitch:
        "Large 4YO fields over 1500m offer deep value for multi-runner Trifecta and Quaddie pools.",
    },
    melbourneNextMeet: {
      venue: "Moonee Valley & Flemington (VIC)",
      dateLabel: "Cox Plate & Melbourne Cup Week",
      carnivalTitle: "G1 Cox Plate, Victoria Derby & Melbourne Cup",
      featureRaces: [
        "G1 Cox Plate (2040m WFA · $5,000,000)",
        "G1 Victoria Derby (2500m · $2,000,000) & Coolmore Stud Stakes",
        "G1 Melbourne Cup (3200m · $8,500,000)",
        "G1 Champions Stakes, Sprint & Mile ($3,000,000 each)",
      ],
      stakesHighlight: "$40M+ Melbourne Stakes",
      hypePitch:
        "Deep Group 1 fields across all four legs of the Quaddie deliver the largest exotic pools of the season.",
    },
    closingRallyCry:
      "NEXT MEET FOCUS: Finalise selections, 2× Joker race nominations, and Quaddie savers before jump.",
  };
}

/**
 * Generates a short, punchy, data-driven quantitative race report assessment
 * with explicit commentary on:
 * 1. Leaderboard Standings & $1 Each-Way Par Score (60-unit benchmark adjusted for race count & NTD),
 * 2. Combined Trifecta results,
 * 3. Combined Quaddie results,
 * 4. Users' Tendency to Select Favourites,
 * 5. Race Card Track & Market Assessment (Favourite win rate, Barriers, Jockeys, Trainers).
 */
export function buildTechnicalAndFunnyAssessment(
  venue: string,
  raceDate: string,
  standings: ReportUserStandingRow[],
  raceRows: ReportRaceRow[],
  trifectaSummary: SavedRaceReport["trifectaSummary"],
  trifectaBetAmount: number,
  quaddieSummary?: ReportQuaddieSummary,
  cardTrackAssessment?: ReportCardTrackAssessment
): TechnicalFunnyAssessment {
  const leader = standings[0];
  const runnerUp = standings[1];
  const totalPointsAll = standings.reduce((s, u) => s + u.totalPoints, 0);
  const totalDollarsAll = Number(
    standings.reduce((s, u) => s + u.totalDollarReturn, 0).toFixed(2)
  );
  const totalEachWayAll = Number(
    standings.reduce((s, u) => s + (u.eachWayDollarReturn || 0), 0).toFixed(2)
  );
  const totalParAll = Number(
    standings.reduce((s, u) => s + (u.parScoreUnits || 60), 0).toFixed(2)
  );
  const totalWinnersAll = standings.reduce((s, u) => s + u.winnersPicked, 0);
  const totalPodiumsAll = standings.reduce((s, u) => s + u.podiumsPicked, 0);

  const leaderMarginPts =
    leader && runnerUp ? leader.totalPoints - runnerUp.totalPoints : 0;

  // Punchy, witty headline
  let headline = `${venue} (${raceDate}) — Punters Club Trackside Dispatch & Exotics Autopsy`;
  if (trifectaSummary.trifectaHits > 0 && quaddieSummary?.isWon) {
    headline = `🏆 THE BOOKIES CRY AT ${venue.toUpperCase()}: ${trifectaSummary.trifectaHits} Trifecta(s) Landed + Quaddie In The Bag (${formatDollarReturn(trifectaSummary.totalFlexiReturn + (quaddieSummary.flexiPayout || 0))} Collect)!`;
  } else if (trifectaSummary.trifectaHits > 0) {
    headline = `🎯 TRIFECTA SWEET SPOT AT ${venue.toUpperCase()}: ${trifectaSummary.trifectaHits} Collect(s) (${formatDollarReturn(trifectaSummary.totalFlexiReturn)}) · ${leader?.punterName || "Syndicate"} Leads With ${formatDollarReturn(leader?.eachWayDollarReturn || 0)} EW (${leader?.totalPoints || 0} pts)`;
  } else if (quaddieSummary?.isWon) {
    headline = `🔥 QUADDIE LANDED AT ${venue.toUpperCase()}: 4/4 Legs Crushed (${formatDollarReturn(quaddieSummary.flexiPayout)}) · ${leader?.punterName || "Syndicate"} Tops The Ledger (${leader?.totalPoints || 0} pts)`;
  } else if (leader) {
    headline = `👑 ${leader.punterName.toUpperCase()} TAKES THE CROWN AT ${venue.toUpperCase()}: ${formatDollarReturn(leader.eachWayDollarReturn)} ($1 EW vs ${leader.parScoreUnits}u Par) · ${leader.totalPoints} pts`;
  }

  // 1. Witty, human Trackside Dispatch & $1 Each-Way Par Telemetry
  const jokerUsersHit = standings.filter((u) => u.jokerTriggered);
  const jokerNote =
    jokerUsersHit.length > 0
      ? `🃏 Joker Conjurers: ${jokerUsersHit.map((u) => `${u.punterName} timed their 2× Joker to perfection in R${u.jokerRaceNumber} (+${u.jokerBonusPoints} bonus pts)`).join(" & ")}.`
      : `🃏 Joker Gamble: No 2× Jokers caught fire today — nominations went wide on the home turn.`;

  const ntdNote =
    cardTrackAssessment && cardTrackAssessment.ntdRacesCount > 0
      ? `Card Par adjusted to ${cardTrackAssessment.cardParScoreUnits}u ($${cardTrackAssessment.cardParScoreUnits.toFixed(2)}) across ${cardTrackAssessment.totalRacesOnCard} races (${cardTrackAssessment.ntdRacesCount} NTD field(s) with ≤7 runners [R${cardTrackAssessment.ntdRaceNumbers.join(", R")}])`
      : `Card Par set at ${cardTrackAssessment?.cardParScoreUnits || raceRows.length * 6}u ($${(cardTrackAssessment?.cardParScoreUnits || raceRows.length * 6).toFixed(2)}) across ${raceRows.length} races (3 runners × 2u each-way)`;

  const leaderBattleText = leader && runnerUp
    ? `${leader.punterName} claimed the clubhouse crown with a commanding ${formatDollarReturn(leader.eachWayDollarReturn)} on the $1 Each-Way ledger (${leader.eachWayNetVsPar >= 0 ? "+" : ""}${leader.eachWayNetVsPar.toFixed(2)}u vs ${leader.parScoreUnits}u Par · ${leader.eachWayReturnRatePct}% return rate · ${leader.totalPoints} pts), ${leaderMarginPts === 0 ? "dead-heating on points with" : `holding a spirited +${leaderMarginPts} pt buffer over`} ${runnerUp.punterName} (${formatDollarReturn(runnerUp.eachWayDollarReturn)} EW vs ${runnerUp.parScoreUnits}u Par · ${runnerUp.totalPoints} pts).`
    : "";

  const para1 =
    `TRACKSIDE DISPATCH & THE $1 EW BENCHMARK: The bookies opened shop with confident smirks at ${venue}, but the syndicate arrived armed with formguides, calculators, and sheer audacity across the ${raceRows.length}-race card. Playing the disciplined $1 Each-Way benchmark (${ntdNote}), the syndicate harvested a collective ${formatDollarReturn(totalEachWayAll)} from the bookmakers' satchels vs ${totalParAll}u Par (${formatDollarReturn(totalDollarsAll)} weighted TurfSheet return · ${totalPointsAll} pts · ${totalWinnersAll} winners & ${totalPodiumsAll} podiums landed). ${leaderBattleText} ${jokerNote}`;

  // 2. Lighthearted & Analytical Trifecta Autopsy
  const hitRacesList = raceRows
    .filter((r) => r.trifecta.isHit)
    .map(
      (r) =>
        `R${r.raceNumber} (${r.trifecta.officialCombination}, $1 div $${r.trifecta.officialDividend.toFixed(2)} → ${formatDollarReturn(r.trifecta.flexiReturnOnBet)})`
    );

  const para2 =
    trifectaSummary.trifectaHits > 0
      ? `TRIFECTA AUTOPSY ($${trifectaBetAmount}/Race Syndicate Box): Sweet vindication on the exotics front! The collective brain trust nailed ${trifectaSummary.trifectaHits}/${trifectaSummary.racesEvaluated} Trifectas [${hitRacesList.join("; ")}], extracting ${formatDollarReturn(trifectaSummary.totalFlexiReturn)} in Flexi dividends on ${formatDollarReturn(trifectaSummary.totalOutlay)} staked (Net: ${trifectaSummary.netProfit >= 0 ? "+" : "-"}${formatDollarReturn(Math.abs(trifectaSummary.netProfit))}). We also registered ${trifectaSummary.nearMisses2Of3} gut-wrenching 2-out-of-3 near-misses where the third placegetter got pipped by a flared nostril. When the syndicate combines, bookies sweat!`
      : `TRIFECTA AUTOPSY ($${trifectaBetAmount}/Race Syndicate Box): A spirited battle against the turf variance gods. Zero full clean-sweeps landed from ${trifectaSummary.racesEvaluated} races (${formatDollarReturn(trifectaSummary.totalOutlay)} staked), though ${trifectaSummary.nearMisses2Of3} races produced agonizing 2-out-of-3 podium finishes where an uninvited roughie snuck into third. The combination logic was immaculate; the photo-finish camera was just feeling uncharitable.`;

  // 3. Entertaining & Punchy Quaddie Review
  let para3 = `4-LEG QUADDIE REVIEW: Less than 4 races evaluated on this card.`;
  if (quaddieSummary && quaddieSummary.legs.length > 0) {
    const legBreakdown = quaddieSummary.legs
      .map(
        (l) =>
          `L${l.legIndex} R${l.raceNumber}: ${
            l.isResulted
              ? `${l.winnerText} (${l.isHit ? "✓ HIT" : "✗ MISSED"})`
              : "Upcoming"
          }`
      )
      .join(" · ");

    const buyInTag = `$${quaddieSummary.buyInPerUser || DEFAULT_QUADDIE_BUY_IN_PER_USER}/punter buy-in · $${quaddieSummary.betAmount} pool`;
    if (quaddieSummary.isWon) {
      para3 = `THE 4-LEG QUADDIE MASTERCLASS (${buyInTag} · ${quaddieSummary.totalCombinations} Combos @ ${quaddieSummary.flexiPercentage}%): POP THE BUBBLY! All 4 legs survived the home-straight sweats and photo finishes (${quaddieSummary.combinationString}). Paying an official/estimated $1 dividend of $${quaddieSummary.officialOrEstimatedDividend.toFixed(2)}, our Flexi ticket hauled home ${formatDollarReturn(quaddieSummary.flexiPayout)} (+${formatDollarReturn(quaddieSummary.netProfit)} net profit), putting a glorious ${formatDollarReturn(quaddieSummary.flexiPayoutPerUser || quaddieSummary.flexiPayout / Math.max(1, quaddieSummary.participatingUsersCount || 2))} directly into every syndicate member's back pocket! Leg journey: ${legBreakdown}.`;
    } else {
      para3 = `THE 4-LEG QUADDIE SWEAT (${buyInTag} · ${quaddieSummary.totalCombinations} Combos @ ${quaddieSummary.flexiPercentage}%): High drama in the quadrella trenches. The syndicate navigated ${quaddieSummary.hitLegsCount}/${quaddieSummary.legs.length} legs before the turf gods intervened (${quaddieSummary.combinationString}; $1 Div $${quaddieSummary.officialOrEstimatedDividend.toFixed(2)}). ${quaddieSummary.hitLegsCount >= 3 ? "Cruising into the final leg with alive tickets before a sneaky outsider broke our hearts." : "Early leg speed scrambles kept the loot locked safely in the TAB vault for next time."} Leg breakdown: ${legBreakdown}.`;
    }
  }

  // 4. Witty Favourite Tendency & Market Psychology
  const favTendencyParts = standings.map(
    (u) =>
      `${u.punterName} [${u.favouriteTendencyLabel}: backed favourite in ${u.favouritesSelectedCount}/${u.racesParticipated} races (${u.favouriteSelectionRatePct}%), 1st-Pref Fav ${u.favouriteFirstPrefCount}×, Top-3 Market Share ${u.top3MarketSharePct}%, Avg Selection Odds $${u.avgSelectedRunnerOdds.toFixed(2)}]`
  );
  const para4 = `MARKET PSYCHOLOGY & THE FAVOURITE TENDENCY: ${favTendencyParts.join(" · ")}. Some members clung to the warm safety blanket of short-priced market elects, while our bold adventurers went bushwalking in search of juicy double-figure roughies!`;

  // 5. Track Bias, Barrier, Jockey & Trainer Intelligence
  const para5 = cardTrackAssessment
    ? `TRACK BIAS & JOCKEY RECONNAISSANCE (${venue}): Market favouritessaluted in ${cardTrackAssessment.favouriteWinsCount}/${cardTrackAssessment.completedRacesCount} races (${cardTrackAssessment.favouriteWinRatePct}%) and placed in ${cardTrackAssessment.favouritePlacedCount}/${cardTrackAssessment.completedRacesCount} (${cardTrackAssessment.favouritePlaceRatePct}%), with the average winner paying $${cardTrackAssessment.avgWinningOdds.toFixed(2)}. ${cardTrackAssessment.barrierBiasVerdict} ${cardTrackAssessment.jockeyAssessmentText} ${cardTrackAssessment.trainerAssessmentText}`
    : "";

  const upfrontParagraphs = [para1, para2, para3, para4, para5].filter(Boolean);
  const executiveSummary = para1;

  // Witty, human Punter Roasts & Praises with personality awards
  const punterRoastsAndPraises = standings.map((u, idx) => {
    const jokerStatus =
      u.jokerRaceNumber !== null
        ? u.jokerTriggered
          ? `🃏 Joker R${u.jokerRaceNumber} HIT (+${u.jokerBonusPoints} pts)! Pure timing wizardry.`
          : `🃏 Joker R${u.jokerRaceNumber} missed — got caught in trackside traffic.`
        : `No Joker nominated.`;

    let badge = "📊 Trackside Operator";
    let roastPraise = "";

    if (idx === 0) {
      badge = "👑 The Trackside Maestro";
      roastPraise = `Put on an absolute masterclass! Walked away as the card's undisputed #1 with ${formatDollarReturn(u.eachWayDollarReturn)} on the $1 EW model (${u.eachWayNetVsPar >= 0 ? "+" : ""}${u.eachWayNetVsPar.toFixed(2)}u vs ${u.parScoreUnits}u Par, ${u.eachWayReturnRatePct}% return rate · ${u.totalPoints} pts). Landed ${u.winnersPicked} winners and ${u.podiumsPicked} podiums (${u.strikeRatePct}% strike rate). Favorite appetite: ${u.favouriteSelectionRatePct}% (avg odds $${u.avgSelectedRunnerOdds.toFixed(2)}). The stewards had no inquiries into sheer tactical genius! ${jokerStatus}`;
    } else if (u.eachWayNetVsPar >= 0) {
      badge = "💰 The Bankroll Expander";
      roastPraise = `Disciplined, lethal, and profitable! Cleared Par with a crisp ${formatDollarReturn(u.eachWayDollarReturn)} EW return (+${u.eachWayNetVsPar.toFixed(2)}u above the ${u.parScoreUnits}u benchmark · ${u.eachWayReturnRatePct}% return rate · ${u.totalPoints} pts). Struck with ${u.winnersPicked} winners and ${u.podiumsPicked} placegetters (${u.strikeRatePct}% SR, avg odds $${u.avgSelectedRunnerOdds.toFixed(2)}). Handled the bookmakers like a seasoned pro. ${jokerStatus}`;
    } else if (u.strikeRatePct >= 35) {
      badge = "🎯 The Formguide Sniper";
      roastPraise = `Sharp eye for the podium! Generated a rock-solid ${u.strikeRatePct}% strike rate with ${u.podiumsPicked} podiums across ${u.racesParticipated} races (${u.winnersPicked} winners · ${u.totalPoints} pts · ${formatDollarReturn(u.eachWayDollarReturn)} EW). Kept the ledger ticking over with an average ticket price of $${u.avgSelectedRunnerOdds.toFixed(2)}. ${jokerStatus}`;
    } else if (u.favouriteSelectionRatePct >= 60) {
      badge = "🛡️ The Chalk-Eater Supreme";
      roastPraise = `Safety first! Trusted the market favourites in ${u.favouritesSelectedCount}/${u.racesParticipated} races (${u.favouriteSelectionRatePct}% Fav rate · avg odds $${u.avgSelectedRunnerOdds.toFixed(2)}). Collected ${formatDollarReturn(u.eachWayDollarReturn)} EW vs ${u.parScoreUnits}u Par (${u.totalPoints} pts · ${u.winnersPicked}W/${u.podiumsPicked}P). A few more bold roughies and the bookies would have been waving white flags. ${jokerStatus}`;
    } else if (u.avgSelectedRunnerOdds >= 8.0) {
      badge = "🤠 The Roughie Archaeologist";
      roastPraise = `Hunting the big game in the deep bush! Averaged a daring $${u.avgSelectedRunnerOdds.toFixed(2)} across all selections, seeking that one seismic dividend. Finished with ${formatDollarReturn(u.eachWayDollarReturn)} EW (${u.totalPoints} pts · ${u.winnersPicked}W/${u.podiumsPicked}P). When those double-figure roughies drop, they'll be erecting statues in your honor. ${jokerStatus}`;
    } else {
      badge = "⚡ The Tenacious Battler";
      roastPraise = `Fought hard through every turn of the card. Recorded ${formatDollarReturn(u.eachWayDollarReturn)} on the $1 EW ledger vs ${u.parScoreUnits}u Par (${u.eachWayReturnRatePct}% return rate · ${u.totalPoints} pts · ${u.winnersPicked}W/${u.podiumsPicked}P). With an average runner price of $${u.avgSelectedRunnerOdds.toFixed(2)}, wallet CPR was administered in the straight, but the fighting spirit remains primed for the next meeting. ${jokerStatus}`;
    }

    return {
      punterName: u.punterName,
      badge,
      commentary: roastPraise,
    };
  });

  const trifectaVerdict = para2;
  const quaddieVerdict = para3;

  const totalExoticNet =
    trifectaSummary.netProfit + (quaddieSummary?.netProfit || 0);
  const stewardsFunnyConclusion =
    `CHIEF STEWARD'S OFFICIAL BANTER RULING: Following an exhaustive post-race inquiry at ${venue}, the stewards confirmed that ${leader?.punterName || "the syndicate"} displayed exemplary turfcraft with ${formatDollarReturn(leader?.eachWayDollarReturn || 0)} on the $1 Each-Way Par model (${leader?.totalPoints || 0} pts). Exotics concluded with ${trifectaSummary.trifectaHits}/${trifectaSummary.racesEvaluated} Trifecta hits (${trifectaSummary.nearMisses2Of3} near-misses) and ${quaddieSummary?.hitLegsCount ?? 0}/${quaddieSummary?.legs.length ?? 4} Quaddie legs survived (${totalExoticNet >= 0 ? "+" : "-"}${formatDollarReturn(Math.abs(totalExoticNet))} net exotics). All punters are cleared of foul play and ordered to enjoy an ice-cold beverage at the bar!`;

  const nextMajorMeetsPreview = buildNextMajorMeetsPreview(raceDate);

  return {
    headline,
    upfrontParagraphs,
    executiveSummary,
    punterRoastsAndPraises,
    trifectaVerdict,
    quaddieVerdict,
    favouriteTendencyVerdict: para4,
    cardTrackVerdict: para5,
    stewardsFunnyConclusion,
    nextMajorMeetsPreview,
  };
}

/**
 * Builds a SavedRaceReport for a meeting including Leaderboard, $1 Each-Way Par Score telemetry,
 * User Favourite Selection Tendency, Card Track/Barrier/Jockey/Trainer Assessment,
 * Race-by-Race matrix, Combined Trifecta telemetry, and Combined 4-Leg Quaddie evaluation.
 */
export function buildRaceReportForMeeting(
  meeting: RaceMeeting,
  punters: PunterProfile[],
  trifectaBetAmount: number = 20,
  options?: {
    isRetroactive?: boolean;
    customCreatedAtIso?: string;
    existingReport?: SavedRaceReport;
    forceGenerateForMeeting?: boolean;
    quaddieExtraByRace?: Record<number, number[]>;
    quaddieBuyInPerUser?: number;
    quaddieBetAmount?: number;
  }
): SavedRaceReport | null {
  const completedRaces = meeting.races.filter((r) =>
    isRaceOfficialOrCompleted(r, meeting.date)
  );
  if (completedRaces.length === 0 && !options?.forceGenerateForMeeting) {
    return null;
  }

  const candidateRaces =
    completedRaces.length > 0 ? completedRaces : meeting.races;

  let participatedCompletedRaces = candidateRaces.filter((race) =>
    punters.some((p) => {
      const mSel = getPunterSelectionsForMeeting(p, meeting);
      const t = mSel[race.raceNumber];
      return (
        t &&
        (t.firstPref !== null ||
          t.secondPref !== null ||
          t.thirdPref !== null)
      );
    })
  );

  let effectivePunters = punters;
  if (
    participatedCompletedRaces.length === 0 &&
    options?.forceGenerateForMeeting
  ) {
    participatedCompletedRaces = candidateRaces;
    effectivePunters = punters.map((p, pIdx) => {
      const existingMap = p.selectionsByMeeting[meeting.id] || {};
      const hasAny = Object.values(existingMap).some(
        (t) =>
          t &&
          (t.firstPref !== null ||
            t.secondPref !== null ||
            t.thirdPref !== null)
      );
      if (hasAny) return p;

      const fallbackMap: Record<
        number,
        { firstPref: number; secondPref: number; thirdPref: number }
      > = {};
      for (const r of participatedCompletedRaces) {
        const sortedByOdds = [...r.runners].sort(
          (a, b) => (a.nswTabWin || 99) - (b.nswTabWin || 99)
        );
        const shift =
          (r.raceNumber + pIdx * 2) %
          Math.max(1, Math.min(5, sortedByOdds.length));
        fallbackMap[r.raceNumber] = {
          firstPref: sortedByOdds[shift % sortedByOdds.length]?.tabNumber ?? 1,
          secondPref:
            sortedByOdds[(shift + 1) % sortedByOdds.length]?.tabNumber ?? 2,
          thirdPref:
            sortedByOdds[(shift + 2) % sortedByOdds.length]?.tabNumber ?? 3,
        };
      }
      return {
        ...p,
        selectionsByMeeting: {
          ...p.selectionsByMeeting,
          [meeting.id]: fallbackMap,
        },
        jokerRaceByMeeting: {
          ...(p.jokerRaceByMeeting || {}),
          [meeting.id]:
            p.jokerRaceByMeeting?.[meeting.id] ??
            getFeatureRaceNumberForMeeting(meeting),
        },
      };
    });
  }

  if (participatedCompletedRaces.length === 0) {
    return null;
  }

  // Build Card Track, Favourite, Barrier, Jockey & Trainer Assessment
  const cardTrackAssessment = buildCardTrackAndMarketAssessment(
    meeting,
    participatedCompletedRaces
  );

  const participatingUsersSet = new Set<string>();
  const rawStandings = effectivePunters.map((punter) => {
    const mSel = getPunterSelectionsForMeeting(punter, meeting);
    const jokerRaceNumber = getPunterJokerForMeeting(punter, meeting);

    let racesParticipated = 0;
    let selectedHorsesCount = 0;
    let parScoreUnits = 0;
    let eachWayDollarReturn = 0;
    let winnersPicked = 0;
    let podiumsPicked = 0;
    let firstPrefHits = 0;
    let secondPrefHits = 0;
    let thirdPrefHits = 0;
    let jokerTriggered = false;
    let jokerBonusPoints = 0;
    let totalPoints = 0;
    let totalDollarReturn = 0;

    // Favourite tendency counters
    let favouritesSelectedCount = 0;
    let favouriteFirstPrefCount = 0;
    let top3MarketPicksCount = 0;
    let valueLongshotPicksCount = 0;
    let selectedOddsSum = 0;
    let selectedOddsCount = 0;
    let favouriteHitsCount = 0;

    for (const race of participatedCompletedRaces) {
      const isJoker = jokerRaceNumber === race.raceNumber;
      const ev = evaluateRaceTrio(
        race,
        mSel[race.raceNumber],
        meeting.date,
        isJoker
      );
      if (ev.hasAnySelection) {
        racesParticipated += 1;
        participatingUsersSet.add(punter.name);
        totalPoints += ev.racePointsTally;
        totalDollarReturn = Number(
          (totalDollarReturn + ev.raceDollarReturn).toFixed(2)
        );
        if (ev.jokerTriggered) {
          jokerTriggered = true;
          jokerBonusPoints += ev.jokerBonusPoints;
        }

        // Determine market ranks for this race
        const runnersSortedByOdds = [...(race.runners || [])].sort(
          (a, b) =>
            (Number(a.nswTabWin || a.fixedWin) || 999) -
            (Number(b.nswTabWin || b.fixedWin) || 999)
        );
        const minOdds =
          Number(
            runnersSortedByOdds[0]?.nswTabWin ||
              runnersSortedByOdds[0]?.fixedWin
          ) || 999;
        const favTabs = new Set(
          (race.runners || [])
            .filter(
              (ru) =>
                Math.abs(
                  (Number(ru.nswTabWin || ru.fixedWin) || 999) - minOdds
                ) <= 0.05
            )
            .map((ru) => ru.tabNumber)
        );
        const top3Tabs = new Set(
          runnersSortedByOdds.slice(0, 3).map((ru) => ru.tabNumber)
        );

        const validPicksInRace = ev.picks.filter((p) => p.tabNumber !== null);
        const horsesInRace = validPicksInRace.length;
        selectedHorsesCount += horsesInRace;

        const fieldSize = (race.runners || []).length;
        const raceParInfo = computeRaceEachWayParUnits(fieldSize, horsesInRace);
        parScoreUnits += raceParInfo.parUnits;

        let pickedFavInThisRace = false;

        for (const p of ev.picks) {
          if (p.tabNumber !== null) {
            const winOdds =
              Number(p.runner?.nswTabWin || p.runner?.fixedWin) || 0;
            const placeOdds =
              Number(p.runner?.nswTabPlace || p.runner?.fixedPlace) ||
              (winOdds > 1 ? Number((1 + (winOdds - 1) / 3.5).toFixed(2)) : 0);

            if (winOdds > 0) {
              selectedOddsSum += winOdds;
              selectedOddsCount += 1;
              if (winOdds >= 10) {
                valueLongshotPicksCount += 1;
              }
            }

            if (favTabs.has(p.tabNumber)) {
              pickedFavInThisRace = true;
              if (p.preferenceRank === 1) {
                favouriteFirstPrefCount += 1;
              }
              if (p.finishPosition >= 1 && p.finishPosition <= 3) {
                favouriteHitsCount += 1;
              }
            }
            if (top3Tabs.has(p.tabNumber)) {
              top3MarketPicksCount += 1;
            }

            // $1 Each-Way Return calculation ($1 Win + $1 Place per selected horse)
            // Respects NTD (No Third Dividend) on <=7 runner races and Win-only on <=4 runner races
            if (p.finishPosition === 1) {
              winnersPicked += 1;
              const ewWinCollect = winOdds;
              const ewPlaceCollect = fieldSize >= 5 ? placeOdds : 0;
              eachWayDollarReturn = Number(
                (eachWayDollarReturn + ewWinCollect + ewPlaceCollect).toFixed(2)
              );
            } else if (p.finishPosition === 2) {
              const ewPlaceCollect = fieldSize >= 5 ? placeOdds : 0;
              eachWayDollarReturn = Number(
                (eachWayDollarReturn + ewPlaceCollect).toFixed(2)
              );
            } else if (p.finishPosition === 3) {
              // NTD: 3rd place pays $0.00 when fieldSize <= 7
              const ewPlaceCollect = fieldSize >= 8 ? placeOdds : 0;
              eachWayDollarReturn = Number(
                (eachWayDollarReturn + ewPlaceCollect).toFixed(2)
              );
            }

            if (p.finishPosition >= 1 && p.finishPosition <= 3) {
              podiumsPicked += 1;
              if (p.preferenceRank === 1) firstPrefHits += 1;
              if (p.preferenceRank === 2) secondPrefHits += 1;
              if (p.preferenceRank === 3) thirdPrefHits += 1;
            }
          }
        }

        if (pickedFavInThisRace) {
          favouritesSelectedCount += 1;
        }
      }
    }

    const rawEachWayUnitsOutlay = selectedHorsesCount * 2;
    const effectiveParUnits =
      parScoreUnits > 0 ? parScoreUnits : cardTrackAssessment.cardParScoreUnits;
    const eachWayNetVsPar = Number(
      (eachWayDollarReturn - effectiveParUnits).toFixed(2)
    );
    const eachWayReturnRatePct =
      effectiveParUnits > 0
        ? Math.round((eachWayDollarReturn / effectiveParUnits) * 100)
        : 0;

    const strikeRatePct =
      racesParticipated > 0
        ? Math.round((podiumsPicked / (racesParticipated * 3)) * 100)
        : 0;
    const winStrikeRatePct =
      racesParticipated > 0
        ? Math.round((winnersPicked / racesParticipated) * 100)
        : 0;
    const avgPtsPerRace =
      racesParticipated > 0
        ? Number((totalPoints / racesParticipated).toFixed(1))
        : 0;

    const favouriteSelectionRatePct =
      racesParticipated > 0
        ? Math.round((favouritesSelectedCount / racesParticipated) * 100)
        : 0;
    const top3MarketSharePct =
      selectedHorsesCount > 0
        ? Math.round((top3MarketPicksCount / selectedHorsesCount) * 100)
        : 0;
    const avgSelectedRunnerOdds =
      selectedOddsCount > 0
        ? Number((selectedOddsSum / selectedOddsCount).toFixed(2))
        : 0;

    const favouriteTendencyLabel =
      favouriteSelectionRatePct >= 65 ||
      (avgSelectedRunnerOdds > 0 && avgSelectedRunnerOdds <= 4.8)
        ? "Market Chalk Hunter"
        : favouriteSelectionRatePct >= 40 ||
          (avgSelectedRunnerOdds > 0 && avgSelectedRunnerOdds <= 7.8)
        ? "Balanced Market & Value"
        : "Value & Roughie Speculator";

    const favouriteTendencyAssessment = `${punter.name} included the race favourite in ${favouritesSelectedCount} of ${racesParticipated} races (${favouriteSelectionRatePct}% Fav inclusion; ${favouriteFirstPrefCount}× as 1st Preference; ${favouriteHitsCount} Fav podiums), with ${top3MarketSharePct}% of picks from the top 3 in betting and an average selection price of $${avgSelectedRunnerOdds.toFixed(2)} (${valueLongshotPicksCount} roughies at $10+).`;

    return {
      punterId: punter.id,
      punterName: punter.name,
      role: punter.role,
      rank: 1,
      racesParticipated,
      selectedHorsesCount,
      rawEachWayUnitsOutlay,
      parScoreUnits: effectiveParUnits,
      fullCardParScoreUnits: cardTrackAssessment.cardParScoreUnits,
      eachWayDollarReturn,
      eachWayNetVsPar,
      eachWayReturnRatePct,
      winnersPicked,
      podiumsPicked,
      firstPrefHits,
      secondPrefHits,
      thirdPrefHits,
      jokerRaceNumber,
      jokerTriggered,
      jokerBonusPoints,
      totalPoints,
      totalDollarReturn,
      strikeRatePct,
      winStrikeRatePct,
      avgPtsPerRace,
      favouritesSelectedCount,
      favouriteFirstPrefCount,
      favouriteSelectionRatePct,
      top3MarketPicksCount,
      top3MarketSharePct,
      valueLongshotPicksCount,
      avgSelectedRunnerOdds,
      favouriteHitsCount,
      favouriteTendencyLabel,
      favouriteTendencyAssessment,
    };
  });

  // Sort standings primarily by $1 Each-Way Return / Total Dollar Return and Points
  const sortedStandings = [...rawStandings]
    .sort(
      (a, b) =>
        b.eachWayDollarReturn - a.eachWayDollarReturn ||
        b.totalDollarReturn - a.totalDollarReturn ||
        b.totalPoints - a.totalPoints
    )
    .map((row, idx) => ({ ...row, rank: idx + 1 }));

  let trifectaHits = 0;
  let nearMisses2Of3 = 0;
  let totalOutlay = 0;
  let totalFlexiReturn = 0;
  let totalCapturedUnitDividends = 0;

  let highestSingleRaceCollect = {
    raceNumber: 1,
    punterName: sortedStandings[0]?.punterName || "Syndicate",
    dollarReturn: 0,
    points: 0,
  };

  let winningOddsSum = 0;
  let winningOddsCount = 0;

  const raceRows: ReportRaceRow[] = participatedCompletedRaces.map((race) => {
    const first = race.runners.find((r) => r.finishPosition === 1);
    const second = race.runners.find((r) => r.finishPosition === 2);
    const third = race.runners.find((r) => r.finishPosition === 3);

    const fieldSize = (race.runners || []).length;
    const raceParInfo = computeRaceEachWayParUnits(fieldSize, 3);

    // Identify race favourite
    const minOdds = Math.min(
      ...(race.runners || []).map(
        (ru) => Number(ru.nswTabWin || ru.fixedWin) || 999
      )
    );
    const favRunner =
      (race.runners || []).find(
        (ru) =>
          Math.abs((Number(ru.nswTabWin || ru.fixedWin) || 999) - minOdds) <=
          0.05
      ) || null;
    const didFavouriteWin = Boolean(
      favRunner && first && favRunner.tabNumber === first.tabNumber
    );

    if (first?.nswTabWin) {
      winningOddsSum += Number(first.nswTabWin);
      winningOddsCount += 1;
    }

    const userCells = effectivePunters.map((punter) => {
      const mSel = getPunterSelectionsForMeeting(punter, meeting);
      const jokerRaceNo = getPunterJokerForMeeting(punter, meeting);
      const isJokerRace = jokerRaceNo === race.raceNumber;
      const ev = evaluateRaceTrio(
        race,
        mSel[race.raceNumber],
        meeting.date,
        isJokerRace
      );

      let eachWayRaceReturn = 0;
      let pickedFavourite = false;
      const validCount = ev.picks.filter((p) => p.tabNumber !== null).length;
      const uParInfo = computeRaceEachWayParUnits(fieldSize, validCount);

      for (const p of ev.picks) {
        if (p.tabNumber === null) continue;
        if (favRunner && p.tabNumber === favRunner.tabNumber) {
          pickedFavourite = true;
        }
        const wOdds = Number(p.runner?.nswTabWin || p.runner?.fixedWin) || 0;
        const pOdds =
          Number(p.runner?.nswTabPlace || p.runner?.fixedPlace) ||
          (wOdds > 1 ? Number((1 + (wOdds - 1) / 3.5).toFixed(2)) : 0);

        if (p.finishPosition === 1) {
          eachWayRaceReturn = Number(
            (eachWayRaceReturn + wOdds + (fieldSize >= 5 ? pOdds : 0)).toFixed(2)
          );
        } else if (p.finishPosition === 2) {
          eachWayRaceReturn = Number(
            (eachWayRaceReturn + (fieldSize >= 5 ? pOdds : 0)).toFixed(2)
          );
        } else if (p.finishPosition === 3) {
          eachWayRaceReturn = Number(
            (eachWayRaceReturn + (fieldSize >= 8 ? pOdds : 0)).toFixed(2)
          );
        }
      }

      if (ev.raceDollarReturn > highestSingleRaceCollect.dollarReturn) {
        highestSingleRaceCollect = {
          raceNumber: race.raceNumber,
          punterName: punter.name,
          dollarReturn: ev.raceDollarReturn,
          points: ev.racePointsTally,
        };
      }

      const picksText = ev.picks
        .map((p) =>
          p.tabNumber !== null
            ? `${p.preferenceRank === 1 ? "1st" : p.preferenceRank === 2 ? "2nd" : "3rd"}: #${p.tabNumber} ${p.runner?.horseName || ""}`
            : null
        )
        .filter(Boolean)
        .join(" · ");

      const hitsText = ev.picks
        .filter((p) => p.points > 0 && p.runner)
        .map(
          (p) =>
            `#${p.tabNumber} (${
              p.finishPosition === 1
                ? "1st"
                : p.finishPosition === 2
                ? "2nd"
                : "3rd"
            }${p.finishPosition === 3 && raceParInfo.isNtd ? " NTD" : ""})`
        )
        .join(", ");

      return {
        punterId: punter.id,
        punterName: punter.name,
        hasParticipated: ev.hasAnySelection,
        picksSummary: picksText || "No selection",
        hitSummary: hitsText || "Unplaced",
        isJokerRace,
        jokerTriggered: ev.jokerTriggered,
        points: ev.racePointsTally,
        dollarReturn: ev.raceDollarReturn,
        eachWayRaceReturn,
        raceParUnits: uParInfo.parUnits,
        pickedFavourite,
      };
    });

    const triEval = evaluateCombinedTrifectaForRace(
      race,
      effectivePunters,
      meeting.id,
      meeting.date,
      trifectaBetAmount,
      meeting.venue
    );

    if (triEval.combinedRunners.length >= 3) {
      totalOutlay = Number(
        (totalOutlay + (triEval.trifectaBetAmount || trifectaBetAmount)).toFixed(
          2
        )
      );
    }
    if (triEval.isCombinedBoxedTrifectaHit) {
      trifectaHits += 1;
      totalFlexiReturn = Number(
        (totalFlexiReturn + triEval.customBetFlexiReturn).toFixed(2)
      );
      totalCapturedUnitDividends = Number(
        (
          totalCapturedUnitDividends + triEval.bookmakerTrifectaDividend
        ).toFixed(2)
      );
    } else if (triEval.podiumHitFlags.hitCount === 2) {
      nearMisses2Of3 += 1;
    }

    return {
      raceNumber: race.raceNumber,
      raceName: race.raceName,
      startTime: race.startTime,
      distance: race.distance,
      classGrade: race.classGrade,
      fieldSize,
      isNtdRace: raceParInfo.isNtd,
      raceParUnits: raceParInfo.parUnits,
      favouriteRunnerText: favRunner
        ? `#${favRunner.tabNumber} ${favRunner.horseName} ($${minOdds.toFixed(2)})`
        : "—",
      didFavouriteWin,
      winningBarrier: first?.barrier || first?.tabNumber || 1,
      winningJockey: first?.jockey || "TBA",
      winningTrainer: first?.trainer || "TBA",
      podium: {
        first: first ? `#${first.tabNumber} ${first.horseName}` : "TBA",
        second: second ? `#${second.tabNumber} ${second.horseName}` : "TBA",
        third: third ? `#${third.tabNumber} ${third.horseName}` : "TBA",
        firstWinOdds: Number(first?.nswTabWin) || 0,
      },
      userCells,
      trifecta: {
        poolRunnersText: triEval.combinedRunners
          .map((c) => `#${c.tabNumber} ${c.runner?.horseName || ""}`)
          .join(", "),
        poolCount: triEval.combinedRunners.length,
        boxedCombinations: triEval.boxedCombinationsCount,
        officialCombination: triEval.officialTrifectaCombination,
        officialDividend: triEval.bookmakerTrifectaDividend,
        isHit: triEval.isCombinedBoxedTrifectaHit,
        hitCount: triEval.podiumHitFlags.hitCount,
        betAmount: trifectaBetAmount,
        flexiReturnOnBet: triEval.isCombinedBoxedTrifectaHit
          ? triEval.customBetFlexiReturn
          : 0,
      },
    };
  });

  const trifectaSummary = {
    racesEvaluated: participatedCompletedRaces.length,
    trifectaHits,
    nearMisses2Of3,
    totalOutlay,
    totalFlexiReturn,
    netProfit: Number((totalFlexiReturn - totalOutlay).toFixed(2)),
    totalCapturedUnitDividends,
  };

  // Evaluate Combined 4-Leg Quaddie for this meeting (defaults to $50 buy-in per user)
  const resolvedQuaddieBuyInPerUser =
    options?.quaddieBuyInPerUser && options.quaddieBuyInPerUser > 0
      ? options.quaddieBuyInPerUser
      : DEFAULT_QUADDIE_BUY_IN_PER_USER;

  const qEval = evaluateCombinedQuaddieForMeeting(
    meeting,
    effectivePunters,
    options?.quaddieExtraByRace || {},
    resolvedQuaddieBuyInPerUser
  );

  const quaddieSummary: ReportQuaddieSummary = {
    buyInPerUser: qEval.buyInPerUser,
    participatingUsersCount: qEval.participatingUsersCount,
    betAmount: qEval.quaddieBetAmount,
    totalCombinations: qEval.totalCombinations,
    flexiPercentage: qEval.flexiPercentage,
    completedLegsCount: qEval.completedLegsCount,
    hitLegsCount: qEval.hitLegsCount,
    isAlive: qEval.isQuaddieAlive,
    isWon: qEval.isQuaddieWon,
    combinationString: qEval.quaddieCombinationString,
    officialOrEstimatedDividend: qEval.officialOrEstimatedQuaddieDividend,
    isOfficialDividend: qEval.isOfficialDividend,
    flexiPayout: qEval.isQuaddieWon ? qEval.flexiPayoutOnBetAmount : 0,
    flexiPayoutPerUser: qEval.isQuaddieWon ? qEval.flexiPayoutPerUser : 0,
    netProfit: qEval.netProfitOnBet,
    netProfitPerUser: qEval.netProfitPerUser,
    declaredQuaddieLabel: qEval.declaredQuaddieVerification.quaddieLabel,
    verificationSource: qEval.declaredQuaddieVerification.verificationSource,
    legs: qEval.legs.map((leg) => {
      const fieldSize = Math.max(1, leg.race.runners.length);
      return {
        legIndex: leg.legIndex,
        raceNumber: leg.raceNumber,
        raceName: leg.race.raceName,
        isResulted: leg.isRaceResulted,
        winnerText: leg.winner
          ? `#${leg.winner.tabNumber} ${leg.winner.horseName}`
          : "Pending",
        winnerOdds: Number(leg.winner?.nswTabWin) || 0,
        runnerCount: leg.allLegRunners.length,
        runnersText: leg.allLegRunners
          .map(
            (r) =>
              `#${r.tabNumber}${
                r.isQuaddieExtra && r.source === "extra" ? "+" : ""
              }`
          )
          .join(", "),
        fieldSize,
        fieldCoveragePct: Math.round(
          (leg.allLegRunners.length / fieldSize) * 100
        ),
        isHit: leg.isLegHit,
        winningSource: leg.winningRunnerSource,
      };
    }),
  };

  const syndicateTotalPoints = sortedStandings.reduce(
    (s, u) => s + u.totalPoints,
    0
  );
  const syndicateTotalCashReturn = Number(
    sortedStandings.reduce((s, u) => s + u.totalDollarReturn, 0).toFixed(2)
  );
  const syndicateEachWayTotalReturn = Number(
    sortedStandings.reduce((s, u) => s + u.eachWayDollarReturn, 0).toFixed(2)
  );
  const syndicateEachWayParUnits = Number(
    sortedStandings.reduce((s, u) => s + u.parScoreUnits, 0).toFixed(2)
  );
  const syndicateEachWayReturnRatePct =
    syndicateEachWayParUnits > 0
      ? Math.round(
          (syndicateEachWayTotalReturn / syndicateEachWayParUnits) * 100
        )
      : 0;

  const totalPicksMade = sortedStandings.reduce(
    (s, u) => s + u.selectedHorsesCount,
    0
  );
  const totalPodiumsAll = sortedStandings.reduce(
    (s, u) => s + u.podiumsPicked,
    0
  );
  const totalWinnersAll = sortedStandings.reduce(
    (s, u) => s + u.winnersPicked,
    0
  );
  const totalUserRaces = sortedStandings.reduce(
    (s, u) => s + u.racesParticipated,
    0
  );

  const bestTriRow =
    [...raceRows].sort(
      (a, b) =>
        b.trifecta.flexiReturnOnBet - a.trifecta.flexiReturnOnBet ||
        b.trifecta.hitCount - a.trifecta.hitCount ||
        b.trifecta.officialDividend - a.trifecta.officialDividend
    )[0] || null;

  const combinedExoticsOutlay = Number(
    (
      trifectaSummary.totalOutlay +
      (quaddieSummary.totalCombinations > 0 ? quaddieSummary.betAmount : 0)
    ).toFixed(2)
  );
  const combinedExoticsReturn = Number(
    (trifectaSummary.totalFlexiReturn + quaddieSummary.flexiPayout).toFixed(2)
  );
  const combinedExoticsNetProfit = Number(
    (combinedExoticsReturn - combinedExoticsOutlay).toFixed(2)
  );
  const combinedExoticsRoiPct =
    combinedExoticsOutlay > 0
      ? Math.round((combinedExoticsReturn / combinedExoticsOutlay) * 100)
      : 0;

  const analytics: ReportAnalyticsMetrics = {
    syndicateTotalPoints,
    syndicateTotalCashReturn,
    syndicateEachWayTotalReturn,
    syndicateEachWayParUnits,
    syndicateEachWayReturnRatePct,
    syndicateWinPlaceOutlay: syndicateEachWayParUnits,
    syndicateStrikeRatePct:
      totalPicksMade > 0
        ? Math.round((totalPodiumsAll / totalPicksMade) * 100)
        : 0,
    syndicateWinRatePct:
      totalUserRaces > 0
        ? Math.round((totalWinnersAll / totalUserRaces) * 100)
        : 0,
    avgWinningRunnerOdds:
      winningOddsCount > 0
        ? Number((winningOddsSum / winningOddsCount).toFixed(2))
        : 0,
    highestSingleRaceCollect,
    bestTrifectaRace: bestTriRow
      ? {
          raceNumber: bestTriRow.raceNumber,
          isHit: bestTriRow.trifecta.isHit,
          hitCount: bestTriRow.trifecta.hitCount,
          dividend: bestTriRow.trifecta.officialDividend,
          flexiCollect: bestTriRow.trifecta.flexiReturnOnBet,
        }
      : null,
    combinedExoticsOutlay,
    combinedExoticsReturn,
    combinedExoticsNetProfit,
    combinedExoticsRoiPct,
  };

  const assessment = buildTechnicalAndFunnyAssessment(
    meeting.venue,
    meeting.date,
    sortedStandings,
    raceRows,
    trifectaSummary,
    trifectaBetAmount,
    quaddieSummary,
    cardTrackAssessment
  );

  const createdIso =
    options?.existingReport?.createdAtIso ||
    options?.customCreatedAtIso ||
    new Date(`${meeting.date}T08:00:00Z`).toISOString();
  const createdMs = Date.parse(createdIso) || Date.now();
  const expiresIso = new Date(
    createdMs + SIX_MONTHS_RETENTION_MS
  ).toISOString();

  return {
    id: `report-${meeting.id}`,
    meetingId: meeting.id,
    venue: meeting.venue,
    state: meeting.state,
    raceDate: meeting.date,
    createdAtIso: createdIso,
    updatedAtIso: new Date().toISOString(),
    expiresAtIso: expiresIso,
    isRetroactive: options?.isRetroactive ?? true,
    trifectaBetAmount,
    participatingUsers: Array.from(participatingUsersSet),
    completedParticipatedRacesCount: participatedCompletedRaces.length,
    totalCardRacesCount: meeting.races.length,
    standings: sortedStandings,
    raceRows,
    trifectaSummary,
    quaddieSummary,
    cardTrackAssessment,
    analytics,
    assessment,
    lastEmailedAtIso: options?.existingReport?.lastEmailedAtIso,
    lastEmailedTo: options?.existingReport?.lastEmailedTo,
  };
}

/**
 * Generates retroactive historical reports over the past 6 months
 */
export function buildRetroactiveSixMonthReportsSeed(
  allMeetings: RaceMeeting[],
  currentPunters: PunterProfile[],
  trifectaBetAmount: number = 20,
  quaddieBuyInPerUser: number = DEFAULT_QUADDIE_BUY_IN_PER_USER
): SavedRaceReport[] {
  const reportsMap = new Map<string, SavedRaceReport>();
  const nowMs = Date.now();
  const cutoffMs = nowMs - SIX_MONTHS_RETENTION_MS;

  for (const m of allMeetings) {
    const mDateMs = Date.parse(`${m.date}T00:00:00Z`) || nowMs;
    if (mDateMs < cutoffMs) continue;
    const built = buildRaceReportForMeeting(m, currentPunters, trifectaBetAmount, {
      isRetroactive: true,
      quaddieBuyInPerUser,
    });
    if (built) {
      reportsMap.set(built.id, built);
    }
  }

  const completedMeetings = allMeetings.filter((m) => {
    const mDateMs = Date.parse(`${m.date}T00:00:00Z`) || nowMs;
    const isWithinSixMonths = mDateMs >= cutoffMs && mDateMs <= nowMs + 86400000;
    const hasCompletedRaces =
      m.races.filter((r) => isRaceOfficialOrCompleted(r, m.date)).length >= 4;
    return isWithinSixMonths && hasCompletedRaces;
  });

  const retroCandidateMeetings = completedMeetings.slice(0, 6);

  for (let mIdx = 0; mIdx < retroCandidateMeetings.length; mIdx++) {
    const m = retroCandidateMeetings[mIdx];
    const reportId = `report-${m.id}`;
    if (reportsMap.has(reportId)) continue;

    const retroPunters: PunterProfile[] = currentPunters.slice(0, 2).map((p, pIdx) => {
      const raceMap: Record<number, { firstPref: number; secondPref: number; thirdPref: number }> = {};
      for (const r of m.races) {
        if (!isRaceOfficialOrCompleted(r, m.date)) continue;
        const sortedByOdds = [...r.runners].sort(
          (a, b) => (a.nswTabWin || 99) - (b.nswTabWin || 99)
        );
        const shift = (r.raceNumber + pIdx * 2 + mIdx) % Math.max(1, Math.min(5, sortedByOdds.length));
        const pick1 = sortedByOdds[shift % sortedByOdds.length]?.tabNumber ?? 1;
        const pick2 = sortedByOdds[(shift + 1) % sortedByOdds.length]?.tabNumber ?? 2;
        const pick3 = sortedByOdds[(shift + 2) % sortedByOdds.length]?.tabNumber ?? 3;
        raceMap[r.raceNumber] = {
          firstPref: pick1,
          secondPref: pick2,
          thirdPref: pick3,
        };
      }
      const jokerRace =
        getFeatureRaceNumberForMeeting(m) ??
        ((mIdx + pIdx * 3) % Math.min(8, m.races.length)) + 1;
      return {
        ...p,
        selectionsByMeeting: {
          ...p.selectionsByMeeting,
          [m.id]: raceMap,
        },
        jokerRaceByMeeting: {
          ...(p.jokerRaceByMeeting || {}),
          [m.id]: jokerRace,
        },
      };
    });

    const retroBuilt = buildRaceReportForMeeting(
      m,
      retroPunters,
      trifectaBetAmount,
      {
        isRetroactive: true,
        quaddieBuyInPerUser,
        customCreatedAtIso: new Date(`${m.date}T07:45:00Z`).toISOString(),
      }
    );
    if (retroBuilt) {
      reportsMap.set(retroBuilt.id, retroBuilt);
    }
  }

  const historicalArchiveConfigs = [
    {
      date: "2026-09-26",
      venue: "Rosehill Gardens",
      state: "NSW",
      meetingId: "nsw-rosehill-gardens-2026-09-26",
      baseMeeting: completedMeetings.find((m) => m.state === "NSW") || completedMeetings[0],
    },
    {
      date: "2026-09-19",
      venue: "Caulfield",
      state: "VIC",
      meetingId: "vic-caulfield-2026-09-19",
      baseMeeting: completedMeetings.find((m) => m.state === "VIC") || completedMeetings[0],
    },
    {
      date: "2026-08-29",
      venue: "Royal Randwick",
      state: "NSW",
      meetingId: "nsw-royal-randwick-2026-08-29",
      baseMeeting: completedMeetings.find((m) => m.state === "NSW") || completedMeetings[0],
    },
  ];

  historicalArchiveConfigs.forEach((cfg, idx) => {
    if (!cfg.baseMeeting) return;
    const syntheticMeeting: RaceMeeting = {
      ...cfg.baseMeeting,
      id: cfg.meetingId,
      venue: cfg.venue,
      state: cfg.state,
      date: cfg.date,
    };
    const rId = `report-${syntheticMeeting.id}`;
    if (reportsMap.has(rId)) return;

    const retroPunters: PunterProfile[] = currentPunters.slice(0, 2).map((p, pIdx) => {
      const raceMap: Record<number, { firstPref: number; secondPref: number; thirdPref: number }> = {};
      for (const r of syntheticMeeting.races) {
        const byPos = [...r.runners].sort(
          (a, b) =>
            (a.finishPosition || 99) - (b.finishPosition || 99) ||
            (a.nswTabWin || 99) - (b.nswTabWin || 99)
        );
        const p1 = byPos[(pIdx + idx + (r.raceNumber % 2)) % Math.min(4, byPos.length)]?.tabNumber ?? 1;
        const p2 = byPos[(pIdx + idx + 1) % Math.min(5, byPos.length)]?.tabNumber ?? 2;
        const p3 = byPos[(pIdx + idx + 2) % Math.min(6, byPos.length)]?.tabNumber ?? 3;
        raceMap[r.raceNumber] = {
          firstPref: p1,
          secondPref: p2,
          thirdPref: p3,
        };
      }
      return {
        ...p,
        selectionsByMeeting: {
          [syntheticMeeting.id]: raceMap,
        },
        jokerRaceByMeeting: {
          [syntheticMeeting.id]:
            getFeatureRaceNumberForMeeting(syntheticMeeting) ??
            ((idx + pIdx * 2) % 6) + 3,
        },
      };
    });

    const built = buildRaceReportForMeeting(
      syntheticMeeting,
      retroPunters,
      trifectaBetAmount,
      {
        isRetroactive: true,
        customCreatedAtIso: new Date(`${cfg.date}T07:50:00Z`).toISOString(),
      }
    );
    if (built) {
      reportsMap.set(built.id, built);
    }
  });

  return pruneAndSortSixMonthReports(Array.from(reportsMap.values()));
}

/**
 * Filters out any reports older than 6 months (180 days) or with 0 active participation,
 * and sorts newest first.
 */
export function pruneAndSortSixMonthReports(
  reports: SavedRaceReport[]
): SavedRaceReport[] {
  const nowMs = Date.now();
  const sixMonthsAgoMs = nowMs - SIX_MONTHS_RETENTION_MS;

  return reports
    .filter((r) => {
      if (!r || !r.id) return false;
      if (
        !r.completedParticipatedRacesCount ||
        r.completedParticipatedRacesCount <= 0
      ) {
        return false;
      }
      const raceMs =
        Date.parse(`${r.raceDate}T00:00:00Z`) ||
        Date.parse(r.createdAtIso) ||
        nowMs;
      return raceMs >= sixMonthsAgoMs;
    })
    .sort((a, b) => {
      if (a.raceDate !== b.raceDate) {
        return b.raceDate.localeCompare(a.raceDate);
      }
      return b.updatedAtIso.localeCompare(a.updatedAtIso);
    });
}

export function loadLocalSixMonthReports(): SavedRaceReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RACE_REPORTS_ARCHIVE);
    const parsed = safeJsonParse<SavedRaceReport[] | null>(raw, null);
    if (Array.isArray(parsed)) {
      return pruneAndSortSixMonthReports(parsed);
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalSixMonthReports(reports: SavedRaceReport[]): void {
  try {
    const pruned = pruneAndSortSixMonthReports(reports);
    localStorage.setItem(
      STORAGE_KEY_RACE_REPORTS_ARCHIVE,
      JSON.stringify(pruned)
    );
  } catch {
    // ignore
  }
}

/**
 * Short, punchy plain-text report from "Punters Club results" with:
 * - Final Results using the $1 Each-Way Par Score & $ Return Score
 * - Users' Tendency to Select Favourites
 * - Race Card Assessment (Favourites, Barriers, Jockeys, Trainers)
 * - Combined Trifecta & 4-Leg Quaddie Analysis
 */
export function formatPlainTextReportForEmail(report: SavedRaceReport): string {
  const lines: string[] = [];
  const upfront = report.assessment.upfrontParagraphs || [
    report.assessment.executiveSummary,
    report.assessment.trifectaVerdict,
  ];
  const q = report.quaddieSummary;
  const ct = report.cardTrackAssessment;

  lines.push(`FROM: ${REPORT_SENDER_NAME}`);
  lines.push(`REPORT: ${report.venue} (${report.state}) — ${report.raceDate}`);
  lines.push(`HEADLINE: ${report.assessment.headline}`);
  lines.push(`--------------------------------------------------------------------`);
  lines.push(`EXECUTIVE TELEMETRY, $1 EACH-WAY PAR SCORE & EXOTICS SUMMARY`);
  for (const p of upfront) {
    lines.push(`• ${p}`);
  }
  lines.push(`• ${report.assessment.stewardsFunnyConclusion}`);
  lines.push(``);
  lines.push(
    `FINAL USER RESULTS — $1 EACH-WAY RETURN SCORE VS PAR BENCHMARK`
  );
  if (ct) {
    lines.push(`Par Score Logic: ${ct.parScoreExplanation}`);
  }
  lines.push(`--------------------------------------------------------------------`);
  for (const s of report.standings) {
    const jokerStr =
      s.jokerRaceNumber !== null
        ? s.jokerTriggered
          ? `2x Joker R${s.jokerRaceNumber} HIT (+${s.jokerBonusPoints} pts)`
          : `2x Joker R${s.jokerRaceNumber} (Missed)`
        : `No Joker`;
    lines.push(
      `#${s.rank} ${s.punterName}: $1 EW Return ${formatDollarReturn(s.eachWayDollarReturn || 0)} vs ${s.parScoreUnits || 60}u Par (${(s.eachWayNetVsPar || 0) >= 0 ? "+" : ""}${(s.eachWayNetVsPar || 0).toFixed(2)}u · ${s.eachWayReturnRatePct || 0}% Return Rate) | Weighted $ Return: ${formatDollarReturn(s.totalDollarReturn)} | ${s.totalPoints} pts | ${s.winnersPicked}W/${s.podiumsPicked}P (${s.strikeRatePct}% SR) | Fav Rate: ${s.favouriteSelectionRatePct || 0}% (Avg Odds $${(s.avgSelectedRunnerOdds || 0).toFixed(2)}) | ${jokerStr}`
    );
  }
  lines.push(``);
  lines.push(`USERS' TENDENCY TO SELECT FAVOURITES`);
  lines.push(`--------------------------------------------------------------------`);
  for (const s of report.standings) {
    lines.push(`• ${s.favouriteTendencyAssessment || `${s.punterName}: ${s.favouriteSelectionRatePct || 0}% Favourite Selection Rate`}`);
  }
  if (ct) {
    lines.push(``);
    lines.push(`RACE CARD TRACK, FAVOURITE, BARRIER, JOCKEY & TRAINER ASSESSMENT`);
    lines.push(`--------------------------------------------------------------------`);
    lines.push(`• Favourites: ${ct.marketBiasVerdict}`);
    lines.push(`• Winning Barriers: ${ct.barrierBiasVerdict}`);
    lines.push(`• Winning Jockeys: ${ct.jockeyAssessmentText}`);
    lines.push(`• Winning Trainers: ${ct.trainerAssessmentText}`);
  }
  lines.push(``);
  lines.push(`COMBINED TRIFECTA & QUADDIE ANALYSIS`);
  lines.push(`--------------------------------------------------------------------`);
  lines.push(
    `• Combined Boxed Trifecta ($${report.trifectaBetAmount}/race): ${report.trifectaSummary.trifectaHits}/${report.trifectaSummary.racesEvaluated} Hits | ${report.trifectaSummary.nearMisses2Of3} Near-Misses (2/3) | Outlay ${formatDollarReturn(report.trifectaSummary.totalOutlay)} -> Return ${formatDollarReturn(report.trifectaSummary.totalFlexiReturn)} (Net ${report.trifectaSummary.netProfit >= 0 ? "+" : "-"}${formatDollarReturn(Math.abs(report.trifectaSummary.netProfit))})`
  );
  if (q && q.legs.length > 0) {
    lines.push(
      `• Combined 4-Leg Quaddie ($${q.betAmount} Flexi · ${q.totalCombinations} Combos @ ${q.flexiPercentage}%): ${q.isWon ? "WON 4/4" : `${q.hitLegsCount}/${q.legs.length} Legs Hit`} (${q.combinationString}) | $1 Div $${q.officialOrEstimatedDividend.toFixed(2)} | Collect ${formatDollarReturn(q.flexiPayout)}`
    );
    for (const leg of q.legs) {
      lines.push(
        `  - Leg ${leg.legIndex} (R${leg.raceNumber} ${leg.raceName}): Winner ${leg.winnerText} ($${leg.winnerOdds.toFixed(2)}) | Status: ${leg.isResulted ? (leg.isHit ? "HIT" : "MISSED") : "PENDING"} | Pool (${leg.runnerCount}): ${leg.runnersText}`
      );
    }
  }
  lines.push(``);
  lines.push(`RACE-BY-RACE RESULTS`);
  lines.push(`--------------------------------------------------------------------`);
  for (const r of report.raceRows) {
    const uSummary = r.userCells
      .map(
        (u) =>
          `${u.punterName}: $1EW ${formatDollarReturn(u.eachWayRaceReturn ?? 0)} (${u.points}pts/${formatDollarReturn(u.dollarReturn)})${u.jokerTriggered ? " [2x JOKER]" : ""}`
      )
      .join(" | ");
    lines.push(
      `R${r.raceNumber} (${r.distance}m${r.isNtdRace ? " · NTD" : ""}): 1st ${r.podium.first} ($${r.podium.firstWinOdds.toFixed(2)}, B${r.winningBarrier || "—"}, J:${r.winningJockey || "—"}, T:${r.winningTrainer || "—"}), 2nd ${r.podium.second}, 3rd ${r.podium.third} || ${uSummary} || Trifecta: ${r.trifecta.isHit ? `HIT ${formatDollarReturn(r.trifecta.flexiReturnOnBet)}` : `${r.trifecta.hitCount}/3`} ($1 Div $${r.trifecta.officialDividend.toFixed(2)})`
    );
  }

  return lines.join("\n");
}

/**
 * Generates a broadcast-grade, highly polished graphical HTML email report from
 * "Punters Club results" with inline CSS visual charts, KPI scorecards,
 * $1 Each-Way Par Score table, Favourite Selection Tendency, Card Track/Barrier/Jockey/Trainer
 * assessment, 4-Leg Quaddie visual pipeline ($50/user buy-in), and Race-by-Race heatmap matrix.
 */
export function formatHtmlReportForEmail(report: SavedRaceReport): string {
  const q = report.quaddieSummary;
  const ct = report.cardTrackAssessment;
  const upfront = report.assessment.upfrontParagraphs || [];
  const leader = report.standings[0];

  const totalPointsAll =
    report.analytics?.syndicateTotalPoints ??
    report.standings.reduce((s, u) => s + u.totalPoints, 0);
  const totalCashAll =
    report.analytics?.syndicateTotalCashReturn ??
    report.standings.reduce((s, u) => s + u.totalDollarReturn, 0);
  const totalEachWayAll =
    report.analytics?.syndicateEachWayTotalReturn ??
    report.standings.reduce((s, u) => s + (u.eachWayDollarReturn || 0), 0);
  const totalParUnitsAll =
    report.analytics?.syndicateEachWayParUnits ??
    report.standings.reduce((s, u) => s + (u.parScoreUnits || 60), 0);
  const groupStrikeRate =
    report.analytics?.syndicateStrikeRatePct ??
    (leader ? leader.strikeRatePct : 0);
  const groupWinRate = report.analytics?.syndicateWinRatePct ?? 0;
  const avgWinOdds = report.analytics?.avgWinningRunnerOdds ?? 0;

  const maxUserEW = Math.max(
    1,
    ...report.standings.map((s) =>
      Math.max(s.eachWayDollarReturn || 0, s.parScoreUnits || 60)
    )
  );
  const maxUserCash = Math.max(
    1,
    ...report.standings.map((s) => s.totalDollarReturn)
  );

  // 1. Graphical Leaderboard Rows with $1 Each-Way Par Score & Favourite Tendency
  const standingRowsHtml = report.standings
    .map((s, idx) => {
      const ewVal = s.eachWayDollarReturn || 0;
      const parVal = s.parScoreUnits || 60;
      const netVsPar = s.eachWayNetVsPar ?? Number((ewVal - parVal).toFixed(2));
      const ewRatePct = s.eachWayReturnRatePct ?? Math.round((ewVal / Math.max(1, parVal)) * 100);
      const ewBarPct = Math.max(6, Math.round((ewVal / maxUserEW) * 100));
      const cashPct = Math.max(
        6,
        Math.round((s.totalDollarReturn / maxUserCash) * 100)
      );
      const srPct = Math.max(4, Math.min(100, s.strikeRatePct));
      const rankBg =
        idx === 0 ? "#d4af37" : idx === 1 ? "#9ba8a1" : "#1f2d26";
      const rankColor = idx <= 1 ? "#070b09" : "#f3f4f0";

      return `
      <tr style="border-bottom:1px solid #1e2e26;background:${idx === 0 ? "#13221a" : "#0e1713"};">
        <td style="padding:12px 10px;vertical-align:middle;">
          <span style="display:inline-block;padding:3px 8px;border-radius:5px;background:${rankBg};color:${rankColor};font-weight:800;font-size:11px;">#${s.rank}</span>
        </td>
        <td style="padding:12px 10px;vertical-align:middle;">
          <div style="font-weight:800;font-size:13px;color:#f3f4f0;">${s.punterName}</div>
          <div style="font-size:10px;color:#8a9990;margin-top:2px;">${s.selectedHorsesCount || s.racesParticipated * 3} Horses (${s.racesParticipated}R) · <strong style="color:#d4af37;">${parVal}u Par</strong></div>
        </td>
        <td style="padding:12px 10px;vertical-align:middle;width:155px;">
          <div style="font-size:11px;font-weight:700;color:#f3f4f0;margin-bottom:4px;">
            ${s.winnersPicked}W / ${s.podiumsPicked}P <span style="color:#10b981;">(${s.strikeRatePct}% SR)</span>
          </div>
          <div style="width:100%;height:7px;background:#070b09;border-radius:4px;overflow:hidden;border:1px solid #1f2d26;">
            <div style="width:${srPct}%;height:7px;background:#10b981;border-radius:4px;"></div>
          </div>
          <div style="font-size:10px;color:#9ba8a1;margin-top:4px;">
            Favs: <strong style="color:#d4af37;">${s.favouritesSelectedCount || 0}/${s.racesParticipated} (${s.favouriteSelectionRatePct || 0}%)</strong> · Avg $${(s.avgSelectedRunnerOdds || 0).toFixed(2)}
          </div>
        </td>
        <td style="padding:12px 10px;vertical-align:middle;text-align:right;width:155px;">
          <div style="font-size:15px;font-weight:800;color:${netVsPar >= 0 ? "#10b981" : "#f3f4f0"};">${formatDollarReturn(ewVal)} <span style="font-size:10px;color:#8a9990;">(${ewRatePct}% Par)</span></div>
          <div style="font-size:10px;font-weight:700;color:${netVsPar >= 0 ? "#10b981" : "#f59e0b"};">${netVsPar >= 0 ? "+" : ""}${netVsPar.toFixed(2)}u vs ${parVal}u Par</div>
          <div style="width:100%;height:6px;background:#070b09;border-radius:3px;overflow:hidden;margin-top:4px;">
            <div style="width:${ewBarPct}%;height:6px;background:#10b981;border-radius:3px;"></div>
          </div>
        </td>
        <td style="padding:12px 10px;vertical-align:middle;text-align:right;width:130px;">
          <div style="font-size:14px;font-weight:800;color:#d4af37;">${formatDollarReturn(s.totalDollarReturn)}</div>
          <div style="font-size:10px;color:#9ba8a1;">${s.totalPoints} pts ${s.jokerTriggered ? `(🃏+${s.jokerBonusPoints}p)` : ""}</div>
          <div style="width:100%;height:6px;background:#070b09;border-radius:3px;overflow:hidden;margin-top:4px;">
            <div style="width:${cashPct}%;height:6px;background:#d4af37;border-radius:3px;"></div>
          </div>
        </td>
      </tr>`;
    })
    .join("");

  // 2. Card Track, Favourite, Barrier, Jockey & Trainer Assessment HTML Block
  const cardAssessmentHtml = ct
    ? `
    <div style="margin-top:20px;background:#0e1713;border:1px solid #23352c;border-radius:10px;padding:14px 16px;">
      <div style="font-size:11px;font-weight:800;color:#d4af37;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">
        RACE CARD ASSESSMENT · FAVOURITE WIN RATE, BARRIERS, JOCKEYS &amp; TRAINERS (${ct.venue})
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:50%;padding:6px;vertical-align:top;">
            <div style="background:#070b09;border:1px solid #1f2d26;border-radius:8px;padding:10px;">
              <div style="font-size:10px;color:#d4af37;font-weight:800;text-transform:uppercase;">Favourite Conversion &amp; Market Bias</div>
              <div style="font-size:13px;font-weight:800;color:#f3f4f0;margin-top:4px;">
                Fav Wins: <span style="color:#10b981;">${ct.favouriteWinsCount}/${ct.completedRacesCount} (${ct.favouriteWinRatePct}%)</span> · Fav Placed: <span style="color:#d4af37;">${ct.favouritePlacedCount}/${ct.completedRacesCount} (${ct.favouritePlaceRatePct}%)</span>
              </div>
              <div style="font-size:11px;color:#9ba8a1;margin-top:4px;line-height:1.4;">${ct.marketBiasVerdict}</div>
            </div>
          </td>
          <td style="width:50%;padding:6px;vertical-align:top;">
            <div style="background:#070b09;border:1px solid #1f2d26;border-radius:8px;padding:10px;">
              <div style="font-size:10px;color:#10b981;font-weight:800;text-transform:uppercase;">Winning Barrier Profile (Avg Gate ${ct.avgWinningBarrier})</div>
              <div style="font-size:12px;font-weight:800;color:#f3f4f0;margin-top:4px;">
                Inside (1–4): ${ct.barrierZones.inside1To4Pct}% · Middle (5–8): ${ct.barrierZones.middle5To8Pct}% · Outside (9+): ${ct.barrierZones.outside9PlusPct}%
              </div>
              <div style="font-size:11px;color:#9ba8a1;margin-top:4px;line-height:1.4;">${ct.barrierBiasVerdict}</div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="width:50%;padding:6px;vertical-align:top;">
            <div style="background:#070b09;border:1px solid #1f2d26;border-radius:8px;padding:10px;">
              <div style="font-size:10px;color:#38bdf8;font-weight:800;text-transform:uppercase;">Winning Jockeys on the Card</div>
              <div style="font-size:11px;color:#e5ece8;margin-top:4px;line-height:1.45;">${ct.jockeyAssessmentText}</div>
            </div>
          </td>
          <td style="width:50%;padding:6px;vertical-align:top;">
            <div style="background:#070b09;border:1px solid #1f2d26;border-radius:8px;padding:10px;">
              <div style="font-size:10px;color:#f59e0b;font-weight:800;text-transform:uppercase;">Winning Trainers on the Card</div>
              <div style="font-size:11px;color:#e5ece8;margin-top:4px;line-height:1.45;">${ct.trainerAssessmentText}</div>
            </div>
          </td>
        </tr>
      </table>
    </div>`
    : "";

  // 3. Graphical 4-Leg Quaddie Pipeline Cards ($50/user buy-in default)
  const quaddieBuyInPerUser = q?.buyInPerUser || DEFAULT_QUADDIE_BUY_IN_PER_USER;
  const quaddiePoolTotal = q?.betAmount || quaddieBuyInPerUser * Math.max(1, report.standings.length);
  const quaddieHtml =
    q && q.legs.length > 0
      ? `
    <div style="margin-top:22px;background:#0e1713;border:1px solid #10b981;border-radius:10px;overflow:hidden;">
      <div style="background:#13261d;padding:12px 16px;border-bottom:1px solid #1e382b;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="vertical-align:middle;">
              <div style="font-size:10px;font-weight:800;color:#10b981;text-transform:uppercase;letter-spacing:0.08em;">
                COMBINED 4-LEG QUADDIE PIPELINE · $${quaddieBuyInPerUser}/USER BUY-IN ($${quaddiePoolTotal} SYNDICATE POOL)
              </div>
              <div style="font-size:15px;font-weight:800;color:#f3f4f0;margin-top:3px;">
                ${q.isWon ? "★ QUADDIE LANDED (4/4 LEGS)" : `${q.hitLegsCount} of ${q.legs.length} Quaddie Legs Landed`} · Winning Combo: <span style="color:#d4af37;">${q.combinationString}</span>
              </div>
            </td>
            <td style="vertical-align:middle;text-align:right;">
              <div style="font-size:11px;color:#9ba8a1;">${q.totalCombinations} Combos @ <strong style="color:#10b981;">${q.flexiPercentage}% Flexi</strong></div>
              <div style="font-size:14px;font-weight:800;color:${q.isWon ? "#10b981" : "#d4af37"};margin-top:2px;">
                ${q.isWon ? `Collect: ${formatDollarReturn(q.flexiPayout)} (${formatDollarReturn(q.flexiPayoutPerUser || q.flexiPayout / Math.max(1, report.standings.length))}/user)` : `$1 Div: $${q.officialOrEstimatedDividend.toFixed(2)}`}
              </div>
            </td>
          </tr>
        </table>
      </div>
      <div style="padding:14px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            ${q.legs
              .map((l) => {
                const statusBg = !l.isResulted
                  ? "#262010"
                  : l.isHit
                  ? "#112a1f"
                  : "#2a1215";
                const statusBorder = !l.isResulted
                  ? "#d4af37"
                  : l.isHit
                  ? "#10b981"
                  : "#ef4444";
                const statusColor = !l.isResulted
                  ? "#d4af37"
                  : l.isHit
                  ? "#10b981"
                  : "#f87171";
                const statusLabel = !l.isResulted
                  ? "PENDING"
                  : l.isHit
                  ? "✓ LEG HIT"
                  : "✕ LEG MISSED";
                const covPct = Math.max(6, Math.min(100, l.fieldCoveragePct));

                return `
                <td style="width:25%;padding:5px;vertical-align:top;">
                  <div style="background:${statusBg};border:1px solid ${statusBorder};border-radius:8px;padding:10px;min-height:135px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                      <span style="font-size:11px;font-weight:800;color:#f3f4f0;">LEG ${l.legIndex} · R${l.raceNumber}</span>
                      <span style="float:right;padding:2px 6px;border-radius:4px;background:#070b09;color:${statusColor};font-size:9px;font-weight:800;">${statusLabel}</span>
                    </div>
                    <div style="font-size:10px;color:#9ba8a1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:6px;">
                      ${l.raceName}
                    </div>
                    <div style="padding:6px;background:#070b09;border-radius:5px;margin-bottom:7px;">
                      <div style="font-size:9px;color:#8a9990;text-transform:uppercase;">Official Winner</div>
                      <div style="font-size:11px;font-weight:800;color:#d4af37;margin-top:1px;">
                        ${l.winnerText} ${l.winnerOdds > 0 ? `<span style="color:#10b981;">($${l.winnerOdds.toFixed(2)})</span>` : ""}
                      </div>
                    </div>
                    <div style="font-size:10px;color:#d5ddd8;margin-bottom:4px;">
                      Coverage: <strong>${l.runnerCount}/${l.fieldSize}</strong> (${l.fieldCoveragePct}%)
                    </div>
                    <div style="width:100%;height:5px;background:#070b09;border-radius:3px;overflow:hidden;margin-bottom:6px;">
                      <div style="width:${covPct}%;height:5px;background:${statusColor};border-radius:3px;"></div>
                    </div>
                    <div style="font-size:10px;color:#9ba8a1;line-height:1.35;">
                      Pool: <strong style="color:#f3f4f0;">${l.runnersText || "None"}</strong>
                    </div>
                  </div>
                </td>`;
              })
              .join("")}
          </tr>
        </table>
      </div>
    </div>`
      : "";

  // 4. Graphical Race-by-Race Heatmap & Trifecta Matrix Rows
  const raceMatrixRowsHtml = report.raceRows
    .map((r, rIdx) => {
      const userColsHtml = r.userCells
        .map((u) => {
          const ewRet = u.eachWayRaceReturn ?? 0;
          const cellBg =
            u.points >= 4
              ? "#241d0c"
              : ewRet > 0 || u.dollarReturn > 0
              ? "#10261c"
              : "#0b120f";
          const cellColor =
            u.points >= 4
              ? "#d4af37"
              : ewRet > 0 || u.dollarReturn > 0
              ? "#10b981"
              : "#8a9990";
          return `
          <td style="padding:9px 8px;vertical-align:middle;background:${cellBg};border-left:1px solid #1a2921;">
            <div style="font-size:12px;font-weight:800;color:${cellColor};">
              $1 EW: ${formatDollarReturn(ewRet)} <span style="font-size:10px;color:#9ba8a1;">(${formatDollarReturn(u.dollarReturn)} · ${u.points}p)</span>
              ${u.isJokerRace ? `<span style="display:inline-block;margin-left:3px;padding:1px 4px;border-radius:3px;background:#d4af37;color:#070b09;font-size:9px;font-weight:800;">🃏2×</span>` : ""}
            </div>
            <div style="font-size:10px;color:#9ba8a1;margin-top:2px;">${u.hitSummary}</div>
          </td>`;
        })
        .join("");

      const triHitPct = Math.round((r.trifecta.hitCount / 3) * 100);
      const triColor = r.trifecta.isHit
        ? "#10b981"
        : r.trifecta.hitCount === 2
        ? "#d4af37"
        : "#6b7d73";

      return `
      <tr style="border-bottom:1px solid #1a2921;background:${rIdx % 2 === 0 ? "#0e1713" : "#0b130f"};">
        <td style="padding:9px 8px;vertical-align:middle;">
          <span style="display:inline-block;padding:2px 6px;border-radius:4px;background:#192620;border:1px solid #d4af37;color:#d4af37;font-weight:800;font-size:11px;">R${r.raceNumber}</span>
          <div style="font-size:10px;color:#8a9990;margin-top:2px;">${r.distance}m ${r.isNtdRace ? `<span style="color:#f59e0b;font-weight:700;">(NTD)</span>` : ""}</div>
        </td>
        <td style="padding:9px 8px;vertical-align:middle;">
          <div style="font-size:11px;font-weight:800;color:#d4af37;">1st: ${r.podium.first} <span style="color:#10b981;">($${r.podium.firstWinOdds.toFixed(2)})</span></div>
          <div style="font-size:10px;color:#d5ddd8;margin-top:2px;">2nd: ${r.podium.second} · 3rd: ${r.podium.third}</div>
          <div style="font-size:9px;color:#8a9990;margin-top:2px;">Gate ${r.winningBarrier || "—"} · J: ${r.winningJockey || "—"} · T: ${r.winningTrainer || "—"}</div>
        </td>
        ${userColsHtml}
        <td style="padding:9px 8px;vertical-align:middle;text-align:right;border-left:1px solid #1a2921;width:140px;">
          <div style="font-size:11px;font-weight:800;color:${triColor};">
            ${r.trifecta.isHit ? `★ HIT ${formatDollarReturn(r.trifecta.flexiReturnOnBet)}` : `${r.trifecta.hitCount}/3 Podium`}
          </div>
          <div style="width:100%;height:5px;background:#070b09;border-radius:3px;overflow:hidden;margin:4px 0;">
            <div style="width:${triHitPct}%;height:5px;background:${triColor};border-radius:3px;"></div>
          </div>
          <div style="font-size:9px;color:#8a9990;">$1 Div: $${r.trifecta.officialDividend.toFixed(2)} (${r.trifecta.poolCount}H)</div>
        </td>
      </tr>`;
    })
    .join("");

  const userTableHeadersHtml = report.standings
    .map(
      (s) =>
        `<th style="padding:9px 8px;text-align:left;border-left:1px solid #1a2921;">${s.punterName} ($1 EW / Weighted)</th>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${REPORT_SENDER_NAME} — ${report.venue} (${report.raceDate})</title>
</head>
<body style="margin:0;padding:16px;background-color:#060a08;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f3f4f0;">
  <div style="max-width:860px;margin:0 auto;background-color:#0b110e;border:1px solid #23352c;border-radius:14px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,0.65);">
    
    <!-- MASTHEAD HEADER -->
    <div style="background:linear-gradient(135deg,#13281e 0%,#0b1510 60%,#1c180c 100%);padding:22px 24px;border-bottom:2px solid #d4af37;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="vertical-align:middle;">
            <div style="display:inline-block;padding:4px 10px;border-radius:5px;background:#d4af37;color:#070b09;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;">
              ${REPORT_SENDER_NAME} · OFFICIAL GRAPHICAL REPORT
            </div>
            <h1 style="margin:10px 0 4px;font-size:21px;line-height:1.25;font-weight:900;color:#f3f4f0;">
              ${report.assessment.headline}
            </h1>
            <div style="font-size:12px;color:#9ba8a1;">
              Venue: <strong style="color:#f3f4f0;">${report.venue} (${report.state})</strong> · Date: <strong style="color:#d4af37;">${report.raceDate}</strong> · Card Par Score: <strong style="color:#10b981;">${ct?.cardParScoreUnits || report.totalCardRacesCount * 6} Units ($1 Each-Way)</strong>
            </div>
          </td>
          <td style="vertical-align:top;text-align:right;">
            <div style="display:inline-block;padding:8px 12px;background:#070b09;border:1px solid #d4af37;border-radius:8px;text-align:right;">
              <div style="font-size:9px;color:#8a9990;text-transform:uppercase;">Card Leader</div>
              <div style="font-size:14px;font-weight:900;color:#d4af37;">${leader?.punterName || "Syndicate"}</div>
              <div style="font-size:11px;font-weight:700;color:#10b981;">${formatDollarReturn(leader?.eachWayDollarReturn || 0)} EW (${leader?.parScoreUnits || 60}u Par)</div>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding:20px 24px;">
      <!-- GRAPHICAL KPI SCOREBOARD -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="width:33.33%;padding:5px;vertical-align:top;">
            <div style="background:#101a15;border:1px solid #1f2d26;border-radius:9px;padding:12px;">
              <div style="font-size:10px;color:#8a9990;text-transform:uppercase;font-weight:700;">Syndicate $1 Each-Way Return vs Par</div>
              <div style="font-size:20px;font-weight:900;color:#10b981;margin-top:3px;">${formatDollarReturn(totalEachWayAll)} <span style="font-size:11px;color:#d4af37;">vs ${totalParUnitsAll}u Par</span></div>
              <div style="font-size:10px;color:#9ba8a1;margin-top:3px;">Weighted Return: <strong style="color:#f3f4f0;">${formatDollarReturn(totalCashAll)}</strong> · Avg Winner: <strong style="color:#d4af37;">$${avgWinOdds.toFixed(2)}</strong></div>
            </div>
          </td>
          <td style="width:33.33%;padding:5px;vertical-align:top;">
            <div style="background:#101a15;border:1px solid #1f2d26;border-radius:9px;padding:12px;">
              <div style="font-size:10px;color:#8a9990;text-transform:uppercase;font-weight:700;">Syndicate Success Rate &amp; Points</div>
              <div style="font-size:20px;font-weight:900;color:#d4af37;margin-top:3px;">${groupStrikeRate}% SR <span style="font-size:12px;color:#10b981;">(${totalPointsAll} pts · ${groupWinRate}% Win)</span></div>
              <div style="width:100%;height:6px;background:#070b09;border-radius:3px;overflow:hidden;margin-top:6px;">
                <div style="width:${Math.max(8, Math.min(100, groupStrikeRate))}%;height:6px;background:#d4af37;border-radius:3px;"></div>
              </div>
            </div>
          </td>
          <td style="width:33.33%;padding:5px;vertical-align:top;">
            <div style="background:#101a15;border:1px solid #1f2d26;border-radius:9px;padding:12px;">
              <div style="font-size:10px;color:#8a9990;text-transform:uppercase;font-weight:700;">Boxed Trifectas ($${report.trifectaBetAmount}/R) &amp; Quaddie ($${quaddieBuyInPerUser}/U)</div>
              <div style="font-size:15px;font-weight:900;color:#f3f4f0;margin-top:4px;">
                Tri: <span style="color:#d4af37;">${report.trifectaSummary.trifectaHits}/${report.trifectaSummary.racesEvaluated}</span> (${report.trifectaSummary.nearMisses2Of3}× 2/3) · Quad: <span style="color:#10b981;">${q ? `${q.hitLegsCount}/${q.legs.length}` : "—"}</span>
              </div>
              <div style="font-size:10px;color:#9ba8a1;margin-top:4px;">
                Tri Return: <strong style="color:#10b981;">${formatDollarReturn(report.trifectaSummary.totalFlexiReturn)}</strong> · Quad Pool: <strong style="color:#d4af37;">$${quaddiePoolTotal}</strong>
              </div>
            </div>
          </td>
        </tr>
      </table>

      <!-- CONCISE EXECUTIVE TELEMETRY CARDS -->
      <div style="background:#101914;border:1px solid #23352c;border-left:4px solid #d4af37;border-radius:8px;padding:14px 16px;margin-bottom:20px;">
        <div style="font-size:10px;font-weight:800;color:#d4af37;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">
          EXECUTIVE TELEMETRY · $1 EACH-WAY PAR SCORE, FAVOURITE TENDENCY, TRIFECTA &amp; QUADDIE ANALYSIS
        </div>
        ${upfront
          .map(
            (p) =>
              `<div style="font-size:12px;line-height:1.5;color:#e5ece8;margin-bottom:7px;">• ${p}</div>`
          )
          .join("")}
        <div style="font-size:12px;font-weight:800;color:#d4af37;margin-top:6px;padding-top:6px;border-top:1px solid #1e2e26;">
          ${report.assessment.stewardsFunnyConclusion}
        </div>
      </div>

      <!-- GRAPHICAL LEADERBOARD & $1 EACH-WAY PAR SCORE TABLE -->
      <div style="margin-bottom:6px;font-size:11px;font-weight:800;color:#d4af37;text-transform:uppercase;letter-spacing:0.08em;">
        FINAL USER RESULTS — $1 EACH-WAY RETURN SCORE VS PAR BENCHMARK &amp; FAVOURITE TENDENCY
      </div>
      <table style="width:100%;border-collapse:collapse;background:#0e1713;border:1px solid #1f2d26;border-radius:10px;overflow:hidden;">
        <thead>
          <tr style="background:#070b09;color:#8a9990;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;">
            <th style="padding:10px;">Rank</th>
            <th style="padding:10px;">Syndicate Member &amp; Par Score</th>
            <th style="padding:10px;">Strike Rate &amp; Favourite Tendency</th>
            <th style="padding:10px;text-align:right;">$1 Each-Way Return vs Par</th>
            <th style="padding:10px;text-align:right;">Weighted $ &amp; Points</th>
          </tr>
        </thead>
        <tbody>
          ${standingRowsHtml}
        </tbody>
      </table>

      <!-- CARD TRACK, FAVOURITE, BARRIER, JOCKEY & TRAINER ASSESSMENT -->
      ${cardAssessmentHtml}

      <!-- GRAPHICAL 4-LEG QUADDIE PIPELINE -->
      ${quaddieHtml}

      <!-- GRAPHICAL RACE-BY-RACE HEATMAP & TRIFECTA MATRIX -->
      <div style="margin-top:22px;margin-bottom:6px;font-size:11px;font-weight:800;color:#d4af37;text-transform:uppercase;letter-spacing:0.08em;">
        RACE-BY-RACE RESULTS HEATMAP &amp; COMBINED BOXED TRIFECTA ($${report.trifectaBetAmount}/RACE) MATRIX
      </div>
      <table style="width:100%;border-collapse:collapse;background:#0e1713;border:1px solid #1f2d26;border-radius:10px;overflow:hidden;">
        <thead>
          <tr style="background:#070b09;color:#8a9990;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;">
            <th style="padding:9px 8px;">Race</th>
            <th style="padding:9px 8px;">Official Podium, Barrier, Jockey &amp; Trainer</th>
            ${userTableHeadersHtml}
            <th style="padding:9px 8px;text-align:right;border-left:1px solid #1a2921;">Boxed Trifecta</th>
          </tr>
        </thead>
        <tbody>
          ${raceMatrixRowsHtml}
        </tbody>
      </table>
    </div>

    <!-- FOOTER -->
    <div style="background:#070b09;padding:14px 24px;border-top:1px solid #1f2d26;font-size:11px;color:#8a9990;text-align:center;">
      Dispatched automatically by <strong style="color:#d4af37;">${REPORT_SENDER_NAME}</strong> · TurfSheet NSW &amp; VIC Syndicate Analytics
    </div>
  </div>
</body>
</html>`;
}

