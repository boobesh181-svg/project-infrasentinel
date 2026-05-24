"""Simple playback script to POST seed events to the local ops ingest endpoint.

Usage:
  python scripts/playback_demo.py --url http://localhost:8000/ops/ingest
"""
import json
import sys
from pathlib import Path

import httpx


def main(base_url: str):
    data_path = Path(__file__).parent.parent / "demo" / "seed_data" / "events.json"
    events = json.loads(data_path.read_text())
    client = httpx.Client(timeout=10.0)
    for ev in events:
        resp = client.post(base_url, json=ev)
        print(ev.get("vehicle_plate"), resp.status_code, resp.text)


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000/ops/ingest"
    main(url)
