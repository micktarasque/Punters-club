import React from "react";
import { ArrowRight, Check, ChevronDown, X } from "lucide-react";
import type { ProgressCount } from "../../types/ui";

/* -------------------------------------------------------------------------- */
/* PageIntro: every tab opens with a plain-language title and one instruction. */
/* -------------------------------------------------------------------------- */

export interface PageIntroProps {
  title: string;
  description: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageIntro: React.FC<PageIntroProps> = ({ title, description, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 pb-1">
    <div className="min-w-0">
      <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-tight ui-text">{title}</h1>
      <p className="text-[13px] sm:text-sm ui-muted mt-1 max-w-2xl leading-relaxed">{description}</p>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

/* -------------------------------------------------------------------------- */
/* RaceDayBriefing: the three-step "what do I do" guide with live progress.    */
/* -------------------------------------------------------------------------- */

type StepState = "done" | "current" | "upcoming";

export interface RaceDayBriefingProps {
  venue: string;
  dateLabel: string;
  meetingsCount: number;
  nextRaceLabel?: string | null;
  picks: ProgressCount;
  results: ProgressCount;
  onStudyField: () => void;
  onMakePicks: () => void;
  onViewResults: () => void;
}

function pct(p: ProgressCount): number {
  return p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
}

export const RaceDayBriefing: React.FC<RaceDayBriefingProps> = ({
  venue,
  dateLabel,
  meetingsCount,
  nextRaceLabel,
  picks,
  results,
  onStudyField,
  onMakePicks,
  onViewResults,
}) => {
  const picksComplete = picks.total > 0 && picks.done >= picks.total;
  const resultsComplete = results.total > 0 && results.done >= results.total;

  const s1: StepState = picks.done > 0 ? "done" : "current";
  const s2: StepState = picksComplete ? "done" : s1 === "done" ? "current" : "upcoming";
  const s3: StepState = resultsComplete ? "done" : s2 === "done" ? "current" : "upcoming";

  const steps: Array<{
    n: number;
    state: StepState;
    title: string;
    detail: string;
    progress?: ProgressCount;
    onClick: () => void;
  }> = [
    {
      n: 1,
      state: s1,
      title: "Study the field",
      detail: "Check form, odds and speed maps below",
      onClick: onStudyField,
    },
    {
      n: 2,
      state: s2,
      title: "Make your picks",
      detail: `${picks.done} of ${picks.total} races picked`,
      progress: picks,
      onClick: onMakePicks,
    },
    {
      n: 3,
      state: s3,
      title: "Follow the results",
      detail: `${results.done} of ${results.total} races official`,
      progress: results,
      onClick: onViewResults,
    },
  ];

  return (
    <section aria-label="Race day briefing" className="ui-surface overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 sm:px-5 pt-4">
        <div className="text-[13px] ui-muted">
          <span className="ui-text font-semibold text-[15px]">{venue}</span>
          <span className="mx-2">·</span>
          {dateLabel}
          {meetingsCount > 1 && (
            <>
              <span className="mx-2">·</span>
              {meetingsCount} meetings
            </>
          )}
        </div>
        {nextRaceLabel && (
          <div className="text-[13px] ui-muted">
            Next up <span className="ui-text font-medium">{nextRaceLabel}</span>
          </div>
        )}
      </div>
      <ol className="grid grid-cols-1 md:grid-cols-3 gap-1 p-2">
        {steps.map((s) => (
          <li key={s.n}>
            <button
              type="button"
              className="ui-step group"
              data-state={s.state}
              onClick={s.onClick}
              aria-current={s.state === "current" ? "step" : undefined}
            >
              <span className="ui-step-index">{s.state === "done" ? <Check className="w-3.5 h-3.5" /> : s.n}</span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold">{s.title}</span>
                  <ArrowRight className="w-4 h-4 ui-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
                <span className="block text-[12px] ui-muted mt-0.5">{s.detail}</span>
                {s.progress && s.progress.total > 0 && (
                  <span className="ui-progress block mt-2" aria-hidden="true">
                    <span style={{ width: `${pct(s.progress)}%` }} />
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/* SectionDisclosure: secondary data stays one click away, collapsed.          */
/* -------------------------------------------------------------------------- */

export interface SectionDisclosureProps {
  id?: string;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const SectionDisclosure: React.FC<SectionDisclosureProps> = ({
  id,
  title,
  summary,
  open,
  onToggle,
  children,
}) => {
  const panelId = id ? `${id}-panel` : undefined;
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <div className="ui-surface">
        <button
          type="button"
          className="ui-disclosure-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold">{title}</span>
            <span className="block text-[12px] ui-muted mt-0.5">{summary}</span>
          </span>
          <span className="flex items-center gap-2 text-[12px] ui-muted shrink-0">
            <span className="hidden sm:inline">{open ? "Hide" : "Show"}</span>
            <ChevronDown className="ui-disclosure-chevron w-4 h-4" />
          </span>
        </button>
      </div>
      {open && <div id={panelId}>{children}</div>}
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/* Toast: one quiet, floating confirmation instead of an inline banner.        */
/* -------------------------------------------------------------------------- */

export interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, actionLabel, onAction, onDismiss }) => (
  <div role="status" aria-live="polite" className="ui-toast">
    <span className="min-w-0">{message}</span>
    {actionLabel && onAction && (
      <button type="button" onClick={onAction}>
        {actionLabel}
      </button>
    )}
    <button type="button" onClick={onDismiss} aria-label="Dismiss">
      <X className="w-4 h-4" />
    </button>
  </div>
);
