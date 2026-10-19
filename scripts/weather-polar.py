"""Daily NASA MODIS thermal infrared observations for both polar caps."""
from datetime import timedelta
import hashlib
import io
import json
import re
from pathlib import Path
import urllib.parse
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

COLORMAP = 'https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_Brightness_Temp_Band31.xml'
LAYERS = ','.join(f'MODIS_{sat}_Brightness_Temp_Band31_{phase}' for sat in ['Terra', 'Aqua'] for phase in ['Day', 'Night'])



def antialias_polar_rows(values, known, latitudes):
    """Display resampling: longitude pixels converge near the pole.

    Average observed samples over the displayed latitude pixel's footprint,
    with periodic longitude. Keep the original no-data mask unchanged.
    """
    result = values.copy()
    frequencies = np.fft.rfftfreq(values.shape[1])
    lat_step = 22 / values.shape[0]
    lon_step = 360 / values.shape[1]
    for row, latitude in enumerate(latitudes):
        if abs(latitude) < 86 or not known[row].any():
            continue
        sigma = .5 * lat_step / lon_step / max(np.cos(np.radians(latitude)), .001)
        kernel = np.exp(-2 * np.pi ** 2 * sigma ** 2 * frequencies ** 2)
        weights = np.fft.irfft(np.fft.rfft(known[row].astype(float)) * kernel, n=values.shape[1])
        samples = np.fft.irfft(np.fft.rfft(np.where(known[row], values[row], 0)) * kernel, n=values.shape[1])
        valid = known[row] & (weights > 1e-8)
        result[row, valid] = samples[valid] / weights[valid]
    # At the point where all longitudes meet there is one displayed sample.
    pole = 0 if latitudes[0] > 0 else len(latitudes) - 1
    if known[pole].any():
        result[pole, known[pole]] = values[pole, known[pole]].mean()
    return result


def infrared_opacity(payload, colormap, north):
    image = Image.open(io.BytesIO(payload)).convert('RGBA')
    if image.size != (1024, 128):
        raise ValueError('Unexpected polar image dimensions')
    pixels = np.asarray(image)
    lookup = {}
    for entry in ET.fromstring(colormap).iter('ColorMapEntry'):
        if entry.get('transparent') == 'false' and entry.get('nodata') != 'true':
            r, g, b = map(int, entry.attrib['rgb'].split(','))
            interval = re.fullmatch(r'[\[(]([0-9.]+),([0-9.]+)[\])]', entry.attrib['value'])
            if not interval:
                continue
            low, high = map(float, interval.groups())
            if not 150 <= low < high <= 400:
                raise ValueError('Invalid infrared temperature color map')
            value = (low + high) / 2
            lookup[(r << 16) | (g << 8) | b] = value
    if len(lookup) < 200:
        raise ValueError('Incomplete NASA infrared color map')
    rgb = pixels[:, :, :3].astype(np.uint32)
    codes = (rgb[:, :, 0] << 16) | (rgb[:, :, 1] << 8) | rgb[:, :, 2]
    unique, inverse = np.unique(codes, return_inverse=True)
    temperatures = np.array([lookup.get(int(c), -1) for c in unique], dtype=float)[inverse].reshape(codes.shape)
    known = (temperatures >= 150) & (pixels[:, :, 3] > 0)
    if not known.any():
        raise ValueError('No usable polar cloud observations')
    lat = (90 - (np.arange(128) + .5) / 128 * 22) if north else (-68 - (np.arange(128) + .5) / 128 * 22)
    temperatures = antialias_polar_rows(temperatures, known, lat)
    # Real observations overlap the geostationary edge, avoiding a hard ring.
    blend = np.clip((abs(lat) - 68) / 4, 0, 1)
    gray = np.clip((310 - temperatures) / 120 * 255, 0, 255).astype(np.uint8)
    emphasis = np.clip((gray.astype(float) - 80) / 175, 0, 1) ** 1.4 * 217
    alpha = np.where(known, emphasis * blend[:, None], 0).astype(np.uint8)
    rgba = np.zeros((128, 1024, 4), dtype=np.uint8)
    rgba[:, :, :3] = gray[:, :, None]
    rgba[:, :, 3] = alpha
    return rgba, round(float(known.mean()), 4)


def ensure_polar(output, observation, now, fetch, atomic_json):
    # Use a completed prior UTC day, never a future daily observation while
    # replaying an earlier hourly frame. Daily composites are not hourly data.
    date = (observation - timedelta(days=1)).date().isoformat()
    root = output / 'polar'
    for manifest_path in sorted(root.glob(f'{date}-*/manifest.json'), reverse=True):
        try:
            manifest = json.loads(manifest_path.read_text())
            if manifest.get('sourceId') != 'nasa-modis-infrared' or manifest.get('processingVersion') != 'modis-infrared-v3':
                continue
            if all(hashlib.sha256((manifest_path.parent / p['url']).read_bytes()).hexdigest() == p['sha256'] for p in manifest['patches']):
                return str(manifest_path.relative_to(output))
        except (OSError, ValueError, KeyError):
            continue
    colormap = fetch(COLORMAP)
    images, source_urls, hashes, coverage = {}, [], [], {}
    for hemisphere, bounds in [('north', [-180, 68, 180, 90]), ('south', [-180, -90, 180, -68])]:
        query = {'SERVICE': 'WMS', 'REQUEST': 'GetMap', 'VERSION': '1.1.1', 'LAYERS': LAYERS,
                 'STYLES': '', 'FORMAT': 'image/png', 'TRANSPARENT': 'TRUE', 'SRS': 'EPSG:4326',
                 'BBOX': ','.join(map(str, bounds)), 'WIDTH': 1024, 'HEIGHT': 128, 'TIME': date}
        url = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?' + urllib.parse.urlencode(query)
        payload = fetch(url)
        images[hemisphere], coverage[hemisphere] = infrared_opacity(payload, colormap, hemisphere == 'north')
        source_urls.append(url)
        hashes.append(hashlib.sha256(payload).hexdigest())
    fingerprint = hashlib.sha256((date + ''.join(hashes) + hashlib.sha256(colormap).hexdigest() + 'modis-infrared-v3').encode()).hexdigest()
    directory = root / f'{date}-{fingerprint[:16]}'
    directory.mkdir(parents=True, exist_ok=True)
    patches = []
    for hemisphere in ['north', 'south']:
        for col in range(4):
            path = directory / f'{hemisphere}-{col}.png'
            Image.fromarray(images[hemisphere][:, col * 256:(col + 1) * 256]).save(path, optimize=True)
            patches.append({'id': f'{hemisphere}-{col}', 'url': path.name,
                            'bounds': [-180 + col * 90, 68 if hemisphere == 'north' else -90,
                                       -90 + col * 90, 90 if hemisphere == 'north' else -68],
                            'width': 256, 'height': 128, 'bytes': path.stat().st_size,
                            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    manifest = {'schemaVersion': 'polar-clouds-v1', 'sourceId': 'nasa-modis-infrared', 'processingVersion': 'modis-infrared-v3',
                'observedDate': date, 'generatedAt': now.isoformat().replace('+00:00', 'Z'),
                'sourceUrls': source_urls, 'sourceHashes': hashes, 'colormapUrl': COLORMAP,
                'colormapSha256': hashlib.sha256(colormap).hexdigest(), 'coverage': coverage,
                'attribution': 'NASA GIBS / MODIS Terra + Aqua · daily day/night thermal infrared',
                'patches': patches}
    atomic_json(directory / 'manifest.json', manifest)
    return str((directory / 'manifest.json').relative_to(output))
