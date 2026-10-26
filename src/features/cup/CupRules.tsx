import React from "react";
import type { CupTournamentState } from "../../types/cupMode";
import { getDraftOrderForRace } from "../../utils/cupMode";

interface CupRulesProps {
  tournament: CupTournamentState;
  sydneyVenue?: string;
}

/** Plain-language rules that match the draft and scoring engine in utils/cupMode. */
export const CupRules: React.FC<CupRulesProps> = ({ tournament, sydneyVenue }) => {
  const members = tournament.participants;
  const r1 = getDraftOrderForRace(1, members, tournament.draftType);
  const r2 = getDraftOrderForRace(2, members, tournament.draftType);

  const rules: Array<{ title: string; body: React.ReactNode }> = [
    {
      title: "Rank your horses",
      body: "Before the draft, every member ranks up to eight runners in each race, best first. Smaller fields need fewer ranks.",
    },
    {
      title: "Take turns",
      body:
        tournament.draftType === "snake" ? (
          <>
            The draft goes race by race, one horse per member. Snake order reverses every second race:
            Race 1 goes {r1.join(", ")}; Race 2 goes {r2.join(", ")}.
          </>
        ) : (
          <>The draft goes race by race, one horse per member, in the same order every race: {r1.join(", ")}.</>
        ),
    },
    {
      title: "No doubling up",
      body: "Only one member can hold a horse in a race. If your first choice is taken, you get your highest-ranked horse still available. If all of yours are gone, you get the lowest-numbered runner left.",
    },
    {
      title: "Flemington and Sydney",
      body: `Cup day covers every race at Flemington and at the ${sydneyVenue || "Sydney"} meeting. Flemington is drafted first, then ${sydneyVenue || "Sydney"}.`,
    },
    {
      title: "Scoring",
      body: "A winner earns 3 points, second earns 2, and third earns 1 in fields of eight or more. Returns assume a $1 win and $1 place bet on each horse at TAB dividends.",
    },
    {
      title: "Group trifecta",
      body: "In each race, every member's drafted horse can be boxed into one flexi trifecta for the group.",
    },
  ];

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-tight">How Melbourne Cup Day works</h1>
        <p className="text-[13px] ui-muted mt-1">Six rules. Everything else is handled for you.</p>
      </div>
      <ol className="ui-surface divide-y divide-[var(--ui-border)]">
        {rules.map((r, i) => (
          <li key={r.title} className="flex gap-4 p-5">
            <span className="ui-step-index !border-[var(--ui-highlight)] !text-[var(--ui-highlight)]">{i + 1}</span>
            <div>
              <h2 className="text-[15px] font-semibold">{r.title}</h2>
              <p className="text-[13px] ui-muted mt-1 leading-relaxed">{r.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};
