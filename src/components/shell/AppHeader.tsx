import React, { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ClipboardList,
  Cpu,
  FileText,
  Flag,
  Layers,
  LayoutGrid,
  RefreshCw,
  Settings2,
  Trophy,
} from "lucide-react";
import type { PunterProfile } from "../../types/racing";
import type {
  ActiveTab,
  AppThemeScheme,
  CloudSyncState,
  ProgressCount,
} from "../../types/ui";
import type { ScoringDisplayMode } from "../AllUsersSelectionsResults";

export interface AppHeaderProps {
  headerRef: React.Ref<HTMLElement>;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onHome: () => void;
  picksProgress: ProgressCount;
  resultsProgress: ProgressCount;

  punters: PunterProfile[];
  activePunterId: string;
  onSelectPunter: (punterId: string) => void;

  scoringMode: ScoringDisplayMode;
  onChangeScoringMode: (mode: ScoringDisplayMode) => void;
  themeScheme: AppThemeScheme;
  onChangeTheme: (scheme: AppThemeScheme) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;

  cupActive: boolean;
  onToggleCup: () => void;
  onOpenCupBoard: () => void;

  syncState: CloudSyncState;
  lastSyncedTime: string;
  onForceSync: () => void;

  onOpenReport: () => void;
  onOpenAiStudio: () => void;

  onRefresh: () => void;
  isRefreshing: boolean;
}

interface TabDef {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
}

/** Tab labels describe the task, so a first-time viewer knows where to go. */
const TABS: TabDef[] = [
  { id: "overview", label: "Race Day", icon: LayoutGrid, hint: "Today's meetings, form and odds" },
  { id: "selections", label: "My Picks", icon: ClipboardList, hint: "Choose your top 3 runners for each race" },
  { id: "exotics", label: "Exotics", icon: Layers, hint: "Group trifectas and quaddies" },
  { id: "results", label: "Results", icon: Flag, hint: "Leaderboard and official results" },
];

const THEMES: Array<{ id: AppThemeScheme; label: string }> = [
  { id: "default", label: "Turf" },
  { id: "apple", label: "Light" },
  { id: "obsidian", label: "Midnight" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Closes a popover when the user clicks outside it or presses Escape. */
function useDismiss(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, close]);
}

export const AppHeader: React.FC<AppHeaderProps> = (props) => {
  const {
    headerRef,
    activeTab,
    onSelectTab,
    onHome,
    picksProgress,
    resultsProgress,
    punters,
    activePunterId,
    onSelectPunter,
    scoringMode,
    onChangeScoringMode,
    themeScheme,
    onChangeTheme,
    soundEnabled,
    onToggleSound,
    cupActive,
    onToggleCup,
    onOpenCupBoard,
    syncState,
    lastSyncedTime,
    onForceSync,
    onOpenReport,
    onOpenAiStudio,
    onRefresh,
    isRefreshing,
  } = props;

  const [punterOpen, setPunterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const punterRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  useDismiss(punterOpen, punterRef, () => setPunterOpen(false));
  useDismiss(settingsOpen, settingsRef, () => setSettingsOpen(false));

  const activePunter = punters.find((p) => p.id === activePunterId) || punters[0];
  const tabs: TabDef[] = TABS;

  const badgeFor = (id: ActiveTab): string | null => {
    if (id === "selections" && picksProgress.total > 0) {
      return `${picksProgress.done}/${picksProgress.total}`;
    }
    if (id === "results" && resultsProgress.total > 0) {
      return `${resultsProgress.done}/${resultsProgress.total}`;
    }
    return null;
  };

  const runAndClose = (fn: () => void) => () => {
    fn();
    setSettingsOpen(false);
  };

  return (
    <header ref={headerRef} className="ui-shell-header sticky top-0 z-40">
      <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 h-14">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              onHome();
            }}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer"
            aria-label="TurfSheet home"
          >
            <span
              aria-hidden="true"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold bg-[var(--ui-accent)] text-[var(--ui-accent-contrast)]"
            >
              TS
            </span>
            <span className="hidden sm:flex flex-col leading-tight">
              <span className="text-[15px] font-semibold tracking-tight">TurfSheet</span>
              <span className="text-[11px] ui-muted">Punters Club</span>
            </span>
          </a>

          <nav role="tablist" aria-label="Main sections" className="ui-tabs hidden md:flex flex-1 justify-center h-full">
            {tabs.map((t) => {
              const Icon = t.icon;
              const badge = badgeFor(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t.id}
                  title={t.hint}
                  onClick={() => onSelectTab(t.id)}
                  className="ui-tab h-full !rounded-none"
                >
                  <Icon className="w-4 h-4" />
                  <span>{t.label}</span>
                  {badge && <span className="ui-tab-badge">{badge}</span>}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 ml-auto md:ml-0 shrink-0">
            {/* Who am I picking for: the one identity control, always labelled. */}
            <div className="relative" ref={punterRef}>
              <button
                type="button"
                onClick={() => {
                  setPunterOpen((v) => !v);
                  setSettingsOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={punterOpen}
                className="ui-btn !pl-1.5 !pr-2.5 !py-1"
                title="Switch which member you are picking for"
              >
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]">
                  {initials(activePunter?.name || "?")}
                </span>
                <span className="hidden lg:flex flex-col items-start leading-tight">
                  <span className="text-[10px] ui-muted">Picking as</span>
                  <span className="text-[13px] font-semibold max-w-[140px] truncate">{activePunter?.name}</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 ui-muted" />
              </button>
              {punterOpen && (
                <div role="menu" className="ui-menu">
                  <div className="ui-menu-section">
                    <span className="ui-label">Picking as</span>
                    {punters.map((p) => {
                      const selected = p.id === activePunter?.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selected}
                          className="ui-menu-item"
                          onClick={() => {
                            onSelectPunter(p.id);
                            setPunterOpen(false);
                          }}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold bg-[var(--ui-surface-2)] ui-text shrink-0">
                              {initials(p.name)}
                            </span>
                            <span className="truncate">{p.name}</span>
                          </span>
                          {selected && <Check className="w-4 h-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {cupActive && (
              <button
                type="button"
                onClick={() => onSelectTab("cup")}
                className="ui-btn !border-[var(--ui-highlight)] !text-[var(--ui-highlight)]"
                title="Open the Cup tournament"
              >
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">Cup</span>
              </button>
            )}

            <button
              type="button"
              disabled={isRefreshing}
              onClick={onRefresh}
              className="ui-btn-primary !px-3 sm:!px-4"
              title="Fetch the latest fields, odds and results"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{isRefreshing ? "Updating" : "Refresh"}</span>
            </button>

            <div className="relative" ref={settingsRef}>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen((v) => !v);
                  setPunterOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={settingsOpen}
                aria-label="Settings and tools"
                title="Settings and tools"
                className="ui-icon-btn"
              >
                <Settings2 className="w-[18px] h-[18px]" />
                {syncState === "saving" && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--ui-highlight)]" />
                )}
              </button>
              {settingsOpen && (
                <div role="menu" className="ui-menu">
                  <div className="ui-menu-section space-y-3">
                    <div>
                      <span className="ui-label">Show scores as</span>
                      <div className="ui-segment is-block">
                        <button type="button" aria-pressed={scoringMode === "points"} onClick={() => onChangeScoringMode("points")}>
                          Points
                        </button>
                        <button type="button" aria-pressed={scoringMode === "dollars"} onClick={() => onChangeScoringMode("dollars")}>
                          $ Return
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="ui-label">Appearance</span>
                      <div className="ui-segment is-block">
                        {THEMES.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            aria-pressed={themeScheme === t.id}
                            onClick={() => onChangeTheme(t.id)}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button type="button" role="menuitemcheckbox" aria-checked={soundEnabled} className="ui-menu-item !px-1.5" onClick={onToggleSound}>
                      <span>Sound alerts</span>
                      <span className="ui-switch" data-on={soundEnabled} aria-hidden="true" />
                    </button>
                  </div>

                  <div className="ui-menu-section">
                    <span className="ui-label">Cup tournament</span>
                    <button type="button" role="menuitemcheckbox" aria-checked={cupActive} className="ui-menu-item" onClick={runAndClose(onToggleCup)}>
                      <span className="flex flex-col">
                        <span>Cup mode</span>
                        <span className="ui-menu-hint">A separate ranked draft for big race days</span>
                      </span>
                      <span className="ui-switch" data-on={cupActive} aria-hidden="true" />
                    </button>
                    {cupActive && (
                      <>
                        <button type="button" role="menuitem" className="ui-menu-item" onClick={runAndClose(onOpenCupBoard)}>
                          <span className="flex items-center gap-2.5"><Trophy className="w-4 h-4 ui-muted" />Open the Cup</span>
                        </button>
                      </>
                    )}
                  </div>

                  <div className="ui-menu-section">
                    <span className="ui-label">Tools</span>
                    <button type="button" role="menuitem" className="ui-menu-item" onClick={runAndClose(onOpenReport)}>
                      <span className="flex items-center gap-2.5"><FileText className="w-4 h-4 ui-muted" />Race report</span>
                    </button>
                    <button type="button" role="menuitem" className="ui-menu-item" onClick={runAndClose(onOpenAiStudio)}>
                      <span className="flex items-center gap-2.5"><Cpu className="w-4 h-4 ui-muted" />AI architecture blueprint</span>
                    </button>
                  </div>

                  <div className="ui-menu-section">
                    <button type="button" role="menuitem" className="ui-menu-item" onClick={onForceSync} title="Save to the cloud now">
                      <span className="flex items-center gap-2.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            syncState === "saving"
                              ? "bg-[var(--ui-highlight)]"
                              : syncState === "local"
                              ? "bg-[var(--ui-muted)]"
                              : "bg-[var(--ui-accent)]"
                          }`}
                        />
                        <span>
                          {syncState === "saving"
                            ? "Saving…"
                            : syncState === "local"
                            ? "Saved on this device"
                            : `Saved ${lastSyncedTime}`}
                        </span>
                      </span>
                      <span className="ui-menu-hint">Sync now</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Small screens: tabs drop to their own row so labels stay readable. */}
        <nav role="tablist" aria-label="Main sections" className="ui-tabs md:hidden -mx-1 pb-1.5">
          {tabs.map((t) => {
            const Icon = t.icon;
            const badge = badgeFor(t.id);
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                onClick={() => onSelectTab(t.id)}
                className="ui-tab !py-1.5 !text-[12px]"
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
                {badge && <span className="ui-tab-badge">{badge}</span>}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
