# Satellite weather imagery

The globe supports real NOAA GMGSI longwave infrared imagery through the **Weather** toolbar button. Weather starts enabled unless a saved preference has it off. Clicking Weather opens the Weather details popup and enables imagery if needed; the **Weather clouds** checkbox turns it off. **Layers → Satellite Imagery** remains an additional visibility toggle. Playback controls appear only inside that popup; the toolbar button has a fixed label without changing On/Loading text. The Weather panel shows observation time in UTC, freshness, source attribution, opacity, **Play/Pause**, a timeline, and **Latest**. Imagery and GDACS disruption hazards remain independent.

The animation is a time-lapse of up to 49 actual hourly observations over 48 hours (up to 72 hours when configured on the worker), not simulated wind-driven cloud motion. Playback offers 0.5×, 1×, 2× and 4× speeds, with a 1.2-second base hold and 320 ms cross-fades between actual frames; downloads/decoding can extend that interval. Scrubbing pauses playback, and Latest returns to the newest observation. Historical timestamps remain visible. Source freshness uses the newest observation, rather than treating an intentionally selected historical frame as a source outage. Failed frames pause playback and retain the last complete image; Retry retries the selection. Hidden tabs pause playback.

The image is resampled from NOAA's supplied navigation coordinates. Infrared brightness controls both grayscale and an opacity enhancement that emphasizes brighter structures over the dark basemap. This is a display transform, not a classified cloud mask, calibrated temperature, rainfall estimate, or forecast. Original missing pixels and all nonzero/unknown quality flags are transparent. No polar imagery is fabricated.

## Local refresh

Use a Linux/macOS worker with Python and Bun installed. Python's `fcntl` lock prevents overlapping publishers for the same directory. Create a dedicated environment, install the processing dependencies, and activate it before running package scripts:

```sh
python3 -m venv .venv-weather
. .venv-weather/bin/activate
python3 -m pip install -r scripts/weather-requirements.txt
bun run weather:refresh
bun run dev
```

For an existing dev server, click **Weather** after the refresh. The worker writes `public/weather/manifest.json`, up to 49 frame directories containing eight infrared PNGs and a frame manifest each, plus shared daily polar manifests/images, and a `status.json` job report. All generated files are ignored by Git. Source netCDF files are downloaded to a temporary directory and removed automatically. Normal refresh lists the UTC dates needed for the configured history, handles listing pagination, and backfills 48 hours of actual hourly observations by default. Use `--history-hours 6`, `24`, `48` or up to `72` to set the worker window. Subsequent runs reuse hash-verified cached frames. Missing/corrupt observations are skipped, leaving visible gaps in observation times rather than synthetic frames; skipped counts are recorded in the job report. A run with no usable observations exits nonzero and preserves the last published manifest. Use `--history-hours 0` for latest-only processing.

The frontend polls every 15 minutes while enabled and visible. It checks manifest shape, all eight sectors, time ordering, bounds, image sizes, and SHA-256 hashes, then swaps complete frames together. A corrupt or partial new frame leaves the previous one visible with a refresh warning. Toggling off aborts in-flight downloads and closes decoded images, including retained cross-fade sources. Hidden tabs stop polling and abort ongoing requests. Staleness is based on observation age, with a two-hour warning threshold.

For reproducible conversion of a downloaded original:

```sh
python3 scripts/weather-refresh.py --input /path/to/original.nc --source-url 'https://noaa-gmgsi-pds.s3.amazonaws.com/GMGSI_LW/YYYY/MM/DD/HH/original.nc'
```

The source URL must identify the original NOAA object. This mode still reads observation timestamps and navigation from the file; it never labels an archived frame as current. Publication refuses to replace a newer observation with an older one. The original netCDF is not modified. This input-only conversion omits NASA polar enrichment; use the normal refresh for the combined global product.

## Production delivery contract

Hosting is not provisioned or scheduled by this change. Running Vite's build copies local public assets once; it does not create a continuing weather refresh service.

1. Run `python3 scripts/weather-refresh.py --output /persistent/weather` every 15 minutes on a worker with the pinned dependencies. Use persistent storage so failed runs retain the prior manifest. Watch nonzero exits and `status.json`; source-check time and observation time are different.
2. Upload all referenced `polar/` directories, then every frame's complete `frames/<frame-id>/` directory, including its frame manifest, before replacing the root `manifest.json`. Use `Cache-Control: public, max-age=31536000, immutable` on frame assets. Use `Cache-Control: no-cache` on the root manifest and job status. Publish the root manifest last; do not use an unordered directory sync as the publication transaction.
3. Set `VITE_WEATHER_MANIFEST_URL` to the full HTTPS manifest URL before building the frontend. Relative image paths resolve against that URL and must remain on the same origin as the manifest. Set CDN CORS to allow the globe origin for manifest and image GETs. Ensure these paths return JSON/PNG rather than an SPA HTML fallback.
4. The worker removes noncurrent local frames older than 96 hours. Set a corresponding CDN/object retention lifecycle, allowing at least a 96-hour grace period for older open clients. Keep the current frame regardless of age. Local pruning does not remove remote objects automatically.
5. Inspect the first scheduled run, a stale source, an intentionally failed download, and recovery before release. Set a budget for worker time, storage, requests and delivery; the public source data itself does not cover those costs.

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
