import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import {
  Activity,
  BarChart3,
  Layers,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import type { PunterProfile, RaceMeeting } from "../types/racing";
import {
  SavedRaceReport,
  computeRaceEachWayParUnits,
} from "../utils/raceReportArchive";
import {
  DEFAULT_QUADDIE_BUY_IN_PER_USER,
  evaluateCombinedQuaddieForMeeting,
  evaluateCombinedTrifectaForRace,
  evaluateRaceTrio,
  formatDollarReturn,
  getPunterJokerForMeeting,
  getPunterSelectionsForMeeting,
} from "../utils/scoring";

interface SyndicateSuccessTrendD3ChartProps {
  meetings: RaceMeeting[];
  selectedMeetingIds: string[];
  activeReport?: SavedRaceReport | null;
  punters: PunterProfile[];
  trifectaBetAmount: number;
  quaddieBuyInPerUser?: number;
  quaddieExtraByMeeting?: Record<string, Record<number, number[]>>;
}

interface D3RaceTrendNode {
  index: number;
  raceKey: string;
  axisLabel: string;
  meetingId: string;
  venue: string;
  raceNumber: number;
  raceName: string;
  distance: number;
  fieldSize: number;
  isNtdRace: boolean;
  isQuaddieLeg: boolean;
  isResulted: boolean;
  // Success Rate Metrics
  raceSuccessRatePct: number; // % of user picks or combined podium slots hit in this race
  cumulativeSuccessRatePct: number; // Running Syndicate Podium Success Rate % across all races so far
  podiumHitCount: number; // 0, 1, 2, or 3 of official podium in combined pool
  // Return Rate & $1 Each-Way Par Metrics
  raceEachWayParUnits: number; // Combined Par units across participating users in this race (e.g. 6u/user standard, 5u/user NTD)
  raceEachWayReturnDollars: number; // Combined $1 Each-Way return in this race
  raceReturnRatePct: number; // (raceEachWayReturnDollars / raceEachWayParUnits) * 100
  cumulativeEachWayParUnits: number;
  cumulativeEachWayReturnDollars: number;
  cumulativeReturnRatePct: number; // (cumulativeEachWayReturnDollars / cumulativeEachWayParUnits) * 100
  cumulativeWeightedDollarReturn: number;
  // Trifecta & Quaddie Telemetry
  combinedRunnersCount: number;
  boxedCombinationsCount: number;
  trifectaFlexiPct: number;
  isTrifectaHit: boolean;
  trifectaFlexiPayout: number;
}

export const SyndicateSuccessTrendD3Chart: React.FC<
  SyndicateSuccessTrendD3ChartProps
> = ({
  meetings,
  selectedMeetingIds,
  activeReport = null,
  punters,
  trifectaBetAmount,
  quaddieBuyInPerUser = DEFAULT_QUADDIE_BUY_IN_PER_USER,
  quaddieExtraByMeeting = {},
}) => {
  const [scopeMode, setScopeMode] = useState<"selected_meetings" | "active_card">(
    selectedMeetingIds.length > 1 || !activeReport
      ? "selected_meetings"
      : "active_card"
  );
  const [rateViewMode, setRateViewMode] = useState<"cumulative" | "per_race">(
    "cumulative"
  );
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const targetMeetings = useMemo(() => {
    const activeM =
      (activeReport
        ? meetings.find((m) => m.id === activeReport.meetingId)
        : undefined) ||
      meetings.find((m) => selectedMeetingIds.includes(m.id)) ||
      meetings[0];

    if (scopeMode === "active_card" && activeM) {
      return [activeM];
    }

    const selectedList = meetings.filter((m) =>
      selectedMeetingIds.includes(m.id)
    );
    if (selectedList.length > 0) return selectedList;
    return activeM ? [activeM] : [];
  }, [meetings, selectedMeetingIds, activeReport, scopeMode]);

  const { nodes, quaddieEvaluations } = useMemo(() => {
    const outNodes: D3RaceTrendNode[] = [];
    const qEvals = targetMeetings.map((m) => ({
      meeting: m,
      eval: evaluateCombinedQuaddieForMeeting(
        m,
        punters,
        quaddieExtraByMeeting[m.id] || {},
        quaddieBuyInPerUser
      ),
    }));

    let runningTotalPicks = 0;
    let runningTotalPodiumHits = 0;
    let runningEachWayParUnits = 0;
    let runningEachWayReturnDollars = 0;
    let runningWeightedDollars = 0;
    let globalIdx = 0;

    const multiCard = targetMeetings.length > 1;

    for (const m of targetMeetings) {
      const qObj = qEvals.find((q) => q.meeting.id === m.id)?.eval;
      const quaddieRaceSet = new Set(
        qObj?.declaredQuaddieVerification.declaredRaceNumbers || []
      );
      const venueShort = m.venue
        .replace(/Gardens|Racecourse|Park/gi, "")
        .trim()
        .slice(0, 4)
        .toUpperCase();

      const sortedRaces = [...(m.races || [])].sort(
        (a, b) => a.raceNumber - b.raceNumber
      );

      for (const race of sortedRaces) {
        const tri = evaluateCombinedTrifectaForRace(
          race,
          punters,
          m.id,
          m.date,
          trifectaBetAmount,
          m.venue
        );

        const fieldSize = (race.runners || []).length;
        const baseParInfo = computeRaceEachWayParUnits(fieldSize, 3);

        let racePicksCount = 0;
        let racePodiumsCount = 0;
        let raceEachWayParUnits = 0;
        let raceEachWayReturnDollars = 0;
        let raceWeightedDollars = 0;

        for (const punter of punters) {
          const mSel = getPunterSelectionsForMeeting(punter, m);
          const jokerRaceNo = getPunterJokerForMeeting(punter, m);
          const isJoker = jokerRaceNo === race.raceNumber;
          const ev = evaluateRaceTrio(
            race,
            mSel[race.raceNumber],
            m.date,
            isJoker
          );

          const validPicks = ev.picks.filter((p) => p.tabNumber !== null);
          const count = validPicks.length;
          if (count > 0) {
            racePicksCount += count;
            const uPar = computeRaceEachWayParUnits(fieldSize, count);
            raceEachWayParUnits += uPar.parUnits;
            raceWeightedDollars += ev.raceDollarReturn;

            for (const p of validPicks) {
              const wOdds =
                Number(p.runner?.nswTabWin || p.runner?.fixedWin) || 0;
              const pOdds =
                Number(p.runner?.nswTabPlace || p.runner?.fixedPlace) ||
                (wOdds > 1 ? Number((1 + (wOdds - 1) / 3.5).toFixed(2)) : 0);

              if (p.finishPosition === 1) {
                racePodiumsCount += 1;
                raceEachWayReturnDollars +=
                  wOdds + (fieldSize >= 5 ? pOdds : 0);
              } else if (p.finishPosition === 2) {
                racePodiumsCount += 1;
                raceEachWayReturnDollars += fieldSize >= 5 ? pOdds : 0;
              } else if (p.finishPosition === 3) {
                racePodiumsCount += 1;
                // NTD rule: 3rd place pays $0.00 when fieldSize <= 7
                raceEachWayReturnDollars += fieldSize >= 8 ? pOdds : 0;
              }
            }
          }
        }

        // If no user picks were saved on this race yet, use the standard 3-horse per user benchmark
        if (raceEachWayParUnits === 0) {
          raceEachWayParUnits =
            baseParInfo.parUnits * Math.max(1, punters.length);
        }

        runningTotalPicks += Math.max(3, racePicksCount);
        runningTotalPodiumHits +=
          racePicksCount > 0 ? racePodiumsCount : tri.podiumHitFlags.hitCount;
        runningEachWayParUnits += raceEachWayParUnits;
        runningEachWayReturnDollars = Number(
          (runningEachWayReturnDollars + raceEachWayReturnDollars).toFixed(2)
        );
        runningWeightedDollars = Number(
          (runningWeightedDollars + raceWeightedDollars).toFixed(2)
        );

        const raceSuccessRatePct = tri.isRaceResulted
          ? Math.round((tri.podiumHitFlags.hitCount / 3) * 100)
          : Math.round(Math.min(100, tri.boxedWinProbabilityPct * 2.2));

        const cumulativeSuccessRatePct =
          runningTotalPicks > 0
            ? Math.min(
                100,
                Math.round(
                  (runningTotalPodiumHits / Math.max(1, (globalIdx + 1) * 3)) *
                    100
                )
              )
            : raceSuccessRatePct;

        const raceReturnRatePct =
          raceEachWayParUnits > 0
            ? Math.round(
                (raceEachWayReturnDollars / raceEachWayParUnits) * 100
              )
            : 0;

        const cumulativeReturnRatePct =
          runningEachWayParUnits > 0
            ? Math.round(
                (runningEachWayReturnDollars / runningEachWayParUnits) * 100
              )
            : 0;

        outNodes.push({
          index: globalIdx,
          raceKey: `${m.id}::R${race.raceNumber}`,
          axisLabel: multiCard
            ? `${venueShort} R${race.raceNumber}`
            : `R${race.raceNumber}`,
          meetingId: m.id,
          venue: m.venue,
          raceNumber: race.raceNumber,
          raceName: race.raceName,
          distance: race.distance,
          fieldSize,
          isNtdRace: baseParInfo.isNtd,
          isQuaddieLeg: quaddieRaceSet.has(race.raceNumber),
          isResulted: tri.isRaceResulted,
          raceSuccessRatePct,
          cumulativeSuccessRatePct,
          podiumHitCount: tri.podiumHitFlags.hitCount,
          raceEachWayParUnits,
          raceEachWayReturnDollars: Number(
            raceEachWayReturnDollars.toFixed(2)
          ),
          raceReturnRatePct,
          cumulativeEachWayParUnits: runningEachWayParUnits,
          cumulativeEachWayReturnDollars: runningEachWayReturnDollars,
          cumulativeReturnRatePct,
          cumulativeWeightedDollarReturn: runningWeightedDollars,
          combinedRunnersCount: tri.combinedRunners.length,
          boxedCombinationsCount: tri.boxedCombinationsCount,
          trifectaFlexiPct: tri.flexiPercentage,
          isTrifectaHit: tri.isCombinedBoxedTrifectaHit,
          trifectaFlexiPayout: tri.isRaceResulted
            ? tri.customBetFlexiReturn
            : tri.estimatedPayoutOnBetAmount,
        });

        globalIdx += 1;
      }
    }

    return { nodes: outNodes, quaddieEvaluations: qEvals };
  }, [
    targetMeetings,
    punters,
    trifectaBetAmount,
    quaddieBuyInPerUser,
    quaddieExtraByMeeting,
  ]);

  if (nodes.length === 0) return null;

  // D3 Scales & Path Generators
  const svgWidth = Math.max(860, nodes.length * 64);
  const svgHeight = 255;
  const margin = { top: 28, right: 56, bottom: 48, left: 52 };
  const innerW = svgWidth - margin.left - margin.right;
  const innerH = svgHeight - margin.top - margin.bottom;

  const xScale = d3
    .scalePoint<number>()
    .domain(nodes.map((n) => n.index))
    .range([margin.left, margin.left + innerW])
    .padding(0.2);

  const ySuccessScale = d3
    .scaleLinear()
    .domain([0, 100])
    .range([margin.top + innerH, margin.top]);

  const maxReturnRate = Math.max(
    150,
    d3.max(nodes, (n) =>
      rateViewMode === "cumulative"
        ? n.cumulativeReturnRatePct
        : n.raceReturnRatePct
    ) || 150
  );

  const yReturnRateScale = d3
    .scaleLinear()
    .domain([0, maxReturnRate])
    .nice()
    .range([margin.top + innerH, margin.top]);

  const getSuccessVal = (n: D3RaceTrendNode) =>
    rateViewMode === "cumulative"
      ? n.cumulativeSuccessRatePct
      : n.raceSuccessRatePct;

  const getReturnRateVal = (n: D3RaceTrendNode) =>
    rateViewMode === "cumulative"
      ? n.cumulativeReturnRatePct
      : n.raceReturnRatePct;

  const returnAreaGenerator = d3
    .area<D3RaceTrendNode>()
    .x((d) => xScale(d.index) ?? margin.left)
    .y0(margin.top + innerH)
    .y1((d) => yReturnRateScale(getReturnRateVal(d)))
    .curve(d3.curveMonotoneX);

  const returnLineGenerator = d3
    .line<D3RaceTrendNode>()
    .x((d) => xScale(d.index) ?? margin.left)
    .y((d) => yReturnRateScale(getReturnRateVal(d)))
    .curve(d3.curveMonotoneX);

  const successLineGenerator = d3
    .line<D3RaceTrendNode>()
    .x((d) => xScale(d.index) ?? margin.left)
    .y((d) => ySuccessScale(getSuccessVal(d)))
    .curve(d3.curveMonotoneX);

  const returnAreaPath = returnAreaGenerator(nodes) || "";
  const returnLinePath = returnLineGenerator(nodes) || "";
  const successLinePath = successLineGenerator(nodes) || "";

  const par100Y = yReturnRateScale(100);
  const activeNode =
    (hoveredIdx !== null ? nodes[hoveredIdx] : null) ||
    nodes[nodes.length - 1];
  const lastNode = nodes[nodes.length - 1];

  return (
    <div className="p-4 rounded-xl bg-[#0B110E] border border-[#1F2D26] space-y-3">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 border-b border-[#1F2D26] pb-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#10B981]" />
            <span className="text-xs font-mono uppercase tracking-wider text-[#10B981] font-bold">
              Performance Trend Graph · Syndicate Success Rate (%) &amp; $1
              Each-Way Return Rate (%) Across{" "}
              {targetMeetings.length === 1
                ? `${targetMeetings[0].venue} (${nodes.length} Races)`
                : `${targetMeetings.length} Selected Meetings (${nodes.length} Races)`}
            </span>
          </div>
          <p className="text-[11px] text-[#8A9990]">
            Visualizes <strong className="text-[#D4AF37]">Syndicate Success Rate (%)</strong>{" "}
            against <strong className="text-[#10B981]">Return Rate (% of $1 Each-Way Par)</strong>{" "}
            where Par = 6u/race on standard 8+ runner races (60u for 10 races) and
            5u/race on NTD (≤7 runner) races.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeReport && selectedMeetingIds.length > 1 && (
            <div className="flex items-center gap-1 bg-[#121A16] p-0.5 rounded-md border border-[#1F2D26] text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setScopeMode("selected_meetings")}
                className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  scopeMode === "selected_meetings"
                    ? "bg-[#10B981] text-[#0B110E] font-bold"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                All {selectedMeetingIds.length} Selected Cards
              </button>
              <button
                type="button"
                onClick={() => setScopeMode("active_card")}
                className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  scopeMode === "active_card"
                    ? "bg-[#D4AF37] text-[#0B110E] font-bold"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                {activeReport.venue} Only
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 bg-[#121A16] p-0.5 rounded-md border border-[#1F2D26] text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setRateViewMode("cumulative")}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                rateViewMode === "cumulative"
                  ? "bg-[#10B981] text-[#0B110E] font-bold"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              Cumulative Trend
            </button>
            <button
              type="button"
              onClick={() => setRateViewMode("per_race")}
              className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                rateViewMode === "per_race"
                  ? "bg-[#D4AF37] text-[#0B110E] font-bold"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              Race-by-Race Rate
            </button>
          </div>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[#D4AF37] font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
            Syndicate Success Rate (%) [Left Axis]
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#10B981] font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
            $1 Each-Way Return Rate (% of Par) [Right Axis]
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#F59E0B]">
            <span className="w-3 h-0.5 bg-[#F59E0B]" />
            100% Par Benchmark Line
          </span>
          <span className="inline-flex items-center gap-1.5 text-[#38BDF8]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#38BDF8]/25 border border-[#38BDF8]" />
            Declared Quaddie Legs
          </span>
        </div>

        <div className="text-[#D5DDD8]">
          Overall Success:{" "}
          <strong className="text-[#D4AF37]">
            {lastNode.cumulativeSuccessRatePct}%
          </strong>{" "}
          · Overall Return Rate:{" "}
          <strong className="text-[#10B981]">
            {lastNode.cumulativeReturnRatePct}% of Par
          </strong>{" "}
          ({formatDollarReturn(lastNode.cumulativeEachWayReturnDollars)} /{" "}
          {lastNode.cumulativeEachWayParUnits}u Par)
        </div>
      </div>

      {/* D3 SVG Chart Canvas */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto min-w-[680px] select-none"
          role="img"
          aria-label="Syndicate Success Rate and Return Rate Performance Trend Graph"
        >
          <defs>
            <linearGradient
              id="d3SyndicateReturnGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid Lines (Left = Success Rate 0-100%, Right = Return Rate %) */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = ySuccessScale(pct);
            const rightRateVal = Math.round(
              yReturnRateScale.invert(y)
            );
            return (
              <g key={pct}>
                <line
                  x1={margin.left}
                  y1={y}
                  x2={svgWidth - margin.right}
                  y2={y}
                  stroke="#1F2D26"
                  strokeDasharray={pct === 0 ? undefined : "3 3"}
                  strokeWidth={1}
                />
                <text
                  x={margin.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-[#D4AF37] font-mono text-[9.5px]"
                >
                  {pct}%
                </text>
                <text
                  x={svgWidth - margin.right + 8}
                  y={y + 3}
                  textAnchor="start"
                  className="fill-[#10B981] font-mono text-[9.5px]"
                >
                  {rightRateVal}%
                </text>
              </g>
            );
          })}

          {/* 100% Par Benchmark Line on Right Axis */}
          {par100Y >= margin.top && par100Y <= margin.top + innerH && (
            <g>
              <line
                x1={margin.left}
                y1={par100Y}
                x2={svgWidth - margin.right}
                y2={par100Y}
                stroke="#F59E0B"
                strokeWidth={1.3}
                strokeDasharray="6 4"
                strokeOpacity={0.8}
              />
              <text
                x={margin.left + 6}
                y={par100Y - 4}
                className="fill-[#F59E0B] font-mono text-[8.5px] font-bold"
              >
                100% PAR BENCHMARK ($1 EW Break-Even)
              </text>
            </g>
          )}

          {/* Highlight Declared Quaddie Legs per Meeting */}
          {targetMeetings.map((m) => {
            const qIndices = nodes
              .filter((n) => n.meetingId === m.id && n.isQuaddieLeg)
              .map((n) => n.index);
            if (qIndices.length === 0) return null;
            const firstX =
              (xScale(qIndices[0]) ?? margin.left) - 18;
            const lastX =
              (xScale(qIndices[qIndices.length - 1]) ?? margin.left) + 18;
            return (
              <g key={`qzone-${m.id}`}>
                <rect
                  x={Math.max(margin.left, firstX)}
                  y={margin.top}
                  width={Math.max(16, lastX - firstX)}
                  height={innerH}
                  rx={5}
                  fill="#0EA5E9"
                  fillOpacity={0.07}
                  stroke="#0EA5E9"
                  strokeOpacity={0.35}
                  strokeDasharray="4 3"
                />
                <text
                  x={(firstX + lastX) / 2}
                  y={margin.top + 11}
                  textAnchor="middle"
                  className="fill-[#38BDF8] font-mono text-[8.5px] font-bold"
                >
                  {m.venue.split(" ")[0].toUpperCase()} QUADDIE
                </text>
              </g>
            );
          })}

          {/* D3 Return Rate Area & Smooth Monotone Curve */}
          <path d={returnAreaPath} fill="url(#d3SyndicateReturnGradient)" />
          <path
            d={returnLinePath}
            fill="none"
            stroke="#10B981"
            strokeWidth={2.5}
          />

          {/* D3 Syndicate Success Rate Smooth Monotone Curve */}
          <path
            d={successLinePath}
            fill="none"
            stroke="#D4AF37"
            strokeWidth={2.2}
            strokeDasharray="5 2.5"
          />

          {/* Interactive Race Data Points */}
          {nodes.map((node) => {
            const cx = xScale(node.index) ?? margin.left;
            const cySuccess = ySuccessScale(getSuccessVal(node));
            const cyReturn = yReturnRateScale(getReturnRateVal(node));
            const isHovered = activeNode.index === node.index;

            return (
              <g
                key={node.raceKey}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIdx(node.index)}
              >
                {isHovered && (
                  <line
                    x1={cx}
                    y1={margin.top}
                    x2={cx}
                    y2={margin.top + innerH}
                    stroke="#D4AF37"
                    strokeOpacity={0.55}
                    strokeWidth={1.2}
                  />
                )}

                {/* Return Rate Node */}
                <circle
                  cx={cx}
                  cy={cyReturn}
                  r={isHovered ? 5.5 : 4}
                  fill={getReturnRateVal(node) >= 100 ? "#10B981" : "#059669"}
                  stroke="#0B110E"
                  strokeWidth={1.5}
                />

                {/* Success Rate Node */}
                <circle
                  cx={cx}
                  cy={cySuccess}
                  r={isHovered ? 5 : 3.5}
                  fill={node.isTrifectaHit ? "#10B981" : "#D4AF37"}
                  stroke="#0B110E"
                  strokeWidth={1.5}
                />

                {/* X-Axis Race Label */}
                <text
                  x={cx}
                  y={margin.top + innerH + 15}
                  textAnchor="middle"
                  className={`font-mono text-[9.5px] font-bold ${
                    node.isQuaddieLeg ? "fill-[#38BDF8]" : "fill-[#F3F4F0]"
                  }`}
                >
                  {node.axisLabel}
                </text>

                {/* Sub-label: Par Units & NTD badge */}
                <text
                  x={cx}
                  y={margin.top + innerH + 27}
                  textAnchor="middle"
                  className={`font-mono text-[8px] ${
                    node.isNtdRace ? "fill-[#F59E0B]" : "fill-[#8A9990]"
                  }`}
                >
                  {node.isNtdRace
                    ? `${node.raceEachWayParUnits}u NTD`
                    : `${node.raceEachWayParUnits}u Par`}
                </text>

                {/* Sub-label 2: Return Rate % */}
                <text
                  x={cx}
                  y={margin.top + innerH + 38}
                  textAnchor="middle"
                  className="fill-[#10B981] font-mono text-[8px]"
                >
                  {getReturnRateVal(node)}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Interactive Race Inspection Bar */}
      {activeNode && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 pt-2 border-t border-[#1F2D26] text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-[#121A16] border border-[#1F2D26] flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] uppercase text-[#8A9990] block">
                {activeNode.venue} · Race {activeNode.raceNumber} (
                {activeNode.fieldSize} Runners
                {activeNode.isNtdRace ? " · NTD" : ""})
              </span>
              <span className="text-[#F3F4F0] font-bold truncate block">
                {activeNode.raceName} ({activeNode.distance}m)
              </span>
            </div>
            {activeNode.isNtdRace && (
              <span className="px-1.5 py-0.5 rounded bg-[#F59E0B]/20 border border-[#F59E0B] text-[#F59E0B] text-[9px] font-bold shrink-0">
                NTD (No 3rd Div)
              </span>
            )}
          </div>

          <div className="p-2.5 rounded-lg bg-[#121A16] border border-[#1F2D26] flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase text-[#8A9990] block">
                Syndicate Success Rate
              </span>
              <span className="text-[#D4AF37] font-bold">
                Race: {activeNode.raceSuccessRatePct}% ({activeNode.podiumHitCount}
                /3) · Cum: {activeNode.cumulativeSuccessRatePct}%
              </span>
            </div>
            <Activity className="w-4 h-4 text-[#D4AF37] shrink-0" />
          </div>

          <div className="p-2.5 rounded-lg bg-[#121A16] border border-[#1F2D26] flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase text-[#8A9990] block">
                $1 Each-Way Return Rate vs Par
              </span>
              <span className="text-[#10B981] font-bold">
                Race: {formatDollarReturn(activeNode.raceEachWayReturnDollars)} /{" "}
                {activeNode.raceEachWayParUnits}u ({activeNode.raceReturnRatePct}
                %) · Cum: {activeNode.cumulativeReturnRatePct}%
              </span>
            </div>
            <BarChart3 className="w-4 h-4 text-[#10B981] shrink-0" />
          </div>

          <div className="p-2.5 rounded-lg bg-[#121A16] border border-[#1F2D26] flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase text-[#8A9990] block">
                All-Users Trifecta &amp; Quaddie
              </span>
              <span className="text-[#F3F4F0] font-bold">
                {activeNode.combinedRunnersCount}H Box ({activeNode.boxedCombinationsCount}
                c @ {activeNode.trifectaFlexiPct}%) ·{" "}
                {activeNode.isTrifectaHit
                  ? `★ HIT ${formatDollarReturn(activeNode.trifectaFlexiPayout)}`
                  : `Est ${formatDollarReturn(activeNode.trifectaFlexiPayout)}`}
              </span>
            </div>
            <Sparkles className="w-4 h-4 text-[#D4AF37] shrink-0" />
          </div>
        </div>
      )}
    </div>
  );
};
