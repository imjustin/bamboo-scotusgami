#!/usr/bin/env python3
"""SCOTUSgami CLI."""

import click
import os
from dotenv import load_dotenv

load_dotenv()

from scotusgami.fetcher import CourtListenerClient
from scotusgami.models import init_db, get_db_stats
from scotusgami.processor import process_all_cases


@click.group()
def cli():
    """Supreme Court justice agreement tracker."""
    pass


@cli.command()
@click.option("--since", type=int, default=None, help="Fetch from this term year onwards (e.g., 2020)")
def fetch(since: int):
    """Fetch cases and votes from CourtListener API."""
    api_key = os.getenv("COURTLISTENER_API_KEY")
    if not api_key:
        click.echo("Error: COURTLISTENER_API_KEY not set.")
        click.echo("  1. Get a free key at: https://www.courtlistener.com/api/rest/docs/")
        click.echo("  2. Copy .env.example to .env and add your key")
        raise click.Abort()

    click.echo("Initializing database...")
    conn = init_db()

    click.echo("Connecting to CourtListener API...")
    client = CourtListenerClient(api_key=api_key, delay=0.5)

    start_date = "2005-01-01"
    if since:
        # Convert term year to fiscal year start (June 1)
        start_date = f"{since-1}-06-01"

    click.echo(f"Fetching cases from {start_date}...")
    case_count = process_all_cases(conn, client, start_date=start_date)

    conn.close()
    click.echo(f"\nFetch complete! Processed {case_count} cases.")


@cli.command()
def status():
    """Show database statistics."""
    conn = init_db()
    stats = get_db_stats(conn)
    conn.close()

    click.echo("Database Statistics:")
    click.echo(f"  Cases: {stats['cases']}")
    click.echo(f"  Justices: {stats['justices']}")
    click.echo(f"  Votes: {stats['votes']}")
    click.echo(f"  Agreements: {stats['agreements']}")
    if stats['date_range'][0]:
        click.echo(f"  Date Range: {stats['date_range'][0]} to {stats['date_range'][1]}")


if __name__ == "__main__":
    cli()
