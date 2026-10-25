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
  isApple?: boolean;
  isObsidian?: boolean;
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
  isApple = false,
  isObsidian = false,
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
    const afterCurrent = sorted.find(
      (r) =>
        r.raceNumber > race.raceNumber &&
        !isRaceOfficialOrCompleted(r, meeting.date)
    );
    if (afterCurrent) return afterCurrent;
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

  // Urgency tier
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

  // Circular progress ring metrics (radius 24, baseline 30 minutes)
  const ringRadius = 24;
  const ringCircumference = 2 * Math.PI * ringRadius; // 150.796
  const progressRatio = countdown && countdown.totalSeconds > 0
    ? Math.min(1, Math.max(0, countdown.totalSeconds / 1800))
    : 0;
  const strokeDashoffset = ringCircumference * (1 - progressRatio);

  const displayHours = countdown && countdown.totalSeconds > 0
    ? Math.floor(countdown.totalSeconds / 3600)
    : 0;
  const displayMins = countdown && countdown.totalSeconds > 0
    ? Math.floor((countdown.totalSeconds % 3600) / 60)
    : 0;
  const displaySecs = countdown && countdown.totalSeconds > 0
    ? countdown.totalSeconds % 60
    : 0;

  const ringStrokeColor = urgency === "imminent"
    ? "#FF3B30"
    : urgency === "urgent"
    ? "#FF9500"
    : urgency === "racing"
    ? "#34C759"
    : urgency === "finalized"
    ? "#10B981"
    : isApple
    ? "#0071E3"
    : isObsidian
    ? "#38BDF8"
    : "#10B981";

  // Dynamic CSS rotation duration: smoothly rotates and accelerates as time ticks down to zero
  const rotationDurationSec = useMemo(() => {
    if (isCurrentOfficial || urgency === "finalized") return 0; // stop rotation when finalized
    if (!countdown) return 16;
    if (countdown.totalSeconds <= 0 && countdown.totalSeconds > -600) return 0.75; // racing now rapid spin
    const sec = countdown.totalSeconds;
    if (sec <= 30) return 1.0;    // Final 30 seconds - intense rotation
    if (sec <= 120) return 1.8;   // < 2 mins imminent jump
    if (sec <= 300) return 3.5;   // < 5 mins
    if (sec <= 600) return 6.0;   // < 10 mins
    if (sec <= 1200) return 9.0;  // < 20 mins
    return 14.0;                  // > 20 mins calm continuous rotation
  }, [isCurrentOfficial, urgency, countdown]);

  const rotationClass = useMemo(() => {
    if (isCurrentOfficial || urgency === "finalized") return "";
    if (urgency === "imminent") return "countdown-progress-ring-glow-imminent";
    if (urgency === "urgent") return "countdown-progress-ring-glow-urgent";
    return "countdown-progress-ring-spinner";
  }, [isCurrentOfficial, urgency]);

  if (compact) {
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
        className={`inline-flex items-center gap-1.5 font-mono text-[11px] px-2.5 py-0.5 rounded-full border transition-all ${
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

  // Full Rich Countdown Clock Display with Visual SVG Progress Ring
  return (
    <div
      role="region"
      aria-label="Race Jump Countdown Clock"
      className={`rounded-2xl border p-4 sm:p-5 transition-all duration-300 relative overflow-hidden ${
        urgency === "imminent"
          ? isApple
            ? "bg-gradient-to-r from-[#FF3B30]/10 via-white to-[#FF3B30]/5 border-[#FF3B30]/50 shadow-md"
            : "bg-gradient-to-r from-[#FF3B30]/20 via-[#0E1512] to-[#FF3B30]/10 border-[#FF3B30]/60 shadow-[0_0_24px_rgba(255,59,48,0.25)]"
          : urgency === "urgent"
          ? isApple
            ? "bg-gradient-to-r from-[#FF9500]/10 via-white to-[#FF9500]/5 border-[#FF9500]/40 shadow-sm"
            : "bg-gradient-to-r from-[#FF9500]/20 via-[#0E1512] to-[#FF9500]/10 border-[#FF9500]/50 shadow-[0_0_18px_rgba(255,149,0,0.18)]"
          : urgency === "racing"
          ? "bg-gradient-to-r from-[#34C759]/20 via-[#0E1512] to-[#0071E3]/15 border-[#34C759]/60"
          : isApple
          ? "bg-white border-[#E5E5EA] shadow-xs text-[#1D1D1F]"
          : isObsidian
          ? "bg-[#0E1626] border-[#1E293B] text-[#F1F5F9] shadow-md"
          : "bg-gradient-to-r from-[#10B981]/10 via-[#0E1512] to-[#D4AF37]/10 border-[#1F2D26]"
      } ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
        {/* Left Side: SVG Circular Progress Ring + Digital Readout */}
        <div className="flex items-center gap-3.5 sm:gap-4.5">
          {/* Circular Progress Ring */}
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0 flex items-center justify-center">
            <svg
              className="w-full h-full transform"
              viewBox="0 0 56 56"
              aria-hidden="true"
            >
              {/* Outer Decorative Chronometer Bezel Track */}
              <circle
                cx="28"
                cy="28"
                r="26"
                fill="none"
                stroke={isApple ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.08)"}
                strokeWidth="1"
                strokeDasharray="1.5 3"
                className="countdown-bezel-orbit-track"
              />

              {/* Background Track Circle */}
              <circle
                cx="28"
                cy="28"
                r={ringRadius}
                fill="none"
                stroke={isApple ? "#E5E5EA" : "rgba(255, 255, 255, 0.1)"}
                strokeWidth="4.5"
              />

              {/* Dynamic Animated Ring that smoothly rotates as time ticks down to zero */}
              <g
                className={rotationClass}
                style={{
                  transformOrigin: "28px 28px",
                  animationDuration: rotationDurationSec > 0 ? `${rotationDurationSec}s` : undefined,
                  animationPlayState: rotationDurationSec > 0 ? "running" : "paused",
                  transform: rotationDurationSec === 0 ? "rotate(-90deg)" : undefined,
                }}
              >
                <circle
                  cx="28"
                  cy="28"
                  r={ringRadius}
                  fill="none"
                  stroke={ringStrokeColor}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                />
              </g>
            </svg>

            {/* Inner Center Icon */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {urgency === "imminent" ? (
                <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-[#FF3B30] animate-bounce" />
              ) : urgency === "racing" ? (
                <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-[#34C759] animate-pulse" />
              ) : urgency === "finalized" ? (
                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-[#10B981]" />
              ) : (
                <Timer className={`w-5 h-5 sm:w-6 sm:h-6 ${
                  isApple ? "text-[#0071E3]" : isObsidian ? "text-[#38BDF8]" : "text-[#D4AF37]"
                }`} />
              )}
            </div>
          </div>

          {/* Text & Digital Readout */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[11px] font-mono uppercase tracking-wider font-bold ${
                isApple ? "text-[#86868B]" : "text-[#8A9990]"
              }`}>
                {isInspectingNext ? "Current Race Jump Clock" : "Next Upcoming Jump"}
              </span>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wide border ${
                  urgency === "imminent"
                    ? "bg-[#FF3B30] text-white border-[#FF3B30] animate-pulse shadow-xs"
                    : urgency === "urgent"
                    ? "bg-[#FF9500] text-[#070B09] border-[#FF9500]"
                    : urgency === "racing"
                    ? "bg-[#34C759] text-[#070B09] border-[#34C759]"
                    : urgency === "finalized"
                    ? "bg-[#152920] text-[#10B981] border-[#10B981]/40"
                    : isApple
                    ? "bg-[#0071E3]/10 text-[#0071E3] border-[#0071E3]/30"
                    : isObsidian
                    ? "bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30"
                    : "bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40"
                }`}
              >
                {urgency === "imminent" && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>}
                {urgency === "imminent"
                  ? "⚡️ IMMINENT JUMP (< 2 MINS)"
                  : urgency === "urgent"
                  ? "🔥 FINAL ODDS FIRMING"
                  : urgency === "racing"
                  ? "🏇 IN PROGRESS · GATES OPEN"
                  : urgency === "finalized"
                  ? "🏁 OFFICIAL RESULT FINAL"
                  : "⏱ FIXED ODDS OPEN"}
              </span>

              {/* Official Start Time Badge */}
              <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md border ${
                isApple ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F]" : "bg-[#121A16] border-[#1F2D26] text-[#A6B5AD]"
              }`}>
                Scheduled: <strong className="font-bold">{targetRace.startTime} AEDT</strong>
              </span>
            </div>

            {/* High-Contrast Segmented Digital Display */}
            <div className="flex flex-wrap items-baseline gap-2.5">
              {countdown && countdown.totalSeconds > 0 ? (
                <div className="flex items-center gap-1 font-mono tracking-tight tabular-nums">
                  {displayHours > 0 && (
                    <>
                      <span className={`px-2 py-0.5 rounded-lg border font-extrabold text-xl sm:text-2xl ${
                        isApple ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F]" : "bg-[#0B110E] border-[#1F2D26] text-[#F3F4F0]"
                      }`}>
                        {String(displayHours).padStart(2, "0")}h
                      </span>
                      <span className="font-bold opacity-40 text-lg">:</span>
                    </>
                  )}
                  <span className={`px-2 py-0.5 rounded-lg border font-extrabold text-xl sm:text-2xl ${
                    urgency === "imminent"
                      ? "bg-[#FF3B30] text-white border-[#FF3B30]"
                      : isApple
                      ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F]"
                      : "bg-[#0B110E] border-[#1F2D26] text-[#F3F4F0]"
                  }`}>
                    {String(displayMins).padStart(2, "0")}m
                  </span>
                  <span className="font-bold opacity-40 text-lg">:</span>
                  <span className={`px-2 py-0.5 rounded-lg border font-extrabold text-xl sm:text-2xl ${
                    urgency === "imminent"
                      ? "bg-[#FF3B30] text-white border-[#FF3B30] animate-pulse"
                      : isApple
                      ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#0071E3]"
                      : "bg-[#0B110E] border-[#1F2D26] text-[#10B981]"
                  }`}>
                    {String(displaySecs).padStart(2, "0")}s
                  </span>
                  <span className={`text-xs sm:text-sm font-semibold ml-1.5 ${
                    isApple ? "text-[#86868B]" : "text-[#8A9990]"
                  }`}>
                    until jump
                  </span>
                </div>
              ) : countdown && countdown.totalSeconds <= 0 && countdown.totalSeconds > -600 ? (
                <div className="font-mono text-lg sm:text-xl font-extrabold text-[#34C759] tracking-tight flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#34C759] animate-ping" />
                  <span>Race Jumped {Math.abs(countdown.minutes)}m ago · In Running</span>
                </div>
              ) : isCurrentOfficial ? (
                <div className="font-mono text-base sm:text-lg font-bold text-[#10B981] tracking-tight">
                  Race {race.raceNumber} Completed · All Clear Official Result
                </div>
              ) : (
                <div className="font-mono text-lg font-bold tracking-tight">
                  Official Start Time {race.startTime} AEDT
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Quick Target Info & Action */}
        <div className="flex flex-wrap lg:flex-col lg:items-end justify-between lg:justify-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-current/10">
          <div className={`flex items-center gap-1.5 font-mono text-xs ${
            isApple ? "text-[#86868B]" : "text-[#8A9990]"
          }`}>
            <Clock className={`w-3.5 h-3.5 ${isApple ? "text-[#0071E3]" : "text-[#10B981]"}`} />
            <span>
              Target: <strong className={isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"}>
                {targetMeeting.venue} R{targetRace.raceNumber}
              </strong> ({targetRace.startTime} AEDT)
            </span>
          </div>

          {!isInspectingNext && targetRace && (
            <button
              type="button"
              onClick={() => {
                if (targetMeeting.id !== meeting.id && onSelectMeeting) {
                  onSelectMeeting(targetMeeting.id);
                }
                onSelectRaceNumber?.(targetRace.raceNumber);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                isApple
                  ? "bg-[#0071E3] text-white hover:bg-[#0077ED]"
                  : isObsidian
                  ? "bg-[#38BDF8] text-[#09101D] hover:bg-[#0284C7]"
                  : "bg-[#10B981] text-[#070B09] hover:bg-[#0ea371]"
              }`}
              title={`Switch RaceCard view to ${targetMeeting.venue} Race ${targetRace.raceNumber}`}
            >
              <span>Inspect Next Jump (R{targetRace.raceNumber})</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isInspectingNext && nextActiveRaceInMeeting && nextActiveRaceInMeeting.raceNumber !== race.raceNumber && (
            <div className={`text-[11px] font-mono ${isApple ? "text-[#86868B]" : "text-[#8A9990]"}`}>
              Following: R{nextActiveRaceInMeeting.raceNumber} at {nextActiveRaceInMeeting.startTime} AEDT
            </div>
          )}
        </div>
      </div>

      {/* Prominent Next Race Jump Alert Banner (if current race has run and another race is coming up) */}
      {isCurrentOfficial && nextActiveAcrossMeetings && (
        <div className={`mt-3.5 p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 animate-fadeIn ${
          isApple
            ? "bg-[#F2F9F5] border-[#34C759]/30 text-[#1D1D1F]"
            : "bg-[#0E1A14] border-[#10B981]/30 text-[#F3F4F0]"
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full transform" viewBox="0 0 36 36" aria-hidden="true">
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(16, 185, 129, 0.2)" strokeWidth="3" />
                <g className="countdown-progress-ring-spinner" style={{ transformOrigin: "18px 18px", animationDuration: "3.5s" }}>
                  <circle cx="18" cy="18" r="14" fill="none" stroke="#10B981" strokeWidth="3" strokeDasharray="87.96" strokeDashoffset="28" strokeLinecap="round" />
                </g>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-mono font-bold text-xs text-[#10B981]">
                R{nextActiveAcrossMeetings.race.raceNumber}
              </span>
            </div>
            <div>
              <div className="text-xs font-bold font-mono flex items-center gap-1.5">
                <span className="text-[#10B981]">NEXT RACE JUMP ALERT:</span>
                <span className={isApple ? "text-[#0071E3]" : "text-[#D4AF37]"}>
                  {nextActiveAcrossMeetings.meeting.venue} Race {nextActiveAcrossMeetings.race.raceNumber}
                </span>
              </div>
              <div className={`text-[11px] font-mono ${isApple ? "text-[#86868B]" : "text-[#8A9990]"}`}>
                Scheduled at {nextActiveAcrossMeetings.race.startTime} AEDT · {nextRaceCountdown?.formattedClock || "Upcoming"} remaining
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (nextActiveAcrossMeetings.meeting.id !== meeting.id && onSelectMeeting) {
                onSelectMeeting(nextActiveAcrossMeetings.meeting.id);
              }
              onSelectRaceNumber?.(nextActiveAcrossMeetings.race.raceNumber);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-xs ${
              isApple
                ? "bg-[#0071E3] text-white hover:bg-[#0077ED]"
                : "bg-[#10B981] text-[#070B09] hover:bg-[#0ea371]"
            }`}
          >
            <span>Jump to Race {nextActiveAcrossMeetings.race.raceNumber} →</span>
          </button>
        </div>
      )}
    </div>
  );
};
