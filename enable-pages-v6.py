#!/usr/bin/env python3
"""Enable GitHub Pages (branch master, path /) for the AURORA FREIGHT repo."""
import json, sys, time, urllib.request, urllib.error
sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request, read_json_response
API = "https://api.github.com"
OWNER, REPO = "Abkhas", "best-flight-game-20261126-0057-v6-entry"
SITE = f"https://abkhas.github.io/{REPO}/game/index.html"

def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("Accept", "application/vnd.github+json")
    if data: req.add_header("Content-Type", "application/json")
    add_surrogate_to_request(req, "custom.github", allowed_hosts=["api.github.com"])
    with urllib.request.urlopen(req) as resp:
        return resp.status, read_json_response(resp)

try:
    status, cur = api("GET", f"/repos/{OWNER}/{REPO}/pages")
    print("pages GET:", status, json.dumps(cur)[:200])
except urllib.error.HTTPError as e:
    print("pages GET:", e.code, "(not yet enabled)" if e.code == 404 else e.read()[:200])

try:
    status, out = api("POST", f"/repos/{OWNER}/{REPO}/pages", {"source": {"branch": "master", "path": "/"}})
    print("pages POST:", status, json.dumps(out)[:300])
except urllib.error.HTTPError as e:
    print("pages POST:", e.code, e.read()[:300])
    try:
        status, out = api("PUT", f"/repos/{OWNER}/{REPO}/pages", {"source": {"branch": "master", "path": "/"}})
        print("pages PUT:", status, json.dumps(out)[:300])
    except urllib.error.HTTPError as e2:
        print("pages PUT FAILED:", e2.code, e2.read()[:300]); sys.exit(1)

for i in range(30):
    try:
        with urllib.request.urlopen(SITE) as r:
            print(f"Pages live: HTTP {r.status} {SITE}"); break
    except urllib.error.HTTPError as e:
        print(f"poll {i}: HTTP {e.code}")
    except Exception as e:
        print(f"poll {i}: {e}")
    time.sleep(10)
else:
    print("Pages did not return 200 within 5 minutes — check the repo Pages settings."); sys.exit(1)
