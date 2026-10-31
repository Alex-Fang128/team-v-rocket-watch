import { test } from 'node:test';
import assert from 'node:assert/strict';
import { releaseVelocity, stepMomentum } from './globe-motion.ts';

test('release velocity follows the swipe and is bounded for fast gestures',()=>{
  const velocity=releaseVelocity([{x:0,y:0,time:0},{x:60,y:30,time:50},{x:120,y:60,time:100}],110,300);
  assert.ok(velocity.longitude<0&&velocity.latitude>0);
  assert.ok(Math.hypot(velocity.longitude,velocity.latitude)<=3.2+1e-10);
});
test('holding before release or tapping produces no accidental spin',()=>{
  assert.deepEqual(releaseVelocity([{x:0,y:0,time:0},{x:50,y:0,time:50}],200,300),{longitude:0,latitude:0});
  assert.deepEqual(releaseVelocity([{x:0,y:0,time:0}],1,300),{longitude:0,latitude:0});
});
test('deceleration is independent of display refresh rate',()=>{
  const single=stepMomentum({longitude:2,latitude:-.5},.1);
  let velocity={longitude:2,latitude:-.5},longitude=0,latitude=0;
  for(let i=0;i<10;i++){
    const frame=stepMomentum(velocity,.01);longitude+=frame.longitude;latitude+=frame.latitude;velocity=frame.velocity;
  }
  assert.ok(Math.abs(longitude-single.longitude)<1e-10);
  assert.ok(Math.abs(latitude-single.latitude)<1e-10);
  assert.ok(Math.abs(velocity.longitude-single.velocity.longitude)<1e-10);
});
test('a fling continuously slows and settles fully in less than a second',()=>{
  let velocity={longitude:3.2,latitude:0},elapsed=0,previousSpeed=3.2;
  while(velocity.longitude!==0&&elapsed<2){
    velocity=stepMomentum(velocity,1/120).velocity;elapsed+=1/120;
    const speed=Math.hypot(velocity.longitude,velocity.latitude);
    assert.ok(speed<=previousSpeed);previousSpeed=speed;
  }
  assert.deepEqual(velocity,{longitude:0,latitude:0});
  assert.ok(elapsed<1);
});
