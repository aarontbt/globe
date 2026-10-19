"""Package the latest weather and cyclone feeds for the static site build."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import struct
import sys
import tempfile
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent.parent
WEATHER_SOURCE = ROOT / "public/weather"
CYCLONE_SOURCE = ROOT / "public/cyclones"
OUTPUT = ROOT / "public/data/daily-snapshot"


def read_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def resolve_asset(root: Path, base: Path, value: object) -> Path:
    if not isinstance(value, str) or not value:
        raise ValueError("Missing source asset path")
    parsed = urlsplit(value)
    relative = PurePosixPath(parsed.path)
    if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment or relative.is_absolute() or ".." in relative.parts:
        raise ValueError(f"Unsafe source asset path: {value}")
    path = (base / Path(*relative.parts)).resolve()
    if not path.is_relative_to(root.resolve()) or not path.is_file():
        raise ValueError(f"Missing source asset: {value}")
    return path


def verified_png(source: Path, expected_bytes: object, expected_hash: object,
                 expected_width: object, expected_height: object) -> bytes:
    payload = source.read_bytes()
    if not isinstance(expected_bytes, int) or len(payload) != expected_bytes:
        raise ValueError(f"Image size does not match manifest: {source}")
    if not isinstance(expected_hash, str) or hashlib.sha256(payload).hexdigest() != expected_hash:
        raise ValueError(f"Image checksum does not match manifest: {source}")
    if len(payload) < 24 or payload[:8] != b"\x89PNG\r\n\x1a\n" or payload[12:16] != b"IHDR":
        raise ValueError(f"Invalid PNG image: {source}")
    width, height = struct.unpack(">II", payload[16:24])
    if width != expected_width or height != expected_height:
        raise ValueError(f"Image dimensions do not match manifest: {source}")
    return payload


def package_weather(stage: Path) -> int:
    manifest_path = WEATHER_SOURCE / "manifest.json"
    manifest = read_json(manifest_path)
    patches = manifest.get("patches")
    if manifest.get("schemaVersion") != "weather-imagery-v1" or not isinstance(patches, list) or len(patches) != 8:
        raise ValueError("Weather manifest is missing a complete latest frame")

    frame_output = stage / "weather/frames/latest"
    frame_output.mkdir(parents=True, exist_ok=True)
    seen = set()
    for patch in patches:
        if not isinstance(patch, dict):
            raise ValueError("Invalid weather patch")
        patch_id = patch.get("id")
        if not isinstance(patch_id, str) or patch_id not in {f"{row}-{col}" for row in range(2) for col in range(4)} or patch_id in seen:
            raise ValueError("Invalid weather patch id")
        seen.add(patch_id)
        source = resolve_asset(WEATHER_SOURCE, manifest_path.parent, patch.get("url"))
        payload = verified_png(source, patch.get("bytes"), patch.get("sha256"), patch.get("width"), patch.get("height"))
        (frame_output / f"{patch_id}.png").write_bytes(payload)
        patch["url"] = f"weather/frames/latest/{patch_id}.png"
    if len(seen) != 8:
        raise ValueError("Weather frame does not cover all sectors")

    polar_url = manifest.get("polarUrl")
    if polar_url is not None:
        polar_path = resolve_asset(WEATHER_SOURCE, manifest_path.parent, polar_url)
        polar_manifest = read_json(polar_path)
        polar_patches = polar_manifest.get("patches")
        if polar_manifest.get("schemaVersion") != "polar-clouds-v1" or not isinstance(polar_patches, list) or len(polar_patches) != 8:
            raise ValueError("Polar weather manifest is incomplete")
        polar_output = stage / "weather/polar/latest"
        polar_output.mkdir(parents=True, exist_ok=True)
        polar_ids = set()
        for patch in polar_patches:
            if not isinstance(patch, dict):
                raise ValueError("Invalid polar weather patch")
            patch_id = patch.get("id")
            if not isinstance(patch_id, str) or patch_id not in {f"{hemisphere}-{col}" for hemisphere in ("north", "south") for col in range(4)} or patch_id in polar_ids:
                raise ValueError("Invalid polar weather patch id")
            polar_ids.add(patch_id)
            source = resolve_asset(WEATHER_SOURCE, polar_path.parent, patch.get("url"))
            payload = verified_png(source, patch.get("bytes"), patch.get("sha256"), patch.get("width"), patch.get("height"))
            (polar_output / f"{patch_id}.png").write_bytes(payload)
            patch["url"] = f"{patch_id}.png"
        if len(polar_ids) != 8:
            raise ValueError("Polar image does not cover both caps")
        write_json(polar_output / "manifest.json", polar_manifest)
        manifest["polarUrl"] = "weather/polar/latest/manifest.json"

    manifest["deliveryMode"] = "daily"
    manifest["staleAfterMinutes"] = 1560
    manifest["history"] = []
    write_json(stage / "weather.json", manifest)
    return sum(int(patch["bytes"]) for patch in patches)


def package_cyclones(stage: Path) -> int:
    manifest = read_json(CYCLONE_SOURCE / "manifest.json")
    if manifest.get("schemaVersion") != "cyclone-forecast-v1" or not isinstance(manifest.get("storms"), list):
        raise ValueError("Cyclone forecast manifest is invalid")
    manifest["deliveryMode"] = "daily"
    path = stage / "cyclones.json"
    write_json(path, manifest)
    return path.stat().st_size


def promote(stage: Path) -> None:
    backup = OUTPUT.with_name(f".{OUTPUT.name}-backup-{os.getpid()}")
    if backup.exists():
        shutil.rmtree(backup)
    had_previous = OUTPUT.exists()
    if had_previous:
        OUTPUT.rename(backup)
    try:
        stage.rename(OUTPUT)
    except Exception:
        if had_previous and backup.exists():
            backup.rename(OUTPUT)
        raise
    if backup.exists():
        shutil.rmtree(backup)


def main() -> None:
    parent = OUTPUT.parent
    parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix=".daily-snapshot-", dir=parent))
    try:
        weather_bytes = package_weather(stage)
        cyclone_bytes = package_cyclones(stage)
        promote(stage)
    except Exception:
        if stage.exists():
            shutil.rmtree(stage)
        raise
    print(json.dumps({"output": str(OUTPUT.relative_to(ROOT)), "weatherPngBytes": weather_bytes,
                      "cycloneJsonBytes": cyclone_bytes}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Daily weather package failed: {error}", file=sys.stderr)
        raise SystemExit(1)
