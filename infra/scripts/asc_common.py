"""App Store Connect API access shared by the asc_*.py scripts.

Environment: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (the .p8 file).
"""
from __future__ import annotations

import os
import time
from pathlib import Path

import jwt
import requests

API = "https://api.appstoreconnect.apple.com"
session = requests.Session()


def token() -> str:
    now = int(time.time())
    return jwt.encode(
        {"iss": os.environ["ASC_ISSUER_ID"], "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"},
        Path(os.environ["ASC_KEY_PATH"]).read_text(),
        algorithm="ES256",
        headers={"kid": os.environ["ASC_KEY_ID"], "typ": "JWT"},
    )


def call(method: str, path: str, body: dict | None = None, params: dict | None = None) -> dict:
    session.headers["Authorization"] = f"Bearer {token()}"
    r = session.request(method, API + path, json=body, params=params, timeout=60)
    if r.status_code == 404 and method == "GET" and path.endswith(("/gameCenterDetail", "/gameCenterAchievementImage")):
        return {}
    if r.status_code >= 400:
        raise RuntimeError(f"{method} {path} -> {r.status_code}: {r.text[:1500]}")
    return r.json() if r.text else {}
