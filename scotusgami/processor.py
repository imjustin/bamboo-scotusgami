"""Vote processing and agreement calculation."""

import sqlite3
from typing import Tuple
from .models import (
    get_or_create_justice,
    get_or_create_case,
    insert_vote,
    insert_agreement,
    get_all_justices,
)


VOTE_TYPE_MAPPING = {
    "Majority": "majority",
    "Dissent": "dissent",
    "Concurrence": "concurrence",
    "Concurrence in part, Dissent in part": "concurrence_in_part",
    "Not Participating": "not_participating",
}


def normalize_vote_type(raw_vote_type: str) -> str:
    """Normalize CourtListener vote types to canonical form."""
    for raw, canonical in VOTE_TYPE_MAPPING.items():
        if raw.lower() in raw_vote_type.lower():
            return canonical
    return "unknown"


def process_case_and_votes(
    conn: sqlite3.Connection,
    opinion: dict,
    votes: list,
) -> int:
    """
    Process a case and its votes. Store in DB. Return case_id.

    opinion: dict from CourtListener /opinions/ endpoint
    votes: list of dicts from /votes/ endpoint
    """
    opinion_id = opinion["id"]
    name = opinion.get("case_name", "Unknown")
    date_decided = opinion.get("date_filed", "")
    docket_number = opinion.get("docket_number", "")
    term_year = int(opinion.get("term", 0)) if opinion.get("term") else 0

    case_id = get_or_create_case(
        conn,
        opinion_id,
        name,
        date_decided,
        term_year,
        docket_number,
    )

    for vote in votes:
        justice_name = vote.get("judge", {}).get("name", "")
        if not justice_name:
            continue

        justice_id = get_or_create_justice(conn, justice_name)
        raw_vote_type = vote.get("type", "")
        canonical_vote_type = normalize_vote_type(raw_vote_type)

        insert_vote(conn, case_id, justice_id, canonical_vote_type)

    return case_id


def compute_agreements_for_case(conn: sqlite3.Connection, case_id: int) -> None:
    """
    Compute pairwise agreement metrics for all justices in a case.
    Store in agreements table.
    """
    cursor = conn.cursor()

    cursor.execute(
        "SELECT justice_id, vote_type FROM votes WHERE case_id = ?",
        (case_id,)
    )
    votes = cursor.fetchall()

    if len(votes) < 2:
        return

    vote_dict = {row[0]: row[1] for row in votes}

    for i, (justice_a_id, vote_a) in enumerate(vote_dict.items()):
        for justice_b_id, vote_b in list(vote_dict.items())[i+1:]:
            same_side = compute_same_side(vote_a, vote_b)
            agreed = 1 if vote_a == vote_b else 0

            insert_agreement(conn, justice_a_id, justice_b_id, case_id, same_side, agreed)


def compute_same_side(vote_a: str, vote_b: str) -> int:
    """
    Return 1 if both votes are on the same 'side' (majority or non-majority).
    """
    majority_votes = {"majority"}
    non_majority_votes = {"dissent", "concurrence", "concurrence_in_part", "not_participating", "unknown"}

    a_is_majority = vote_a in majority_votes
    b_is_majority = vote_b in majority_votes

    if a_is_majority == b_is_majority:
        return 1
    return 0


def process_all_cases(
    conn: sqlite3.Connection,
    client,
    start_date: str = "2005-01-01",
    end_date: str = None,
) -> int:
    """
    Fetch all cases from CourtListener and process them.
    Return count of cases processed.
    """
    case_count = 0

    for opinion in client.fetch_opinions(start_date=start_date, end_date=end_date):
        opinion_id = opinion["id"]

        votes = client.fetch_votes(opinion_id)
        if not votes:
            continue

        case_id = process_case_and_votes(conn, opinion, votes)
        compute_agreements_for_case(conn, case_id)
        case_count += 1

        if case_count % 10 == 0:
            print(f"Processed {case_count} cases...")

    return case_count
