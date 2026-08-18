# Energy & LNG Public-Data Ingestion Design

**Status:** Design reference for the Energy/LNG vertical
**Last reviewed:** 2026-08-18
**Scope:** Public-data collection, provenance, normalisation and promotion into Globe

This document defines the ingestion layer to build around Globe. It is not an
active agent runbook and does not imply that scheduled connectors already
exist. The current publication path remains the reviewed daily workflow in
[daily-agent-prompt.md](daily-agent-prompt.md) and
[daily-update-runbook.md](daily-update-runbook.md).

## 1. Product boundary

The ingestion layer should turn public observations into traceable candidates
for Globe's energy graph, time series and exposure assessments:

    Public sources
        → raw snapshots
        → normalised records
        → quality and provenance checks
        → analyst review
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

This is the process that is live today and remains the source of truth while
the ingestion layer is being built:

1. Preview the liquid market refresh:
   bun run daily:fetch -- --dry-run.
2. Persist successful refreshes with bun run daily:refresh.
3. Use Firecrawl to review every due or changed URL in
   src/data/exposure-traces.json. Record the reviewed result in
   src/data/evidence-audit.json.
4. Edit src/data/daily-state.json and the relevant exposure/trade inputs.
   Preserve explicit confirmed, carried and unavailable states.
5. Preview distribution with bun run daily:apply -- --dry-run.
6. Publish and run the complete gate with bun run daily:update.

daily:update runs the evidence check, tests, apply step, data check and
production build. It mirrors reviewed source data into the runtime datasets
under public/data/. It does not recrawl sources after review. A future
connector must therefore produce reviewable candidates; it must not silently
overwrite reviewed state or bypass daily:apply.

The current manual verification rule also remains in force for JKM, Dubai and
Oman, LNG and VLCC freight, AIS/transit counts, Qatar output, force majeure
and war-risk observations unless an approved machine-readable source is added
with an explicit contract.

## 3. Source registry

These are candidate sources for the Energy/LNG vertical. “Future” means the
source is suitable for an ingestion connector but is not currently wired into
Globe's daily scripts.

| Domain | Open source candidates | Useful observations | Cadence and limitation | Globe status |
| --- | --- | --- | --- | --- |
| Gas balances, production, storage and prices | [EIA Open Data](https://www.eia.gov/opendata/), [JODI-Gas](https://www.jodidata.org/gas/database/data-downloads.aspx) | Production, imports/exports, storage, prices, balances | EIA coverage varies by series; JODI is monthly and usually lagged | Future |
| Trade flows and concentration | [UN Comtrade](https://comtradeplus.un.org/TradeFlow) | Reporter, partner, HS commodity, value, quantity and direction | Monthly or annual customs data; does not prove cargo-level movement or current exposure | Future |
| Terminals, pipelines and other assets | [Global Energy Monitor GGIT](https://globalenergymonitor.org/projects/global-gas-infrastructure-tracker/), [UN/LOCODE](https://unece.org/trade/cefact/unlocode-code-list-country-and-territory) | Asset identity, location, status, capacity and place identifiers | Release-based or static snapshots; validate against current operator/regulator material | Phase 0 / future |
| Ports, chokepoints and maritime pressure | [IMF PortWatch](https://portwatch.imf.org/pages/data-and-methodology) | Port activity, trade proxies, chokepoint and disruption indicators | Modelled or aggregated indicators; not a substitute for live AIS or cargo confirmation | Future |
| European gas system | [AGSI+](https://agsi.gie.eu/), [ENTSOG Transparency](https://transparency.entsog.eu/) | Storage, nominations, flows, network and facility observations | Coverage is strongest in Europe and depends on the source's reporting rules | Future |
| Historical LNG vessel and terminal baseline | [LNG-T3](https://zenodo.org/records/19571058) | Historical vessel voyages, terminals, throughput and country flows | Historical dataset; useful for backtesting and priors, not live status | Future |
| Events and public disclosures | Official operator, regulator and government releases; [GDELT](https://www.gdeltproject.org/) for discovery | Outages, sanctions, force majeure, policy, weather and security events | Discovery feeds require source-level review; exact pages and claims must be captured | Current review / future discovery |
| Macro and supporting market series | [World Bank Pink Sheet](https://www.worldbank.org/en/research/commodity-markets), [NY Fed SOFR](https://www.newyorkfed.org/markets/reference-rates/sofr-averages-and-index), EIA market series | Oil, gas and macro benchmarks used as context | Series definitions and publication times differ | Partial current / future |

The following remain known coverage gaps rather than assumed open-data
capabilities: live vessel identity and cargo tracking, JKM, delivered LNG
freight, inventory nominations, contract terms, gas quality, insurance and
counterparty credit. These require licensed, internal or manually verified
inputs before they can support a stronger exposure claim.

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

The connector output is a candidate dataset. An analyst or approved
promotion process must review freshness, source support, units, entity
resolution and claim strength. Approved evidence is then reflected in the
appropriate src/data source files and published through the existing
daily:apply path.

## 6. Proposed implementation phases

### Phase 0 — Contracts and fixtures

- Define source registry, canonical entities, IDs, units, statuses and lineage.
- Add raw-snapshot and candidate-record conventions without changing the
  current React data contract.
- Use the existing static fixtures to test provenance and derived metrics.

### Phase 1 — High-value open-data connectors

- Start with EIA/JODI for balances and benchmarks, UN Comtrade for trade
  concentration, GEM/UNLOCODE for asset identity and PortWatch for
  port/chokepoint context.
- Add AGSI+/ENTSOG for European gas observations where their coverage applies.
- Produce raw and normalised outputs plus review reports; do not publish
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

Until an automated promotion path is explicitly implemented, a data change
must follow the existing commands:

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
