"""Publish complete, georeferenced GMGSI IR frames; no credentials required.

Run with a scheduler every 15 minutes. Output is a standalone static directory
for a CDN, or public/weather during local development. Never edits GDACS data.
"""
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import fcntl
import importlib.util
import json
from pathlib import Path
import re
import shutil
import sys
import tempfile
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

import numpy as np
from netCDF4 import Dataset
from PIL import Image

BUCKET = "https://noaa-gmgsi-pds.s3.amazonaws.com"
NS = {"s": "http://s3.amazonaws.com/doc/2006-03-01/"}
MAX_DOWNLOAD = 40 * 1024 * 1024
VERSION = "gmgsi-ir-nearest-v3"
polar_spec = importlib.util.spec_from_file_location("weather_polar", Path(__file__).with_name("weather-polar.py"))
polar_module = importlib.util.module_from_spec(polar_spec)
polar_spec.loader.exec_module(polar_module)


def utc(value):
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("Timestamp requires a timezone")
    return result.astimezone(timezone.utc)


def iso(value):
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def download(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        payload = response.read(MAX_DOWNLOAD + 1)
    if len(payload) > MAX_DOWNLOAD:
        raise ValueError("Source exceeds download limit")
    return payload


def discover(now, fetch=download, history_hours=48):
    """List recent UTC days, including pagination; reject future observations."""
    objects = []
    for days_back in range(history_hours // 24 + 2):
        prefix = (now - timedelta(days=days_back)).strftime("GMGSI_LW/%Y/%m/%d/")
        token = None
        while True:
            query = {"list-type": "2", "prefix": prefix}
            if token:
                query["continuation-token"] = token
            root = ET.fromstring(fetch(f"{BUCKET}/?{urllib.parse.urlencode(query)}"))
            for item in root.findall("s:Contents", NS):
                key = item.findtext("s:Key", "", NS)
                match = re.fullmatch(r"GMGSI_LW/\d{4}/\d{2}/\d{2}/\d{2}/GLOBCOMPLIR_v\w+_blend_s(\d{14})\d_e\d+_c\d+\.nc", key)
                if match and int(item.findtext("s:Size", "0", NS)) <= MAX_DOWNLOAD:
                    observed = datetime.strptime(match[1], "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
                    if observed <= now:
                        objects.append((observed, key))
            if root.findtext("s:IsTruncated", "false", NS) != "true":
                break
            next_token = root.findtext("s:NextContinuationToken", "", NS)
            if not next_token or next_token == token:
                raise ValueError("Invalid listing pagination")
            token = next_token
    if not objects:
        raise ValueError("No recent GMGSI longwave observations available")
    return sorted(set(objects), reverse=True)


def nearest_indices(axis, targets):
    right = np.clip(np.searchsorted(axis, targets), 1, len(axis) - 1)
    left = right - 1
    return np.where(abs(targets - axis[left]) <= abs(targets - axis[right]), left, right)


def resample(data, dqf, lat, lon, width=2048):
    """Use supplied pixel centres, not metadata's nominal resolution.

    The current product has a separable Mercator-like latitude axis and a
    longitude wrap in its first column. Fail closed if that layout changes.
    Only quality flag zero is retained; all other/unknown flags are transparent.
    """
    if data.ndim != 2 or data.shape != lat.shape or data.shape != lon.shape or data.shape != dqf.shape:
        raise ValueError("Inconsistent source grids")
    if np.ma.getmaskarray(lat).any() or np.ma.getmaskarray(lon).any():
        raise ValueError("Masked navigation grid")
    lat, lon = np.asarray(lat, dtype=np.float64), np.asarray(lon, dtype=np.float64)
    if not np.isfinite(lat).all() or not np.isfinite(lon).all():
        raise ValueError("Non-finite navigation grid")
    if not np.allclose(lat, lat[:, :1], atol=1e-4) or not np.allclose(lon, lon[:1, :], atol=1e-4):
        raise ValueError("Unsupported non-separable navigation grid")
    ys = lat[:, 0]
    xs = (lon[0, :] + 180) % 360 - 180
    if np.any(np.diff(ys) >= 0) or np.any(abs(ys) > 90):
        raise ValueError("Unsupported latitude axis")
    order = np.argsort(xs)
    xs = xs[order]
    dx = float(np.median(np.diff(xs)))
    # NOAA's seam column is slightly wider than the interior grid spacing.
    if dx <= 0 or np.any(np.diff(xs) < dx * 0.5) or np.any(np.diff(xs) > dx * 1.5):
        raise ValueError("Unsupported longitude axis")
    if abs(dx * len(xs) - 360) > 0.2:
        raise ValueError("Incomplete global longitude grid")
    north = min(90.0, float(ys[0] + (ys[0] - ys[1]) / 2))
    south = max(-90.0, float(ys[-1] - (ys[-2] - ys[-1]) / 2))
    height = int(np.ceil((north - south) / 360 * width / 2) * 2)
    tx = -180 + (np.arange(width) + 0.5) * 360 / width
    ty = north - (np.arange(height) + 0.5) * (north - south) / height
    # Extend the longitude axis cyclically so sampling at the dateline wraps.
    cyclic_x = np.concatenate(([xs[-1] - 360], xs, [xs[0] + 360]))
    cyclic_order = np.concatenate(([order[-1]], order, [order[0]]))
    ix = cyclic_order[nearest_indices(cyclic_x, tx)]
    iy = len(ys) - 1 - nearest_indices(ys[::-1], ty)
    values = data[np.ix_(iy, ix)]
    quality = dqf[np.ix_(iy, ix)]
    good = (~np.ma.getmaskarray(values) & ~np.ma.getmaskarray(quality)
            & np.isfinite(np.ma.getdata(values)) & (np.ma.getdata(quality) == 0)
            & (np.ma.getdata(values) >= 0) & (np.ma.getdata(values) <= 255))
    gray = np.clip(np.ma.filled(values, 0), 0, 255).astype(np.uint8)
    # Display enhancement, not a cloud classification: dim image brightness
    # fades into the basemap while brighter structures remain prominent.
    emphasis = (np.clip((gray.astype(float) - 80) / 175, 0, 1) ** 1.4 * 255).astype(np.uint8)
    edge_fade = np.clip((np.where(ty > 0, north, -south) - abs(ty)) / (np.where(ty > 0, north, -south) - 68), 0, 1)
    # Fade only a real polar overlap, never stretch the IR grid to the poles.
    if north > 68 and south < -68:
        emphasis = (emphasis * edge_fade[:, None]).astype(np.uint8)
    rgba = np.stack([gray, gray, gray, np.where(good, emphasis, 0).astype(np.uint8)], axis=-1)
    if not good.any():
        raise ValueError("Observation has no usable pixels")
    return rgba, [-180, south, 180, north]


def convert(source_file, output, source_url, now, publish=True, history_hours=48, polar_url=None):
    started = time.monotonic()
    source_hash = hashlib.sha256(source_file.read_bytes()).hexdigest()
    with Dataset(source_file) as ds:
        if (ds.title != "GLOBCOMPLIR" or ds["data"].shape[0] != 1
                or ds["data"].long_name != "0-255 Brightness Temperature"):
            raise ValueError("Unexpected GMGSI product")
        start, end = utc(ds.time_coverage_start), utc(ds.time_coverage_end)
        if end < start or end > now + timedelta(minutes=5):
            raise ValueError("Invalid observation interval")
        rgba, bounds = resample(ds["data"][0], ds["dqf"][0], ds["lat"][:], ds["lon"][:])
        created = ds.date_created
        contributors = str(ds.source)
    previous_manifest = output / "manifest.json"
    if publish and previous_manifest.exists():
        previous = json.loads(previous_manifest.read_text())
        if utc(previous["observedAt"]) > start:
            raise ValueError("Refusing to replace a newer observation")
    frame_id = f"{start.strftime('%Y%m%dT%H%M%SZ')}-{source_hash[:16]}-{VERSION}"
    if polar_url:
        frame_id += '-' + hashlib.sha256(polar_url.encode()).hexdigest()[:8]
    frame_dir = output / "frames" / frame_id
    frame_dir.mkdir(parents=True, exist_ok=True)
    height, width = rgba.shape[:2]
    patches = []
    for row in range(2):
        for col in range(4):
            x0, x1 = col * width // 4, (col + 1) * width // 4
            y0, y1 = row * height // 2, (row + 1) * height // 2
            name = f"{row}-{col}.png"
            asset = frame_dir / name
            Image.fromarray(rgba[y0:y1, x0:x1]).save(asset, optimize=True)
            patches.append({
                "id": f"{row}-{col}", "url": f"frames/{frame_id}/{name}",
                "bounds": [-180 + x0 / width * 360, bounds[3] - y1 / height * (bounds[3] - bounds[1]),
                           -180 + x1 / width * 360, bounds[3] - y0 / height * (bounds[3] - bounds[1])],
                "width": x1 - x0, "height": y1 - y0,
                "bytes": asset.stat().st_size, "sha256": hashlib.sha256(asset.read_bytes()).hexdigest(),
            })
    manifest = {
        "schemaVersion": "weather-imagery-v1", "sourceId": "noaa-gmgsi-lw",
        "sourceUrl": source_url, "sourceSha256": source_hash,
        "frameId": frame_id, "observedAt": iso(start), "observationEnd": iso(end),
        "sourceCreatedAt": created, "generatedAt": iso(now), "processingVersion": VERSION,
        "channel": "longwave-infrared", "projection": "EPSG:4326", "bounds": bounds,
        "resolutionKm": 8, "staleAfterMinutes": 120,
        "attribution": "NOAA/NESDIS GMGSI · GOES, Meteosat, Himawari · resampled infrared imagery",
        "valueDescription": "Infrared brightness (0–255); brightness-based opacity enhancement, not a cloud mask or temperature scale",
        "contributors": contributors, "patches": patches,
    }
    if polar_url:
        manifest["polarUrl"] = '../../' + polar_url
    # Historical frame manifests use paths relative to their own directory.
    frame_manifest = {**manifest, "patches": [{**p, "url": Path(p["url"]).name} for p in patches]}
    atomic_json(frame_dir / "manifest.json", frame_manifest)
    if publish:
        publish_catalog(output, frame_manifest, now, history_hours)
    return {"frameId": frame_id, "sourceBytes": source_file.stat().st_size,
            "imageBytes": sum(p["bytes"] for p in patches), "decodedBytes": int(rgba.nbytes),
            "processingSeconds": round(time.monotonic() - started, 3), "bounds": bounds}


def cached_frames(output):
    frames = []
    for path in (output / "frames").glob("*/manifest.json"):
        try:
            manifest = json.loads(path.read_text())
            if manifest["processingVersion"] != VERSION:
                continue
            if len(manifest["patches"]) != 8:
                continue
            if all((path.parent / p["url"]).stat().st_size == p["bytes"]
                   and hashlib.sha256((path.parent / p["url"]).read_bytes()).hexdigest() == p["sha256"]
                   for p in manifest["patches"]):
                frames.append(manifest)
        except (OSError, ValueError, KeyError):
            continue
    return frames


def rebind_polar(frame, output, polar_url, now):
    """Reuse verified IR pixels when only the polar supplement changes."""
    base_id = frame['frameId'].rsplit('-', 1)[0] if frame.get('polarUrl') else frame['frameId']
    frame_id = base_id + '-' + hashlib.sha256(polar_url.encode()).hexdigest()[:8] if polar_url else base_id
    directory = output / 'frames' / frame_id
    directory.mkdir(parents=True, exist_ok=True)
    for patch in frame['patches']:
        shutil.copyfile(output / 'frames' / frame['frameId'] / patch['url'], directory / patch['url'])
    manifest = {**frame, 'frameId': frame_id, 'generatedAt': iso(now)}
    if polar_url:
        manifest['polarUrl'] = '../../' + polar_url
    else:
        manifest.pop('polarUrl', None)
    atomic_json(directory / 'manifest.json', manifest)
    return manifest


def publish_catalog(output, latest, now, history_hours):
    previous_path = output / "manifest.json"
    if previous_path.exists() and utc(json.loads(previous_path.read_text())["observedAt"]) > utc(latest["observedAt"]):
        raise ValueError("Refusing to replace a newer observation")
    cutoff = utc(latest["observedAt"]) - timedelta(hours=history_hours)
    by_time = {}
    for frame in sorted(cached_frames(output), key=lambda f: f["generatedAt"]):
        if cutoff <= utc(frame["observedAt"]) <= utc(latest["observedAt"]):
            by_time[frame["observedAt"]] = frame
    by_time[latest["observedAt"]] = latest
    history = [{"frameId": f["frameId"], "observedAt": f["observedAt"],
                "url": f'frames/{f["frameId"]}/manifest.json'} for _, f in sorted(by_time.items())][-73:]
    manifest = {**latest, "generatedAt": iso(now), "history": history,
                "patches": [{**p, "url": f'frames/{latest["frameId"]}/{p["url"]}'} for p in latest["patches"]]}
    if latest.get("polarUrl"):
        manifest["polarUrl"] = latest["polarUrl"].removeprefix('../../')
    # Complete assets and frame manifests finish before this commit point.
    atomic_json(output / "manifest.json", manifest)
    # Bounded history; never delete the currently published frame. A CDN
    # deployment must mirror these deletions only after its own grace period.
    for directory in (output / "frames").iterdir():
        if directory.is_dir() and directory.name not in {f["frameId"] for f in history} and directory.stat().st_mtime < now.timestamp() - 4 * 86400:
            try:
                shutil.rmtree(directory)
            except OSError as error:
                print(f"Retention cleanup failed: {error}", file=sys.stderr)
    return manifest


def refresh(args, now):
    if args.input:
        if not args.source_url or not args.source_url.startswith(BUCKET + "/GMGSI_LW/"):
            raise ValueError("--input requires the original NOAA GMGSI --source-url")
        result = convert(args.input, args.output, args.source_url, now, history_hours=args.history_hours)
    else:
        observations = discover(now, history_hours=args.history_hours)
        # Backfill real observations once, then reuse hash-verified immutable
        # frames on subsequent polls. New revisions have distinct source URLs.
        cached = cached_frames(args.output)
        existing = {(f["sourceUrl"], f.get("polarUrl")): f for f in cached}
        existing_sources = {f["sourceUrl"]: f for f in cached}
        cutoff = observations[0][0] - timedelta(hours=args.history_hours)
        selected = {}
        for observed, key in observations:
            if observed >= cutoff:
                selected.setdefault(observed, key)
        errors = []
        completed = []
        result = None
        polar_urls = {}
        polar_errors = []
        for observed in selected:
            date = observed.date().isoformat()
            if date not in polar_urls:
                try:
                    polar_urls[date] = polar_module.ensure_polar(args.output, observed, now, download, atomic_json)
                except Exception as error:
                    polar_urls[date] = None
                    polar_errors.append(f"{date}: {error}")
                    print(f"Polar coverage unavailable: {polar_errors[-1]}", file=sys.stderr)
        for observed, key in sorted(selected.items()):
            source_url = f"{BUCKET}/{key}"
            polar_url = polar_urls[observed.date().isoformat()]
            cache_key = (source_url, '../../' + polar_url if polar_url else None)
            try:
                if cache_key in existing:
                    frame = existing[cache_key]
                elif source_url in existing_sources:
                    frame = rebind_polar(existing_sources[source_url], args.output, polar_url, now)
                else:
                    with tempfile.TemporaryDirectory() as temporary:
                        source = Path(temporary) / "source.nc"
                        source.write_bytes(download(source_url))
                        result = convert(source, args.output, source_url, now, publish=False, polar_url=polar_url)
                        frame = json.loads((args.output / "frames" / result["frameId"] / "manifest.json").read_text())
                completed.append(frame)
            except Exception as error:
                errors.append(f"{key}: {error}")
                print(errors[-1], file=sys.stderr)
        if not completed:
            raise RuntimeError("No complete usable observation: " + "; ".join(errors))
        manifest = publish_catalog(args.output, max(completed, key=lambda f: f["observedAt"]), now, args.history_hours)
        result = {"frameId": manifest["frameId"], "historyFrames": len(manifest["history"]),
                  "latestFrameBytes": sum(p["bytes"] for p in manifest["patches"]), "skippedObservations": len(errors),
                  "polarFailures": polar_errors}
    print(json.dumps(result, indent=2))
    return result


def atomic_json(path, value):
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, suffix=".json", delete=False) as handle:
        json.dump(value, handle, indent=2)
        pending = Path(handle.name)
    pending.replace(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("public/weather"))
    parser.add_argument("--input", type=Path, help="Convert a previously downloaded real source file")
    parser.add_argument("--source-url", help="Original HTTPS source URL, required with --input")
    parser.add_argument("--now", help="UTC timestamp for reproducible runs")
    parser.add_argument("--history-hours", type=int, choices=range(0, 73), default=48, help="Real hourly history to retain in the timeline (0–72)")
    args = parser.parse_args()
    now = utc(args.now) if args.now else datetime.now(timezone.utc)
    args.output.mkdir(parents=True, exist_ok=True)
    # One publisher per output directory; automatic release even after failure.
    with (args.output / ".refresh.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            result = refresh(args, now)
            atomic_json(args.output / "status.json", {"checkedAt": iso(now), "lastSuccessfulAt": iso(now),
                                      "status": "success", "result": result, "error": None})
        except Exception as error:
            status_file = args.output / "status.json"
            previous = json.loads(status_file.read_text()) if status_file.exists() else {}
            atomic_json(args.output / "status.json", {"checkedAt": iso(now), "lastSuccessfulAt": previous.get("lastSuccessfulAt"),
                                      "status": "failed", "error": str(error)[:500]})
            raise


if __name__ == "__main__":
    main()
