export interface Port {
  id: string;
  name: string;
  country: string;
  coordinates: [number, number];
  teu: number; // TEU throughput in thousands
  type: "asean" | "partner";
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
