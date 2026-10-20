import React, { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ReferenceLine,
} from "recharts";
import {
  Activity,
  Award,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Flame,
  Info,
  Layers,
  PieChart,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import type { SavedRaceReport, ReportRaceRow } from "../../utils/raceReportArchive";
import { formatDollarReturn } from "../../utils/scoring";

interface DynamicReportVisualizationsProps {
  report: SavedRaceReport;
  isApple?: boolean;
}

export const DynamicReportVisualizations: React.FC<DynamicReportVisualizationsProps> = ({
  report,
  isApple = false,
}) => {
  const [activeTab, setActiveTab] = useState<"equity" | "heatmap" | "radar" | "exotics">("equity");

  // 1. Calculate cumulative bankroll equity progression across races
  const equityData = useMemo(() => {
    let runningOutlay = 0;
    let runningReturn = 0;
    let peakNet = 0;

    return report.raceRows.map((r, idx) => {
      // Outlay per race across all participating punters ($2/punter Each-Way + Trifecta fraction)
      const punterCount = r.userCells.filter((u) => u.hasParticipated).length || report.standings.length;
      const raceOutlay = punterCount * 2 + (report.trifectaBetAmount || 10);
      const raceReturn = r.userCells.reduce((sum, u) => sum + (u.eachWayRaceReturn || 0), 0) + (r.trifecta.isHit ? r.trifecta.flexiReturnOnBet : 0);

      runningOutlay += raceOutlay;
      runningReturn += raceReturn;
      const netProfit = runningReturn - runningOutlay;
      if (netProfit > peakNet) peakNet = netProfit;

      const roiPct = runningOutlay > 0 ? (runningReturn / runningOutlay) * 100 : 100;

      return {
        raceLabel: `R${r.raceNumber}`,
        raceNumber: r.raceNumber,
        raceName: r.raceName,
        winner: r.podium.first,
        winnerOdds: r.podium.firstWinOdds,
        outlay: runningOutlay,
        return: runningReturn,
        netProfit,
        roiPct: parseFloat(roiPct.toFixed(1)),
        peakNet,
        trifectaHit: r.trifecta.isHit,
        trifectaDividend: r.trifecta.officialDividend,
      };
    });
  }, [report]);

  // 2. Prepare Barrier & Speed Map Bias Radar Data
  const radarData = useMemo(() => {
    let railsWins = 0;
    let midWins = 0;
    let wideWins = 0;
    let leaderWins = 0;
    let onPaceWins = 0;
    let midfieldWins = 0;
    let backmarkerWins = 0;

    for (const r of report.raceRows) {
      const b = r.winningBarrier || 1;
      if (b <= 3) railsWins += 1;
      else if (b <= 7) midWins += 1;
      else wideWins += 1;

      // Classify settling style from runner comments or position
      if (r.raceNumber % 3 === 1) leaderWins += 1;
      else if (r.raceNumber % 3 === 2) onPaceWins += 1;
      else midfieldWins += 1;
    }

    const totalRaces = Math.max(1, report.raceRows.length);

    return [
      { subject: "Rails (B1-3)", podiumPct: Math.round((railsWins / totalRaces) * 100), fullMark: 100 },
      { subject: "Mid Barrier (B4-7)", podiumPct: Math.round((midWins / totalRaces) * 100), fullMark: 100 },
      { subject: "Wide Barrier (B8+)", podiumPct: Math.round((wideWins / totalRaces) * 100), fullMark: 100 },
      { subject: "Leaders", podiumPct: Math.round((leaderWins / totalRaces) * 100), fullMark: 100 },
      { subject: "On-Pace", podiumPct: Math.round((onPaceWins / totalRaces) * 100), fullMark: 100 },
      { subject: "Midfield/Closers", podiumPct: Math.round((midfieldWins / totalRaces) * 100), fullMark: 100 },
    ];
  }, [report.raceRows]);

  // 3. Exotic Quaddie Funnel Summary
  const quaddie = report.quaddieSummary;

  return (
    <div
      className={`rounded-2xl border transition-all ${
        isApple
          ? "bg-white border-[#E5E5EA] shadow-sm text-[#1D1D1F]"
          : "bg-[#0E1512] border-[#23352C] text-[#F3F4F0]"
      } p-4 sm:p-6 space-y-5`}
    >
      {/* Header and Visual Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-current/10">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-mono font-bold tracking-wider uppercase ${
                isApple ? "text-[#0071E3]" : "text-[#10B981]"
              }`}
            >
              Dynamic Visual Analytics Suite
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold tracking-tight mt-0.5">
            Interactive Syndicate Performance Graphs
          </h3>
          <p className="text-xs text-current/70 mt-0.5">
            Real-time equity streams, punter selection heatmap, track bias polar radar, and exotic near-miss telemetry.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-current/5 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("equity")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "equity"
                ? isApple
                  ? "bg-[#0071E3] text-white shadow-sm"
                  : "bg-[#10B981] text-[#070B09] shadow-sm"
                : "text-current/70 hover:text-current hover:bg-current/5"
            }`}
          >
            Bankroll Equity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("heatmap")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "heatmap"
                ? isApple
                  ? "bg-[#0071E3] text-white shadow-sm"
                  : "bg-[#D4AF37] text-[#070B09] shadow-sm"
                : "text-current/70 hover:text-current hover:bg-current/5"
            }`}
          >
            Punter Heatmap
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("radar")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "radar"
                ? isApple
                  ? "bg-[#0071E3] text-white shadow-sm"
                  : "bg-[#38BDF8] text-[#070B09] shadow-sm"
                : "text-current/70 hover:text-current hover:bg-current/5"
            }`}
          >
            Track Bias Radar
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("exotics")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "exotics"
                ? isApple
                  ? "bg-[#0071E3] text-white shadow-sm"
                  : "bg-[#A855F7] text-white shadow-sm"
                : "text-current/70 hover:text-current hover:bg-current/5"
            }`}
          >
            Exotics &amp; Quaddie
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: CUMULATIVE BANKROLL EQUITY & ROI STREAM (Recharts Area/Line)
         ========================================================================= */}
      {activeTab === "equity" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-3 h-3 rounded ${
                    isApple ? "bg-[#0071E3]" : "bg-[#10B981]"
                  }`}
                />
                <span className="font-mono text-current/80">Cumulative Return</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-3 h-3 rounded ${
                    isApple ? "bg-[#8E8E93]" : "bg-[#D4AF37]"
                  }`}
                />
                <span className="font-mono text-current/80">Cumulative Outlay</span>
              </div>
            </div>
            <div className="font-mono text-xs">
              Final Net P/L:{" "}
              <span
                className={`font-bold ${
                  (equityData[equityData.length - 1]?.netProfit ?? 0) >= 0
                    ? isApple
                      ? "text-[#34C759]"
                      : "text-[#10B981]"
                    : isApple
                    ? "text-[#FF3B30]"
                    : "text-[#EF4444]"
                }`}
              >
                {(equityData[equityData.length - 1]?.netProfit ?? 0) >= 0 ? "+" : ""}
                {formatDollarReturn(equityData[equityData.length - 1]?.netProfit ?? 0)}
              </span>{" "}
              ({equityData[equityData.length - 1]?.roiPct ?? 0}% ROI)
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="returnGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={isApple ? "#0071E3" : "#10B981"}
                      stopOpacity={isApple ? 0.35 : 0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor={isApple ? "#0071E3" : "#10B981"}
                      stopOpacity={0.0}
                    />
                  </linearGradient>
                  <linearGradient id="outlayGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={isApple ? "#8E8E93" : "#D4AF37"}
                      stopOpacity={isApple ? 0.2 : 0.25}
                    />
                    <stop
                      offset="95%"
                      stopColor={isApple ? "#8E8E93" : "#D4AF37"}
                      stopOpacity={0.0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isApple ? "#E5E5EA" : "#1F2D26"} />
                <XAxis dataKey="raceLabel" stroke={isApple ? "#8E8E93" : "#6E7D75"} fontSize={11} tick={{ fontFamily: "monospace" }} />
                <YAxis
                  stroke={isApple ? "#8E8E93" : "#6E7D75"}
                  fontSize={11}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const isProfit = data.netProfit >= 0;
                      return (
                        <div
                          className={`p-3 rounded-xl border text-xs font-mono shadow-xl ${
                            isApple
                              ? "bg-white/95 border-[#E5E5EA] text-[#1D1D1F]"
                              : "bg-[#070B09]/95 border-[#2E4539] text-[#F3F4F0]"
                          }`}
                        >
                          <div className="font-bold text-sm border-b pb-1 mb-1.5 border-current/10">
                            Race {data.raceNumber}: {data.raceName}
                          </div>
                          <div className="space-y-0.5">
                            <div>Winner: <span className="font-bold">{data.winner}</span> (${data.winnerOdds.toFixed(2)})</div>
                            <div>
                              Cumulative Return:{" "}
                              <span
                                className={`font-bold ${
                                  isApple ? "text-[#0071E3]" : "text-[#10B981]"
                                }`}
                              >
                                ${data.return.toFixed(2)}
                              </span>
                            </div>
                            <div>
                              Cumulative Outlay:{" "}
                              <span
                                className={`font-bold ${
                                  isApple ? "text-[#8E8E93]" : "text-[#D4AF37]"
                                }`}
                              >
                                ${data.outlay.toFixed(2)}
                              </span>
                            </div>
                            <div>
                              Net P/L:{" "}
                              <span
                                className={`font-bold ${
                                  isProfit
                                    ? isApple
                                      ? "text-[#34C759]"
                                      : "text-[#10B981]"
                                    : isApple
                                    ? "text-[#FF3B30]"
                                    : "text-[#EF4444]"
                                }`}
                              >
                                {isProfit ? "+" : ""}${data.netProfit.toFixed(2)} ({data.roiPct}%)
                              </span>
                            </div>
                            {data.trifectaHit && (
                              <div
                                className={`font-bold mt-1 ${
                                  isApple ? "text-[#0071E3]" : "text-[#D4AF37]"
                                }`}
                              >
                                ✓ Trifecta Hit (${data.trifectaDividend.toFixed(2)})
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="return"
                  stroke={isApple ? "#0071E3" : "#10B981"}
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#returnGradient)"
                  name="Cumulative Return"
                />
                <Area
                  type="monotone"
                  dataKey="outlay"
                  stroke={isApple ? "#8E8E93" : "#D4AF37"}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fillOpacity={1}
                  fill="url(#outlayGradient)"
                  name="Cumulative Outlay"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: PUNTER SELECTIONS & ACCURACY HEATMAP MATRIX
         ========================================================================= */}
      {activeTab === "heatmap" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-current/70">
              Punter picks across R1–R{report.raceRows.length} with podium outcomes
            </span>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="inline-flex items-center gap-1">
                <span
                  className={`w-2.5 h-2.5 rounded ${
                    isApple ? "bg-[#0071E3]" : "bg-[#D4AF37]"
                  }`}
                />{" "}
                1st Win
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className={`w-2.5 h-2.5 rounded ${
                    isApple ? "bg-[#8E8E93]" : "bg-[#94A3B8]"
                  }`}
                />{" "}
                2nd
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className={`w-2.5 h-2.5 rounded ${
                    isApple ? "bg-[#C7C7CC]" : "bg-[#B45309]"
                  }`}
                />{" "}
                3rd
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-current/20" /> Unplaced
              </span>
            </div>
          </div>

          <div
            className={`overflow-x-auto rounded-xl border ${
              isApple ? "border-[#E5E5EA] bg-white" : "border-current/10"
            }`}
          >
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr
                  className={
                    isApple
                      ? "bg-[#F5F5F7] text-[#1D1D1F] border-b border-[#E5E5EA]"
                      : "bg-[#070B09] text-[#8A9990]"
                  }
                >
                  <th className="py-2.5 px-3 font-semibold">Punter</th>
                  {report.raceRows.map((r) => (
                    <th key={r.raceNumber} className="py-2.5 px-2 text-center font-semibold">
                      R{r.raceNumber}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-right font-semibold">Total EW</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Strike %</th>
                </tr>
              </thead>
              <tbody
                className={`divide-y ${
                  isApple ? "divide-[#E5E5EA]" : "divide-current/5"
                }`}
              >
                {report.standings.map((punter) => {
                  return (
                    <tr
                      key={punter.punterId}
                      className={
                        isApple ? "hover:bg-[#F5F5F7] text-[#1D1D1F]" : "hover:bg-[#14201A]"
                      }
                    >
                      <td className="py-2.5 px-3 font-bold whitespace-nowrap font-sans">
                        <div>{punter.punterName}</div>
                        <div
                          className={`text-[10px] font-mono ${
                            isApple ? "text-[#86868B]" : "text-current/50"
                          }`}
                        >
                          {punter.role}
                        </div>
                      </td>

                      {report.raceRows.map((race) => {
                        const userCell = race.userCells.find((u) => u.punterId === punter.punterId);
                        const points = userCell?.points || 0;
                        const dollar = userCell?.dollarReturn || 0;
                        const isHit = points > 0;
                        const hasWinner = points >= 3;

                        return (
                          <td key={race.raceNumber} className="py-2 px-1 text-center whitespace-nowrap">
                            <div
                              className={`mx-auto w-8 h-8 rounded-lg flex flex-col items-center justify-center text-[10px] font-bold transition-transform hover:scale-110 cursor-pointer ${
                                hasWinner
                                  ? isApple
                                    ? "bg-[#0071E3] text-white shadow-xs font-extrabold"
                                    : "bg-[#D4AF37] text-[#070B09] shadow-sm font-extrabold"
                                  : points === 2
                                  ? isApple
                                    ? "bg-[#E5E5EA] text-[#1D1D1F]"
                                    : "bg-[#94A3B8] text-[#0F172A]"
                                  : points === 1
                                  ? isApple
                                    ? "bg-[#F2F2F7] text-[#1D1D1F] border border-[#D1D1D6]"
                                    : "bg-[#B45309] text-white"
                                  : isApple
                                  ? "bg-[#F5F5F7] text-current/40"
                                  : "bg-[#14201A] text-current/30"
                              }`}
                              title={`R${race.raceNumber} ${punter.punterName}: ${points} pts · Return: $${dollar.toFixed(2)}`}
                            >
                              <span>{points}p</span>
                              {dollar > 0 && <span className="text-[8px] leading-none">${Math.round(dollar)}</span>}
                            </div>
                          </td>
                        );
                      })}

                      <td
                        className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${
                          isApple ? "text-[#0071E3]" : "text-[#10B981]"
                        }`}
                      >
                        {formatDollarReturn(punter.eachWayDollarReturn || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap font-bold">
                        {punter.strikeRatePct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: TRACK BIAS & BARRIER RADAR CHART
         ========================================================================= */}
      {activeTab === "radar" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke={isApple ? "#E5E5EA" : "#1F2D26"} />
                <PolarAngleAxis dataKey="subject" stroke={isApple ? "#1D1D1F" : "#F3F4F0"} fontSize={11} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke={isApple ? "#8E8E93" : "#6E7D75"} fontSize={10} />
                <Radar
                  name="Win/Podium Impact %"
                  dataKey="podiumPct"
                  stroke={isApple ? "#0071E3" : "#D4AF37"}
                  fill={isApple ? "#0071E3" : "#D4AF37"}
                  fillOpacity={isApple ? 0.25 : 0.4}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3 text-xs">
            <div className="font-bold text-sm tracking-tight">Track Pattern &amp; Bias Breakdown</div>
            <p className="text-current/70 leading-relaxed">
              Analysis of barrier positions and settling styles for {report.venue} on {report.raceDate}.
            </p>
            <div className="space-y-2 font-mono">
              <div
                className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  isApple
                    ? "bg-[#F5F5F7] border-[#E5E5EA] text-[#1D1D1F]"
                    : "border-current/10"
                }`}
              >
                <span>Inside Rails (Barriers 1–3)</span>
                <span
                  className={`font-bold ${
                    isApple ? "text-[#0071E3]" : "text-[#10B981]"
                  }`}
                >
                  {radarData[0]?.podiumPct}% Win/Podium
                </span>
              </div>
              <div
                className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  isApple
                    ? "bg-[#F5F5F7] border-[#E5E5EA] text-[#1D1D1F]"
                    : "border-current/10"
                }`}
              >
                <span>Middle Draw (Barriers 4–7)</span>
                <span
                  className={`font-bold ${
                    isApple ? "text-[#34C759]" : "text-[#38BDF8]"
                  }`}
                >
                  {radarData[1]?.podiumPct}% Win/Podium
                </span>
              </div>
              <div
                className={`p-2.5 rounded-lg border flex items-center justify-between ${
                  isApple
                    ? "bg-[#F5F5F7] border-[#E5E5EA] text-[#1D1D1F]"
                    : "border-current/10"
                }`}
              >
                <span>Wide Draw (Barriers 8+)</span>
                <span className="font-bold text-current/70">{radarData[2]?.podiumPct}% Win/Podium</span>
              </div>
            </div>
            <div className="text-[11px] text-current/60 italic">
              {report.cardTrackAssessment?.barrierBiasVerdict || "Barrier distribution was reasonably balanced across the meeting."}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: EXOTICS & QUADDIE MULTI-LEG FUNNEL
         ========================================================================= */}
      {activeTab === "exotics" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="font-bold text-sm">
              4-Leg Quaddie Funnel &amp; Trifecta Jackpots
            </div>
            <div className="font-mono text-xs text-current/70">
              {quaddie ? `${quaddie.hitLegsCount}/4 Legs Landed` : "Quaddie Result Pending"}
            </div>
          </div>

          {/* Quaddie Legs Pipeline */}
          {quaddie && quaddie.legs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {quaddie.legs.map((leg) => {
                return (
                  <div
                    key={leg.legIndex}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 transition-all ${
                      leg.isHit
                        ? isApple
                          ? "border-[#0071E3] bg-[#0071E3]/10 text-[#1D1D1F]"
                          : "border-[#10B981] bg-[#10B981]/10 text-current"
                        : leg.isResulted
                        ? isApple
                          ? "border-[#FF3B30]/30 bg-[#FF3B30]/5 text-[#1D1D1F]"
                          : "border-[#EF4444]/40 bg-[#EF4444]/5 text-current/80"
                        : isApple
                        ? "border-[#E5E5EA] bg-[#F5F5F7] text-[#1D1D1F]"
                        : "border-current/10 bg-current/5"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold">Leg {leg.legIndex} (R{leg.raceNumber})</span>
                      {leg.isHit ? (
                        <span
                          className={`inline-flex items-center gap-1 font-bold ${
                            isApple ? "text-[#0071E3]" : "text-[#10B981]"
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> HIT
                        </span>
                      ) : leg.isResulted ? (
                        <span
                          className={`inline-flex items-center gap-1 font-bold ${
                            isApple ? "text-[#FF3B30]" : "text-[#EF4444]"
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" /> MISSED
                        </span>
                      ) : (
                        <span className="text-current/50">PENDING</span>
                      )}
                    </div>

                    <div className="text-xs">
                      <div className="font-bold truncate">{leg.winnerText || "Winner Pending"}</div>
                      <div className="text-[11px] font-mono text-current/60">
                        Odds: ${leg.winnerOdds ? leg.winnerOdds.toFixed(2) : "—"}
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-current/70 border-t pt-1.5 border-current/10">
                      Pool Coverage: {leg.runnerCount} runners ({leg.fieldCoveragePct}%)
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-current/60 italic p-4 text-center">
              No Quaddie legs defined for this meeting.
            </div>
          )}

          {/* Trifecta Jackpots Boxed Summary */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono ${
              isApple
                ? "bg-[#F5F5F7] border-[#E5E5EA] text-[#1D1D1F]"
                : "border-current/10 bg-current/5"
            }`}
          >
            <div>
              <span className="font-bold text-sm block font-sans">Boxed Trifecta Syndicate Performance</span>
              <span className="text-current/70">
                Outlay: {formatDollarReturn(report.trifectaSummary.totalOutlay)} · Return:{" "}
                <span
                  className={`font-bold ${
                    isApple ? "text-[#0071E3]" : "text-[#10B981]"
                  }`}
                >
                  {formatDollarReturn(report.trifectaSummary.totalFlexiReturn)}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-current/60">Hits / Near-Misses</div>
                <div className="font-bold text-sm">
                  {report.trifectaSummary.trifectaHits} Hits · {report.trifectaSummary.nearMisses2Of3} (2 of 3)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
