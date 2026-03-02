# OSINT Data & Intelligence Gathering Agent Swarm
## Instruction Prompt for sandbox-finance Upgrade

**Project:** sandbox-finance → Rainmarket OSINT Data Ingestion Layer  
**Objective:** Build an open-source, modular agent swarm that continuously collects, normalizes, and stores trade intelligence data from free public APIs — inspired by Bilawal Sidhu's WorldView agent swarm architecture.

---

## CONTEXT FOR THE AI AGENT

You are upgrading the `sandbox-finance` repository to include a **data ingestion agent swarm** — a system of autonomous, parallel-running Python agents that each specialize in collecting data from a specific open-source trade/economic data API. This is the foundational data layer for Rainmarket, ASEAN's Trade Intelligence Engine.

**Architecture philosophy:** Like Bilawal Sidhu's WorldView approach, we run multiple specialized agents in parallel — each responsible for one data domain — with a central coordinator that orchestrates collection schedules, handles failures, and merges outputs into a unified data store. The human (Aaron) acts as the architect and steerer; the agents do the heavy lifting.

**This is NOT a trading bot or advisory system.** This is a data ingestion and intelligence gathering layer — think of it as the "sensor network" that feeds the intelligence engine.

---

## PROJECT STRUCTURE

Create this structure inside `sandbox-finance/`:

```
sandbox-finance/
├── swarm/
│   ├── __init__.py
│   ├── coordinator.py          # Swarm orchestrator — schedules, monitors, retries
│   ├── base_agent.py           # Abstract base class all collector agents inherit from
│   ├── config.py               # API keys, rate limits, schedule configs
│   ├── storage.py              # Unified data store (SQLite for local, Supabase-ready)
│   ├── logger.py               # Structured logging for all agents
│   │
│   ├── agents/                 # One file per data source agent
│   │   ├── __init__.py
│   │   ├── comtrade_agent.py   # UN Comtrade — bilateral trade flows by HS code
│   │   ├── wto_agent.py        # WTO Tariff & Trade Data
│   │   ├── imf_dots_agent.py   # IMF Direction of Trade Statistics
│   │   ├── worldbank_agent.py  # World Bank — GDP, inflation, economic indicators
│   │   ├── news_agent.py       # RSS/news headline scraper (Reuters, Nikkei Asia, The Edge MY)
│   │   └── forex_agent.py      # Exchange rates (free forex API)
│   │
│   ├── processors/             # Data normalization and enrichment
│   │   ├── __init__.py
│   │   ├── normalizer.py       # Standardize country codes, HS codes, date formats
│   │   ├── deduplicator.py     # Prevent duplicate records across collection runs
│   │   └── enricher.py         # Cross-reference enrichment (e.g., attach tariff rates to trade flows)
│   │
│   ├── outputs/                # Where processed data lands
│   │   ├── raw/                # Raw API responses (JSON, archived by date)
│   │   ├── processed/          # Normalized, deduplicated data (Parquet/CSV)
│   │   └── alerts/             # Anomaly flags and threshold breaches
│   │
│   └── tests/
│       ├── test_agents.py
│       ├── test_coordinator.py
│       └── test_normalizer.py
│
├── run_swarm.py                # CLI entry point
├── .env.example                # Template for API keys
├── requirements.txt
└── README.md
```

---

## AGENT BASE CLASS

Every collector agent must inherit from this base. This ensures consistency, retry logic, rate limiting, and structured output.

```python
# swarm/base_agent.py

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import asyncio
import logging
import time
import json

class BaseCollectorAgent(ABC):
    """
    Base class for all data collection agents in the swarm.
    Each agent is responsible for ONE data source.
    """
    
    def __init__(self, agent_name: str, rate_limit_per_minute: int = 10):
        self.agent_name = agent_name
        self.rate_limit = rate_limit_per_minute
        self.last_request_time = 0
        self.logger = logging.getLogger(f"swarm.{agent_name}")
        self.collection_stats = {
            "total_requests": 0,
            "successful": 0,
            "failed": 0,
            "last_run": None,
            "records_collected": 0
        }
    
    @abstractmethod
    async def collect(self, params: Dict[str, Any]) -> List[Dict]:
        """
        Execute the data collection for this agent.
        Must return a list of normalized dictionaries.
        Each dict must include: source, collected_at, data_type, payload
        """
        pass
    
    @abstractmethod
    def get_default_params(self) -> Dict[str, Any]:
        """
        Return default collection parameters.
        E.g., which countries, HS codes, date ranges to pull.
        """
        pass
    
    @abstractmethod
    def validate_response(self, response: Any) -> bool:
        """Validate that the API response is well-formed."""
        pass
    
    async def rate_limited_request(self, request_fn, *args, **kwargs):
        """Enforce rate limiting between API calls."""
        elapsed = time.time() - self.last_request_time
        min_interval = 60.0 / self.rate_limit
        if elapsed < min_interval:
            await asyncio.sleep(min_interval - elapsed)
        
        self.last_request_time = time.time()
        self.collection_stats["total_requests"] += 1
        
        try:
            result = await request_fn(*args, **kwargs)
            self.collection_stats["successful"] += 1
            return result
        except Exception as e:
            self.collection_stats["failed"] += 1
            self.logger.error(f"Request failed: {e}")
            raise
    
    async def run(self, params: Optional[Dict] = None) -> List[Dict]:
        """
        Main execution method with retry logic.
        Called by the coordinator.
        """
        params = params or self.get_default_params()
        self.logger.info(f"Starting collection with params: {json.dumps(params, default=str)}")
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                results = await self.collect(params)
                self.collection_stats["records_collected"] += len(results)
                self.collection_stats["last_run"] = datetime.now(timezone.utc).isoformat()
                self.logger.info(f"Collected {len(results)} records")
                return results
            except Exception as e:
                self.logger.warning(f"Attempt {attempt+1}/{max_retries} failed: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
        
        self.logger.error("All retry attempts exhausted")
        return []
    
    def wrap_record(self, data_type: str, payload: Dict) -> Dict:
        """Standardize every record with metadata envelope."""
        return {
            "source": self.agent_name,
            "data_type": data_type,
            "collected_at": datetime.now(timezone.utc).isoformat(),
            "payload": payload
        }
```

---

## AGENT IMPLEMENTATIONS

### Agent 1: UN Comtrade (Trade Flows)

This is the most critical agent — it powers the Trade Flow Intelligence module.

```
Source: UN Comtrade API v2 (https://comtradeapi.un.org/)
Data: Bilateral trade flows by HS code, reporter/partner country, year/month
Rate limit: 100 requests/hour (free tier), requires subscription key
ASEAN focus: MY, SG, ID, TH, VN, PH as reporters
Key HS codes for demo: 8541/8542 (semiconductors), 1511 (palm oil), 2709/2710 (petroleum)
```

**Collection strategy:**
- Pull monthly data for ASEAN-6 countries
- Focus on top 20 HS 4-digit codes by trade value
- Store both import and export flows
- Calculate YoY growth rates during normalization

### Agent 2: WTO Tariff Data

```
Source: WTO Tariff Download Facility + I-TIP API
Data: Applied tariff rates, bound rates, preferential rates (ATIGA, RCEP)
Rate limit: Moderate, no strict published limit
ASEAN focus: Preferential vs MFN rates for ASEAN bilateral corridors
```

**Collection strategy:**
- Pull tariff schedules for HS codes matching Comtrade agent's collection
- Specifically capture ATIGA preferential rates vs MFN rates
- Flag tariff differentials > 5% as "arbitrage signals"

### Agent 3: IMF DOTS (Direction of Trade)

```
Source: IMF Data API (https://data.imf.org/)
Data: Quarterly aggregate trade direction between country pairs
Rate limit: Generous, ~200 requests/minute
ASEAN focus: ASEAN-China, ASEAN-US, ASEAN-EU, intra-ASEAN corridors
```

**Collection strategy:**
- Quarterly pulls for macro trade direction
- Cross-validate against Comtrade monthly data
- Flag divergences (Comtrade says X, DOTS says Y) as data quality alerts

### Agent 4: World Bank Indicators

```
Source: World Bank Open Data API (https://api.worldbank.org/v2/)
Data: GDP, inflation, trade % of GDP, logistics performance index
Rate limit: Very generous
ASEAN focus: All ASEAN-10 + major trade partners (CN, US, JP, KR, AU, IN)
```

**Collection strategy:**
- Annual macro indicators to contextualize trade flows
- Pull latest available year + 5-year history for trend analysis

### Agent 5: News / Headline Agent

```
Source: RSS feeds — Reuters Asia, Nikkei Asia, The Edge Malaysia, SCMP
Data: Headlines, summaries, publication dates
No API key required — RSS is open
```

**Collection strategy:**
- Poll RSS feeds every 30 minutes
- Filter for keywords: tariff, trade, ASEAN, supply chain, semiconductor, palm oil, sanctions, customs
- Store headline + summary + URL + timestamp
- This becomes the "news signal" feed for Orange Alerts

### Agent 6: Forex / Exchange Rates

```
Source: exchangerate-api.com or frankfurter.app (free, no key)
Data: Daily exchange rates for ASEAN currencies
Currencies: MYR, SGD, IDR, THB, VND, PHP, CNY, USD, EUR, JPY
```

**Collection strategy:**
- Daily collection of spot rates
- Calculate 7-day and 30-day moving averages
- Flag unusual moves (> 2 standard deviations from 30-day mean)

---

## SWARM COORDINATOR

The coordinator is the brain. It manages scheduling, parallel execution, and failure handling.

```python
# swarm/coordinator.py — key design requirements

class SwarmCoordinator:
    """
    Orchestrates all collector agents.
    Inspired by Bilawal's approach: each agent runs independently,
    the coordinator manages timing, monitors health, merges outputs.
    """
    
    # REQUIREMENTS:
    # 1. Register agents with individual schedules
    #    - comtrade: every 6 hours (rate limited)
    #    - wto: daily (tariffs don't change often)
    #    - imf_dots: daily (quarterly data, check for updates daily)
    #    - worldbank: weekly (annual data)
    #    - news: every 30 minutes
    #    - forex: every hour during trading hours
    #
    # 2. Run agents concurrently using asyncio.gather()
    #    - Each agent is an independent async task
    #    - Failure in one agent must NOT crash others
    #    - Log all failures with full traceback
    #
    # 3. Health dashboard
    #    - Track last successful run per agent
    #    - Track success/failure rates
    #    - Alert if any agent hasn't succeeded in 2x its schedule interval
    #
    # 4. Output routing
    #    - Raw responses → outputs/raw/{agent_name}/{date}/
    #    - Processed records → outputs/processed/ via normalizer pipeline
    #    - Anomaly flags → outputs/alerts/
    #
    # 5. CLI interface via run_swarm.py
    #    - `python run_swarm.py --all`              Run all agents once
    #    - `python run_swarm.py --agent comtrade`   Run single agent
    #    - `python run_swarm.py --daemon`            Run on schedule continuously
    #    - `python run_swarm.py --status`            Show agent health dashboard
    #    - `python run_swarm.py --export`            Export latest processed data
```

---

## DATA STORAGE LAYER

```python
# swarm/storage.py — design requirements

# LOCAL MODE (default for sandbox experimentation):
# - SQLite database at swarm/data/swarm.db
# - Tables: raw_collections, processed_records, alerts, agent_health
# - Parquet export for processed data (efficient for pandas analysis)

# SUPABASE-READY MODE (for Rainmarket production):
# - Same interface, swap SQLite for Supabase client
# - Use environment variable STORAGE_MODE=local|supabase
# - When supabase: use existing Rainmarket Supabase project credentials

# SCHEMA for processed_records:
# - id: UUID
# - source: str (agent name)
# - data_type: str (trade_flow | tariff | macro_indicator | news | forex)
# - reporter_country: str (ISO3)
# - partner_country: str (ISO3, nullable)
# - hs_code: str (nullable, for trade/tariff data)
# - period: str (YYYY-MM or YYYY-Q# or YYYY)
# - value: float
# - unit: str (USD, %, rate)
# - metadata: JSON (additional fields specific to data type)
# - collected_at: timestamp
# - processed_at: timestamp
```

---

## NORMALIZER / ENRICHMENT PIPELINE

```python
# swarm/processors/normalizer.py — requirements

# 1. Country code standardization
#    - Accept: ISO2, ISO3, country names, UN M49 codes
#    - Output: Always ISO3 (MYS, SGP, IDN, THA, VNM, PHL)
#    - Handle edge cases: "Korea, Rep." → KOR, "Viet Nam" → VNM
#
# 2. HS code normalization
#    - Accept: 2-digit, 4-digit, 6-digit HS codes
#    - Standardize to 6-digit with zero-padding
#    - Include lookup for HS code descriptions (embed a slim HS2022 mapping)
#
# 3. Date/period normalization
#    - Monthly: YYYY-MM
#    - Quarterly: YYYY-Q1/Q2/Q3/Q4
#    - Annual: YYYY
#    - All timestamps in UTC ISO 8601
#
# 4. Currency standardization
#    - All monetary values converted to USD using forex agent's latest rates
#    - Store both original value + currency AND USD equivalent

# swarm/processors/enricher.py — requirements

# Cross-reference enrichment (runs AFTER all agents complete a cycle):
# 1. Attach tariff rates to trade flow records
#    - Match on: reporter + partner + HS code
#    - Add fields: mfn_rate, preferential_rate, tariff_differential
#
# 2. Attach macro context to trade flows
#    - For each reporter country, attach latest GDP, inflation, trade_pct_gdp
#
# 3. Anomaly detection (simple statistical)
#    - Trade flow: flag if monthly value deviates > 2 std from 12-month rolling mean
#    - Forex: flag if daily rate deviates > 2 std from 30-day mean
#    - Tariff: flag if rate changed from previous collection
#    - News: flag if keyword density spikes (> 3x normal for a topic)
#
# 4. Generate "Orange Alert" candidates
#    - When multiple signals align (trade anomaly + news spike + tariff change
#      in the same country/corridor), create an alert record
#    - This is Rainmarket's early warning system prototype
```

---

## CONFIGURATION

```python
# .env.example

# === API Keys ===
UN_COMTRADE_API_KEY=your_subscription_key_here
# WTO, IMF, World Bank are free / no key required
# FOREX_API_KEY=optional_for_premium_tier

# === ASEAN Focus Countries (ISO3) ===
FOCUS_REPORTERS=MYS,SGP,IDN,THA,VNM,PHL
FOCUS_PARTNERS=CHN,USA,JPN,KOR,AUS,IND,DEU,GBR

# === Key HS Codes (4-digit) for initial collection ===
FOCUS_HS_CODES=8541,8542,1511,2709,2710,8471,8473,4001,1513,7108

# === Storage ===
STORAGE_MODE=local
# SUPABASE_URL=your_supabase_url
# SUPABASE_KEY=your_supabase_anon_key

# === Schedule (cron-like) ===
COMTRADE_INTERVAL_HOURS=6
WTO_INTERVAL_HOURS=24
IMF_INTERVAL_HOURS=24
WORLDBANK_INTERVAL_HOURS=168
NEWS_INTERVAL_MINUTES=30
FOREX_INTERVAL_MINUTES=60
```

---

## REQUIREMENTS.TXT

```
httpx>=0.27.0          # Async HTTP client (preferred over aiohttp for simplicity)
pydantic>=2.0          # Data validation for API responses
feedparser>=6.0        # RSS parsing for news agent
pandas>=2.0            # Data manipulation and analysis
pyarrow>=14.0          # Parquet file support
python-dotenv>=1.0     # Environment variable management
apscheduler>=3.10      # Job scheduling for daemon mode
rich>=13.0             # Beautiful CLI output and status dashboard
pycountry>=24.0        # Country code lookups and normalization
```

---

## HOW TO RUN (README.md content)

```markdown
## Quick Start

1. Clone and install:
   ```bash
   cd sandbox-finance
   pip install -r requirements.txt
   cp .env.example .env
   # Add your UN Comtrade API key to .env
   ```

2. Run all agents once (test mode):
   ```bash
   python run_swarm.py --all
   ```

3. Run a single agent:
   ```bash
   python run_swarm.py --agent comtrade
   python run_swarm.py --agent news
   ```

4. Check swarm health:
   ```bash
   python run_swarm.py --status
   ```

5. Run in daemon mode (continuous collection):
   ```bash
   python run_swarm.py --daemon
   ```

6. Export latest processed data:
   ```bash
   python run_swarm.py --export --format parquet
   python run_swarm.py --export --format csv
   ```
```

---

## KEY DESIGN PRINCIPLES

1. **Each agent is independent.** Failure in the news agent must never block the Comtrade agent. Use `asyncio.gather(return_exceptions=True)`.

2. **Raw data is sacred.** Always archive the raw API response before processing. You can always re-process; you can't always re-fetch (rate limits, data rotation).

3. **Idempotent collection.** Running the same agent twice for the same period should not create duplicates. Use composite keys (source + data_type + reporter + partner + hs_code + period) for deduplication.

4. **Observable.** Every agent logs structured JSON. The coordinator exposes a health dashboard via `--status`. If an agent is silently failing, you should know within one schedule interval.

5. **ASEAN-first defaults.** All default parameters focus on ASEAN-6 countries and Rainmarket's priority HS codes. The system should produce useful output immediately with just a Comtrade API key.

6. **Supabase-ready.** Local SQLite for experimentation, but the storage interface is designed so switching to Supabase (Rainmarket's production DB) requires only changing an environment variable.

7. **Enrichment is separate from collection.** Agents collect. Processors enrich. This separation means you can add new agents without touching the enrichment pipeline, and vice versa.

---

## SUCCESS CRITERIA

After building this, running `python run_swarm.py --all` should:

- [ ] Pull latest monthly trade flows for MY-SG, MY-CN, ID-SG corridors from UN Comtrade
- [ ] Fetch applicable tariff rates (MFN + ATIGA preferential) for matched HS codes
- [ ] Collect latest macro indicators (GDP, inflation) for ASEAN-6
- [ ] Scrape 50+ trade-related headlines from RSS feeds
- [ ] Fetch current exchange rates for ASEAN currencies
- [ ] Normalize all data into a unified schema in SQLite
- [ ] Cross-reference trade flows with tariff rates
- [ ] Flag any anomalies (trade volume spikes, tariff changes, news clusters)
- [ ] Export a clean Parquet file ready for dashboard consumption
- [ ] Display a health dashboard showing all agent statuses

---

## FUTURE EXTENSIONS (do not build now, but architect for)

- **AIS/vessel tracking agent** — MarineTraffic or VT Explorer API for shipping lane intelligence
- **Satellite imagery agent** — Sentinel Hub free tier for port activity monitoring
- **Social media agent** — Twitter/X API for trade policy sentiment
- **LLM summarizer** — Feed news agent output through Claude/GPT for daily intelligence briefs
- **WebSocket live feeds** — Upgrade forex and flight data to real-time streaming
- **VLM integration** — Visual Language Model to analyze satellite/port imagery (Bilawal's roadmap item)

---

*This prompt is designed to be fed to Claude Code, Codex, or Gemini Code Assist running in a terminal. Assign each major section to a separate agent instance for parallel development — just like Bilawal built WorldView.*
