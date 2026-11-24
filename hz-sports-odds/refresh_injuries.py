"""Fetch public league injury reports, preserving source timestamps and failures.

No credentials, paid API or betting data are used. Run from the repository root.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.request import Request, urlopen

LEAGUES = (
    "soccer/eng.1", "soccer/esp.1", "soccer/ger.1", "soccer/ita.1",
    "soccer/fra.1", "soccer/uefa.champions", "basketball/nba",
    "basketball/mens-college-basketball", "basketball/nbl", "basketball/tpbl",
    "baseball/mlb", "baseball/npb", "baseball/kbo", "baseball/cpbl", "baseball/milb",
)
BASE = "https://site.api.espn.com/apis/site/v2/sports/"
OUT = Path(__file__).resolve().parents[1] / "hz-sports" / "injury-cache.json"
MAX_BYTES = 5_000_000


def now():
    return datetime.now(timezone.utc).isoformat()


def valid_report(data):
    top = data if isinstance(data, list) else data.get("injuries") if isinstance(data, dict) else None
    if not isinstance(top, list):
        raise ValueError("Missing injuries array")
    if not top:
        return
    def recognized(row, depth=0):
        if not isinstance(row, dict) or depth > 3:
            return False
        nested = row.get("injuries")
        if isinstance(nested, list):
            return all(recognized(x, depth + 1) for x in nested)
        athlete = row.get("athlete") or row.get("player") or row
        return isinstance(athlete, dict) and bool(athlete.get("displayName") or athlete.get("fullName") or athlete.get("name")) and bool(row.get("status") or row.get("details") or row.get("type") or row.get("shortComment"))
    if not all(recognized(row) for row in top):
        raise ValueError("Unrecognized injury records")


def fetch(league):
    url = BASE + league + "/injuries"
    try:
        req = Request(url, headers={"Accept": "application/json", "User-Agent": "HzSportsInjuryRefresh/1.0"})
        with urlopen(req, timeout=15) as response:
            if response.status != 200:
                raise ValueError("Unexpected HTTP status")
            body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise ValueError("Response too large")
        data = json.loads(body)
        valid_report(data)
        return league, {"state": "ok", "captured_at": now(), "source_url": url, "data": data}
    except Exception as exc:
        return league, {"state": "unavailable", "source_url": url, "error": type(exc).__name__}


def main():
    try:
        prev = json.loads(OUT.read_text(encoding="utf-8")).get("leagues", {})
    except (OSError, ValueError, AttributeError):
        prev = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = dict(pool.map(fetch, LEAGUES))
    for league, entry in results.items():
        old = prev.get(league, {})
        if entry["state"] == "unavailable" and isinstance(old, dict) and old.get("data") is not None and old.get("captured_at"):
            entry.update(state="stale", data=old["data"], captured_at=old["captured_at"])
        print(league, entry["state"], entry.get("captured_at", "-"), entry.get("error", ""))
    output = {"schema_version": 1, "checked_at": now(), "leagues": results}
    tmp = OUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    tmp.replace(OUT)


if __name__ == "__main__":
    main()
