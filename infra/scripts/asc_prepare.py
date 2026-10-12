#!/usr/bin/env python3
"""Prepares the App Store listing through the App Store Connect API.

Fills in what the API allows (texts, URLs, category, age rating, content
rights, price, availability, screenshots, review notes, build) from
apps/mobile/store/. It never submits for review: the owner does that in
App Store Connect after the steps the API cannot do (App Privacy answers,
review contact name/phone). Every step is idempotent and reported.

Environment: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (the .p8 file).
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from pathlib import Path

import jwt
import requests

ROOT = Path(__file__).resolve().parents[2]
STORE = ROOT / "apps/mobile/store"
META = json.loads((STORE / "metadata.json").read_text())
API = "https://api.appstoreconnect.apple.com"
results: list[tuple[str, str]] = []


def token() -> str:
    key = Path(os.environ["ASC_KEY_PATH"]).read_text()
    now = int(time.time())
    return jwt.encode(
        {"iss": os.environ["ASC_ISSUER_ID"], "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"},
        key,
        algorithm="ES256",
        headers={"kid": os.environ["ASC_KEY_ID"], "typ": "JWT"},
    )


session = requests.Session()


def call(method: str, path: str, body: dict | None = None, params: dict | None = None) -> dict:
    session.headers["Authorization"] = f"Bearer {token()}"
    r = session.request(method, API + path, json=body, params=params, timeout=60)
    if r.status_code == 404 and method == "GET" and path.endswith("/gameCenterDetail"):
        return {}
    if r.status_code >= 400:
        raise RuntimeError(f"{method} {path} -> {r.status_code}: {r.text[:1500]}")
    return r.json() if r.text else {}


def patch_dropping_unknown(path: str, kind: str, rid: str, attributes: dict) -> list[str]:
    """PATCH, retrying without attributes this API version does not know."""
    dropped: list[str] = []
    attrs = dict(attributes)
    for _ in range(len(attributes) + 1):
        try:
            call("PATCH", path, {"data": {"type": kind, "id": rid, "attributes": attrs}})
            return dropped
        except RuntimeError as error:
            text = str(error)
            try:
                errors = json.loads(text.split(": ", 1)[1])["errors"]
            except (IndexError, ValueError, KeyError):
                raise error
            bad = [
                e.get("source", {}).get("pointer", "").rsplit("/", 1)[-1]
                for e in errors
            ]
            bad = [a for a in bad if a in attrs]
            if not bad:
                raise
            for a in bad:
                attrs.pop(a)
                dropped.append(a)
    raise RuntimeError("could not PATCH " + path)


def step(name: str):
    def wrap(fn):
        try:
            note = fn() or "ok"
            results.append(("OK", f"{name}: {note}"))
        except Exception as error:  # report and continue with the next step
            results.append(("FAIL", f"{name}: {error}"))
        return fn
    return wrap


app = call("GET", "/v1/apps", params={"filter[bundleId]": META["bundleId"]})["data"]
if not app:
    sys.exit(f"No App Store Connect app with bundle id {META['bundleId']}")
app = app[0]
APP_ID = app["id"]
LOCALE = META["locale"]
print(f"App {app['attributes']['name']} ({APP_ID}), primary locale {app['attributes'].get('primaryLocale')}")


@step("content rights")
def _():
    call("PATCH", f"/v1/apps/{APP_ID}", {"data": {"type": "apps", "id": APP_ID, "attributes": {"contentRightsDeclaration": META["contentRightsDeclaration"]}}})


infos = call("GET", f"/v1/apps/{APP_ID}/appInfos")["data"]
EDITABLE = {"PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "WAITING_FOR_REVIEW"}
info = next((i for i in infos if i["attributes"].get("appStoreState", i["attributes"].get("state")) in EDITABLE | {"PREPARE_FOR_SUBMISSION"}), infos[0])
INFO_ID = info["id"]


@step("app name, subtitle, privacy URL")
def _():
    locs = call("GET", f"/v1/appInfos/{INFO_ID}/appInfoLocalizations")["data"]
    attrs = {"name": META["name"], "subtitle": META["subtitle"], "privacyPolicyUrl": META["privacyPolicyUrl"]}
    loc = next((l for l in locs if l["attributes"]["locale"] == LOCALE), None)
    if loc:
        call("PATCH", f"/v1/appInfoLocalizations/{loc['id']}", {"data": {"type": "appInfoLocalizations", "id": loc["id"], "attributes": attrs}})
    else:
        call("POST", "/v1/appInfoLocalizations", {"data": {"type": "appInfoLocalizations", "attributes": {"locale": LOCALE, **attrs}, "relationships": {"appInfo": {"data": {"type": "appInfos", "id": INFO_ID}}}}})
    return ", ".join(l["attributes"]["locale"] for l in locs) or LOCALE


@step("category Games › Board, Family")
def _():
    rel = lambda cid: {"data": {"type": "appCategories", "id": cid}}
    call("PATCH", f"/v1/appInfos/{INFO_ID}", {"data": {"type": "appInfos", "id": INFO_ID, "relationships": {
        "primaryCategory": rel(META["primaryCategory"]),
        "primarySubcategoryOne": rel(META["primarySubcategoryOne"]),
        "primarySubcategoryTwo": rel(META["primarySubcategoryTwo"]),
    }}})


@step("age rating (no objectionable content)")
def _():
    decl = call("GET", f"/v1/appInfos/{INFO_ID}/ageRatingDeclaration")["data"]
    levels = [
        "alcoholTobaccoOrDrugUseOrReferences", "contests", "gamblingSimulated", "gunsOrOtherWeapons",
        "horrorOrFearThemes", "matureOrSuggestiveThemes", "medicalOrTreatmentInformation",
        "profanityOrCrudeHumor", "sexualContentGraphicAndNudity", "sexualContentOrNudity",
        "violenceCartoonOrFantasy", "violenceRealistic", "violenceRealisticProlongedGraphicOrSadistic",
    ]
    attrs: dict = {k: "NONE" for k in levels}
    attrs.update({
        "gambling": False, "unrestrictedWebAccess": False, "lootBox": False,
        "messagingAndChat": False, "parentalControls": False, "ageAssurance": False,
        "userGeneratedContent": False, "advertising": False, "healthOrWellnessTopics": False,
    })
    dropped = patch_dropping_unknown(f"/v1/ageRatingDeclarations/{decl['id']}", "ageRatingDeclarations", decl["id"], attrs)
    return "dropped unknown: " + ", ".join(dropped) if dropped else "ok"


@step("price: free")
def _():
    try:
        call("GET", f"/v1/apps/{APP_ID}/appPriceSchedule")
        existing = True
    except RuntimeError:
        existing = False
    points = call("GET", f"/v1/apps/{APP_ID}/appPricePoints", params={"filter[territory]": "USA", "limit": 200})["data"]
    free = next(p for p in points if float(p["attributes"]["customerPrice"]) == 0)
    call("POST", "/v1/appPriceSchedules", {
        "data": {"type": "appPriceSchedules", "relationships": {
            "app": {"data": {"type": "apps", "id": APP_ID}},
            "baseTerritory": {"data": {"type": "territories", "id": "USA"}},
            "manualPrices": {"data": [{"type": "appPrices", "id": "${free}"}]},
        }},
        "included": [{"type": "appPrices", "id": "${free}", "attributes": {"startDate": None},
                      "relationships": {"appPricePoint": {"data": {"type": "appPricePoints", "id": free["id"]}}}}],
    })
    return "replaced existing schedule" if existing else "created"


@step("availability: all territories")
def _():
    try:
        current = call("GET", f"/v1/apps/{APP_ID}/appAvailabilityV2")["data"]
        if current:
            return "already set (left unchanged)"
    except RuntimeError:
        pass
    territories = call("GET", "/v1/territories", params={"limit": 200})["data"]
    ids = [t["id"] for t in territories]
    call("POST", "/v2/appAvailabilities", {
        "data": {"type": "appAvailabilities", "attributes": {"availableInNewTerritories": True}, "relationships": {
            "app": {"data": {"type": "apps", "id": APP_ID}},
            "territoryAvailabilities": {"data": [{"type": "territoryAvailabilities", "id": f"${{{t}}}"} for t in ids]},
        }},
        "included": [{"type": "territoryAvailabilities", "id": f"${{{t}}}", "attributes": {"available": True},
                      "relationships": {"territory": {"data": {"type": "territories", "id": t}}}} for t in ids],
    })
    return f"{len(ids)} territories"


versions = call("GET", f"/v1/apps/{APP_ID}/appStoreVersions", params={"filter[platform]": "IOS", "limit": 10})["data"]
version = next((v for v in versions if v["attributes"]["appStoreState"] in EDITABLE), None)
if version is None:
    version = call("POST", "/v1/appStoreVersions", {"data": {"type": "appStoreVersions", "attributes": {"platform": "IOS", "versionString": META["versionString"]}, "relationships": {"app": {"data": {"type": "apps", "id": APP_ID}}}}})["data"]
VERSION_ID = version["id"]
print(f"Version {version['attributes']['versionString']} ({version['attributes']['appStoreState']})")


@step(f"version {META['versionString']}, copyright, manual release")
def _():
    call("PATCH", f"/v1/appStoreVersions/{VERSION_ID}", {"data": {"type": "appStoreVersions", "id": VERSION_ID, "attributes": {
        "versionString": META["versionString"], "copyright": META["copyright"], "releaseType": META["releaseType"]}}})


def version_localization() -> str:
    locs = call("GET", f"/v1/appStoreVersions/{VERSION_ID}/appStoreVersionLocalizations")["data"]
    loc = next((l for l in locs if l["attributes"]["locale"] == LOCALE), None)
    if loc:
        return loc["id"]
    return call("POST", "/v1/appStoreVersionLocalizations", {"data": {"type": "appStoreVersionLocalizations", "attributes": {"locale": LOCALE}, "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": VERSION_ID}}}}})["data"]["id"]


VLOC = version_localization()


@step("description, keywords, promotional text, URLs")
def _():
    call("PATCH", f"/v1/appStoreVersionLocalizations/{VLOC}", {"data": {"type": "appStoreVersionLocalizations", "id": VLOC, "attributes": {
        "description": META["description"], "keywords": META["keywords"], "promotionalText": META["promotionalText"],
        "supportUrl": META["supportUrl"], "marketingUrl": META["marketingUrl"]}}})
    if META.get("whatsNew"):
        try:
            call("PATCH", f"/v1/appStoreVersionLocalizations/{VLOC}", {"data": {"type": "appStoreVersionLocalizations", "id": VLOC, "attributes": {"whatsNew": META["whatsNew"]}}})
        except RuntimeError as error:
            if "whatsNew" not in str(error):
                raise
            return "ok (no What's New on a first version)"


def upload_screenshots(pattern: str, display_type: str) -> str:
    files = sorted((STORE / "screenshots").glob(pattern))
    if not files:
        return "no files"
    sets = call("GET", f"/v1/appStoreVersionLocalizations/{VLOC}/appScreenshotSets")["data"]
    shot_set = next((s for s in sets if s["attributes"]["screenshotDisplayType"] == display_type), None)
    if shot_set is None:
        shot_set = call("POST", "/v1/appScreenshotSets", {"data": {"type": "appScreenshotSets", "attributes": {"screenshotDisplayType": display_type}, "relationships": {"appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": VLOC}}}}})["data"]
    for old in call("GET", f"/v1/appScreenshotSets/{shot_set['id']}/appScreenshots")["data"]:
        call("DELETE", f"/v1/appScreenshots/{old['id']}")
    for f in files:
        data = f.read_bytes()
        shot = call("POST", "/v1/appScreenshots", {"data": {"type": "appScreenshots", "attributes": {"fileName": f.name, "fileSize": len(data)}, "relationships": {"appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": shot_set["id"]}}}}})["data"]
        for op in shot["attributes"]["uploadOperations"]:
            chunk = data[op["offset"]: op["offset"] + op["length"]]
            headers = {h["name"]: h["value"] for h in op["requestHeaders"]}
            requests.request(op["method"], op["url"], data=chunk, headers=headers, timeout=120).raise_for_status()
        call("PATCH", f"/v1/appScreenshots/{shot['id']}", {"data": {"type": "appScreenshots", "id": shot["id"], "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(data).hexdigest()}}})
    return f"{len(files)} uploaded"


@step("iPhone 6.7\" screenshots")
def _():
    return upload_screenshots("iphone-67-*.png", "APP_IPHONE_67")


@step("iPad 13\" screenshots")
def _():
    return upload_screenshots("ipad-13-*.png", "APP_IPAD_PRO_3GEN_129")


@step("App Review notes and contact email")
def _():
    attrs = {"contactEmail": META["review"]["contactEmail"], "notes": META["review"]["notes"], "demoAccountRequired": False}
    try:
        detail = call("GET", f"/v1/appStoreVersions/{VERSION_ID}/appStoreReviewDetail")["data"]
    except RuntimeError:
        detail = None
    if detail:
        call("PATCH", f"/v1/appStoreReviewDetails/{detail['id']}", {"data": {"type": "appStoreReviewDetails", "id": detail["id"], "attributes": attrs}})
        return "ok"
    try:
        call("POST", "/v1/appStoreReviewDetails", {"data": {"type": "appStoreReviewDetails", "attributes": attrs, "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": VERSION_ID}}}}})
    except RuntimeError as error:
        # Apple needs the owner's name and phone before it stores the notes.
        if "contactPhone" in str(error):
            return "TODO owner: enter contact name + phone, then paste the notes from apps/mobile/store/metadata.json"
        raise
    return "ok"


@step("build")
def _():
    deadline = time.time() + 45 * 60
    while True:
        builds = call("GET", "/v1/builds", params={"filter[app]": APP_ID, "filter[preReleaseVersion.version]": META["versionString"], "sort": "-uploadedDate", "limit": 5})["data"]
        valid = [b for b in builds if b["attributes"]["processingState"] == "VALID" and not b["attributes"].get("expired")]
        newest = builds[0] if builds else None
        if newest and newest["attributes"]["processingState"] == "PROCESSING" and time.time() < deadline:
            print(f"waiting for build {newest['attributes']['version']} to finish processing…")
            time.sleep(60)
            continue
        if not valid:
            raise RuntimeError("no processed build for " + META["versionString"])
        build = max(valid, key=lambda b: int(b["attributes"]["version"]))
        call("PATCH", f"/v1/appStoreVersions/{VERSION_ID}/relationships/build", {"data": {"type": "builds", "id": build["id"]}})
        return "build " + build["attributes"]["version"]


@step("Game Center on this version")
def _():
    detail = call("GET", f"/v1/apps/{APP_ID}/gameCenterDetail").get("data")
    if not detail:
        return "Game Center not set up (run asc_gamecenter.py)"
    try:
        current = call("GET", f"/v1/appStoreVersions/{VERSION_ID}/gameCenterAppVersion").get("data")
    except RuntimeError:
        current = None
    if current:
        return "already on"
    call("POST", "/v1/gameCenterAppVersions", {"data": {"type": "gameCenterAppVersions", "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": VERSION_ID}}}}})
    return "on (check its leaderboard and achievements on the version page)"


print()
for status, line in results:
    print(f"[{status}] {line}")
print("\nNot submitted for review. Still to do in App Store Connect by the owner:")
print("- App Privacy questionnaire (not available in the API)")
print("- App Review contact first/last name and phone number")
print("- Check everything, then 'Add for Review' / 'Submit'")
if any(s == "FAIL" for s, _ in results):
    sys.exit(1)
