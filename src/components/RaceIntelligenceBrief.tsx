import React, { useState, useMemo } from "react";
import {
  Zap,
  TrendingUp,
  Target,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Award,
  Layers,
  ArrowRight,
  ShieldAlert,
  Info,
} from "lucide-react";
import { RaceEvent, RaceRunner } from "../types/racing";
import {
  computeRaceSpeedMapAndFlucs,
  computeNormalizedFieldWinProbabilities,
  SpeedMapLane,
  RunnerSpeedAndMarketFluc,
} from "../utils/scoring";

interface RaceIntelligenceBriefProps {
  race: RaceEvent;
  meetingVenue?: string;
  trackCondition?: string;
  railPosition?: string;
  isApple?: boolean;
  isObsidian?: boolean;
  onAssignPreference?: (prefRank: 1 | 2 | 3, tabNumber: number) => void;
  className?: string;
}

export const RaceIntelligenceBrief: React.FC<RaceIntelligenceBriefProps> = ({
  race,
  meetingVenue = "",
  trackCondition = "Good 4",
  railPosition = "True",
  isApple = false,
  isObsidian = false,
  onAssignPreference,
  className = "",
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Compute speed map, tempo, flucs, and probabilities
  const intelligence = useMemo(() => {
    const speedData = computeRaceSpeedMapAndFlucs(race);
    const probMap = computeNormalizedFieldWinProbabilities(race);

    const runners = (race.runners || []).filter((r) => !r.isScratched);
    if (runners.length === 0) return null;

    // Sort runners by normalized win probability
    const sortedByProb = runners
      .map((r) => {
        const prob = probMap.get(r.tabNumber) ?? 0.05;
        const currentOdds = Number(r.fixedWin || r.nswTabWin) || 10.0;
        const fairOdds = prob > 0 ? Number((1 / prob).toFixed(2)) : 20.0;
        const valueEdgePct = fairOdds > 0 ? Number((((currentOdds - fairOdds) / fairOdds) * 100).toFixed(1)) : 0;
        const speedPos: SpeedMapLane = r.speedMapPosition || "Midfield";

        return {
          runner: r,
          prob,
          probPct: Number((prob * 100).toFixed(1)),
          currentOdds,
          fairOdds,
          valueEdgePct,
          speedPos,
        };
      })
      .sort((a, b) => b.prob - a.prob);

    const topPick = sortedByProb[0];
    const dangerPick = sortedByProb[1];
    
    // Find highest value edge contender ($3.50 - $16.00 range)
    const valueContender =
      sortedByProb.find(
        (item) => item.runner.tabNumber !== topPick?.runner.tabNumber && item.currentOdds >= 3.8 && item.currentOdds <= 16.0
      ) || sortedByProb[2] || sortedByProb[1];

    // Pace analysis
    const leaderCount = speedData.lanes.Leader.length;
    const onPaceCount = speedData.lanes["On Pace"].length;
    let paceTempo = "Moderate";
    let paceBadgeColor = "text-[#34C759] bg-[#34C759]/10 border-[#34C759]/30";

    if (leaderCount >= 3 || (leaderCount >= 2 && onPaceCount >= 3)) {
      paceTempo = "Fast / Highly Contested";
      paceBadgeColor = "text-[#FF3B30] bg-[#FF3B30]/10 border-[#FF3B30]/30";
    } else if (leaderCount === 1 && onPaceCount <= 2) {
      paceTempo = "Soft / Controlled Lead";
      paceBadgeColor = "text-[#0071E3] bg-[#0071E3]/10 border-[#0071E3]/30";
    } else {
      paceTempo = "Genuine Even Tempo";
      paceBadgeColor = "text-[#FF9500] bg-[#FF9500]/10 border-[#FF9500]/30";
    }

    // Leaders summary
    const leadersList = speedData.lanes.Leader;
    const leadersSummary =
      leadersList.length > 0
        ? leadersList.map((l) => `#${l.tabNumber} ${l.horseName} (B${l.barrier})`).join(", ")
        : speedData.lanes["On Pace"][0]
        ? `#${speedData.lanes["On Pace"][0].tabNumber} ${speedData.lanes["On Pace"][0].horseName} (B${speedData.lanes["On Pace"][0].barrier})`
        : "Uncontested lead";

    // Box seat / On pace summary
    const onPaceSummary =
      speedData.lanes["On Pace"].length > 0
        ? speedData.lanes["On Pace"].slice(0, 2).map((l) => `#${l.tabNumber} ${l.horseName}`).join(", ")
        : "Midfield pack";

    // Tactical race script summary
    let tacticalScript = "";
    if (paceTempo.includes("Fast")) {
      tacticalScript = `Hot early pace expected with ${leadersSummary} contesting the front rail over ${race.distance}m on ${trackCondition}. Strong pressure favors stalkers and mid-race swoopers.`;
    } else if (paceTempo.includes("Soft")) {
      tacticalScript = `Tactical race with ${leadersSummary} likely to dictate a slow sectional. Front-runners will have a distinct tactical advantage off the home bend.`;
    } else {
      tacticalScript = `True, even tempo projected. ${leadersSummary} will lead into the turn with ${onPaceSummary} poised in the box seat. Best horse under weight and barrier conditions should prevail.`;
    }

    return {
      speedData,
      sortedByProb,
      topPick,
      dangerPick,
      valueContender,
      paceTempo,
      paceBadgeColor,
      leadersSummary,
      onPaceSummary,
      tacticalScript,
    };
  }, [race, trackCondition]);

  if (!intelligence) return null;

  const {
    speedData,
    sortedByProb,
    topPick,
    dangerPick,
    valueContender,
    paceTempo,
    paceBadgeColor,
    leadersSummary,
    tacticalScript,
  } = intelligence;

  // Visual Theme Palettes
  const containerClass = isApple
    ? "bg-[#FAF9FA] border-[#E5E5EA] text-[#1D1D1F]"
    : isObsidian
    ? "bg-[#0D1522] border-[#1E293B] text-[#F1F5F9]"
    : "bg-[#0A130F] border-[#1A2A20] text-[#E8EFEA]";

  const subCardClass = isApple
    ? "bg-white border-[#E5E5EA] shadow-xs"
    : isObsidian
    ? "bg-[#111C2E] border-[#1E293B]"
    : "bg-[#101C15] border-[#1E3025]";

  const labelClass = isApple
    ? "text-[#86868B]"
    : isObsidian
    ? "text-[#94A3B8]"
    : "text-[#8A9990]";

  const primaryText = isApple
    ? "text-[#1D1D1F]"
    : isObsidian
    ? "text-[#F1F5F9]"
    : "text-[#F3F4F0]";

  const accentColor = isApple
    ? "text-[#0071E3]"
    : isObsidian
    ? "text-[#38BDF8]"
    : "text-[#D4AF37]";

  return (
    <div
      className={`rounded-xl border transition-all text-xs overflow-hidden ${containerClass} ${className}`}
    >
      {/* ====================================================================
          CONCISE SHORT OVERVIEW STRIP (Always Visible under Race Header)
         ==================================================================== */}
      <div className="p-3 sm:p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left 3 Pillars: Speed Map, Probability, Predictions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 flex-1 min-w-0">
          {/* Pillar 1: Speed Map & Pace */}
          <div className="flex items-start gap-2 min-w-0">
            <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
              isApple
                ? "bg-[#0071E3]/10 text-[#0071E3]"
                : isObsidian
                ? "bg-[#38BDF8]/15 text-[#38BDF8]"
                : "bg-[#D4AF37]/15 text-[#D4AF37]"
            }`}>
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`font-mono text-[10px] uppercase font-bold tracking-wider ${labelClass}`}>
                  Speed Map
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold border ${paceBadgeColor}`}>
                  {paceTempo}
                </span>
              </div>
              <p className={`text-xs font-medium truncate mt-0.5 ${primaryText}`} title={`Pace: ${leadersSummary}`}>
                <span className={labelClass}>Lead:</span> {leadersSummary}
              </p>
            </div>
          </div>

          {/* Pillar 2: Win Probabilities (Top 3) */}
          <div className="flex items-start gap-2 min-w-0">
            <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
              isApple
                ? "bg-[#34C759]/10 text-[#34C759]"
                : isObsidian
                ? "bg-[#10B981]/15 text-[#10B981]"
                : "bg-[#10B981]/15 text-[#10B981]"
            }`}>
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className={`font-mono text-[10px] uppercase font-bold tracking-wider block ${labelClass}`}>
                Win Probability
              </span>
              <p className={`text-xs font-mono font-medium truncate mt-0.5 ${primaryText}`}>
                {sortedByProb.slice(0, 3).map((item, idx) => (
                  <span key={item.runner.tabNumber} className="mr-2">
                    <strong className={idx === 0 ? accentColor : ""}>
                      #{item.runner.tabNumber}
                    </strong>{" "}
                    ({item.probPct}%)
                  </span>
                ))}
              </p>
            </div>
          </div>

          {/* Pillar 3: Tactical Predictions */}
          <div className="flex items-start gap-2 min-w-0">
            <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
              isApple
                ? "bg-[#FF9500]/10 text-[#FF9500]"
                : isObsidian
                ? "bg-[#F59E0B]/15 text-[#F59E0B]"
                : "bg-[#EAB308]/15 text-[#EAB308]"
            }`}>
              <Target className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className={`font-mono text-[10px] uppercase font-bold tracking-wider block ${labelClass}`}>
                Predictions
              </span>
              <p className={`text-xs font-medium truncate mt-0.5 ${primaryText}`}>
                <strong className={accentColor}>Top:</strong> #{topPick.runner.tabNumber} {topPick.runner.horseName}
                {dangerPick && (
                  <>
                    <span className={`mx-1.5 ${labelClass}`}>·</span>
                    <span className={labelClass}>Danger:</span> #{dangerPick.runner.tabNumber}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Right Toggle Button: Expand / Collapse Detailed Analysis */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center border-t md:border-t-0 pt-2 md:pt-0 w-full md:w-auto justify-between md:justify-end">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-mono border transition-all cursor-pointer active:scale-95 ${
              isExpanded
                ? isApple
                  ? "bg-[#0071E3] text-white border-[#0071E3] shadow-xs"
                  : isObsidian
                  ? "bg-[#38BDF8] text-[#070D18] border-[#38BDF8] shadow-xs font-bold"
                  : "bg-[#D4AF37] text-[#070B09] border-[#D4AF37] font-bold"
                : isApple
                ? "bg-white border-[#E5E5EA] text-[#0071E3] hover:bg-[#F2F2F7] shadow-xs"
                : isObsidian
                ? "bg-[#111C2E] border-[#1E293B] text-[#38BDF8] hover:border-[#38BDF8]/50"
                : "bg-[#132019] border-[#1F2E26] text-[#D4AF37] hover:border-[#D4AF37]/50"
            }`}
            title={isExpanded ? "Collapse detailed analysis" : "Expand detailed speed map, probability bars, and tactical script"}
          >
            <span>{isExpanded ? "Collapse Analysis" : "Expand Analysis"}</span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* ====================================================================
          EXPANDABLE DETAILED BREAKDOWN & IN-DEPTH ANALYSIS
         ==================================================================== */}
      {isExpanded && (
        <div className={`p-4 sm:p-5 border-t space-y-4 animate-fadeIn ${
          isApple
            ? "border-[#E5E5EA] bg-white/70"
            : isObsidian
            ? "border-[#1E293B] bg-[#0A101D]/70"
            : "border-[#1A2A20] bg-[#070E0A]/70"
        }`}>
          {/* Tactical Script Advisory Banner */}
          <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${subCardClass}`}>
            <Info className={`w-4 h-4 mt-0.5 shrink-0 ${accentColor}`} />
            <div className="space-y-1">
              <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${labelClass}`}>
                Tactical Race Analysis &amp; Speed Map Dynamics
              </span>
              <p className={`text-xs leading-relaxed ${primaryText}`}>
                {tacticalScript}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono text-[#86868B]">
                <span>Track: <strong className={primaryText}>{trackCondition}</strong></span>
                <span>•</span>
                <span>Rail: <strong className={primaryText}>{railPosition}</strong></span>
                <span>•</span>
                <span>Distance: <strong className={primaryText}>{race.distance}m</strong></span>
                <span>•</span>
                <span>Venue: <strong className={primaryText}>{meetingVenue || "NSW TAB"}</strong></span>
              </div>
            </div>
          </div>

          {/* Grid Layout: Visual Speed Map Lanes (Left) + Win Probability Bars (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Visual Speed Map: 4 Position Lanes */}
            <div className={`p-4 rounded-xl border space-y-3 ${subCardClass}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider">
                  <Zap className={`w-3.5 h-3.5 ${accentColor}`} />
                  <span className={primaryText}>Settling Speed Map</span>
                </div>
                <span className={`text-[10px] font-mono ${labelClass}`}>
                  Railside → Back of Field
                </span>
              </div>

              {/* 4 Lanes: Leaders, On Pace, Midfield, Backmarkers */}
              <div className="space-y-2">
                {(["Leader", "On Pace", "Midfield", "Backmarker"] as SpeedMapLane[]).map((lane) => {
                  const laneRunners = speedData.lanes[lane] || [];
                  const laneBadgeColor =
                    lane === "Leader"
                      ? "text-[#FF9500] border-[#FF9500]/30 bg-[#FF9500]/10"
                      : lane === "On Pace"
                      ? "text-[#34C759] border-[#34C759]/30 bg-[#34C759]/10"
                      : lane === "Midfield"
                      ? "text-[#0071E3] border-[#0071E3]/30 bg-[#0071E3]/10"
                      : "text-slate-400 border-slate-400/30 bg-slate-400/10";

                  return (
                    <div
                      key={lane}
                      className={`p-2.5 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        isApple
                          ? "bg-[#F9F9FB] border-[#E5E5EA]"
                          : isObsidian
                          ? "bg-[#0B1320] border-[#1E293B]"
                          : "bg-[#0C1611] border-[#1A2820]"
                      }`}
                    >
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${laneBadgeColor}`}>
                          {lane}
                        </span>
                        <span className={`text-[11px] font-mono ${labelClass}`}>
                          ({laneRunners.length})
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-start sm:justify-end">
                        {laneRunners.length === 0 ? (
                          <span className={`text-[11px] font-mono italic ${labelClass}`}>None settled here</span>
                        ) : (
                          laneRunners.map((r) => (
                            <span
                              key={r.tabNumber}
                              title={`${r.horseName} (Barrier ${r.barrier}) · $${r.currentOdds.toFixed(2)}`}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold border ${
                                isApple
                                  ? "bg-white border-[#E5E5EA] text-[#1D1D1F]"
                                  : isObsidian
                                  ? "bg-[#132034] border-[#1E293B] text-[#F1F5F9]"
                                  : "bg-[#14221A] border-[#1F3025] text-[#F3F4F0]"
                              }`}
                            >
                              <strong className={lane === "Leader" ? "text-[#FF9500]" : ""}>
                                #{r.tabNumber}
                              </strong>
                              <span className="truncate max-w-[100px]">{r.horseName}</span>
                              <span className={`text-[10px] ${labelClass}`}>B{r.barrier}</span>
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Win Probability Distribution Bars */}
            <div className={`p-4 rounded-xl border space-y-3 ${subCardClass}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider">
                  <TrendingUp className={`w-3.5 h-3.5 ${accentColor}`} />
                  <span className={primaryText}>Win Likelihood &amp; Fair Value</span>
                </div>
                <span className={`text-[10px] font-mono ${labelClass}`}>
                  Algo Model Probability
                </span>
              </div>

              {/* Horizontal probability bars for top contenders */}
              <div className="space-y-2">
                {sortedByProb.slice(0, 5).map((item, idx) => {
                  const isTop = idx === 0;
                  const barColor = isTop
                    ? isApple
                      ? "bg-[#0071E3]"
                      : isObsidian
                      ? "bg-[#38BDF8]"
                      : "bg-[#D4AF37]"
                    : isApple
                    ? "bg-[#34C759]"
                    : isObsidian
                    ? "bg-[#10B981]"
                    : "bg-[#10B981]";

                  return (
                    <div key={item.runner.tabNumber} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] ${
                            isTop
                              ? isApple ? "bg-[#0071E3] text-white" : "bg-[#D4AF37] text-black"
                              : "bg-black/10 dark:bg-white/10"
                          }`}>
                            {item.runner.tabNumber}
                          </span>
                          <span className={`font-semibold truncate max-w-[120px] sm:max-w-[150px] ${primaryText}`}>
                            {item.runner.horseName}
                          </span>
                          <span className={`text-[10px] ${labelClass}`}>
                            (${item.currentOdds.toFixed(2)})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.valueEdgePct > 5 && (
                            <span className="text-[10px] font-bold text-[#34C759]">
                              +{item.valueEdgePct}% Value
                            </span>
                          )}
                          <span className={`font-bold ${isTop ? accentColor : primaryText}`}>
                            {item.probPct}%
                          </span>
                        </div>
                      </div>

                      {/* Bar Track */}
                      <div className={`h-2 rounded-full overflow-hidden ${
                        isApple ? "bg-[#E5E5EA]" : "bg-black/30"
                      }`}>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${Math.min(100, item.probPct * 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Quick-Tip Shortcut Buttons (if onAssignPreference provided) */}
              {onAssignPreference && (
                <div className={`pt-2 border-t flex flex-wrap items-center justify-between gap-2 ${
                  isApple ? "border-[#E5E5EA]" : "border-white/10"
                }`}>
                  <span className={`text-[10px] font-mono ${labelClass}`}>
                    Quick Tipping Shortcuts:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onAssignPreference(1, topPick.runner.tabNumber)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border transition cursor-pointer active:scale-95 ${
                        isApple
                          ? "bg-[#0071E3]/10 border-[#0071E3]/30 text-[#0071E3] hover:bg-[#0071E3]/20"
                          : "bg-[#D4AF37]/15 border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/25"
                      }`}
                      title={`Assign #${topPick.runner.tabNumber} as 1st Preference`}
                    >
                      Tip Top Pick #{topPick.runner.tabNumber} (1st)
                    </button>
                    {valueContender && (
                      <button
                        type="button"
                        onClick={() => onAssignPreference(2, valueContender.runner.tabNumber)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer active:scale-95"
                        title={`Assign #${valueContender.runner.tabNumber} as 2nd Preference (Value)`}
                      >
                        Tip Value #{valueContender.runner.tabNumber} (2nd)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
