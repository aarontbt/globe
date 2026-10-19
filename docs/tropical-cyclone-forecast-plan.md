# Tropical cyclone forecasts

Implemented locally, 2026-10-19. Operations: [forecast runbook](tropical-cyclone-forecast-runbook.md). Forecasts are a separate weather overlay; satellite playback remains observed imagery.

## Sources and coverage

| Source | Coverage / role | Decision |
| --- | --- | --- |
| [JMA RSMC Tokyo](https://www.jma.go.jp/jma/jma-eng/jma-center/rsmc-hp-pub-eg/RSMC_HP.htm) | Western North Pacific and South China Sea; Philippines/Vietnam approaches | Primary ASEAN-region adapter. Live Bosai target list and per-storm forecast JSON inspected. Coordinates are latitude/longitude; probability radii are metres. |
| [NOAA/NHC GIS](https://www.nhc.noaa.gov/gis/) | Atlantic and eastern North Pacific hurricanes | Active-storm index, advisory-specific forecast track and uncertainty-cone KMZ. Preserve agency advisory and valid times. |
| [PAGASA](https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin) | Philippines local cyclone bulletins and warnings | Link as local authority; no stable structured ingestion contract verified. |
| [Hong Kong Observatory](https://www.hko.gov.hk/en/103397/Tropical-cyclone-track-information---GIS-version) | South China Sea regional track guidance | Link as additional regional source; separate adapter deferred to avoid blending agency forecasts. |
| [IMD RSMC New Delhi](https://rsmcnewdelhi.imd.gov.in/) | Bay of Bengal, including Myanmar approaches | Official regional source verified; structured adapter deferred. |
| [JTWC](https://www.cnmoc.usff.navy.mil/Our-Commands/Fleet-Weather-Center-San-Diego/Joint-Typhoon-Warning-Center/) | Western Pacific / Indian Ocean guidance | Direct source returned 403 during inspection; do not depend on it. |

JMA is a regional specialist centre, not an ASEAN-wide local-warning service. This first release does not claim Indian Ocean, southern Indian Ocean, or Australian-region forecast coverage. National warnings remain with each country's meteorological service.

## Delivery steps

1. Normalize source forecasts with storm identity, issue/analysis/valid times, native classification, wind averaging period, source URLs and content hashes. Store raw snapshots. Fetch outside the browser and publish JSON atomically; preserve dated previous provider data on failure, clear storms only after a successful empty source response.
2. Render selectable tracks, current centre, dated forecast markers, NHC source cone and JMA source-defined probability circles. Do not synthesize a cone from an arbitrary buffer or treat storm-warning wind radii as position uncertainty. Do not infer intensity where it is absent from a source.
3. Add independent cyclone toggle, source health, stale/expired states, advisory links, storm selection, focus on storm, forecast point list and UTC labels in Weather. Keep the latest forecast independent of imagery playback and explicitly label this pairing. Retain independent GDACS hazard exposure assessment.
4. Add optional enhanced infrared brightness colouring. This is a display palette over processed brightness; it must retain alpha/no-data and must not claim calibrated Celsius/Kelvin, rainfall or cloud classification.
5. Verify parsers using inspected real-source fixtures, failure/empty/older advisory behavior, invalid dates/geometry, dateline handling, freshness and forecast expiry. Run weather/daily checks and build, then browser review at 1280×720 and 1440×900 including ASEAN and the globe's far side.

## Product semantics

- JMA probability circles describe forecast centre-position uncertainty (70% probability), not the storm's size or an impact footprint. Preserve source circles rather than inventing an NHC-style cone. NHC cones are agency geometry with their own methodology.
- Native JMA classifications and NHC 1-minute wind categories stay distinct. The inspected JMA geometry feed has no forecast wind speed; display it as unavailable rather than borrowing another agency's intensity.
- Show source-check age separately from advisory age. Warn after 12 hours; suppress expired forecasts. A failed refresh must not imply no storms.
- Forecasts identify possible storm positions, not confirmed port disruption. No automatic additions to Energy/LNG exposure or commercial metrics.
- No scheduler or hosting provisioning in this implementation. A local refresh/build does not establish continuous production delivery. Publish immutable snapshots first and the manifest last; keep the source endpoint configurable.

## Acceptance

A live JMA storm can be selected and focused on the ASEAN-centred globe, source positions and uncertainty circles appear with UTC labels, and NHC storms use their matching advisory cones. Forecasts can be hidden independently of imagery and GDACS. Missing/stale products are explained. Tests and source details are recorded in the companion runbook.
