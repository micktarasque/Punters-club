import React, { useState, useMemo } from "react";
import {
  Calculator,
  ChevronRight,
  Coins,
  DollarSign,
  HelpCircle,
  Percent,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import type { SavedRaceReport } from "../../utils/raceReportArchive";
import { formatDollarReturn } from "../../utils/scoring";

interface TabDividendFlexiCalculatorProps {
  report: SavedRaceReport;
  isApple?: boolean;
}

type BetType = "Trifecta" | "Quinella" | "Exacta" | "FirstFour" | "Quaddie";

export const TabDividendFlexiCalculator: React.FC<TabDividendFlexiCalculatorProps> = ({
  report,
  isApple = false,
}) => {
  const [betType, setBetType] = useState<BetType>("Trifecta");
  const [totalSpend, setTotalSpend] = useState<number>(50);
  const [runnersCount, setRunnersCount] = useState<number>(5);
  const [simulatedDividend, setSimulatedDividend] = useState<number>(485.60);
  const [syndicateMembers, setSyndicateMembers] = useState<number>(
    () => report.standings.length || 6
  );

  // Compute combinations according to standard Australian TAB formulas
  const combinations = useMemo(() => {
    const n = Math.max(3, runnersCount);
    switch (betType) {
      case "Trifecta":
        // Boxed Trifecta: n * (n-1) * (n-2)
        return n * (n - 1) * (n - 2);
      case "Quinella":
        // Boxed Quinella: n * (n-1) / 2
        return (n * (n - 1)) / 2;
      case "Exacta":
        // Boxed Exacta: n * (n-1)
        return n * (n - 1);
      case "FirstFour":
        // Boxed First Four: n * (n-1) * (n-2) * (n-3)
        return n >= 4 ? n * (n - 1) * (n - 2) * (n - 3) : 24;
      case "Quaddie":
        // 4 legs with runner choices per leg (approximated as runnersCount/2 per leg, minimum 16)
        const perLeg = Math.max(2, Math.round(runnersCount / 2));
        return Math.pow(perLeg, 4);
      default:
        return 60;
    }
  }, [betType, runnersCount]);

  // Flexi percentage: (totalSpend / combinations) * 100
  const flexiPct = useMemo(() => {
    if (combinations <= 0) return 100;
    return Math.min(100, Math.max(0.01, (totalSpend / combinations) * 100));
  }, [totalSpend, combinations]);

  // Projected payout
  const projectedPayout = useMemo(() => {
    return (simulatedDividend * (flexiPct / 100));
  }, [simulatedDividend, flexiPct]);

  const netProfit = useMemo(() => {
    return projectedPayout - totalSpend;
  }, [projectedPayout, totalSpend]);

  const roiPct = useMemo(() => {
    return totalSpend > 0 ? (projectedPayout / totalSpend) * 100 : 0;
  }, [projectedPayout, totalSpend]);

  const payoutPerMember = useMemo(() => {
    return syndicateMembers > 0 ? projectedPayout / syndicateMembers : 0;
  }, [projectedPayout, syndicateMembers]);

  // Quick-load actual meeting exotic dividends
  const handleLoadActualDividend = (div: number, type: BetType) => {
    setSimulatedDividend(div);
    setBetType(type);
  };

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
                isApple ? "text-[#0071E3]" : "text-[#10B981]"
              }`}
            >
              Interactive Payout Simulator
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold tracking-tight mt-0.5">
            Live TAB Dividend Flexi Calculator
          </h3>
          <p className="text-xs text-current/70 mt-0.5">
            Simulate exotic returns, flexi investment percentages, and syndicate dividend splits.
          </p>
        </div>

        {/* Bet Type Tabs */}
        <div className="flex items-center gap-1 bg-current/5 p-1 rounded-xl text-xs font-mono">
          {(["Trifecta", "Quinella", "Exacta", "FirstFour", "Quaddie"] as BetType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setBetType(type)}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                betType === type
                  ? isApple
                    ? "bg-[#0071E3] text-white shadow-sm"
                    : "bg-[#10B981] text-[#070B09] shadow-sm"
                  : "text-current/70 hover:text-current hover:bg-current/5"
              }`}
            >
              {type === "FirstFour" ? "First 4" : type}
            </button>
          ))}
        </div>
      </div>

      {/* Simulator Inputs & Quick Presets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Input 1: Total Syndicate Spend */}
        <div className={`p-4 rounded-xl border ${isApple ? "bg-[#F5F5F7] border-[#E5E5EA]" : "bg-[#070B09] border-[#1C2C24]"} space-y-3`}>
          <div className="text-xs font-bold uppercase font-mono text-current/70">
            1. Total Bet Outlay ($)
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold">$</span>
            <input
              type="number"
              min="5"
              max="2000"
              step="5"
              value={totalSpend}
              onChange={(e) => setTotalSpend(Math.max(1, Number(e.target.value) || 0))}
              className={`w-full text-base font-mono font-bold rounded-lg px-3 py-1.5 border focus:outline-none ${
                isApple ? "bg-white border-[#D1D1D6] text-[#1D1D1F]" : "bg-[#14201A] border-[#2E4539] text-[#F3F4F0]"
              }`}
            />
          </div>
          {/* Spend Presets */}
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            {[10, 20, 50, 100, 200].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTotalSpend(preset)}
                className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                  totalSpend === preset
                    ? isApple
                      ? "bg-[#0071E3] text-white"
                      : "bg-[#10B981] text-[#070B09] font-bold"
                    : "bg-current/5 hover:bg-current/10"
                }`}
              >
                ${preset}
              </button>
            ))}
          </div>
        </div>

        {/* Input 2: Boxed Runners Count */}
        <div className={`p-4 rounded-xl border ${isApple ? "bg-[#F5F5F7] border-[#E5E5EA]" : "bg-[#070B09] border-[#1C2C24]"} space-y-3`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase font-mono text-current/70">
            <span>2. Boxed Runners</span>
            <span className="text-[#38BDF8]">{combinations} Combos</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={betType === "FirstFour" ? "4" : "3"}
              max="10"
              value={runnersCount}
              onChange={(e) => setRunnersCount(Number(e.target.value))}
              className="w-full cursor-pointer accent-[#10B981]"
            />
            <span className="font-mono text-lg font-bold w-8 text-center">{runnersCount}</span>
          </div>
          <div className="text-[11px] font-mono text-current/60">
            {betType === "Trifecta"
              ? `Box ${runnersCount} horses = ${combinations} combos`
              : betType === "FirstFour"
              ? `Box ${runnersCount} horses = ${combinations} combos`
              : `${runnersCount} selections = ${combinations} combos`}
          </div>
        </div>

        {/* Input 3: Official / Estimated $1 Dividend */}
        <div className={`p-4 rounded-xl border ${isApple ? "bg-[#F5F5F7] border-[#E5E5EA]" : "bg-[#070B09] border-[#1C2C24]"} space-y-3`}>
          <div className="flex items-center justify-between text-xs font-bold uppercase font-mono text-current/70">
            <span>3. $1 TAB Dividend</span>
            <span className="text-[#D4AF37]">Flexi: {flexiPct.toFixed(2)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold">$</span>
            <input
              type="number"
              min="2"
              max="100000"
              step="5"
              value={simulatedDividend}
              onChange={(e) => setSimulatedDividend(Math.max(1, Number(e.target.value) || 0))}
              className={`w-full text-base font-mono font-bold rounded-lg px-3 py-1.5 border focus:outline-none ${
                isApple ? "bg-white border-[#D1D1D6] text-[#1D1D1F]" : "bg-[#14201A] border-[#2E4539] text-[#F3F4F0]"
              }`}
            />
          </div>
          <div className="text-[11px] font-mono text-current/60">
            100% Full Unit Dividend: ${simulatedDividend.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Real-Time Simulated Output Ribbon */}
      <div
        className={`p-4 sm:p-5 rounded-xl border ${
          netProfit >= 0
            ? "border-[#10B981]/50 bg-[#10B981]/10"
            : "border-[#EF4444]/40 bg-[#EF4444]/5"
        } grid grid-cols-2 md:grid-cols-4 gap-4`}
      >
        <div>
          <div className="text-[10px] uppercase font-mono text-current/60">Calculated Flexi %</div>
          <div className="text-xl sm:text-2xl font-mono font-extrabold text-[#38BDF8]">
            {flexiPct.toFixed(2)}%
          </div>
          <div className="text-[11px] font-mono text-current/60 mt-0.5">
            ${(totalSpend / combinations).toFixed(3)} / combo
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase font-mono text-current/60">Total Collect ($)</div>
          <div className="text-xl sm:text-2xl font-mono font-extrabold text-[#10B981]">
            {formatDollarReturn(projectedPayout)}
          </div>
          <div className="text-[11px] font-mono text-current/60 mt-0.5">
            At {flexiPct.toFixed(1)}% Flexi Share
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase font-mono text-current/60">Syndicate Net P/L</div>
          <div
            className={`text-xl sm:text-2xl font-mono font-extrabold ${
              netProfit >= 0 ? "text-[#10B981]" : "text-[#EF4444]"
            }`}
          >
            {netProfit >= 0 ? "+" : ""}
            {formatDollarReturn(netProfit)}
          </div>
          <div className="text-[11px] font-mono text-current/60 mt-0.5">
            {roiPct.toFixed(0)}% ROI on Outlay
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase font-mono text-current/60">Per Member ({syndicateMembers})</div>
          <div className="text-xl sm:text-2xl font-mono font-extrabold text-[#D4AF37]">
            {formatDollarReturn(payoutPerMember)}
          </div>
          <div className="text-[11px] font-mono text-current/60 mt-0.5">
            Net: {netProfit >= 0 ? "+" : ""}{formatDollarReturn(netProfit / syndicateMembers)} each
          </div>
        </div>
      </div>
    </div>
  );
};
