# SCOTUSgami — Claude Code Guidelines

## How to Ask Questions

When you need to clarify requirements, preferences, or intent with the user:
- **Always** use the `AskUserQuestion` tool
- Never ask questions in plain text
- One question per tool invocation, unless they are tightly coupled
- Provide 2–4 options where possible (multiple choice preferred over open-ended)

Example: Instead of writing "What should we call this function?", invoke:
```
AskUserQuestion:
  question: "What naming convention for vote normalization functions?"
  options: ["normalize_vote_TYPE()", "normalize_TYPE()", "type_to_canonical()"]
```

## Project Conventions

- **Language**: Python 3.9+
- **Database**: SQLite (local, gitignored)
- **CLI**: Click for command-line interface
- **Structure**: Package-based (`scotusgami/` module)
- **Data**: Roberts era (2005–present), CourtListener API

## Project Structure

The project has two layers: a Python data pipeline and a browser-based dashboard.

### Python Pipeline
- `scotusgami/import_scdb.py` — imports SCDB CSV (currently 2025_01, covers OT2005–2024)
- `scotusgami/fetcher.py` — PDF scraper for supremecourt.gov slip opinions (OT2025 only)
- `scotusgami/processor.py` — vote extraction from PDFs, agreement computation
- `export_data.py` — SQLite → `data/dashboard_data.json`

### CLI Commands
- `python main.py fetch` — full fetch (Roberts era)
- `python main.py fetch --since 2020` — incremental from term year
- `python main.py status` — DB stats

### Dashboard (browser)
- `dashboard.html` / `index.html` — entry points (kept in sync)
- `css/dashboard.css` — all styles, dark theme
- `js/feed.js` — SCOTUSgami feed, novelty scoring, coalition index
- `js/visualize.js` — heatmap, network graph, timeline, pair detail, Top Coalitions panel
- `js/coalitions-tab.js` — Coalition Explorer tab (independent tab, not nested under Data)
- `js/data-tab.js` — case list with search, vote breakdowns, source links
- `js/justices-tab.js` — Justices tab: 3×3 roster grid and per-justice profile pages (bio, stat cards, ideology drift chart, allies/opponents, case history)
- `js/about.js` — reference documentation

## Dashboard Conventions

- **No innerHTML** — a pre-commit security hook blocks it. Use `createElement` / `textContent` / `appendChild` exclusively. Never use `insertAdjacentHTML`.
- **Cross-file communication**: custom events (`scotusgami-data-ready`, `scotusgami-filter-change`, `scotusgami-show-coalition`) and shared globals (`window.DATA`, `window.currentTermFilter`, `window.getFilteredCases`, `window.getFilteredAgreements`, `window.computeScotusgamiFeed`, `window.switchToTab`).
- **Coalition indexes** are built globally in `feed.js` and exposed via `window` for cross-tab access.
- **Panel layout preference**: independent panels in the viz grid, not features nested inside other features.
- **Date format** in data: `M/DD/YY` — requires custom parsing, not string-sortable.
- **Case history vote display**: Show co-voters by justice name (e.g. "Alito, Thomas") rather than a vote-type badge. Majority-side co-voters include majority + concurrence votes; dissent-side shows only dissenters. Skip co-voter display for concurrences.
