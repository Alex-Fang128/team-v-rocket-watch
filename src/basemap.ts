import L from 'leaflet';
import campus from './campus-basemap.json';
import coast from './coast.json';

/*
 * Built-in vector basemaps, so the maps still work where external map tiles are blocked
 * (e.g. when the site is published somewhere with a strict content policy).
 * Campus data: © OpenStreetMap contributors (ODbL), extracted 2026-10-30 around PCC.
 * Coastline: Natural Earth 1:10m land via world-atlas (public domain).
 */

type CampusFeature = [kind: string, sub: string, name: string, points: number[][]];
const [LAT0, LNG0] = campus.origin as [number, number];
const toLatLng = (p: number[]): [number, number] => [LAT0 + p[0] / 1e5, LNG0 + p[1] / 1e5];

const ROAD_WEIGHT: Record<string, number> = { primary: 7, secondary: 6, tertiary: 5, residential: 3.5, unclassified: 3.5, living_street: 3 };

// Keep fallback artwork below live tiles and separate from interactive map overlays.
const FALLBACK_PANE='fallbackBasemap';
function fallbackPane(map:L.Map):HTMLElement {
  const pane=map.getPane(FALLBACK_PANE)??map.createPane(FALLBACK_PANE);
  pane.style.zIndex='150';
  pane.style.pointerEvents='none';
  return pane;
}

export function addCampusBasemap(map: L.Map): L.LayerGroup {
  fallbackPane(map);
  const renderer = L.canvas({ padding: 0.3, pane:FALLBACK_PANE });
  const base = L.layerGroup().addTo(map);
  map.attributionControl?.addAttribution('Campus map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors');
  const features = campus.features as unknown as CampusFeature[];
  const style = { renderer, interactive: false };
  const areas: Record<string, L.PolylineOptions> = {
    g: { ...style, stroke: false, fillColor: '#1d4a44', fillOpacity: 0.8 },
    l: { ...style, color: '#2b5a52', weight: 1, fillColor: '#1d4a44', fillOpacity: 0.75 },
    p: { ...style, stroke: false, fillColor: '#1c3a52', fillOpacity: 0.9 },
    b: { ...style, color: '#3b5e7a', weight: 0.8, fillColor: '#26475f', fillOpacity: 1 },
  };
  // Draw order: green space, parking, footpaths, roads, buildings.
  for (const kind of ['g', 'l', 'p']) for (const f of features) if (f[0] === kind && f[3].length > 2) L.polygon(f[3].map(toLatLng), areas[kind]).addTo(base);
  for (const f of features) if (f[0] === 'f') L.polyline(f[3].map(toLatLng), { ...style, color: '#4d7190', weight: 1.2, dashArray: '2 3' }).addTo(base);
  const roads = features.filter(f => f[0] === 'h');
  for (const casing of [true, false]) for (const f of roads) {
    const w = ROAD_WEIGHT[f[1]] ?? 2.5;
    L.polyline(f[3].map(toLatLng), { ...style, color: casing ? '#0b2133' : (w >= 5 ? '#5b7f9c' : '#3f6482'), weight: casing ? w + 2 : w, lineCap: 'round', lineJoin: 'round' }).addTo(base);
  }
  for (const f of features) if (f[0] === 'b' && f[3].length > 2) L.polygon(f[3].map(toLatLng), areas.b).addTo(base);

  // Label each main street once, at the middle of its longest drawn segment; shown when zoomed in.
  const segLength = (pts: number[][]) => pts.slice(1).reduce((sum, p, i) => sum + L.latLng(toLatLng(pts[i])).distanceTo(toLatLng(p)), 0);
  const longest = new Map<string, { pts: number[][]; len: number }>();
  for (const f of roads) {
    if (!f[2] || (ROAD_WEIGHT[f[1]] ?? 0) < 5) continue;
    const len = segLength(f[3]);
    if (len > (longest.get(f[2])?.len ?? 0)) longest.set(f[2], { pts: f[3], len });
  }
  const labels = L.layerGroup();
  for (const [name, { pts, len }] of longest) {
    if (len < 150) continue;
    const icon = L.divIcon({ className: 'road-label', html: `<span>${name.replace(/[<>&]/g, '')}</span>`, iconSize: [0, 0] });
    L.marker(toLatLng(pts[Math.floor(pts.length / 2)]), { icon, pane:FALLBACK_PANE, interactive: false, keyboard: false }).addTo(labels);
  }
  const syncLabels = () => { if (map.getZoom() >= 16) labels.addTo(map); else labels.remove(); };
  map.on('zoomend', syncLabels);
  syncLabels();
  return base;
}

export function addCoastBasemap(map: L.Map): L.LayerGroup {
  fallbackPane(map);
  const renderer = L.canvas({ padding: 0.3, pane:FALLBACK_PANE });
  const base = L.layerGroup().addTo(map);
  map.attributionControl?.addAttribution('Coastline: <a href="https://www.naturalearthdata.com/">Natural Earth</a>');
  for (const ring of coast as number[][][]) L.polygon(ring as [number, number][], { renderer, interactive: false, color: '#4a7090', weight: 1, fillColor: '#1d3b52', fillOpacity: 1 }).addTo(base);
  const cities: [string, number, number][] = [['Santa Barbara', 34.4208, -119.6982], ['Lompoc', 34.6391, -120.4579], ['Bakersfield', 35.3733, -119.0187], ['Ventura', 34.2746, -119.229]];
  for (const [name, lat, lng] of cities) {
    L.circleMarker([lat, lng], { renderer, radius: 2.5, color: '#9fb9cf', weight: 1, fillColor: '#9fb9cf', fillOpacity: 1, interactive: false }).addTo(base);
    L.marker([lat, lng], { icon: L.divIcon({ className: 'city-label', html: `<span>${name}</span>`, iconSize: [0, 0] }), pane:FALLBACK_PANE, interactive: false, keyboard: false }).addTo(base);
  }
  return base;
}

/** Swap complete basemaps; never draw fallback roads/buildings over live map tiles. */
export function addLiveTiles(map: L.Map, maxZoom: number, onFallback: () => void) {
  const pane=fallbackPane(map);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom, opacity:0, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
  let failed = false;
  tiles.on('load',()=>{if(failed)return;pane.style.display='none';tiles.setOpacity(1);});
  tiles.on('tileerror', () => { if (failed) return; failed = true; tiles.remove(); pane.style.display=''; onFallback(); });
  tiles.addTo(map);
  return tiles;
}
