import React, { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CupTournamentState } from "../../types/cupMode";
import type { RaceMeeting } from "../../types/racing";
import { SectionDisclosure } from "../../components/shell/ShellPrimitives";
import {
  combinedLeaderboard,
  formatMoney,
  getResultsProgress,
  meetingLeaderboard,
  meetingTrifectas,
  ordinal,
} from "./cupSelectors";

interface CupStandingsProps {
  tournament: CupTournamentState;
  cupMeetings: RaceMeeting[];
}

const STAKES = [5, 10, 20, 50];

export const CupStandings: React.FC<CupStandingsProps> = ({ tournament, cupMeetings }) => {
  const [scope, setScope] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showTrifecta, setShowTrifecta] = useState(false);
  const [stake, setStake] = useState(10);

  const scopedMeetings = scope === "all" ? cupMeetings : cupMeetings.filter((m) => m.id === scope);
  const rows = useMemo(
    () =>
      scope === "all"
        ? combinedLeaderboard(tournament, cupMeetings)
        : scopedMeetings[0]
        ? meetingLeaderboard(tournament, scopedMeetings[0])
        : [],
    [tournament, cupMeetings, scope, scopedMeetings]
  );
  const results = getResultsProgress(scopedMeetings);
  const hasPicks = rows.some((r) => r.totalPicks > 0);

  const trifectas = useMemo(
    () =>
      scopedMeetings.flatMap((m) =>
        meetingTrifectas(tournament, m, stake)
          .filter((t) => t.boxedRunners.length >= 3)
          .map((t) => ({ ...t, venue: m.venue }))
      ),
    [tournament, scopedMeetings, stake]
  );
  const triTotals = trifectas.reduce(
    (acc, t) => ({ outlay: acc.outlay + t.flexiStake, ret: acc.ret + t.flexiPayout, hits: acc.hits + (t.isStruck ? 1 : 0) }),
    { outlay: 0, ret: 0, hits: 0 }
  );

  const venueFor = (raceNo: number, horse: string) =>
    cupMeetings.find((m) => m.races.some((r) => r.raceNumber === raceNo && r.runners.some((x) => x.horseName === horse)))?.venue;

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-tight">Standings</h1>
          <p className="text-[13px] ui-muted mt-1">
            {results.done} of {results.total} races official. Points update as results come in.
          </p>
        </div>
        {cupMeetings.length > 1 && (
          <div className="ui-segment" role="group" aria-label="Scope">
            <button type="button" aria-pressed={scope === "all"} onClick={() => setScope("all")}>
              Whole Cup
            </button>
            {cupMeetings.map((m) => (
              <button key={m.id} type="button" aria-pressed={scope === m.id} onClick={() => setScope(m.id)}>
                {m.venue}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Podium summary */}
      {hasPicks && (
        <div className="grid gap-3 sm:grid-cols-3">
          {rows.slice(0, 3).map((r) => (
            <div key={r.punterName} className="ui-surface p-4">
              <div className="ui-label">{ordinal(r.rank)}</div>
              <div className="text-[16px] font-semibold mt-1 truncate">{r.punterName}</div>
              <div className="flex items-baseline gap-3 mt-2">
                <span className="ui-kpi-value">{r.totalPoints}</span>
                <span className="text-[12px] ui-muted">points</span>
                <span className={`text-[13px] ml-auto ui-nums ${r.netProfit >= 0 ? "ui-pos" : "ui-neg"}`}>
                  {formatMoney(r.netProfit, true)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="ui-surface">
        {!hasPicks ? (
          <div className="p-8 text-center">
            <div className="text-[15px] font-semibold">No horses drafted yet</div>
            <p className="text-[13px] ui-muted mt-1">Standings appear once the draft has allocated horses.</p>
          </div>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th>Member</th>
                  <th className="num">Horses</th>
                  <th className="num">Wins</th>
                  <th className="num">Placings</th>
                  <th className="num">Points</th>
                  <th className="num">Return</th>
                  <th className="num">Net</th>
                  <th aria-label="Details" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = expanded === r.punterName;
                  return (
                    <React.Fragment key={r.punterName}>
                      <tr className="cursor-pointer" onClick={() => setExpanded(open ? null : r.punterName)}>
                        <td className="font-semibold ui-nums">{r.rank}</td>
                        <td className="font-medium">{r.punterName}</td>
                        <td className="num">{r.totalPicks}</td>
                        <td className="num">{r.winCount}</td>
                        <td className="num">{r.placeCount}</td>
                        <td className="num font-semibold">{r.totalPoints}</td>
                        <td className="num">{formatMoney(r.totalDollarReturn)}</td>
                        <td className="num">
                          <span className={r.netProfit >= 0 ? "ui-pos" : "ui-neg"}>{formatMoney(r.netProfit, true)}</span>
                        </td>
                        <td className="num">
                          <button
                            type="button"
                            className="cup-mini-btn"
                            aria-expanded={open}
                            aria-label={`${open ? "Hide" : "Show"} ${r.punterName}'s horses`}
                          >
                            <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={9} className="!p-0">
                            <div className="px-4 py-3 space-y-1.5">
                              {r.raceOutcomes.map((o) => (
                                <div key={`${o.raceNumber}-${o.tabNumber}-${o.horseName}`} className="flex items-center gap-3 text-[13px]">
                                  <span className="w-28 ui-muted whitespace-nowrap truncate">
                                    {venueFor(o.raceNumber, o.horseName) || ""} R{o.raceNumber}
                                  </span>
                                  <span className="cup-saddle">{o.tabNumber}</span>
                                  <span className="flex-1 min-w-0 truncate">{o.horseName}</span>
                                  <span className="w-16 text-right ui-muted">
                                    {o.finishPosition > 0 ? ordinal(o.finishPosition) : "Pending"}
                                  </span>
                                  <span className="w-14 text-right ui-nums font-medium">{o.points} pts</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[12px] ui-muted">
        Scoring: winner 3 points, second 2, third 1 in fields of eight or more. Returns assume a $1 win and $1 place bet on each horse at TAB dividends.
      </p>

      <SectionDisclosure
        id="cup-group-trifecta"
        title="Group box trifecta"
        summary="Every member's horse in a race boxed into one flexi trifecta"
        open={showTrifecta}
        onToggle={() => setShowTrifecta((v) => !v)}
      >
        <div className="ui-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="ui-label">Stake per race</span>
              <div className="ui-segment" role="group" aria-label="Stake">
                {STAKES.map((s) => (
                  <button key={s} type="button" aria-pressed={stake === s} onClick={() => setStake(s)}>
                    ${s}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[13px] ui-muted ui-nums">
              {triTotals.hits} hit{triTotals.hits === 1 ? "" : "s"} · outlay {formatMoney(triTotals.outlay)} · return {formatMoney(triTotals.ret)}
            </div>
          </div>
          {trifectas.length === 0 ? (
            <p className="px-5 pb-5 text-[13px] ui-muted">A trifecta needs at least three drafted horses in a race.</p>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Race</th>
                    <th>Boxed runners</th>
                    <th className="num">Combos</th>
                    <th className="num">Flexi</th>
                    <th className="num">Dividend</th>
                    <th className="num">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {trifectas.map((t) => (
                    <tr key={`${t.venue}-${t.raceNumber}`}>
                      <td className="whitespace-nowrap">
                        {t.venue} R{t.raceNumber}
                      </td>
                      <td className="text-[12px]">{t.boxedRunners.map((b) => `${b.tabNumber} ${b.horseName}`).join(", ")}</td>
                      <td className="num">{t.totalCombinations}</td>
                      <td className="num">{t.flexiPercentage}%</td>
                      <td className="num">{t.officialTrifectaDividend > 0 ? formatMoney(t.officialTrifectaDividend) : "—"}</td>
                      <td className="num">
                        <span className={t.isStruck ? "ui-pos font-semibold" : "ui-muted"}>
                          {t.isStruck ? formatMoney(t.flexiPayout) : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionDisclosure>
    </div>
  );
};
