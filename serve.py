#!/usr/bin/env python3
"""Development server for SCOTUSgami dashboard with API endpoints."""

import json
import os
import sqlite3
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from scotusgami.fetcher import SCOTUSFetcher
from scotusgami.models import init_db
from scotusgami.processor import process_case, extract_votes_from_pdf
from export_data import export


class DashboardHandler(SimpleHTTPRequestHandler):
    """Serves static files and handles API routes."""

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/query':
            self.handle_query(parsed)
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/download':
            self.handle_download()
        else:
            self.send_error(404)

    def handle_query(self, parsed=None):
        """Check supremecourt.gov for cases not yet in our DB."""
        try:
            qs = parse_qs(parsed.query) if parsed else {}
            term = int(qs.get('term', ['25'])[0])
            fetcher = SCOTUSFetcher()
            remote_cases = fetcher.fetch_opinion_list(term)

            conn = init_db()
            conn.row_factory = sqlite3.Row
            existing = {r['docket_number'] for r in conn.execute("SELECT docket_number FROM cases")}
            conn.close()

            new_cases = [c for c in remote_cases if c['docket'] not in existing and c.get('pdf_url')]

            self.send_json({"new_cases": new_cases, "total_remote": len(remote_cases), "existing": len(existing), "term": term})
        except Exception as e:
            self.send_json({"error": str(e)}, status=500)

    def handle_download(self):
        """Download selected cases, extract votes, update DB and re-export JSON."""
        try:
            length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(length)) if length else {}
            cases_to_download = body.get('cases', [])
            term = body.get('term', 25)

            if not cases_to_download:
                self.send_json({"error": "No cases provided"}, status=400)
                return

            conn = init_db()
            fetcher = SCOTUSFetcher()
            processed = 0

            for case in cases_to_download:
                if not case.get('pdf_url'):
                    continue
                try:
                    pdf_path = fetcher.download_pdf(case)
                    votes = extract_votes_from_pdf(pdf_path)
                    if votes:
                        process_case(conn, case, pdf_path, term=term)
                        processed += 1
                except Exception:
                    continue

            conn.close()

            # Re-export data for the dashboard
            export()

            self.send_json({"processed": processed, "requested": len(cases_to_download)})
        except Exception as e:
            self.send_json({"error": str(e)}, status=500)

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        if '/api/' in (args[0] if args else ''):
            super().log_message(format, *args)


if __name__ == '__main__':
    port = 8787
    server = HTTPServer(('', port), DashboardHandler)
    print(f"SCOTUSgami dashboard: http://localhost:{port}/dashboard.html")
    print("API endpoints: GET /api/query, POST /api/download")
    print("Press Ctrl+C to stop")
    server.serve_forever()
