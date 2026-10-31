import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curvatureHeightKm, forecastSample, isLaunchRecord, launchDateLabel, normalizeLaunch, preciseTarget, safeWebUrl, youtubeEmbedUrl } from './launch-data.ts';

const raw={id:'mission',name:'Falcon 9 | Test mission',net:'2026-10-31T04:02:22Z',net_precision:{abbrev:'SEC'},pad:{latitude:34.632,longitude:-120.611,location:{id:11}}};
test('unreadable or non-local launch records are rejected instead of using invented coordinates',()=>{
  assert.equal(normalizeLaunch({...raw,pad:{latitude:null,longitude:null,location:{id:11}}}),null);
  assert.equal(normalizeLaunch({...raw,net:'not-a-time'}),null);
  assert.equal(normalizeLaunch({...raw,pad:{latitude:28,longitude:-80,location:{id:12}}}),null);
  assert.equal(normalizeLaunch(raw)?.pad.lat,34.632);
});
test('webcasts reject unsafe links and only embed recognized YouTube video IDs',()=>{
  assert.equal(safeWebUrl('javascript:alert(1)'),null);
  assert.equal(youtubeEmbedUrl('https://youtube.com.evil.test/watch?v=OVOVtaf15eY'),null);
  assert.equal(youtubeEmbedUrl('https://www.youtube.com/watch?v=OVOVtaf15eY'),'https://www.youtube-nocookie.com/embed/OVOVtaf15eY?autoplay=1');
  assert.equal(youtubeEmbedUrl('https://x.com/i/broadcasts/abc'),null);
});
test('weather sampling never substitutes another day or missing cloud values for launch-hour weather',()=>{
  const hourly={time:[100000,103600],cloud_cover:[0,null]};
  assert.deepEqual(forecastSample(hourly,100000000),{cloud:0,time:100000000});
  assert.equal(forecastSample(hourly,103600000),null);
  assert.equal(forecastSample(hourly,200000000),null);
});
test('month-precision targets do not expose placeholder launch times',()=>{
  const launch=normalizeLaunch({...raw,net:'2026-11-30T00:00:00Z',net_precision:{abbrev:'M'}})!;
  assert.equal(preciseTarget(launch),false);
  assert.equal(launchDateLabel(launch),'Nov 2026 · provisional');
});
test('Pacific launch dates account for daylight saving time',()=>{
  assert.match(launchDateLabel(normalizeLaunch(raw)!),/Oct 30, 9:02 PM PDT/);
  assert.match(launchDateLabel(normalizeLaunch({...raw,net:'2026-11-03T01:42:00Z'})!),/Nov 2, 5:42 PM PST/);
});
test('curvature height is a geometric altitude estimate and handles impossible distances',()=>{
  assert.equal(curvatureHeightKm(0),0);
  assert.ok(Math.abs(curvatureHeightKm(235)-4.336)<.01);
  assert.ok(Number.isNaN(curvatureHeightKm(11000)));
});
test('coarse calendar targets keep their month and do not invent a month for year-only precision',()=>{
  assert.equal(launchDateLabel(normalizeLaunch({...raw,net:'2026-11-01T00:00:00Z',net_precision:{abbrev:'M'}})!),'Nov 2026 · provisional');
  assert.equal(launchDateLabel(normalizeLaunch({...raw,net:'2027-01-01T00:00:00Z',net_precision:{abbrev:'Y'}})!),'2027 · provisional');
  assert.equal(launchDateLabel(normalizeLaunch({...raw,net:'2026-10-01T00:00:00Z',net_precision:{abbrev:'Q'}})!),'Q4 2026 · provisional');
});
test('damaged cache entries cannot reach the video and map components',()=>{
  const launch=normalizeLaunch(raw)!;
  assert.equal(isLaunchRecord(launch),true);
  assert.equal(isLaunchRecord({...launch,webcasts:undefined}),false);
  assert.equal(isLaunchRecord({...launch,pad:{lat:999,lng:-120}}),false);
  assert.equal(isLaunchRecord({...launch,sourceUrl:'javascript:alert(1)'}),false);
});
test('malformed optional metadata does not discard a valid launch or blank its name',()=>{
  const launch=normalizeLaunch({...raw,name:'Test mission',info_urls:{},vid_urls:[null,{}, {url:'javascript:alert(1)'}]});
  assert.equal(launch?.mission,'Test mission');
  assert.deepEqual(launch?.webcasts,[]);
});
