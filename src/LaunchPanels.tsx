import WebcastPanel from './WebcastPanel';
import { useState } from 'react';
import { ArrowUpRight, CalendarDays, CheckCircle2, ExternalLink, MapPin, Play, Rocket } from 'lucide-react';
import type { FeedPart } from './feed';
import type { Launch } from './launch-data';
import { curvatureHeightKm, launchDateLabel, youtubeEmbedUrl } from './launch-data';
import { PCC } from './data';
import { bearingDegrees, directionName, distanceMeters } from './geo';
import SightlineMap from './SightlineMap';
import WeatherPanel from './WeatherPanel';

export function LaunchFacts({launch}:{launch:Launch}){
  const bearing=bearingDegrees(PCC,launch.pad),distance=distanceMeters(PCC,launch.pad)/1000;
  return <div className="launch-facts"><div><span>Look from PCC toward the pad</span><strong>{directionName(bearing)} <small>↖</small></strong></div><div><span>True-north bearing</span><strong>{Math.round(bearing)}°</strong></div><div><span>Distance from campus</span><strong>{Math.round(distance)} <small>km</small></strong></div><div><span>Launch status</span><strong className="status-fact">{launch.status}</strong></div></div>;
}
const hostLabel=(url:string)=>{try{const host=new URL(url).hostname.replace(/^www\./,'');return host==='spacelaunchnow.app'?'Space Launch Now':host==='spacex.com'?'SpaceX':host;}catch{return 'Mission page';}};
const slug=(text:string)=>text.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
/** External pages for one launch: the provider's mission page, a webcast or replay, and an independent tracker. */
function LaunchLinks({launch,replay}:{launch:Launch;replay:boolean}){
  const cast=launch.webcasts.find(c=>c.official&&youtubeEmbedUrl(c.url))??launch.webcasts.find(c=>youtubeEmbedUrl(c.url))??launch.webcasts[0];
  const tracker=launch.sourceUrl.includes('spacelaunchnow.app')?null:`https://spacelaunchnow.app/launch/${launch.slug??slug(launch.name)}/`;
  const label=`${launch.mission}:`;
  return <div className="schedule-links">
    <a href={launch.sourceUrl} target="_blank" rel="noreferrer" aria-label={`${label} mission page on ${hostLabel(launch.sourceUrl)}`}>{hostLabel(launch.sourceUrl)} <ArrowUpRight size={11}/></a>
    {cast&&<a href={cast.url} target="_blank" rel="noreferrer" aria-label={`${label} ${replay?'replay':'webcast'} from ${cast.publisher}`}><Play size={10} fill="currentColor"/> {replay?'Replay':'Webcast'}</a>}
    {tracker&&<a href={tracker} target="_blank" rel="noreferrer" aria-label={`${label} details on Space Launch Now`}>Space Launch Now <ExternalLink size={10}/></a>}
  </div>;
}
function Schedule({feed,selected,onSelect}:{feed:{upcoming:FeedPart;previous:FeedPart;loading:boolean};selected:string;onSelect:(id:string)=>void}){
  const [tab,setTab]=useState<'upcoming'|'previous'>('upcoming');
  const part=feed[tab];
  return <section className="schedule-panel"><div className="panel-heading"><div><span className="eyebrow muted">FROM THE WEST COAST</span><h2><CalendarDays size={20}/> On the launchpad</h2></div></div><div className="schedule-tabs" role="group" aria-label="Launch schedule view"><button aria-pressed={tab==='upcoming'} onClick={()=>setTab('upcoming')}>Upcoming <span>{feed.upcoming.items.length}</span></button><button aria-pressed={tab==='previous'} onClick={()=>setTab('previous')}>Recent <span>{feed.previous.items.length}</span></button></div><div className="schedule-list">{part.items.length===0?<p className="schedule-empty">No launches returned by the service.</p>:part.items.map(item=>{
  const chosen=tab==='upcoming'&&selected===item.id;
  const body=<><span className="schedule-mark">{tab==='previous'&&item.statusId===3?<CheckCircle2 size={16}/>:<Rocket size={15}/>}</span><span className="schedule-details"><strong>{item.mission}</strong><small>{launchDateLabel(item)}</small><span>{tab==='upcoming'?`${item.vehicle} · ${item.padName}`:item.status}</span></span></>;
  return <div className={`schedule-item ${chosen?'chosen':''}`} key={item.id}>
    {tab==='upcoming'?<button className="schedule-select" onClick={()=>onSelect(item.id)} aria-pressed={chosen} aria-label={`Show ${item.mission} in the guide`}>{body}<ArrowUpRight size={15}/></button>:<div className="schedule-select">{body}</div>}
    <LaunchLinks launch={item} replay={tab==='previous'}/>
  </div>;
})}</div><p className="panel-footnote" role="status">{part.error??(feed.loading?'Checking the launch service…':part.source==='snapshot'?'Saved snapshot; waiting for a successful live check.':'Schedule checked against the launch service. Auto-checks every 10 minutes while visible.')}</p><p className="panel-footnote">{part.source==='snapshot'?'Snapshot saved':'Last successful check'}: {new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(part.checkedAt)}.</p><a className="panel-source" href="https://thespacedevs.com/llapi" target="_blank" rel="noreferrer">Launch data: The Space Devs / Launch Library 2 <ExternalLink size={10}/></a></section>;
}
export default function LaunchPanels({launch,feed,onSelect}:{launch:Launch;feed:{upcoming:FeedPart;previous:FeedPart;loading:boolean};onSelect:(id:string)=>void}){
  const distance=distanceMeters(PCC,launch.pad)/1000;
  const height=curvatureHeightKm(distance);
  return <div className="launch-panels"><div className="launch-panel-row"><WeatherPanel launch={launch}/><WebcastPanel key={launch.id} launch={launch} previous={feed.previous.items}/></div><div className="launch-panel-row"><section className="sightline-panel"><div className="panel-heading"><div><span className="eyebrow muted">THE BIGGER PICTURE</span><h2><MapPin size={20}/> From campus to the coast</h2></div></div><SightlineMap pad={launch.pad} padName={launch.padName}/><div className="sightline-stats"><div><span>Across the map</span><strong>{Math.round(distance)} km</strong></div><div><span>Curvature-only height</span><strong>≈ {height.toFixed(1)} km</strong></div></div><p className="panel-footnote">The line connects PCC to the launch pad; it is not the rocket’s flight path. Height estimates a stationary object above the pad clearing a sea-level horizon, ignoring observer elevation, terrain and refraction. It does not predict when you’ll see the rocket.</p></section><Schedule feed={feed} selected={launch.id} onSelect={onSelect}/></div></div>;
}
