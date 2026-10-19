#!/usr/bin/env python3
"""Regression tests using inspected JMA/NHC source payloads, not fabricated storms."""
import copy
import datetime as dt
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('cyclone_refresh', Path(__file__).with_name('cyclone-refresh.py'))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
FIXTURES = Path(__file__).parent / 'fixtures' / 'cyclones'
NOW = dt.datetime(2026, 10, 19, 0, 15, tzinfo=dt.timezone.utc)


def load(name):
    return json.loads((FIXTURES / name).read_text())


def kmz(name):
    result = io.BytesIO()
    with zipfile.ZipFile(result, 'w') as z:
        z.writestr('forecast.kml', (FIXTURES / name).read_bytes())
    return result.getvalue()


def source_map():
    target = load('jma-target.json')[0]
    storm = load('nhc-current.json')['activeStorms'][0]
    return {c.JMA_INDEX: (FIXTURES / 'jma-target.json').read_bytes(), c.NHC_INDEX: (FIXTURES / 'nhc-current.json').read_bytes(),
            f"https://www.jma.go.jp/bosai/typhoon/data/{target['tropicalCyclone']}/forecast.json": (FIXTURES / 'jma-forecast.json').read_bytes(),
            storm['forecastTrack']['kmzFile']: kmz('nhc-track.kml'), storm['trackCone']['kmzFile']: kmz('nhc-cone.kml')}


class CycloneTests(unittest.TestCase):
    def test_real_jma_coordinate_order_units_and_intensity(self):
        storm = c.validate_storm(c.parse_jma(load('jma-target.json')[0], load('jma-forecast.json')), NOW)
        self.assertEqual(storm['name'], 'Champi')
        self.assertEqual(storm['points'][0]['position'], [140.0, 13.9])
        self.assertEqual(storm['points'][1]['probabilityRadiusKm'], 46.3)
        self.assertEqual(storm['points'][0]['classification'], 'TY')
        self.assertTrue(all(p['windKnots'] is None for p in storm['points']))
        self.assertIsNone(storm['points'][1]['classification'])
        self.assertIsNone(storm['cone'])

    def test_real_nhc_valid_time_not_issue_plus_label(self):
        storm = c.validate_storm(c.parse_nhc(load('nhc-current.json')['activeStorms'][0], c.read_kmz(kmz('nhc-track.kml')), c.read_kmz(kmz('nhc-cone.kml'))), NOW)
        self.assertEqual(storm['points'][0]['position'], [-107, 19.5])
        self.assertEqual(storm['points'][0]['windKnots'], 85)
        self.assertEqual(storm['points'][1]['validAt'], '2026-10-19T06:00:00Z')
        # NHC's nominal +12h label is relative to synoptic time, not advisory issuance.
        self.assertEqual(storm['points'][1]['leadHours'], 12)
        self.assertEqual(storm['windAveragingMinutes'], 1)
        self.assertEqual(storm['cone']['type'], 'MultiPolygon')

    def test_advisory_mismatch_invalid_coordinates_future_and_order(self):
        records = load('jma-forecast.json')
        target = load('jma-target.json')[0]
        for mutate in [lambda r: r[1].update(center=[140, 13.9]), lambda r: r[2].update(validtime=r[1]['validtime']), lambda r: r[2]['probabilityCircle'].update(radius=-1)]:
            broken = copy.deepcopy(records)
            mutate(broken)
            with self.assertRaises(ValueError):
                c.validate_storm(c.parse_jma(target, broken), NOW)
        with self.assertRaises(ValueError):
            c.validate_storm(c.parse_jma(target, records), NOW - dt.timedelta(days=1))
        wrong = copy.deepcopy(target)
        wrong['issue'] = '2026-10-18T18:00:00Z'
        with self.assertRaises(ValueError):
            c.parse_jma(wrong, records)
        storm = load('nhc-current.json')['activeStorms'][0]
        storm['forecastTrack']['advNum'] = '999'
        with self.assertRaises(ValueError):
            c.parse_nhc(storm, c.read_kmz(kmz('nhc-track.kml')))

    def test_failure_retains_exact_advisory_and_lineage_empty_clears(self):
        mapping = source_map()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            first = c.refresh(output, NOW, mapping.__getitem__)
            self.assertEqual(len(first['storms']), 2)
            self.assertTrue(all(s['snapshotHashes'] for s in first['storms']))
            def failure(url):
                if 'jma.go.jp' in url:
                    raise OSError('source offline')
                return mapping[url]
            retained = c.refresh(output, NOW + dt.timedelta(minutes=15), failure)
            self.assertEqual(retained['storms'][0], first['storms'][0])
            self.assertEqual(retained['sources'][0]['status'], 'error')
            self.assertEqual(retained['sources'][0]['lastSuccessfulAt'], first['sources'][0]['lastSuccessfulAt'])
            hashes = {s['sha256'] for s in retained['snapshots']}
            self.assertTrue(all(h in hashes for h in retained['storms'][0]['snapshotHashes']))
            mapping[c.JMA_INDEX] = b'[]'
            empty = c.refresh(output, NOW + dt.timedelta(minutes=30), mapping.__getitem__)
            self.assertFalse(any(s['agency'] == 'JMA' for s in empty['storms']))
            self.assertEqual(empty['sources'][0]['status'], 'ok')
            self.assertEqual(len(empty['storms']), 1)

    def test_bad_provider_preserves_other_provider_and_rejects_rollback(self):
        mapping = source_map()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            c.refresh(output, NOW, mapping.__getitem__)
            old_target = load('jma-target.json')
            old_records = load('jma-forecast.json')
            old_target[0]['issue'] = '2026-10-18T21:44:00Z'
            old_records[0]['issue']['UTC'] = old_target[0]['issue']
            mapping[c.JMA_INDEX] = json.dumps(old_target).encode()
            url = f"https://www.jma.go.jp/bosai/typhoon/data/{old_target[0]['tropicalCyclone']}/forecast.json"
            mapping[url] = json.dumps(old_records).encode()
            result = c.refresh(output, NOW, mapping.__getitem__)
            self.assertEqual(result['sources'][0]['status'], 'error')
            self.assertEqual(result['sources'][1]['status'], 'ok')
            self.assertIn('rollback', result['sources'][0]['error'])
            mapping[c.JMA_INDEX] = b'{}'
            result = c.refresh(output, NOW, mapping.__getitem__)
            self.assertEqual(len(result['storms']), 2)
            self.assertEqual(result['sources'][0]['status'], 'error')


if __name__ == '__main__':
    unittest.main()
