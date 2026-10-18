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
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? "bg-[#D4AF37] text-[#070B09] font-black shadow-sm"
                      : "bg-[#14231B] text-[#8A9990] hover:text-[#F3F4F0] border border-[#23352B]"
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
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#D4AF37] font-semibold">
              Race Selector:
            </span>
            <span className="text-xs text-[#8A9990] font-mono">
              {showAllRaces
                ? `Showing All ${activeMeeting.races.length} Races on Card`
                : `${participatedRaceNumbers.size} of ${activeMeeting.races.length} Races Tipped by Syndicate`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAllRaces((prev) => !prev)}
              className={`px-3 py-1 rounded-xl text-xs font-mono transition cursor-pointer flex items-center gap-1.5 ${
                !showAllRaces
                  ? "bg-[#152920] border border-[#10B981]/60 text-[#10B981] font-bold shadow-sm"
                  : "bg-[#09100D] border border-[#1E2E25] text-[#D4AF37] hover:border-[#D4AF37]"
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
                className="px-2.5 py-1 rounded-xl bg-[#09100D] border border-[#1E2E25] text-xs font-mono text-[#8A9990] hover:text-[#F3F4F0] cursor-pointer"
              >
                All Races ({activeMeeting.races.length})
              </button>
            )}
          </div>
        </div>

        {/* Horizontal Race Strip with Winner / Status Preview */}
        {displayedRaces.length === 0 ? (
          <div className="p-4 rounded-2xl bg-[#09100D] border border-[#1E2E25] text-center text-xs font-mono text-[#8A9990] space-y-2">
            <p className="text-[#F3F4F0] font-semibold">
              No syndicate tips entered for {activeMeeting.venue} yet.
            </p>
            <p className="text-[11px]">
              Filter is defaulting to participated races.
            </p>
            <button
              type="button"
              onClick={() => setShowAllRaces(true)}
              className="px-3 py-1 rounded-xl bg-[#D4AF37] text-[#070B09] font-bold hover:bg-[#e3be42] cursor-pointer"
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
                  className={`p-2 rounded-2xl font-mono text-xs transition cursor-pointer shrink-0 border text-left min-w-[110px] ${
                    isSelected
                      ? "bg-[#1C2C23] border-[#10B981] shadow-md ring-1 ring-[#10B981]"
                      : isFin
                      ? "bg-[#101914] border-[#1E2E25] text-[#D5DDD8] hover:border-[#10B981]/50"
                      : "bg-[#09100D] border-[#1A2620] text-[#6B7D73] hover:text-[#D5DDD8]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-black text-xs text-[#F3F4F0] flex items-center gap-1">
                      <span>R{race.raceNumber}</span>
                      {isTipped && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-[#10B981]"
                          title="Syndicate Tips Active"
                        />
                      )}
                    </span>
                    <span
                      className={`text-[9px] px-1 rounded uppercase font-bold ${
                        isFin
                          ? "bg-[#10B981]/20 text-[#10B981]"
                          : "bg-[#D4AF37]/20 text-[#D4AF37]"
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
        <div className="lg:col-span-7 rounded-3xl border border-white/[0.08] bg-[#0E1512]/95 backdrop-blur-xl p-5 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#1E2E25]">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#D4AF37]" />
              <h3 className="font-display font-bold text-base text-[#F3F4F0]">
                Official Finishing Order &amp; Margin Telemetry
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[#8A9990]">
              {finishedRunners.length} Runners Finished
            </span>
          </div>

          {!isCurrentRaceFinished ? (
            <div className="p-6 rounded-2xl bg-[#09100D] border border-[#1E2E25] text-center space-y-2">
              <Clock className="w-6 h-6 text-[#D4AF37] mx-auto animate-pulse" />
              <div className="text-sm font-bold text-[#F3F4F0]">
                Official Results Awaiting Post-Race Declaration
              </div>
              <p className="text-xs text-[#8A9990] font-mono max-w-sm mx-auto">
                Official margins, finishing orders, and dividends will populate automatically as soon as stewards confirm correct weight for Race {activeRace.raceNumber}.
              </p>
            </div>
          ) : (
            <div className="space-y-2 overflow-x-auto">
              {finishedRunners.slice(0, 8).map((runner, idx) => {
                const pos = runner.finishPosition;
                const isWinner = pos === 1;
                const isPodium = pos >= 1 && pos <= 3;
                const winOdds = Number(runner.fixedWin || runner.nswTabWin) || 0;
                const placeOdds = Number(runner.fixedPlace || runner.nswTabPlace) || 0;
                const marginText = runner.margin || (isWinner ? "Winner" : `${(idx * 0.75).toFixed(2)}L`);

                return (
                  <div
                    key={runner.tabNumber}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 font-mono text-xs ${
                      isWinner
                        ? "bg-[#D4AF37]/15 border-[#D4AF37] shadow-[0_4px_20px_rgba(212,175,55,0.15)]"
                        : pos === 2
                        ? "bg-[#18261E] border-slate-400/50"
                        : pos === 3
                        ? "bg-[#16231C] border-amber-600/40"
                        : "bg-[#09100D] border-[#1C2C23] hover:border-[#2A3F33]"
                    }`}
                  >
                    {/* Place Badge & Silk & Horse Info */}
                    <div className="flex items-center gap-3 truncate">
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                          isWinner
                            ? "bg-[#D4AF37] text-[#070B09]"
                            : pos === 2
                            ? "bg-slate-300 text-[#070B09]"
                            : pos === 3
                            ? "bg-amber-600 text-[#070B09]"
                            : "bg-[#18241E] text-[#8A9990]"
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
                          <span className="font-bold text-[#F3F4F0] text-sm truncate">
                            #{runner.tabNumber} {runner.horseName}
                          </span>
                          <span className="text-[10px] text-[#8A9990] shrink-0">
                            (B{runner.barrier})
                          </span>
                        </div>
                        <div className="text-[10px] text-[#8A9990] truncate">
                          J: {runner.jockey} · T: {runner.trainer} ({runner.weight}kg)
                        </div>
                      </div>
                    </div>

                    {/* Margins & Dividends */}
                    <div className="flex items-center gap-3 shrink-0 text-right">
                      {/* Margin Lengths */}
                      <div className="text-right">
                        <span className="text-[10px] text-[#8A9990] block uppercase">
                          Margin
                        </span>
                        <span
                          className={`font-bold text-xs ${
                            isWinner ? "text-[#D4AF37]" : "text-[#D5DDD8]"
                          }`}
                        >
                          {marginText}
                        </span>
                      </div>

                      {/* Official Payout Odds */}
                      <div className="text-right pl-3 border-l border-[#1C2C23]">
                        <span className="text-[10px] text-[#8A9990] block uppercase">
                          TAB Div
                        </span>
                        <span className="font-bold text-xs text-[#10B981]">
                          ${winOdds > 0 ? winOdds.toFixed(2) : "—"}{" "}
                          {placeOdds > 0 && (
                            <span className="text-[10px] text-[#8A9990]">
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
          <div className="rounded-3xl border border-white/[0.08] bg-[#0E1512]/95 backdrop-blur-xl p-5 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E2E25]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                <h3 className="font-display font-bold text-base text-[#F3F4F0]">
                  Official TAB Exotic Dividends
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] font-bold">
                NSW TAB Pool
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
              {/* Trifecta */}
              <div className="p-3 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/40 space-y-0.5 col-span-2">
                <div className="flex items-center justify-between text-[10px] text-[#D4AF37] font-bold uppercase">
                  <span>Trifecta ({exoticDividends.trifecta.combination})</span>
                  <span>100% Full Unit</span>
                </div>
                <div className="text-xl font-black text-[#D4AF37]">
                  ${exoticDividends.trifecta.dividend.toFixed(2)}
                </div>
              </div>

              {/* Quinella */}
              <div className="p-3 rounded-2xl bg-[#09100D] border border-[#1E2E25] space-y-0.5">
                <div className="flex items-center justify-between text-[10px] text-[#8A9990] font-bold uppercase">
                  <span>Quinella</span>
                  <span>{exoticDividends.quinella?.combination || "1st & 2nd"}</span>
                </div>
                <div className="text-base font-bold text-[#F3F4F0]">
                  ${exoticDividends.quinella?.dividend?.toFixed(2) || "—"}
                </div>
              </div>

              {/* Exacta */}
              <div className="p-3 rounded-2xl bg-[#09100D] border border-[#1E2E25] space-y-0.5">
                <div className="flex items-center justify-between text-[10px] text-[#8A9990] font-bold uppercase">
                  <span>Exacta</span>
                  <span>{exoticDividends.exacta?.combination || "1st then 2nd"}</span>
                </div>
                <div className="text-base font-bold text-[#F3F4F0]">
                  ${exoticDividends.exacta?.dividend?.toFixed(2) || "—"}
                </div>
              </div>

              {/* First 4 */}
              <div className="p-3 rounded-2xl bg-[#09100D] border border-[#1E2E25] space-y-0.5 col-span-2">
                <div className="flex items-center justify-between text-[10px] text-[#8A9990] font-bold uppercase">
                  <span>First 4</span>
                  <span>{exoticDividends.first4?.combination || "Top 4 Finishers"}</span>
                </div>
                <div className="text-base font-bold text-[#10B981]">
                  ${exoticDividends.first4?.dividend?.toFixed(2) || "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Flexi Dividend & Return Simulator */}
          <div className="rounded-3xl border border-white/[0.08] bg-[#0E1512]/95 backdrop-blur-xl p-5 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1E2E25]">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#10B981]" />
                <h3 className="font-display font-bold text-base text-[#F3F4F0]">
                  Interactive Flexi Payout Simulator
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[#8A9990]">
                Live Return Calculator
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {/* Stake Presets */}
              <div>
                <label className="text-[10px] text-[#8A9990] block uppercase mb-1">
                  Syndicate Outlay / Stake:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[10, 20, 50, 100].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setSimulatedStake(amt)}
                      className={`py-1.5 rounded-xl font-bold transition cursor-pointer ${
                        simulatedStake === amt
                          ? "bg-[#10B981] text-[#070B09] font-black"
                          : "bg-[#14231B] text-[#8A9990] hover:text-[#F3F4F0] border border-[#23352B]"
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Flexi Formula Telemetry */}
              <div className="p-3 rounded-2xl bg-[#09100D] border border-[#1E2E25] space-y-1.5">
                <div className="flex items-center justify-between text-[#8A9990] text-[11px]">
                  <span>Ticket Combinations:</span>
                  <span className="text-[#F3F4F0] font-bold">{combinationsCount} Combos</span>
                </div>
                <div className="flex items-center justify-between text-[#8A9990] text-[11px]">
                  <span>Applied Flexi %:</span>
                  <span className="text-[#10B981] font-bold">
                    {actualFlexiPct.toFixed(2)}% Flexi
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#8A9990] text-[11px] pt-1 border-t border-[#1C2C23]">
                  <span>Per-Member Share ({punters.length} Punters):</span>
                  <span className="text-[#D4AF37] font-bold">
                    {(actualFlexiPct / Math.max(1, punters.length)).toFixed(2)}% each
                  </span>
                </div>
              </div>

              {/* Projected Collect & Net Payout */}
              <div className="p-4 rounded-2xl bg-[#14231B] border border-[#10B981]/50 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#8A9990] uppercase block">
                    Calculated Flexi Collect
                  </span>
                  <div className="text-2xl font-black text-[#10B981]">
                    ${simulatedCollect.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#8A9990] uppercase block">
                    Net Profit / ROI
                  </span>
                  <div
                    className={`text-sm font-black ${
                      simulatedNetProfit >= 0 ? "text-[#10B981]" : "text-rose-400"
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
      <div className="rounded-3xl border border-white/[0.08] bg-[#0E1512]/95 backdrop-blur-xl p-5 sm:p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1E2E25]">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#D4AF37]" />
            <h3 className="font-display font-bold text-base text-[#F3F4F0]">
              Syndicate Member Head-to-Head Accuracy (Race {activeRace.raceNumber})
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-[#8A9990]">Display Mode:</span>
            <button
              type="button"
              onClick={() => onToggleScoringMode("points")}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                scoringMode === "points"
                  ? "bg-[#D4AF37] text-[#070B09]"
                  : "bg-[#14231B] text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              Points (3/2/1)
            </button>
            <button
              type="button"
              onClick={() => onToggleScoringMode("dollars")}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                scoringMode === "dollars"
                  ? "bg-[#10B981] text-[#070B09]"
                  : "bg-[#14231B] text-[#8A9990] hover:text-[#F3F4F0]"
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
                className="p-4 rounded-2xl bg-[#09100D] border border-[#1E2E25] space-y-3 font-mono text-xs"
              >
                {/* Header: Name + Score */}
                <div className="flex items-center justify-between pb-2 border-b border-[#1C2C23]">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-[#14231B] border border-[#23352B] flex items-center justify-center font-bold text-xs text-[#D4AF37]">
                      {punter.name.charAt(0)}
                    </span>
                    <div>
                      <div className="font-bold text-[#F3F4F0] flex items-center gap-1.5">
                        <span>{punter.name}</span>
                        {isJoker && (
                          <span className="text-[9px] px-1 rounded bg-[#D4AF37] text-[#070B09] font-black">
                            🃏 2x JOKER
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#8A9990]">
                        {hasPicks ? "3 Selections Registered" : "No Tips Logged"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-[#8A9990] block uppercase">
                      Race Score
                    </span>
                    <span className="font-black text-sm text-[#10B981]">
                      {scoringMode === "dollars"
                        ? formatDollarReturn(raceDollarReturn)
                        : `${racePoints} pts`}
                    </span>
                  </div>
                </div>

                {/* 3 Picks Breakdown */}
                {hasPicks ? (
                  <div className="space-y-1.5">
                    {evalResult.picks.map((pick) => {
                      const pos = pick.runner?.finishPosition || 0;
                      const isWin = pos === 1;
                      const isPod = pos >= 1 && pos <= 3;
                      const horse = pick.runner;

                      return (
                        <div
                          key={pick.preferenceRank}
                          className={`p-2 rounded-xl border flex items-center justify-between gap-2 ${
                            isWin
                              ? "bg-[#D4AF37]/15 border-[#D4AF37]/60"
                              : isPod
                              ? "bg-[#14231B] border-[#10B981]/40"
                              : "bg-[#0B1410] border-[#18241D]"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-[9px] px-1 rounded bg-[#16231C] text-[#8A9990] font-bold">
                              {pick.preferenceRank === 1 ? "1st" : pick.preferenceRank === 2 ? "2nd" : "3rd"}
                            </span>
                            <span className="font-bold text-[#F3F4F0] truncate">
                              #{pick.tabNumber} {horse?.horseName || "Runner"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 text-right">
                            {pos > 0 ? (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  isWin
                                    ? "bg-[#D4AF37] text-[#070B09]"
                                    : isPod
                                    ? "bg-[#10B981] text-[#070B09]"
                                    : "bg-[#18261E] text-[#8A9990]"
                                }`}
                              >
                                {pos === 1 ? "1st ✓" : pos === 2 ? "2nd ✓" : pos === 3 ? "3rd ✓" : `${pos}th`}
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#6B7D73]">Unplaced</span>
                            )}
                            <span className="font-bold text-xs text-[#D5DDD8]">
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
                  <div className="p-3 rounded-xl bg-[#0B1410] border border-[#18241D] text-center">
                    <button
                      type="button"
                      onClick={() =>
                        onEditUserSelections &&
                        onEditUserSelections(punter.id, activeMeeting.id)
                      }
                      className="text-[11px] font-sans text-[#D4AF37] hover:underline cursor-pointer"
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
