import { inflateSync, strFromU8 } from "fflate";
import { SEED_PAYLOAD_B64 } from "./chunks/compressedSeedPayload.ts";
import type {
  RaceEvent,
  RaceMeeting,
  RaceRunner,
  PunterProfile,
  ExoticDividend,
} from "../types/racing.ts";

/**
 * Helper to get current Australian Eastern Time (AEST/AEDT - Australia/Sydney) date in YYYY-MM-DD format
 */
export function getCurrentAustralianDateIso(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value?.padStart(2, "0");
    const d = parts.find((p) => p.type === "day")?.value?.padStart(2, "0");
    if (y && m && d && /^\d{4}-\d{2}-\d{2}$/.test(`${y}-${m}-${d}`)) {
      return `${y}-${m}-${d}`;
    }
  } catch {
    // Fallback below
  }
  const now = new Date();
  const month = now.getUTCMonth();
  const offsetHours = month >= 9 || month <= 2 ? 11 : 10;
  const sydTime = new Date(now.getTime() + offsetHours * 60 * 60 * 1000);
  return sydTime.toISOString().slice(0, 10);
}

/**
 * Normalizes any date string (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, ISO timestamp, etc.)
 * into canonical YYYY-MM-DD calibrated to Australia/Sydney time.
 */
export function normalizeAustralianDateIso(rawDate?: string | null): string {
  if (!rawDate || typeof rawDate !== "string") {
    return getCurrentAustralianDateIso();
  }
  const trimmed = rawDate.trim();
  if (!trimmed) return getCurrentAustralianDateIso();

  const exactIso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (exactIso) {
    return `${exactIso[1]}-${exactIso[2].padStart(2, "0")}-${exactIso[3].padStart(2, "0")}`;
  }

  const slashYmd = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashYmd) {
    return `${slashYmd[1]}-${slashYmd[2].padStart(2, "0")}-${slashYmd[3].padStart(2, "0")}`;
  }

  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`;
  }

  if (trimmed.includes("T") || trimmed.includes(":")) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      try {
        const parts = new Intl.DateTimeFormat("en-AU", {
          timeZone: "Australia/Sydney",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(parsed);
        const y = parts.find((p) => p.type === "year")?.value;
        const m = parts.find((p) => p.type === "month")?.value?.padStart(2, "0");
        const d = parts.find((p) => p.type === "day")?.value?.padStart(2, "0");
        if (y && m && d) return `${y}-${m}-${d}`;
      } catch {
        return trimmed.split("T")[0];
      }
    }
  }

  const prefixMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (prefixMatch) return prefixMatch[1];

  return getCurrentAustralianDateIso();
}

/**
 * Adds or subtracts days from a YYYY-MM-DD date string safely in calendar days
 */
export function offsetAustralianDateIso(baseIso: string, deltaDays: number): string {
  const clean = normalizeAustralianDateIso(baseIso);
  const [y, m, d] = clean.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

/**
 * Returns live calibrated Sydney clock details for header/calendar display
 */
export function getCurrentSydneyClock(now: Date = new Date()): {
  dateIso: string;
  timeStr: string;
  shortDateStr: string;
  tzAbbr: string;
} {
  const dateIso = getCurrentAustralianDateIso();
  try {
    const timeStr = now
      .toLocaleTimeString("en-AU", {
        timeZone: "Australia/Sydney",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
      .toUpperCase();
    const shortDateStr = now.toLocaleDateString("en-AU", {
      timeZone: "Australia/Sydney",
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const tzParts = new Intl.DateTimeFormat("en-AU", {
      timeZone: "Australia/Sydney",
      timeZoneName: "short",
    }).formatToParts(now);
    const tzAbbr = tzParts.find((p) => p.type === "timeZoneName")?.value || "AEDT";
    return { dateIso, timeStr, shortDateStr, tzAbbr };
  } catch {
    return {
      dateIso,
      timeStr: now.toTimeString().slice(0, 8),
      shortDateStr: dateIso,
      tzAbbr: "AEDT",
    };
  }
}

// Calibrated to live Sydney date (Australia/Sydney)
export const REFERENCE_TODAY_ISO = getCurrentAustralianDateIso();
export const INITIAL_RACE_DATE = getCurrentAustralianDateIso();
export const INITIAL_START_DATE = offsetAustralianDateIso(INITIAL_RACE_DATE, -2);
export const MAX_DAYS_AHEAD = 5;

export function getMaxAllowedDateIso(
  baseDateIso: string = getCurrentAustralianDateIso()
): string {
  const clean = normalizeAustralianDateIso(baseDateIso);
  const d = new Date(`${clean}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "2026-10-17";
  d.setUTCDate(d.getUTCDate() + MAX_DAYS_AHEAD);
  return d.toISOString().slice(0, 10);
}

export function isDateBeyond5DaysAhead(
  dateIso: string,
  baseDateIso: string = getCurrentAustralianDateIso()
): boolean {
  const norm = normalizeAustralianDateIso(dateIso);
  const maxIso = getMaxAllowedDateIso(baseDateIso);
  return norm > maxIso;
}

export function clampDateRangeTo5Days(
  startDate: string,
  endDate: string,
  baseDateIso: string = getCurrentAustralianDateIso()
): { startDate: string; endDate: string; wasClamped: boolean; maxAllowedDate: string } {
  const maxAllowedDate = getMaxAllowedDateIso(baseDateIso);
  let clampedStart = normalizeAustralianDateIso(startDate);
  let clampedEnd = normalizeAustralianDateIso(endDate || startDate);
  let wasClamped = false;

  if (clampedStart > maxAllowedDate) {
    clampedStart = maxAllowedDate;
    wasClamped = true;
  }
  if (clampedEnd > maxAllowedDate) {
    clampedEnd = maxAllowedDate;
    wasClamped = true;
  }
  if (clampedEnd < clampedStart) {
    clampedEnd = clampedStart;
  }
  return { startDate: clampedStart, endDate: clampedEnd, wasClamped, maxAllowedDate };
}

export function isMainMetroVenue(venue: string, _meetingCode?: string): boolean {
  const v = (venue || "").toLowerCase();
  return (
    v.includes("flemington") ||
    v.includes("randwick") ||
    v.includes("caulfield") ||
    v.includes("rosehill") ||
    v.includes("moonee valley") ||
    v.includes("sandown") ||
    v.includes("warwick farm") ||
    v.includes("canterbury") ||
    v.includes("eagle farm") ||
    v.includes("doomben") ||
    v.includes("morphettville") ||
    v.includes("ascot")
  );
}

export function getMetroPriorityScore(meeting: RaceMeeting): number {
  const v = (meeting.venue || "").toLowerCase();
  const s = (meeting.state || "").toUpperCase();
  if (v.includes("caulfield") || v.includes("flemington")) return 1;
  if (v.includes("rosehill") || (v.includes("randwick") && !v.includes("kensington"))) return 2;
  if (v.includes("moonee valley") || v.includes("sandown")) return 3;
  if (
    v.includes("randwick-kensington") ||
    v.includes("warwick farm") ||
    v.includes("canterbury")
  )
    return 4;
  if (v.includes("eagle farm") || v.includes("doomben")) return 5;
  if (v.includes("morphettville")) return 6;
  if (v.includes("ascot")) return 7;
  if (meeting.tier === "Metropolitan") return 8;
  if (s === "VIC") return 10;
  if (s === "NSW" || s === "ACT") return 11;
  if (meeting.tier === "Provincial") return 14;
  return 20;
}

export function sortMeetingsByMetroPriority(meetings: RaceMeeting[]): RaceMeeting[] {
  return [...meetings].sort((a, b) => {
    const scoreDiff = getMetroPriorityScore(a) - getMetroPriorityScore(b);
    if (scoreDiff !== 0) return scoreDiff;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.venue.localeCompare(b.venue);
  });
}

export function getSydneyAndMelbourneMeetings(meetings: RaceMeeting[]): {
  sydneyMeeting: RaceMeeting | null;
  melbourneMeeting: RaceMeeting | null;
  combinedRequiredMeetings: RaceMeeting[];
} {
  const sorted = sortMeetingsByMetroPriority(meetings);
  const sydneyMeeting =
    sorted.find(
      (m) =>
        m.state === "NSW" &&
        (m.venue.toLowerCase().includes("rosehill") ||
          m.venue.toLowerCase().includes("randwick") ||
          m.venue.toLowerCase().includes("warwick farm") ||
          m.venue.toLowerCase().includes("canterbury"))
    ) ||
    sorted.find((m) => m.state === "NSW" || m.state === "ACT") ||
    null;

  const melbourneMeeting =
    sorted.find(
      (m) =>
        m.state === "VIC" &&
        (m.venue.toLowerCase().includes("caulfield") ||
          m.venue.toLowerCase().includes("flemington") ||
          m.venue.toLowerCase().includes("moonee valley") ||
          m.venue.toLowerCase().includes("sandown"))
    ) ||
    sorted.find((m) => m.state === "VIC") ||
    null;

  const combinedRequiredMeetings: RaceMeeting[] = [];
  if (melbourneMeeting) combinedRequiredMeetings.push(melbourneMeeting);
  if (sydneyMeeting && sydneyMeeting.id !== melbourneMeeting?.id) {
    combinedRequiredMeetings.push(sydneyMeeting);
  }
  if (combinedRequiredMeetings.length === 0 && sorted.length > 0) {
    combinedRequiredMeetings.push(sorted[0]);
  }

  return { sydneyMeeting, melbourneMeeting, combinedRequiredMeetings };
}

export function isRaceOfficialOrCompleted(
  race: RaceEvent,
  meetingDate?: string
): boolean {
  const todayIso = getCurrentAustralianDateIso();
  if (meetingDate && normalizeAustralianDateIso(meetingDate) > todayIso) {
    return false;
  }
  const st = (race.status || "").trim().toLowerCase();
  const hasFirst =
    Array.isArray(race.runners) && race.runners.some((r) => Number(r.finishPosition) === 1);
  const hasSecond =
    Array.isArray(race.runners) && race.runners.some((r) => Number(r.finishPosition) === 2);
  if (!hasFirst || !hasSecond) return false;
  return (
    st === "final" ||
    st === "all clear" ||
    st === "official" ||
    st === "resulted" ||
    st === "interim"
  );
}

export function validateAndSanitizeMeetings(
  meetings: RaceMeeting[],
  startDate: string,
  endDate: string,
  venueFilter?: string
): RaceMeeting[] {
  const { startDate: cStart, endDate: cEnd } = clampDateRangeTo5Days(startDate, endDate);
  const vf = (venueFilter || "").trim().toLowerCase();

  const filtered = meetings.filter((m) => {
    if (!m || !m.date) return false;
    const mDate = normalizeAustralianDateIso(m.date);
    if (isDateBeyond5DaysAhead(mDate)) return false;
    if (mDate < cStart || mDate > cEnd) return false;
    if (vf && vf !== "all") {
      const mVenue = (m.venue || "").toLowerCase();
      const mState = (m.state || "").toLowerCase();
      if (!mVenue.includes(vf) && !vf.includes(mVenue) && mState !== vf) {
        return false;
      }
    }
    return true;
  });

  const sanitized = filtered.map((m) => {
    const mDate = normalizeAustralianDateIso(m.date);
    const races = (m.races || []).map((race) => {
      const raceCompleted = isRaceOfficialOrCompleted(race, mDate);
      const normalizedStatus: RaceEvent["status"] = raceCompleted
        ? race.status === "All Clear" || race.status === "Interim"
          ? race.status
          : "Final"
        : "Paying";

      const seenRunners = new Set<string>();
      const uniqueRunners: RaceRunner[] = [];
      for (const r of race.runners || []) {
        const key = (r.horseName || "").trim().toLowerCase();
        if (!key || seenRunners.has(key)) continue;
        seenRunners.add(key);
        uniqueRunners.push({
          ...r,
          finishPosition: raceCompleted ? r.finishPosition || 0 : 0,
          margin: raceCompleted ? r.margin || "-" : "-",
        });
      }

      return {
        ...race,
        status: normalizedStatus,
        winningTime: raceCompleted ? race.winningTime || "-" : "-",
        last600m: raceCompleted ? race.last600m || "-" : "-",
        exotics: raceCompleted ? race.exotics || [] : [],
        runners: uniqueRunners,
      };
    });

    const resolvedTrack = m.trackCondition || m.trackRating || "Good 4";
    return {
      ...m,
      date: mDate,
      trackCondition: resolvedTrack,
      trackRating: resolvedTrack,
      meetingCode: m.meetingCode || m.venue.slice(0, 4).toUpperCase(),
      races: races.sort((a, b) => a.raceNumber - b.raceNumber),
    };
  });

  return sortMeetingsByMetroPriority(sanitized);
}

function decodeBase64(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
  }
  const buf = (
    globalThis as unknown as { Buffer?: { from(s: string, e: string): Uint8Array } }
  ).Buffer?.from(b64, "base64");
  return buf ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) : new Uint8Array(0);
}

interface CompactColumnDict {
  d: unknown[];
  v: number[];
}

interface CompactSeedPayload {
  c: (unknown[] | CompactColumnDict)[];
  m: [
    string,
    string,
    RaceMeeting["state"],
    RaceMeeting["tier"],
    string,
    string,
    string,
    string,
    string,
    [
      number,
      string,
      string,
      number,
      string,
      string,
      RaceEvent["status"],
      string,
      string,
      number,
      [ExoticDividend["poolType"], string, number][]
    ][]
  ][];
}

function hydrateSeedMeetings(b64: string): RaceMeeting[] {
  try {
    const jsonStr = strFromU8(inflateSync(decodeBase64(b64)));
    const parsed = JSON.parse(jsonStr) as CompactSeedPayload;
    const cols = parsed.c;
    const getColVal = (colIdx: number, rowIdx: number): unknown => {
      const col = cols[colIdx];
      if (col && typeof col === "object" && !Array.isArray(col)) {
        const dictCol = col as CompactColumnDict;
        return dictCol.d[dictCol.v[rowIdx]];
      }
      return (col as unknown[])[rowIdx];
    };

    const meetings: RaceMeeting[] = [];
    let runnerOffset = 0;

    for (const mTuple of parsed.m) {
      const venue = mTuple[1];
      const races: RaceEvent[] = [];

      for (const rTuple of mTuple[9]) {
        const runnerCount = rTuple[9];
        const runners: RaceRunner[] = [];

        for (let idx = 0; idx < runnerCount; idx++) {
          const sire = String(getColVal(20, runnerOffset) ?? "");
          const dam = String(getColVal(21, runnerOffset) ?? "__NODAM__");
          const sireDam = dam === "__NODAM__" ? sire : `${sire} x ${dam}`;
          const trainer = String(getColVal(4, runnerOffset) ?? "");
          const rawComment = getColVal(27, runnerOffset) as string | null;
          const formComment =
            rawComment === null
              ? `${sireDam}. Trained by ${trainer} (${venue}).`
              : rawComment.startsWith("!")
              ? rawComment.slice(1)
              : `${sireDam}. Trained by ${trainer} (${rawComment}).`;

          const nswTabWin = Number(getColVal(9, runnerOffset) ?? 5);
          const nswTabPlace = Number(getColVal(10, runnerOffset) ?? 2);
          const rawFixedWin = Number(getColVal(11, runnerOffset) ?? -1);
          const rawFixedPlace = Number(getColVal(12, runnerOffset) ?? -1);
          const fixedWin = rawFixedWin === -1 ? nswTabWin : rawFixedWin;
          const fixedPlace = rawFixedPlace === -1 ? nswTabPlace : rawFixedPlace;
          const openingOdds = Number(getColVal(13, runnerOffset) ?? nswTabWin);
          const rawFlucs = String(getColVal(14, runnerOffset) ?? "");
          const flucs = rawFlucs
            ? rawFlucs.startsWith("^")
              ? [
                  openingOdds.toFixed(2),
                  ...(rawFlucs.length > 1 ? rawFlucs.slice(1).split("|") : []),
                  fixedWin.toFixed(2),
                ]
              : rawFlucs.split("|")
            : [];

          const headgear = String(getColVal(22, runnerOffset) ?? "__OMIT__");
          const rawPrize = getColVal(24, runnerOffset);
          const prizeMoneyEarned =
            typeof rawPrize === "number"
              ? `$${rawPrize.toLocaleString("en-US")}`
              : String(rawPrize ?? "$0");

          const runnerObj: RaceRunner = {
            tabNumber: Number(getColVal(0, runnerOffset) ?? 1),
            horseName: String(getColVal(1, runnerOffset) ?? ""),
            barrier: Number(getColVal(2, runnerOffset) ?? 1),
            jockey: String(getColVal(3, runnerOffset) ?? ""),
            trainer,
            weight: Number(getColVal(5, runnerOffset) ?? 56),
            form: String(getColVal(6, runnerOffset) ?? ""),
            finishPosition: Number(getColVal(7, runnerOffset) ?? 0),
            margin: String(getColVal(8, runnerOffset) ?? "-"),
            nswTabWin,
            nswTabPlace,
            fixedWin,
            fixedPlace,
            openingOdds,
            flucs,
            marketSupport: (getColVal(15, runnerOffset) as RaceRunner["marketSupport"]) || "Steady",
            sectional600m: String(getColVal(16, runnerOffset) ?? "34.50s"),
            silkPrimary: String(getColVal(17, runnerOffset) ?? "#1e3a8a"),
            silkSecondary: String(getColVal(18, runnerOffset) ?? "#fbbf24"),
            ageSex: String(getColVal(19, runnerOffset) ?? "4yo G"),
            sireDam,
            owner: String(getColVal(23, runnerOffset) || `${trainer} Racing Syndicate`),
            prizeMoneyEarned,
            speedMapPosition:
              (getColVal(25, runnerOffset) as RaceRunner["speedMapPosition"]) || "Midfield",
            speedRating: Number(getColVal(26, runnerOffset) ?? 80),
            formComment,
          };

          if (headgear !== "__OMIT__") {
            runnerObj.headgear = headgear;
          }
          runners.push(runnerObj);
          runnerOffset++;
        }

        const exotics: ExoticDividend[] = rTuple[10].map((ex) => ({
          poolType: ex[0],
          combination: ex[1],
          dividend: ex[2],
        }));

        races.push({
          raceNumber: rTuple[0],
          raceName: rTuple[1],
          startTime: rTuple[2],
          distance: rTuple[3],
          classGrade: rTuple[4],
          prizeMoney: rTuple[5],
          status: rTuple[6],
          winningTime: rTuple[7],
          last600m: rTuple[8],
          runners,
          exotics,
        });
      }

      meetings.push({
        id: mTuple[0],
        venue,
        state: mTuple[2],
        tier: mTuple[3],
        date: mTuple[4],
        dayOfWeek: mTuple[5],
        trackRating: mTuple[6],
        trackCondition: mTuple[6],
        weather: mTuple[7],
        railPosition: mTuple[8],
        races,
      });
    }

    return meetings;
  } catch (err) {
    console.error("Failed to hydrate seed meetings:", err);
    return [];
  }
}

const runtimeSeedB64 =
  (typeof window !== "undefined" &&
    (window as unknown as { __TURFSHEET_SEED_B64__?: string }).__TURFSHEET_SEED_B64__) ||
  SEED_PAYLOAD_B64;

export const SEED_MEETINGS: RaceMeeting[] = hydrateSeedMeetings(runtimeSeedB64);

export function getMeetingsForDateRange(
  startDate: string,
  endDate: string,
  venueFilter?: string
): RaceMeeting[] {
  return validateAndSanitizeMeetings(SEED_MEETINGS, startDate, endDate, venueFilter);
}

export function buildDateAccurateMeetings(
  dateIso: string,
  trackFilter?: string
): RaceMeeting[] {
  return getMeetingsForDateRange(dateIso, dateIso, trackFilter);
}

export function getMeetingsForDate(date: string): RaceMeeting[] {
  const norm = normalizeAustralianDateIso(date);
  return getMeetingsForDateRange(norm, norm);
}

export const INITIAL_MEETINGS: RaceMeeting[] = (() => {
  const todayMeetings = getMeetingsForDate(INITIAL_RACE_DATE);
  if (todayMeetings.length > 0) return todayMeetings;
  return getMeetingsForDate("2026-10-12");
})();

export const DEFAULT_PUNTERS: PunterProfile[] = [
  {
    id: "punter-steve-f",
    name: "Steve F",
    role: "Form & Speed Map Analyst",
    selectionsByMeeting: {},
    jokerRaceByMeeting: {},
  },
  {
    id: "punter-mark-s",
    name: "Mark S",
    role: "Sectional & Value Punter",
    selectionsByMeeting: {},
    jokerRaceByMeeting: {},
  },
];

export const SEED_NSW_TAB_MEETINGS: RaceMeeting[] = SEED_MEETINGS;
export const INITIAL_PUNTERS: PunterProfile[] = DEFAULT_PUNTERS;
