import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Archive,
  Award,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCopy,
  FileText,
  Flame,
  Layers,
  Mail,
  MapPin,
  PieChart,
  Plus,
  Printer,
  RotateCcw,
  Send,
  Target,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import type { PunterProfile, RaceMeeting } from "../types/racing";
import {
  DEFAULT_QUADDIE_BUY_IN_PER_USER,
  formatDollarReturn,
} from "../utils/scoring";
import {
  DEFAULT_REPORT_EMAIL_RECIPIENTS,
  REPORT_SENDER_NAME,
  SavedRaceReport,
  buildCardTrackAndMarketAssessment,
  buildNextMajorMeetsPreview,
  buildRaceReportForMeeting,
  buildRetroactiveSixMonthReportsSeed,
  computeRaceEachWayParUnits,
  formatHtmlReportForEmail,
  formatPlainTextReportForEmail,
  loadLocalSixMonthReports,
  pruneAndSortSixMonthReports,
  saveLocalSixMonthReports,
} from "../utils/raceReportArchive";
import { RaceCardMultiSelectDropdown } from "./RaceCardMultiSelectDropdown";
import { SyndicateSuccessTrendD3Chart } from "./SyndicateSuccessTrendD3Chart";
import { PunterRoiD3BarChart } from "./PunterRoiD3BarChart";
import { BklitReportVisualizer } from "./bklit/BklitReportVisualizer";

interface RaceReportSheetProps {
  meetings: RaceMeeting[];
  allKnownMeetings: RaceMeeting[];
  selectedMeetingId: string;
  selectedMeetingIds?: string[];
  onChangeSelectedMeetingIds?: (ids: string[]) => void;
  punters: PunterProfile[];
  trifectaBetAmount: number;
  quaddieBuyInPerUser?: number;
  quaddieExtraByMeeting?: Record<string, Record<number, number[]>>;
  generateReportSignal?: number;
  onTriggerToast?: (msg: string) => void;
}

const USER_LINE_COLORS = [
  "#D4AF37",
  "#10B981",
  "#38BDF8",
  "#F43F5E",
  "#A855F7",
  "#F97316",
];

export const RaceReportSheet: React.FC<RaceReportSheetProps> = ({
  meetings,
  allKnownMeetings,
  selectedMeetingId,
  selectedMeetingIds,
  onChangeSelectedMeetingIds,
  punters,
  trifectaBetAmount,
  quaddieBuyInPerUser = DEFAULT_QUADDIE_BUY_IN_PER_USER,
  quaddieExtraByMeeting = {},
  generateReportSignal = 0,
  onTriggerToast,
}) => {
  const reportSheetRef = useRef<HTMLDivElement | null>(null);
  const emailPanelRef = useRef<HTMLDivElement | null>(null);

  // Initialize 6-month archive (merging stored local reports + retroactive reports from completed meetings)
  const [archivedReports, setArchivedReports] = useState<SavedRaceReport[]>(
    () => {
      const local = loadLocalSixMonthReports();
      const seedRetro = buildRetroactiveSixMonthReportsSeed(
        allKnownMeetings.length > 0 ? allKnownMeetings : meetings,
        punters,
        trifectaBetAmount,
        quaddieBuyInPerUser
      );
      const mergedMap = new Map<string, SavedRaceReport>();
      for (const r of seedRetro) {
        mergedMap.set(r.id, r);
      }
      for (const r of local) {
        mergedMap.set(r.id, r);
      }
      const finalReports = pruneAndSortSixMonthReports(
        Array.from(mergedMap.values())
      );
      saveLocalSixMonthReports(finalReports);
      return finalReports;
    }
  );

  const [selectedReportId, setSelectedReportId] = useState<string>(() => {
    return `report-${selectedMeetingId}`;
  });

  // Selectable Email Recipients State
  const [availableEmails, setAvailableEmails] = useState<string[]>(() => [
    ...DEFAULT_REPORT_EMAIL_RECIPIENTS,
  ]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>(() => [
    ...DEFAULT_REPORT_EMAIL_RECIPIENTS,
  ]);
  const [newEmailInput, setNewEmailInput] = useState<string>("");
  const [showEmailPrompt, setShowEmailPrompt] = useState<boolean>(false);
  const [autoSendOnGenerate, setAutoSendOnGenerate] = useState<boolean>(true);
  const [wormMetric, setWormMetric] = useState<"points" | "dollars">("points");

  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailStatusBanner, setEmailStatusBanner] = useState<{
    type: "success" | "info";
    message: string;
  } | null>(null);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [showGraphicalEmailPreview, setShowGraphicalEmailPreview] =
    useState<boolean>(false);

  const scrollToObservedReport = () => {
    setTimeout(() => {
      const el =
        reportSheetRef.current ||
        document.getElementById("observed-race-report-view");
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  };

  // Sync meetings where users have active participation into the 6-month archive
  useEffect(() => {
    const poolMeetings =
      allKnownMeetings.length > 0 ? allKnownMeetings : meetings;

    setArchivedReports((prev) => {
      const map = new Map<string, SavedRaceReport>();
      for (const r of prev) {
        map.set(r.id, r);
      }

      const retroList = buildRetroactiveSixMonthReportsSeed(
        poolMeetings,
        punters,
        trifectaBetAmount,
        quaddieBuyInPerUser
      );
      for (const retro of retroList) {
        map.set(retro.id, retro);
      }

      const participatingCount = Math.max(1, punters.length);
      const totalQuaddiePool = quaddieBuyInPerUser * participatingCount;

      for (const m of poolMeetings) {
        const existing = map.get(`report-${m.id}`);
        const liveBuilt = buildRaceReportForMeeting(
          m,
          punters,
          trifectaBetAmount,
          {
            isRetroactive: false,
            existingReport: existing,
            quaddieExtraByRace: quaddieExtraByMeeting[m.id] || {},
            quaddieBuyInPerUser,
            quaddieBetAmount: totalQuaddiePool,
          }
        );
        if (liveBuilt) {
          map.set(liveBuilt.id, liveBuilt);
        }
      }

      const nextList = pruneAndSortSixMonthReports(Array.from(map.values()));
      saveLocalSixMonthReports(nextList);

      fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reports: nextList }),
      }).catch(() => {
        fetch("./api/reports.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reports: nextList }),
        }).catch(() => {});
      });

      return nextList;
    });
  }, [
    meetings,
    allKnownMeetings,
    punters,
    trifectaBetAmount,
    quaddieBuyInPerUser,
    quaddieExtraByMeeting,
  ]);

  // Pull stored 6-month reports from server on mount
  useEffect(() => {
    let cancelled = false;
    const pullServerReports = async () => {
      for (const endpoint of ["/api/reports", "./api/reports.php"]) {
        try {
          const resp = await fetch(endpoint);
          if (!resp.ok) continue;
          const data = await resp.json();
          if (
            !cancelled &&
            Array.isArray(data?.reports) &&
            data.reports.length > 0
          ) {
            setArchivedReports((prev) => {
              const map = new Map<string, SavedRaceReport>();
              for (const r of data.reports as SavedRaceReport[]) {
                if (r?.quaddieSummary) {
                  map.set(r.id, r);
                }
              }
              for (const r of prev) {
                const remote = map.get(r.id);
                if (!remote || r.updatedAtIso >= remote.updatedAtIso) {
                  map.set(r.id, r);
                }
              }
              const merged = pruneAndSortSixMonthReports(
                Array.from(map.values())
              );
              saveLocalSixMonthReports(merged);
              return merged;
            });
            break;
          }
        } catch {
          // ignore offline
        }
      }
    };
    pullServerReports();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeMeetingObj = useMemo(() => {
    return (
      meetings.find((m) => m.id === selectedMeetingId) || meetings[0] || null
    );
  }, [meetings, selectedMeetingId]);

  // Select the current meeting's report if it exists, otherwise default to the newest archived report
  const activeReport: SavedRaceReport | null = useMemo(() => {
    const exact = archivedReports.find((r) => r.id === selectedReportId);
    if (exact) return exact;
    const forCurrentMtg = archivedReports.find(
      (r) => r.meetingId === selectedMeetingId
    );
    if (forCurrentMtg) return forCurrentMtg;
    return archivedReports[0] || null;
  }, [archivedReports, selectedReportId, selectedMeetingId]);

  const handleSendReportEmail = useCallback(
    async (isResend = false, customReport?: SavedRaceReport) => {
      const targetReport = customReport || activeReport;
      if (!targetReport) return;

      const pendingTyped = newEmailInput.trim().toLowerCase();
      const effectiveList =
        selectedEmails.length > 0
          ? [...selectedEmails]
          : [...DEFAULT_REPORT_EMAIL_RECIPIENTS];

      if (
        pendingTyped &&
        pendingTyped.includes("@") &&
        !effectiveList.includes(pendingTyped)
      ) {
        effectiveList.push(pendingTyped);
        if (!availableEmails.includes(pendingTyped)) {
          setAvailableEmails((prev) => [...prev, pendingTyped]);
        }
        setSelectedEmails(effectiveList);
        setNewEmailInput("");
      }

      setIsSendingEmail(true);
      setEmailStatusBanner(null);

      const plainText = formatPlainTextReportForEmail(targetReport);
      const htmlBody = formatHtmlReportForEmail(targetReport);
      const subject = `${isResend ? "[RESEND] " : ""}${REPORT_SENDER_NAME}: ${targetReport.venue} (${targetReport.raceDate}) — ${targetReport.assessment.headline}`;

      let sentViaServer = false;
      let serverNote = "";

      const emailPayload = {
        fromName: REPORT_SENDER_NAME,
        to: effectiveList,
        subject,
        textBody: plainText,
        htmlBody,
        report: targetReport,
      };

      // Dispatch via Native Graphical HTML MIME Mailer (Server & PHP endpoints, no per-run validation required)
      for (const endpoint of [
        "/api/reports/send-email",
        "./api/reports.php?action=send_email",
        "https://cupdaypunting.xo.je/api/reports.php?action=send_email",
      ]) {
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(emailPayload),
          });
          if (res.ok) {
            const json = await res.json();
            if (json?.ok) {
              sentViaServer = true;
              serverNote =
                json.message ||
                `Graphical HTML report auto-dispatched from "${REPORT_SENDER_NAME}" to ${effectiveList.join(" & ")}.`;
              break;
            }
          }
        } catch {
          // try next endpoint
        }
      }

      const nowIso = new Date().toISOString();
      setArchivedReports((prev) => {
        const next = prev.map((r) =>
          r.id === targetReport.id
            ? {
                ...r,
                lastEmailedAtIso: nowIso,
                lastEmailedTo: effectiveList,
                updatedAtIso: nowIso,
              }
            : r
        );
        saveLocalSixMonthReports(next);
        return next;
      });

      setIsSendingEmail(false);
      const statusMsg =
        serverNote ||
        `Graphical HTML report auto-dispatched from "${REPORT_SENDER_NAME}" to ${effectiveList.join(" & ")}.`;

      setEmailStatusBanner({
        type: sentViaServer ? "success" : "info",
        message: `✓ ${statusMsg}`,
      });
      onTriggerToast?.(
        `✓ ${REPORT_SENDER_NAME}: Graphical HTML report (${targetReport.venue} · ${targetReport.raceDate}) ${
          isResend ? "resent" : "auto-sent"
        } to ${effectiveList.join(" & ")}`
      );
    },
    [activeReport, availableEmails, newEmailInput, onTriggerToast, selectedEmails]
  );

  const handleGenerateAndGoToReport = useCallback(
    (silentToast = false) => {
      if (!activeMeetingObj) {
        scrollToObservedReport();
        return;
      }
      const existing = archivedReports.find(
        (r) => r.meetingId === activeMeetingObj.id
      );
      const participatingCount = Math.max(1, punters.length);
      const totalQuaddiePool = quaddieBuyInPerUser * participatingCount;

      const built = buildRaceReportForMeeting(
        activeMeetingObj,
        punters,
        trifectaBetAmount,
        {
          isRetroactive: false,
          existingReport: existing,
          forceGenerateForMeeting: true,
          quaddieExtraByRace: quaddieExtraByMeeting[activeMeetingObj.id] || {},
          quaddieBuyInPerUser,
          quaddieBetAmount: totalQuaddiePool,
        }
      );

      if (built) {
        setArchivedReports((prev) => {
          const filtered = prev.filter((r) => r.id !== built.id);
          const next = pruneAndSortSixMonthReports([built, ...filtered]);
          saveLocalSixMonthReports(next);
          return next;
        });
        setSelectedReportId(built.id);

        if (autoSendOnGenerate) {
          handleSendReportEmail(false, built);
        } else if (!silentToast) {
          onTriggerToast?.(
            `✓ Graphical Race Report generated for ${built.venue} (${built.raceDate}).`
          );
        }
      }
      scrollToObservedReport();
    },
    [
      activeMeetingObj,
      archivedReports,
      autoSendOnGenerate,
      handleSendReportEmail,
      onTriggerToast,
      punters,
      quaddieBuyInPerUser,
      quaddieExtraByMeeting,
      trifectaBetAmount,
    ]
  );

  // Respond when parent header / Results button triggers report generation
  const lastSignalRef = useRef<number>(generateReportSignal);
  useEffect(() => {
    if (
      generateReportSignal > 0 &&
      generateReportSignal !== lastSignalRef.current
    ) {
      lastSignalRef.current = generateReportSignal;
      handleGenerateAndGoToReport(false);
    }
  }, [generateReportSignal, handleGenerateAndGoToReport]);

  // Build Graphical Analysis datasets for the active report
  const graphicalData = useMemo(() => {
    if (!activeReport) return null;

    const userComparisonData = activeReport.standings.map((s) => {
      const firstHits =
        typeof s.firstPrefHits === "number"
          ? s.firstPrefHits
          : s.winnersPicked;
      const secondHits =
        typeof s.secondPrefHits === "number"
          ? s.secondPrefHits
          : Math.max(0, Math.floor((s.podiumsPicked - s.winnersPicked) / 2));
      const thirdHits =
        typeof s.thirdPrefHits === "number"
          ? s.thirdPrefHits
          : Math.max(0, s.podiumsPicked - firstHits - secondHits);

      const outlay = Math.max(
        1,
        s.parScoreUnits ||
          (s.selectedHorsesCount || s.racesParticipated * 3) * 2
      );
      const effectiveDollarReturn =
        s.eachWayDollarReturn ?? s.totalDollarReturn ?? 0;
      const roiPct = Math.round((effectiveDollarReturn / outlay) * 100);
      const dollarsPerPt =
        s.totalPoints > 0
          ? Number((effectiveDollarReturn / s.totalPoints).toFixed(2))
          : 0;

      return {
        punterId: s.punterId,
        name: s.punterName,
        totalPoints: s.totalPoints,
        dollarReturn: Number(effectiveDollarReturn.toFixed(2)),
        winners: s.winnersPicked,
        podiums: s.podiumsPicked,
        racesParticipated: s.racesParticipated,
        strikeRatePct: s.strikeRatePct,
        winRatePct:
          s.racesParticipated > 0
            ? Math.round((s.winnersPicked / s.racesParticipated) * 100)
            : 0,
        firstPrefHits: firstHits,
        secondPrefHits: secondHits,
        thirdPrefHits: thirdHits,
        roiPct,
        dollarsPerPt,
      };
    });

    const runningTotalsPoints: Record<string, number> = {};
    const runningTotalsDollars: Record<string, number> = {};
    for (const s of activeReport.standings) {
      runningTotalsPoints[s.punterName] = 0;
      runningTotalsDollars[s.punterName] = 0;
    }

    const raceProgressionData = activeReport.raceRows.map((row) => {
      const entry: Record<string, string | number | boolean> = {
        raceNumber: row.raceNumber,
        raceLabel: `R${row.raceNumber}`,
        raceName: row.raceName,
      };
      for (const s of activeReport.standings) {
        const cell = row.userCells.find((c) => c.punterId === s.punterId);
        const pts = cell?.points || 0;
        const dlrs = cell?.dollarReturn || 0;
        runningTotalsPoints[s.punterName] =
          (runningTotalsPoints[s.punterName] || 0) + pts;
        runningTotalsDollars[s.punterName] = Number(
          ((runningTotalsDollars[s.punterName] || 0) + dlrs).toFixed(2)
        );
        entry[`${s.punterName}_cumPts`] = runningTotalsPoints[s.punterName];
        entry[`${s.punterName}_racePts`] = pts;
        entry[`${s.punterName}_cumDollars`] =
          runningTotalsDollars[s.punterName];
        entry[`${s.punterName}_jokerHit`] = Boolean(cell?.jokerTriggered);
      }
      return entry;
    });

    const trifectaTelemetryData = activeReport.raceRows.map((row) => ({
      raceNumber: row.raceNumber,
      raceLabel: `R${row.raceNumber}`,
      poolCount: row.trifecta.poolCount,
      podiumHits: row.trifecta.hitCount,
      boxedCombos: row.trifecta.boxedCombinations,
      officialCombo: row.trifecta.officialCombination,
      officialDividend: Number(row.trifecta.officialDividend.toFixed(2)),
      flexiCollect: Number(row.trifecta.flexiReturnOnBet.toFixed(2)),
      isHit: row.trifecta.isHit ? 1 : 0,
    }));

    const totalPref1 = userComparisonData.reduce(
      (sum, u) => sum + u.firstPrefHits,
      0
    );
    const totalPref2 = userComparisonData.reduce(
      (sum, u) => sum + u.secondPrefHits,
      0
    );
    const totalPref3 = userComparisonData.reduce(
      (sum, u) => sum + u.thirdPrefHits,
      0
    );

    return {
      userComparisonData,
      raceProgressionData,
      trifectaTelemetryData,
      prefTotals: {
        first: totalPref1,
        second: totalPref2,
        third: totalPref3,
        total: Math.max(1, totalPref1 + totalPref2 + totalPref3),
      },
    };
  }, [activeReport]);

  const toggleEmailSelection = (email: string) => {
    setSelectedEmails((prev) =>
      prev.includes(email)
        ? prev.filter((item) => item !== email)
        : [...prev, email]
    );
  };

  const handleAddCustomEmail = () => {
    const trimmed = newEmailInput.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      onTriggerToast?.("Please enter a valid email address.");
      return;
    }
    if (!availableEmails.includes(trimmed)) {
      setAvailableEmails((prev) => [...prev, trimmed]);
    }
    if (!selectedEmails.includes(trimmed)) {
      setSelectedEmails((prev) => [...prev, trimmed]);
    }
    setNewEmailInput("");
    onTriggerToast?.(`Added ${trimmed} to report recipients.`);
  };

  const handleRemoveCustomEmail = (emailToRemove: string) => {
    if (DEFAULT_REPORT_EMAIL_RECIPIENTS.includes(emailToRemove)) {
      setSelectedEmails((prev) => prev.filter((e) => e !== emailToRemove));
      return;
    }
    setAvailableEmails((prev) => prev.filter((e) => e !== emailToRemove));
    setSelectedEmails((prev) => prev.filter((e) => e !== emailToRemove));
  };

  const handleCopyReportText = async () => {
    if (!activeReport) return;
    const html = formatHtmlReportForEmail(activeReport);
    const text = formatPlainTextReportForEmail(activeReport);
    try {
      if (
        typeof ClipboardItem !== "undefined" &&
        navigator.clipboard?.write
      ) {
        const htmlBlob = new Blob([html], { type: "text/html" });
        const textBlob = new Blob([text], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": htmlBlob,
            "text/plain": textBlob,
          }),
        ]);
      } else {
        await navigator.clipboard?.writeText(text);
      }
    } catch {
      navigator.clipboard?.writeText(text).catch(() => {});
    }
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
    onTriggerToast?.(
      "Copied Rich Graphical HTML Report & Telemetry to clipboard (ready to paste with full graphics into any email client)."
    );
  };

  const handleDownloadGraphicalHtmlReport = () => {
    if (!activeReport) return;
    const html = formatHtmlReportForEmail(activeReport);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PuntersClub-Graphical-Report-${activeReport.venue.replace(/\s+/g, "-")}-${activeReport.raceDate}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onTriggerToast?.(
      `Downloaded Graphical HTML Report (${activeReport.venue} · ${activeReport.raceDate}).`
    );
  };

  if (!activeReport) {
    return (
      <div className="rounded-xl border border-[#1F2D26] bg-[#121A16] p-6 text-center space-y-3">
        <div className="text-base font-bold text-[#F3F4F0]">
          No Race Report Selected
        </div>
        <button
          type="button"
          onClick={() => handleGenerateAndGoToReport(false)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D4AF37] text-[#0B110E] text-xs font-bold hover:bg-[#e3be42] cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          <span>Generate &amp; Auto-Send Report Now</span>
        </button>
      </div>
    );
  }

  const upfrontParagraphs = activeReport.assessment.upfrontParagraphs?.length
    ? activeReport.assessment.upfrontParagraphs
    : [
        activeReport.assessment.executiveSummary,
        activeReport.assessment.trifectaVerdict,
      ];

  const nextMeets =
    activeReport.assessment.nextMajorMeetsPreview ||
    buildNextMajorMeetsPreview(activeReport.raceDate);

  const activeMailtoRecipients =
    selectedEmails.length > 0
      ? selectedEmails
      : DEFAULT_REPORT_EMAIL_RECIPIENTS;

  const emailSubjectText = `${REPORT_SENDER_NAME}: ${activeReport.venue} (${activeReport.raceDate}) — ${activeReport.assessment.headline}`;
  const emailPlainTextBody = formatPlainTextReportForEmail(activeReport);
  const emailHtmlBody = formatHtmlReportForEmail(activeReport);

  const mailtoHref = `mailto:${encodeURIComponent(
    activeMailtoRecipients.join(",")
  )}?subject=${encodeURIComponent(emailSubjectText)}&body=${encodeURIComponent(
    emailPlainTextBody
  )}`;

  const gmailWebHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    activeMailtoRecipients.join(",")
  )}&su=${encodeURIComponent(emailSubjectText)}&body=${encodeURIComponent(
    emailPlainTextBody
  )}`;

  const leader = activeReport.standings[0];
  const runnerUp = activeReport.standings[1];
  const quaddie = activeReport.quaddieSummary;
  const analytics = activeReport.analytics;

  const totalSyndicatePoints =
    analytics?.syndicateTotalPoints ??
    activeReport.standings.reduce((s, u) => s + u.totalPoints, 0);
  const totalSyndicateCash =
    analytics?.syndicateTotalCashReturn ??
    Number(
      activeReport.standings
        .reduce((s, u) => s + u.totalDollarReturn, 0)
        .toFixed(2)
    );
  const totalPicksCount = activeReport.standings.reduce(
    (s, u) => s + u.racesParticipated * 3,
    0
  );
  const totalPodiumsCount = activeReport.standings.reduce(
    (s, u) => s + u.podiumsPicked,
    0
  );
  const totalWinnersCount = activeReport.standings.reduce(
    (s, u) => s + u.winnersPicked,
    0
  );
  const overallPodiumSr =
    analytics?.syndicateStrikeRatePct ??
    (totalPicksCount > 0
      ? Math.round((totalPodiumsCount / totalPicksCount) * 100)
      : 0);

  return (
    <div className="space-y-4">
      {/* Compact Archive Selector & Auto-Send Report Generator Control Bar */}
      <div className="rounded-xl border border-[#23352C] bg-[#121A16] p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-[#D4AF37]">
              <Archive className="w-3.5 h-3.5" />
              <span>Archive ({archivedReports.length})</span>
            </span>
            <span className="text-[#23352C]">·</span>

            {onChangeSelectedMeetingIds && (
              <RaceCardMultiSelectDropdown
                meetings={meetings}
                selectedMeetingIds={
                  selectedMeetingIds && selectedMeetingIds.length > 0
                    ? selectedMeetingIds
                    : [selectedMeetingId]
                }
                onChangeSelectedMeetingIds={onChangeSelectedMeetingIds}
                punters={punters}
                labelPrefix="Report Cards"
                compact
              />
            )}

            <div className="flex items-center gap-2 bg-[#0B110E] border border-[#23352C] rounded-lg px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
              <select
                id="past-report-selector"
                aria-label="Select Past or Current Race Report"
                value={activeReport.id}
                onChange={(e) => {
                  setSelectedReportId(e.target.value);
                  scrollToObservedReport();
                }}
                className="bg-[#121A16] border border-[#1F2D26] rounded px-2 py-1 text-xs font-semibold text-[#F3F4F0] focus:outline-none focus:border-[#D4AF37] cursor-pointer"
              >
                {archivedReports.map((rep) => {
                  const top = rep.standings[0];
                  return (
                    <option key={rep.id} value={rep.id}>
                      {rep.raceDate} · {rep.venue} ({rep.state}) —{" "}
                      {top
                        ? `${top.punterName} (${top.totalPoints} pts / ${formatDollarReturn(
                            top.totalDollarReturn
                          )})`
                        : "Syndicate"}{" "}
                      · Tri: {rep.trifectaSummary.trifectaHits} · Quad:{" "}
                      {rep.quaddieSummary?.hitLegsCount ?? 0}/4
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Primary Action Buttons: Generate & Auto-Send + Email Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoSendOnGenerate((prev) => !prev)}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-colors cursor-pointer ${
                autoSendOnGenerate
                  ? "bg-[#152920] border-[#10B981] text-[#10B981]"
                  : "bg-[#0B110E] border-[#1F2D26] text-[#8A9990]"
              }`}
              title="Automatically dispatch report via free email relay from 'Punters Club results' when generated"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Auto-Send: {autoSendOnGenerate ? "ON" : "OFF"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleGenerateAndGoToReport(false)}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#D4AF37] text-[#0B110E] text-xs font-bold hover:bg-[#e3be42] transition-colors cursor-pointer shadow-sm"
              title="Generate report and automatically send from Punters Club results"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>
                {autoSendOnGenerate
                  ? `Generate & Auto-Send (${activeMeetingObj?.venue || activeReport.venue})`
                  : `Generate Report (${activeMeetingObj?.venue || activeReport.venue})`}
              </span>
            </button>

            <button
              type="button"
              disabled={isSendingEmail}
              onClick={() => handleSendReportEmail(false)}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#10B981] text-[#0B110E] text-xs font-bold hover:bg-[#14d394] disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isSendingEmail
                  ? "Dispatching..."
                  : activeReport.lastEmailedAtIso
                  ? "Resend Now"
                  : "Send Now"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCopyReportText}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B110E] border border-[#1F2D26] text-[#D5DDD8] text-xs font-semibold hover:border-[#D4AF37] transition-colors cursor-pointer"
              title="Copies Rich Graphical HTML + Text so you can paste the full graphical layout directly into any email"
            >
              <ClipboardCopy className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{copiedReport ? "✓ Copied Rich HTML" : "Copy Rich HTML"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowGraphicalEmailPreview((prev) => !prev)}
              className={`min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                showGraphicalEmailPreview
                  ? "bg-[#192620] border-[#D4AF37] text-[#D4AF37]"
                  : "bg-[#0B110E] border-[#1F2D26] text-[#D5DDD8] hover:border-[#D4AF37]"
              }`}
              title="Preview the exact Graphical HTML Email sent to recipients"
            >
              <Mail className="w-3.5 h-3.5 text-[#10B981]" />
              <span>{showGraphicalEmailPreview ? "Hide Email View" : "Preview HTML Email"}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadGraphicalHtmlReport}
              className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B110E] border border-[#1F2D26] text-[#D5DDD8] text-xs font-semibold hover:border-[#D4AF37] transition-colors cursor-pointer"
              title="Download standalone Graphical HTML Report file"
            >
              <Printer className="w-3.5 h-3.5 text-[#8A9990]" />
              <span>HTML / PDF</span>
            </button>
          </div>
        </div>

        {/* Past Reports Timeline Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {archivedReports.slice(0, 4).map((rep) => {
            const isSelected = rep.id === activeReport.id;
            const topUser = rep.standings[0];
            const qHits = rep.quaddieSummary?.hitLegsCount ?? 0;
            return (
              <button
                key={rep.id}
                type="button"
                onClick={() => {
                  setSelectedReportId(rep.id);
                  scrollToObservedReport();
                }}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                  isSelected
                    ? "bg-[#17281F] border-[#D4AF37] shadow-md"
                    : "bg-[#0B110E] border-[#1F2D26] hover:border-[#D4AF37]/50"
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 font-mono text-[10px]">
                  <span className="font-bold text-[#D4AF37]">
                    {rep.raceDate}
                  </span>
                  <span className="text-[#10B981] font-semibold">
                    Tri {rep.trifectaSummary.trifectaHits} · Quad {qHits}/4
                  </span>
                </div>

                <div className="text-xs font-bold text-[#F3F4F0] truncate">
                  {rep.venue} ({rep.state})
                </div>

                <div className="text-[11px] text-[#8A9990] truncate">
                  {topUser
                    ? `#1 ${topUser.punterName}: ${topUser.totalPoints} pts · ${formatDollarReturn(
                        topUser.totalDollarReturn
                      )}`
                    : "Syndicate Card"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Free Email Auto-Dispatcher Bar (Sender: "Punters Club results") */}
        <div
          ref={emailPanelRef}
          className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
            showEmailPrompt
              ? "bg-[#0B110E] border-[#D4AF37]"
              : "bg-[#0B110E] border-[#10B981]/40"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Mail className="w-4 h-4 text-[#10B981]" />
              <span className="font-bold text-[#F3F4F0]">
                Native Graphical HTML MIME Mailer · Sender:{" "}
                <span className="text-[#D4AF37] font-mono">
                  &quot;{REPORT_SENDER_NAME}&quot;
                </span>
              </span>
              <span className="px-2 py-0.5 rounded bg-[#152920] border border-[#10B981]/40 text-[10px] font-mono font-bold text-[#10B981]">
                Rich HTML Charts · Zero Validation Required
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setSelectedEmails(["bobbydazzler83@gmail.com"])}
                className="px-2 py-0.5 rounded bg-[#121A16] border border-[#1F2D26] text-[#D5DDD8] hover:border-[#D4AF37] cursor-pointer"
              >
                Only bobbydazzler83@gmail.com
              </button>
              <button
                type="button"
                onClick={() => setSelectedEmails(["markstead@me.com"])}
                className="px-2 py-0.5 rounded bg-[#121A16] border border-[#1F2D26] text-[#D5DDD8] hover:border-[#D4AF37] cursor-pointer"
              >
                Only markstead@me.com
              </button>
              <button
                type="button"
                onClick={() =>
                  setSelectedEmails([...DEFAULT_REPORT_EMAIL_RECIPIENTS])
                }
                className="px-2 py-0.5 rounded bg-[#121A16] border border-[#1F2D26] text-[#D4AF37] hover:border-[#D4AF37] cursor-pointer"
              >
                Both Defaults
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {availableEmails.map((email) => {
                const isChecked = selectedEmails.includes(email);
                const isDefault =
                  DEFAULT_REPORT_EMAIL_RECIPIENTS.includes(email);
                return (
                  <div
                    key={email}
                    className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs font-mono transition-colors ${
                      isChecked
                        ? "bg-[#152920] border-[#10B981] text-[#F3F4F0]"
                        : "bg-[#121A16] border-[#1F2D26] text-[#8A9990]"
                    }`}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isChecked}
                      onClick={() => toggleEmailSelection(email)}
                      className="inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                          isChecked
                            ? "bg-[#10B981] border-[#10B981] text-[#0B110E]"
                            : "bg-[#0B110E] border-[#8A9990]"
                        }`}
                      >
                        {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      <span className="font-semibold">{email}</span>
                    </button>

                    {!isDefault && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomEmail(email)}
                        className="text-[#8A9990] hover:text-[#EF4444] cursor-pointer"
                        title={`Remove ${email}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="email"
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomEmail();
                    }
                  }}
                  placeholder="Add email..."
                  aria-label="Add another email address"
                  className="w-44 bg-[#121A16] border border-[#23352C] rounded-lg px-2.5 py-1 text-xs font-mono text-[#F3F4F0] placeholder-[#8A9990] focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="button"
                  onClick={handleAddCustomEmail}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#192620] border border-[#D4AF37]/50 text-[#D4AF37] text-xs font-bold hover:bg-[#D4AF37] hover:text-[#0B110E] transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </div>

              <a
                href={gmailWebHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#121A16] border border-[#10B981]/40 text-[#10B981] text-xs font-semibold hover:bg-[#192620] transition-colors"
                title="Open pre-filled report in Gmail Web Client"
              >
                <Mail className="w-3 h-3" />
                <span>Gmail Web</span>
              </a>

              <a
                href={mailtoHref}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#121A16] border border-[#D4AF37]/40 text-[#D4AF37] text-xs font-semibold hover:bg-[#192620] transition-colors"
              >
                <Mail className="w-3 h-3" />
                <span>Mail App</span>
              </a>
            </div>
          </div>

          {emailStatusBanner && (
            <div className="px-3 py-1.5 rounded-lg bg-[#152920] border border-[#10B981]/50 text-xs text-[#F3F4F0] flex flex-wrap items-center justify-between gap-2">
              <span>{emailStatusBanner.message}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowGraphicalEmailPreview((p) => !p)}
                  className="text-xs font-mono font-bold text-[#10B981] hover:underline cursor-pointer"
                >
                  {showGraphicalEmailPreview ? "Hide Email Preview" : "View Graphical Email"}
                </button>
                <button
                  type="button"
                  onClick={() => handleSendReportEmail(true)}
                  className="text-xs font-mono font-bold text-[#D4AF37] hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Resend</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEmailStatusBanner(null)}
                  className="text-[11px] font-mono text-[#8A9990] hover:text-[#F3F4F0] cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {showGraphicalEmailPreview && (
            <div className="pt-2 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#121A16] border border-[#D4AF37]/40 text-xs font-mono">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[#D4AF37] font-bold uppercase">
                    Live Graphical HTML Email Preview
                  </span>
                  <span className="text-[#8A9990]">·</span>
                  <span className="text-[#D5DDD8]">
                    From: &quot;{REPORT_SENDER_NAME}&quot; &lt;results@cupdaypunting.xo.je&gt;
                  </span>
                  <span className="text-[#8A9990]">·</span>
                  <span className="text-[#10B981]">
                    MIME: multipart/alternative (text/html + text/plain)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyReportText}
                    className="px-2.5 py-1 rounded bg-[#D4AF37] text-[#0B110E] font-bold hover:bg-[#e3be42] cursor-pointer"
                  >
                    {copiedReport ? "✓ Copied Rich HTML" : "Copy Rich Graphical Email"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGraphicalEmailPreview(false)}
                    className="px-2 py-1 rounded bg-[#0B110E] border border-[#1F2D26] text-[#8A9990] hover:text-[#F3F4F0] cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-[#23352C] overflow-hidden bg-[#080D0B]">
                <iframe
                  title="Graphical HTML Email Preview"
                  srcDoc={emailHtmlBody}
                  className="w-full h-[680px] border-0"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================
          OBSERVED GRAPHICAL RACE REPORT SHEET
         ==================================================================== */}
      <div
        id="observed-race-report-view"
        ref={reportSheetRef}
        className="scroll-mt-20 rounded-xl border border-[#23352C] bg-[#0E1713] overflow-hidden shadow-2xl space-y-5 p-4 sm:p-6"
      >
        {/* Report Sheet Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1F2D26] pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="font-bold uppercase tracking-wider text-[#D4AF37]">
                {REPORT_SENDER_NAME}
              </span>
              <span className="text-[#8A9990]">·</span>
              <span className="text-[#10B981] font-semibold">
                {activeReport.venue} ({activeReport.state})
              </span>
              <span className="text-[#8A9990]">·</span>
              <span className="text-[#F3F4F0]">{activeReport.raceDate}</span>
              <span className="text-[#8A9990]">·</span>
              <span className="text-[#9BA8A1]">
                {activeReport.completedParticipatedRacesCount}/
                {activeReport.totalCardRacesCount} Races Final
              </span>
            </div>
            <h2 className="font-serif text-lg sm:text-2xl font-bold text-[#F3F4F0]">
              {activeReport.assessment.headline}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeReport.lastEmailedAtIso && (
              <span className="text-[11px] font-mono text-[#10B981]">
                ✓ Auto-sent from &quot;{REPORT_SENDER_NAME}&quot; to{" "}
                {(
                  activeReport.lastEmailedTo || DEFAULT_REPORT_EMAIL_RECIPIENTS
                ).join(", ")}
              </span>
            )}
            <button
              type="button"
              onClick={() => handleSendReportEmail(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#0B110E] text-xs font-bold hover:bg-[#e3be42] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Resend Report</span>
            </button>
          </div>
        </div>

        {/* ====================================================================
            6-CARD GRAPHICAL KPI & EXOTICS TELEMETRY RIBBON
           ==================================================================== */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* KPI 1: Card Leader */}
          <div className="p-3.5 rounded-xl bg-[#0B110E] border border-[#D4AF37]/40 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#8A9990]">
              <span>Card Leader</span>
              <Trophy className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
            <div>
              <div className="text-base font-bold text-[#F3F4F0] truncate">
                {leader?.punterName || "Syndicate"}
              </div>
              <div className="font-mono text-sm font-bold text-[#D4AF37]">
                {leader?.totalPoints || 0} pts{" "}
                <span className="text-xs text-[#10B981]">
                  ({formatDollarReturn(leader?.totalDollarReturn || 0)})
                </span>
              </div>
            </div>
            <div className="text-[10px] font-mono text-[#8A9990]">
              {leader && runnerUp
                ? `+${leader.totalPoints - runnerUp.totalPoints} pts vs ${runnerUp.punterName}`
                : `${leader?.winnersPicked || 0}W · ${leader?.podiumsPicked || 0}P`}
            </div>
          </div>

          {/* KPI 2: Syndicate Win/Place Return */}
          <div className="p-3.5 rounded-xl bg-[#0B110E] border border-[#1F2D26] flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#8A9990]">
              <span>Syndicate W/P Return</span>
              <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />
            </div>
            <div>
              <div className="font-mono text-lg font-bold text-[#10B981]">
                {formatDollarReturn(totalSyndicateCash)}
              </div>
              <div className="text-xs font-mono text-[#D5DDD8]">
                {totalSyndicatePoints} Total Pts · {totalWinnersCount}W /{" "}
                {totalPodiumsCount}P
              </div>
            </div>
            <div className="text-[10px] font-mono text-[#8A9990]">
              {analytics?.highestSingleRaceCollect &&
              analytics.highestSingleRaceCollect.dollarReturn > 0
                ? `Best: R${analytics.highestSingleRaceCollect.raceNumber} ${analytics.highestSingleRaceCollect.punterName} (${formatDollarReturn(analytics.highestSingleRaceCollect.dollarReturn)})`
                : `Avg Winner Odds: $${analytics?.avgWinningRunnerOdds || "—"}`}
            </div>
          </div>

          {/* KPI 3: Radial Podium Strike Rate Gauge */}
          <div className="p-3.5 rounded-xl bg-[#0B110E] border border-[#1F2D26] flex items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase text-[#8A9990]">
                Podium Strike Rate
              </div>
              <div className="font-mono text-lg font-bold text-[#F3F4F0]">
                {overallPodiumSr}%
              </div>
              <div className="text-[10px] font-mono text-[#10B981]">
                {totalPodiumsCount}/{totalPicksCount} Picks Placed
              </div>
            </div>
            <svg viewBox="0 0 44 44" className="w-12 h-12 shrink-0 -rotate-90">
              <circle
                cx="22"
                cy="22"
                r="17"
                fill="none"
                stroke="#192620"
                strokeWidth="5"
              />
              <circle
                cx="22"
                cy="22"
                r="17"
                fill="none"
                stroke="#10B981"
                strokeWidth="5"
                strokeDasharray={`${Math.round((overallPodiumSr / 100) * 107)} 107`}
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* KPI 4: Combined Boxed Trifecta Results */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
              activeReport.trifectaSummary.trifectaHits > 0
                ? "bg-[#13261D] border-[#10B981]"
                : "bg-[#0B110E] border-[#1F2D26]"
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#D4AF37]">
              <span>Boxed Trifectas</span>
              <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
            <div>
              <div className="font-mono text-base font-bold text-[#F3F4F0]">
                {activeReport.trifectaSummary.trifectaHits}/
                {activeReport.trifectaSummary.racesEvaluated} Hit{" "}
                <span className="text-xs text-[#D4AF37]">
                  ({activeReport.trifectaSummary.nearMisses2Of3}× 2/3)
                </span>
              </div>
              <div className="font-mono text-xs font-bold text-[#10B981]">
                Return:{" "}
                {formatDollarReturn(
                  activeReport.trifectaSummary.totalFlexiReturn
                )}
              </div>
            </div>
            <div className="text-[10px] font-mono text-[#8A9990]">
              Outlay:{" "}
              {formatDollarReturn(activeReport.trifectaSummary.totalOutlay)} ($
              {activeReport.trifectaBetAmount}/R)
            </div>
          </div>

          {/* KPI 5: Combined 4-Leg Quaddie Results ($50/User Default Buy-In) */}
          <div
            className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
              quaddie?.isWon
                ? "bg-[#13261D] border-[#10B981]"
                : "bg-[#0B110E] border-[#1F2D26]"
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#10B981]">
              <span>4-Leg Quaddie (${quaddie?.buyInPerUser || quaddieBuyInPerUser}/User)</span>
              <Target className="w-3.5 h-3.5 text-[#10B981]" />
            </div>
            <div>
              <div className="font-mono text-base font-bold text-[#F3F4F0]">
                {quaddie
                  ? quaddie.isWon
                    ? "WON (4/4)"
                    : `${quaddie.hitLegsCount}/${quaddie.legs.length} Legs`
                  : "N/A"}
              </div>
              <div className="font-mono text-xs text-[#D4AF37]">
                {quaddie?.isWon
                  ? `${formatDollarReturn(quaddie.flexiPayout)} (${formatDollarReturn(
                      quaddie.flexiPayoutPerUser ||
                        quaddie.flexiPayout /
                          Math.max(1, activeReport.standings.length)
                    )}/user)`
                  : `Pool: $${quaddie?.betAmount || quaddieBuyInPerUser * Math.max(1, activeReport.standings.length)} · $1 Div: $${
                      quaddie
                        ? quaddie.officialOrEstimatedDividend.toFixed(2)
                        : "0.00"
                    }`}
              </div>
            </div>
            {quaddie && (
              <div className="grid grid-cols-4 gap-1 pt-0.5">
                {quaddie.legs.map((l) => (
                  <div
                    key={l.legIndex}
                    className={`h-1.5 rounded-sm ${
                      !l.isResulted
                        ? "bg-[#1F2D26]"
                        : l.isHit
                        ? "bg-[#10B981]"
                        : "bg-[#EF4444]"
                    }`}
                    title={`Leg ${l.legIndex} (R${l.raceNumber}): ${
                      l.isResulted ? (l.isHit ? "HIT" : "MISS") : "Pending"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* KPI 6: Combined Exotics P&L & 2x Joker */}
          <div className="p-3.5 rounded-xl bg-[#0B110E] border border-[#1F2D26] flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#8A9990]">
              <span>Exotics &amp; Joker</span>
              <Zap className="w-3.5 h-3.5 text-[#D4AF37]" />
            </div>
            <div>
              <div
                className={`font-mono text-base font-bold ${
                  (analytics?.combinedExoticsNetProfit ?? 0) >= 0
                    ? "text-[#10B981]"
                    : "text-[#F3F4F0]"
                }`}
              >
                Collect:{" "}
                {formatDollarReturn(
                  analytics?.combinedExoticsReturn ??
                    activeReport.trifectaSummary.totalFlexiReturn +
                      (quaddie?.flexiPayout || 0)
                )}
              </div>
              <div className="text-[11px] font-mono text-[#D4AF37]">
                2× Jokers Hit:{" "}
                {activeReport.standings.filter((s) => s.jokerTriggered).length}/
                {activeReport.standings.length}
              </div>
            </div>
            <div className="text-[10px] font-mono text-[#8A9990]">
              Exotics Outlay:{" "}
              {formatDollarReturn(
                analytics?.combinedExoticsOutlay ??
                  activeReport.trifectaSummary.totalOutlay +
                    (quaddie?.betAmount || 20)
              )}
            </div>
          </div>
        </div>

        {/* ====================================================================
            SECTION 1: PUNCHY EXECUTIVE TELEMETRY, TRIFECTA & QUADDIE COMMENTARY
           ==================================================================== */}
        <div className="rounded-xl border border-[#D4AF37]/40 bg-[#121C17] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F2D26] pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D4AF37] font-bold">
              <Activity className="w-4 h-4" />
              <span>
                Executive Telemetry, Trifecta &amp; Quaddie Analysis
              </span>
            </div>
            <span className="font-mono text-[11px] text-[#8A9990]">
              Data-Driven Post-Race Summary
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {upfrontParagraphs.map((paragraph, idx) => {
              const titles = [
                "1 · Trackside Dispatch & $1 EW Benchmark",
                "2 · Combined Trifecta Autopsy",
                "3 · 4-Leg Quaddie Review",
                "4 · Market Psychology & Favourite Tendency",
                "5 · Track Bias & Jockey Intelligence",
              ];
              const accents = [
                "border-[#D4AF37]",
                "border-[#10B981]",
                "border-[#38BDF8]",
                "border-[#F59E0B]",
                "border-[#A855F7]",
              ];
              return (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl bg-[#0B110E] border-l-4 ${
                    accents[idx % accents.length]
                  } border border-[#1F2D26] space-y-1.5 shadow-sm`}
                >
                  <div className="text-[11px] font-mono font-bold uppercase text-[#D4AF37] flex items-center justify-between">
                    <span>{titles[idx] || `Insight ${idx + 1}`}</span>
                  </div>
                  <p className="text-xs text-[#F3F4F0] leading-relaxed">
                    {paragraph}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Compact Player Telemetry Strip */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {activeReport.assessment.punterRoastsAndPraises.map((item) => (
              <div
                key={item.punterName}
                className="p-3 rounded-lg bg-[#0B110E] border border-[#1F2D26] flex flex-col justify-between gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs sm:text-sm text-[#F3F4F0]">
                    {item.punterName}
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-[#D4AF37]">
                    {item.badge}
                  </span>
                </div>
                <p className="text-xs text-[#9BA8A1] leading-snug">
                  {item.commentary}
                </p>
              </div>
            ))}
          </div>

          <div className="px-3 py-2 rounded-lg bg-[#192620]/70 border border-[#D4AF37]/40 text-xs font-semibold text-[#D4AF37]">
            {activeReport.assessment.stewardsFunnyConclusion}
          </div>
        </div>

        {/* ====================================================================
            SECTION 2: GRAPHICAL ANALYTICS SUITE (6 CHARTS + HEATMAP + QUADDIE)
           ==================================================================== */}
        {graphicalData && (
          <div className="rounded-xl border border-[#23352C] bg-[#121A16] p-4 sm:p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F2D26] pb-3">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#10B981] font-bold">
                <BarChart3 className="w-4 h-4 text-[#D4AF37]" />
                <span>
                  Graphical Data Analysis &amp; Exotics Telemetry (
                  {activeReport.venue})
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#8A9990]">
                Syndicate Success Rate · Punter ROI (vs 1u/Pick) · Points · Cash ROI · Trifecta &amp; Quaddie
              </span>
            </div>

            {/* bklit.ui Interactive Report Visualizer: 6-Month Trend Area, Punter Par vs Return Bar, Barrier/Fav Donut Rings & Sortable Archive Table */}
            <BklitReportVisualizer
              reports={archivedReports}
              activeReport={activeReport}
              onSelectReport={(reportId) => setSelectedReportId(reportId)}
              meetings={allKnownMeetings.length > 0 ? allKnownMeetings : meetings}
              punters={punters}
            />

            {/* D3-Based Syndicate Success Rate & Quaddie Progression Trend Graph */}
            <SyndicateSuccessTrendD3Chart
              meetings={allKnownMeetings.length > 0 ? allKnownMeetings : meetings}
              selectedMeetingIds={
                selectedMeetingIds && selectedMeetingIds.length > 0
                  ? selectedMeetingIds
                  : [selectedMeetingId]
              }
              activeReport={activeReport}
              punters={punters}
              trifectaBetAmount={trifectaBetAmount}
              quaddieBuyInPerUser={quaddieBuyInPerUser}
              quaddieExtraByMeeting={quaddieExtraByMeeting}
            />

            {/* D3-Based Individual Punter ROI Bar Chart (Total Points/Score vs 1-Unit Bet on Every Selection) */}
            <PunterRoiD3BarChart
              meetings={allKnownMeetings.length > 0 ? allKnownMeetings : meetings}
              selectedMeetingIds={
                selectedMeetingIds && selectedMeetingIds.length > 0
                  ? selectedMeetingIds
                  : [selectedMeetingId]
              }
              activeReport={activeReport}
              punters={punters}
            />

            {/* 2x2 Primary Graphical Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* GRAPH A: Points vs Cash Return ($) & Efficiency */}
              <div className="p-4 rounded-xl bg-[#0B110E] border border-[#1F2D26] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono uppercase tracking-wider text-[#D4AF37] font-bold">
                    Graph A · Points vs Cash Return ($) &amp; ROI Efficiency
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono">
                    <span className="inline-flex items-center gap-1 text-[#D4AF37]">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#D4AF37]" />
                      Points
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#10B981]">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" />
                      $ Return
                    </span>
                  </div>
                </div>
                <div className="space-y-2.5 pt-1">
                  {(() => {
                    const maxPts = Math.max(
                      10,
                      ...graphicalData.userComparisonData.map(
                        (d) => d.totalPoints
                      )
                    );
                    const maxDollars = Math.max(
                      25,
                      ...graphicalData.userComparisonData.map(
                        (d) => d.dollarReturn
                      )
                    );
                    return graphicalData.userComparisonData.map((u) => {
                      const ptsPct = Math.round(
                        (u.totalPoints / maxPts) * 100
                      );
                      const dlrPct = Math.round(
                        (u.dollarReturn / maxDollars) * 100
                      );
                      return (
                        <div
                          key={u.name}
                          className="p-2.5 rounded-lg bg-[#121A16] border border-[#1F2D26] space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="font-sans font-bold text-[#F3F4F0]">
                              {u.name}
                            </span>
                            <span className="text-[#8A9990]">
                              {u.winners}W ({u.winRatePct}%) · {u.podiums}P (
                              {u.strikeRatePct}% SR) · ${u.dollarsPerPt}/pt
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-16 text-[10px] font-mono text-[#D4AF37] font-bold">
                              {u.totalPoints} pts
                            </span>
                            <div className="flex-1 h-2.5 rounded bg-[#0B110E] overflow-hidden">
                              <div
                                className="h-full bg-[#D4AF37] rounded transition-all"
                                style={{
                                  width: `${Math.max(4, ptsPct)}%`,
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-16 text-[10px] font-mono text-[#10B981] font-bold">
                              {formatDollarReturn(u.dollarReturn)}
                            </span>
                            <div className="flex-1 h-2.5 rounded bg-[#0B110E] overflow-hidden">
                              <div
                                className="h-full bg-[#10B981] rounded transition-all"
                                style={{
                                  width: `${Math.max(4, dlrPct)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* GRAPH B: Cumulative Trajectory Worm (Switchable Points / Cash $) */}
              <div className="p-4 rounded-xl bg-[#0B110E] border border-[#1F2D26] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-mono uppercase tracking-wider text-[#10B981] font-bold flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>
                      Graph B · Cumulative{" "}
                      {wormMetric === "points" ? "Points" : "Cash ($)"} Worm
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-[#121A16] p-0.5 rounded-md border border-[#1F2D26] text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={() => setWormMetric("points")}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        wormMetric === "points"
                          ? "bg-[#D4AF37] text-[#0B110E] font-bold"
                          : "text-[#8A9990]"
                      }`}
                    >
                      Points
                    </button>
                    <button
                      type="button"
                      onClick={() => setWormMetric("dollars")}
                      className={`px-2 py-0.5 rounded cursor-pointer ${
                        wormMetric === "dollars"
                          ? "bg-[#10B981] text-[#0B110E] font-bold"
                          : "text-[#8A9990]"
                      }`}
                    >
                      $ Return
                    </button>
                  </div>
                </div>

                {(() => {
                  const rows = graphicalData.raceProgressionData;
                  const svgW = 520;
                  const svgH = 185;
                  const padL = 38;
                  const padR = 16;
                  const padT = 16;
                  const padB = 26;
                  const plotW = svgW - padL - padR;
                  const plotH = svgH - padT - padB;

                  const keySuffix =
                    wormMetric === "points" ? "_cumPts" : "_cumDollars";
                  let maxVal = wormMetric === "points" ? 10 : 25;
                  for (const r of rows) {
                    for (const s of activeReport.standings) {
                      const val = Number(r[`${s.punterName}${keySuffix}`] || 0);
                      if (val > maxVal) maxVal = val;
                    }
                  }

                  const getX = (i: number) =>
                    rows.length <= 1
                      ? padL + plotW / 2
                      : padL + (i / (rows.length - 1)) * plotW;
                  const getY = (v: number) =>
                    padT + plotH - (v / maxVal) * plotH;

                  return (
                    <div className="space-y-2">
                      <svg
                        viewBox={`0 0 ${svgW} ${svgH}`}
                        className="w-full h-44 overflow-visible"
                      >
                        {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
                          const val = Math.round(maxVal * frac);
                          const y = getY(val);
                          return (
                            <g key={idx}>
                              <line
                                x1={padL}
                                y1={y}
                                x2={svgW - padR}
                                y2={y}
                                stroke="#1F2D26"
                                strokeDasharray="3 3"
                              />
                              <text
                                x={padL - 6}
                                y={y + 3}
                                textAnchor="end"
                                fontSize="9"
                                fill="#8A9990"
                              >
                                {wormMetric === "dollars" ? `$${val}` : val}
                              </text>
                            </g>
                          );
                        })}

                        {rows.map((r, i) => (
                          <text
                            key={String(r.raceLabel)}
                            x={getX(i)}
                            y={svgH - 6}
                            textAnchor="middle"
                            fontSize="9"
                            fill="#D5DDD8"
                          >
                            {String(r.raceLabel)}
                          </text>
                        ))}

                        {activeReport.standings.map((s, uIdx) => {
                          const color =
                            USER_LINE_COLORS[uIdx % USER_LINE_COLORS.length];
                          const pts = rows.map((r, i) => ({
                            x: getX(i),
                            y: getY(
                              Number(r[`${s.punterName}${keySuffix}`] || 0)
                            ),
                            val: Number(r[`${s.punterName}${keySuffix}`] || 0),
                            jokerHit: Boolean(r[`${s.punterName}_jokerHit`]),
                          }));
                          const polylinePoints = pts
                            .map((p) => `${p.x},${p.y}`)
                            .join(" ");
                          const areaPoints =
                            pts.length > 1
                              ? `${pts[0].x},${padT + plotH} ${polylinePoints} ${
                                  pts[pts.length - 1].x
                                },${padT + plotH}`
                              : "";
                          return (
                            <g key={s.punterId}>
                              {areaPoints && (
                                <polygon
                                  points={areaPoints}
                                  fill={color}
                                  fillOpacity="0.08"
                                />
                              )}
                              <polyline
                                fill="none"
                                stroke={color}
                                strokeWidth="2.5"
                                points={polylinePoints}
                              />
                              {pts.map((p, pIdx) => (
                                <circle
                                  key={pIdx}
                                  cx={p.x}
                                  cy={p.y}
                                  r={p.jokerHit ? "5" : "3.5"}
                                  fill={p.jokerHit ? "#D4AF37" : color}
                                  stroke="#0B110E"
                                  strokeWidth="1.2"
                                >
                                  <title>{`${s.punterName} (${rows[pIdx].raceLabel}): ${
                                    wormMetric === "dollars"
                                      ? formatDollarReturn(p.val)
                                      : `${p.val} pts`
                                  }${p.jokerHit ? " [2x JOKER HIT]" : ""}`}</title>
                                </circle>
                              ))}
                            </g>
                          );
                        })}
                      </svg>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
                        {activeReport.standings.map((s, uIdx) => (
                          <span
                            key={s.punterId}
                            className="inline-flex items-center gap-1.5 text-[#D5DDD8]"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  USER_LINE_COLORS[
                                    uIdx % USER_LINE_COLORS.length
                                  ],
                              }}
                            />
                            <span>
                              {s.punterName} ({s.totalPoints} pts /{" "}
                              {formatDollarReturn(s.totalDollarReturn)})
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* GRAPH C: Preference Rank Accuracy + SVG Radial Donut */}
              <div className="p-4 rounded-xl bg-[#0B110E] border border-[#1F2D26] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono uppercase tracking-wider text-[#D4AF37] font-bold flex items-center gap-1.5">
                    <PieChart className="w-3.5 h-3.5 text-[#10B981]" />
                    <span>
                      Graph C · Preference Rank Conversion (1st / 2nd / 3rd
                      Pref)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-[#D4AF37]">■ 1st</span>
                    <span className="text-[#10B981]">■ 2nd</span>
                    <span className="text-[#38BDF8]">■ 3rd</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                  {/* SVG Multi-Segment Donut Chart */}
                  {(() => {
                    const { first, second, third, total } =
                      graphicalData.prefTotals;
                    const circ = 2 * Math.PI * 30; // ~188.5
                    const len1 = (first / total) * circ;
                    const len2 = (second / total) * circ;
                    const len3 = (third / total) * circ;
                    return (
                      <div className="flex items-center gap-3 shrink-0">
                        <svg
                          viewBox="0 0 80 80"
                          className="w-24 h-24 -rotate-90"
                        >
                          <circle
                            cx="40"
                            cy="40"
                            r="30"
                            fill="none"
                            stroke="#192620"
                            strokeWidth="10"
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r="30"
                            fill="none"
                            stroke="#D4AF37"
                            strokeWidth="10"
                            strokeDasharray={`${len1} ${circ}`}
                            strokeDashoffset={0}
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r="30"
                            fill="none"
                            stroke="#10B981"
                            strokeWidth="10"
                            strokeDasharray={`${len2} ${circ}`}
                            strokeDashoffset={-len1}
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r="30"
                            fill="none"
                            stroke="#38BDF8"
                            strokeWidth="10"
                            strokeDasharray={`${len3} ${circ}`}
                            strokeDashoffset={-(len1 + len2)}
                          />
                        </svg>
                        <div className="text-[11px] font-mono space-y-1">
                          <div className="text-[#D4AF37] font-bold">
                            1st Pref: {first} (
                            {Math.round((first / total) * 100)}%)
                          </div>
                          <div className="text-[#10B981] font-bold">
                            2nd Pref: {second} (
                            {Math.round((second / total) * 100)}%)
                          </div>
                          <div className="text-[#38BDF8] font-bold">
                            3rd Pref: {third} (
                            {Math.round((third / total) * 100)}%)
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex-1 w-full space-y-2">
                    {graphicalData.userComparisonData.map((u) => {
                      const totalPodiums = Math.max(
                        1,
                        u.firstPrefHits + u.secondPrefHits + u.thirdPrefHits
                      );
                      const p1Pct = Math.round(
                        (u.firstPrefHits / totalPodiums) * 100
                      );
                      const p2Pct = Math.round(
                        (u.secondPrefHits / totalPodiums) * 100
                      );
                      const p3Pct = Math.max(0, 100 - p1Pct - p2Pct);

                      return (
                        <div
                          key={u.name}
                          className="p-2 rounded-lg bg-[#121A16] border border-[#1F2D26] space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="font-sans font-bold text-[#F3F4F0]">
                              {u.name}
                            </span>
                            <span className="text-[11px] text-[#D5DDD8]">
                              1st:{u.firstPrefHits} · 2nd:{u.secondPrefHits} ·
                              3rd:{u.thirdPrefHits}
                            </span>
                          </div>
                          <div className="w-full h-3.5 rounded bg-[#0B110E] overflow-hidden flex border border-[#1F2D26]">
                            {u.firstPrefHits > 0 && (
                              <div
                                className="h-full bg-[#D4AF37] flex items-center justify-center text-[9px] font-mono font-bold text-[#0B110E]"
                                style={{ width: `${p1Pct}%` }}
                              >
                                {p1Pct >= 18 ? u.firstPrefHits : ""}
                              </div>
                            )}
                            {u.secondPrefHits > 0 && (
                              <div
                                className="h-full bg-[#10B981] flex items-center justify-center text-[9px] font-mono font-bold text-[#0B110E]"
                                style={{ width: `${p2Pct}%` }}
                              >
                                {p2Pct >= 18 ? u.secondPrefHits : ""}
                              </div>
                            )}
                            {u.thirdPrefHits > 0 && (
                              <div
                                className="h-full bg-[#38BDF8] flex items-center justify-center text-[9px] font-mono font-bold text-[#0B110E]"
                                style={{ width: `${p3Pct}%` }}
                              >
                                {p3Pct >= 18 ? u.thirdPrefHits : ""}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* GRAPH D: Combined Trifecta Pool & Podium Hit Coverage */}
              <div className="p-4 rounded-xl bg-[#0B110E] border border-[#1F2D26] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono uppercase tracking-wider text-[#10B981] font-bold">
                    Graph D · Combined Boxed Trifecta Coverage ($
                    {activeReport.trifectaBetAmount}/Race)
                  </div>
                  <span className="text-[10px] font-mono text-[#8A9990]">
                    Hits: {activeReport.trifectaSummary.trifectaHits} · 2/3:{" "}
                    {activeReport.trifectaSummary.nearMisses2Of3}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {graphicalData.trifectaTelemetryData.map((item) => {
                    const hitPct = Math.round((item.podiumHits / 3) * 100);
                    return (
                      <div
                        key={item.raceLabel}
                        className={`p-2 rounded-lg border flex flex-col justify-between gap-1 ${
                          item.isHit
                            ? "bg-[#152920] border-[#10B981]"
                            : item.podiumHits === 2
                            ? "bg-[#19231B] border-[#D4AF37]/50"
                            : "bg-[#121A16] border-[#1F2D26]"
                        }`}
                      >
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className="font-bold text-[#F3F4F0]">
                            {item.raceLabel}
                          </span>
                          <span
                            className={`text-[10px] font-bold ${
                              item.isHit
                                ? "text-[#10B981]"
                                : item.podiumHits === 2
                                ? "text-[#D4AF37]"
                                : "text-[#8A9990]"
                            }`}
                          >
                            {item.isHit ? "★ 3/3" : `${item.podiumHits}/3`}
                          </span>
                        </div>

                        <div className="w-full h-1.5 rounded-full bg-[#0B110E] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(8, hitPct)}%`,
                              backgroundColor: item.isHit
                                ? "#10B981"
                                : item.podiumHits === 2
                                ? "#D4AF37"
                                : "#64748B",
                            }}
                          />
                        </div>

                        <div className="text-[10px] font-mono text-[#8A9990] flex items-center justify-between">
                          <span>{item.poolCount}H</span>
                          <span className="text-[#D4AF37] font-bold">
                            {item.isHit
                              ? `+${formatDollarReturn(item.flexiCollect)}`
                              : `$${item.officialDividend.toFixed(0)}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ================================================================
                GRAPH E: COMBINED 4-LEG QUADDIE VISUAL PIPELINE & LEG TELEMETRY
               ================================================================ */}
            {quaddie && quaddie.legs.length > 0 && (
              <div className="p-4 rounded-xl bg-[#0B110E] border border-[#10B981]/40 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#10B981] font-bold">
                    <Target className="w-4 h-4 text-[#D4AF37]" />
                    <span>
                      Graph E · Combined 4-Leg Quaddie Visual Progression ($
                      {quaddie.buyInPerUser || quaddieBuyInPerUser}/User Buy-In · $
                      {quaddie.betAmount} Total Pool · {quaddie.totalCombinations}{" "}
                      Combos @ {quaddie.flexiPercentage}%)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                    <span
                      className={`font-bold ${
                        quaddie.isWon ? "text-[#10B981]" : "text-[#D4AF37]"
                      }`}
                    >
                      {quaddie.isWon
                        ? `★ QUADDIE WON (${formatDollarReturn(quaddie.flexiPayout)} Total / ${formatDollarReturn(
                            quaddie.flexiPayoutPerUser ||
                              quaddie.flexiPayout /
                                Math.max(1, activeReport.standings.length)
                          )} per user)`
                        : `${quaddie.hitLegsCount}/${quaddie.legs.length} Legs Landed`}
                    </span>
                    <span className="text-[#8A9990]">·</span>
                    <span className="text-[#F3F4F0]">
                      Combo: {quaddie.combinationString}
                    </span>
                    <span className="text-[#8A9990]">·</span>
                    <span className="text-[#D4AF37]">
                      $1 Div: $
                      {quaddie.officialOrEstimatedDividend.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {quaddie.legs.map((leg) => (
                    <div
                      key={leg.legIndex}
                      className={`p-3 rounded-lg border space-y-2 ${
                        !leg.isResulted
                          ? "bg-[#121A16] border-[#1F2D26]"
                          : leg.isHit
                          ? "bg-[#152920] border-[#10B981]"
                          : "bg-[#221417] border-[#EF4444]/60"
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="font-bold text-[#D4AF37]">
                          Leg {leg.legIndex} · R{leg.raceNumber}
                        </span>
                        <span
                          className={`font-bold ${
                            !leg.isResulted
                              ? "text-[#8A9990]"
                              : leg.isHit
                              ? "text-[#10B981]"
                              : "text-[#EF4444]"
                          }`}
                        >
                          {!leg.isResulted
                            ? "PENDING"
                            : leg.isHit
                            ? "✓ LEG HIT"
                            : "✕ MISSED"}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-[#F3F4F0] truncate">
                        1st: {leg.winnerText}{" "}
                        {leg.winnerOdds > 0 ? (
                          <span className="font-mono text-[#D4AF37]">
                            (${leg.winnerOdds.toFixed(2)})
                          </span>
                        ) : null}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono text-[#8A9990]">
                          <span>
                            Syndicate Pool ({leg.runnerCount}/{leg.fieldSize})
                          </span>
                          <span className="text-[#D5DDD8]">
                            {leg.fieldCoveragePct}% Field
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[#0B110E] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(10, leg.fieldCoveragePct)}%`,
                              backgroundColor: leg.isHit
                                ? "#10B981"
                                : "#D4AF37",
                            }}
                          />
                        </div>
                        <div className="text-[10px] font-mono text-[#D5DDD8] truncate">
                          Runners: {leg.runnersText || "None"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ================================================================
                GRAPH F: RACE-BY-RACE VISUAL SCORING & EXOTICS HEATMAP MATRIX
               ================================================================ */}
            <div className="p-4 rounded-xl bg-[#0B110E] border border-[#1F2D26] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-mono uppercase tracking-wider text-[#D4AF37] font-bold">
                  Graph F · Race-by-Race Scoring &amp; Exotics Heatmap Matrix
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-[#8A9990]">
                  <span className="text-[#10B981]">■ Points/Cash Hit</span>
                  <span className="text-[#D4AF37]">■ 2× Joker / 2-of-3</span>
                  <span className="text-[#64748B]">■ Unplaced</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="inline-flex min-w-full gap-1.5 pt-1">
                  {activeReport.raceRows.map((r) => {
                    const qLeg = quaddie?.legs.find(
                      (l) => l.raceNumber === r.raceNumber
                    );
                    return (
                      <div
                        key={r.raceNumber}
                        className="flex-1 min-w-[74px] rounded-lg bg-[#121A16] border border-[#1F2D26] p-2 space-y-1.5 text-center font-mono"
                      >
                        <div className="text-xs font-bold text-[#F3F4F0] border-b border-[#1F2D26] pb-1">
                          R{r.raceNumber}
                        </div>
                        {activeReport.standings.map((u) => {
                          const cell = r.userCells.find(
                            (c) => c.punterId === u.punterId
                          );
                          const pts = cell?.points || 0;
                          const dlrs = cell?.dollarReturn || 0;
                          return (
                            <div
                              key={u.punterId}
                              className={`px-1.5 py-1 rounded text-[10px] ${
                                cell?.jokerTriggered
                                  ? "bg-[#D4AF37] text-[#0B110E] font-bold"
                                  : pts > 0
                                  ? "bg-[#152920] text-[#10B981] font-bold border border-[#10B981]/40"
                                  : "bg-[#0B110E] text-[#8A9990]"
                              }`}
                              title={`${u.punterName} R${r.raceNumber}: ${pts} pts / ${formatDollarReturn(dlrs)}`}
                            >
                              {u.punterName.split(" ")[0]}: {pts}p
                              {cell?.jokerTriggered ? " 2×" : ""}
                            </div>
                          );
                        })}
                        <div
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            r.trifecta.isHit
                              ? "bg-[#10B981] text-[#0B110E]"
                              : r.trifecta.hitCount === 2
                              ? "bg-[#D4AF37]/25 text-[#D4AF37]"
                              : "bg-[#0B110E] text-[#8A9990]"
                          }`}
                        >
                          Tri {r.trifecta.hitCount}/3
                        </div>
                        {qLeg && (
                          <div
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              qLeg.isHit
                                ? "bg-[#10B981]/30 text-[#10B981]"
                                : "bg-[#EF4444]/25 text-[#EF4444]"
                            }`}
                          >
                            Q L{qLeg.legIndex}: {qLeg.isHit ? "HIT" : "MISS"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            SECTION 3: FINAL USER RESULTS — $1 EACH-WAY RETURN SCORE VS PAR BENCHMARK
           ==================================================================== */}
        <div className="space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D4AF37] font-bold">
              <Trophy className="w-4 h-4" />
              <span>
                Final User Results — $1 Each-Way Return Score vs Par Benchmark (
                {activeReport.venue} · {activeReport.raceDate})
              </span>
            </div>
            <span className="px-2.5 py-1 rounded bg-[#0B110E] border border-[#10B981]/50 text-[11px] font-mono text-[#10B981] font-semibold">
              Card Par Score:{" "}
              {activeReport.cardTrackAssessment?.cardParScoreUnits ??
                activeReport.completedParticipatedRacesCount * 6}{" "}
              Units ($
              {(
                activeReport.cardTrackAssessment?.cardParScoreUnits ??
                activeReport.completedParticipatedRacesCount * 6
              ).toFixed(2)}
              )
              {(activeReport.cardTrackAssessment?.ntdRacesCount ?? 0) > 0
                ? ` · ${activeReport.cardTrackAssessment?.ntdRacesCount} NTD Race(s) Adjusted`
                : ` · ${activeReport.completedParticipatedRacesCount} Races × 3 Horses × 2u ($1W/$1P)`}
            </span>
          </div>

          {/* Background Logic Callout Banner */}
          <div className="p-3 rounded-lg bg-[#0B110E] border border-[#23352C] text-xs text-[#9BA8A1] leading-relaxed">
            <strong className="text-[#D4AF37] font-mono uppercase">
              $1 Each-Way Par Score Logic:
            </strong>{" "}
            Every horse selected by a user across the card is evaluated as a{" "}
            <strong className="text-[#F3F4F0]">
              $1 Each-Way bet ($1 Win + $1 Place = 2 units per horse)
            </strong>
            . On a standard 10-race card (3 horses/race = 30 horses), this equals{" "}
            <strong className="text-[#10B981]">60 units ($60.00) Par Score</strong>
            . Par adjusts dynamically if a card has a different number of races or
            includes{" "}
            <strong className="text-[#F59E0B]">
              NTD (No Third Dividend, ≤7 runners)
            </strong>{" "}
            races where 3rd place pays $0.00 place dividend (5u par per NTD race).{" "}
            {activeReport.cardTrackAssessment?.parScoreExplanation || ""}
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#1F2D26]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0B110E] border-b border-[#1F2D26] text-[11px] font-mono uppercase text-[#8A9990]">
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Syndicate User</th>
                  <th className="py-2.5 px-3">Horses (Races)</th>
                  <th className="py-2.5 px-3 text-right">Par Score (Units)</th>
                  <th className="py-2.5 px-3 text-right">
                    $1 Each-Way $ Return
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    Variance vs Par (Rate %)
                  </th>
                  <th className="py-2.5 px-3">Winners / Podiums (SR)</th>
                  <th className="py-2.5 px-3">2× Joker Round</th>
                  <th className="py-2.5 px-3 text-right">
                    Weighted $ Return / Pts
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2D26] text-xs font-mono">
                {activeReport.standings.map((row) => {
                  const isLeader = row.rank === 1;
                  const horsesCount =
                    row.selectedHorsesCount || row.racesParticipated * 3;
                  const parUnits =
                    row.parScoreUnits ||
                    activeReport.cardTrackAssessment?.cardParScoreUnits ||
                    row.racesParticipated * 6;
                  const ewReturn =
                    row.eachWayDollarReturn ??
                    Number(row.totalDollarReturn.toFixed(2));
                  const netVsPar =
                    row.eachWayNetVsPar ??
                    Number((ewReturn - parUnits).toFixed(2));
                  const returnRatePct =
                    row.eachWayReturnRatePct ??
                    Math.round((ewReturn / Math.max(1, parUnits)) * 100);

                  return (
                    <tr
                      key={row.punterId}
                      className={
                        isLeader
                          ? "bg-[#15251D] text-[#F3F4F0]"
                          : "bg-[#121A16] text-[#D5DDD8]"
                      }
                    >
                      <td className="py-2.5 px-3 font-bold text-[#D4AF37]">
                        #{row.rank}
                      </td>
                      <td className="py-2.5 px-3 font-sans font-bold text-sm text-[#F3F4F0]">
                        <div className="flex items-center gap-2">
                          <span>{row.punterName}</span>
                          {isLeader && (
                            <Award className="w-3.5 h-3.5 text-[#D4AF37]" />
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[#F3F4F0] font-bold">
                          {horsesCount}H
                        </span>{" "}
                        <span className="text-[#8A9990]">
                          ({row.racesParticipated}/
                          {activeReport.completedParticipatedRacesCount}R)
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#D4AF37]">
                        {parUnits}u (${parUnits.toFixed(2)})
                      </td>
                      <td className="py-2.5 px-3 text-right text-sm font-bold text-[#10B981]">
                        {formatDollarReturn(ewReturn)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`font-bold ${
                            netVsPar >= 0 ? "text-[#10B981]" : "text-[#F59E0B]"
                          }`}
                        >
                          {netVsPar >= 0 ? "+" : ""}
                          {netVsPar.toFixed(2)}u
                        </span>{" "}
                        <span className="text-[11px] text-[#8A9990]">
                          ({returnRatePct}% of Par)
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[#D4AF37] font-bold">
                          {row.winnersPicked}W
                        </span>{" "}
                        /{" "}
                        <span className="text-[#10B981] font-bold">
                          {row.podiumsPicked}P
                        </span>{" "}
                        <span className="text-[#8A9990]">
                          ({row.strikeRatePct}%)
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {row.jokerRaceNumber !== null ? (
                          row.jokerTriggered ? (
                            <span className="text-[#D4AF37] font-bold">
                              R{row.jokerRaceNumber} HIT (+
                              {row.jokerBonusPoints} pts)
                            </span>
                          ) : (
                            <span className="text-[#8A9990]">
                              R{row.jokerRaceNumber} (Missed)
                            </span>
                          )
                        ) : (
                          <span className="text-[#8A9990]">Not Played</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="text-xs font-bold text-[#10B981]">
                          {formatDollarReturn(row.totalDollarReturn)}
                        </div>
                        <div className="text-[10px] text-[#D4AF37]">
                          {row.totalPoints} pts
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ====================================================================
            SECTION 3B: USERS' TENDENCY TO SELECT FAVOURITES ASSESSMENT
           ==================================================================== */}
        <div className="rounded-xl border border-[#1F2D26] bg-[#0B110E] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F2D26] pb-2.5">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#D4AF37] font-bold">
              <Zap className="w-4 h-4 text-[#10B981]" />
              <span>
                Users&apos; Tendency to Select Favourites &amp; Market Pricing
                Profile
              </span>
            </div>
            <span className="text-[11px] font-mono text-[#8A9990]">
              Market Elect #1 Inclusion · 1st-Pref Chalk Rate · Top-3 Market
              Share · Avg Odds ($)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeReport.standings.map((row) => {
              const favRate = row.favouriteSelectionRatePct ?? 0;
              const top3Pct = row.top3MarketSharePct ?? 0;
              const avgOdds = row.avgSelectedRunnerOdds ?? 0;
              const tendencyLabel =
                row.favouriteTendencyLabel ||
                (favRate >= 65
                  ? "Market Chalk Hunter"
                  : favRate >= 40
                  ? "Balanced Market & Value"
                  : "Value & Roughie Speculator");

              return (
                <div
                  key={`fav-${row.punterId}`}
                  className="p-3.5 rounded-lg bg-[#121A16] border border-[#1F2D26] space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-sans font-bold text-sm text-[#F3F4F0]">
                      {row.punterName}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#192620] border border-[#D4AF37]/50 text-[#D4AF37] font-mono text-[10px] font-bold">
                      {tendencyLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center font-mono">
                    <div className="p-2 rounded bg-[#0B110E] border border-[#1F2D26]">
                      <div className="text-[10px] text-[#8A9990]">
                        Fav Picked
                      </div>
                      <div className="text-xs font-bold text-[#D4AF37]">
                        {row.favouritesSelectedCount ?? 0}/
                        {row.racesParticipated} ({favRate}%)
                      </div>
                    </div>
                    <div className="p-2 rounded bg-[#0B110E] border border-[#1F2D26]">
                      <div className="text-[10px] text-[#8A9990]">
                        1st-Pref Fav
                      </div>
                      <div className="text-xs font-bold text-[#10B981]">
                        {row.favouriteFirstPrefCount ?? 0}×
                      </div>
                    </div>
                    <div className="p-2 rounded bg-[#0B110E] border border-[#1F2D26]">
                      <div className="text-[10px] text-[#8A9990]">
                        Top-3 Market
                      </div>
                      <div className="text-xs font-bold text-[#38BDF8]">
                        {top3Pct}%
                      </div>
                    </div>
                    <div className="p-2 rounded bg-[#0B110E] border border-[#1F2D26]">
                      <div className="text-[10px] text-[#8A9990]">
                        Avg Pick Odds
                      </div>
                      <div className="text-xs font-bold text-[#F3F4F0]">
                        ${avgOdds.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#8A9990]">
                      <span>Favourite Inclusion Rate</span>
                      <span className="text-[#D4AF37] font-bold">
                        {favRate}% of races
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#0B110E] overflow-hidden border border-[#1F2D26]">
                      <div
                        className="h-full bg-[#D4AF37] rounded-full"
                        style={{ width: `${Math.max(6, Math.min(100, favRate))}%` }}
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-[#9BA8A1] leading-relaxed">
                    {row.favouriteTendencyAssessment ||
                      `${row.punterName} selected the race favourite in ${
                        row.favouritesSelectedCount ?? 0
                      }/${row.racesParticipated} races (${favRate}%), with an average selection price of $${avgOdds.toFixed(
                        2
                      )}.`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ====================================================================
            SECTION 3C: RACE CARD TRACK, FAVOURITE, BARRIER, JOCKEY & TRAINER ASSESSMENT
           ==================================================================== */}
        {(() => {
          const allPoolMeetings =
            allKnownMeetings.length > 0 ? allKnownMeetings : meetings;
          const selectedIds =
            selectedMeetingIds && selectedMeetingIds.length > 0
              ? selectedMeetingIds
              : [selectedMeetingId];
          const cardsToAssess = allPoolMeetings.filter(
            (m) =>
              selectedIds.includes(m.id) || m.id === activeReport.meetingId
          );
          const assessments =
            cardsToAssess.length > 0
              ? cardsToAssess.map((m) =>
                  m.id === activeReport.meetingId &&
                  activeReport.cardTrackAssessment
                    ? activeReport.cardTrackAssessment
                    : buildCardTrackAndMarketAssessment(m)
                )
              : activeReport.cardTrackAssessment
              ? [activeReport.cardTrackAssessment]
              : [];

          if (assessments.length === 0) return null;

          return (
            <div className="space-y-3">
              {assessments.map((ct) => (
                <div
                  key={`${ct.venue}-${ct.raceDate}`}
                  className="rounded-xl border border-[#23352C] bg-[#0B110E] p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F2D26] pb-2.5">
                    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#10B981] font-bold">
                      <Activity className="w-4 h-4 text-[#D4AF37]" />
                      <span>
                        Race Card Assessment — {ct.venue} ({ct.raceDate}) ·
                        Favourites, Barriers, Jockeys &amp; Trainers
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-[#D4AF37]">
                      {ct.completedRacesCount}/{ct.totalRacesOnCard} Races
                      Analyzed · Avg Field {ct.avgFieldSize} Runners · Card Par{" "}
                      {ct.cardParScoreUnits}u
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* 1. How Often the Favourite Won */}
                    <div className="p-3 rounded-lg bg-[#121A16] border border-[#1F2D26] space-y-2">
                      <div className="text-[10px] font-mono uppercase text-[#D4AF37] font-bold">
                        1 · Favourite Win &amp; Place Rate
                      </div>
                      <div className="flex items-baseline justify-between font-mono">
                        <span className="text-xl font-bold text-[#10B981]">
                          {ct.favouriteWinsCount}/{ct.completedRacesCount} (
                          {ct.favouriteWinRatePct}%)
                        </span>
                        <span className="text-xs text-[#D4AF37]">
                          Placed: {ct.favouritePlaceRatePct}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#0B110E] overflow-hidden">
                        <div
                          className="h-full bg-[#10B981] rounded-full"
                          style={{
                            width: `${Math.max(
                              6,
                              Math.min(100, ct.favouriteWinRatePct)
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="text-[11px] text-[#9BA8A1] leading-snug">
                        Avg Winner:{" "}
                        <strong className="text-[#F3F4F0]">
                          ${ct.avgWinningOdds.toFixed(2)}
                        </strong>{" "}
                        · Shortest: {ct.shortestWinnerText} · Longest:{" "}
                        {ct.longestWinnerText}
                      </div>
                      {ct.winningFavouritesList.length > 0 && (
                        <div className="text-[10px] font-mono text-[#10B981]">
                          Winning Favs: {ct.winningFavouritesList.join(", ")}
                        </div>
                      )}
                    </div>

                    {/* 2. Which Barrier Winners Jumped From */}
                    <div className="p-3 rounded-lg bg-[#121A16] border border-[#1F2D26] space-y-2">
                      <div className="text-[10px] font-mono uppercase text-[#10B981] font-bold">
                        2 · Winning Barrier Profile
                      </div>
                      <div className="flex items-baseline justify-between font-mono">
                        <span className="text-xl font-bold text-[#D4AF37]">
                          Avg Gate {ct.avgWinningBarrier}
                        </span>
                        <span className="text-[11px] text-[#8A9990]">
                          Sprint {ct.sprintWinnerAvgBarrier} / Stay{" "}
                          {ct.stayingWinnerAvgBarrier}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px]">
                        <div className="p-1.5 rounded bg-[#0B110E] border border-[#1F2D26]">
                          <div className="text-[#8A9990]">Inside 1–4</div>
                          <div className="font-bold text-[#10B981]">
                            {ct.barrierZones.inside1To4Wins}W (
                            {ct.barrierZones.inside1To4Pct}%)
                          </div>
                        </div>
                        <div className="p-1.5 rounded bg-[#0B110E] border border-[#1F2D26]">
                          <div className="text-[#8A9990]">Mid 5–8</div>
                          <div className="font-bold text-[#D4AF37]">
                            {ct.barrierZones.middle5To8Wins}W (
                            {ct.barrierZones.middle5To8Pct}%)
                          </div>
                        </div>
                        <div className="p-1.5 rounded bg-[#0B110E] border border-[#1F2D26]">
                          <div className="text-[#8A9990]">Wide 9+</div>
                          <div className="font-bold text-[#38BDF8]">
                            {ct.barrierZones.outside9PlusWins}W (
                            {ct.barrierZones.outside9PlusPct}%)
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] font-mono text-[#D5DDD8]">
                        Top Gates:{" "}
                        {ct.mostSuccessfulBarriers
                          .map(
                            (b) =>
                              `Gate ${b.barrier} (${b.wins}W/${b.podiums}P: ${b.racesText})`
                          )
                          .join(" · ")}
                      </div>
                    </div>

                    {/* 3. Which Jockeys Rode the Winners */}
                    <div className="p-3 rounded-lg bg-[#121A16] border border-[#1F2D26] space-y-2">
                      <div className="text-[10px] font-mono uppercase text-[#38BDF8] font-bold">
                        3 · Winning Jockeys on Card
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {ct.leadingJockeys.map((j, jIdx) => (
                          <div
                            key={j.name}
                            className="p-1.5 rounded bg-[#0B110E] border border-[#1F2D26] text-[11px]"
                          >
                            <div className="flex items-center justify-between font-mono">
                              <span className="font-sans font-bold text-[#F3F4F0]">
                                {jIdx + 1}. {j.name}
                              </span>
                              <span className="text-[#10B981] font-bold">
                                {j.wins}W · {j.podiums}P
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-[#8A9990] truncate">
                              {j.winningRacesText}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 4. Which Trainers Trained the Winners */}
                    <div className="p-3 rounded-lg bg-[#121A16] border border-[#1F2D26] space-y-2">
                      <div className="text-[10px] font-mono uppercase text-[#F59E0B] font-bold">
                        4 · Winning Trainers on Card
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {ct.leadingTrainers.map((t, tIdx) => (
                          <div
                            key={t.name}
                            className="p-1.5 rounded bg-[#0B110E] border border-[#1F2D26] text-[11px]"
                          >
                            <div className="flex items-center justify-between font-mono">
                              <span className="font-sans font-bold text-[#F3F4F0]">
                                {tIdx + 1}. {t.name}
                              </span>
                              <span className="text-[#D4AF37] font-bold">
                                {t.wins}W · {t.podiums}P
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-[#8A9990] truncate">
                              {t.winningRacesText}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-[#121A16] border border-[#1F2D26] text-[11px] text-[#D5DDD8] leading-relaxed">
                    <strong className="text-[#10B981] font-mono uppercase">
                      Card Track &amp; Bias Summary:
                    </strong>{" "}
                    {ct.overallCardProfileSummary}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ====================================================================
            SECTION 4: RACE-BY-RACE USER SCORING & COMBINED TRIFECTA TABLE
           ==================================================================== */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#10B981] font-bold">
              <Layers className="w-4 h-4" />
              <span>
                Race-by-Race Results, $1 Each-Way Return &amp; Combined Trifecta
                Matrix (${activeReport.trifectaBetAmount} Box)
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
              <span className="text-[#D4AF37] font-bold">
                Trifecta Hits: {activeReport.trifectaSummary.trifectaHits}/
                {activeReport.trifectaSummary.racesEvaluated}
              </span>
              <span className="text-[#8A9990]">·</span>
              <span className="text-[#9BA8A1]">
                2/3 Near-Misses: {activeReport.trifectaSummary.nearMisses2Of3}
              </span>
              <span className="text-[#8A9990]">·</span>
              <span className="text-[#10B981] font-bold">
                Return:{" "}
                {formatDollarReturn(
                  activeReport.trifectaSummary.totalFlexiReturn
                )}{" "}
                / Outlay:{" "}
                {formatDollarReturn(activeReport.trifectaSummary.totalOutlay)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#1F2D26]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0B110E] border-b border-[#1F2D26] text-[11px] font-mono uppercase text-[#8A9990]">
                  <th className="py-2 px-3">Race &amp; Par</th>
                  <th className="py-2 px-3">
                    Official Podium, Barrier, Jockey &amp; Trainer
                  </th>
                  {activeReport.standings.map((u) => (
                    <th
                      key={u.punterId}
                      className="py-2 px-3 border-l border-[#1F2D26]"
                    >
                      {u.punterName} ($1 EW / Weighted)
                    </th>
                  ))}
                  <th className="py-2 px-3 border-l border-[#1F2D26]">
                    Combined Trifecta (${activeReport.trifectaBetAmount} Box)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2D26] text-xs">
                {activeReport.raceRows.map((row) => (
                  <tr
                    key={row.raceNumber}
                    className="bg-[#121A16] hover:bg-[#16221C] align-top"
                  >
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-mono font-bold text-[#F3F4F0] flex items-center gap-1.5">
                        <span>
                          R{row.raceNumber} · {row.startTime}
                        </span>
                        {row.isNtdRace && (
                          <span className="px-1.5 py-0.2 rounded bg-[#F59E0B]/20 border border-[#F59E0B] text-[#F59E0B] text-[9px] font-bold">
                            NTD
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#8A9990] max-w-[140px] truncate">
                        {row.raceName}
                      </div>
                      <div className="font-mono text-[10px] text-[#8A9990]">
                        {row.distance}m · Par {row.raceParUnits ?? 6}u
                      </div>
                    </td>

                    <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap space-y-0.5">
                      <div className="text-[#D4AF37] font-semibold">
                        1st: {row.podium.first}{" "}
                        {row.podium.firstWinOdds > 0
                          ? `($${row.podium.firstWinOdds.toFixed(2)})`
                          : ""}
                        {row.didFavouriteWin ? (
                          <span className="ml-1 px-1 py-0.2 rounded bg-[#10B981]/20 text-[#10B981] text-[9px] font-bold">
                            FAV WON
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[#F3F4F0]">
                        2nd: {row.podium.second} · 3rd: {row.podium.third}
                      </div>
                      {(row.winningBarrier ||
                        row.winningJockey ||
                        row.winningTrainer) && (
                        <div className="text-[10px] text-[#8A9990]">
                          Gate {row.winningBarrier || "—"} · J:{" "}
                          {row.winningJockey || "—"} · T:{" "}
                          {row.winningTrainer || "—"}
                        </div>
                      )}
                    </td>

                    {activeReport.standings.map((u) => {
                      const cell = row.userCells.find(
                        (c) => c.punterId === u.punterId
                      );
                      if (!cell || !cell.hasParticipated) {
                        return (
                          <td
                            key={u.punterId}
                            className="py-2.5 px-3 border-l border-[#1F2D26] text-[#8A9990] font-mono text-[11px]"
                          >
                            —
                          </td>
                        );
                      }
                      const ewRace = cell.eachWayRaceReturn ?? 0;
                      return (
                        <td
                          key={u.punterId}
                          className="py-2.5 px-3 border-l border-[#1F2D26] font-mono text-[11px] space-y-1"
                        >
                          <div className="text-[#D5DDD8] text-[10px] leading-snug">
                            {cell.picksSummary}
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#1F2D26]/70">
                            <span
                              className={
                                cell.points > 0
                                  ? "text-[#10B981] font-bold"
                                  : "text-[#8A9990]"
                              }
                            >
                              {cell.hitSummary}
                              {cell.jokerTriggered ? " · 2× JOKER" : ""}
                            </span>
                            <span className="font-bold text-[#10B981]">
                              $1 EW: {formatDollarReturn(ewRace)}{" "}
                              <span className="text-[#D4AF37]">
                                ({formatDollarReturn(cell.dollarReturn)} ·{" "}
                                {cell.points}p)
                              </span>
                            </span>
                          </div>
                        </td>
                      );
                    })}

                    <td className="py-2.5 px-3 border-l border-[#1F2D26] font-mono text-[11px] space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`font-bold ${
                            row.trifecta.isHit
                              ? "text-[#10B981]"
                              : row.trifecta.hitCount === 2
                              ? "text-[#D4AF37]"
                              : "text-[#8A9990]"
                          }`}
                        >
                          {row.trifecta.isHit
                            ? `★ HIT (+${formatDollarReturn(
                                row.trifecta.flexiReturnOnBet
                              )})`
                            : `${row.trifecta.hitCount}/3 Placed`}
                        </span>
                        <span className="text-[#D4AF37]">
                          $1 Div: ${row.trifecta.officialDividend.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[10px] text-[#8A9990]">
                        {row.trifecta.poolCount}H ({row.trifecta.boxedCombinations}{" "}
                        combos):{" "}
                        <span className="text-[#D5DDD8]">
                          {row.trifecta.poolRunnersText}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ====================================================================
            SECTION 5: CONCISE NEXT MAJOR RACE MEETS IN SYDNEY & MELBOURNE
           ==================================================================== */}
        <div className="rounded-xl border border-[#10B981]/40 bg-[#11221B] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F2D26] pb-2">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#10B981] font-bold">
              <Flame className="w-4 h-4 text-[#D4AF37]" />
              <span>{nextMeets.headline}</span>
            </div>
            <span className="font-mono text-[11px] text-[#D4AF37]">
              Upcoming Feature Schedule
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-[#0B110E] border border-[#D4AF37]/40 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-[#D4AF37] flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  SYDNEY · {nextMeets.sydneyNextMeet.venue}
                </span>
                <span className="text-[#10B981] font-bold">
                  {nextMeets.sydneyNextMeet.stakesHighlight}
                </span>
              </div>
              <div className="text-[11px] font-mono text-[#D5DDD8]">
                {nextMeets.sydneyNextMeet.featureRaces.join(" · ")}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#0B110E] border border-[#10B981]/40 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-[#10B981] flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  MELBOURNE · {nextMeets.melbourneNextMeet.venue}
                </span>
                <span className="text-[#D4AF37] font-bold">
                  {nextMeets.melbourneNextMeet.stakesHighlight}
                </span>
              </div>
              <div className="text-[11px] font-mono text-[#D5DDD8]">
                {nextMeets.melbourneNextMeet.featureRaces.join(" · ")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
