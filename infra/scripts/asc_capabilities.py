#!/usr/bin/env python3
"""Turns on the App ID capabilities the app's entitlements need (idempotent).

iCloud key-value storage keeps the coin wallet's recovery code across
reinstalls; Game Center carries the online-wins leaderboard and achievements. Uses the same App Store Connect API key as the release.
Environment: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH, BUNDLE_ID.
"""
import os
import sys
import time
from pathlib import Path

import jwt
import requests

API = "https://api.appstoreconnect.apple.com"


def headers() -> dict:
    now = int(time.time())
    token = jwt.encode(
        {"iss": os.environ["ASC_ISSUER_ID"], "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"},
        Path(os.environ["ASC_KEY_PATH"]).read_text(),
        algorithm="ES256",
        headers={"kid": os.environ["ASC_KEY_ID"], "typ": "JWT"},
    )
    return {"Authorization": f"Bearer {token}"}


bundle = os.environ.get("BUNDLE_ID", "com.espadna.mench")
r = requests.get(f"{API}/v1/bundleIds", params={"filter[identifier]": bundle}, headers=headers(), timeout=60)
r.raise_for_status()
ids = [b for b in r.json()["data"] if b["attributes"]["identifier"] == bundle]
if not ids:
    sys.exit(f"Bundle id {bundle} not found")
bid = ids[0]["id"]
caps = requests.get(f"{API}/v1/bundleIds/{bid}/bundleIdCapabilities", headers=headers(), timeout=60)
caps.raise_for_status()
have = {c["attributes"]["capabilityType"] for c in caps.json()["data"]}
print("Capabilities:", ", ".join(sorted(have)) or "none")
if "ICLOUD" in have:
    print("iCloud already on")
else:
    body = {"data": {"type": "bundleIdCapabilities", "attributes": {
        "capabilityType": "ICLOUD",
        "settings": [{"key": "ICLOUD_VERSION", "options": [{"key": "XCODE_6"}]}],
    }, "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": bid}}}}}
    r = requests.post(f"{API}/v1/bundleIdCapabilities", json=body, headers=headers(), timeout=60)
    if r.status_code >= 400:
        sys.exit(f"Could not enable iCloud: {r.status_code} {r.text[:800]}")
    print("iCloud turned on")

if "GAME_CENTER" in have:
    print("Game Center already on")
else:
    body = {"data": {"type": "bundleIdCapabilities", "attributes": {"capabilityType": "GAME_CENTER"},
                     "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": bid}}}}}
    r = requests.post(f"{API}/v1/bundleIdCapabilities", json=body, headers=headers(), timeout=60)
    if r.status_code >= 400:
        sys.exit(f"Could not enable Game Center: {r.status_code} {r.text[:800]}")
    print("Game Center turned on")
