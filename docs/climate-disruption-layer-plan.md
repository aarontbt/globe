# Climate Disruption Layer

## Objective

Add an exposure-linked climate overlay for tropical cyclones and floods across the energy corridor from the Middle East through ASEAN to Japan and Korea. The feature must distinguish source-reported hazards from Rainmarket-derived impact relationships and make every derived impact traceable to both a GDACS footprint and an existing Globe target.

## Current baseline

- Climate is currently only an event category rendered through the generic event-marker layer.
- Runtime event data has no dependable climate coverage, and there is no climate-specific visibility control, panel, source status, or exposure derivation.
- Globe static data already provides the relevant impact targets: ports, curated corridors, canonical energy entities, and selected exposure traces.
- The daily pipeline already provides staged candidate/report promotion, source/public mirroring, and fail-closed validation patterns that the climate workflow should follow.

## Product decisions

- Hazard scope: tropical cyclones and floods.
- Impact depth: exposure-linked, not a generic weather heatmap.
- Refresh model: staged event refresh; the browser never calls GDACS directly.
- Initial source: GDACS only.
- Area of interest: longitude `40E` to `155E`, latitude `20S` to `45N`.
- Time window: rolling seven days, limited to hazards that are active or whose validity overlaps the generated read model.
- Alert levels: ingest green, orange, and red; show orange and red by default while allowing green through filtering.
- The existing generic `climate` event category remains unchanged. Climate hazards are not converted into generic Globe events, avoiding duplicate markers and mixed provenance.

## Source contract

Use the GDACS GeoJSON event-list API for event types `TC` and `FL`. GDACS supports event-type, date, and alert-level filters and publishes regularly refreshed feeds.

- API quickstart: <https://www.gdacs.org/Documents/2025/GDACS_API_quickstart_v1.pdf>
- API explorer: <https://www.gdacs.org/gdacsapi/swagger/index.html>
- Feed reference: <https://data.gdacs.org/feed_reference.aspx>

Each refresh must preserve the requested URL, fetch time, HTTP status, raw content hash, and immutable raw snapshot. Only HTTPS sources are valid. A successful response with no relevant hazards produces a valid empty candidate. A transport, parse, or validation failure must never be represented as “no hazards.”

The promoted source status is `fresh` for six hours after a successful fetch and `stale` afterward. Missing new candidates preserve the existing promoted model. Invalid candidate/report pairs fail closed. Staleness is presented in the UI but does not block unrelated daily publishing.

## Data model

The schema-versioned climate read model contains:

- `schemaVersion`, `asOf`, and `generatedAt`.
- `areaOfInterest` and `sourceStatus`, including source ID, source URL, last successful refresh, freshness, and any non-sensitive error summary.
- `hazards`, normalized as `tropical-cyclone` or `flood`, with stable source ID, title, description, alert level, source URL, countries, geometry or centroid, observation/update/validity timestamps, and lineage.
- `impacts`, linking a hazard to a `port`, `corridor`, `energy-entity`, or `exposure-trace`, with the deterministic relationship, confidence, derivation status, and source hazard reference.

Candidate and refresh-report files share a run ID, fingerprint, and source snapshot hash. Promotion rejects mismatched pairs, malformed or unsupported geometry, unsupported hazard types, non-HTTPS provenance, invalid dates, records outside the area of interest, and impacts that reference unknown hazards or targets.

## Impact derivation

Use GDACS-provided GeoJSON without synthesizing hazard radii.

- A point target inside a polygon or multipolygon receives `inside-footprint`.
- A corridor or exposure-trace line intersecting a hazard polygon receives `intersects-footprint`.
- Canonical energy entities with coordinates use the same point-in-polygon rule as ports.
- Point-only hazards remain visible but produce no inferred impacts; the UI labels impact assessment unavailable.
- Vessels, the full global shipping-lane dataset, customer positions, and targets without usable geometry are excluded from v1 impact computation.

Geometry checks must be deterministic and implemented with narrowly scoped Turf modules rather than the full Turf bundle.

## Staged pipeline

Add a `climate:refresh` workflow that:

1. Fetches GDACS TC and FL events for the rolling window.
2. Saves and hashes raw snapshots.
3. Normalizes, deduplicates, filters to the area of interest, and validates hazards.
4. Computes deterministic impacts against source-controlled Globe targets.
5. Writes a climate candidate and matching refresh report without changing runtime data.

Daily promotion validates the pair, writes the source climate read model, and mirrors it to public runtime data. Daily checks verify schema, referential integrity, source/public parity, and promotion consistency. If no pending pair exists, the current read model is retained. Expired hazards and their impacts are removed on the next successful promotion.

## Globe experience

- Add a dedicated Climate visibility toggle.
- Render cyclone tracks or footprints and flood polygons or centroids through a separate GeoJSON-based layer.
- Use alert-level styling consistently across polygons, outlines, and centroids.
- Keep the implemented `CLIMATE` right-panel tab hidden for now; retain its hazard filters, freshness state, hazard list, and affected-target detail for later activation.
- Keep map selection functional while the Climate tab is hidden. When the tab is re-enabled, map and panel selection should remain synchronized.
- Tooltips and detail views show hazard type, alert level, update time, validity, affected targets, source link, lineage, and freshness.
- Add GDACS to Data Sources as a staged source with its actual refresh status; do not label it live.
- Preserve existing events, predictions, supply-chain, and exposure-trace interactions.

## Validation and acceptance criteria

- Normalize representative TC and FL fixtures, all alert levels, duplicate IDs, malformed records, and AOI boundary intersections correctly.
- Confirm port-inside-polygon, corridor intersection, energy-entity inclusion, outside-footprint exclusion, and point-only no-impact behavior.
- Cover empty, stale, unavailable, expired, and recovered source states.
- Reject mismatched candidate/report fingerprints, invalid hashes, bad geometry, unsupported target references, and source/public drift.
- Verify the climate toggle and tooltip evidence now; retain automated coverage for the hidden panel's filters, synchronized selection, empty state, unavailable-impact state, and stale-source warning.
- Pass the existing daily test/check workflow and production build.
- Visually verify representative cyclone, flood, stale-source, and no-hazard states at desktop layout sizes.
- Every displayed impact must be traceable to a GDACS hazard footprint and an existing Globe target.

## Delivery sequence

1. Define climate types, fixture data, and an empty promoted read model.
2. Implement staged refresh, normalization, geometry derivation, validation, and promotion.
3. Integrate the read model into Globe layers, controls, the Climate panel, and Data Sources.
4. Add automated tests, run the full validation suite, and complete visual QA.

## Deferred work

- JMA cyclone enrichment is deferred because its CAP feed is experimental and explicitly not for operational use: <https://www.jma.go.jp/jma/jma-eng/jma-center/rsmc-hp-pub-eg/cap-rsmctk.html>.
- GloFAS flood forecasts are deferred because they require a separate GRIB/NetCDF processing workflow: <https://confluence.ecmwf.int/spaces/CEMS/pages/242067432/EWDS%2BAPI>.
- Raster weather tiles, wildfire, drought, heat, global coverage, automated customer exposure claims, and safety-warning functionality are outside v1.
