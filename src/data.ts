import type { Point } from './geo';
export const PCC: Point = { lat: 34.1442, lng: -118.1187 };
export type Spot = Point & { id: string; name: string; subtitle: string; note: string; tags: string[] };
// Approximate demo pins, not surveyed viewpoints. Verify coordinates, access, and sightlines before using as recommendations.
export const SPOTS: Spot[] = [
  { id: 'quad', name: 'The Quad', subtitle: 'Central campus · outdoor space', lat: 34.14505, lng: -118.11815, note: 'Start in the open area and check the western sky. Nearby buildings and trees may obstruct the view.', tags: ['Central location', 'Check sightlines'] },
  { id: 'stadium', name: 'Robinson Stadium area', subtitle: 'South campus · outdoor space', lat: 34.1426, lng: -118.1183, note: 'A candidate area to scout for open sky. Stadium access and event restrictions have not been checked.', tags: ['Check access', 'Check sightlines'] },
  { id: 'colorado', name: 'Colorado Boulevard frontage', subtitle: 'North campus · pedestrian area', lat: 34.14585, lng: -118.1192, note: 'Scout from the campus-side pedestrian area. Trees, street lighting, and buildings may limit visibility.', tags: ['Campus edge', 'Check sightlines'] },
];
