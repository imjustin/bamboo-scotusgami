# SCOTUSgami — Feature Ideas

## High Priority

- [ ] **Justice "Swing Score"** — For each justice, how often are they on the winning side of 5-4/6-3 decisions? Bar chart or timeline showing swing frequency per term. Who's the true swing vote in close cases?

- [ ] **Ideology Drift Timeline** — Plot each justice's agreement rate with the liberal bloc vs conservative bloc over time. Shows if anyone is migrating ideologically (e.g. Roberts drifting left).

- [ ] **Unusual Bedfellows** — Surface the most surprising pairings: cases where justices who rarely agree ended up on the same side. Rarity-ranked feed of unlikely agreements.

- [ ] **Case Outcome Patterns** — Scorigami-style grid where one axis is majority size (5,6,7,8,9) and the other is number of concurrences, colored by frequency. Shows which vote configurations are common vs rare.

- [ ] **Term-over-Term Comparison** — Side-by-side heatmaps or a delta heatmap showing which pairs got more/less aligned compared to last term. "Alito-Roberts agreement dropped 12% this term." *(Prototype built as Rate/Delta toggle on heatmap — removed because delta didn't accurately capture time period changes. Code preserved in git history. Needs rethinking: perhaps a separate panel or smarter term-pair selection logic.)*

## Medium Priority

- [ ] **Justice Influence Network** — Map who writes opinions that others join. Requires pipeline changes: add `majOpinWriter` from SCDB to schema, parse joiner data. Phase 1: add opinion authorship bar chart. Phase 2: directed influence graph. Phase 3: parse concurrence/dissent authorship from PDFs.

- [ ] **Dissent Frequency by Justice** — Who dissents most? Stacked bar per justice showing majority/concurrence/dissent splits. Track lone dissents specifically.

- [ ] **Unanimity Tracker** — What percentage of cases are unanimous per term? Is the court getting more or less divided over time? Simple line chart.

- [ ] **Coalition Stability** — For recurring coalitions, show a timeline of when they appeared. Are they clustering in recent terms or spread across years?

- [ ] **"Hot Streaks" Dashboard** — Current active streaks for all pairs, sortable. "Gorsuch and Kavanaugh have agreed on the last 14 cases" at a glance.

## Design

- [ ] **Visual design review & overhaul** — Review dashboard UI holistically: colors, layout, typography, responsiveness, overall look and feel. Identify what's working and what needs improvement, then redesign.

## Data Pipeline

- [ ] **Auto-fetch, validation & static export** — Streamline adding new cases: fetch → validate against Oyez/SCOTUSblog → pre-compute analytics in Python → export two static JSONs → push to public repo. See [auto-fetch-design.md](docs/auto-fetch-design.md) for full design.

## Bugs & Polish

- [x] **P0: Coalition tab-switch scroll race** — Clicking "X times" link dispatches `scotusgami-show-coalition` before tab is visible, so `scrollIntoView` no-ops. Add `requestAnimationFrame` before dispatch.
- [x] **P1: Top Coalitions missing from responsive CSS** — `panel-top-coalitions` not handled in `@media (max-width: 1200px)` or `768px` breakpoints. Panels overlap on narrow viewports.
- [x] **P1: Feed search ignores justice names** — Search only checks case name, not justice names or event headlines. Three-line fix to filter predicate in `feed.js`.
- [x] **P2: Hardcoded term years in dropdown** — "Current Term (2025)" in HTML goes stale next October. Dynamically set from `availableTermYears`.
- [x] **P2: Score vs Novelty label inconsistency** — Badge says "Score:", slider says "Min novelty:". Add tooltip and unify labels.
- [x] **P2: setTimeout(50) hack in coalitions-tab.js** — Replace with deterministic `scotusgami-indexes-ready` event from feed.js.
- [x] **P1: Duplicated utility functions** — `parseDate()` in feed.js and data-tab.js, `pairKey()` in feed.js and visualize.js, tab-switch pattern in 4 places. Extract to `utils.js`.
