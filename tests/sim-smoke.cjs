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
const one=E.simulateMatch([a[0]],[b[0]],{seed:966,arena:'xtreme',launch:[{power:80,type:'string',angle:8},{power:78,type:'winder',angle:-8}]});
const again=E.simulateMatch([a[0]],[b[0]],{seed:966,arena:'xtreme',launch:[{power:80,type:'string',angle:8},{power:78,type:'winder',angle:-8}]});
assert.equal(JSON.stringify(one),JSON.stringify(again),'same seed reproducible');
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
 const battle=E.runBattle(left,right,{seed:i*97+42,launch:[{power:30+(i*31%71),type:'string',angle:-35+(i*17%71)},{power:30+(i*19%71),type:'winder',angle:-35+(i*29%71)}],arena:'xtreme',record:false});
 kinds.add(battle.finish);
 assert(Number.isFinite(battle.time));
 assert(battle.time<=E.MAX_TIME+.01);
}
assert(kinds.has('spin'));
assert(kinds.size>=2,'engine should produce more than one finish type in varied seeds');
console.log(JSON.stringify({passed:true,collection:db.beys.length,partRecords:stats.summary.partRecords,threeRounds:three.rounds.length,finishTypes:[...kinds]},null,2));
