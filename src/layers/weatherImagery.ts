import { COORDINATE_SYSTEM } from "@deck.gl/core";
import { BitmapLayer } from "@deck.gl/layers";
import type { WeatherFrame } from "../types/weather";
import { createPolarBitmapMesh } from "./polarBitmapMesh";

class PolarBitmapLayer extends BitmapLayer {
  static layerName = "PolarWeatherBitmapLayer";
  protected _createMesh() {
    return createPolarBitmapMesh(this.props.bounds as [number, number, number, number]);
  }
}

// Apply a display-only palette to the processed brightness. Alpha/no-data is untouched.
class EnhancedBitmapLayer extends BitmapLayer {
  static layerName = "EnhancedWeatherBitmapLayer";
  getShaders() {
    const shaders = super.getShaders();
    return { ...shaders, inject: {
      "fs:DECKGL_FILTER_COLOR": `
        float b = color.r;
        vec3 rgb = vec3(min(b / 0.4, 1.0));
        if (b >= 0.4 && b < 0.55) rgb = mix(vec3(1.0), vec3(0.54, 0.79, 0.94), (b - 0.4) / 0.15);
        else if (b >= 0.55 && b < 0.7) rgb = mix(vec3(0.54, 0.79, 0.94), vec3(1.0, 0.91, 0.30), (b - 0.55) / 0.15);
        else if (b >= 0.7 && b < 0.83) rgb = mix(vec3(1.0, 0.91, 0.30), vec3(0.98, 0.45, 0.09), (b - 0.7) / 0.13);
        else if (b >= 0.83 && b < 0.93) rgb = mix(vec3(0.98, 0.45, 0.09), vec3(0.88, 0.11, 0.28), (b - 0.83) / 0.10);
        else if (b >= 0.93) rgb = mix(vec3(0.88, 0.11, 0.28), vec3(0.64, 0.0, 0.35), (b - 0.93) / 0.07);
        color.rgb = rgb;
      `,
    } };
  }
}
class EnhancedPolarBitmapLayer extends EnhancedBitmapLayer {
  static layerName = "EnhancedPolarWeatherBitmapLayer";
  protected _createMesh() {
    return createPolarBitmapMesh(this.props.bounds as [number, number, number, number]);
  }
}

export function createWeatherImageryLayers(frame: WeatherFrame | null, opacity: number, previousFrame: WeatherFrame | null = null, fadeReady = true, enhanced = false) {
  if (!frame) return [];
  const layers = (value: WeatherFrame, alpha: number) => [...(value.polar?.manifest.sourceId === "nasa-modis-infrared" ? value.polar.patches : []), ...value.patches].map(({ patch, image }) => {
    const polar = /^(north|south)-/.test(patch.id);
    const Layer = enhanced ? (polar ? EnhancedPolarBitmapLayer : EnhancedBitmapLayer) : (polar ? PolarBitmapLayer : BitmapLayer);
    return new Layer({
    id: `weather-${value.manifest.frameId}-${patch.id}-${enhanced ? "enhanced" : "gray"}`,
    image,
    bounds: patch.bounds,
    _imageCoordinateSystem: COORDINATE_SYSTEM.LNGLAT,
    opacity: alpha,
    transitions: { opacity: 320 },
    pickable: false,
    // Independent globe meshes have different chords between vertices.
    // Depth-testing against the basemap produces holes across the image.
    // Back-face culling clips the far hemisphere; draw this surface overlay
    // without depth comparison, before all routes, markers and borders.
    parameters: { depthCompare: "always", depthWriteEnabled: false, cullMode: "back" },
  }); });
  return [...(previousFrame ? layers(previousFrame, fadeReady ? 0 : opacity) : []),
    ...layers(frame, previousFrame && !fadeReady ? 0 : opacity)];
}
