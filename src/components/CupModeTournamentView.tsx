import React, { useState, useMemo } from "react";
import {
  Trophy,
  Users,
  Sparkles,
  ArrowRight,
  Flame,
  CheckCircle2,
  Clock,
  RotateCcw,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  Layers,
  Percent,
  Coins,
  Medal,
} from "lucide-react";
import {
  CupTournamentState,
  CupUserLeaderboardEntry,
  CupSyndicateTrifectaOutcome,
} from "../types/cupMode";
import { RaceMeeting, RaceEvent } from "../types/racing";
import {
  getDraftOrderForRace,
  getActiveDraftPunter,
  calculateCupLeaderboard,
  calculateCupTrifectaOutcomes,
  removeCupPick,
} from "../utils/cupMode";
import { CupDraftRulesCard } from "./CupDraftRulesCard";

interface CupModeTournamentViewProps {
  tournament: CupTournamentState;
  meeting: RaceMeeting;
  onUpdateTournament: (updated: CupTournamentState) => void;
  onSelectRaceNumber: (raceNumber: number) => void;
  onNavigateToRaceCard: () => void;
  onNavigateToSelections?: () => void;
  isApple?: boolean;
  isObsidian?: boolean;
}

export const CupModeTournamentView: React.FC<CupModeTournamentViewProps> = ({
  tournament,
  meeting,
  onUpdateTournament,
  onSelectRaceNumber,
  onNavigateToRaceCard,
  onNavigateToSelections,
  isApple = false,
  isObsidian = false,
}) => {
  const [activeTab, setActiveTab] = useState<"leaderboard" | "draft" | "trifecta">(
    "leaderboard"
  );
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [newParticipantName, setNewParticipantName] = useState("");
  const [flexiStake, setFlexiStake] = useState<number>(10);

  // Compute live leaderboard and trifecta stats
  const leaderboard: CupUserLeaderboardEntry[] = useMemo(() => {
    return calculateCupLeaderboard(tournament, meeting);
  }, [tournament, meeting]);

  const trifectaOutcomes: CupSyndicateTrifectaOutcome[] = useMemo(() => {
    return calculateCupTrifectaOutcomes(tournament, meeting, flexiStake);
  }, [tournament, meeting, flexiStake]);

  const activeDrafter = useMemo(() => {
    return getActiveDraftPunter(tournament, tournament.activeRaceNumber);
  }, [tournament]);

  // Overall Syndicate Trifecta Summary
  const trifectaSummary = useMemo(() => {
    let totalOutlay = 0;
    let totalReturn = 0;
    let hits = 0;
    let racesCount = 0;

    trifectaOutcomes.forEach((to) => {
      if (to.boxedRunners.length >= 3) {
        totalOutlay += to.flexiStake;
        totalReturn += to.flexiPayout;
        racesCount += 1;
        if (to.isStruck) hits += 1;
      }
    });

    const net = Number((totalReturn - totalOutlay).toFixed(2));
    return {
      totalOutlay,
      totalReturn: Number(totalReturn.toFixed(2)),
      net,
      hits,
      racesCount,
    };
  }, [trifectaOutcomes]);

  const handleResetTournament = () => {
    if (window.confirm("Are you sure you want to reset all Cup Mode draft selections for this meeting?")) {
      onUpdateTournament({
        ...tournament,
        selectionsByRace: {},
        activeRaceNumber: 1,
        activeDraftIndex: 0,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleAddParticipant = () => {
    const trimmed = newParticipantName.trim();
    if (!trimmed) return;
    if (tournament.participants.includes(trimmed)) {
      alert("Participant already in Cup Mode roster.");
      return;
    }
    onUpdateTournament({
      ...tournament,
      participants: [...tournament.participants, trimmed],
      updatedAt: new Date().toISOString(),
    });
    setNewParticipantName("");
    setShowAddParticipant(false);
  };

  const handleRemoveParticipant = (punterName: string) => {
    if (tournament.participants.length <= 2) {
      alert("At least 2 participants are required for Cup Mode.");
      return;
    }
    if (window.confirm(`Remove ${punterName} from the Cup Mode roster?`)) {
      const filtered = tournament.participants.filter((p) => p !== punterName);
      // Clean selections for this punter
      const nextSelections: Record<number, Record<string, number>> = {};
      for (const [rNum, picks] of Object.entries(tournament.selectionsByRace)) {
        const nextPicks = { ...picks };
        delete nextPicks[punterName];
        nextSelections[Number(rNum)] = nextPicks;
      }
      onUpdateTournament({
        ...tournament,
        participants: filtered,
        selectionsByRace: nextSelections,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleToggleDraftType = () => {
    const nextType = tournament.draftType === "snake" ? "fixed" : "snake";
    onUpdateTournament({
      ...tournament,
      draftType: nextType,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Cup Header Card */}
      <div
        className={`rounded-2xl border p-4 sm:p-6 transition-all ${
          isApple
            ? "bg-white border-[#E5E5EA] shadow-xs text-[#1D1D1F]"
            : isObsidian
            ? "bg-[#0E1522] border-[#1E293B] text-[#F1F5F9] shadow-lg"
            : "bg-gradient-to-r from-[#121A16] via-[#0E1512] to-[#1a2620] border-[#D4AF37]/40 shadow-[0_0_30px_rgba(212,175,55,0.08)] text-[#F3F4F0]"
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37] flex items-center justify-center shrink-0 shadow-sm">
              <Trophy className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                  <span>🏆 Syndicate Cup Mode</span>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#D4AF37] text-[#070B09] uppercase tracking-wider">
                  Live Draft Tournament
                </span>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-md border ${
                  isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#0B110E] border-[#1F2D26]"
                }`}>
                  {meeting.venue} ({meeting.state}) · {meeting.races.length} Races
                </span>
              </div>
              <p className={`text-xs mt-1 ${isApple ? "text-[#86868B]" : "text-[#8A9990]"}`}>
                Discreet single-horse draft per race · Mutual exclusivity enforced · Automatic Flexi Box Trifecta
              </p>
            </div>
          </div>

          {/* Quick Stats & Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleToggleDraftType}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition border cursor-pointer ${
                tournament.draftType === "snake"
                  ? "bg-[#D4AF37]/15 border-[#D4AF37]/50 text-[#D4AF37]"
                  : isApple
                  ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F]"
                  : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990]"
              }`}
              title="Toggle Snake draft (reverses order every race) or Fixed order"
            >
              <span>Draft Order: </span>
              <strong>{tournament.draftType === "snake" ? "🐍 Snake Draft" : "➡️ Fixed Order"}</strong>
            </button>

            <button
              type="button"
              onClick={handleResetTournament}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-[#EF4444] hover:bg-[#EF4444]/10 border border-[#EF4444]/30 transition cursor-pointer flex items-center gap-1"
              title="Reset all picks in this Cup tournament"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>

            {onNavigateToSelections && (
              <button
                type="button"
                onClick={onNavigateToSelections}
                className="px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md bg-[#D4AF37] text-[#070B09] hover:bg-[#c49f2e]"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Jump to Cup Selections (8-Rank)</span>
              </button>
            )}

            <button
              type="button"
              onClick={onNavigateToRaceCard}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md ${
                isApple
                  ? "bg-[#0071E3] text-white hover:bg-[#0077ED]"
                  : "bg-[#10B981] text-[#070B09] hover:bg-[#0ea371]"
              }`}
            >
              <span>Draft on RaceCard</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Active Drafter Callout Banner */}
        <div className={`mt-4 p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          activeDrafter
            ? "bg-[#D4AF37]/10 border-[#D4AF37]/40 text-[#D4AF37]"
            : "bg-[#10B981]/10 border-[#10B981]/40 text-[#10B981]"
        }`}>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-current/15 flex items-center justify-center font-bold text-sm shrink-0">
              {activeDrafter ? "🎯" : "✅"}
            </span>
            <div>
              <div className="font-bold text-xs sm:text-sm font-mono flex items-center gap-2">
                <span>
                  {activeDrafter
                    ? `NOW DRAFTING: Race ${tournament.activeRaceNumber} · ${activeDrafter}'s Turn`
                    : `Race ${tournament.activeRaceNumber} Draft Complete! All ${tournament.participants.length} Selections Made`}
                </span>
              </div>
              <div className="text-[11px] opacity-80 mt-0.5 font-sans">
                {activeDrafter
                  ? `Select an available horse on the RaceCard. Already-drafted runners are locked.`
                  : `All runners locked into the Syndicate Flexi Box Trifecta for Race ${tournament.activeRaceNumber}.`}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Race Quick Switcher in Cup Banner */}
            <div className="flex items-center gap-1 overflow-x-auto">
              {meeting.races.map((r) => {
                const picksCount = Object.keys(
                  tournament.selectionsByRace[r.raceNumber] || {}
                ).length;
                const isCurrent = r.raceNumber === tournament.activeRaceNumber;
                const isFullyDrafted = picksCount === tournament.participants.length;

                return (
                  <button
                    key={r.raceNumber}
                    type="button"
                    onClick={() => {
                      onSelectRaceNumber(r.raceNumber);
                      onUpdateTournament({
                        ...tournament,
                        activeRaceNumber: r.raceNumber,
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                    className={`px-2 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
                      isCurrent
                        ? "bg-[#D4AF37] text-[#070B09] shadow-xs"
                        : isFullyDrafted
                        ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30"
                        : isApple
                        ? "bg-[#F2F2F7] text-[#86868B]"
                        : "bg-[#0B110E] text-[#8A9990] hover:text-[#F3F4F0]"
                    }`}
                  >
                    R{r.raceNumber}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-current/10">
          <button
            type="button"
            onClick={() => setActiveTab("leaderboard")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "leaderboard"
                ? isApple
                  ? "bg-[#0071E3] text-white"
                  : "bg-[#D4AF37] text-[#070B09]"
                : isApple
                ? "text-[#86868B] hover:text-[#1D1D1F]"
                : "text-[#8A9990] hover:text-[#F3F4F0]"
            }`}
          >
            <Medal className="w-3.5 h-3.5" />
            <span>Leaderboard & Standings</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("draft")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "draft"
                ? isApple
                  ? "bg-[#0071E3] text-white"
                  : "bg-[#D4AF37] text-[#070B09]"
                : isApple
                ? "text-[#86868B] hover:text-[#1D1D1F]"
                : "text-[#8A9990] hover:text-[#F3F4F0]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Draft Matrix (Races 1–{meeting.races.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("trifecta")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "trifecta"
                ? isApple
                  ? "bg-[#0071E3] text-white"
                  : "bg-[#D4AF37] text-[#070B09]"
                : isApple
                ? "text-[#86868B] hover:text-[#1D1D1F]"
                : "text-[#8A9990] hover:text-[#F3F4F0]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Syndicate Flexi Box Trifecta ({trifectaSummary.hits} Hits)</span>
          </button>
        </div>
      </div>

      {/* Cup Draft Rules & Mechanics Card */}
      <CupDraftRulesCard
        tournament={tournament}
        isApple={isApple}
        isObsidian={isObsidian}
        defaultExpanded={false}
      />

      {/* =========================================================================
          TAB 1: TOURNAMENT LEADERBOARD
          ========================================================================= */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4">
          <div
            className={`rounded-2xl border overflow-hidden ${
              isApple
                ? "bg-white border-[#E5E5EA] text-[#1D1D1F]"
                : isObsidian
                ? "bg-[#0E1522] border-[#1E293B] text-[#F1F5F9]"
                : "bg-[#121A16] border-[#1F2D26] text-[#F3F4F0]"
            }`}
          >
            <div className="p-4 border-b border-current/10 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#D4AF37]" />
                  <span>Cup Mode Live Standings</span>
                </h3>
                <p className="text-xs text-current/70">
                  Scored via standard $1 Each-Way Par & NSW TAB official dividends
                </p>
              </div>

              {/* Add Participant Button */}
              <div className="flex items-center gap-2">
                {!showAddParticipant ? (
                  <button
                    type="button"
                    onClick={() => setShowAddParticipant(true)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1 transition cursor-pointer ${
                      isApple
                        ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F]"
                        : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0]"
                    }`}
                  >
                    <Plus className="w-3 h-3 text-[#10B981]" />
                    <span>Add Punter</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newParticipantName}
                      onChange={(e) => setNewParticipantName(e.target.value)}
                      placeholder="Punter Name..."
                      className="px-2 py-1 rounded text-xs bg-black/20 border border-current/30 text-current focus:outline-none w-32"
                    />
                    <button
                      type="button"
                      onClick={handleAddParticipant}
                      className="px-2 py-1 rounded bg-[#10B981] text-[#070B09] text-xs font-bold cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddParticipant(false)}
                      className="px-1.5 py-1 text-xs opacity-60 cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Standings Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-current/10 font-mono text-[11px] uppercase tracking-wider opacity-70">
                    <th className="py-2.5 px-4 w-12 text-center">Rank</th>
                    <th className="py-2.5 px-4">Punter</th>
                    <th className="py-2.5 px-4 text-center">Picks Made</th>
                    <th className="py-2.5 px-4 text-center">Wins</th>
                    <th className="py-2.5 px-4 text-center">Places</th>
                    <th className="py-2.5 px-4 text-center">Strike Rate</th>
                    <th className="py-2.5 px-4 text-right">Points</th>
                    <th className="py-2.5 px-4 text-right">Total $ Return</th>
                    <th className="py-2.5 px-4 text-right">Net Profit</th>
                    <th className="py-2.5 px-3 w-10 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-current/5 font-mono">
                  {leaderboard.map((entry) => {
                    const isFirst = entry.rank === 1 && entry.totalPoints > 0;
                    return (
                      <tr
                        key={entry.punterName}
                        className={`hover:bg-current/5 transition-colors ${
                          isFirst ? "bg-[#D4AF37]/5 font-bold" : ""
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          {entry.rank === 1 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#D4AF37] text-[#070B09] font-black text-xs shadow-xs">
                              1
                            </span>
                          ) : entry.rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#94A3B8] text-white font-black text-xs">
                              2
                            </span>
                          ) : entry.rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#B45309] text-white font-black text-xs">
                              3
                            </span>
                          ) : (
                            <span className="opacity-60">{entry.rank}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-sans font-bold flex items-center gap-2">
                          <span>{entry.punterName}</span>
                          {isFirst && <span className="text-[#D4AF37]">👑</span>}
                        </td>
                        <td className="py-3 px-4 text-center tabular-nums">
                          {entry.totalPicks} / {meeting.races.length}
                        </td>
                        <td className="py-3 px-4 text-center tabular-nums text-[#10B981] font-bold">
                          {entry.winCount}
                        </td>
                        <td className="py-3 px-4 text-center tabular-nums text-[#38BDF8]">
                          {entry.placeCount}
                        </td>
                        <td className="py-3 px-4 text-center tabular-nums">
                          {entry.strikeRatePct}%
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#D4AF37] font-bold text-sm">
                          {entry.totalPoints} pts
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-sm">
                          ${entry.totalDollarReturn.toFixed(2)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right tabular-nums font-bold text-sm ${
                            entry.netProfit >= 0
                              ? "text-[#10B981]"
                              : "text-[#EF4444]"
                          }`}
                        >
                          {entry.netProfit >= 0 ? "+" : ""}${entry.netProfit.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveParticipant(entry.punterName)}
                            className="p-1 rounded text-red-500 hover:bg-red-500/10 cursor-pointer opacity-40 hover:opacity-100 transition"
                            title={`Remove ${entry.punterName} from roster`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DRAFT MATRIX (RACES 1 - N)
          ========================================================================= */}
      {activeTab === "draft" && (
        <div
          className={`rounded-2xl border p-4 sm:p-5 overflow-hidden ${
            isApple
              ? "bg-white border-[#E5E5EA] text-[#1D1D1F]"
              : isObsidian
              ? "bg-[#0E1522] border-[#1E293B] text-[#F1F5F9]"
              : "bg-[#121A16] border-[#1F2D26] text-[#F3F4F0]"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-current/10">
            <div>
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#D4AF37]" />
                <span>Race-by-Race Draft Matrix</span>
              </h3>
              <p className="text-xs text-current/70">
                Turn sequence: {tournament.draftType === "snake" ? "Snake order reverses every race" : "Fixed order"}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {onNavigateToSelections && (
                <button
                  type="button"
                  onClick={onNavigateToSelections}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer bg-[#D4AF37] text-[#070B09] hover:bg-[#c49f2e] shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Jump to Cup Selections (8-Rank)</span>
                </button>
              )}
              <button
                type="button"
                onClick={onNavigateToRaceCard}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  isApple
                    ? "bg-[#0071E3] text-white hover:bg-[#0077ED]"
                    : "bg-[#10B981] text-[#070B09] hover:bg-[#0ea371]"
                }`}
              >
                <span>Inspect on RaceCard</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto pt-3">
            <table className="w-full text-xs text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-current/10 font-mono text-[11px] uppercase tracking-wider opacity-70">
                  <th className="py-2.5 px-3 w-16">Race</th>
                  <th className="py-2.5 px-3 w-28">Pick Order</th>
                  {tournament.participants.map((p) => (
                    <th key={p} className="py-2.5 px-3">
                      {p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-current/5">
                {meeting.races.map((race) => {
                  const racePicks = tournament.selectionsByRace[race.raceNumber] || {};
                  const draftOrder = getDraftOrderForRace(
                    race.raceNumber,
                    tournament.participants,
                    tournament.draftType
                  );
                  const isCurrentActive = race.raceNumber === tournament.activeRaceNumber;

                  return (
                    <tr
                      key={race.raceNumber}
                      className={`hover:bg-current/5 transition-colors ${
                        isCurrentActive ? "bg-current/5 font-medium" : ""
                      }`}
                    >
                      {/* Race # */}
                      <td className="py-3 px-3 font-mono">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectRaceNumber(race.raceNumber);
                            onUpdateTournament({
                              ...tournament,
                              activeRaceNumber: race.raceNumber,
                              updatedAt: new Date().toISOString(),
                            });
                          }}
                          className={`px-2 py-1 rounded text-xs font-bold cursor-pointer transition ${
                            isCurrentActive
                              ? "bg-[#D4AF37] text-[#070B09]"
                              : isApple
                              ? "bg-[#F2F2F7] text-[#1D1D1F]"
                              : "bg-[#0B110E] text-[#8A9990] hover:text-[#F3F4F0]"
                          }`}
                        >
                          R{race.raceNumber}
                        </button>
                      </td>

                      {/* Pick Order */}
                      <td className="py-3 px-3 font-mono text-[10px] text-current/60">
                        {draftOrder.map((name, i) => (
                          <span key={name}>
                            {i > 0 && " → "}
                            <span className={racePicks[name] ? "opacity-50" : "font-bold text-[#D4AF37]"}>
                              {name.split(" ")[0]}
                            </span>
                          </span>
                        ))}
                      </td>

                      {/* Columns for each participant's pick */}
                      {tournament.participants.map((punter) => {
                        const pickedTab = racePicks[punter];
                        const runner = pickedTab
                          ? race.runners.find((r) => r.tabNumber === pickedTab)
                          : null;
                        const isDrafterTurn =
                          activeDrafter === punter && race.raceNumber === tournament.activeRaceNumber;

                        const resDetail = tournament.draftResolutionDetails?.[race.raceNumber]?.[punter];

                        return (
                          <td key={punter} className="py-3 px-3">
                            {runner ? (
                              <div className="flex flex-col gap-1 p-2 rounded-lg border bg-current/5 border-current/10">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="w-5 h-5 rounded-full bg-[#D4AF37] text-[#070B09] font-mono text-xs flex items-center justify-center font-bold shrink-0">
                                      {runner.tabNumber}
                                    </span>
                                    <span className="truncate font-semibold">{runner.horseName}</span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 font-mono text-[11px]">
                                    {runner.finishPosition === 1 ? (
                                      <span className="px-1.5 py-0.2 rounded bg-[#10B981] text-[#070B09] font-bold">
                                        1st
                                      </span>
                                    ) : runner.finishPosition === 2 ? (
                                      <span className="px-1.5 py-0.2 rounded bg-[#38BDF8] text-[#070B09] font-bold">
                                        2nd
                                      </span>
                                    ) : runner.finishPosition === 3 ? (
                                      <span className="px-1.5 py-0.2 rounded bg-[#B45309] text-white font-bold">
                                        3rd
                                      </span>
                                    ) : runner.finishPosition > 3 ? (
                                      <span className="text-current/50">
                                        {runner.finishPosition}th
                                      </span>
                                    ) : (
                                      <span className="text-current/60">
                                        ${(runner.nswTabWin || runner.fixedWin).toFixed(2)}
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = removeCupPick(tournament, race.raceNumber, punter);
                                        onUpdateTournament(updated);
                                      }}
                                      className="p-0.5 text-current/40 hover:text-red-500 cursor-pointer ml-1"
                                      title={`Clear ${punter}'s selection for Race ${race.raceNumber}`}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                                {resDetail && (
                                  <div className="text-[10px] font-mono flex items-center justify-between border-t border-current/5 pt-1">
                                    {!resDetail.wasFallback ? (
                                      <span className="text-[#10B981] font-bold">✓ 1st Choice</span>
                                    ) : (
                                      <span
                                        className="text-amber-400 font-semibold cursor-help"
                                        title={
                                          resDetail.originallyTakenBy
                                            ? `Fell back from #${resDetail.originallyWantedTab} (drafted by ${resDetail.originallyTakenBy})`
                                            : `Fell back to preference #${resDetail.preferenceRankUsed}`
                                        }
                                      >
                                        ⚡️ Pref #{resDetail.preferenceRankUsed}{" "}
                                        {resDetail.originallyTakenBy ? `(1st was #${resDetail.originallyWantedTab})` : ""}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : isDrafterTurn ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectRaceNumber(race.raceNumber);
                                  onNavigateToRaceCard();
                                }}
                                className="px-2 py-1.5 rounded-lg border border-dashed border-[#D4AF37] text-[#D4AF37] bg-[#D4AF37]/10 font-bold text-[11px] hover:bg-[#D4AF37]/20 transition cursor-pointer flex items-center gap-1 animate-pulse"
                              >
                                <span>🎯 Select Pick →</span>
                              </button>
                            ) : (
                              <span className="text-current/30 italic text-[11px]">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: SYNDICATE FLEXI BOX TRIFECTA
          ========================================================================= */}
      {activeTab === "trifecta" && (
        <div className="space-y-4">
          {/* Trifecta Executive Summary Box */}
          <div
            className={`rounded-2xl border p-4 sm:p-5 ${
              isApple
                ? "bg-white border-[#E5E5EA] text-[#1D1D1F]"
                : isObsidian
                ? "bg-[#0E1522] border-[#1E293B] text-[#F1F5F9]"
                : "bg-[#121A16] border-[#1F2D26] text-[#F3F4F0]"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-current/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#D4AF37]/15 text-[#D4AF37]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base">
                    Syndicate Flexi Box Trifecta Tracker
                  </h3>
                  <p className="text-xs text-current/70">
                    Automatically combines all users' discreet selections in each race into a Flexi Box Trifecta
                  </p>
                </div>
              </div>

              {/* Stake input */}
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="opacity-70">Race Outlay:</span>
                <div className="inline-flex items-center rounded-lg border border-current/20 p-0.5 bg-black/10">
                  {[6, 10, 20, 24].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setFlexiStake(amt)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                        flexiStake === amt
                          ? "bg-[#D4AF37] text-[#070B09]"
                          : "text-current/70 hover:text-current"
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
              <div className="p-3 rounded-xl border border-current/10 bg-current/5">
                <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">Trifectas Struck</span>
                <div className="text-xl font-black text-[#10B981] mt-0.5">
                  {trifectaSummary.hits} / {trifectaSummary.racesCount}
                </div>
              </div>
              <div className="p-3 rounded-xl border border-current/10 bg-current/5">
                <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">Total Outlay</span>
                <div className="text-xl font-bold font-mono mt-0.5">
                  ${trifectaSummary.totalOutlay.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-xl border border-current/10 bg-current/5">
                <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">Total Payout</span>
                <div className="text-xl font-bold font-mono text-[#D4AF37] mt-0.5">
                  ${trifectaSummary.totalReturn.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-xl border border-current/10 bg-current/5">
                <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">Net Profit</span>
                <div className={`text-xl font-black font-mono mt-0.5 ${
                  trifectaSummary.net >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
                }`}>
                  {trifectaSummary.net >= 0 ? "+" : ""}${trifectaSummary.net.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Race-by-race Trifecta outcomes cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {trifectaOutcomes.map((to) => {
              const runnerCount = to.boxedRunners.length;
              return (
                <div
                  key={to.raceNumber}
                  className={`p-4 rounded-xl border transition-all ${
                    to.isStruck
                      ? "bg-[#10B981]/10 border-[#10B981]/50 shadow-md"
                      : isApple
                      ? "bg-white border-[#E5E5EA]"
                      : isObsidian
                      ? "bg-[#0E1522] border-[#1E293B]"
                      : "bg-[#121A16] border-[#1F2D26]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-current/10">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-current/10">
                        Race {to.raceNumber}
                      </span>
                      <span className="font-bold text-xs truncate">{to.raceName}</span>
                    </div>
                    {to.isStruck ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#10B981] text-[#070B09] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>TRIFECTA STRUCK!</span>
                      </span>
                    ) : runnerCount < 3 ? (
                      <span className="text-[10px] font-mono text-current/50">
                        Need 3+ picks ({runnerCount} drafted)
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-current/60">
                        {to.totalCombinations} combos · {to.flexiPercentage}% Flexi
                      </span>
                    )}
                  </div>

                  {/* Boxed Runners list */}
                  <div className="py-2.5 flex flex-wrap gap-1.5">
                    {to.boxedRunners.map((br) => {
                      const isPodium = br.finishPosition >= 1 && br.finishPosition <= 3;
                      return (
                        <div
                          key={br.tabNumber}
                          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border ${
                            isPodium
                              ? "bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37] font-bold"
                              : "bg-current/5 border-current/10"
                          }`}
                        >
                          <span className="font-mono">#{br.tabNumber}</span>
                          <span className="font-semibold">{br.horseName}</span>
                          <span className="text-[10px] opacity-60">({br.punterName})</span>
                          {br.finishPosition > 0 && (
                            <span className="font-mono text-[10px] px-1 rounded bg-black/20">
                              {br.finishPosition === 1 ? "1st" : br.finishPosition === 2 ? "2nd" : br.finishPosition === 3 ? "3rd" : `${br.finishPosition}th`}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Dividends & Flexi returns */}
                  <div className="pt-2 border-t border-current/10 flex items-center justify-between text-xs font-mono">
                    <span className="opacity-70">
                      Official Div: ${to.officialTrifectaDividend > 0 ? to.officialTrifectaDividend.toFixed(2) : "TBD"}
                    </span>
                    <span className={`font-bold ${to.isStruck ? "text-[#10B981] text-sm" : "opacity-70"}`}>
                      Collect: ${to.flexiPayout.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
