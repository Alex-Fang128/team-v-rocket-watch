/** Orthographic projection, shared by the textured sphere and the launch-site markers. */
export const GLOBE_TILT = 20 * Math.PI / 180;
export const GLOBE_RADIUS = 0.435;
export function projectSite(lat: number, lng: number, center: number, tilt = GLOBE_TILT) {
  const phi = lat * Math.PI / 180;
  const lambda = lng * Math.PI / 180 - center;
  const x = Math.cos(phi) * Math.sin(lambda);
  const y = Math.cos(tilt) * Math.sin(phi) - Math.sin(tilt) * Math.cos(phi) * Math.cos(lambda);
  const z = Math.sin(tilt) * Math.sin(phi) + Math.cos(tilt) * Math.cos(phi) * Math.cos(lambda);
  return { x:50 + x * GLOBE_RADIUS * 100, y:50 - y * GLOBE_RADIUS * 100, visible:z > 0.035, depth:z };
}
