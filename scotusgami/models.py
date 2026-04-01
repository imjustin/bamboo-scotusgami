"""SQLite schema and database helpers."""

import sqlite3
from pathlib import Path
from typing import Optional

DB_PATH = Path("data/scotusgami.db")


def init_db(db_path: Path = DB_PATH) -> sqlite3.Connection:
    """Initialize database schema. Returns connection."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS justices (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            appointed_by TEXT,
            start_date TEXT,
            end_date TEXT
        );

        CREATE TABLE IF NOT EXISTS cases (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            date_decided TEXT NOT NULL,
            term_year INTEGER NOT NULL,
            docket_number TEXT,
            UNIQUE(docket_number)
        );

        CREATE TABLE IF NOT EXISTS votes (
            id INTEGER PRIMARY KEY,
            case_id INTEGER NOT NULL,
            justice_id INTEGER NOT NULL,
            vote_type TEXT NOT NULL,
            FOREIGN KEY(case_id) REFERENCES cases(id),
            FOREIGN KEY(justice_id) REFERENCES justices(id),
            UNIQUE(case_id, justice_id)
        );

        CREATE TABLE IF NOT EXISTS agreements (
            id INTEGER PRIMARY KEY,
            justice_a_id INTEGER NOT NULL,
            justice_b_id INTEGER NOT NULL,
            case_id INTEGER NOT NULL,
            same_side INTEGER,
            agreed INTEGER,
            FOREIGN KEY(justice_a_id) REFERENCES justices(id),
            FOREIGN KEY(justice_b_id) REFERENCES justices(id),
            FOREIGN KEY(case_id) REFERENCES cases(id),
            UNIQUE(justice_a_id, justice_b_id, case_id)
        );

        CREATE INDEX IF NOT EXISTS idx_votes_case ON votes(case_id);
        CREATE INDEX IF NOT EXISTS idx_votes_justice ON votes(justice_id);
        CREATE INDEX IF NOT EXISTS idx_agreements_case ON agreements(case_id);
        CREATE INDEX IF NOT EXISTS idx_agreements_justices ON agreements(justice_a_id, justice_b_id);
    """)
    conn.commit()
    return conn


def get_or_create_justice(conn: sqlite3.Connection, name: str) -> int:
    """Get justice ID by name or create if not exists."""
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM justices WHERE name = ?", (name,))
    row = cursor.fetchone()
    if row:
        return row[0]

    cursor.execute(
        "INSERT INTO justices (name) VALUES (?)",
        (name,)
    )
    conn.commit()
    return cursor.lastrowid


def get_or_create_case(conn: sqlite3.Connection, name: str, date_decided: str, term_year: int, docket_number: str) -> int:
    """Get case ID or create if not exists. Uses docket_number as unique key."""
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM cases WHERE docket_number = ?", (docket_number,))
    row = cursor.fetchone()
    if row:
        return row[0]

    cursor.execute(
        "INSERT INTO cases (name, date_decided, term_year, docket_number) VALUES (?, ?, ?, ?)",
        (name, date_decided, term_year, docket_number)
    )
    conn.commit()
    return cursor.lastrowid


def insert_vote(conn: sqlite3.Connection, case_id: int, justice_id: int, vote_type: str) -> None:
    """Insert or update a vote record."""
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO votes (case_id, justice_id, vote_type) VALUES (?, ?, ?)",
        (case_id, justice_id, vote_type)
    )
    conn.commit()


def insert_agreement(conn: sqlite3.Connection, justice_a_id: int, justice_b_id: int, case_id: int, same_side: int, agreed: int) -> None:
    """Insert or update an agreement record."""
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO agreements (justice_a_id, justice_b_id, case_id, same_side, agreed) VALUES (?, ?, ?, ?, ?)",
        (justice_a_id, justice_b_id, case_id, same_side, agreed)
    )
    conn.commit()


def get_all_justices(conn: sqlite3.Connection) -> list:
    """Fetch all justices."""
    cursor = conn.cursor()
    cursor.execute("SELECT id, name FROM justices ORDER BY name")
    return cursor.fetchall()


def get_db_stats(conn: sqlite3.Connection) -> dict:
    """Return database statistics."""
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM cases")
    case_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM justices")
    justice_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM votes")
    vote_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM agreements")
    agreement_count = cursor.fetchone()[0]

    cursor.execute("SELECT MIN(date_decided), MAX(date_decided) FROM cases")
    date_range = cursor.fetchone()

    return {
        "cases": case_count,
        "justices": justice_count,
        "votes": vote_count,
        "agreements": agreement_count,
        "date_range": (date_range[0], date_range[1]) if date_range[0] else None,
    }
