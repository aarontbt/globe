export interface Port {
  id: string;
  name: string;
  country: string;
  coordinates: [number, number];
  teu: number; // TEU throughput in thousands
  type: "asean" | "partner" | "global";
  rank: number; // world rank by container throughput
  operator: string; // main terminal operator(s)
  depth: number; // berth/channel depth in metres
}

export interface TradeArc {
  id: string;
  from: string;
  to: string;
  fromCoords: [number, number];
  toCoords: [number, number];
  valueBn: number; // USD billions
  commodity: string;
  color: [number, number, number];
}

export interface Corridor {
  id: string;
  name: string;
  fromPort: string;
  toPort: string;
  path: [number, number][];
  volume: number;
  commodity: string;
  narrative: string;
  color: [number, number, number];
}

export interface AnimatedVessel {
  id: number;
  laneIndex: number;
  offset: number;
  speed: number;
  position: [number, number];
}

export type EventCategory =
  | "security"
  | "political"
  | "economic"
  | "climate"
  | "election"
  | "diplomatic";

export type EventImpact = "high" | "medium" | "low";

export interface PolymarketData {
  volume: string;       // e.g. "$9.1M"
  liquidity: string;    // e.g. "$1.2M"
  comments: number;     // commentCount from Gamma API
  slug: string;         // polymarket.com/event/{slug}
}

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  currency: string;
  unit: string;
  lastUpdated: string;
  history?: number[];
}

export interface NewsArticle {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  source: "CNA" | "BBC" | "Reuters" | "CNBC" | "Al Jazeera";
  category?: string;
}

export interface Aircraft {
  icao24: string;
  callsign: string;
  country: string;
  lon: number;
  lat: number;
  altitudeM: number; // geometric altitude in metres
  velocityMs: number; // speed in m/s
  heading: number; // true track in degrees
}

export interface FlightTrack {
  icao24: string;
  callsign: string;
  path: Array<[number, number, number]>; // [lon, lat, altMeters]
}

export interface Satellite {
  name: string;
  lat: number;
  lon: number;
  altitudeKm: number;
  periodMin: number;
}

export interface CountryLabel {
  name: string;
  coordinates: [number, number];
}

export interface GlobeEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  country: string;
  region: string;
  coordinates: [number, number];
  probability: number; // 0-100
  impact: EventImpact;
  date: string;
  tags: string[];
  polymarket?: PolymarketData;
}
