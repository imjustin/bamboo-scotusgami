#!/usr/bin/env python3
"""SCOTUSgami CLI."""

import csv
import os
import click
from scotusgami.fetcher import SCOTUSFetcher
from scotusgami.models import init_db, get_db_stats
from scotusgami.processor import process_case, extract_votes_from_pdf
from scotusgami.import_scdb import run_import


@click.group()
def cli():
    """Supreme Court justice agreement tracker."""
    pass


@cli.command()
@click.option("--term", type=int, default=25, help="Term number (last 2 digits of start year, e.g. 25 for Oct 2025)")
@click.option("--limit", type=int, default=None, help="Max number of opinions to fetch")
def fetch(term: int, limit: int):
    """Fetch opinions from supremecourt.gov, extract votes, store in DB."""
    click.echo("Initializing database...")
    conn = init_db()

    fetcher = SCOTUSFetcher()
    click.echo(f"Fetching opinion list for term {term}...")
    cases = fetcher.fetch_opinion_list(term)
    click.echo(f"Found {len(cases)} opinions")

    if limit:
        cases = cases[:limit]

    csv_rows = []
    processed = 0

    for case in cases:
        if not case.get('pdf_url'):
            continue

        click.echo(f"  Downloading {case['name'][:50]}...")
        try:
            pdf_path = fetcher.download_pdf(case)
        except Exception as e:
            click.echo(f"    ✗ Download failed: {e}")
            continue

        votes = extract_votes_from_pdf(pdf_path)
        if not votes:
            click.echo(f"    ✗ Could not parse votes")
            continue

        case_id = process_case(conn, case, pdf_path, term=term)
        processed += 1

        vote_summary = ", ".join(f"{j}: {v}" for j, v in sorted(votes.items()))
        csv_rows.append({
            "docket": case['docket'],
            "case_name": case['name'],
            "date_decided": case['date'],
            "pdf_url": case['pdf_url'],
            "local_filename": os.path.basename(pdf_path),
            "author": case['justice_initials'],
            "vote_summary": vote_summary,
        })

        click.echo(f"    ✓ {len(votes)} votes extracted")

    conn.close()

    # Write CSV log
    csv_path = "opinion-pdfs/opinions_log.csv"
    with open(csv_path, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=["docket", "case_name", "date_decided", "pdf_url", "local_filename", "author", "vote_summary"])
        writer.writeheader()
        writer.writerows(csv_rows)

    click.echo(f"\nDone! Processed {processed} cases. CSV log: {csv_path}")


@cli.command()
def status():
    """Show database statistics."""
    conn = init_db()
    stats = get_db_stats(conn)
    conn.close()

    click.echo("Database Statistics:")
    click.echo(f"  Cases:      {stats['cases']}")
    click.echo(f"  Justices:   {stats['justices']}")
    click.echo(f"  Votes:      {stats['votes']}")
    click.echo(f"  Agreements: {stats['agreements']}")
    if stats['date_range'] and stats['date_range'][0]:
        click.echo(f"  Date Range: {stats['date_range'][0]} to {stats['date_range'][1]}")


@cli.command("import-scdb")
def import_scdb():
    """Import historical data from the Supreme Court Database (2005-2024)."""
    run_import()


if __name__ == "__main__":
    cli()
