import React, { useMemo, useState, useRef, useEffect } from "react";
import * as d3 from "d3";
import { Calculator, Sparkles, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { RaceEvent } from "../types/racing";

interface HarvillePlackettLuceModelProps {
  race: RaceEvent;
  defaultTrio?: { firstPref: number | null; secondPref: number | null; thirdPref: number | null };
  compact?: boolean;
}

/**
 * Harville / Plackett-Luce Market Probability Model & Exotic Payout Analyzer.
 * Computes exact joint probability of 1st, 2nd, 3rd finish positions from individual win odds,
 * taking into account TAB market takeout (21%) and true zero-takeout fair dividends.
 */
export const HarvillePlackettLuceModel: React.FC<HarvillePlackettLuceModelProps> = ({
  race,
  defaultTrio,
  compact = false,
}) => {
  const chartRef = useRef<SVGSVGElement | null>(null);
  const [showPreferences, setShowPreferences] = useState(!compact);

  // Filter live runners
  const liveRunners = useMemo(
    () => race.runners.filter((r) => !r.isScratched),
    [race.runners]
  );

  // Compute normalized win probabilities (stripping out bookmaker overround)
  const { normalizedRunners, totalOverround } = useMemo(() => {
    let rawSum = 0;
    const items = liveRunners.map((r) => {
      const odds = Math.max(1.01, Number(r.nswTabWin) || Number(r.fixedWin) || 10.0);
      const rawProb = 1 / odds;
      rawSum += rawProb;
      return { runner: r, odds, rawProb };
    });

    const normalized = items
      .map((item) => ({
        ...item,
        winProb: item.rawProb / (rawSum || 1),
      }))
      .sort((a, b) => b.winProb - a.winProb);

    return {
      normalizedRunners: normalized,
      totalOverround: rawSum * 100,
    };
  }, [liveRunners]);

  // Selected trio for joint probability analysis
  const [selFirst, setSelFirst] = useState<number | null>(
    defaultTrio?.firstPref || normalizedRunners[0]?.runner.tabNumber || null
  );
  const [selSecond, setSelSecond] = useState<number | null>(
    defaultTrio?.secondPref || normalizedRunners[1]?.runner.tabNumber || null
  );
  const [selThird, setSelThird] = useState<number | null>(
    defaultTrio?.thirdPref || normalizedRunners[2]?.runner.tabNumber || null
  );

  // Synchronize when race or default trio changes
  useEffect(() => {
    if (defaultTrio?.firstPref && liveRunners.some((r) => r.tabNumber === defaultTrio.firstPref)) {
      setSelFirst(defaultTrio.firstPref);
    } else if (normalizedRunners[0]) {
      setSelFirst(normalizedRunners[0].runner.tabNumber);
    }

    if (defaultTrio?.secondPref && liveRunners.some((r) => r.tabNumber === defaultTrio.secondPref)) {
      setSelSecond(defaultTrio.secondPref);
    } else if (normalizedRunners[1]) {
      setSelSecond(normalizedRunners[1].runner.tabNumber);
    }

    if (defaultTrio?.thirdPref && liveRunners.some((r) => r.tabNumber === defaultTrio.thirdPref)) {
      setSelThird(defaultTrio.thirdPref);
    } else if (normalizedRunners[2]) {
      setSelThird(normalizedRunners[2].runner.tabNumber);
    }
  }, [race.raceNumber, defaultTrio, normalizedRunners, liveRunners]);

  // Calculate Harville Plackett-Luce exact joint probability
  const jointEval = useMemo(() => {
    const r1 = normalizedRunners.find((x) => x.runner.tabNumber === selFirst);
    const r2 = normalizedRunners.find((x) => x.runner.tabNumber === selSecond);
    const r3 = normalizedRunners.find((x) => x.runner.tabNumber === selThird);

    if (!r1 || !r2 || !r3 || r1 === r2 || r1 === r3 || r2 === r3) {
      return null;
    }

    const p1 = r1.winProb;
    const p2_given_1 = r2.winProb / Math.max(0.0001, 1 - p1);
    const p3_given_1_2 = r3.winProb / Math.max(0.0001, 1 - p1 - r2.winProb);

    const jointProb = p1 * p2_given_1 * p3_given_1_2;
    const fairDividend = jointProb > 0 ? 1 / jointProb : 0;
    const tabProjectedDividend = fairDividend * 0.79; // standard TAB 21% exotic takeout

    // Compare with official race exotics dividend if available
    const officialTrifecta = race.exotics.find((e) => e.poolType === "Trifecta");
    const officialDiv = officialTrifecta?.dividend;

    return {
      r1: r1.runner,
      r2: r2.runner,
      r3: r3.runner,
      jointProb,
      jointProbPercent: jointProb * 100,
      fairDividend,
      tabProjectedDividend,
      officialDiv,
      valueEdge:
        officialDiv && fairDividend > 0
          ? ((officialDiv - tabProjectedDividend) / tabProjectedDividend) * 100
          : null,
    };
  }, [normalizedRunners, selFirst, selSecond, selThird, race.exotics]);

  // Render SVG Probability Distribution Chart
  useEffect(() => {
    if (!chartRef.current || normalizedRunners.length === 0) return;

    const svg = d3.select(chartRef.current);
    svg.selectAll("*").remove();

    const chartWidth = Math.max(560, normalizedRunners.length * 36);
    const chartHeight = compact ? 170 : 210;
    const margin = { top: 22, right: 18, bottom: 36, left: 42 };

    const x = d3
      .scaleBand()
      .domain(normalizedRunners.map((d) => `#${d.runner.tabNumber}`))
      .range([margin.left, chartWidth - margin.right])
      .padding(0.24);

    const maxProb = d3.max(normalizedRunners, (d) => d.winProb) || 0.4;
    const y = d3
      .scaleLinear()
      .domain([0, Math.min(1, Math.ceil(maxProb * 10) / 10)])
      .nice()
      .range([chartHeight - margin.bottom, margin.top]);

    // Grid lines
    svg
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(4)
          .tickSize(-(chartWidth - margin.left - margin.right))
          .tickFormat(() => "")
      )
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g.selectAll(".tick line").attr("stroke", "#1F2D26").attr("stroke-dasharray", "2,2")
      );

    // Bars
    const barGroups = svg
      .append("g")
      .selectAll("g")
      .data(normalizedRunners)
      .join("g")
      .attr("class", "runner-bar")
      .style("cursor", "pointer")
      .on("click", (_, d) => {
        setSelFirst(d.runner.tabNumber);
      });

    barGroups
      .append("rect")
      .attr("x", (d) => x(`#${d.runner.tabNumber}`)!)
      .attr("y", (d) => y(d.winProb))
      .attr("height", (d) => y(0) - y(d.winProb))
      .attr("width", x.bandwidth())
      .attr("rx", 3)
      .attr("fill", (d) => {
        if (d.runner.tabNumber === selFirst) return "#D4AF37";
        if (d.runner.tabNumber === selSecond) return "#F3F4F0";
        if (d.runner.tabNumber === selThird) return "#10B981";
        return "#192820";
      })
      .attr("stroke", (d) => {
        if (d.runner.tabNumber === selFirst) return "#F3F4F0";
        return "#23382D";
      })
      .attr("stroke-width", 1)
      .append("title")
      .text(
        (d) =>
          `#${d.runner.tabNumber} ${d.runner.horseName}\nWin Likelihood: ${(d.winProb * 100).toFixed(
            1
          )}%\nMarket Odds: $${d.odds.toFixed(2)}\nClick to set as 1st Preference`
      );

    // Bar percentage labels
    barGroups
      .append("text")
      .attr("x", (d) => x(`#${d.runner.tabNumber}`)! + x.bandwidth() / 2)
      .attr("y", (d) => y(d.winProb) - 4)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => (d.runner.tabNumber === selFirst ? "#D4AF37" : "#8A9990"))
      .attr("font-family", "monospace")
      .attr("font-size", "10px")
      .attr("font-weight", (d) => (d.runner.tabNumber === selFirst ? "bold" : "normal"))
      .text((d) => `${(d.winProb * 100).toFixed(0)}%`);

    // X Axis
    svg
      .append("g")
      .attr("transform", `translate(0,${chartHeight - margin.bottom})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call((g) => g.select(".domain").attr("stroke", "#1F2D26"))
      .call((g) =>
        g
          .selectAll("text")
          .attr("fill", "#8A9990")
          .attr("font-family", "monospace")
          .attr("font-size", "11px")
          .attr("dy", "1em")
      );

    // Y Axis
    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3
          .axisLeft(y)
          .ticks(4)
          .tickFormat((d) => `${((d as number) * 100).toFixed(0)}%`)
      )
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll("text")
          .attr("fill", "#8A9990")
          .attr("font-family", "monospace")
          .attr("font-size", "10px")
      );
  }, [normalizedRunners, selFirst, selSecond, selThird, compact]);

  return (
    <div className="rounded-xl border border-[#1F2D26] bg-[#0E1813] p-4 sm:p-5 space-y-4">
      {/* Header — clean of D3 references */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F2D26] pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#F3F4F0] flex items-center gap-2">
              <span>Harville Plackett-Luce Market Probability Model</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#10B981]/15 text-[#10B981]">
                Runner Win Likelihood
              </span>
            </h3>
            <p className="text-[11px] text-[#8A9990]">
              Normalizes market takeout ({totalOverround.toFixed(1)}% book) to compute true conditional win probabilities and exotic joint combinations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[#8A9990]">Race Overround:</span>
          <span className="font-bold text-[#D4AF37] tabular-nums">
            {totalOverround.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-[#0B110E] border border-[#1F2D26]">
          <div className="text-[11px] text-[#8A9990] font-mono">Top Fav Probability</div>
          <div className="mt-1 text-lg font-bold font-mono text-[#D4AF37] tabular-nums">
            {((normalizedRunners[0]?.winProb || 0) * 100).toFixed(1)}%
          </div>
          <div className="text-[10px] text-[#8A9990] truncate">
            #{normalizedRunners[0]?.runner.tabNumber} {normalizedRunners[0]?.runner.horseName}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[#0B110E] border border-[#1F2D26]">
          <div className="text-[11px] text-[#8A9990] font-mono">Joint Trio Chance</div>
          <div className="mt-1 text-lg font-bold font-mono text-[#F3F4F0] tabular-nums">
            {jointEval ? `${jointEval.jointProbPercent.toFixed(2)}%` : "Invalid"}
          </div>
          <div className="text-[10px] text-[#10B981] truncate">
            1 in {jointEval && jointEval.jointProb > 0 ? Math.round(1 / jointEval.jointProb) : "-"} jumps
          </div>
        </div>

        <div className="p-3 rounded-lg bg-[#0B110E] border border-[#1F2D26]">
          <div className="text-[11px] text-[#8A9990] font-mono">Fair Math Dividend</div>
          <div className="mt-1 text-lg font-bold font-mono text-[#10B981] tabular-nums">
            {jointEval ? `$${jointEval.fairDividend.toFixed(2)}` : "$0.00"}
          </div>
          <div className="text-[10px] text-[#8A9990]">0% Takeout Par</div>
        </div>

        <div className="p-3 rounded-lg bg-[#0B110E] border border-[#1F2D26]">
          <div className="text-[11px] text-[#8A9990] font-mono">Projected TAB Div</div>
          <div className="mt-1 text-lg font-bold font-mono text-[#D4AF37] tabular-nums">
            {jointEval ? `$${jointEval.tabProjectedDividend.toFixed(2)}` : "$0.00"}
          </div>
          <div className="text-[10px] text-[#8A9990]">21% TAB Tote Pool Takeout</div>
        </div>
      </div>

      {/* Probability Bar Chart Visualization */}
      <div className="bg-[#0B110E] border border-[#1F2D26] rounded-lg p-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="text-xs font-semibold text-[#F3F4F0]">
            Market Win Probability Distribution (All {liveRunners.length} Live Runners)
          </span>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-[#D4AF37]">
              <span className="w-2 h-2 rounded bg-[#D4AF37] inline-block" /> 1st Pref
            </span>
            <span className="flex items-center gap-1 text-[#F3F4F0]">
              <span className="w-2 h-2 rounded bg-[#F3F4F0] inline-block" /> 2nd Pref
            </span>
            <span className="flex items-center gap-1 text-[#10B981]">
              <span className="w-2 h-2 rounded bg-[#10B981] inline-block" /> 3rd Pref
            </span>
            <span className="text-[10px] text-[#8A9990] hidden sm:inline">
              (Click bar to pick 1st)
            </span>
          </div>
        </div>
        <div className="w-full overflow-x-auto">
          <svg
            ref={chartRef}
            viewBox={`0 0 ${Math.max(560, normalizedRunners.length * 36)} ${compact ? 170 : 210}`}
            className="w-full h-auto min-w-[500px]"
          />
        </div>
      </div>

      {/* Interactive Combination Selectors */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-[#8A9990]">
            Conditional Trifecta Evaluation (1st · 2nd · 3rd)
          </span>
          <button
            type="button"
            onClick={() => setShowPreferences((prev) => !prev)}
            className="text-[11px] font-mono text-[#D4AF37] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>{showPreferences ? "Hide Selectors" : "Customize Trio Preferences"}</span>
            {showPreferences ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {showPreferences && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-[11px] text-[#D4AF37] font-mono font-semibold mb-1">
                1st Preference (Winner)
              </label>
              <select
                value={selFirst ?? ""}
                onChange={(e) => setSelFirst(Number(e.target.value) || null)}
                className="w-full rounded bg-[#0B110E] border border-[#1F2D26] px-2.5 py-1.5 text-xs font-mono text-[#F3F4F0] focus:border-[#D4AF37] focus:outline-none cursor-pointer"
              >
                {normalizedRunners.map((item) => (
                  <option key={item.runner.tabNumber} value={item.runner.tabNumber}>
                    #{item.runner.tabNumber} {item.runner.horseName} ({(item.winProb * 100).toFixed(1)}% · ${item.odds.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#F3F4F0] font-mono font-semibold mb-1">
                2nd Preference (Runner-up)
              </label>
              <select
                value={selSecond ?? ""}
                onChange={(e) => setSelSecond(Number(e.target.value) || null)}
                className="w-full rounded bg-[#0B110E] border border-[#1F2D26] px-2.5 py-1.5 text-xs font-mono text-[#F3F4F0] focus:border-[#D4AF37] focus:outline-none cursor-pointer"
              >
                {normalizedRunners.map((item) => (
                  <option key={item.runner.tabNumber} value={item.runner.tabNumber}>
                    #{item.runner.tabNumber} {item.runner.horseName} ({(item.winProb * 100).toFixed(1)}% · ${item.odds.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-[#10B981] font-mono font-semibold mb-1">
                3rd Preference (3rd Place)
              </label>
              <select
                value={selThird ?? ""}
                onChange={(e) => setSelThird(Number(e.target.value) || null)}
                className="w-full rounded bg-[#0B110E] border border-[#1F2D26] px-2.5 py-1.5 text-xs font-mono text-[#F3F4F0] focus:border-[#D4AF37] focus:outline-none cursor-pointer"
              >
                {normalizedRunners.map((item) => (
                  <option key={item.runner.tabNumber} value={item.runner.tabNumber}>
                    #{item.runner.tabNumber} {item.runner.horseName} ({(item.winProb * 100).toFixed(1)}% · ${item.odds.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
