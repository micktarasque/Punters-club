# Apple Theme Color Calibration, 4-Month Retention & Cross-Device Persistence

A targeted upgrade to ensure all tables, D3 graphs, and Recharts analytics visualizers cleanly adapt to the Apple Minimalist theme (white cards, light gridlines, Apple blue accents), enforces a strict 4-month (120-day) data retention lifecycle for user-participated race cards while pruning unpicked races, and establishes resilient dual-sync across local storage, cloud API, and Firestore for seamless multi-device access.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Based on your confirmed choices:
> - **Theme Styling**: Clean white cards, light gridlines (`#E5E5EA`), dark text (`#1D1D1F`), and Apple blue (`#0071E3`) accents across all tables, runner sheets, D3 charts, Recharts equity streams, and exotics visualizers.
> - **Retention Lifecycle**: Automatically retain user-participated race cards and archived reports for **4 months (120 days)** while automatically pruning unpicked races and expired history.
> - **Cross-Device Sync & Resilience**: Real-time dual sync to both local storage (instant offline accessibility) and cloud storage/Firestore on every selection edit, ensuring any device accessing the site sees the exact same updated results.

---

### 1. Proposed Changes & Component Architecture

#### A. Comprehensive Apple Minimalist Theme Synchronization for Tables & Graphs

Currently, `isApple` is maintained in `App.tsx` but is missing or omitted in several downstream reporting and table components (`RaceReportSheet`, `AllUsersSelectionsResults`, `TanStackVirtualRunnersTable`, `InteractiveRunnerTelemetry`, `PunterHeadToHeadDuel`, `TabDividendFlexiCalculator`, and `BklitReportVisualizer`). Because SVG attributes (`stroke`, `fill`) ignore CSS class overrides, charts in `DynamicReportVisualizations` were defaulting to dark turf green/gold.

1. **Propagate `isApple` Context & Props**:
   - Update `RaceReportSheetProps` in `src/components/RaceReportSheet.tsx` to accept `isApple?: boolean` and thread it from `src/App.tsx`.
   - Pass `isApple={isApple}` to `DynamicReportVisualizations`, `InteractiveRunnerTelemetry`, `PunterHeadToHeadDuel`, `TabDividendFlexiCalculator`, `BklitReportVisualizer`, `SyndicateSuccessTrendD3Chart`, `PunterRoiD3BarChart`, and the 2x2 summary graphs (Graphs A, B, C, D).
   - Pass `isApple={isApple}` to `RaceCardAndFormSheet` and `TanStackVirtualRunnersTable`.
   - Pass `isApple={isApple}` to `AllUsersSelectionsResults`, `CombinedTrifectaTracker`, and `CombinedQuaddieTracker`.

2. **Calibrate Chart Colors & Themes in `DynamicReportVisualizations`**:
   - **Cumulative Equity AreaChart**: In Apple mode, set container to white card (`#FFFFFF`), CartesianGrid stroke to `#E5E5EA`, X/Y axis font color to `#8E8E93`, and Return curve stroke/gradient to Apple Blue (`#0071E3`) / `#0077ED`.
   - **Punter Accuracy Heatmap**: Clean white table header (`#F5F5F7`), light borders (`#E5E5EA`), dark text (`#1D1D1F`), and Apple blue/green strike-rate badges.
   - **Track Bias RadarChart**: PolarGrid stroke `#E5E5EA`, PolarAngleAxis text `#1D1D1F`, PolarRadiusAxis `#8E8E93`, Radar stroke & fill `#0071E3` with `fillOpacity={0.25}`.
   - **Exotics Funnel**: Clean white card background, light border `#E5E5EA`, Apple Blue leg coverage bars.

3. **Calibrate D3 Charts (`SyndicateSuccessTrendD3Chart` & `PunterRoiD3BarChart`)**:
   - Detect `isApple` and set SVG canvas backgrounds to clean white/transparent, axis lines and tick labels to `#8E8E93`, gridlines to `#E5E5EA`, tooltips to white shadow cards, and primary bars/curves to `#0071E3` (Apple blue) and `#34C759` (Apple green).

4. **Calibrate High-Density Tables & Form Guides**:
   - `TanStackVirtualRunnersTable`: Set table header `<thead>` and row styles to adapt dynamically: clean white rows (`hover:bg-[#F2F2F7]`), light border dividers (`#E5E5EA`), Apple blue 1st/2nd/3rd preference badges when selected.
   - `AllUsersSelectionsResults`: Adapt all-punter comparison table and race-by-race scorecard to clean Apple card styling when `isApple` is true.

---

#### B. 4-Month Active Participation Data Retention (120 Days)

1. **Define Unified Retention Constant**:
   - In `src/utils/raceReportArchive.ts`, introduce `FOUR_MONTHS_RETENTION_MS = 120 * 24 * 60 * 60 * 1000` (120 days) and update storage keys to `turfsheet_completed_participated_reports_4m_v1`.
2. **Update Punter Selections Pruning in `src/App.tsx`**:
   - Rename and calibrate `enforceFourMonthActiveParticipationRetention`:
     - Retains all meetings where the user actively participated (at least one selection placed) within the last 120 days.
     - Prunes unpicked/empty race cards and meetings older than 120 days.
3. **Update Server-Side Archive in `server.ts`**:
   - Update `writeFourMonthReportsArchive` to enforce the 120-day cutoff (`retentionDays: 120`) and prune unparticipated reports.

---

#### C. Real-Time Dual Sync & Cross-Device Resilience

1. **Instant Dual Storage on Edit**:
   - Every time a punter changes a selection, assigns preferences (1st/2nd/3rd), or toggles a Joker, immediately write to `localStorage` (instant local resilience) and trigger debounced cloud push (`saveSharedCloudPunters` and Firestore `setDoc`).
2. **Cross-Device Report Sync**:
   - In `RaceReportSheet.tsx`, ensure generated and archived reports are synced to `/api/reports` so any mobile device, tablet, or desktop opening the site loads the exact same archived reports and standings.
3. **Resilient Offline Fallback**:
   - When offline or switching networks, data remains safely cached locally; once reconnected, background sync merges selections seamlessly using per-race timestamp resolution (`incTime >= baseTime`).

---

### 2. Verification & Testing Plan

1. **Theme Verification**:
   - Toggle theme to **Apple Minimalist**:
     - Verify Overview tab runner table and form guide use white backgrounds, light borders (`#E5E5EA`), dark text (`#1D1D1F`), and Apple blue highlights.
     - Open Results tab -> Report -> Graphical Data Analysis: verify Recharts equity curve, heatmap, radar, and exotics funnel render with Apple blue curves, white surfaces, and light gridlines.
     - Verify D3 syndicate success and punter ROI bar charts render with Apple theme colors.
   - Toggle back to **Turf Dark**:
     - Verify all charts and tables smoothly switch back to emerald green, racing gold (`#D4AF37`), and deep turf black (`#070B09`).
2. **Retention Verification**:
   - Verify selections within 120 days with active picks are retained; verify simulated cards >120 days old or empty cards are pruned.
3. **Sync Verification**:
   - Test making a selection, verifying immediate persistence to localStorage and successful cloud dispatch to `/api/punters`.
4. **Build Verification**:
   - Run `compile_applet` and `lint_applet` to ensure zero compilation or type errors.
