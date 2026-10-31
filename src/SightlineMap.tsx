import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { PCC } from './data';
import { addCoastBasemap, addLiveTiles } from './basemap';
import type { Point } from './geo';
export default function SightlineMap({pad,padName}:{pad:Point;padName:string}){
  const ref=useRef<HTMLDivElement>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    if(!ref.current)return;
    const map=L.map(ref.current,{zoomControl:false,scrollWheelZoom:false}).fitBounds([[PCC.lat,PCC.lng],[pad.lat,pad.lng]],{padding:[45,50]});
    addCoastBasemap(map);
    addLiveTiles(map,18,()=>setFailed(true));
    L.control.zoom({position:'bottomright'}).addTo(map);
    L.polyline([[PCC.lat,PCC.lng],[pad.lat,pad.lng]],{color:'#f0d77c',weight:3,dashArray:'7 7',interactive:false}).addTo(map);
    L.circleMarker([PCC.lat,PCC.lng],{radius:6,color:'#e3f2ff',weight:2,fillColor:'#83c6ff',fillOpacity:1}).addTo(map).bindTooltip('PCC · observer',{permanent:true,direction:'bottom'});
    const label=document.createElement('span');label.textContent=padName;
    L.circleMarker([pad.lat,pad.lng],{radius:6,color:'#fff0ad',weight:2,fillColor:'#f2d267',fillOpacity:1}).addTo(map).bindTooltip(label,{permanent:true,direction:'top'});
    const observer=new ResizeObserver(()=>{map.invalidateSize();const width=ref.current?.clientWidth??320;map.fitBounds([[PCC.lat,PCC.lng],[pad.lat,pad.lng]],{paddingTopLeft:[Math.min(100,width*.3),55],paddingBottomRight:[Math.min(80,width*.25),55],animate:false});});observer.observe(ref.current);
    return()=>{observer.disconnect();map.remove();};
  },[pad.lat,pad.lng,padName]);
  return <div className="sightline-shell"><div className="sightline-map" ref={ref} aria-label={`Map connecting Pasadena City College and ${padName}. This is a direction line, not a rocket trajectory.`}/>{failed&&<span className="map-offline" role="status">Built-in coastline map</span>}</div>;
}
