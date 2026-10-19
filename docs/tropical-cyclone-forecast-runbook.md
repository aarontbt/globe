# Tropical cyclone forecast operations

The Weather popup contains independent **Weather clouds** and **Tropical cyclone forecasts** toggles. The forecast selector lists JMA storms first, followed by NHC storms. **Focus on storm** fits its forecast positions; changing the selected storm also focuses the globe. **Forecast uncertainty** toggles the source cone/circles. Hover markers for valid times and intensity, or expand **Forecast positions**. The popup scrolls on smaller screens.

Forecasts always show the latest available advisory, even while satellite imagery is playing a historical observation. Issue time, analysis time, point-valid time and source-check time remain distinct, all shown in UTC. Forecast lines connect published points for orientation, without predicting intermediate positions. Forecast centre-position uncertainty does not describe a storm's size or establish port/asset disruption.

## Refresh locally

```sh
bun run cyclone:refresh
bun run cyclone:test
bun run dev
```

The worker uses Python's standard library; the satellite worker's scientific Python environment is not required. It fetches JMA and NHC independently, validates advisory/coordinate/time contracts, saves raw SHA-256-addressed snapshots, and atomically publishes `public/cyclones/manifest.json`. Generated forecasts/snapshots are Git-ignored. The first refresh is required on a fresh checkout; absent data is shown as unavailable.

Use `python3 scripts/cyclone-refresh.py --output /persistent/cyclones` for a different output directory. A per-directory lock prevents overlapping publishers. The worker returns nonzero if both providers fail; inspect each `sources[]` entry even when the process succeeds, because one provider can succeed while the other fails. Provider failure retains previous dated storms and their snapshot lineage. Only a successful, validated empty response clears that provider's storms. Older advisories, mismatched NHC storm/advisory geometry, and mismatched JMA list/forecast issues are rejected. A feed rollover race should be retried on the next refresh.

Browser polling runs every 15 minutes while forecasts are enabled and the page is visible. Hiding the page or disabling forecasts aborts requests; disabling satellite imagery does not stop forecast requests. The browser rejects malformed manifests and advisory rollbacks. Failed HTTP/validation requests retain the prior valid manifest and show a warning. Source-check age over one hour is shown independently of advisory age. Advisories over 12 hours old are marked stale; forecasts whose final valid time has passed are hidden. A successful source check does not make an old advisory fresh.

## Sources and interpretation

- **JMA RSMC Tokyo:** western North Pacific and South China Sea. This includes Philippines/Vietnam approaches, not every ASEAN coastline or basin. Discovery: `https://www.jma.go.jp/bosai/typhoon/data/targetTc.json`; per-storm geometry: `.../data/<TC-id>/forecast.json`. These are the public Bosai site's operational data endpoints, not a versioned API with a service guarantee. Parser failures remain visible. JMA coordinates are latitude/longitude and circle radii are metres; output uses longitude/latitude and kilometres.
- **JMA uncertainty:** draw individual source-defined [70% centre-position probability circles](https://www.jma.go.jp/jma/kishou/know/typhoon/7-1.html). Do not substitute gale/storm-warning wind-radius areas for position uncertainty or fabricate an NHC-style cone. The inspected geometry feed provides current native classification but no forecast wind speeds. Forecast markers therefore show `F`; native JMA `TY` remains distinct from NHC categories. No winds are borrowed from another agency.
- **NOAA/NHC:** discovery via `https://www.nhc.noaa.gov/CurrentStorms.json`; download the advisory-specific `forecastTrack.kmzFile` and `trackCone.kmzFile` URLs supplied in the index. Both storm identity and advisory must match. NHC cones retain the source polygon. Native 1-minute wind speeds yield hurricane categories 1–5 only for NHC hurricane points. Tropical/extratropical classification changes remain labelled. Nominal forecast-hour labels are relative to NHC's synoptic base; valid UTC timestamps are read from the source rather than computed from advisory issue time.
- **Local advisories:** [PAGASA](https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin) for the Philippines and [Hong Kong Observatory](https://www.hko.gov.hk/en/informtc/tcMain.htm) for additional South China Sea guidance are linked in Weather. For Bay of Bengal systems affecting Myanmar, [IMD RSMC New Delhi](https://rsmcnewdelhi.imd.gov.in/) is an official regional source; automated ingestion is not included. JTWC direct access returned 403 during the source spike and is not used by the worker.

Keep agency products separate. Consult national meteorological services for local warnings; the globe does not replace them. The GDACS disruption layer and deterministic exposure derivation remain independent.

## Infrared enhancement

**Enhanced infrared colours** switches from grayscale to a display palette over processed brightness. It reuses the same imagery/timestamps and preserves alpha/no-data masks, polar mesh geometry and playback. The legend explicitly says brightness and has no temperature units. This is not a calibrated cold-cloud-top scale, rainfall estimate or cloud classifier. A calibrated temperature product remains a separate source upgrade.

## Production delivery

Forecast hosting/scheduling is not provisioned. Local refresh and Vite build only publish local snapshots; they do not keep a deployed site current.

1. Run the worker against persistent storage on the desired schedule (15-minute polling is a starting point; source advisories update on their own cadence).
2. Publish referenced immutable snapshots first, then replace the root manifest last. Set immutable cache headers on snapshots and `Cache-Control: no-cache` on the manifest. Preserve snapshots referenced by retained provider advisories; do not prune them solely by the latest source-check time.
3. Set `VITE_CYCLONE_MANIFEST_URL` to the HTTPS manifest URL at build time if using external hosting. Enable GET CORS for the application origin. Keep `/cyclones/manifest.json` as the local default.
4. Monitor provider-level errors, advisory ages, source-check ages and expired data. Verify the deployed manifest and actual source attribution after publishing.

## Verification checkpoint

Real source payloads inspected October 18–19, 2026: JMA Champi (`TC2636`, storm number `2630`, issued Oct 18 21:45 UTC) and NHC Trudy (`EP212026`, advisory 22, issued Oct 18 21:00 UTC). Fixtures preserve their source payloads; test forecasts must never be substituted into live manifests.

`cyclone:test` covers real-payload coordinate order, metre-to-kilometre radii, UTC conversion from NHC local point times, missing intensity, issue/advisory matching, malformed geometry/times, provider failure retention and raw lineage, successful empty responses, rollback rejection, source trust, 1-minute category thresholds, forecast expiry, geodesic dateline circles, unchanged NHC polygons and far-side label suppression. Run `weather:test`, `daily:test`, `daily:check` and the production build after weather/globe changes.

The isolated globe renderer compiled both the forecast layers and enhanced-infrared shaders without browser errors. Full-app headless Chromium still reports the pre-existing `maxTextureDimension2D` startup error; it is tracked separately from forecast/source validation. Production GPU/browser performance remains a release check.

Full-app review passed storm selection/focus, NHC/JMA uncertainty switching, enhanced infrared toggling, independent cloud/forecast toggles and popup bounds at 1440×900 and 1280×720. Browser fault-injection checks passed HTTP-failure retention, successful empty sources, stale advisory labeling, expired forecast hiding and disabled-request behavior. Isolated renderer screenshots confirmed readable regional framing, NHC cone geometry, JMA circles and enhanced imagery, with no shader/browser errors. The full-app baseline WebGL startup error remains the limitation above.
