import React, { useState, useMemo } from "react";
import {
  Layers,
  Sparkles,
  Trophy,
  DollarSign,
  CheckCircle2,
  Check,
  Target,
  Sliders,
  RotateCcw,
  Clock,
  Users,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info,
  Calendar,
  MapPin,
  Flame,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  RaceEvent,
  RaceMeeting,
  RaceRunner,
  PunterProfile,
} from "../types/racing";
import {
  CombinedRaceTrifectaEvaluation,
  CombinedMeetingQuaddieEvaluation,
  evaluateCombinedTrifectaForRace,
  evaluateCombinedQuaddieForMeeting,
  computeQuaddieLeg4SweatScenarios,
  formatDollarReturn,
  computeTabFlexiBetMetrics,
  DEFAULT_QUADDIE_BUY_IN_PER_USER,
  TrifectaBetType,
  isRunnerScratched,
} from "../utils/scoring";
import { TactileOddsFlucBadge } from "./TactileOddsFlucBadge";
import { JockeySilkSvg } from "./JockeySilkSvg";

export interface ExoticsBentoStudioProps {
  meetings: RaceMeeting[];
  selectedMeetingId: string;
  onSelectMeeting: (id: string) => void;
  selectedMeetingIds?: string[];
  onChangeSelectedMeetingIds?: (ids: string[]) => void;
  punters: PunterProfile[];
  activePunterId: string;
  onSelectPunter: (id: string) => void;
  trifectaBetAmount: number;
  onChangeTrifectaBetAmount: (amount: number) => void;
  quaddieBuyInPerUser: number;
  onChangeQuaddieBuyInPerUser: (buyIn: number) => void;
  quaddieExtraByMeeting: Record<string, Record<number, number[]>>;
  onToggleQuaddieExtraRunner: (
    meetingId: string,
    raceNumber: number,
    tabNumber: number
  ) => void;
  onClearQuaddieExtrasForLeg: (meetingId: string, raceNumber: number) => void;
  onJumpToSelections: (punterId?: string, meetingId?: string) => void;
  onTriggerToast?: (msg: string) => void;
}

export type ExoticsViewFilter = "all" | "trifectas" | "quaddies";

export const ExoticsBentoStudio: React.FC<ExoticsBentoStudioProps> = ({
  meetings,
  selectedMeetingId,
  onSelectMeeting,
  punters,
  activePunterId,
  trifectaBetAmount,
  onChangeTrifectaBetAmount,
  quaddieBuyInPerUser,
  onChangeQuaddieBuyInPerUser,
  quaddieExtraByMeeting,
  onToggleQuaddieExtraRunner,
  onClearQuaddieExtrasForLeg,
  onJumpToSelections,
  onTriggerToast,
}) => {
  const [activeFilter, setActiveFilter] = useState<ExoticsViewFilter>("all");
  const [expandedLegs, setExpandedLegs] = useState<Record<number, boolean>>({});

  const activeMeeting = useMemo(() => {
    return meetings.find((m) => m.id === selectedMeetingId) || meetings[0];
  }, [meetings, selectedMeetingId]);

  // Selected race for focused Trifecta customizer
  const [selectedRaceNo, setSelectedRaceNo] = useState<number>(() => {
    return activeMeeting?.races[0]?.raceNumber || 1;
  });

  // Ensure selectedRaceNo stays valid when meeting changes
  const activeRace = useMemo(() => {
    if (!activeMeeting) return null;
    return (
      activeMeeting.races.find((r) => r.raceNumber === selectedRaceNo) ||
      activeMeeting.races[0] ||
      null
    );
  }, [activeMeeting, selectedRaceNo]);

  // Evaluate Quaddie for active meeting
  const quaddieEval: CombinedMeetingQuaddieEvaluation | null = useMemo(() => {
    if (!activeMeeting) return null;
    return evaluateCombinedQuaddieForMeeting(
      activeMeeting,
      punters,
      quaddieExtraByMeeting[activeMeeting.id] || {},
      quaddieBuyInPerUser
    );
  }, [activeMeeting, punters, quaddieExtraByMeeting, quaddieBuyInPerUser]);

  // Evaluate Trifecta for active race
  const activeTrifectaEval: CombinedRaceTrifectaEvaluation | null = useMemo(() => {
    if (!activeMeeting || !activeRace) return null;
    return evaluateCombinedTrifectaForRace(
      activeRace,
      punters,
      activeMeeting.id,
      activeMeeting.date,
      trifectaBetAmount,
      activeMeeting.venue
    );
  }, [activeMeeting, activeRace, punters, trifectaBetAmount]);

  // Evaluate all Trifectas across active meeting
  const allTrifectaEvals = useMemo(() => {
    if (!activeMeeting) return [];
    return activeMeeting.races.map((r) => ({
      race: r,
      evaluation: evaluateCombinedTrifectaForRace(
        r,
        punters,
        activeMeeting.id,
        activeMeeting.date,
        trifectaBetAmount,
        activeMeeting.venue
      ),
    }));
  }, [activeMeeting, punters, trifectaBetAmount]);

  // Leg 4 sweat scenarios
  const leg4SweatScenarios = useMemo(() => {
    if (!quaddieEval || quaddieEval.legs.length < 4) return [];
    return computeQuaddieLeg4SweatScenarios(quaddieEval);
  }, [quaddieEval]);

  // Trifecta mode customization state for active race
  const [customTrifectaMode, setCustomTrifectaMode] = useState<TrifectaBetType>("flexi_standout");
  const [standoutTab, setStandoutTab] = useState<number | null>(null);
  const [flexiTabs, setFlexiTabs] = useState<number[]>([]);

  // Synchronize initial trifecta selections when active race changes
  React.useEffect(() => {
    if (!activeRace) return;
    const sorted = [...activeRace.runners]
      .filter((r) => !isRunnerScratched(r))
      .sort((a, b) => {
        const oA = Number(a.fixedWin || a.nswTabWin) || 99;
        const oB = Number(b.fixedWin || b.nswTabWin) || 99;
        return oA - oB;
      });

    // Check if sub-$1.90 favourite exists
    const sub19 = sorted.find((r) => {
      const w = Number(r.fixedWin || r.nswTabWin);
      return Number.isFinite(w) && w > 0 && w < 1.9;
    });

    if (sub19) {
      setCustomTrifectaMode("flexi_standout");
      setStandoutTab(sub19.tabNumber);
      const others = sorted
        .filter((r) => r.tabNumber !== sub19.tabNumber)
        .slice(0, 3)
        .map((r) => r.tabNumber);
      setFlexiTabs(others);
    } else {
      setCustomTrifectaMode("flexi_standout");
      if (sorted[0]) {
        setStandoutTab(sorted[0].tabNumber);
        setFlexiTabs(sorted.slice(1, 4).map((r) => r.tabNumber));
      }
    }
  }, [activeRace?.raceNumber, activeMeeting?.id]);

  if (!activeMeeting) {
    return (
      <div className="p-8 text-center text-[#8A9990] font-mono">
        No active race meetings available.
      </div>
    );
  }

  const trifectaHitsCount = allTrifectaEvals.filter(
    (e) => e.evaluation.isCombinedBoxedTrifectaHit
  ).length;

  const totalTrifectaPoolStaked = allTrifectaEvals.length * trifectaBetAmount;
  const totalTrifectaPoolCollected = allTrifectaEvals.reduce(
    (sum, e) => sum + e.evaluation.customBetFlexiReturn,
    0
  );

  const quaddieStaked = quaddieEval ? quaddieEval.quaddieBetAmount : 0;
  const quaddieCollected = quaddieEval?.isQuaddieWon ? quaddieEval.wonQuaddieReturn : 0;

  const totalExoticsStaked = totalTrifectaPoolStaked + quaddieStaked;
  const totalExoticsCollected = totalTrifectaPoolCollected + quaddieCollected;
  const netExoticsProfit = totalExoticsCollected - totalExoticsStaked;

  return (
    <div className="space-y-6 pb-20 animate-fade-in font-sans">
      {/* ====================================================================
          APPLE-STYLE BENTO HERO: EXOTICS CONTROL DESK
         ==================================================================== */}
      <div className="rounded-3xl border border-white/[0.08] bg-[#0E1512]/95 backdrop-blur-xl p-5 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-[#1E2E25] pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-mono font-bold tracking-wider uppercase">
                <Target className="w-3.5 h-3.5" />
                Exotics Bento Studio
              </span>
              <span className="text-xs text-[#8A9990] font-mono">
                Pari-Mutuel &amp; Flexi Suite
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-[#F3F4F0] tracking-tight">
              Syndicate Trifectas &amp; Quaddies
            </h1>
            <p className="text-sm text-[#8A9990] mt-1 max-w-2xl leading-relaxed">
              Curate, customize, and sweat multi-leg exotic wagers with unified TAB Flexi calculations, automatic sub-$1.90 standout banker logic, and real-time combination multipliers.
            </p>
          </div>

          {/* Apple Segmented Control */}
          <div className="flex items-center gap-1 bg-[#080D0B] p-1.5 rounded-2xl border border-[#1E2E25] self-start lg:self-center">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFilter === "all"
                  ? "bg-[#D4AF37] text-[#070B09] font-bold shadow-md"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Exotics</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("trifectas")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFilter === "trifectas"
                  ? "bg-[#D4AF37] text-[#070B09] font-bold shadow-md"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Trifectas</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("quaddies")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFilter === "quaddies"
                  ? "bg-[#10B981] text-[#070B09] font-bold shadow-md"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Quaddies (4 Legs)</span>
            </button>
          </div>
        </div>

        {/* Meeting Selector Ribbon & KPI Bento Strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          {/* Tile 1: Venue Selector */}
          <div className="p-4 rounded-2xl bg-[#121C17]/80 border border-[#23352B] flex flex-col justify-between">
            <span className="text-xs font-mono text-[#8A9990] uppercase tracking-wider">
              Selected Venue
            </span>
            <div className="mt-2">
              <select
                aria-label="Select Venue"
                value={activeMeeting.id}
                onChange={(e) => onSelectMeeting(e.target.value)}
                className="w-full bg-[#080D0B] border border-[#23352B] rounded-xl px-3 py-2 text-sm font-display font-bold text-[#F3F4F0] focus:border-[#D4AF37] outline-none cursor-pointer"
              >
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.venue} ({m.state}) · {m.races.length} Races
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-[#8A9990] font-mono">
              <Calendar className="w-3 h-3 text-[#D4AF37]" />
              <span>{activeMeeting.date}</span>
              <span>·</span>
              <span>{activeMeeting.trackCondition || "Good 4"}</span>
            </div>
          </div>

          {/* Tile 2: Total Syndicate Staked */}
          <div className="p-4 rounded-2xl bg-[#121C17]/80 border border-[#23352B] flex flex-col justify-between">
            <span className="text-xs font-mono text-[#8A9990] uppercase tracking-wider">
              Exotics Capital Staked
            </span>
            <div className="mt-1">
              <span className="text-2xl sm:text-3xl font-display font-bold text-[#F3F4F0]">
                ${totalExoticsStaked.toFixed(2)}
              </span>
              <span className="text-xs text-[#8A9990] font-mono ml-2">
                combined
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs font-mono text-[#8A9990]">
              <span>Trifectas: ${totalTrifectaPoolStaked}</span>
              <span>·</span>
              <span>Quaddie: ${quaddieStaked}</span>
            </div>
          </div>

          {/* Tile 3: Total Payout / Collect */}
          <div className="p-4 rounded-2xl bg-[#121C17]/80 border border-[#23352B] flex flex-col justify-between">
            <span className="text-xs font-mono text-[#8A9990] uppercase tracking-wider">
              Exotics Return
            </span>
            <div className="mt-1">
              <span
                className={`text-2xl sm:text-3xl font-display font-bold ${
                  totalExoticsCollected > 0 ? "text-[#10B981]" : "text-[#D5DDD8]"
                }`}
              >
                ${totalExoticsCollected.toFixed(2)}
              </span>
              {netExoticsProfit !== 0 && (
                <span
                  className={`text-xs font-mono font-bold ml-2 ${
                    netExoticsProfit > 0 ? "text-[#10B981]" : "text-rose-400"
                  }`}
                >
                  {netExoticsProfit > 0 ? `+${formatDollarReturn(netExoticsProfit)}` : formatDollarReturn(netExoticsProfit)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs font-mono text-[#8A9990]">
              <span>Hits: {trifectaHitsCount} Trifectas</span>
              <span>·</span>
              <span>{quaddieEval?.isQuaddieWon ? "Quaddie HIT! 🎯" : "Quaddie Pending"}</span>
            </div>
          </div>

          {/* Tile 4: Active Punters */}
          <div className="p-4 rounded-2xl bg-[#121C17]/80 border border-[#23352B] flex flex-col justify-between">
            <span className="text-xs font-mono text-[#8A9990] uppercase tracking-wider">
              Syndicate Allocation
            </span>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {punters.map((p) => (
                <span
                  key={p.id}
                  className="px-2 py-0.5 rounded-lg bg-[#080D0B] border border-[#23352B] text-xs font-mono text-[#D5DDD8]"
                >
                  {p.name.split(" ")[0]}
                </span>
              ))}
            </div>
            <div className="mt-2 text-xs font-mono text-[#D4AF37] flex items-center justify-between">
              <span>Buy-in: ${quaddieBuyInPerUser}/punter</span>
              <button
                type="button"
                onClick={() => onJumpToSelections()}
                className="hover:underline flex items-center gap-1 text-[#10B981] cursor-pointer"
              >
                <span>Edit Picks</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          BENTO SECTION 1: COMBINED TRIFECTA SUITE
         ==================================================================== */}
      {(activeFilter === "all" || activeFilter === "trifectas") && activeRace && (
        <div className="rounded-3xl border border-white/[0.08] bg-[#0E1512]/95 backdrop-blur-xl p-5 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.4)] space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1E2E25] pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] font-mono text-xs font-bold uppercase">
                  Trifecta Suite
                </span>
                <span className="text-xs text-[#8A9990] font-mono">
                  Race {activeRace.raceNumber} of {activeMeeting.races.length}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F3F4F0] mt-1">
                Race {activeRace.raceNumber}: {activeRace.raceName}
              </h2>
              <p className="text-xs text-[#8A9990] font-mono mt-0.5">
                Jumps {activeRace.startTime} · {activeRace.distance}m · Track: {activeMeeting.trackCondition || "Good 4"} · Rail: {activeMeeting.railPosition || "True"}
              </p>
            </div>

            {/* Race Quick Switcher Ribbon */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              {activeMeeting.races.map((r) => {
                const isSelected = r.raceNumber === activeRace.raceNumber;
                return (
                  <button
                    key={r.raceNumber}
                    type="button"
                    onClick={() => setSelectedRaceNo(r.raceNumber)}
                    className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer shrink-0 ${
                      isSelected
                        ? "bg-[#D4AF37] text-[#070B09] shadow-sm"
                        : "bg-[#121C17] text-[#8A9990] border border-[#23352B] hover:text-[#F3F4F0]"
                    }`}
                  >
                    R{r.raceNumber}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bento Grid: Trifecta Customizer + Calculations */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Mode Selection & Runner Matrix */}
            <div className="lg:col-span-2 space-y-4">
              {/* Mode Toggle Controls */}
              <div className="p-4 rounded-2xl bg-[#121C17]/90 border border-[#23352B] space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#D4AF37]">
                    Trifecta Construction Mode
                  </span>
                  <div className="flex items-center gap-1 bg-[#080D0B] p-1 rounded-xl border border-[#1E2E25]">
                    <button
                      type="button"
                      onClick={() => setCustomTrifectaMode("flexi_standout")}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                        customTrifectaMode === "flexi_standout"
                          ? "bg-[#D4AF37] text-[#070B09] font-bold"
                          : "text-[#8A9990] hover:text-[#F3F4F0]"
                      }`}
                    >
                      Standout Flexi
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomTrifectaMode("flexi_boxed")}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                        customTrifectaMode === "flexi_boxed"
                          ? "bg-[#D4AF37] text-[#070B09] font-bold"
                          : "text-[#8A9990] hover:text-[#F3F4F0]"
                      }`}
                    >
                      Boxed
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomTrifectaMode("roving_banker")}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                        customTrifectaMode === "roving_banker"
                          ? "bg-[#D4AF37] text-[#070B09] font-bold"
                          : "text-[#8A9990] hover:text-[#F3F4F0]"
                      }`}
                    >
                      Roving Banker
                    </button>
                  </div>
                </div>

                {/* Sub-$1.90 favourite callout banner */}
                {(() => {
                  const sorted = [...activeRace.runners]
                    .filter((r) => !isRunnerScratched(r))
                    .sort((a, b) => (Number(a.fixedWin || a.nswTabWin) || 99) - (Number(b.fixedWin || b.nswTabWin) || 99));
                  const fav = sorted[0];
                  const favOdds = Number(fav?.fixedWin || fav?.nswTabWin || 0);
                  if (favOdds > 0 && favOdds < 1.9) {
                    return (
                      <div className="p-3 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center gap-2.5 text-xs text-[#D5DDD8]">
                        <Flame className="w-4 h-4 text-[#D4AF37] shrink-0" />
                        <div>
                          <strong className="text-[#D4AF37]">Standout Banker Rule Triggered:</strong>{" "}
                          #{fav.tabNumber} {fav.horseName} is paying ${favOdds.toFixed(2)} (&lt; $1.90). Automatically anchored as Standout Banker with remaining selections as Flexi legs.
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                <p className="text-xs text-[#8A9990]">
                  {customTrifectaMode === "flexi_standout"
                    ? "Standout Banker locks 1st place to your top pick; flexi legs complete 2nd & 3rd in any order for maximum dividend leverage."
                    : customTrifectaMode === "flexi_boxed"
                    ? "Boxed Trifecta hits if your chosen runners finish 1st, 2nd, and 3rd in any order across all permutations."
                    : "Roving Banker includes your banker across 1st, 2nd, or 3rd with flexi legs filling remaining spots."}
                </p>
              </div>

              {/* Runners Selection Table */}
              <div className="rounded-2xl border border-[#23352B] bg-[#0A120E] overflow-hidden">
                <div className="px-4 py-2.5 bg-[#080D0B] border-b border-[#1E2E25] flex items-center justify-between gap-2 flex-wrap text-xs font-mono text-[#8A9990]">
                  <span>Field ({activeRace.runners.length} runners)</span>
                  <div className="flex items-center gap-1.5">
                    {customTrifectaMode === "flexi_boxed" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const sorted = [...activeRace.runners]
                              .filter((r) => !isRunnerScratched(r))
                              .sort(
                                (a, b) =>
                                  (Number(a.fixedWin || a.nswTabWin) || 99) -
                                  (Number(b.fixedWin || b.nswTabWin) || 99)
                              );
                            setFlexiTabs(sorted.slice(0, 3).map((r) => r.tabNumber));
                          }}
                          className="px-2 py-0.5 rounded-lg bg-[#14231B] border border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981]/20 font-bold cursor-pointer"
                        >
                          Box Top 3
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const sorted = [...activeRace.runners]
                              .filter((r) => !isRunnerScratched(r))
                              .sort(
                                (a, b) =>
                                  (Number(a.fixedWin || a.nswTabWin) || 99) -
                                  (Number(b.fixedWin || b.nswTabWin) || 99)
                              );
                            setFlexiTabs(sorted.slice(0, 4).map((r) => r.tabNumber));
                          }}
                          className="px-2 py-0.5 rounded-lg bg-[#14231B] border border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981]/20 font-bold cursor-pointer"
                        >
                          Box Top 4
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const sorted = [...activeRace.runners]
                              .filter((r) => !isRunnerScratched(r))
                              .sort(
                                (a, b) =>
                                  (Number(a.fixedWin || a.nswTabWin) || 99) -
                                  (Number(b.fixedWin || b.nswTabWin) || 99)
                              );
                            if (sorted[0]) {
                              setStandoutTab(sorted[0].tabNumber);
                              setFlexiTabs(sorted.slice(1, 4).map((r) => r.tabNumber));
                            }
                          }}
                          className="px-2 py-0.5 rounded-lg bg-[#201A0E] border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/20 font-bold cursor-pointer"
                        >
                          Fav + Top 3 Flexi
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setStandoutTab(null);
                        setFlexiTabs([]);
                      }}
                      className="px-2 py-0.5 rounded-lg text-rose-400 hover:bg-rose-950/40 border border-rose-900/40 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-[#17231C] max-h-80 overflow-y-auto">
                  {activeRace.runners.map((r) => {
                    const isScr = isRunnerScratched(r);
                    const isStandout = standoutTab === r.tabNumber;
                    const isFlexi = flexiTabs.includes(r.tabNumber);
                    const winOdds = Number(r.fixedWin || r.nswTabWin || 0);

                    return (
                      <div
                        key={r.tabNumber}
                        className={`p-3 flex items-center justify-between gap-3 transition ${
                          isScr
                            ? "opacity-40 bg-[#060A08]"
                            : isStandout
                            ? "bg-[#D4AF37]/15"
                            : isFlexi
                            ? "bg-[#10B981]/10"
                            : "hover:bg-[#101A14]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                              isStandout
                                ? "bg-[#D4AF37] text-[#070B09]"
                                : isFlexi
                                ? "bg-[#10B981] text-[#070B09]"
                                : "bg-[#16231C] text-[#D5DDD8] border border-[#23352B]"
                            }`}
                          >
                            {r.tabNumber}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-sm text-[#F3F4F0]">
                                {r.horseName}
                              </span>
                              {isScr && (
                                <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 font-mono text-[9px] font-bold">
                                  SCR
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#8A9990] font-mono">
                              B{r.barrier} · {r.jockey} · Form: {r.form || "—"}
                            </div>
                          </div>
                        </div>

                        {/* Odds & Action Buttons */}
                        <div className="flex items-center gap-3">
                          <div className="text-right font-mono">
                            <span className="text-sm font-bold text-[#F3F4F0]">
                              {winOdds > 0 ? `$${winOdds.toFixed(2)}` : "—"}
                            </span>
                            <TactileOddsFlucBadge
                              openingOdds={r.openingOdds}
                              currentOdds={winOdds}
                              size="sm"
                              className="ml-1"
                            />
                          </div>

                          {/* Action Buttons */}
                          {!isScr && (
                            <div className="flex items-center gap-1.5">
                              {customTrifectaMode === "flexi_boxed" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isFlexi) {
                                      setFlexiTabs((prev) =>
                                        prev.filter((t) => t !== r.tabNumber)
                                      );
                                    } else {
                                      setFlexiTabs((prev) => [...prev, r.tabNumber]);
                                    }
                                  }}
                                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border transition cursor-pointer ${
                                    isFlexi
                                      ? "bg-[#10B981] text-[#070B09] border-[#10B981] shadow-sm"
                                      : "bg-[#080D0B] text-[#10B981] border-[#10B981]/30 hover:bg-[#10B981]/15"
                                  }`}
                                >
                                  {isFlexi ? "✓ In Boxed" : "+ Box Runner"}
                                </button>
                              ) : (
                                <>
                                  {/* Standout Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isStandout) {
                                        setStandoutTab(null);
                                      } else {
                                        setStandoutTab(r.tabNumber);
                                        setFlexiTabs((prev) =>
                                          prev.filter((t) => t !== r.tabNumber)
                                        );
                                      }
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition cursor-pointer ${
                                      isStandout
                                        ? "bg-[#D4AF37] text-[#070B09] border-[#D4AF37]"
                                        : "bg-[#080D0B] text-[#D4AF37] border-[#D4AF37]/30 hover:bg-[#D4AF37]/15"
                                    }`}
                                  >
                                    {isStandout ? "✓ Standout" : "Standout"}
                                  </button>

                                  {/* Flexi Leg Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isFlexi) {
                                        setFlexiTabs((prev) =>
                                          prev.filter((t) => t !== r.tabNumber)
                                        );
                                      } else {
                                        setFlexiTabs((prev) => [...prev, r.tabNumber]);
                                        if (isStandout) setStandoutTab(null);
                                      }
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition cursor-pointer ${
                                      isFlexi
                                        ? "bg-[#10B981] text-[#070B09] border-[#10B981]"
                                        : "bg-[#080D0B] text-[#10B981] border-[#10B981]/30 hover:bg-[#10B981]/15"
                                    }`}
                                  >
                                    {isFlexi ? "✓ Flexi Leg" : "+ Flexi"}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Col: Live Trifecta Math & Bet Receipt Bento */}
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-[#121C17]/90 border border-[#23352B] space-y-4">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#D4AF37]">
                  Trifecta Ticket Specifications
                </span>

                {/* Bet Stake Preset Selector */}
                <div>
                  <span className="text-xs text-[#8A9990] font-mono block mb-1.5">
                    Syndicate Stake:
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[10, 20, 50, 100].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => onChangeTrifectaBetAmount(amt)}
                        className={`py-1.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer ${
                          trifectaBetAmount === amt
                            ? "bg-[#D4AF37] text-[#070B09]"
                            : "bg-[#080D0B] text-[#8A9990] border border-[#1E2E25] hover:text-[#F3F4F0]"
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Combinations & Flexi calculation */}
                {(() => {
                  const combos =
                    customTrifectaMode === "flexi_standout"
                      ? standoutTab && flexiTabs.length >= 2
                        ? flexiTabs.length * (flexiTabs.length - 1)
                        : 0
                      : customTrifectaMode === "flexi_boxed"
                      ? flexiTabs.length >= 3
                        ? flexiTabs.length * (flexiTabs.length - 1) * (flexiTabs.length - 2)
                        : 0
                      : flexiTabs.length * (flexiTabs.length - 1) * 3;

                  const metrics = computeTabFlexiBetMetrics(
                    combos || 1,
                    punters.length || 2,
                    trifectaBetAmount / (punters.length || 2)
                  );

                  return (
                    <div className="p-4 rounded-xl bg-[#080D0B] border border-[#1E2E25] space-y-3 font-mono text-xs">
                      <div className="flex items-center justify-between text-[#8A9990]">
                        <span>Combinations:</span>
                        <strong className="text-[#F3F4F0]">{combos} combos</strong>
                      </div>
                      <div className="flex items-center justify-between text-[#8A9990]">
                        <span>Total Stake:</span>
                        <strong className="text-[#F3F4F0]">${trifectaBetAmount.toFixed(2)}</strong>
                      </div>
                      <div className="flex items-center justify-between text-[#8A9990]">
                        <span>Flexi Percentage:</span>
                        <strong className="text-[#10B981]">
                          {metrics.flexiPercentage.toFixed(2)}%
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-[#8A9990]">
                        <span>Stake Per Member:</span>
                        <strong className="text-[#F3F4F0]">
                          ${(trifectaBetAmount / (punters.length || 1)).toFixed(2)}
                        </strong>
                      </div>

                      {/* Official Payout if resulted */}
                      {activeTrifectaEval?.isCombinedBoxedTrifectaHit && (
                        <div className="pt-2 border-t border-[#1E2E25] flex items-center justify-between text-[#10B981]">
                          <span className="font-bold">Official Collect:</span>
                          <span className="text-base font-bold">
                            +${activeTrifectaEval.customBetFlexiReturn.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Save Confirmation Button */}
                <button
                  type="button"
                  onClick={() => {
                    onTriggerToast?.(
                      `Trifecta configured for ${activeMeeting.venue} Race ${activeRace.raceNumber} ($${trifectaBetAmount} Flexi)`
                    );
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#D4AF37] text-[#070B09] font-display font-bold text-sm tracking-wide shadow-md hover:bg-[#e0bc45] transition cursor-pointer"
                >
                  Confirm Trifecta for Race {activeRace.raceNumber}
                </button>
              </div>

              {/* All Races Meeting Overview Bento Card */}
              <div className="p-4 rounded-2xl bg-[#121C17]/90 border border-[#23352B] space-y-3">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#8A9990]">
                  Meeting Trifecta Ledger
                </span>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {allTrifectaEvals.map(({ race, evaluation }) => (
                    <div
                      key={race.raceNumber}
                      onClick={() => setSelectedRaceNo(race.raceNumber)}
                      className={`p-2 rounded-xl border flex items-center justify-between text-xs font-mono cursor-pointer transition ${
                        race.raceNumber === activeRace.raceNumber
                          ? "bg-[#D4AF37]/15 border-[#D4AF37]/50 text-[#F3F4F0]"
                          : "bg-[#080D0B] border-[#1E2E25] text-[#8A9990] hover:border-[#23352B]"
                      }`}
                    >
                      <span className="font-bold">R{race.raceNumber}</span>
                      <span className="text-[11px] truncate max-w-[120px]">
                        {race.raceName}
                      </span>
                      <span>
                        {evaluation.isCombinedBoxedTrifectaHit ? (
                          <strong className="text-[#10B981]">
                            +${evaluation.customBetFlexiReturn.toFixed(2)}
                          </strong>
                        ) : evaluation.isRaceResulted ? (
                          <span className="text-[#64756B]">Missed</span>
                        ) : (
                          <span className="text-[#D4AF37]">Open</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          BENTO SECTION 2: 4-LEG QUADDIE SUITE
         ==================================================================== */}
      {(activeFilter === "all" || activeFilter === "quaddies") && quaddieEval && (
        <div className="rounded-3xl border border-white/[0.08] bg-[#0E1512]/95 backdrop-blur-xl p-5 sm:p-7 shadow-[0_8px_32px_rgba(0,0,0,0.4)] space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1E2E25] pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] font-mono text-xs font-bold uppercase">
                  Main Quadrella (Quaddie)
                </span>
                <span className="text-xs text-[#8A9990] font-mono">
                  {quaddieEval.isQuaddieWon ? "STATUS: WON ✓" : quaddieEval.isQuaddieAlive ? "STATUS: ALIVE 🟢" : "STATUS: KNOCKED OUT 🔴"}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-[#F3F4F0] mt-1">
                4-Leg Syndicate Quaddie Matrix ({activeMeeting.venue})
              </h2>
              <p className="text-xs text-[#8A9990] font-mono mt-0.5">
                Combines all punter selections across Races {quaddieEval.legs[0]?.raceNumber}–{quaddieEval.legs[3]?.raceNumber} with custom extra syndicate runners per leg.
              </p>
            </div>

            {/* Quaddie Buy-In Preset Selector */}
            <div className="flex items-center gap-2 bg-[#080D0B] p-2 rounded-2xl border border-[#1E2E25]">
              <span className="text-xs text-[#8A9990] font-mono pl-1">
                Buy-in/punter:
              </span>
              {[20, 50, 100].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => onChangeQuaddieBuyInPerUser(amt)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer ${
                    quaddieBuyInPerUser === amt
                      ? "bg-[#10B981] text-[#070B09]"
                      : "text-[#8A9990] hover:text-[#F3F4F0]"
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          {/* 4 Quaddie Legs Bento Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quaddieEval.legs.map((leg, legIdx) => {
              const race = leg.race;
              const isAlive = leg.isLegHit || !leg.isRaceResulted;
              const isWon = leg.isLegHit;
              const isLost = leg.isRaceResulted && !leg.isLegHit;
              const isExpanded = Boolean(expandedLegs[leg.legIndex]);
              const displayRunners = isExpanded
                ? race.runners
                : race.runners.filter((r) =>
                    leg.allLegRunners.some((lr) => lr.tabNumber === r.tabNumber)
                  );

              return (
                <div
                  key={leg.legIndex}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    isWon
                      ? "bg-[#10B981]/10 border-[#10B981]/40"
                      : isLost
                      ? "bg-rose-950/20 border-rose-900/40 opacity-70"
                      : "bg-[#121C17]/90 border-[#23352B]"
                  }`}
                >
                  {/* Leg Header */}
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="px-2 py-0.5 rounded-md bg-[#080D0B] border border-[#23352B] font-mono font-bold text-xs text-[#D5DDD8]">
                        Leg {leg.legIndex} · R{leg.raceNumber}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                          isWon
                            ? "bg-[#10B981] text-[#070B09]"
                            : isLost
                            ? "bg-rose-500/20 text-rose-300"
                            : "bg-[#192620] text-[#D4AF37]"
                        }`}
                      >
                        {isWon ? "WON ✓" : isLost ? "OUT ✗" : "UPCOMING"}
                      </span>
                    </div>

                    <h3 className="font-display font-bold text-sm text-[#F3F4F0] truncate">
                      {race.raceName}
                    </h3>
                    <p className="text-[11px] text-[#8A9990] font-mono mt-0.5">
                      Jumps {race.startTime} · {race.distance}m
                    </p>

                    {/* Quick Selection Toolbar */}
                    <div className="mt-3 flex items-center justify-between gap-1 text-[11px] font-mono">
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedLegs((prev) => ({
                            ...prev,
                            [leg.legIndex]: !isExpanded,
                          }));
                        }}
                        className="px-2 py-0.5 rounded-lg bg-[#080D0B] border border-[#23352B] text-[#D4AF37] hover:text-[#F3F4F0] flex items-center gap-1 cursor-pointer"
                      >
                        <span>
                          {isExpanded
                            ? `Selected (${leg.allLegRunners.length})`
                            : `Field (${race.runners.length})`}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            const sortedNonScratched = [...race.runners]
                              .filter((r) => !isRunnerScratched(r))
                              .sort(
                                (a, b) =>
                                  (Number(a.fixedWin || a.nswTabWin) || 99) -
                                  (Number(b.fixedWin || b.nswTabWin) || 99)
                              );
                            const top3 = sortedNonScratched.slice(0, 3);
                            top3.forEach((r) => {
                              if (
                                !leg.allLegRunners.some(
                                  (lr) => lr.tabNumber === r.tabNumber
                                )
                              ) {
                                onToggleQuaddieExtraRunner(
                                  activeMeeting.id,
                                  leg.raceNumber,
                                  r.tabNumber
                                );
                              }
                            });
                          }}
                          className="px-2 py-0.5 rounded-lg bg-[#14231B] border border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981]/20 text-[10px] font-bold cursor-pointer transition"
                          title="Auto-add top 3 market favourites to this leg"
                        >
                          + Top 3
                        </button>

                        {leg.extraQuaddieRunners.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              onClearQuaddieExtrasForLeg(
                                activeMeeting.id,
                                leg.raceNumber
                              )
                            }
                            className="px-1.5 py-0.5 rounded-lg text-[10px] text-rose-400 hover:bg-rose-950/40 border border-rose-900/40 cursor-pointer"
                            title="Clear extra runners"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Runners Interactive Selection List */}
                    <div className="mt-2.5 space-y-1 max-h-48 overflow-y-auto pr-1">
                      {displayRunners.map((runner) => {
                        const isScr = isRunnerScratched(runner);
                        const isWinner =
                          leg.isRaceResulted && runner.finishPosition === 1;
                        const isExtra = leg.extraQuaddieRunners.some(
                          (lr) => lr.tabNumber === runner.tabNumber
                        );
                        const isSyndicateTip =
                          !isExtra &&
                          leg.allLegRunners.some(
                            (lr) => lr.tabNumber === runner.tabNumber
                          );
                        const isIncluded = isSyndicateTip || isExtra;
                        const winOdds =
                          Number(runner.fixedWin || runner.nswTabWin) || 0;

                        return (
                          <button
                            key={runner.tabNumber}
                            type="button"
                            disabled={isScr}
                            onClick={() => {
                              if (isScr) return;
                              onToggleQuaddieExtraRunner(
                                activeMeeting.id,
                                leg.raceNumber,
                                runner.tabNumber
                              );
                            }}
                            className={`w-full p-1.5 rounded-lg border flex items-center justify-between text-xs font-mono transition text-left cursor-pointer ${
                              isScr
                                ? "opacity-35 bg-[#060A08] border-transparent cursor-not-allowed"
                                : isWinner
                                ? "bg-[#10B981] text-[#070B09] font-bold border-[#10B981]"
                                : isSyndicateTip
                                ? "bg-[#D4AF37]/15 border-[#D4AF37]/50 text-[#F3F4F0] hover:bg-[#D4AF37]/25"
                                : isExtra
                                ? "bg-[#10B981]/15 border-[#10B981]/50 text-[#F3F4F0] hover:bg-[#10B981]/25"
                                : "bg-[#080D0B] border-[#1E2E25] text-[#8A9990] hover:border-[#D4AF37]/50 hover:text-[#F3F4F0]"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 truncate">
                              <span
                                className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] ${
                                  isWinner
                                    ? "bg-[#070B09] text-[#10B981]"
                                    : isSyndicateTip
                                    ? "bg-[#D4AF37] text-[#070B09]"
                                    : isExtra
                                    ? "bg-[#10B981] text-[#070B09]"
                                    : "bg-[#141F19] text-[#8A9990]"
                                }`}
                              >
                                {runner.tabNumber}
                              </span>
                              <span className="truncate">{runner.horseName}</span>
                              {isSyndicateTip && (
                                <span className="text-[9px] px-1 rounded bg-[#D4AF37]/20 text-[#D4AF37] font-bold">
                                  Tip
                                </span>
                              )}
                              {isExtra && (
                                <span className="text-[9px] px-1 rounded bg-[#10B981]/20 text-[#10B981] font-bold">
                                  +Extra
                                </span>
                              )}
                              {isScr && (
                                <span className="text-[9px] px-1 rounded bg-rose-950 text-rose-300 font-bold">
                                  SCR
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[11px]">
                                {winOdds > 0 ? `$${winOdds.toFixed(2)}` : "—"}
                              </span>
                              {!isScr && (
                                <span
                                  className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                                    isIncluded
                                      ? "text-[#10B981]"
                                      : "text-[#55695D] hover:text-[#D4AF37]"
                                  }`}
                                >
                                  {isIncluded ? "✓" : "+"}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quaddie Mathematical Projection Bento Strip */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-[#121C17]/90 border border-[#23352B] font-mono">
            <div>
              <span className="text-xs text-[#8A9990] uppercase block">
                Combinations
              </span>
              <span className="text-xl sm:text-2xl font-bold text-[#F3F4F0] mt-1 block">
                {quaddieEval.legs.map((l) => l.allLegRunners.length).join(" × ")} = {quaddieEval.totalCombinations}
              </span>
              <span className="text-[11px] text-[#8A9990]">
                {quaddieEval.participatingUsersCount} punters participating
              </span>
            </div>

            <div>
              <span className="text-xs text-[#8A9990] uppercase block">
                Total Flexi Stake
              </span>
              <span className="text-xl sm:text-2xl font-bold text-[#F3F4F0] mt-1 block">
                ${quaddieEval.quaddieBetAmount.toFixed(2)}
              </span>
              <span className="text-[11px] text-[#10B981]">
                {quaddieEval.flexiPercentage.toFixed(2)}% Flexi Coverage
              </span>
            </div>

            <div>
              <span className="text-xs text-[#8A9990] uppercase block">
                Est. $1 Dividend Range
              </span>
              <span className="text-xl sm:text-2xl font-bold text-[#D4AF37] mt-1 block">
                ${quaddieEval.minQuaddieDividend.toFixed(0)} – ${quaddieEval.maxQuaddieDividend.toFixed(0)}
              </span>
              <span className="text-[11px] text-[#8A9990]">
                Est. Mean: ${quaddieEval.officialOrEstimatedQuaddieDividend.toFixed(2)}
              </span>
            </div>

            <div>
              <span className="text-xs text-[#8A9990] uppercase block">
                Projected Syndicate Collect
              </span>
              <span
                className={`text-xl sm:text-2xl font-bold mt-1 block ${
                  quaddieEval.isQuaddieWon ? "text-[#10B981]" : "text-[#F3F4F0]"
                }`}
              >
                ${quaddieEval.flexiPayoutOnBetAmount.toFixed(2)}
              </span>
              <span className="text-[11px] text-[#8A9990]">
                ${quaddieEval.flexiPayoutPerUser.toFixed(2)} / member share
              </span>
            </div>
          </div>

          {/* Leg 4 "Sweat the Quaddie" Payout Matrix */}
          {leg4SweatScenarios.length > 0 && (
            <div className="p-5 rounded-2xl bg-[#080D0B] border border-[#1E2E25] space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[#D4AF37]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                    Leg 4 Live Sweat Matrix (Potential Payout Per Horse)
                  </span>
                </div>
                <span className="text-xs text-[#8A9990]">
                  R{quaddieEval.legs[3].raceNumber} (Final Leg)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {leg4SweatScenarios.map((scen) => (
                  <div
                    key={scen.tabNumber}
                    className={`p-3 rounded-xl border flex flex-col justify-between ${
                      scen.isActualWinner
                        ? "bg-[#10B981]/20 border-[#10B981] text-[#F3F4F0]"
                        : "bg-[#121C17] border-[#23352B] text-[#D5DDD8]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold">#{scen.tabNumber} {scen.horseName}</span>
                      <span className="text-xs text-[#D4AF37]">${scen.winOdds.toFixed(2)}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-[#1E2E25] flex items-center justify-between text-xs">
                      <span className="text-[#8A9990]">Syndicate Collect:</span>
                      <strong className="text-[#10B981]">
                        ${scen.projectedTotalFlexiCollect.toFixed(2)}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
