import type { Launch, Webcast } from './launch-data';

/** Expected coverage time, not confirmation that the provider is broadcasting. */
export function expectedCoverageTime(launch:Pick<Launch,'net'|'precision'>,video?:Pick<Webcast,'startTime'>):number|null {
  const target=Date.parse(launch.net);
  if(!['SEC','MIN'].includes(launch.precision)||!Number.isFinite(target))return null;
  const listed=video?.startTime?Date.parse(video.startTime):NaN;
  // Reject stale times and times after liftoff so the page never hides the current stream at zero.
  return Number.isFinite(listed)&&listed<=target&&target-listed<=3*3600000?listed:target-20*60000;
}

export function shouldSwitchToCurrent(following:boolean,watchingReplay:boolean,now:number,expected:number|null,hasEmbed:boolean,blocked:boolean):boolean {
  return following&&watchingReplay&&expected!==null&&now>=expected&&hasEmbed&&!blocked;
}
