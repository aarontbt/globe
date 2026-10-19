# Satellite weather imagery

The globe loads its daily NOAA GMGSI infrared image and NASA polar composite from `/data/daily-snapshot/weather.json` and adjacent PNG assets. The same static package includes JMA/NHC cyclone forecasts. No weather API key or separate weather host is needed. The Weather button opens a compact panel with independent satellite and cyclone toggles; less-used display/source controls stay collapsed. Observation and advisory issue times remain the original source times.

The standard daily package contains one latest infrared frame to keep the build small. A separately hosted live manifest can still provide a time-lapse of up to 49 actual hourly observations over 48 hours (up to 72 hours when configured on the worker), not simulated cloud motion. Historical timestamps remain visible, and a failed frame retains the last complete image.

The image is resampled from NOAA's supplied navigation coordinates. Infrared brightness controls both grayscale and an opacity enhancement that emphasizes brighter structures over the dark basemap. This is a display transform, not a classified cloud mask, calibrated temperature, rainfall estimate, or forecast. Original missing pixels and all nonzero/unknown quality flags are transparent. No polar imagery is fabricated.

## Local refresh

Use a Linux/macOS worker with Python and Bun installed. Python's `fcntl` lock prevents overlapping publishers for the same directory. Create a dedicated environment, install the processing dependencies, and activate it before running package scripts:

```sh
python3 -m venv .venv-weather
. .venv-weather/bin/activate
python3 -m pip install -r scripts/weather-requirements.txt
bun run weather:refresh --history-hours 0
bun run cyclone:refresh
bun run daily:snapshot
bun run dev
```

For an existing dev server, click **Weather** after packaging. The workers write local manifests and PNGs under Git-ignored `public/weather/` and `public/cyclones/`. `daily:snapshot` verifies and copies only the latest eight infrared patches, the polar composite and forecast JSON into tracked `public/data/daily-snapshot/`. `daily:update` runs this packaging step automatically before building. Source netCDF files are temporary; source timestamps and checksums are preserved. `--history-hours 6`, `24`, `48` or up to `72` remain available when generating an externally hosted time-lapse feed.

The frontend checks the bundled daily JSON when a layer opens and once per day while it remains active. It validates the manifest, eight image sectors, bounds, sizes and SHA-256 hashes before displaying a complete frame. Optional external manifests retain 15-minute polling. Bundled imagery is delayed only when its source observation is more than 26 hours old; an override feed uses the source's two-hour threshold.

For reproducible conversion of a downloaded original:

```sh
python3 scripts/weather-refresh.py --input /path/to/original.nc --source-url 'https://noaa-gmgsi-pds.s3.amazonaws.com/GMGSI_LW/YYYY/MM/DD/HH/original.nc'
```

The source URL must identify the original NOAA object. This mode still reads observation timestamps and navigation from the file; it never labels an archived frame as current. Publication refuses to replace a newer observation with an older one. The original netCDF is not modified. This input-only conversion omits NASA polar enrichment; use the normal refresh for the combined global product.

## Production delivery contract

The standard deployment is a static daily package. Refresh the local weather and cyclone workers before `bun run daily:update`; its `daily:snapshot` step generates `public/data/daily-snapshot/`, and the normal site deployment serves those files from the same origin. Commit the JSON and image assets with the daily update so the deployed build includes them.

For a separately hosted feed with frequent updates, run the weather worker against persistent storage, publish referenced immutable image assets before its root manifest, set `VITE_WEATHER_MANIFEST_URL` to the HTTPS manifest URL, and allow same-origin/CORS GET access. Cyclone feed overrides use `VITE_CYCLONE_MANIFEST_URL`. Optional external feeds retain 15-minute browser polling and their own cache/retention rules.

The initial client fetches all eight bounded patches for one atomic global frame rather than introducing experimental TileLayer selection. The measured total is below the 10 MB initial-view budget. Playback fetches historical frames on demand and releases superseded CPU images; it does not decode the full history at startup. Only the current frame, fading predecessor and in-progress replacement are retained; completed predecessors are released after 450 ms. A complete 48-hour first playback loop can transfer roughly 125 MB at the measured frame size (plus small polar assets); subsequent loads can use the browser's immutable HTTP cache. Higher-resolution regional feeds will need viewport-based loading and a separate memory budget.

## Verification

```sh
. .venv-weather/bin/activate
bun run weather:test
bun run daily:test
bun run daily:check
bun run build
```

The weather tests cover navigation orientation, dateline wrap, unknown quality/missing pixels, unsupported grids, empty imagery, listing pagination across UTC midnight, complete image publication, preserving the previous manifest during history backfill and after conversion failure, rejecting older latest frames, excluding corrupt cached history, invalid manifests, coverage partitions, unsafe asset origins, future timestamps, transfer limits, history ordering/window limits, 48-hour catalogs, polar date/provenance and coverage validation, NASA color-map decoding, pole orientation/overlap, dense cap meshes, staged polar asset replacement without changing IR evidence, and stale observations.

For visual QA, verify ASEAN coast alignment, dateline rotation, high latitudes and no-data boundaries, globe limb/back-face clipping, route and marker readability, independent hazard toggling, opacity, stale/unavailable states and disabling imagery during loading. Inspect browser console errors separately from network failures in unrelated live widgets. Test performance on a real GPU/browser before production; software-rendered headless Chromium is sufficient to inspect geometry but not to certify the 30 FPS target.

## Source checkpoint, 2026-10-18

- Inspected the public GMGSI bucket and Himawari product prefixes. GMGSI's longwave files are netCDF; Himawari's regional decoder remains deferred.
- Converted `GMGSI_LW/2026/10/18/04/GLOBCOMPLIR_v3r0_blend_s202610180400000_e202610180409599_c202610180433508.nc` from the [public NOAA bucket](https://noaa-gmgsi-pds.s3.amazonaws.com/GMGSI_LW/2026/10/18/04/GLOBCOMPLIR_v3r0_blend_s202610180400000_e202610180409599_c202610180433508.nc).
- Observation interval: 04:00:00–04:09:59 UTC. Source object approximately 7.31 MB; dimensions 4999 × 3000. Latitude centres are nonlinear; longitude wraps at the first column. Output uses supplied navigation coordinates, with coverage approximately 72.75°S to 72.73°N.
- The `data` variable is explicitly named `0-255 Brightness Temperature` and has range 0–255, despite a Kelvin units attribute. The implementation uses brightness and deliberately exposes no Kelvin scale.
- Enhanced output: eight PNGs, 2048 × 828 pixels in total, approximately 2.50 MB transfer and 6.78 MB decoded CPU bitmap data. The source's nominal resolution is about 8 km; this overview output samples longitude at about 20 km at the equator. GPU texture use and transient decoder memory are additional. Conversion took about 0.9 seconds in the local isolated environment, excluding source download.
- Real imagery, observation controls, complete frame download, checksum validation, play/pause, timeline scrubbing, returning to Latest and toggle-off behavior were exercised in Chromium. Seven real observations from 2026-10-17 22:00 UTC to 2026-10-18 04:00 UTC were backfilled successfully. A depth comparison artifact between independently tessellated basemap/image meshes was corrected by rendering the bitmap overlay with back-face culling and without depth comparison before geographic features.
- Controlled renderer views were checked at ASEAN (115°E, 5°N), the dateline (180°, 0°), and high latitude (10°E, 70°N), including globe limb clipping and polar clipping. Subsequent polar enrichment uses the NASA MODIS product below. This isolated renderer reported no browser errors. Full-app tests also covered stale/unavailable sources and a corrupt playback frame preserving the prior image and pausing playback.
- Baseline full-app headless Chromium reports a transient luma `ResizeObserver` initialization error involving `maxTextureDimension2D`, including with imagery disabled; the globe subsequently renders. This pre-existing issue is outside the weather code. Hardware performance and other desktop browsers remain release checks.

See the [satellite weather plan](satellite-weather-layer-plan.md) for Himawari detail, additional channels and later weather products. See the [GMGSI registry](https://registry.opendata.aws/noaa-gmgsi/) for source cadence and attribution terms.

## Polar cloud observations

Geostationary infrared stops near 73° latitude. The combined product supplements it from 68° to 90° in both hemispheres with NASA GIBS MODIS Terra/Aqua Band 31 Brightness Temperature Day and Night layers. A dated WMS image contains the merged daily observations. The worker decodes NASA's published RGB-to-brightness-temperature intervals and maps their midpoints into the grayscale infrared display used by the main layer. It preserves unknown/no-data pixels and blends the 68–73° overlap. A 0.5° cap mesh replaces the renderer's coarse 10° triangles, preventing large pole fans. Longitude samples are filtered over their displayed physical footprint near the pole; the single pole sample aggregates only available observations, while missing pixels remain missing. Infrared navigation is never stretched to a pole.

Each hourly frame references the preceding completed UTC day's polar composite to avoid future observations during history replay. The Weather detail panel displays this polar date and attribution separately; the cap is a daily thermal infrared composite, not an hourly observation. Infrared includes cold surface patterns as well as clouds. Failed polar ingestion is reported in `status.json` and the panel when no supplement is available. The worker preserves cached hash-verified daily supplements. Publish shared polar assets before any referencing frame/root manifests; retain referenced supplements for at least the same 96-hour grace period.

Official source references: [NASA GIBS visualizations](https://nasa-gibs.github.io/gibs-api-docs/available-visualizations/), [WMS access](https://nasa-gibs.github.io/gibs-api-docs/access-basics/#ogc-web-map-service-wms), [published MODIS Band 31 mapping](https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_Brightness_Temp_Band31.xml). Source documentation was read through Firecrawl and the actual source capabilities, color map, and dated north/south images were checked during implementation.

## Tropical cyclone forecasts and enhanced colours

The Weather popup now also contains independent official JMA/NHC forecast controls. Run `bun run cyclone:refresh` to populate forecast tracks, NHC cones and JMA probability circles. Satellite `weather:refresh` does not refresh forecasts. See the [forecast runbook](tropical-cyclone-forecast-runbook.md) for ASEAN coverage, source semantics, failure handling, publication and tests. The optional enhanced infrared palette is a brightness display, with no temperature scale.
