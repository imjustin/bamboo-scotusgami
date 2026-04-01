# SCOTUSgami

Track and visualize agreement rates between U.S. Supreme Court justices (Roberts era, 2005–present).

## Phase 1: Data Ingestion

This phase fetches and stores Supreme Court voting data from the CourtListener API into a local SQLite database.

### Setup

1. **Get a CourtListener API key** (free):
   - Visit https://www.courtlistener.com/api/rest/docs/
   - Register for a free account
   - Copy your API key

2. **Install dependencies:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Set up environment file:**
   ```bash
   cp .env.example .env
   # Edit .env and paste your CourtListener API key
   ```

### Usage

**Fetch all data (Roberts era):**
```bash
python main.py fetch
```

**Fetch incrementally from a given term year:**
```bash
python main.py fetch --since 2020
```

**Show database statistics:**
```bash
python main.py status
```

### Database Schema

- `cases` — case metadata (name, date decided, term year, docket number)
- `justices` — justice roster (name, appointer, tenure dates)
- `votes` — individual votes per case (vote type: majority, dissent, concurrence, etc.)
- `agreements` — pairwise agreement metrics between justices per case (`same_side` and `agreed`)

### Agreement Metrics

Two metrics are computed and stored for each justice pair per case:
- **`same_side`**: Both voted majority OR both voted non-majority
- **`agreed`**: Exact vote type match (both majority, both dissent, both concurrence, etc.)

Phase 2 (visualization) will choose which metric to display.

## Phase 2: Visualization (TBD)

Heat maps and node-based graph layouts of agreement networks.
