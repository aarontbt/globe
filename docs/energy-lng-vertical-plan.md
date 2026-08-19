# Energy & LNG Vertical Plan

- **Branch:** `feat/energy-lng-vertical`
- **Status:** Implementation in progress — Phase 0 canonical boundary and provisional Flow Pressure slice landed
- **Date:** 19 August 2026
- **PRD:** [`../PRD.md`](../PRD.md)

## Objective

Evolve Globe from an Iran/Hormuz disruption demonstrator into Rainmarket's Energy & LNG disruption-intelligence vertical.

The first product promise is:

> See what changed in the energy flow, what is exposed, how material it is, what can move next, and what to watch.

This is a public-intelligence and physical-flow assessment product first. It should not imply access to confidential cargo books, contracts, hedges, inventory or customer positions.

## Product boundary

### First user

Start with energy strategy, risk and trade-finance users who need an evidence-backed assessment from public data. Physical traders, utilities and customer-specific portfolio users are later extensions with different data requirements.

### First end-to-end scenario

Use the existing Qatar/Hormuz/Japan-Korea LNG scenario:

```text
Hormuz or Qatar disruption
    → affected LNG supply and route
    → Asian demand exposure
    → Flow Pressure
    → alternative source, market or route
    → watch/action
    → evidence
```

The first milestone is one complete, reproducible loop. More traces and geographies come after the loop is useful.

## What to retain from Globe

- deck.gl globe, current map styling and spatial interaction;
- ports, routes, chokepoints, vessels and supply-chain layers;
- `SIGNAL → EXPOSURE` as the core interaction pattern;
- Evidence, Actions, Counterparties and Market Transmission panels;
- daily-state, source-freshness, evidence-audit and validation workflows;
- current Qatar supply, Hormuz delivery and Hormuz crude traces as fixtures and migration inputs;
- static fallback behaviour when live sources fail.

## What to build

### 1. Canonical Energy/LNG domain model

Build a domain model separate from the current `ExposureTraceData` UI model.

Core entities:

- producer, field, liquefaction train and export terminal;
- vessel, carrier, port, regasification terminal and storage;
- route, corridor and chokepoint;
- buyer, market, contract and demand region;
- event, benchmark, assessment, alternative and evidence.

Core relationships:

```text
PRODUCER → TRAIN → EXPORT TERMINAL → VESSEL
→ ROUTE / CHOKEPOINT → REGAS TERMINAL → BUYER / MARKET
```

Every entity and relationship needs a stable ID, source provenance, as-of date, validity window, unit and confidence status.

The existing trace UI should be generated from this model through a read-model adapter. Avoid turning the current fixed three-trace JSON schema into the long-term database schema.

### 2. Ingestion and storage layer

Create a raw-to-derived pipeline:

```text
Raw source archive
    → normalised records
    → canonical graph and time series
    → derived assessments
    → versioned Globe read model
```

Initial source groups:

- physical: production, force majeure, terminal status, vessel movements and port calls;
- trade: LNG imports/exports, destination dependency and source concentration;
- maritime: chokepoints, route conditions, transit and delay observations;
- market: JKM, TTF, Henry Hub, Brent, freight, insurance, FX and financing;
- policy and events: sanctions, export restrictions, geopolitical, weather and operational events;
- public company and contract disclosures.

The [`energy-lng-data-ingestion.md`](energy-lng-data-ingestion.md) design defines the source registry, collector lifecycle, normalisation, provenance and promotion gates for this vertical.

### 3. Assessment engine

#### Physical exposure

Calculate and display:

- affected volume or cargo capacity;
- origin, destination and chokepoint dependency;
- concentration and substitution constraints;
- delay and replacement lead time;
- affected buyers and markets;
- confidence and data completeness.

#### Flow Pressure

Start with an explainable 0-100 score using:

- supply interruption;
- route/chokepoint pressure;
- vessel/port disruption;
- destination dependency;
- price/basis movement;
- alternative availability.

Persist component values, weights, model version, calculation timestamp and evidence links.

The initial implementation uses `flow-pressure-v1`: supply interruption (25%),
route/chokepoint pressure (20%), vessel/port disruption (15%), destination
dependency (15%), price/basis movement (15%) and alternative availability (10%).
Scores run from 0 (no observed pressure) to 100 (high pressure). Missing or
carried observations remain visible; unresolved components use a neutral score
of 50 and lower the assessment confidence rather than being silently estimated.

#### Delivered economics

Progressively model:

- origin/FOB value and destination benchmark;
- LNG freight, fuel, boil-off and losses;
- war-risk insurance;
- port, canal, terminal and regasification charges;
- demurrage, inspection and working capital;
- FX, hedge and credit effects when verified.

The calculation must return `Insufficient verified data` if required inputs are carried, unavailable, stale or unit-incompatible.

#### Alternatives

Implement separate ranking for:

- alternative source;
- alternative market;
- alternative route or terminal.

Rank on demonstrated capacity, availability, transit time, cost, infrastructure compatibility, sanctions/insurance constraints, contract flexibility, reliability and evidence quality. Label results as potential, physically feasible or commercially executable.

### 4. Experience-layer changes

Keep the globe as the overview and evolve the detail workflow to:

```text
What changed
→ Physical Flow
→ Market Exposure
→ Delivered Economics
→ Alternatives
→ Actions / Watchlist
→ Evidence
```

Add:

- energy-specific filters for commodity, origin, destination, route, terminal, buyer, timeframe and confidence;
- terminal, vessel and chokepoint status views;
- Flow Pressure breakdown;
- affected-flow and volume-at-risk views;
- side-by-side alternative comparison;
- clear separation between public relationship, verified contract and customer exposure;
- assessment snapshots that can be revisited and audited.

## Delivery sequence

### Current implementation checkpoint — 19 August 2026

- canonical Energy/LNG entity, relationship, observation and provenance types are in place;
- the reviewed exposure fixture is migrated through a canonical domain adapter;
- the existing Globe panels and map now consume a generated Energy/LNG read model;
- the first explainable Flow Pressure assessment is calculated and shown per trace;
- trace-scoped observation IDs prevent reused legacy input IDs from merging incompatible source context;
- alternative slots and feasibility semantics are present; the LNG traces expose European TTF only as a potential market candidate, with execution constraints explicitly unresolved.

### Phase 0 - Foundation

- agree canonical entities, relationships, IDs and units;
- define source, freshness and confidence contracts;
- define Flow Pressure formula and alternative-ranking semantics;
- preserve and extend existing evidence and daily validation gates;
- identify which current trace inputs are shared incorrectly and make commercial inputs trace-specific.

### Phase 1 - Thin vertical MVP

- add the canonical model and read-model adapter;
- implement one Qatar/Hormuz LNG assessment;
- connect one physical-flow dataset, one market dataset and one route/disruption dataset;
- calculate exposure and Flow Pressure;
- show one or more evidence-backed alternatives;
- deliver the full assessment in Globe.

### Phase 2 - Physical-flow resolution

- add production, terminal, vessel, port and chokepoint time series;
- add route delay and destination-demand observations;
- reconcile source differences and show coverage explicitly;
- support more LNG corridors without hard-coding each trace in React.

### Phase 3 - Economics and scenarios

- add complete delivered-cost components where verified;
- add base, stress and tail scenario comparison;
- rank diversions, alternative routes and supply sources by feasibility, deadline, cost and confidence.

### Phase 4 - Customer extension

- integrate permissioned cargo, contract, inventory, hedge, credit and operational data;
- calculate customer-specific exposure only from verified customer records;
- add portfolio actions, owners and deadlines.

## Guardrails

- Never turn a public relationship into verified counterparty exposure.
- Never publish an inferred volume, cost or alternative capacity as a confirmed fact.
- Preserve source, observation date, retrieval date, freshness, confidence and calculation lineage.
- Use `Insufficient verified data` rather than inventing missing economics.
- Keep public market intelligence separate from customer-specific portfolio data.
- Do not build five independent vertical applications; keep the energy taxonomy and workflow configurable.

## Definition of done for the first MVP

A user can select one verified disruption and receive:

1. the affected physical flow and route;
2. a quantified exposure view with confidence and freshness;
3. an explainable Flow Pressure score;
4. at least one evidence-backed alternative;
5. an action/watchlist output;
6. a reproducible, auditable assessment snapshot.

The existing evidence audit, daily checks, tests, TypeScript validation and production build must remain passing.
