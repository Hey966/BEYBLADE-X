/* Simulator UI smoke test. Node 22, no browser or npm dependencies.
 * Validates view/physics state synchronization and deterministic control flow.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const db=JSON.parse(read('data/collection.json'));
const abilities=JSON.parse(read('data/part-abilities.json'));
const browser={};
vm.runInNewContext(read('sim-engine.js'),{window:browser,console});
const html=read('index.html');
const nodes={};
for(const match of html.matchAll(/\bid="([^"]+)"/g)){
 const id=match[1];
 const value=id==='simMatchType'?'1':id==='simArenaType'?'xtreme':id==='simSpeed'?'4':id==='simSeed'?'966':
 id.startsWith('simPower')?'75':id.startsWith('simAngle')?'0':'';
 nodes[id]={id,value,innerHTML:'',textContent:'',disabled:false,hidden:true,style:{},
  events:{},classList:{toggle(){}},addEventListener(type,handler){(this.events[type]??=[]).push(handler)}};
}
const renderEvents=[],arenaCalls=[],modelCalls=[];
browser.BBX_COLLECTION_API={getBeys:()=>db.beys,getBey:id=>db.beys.find(b=>b.id===id)};
browser.BBX_PART_STATS=abilities;
browser.BBX_SIM_VIEW={create:()=>({
 setArena:value=>arenaCalls.push(value),
 setBuilds:items=>modelCalls.push(items.map(x=>x?.name)),
 getVisuals:spec=>[{name:'戰刃',value:spec.name,image:'images/reference/example.png'}],
 render:(state,options)=>renderEvents.push({finish:state?.finish,done:!!state?.done,age:options?.finalAge||0})
})};
let frames=[],now=0;
const uiContext={
 window:browser,document:{getElementById:id=>nodes[id]||null},
 requestAnimationFrame(fn){frames.push(fn);return frames.length},
 cancelAnimationFrame(){},performance:{now:()=>now},
 setTimeout(fn){fn()},URL:{},Blob:class{},console
};
vm.runInNewContext(read('sim-ui.js'),uiContext);
function fire(id,type='click',value){
 if(value!==undefined)nodes[id].value=String(value);
 for(const handler of nodes[id].events[type]||[])handler({target:{closest:()=>null}});
}
assert(modelCalls.length>0);
assert(nodes.simActiveParts.innerHTML.includes('戰刃'));
fire('simArenaType','change','plain');
assert.equal(arenaCalls.at(-1),'plain');
fire('simSettingsReset');
assert.equal(nodes.simArenaType.value,'xtreme');
assert.equal(nodes.simPower0.value,'75');
assert.equal(nodes.simAngle1.value,'0');
assert.equal(nodes.simLauncher1.value,'winder');
assert.equal(nodes.simMatchType.value,'1');
const beforeModels=modelCalls.length;
const changed={value:'OWN-G3084-03',dataset:{team:'0',index:'0',part:'blade'}};
changed.closest=()=>changed;
for(const handler of nodes.simTeam0.events.change||[])handler({target:changed});
assert(modelCalls.length>beforeModels,'change selected blade updates scene');
assert(nodes.simActiveParts.innerHTML.includes('Crest Leon'));
fire('simStart');
const scoreAtStart=nodes.simScore.textContent;
let visualFrame=-1,scoredFrame=-1,scoreBefore=null;
for(let i=0;i<2500&&frames.length;i++){
 const cb=frames.shift();now+=16;cb(now);
 if(visualFrame<0&&!nodes.simFinishOverlay.hidden){
  visualFrame=i;scoreBefore=nodes.simScore.textContent;
 }
 if(scoredFrame<0&&nodes.simNext.disabled===false){
  scoredFrame=i;break;
 }
}
assert(visualFrame>=0,'terminal animation should appear');
assert(scoredFrame>visualFrame+40,'score must follow visible terminal animation');
assert.equal(scoreBefore,scoreAtStart,'score must not update before animation');
assert.notEqual(nodes.simScore.textContent,scoreAtStart,'score should update after terminal animation');
assert(renderEvents.some(r=>r.age>=1),'finish motion should receive final age');
fire('simMatchType','change','3');
assert.equal((nodes.simTeam0.innerHTML.match(/sim-build-card/g)||[]).length,3);
assert.equal((nodes.simTeam1.innerHTML.match(/sim-build-card/g)||[]).length,3);
console.log(JSON.stringify({
 passed:true,stadiumSwap:arenaCalls.includes('plain'),reset:true,
 newBladePreview:true,finishBeforeScoring:true,visualFrame,scoredFrame,threeDeck:true
},null,2));
