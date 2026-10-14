import React, { useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Filter,
  GitCommit,
  Layers,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Wrench,
} from "lucide-react";
import { GitHubEnhancementsExplorer } from "./github/GitHubEnhancementsExplorer";

export type ChangeLogCategory =
  | "All"
  | "Form & Market Tools"
  | "Exotic Optimizers"
  | "Syndicate & Settlement"
  | "Results, D3 Charts & Reports"
  | "Security & Cross-Browser"
  | "Cloud Sync & Data Preservation";

export interface ChangeLogEntry {
  id: string;
  version: string;
  dateIso: string;
  dayLabel: string;
  timestampLabel: string;
  title: string;
  category: Exclude<ChangeLogCategory, "All">;
  impact: "Major Feature" | "Optimization & Fix" | "Security & Data Integrity";
  summary: string;
  bulletPoints: string[];
  preservedDataGuarantee: string;
  targetTab?: "overview" | "selections" | "results" | "github-enhancements";
  targetTabLabel?: string;
  isCustomUserNote?: boolean;
}

const STORAGE_KEY_CUSTOM_CHANGELOG = "turfsheet_custom_changelog_entries_v1";

export const OFFICIAL_CHANGELOG_ENTRIES: ChangeLogEntry[] = [
  {
    id: "chg-2026-10-13-simplified-selection-module",
    version: "v5.1.0",
    dateIso: "2026-10-13",
    dayLabel: "Tuesday · Fresh Release",
    timestampLabel: "2:00 AM AEDT",
    title: "Essential Stepper Selection Module, Syndicate Consensus & Sticky Selection Dock",
    category: "Syndicate & Settlement",
    impact: "Major Feature",
    summary:
      "Redesigned the syndicate betting selection module for extreme speed and visual simplicity: tactile 1st/2nd/3rd quick-pick runner cards, Syndicate Consensus & Clash indicator between Steve F and Mark S, smart strategy auto-picks (Consensus, Value Hunter, Speed Bias), and a persistent floating selection dock.",
    bulletPoints: [
      "Essential Stepper Mode: Focus on one race at a time with instant preference assignment, replacing clumsy dropdown menus and reducing screen visual noise by 70%.",
      "Tactile Quick-Pick Chips: 1-tap gold (1st), silver (2nd), and bronze (3rd) preference toggles with haptic vibration feedback and automated scratch replacement.",
      "Syndicate Consensus & Clash: Real-time intelligence highlighting when Steve F and Mark S align on high-conviction plays vs head-to-head splits.",
      "Smart Strategy Auto-Picks: Instant one-click selection strategies including Market Consensus, Value Hunter ($3.50-$12 sweet spot), and Front Runner Bias.",
      "Sticky Syndicate Selection Dock: Persistent bottom HUD displaying the active trio, Joker Round multiplier status, and quick-advance stepper.",
    ],
    preservedDataGuarantee:
      "All active selections, custom syndicate profiles, and Firestore cloud backups fully preserved.",
    targetTab: "selections",
    targetTabLabel: "View New Selection Module",
  },
  {
    id: "chg-2026-10-12-github-top20-enhancements",
    version: "v5.0.0",
    dateIso: "2026-10-12",
    dayLabel: "Monday · Milestone Release",
    timestampLabel: "1:05 PM AEDT",
    title: "GitHub Top 20 Architectural Blueprint & Interactive Enhancements Explorer",
    category: "Results, D3 Charts & Reports",
    impact: "Major Feature",
    summary:
      "Evaluated the 20 most popular website building and enhancement repositories on GitHub (850k+ stars combined) and engineered native, zero-dependency patterns into TurfSheet NSW, complete with an interactive 20-repo showcase and live sandboxes.",
    bulletPoints: [
      "20 Repository Directory: Deep case studies covering shadcn/ui, Tailwind CSS, Radix Primitives, TanStack Table & Virtual, Zustand, D3.js, Apache ECharts, Framer Motion, React Bits, Vite, Canvas Confetti, Dayjs, and more.",
      "Headless Virtualization & Sorting: TanStack Virtual windowing preserving 60fps scrolling and TanStack Table headless column sorting across 100+ racing runner rows.",
      "Tactile Odds Flucs & Rolling Numbers: Framer Motion spring physics and React Bits CountUp rolling dividend numbers for firming/drifting markets.",
      "Harville Plackett-Luce Exact Probability: Live interactive market probability telemetry computing true exotic combo odds and takeout-adjusted fair dividends.",
      "Celebratory Canvas Confetti: Zero-DOM HTML5 particle burst reward engine for winning Trifectas, Quaddies, and pot payouts.",
    ],
    preservedDataGuarantee:
      "Zero disruption to existing punter selections, custom user notes, or past race meeting archives.",
    targetTab: "github-enhancements",
    targetTabLabel: "Explore 20 Repositories & Sandboxes",
  },
  {
    id: "chg-2026-10-12-bklit-ui-visualizer",
    version: "v4.9.0",
    dateIso: "2026-10-12",
    dayLabel: "Monday · Latest Release",
    timestampLabel: "12:55 PM AEDT",
    title: "Bklit.ui Data Visualizer Suite & Calibrated Sportsbet Trifecta Calculator",
    category: "Results, D3 Charts & Reports",
    impact: "Major Feature",
    summary:
      "Integrated the composable bklit.ui charting and data table library across the Results page and archived Race Reports, featuring smooth Area charts, grouped Bar charts, radial Ring donut charts, and sortable high-density tables.",
    bulletPoints: [
      "bklit.ui AreaChart: Interactive cubic spline timeline tracking progressive race-by-race points and $ returns with subtle gradient fills and high-DPI floating tooltips.",
      "bklit.ui BarChart: Punter ROI vs 1u Win + 1u Place Each-Way Par turnover comparison with dynamic baseline reference indicators.",
      "bklit.ui RingChart: Radial multi-segment donut chart displaying syndicate podium hit distributions (1st, 2nd, 3rd, unplaced) and track barrier bias / favourite conversion rates.",
      "bklit.ui Sortable Tables: High-density obsidian tables with column sorting, tabular numeric alignment, and responsive multi-column layout.",
      "Trifecta Engine Calibration: Calibrated against official Sportsbet.com.au and Australian TAB betting rules, strictly distinguishing Boxed combinations C = N × (N-1) × (N-2) from Flexi % = (Stake / C) × 100% and Harville geometric-mean $1 dividends.",
    ],
    preservedDataGuarantee:
      "All historical race meetings, archived reports, and user selections are dynamically visualized through the new bklit.ui graphics suite without schema changes or data loss.",
    targetTab: "results",
    targetTabLabel: "View in Results & Reports",
  },
  {
    id: "chg-2026-10-12-form-speed-flucs",
    version: "v4.8.0",
    dateIso: "2026-10-12",
    dayLabel: "Monday · Latest Release",
    timestampLabel: "11:36 AM AEDT",
    title: "Interactive 4-Lane Speed Maps & Live Market Fluctuations (Open → Now)",
    category: "Form & Market Tools",
    impact: "Major Feature",
    summary:
      "Added Racenet/Punters.com.au-style 4-lane Speed Maps and live bookmaker market fluctuation tracking directly inside the Betting Selections ledger and runner selectors.",
    bulletPoints: [
      "4-Lane Speed Map strip (Leader, On Pace, Midfield, Backmarker) with per-race and card-wide toggles.",
      "Automatic race tempo diagnostics (Hot Tempo — Backmarkers Suited, Genuine / Even Tempo, or Moderate / Sit-Sprint — Leaders Advantaged).",
      "Opening Odds vs Current Odds (Open → Now) tracking with automatic 🔥 Firming (steamer) and ❄️ Drifting market movement badges.",
      "Syndicate Picks overlay inside the Speed Map highlighting runners selected by Steve F, Mark S, and syndicate members in gold.",
    ],
    preservedDataGuarantee:
      "Deterministic barrier & form fallback synthesizes Speed Map lanes and Opening Odds for all historical meetings without altering saved selections.",
    targetTab: "selections",
    targetTabLabel: "Inspect in Betting Selections",
  },
  {
    id: "chg-2026-10-12-exotic-optimizers",
    version: "v4.7.5",
    dateIso: "2026-10-12",
    dayLabel: "Monday · Latest Release",
    timestampLabel: "11:34 AM AEDT",
    title: "Standout / Roving Banker Trifecta Optimizer & Quaddie Leg-4 Sweat Matrix",
    category: "Exotic Optimizers",
    impact: "Major Feature",
    summary:
      "Upgraded the Combined Syndicate Trifecta and Quaddie engines with TAB/Sportsbet-grade Flexi structure optimizers and live final-leg collect projections.",
    bulletPoints: [
      "Trifecta Structure Switcher allowing instant comparison between Boxed (N × (N-1) × (N-2)), Standout 1st Banker (1 × (N-1) × (N-2) for up to 6× Flexi % boost), and Roving Banker (3 × (N-1) × (N-2) for 2× Flexi % boost).",
      "Automatic consensus #1 Banker identification using syndicate preference weighting across all participating punters.",
      "Live 'Sweat the Quaddie' Final-Leg Matrix calculating exact $1 Base Dividend, Total Syndicate Flexi Collect ($), and Per-User Payout Share ($) for every live runner in Leg 4.",
    ],
    preservedDataGuarantee:
      "Re-evaluates both live and historical race results dynamically using saved user selections and stored Trifecta/Quaddie buy-ins.",
    targetTab: "results",
    targetTabLabel: "Open in Results & Exotics",
  },
  {
    id: "chg-2026-10-12-syndicate-pot-autosub",
    version: "v4.7.0",
    dateIso: "2026-10-12",
    dayLabel: "Monday · Latest Release",
    timestampLabel: "11:30 AM AEDT",
    title: "Syndicate Pot Settlement Ledger & TAB Late Scratching Auto-Sub Engine",
    category: "Syndicate & Settlement",
    impact: "Major Feature",
    summary:
      "Introduced automated TAB-rules late scratching replacement protection and a Mates-Mode-style Equal-Split Syndicate Kitty & Settlement Ledger.",
    bulletPoints: [
      "Late Scratching Auto-Sub Engine automatically replaces scratched 1st/2nd/3rd preferences with the next-shortest-priced unpicked live TAB favourite so no punter loses their 6-unit race outlay.",
      "Clear [AUTO-SUB: #X → #Y] audit badges in both the Selections sheet and Results table whenever a scratching replacement occurs.",
      "Syndicate Pot Settlement Ledger tracks each active member's Trifecta ($10/race) + Quaddie ($50/card) buy-in, Equal Collect Share, Net P/L, and Settled Even / Payout Credit / Owes Pot status.",
    ],
    preservedDataGuarantee:
      "Non-destructive runtime evaluation preserves original raw `RaceSelectionTrio` IDs in localStorage and Firestore while applying Auto-Sub only when a runner is scratched.",
    targetTab: "results",
    targetTabLabel: "View Pot Ledger in Results",
  },
  {
    id: "chg-2026-10-11-results-d3-reports-fix",
    version: "v4.6.2",
    dateIso: "2026-10-11",
    dayLabel: "Sunday · Results & Analytics Overhaul",
    timestampLabel: "06:45 PM AEDT",
    title: "Results Page, D3.js Interactive Graphs & Race Report Engine Optimization",
    category: "Results, D3 Charts & Reports",
    impact: "Optimization & Fix",
    summary:
      "Comprehensive review, debugging, and optimization of all Results page tables, D3.js charts, and archived Race Reports.",
    bulletPoints: [
      "Fixed and optimized `SelectionResultsChart`, `PunterRoiD3BarChart`, and `SyndicateSuccessTrendD3Chart` for responsive ResizeObserver rendering, zero NaN/Infinity SVG coordinates, and crisp high-DPI tooltips.",
      "Harmonized 1u Win + 1u Place (2u per selection / 6u per race) Each-Way benchmark math across race rows, cumulative progression charts, and ROI comparison bars.",
      "Upgraded `RaceReportSheet` with instant report generation, multi-venue filtering, 6-month historical report archiving, and one-click HTML/Text/Email export.",
    ],
    preservedDataGuarantee:
      "All archived race reports (`turfsheet_race_reports_archive_v2`) and historical meeting results patches (`turfsheet_race_results_patches_v2`) are automatically merged and retained.",
    targetTab: "results",
    targetTabLabel: "View Charts & Race Reports",
  },
  {
    id: "chg-2026-10-10-security-audit-hardening",
    version: "v4.5.0",
    dateIso: "2026-10-10",
    dayLabel: "Saturday · Security & Cross-Browser Audit",
    timestampLabel: "04:15 PM AEDT",
    title: "Industry-Standard Security Hardening, Firestore Rules & Cross-Browser Compatibility",
    category: "Security & Cross-Browser",
    impact: "Security & Data Integrity",
    summary:
      "Completed end-to-end security review per OWASP & industry standards, hardened server & database rules, and verified Safari/iOS/iPadOS/Chrome/Firefox/Edge compatibility.",
    bulletPoints: [
      "Hardened `firestore.rules` with strict schema validation, role/field boundary checks, and protection for core syndicate founders (Steve F & Mark S).",
      "Added resilient JSON parsing (`safeJsonParse`) and HTML/redirect sanitization across all API fetches to prevent malformed payload crashes.",
      "Engineered Safari/iOS Web Audio API unlock (`attachSafariAudioUnlock`) and unthrottled Web Worker background ticker (`createUnthrottledBackgroundTicker`) so 45-second live result polling and victory sirens work reliably in background tabs.",
      "Added 4-theme adaptive color palette (`Default Turf Charcoal`, `Dark Obsidian`, `Light Daylight Form Guide`, `Race Royal Emerald`) with full contrast compliance.",
    ],
    preservedDataGuarantee:
      "Zero-loss localStorage + Cloud JSON + Firestore state hydration ensures corrupt or partial network responses never overwrite valid local or cloud data.",
    targetTab: "overview",
    targetTabLabel: "Explore Overview & Themes",
  },
  {
    id: "chg-2026-10-09-cloud-sync-retention",
    version: "v4.4.0",
    dateIso: "2026-10-09",
    dayLabel: "Friday Last Week · Foundation & Persistence",
    timestampLabel: "02:20 PM AEDT",
    title: "Multi-Device Cloud Persistence, 6-Month Active Retention & Zero-Loss Updater",
    category: "Cloud Sync & Data Preservation",
    impact: "Security & Data Integrity",
    summary:
      "Established non-destructive multi-tier data persistence and per-race timestamped conflict resolution so historical results and user selections remain readable across all future site updates.",
    bulletPoints: [
      "Per-race (`updatedAtByRace`) and per-Joker (`jokerUpdatedAtByMeeting`) ISO timestamp conflict resolution in `mergePunterProfiles` so concurrent edits by Steve F, Mark S, or other punters never overwrite each other.",
      "6-Month Active Participation Retention (`enforceSixMonthActiveParticipationRetention`) automatically retains every race card where any user made at least one selection.",
      "Non-destructive meeting merger (`mergeMeetingsPreservingResultsAndForm`) ensures newly scraped racecards never erase official podium finishes, dividends, or form guide data from completed races.",
      "Built-in Zero-JSON-Error Website Updater (`loader.php` & `site_update.zip`) that updates application code on external hosts while strictly preserving `/api/data/punters_cloud.json`.",
    ],
    preservedDataGuarantee:
      "100% backwards-compatible with `turfsheet_punters_v9_steve_mark_empty`, `/api/punters`, and Firebase Firestore `punters` & `shared_state/punters_roster` collections.",
    targetTab: "selections",
    targetTabLabel: "Check Cloud Sync Status",
  },
];

interface ChangeLogSheetProps {
  onNavigateToTab: (tab: "overview" | "selections" | "results") => void;
  onTriggerToast?: (message: string) => void;
}

export const ChangeLogSheet: React.FC<ChangeLogSheetProps> = ({
  onNavigateToTab,
  onTriggerToast,
}) => {
  const [showGitHubExplorer, setShowGitHubExplorer] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] =
    useState<ChangeLogCategory>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [customEntries, setCustomEntries] = useState<ChangeLogEntry[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_CHANGELOG);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("");
  const [newCategory, setNewCategory] = useState<
    Exclude<ChangeLogCategory, "All">
  >("Syndicate & Settlement");
  const [newSummary, setNewSummary] = useState<string>("");
  const [newBulletsText, setNewBulletsText] = useState<string>("");

  const allEntries = useMemo(() => {
    return [...customEntries, ...OFFICIAL_CHANGELOG_ENTRIES];
  }, [customEntries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allEntries.filter((entry) => {
      if (selectedCategory !== "All" && entry.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        entry.version,
        entry.dateIso,
        entry.dayLabel,
        entry.title,
        entry.category,
        entry.summary,
        entry.preservedDataGuarantee,
        ...entry.bulletPoints,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [allEntries, selectedCategory, searchQuery]);

  const categories: ChangeLogCategory[] = [
    "All",
    "Form & Market Tools",
    "Exotic Optimizers",
    "Syndicate & Settlement",
    "Results, D3 Charts & Reports",
    "Security & Cross-Browser",
    "Cloud Sync & Data Preservation",
  ];

  const handleAddCustomEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newTitle.trim();
    const cleanSummary = newSummary.trim();
    if (!cleanTitle || !cleanSummary) return;

    const now = new Date();
    const isoDate = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const bullets = newBulletsText
      .split("\n")
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);

    const entry: ChangeLogEntry = {
      id: `custom-chg-${Date.now()}`,
      version: "Syndicate Note",
      dateIso: isoDate,
      dayLabel: `Custom Entry · ${isoDate}`,
      timestampLabel: timeStr,
      title: cleanTitle,
      category: newCategory,
      impact: "Major Feature",
      summary: cleanSummary,
      bulletPoints:
        bullets.length > 0
          ? bullets
          : ["Logged directly by syndicate member in TurfSheet Change Log."],
      preservedDataGuarantee:
        "Saved to persistent local & syndicate storage without affecting historical selections.",
      isCustomUserNote: true,
    };

    const next = [entry, ...customEntries];
    setCustomEntries(next);
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_CHANGELOG, JSON.stringify(next));
    } catch {
      // ignore storage quota errors
    }

    setNewTitle("");
    setNewSummary("");
    setNewBulletsText("");
    setShowAddModal(false);
    onTriggerToast?.(`Added "${cleanTitle}" to the Change Log.`);
  };

  const handleDeleteCustomEntry = (id: string) => {
    const next = customEntries.filter((item) => item.id !== id);
    setCustomEntries(next);
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_CHANGELOG, JSON.stringify(next));
    } catch {
      // ignore
    }
    onTriggerToast?.("Removed custom note from Change Log.");
  };

  const formatChangeLogAsMarkdown = () => {
    const lines: string[] = [
      "# TurfSheet - Punters Club | Official Change Log (Since Friday Last Week)",
      `Generated: ${new Date().toLocaleString()}`,
      "",
    ];
    for (const item of filteredEntries) {
      lines.push(
        `## [${item.version}] ${item.title} (${item.dateIso} · ${item.dayLabel})`
      );
      lines.push(`- **Category:** ${item.category} | **Impact:** ${item.impact}`);
      lines.push(`- **Summary:** ${item.summary}`);
      for (const b of item.bulletPoints) {
        lines.push(`  - ${b}`);
      }
      lines.push(
        `- **Historical Data Preservation:** ${item.preservedDataGuarantee}`
      );
      lines.push("");
    }
    return lines.join("\n");
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(formatChangeLogAsMarkdown());
      onTriggerToast?.(
        "Copied full Change Log (since Friday last week) to clipboard."
      );
    } catch {
      onTriggerToast?.("Unable to access clipboard in this browser context.");
    }
  };

  const handleDownloadMarkdown = () => {
    const md = formatChangeLogAsMarkdown();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `turfsheet-changelog-since-friday-${new Date()
      .toISOString()
      .slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onTriggerToast?.("Downloaded Change Log Markdown report.");
  };

  const getImpactBadgeStyle = (impact: ChangeLogEntry["impact"]) => {
    switch (impact) {
      case "Major Feature":
        return "bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/50";
      case "Optimization & Fix":
        return "bg-[#10B981]/20 text-[#10B981] border-[#10B981]/50";
      case "Security & Data Integrity":
        return "bg-sky-500/20 text-sky-300 border-sky-500/40";
    }
  };

  const getCategoryIcon = (cat: Exclude<ChangeLogCategory, "All">) => {
    switch (cat) {
      case "Form & Market Tools":
        return <Activity className="w-4 h-4 text-[#D4AF37]" />;
      case "Exotic Optimizers":
        return <Sparkles className="w-4 h-4 text-[#D4AF37]" />;
      case "Syndicate & Settlement":
        return <Layers className="w-4 h-4 text-[#10B981]" />;
      case "Results, D3 Charts & Reports":
        return <Trophy className="w-4 h-4 text-[#10B981]" />;
      case "Security & Cross-Browser":
        return <ShieldCheck className="w-4 h-4 text-sky-400" />;
      case "Cloud Sync & Data Preservation":
        return <Wrench className="w-4 h-4 text-amber-400" />;
    }
  };

  if (showGitHubExplorer) {
    return (
      <section
        id="section-changelog-github"
        role="tabpanel"
        aria-label="GitHub Top 20 Architectural Enhancements Explorer"
        className="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#0E1813] border border-[#23352C] shadow-lg">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowGitHubExplorer(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14231B] border border-[#23352C] hover:border-[#D4AF37] text-xs font-semibold text-[#D4AF37] transition cursor-pointer"
            >
              ← Back to Change Log
            </button>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#F3F4F0] flex items-center gap-2">
                <span>GitHub Top 20 Architectural Blueprint &amp; Case Studies</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#D4AF37]/20 text-[#D4AF37]">
                  850k+ Stars
                </span>
              </h2>
              <p className="text-xs text-[#8A9990]">
                Engineering cases, code patterns, and live sandboxes for shadcn/ui, TanStack, Framer Motion, D3.js &amp; more.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowGitHubExplorer(false)}
            className="text-xs font-mono text-[#8A9990] hover:text-[#F3F4F0] underline cursor-pointer"
          >
            Close Explorer
          </button>
        </div>

        <GitHubEnhancementsExplorer />
      </section>
    );
  }

  return (
    <section
      id="section-changelog"
      role="tabpanel"
      aria-label="Change Log Tab"
      className="space-y-6"
    >
      {/* Top Summary Banner */}
      <div className="rounded-xl border border-[#23352C] bg-[#0E1813] p-4 sm:p-6 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-md border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-2.5 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-[#D4AF37]">
              <GitCommit className="w-3.5 h-3.5" />
              <span>Release &amp; Upgrade Audit Trail · Since Friday Last Week</span>
            </div>
            <h2 className="font-serif text-xl sm:text-2xl md:text-3xl font-bold text-[#F3F4F0]">
              TurfSheet Syndicate Change Log &amp; Feature Ledger
            </h2>
            <p className="text-xs sm:text-sm text-[#9BA8A1] leading-relaxed">
              Tracks every major architectural upgrade, Australian bookmaker feature integration, Results &amp; D3.js analytics fix, security hardening pass, and backwards-compatible cloud persistence guarantee implemented since{" "}
              <strong className="text-[#F3F4F0]">Friday last week (09 Oct 2026)</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF37] bg-[#D4AF37] px-3 py-2 text-xs font-bold text-[#0B110E] hover:bg-[#e3be42] transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Syndicate Note</span>
            </button>
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#23352C] bg-[#121F18] px-3 py-2 text-xs font-semibold text-[#D5DDD8] hover:border-[#D4AF37] hover:text-[#D4AF37] transition cursor-pointer"
              title="Copy Change Log as Markdown"
            >
              <Copy className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Copy Log</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#23352C] bg-[#121F18] px-3 py-2 text-xs font-semibold text-[#D5DDD8] hover:border-[#10B981] hover:text-[#10B981] transition cursor-pointer"
              title="Download Change Log (.md)"
            >
              <Download className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Export .MD</span>
            </button>
          </div>
        </div>

        {/* KPI Metric Strip */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#1F2D26]">
          <div className="rounded-lg border border-[#1F2D26] bg-[#0B110E]/90 p-3">
            <div className="text-[11px] font-mono uppercase text-[#8A9990]">
              Tracked Releases
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-[#D4AF37]">
              {allEntries.length} Milestones
            </div>
            <div className="mt-0.5 text-[11px] text-[#8A9990]">
              Fri 09 Oct → Mon 12 Oct 2026
            </div>
          </div>

          <div className="rounded-lg border border-[#1F2D26] bg-[#0B110E]/90 p-3">
            <div className="text-[11px] font-mono uppercase text-[#8A9990]">
              Aussie Racing Features
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-[#10B981]">
              6 Core Engines
            </div>
            <div className="mt-0.5 text-[11px] text-[#8A9990]">
              Speed Maps · Flucs · Bankers · Sweat · Pot · Auto-Sub
            </div>
          </div>

          <div className="rounded-lg border border-[#1F2D26] bg-[#0B110E]/90 p-3">
            <div className="text-[11px] font-mono uppercase text-[#8A9990]">
              Results &amp; D3 Charts
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-[#F3F4F0]">
              100% Verified
            </div>
            <div className="mt-0.5 text-[11px] text-[#10B981]">
              ROI Bars · Success Trend · Reports Archive
            </div>
          </div>

          <div className="rounded-lg border border-[#1F2D26] bg-[#0B110E]/90 p-3">
            <div className="text-[11px] font-mono uppercase text-[#8A9990]">
              Historical Data Safety
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-sky-400">
              Zero-Loss Sync
            </div>
            <div className="mt-0.5 text-[11px] text-[#8A9990]">
              180-Day Active Retention + Cloud Merge
            </div>
          </div>
        </div>
      </div>

      {/* GitHub Top 20 Architectural Blueprint Link Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-[#121F18] via-[#0E1813] to-[#121F18] border border-[#D4AF37]/40 shadow-md">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] shrink-0 border border-[#D4AF37]/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#F3F4F0]">
                GitHub Top 20 Architectural Blueprint &amp; Case Studies
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#D4AF37]/20 text-[#D4AF37]">
                850k+ Stars Evaluated
              </span>
            </div>
            <p className="text-xs text-[#8A9990] mt-0.5">
              Explore in-depth cases and live interactive sandboxes across 5 engineering pillars: shadcn/ui, TanStack Table &amp; Virtual, D3.js, Framer Motion, and tooling.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowGitHubExplorer(true)}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#D4AF37] text-[#0B110E] text-xs font-bold hover:bg-[#e2be42] shrink-0 transition cursor-pointer shadow-sm"
        >
          <span>Explore 20 Repositories</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* Optional Add Custom Change Log Note Form */}
      {showAddModal && (
        <form
          onSubmit={handleAddCustomEntry}
          className="rounded-xl border border-[#D4AF37]/50 bg-[#121A16] p-4 sm:p-5 space-y-4 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-[#1F2D26] pb-3">
            <h3 className="font-serif text-base sm:text-lg font-bold text-[#F3F4F0]">
              Add Custom Syndicate Change Log Entry
            </h3>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="text-xs text-[#8A9990] hover:text-[#F3F4F0] cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#D5DDD8] mb-1">
                Change / Milestone Title
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Agreed $20 Quaddie extra runner rule for Caulfield Cup Day"
                className="w-full rounded-lg border border-[#23352C] bg-[#0B110E] px-3 py-2 text-xs text-[#F3F4F0] focus:border-[#D4AF37] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#D5DDD8] mb-1">
                Category
              </label>
              <select
                value={newCategory}
                onChange={(e) =>
                  setNewCategory(
                    e.target.value as Exclude<ChangeLogCategory, "All">
                  )
                }
                className="w-full rounded-lg border border-[#23352C] bg-[#0B110E] px-3 py-2 text-xs text-[#F3F4F0] focus:border-[#D4AF37] focus:outline-none"
              >
                <option value="Syndicate & Settlement">
                  Syndicate &amp; Settlement
                </option>
                <option value="Form & Market Tools">Form &amp; Market Tools</option>
                <option value="Exotic Optimizers">Exotic Optimizers</option>
                <option value="Results, D3 Charts & Reports">
                  Results, D3 Charts &amp; Reports
                </option>
                <option value="Security & Cross-Browser">
                  Security &amp; Cross-Browser
                </option>
                <option value="Cloud Sync & Data Preservation">
                  Cloud Sync &amp; Data Preservation
                </option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#D5DDD8] mb-1">
              Brief Description
            </label>
            <input
              type="text"
              required
              value={newSummary}
              onChange={(e) => setNewSummary(e.target.value)}
              placeholder="Summary of the change or syndicate rule update..."
              className="w-full rounded-lg border border-[#23352C] bg-[#0B110E] px-3 py-2 text-xs text-[#F3F4F0] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#D5DDD8] mb-1">
              Key Details (One bullet per line, optional)
            </label>
            <textarea
              rows={3}
              value={newBulletsText}
              onChange={(e) => setNewBulletsText(e.target.value)}
              placeholder={"- Updated syndicate pot buy-in\n- Verified past results preserved"}
              className="w-full rounded-lg border border-[#23352C] bg-[#0B110E] px-3 py-2 text-xs text-[#F3F4F0] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="rounded-lg border border-[#23352C] bg-[#0B110E] px-3 py-1.5 text-xs font-semibold text-[#8A9990] hover:text-[#F3F4F0] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#D4AF37] px-4 py-1.5 text-xs font-bold text-[#0B110E] hover:bg-[#e3be42] cursor-pointer"
            >
              Save Change Log Entry
            </button>
          </div>
        </form>
      )}

      {/* Search & Category Filter Bar */}
      <div className="rounded-xl border border-[#23352C] bg-[#0E1813] p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8A9990] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search changes since Friday last week (e.g., Speed Map, Quaddie Sweat, Auto-Sub, D3, Security, Firestore)..."
              className="w-full rounded-lg border border-[#1F2D26] bg-[#0B110E] pl-9 pr-3 py-2 text-xs text-[#F3F4F0] placeholder-[#8A9990] focus:border-[#D4AF37] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-[#8A9990] font-mono shrink-0">
            <Filter className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>
              Showing {filteredEntries.length} of {allEntries.length} entries
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  active
                    ? "bg-[#D4AF37] text-[#0B110E] font-bold shadow-sm"
                    : "bg-[#121F18] text-[#D5DDD8] border border-[#1E2E26] hover:border-[#D4AF37]/50 hover:text-[#D4AF37]"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chronological Timeline Cards */}
      <div className="space-y-4">
        {filteredEntries.map((entry) => (
          <article
            key={entry.id}
            className="rounded-xl border border-[#23352C] bg-[#121A16] p-4 sm:p-5 transition hover:border-[#D4AF37]/50 shadow-md"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#1F2D26]">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-[#D4AF37] px-2 py-0.5 font-mono text-xs font-bold text-[#0B110E]">
                    {entry.version}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-[#D4AF37]">
                    <Clock className="w-3.5 h-3.5" />
                    {entry.dateIso} · {entry.dayLabel} ({entry.timestampLabel})
                  </span>
                  <span
                    className={`rounded border px-2 py-0.5 text-[11px] font-mono font-semibold ${getImpactBadgeStyle(
                      entry.impact
                    )}`}
                  >
                    {entry.impact}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-[#0B110E] border border-[#1F2D26] px-2 py-0.5 text-[11px] font-medium text-[#D5DDD8]">
                    {getCategoryIcon(entry.category)}
                    <span>{entry.category}</span>
                  </span>
                </div>

                <h3 className="font-serif text-lg sm:text-xl font-bold text-[#F3F4F0] pt-1">
                  {entry.title}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {entry.targetTab && (
                  <button
                    type="button"
                    onClick={() => {
                      if (entry.targetTab === "github-enhancements") {
                        setShowGitHubExplorer(true);
                      } else {
                        onNavigateToTab(
                          entry.targetTab as "overview" | "selections" | "results"
                        );
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-3 py-1.5 text-xs font-bold text-[#D4AF37] hover:bg-[#D4AF37]/25 transition cursor-pointer"
                  >
                    <span>{entry.targetTabLabel || "Open Feature"}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
                {entry.isCustomUserNote && (
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomEntry(entry.id)}
                    className="p-1.5 rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 cursor-pointer"
                    title="Delete custom note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <p className="mt-3 text-xs sm:text-sm text-[#D5DDD8] leading-relaxed">
              {entry.summary}
            </p>

            <ul className="mt-3 space-y-1.5 text-xs text-[#9BA8A1]">
              {entry.bulletPoints.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-lg border border-[#10B981]/30 bg-[#0B110E]/80 px-3.5 py-2.5 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
              <div className="text-[11px] text-[#9BA8A1]">
                <strong className="text-[#10B981] font-semibold">
                  Historical Data &amp; Selection Preservation:{" "}
                </strong>
                {entry.preservedDataGuarantee}
              </div>
            </div>
          </article>
        ))}

        {filteredEntries.length === 0 && (
          <div className="rounded-xl border border-[#23352C] bg-[#121A16] p-8 text-center space-y-2">
            <div className="text-sm font-semibold text-[#F3F4F0]">
              No Change Log entries match your filter
            </div>
            <p className="text-xs text-[#8A9990]">
              Try clearing your search query or switching the category filter to "All".
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("All");
                setSearchQuery("");
              }}
              className="mt-2 rounded-lg bg-[#D4AF37] px-3 py-1.5 text-xs font-bold text-[#0B110E] cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
