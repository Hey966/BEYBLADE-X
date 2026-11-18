'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('index.html'),css=read('style.css');
const coll=JSON.parse(read('data/collection.json'));
const abilities=JSON.parse(read('data/part-abilities.json'));
const physics=JSON.parse(read('data/part-physics.json'));
assert.ok(coll.beys.length>=19);
assert.equal(coll.beys.filter(b=>b.id.startsWith('OWN-')).length,19);
let records=0,boxes=0;
for(const bey of coll.beys)for(const [kind,part] of Object.entries(abilities.beys[bey.id]?.parts||{})){
 records++;
 const metrics=['attack','defense','stamina',...(kind==='ratchet'?['height']:kind==='bit'?['dash','burst']:[])];
 for(const key of metrics)assert.ok(Number.isFinite(part.stats?.[key])&&part.stats[key]>=0&&part.stats[key]<=(key==='height'?200:100),bey.id+'/'+kind+'/'+key);
 if(kind==='ratchet')assert.equal(part.stats.height,Number(bey.ratchet.split('-')[1]),bey.id);
 assert.ok(part.sourceUrl.startsWith('https://')||
  (bey.id.startsWith('LOCAL-')&&part.verification?.status==='user-entered-unverified'),bey.id+'/'+kind);
 if(part.verification?.status==='verified-from-product-packaging')boxes++;
}
assert.ok(records>=78);
assert.equal(boxes,4);
assert.ok(physics.unverified.length>=2);
assert.equal(physics.statConflicts.filter(x=>x.status==='unresolved').length,1);
const ix=id=>html.indexOf('id="'+id+'"');
assert.ok(ix('simArena')>=0&&ix('simStart')>ix('simArena'));
for(const id of ['simStart','simPause','simNext','simReset'])assert.ok(ix(id)<ix('simActiveParts'),id+' must be before statistics');
assert.ok(css.includes('.sim-active-parts{grid-template-columns:1fr;gap:9px}'),'mobile stats single-column');
assert.ok(html.includes('模擬發射強度')&&html.includes('官方計分'));
assert.ok(!html.includes('10500 SP')&&!html.includes('14000 SP'));
assert.ok(html.includes('>克制</button>'));
assert.ok(read('analysis.js').includes('const keys=new Set(),models=new Set()'));
assert.ok(read('app.js').includes('seenModels=new Set()'));
const browser={};
vm.runInNewContext(read('sim-engine.js'),{window:browser,console});
const E=browser.BBX_SIM_CORE,db={beys:coll.beys};
const one=id=>E.makeBuild({mode:'whole',blade:id,ratchet:id,bit:id},db,abilities);
assert.equal(E.validateDeck(['OWN-G3084-01','OWN-G3084-02','OWN-G3084-03'].map(one)),true);
assert.throws(()=>E.validateDeck(['OWN-G3084-04','OWN-UX-08-01','OWN-G3084-01'].map(one)),/重複/);
const mock=(id,chip)=>({
 partPhysical:['lockChip:'+id,'mainBlade:'+id,'ratchet:'+id,'bit:'+id],
 partModel:['lockChip:'+chip,'mainBlade:'+id,'ratchet:'+id,'bit:'+id]
});
assert.throws(()=>E.validateDeck([mock('one','VALKYRIE'),mock('two','VALKYRIE'),mock('three','EVA')]),/重複/);
assert.equal(E.validateDeck([mock('one','EVA'),mock('two','EVA'),mock('three','EVA')]),true);
console.log('Official audit: 19 Beys, 78 records, 4 box fixes, 2 unverified weights, 1 conflict, UI and 3on3 restrictions');
