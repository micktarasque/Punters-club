import React, { useState, useMemo } from "react";
import {
  Award,
  BarChart3,
  DollarSign,
  Layers,
  PieChart,
  Sparkles,
  Table as TableIcon,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { PunterProfile, RaceMeeting } from "../../types/racing";
import {
  evaluateRaceTrio,
  formatDollarReturn,
  getPunterJokerForMeeting,
  getPunterSelectionsForMeeting,
  computeRaceEachWayParUnits,
} from "../../utils/scoring";
import { AreaChart } from "./AreaChart";
import { BarChart } from "./BarChart";
import { RingChart } from "./RingChart";
import { BklitTable, BklitColumn } from "./BklitTable";
import { BklitMetricCard } from "./BklitMetricCard";

interface BklitResultsVisualizerProps {
  meetings: RaceMeeting[];
  punters: PunterProfile[];
  scoringMode: "points" | "dollars";
  onToggleScoringMode?: (mode: "points" | "dollars") => void;
  className?: string;
  isApple?: boolean;
}

const PUNTER_COLORS = [
  "#D4AF37", // Gold
  "#10B981", // Emerald
  "#38BDF8", // Cyan
  "#F43F5E", // Coral
  "#A855F7", // Violet
  "#F59E0B", // Amber
];

export const BklitResultsVisualizer: React.FC<BklitResultsVisualizerProps> = ({
  meetings,
  punters,
  scoringMode,
  onToggleScoringMode,
  className = "",
  isApple = false,
}) => {
  const [activeVisualTab, setActiveVisualTab] = useState<
    "area_timeline" | "roi_bars" | "strike_ring" | "bklit_table"
  >("area_timeline");

  // Build race-by-race cumulative data
  const { timelineData, punterStats, hitDistribution, totalSyndicateReturn, totalParUnits } =
    useMemo(() => {
      // Gather all unique races across target meetings
      const allRaces: Array<{
        meetingId: string;
        venue: string;
        raceNumber: number;
        raceName: string;
        key: string;
        label: string;
      }> = [];

      meetings.forEach((m) => {
        m.races.forEach((r) => {
          allRaces.push({
            meetingId: m.id,
            venue: m.venue,
            raceNumber: r.raceNumber,
            raceName: r.raceName,
            key: `${m.id}-R${r.raceNumber}`,
            label: `${m.venue.slice(0, 3).toUpperCase()} R${r.raceNumber}`,
          });
        });
      });

      // Stats per punter
      const statsMap = new Map<
        string,
        {
          punter: PunterProfile;
          totalPoints: number;
          totalDollars: number;
          parUnits: number;
          firstHits: number;
          secondHits: number;
          thirdHits: number;
          misses: number;
          color: string;
        }
      >();

      punters.forEach((p, idx) => {
        statsMap.set(p.id, {
          punter: p,
          totalPoints: 0,
          totalDollars: 0,
          parUnits: 0,
          firstHits: 0,
          secondHits: 0,
          thirdHits: 0,
          misses: 0,
          color: PUNTER_COLORS[idx % PUNTER_COLORS.length],
        });
      });

      let runningSyndicateDollars = 0;
      let runningTotalPar = 0;

      // Cumulative points/dollars per race step
      const runningValues: Record<string, number> = {};
      punters.forEach((p) => {
        runningValues[p.id] = 0;
      });

      const timeline = allRaces.map((raceItem, rIdx) => {
        const meeting = meetings.find((m) => m.id === raceItem.meetingId);
        const race = meeting?.races.find(
          (r) => r.raceNumber === raceItem.raceNumber
        );

        const pointDatum: Record<string, any> = {
          raceKey: raceItem.key,
          raceLabel: raceItem.label,
          raceIndex: rIdx + 1,
        };

        if (meeting && race) {
          punters.forEach((punter) => {
            const mSelections = getPunterSelectionsForMeeting(punter, meeting);
            const mJoker = getPunterJokerForMeeting(punter, meeting);
            const isJoker = mJoker === race.raceNumber;
            const evalResult = evaluateRaceTrio(
              race,
              mSelections[race.raceNumber],
              meeting.date,
              isJoker
            );

            const stat = statsMap.get(punter.id);
            if (stat) {
              stat.totalPoints += evalResult.racePointsTally;
              stat.totalDollars += evalResult.raceDollarReturn;
              const validPicks = evalResult.picks.filter(
                (pk) => pk.tabNumber !== null
              );
              const parInfo = computeRaceEachWayParUnits(
                (race.runners || []).length,
                validPicks.length
              );
              stat.parUnits += parInfo.parUnits;
              runningTotalPar += parInfo.parUnits;

              for (const pk of validPicks) {
                if (pk.finishPosition === 1) stat.firstHits++;
                else if (pk.finishPosition === 2) stat.secondHits++;
                else if (pk.finishPosition === 3) stat.thirdHits++;
                else stat.misses++;
              }
            }

            const increment =
              scoringMode === "dollars"
                ? evalResult.raceDollarReturn
                : evalResult.racePointsTally;
            runningValues[punter.id] =
              (runningValues[punter.id] || 0) + increment;
            pointDatum[punter.id] = Number(
              runningValues[punter.id].toFixed(2)
            );
            runningSyndicateDollars += evalResult.raceDollarReturn;
          });
        }

        return pointDatum;
      });

      // Total hit distribution across all punters
      let allFirsts = 0;
      let allSeconds = 0;
      let allThirds = 0;
      let allMisses = 0;

      statsMap.forEach((s) => {
        allFirsts += s.firstHits;
        allSeconds += s.secondHits;
        allThirds += s.thirdHits;
        allMisses += s.misses;
      });

      const hitDist = [
        {
          key: "first",
          label: "1st (Winners)",
          value: allFirsts,
          color: "#D4AF37",
        },
        {
          key: "second",
          label: "2nd (Runners-Up)",
          value: allSeconds,
          color: "#10B981",
        },
        {
          key: "third",
          label: "3rd (Placegetters)",
          value: allThirds,
          color: "#38BDF8",
        },
        {
          key: "miss",
          label: "Unplaced",
          value: allMisses,
          color: "#334155",
        },
      ];

      return {
        timelineData: timeline,
        punterStats: Array.from(statsMap.values()),
        hitDistribution: hitDist,
        totalSyndicateReturn: runningSyndicateDollars,
        totalParUnits: runningTotalPar,
      };
    }, [meetings, punters, scoringMode]);

  // Lead punter
  const leader = useMemo(() => {
    if (punterStats.length === 0) return null;
    return [...punterStats].sort((a, b) =>
      scoringMode === "dollars"
        ? b.totalDollars - a.totalDollars
        : b.totalPoints - a.totalPoints
    )[0];
  }, [punterStats, scoringMode]);

  // Overall ROI %
  const overallRoiPct =
    totalParUnits > 0
      ? Number(((totalSyndicateReturn / totalParUnits) * 100).toFixed(1))
      : 0;

  // Series for AreaChart
  const areaSeries = punterStats.map((s) => ({
    key: s.punter.id,
    label: s.punter.name,
    color: s.color,
  }));

  // BarChart Data: comparing Par vs Dollars, or Points
  const barChartData = punterStats.map((s) => {
    const roiPct =
      s.parUnits > 0
        ? Number(((s.totalDollars / s.parUnits) * 100).toFixed(1))
        : 0;
    return {
      punterId: s.punter.id,
      name: s.punter.name,
      points: s.totalPoints,
      dollars: Number(s.totalDollars.toFixed(2)),
      parUnits: s.parUnits,
      roiPct,
    };
  });

  const barSeries =
    scoringMode === "dollars"
      ? [
          {
            key: "parUnits",
            label: "Par Outlay ($)",
            color: isApple ? "#8E8E93" : "#475569",
          },
          {
            key: "dollars",
            label: "Actual Return ($)",
            color: isApple ? "#0071E3" : "#10B981",
          },
        ]
      : [
          {
            key: "points",
            label: "Total Points",
            color: isApple ? "#0071E3" : "#D4AF37",
          },
        ];

  // Table Columns for BklitTable
  const tableColumns: BklitColumn<any>[] = [
    {
      key: "name",
      header: "Syndicate Member",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: row.color }}
          />
          <span className="font-sans font-bold text-[#F3F4F0]">{row.name}</span>
          {leader?.punter.id === row.punterId && (
            <span className="text-[10px] text-[#D4AF37] font-mono flex items-center gap-0.5">
              <Award className="w-3 h-3" /> Leader
            </span>
          )}
        </div>
      ),
    },
    {
      key: "points",
      header: "Points (3/2/1)",
      align: "right",
      sortable: true,
      render: (row) => (
        <span className="font-bold text-[#D4AF37]">{row.points} pts</span>
      ),
    },
    {
      key: "firstHits",
      header: "Winners Picked",
      align: "right",
      sortable: true,
      render: (row) => (
        <span className="text-[#F3F4F0]">
          {row.firstHits}{" "}
          <span className="text-[10px] text-[#8A9990]">
            ({row.podiumHits} podiums)
          </span>
        </span>
      ),
    },
    {
      key: "parUnits",
      header: "1u W+P Par",
      align: "right",
      sortable: true,
      render: (row) => <span>{row.parUnits}u (${row.parUnits}.00)</span>,
    },
    {
      key: "dollars",
      header: "Total Return",
      align: "right",
      sortable: true,
      render: (row) => (
        <span className="font-bold text-[#10B981]">
          {formatDollarReturn(row.dollars)}
        </span>
      ),
    },
    {
      key: "roiPct",
      header: "Each-Way ROI %",
      align: "right",
      sortable: true,
      render: (row) => {
        const isProfit = row.roiPct >= 100;
        return (
          <span
            className={`font-semibold ${
              isProfit ? "text-[#10B981]" : "text-[#D4AF37]"
            }`}
          >
            {row.roiPct}%
          </span>
        );
      },
    },
  ];

  const tableData = punterStats.map((s) => ({
    punterId: s.punter.id,
    name: s.punter.name,
    color: s.color,
    points: s.totalPoints,
    firstHits: s.firstHits,
    podiumHits: s.firstHits + s.secondHits + s.thirdHits,
    parUnits: s.parUnits,
    dollars: Number(s.totalDollars.toFixed(2)),
    roiPct:
      s.parUnits > 0
        ? Number(((s.totalDollars / s.parUnits) * 100).toFixed(1))
        : 0,
  }));

  return (
    <div
      className={`bklit-results-visualizer rounded-xl border p-4 space-y-4 transition-colors ${
        isApple
          ? "bg-white border-[#E5E5EA] shadow-xs text-[#1D1D1F]"
          : "border-[#1F2D26] bg-[#0E1612] text-[#F3F4F0]"
      } ${className}`}
    >
      {/* Header with Bklit UI Badge & Controls */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 ${
          isApple ? "border-[#E5E5EA]" : "border-[#1F2D26]"
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                isApple
                  ? "bg-[#0071E3]/10 border border-[#0071E3]/30 text-[#0071E3]"
                  : "bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#D4AF37]"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              bklit.ui Data Visualizer
            </span>
            <h3
              className={`text-base font-bold font-sans ${
                isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"
              }`}
            >
              Results Analytics &amp; Performance Graphics
            </h3>
          </div>
          <p
            className={`text-xs ${
              isApple ? "text-[#86868B]" : "text-[#8A9990]"
            }`}
          >
            Composable Bklit UI charts with live multi-runner accumulation, ROI benchmarks &amp; strike distributions.
          </p>
        </div>

        {/* Scoring Mode Toggle */}
        {onToggleScoringMode && (
          <div
            className={`flex items-center gap-1 p-1 rounded-lg border ${
              isApple
                ? "bg-[#F5F5F7] border-[#E5E5EA]"
                : "bg-[#0B110E] border-[#1F2D26]"
            }`}
          >
            <button
              type="button"
              onClick={() => onToggleScoringMode("points")}
              className={`px-3 py-1 text-xs font-mono font-medium rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                scoringMode === "points"
                  ? isApple
                    ? "bg-[#0071E3] text-white shadow-xs font-bold"
                    : "bg-[#D4AF37] text-[#0B110E] font-bold"
                  : isApple
                  ? "text-[#86868B] hover:text-[#1D1D1F]"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              Points
            </button>
            <button
              type="button"
              onClick={() => onToggleScoringMode("dollars")}
              className={`px-3 py-1 text-xs font-mono font-medium rounded transition-all cursor-pointer flex items-center gap-1.5 ${
                scoringMode === "dollars"
                  ? isApple
                    ? "bg-[#0071E3] text-white shadow-xs font-bold"
                    : "bg-[#10B981] text-[#0B110E] font-bold"
                  : isApple
                  ? "text-[#86868B] hover:text-[#1D1D1F]"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              $ Return
            </button>
          </div>
        )}
      </div>

      {/* Top 4 Bklit Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <BklitMetricCard
          title="Current Leader"
          value={leader?.punter.name || "—"}
          subtitle={
            scoringMode === "dollars"
              ? `${formatDollarReturn(leader?.totalDollars || 0)} Return`
              : `${leader?.totalPoints || 0} Total Points`
          }
          icon={<Trophy className="w-4 h-4" />}
          badge={{ label: "#1 Rank", variant: "gold" }}
          highlight
        />
        <BklitMetricCard
          title="Syndicate Returns"
          value={formatDollarReturn(totalSyndicateReturn)}
          subtitle={`${totalParUnits}u Each-Way Par Turnover`}
          icon={<DollarSign className="w-4 h-4" />}
          badge={{
            label: `${overallRoiPct}% ROI`,
            variant: overallRoiPct >= 100 ? "positive" : "warning",
          }}
        />
        <BklitMetricCard
          title="Podium Strike Rate"
          value={
            hitDistribution.length > 0 &&
            hitDistribution.reduce((s, h) => s + h.value, 0) > 0
              ? `${(
                  ((hitDistribution[0].value +
                    hitDistribution[1].value +
                    hitDistribution[2].value) /
                    hitDistribution.reduce((s, h) => s + h.value, 0)) *
                  100
                ).toFixed(1)}%`
              : "0%"
          }
          subtitle={`${hitDistribution[0].value} Winners / ${
            hitDistribution[0].value +
            hitDistribution[1].value +
            hitDistribution[2].value
          } Podiums`}
          icon={<Award className="w-4 h-4" />}
          badge={{ label: "Hit Rate", variant: "positive" }}
        />
        <BklitMetricCard
          title="Meetings Tracked"
          value={`${meetings.length} Card${meetings.length === 1 ? "" : "s"}`}
          subtitle={`${timelineData.length} Total Races Analysed`}
          icon={<Layers className="w-4 h-4" />}
          badge={{ label: "Live Synced", variant: "neutral" }}
        />
      </div>

      {/* Bklit Visualizer Tabs */}
      <div
        className={`flex items-center gap-1.5 p-1 rounded-lg border overflow-x-auto text-xs font-mono ${
          isApple
            ? "bg-[#F5F5F7] border-[#E5E5EA]"
            : "bg-[#0B110E] border-[#1F2D26]"
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveVisualTab("area_timeline")}
          className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeVisualTab === "area_timeline"
              ? isApple
                ? "bg-white text-[#0071E3] font-bold shadow-xs border border-[#E5E5EA]"
                : "bg-[#1F2D26] text-[#F3F4F0] font-bold"
              : isApple
              ? "text-[#86868B] hover:text-[#1D1D1F]"
              : "text-[#8A9990] hover:text-[#F3F4F0]"
          }`}
        >
          <TrendingUp
            className={`w-3.5 h-3.5 ${
              isApple ? "text-[#0071E3]" : "text-[#38BDF8]"
            }`}
          />
          Area Timeline (Progression)
        </button>
        <button
          type="button"
          onClick={() => setActiveVisualTab("roi_bars")}
          className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeVisualTab === "roi_bars"
              ? isApple
                ? "bg-white text-[#0071E3] font-bold shadow-xs border border-[#E5E5EA]"
                : "bg-[#1F2D26] text-[#F3F4F0] font-bold"
              : isApple
              ? "text-[#86868B] hover:text-[#1D1D1F]"
              : "text-[#8A9990] hover:text-[#F3F4F0]"
          }`}
        >
          <BarChart3
            className={`w-3.5 h-3.5 ${
              isApple ? "text-[#0071E3]" : "text-[#10B981]"
            }`}
          />
          Grouped Bar (ROI vs Par)
        </button>
        <button
          type="button"
          onClick={() => setActiveVisualTab("strike_ring")}
          className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeVisualTab === "strike_ring"
              ? isApple
                ? "bg-white text-[#0071E3] font-bold shadow-xs border border-[#E5E5EA]"
                : "bg-[#1F2D26] text-[#F3F4F0] font-bold"
              : isApple
              ? "text-[#86868B] hover:text-[#1D1D1F]"
              : "text-[#8A9990] hover:text-[#F3F4F0]"
          }`}
        >
          <PieChart
            className={`w-3.5 h-3.5 ${
              isApple ? "text-[#0071E3]" : "text-[#D4AF37]"
            }`}
          />
          Donut Ring (Podium Strike)
        </button>
        <button
          type="button"
          onClick={() => setActiveVisualTab("bklit_table")}
          className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeVisualTab === "bklit_table"
              ? isApple
                ? "bg-white text-[#0071E3] font-bold shadow-xs border border-[#E5E5EA]"
                : "bg-[#1F2D26] text-[#F3F4F0] font-bold"
              : isApple
              ? "text-[#86868B] hover:text-[#1D1D1F]"
              : "text-[#8A9990] hover:text-[#F3F4F0]"
          }`}
        >
          <TableIcon
            className={`w-3.5 h-3.5 ${
              isApple ? "text-[#0071E3]" : "text-[#A855F7]"
            }`}
          />
          Bklit Table (Sortable Matrix)
        </button>
      </div>

      {/* Chart Canvas Area */}
      <div
        className={`p-3 rounded-lg border ${
          isApple
            ? "bg-white border-[#E5E5EA]"
            : "bg-[#0B110E] border-[#1F2D26]"
        }`}
      >
        {activeVisualTab === "area_timeline" && (
          <div className="space-y-2">
            <div
              className={`flex items-center justify-between text-xs font-mono ${
                isApple ? "text-[#86868B]" : "text-[#8A9990]"
              }`}
            >
              <span
                className={`font-semibold ${
                  isApple ? "text-[#0071E3]" : "text-[#D4AF37]"
                }`}
              >
                Race-by-Race Cumulative {scoringMode === "dollars" ? "$ Return" : "Points"}
              </span>
              <span>Spline with Gradient Area Under Curve</span>
            </div>
            <AreaChart
              data={timelineData}
              indexKey="raceLabel"
              series={areaSeries}
              height={260}
              valueFormatter={(v) =>
                scoringMode === "dollars" ? formatDollarReturn(v) : `${v} pts`
              }
              indexFormatter={(v) => String(v)}
              yAxisLabel={scoringMode === "dollars" ? "$ Cumulative" : "Pts"}
            />
          </div>
        )}

        {activeVisualTab === "roi_bars" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-[#8A9990]">
              <span className="text-[#10B981] font-semibold">
                Punter Par Units Outlay vs Payout Collected
              </span>
              <span>Grouped Bars with Par Baseline</span>
            </div>
            <BarChart
              data={barChartData}
              indexKey="name"
              series={barSeries}
              height={260}
              valueFormatter={(v) =>
                scoringMode === "dollars" ? formatDollarReturn(v) : `${v} pts`
              }
              referenceLine={
                scoringMode === "dollars"
                  ? { value: totalParUnits / Math.max(1, punters.length), label: "Avg Par Outlay" }
                  : undefined
              }
            />
          </div>
        )}

        {activeVisualTab === "strike_ring" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-[#8A9990]">
              <span className="text-[#D4AF37] font-semibold">
                Combined Syndicate Selection Finish Breakdown
              </span>
              <span>Radial Segment Strike Distribution</span>
            </div>
            <div className="py-4 flex justify-center">
              <RingChart
                data={hitDistribution}
                size={200}
                innerRadiusRatio={0.65}
                centerTitle={`${hitDistribution[0].value + hitDistribution[1].value + hitDistribution[2].value}`}
                centerSubtitle="Podium Hits"
                valueFormatter={(v) => `${v}`}
              />
            </div>
          </div>
        )}

        {activeVisualTab === "bklit_table" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-[#8A9990]">
              <span className="text-[#A855F7] font-semibold">
                Interactive Syndicate Performance Ledger
              </span>
              <span>Click any column header to sort</span>
            </div>
            <BklitTable
              columns={tableColumns}
              data={tableData}
              keyExtractor={(r) => r.punterId}
              defaultSortKey={scoringMode === "dollars" ? "dollars" : "points"}
              defaultSortDirection="desc"
            />
          </div>
        )}
      </div>
    </div>
  );
};
