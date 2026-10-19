export interface WeatherPatch {
  id: string;
  url: string;
  bounds: [number, number, number, number];
  width: number;
  height: number;
  bytes: number;
  sha256: string;
}

export interface WeatherHistoryFrame {
  frameId: string;
  observedAt: string;
  url: string;
}

export interface WeatherManifest {
  schemaVersion: "weather-imagery-v1";
  sourceId: "noaa-gmgsi-lw";
  sourceUrl: string;
  sourceSha256: string;
  frameId: string;
  observedAt: string;
  observationEnd: string;
  generatedAt: string;
  channel: "longwave-infrared";
  projection: "EPSG:4326";
  bounds: [number, number, number, number];
  resolutionKm: number;
  staleAfterMinutes: number;
  attribution: string;
  valueDescription: string;
  patches: WeatherPatch[];
  history?: WeatherHistoryFrame[];
  polarUrl?: string;
}

export interface PolarWeatherManifest {
  schemaVersion: "polar-clouds-v1";
  sourceId: "nasa-modis-cloud-fraction" | "nasa-modis-infrared";
  observedDate: string;
  generatedAt: string;
  attribution: string;
  sourceUrls: string[];
  sourceHashes: string[];
  colormapUrl: string;
  colormapSha256: string;
  patches: WeatherPatch[];
}

export interface WeatherFrame {
  manifest: WeatherManifest;
  patches: { patch: WeatherPatch; image: ImageBitmap }[];
  polar?: { manifest: PolarWeatherManifest; patches: { patch: WeatherPatch; image: ImageBitmap }[] };
}
