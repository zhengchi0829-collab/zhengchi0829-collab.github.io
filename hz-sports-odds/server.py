"""Independent Hz SPORTS odds-data cache. No LINE bot keys or paid subscriptions."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import json
import os
import threading
import time

PORT = int(os.environ.get("PORT", "10000"))
MAX_BYTES = 12_000_000
MAX_CACHE_BYTES = 4_000_000
CACHE_TTL = 900
STALE_TTL = 3600
ALLOWED_ORIGINS = {
    "https://zhengchi0829-collab.github.io",
    "https://hz-sports-ai.onrender.com",
}
ALLOWED_LEAGUES = {
    "soccer/eng.1", "soccer/esp.1", "soccer/ger.1", "soccer/ita.1",
    "soccer/fra.1", "soccer/uefa.champions", "basketball/nba",
    "basketball/mens-college-basketball", "basketball/nbl",
    "basketball/tpbl", "baseball/mlb", "baseball/npb",
    "baseball/kbo", "baseball/cpbl", "baseball/milb",
}
cache = {}
lock = threading.RLock()
stats = {"fetches": 0, "hits": 0}


def permitted(raw):
    url = urlparse(raw)
    if url.scheme != "https" or url.username or url.password or url.port:
        return False
    if url.hostname == "site.api.espn.com":
        prefix = "/apis/site/v2/sports/"
        if not url.path.startswith(prefix):
            return False
        rest = url.path[len(prefix):]
        pieces = rest.split("/")
        if len(pieces) < 3 or "/".join(pieces[:2]) not in ALLOWED_LEAGUES:
            return False
        return len(pieces) == 3 and pieces[2] in {"scoreboard", "summary", "injuries", "teams"}
    if url.hostname == "sports.core.api.espn.com":
        prefix = "/v2/sports/"
        if not url.path.startswith(prefix):
            return False
        pieces = url.path[len(prefix):].split("/")
        if len(pieces) not in (8, 9):
            return False
        sport, marker, league, events, eventid, comp, cid, odds = pieces[:8]
        return (marker == "leagues" and events == "events" and comp == "competitions"
                and odds == "odds" and f"{sport}/{league}" in ALLOWED_LEAGUES
                and eventid.isalnum() and cid.isalnum()
                and (len(pieces) == 8 or pieces[8].isalnum()))
    return False


def fetch_json(url):
    now = time.monotonic()
    with lock:
        entry = cache.get(url)
        if entry and now - entry[0] < CACHE_TTL:
            stats["hits"] += 1
            return entry[1], False
    req = Request(url, headers={"User-Agent": "HzSportsDataCache/1.0 (public sports data)",
                                "Accept": "application/json"})
    try:
        with urlopen(req, timeout=11) as response:
            if response.status != 200:
                raise ValueError("Provider response was not 200")
            body = response.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES:
                raise ValueError("Provider response too large")
            data = json.loads(body)
        with lock:
            stats["fetches"] += 1
            if len(body) <= MAX_CACHE_BYTES:
                cache[url] = (time.monotonic(), data)
            if len(cache) > 250:
                oldest = min(cache, key=lambda k: cache[k][0])
                cache.pop(oldest, None)
        return data, False
    except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
        # Only log host and error category; never leak request parameters or credentials.
        reason = "response_too_large" if str(exc) == "Provider response too large" else (
            "unexpected_status" if str(exc) == "Provider response was not 200" else type(exc).__name__)
        print("source_failure host=%s type=%s http_status=%s reason=%s" % (
            urlparse(url).hostname, type(exc).__name__, getattr(exc, "code", "-"), reason), flush=True)
        with lock:
            if entry and now - entry[0] < STALE_TTL:
                return entry[1], True
        raise


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, extra=None):
        encoded = json.dumps(body, ensure_ascii=False, separators=(",", ":")).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "public, max-age=90" if 200 <= code < 300 else "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        if extra:
            for k, v in extra.items():
                self.send_header(k, v)
        self.send_header("Content-Length", str(len(encoded)))
        try:
            self.end_headers()
            self.wfile.write(encoded)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_OPTIONS(self):
        self.send_response(204)
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        if url.path in {"/", "/health"}:
            self._send(200, {"status": "ok", "service": "hz-sports-independent-odds",
                             "bot_api_calls": 0})
            return
        if url.path == "/api/odds-snapshot":
            upstream = ("https://raw.githubusercontent.com/zhengchi0829-collab/"
                        "line-sports-ai-/odds-cache/tw_third_party_odds.json")
            try:
                data, stale = fetch_json(upstream)
                if not isinstance(data, dict) or not isinstance(data.get("leagues"), dict):
                    raise ValueError("Invalid odds snapshot")
                from datetime import datetime, timezone, timedelta
                today = datetime.now(timezone(timedelta(hours=8))).date().isoformat()
                if data.get("day") != today:
                    self._send(200, {"status": "stale", "day": data.get("day"),
                                     "leagues": {}, "source": "third_party_cached"})
                    return
                allowed = ("足球", "籃球", "棒球", "英超", "西甲", "德甲", "義甲", "法甲", "歐冠",
                           "NBA", "NCAA", "NBL", "TPBL", "MLB", "NPB", "KBO", "CPBL", "MiLB")
                clean = {}
                for name, rows in data["leagues"].items():
                    if name not in allowed or not isinstance(rows, list):
                        continue
                    clean[name] = [
                        {k: row.get(k) for k in (
                            "event_id", "home", "away", "start", "home_price",
                            "away_price", "draw_price", "spread",
                            "spread_home_price", "spread_away_price", "total",
                            "over_price", "under_price")}
                        for row in rows[:250]
                        if isinstance(row, dict) and row.get("home") and row.get("away")
                    ]
                self._send(200, {"status": "ok", "day": data["day"],
                                 "captured_at": data.get("captured_at"),
                                 "source_url": data.get("source_url"),
                                 "capture_method": data.get("capture_method"),
                                 "source_note": data.get("source_note"),
                                 "source": "third_party_cached", "leagues": clean},
                           {"X-Hz-Cache": "stale" if stale else "ok"})
            except Exception as exc:
                print("snapshot_failure type=%s" % type(exc).__name__, flush=True)
                self._send(502, {"error": "SNAPSHOT_UNAVAILABLE"})
            return
        if url.path != "/api/espn":
            self._send(404, {"error": "NOT_FOUND"})
            return
        raw = parse_qs(url.query).get("url", [""])[0]
        if len(raw) > 1000 or not permitted(raw):
            self._send(400, {"error": "UNSUPPORTED_SOURCE"})
            return
        try:
            data, stale = fetch_json(raw)
            self._send(200, data, {"X-Hz-Cache": "stale" if stale else "ok"})
        except Exception as exc:
            print("espn_failure host=%s type=%s" % (urlparse(raw).hostname, type(exc).__name__), flush=True)
            self._send(502, {"error": "UPSTREAM_UNAVAILABLE"})

    def log_message(self, fmt, *args):
        # Do not log user-supplied full upstream URLs.
        pass


if __name__ == "__main__":
    print(f"Hz SPORTS independent odds service on {PORT}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
