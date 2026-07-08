import 'leaflet';

declare module 'leaflet' {
  function heatLayer(
    latlngs: [number, number, number][],
    options?: {
      radius?: number;
      blur?: number;
      minOpacity?: number;
      maxZoom?: number;
      gradient?: Record<number, string>;
    }
  ): Layer;
}
