#!/usr/bin/env python3
import json
import os
import re
import time
import zlib
import struct
from datetime import datetime
import sys

sys.path.insert(0, "scripts")
from build_real_seed import fetch_json, transform_event, clean_venue_name, get_meeting_tier

def make_png(width: int, height: int, bg_rgb=(12, 22, 18), accent_rgb=(212, 175, 55), maskable=False) -> bytes:
    """Generates a valid high-contrast PNG icon for PWA and iPad Pro Home Screen."""
    raw_rows = []
    cx, cy = width / 2.0, height / 2.0
    r_outer = min(width, height) * (0.34 if maskable else 0.42)
    r_inner = r_outer * 0.78

    for y in range(height):
        row = bytearray([0])  # filter type 0
        for x in range(width):
            dx = x - cx
            dy = y - cy
            dist = (dx * dx + dy * dy) ** 0.5
            # Draw a gold horseshoe / racing ring emblem on deep turf green background
            if r_inner <= dist <= r_outer and dy < r_outer * 0.65:
                row.extend(accent_rgb + (255,))
            elif dist < r_inner * 0.35:
                row.extend((16, 185, 129, 255))
            else:
                row.extend(bg_rgb + (255,))
        raw_rows.append(bytes(row))

    raw_data = b"".join(raw_rows)

    def chunk(chunk_type: bytes, data: bytes) -> bytes:
        c = chunk_type + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw_data, 9)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

def generate_pwa_icons():
    os.makedirs("public", exist_ok=True)
    with open("public/pwa-192x192.png", "wb") as f:
        f.write(make_png(192, 192, maskable=False))
    with open("public/pwa-512x512.png", "wb") as f:
        f.write(make_png(512, 512, maskable=False))
    with open("public/pwa-maskable-512x512.png", "wb") as f:
        f.write(make_png(512, 512, maskable=True))
    with open("public/apple-touch-icon.png", "wb") as f:
        f.write(make_png(180, 180, maskable=False))

    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0C1612"/>
  <circle cx="256" cy="256" r="180" fill="none" stroke="#D4AF37" stroke-width="32" stroke-dasharray="900 240" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="56" fill="#10B981"/>
</svg>"""
    with open("public/icon.svg", "wb") as f:
        f.write(svg.encode("utf-8"))
    print("Generated PWA & iPad Pro icons in public/")

def main():
    generate_pwa_icons()

    with open("scripts/real_meetings_dump.json", "r", encoding="utf-8") as f:
        meetings = json.load(f)

    existing_dates = set(m["date"] for m in meetings)
    for extra_d in ["2026-10-04", "2026-10-05"]:
        if extra_d not in existing_dates:
            u = f"https://api.ladbrokes.com.au/affiliates/v1/racing/meetings?category=T&country=AUS&date_from={extra_d}&date_to={extra_d}&limit=100"
            ms = fetch_json(u).get("data", {}).get("meetings", [])
            for m in ms:
                st = (m.get("state") or "").upper()
                nm = clean_venue_name(m.get("name") or "")
                if st in ("NSW", "VIC", "ACT") or any(k in nm for k in ["Eagle Farm", "Doomben", "Morphettville", "Gold Coast", "Sunshine Coast", "Ascot"]):
                    races_out = []
                    weather = "Fine"
                    rail = "True"
                    for r_sum in m.get("races") or []:
                        rid = r_sum.get("id")
                        edata = {}
                        for _ in range(3):
                            try:
                                edata = fetch_json(f"https://api.ladbrokes.com.au/affiliates/v1/racing/events/{rid}").get("data", {})
                                break
                            except Exception:
                                time.sleep(0.3)
                        r_obj = (edata or {}).get("race") or {}
                        if r_obj.get("weather"):
                            weather = str(r_obj["weather"]).title()
                        if r_obj.get("rail_position"):
                            rail = str(r_obj["rail_position"])[:60]
                        races_out.append(transform_event(r_sum, edata, extra_d))
                    races_out.sort(key=lambda x: x["raceNumber"])
                    slug = re.sub(r"[^a-z0-9]+", "-", nm.lower()).strip("-")
                    dt_obj = datetime.strptime(extra_d, "%Y-%m-%d")
                    tc_raw = str(m.get("track_condition") or "Good4")
                    tc = re.sub(r"([A-Za-z]+)(\d+)", r"\1 \2", tc_raw)
                    meetings.append({
                        "id": f"{st.lower()}-{slug}-{extra_d}",
                        "venue": nm,
                        "state": st,
                        "tier": get_meeting_tier(nm, st),
                        "date": extra_d,
                        "dayOfWeek": dt_obj.strftime("%A"),
                        "trackRating": tc,
                        "weather": weather,
                        "railPosition": rail,
                        "races": races_out,
                    })

    # Also normalise "Rosehill" -> "Rosehill Gardens" across all meetings
    for m in meetings:
        if m["venue"] == "Rosehill":
            m["venue"] = "Rosehill Gardens"

    meetings.sort(key=lambda x: (x["date"], 0 if x["state"] in ("NSW", "VIC") else 1, x["venue"]))

    with open("scripts/real_meetings_dump.json", "w", encoding="utf-8") as f:
        json.dump(meetings, f, indent=2)

    if os.path.exists(".cache/tab_scrape_cache.json"):
        os.remove(".cache/tab_scrape_cache.json")

    ts_header = """import type {
  RaceEvent,
  RaceMeeting,
  RaceRunner,
  PunterProfile,
} from "../types/racing.ts";

export function getCurrentAustralianDateIso(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fallback
  }
  return "2026-10-10";
}

// Default to Saturday feature race day (Caulfield Guineas Day & Rosehill Hill Stakes Day)
export const INITIAL_RACE_DATE = "2026-10-10";
export const INITIAL_START_DATE = "2026-10-08";

// Reference "today" date in AEST/AEDT for the 5-day ahead limit
export const REFERENCE_TODAY_ISO = getCurrentAustralianDateIso();
export const MAX_DAYS_AHEAD = 5;

export function getMaxAllowedDateIso(baseDateIso: string = getCurrentAustralianDateIso()): string {
  const d = new Date(`${baseDateIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "2026-10-15";
  d.setUTCDate(d.getUTCDate() + MAX_DAYS_AHEAD);
  return d.toISOString().slice(0, 10);
}

export function isDateBeyond5DaysAhead(
  dateIso: string,
  baseDateIso: string = getCurrentAustralianDateIso()
): boolean {
  const maxIso = getMaxAllowedDateIso(baseDateIso);
  return dateIso > maxIso;
}

export function clampDateRangeTo5Days(
  startDate: string,
  endDate: string,
  baseDateIso: string = getCurrentAustralianDateIso()
): { startDate: string; endDate: string; wasClamped: boolean; maxAllowedDate: string } {
  const maxAllowedDate = getMaxAllowedDateIso(baseDateIso);
  let clampedStart = startDate;
  let clampedEnd = endDate || startDate;
  let wasClamped = false;

  if (clampedStart > maxAllowedDate) {
    clampedStart = maxAllowedDate;
    wasClamped = true;
  }
  if (clampedEnd > maxAllowedDate) {
    clampedEnd = maxAllowedDate;
    wasClamped = true;
  }
  if (clampedEnd < clampedStart) {
    clampedEnd = clampedStart;
  }
  return { startDate: clampedStart, endDate: clampedEnd, wasClamped, maxAllowedDate };
}

export function isMainMetroVenue(venue: string, _meetingCode?: string): boolean {
  const v = (venue || "").toLowerCase();
  return (
    v.includes("flemington") ||
    v.includes("randwick") ||
    v.includes("caulfield") ||
    v.includes("rosehill") ||
    v.includes("moonee valley") ||
    v.includes("sandown") ||
    v.includes("warwick farm") ||
    v.includes("canterbury") ||
    v.includes("eagle farm") ||
    v.includes("doomben") ||
    v.includes("morphettville") ||
    v.includes("ascot")
  );
}

export function getMetroPriorityScore(meeting: RaceMeeting): number {
  const v = (meeting.venue || "").toLowerCase();
  const s = (meeting.state || "").toUpperCase();
  if (v.includes("caulfield") || v.includes("flemington")) return 1;
  if (v.includes("rosehill") || (v.includes("randwick") && !v.includes("kensington"))) return 2;
  if (v.includes("moonee valley") || v.includes("sandown")) return 3;
  if (v.includes("randwick-kensington") || v.includes("warwick farm") || v.includes("canterbury")) return 4;
  if (v.includes("eagle farm") || v.includes("doomben")) return 5;
  if (v.includes("morphettville")) return 6;
  if (v.includes("ascot")) return 7;
  if (meeting.tier === "Metropolitan") return 8;
  if (s === "VIC") return 10;
  if (s === "NSW" || s === "ACT") return 11;
  if (meeting.tier === "Provincial") return 14;
  return 20;
}

export function sortMeetingsByMetroPriority(meetings: RaceMeeting[]): RaceMeeting[] {
  return [...meetings].sort((a, b) => {
    const scoreDiff = getMetroPriorityScore(a) - getMetroPriorityScore(b);
    if (scoreDiff !== 0) return scoreDiff;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.venue.localeCompare(b.venue);
  });
}

export function getSydneyAndMelbourneMeetings(meetings: RaceMeeting[]): {
  sydneyMeeting: RaceMeeting | null;
  melbourneMeeting: RaceMeeting | null;
  combinedRequiredMeetings: RaceMeeting[];
} {
  const sorted = sortMeetingsByMetroPriority(meetings);
  const sydneyMeeting =
    sorted.find(
      (m) =>
        m.state === "NSW" &&
        (m.venue.toLowerCase().includes("rosehill") ||
          m.venue.toLowerCase().includes("randwick") ||
          m.venue.toLowerCase().includes("warwick farm") ||
          m.venue.toLowerCase().includes("canterbury"))
    ) ||
    sorted.find((m) => m.state === "NSW" || m.state === "ACT") ||
    null;

  const melbourneMeeting =
    sorted.find(
      (m) =>
        m.state === "VIC" &&
        (m.venue.toLowerCase().includes("caulfield") ||
          m.venue.toLowerCase().includes("flemington") ||
          m.venue.toLowerCase().includes("moonee valley") ||
          m.venue.toLowerCase().includes("sandown"))
    ) ||
    sorted.find((m) => m.state === "VIC") ||
    null;

  const combinedRequiredMeetings: RaceMeeting[] = [];
  if (melbourneMeeting) combinedRequiredMeetings.push(melbourneMeeting);
  if (sydneyMeeting && sydneyMeeting.id !== melbourneMeeting?.id) {
    combinedRequiredMeetings.push(sydneyMeeting);
  }
  if (combinedRequiredMeetings.length === 0 && sorted.length > 0) {
    combinedRequiredMeetings.push(sorted[0]);
  }

  return { sydneyMeeting, melbourneMeeting, combinedRequiredMeetings };
}

export function isRaceOfficialOrCompleted(
  race: RaceEvent,
  meetingDate?: string
): boolean {
  const todayIso = getCurrentAustralianDateIso();
  if (meetingDate && meetingDate > todayIso) {
    return false;
  }
  const st = (race.status || "").trim().toLowerCase();
  const hasWinner = Array.isArray(race.runners) && race.runners.some((r) => Number(r.finishPosition) === 1);
  if (!hasWinner) return false;
  return (
    st === "final" ||
    st === "all clear" ||
    st === "official" ||
    st === "resulted" ||
    st === "interim"
  );
}

export function validateAndSanitizeMeetings(
  meetings: RaceMeeting[],
  startDate: string,
  endDate: string,
  venueFilter?: string
): RaceMeeting[] {
  const { startDate: cStart, endDate: cEnd } = clampDateRangeTo5Days(startDate, endDate);
  const vf = (venueFilter || "").trim().toLowerCase();

  const filtered = meetings.filter((m) => {
    if (!m || !m.date) return false;
    if (isDateBeyond5DaysAhead(m.date)) return false;
    if (m.date < cStart || m.date > cEnd) return false;
    if (vf && vf !== "all") {
      const mVenue = (m.venue || "").toLowerCase();
      const mState = (m.state || "").toLowerCase();
      if (!mVenue.includes(vf) && !vf.includes(mVenue) && mState !== vf) {
        return false;
      }
    }
    return true;
  });

  const sanitized = filtered.map((m) => {
    const races = (m.races || []).map((race) => {
      const raceCompleted = isRaceOfficialOrCompleted(race, m.date);
      const normalizedStatus: RaceEvent["status"] = raceCompleted
        ? race.status === "All Clear" || race.status === "Interim"
          ? race.status
          : "Final"
        : "Paying";

      const seenRunners = new Set<string>();
      const uniqueRunners: RaceRunner[] = [];
      for (const r of race.runners || []) {
        const key = (r.horseName || "").trim().toLowerCase();
        if (!key || seenRunners.has(key)) continue;
        seenRunners.add(key);
        uniqueRunners.push({
          ...r,
          finishPosition: raceCompleted ? r.finishPosition || 0 : 0,
          margin: raceCompleted ? r.margin || "-" : "-",
        });
      }

      return {
        ...race,
        status: normalizedStatus,
        winningTime: raceCompleted ? race.winningTime || "-" : "-",
        last600m: raceCompleted ? race.last600m || "-" : "-",
        exotics: raceCompleted ? race.exotics || [] : [],
        runners: uniqueRunners,
      };
    });

    const resolvedTrack = m.trackCondition || m.trackRating || "Good 4";
    return {
      ...m,
      trackCondition: resolvedTrack,
      trackRating: resolvedTrack,
      meetingCode: m.meetingCode || m.venue.slice(0, 4).toUpperCase(),
      races: races.sort((a, b) => a.raceNumber - b.raceNumber),
    };
  });

  return sortMeetingsByMetroPriority(sanitized);
}

export const SEED_MEETINGS: RaceMeeting[] = [
  ...SEED_CHUNK_0,
  ...SEED_CHUNK_1,
  ...SEED_CHUNK_2,
  ...SEED_CHUNK_3,
  ...SEED_CHUNK_4,
  ...SEED_CHUNK_5,
  ...SEED_CHUNK_6,
  ...SEED_CHUNK_7,
];"""

    ts_footer = """

export function getMeetingsForDateRange(
  startDate: string,
  endDate: string,
  venueFilter?: string
): RaceMeeting[] {
  return validateAndSanitizeMeetings(SEED_MEETINGS, startDate, endDate, venueFilter);
}

export function buildDateAccurateMeetings(
  dateIso: string,
  trackFilter?: string
): RaceMeeting[] {
  return getMeetingsForDateRange(dateIso, dateIso, trackFilter);
}

// ============================================================================
// DEFAULT PUNTER PROFILES (Steve F & Mark S — No Pre-Populated Selections)
// ============================================================================

export const DEFAULT_PUNTERS: PunterProfile[] = [
  {
    id: "punter-steve-f",
    name: "Steve F",
    role: "Form & Speed Map Analyst",
    selectionsByMeeting: {},
    jokerRaceByMeeting: {},
  },
  {
    id: "punter-mark-s",
    name: "Mark S",
    role: "Sectional & Value Punter",
    selectionsByMeeting: {},
    jokerRaceByMeeting: {},
  },
];

export const SEED_NSW_TAB_MEETINGS: RaceMeeting[] = SEED_MEETINGS;
export const INITIAL_PUNTERS: PunterProfile[] = DEFAULT_PUNTERS;
"""

    # Trim overly verbose syndicate owner & comment strings so every chunk is ~160 KB (total ZIP < 680 KB)
    for m in meetings:
        for r in m.get("races", []):
            for ru in r.get("runners", []):
                if isinstance(ru.get("owner"), str) and len(ru["owner"]) > 45:
                    ru["owner"] = ru["owner"][:42].rstrip(", ") + "..."
                if isinstance(ru.get("formComment"), str) and len(ru["formComment"]) > 90:
                    ru["formComment"] = ru["formComment"][:87].rstrip(", ") + "."
                if isinstance(ru.get("stewardsReport"), str) and len(ru["stewardsReport"]) > 65:
                    ru["stewardsReport"] = ru["stewardsReport"][:62].rstrip(", ") + "."

    os.makedirs("src/data/chunks", exist_ok=True)
    num_chunks = 8
    chunk_buckets = [[] for _ in range(num_chunks)]
    for idx, mtg in enumerate(meetings):
        chunk_buckets[idx % num_chunks].append(mtg)

    chunk_imports = []
    for c_idx, bucket in enumerate(chunk_buckets):
        c_path = f"src/data/chunks/seedChunk{c_idx}.ts"
        c_code = (
            'import type { RaceMeeting } from "../../types/racing.ts";\n'
            f"export const SEED_CHUNK_{c_idx}: RaceMeeting[] = "
            + json.dumps(bucket, separators=(",", ":"))
            + ";\n"
        )
        with open(c_path, "w", encoding="utf-8") as cf:
            cf.write(c_code)
        chunk_imports.append(f'import {{ SEED_CHUNK_{c_idx} }} from "./chunks/seedChunk{c_idx}.ts";')

    full_ts = "\n".join(chunk_imports) + "\n" + ts_header + ts_footer
    with open("src/data/seedNswTab.ts", "w", encoding="utf-8") as f:
        f.write(full_ts)

    total_races = sum(len(m["races"]) for m in meetings)
    total_runners = sum(len(r["runners"]) for m in meetings for r in m["races"])
    print(f"Wrote 8 chunks + src/data/seedNswTab.ts with {len(meetings)} real meetings, {total_races} real races, and {total_runners} real horses!")

if __name__ == "__main__":
    main()
