"""Import historical SCOTUS data from the Supreme Court Database (SCDB)."""

import csv
import io
import zipfile
from collections import defaultdict
from datetime import datetime

import click
import requests

from .models import (
    init_db,
    get_or_create_justice,
    get_or_create_case,
    insert_vote,
)
from .processor import compute_agreements_for_case

SCDB_URL = (
    "http://scdb.wustl.edu/_brickFiles/2025_01/"
    "SCDB_2025_01_justiceCentered_Citation.csv.zip"
)

JUSTICE_NAME_MAP = {
    "JGRoberts": "Roberts",
    "CThomas": "Thomas",
    "SAAlito": "Alito",
    "SSotomayor": "Sotomayor",
    "EKagan": "Kagan",
    "NMGorsuch": "Gorsuch",
    "BMKavanaugh": "Kavanaugh",
    "ACBarrett": "Barrett",
    "KBJackson": "Jackson",
    "SDOConnor": "O'Connor",
    "DHSouter": "Souter",
    "JPStevens": "Stevens",
    "RBGinsburg": "Ginsburg",
    "SGBreyer": "Breyer",
    "AMKennedy": "Kennedy",
    "AScalia": "Scalia",
}

VOTE_TYPE_MAP = {
    "1": "majority",
    "2": "dissent",
    "3": "concurrence",
    "4": "concurrence",
    "5": "concurrence",
    "6": "concurrence",
    "7": "dissent",
    # 8 = no participation -> skip
}


def download_and_extract_csv():
    """Download the SCDB zip and return CSV rows as list of dicts."""
    click.echo(f"Downloading SCDB data from {SCDB_URL}...")
    resp = requests.get(SCDB_URL, timeout=120)
    resp.raise_for_status()
    click.echo(f"Downloaded {len(resp.content) / 1024 / 1024:.1f} MB")

    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        csv_names = [n for n in zf.namelist() if n.endswith(".csv")]
        if not csv_names:
            raise RuntimeError("No CSV file found in zip")
        csv_name = csv_names[0]
        click.echo(f"Extracting {csv_name}...")
        with zf.open(csv_name) as f:
            text = io.TextIOWrapper(f, encoding="utf-8-sig")
            reader = csv.DictReader(text)
            rows = list(reader)
    click.echo(f"Read {len(rows)} rows from SCDB")
    return rows


def convert_date(scdb_date: str) -> str:
    """Convert SCDB date (MM/DD/YYYY) to our format (M/DD/YY)."""
    try:
        dt = datetime.strptime(scdb_date, "%m/%d/%Y")
        return dt.strftime("%-m/%d/%y")
    except (ValueError, TypeError):
        return scdb_date


def clear_scdb_terms(conn):
    """Delete all data for terms 2005-2024 to avoid duplicates."""
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id FROM cases WHERE term_year >= 2005 AND term_year <= 2024"
    )
    case_ids = [row[0] for row in cursor.fetchall()]

    if not case_ids:
        click.echo("No existing SCDB-era data to clear.")
        return

    placeholders = ",".join("?" * len(case_ids))
    cursor.execute(
        f"DELETE FROM agreements WHERE case_id IN ({placeholders})", case_ids
    )
    cursor.execute(
        f"DELETE FROM votes WHERE case_id IN ({placeholders})", case_ids
    )
    cursor.execute(
        f"DELETE FROM cases WHERE id IN ({placeholders})", case_ids
    )
    conn.commit()
    click.echo(f"Cleared {len(case_ids)} existing cases from terms 2005-2024.")


def import_scdb_data(conn, rows):
    """Filter, group, and import SCDB rows into the database."""
    # Filter to Roberts Court (term >= 2005) and group by case
    cases = defaultdict(list)
    for row in rows:
        term = int(row["term"])
        if term < 2005:
            continue
        case_key = row.get("caseId") or (row["caseName"], row["term"], row["docket"])
        cases[case_key].append(row)

    click.echo(f"Found {len(cases)} Roberts Court cases to import.")

    imported = 0
    skipped_cases = 0

    for case_key, justice_rows in cases.items():
        first = justice_rows[0]
        term_year = int(first["term"])
        case_name = first["caseName"]
        docket = first["docket"]
        date_decided = convert_date(first["dateDecision"])

        case_id = get_or_create_case(
            conn,
            name=case_name,
            date_decided=date_decided,
            term_year=term_year,
            docket_number=docket,
        )

        vote_count = 0
        for jr in justice_rows:
            scdb_name = jr["justiceName"]
            vote_code = jr["vote"].strip()

            # Skip non-participation
            if vote_code == "8":
                continue

            justice_name = JUSTICE_NAME_MAP.get(scdb_name)
            if not justice_name:
                continue

            vote_type = VOTE_TYPE_MAP.get(vote_code)
            if not vote_type:
                continue

            justice_id = get_or_create_justice(conn, justice_name)
            insert_vote(conn, case_id, justice_id, vote_type)
            vote_count += 1

        if vote_count >= 2:
            compute_agreements_for_case(conn, case_id)
            imported += 1
        else:
            skipped_cases += 1

    click.echo(f"Imported {imported} cases ({skipped_cases} skipped with < 2 votes).")


def run_import():
    """Main entry point for SCDB import."""
    conn = init_db()
    try:
        rows = download_and_extract_csv()
        clear_scdb_terms(conn)
        import_scdb_data(conn, rows)

        # Print summary
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM cases")
        click.echo(f"\nTotal cases in DB: {cursor.fetchone()[0]}")
        cursor.execute("SELECT COUNT(*) FROM votes")
        click.echo(f"Total votes in DB: {cursor.fetchone()[0]}")
        cursor.execute("SELECT COUNT(*) FROM agreements")
        click.echo(f"Total agreements in DB: {cursor.fetchone()[0]}")
    finally:
        conn.close()
