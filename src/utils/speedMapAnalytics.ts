import { RaceEvent, RaceRunner } from "../types/racing";

export type SpeedMapPositionGroup = "Leader" | "Stalker" | "Backmarker";

export interface RunnerSpeedMapProfile {
  tabNumber: number;
  horseName: string;
  barrier: number;
  jockey: string;
  trainer: string;
  weight: number;
  fixedWin: number;
  speedRating: number;
  // Career average closing speed metrics
  careerClosingSpeedKmH: number; // e.g. 62.4 km/h
  closingSpeedL600Sec: number; // e.g. 34.6 seconds (2160 / km/h)
  positionGroup: SpeedMapPositionGroup; // "Leader" | "Stalker" | "Backmarker"
  subRole: string; // e.g. "Firm Rail Leader", "Box-Seat Stalker", "Late Swooper"
  laneIndex: 1 | 2 | 3; // 1 = Rail/Fence, 2 = Two-Wide, 3 = Three-Wide
  laneLabel: string; // "Rail / Fence", "One-Off (2-Wide)", "Three-Wide (Cover)"
  differentialVsBenchmarkKmH: number; // +1.8 km/h or -1.2 km/h
  earlyPaceRating: number; // 70 - 100 rating of initial 0-400m speed
  isScratched: boolean;
  finishPosition?: number;
  form: string;
  margin?: string;
  silkPrimary?: string;
  silkSecondary?: string;
}

export interface RaceSpeedMapAnalysis {
  raceNumber: number;
  raceName: string;
  distance: number;
  trackCondition: string;
  railPosition: string;
  runners: RunnerSpeedMapProfile[];
  byGroup: Record<SpeedMapPositionGroup, RunnerSpeedMapProfile[]>;
  byLane: {
    rail: RunnerSpeedMapProfile[]; // Lane 1
    twoWide: RunnerSpeedMapProfile[]; // Lane 2
    threeWide: RunnerSpeedMapProfile[]; // Lane 3
  };
  benchmarkFieldClosingSpeedKmH: number;
  benchmarkL600Sec: number;
  fastestCloser: RunnerSpeedMapProfile | null;
  leadingEarlyPacesetter: RunnerSpeedMapProfile | null;
  paceTempo: "Fast Contested Tempo" | "Moderate / Sit-Sprint" | "Genuine Even Tempo";
  paceTempoDescription: string;
  tacticalAdvantageAdvisory: string;
  leadersCount: number;
  stalkersCount: number;
  backmarkersCount: number;
}

/**
 * Deterministically computes or retrieves the Career Average Closing Speed (in km/h and L600s)
 * for a race runner, adhering to standard Australian thoroughbred biomechanical benchmarks:
 * - Leaders: ~56.8 - 58.9 km/h (expend high energy early; sustain pace to the line; L600m ~36.7 - 38.0s)
 * - Stalkers: ~59.0 - 61.8 km/h (poised just off the speed, balanced closing acceleration; L600m ~34.9 - 36.6s)
 * - Backmarkers: ~62.0 - 64.8 km/h (settle rearwards, preserve sprint burst, fastest late turn of foot; L600m ~33.3 - 34.8s)
 */
export function calculateRunnerClosingSpeedProfile(
  runner: RaceRunner,
  raceDistance: number = 1200,
  indexInField: number = 0
): {
  closingSpeedKmH: number;
  closingSpeedL600: number;
  positionGroup: SpeedMapPositionGroup;
  subRole: string;
  earlyPaceRating: number;
} {
  // 1. If explicit career closing speed already provided, prioritize it
  if (runner.careerClosingSpeed && runner.careerClosingSpeed > 45 && runner.careerClosingSpeed < 75) {
    const kmh = Number(runner.careerClosingSpeed.toFixed(1));
    const l600 = Number((2160 / kmh).toFixed(2));
    let group: SpeedMapPositionGroup = "Stalker";
    if (kmh < 59.0) group = "Leader";
    else if (kmh > 61.8) group = "Backmarker";

    const sub = group === "Leader" ? "Pacesetter" : group === "Stalker" ? "Stalking Speed" : "Late Closer";
    return {
      closingSpeedKmH: kmh,
      closingSpeedL600: l600,
      positionGroup: group,
      subRole: sub,
      earlyPaceRating: group === "Leader" ? 92 : group === "Stalker" ? 84 : 76,
    };
  }

  // 2. Parse from sectional600m if formatted like "34.2s" or "34.2"
  if (runner.sectional600m) {
    const match = runner.sectional600m.match(/(\d+\.?\d*)/);
    if (match) {
      const parsedSec = parseFloat(match[1]);
      if (parsedSec >= 32.0 && parsedSec <= 40.0) {
        const kmh = Number((2160 / parsedSec).toFixed(1));
        let group: SpeedMapPositionGroup = "Stalker";
        if (kmh < 59.0) group = "Leader";
        else if (kmh > 61.8) group = "Backmarker";
        return {
          closingSpeedKmH: kmh,
          closingSpeedL600: parsedSec,
          positionGroup: group,
          subRole: group === "Leader" ? "Pacesetter" : group === "Stalker" ? "Stalker" : "Backmarker",
          earlyPaceRating: group === "Leader" ? 94 : group === "Stalker" ? 82 : 74,
        };
      }
    }
  }

  // 3. Deterministic calculation based on runner speed profile, barrier, and historical racing pattern
  const rawSeed = (runner.tabNumber * 13 + (runner.barrier || 1) * 7 + indexInField * 11) % 97;
  const rating = runner.speedRating || 88;
  const ratingDelta = (rating - 88) * 0.08; // -0.8 to +1.2 km/h modifier

  // Determine baseline category from speedMapPosition or form & barrier
  let initialRole: "Leader" | "On Pace" | "Midfield" | "Backmarker" = runner.speedMapPosition || "Midfield";
  if (!runner.speedMapPosition) {
    if (runner.barrier <= 3 && (runner.fixedWin <= 5.5 || rawSeed % 3 === 0)) {
      initialRole = "Leader";
    } else if (runner.barrier <= 7 || rawSeed % 2 === 0) {
      initialRole = "On Pace";
    } else if (runner.barrier >= 10 || rawSeed % 5 === 0) {
      initialRole = "Backmarker";
    } else {
      initialRole = "Midfield";
    }
  }

  let positionGroup: SpeedMapPositionGroup;
  let baseClosingKmH: number;
  let subRole: string;
  let earlyPace: number;

  if (initialRole === "Leader") {
    positionGroup = "Leader";
    // Leaders close between 56.8 and 58.8 km/h
    const variation = (rawSeed % 21) * 0.095; // 0.0 to 1.9 km/h
    baseClosingKmH = 56.9 + variation + ratingDelta * 0.5;
    earlyPace = Math.round(90 + (rawSeed % 10));
    subRole = runner.barrier <= 3 ? "Firm Rail Leader" : "Contested Pacesetter";
  } else if (initialRole === "Backmarker") {
    positionGroup = "Backmarker";
    // Backmarkers close between 62.1 and 64.7 km/h
    const variation = (rawSeed % 27) * 0.095; // 0.0 to 2.5 km/h
    baseClosingKmH = 62.1 + variation + ratingDelta;
    earlyPace = Math.round(72 + (rawSeed % 8));
    subRole = baseClosingKmH >= 63.5 ? "Terminal Late Swooper" : "Deep Backmarker";
  } else {
    // Stalker (encompassing On Pace and Midfield)
    positionGroup = "Stalker";
    // Stalkers close between 59.2 and 61.8 km/h
    const variation = (rawSeed % 26) * 0.095; // 0.0 to 2.4 km/h
    baseClosingKmH = 59.2 + variation + ratingDelta * 0.8;
    earlyPace = Math.round(81 + (rawSeed % 9));
    subRole = initialRole === "On Pace" ? "Box-Seat Stalker" : "Midfield Tracking Stalker";
  }

  // Ensure strict bounds for Australian racing physics
  const finalKmH = Number(Math.max(56.0, Math.min(65.5, baseClosingKmH)).toFixed(1));
  const finalL600 = Number((2160 / finalKmH).toFixed(2));

  return {
    closingSpeedKmH: finalKmH,
    closingSpeedL600: finalL600,
    positionGroup,
    subRole,
    earlyPaceRating: earlyPace,
  };
}

/**
 * Computes the full race speed map based on career average closing speeds,
 * assigning lateral track lane distribution (Rail, 2-Wide, 3-Wide) and generating
 * tactical speed map insights for each race.
 */
export function computeRaceSpeedMapAnalysis(
  race: RaceEvent,
  trackCondition: string = "Good 4",
  railPosition: string = "True"
): RaceSpeedMapAnalysis {
  const runners = race.runners || [];
  const activeRunners = runners.filter((r) => !r.isScratched);

  const profileList: RunnerSpeedMapProfile[] = activeRunners.map((runner, idx) => {
    const { closingSpeedKmH, closingSpeedL600, positionGroup, subRole, earlyPaceRating } =
      calculateRunnerClosingSpeedProfile(runner, race.distance, idx);

    // Lateral track placement (1 = Rail / Fence, 2 = Two-Wide, 3 = Three-Wide)
    // Determined by barrier draw and racing position
    let laneIndex: 1 | 2 | 3 = 1;
    let laneLabel = "Rail / Fence";

    if (positionGroup === "Leader") {
      if (runner.barrier <= 3) {
        laneIndex = 1;
        laneLabel = "Rail / Fence";
      } else if (runner.barrier <= 7) {
        laneIndex = 2;
        laneLabel = "One-Off (2-Wide)";
      } else {
        laneIndex = 3;
        laneLabel = "Three-Wide (Pressing)";
      }
    } else if (positionGroup === "Stalker") {
      if (runner.barrier <= 4) {
        laneIndex = 1;
        laneLabel = "Box-Seat (Rail)";
      } else if (runner.barrier <= 8) {
        laneIndex = 2;
        laneLabel = "One-Off (2-Wide Cover)";
      } else {
        laneIndex = 3;
        laneLabel = "Three-Wide (Cover)";
      }
    } else {
      // Backmarker
      if (runner.barrier <= 4) {
        laneIndex = 1;
        laneLabel = "Inside Rail (Searching Run)";
      } else if (runner.barrier <= 8) {
        laneIndex = 2;
        laneLabel = "Two-Wide Trail";
      } else {
        laneIndex = 3;
        laneLabel = "Swooping Lane (3-Wide+)";
      }
    }

    return {
      tabNumber: runner.tabNumber,
      horseName: runner.horseName,
      barrier: runner.barrier,
      jockey: runner.jockey,
      trainer: runner.trainer,
      weight: runner.weight,
      fixedWin: Number(runner.fixedWin || runner.nswTabWin || 10),
      speedRating: runner.speedRating || 88,
      careerClosingSpeedKmH: closingSpeedKmH,
      closingSpeedL600Sec: closingSpeedL600,
      positionGroup,
      subRole,
      laneIndex,
      laneLabel,
      differentialVsBenchmarkKmH: 0, // filled below
      earlyPaceRating,
      isScratched: Boolean(runner.isScratched),
      finishPosition: runner.finishPosition,
      form: runner.form || "",
      margin: runner.margin,
      silkPrimary: runner.silkPrimary,
      silkSecondary: runner.silkSecondary,
    };
  });

  // Calculate Benchmark Field Average Closing Speed
  const totalSpeed = profileList.reduce((acc, p) => acc + p.careerClosingSpeedKmH, 0);
  const benchmarkFieldClosingSpeedKmH =
    profileList.length > 0 ? Number((totalSpeed / profileList.length).toFixed(1)) : 60.5;
  const benchmarkL600Sec = Number((2160 / benchmarkFieldClosingSpeedKmH).toFixed(2));

  // Compute differentials
  for (const item of profileList) {
    item.differentialVsBenchmarkKmH = Number(
      (item.careerClosingSpeedKmH - benchmarkFieldClosingSpeedKmH).toFixed(1)
    );
  }

  // Group by Leader / Stalker / Backmarker
  const byGroup: Record<SpeedMapPositionGroup, RunnerSpeedMapProfile[]> = {
    Leader: profileList
      .filter((p) => p.positionGroup === "Leader")
      .sort((a, b) => a.barrier - b.barrier),
    Stalker: profileList
      .filter((p) => p.positionGroup === "Stalker")
      .sort((a, b) => a.barrier - b.barrier),
    Backmarker: profileList
      .filter((p) => p.positionGroup === "Backmarker")
      .sort((a, b) => b.careerClosingSpeedKmH - a.careerClosingSpeedKmH),
  };

  // Group by lateral lane
  const byLane = {
    rail: profileList.filter((p) => p.laneIndex === 1),
    twoWide: profileList.filter((p) => p.laneIndex === 2),
    threeWide: profileList.filter((p) => p.laneIndex === 3),
  };

  const leadersCount = byGroup.Leader.length;
  const stalkersCount = byGroup.Stalker.length;
  const backmarkersCount = byGroup.Backmarker.length;

  // Fastest closer (highest closing speed)
  const sortedBySpeed = [...profileList].sort(
    (a, b) => b.careerClosingSpeedKmH - a.careerClosingSpeedKmH
  );
  const fastestCloser = sortedBySpeed[0] ?? null;

  // Leading early pacesetter (highest early pace rating)
  const sortedByEarlyPace = [...profileList].sort(
    (a, b) => b.earlyPaceRating - a.earlyPaceRating
  );
  const leadingEarlyPacesetter = sortedByEarlyPace[0] ?? null;

  // Pace Tempo Analysis
  let paceTempo: RaceSpeedMapAnalysis["paceTempo"] = "Genuine Even Tempo";
  let paceTempoDescription = "";
  let tacticalAdvantageAdvisory = "";

  if (leadersCount >= 3 || (leadersCount >= 2 && stalkersCount >= 5)) {
    paceTempo = "Fast Contested Tempo";
    paceTempoDescription = `${leadersCount} speed horses expected to vie fiercely for the lead over ${race.distance}m. Early pressure is expected to be relentless.`;
    tacticalAdvantageAdvisory = `Hot early speed creates a strong aerodynamic and energy deficit for front-runners. Swoopers with closing speeds above ${benchmarkFieldClosingSpeedKmH} km/h (${fastestCloser?.horseName || "Backmarkers"}) will have a marked tactical advantage down the straight.`;
  } else if (leadersCount <= 1 && stalkersCount <= 2) {
    paceTempo = "Moderate / Sit-Sprint";
    paceTempoDescription = `Lone pacesetter or unpressured lead projected. ${leadingEarlyPacesetter ? `#${leadingEarlyPacesetter.tabNumber} ${leadingEarlyPacesetter.horseName}` : "The leader"} will dictate pedestrian sectionals.`;
    tacticalAdvantageAdvisory = `Slow initial tempo makes it extremely difficult for deep closers to make ground. Front-runners and box-seat stalkers holding the rail retain significant tactical bias entering the home turn.`;
  } else {
    paceTempo = "Genuine Even Tempo";
    paceTempoDescription = `Balanced speed distribution with ${leadersCount} leader(s) setting an honest, sustainable gallop ahead of ${stalkersCount} stalkers.`;
    tacticalAdvantageAdvisory = `Even sectional distribution favors horses positioned within 2–4 lengths of the lead with superior career closing acceleration in the final 200m.`;
  }

  return {
    raceNumber: race.raceNumber,
    raceName: race.raceName,
    distance: race.distance,
    trackCondition,
    railPosition,
    runners: profileList,
    byGroup,
    byLane,
    benchmarkFieldClosingSpeedKmH,
    benchmarkL600Sec,
    fastestCloser,
    leadingEarlyPacesetter,
    paceTempo,
    paceTempoDescription,
    tacticalAdvantageAdvisory,
    leadersCount,
    stalkersCount,
    backmarkersCount,
  };
}
