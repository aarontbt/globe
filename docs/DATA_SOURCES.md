# Data source access - verified 2026-08-24

All three key-based sources tested live. No secrets in this file; actual keys
live in `.env` (gitignored).

## UN Comtrade - VERIFIED WORKING

Key: in `.env` as `COMTRADE_API_KEY`. Activated on the developer portal;
returns real data now (was 404 before activation).

```
curl "https://comtradeapi.un.org/data/v1/get/C/A/HS?reporterCode=458&period=2023&cmdCode=TOTAL&flowCode=X&subscription-key=$COMTRADE_API_KEY"
```

- Monthly: freqCode `M` (use `period=202401` style). Annual: `A`.
- Reporter codes: MY 458, ID 360, SG 702, HK 344, CN 156.
- Free tier: ~500 calls/day, 100/hour. Secondary key available on portal.
- If it ever 404s again: re-show/regenerate the primary key at
  https://comtradedeveloper.un.org/ (Profile -> Show).

## EIA Open Data - VERIFIED WORKING

Key: in `.env` as `EIA_API_KEY`. Never expires.

Working example (US retail electricity sales):

```
curl "https://api.eia.gov/v2/electricity/retail-sales/data/?api_key=$EIA_API_KEY&frequency=monthly&data[0]=sales&facets[stateid][]=US&facets[sectorid][]=ALL&start=2025-01&sort[0][column]=period&sort[0][direction]=desc"
```

Note: facet values must be valid for that route (`series=RBRTE` is NOT a facet;
petroleum route needs `duoarea`+`product`). Browse routes/facets via
`https://api.eia.gov/v2/?api_key=$EIA_API_KEY`.

## PortWatch (IMF) - NO KEY NEEDED

Confirmed anonymous. Two endpoints:

1. Full daily portcalls CSV (~650 MB, all ports all history):
   https://portwatch.imf.org/api/download/v1/items/83b1bbc7b3354c5fb1f40673bb8f852e/csv?layers=0&redirect=true
   Columns: date, portid/portname/country/ISO3, portcalls by vessel type,
   import/export tonnage by type.
2. Incremental (preferred): backing FeatureService, anonymous AGOL query -
   https://services9.arcgis.com/weJ1QsnbMYJlCHdG/arcgis/rest/services/Daily_Ports_Data/FeatureServer/0/query?where=1%3D1&outFields=*&f=json

Disruptions layer item id: d9b37bf4b2104c85aebdcc0c1d8a2ab7.
Dataset search: https://portwatch.imf.org/search?collection=dataset

## GEM (Global Energy Monitor) - no API key

Form-gated ZIP downloads at https://globalenergymonitor.org/download-data/
(name/email/org/use). For energy/LNG work grab:
Global Oil & Gas Plant Tracker, Global Gas Infrastructure Tracker,
Global Coal Plant Tracker. Use a consistent org email; same form link always
serves the latest release.

## UN/LOCODE - no key

CSV zip (2024-2): https://service.unece.org/trade/locode/loc242csv.zip
2025-1 bundle: https://opensource.unicc.org/un/unece/uncefact/vocab-locode/-/jobs/artifacts/2025-1/download?job=package-release
Index: https://unece.org/trade/cefact/UNLOCODE-Download
Online lookup: https://unlocode.unece.org/
