import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Minus,
  Trophy,
  CheckCircle2,
  Clock,
  Sparkles,
  DollarSign,
  AlertCircle,
  Zap,
} from "lucide-react";
import { RaceMeeting, RaceEvent, RaceRunner, PunterProfile } from "../types/racing";
import {
  AustralianBookmaker,
  BOOKMAKER_BRAND_STYLES,
  buildMultiBookmakerRaceComparison,
  RaceMarketSummary,
} from "../utils/bookmakerOddsEngine";
import { JockeySilkSvg } from "./JockeySilkSvg";
import { evaluateCombinedTrifectaForRace } from "../utils/scoring";

interface LiveOddsAndResultsCenterProps {
  meetings: RaceMeeting[];
  punters?: PunterProfile[];
  onRefreshScraperData?: () => Promise<void> | void;
  isRefreshing?: boolean;
  onOpenTrifectaCustomiser?: (meeting: RaceMeeting, race: RaceEvent) => void;
}

export const LiveOddsAndResultsCenter: React.FC<LiveOddsAndResultsCenterProps> = ({
  meetings,
  punters = [],
  onRefreshScraperData,
  isRefreshing = false,
  onOpenTrifectaCustomiser,
}) => {
  // Selected meeting & race
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(
    meetings[0]?.id || ""
  );

  const activeMeeting = useMemo(() => {
    return meetings.find((m) => m.id === selectedMeetingId) || meetings[0];
  }, [meetings, selectedMeetingId]);

  const [selectedRaceNumber, setSelectedRaceNumber] = useState<number>(() => {
    return activeMeeting?.races[0]?.raceNumber || 1;
  });

  const activeRace = useMemo(() => {
    if (!activeMeeting || !activeMeeting.races.length) return null;
    return (
      activeMeeting.races.find((r) => r.raceNumber === selectedRaceNumber) ||
      activeMeeting.races[0]
    );
  }, [activeMeeting, selectedRaceNumber]);

  // Auto-refresh state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [secondsUntilNextRefresh, setSecondsUntilNextRefresh] = useState(15);
  const [selectedBookmakerTab, setSelectedBookmakerTab] = useState<"ALL" | AustralianBookmaker>("ALL");

  // Timer for auto-refresh
  useEffect(() => {
    if (!autoRefreshEnabled) return;

    const timer = setInterval(() => {
      setSecondsUntilNextRefresh((prev) => {
        if (prev <= 1) {
          if (onRefreshScraperData && !isRefreshing) {
            onRefreshScraperData();
          }
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshEnabled, onRefreshScraperData, isRefreshing]);

  // Market comparison data
  const marketSummary: RaceMarketSummary | null = useMemo(() => {
    if (!activeRace || !activeMeeting) return null;
    return buildMultiBookmakerRaceComparison(activeRace, activeMeeting);
  }, [activeRace, activeMeeting]);

  // Syndicate Trifecta evaluation for this race
  const syndicateTrifecta = useMemo(() => {
    if (!activeRace || !activeMeeting) return null;
    return evaluateCombinedTrifectaForRace(
      activeRace,
      punters,
      activeMeeting.id,
      activeMeeting.date
    );
  }, [activeRace, activeMeeting, punters]);

  // Status badge styling
  const isFinal =
    activeRace?.status === "Final" ||
    activeRace?.status === "All Clear" ||
    (marketSummary?.officialPlacings.length || 0) >= 3;

  const bookmakersList: AustralianBookmaker[] = [
    "NSW TAB",
    "Sportsbet",
    "Ladbrokes",
    "Bet365",
    "PointsBet",
  ];

  if (!meetings.length || !activeMeeting) {
    return (
      <div className="p-8 text-center text-[#8A9990] font-mono">
        No active racing meetings available for real-time odds comparison.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Header & Meeting Selection */}
      <div className="bg-[#0A120E] border border-[#18261E] rounded-xl p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#8A9990] font-mono">
              <span className="text-[#10B981] font-semibold">
                LIVE ODDS & RACE RESULTS DESK
              </span>
              <span aria-hidden="true">·</span>
              <span>NSW TAB Pari-Mutuel</span>
              <span aria-hidden="true">·</span>
              <span>Major Fixed Odds Matrix</span>
            </div>
            <h2 className="text-lg font-bold text-[#F3F4F0] mt-0.5">
              Live Real-Time Bookmaker Odds & Official Outcomes
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-Refresh Toggle Button */}
            <button
              type="button"
              onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                autoRefreshEnabled
                  ? "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/50"
                  : "bg-[#111C16] text-[#8A9990] border-[#203328]"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>
                {autoRefreshEnabled
                  ? `Auto-Refresh (${secondsUntilNextRefresh}s)`
                  : "Auto-Refresh Paused"}
              </span>
            </button>

            {/* Manual Fetch Button */}
            {onRefreshScraperData && (
              <button
                type="button"
                onClick={() => {
                  onRefreshScraperData();
                  setSecondsUntilNextRefresh(15);
                }}
                disabled={isRefreshing}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#10B981] text-[#070B09] hover:bg-[#059669] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                />
                <span>Fetch Latest Scraper Feed</span>
              </button>
            )}
          </div>
        </div>

        {/* Meeting Selector Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
          {meetings.map((m) => {
            const isSel = m.id === activeMeeting.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelectedMeetingId(m.id);
                  setSelectedRaceNumber(m.races[0]?.raceNumber || 1);
                }}
                className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  isSel
                    ? "bg-[#10B981] text-[#070B09] shadow"
                    : "bg-[#111C16] text-[#8A9990] hover:text-[#F3F4F0] border border-[#1F2D26]"
                }`}
              >
                {m.venue} ({m.state})
                <span className="ml-1.5 text-[10px] opacity-80">
                  {m.trackRating || m.trackCondition || "Good"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Race Selector Pill Bar */}
        {activeMeeting && (
          <div className="flex items-center gap-1 overflow-x-auto pt-1 border-t border-[#18261E]">
            <span className="text-[11px] font-mono text-[#8A9990] mr-1 shrink-0">
              Races:
            </span>
            {activeMeeting.races.map((r) => {
              const isSel = r.raceNumber === activeRace?.raceNumber;
              const hasResults = r.runners.some((rn) => rn.finishPosition > 0);
              return (
                <button
                  key={r.raceNumber}
                  type="button"
                  onClick={() => setSelectedRaceNumber(r.raceNumber)}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1 ${
                    isSel
                      ? "bg-[#D4AF37] text-[#070B09]"
                      : "bg-[#111C16] text-[#8A9990] hover:text-[#F3F4F0] hover:bg-[#18261E]"
                  }`}
                >
                  <span>R{r.raceNumber}</span>
                  {hasResults && (
                    <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Race Header & Official Status Banner */}
      {activeRace && marketSummary && (
        <div className="bg-[#0A120E] border border-[#18261E] rounded-xl p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-[#D4AF37] font-bold">
                  RACE {activeRace.raceNumber} OF {activeMeeting.races.length}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-[#8A9990]">{activeMeeting.venue}</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#8A9990]">{activeRace.distance}m</span>
                <span aria-hidden="true">·</span>
                <span className="text-[#8A9990]">{activeRace.classGrade}</span>
              </div>
              <h3 className="text-base font-bold text-[#F3F4F0] mt-0.5">
                {activeRace.raceName}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1.5 ${
                  isFinal
                    ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40"
                    : "bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40"
                }`}
              >
                {isFinal ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>OFFICIAL / ALL CLEAR</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>SCHEDULED: {activeRace.startTime}</span>
                  </>
                )}
              </span>

              {onOpenTrifectaCustomiser && (
                <button
                  type="button"
                  onClick={() => onOpenTrifectaCustomiser(activeMeeting, activeRace)}
                  className="px-3 py-1 rounded bg-[#111C16] text-[#10B981] border border-[#203328] hover:border-[#10B981] text-xs font-mono flex items-center gap-1 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Trifecta Customiser</span>
                </button>
              )}
            </div>
          </div>

          {/* Bookmaker Overround Comparison Bar */}
          <div className="p-2.5 bg-[#0D1612] border border-[#1F2D26] rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className="text-[#8A9990]">
              Market Overround (Margin):
            </span>
            <div className="flex flex-wrap items-center gap-3">
              {bookmakersList.map((b) => (
                <span key={b} className="text-[#8A9990]">
                  {BOOKMAKER_BRAND_STYLES[b].label}:{" "}
                  <strong className={BOOKMAKER_BRAND_STYLES[b].text}>
                    {marketSummary.bookmakerOverrounds[b]}%
                  </strong>
                </span>
              ))}
              <span className="text-[#D4AF37] font-bold border-l border-[#23352C] pl-3">
                Shop Best Price: {marketSummary.bestMarketOverround}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Official Results Podium & Exotic Dividends (if race has resulted) */}
      {marketSummary && marketSummary.officialPlacings.length > 0 && (
        <div className="bg-[#0A120E] border border-[#10B981]/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#D4AF37]" />
              <h4 className="font-bold text-[#F3F4F0] text-sm">
                Official Race Placings & Exotic Dividends
              </h4>
            </div>

            {marketSummary.winningTime && (
              <span className="text-xs font-mono text-[#8A9990]">
                Time: {marketSummary.winningTime} (Last 600m:{" "}
                {marketSummary.last600m || "-"})
              </span>
            )}
          </div>

          {/* Podium Grid (1st, 2nd, 3rd, 4th) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {marketSummary.officialPlacings.map(({ position, runner }) => {
              const medalColor =
                position === 1
                  ? "bg-[#D4AF37] text-[#070B09]"
                  : position === 2
                  ? "bg-slate-300 text-slate-900"
                  : position === 3
                  ? "bg-amber-700 text-white"
                  : "bg-slate-700 text-slate-200";

              return (
                <div
                  key={position}
                  className="bg-[#111C16] border border-[#203328] rounded-lg p-2.5 flex items-center gap-3"
                >
                  <div
                    className={`w-7 h-7 rounded font-mono font-bold text-xs flex items-center justify-center shrink-0 shadow ${medalColor}`}
                  >
                    {position}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-[#F3F4F0] truncate">
                      #{runner.tabNumber} {runner.horseName}
                    </div>
                    <div className="text-[11px] text-[#8A9990] truncate">
                      {runner.jockey} · {runner.margin || "Won"}
                    </div>
                  </div>

                  <div className="text-right font-mono text-xs">
                    <div className="text-[#10B981] font-bold">
                      ${runner.nswTabWin ? runner.nswTabWin.toFixed(2) : "-"}
                    </div>
                    <div className="text-[10px] text-[#8A9990]">
                      Plc ${runner.nswTabPlace ? runner.nswTabPlace.toFixed(2) : "-"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Exotic Dividends & Syndicate Payout Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#18261E] text-xs font-mono">
            <div>
              <span className="text-[11px] text-[#8A9990] block mb-1">
                NSW TAB OFFICIAL EXOTIC DIVIDENDS:
              </span>
              <div className="flex flex-wrap gap-2">
                {marketSummary.exotics.length > 0 ? (
                  marketSummary.exotics.map((ex, idx) => (
                    <span
                      key={idx}
                      className="bg-[#111C16] px-2 py-1 rounded border border-[#203328] text-[#D5DDD8]"
                    >
                      {ex.poolType}:{" "}
                      <strong className="text-[#10B981]">
                        ${Number(ex.dividend).toFixed(2)}
                      </strong>{" "}
                      ({ex.combination})
                    </span>
                  ))
                ) : (
                  <span className="text-[#8A9990]">
                    Official exotics paying on NSW TAB tote
                  </span>
                )}
              </div>
            </div>

            {syndicateTrifecta && (
              <div className="bg-[#111C16] p-2.5 rounded border border-[#203328] flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#8A9990] block">
                    SYNDICATE FLEXI TRIFECTA SETTLEMENT:
                  </span>
                  <div className="font-bold text-[#F3F4F0]">
                    {syndicateTrifecta.isTrifectaHit ? (
                      <span className="text-[#10B981]">
                        🎉 TRIFECTA HIT! (${syndicateTrifecta.trifectaOddsOnBetAmount.toFixed(2)})
                      </span>
                    ) : isFinal ? (
                      <span className="text-[#8A9990]">
                        No syndicate combination matched
                      </span>
                    ) : (
                      <span className="text-[#D4AF37]">
                        Awaiting Official Results
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right text-[11px]">
                  <span className="text-[#D4AF37]">
                    Flexi: {syndicateTrifecta.flexiPercentage.toFixed(1)}%
                  </span>
                  <div className="text-[#8A9990]">
                    {syndicateTrifecta.combinationsCount} Combos
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Real-Time Multi-Bookmaker Odds Comparison Matrix */}
      <div className="bg-[#0A120E] border border-[#18261E] rounded-xl overflow-hidden">
        <div className="px-3.5 py-2.5 bg-[#0F1713] border-b border-[#18261E] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <span className="font-bold text-[#F3F4F0]">
            Runner Odds Comparison ({marketSummary?.runners.length || 0} Horses)
          </span>

          {/* Bookmaker tab filter */}
          <div className="flex items-center gap-1">
            <span className="text-[#8A9990] mr-1 hidden sm:inline">Highlight:</span>
            <button
              type="button"
              onClick={() => setSelectedBookmakerTab("ALL")}
              className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                selectedBookmakerTab === "ALL"
                  ? "bg-[#10B981] text-[#070B09] font-bold"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              All Bookies
            </button>
            {bookmakersList.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setSelectedBookmakerTab(b)}
                className={`px-2 py-0.5 rounded text-[11px] cursor-pointer ${
                  selectedBookmakerTab === b
                    ? "bg-[#10B981] text-[#070B09] font-bold"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                {BOOKMAKER_BRAND_STYLES[b].label}
              </button>
            ))}
          </div>
        </div>

        {/* Matrix Header */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-[#0D1612] text-[#8A9990] border-b border-[#18261E]">
                <th className="py-2.5 px-3 font-semibold"># Runner</th>
                <th className="py-2.5 px-2 font-semibold">Barrier</th>
                <th className="py-2.5 px-3 font-semibold">Jockey & Trainer</th>
                <th className="py-2.5 px-2 font-semibold text-center bg-[#007A33]/10">
                  NSW TAB
                </th>
                <th className="py-2.5 px-2 font-semibold text-center bg-[#004B87]/10">
                  Sportsbet
                </th>
                <th className="py-2.5 px-2 font-semibold text-center bg-[#E31837]/10">
                  Ladbrokes
                </th>
                <th className="py-2.5 px-2 font-semibold text-center bg-[#00743B]/10">
                  Bet365
                </th>
                <th className="py-2.5 px-2 font-semibold text-center bg-[#FF1447]/10">
                  PointsBet
                </th>
                <th className="py-2.5 px-3 font-semibold text-right">
                  Best Price
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#18261E]">
              {marketSummary?.runners.map((r) => {
                const isSub19 = r.bestFixedWin < 1.9;

                return (
                  <tr
                    key={r.tabNumber}
                    className="hover:bg-[#111C16] transition-colors"
                  >
                    {/* Runner */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded bg-[#111C16] border border-[#22382B] text-[#F3F4F0] font-bold flex items-center justify-center text-xs shrink-0">
                          {r.tabNumber}
                        </div>
                        <div className="shrink-0 w-5 h-5">
                          <JockeySilkSvg
                            seed={r.tabNumber}
                            primary={r.silkPrimary}
                            secondary={r.silkSecondary}
                          />
                        </div>
                        <div>
                          <div className="font-bold text-[#F3F4F0] flex items-center gap-1.5">
                            <span>{r.horseName}</span>
                            {isSub19 && (
                              <span className="text-[9px] font-bold text-[#10B981] bg-[#10B981]/20 px-1 py-0.2 rounded">
                                &lt;$1.90
                              </span>
                            )}
                          </div>
                          {r.finishPosition > 0 && (
                            <span className="text-[10px] text-[#D4AF37] font-semibold">
                              Finished: {r.finishPosition} ({r.margin})
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Barrier */}
                    <td className="py-2.5 px-2 text-[#8A9990]">
                      B{r.barrier}
                    </td>

                    {/* Jockey & Trainer */}
                    <td className="py-2.5 px-3 text-[11px] text-[#8A9990]">
                      <div>{r.jockey}</div>
                      <div className="text-[10px] opacity-75">{r.trainer}</div>
                    </td>

                    {/* Bookmakers columns */}
                    {bookmakersList.map((b) => {
                      const quote = r.quotes[b];
                      const isBest = quote?.isBestPrice;
                      const isHighlight =
                        selectedBookmakerTab === "ALL" ||
                        selectedBookmakerTab === b;

                      return (
                        <td
                          key={b}
                          className={`py-2.5 px-2 text-center transition-colors ${
                            isBest
                              ? "bg-[#D4AF37]/10"
                              : isHighlight
                              ? "bg-[#0B1410]"
                              : "opacity-40"
                          }`}
                        >
                          <div className="font-bold">
                            <span
                              className={`${
                                isBest
                                  ? "text-[#D4AF37] font-extrabold"
                                  : BOOKMAKER_BRAND_STYLES[b].text
                              }`}
                            >
                              ${quote?.fixedWin.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#8A9990]">
                            Plc ${quote?.fixedPlace.toFixed(2)}
                          </div>
                        </td>
                      );
                    })}

                    {/* Best Price Callout */}
                    <td className="py-2.5 px-3 text-right">
                      <div className="font-bold text-sm text-[#10B981]">
                        ${r.bestFixedWin.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-[#D4AF37]">
                        on {r.bestBookmaker}
                        {r.priceSpreadPct > 0 && ` (+${r.priceSpreadPct}%)`}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
