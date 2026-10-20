import React, { useState, useMemo } from "react";
import {
  Archive,
  Award,
  BarChart3,
  Calendar,
  DollarSign,
  PieChart,
  Sparkles,
  Table as TableIcon,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { PunterProfile, RaceMeeting } from "../../types/racing";
import type { SavedRaceReport } from "../../utils/raceReportArchive";
import { formatDollarReturn } from "../../utils/scoring";
import { AreaChart } from "./AreaChart";
import { BarChart } from "./BarChart";
import { RingChart } from "./RingChart";
import { BklitTable, BklitColumn } from "./BklitTable";
import { BklitMetricCard } from "./BklitMetricCard";

interface BklitReportVisualizerProps {
  reports: SavedRaceReport[];
  activeReport?: SavedRaceReport | null;
  onSelectReport?: (reportId: string) => void;
  meetings: RaceMeeting[];
  punters: PunterProfile[];
  className?: string;
  isApple?: boolean;
}

export const BklitReportVisualizer: React.FC<BklitReportVisualizerProps> = ({
  reports,
  activeReport,
  onSelectReport,
  punters,
  className = "",
  isApple = false,
}) => {
  const [activeVisualTab, setActiveVisualTab] = useState<
    "archive_trend" | "member_pnl" | "market_rings" | "reports_table"
  >("archive_trend");

  // Historical trend data across chronological reports
  const trendData = useMemo(() => {
    const sorted = [...reports].sort((a, b) =>
      (a.raceDate || "").localeCompare(b.raceDate || "")
    );
    return sorted.map((r) => {
      const par = r.standings.reduce(
        (sum, s) => sum + (s.parScoreUnits || 0),
        0
      );
      const dollars =
        (r.trifectaSummary?.totalFlexiReturn || 0) +
        (r.quaddieSummary?.flexiPayout || 0) +
        r.standings.reduce((sum, s) => sum + (s.eachWayDollarReturn || 0), 0);
      const roiPct =
        par > 0 ? Number(((dollars / par) * 100).toFixed(1)) : 0;

      const topStanding = r.standings[0];
      const dateStr = r.raceDate || "2026-10-10";

      return {
        id: r.id,
        label: `${dateStr.slice(5)} ${(r.venue || "").slice(0, 3).toUpperCase()}`,
        date: dateStr,
        venue: r.venue,
        roiPct,
        dollars: Number(dollars.toFixed(2)),
        par: par > 0 ? par : 30,
        winner: topStanding?.punterName || "Leader",
      };
    });
  }, [reports]);

  // Current report punter comparison data
  const punterBarData = useMemo(() => {
    if (!activeReport || activeReport.standings.length === 0) {
      return punters.map((p) => ({
        name: p.name,
        par: 20,
        dollars: 25,
        points: 15,
      }));
    }

    return activeReport.standings.map((u) => {
      const par = u.parScoreUnits || u.rawEachWayUnitsOutlay || 20;
      const dollars = Number(
        (u.eachWayDollarReturn || u.totalDollarReturn || 0).toFixed(2)
      );
      const roi = par > 0 ? Number(((dollars / par) * 100).toFixed(1)) : 0;
      return {
        name: u.punterName,
        par,
        dollars,
        points: u.totalPoints,
        roi,
      };
    });
  }, [activeReport, punters]);

  // Barrier Bias & Market Fav Ring segments
  const { barrierSegments, favSegments } = useMemo(() => {
    if (!activeReport?.cardTrackAssessment) {
      return {
        barrierSegments: [
          {
            key: "inside",
            label: "Inside (1-4)",
            value: 4,
            color: isApple ? "#0071E3" : "#10B981",
          },
          {
            key: "middle",
            label: "Middle (5-8)",
            value: 3,
            color: isApple ? "#34C759" : "#38BDF8",
          },
          {
            key: "outside",
            label: "Wide (9+)",
            value: 3,
            color: isApple ? "#FF9500" : "#F59E0B",
          },
        ],
        favSegments: [
          {
            key: "favs",
            label: "Favs Won",
            value: 4,
            color: isApple ? "#0071E3" : "#D4AF37",
          },
          {
            key: "nonfavs",
            label: "Non-Favs Won",
            value: 6,
            color: isApple ? "#C7C7CC" : "#475569",
          },
        ],
      };
    }

    const bz = activeReport.cardTrackAssessment.barrierZones;
    const bSegs = [
      {
        key: "inside",
        label: `Inside (1-4)`,
        value: bz?.inside1To4Wins ?? 0,
        color: isApple ? "#0071E3" : "#10B981",
      },
      {
        key: "middle",
        label: `Middle (5-8)`,
        value: bz?.middle5To8Wins ?? 0,
        color: isApple ? "#34C759" : "#38BDF8",
      },
      {
        key: "outside",
        label: `Wide (9+)`,
        value: bz?.outside9PlusWins ?? 0,
        color: isApple ? "#FF9500" : "#F59E0B",
      },
    ];

    const favsWon = activeReport.cardTrackAssessment.favouriteWinsCount ?? 0;
    const totalRaces = activeReport.totalCardRacesCount || 10;
    const nonFavs = Math.max(0, totalRaces - favsWon);

    const fSegs = [
      {
        key: "favs",
        label: "Market Favourites Won",
        value: favsWon,
        color: isApple ? "#0071E3" : "#D4AF37",
      },
      {
        key: "nonfavs",
        label: "Non-Favourites Won",
        value: nonFavs,
        color: isApple ? "#C7C7CC" : "#475569",
      },
    ];

    return { barrierSegments: bSegs, favSegments: fSegs };
  }, [activeReport, isApple]);

  // Table columns for historical reports
  const reportColumns: BklitColumn<SavedRaceReport>[] = [
    {
      key: "raceDate",
      header: "Meeting Date",
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2">
          <Calendar
            className={`w-3.5 h-3.5 ${
              isApple ? "text-[#86868B]" : "text-[#8A9990]"
            }`}
          />
          <span
            className={`font-mono ${
              isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"
            }`}
          >
            {r.raceDate}
          </span>
          {r.id === activeReport?.id && (
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded border ${
                isApple
                  ? "bg-[#0071E3]/10 text-[#0071E3] border-[#0071E3]/30 font-semibold"
                  : "bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40"
              }`}
            >
              Active
            </span>
          )}
        </div>
      ),
    },
    {
      key: "venue",
      header: "Track / Venue",
      sortable: true,
      render: (r) => (
        <span
          className={`font-bold ${
            isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"
          }`}
        >
          {r.venue}
        </span>
      ),
    },
    {
      key: "topPunter",
      header: "Leader / Winner",
      sortable: true,
      render: (r) => {
        const top = r.standings[0];
        return (
          <span
            className={`font-semibold flex items-center gap-1 ${
              isApple ? "text-[#0071E3]" : "text-[#D4AF37]"
            }`}
          >
            <Trophy className="w-3 h-3" />
            {top ? `${top.punterName} (${top.totalPoints} pts)` : "No entries"}
          </span>
        );
      },
    },
    {
      key: "exoticReturn",
      header: "Exotic Payout",
      align: "right",
      sortable: true,
      render: (r) => {
        const total =
          (r.trifectaSummary?.totalFlexiReturn || 0) +
          (r.quaddieSummary?.flexiPayout || 0);
        return (
          <span
            className={`font-bold ${
              isApple ? "text-[#34C759]" : "text-[#10B981]"
            }`}
          >
            {formatDollarReturn(total)}
          </span>
        );
      },
    },
    {
      key: "trifectaHits",
      header: "Exotic Hits",
      align: "right",
      sortable: true,
      render: (r) => (
        <span>
          {r.trifectaSummary?.trifectaHits || 0} Tri ·{" "}
          {r.quaddieSummary?.isWon ? "1" : "0"} Quad
        </span>
      ),
    },
  ];

  const totalArchivePayout = reports.reduce((sum, r) => {
    return (
      sum +
      (r.trifectaSummary?.totalFlexiReturn || 0) +
      (r.quaddieSummary?.flexiPayout || 0) +
      r.standings.reduce((s, st) => s + (st.eachWayDollarReturn || 0), 0)
    );
  }, 0);

  const bestScore = reports.reduce((max, r) => {
    const top = r.standings[0]?.totalPoints || 0;
    return top > max ? top : max;
  }, 0);

  return (
    <div
      className={`bklit-report-visualizer rounded-xl border p-4 space-y-4 transition-colors ${
        isApple
          ? "bg-white border-[#E5E5EA] shadow-xs text-[#1D1D1F]"
          : "border-[#1F2D26] bg-[#0E1612] text-[#F3F4F0]"
      } ${className}`}
    >
      {/* Header */}
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
                  : "bg-[#38BDF8]/15 border border-[#38BDF8]/40 text-[#38BDF8]"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              bklit.ui Report Analytics
            </span>
            <h3
              className={`text-base font-bold font-sans ${
                isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"
              }`}
            >
              Archived Reports &amp; Track Assessment Graphics
            </h3>
          </div>
          <p
            className={`text-xs ${
              isApple ? "text-[#86868B]" : "text-[#8A9990]"
            }`}
          >
            Bklit UI performance dashboards spanning the 4-month syndicate archive with barrier bias and favourite conversion rates.
          </p>
        </div>

        <div
          className={`text-xs font-mono px-3 py-1 rounded border ${
            isApple
              ? "text-[#0071E3] bg-[#F5F5F7] border-[#E5E5EA] font-semibold"
              : "text-[#D4AF37] bg-[#0B110E] border-[#1F2D26]"
          }`}
        >
          {reports.length} Archived Meetings Loaded
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <BklitMetricCard
          title="Active Report Venue"
          value={activeReport?.venue || "Sydney & Melb"}
          subtitle={activeReport?.raceDate || "All Cards"}
          icon={<Archive className="w-4 h-4" />}
          badge={{ label: "Selected", variant: "gold" }}
        />
        <BklitMetricCard
          title="Archive Payouts"
          value={formatDollarReturn(totalArchivePayout)}
          subtitle="Cumulative Payout Across Archive"
          icon={<DollarSign className="w-4 h-4" />}
          badge={{ label: "Historical", variant: "positive" }}
        />
        <BklitMetricCard
          title="Archive Top Score"
          value={`${bestScore} pts`}
          subtitle={`Best Individual Meeting Score`}
          icon={<Trophy className="w-4 h-4" />}
          badge={{ label: "Record", variant: "gold" }}
        />
        <BklitMetricCard
          title="Barrier 1-4 Bias"
          value={`${activeReport?.cardTrackAssessment?.barrierZones?.inside1To4Pct || 42}%`}
          subtitle="Inside Barrier Winner Strike"
          icon={<Award className="w-4 h-4" />}
          badge={{ label: "Barrier Form", variant: "neutral" }}
        />
      </div>

      {/* Visual Tabs */}
      <div
        className={`flex items-center gap-1.5 p-1 rounded-lg border overflow-x-auto text-xs font-mono ${
          isApple
            ? "bg-[#F5F5F7] border-[#E5E5EA]"
            : "bg-[#0B110E] border-[#1F2D26]"
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveVisualTab("archive_trend")}
          className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeVisualTab === "archive_trend"
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
              isApple ? "text-[#0071E3]" : "text-[#10B981]"
            }`}
          />
          Meeting ROI Trend (Area)
        </button>
        <button
          type="button"
          onClick={() => setActiveVisualTab("member_pnl")}
          className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeVisualTab === "member_pnl"
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
              isApple ? "text-[#0071E3]" : "text-[#38BDF8]"
            }`}
          />
          Member Par vs Return (Bar)
        </button>
        <button
          type="button"
          onClick={() => setActiveVisualTab("market_rings")}
          className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeVisualTab === "market_rings"
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
          Barriers &amp; Favs (Rings)
        </button>
        <button
          type="button"
          onClick={() => setActiveVisualTab("reports_table")}
          className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeVisualTab === "reports_table"
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
          Archive Table (Sortable)
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
        {activeVisualTab === "archive_trend" && (
          <div className="space-y-2">
            <div
              className={`flex items-center justify-between text-xs font-mono ${
                isApple ? "text-[#86868B]" : "text-[#8A9990]"
              }`}
            >
              <span
                className={`font-semibold ${
                  isApple ? "text-[#0071E3]" : "text-[#10B981]"
                }`}
              >
                Meeting-by-Meeting Return ($) Across Archive
              </span>
              <span>Spline with Gradient Area</span>
            </div>
            <AreaChart
              data={trendData}
              indexKey="label"
              series={[
                {
                  key: "dollars",
                  label: "Exotic Collects ($)",
                  color: isApple ? "#0071E3" : "#10B981",
                },
                {
                  key: "par",
                  label: "Par Turnover ($)",
                  color: isApple ? "#8E8E93" : "#475569",
                },
              ]}
              height={260}
              valueFormatter={(v) => formatDollarReturn(v)}
              yAxisLabel="Dollars ($)"
            />
          </div>
        )}

        {activeVisualTab === "member_pnl" && (
          <div className="space-y-2">
            <div
              className={`flex items-center justify-between text-xs font-mono ${
                isApple ? "text-[#86868B]" : "text-[#8A9990]"
              }`}
            >
              <span
                className={`font-semibold ${
                  isApple ? "text-[#0071E3]" : "text-[#38BDF8]"
                }`}
              >
                Active Report: Punter Par Outlay vs Payout
              </span>
              <span>Grouped Bar Comparison</span>
            </div>
            <BarChart
              data={punterBarData}
              indexKey="name"
              series={[
                {
                  key: "par",
                  label: "Par Outlay ($)",
                  color: isApple ? "#8E8E93" : "#475569",
                },
                {
                  key: "dollars",
                  label: "Actual Return ($)",
                  color: isApple ? "#0071E3" : "#10B981",
                },
              ]}
              height={260}
              valueFormatter={(v) => formatDollarReturn(v)}
            />
          </div>
        )}

        {activeVisualTab === "market_rings" && (
          <div className="space-y-4">
            <div className="text-xs font-mono text-[#8A9990]">
              <span className="text-[#D4AF37] font-semibold">
                Track Barrier Bias &amp; Favourite Win Strike Rates
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center justify-items-center py-2">
              <div className="flex flex-col items-center">
                <span className="text-xs font-mono text-[#F3F4F0] font-bold mb-2">
                  Barrier Gate Winners Distribution
                </span>
                <RingChart
                  data={barrierSegments}
                  size={180}
                  innerRadiusRatio={0.65}
                  centerTitle={`${barrierSegments.reduce((s, b) => s + b.value, 0)}`}
                  centerSubtitle="Winners"
                  valueFormatter={(v) => `${v}`}
                />
              </div>

              <div className="flex flex-col items-center">
                <span className="text-xs font-mono text-[#F3F4F0] font-bold mb-2">
                  Market Favourites Win Conversion
                </span>
                <RingChart
                  data={favSegments}
                  size={180}
                  innerRadiusRatio={0.65}
                  centerTitle={`${favSegments[0]?.value || 0}`}
                  centerSubtitle="Favs Won"
                  valueFormatter={(v) => `${v}`}
                />
              </div>
            </div>
          </div>
        )}

        {activeVisualTab === "reports_table" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-[#8A9990]">
              <span className="text-[#A855F7] font-semibold">
                Archived Syndicate Race Reports ({reports.length})
              </span>
              <span>Click a report row to load into view</span>
            </div>
            <BklitTable
              columns={reportColumns}
              data={reports}
              keyExtractor={(r) => r.id}
              defaultSortKey="raceDate"
              defaultSortDirection="desc"
              onRowClick={(r) => onSelectReport?.(r.id)}
            />
          </div>
        )}
      </div>
    </div>
  );
};
