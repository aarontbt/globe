#!/usr/bin/env python3
"""Fetch official JMA/NHC forecasts; atomically publish a source-attributed manifest."""
import argparse
import datetime as dt
import hashlib
import html
import io
import json
import math
import os
from pathlib import Path
import re
import tempfile
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

JMA_INDEX = 'https://www.jma.go.jp/bosai/typhoon/data/targetTc.json'
NHC_INDEX = 'https://www.nhc.noaa.gov/CurrentStorms.json'
JMA_PAGE = 'https://www.jma.go.jp/bosai/map.html#contents=typhoon&lang=en'
ALLOWED_HOSTS = {'www.jma.go.jp', 'www.nhc.noaa.gov'}
MAX_BYTES = 10 * 1024 * 1024


def utc(value):
    parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None:
        raise ValueError('Timestamp must include a timezone')
    return parsed.astimezone(dt.timezone.utc)


def iso(value):
    return value.astimezone(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')


def position(value, lat_first=False):
    if not isinstance(value, list) or len(value) != 2:
        raise ValueError('Invalid position')
    a, b = value
    if lat_first:
        a, b = b, a
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in [a, b]) or not -180 <= a <= 180 or not -90 <= b <= 90:
        raise ValueError('Invalid coordinates')
    return [a, b]


def local_tag(element):
    return element.tag.rsplit('}', 1)[-1]


def descendants(element, tag):
    return [e for e in element.iter() if local_tag(e) == tag]


def parse_jma(target, records):
    storm_id = target.get('tropicalCyclone', '')
    if not re.fullmatch(r'TC\d{4}', storm_id) or not isinstance(records, list):
        raise ValueError('Invalid JMA storm payload')
    titles = [r for r in records if r.get('part') == 'title']
    if len(titles) != 1:
        raise ValueError('Missing JMA title')
    title = titles[0]
    issued = utc(title['issue']['UTC'])
    if utc(target['issue']) != issued:
        raise ValueError('JMA index/forecast issue mismatch; retry next refresh')
    points = []
    past = []
    for record in records:
        if record.get('part') == 'title':
            continue
        lead = record['advancedHours']
        if not isinstance(lead, (int, float)) or not 0 <= lead <= 168:
            raise ValueError('Invalid JMA lead time')
        point = {'position': position(record['center'], True), 'validAt': iso(utc(record['validtime']['UTC'])), 'leadHours': lead,
                 'windKnots': None, 'pressureHpa': None, 'classification': target.get('category') if lead == 0 else None,
                 'probabilityRadiusKm': None}
        if 'probabilityCircle' in record:
            radius = record['probabilityCircle']['radius']
            if isinstance(radius, bool) or not isinstance(radius, (int, float)) or not 0 < radius <= 3_000_000:
                raise ValueError('Invalid probability-circle radius')
            point['probabilityRadiusKm'] = radius / 1000
        if lead == 0:
            # Preserve separate pre-typhoon/typhoon paths: never invent a connecting segment.
            past = [[position(p, True) for p in line] for line in record.get('track', {}).values() if isinstance(line, list) and line]
        points.append(point)
    points.sort(key=lambda p: p['leadHours'])
    return {'id': 'jma-' + storm_id, 'agency': 'JMA', 'basin': 'Western North Pacific / South China Sea',
            'name': title.get('name', {}).get('en') or target.get('typhoonNumber') or storm_id,
            'advisory': str(title.get('typhoonNumber') or storm_id), 'issuedAt': iso(issued),
            'sourceUrl': JMA_PAGE, 'dataUrls': [JMA_INDEX, f'https://www.jma.go.jp/bosai/typhoon/data/{storm_id}/forecast.json'],
            'windAveragingMinutes': 10, 'uncertaintyKind': 'probability-circles',
            'uncertaintyNote': 'JMA 70% centre-position probability circles. These are not storm-size or wind-impact areas.',
            'pastTrack': past, 'points': points, 'cone': None}


def read_kmz(payload):
    with zipfile.ZipFile(io.BytesIO(payload)) as z:
        files = [f for f in z.infolist() if f.filename.lower().endswith('.kml')]
        if len(files) != 1 or files[0].file_size > MAX_BYTES:
            raise ValueError('Invalid or oversized KMZ')
        return ET.fromstring(z.read(files[0]))


def coordinates(text):
    return [position([float(v) for v in token.split(',')[:2]]) for token in (text or '').split()]


def parse_nhc(storm, track, cone=None):
    if not re.fullmatch(r'(al|ep|cp)\d{6}', storm['id']):
        raise ValueError('Invalid NHC storm identifier')
    product = storm['forecastTrack']
    advisory = str(int(product['advNum']))
    # Advisory-specific products prevent mixing a new track with an old uncertainty cone.
    names = descendants(track, 'name')
    if not names or not re.search(r'Advisory\s*#' + re.escape(advisory) + r'\b', names[0].text or '', re.I):
        raise ValueError('NHC track advisory mismatch')
    if storm['id'].upper() not in ' '.join(''.join(e.itertext()) for e in descendants(track, 'description')).upper():
        raise ValueError('NHC track storm identity mismatch')
    points = []
    offsets = {'UTC': 0, 'GMT': 0, 'AST': -4, 'EDT': -4, 'EST': -5, 'CDT': -5, 'CST': -6, 'MDT': -6, 'MST': -7, 'PDT': -7, 'PST': -8, 'HST': -10}
    for placemark in descendants(track, 'Placemark'):
        locations = descendants(placemark, 'Point')
        if not locations:
            continue
        description = html.unescape(' '.join(e.text or '' for e in descendants(placemark, 'description')))
        text = re.sub(r'<[^>]+>', ' ', description)
        date_match = re.search(r'Valid at:\s*(\d{1,2}:\d{2}\s*[AP]M)\s+(\w+)\s+(\w+\s+\d{1,2},\s*\d{4})', text, re.I)
        if not date_match or date_match[2].upper() not in offsets:
            raise ValueError('Missing/unknown NHC point valid time')
        valid = dt.datetime.strptime(date_match[1] + ' ' + date_match[3], '%I:%M %p %B %d, %Y').replace(tzinfo=dt.timezone(dt.timedelta(hours=offsets[date_match[2].upper()])))
        wind = re.search(r'Maximum Wind:\s*(\d+)\s*knots', text, re.I)
        lead = re.search(r'(\d+)\s*hr Forecast', text, re.I)
        style = next((e.text or '' for e in descendants(placemark, 'styleUrl')), '')
        classification = {'#d_point': 'TD', '#s_point': 'TS', '#h_point': 'HU', '#m_point': 'HU', '#l_point': 'LO', '#xd_point': 'EX', '#xs_point': 'EX', '#xh_point': 'EX', '#xm_point': 'EX'}.get(style, storm['classification'] if not lead else None)
        pressure = re.search(r'Minimum Pressure:\s*(\d+)\s*mb', text, re.I)
        points.append({'position': coordinates(descendants(locations[0], 'coordinates')[0].text)[0], 'validAt': iso(valid),
                       'leadHours': int(lead[1]) if lead else 0, 'windKnots': int(wind[1]) if wind else None,
                       'pressureHpa': int(pressure[1]) if pressure else None, 'classification': classification, 'probabilityRadiusKm': None})
    points.sort(key=lambda p: utc(p['validAt']))
    polygon = None
    if cone is not None:
        names = descendants(cone, 'name')
        if not names or not re.search(r'Advisory\s*#' + re.escape(advisory) + r'\b', names[0].text or '', re.I):
            raise ValueError('NHC cone advisory mismatch')
        if storm['id'].upper() not in ' '.join(''.join(e.itertext()) for e in descendants(cone, 'description')).upper():
            raise ValueError('NHC cone storm identity mismatch')
        polygons = []
        for poly in descendants(cone, 'Polygon'):
            rings = [coordinates(e.text) for e in descendants(poly, 'coordinates')]
            if rings:
                polygons.append(rings)
        if not polygons:
            raise ValueError('NHC cone has no polygons')
        polygon = {'type': 'MultiPolygon', 'coordinates': polygons}
    return {'id': 'nhc-' + storm['id'], 'agency': 'NHC', 'basin': 'Atlantic' if storm['id'].lower().startswith('al') else 'Eastern North Pacific',
            'name': storm['name'], 'advisory': advisory, 'issuedAt': iso(utc(product['issuance'])),
            'sourceUrl': storm['publicAdvisory']['url'],
            'dataUrls': [NHC_INDEX, product['kmzFile']] + ([storm['trackCone']['kmzFile']] if cone is not None else []),
            'windAveragingMinutes': 1, 'uncertaintyKind': 'cone' if polygon else 'unavailable',
            'uncertaintyNote': 'NHC forecast centre-position cone. Dangerous weather can extend outside it.' if polygon else 'Source uncertainty cone unavailable.',
            'pastTrack': [], 'points': points, 'cone': polygon}


def validate_storm(storm, now):
    issued = utc(storm['issuedAt'])
    if issued > now + dt.timedelta(minutes=10) or issued.year < 2020:
        raise ValueError('Invalid advisory issue time')
    points = storm['points']
    if not 2 <= len(points) <= 40 or points[0]['leadHours'] != 0:
        raise ValueError('Forecast requires analysis plus forecast points')
    times = [utc(p['validAt']) for p in points]
    if any(b <= a for a, b in zip(times, times[1:])) or times[0] > issued + dt.timedelta(minutes=10):
        raise ValueError('Invalid forecast time ordering')
    for p, valid in zip(points, times):
        position(p['position'])
        if not 0 <= p['leadHours'] <= 168 or valid > issued + dt.timedelta(days=8):
            raise ValueError('Invalid forecast horizon')
        if p['windKnots'] is not None and not 0 <= p['windKnots'] <= 250:
            raise ValueError('Invalid forecast intensity')
    if storm['cone']:
        for polygon in storm['cone']['coordinates']:
            for ring in polygon:
                if len(ring) < 4 or ring[0] != ring[-1]:
                    raise ValueError('Unclosed uncertainty polygon')
                for p in ring:
                    position(p)
    return storm


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', dir=path.parent, delete=False, suffix='.tmp') as f:
        json.dump(value, f, ensure_ascii=False, indent=2, allow_nan=False)
        f.write('\n')
        temp = f.name
    os.replace(temp, path)


def refresh(output, now=None, fetch=None):
    now = now or dt.datetime.now(dt.timezone.utc)
    manifest_path = output / 'manifest.json'
    previous = json.loads(manifest_path.read_text()) if manifest_path.exists() else {'storms': [], 'sources': []}
    previous_sources = {s['agency']: s for s in previous['sources']}
    snapshots = []

    def download(url):
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != 'https' or parsed.hostname not in ALLOWED_HOSTS:
            raise ValueError('Unapproved source URL')
        if fetch:
            payload = fetch(url)
        else:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'GlobeCycloneForecast/1.0'}), timeout=25) as response:
                if urllib.parse.urlparse(response.url).hostname not in ALLOWED_HOSTS:
                    raise ValueError('Unapproved source redirect')
                payload = response.read(MAX_BYTES + 1)
        if len(payload) > MAX_BYTES:
            raise ValueError('Source payload exceeds size limit')
        digest = hashlib.sha256(payload).hexdigest()
        name = 'snapshots/' + digest + '.bin'
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() != digest:
            raise ValueError('Corrupt cached source snapshot')
        if not target.exists():
            with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as f:
                f.write(payload)
                temp = f.name
            os.replace(temp, target)
        snapshots.append({'url': url, 'retrievedAt': iso(now), 'sha256': digest, 'artifact': name})
        return payload

    storms, sources = [], []
    for agency, index_url, coverage in [('JMA', JMA_INDEX, 'Western North Pacific / South China Sea'), ('NHC', NHC_INDEX, 'Atlantic / Eastern North Pacific')]:
        try:
            snapshot_start = len(snapshots)
            index = json.loads(download(index_url))
            fresh = []
            if agency == 'JMA':
                if not isinstance(index, list) or len(index) > 30:
                    raise ValueError('Invalid JMA active-storm list')
                for target in index:
                    storm_id = target.get('tropicalCyclone', '')
                    if not re.fullmatch(r'TC\d{4}', storm_id):
                        raise ValueError('Invalid JMA storm identifier')
                    fresh.append(validate_storm(parse_jma(target, json.loads(download(f'https://www.jma.go.jp/bosai/typhoon/data/{storm_id}/forecast.json'))), now))
            else:
                if not isinstance(index.get('activeStorms'), list) or len(index['activeStorms']) > 30:
                    raise ValueError('Invalid NHC active-storm list')
                for target in index['activeStorms']:
                    product = target.get('forecastTrack')
                    if not product:
                        raise ValueError('Active NHC storm has no forecast track')
                    track = read_kmz(download(product['kmzFile']))
                    cone = None
                    if target.get('trackCone'):
                        if target['trackCone']['advNum'] != product['advNum'] or utc(target['trackCone']['issuance']) != utc(product['issuance']):
                            raise ValueError('NHC track/cone index mismatch')
                        cone = read_kmz(download(target['trackCone']['kmzFile']))
                    fresh.append(validate_storm(parse_nhc(target, track, cone), now))
            old = {s['id']: s for s in previous['storms'] if s['agency'] == agency}
            if any(s['id'] in old and utc(s['issuedAt']) < utc(old[s['id']]['issuedAt']) for s in fresh):
                raise ValueError('Source attempted an advisory rollback')
            for storm in fresh:
                storm['snapshotHashes'] = [s['sha256'] for s in snapshots[snapshot_start:] if s['url'] in storm['dataUrls']]
            storms.extend(fresh)
            sources.append({'agency': agency, 'coverage': coverage, 'url': index_url, 'checkedAt': iso(now), 'lastSuccessfulAt': iso(now), 'status': 'ok', 'stormCount': len(fresh), 'error': None})
        except Exception as error:
            retained = [s for s in previous['storms'] if s['agency'] == agency]
            storms.extend(retained)
            sources.append({'agency': agency, 'coverage': coverage, 'url': index_url, 'checkedAt': iso(now), 'lastSuccessfulAt': previous_sources.get(agency, {}).get('lastSuccessfulAt'), 'status': 'error', 'stormCount': len(retained), 'error': str(error)})
    needed_hashes = {h for storm in storms for h in storm.get('snapshotHashes', [])}
    snapshots.extend(s for s in previous.get('snapshots', []) if s['sha256'] in needed_hashes and not any(n['sha256'] == s['sha256'] for n in snapshots))
    result = {'schemaVersion': 'cyclone-forecast-v1', 'generatedAt': iso(now), 'sources': sources, 'storms': storms, 'snapshots': snapshots}
    atomic_json(manifest_path, result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=Path('public/cyclones'))
    args = parser.parse_args()
    import fcntl
    args.output.mkdir(parents=True, exist_ok=True)
    with (args.output / '.refresh.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        result = refresh(args.output)
    print(json.dumps({'storms': len(result['storms']), 'sources': result['sources']}, indent=2))
    return 0 if any(s['status'] == 'ok' for s in result['sources']) else 1


if __name__ == '__main__':
    raise SystemExit(main())
