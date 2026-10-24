import React, { useState, useEffect } from "react";
import {
  Bell,
  BellRing,
  BellOff,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  X,
  Trash2,
  Plus,
  Volume2,
  Sparkles,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Percent,
} from "lucide-react";
import { RaceMeeting, RaceEvent } from "../types/racing";
import { RunnerStrategyAnalysis } from "../utils/bettingStrategyEngine";
import {
  dispatchBackgroundRaceAlert,
  playDingDingChime,
  playCashRegisterSound,
} from "../utils/soundEffects";

export interface MarketOddsAlert {
  id: string;
  meetingId: string;
  venue: string;
  raceNumber: number;
  tabNumber: number;
  horseName: string;
  condition: "below" | "above" | "edge";
  threshold: number;
  initialOdds: number;
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
}

interface MarketOddsAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  meeting: RaceMeeting;
  race: RaceEvent;
  analysisData: RunnerStrategyAnalysis[];
  alerts: MarketOddsAlert[];
  onAddAlert: (alert: Omit<MarketOddsAlert, "id" | "createdAt" | "triggered">) => void;
  onRemoveAlert: (alertId: string) => void;
  onClearAlerts: () => void;
  isApple?: boolean;
  initialTabNumber?: number;
}

export const MarketOddsAlertModal: React.FC<MarketOddsAlertModalProps> = ({
  isOpen,
  onClose,
  meeting,
  race,
  analysisData,
  alerts,
  onAddAlert,
  onRemoveAlert,
  onClearAlerts,
  isApple = true,
  initialTabNumber,
}) => {
  const [selectedTabNo, setSelectedTabNo] = useState<number>(() => {
    return initialTabNumber || analysisData[0]?.tabNumber || 1;
  });
  const [condition, setCondition] = useState<"below" | "above" | "edge">("below");
  const [thresholdInput, setThresholdInput] = useState<string>("3.50");
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>(() => {
    if (typeof Notification !== "undefined") {
      return Notification.permission;
    }
    return "default";
  });
  const [testSent, setTestSent] = useState<boolean>(false);

  // Update selected runner if list changes or initialTabNumber specified
  useEffect(() => {
    if (initialTabNumber && analysisData.some((r) => r.tabNumber === initialTabNumber)) {
      setSelectedTabNo(initialTabNumber);
    } else if (analysisData.length > 0 && !analysisData.some((r) => r.tabNumber === selectedTabNo)) {
      setSelectedTabNo(analysisData[0].tabNumber);
    }
  }, [analysisData, selectedTabNo, initialTabNumber, isOpen]);

  // Sync notification permission status
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPermissionStatus(Notification.permission);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const targetRunner = analysisData.find((r) => r.tabNumber === selectedTabNo) || analysisData[0];
  const currentOdds = targetRunner?.bookmakerOdds || 4.0;
  const currentFair = targetRunner?.modelFairOdds || 4.2;

  const handleRequestPermission = async () => {
    if (typeof Notification === "undefined") return;
    try {
      const perm = await Notification.requestPermission();
      setPermissionStatus(perm);
      if (perm === "granted") {
        dispatchBackgroundRaceAlert({
          title: "🔔 TurfSheet Market Alerts Activated",
          body: `You'll now receive browser notifications when odds thresholds cross at ${meeting.venue}.`,
          tag: "turfsheet-perm-granted",
        });
        playDingDingChime();
      }
    } catch (e) {
      console.warn("Failed to request notification permission:", e);
    }
  };

  const handleSendTestNotification = () => {
    setTestSent(true);
    dispatchBackgroundRaceAlert({
      title: `🚨 Test Alert: #${targetRunner?.tabNumber || 1} ${targetRunner?.horseName || "Horse"}`,
      body: `Odds threshold alert confirmed! Testing notifications for ${meeting.venue} R${race.raceNumber}.`,
      tag: `turfsheet-test-${Date.now()}`,
    });
    playDingDingChime();
    setTimeout(() => setTestSent(false), 2500);
  };

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(thresholdInput);
    if (isNaN(val) || val <= 0) return;

    if (!targetRunner) return;

    onAddAlert({
      meetingId: meeting.id,
      venue: meeting.venue,
      raceNumber: race.raceNumber,
      tabNumber: targetRunner.tabNumber,
      horseName: targetRunner.horseName,
      condition,
      threshold: val,
      initialOdds: targetRunner.bookmakerOdds,
    });

    // If notifications aren't granted, prompt user smoothly
    if (permissionStatus === "default" && typeof Notification !== "undefined") {
      Notification.requestPermission().then((p) => setPermissionStatus(p)).catch(() => {});
    }

    // Success chime
    playDingDingChime();
  };

  // Filter alerts for this current race & meeting
  const currentRaceAlerts = alerts.filter(
    (a) => a.meetingId === meeting.id && a.raceNumber === race.raceNumber
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="market-alert-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden transition-all ${
          isApple
            ? "bg-white border-[#E5E5EA] text-[#1D1D1F]"
            : "bg-[#0E1512] border-[#23352C] text-[#F3F4F0]"
        }`}
      >
        {/* Header */}
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between ${
            isApple ? "bg-[#F9F9FB] border-[#E5E5EA]" : "bg-[#141C18] border-[#23352C]"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                isApple ? "bg-[#0071E3]/10 text-[#0071E3]" : "bg-[#10B981]/15 text-[#10B981]"
              }`}
            >
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <h3 id="market-alert-title" className="text-base font-bold">
                Set Market Odds Alert
              </h3>
              <p className="text-xs text-[#86868B]">
                {meeting.venue} · Race {race.raceNumber} ({race.raceName})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#86868B] hover:text-current hover:bg-current/10 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Notification Permission Banner */}
          {permissionStatus !== "granted" ? (
            <div
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                permissionStatus === "denied"
                  ? "bg-[#FFF1F0] border-[#FF3B30]/30 text-[#1D1D1F]"
                  : isApple
                  ? "bg-[#F5F8FF] border-[#0071E3]/25 text-[#1D1D1F]"
                  : "bg-[#0F1E19] border-[#10B981]/30 text-[#F3F4F0]"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    permissionStatus === "denied"
                      ? "text-[#FF3B30]"
                      : isApple
                      ? "text-[#0071E3]"
                      : "text-[#10B981]"
                  }`}
                />
                <div className="text-xs">
                  <div className="font-bold">
                    {permissionStatus === "denied"
                      ? "Browser Notifications Blocked"
                      : "Enable Browser Notifications"}
                  </div>
                  <div className="text-[#86868B] text-[11px] mt-0.5">
                    {permissionStatus === "denied"
                      ? "Enable in browser address bar to get popups when backgrounded. Audio chimes will still sound."
                      : "Get real-time OS alert banners on desktop & mobile when odds plunge or drift."}
                  </div>
                </div>
              </div>
              {permissionStatus !== "denied" && (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 shadow-xs ${
                    isApple
                      ? "bg-[#0071E3] text-white hover:bg-[#0077ED]"
                      : "bg-[#10B981] text-[#070B09] hover:bg-[#0EA572]"
                  }`}
                >
                  Allow Alerts
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-current/5 border border-current/10">
              <span className="flex items-center gap-1.5 text-[#34C759] dark:text-[#10B981] font-semibold">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Browser notifications active</span>
              </span>
              <button
                type="button"
                onClick={handleSendTestNotification}
                className="text-[11px] font-semibold text-[#0071E3] dark:text-[#38BDF8] hover:underline cursor-pointer"
              >
                {testSent ? "Alert Dispatched!" : "Send Test Alert"}
              </button>
            </div>
          )}

          {/* Alert Configuration Form */}
          <form onSubmit={handleCreateAlert} className="space-y-4">
            {/* Runner Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#86868B] mb-1.5">
                1. Select Contender to Monitor
              </label>
              <select
                value={selectedTabNo}
                onChange={(e) => {
                  const newTab = Number(e.target.value);
                  setSelectedTabNo(newTab);
                  const r = analysisData.find((x) => x.tabNumber === newTab);
                  if (r) {
                    if (condition === "below") {
                      setThresholdInput((r.bookmakerOdds * 0.85).toFixed(2));
                    } else if (condition === "above") {
                      setThresholdInput((r.bookmakerOdds * 1.25).toFixed(2));
                    }
                  }
                }}
                className={`w-full p-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                  isApple
                    ? "bg-white border-[#E5E5EA] text-[#1D1D1F]"
                    : "bg-[#141C18] border-[#2B3D34] text-[#F3F4F0]"
                }`}
              >
                {analysisData.map((runner) => (
                  <option key={runner.tabNumber} value={runner.tabNumber}>
                    #{runner.tabNumber} {runner.horseName} — Market ${runner.bookmakerOdds.toFixed(2)} (Fair ${runner.modelFairOdds.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            {/* Condition Mode */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#86868B] mb-1.5">
                2. Alert Trigger Condition
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCondition("below");
                    setThresholdInput((currentOdds * 0.85).toFixed(2));
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    condition === "below"
                      ? isApple
                        ? "bg-[#0071E3]/10 border-[#0071E3] text-[#0071E3] font-bold ring-1 ring-[#0071E3]"
                        : "bg-[#10B981]/15 border-[#10B981] text-[#10B981] font-bold ring-1 ring-[#10B981]"
                      : "border-current/15 opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-center gap-1 text-xs">
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Plunge / Drop</span>
                  </div>
                  <span className="text-[10px] text-[#86868B] block mt-0.5">
                    Odds drop below ≤ $X
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCondition("above");
                    setThresholdInput((currentOdds * 1.25).toFixed(2));
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    condition === "above"
                      ? isApple
                        ? "bg-[#0071E3]/10 border-[#0071E3] text-[#0071E3] font-bold ring-1 ring-[#0071E3]"
                        : "bg-[#10B981]/15 border-[#10B981] text-[#10B981] font-bold ring-1 ring-[#10B981]"
                      : "border-current/15 opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-center gap-1 text-xs">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Drift / Blowout</span>
                  </div>
                  <span className="text-[10px] text-[#86868B] block mt-0.5">
                    Odds drift above ≥ $X
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCondition("edge");
                    setThresholdInput("15");
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    condition === "edge"
                      ? isApple
                        ? "bg-[#0071E3]/10 border-[#0071E3] text-[#0071E3] font-bold ring-1 ring-[#0071E3]"
                        : "bg-[#10B981]/15 border-[#10B981] text-[#10B981] font-bold ring-1 ring-[#10B981]"
                      : "border-current/15 opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-center gap-1 text-xs">
                    <Percent className="w-3.5 h-3.5" />
                    <span>Value Edge</span>
                  </div>
                  <span className="text-[10px] text-[#86868B] block mt-0.5">
                    Edge reaches ≥ X%
                  </span>
                </button>
              </div>
            </div>

            {/* Threshold Input & Presets */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#86868B]">
                  3. Set Target Threshold {condition === "edge" ? "(%)" : "($)"}
                </label>
                <span className="text-xs text-[#86868B] font-mono">
                  Current: ${currentOdds.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#86868B]">
                    {condition === "edge" ? "%" : "$"}
                  </span>
                  <input
                    type="number"
                    step="0.10"
                    min="1.01"
                    max="500"
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    className={`w-full pl-7 pr-3 py-2 rounded-xl border font-mono font-bold text-sm focus:outline-none ${
                      isApple
                        ? "bg-white border-[#E5E5EA] text-[#1D1D1F] focus:border-[#0071E3]"
                        : "bg-[#141C18] border-[#2B3D34] text-[#F3F4F0] focus:border-[#10B981]"
                    }`}
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1">
                  {condition === "edge" ? (
                    <>
                      {[10, 15, 25].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setThresholdInput(String(val))}
                          className="px-2 py-1.5 rounded-lg border border-current/15 text-xs font-mono hover:bg-current/10 cursor-pointer"
                        >
                          +{val}%
                        </button>
                      ))}
                    </>
                  ) : (
                    <>
                      {[-20, -10, 15, 30].map((delta) => {
                        const target = Math.max(1.04, currentOdds * (1 + delta / 100));
                        return (
                          <button
                            key={delta}
                            type="button"
                            onClick={() => setThresholdInput(target.toFixed(2))}
                            className="px-2 py-1.5 rounded-lg border border-current/15 text-xs font-mono hover:bg-current/10 cursor-pointer"
                            title={`${delta > 0 ? "+" : ""}${delta}% of current price`}
                          >
                            ${target.toFixed(2)}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <button
              type="submit"
              className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                isApple
                  ? "bg-[#0071E3] text-white hover:bg-[#0077ED]"
                  : "bg-[#10B981] text-[#070B09] hover:bg-[#0EA572]"
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>
                Add Alert: #{targetRunner?.tabNumber} {condition === "below" ? "≤" : condition === "above" ? "≥" : "Edge ≥"} {condition === "edge" ? `${thresholdInput}%` : `$${thresholdInput}`}
              </span>
            </button>
          </form>

          {/* Active Alerts List for this Race */}
          <div className="pt-3 border-t border-current/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#86868B] flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                <span>Active Alerts for Race {race.raceNumber} ({currentRaceAlerts.length})</span>
              </span>
              {currentRaceAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAlerts}
                  className="text-[11px] text-[#FF3B30] hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {currentRaceAlerts.length === 0 ? (
              <p className="text-xs text-[#86868B] italic text-center py-2">
                No active threshold alerts set for this race yet.
              </p>
            ) : (
              <div className="space-y-1.5">
                {currentRaceAlerts.map((alert) => {
                  const runner = analysisData.find((r) => r.tabNumber === alert.tabNumber);
                  const isTriggered = alert.triggered;

                  return (
                    <div
                      key={alert.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                        isTriggered
                          ? "bg-[#FF9500]/10 border-[#FF9500]/40 text-current"
                          : isApple
                          ? "bg-[#F9F9FB] border-[#E5E5EA]"
                          : "bg-[#141C18] border-[#23352C]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold w-5">#{alert.tabNumber}</span>
                        <div className="min-w-0">
                          <span className="font-semibold">{alert.horseName}</span>
                          <div className="text-[11px] text-[#86868B] font-mono">
                            Target:{" "}
                            <strong className="text-current">
                              {alert.condition === "below"
                                ? `Plunge ≤ $${alert.threshold.toFixed(2)}`
                                : alert.condition === "above"
                                ? `Drift ≥ $${alert.threshold.toFixed(2)}`
                                : `Edge ≥ ${alert.threshold}%`}
                            </strong>{" "}
                            · Live: ${runner?.bookmakerOdds.toFixed(2) || alert.initialOdds.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isTriggered && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FF9500] text-white">
                            TRIGGERED
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onRemoveAlert(alert.id)}
                          className="p-1 rounded text-[#86868B] hover:text-[#FF3B30] transition-colors cursor-pointer"
                          title="Remove Alert"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
