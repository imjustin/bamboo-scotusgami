# SCOTUSgami

## What is SCOTUSgami?

SCOTUSgami tracks how often U.S. Supreme Court justices agree with each other — case by case, term by term, across the entire Roberts Court era (2005–present).

The name is a play on "scorigami," a concept popularized by Jon Bois for tracking genuinely novel score combinations in NFL games. In the same spirit, SCOTUSgami highlights when a pair of justices produces a voting pattern that has never occurred before — a first-time agreement between ideological opposites, a surprising streak of disagreement between allies, or an unusual coalition that defies conventional left-right expectations.

Unlike most SCOTUS trackers that focus on case outcomes or individual justice voting records, SCOTUSgami is built around pairwise relationships. Every cell in the heatmap represents one justice-to-justice relationship, measured across every case they both participated in. This makes it easy to spot shifting alliances, emerging blocs, and unexpected partnerships that raw vote tallies miss.

The dashboard covers every argued case from October Term 2005 through the current term, encompassing all 16 justices who have served on the Roberts Court.

## Disclaimer

This data has not been manually audited and is subject to potential inaccuracies. Vote classifications are sourced from the Supreme Court Database (SCDB) and automated PDF parsing, neither of which have been individually verified against official court records. This dashboard is an exploratory visualization project and should not be relied upon for legal research, academic citation, or anything other than late night vibes.

## How to Read the Dashboard

### Heatmap

- A 9×9 grid of current justices, with each cell showing the pairwise agreement rate as a percentage.
- Color encodes agreement: red indicates low agreement (~45%), yellow is mid-range (~65%), and green is high agreement (~85%).
- Click any cell to select that pair and load its detail in the side panel. Multi-select is supported — click additional cells to compare pairs.
- The diagonal is blank because a justice cannot agree or disagree with themselves.
- The number in each cell is the percentage of co-participated cases where both justices voted on the same side (majority or dissent).

### Network Graph

- A force-directed layout where justices that agree more frequently are pulled closer together.
- Edge thickness corresponds to agreement strength — thicker lines mean higher agreement rates.
- Drag individual nodes to rearrange the layout manually.
- Zoom in and out with the +/– buttons in the corner, or use the scroll wheel.
- Pan the view by clicking and dragging the background.
- Natural clusters that emerge reveal ideological blocs — you will typically see conservative-leaning justices grouped on one side and liberal-leaning justices on the other, with swing justices positioned between them.

### Timeline

- Displays the rolling cumulative agreement percentage over time for selected justice pairs.
- Green dots indicate cases where the pair agreed; red dots indicate disagreement.
- Use the term filter dropdown to zoom into specific time ranges.
- When multiple pairs are selected, each is shown in a different color for comparison.

### Feed Tab

- A reverse-chronological feed of notable voting events detected by the scoring algorithm.
- SCOTUSgami events — genuinely novel coalition patterns — are highlighted with a gold accent border.
- Use the filter buttons to narrow by event type (e.g., first agreement, streak, sole dissenter).
- The novelty score slider lets you set a minimum threshold to hide routine events and focus on the most surprising ones.

## Scoring Rubric

Each voting event is assigned a novelty score from 0 to 100. Events scoring 80 or above are flagged as SCOTUSgami — headline-worthy moments. The full rubric:

| Event | Base Score | Boosted When |
|-------|-----------|--------------|
| New coalition (vote split scorigami) | 50–95 | Close splits (5-4) score higher; cross-wing majority adds +15 |
| Coalition count | 5–40 | Shows how many times this exact majority makeup has occurred |
| Bloc defection | 55–65 | Higher for 5-4 splits than 6-3 |
| First agreement (cross-wing) | 75 | SCOTUSgami if cross-wing |
| First agreement (same-wing) | 30 | Lower score — expected pairing |
| First disagreement (same-wing) | 70 | SCOTUSgami if same-wing |
| First disagreement (cross-wing) | 25 | Lower score — expected pairing |
| Sole dissenter pair (cross-wing) | 85 | Always SCOTUSgami |
| Sole dissenter pair (same-wing) | 50 | — |
| Sole dissenter | 35–70 | Higher if first time for that justice |
| Unusual coalition (3+ cross-wing dissent) | 80 | SCOTUSgami if novel grouping |
| Agreement streak (5+/10/15/20+) | 55–95 | Cross-wing pairs fire at 5; same-wing at 10 |
| Disagreement streak (3/5/8/10) | 50–85 | Scales with streak length |
| Streak broken | 30–75 | Higher for longer streaks that ended |
| Rate milestone (90%/75%/60%/50%) | 30–75 | Multiple thresholds tracked |
| Rate reversal | 35–65 | Fires when trend direction flips after 3%+ swing |
| Unanimous (9-0) | 5–60 | First of term scores 45–60; subsequent 5–15 |

### Score Tiers

| Range | Tier | Meaning |
|-------|------|---------|
| 80–100 | Headline SCOTUSgami | A genuinely novel or rare coalition pattern |
| 50–79 | Notable | Worth paying attention to |
| 25–49 | Interesting | Mildly unusual but not shocking |
| Below 25 | Routine | Expected voting behavior |

### Ideological Groupings

**Conservative-leaning:** Roberts, Thomas, Alito, Gorsuch, Kavanaugh, Barrett

**Liberal-leaning:** Sotomayor, Kagan, Jackson

These groupings are used solely for scoring purposes — to determine whether an agreement or disagreement crosses ideological lines, which makes it more or less surprising.

## Agreement Definition

**Same Side (outcome-based):** Justices are on the same side if they reach the same outcome. Majority and all forms of concurrence are treated as one side; only dissent is the opposite side.

This outcome-based approach means a justice who concurs in the judgment only is counted as agreeing with a justice who joined the full majority opinion. This prioritizes agreement on outcome over agreement on reasoning.

A stricter "Agreed" metric — requiring an exact vote-type match (e.g., both must be majority joiners, not one majority and one concurrence) — is computed and stored in the database but is not currently displayed in the dashboard.

Because of the outcome-based approach, agreement rates may be slightly inflated for pairs where one justice frequently concurs in judgment only rather than joining the majority opinion outright.

## Data Sources

### Primary: Supreme Court Database (SCDB)

- Maintained by Washington University in St. Louis (Harold Spaeth, Lee Epstein, et al.).
- The gold standard for empirical Supreme Court research, used in hundreds of published studies.
- Covers October Terms 2005–2023 with granular vote codes for every justice on every case.
- Each case is coded with 60+ variables per justice-vote, including vote type, opinion assignment, issue area, and disposition.
- Vote codes: 1 = majority opinion, 2 = dissent, 3 = regular concurrence, 4 = concurrence in judgment, 5 = concurrence in part and dissent in part, 6 = dissent in part, 7 = jurisdictional dissent, 8 = non-participation.

### Supplementary: supremecourt.gov PDF Scraping

- Used for OT2024 and OT2025 where SCDB data is not yet available.
- Slip opinion PDFs are downloaded directly from supremecourt.gov.
- Vote blocks are extracted using PyMuPDF and parsed via regex pattern matching.
- Less reliable than SCDB for edge cases — unusual opinion formatting or complex partial concurrences may be miscoded.

### Data Validation

- Vote splits have been cross-referenced against Wikipedia, SCOTUSblog, and official published opinions for 6 landmark cases.
- All vote splits were confirmed accurate against these sources.
- Known discrepancies exist across sources for partial concurrences — see the Limitations section below.

## All 16 Roberts Court Justices

### Current Bench (2025)

- John Roberts (Chief Justice, 2005–present) — Appointed by G.W. Bush
- Clarence Thomas (1991–present) — Appointed by G.H.W. Bush
- Samuel Alito (2006–present) — Appointed by G.W. Bush
- Sonia Sotomayor (2009–present) — Appointed by Obama
- Elena Kagan (2010–present) — Appointed by Obama
- Neil Gorsuch (2017–present) — Appointed by Trump
- Brett Kavanaugh (2018–present) — Appointed by Trump
- Amy Coney Barrett (2020–present) — Appointed by Trump
- Ketanji Brown Jackson (2022–present) — Appointed by Biden

### Former Justices (During Roberts Court)

- Sandra Day O'Connor (1981–2006) — Appointed by Reagan
- David Souter (1990–2009) — Appointed by G.H.W. Bush
- John Paul Stevens (1975–2010) — Appointed by Ford
- Antonin Scalia (1986–2016) — Appointed by Reagan
- Anthony Kennedy (1988–2018) — Appointed by Reagan
- Ruth Bader Ginsburg (1993–2020) — Appointed by Clinton
- Stephen Breyer (1994–2022) — Appointed by Clinton

## Methodology

- Per curiam opinions (unsigned, issued by the Court as a whole) are currently excluded from analysis due to unreliable vote attribution.
- Cases with fewer than 2 participating justices are excluded.
- Agreement pairs are only computed for justices who both participated in the same case — recusals and non-participation reduce pair sample sizes.
- Historical data (October Terms 2005–2023) is sourced from the Supreme Court Database; OT2024 and OT2025 data comes from PDF scraping of slip opinions.
- Concurrence in part / dissent in part is coded as a concurrence (majority-side) for agreement calculation purposes.
- All vote data is normalized into a binary same-side / opposite-side classification before agreement rates are computed.

## Limitations & Caveats

- Vote coding for partial concurrences varies across sources. For example, Dobbs v. Jackson Women's Health Organization can be coded as 5-4 or 6-3 depending on whether Roberts' concurrence in the judgment is counted as majority-side.
- The PDF parser for current-term cases may miss unusual opinion formatting or fail to extract vote blocks from non-standard layouts.
- Small sample sizes for newer justices affect reliability: Jackson has participated in roughly 130 cases compared to Thomas's approximately 1,080 cases during the Roberts Court era.
- Per curiam opinions are excluded entirely from the analysis.
- Cases without a clear majority/dissent structure (plurality decisions) are coded based on which side prevailed in the judgment.
- Recusals reduce the sample size for affected justice pairs and can skew agreement rates for pairs with frequent recusals.
- The ideological groupings used for scoring are simplified and static — they do not account for shifts in a justice's jurisprudence over time.
- Concurrence classification: Justices who joined the majority opinion AND wrote a separate concurring opinion may be classified as 'concurrence' rather than 'majority' in the vote breakdown. This is an artifact of the SCDB data source, which classifies by opinion authorship. It does not affect agreement calculations, since our 'same side' metric treats majority and concurrence votes as being on the same side. However, the individual vote type labels in the Data tab may show some majority-side justices under 'Concurrence' if they authored or joined a separate concurring opinion.

## Credits & Sources

- Supreme Court Database (SCDB): Harold Spaeth, Lee Epstein, Andrew D. Martin, Jeffrey A. Segal, Theodore J. Ruger, and Sara C. Benesh. Washington University in St. Louis.
- D3.js — data-driven document visualization library, used for the heatmap, network graph, and timeline.
- supremecourt.gov — official source for current-term slip opinions.
- Built with Python 3.9+, SQLite, and vanilla JavaScript. No frameworks, no build step.
