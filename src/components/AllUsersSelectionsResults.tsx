import React, { useMemo, useState } from "react";
import {
  Award,
  Check,
  CheckCircle2,
  Edit3,
  Trash2,
  Trophy,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Target,
} from "lucide-react";
import { PunterProfile, RaceMeeting } from "../types/racing";
import { isRaceOfficialOrCompleted } from "../data/seedNswTab";
import {
  DEFAULT_QUADDIE_BUY_IN_PER_USER,
  DEFAULT_TRIFECTA_BUY_IN_PER_USER,
  EvaluatedRaceSelection,
  TrifectaStructureMode,
  computeQuaddieLeg4SweatScenarios,
  computeRaceEachWayParUnits,
  computeSyndicatePotSettlement,
  computeTrifectaStructureOptions,
  evaluateCombinedQuaddieForMeeting,
  evaluateCombinedTrifectaForRace,
  evaluateRaceTrio,
  formatDollarReturn,
  getPunterJokerForMeeting,
  getPunterSelectionsForMeeting,
} from "../utils/scoring";
import { SelectionResultsChart } from "./SelectionResultsChart";
import { RaceCardMultiSelectDropdown } from "./RaceCardMultiSelectDropdown";
import { SyndicateSuccessTrendD3Chart } from "./SyndicateSuccessTrendD3Chart";
import { PunterRoiD3BarChart } from "./PunterRoiD3BarChart";
import { BklitResultsVisualizer } from "./bklit/BklitResultsVisualizer";

export type ScoringDisplayMode = "points" | "dollars";

interface AllUsersSelectionsResultsProps {
  meetings: RaceMeeting[];
  selectedMeetingId: string;
  onSelectMeeting: (id: string) => void;
  selectedMeetingIds?: string[];
  onChangeSelectedMeetingIds?: (ids: string[]) => void;
  punters: PunterProfile[];
  scoringMode: ScoringDisplayMode;
  onToggleScoringMode: (mode: ScoringDisplayMode) => void;
  onEditUserSelections: (punterId: string, meetingId: string) => void;
  onRemovePunter?: (punterId: string) => void;
  trifectaBetAmount?: number;
  quaddieBuyInPerUser?: number;
  quaddieExtraByMeeting?: Record<string, Record<number, number[]>>;
  onPushRaceResultNotification?: (raceNumber: number) => void;
  onRefreshResultsNow?: () => void;
  isRefreshingResults?: boolean;
  autoRefreshResults?: boolean;
  onToggleAutoRefreshResults?: () => void;
  lastResultsUpdatedAt?: string;
  nextRefreshCountdown?: number;
}

export interface UserCardSummary {
  punter: PunterProfile;
  totalPoints: number;
  totalDollarReturn: number;
  selectedHorsesCount: number;
  eachWayParUnits: number;
  eachWayReturnRatePct: number;
  netEachWayVariance: number;
  completedRaces: number;
  selectedRacesCount: number;
  totalRaces: number;
  winnersPicked: number;
  podiumsPicked: number;
  jokerRaceNumber: number | null;
  jokerTriggered: boolean;
  jokerBonusPoints: number;
  raceEvaluations: Record<number, EvaluatedRaceSelection>;
}

function buildUserSummariesForMeetings(
  targetMeetings: RaceMeeting[],
  punters: PunterProfile[],
  scoringMode: ScoringDisplayMode
): UserCardSummary[] {
  if (targetMeetings.length === 0) return [];
  const list = punters.map((punter) => {
    let totalPoints = 0;
    let totalDollarReturn = 0;
    let selectedHorsesCount = 0;
    let eachWayParUnits = 0;
    let completedRaces = 0;
    let selectedRacesCount = 0;
    let totalRaces = 0;
    let winnersPicked = 0;
    let podiumsPicked = 0;
    let jokerRaceNumber: number | null = null;
    let jokerTriggered = false;
    let jokerBonusPoints = 0;
    const raceEvaluations: Record<number, EvaluatedRaceSelection> = {};

    targetMeetings.forEach((m, idx) => {
      const mSelections = getPunterSelectionsForMeeting(punter, m);
      const mJoker = getPunterJokerForMeeting(punter, m);
      if (idx === 0) {
        jokerRaceNumber = mJoker;
      } else if (jokerRaceNumber === null && mJoker !== null) {
        jokerRaceNumber = mJoker;
      }
      totalRaces += m.races.length;

      for (const race of m.races) {
        const isJokerRace = mJoker === race.raceNumber;
        const evaluated = evaluateRaceTrio(
          race,
          mSelections[race.raceNumber],
          m.date,
          isJokerRace
        );
        if (idx === 0) {
          raceEvaluations[race.raceNumber] = evaluated;
        }
        if (evaluated.jokerTriggered) {
          jokerTriggered = true;
          jokerBonusPoints += evaluated.jokerBonusPoints;
        }
        if (evaluated.hasAnySelection) {
          selectedRacesCount++;
          totalPoints += evaluated.racePointsTally;
          totalDollarReturn += evaluated.raceDollarReturn;
          const validPicks = evaluated.picks.filter((p) => p.tabNumber !== null);
          selectedHorsesCount += validPicks.length;
          const parInfo = computeRaceEachWayParUnits(
            (race.runners || []).length,
            validPicks.length
          );
          eachWayParUnits += parInfo.parUnits;
          if (evaluated.isComplete) {
            completedRaces++;
          }
          for (const p of validPicks) {
            if (p.finishPosition === 1) winnersPicked++;
            if (p.finishPosition >= 1 && p.finishPosition <= 3)
              podiumsPicked++;
          }
        }
      }
    });

    const roundedDollarReturn = Number(totalDollarReturn.toFixed(2));
    const effectivePar = eachWayParUnits > 0 ? eachWayParUnits : selectedHorsesCount * 2;
    const eachWayReturnRatePct =
      effectivePar > 0
        ? Number(((roundedDollarReturn / effectivePar) * 100).toFixed(1))
        : 0;
    const netEachWayVariance = Number(
      (roundedDollarReturn - effectivePar).toFixed(2)
    );

    return {
      punter,
      totalPoints,
      totalDollarReturn: roundedDollarReturn,
      selectedHorsesCount,
      eachWayParUnits: effectivePar,
      eachWayReturnRatePct,
      netEachWayVariance,
      completedRaces,
      selectedRacesCount,
      totalRaces,
      winnersPicked,
      podiumsPicked,
      jokerRaceNumber,
      jokerTriggered,
      jokerBonusPoints,
      raceEvaluations,
    };
  });

  return list.sort((a, b) => {
    if (scoringMode === "dollars") {
      return (
        b.totalDollarReturn - a.totalDollarReturn ||
        b.totalPoints - a.totalPoints
      );
    }
    return (
      b.totalPoints - a.totalPoints ||
      b.totalDollarReturn - a.totalDollarReturn
    );
  });
}

export const AllUsersSelectionsResults: React.FC<
  AllUsersSelectionsResultsProps
> = ({
  meetings,
  selectedMeetingId,
  onSelectMeeting,
  selectedMeetingIds,
  onChangeSelectedMeetingIds,
  punters,
  scoringMode,
  onToggleScoringMode,
  onEditUserSelections,
  onRemovePunter,
  trifectaBetAmount = 20,
  quaddieBuyInPerUser = DEFAULT_QUADDIE_BUY_IN_PER_USER,
  quaddieExtraByMeeting = {},
  onPushRaceResultNotification,
  onRefreshResultsNow,
  isRefreshingResults = false,
  autoRefreshResults = true,
  onToggleAutoRefreshResults,
  lastResultsUpdatedAt,
  nextRefreshCountdown,
}) => {
  const [showUnselectedRaces, setShowUnselectedRaces] =
    useState<boolean>(true);
  const [trifectaStructureMode, setTrifectaStructureMode] =
    useState<TrifectaStructureMode>("boxed");
  const [showPotSettlement, setShowPotSettlement] = useState<boolean>(true);
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>([
    selectedMeetingId,
  ]);

  const effectiveSelectedIds = useMemo(() => {
    const raw =
      selectedMeetingIds && selectedMeetingIds.length > 0
        ? selectedMeetingIds
        : localSelectedIds;
    const valid = raw.filter((id) => meetings.some((m) => m.id === id));
    if (valid.length > 0) return valid;
    return meetings[0] ? [meetings[0].id] : [];
  }, [selectedMeetingIds, localSelectedIds, meetings]);

  const handleUpdateSelectedIds = (nextIds: string[]) => {
    const valid = nextIds.filter((id) => meetings.some((m) => m.id === id));
    const safe =
      valid.length > 0
        ? valid
        : meetings[0]
        ? [meetings[0].id]
        : [];
    setLocalSelectedIds(safe);
    onChangeSelectedMeetingIds?.(safe);
    if (safe.length > 0 && !safe.includes(selectedMeetingId)) {
      onSelectMeeting(safe[0]);
    }
  };

  const toggleMeetingInSelection = (meetingId: string) => {
    const exists = effectiveSelectedIds.includes(meetingId);
    if (exists) {
      if (effectiveSelectedIds.length <= 1) {
        onSelectMeeting(meetingId);
        return;
      }
      handleUpdateSelectedIds(
        effectiveSelectedIds.filter((id) => id !== meetingId)
      );
    } else {
      handleUpdateSelectedIds([...effectiveSelectedIds, meetingId]);
      onSelectMeeting(meetingId);
    }
  };

  const activeMeeting = useMemo(() => {
    return (
      meetings.find((m) => m.id === selectedMeetingId) ||
      meetings.find((m) => effectiveSelectedIds.includes(m.id)) ||
      meetings[0] ||
      null
    );
  }, [meetings, selectedMeetingId, effectiveSelectedIds]);

  const selectedMeetingsList = useMemo(() => {
    const filtered = meetings.filter((m) =>
      effectiveSelectedIds.includes(m.id)
    );
    return filtered.length > 0
      ? filtered
      : activeMeeting
      ? [activeMeeting]
      : [];
  }, [meetings, effectiveSelectedIds, activeMeeting]);

  const userSummaries: UserCardSummary[] = useMemo(() => {
    return buildUserSummariesForMeetings(
      selectedMeetingsList,
      punters,
      scoringMode
    );
  }, [selectedMeetingsList, punters, scoringMode]);

  const anyUserHasSelections = useMemo(() => {
    return userSummaries.some((u) => u.selectedRacesCount > 0);
  }, [userSummaries]);

  const syndicatePotSummary = useMemo(() => {
    return computeSyndicatePotSettlement(
      selectedMeetingsList,
      punters,
      DEFAULT_TRIFECTA_BUY_IN_PER_USER,
      quaddieBuyInPerUser,
      quaddieExtraByMeeting
    );
  }, [
    selectedMeetingsList,
    punters,
    quaddieBuyInPerUser,
    quaddieExtraByMeeting,
  ]);

  if (!activeMeeting) return null;

  const topScore =
    userSummaries.length > 0 && anyUserHasSelections
      ? scoringMode === "dollars"
        ? userSummaries[0].totalDollarReturn
        : userSummaries[0].totalPoints
      : 0;

  return (
    <div className="space-y-4">
      {/* 1. Progressive Race-by-Race & Cumulative Results Chart at Top of Screen */}
      <SelectionResultsChart
        meeting={activeMeeting}
        meetings={meetings}
        selectedMeetingIds={effectiveSelectedIds}
        onChangeSelectedMeetingIds={handleUpdateSelectedIds}
        punters={punters}
        userSummaries={userSummaries}
        defaultMetricMode={scoringMode}
        onSyncGlobalMode={onToggleScoringMode}
        onPushRaceResultNotification={onPushRaceResultNotification}
      />

      {/* 1B. bklit.ui Interactive Graphics Suite: Area Timeline, ROI Bars, Strike Ring & Sortable Table */}
      <BklitResultsVisualizer
        meetings={selectedMeetingsList}
        punters={punters}
        scoringMode={scoringMode}
        onToggleScoringMode={onToggleScoringMode}
      />

      {/* 1C. D3 Syndicate Performance Trend & Individual Punter ROI Bar Charts */}
      <div className="grid grid-cols-1 gap-4">
        <SyndicateSuccessTrendD3Chart
          meetings={meetings}
          selectedMeetingIds={effectiveSelectedIds}
          punters={punters}
          trifectaBetAmount={trifectaBetAmount}
          quaddieBuyInPerUser={quaddieBuyInPerUser}
          quaddieExtraByMeeting={quaddieExtraByMeeting}
        />
        <PunterRoiD3BarChart
          meetings={meetings}
          selectedMeetingIds={effectiveSelectedIds}
          punters={punters}
        />
      </div>

      {/* 2. Multi-Select Race Card Switcher + Scoring Mode Toggle Bar */}
      <div className="bg-[#121A16] border border-[#1F2D26] rounded-lg p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#1F2D26]">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#D4AF37] font-semibold">
                Live Selection Results — Race Cards Selected (
                {selectedMeetingsList.length} of {meetings.length} Active on{" "}
                {activeMeeting.date})
              </div>
              <RaceCardMultiSelectDropdown
                meetings={meetings}
                selectedMeetingIds={effectiveSelectedIds}
                onChangeSelectedMeetingIds={handleUpdateSelectedIds}
                punters={punters}
                labelPrefix="Results Race Cards"
                compact
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {meetings.map((m) => {
                const isChecked = effectiveSelectedIds.includes(m.id);
                const finalizedCount = m.races.filter((r) =>
                  isRaceOfficialOrCompleted(r, m.date)
                ).length;
                const venueSelectionsCount = punters.reduce((acc, p) => {
                  const map = getPunterSelectionsForMeeting(p, m);
                  const count = Object.values(map).filter(
                    (t) =>
                      t &&
                      (t.firstPref !== null ||
                        t.secondPref !== null ||
                        t.thirdPref !== null)
                  ).length;
                  return acc + count;
                }, 0);

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMeetingInSelection(m.id)}
                    className={`min-h-[40px] sm:min-h-[34px] px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isChecked
                        ? "bg-[#D4AF37] text-[#0B110E] font-semibold"
                        : "bg-[#0B110E] text-[#8A9990] hover:text-[#F3F4F0] border border-[#1F2D26]"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                        isChecked
                          ? "bg-[#0B110E] border-[#0B110E] text-[#D4AF37]"
                          : "bg-transparent border-[#3A4D42] text-transparent"
                      }`}
                    >
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1 py-0.5 rounded font-bold ${
                        isChecked
                          ? "bg-[#0B110E]/20 text-[#0B110E]"
                          : "bg-[#192620] text-[#D4AF37]"
                      }`}
                    >
                      {m.state || "TAB"}
                    </span>
                    <span>{m.venue}</span>
                    <span className="font-mono text-[11px] opacity-80">
                      ({finalizedCount}/{m.races.length} Final
                      {venueSelectionsCount > 0
                        ? ` · ${venueSelectionsCount} Picked`
                        : ""}
                      )
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5">
            {onToggleAutoRefreshResults && (
              <button
                type="button"
                onClick={onToggleAutoRefreshResults}
                className={`min-h-[34px] px-2.5 py-1 text-xs font-mono rounded-md border transition-colors cursor-pointer flex items-center gap-1.5 ${
                  autoRefreshResults
                    ? "bg-[#152920] border-[#10B981]/50 text-[#10B981]"
                    : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
                title="Toggle automatic background race results refresh (every 45 seconds)"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    autoRefreshResults
                      ? "bg-[#10B981] animate-pulse"
                      : "bg-[#8A9990]"
                  }`}
                />
                <span>
                  Bg Refresh:{" "}
                  {autoRefreshResults
                    ? nextRefreshCountdown !== undefined
                      ? `On (${nextRefreshCountdown}s)`
                      : "On"
                    : "Off"}
                </span>
              </button>
            )}

            {onRefreshResultsNow && (
              <button
                type="button"
                onClick={onRefreshResultsNow}
                disabled={isRefreshingResults}
                className="min-h-[34px] px-3 py-1 text-xs font-semibold rounded-md bg-[#D4AF37] text-[#0B110E] hover:bg-[#E2C152] disabled:opacity-60 transition-colors cursor-pointer flex items-center gap-1.5"
                title={
                  lastResultsUpdatedAt
                    ? `Last updated at ${lastResultsUpdatedAt}. Click to refresh official race results now.`
                    : "Click to refresh official race results now"
                }
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isRefreshingResults ? "animate-spin" : ""
                  }`}
                />
                <span>
                  {isRefreshingResults ? "Updating..." : "Refresh Results"}
                </span>
              </button>
            )}

            {/* Toggle Switch: Points vs $ Return */}
            <div
              role="group"
              aria-label="Scoring Display Mode Toggle"
              className="flex items-center p-1 bg-[#0B110E] border border-[#1F2D26] rounded-md"
            >
              <button
                type="button"
                onClick={() => onToggleScoringMode("points")}
                className={`min-h-[36px] sm:min-h-[30px] flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  scoringMode === "points"
                    ? "bg-[#D4AF37] text-[#0B110E] font-semibold"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Points (3 / 2 / 1)</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleScoringMode("dollars")}
                className={`min-h-[36px] sm:min-h-[30px] flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  scoringMode === "dollars"
                    ? "bg-[#10B981] text-[#0B110E] font-semibold"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>$ Return (Win/Place)</span>
              </button>
            </div>
          </div>
        </div>

        {/* User Leaderboard & Live Selection Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {userSummaries.map((summary, idx) => {
            const userMetric =
              scoringMode === "dollars"
                ? summary.totalDollarReturn
                : summary.totalPoints;
            const isLeader =
              anyUserHasSelections && topScore > 0 && userMetric === topScore;
            const hasUserPickedAny = summary.selectedRacesCount > 0;

            return (
              <div
                key={summary.punter.id}
                className={`p-4 rounded-lg border flex flex-col justify-between gap-3 ${
                  isLeader
                    ? "bg-[#16221C] border-[#D4AF37]"
                    : "bg-[#0B110E] border-[#1F2D26]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#121A16] border border-[#1F2D26] text-[#D4AF37] font-semibold">
                        #{idx + 1}
                      </span>
                      <h3 className="text-base font-bold text-[#F3F4F0]">
                        {summary.punter.name}
                      </h3>
                      {isLeader && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#D4AF37]">
                          <Award className="w-3.5 h-3.5" />
                          Leader
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8A9990] mt-0.5">
                      {hasUserPickedAny ? (
                        <span className="text-[#10B981] font-medium">
                          Live: {summary.selectedRacesCount} of{" "}
                          {summary.totalRaces} races selected (
                          {selectedMeetingsList.length} card
                          {selectedMeetingsList.length === 1 ? "" : "s"})
                        </span>
                      ) : (
                        <span className="text-[#D4AF37]">
                          No selections made yet
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Primary Metric Display */}
                  <div className="text-right font-mono tabular-nums">
                    {!hasUserPickedAny ? (
                      <>
                        <div className="text-lg font-bold text-[#8A9990]">
                          — No Picks
                        </div>
                        <div className="text-[11px] text-[#8A9990]">
                          0 pts · $0.00
                        </div>
                      </>
                    ) : scoringMode === "dollars" ? (
                      <>
                        <div className="text-2xl font-bold text-[#10B981]">
                          {formatDollarReturn(summary.totalDollarReturn)}
                        </div>
                        <div className="text-[11px] text-[#8A9990]">
                          1u W+P Par: {summary.eachWayParUnits}u ·{" "}
                          <span
                            className={
                              summary.eachWayReturnRatePct >= 100
                                ? "text-[#10B981] font-semibold"
                                : "text-[#D4AF37]"
                            }
                          >
                            {summary.eachWayReturnRatePct}% ROI
                          </span>{" "}
                          ({summary.totalPoints} pts)
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-[#D4AF37]">
                          {summary.totalPoints}
                        </div>
                        <div className="text-[11px] text-[#8A9990]">
                          Total Points (
                          {formatDollarReturn(summary.totalDollarReturn)} ·{" "}
                          {summary.eachWayParUnits}u Par)
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1F2D26] text-xs font-mono">
                  <div className="flex items-center gap-3 text-[#8A9990] flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2
                        className={`w-3.5 h-3.5 ${
                          summary.completedRaces === summary.totalRaces
                            ? "text-[#10B981]"
                            : "text-[#8A9990]"
                        }`}
                      />
                      {summary.completedRaces}/{summary.totalRaces} Full Trios
                    </span>
                    <span>1st: {summary.winnersPicked}</span>
                    <span>Podiums: {summary.podiumsPicked}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        summary.jokerTriggered
                          ? "bg-[#D4AF37] text-[#0B110E]"
                          : summary.jokerRaceNumber !== null
                          ? "bg-[#192620] text-[#D4AF37] border border-[#D4AF37]/40"
                          : "bg-[#121A16] text-[#8A9990]"
                      }`}
                    >
                      {summary.jokerRaceNumber !== null
                        ? summary.jokerTriggered
                          ? `🃏 Joker R${summary.jokerRaceNumber}: 2× HIT (+${summary.jokerBonusPoints} pts)`
                          : `🃏 Joker: R${summary.jokerRaceNumber} (2×)`
                        : "🃏 No Joker Set"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onEditUserSelections(summary.punter.id, activeMeeting.id)
                      }
                      className="inline-flex items-center gap-1 text-xs font-sans font-semibold text-[#D4AF37] hover:underline cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>
                        {hasUserPickedAny
                          ? "Update Selections"
                          : "Make Selections"}
                      </span>
                    </button>
                    {onRemovePunter &&
                      summary.punter.id !== "punter-steve-f" &&
                      summary.punter.id !== "punter-mark-s" &&
                      summary.punter.name.trim().toLowerCase() !== "steve f" &&
                      summary.punter.name.trim().toLowerCase() !== "mark s" && (
                        <button
                          type="button"
                          onClick={() => onRemovePunter(summary.punter.id)}
                          title={`Remove user "${summary.punter.name}"`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#291414] border border-[#EF4444]/40 text-[11px] font-mono text-[#EF4444] hover:bg-[#EF4444] hover:text-[#0B110E] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 2B. Syndicate "The Pot" Kitty & Weekly Settlement Ledger (Sportsbet Bet With Mates / Ladbrokes Mates Mode Style) */}
        <div className="pt-3 border-t border-[#1F2D26] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="text-[#D4AF37] font-bold uppercase tracking-wider">
                Syndicate &quot;The Pot&quot; Kitty &amp; Settlement Ledger
              </span>
              <span className="text-[#8A9990]">·</span>
              <span className="text-[#D5DDD8]">
                Pool Staked:{" "}
                <strong className="text-[#F3F4F0]">
                  {formatDollarReturn(syndicatePotSummary.totalPotStaked)}
                </strong>{" "}
                (Trifectas{" "}
                {formatDollarReturn(
                  syndicatePotSummary.totalTrifectaPoolStaked
                )}{" "}
                + Quaddies{" "}
                {formatDollarReturn(syndicatePotSummary.totalQuaddiePoolStaked)}
                )
              </span>
              <span className="text-[#8A9990]">·</span>
              <span className="text-[#10B981] font-bold">
                Exotic Collects:{" "}
                {formatDollarReturn(syndicatePotSummary.totalPotCollected)} (
                {syndicatePotSummary.trifectaHitsCount} Tri ·{" "}
                {syndicatePotSummary.quaddieHitsCount} Quad ·{" "}
                {syndicatePotSummary.potRoiPct}% Pot ROI)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowPotSettlement((prev) => !prev)}
              className="px-2.5 py-1 rounded bg-[#0B110E] border border-[#1F2D26] text-xs font-mono text-[#D4AF37] hover:border-[#D4AF37] cursor-pointer"
            >
              {showPotSettlement
                ? "Hide Pot Settlement Table"
                : "Show Pot Settlement Table"}
            </button>
          </div>

          {showPotSettlement && (
            <div className="overflow-x-auto rounded-lg border border-[#1F2D26] bg-[#0B110E]">
              <table className="w-full text-left border-collapse font-mono text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-[#1F2D26] bg-[#0E1612] text-[11px] text-[#8A9990]">
                    <th className="py-2 px-3">Syndicate Member</th>
                    <th className="py-2 px-3 text-right">
                      Trifecta Buy-In ($10/R)
                    </th>
                    <th className="py-2 px-3 text-right">
                      Quaddie Buy-In (${quaddieBuyInPerUser}/Mtg)
                    </th>
                    <th className="py-2 px-3 text-right">
                      Exotic Pot Contributed
                    </th>
                    <th className="py-2 px-3 text-right">
                      Exotic Share Collected
                    </th>
                    <th className="py-2 px-3 text-right">
                      1u W+P Each-Way (Par / Return)
                    </th>
                    <th className="py-2 px-3 text-right">
                      Net Settlement Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F2D26]">
                  {syndicatePotSummary.memberRows.map((row) => (
                    <tr
                      key={row.punterId}
                      className="hover:bg-[#141E19] transition-colors"
                    >
                      <td className="py-2 px-3 font-sans font-bold text-[#F3F4F0]">
                        {row.punterName}
                      </td>
                      <td className="py-2 px-3 text-right text-[#D5DDD8]">
                        {formatDollarReturn(row.trifectaBuyInTotal)}{" "}
                        <span className="text-[#8A9990] text-[10px]">
                          ({row.activeTrifectaRacesCount}R)
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-[#D5DDD8]">
                        {formatDollarReturn(row.quaddieBuyInTotal)}{" "}
                        <span className="text-[#8A9990] text-[10px]">
                          ({row.activeQuaddieMeetingsCount}M)
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-[#F3F4F0]">
                        {formatDollarReturn(row.totalExoticPotContributed)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-[#10B981]">
                        {formatDollarReturn(row.totalExoticPotCollect)}
                      </td>
                      <td className="py-2 px-3 text-right text-[#D5DDD8]">
                        {row.eachWayParUnits}u Par →{" "}
                        <span className="text-[#10B981] font-semibold">
                          {formatDollarReturn(row.eachWayReturnTotal)}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <span
                          className={
                            row.netExoticPotBalance >= 0 &&
                            row.totalExoticPotCollect > 0
                              ? "text-[#10B981] font-bold"
                              : "text-[#D4AF37]"
                          }
                        >
                          {row.totalExoticPotCollect > 0
                            ? `Payout: ${formatDollarReturn(
                                row.totalExoticPotCollect
                              )} (${
                                row.netExoticPotBalance >= 0 ? "+" : ""
                              }${row.netExoticPotBalance.toFixed(2)} net)`
                            : `${row.settlementStatus} (${formatDollarReturn(
                                row.totalExoticPotContributed
                              )} in pot)`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 3. Live Selections & Results Tables for Each Selected Race Card */}
      <div className="space-y-6">
        {selectedMeetingsList.map((cardMeeting) => {
          const cardSummaries = buildUserSummariesForMeetings(
            [cardMeeting],
            punters,
            scoringMode
          );
          const cardAnySelections = cardSummaries.some(
            (u) => u.selectedRacesCount > 0
          );
          const cardRacesWithSelections = cardMeeting.races.filter((race) =>
            cardSummaries.some(
              (u) => u.raceEvaluations[race.raceNumber]?.hasAnySelection
            )
          );
          const cardDisplayedRaces = showUnselectedRaces
            ? cardMeeting.races
            : cardRacesWithSelections;

          const cardQuaddieEval = evaluateCombinedQuaddieForMeeting(
            cardMeeting,
            punters,
            quaddieExtraByMeeting[cardMeeting.id] || {},
            quaddieBuyInPerUser
          );

          return (
            <div
              key={cardMeeting.id}
              className="bg-[#121A16] border border-[#1F2D26] rounded-lg overflow-hidden"
            >
              <div className="p-4 border-b border-[#1F2D26] flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#0E1612]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-[#192620] border border-[#D4AF37]/40 text-[#D4AF37] font-mono text-[10px] font-bold">
                      {cardMeeting.state || "TAB"}
                    </span>
                    <h2 className="text-base font-bold text-[#F3F4F0]">
                      All Users&apos; Selections &amp; Results —{" "}
                      {cardMeeting.venue}
                    </h2>
                  </div>
                  <p className="text-xs text-[#8A9990] mt-0.5">
                    {cardAnySelections
                      ? `Showing live selections for ${cardRacesWithSelections.length} of ${cardMeeting.races.length} races at ${cardMeeting.venue}.`
                      : "Default state: No horses selected yet. Click 'Make Selections' on any race row to enter your 3 picks."}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {cardAnySelections &&
                    cardRacesWithSelections.length <
                      cardMeeting.races.length && (
                      <button
                        type="button"
                        onClick={() => setShowUnselectedRaces((prev) => !prev)}
                        className="px-2.5 py-1 rounded bg-[#0B110E] border border-[#1F2D26] text-xs font-mono text-[#D4AF37] hover:border-[#D4AF37] cursor-pointer"
                      >
                        {showUnselectedRaces
                          ? `Show Only Selected Races (${cardRacesWithSelections.length})`
                          : `Show All ${cardMeeting.races.length} Races`}
                      </button>
                    )}
                  <div className="text-xs font-mono text-[#8A9990]">
                    Mode:{" "}
                    <span className="text-[#D4AF37] font-semibold">
                      {scoringMode === "dollars"
                        ? "$ Return (1u Win + 1u Place Each-Way per Selection)"
                        : "Points (3 / 2 / 1)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Empty State Callout When No Selections Have Been Made Yet */}
              {!cardAnySelections && (
                <div className="m-4 p-4 rounded-lg bg-[#0B110E] border border-[#23352C] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                    <div className="text-xs text-[#8A9990]">
                      <span className="text-[#F3F4F0] font-semibold">
                        No selections entered yet for {cardMeeting.venue}.
                      </span>{" "}
                      All user columns below default to blank until you select
                      your 3 horses per race in the{" "}
                      <span className="text-[#D4AF37]">
                        My Selections &amp; Ledger
                      </span>{" "}
                      tab.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onEditUserSelections(
                        cardSummaries[0]?.punter.id || "punter-1",
                        cardMeeting.id
                      )
                    }
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#D4AF37] text-[#0B110E] text-xs font-semibold hover:bg-[#E2C152] transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Enter Selections Now</span>
                  </button>
                </div>
              )}

              {/* Desktop / Tablet Matrix Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#1F2D26] bg-[#0B110E] text-[11px] font-mono uppercase text-[#8A9990]">
                      <th className="py-3 px-4 w-56">
                        Race &amp; Official Podium
                      </th>
                      {cardSummaries.map((summary) => (
                        <th
                          key={summary.punter.id}
                          className="py-3 px-4 border-l border-[#1F2D26]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[#F3F4F0] font-sans font-bold text-xs">
                                {summary.punter.name}
                              </span>
                              {onRemovePunter &&
                                summary.punter.id !== "punter-steve-f" &&
                                summary.punter.id !== "punter-mark-s" &&
                                summary.punter.name.trim().toLowerCase() !==
                                  "steve f" &&
                                summary.punter.name.trim().toLowerCase() !==
                                  "mark s" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onRemovePunter(summary.punter.id)
                                    }
                                    title={`Remove user "${summary.punter.name}"`}
                                    className="p-0.5 rounded text-[#8A9990] hover:text-[#EF4444] hover:bg-[#291414] transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                            </div>
                            <span className="text-[#D4AF37]">
                              {summary.selectedRacesCount === 0
                                ? "No Picks"
                                : scoringMode === "dollars"
                                ? formatDollarReturn(summary.totalDollarReturn)
                                : `${summary.totalPoints} pts`}
                            </span>
                          </div>
                        </th>
                      ))}
                      <th className="py-3 px-4 w-72 border-l border-[#1F2D26] bg-[#0E1612]">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[#D4AF37] font-bold">
                              Combined Syndicate Trifecta
                            </span>
                            <span className="text-[10px] text-[#10B981]">
                              (${DEFAULT_TRIFECTA_BUY_IN_PER_USER}/Active User)
                            </span>
                          </div>
                          <div
                            role="group"
                            aria-label="Trifecta Structure Optimizer"
                            className="flex items-center gap-1 p-0.5 rounded bg-[#0B110E] border border-[#1F2D26]"
                          >
                            {(
                              [
                                { id: "boxed", label: "Boxed" },
                                { id: "standout_banker", label: "1st Banker" },
                                { id: "roving_banker", label: "Roving" },
                              ] as Array<{
                                id: TrifectaStructureMode;
                                label: string;
                              }>
                            ).map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setTrifectaStructureMode(opt.id)}
                                className={`flex-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer whitespace-nowrap ${
                                  trifectaStructureMode === opt.id
                                    ? "bg-[#D4AF37] text-[#0B110E] font-bold"
                                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F2D26] text-xs">
                    {cardDisplayedRaces.map((race) => {
                      const isFinished = isRaceOfficialOrCompleted(
                        race,
                        cardMeeting.date
                      );
                      const firstRunner =
                        race.runners.find((r) => r.finishPosition === 1) ||
                        null;
                      const secondRunner =
                        race.runners.find((r) => r.finishPosition === 2) ||
                        null;
                      const thirdRunner =
                        race.runners.find((r) => r.finishPosition === 3) ||
                        null;
                      const combinedTrifecta = evaluateCombinedTrifectaForRace(
                        race,
                        punters,
                        cardMeeting.id,
                        cardMeeting.date,
                        trifectaBetAmount,
                        cardMeeting.venue
                      );

                      return (
                        <tr
                          key={race.raceNumber}
                          className="hover:bg-[#16201B] transition-colors align-top"
                        >
                          {/* Race Meta + Official Result Column */}
                          <td className="py-3 px-4 font-mono">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-[#F3F4F0] text-sm">
                                R{race.raceNumber}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${
                                  isFinished
                                    ? "bg-[#152920] text-[#10B981]"
                                    : "bg-[#192620] text-[#D4AF37]"
                                }`}
                              >
                                {isFinished ? "Final" : race.startTime}
                              </span>
                            </div>
                            <div className="text-xs font-sans text-[#8A9990] truncate mt-0.5">
                              {race.raceName} ({race.distance}m)
                            </div>

                            {isFinished && firstRunner ? (
                              <div className="mt-2 pt-2 border-t border-[#1F2D26] space-y-1 text-[11px]">
                                <div className="text-[#D4AF37] truncate">
                                  1st: #{firstRunner.tabNumber}{" "}
                                  {firstRunner.horseName}
                                </div>
                                {secondRunner && (
                                  <div className="text-[#D5DDD8] truncate">
                                    2nd: #{secondRunner.tabNumber}{" "}
                                    {secondRunner.horseName}
                                  </div>
                                )}
                                {thirdRunner && (
                                  <div className="text-[#8A9990] truncate">
                                    3rd: #{thirdRunner.tabNumber}{" "}
                                    {thirdRunner.horseName}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="mt-2 text-[11px] text-[#8A9990]">
                                Awaiting official result
                              </div>
                            )}
                          </td>

                          {/* Each User's 3 Selections & Score Cell */}
                          {cardSummaries.map((summary) => {
                            const evalRace =
                              summary.raceEvaluations[race.raceNumber];
                            if (!evalRace || !evalRace.hasAnySelection) {
                              return (
                                <td
                                  key={summary.punter.id}
                                  className="py-3 px-4 border-l border-[#1F2D26] align-middle"
                                >
                                  <div className="flex flex-col items-start gap-1.5 text-[#8A9990]">
                                    <span className="text-[11px] font-mono">
                                      — No selections made
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onEditUserSelections(
                                          summary.punter.id,
                                          cardMeeting.id
                                        )
                                      }
                                      className="inline-flex items-center gap-1 text-[11px] font-sans text-[#D4AF37] hover:underline cursor-pointer"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>Select 3 Horses</span>
                                    </button>
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td
                                key={summary.punter.id}
                                className="py-3 px-4 border-l border-[#1F2D26]"
                              >
                                <div className="space-y-1.5">
                                  {evalRace.picks.map((pick) => {
                                    const prefLabel =
                                      pick.preferenceRank === 1
                                        ? "1st"
                                        : pick.preferenceRank === 2
                                        ? "2nd"
                                        : "3rd";
                                    if (!pick.tabNumber) {
                                      return (
                                        <div
                                          key={pick.preferenceRank}
                                          className="flex items-center justify-between gap-2 px-2 py-1 rounded text-[11px] font-mono bg-[#0B110E] text-[#8A9990] border border-dashed border-[#1F2D26]"
                                        >
                                          <span>{prefLabel}: —</span>
                                        </div>
                                      );
                                    }

                                    const isWinner =
                                      pick.finishPosition === 1;
                                    const isPlaced =
                                      pick.finishPosition === 2 ||
                                      pick.finishPosition === 3;

                                    return (
                                      <div
                                        key={pick.preferenceRank}
                                        className={`flex items-center justify-between gap-2 px-2 py-1 rounded text-[11px] font-mono ${
                                          isWinner
                                            ? "bg-[#152920] border border-[#10B981]/50 text-[#F3F4F0]"
                                            : isPlaced
                                            ? "bg-[#192620] border border-[#D4AF37]/40 text-[#F3F4F0]"
                                            : "bg-[#0B110E] border border-[#1F2D26] text-[#8A9990]"
                                        }`}
                                      >
                                        <div className="truncate flex items-center gap-1.5">
                                          <span className="text-[10px] px-1 rounded bg-[#121A16] text-[#D4AF37]">
                                            {prefLabel}
                                          </span>
                                          <span className="font-bold text-[#F3F4F0]">
                                            #{pick.tabNumber}
                                          </span>
                                          <span className="font-sans truncate">
                                            {pick.runner?.horseName || "Runner"}
                                          </span>
                                        </div>

                                        <div className="shrink-0 font-bold">
                                          {scoringMode === "dollars" ? (
                                            pick.dollarReturn > 0 ? (
                                              <span className="text-[#10B981]">
                                                +
                                                {formatDollarReturn(
                                                  pick.dollarReturn
                                                )}
                                              </span>
                                            ) : isFinished ? (
                                              <span className="text-[#8A9990]">
                                                $0
                                              </span>
                                            ) : (
                                              <span className="text-[#8A9990]">
                                                ${pick.runner?.fixedWin || "—"}
                                              </span>
                                            )
                                          ) : pick.points > 0 ? (
                                            <span className="text-[#D4AF37]">
                                              +{pick.points}p
                                            </span>
                                          ) : isFinished ? (
                                            <span className="text-[#8A9990]">
                                              0p
                                            </span>
                                          ) : (
                                            <span className="text-[#8A9990]">
                                              —
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}

                                  {/* Race Sub-total Row */}
                                  <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-[#8A9990]">
                                    <span className="inline-flex items-center gap-1">
                                      <span>Race Total</span>
                                      {evalRace.isJokerRace && (
                                        <span
                                          className={`px-1 py-0.2 rounded text-[10px] font-bold ${
                                            evalRace.jokerTriggered
                                              ? "bg-[#D4AF37] text-[#0B110E]"
                                              : "bg-[#192620] text-[#D4AF37]"
                                          }`}
                                        >
                                          🃏 2×
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-bold text-[#F3F4F0]">
                                      {scoringMode === "dollars"
                                        ? formatDollarReturn(
                                            evalRace.raceDollarReturn
                                          )
                                        : `${evalRace.racePointsTally} pts`}
                                    </span>
                                  </div>
                                </div>
                              </td>
                            );
                          })}

                          {/* Combined Boxed Trifecta Cell (All Users' Horses Combined) */}
                          <td className="py-3 px-4 border-l border-[#1F2D26] bg-[#0D1411] font-mono">
                            {!combinedTrifecta.hasCombinedSelections ? (
                              <div className="text-[11px] text-[#8A9990]">
                                — No combined horses yet
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap gap-1">
                                  {combinedTrifecta.combinedRunners.map(
                                    (cr) => {
                                      const isPodium =
                                        cr.finishPosition >= 1 &&
                                        cr.finishPosition <= 3;
                                      const isShared =
                                        new Set(
                                          cr.pickedByUsers.map(
                                            (u) => u.punterId
                                          )
                                        ).size >= 2;
                                      return (
                                        <span
                                          key={cr.tabNumber}
                                          title={`${
                                            cr.runner?.horseName || "Runner"
                                          } — Included in Boxed Trifecta (Picked by: ${cr.pickedByUsers
                                            .map(
                                              (u) =>
                                                `${u.punterName} [${u.preferenceRank}${
                                                  u.preferenceRank === 1
                                                    ? "st"
                                                    : u.preferenceRank === 2
                                                    ? "nd"
                                                    : "rd"
                                                }]`
                                            )
                                            .join(", ")})`}
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                            cr.finishPosition === 1
                                              ? "bg-[#152920] border-[#10B981] text-[#10B981]"
                                              : isPodium
                                              ? "bg-[#192620] border-[#D4AF37] text-[#D4AF37]"
                                              : isShared
                                              ? "bg-[#121A16] border-[#D4AF37]/50 text-[#F3F4F0]"
                                              : "bg-[#121A16] border-[#1F2D26] text-[#D5DDD8]"
                                          }`}
                                        >
                                          #{cr.tabNumber}
                                          {cr.finishPosition > 0
                                            ? ` (${cr.finishPosition}${
                                                cr.finishPosition === 1
                                                  ? "st"
                                                  : cr.finishPosition === 2
                                                  ? "nd"
                                                  : "rd"
                                              })`
                                            : ""}
                                        </span>
                                      );
                                    }
                                  )}
                                </div>

                                {(() => {
                                  const structOpts =
                                    computeTrifectaStructureOptions(
                                      combinedTrifecta
                                    );
                                  const activeStruct =
                                    structOpts[trifectaStructureMode];
                                  return (
                                    <>
                                      <div className="text-[10px] text-[#8A9990]">
                                        {activeStruct.label} ·{" "}
                                        {activeStruct.combinationsCount} combos ·{" "}
                                        <strong className="text-[#D4AF37]">
                                          {activeStruct.flexiPercentage}% flexi
                                        </strong>{" "}
                                        ({activeStruct.perUserFlexiSharePct}
                                        %/user
                                        {activeStruct.flexiMultiplierBoost > 1
                                          ? ` · ${activeStruct.flexiMultiplierBoost}× Boost`
                                          : ""}
                                        )
                                      </div>

                                      {combinedTrifecta.isRaceResulted ? (
                                        activeStruct.isHit ? (
                                          <div className="p-1.5 rounded bg-[#152920] border border-[#10B981] text-[#10B981] text-[11px] font-bold space-y-0.5">
                                            <div>
                                              ★ HIT ({activeStruct.shortLabel})! +
                                              {formatDollarReturn(
                                                activeStruct.wonFlexiReturn
                                              )}{" "}
                                              (
                                              {formatDollarReturn(
                                                activeStruct.estimatedOrOfficialPerUserPayout
                                              )}
                                              /user)
                                            </div>
                                            <div className="text-[10px] font-normal text-[#D5DDD8]">
                                              $1 Div:{" "}
                                              {formatDollarReturn(
                                                combinedTrifecta.bookmakerTrifectaDividend
                                              )}{" "}
                                              · Win Prob:{" "}
                                              {
                                                combinedTrifecta.boxedWinProbabilityPct
                                              }
                                              %
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-[11px] text-[#8A9990] space-y-0.5">
                                            <div>
                                              Missed {activeStruct.shortLabel} (
                                              {
                                                combinedTrifecta.podiumHitFlags
                                                  .hitCount
                                              }
                                              /3 placed
                                              {combinedTrifecta.isCombinedBoxedTrifectaHit &&
                                              trifectaStructureMode !== "boxed"
                                                ? " · Boxed Hit!"
                                                : ""}
                                              )
                                            </div>
                                            <div className="text-[10px]">
                                              {activeStruct.shortLabel} Collect:{" "}
                                              {formatDollarReturn(
                                                activeStruct.estimatedOrOfficialPayout
                                              )}{" "}
                                              ($1:{" "}
                                              {formatDollarReturn(
                                                combinedTrifecta.bookmakerTrifectaDividend
                                              )}
                                              )
                                            </div>
                                          </div>
                                        )
                                      ) : (
                                        <div className="text-[10px] text-[#D4AF37] space-y-0.5">
                                          <div>
                                            Est. $
                                            {combinedTrifecta.trifectaBetAmount}{" "}
                                            ({activeStruct.shortLabel}):{" "}
                                            {formatDollarReturn(
                                              activeStruct.estimatedOrOfficialPayout
                                            )}{" "}
                                            (
                                            {formatDollarReturn(
                                              activeStruct.estimatedOrOfficialPerUserPayout
                                            )}
                                            /user)
                                          </div>
                                          <div className="text-[#8A9990]">
                                            Box Range:{" "}
                                            {formatDollarReturn(
                                              combinedTrifecta.minFlexiPayout
                                            )}
                                            –
                                            {formatDollarReturn(
                                              combinedTrifecta.maxFlexiPayout
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Table Footer Totals */}
                  <tfoot>
                    <tr className="border-t-2 border-[#23352C] bg-[#0B110E] font-mono text-xs">
                      <td className="py-3 px-4 font-bold text-[#D4AF37]">
                        TOTALS ({cardMeeting.venue})
                      </td>
                      {cardSummaries.map((summary) => (
                        <td
                          key={summary.punter.id}
                          className="py-3 px-4 border-l border-[#1F2D26]"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[#8A9990]">
                              {summary.selectedRacesCount} races picked
                            </span>
                            <span className="text-sm font-bold text-[#10B981]">
                              {scoringMode === "dollars"
                                ? formatDollarReturn(summary.totalDollarReturn)
                                : `${summary.totalPoints} pts`}
                            </span>
                          </div>
                        </td>
                      ))}
                      <td className="py-3 px-4 border-l border-[#1F2D26] bg-[#0E1612]">
                        {(() => {
                          let hits = 0;
                          let totalReturn = 0;
                          for (const r of cardMeeting.races) {
                            const ev = evaluateCombinedTrifectaForRace(
                              r,
                              punters,
                              cardMeeting.id,
                              cardMeeting.date,
                              trifectaBetAmount,
                              cardMeeting.venue
                            );
                            if (ev.isCombinedBoxedTrifectaHit) {
                              hits += 1;
                              totalReturn += ev.customBetFlexiReturn;
                            }
                          }
                          return (
                            <div className="flex items-center justify-between">
                              <span className="text-[#D4AF37] font-bold">
                                {hits} Hit(s)
                              </span>
                              <span className="text-sm font-bold text-[#10B981]">
                                {formatDollarReturn(totalReturn)}
                              </span>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Combined 4-Leg Quaddie Results Summary Strip inside Results Section */}
              {cardQuaddieEval.legs.length > 0 && (
                <div className="p-4 border-t border-[#1F2D26] bg-[#0B110E] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#10B981] font-bold">
                      <Target className="w-4 h-4 text-[#D4AF37]" />
                      <span>
                        Combined 4-Leg Quaddie Results — {cardMeeting.venue} (
                        {cardQuaddieEval.declaredQuaddieVerification.quaddieLabel})
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#152920] border border-[#10B981]/50 text-[10px] text-[#10B981]">
                        ✓{" "}
                        {
                          cardQuaddieEval.declaredQuaddieVerification
                            .verificationSource
                        }
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                      <span className="text-[#D5DDD8]">
                        Buy-In: $
                        {cardQuaddieEval.buyInPerUser || quaddieBuyInPerUser}
                        /user (${cardQuaddieEval.quaddieBetAmount} Pool ·{" "}
                        {cardQuaddieEval.totalCombinations} Combos @{" "}
                        {cardQuaddieEval.flexiPercentage}% Flexi ·{" "}
                        {cardQuaddieEval.flexiSharePerUserPct}%/user)
                      </span>
                      <span className="text-[#8A9990]">·</span>
                      <span className="text-[#D4AF37] font-bold">
                        $1 Div:{" "}
                        {formatDollarReturn(
                          cardQuaddieEval.officialOrEstimatedQuaddieDividend
                        )}{" "}
                        ({cardQuaddieEval.effectiveQuaddieOddsMultiplier}x ·{" "}
                        {cardQuaddieEval.quaddieHitProbabilityPct}% Hit Prob)
                      </span>
                      <span className="text-[#8A9990]">·</span>
                      <span
                        className={`font-bold ${
                          cardQuaddieEval.isQuaddieWon
                            ? "text-[#10B981]"
                            : "text-[#D4AF37]"
                        }`}
                      >
                        {cardQuaddieEval.isQuaddieWon
                          ? `★ QUADDIE WON: ${formatDollarReturn(
                              cardQuaddieEval.flexiPayoutOnBetAmount
                            )} (${formatDollarReturn(
                              cardQuaddieEval.flexiPayoutPerUser
                            )}/user)`
                          : `${cardQuaddieEval.hitLegsCount}/${cardQuaddieEval.legs.length} Legs Landed (Est. Collect: ${formatDollarReturn(
                              cardQuaddieEval.flexiPayoutOnBetAmount
                            )})`}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {cardQuaddieEval.legs.map((leg) => (
                      <div
                        key={leg.legIndex}
                        className={`p-2.5 rounded-lg border font-mono text-xs space-y-1 ${
                          !leg.isRaceResulted
                            ? "bg-[#121A16] border-[#1F2D26]"
                            : leg.isLegHit
                            ? "bg-[#152920] border-[#10B981]"
                            : "bg-[#221417] border-[#EF4444]/60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#D4AF37]">
                            Leg {leg.legIndex} · R{leg.raceNumber}
                          </span>
                          <span
                            className={`text-[10px] font-bold ${
                              !leg.isRaceResulted
                                ? "text-[#8A9990]"
                                : leg.isLegHit
                                ? "text-[#10B981]"
                                : "text-[#EF4444]"
                            }`}
                          >
                            {!leg.isRaceResulted
                              ? "PENDING"
                              : leg.isLegHit
                              ? "✓ LEG HIT"
                              : "✕ MISSED"}
                          </span>
                        </div>
                        <div className="text-[11px] font-sans font-semibold text-[#F3F4F0] truncate">
                          {leg.winner
                            ? `1st: #${leg.winner.tabNumber} ${leg.winner.horseName} ($${(
                                leg.winner.fixedWin ||
                                leg.winner.nswTabWin ||
                                0
                              ).toFixed(2)})`
                            : "Awaiting official winner"}
                        </div>
                        <div className="text-[10px] text-[#9BA8A1] truncate">
                          Syndicate Leg Pool ({leg.allLegRunners.length}H):{" "}
                          {leg.allLegRunners
                            .map((r) => `#${r.tabNumber}`)
                            .join(", ") || "None"}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Live "Sweat the Quaddie" Leg-4 Payout Projection Matrix */}
                  {(() => {
                    const sweatScenarios =
                      computeQuaddieLeg4SweatScenarios(cardQuaddieEval);
                    const leg4 = cardQuaddieEval.legs[3];
                    if (!leg4 || sweatScenarios.length === 0) return null;
                    return (
                      <div className="pt-2 border-t border-[#1F2D26] space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
                          <span className="text-[#D4AF37] font-bold">
                            Sweat the Quaddie — Final Leg (R{leg4.raceNumber})
                            Payout Scenarios ({sweatScenarios.length} Syndicate
                            Runners @ {cardQuaddieEval.flexiPercentage}% Flexi)
                          </span>
                          <span className="text-[#8A9990]">
                            Shows projected $1 Quaddie dividend, Total Syndicate
                            Collect &amp; Per-User Share if each runner wins R
                            {leg4.raceNumber}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {sweatScenarios.map((sc) => (
                            <div
                              key={sc.tabNumber}
                              className={`px-3 py-2 rounded border font-mono text-xs flex items-center justify-between gap-2 tabular-nums ${
                                sc.isActualWinner
                                  ? "bg-[#152920] border-[#10B981] text-[#F3F4F0]"
                                  : "bg-[#121A16] border-[#1F2D26] text-[#D5DDD8]"
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="font-bold text-[#F3F4F0] truncate">
                                  <span className="text-[#D4AF37]">
                                    #{sc.tabNumber}
                                  </span>{" "}
                                  {sc.horseName}{" "}
                                  <span className="text-[#8A9990] font-normal">
                                    (${sc.winOdds.toFixed(2)})
                                  </span>
                                </div>
                                <div className="text-[10px] text-[#8A9990] truncate">
                                  {sc.pickedByNames.length > 0
                                    ? `Picked by: ${sc.pickedByNames.join(", ")}`
                                    : "Quaddie Extra"}
                                  {" · "}
                                  $1 Div:{" "}
                                  {formatDollarReturn(
                                    sc.projectedOneDollarDividend
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-bold text-[#10B981]">
                                  {formatDollarReturn(
                                    sc.projectedTotalFlexiCollect
                                  )}
                                </div>
                                <div className="text-[10px] text-[#D4AF37]">
                                  {formatDollarReturn(
                                    sc.projectedPerUserCollect
                                  )}
                                  /user
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Mobile Stacked View */}
              <div className="md:hidden divide-y divide-[#1F2D26]">
                {cardDisplayedRaces.map((race) => {
                  const isFinished = isRaceOfficialOrCompleted(
                    race,
                    cardMeeting.date
                  );
                  return (
                    <div key={race.raceNumber} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-sm text-[#D4AF37]">
                            Race {race.raceNumber}
                          </span>
                          <span className="text-xs text-[#8A9990] ml-2">
                            {race.raceName}
                          </span>
                        </div>
                        <span className="text-xs font-mono text-[#8A9990]">
                          {isFinished ? "Final" : race.startTime}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {cardSummaries.map((summary) => {
                          const evalRace =
                            summary.raceEvaluations[race.raceNumber];
                          return (
                            <div
                              key={summary.punter.id}
                              className="p-2.5 rounded bg-[#0B110E] border border-[#1F2D26] space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-[#F3F4F0]">
                                  {summary.punter.name}
                                </span>
                                <span className="font-mono font-bold text-[#D4AF37]">
                                  {!evalRace?.hasAnySelection
                                    ? "No Picks"
                                    : scoringMode === "dollars"
                                    ? formatDollarReturn(
                                        evalRace.raceDollarReturn
                                      )
                                    : `${evalRace.racePointsTally} pts`}
                                </span>
                              </div>
                              {!evalRace?.hasAnySelection ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onEditUserSelections(
                                      summary.punter.id,
                                      cardMeeting.id
                                    )
                                  }
                                  className="text-[11px] text-[#D4AF37] underline cursor-pointer"
                                >
                                  + Select 3 horses for R{race.raceNumber}
                                </button>
                              ) : (
                                <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
                                  {evalRace.picks.map((pick) => (
                                    <div
                                      key={pick.preferenceRank}
                                      className="p-1.5 rounded bg-[#121A16] border border-[#1F2D26] truncate"
                                    >
                                      <div className="text-[10px] text-[#D4AF37]">
                                        {pick.preferenceRank === 1
                                          ? "1st"
                                          : pick.preferenceRank === 2
                                          ? "2nd"
                                          : "3rd"}
                                      </div>
                                      <div className="truncate text-[#F3F4F0]">
                                        {pick.tabNumber
                                          ? `#${pick.tabNumber} ${
                                              pick.runner?.horseName || ""
                                            }`
                                          : "—"}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
