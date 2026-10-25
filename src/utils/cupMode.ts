import {
  CupTournamentState,
  CupUserLeaderboardEntry,
  CupUserRaceOutcome,
  CupSyndicateTrifectaOutcome,
} from "../types/cupMode";
import { PunterProfile, RaceMeeting } from "../types/racing";
import { computeBoxTrifectaCombinations } from "./scoring";

export const STORAGE_KEY_CUP_MODE = "turfsheet_cup_mode_v2";

export function getInitialCupState(
  meetingId: string,
  punters: PunterProfile[] = []
): CupTournamentState {
  const participants =
    punters.length > 0
      ? punters.map((p) => p.name)
      : ["Steve F", "Mark S", "Dave W"];

  return {
    isActive: false,
    name: "Syndicate Cup Tournament",
    meetingId,
    participants,
    selectionsByRace: {},
    draftType: "snake",
    activeRaceNumber: 1,
    activeDraftIndex: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Returns the ordered draft sequence of punter names for a specific race.
 * In a Snake draft:
 * - Odd races (R1, R3, R5...): Original participant order (1 -> 2 -> 3)
 * - Even races (R2, R4, R6...): Reversed participant order (3 -> 2 -> 1)
 */
export function getDraftOrderForRace(
  raceNumber: number,
  participants: string[],
  draftType: "snake" | "fixed" = "snake"
): string[] {
  if (participants.length === 0) return [];
  if (draftType === "fixed") return [...participants];
  return raceNumber % 2 === 1 ? [...participants] : [...participants].reverse();
}

/**
 * Identifies whose turn it is to draft in the specified race.
 * Returns null if all participants have made their discreet pick for this race.
 */
export function getActiveDraftPunter(
  tournament: CupTournamentState,
  raceNumber: number = tournament.activeRaceNumber
): string | null {
  const draftOrder = getDraftOrderForRace(
    raceNumber,
    tournament.participants,
    tournament.draftType
  );
  const racePicks = tournament.selectionsByRace[raceNumber] || {};

  for (const punter of draftOrder) {
    if (racePicks[punter] === undefined) {
      return punter;
    }
  }
  return null;
}

/**
 * Checks if a runner is already taken by a user in the specified race.
 */
export function isHorseTakenInRace(
  raceNumber: number,
  tabNumber: number,
  selectionsByRace: Record<number, Record<string, number>>
): { isTaken: boolean; takenBy?: string } {
  const racePicks = selectionsByRace[raceNumber] || {};
  for (const [punter, pickedTab] of Object.entries(racePicks)) {
    if (pickedTab === tabNumber) {
      return { isTaken: true, takenBy: punter };
    }
  }
  return { isTaken: false };
}

/**
 * Assigns a discreet horse selection for a user in a race.
 * Enforces mutual exclusivity (no horse selected twice in the same race).
 */
export function assignCupPick(
  tournament: CupTournamentState,
  raceNumber: number,
  punterName: string,
  tabNumber: number
): CupTournamentState {
  const currentPicks = { ...(tournament.selectionsByRace[raceNumber] || {}) };

  // Check if taken by someone else
  for (const [otherPunter, otherTab] of Object.entries(currentPicks)) {
    if (otherTab === tabNumber && otherPunter !== punterName) {
      // Already taken by another participant
      return tournament;
    }
  }

  currentPicks[punterName] = tabNumber;

  const nextSelections = {
    ...tournament.selectionsByRace,
    [raceNumber]: currentPicks,
  };

  // Compute next drafter in line
  const draftOrder = getDraftOrderForRace(
    raceNumber,
    tournament.participants,
    tournament.draftType
  );
  let nextIndex = 0;
  for (let i = 0; i < draftOrder.length; i++) {
    if (currentPicks[draftOrder[i]] === undefined) {
      nextIndex = i;
      break;
    }
  }

  return {
    ...tournament,
    selectionsByRace: nextSelections,
    activeRaceNumber: raceNumber,
    activeDraftIndex: nextIndex,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Removes or undrafts a user's selection for a race.
 */
export function removeCupPick(
  tournament: CupTournamentState,
  raceNumber: number,
  punterName: string
): CupTournamentState {
  const racePicks = { ...(tournament.selectionsByRace[raceNumber] || {}) };
  delete racePicks[punterName];

  return {
    ...tournament,
    selectionsByRace: {
      ...tournament.selectionsByRace,
      [raceNumber]: racePicks,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Evaluates all user picks against official race results to produce
 * a comprehensive Cup Mode Tournament Leaderboard.
 */
export function calculateCupLeaderboard(
  tournament: CupTournamentState,
  meeting: RaceMeeting
): CupUserLeaderboardEntry[] {
  const entries: CupUserLeaderboardEntry[] = tournament.participants.map(
    (punterName) => {
      let winCount = 0;
      let placeCount = 0;
      let totalPicks = 0;
      let totalPoints = 0;
      let totalDollarReturn = 0;
      let totalOutlay = 0;
      const raceOutcomes: CupUserRaceOutcome[] = [];

      for (const race of meeting.races) {
        const pickedTab =
          tournament.selectionsByRace[race.raceNumber]?.[punterName];
        if (!pickedTab) continue;

        const runner = race.runners.find((r) => r.tabNumber === pickedTab);
        if (!runner) continue;

        totalPicks += 1;
        const fieldSize = race.runners.filter((r) => !r.isScratched).length;
        const isOfficial = race.status === "Official" || runner.finishPosition > 0;

        let points = 0;
        let dollarReturn = 0;
        const isWon = runner.finishPosition === 1;
        let isPlaced = false;

        // $1 Each-Way Par = $2.00 stake per pick
        const stake = 2.0;
        totalOutlay += stake;

        if (isOfficial) {
          if (runner.finishPosition === 1) {
            winCount += 1;
            placeCount += 1;
            isPlaced = true;
            points = 3;
            const winDiv = runner.nswTabWin || runner.fixedWin || 0;
            const placeDiv = runner.nswTabPlace || runner.fixedPlace || 0;
            dollarReturn = Number((winDiv + (fieldSize >= 5 ? placeDiv : 0)).toFixed(2));
          } else if (runner.finishPosition === 2) {
            placeCount += 1;
            isPlaced = true;
            points = 2;
            const placeDiv = runner.nswTabPlace || runner.fixedPlace || 0;
            dollarReturn = Number((fieldSize >= 5 ? placeDiv : 0).toFixed(2));
          } else if (runner.finishPosition === 3) {
            // Place dividend only paid for fields with 8+ runners
            if (fieldSize >= 8) {
              placeCount += 1;
              isPlaced = true;
              points = 1;
              const placeDiv = runner.nswTabPlace || runner.fixedPlace || 0;
              dollarReturn = Number(placeDiv.toFixed(2));
            }
          }
        }

        totalPoints += points;
        totalDollarReturn += dollarReturn;

        raceOutcomes.push({
          raceNumber: race.raceNumber,
          punterName,
          tabNumber: runner.tabNumber,
          horseName: runner.horseName,
          barrier: runner.barrier,
          jockey: runner.jockey,
          trainer: runner.trainer,
          fixedWin: runner.fixedWin,
          finishPosition: runner.finishPosition,
          isWon,
          isPlaced,
          points,
          dollarReturn,
          netProfit: Number((dollarReturn - stake).toFixed(2)),
        });
      }

      const strikeRatePct =
        totalPicks > 0 ? Math.round((winCount / totalPicks) * 100) : 0;
      const netProfit = Number((totalDollarReturn - totalOutlay).toFixed(2));

      return {
        punterName,
        rank: 1,
        totalPicks,
        winCount,
        placeCount,
        strikeRatePct,
        totalPoints,
        totalDollarReturn: Number(totalDollarReturn.toFixed(2)),
        totalOutlay: Number(totalOutlay.toFixed(2)),
        netProfit,
        raceOutcomes,
      };
    }
  );

  // Sort primarily by Total Points, secondary by Net Profit / $ Return
  entries.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    return b.netProfit - a.netProfit;
  });

  // Assign ranks
  entries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return entries;
}

/**
 * Calculates the collective syndicate Flexi Box Trifecta outcomes
 * by combining all user picks in each race.
 */
export function calculateCupTrifectaOutcomes(
  tournament: CupTournamentState,
  meeting: RaceMeeting,
  flexiStakePerRace: number = 10
): CupSyndicateTrifectaOutcome[] {
  return meeting.races.map((race) => {
    const racePicks = tournament.selectionsByRace[race.raceNumber] || {};
    const boxedRunners: CupSyndicateTrifectaOutcome["boxedRunners"] = [];

    for (const [punter, tab] of Object.entries(racePicks)) {
      const runner = race.runners.find((r) => r.tabNumber === tab);
      if (runner) {
        boxedRunners.push({
          tabNumber: runner.tabNumber,
          horseName: runner.horseName,
          punterName: punter,
          finishPosition: runner.finishPosition,
        });
      }
    }

    const runnerCount = boxedRunners.length;
    const totalCombinations = computeBoxTrifectaCombinations(runnerCount);

    const flexiPercentage =
      totalCombinations > 0
        ? Number(((flexiStakePerRace / totalCombinations) * 100).toFixed(2))
        : 0;

    // Check if official race has completed with 1st, 2nd, and 3rd runners
    const firstPlace = race.runners.find((r) => r.finishPosition === 1);
    const secondPlace = race.runners.find((r) => r.finishPosition === 2);
    const thirdPlace = race.runners.find((r) => r.finishPosition === 3);

    const hasCompleted = Boolean(firstPlace && secondPlace && thirdPlace);
    const pickedTabs = new Set(boxedRunners.map((r) => r.tabNumber));

    const isStruck =
      hasCompleted &&
      firstPlace !== undefined &&
      secondPlace !== undefined &&
      thirdPlace !== undefined &&
      pickedTabs.has(firstPlace.tabNumber) &&
      pickedTabs.has(secondPlace.tabNumber) &&
      pickedTabs.has(thirdPlace.tabNumber);

    // Extract official TAB Trifecta dividend
    let officialTrifectaDividend = 0;
    const triExotic = race.exotics?.find(
      (ex) =>
        ex.poolType.toLowerCase().includes("trifecta") ||
        ex.poolType.toLowerCase() === "t"
    );
    if (triExotic && triExotic.dividend > 0) {
      officialTrifectaDividend = triExotic.dividend;
    } else if (isStruck && firstPlace && secondPlace && thirdPlace) {
      // Fallback estimated NSW TAB tote trifecta from product of dividends
      officialTrifectaDividend = Number(
        (
          firstPlace.nswTabWin *
          (secondPlace.nswTabPlace || 2.5) *
          (thirdPlace.nswTabPlace || 3.0) *
          4.2
        ).toFixed(2)
      );
    }

    const flexiPayout = isStruck
      ? Number(((flexiPercentage / 100) * officialTrifectaDividend).toFixed(2))
      : 0;

    const netProfit =
      runnerCount >= 3
        ? Number((flexiPayout - flexiStakePerRace).toFixed(2))
        : 0;

    return {
      raceNumber: race.raceNumber,
      raceName: race.raceName,
      status: race.status,
      boxedRunners,
      totalCombinations,
      flexiStake: runnerCount >= 3 ? flexiStakePerRace : 0,
      flexiPercentage,
      officialTrifectaDividend,
      isStruck,
      flexiPayout,
      netProfit,
    };
  });
}
