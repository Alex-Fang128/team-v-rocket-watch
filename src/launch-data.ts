import type { Point } from './geo';

export type Webcast = { url:string; title:string; publisher:string; official:boolean; startTime?:string };
export type Launch = {
  id:string; name:string; mission:string; vehicle:string; net:string; precision:string;
  status:string; statusId:number; padName:string; pad:Point; sourceUrl:string;
  windowStart:string|null; windowEnd:string|null; updated:string|null; webcasts:Webcast[]; slug?:string;
};
export function safeWebUrl(value:unknown):string|null {
  if(typeof value!=='string')return null;
  try{const url=new URL(value);return url.protocol==='https:'?url.href:null;}catch{return null;}
}
const record=(value:unknown):Record<string,any>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,any>:{};
const text=(value:unknown,fallback:string)=>typeof value==='string'&&value.trim()?value.trim():fallback;
const timestamp=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value));
export function isLaunchRecord(value:unknown):value is Launch {
  const item=record(value),pad=record(item.pad);
  return ['id','name','mission','vehicle','precision','status','padName'].every(key=>typeof item[key]==='string'&&item[key].trim().length>0)
    &&timestamp(item.net)&&Number.isFinite(item.statusId)&&typeof pad.lat==='number'&&typeof pad.lng==='number'&&Number.isFinite(pad.lat)&&Number.isFinite(pad.lng)&&Math.abs(pad.lat)<=90&&Math.abs(pad.lng)<=180
    &&safeWebUrl(item.sourceUrl)!==null&&['windowStart','windowEnd','updated'].every(key=>item[key]===null||timestamp(item[key]))
    &&Array.isArray(item.webcasts)&&item.webcasts.every((value:unknown)=>{const cast=record(value);return safeWebUrl(cast.url)!==null&&typeof cast.title==='string'&&typeof cast.publisher==='string'&&typeof cast.official==='boolean';});
}
export function normalizeLaunch(value:unknown):Launch|null {
  if(!value||typeof value!=='object')return null;
  const raw=value as Record<string,any>;
  const lat=Number(raw.pad?.latitude),lng=Number(raw.pad?.longitude);
  if(!text(raw.id,'')||!text(raw.name,'')||!timestamp(raw.net)||raw.pad?.latitude==null||raw.pad?.longitude==null||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
  if(raw.pad?.location?.id!==11)return null;
  const officialPage=(Array.isArray(raw.info_urls)?raw.info_urls:[]).map(record).find((link:any)=>link.type?.name==='Official Page'&&safeWebUrl(link.url));
  const casts=(Array.isArray(raw.vid_urls)?raw.vid_urls:[]).map(record).flatMap((cast:any)=>{
    const url=safeWebUrl(cast.url); if(!url)return [];
    return [{url,title:String(cast.title??'Mission webcast'),publisher:String(cast.publisher??cast.source??'Webcast provider'),official:cast.type?.id===1,...(timestamp(cast.start_time)?{startTime:cast.start_time}:{})}];
  });
  return {id:raw.id,name:raw.name,mission:text(raw.mission?.name,text(raw.name.split('|').slice(1).join('|'),raw.name)),vehicle:text(raw.rocket?.configuration?.full_name,raw.name.split('|')[0].trim()),net:raw.net,precision:text(raw.net_precision?.abbrev,'TBD'),status:text(raw.status?.name,'Status unavailable'),statusId:Number.isFinite(Number(raw.status?.id))?Number(raw.status.id):0,padName:text(raw.pad?.name,'Vandenberg launch pad'),pad:{lat,lng},sourceUrl:safeWebUrl(officialPage?.url)??`https://spacelaunchnow.app/launch/${encodeURIComponent(raw.slug??raw.id)}/`,windowStart:timestamp(raw.window_start)?raw.window_start:null,windowEnd:timestamp(raw.window_end)?raw.window_end:null,updated:timestamp(raw.last_updated)?raw.last_updated:null,webcasts:casts,...(typeof raw.slug==='string'&&/^[a-z0-9-]+$/.test(raw.slug)?{slug:raw.slug}:{})};
}
export function youtubeEmbedUrl(value:string):string|null {
  try{
    const url=new URL(value);
    if(url.protocol!=='https:')return null;
    let id:string|null=null;
    if(url.hostname==='youtu.be')id=url.pathname.slice(1);
    else if(['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname))id=url.pathname==='/watch'?url.searchParams.get('v'):/^\/(?:live|embed)\/([^/]+)/.exec(url.pathname)?.[1]??null;
    return id&&/^[A-Za-z0-9_-]{11}$/.test(id)?`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`:null;
  }catch{return null;}
}
export const preciseTarget=(launch:Launch)=>['SEC','MIN'].includes(launch.precision);
export function launchDateLabel(launch:Launch):string {
  const date=new Date(launch.net);
  // Coarse dates are calendar placeholders, not instants to shift into Pacific time.
  const precision=launch.precision.toUpperCase();
  if(['M','MTH','MONTH'].includes(precision))return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',year:'numeric'}).format(date)+' · provisional';
  if(['Y','YEAR'].includes(precision))return `${date.getUTCFullYear()} · provisional`;
  if(precision==='Q')return `Q${Math.floor(date.getUTCMonth()/3)+1} ${date.getUTCFullYear()} · provisional`;
  if(['D','DAY','W','WEEK'].includes(precision))return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(date)+' · provisional';
  const options:Intl.DateTimeFormatOptions={timeZone:'America/Los_Angeles',month:'short',day:'numeric'};
  if(['SEC','MIN','H','HOUR'].includes(precision))Object.assign(options,{hour:'numeric',minute:'2-digit',timeZoneName:'short'});
  return new Intl.DateTimeFormat('en-US',options).format(date)+(!preciseTarget(launch)?' · provisional':'');
}
export function forecastSample(hourly:{time:number[];cloud_cover:(number|null)[]}|undefined,target:number):{cloud:number;time:number}|null {
  if(!hourly||!Number.isFinite(target)||!Array.isArray(hourly.time)||!Array.isArray(hourly.cloud_cover))return null;
  let best=-1,delta=Infinity;
  hourly.time.forEach((time,index)=>{const d=Math.abs(time*1000-target);if(d<delta){delta=d;best=index;}});
  const cloud=hourly.cloud_cover[best];
  return best>=0&&delta<=30*60*1000&&typeof cloud==='number'&&Number.isFinite(cloud)&&cloud>=0&&cloud<=100?{cloud,time:hourly.time[best]*1000}:null;
}
/** Sea-level stationary target estimate. No terrain, refraction, observer elevation, or rocket trajectory. */
export function curvatureHeightKm(distanceKm:number):number {
  const radius=6371;
  return distanceKm>=0&&distanceKm<Math.PI*radius/2?radius*(1/Math.cos(distanceKm/radius)-1):NaN;
}
