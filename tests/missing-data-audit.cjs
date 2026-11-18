'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const coll=JSON.parse(read('data/collection.json'));
const abilities=JSON.parse(read('data/part-abilities.json'));
const physics=JSON.parse(read('data/part-physics.json'));
const image=JSON.parse(read('data/image-status.json'));
const count={};
for(const row of image.results)count[row.status]=(count[row.status]||0)+1;
assert.ok(coll.beys.length>=19);
assert.equal(coll.beys.filter(b=>b.id.startsWith('OWN-')).length,19);
assert.equal(image.results.length,coll.beys.length*7);
assert.equal(count.ready,92);
assert.ok(count.not_applicable>=36);
assert.ok(count.awaiting_verified_photo>=3);
assert.equal(count.needs_manual_review,2);
const beys=Object.fromEntries(coll.beys.map(b=>[b.id,b]));
for(const row of image.results){
 const bey=beys[row.id];assert.ok(bey,row.id);
 if(row.status==='not_applicable'){
  assert.ok(['BX','UX'].includes(bey.system));
  assert.ok(['lockChip','mainBlade','assistBlade'].includes(row.part));
 }
 if(row.status==='ready')assert.ok(row.png&&row.png.startsWith('images/reference/'));
}
for(const bey of coll.beys){
 assert.ok(abilities.beys[bey.id]);
 const rows=image.results.filter(r=>r.id===bey.id);
 assert.equal(rows.length,7);
 for(const part of ['blade','ratchet','bit']){
  const state=rows.find(r=>r.part===part)?.status;
  if(bey.id.startsWith('OWN-'))assert.equal(state,'ready');
  else assert.equal(state,'awaiting_verified_photo');
 }
}
assert.equal(coll.beys.filter(b=>b.imageStatus==='blade_only_exact_photo').length,5);
const candidates=coll.beys.filter(b=>b.wholeReferencePage);
assert.equal(candidates.length,5);
for(const b of candidates)assert.match(b.wholeReferencePage,/^https:\/\//);
assert.ok(physics.unverified.filter(r=>r.status==='still_unverified').length>=2);
assert.equal(physics.statConflicts.filter(r=>r.status==='unresolved').length,1);
const browser={window:{}};vm.runInNewContext(read('data.js'),browser);
assert.equal(JSON.stringify(browser.window.BBX_SEED),JSON.stringify(coll));
const ph={window:{}};vm.runInNewContext(read('data/part-physics.js'),ph);
assert.equal(JSON.stringify(ph.window.BBX_PART_PHYSICS),JSON.stringify(physics));
const generator=read('tools/create_png_assets.py');
assert.ok(generator.includes('system_by_id')||generator.includes('systems ='));
assert.ok(generator.includes('"not_applicable"'));
const html=read('index.html'),app=read('app.js');
assert.ok(html.includes('id="dataCompleteness"'));
assert.ok(app.includes('function renderCompleteness()'));
assert.ok(html.includes('data/part-physics.js?v=20261118-completeness-v1'));
console.log('Verified 92 ready, 36 non-applicable, 5 pending whole images, 2 missing blade weights, 1 unresolved ability conflict');
