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

## Phase 1 Scope

Data ingestion and storage only. No visualization yet.

### Core Modules
- `fetcher.py` — CourtListener API client
- `models.py` — SQLite schema and DB helpers
- `processor.py` — Vote normalization and agreement calculation
- `main.py` — CLI entry point

### Commands
- `python main.py fetch` — full fetch (Roberts era)
- `python main.py fetch --since 2020` — incremental from term year
- `python main.py status` — DB stats
