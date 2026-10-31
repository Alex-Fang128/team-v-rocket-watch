import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Compass, Crosshair, ExternalLink, Footprints, Info, Layers, LocateFixed, MapPin, Navigation, Rocket, Telescope } from 'lucide-react';
import MapView from './MapView';
import type { ReportedLocation } from './MapView';
import Globe from './Globe';
import { PCC, SPOTS } from './data';
import { useLaunchFeed } from './feed';
import { launchDateLabel, preciseTarget } from './launch-data';
import type { Launch } from './launch-data';
import launchSnapshot from './launch-snapshot.json';
import LaunchPanels, { LaunchFacts } from './LaunchPanels';
import { bearingDegrees, countdown, directionName, distanceMeters } from './geo';

export default function App() {
  const [selected, setSelected] = useState('quad');
  const [location, setLocation] = useState<ReportedLocation | null>(null);
  const [demo, setDemo] = useState(true);
  const [status, setStatus] = useState('PCC demo location · live location is off');
  const [locating, setLocating] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [showInfo, setShowInfo] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>('mission');
  const [selectedMission,setSelectedMission] = useState<string|null>(null);
  const feed=useLaunchFeed();
  const launch=feed.upcoming.items.find(item=>item.id===selectedMission)??feed.upcoming.items[0]??launchSnapshot.upcoming[0] as Launch;
  const feedCurrent=feed.upcoming.items.length>0&&feed.upcoming.source==='feed'&&!feed.upcoming.error&&now-feed.upcoming.checkedAt<10*60*1000;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const navTarget = useRef<{ id: string; until: number } | null>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    let frame = 0;
    const updateSection = () => {
      frame = 0;
      // While a nav click is smooth-scrolling, keep the clicked tab highlighted instead of flickering through sections.
      const target = navTarget.current;
      if (target && performance.now() < target.until) { setActiveSection(target.id); return; }
      navTarget.current = null;
      const header = document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 87;
      // A section counts as current once it reaches the upper third of the visible area, not the very top edge.
      const line = header + (window.innerHeight - header) * 0.33;
      let active = 'mission';
      for (const id of ['mission', 'viewing', 'conditions']) {
        if ((document.getElementById(id)?.getBoundingClientRect().top ?? Infinity) <= line) active = id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) active = 'conditions';
      setActiveSection(active);
    };
    const scheduleUpdate = () => { if (!frame) frame = requestAnimationFrame(updateSection); };
    const endNavScroll = () => { navTarget.current = null; scheduleUpdate(); };
    updateSection();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('scrollend', endNavScroll);
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('hashchange', scheduleUpdate);
    const stopNavLock = () => { navTarget.current = null; };
    window.addEventListener('wheel', stopNavLock, { passive: true });
    window.addEventListener('touchstart', stopNavLock, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('scrollend', endNavScroll);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('hashchange', scheduleUpdate);
      window.removeEventListener('wheel', stopNavLock);
      window.removeEventListener('touchstart', stopNavLock);
    };
  }, []);
  const activeTab = showInfo ? 'info' : activeSection;
  useLayoutEffect(() => {
    // One sliding bar under the active tab, measured from the tab itself.
    const measure = () => {
      const nav = navRef.current, tab = nav?.querySelector<HTMLElement>(`[data-tab="${activeTab}"]`);
      if (!nav || !tab || tab.offsetWidth === 0) { setIndicator(null); return; }
      setIndicator({ left: tab.offsetLeft, width: tab.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeTab]);
  useEffect(() => {
    // Deep links like /#conditions: the browser tries to scroll before React renders the section,
    // so scroll once the page has rendered, and again after fonts/images settle the layout.
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    let cancelled = false;
    const stop = () => { cancelled = true; };
    const jump = () => { if (!cancelled) document.getElementById(id)?.scrollIntoView({ behavior: 'auto', block: 'start' }); };
    const userEvents = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;
    userEvents.forEach(type => window.addEventListener(type, stop, { passive: true, once: true }));
    const frame = requestAnimationFrame(() => requestAnimationFrame(jump));
    document.fonts?.ready.then(jump);
    if (document.readyState !== 'complete') window.addEventListener('load', jump, { once: true });
    const late = setTimeout(jump, 900);
    return () => {
      stop();
      cancelAnimationFrame(frame);
      clearTimeout(late);
      window.removeEventListener('load', jump);
      userEvents.forEach(type => window.removeEventListener(type, stop));
    };
  }, []);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!showInfo || !dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, [showInfo]);
  const onSelect = useCallback((id: string) => setSelected(id), []);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const spot = SPOTS.find(item => item.id === selected)!;
  const observer = location ?? PCC;
  const bearing = bearingDegrees(spot, launch.pad);
  const clock = preciseTarget(launch)?countdown(Date.parse(launch.net), now):null;
  const onCampus = demo || (!!location && distanceMeters(location, PCC) < 1200);
  const watchId = useRef<number | null>(null);
  const stopWatching = useCallback(() => {
    if (watchId.current !== null) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
  }, []);
  const startLocation = useCallback(() => {
    if (!navigator.geolocation) { setStatus('Location is unavailable in this browser. PCC demo remains available.'); return; }
    if (watchId.current !== null) return;
    let hasFix = false;
    setLocating(true);
    setStatus('Waiting for your browser’s location permission…');
    // watchPosition keeps the "You are here" pin moving as you walk around campus.
    watchId.current = navigator.geolocation.watchPosition(position => {
      const here = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy };
      hasFix = true;
      setLocation(here); setDemo(false); setLocating(false);
      setStatus(`Live location on · accuracy about ${Math.round(here.accuracy)} m. ${distanceMeters(here, PCC) >= 1200 ? 'You appear to be outside PCC; these are campus demo spots.' : 'Campus pins are still approximate.'}`);
    }, error => {
      if (hasFix && error.code !== 1) return; // keep the last good fix through brief GPS dropouts
      stopWatching(); setLocating(false);
      if (error.code === 1) { setLocation(null); setDemo(true); }
      setStatus(error.code === 1 ? 'Location permission was declined. You can still explore the PCC demo.' : 'Couldn’t determine your location. Try again or use the PCC demo.');
    }, { enableHighAccuracy:true, timeout:15000, maximumAge:10000 });
  }, [stopWatching]);
  useEffect(() => {
    // Show the pin right away for visitors who already allowed location; never prompt on page load.
    let live = true;
    navigator.permissions?.query({ name: 'geolocation' }).then(result => { if (live && result.state === 'granted') startLocation(); }).catch(() => {});
    return () => { live = false; stopWatching(); };
  }, [startLocation, stopWatching]);
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&${location ? `origin=${location.lat},${location.lng}&` : ''}destination=${spot.lat},${spot.lng}&travelmode=walking`;
  return <div className="app">
    <header className="topbar"><a className="brand" href="#"><span className="brand-mark"><Rocket size={21}/></span>team V<span className="brand-dot">.</span></a><nav aria-label="Main navigation" ref={navRef}>{[{id:'mission',label:'The launch'},{id:'viewing',label:'Find your view'},{id:'conditions',label:'Sky & schedule'}].map(item=><a key={item.id} data-tab={item.id} href={`#${item.id}`} className={`${item.id==='conditions'?'nav-extra ':''}${activeTab===item.id?'nav-active':''}`} aria-current={activeTab===item.id?'location':undefined} onClick={()=>{navTarget.current={id:item.id,until:performance.now()+1500};setActiveSection(item.id);}}>{item.label}</a>)}<button data-tab="info" className={showInfo?'nav-active':''} onClick={() => setShowInfo(true)}>How it works <ArrowUpRight size={13}/></button>{indicator&&<span className="nav-indicator" aria-hidden="true" style={{width:indicator.width,transform:`translateX(${indicator.left}px)`}}/>}</nav><span className="edition"><span/> PCC HACKATHON / 2026</span></header>
    <main>
      <section className="intro"><div className="intro-copy"><div className="eyebrow"><span className="tiny-line"/> ONE PLANET. INFINITE POSSIBILITIES.</div><h1>Your launch.<br/>Your <span>front-row sky.</span></h1><p>Every journey to space starts here.<br/>Explore the world’s launch sites, then find<br className="desktop-break"/> your own place to watch the sky.</p><a className="hero-cta" href="#viewing">Find my viewing spot <ArrowUpRight size={17}/></a><div className="hero-location"><MapPin size={12}/> YOUR LOCAL GUIDE <span>PASADENA, CA</span></div></div><Globe/></section>
      <section className="mission" id="mission" aria-label="Selected Vandenberg launch"><div className="mission-rocket"><Rocket size={29}/></div><div className="mission-name"><span className="eyebrow muted">VANDENBERG LAUNCH <span className={feedCurrent?'live-badge':'demo-badge'}>{feedCurrent?'FEED CONNECTED':'SAVED SCHEDULE'}</span></span><h2>{launch.vehicle} <span>/ {launch.mission}</span></h2><p><MapPin size={12}/> {launch.padName} <span className="separator">·</span> {launchDateLabel(launch)}</p></div><div className="countdown"><span className="eyebrow muted">{clock?'COUNTDOWN TO TARGET':preciseTarget(launch)?'TARGET TIME REACHED':'TARGET DATE IS PROVISIONAL'}</span>{clock?<div className="clock">{clock.map((n,i)=><span key={i}><b>{n}</b><small>{['HRS','MIN','SEC'][i]}</small>{i<2&&<i>:</i>}</span>)}</div>:<div className="passed">{preciseTarget(launch)?'Check the launch status for updates':launchDateLabel(launch)} <ArrowUpRight size={15}/></div>}</div></section>
      <div className="data-note" role="status"><Info size={13}/><span>{feed.upcoming.error??(feed.loading?'Checking the launch feed…':feedCurrent?'Launch Library 2 feed connected. Target times can change.':'Showing saved launch data; confirm the current target.')} <a href={launch.sourceUrl} target="_blank" rel="noreferrer">Mission source <ExternalLink size={10}/></a>.</span></div>
      <LaunchFacts launch={launch}/>
      <section className="viewer-grid" id="viewing">
        <div className="map-column"><div className="section-title"><h2><MapPin size={17}/> Find your spot</h2><span>PASADENA, CA</span></div><div className="map-shell"><MapView selected={selected} location={location} locating={locating} onSelect={onSelect} onLocate={startLocation}/><div className="map-label"><span className="map-label-icon"><Layers size={15}/></span><div><strong>Pasadena City College</strong><small>Approximate campus pins</small></div></div><div className="map-north" aria-label="North is up"><Navigation size={17}/><span>N</span></div><div className="map-caption"><span className="legend-dot"/> Candidate spot <span className="legend-outline"/> Campus area, approximate{location&&<><span className="legend-user"/> You are here</>}</div></div><div className="location-bar"><div><LocateFixed size={18}/><span>{demo ? 'Exploring the PCC demo' : 'Showing your live location'}</span></div><button className="location-button" onClick={startLocation} disabled={locating}><Crosshair size={14}/>{locating ? 'Locating…' : location ? 'Location on' : 'Use my location'}</button></div><p className="location-status" role="status">{status}</p>{!demo && <button className="text-button" onClick={() => { stopWatching(); setDemo(true); setLocation(null); setStatus('PCC demo location · live location is off'); }}>Reset to PCC demo</button>}</div>
        <aside className="guide"><div className="section-title"><h2><Compass size={17}/> Get your bearings</h2><span>01 / LOOK UP</span></div><div className="compass-card"><div className="compass-copy"><span className="eyebrow muted">START BY FACING</span><h3>West-northwest</h3><p>Then watch the western sky.</p></div><div className="compass" role="img" aria-label={`Launch site bearing ${Math.round(bearing)} degrees, measured clockwise from true north`}><span className="north">N</span><span className="east">E</span><span className="south">S</span><span className="west">W</span><div className="compass-inner"/><Navigation className="compass-arrow" size={38} style={{ transform:`translate(-50%, -50%) rotate(${bearing - 45}deg)` }}/><span className="compass-center"/></div><div className="bearing-row"><span>Launch site bearing</span><b>{Math.round(bearing)}° <span>{directionName(bearing)}</span></b></div><p className="compass-note">True north reference; this is a bearing to the pad, not a predicted flight path or a phone compass.</p></div><div className="visibility-card"><div className="visibility-title"><Telescope size={19}/><strong>A possible sighting.<br/>Never a promise.</strong></div><p>Night launches may be visible from the LA area once the rocket climbs. Clouds, flight path, and obstructions determine what you’ll see.</p><div className="conditions"><span>Launch-hour weather</span><b><a href="#conditions">View cloud forecast ↓</a></b></div><div className="conditions"><span>Flight-path visibility</span><b>Not modeled</b></div></div></aside>
      </section>
      <section className="spots-section"><div className="spots-heading"><div><span className="eyebrow muted">A PLACE TO START</span><h2>Scout your campus spot<span>.</span></h2></div><span className="candidate-label"><Info size={13}/> 3 candidates · all unverified</span></div>{!onCampus && <p className="outside-note">You appear to be outside PCC. These spots are a campus demo, not recommendations near your current location.</p>}<div className="spot-grid">{SPOTS.map((item,i) => <button key={item.id} className={`spot-card ${selected === item.id ? 'selected' : ''}`} onClick={() => setSelected(item.id)} aria-pressed={selected === item.id}><div className="spot-top"><span className="spot-number">0{i+1}</span><span className="unverified">Unverified</span><span className="select-circle">{selected === item.id && <Check size={13}/>}</span></div><h3>{item.name}</h3><p>{item.subtitle}</p><div className="spot-tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div><div className="spot-bottom"><span><Footprints size={13}/>{Math.round(distanceMeters(observer,item))} m {demo ? 'from demo pin' : 'straight-line distance'}</span><ArrowUpRight size={17}/></div></button>)}</div><div className="selected-details"><div><span className="eyebrow muted">SELECTED SPOT</span><h3>{spot.name}</h3><p>{spot.note} Pin locations are approximate.</p></div><a className="directions-button" href={directionsUrl} target="_blank" rel="noreferrer">Open walking directions <ArrowUpRight size={16}/></a></div></section>
      <LaunchPanels launch={launch} feed={feed} onSelect={setSelectedMission}/>
    </main><footer><a className="brand" href="#">team V<span className="brand-dot">.</span></a><span>Built for the curious. PCC space hackathon.</span><a href="https://pasadena.edu/about/documents/PCC_map.pdf" target="_blank" rel="noreferrer">Official campus map <ExternalLink size={12}/></a></footer>
    {showInfo && <div className="modal-backdrop" onClick={() => setShowInfo(false)}><dialog ref={dialogRef} onCancel={() => setShowInfo(false)} className="info-modal" aria-labelledby="info-title" onClick={event => event.stopPropagation()} onKeyDown={event => { if(event.key === 'Escape') setShowInfo(false); }}><button autoFocus className="close-modal" onClick={() => setShowInfo(false)} aria-label="Close guide">×</button><Compass size={27}/><h2 id="info-title">A starting point for your sky.</h2><p>This prototype combines a map, optional device location, three approximate campus pins, and a geometric bearing to Vandenberg’s launch pad.</p><p>Launch timing, status and webcast links come from Launch Library 2, checked every 10 minutes. Cached records and a saved snapshot are labeled when live data is unavailable. Cloud forecasts for PCC and the pad come from Open-Meteo. This guide does not model rocket trajectory, terrain, building heights, or viewing probability.</p><p>Check each spot’s coordinates, sightlines, and access in person. Walking directions open Google Maps to an approximate pin; they are not a surveyed campus route.</p><p>Device coordinates stay in this page’s memory. Opening directions shares the selected destination and, if enabled, your location with Google Maps. Map tiles load from OpenStreetMap. Weather requests use public campus and launch-pad coordinates, never your device coordinates. Loading a video connects to YouTube.</p><a href="https://pasadena.edu/about/documents/PCC_map.pdf" target="_blank" rel="noreferrer">Consult PCC’s official campus map <ExternalLink size={13}/></a></dialog></div>}
  </div>;
}
