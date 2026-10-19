"""Contract tests for real-grid resampling and atomic frame publication."""
from datetime import datetime, timezone
import importlib.util
import json
import io
from pathlib import Path
import tempfile
import unittest

import numpy as np
from netCDF4 import Dataset
from PIL import Image

spec = importlib.util.spec_from_file_location("weather_refresh", Path(__file__).with_name("weather-refresh.py"))
weather = importlib.util.module_from_spec(spec)
spec.loader.exec_module(weather)


class WeatherTests(unittest.TestCase):
    def grid(self):
        lon, lat = np.meshgrid([135., -135., -45., 45.], [60., 20., -20., -60.])
        # Distinct longitude brightness values detect accidental dateline shifts.
        data = np.ma.array(np.tile([240., 30., 90., 150.], (4, 1)))
        return data, np.ma.zeros((4, 4)), lat, lon

    def test_navigation_orientation_and_dateline(self):
        rgba, bounds = weather.resample(*self.grid(), width=8)
        self.assertEqual(rgba[0, :, 0].tolist(), [30, 30, 90, 90, 150, 150, 240, 240])
        self.assertEqual(bounds, [-180, -80, 180, 80])
        data, quality, lat, lon = self.grid()
        data[0, :] = 255
        data[-1, :] = 0
        rgba, _ = weather.resample(data, quality, lat, lon, width=8)
        self.assertTrue((rgba[0, :, 0] == 255).all())
        self.assertTrue((rgba[-1, :, 0] == 0).all())

    def test_missing_and_unknown_quality_remain_transparent(self):
        data, quality, lat, lon = self.grid()
        data[0, 1] = np.ma.masked
        quality[0, 2] = 20
        rgba, _ = weather.resample(data, quality, lat, lon, width=8)
        self.assertEqual(rgba[0, :4, 3].tolist(), [0, 0, 0, 0])
        self.assertTrue((rgba[0, 4:, 3] > 0).all())

    def test_bad_navigation_and_empty_observation_fail(self):
        data, quality, lat, lon = self.grid()
        lat[0, 0] = 12
        with self.assertRaisesRegex(ValueError, "non-separable"):
            weather.resample(data, quality, lat, lon, width=8)
        data, quality, lat, lon = self.grid()
        quality[:] = 20
        with self.assertRaisesRegex(ValueError, "no usable"):
            weather.resample(data, quality, lat, lon, width=8)

    def test_discovery_pagination_and_midnight(self):
        calls = []
        def fetch(url):
            calls.append(url)
            next_page = "continuation-token=" in url
            key = "GMGSI_LW/2026/10/17/23/GLOBCOMPLIR_v3r0_blend_s202610172300000_e202610172309599_c202610172333000.nc"
            return (f'<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">'
                    f'<IsTruncated>{str(not next_page).lower()}</IsTruncated>'
                    '<NextContinuationToken>page2</NextContinuationToken>'
                    f'<Contents><Key>{key}</Key><Size>1000</Size></Contents></ListBucketResult>').encode()
        found = weather.discover(datetime(2026, 10, 18, tzinfo=timezone.utc), fetch, history_hours=6)
        self.assertEqual(len(found), 1)
        self.assertEqual(len(calls), 4)
        self.assertTrue(any("2026%2F10%2F17" in url for url in calls))

    def test_polar_infrared_mapping_and_overlap(self):
        entries = ''.join(f'<ColorMapEntry rgb="{i},0,1" transparent="false" value="({180+i*.6:.1f},{180+(i+1)*.6:.1f}]"/>' for i in range(255))
        colormap = f'<ColorMaps>{entries}</ColorMaps>'.encode()
        pixels = np.zeros((128, 1024, 4), dtype=np.uint8)
        pixels[:] = [0, 0, 1, 255]
        pixels[:, 0] = [254, 0, 1, 255]  # warm infrared fades into the basemap
        pixels[:, 1] = [200, 200, 200, 255]  # unknown mapping, not invented data
        payload = io.BytesIO()
        Image.fromarray(pixels).save(payload, format='PNG')
        north, coverage = weather.polar_module.infrared_opacity(payload.getvalue(), colormap, True)
        south, _ = weather.polar_module.infrared_opacity(payload.getvalue(), colormap, False)
        self.assertGreater(coverage, .99)
        self.assertTrue((north[:, 1, 3] == 0).all())
        self.assertEqual(int(north[64, 0, 3]), 0)
        self.assertEqual(int(north[0, 100, 3]), 217)
        self.assertLess(int(north[-1, 100, 3]), 10)
        self.assertLess(int(south[0, 100, 3]), 10)
        self.assertEqual(int(south[-1, 100, 3]), 217)

    def test_conversion_and_failure_preserve_manifest(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source.nc"
            with Dataset(source, "w") as ds:
                ds.title = "GLOBCOMPLIR"
                ds.time_coverage_start = "2026-10-18T04:00:00Z"
                ds.time_coverage_end = "2026-10-18T04:09:59Z"
                ds.date_created = "2026-10-18T04:33:50Z"
                ds.source = "test fixture"
                ds.createDimension("time", 1)
                ds.createDimension("y", 4)
                ds.createDimension("x", 4)
                data, quality, lat, lon = self.grid()
                for name, values in [("data", data), ("dqf", quality)]:
                    variable = ds.createVariable(name, "f4", ("time", "y", "x"))
                    variable[0] = values
                    if name == "data":
                        variable.long_name = "0-255 Brightness Temperature"
                for name, values in [("lat", lat), ("lon", lon)]:
                    ds.createVariable(name, "f4", ("y", "x"))[:] = values
            output = root / "output"
            output.mkdir()
            weather.convert(source, output, "https://example.com/source.nc", weather.utc("2026-10-18T05:00:00Z"))
            previous = (output / "manifest.json").read_bytes()
            manifest = json.loads(previous)
            self.assertEqual(len(manifest["patches"]), 8)
            for patch in manifest["patches"]:
                asset = output / patch["url"]
                self.assertEqual(asset.stat().st_size, patch["bytes"])
                self.assertEqual(weather.hashlib.sha256(asset.read_bytes()).hexdigest(), patch["sha256"])
            original_frame = json.loads((output / "frames" / manifest["frameId"] / "manifest.json").read_text())
            rebound = weather.rebind_polar(original_frame, output, "polar/test-ir/manifest.json", weather.utc("2026-10-18T05:00:00Z"))
            self.assertNotEqual(rebound["frameId"], original_frame["frameId"])
            self.assertEqual(rebound["sourceSha256"], original_frame["sourceSha256"])
            self.assertEqual(rebound["polarUrl"], "../../polar/test-ir/manifest.json")
            self.assertEqual(previous, (output / "manifest.json").read_bytes())
            for patch in rebound["patches"]:
                self.assertEqual(weather.hashlib.sha256((output / "frames" / rebound["frameId"] / patch["url"]).read_bytes()).hexdigest(), patch["sha256"])
            # Build an older genuine-shaped observation without moving the
            # published latest frame backward during history backfill.
            with Dataset(source, "a") as ds:
                ds.time_coverage_start = "2026-10-18T03:00:00Z"
                ds.time_coverage_end = "2026-10-18T03:09:59Z"
            staged = weather.convert(source, output, "https://example.com/older.nc", weather.utc("2026-10-18T05:00:00Z"), publish=False)
            self.assertEqual(previous, (output / "manifest.json").read_bytes())
            latest = json.loads((output / "frames" / manifest["frameId"] / "manifest.json").read_text())
            published = weather.publish_catalog(output, latest, weather.utc("2026-10-18T05:00:00Z"), 6)
            self.assertEqual([f["observedAt"] for f in published["history"]], ["2026-10-18T03:00:00Z", "2026-10-18T04:00:00Z"])
            self.assertEqual(published["history"][-1]["frameId"], manifest["frameId"])
            with self.assertRaisesRegex(ValueError, "newer observation"):
                weather.convert(source, output, "https://example.com/older.nc", weather.utc("2026-10-18T05:00:00Z"))
            older_dir = output / "frames" / staged["frameId"]
            (older_dir / "0-0.png").write_bytes(b"corrupt frame")
            published = weather.publish_catalog(output, latest, weather.utc("2026-10-18T05:00:00Z"), 6)
            self.assertEqual(len(published["history"]), 1)
            previous = (output / "manifest.json").read_bytes()
            source.write_bytes(b"corrupt source")
            with self.assertRaises(OSError):
                weather.convert(source, output, "https://example.com/source.nc", weather.utc("2026-10-18T05:00:00Z"))
            self.assertEqual(previous, (output / "manifest.json").read_bytes())

    def test_polar_display_sampling_keeps_missing_pixels(self):
        axis = np.arange(1024) / 1024 * 2 * np.pi
        values = np.tile(240 + 10 * np.sin(8 * axis), (128, 1))
        known = np.ones_like(values, dtype=bool)
        known[:, 10] = False
        latitudes = 90 - (np.arange(128) + .5) / 128 * 22
        sampled = weather.polar_module.antialias_polar_rows(values, known, latitudes)
        self.assertTrue(np.allclose(sampled[0, known[0]], values[0, known[0]].mean()))
        self.assertTrue(np.array_equal(sampled[:, 10], values[:, 10]))
        self.assertTrue(np.array_equal(sampled[100], values[100]))


if __name__ == "__main__":
    unittest.main()
