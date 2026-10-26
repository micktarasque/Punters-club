import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpen, Gauge, ListOrdered, RefreshCw, Shuffle, Trophy } from "lucide-react";
import type { CupTournamentState } from "../../types/cupMode";
import type { RaceMeeting } from "../../types/racing";
import { formatReadableDate } from "../../components/DateRangeCalendarBar";
import {
  daysUntil,
  findMelbourneCupRace,
  getCupDayCards,
  getCupStage,
  STAGE_LABEL,
  type CupView,
} from "./cupSelectors";
import { CupOverview } from "./CupOverview";
import { CupRankings } from "./CupRankings";
import { CupDraft } from "./CupDraft";
import { CupStandings } from "./CupStandings";
import { CupRules } from "./CupRules";

export interface CupWorkspaceProps {
  tournament: CupTournamentState;
  onUpdateTournament: (next: CupTournamentState) => void;
  /** Every meeting the app knows about; the Cup picks out its own day. */
  allMeetings: RaceMeeting[];
  todayIso: string;
  cupDate: string;
  onLoadCupDay: () => void;
  isLoading: boolean;
  defaultMember: string;
  view: CupView;
  onChangeView: (view: CupView) => void;
  onExit: () => void;
  onEndCup: () => void;
}

const NAV: Array<{ id: CupView; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "rank", label: "Rank horses", icon: ListOrdered },
  { id: "draft", label: "Draft", icon: Shuffle },
  { id: "standings", label: "Standings", icon: Trophy },
  { id: "rules", label: "How it works", icon: BookOpen },
];

/**
 * Melbourne Cup Day workspace. Self-contained: it replaces the club's header and
 * navigation, always targets Cup day (Flemington plus that day's Sydney card),
 * and inherits the active theme through --ui-* tokens.
 */
export const CupWorkspace: React.FC<CupWorkspaceProps> = ({
  tournament,
  onUpdateTournament,
  allMeetings,
  todayIso,
  cupDate,
  onLoadCupDay,
  isLoading,
  defaultMember,
  view,
  onChangeView,
  onExit,
  onEndCup,
}) => {
  const cards = useMemo(() => getCupDayCards(allMeetings, cupDate), [allMeetings, cupDate]);
  const cupMeetings = cards.list;
  const cupRace = findMelbourneCupRace(cards.flemington);
  const stage = useMemo(() => getCupStage(tournament, cupMeetings), [tournament, cupMeetings]);
  const days = daysUntil(todayIso, cupDate);

  const [meetingId, setMeetingId] = useState<string>("");
  const currentMeeting = cupMeetings.find((m) => m.id === meetingId) || cupMeetings[0] || null;

  // Fetch Cup day's cards once on open if they are not loaded yet.
  const requested = useRef(false);
  useEffect(() => {
    if (!cards.flemington && !requested.current) {
      requested.current = true;
      onLoadCupDay();
    }
  }, [cards.flemington, onLoadCupDay]);

  const go = (v: CupView) => {
    onChangeView(v);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const meetingSwitcher =
    cupMeetings.length > 1 && currentMeeting ? (
      <div className="ui-segment" role="group" aria-label="Race card">
        {cupMeetings.map((m) => (
          <button key={m.id} type="button" aria-pressed={m.id === currentMeeting.id} onClick={() => setMeetingId(m.id)}>
            {m.venue}
          </button>
        ))}
      </div>
    ) : null;

  const venues = cupMeetings.length > 0 ? cupMeetings.map((m) => m.venue).join(" & ") : "Flemington & Sydney";
  const whenLabel = days > 1 ? `In ${days} days` : days === 1 ? "Tomorrow" : days === 0 ? "Today" : null;

  return (
    <div className="cup-shell flex flex-col">
      <header className="cup-header sticky top-0 z-40">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-16">
            <button type="button" onClick={onExit} className="ui-btn !px-3" title="Return to the Punters Club">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Punters Club</span>
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <span className="cup-emblem" aria-hidden="true">
                <Trophy className="w-[18px] h-[18px]" />
              </span>
              <div className="min-w-0 leading-tight">
                <div className="text-[15px] font-semibold tracking-tight truncate">Melbourne Cup Day</div>
                <div className="text-[12px] ui-muted truncate">
                  {formatReadableDate(cupDate)} · {venues}
                </div>
              </div>
            </div>
            <span className="cup-pill ml-auto">
              <span className="cup-pill-dot" />
              {cupMeetings.length === 0 && whenLabel ? whenLabel : STAGE_LABEL[stage]}
            </span>
          </div>

          <nav role="tablist" aria-label="Cup sections" className="ui-tabs -mx-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <button
                  key={n.id}
                  type="button"
                  role="tab"
                  aria-selected={view === n.id}
                  onClick={() => go(n.id)}
                  className="ui-tab !rounded-b-none"
                >
                  <Icon className="w-4 h-4" />
                  {n.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {view === "rules" ? (
          <CupRules tournament={tournament} sydneyVenue={cards.sydney?.venue} />
        ) : !currentMeeting ? (
          <section className="ui-surface p-8 sm:p-12 text-center space-y-3">
            <span className="cup-emblem mx-auto !w-12 !h-12" aria-hidden="true">
              <Trophy className="w-6 h-6" />
            </span>
            <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-tight">
              {whenLabel ? `Melbourne Cup Day · ${whenLabel}` : "Melbourne Cup Day"}
            </h1>
            <p className="text-[14px] ui-muted max-w-lg mx-auto">
              {formatReadableDate(cupDate)}. The Flemington and Sydney fields appear here as soon as the race cards
              are published. Rankings and the draft open then.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <button type="button" className="ui-btn-primary" onClick={onLoadCupDay} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
                {isLoading ? "Checking for fields" : "Check for fields"}
              </button>
              <button type="button" className="ui-btn" onClick={() => go("rules")}>
                How the Cup works
              </button>
            </div>
          </section>
        ) : view === "overview" ? (
          <CupOverview
            tournament={tournament}
            onUpdateTournament={onUpdateTournament}
            cupMeetings={cupMeetings}
            cupRaceLabel={cupRace ? `Melbourne Cup is Race ${cupRace.raceNumber}${cupRace.startTime ? ` at ${cupRace.startTime}` : ""}` : null}
            missingSydney={!cards.sydney}
            stage={stage}
            onGo={go}
            onEndCup={onEndCup}
          />
        ) : view === "rank" ? (
          <CupRankings
            tournament={tournament}
            onUpdateTournament={onUpdateTournament}
            meeting={currentMeeting}
            cupMeetings={cupMeetings}
            cupRaceNumber={currentMeeting.id === cards.flemington?.id ? cupRace?.raceNumber ?? null : null}
            defaultMember={defaultMember}
            meetingSwitcher={meetingSwitcher}
            onGoDraft={() => go("draft")}
          />
        ) : view === "draft" ? (
          <CupDraft
            tournament={tournament}
            onUpdateTournament={onUpdateTournament}
            meeting={currentMeeting}
            cupMeetings={cupMeetings}
            cupRaceNumber={currentMeeting.id === cards.flemington?.id ? cupRace?.raceNumber ?? null : null}
            meetingSwitcher={meetingSwitcher}
            onGoRank={() => go("rank")}
            onGoStandings={() => go("standings")}
          />
        ) : (
          <CupStandings tournament={tournament} cupMeetings={cupMeetings} />
        )}
      </main>
    </div>
  );
};
