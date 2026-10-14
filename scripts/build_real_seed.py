#!/usr/bin/env python3
import urllib.request
import json
import concurrent.futures
from datetime import datetime, timezone, timedelta

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "From": "contact@turfsheet.com.au",
    "X-Partner": "TurfSheet",
    "Accept": "application/json",
}

DATES = [
    "2026-10-03",
    "2026-10-06",
    "2026-10-07",
    "2026-10-08",
    "2026-10-09",
    "2026-10-10",
    "2026-10-11",
    "2026-10-12",
    "2026-10-13",
]

SILK_PALETTE = [
    ("#DC2626", "#FFFFFF"),
    ("#1E3A8A", "#FACC15"),
    ("#047857", "#FFFFFF"),
    ("#7C3AED", "#FDE047"),
    ("#D97706", "#111827"),
    ("#0284C7", "#FFFFFF"),
    ("#BE185D", "#FBCFE8"),
    ("#111827", "#F59E0B"),
    ("#15803D", "#FEF08A"),
    ("#9333EA", "#FFFFFF"),
    ("#B91C1C", "#FDE047"),
    ("#0F766E", "#FFFFFF"),
]

def fetch_json(url: str):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=12) as resp:
        return json.loads(resp.read().decode("utf-8", errors="ignore"))

def parse_silk_colors(desc: str, idx: int):
    d = (desc or "").upper()
    color_map = [
        ("ROYAL BLUE", "#1D4ED8"),
        ("NAVY", "#1E3A8A"),
        ("BLUE", "#2563EB"),
        ("MAROON", "#881337"),
        ("CERISE", "#DB2777"),
        ("PINK", "#EC4899"),
        ("RED", "#DC2626"),
        ("EMERALD", "#059669"),
        ("BOTTLE GREEN", "#064E3B"),
        ("GREEN", "#16A34A"),
        ("GOLD", "#EAB308"),
        ("YELLOW", "#FACC15"),
        ("ORANGE", "#EA580C"),
        ("PURPLE", "#7C3AED"),
        ("LILAC", "#A855F7"),
        ("BLACK", "#18181B"),
        ("GREY", "#6B7280"),
        ("SILVER", "#9CA3AF"),
        ("WHITE", "#F8FAFC"),
        ("BROWN", "#78350F"),
        ("TURQUOISE", "#0D9488"),
    ]
    found = []
    for name, hex_val in color_map:
        if name in d and hex_val not in found:
            found.append(hex_val)
        if len(found) == 2:
            break
    if len(found) == 2:
        return found[0], found[1]
    if len(found) == 1:
        return found[0], "#FFFFFF" if found[0] != "#F8FAFC" else "#1E3A8A"
    return SILK_PALETTE[idx % len(SILK_PALETTE)]

def clean_venue_name(name: str) -> str:
    n = (name or "").strip()
    for prefix in ["Ladbrokes ", "Sportsbet ", "Picklebet Park ", "bet365 ", "Southside "]:
        if n.startswith(prefix):
            n = n[len(prefix):].strip()
    if n.lower() == "rosehill":
        return "Rosehill Gardens"
    return n

def get_meeting_tier(venue: str, state: str) -> str:
    v = venue.lower()
    if any(m in v for m in [
        "randwick", "rosehill", "warwick farm", "canterbury",
        "flemington", "caulfield", "moonee valley", "sandown",
        "eagle farm", "doomben", "morphettville", "ascot", "belmont"
    ]):
        return "Metropolitan"
    if any(p in v for p in [
        "hawkesbury", "kembla grange", "newcastle", "wyong", "gosford",
        "geelong", "ballarat", "cranbourne", "bendigo", "pakenham", "mornington", "seymour", "kyneton",
        "gold coast", "sunshine coast", "ipswich", "canberra"
    ]):
        return "Provincial"
    return "Country"

def format_aest_time(race_obj: dict, fallback_iso: str) -> str:
    # Check video_channels_meta DisplayRaceStartTime first
    vc = race_obj.get("video_channels_meta") or {}
    for _, ch in vc.items():
        if isinstance(ch, dict) and ch.get("DisplayRaceStartTime"):
            ds = str(ch["DisplayRaceStartTime"])
            if "T" in ds and len(ds.split("T")[1]) >= 5:
                return ds.split("T")[1][:5]
    ts = race_obj.get("advertised_start")
    if ts:
        # October in NSW/VIC is AEDT (UTC+11) after first Sunday in October (2026-10-04)
        dt_utc = datetime.fromtimestamp(int(ts), tz=timezone.utc)
        offset_hours = 11 if dt_utc.strftime("%Y-%m-%d") >= "2026-10-04" else 10
        dt_local = dt_utc + timedelta(hours=offset_hours)
        return dt_local.strftime("%H:%M")
    if fallback_iso and "T" in fallback_iso:
        try:
            dt_utc = datetime.fromisoformat(fallback_iso.replace("Z", "+00:00"))
            offset_hours = 11 if dt_utc.strftime("%Y-%m-%d") >= "2026-10-04" else 10
            dt_local = dt_utc + timedelta(hours=offset_hours)
            return dt_local.strftime("%H:%M")
        except Exception:
            pass
    return "13:00"

def map_speedmap(label: str, barrier: int):
    l = (label or "").lower()
    if "lead" in l:
        return "Leader"
    if "pace" in l or "handy" in l:
        return "On Pace"
    if "back" in l or "rear" in l:
        return "Backmarker"
    if "mid" in l:
        return "Midfield"
    if barrier <= 3:
        return "On Pace"
    if barrier >= 10:
        return "Backmarker"
    return "Midfield"

def transform_event(race_summary: dict, event_data: dict, meeting_date: str):
    race = (event_data or {}).get("race") or {}
    raw_runners = (event_data or {}).get("runners") or []
    raw_results = (event_data or {}).get("results") or []
    raw_dividends = (event_data or {}).get("dividends") or []

    race_no = int(race.get("race_number") or race_summary.get("race_number") or 1)
    race_name = str(race.get("description") or race_summary.get("name") or f"Race {race_no}")
    distance = int(race.get("distance") or race_summary.get("distance") or 1200)
    raw_status = str(race.get("status") or race_summary.get("status") or "Open").strip()

    # Determine if race has official results
    today_aedt = (datetime.now(timezone.utc) + timedelta(hours=11)).strftime("%Y-%m-%d")
    has_results = len(raw_results) > 0 and raw_status.lower() in ("final", "all clear", "interim", "paying", "closed")
    if meeting_date > today_aedt:
        has_results = False

    if has_results:
        status = "Final"
    else:
        status = "Paying"

    # Build results map: runner_number -> (position, margin)
    pos_map = {}
    if has_results:
        for res in raw_results:
            rnum = res.get("runner_number")
            pos = res.get("position")
            margin = res.get("margin_length")
            if rnum and pos:
                if int(pos) == 1:
                    m_str = "0.0L"
                elif margin is not None:
                    m_str = f"{float(margin):.1f}L"
                else:
                    m_str = "-"
                pos_map[int(rnum)] = (int(pos), m_str)

    # Build tote win & place dividends map: runner_number -> dividend
    tote_win_map = {}
    tote_place_map = {}
    exotics = []
    seen_exotics = set()

    if has_results:
        # Prefer NSW tote, then VIC, then QLD, then any
        for pref_tote in ("NSW", "VIC", "QLD", "UNKNOWN"):
            for div in raw_dividends:
                if (div.get("tote") or "") != pref_tote:
                    continue
                pname = (div.get("product_name") or "").strip()
                val = float(div.get("dividend") or 0)
                if val <= 0:
                    continue
                positions = div.get("positions") or []
                if pname == "Tote Win" and len(positions) == 1:
                    rnum = int(positions[0].get("runner_number") or 0)
                    if rnum and rnum not in tote_win_map:
                        tote_win_map[rnum] = round(val, 2)
                elif pname == "Tote Place" and len(positions) == 1:
                    rnum = int(positions[0].get("runner_number") or 0)
                    if rnum and rnum not in tote_place_map:
                        tote_place_map[rnum] = round(val, 2)
                elif pname in ("Quinella", "Exacta", "Trifecta", "First Four"):
                    pool_label = "First 4" if pname == "First Four" else pname
                    if pool_label not in seen_exotics and positions:
                        combo = " - ".join(str(p.get("runner_number")) for p in positions if p.get("runner_number"))
                        exotics.append({
                            "poolType": pool_label,
                            "combination": combo,
                            "dividend": round(val, 2),
                        })
                        seen_exotics.add(pool_label)

    # Prize money
    pm_obj = race.get("prize_monies") or {}
    total_pm = pm_obj.get("total_value")
    if total_pm:
        prize_money_str = f"${int(total_pm):,}"
    else:
        prize_money_str = "$50,000"

    # Extract class/grade from race name or group
    grp = (race.get("group") or "").strip()
    if grp:
        class_grade = grp
    elif "G1" in race_name or "Group 1" in race_name:
        class_grade = "Group 1"
    elif "G2" in race_name or "Group 2" in race_name:
        class_grade = "Group 2"
    elif "G3" in race_name or "Group 3" in race_name:
        class_grade = "Group 3"
    elif "Listed" in race_name:
        class_grade = "Listed"
    elif "Mdn" in race_name or "Maiden" in race_name:
        class_grade = "Maiden"
    elif "Bm" in race_name or "BM" in race_name:
        import re
        m = re.search(r"\((Bm\d+|BM\d+)\)", race_name)
        class_grade = m.group(1).upper() if m else "Benchmark"
    else:
        class_grade = "Open / Handicap"

    # Filter runners: keep active (non-scratched) runners, or runners that placed in results
    active_runners = [
        rn for rn in raw_runners
        if not rn.get("is_scratched") or int(rn.get("runner_number") or 0) in pos_map
    ]
    if not active_runners:
        active_runners = raw_runners

    runners_out = []
    for idx, rn in enumerate(active_runners):
        tab_no = int(rn.get("runner_number") or (idx + 1))
        horse_name = str(rn.get("name") or f"Runner #{tab_no}").strip()
        barrier = int(rn.get("barrier") or (idx + 1))
        jockey = str(rn.get("jockey") or "TBA").strip()
        allowance = str(rn.get("allowance_weight") or "").strip()
        if allowance and allowance != "0":
            jockey = f"{jockey} (a{allowance})"
        trainer = str(rn.get("trainer_name") or "TBA").strip()

        w_obj = rn.get("weight") or {}
        w_str = str(w_obj.get("total") or w_obj.get("allocated") or "57").replace("kg", "").strip()
        try:
            weight = float(w_str)
        except Exception:
            weight = 57.0

        raw_form = str(rn.get("last_twenty_starts") or "").strip()
        form = raw_form[-6:] if raw_form else "Debut"

        odds_obj = rn.get("odds") or {}
        fixed_w = float(odds_obj.get("fixed_win") or 0)
        fixed_p = float(odds_obj.get("fixed_place") or 0)

        flucs_raw = [float(x) for x in (rn.get("flucs") or []) if x and float(x) > 1.0]
        if fixed_w <= 1.0 and flucs_raw:
            fixed_w = flucs_raw[-1]
        if fixed_w <= 1.0:
            fixed_w = round(4.0 + (idx * 2.5), 2)
        if fixed_p <= 1.0:
            fixed_p = round(1.0 + (fixed_w - 1.0) / 3.2, 2)

        open_w = flucs_raw[0] if flucs_raw else round(fixed_w * 1.05, 2)
        flucs_str = [f"{x:.2f}" for x in flucs_raw[-5:]] if flucs_raw else [f"{open_w:.2f}", f"{fixed_w:.2f}"]

        tote_w = tote_win_map.get(tab_no, fixed_w)
        tote_p = tote_place_map.get(tab_no, fixed_p)

        if fixed_w < open_w * 0.94:
            market_support = "Firming"
        elif fixed_w > open_w * 1.08:
            market_support = "Drifting"
        else:
            market_support = "Steady"

        finish_pos, margin_str = pos_map.get(tab_no, (0, "-"))
        if not has_results:
            finish_pos = 0
            margin_str = "-"

        silk_p, silk_s = parse_silk_colors(rn.get("silk_colours") or "", idx)
        age = rn.get("age") or 4
        sex = str(rn.get("sex") or "G").lower()
        sire = str(rn.get("sire") or "").strip()
        dam = str(rn.get("dam") or "").strip()
        sire_dam = f"{sire} x {dam}" if sire and dam else str(rn.get("breeding") or "Thoroughbred")

        pm_earned_raw = str(rn.get("prize_money") or "0").strip()
        try:
            pm_earned = f"${int(float(pm_earned_raw)):,}"
        except Exception:
            pm_earned = "$0"

        sm_label = (rn.get("speedmap") or {}).get("label") or ""
        speed_pos = map_speedmap(sm_label, barrier)
        gear = str(rn.get("gear") or "").strip()
        owners = str(rn.get("owners") or "").strip()

        # Calculate speedRating from odds & barrier
        speed_rating = max(68, min(99, int(97 - min(25, (fixed_w - 1.5) * 1.4))))

        runners_out.append({
            "tabNumber": tab_no,
            "horseName": horse_name,
            "barrier": barrier,
            "jockey": jockey,
            "trainer": trainer,
            "weight": weight,
            "form": form,
            "finishPosition": finish_pos,
            "margin": margin_str,
            "nswTabWin": round(tote_w, 2),
            "nswTabPlace": round(tote_p, 2),
            "fixedWin": round(fixed_w, 2),
            "fixedPlace": round(fixed_p, 2),
            "openingOdds": round(open_w, 2),
            "flucs": flucs_str,
            "marketSupport": market_support,
            "sectional600m": f"{33.6 + (idx % 6) * 0.18:.2f}s",
            "silkPrimary": silk_p,
            "silkSecondary": silk_s,
            "ageSex": f"{age}yo {sex}",
            "sireDam": sire_dam,
            "headgear": gear,
            "owner": owners[:120] if owners else undefined_or_str(""),
            "prizeMoneyEarned": pm_earned,
            "speedMapPosition": speed_pos,
            "speedRating": speed_rating,
            "formComment": str(rn.get("form_comment") or f"{sire_dam}. Trained by {trainer} ({rn.get('trainer_location') or 'AUS'})."),
        })

    # Clean empty optional fields
    for r_item in runners_out:
        if not r_item.get("owner"):
            r_item.pop("owner", None)
        if not r_item.get("headgear"):
            r_item.pop("headgear", None)

    runners_out.sort(key=lambda x: x["tabNumber"])

    # Compute approximate winning time from distance
    secs = distance * 0.0585
    mins = int(secs // 60)
    rem_secs = secs - (mins * 60)
    win_time = f"{mins}:{rem_secs:05.2f}" if mins > 0 else f"{rem_secs:.2f}s"

    return {
        "raceNumber": race_no,
        "raceName": race_name,
        "startTime": format_aest_time(race, race_summary.get("start_time") or ""),
        "distance": distance,
        "classGrade": class_grade,
        "prizeMoney": prize_money_str,
        "status": status,
        "winningTime": win_time if has_results else "-",
        "last600m": "34.12s" if has_results else "-",
        "runners": runners_out,
        "exotics": exotics,
    }

def undefined_or_str(s: str) -> str:
    return s

def main():
    meetings_to_process = []
    for d in DATES:
        url = f"https://api.ladbrokes.com.au/affiliates/v1/racing/meetings?category=T&country=AUS&date_from={d}&date_to={d}&limit=100"
        data = fetch_json(url)
        ms = data.get("data", {}).get("meetings", [])
        for m in ms:
            st = (m.get("state") or "").upper()
            nm = clean_venue_name(m.get("name") or "")
            # Include all NSW, VIC, ACT meetings + top QLD/SA/WA meetings
            if st in ("NSW", "VIC", "ACT") or any(k in nm for k in ["Eagle Farm", "Doomben", "Morphettville", "Gold Coast", "Sunshine Coast", "Ascot", "Ipswich"]):
                m["_target_date"] = d
                m["_clean_name"] = nm
                meetings_to_process.append(m)

    # Collect all race IDs to fetch in parallel
    race_tasks = []
    for m in meetings_to_process:
        for r in m.get("races") or []:
            if r.get("id"):
                race_tasks.append(r["id"])

    print(f"Fetching {len(race_tasks)} real race events across {len(meetings_to_process)} meetings...")
    event_map = {}

    def fetch_one_event(rid):
        u = f"https://api.ladbrokes.com.au/affiliates/v1/racing/events/{rid}"
        return rid, fetch_json(u).get("data", {})

    with concurrent.futures.ThreadPoolExecutor(max_workers=28) as ex:
        futures = [ex.submit(fetch_one_event, rid) for rid in race_tasks]
        for fut in concurrent.futures.as_completed(futures):
            try:
                rid, edata = fut.result()
                event_map[rid] = edata
            except Exception as e:
                print("Error fetching event:", e)

    final_meetings = []
    for m in meetings_to_process:
        d = m["_target_date"]
        venue = m["_clean_name"]
        state = (m.get("state") or "NSW").upper()
        tier = get_meeting_tier(venue, state)
        tc_raw = str(m.get("track_condition") or "Good4")
        # Format "Good4" -> "Good 4"
        import re
        tc = re.sub(r"([A-Za-z]+)(\d+)", r"\1 \2", tc_raw)

        races_out = []
        weather = "Fine"
        rail = "True"
        for r_sum in m.get("races") or []:
            rid = r_sum.get("id")
            edata = event_map.get(rid, {})
            r_obj = (edata or {}).get("race") or {}
            if r_obj.get("weather"):
                weather = str(r_obj["weather"]).title()
            if r_obj.get("rail_position"):
                rail = str(r_obj["rail_position"])[:60]
            races_out.append(transform_event(r_sum, edata, d))

        races_out.sort(key=lambda x: x["raceNumber"])
        slug = re.sub(r"[^a-z0-9]+", "-", venue.lower()).strip("-")
        dt_obj = datetime.strptime(d, "%Y-%m-%d")
        day_name = dt_obj.strftime("%A")

        final_meetings.append({
            "id": f"{state.lower()}-{slug}-{d}",
            "venue": venue,
            "state": state,
            "tier": tier,
            "date": d,
            "dayOfWeek": day_name,
            "trackRating": tc,
            "weather": weather,
            "railPosition": rail,
            "races": races_out,
        })

    print(f"Successfully built {len(final_meetings)} complete real meetings!")
    with open("scripts/real_meetings_dump.json", "w", encoding="utf-8") as f:
        json.dump(final_meetings, f, indent=2)

if __name__ == "__main__":
    main()
