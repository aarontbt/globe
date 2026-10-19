# Satellite weather layer plan

Status: global overlay with daily MODIS polar observations, up to 48-hour observed time-lapse and local refresh pipeline implemented, 2026-10-18. See the [runbook and source checkpoint](weather-imagery-runbook.md). Hosting/scheduling, hardware performance validation and regional detail remain follow-on work. The sections below preserve the original delivery sequence; time-lapse was subsequently included at the user's request.

## Product direction

Extend the climate experience with near-real-time satellite imagery while retaining the existing GDACS cyclone/flood hazards and deterministic asset exposure relationships. Satellite imagery supplies visual weather context; it does not by itself supply surface wind, measured rainfall, wave height, forecasts, or confirmed disruption.

Recommended sequence: global GMGSI infrared first, regional Himawari-9 infrared second, then optional animation and additional channels. Use a single source per view in the first release; defer automatic blending between sources with different resolutions and observation times.

## Existing implementation

- `src/layers/climateHazards.ts` draws GDACS footprints, centroids, and selected affected assets.
- `src/components/GlobeView.tsx` uses deck.gl `_GlobeView` over Natural Earth vector basemaps. It does not use a tiled MapLibre basemap.
- `src/components/LayerTogglePanel.tsx` exposes Climate Disruption. The implemented Climate tab in `RightPanel.tsx` is hidden.
- `scripts/climate-refresh.mjs` and `scripts/climate-promote.mjs` stage and validate the GDACS read model; its six-hour freshness policy is hazard-specific.
- The previous climate plan explicitly deferred raster imagery. This proposal extends that scope without changing the hazard data contract.

## Source decisions

| Source | Verified characteristics | Proposed role |
| --- | --- | --- |
| NOAA GMGSI, `noaa-gmgsi-pds` | Hourly multi-satellite mosaic, approximately 8 km; visible, shortwave IR, longwave IR and water vapour; public access without an AWS account | First global overview, longwave IR |
| JMA Himawari-9 via NOAA, `noaa-himawari9` | Asia-Pacific coverage; full disk every 10 minutes; band 13 is 10.4 micrometre IR with nominal 2 km resolution at the sub-satellite point | Second release, regional detail |
| Direct GOES, EUMETSAT, GK-2A, FY-4 | Additional adapters, product selection and access/licensing checks required | Deferred; unnecessary for the first mosaic release |

“Global” describes the mosaic product, not guaranteed useful imagery at every location. Preserve the actual coverage and no-data mask; do not fill polar gaps, missing sectors, or incomplete frames with fabricated imagery. Nominal resolutions are not uniform ground resolution across an entire disk.

Public source data does not make ingestion, transformation, storage, and delivery free. Include NOAA/JMA attribution as applicable, identify reprojected/colour-mapped imagery as processed, and avoid implying agency endorsement. Review each selected product's redistribution terms before publication.

## User experience

- Proposed control group: **Weather & hazards**, with independent **Satellite imagery** and **Disruption hazards** toggles. Preserve existing hazard visibility preferences during any rename.
- Satellite defaults: enabled unless saved off, latest complete infrared frame, moderate opacity. A dedicated Weather toolbar button opens a popup; playback controls appear only inside the popup and its button label stays fixed.
- Show observation time in UTC, source, channel, frame age, resolution description, attribution, and an opacity slider. Use “near-real-time” with timestamps rather than a “live” badge.
- Render imagery above land/ocean fills, then borders, routes, asset markers, hazards and labels. Imagery should not intercept existing map selection.
- Render IR as a labelled infrared image. If calibrated temperatures are available, add a legend with units; do not present arbitrary image brightness as temperature or rain rate. Avoid calling a brightness mask “cloud cover” without a cloud classification product.
- Keep the hidden Climate tab hidden for initial imagery delivery. Put the compact imagery controls with layer controls; reconsider a combined weather detail panel when forecasts or numeric conditions are added.
- On stale imagery, retain and visibly timestamp the last complete frame. On missing data, show unavailable; never interpret an empty image as clear skies.
- Later: optional six-hour timeline, play/pause, and source selection. Do not implement motion until static rendering and delivery budgets pass.

## Delivery architecture

1. A scheduled worker discovers recent source objects and selects the newest complete observation. Verify actual bucket layout, file format, georeferencing, completeness rules, publication lag, object sizes and recent availability in the initial spike; registry metadata alone does not establish these.
2. The worker downloads only required channels, validates navigation and no-data information, decodes and reprojects on the server, and emits browser-ready images. Raw satellite formats and full-resolution disk decoding stay outside the browser.
3. Start by testing a small bounded set of georeferenced image patches through `BitmapLayer`. Use tiled output if needed for transfer or texture limits. `TileLayer` support in `GlobeView` is experimental, so it is a candidate pending validation, not an assumed solution.
4. Upload immutable, frame-addressed assets to object storage/CDN. Validate every required asset before atomically publishing the manifest. Keep the prior complete manifest if processing fails. Bound retention and remove unreferenced assets after a grace period.
5. The browser polls a small cache-controlled manifest, fetches visible assets only when imagery is enabled, and swaps complete frames together. Pause polling in hidden tabs; cancel obsolete requests; bound decoded-image cache and GPU memory.

Use a separate weather publishing loop from the daily editorial/GDACS promotion pipeline. Proposed discovery schedules: every 15 minutes for hourly GMGSI, every 10 minutes for Himawari. These are polling intervals, not promises of source delivery latency. No imagery binaries in Git or application builds. Select hosting and worker runtime after measuring a representative conversion; do not assume a request-time serverless function can process a full disk within its limits.

Proposed manifest fields: schema version, generated time, source/product/channel, frame ID, observation start/end, publication time if supplied, processing time, coverage, projection, bounds, dimensions, asset URLs/checksums, processing version, attribution, and source-specific freshness thresholds. Distinguish observation age from last successful source check. For mosaics, preserve per-sector times where supplied and disclose that sectors may differ in age.

Initial freshness proposals: warn after two hours of GMGSI observation age or 30 minutes for Himawari; tune to measured publication lag. Expose missing coverage independently from stale data. Source health and job failures must remain inspectable even when an older frame is usable.

## Delivery steps and acceptance gates

1. **Source and renderer spike.** Inspect recent GMGSI and Himawari objects; record sample sizes, formats, timestamps, processing duration and terms. Reproject one real GMGSI IR frame and render it on the installed deck.gl version. Verify coast alignment in ASEAN, at the dateline, near the limb and at higher latitudes. Verify no-data transparency, front/back occlusion, layer ordering and asset picking. Decide image patches versus tiles from this evidence. If neither works acceptably, review a custom tessellated image layer before considering a renderer migration.
2. **Global static overlay.** Implement the worker, immutable assets, manifest validation, source health, weather hook, layer and controls. Proposed files: `src/types/weather.ts`, `src/hooks/useWeatherImagery.ts`, `src/layers/weatherImagery.ts`, plus the existing globe, layer controls and Data Sources components. Define worker files once its runtime is selected.
3. **Failure and performance checks.** Cover incomplete observations, malformed manifests, expired URLs, failed image loads, stale observations, no-data masks and recovery. Confirm toggling off stops new image requests, existing hazard selection still works, and changing frames releases obsolete resources. On a named reference desktop/browser, target at least 30 FPS during rotation and at most 10 MB transferred for the initial enabled view; record decoded memory and GPU texture use. Adjust image sizing before expanding coverage detail or history.
4. **Regional enhancement.** Add Himawari band 13 using the same manifest contract and independent freshness. Enable a manual Asia-Pacific source choice, with coverage visible. If automatic regional detail is later added, disclose differing timestamps and test boundary transitions.
5. **Playback and further weather.** Add bounded six-hour playback after measuring storage/egress. Treat visible composites, water vapour, numeric winds, rainfall, waves and forecasts as separately scoped products with their own evidence and units.

Before release, run existing climate tests, daily checks and the production build, plus focused weather contract/failure tests and visual QA on representative desktop browsers. Never derive asset disruption from imagery alone; retain footprint-based GDACS exposure logic.

## Decisions proposed for agreement

- Start with GMGSI global IR; add Himawari regional IR next.
- Preserve independent hazards and imagery; show imagery by default while respecting saved visibility.
- Ship latest-frame viewing before animation or automatic source blending.
- Choose worker/storage hosting and approve an operating budget after the source/renderer spike measures processing and egress.
- Keep numeric weather and forecast scope separate from this satellite imagery release.

## Sources and verification limits

- [NOAA GMGSI registry](https://registry.opendata.aws/noaa-gmgsi/): cadence, nominal resolution, channels, public bucket and usage terms.
- [JMA Himawari-8/9 registry](https://registry.opendata.aws/noaa-himawari/): coverage, cadence, buckets and usage terms.
- [JMA AHI specifications](https://www.data.jma.go.jp/mscweb/en/himawari89/space_segment/spsg_ahi.html): band 13, nominal spatial resolution and observation schedule.
- [deck.gl GlobeView documentation](https://deck.gl/docs/api-reference/core/globe-view): experimental renderer limitations; consulted via Context7 alongside installed BitmapLayer source.

Source pages checked on 2026-10-18. Firecrawl fetching failed because its API hostname could not resolve; the source pages were read through the available web tool. Live S3 object inspection and a rendering prototype remain delivery gates; no current frame availability or processing cost has been established by this planning exercise.
