import React, { useState, useMemo } from "react";
import {
  Trophy,
  Award,
  Medal,
  DollarSign,
  TrendingUp,
  Flame,
  Crown,
  ChevronRight,
  ArrowUpRight,
  Target,
  Sparkles,
  Percent,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import type {
  RaceMeeting,
  PunterProfile,
} from "../types/racing";
import type { ScoringDisplayMode } from "./AllUsersSelectionsResults";
import { evaluateRaceTrio, formatDollarReturn } from "../utils/scoring";

export interface PunterLeaderboardProps {
  meetings: RaceMeeting[];
  punters: PunterProfile[];
  selectedMeetingId: string;
  onSelectMeeting?: (id: string) => void;
  onJumpToSelections?: (punterId: string, meetingId: string) => void;
  scoringMode?: ScoringDisplayMode;
  onToggleScoringMode?: (mode: ScoringDisplayMode) => void;
  isApple?: boolean;
}

export type LeaderboardSortMode = "points" | "dollars" | "strikeRate";

interface PunterStats {
  punter: PunterProfile;
  totalPoints: number;
  totalDollarReturn: number;
  winnersPicked: number;
  secondsPicked: number;
  thirdsPicked: number;
  podiumsPicked: number;
  racesTipped: number;
  completedRaces: number;
  winStrikeRate: number;
  podiumStrikeRate: number;
  jokerRaceNo: number | null;
  jokerTriggered: boolean;
  jokerBonusPoints: number;
  jokerBonusDollars: number;
  outlayDollars: number;
  roiPercentage: number;
}

const PunterLeaderboardComponent: React.FC<PunterLeaderboardProps> = ({
  meetings,
  punters,
  selectedMeetingId,
  onSelectMeeting,
  onJumpToSelections,
  scoringMode = "points",
  onToggleScoringMode,
  isApple = false,
}) => {
  const [sortMode, setSortMode] = useState<LeaderboardSortMode>("points");
  const [venueScope, setVenueScope] = useState<"all" | "selected">("all");

  const targetMeetings = useMemo(() => {
    if (venueScope === "selected") {
      const single = meetings.find((m) => m.id === selectedMeetingId);
      return single ? [single] : meetings;
    }
    return meetings;
  }, [meetings, venueScope, selectedMeetingId]);

  // Aggregate comprehensive stats for every registered punter
  const punterStatsList: PunterStats[] = useMemo(() => {
    return punters.map((punter) => {
      let totalPoints = 0;
      let totalDollarReturn = 0;
      let winnersPicked = 0;
      let secondsPicked = 0;
      let thirdsPicked = 0;
      let racesTipped = 0;
      let completedRaces = 0;
      let totalSelectionsCount = 0;
      let jokerRaceNo: number | null = null;
      let jokerTriggered = false;
      let jokerBonusPoints = 0;
      let jokerBonusDollars = 0;

      targetMeetings.forEach((meeting) => {
        const mSelections = punter.selectionsByMeeting?.[meeting.id] || {};
        const mJoker = punter.jokerRaceByMeeting?.[meeting.id] ?? null;
        if (jokerRaceNo === null && mJoker !== null) {
          jokerRaceNo = mJoker;
        }

        meeting.races.forEach((race) => {
          const trio = mSelections[race.raceNumber];
          const isJoker = mJoker === race.raceNumber;
          const evalRes = evaluateRaceTrio(race, trio, meeting.date, isJoker);

          if (evalRes.hasAnySelection) {
            racesTipped++;
            totalPoints += evalRes.racePointsTally;
            totalDollarReturn += evalRes.raceDollarReturn;

            evalRes.picks.forEach((p) => {
              if (p.tabNumber !== null) {
                totalSelectionsCount++;
                if (evalRes.isRaceResulted) {
                  if (p.finishPosition === 1) winnersPicked++;
                  else if (p.finishPosition === 2) secondsPicked++;
                  else if (p.finishPosition === 3) thirdsPicked++;
                }
              }
            });

            if (evalRes.isRaceResulted) {
              completedRaces++;
            }

            if (evalRes.jokerTriggered) {
              jokerTriggered = true;
              jokerBonusPoints += evalRes.jokerBonusPoints;
              jokerBonusDollars += evalRes.raceDollarReturn / 2;
            }
          }
        });
      });

      const podiumsPicked = winnersPicked + secondsPicked + thirdsPicked;
      const winStrikeRate =
        completedRaces > 0
          ? Number(((winnersPicked / completedRaces) * 100).toFixed(1))
          : 0;
      const podiumStrikeRate =
        completedRaces > 0
          ? Number(((podiumsPicked / (completedRaces * 3)) * 100).toFixed(1))
          : 0;
      const outlayDollars = racesTipped * 10;
      const netProfit = totalDollarReturn - outlayDollars;
      const roiPercentage =
        outlayDollars > 0
          ? Number(((netProfit / outlayDollars) * 100).toFixed(1))
          : 0;

      return {
        punter,
        totalPoints,
        totalDollarReturn,
        winnersPicked,
        secondsPicked,
        thirdsPicked,
        podiumsPicked,
        racesTipped,
        completedRaces,
        winStrikeRate,
        podiumStrikeRate,
        jokerRaceNo,
        jokerTriggered,
        jokerBonusPoints,
        jokerBonusDollars,
        outlayDollars,
        roiPercentage,
      };
    });
  }, [punters, targetMeetings]);

  // Sort according to active sortMode
  const sortedStats = useMemo(() => {
    return [...punterStatsList].sort((a, b) => {
      if (sortMode === "points") {
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints;
        }
        return b.totalDollarReturn - a.totalDollarReturn;
      }
      if (sortMode === "dollars") {
        if (b.totalDollarReturn !== a.totalDollarReturn) {
          return b.totalDollarReturn - a.totalDollarReturn;
        }
        return b.totalPoints - a.totalPoints;
      }
      // strikeRate
      if (b.winStrikeRate !== a.winStrikeRate) {
        return b.winStrikeRate - a.winStrikeRate;
      }
      return b.totalPoints - a.totalPoints;
    });
  }, [punterStatsList, sortMode]);

  const leader = sortedStats[0];
  const podiumTop3 = sortedStats.slice(0, 3);

  // Syndicate aggregate totals
  const aggregateStats = useMemo(() => {
    const totalPts = sortedStats.reduce((acc, s) => acc + s.totalPoints, 0);
    const totalDiv = sortedStats.reduce((acc, s) => acc + s.totalDollarReturn, 0);
    const totalWins = sortedStats.reduce((acc, s) => acc + s.winnersPicked, 0);
    return { totalPts, totalDiv, totalWins };
  }, [sortedStats]);

  return (
    <div id="section-punter-leaderboard" className="space-y-6 scroll-mt-24">
      {/* Bento Header & Executive Summary */}
      <div className={`p-6 rounded-2xl border transition-all ${
        isApple ? "bg-white border-[#E5E5EA] shadow-sm text-[#1D1D1F]" : "bg-[#0B120E] border-[#1E2E25] shadow-xl text-[#F3F4F0]"
      }`}>
        <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b ${
          isApple ? "border-[#E5E5EA]" : "border-[#1C2C23]"
        }`}>
          <div>
            <div className="flex items-center gap-2">
              <span className={`p-2 rounded-xl border ${
                isApple ? "bg-[#0071E3]/10 border-[#0071E3]/25 text-[#0071E3]" : "bg-[#D4AF37]/15 border-[#D4AF37]/30 text-[#D4AF37]"
              }`}>
                <Trophy className="w-5 h-5" />
              </span>
              <div>
                <h2 className={`text-xl sm:text-2xl font-display font-bold tracking-tight ${
                  isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"
                }`}>
                  Official Syndicate Leaderboard
                </h2>
                <p className={`text-xs mt-0.5 ${isApple ? "text-[#86868B]" : "text-[#8A9990]"}`}>
                  Live rankings across {punters.length} registered punters by total points and official TAB dollar dividends.
                </p>
              </div>
            </div>
          </div>

          {/* Scope & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Scope Pill Toggle */}
            <div className={`flex items-center p-1 rounded-xl border text-xs font-mono ${
              isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#070D0A] border-[#1C2C23]"
            }`}>
              <button
                type="button"
                onClick={() => setVenueScope("all")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-semibold ${
                  venueScope === "all"
                    ? isApple
                      ? "bg-white text-[#0071E3] font-bold shadow-xs"
                      : "bg-[#D4AF37] text-[#070B09] font-bold"
                    : isApple
                    ? "text-[#86868B] hover:text-[#1D1D1F]"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                All Venues ({meetings.length})
              </button>
              <button
                type="button"
                onClick={() => setVenueScope("selected")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-semibold ${
                  venueScope === "selected"
                    ? isApple
                      ? "bg-white text-[#0071E3] font-bold shadow-xs"
                      : "bg-[#D4AF37] text-[#070B09] font-bold"
                    : isApple
                    ? "text-[#86868B] hover:text-[#1D1D1F]"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                Active Venue
              </button>
            </div>

            {/* Ranking Mode Toggle */}
            <div className={`flex items-center p-1 rounded-xl border text-xs font-mono ${
              isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#070D0A] border-[#1C2C23]"
            }`}>
              <button
                type="button"
                onClick={() => setSortMode("points")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-semibold flex items-center gap-1.5 ${
                  sortMode === "points"
                    ? isApple
                      ? "bg-white text-[#0071E3] font-bold shadow-xs"
                      : "bg-[#D4AF37] text-[#070B09] font-bold shadow-sm"
                    : isApple
                    ? "text-[#86868B] hover:text-[#1D1D1F]"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <Medal className="w-3.5 h-3.5" />
                <span>Total Points</span>
              </button>
              <button
                type="button"
                onClick={() => setSortMode("dollars")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-semibold flex items-center gap-1.5 ${
                  sortMode === "dollars"
                    ? isApple
                      ? "bg-white text-[#34C759] font-bold shadow-xs"
                      : "bg-[#10B981] text-[#070B09] font-bold shadow-sm"
                    : isApple
                    ? "text-[#86868B] hover:text-[#1D1D1F]"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>Dollar Returns</span>
              </button>
              <button
                type="button"
                onClick={() => setSortMode("strikeRate")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer font-semibold flex items-center gap-1.5 ${
                  sortMode === "strikeRate"
                    ? isApple
                      ? "bg-white text-[#0071E3] font-bold shadow-xs"
                      : "bg-[#38BDF8] text-[#070B09] font-bold shadow-sm"
                    : isApple
                    ? "text-[#86868B] hover:text-[#1D1D1F]"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Strike Rate</span>
              </button>
            </div>
          </div>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className={`p-3.5 rounded-xl border ${
            isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#101A14]/70 border-[#1E2E25]"
          }`}>
            <span className={`text-[11px] font-mono uppercase tracking-wider block ${
              isApple ? "text-[#86868B]" : "text-[#8A9990]"
            }`}>
              Club Leader 👑
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className={`font-display font-bold text-base ${
                isApple ? "text-[#0071E3]" : "text-[#D4AF37]"
              }`}>
                {leader?.punter.name || "—"}
              </span>
            </div>
            <span className={`text-xs font-mono ${isApple ? "text-[#86868B]" : "text-[#8A9990]"}`}>
              {leader ? `${leader.totalPoints} pts · ${formatDollarReturn(leader.totalDollarReturn)}` : "—"}
            </span>
          </div>

          <div className={`p-3.5 rounded-xl border ${
            isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#101A14]/70 border-[#1E2E25]"
          }`}>
            <span className={`text-[11px] font-mono uppercase tracking-wider block ${
              isApple ? "text-[#86868B]" : "text-[#8A9990]"
            }`}>
              Syndicate Points
            </span>
            <div className={`mt-1 font-mono font-bold text-lg ${
              isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"
            }`}>
              {aggregateStats.totalPts} pts
            </div>
            <span className={`text-xs font-mono ${isApple ? "text-[#86868B]" : "text-[#8A9990]"}`}>
              Across {targetMeetings.reduce((acc, m) => acc + m.races.length, 0)} races
            </span>
          </div>

          <div className={`p-3.5 rounded-xl border ${
            isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#101A14]/70 border-[#1E2E25]"
          }`}>
            <span className={`text-[11px] font-mono uppercase tracking-wider block ${
              isApple ? "text-[#86868B]" : "text-[#8A9990]"
            }`}>
              Total Returns
            </span>
            <div className={`mt-1 font-mono font-bold text-lg ${
              isApple ? "text-[#34C759]" : "text-[#10B981]"
            }`}>
              {formatDollarReturn(aggregateStats.totalDiv)}
            </div>
            <span className={`text-xs font-mono ${isApple ? "text-[#86868B]" : "text-[#8A9990]"}`}>
              TAB dividends collected
            </span>
          </div>

          <div className={`p-3.5 rounded-xl border ${
            isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#101A14]/70 border-[#1E2E25]"
          }`}>
            <span className={`text-[11px] font-mono uppercase tracking-wider block ${
              isApple ? "text-[#86868B]" : "text-[#8A9990]"
            }`}>
              Winners Picked
            </span>
            <div className={`mt-1 font-mono font-bold text-lg ${
              isApple ? "text-[#0071E3]" : "text-[#D4AF37]"
            }`}>
              {aggregateStats.totalWins} 🏆
            </div>
            <span className={`text-xs font-mono ${isApple ? "text-[#86868B]" : "text-[#8A9990]"}`}>
              1st place consensus strikes
            </span>
          </div>
        </div>
      </div>

      {/* Podium Cards for Top 3 */}
      {podiumTop3.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {podiumTop3.map((stat, idx) => {
            const isFirst = idx === 0;
            const isSecond = idx === 1;

            const badgeTitle = isFirst ? "1st · Leader" : isSecond ? "2nd · Silver" : "3rd · Bronze";
            const badgeIcon = isFirst ? "🥇" : isSecond ? "🥈" : "🥉";

            return (
              <div
                key={stat.punter.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isApple
                    ? isFirst
                      ? "border-[#0071E3]/50 bg-white shadow-md ring-1 ring-[#0071E3]/30"
                      : "border-[#E5E5EA] bg-white hover:border-[#D2D2D7] shadow-sm"
                    : isFirst
                    ? "border-[#D4AF37] bg-[#121B15] shadow-[0_8px_24px_rgba(212,175,55,0.12)] ring-1 ring-[#D4AF37]/40"
                    : "border-[#1F2E26] bg-[#0E1612] hover:border-[#2E4237]"
                }`}
              >
                <div className={`flex items-center justify-between pb-3 border-b ${
                  isApple ? "border-[#E5E5EA]" : "border-[#1C2C23]"
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{badgeIcon}</span>
                    <div>
                      <span className={`text-[10px] font-mono uppercase tracking-wider font-bold ${
                        isApple ? "text-[#86868B]" : "text-[#8A9990]"
                      }`}>
                        {badgeTitle}
                      </span>
                      <h3 className={`text-base font-display font-bold ${
                        isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"
                      }`}>
                        {stat.punter.name}
                      </h3>
                    </div>
                  </div>
                  {stat.jokerTriggered && (
                    <span
                      title="🃏 2× Joker Round Hit!"
                      className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border ${
                        isApple
                          ? "bg-[#FFF5E6] border-[#FF9500]/40 text-[#FF9500]"
                          : "bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#D4AF37]"
                      }`}
                    >
                      🃏 2× Hit
                    </span>
                  )}
                </div>

                {/* Score Big Display */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                  <div className={`p-2.5 rounded-xl border ${
                    isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#080D0A] border-[#1A2820]"
                  }`}>
                    <span className={`text-[10px] font-mono uppercase block ${
                      isApple ? "text-[#86868B]" : "text-[#8A9990]"
                    }`}>
                      Total Points
                    </span>
                    <span className={`text-xl font-mono font-black ${
                      isApple ? "text-[#0071E3]" : "text-[#D4AF37]"
                    }`}>
                      {stat.totalPoints}
                    </span>
                    <span className={`text-[10px] block ${
                      isApple ? "text-[#86868B]" : "text-[#8A9990]"
                    }`}>pts</span>
                  </div>
                  <div className={`p-2.5 rounded-xl border ${
                    isApple ? "bg-[#F2F2F7] border-[#E5E5EA]" : "bg-[#080D0A] border-[#1A2820]"
                  }`}>
                    <span className={`text-[10px] font-mono uppercase block ${
                      isApple ? "text-[#86868B]" : "text-[#8A9990]"
                    }`}>
                      Dollar Return
                    </span>
                    <span className={`text-xl font-mono font-black ${
                      isApple ? "text-[#34C759]" : "text-[#10B981]"
                    }`}>
                      ${stat.totalDollarReturn.toFixed(2)}
                    </span>
                    <span className={`text-[10px] block ${
                      isApple ? "text-[#86868B]" : "text-[#8A9990]"
                    }`}>
                      ROI: {stat.roiPercentage > 0 ? `+${stat.roiPercentage}%` : `${stat.roiPercentage}%`}
                    </span>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="mt-3.5 space-y-1.5 text-xs font-mono">
                  <div className={`flex items-center justify-between ${
                    isApple ? "text-[#86868B]" : "text-[#8A9990]"
                  }`}>
                    <span>Win Strike Rate:</span>
                    <strong className={isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"}>
                      {stat.winStrikeRate}% ({stat.winnersPicked} wins)
                    </strong>
                  </div>
                  <div className={`flex items-center justify-between ${
                    isApple ? "text-[#86868B]" : "text-[#8A9990]"
                  }`}>
                    <span>Podium (1-2-3):</span>
                    <strong className={isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"}>
                      {stat.podiumsPicked} places ({stat.secondsPicked} 2nd · {stat.thirdsPicked} 3rd)
                    </strong>
                  </div>
                  <div className={`flex items-center justify-between ${
                    isApple ? "text-[#86868B]" : "text-[#8A9990]"
                  }`}>
                    <span>Races Tipped:</span>
                    <strong className={isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"}>
                      {stat.racesTipped} races
                    </strong>
                  </div>
                </div>

                {/* Jump to Selections Action */}
                {onJumpToSelections && (
                  <button
                    type="button"
                    onClick={() => onJumpToSelections(stat.punter.id, selectedMeetingId)}
                    className={`mt-4 w-full py-2 rounded-xl border text-xs font-mono font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      isApple
                        ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#0071E3] hover:bg-[#E5E5EA]"
                        : "bg-[#14231B] border-[#23352B] hover:border-[#D4AF37]/50 text-[#D5DDD8] hover:text-[#D4AF37]"
                    }`}
                  >
                    <span>View Selections</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Full Leaderboard Table */}
      <div className={`rounded-2xl border overflow-hidden shadow-lg ${
        isApple ? "border-[#E5E5EA] bg-white" : "border-[#1E2E25] bg-[#0A120E]"
      }`}>
        <div className={`px-5 py-3.5 border-b flex items-center justify-between gap-2 ${
          isApple ? "bg-[#FAF9FA] border-[#E5E5EA]" : "bg-[#080D0A] border-[#1E2E25]"
        }`}>
          <span className={`font-mono text-xs uppercase font-bold tracking-wider ${
            isApple ? "text-[#0071E3]" : "text-[#D4AF37]"
          }`}>
            Full Registered Punters Standings ({sortedStats.length} Players)
          </span>
          <span className={`text-xs font-mono ${isApple ? "text-[#86868B]" : "text-[#8A9990]"}`}>
            Sorted by:{" "}
            <strong className={isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"}>
              {sortMode === "points"
                ? "Total Points"
                : sortMode === "dollars"
                ? "Dollar Return"
                : "Win Strike Rate"}
            </strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b text-[11px] font-mono uppercase tracking-wider ${
                isApple
                  ? "border-[#E5E5EA] bg-[#F2F2F7] text-[#86868B]"
                  : "border-[#1E2E25] bg-[#0C1510] text-[#8A9990]"
              }`}>
                <th className="py-3 px-4 w-12 text-center">Rank</th>
                <th className="py-3 px-4 min-w-[160px]">Punter</th>
                <th className="py-3 px-3 text-center">Total Points</th>
                <th className="py-3 px-3 text-center">Dollar Return</th>
                <th className="py-3 px-3 text-center">Placings (1-2-3)</th>
                <th className="py-3 px-3 text-center">Win Strike %</th>
                <th className="py-3 px-3 text-center">Joker Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isApple ? "divide-[#E5E5EA]" : "divide-[#16231C]"}`}>
              {sortedStats.map((stat, idx) => {
                const rank = idx + 1;
                const isLeader = rank === 1;

                return (
                  <tr
                    key={stat.punter.id}
                    className={`transition-colors ${
                      isApple
                        ? isLeader
                          ? "bg-[#0071E3]/5 hover:bg-[#0071E3]/10"
                          : "hover:bg-[#F2F2F7]"
                        : isLeader
                        ? "bg-[#D4AF37]/5 hover:bg-[#D4AF37]/10"
                        : "hover:bg-[#101A14]"
                    }`}
                  >
                    {/* Rank Badge */}
                    <td className="py-3.5 px-4 text-center align-middle font-mono font-bold">
                      {rank === 1 ? (
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-black text-xs shadow-sm ${
                          isApple ? "bg-[#0071E3] text-white" : "bg-[#D4AF37] text-[#070B09]"
                        }`}>
                          1
                        </span>
                      ) : rank === 2 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-[#070B09] font-black text-xs">
                          2
                        </span>
                      ) : rank === 3 ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-600 text-white font-black text-xs">
                          3
                        </span>
                      ) : (
                        <span className={isApple ? "text-[#86868B]" : "text-[#8A9990]"}>#{rank}</span>
                      )}
                    </td>

                    {/* Punter Name & Avatar */}
                    <td className="py-3.5 px-4 align-middle">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-xs shadow-sm border ${
                            isApple
                              ? "bg-[#EBF5FF] text-[#0071E3] border-[#0071E3]/30"
                              : "bg-[#12241A] text-[#10B981] border-[#1E3A2B]"
                          }`}
                        >
                          {stat.punter.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <div className={`font-display font-bold text-sm flex items-center gap-1.5 ${
                            isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"
                          }`}>
                            <span>{stat.punter.name}</span>
                            {isLeader && <span>👑</span>}
                          </div>
                          <span className={`text-[11px] font-mono ${
                            isApple ? "text-[#86868B]" : "text-[#8A9990]"
                          }`}>
                            {stat.completedRaces} races resulted
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Total Points */}
                    <td className="py-3.5 px-3 text-center align-middle font-mono">
                      <span className={`text-sm font-bold ${
                        isApple ? "text-[#0071E3]" : "text-[#D4AF37]"
                      }`}>
                        {stat.totalPoints} pts
                      </span>
                      {stat.jokerBonusPoints > 0 && (
                        <span className={`block text-[10px] ${
                          isApple ? "text-[#86868B]" : "text-[#A6B5AD]"
                        }`}>
                          (+{stat.jokerBonusPoints} Joker)
                        </span>
                      )}
                    </td>

                    {/* Dollar Return */}
                    <td className="py-3.5 px-3 text-center align-middle font-mono">
                      <span className={`text-sm font-bold ${
                        isApple ? "text-[#34C759]" : "text-[#10B981]"
                      }`}>
                        ${stat.totalDollarReturn.toFixed(2)}
                      </span>
                      <span
                        className={`block text-[10px] ${
                          stat.roiPercentage >= 0
                            ? isApple ? "text-[#34C759]" : "text-[#10B981]"
                            : "text-rose-500"
                        }`}
                      >
                        {stat.roiPercentage >= 0 ? `+${stat.roiPercentage}%` : `${stat.roiPercentage}%`} ROI
                      </span>
                    </td>

                    {/* Placings breakdown */}
                    <td className="py-3.5 px-3 text-center align-middle font-mono">
                      <div className="inline-flex items-center gap-1">
                        <span className={`px-1.5 py-0.5 rounded font-bold ${
                          isApple
                            ? "bg-[#FFF5E6] text-[#FF9500]"
                            : "bg-[#D4AF37]/15 text-[#D4AF37]"
                        }`} title="1st Place Wins">
                          {stat.winnersPicked}W
                        </span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${
                          isApple ? "bg-[#F2F2F7] text-[#1D1D1F]" : "bg-slate-300/15 text-slate-300"
                        }`} title="2nd Place">
                          {stat.secondsPicked}P
                        </span>
                        <span className={`px-1.5 py-0.5 rounded font-bold ${
                          isApple ? "bg-[#EAFBF0] text-[#34C759]" : "bg-amber-700/20 text-amber-400"
                        }`} title="3rd Place">
                          {stat.thirdsPicked}S
                        </span>
                      </div>
                    </td>

                    {/* Strike Rate */}
                    <td className="py-3.5 px-3 text-center align-middle font-mono">
                      <div className="flex flex-col items-center">
                        <span className={`font-bold ${isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"}`}>
                          {stat.winStrikeRate}%
                        </span>
                        <div className={`w-16 h-1.5 rounded-full overflow-hidden mt-1 ${
                          isApple ? "bg-[#E5E5EA]" : "bg-[#17231C]"
                        }`}>
                          <div
                            className={`h-full rounded-full ${
                              isApple ? "bg-[#34C759]" : "bg-[#10B981]"
                            }`}
                            style={{ width: `${Math.min(100, stat.winStrikeRate)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Joker Status */}
                    <td className="py-3.5 px-3 text-center align-middle font-mono">
                      {stat.jokerRaceNo ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${
                            isApple
                              ? stat.jokerTriggered
                                ? "bg-[#FFF5E6] border-[#FF9500]/40 text-[#FF9500]"
                                : "bg-[#F2F2F7] border-[#E5E5EA] text-[#86868B]"
                              : stat.jokerTriggered
                              ? "bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#D4AF37]"
                              : "bg-[#14201A] border border-[#23352B] text-[#8A9990]"
                          }`}
                        >
                          <span>🃏 R{stat.jokerRaceNo}</span>
                          {stat.jokerTriggered && <span>✓</span>}
                        </span>
                      ) : (
                        <span className={isApple ? "text-[#C7C7CC]" : "text-[#64756B]"}>—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right align-middle font-mono">
                      {onJumpToSelections && (
                        <button
                          type="button"
                          onClick={() => onJumpToSelections(stat.punter.id, selectedMeetingId)}
                          className={`px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                            isApple
                              ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#0071E3] hover:bg-[#E5E5EA]"
                              : "bg-[#14231B] border-[#23352B] hover:border-[#D4AF37]/40 text-[#D5DDD8] hover:text-[#D4AF37]"
                          }`}
                        >
                          Picks →
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const PunterLeaderboard = React.memo(PunterLeaderboardComponent);

