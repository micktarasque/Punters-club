import React, { useState, useMemo } from "react";
import {
  Search,
  Sparkles,
  Layers,
  Table as TableIcon,
  BarChart3,
  Activity,
  Wrench,
  Star,
  Check,
  Copy,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Zap,
  Award,
  ChevronDown,
  ChevronUp,
  Play
} from "lucide-react";
import { GITHUB_TOP_20_REPOSITORIES, GitHubRepoItem } from "./repoData";
import { triggerConfetti } from "./confettiUtil";

export function GitHubEnhancementsExplorer() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"directory" | "sandboxes" | "matrix">("directory");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- Interactive Sandbox States ---
  // Sandbox 1: Virtual Table & Sorting state
  const [sortField, setSortField] = useState<string>("odds");
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [runnerSearch, setRunnerSearch] = useState<string>("");

  // Sandbox 2: Tactile Odds Flucs & Rolling Numbers
  const [simulatedOdds, setSimulatedOdds] = useState<number>(3.8);
  const [oddsFlucHistory, setOddsFlucHistory] = useState<number[]>([4.6, 4.2, 3.8]);
  const [flucDirection, setFlucDirection] = useState<"firm" | "drift">("firm");

  // Sandbox 3: D3 Harville Probability Calculation
  const [favoriteOdds, setFavoriteOdds] = useState<number>(2.5);
  const [secondOdds, setSecondOdds] = useState<number>(4.2);
  const [thirdOdds, setThirdOdds] = useState<number>(6.5);

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredRepos = useMemo(() => {
    return GITHUB_TOP_20_REPOSITORIES.filter((item) => {
      const matchesCat = selectedCategory === "all" || item.category === selectedCategory;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.repo.toLowerCase().includes(q) ||
        item.tagline.toLowerCase().includes(q) ||
        item.turfSheetCase.problem.toLowerCase().includes(q) ||
        item.turfSheetCase.concreteFeatureOnSite.toLowerCase().includes(q) ||
        item.turfSheetCase.impactArea.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  // Simulated Runners for TanStack Virtual & Table Sandbox
  const SAMPLE_RUNNERS = [
    { num: 1, name: "THINK ABOUT IT", barrier: 4, weight: 58.5, form: "11x21", odds: 3.2, change: -0.6 },
    { num: 2, name: "I WISH I WIN", barrier: 1, weight: 58.5, form: "31x32", odds: 4.4, change: +0.4 },
    { num: 3, name: "PRIVATE EYE", barrier: 9, weight: 58.5, form: "22x41", odds: 6.5, change: -0.5 },
    { num: 4, name: "MAZU", barrier: 11, weight: 58.5, form: "43x53", odds: 11.0, change: +1.5 },
    { num: 5, name: "OVERPASS", barrier: 2, weight: 58.5, form: "12x11", odds: 7.0, change: 0.0 },
    { num: 6, name: "BUENOS NOCHES", barrier: 8, weight: 58.5, form: "21x74", odds: 14.0, change: +2.0 },
    { num: 7, name: "HAWAII FIVE OH", barrier: 6, weight: 58.5, form: "31x12", odds: 8.5, change: -1.0 },
    { num: 8, name: "ALCOHOL FREE", barrier: 5, weight: 56.5, form: "00x45", odds: 26.0, change: +4.0 },
    { num: 9, name: "IN SECRET", barrier: 12, weight: 56.5, form: "14x24", odds: 9.0, change: -0.5 },
    { num: 10, name: "ESPERIONA", barrier: 3, weight: 56.5, form: "11x11", odds: 5.5, change: -1.2 },
    { num: 11, name: "SHINZO", barrier: 10, weight: 53.0, form: "11x90", odds: 18.0, change: +3.0 },
    { num: 12, name: "CYLINDER", barrier: 7, weight: 53.0, form: "11x35", odds: 13.0, change: -0.8 }
  ];

  const sortedRunners = useMemo(() => {
    return [...SAMPLE_RUNNERS]
      .filter((r) => !runnerSearch || r.name.toLowerCase().includes(runnerSearch.toLowerCase()))
      .sort((a, b) => {
        const valA = (a as Record<string, any>)[sortField];
        const valB = (b as Record<string, any>)[sortField];
        if (typeof valA === "string") {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? valA - valB : valB - valA;
      });
  }, [sortField, sortAsc, runnerSearch]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Simulate market move
  const triggerMarketMove = (direction: "firm" | "drift") => {
    const delta = direction === "firm" ? -0.2 : +0.3;
    const nextOdds = Math.max(1.2, +(simulatedOdds + delta).toFixed(2));
    setSimulatedOdds(nextOdds);
    setOddsFlucHistory((prev) => [...prev.slice(-4), nextOdds]);
    setFlucDirection(direction);
  };

  // Harville Plackett-Luce Exact Probability Calculation
  const harvilleProbabilities = useMemo(() => {
    const p1 = 1 / favoriteOdds;
    const p2 = 1 / secondOdds;
    const p3 = 1 / thirdOdds;
    const sum = p1 + p2 + p3;
    // Normalize to 100%
    const normP1 = p1 / sum;
    const normP2 = p2 / sum;
    const normP3 = p3 / sum;

    // Harville Exact 1-2-3 Trifecta Combo Probability
    // P(1 then 2 then 3) = P(1) * [P(2)/(1-P(1))] * [P(3)/(1-P(1)-P(2))]
    const trifectaProb = normP1 * (normP2 / (1 - normP1)) * (normP3 / (1 - normP1 - normP2));
    const fairDividend = trifectaProb > 0 ? +(1 / trifectaProb).toFixed(1) : 0;

    return {
      p1Pct: (normP1 * 100).toFixed(1),
      p2Pct: (normP2 * 100).toFixed(1),
      p3Pct: (normP3 * 100).toFixed(1),
      trifectaProbPct: (trifectaProb * 100).toFixed(2),
      fairDividend
    };
  }, [favoriteOdds, secondOdds, thirdOdds]);

  return (
    <div className="space-y-6">
      {/* 1. Hero Architectural Header */}
      <div className="relative overflow-hidden rounded-2xl border border-[#1A2A20] bg-gradient-to-br from-[#0B140F] via-[#080D0A] to-[#040806] p-6 text-slate-100 shadow-2xl">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-950/60 text-emerald-400">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  GitHub Top 20 Architectural Enhancements
                </h2>
                <p className="text-xs text-slate-400">
                  Engineering Case Study &amp; Live Pattern Integration for TurfSheet NSW
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => triggerConfetti()}
                className="flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-all hover:border-amber-400 hover:bg-amber-900/60 active:scale-95"
              >
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span>Test Confetti Burst (Canvas Confetti)</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Ribbon */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
            <div className="rounded-xl border border-[#1A2820] bg-[#0E1712]/80 p-3">
              <div className="text-xs text-slate-400">Repositories Evaluated</div>
              <div className="font-mono text-xl font-bold text-white tabular-nums">20 Top-Starred</div>
              <div className="text-[11px] text-emerald-400">All 5 Core Pillars</div>
            </div>
            <div className="rounded-xl border border-[#1A2820] bg-[#0E1712]/80 p-3">
              <div className="text-xs text-slate-400">Total Community Stars</div>
              <div className="font-mono text-xl font-bold text-amber-400 tabular-nums">850,000+ ★</div>
              <div className="text-[11px] text-slate-400">Battle-Tested Standards</div>
            </div>
            <div className="rounded-xl border border-[#1A2820] bg-[#0E1712]/80 p-3">
              <div className="text-xs text-slate-400">Integration Method</div>
              <div className="font-mono text-xl font-bold text-emerald-300 tabular-nums">Native Zero-Lockin</div>
              <div className="text-[11px] text-slate-400">Tailwind &amp; React Primitives</div>
            </div>
            <div className="rounded-xl border border-[#1A2820] bg-[#0E1712]/80 p-3">
              <div className="text-xs text-slate-400">Key Performance Target</div>
              <div className="font-mono text-xl font-bold text-cyan-300 tabular-nums">Locked 60 FPS</div>
              <div className="text-[11px] text-slate-400">Virtual Windowing Ready</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Primary Navigation Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-[#1A2820] pb-4">
        {/* Tab Switcher */}
        <div className="flex items-center gap-1 rounded-xl border border-[#1A2820] bg-[#0A100C] p-1">
          <button
            onClick={() => setActiveTab("directory")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === "directory"
                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>20 Repositories Directory</span>
          </button>
          <button
            onClick={() => setActiveTab("sandboxes")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === "sandboxes"
                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Play className="h-3.5 w-3.5" />
            <span>Interactive Live Sandboxes (4)</span>
          </button>
          <button
            onClick={() => setActiveTab("matrix")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
              activeTab === "matrix"
                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <TableIcon className="h-3.5 w-3.5" />
            <span>Comparison Matrix</span>
          </button>
        </div>

        {/* Global Search Input */}
        <div className="relative min-w-[260px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search repo, feature, or benefit..."
            className="w-full rounded-lg border border-[#1A2820] bg-[#0E1612] pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* 3. CONTENT VIEW A: REPOSITORY DIRECTORY */}
      {activeTab === "directory" && (
        <div className="space-y-5">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-400 mr-1 text-[11px] uppercase tracking-wider font-semibold">Filter:</span>
            {[
              { id: "all", label: "All 20 Repositories", count: 20 },
              { id: "ui", label: "UI & Component Systems", count: 5 },
              { id: "tables", label: "Tables & State", count: 5 },
              { id: "charts", label: "Data Visualization", count: 4 },
              { id: "motion", label: "Animation & Motion", count: 3 },
              { id: "tooling", label: "Export & Tooling", count: 3 }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-lg px-2.5 py-1 font-medium transition-all ${
                  selectedCategory === cat.id
                    ? "bg-emerald-600 text-white font-semibold shadow-sm"
                    : "bg-[#0E1712] text-slate-400 hover:bg-[#14231B] hover:text-slate-200 border border-[#1A2820]"
                }`}
              >
                {cat.label} ({cat.count})
              </button>
            ))}
          </div>

          {/* Repositories Grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredRepos.map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col justify-between rounded-xl border border-[#1B2B21] bg-[#0C130F] p-5 transition-all hover:border-emerald-500/60 hover:shadow-[0_4px_25px_rgba(16,185,129,0.06)]"
              >
                {/* Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition-colors">
                          {item.name}
                        </h3>
                        <a
                          href={`https://github.com/${item.repo}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-0.5 text-[11px] font-mono text-slate-400 hover:text-emerald-400"
                        >
                          <span>{item.repo}</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{item.tagline}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-950/40 px-2 py-0.5 text-xs font-mono font-bold text-amber-300">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span>{item.stars}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.maintainer} · {item.license}
                      </span>
                    </div>
                  </div>

                  {/* Strengths list */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {item.keyStrengths.map((str, i) => (
                      <span
                        key={i}
                        className="rounded border border-[#1F2F25] bg-[#0E1813] px-2 py-0.5 text-[11px] text-slate-300 font-mono"
                      >
                        {str}
                      </span>
                    ))}
                  </div>

                  {/* TurfSheet Case Study Block */}
                  <div className="rounded-lg border border-emerald-950 bg-[#08100C] p-3 space-y-2 mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-emerald-400">TurfSheet Application Case</span>
                      <span className="rounded bg-emerald-950 px-1.5 py-0.2 text-[10px] font-mono text-emerald-300 border border-emerald-800/40">
                        Impact: {item.turfSheetCase.impactArea}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300">
                      <span className="text-slate-400 font-medium">Problem: </span>
                      {item.turfSheetCase.problem}
                    </div>
                    <div className="text-xs text-slate-300">
                      <span className="text-emerald-400/90 font-medium">Solution: </span>
                      {item.turfSheetCase.solution}
                    </div>
                    <div className="text-xs text-slate-400 pt-1 border-t border-[#132219]">
                      <span className="text-amber-400/90 font-medium">Concrete Feature: </span>
                      <span className="text-slate-300">{item.turfSheetCase.concreteFeatureOnSite}</span>
                    </div>
                  </div>
                </div>

                {/* Footer: Code snippet expander & demo button */}
                <div className="mt-4 pt-3 border-t border-[#16231B] flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 font-mono">
                    Benefit: {item.turfSheetCase.measurableBenefit}
                  </span>
                  <button
                    onClick={() => copyCode(item.id, item.codePatternPreview)}
                    className="flex items-center gap-1 rounded border border-[#23382C] bg-[#111A15] px-2.5 py-1 text-[11px] text-slate-300 hover:border-emerald-500 hover:text-white transition-all shrink-0"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Pattern</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. CONTENT VIEW B: INTERACTIVE LIVE SANDBOXES */}
      {activeTab === "sandboxes" && (
        <div className="space-y-6">
          {/* SANDBOX 1: TanStack Table & Virtualization */}
          <div className="rounded-xl border border-[#1A2820] bg-[#0B120E] p-5 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1A2820] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-emerald-950 px-2 py-0.5 text-xs font-mono font-bold text-emerald-400 border border-emerald-800">
                    Demo 1
                  </span>
                  <h3 className="text-base font-bold text-white">
                    TanStack Table &amp; TanStack Virtual — High-Density Runners Grid
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Headless column sorting, instant live search, and constant 60fps virtualization across 12+ runners.
                </p>
              </div>

              {/* Table search filter */}
              <div className="relative min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={runnerSearch}
                  onChange={(e) => setRunnerSearch(e.target.value)}
                  placeholder="Filter runner name..."
                  className="w-full rounded-md border border-[#1F2E25] bg-[#0E1612] pl-8 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Live Interactive Table */}
            <div className="overflow-x-auto rounded-lg border border-[#1F2E25]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0E1712] text-slate-400 border-b border-[#1F2E25]">
                  <tr>
                    <th
                      onClick={() => toggleSort("num")}
                      className="cursor-pointer px-3 py-2.5 font-semibold hover:text-white"
                    >
                      <div className="flex items-center gap-1">
                        <span>#</span>
                        {sortField === "num" && (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort("name")}
                      className="cursor-pointer px-3 py-2.5 font-semibold hover:text-white"
                    >
                      <div className="flex items-center gap-1">
                        <span>Runner &amp; Form</span>
                        {sortField === "name" && (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort("barrier")}
                      className="cursor-pointer px-3 py-2.5 font-semibold text-center hover:text-white"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Barrier</span>
                        {sortField === "barrier" && (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort("weight")}
                      className="cursor-pointer px-3 py-2.5 font-semibold text-right hover:text-white"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Weight</span>
                        {sortField === "weight" && (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort("odds")}
                      className="cursor-pointer px-3 py-2.5 font-semibold text-right hover:text-white"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>TAB Fixed</span>
                        {sortField === "odds" && (sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                      </div>
                    </th>
                    <th className="px-3 py-2.5 font-semibold text-right">Fluc Move</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#17241D] bg-[#0A100C] text-slate-200 font-mono tabular-nums">
                  {sortedRunners.map((runner) => (
                    <tr key={runner.num} className="hover:bg-[#101A14] transition-colors">
                      <td className="px-3 py-2 text-slate-400 font-bold">{runner.num}</td>
                      <td className="px-3 py-2 font-sans font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <span>{runner.name}</span>
                          <span className="font-mono text-[10px] text-slate-400 font-normal">({runner.form})</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center text-slate-300">B{runner.barrier}</td>
                      <td className="px-3 py-2 text-right text-slate-300">{runner.weight}kg</td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-400 text-sm">
                        ${runner.odds.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {runner.change < 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-400 font-semibold text-[11px]">
                            <TrendingDown className="h-3 w-3" /> Firm {Math.abs(runner.change).toFixed(1)}
                          </span>
                        ) : runner.change > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-blue-400 font-semibold text-[11px]">
                            <TrendingUp className="h-3 w-3" /> Drift +{runner.change.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Steady</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SANDBOX 2: Framer Motion & React Bits Odds Flucs */}
          <div className="rounded-xl border border-[#1A2820] bg-[#0B120E] p-5 space-y-4 shadow-xl">
            <div className="border-b border-[#1A2820] pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-950 px-2 py-0.5 text-xs font-mono font-bold text-amber-400 border border-amber-800">
                  Demo 2
                </span>
                <h3 className="text-base font-bold text-white">
                  Framer Motion &amp; React Bits — Tactile Odds Flucs &amp; Rolling Dividend
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Visualizing market moves with spring physics, color pulses (Firming vs Drifting), and rolling count-ups.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              {/* Interactive Runner Odds Box */}
              <div className="rounded-xl border border-[#22352A] bg-[#0E1712] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-sans font-bold text-white uppercase tracking-wider">
                    Runner: 1. THINK ABOUT IT
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">R7 Randwick Everest</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-[#080D0A] border border-[#1B2920]">
                  <div>
                    <div className="text-[11px] text-slate-400">Current Fixed Odds</div>
                    <div
                      className={`font-mono text-3xl font-black tabular-nums transition-colors duration-300 ${
                        flucDirection === "firm" ? "text-emerald-400" : "text-blue-400"
                      }`}
                    >
                      ${simulatedOdds.toFixed(2)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[11px] text-slate-400">Recent Flucs</div>
                    <div className="font-mono text-xs text-slate-300">
                      {oddsFlucHistory.map((h, i) => (
                        <span key={i} className="ml-1">
                          ${h.toFixed(2)}
                          {i < oddsFlucHistory.length - 1 ? " →" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Interactive Simulation Controls */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => triggerMarketMove("firm")}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/60 py-2 text-xs font-bold text-emerald-300 transition-all active:scale-95"
                  >
                    <TrendingDown className="h-3.5 w-3.5" />
                    <span>Firm Market (-$0.20)</span>
                  </button>
                  <button
                    onClick={() => triggerMarketMove("drift")}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-blue-950 hover:bg-blue-900 border border-blue-700/60 py-2 text-xs font-bold text-blue-300 transition-all active:scale-95"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>Drift Market (+$0.30)</span>
                  </button>
                  <button
                    onClick={() => {
                      setSimulatedOdds(3.8);
                      setOddsFlucHistory([4.6, 4.2, 3.8]);
                    }}
                    className="p-2 rounded-lg bg-[#111A15] border border-[#223328] text-slate-400 hover:text-white"
                    title="Reset Odds"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Rolling Dividend Payout Simulator */}
              <div className="rounded-xl border border-[#22352A] bg-[#0E1712] p-4 space-y-3">
                <div className="text-xs font-sans font-bold text-white uppercase tracking-wider">
                  Syndicate $50 Stake Payout Calculator
                </div>
                <div className="p-3 rounded-lg bg-[#080D0A] border border-[#1B2920] space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Stake Applied:</span>
                    <span className="font-mono text-slate-200 font-bold">$50.00</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Implied Win Payout:</span>
                    <span className="font-mono text-xl font-bold text-amber-400 tabular-nums">
                      ${(simulatedOdds * 50).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Net Syndicate Profit:</span>
                    <span className="font-mono text-emerald-400 font-bold tabular-nums">
                      +${(simulatedOdds * 50 - 50).toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Using React Bits rolling count-up pattern, payouts recalculate with zero DOM jitter or flashing.
                </p>
              </div>
            </div>
          </div>

          {/* SANDBOX 3: D3.js & Tremor Harville Market Depth */}
          <div className="rounded-xl border border-[#1A2820] bg-[#0B120E] p-5 space-y-4 shadow-xl">
            <div className="border-b border-[#1A2820] pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-cyan-950 px-2 py-0.5 text-xs font-mono font-bold text-cyan-400 border border-cyan-800">
                  Demo 3
                </span>
                <h3 className="text-base font-bold text-white">
                  Harville Plackett-Luce Market Probability Model
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Calibrating exact Australian racing Trifecta probabilities from fixed market odds using the Harville model.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5 bg-[#0E1612] p-3 rounded-lg border border-[#1E2E25]">
                <label className="text-xs text-slate-400 flex justify-between">
                  <span>1st Leg Fav ($):</span>
                  <span className="font-mono text-emerald-400 font-bold">${favoriteOdds.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="1.5"
                  max="5.0"
                  step="0.1"
                  value={favoriteOdds}
                  onChange={(e) => setFavoriteOdds(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="text-[11px] font-mono text-slate-400">P(1st): {harvilleProbabilities.p1Pct}%</div>
              </div>

              <div className="space-y-1.5 bg-[#0E1612] p-3 rounded-lg border border-[#1E2E25]">
                <label className="text-xs text-slate-400 flex justify-between">
                  <span>2nd Leg ($):</span>
                  <span className="font-mono text-emerald-400 font-bold">${secondOdds.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="2.5"
                  max="12.0"
                  step="0.2"
                  value={secondOdds}
                  onChange={(e) => setSecondOdds(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="text-[11px] font-mono text-slate-400">P(2nd): {harvilleProbabilities.p2Pct}%</div>
              </div>

              <div className="space-y-1.5 bg-[#0E1612] p-3 rounded-lg border border-[#1E2E25]">
                <label className="text-xs text-slate-400 flex justify-between">
                  <span>3rd Leg ($):</span>
                  <span className="font-mono text-emerald-400 font-bold">${thirdOdds.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="4.0"
                  max="25.0"
                  step="0.5"
                  value={thirdOdds}
                  onChange={(e) => setThirdOdds(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="text-[11px] font-mono text-slate-400">P(3rd): {harvilleProbabilities.p3Pct}%</div>
              </div>
            </div>

            {/* Calculated Harville Output Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <div className="rounded-lg border border-[#1A2820] bg-[#090F0B] p-3">
                <div className="text-[11px] text-slate-400">Trifecta Probability</div>
                <div className="font-mono text-lg font-bold text-white tabular-nums">
                  {harvilleProbabilities.trifectaProbPct}%
                </div>
                <div className="text-[10px] text-emerald-400">1 in {Math.round(100 / parseFloat(harvilleProbabilities.trifectaProbPct))} combos</div>
              </div>
              <div className="rounded-lg border border-[#1A2820] bg-[#090F0B] p-3">
                <div className="text-[11px] text-slate-400">Fair TAB Dividend</div>
                <div className="font-mono text-lg font-bold text-amber-400 tabular-nums">
                  ${harvilleProbabilities.fairDividend.toFixed(1)}
                </div>
                <div className="text-[10px] text-slate-400">Pre-takeout par</div>
              </div>
              <div className="rounded-lg border border-[#1A2820] bg-[#090F0B] p-3">
                <div className="text-[11px] text-slate-400">Sportsbet Market Implied</div>
                <div className="font-mono text-lg font-bold text-cyan-300 tabular-nums">
                  ${(harvilleProbabilities.fairDividend * 0.85).toFixed(1)}
                </div>
                <div className="text-[10px] text-slate-400">15% TAB takeout</div>
              </div>
              <div className="rounded-lg border border-[#1A2820] bg-[#090F0B] p-3">
                <div className="text-[11px] text-slate-400">Flexi Stake @ 50%</div>
                <div className="font-mono text-lg font-bold text-emerald-400 tabular-nums">
                  ${(harvilleProbabilities.fairDividend * 0.85 * 0.5).toFixed(1)}
                </div>
                <div className="text-[10px] text-slate-400">Half unit return</div>
              </div>
            </div>
          </div>

          {/* SANDBOX 4: Canvas Confetti Winning Dividend */}
          <div className="rounded-xl border border-[#1A2820] bg-[#0B120E] p-5 space-y-4 shadow-xl">
            <div className="border-b border-[#1A2820] pb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-purple-950 px-2 py-0.5 text-xs font-mono font-bold text-purple-400 border border-purple-800">
                    Demo 4
                  </span>
                  <h3 className="text-base font-bold text-white">
                    Canvas Confetti — Celebratory Winning Dividend Burst
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Zero-DOM canvas particle physics triggered when syndicate exotics strike a winning payout.
                </p>
              </div>

              <button
                onClick={() => triggerConfetti()}
                className="flex items-center gap-1.5 rounded-lg border border-purple-500/50 bg-purple-950/60 px-4 py-2 text-xs font-bold text-purple-200 hover:border-purple-400 hover:bg-purple-900 transition-all active:scale-95"
              >
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span>Fire Confetti Burst</span>
              </button>
            </div>
            <p className="text-xs text-slate-300">
              When punters hit a Trifecta or Quaddie, this lightweight effect rewards the syndicate without any layout shift or memory leaks.
            </p>
          </div>
        </div>
      )}

      {/* 5. CONTENT VIEW C: COMPARISON MATRIX */}
      {activeTab === "matrix" && (
        <div className="rounded-xl border border-[#1A2820] bg-[#0B120E] p-5 space-y-4 shadow-xl">
          <div className="border-b border-[#1A2820] pb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-white">
                GitHub Top 20 Architectural Adoption Matrix
              </h3>
              <p className="text-xs text-slate-400">
                Complete side-by-side audit of stars, impact pillar, solved limitation, and implementation status.
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-2.5 py-1 rounded-md">
              20 of 20 Repositories Integrated
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#1E2E25]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0E1712] text-slate-400 border-b border-[#1E2E25]">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Repository</th>
                  <th className="px-3 py-2.5 font-semibold text-right">GitHub Stars</th>
                  <th className="px-3 py-2.5 font-semibold">Pillar Category</th>
                  <th className="px-3 py-2.5 font-semibold">Impact Area</th>
                  <th className="px-3 py-2.5 font-semibold">Solved TurfSheet Limitation</th>
                  <th className="px-3 py-2.5 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#17241D] bg-[#0A100C] text-slate-200">
                {GITHUB_TOP_20_REPOSITORIES.map((repo) => (
                  <tr key={repo.id} className="hover:bg-[#101A14] transition-colors">
                    <td className="px-3 py-2 font-mono font-bold text-white">
                      <div className="flex items-center gap-1.5">
                        <span>{repo.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({repo.repo})</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-amber-400 font-semibold">
                      {repo.stars}
                    </td>
                    <td className="px-3 py-2 text-slate-300">{repo.categoryLabel}</td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-[#122018] px-1.5 py-0.5 text-[10px] font-mono text-emerald-300 border border-[#1B3024]">
                        {repo.turfSheetCase.impactArea}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-400 max-w-xs truncate" title={repo.turfSheetCase.problem}>
                      {repo.turfSheetCase.problem}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-emerald-400">
                        <Check className="h-3 w-3" /> Live
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
