import {useEffect,useState} from 'react';
import {ArrowUpRight,ExternalLink,Play,Radio,Rocket} from 'lucide-react';
import type {Launch} from './launch-data';
import {youtubeEmbedUrl} from './launch-data';
import {expectedCoverageTime,shouldSwitchToCurrent} from './webcast-state';

const timeLabel=(time:number)=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(time);
const pickVideo=(launch:Launch)=>launch.webcasts.find(cast=>cast.official&&youtubeEmbedUrl(cast.url))??launch.webcasts.find(cast=>youtubeEmbedUrl(cast.url));
const playerUrl=(url:string)=>youtubeEmbedUrl(url)?.replace('?autoplay=1','?autoplay=1&mute=1&rel=0')??null;

export default function WebcastPanel({launch,previous}:{launch:Launch;previous:Launch[]}){
  const [loaded,setLoaded]=useState<'current'|'replay'|null>(null);
  const [following,setFollowing]=useState(false);
  const [switched,setSwitched]=useState(false);
  const [blocked,setBlocked]=useState(false);
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{setLoaded(null);setFollowing(false);setSwitched(false);},[launch.id]);
  useEffect(()=>{
    const tick=()=>setNow(Date.now());
    const timer=setInterval(tick,1000);
    document.addEventListener('visibilitychange',tick);
    const onPolicy=(event:SecurityPolicyViolationEvent)=>{if(/youtube/.test(event.blockedURI)&&/frame-src|child-src|default-src/.test(event.violatedDirective))setBlocked(true);};
    document.addEventListener('securitypolicyviolation',onPolicy);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);document.removeEventListener('securitypolicyviolation',onPolicy);};
  },[]);
  const official=launch.webcasts.find(cast=>cast.official);
  const current=pickVideo(launch);
  const currentEmbed=current?playerUrl(current.url):null;
  const expected=expectedCoverageTime(launch,current);
  const waiting=expected!==null&&now<expected;
  const replayLaunch=previous.find(item=>pickVideo(item));
  const replay=replayLaunch?pickVideo(replayLaunch):undefined;
  const replayEmbed=replay?playerUrl(replay.url):null;
  useEffect(()=>{
    if(following&&(!currentEmbed||blocked)){setFollowing(false);return;}
    if(shouldSwitchToCurrent(following,loaded==='replay',now,expected,!!currentEmbed,blocked)){
      setLoaded('current');setFollowing(false);setSwitched(true);
    }
  },[following,loaded,now,expected,currentEmbed,blocked]);
  const playing=blocked?null:loaded==='current'?currentEmbed:loaded==='replay'?replayEmbed:null;
  const shown=loaded==='replay'?replay:current;
  const streamLink=current?.url??official?.url??launch.sourceUrl;
  const showCurrent=()=>{setLoaded('current');setFollowing(false);setSwitched(false);};
  return <section className="webcast-panel">
    <div className="panel-heading"><div><span className="eyebrow muted">THE NEXT BEST SEAT</span><h2><Radio size={20}/> Watch the launch</h2></div><span className="panel-chip">{loaded==='replay'&&!blocked?'PREVIOUS LAUNCH REPLAY':current?.official?'OFFICIAL VIDEO':current?'COMMUNITY COVERAGE':'WEBCAST'}</span></div>
    <div className="webcast-screen">{playing?<iframe key={`${launch.id}-${loaded}-${playing}`} src={playing} title={loaded==='replay'?`${replayLaunch!.mission} — previous launch replay`:`${launch.mission} — current launch coverage`} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/>:<div className="webcast-placeholder"><Rocket size={43}/><span>{launch.mission}</span><p>{blocked?'The embedded player is blocked here. Open the broadcast directly below.':waiting?`Coverage is expected around ${timeLabel(expected!)}. You can open this launch’s stream now.`:current?'Open this launch’s stream. The provider may still show a waiting screen.':'No embeddable stream is listed. Use the official webcast or mission page below.'}</p></div>}</div>
    <div className="webcast-actions webcast-current-actions">
      {currentEmbed&&!blocked?<button onClick={showCurrent}><Play size={15} fill="currentColor"/> {loaded==='current'?'Reload this launch’s player':'Watch this launch'}</button>:<a className="webcast-out" href={streamLink} target="_blank" rel="noreferrer"><Play size={15} fill="currentColor"/> {current||official?'Open this launch’s broadcast':'Open mission page for coverage'} <ArrowUpRight size={13}/></a>}
      {replayEmbed&&!blocked&&loaded!=='replay'&&<button onClick={()=>{setLoaded('replay');setFollowing(waiting&&!!currentEmbed);setSwitched(false);}}>Watch previous launch replay</button>}
    </div>
    <p className="webcast-transition" role="status">{loaded==='replay'?`Replay: ${replayLaunch!.mission}. ${following?`The player will switch to ${launch.mission} around ${timeLabel(expected!)}.`:'This is a previous launch, not the current broadcast.'}`:switched?`Switched to ${launch.mission} coverage. If the player is waiting, the broadcaster has not started yet.`:loaded==='current'?`Showing ${launch.mission} coverage. Playback starts muted; use the player controls to play or unmute.`:waiting?`Expected coverage window: ${timeLabel(expected!)}. Launch countdown zero is not confirmation of a live broadcast.`:'The current launch’s broadcast is available to open above.'}</p>
    {following&&<button className="link-button" onClick={()=>setFollowing(false)}>Keep watching this replay</button>}
    <div className="webcast-links"><a href={official?.url??launch.sourceUrl} target="_blank" rel="noreferrer">{official?'Official webcast':'Official mission page'} <ArrowUpRight size={13}/></a><a href={streamLink} target="_blank" rel="noreferrer">{current?'Open this launch on YouTube':'Open current launch coverage'} <ExternalLink size={11}/></a></div>
    <p className="panel-footnote">{shown&&!shown.official?'Embedded coverage is a third-party stream, not the launch provider’s official feed. ':''}The broadcaster controls when video begins. Browsers may require pressing Play. Loading a player connects to YouTube; the direct broadcast link remains available.</p>
  </section>;
}
