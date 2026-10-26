import React, { useMemo, useState } from "react";
import { ArrowRight, Check, Plus, X } from "lucide-react";
import type { CupTournamentState } from "../../types/cupMode";
import type { RaceMeeting } from "../../types/racing";
import {
  combinedLeaderboard,
  getDraftProgress,
  getMeetingPicks,
  getResultsProgress,
  memberRankingProgress,
  type CupStage,
  type CupView,
} from "./cupSelectors";

interface CupOverviewProps {
  tournament: CupTournamentState;
  onUpdateTournament: (next: CupTournamentState) => void;
  cupMeetings: RaceMeeting[];
  cupRaceLabel: string | null;
  missingSydney: boolean;
  stage: CupStage;
  onGo: (view: CupView) => void;
  onEndCup: () => void;
}

const STAGE_ORDER: CupStage[] = ["ranking", "drafting", "racing"];

export const CupOverview: React.FC<CupOverviewProps> = ({
  tournament,
  onUpdateTournament,
  cupMeetings,
  cupRaceLabel,
  missingSydney,
  stage,
  onGo,
  onEndCup,
}) => {
  const [newMember, setNewMember] = useState("");
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const draft = useMemo(() => getDraftProgress(tournament, cupMeetings), [tournament, cupMeetings]);
  const results = useMemo(() => getResultsProgress(cupMeetings), [cupMeetings]);
  const standings = useMemo(() => combinedLeaderboard(tournament, cupMeetings), [tournament, cupMeetings]);

  const members = tournament.participants.map((name) => {
    const ranking = memberRankingProgress(tournament, cupMeetings, name);
    let drafted = 0;
    for (const m of cupMeetings) {
      const picks = getMeetingPicks(tournament, m.id);
      for (const r of m.races) if (picks[r.raceNumber]?.[name] !== undefined) drafted += 1;
    }
    const row = standings.find((s) => s.punterName === name);
    return { name, ranking, drafted, points: row?.totalPoints ?? 0, rank: row?.rank ?? 0 };
  });

  const rankedMembers = members.filter((m) => m.ranking.total > 0 && m.ranking.done >= m.ranking.total).length;
  const leader = standings[0];
  const hasScores = standings.some((s) => s.totalPoints > 0);

  const steps = [
    {
      stage: "ranking" as CupStage,
      title: "Rank horses",
      detail: `${rankedMembers} of ${members.length} members finished`,
      view: "rank" as CupView,
    },
    {
      stage: "drafting" as CupStage,
      title: "Run the draft",
      detail: `${draft.done} of ${draft.total} picks made`,
      view: "draft" as CupView,
    },
    {
      stage: "racing" as CupStage,
      title: "Watch the races",
      detail: `${results.done} of ${results.total} races official`,
      view: "standings" as CupView,
    },
  ];
  const currentIndex = stage === "complete" ? 3 : STAGE_ORDER.indexOf(stage);

  const nextAction =
    stage === "ranking"
      ? { label: "Rank your horses", view: "rank" as CupView, text: "Every member ranks up to eight horses in each race before the draft." }
      : stage === "drafting"
      ? {
          label: "Continue the draft",
          view: "draft" as CupView,
          text: draft.next
            ? `Next pick: ${draft.next.punterName}, ${draft.next.meetingVenue} Race ${draft.next.raceNumber}.`
            : "Rankings are in. Run the draft to allocate one horse per member per race.",
        }
      : {
          label: "View standings",
          view: "standings" as CupView,
          text: leader && hasScores
            ? `${leader.punterName} leads on ${leader.totalPoints} points.`
            : "All horses are allocated. Standings update as each race is declared official.",
        };

  const addMember = () => {
    const name = newMember.trim();
    if (!name) return;
    if (tournament.participants.some((p) => p.toLowerCase() === name.toLowerCase())) {
      setRosterError(`${name} is already in the Cup.`);
      return;
    }
    onUpdateTournament({
      ...tournament,
      participants: [...tournament.participants, name],
      updatedAt: new Date().toISOString(),
    });
    setNewMember("");
    setRosterError(null);
  };

  const removeMember = (name: string) => {
    if (tournament.participants.length <= 2) {
      setRosterError("The Cup needs at least two members.");
      return;
    }
    if (draft.done > 0) {
      setRosterError("Reset the draft before removing a member.");
      return;
    }
    onUpdateTournament({
      ...tournament,
      participants: tournament.participants.filter((p) => p !== name),
      updatedAt: new Date().toISOString(),
    });
    setRosterError(null);
  };

  return (
    <div className="space-y-6">
      {/* Where are we, and what happens next */}
      <section className="ui-surface overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 sm:p-6">
          <div className="max-w-xl">
            <div className="ui-label">Next step</div>
            <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-tight mt-1">{nextAction.label}</h1>
            <p className="text-[14px] ui-muted mt-1">{nextAction.text}</p>
            {(cupRaceLabel || missingSydney) && (
              <p className="text-[12px] ui-muted mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {cupRaceLabel && <span className="ui-accent-text font-medium">{cupRaceLabel}</span>}
                {missingSydney && <span>The Sydney card is not published yet. Flemington is ready.</span>}
              </p>
            )}
          </div>
          <button type="button" className="ui-btn-primary !py-3 !px-5 self-start lg:self-center" onClick={() => onGo(nextAction.view)}>
            {nextAction.label}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-1 p-2 border-t border-[var(--ui-border)]">
          {steps.map((s, i) => {
            const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming";
            return (
              <li key={s.title}>
                <button type="button" className="ui-step" data-state={state} onClick={() => onGo(s.view)}>
                  <span className="ui-step-index">{state === "done" ? <Check className="w-3.5 h-3.5" /> : i + 1}</span>
                  <span>
                    <span className="block text-[14px] font-semibold">{s.title}</span>
                    <span className="block text-[12px] ui-muted mt-0.5">{s.detail}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Members at a glance */}
      <section className="ui-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h2 className="text-[16px] font-semibold">Members</h2>
            <p className="text-[12px] ui-muted mt-0.5">Ranking progress, drafted horses and points for each member.</p>
          </div>
        </div>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Rankings</th>
                <th className="num">Horses drafted</th>
                <th className="num">Points</th>
                <th aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const pct = m.ranking.total > 0 ? Math.round((m.ranking.done / m.ranking.total) * 100) : 0;
                return (
                  <tr key={m.name}>
                    <td>
                      <span className="font-medium">{m.name}</span>
                      {hasScores && m.rank === 1 && <span className="cup-tag is-accent ml-2">Leader</span>}
                    </td>
                    <td className="min-w-[180px]">
                      <div className="flex items-center gap-3">
                        <span className="ui-progress block flex-1 max-w-[160px]" aria-hidden="true">
                          <span style={{ width: `${pct}%` }} />
                        </span>
                        <span className="text-[12px] ui-muted ui-nums whitespace-nowrap">
                          {m.ranking.done}/{m.ranking.total} races
                        </span>
                      </div>
                    </td>
                    <td className="num">{m.drafted}</td>
                    <td className="num font-semibold">{m.points}</td>
                    <td className="num">
                      <button
                        type="button"
                        className="cup-mini-btn"
                        onClick={() => removeMember(m.name)}
                        aria-label={`Remove ${m.name}`}
                        title={`Remove ${m.name}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-5 py-4 border-t border-[var(--ui-border)]">
          <input
            className="cup-input flex-1 max-w-xs"
            placeholder="Add a member"
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMember()}
            aria-label="New member name"
          />
          <button type="button" className="ui-btn" onClick={addMember} disabled={!newMember.trim()}>
            <Plus className="w-4 h-4" />
            Add
          </button>
          {rosterError && <span className="text-[12px] ui-neg">{rosterError}</span>}
        </div>
      </section>

      {/* Settings */}
      <section className="ui-surface p-5 grid gap-5 md:grid-cols-2">
        <div>
          <h2 className="text-[15px] font-semibold">Draft order</h2>
          <p className="text-[12px] ui-muted mt-0.5 mb-3">
            Snake reverses the order every second race so nobody always picks first.
          </p>
          <div className="ui-segment">
            <button
              type="button"
              aria-pressed={tournament.draftType === "snake"}
              disabled={draft.done > 0}
              onClick={() => onUpdateTournament({ ...tournament, draftType: "snake", updatedAt: new Date().toISOString() })}
            >
              Snake
            </button>
            <button
              type="button"
              aria-pressed={tournament.draftType === "fixed"}
              disabled={draft.done > 0}
              onClick={() => onUpdateTournament({ ...tournament, draftType: "fixed", updatedAt: new Date().toISOString() })}
            >
              Fixed
            </button>
          </div>
          {draft.done > 0 && <p className="text-[12px] ui-muted mt-2">Locked while a draft is in progress.</p>}
        </div>
        <div>
          <h2 className="text-[15px] font-semibold">End the Cup</h2>
          <p className="text-[12px] ui-muted mt-0.5 mb-3">
            Turns Cup mode off and returns everyone to normal picks. Rankings and draft results are kept.
          </p>
          {confirmEnd ? (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="ui-btn !text-[var(--ui-danger)]" onClick={onEndCup}>
                Yes, end the Cup
              </button>
              <button type="button" className="ui-btn" onClick={() => setConfirmEnd(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="ui-btn" onClick={() => setConfirmEnd(true)}>
              End Cup mode
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
