# Rainmarket Energy & LNG Intelligence - Product Requirements Document

- **Status:** Implementation in progress on `feat/energy-lng-vertical`
- **Date:** 19 August 2026
- **Implementation plan:** [`docs/energy-lng-vertical-plan.md`](docs/energy-lng-vertical-plan.md)

## Product thesis

Globe should become Rainmarket's Energy & LNG disruption-intelligence vertical. It should help an energy strategy, risk, trade-finance or operations user answer:

> What changed in the energy flow, what is exposed, how material is it, what can move next, and what should we watch or do?

The product is an evidence-backed public-intelligence and physical-flow assessment system. It is not initially a trading bot, a replacement for a cargo-management system, or a claim about confidential customer exposure.

## Current baseline

Globe already provides:

- a 3D globe with shipping lanes, ports, corridors, trade arcs, oil-supply-chain routes and selected exposure routes;
- curated Iran/Hormuz scenarios plus live market, news, social, satellite and prediction-market signals;
- a `SIGNAL → EXPOSURE` overlay with Exposure Trace, Signals, Market Transmission, Commercial Evaluation, Counterparties, Actions and Evidence views;
- daily-state distribution, source freshness rules, evidence audits and validation gates.

The current trace dataset is a strong demonstrator for three Hormuz LNG/crude scenarios. It is not yet a reusable Energy/LNG graph, alternatives engine or physical commodity decision system.

## Product workflow

The target workflow is:

```text
What changed
    → Physical flow impact
    → Market exposure
    → Delivered economics
    → Alternatives
    → Action and watchlist
    → Evidence
```

The globe is the spatial overview. The assessment surface explains the selected disruption and supports comparison and action.

## Primary user and initial boundary

The first release targets energy strategy, risk and trade-finance users who need an evidence-backed market and physical-flow assessment from public data.

The product may later support physical traders, utilities and customer-specific portfolio workflows. Cargo books, contracts, nominations, inventory, hedges, credit limits and confidential exposure are later integrations, not assumptions in the public-data product.

## Functional requirements

### 1. Disruption detection

Represent and monitor:

- geopolitical and security events;
- force majeure, production outages and maintenance;
- port, terminal and chokepoint disruption;
- vessel-flow and transit anomalies;
- sanctions, export restrictions and policy changes;
- weather and other operational disruptions.

Each event must have a source, timestamp, confidence, affected geography and an explicit distinction between observed fact and analytical inference.

### 2. Energy-flow graph

Represent the physical chain:

```text
Producer / field
    → Liquefaction train
    → Export terminal
    → Vessel / carrier
    → Route / chokepoint
    → Regasification terminal
    → Buyer / market
```

The canonical model must support producers, trains, terminals, vessels, ports, routes, chokepoints, markets, buyers, contracts, events, benchmarks and evidence. It must preserve stable IDs, time validity, units, provenance and source freshness.

The existing `ExposureTraceData` model should become a UI read model generated from this canonical data, rather than the long-term system of record.

### 3. Exposure assessment

For a selected disruption, show:

- affected origin, destination, route and chokepoint;
- volume or cargo capacity at risk;
- source and destination dependency;
- concentration and substitution constraints;
- estimated delay or replacement lead time;
- affected public companies, buyers or markets;
- confidence and data completeness.

Public relationships must be labelled as public contracts, operational dependencies or market sensitivities. They must not be presented as verified financial or physical exposure without actual quantities, obligations, title, settlement, credit or portfolio data.

### 4. Flow Pressure score

Introduce an explainable 0-100 Flow Pressure score. Its first version should combine:

- supply interruption;
- route and chokepoint pressure;
- vessel and port disruption;
- destination dependency;
- price and basis movement;
- availability of alternative supply.

Every score must expose component inputs, weights, calculation version, as-of timestamp and supporting evidence. Missing or stale inputs must reduce confidence or produce `Insufficient verified data`; they must not be silently estimated.

### 5. Market and delivered economics

Support energy-specific market context including JKM, TTF, Henry Hub, Brent, freight, war-risk insurance, FX and financing where verified.

The delivered-economics model should progressively include:

- origin or FOB value;
- destination benchmark;
- LNG freight and fuel;
- boil-off and losses;
- war-risk insurance;
- port, canal, terminal and regasification costs;
- demurrage, inspection and working capital;
- hedge and credit effects when customer data is available.

Outputs are public proxies or scenario ranges, not profit or trade recommendations, unless the required data and semantics are verified.

### 6. Alternatives engine

For each disruption, evaluate three alternative types separately:

- alternative supply source;
- alternative destination market;
- alternative route or terminal.

Rank candidates using demonstrated capacity, availability, transit time, cost, infrastructure compatibility, sanctions and insurance constraints, contract flexibility, reliability and evidence quality.

The UI must distinguish a potential alternative from one that is physically feasible and one that is commercially executable.

### 7. Actions and monitoring

For each assessment, provide:

- watch items and trigger conditions;
- source-linked actions for the selected user persona;
- scenario states such as base, stress and tail;
- a way to compare alternatives and preserve the assessment snapshot.

## Data and architecture requirements

The long-term flow is:

```text
Raw source collection
    → Normalisation and validation
    → Canonical energy graph and time series
    → Exposure, pressure and alternatives calculations
    → Globe read model / API
    → Globe experience layer
```

The current static JSON fixtures remain useful for the first demonstrator. New domain data should not be embedded directly into React components. The runtime should move toward a versioned read API or data service while retaining static fallbacks for degraded operation.

Initial source groups are public energy, trade, market, maritime, policy and authoritative news data. The current [`docs/energy-lng-data-ingestion.md`](docs/energy-lng-data-ingestion.md) defines the public-data ingestion design and its publication boundary.

## Phased scope

### Phase 0 - Contracts and model foundation

- finalise the Energy/LNG canonical entities, relationships, IDs, units and provenance contract;
- separate domain data from the current trace UI model;
- define Flow Pressure components and evidence requirements;
- reconcile the source/runtime data contract and preserve current validation gates.

### Phase 1 - Thin end-to-end Energy/LNG MVP

Use the existing Qatar/Hormuz/Japan-Korea scenario to prove one complete loop:

```text
Disruption → affected LNG flow → exposure → Flow Pressure → alternatives → evidence
```

Do not expand globally until this loop is reproducible and useful.

### Phase 2 - Physical-flow resolution

Add time-series coverage for production, terminal status, vessel movements, port calls, chokepoints, route delays and destination demand. Reconcile public flow observations before displaying derived volume-at-risk claims.

### Phase 3 - Delivered economics and decision support

Add route-normalised freight, war-risk, terminal, regasification, losses, financing, hedge and credit inputs. Add scenario comparison and alternative ranking with explicit feasibility and confidence.

### Phase 4 - Customer and portfolio intelligence

Integrate cargo books, contracts, procurement, inventory, hedge, credit and operational data as permissioned customer extensions. Only this phase can support verified customer-specific exposure.

## Non-goals for the first release

- a global all-commodity trade platform;
- a fully automated trading or procurement recommendation system;
- unverified live AIS presented as a complete physical-flow truth;
- confidential counterparty or portfolio claims from public relationships;
- full P&L, hedge or credit decisions without the required customer data;
- five separate vertical applications.

## Success criteria

The first release is successful when a user can select one verified Energy/LNG disruption and receive:

1. a traceable physical-flow explanation;
2. a quantified exposure assessment with freshness and confidence;
3. an explainable Flow Pressure score;
4. at least one evidence-backed alternative route, source or market;
5. a clear action/watchlist output;
6. an auditable snapshot that reproduces from the underlying data.

The existing evidence, daily-check, test and build workflows must remain passing as the vertical is expanded.
