import { useEffect, useState } from 'react';
import { Cloud, ExternalLink, Info } from 'lucide-react';
import { forecastSample, preciseTarget } from './launch-data';
import type { Launch } from './launch-data';
import { PCC } from './data';
import { distanceMeters } from './geo';
import savedForecast from './weather-snapshot.json';

type Hourly={time:number[];cloud_cover:(number|null)[]};
type Weather={campus:Hourly;pad:Hourly;checkedAt:number;saved?:boolean};
const pending=new Map<string,Promise<Weather>>();
const cache=new Map<string,Weather>();
function getWeather(launch:Launch):Promise<Weather>{
  const key=`${launch.pad.lat},${launch.pad.lng}`;
  const previous=cache.get(key);if(previous&&Date.now()-previous.checkedAt<60*60*1000)return Promise.resolve(previous);
  const inFlight=pending.get(key);if(inFlight)return inFlight;
  const request=(async()=>{
    try{
      const query=new URLSearchParams({latitude:`${PCC.lat},${launch.pad.lat}`,longitude:`${PCC.lng},${launch.pad.lng}`,hourly:'cloud_cover',forecast_days:'16',timeformat:'unixtime',timezone:'UTC'});
      const response=await fetch(`https://api.open-meteo.com/v1/forecast?${query}`,{signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error('Weather service unavailable. Check your local sky before heading out.');
      const data=await response.json();
      if(!Array.isArray(data)||!Array.isArray(data[0]?.hourly?.time)||!Array.isArray(data[1]?.hourly?.time))throw new Error('Weather forecast could not be read.');
      const result={campus:data[0].hourly,pad:data[1].hourly,checkedAt:Date.now()};cache.set(key,result);return result;
    }finally{pending.delete(key);}
  })();pending.set(key,request);return request;
}
/** Bundled Open-Meteo forecast, used where the live service can't be reached (e.g. sandboxed hosting). */
function savedWeather(launch:Launch):Weather|null{
  const [campus,pad]=savedForecast.points;
  if(distanceMeters(launch.pad,pad)>25000)return null;
  const hourly=(p:typeof campus):Hourly=>({time:p.cloud.map((_,i)=>p.start+i*3600),cloud_cover:p.cloud});
  return {campus:hourly(campus),pad:hourly(pad),checkedAt:savedForecast.checkedAt,saved:true};
}
const timeLabel=(value:number)=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(value);
export default function WeatherPanel({launch}:{launch:Launch}){
  const [weather,setWeather]=useState<Weather|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    const refresh=()=>{setLoading(true);setError(null);void getWeather(launch).then(data=>{if(active)setWeather(data);}).catch(error=>{if(!active)return;const saved=savedWeather(launch);if(saved){setWeather(saved);return;}{setWeather(null);setError(error instanceof TypeError?'The live cloud forecast can’t be reached from here. Check Open-Meteo or a weather app before heading out.':error instanceof Error?error.message:'Weather forecast unavailable.');}}).finally(()=>{if(active)setLoading(false);});};
    setWeather(null);refresh();const timer=setInterval(refresh,60*60*1000);
    return()=>{active=false;clearInterval(timer);};
  },[launch.pad.lat,launch.pad.lng]);
  const target=Date.parse(launch.net);
  const campus=weather?forecastSample(weather.campus,target):null;
  const pad=weather?forecastSample(weather.pad,target):null;
  const usable=preciseTarget(launch)&&target>Date.now();
  const campusValue=usable?campus:null,padValue=usable?pad:null;
  let verdict='Cloud forecasts are one input. Flight path, terrain, trees, and buildings still affect your view.';
  if(error)verdict=error;
  else if(!usable)verdict=target<=Date.now()?'This target time has passed. Select a later launch for a forecast.':'The launch time is provisional. A launch-hour forecast will appear when a precise target is available.';
  else if(weather&&!campus)verdict='The launch is outside the available hourly forecast window. Check back closer to liftoff.';
  else if(campus&&campus.cloud>=80)verdict='Heavy cloud cover is forecast over PCC near the target hour. An outdoor sighting may be difficult; keep the webcast handy.';
  else if(campus&&campus.cloud>=40)verdict='A partly cloudy sky is forecast over PCC. Gaps may help, but a clear sighting is uncertain.';
  else if(campus)verdict='Relatively low cloud cover is forecast over PCC. That helps, but it does not guarantee the rocket will be visible.';
  return <section className="weather-panel" id="conditions" aria-labelledby="conditions-title"><div className="panel-heading"><div><span className="eyebrow muted">BEFORE YOU HEAD OUT</span><h2 id="conditions-title"><Cloud size={20}/> How’s the sky looking?</h2></div><span className="panel-chip">PCC + LAUNCH PAD</span></div><div className="weather-metrics"><div><span>Sky over PCC</span><strong>{campusValue?`${Math.round(campusValue.cloud)}%`:'—'}<small> cloud cover</small></strong></div><div><span>Sky over the launch pad</span><strong>{padValue?`${Math.round(padValue.cloud)}%`:'—'}<small> cloud cover</small></strong></div></div><div className={`weather-verdict ${campusValue&&campusValue.cloud>=80?'cloudy':''}`} role="status"><Info size={15}/><p>{loading&&!weather?'Checking the hourly forecast…':verdict}</p></div><p className="panel-footnote">{campusValue?`Nearest forecast hour: ${timeLabel(campusValue.time)}. `:''}{weather?`${weather.saved?'Saved forecast from':'Fetched'} ${timeLabel(weather.checkedAt)}${weather.saved?' (live forecast unavailable here)':''}. `:''}Forecast for PCC, not your device location. Total cloud cover is not a visibility probability.</p><a className="panel-source" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather data: Open-Meteo <ExternalLink size={11}/></a></section>;
}
