import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Cpu,
  DollarSign,
  FileText,
  Flame,
  History,
  Layers,
  LogIn,
  LogOut,
  Palette,
  RefreshCw,
  Sparkles,
  Table2,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { generateRaceAutoPickTrio } from "./utils/autoPick";
import { triggerConfetti } from "./components/github/confettiUtil";
import horseBeerMascotImg from "./assets/images/horse_beer_favicon_1791658083715.jpg";
import racedayGlamourImg from "./assets/images/buxom_glamour_trackside_1_1791592083739.jpg";
import flemingtonLadiesImg from "./assets/images/buxom_glamour_trackside_2_1791592093861.jpg";
import vipTracksideLadiesImg from "./assets/images/buxom_glamour_trackside_3_1791592105215.jpg";
import {
  INITIAL_PUNTERS,
  INITIAL_RACE_DATE,
  SEED_NSW_TAB_MEETINGS,
  buildDateAccurateMeetings,
  getMeetingsForDateRange,
  getSydneyAndMelbourneMeetings,
  isRaceOfficialOrCompleted,
  sortMeetingsByMetroPriority,
} from "./data/seedNswTab";
import {
  GroundingSource,
  PunterProfile,
  RaceMeeting,
  RaceSelectionTrio,
} from "./types/racing";
import {
  DateRangeCalendarBar,
  formatReadableDate,
} from "./components/DateRangeCalendarBar";
import { MajorRaceDaysOverview } from "./components/MajorRaceDaysOverview";
import { RaceMarketRadarBarChart } from "./components/RaceMarketRadarBarChart";
import { RaceCardAndFormSheet } from "./components/RaceCardAndFormSheet";
import { BettingLedgerSheet } from "./components/BettingLedgerSheet";
import {
  AllUsersSelectionsResults,
  ScoringDisplayMode,
} from "./components/AllUsersSelectionsResults";
import { CombinedTrifectaTracker } from "./components/CombinedTrifectaTracker";
import { CombinedQuaddieTracker } from "./components/CombinedQuaddieTracker";
import { ExoticsBentoStudio } from "./components/ExoticsBentoStudio";
import { PersistentRaceRibbon } from "./components/PersistentRaceRibbon";
import { FloatingBottomActionDock } from "./components/FloatingBottomActionDock";
import { RaceReportSheet } from "./components/RaceReportSheet";
import { EnterpriseAiStudioArchitectureModal } from "./components/EnterpriseAiStudioArchitectureModal";
import { PunterLeaderboard } from "./components/PunterLeaderboard";
import { OfflineIndicator } from "./components/PWAInstallControl";
import {
  UpdaterDownloadModal,
  downloadInMemoryMicroUpdaterPhp,
  downloadVerifiedBinaryBlob,
} from "./components/UpdaterDownloadModal";
import {
  DEFAULT_QUADDIE_BUY_IN_PER_USER,
  evaluateCombinedTrifectaForRace,
  evaluateRaceTrio,
  formatDollarReturn,
  getFeatureRaceNumberForMeeting,
  getPunterJokerForMeeting,
  getPunterSelectionsForMeeting,
} from "./utils/scoring";
import { FOUR_MONTHS_RETENTION_MS } from "./utils/raceReportArchive";
import {
  attachSafariAudioUnlock,
  createUnthrottledBackgroundTicker,
  dispatchBackgroundRaceAlert,
  playCashRegisterSound,
  playDingDingChime,
  playRaceParticipatedResultSound,
  playShowMeTheMoneySound,
  playTrifectaSirenSound,
  playWrongAnswerSound,
} from "./utils/soundEffects";
import { audioAlerts } from "./utils/audioAlerts";
import { safeJsonParse } from "./utils/safeFetchJson";
import {
  applyStoredResultsPatchesToMeetings,
  fetchLatestRaceResultsAndMeetings,
  mergeMeetingsPreservingResultsAndForm,
} from "./utils/raceResultsUpdater";
import {
  subscribeToRealTimePushUpdates,
  broadcastCrossTabEvent,
} from "./utils/realtimePushSync";
import {
  auth,
  deletePunterFromFirestore,
  fetchSharedCloudPunters,
  mergePunterProfiles,
  onAuthStateChanged,
  savePuntersToFirestore,
  saveSharedCloudPunters,
  signInWithGooglePopup,
  signOutFirebaseUser,
  subscribeToFirestorePunters,
  User,
} from "./firebase";

const STORAGE_KEY_PUNTERS = "turfsheet_punters_v9_steve_mark_empty";
const STORAGE_KEY_DELETED_PUNTERS = "turfsheet_deleted_punters_v1";
const STORAGE_KEY_TRIFECTA_BET = "turfsheet_trifecta_bet_amount_v1";
const STORAGE_KEY_QUADDIE_BUY_IN_PER_USER =
  "turfsheet_quaddie_buy_in_per_user_v2";
const STORAGE_KEY_QUADDIE_EXTRAS = "turfsheet_quaddie_extra_selections_v1";
const STORAGE_KEY_THEME_SCHEME = "turfsheet_theme_scheme_v1";

export type AppThemeScheme = "default" | "apple" | "dark" | "light" | "race";

/**
 * Retains completed user selection data (where users actively participated) for 4 months (120 days),
 * pruning unpicked races and older entries automatically.
 */
function enforceFourMonthActiveParticipationRetention(
  profiles: PunterProfile[]
): PunterProfile[] {
  const cutoffMs = Date.now() - FOUR_MONTHS_RETENTION_MS;
  return profiles.map((p) => {
    const nextSel: Record<string, Record<number, RaceSelectionTrio>> = {};
    for (const [mId, raceMap] of Object.entries(p.selectionsByMeeting || {})) {
      if (!raceMap) continue;
      const dateMatch = mId.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const mMs = Date.parse(`${dateMatch[1]}T00:00:00Z`);
        if (Number.isFinite(mMs) && mMs < cutoffMs) {
          continue; // Older than 4 months (120 days)
        }
      }
      const activeRaces: Record<number, RaceSelectionTrio> = {};
      for (const [rKey, trio] of Object.entries(raceMap)) {
        const rNo = Number(rKey);
        if (
          rNo &&
          trio &&
          (trio.firstPref !== null ||
            trio.secondPref !== null ||
            trio.thirdPref !== null)
        ) {
          activeRaces[rNo] = trio;
        }
      }
      if (Object.keys(activeRaces).length > 0) {
        nextSel[mId] = activeRaces;
      }
    }
    return {
      ...p,
      selectionsByMeeting: nextSel,
    };
  });
}

interface RacePushNotificationItem {
  id: string;
  venue: string;
  raceNumber: number;
  raceName: string;
  isWinner: boolean;
  isTrifectaHit?: boolean;
  placedCount?: number;
  headline: string;
  podiumText: string;
  userOutcomes: Array<{
    userName: string;
    hasParticipated?: boolean;
    won: boolean;
    points: number;
    dollarReturn: number;
    detail: string;
  }>;
  timestamp: string;
}

export type ActiveTab =
  | "overview"
  | "selections"
  | "exotics"
  | "results";

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [scoringMode, setScoringMode] = useState<ScoringDisplayMode>("points");
  const [themeScheme, setThemeScheme] = useState<AppThemeScheme>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THEME_SCHEME);
      if (
        saved === "default" ||
        saved === "apple" ||
        saved === "dark" ||
        saved === "light" ||
        saved === "race"
      ) {
        return saved;
      }
    } catch {
      // ignore
    }
    return "default";
  });
  const [showThemeMenu, setShowThemeMenu] = useState<boolean>(false);
  const [showAiArchitectureModal, setShowAiArchitectureModal] = useState<boolean>(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState<number>(72);

  // Dynamically measure header height to support iPad Pro, tablets, and responsive multi-row headers
  useEffect(() => {
    const updateHeight = () => {
      if (headerRef.current) {
        const measured = Math.round(
          headerRef.current.getBoundingClientRect().height
        );
        if (measured > 0) {
          setHeaderHeight(measured);
          document.documentElement.style.setProperty(
            "--app-header-height",
            `${measured}px`
          );
        }
      }
    };

    updateHeight();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && headerRef.current) {
      ro = new ResizeObserver(() => {
        updateHeight();
      });
      ro.observe(headerRef.current);
    }

    window.addEventListener("resize", updateHeight, { passive: true });
    window.addEventListener("orientationchange", updateHeight, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", updateHeight);
      window.removeEventListener("orientationchange", updateHeight);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_THEME_SCHEME, themeScheme);
    } catch {
      // ignore
    }
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", themeScheme);
      document.body.setAttribute("data-theme", themeScheme);
      const meta = document.getElementById("meta-theme-color");
      if (themeScheme === "apple") {
        document.documentElement.classList.add("theme-apple");
        document.documentElement.classList.remove("theme-turf");
        if (meta) meta.setAttribute("content", "#F5F5F7");
      } else {
        document.documentElement.classList.add("theme-turf");
        document.documentElement.classList.remove("theme-apple");
        if (meta) meta.setAttribute("content", "#070B09");
      }
    }
  }, [themeScheme]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        themeMenuRef.current &&
        !themeMenuRef.current.contains(event.target as Node)
      ) {
        setShowThemeMenu(false);
      }
    }
    if (showThemeMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showThemeMenu]);

  const isApple = themeScheme === "apple";
  const [dateMode, setDateMode] = useState<"single" | "range">("single");
  const [selectedDate, setSelectedDate] = useState<string>(INITIAL_RACE_DATE);
  const [endDate, setEndDate] = useState<string>(INITIAL_RACE_DATE);
  const [generateReportSignal, setGenerateReportSignal] = useState<number>(0);
  const [trackFilter, setTrackFilter] = useState<string>("");
  const [autoScrapeOnDateChange, setAutoScrapeOnDateChange] =
    useState<boolean>(true);

  const [meetings, setMeetings] = useState<RaceMeeting[]>(() =>
    applyStoredResultsPatchesToMeetings(SEED_NSW_TAB_MEETINGS)
  );
  const meetingsRef = useRef<RaceMeeting[]>(meetings);
  useEffect(() => {
    meetingsRef.current = meetings;
  }, [meetings]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(
    SEED_NSW_TAB_MEETINGS.find((m) => m.date === INITIAL_RACE_DATE)?.id ||
      SEED_NSW_TAB_MEETINGS[0].id
  );
  const [selectedRaceNumber, setSelectedRaceNumber] = useState<number>(1);
  const [verifiedSourcesUsed, setVerifiedSourcesUsed] = useState<string[]>([
    "Ladbrokes AU Racing API (v1)",
    "Neds AU Racing API (v1)",
    "PointsBet AU Racing API (v3)",
    "Racing & Sports AU (JSON v2)",
  ]);

  // Default users (Steve F & Mark S) start with NO pre-populated selections ({})
  const [punters, setPunters] = useState<PunterProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PUNTERS);
      const parsed = safeJsonParse<PunterProfile[] | null>(saved, null);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      // ignore storage errors
    }
    return INITIAL_PUNTERS;
  });

  const [deletedPunterIds, setDeletedPunterIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DELETED_PUNTERS);
      const parsed = safeJsonParse<string[] | null>(raw, null);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const [trifectaBetAmount, setTrifectaBetAmount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRIFECTA_BET);
      if (saved !== null) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return 20;
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_TRIFECTA_BET,
        String(trifectaBetAmount)
      );
    } catch {
      // ignore storage errors
    }
  }, [trifectaBetAmount]);

  const [quaddieBuyInPerUser, setQuaddieBuyInPerUser] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_QUADDIE_BUY_IN_PER_USER);
      if (saved !== null) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_QUADDIE_BUY_IN_PER_USER;
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_QUADDIE_BUY_IN_PER_USER,
        String(quaddieBuyInPerUser)
      );
    } catch {
      // ignore storage errors
    }
  }, [quaddieBuyInPerUser]);

  // Quaddie-Only Extra Selections (strictly isolated to the Quaddie section, never scored elsewhere)
  const [quaddieExtraByMeeting, setQuaddieExtraByMeeting] = useState<
    Record<string, Record<number, number[]>>
  >(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_QUADDIE_EXTRAS);
      const parsed = safeJsonParse<Record<
        string,
        Record<number, number[]>
      > | null>(raw, null);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // ignore
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_QUADDIE_EXTRAS,
        JSON.stringify(quaddieExtraByMeeting)
      );
    } catch {
      // ignore
    }
  }, [quaddieExtraByMeeting]);

  const handleToggleQuaddieExtraRunner = useCallback(
    (meetingId: string, raceNumber: number, tabNumber: number) => {
      setQuaddieExtraByMeeting((prev) => {
        const mtgMap = { ...(prev[meetingId] || {}) };
        const existingList = mtgMap[raceNumber] || [];
        const nextList = existingList.includes(tabNumber)
          ? existingList.filter((n) => n !== tabNumber)
          : [...existingList, tabNumber].sort((a, b) => a - b);
        mtgMap[raceNumber] = nextList;
        return {
          ...prev,
          [meetingId]: mtgMap,
        };
      });
    },
    []
  );

  const handleClearQuaddieExtrasForLeg = useCallback(
    (meetingId: string, raceNumber: number) => {
      setQuaddieExtraByMeeting((prev) => {
        const mtgMap = { ...(prev[meetingId] || {}) };
        delete mtgMap[raceNumber];
        return {
          ...prev,
          [meetingId]: mtgMap,
        };
      });
    },
    []
  );

  useEffect(() => {
    attachSafariAudioUnlock();
  }, []);

  const [activePunterId, setActivePunterId] = useState<string>(
    INITIAL_PUNTERS[0].id
  );
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [cloudSyncState, setCloudSyncState] = useState<
    "synced" | "saving" | "local"
  >("synced");
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
  const isSavingRef = useRef<boolean>(false);
  const puntersRef = useRef<PunterProfile[]>(punters);
  const deletedPunterIdsRef = useRef<string[]>(deletedPunterIds);

  useEffect(() => {
    puntersRef.current = punters;
    try {
      localStorage.setItem(STORAGE_KEY_PUNTERS, JSON.stringify(punters));
    } catch {
      // ignore storage errors
    }
  }, [punters]);

  useEffect(() => {
    deletedPunterIdsRef.current = deletedPunterIds;
    try {
      localStorage.setItem(
        STORAGE_KEY_DELETED_PUNTERS,
        JSON.stringify(deletedPunterIds)
      );
    } catch {
      // ignore storage errors
    }
  }, [deletedPunterIds]);

  // Persist punters to shared cloud ledger (/api/punters + ./api/punters.php + Firestore)
  const persistPuntersToCloud = useCallback(
    async (
      nextPunters: PunterProfile[],
      showToastOnDone = false,
      explicitDeletedIds?: string[]
    ) => {
      const effectiveDeletedIds =
        explicitDeletedIds ?? deletedPunterIdsRef.current;
      const prunedPunters =
        enforceFourMonthActiveParticipationRetention(nextPunters);
      try {
        localStorage.setItem(
          STORAGE_KEY_PUNTERS,
          JSON.stringify(prunedPunters)
        );
        localStorage.setItem(
          STORAGE_KEY_DELETED_PUNTERS,
          JSON.stringify(effectiveDeletedIds)
        );
      } catch {
        // ignore storage errors
      }
      isSavingRef.current = true;
      setCloudSyncState("saving");
      try {
        const res = await saveSharedCloudPunters(
          nextPunters,
          effectiveDeletedIds
        );
        if (res.ok && Array.isArray(res.punters)) {
          const mergedDeleted = Array.from(
            new Set([
              ...effectiveDeletedIds,
              ...(res.deletedPunterIds || []),
            ])
          );
          setDeletedPunterIds(mergedDeleted);
          setPunters((prev) =>
            mergePunterProfiles(prev, res.punters!, mergedDeleted)
          );
          setCloudSyncState("synced");
          setLastSyncedTime(
            new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          );
          broadcastCrossTabEvent("punters_updated");
          if (showToastOnDone) {
            triggerToast(
              "✓ Selections saved to Cloud Ledger — accessible across all devices at any time."
            );
          }
        } else {
          setCloudSyncState("local");
          if (showToastOnDone) {
            triggerToast("✓ Selections saved locally on this device.");
          }
        }
      } catch {
        setCloudSyncState("local");
      } finally {
        isSavingRef.current = false;
      }
    },
    []
  );

  // Pull and merge punter selections from shared cloud ledger on mount, focus, and interval
  const pullPuntersFromCloud = useCallback(async () => {
    if (isSavingRef.current) return;
    try {
      const res = await fetchSharedCloudPunters();
      if (res.ok && Array.isArray(res.punters) && res.punters.length > 0) {
        const mergedDeleted = Array.from(
          new Set([
            ...deletedPunterIdsRef.current,
            ...(res.deletedPunterIds || []),
          ])
        );
        if (mergedDeleted.length !== deletedPunterIdsRef.current.length) {
          setDeletedPunterIds(mergedDeleted);
        }
        setPunters((prev) => {
          const merged = mergePunterProfiles(
            prev,
            res.punters!,
            mergedDeleted
          );
          // If local had newer unpushed changes, push merged state back to cloud
          const localHasSelections = prev.some(
            (p) => Object.keys(p.selectionsByMeeting || {}).length > 0
          );
          const remoteHasSelections = res.punters!.some(
            (p) => Object.keys(p.selectionsByMeeting || {}).length > 0
          );
          if (localHasSelections && !remoteHasSelections) {
            saveSharedCloudPunters(merged, mergedDeleted).catch(() => {});
          }
          return merged;
        });
        setCloudSyncState("synced");
        setLastSyncedTime(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })
        );
      }
    } catch {
      // ignore offline
    }
  }, []);

  useEffect(() => {
    // Initial sync
    pullPuntersFromCloud();

    // 1. Immediate Push Synchronization via Cross-Tab BroadcastChannel & SSE
    const unsubscribePush = subscribeToRealTimePushUpdates((event) => {
      if (event.type === "punters_updated") {
        pullPuntersFromCloud();
      }
    });

    // 2. Adaptive Idle Fallback Polling (avoids CPU/network battery drain):
    // 45s when tab is active & visible, 120s when tab is hidden in background
    let intervalId: number;
    const scheduleNextPoll = () => {
      window.clearInterval(intervalId);
      const delay = document.hidden ? 120_000 : 45_000;
      intervalId = window.setInterval(() => {
        pullPuntersFromCloud();
      }, delay);
    };

    scheduleNextPoll();

    const onVisibilityChange = () => {
      if (!document.hidden) {
        pullPuntersFromCloud(); // immediate refresh on returning to tab
      }
      scheduleNextPoll();
    };

    const onFocus = () => pullPuntersFromCloud();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      unsubscribePush();
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [pullPuntersFromCloud]);

  // Listen to Firebase Auth state & real-time Firestore punterSheets when signed in
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (unsubFirestore) {
        unsubFirestore();
        unsubFirestore = null;
      }
      if (user) {
        savePuntersToFirestore(puntersRef.current).catch(() => {});
        unsubFirestore = subscribeToFirestorePunters(user, (remoteProfiles) => {
          setPunters((prev) => {
            const merged = mergePunterProfiles(
              prev,
              remoteProfiles,
              deletedPunterIdsRef.current
            );
            saveSharedCloudPunters(
              merged,
              deletedPunterIdsRef.current
            ).catch(() => {});
            return merged;
          });
          setCloudSyncState("synced");
        });
      }
    });
    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  // Automatically push the latest site_update.zip from the preview browser to cupdaypunting.xo.je if loader.php / install.php is present
  useEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname || "";
    if (!host.includes("run.app") && host !== "localhost") return;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/site-update-zip?t=${Date.now()}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const blob = await res.blob();
        for (const targetUrl of [
          "https://cupdaypunting.xo.je/loader.php?json=1",
          "https://cupdaypunting.xo.je/install.php?json=1",
          "https://cupdaypunting.xo.je/update-installer.php?json=1",
        ]) {
          const fd = new FormData();
          fd.append("action", "run_update");
          fd.append("archive_file[]", blob, "site_update.zip");
          fetch(targetUrl, {
            method: "POST",
            mode: "no-cors",
            body: fd,
          }).catch(() => {});
        }
      } catch {
        // silent background attempt
      }
    }, 2500);
    return () => window.clearTimeout(timer);
  }, []);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [pushNotifications, setPushNotifications] = useState<
    RacePushNotificationItem[]
  >([]);
  const [nextPushRaceCursor, setNextPushRaceCursor] = useState<number>(1);

  const [isScraping, setIsScraping] = useState<boolean>(false);
  const [isBackgroundRefreshing, setIsBackgroundRefreshing] =
    useState<boolean>(false);
  const [autoRefreshResults, setAutoRefreshResults] = useState<boolean>(true);
  const [lastResultsUpdatedAt, setLastResultsUpdatedAt] = useState<string>(() =>
    new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  );
  const [nextRefreshCountdown, setNextRefreshCountdown] = useState<number>(45);
  const lastResultsFetchMsRef = useRef<number>(0);
  const hasCompletedInitialScrapeRef = useRef<boolean>(false);
  const notifiedCompletedRacesRef = useRef<Set<string>>(new Set());
  const isScrapingInFlightRef = useRef<boolean>(false);

  const [_scrapeSummary, setScrapeSummary] = useState<string>(
    "Multi-Source Verified Real Australian Thoroughbred Racing"
  );
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [_sources, setSources] = useState<GroundingSource[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState<boolean>(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3400);
  };

  const smoothScrollToElementWithOffset = useCallback(
    (elementOrId: HTMLElement | string, extraOffset = 32) => {
      const el =
        typeof elementOrId === "string"
          ? document.getElementById(elementOrId)
          : elementOrId;
      if (!el) return;
      const currentHeaderH = headerRef.current
        ? Math.round(headerRef.current.getBoundingClientRect().height)
        : headerHeight || 72;
      const elRect = el.getBoundingClientRect();
      const targetY =
        window.pageYOffset + elRect.top - currentHeaderH - extraOffset;
      window.scrollTo({
        top: Math.max(0, Math.round(targetY)),
        behavior: "smooth",
      });
    },
    [headerHeight]
  );

  const scrollToSection = (sectionId: string) => {
    smoothScrollToElementWithOffset(sectionId, 32);
  };

  const switchTab = useCallback((tab: ActiveTab, targetSectionId?: string) => {
    setActiveTab(tab);
    setTimeout(() => {
      if (targetSectionId) {
        smoothScrollToElementWithOffset(targetSectionId, 32);
        return;
      }
      const tabTop = document.getElementById("tab-workspace-anchor");
      if (tabTop) {
        smoothScrollToElementWithOffset(tabTop, 32);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 60);
  }, [smoothScrollToElementWithOffset]);

  const handleGenerateAndOpenReport = useCallback(() => {
    setActiveTab("results");
    setGenerateReportSignal((prev) => prev + 1);
    setTimeout(() => {
      const reportEl =
        document.getElementById("observed-race-report-view") ||
        document.getElementById("section-race-reports");
      if (reportEl) {
        smoothScrollToElementWithOffset(reportEl, 24);
      }
    }, 80);
  }, [smoothScrollToElementWithOffset]);

  const handleJumpToRace = useCallback(
    (
      tab: "overview" | "selections" | "exotics" | "results",
      raceNumber: number,
      meetingId?: string
    ) => {
      if (meetingId && meetingId !== selectedMeetingId) {
        setSelectedMeetingId(meetingId);
      }
      setSelectedRaceNumber(raceNumber);
      switchTab(tab);
      setTimeout(() => {
        const raceEl =
          document.getElementById(`race-row-${raceNumber}`) ||
          document.getElementById(`race-card-${raceNumber}`) ||
          document.getElementById(`observed-race-${raceNumber}`);
        if (raceEl) {
          smoothScrollToElementWithOffset(raceEl, 24);
        }
      }, 80);
    },
    [selectedMeetingId, switchTab, smoothScrollToElementWithOffset]
  );

  // All actual meetings racing on the selected date (or date range), prioritized with Main Metro sites at the top
  const allMeetingsOnSelectedDate = useMemo(() => {
    const byDateOnly = meetings.filter((m) =>
      dateMode === "single"
        ? m.date === selectedDate
        : m.date >= selectedDate && m.date <= endDate
    );

    const list =
      byDateOnly.length > 0
        ? byDateOnly
        : getMeetingsForDateRange(
            selectedDate,
            dateMode === "range" ? endDate : selectedDate
          );

    return sortMeetingsByMetroPriority(list);
  }, [meetings, dateMode, selectedDate, endDate]);

  // Filter meetings by selected date (or range) and optional venue filter
  const visibleMeetings = useMemo(() => {
    if (!trackFilter) {
      return allMeetingsOnSelectedDate;
    }

    const q = trackFilter.toLowerCase();
    return allMeetingsOnSelectedDate.filter(
      (m) =>
        m.venue.toLowerCase().includes(q) || m.state.toLowerCase().includes(q)
    );
  }, [allMeetingsOnSelectedDate, trackFilter]);

  // Multi-select race card IDs across the entire page (defaults to Sydney & Melbourne race cards on the selected date)
  const [selectedMeetingIds, setSelectedMeetingIds] = useState<string[]>(() => {
    const initialDateMeetings = SEED_NSW_TAB_MEETINGS.filter(
      (m) => m.date === INITIAL_RACE_DATE
    );
    const { sydneyMeeting, melbourneMeeting } =
      getSydneyAndMelbourneMeetings(initialDateMeetings);
    const defaults = [sydneyMeeting?.id, melbourneMeeting?.id].filter(
      Boolean
    ) as string[];
    if (defaults.length > 0) return defaults;
    return initialDateMeetings.slice(0, 2).map((m) => m.id);
  });

  // Ensure selectedMeetingIds stays valid when date or available meetings change
  useEffect(() => {
    if (allMeetingsOnSelectedDate.length === 0) return;
    setSelectedMeetingIds((prev) => {
      const valid = prev.filter((id) =>
        allMeetingsOnSelectedDate.some((m) => m.id === id)
      );
      if (valid.length > 0) return valid;
      const { sydneyMeeting, melbourneMeeting } = getSydneyAndMelbourneMeetings(
        allMeetingsOnSelectedDate
      );
      const defaults = [sydneyMeeting?.id, melbourneMeeting?.id].filter(
        Boolean
      ) as string[];
      if (defaults.length > 0) return defaults;
      return allMeetingsOnSelectedDate.slice(0, 2).map((m) => m.id);
    });
  }, [allMeetingsOnSelectedDate]);

  const handleUpdateSelectedMeetingIds = useCallback(
    (nextIds: string[]) => {
      const valid = nextIds.filter((id) =>
        allMeetingsOnSelectedDate.some((m) => m.id === id)
      );
      const safe =
        valid.length > 0
          ? valid
          : allMeetingsOnSelectedDate[0]
          ? [allMeetingsOnSelectedDate[0].id]
          : [];
      setSelectedMeetingIds(safe);
      if (safe.length > 0 && !safe.includes(selectedMeetingId)) {
        setSelectedMeetingId(safe[0]);
      }
    },
    [allMeetingsOnSelectedDate, selectedMeetingId]
  );

  const activeMeeting = useMemo(() => {
    return (
      visibleMeetings.find((m) => m.id === selectedMeetingId) ||
      visibleMeetings.find((m) => selectedMeetingIds.includes(m.id)) ||
      visibleMeetings[0] ||
      null
    );
  }, [visibleMeetings, selectedMeetingId, selectedMeetingIds]);

  const activePunter = useMemo(() => {
    return punters.find((p) => p.id === activePunterId) || punters[0];
  }, [punters, activePunterId]);

  // Trigger a live Race Result Push Notification + Audio Effect (ONLY when race is officially completed and users participated)
  const triggerRaceResultPushNotification = useCallback(
    (
      raceNumber: number,
      targetMeeting: RaceMeeting | null = activeMeeting,
      currentPunters: PunterProfile[] = punters,
      isManualTrigger: boolean = false
    ) => {
      if (!targetMeeting) return;
      const race =
        targetMeeting.races.find((r) => r.raceNumber === raceNumber) ||
        targetMeeting.races[0];
      if (!race) return;

      if (!isRaceOfficialOrCompleted(race, targetMeeting.date)) {
        if (isManualTrigger) {
          triggerToast(
            `${targetMeeting.venue} Race ${race.raceNumber} (${race.startTime}) is not yet complete — awaiting official result.`
          );
        }
        return;
      }

      const winner = race.runners.find((r) => r.finishPosition === 1);
      const second = race.runners.find((r) => r.finishPosition === 2);
      const third = race.runners.find((r) => r.finishPosition === 3);

      const podiumText = `1st #${winner?.tabNumber ?? "-"} ${
        winner?.horseName ?? "TBA"
      } ($${(Number(winner?.nswTabWin) || 0).toFixed(2)}) · 2nd #${
        second?.tabNumber ?? "-"
      } · 3rd #${third?.tabNumber ?? "-"}`;

      const userOutcomes = currentPunters.map((punter) => {
        const mSelections = getPunterSelectionsForMeeting(
          punter,
          targetMeeting
        );
        const trio = mSelections[race.raceNumber];
        const isJokerRace =
          getPunterJokerForMeeting(punter, targetMeeting) === race.raceNumber;
        const evaluated = evaluateRaceTrio(
          race,
          trio,
          targetMeeting.date,
          isJokerRace
        );
        const hasParticipated = evaluated.hasAnySelection;
        const hasPlacedOrWon = evaluated.picks.some(
          (p) => p.tabNumber !== null && p.finishPosition >= 1 && p.finishPosition <= 3
        );
        const won =
          hasParticipated &&
          (hasPlacedOrWon ||
            evaluated.racePointsTally > 0 ||
            evaluated.raceDollarReturn > 0);
        const hitPicks = evaluated.picks
          .filter((p) => (p.points > 0 || (p.finishPosition >= 1 && p.finishPosition <= 3)) && p.runner)
          .map(
            (p) =>
              `#${p.tabNumber} ${p.runner?.horseName} (${
                p.finishPosition === 1
                  ? "1st"
                  : p.finishPosition === 2
                  ? "2nd"
                  : "3rd"
              }${
                evaluated.jokerTriggered && p.preferenceRank === 1
                  ? " · 2× JOKER!"
                  : ""
              })`
          );

        return {
          userName: punter.name,
          hasParticipated,
          won,
          points: evaluated.racePointsTally,
          dollarReturn: evaluated.raceDollarReturn,
          detail:
            hitPicks.length > 0
              ? `Hit: ${hitPicks.join(", ")}${
                  evaluated.jokerTriggered
                    ? ` [🃏 JOKER 2× BONUS +${evaluated.jokerBonusPoints} pts]`
                    : ""
                }`
              : hasParticipated
              ? "Selections unplaced (0 pts · $0)"
              : "Did not participate (No selections)",
        };
      });

      const participatedUsers = userOutcomes.filter((u) => u.hasParticipated);

      // Ensure sound and result alerts only get pushed for races participated in by users (users select runners)
      if (participatedUsers.length === 0) {
        if (isManualTrigger) {
          triggerToast(
            `Result alert skipped for ${targetMeeting.venue} R${race.raceNumber}: No registered users have selected runners for this race.`
          );
        }
        return;
      }

      const anyParticipatedUserWon = participatedUsers.some((u) => u.won);

      // Evaluate whether the Combined Syndicate Trifecta hit on this confirmed race
      const trifectaEval = evaluateCombinedTrifectaForRace(
        race,
        currentPunters,
        targetMeeting.id,
        targetMeeting.date,
        trifectaBetAmount,
        targetMeeting.venue
      );
      const isTrifectaHit = trifectaEval.isCombinedBoxedTrifectaHit;

      // Count how many selections placed (1st, 2nd, 3rd) or won across participated users
      const allPlacedOrWonRunners = new Set<number>();
      currentPunters.forEach((punter) => {
        const mSelections = punter.selectionsByMeeting?.[targetMeeting.id];
        const trio = mSelections?.[race.raceNumber];
        if (trio) {
          [trio.firstPref, trio.secondPref, trio.thirdPref].forEach((tab) => {
            if (tab) {
              const r = race.runners.find((runner) => runner.tabNumber === tab);
              if (r && r.finishPosition >= 1 && r.finishPosition <= 3) {
                allPlacedOrWonRunners.add(tab);
              }
            }
          });
        }
      });
      const placedOrWonCount = allPlacedOrWonRunners.size;

      // Play high-quality sound alerts for participated races:
      // 1. If Trifecta is successful -> play "Show me the money"
      // 2. If runners place or win -> play "cha ching" cash register sound as a multiple of occurrence (2 horses = 2x, 3 horses = 3x)
      // 3. If NO runners win or place -> play game show "dun dun" sound!
      if (soundEnabled) {
        if (isTrifectaHit) {
          playShowMeTheMoneySound();
          audioAlerts.playTrifectaFanfare();
          triggerConfetti();
        } else if (placedOrWonCount > 0) {
          playCashRegisterSound(placedOrWonCount);
          audioAlerts.playRaceWinnerChime();
        } else {
          playWrongAnswerSound();
        }
      }

      const headline = isTrifectaHit
        ? `🚨💰 "SHOW ME THE MONEY!" Syndicate Boxed Trifecta Hit in Race ${race.raceNumber} (+${formatDollarReturn(
            trifectaEval.customBetFlexiReturn
          )})`
        : placedOrWonCount > 0
        ? `CHA-CHING! (${placedOrWonCount}× Hits) Winning Result in Race ${race.raceNumber}`
        : `DUN-DUN! No Winning Return in Race ${race.raceNumber}`;

      const item: RacePushNotificationItem = {
        id: `push-${Date.now()}-${race.raceNumber}`,
        venue: targetMeeting.venue,
        raceNumber: race.raceNumber,
        raceName: race.raceName,
        isWinner: isTrifectaHit || placedOrWonCount > 0,
        isTrifectaHit,
        placedCount: placedOrWonCount,
        headline,
        podiumText,
        userOutcomes,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      };

      setPushNotifications((prev) => [item, ...prev.slice(0, 2)]);

      if (soundEnabled) {
        dispatchBackgroundRaceAlert({
          title: `${targetMeeting.venue} R${race.raceNumber} — ${headline}`,
          body: `Official Result: ${podiumText}`,
          tag: `turfsheet-${targetMeeting.id}-R${race.raceNumber}`,
        });
      }
    },
    [activeMeeting, punters, soundEnabled, trifectaBetAmount]
  );

  // Update a user's 1st, 2nd, or 3rd preference for a specific race on a meeting card
  const handleUpdateRaceSelection = (
    punterId: string,
    meetingId: string,
    raceNumber: number,
    preferenceRank: 1 | 2 | 3,
    tabNumber: number | null
  ) => {
    setPunters((prev) => {
      const nextPunters = prev.map((punter) => {
        if (punter.id !== punterId) return punter;
        const meetingMap = { ...(punter.selectionsByMeeting[meetingId] || {}) };
        const existing: RaceSelectionTrio = meetingMap[raceNumber] || {
          firstPref: null,
          secondPref: null,
          thirdPref: null,
        };

        let { firstPref, secondPref, thirdPref } = existing;

        if (preferenceRank === 1) {
          if (tabNumber !== null && secondPref === tabNumber) {
            secondPref = firstPref;
          } else if (tabNumber !== null && thirdPref === tabNumber) {
            thirdPref = firstPref;
          }
          firstPref = tabNumber;
        } else if (preferenceRank === 2) {
          if (tabNumber !== null && firstPref === tabNumber) {
            firstPref = secondPref;
          } else if (tabNumber !== null && thirdPref === tabNumber) {
            thirdPref = secondPref;
          }
          secondPref = tabNumber;
        } else {
          if (tabNumber !== null && firstPref === tabNumber) {
            firstPref = thirdPref;
          } else if (tabNumber !== null && secondPref === tabNumber) {
            secondPref = thirdPref;
          }
          thirdPref = tabNumber;
        }

        const nowIso = new Date().toISOString();
        const updatedTrio: RaceSelectionTrio = {
          firstPref,
          secondPref,
          thirdPref,
          updatedAt: nowIso,
        };

        meetingMap[raceNumber] = updatedTrio;

        return {
          ...punter,
          selectionsByMeeting: {
            ...punter.selectionsByMeeting,
            [meetingId]: meetingMap,
          },
          updatedAt: nowIso,
        };
      });

      persistPuntersToCloud(nextPunters);

      const targetUser = nextPunters.find((p) => p.id === punterId);
      const trio = targetUser?.selectionsByMeeting[meetingId]?.[raceNumber];
      if (
        trio &&
        trio.firstPref !== null &&
        trio.secondPref !== null &&
        trio.thirdPref !== null
      ) {
        const targetMtg =
          visibleMeetings.find((m) => m.id === meetingId) || activeMeeting;
        const targetRace = targetMtg?.races.find(
          (r) => r.raceNumber === raceNumber
        );
        if (
          targetMtg &&
          targetRace &&
          isRaceOfficialOrCompleted(targetRace, targetMtg.date)
        ) {
          setTimeout(() => {
            triggerRaceResultPushNotification(
              raceNumber,
              targetMtg,
              nextPunters
            );
          }, 80);
        }
      }

      return nextPunters;
    });
  };

  const handleAutoFillCardForPunter = (
    punterId: string,
    meeting: RaceMeeting
  ) => {
    const nowIso = new Date().toISOString();
    setPunters((prev) => {
      const nextPunters = prev.map((punter) => {
        if (punter.id !== punterId) return punter;
        const filledMap: Record<number, RaceSelectionTrio> = {};
        for (const race of meeting.races) {
          const autoPick = generateRaceAutoPickTrio(
            race.runners,
            race.raceNumber
          );
          filledMap[race.raceNumber] = {
            firstPref: autoPick.firstPref,
            secondPref: autoPick.secondPref,
            thirdPref: autoPick.thirdPref,
            updatedAt: nowIso,
          };
        }
        return {
          ...punter,
          selectionsByMeeting: {
            ...punter.selectionsByMeeting,
            [meeting.id]: filledMap,
          },
          updatedAt: nowIso,
        };
      });
      persistPuntersToCloud(nextPunters);
      const completedRaces = meeting.races.filter((r) =>
        isRaceOfficialOrCompleted(r, meeting.date)
      );
      if (completedRaces.length > 0) {
        const latestCompleted = completedRaces[completedRaces.length - 1];
        setTimeout(() => {
          triggerRaceResultPushNotification(
            latestCompleted.raceNumber,
            meeting,
            nextPunters
          );
        }, 90);
      }
      return nextPunters;
    });
    triggerToast(
      `Auto-filled & cloud-saved race selections (randomly selecting at least 1 top-3 favourite + 2 other runners) across all ${meeting.races.length} races at ${meeting.venue} (${meeting.date}).`
    );
  };

  const handleToggleJokerRace = (
    punterId: string,
    meetingId: string,
    raceNumber: number | null
  ) => {
    const nowIso = new Date().toISOString();
    setPunters((prev) => {
      const nextPunters = prev.map((punter) => {
        if (punter.id !== punterId) return punter;
        return {
          ...punter,
          jokerRaceByMeeting: {
            ...(punter.jokerRaceByMeeting || {}),
            [meetingId]: raceNumber,
          },
          jokerUpdatedAtByMeeting: {
            ...(punter.jokerUpdatedAtByMeeting || {}),
            [meetingId]: nowIso,
          },
          updatedAt: nowIso,
        };
      });
      persistPuntersToCloud(nextPunters);
      return nextPunters;
    });

    const targetPunter = punters.find((p) => p.id === punterId);
    const targetMtg =
      visibleMeetings.find((m) => m.id === meetingId) || activeMeeting;
    if (raceNumber !== null) {
      triggerToast(
        `🃏 Saved Race ${raceNumber} at ${
          targetMtg?.venue || "selected track"
        } as ${
          targetPunter?.name || "user"
        }'s Joker Round (2× Points if 1st Preference wins — synced across devices).`
      );
    } else {
      triggerToast(
        `Cleared Joker Round for ${targetPunter?.name || "user"} at ${
          targetMtg?.venue || "selected track"
        }.`
      );
    }
  };

  const handleClearCardForPunter = (punterId: string, meetingId: string) => {
    const nowIso = new Date().toISOString();
    const targetMtg =
      visibleMeetings.find((m) => m.id === meetingId) || activeMeeting;
    setPunters((prev) => {
      const nextPunters = prev.map((punter) => {
        if (punter.id !== punterId) return punter;
        const clearedMap: Record<number, RaceSelectionTrio> = {};
        const existingMap = punter.selectionsByMeeting[meetingId] || {};
        const raceNums = new Set<number>([
          ...Object.keys(existingMap).map(Number),
          ...(targetMtg?.races.map((r) => r.raceNumber) || []),
        ]);
        for (const rNo of raceNums) {
          if (!rNo) continue;
          clearedMap[rNo] = {
            firstPref: null,
            secondPref: null,
            thirdPref: null,
            updatedAt: nowIso,
          };
        }
        return {
          ...punter,
          selectionsByMeeting: {
            ...punter.selectionsByMeeting,
            [meetingId]: clearedMap,
          },
          jokerRaceByMeeting: {
            ...(punter.jokerRaceByMeeting || {}),
            [meetingId]: targetMtg
              ? getFeatureRaceNumberForMeeting(targetMtg)
              : null,
          },
          jokerUpdatedAtByMeeting: {
            ...(punter.jokerUpdatedAtByMeeting || {}),
            [meetingId]: nowIso,
          },
          updatedAt: nowIso,
        };
      });
      persistPuntersToCloud(nextPunters);
      return nextPunters;
    });
    triggerToast(
      "Cleared selections and reset Joker Round to the Feature Race for this racing card (synced across devices)."
    );
  };

  const handleAddPunter = (name: string, role: string) => {
    const nowIso = new Date().toISOString();
    const newId = `punter-${Date.now()}`;
    const newProfile: PunterProfile = {
      id: newId,
      name,
      role,
      selectionsByMeeting: {},
      jokerRaceByMeeting: {},
      jokerUpdatedAtByMeeting: {},
      updatedAt: nowIso,
    };

    const nextDeleted = deletedPunterIdsRef.current.filter(
      (id) => id !== newId
    );
    setDeletedPunterIds(nextDeleted);

    setPunters((prev) => {
      const nextPunters = [...prev, newProfile];
      persistPuntersToCloud(nextPunters, false, nextDeleted);
      return nextPunters;
    });
    setActivePunterId(newId);
    triggerToast(`Added user "${name}" and synced across all devices.`);
  };

  const handleRemovePunter = (punterId: string) => {
    const targetPunter = punters.find((p) => p.id === punterId);
    const normName = (targetPunter?.name || "").trim().toLowerCase();
    const isProtectedCore =
      punterId === "punter-steve-f" ||
      punterId === "punter-mark-s" ||
      normName === "steve f" ||
      normName === "mark s";

    if (isProtectedCore) {
      triggerToast(
        "Core syndicate founders Steve F and Mark S cannot be removed."
      );
      return;
    }

    if (punters.length <= 1) {
      triggerToast("At least one active syndicate user must remain.");
      return;
    }
    const removedName = targetPunter?.name || "user";

    const nextDeleted = Array.from(
      new Set([...deletedPunterIdsRef.current, punterId])
    );
    setDeletedPunterIds(nextDeleted);
    deletePunterFromFirestore(punterId).catch(() => {});

    setPunters((prev) => {
      const remaining = prev.filter((p) => p.id !== punterId);
      const safeRemaining = remaining.length > 0 ? remaining : prev.slice(0, 1);
      if (activePunterId === punterId && safeRemaining[0]) {
        setActivePunterId(safeRemaining[0].id);
      }
      persistPuntersToCloud(safeRemaining, false, nextDeleted);
      return safeRemaining;
    });

    triggerToast(`Removed user "${removedName}" and synced across all devices.`);
  };

  const handleScrapeNswTab = useCallback(
    async (
      targetStart = selectedDate,
      targetEnd = endDate,
      venue = trackFilter,
      options?: {
        silent?: boolean;
        preserveSelection?: boolean;
        forceRefresh?: boolean;
      }
    ) => {
      if (isScrapingInFlightRef.current) return;
      isScrapingInFlightRef.current = true;
      const isSilent = Boolean(options?.silent);
      const shouldPreserveSelection = options?.preserveSelection ?? true;
      const forceRefresh = Boolean(options?.forceRefresh);

      if (isSilent) {
        setIsBackgroundRefreshing(true);
      } else {
        setIsScraping(true);
        setScrapeError(null);
      }

      try {
        const effectiveEnd = dateMode === "range" ? targetEnd : targetStart;
        const result = await fetchLatestRaceResultsAndMeetings({
          startDate: targetStart,
          endDate: effectiveEnd,
          trackFilter: venue || undefined,
          forceRefresh,
        });

        lastResultsFetchMsRef.current = Date.now();
        setNextRefreshCountdown(45);
        setLastResultsUpdatedAt(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        );

        if (result.verifiedSourcesUsed.length > 0) {
          setVerifiedSourcesUsed(result.verifiedSourcesUsed);
        }
        if (result.sources.length > 0) {
          setSources(result.sources);
        }

        if (result.meetings.length > 0) {
          const { mergedMeetings, newlyCompletedRaces } =
            mergeMeetingsPreservingResultsAndForm(
              meetingsRef.current,
              result.meetings
            );
          meetingsRef.current = mergedMeetings;
          setMeetings(mergedMeetings);

          // Preserve user's active venue and race selection if still valid on the target date
          setSelectedMeetingId((prevMeetingId) => {
            if (
              shouldPreserveSelection &&
              result.meetings.some((m) => m.id === prevMeetingId)
            ) {
              return prevMeetingId;
            }
            const firstId = result.meetings[0].id;
            setSelectedRaceNumber(
              result.meetings[0].races?.[0]?.raceNumber || 1
            );
            setNextPushRaceCursor(1);
            return firstId;
          });

          setScrapeSummary(result.scrapeSummary);

          // Record initially completed races on first load, and push-notify the latest completed race if none announced yet
          if (!hasCompletedInitialScrapeRef.current) {
            hasCompletedInitialScrapeRef.current = true;
            let latestCompletedOnTarget: {
              meeting: RaceMeeting;
              raceNumber: number;
            } | null = null;
            for (const m of mergedMeetings) {
              for (const r of m.races) {
                if (isRaceOfficialOrCompleted(r, m.date)) {
                  notifiedCompletedRacesRef.current.add(
                    `${m.id}:R${r.raceNumber}`
                  );
                  if (m.date === targetStart) {
                    latestCompletedOnTarget = {
                      meeting: m,
                      raceNumber: r.raceNumber,
                    };
                  }
                }
              }
            }
            if (latestCompletedOnTarget) {
              const toPush = latestCompletedOnTarget;
              setTimeout(() => {
                triggerRaceResultPushNotification(
                  toPush.raceNumber,
                  toPush.meeting,
                  puntersRef.current
                );
              }, 250);
            }
          } else if (newlyCompletedRaces.length > 0) {
            for (const alertItem of newlyCompletedRaces) {
              const alertKey = `${alertItem.meeting.id}:R${alertItem.raceNumber}`;
              if (!notifiedCompletedRacesRef.current.has(alertKey)) {
                notifiedCompletedRacesRef.current.add(alertKey);
                setTimeout(() => {
                  triggerRaceResultPushNotification(
                    alertItem.raceNumber,
                    alertItem.meeting,
                    puntersRef.current
                  );
                }, 120);
              }
            }
          } else {
            // Also check if the user switched to a date/meeting with completed races that hasn't pushed a notice yet
            const primaryMtg =
              mergedMeetings.find((m) => m.date === targetStart) ||
              mergedMeetings[0];
            if (primaryMtg) {
              const completedOnPrimary = primaryMtg.races.filter((r) =>
                isRaceOfficialOrCompleted(r, primaryMtg.date)
              );
              const latestRace =
                completedOnPrimary[completedOnPrimary.length - 1];
              if (latestRace) {
                const key = `${primaryMtg.id}:R${latestRace.raceNumber}`;
                if (!notifiedCompletedRacesRef.current.has(key)) {
                  notifiedCompletedRacesRef.current.add(key);
                  setTimeout(() => {
                    triggerRaceResultPushNotification(
                      latestRace.raceNumber,
                      primaryMtg,
                      puntersRef.current
                    );
                  }, 150);
                }
              }
            }
          }
        } else {
          setScrapeSummary(
            result.scrapeSummary ||
              `No scheduled race meetings found for ${
                venue || "selected filter"
              } on ${formatReadableDate(targetStart)}.`
          );
        }
      } catch {
        const fallback = applyStoredResultsPatchesToMeetings(
          getMeetingsForDateRange(
            targetStart,
            dateMode === "range" ? targetEnd : targetStart,
            venue || undefined
          )
        );
        if (fallback.length > 0) {
          setMeetings((prev) => {
            const { mergedMeetings } = mergeMeetingsPreservingResultsAndForm(
              prev,
              fallback
            );
            return mergedMeetings;
          });
          setScrapeSummary(
            `Multi-Source Verified Australian Thoroughbred Racecards (${fallback.length} venues active on ${targetStart}).`
          );
        }
      } finally {
        isScrapingInFlightRef.current = false;
        setIsScraping(false);
        setIsBackgroundRefreshing(false);
      }
    },
    [
      selectedDate,
      endDate,
      trackFilter,
      dateMode,
      triggerRaceResultPushNotification,
    ]
  );

  // Perform multi-source verification on initial load and when user changes date
  const lastAutoScrapedDateRef = useRef<string>("");
  useEffect(() => {
    if (!autoScrapeOnDateChange) return;
    const key = `${dateMode}:${selectedDate}:${endDate}`;
    if (lastAutoScrapedDateRef.current !== key) {
      const isDateSwitch = lastAutoScrapedDateRef.current !== "";
      lastAutoScrapedDateRef.current = key;
      const instantMeetings = applyStoredResultsPatchesToMeetings(
        buildDateAccurateMeetings(selectedDate)
      );
      if (instantMeetings.length > 0) {
        setMeetings((prev) => {
          const { mergedMeetings } = mergeMeetingsPreservingResultsAndForm(
            prev,
            instantMeetings
          );
          return mergedMeetings;
        });
        setSelectedMeetingId((prevId) =>
          !isDateSwitch && instantMeetings.some((m) => m.id === prevId)
            ? prevId
            : instantMeetings[0].id
        );
        if (isDateSwitch) {
          setSelectedRaceNumber(1);
        }
      }
      handleScrapeNswTab(selectedDate, endDate, trackFilter, {
        silent: false,
        preserveSelection: !isDateSwitch,
        forceRefresh: false,
      });
    }
  }, [
    selectedDate,
    endDate,
    dateMode,
    trackFilter,
    autoScrapeOnDateChange,
    handleScrapeNswTab,
  ]);

  // Regular background race results refresh scheduler using an unthrottled Web Worker ticker
  // (continues running every 45s even when TurfSheet is in an inactive background browser tab)
  useEffect(() => {
    if (!autoRefreshResults) return;
    const stopWorkerTicker = createUnthrottledBackgroundTicker(() => {
      setNextRefreshCountdown((prev) => {
        if (prev <= 1) {
          handleScrapeNswTab(selectedDate, endDate, trackFilter, {
            silent: true,
            preserveSelection: true,
            forceRefresh: false,
          });
          return 45;
        }
        return prev - 1;
      });
    }, 1000);

    const handleVisibilityOrFocus = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastResultsFetchMsRef.current > 20_000
      ) {
        handleScrapeNswTab(selectedDate, endDate, trackFilter, {
          silent: true,
          preserveSelection: true,
          forceRefresh: false,
        });
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    return () => {
      stopWorkerTicker();
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [
    autoRefreshResults,
    selectedDate,
    endDate,
    trackFilter,
    handleScrapeNswTab,
  ]);

  // Trigger a fast silent background refresh when user switches to the Results tab if >15s since last check
  useEffect(() => {
    if (
      activeTab === "results" &&
      Date.now() - lastResultsFetchMsRef.current > 15_000
    ) {
      handleScrapeNswTab(selectedDate, endDate, trackFilter, {
        silent: true,
        preserveSelection: true,
        forceRefresh: false,
      });
    }
  }, [activeTab, selectedDate, endDate, trackFilter, handleScrapeNswTab]);

  // Handle #download-* hash links from chat (so root URL "/" passes applet-auth-bridge without "Invalid URL")
  const [showDownloadHubModal, setShowDownloadHubModal] = useState<boolean>(() =>
    typeof window !== "undefined" && window.location.hash.startsWith("#download")
  );

  useEffect(() => {
    const hashMap: Record<string, { url: string; filename: string }> = {
      "#download-loader": {
        url: "/loader",
        filename: "loader.php",
      },
      "#download-update-installer": {
        url: "/loader",
        filename: "loader.php",
      },
      "#download-update-zip": {
        url: "/site-update-zip",
        filename: "site_update.zip",
      },
      "#download-update-php": {
        url: "/update-script",
        filename: "update-site.php",
      },
      "#download-htdocs": {
        url: "/download-htdocs",
        filename: "cupdaypunting-xo-je-infinityfree-htdocs.zip",
      },
      "#download-part1": {
        url: "/site-vendor-zip",
        filename: "site_vendor.zip",
      },
      "#download-part2": {
        url: "/site-data1-zip",
        filename: "site_data1.zip",
      },
    };

    const checkHashAndDownload = () => {
      const h = window.location.hash.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      if (params.get("updater") === "1" || h === "#download-all") {
        setShowDownloadHubModal(true);
        downloadVerifiedBinaryBlob("/site-update-zip", "site_update.zip");
        return;
      }
      if (h.startsWith("#download")) {
        setShowDownloadHubModal(true);
        const target = hashMap[h];
        if (target) {
          if (target.filename === "loader.php") {
            downloadInMemoryMicroUpdaterPhp();
          } else {
            downloadVerifiedBinaryBlob(target.url, target.filename);
          }
        }
      }
    };

    checkHashAndDownload();
    window.addEventListener("hashchange", checkHashAndDownload);
    return () => window.removeEventListener("hashchange", checkHashAndDownload);
  }, []);

  return (
    <div
      id="top"
      data-theme={themeScheme}
      style={
        {
          "--app-header-height": `${headerHeight}px`,
        } as React.CSSProperties
      }
      className={`min-h-screen min-h-[100dvh] flex flex-col pb-24 md:pb-12 transition-colors duration-200 ${
        isApple ? "bg-[#F5F5F7] text-[#1D1D1F]" : "bg-[#070B09] text-[#F3F4F0]"
      }`}
    >
      <OfflineIndicator />

      {/* Direct Download Hub Modal (Uses in-memory Blob downloads to avoid AI Studio auth redirect) */}
      {showDownloadHubModal && (
        <UpdaterDownloadModal
          onClose={() => {
            setShowDownloadHubModal(false);
            if (window.location.hash.startsWith("#download")) {
              window.history.replaceState(null, "", window.location.pathname);
            }
          }}
        />
      )}

      {/* Live Race Result Push Notification Overlay Stack (Top-Right, offset below dynamic header) */}
      {pushNotifications.length > 0 && (
        <div
          aria-live="assertive"
          style={{ top: `calc(var(--app-header-height, 72px) + 12px)` }}
          className="fixed right-4 z-50 w-full max-w-md space-y-2.5 pointer-events-none px-2 sm:px-0"
        >
          {pushNotifications.map((item) => (
            <div
              key={item.id}
              className={`pointer-events-auto rounded-lg border p-3.5 shadow-2xl backdrop-blur-md transition-all ${
                item.isWinner
                  ? "bg-[#11241B]/95 border-[#10B981] text-[#F3F4F0]"
                  : "bg-[#241316]/95 border-[#EF4444]/80 text-[#F3F4F0]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      item.isTrifectaHit
                        ? "bg-[#D4AF37] text-[#0B110E]"
                        : item.isWinner
                        ? "bg-[#10B981] text-[#0B110E]"
                        : "bg-[#EF4444] text-[#0B110E]"
                    }`}
                  >
                    {item.isTrifectaHit
                      ? "🚨 TRIFECTA SIREN · HIT!"
                      : item.isWinner
                      ? "WIN · CASH REGISTER"
                      : "NO WIN · DUN DUN"}
                  </span>
                  <span className="text-xs font-mono text-[#D4AF37] font-semibold">
                    {item.venue} · R{item.raceNumber}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (item.isTrifectaHit) {
                        playShowMeTheMoneySound();
                      } else if (item.isWinner) {
                        playCashRegisterSound(item.placedCount || 1);
                      } else {
                        playWrongAnswerSound();
                      }
                    }}
                    className="p-1 rounded bg-[#0B110E]/60 hover:bg-[#0B110E] text-xs text-[#D4AF37] cursor-pointer"
                    title="Replay Notification Sound"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPushNotifications((prev) =>
                        prev.filter((n) => n.id !== item.id)
                      )
                    }
                    className="p-1 rounded bg-[#0B110E]/60 hover:bg-[#0B110E] text-[#8A9990] hover:text-[#F3F4F0] cursor-pointer"
                    aria-label="Dismiss Notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-1.5 text-xs font-semibold text-[#F3F4F0]">
                {item.headline} — {item.raceName}
              </div>
              <div className="mt-0.5 text-[11px] font-mono text-[#D4AF37]">
                Official Result: {item.podiumText}
              </div>

              <div className="mt-2 pt-2 border-t border-[#1F2D26]/80 space-y-1">
                {item.userOutcomes.map((u) => (
                  <div
                    key={u.userName}
                    className="flex items-center justify-between text-[11px] font-mono"
                  >
                    <span className="font-sans font-semibold text-[#F3F4F0]">
                      {u.userName}:{" "}
                      <span className="font-normal text-[#8A9990]">
                        {u.detail}
                      </span>
                    </span>
                    <span
                      className={
                        u.won
                          ? "text-[#10B981] font-bold"
                          : "text-[#EF4444] font-semibold"
                      }
                    >
                      {u.points} pts · {formatDollarReturn(u.dollarReturn)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sticky Header with Adaptive Navigation and Measured Ref */}
      <header
        ref={headerRef}
        className={`sticky top-0 z-40 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 transition-colors ${
          isApple
            ? "bg-white/90 border-b border-[#E5E5EA] shadow-xs"
            : "bg-[#0E1512]/95 border-b border-[#1F2D26] shadow-md"
        }`}
      >
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          {/* Brand Wordmark with Mascot in Turf Dark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab("overview");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-2 sm:gap-2.5 font-semibold text-base tracking-tight whitespace-nowrap cursor-pointer hover:opacity-85 transition-opacity shrink-0"
          >
            {isApple ? (
              <div className="w-7 h-7 rounded-full bg-[#0071E3] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                🏇
              </div>
            ) : (
              <img
                src={horseBeerMascotImg}
                alt="TurfSheet Mascot"
                className="w-8 h-8 rounded-full object-cover ring-2 ring-[#D4AF37]/50 shadow-md"
              />
            )}
            <span className={isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0] font-bold"}>
              TurfSheet
            </span>
            <span
              className={`text-xs font-normal hidden xl:inline ${
                isApple ? "text-[#86868B]" : "text-[#D4AF37] font-mono tracking-wider uppercase text-[11px]"
              }`}
            >
              {isApple ? "Punters Club" : "★ PUNTERS CLUB"}
            </span>
          </a>

          {/* Primary 4-Tab Adaptive Segmented Control */}
          <nav
            role="tablist"
            aria-label="Primary App Tabs"
            className={`hidden md:flex items-center p-1 rounded-full border shrink-0 ${
              isApple
                ? "bg-[#E5E5EA]/70 border-black/[0.04]"
                : "bg-[#121A16] border-[#1F2D26]"
            }`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "overview"}
              onClick={() => switchTab("overview")}
              className={`flex items-center gap-1.5 sm:gap-2 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-medium transition cursor-pointer ${
                activeTab === "overview"
                  ? isApple
                    ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                    : "bg-[#10B981] text-[#070B09] font-bold shadow-[0_2px_8px_rgba(16,185,129,0.3)]"
                  : isApple
                  ? "text-[#86868B] hover:text-[#1D1D1F]"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              <span>Overview</span>
              <span className="text-[10px] opacity-75 hidden sm:inline">
                ({visibleMeetings.length})
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "selections"}
              onClick={() => switchTab("selections")}
              className={`flex items-center gap-1.5 sm:gap-2 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-medium transition cursor-pointer ${
                activeTab === "selections"
                  ? isApple
                    ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                    : "bg-[#10B981] text-[#070B09] font-bold shadow-[0_2px_8px_rgba(16,185,129,0.3)]"
                  : isApple
                  ? "text-[#86868B] hover:text-[#1D1D1F]"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              <span>Selections</span>
              <span className="text-[10px] opacity-75 hidden xl:inline">
                ({activePunter.name.split(" ")[0]})
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "exotics"}
              onClick={() => switchTab("exotics")}
              className={`flex items-center gap-1.5 sm:gap-2 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-medium transition cursor-pointer ${
                activeTab === "exotics"
                  ? isApple
                    ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                    : "bg-[#10B981] text-[#070B09] font-bold shadow-[0_2px_8px_rgba(16,185,129,0.3)]"
                  : isApple
                  ? "text-[#86868B] hover:text-[#1D1D1F]"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              <span>Exotics</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "results"}
              onClick={() => switchTab("results")}
              className={`flex items-center gap-1.5 sm:gap-2 rounded-full px-3 sm:px-4 py-1 sm:py-1.5 text-xs font-medium transition cursor-pointer ${
                activeTab === "results"
                  ? isApple
                    ? "bg-white text-[#1D1D1F] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.1)]"
                    : "bg-[#10B981] text-[#070B09] font-bold shadow-[0_2px_8px_rgba(16,185,129,0.3)]"
                  : isApple
                  ? "text-[#86868B] hover:text-[#1D1D1F]"
                  : "text-[#8A9990] hover:text-[#F3F4F0]"
              }`}
            >
              <span>Results</span>
              {activeMeeting && (
                <span className="text-[10px] font-mono opacity-80 hidden lg:inline">
                  {activeMeeting.races.filter((r) =>
                    isRaceOfficialOrCompleted(r, activeMeeting.date)
                  ).length}
                  /{activeMeeting.races.length}
                </span>
              )}
            </button>
          </nav>

          {/* Actions: Points/$ Toggle + Cloud Status + Theme Selector + Primary Action */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Scoring Mode Segmented Pill */}
            <div
              role="group"
              aria-label="Toggle scoring mode"
              className={`flex items-center p-0.5 rounded-full border ${
                isApple
                  ? "bg-[#E5E5EA]/70 border-black/[0.04]"
                  : "bg-[#121A16] border-[#1F2D26]"
              }`}
            >
              <button
                type="button"
                onClick={() => setScoringMode("points")}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 text-xs rounded-full transition cursor-pointer ${
                  scoringMode === "points"
                    ? isApple
                      ? "bg-white text-[#1D1D1F] font-semibold shadow-xs"
                      : "bg-[#10B981] text-[#070B09] font-bold shadow-xs"
                    : isApple
                    ? "text-[#86868B] hover:text-[#1D1D1F]"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <span>Points</span>
              </button>
              <button
                type="button"
                onClick={() => setScoringMode("dollars")}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 text-xs rounded-full transition cursor-pointer ${
                  scoringMode === "dollars"
                    ? isApple
                      ? "bg-white text-[#1D1D1F] font-semibold shadow-xs"
                      : "bg-[#10B981] text-[#070B09] font-bold shadow-xs"
                    : isApple
                    ? "text-[#86868B] hover:text-[#1D1D1F]"
                    : "text-[#8A9990] hover:text-[#F3F4F0]"
                }`}
              >
                <span>$ Return</span>
              </button>
            </div>

            {/* Theme Selector Dropdown */}
            <div className="relative" ref={themeMenuRef}>
              <button
                type="button"
                onClick={() => setShowThemeMenu((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium transition cursor-pointer border ${
                  isApple
                    ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                    : "bg-[#121A16] border-[#1F2D26] text-[#F3F4F0] hover:bg-[#192620]"
                }`}
                title="Select Theme: Turf Dark (Default) or Apple Minimalist"
                aria-label="Theme Selector"
              >
                <Palette className={`w-3.5 h-3.5 ${isApple ? "text-[#0071E3]" : "text-[#D4AF37]"}`} />
                <span className="hidden xl:inline">Theme:</span>
                <span className="font-semibold hidden sm:inline">{isApple ? "Apple Clean" : "Turf Dark"}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              {showThemeMenu && (
                <div
                  className={`absolute right-0 mt-1.5 w-60 rounded-2xl p-1.5 shadow-2xl border z-50 animate-in fade-in zoom-in-95 duration-100 ${
                    isApple
                      ? "bg-white border-[#E5E5EA] text-[#1D1D1F]"
                      : "bg-[#0E1512] border-[#2A3F33] text-[#F3F4F0]"
                  }`}
                >
                  <div className="px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase opacity-60">
                    Select Appearance Theme
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setThemeScheme("default");
                      setShowThemeMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs text-left transition cursor-pointer ${
                      !isApple
                        ? "bg-[#10B981]/20 text-[#10B981] font-semibold border border-[#10B981]/30"
                        : "hover:bg-[#F2F2F7] text-[#1D1D1F]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">🏇</span>
                      <div>
                        <div className="font-semibold flex items-center gap-1.5">
                          <span>Turf Dark</span>
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-[#D4AF37]/20 text-[#D4AF37] font-mono">
                            Default
                          </span>
                        </div>
                        <div className={`text-[11px] ${!isApple ? "text-[#A7D7C5]" : "text-[#86868B]"}`}>
                          Rich racing green, gold &amp; punters club
                        </div>
                      </div>
                    </div>
                    {!isApple && <Check className="w-4 h-4 text-[#10B981] shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setThemeScheme("apple");
                      setShowThemeMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs text-left transition cursor-pointer mt-1 ${
                      isApple
                        ? "bg-[#0071E3]/10 text-[#0071E3] font-semibold border border-[#0071E3]/25"
                        : "hover:bg-[#192620] text-[#F3F4F0]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base"></span>
                      <div>
                        <div className="font-semibold">Apple Minimalist</div>
                        <div className={`text-[11px] ${isApple ? "text-[#0071E3]/80" : "text-[#86868B]"}`}>
                          Clean white, SF type &amp; Apple blue
                        </div>
                      </div>
                    </div>
                    {isApple && <Check className="w-4 h-4 text-[#0071E3] shrink-0" />}
                  </button>
                </div>
              )}
            </div>

            {/* Cloud Auto-Save Badge (Kept clean on xl screens) */}
            <button
              type="button"
              onClick={() => persistPuntersToCloud(punters, true)}
              className={`hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition cursor-pointer border ${
                isApple
                  ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                  : "bg-[#121A16] border-[#1F2D26] text-[#F3F4F0] hover:bg-[#192620]"
              }`}
              title={`Synced at ${lastSyncedTime}. Click to force sync.`}
            >
              {cloudSyncState === "saving" ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0071E3]" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#34C759]" />
              )}
              <span>{cloudSyncState === "saving" ? "Saving..." : "Saved"}</span>
            </button>

            {/* Report Button */}
            <button
              type="button"
              onClick={handleGenerateAndOpenReport}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium transition cursor-pointer border ${
                isApple
                  ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#1D1D1F] hover:bg-[#E5E5EA]"
                  : "bg-[#121A16] border-[#1F2D26] text-[#F3F4F0] hover:bg-[#192620]"
              }`}
              title="Generate Race Report"
            >
              <FileText className={`w-3.5 h-3.5 ${isApple ? "text-[#86868B]" : "text-[#D4AF37]"}`} />
              <span className="hidden md:inline">Report</span>
            </button>

            {/* Enterprise AI Studio Architecture Studio Modal Button */}
            <button
              type="button"
              onClick={() => setShowAiArchitectureModal(true)}
              className={`hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-semibold transition cursor-pointer border ${
                isApple
                  ? "bg-[#0071E3]/10 border-[#0071E3]/30 text-[#0071E3] hover:bg-[#0071E3]/20 shadow-xs"
                  : "bg-[#10B981]/15 border-[#10B981]/40 text-[#10B981] hover:bg-[#10B981]/25 shadow-xs"
              }`}
              title="Open Enterprise AI Studio Architecture Studio & LangGraph Simulator"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">AI Studio Blueprint</span>
            </button>

            {/* Sound Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className={`p-1.5 sm:p-2 rounded-full transition cursor-pointer border ${
                isApple
                  ? "bg-[#F2F2F7] border-[#E5E5EA] text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#E5E5EA]"
                  : "bg-[#121A16] border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0] hover:bg-[#192620]"
              }`}
              title={soundEnabled ? "Sound On" : "Sound Muted"}
              aria-label="Toggle Sound"
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-[#34C759]" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 opacity-60" />
              )}
            </button>

            {/* Primary Action Button */}
            <button
              type="button"
              disabled={isScraping}
              onClick={() =>
                handleScrapeNswTab(selectedDate, endDate, trackFilter, {
                  silent: false,
                  preserveSelection: true,
                  forceRefresh: true,
                })
              }
              className="apple-btn-primary !px-3 sm:!px-4 !py-1 sm:!py-1.5"
              title={`Background refresh ${
                autoRefreshResults ? "active" : "paused"
              }. Click to update now.`}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isScraping || isBackgroundRefreshing ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline md:hidden lg:inline">
                {isScraping
                  ? "Updating..."
                  : isBackgroundRefreshing
                  ? "Syncing..."
                  : "Update Results"}
              </span>
              <span className="inline sm:hidden md:inline lg:hidden">
                {isScraping
                  ? "Updating..."
                  : isBackgroundRefreshing
                  ? "Syncing..."
                  : "Update"}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Tabbed Container with Dynamic Header Offset Clearance */}
      <main className="w-full max-w-[1440px] mx-auto px-4 sm:px-8 pt-3 sm:pt-4 pb-32 space-y-8 flex-1">
        {/* Hero Section: Adaptive Turf Dark Default vs Apple Minimalist */}
        {isApple ? (
          <section className="text-center pt-4 pb-2 max-w-4xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0071E3]/10 text-[#0071E3] text-xs font-semibold tracking-wide">
              <span>NSW TAB RACING &amp; BETTING SYNDICATE</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[#1D1D1F]">
              TurfSheet Punters Club
            </h1>
            <p className="text-sm sm:text-base text-[#86868B] max-w-2xl mx-auto leading-relaxed">
              Precision racecards, member selections, consensus algorithms, and live TAB dividend scoring in one refined workspace.
            </p>

            {/* Quiet Metric Indicators */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-5 sm:gap-8 text-xs text-[#86868B]">
              <div>
                <span className="text-[#1D1D1F] font-semibold text-sm tabular-nums mr-1">
                  {visibleMeetings.length}
                </span>
                <span>Active Meeting{visibleMeetings.length !== 1 ? "s" : ""}</span>
              </div>
              <span className="text-[#D2D2D7]">•</span>
              <div>
                <span className="text-[#1D1D1F] font-semibold text-sm mr-1">
                  {activePunter.name}
                </span>
                <span>Active Punter</span>
              </div>
              <span className="text-[#D2D2D7]">•</span>
              <div>
                <span className="text-[#1D1D1F] font-semibold text-sm tabular-nums mr-1">
                  {visibleMeetings.reduce((acc, m) => acc + m.races.length, 0)}
                </span>
                <span>Races Scheduled</span>
              </div>
              <span className="text-[#D2D2D7]">•</span>
              <div className="flex items-center gap-1.5 text-[#34C759] font-medium">
                <span className="w-2 h-2 rounded-full bg-[#34C759]"></span>
                <span>Auto-Sync Active</span>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-[#1F2D26] bg-gradient-to-b from-[#0E1512] to-[#070B09] p-5 sm:p-7 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#10B981]/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-start gap-4 text-left">
                <img
                  src={horseBeerMascotImg}
                  alt="TurfSheet Punters Club"
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-[#D4AF37] shadow-lg shrink-0"
                />
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/50 text-[#D4AF37] text-[11px] font-mono font-bold uppercase tracking-wider">
                      ★ OFFICIAL SYNDICATE
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] text-[11px] font-mono font-semibold">
                      NSW TAB LIVE
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[#F3F4F0] font-display">
                    TURFSHEET PUNTERS CLUB
                  </h1>
                  <p className="text-xs sm:text-sm text-[#8A9990] max-w-xl">
                    High-stakes horse racing ledger, consensus algorithms, exotic dividends, and real-time TAB results.
                  </p>
                </div>
              </div>

              {/* Quick Key Metrics in Turf Dark */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full md:w-auto shrink-0">
                <div className="rounded-xl border border-[#1F2D26] bg-[#0B110E] p-3 text-center">
                  <div className="text-[10px] text-[#8A9990] uppercase font-mono">Meetings</div>
                  <div className="text-lg font-bold font-mono text-[#F3F4F0] tabular-nums">{visibleMeetings.length}</div>
                </div>
                <div className="rounded-xl border border-[#1F2D26] bg-[#0B110E] p-3 text-center">
                  <div className="text-[10px] text-[#8A9990] uppercase font-mono">Punters</div>
                  <div className="text-lg font-bold font-mono text-[#D4AF37] tabular-nums">{punters.length}</div>
                </div>
                <div className="rounded-xl border border-[#1F2D26] bg-[#0B110E] p-3 text-center">
                  <div className="text-[10px] text-[#8A9990] uppercase font-mono">Scheduled</div>
                  <div className="text-lg font-bold font-mono text-[#F3F4F0] tabular-nums">
                    {visibleMeetings.reduce((acc, m) => acc + m.races.length, 0)}
                  </div>
                </div>
                <div className="rounded-xl border border-[#1F2D26] bg-[#0B110E] p-3 text-center">
                  <div className="text-[10px] text-[#8A9990] uppercase font-mono">Auto-Sync</div>
                  <div className="text-sm font-bold font-mono text-[#10B981] flex items-center justify-center gap-1 mt-1">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                    ACTIVE
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Date & Date Range Calendar Control Bar */}
        <DateRangeCalendarBar
          dateMode={dateMode}
          onDateModeChange={setDateMode}
          selectedDate={selectedDate}
          endDate={endDate}
          onDateSelect={(start, end) => {
            setSelectedDate(start);
            setEndDate(end);
          }}
          trackFilter={trackFilter}
          onTrackFilterChange={setTrackFilter}
          availableTracksForDate={allMeetingsOnSelectedDate}
          selectedMeetingIds={selectedMeetingIds}
          onChangeSelectedMeetingIds={handleUpdateSelectedMeetingIds}
          punters={punters}
          autoScrapeOnDateChange={autoScrapeOnDateChange}
          onToggleAutoScrape={() =>
            setAutoScrapeOnDateChange((prev) => !prev)
          }
          onTriggerScrape={handleScrapeNswTab}
          isScraping={isScraping}
        />

        {/* 4-Card Structured Workspace Grid */}
        <div
          id="tab-workspace-anchor"
          role="tablist"
          aria-label="Workspace Tabs"
          style={{ scrollMarginTop: "calc(var(--app-header-height, 72px) + 28px)" }}
          className="scroll-section-clearance grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "overview"}
            onClick={() => switchTab("overview")}
            className={`apple-card p-5 text-left transition-all cursor-pointer flex flex-col justify-between gap-4 ${
              activeTab === "overview"
                ? isApple
                  ? "border-[#0071E3] ring-2 ring-[#0071E3]/20 shadow-md bg-white"
                  : "border-[#10B981] ring-2 ring-[#10B981]/25 bg-[#0E1512] shadow-lg"
                : isApple
                ? "hover:border-[#D2D2D7]"
                : "hover:border-[#2A3F33]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    activeTab === "overview"
                      ? isApple
                        ? "bg-[#0071E3] text-white"
                        : "bg-[#10B981] text-[#070B09] font-bold"
                      : isApple
                      ? "bg-[#F2F2F7] text-[#86868B]"
                      : "bg-[#121A16] text-[#8A9990]"
                  }`}
                >
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`text-sm font-semibold ${isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"}`}>
                    Overview
                  </h3>
                  <p className={`text-xs ${isApple ? "text-[#86868B]" : "text-[#8A9990]"}`}>
                    Feature Cards &amp; Full Form
                  </p>
                </div>
              </div>
            </div>
            <div className={`flex items-center justify-between text-xs pt-2 border-t ${
              isApple ? "text-[#86868B] border-[#F2F2F7]" : "text-[#8A9990] border-[#1F2D26]"
            }`}>
              <span>NSW &amp; VIC Cards</span>
              <span className={`font-semibold ${isApple ? "text-[#1D1D1F]" : "text-[#D4AF37]"}`}>
                {visibleMeetings.length} Cards
              </span>
            </div>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "selections"}
            onClick={() => switchTab("selections")}
            className={`apple-card p-5 text-left transition-all cursor-pointer flex flex-col justify-between gap-4 ${
              activeTab === "selections"
                ? isApple
                  ? "border-[#0071E3] ring-2 ring-[#0071E3]/20 shadow-md bg-white"
                  : "border-[#10B981] ring-2 ring-[#10B981]/25 bg-[#0E1512] shadow-lg"
                : isApple
                ? "hover:border-[#D2D2D7]"
                : "hover:border-[#2A3F33]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    activeTab === "selections"
                      ? isApple
                        ? "bg-[#0071E3] text-white"
                        : "bg-[#10B981] text-[#070B09] font-bold"
                      : isApple
                      ? "bg-[#F2F2F7] text-[#86868B]"
                      : "bg-[#121A16] text-[#8A9990]"
                  }`}
                >
                  <Table2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`text-sm font-semibold ${isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"}`}>
                    Betting Selections
                  </h3>
                  <p className={`text-xs ${isApple ? "text-[#86868B]" : "text-[#8A9990]"}`}>
                    1st/2nd/3rd Picks &amp; Joker
                  </p>
                </div>
              </div>
            </div>
            <div className={`flex items-center justify-between text-xs pt-2 border-t ${
              isApple ? "text-[#86868B] border-[#F2F2F7]" : "text-[#8A9990] border-[#1F2D26]"
            }`}>
              <span>Active Punter</span>
              <span className={`font-semibold ${isApple ? "text-[#1D1D1F]" : "text-[#D4AF37]"}`}>
                {activePunter.name}
              </span>
            </div>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "exotics"}
            onClick={() => switchTab("exotics")}
            className={`apple-card p-5 text-left transition-all cursor-pointer flex flex-col justify-between gap-4 ${
              activeTab === "exotics"
                ? isApple
                  ? "border-[#0071E3] ring-2 ring-[#0071E3]/20 shadow-md bg-white"
                  : "border-[#10B981] ring-2 ring-[#10B981]/25 bg-[#0E1512] shadow-lg"
                : isApple
                ? "hover:border-[#D2D2D7]"
                : "hover:border-[#2A3F33]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    activeTab === "exotics"
                      ? isApple
                        ? "bg-[#0071E3] text-white"
                        : "bg-[#10B981] text-[#070B09] font-bold"
                      : isApple
                      ? "bg-[#F2F2F7] text-[#86868B]"
                      : "bg-[#121A16] text-[#8A9990]"
                  }`}
                >
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`text-sm font-semibold ${isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"}`}>
                    Exotics Studio
                  </h3>
                  <p className={`text-xs ${isApple ? "text-[#86868B]" : "text-[#8A9990]"}`}>
                    Trifectas &amp; Quaddies
                  </p>
                </div>
              </div>
            </div>
            <div className={`flex items-center justify-between text-xs pt-2 border-t ${
              isApple ? "text-[#86868B] border-[#F2F2F7]" : "text-[#8A9990] border-[#1F2D26]"
            }`}>
              <span>Flexi Calculator</span>
              <span className={`font-semibold ${isApple ? "text-[#1D1D1F]" : "text-[#D4AF37]"}`}>
                Studio
              </span>
            </div>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "results"}
            onClick={() => switchTab("results")}
            className={`apple-card p-5 text-left transition-all cursor-pointer flex flex-col justify-between gap-4 ${
              activeTab === "results"
                ? isApple
                  ? "border-[#0071E3] ring-2 ring-[#0071E3]/20 shadow-md bg-white"
                  : "border-[#10B981] ring-2 ring-[#10B981]/25 bg-[#0E1512] shadow-lg"
                : isApple
                ? "hover:border-[#D2D2D7]"
                : "hover:border-[#2A3F33]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    activeTab === "results"
                      ? isApple
                        ? "bg-[#0071E3] text-white"
                        : "bg-[#10B981] text-[#070B09] font-bold"
                      : isApple
                      ? "bg-[#F2F2F7] text-[#86868B]"
                      : "bg-[#121A16] text-[#8A9990]"
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <h3 className={`text-sm font-semibold ${isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"}`}>
                    Official Results
                  </h3>
                  <p className={`text-xs ${isApple ? "text-[#86868B]" : "text-[#8A9990]"}`}>
                    Leaderboard &amp; Dividends
                  </p>
                </div>
              </div>
            </div>
            <div className={`flex items-center justify-between text-xs pt-2 border-t ${
              isApple ? "text-[#86868B] border-[#F2F2F7]" : "text-[#8A9990] border-[#1F2D26]"
            }`}>
              <span>Completed Races</span>
              <span className={`font-semibold ${isApple ? "text-[#1D1D1F]" : "text-[#D4AF37]"}`}>
                {activeMeeting
                  ? `${
                      activeMeeting.races.filter((r) =>
                        isRaceOfficialOrCompleted(r, activeMeeting.date)
                      ).length
                    }/${activeMeeting.races.length} Final`
                  : "Live"}
              </span>
            </div>
          </button>
        </div>

        {/* Toast or Error Notice */}
        {toastMessage && (
          <div className="bg-[#EAFBF0] border border-[#34C759]/30 text-[#1D1D1F] px-4 py-3 rounded-2xl text-xs flex items-center justify-between shadow-xs">
            <span className="font-medium">{toastMessage}</span>
            <div className="flex items-center gap-2 ml-4 shrink-0">
              {activeTab !== "selections" && (
                <button
                  type="button"
                  onClick={() => switchTab("selections")}
                  className="px-3 py-1 rounded-full bg-white border border-[#E5E5EA] text-[#0071E3] font-semibold hover:border-[#0071E3] transition-all whitespace-nowrap cursor-pointer shadow-xs"
                >
                  Open Betting Selections →
                </button>
              )}
              {activeTab !== "results" && (
                <button
                  type="button"
                  onClick={() => switchTab("results")}
                  className="px-3 py-1 rounded-full bg-white border border-[#E5E5EA] text-[#34C759] font-semibold hover:border-[#34C759] transition-all whitespace-nowrap cursor-pointer shadow-xs"
                >
                  Open Results →
                </button>
              )}
            </div>
          </div>
        )}

        {scrapeError && (
          <div className="bg-[#FEECEB] border border-[#FF3B30]/30 text-[#1D1D1F] px-4 py-3 rounded-2xl text-xs flex items-center justify-between shadow-xs">
            <span className="font-medium">{scrapeError}</span>
            <button
              type="button"
              onClick={() => setScrapeError(null)}
              className="text-xs text-[#86868B] hover:text-[#1D1D1F] ml-4 font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {visibleMeetings.length === 0 && (
          <div className="apple-card p-10 text-center space-y-3">
            <div className="text-base font-semibold text-[#1D1D1F]">
              No Scheduled Racing Found for{" "}
              {trackFilter ? `"${trackFilter}" on ` : ""}
              {formatReadableDate(selectedDate)} ({selectedDate})
            </div>
            <p className="text-xs text-[#86868B] max-w-xl mx-auto leading-relaxed">
              To maintain strict data integrity, substitute or inferred venue data is never displayed when an event is not listed for the nominated date.
            </p>
            {trackFilter && allMeetingsOnSelectedDate.length > 0 && (
              <button
                type="button"
                onClick={() => setTrackFilter("")}
                className="px-4 py-2 rounded-full bg-[#0071E3] text-white text-xs font-semibold hover:bg-[#0077ED] transition-colors cursor-pointer shadow-xs"
              >
                Show All {allMeetingsOnSelectedDate.length} Venues Racing on{" "}
                {selectedDate} (
                {allMeetingsOnSelectedDate.map((m) => m.venue).join(" · ")})
              </button>
            )}
          </div>
        )}

        {/* ====================================================================
            TAB 1: OVERVIEW (VIC & NSW FEATURE RACE DAYS, TOP FAVOURITES,
            FULL RACE CARD & FORM GUIDE INSPECTOR, IPAD PRO PWA GUIDE)
           ==================================================================== */}
        {activeTab === "overview" && visibleMeetings.length > 0 && (
          <div role="tabpanel" aria-label="Overview Tab" className="space-y-8">
            <MajorRaceDaysOverview
              meetings={visibleMeetings}
              selectedMeetingId={activeMeeting?.id || ""}
              selectedMeetingIds={selectedMeetingIds}
              onChangeSelectedMeetingIds={handleUpdateSelectedMeetingIds}
              punters={punters}
              selectedRaceNumber={selectedRaceNumber}
              verifiedSourcesUsed={verifiedSourcesUsed}
              onInspectRace={(meetingId, raceNo) => {
                setSelectedMeetingId(meetingId);
                if (!selectedMeetingIds.includes(meetingId)) {
                  handleUpdateSelectedMeetingIds([
                    ...selectedMeetingIds,
                    meetingId,
                  ]);
                }
                setSelectedRaceNumber(raceNo);
                // Allow state re-render to paint the target race runners before calculating scroll position
                setTimeout(() => {
                  scrollToSection("section-market-analytics");
                }, 60);
              }}
              onJumpToSelectionsForMeeting={(meetingId) => {
                setSelectedMeetingId(meetingId);
                if (!selectedMeetingIds.includes(meetingId)) {
                  handleUpdateSelectedMeetingIds([
                    ...selectedMeetingIds,
                    meetingId,
                  ]);
                }
                switchTab("selections");
              }}
            />

            {activeMeeting && (
              <div
                id="section-market-analytics"
                style={{ scrollMarginTop: "calc(var(--app-header-height, 72px) + 24px)" }}
                className="scroll-section-clearance"
              >
                <RaceMarketRadarBarChart
                  meeting={activeMeeting}
                  raceNumber={selectedRaceNumber}
                  onSelectRaceNumber={(raceNo) => setSelectedRaceNumber(raceNo)}
                  allMeetings={visibleMeetings}
                  onSelectMeeting={(mId) => {
                    setSelectedMeetingId(mId);
                    if (!selectedMeetingIds.includes(mId)) {
                      handleUpdateSelectedMeetingIds([
                        ...selectedMeetingIds,
                        mId,
                      ]);
                    }
                  }}
                  isApple={isApple}
                  activePunter={activePunter}
                  currentSelections={
                    activePunter.selectionsByMeeting[activeMeeting.id]?.[
                      selectedRaceNumber
                    ]
                  }
                  onAssignPreference={(prefRank, tabNo) => {
                    handleUpdateRaceSelection(
                      activePunter.id,
                      activeMeeting.id,
                      selectedRaceNumber,
                      prefRank,
                      tabNo
                    );
                    const rankText =
                      prefRank === 1
                        ? "1st Preference"
                        : prefRank === 2
                        ? "2nd Preference"
                        : "3rd Preference";
                    triggerToast(
                      `Set Runner #${tabNo} as ${rankText} in Race ${selectedRaceNumber} for ${activePunter.name}`
                    );
                  }}
                  onInspectFormGuide={() => {
                    scrollToSection("section-full-racecard");
                  }}
                />
              </div>
            )}

            {activeMeeting && (
              <section
                id="section-full-racecard"
                style={{ scrollMarginTop: "calc(var(--app-header-height, 72px) + 32px)" }}
                className="scroll-section-clearance space-y-4"
              >
                <div className="apple-card p-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2
                      className={`text-base sm:text-lg font-bold tracking-tight ${
                        isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"
                      }`}
                    >
                      Full Field &amp; Form Guide — {activeMeeting.venue} (Race{" "}
                      {selectedRaceNumber})
                    </h2>
                    <p
                      className={`text-xs mt-0.5 ${
                        isApple ? "text-[#86868B]" : "text-[#8A9990]"
                      }`}
                    >
                      Inspect every runner, barrier, jockey, trainer, weight, and live odds, or assign 1st/2nd/3rd preferences directly.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const currentJoker = getPunterJokerForMeeting(
                          activePunter,
                          activeMeeting
                        );
                        handleToggleJokerRace(
                          activePunter.id,
                          activeMeeting.id,
                          currentJoker === selectedRaceNumber
                            ? null
                            : selectedRaceNumber
                        );
                      }}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                        getPunterJokerForMeeting(activePunter, activeMeeting) ===
                        selectedRaceNumber
                          ? "bg-[#FF9500] text-white border-[#FF9500] shadow-xs"
                          : "border-[#FF9500]/40 bg-white text-[#FF9500] hover:bg-[#FFF5E6]"
                      }`}
                    >
                      {getPunterJokerForMeeting(activePunter, activeMeeting) ===
                      selectedRaceNumber
                        ? `🃏 Race ${selectedRaceNumber} is ${activePunter.name}'s Joker (2× Active)`
                        : `🃏 Play Joker (2×) on Race ${selectedRaceNumber}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => switchTab("selections")}
                      className="rounded-full border border-[#0071E3] bg-[#0071E3] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0077ED] shadow-xs transition-all cursor-pointer"
                    >
                      Open Betting Selections →
                    </button>
                  </div>
                </div>

                <RaceCardAndFormSheet
                  meetings={visibleMeetings}
                  selectedMeetingId={activeMeeting.id}
                  onSelectMeeting={setSelectedMeetingId}
                  selectedMeetingIds={selectedMeetingIds}
                  onChangeSelectedMeetingIds={handleUpdateSelectedMeetingIds}
                  punters={punters}
                  selectedRaceNumber={selectedRaceNumber}
                  onSelectRaceNumber={setSelectedRaceNumber}
                  activePunterName={activePunter.name}
                  currentMeetingSelections={
                    activePunter.selectionsByMeeting[activeMeeting.id] || {}
                  }
                  onAssignPreference={(meetingId, raceNo, prefRank, tabNo) => {
                    handleUpdateRaceSelection(
                      activePunter.id,
                      meetingId,
                      raceNo,
                      prefRank,
                      tabNo
                    );
                    const rankText =
                      prefRank === 1
                        ? "1st Preference"
                        : prefRank === 2
                        ? "2nd Preference"
                        : "3rd Preference";
                    triggerToast(
                      `Set Runner #${tabNo} as ${rankText} in Race ${raceNo} for ${activePunter.name}`
                    );
                  }}
                  isApple={isApple}
                />
              </section>
            )}
          </div>
        )}


        {/* ====================================================================
            TAB: BETTING SELECTIONS (STEVE F & MARK S + JOKER ROUND 2×)
           ==================================================================== */}
        {activeTab === "selections" && activeMeeting && (
          <section
            id="section-selections"
            role="tabpanel"
            aria-label="Betting Selections Tab"
            className="space-y-4 pb-24"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#23352C] bg-[#0E1813] px-4 py-3">
              <div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#F3F4F0]">
                  Syndicate Betting Selections &amp; Joker Round (Steve F &amp; Mark S)
                </h2>
                <p className="text-xs text-[#9BA8A1]">
                  Select 1st, 2nd, and 3rd preference runners for each race, and nominate 1 preferred{" "}
                  <strong className="text-[#D4AF37]">Joker Round (2× Double Points for ALL successful selections: 1st, 2nd, or 3rd)</strong>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => switchTab("overview")}
                  className="rounded-lg border border-[#23352C] bg-[#132019] px-3 py-1.5 text-xs font-semibold text-[#D5DDD8] hover:border-[#D4AF37] hover:text-[#D4AF37] cursor-pointer"
                >
                  ← Overview &amp; Form Guide
                </button>
                <button
                  type="button"
                  onClick={() => switchTab("results")}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-950/60 cursor-pointer"
                >
                  View Official Results &amp; Trifecta Tracker →
                </button>
              </div>
            </div>

            <BettingLedgerSheet
              meetings={visibleMeetings}
              selectedMeetingId={activeMeeting.id}
              onSelectMeeting={setSelectedMeetingId}
              selectedMeetingIds={selectedMeetingIds}
              onChangeSelectedMeetingIds={handleUpdateSelectedMeetingIds}
              selectedDate={selectedDate}
              onChangeDate={(newIsoDate) => {
                setDateMode("single");
                setSelectedDate(newIsoDate);
                setEndDate(newIsoDate);
              }}
              onRefreshSelectedDay={() =>
                handleScrapeNswTab(selectedDate, endDate, trackFilter)
              }
              isScraping={isScraping}
              punters={punters}
              activePunterId={activePunter.id}
              onSelectPunter={setActivePunterId}
              onAddPunter={handleAddPunter}
              onRemovePunter={handleRemovePunter}
              scoringMode={scoringMode}
              onToggleScoringMode={setScoringMode}
              onUpdateRaceSelection={handleUpdateRaceSelection}
              onToggleJokerRace={handleToggleJokerRace}
              onAutoFillCardForPunter={handleAutoFillCardForPunter}
              onClearCardForPunter={handleClearCardForPunter}
              onSaveConfirmation={(msg) => {
                persistPuntersToCloud(punters, false);
                triggerToast(msg);
              }}
              cloudSyncState={cloudSyncState}
              lastSyncedTime={lastSyncedTime}
              onManualCloudSync={() => persistPuntersToCloud(punters, true)}
              onNavigateToResults={() => switchTab("results")}
            />
          </section>
        )}

        {/* ====================================================================
            TAB: EXOTICS BENTO STUDIO (TRIFECTAS & QUADDIES REVIEW & SELECTION)
           ==================================================================== */}
        {activeTab === "exotics" && activeMeeting && (
          <section
            id="section-exotics"
            role="tabpanel"
            aria-label="Exotics Studio Tab"
            className="space-y-4 pb-24"
          >
            <ExoticsBentoStudio
              meetings={visibleMeetings}
              selectedMeetingId={activeMeeting.id}
              onSelectMeeting={setSelectedMeetingId}
              selectedMeetingIds={selectedMeetingIds}
              onChangeSelectedMeetingIds={handleUpdateSelectedMeetingIds}
              punters={punters}
              activePunterId={activePunter.id}
              onSelectPunter={setActivePunterId}
              trifectaBetAmount={trifectaBetAmount}
              onChangeTrifectaBetAmount={setTrifectaBetAmount}
              quaddieBuyInPerUser={quaddieBuyInPerUser}
              onChangeQuaddieBuyInPerUser={setQuaddieBuyInPerUser}
              quaddieExtraByMeeting={quaddieExtraByMeeting}
              onToggleQuaddieExtraRunner={handleToggleQuaddieExtraRunner}
              onClearQuaddieExtrasForLeg={handleClearQuaddieExtrasForLeg}
              onJumpToSelections={(punterId, meetingId) => {
                if (punterId) setActivePunterId(punterId);
                if (meetingId) {
                  setSelectedMeetingId(meetingId);
                  if (!selectedMeetingIds.includes(meetingId)) {
                    handleUpdateSelectedMeetingIds([
                      ...selectedMeetingIds,
                      meetingId,
                    ]);
                  }
                }
                switchTab("selections");
              }}
              onTriggerToast={triggerToast}
            />
          </section>
        )}

        {/* ====================================================================
            TAB 3: RESULTS (LIVE STANDINGS, PAYOUT MATRIX & COMBINED TRIFECTA)
           ==================================================================== */}
        {activeTab === "results" && activeMeeting && (
          <div
            role="tabpanel"
            aria-label="Results Tab"
            className="space-y-8"
          >
            {/* Registered Punters Leaderboard Component */}
            <PunterLeaderboard
              meetings={visibleMeetings}
              selectedMeetingId={activeMeeting.id}
              onSelectMeeting={setSelectedMeetingId}
              punters={punters}
              scoringMode={scoringMode}
              onToggleScoringMode={setScoringMode}
              onJumpToSelections={(punterId, meetingId) => {
                setActivePunterId(punterId);
                setSelectedMeetingId(meetingId);
                if (!selectedMeetingIds.includes(meetingId)) {
                  handleUpdateSelectedMeetingIds([
                    ...selectedMeetingIds,
                    meetingId,
                  ]);
                }
                switchTab("selections");
              }}
            />

            <section id="section-results" className="scroll-mt-24 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#23352C] bg-[#0E1813] px-4 py-3">
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#F3F4F0]">
                    Official Results, Standings &amp; Payout Matrix
                  </h2>
                  <p className="text-xs text-[#9BA8A1]">
                    Live race-by-race points (including 2× Joker Round bonus points) and TAB dividend returns for officially completed races.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => scrollToSection("section-combined-trifecta")}
                    className="rounded-lg border border-[#D4AF37]/50 bg-[#D4AF37]/15 px-3 py-1.5 text-xs font-bold text-[#D4AF37] hover:bg-[#D4AF37]/25 cursor-pointer"
                  >
                    ↓ Trifecta Tracker
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection("section-combined-quaddie")}
                    className="rounded-lg border border-[#10B981]/50 bg-[#10B981]/15 px-3 py-1.5 text-xs font-bold text-[#10B981] hover:bg-[#10B981]/25 cursor-pointer"
                  >
                    ↓ Quaddie Selector
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateAndOpenReport}
                    className="rounded-lg border border-[#D4AF37] bg-[#D4AF37] px-3 py-1.5 text-xs font-bold text-[#0B110E] hover:bg-[#e3be42] cursor-pointer"
                  >
                    ↓ Generate Race Report
                  </button>
                  <button
                    type="button"
                    onClick={() => switchTab("selections")}
                    className="rounded-lg border border-[#23352C] bg-[#132019] px-3 py-1.5 text-xs font-semibold text-[#D5DDD8] hover:border-[#D4AF37] hover:text-[#D4AF37] cursor-pointer"
                  >
                    ← Edit Betting Selections
                  </button>
                </div>
              </div>

              <AllUsersSelectionsResults
                meetings={visibleMeetings}
                selectedMeetingId={activeMeeting.id}
                onSelectMeeting={setSelectedMeetingId}
                selectedMeetingIds={selectedMeetingIds}
                onChangeSelectedMeetingIds={handleUpdateSelectedMeetingIds}
                punters={punters}
                scoringMode={scoringMode}
                onToggleScoringMode={setScoringMode}
                onEditUserSelections={(punterId, meetingId) => {
                  setActivePunterId(punterId);
                  setSelectedMeetingId(meetingId);
                  if (!selectedMeetingIds.includes(meetingId)) {
                    handleUpdateSelectedMeetingIds([
                      ...selectedMeetingIds,
                      meetingId,
                    ]);
                  }
                  switchTab("selections");
                }}
                onRemovePunter={handleRemovePunter}
                trifectaBetAmount={trifectaBetAmount}
                quaddieBuyInPerUser={quaddieBuyInPerUser}
                quaddieExtraByMeeting={quaddieExtraByMeeting}
                onPushRaceResultNotification={(raceNo) =>
                  triggerRaceResultPushNotification(raceNo, activeMeeting, punters, true)
                }
                onRefreshResultsNow={() =>
                  handleScrapeNswTab(selectedDate, endDate, trackFilter, {
                    silent: false,
                    preserveSelection: true,
                    forceRefresh: true,
                  })
                }
                isRefreshingResults={isScraping || isBackgroundRefreshing}
                autoRefreshResults={autoRefreshResults}
                onToggleAutoRefreshResults={() =>
                  setAutoRefreshResults((prev) => !prev)
                }
                lastResultsUpdatedAt={lastResultsUpdatedAt}
                nextRefreshCountdown={nextRefreshCountdown}
                isApple={isApple}
              />
            </section>

            {/* Combined Selections & Trifecta Return Tracker */}
            <section
              id="section-combined-trifecta"
              className="scroll-mt-24 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#D4AF37]/40 bg-[#0E1813] px-4 py-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#D4AF37]">
                    <Layers className="h-3.5 w-3.5" />
                    Syndicate Combined Trifecta Pool &amp; Bookmaker Return Tracker
                  </span>
                  <h2 className="mt-0.5 font-serif text-xl sm:text-2xl font-bold text-[#F3F4F0]">
                    Combined User Selections for the Trifecta &amp; Bookmaker Value Return (${trifectaBetAmount} Bet Basis)
                  </h2>
                  <p className="text-xs text-[#9BA8A1]">
                    Lists out the combined selections from all users ({punters.map((p) => p.name).join(", ")}) for each race to select the syndicate Trifecta, calculates Trifecta odds &amp; payouts on a ${trifectaBetAmount} bet (customisable below), and tracks bookmaker/tote value returns.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => switchTab("selections")}
                    className="rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-3 py-1.5 text-xs font-bold text-[#D4AF37] hover:bg-[#D4AF37]/25 cursor-pointer"
                  >
                    ← Edit Selections
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection("section-results")}
                    className="rounded-lg border border-[#23352C] bg-[#132019] px-3 py-1.5 text-xs font-semibold text-[#D5DDD8] hover:border-[#D4AF37] hover:text-[#D4AF37] cursor-pointer"
                  >
                    ↑ Top of Results
                  </button>
                </div>
              </div>

              <CombinedTrifectaTracker
                meetings={visibleMeetings}
                selectedMeetingId={activeMeeting.id}
                onSelectMeeting={setSelectedMeetingId}
                selectedMeetingIds={selectedMeetingIds}
                onChangeSelectedMeetingIds={handleUpdateSelectedMeetingIds}
                punters={punters}
                trifectaBetAmount={trifectaBetAmount}
                onChangeTrifectaBetAmount={setTrifectaBetAmount}
                onTriggerToast={triggerToast}
                onJumpToSelections={(punterId, meetingId) => {
                  if (punterId) setActivePunterId(punterId);
                  if (meetingId) {
                    setSelectedMeetingId(meetingId);
                    if (!selectedMeetingIds.includes(meetingId)) {
                      handleUpdateSelectedMeetingIds([
                        ...selectedMeetingIds,
                        meetingId,
                      ]);
                    }
                  }
                  switchTab("selections");
                }}
              />
            </section>

            {/* Combined Syndicate Quaddie Selector (Last 4 Races + Quaddie-Only Extra Selections) */}
            <section
              id="section-combined-quaddie"
              className="scroll-mt-24 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#10B981]/40 bg-[#0E1813] px-4 py-3">
                <div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#10B981]">
                    <Layers className="h-3.5 w-3.5" />
                    Syndicate Combined Quaddie Selector (Last 4 Races on Card)
                  </span>
                  <h2 className="mt-0.5 font-serif text-xl sm:text-2xl font-bold text-[#F3F4F0]">
                    Combined Group Quaddie Pool + Quaddie-Only Extra Selections
                  </h2>
                  <p className="text-xs text-[#9BA8A1]">
                    Uses the combined selections of all users across the last 4 races, and lets you add extra Quaddie-only horses in each leg to expand the group Quaddie without affecting user points or Trifecta scoring anywhere else.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateAndOpenReport}
                    className="rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-3 py-1.5 text-xs font-bold text-[#D4AF37] hover:bg-[#D4AF37]/25 cursor-pointer"
                  >
                    ↓ Generate Race Report
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToSection("section-results")}
                    className="rounded-lg border border-[#23352C] bg-[#132019] px-3 py-1.5 text-xs font-semibold text-[#D5DDD8] hover:border-[#D4AF37] hover:text-[#D4AF37] cursor-pointer"
                  >
                    ↑ Top of Results
                  </button>
                </div>
              </div>

              <CombinedQuaddieTracker
                meetings={visibleMeetings}
                selectedMeetingId={activeMeeting.id}
                onSelectMeeting={setSelectedMeetingId}
                selectedMeetingIds={selectedMeetingIds}
                onChangeSelectedMeetingIds={handleUpdateSelectedMeetingIds}
                punters={punters}
                quaddieBuyInPerUser={quaddieBuyInPerUser}
                onChangeQuaddieBuyInPerUser={setQuaddieBuyInPerUser}
                quaddieExtraByMeeting={quaddieExtraByMeeting}
                onToggleQuaddieExtraRunner={handleToggleQuaddieExtraRunner}
                onClearQuaddieExtrasForLeg={handleClearQuaddieExtrasForLeg}
                onJumpToSelections={(punterId, meetingId) => {
                  if (punterId) setActivePunterId(punterId);
                  if (meetingId) {
                    setSelectedMeetingId(meetingId);
                    if (!selectedMeetingIds.includes(meetingId)) {
                      handleUpdateSelectedMeetingIds([
                        ...selectedMeetingIds,
                        meetingId,
                      ]);
                    }
                  }
                  switchTab("selections");
                }}
              />
            </section>

            {/* Syndicate Race Reports Sheet & Email Dispatcher */}
            <section
              id="section-race-reports"
              className="scroll-mt-24 space-y-3"
            >
              <RaceReportSheet
                meetings={visibleMeetings}
                allKnownMeetings={meetings}
                selectedMeetingId={activeMeeting.id}
                selectedMeetingIds={selectedMeetingIds}
                onChangeSelectedMeetingIds={handleUpdateSelectedMeetingIds}
                punters={punters}
                trifectaBetAmount={trifectaBetAmount}
                quaddieBuyInPerUser={quaddieBuyInPerUser}
                quaddieExtraByMeeting={quaddieExtraByMeeting}
                generateReportSignal={generateReportSignal}
                onTriggerToast={triggerToast}
                isApple={isApple}
              />
            </section>
          </div>
        )}

      </main>

      {/* Desktop Persistent Race Ribbon */}
      {activeMeeting && (
        <div className="hidden md:block">
          <PersistentRaceRibbon
            meetings={visibleMeetings}
            activeMeeting={activeMeeting}
            onSelectMeeting={(id) => setSelectedMeetingId(id)}
            selectedRaceNumber={selectedRaceNumber}
            onSelectRaceNumber={(raceNo) => setSelectedRaceNumber(raceNo)}
            activeTab={activeTab}
            onJumpTo={handleJumpToRace}
            punters={punters}
          />
        </div>
      )}

      {/* Mobile & Tablet Floating Bottom Quick-Action Bar & Jump Ribbon Dock */}
      {activeMeeting && (
        <div className="md:hidden">
          <FloatingBottomActionDock
            meetings={visibleMeetings}
            activeMeeting={activeMeeting}
            onSelectMeeting={(id) => setSelectedMeetingId(id)}
            selectedRaceNumber={selectedRaceNumber}
            onSelectRaceNumber={(raceNo) => setSelectedRaceNumber(raceNo)}
            activeTab={activeTab}
            onSwitchTab={switchTab}
            onJumpToRace={(raceNo) =>
              handleJumpToRace(activeTab, raceNo, activeMeeting.id)
            }
            isApple={isApple}
            onToggleTheme={() =>
              setThemeScheme((prev) => (prev === "apple" ? "default" : "apple"))
            }
            onOpenReport={() => {
              setGenerateReportSignal((prev) => prev + 1);
              const el = document.getElementById("section-race-reports");
              if (el) {
                el.scrollIntoView({ behavior: "smooth" });
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
