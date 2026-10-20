import React, { useState, useMemo } from "react";
import {
  Trophy,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ChevronRight,
  Sliders,
  Award,
  Layers,
  Flame,
  ArrowRight,
  Users,
  Filter,
} from "lucide-react";
import { RaceMeeting, RaceEvent, RaceRunner, PunterProfile } from "../types/racing";
import { isRaceOfficialOrCompleted } from "../data/seedNswTab";
import { JockeySilkSvg } from "./JockeySilkSvg";
import {
  evaluateRaceTrio,
  getPunterSelectionsForMeeting,
  getPunterJokerForMeeting,
  formatDollarReturn,
  evaluateCombinedTrifectaForRace,
  isRaceParticipatedByAnyPunter,
} from "../utils/scoring";

interface InteractiveResultsSuiteProps {
  meetings: RaceMeeting[];
  selectedMeetingId: string;
  onSelectMeeting: (id: string) => void;
  punters: PunterProfile[];
  scoringMode: "points" | "dollars";
  onToggleScoringMode: (mode: "points" | "dollars") => void;
  onEditUserSelections?: (punterId: string, meetingId: string) => void;
  trifectaBetAmount?: number;
  isApple?: boolean;
}

export const InteractiveResultsSuite: React.FC<InteractiveResultsSuiteProps> = ({
  meetings,
  selectedMeetingId,
  onSelectMeeting,
  punters,
  scoringMode,
  onToggleScoringMode,
  onEditUserSelections,
  trifectaBetAmount = 20,
  isApple = false,
}) => {
  // Active Meeting
  const activeMeeting = useMemo(() => {
    return meetings.find((m) => m.id === selectedMeetingId) || meetings[0];
  }, [meetings, selectedMeetingId]);

  // Toggle: Show all scheduled races vs only participated races (default: false / participated only)
  const [showAllRaces, setShowAllRaces] = useState<boolean>(false);

  // Set of race numbers participated in by any syndicate punter
  const participatedRaceNumbers = useMemo(() => {
    if (!activeMeeting || !activeMeeting.races.length) return new Set<number>();
    const set = new Set<number>();
    activeMeeting.races.forEach((r) => {
      if (isRaceParticipatedByAnyPunter(activeMeeting, r.raceNumber, punters)) {
        set.add(r.raceNumber);
      }
    });
    return set;
  }, [activeMeeting, punters]);

  // Displayed races for the race navigation strip
  const displayedRaces = useMemo(() => {
    if (!activeMeeting || !activeMeeting.races.length) return [];
    if (showAllRaces || participatedRaceNumbers.size === 0) {
      return activeMeeting.races;
    }
    return activeMeeting.races.filter((r) =>
      participatedRaceNumbers.has(r.raceNumber)
    );
  }, [activeMeeting, showAllRaces, participatedRaceNumbers]);

  // Active Race Selection: Defaults to first participated finished race or first participated race
  const [selectedRaceNumber, setSelectedRaceNumber] = useState<number>(() => {
    if (!activeMeeting || !activeMeeting.races.length) return 1;
    const candidateRaces = activeMeeting.races.filter((r) =>
      isRaceParticipatedByAnyPunter(activeMeeting, r.raceNumber, punters)
    );
    const pool =
      candidateRaces.length > 0 ? candidateRaces : activeMeeting.races;
    const firstFinished = pool.find((r) =>
      isRaceOfficialOrCompleted(r, activeMeeting.date)
    );
    return firstFinished ? firstFinished.raceNumber : pool[0].raceNumber;
  });

  // Keep selectedRaceNumber in sync with displayedRaces
  React.useEffect(() => {
    if (displayedRaces.length > 0) {
      const exists = displayedRaces.some(
        (r) => r.raceNumber === selectedRaceNumber
      );
      if (!exists) {
        const firstFinished = displayedRaces.find((r) =>
          isRaceOfficialOrCompleted(r, activeMeeting?.date)
        );
        setSelectedRaceNumber(
          firstFinished
            ? firstFinished.raceNumber
            : displayedRaces[0].raceNumber
        );
      }
    }
  }, [displayedRaces, selectedRaceNumber, activeMeeting?.date]);

  const activeRace = useMemo(() => {
    if (!activeMeeting || !activeMeeting.races.length) return null;
    return (
      activeMeeting.races.find((r) => r.raceNumber === selectedRaceNumber) ||
      displayedRaces[0] ||
      activeMeeting.races[0]
    );
  }, [activeMeeting, selectedRaceNumber, displayedRaces]);

  // Interactive Simulator Controls
  const [simulatedStake, setSimulatedStake] = useState<number>(trifectaBetAmount || 20);
  const [customFlexiPct, setCustomFlexiPct] = useState<number | null>(null);

  // Runners sorted by official finish position (1, 2, 3, 4, etc.)
  const finishedRunners = useMemo(() => {
    if (!activeRace) return [];
    return [...activeRace.runners]
      .filter((r) => !r.isScratched)
      .sort((a, b) => {
        const posA = a.finishPosition > 0 ? a.finishPosition : 999;
        const posB = b.finishPosition > 0 ? b.finishPosition : 999;
        return posA - posB;
      });
  }, [activeRace]);

  const isCurrentRaceFinished = activeRace && activeMeeting
    ? isRaceOfficialOrCompleted(activeRace, activeMeeting.date)
    : false;

  // Podium runners
  const winnerRunner = finishedRunners.find((r) => r.finishPosition === 1);
  const secondRunner = finishedRunners.find((r) => r.finishPosition === 2);
  const thirdRunner = finishedRunners.find((r) => r.finishPosition === 3);
  const fourthRunner = finishedRunners.find((r) => r.finishPosition === 4);

  // Official Exotic Dividends Parser
  const exoticDividends = useMemo(() => {
    if (!activeRace) {
      return {
        quinella: null,
        exacta: null,
        trifecta: { combination: "—", dividend: 0 },
        first4: null,
        quaddie: null,
      };
    }

    const exList = activeRace.exotics || [];
    const getExotic = (type: string) =>
      exList.find((e) => e.poolType.toLowerCase() === type.toLowerCase()) || null;

    // Fallback estimates if mock dividend missing
    const tri = getExotic("Trifecta");
    const quin = getExotic("Quinella");
    const exa = getExotic("Exacta");
    const f4 = getExotic("First 4") || getExotic("First4");
    const quad = getExotic("Quaddie");

    // Compute realistic estimate if official trifecta dividend missing
    let trifectaDiv = tri?.dividend || 0;
    if (trifectaDiv === 0 && winnerRunner && secondRunner && thirdRunner) {
      const o1 = Number(winnerRunner.fixedWin || winnerRunner.nswTabWin) || 3.0;
      const o2 = Number(secondRunner.fixedPlace || secondRunner.nswTabPlace) || 2.2;
      const o3 = Number(thirdRunner.fixedPlace || thirdRunner.nswTabPlace) || 2.5;
      trifectaDiv = Number((o1 * o2 * o3 * 6.5).toFixed(2));
    }

    return {
      quinella: quin ? { combination: quin.combination, dividend: quin.dividend } : null,
      exacta: exa ? { combination: exa.combination, dividend: exa.dividend } : null,
      trifecta: {
        combination:
          tri?.combination ||
          (winnerRunner && secondRunner && thirdRunner
            ? `${winnerRunner.tabNumber}-${secondRunner.tabNumber}-${thirdRunner.tabNumber}`
            : "—"),
        dividend: trifectaDiv,
      },
      first4: f4 ? { combination: f4.combination, dividend: f4.dividend } : null,
      quaddie: quad ? { combination: quad.combination, dividend: quad.dividend } : null,
    };
  }, [activeRace, winnerRunner, secondRunner, thirdRunner]);

  // Combined Trifecta Evaluation for this race
  const combinedTrifectaEval = useMemo(() => {
    if (!activeRace || !activeMeeting) return null;
    return evaluateCombinedTrifectaForRace(
      activeRace,
      punters,
      activeMeeting.id,
      activeMeeting.date,
      simulatedStake,
      activeMeeting.venue
    );
  }, [activeRace, activeMeeting, punters, simulatedStake]);

  // Live combinations & flexi percentage for simulation
  const combinationsCount = combinedTrifectaEval?.combinationsCount || 60;
  const actualFlexiPct = combinationsCount > 0 ? (simulatedStake / combinationsCount) * 100 : 0;
  const effectiveFlexiPct = customFlexiPct !== null ? customFlexiPct : actualFlexiPct;

  // Simulated Payout on official Trifecta dividend
  const simulatedCollect = Number(
    ((exoticDividends.trifecta.dividend * effectiveFlexiPct) / 100).toFixed(2)
  );
  const simulatedNetProfit = Number((simulatedCollect - simulatedStake).toFixed(2));
  const simulatedRoiPct =
    simulatedStake > 0
      ? Number(((simulatedNetProfit / simulatedStake) * 100).toFixed(1))
      : 0;

  // Head-to-Head syndicate member performance for this specific race
  const memberPerformances = useMemo(() => {
    if (!activeRace || !activeMeeting) return [];

    return punters.map((punter) => {
      const selectionsMap = getPunterSelectionsForMeeting(punter, activeMeeting);
      const userTrio = selectionsMap[activeRace.raceNumber];
      const jokerRace = getPunterJokerForMeeting(punter, activeMeeting);
      const isJoker = jokerRace === activeRace.raceNumber;

      const evalResult = evaluateRaceTrio(
        activeRace,
        userTrio,
        activeMeeting.date,
        isJoker
      );

      const picked1st = evalResult.picks.find((p) => p.preferenceRank === 1);
      const picked2nd = evalResult.picks.find((p) => p.preferenceRank === 2);
      const picked3rd = evalResult.picks.find((p) => p.preferenceRank === 3);

      const hasWinner = evalResult.picks.some(
        (p) => p.runner && p.runner.finishPosition === 1
      );
      const hasQuinella =
        evalResult.picks.some((p) => p.runner && p.runner.finishPosition === 1) &&
        evalResult.picks.some((p) => p.runner && p.runner.finishPosition === 2);
      const hasTrifecta =
        evalResult.picks.some((p) => p.runner && p.runner.finishPosition === 1) &&
        evalResult.picks.some((p) => p.runner && p.runner.finishPosition === 2) &&
        evalResult.picks.some((p) => p.runner && p.runner.finishPosition === 3);

      return {
        punter,
        evalResult,
        userTrio,
        isJoker,
        jokerTriggered: evalResult.jokerTriggered,
        picked1st,
        picked2nd,
        picked3rd,
        hasWinner,
        hasQuinella,
        hasTrifecta,
        racePoints: evalResult.racePointsTally,
        raceDollarReturn: evalResult.raceDollarReturn,
      };
    });
  }, [activeRace, activeMeeting, punters]);

  if (!activeMeeting || !activeRace) {
    return (
      <div className="p-8 text-center text-xs font-mono text-[#8A9990] bg-[#0E1512] rounded-2xl border border-[#1E2E25]">
        No active race meetings available for interactive results.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------------
          1. TOP NAVIGATION: MEETING SELECTOR & RACE STRIP
         ------------------------------------------------------------------- */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0E1512]/95 backdrop-blur-xl p-5 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] space-y-5">
        {/* Meeting Header & Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1E2E25]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] font-mono text-xs font-bold uppercase">
                Interactive Results Suite · Margins &amp; Dividends
              </span>
              <span className="text-xs text-[#8A9990] font-mono">
                {activeMeeting.venue} ({activeMeeting.state}) · {activeMeeting.date}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F3F4F0] mt-1">
              Race {activeRace.raceNumber}: {activeRace.raceName}
            </h2>
            <div className="flex items-center gap-3 text-xs text-[#8A9990] font-mono mt-0.5">
              <span>{activeRace.distance}m</span>
              <span>·</span>
              <span>Track: {activeMeeting.trackCondition || "Good 4"}</span>
              <span>·</span>
              <span>Rail: {activeMeeting.railPosition || "True"}</span>
              {activeRace.winningTime && (
                <>
                  <span>·</span>
                  <span className="text-[#10B981] font-bold">
                    Official Time: {activeRace.winningTime}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Meeting Switcher Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {meetings.map((m) => {
              const isSelected = m.id === activeMeeting.id;
              const finals = m.races.filter((r) => isRaceOfficialOrCompleted(r, m.date)).length;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelectMeeting(m.id);
                    setSelectedRaceNumber(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-full font-mono text-xs font-semibold transition cursor-pointer whitespace-nowrap border ${
                    isSelected
                      ? "bg-[#0071E3] border-[#0071E3] text-white shadow-xs"
                      : "bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                  }`}
                >
                  <span>{m.venue}</span>{" "}
                  <span className="text-[10px] opacity-75">
                    ({finals}/{m.races.length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Race Selector Strip Header with Filter Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#0071E3] font-semibold">
              Race Selector:
            </span>
            <span className="text-xs text-[#86868B] font-mono">
              {showAllRaces
                ? `Showing All ${activeMeeting.races.length} Races on Card`
                : `${participatedRaceNumbers.size} of ${activeMeeting.races.length} Races Tipped by Syndicate`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAllRaces((prev) => !prev)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition cursor-pointer flex items-center gap-1.5 border ${
                !showAllRaces
                  ? "bg-[#EAFBF0] border-[#34C759]/40 text-[#34C759] font-semibold shadow-xs"
                  : "bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]"
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>
                {!showAllRaces
                  ? `Filter: Participated Races Only (${participatedRaceNumbers.size})`
                  : `Show Participated Races Only`}
              </span>
            </button>
            {!showAllRaces && (
              <button
                type="button"
                onClick={() => setShowAllRaces(true)}
                className="px-3 py-1 rounded-full bg-[#F2F2F7] border border-[#E5E5EA] text-xs font-mono text-[#86868B] hover:text-[#1D1D1F] cursor-pointer"
              >
                All Races ({activeMeeting.races.length})
              </button>
            )}
          </div>
        </div>

        {/* Horizontal Race Strip with Winner / Status Preview */}
        {displayedRaces.length === 0 ? (
          <div className="p-5 rounded-2xl bg-[#FAF9FA] border border-[#E5E5EA] text-center text-xs font-mono text-[#86868B] space-y-2">
            <p className="text-[#1D1D1F] font-semibold">
              No syndicate tips entered for {activeMeeting.venue} yet.
            </p>
            <p className="text-[11px]">
              Filter is defaulting to participated races.
            </p>
            <button
              type="button"
              onClick={() => setShowAllRaces(true)}
              className="apple-btn-primary"
            >
              Show All {activeMeeting.races.length} Scheduled Races
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            {displayedRaces.map((race) => {
              const isSelected = activeRace
                ? race.raceNumber === activeRace.raceNumber
                : false;
              const isFin = isRaceOfficialOrCompleted(race, activeMeeting.date);
              const winner = race.runners.find((r) => r.finishPosition === 1);
              const isTipped = participatedRaceNumbers.has(race.raceNumber);

              return (
                <button
                  key={race.raceNumber}
                  type="button"
                  onClick={() => setSelectedRaceNumber(race.raceNumber)}
                  className={`p-2.5 rounded-xl font-mono text-xs transition cursor-pointer shrink-0 border text-left min-w-[110px] ${
                    isSelected
                      ? "bg-white border-[#0071E3] ring-2 ring-[#0071E3]/20 shadow-xs"
                      : isFin
                      ? "bg-white border-[#E5E5EA] text-[#1D1D1F] hover:border-[#D2D2D7]"
                      : "bg-[#FAF9FA] border-[#E5E5EA] text-[#86868B] hover:text-[#1D1D1F]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-xs text-[#1D1D1F] flex items-center gap-1">
                      <span>R{race.raceNumber}</span>
                      {isTipped && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-[#34C759]"
                          title="Syndicate Tips Active"
                        />
                      )}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full uppercase font-bold ${
                        isFin
                          ? "bg-[#EAFBF0] text-[#34C759]"
                          : "bg-[#EBF5FF] text-[#0071E3]"
                      }`}
                    >
                      {isFin ? "Final" : race.startTime}
                    </span>
                  </div>
                  {winner ? (
                    <div className="truncate text-[10px]">
                      <span className="font-bold text-[#D4AF37]">
                        #{winner.tabNumber}
                      </span>{" "}
                      <span className="text-[#8A9990] truncate">
                        {winner.horseName}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-[#6B7D73] truncate">
                      {race.distance}m
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------
          2. TWO-COLUMN SPLIT: OFFICIAL FINISHING ORDER & MARGINS + DIVIDENDS
         ------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (7 COLS): OFFICIAL ORDER & MARGIN BREAKDOWN */}
        <div className="lg:col-span-7 apple-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E5EA]">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#FF9500]" />
              <h3 className="font-bold text-base text-[#1D1D1F] tracking-tight">
                Official Finishing Order &amp; Margins
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[#86868B]">
              {finishedRunners.length} Runners Finished
            </span>
          </div>

          {!isCurrentRaceFinished ? (
            <div className="p-8 rounded-2xl bg-[#FAF9FA] border border-[#E5E5EA] text-center space-y-2">
              <Clock className="w-6 h-6 text-[#FF9500] mx-auto animate-pulse" />
              <div className="text-sm font-semibold text-[#1D1D1F]">
                Official Results Awaiting Post-Race Declaration
              </div>
              <p className="text-xs text-[#86868B] max-w-sm mx-auto leading-relaxed">
                Official margins, finishing orders, and dividends will populate automatically as soon as stewards confirm correct weight for Race {activeRace.raceNumber}.
              </p>
            </div>
          ) : (
            <div className="space-y-2 overflow-x-auto">
              {finishedRunners.slice(0, 8).map((runner, idx) => {
                const pos = runner.finishPosition;
                const isWinner = pos === 1;
                const winOdds = Number(runner.fixedWin || runner.nswTabWin) || 0;
                const placeOdds = Number(runner.fixedPlace || runner.nswTabPlace) || 0;
                const marginText = runner.margin || (isWinner ? "Winner" : `${(idx * 0.75).toFixed(2)}L`);

                return (
                  <div
                    key={runner.tabNumber}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 text-xs ${
                      isWinner
                        ? "bg-[#FFF9F2] border-[#FF9500]/60 shadow-xs"
                        : pos === 2
                        ? "bg-[#F2F7FF] border-[#0071E3]/40"
                        : pos === 3
                        ? "bg-[#F2FBF5] border-[#34C759]/40"
                        : "bg-white border-[#E5E5EA] hover:border-[#0071E3]/30"
                    }`}
                  >
                    {/* Place Badge & Silk & Horse Info */}
                    <div className="flex items-center gap-3 truncate">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                          isWinner
                            ? "bg-[#FF9500] text-white shadow-xs"
                            : pos === 2
                            ? "bg-[#0071E3] text-white shadow-xs"
                            : pos === 3
                            ? "bg-[#34C759] text-white shadow-xs"
                            : "bg-[#F2F2F7] text-[#86868B] border border-[#E5E5EA]"
                        }`}
                      >
                        {pos > 0 ? `${pos}` : "—"}
                      </span>

                      <JockeySilkSvg
                        primary={runner.silkPrimary}
                        secondary={runner.silkSecondary}
                        seed={runner.tabNumber}
                      />

                      <div className="truncate">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-semibold text-[#1D1D1F] text-sm truncate">
                            #{runner.tabNumber} {runner.horseName}
                          </span>
                          <span className="text-[10px] text-[#86868B] font-mono shrink-0">
                            (B{runner.barrier})
                          </span>
                        </div>
                        <div className="text-[11px] text-[#86868B] truncate font-mono">
                          J: {runner.jockey} · T: {runner.trainer} ({runner.weight}kg)
                        </div>
                      </div>
                    </div>

                    {/* Margins & Dividends */}
                    <div className="flex items-center gap-3 shrink-0 text-right font-mono">
                      {/* Margin Lengths */}
                      <div className="text-right">
                        <span className="text-[10px] text-[#86868B] block uppercase font-medium">
                          Margin
                        </span>
                        <span
                          className={`font-semibold text-xs ${
                            isWinner ? "text-[#FF9500]" : "text-[#1D1D1F]"
                          }`}
                        >
                          {marginText}
                        </span>
                      </div>

                      {/* Official Payout Odds */}
                      <div className="text-right pl-3 border-l border-[#E5E5EA]">
                        <span className="text-[10px] text-[#86868B] block uppercase font-medium">
                          TAB Div
                        </span>
                        <span className="font-bold text-xs text-[#34C759]">
                          ${winOdds > 0 ? winOdds.toFixed(2) : "—"}{" "}
                          {placeOdds > 0 && (
                            <span className="text-[10px] text-[#86868B]">
                              / ${placeOdds.toFixed(2)}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (5 COLS): OFFICIAL EXOTIC DIVIDENDS & FLEXI SIMULATOR */}
        <div className="lg:col-span-5 space-y-6">
          {/* Official Exotic Dividends Card */}
          <div className="apple-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5EA]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0071E3]" />
                <h3 className="font-bold text-base text-[#1D1D1F] tracking-tight">
                  Official TAB Exotic Dividends
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#EAFBF0] text-[#34C759] font-bold border border-[#34C759]/30">
                NSW TAB Pool
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              {/* Trifecta */}
              <div className="p-3.5 rounded-2xl bg-[#FFF9F2] border border-[#FF9500]/40 space-y-0.5 col-span-2 shadow-xs">
                <div className="flex items-center justify-between text-[10px] text-[#FF9500] font-bold uppercase">
                  <span>Trifecta ({exoticDividends.trifecta.combination})</span>
                  <span>100% Full Unit</span>
                </div>
                <div className="text-2xl font-black text-[#FF9500]">
                  ${exoticDividends.trifecta.dividend.toFixed(2)}
                </div>
              </div>

              {/* Quinella */}
              <div className="p-3.5 rounded-2xl bg-[#FAF9FA] border border-[#E5E5EA] space-y-0.5 shadow-xs">
                <div className="flex items-center justify-between text-[10px] text-[#86868B] font-bold uppercase">
                  <span>Quinella</span>
                  <span>{exoticDividends.quinella?.combination || "1st & 2nd"}</span>
                </div>
                <div className="text-base font-bold text-[#1D1D1F]">
                  ${exoticDividends.quinella?.dividend?.toFixed(2) || "—"}
                </div>
              </div>

              {/* Exacta */}
              <div className="p-3.5 rounded-2xl bg-[#FAF9FA] border border-[#E5E5EA] space-y-0.5 shadow-xs">
                <div className="flex items-center justify-between text-[10px] text-[#86868B] font-bold uppercase">
                  <span>Exacta</span>
                  <span>{exoticDividends.exacta?.combination || "1st then 2nd"}</span>
                </div>
                <div className="text-base font-bold text-[#1D1D1F]">
                  ${exoticDividends.exacta?.dividend?.toFixed(2) || "—"}
                </div>
              </div>

              {/* First 4 */}
              <div className="p-3.5 rounded-2xl bg-[#FAF9FA] border border-[#E5E5EA] space-y-0.5 col-span-2 shadow-xs">
                <div className="flex items-center justify-between text-[10px] text-[#86868B] font-bold uppercase">
                  <span>First 4</span>
                  <span>{exoticDividends.first4?.combination || "Top 4 Finishers"}</span>
                </div>
                <div className="text-base font-bold text-[#34C759]">
                  ${exoticDividends.first4?.dividend?.toFixed(2) || "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Flexi Dividend & Return Simulator */}
          <div className="apple-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5EA]">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#0071E3]" />
                <h3 className="font-bold text-base text-[#1D1D1F] tracking-tight">
                  Flexi Payout Simulator
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[#86868B]">
                Live Return Calculator
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {/* Stake Presets */}
              <div>
                <label className="text-[10px] text-[#86868B] block uppercase mb-1.5 font-medium">
                  Syndicate Outlay / Stake:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 20, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setSimulatedStake(amt)}
                      className={`py-2 rounded-full font-bold transition-all cursor-pointer ${
                        simulatedStake === amt
                          ? "bg-[#0071E3] text-white shadow-xs"
                          : "bg-white text-[#86868B] hover:text-[#1D1D1F] border border-[#E5E5EA]"
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Flexi Formula Telemetry */}
              <div className="p-3.5 rounded-2xl bg-[#FAF9FA] border border-[#E5E5EA] space-y-2">
                <div className="flex items-center justify-between text-[#86868B] text-[11px]">
                  <span>Ticket Combinations:</span>
                  <span className="text-[#1D1D1F] font-bold">{combinationsCount} Combos</span>
                </div>
                <div className="flex items-center justify-between text-[#86868B] text-[11px]">
                  <span>Applied Flexi %:</span>
                  <span className="text-[#0071E3] font-bold">
                    {actualFlexiPct.toFixed(2)}% Flexi
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#86868B] text-[11px] pt-1.5 border-t border-[#E5E5EA]">
                  <span>Per-Member Share ({punters.length} Punters):</span>
                  <span className="text-[#1D1D1F] font-bold">
                    {(actualFlexiPct / Math.max(1, punters.length)).toFixed(2)}% each
                  </span>
                </div>
              </div>

              {/* Projected Collect & Net Payout */}
              <div className="p-4 rounded-2xl bg-[#EAFBF0] border border-[#34C759]/40 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#86868B] uppercase block font-medium">
                    Calculated Flexi Collect
                  </span>
                  <div className="text-2xl font-black text-[#34C759]">
                    ${simulatedCollect.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#86868B] uppercase block font-medium">
                    Net Profit / ROI
                  </span>
                  <div
                    className={`text-sm font-black ${
                      simulatedNetProfit >= 0 ? "text-[#34C759]" : "text-[#FF3B30]"
                    }`}
                  >
                    {simulatedNetProfit >= 0 ? "+" : ""}
                    ${simulatedNetProfit.toFixed(2)}{" "}
                    <span className="text-[10px] font-normal opacity-80">
                      ({simulatedRoiPct >= 0 ? "+" : ""}
                      {simulatedRoiPct}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------
          3. HEAD-TO-HEAD SYNDICATE ACCURACY & TIPPER PERFORMANCE
         ------------------------------------------------------------------- */}
      <div className="apple-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E5E5EA]">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0071E3]" />
            <h3 className="font-bold text-base text-[#1D1D1F] tracking-tight">
              Syndicate Member Head-to-Head Accuracy (Race {activeRace.raceNumber})
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#86868B] font-medium mr-1">Display:</span>
            <button
              type="button"
              onClick={() => onToggleScoringMode("points")}
              className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                scoringMode === "points"
                  ? "bg-[#0071E3] text-white shadow-xs"
                  : "bg-white text-[#86868B] hover:text-[#1D1D1F] border border-[#E5E5EA]"
              }`}
            >
              Points (3/2/1)
            </button>
            <button
              type="button"
              onClick={() => onToggleScoringMode("dollars")}
              className={`px-3 py-1 rounded-full font-semibold transition-all cursor-pointer ${
                scoringMode === "dollars"
                  ? "bg-[#34C759] text-white shadow-xs"
                  : "bg-white text-[#86868B] hover:text-[#1D1D1F] border border-[#E5E5EA]"
              }`}
            >
              $ EW Return
            </button>
          </div>
        </div>

        {/* Member Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {memberPerformances.map((perf) => {
            const { punter, isJoker, racePoints, raceDollarReturn, evalResult } = perf;
            const hasPicks = evalResult.hasAnySelection;

            return (
              <div
                key={punter.id}
                className="p-4 rounded-2xl bg-[#FAF9FA] border border-[#E5E5EA] space-y-3 text-xs shadow-xs"
              >
                {/* Header: Name + Score */}
                <div className="flex items-center justify-between pb-2 border-b border-[#E5E5EA]">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-[#EBF5FF] border border-[#0071E3]/30 flex items-center justify-center font-bold text-xs text-[#0071E3]">
                      {punter.name.charAt(0)}
                    </span>
                    <div>
                      <div className="font-semibold text-[#1D1D1F] flex items-center gap-1.5">
                        <span>{punter.name}</span>
                        {isJoker && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#FFF5E6] text-[#FF9500] font-bold border border-[#FF9500]/40">
                            🃏 2x JOKER
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#86868B]">
                        {hasPicks ? "3 Selections Registered" : "No Tips Logged"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <span className="text-[10px] text-[#86868B] block uppercase font-medium">
                      Race Score
                    </span>
                    <span className="font-bold text-sm text-[#34C759]">
                      {scoringMode === "dollars"
                        ? formatDollarReturn(raceDollarReturn)
                        : `${racePoints} pts`}
                    </span>
                  </div>
                </div>

                {/* 3 Picks Breakdown */}
                {hasPicks ? (
                  <div className="space-y-1.5 font-mono">
                    {evalResult.picks.map((pick) => {
                      const pos = pick.runner?.finishPosition || 0;
                      const isWin = pos === 1;
                      const isPod = pos >= 1 && pos <= 3;
                      const horse = pick.runner;

                      return (
                        <div
                          key={pick.preferenceRank}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                            isWin
                              ? "bg-[#FFF9F2] border-[#FF9500]/40"
                              : isPod
                              ? "bg-[#EAFBF0] border-[#34C759]/30"
                              : "bg-white border-[#E5E5EA]"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#F2F2F7] text-[#86868B] font-bold">
                              {pick.preferenceRank === 1 ? "1st" : pick.preferenceRank === 2 ? "2nd" : "3rd"}
                            </span>
                            <span className="font-medium text-[#1D1D1F] truncate">
                              #{pick.tabNumber} {horse?.horseName || "Runner"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 text-right">
                            {pos > 0 ? (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isWin
                                    ? "bg-[#FF9500] text-white"
                                    : isPod
                                    ? "bg-[#34C759] text-white"
                                    : "bg-[#F2F2F7] text-[#86868B]"
                                }`}
                              >
                                {pos === 1 ? "1st ✓" : pos === 2 ? "2nd ✓" : pos === 3 ? "3rd ✓" : `${pos}th`}
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#86868B]">Unplaced</span>
                            )}
                            <span className="font-semibold text-xs text-[#1D1D1F]">
                              {scoringMode === "dollars"
                                ? `+$${pick.dollarReturn.toFixed(2)}`
                                : `+${pick.points}p`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-white border border-[#E5E5EA] text-center">
                    <button
                      type="button"
                      onClick={() =>
                        onEditUserSelections &&
                        onEditUserSelections(punter.id, activeMeeting.id)
                      }
                      className="text-[11px] font-medium text-[#0071E3] hover:underline cursor-pointer"
                    >
                      + Make Selections for {punter.name}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
