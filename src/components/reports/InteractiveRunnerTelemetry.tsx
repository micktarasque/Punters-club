import React, { useState, useMemo } from "react";
import {
  ChevronRight,
  Clock,
  Compass,
  Gauge,
  Info,
  Medal,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import type { RaceEvent, RaceRunner, RaceMeeting, PunterProfile } from "../../types/racing";
import { formatDollarReturn } from "../../utils/scoring";

interface InteractiveRunnerTelemetryProps {
  meeting: RaceMeeting;
  punters: PunterProfile[];
  isApple?: boolean;
}

export const InteractiveRunnerTelemetry: React.FC<InteractiveRunnerTelemetryProps> = ({
  meeting,
  punters,
  isApple = false,
}) => {
  const races = useMemo(() => meeting.races || [], [meeting]);
  const [selectedRaceNumber, setSelectedRaceNumber] = useState<number>(() => {
    return races.length > 0 ? races[0].raceNumber : 1;
  });

  const activeRace: RaceEvent | undefined = useMemo(() => {
    return races.find((r) => r.raceNumber === selectedRaceNumber) || races[0];
  }, [races, selectedRaceNumber]);

  // Map runners sorted by finish position (1st, 2nd, 3rd, 4th, unplaced)
  const sortedRunners = useMemo(() => {
    if (!activeRace?.runners) return [];
    return [...activeRace.runners].sort((a, b) => {
      // Resulted runners with finishPosition > 0 first
      const posA = a.finishPosition > 0 ? a.finishPosition : 999;
      const posB = b.finishPosition > 0 ? b.finishPosition : 999;
      if (posA !== posB) return posA - posB;
      // Then by official barrier or tab number
      return a.tabNumber - b.tabNumber;
    });
  }, [activeRace]);

  // Compute numerical margin in lengths for each runner
  const runnerMargins = useMemo(() => {
    return sortedRunners.map((runner) => {
      let marginLengths = 0;
      if (runner.finishPosition === 1) {
        marginLengths = 0;
      } else {
        const raw = (runner.margin || "").toLowerCase().trim();
        if (raw.includes("nose") || raw.includes("0.05") || raw.includes("0.1")) {
          marginLengths = 0.1;
        } else if (raw.includes("head") || raw.includes("0.2")) {
          marginLengths = 0.2;
        } else if (raw.includes("neck") || raw.includes("0.4")) {
          marginLengths = 0.4;
        } else if (raw.includes("half") || raw.includes("0.5")) {
          marginLengths = 0.5;
        } else {
          const num = parseFloat(raw.replace(/[^\d.]/g, ""));
          marginLengths = isNaN(num) || num <= 0 ? (runner.finishPosition - 1) * 1.2 : num;
        }
      }
      return {
        tabNumber: runner.tabNumber,
        horseName: runner.horseName,
        marginLengths,
      };
    });
  }, [sortedRunners]);

  const maxMargin = useMemo(() => {
    const vals = runnerMargins.map((m) => m.marginLengths);
    return Math.max(8, ...vals);
  }, [runnerMargins]);

  // Syndicate selections for this race
  const syndicatePicks = useMemo(() => {
    const map = new Map<number, Array<{ punterName: string; preference: number; role: string }>>();
    if (!activeRace) return map;

    for (const p of punters) {
      const raceTrio =
        p.selectionsByMeeting?.[meeting.id]?.[activeRace.raceNumber] ||
        (p as any).selections?.[meeting.id]?.[activeRace.raceNumber];
      if (!raceTrio) continue;
      if (raceTrio.firstPref) {
        const list = map.get(raceTrio.firstPref) || [];
        list.push({ punterName: p.name, preference: 1, role: p.role });
        map.set(raceTrio.firstPref, list);
      }
      if (raceTrio.secondPref) {
        const list = map.get(raceTrio.secondPref) || [];
        list.push({ punterName: p.name, preference: 2, role: p.role });
        map.set(raceTrio.secondPref, list);
      }
      if (raceTrio.thirdPref) {
        const list = map.get(raceTrio.thirdPref) || [];
        list.push({ punterName: p.name, preference: 3, role: p.role });
        map.set(raceTrio.thirdPref, list);
      }
    }
    return map;
  }, [activeRace, meeting.id, punters]);

  if (!activeRace) return null;

  return (
    <div
      className={`rounded-2xl border transition-all ${
        isApple
          ? "bg-white border-[#E5E5EA] shadow-sm text-[#1D1D1F]"
          : "bg-[#0E1512] border-[#23352C] text-[#F3F4F0]"
      } p-4 sm:p-6 space-y-5`}
    >
      {/* Header and Race Selector Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-current/10">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-mono font-bold tracking-wider uppercase ${
                isApple ? "text-[#0071E3]" : "text-[#D4AF37]"
              }`}
            >
              Runner Telemetry &amp; Official Margin Breakdown
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold tracking-tight mt-0.5">
            {meeting.venue} Race {activeRace.raceNumber}: {activeRace.raceName}
          </h3>
          <div className="flex flex-wrap items-center gap-3 text-xs text-current/70 mt-1">
            <span>{activeRace.distance}m</span>
            <span>·</span>
            <span>{activeRace.classGrade}</span>
            <span>·</span>
            <span>Track: {meeting.trackCondition || meeting.trackRating || "Good 4"}</span>
            {activeRace.winningTime && (
              <>
                <span>·</span>
                <span className="font-mono">Time: {activeRace.winningTime}</span>
              </>
            )}
            {activeRace.last600m && (
              <>
                <span>·</span>
                <span className="font-mono">Last 600m: {activeRace.last600m}</span>
              </>
            )}
            <span>·</span>
            <span>Status: {activeRace.status || "Official"}</span>
          </div>
        </div>

        {/* Quick Race Jump Selector */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {races.map((r) => {
            const isSelected = r.raceNumber === activeRace.raceNumber;
            return (
              <button
                key={r.raceNumber}
                type="button"
                onClick={() => setSelectedRaceNumber(r.raceNumber)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? isApple
                      ? "bg-[#0071E3] text-white shadow-sm"
                      : "bg-[#D4AF37] text-[#070B09] shadow-sm"
                    : isApple
                    ? "bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                    : "bg-[#14201A] text-[#A5B4AA] hover:bg-[#1C2C24] hover:text-[#F3F4F0]"
                }`}
              >
                R{r.raceNumber}
              </button>
            );
          })}
        </div>
      </div>

      {/* Visual Relative Finish Margin Bar (Track Visualizer) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-current/70">
          <span className="flex items-center gap-1.5 font-bold">
            <Trophy className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Winning Post (0.0L)</span>
          </span>
          <span>Beaten Margin Spectrum (+{maxMargin.toFixed(1)}L Max)</span>
        </div>

        <div
          className={`relative h-14 rounded-xl border p-2 flex items-center overflow-x-auto ${
            isApple ? "bg-[#F5F5F7] border-[#E5E5EA]" : "bg-[#070B09] border-[#1C2C24]"
          }`}
        >
          {/* Finish Line Marker */}
          <div className="absolute left-3 top-0 bottom-0 w-1 bg-[#10B981] z-10 opacity-70" />

          {/* Runners plotted along the horizontal margin line */}
          <div className="relative w-full h-full min-w-[500px]">
            {sortedRunners.slice(0, 10).map((runner) => {
              const marginInfo = runnerMargins.find((m) => m.tabNumber === runner.tabNumber);
              const marginL = marginInfo?.marginLengths ?? 0;
              // Percentage from left (0% is winner, 92% is max margin)
              const leftPct = Math.min(94, Math.max(3, (marginL / maxMargin) * 90 + 3));
              const isWinner = runner.finishPosition === 1;
              const picks = syndicatePicks.get(runner.tabNumber);
              const hasPicks = picks && picks.length > 0;

              return (
                <div
                  key={runner.tabNumber}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center group cursor-pointer z-20"
                  style={{ left: `${leftPct}%` }}
                  title={`${runner.horseName} (#${runner.tabNumber}) — Position: ${
                    runner.finishPosition > 0 ? `${runner.finishPosition}` : "Unplaced"
                  } · Margin: ${isWinner ? "WINNER" : `+${marginL.toFixed(2)}L`}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold shadow-md transition-transform group-hover:scale-125 ${
                      isWinner
                        ? "bg-[#D4AF37] text-[#070B09] ring-2 ring-[#D4AF37]/50"
                        : runner.finishPosition === 2
                        ? "bg-[#CBD5E1] text-[#0F172A] ring-1 ring-white/40"
                        : runner.finishPosition === 3
                        ? "bg-[#B45309] text-white ring-1 ring-white/40"
                        : hasPicks
                        ? isApple
                          ? "bg-[#0071E3] text-white"
                          : "bg-[#10B981] text-[#070B09]"
                        : isApple
                        ? "bg-white text-[#1D1D1F] border border-[#D1D1D6]"
                        : "bg-[#1A2620] text-[#A5B4AA] border border-[#2E4539]"
                    }`}
                  >
                    {runner.tabNumber}
                  </div>
                  <span className="text-[10px] font-mono whitespace-nowrap mt-0.5 font-bold truncate max-w-[80px]">
                    {isWinner ? "WIN" : `+${marginL.toFixed(1)}L`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Runner Telemetry Table */}
      <div className="overflow-x-auto rounded-xl border border-current/10">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr
              className={`border-b border-current/10 font-mono uppercase text-[11px] ${
                isApple ? "bg-[#F5F5F7] text-[#6E6E73]" : "bg-[#070B09] text-[#8A9990]"
              }`}
            >
              <th className="py-2.5 px-3 font-semibold">Pos</th>
              <th className="py-2.5 px-2 font-semibold">#</th>
              <th className="py-2.5 px-3 font-semibold">Runner &amp; Barrier</th>
              <th className="py-2.5 px-3 font-semibold">Margin</th>
              <th className="py-2.5 px-3 font-semibold">Settling / Speed</th>
              <th className="py-2.5 px-3 font-semibold">Jockey &amp; Trainer</th>
              <th className="py-2.5 px-3 font-semibold text-right">NSW TAB Win/Plc</th>
              <th className="py-2.5 px-3 font-semibold">Syndicate Selections</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-current/5 font-mono">
            {sortedRunners.map((runner) => {
              const isWinner = runner.finishPosition === 1;
              const isPodium = runner.finishPosition > 0 && runner.finishPosition <= 3;
              const marginInfo = runnerMargins.find((m) => m.tabNumber === runner.tabNumber);
              const marginFormatted =
                isWinner
                  ? "Winner"
                  : runner.margin || `+${(marginInfo?.marginLengths ?? 0).toFixed(2)}L`;
              const picks = syndicatePicks.get(runner.tabNumber) || [];

              return (
                <tr
                  key={runner.tabNumber}
                  className={`transition-colors ${
                    isWinner
                      ? isApple
                        ? "bg-[#FEF3C7]/40 font-semibold"
                        : "bg-[#D4AF37]/10 font-semibold"
                      : isPodium
                      ? isApple
                        ? "bg-[#F5F5F7]/70"
                        : "bg-[#14201A]/60"
                      : isApple
                      ? "hover:bg-[#F5F5F7]"
                      : "hover:bg-[#14201A]"
                  }`}
                >
                  {/* Position */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {runner.finishPosition > 0 ? (
                      <span
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-md font-bold text-xs ${
                          isWinner
                            ? "bg-[#D4AF37] text-[#070B09]"
                            : runner.finishPosition === 2
                            ? "bg-[#94A3B8] text-[#0F172A]"
                            : runner.finishPosition === 3
                            ? "bg-[#B45309] text-white"
                            : isApple
                            ? "bg-[#E5E5EA] text-[#6E6E73]"
                            : "bg-[#1A2620] text-[#8A9990]"
                        }`}
                      >
                        {runner.finishPosition}
                      </span>
                    ) : (
                      <span className="text-current/40">—</span>
                    )}
                  </td>

                  {/* Saddlecloth TAB Number */}
                  <td className="py-2.5 px-2 font-bold whitespace-nowrap">{runner.tabNumber}</td>

                  {/* Horse Name and Barrier */}
                  <td className="py-2.5 px-3 whitespace-nowrap font-sans">
                    <div className="font-bold text-sm tracking-tight">{runner.horseName}</div>
                    <div className="text-[11px] font-mono text-current/60">
                      Barrier {runner.barrier} · {runner.weight ? `${runner.weight}kg` : "—"}
                    </div>
                  </td>

                  {/* Official Margin */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span
                      className={`font-mono text-xs ${
                        isWinner
                          ? "text-[#10B981] font-bold"
                          : isPodium
                          ? isApple
                            ? "text-[#0071E3] font-semibold"
                            : "text-[#D4AF37] font-semibold"
                          : "text-current/70"
                      }`}
                    >
                      {marginFormatted}
                    </span>
                  </td>

                  {/* Settling / Speed Map */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="text-xs text-current/80">
                      {runner.speedMapPosition || (isWinner ? "On-Pace" : "Midfield")}
                    </span>
                  </td>

                  {/* Jockey & Trainer */}
                  <td className="py-2.5 px-3 whitespace-nowrap font-sans text-xs text-current/70">
                    <div>{runner.jockey || "—"}</div>
                    <div className="text-[11px] text-current/50">{runner.trainer || "—"}</div>
                  </td>

                  {/* NSW TAB Dividends */}
                  <td className="py-2.5 px-3 whitespace-nowrap text-right tabular-nums">
                    <div className="font-bold text-xs">
                      ${runner.nswTabWin ? runner.nswTabWin.toFixed(2) : runner.fixedWin ? runner.fixedWin.toFixed(2) : "—"}
                    </div>
                    <div className="text-[11px] text-current/60">
                      Plc ${runner.nswTabPlace ? runner.nswTabPlace.toFixed(2) : runner.fixedPlace ? runner.fixedPlace.toFixed(2) : "—"}
                    </div>
                  </td>

                  {/* Syndicate Selections */}
                  <td className="py-2.5 px-3">
                    {picks.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {picks.map((pick, i) => (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap ${
                              pick.preference === 1
                                ? isApple
                                  ? "bg-[#0071E3]/15 text-[#0071E3]"
                                  : "bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40"
                                : pick.preference === 2
                                ? isApple
                                  ? "bg-[#6E6E73]/15 text-[#1D1D1F]"
                                  : "bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40"
                                : isApple
                                ? "bg-[#8E8E93]/15 text-[#6E6E73]"
                                : "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40"
                            }`}
                          >
                            <span>{pick.punterName}</span>
                            <span>({pick.preference === 1 ? "1st" : pick.preference === 2 ? "2nd" : "3rd"})</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-current/30 text-[11px]">—</span>
                    )}
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
