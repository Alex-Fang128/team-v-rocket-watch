import { useEffect, useState } from 'react';
import snapshot from './launch-snapshot.json';
import { isLaunchRecord, normalizeLaunch } from './launch-data';
import type { Launch } from './launch-data';

const TTL=10*60*1000;
export type FeedPart={items:Launch[];checkedAt:number;source:'feed'|'snapshot';error:string|null};
type Kind='upcoming'|'previous';
const inFlight=new Map<string,Promise<FeedPart>>();
const memory=new Map<string,FeedPart>();
const retryAt=new Map<string,number>();
function initial(kind:Kind):FeedPart {
  const fallback={items:snapshot[kind] as Launch[],checkedAt:snapshot.checkedAt,source:'snapshot' as const,error:null};
  try{const saved=JSON.parse(localStorage.getItem(`launchpoint-v1-${kind}`)??'null');if(saved&&Array.isArray(saved.items)&&saved.items.every(isLaunchRecord)&&Number.isFinite(saved.checkedAt)&&saved.checkedAt<=Date.now()+60000)return {...saved,source:'feed',error:null};}catch{}
  return fallback;
}
async function load(kind:Kind):Promise<FeedPart> {
  const cached=memory.get(kind)??initial(kind);
  if(Date.now()<(retryAt.get(kind)??0))return cached;
  if(cached.source==='feed'&&Date.now()-cached.checkedAt<TTL)return cached;
  const pending=inFlight.get(kind);if(pending)return pending;
  const work=(async()=>{
    try{
      const query=new URLSearchParams({limit:'5',mode:'detailed',location__ids:'11',ordering:kind==='previous'?'-net':'net'});
      const response=await fetch(`https://ll.thespacedevs.com/2.3.0/launches/${kind}/?${query}`,{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error(response.status===429?'Launch service rate limit reached. Saved data is shown.':`Launch service unavailable (${response.status}). Saved data is shown.`);
      const raw=await response.json();
      if(!Array.isArray(raw.results))throw new Error('Launch service returned an unexpected response. Saved data is shown.');
      const items=raw.results.map(normalizeLaunch).filter((item:Launch|null):item is Launch=>item!==null);
      if(raw.results.length>0&&items.length===0)throw new Error('Launch data could not be read. Saved data is shown.');
      const result:FeedPart={items,checkedAt:Date.now(),source:'feed',error:null};
      memory.set(kind,result);
      try{localStorage.setItem(`launchpoint-v1-${kind}`,JSON.stringify(result));}catch{}
      return result;
    }catch(error){
      const failed={...cached,error:error instanceof TypeError?'Live launch data can’t be reached from here, so the saved schedule is shown. Confirm times on the mission pages.':error instanceof Error?error.message:'Launch service unavailable. Saved data is shown.'};
      memory.set(kind,failed);retryAt.set(kind,Date.now()+TTL);return failed;
    }
    finally{inFlight.delete(kind);}
  })();
  inFlight.set(kind,work);return work;
}
export function useLaunchFeed(){
  const [upcoming,setUpcoming]=useState(()=>initial('upcoming'));
  const [previous,setPrevious]=useState(()=>initial('previous'));
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    const refresh=async()=>{
      if(document.hidden)return;
      setLoading(true);
      const result=await Promise.allSettled([load('upcoming'),load('previous')]);
      if(!active)return;
      if(result[0].status==='fulfilled')setUpcoming(result[0].value);
      if(result[1].status==='fulfilled')setPrevious(result[1].value);
      setLoading(false);
    };
    void refresh();const timer=setInterval(refresh,TTL);
    document.addEventListener('visibilitychange',refresh);
    return()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  return {upcoming,previous,loading};
}
