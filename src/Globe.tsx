import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ArrowDown, Globe2, Move, Pause, Play, RotateCcw } from 'lucide-react';
import { LAUNCH_SITES } from './launch-sites';
import { GLOBE_RADIUS, GLOBE_TILT, projectSite } from './globe-projection';
import { releaseVelocity, stepMomentum } from './globe-motion';
import type { AngularVelocity, MotionSample } from './globe-motion';

const VERTEX = `attribute vec2 position; void main(){gl_Position=vec4(position,0.0,1.0);}`;
const FRAGMENT = `precision mediump float;
uniform vec2 resolution; uniform float rotation; uniform float tilt; uniform sampler2D earth;
const float PI=3.14159265359;
void main(){
 vec2 p=(gl_FragCoord.xy/resolution-0.5)/${GLOBE_RADIUS};
 float d=length(p);
 if(d>1.0){float glow=exp(-(d-1.0)*32.0)*0.48; gl_FragColor=vec4(vec3(0.18,0.55,1.0)*glow,glow);return;}
 float z=sqrt(max(0.0,1.0-dot(p,p)));
 float lat=asin(clamp(p.y*cos(tilt)+z*sin(tilt),-1.0,1.0));
 float lon=atan(p.x,z*cos(tilt)-p.y*sin(tilt))+rotation;
 vec2 uv=vec2(fract(lon/(2.0*PI)+0.5),0.5-lat/PI);
 vec3 surface=texture2D(earth,uv).rgb;
 float light=max(0.0,dot(vec3(p,z),normalize(vec3(-0.85,0.65,0.8))));
 vec3 color=surface*vec3(0.72,0.87,1.10)*(0.15+light*1.08);
 color=mix(color,vec3(0.015,0.08,0.15),0.13);
 float rim=pow(1.0-z,3.8);
 color+=vec3(0.11,0.43,0.84)*rim*(0.35+light*0.90);
 float alpha=1.0-smoothstep(0.997,1.0,d);
 gl_FragColor=vec4(color*alpha,alpha);
}`;

function createRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement): {draw:(angle:number,tilt:number)=>void; dispose:()=>void} {
  // Match the browser compositor: fully transparent pixels must also have zero RGB.
  const gl = canvas.getContext('webgl', { alpha:true, antialias:true, premultipliedAlpha:true });
  if (!gl) return createCanvasRenderer(canvas,image);
  const compile = (type:number, source:string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader,source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) { const message=gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(message ?? 'Unable to compile globe'); }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER,VERTEX), fragment = compile(gl.FRAGMENT_SHADER,FRAGMENT);
  const program=gl.createProgram()!; gl.attachShader(program,vertex); gl.attachShader(program,fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error('Unable to initialize globe');
  gl.useProgram(program);
  const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const pos=gl.getAttribLocation(program,'position'); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  const texture=gl.createTexture(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  gl.uniform1i(gl.getUniformLocation(program,'earth'),0);
  const angleLocation=gl.getUniformLocation(program,'rotation');
  const tiltLocation=gl.getUniformLocation(program,'tilt');
  const sizeLocation=gl.getUniformLocation(program,'resolution');
  return {
    draw(angle,tilt) { gl.viewport(0,0,canvas.width,canvas.height); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform2f(sizeLocation,canvas.width,canvas.height); gl.uniform1f(angleLocation,angle); gl.uniform1f(tiltLocation,tilt); gl.drawArrays(gl.TRIANGLES,0,6); },
    dispose() { gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment); }
  };
}

// Software fallback keeps the same texture/marker alignment when WebGL is unavailable.
function createCanvasRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement) {
  canvas.width=420; canvas.height=420;
  const ctx=canvas.getContext('2d')!;
  const source=document.createElement('canvas'); source.width=image.width;source.height=image.height;
  const sourceCtx=source.getContext('2d')!; sourceCtx.drawImage(image,0,0);
  const pixels=sourceCtx.getImageData(0,0,image.width,image.height).data;
  const frame=ctx.createImageData(420,420);
  const samples:{destination:number;u:number;row:number;light:number;px:number;py:number;z:number}[]=[];
  let previousTilt=GLOBE_TILT;
  for(let y=0;y<420;y++)for(let x=0;x<420;x++){
    const px=(x/420-.5)/GLOBE_RADIUS, py=(.5-y/420)/GLOBE_RADIUS;
    if(px*px+py*py>1)continue;
    const z=Math.sqrt(1-px*px-py*py);
    const lat=Math.asin(py*Math.cos(GLOBE_TILT)+z*Math.sin(GLOBE_TILT));
    const lon=Math.atan2(px,z*Math.cos(GLOBE_TILT)-py*Math.sin(GLOBE_TILT));
    samples.push({ destination:(y*420+x)*4,u:lon/(2*Math.PI)+.5,row:Math.min(image.height-1,Math.floor((.5-lat/Math.PI)*image.height))*image.width,light:.17+Math.max(0,(-.85*px+.65*py+.8*z)/1.336)*1.02,px,py,z });
  }
  return {draw(angle:number,tilt:number){
    if(tilt!==previousTilt){
      const sin=Math.sin(tilt),cos=Math.cos(tilt);
      for(const sample of samples){
        const lat=Math.asin(Math.max(-1,Math.min(1,sample.py*cos+sample.z*sin)));
        sample.u=Math.atan2(sample.px,sample.z*cos-sample.py*sin)/(2*Math.PI)+.5;
        sample.row=Math.max(0,Math.min(image.height-1,Math.floor((.5-lat/Math.PI)*image.height)))*image.width;
      }
      previousTilt=tilt;
    }
    for(const sample of samples){
      const u=((sample.u+angle/(2*Math.PI))%1+1)%1;
      const src=(sample.row+Math.floor(u*image.width))*4, dst=sample.destination;
      frame.data[dst]=pixels[src]*sample.light*.78; frame.data[dst+1]=pixels[src+1]*sample.light*.92; frame.data[dst+2]=pixels[src+2]*sample.light; frame.data[dst+3]=255;
    }
    ctx.putImageData(frame,0,0);
  },dispose(){}};
}

export default function Globe() {
  const canvas=useRef<HTMLCanvasElement>(null);
  const markerElements=useRef<(HTMLButtonElement|null)[]>([]);
  const angle=useRef(-92*Math.PI/180);
  const tilt=useRef(GLOBE_TILT);
  const pausedRef=useRef(false);
  const hoverRef=useRef(false);
  const focusRef=useRef(false);
  const interactUntil=useRef(0);
  const momentum=useRef<AngularVelocity>({longitude:0,latitude:0});
  const reducedMotionRef=useRef(false);
  const drag=useRef<{id:number;x:number;y:number;angle:number;tilt:number;radius:number;moved:boolean;samples:MotionSample[]}|null>(null);
  const suppressClick=useRef(false);
  const [dragging,setDragging]=useState(false);
  const [paused,setPaused]=useState(false);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState(false);
  const [selected,setSelected]=useState('vandenberg');
  const selectedSite=LAUNCH_SITES.find(site=>site.id===selected)!;
  useEffect(()=>{
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion=()=>{reducedMotionRef.current=reducedMotion.matches;pausedRef.current=reducedMotion.matches;if(reducedMotion.matches)momentum.current={longitude:0,latitude:0};setPaused(reducedMotion.matches);};
    syncMotion(); reducedMotion.addEventListener('change',syncMotion);
    return ()=>reducedMotion.removeEventListener('change',syncMotion);
  },[]);
  useEffect(()=>{
    const element=canvas.current;
    if(!element)return;
    let cancelled=false, request=0, last=0, lastPaint=NaN, lastTilt=NaN, renderer:ReturnType<typeof createRenderer>|undefined;
    const image=new Image();
    function frame(time:number){
      if(cancelled)return;
      const delta=Math.min((time-last)/1000,.05); last=time;
      if(document.hidden)momentum.current={longitude:0,latitude:0};
      if(!drag.current&&!document.hidden&&(momentum.current.longitude!==0||momentum.current.latitude!==0)){
        const step=stepMomentum(momentum.current,delta);
        angle.current+=step.longitude;
        const nextTilt=tilt.current+step.latitude;
        tilt.current=Math.max(-Math.PI*.47,Math.min(Math.PI*.47,nextTilt));
        momentum.current=step.velocity;
        if(nextTilt!==tilt.current)momentum.current.latitude=0;
      }
      if(!pausedRef.current&&!hoverRef.current&&!focusRef.current&&!drag.current&&!document.hidden&&momentum.current.longitude===0&&momentum.current.latitude===0&&time>interactUntil.current)angle.current+=delta*.13;
      angle.current=((angle.current+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
      if(!document.hidden&&(angle.current!==lastPaint||tilt.current!==lastTilt)){
        renderer?.draw(angle.current,tilt.current);
        lastPaint=angle.current;
        lastTilt=tilt.current;
        LAUNCH_SITES.forEach((site,i)=>{
          const pin=markerElements.current[i]; if(!pin)return;
          const p=projectSite(site.lat,site.lng,angle.current,tilt.current);
          pin.style.left=`${p.x}%`;pin.style.top=`${p.y}%`;
          pin.style.visibility=p.visible?'visible':'hidden';
          pin.style.opacity=String(Math.min(1,p.depth*3));
          pin.style.zIndex=String(Math.round(p.depth*100)+1);
          pin.dataset.labelSide=p.x>70?'left':'right';
          pin.tabIndex=p.visible?0:-1;
        });
      }
      request=requestAnimationFrame(frame);
    }
    image.onload=()=>{
      if(cancelled)return;
      try{
        element.width=1000;element.height=1000;
        renderer=createRenderer(element,image);
        setReady(true);request=requestAnimationFrame(frame);
      }catch{setError(true);}
    };
    image.onerror=()=>{if(!cancelled)setError(true);};
    image.src=`${import.meta.env.BASE_URL}assets/earth-blue-marble.png`;
    return()=>{cancelled=true;cancelAnimationFrame(request);renderer?.dispose();};
  },[]);
  function chooseSite(id:string){
    momentum.current={longitude:0,latitude:0};
    const site=LAUNCH_SITES.find(item=>item.id===id)!;
    setSelected(id);angle.current=site.lng*Math.PI/180;tilt.current=site.lat*Math.PI/180;interactUntil.current=performance.now()+3000;
  }
  function toggleRotation(){momentum.current={longitude:0,latitude:0};pausedRef.current=!pausedRef.current;setPaused(pausedRef.current);interactUntil.current=0;}
  function resetView(){
    momentum.current={longitude:0,latitude:0};
    angle.current=-92*Math.PI/180;tilt.current=GLOBE_TILT;setSelected('vandenberg');
    pausedRef.current=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPaused(pausedRef.current);interactUntil.current=0;
  }
  function startDrag(event:ReactPointerEvent<HTMLDivElement>){
    if(event.isPrimary&&event.button===0)suppressClick.current=false;
    if(!ready||event.button!==0||!event.isPrimary||(event.target as HTMLElement).closest('button'))return;
    const bounds=event.currentTarget.getBoundingClientRect();
    const x=event.clientX-bounds.left-bounds.width/2,y=event.clientY-bounds.top-bounds.height/2;
    const radius=bounds.width*GLOBE_RADIUS;
    if(x*x+y*y>radius*radius)return;
    event.preventDefault();suppressClick.current=false;
    hoverRef.current=false;focusRef.current=false;
    momentum.current={longitude:0,latitude:0};
    drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,angle:angle.current,tilt:tilt.current,radius,moved:false,samples:[{x:event.clientX,y:event.clientY,time:event.timeStamp}]};
    event.currentTarget.setPointerCapture(event.pointerId);setDragging(true);
  }
  function moveDrag(event:ReactPointerEvent<HTMLDivElement>){
    const start=drag.current;if(!start||start.id!==event.pointerId)return;
    const dx=event.clientX-start.x,dy=event.clientY-start.y;
    const previous=start.samples.at(-1)!;
    if(event.clientX!==previous.x||event.clientY!==previous.y){
      start.samples.push({x:event.clientX,y:event.clientY,time:event.timeStamp});
      while(start.samples.length>2&&start.samples[1].time<event.timeStamp-80)start.samples.shift();
    }
    if(Math.hypot(dx,dy)>4)start.moved=true;
    angle.current=start.angle-dx/start.radius;
    tilt.current=Math.max(-Math.PI*.47,Math.min(Math.PI*.47,start.tilt+dy/start.radius));
  }
  function endDrag(event:ReactPointerEvent<HTMLDivElement>){
    if(!drag.current||drag.current.id!==event.pointerId)return;
    const finished=drag.current;
    suppressClick.current=finished.moved;
    if(finished.moved){
      // Preserve the user's Play/Pause setting; automatic rotation returns after the glide.
      momentum.current=event.type==='pointerup'&&!reducedMotionRef.current?releaseVelocity(finished.samples,event.timeStamp,finished.radius):{longitude:0,latitude:0};
    }
    drag.current=null;setDragging(false);
    interactUntil.current=performance.now()+900;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyboardRotate(event:ReactKeyboardEvent<HTMLDivElement>){
    if(event.target!==event.currentTarget)return;
    if(event.key==='Home'){event.preventDefault();resetView();return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();
    momentum.current={longitude:0,latitude:0};
    if(event.key==='ArrowLeft')angle.current+=.12;
    if(event.key==='ArrowRight')angle.current-=.12;
    if(event.key==='ArrowUp')tilt.current=Math.max(-Math.PI*.47,tilt.current-.1);
    if(event.key==='ArrowDown')tilt.current=Math.min(Math.PI*.47,tilt.current+.1);
    interactUntil.current=performance.now()+1600;
  }
  return <>
    <div className={`earth-stage ${ready?'is-ready':''} ${dragging?'is-dragging':''}`} role="group" aria-label="Interactive Earth globe" aria-describedby="globe-help" tabIndex={0} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag} onKeyDown={keyboardRotate} onClickCapture={event=>{if(suppressClick.current){event.preventDefault();event.stopPropagation();suppressClick.current=false;}}} onFocusCapture={event=>{focusRef.current=(event.target as HTMLElement).classList.contains('earth-pin');}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))focusRef.current=false;}}>
      <div className="earth-halo"/>
      <canvas className="earth-canvas" ref={canvas} role="img" aria-label="Rotating Earth with geographically positioned yellow markers at major launch sites"/>
      <div className="earth-input" aria-hidden="true"/>
      {ready&&LAUNCH_SITES.map((site,i)=><button key={site.id} ref={element=>{markerElements.current[i]=element;}} className={`earth-pin ${site.id===selected?'is-selected':''}`} aria-label={`${site.name}, ${site.country}`} aria-pressed={site.id===selected} onPointerEnter={()=>{hoverRef.current=true;}} onPointerLeave={()=>{hoverRef.current=false;}} onClick={()=>chooseSite(site.id)} style={{visibility:'hidden'}}><span className="earth-pin-core"/><span className="earth-pin-label">{site.name}<small>{site.country}</small></span></button>)}
      {!ready&&<span className="earth-loading" role="status">{error?'Earth visual unavailable. Launch sites are available in the selector below.':'Bringing Earth into view…'}</span>}
    </div>
    <div className="earth-hud"><div className="earth-hud-heading"><span className="yellow-dot"/> GLOBAL LAUNCH NETWORK <span className="earth-count">{LAUNCH_SITES.length} SITES</span></div><div className="earth-controls"><label><Globe2 size={14}/><span className="sr-only">Locate a launch site</span><select aria-label="Locate a launch site" value={selected} onChange={event=>chooseSite(event.target.value)}>{LAUNCH_SITES.map(site=><option key={site.id} value={site.id}>{site.name} · {site.country}</option>)}</select></label><button className="rotation-toggle globe-reset" onClick={resetView} aria-label="Reset globe view" title="Reset globe view"><RotateCcw size={13}/></button><button className="rotation-toggle" onClick={toggleRotation} aria-label={paused?'Resume globe rotation':'Pause globe rotation'} title={paused?'Resume rotation':'Pause rotation'}>{paused?<Play size={14}/>:<Pause size={14}/>}</button></div><p className="earth-coordinates">{Math.abs(selectedSite.lat).toFixed(2)}° {selectedSite.lat>=0?'N':'S'} <span>/</span> {Math.abs(selectedSite.lng).toFixed(2)}° {selectedSite.lng>=0?'E':'W'} <span>·</span> APPROX. SITE CENTER</p><div className="globe-help" id="globe-help"><Move size={12}/><span>Drag to explore · arrow keys to rotate</span></div></div>
    <div className="hero-bottom"><a href="#viewing"><ArrowDown size={14}/> FIND YOUR VIEW ON THE GROUND</a><span>EARTH IMAGERY: NASA <span>·</span> CURATED MAJOR LAUNCH SITES</span></div>
  </>;
}
