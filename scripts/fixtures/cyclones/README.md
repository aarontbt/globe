# Official-source cyclone fixtures

Captured from public official feeds during the October 18–19, 2026 source spike. These historical payloads are regression fixtures, not current operational forecasts. Do not publish them as a live manifest.

- `jma-target.json`: `https://www.jma.go.jp/bosai/typhoon/data/targetTc.json`
- `jma-forecast.json`: `https://www.jma.go.jp/bosai/typhoon/data/TC2636/forecast.json` (Champi, storm number 2630, issued October 18 21:45 UTC). Coordinates are latitude/longitude; source probability radii are metres. This geometry feed supplies no forecast wind intensity.
- `nhc-current.json`: `https://www.nhc.noaa.gov/CurrentStorms.json`
- `nhc-track.kml`: KML extracted unchanged from `https://www.nhc.noaa.gov/storm_graphics/api/EP212026_TRACK_latest.kmz` (Trudy, advisory 22). The matching advisory-specific URL is supplied in `nhc-current.json`.
- `nhc-cone.kml`: KML extracted unchanged from `https://www.nhc.noaa.gov/storm_graphics/api/EP212026_CONE_latest.kmz` (same storm/advisory).

Tests zip the KML fixtures in memory to exercise the KMZ decoder, then run the real worker with an injected fetch transport and a fixed test clock. Assertions verify source values and failure/publication behavior. Frontend tests consume this worker output rather than inventing another forecast schema.
