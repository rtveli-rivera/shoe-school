#!/usr/bin/env python3
"""Bump the app version before a release.

Increments APP_VERSION in js/app.js, the CACHE version in sw.js, and rewrites
sw.js's ASSETS list from the files on disk, so every file the app loads is
cached for offline use. Bumping the cache is what makes an installed app notice
the new release and show its "Update" banner. It also sets the Android app's
versionName to the same version and raises its versionCode, so a new APK
installs over the old one.

Usage:
    py bump.py            # patch: 0.1.0 -> 0.1.1  (and sw v1 -> v2)
    py bump.py minor      # 0.1.0 -> 0.2.0
    py bump.py major      # 0.1.0 -> 1.0.0
    py bump.py assets     # only regenerate the ASSETS list, no version change
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
APP = ROOT / "js" / "app.js"
SW = ROOT / "sw.js"

APP_RE = re.compile(r"(const APP_VERSION = ')(\d+)\.(\d+)\.(\d+)(';)")
SW_RE = re.compile(r"(const CACHE = 'shoeschool-v)(\d+)(';)")
GRADLE = ROOT / "android" / "app" / "build.gradle"
LF = "\n"  # write files with Unix line endings, as the repo stores them
VCODE_RE = re.compile(r"(versionCode )(\d+)")
VNAME_RE = re.compile(r'(versionName ")([^"]*)(")')
ASSETS_RE = re.compile(r"(  // <assets>[^\n]*\n)(.*?)(  // </assets>)", re.S)

# Everything the browser loads at runtime.
RUNTIME_DIRS = ["css", "js", "icons"]
RUNTIME_FILES = ["index.html", "manifest.webmanifest"]


def asset_list():
    out = ["./"] + [f"./{f}" for f in RUNTIME_FILES]
    for d in RUNTIME_DIRS:
        for p in sorted((ROOT / d).rglob("*")):
            if p.is_file() and p.suffix in {".js", ".css", ".png", ".svg", ".json", ".webp", ".woff2"}:
                out.append("./" + p.relative_to(ROOT).as_posix())
    return out


def write_assets(sw_text):
    body = "".join(f"  '{a}',\n" for a in asset_list())
    if not ASSETS_RE.search(sw_text):
        raise SystemExit("Could not find the <assets> markers in sw.js")
    return ASSETS_RE.sub(lambda m: m.group(1) + body + m.group(3), sw_text, count=1)


def bump_app(text, part):
    m = APP_RE.search(text)
    if not m:
        raise SystemExit("Could not find APP_VERSION in js/app.js")
    major, minor, patch = int(m.group(2)), int(m.group(3)), int(m.group(4))
    if part == "major":
        major, minor, patch = major + 1, 0, 0
    elif part == "minor":
        minor, patch = minor + 1, 0
    else:
        patch += 1
    new = f"{major}.{minor}.{patch}"
    return APP_RE.sub(rf"\g<1>{new}\g<5>", text, count=1), new


def bump_sw(text):
    m = SW_RE.search(text)
    if not m:
        raise SystemExit("Could not find CACHE version in sw.js")
    n = int(m.group(2)) + 1
    return SW_RE.sub(rf"\g<1>{n}\g<3>", text, count=1), f"v{n}"


def bump_android(version):
    if not GRADLE.exists():
        return None
    text = GRADLE.read_text(encoding="utf-8")
    m = VCODE_RE.search(text)
    if not m or not VNAME_RE.search(text):
        raise SystemExit("Could not find versionCode/versionName in android/app/build.gradle")
    code = int(m.group(2)) + 1
    text = VCODE_RE.sub(rf"\g<1>{code}", text, count=1)
    text = VNAME_RE.sub(rf'\g<1>{version}\g<3>', text, count=1)
    GRADLE.write_text(text, encoding="utf-8", newline=LF)
    return code


def main():
    part = sys.argv[1] if len(sys.argv) > 1 else "patch"
    if part not in ("patch", "minor", "major", "assets"):
        raise SystemExit("Argument must be one of: patch, minor, major, assets")

    sw_text = write_assets(SW.read_text(encoding="utf-8"))
    if part == "assets":
        SW.write_text(sw_text, encoding="utf-8", newline=LF)
        print(f"sw.js ASSETS regenerated ({len(asset_list())} files)")
        return

    app_text, app_ver = bump_app(APP.read_text(encoding="utf-8"), part)
    sw_text, sw_ver = bump_sw(sw_text)
    APP.write_text(app_text, encoding="utf-8", newline=LF)
    SW.write_text(sw_text, encoding="utf-8", newline=LF)
    code = bump_android(app_ver)
    android = f", Android {app_ver} (versionCode {code})" if code else ""
    print(f"APP_VERSION -> {app_ver}, sw cache -> shoeschool-{sw_ver}, {len(asset_list())} assets{android}")


if __name__ == "__main__":
    main()
