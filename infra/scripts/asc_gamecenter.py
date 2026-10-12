#!/usr/bin/env python3
"""Sets up Game Center in App Store Connect (idempotent).

One leaderboard (all-time online wins, counted by the game server) and four
achievements, with their English and Persian texts and images from
apps/mobile/store/gamecenter/. Ids match apps/mobile/gameCenter.ts. Adding
them to an app version happens on that version's page (or asc_prepare.py).

Environment: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (the .p8 file).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).parent))
from asc_common import call  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
GC = ROOT / "apps/mobile/store/gamecenter"
CONFIG = json.loads((GC / "gamecenter.json").read_text())
failures = 0


def report(ok: bool, text: str) -> None:
    global failures
    print(("[OK] " if ok else "[FAIL] ") + text)
    failures += not ok


app = call("GET", "/v1/apps", params={"filter[bundleId]": CONFIG["bundleId"]})["data"][0]
APP_ID = app["id"]

detail = call("GET", f"/v1/apps/{APP_ID}/gameCenterDetail").get("data")
if not detail:
    detail = call("POST", "/v1/gameCenterDetails", {"data": {"type": "gameCenterDetails", "relationships": {"app": {"data": {"type": "apps", "id": APP_ID}}}}})["data"]
    print("Game Center turned on for the app")
GID = detail["id"]


def existing(kind: str) -> dict[str, dict]:
    rows = call("GET", f"/v1/gameCenterDetails/{GID}/{kind}", params={"limit": 200})["data"]
    return {r["attributes"]["vendorIdentifier"]: r for r in rows}


def localizations(path: str) -> dict[str, dict]:
    rows = call("GET", path, params={"limit": 50})["data"]
    return {r["attributes"]["locale"]: r for r in rows}


def upload_image(loc_id: str, file: Path) -> None:
    current = call("GET", f"/v1/gameCenterAchievementLocalizations/{loc_id}/gameCenterAchievementImage").get("data")
    if current:
        return
    data = file.read_bytes()
    image = call("POST", "/v1/gameCenterAchievementImages", {"data": {"type": "gameCenterAchievementImages", "attributes": {"fileName": file.name, "fileSize": len(data)}, "relationships": {"gameCenterAchievementLocalization": {"data": {"type": "gameCenterAchievementLocalizations", "id": loc_id}}}}})["data"]
    for op in image["attributes"]["uploadOperations"]:
        chunk = data[op["offset"]: op["offset"] + op["length"]]
        headers = {h["name"]: h["value"] for h in op["requestHeaders"]}
        requests.request(op["method"], op["url"], data=chunk, headers=headers, timeout=120).raise_for_status()
    call("PATCH", f"/v1/gameCenterAchievementImages/{image['id']}", {"data": {"type": "gameCenterAchievementImages", "id": image["id"], "attributes": {"uploaded": True}}})


boards = existing("gameCenterLeaderboards")
for lb in CONFIG["leaderboards"]:
    try:
        row = boards.get(lb["id"]) or call("POST", "/v1/gameCenterLeaderboards", {"data": {"type": "gameCenterLeaderboards", "attributes": {
            "referenceName": lb["reference"], "vendorIdentifier": lb["id"], "defaultFormatter": "INTEGER",
            "submissionType": "BEST_SCORE", "scoreSortType": "DESC"},
            "relationships": {"gameCenterDetail": {"data": {"type": "gameCenterDetails", "id": GID}}}}})["data"]
        have = localizations(f"/v1/gameCenterLeaderboards/{row['id']}/localizations")
        for locale, text in lb["locales"].items():
            if locale in have:
                continue
            try:
                call("POST", "/v1/gameCenterLeaderboardLocalizations", {"data": {"type": "gameCenterLeaderboardLocalizations", "attributes": {"locale": locale, **text}, "relationships": {"gameCenterLeaderboard": {"data": {"type": "gameCenterLeaderboards", "id": row["id"]}}}}})
            except RuntimeError as error:
                report(False, f"leaderboard {lb['id']} {locale}: {error}")
        report(True, f"leaderboard {lb['id']}")
    except RuntimeError as error:
        report(False, f"leaderboard {lb['id']}: {error}")

achievements = existing("gameCenterAchievements")
for ach in CONFIG["achievements"]:
    try:
        row = achievements.get(ach["id"]) or call("POST", "/v1/gameCenterAchievements", {"data": {"type": "gameCenterAchievements", "attributes": {
            "referenceName": ach["reference"], "vendorIdentifier": ach["id"], "points": ach["points"],
            "showBeforeEarned": True, "repeatable": False},
            "relationships": {"gameCenterDetail": {"data": {"type": "gameCenterDetails", "id": GID}}}}})["data"]
        have = localizations(f"/v1/gameCenterAchievements/{row['id']}/localizations")
        for locale, text in ach["locales"].items():
            try:
                loc = have.get(locale) or call("POST", "/v1/gameCenterAchievementLocalizations", {"data": {"type": "gameCenterAchievementLocalizations", "attributes": {"locale": locale, **text}, "relationships": {"gameCenterAchievement": {"data": {"type": "gameCenterAchievements", "id": row["id"]}}}}})["data"]
                upload_image(loc["id"], GC / ach["image"])
            except RuntimeError as error:
                report(False, f"achievement {ach['id']} {locale}: {error}")
        report(True, f"achievement {ach['id']}")
    except RuntimeError as error:
        report(False, f"achievement {ach['id']}: {error}")

sys.exit(1 if failures else 0)
