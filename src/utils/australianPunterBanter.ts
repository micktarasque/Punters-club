import { PunterProfile, RaceMeeting, RaceEvent } from "../types/racing";

export interface SyndicateAward {
  title: string;
  emoji: string;
  recipientName: string;
  badge: string;
  description: string;
  statHighlight: string;
  beerFundImpact?: string;
}

export interface AussieBanterBundle {
  raceCallSnippet: string;
  tracksideRoast: string;
  punterBanter: string;
  beerFundStatus: {
    pintsFunded: number;
    statusText: string;
    headline: string;
  };
  awards: SyndicateAward[];
}

const AUSSIE_WINNER_CALLS = [
  "Sprouted wings over the final 100m and bolted in like a runaway steam train!",
  "Gave them windburn down the outside rail—an absolute peach of a steer!",
  "Took the bookies straight to the cleaners and paid like an international phone number!",
  "Sat three-wide with plenty of petrol in the tank, exploded at the 200m and said see ya later!",
  "Slid up along the paint, showed a savage turn of foot, and put them away in two strides!",
];

const AUSSIE_LOOSER_CALLS = [
  "Got trapped four-wide without cover and ran like a hairy goat down the straight.",
  "Turned into a statue at the top of the rise—left the punters scratching their heads.",
  "Looked like it was carrying an anvil across the line; back to the trials for that one.",
  "Fell into a hole deeper than the Sydney Harbour tunnel after leading up to the turn.",
  "Gave honest effort but had all the acceleration of a loaded wheelbarrow on wet turf.",
];

const PUNTER_ROASTS = [
  (name: string, horse: string) =>
    `${name} was strutting around the members bar like Lord Mayor after locking in ${horse}.`,
  (name: string, horse: string) =>
    `Call the authorities! ${name}'s tip on ${horse} has officially funded the syndicate's weekend refreshments.`,
  (name: string, horse: string) =>
    `${name} claims he had inside mail on ${horse}, but honestly we think his dog walked across the form guide.`,
  (name: string, horse: string) =>
    `Commiserations to ${name}—backed ${horse} into favoritism only to watch it run like it was towing a caravan.`,
  (name: string, horse: string) =>
    `${name} was counting his winnings at the 300m mark before reality and the post arrived at the same time.`,
];

/**
 * Generates an authentic trackside Aussie racing commentary snippet
 */
export function generateAussieRaceCall(
  horseName: string,
  isWinner: boolean,
  odds: number
): string {
  if (isWinner) {
    const call =
      AUSSIE_WINNER_CALLS[
        Math.floor(Math.random() * AUSSIE_WINNER_CALLS.length)
      ];
    return `🏇 #${horseName} ($${odds.toFixed(2)}) ${call}`;
  }
  const call =
    AUSSIE_LOOSER_CALLS[
      Math.floor(Math.random() * AUSSIE_LOOSER_CALLS.length)
    ];
  return `⚠️ #${horseName} ($${odds.toFixed(2)}) ${call}`;
}

/**
 * Calculates syndicate awards: Golden Whip, Wooden Stirrup, Tactical Maestro, and Beer Fund
 */
export function calculateSyndicateAwards(
  punters: PunterProfile[],
  meeting?: RaceMeeting,
  totalNetProfit = 42.5
): SyndicateAward[] {
  if (!punters || punters.length === 0) {
    return [];
  }

  // Find punter with highest selections or highest score
  const sortedPunters = [...punters].sort((a, b) => {
    const aCount = Object.keys(a.selectionsByMeeting || {}).length;
    const bCount = Object.keys(b.selectionsByMeeting || {}).length;
    return bCount - aCount;
  });

  const topPunter = sortedPunters[0] || punters[0];
  const secondPunter = sortedPunters[1] || punters[0];

  const awards: SyndicateAward[] = [
    {
      title: "The Golden Whip",
      emoji: "🏆",
      recipientName: topPunter.name,
      badge: "PUNTER OF THE DAY",
      description: `Steered the syndicate with sharp conviction. Nailed the key consensus anchors with ruthless efficiency.`,
      statHighlight: "Sharp Strike Rate · Consensus MVP",
      beerFundImpact: "+4 Pints Banked",
    },
    {
      title: "The Wooden Stirrup",
      emoji: "🪵",
      recipientName: secondPunter.name,
      badge: "UNLUCKY DONKEY",
      description: `Backed the biggest drifter in the field into a headwind. Better luck in the maiden handicaps next week, mate!`,
      statHighlight: "Most Heartbreaking Photofinish",
      beerFundImpact: "Shouting the Next Round",
    },
    {
      title: "The Tactical Maestro",
      emoji: "🎯",
      recipientName: "Syndicate Algorithmic Trio",
      badge: "EXOTICS ANCHOR",
      description: `Harville-Plackett-Luce model extracted maximum value edge, boxing the overlays to protect against roughie ambushes.`,
      statHighlight: "Trifecta Box Protected",
      beerFundImpact: "Flexi Dividend Maximized",
    },
  ];

  return awards;
}

/**
 * Calculates the current syndicate beer fund count ($8 per trackside pint)
 */
export function calculateBeerFund(netProfitDollars: number) {
  const pintCost = 8.5;
  const pints = Math.max(0, Math.floor(netProfitDollars / pintCost));

  if (pints >= 10) {
    return {
      pintsFunded: pints,
      statusText: "🍻 SHOUT FOR THE WHOLE SYNDICATE",
      headline: `The Beer Fund is roaring with ${pints} cold trackside pints locked in!`,
    };
  }
  if (pints >= 4) {
    return {
      pintsFunded: pints,
      statusText: "🍺 SOLID ROUND IN THE CART",
      headline: `${pints} pints safely funded—the bookmakers are buying lunch!`,
    };
  }
  if (pints > 0) {
    return {
      pintsFunded: pints,
      statusText: "🥂 TASTE ON THE BOARD",
      headline: `${pints} cold one in credit. Keep backing the overlays!`,
    };
  }
  return {
    pintsFunded: 0,
    statusText: "🪙 JOKER POT PURGATORY",
    headline: "Beer fund running dry—need a solid Trifecta hit in the next leg!",
  };
}

/**
 * Builds the complete Aussie Banter bundle for race trends or report sheets
 */
export function generateAussieBanterBundle(
  meetingVenue: string,
  raceNumber: number,
  favoriteName: string,
  favOdds: number,
  valueName: string,
  valueOdds: number,
  punters: PunterProfile[]
): AussieBanterBundle {
  const roastTemplate =
    PUNTER_ROASTS[Math.floor(Math.random() * PUNTER_ROASTS.length)];
  const punterName = punters[0]?.name || "Stevie F";
  const tracksideRoast = roastTemplate(punterName, favoriteName);

  return {
    raceCallSnippet: `Trackside at ${meetingVenue} R${raceNumber}: #${favoriteName} ($${favOdds.toFixed(
      2
    )}) looks primed to jump and run, but keep your eyes on #${valueName} ($${valueOdds.toFixed(
      2
    )}) coming with a wet sail!`,
    tracksideRoast,
    punterBanter: `G'day punters! The turf is fast, the beer is chilled, and the market is ripe for the taking. Time to load up the quaddie and leave the bookies crying into their ledgers.`,
    beerFundStatus: calculateBeerFund(38.5),
    awards: calculateSyndicateAwards(punters),
  };
}
