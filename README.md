# team V — Rocket Launch Viewing Guide

A space-themed PCC hackathon project built with React, TypeScript, Vite, and Leaflet. No AI API, map API key, or backend database is needed.

**Live website:** https://launchpoint-pcc-2026.floralnote.chatgpt.site/

## Earth background

The dark, star-filled landing view includes a continuously rotating, textured globe and yellow markers at 27 curated major orbital launch facilities worldwide. The campus guide remains local to PCC. Select a site from the dropdown to face it; the play/pause button controls rotation. Drag or swipe horizontally and vertically to rotate the globe. Marker positions follow the same longitude/latitude view as the texture. A swipe releases into a short, exponentially damped glide, then automatic rotation resumes if Play is enabled. Grabbing again, choosing a site, resetting, or using the keyboard cancels remaining momentum. Reduced-motion preferences start the globe paused and disable the release glide. Hovering or focusing a marker suspends rotation while interacting. The globe rotates at 0.13 radians/second. Reset returns to the Americas view; focused globe controls accept arrow keys and Home. Drawing stops while the page is hidden.

The same orthographic projection positions the texture and markers. Far-side sites are hidden behind the sphere. Nearby facilities such as Kennedy / Cape Canaveral and Hainan Commercial / Wenchang can overlap at world scale; each remains available in the selector. Markers indicate site locations, not live launches or active status. This is a curated set of major orbital launch facilities, not every historical or suborbital launch site.

`src/Globe.tsx` renders directly with WebGL and includes a Canvas 2D fallback. No additional globe service, API key, or runtime dependency is needed. The Earth texture is bundled locally in `public/assets/earth-blue-marble.png`.

Earth image: NASA's Blue Marble, land/ocean/ice texture, NASA Goddard Space Flight Center; Reto Stöckli and Robert Simmon. Source: https://science.nasa.gov/earth/earth-observatory/the-blue-marble-true-color-global-imagery-at-1km-resolution/ and https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.png

Launch-site approximate coordinates: Jonathan McDowell's GCAT sites table, retrieved 2026-10-30: https://planet4589.org/space/gcat/tsv/tables/sites.tsv . Documentation: https://planet4589.org/space/gcat/web/sites/index.html . The site selection and display names are in `src/launch-sites.ts`.

## Run

With Node.js 22.12+ and npm installed:

```sh
npm install
npm run dev
```

Use the printed localhost address. `npm run build` checks TypeScript and creates `dist/`. `npm test` checks geographic calculations, launch-data validation, countdown behavior, and frame-rate-independent globe momentum. pnpm can also run the same scripts; this checkout includes its lockfile.

On this computer, dependencies are already installed. From the project folder you can restart the preview with `./start.ps1`, or `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173`.

## What works

- Interactive Leaflet / OpenStreetMap campus map, selectable pins and spot cards. A built-in campus/coastline map appears if live tiles fail; fallback artwork and live tiles are displayed separately.
- Optional live browser geolocation with a labeled pin, accuracy circle, permission-denied, timeout, and outside-campus handling. Geolocation requires localhost or HTTPS.
- PCC demo reset, straight-line distances, geometric launch-pad bearing relative to true north.
- Live Vandenberg launch targets, status, countdown, and upcoming / recent mission lists. Targets with coarse date precision do not get a fabricated countdown.
- At the scheduled target time, the countdown changes to “Target time reached.” It does not confirm liftoff or trigger an alert or immediate status refresh.
- Google Maps walking-directions links, responsive layout, and information dialog.
- Launch-hour cloud-cover forecasts over PCC and the selected pad, with freshness and uncertainty labels.
- Official webcast links plus an optional embedded YouTube player, clearly distinguishing community restreams.
- PCC-to-pad map, distance, true-north bearing, and a curvature-only altitude estimate.

## Team integration

`src/App.tsx` is the feature entry point; `MapView.tsx` contains the map. Import `leaflet/dist/leaflet.css`, `styles.css`, `dark-sky.css`, `launch-panels.css`, and `responsive.css` once, as shown in `main.tsx`. CSS is currently app-wide; scope it before embedding into an established design. Install React, React DOM, Leaflet, lucide-react, and the associated TypeScript types in the host app. The feature can run inside a client-rendered React or Next.js component (disable server rendering for the Leaflet module).

`src/feed.ts` reads Launch Library 2 v2.3.0, filtered to Vandenberg (location ID 11), and deduplicates requests across React effects. It caches successful public launch records in local storage for 10 minutes, checks on a 10-minute interval while visible, and backs off for 10 minutes on service failure. A failed request retains the cached record or the explicitly labeled saved snapshot (`src/launch-snapshot.json`). API quotas apply per service/IP; for a larger deployment, move polling into a shared server-side cache. Use the provider's development API for isolated development tests; this prototype uses the production feed for the live launch guide.

Select an upcoming mission to update the target, status, pad, forecast hour, map, and webcast. Recent launches link to their mission records. Dates are formatted in America/Los_Angeles, including PDT/PST transitions; coarse month-level targets do not show placeholder times. `src/launch-data.ts` normalizes external records and accepts HTTPS links. Only validated YouTube IDs are embedded through youtube-nocookie.com, and only after the user loads the player.

## Important data boundaries

The three campus pins and campus-area rectangle are approximate demo data, not surveyed locations or verified viewing recommendations. Confirm locations against PCC's official campus map, walk the sites, and check access and western sightlines before promoting a spot. Distances are straight-line, not walking estimates. The blue location dot is a browser report and may have limited accuracy. This prototype supports PCC spots only and explicitly identifies users outside the campus area.

The compass shows the geometric initial bearing from the selected campus spot to SLC-4E, measured clockwise from true north. It does not read device heading or model the flight path, building / terrain obstructions, atmospheric visibility, plume illumination, or probability of seeing a launch. The weather panel uses actual total-cloud-cover forecasts from Open-Meteo for the nearest hour (within 30 minutes of the target). It shows unavailable / provisional states rather than substituting another date. Cloud cover is not a visibility probability. Weather is refreshed hourly while the app is open.

The sightline map connects PCC to the pad; it is not a flight trajectory. The altitude estimate R × (sec(distance / R) − 1) uses a sea-level observer and a stationary object over the launch pad. It excludes terrain, observer elevation, refraction and rocket trajectory, and does not estimate minutes after liftoff.

Device coordinates remain in page memory. Map tiles are requested from OpenStreetMap; fonts from Google Fonts (system font fallback). Opening directions sends the selected destination and optional current coordinates to Google Maps. Public launch records are cached in local storage; device locations are not. Weather requests use the public campus/pad coordinates, never the device location. Webcast links go to the source indicated in the feed; loading the optional player contacts YouTube. No location database or analytics is included. Review OpenStreetMap's tile policy before scaling public traffic: https://operations.osmfoundation.org/policies/tiles/

## References

- Campus map: https://pasadena.edu/about/documents/PCC_map.pdf
- Confirm launch status: https://www.spacex.com/launches/
- Leaflet: https://leafletjs.com/examples/quick-start/

- Live launch service: https://ll.thespacedevs.com/docs
- Weather API: https://open-meteo.com/en/docs

## Responsive layout

The hero uses separate copy and globe columns on desktop; phones and portrait tablets stack the copy, globe, and controls so the planet cannot obscure text. Controls have larger touch targets on narrow screens. Only the globe’s circular hit area captures a drag; the surrounding space remains available for page scrolling. Both Leaflet maps refit their pins/route when resized and retain explicit minimum heights. Sticky navigation and anchor offsets are preserved.

Checked widths include 320, 390, 768, 900, 1024, 1280, 1440, and 1920 pixels, plus 844 × 390 landscape. Browser sizing checks are not a substitute for testing on a physical touch device.
