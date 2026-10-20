import React, { useState, useMemo } from "react";
import {
  Award,
  ChevronRight,
  Flame,
  Scale,
  Shield,
  Sparkles,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import type { SavedRaceReport, ReportUserStandingRow } from "../../utils/raceReportArchive";
import { formatDollarReturn } from "../../utils/scoring";

interface PunterHeadToHeadDuelProps {
  report: SavedRaceReport;
  isApple?: boolean;
}

export const PunterHeadToHeadDuel: React.FC<PunterHeadToHeadDuelProps> = ({
  report,
  isApple = false,
}) => {
  const standings = report.standings || [];
  const [punterAId, setPunterAId] = useState<string>(() => standings[0]?.punterId || "");
  const [punterBId, setPunterBId] = useState<string>(() => standings[1]?.punterId || standings[0]?.punterId || "");
  const [sortField, setSortField] = useState<"net" | "roi" | "strike" | "points">("net");

  const punterA = useMemo(() => standings.find((s) => s.punterId === punterAId) || standings[0], [standings, punterAId]);
  const punterB = useMemo(() => standings.find((s) => s.punterId === punterBId) || standings[1] || standings[0], [standings, punterBId]);

  // Head-to-head duel comparison
  const duelStats = useMemo(() => {
    if (!punterA || !punterB) return null;

    let aWinsRace = 0;
    let bWinsRace = 0;
    let ties = 0;

    for (const r of report.raceRows) {
      const cellA = r.userCells.find((u) => u.punterId === punterA.punterId);
      const cellB = r.userCells.find((u) => u.punterId === punterB.punterId);
      const ptsA = cellA?.points ?? 0;
      const ptsB = cellB?.points ?? 0;

      if (ptsA > ptsB) aWinsRace += 1;
      else if (ptsB > ptsA) bWinsRace += 1;
      else ties += 1;
    }

    const netA = punterA.eachWayNetVsPar || 0;
    const netB = punterB.eachWayNetVsPar || 0;
    const netDiff = netA - netB;

    const roiA = punterA.eachWayReturnRatePct || 0;
    const roiB = punterB.eachWayReturnRatePct || 0;

    return {
      aWinsRace,
      bWinsRace,
      ties,
      netDiff,
      winner: netDiff > 0 ? punterA.punterName : netDiff < 0 ? punterB.punterName : "Tie",
      strikeDiff: (punterA.strikeRatePct || 0) - (punterB.strikeRatePct || 0),
    };
  }, [punterA, punterB, report.raceRows]);

  // Sorted leaderboard
  const sortedStandings = useMemo(() => {
    return [...standings].sort((a, b) => {
      if (sortField === "net") return (b.eachWayNetVsPar || 0) - (a.eachWayNetVsPar || 0);
      if (sortField === "roi") return (b.eachWayReturnRatePct || 0) - (a.eachWayReturnRatePct || 0);
      if (sortField === "strike") return (b.strikeRatePct || 0) - (a.strikeRatePct || 0);
      return b.totalPoints - a.totalPoints;
    });
  }, [standings, sortField]);

  return (
    <div
      className={`rounded-2xl border transition-all ${
        isApple
          ? "bg-white border-[#E5E5EA] shadow-sm text-[#1D1D1F]"
          : "bg-[#0E1512] border-[#23352C] text-[#F3F4F0]"
      } p-4 sm:p-6 space-y-6`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-current/10">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-mono font-bold tracking-wider uppercase ${
                isApple ? "text-[#0071E3]" : "text-[#D4AF37]"
              }`}
            >
              Syndicate Leaderboard &amp; Head-to-Head Duel
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold tracking-tight mt-0.5">
            Punter Accuracy, ROI &amp; Head-to-Head Duel
          </h3>
          <p className="text-xs text-current/70 mt-0.5">
            Side-by-side performance duel and comprehensive $1 Each-Way ROI leaderboard.
          </p>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-1 bg-current/5 p-1 rounded-xl text-xs font-mono">
          <span className="px-2 text-current/50 text-[11px]">Sort:</span>
          {(["net", "roi", "strike", "points"] as const).map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => setSortField(field)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all uppercase text-[10px] cursor-pointer ${
                sortField === field
                  ? isApple
                    ? "bg-[#0071E3] text-white shadow-sm"
                    : "bg-[#D4AF37] text-[#070B09] shadow-sm"
                  : "text-current/70 hover:text-current hover:bg-current/5"
              }`}
            >
              {field === "net" ? "Net P/L" : field === "roi" ? "ROI %" : field === "strike" ? "Strike" : "Points"}
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================================
          INTERACTIVE 1-ON-1 PUNTER DUEL
         ========================================================================= */}
      {punterA && punterB && (
        <div
          className={`p-4 sm:p-5 rounded-xl border ${
            isApple ? "bg-[#F5F5F7] border-[#E5E5EA]" : "bg-[#070B09] border-[#1C2C24]"
          } space-y-4`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-[#D4AF37]" />
              <span className="text-xs font-bold uppercase tracking-wider font-mono">
                Head-to-Head Matchup Duel
              </span>
            </div>
            {duelStats && (
              <span className="text-xs font-mono text-current/70">
                Direct Race Wins: <span className="font-bold text-[#10B981]">{duelStats.aWinsRace}</span> vs{" "}
                <span className="font-bold text-[#38BDF8]">{duelStats.bWinsRace}</span> ({duelStats.ties} Ties)
              </span>
            )}
          </div>

          {/* Selectors and Duel Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Punter A Card */}
            <div className={`p-4 rounded-xl border ${isApple ? "bg-white border-[#D1D1D6]" : "bg-[#14201A] border-[#2E4539]"} space-y-3`}>
              <div className="flex items-center justify-between">
                <select
                  value={punterAId}
                  onChange={(e) => setPunterAId(e.target.value)}
                  className={`text-sm font-bold rounded-lg px-2.5 py-1 font-sans border focus:outline-none ${
                    isApple
                      ? "bg-[#F5F5F7] border-[#D1D1D6] text-[#1D1D1F]"
                      : "bg-[#070B09] border-[#2E4539] text-[#F3F4F0]"
                  }`}
                >
                  {standings.map((s) => (
                    <option key={s.punterId} value={s.punterId}>
                      {s.punterName} ({s.role})
                    </option>
                  ))}
                </select>
                <span className="text-xs font-mono font-bold text-[#D4AF37]">#{punterA.rank} Overall</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2 rounded-lg bg-current/5">
                  <div className="text-[10px] text-current/60 uppercase">Net vs Par</div>
                  <div
                    className={`font-bold text-xs ${
                      (punterA.eachWayNetVsPar || 0) >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
                    }`}
                  >
                    {(punterA.eachWayNetVsPar || 0) >= 0 ? "+" : ""}
                    {(punterA.eachWayNetVsPar || 0).toFixed(1)}u
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-current/5">
                  <div className="text-[10px] text-current/60 uppercase">ROI %</div>
                  <div className="font-bold text-xs">{punterA.eachWayReturnRatePct || 0}%</div>
                </div>
                <div className="p-2 rounded-lg bg-current/5">
                  <div className="text-[10px] text-current/60 uppercase">Strike Rate</div>
                  <div className="font-bold text-xs text-[#38BDF8]">{punterA.strikeRatePct}%</div>
                </div>
              </div>
            </div>

            {/* Punter B Card */}
            <div className={`p-4 rounded-xl border ${isApple ? "bg-white border-[#D1D1D6]" : "bg-[#14201A] border-[#2E4539]"} space-y-3`}>
              <div className="flex items-center justify-between">
                <select
                  value={punterBId}
                  onChange={(e) => setPunterBId(e.target.value)}
                  className={`text-sm font-bold rounded-lg px-2.5 py-1 font-sans border focus:outline-none ${
                    isApple
                      ? "bg-[#F5F5F7] border-[#D1D1D6] text-[#1D1D1F]"
                      : "bg-[#070B09] border-[#2E4539] text-[#F3F4F0]"
                  }`}
                >
                  {standings.map((s) => (
                    <option key={s.punterId} value={s.punterId}>
                      {s.punterName} ({s.role})
                    </option>
                  ))}
                </select>
                <span className="text-xs font-mono font-bold text-[#D4AF37]">#{punterB.rank} Overall</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2 rounded-lg bg-current/5">
                  <div className="text-[10px] text-current/60 uppercase">Net vs Par</div>
                  <div
                    className={`font-bold text-xs ${
                      (punterB.eachWayNetVsPar || 0) >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
                    }`}
                  >
                    {(punterB.eachWayNetVsPar || 0) >= 0 ? "+" : ""}
                    {(punterB.eachWayNetVsPar || 0).toFixed(1)}u
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-current/5">
                  <div className="text-[10px] text-current/60 uppercase">ROI %</div>
                  <div className="font-bold text-xs">{punterB.eachWayReturnRatePct || 0}%</div>
                </div>
                <div className="p-2 rounded-lg bg-current/5">
                  <div className="text-[10px] text-current/60 uppercase">Strike Rate</div>
                  <div className="font-bold text-xs text-[#38BDF8]">{punterB.strikeRatePct}%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SYNDICATE LEADERBOARD TABLE
         ========================================================================= */}
      <div className="overflow-x-auto rounded-xl border border-current/10">
        <table className="w-full text-left text-xs border-collapse font-mono">
          <thead>
            <tr className={isApple ? "bg-[#F5F5F7] text-[#6E6E73]" : "bg-[#070B09] text-[#8A9990]"}>
              <th className="py-2.5 px-3 font-semibold">Rank</th>
              <th className="py-2.5 px-3 font-semibold">Punter</th>
              <th className="py-2.5 px-3 text-right font-semibold">$1 EW Return</th>
              <th className="py-2.5 px-3 text-right font-semibold">Net vs Par</th>
              <th className="py-2.5 px-3 text-right font-semibold">ROI %</th>
              <th className="py-2.5 px-3 text-right font-semibold">Winners</th>
              <th className="py-2.5 px-3 text-right font-semibold">Podiums</th>
              <th className="py-2.5 px-3 text-right font-semibold">Strike %</th>
              <th className="py-2.5 px-3 text-right font-semibold">Fav Pick %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-current/5">
            {sortedStandings.map((p, idx) => {
              const isLead = idx === 0;
              const isProfit = (p.eachWayNetVsPar || 0) >= 0;

              return (
                <tr
                  key={p.punterId}
                  className={`transition-colors ${
                    isLead
                      ? isApple
                        ? "bg-[#FEF3C7]/30 font-semibold"
                        : "bg-[#D4AF37]/10 font-semibold"
                      : isApple
                      ? "hover:bg-[#F5F5F7]"
                      : "hover:bg-[#14201A]"
                  }`}
                >
                  <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-md text-xs ${
                        isLead
                          ? "bg-[#D4AF37] text-[#070B09]"
                          : idx === 1
                          ? "bg-[#94A3B8] text-[#0F172A]"
                          : idx === 2
                          ? "bg-[#B45309] text-white"
                          : "text-current/60"
                      }`}
                    >
                      #{p.rank}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap font-sans">
                    <div className="font-bold text-sm tracking-tight">{p.punterName}</div>
                    <div className="text-[11px] font-mono text-current/60">{p.role}</div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-[#10B981] whitespace-nowrap">
                    {formatDollarReturn(p.eachWayDollarReturn || 0)}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                      isProfit ? "text-[#10B981]" : "text-[#EF4444]"
                    }`}
                  >
                    {isProfit ? "+" : ""}
                    {(p.eachWayNetVsPar || 0).toFixed(2)}u
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold">
                    {p.eachWayReturnRatePct || 0}%
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <span className="font-bold text-[#D4AF37]">{p.winnersPicked}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <span>{p.podiumsPicked}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-[#38BDF8]">
                    {p.strikeRatePct}%
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap text-current/70">
                    {p.favouriteSelectionRatePct || 0}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
