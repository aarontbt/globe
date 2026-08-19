# Energy & LNG Public-Data Ingestion Design

**Status:** Phase 1 automated Energy/LNG MVP
**Last reviewed:** 2026-08-19
**Scope:** Public-data collection, provenance, normalisation and promotion into Globe

This document defines the active staged ingestion layer around Globe. Daily
scheduling is supplied by the runtime/operations environment; this repository
supplies the fetch, normalisation, validation and promotion commands. The
reviewed daily workflow remains the publication gate in
[daily-agent-prompt.md](daily-agent-prompt.md) and
[daily-update-runbook.md](daily-update-runbook.md).

## 1. Product boundary

The ingestion layer should turn public observations into traceable candidates
for Globe's energy graph, time series and exposure assessments:

    Public sources
        → raw snapshots
        → normalised records
        → quality and provenance checks
        → machine or analyst evidence
        → Globe source data
        → daily:apply
        → public runtime/read model

The layer must not turn a public relationship, a trade flow or an asset
listing into verified physical exposure by itself. Globe should distinguish:

- **Observed:** directly reported by the source for a stated date and unit.
- **Derived:** calculated from observed records using a documented method.
- **Assessed:** an analyst interpretation of observed and derived records.
- **Insufficient verified data:** the source does not support the requested
  claim.

## 2. Current workflow and publication contract

This is the process that is live today:

1. Preview the liquid market refresh:
   `bun run daily:fetch -- --dry-run`.
2. Persist successful liquid refreshes with `bun run daily:refresh`.
3. Refresh the staged Energy/LNG candidates:
   `bun run energy:refresh` or `bun run energy:refresh -- --event` after a
   disruption change. Run it after the daily market refresh and after any
   manual state/exposure edit. This writes `energy-lng-candidates.json` and
   `energy-lng-refresh-report.json`, never the promoted runtime.
4. Use Firecrawl to review every due or changed URL in
   src/data/exposure-traces.json. Record the reviewed result in
   src/data/evidence-audit.json.
5. Edit src/data/daily-state.json and the relevant exposure/trade inputs.
   Preserve explicit confirmed, carried and unavailable states.
6. If step 5 changes any refresh input, rerun `bun run energy:refresh`; the
   promotion gate rejects a stale fingerprint rather than applying an older
   candidate over the edit.
7. Preview distribution with `bun run daily:apply -- --dry-run`.
8. Publish and run the complete gate with `bun run daily:update`.

`daily:update` runs the evidence check, tests, apply step, data check and
production build. The apply step promotes only a validated, same-as-of
Energy/LNG report; failed or stale candidate validation leaves the promoted
runtime unchanged. It then recalculates Flow Pressure through the canonical
adapter, generates the read model, and mirrors both into `public/data/`. It
does not recrawl sources after review.

The current manual verification rule also remains in force for JKM, Dubai and
Oman, LNG and VLCC freight, AIS/transit counts, Qatar output, force majeure
and war-risk observations unless an approved machine-readable source is added
with an explicit contract.

## 3. Source registry

The active registry is [`src/data/energy-lng-source-registry.json`](../src/data/energy-lng-source-registry.json).
Sources without a configured machine-readable endpoint produce an explicit
failed/skipped snapshot and use only their declared carry or unavailable
fallback.

| Domain | Open source candidates | Useful observations | Cadence and limitation | Globe status |
| --- | --- | --- | --- | --- |
| Gas balances, production, storage and prices | [EIA Open Data](https://www.eia.gov/opendata/), [JODI-Gas](https://www.jodidata.org/gas/database/data-downloads.aspx) | Production, imports/exports, storage, prices, balances | EIA connector requires `EIA_API_KEY` or `EIA_DATA_URL`; no oil baseline is converted into LNG volume | Active physical connector |
| Trade flows and concentration | [UN Comtrade](https://comtradeplus.un.org/TradeFlow) | Reporter, partner, HS commodity, value, quantity and direction | Monthly or annual customs data; does not prove cargo-level movement or current exposure | Future |
| Terminals, pipelines and other assets | [Global Energy Monitor GGIT](https://globalenergymonitor.org/projects/global-gas-infrastructure-tracker/), [UN/LOCODE](https://unece.org/trade/cefact/unlocode-code-list-country-and-territory) | Asset identity, location, status, capacity and place identifiers | Release-based or static snapshots; validate against current operator/regulator material | Phase 0 / future |
| Ports, chokepoints and maritime pressure | [IMF PortWatch](https://portwatch.imf.org/pages/data-and-methodology) | Port activity, trade proxies, chokepoint and disruption indicators | Set `PORTWATCH_DATA_URL`; methodology pages are never parsed as observations; reviewed Kpler route data may be carried | Active route connector |
| European gas system | [AGSI+](https://agsi.gie.eu/), [ENTSOG Transparency](https://transparency.entsog.eu/) | Storage, nominations, flows, network and facility observations | Coverage is strongest in Europe and depends on the source's reporting rules | Future |
| Historical LNG vessel and terminal baseline | [LNG-T3](https://zenodo.org/records/19571058) | Historical vessel voyages, terminals, throughput and country flows | Historical dataset; useful for backtesting and priors, not live status | Future |
| Events and public disclosures | Official operator, regulator and government releases; [GDELT](https://www.gdeltproject.org/) for discovery | Outages, sanctions, force majeure, policy, weather and security events | Discovery feeds require source-level review; exact pages and claims must be captured | Current review / future discovery |
| Macro and supporting market series | [World Bank Pink Sheet](https://www.worldbank.org/en/research/commodity-markets), [NY Fed SOFR](https://www.newyorkfed.org/markets/reference-rates/sofr-averages-and-index), EIA market series | Oil, gas and macro benchmarks used as context | TTF is refreshed through the existing Yahoo market connector; JKM remains unavailable to automation | Partial current |

The following remain known coverage gaps rather than assumed open-data
capabilities: live vessel identity and cargo tracking, JKM, delivered LNG
freight, inventory nominations, contract terms, gas quality, insurance and
counterparty credit. These require licensed, internal or manually verified
inputs before they can support a stronger exposure claim.

### Active Phase 1 contract

`bun run energy:refresh` fetches the configured physical-flow, route-context
and TTF market sources. `--event` changes only the trigger recorded in the
report. The command writes candidate observations and a promotion report; it
does not modify `daily-state.json`, `exposure-traces.json`, or the promoted
runtime.

Each candidate includes its provider, exact URL, observation and retrieval
timestamps, entity IDs, unit, cadence, freshness window, confidence, status,
evidence IDs, deterministic record key, snapshot hash/reference, parser
version and derived-from references. Automated EIA and PortWatch records also
link first-class machine snapshot evidence containing the fetched endpoint,
content hash, parser version and record keys. Reviewed Qatar force-majeure and
Hormuz event claims remain analyst-approved evidence and are never replaced by
an automated snapshot. The promotion gate rejects malformed, stale confirmed,
duplicate, unit-mismatched, unknown-entity, unknown-evidence, scope-mutated,
fingerprint-stale and unsupported-source records. Carried observations remain
dated and lower confidence; unavailable observations contain no invented value.

The report and candidate file are an atomic logical pair. `daily:apply` refuses
one without the other, checks the refresh fingerprint against the current
state/exposure/registry, validates the complete staged publication bundle, and
only then commits runtime and `public/data` changes. A failed gate leaves the
previous promoted runtime in place.

`bun run daily:update` consumes only a validated report whose `asOf` matches
the daily state. It stages the candidates into the canonical domain, invokes
the single Flow Pressure adapter, ranks alternatives, generates
`energy-lng-read-model.json`, and mirrors the canonical runtime/read model to
`public/data/`. Reviewed Qatar force-majeure and Hormuz event evidence is
manual-only and is carried, never replaced, by the automated refresh.

## 4. Canonical record contract

Every promoted record should carry the same minimum lineage:

| Field group | Required fields |
| --- | --- |
| Source | Provider, exact URL or endpoint, retrieval timestamp, publication timestamp, licence/access class |
| Observation | Observation date or period, timezone where relevant, value, unit, currency and adjustment basis |
| Entity | Stable identifier and type: ISO3, HS code, UN/LOCODE, IMO/MMSI, terminal/asset ID or LEI as applicable |
| Relationship | Origin, destination, operator, owner, counterparty, route or chokepoint, with relationship type |
| Quality | confirmed, carried, unavailable or needs_review; confidence, freshness and validation notes |
| Lineage | Raw snapshot reference or hash, parser/normaliser version, and derivedFrom references for calculated values |

Normalisation rules:

- Preserve the source value and unit before conversion. Store converted values
  alongside the conversion basis.
- Use explicit observation periods. Do not present a monthly, modelled or
  historical value as live.
- Use stable entity IDs and maintain an alias table for names, ports,
  terminals, companies and countries.
- Make deduplication deterministic. A repeated fetch should produce the same
  record key and should not create a new event.
- Mark proxies and estimates as derived. Do not upgrade them to confirmed
  physical flows without direct evidence.

## 5. Ingestion lifecycle

### 5.1 Discover and fetch

Each connector should have a source entry describing endpoint, terms, expected
cadence, coverage, parser and failure behaviour. Fetches should be bounded,
retryable and rate-limit aware. For web pages, preserve the exact page used
for a claim rather than only a search result or landing page.

### 5.2 Archive raw data

Store the original response or a durable snapshot reference before parsing.
The archive should include retrieval time, source URL, response status,
content hash and connector version. Raw data is the audit trail; normalised
records are reproducible outputs.

### 5.3 Normalise and validate

Convert source-specific fields into Globe's canonical entities, units and
periods. Run schema, type, range, date, identity, duplicate and cross-source
checks. A failed check creates a review item; it does not silently discard or
repair the observation.

### 5.4 Enrich and derive

Build concentration, route, delay, substitution and pressure measures only
from records with declared provenance. Keep the inputs and formula version
alongside every derived result. Treat PortWatch indicators, historical
voyages, trade statistics and asset databases as evidence or context at the
strength supported by their method.

### 5.5 Review and promote

The connector output is a candidate dataset. Automated EIA and PortWatch
observations may promote only after their fetched snapshot evidence, source
scope, freshness, units and entity identity pass validation. Reviewed event
claims and market observations retain their existing analyst-approval gate.
All approved records are published through the existing `daily:apply` path.

## 6. Proposed implementation phases

### Phase 0 — Contracts and fixtures (complete)

- Define source registry, canonical entities, IDs, units, statuses and lineage.
- Add raw-snapshot and candidate-record conventions without changing the
  current React data contract.
- Use the existing static fixtures to test provenance and derived metrics.

### Phase 1 — High-value open-data connectors (active MVP)

- Start with EIA/JODI for balances and benchmarks, UN Comtrade for trade
  concentration, GEM/UNLOCODE for asset identity and PortWatch for
  port/chokepoint context.
- Add AGSI+/ENTSOG for European gas observations where their coverage applies.
- Produce raw snapshot metadata and normalised candidate outputs. Promotion
  is gated by the refresh report and `daily:apply`; connectors do not write
  directly into runtime JSON.

### Phase 2 — Scheduled promotion and read model

- Add scheduled fetches, freshness monitoring, backfill handling and
  idempotent promotion.
- Build a versioned read model/API while retaining static fallbacks for
  degraded operation.
- Expose source age, confidence, coverage and derivation in the UI.

### Phase 3 — Licensed and private coverage

- Evaluate live AIS, vessel/cargo, JKM, freight, inventory, nominations,
  contract, insurance and credit feeds.
- Add them only when licensing, identity resolution, retention and
  reconciliation requirements are documented.

## 7. Publication and validation gates

An Energy/LNG data change follows the staged commands:

    bun run energy:refresh
    bun run daily:evidence
    bun run daily:test
    bun run daily:apply -- --dry-run
    bun run daily:update
    bun run daily:check
    bun run build

The normal publishing command is bun run daily:update, which already runs
the relevant checks and build. The individual commands are useful for
diagnosis and for validating a connector's candidate output before review.

An ingestion change is ready for promotion only when:

- every record has source, observation date, unit, coverage and lineage;
- source age and cadence are visible to the reviewer;
- repeated fetches are idempotent and failed sources are explicit;
- derived metrics retain their inputs and method;
- no connector writes directly into React components or bypasses reviewed
  src/data;
- evidence checks, tests, data checks and the production build pass; and
- the UI states “Insufficient verified data” when the available evidence does
  not support a stronger claim.

## 8. Related documents

- [Daily agent prompt](daily-agent-prompt.md) — executable daily workflow.
- [Daily update runbook](daily-update-runbook.md) — schemas, freshness rules
  and rare operations.
- [Energy/LNG vertical plan](energy-lng-vertical-plan.md) — product scope and
  phased capability plan.
- [Product requirements document](../PRD.md) — platform and data
  requirements.
