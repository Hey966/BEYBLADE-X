const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{},console};
for(const file of ['data.js','data/part-abilities.js','bit-types.js'])
 vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const b=context.window.BBX_SEED.beys;
const classifications=context.window.BBX_BIT_TYPES;
const expected={
 U:'平衡型',O:'持久型',GN:'防禦型',FB:'持久型',
 T:'平衡型',G:'持久型',GP:'平衡型',A:'攻擊型',
 LO:'持久型',W:'防禦型',WB:'持久型',E:'平衡型',
 V:'攻擊型',GR:'攻擊型'
};
const found=new Set();
assert.equal(b.length,19,'Expected 19 owned Beyblades');
for(const bey of b){
 const code=bey.bit;
 found.add(code);
 assert.equal(classifications.label(code,bey.id),code+'（'+expected[code]+'）',bey.id);
 assert.equal(classifications.suffix(code,bey.id),'（'+expected[code]+'）',code);
}
assert.equal(found.size,14,'Expected 14 distinct Bit types');
assert.equal(classifications.label('ZZ','LOCAL-TEST'),'ZZ（類型待查證）');
assert.equal(classifications.label('','LOCAL-TEST'),'未登記');
const html=fs.readFileSync('index.html','utf8');
assert.ok(html.indexOf('bit-types.js')>html.indexOf('data/part-abilities.js'));
assert.ok(html.indexOf('bit-types.js')<html.indexOf('app.js'));
for(const file of ['app.js','analysis.js','sim-ui.js']){
 const js=fs.readFileSync(file,'utf8');
 assert.ok(js.includes('BBX_BIT_TYPES'),file+' must load Bit labels');
}
console.log('Bit type display: 19 owned, 14 codes, correct categories and script order');
