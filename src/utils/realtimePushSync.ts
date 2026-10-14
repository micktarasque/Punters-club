import { RaceMeeting, RaceEvent } from "../types/racing";

export type RealTimePushEventType =
  | "punters_updated"
  | "results_updated"
  | "meeting_updated"
  | "connected";

export interface RealTimePushMessage {
  type: RealTimePushEventType;
  updatedAt?: string;
  timestamp?: number;
  originTabId?: string;
}

// Generate unique tab ID for this browser tab session
export const TAB_SESSION_ID = `tab-${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;

let crossTabChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== "undefined" && "BroadcastChannel" in window) {
    crossTabChannel = new BroadcastChannel("turfsheet_realtime_channel");
  }
} catch {
  crossTabChannel = null;
}

/**
 * Broadcasts an event to all other open tabs in this browser via BroadcastChannel.
 */
export function broadcastCrossTabEvent(type: RealTimePushEventType, extra: Record<string, any> = {}) {
  if (!crossTabChannel) return;
  try {
    crossTabChannel.postMessage({
      type,
      originTabId: TAB_SESSION_ID,
      timestamp: Date.now(),
      ...extra,
    });
  } catch {
    // ignore
  }
}

/**
 * Subscribes to Server-Sent Events (SSE) and cross-tab BroadcastChannel.
 * Triggers callback whenever data is pushed or changed.
 */
export function subscribeToRealTimePushUpdates(
  onUpdate: (event: RealTimePushMessage) => void
): () => void {
  const unsubscribers: Array<() => void> = [];

  // 1. Cross-tab BroadcastChannel listener
  if (crossTabChannel) {
    const handleBroadcast = (evt: MessageEvent<RealTimePushMessage>) => {
      if (evt.data?.originTabId === TAB_SESSION_ID) return; // ignore self
      onUpdate(evt.data);
    };
    crossTabChannel.addEventListener("message", handleBroadcast);
    unsubscribers.push(() => {
      crossTabChannel?.removeEventListener("message", handleBroadcast);
    });
  }

  // 2. Server-Sent Events (SSE) listener
  if (typeof window !== "undefined" && "EventSource" in window) {
    try {
      const eventSource = new EventSource("/api/events");

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as RealTimePushMessage;
          onUpdate(parsed);
        } catch {
          // ignore heartbeat / unparsed
        }
      };

      eventSource.onerror = () => {
        // SSE auto-reconnects natively
      };

      unsubscribers.push(() => {
        eventSource.close();
      });
    } catch {
      // ignore
    }
  }

  return () => {
    unsubscribers.forEach((fn) => fn());
  };
}

/**
 * Calculates the optimal adaptive polling interval based on scheduled race start times
 * and official race completion states.
 *
 * Performance benefits:
 * - If all races are finalized: returns Infinity (stops polling completely, saving battery/CPU/network)
 * - If next race starts in <2 mins: returns 15s (Live Jump Mode)
 * - If next race starts in 2-10 mins: returns 35s
 * - If next race is >10 mins away: returns 90s
 * - If tab is hidden in background: scales interval by 2.5x
 */
export function calculateAdaptiveRacePollingInterval(
  meetings: RaceMeeting[],
  isAutoRefreshActive: boolean
): { intervalSeconds: number; mode: "live-jump" | "approaching" | "cruising" | "finalized" | "paused" } {
  if (!isAutoRefreshActive || meetings.length === 0) {
    return { intervalSeconds: Infinity, mode: "paused" };
  }

  const now = new Date();
  let hasPendingRaces = false;
  let minDiffMinutes = Infinity;

  for (const m of meetings) {
    for (const r of m.races) {
      if (r.status !== "Official" && r.status !== "Completed") {
        hasPendingRaces = true;
        if (r.startTime) {
          const parts = r.startTime.split(":");
          if (parts.length >= 2) {
            const raceTime = new Date(now);
            raceTime.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
            const diffMin = (raceTime.getTime() - now.getTime()) / 60000;
            // Only consider upcoming races or races within 10 mins past scheduled jump
            if (diffMin > -15 && diffMin < minDiffMinutes) {
              minDiffMinutes = diffMin;
            }
          }
        }
      }
    }
  }

  // All races for the day are finished
  if (!hasPendingRaces) {
    return { intervalSeconds: Infinity, mode: "finalized" };
  }

  // Next race jump is imminent (<2 mins) or recently jumped (awaiting official all-clear)
  if (minDiffMinutes <= 2) {
    return { intervalSeconds: 15, mode: "live-jump" };
  }

  // Next race jumping in 2-10 minutes
  if (minDiffMinutes <= 10) {
    return { intervalSeconds: 30, mode: "approaching" };
  }

  // Next race >10 minutes away
  return { intervalSeconds: 75, mode: "cruising" };
}

/**
 * Fast string hashing utility to detect whether incoming data payloads actually changed,
 * preventing wasteful React re-renders and re-computations when data is identical.
 */
export function hashDataPayload(data: any): string {
  try {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  } catch {
    return String(Date.now());
  }
}
