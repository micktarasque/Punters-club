/**
 * Pure read/write helpers for the Cup workspace.
 *
 * Cup state stores data per meeting (`...ByMeeting`) and mirrors the active
 * meeting into legacy flat fields (`selectionsByRace`, `userPreferencesByRace`).
 * Every screen goes through these helpers so that rule lives in one place.
 */
import type {
  CupAllocatedPickInfo,
  CupSyndicateTrifectaOutcome,
  CupTournamentState,
  CupUserLeaderboardEntry,
} from "../../types/cupMode";
import type { RaceEvent, RaceMeeting, RaceRunner } from "../../types/racing";
import { isRaceOfficialOrCompleted } from "../../data/seedNswTab";
import {
  calculateCupLeaderboard,
  calculateCupTrifectaOutcomes,
  getAllSequentialDraftStepsList,
  getRequiredRankCountForRace,
  isUserPreferencesCompleteForRace,
  type SequentialDraftStepItem,
} from "../../utils/cupMode";

export type CupView = "overview" | "rank" | "draft" | "standings" | "rules";

export type CupStage = "ranking" | "drafting" | "racing" | "complete";

type PrefsByRace = Record<number, Record<string, number[]>>;
type PicksByRace = Record<number, Record<string, number>>;
type DetailsByRace = Record<number, Record<string, CupAllocatedPickInfo>>;

/**
 * Melbourne Cup day: the first Tuesday in November. Returns this year's date,
 * or next year's once this year's Cup day has passed.
 */
export function getMelbourneCupDate(todayIso: string): string {
  const year = Number(todayIso.slice(0, 4));
  const cupFor = (y: number) => {
    const nov1 = new Date(Date.UTC(y, 10, 1));
    const offset = (2 - nov1.getUTCDay() + 7) % 7; // 2 = Tuesday
    return `${y}-11-${String(1 + offset).padStart(2, "0")}`;
  };
  const thisYear = cupFor(year);
  return todayIso <= thisYear ? thisYear : cupFor(year + 1);
}

const SYDNEY_METRO = ["randwick", "rosehill", "canterbury", "warwick farm"];

export interface CupDayCards {
  flemington: RaceMeeting | null;
  sydney: RaceMeeting | null;
  /** Draft order: Flemington first, then Sydney. */
  list: RaceMeeting[];
}

/** Only Cup day's Flemington card and that day's Sydney card. Nothing else. */
export function getCupDayCards(allMeetings: RaceMeeting[], cupDate: string): CupDayCards {
  const sameDay = allMeetings.filter((m) => m.date === cupDate);
  const flemington = sameDay.find((m) => m.venue.toLowerCase().includes("flemington")) || null;
  const nsw = sameDay.filter((m) => m.state === "NSW");
  const sydney =
    nsw.find((m) => SYDNEY_METRO.some((v) => m.venue.toLowerCase().includes(v))) ||
    nsw.find((m) => m.tier === "Metro" || m.tier === "Metropolitan") ||
    null;
  const list = [flemington, sydney].filter((m): m is RaceMeeting => !!m);
  return { flemington, sydney, list };
}

/** The Melbourne Cup race on the Flemington card, if the card is loaded. */
export function findMelbourneCupRace(meeting: RaceMeeting | null): RaceEvent | null {
  if (!meeting) return null;
  return (
    meeting.races.find((r) => /melbourne cup/i.test(r.raceName) && !/carnival|qualif/i.test(r.raceName)) || null
  );
}

export function daysUntil(todayIso: string, targetIso: string): number {
  const a = Date.parse(`${todayIso}T00:00:00Z`);
  const b = Date.parse(`${targetIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function getMeetingPrefs(t: CupTournamentState, meetingId: string): PrefsByRace {
  return (
    t.userPreferencesByMeeting?.[meetingId] ||
    (t.meetingId === meetingId ? t.userPreferencesByRace : undefined) ||
    {}
  );
}

export function getMeetingPicks(t: CupTournamentState, meetingId: string): PicksByRace {
  return (
    t.selectionsByMeeting?.[meetingId] ||
    (t.meetingId === meetingId ? t.selectionsByRace : undefined) ||
    {}
  );
}

export function getMeetingDetails(t: CupTournamentState, meetingId: string): DetailsByRace {
  return (
    t.draftResolutionDetailsByMeeting?.[meetingId] ||
    (t.meetingId === meetingId ? t.draftResolutionDetails : undefined) ||
    {}
  );
}

export function getRanking(t: CupTournamentState, meetingId: string, raceNo: number, member: string): number[] {
  return getMeetingPrefs(t, meetingId)[raceNo]?.[member] || [];
}

/** Returns a new state with one member's ranking for one race replaced. */
export function setRanking(
  t: CupTournamentState,
  meetingId: string,
  raceNo: number,
  member: string,
  ranking: number[]
): CupTournamentState {
  const meetingPrefs: PrefsByRace = { ...getMeetingPrefs(t, meetingId) };
  meetingPrefs[raceNo] = { ...(meetingPrefs[raceNo] || {}), [member]: ranking };
  return {
    ...t,
    userPreferencesByMeeting: { ...(t.userPreferencesByMeeting || {}), [meetingId]: meetingPrefs },
    userPreferencesByRace: t.meetingId === meetingId ? meetingPrefs : t.userPreferencesByRace,
    updatedAt: new Date().toISOString(),
  };
}

/** Active (non-scratched) runners, shortest odds first. */
export function runnersByOdds(race: RaceEvent): RaceRunner[] {
  const price = (r: RaceRunner) => (r.fixedWin > 1 ? r.fixedWin : r.nswTabWin || 999);
  return race.runners.filter((r) => !r.isScratched).sort((a, b) => price(a) - price(b));
}

export function fillRankingByOdds(race: RaceEvent, current: number[]): number[] {
  const required = getRequiredRankCountForRace(race);
  const extra = runnersByOdds(race)
    .map((r) => r.tabNumber)
    .filter((tab) => !current.includes(tab));
  return [...current, ...extra].slice(0, required);
}

export interface RankingProgress {
  done: number;
  total: number;
}

export function memberRankingProgress(
  t: CupTournamentState,
  meetings: RaceMeeting[],
  member: string
): RankingProgress {
  let done = 0;
  let total = 0;
  for (const m of meetings) {
    const prefs = getMeetingPrefs(t, m.id);
    for (const race of m.races) {
      total += 1;
      if (isUserPreferencesCompleteForRace(race, prefs[race.raceNumber]?.[member])) done += 1;
    }
  }
  return { done, total };
}

export function isRaceRankedBy(t: CupTournamentState, meetingId: string, race: RaceEvent, member: string): boolean {
  return isUserPreferencesCompleteForRace(race, getRanking(t, meetingId, race.raceNumber, member));
}

export interface DraftProgress {
  done: number;
  total: number;
  next: SequentialDraftStepItem | null;
  steps: SequentialDraftStepItem[];
}

export function getDraftProgress(t: CupTournamentState, meetings: RaceMeeting[]): DraftProgress {
  const steps = getAllSequentialDraftStepsList(meetings, t.participants, t.draftType);
  let done = 0;
  let next: SequentialDraftStepItem | null = null;
  for (const step of steps) {
    const picked = getMeetingPicks(t, step.meetingId)[step.raceNumber]?.[step.punterName] !== undefined;
    if (picked) done += 1;
    else if (!next) next = step;
  }
  return { done, total: steps.length, next, steps };
}

export function getResultsProgress(meetings: RaceMeeting[]): RankingProgress {
  let done = 0;
  let total = 0;
  for (const m of meetings) {
    for (const r of m.races) {
      total += 1;
      if (isRaceOfficialOrCompleted(r, m.date)) done += 1;
    }
  }
  return { done, total };
}

export function getCupStage(t: CupTournamentState, meetings: RaceMeeting[]): CupStage {
  const draft = getDraftProgress(t, meetings);
  const results = getResultsProgress(meetings);
  if (draft.total > 0 && draft.done >= draft.total) {
    return results.total > 0 && results.done >= results.total ? "complete" : "racing";
  }
  const allRanked = t.participants.every((p) => {
    const prog = memberRankingProgress(t, meetings, p);
    return prog.total > 0 && prog.done >= prog.total;
  });
  return allRanked || draft.done > 0 ? "drafting" : "ranking";
}

export const STAGE_LABEL: Record<CupStage, string> = {
  ranking: "Rankings open",
  drafting: "Draft in progress",
  racing: "Racing",
  complete: "Final",
};

/** Leaderboard for a single meeting, reading that meeting's drafted picks. */
export function meetingLeaderboard(t: CupTournamentState, meeting: RaceMeeting): CupUserLeaderboardEntry[] {
  return calculateCupLeaderboard({ ...t, selectionsByRace: getMeetingPicks(t, meeting.id) }, meeting);
}

/** Combines per-meeting leaderboards into one ranked table. */
export function combinedLeaderboard(t: CupTournamentState, meetings: RaceMeeting[]): CupUserLeaderboardEntry[] {
  const byMember = new Map<string, CupUserLeaderboardEntry>();
  for (const m of meetings) {
    for (const e of meetingLeaderboard(t, m)) {
      const acc = byMember.get(e.punterName);
      if (!acc) {
        byMember.set(e.punterName, { ...e, raceOutcomes: [...e.raceOutcomes] });
        continue;
      }
      acc.totalPicks += e.totalPicks;
      acc.winCount += e.winCount;
      acc.placeCount += e.placeCount;
      acc.totalPoints += e.totalPoints;
      acc.totalDollarReturn = round2(acc.totalDollarReturn + e.totalDollarReturn);
      acc.totalOutlay = round2(acc.totalOutlay + e.totalOutlay);
      acc.netProfit = round2(acc.netProfit + e.netProfit);
      acc.raceOutcomes.push(...e.raceOutcomes);
    }
  }
  const list = [...byMember.values()].map((e) => ({
    ...e,
    strikeRatePct: e.totalPicks > 0 ? Math.round((e.winCount / e.totalPicks) * 100) : 0,
  }));
  list.sort((a, b) => b.totalPoints - a.totalPoints || b.netProfit - a.netProfit);
  list.forEach((e, i) => (e.rank = i + 1));
  return list;
}

export function meetingTrifectas(
  t: CupTournamentState,
  meeting: RaceMeeting,
  stake: number
): CupSyndicateTrifectaOutcome[] {
  return calculateCupTrifectaOutcomes({ ...t, selectionsByRace: getMeetingPicks(t, meeting.id) }, meeting, stake);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatMoney(n: number, signed = false): string {
  const abs = Math.abs(n).toFixed(2);
  if (!signed) return `$${abs}`;
  if (n > 0) return `+$${abs}`;
  if (n < 0) return `−$${abs}`;
  return "$0.00";
}

/** Draft callouts from the engine carry emoji; the workspace shows plain text. */
export function cleanCallout(text?: string): string {
  return (text || "").replace(/[\p{Extended_Pictographic}️]/gu, "").trim();
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
