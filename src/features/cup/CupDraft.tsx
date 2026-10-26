import React, { useMemo, useState } from "react";
import { AlertCircle, ArrowRight, FastForward, Play, RotateCcw } from "lucide-react";
import type { CupTournamentState } from "../../types/cupMode";
import type { RaceMeeting } from "../../types/racing";
import {
  getDraftOrderForRace,
  resetDraftSelectionsKeepPreferences,
  resolveAllSequentialDraftSteps,
  resolveNextSequentialDraftStep,
} from "../../utils/cupMode";
import { audioAlerts } from "../../utils/audioAlerts";
import {
  cleanCallout,
  getDraftProgress,
  getMeetingDetails,
  getMeetingPicks,
  getRanking,
  memberRankingProgress,
  ordinal,
} from "./cupSelectors";
import type { CupAllocatedPickInfo } from "../../types/cupMode";

/** Describes how a drafted horse was chosen, in plain language. */
function describePick(info: CupAllocatedPickInfo | undefined, rankingLength: number): string {
  if (!info) return "Drafted";
  if (rankingLength === 0 || info.preferenceRankUsed > rankingLength) return "Auto-assigned, no ranking";
  if (!info.wasFallback) return "1st choice";
  return `${ordinal(info.preferenceRankUsed)} choice${info.originallyTakenBy ? `, 1st taken by ${info.originallyTakenBy}` : ""}`;
}

interface CupDraftProps {
  tournament: CupTournamentState;
  onUpdateTournament: (next: CupTournamentState) => void;
  meeting: RaceMeeting;
  cupMeetings: RaceMeeting[];
  cupRaceNumber: number | null;
  meetingSwitcher: React.ReactNode;
  onGoRank: () => void;
  onGoStandings: () => void;
}

export const CupDraft: React.FC<CupDraftProps> = ({
  tournament,
  onUpdateTournament,
  meeting,
  cupMeetings,
  cupRaceNumber,
  meetingSwitcher,
  onGoRank,
  onGoStandings,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);
  const draft = useMemo(() => getDraftProgress(tournament, cupMeetings), [tournament, cupMeetings]);
  const members = tournament.participants;
  const complete = draft.total > 0 && draft.done >= draft.total;
  const pct = draft.total > 0 ? Math.round((draft.done / draft.total) * 100) : 0;

  const incomplete = members
    .map((m) => ({ name: m, p: memberRankingProgress(tournament, cupMeetings, m) }))
    .filter((x) => x.p.done < x.p.total);

  const picks = getMeetingPicks(tournament, meeting.id);
  const details = getMeetingDetails(tournament, meeting.id);
  const races = [...meeting.races].sort((a, b) => a.raceNumber - b.raceNumber);

  const nextPick = () => {
    const res = resolveNextSequentialDraftStep(tournament, cupMeetings);
    const step = res.activeStep;
    let summary = cleanCallout(res.callout);
    if (step) {
      const m = cupMeetings.find((x) => x.id === step.meetingId);
      const tab = getMeetingPicks(res.tournament, step.meetingId)[step.raceNumber]?.[step.punterName];
      const horse = m?.races.find((r) => r.raceNumber === step.raceNumber)?.runners.find((r) => r.tabNumber === tab);
      const info = getMeetingDetails(res.tournament, step.meetingId)[step.raceNumber]?.[step.punterName];
      const len = getRanking(tournament, step.meetingId, step.raceNumber, step.punterName).length;
      if (tab !== undefined) {
        summary = `${step.punterName} took #${tab} ${horse?.horseName || ""} in ${step.meetingVenue} Race ${step.raceNumber} (${describePick(info, len).toLowerCase()})`;
      }
    }
    onUpdateTournament({ ...res.tournament, lastDraftStepCallout: summary });
    audioAlerts.playRaceWinnerChime();
  };
  const runAll = () => {
    onUpdateTournament(resolveAllSequentialDraftSteps(tournament, cupMeetings));
    audioAlerts.playRaceWinnerChime();
  };
  const reset = () => {
    onUpdateTournament(resetDraftSelectionsKeepPreferences(tournament));
    setConfirmReset(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-tight">Draft</h1>
          <p className="text-[13px] ui-muted mt-1 max-w-xl">
            Members take turns, one horse each per race, using their rankings.
            {cupMeetings.length > 1 ? ` ${cupMeetings[0].venue} drafts first, then ${cupMeetings[1].venue}.` : ""}
          </p>
        </div>
        {meetingSwitcher}
      </div>

      {incomplete.length > 0 && !complete && (
        <div className="ui-surface p-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <AlertCircle className="w-5 h-5 shrink-0 ui-accent-text mt-0.5" />
            <div className="min-w-0">
              <div className="text-[14px] font-semibold">Some rankings are unfinished</div>
              <p className="text-[12px] ui-muted mt-0.5">
                {incomplete.map((x) => `${x.name} (${x.p.done}/${x.p.total})`).join(", ")}. Missing rankings fall back to the lowest-numbered runner still available.
              </p>
            </div>
          </div>
          <button type="button" className="ui-btn" onClick={onGoRank}>
            Finish rankings
          </button>
        </div>
      )}

      {/* Control panel */}
      <section className="ui-surface p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="ui-label">{complete ? "Draft complete" : "Up next"}</div>
            <div className="text-[18px] font-semibold mt-1">
              {complete
                ? "Every horse has been allocated"
                : draft.next
                ? `${draft.next.punterName} · ${draft.next.meetingVenue} Race ${draft.next.raceNumber}`
                : "Ready to start"}
            </div>
            {tournament.lastDraftStepCallout && (
              <p className="text-[13px] ui-muted mt-1">Last pick: {cleanCallout(tournament.lastDraftStepCallout)}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {complete ? (
              <button type="button" className="ui-btn-primary" onClick={onGoStandings}>
                View standings
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button type="button" className="ui-btn-primary" onClick={nextPick}>
                  <Play className="w-4 h-4" />
                  Make next pick
                </button>
                <button type="button" className="ui-btn" onClick={runAll}>
                  <FastForward className="w-4 h-4" />
                  Run full draft
                </button>
              </>
            )}
            {draft.done > 0 &&
              (confirmReset ? (
                <>
                  <button type="button" className="ui-btn !text-[var(--ui-danger)]" onClick={reset}>
                    Confirm reset
                  </button>
                  <button type="button" className="ui-btn" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" className="ui-btn" onClick={() => setConfirmReset(true)} title="Clear all drafted horses. Rankings are kept.">
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              ))}
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[12px] ui-muted mb-1.5 ui-nums">
            <span>{draft.done} of {draft.total} picks</span>
            <span>{pct}%</span>
          </div>
          <span className="ui-progress block" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </span>
        </div>
      </section>

      {/* Allocation grid for the selected card */}
      <section className="ui-surface">
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-[16px] font-semibold">{meeting.venue} allocations</h2>
          <p className="text-[12px] ui-muted mt-0.5">
            {tournament.draftType === "snake"
              ? "Snake order: the pick order reverses every second race."
              : "Fixed order: the same member picks first in every race."}
          </p>
        </div>
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Race</th>
                {members.map((m) => (
                  <th key={m}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {races.map((r) => {
                const order = getDraftOrderForRace(r.raceNumber, members, tournament.draftType);
                return (
                  <tr key={r.raceNumber}>
                    <td className="whitespace-nowrap">
                      <div className="font-semibold flex items-center gap-1.5">
                        R{r.raceNumber}
                        {r.raceNumber === cupRaceNumber && <span className="cup-tag is-accent">Cup</span>}
                      </div>
                      <div className="text-[11px] ui-muted max-w-[160px] truncate">{r.raceName}</div>
                    </td>
                    {members.map((m) => {
                      const tab = picks[r.raceNumber]?.[m];
                      const runner = tab !== undefined ? r.runners.find((x) => x.tabNumber === tab) : undefined;
                      const info = details[r.raceNumber]?.[m];
                      const turn = order.indexOf(m) + 1;
                      return (
                        <td key={m} className="min-w-[150px]">
                          {tab === undefined ? (
                            <span className="text-[12px] ui-muted">Picks {ordinal(turn)}</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="cup-saddle shrink-0">{tab}</span>
                              <div className="min-w-0">
                                <div className="text-[13px] font-medium truncate max-w-[160px]">{runner?.horseName || `Runner ${tab}`}</div>
                                <div className="text-[11px] ui-muted">
                                  {describePick(info, getRanking(tournament, meeting.id, r.raceNumber, m).length)}
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
