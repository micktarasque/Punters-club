import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ChevronDown, ChevronUp, Plus, Trophy, X } from "lucide-react";
import type { CupTournamentState } from "../../types/cupMode";
import type { RaceMeeting, RaceRunner } from "../../types/racing";
import { getRequiredRankCountForRace } from "../../utils/cupMode";
import { audioAlerts } from "../../utils/audioAlerts";
import {
  fillRankingByOdds,
  getRanking,
  isRaceRankedBy,
  memberRankingProgress,
  runnersByOdds,
  setRanking,
} from "./cupSelectors";

interface CupRankingsProps {
  tournament: CupTournamentState;
  onUpdateTournament: (next: CupTournamentState) => void;
  meeting: RaceMeeting;
  cupMeetings: RaceMeeting[];
  cupRaceNumber: number | null;
  defaultMember: string;
  meetingSwitcher: React.ReactNode;
  onGoDraft: () => void;
}

function price(r: RaceRunner): string {
  const p = r.fixedWin > 1 ? r.fixedWin : r.nswTabWin;
  return p && p > 1 ? `$${p.toFixed(2)}` : "—";
}

export const CupRankings: React.FC<CupRankingsProps> = ({
  tournament,
  onUpdateTournament,
  meeting,
  cupMeetings,
  cupRaceNumber,
  defaultMember,
  meetingSwitcher,
  onGoDraft,
}) => {
  const members = tournament.participants;
  const [member, setMember] = useState<string>(
    members.includes(defaultMember) ? defaultMember : members[0] || ""
  );
  const races = useMemo(() => [...meeting.races].sort((a, b) => a.raceNumber - b.raceNumber), [meeting]);
  const [raceNo, setRaceNo] = useState<number>(races[0]?.raceNumber ?? 1);

  useEffect(() => {
    if (!members.includes(member)) setMember(members[0] || "");
  }, [members, member]);
  useEffect(() => {
    if (!races.some((r) => r.raceNumber === raceNo)) setRaceNo(races[0]?.raceNumber ?? 1);
  }, [races, raceNo]);

  const race = races.find((r) => r.raceNumber === raceNo) || races[0];
  if (!race) {
    return <div className="ui-surface p-6 text-[13px] ui-muted">This card has no races yet.</div>;
  }

  const required = getRequiredRankCountForRace(race);
  const ranking = getRanking(tournament, meeting.id, race.raceNumber, member).slice(0, required);
  const field = runnersByOdds(race);
  const runnerByTab = new Map(race.runners.map((r) => [r.tabNumber, r]));
  const complete = ranking.length >= required;
  const progress = memberRankingProgress(tournament, cupMeetings, member);
  const allDone = progress.total > 0 && progress.done >= progress.total;
  const raceIdx = races.findIndex((r) => r.raceNumber === race.raceNumber);
  const nextRace = races[raceIdx + 1];

  const save = (next: number[]) => {
    onUpdateTournament(setRanking(tournament, meeting.id, race.raceNumber, member, next));
    audioAlerts.playTapClick();
  };
  const add = (tab: number) => {
    if (ranking.includes(tab) || ranking.length >= required) return;
    save([...ranking, tab]);
  };
  const remove = (tab: number) => save(ranking.filter((t) => t !== tab));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= ranking.length) return;
    const next = [...ranking];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const fillCard = () => {
    let next = tournament;
    for (const r of races) {
      const current = getRanking(next, meeting.id, r.raceNumber, member);
      next = setRanking(next, meeting.id, r.raceNumber, member, fillRankingByOdds(r, current));
    }
    onUpdateTournament(next);
    audioAlerts.playTapClick();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-tight">Rank your horses</h1>
          <p className="text-[13px] ui-muted mt-1 max-w-xl">
            Tap runners in the order you want them. If someone drafts your first choice, you get your next one.
          </p>
        </div>
        {meetingSwitcher}
      </div>

      {/* Who and which race */}
      <div className="ui-surface p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="ui-label">Ranking for</span>
            <div className="ui-segment" role="group" aria-label="Member">
              {members.map((m) => (
                <button key={m} type="button" aria-pressed={m === member} onClick={() => setMember(m)}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="text-[12px] ui-muted ui-nums">
            {progress.done} of {progress.total} Cup races ranked
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Race">
          {races.map((r) => {
            const done = isRaceRankedBy(tournament, meeting.id, r, member);
            return (
              <button
                key={r.raceNumber}
                type="button"
                className="cup-race-chip"
                aria-pressed={r.raceNumber === race.raceNumber}
                data-done={done}
                onClick={() => setRaceNo(r.raceNumber)}
                title={`Race ${r.raceNumber}: ${r.raceName}${done ? " (ranked)" : ""}`}
              >
                {r.raceNumber === cupRaceNumber && <Trophy className="w-3.5 h-3.5 cup-tick" aria-label="Melbourne Cup" />}
                R{r.raceNumber}
                {done && <Check className="w-3.5 h-3.5 cup-tick" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* The ranking */}
        <section className="ui-surface p-4 sm:p-5 space-y-3 lg:sticky lg:top-[132px] self-start">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="ui-label">
                Race {race.raceNumber}
                {race.startTime ? ` · ${race.startTime}` : ""}
                {race.distance ? ` · ${race.distance}m` : ""}
              </div>
              <h2 className="text-[16px] font-semibold mt-0.5 truncate">{race.raceName}</h2>
              {race.raceNumber === cupRaceNumber && <span className="cup-tag is-accent mt-1.5">The race that stops the nation</span>}
            </div>
            <span className={`cup-tag ${complete ? "is-accent" : ""}`}>
              {ranking.length}/{required}
            </span>
          </div>

          <ol className="space-y-1.5">
            {Array.from({ length: required }).map((_, i) => {
              const tab = ranking[i];
              const runner = tab !== undefined ? runnerByTab.get(tab) : undefined;
              if (tab === undefined) {
                return (
                  <li key={`empty-${i}`} className="cup-slot is-empty">
                    <span className="cup-slot-rank">{i + 1}</span>
                    <span />
                    <span className="text-[12px]">{i === ranking.length ? "Tap a runner to add" : ""}</span>
                    <span />
                  </li>
                );
              }
              return (
                <li key={tab} className="cup-slot">
                  <span className="cup-slot-rank">{i + 1}</span>
                  <span className="cup-saddle">{tab}</span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium truncate">{runner?.horseName || `Runner ${tab}`}</span>
                    {runner && <span className="block text-[11px] ui-muted truncate">{runner.jockey} · {price(runner)}</span>}
                  </span>
                  <span className="flex items-center">
                    <button type="button" className="cup-mini-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button type="button" className="cup-mini-btn" onClick={() => move(i, 1)} disabled={i === ranking.length - 1} aria-label="Move down">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button type="button" className="cup-mini-btn" onClick={() => remove(tab)} aria-label="Remove">
                      <X className="w-4 h-4" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {complete && nextRace ? (
              <button type="button" className="ui-btn-primary" onClick={() => setRaceNo(nextRace.raceNumber)}>
                Next race
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : complete && allDone ? (
              <button type="button" className="ui-btn-primary" onClick={onGoDraft}>
                Go to the draft
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" className="ui-btn" onClick={() => save(fillRankingByOdds(race, ranking))} disabled={complete}>
                Fill the rest by odds
              </button>
            )}
            {ranking.length > 0 && (
              <button type="button" className="ui-btn" onClick={() => save([])}>
                Clear
              </button>
            )}
          </div>
          <button type="button" className="text-[12px] ui-muted hover:underline cursor-pointer" onClick={fillCard}>
            Fill every unfinished race on this card by odds
          </button>
        </section>

        {/* The field */}
        <section className="ui-surface p-2 sm:p-3">
          <div className="flex items-center justify-between px-2 pt-2 pb-3">
            <h2 className="text-[15px] font-semibold">Field</h2>
            <span className="text-[12px] ui-muted">Shortest odds first</span>
          </div>
          <div className="space-y-0.5">
            {field.map((r) => {
              const pos = ranking.indexOf(r.tabNumber);
              const ranked = pos >= 0;
              return (
                <button
                  key={r.tabNumber}
                  type="button"
                  className="cup-runner"
                  disabled={ranked || complete}
                  data-ranked={ranked}
                  onClick={() => add(r.tabNumber)}
                >
                  <span className="cup-saddle">{r.tabNumber}</span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-medium truncate">{r.horseName}</span>
                    <span className="block text-[12px] ui-muted truncate">
                      Barrier {r.barrier} · {r.jockey}
                      {r.form ? ` · Form ${r.form}` : ""}
                    </span>
                  </span>
                  <span className="text-[13px] font-medium ui-nums">{price(r)}</span>
                  <span className="w-[72px] flex justify-end">
                    {ranked ? (
                      <span className="cup-tag is-accent">Rank {pos + 1}</span>
                    ) : !complete ? (
                      <span className="cup-tag">
                        <Plus className="w-3 h-3 mr-0.5" />
                        Add
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
