import React, { useMemo, useState } from "react";
import * as d3 from "d3";
import {
  Award,
  BarChart3,
  Layers,
  Percent,
  TrendingUp,
} from "lucide-react";
import type { PunterProfile, RaceMeeting } from "../types/racing";
import type { SavedRaceReport } from "../utils/raceReportArchive";
import {
  computeRaceEachWayParUnits,
  evaluateRaceTrio,
  formatDollarReturn,
  getPunterJokerForMeeting,
  getPunterSelectionsForMeeting,
} from "../utils/scoring";

interface PunterRoiD3BarChartProps {
  meetings: RaceMeeting[];
  selectedMeetingIds: string[];
  activeReport?: SavedRaceReport | null;
  punters: PunterProfile[];
}

export interface PunterRoiBarDatum {
  punterId: string;
  punterName: string;
  role: string;
  meetingsCount: number;
  racesParticipated: number;
  // Selections & Baselines
  totalSelections: number;
  baselineOneUnitOutlay: number; // 1 unit per selection (for Points Score ROI)
  baselineEachWayUnitsOutlay: number; // 1u Win + 1u Place per selection (2u/pick, adjusted for NTD)
  // Total Scores
  totalPointsScore: number;
  totalDollarScore: number;
  totalEachWayReturnScore: number;
  // Hits breakdown
  winnersPicked: number;
  podiumsPicked: number;
  jokerBonusPoints: number;
  // ROI Metrics (Points/Score vs 1-Unit Bet on Every Selection)
  pointsReturnRatioPct: number;
  pointsNetRoiPct: number;
  pointsNetVariance: number;
  pointsPerUnitBet: number;
  // ROI Metrics ($ Score vs 1u Win + 1u Place Each-Way Outlay on Every Selection)
  dollarReturnRatioPct: number;
  dollarNetRoiPct: number;
  dollarNetVariance: number;
  dollarPerUnitBet: number;
  // Per-meeting breakdown
  perMeetingSummary: Array<{
    meetingId: string;
    venue: string;
    selections: number;
    eachWayParUnits: number;
    points: number;
    dollars: number;
    roiRatioPct: number;
    netRoiPct: number;
  }>;
}

export const PunterRoiD3BarChart: React.FC<PunterRoiD3BarChartProps> = ({
  meetings,
  selectedMeetingIds,
  activeReport = null,
  punters,
}) => {
  const [scopeMode, setScopeMode] = useState<
    "selected_meetings" | "active_report"
  >("selected_meetings");
  const [scoreMetric, setScoreMetric] = useState<
    "points_score" | "dollar_score"
  >("dollar_score");
  const [chartDisplayMode, setChartDisplayMode] = useState<
    "roi_and_grouped" | "diverging_net_roi"
  >("roi_and_grouped");
  const [hoveredPunterId, setHoveredPunterId] = useState<string | null>(null);

  // Resolve target race meetings
  const targetMeetings = useMemo(() => {
    if (scopeMode === "active_report" && activeReport) {
      const m = meetings.find((item) => item.id === activeReport.meetingId);
      return m ? [m] : [];
    }
    const selected = meetings.filter((item) =>
      selectedMeetingIds.includes(item.id)
    );
    if (selected.length > 0) return selected;
    if (activeReport) {
      const activeM = meetings.find(
        (item) => item.id === activeReport.meetingId
      );
      if (activeM) return [activeM];
    }
    return meetings.slice(0, 1);
  }, [meetings, selectedMeetingIds, activeReport, scopeMode]);

  // Compute each punter's ROI across the selected race meetings
  const punterRoiData = useMemo<PunterRoiBarDatum[]>(() => {
    const isArchivedOnly =
      Boolean(activeReport) &&
      (scopeMode === "active_report" || targetMeetings.length === 0) &&
      !meetings.some((m) => m.id === activeReport?.meetingId);

    if (isArchivedOnly && activeReport) {
      return activeReport.standings
        .map((s) => {
          const totalSelections = Math.max(
            1,
            s.selectedHorsesCount || s.racesParticipated * 3
          );
          const baselineOneUnitOutlay = Math.max(1, totalSelections);
          const baselineEachWayUnitsOutlay = Math.max(
            1,
            s.parScoreUnits || totalSelections * 2
          );
          const totalPointsScore = s.totalPoints;
          const totalDollarScore = Number(
            (s.eachWayDollarReturn ?? s.totalDollarReturn ?? 0).toFixed(2)
          );

          const pointsReturnRatioPct = Number(
            ((totalPointsScore / baselineOneUnitOutlay) * 100).toFixed(1)
          );
          const pointsNetRoiPct = Number(
            (
              ((totalPointsScore - baselineOneUnitOutlay) /
                baselineOneUnitOutlay) *
              100
            ).toFixed(1)
          );
          const pointsNetVariance = Number(
            (totalPointsScore - baselineOneUnitOutlay).toFixed(2)
          );
          const pointsPerUnitBet = Number(
            (totalPointsScore / baselineOneUnitOutlay).toFixed(2)
          );

          const dollarReturnRatioPct = Number(
            ((totalDollarScore / baselineEachWayUnitsOutlay) * 100).toFixed(1)
          );
          const dollarNetRoiPct = Number(
            (
              ((totalDollarScore - baselineEachWayUnitsOutlay) /
                baselineEachWayUnitsOutlay) *
              100
            ).toFixed(1)
          );
          const dollarNetVariance = Number(
            (totalDollarScore - baselineEachWayUnitsOutlay).toFixed(2)
          );
          const dollarPerUnitBet = Number(
            (totalDollarScore / baselineOneUnitOutlay).toFixed(2)
          );

          return {
            punterId: s.punterId,
            punterName: s.punterName,
            role: s.role,
            meetingsCount: 1,
            racesParticipated: s.racesParticipated,
            totalSelections,
            baselineOneUnitOutlay,
            baselineEachWayUnitsOutlay,
            totalPointsScore,
            totalDollarScore,
            totalEachWayReturnScore: totalDollarScore,
            winnersPicked: s.winnersPicked,
            podiumsPicked: s.podiumsPicked,
            jokerBonusPoints: 0,
            pointsReturnRatioPct,
            pointsNetRoiPct,
            pointsNetVariance,
            pointsPerUnitBet,
            dollarReturnRatioPct,
            dollarNetRoiPct,
            dollarNetVariance,
            dollarPerUnitBet,
            perMeetingSummary: [
              {
                meetingId: activeReport.meetingId,
                venue: activeReport.venue,
                selections: totalSelections,
                eachWayParUnits: baselineEachWayUnitsOutlay,
                points: totalPointsScore,
                dollars: totalDollarScore,
                roiRatioPct:
                  scoreMetric === "points_score"
                    ? pointsReturnRatioPct
                    : dollarReturnRatioPct,
                netRoiPct:
                  scoreMetric === "points_score"
                    ? pointsNetRoiPct
                    : dollarNetRoiPct,
              },
            ],
          };
        })
        .sort((a, b) =>
          scoreMetric === "points_score"
            ? b.pointsReturnRatioPct - a.pointsReturnRatioPct ||
              b.totalPointsScore - a.totalPointsScore
            : b.dollarReturnRatioPct - a.dollarReturnRatioPct ||
              b.totalDollarScore - a.totalDollarScore
        );
    }

    // Aggregate across all selected race meetings for each individual punter
    const rows: PunterRoiBarDatum[] = punters.map((punter) => {
      let racesParticipated = 0;
      let totalSelections = 0;
      let totalEachWayParUnits = 0;
      let totalPointsScore = 0;
      let totalDollarScore = 0;
      let winnersPicked = 0;
      let podiumsPicked = 0;
      let jokerBonusPoints = 0;
      const perMeetingSummary: PunterRoiBarDatum["perMeetingSummary"] = [];

      for (const meeting of targetMeetings) {
        const selectionsByRace = getPunterSelectionsForMeeting(punter, meeting);
        const jokerRaceNum = getPunterJokerForMeeting(punter, meeting);

        let mSelections = 0;
        let mEachWayParUnits = 0;
        let mPoints = 0;
        let mDollars = 0;

        const sortedRaces = [...(meeting.races || [])].sort(
          (a, b) => a.raceNumber - b.raceNumber
        );

        for (const race of sortedRaces) {
          const trio = selectionsByRace[race.raceNumber] || {
            firstPref: null,
            secondPref: null,
            thirdPref: null,
          };

          const evalRes = evaluateRaceTrio(
            race,
            trio,
            meeting.date,
            jokerRaceNum === race.raceNumber
          );

          if (!evalRes.hasAnySelection) continue;

          const validPicks = evalRes.picks.filter((p) => p.tabNumber !== null);
          const selCount = validPicks.length;
          if (selCount === 0) continue;

          racesParticipated += 1;
          mSelections += selCount;
          const parInfo = computeRaceEachWayParUnits(
            (race.runners || []).length,
            selCount
          );
          mEachWayParUnits += parInfo.parUnits;
          mPoints += evalRes.racePointsTally;
          mDollars = Number((mDollars + evalRes.raceDollarReturn).toFixed(2));
          jokerBonusPoints += evalRes.jokerBonusPoints;

          for (const p of validPicks) {
            if (p.finishPosition === 1) {
              winnersPicked += 1;
              podiumsPicked += 1;
            } else if (p.finishPosition === 2 || p.finishPosition === 3) {
              podiumsPicked += 1;
            }
          }
        }

        totalSelections += mSelections;
        totalEachWayParUnits += mEachWayParUnits;
        totalPointsScore += mPoints;
        totalDollarScore = Number((totalDollarScore + mDollars).toFixed(2));

        const mOneUnitBaseline = Math.max(1, mSelections);
        const mEwBaseline = Math.max(1, mEachWayParUnits);
        perMeetingSummary.push({
          meetingId: meeting.id,
          venue: meeting.venue,
          selections: mSelections,
          eachWayParUnits: mEachWayParUnits,
          points: mPoints,
          dollars: Number(mDollars.toFixed(2)),
          roiRatioPct:
            scoreMetric === "points_score"
              ? Number(((mPoints / mOneUnitBaseline) * 100).toFixed(1))
              : Number(((mDollars / mEwBaseline) * 100).toFixed(1)),
          netRoiPct:
            scoreMetric === "points_score"
              ? Number(
                  (
                    ((mPoints - mOneUnitBaseline) / mOneUnitBaseline) *
                    100
                  ).toFixed(1)
                )
              : Number(
                  (((mDollars - mEwBaseline) / mEwBaseline) * 100).toFixed(1)
                ),
        });
      }

      const baselineOneUnitOutlay = Math.max(1, totalSelections);
      const baselineEachWayUnitsOutlay = Math.max(
        1,
        totalEachWayParUnits || totalSelections * 2
      );
      const roundedDollars = Number(totalDollarScore.toFixed(2));

      const pointsReturnRatioPct =
        totalSelections > 0
          ? Number(
              ((totalPointsScore / baselineOneUnitOutlay) * 100).toFixed(1)
            )
          : 0;
      const pointsNetRoiPct =
        totalSelections > 0
          ? Number(
              (
                ((totalPointsScore - baselineOneUnitOutlay) /
                  baselineOneUnitOutlay) *
                100
              ).toFixed(1)
            )
          : 0;
      const pointsNetVariance =
        totalSelections > 0
          ? Number((totalPointsScore - baselineOneUnitOutlay).toFixed(2))
          : 0;
      const pointsPerUnitBet =
        totalSelections > 0
          ? Number((totalPointsScore / baselineOneUnitOutlay).toFixed(2))
          : 0;

      const dollarReturnRatioPct =
        totalSelections > 0
          ? Number(
              ((roundedDollars / baselineEachWayUnitsOutlay) * 100).toFixed(1)
            )
          : 0;
      const dollarNetRoiPct =
        totalSelections > 0
          ? Number(
              (
                ((roundedDollars - baselineEachWayUnitsOutlay) /
                  baselineEachWayUnitsOutlay) *
                100
              ).toFixed(1)
            )
          : 0;
      const dollarNetVariance =
        totalSelections > 0
          ? Number((roundedDollars - baselineEachWayUnitsOutlay).toFixed(2))
          : 0;
      const dollarPerUnitBet =
        totalSelections > 0
          ? Number((roundedDollars / baselineOneUnitOutlay).toFixed(2))
          : 0;

      return {
        punterId: punter.id,
        punterName: punter.name,
        role: punter.role,
        meetingsCount: targetMeetings.length,
        racesParticipated,
        totalSelections,
        baselineOneUnitOutlay: totalSelections > 0 ? baselineOneUnitOutlay : 0,
        baselineEachWayUnitsOutlay:
          totalSelections > 0 ? baselineEachWayUnitsOutlay : 0,
        totalPointsScore,
        totalDollarScore: roundedDollars,
        totalEachWayReturnScore: roundedDollars,
        winnersPicked,
        podiumsPicked,
        jokerBonusPoints,
        pointsReturnRatioPct,
        pointsNetRoiPct,
        pointsNetVariance,
        pointsPerUnitBet,
        dollarReturnRatioPct,
        dollarNetRoiPct,
        dollarNetVariance,
        dollarPerUnitBet,
        perMeetingSummary,
      };
    });

    return rows.sort((a, b) =>
      scoreMetric === "points_score"
        ? b.pointsReturnRatioPct - a.pointsReturnRatioPct ||
          b.totalPointsScore - a.totalPointsScore
        : b.dollarReturnRatioPct - a.dollarReturnRatioPct ||
          b.totalDollarScore - a.totalDollarScore
    );
  }, [
    scopeMode,
    meetings,
    activeReport,
    targetMeetings,
    punters,
    scoreMetric,
  ]);

  // D3 SVG Geometry & Scales
  const svgW = 920;
  const svgH = 320;
  const padL = 62;
  const padR = 58;
  const padT = 28;
  const padB = 56;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const getActiveBaseline = (d: PunterRoiBarDatum) =>
    scoreMetric === "points_score"
      ? d.baselineOneUnitOutlay
      : d.baselineEachWayUnitsOutlay;

  const d3ChartLayout = useMemo(() => {
    const names = punterRoiData.map((d) => d.punterName);

    const xBand = d3
      .scaleBand<string>()
      .domain(names)
      .range([padL, padL + plotW])
      .paddingInner(0.28)
      .paddingOuter(0.16);

    const xSubBand = d3
      .scaleBand<string>()
      .domain(["baseline", "score", "roi"])
      .range([0, xBand.bandwidth()])
      .padding(0.12);

    const maxRoiRatio = Math.max(
      150,
      d3.max(punterRoiData, (d) =>
        scoreMetric === "points_score"
          ? d.pointsReturnRatioPct
          : d.dollarReturnRatioPct
      ) || 150
    );
    const yRoiRatioUpper = Math.ceil((maxRoiRatio + 15) / 25) * 25;
    const yRoiRatioScale = d3
      .scaleLinear()
      .domain([0, yRoiRatioUpper])
      .range([padT + plotH, padT]);

    const maxRawUnits = Math.max(
      40,
      d3.max(punterRoiData, (d) =>
        Math.max(
          scoreMetric === "points_score"
            ? d.baselineOneUnitOutlay
            : d.baselineEachWayUnitsOutlay,
          scoreMetric === "points_score"
            ? d.totalPointsScore
            : d.totalDollarScore
        )
      ) || 40
    );
    const yRawUpper = Math.ceil((maxRawUnits + 5) / 10) * 10;
    const yRawScale = d3
      .scaleLinear()
      .domain([0, yRawUpper])
      .range([padT + plotH, padT]);

    const minNetRoi = Math.min(
      -40,
      d3.min(punterRoiData, (d) =>
        scoreMetric === "points_score" ? d.pointsNetRoiPct : d.dollarNetRoiPct
      ) || -40
    );
    const maxNetRoi = Math.max(
      50,
      d3.max(punterRoiData, (d) =>
        scoreMetric === "points_score" ? d.pointsNetRoiPct : d.dollarNetRoiPct
      ) || 50
    );
    const netLower = Math.floor((minNetRoi - 10) / 20) * 20;
    const netUpper = Math.ceil((maxNetRoi + 15) / 20) * 20;
    const yNetRoiScale = d3
      .scaleLinear()
      .domain([netLower, netUpper])
      .range([padT + plotH, padT]);

    const avgRoiRatioPct = Number(
      (
        d3.mean(punterRoiData, (d) =>
          scoreMetric === "points_score"
            ? d.pointsReturnRatioPct
            : d.dollarReturnRatioPct
        ) || 0
      ).toFixed(1)
    );

    const avgNetRoiPct = Number(
      (
        d3.mean(punterRoiData, (d) =>
          scoreMetric === "points_score" ? d.pointsNetRoiPct : d.dollarNetRoiPct
        ) || 0
      ).toFixed(1)
    );

    return {
      xBand,
      xSubBand,
      yRoiRatioScale,
      yRoiRatioTicks: yRoiRatioScale.ticks(5),
      yRawScale,
      yRawTicks: yRawScale.ticks(5),
      yNetRoiScale,
      yNetRoiTicks: yNetRoiScale.ticks(6),
      avgRoiRatioPct,
      avgNetRoiPct,
    };
  }, [punterRoiData, scoreMetric, padL, padT, plotW, plotH]);

  const activeHoveredDatum =
    hoveredPunterId !== null
      ? punterRoiData.find((d) => d.punterId === hoveredPunterId) ||
        punterRoiData[0]
      : punterRoiData[0];

  const syndicateTotals = useMemo(() => {
    const totalSelections = d3.sum(punterRoiData, (d) => d.totalSelections);
    const totalBaselineUnits = d3.sum(punterRoiData, (d) =>
      scoreMetric === "points_score"
        ? d.baselineOneUnitOutlay
        : d.baselineEachWayUnitsOutlay
    );
    const totalPoints = d3.sum(punterRoiData, (d) => d.totalPointsScore);
    const totalDollars = Number(
      d3.sum(punterRoiData, (d) => d.totalDollarScore).toFixed(2)
    );
    const activeTotalScore =
      scoreMetric === "points_score" ? totalPoints : totalDollars;
    const syndicateReturnRatioPct =
      totalBaselineUnits > 0
        ? Number(((activeTotalScore / totalBaselineUnits) * 100).toFixed(1))
        : 0;
    const syndicateNetRoiPct =
      totalBaselineUnits > 0
        ? Number(
            (
              ((activeTotalScore - totalBaselineUnits) / totalBaselineUnits) *
              100
            ).toFixed(1)
          )
        : 0;
    const profitablePuntersCount = punterRoiData.filter((d) =>
      scoreMetric === "points_score"
        ? d.pointsReturnRatioPct >= 100
        : d.dollarReturnRatioPct >= 100
    ).length;

    return {
      totalSelections,
      totalBaselineUnits,
      totalPoints,
      totalDollars,
      activeTotalScore,
      syndicateReturnRatioPct,
      syndicateNetRoiPct,
      profitablePuntersCount,
    };
  }, [punterRoiData, scoreMetric]);

  return (
    <div className="p-4 rounded-xl bg-[#0B110E] border border-[#D4AF37]/35 space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2D26] pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D4AF37] font-bold">
            <BarChart3 className="w-4 h-4 text-[#10B981]" />
            <span>
              Punter Return on Investment (ROI) Bar Chart — 1u Win + 1u Place
              Per Selection
            </span>
          </div>
          <p className="text-[11px] text-[#8A9990]">
            Visualizes each individual punter&apos;s{" "}
            <strong className="text-[#F3F4F0]">
              Return on Investment (ROI)
            </strong>{" "}
            across{" "}
            {targetMeetings.length > 0
              ? targetMeetings.map((m) => m.venue).join(" + ")
              : activeReport?.venue || "Selected Meetings"}{" "}
            by comparing their{" "}
            <strong className="text-[#D4AF37]">
              {scoreMetric === "points_score"
                ? "Total Points / Score (vs 1u per selection)"
                : "Total $ Return Score (vs 1u Win + 1u Place Each-Way per selection, adjusted for NTD)"}
            </strong>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Score Metric Toggle */}
          <div className="inline-flex items-center rounded-lg bg-[#121A16] p-0.5 border border-[#1F2D26] text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setScoreMetric("dollar_score")}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                scoreMetric === "dollar_score"
                  ? "bg-[#10B981] text-[#0B110E] font-bold"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              $ Return vs 1u Win+Place Par
            </button>
            <button
              type="button"
              onClick={() => setScoreMetric("points_score")}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                scoreMetric === "points_score"
                  ? "bg-[#D4AF37] text-[#0B110E] font-bold"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              Points Score vs 1u Pick
            </button>
          </div>

          {/* Chart Layout Mode Toggle */}
          <div className="inline-flex items-center rounded-lg bg-[#121A16] p-0.5 border border-[#1F2D26] text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setChartDisplayMode("roi_and_grouped")}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                chartDisplayMode === "roi_and_grouped"
                  ? "bg-[#10B981] text-[#0B110E] font-bold"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              ROI % + Score vs Par Bars
            </button>
            <button
              type="button"
              onClick={() => setChartDisplayMode("diverging_net_roi")}
              className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                chartDisplayMode === "diverging_net_roi"
                  ? "bg-[#D4AF37] text-[#0B110E] font-bold"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              Net ROI (+/- %)
            </button>
          </div>

          {/* Meeting Scope Toggle */}
          {activeReport && selectedMeetingIds.length > 1 && (
            <div className="inline-flex items-center rounded-lg bg-[#121A16] p-0.5 border border-[#1F2D26] text-[10px] font-mono">
              <button
                type="button"
                onClick={() => setScopeMode("selected_meetings")}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  scopeMode === "selected_meetings"
                    ? "bg-[#38BDF8] text-[#0B110E] font-bold"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                Selected Meetings ({selectedMeetingIds.length})
              </button>
              <button
                type="button"
                onClick={() => setScopeMode("active_report")}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                  scopeMode === "active_report"
                    ? "bg-[#38BDF8] text-[#0B110E] font-bold"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                Active Card ({activeReport.venue})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Top KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 rounded-lg bg-[#121A16] border border-[#1F2D26]">
          <div className="text-[10px] font-mono uppercase text-[#8A9990] flex items-center gap-1">
            <Award className="w-3 h-3 text-[#D4AF37]" />
            <span>Top ROI Punter</span>
          </div>
          <div className="text-sm font-mono font-bold text-[#D4AF37] mt-0.5 truncate">
            {punterRoiData[0]?.punterName || "—"} (
            {scoreMetric === "points_score"
              ? `${punterRoiData[0]?.pointsReturnRatioPct ?? 0}%`
              : `${punterRoiData[0]?.dollarReturnRatioPct ?? 0}%`}
            )
          </div>
          <div className="text-[10px] font-mono text-[#8A9990]">
            Net ROI:{" "}
            {(scoreMetric === "points_score"
              ? punterRoiData[0]?.pointsNetRoiPct ?? 0
              : punterRoiData[0]?.dollarNetRoiPct ?? 0) >= 0
              ? "+"
              : ""}
            {scoreMetric === "points_score"
              ? punterRoiData[0]?.pointsNetRoiPct ?? 0
              : punterRoiData[0]?.dollarNetRoiPct ?? 0}
            % vs baseline
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-[#121A16] border border-[#1F2D26]">
          <div className="text-[10px] font-mono uppercase text-[#8A9990] flex items-center gap-1">
            <Layers className="w-3 h-3 text-[#38BDF8]" />
            <span>
              {scoreMetric === "points_score"
                ? "1-Unit Pick Baseline"
                : "1u Win + 1u Place Par"}
            </span>
          </div>
          <div className="text-sm font-mono font-bold text-[#F3F4F0] mt-0.5">
            {syndicateTotals.totalBaselineUnits} Units
          </div>
          <div className="text-[10px] font-mono text-[#8A9990]">
            {syndicateTotals.totalSelections} total selections across cards
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-[#121A16] border border-[#1F2D26]">
          <div className="text-[10px] font-mono uppercase text-[#8A9990] flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-[#10B981]" />
            <span>
              Syndicate{" "}
              {scoreMetric === "points_score" ? "Points Score" : "$ Return"}
            </span>
          </div>
          <div className="text-sm font-mono font-bold text-[#10B981] mt-0.5">
            {scoreMetric === "points_score"
              ? `${syndicateTotals.totalPoints} pts`
              : formatDollarReturn(syndicateTotals.totalDollars)}
          </div>
          <div className="text-[10px] font-mono text-[#8A9990]">
            {(
              syndicateTotals.activeTotalScore /
              Math.max(1, syndicateTotals.totalBaselineUnits)
            ).toFixed(2)}{" "}
            return per unit staked
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-[#121A16] border border-[#1F2D26]">
          <div className="text-[10px] font-mono uppercase text-[#8A9990] flex items-center gap-1">
            <Percent className="w-3 h-3 text-[#D4AF37]" />
            <span>Syndicate ROI Ratio</span>
          </div>
          <div
            className={`text-sm font-mono font-bold mt-0.5 ${
              syndicateTotals.syndicateReturnRatioPct >= 100
                ? "text-[#10B981]"
                : "text-[#D4AF37]"
            }`}
          >
            {syndicateTotals.syndicateReturnRatioPct}% (
            {syndicateTotals.syndicateNetRoiPct >= 0 ? "+" : ""}
            {syndicateTotals.syndicateNetRoiPct}%)
          </div>
          <div className="text-[10px] font-mono text-[#8A9990]">
            {syndicateTotals.profitablePuntersCount}/{punterRoiData.length}{" "}
            punters ≥ 100% par
          </div>
        </div>
      </div>

      {/* Main D3 Bar Chart SVG */}
      <div className="p-3 rounded-xl bg-[#121A16] border border-[#1F2D26] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
          {chartDisplayMode === "roi_and_grouped" ? (
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-[#38BDF8] font-bold">
                <span className="w-3 h-2.5 rounded-sm bg-[#38BDF8]/70 border border-[#38BDF8]" />
                {scoreMetric === "points_score"
                  ? "1-Unit Selection Baseline (1u × Picks)"
                  : "1u Win + 1u Place Par Outlay ($1 EW)"}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#D4AF37] font-bold">
                <span className="w-3 h-2.5 rounded-sm bg-[#D4AF37]" />
                Total{" "}
                {scoreMetric === "points_score"
                  ? "Points / Score"
                  : "$ Return (Win + Place)"}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#10B981] font-bold">
                <span className="w-3 h-2.5 rounded-sm bg-[#10B981]" />
                ROI Return Ratio (% of Baseline)
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#F59E0B]">
                <span className="w-3.5 h-0.5 border-t border-dashed border-[#F59E0B]" />
                100% Break-Even Par Line
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-[#10B981] font-bold">
                <span className="w-3 h-2.5 rounded-sm bg-[#10B981]" />
                Positive Net ROI (+% Above Par)
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#F59E0B] font-bold">
                <span className="w-3 h-2.5 rounded-sm bg-[#F59E0B]" />
                Below Baseline (-% Net ROI)
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#D4AF37]">
                <span className="w-3.5 h-0.5 border-t border-dashed border-[#D4AF37]" />
                0% Break-Even Par
              </span>
            </div>
          )}
          <span className="text-[#8A9990]">
            Hover any punter bar for selection &amp; ROI telemetry
          </span>
        </div>

        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full h-72 overflow-visible select-none"
        >
          <defs>
            <linearGradient id="d3RoiPositiveBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="d3RoiSubParBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#D97706" stopOpacity="0.72" />
            </linearGradient>
            <linearGradient id="d3ScoreGoldBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#9A7B1C" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="d3BaselineBlueBar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.75" />
              <stop offset="100%" stopColor="#0284C7" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          {chartDisplayMode === "roi_and_grouped" ? (
            <>
              {d3ChartLayout.yRoiRatioTicks.map((tickVal) => {
                const y = d3ChartLayout.yRoiRatioScale(tickVal);
                return (
                  <g key={`grid-roi-${tickVal}`}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={svgW - padR}
                      y2={y}
                      stroke="#1F2D26"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padL - 8}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="9.5"
                      fontFamily="monospace"
                      fill="#10B981"
                    >
                      {tickVal}%
                    </text>
                  </g>
                );
              })}

              {d3ChartLayout.yRawTicks.map((tickVal) => {
                const y = d3ChartLayout.yRawScale(tickVal);
                return (
                  <text
                    key={`axis-raw-${tickVal}`}
                    x={svgW - padR + 8}
                    y={y + 3}
                    textAnchor="start"
                    fontSize="9.5"
                    fontFamily="monospace"
                    fill="#D4AF37"
                  >
                    {scoreMetric === "points_score"
                      ? `${tickVal}u/pt`
                      : `$${tickVal}`}
                  </text>
                );
              })}

              {/* 100% Break-Even Reference Line */}
              {(() => {
                const yPar = d3ChartLayout.yRoiRatioScale(100);
                return (
                  <g>
                    <line
                      x1={padL}
                      y1={yPar}
                      x2={svgW - padR}
                      y2={yPar}
                      stroke="#F59E0B"
                      strokeWidth="1.5"
                      strokeDasharray="6 4"
                    />
                    <rect
                      x={padL + 8}
                      y={yPar - 15}
                      width={215}
                      height={13}
                      rx="3"
                      fill="#0B110E"
                      stroke="#F59E0B"
                      strokeWidth="0.8"
                    />
                    <text
                      x={padL + 14}
                      y={yPar - 6}
                      fontSize="8.5"
                      fontFamily="monospace"
                      fill="#F59E0B"
                      fontWeight="bold"
                    >
                      100% Break-Even (1u Win + 1u Place Par)
                    </text>
                  </g>
                );
              })()}

              {punterRoiData.map((d, idx) => {
                const bandX = d3ChartLayout.xBand(d.punterName) ?? padL;
                const bandW = d3ChartLayout.xBand.bandwidth();
                const isHovered = activeHoveredDatum?.punterId === d.punterId;

                const roiRatio =
                  scoreMetric === "points_score"
                    ? d.pointsReturnRatioPct
                    : d.dollarReturnRatioPct;
                const netRoi =
                  scoreMetric === "points_score"
                    ? d.pointsNetRoiPct
                    : d.dollarNetRoiPct;
                const rawScore =
                  scoreMetric === "points_score"
                    ? d.totalPointsScore
                    : d.totalDollarScore;
                const activeBaseline = getActiveBaseline(d);

                const baselineX =
                  bandX + (d3ChartLayout.xSubBand("baseline") ?? 0);
                const scoreX = bandX + (d3ChartLayout.xSubBand("score") ?? 0);
                const roiX = bandX + (d3ChartLayout.xSubBand("roi") ?? 0);
                const subW = d3ChartLayout.xSubBand.bandwidth();

                const yBottom = padT + plotH;
                const yBaseline = d3ChartLayout.yRawScale(activeBaseline);
                const yScore = d3ChartLayout.yRawScale(rawScore);
                const yRoi = d3ChartLayout.yRoiRatioScale(roiRatio);

                const isAbovePar = roiRatio >= 100;

                return (
                  <g
                    key={d.punterId}
                    onMouseEnter={() => setHoveredPunterId(d.punterId)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={bandX - 6}
                      y={padT}
                      width={bandW + 12}
                      height={plotH}
                      rx="6"
                      fill={isHovered ? "#D4AF37" : "transparent"}
                      fillOpacity={isHovered ? 0.07 : 0}
                      stroke={isHovered ? "#D4AF37" : "transparent"}
                      strokeOpacity={isHovered ? 0.35 : 0}
                    />

                    {/* Bar 1: Baseline Outlay */}
                    <rect
                      x={baselineX}
                      y={yBaseline}
                      width={subW}
                      height={Math.max(2, yBottom - yBaseline)}
                      rx="3"
                      fill="url(#d3BaselineBlueBar)"
                      stroke="#38BDF8"
                      strokeWidth="0.8"
                    />
                    <text
                      x={baselineX + subW / 2}
                      y={yBaseline - 4}
                      textAnchor="middle"
                      fontSize="8"
                      fontFamily="monospace"
                      fill="#38BDF8"
                    >
                      {activeBaseline}u
                    </text>

                    {/* Bar 2: Total Score */}
                    <rect
                      x={scoreX}
                      y={yScore}
                      width={subW}
                      height={Math.max(2, yBottom - yScore)}
                      rx="3"
                      fill="url(#d3ScoreGoldBar)"
                      stroke="#D4AF37"
                      strokeWidth="0.9"
                    />
                    <text
                      x={scoreX + subW / 2}
                      y={yScore - 4}
                      textAnchor="middle"
                      fontSize="8.5"
                      fontFamily="monospace"
                      fontWeight="bold"
                      fill="#D4AF37"
                    >
                      {scoreMetric === "points_score"
                        ? `${rawScore}p`
                        : `$${Math.round(rawScore)}`}
                    </text>

                    {/* Bar 3: ROI Return Ratio (%) */}
                    <rect
                      x={roiX}
                      y={yRoi}
                      width={subW}
                      height={Math.max(2, yBottom - yRoi)}
                      rx="3"
                      fill={
                        isAbovePar
                          ? "url(#d3RoiPositiveBar)"
                          : "url(#d3RoiSubParBar)"
                      }
                      stroke={isAbovePar ? "#10B981" : "#F59E0B"}
                      strokeWidth="1"
                    />
                    <text
                      x={roiX + subW / 2}
                      y={yRoi - 5}
                      textAnchor="middle"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                      fill={isAbovePar ? "#10B981" : "#F59E0B"}
                    >
                      {roiRatio}%
                    </text>

                    {/* X-Axis Punter Label */}
                    <text
                      x={bandX + bandW / 2}
                      y={svgH - 28}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontFamily="sans-serif"
                      fontWeight="bold"
                      fill={isHovered ? "#D4AF37" : "#F3F4F0"}
                    >
                      #{idx + 1} {d.punterName}
                    </text>
                    <text
                      x={bandX + bandW / 2}
                      y={svgH - 14}
                      textAnchor="middle"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                      fill={netRoi >= 0 ? "#10B981" : "#F59E0B"}
                    >
                      Net ROI: {netRoi >= 0 ? "+" : ""}
                      {netRoi}%
                    </text>
                  </g>
                );
              })}
            </>
          ) : (
            <>
              {d3ChartLayout.yNetRoiTicks.map((tickVal) => {
                const y = d3ChartLayout.yNetRoiScale(tickVal);
                return (
                  <g key={`grid-net-${tickVal}`}>
                    <line
                      x1={padL}
                      y1={y}
                      x2={svgW - padR}
                      y2={y}
                      stroke={tickVal === 0 ? "#D4AF37" : "#1F2D26"}
                      strokeWidth={tickVal === 0 ? "1.6" : "1"}
                      strokeDasharray={tickVal === 0 ? "none" : "3 3"}
                    />
                    <text
                      x={padL - 8}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="9.5"
                      fontFamily="monospace"
                      fill={
                        tickVal > 0
                          ? "#10B981"
                          : tickVal < 0
                          ? "#F59E0B"
                          : "#D4AF37"
                      }
                      fontWeight={tickVal === 0 ? "bold" : "normal"}
                    >
                      {tickVal > 0 ? `+${tickVal}%` : `${tickVal}%`}
                    </text>
                  </g>
                );
              })}

              {punterRoiData.map((d, idx) => {
                const bandX = d3ChartLayout.xBand(d.punterName) ?? padL;
                const bandW = d3ChartLayout.xBand.bandwidth();
                const isHovered = activeHoveredDatum?.punterId === d.punterId;

                const netRoi =
                  scoreMetric === "points_score"
                    ? d.pointsNetRoiPct
                    : d.dollarNetRoiPct;
                const rawScore =
                  scoreMetric === "points_score"
                    ? d.totalPointsScore
                    : d.totalDollarScore;
                const activeBaseline = getActiveBaseline(d);

                const yZero = d3ChartLayout.yNetRoiScale(0);
                const yVal = d3ChartLayout.yNetRoiScale(netRoi);
                const barY = netRoi >= 0 ? yVal : yZero;
                const barH = Math.max(3, Math.abs(yVal - yZero));
                const barW = Math.min(64, bandW * 0.68);
                const barX = bandX + (bandW - barW) / 2;

                return (
                  <g
                    key={d.punterId}
                    onMouseEnter={() => setHoveredPunterId(d.punterId)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={bandX - 6}
                      y={padT}
                      width={bandW + 12}
                      height={plotH}
                      rx="6"
                      fill={isHovered ? "#D4AF37" : "transparent"}
                      fillOpacity={isHovered ? 0.07 : 0}
                    />
                    <rect
                      x={barX}
                      y={barY}
                      width={barW}
                      height={barH}
                      rx="4"
                      fill={
                        netRoi >= 0
                          ? "url(#d3RoiPositiveBar)"
                          : "url(#d3RoiSubParBar)"
                      }
                      stroke={netRoi >= 0 ? "#10B981" : "#F59E0B"}
                      strokeWidth="1.2"
                    />
                    <text
                      x={bandX + bandW / 2}
                      y={netRoi >= 0 ? barY - 6 : barY + barH + 12}
                      textAnchor="middle"
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight="bold"
                      fill={netRoi >= 0 ? "#10B981" : "#F59E0B"}
                    >
                      {netRoi >= 0 ? `+${netRoi}%` : `${netRoi}%`}
                    </text>

                    <text
                      x={bandX + bandW / 2}
                      y={svgH - 28}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontFamily="sans-serif"
                      fontWeight="bold"
                      fill={isHovered ? "#D4AF37" : "#F3F4F0"}
                    >
                      #{idx + 1} {d.punterName}
                    </text>
                    <text
                      x={bandX + bandW / 2}
                      y={svgH - 14}
                      textAnchor="middle"
                      fontSize="9"
                      fontFamily="monospace"
                      fill="#8A9990"
                    >
                      {scoreMetric === "points_score"
                        ? `${rawScore} pts / ${activeBaseline}u`
                        : `${formatDollarReturn(rawScore)} / ${activeBaseline}u`}
                    </text>
                  </g>
                );
              })}
            </>
          )}
        </svg>

        {/* Active Punter Telemetry Inspector Strip */}
        {activeHoveredDatum && (
          <div className="p-3 rounded-lg bg-[#0B110E] border border-[#1F2D26] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37] font-bold">
                {activeHoveredDatum.punterName}
              </span>
              <span className="text-[#8A9990]">
                {activeHoveredDatum.racesParticipated} races ·{" "}
                <strong className="text-[#38BDF8]">
                  {activeHoveredDatum.totalSelections} selections
                </strong>{" "}
                (= {activeHoveredDatum.baselineEachWayUnitsOutlay}u Each-Way Par
                / {activeHoveredDatum.baselineOneUnitOutlay}u 1-Unit Baseline)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-[#8A9990]">Total Score: </span>
                <strong className="text-[#D4AF37]">
                  {activeHoveredDatum.totalPointsScore} pts
                </strong>{" "}
                <span className="text-[#10B981] font-bold">
                  ({formatDollarReturn(activeHoveredDatum.totalDollarScore)})
                </span>
              </div>
              <div>
                <span className="text-[#8A9990]">Return / Pick: </span>
                <strong className="text-[#F3F4F0]">
                  {scoreMetric === "points_score"
                    ? `${activeHoveredDatum.pointsPerUnitBet} pts/pick`
                    : `$${activeHoveredDatum.dollarPerUnitBet}/pick`}
                </strong>
              </div>
              <div>
                <span className="text-[#8A9990]">Return Ratio: </span>
                <strong
                  className={
                    (scoreMetric === "points_score"
                      ? activeHoveredDatum.pointsReturnRatioPct
                      : activeHoveredDatum.dollarReturnRatioPct) >= 100
                      ? "text-[#10B981]"
                      : "text-[#F59E0B]"
                  }
                >
                  {scoreMetric === "points_score"
                    ? activeHoveredDatum.pointsReturnRatioPct
                    : activeHoveredDatum.dollarReturnRatioPct}
                  %
                </strong>
              </div>
              <div>
                <span className="text-[#8A9990]">Net ROI: </span>
                <strong
                  className={
                    (scoreMetric === "points_score"
                      ? activeHoveredDatum.pointsNetRoiPct
                      : activeHoveredDatum.dollarNetRoiPct) >= 0
                      ? "text-[#10B981]"
                      : "text-[#F59E0B]"
                  }
                >
                  {(scoreMetric === "points_score"
                    ? activeHoveredDatum.pointsNetRoiPct
                    : activeHoveredDatum.dollarNetRoiPct) >= 0
                    ? "+"
                    : ""}
                  {scoreMetric === "points_score"
                    ? activeHoveredDatum.pointsNetRoiPct
                    : activeHoveredDatum.dollarNetRoiPct}
                  %
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Individual Punter 1-Unit Selection ROI Ledger */}
      <div className="overflow-x-auto rounded-lg border border-[#1F2D26]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[#121A16] border-b border-[#1F2D26] text-[10px] font-mono uppercase text-[#8A9990]">
              <th className="py-2 px-2.5">Rank &amp; Punter</th>
              <th className="py-2 px-2.5 text-center">Races / Picks</th>
              <th className="py-2 px-2.5 text-right">
                1u Win + 1u Place Par ($1 EW)
              </th>
              <th className="py-2 px-2.5 text-right">$ Return Score (EW)</th>
              <th className="py-2 px-2.5 text-right">$ ROI (% of EW Par)</th>
              <th className="py-2 px-2.5 text-right">Total Points Score</th>
              <th className="py-2 px-2.5 text-right">
                Points ROI (vs 1u/Pick)
              </th>
              <th className="py-2 px-2.5 text-right">Net EW Variance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F2D26] font-mono">
            {punterRoiData.map((row, idx) => {
              const isDollarAbovePar = row.dollarReturnRatioPct >= 100;
              const isPtsAbovePar = row.pointsReturnRatioPct >= 100;
              return (
                <tr
                  key={row.punterId}
                  onMouseEnter={() => setHoveredPunterId(row.punterId)}
                  className="bg-[#0B110E] hover:bg-[#121A16]/90 transition-colors"
                >
                  <td className="py-2 px-2.5 font-sans font-bold text-[#F3F4F0]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#16201B] text-[#D4AF37]">
                        #{idx + 1}
                      </span>
                      <span>{row.punterName}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2.5 text-center text-[#8A9990]">
                    {row.racesParticipated}R ·{" "}
                    <span className="text-[#F3F4F0] font-bold">
                      {row.totalSelections} picks
                    </span>
                  </td>
                  <td className="py-2 px-2.5 text-right text-[#38BDF8] font-bold">
                    {row.baselineEachWayUnitsOutlay}.00u ($
                    {row.baselineEachWayUnitsOutlay}.00)
                  </td>
                  <td className="py-2 px-2.5 text-right text-[#10B981] font-bold">
                    {formatDollarReturn(row.totalDollarScore)}
                  </td>
                  <td
                    className={`py-2 px-2.5 text-right font-bold ${
                      isDollarAbovePar ? "text-[#10B981]" : "text-[#F59E0B]"
                    }`}
                  >
                    {row.dollarReturnRatioPct}% (
                    {row.dollarNetRoiPct >= 0 ? "+" : ""}
                    {row.dollarNetRoiPct}%)
                  </td>
                  <td className="py-2 px-2.5 text-right text-[#D4AF37] font-bold">
                    {row.totalPointsScore} pts
                  </td>
                  <td
                    className={`py-2 px-2.5 text-right font-bold ${
                      isPtsAbovePar ? "text-[#10B981]" : "text-[#F59E0B]"
                    }`}
                  >
                    {row.pointsReturnRatioPct}% ({row.pointsPerUnitBet.toFixed(2)}
                    p/u)
                  </td>
                  <td
                    className={`py-2 px-2.5 text-right font-bold ${
                      row.dollarNetVariance >= 0
                        ? "text-[#10B981]"
                        : "text-[#F59E0B]"
                    }`}
                  >
                    {row.dollarNetVariance >= 0 ? "+" : ""}
                    {formatDollarReturn(row.dollarNetVariance)}
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
