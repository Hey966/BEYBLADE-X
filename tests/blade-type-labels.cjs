const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx={window:{},console};
for(const file of ['data.js','data/part-abilities.js','blade-types.js'])
 vm.runInNewContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
const list=ctx.window.BBX_SEED.beys,records=ctx.window.BBX_PART_STATS.beys,types=ctx.window.BBX_BLADE_TYPES;
const role={attack:'攻擊型',defense:'防禦型',stamina:'持久型',balance:'平衡型'};
const counts={blade:0,mainBlade:0,assistBlade:0};
assert.equal(list.length,19);
for(const b of list)for(const k of Object.keys(counts)){
 if(!b[k])continue;
 const record=records[b.id]?.parts?.[k];
 assert.ok(record&&role[record.type],b.id+' / '+k);
 assert.equal(types.label(b[k],b.id,k),b[k]+'（'+role[record.type]+'）');
 counts[k]++;
}
assert.deepEqual(counts,{blade:19,mainBlade:7,assistBlade:7});
assert.equal(types.label('UNKNOWN','LOCAL-NEW'),'UNKNOWN（類型待查證）');
assert.equal(types.label('','LOCAL-NEW'),'未登記');
assert.equal(types.type('Arc','OWN-BXG-57-01','mainBlade'),'stamina');
assert.equal(types.type('TigaRage FT','OWN-BXG-70-01'),'stamina');
assert.equal(types.type('T','OWN-BXG-70-01','assistBlade'),'balance');
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.indexOf('data/part-abilities.js')<html.indexOf('blade-types.js'));
assert.ok(html.indexOf('blade-types.js')<html.indexOf('app.js'));
for(const file of ['app.js','analysis.js','sim-ui.js'])
 assert.ok(fs.readFileSync(file,'utf8').includes('BBX_BLADE_TYPES'),file);
console.log('Blade categories: 19 full blades, 7 CX main blades and 7 CX assist blades verified');
