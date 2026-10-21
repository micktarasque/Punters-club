import React, { useState, useEffect, useMemo } from "react";
import { RaceMeeting, RaceEvent, RaceRunner, PunterProfile } from "../types/racing";
import {
  getSydneyAndMelbourneMeetings,
  isRaceOfficialOrCompleted,
  sortMeetingsByMetroPriority,
} from "../data/seedNswTab";
import { getFeatureRaceNumberForMeeting } from "../utils/scoring";
import {
  Flame,
  Trophy,
  Clock,
  MapPin,
  ChevronRight,
  CheckCircle2,
  ShieldCheck,
  Eye,
  X,
  BarChart3,
  FileText,
} from "lucide-react";
import { RaceCardMultiSelectDropdown } from "./RaceCardMultiSelectDropdown";
import { HarvillePlackettLuceModel } from "./HarvillePlackettLuceModel";
import { RaceCardCountdownClock } from "./RaceCardCountdownClock";
import { audioAlerts } from "../utils/audioAlerts";

interface MajorRaceDaysOverviewProps {
  meetings: RaceMeeting[];
  selectedMeetingId: string;
  selectedMeetingIds?: string[];
  onChangeSelectedMeetingIds?: (ids: string[]) => void;
  punters?: PunterProfile[];
  selectedRaceNumber: number;
  onInspectRace: (meetingId: string, raceNumber: number, targetViewMode?: "analytics" | "form") => void;
  onJumpToSelectionsForMeeting: (meetingId: string) => void;
  verifiedSourcesUsed?: string[];
  extraSelectedMeetingIds?: string[];
  onChangeExtraSelectedMeetingIds?: (ids: string[]) => void;
  overviewViewMode?: "analytics" | "form";
  onChangeOverviewViewMode?: (mode: "analytics" | "form") => void;
}

function getTopFavourites(runners: RaceRunner[], count = 3): RaceRunner[] {
  return [...runners]
    .filter((r) => (r.fixedWin || r.nswTabWin || 0) > 1.0)
    .sort((a, b) => {
      const aOdds = a.fixedWin > 1 ? a.fixedWin : a.nswTabWin || 999;
      const bOdds = b.fixedWin > 1 ? b.fixedWin : b.nswTabWin || 999;
      if (aOdds !== bOdds) return aOdds - bOdds;
      return a.tabNumber - b.tabNumber;
    })
    .slice(0, count);
}

export const MajorRaceDaysOverview: React.FC<MajorRaceDaysOverviewProps> = ({
  meetings,
  selectedMeetingId,
  selectedMeetingIds: controlledSelectedIds,
  onChangeSelectedMeetingIds,
  punters = [],
  selectedRaceNumber,
  onInspectRace,
  onJumpToSelectionsForMeeting,
  verifiedSourcesUsed = [
    "Ladbrokes AU API",
    "Neds AU API",
    "PointsBet AU API",
    "Racing & Sports AU",
  ],
  overviewViewMode = "analytics",
  onChangeOverviewViewMode,
}) => {
  const [internalViewMode, setInternalViewMode] = useState<"analytics" | "form">(
    overviewViewMode || "analytics"
  );

  useEffect(() => {
    if (overviewViewMode) {
      setInternalViewMode(overviewViewMode);
    }
  }, [overviewViewMode]);

  const currentViewMode = overviewViewMode || internalViewMode;

  const handleToggleViewMode = (mode: "analytics" | "form") => {
    setInternalViewMode(mode);
    onChangeOverviewViewMode?.(mode);
    audioAlerts.playTapClick();
    audioAlerts.triggerHapticFeedback(12);
  };

  const sorted = useMemo(() => sortMeetingsByMetroPriority(meetings), [meetings]);
  const { sydneyMeeting, melbourneMeeting, combinedRequiredMeetings } = useMemo(
    () => getSydneyAndMelbourneMeetings(sorted),
    [sorted]
  );

  // Default 2 cards: Melbourne (VIC) and Sydney (NSW)
  const defaultSelectedIds = useMemo(() => {
    if (combinedRequiredMeetings.length > 0) {
      return combinedRequiredMeetings.map((m) => m.id);
    }
    return sorted.slice(0, 2).map((m) => m.id);
  }, [combinedRequiredMeetings, sorted]);

  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>(
    defaultSelectedIds
  );
  const [expandedProbRaceKey, setExpandedProbRaceKey] = useState<string | null>(null);

  useEffect(() => {
    setInternalSelectedIds(defaultSelectedIds);
  }, [defaultSelectedIds.join(",")]);

  const activeSelectedIds = useMemo(() => {
    const raw =
      controlledSelectedIds && controlledSelectedIds.length > 0
        ? controlledSelectedIds
        : internalSelectedIds;
    const validSet = new Set(sorted.map((m) => m.id));
    const filtered = raw.filter((id) => validSet.has(id));
    return filtered.length > 0 ? filtered : defaultSelectedIds;
  }, [controlledSelectedIds, internalSelectedIds, sorted, defaultSelectedIds]);

  const handleUpdateSelectedIds = (nextIds: string[]) => {
    setInternalSelectedIds(nextIds);
    onChangeSelectedMeetingIds?.(nextIds);
  };

  const displayedMeetings = useMemo(() => {
    const set = new Set(activeSelectedIds);
    const result = sorted.filter((m) => set.has(m.id));
    return result.length > 0 ? result : sorted.slice(0, 2);
  }, [sorted, activeSelectedIds]);

  const renderMeetingColumn = (
    meeting: RaceMeeting,
    stateBadgeLabel: string,
    stateAccentClass: string,
    onRemoveExtraCard?: () => void
  ) => {
    const completedCount = meeting.races.filter((r) =>
      isRaceOfficialOrCompleted(r, meeting.date)
    ).length;

    return (
      <div
        key={meeting.id}
        className="apple-card flex flex-col overflow-hidden"
      >
        {/* Major Meeting Header */}
        <div className="bg-[#FAF9FA] border-b border-[#E5E5EA] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[#86868B]">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${stateAccentClass}`}
              >
                <MapPin className="h-3 w-3" />
                {stateBadgeLabel}
              </span>
              <span>•</span>
              <span className="font-mono text-[#1D1D1F] font-semibold">
                {meeting.races.length} Races
              </span>
              <span>•</span>
              <span>{meeting.tier}</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Overview Card View Toggle: Market Analytics vs Detailed Form Guide */}
              <div className="inline-flex items-center p-0.5 rounded-full bg-[#E5E5EA]/80 border border-black/[0.04] text-[11px] font-mono shadow-xs">
                <button
                  type="button"
                  onClick={() => handleToggleViewMode("analytics")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition cursor-pointer active:scale-95 ${
                    currentViewMode === "analytics"
                      ? "bg-white text-[#0071E3] font-bold shadow-xs ring-1 ring-black/5"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                  title="Switch View to Market Analytics (Odds Distribution & Radar)"
                >
                  <BarChart3 className="h-3 w-3" />
                  <span>Market Analytics</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleViewMode("form")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium transition cursor-pointer active:scale-95 ${
                    currentViewMode === "form"
                      ? "bg-white text-[#0071E3] font-bold shadow-xs ring-1 ring-black/5"
                      : "text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                  title="Switch View to Detailed Form Guide (Speed Maps & Full Card)"
                >
                  <FileText className="h-3 w-3" />
                  <span>Detailed Form Guide</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => onJumpToSelectionsForMeeting(meeting.id)}
                className="apple-btn-primary"
              >
                <span>Selections ({meeting.races.length}R)</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              {onRemoveExtraCard && (
                <button
                  type="button"
                  onClick={onRemoveExtraCard}
                  title={`Hide ${meeting.venue} card`}
                  className="apple-btn-secondary"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Hide</span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h3 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
                {meeting.venue}{" "}
                <span className="text-base font-normal text-[#86868B]">
                  ({meeting.state})
                </span>
              </h3>
              <p className="mt-1 text-xs text-[#86868B]">
                Track:{" "}
                <strong className="text-[#1D1D1F] font-semibold">
                  {meeting.trackRating}
                </strong>{" "}
                · Weather:{" "}
                <strong className="text-[#1D1D1F] font-semibold">
                  {meeting.weather}
                </strong>{" "}
                · Rail: <span>{meeting.railPosition}</span>
              </p>
            </div>
            <div className="text-right font-mono text-xs text-[#86868B]">
              {completedCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 text-[#34C759] font-semibold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {completedCount}/{meeting.races.length} Final
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[#0071E3] font-medium">
                  <Clock className="h-3.5 w-3.5" />
                  Upcoming Card ({meeting.races.length} Races)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Individual Races List with Top Favourites */}
        <div className="divide-y divide-[#E5E5EA]">
          {meeting.races.map((race: RaceEvent) => {
            const isCompleted = isRaceOfficialOrCompleted(race, meeting.date);
            const topFavs = getTopFavourites(race.runners, 3);
            const isSelected =
              selectedMeetingId === meeting.id &&
              selectedRaceNumber === race.raceNumber;

            const winner = isCompleted
              ? race.runners.find((r) => r.finishPosition === 1)
              : null;
            const second = isCompleted
              ? race.runners.find((r) => r.finishPosition === 2)
              : null;
            const third = isCompleted
              ? race.runners.find((r) => r.finishPosition === 3)
              : null;

            return (
              <div
                key={race.raceNumber}
                className={`p-5 transition-colors ${
                  isSelected
                    ? "bg-[#F2F7FF]"
                    : "hover:bg-[#FAF9FA]"
                }`}
              >
                {/* Race Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-10 items-center justify-center rounded-xl bg-[#F2F2F7] font-mono text-xs font-bold text-[#1D1D1F] border border-[#E5E5EA]">
                      R{race.raceNumber}
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-sm sm:text-base text-[#1D1D1F]">
                          {race.raceName}
                        </h4>
                        {getFeatureRaceNumberForMeeting(meeting) ===
                          race.raceNumber && (
                          <span className="rounded-full bg-[#FFF5E6] border border-[#FF9500]/40 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#FF9500]">
                            ★ FEATURE · 🃏 JOKER (2×)
                          </span>
                        )}
                        {race.classGrade &&
                          race.classGrade !== "Thoroughbred" && (
                            <span className="text-[11px] font-medium text-[#86868B]">
                              · {race.classGrade}
                            </span>
                          )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#86868B]">
                        <span className="inline-flex items-center gap-1 text-[#1D1D1F] font-medium">
                          <Clock className="h-3 w-3 text-[#0071E3]" />
                          {race.startTime} AEDT
                        </span>
                        <span>•</span>
                        <span>{race.distance}m</span>
                        {race.prizeMoney && race.prizeMoney !== "-" && (
                          <>
                            <span>•</span>
                            <span className="text-[#34C759] font-medium">
                              {race.prizeMoney}
                            </span>
                          </>
                        )}
                        <span>•</span>
                        <span>{race.runners.length} Runners</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-[#34C759] bg-[#EAFBF0] px-2.5 py-1 rounded-full">
                        <CheckCircle2 className="h-3 w-3" />
                        OFFICIAL FINAL
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <RaceCardCountdownClock
                          meeting={meeting}
                          race={race}
                          compact
                        />
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-[#0071E3] bg-[#EBF5FF] px-2.5 py-1 rounded-full">
                          FIXED ODDS OPEN
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedProbRaceKey((prev) =>
                          prev === `${meeting.id}-R${race.raceNumber}`
                            ? null
                            : `${meeting.id}-R${race.raceNumber}`
                        )
                      }
                      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition cursor-pointer ${
                        expandedProbRaceKey === `${meeting.id}-R${race.raceNumber}`
                          ? "border-[#0071E3] bg-[#0071E3] text-white font-semibold"
                          : "border-[#E5E5EA] bg-[#F2F2F7] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                      }`}
                      title="Toggle Runner Win Likelihood & Market Probability Chart"
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      <span>Probabilities</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onInspectRace(meeting.id, race.raceNumber, "analytics")
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition cursor-pointer active:scale-95 ${
                        isSelected && currentViewMode === "analytics"
                          ? "border-[#0071E3] bg-[#0071E3] text-white font-semibold shadow-xs"
                          : "border-[#E5E5EA] bg-white text-[#86868B] hover:border-[#0071E3] hover:text-[#0071E3]"
                      }`}
                      title="Inspect Market Analytics & Radar Charts"
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      <span>Analytics</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onInspectRace(meeting.id, race.raceNumber, "form")
                      }
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition cursor-pointer active:scale-95 ${
                        isSelected && currentViewMode === "form"
                          ? "border-[#0071E3] bg-[#0071E3] text-white font-semibold shadow-xs"
                          : "border-[#E5E5EA] bg-[#F2F2F7] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                      }`}
                      title="Inspect Detailed Form Guide Sheet"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Form ({race.runners.length})</span>
                    </button>
                  </div>
                </div>

                {/* Official Podium Banner if Race is Completed */}
                {isCompleted && winner && (
                  <div className="mt-3.5 rounded-2xl border border-[#34C759]/25 bg-[#EAFBF0] p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-[#34C759]">
                        <Trophy className="h-3.5 w-3.5 text-[#FF9500]" />
                        Official Result:
                      </span>
                      <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
                        <span className="font-bold text-[#1D1D1F]">
                          1st: #{winner.tabNumber} {winner.horseName}{" "}
                          <span className="text-[#34C759]">
                            (${winner.nswTabWin.toFixed(2)} / $
                            {winner.nswTabPlace.toFixed(2)})
                          </span>
                        </span>
                        {second && (
                          <span className="text-[#48484A]">
                            2nd: #{second.tabNumber} {second.horseName}{" "}
                            <span className="text-[#86868B]">
                              (${second.nswTabPlace.toFixed(2)})
                            </span>
                          </span>
                        )}
                        {third && (
                          <span className="text-[#48484A]">
                            3rd: #{third.tabNumber} {third.horseName}{" "}
                            <span className="text-[#86868B]">
                              (${third.nswTabPlace.toFixed(2)})
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Top Favourites in this Race */}
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                      <Flame className="h-3.5 w-3.5 text-[#0071E3]" />
                      Market Favourites (Verified Fixed Odds)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {topFavs.map((fav, idx) => (
                      <div
                        key={fav.tabNumber}
                        onClick={() =>
                          onInspectRace(meeting.id, race.raceNumber)
                        }
                        className="group flex flex-col justify-between rounded-xl border border-[#E5E5EA] bg-[#F9F9FB] p-3 hover:border-[#0071E3]/40 hover:bg-white transition cursor-pointer shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-6 w-6 shrink-0 rounded-full shadow-xs flex items-center justify-center font-mono text-[10px] font-bold"
                              style={{
                                background: `linear-gradient(135deg, ${fav.silkPrimary} 55%, ${fav.silkSecondary} 45%)`,
                                color: "#FFFFFF",
                                textShadow: "0 1px 2px rgba(0,0,0,0.85)",
                              }}
                            >
                              {fav.tabNumber}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-xs text-[#1D1D1F] group-hover:text-[#0071E3]">
                                #{fav.tabNumber} {fav.horseName}
                              </div>
                              <div className="truncate text-[10px] text-[#86868B]">
                                B{fav.barrier} · {fav.jockey}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`shrink-0 font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                              idx === 0
                                ? "bg-[#EBF5FF] text-[#0071E3]"
                                : "bg-[#E5E5EA] text-[#86868B]"
                            }`}
                          >
                            FAV #{idx + 1}
                          </span>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between border-t border-[#E5E5EA] pt-2 font-mono text-[11px]">
                          <span className="truncate text-[10px] text-[#86868B] max-w-[110px]">
                            {fav.trainer}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[#1D1D1F]">
                              ${(fav.fixedWin || fav.nswTabWin || 0).toFixed(2)}W
                            </span>
                            <span className="text-[#86868B]">
                              $
                              {(fav.fixedPlace || fav.nswTabPlace || 0).toFixed(
                                2
                              )}
                              P
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Harville Plackett-Luce Runner Win Likelihood Chart */}
                {expandedProbRaceKey === `${meeting.id}-R${race.raceNumber}` && (
                  <div className="mt-3.5 pt-3 border-t border-[#E5E5EA]">
                    <HarvillePlackettLuceModel race={race} compact />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section
      id="section-todays-races"
      style={{ scrollMarginTop: "calc(var(--app-header-height, 68px) + 28px)" }}
      className="scroll-section-clearance space-y-6"
    >
      {/* Section Header + Multi-Select Checkbox Race Card Dropdown */}
      <div className="apple-card p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#86868B]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#0071E3] bg-[#EBF5FF] px-2.5 py-0.5 rounded-full">
              <ShieldCheck className="h-3.5 w-3.5" />
              Sydney &amp; Melbourne Feature Race Cards
            </span>
            <span>•</span>
            <span>Sources: {verifiedSourcesUsed.join(" · ")}</span>
          </div>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
            Active Race Cards ({displayedMeetings.length} Selected:{" "}
            {displayedMeetings.map((m) => m.venue).join(" · ")})
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#86868B] max-w-3xl leading-relaxed">
            Displaying primary <strong>Melbourne (VIC)</strong> and{" "}
            <strong>Sydney (NSW)</strong> metro meetings by default. Select one or multiple race cards across today's schedule using the selector.
          </p>
        </div>

        {/* Multi-Select Race Card Dropdown & View Mode Switcher */}
        <div className="self-start lg:self-center flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center p-0.5 rounded-full bg-[#E5E5EA] border border-black/[0.04] text-xs font-mono shadow-xs">
            <button
              type="button"
              onClick={() => handleToggleViewMode("analytics")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition cursor-pointer active:scale-95 ${
                currentViewMode === "analytics"
                  ? "bg-white text-[#0071E3] font-bold shadow-xs ring-1 ring-black/5"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
              title="Switch Overview to Market Analytics View"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Market Analytics</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleViewMode("form")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition cursor-pointer active:scale-95 ${
                currentViewMode === "form"
                  ? "bg-white text-[#0071E3] font-bold shadow-xs ring-1 ring-black/5"
                  : "text-[#86868B] hover:text-[#1D1D1F]"
              }`}
              title="Switch Overview to Detailed Form Guide View"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Detailed Form Guide</span>
            </button>
          </div>

          <RaceCardMultiSelectDropdown
            meetings={sorted}
            selectedMeetingIds={activeSelectedIds}
            onChangeSelectedMeetingIds={handleUpdateSelectedIds}
            punters={punters}
            labelPrefix="Race Cards"
            align="right"
          />

          {activeSelectedIds.join(",") !== defaultSelectedIds.join(",") && (
            <button
              type="button"
              onClick={() => handleUpdateSelectedIds(defaultSelectedIds)}
              className="apple-btn-secondary"
              title="Reset to showing only Sydney and Melbourne cards"
            >
              Reset to Syd &amp; Melb
            </button>
          )}
        </div>
      </div>

      {/* Active Race Cards Quick-Toggle Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E5E5EA] bg-white p-3 text-xs shadow-xs">
        <span className="font-semibold text-[#86868B] ml-1">
          Checked Cards ({displayedMeetings.length}/{sorted.length}):
        </span>
        {displayedMeetings.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-center gap-2 rounded-full border border-[#E5E5EA] bg-[#F2F2F7] px-3 py-1 font-medium text-[#1D1D1F]"
          >
            <span>
              {m.venue} ({m.state} · {m.races.length}R)
            </span>
            {displayedMeetings.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  handleUpdateSelectedIds(
                    activeSelectedIds.filter((id) => id !== m.id)
                  )
                }
                className="text-[#86868B] hover:text-[#FF3B30] cursor-pointer"
                title={`Uncheck ${m.venue}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}
      </div>

      {/* Selected Race Cards Grid (Side-by-Side on iPad Pro Landscape & Desktop) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {displayedMeetings.map((mtg) => {
          const isMelb = mtg.id === melbourneMeeting?.id;
          const isSyd = mtg.id === sydneyMeeting?.id;
          const badgeLabel = isMelb
            ? "Melbourne Feature Card (VIC)"
            : isSyd
            ? "Sydney Feature Card (NSW)"
            : `${mtg.state || "TAB"} Race Card`;
          const accentClass = isMelb
            ? "bg-[#EBF5FF] text-[#0071E3] border border-[#0071E3]/20"
            : isSyd
            ? "bg-[#EBF5FF] text-[#0071E3] border border-[#0071E3]/20"
            : "bg-[#EAFBF0] text-[#34C759] border border-[#34C759]/20";

          return renderMeetingColumn(
            mtg,
            badgeLabel,
            accentClass,
            displayedMeetings.length > 1
              ? () =>
                  handleUpdateSelectedIds(
                    activeSelectedIds.filter((id) => id !== mtg.id)
                  )
              : undefined
          );
        })}
      </div>
    </section>
  );
};
