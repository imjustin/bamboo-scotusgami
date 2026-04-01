"""PDF vote extraction and agreement calculation."""

import re
import sqlite3
import fitz
from .models import (
    get_or_create_justice,
    get_or_create_case,
    insert_vote,
    insert_agreement,
)


JUSTICES = ["Roberts", "Thomas", "Alito", "Sotomayor", "Kagan", "Gorsuch", "Kavanaugh", "Barrett", "Jackson"]


def extract_votes_from_pdf(filepath: str) -> dict[str, str]:
    """
    Extract justice votes from a SCOTUS opinion PDF.
    Returns {justice_name: vote_type} where vote_type is majority/concurrence/dissent.
    """
    doc = fitz.open(filepath)

    # Find the vote block (usually pages 3-5)
    block = None
    for page_num in range(min(6, len(doc))):
        text = doc[page_num].get_text()
        if 'delivered the opinion' in text:
            collapsed = ' '.join(text.split())
            match = re.search(
                r'(\w+,\s+(?:C\.\s*)?J\.,\s+delivered the opinion.+?)(?:JUSTICE\s+\w+\s+delivered|$)',
                collapsed
            )
            if match:
                block = match.group(1)
                break
        elif 'per curiam' in text.lower():
            block = "PER CURIAM"
            break

    doc.close()

    if not block:
        return {}

    votes = {}

    # Per curiam = unanimous
    if block == "PER CURIAM":
        for j in JUSTICES:
            votes[j] = "majority"
        return votes

    # Split on ". " before a justice name pattern
    parts = re.split(r'\.\s+(?=[A-Z]+,\s+(?:C\.\s*)?J\.)', block)

    for part in parts:
        part = part.strip()
        if not part:
            continue

        if 'delivered the opinion' in part:
            for j in JUSTICES:
                if j.upper() in part.upper():
                    votes[j] = "majority"
        elif 'concurring' in part:
            for j in JUSTICES:
                if j.upper() in part.upper() and j not in votes:
                    votes[j] = "concurrence"
        elif 'dissent' in part:
            for j in JUSTICES:
                if j.upper() in part.upper() and j not in votes:
                    votes[j] = "dissent"

    return votes


def process_case(conn: sqlite3.Connection, case: dict, pdf_path: str) -> int:
    """Process a single case: extract votes from PDF and store in DB."""
    votes = extract_votes_from_pdf(pdf_path)
    if not votes:
        return None

    case_id = get_or_create_case(
        conn,
        name=case['name'],
        date_decided=case['date'],
        term_year=2025,
        docket_number=case['docket'],
    )

    for justice_name, vote_type in votes.items():
        justice_id = get_or_create_justice(conn, justice_name)
        insert_vote(conn, case_id, justice_id, vote_type)

    compute_agreements_for_case(conn, case_id)
    return case_id


def compute_agreements_for_case(conn: sqlite3.Connection, case_id: int) -> None:
    """Compute pairwise agreement for all justices in a case."""
    cursor = conn.cursor()
    cursor.execute("SELECT justice_id, vote_type FROM votes WHERE case_id = ?", (case_id,))
    votes = cursor.fetchall()

    if len(votes) < 2:
        return

    vote_dict = {row[0]: row[1] for row in votes}

    justice_ids = list(vote_dict.keys())
    for i in range(len(justice_ids)):
        for j in range(i + 1, len(justice_ids)):
            a_id, b_id = justice_ids[i], justice_ids[j]
            vote_a, vote_b = vote_dict[a_id], vote_dict[b_id]

            # same_side: both majority or both non-majority
            a_majority = vote_a == "majority"
            b_majority = vote_b == "majority"
            same_side = 1 if a_majority == b_majority else 0

            # agreed: exact vote type match
            agreed = 1 if vote_a == vote_b else 0

            insert_agreement(conn, a_id, b_id, case_id, same_side, agreed)
