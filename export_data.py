#!/usr/bin/env python3
"""Export SQLite data to JSON for the dashboard."""

import json
import sqlite3
from urllib.parse import quote
from scotusgami.models import init_db


def export():
    conn = init_db()
    conn.row_factory = sqlite3.Row

    # Current bench only (agreement data still includes historical votes for these pairs)
    CURRENT_JUSTICES = {"Roberts", "Thomas", "Alito", "Sotomayor", "Kagan", "Gorsuch", "Kavanaugh", "Barrett", "Jackson"}
    justices = sorted(CURRENT_JUSTICES)

    # Cases (chronological)
    cases = []
    for r in conn.execute("SELECT * FROM cases ORDER BY date_decided"):
        term_year = r["term_year"]
        docket = r["docket_number"] or ""
        case_name = r["name"] or ""

        # Primary source
        if term_year and term_year >= 2025:
            source_name = "supremecourt.gov"
            docket_dashed = docket.replace("/", "-")
            source_url = "https://www.supremecourt.gov/search.aspx?filename=/docket/docketfiles/html/public/{}.html".format(docket_dashed)
        else:
            source_name = "Supreme Court Database (SCDB)"
            source_url = "http://scdb.wustl.edu/"

        # Verification sources
        oyez_url = "https://www.oyez.org/cases/{}/{}".format(term_year, docket) if term_year and docket else ""
        scotusblog_url = "https://www.scotusblog.com/case-files/cases/?search={}".format(quote(case_name)) if case_name else ""

        cases.append({
            "id": r["id"],
            "name": case_name,
            "date": r["date_decided"],
            "docket": docket,
            "term_year": term_year,
            "source_name": source_name,
            "source_url": source_url,
            "oyez_url": oyez_url,
            "scotusblog_url": scotusblog_url,
        })

    # Votes per case
    votes = []
    for r in conn.execute("""
        SELECT v.case_id, j.name as justice, v.vote_type as vote
        FROM votes v JOIN justices j ON v.justice_id = j.id
    """):
        votes.append({"case_id": r["case_id"], "justice": r["justice"], "vote": r["vote"]})

    # Pairwise agreement summary — current justices only, but includes all historical votes
    agreements = {}
    justice_filter = ",".join(f"'{j}'" for j in CURRENT_JUSTICES)
    pairs = conn.execute(f"""
        SELECT
            CASE WHEN j1.name < j2.name THEN j1.name ELSE j2.name END as a,
            CASE WHEN j1.name < j2.name THEN j2.name ELSE j1.name END as b,
            ROUND(100.0 * SUM(same_side) / COUNT(*), 1) as rate,
            COUNT(*) as case_count
        FROM agreements ag
        JOIN justices j1 ON ag.justice_a_id = j1.id
        JOIN justices j2 ON ag.justice_b_id = j2.id
        WHERE j1.name IN ({justice_filter}) AND j2.name IN ({justice_filter})
        GROUP BY a, b
    """).fetchall()

    for r in pairs:
        key = f"{r['a']}-{r['b']}"
        agreements[key] = {"rate": r["rate"], "cases": r["case_count"]}

    # Per-case agreement for timeline — current justices only
    case_agreements = conn.execute(f"""
        SELECT
            CASE WHEN j1.name < j2.name THEN j1.name ELSE j2.name END as a,
            CASE WHEN j1.name < j2.name THEN j2.name ELSE j1.name END as b,
            c.id as case_id, ag.same_side
        FROM agreements ag
        JOIN justices j1 ON ag.justice_a_id = j1.id
        JOIN justices j2 ON ag.justice_b_id = j2.id
        JOIN cases c ON ag.case_id = c.id
        WHERE j1.name IN ({justice_filter}) AND j2.name IN ({justice_filter})
        ORDER BY c.date_decided
    """).fetchall()

    timeline = {}
    for r in case_agreements:
        key = f"{r['a']}-{r['b']}"
        if key not in timeline:
            timeline[key] = []
        timeline[key].append({"case_id": r["case_id"], "agreed": r["same_side"]})

    conn.close()

    data = {
        "justices": justices,
        "cases": cases,
        "votes": votes,
        "agreements": agreements,
        "timeline": timeline,
    }

    out_path = "data/dashboard_data.json"
    with open(out_path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"Exported to {out_path} ({len(justices)} justices, {len(cases)} cases, {len(agreements)} pairs)")


if __name__ == "__main__":
    export()
