import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Timer,
  Zap,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  Flame,
  Radio,
} from "lucide-react";
import { RaceEvent, RaceMeeting } from "../types/racing";
import { isRaceOfficialOrCompleted, getCurrentAustralianDateIso } from "../data/seedNswTab";

export interface RaceCardCountdownClockProps {
  meeting: RaceMeeting;
  race: RaceEvent;
  allMeetings?: RaceMeeting[];
  onSelectRaceNumber?: (raceNo: number) => void;
  onSelectMeeting?: (meetingId: string) => void;
  compact?: boolean;
  className?: string;
}

/**
 * Parses Australian racing jump times (e.g. "13:20", "1:20pm", "14:45 AEDT") into a unix epoch ms.
 * Handles daylight saving offsets calibrated to NSW/VIC (AEDT UTC+11:00 / AEST UTC+10:00).
 */
export function parseJumpTimestampMs(
  raceDate: string,
  startTime: string
): number | null {
  if (!startTime || typeof startTime !== "string") return null;
  const clean = startTime.trim().toLowerCase();
  const timeMatch = clean.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!timeMatch) return null;

  let hh = parseInt(timeMatch[1], 10);
  const mm = parseInt(timeMatch[2], 10);
  const mer = timeMatch[3];
  if (mer === "pm" && hh < 12) hh += 12;
  if (mer === "am" && hh === 12) hh = 0;

  const dateNorm = raceDate
    ? raceDate.trim().slice(0, 10)
    : getCurrentAustralianDateIso();

  // Daylight savings in NSW/VIC (AEDT) starts first Sunday in October (+11:00)
  const offset = dateNorm >= "2026-10-04" ? "+11:00" : "+10:00";
  const isoStr = `${dateNorm}T${String(hh).padStart(2, "0")}:${String(
    mm
  ).padStart(2, "0")}:00${offset}`;
  const targetMs = Date.parse(isoStr);
  return Number.isFinite(targetMs) ? targetMs : null;
}

export function computeMinutesAndSecondsToJump(
  raceDate: string,
  startTime: string,
  nowMs: number = Date.now()
): {
  totalSeconds: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
  formattedMinutes: string;
  formattedClock: string;
} | null {
  const jumpMs = parseJumpTimestampMs(raceDate, startTime);
  if (jumpMs === null) return null;

  const diffSec = Math.floor((jumpMs - nowMs) / 1000);
  const isPast = diffSec < 0;
  const absSec = Math.abs(diffSec);
  const minutes = Math.floor(absSec / 60);
  const seconds = absSec % 60;

  const formattedClock = `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  const formattedMinutes = `${minutes} min${minutes === 1 ? "" : "s"}`;

  return {
    totalSeconds: diffSec,
    minutes: isPast ? -minutes : minutes,
    seconds,
    isPast,
    formattedMinutes,
    formattedClock,
  };
}

export const RaceCardCountdownClock: React.FC<RaceCardCountdownClockProps> = ({
  meeting,
  race,
  allMeetings = [],
  onSelectRaceNumber,
  onSelectMeeting,
  compact = false,
  className = "",
}) => {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Real-time ticking interval every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check if current inspected race is completed/official
  const isCurrentOfficial = useMemo(() => {
    return isRaceOfficialOrCompleted(race, meeting.date);
  }, [race, meeting.date]);

  // Jump countdown for the currently inspected race
  const currentJumpCountdown = useMemo(() => {
    return computeMinutesAndSecondsToJump(meeting.date, race.startTime, nowMs);
  }, [meeting.date, race.startTime, nowMs]);

  // Find the next upcoming/active race on the current card
  const nextActiveRaceInMeeting = useMemo(() => {
    const sorted = [...meeting.races].sort(
      (a, b) => a.raceNumber - b.raceNumber
    );
    // Find next race after current
    const afterCurrent = sorted.find(
      (r) =>
        r.raceNumber > race.raceNumber &&
        !isRaceOfficialOrCompleted(r, meeting.date)
    );
    if (afterCurrent) return afterCurrent;
    // Otherwise find first unfinished race on the card
    return sorted.find((r) => !isRaceOfficialOrCompleted(r, meeting.date)) || null;
  }, [meeting, race]);

  // Find next upcoming race across all loaded meetings if none in current
  const nextActiveAcrossMeetings = useMemo(() => {
    if (nextActiveRaceInMeeting) {
      return { meeting, race: nextActiveRaceInMeeting };
    }
    const pool = allMeetings.length > 0 ? allMeetings : [meeting];
    for (const m of pool) {
      const activeR = m.races.find(
        (r) => !isRaceOfficialOrCompleted(r, m.date)
      );
      if (activeR) {
        return { meeting: m, race: activeR };
      }
    }
    return null;
  }, [nextActiveRaceInMeeting, allMeetings, meeting]);

  // Countdown for the next active race if the current race has already run
  const nextRaceCountdown = useMemo(() => {
    if (!nextActiveAcrossMeetings) return null;
    return computeMinutesAndSecondsToJump(
      nextActiveAcrossMeetings.meeting.date,
      nextActiveAcrossMeetings.race.startTime,
      nowMs
    );
  }, [nextActiveAcrossMeetings, nowMs]);

  // Determine active display target:
  // If current race is not completed and either upcoming or in-progress, show current race.
  // Otherwise, display the countdown for the next active race!
  const isCurrentUpcomingOrLive =
    !isCurrentOfficial &&
    currentJumpCountdown !== null &&
    currentJumpCountdown.totalSeconds > -600;

  const targetRace = isCurrentUpcomingOrLive
    ? race
    : nextActiveAcrossMeetings?.race || race;
  const targetMeeting = isCurrentUpcomingOrLive
    ? meeting
    : nextActiveAcrossMeetings?.meeting || meeting;
  const countdown = isCurrentUpcomingOrLive
    ? currentJumpCountdown
    : nextRaceCountdown;

  const isInspectingNext =
    targetRace.raceNumber === race.raceNumber &&
    targetMeeting.id === meeting.id;

  // Determine urgency tier for color-coding
  const urgency = useMemo(() => {
    if (isCurrentOfficial && !nextActiveAcrossMeetings) {
      return "finalized";
    }
    if (!countdown) return "unknown";

    if (countdown.totalSeconds <= 0 && countdown.totalSeconds > -600) {
      return "racing"; // Jumping right now
    }
    if (countdown.totalSeconds <= 120 && countdown.totalSeconds > 0) {
      return "imminent"; // < 2 mins (pulse animation)
    }
    if (countdown.totalSeconds <= 600 && countdown.totalSeconds > 0) {
      return "urgent"; // < 10 mins
    }
    if (countdown.totalSeconds <= 1800 && countdown.totalSeconds > 0) {
      return "moderate"; // 10-30 mins
    }
    return "calm"; // > 30 mins
  }, [countdown, isCurrentOfficial, nextActiveAcrossMeetings]);

  if (compact) {
    // Compact pill representation (ideal for selector rows or small badges)
    if (!countdown) {
      return (
        <span
          className={`inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-full border ${className}`}
        >
          <Clock className="w-3 h-3 text-[#8A9990]" />
          <span>{race.startTime}</span>
        </span>
      );
    }

    if (isCurrentOfficial) {
      return (
        <span
          className={`inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-full bg-[#152920] border border-[#10B981]/40 text-[#10B981] font-semibold ${className}`}
        >
          <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
          <span>Final</span>
        </span>
      );
    }

    if (countdown.totalSeconds <= 0 && countdown.totalSeconds > -600) {
      return (
        <span
          className={`inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-full bg-[#FF3B30]/20 border border-[#FF3B30] text-[#FF3B30] font-bold animate-pulse ${className}`}
        >
          <Radio className="w-3 h-3 animate-spin" />
          <span>JUMPING NOW</span>
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-full border transition-all ${
          urgency === "imminent"
            ? "bg-[#FF3B30]/15 border-[#FF3B30] text-[#FF3B30] font-bold animate-pulse"
            : urgency === "urgent"
            ? "bg-[#FF9500]/15 border-[#FF9500] text-[#FF9500] font-bold"
            : urgency === "moderate"
            ? "bg-[#D4AF37]/15 border-[#D4AF37]/50 text-[#D4AF37] font-semibold"
            : "bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981] font-medium"
        } ${className}`}
        title={`Jump time: ${race.startTime} AEDT (${countdown.formattedClock} remaining)`}
      >
        <Timer className="w-3 h-3" />
        <span className="tabular-nums">
          {countdown.minutes <= 0
            ? `${countdown.seconds}s`
            : `${countdown.minutes}m`}
        </span>
      </span>
    );
  }

  // Full Rich Countdown Clock Display for the RaceCard Component
  return (
    <div
      role="region"
      aria-label="Race Jump Countdown Clock"
      className={`rounded-2xl border p-3.5 sm:p-4 transition-all duration-300 relative overflow-hidden ${
        urgency === "imminent"
          ? "bg-gradient-to-r from-[#FF3B30]/15 via-[#0E1512] to-[#FF3B30]/10 border-[#FF3B30]/60 shadow-[0_0_20px_rgba(255,59,48,0.25)]"
          : urgency === "urgent"
          ? "bg-gradient-to-r from-[#FF9500]/15 via-[#0E1512] to-[#FF9500]/10 border-[#FF9500]/50 shadow-[0_0_15px_rgba(255,149,0,0.18)]"
          : urgency === "racing"
          ? "bg-gradient-to-r from-[#34C759]/15 via-[#0E1512] to-[#0071E3]/10 border-[#34C759]/50"
          : urgency === "finalized"
          ? "bg-[#0E1512] border-[#1F2D26]"
          : "bg-gradient-to-r from-[#10B981]/10 via-[#0E1512] to-[#D4AF37]/10 border-[#1F2D26]"
      } ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        {/* Left Side: Countdown Metric & Icon */}
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
              urgency === "imminent"
                ? "bg-[#FF3B30] text-white border-[#FF3B30] shadow-lg animate-pulse"
                : urgency === "urgent"
                ? "bg-[#FF9500] text-[#070B09] border-[#FF9500] font-bold"
                : urgency === "racing"
                ? "bg-[#34C759] text-[#070B09] border-[#34C759]"
                : urgency === "finalized"
                ? "bg-[#152920] text-[#10B981] border-[#10B981]/30"
                : "bg-[#121A16] text-[#D4AF37] border-[#1F2D26]"
            }`}
          >
            {urgency === "imminent" ? (
              <Flame className="w-5 h-5 animate-bounce" />
            ) : urgency === "racing" ? (
              <Radio className="w-5 h-5 animate-pulse" />
            ) : urgency === "finalized" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Timer className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider font-semibold opacity-75">
                {isInspectingNext ? "Current Race Jump Clock" : "Next Active Race Jump"}
              </span>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                  urgency === "imminent"
                    ? "bg-[#FF3B30] text-white animate-pulse"
                    : urgency === "urgent"
                    ? "bg-[#FF9500] text-[#070B09]"
                    : urgency === "racing"
                    ? "bg-[#34C759] text-[#070B09]"
                    : urgency === "finalized"
                    ? "bg-[#152920] text-[#10B981]"
                    : "bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/30"
                }`}
              >
                {urgency === "imminent" && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>}
                {urgency === "imminent"
                  ? "⚡️ IMMINENT JUMP (< 2 MINS)"
                  : urgency === "urgent"
                  ? "🔥 FINAL ODDS FIRMING"
                  : urgency === "racing"
                  ? "🏇 IN PROGRESS"
                  : urgency === "finalized"
                  ? "🏁 OFFICIAL FINAL"
                  : "⏱ FIXED ODDS OPEN"}
              </span>
            </div>

            {/* Main Countdown Time Banner */}
            <div className="flex flex-wrap items-baseline gap-2 mt-0.5">
              {countdown && countdown.totalSeconds > 0 ? (
                <>
                  <div className="font-mono text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums">
                    {countdown.formattedClock}
                  </div>
                  <span className="text-xs sm:text-sm font-semibold opacity-90">
                    ({countdown.formattedMinutes} until jump)
                  </span>
                </>
              ) : countdown && countdown.totalSeconds <= 0 && countdown.totalSeconds > -600 ? (
                <div className="font-mono text-xl sm:text-2xl font-extrabold text-[#34C759] tracking-tight">
                  Race Jumped {Math.abs(countdown.minutes)}m ago · In Running
                </div>
              ) : isCurrentOfficial ? (
                <div className="font-mono text-lg sm:text-xl font-bold text-[#10B981] tracking-tight">
                  Race {race.raceNumber} Completed · All Clear Official
                </div>
              ) : (
                <div className="font-mono text-xl font-bold tracking-tight">
                  Scheduled for {race.startTime} AEDT
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Jump Time & Quick Navigation to Next Race */}
        <div className="flex flex-wrap sm:flex-col sm:items-end justify-between sm:justify-center gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-current/10">
          <div className="flex items-center gap-1.5 font-mono text-xs opacity-90">
            <Clock className="w-3.5 h-3.5 text-[#0071E3] shrink-0" />
            <span>
              Target:{" "}
              <strong className="font-semibold text-foreground">
                {targetMeeting.venue} R{targetRace.raceNumber}
              </strong>{" "}
              at <strong>{targetRace.startTime} AEDT</strong>
            </span>
          </div>

          {/* Quick Jump Action if current inspected race is not the next active */}
          {!isInspectingNext && targetRace && (
            <button
              type="button"
              onClick={() => {
                if (targetMeeting.id !== meeting.id && onSelectMeeting) {
                  onSelectMeeting(targetMeeting.id);
                }
                onSelectRaceNumber?.(targetRace.raceNumber);
              }}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[#0071E3] text-white hover:bg-[#0077ED] transition-all cursor-pointer shadow-xs"
              title={`Switch RaceCard view to ${targetMeeting.venue} Race ${targetRace.raceNumber}`}
            >
              <span>Switch to Next Jump (R{targetRace.raceNumber})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isInspectingNext && nextActiveRaceInMeeting && nextActiveRaceInMeeting.raceNumber !== race.raceNumber && (
            <div className="text-[11px] font-mono text-[#8A9990]">
              Following: R{nextActiveRaceInMeeting.raceNumber} at {nextActiveRaceInMeeting.startTime}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
