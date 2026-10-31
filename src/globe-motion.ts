export type MotionSample={x:number;y:number;time:number};
export type AngularVelocity={longitude:number;latitude:number};
const DAMPING=8.5;
const STOP_SPEED=.012;

/** Estimate a fling from the last ~80 ms; holding before release cancels the fling. */
export function releaseVelocity(samples:MotionSample[],releasedAt:number,radius:number):AngularVelocity {
  const last=samples.at(-1);
  if(!last||samples.length<2||radius<=0||releasedAt-last.time>100)return {longitude:0,latitude:0};
  let first=samples[0];
  for(let index=1;index<samples.length-1;index++){
    if(samples[index].time<last.time-80)first=samples[index];else break;
  }
  const seconds=(last.time-first.time)/1000;
  if(seconds<=0)return {longitude:0,latitude:0};
  let longitude=-(last.x-first.x)/radius/seconds,latitude=(last.y-first.y)/radius/seconds;
  const speed=Math.hypot(longitude,latitude);
  if(speed>3.2){longitude*=3.2/speed;latitude*=3.2/speed;}
  return {longitude,latitude};
}

/** Exact exponential integration gives the same feel on 30, 60, and 120 Hz screens. */
export function stepMomentum(velocity:AngularVelocity,seconds:number){
  const decay=Math.exp(-DAMPING*Math.max(0,seconds));
  const distance=(1-decay)/DAMPING;
  const next={longitude:velocity.longitude*decay,latitude:velocity.latitude*decay};
  if(Math.hypot(next.longitude,next.latitude)<STOP_SPEED){next.longitude=0;next.latitude=0;}
  return {longitude:velocity.longitude*distance,latitude:velocity.latitude*distance,velocity:next};
}
