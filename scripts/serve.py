#!/usr/bin/env python3
"""Local static server for Shoe School.

Like `python -m http.server`, but tells the browser to re-check every file
(Cache-Control: no-cache), so an updated app is never served from a stale
cache. Unchanged files still come back as a cheap 304.

Usage: py scripts/serve.py [port]      (default 8146, serves the app folder)
"""
import functools
import http.server
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript", ".mjs": "text/javascript",
        ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):  # keep the console quiet
        pass


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8146
    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Shoe School on http://localhost:{port}/  (Ctrl+C or close this window to stop)")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
