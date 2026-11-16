/* Run: node tests/sim-smoke.cjs. No npm dependencies. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const db=JSON.parse(fs.readFileSync(path.join(root,'data/collection.json'),'utf8'));
const stats=JSON.parse(fs.readFileSync(path.join(root,'data/part-abilities.json'),'utf8'));
const browser={};
vm.runInNewContext(fs.readFileSync(path.join(root,'sim-engine.js'),'utf8'),{window:browser,console},{filename:'sim-engine.js'});
const E=browser.BBX_SIM_CORE;
assert(E,'core export');
assert.equal(db.beys.length,19);
assert.equal(stats.summary.partRecords,78);
const owned=id=>E.makeBuild({mode:'whole',blade:id,ratchet:id,bit:id},db,stats);
for(const bey of db.beys)assert.equal(typeof owned(bey.id).vector.attack,'number');
const a=['OWN-G3084-01','OWN-G3084-02','OWN-G3084-03'].map(owned);
const b=['OWN-G3393-01','OWN-G3393-02','OWN-G3393-03'].map(owned);
assert.equal(E.validateDeck(a),true);
assert.equal(E.validateDeck(b),true);
assert.throws(()=>E.validateDeck([a[0],a[0],a[1]]),/重複/);
const wolf1=owned('OWN-G3084-04'),wolf2=owned('OWN-UX-08-01');
assert.throws(()=>E.validateDeck([wolf1,wolf2,a[0]]),/重複/); // 3-80/FB duplicate models
const one=E.simulateMatch([a[0]],[b[0]],{seed:966,arena:'xtreme',launch:[{power:11200,type:'string',angle:8},{power:10920,type:'winder',angle:-8}]});
const again=E.simulateMatch([a[0]],[b[0]],{seed:966,arena:'xtreme',launch:[{power:11200,type:'string',angle:8},{power:10920,type:'winder',angle:-8}]});
assert.equal(JSON.stringify(one),JSON.stringify(again),'same seed reproducible');
// Seeded drop positions stay in separate halves and start above the stadium.
const launch={seed:966,arena:'xtreme',launch:[{power:10500,type:'string',angle:0},{power:10500,type:'winder',angle:0}]};
const dropped=E.createBattle(a[0],b[0],launch);
const droppedAgain=E.createBattle(a[0],b[0],launch);
assert(dropped.tops[0].x<0&&dropped.tops[1].x>0,'launch halves');
assert(dropped.tops.every(t=>t.height>0&&!t.landed),'tops begin airborne');
assert.equal(JSON.stringify(dropped.tops),JSON.stringify(droppedAgain.tops),'same seed same drop');
for(let i=0;i<150&&!dropped.tops.every(t=>t.landed);i++)dropped.step();
assert(dropped.tops.every(t=>t.landed&&t.height===0),'tops settle before collisions');
assert.equal(dropped.events.filter(e=>e.type==='land').length,2,'each top bounces once');
const noPower=E.createBattle(a[0],b[0],{seed:966,launch:[{power:0},{power:0}]});
assert(noPower.tops.every(t=>t.spin===0),'0 SP produces no launch spin');
const maxPower=E.createBattle(a[0],b[0],{seed:966,launch:[{power:14000},{power:14000}]});
assert(maxPower.tops.every((t,i)=>t.spin>noPower.tops[i].spin),'power controls spin');
const clamped=E.createBattle(a[0],b[0],{seed:966,launch:[{power:99999},{power:99999}]});
assert.equal(maxPower.tops[0].spin,clamped.tops[0].spin,'SP capped at 14000');
// Launcher angle must change actual lean, horizontal velocity, and subsequent course.
const straight=E.createBattle(a[0],b[0],{seed:333,launch:[{power:14000,angle:0},{power:14000,angle:0}]});
const steep=E.createBattle(a[0],b[0],{seed:333,launch:[{power:14000,angle:35},{power:14000,angle:0}]});
const opposite=E.createBattle(a[0],b[0],{seed:333,launch:[{power:14000,angle:-35},{power:14000,angle:0}]});
assert.equal(straight.tops[0].tilt,0,'flat launch begins upright');
assert(steep.tops[0].tilt>.4&&opposite.tops[0].tilt<-.4,'angle visibly tilts on either side');
assert(steep.tops[0].vy>straight.tops[0].vy&&opposite.tops[0].vy<straight.tops[0].vy,'launch angle steers');
for(let step=0;step<250;step++){straight.step();steep.step();opposite.step();}
assert(Math.abs(steep.tops[0].y-opposite.tops[0].y)>.08,'angle changes actual battle trajectory');
// High-energy contact has to be observable. Burst is not guaranteed per hit.
const attacker=owned('OWN-BXG-57-02'),target=owned('OWN-G3084-02');
let impactSeen=false,burstCount=0,highContactCount=0;
for(let seed=1;seed<=120;seed++){
 const play=E.createBattle(attacker,target,{seed:seed*197,arena:'xtreme',launch:[{power:14000,angle:0},{power:14000,angle:0}]});
 for(let j=0;j<4100&&!play.done;j++){
  play.step();
  if(play.collisionCount>0)highContactCount++;
  if(play.tops.some(t=>t.landed&&t.height>0.012&&t.impact>.04))impactSeen=true;
 }
 if(play.finish==='burst')burstCount++;
}
assert(highContactCount>0,'high energy tops should meet');
assert(impactSeen,'hit should produce airborne knockback');
assert(burstCount>0,'some repeatable high energy battles should burst');
// Regression: two live tops must never visibly interpenetrate during contact.
const coincident=E.createBattle(a[0],b[0],{seed:111});
coincident.tops.forEach(t=>{t.landed=true;t.height=0;t.x=0;t.y=0;t.vx=0;t.vy=0;});
coincident.step();
assert(Math.hypot(coincident.tops[0].x-coincident.tops[1].x,
 coincident.tops[0].y-coincident.tops[1].y)>=
 coincident.tops[0].model.radius+coincident.tops[1].model.radius-1e-6,
 'exactly coincident centres must be separated without NaN');
const highSpeed=E.createBattle(a[0],b[0],{seed:333});
highSpeed.tops.forEach((t,i)=>{t.landed=true;t.height=0;t.x=i===0?-.45:.45;t.y=0;t.vx=i===0?150:-150;t.vy=0;});
highSpeed.step();
assert(highSpeed.collisionCount>=1,'swept high-speed movement must not tunnel past the opposing blade');
const rimTop=E.createBattle(a[0],b[0],{seed:444});
rimTop.tops[0].landed=true;rimTop.tops[0].height=0;
rimTop.tops[0].x=1.30;rimTop.tops[0].y=0;rimTop.tops[0].vx=3;
rimTop.tops[1].landed=true;rimTop.tops[1].height=0;
rimTop.tops[1].x=-.50;rimTop.tops[1].y=0;
rimTop.step();
assert(Math.hypot(rimTop.tops[0].x,rimTop.tops[0].y)<=
 1.32-rimTop.tops[0].model.radius+1e-6,'full visual blade must remain inside stadium rim');
let clippingFrames=0,checkedFrames=0;
for(let seed=1;seed<=24;seed++){
 const left=owned(db.beys[seed%db.beys.length].id);
 const right=owned(db.beys[(seed*7+4)%db.beys.length].id);
 const battle=E.createBattle(left,right,{seed:seed*397,arena:'xtreme',
  launch:[{power:seed%3===0?14000:10500,angle:seed%2?35:0},
   {power:seed%3===0?14000:10500,angle:seed%2?-35:0}],record:false});
 for(let frame=0;frame<Math.ceil(E.MAX_TIME/E.DT)&&!battle.done;frame++){
  battle.step();
  if(battle.done||!battle.tops.every(t=>t.landed))continue;
  checkedFrames++;
  const [u,v]=battle.tops;
  const gap=Math.hypot(u.x-v.x,u.y-v.y);
  if(Math.abs(u.height-v.height)<.24&&gap<u.model.radius+v.model.radius-1e-5)clippingFrames++;
 }
}
assert(checkedFrames>1000,'clipping stress test should cover many active frames');
assert.equal(clippingFrames,0,'battle tops must never interpenetrate while at contact height');
const three=E.simulateMatch(a,b,{seed:966});
assert.equal(three.mode,'3v3');
assert(three.rounds.length>0);
assert(three.rounds.every(r=>r.left>=0&&r.left<3&&r.right>=0&&r.right<3));
assert(three.rounds.every(r=>r.left===r.right),'deck positions stay paired');
const points={spin:1,over:2,burst:2,extreme:3,draw:0};
for(const r of three.rounds)assert.equal(r.points,points[r.finish]);
const factory=owned('OWN-G3084-05'); // CX factory blade is three physical modules
assert.equal(factory.partPhysical.length,5);
const cx=E.makeBuild({mode:'cx',chip:'OWN-G3084-05',main:'OWN-G3084-05',assist:'OWN-G3084-05',ratchet:'OWN-G3063-01',bit:'OWN-G3063-01'},db,stats);
assert.throws(()=>E.validateDeck([factory,cx,a[0]]),/重複/);
let kinds=new Set();
for(let i=0;i<130;i++){
 const left=owned(db.beys[i%db.beys.length].id);
 const right=owned(db.beys[(i*11+4)%db.beys.length].id);
 const battle=E.runBattle(left,right,{seed:i*97+42,launch:[{power:3500+(i*773%10501),type:'string',angle:-35+(i*17%71)},{power:2800+(i*553%11201),type:'winder',angle:-35+(i*29%71)}],arena:'xtreme',record:false});
 kinds.add(battle.finish);
 assert(Number.isFinite(battle.time));
 assert(battle.time<=E.MAX_TIME+.01);
}
assert(kinds.has('spin'));
assert(kinds.size>=2,'engine should produce more than one finish type in varied seeds');
// Regression against almost contact-free battles and first-hit-only bursts.
// The thresholds constrain the prototype's own stylized behavior, not real match rates.
let activeContacts=0,activeRails=0,activeBursts=0,activeSpins=0,activeExtremes=0,activeOver=0;
for(let i=1;i<=120;i++){
 const left=owned(db.beys[i%db.beys.length].id);
 const right=owned(db.beys[(i*7+4)%db.beys.length].id);
 const result=E.runBattle(left,right,{seed:i*397,arena:'xtreme',
  launch:[{power:10500,angle:0},{power:10500,angle:0}],record:false});
 activeContacts+=result.collisions;
 activeRails+=result.rails;
 activeBursts+=result.finish==='burst';
 activeSpins+=result.finish==='spin';
 activeExtremes+=result.finish==='extreme';
 activeOver+=result.finish==='over';
}
assert(activeContacts/120>1.85,'typical battles must contain repeated contact, not just one impact');
assert(activeRails/120>.40,'Xtreme dash should visibly contribute to typical battles');
assert(activeBursts>0&&activeBursts<90,'burst finish should be possible but not automatic');
assert(activeSpins>0,'spin finish must remain possible');
assert(activeExtremes+activeOver>0,'pocket ring-outs must remain reachable with Xtreme rail enabled');
const noRail=E.runBattle(owned('OWN-G3084-01'),owned('OWN-G3084-02'),
 {seed:345,arena:'plain',rail:false,launch:[{power:10500},{power:10500}],record:false});
assert.equal(noRail.rails,0,'plain training stadium cannot use an Xtreme dash');

console.log(JSON.stringify({passed:true,collection:db.beys.length,partRecords:stats.summary.partRecords,threeRounds:three.rounds.length,finishTypes:[...kinds],highEnergyBursts:burstCount,impactSeen,highContactCount,replayMeanContacts:+(activeContacts/120).toFixed(2),replayMeanRails:+(activeRails/120).toFixed(2),replayBursts:activeBursts,replaySpins:activeSpins,replayRingouts:activeExtremes+activeOver,checkedClippingFrames:checkedFrames,clippingFrames},null,2));
