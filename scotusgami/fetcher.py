"""CourtListener API client for fetching Supreme Court data."""

import time
from typing import Optional, Generator
import requests
import os


BASE_URL = "https://www.courtlistener.com/api/rest/v3"
SCOTUS_COURT = "scotus"
ROBERTS_START = "2005-01-01"


class CourtListenerClient:
    """Client for CourtListener API."""

    def __init__(self, api_key: Optional[str] = None, delay: float = 0.5):
        """Initialize with optional API key and rate-limiting delay (seconds)."""
        self.delay = delay
        self.session = requests.Session()

        self.api_key = api_key or os.getenv("COURTLISTENER_API_KEY")
        if self.api_key:
            self.session.headers.update({"Authorization": f"Token {self.api_key}"})

    def _get(self, endpoint: str, params: dict = None) -> dict:
        """Make paginated GET request."""
        url = f"{BASE_URL}{endpoint}"
        if params is None:
            params = {}

        response = self.session.get(url, params=params, timeout=10)
        response.raise_for_status()
        time.sleep(self.delay)
        return response.json()

    def fetch_opinions(self, start_date: str = ROBERTS_START, end_date: Optional[str] = None) -> Generator:
        """Fetch all SCOTUS opinions (paginated). Yields opinion dicts."""
        params = {
            "court": SCOTUS_COURT,
            "date_filed__gte": start_date,
            "order_by": "date_filed",
            "limit": 100,
        }
        if end_date:
            params["date_filed__lte"] = end_date

        next_url = f"{BASE_URL}/opinions/"

        while next_url:
            response = self.session.get(next_url, timeout=10)
            response.raise_for_status()
            time.sleep(self.delay)
            data = response.json()

            for opinion in data.get("results", []):
                yield opinion

            next_url = data.get("next")

    def fetch_votes(self, opinion_id: int) -> list:
        """Fetch all votes for a given opinion. Returns list of vote dicts."""
        endpoint = f"/votes/"
        params = {
            "opinion_id": opinion_id,
            "limit": 100,
        }

        votes = []
        next_url = f"{BASE_URL}{endpoint}"

        while next_url:
            response = self.session.get(next_url, params=params, timeout=10)
            response.raise_for_status()
            time.sleep(self.delay)
            data = response.json()

            votes.extend(data.get("results", []))
            next_url = data.get("next")
            params = {}  # Clear params after first request

        return votes
