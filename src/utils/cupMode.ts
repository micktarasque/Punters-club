import {
  CupTournamentState,
  CupUserLeaderboardEntry,
  CupUserRaceOutcome,
  CupSyndicateTrifectaOutcome,
  CupAllocatedPickInfo,
} from "../types/cupMode";
import { PunterProfile, RaceMeeting, RaceEvent, RaceRunner, RaceSelectionTrio } from "../types/racing";
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

/**
 * Returns how many preference ranks are required for a race (up to 8, or the full field size).
 */
export function getRequiredRankCountForRace(race: RaceEvent): number {
  const activeCount = race.runners.filter((r) => !r.isScratched).length;
  return Math.min(8, Math.max(1, activeCount));
}

/**
 * Checks whether a single user has completed their preference ranks for a specific race.
 */
export function isUserPreferencesCompleteForRace(
  race: RaceEvent,
  preferences?: number[]
): boolean {
  if (!preferences || preferences.length === 0) return false;
  const required = getRequiredRankCountForRace(race);
  if (preferences.length < required) return false;

  const activeTabs = new Set(race.runners.filter((r) => !r.isScratched).map((r) => r.tabNumber));
  // First `required` items must be distinct and be in activeTabs
  const chosen = preferences.slice(0, required);
  const uniqueSet = new Set(chosen);
  if (uniqueSet.size < required) return false;

  return chosen.every((tab) => activeTabs.has(tab));
}

/**
 * Evaluates full tournament completion of 8-horse preference lists across all punters & races.
 */
export function checkAllPreferencesCompletion(
  meeting: RaceMeeting,
  participants: string[],
  preferencesByRace: Record<number, Record<string, number[]>> | undefined
): {
  isComplete: boolean;
  totalRequired: number;
  totalCompleted: number;
  percentage: number;
  missing: Array<{ raceNumber: number; punter: string; count: number; required: number }>;
} {
  const missing: Array<{ raceNumber: number; punter: string; count: number; required: number }> = [];
  let totalSlots = 0;
  let filledSlots = 0;

  for (const race of meeting.races) {
    const required = getRequiredRankCountForRace(race);
    for (const punter of participants) {
      totalSlots += required;
      const userPrefs = preferencesByRace?.[race.raceNumber]?.[punter] || [];
      const validCount = Math.min(required, userPrefs.length);
      filledSlots += validCount;

      if (!isUserPreferencesCompleteForRace(race, userPrefs)) {
        missing.push({
          raceNumber: race.raceNumber,
          punter,
          count: validCount,
          required,
        });
      }
    }
  }

  const isComplete = missing.length === 0;
  const percentage = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 100;

  return {
    isComplete,
    totalRequired: totalSlots,
    totalCompleted: filledSlots,
    percentage,
    missing,
  };
}

/**
 * Checks all preferences completion for a meeting, checking partitioned userPreferencesByMeeting first.
 */
export function checkMeetingPreferencesCompletion(
  meeting: RaceMeeting,
  participants: string[],
  tournament: CupTournamentState
): {
  isComplete: boolean;
  totalRequired: number;
  totalCompleted: number;
  percentage: number;
  missing: Array<{ raceNumber: number; punter: string; count: number; required: number }>;
} {
  const prefs =
    tournament.userPreferencesByMeeting?.[meeting.id] ||
    (tournament.meetingId === meeting.id ? tournament.userPreferencesByRace : undefined);
  return checkAllPreferencesCompletion(meeting, participants, prefs);
}

/**
 * Computes the complete ordered sequence of draft turns across all races for a single meeting.
 */
export function getAllDraftStepsList(
  meeting: RaceMeeting,
  participants: string[],
  draftType: "snake" | "fixed" = "snake"
): Array<{ raceNumber: number; punterName: string; stepNumber: number }> {
  const steps: Array<{ raceNumber: number; punterName: string; stepNumber: number }> = [];
  let stepNumber = 1;

  const sortedRaces = [...meeting.races].sort((a, b) => a.raceNumber - b.raceNumber);
  for (const race of sortedRaces) {
    const order = getDraftOrderForRace(race.raceNumber, participants, draftType);
    for (const punterName of order) {
      steps.push({
        raceNumber: race.raceNumber,
        punterName,
        stepNumber: stepNumber++,
      });
    }
  }
  return steps;
}

export interface SequentialDraftStepItem {
  meetingId: string;
  meetingVenue: string;
  raceNumber: number;
  punterName: string;
  stepNumber: number;
}

/**
 * Computes the complete ordered sequence of draft turns across MULTIPLE meetings sequentially
 * (e.g. Melbourne card R1..R10 first, then Sydney card R1..R10).
 */
export function getAllSequentialDraftStepsList(
  meetings: RaceMeeting[],
  participants: string[],
  draftType: "snake" | "fixed" = "snake"
): SequentialDraftStepItem[] {
  const steps: SequentialDraftStepItem[] = [];
  let stepNumber = 1;

  for (const meeting of meetings) {
    const sortedRaces = [...meeting.races].sort((a, b) => a.raceNumber - b.raceNumber);
    for (const race of sortedRaces) {
      const order = getDraftOrderForRace(race.raceNumber, participants, draftType);
      for (const punterName of order) {
        steps.push({
          meetingId: meeting.id,
          meetingVenue: meeting.venue,
          raceNumber: race.raceNumber,
          punterName,
          stepNumber: stepNumber++,
        });
      }
    }
  }
  return steps;
}

/**
 * Resolves exactly one draft step in order using the user's 8-horse preference rankings with priority fallback.
 */
export function resolveNextDraftStep(
  tournament: CupTournamentState,
  meeting: RaceMeeting
): {
  tournament: CupTournamentState;
  callout: string;
  stepFinished: boolean;
  tournamentFinished: boolean;
} {
  const allSteps = getAllDraftStepsList(meeting, tournament.participants, tournament.draftType);
  if (allSteps.length === 0) {
    return {
      tournament,
      callout: "No draft steps available.",
      stepFinished: false,
      tournamentFinished: true,
    };
  }

  // Use meeting-specific selections or fallback
  const meetingSelections: Record<number, Record<string, number>> = {};
  const currentMeetingMap =
    tournament.selectionsByMeeting?.[meeting.id] ||
    (tournament.meetingId === meeting.id ? tournament.selectionsByRace : {}) ||
    {};

  for (const [rStr, picks] of Object.entries(currentMeetingMap)) {
    meetingSelections[Number(rStr)] = { ...picks };
  }

  const meetingResDetails: Record<number, Record<string, any>> = {};
  const existingRes =
    tournament.draftResolutionDetailsByMeeting?.[meeting.id] ||
    (tournament.meetingId === meeting.id ? tournament.draftResolutionDetails : {}) ||
    {};
  for (const [rStr, details] of Object.entries(existingRes)) {
    meetingResDetails[Number(rStr)] = { ...details };
  }

  // Find the first step that has not been drafted yet
  const nextStep = allSteps.find(
    (step) => meetingSelections[step.raceNumber]?.[step.punterName] === undefined
  );

  if (!nextStep) {
    return {
      tournament: {
        ...tournament,
        draftStepCursor: {
          meetingId: meeting.id,
          meetingVenue: meeting.venue,
          raceNumber: allSteps[allSteps.length - 1].raceNumber,
          punterName: allSteps[allSteps.length - 1].punterName,
          stepIndex: allSteps.length,
          totalSteps: allSteps.length,
          isComplete: true,
        },
        lastDraftStepCallout: `🎉 All draft picks for ${meeting.venue} are fully resolved!`,
        updatedAt: new Date().toISOString(),
      },
      callout: `🎉 All draft picks for ${meeting.venue} are fully resolved!`,
      stepFinished: true,
      tournamentFinished: true,
    };
  }

  const { raceNumber, punterName, stepNumber } = nextStep;
  const race = meeting.races.find((r) => r.raceNumber === raceNumber);
  if (!race) {
    return { tournament, callout: `Race ${raceNumber} not found.`, stepFinished: false, tournamentFinished: false };
  }

  const currentRacePicks = { ...(meetingSelections[raceNumber] || {}) };
  const takenTabs = new Set(Object.values(currentRacePicks));

  // Retrieve punter's 8-horse ranked preferences for this meeting & race
  const preferences =
    tournament.userPreferencesByMeeting?.[meeting.id]?.[raceNumber]?.[punterName] ||
    (tournament.meetingId === meeting.id
      ? tournament.userPreferencesByRace?.[raceNumber]?.[punterName]
      : []) ||
    [];

  // Pick the highest preference that is not yet taken
  let pickedTabNumber: number | null = null;
  let preferenceRankUsed = 1;
  let wasFallback = false;
  let originallyWantedTab: number | undefined = preferences[0];
  let originallyTakenBy: string | undefined;

  for (let i = 0; i < preferences.length; i++) {
    const candidateTab = preferences[i];
    if (!takenTabs.has(candidateTab)) {
      pickedTabNumber = candidateTab;
      preferenceRankUsed = i + 1;
      wasFallback = i > 0;
      break;
    }
  }

  // If originally wanted was taken, record who took it
  if (wasFallback && originallyWantedTab) {
    for (const [otherPunter, tab] of Object.entries(currentRacePicks)) {
      if (tab === originallyWantedTab) {
        originallyTakenBy = otherPunter;
        break;
      }
    }
  }

  // Fallback to any remaining active runner if preferences were somehow exhausted
  if (pickedTabNumber === null) {
    const activeRunners = race.runners
      .filter((r) => !r.isScratched)
      .sort((a, b) => a.tabNumber - b.tabNumber);
    const available = activeRunners.find((r) => !takenTabs.has(r.tabNumber));
    if (available) {
      pickedTabNumber = available.tabNumber;
      preferenceRankUsed = preferences.length + 1;
      wasFallback = true;
    }
  }

  if (pickedTabNumber === null) {
    return {
      tournament,
      callout: `No available runners left in Race ${raceNumber} for ${punterName}.`,
      stepFinished: false,
      tournamentFinished: false,
    };
  }

  // Update picks
  currentRacePicks[punterName] = pickedTabNumber;
  meetingSelections[raceNumber] = currentRacePicks;

  // Record resolution detail
  if (!meetingResDetails[raceNumber]) {
    meetingResDetails[raceNumber] = {};
  }
  meetingResDetails[raceNumber][punterName] = {
    tabNumber: pickedTabNumber,
    preferenceRankUsed,
    wasFallback,
    originallyWantedTab,
    originallyTakenBy,
  };

  const runnerObj = race.runners.find((r) => r.tabNumber === pickedTabNumber);
  const horseLabel = runnerObj ? runnerObj.horseName : `Runner #${pickedTabNumber}`;

  let callout = "";
  if (!wasFallback) {
    callout = `🎯 Turn ${stepNumber}/${allSteps.length}: ${punterName} drafted #${pickedTabNumber} ${horseLabel} (1st Preference) in ${meeting.venue} R${raceNumber}`;
  } else {
    const takenNote = originallyTakenBy ? ` (1st choice #${originallyWantedTab} was drafted by ${originallyTakenBy})` : "";
    callout = `⚡️ Turn ${stepNumber}/${allSteps.length}: ${punterName} fell back to #${preferenceRankUsed} Preference: #${pickedTabNumber} ${horseLabel} in ${meeting.venue} R${raceNumber}${takenNote}`;
  }

  const isTournamentFinished = stepNumber >= allSteps.length;

  const nextSelectionsByMeeting = {
    ...(tournament.selectionsByMeeting || {}),
    [meeting.id]: meetingSelections,
  };

  const nextResDetailsByMeeting = {
    ...(tournament.draftResolutionDetailsByMeeting || {}),
    [meeting.id]: meetingResDetails,
  };

  const updatedTournament: CupTournamentState = {
    ...tournament,
    selectionsByMeeting: nextSelectionsByMeeting,
    draftResolutionDetailsByMeeting: nextResDetailsByMeeting,
    selectionsByRace:
      tournament.meetingId === meeting.id ? meetingSelections : tournament.selectionsByRace,
    draftResolutionDetails:
      tournament.meetingId === meeting.id ? meetingResDetails : tournament.draftResolutionDetails,
    activeRaceNumber: raceNumber,
    draftStepCursor: {
      meetingId: meeting.id,
      meetingVenue: meeting.venue,
      raceNumber,
      punterName,
      stepIndex: stepNumber,
      totalSteps: allSteps.length,
      isComplete: isTournamentFinished,
    },
    lastDraftStepCallout: callout,
    updatedAt: new Date().toISOString(),
  };

  return {
    tournament: updatedTournament,
    callout,
    stepFinished: true,
    tournamentFinished: isTournamentFinished,
  };
}

/**
 * Resolves all draft steps instantly for a single meeting.
 */
export function resolveAllDraftSteps(
  tournament: CupTournamentState,
  meeting: RaceMeeting
): CupTournamentState {
  let current = tournament;
  const maxIterations = 200;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;
    const result = resolveNextDraftStep(current, meeting);
    current = result.tournament;
    if (result.tournamentFinished || !result.stepFinished) {
      break;
    }
  }
  return current;
}

/**
 * Resolves exactly one draft step in order across MULTIPLE sequential meetings
 * (e.g. Melbourne card R1..R10 first, then Sydney card R1..R10).
 */
export function resolveNextSequentialDraftStep(
  tournament: CupTournamentState,
  meetings: RaceMeeting[]
): {
  tournament: CupTournamentState;
  callout: string;
  stepFinished: boolean;
  tournamentFinished: boolean;
  activeStep?: SequentialDraftStepItem;
} {
  const allSteps = getAllSequentialDraftStepsList(meetings, tournament.participants, tournament.draftType);
  if (allSteps.length === 0) {
    return {
      tournament,
      callout: "No draft steps available across meetings.",
      stepFinished: false,
      tournamentFinished: true,
    };
  }

  // Find the first step across all meetings that has not been drafted yet
  const nextStep = allSteps.find((step) => {
    const meetingPicks =
      tournament.selectionsByMeeting?.[step.meetingId] ||
      (tournament.meetingId === step.meetingId ? tournament.selectionsByRace : {}) ||
      {};
    return meetingPicks[step.raceNumber]?.[step.punterName] === undefined;
  });

  if (!nextStep) {
    const lastStep = allSteps[allSteps.length - 1];
    return {
      tournament: {
        ...tournament,
        draftStepCursor: {
          meetingId: lastStep.meetingId,
          meetingVenue: lastStep.meetingVenue,
          raceNumber: lastStep.raceNumber,
          punterName: lastStep.punterName,
          stepIndex: allSteps.length,
          totalSteps: allSteps.length,
          isComplete: true,
        },
        lastDraftStepCallout: "🎉 All draft picks across Melbourne & Sydney cards are fully resolved!",
        updatedAt: new Date().toISOString(),
      },
      callout: "🎉 All draft picks across Melbourne & Sydney cards are fully resolved!",
      stepFinished: true,
      tournamentFinished: true,
    };
  }

  const targetMeeting = meetings.find((m) => m.id === nextStep.meetingId);
  if (!targetMeeting) {
    return {
      tournament,
      callout: `Meeting ${nextStep.meetingVenue} not found.`,
      stepFinished: false,
      tournamentFinished: false,
    };
  }

  // Delegate resolution of this meeting's step using resolveNextDraftStep
  const singleResult = resolveNextDraftStep(tournament, targetMeeting);
  const updatedTournament = {
    ...singleResult.tournament,
    draftStepCursor: {
      meetingId: nextStep.meetingId,
      meetingVenue: nextStep.meetingVenue,
      raceNumber: nextStep.raceNumber,
      punterName: nextStep.punterName,
      stepIndex: nextStep.stepNumber,
      totalSteps: allSteps.length,
      isComplete: nextStep.stepNumber >= allSteps.length,
    },
  };

  return {
    tournament: updatedTournament,
    callout: singleResult.callout,
    stepFinished: singleResult.stepFinished,
    tournamentFinished: nextStep.stepNumber >= allSteps.length,
    activeStep: nextStep,
  };
}

/**
 * Resolves all draft steps across MULTIPLE sequential meetings (Melbourne then Sydney).
 */
export function resolveAllSequentialDraftSteps(
  tournament: CupTournamentState,
  meetings: RaceMeeting[]
): CupTournamentState {
  let current = tournament;
  const maxIterations = 400;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;
    const result = resolveNextSequentialDraftStep(current, meetings);
    current = result.tournament;
    if (result.tournamentFinished || !result.stepFinished) {
      break;
    }
  }
  return current;
}

/**
 * Resets drafted runner assignments while preserving user 8-horse preference rankings.
 */
export function resetDraftSelectionsKeepPreferences(
  tournament: CupTournamentState
): CupTournamentState {
  return {
    ...tournament,
    selectionsByRace: {},
    selectionsByMeeting: {},
    draftResolutionDetails: {},
    draftResolutionDetailsByMeeting: {},
    draftStepCursor: undefined,
    lastDraftStepCallout: undefined,
    activeRaceNumber: 1,
    activeDraftIndex: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Resolves or retrieves the allocated pick for a punter in a race when Cup Mode is active.
 * Uses the drafted pick if already resolved, or simulates the deterministic draft
 * using the punter's 8-horse ranked preferences. If a preference was taken by an earlier
 * drafter, the punter falls back to their next available preference.
 */
export function getAllocatedPickForPunterAndRace(
  meeting: RaceMeeting,
  raceNumber: number,
  punterName: string,
  tournament: CupTournamentState,
  punters: PunterProfile[] = []
): CupAllocatedPickInfo | null {
  // 1. Direct check: Already drafted in multi-meeting selections map
  const mtgPicks = tournament.selectionsByMeeting?.[meeting.id]?.[raceNumber];
  if (mtgPicks && mtgPicks[punterName] !== undefined) {
    const tabNumber = mtgPicks[punterName];
    const detail = tournament.draftResolutionDetailsByMeeting?.[meeting.id]?.[raceNumber]?.[punterName];
    return {
      tabNumber,
      preferenceRankUsed: detail?.preferenceRankUsed || 1,
      wasFallback: detail?.wasFallback || false,
      originallyWantedTab: detail?.originallyWantedTab,
      originallyTakenBy: detail?.originallyTakenBy,
    };
  }

  // 2. Direct check: Active meeting selectionsByRace
  if (
    tournament.meetingId === meeting.id &&
    tournament.selectionsByRace?.[raceNumber]?.[punterName] !== undefined
  ) {
    const tabNumber = tournament.selectionsByRace[raceNumber][punterName];
    const detail = tournament.draftResolutionDetails?.[raceNumber]?.[punterName];
    return {
      tabNumber,
      preferenceRankUsed: detail?.preferenceRankUsed || 1,
      wasFallback: detail?.wasFallback || false,
      originallyWantedTab: detail?.originallyWantedTab,
      originallyTakenBy: detail?.originallyTakenBy,
    };
  }

  // 3. Simulated Draft Resolution: If preferences exist but pick has not been finalized yet
  const participants =
    tournament.participants && tournament.participants.length > 0
      ? tournament.participants
      : punters.map((p) => p.name);

  const draftOrder = getDraftOrderForRace(raceNumber, participants, tournament.draftType);
  const takenRunners = new Map<number, string>(); // tabNumber -> drafterName

  let allocatedResult: CupAllocatedPickInfo | null = null;

  for (const drafter of draftOrder) {
    // Get ordered preference rankings for this drafter
    let prefs: number[] =
      tournament.userPreferencesByMeeting?.[meeting.id]?.[raceNumber]?.[drafter] ||
      (tournament.meetingId === meeting.id
        ? tournament.userPreferencesByRace?.[raceNumber]?.[drafter]
        : undefined) ||
      [];

    // Fallback: If no 8-rank list entered yet, check their standard selections
    if (prefs.length === 0) {
      const stdP = punters.find((p) => p.name.trim().toLowerCase() === drafter.trim().toLowerCase());
      const stdTrio = stdP?.selectionsByMeeting?.[meeting.id]?.[raceNumber];
      if (stdTrio) {
        prefs = [stdTrio.firstPref, stdTrio.secondPref, stdTrio.thirdPref].filter(
          (t): t is number => t !== null && t !== undefined && t > 0
        );
      }
    }

    if (prefs.length === 0) continue;

    // First available candidate not already taken
    const candidateTab = prefs.find((t) => !takenRunners.has(t));
    if (candidateTab !== undefined) {
      const rankUsed = prefs.indexOf(candidateTab) + 1;
      const wasFallback = rankUsed > 1;
      const originallyWanted = prefs[0];
      const takenBy = wasFallback ? takenRunners.get(originallyWanted) : undefined;

      takenRunners.set(candidateTab, drafter);

      if (drafter.trim().toLowerCase() === punterName.trim().toLowerCase()) {
        allocatedResult = {
          tabNumber: candidateTab,
          preferenceRankUsed: rankUsed,
          wasFallback,
          originallyWantedTab: originallyWanted,
          originallyTakenBy: takenBy,
        };
      }
    }
  }

  if (allocatedResult) {
    return allocatedResult;
  }

  // 4. Fallback to standard selections if no draft allocation resolved
  const stdPunter = punters.find((p) => p.name.trim().toLowerCase() === punterName.trim().toLowerCase());
  const stdTrio = stdPunter?.selectionsByMeeting?.[meeting.id]?.[raceNumber];
  if (stdTrio && stdTrio.firstPref) {
    return {
      tabNumber: stdTrio.firstPref,
      preferenceRankUsed: 1,
      wasFallback: false,
    };
  }

  return null;
}

/**
 * Transforms the syndicate punter profiles for exotic evaluations (Trifectas and Quaddies) when Cup Mode is active.
 * Replaces the multi-preference trio in each race with the single allocated runner
 * derived from the discrete priority draft (enforcing mutual exclusivity across users).
 */
export function getEffectiveCupPuntersForExotics(
  punters: PunterProfile[],
  tournament: CupTournamentState,
  meetings: RaceMeeting[]
): PunterProfile[] {
  if (!tournament || !tournament.isActive) {
    return punters;
  }

  const nowIso = tournament.updatedAt || new Date().toISOString();

  return punters.map((punter) => {
    const updatedSelectionsByMeeting: Record<string, Record<number, RaceSelectionTrio>> = {
      ...(punter.selectionsByMeeting || {}),
    };
    const cupAllocationsByMeeting: Record<string, Record<number, CupAllocatedPickInfo>> = {};

    for (const meeting of meetings) {
      const meetingPicks: Record<number, RaceSelectionTrio> = {
        ...(updatedSelectionsByMeeting[meeting.id] || {}),
      };
      const meetingAllocations: Record<number, CupAllocatedPickInfo> = {};
      let hasAllocations = false;

      for (const race of meeting.races) {
        const allocated = getAllocatedPickForPunterAndRace(
          meeting,
          race.raceNumber,
          punter.name,
          tournament,
          punters
        );

        if (allocated) {
          hasAllocations = true;
          meetingPicks[race.raceNumber] = {
            firstPref: allocated.tabNumber,
            secondPref: null,
            thirdPref: null,
            updatedAt: nowIso,
          };
          meetingAllocations[race.raceNumber] = allocated;
        }
      }

      if (hasAllocations) {
        updatedSelectionsByMeeting[meeting.id] = meetingPicks;
        cupAllocationsByMeeting[meeting.id] = meetingAllocations;
      }
    }

    return {
      ...punter,
      selectionsByMeeting: updatedSelectionsByMeeting,
      cupAllocationsByMeeting,
    };
  });
}


