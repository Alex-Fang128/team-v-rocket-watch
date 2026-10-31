import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { LocateFixed } from 'lucide-react';
import { PCC, SPOTS } from './data';
import { addCampusBasemap, addLiveTiles } from './basemap';
import type { Point } from './geo';
export type ReportedLocation = Point & { accuracy: number };

function fitView(instance:L.Map, element:HTMLDivElement|null, location:ReportedLocation|null) {
  const bounds=L.latLngBounds(SPOTS.map(spot=>[spot.lat,spot.lng] as [number,number]));
  if(location)bounds.extend([location.lat,location.lng]);
  const side=Math.min(65,(element?.clientWidth??320)*.16);
  instance.fitBounds(bounds,{paddingTopLeft:[side,95],paddingBottomRight:[side,75],maxZoom:17,animate:false});
}

export default function MapView({ selected, location, locating, picking = false, onSelect, onLocate, onPick }: { selected: string; location: ReportedLocation | null; locating: boolean; picking?: boolean; onSelect: (id: string) => void; onLocate: () => void; onPick?: (lat: number, lng: number) => void }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.Marker[]>([]);
  const currentLocation = useRef(location);
  currentLocation.current = location;
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!element.current) return;
    const instance = L.map(element.current, { zoomControl: false, scrollWheelZoom: false });
    fitView(instance,element.current,currentLocation.current);
    map.current = instance;
    addCampusBasemap(instance);
    addLiveTiles(instance, 19, () => setTileError(true));
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    L.polygon([[34.1413,-118.121],[34.1455,-118.121],[34.1455,-118.1164],[34.1413,-118.1164]], { color:'#398575', weight:1, dashArray:'5 7', fillColor:'#8dd6b5', fillOpacity:0.06, interactive:false }).addTo(instance);
    const resize = new ResizeObserver(() => {
      instance.invalidateSize();
      fitView(instance,element.current,currentLocation.current);
    });
    resize.observe(element.current);
    return () => { resize.disconnect(); instance.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    markers.current.forEach(marker => marker.remove());
    markers.current = SPOTS.map((spot, i) => {
      const marker = L.marker([spot.lat, spot.lng], { icon: L.divIcon({ className:'spot-pin', html:`<span class="${spot.id === selected ? 'active' : ''}">${i + 1}</span>`, iconSize:[36,36], iconAnchor:[18,18] }), title: spot.name, alt: `Select ${spot.name}`, keyboard:true }).addTo(instance);
      const element = marker.getElement();
      element?.setAttribute('aria-label', `Select ${spot.name}`);
      element?.addEventListener('click', () => onSelect(spot.id));
      element?.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(spot.id);
        }
      });
      return marker;
    });
  }, [selected, onSelect]);
  const user = useRef<{ group:L.LayerGroup; pin:L.Marker; circle:L.Circle } | null>(null);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (!location) {
      // Location turned off: remove the pin and return to the campus view.
      if (user.current) { user.current.group.remove(); user.current = null; fitView(instance,element.current,null); }
      return;
    }
    const hasAccuracy=Number.isFinite(location.accuracy)&&location.accuracy>0;
    const popup=hasAccuracy?`Your GPS location<br>Accuracy: about ${Math.round(location.accuracy)} m`:'Your spot, set on the map';
    if (user.current) {
      // Live updates move the existing pin without re-fitting, so panning/zooming isn't interrupted.
      user.current.pin.setLatLng([location.lat,location.lng]).setPopupContent(popup);
      user.current.circle.setLatLng([location.lat,location.lng]).setRadius(hasAccuracy?location.accuracy:0);
      return;
    }
    const group=L.layerGroup().addTo(instance);
    const circle=L.circle([location.lat,location.lng],{radius:hasAccuracy?location.accuracy:0,color:'#5aabff',weight:1,fillColor:'#4a9fff',fillOpacity:.14,interactive:false}).addTo(group);
    const pin=L.marker([location.lat,location.lng],{
      icon:L.divIcon({className:'user-location-pin',html:'<span></span>',iconSize:[28,28],iconAnchor:[14,14]}),
      title:'Your current location',alt:'Your current location',keyboard:true,zIndexOffset:1000
    }).addTo(group);
    pin.bindTooltip('You are here',{permanent:true,direction:'top',offset:[0,-19],className:'user-location-label'});
    pin.bindPopup(popup);
    pin.getElement()?.setAttribute('aria-label','Your current location');
    user.current={group,pin,circle};
    fitView(instance,element.current,location);
  }, [location]);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    // While picking, a tap on the map places "You are here"; otherwise taps do nothing special.
    const container = instance.getContainer();
    // A spot set by tapping stays movable by tapping again; GPS locations are not.
    const placeable = !!onPick && (picking || (!!location && !Number.isFinite(location.accuracy)));
    container.classList.toggle('picking', placeable);
    if (!placeable) return;
    const handler = (event: L.LeafletMouseEvent) => pickRef.current?.(event.latlng.lat, event.latlng.lng);
    instance.on('click', handler);
    return () => { instance.off('click', handler); container.classList.remove('picking'); };
  }, [picking, location, onPick]);
  function locate() {
    const instance = map.current;
    if (location && instance) instance.setView([location.lat,location.lng],Math.max(instance.getZoom(),17));
    else onLocate();
  }
  return <><div className="leaflet-map" ref={element} aria-label="Interactive PCC map with three approximate candidate viewing spots" />{tileError && <div className="map-offline" role="status">Built-in campus map</div>}{picking && <div className="map-pick-hint" role="status">Tap where you are</div>}<button type="button" className={`map-locate ${location?'on':''}`} onClick={locate} disabled={locating} aria-label={location?'Center map on your location':'Show my location on the map'} title={location?'Center on me':'Show my location'}><LocateFixed size={17}/></button></>;
}
