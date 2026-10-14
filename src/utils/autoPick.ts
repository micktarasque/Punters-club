import { RaceRunner } from "../types/racing";

export type AutoPickStrategy =
  | "balanced"
  | "market-consensus"
  | "value-hunter"
  | "front-runner";

export interface AutoPickResult {
  firstPref: number | null;
  secondPref: number | null;
  thirdPref: number | null;
  favRunner: RaceRunner | null;
  randomRunnerA: RaceRunner | null;
  randomRunnerB: RaceRunner | null;
  pickedRunners: RaceRunner[];
  summaryText: string;
  strategyUsed?: AutoPickStrategy;
}

/**
 * Generates an Auto Pick trio according to syndicate strategy:
 * - "balanced" (Default TAB syndicate): Selects at least 1 top-3 favourite + 2 other runners randomly.
 * - "market-consensus": Top 3 favourites by market odds (1st -> 2nd -> 3rd).
 * - "value-hunter": Selects contenders in the $3.50–$12.00 sweet spot with firming support.
 * - "front-runner": Prioritizes low barrier, on-pace leaders with winning credentials.
 */
export function generateRaceAutoPickTrio(
  runners: RaceRunner[],
  raceNumber?: number,
  strategy: AutoPickStrategy = "balanced"
): AutoPickResult {
  const liveRunners = runners.filter((r) => !r.isScratched);

  if (liveRunners.length === 0) {
    return {
      firstPref: null,
      secondPref: null,
      thirdPref: null,
      favRunner: null,
      randomRunnerA: null,
      randomRunnerB: null,
      pickedRunners: [],
      summaryText: "No live runners available in race.",
      strategyUsed: strategy,
    };
  }

  // Handle races with 3 or fewer live runners
  if (liveRunners.length <= 3) {
    const shuffled = [...liveRunners].sort(() => Math.random() - 0.5);
    return {
      firstPref: shuffled[0]?.tabNumber ?? null,
      secondPref: shuffled[1]?.tabNumber ?? null,
      thirdPref: shuffled[2]?.tabNumber ?? null,
      favRunner: shuffled[0] ?? null,
      randomRunnerA: shuffled[1] ?? null,
      randomRunnerB: shuffled[2] ?? null,
      pickedRunners: shuffled,
      summaryText: `Assigned all ${liveRunners.length} live runners.`,
      strategyUsed: strategy,
    };
  }

  // Helper to extract numeric odds
  const getOdds = (r: RaceRunner): number =>
    Number(r.nswTabWin) || Number(r.fixedWin) || 999;

  // Sort live runners by odds ascending
  const sortedByOdds = [...liveRunners].sort((a, b) => getOdds(a) - getOdds(b));
  const prefix = raceNumber ? `R${raceNumber}: ` : "";

  // 1. Market Consensus Strategy
  if (strategy === "market-consensus") {
    const top3 = sortedByOdds.slice(0, 3);
    return {
      firstPref: top3[0].tabNumber,
      secondPref: top3[1].tabNumber,
      thirdPref: top3[2].tabNumber,
      favRunner: top3[0],
      randomRunnerA: top3[1],
      randomRunnerB: top3[2],
      pickedRunners: top3,
      summaryText: `${prefix}Market Consensus — 1st Fav #${top3[0].tabNumber} ($${getOdds(top3[0]).toFixed(2)}), 2nd Fav #${top3[1].tabNumber} ($${getOdds(top3[1]).toFixed(2)}), 3rd Fav #${top3[2].tabNumber} ($${getOdds(top3[2]).toFixed(2)})`,
      strategyUsed: strategy,
    };
  }

  // 2. Value Hunter Strategy ($3.50 to $12.00 sweet spot, or firming)
  if (strategy === "value-hunter") {
    const valueContenders = sortedByOdds.filter((r) => {
      const odds = getOdds(r);
      return (odds >= 3.2 && odds <= 12.0) || r.marketSupport === "Firming";
    });

    const pool = valueContenders.length >= 3 ? valueContenders : sortedByOdds;
    const shuffledPool = [...pool].sort(() => Math.random() - 0.5);
    const trio = shuffledPool.slice(0, 3).sort((a, b) => getOdds(a) - getOdds(b));

    return {
      firstPref: trio[0].tabNumber,
      secondPref: trio[1].tabNumber,
      thirdPref: trio[2].tabNumber,
      favRunner: trio[0],
      randomRunnerA: trio[1],
      randomRunnerB: trio[2],
      pickedRunners: trio,
      summaryText: `${prefix}Value Hunter — #${trio[0].tabNumber} ${trio[0].horseName} ($${getOdds(trio[0]).toFixed(2)}), #${trio[1].tabNumber} ($${getOdds(trio[1]).toFixed(2)}), #${trio[2].tabNumber} ($${getOdds(trio[2]).toFixed(2)})`,
      strategyUsed: strategy,
    };
  }

  // 3. Front Runner Bias Strategy (Low barrier / Pace / Speed profile)
  if (strategy === "front-runner") {
    const onPaceContenders = [...liveRunners].sort((a, b) => {
      const barrierA = a.barrier || 10;
      const barrierB = b.barrier || 10;
      const oddsA = getOdds(a);
      const oddsB = getOdds(b);
      // Score based on lower barrier + reasonable odds
      const scoreA = barrierA * 0.4 + oddsA * 0.6;
      const scoreB = barrierB * 0.4 + oddsB * 0.6;
      return scoreA - scoreB;
    });

    const trio = onPaceContenders.slice(0, 3);
    return {
      firstPref: trio[0].tabNumber,
      secondPref: trio[1].tabNumber,
      thirdPref: trio[2].tabNumber,
      favRunner: trio[0],
      randomRunnerA: trio[1],
      randomRunnerB: trio[2],
      pickedRunners: trio,
      summaryText: `${prefix}Front Runner Bias — Low Barrier #${trio[0].tabNumber} ${trio[0].horseName} (B${trio[0].barrier}) + #${trio[1].tabNumber} (B${trio[1].barrier}) & #${trio[2].tabNumber} (B${trio[2].barrier})`,
      strategyUsed: strategy,
    };
  }

  // 4. Balanced Strategy (Default TAB syndicate)
  const top3Favourites = sortedByOdds.slice(0, 3);
  const randomFavIdx = Math.floor(Math.random() * top3Favourites.length);
  const selectedFav = top3Favourites[randomFavIdx];

  const remainingField = liveRunners.filter(
    (r) => r.tabNumber !== selectedFav.tabNumber
  );
  const shuffledRemaining = [...remainingField].sort(() => Math.random() - 0.5);
  const otherTwo = shuffledRemaining.slice(0, 2);

  const pickedRunners = [selectedFav, otherTwo[0], otherTwo[1]];
  const finalOrder = [...pickedRunners].sort(() => Math.random() - 0.5);

  const favOdds = getOdds(selectedFav).toFixed(2);
  const summaryText = `${prefix}Fav #${selectedFav.tabNumber} ${selectedFav.horseName} ($${favOdds}) + #${otherTwo[0].tabNumber} ${otherTwo[0].horseName} & #${otherTwo[1].tabNumber} ${otherTwo[1].horseName}`;

  return {
    firstPref: finalOrder[0].tabNumber,
    secondPref: finalOrder[1].tabNumber,
    thirdPref: finalOrder[2].tabNumber,
    favRunner: selectedFav,
    randomRunnerA: otherTwo[0],
    randomRunnerB: otherTwo[1],
    pickedRunners: finalOrder,
    summaryText,
    strategyUsed: strategy,
  };
}
