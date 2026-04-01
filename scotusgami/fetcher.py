"""Scrape Supreme Court opinions from supremecourt.gov."""

import os
import re
import requests
from bs4 import BeautifulSoup
from typing import Generator


BASE_URL = "https://www.supremecourt.gov"
PDF_DIR = "opinion-pdfs"


class SCOTUSFetcher:
    """Fetches opinion PDFs from supremecourt.gov."""

    def __init__(self, pdf_dir: str = PDF_DIR):
        self.pdf_dir = pdf_dir
        os.makedirs(pdf_dir, exist_ok=True)

    def fetch_opinion_list(self, term: int = 25) -> list[dict]:
        """
        Fetch list of opinions for a given term from supremecourt.gov.
        term: last 2 digits of the year the term started (e.g., 25 for Oct 2025 term).
        Returns list of dicts with case metadata and PDF URLs.
        """
        url = f"{BASE_URL}/opinions/slipopinion/{term}"
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        tables = soup.find_all('table')

        cases = []
        for table in tables:
            rows = table.find_all('tr')
            header_cells = [th.text.strip() for th in rows[0].find_all(['th', 'td'])]
            if 'Docket' not in header_cells:
                continue

            for row in rows[1:]:
                cells = row.find_all('td')
                if len(cells) < 5:
                    continue

                links = row.find_all('a', href=True)
                pdf_link = None
                for a in links:
                    href = a.get('href', '')
                    if href.endswith('.pdf') and 'diff' not in href:
                        pdf_link = href
                        break

                case = {
                    'date': cells[1].text.strip(),
                    'docket': cells[2].text.strip(),
                    'name': cells[3].text.strip().split('\n')[0],
                    'justice_initials': cells[4].text.strip(),
                    'pdf_url': f"{BASE_URL}{pdf_link}" if pdf_link else None,
                }
                cases.append(case)

        return cases

    def download_pdf(self, case: dict) -> str:
        """Download opinion PDF. Returns local filepath."""
        if not case.get('pdf_url'):
            return None

        filename = f"{case['docket'].replace('/', '-')}_{case['name'].replace(' ', '_')[:30]}.pdf"
        filepath = os.path.join(self.pdf_dir, filename)

        if os.path.exists(filepath):
            return filepath

        response = requests.get(case['pdf_url'], timeout=30)
        response.raise_for_status()

        with open(filepath, 'wb') as f:
            f.write(response.content)

        return filepath
