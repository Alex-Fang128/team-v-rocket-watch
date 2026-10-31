import {test} from 'node:test';
import assert from 'node:assert/strict';
import {expectedCoverageTime,shouldSwitchToCurrent} from './webcast-state.ts';
const launch={net:'2026-10-31T04:02:22Z',precision:'SEC'};
const target=Date.parse(launch.net);
test('coverage uses a valid provider time before the launch',()=>{
  assert.equal(expectedCoverageTime(launch,{startTime:'2026-10-31T03:50:00Z'}),Date.parse('2026-10-31T03:50:00Z'));
});
test('stale, invalid, missing, or post-launch stream times never delay access beyond zero',()=>{
  for(const startTime of [undefined,'invalid','2026-10-27T03:50:00Z','2026-10-31T05:00:00Z']){
    assert.equal(expectedCoverageTime(launch,{startTime}),target-20*60000);
  }
});
test('provisional launch dates do not schedule an automatic video switch',()=>{
  assert.equal(expectedCoverageTime({...launch,precision:'M'}),null);
});
test('a following replay switches at coverage time and at countdown zero',()=>{
  const starts=expectedCoverageTime(launch)!;
  assert.equal(shouldSwitchToCurrent(true,true,starts-1,starts,true,false),false);
  assert.equal(shouldSwitchToCurrent(true,true,starts,starts,true,false),true);
  assert.equal(shouldSwitchToCurrent(true,true,target,starts,true,false),true);
});
test('manual replay choice, missing stream, and blocked embeds are respected',()=>{
  assert.equal(shouldSwitchToCurrent(false,true,target,target,true,false),false);
  assert.equal(shouldSwitchToCurrent(true,false,target,target,true,false),false);
  assert.equal(shouldSwitchToCurrent(true,true,target,null,true,false),false);
  assert.equal(shouldSwitchToCurrent(true,true,target,target,false,false),false);
  assert.equal(shouldSwitchToCurrent(true,true,target,target,true,true),false);
});
