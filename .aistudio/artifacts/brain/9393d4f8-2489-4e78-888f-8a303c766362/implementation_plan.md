# Syndicate Selection Module Redesign & Content Simplification

Streamlines the TurfSheet NSW TAB syndicate platform by replacing visual clutter and cumbersome selection dropdowns with a focused, progressive-disclosure runner card interface, persistent selection dock, and syndicate intelligence tools.

> [!IMPORTANT]
> **Confirmed Direction: All 5 Simplification Proposals & 3 Polish Features**
> - **Unified Quick-Select & Progressive Disclosure**: Replaces crowded dropdown menus and wide multi-column tables with tactile 1st/2nd/3rd runner preference chips and an "Essential" view by default.
> - **Sticky Syndicate Selection Dock**: Persistent floating HUD at screen bottom displaying the active race trio, Joker Round multiplier status, and meeting completion progress.
> - **Race Carousel / Stepper Header**: Quick navigation allowing punters to focus on one race at a time with auto-advance, alongside a toggle for full-card overview.
> - **Syndicate Consensus & Clash Indicator**: Real-time visual comparison highlighting where Steve F and Mark S agree (Consensus Play) versus where they split (Syndicate Clash).
> - **Smart Strategy Auto-Picks**: Replaces purely random selection with 3 high-utility syndicate strategies: Market Consensus, Value Hunter ($4–$9), and Front Runner Bias.
> - **Tactile Odds Fluc Glow & Micro-Feedback**: Lightweight animated heat indicator for firming/drifting odds paired with snappy micro-interactions.

---

### 1. Overview & Core Concept

- **What It Does**: Transforms the betting selection process into a fast, informative, and visual workflow. Instead of wading through massive tables with duplicate metrics or fiddling with tiny dropdown menus, syndicate members can rapidly inspect runner form, tap 1st/2nd/3rd preference chips, review team consensus, and lock in selections in seconds.
- **Target Persona**: Syndicate members (Steve F & Mark S) and punters who want fast, clear racing intelligence on iPad Pro, mobile, or desktop without sensory overload or laggy tables.
- **Key Value**: Drastically reduces cognitive load and tap count while elevating tactical clarity through instant syndicate alignment cues and strategy presets.

---

### 2. User Experience & Visual Design

#### A. Layout & Progressive Disclosure Rhythm
- **Top Control Strip**: Meeting venue tabs (`NSW Randwick`, `VIC Caulfield`) and race number stepper bar (`R1` through `R10`) with live completion checkmarks.
- **Race Header & Feature Spotlight**: Clean, unboxed metadata (`1400m · Good 4 · Rail +3m · Prize $160,000`) with high-contrast Feature Race and Joker Round badges.
- **Essential Runner Cards (Default)**:
  - Runner number and barrier circle.
  - Horse name, jockey, trainer, weight, and speed map icon (Lead / Pace / Mid / Back).
  - TAB Live Win and Place odds with tactile fluc arrow and subtle heat pulse (emerald on firm, amber on drift).
  - Inline **1st (Gold)**, **2nd (Silver)**, and **3rd (Bronze)** preference chips that toggle instantly.
  - Syndicate pick indicator avatar chips showing Steve's and Mark's picks on the runner.
- **Deep Analysis Drawer (On-Demand)**:
  - Collapsible per-race drawer for Harville Plackett-Luce win probabilities and full speed-map lane trajectories.
  - Keeps 90% of screen height clean for rapid decision making while preserving deep telemetry for data-driven punters.

#### B. Sticky Selection HUD (Persistent Dock)
- Anchored at bottom of viewport (`max-h-[64px]`, strictly adhering to mobile sticky budgets < 15%).
- Displays active race picks (`1st: #3 Imperial Force`, `2nd: #1 King of Roseau`, `3rd: #7 Private Harry`).
- Single-tap `🃏 Play Joker (2×)` toggle.
- Clear status bar (`6/8 Races Locked`) with 1-click `Next Race →` stepper.

#### C. Color Palette & Typography
- **Canvas (60%)**: Deep racing turf green (`#0B110E`, `#0E1813`).
- **Structural Surfaces (30%)**: Muted dark slate cards (`#121A16`, hairline borders `#1F2D26`).
- **Accents (10%)**:
  - Syndicate Gold (`#D4AF37`) for 1st Preference & Joker Round.
  - Clean Silver/White (`#F3F4F0`) for 2nd Preference.
  - Emerald Green (`#10B981`) for 3rd Preference, firming flucs, and official payouts.
- **Typography**: Tabular monospace numerals (`font-mono tabular-nums`) for odds, dividends, and barrier numbers; crisp sans typography for horse and jockey names. Zero pill-sandwich cliches.

---

### 3. Key Product Decisions & Trade-Offs

1. **Quick-Pick Chips vs. Native `<select>` Dropdowns**
   - *Chosen Approach*: Direct 1-tap preference chips directly on each runner card.
   - *Why*: Eliminates awkward multi-step dropdown interaction where users have to remember horse numbers and parse truncated dropdown option strings.
   - *Trade-Off*: Requires clear handling when swapping an existing preference (e.g., picking a new 1st horse automatically bumps or clears the previous 1st horse).

2. **Race-by-Race Focused Stepper with "All Races" Toggle**
   - *Chosen Approach*: Default to focused single-race stepper with quick-jump pills, with a toggle switch to show the unified multi-race card view.
   - *Why*: Reduces DOM node count by over 70%, completely resolving mobile/iPad scrolling friction while keeping the full-day overview accessible.

3. **Syndicate Consensus & Clash Engine**
   - *Chosen Approach*: Compute alignment in real-time from `punters.selectionsByMeeting`. If Steve F and Mark S share the same 1st preference, mark as "🔥 Syndicate Consensus (High Conviction)". If their top picks differ, mark "⚔️ Syndicate Clash".
   - *Why*: Directly enhances syndicate engagement and discussion without requiring external chat.

---

### 4. Technical Architecture & Component Mapping

```
┌────────────────────────────────────────────────────────────────────────┐
│                         App.tsx (State Store)                          │
│  - punters: PunterProfile[] (Steve F, Mark S + custom)                 │
│  - activeMeeting / activeRaceNumber / scoringMode                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┴───────────────────────────┐
       ▼                                                        ▼
┌──────────────────────────────────────┐     ┌───────────────────────────────────┐
│     BettingLedgerSheet.tsx           │     │    RaceCardAndFormSheet.tsx       │
│  - Stepper Header (R1 - RN)          │     │  - Unified Runners Grid           │
│  - Quick-Pick Runner Cards           │     │  - Deep Form & Odds Flucs         │
│  - Syndicate Consensus Indicators    │     │  - Harville Win Probability       │
│  - Smart Strategy Auto-Pick Bar      │     └───────────────────────────────────┘
└──────────────────┬───────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 StickySyndicateDock.tsx (New Component)                │
│  - Active Trio Summary (1st · 2nd · 3rd)                               │
│  - Joker Round (2x) Toggle                                             │
│  - Quick Advance & Cloud Sync Status                                   │
└────────────────────────────────────────────────────────────────────────┘
```

#### State & Event Handlers
- `onUpdateRaceSelection(punterId, meetingId, raceNumber, rank, tabNumber)`: Seamlessly updates preferences, preventing duplicate assignments within the same trio.
- `onApplySmartStrategy(strategy: 'consensus' | 'value' | 'speed')`: Computes deterministic selections using current odds, market flucs, and speed map data.
- `onToggleJokerRace(punterId, meetingId, raceNumber)`: Fast toggle with haptic/toast visual feedback.
