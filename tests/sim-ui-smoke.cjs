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
const sceneCode=read('sim-view.js');
// The sides define only spawn positions, never visible stadium dividers or overlays.
assert(!sceneCode.includes("zoneDividerMaterial"),'3D should not draw a centre divider');
assert(!sceneCode.includes("CircleGeometry(1.23,64,angle,Math.PI)"),'3D should not tint the two halves');
assert(!sceneCode.includes("ctx.fillText('我方落點區'"),'2D should not label launch halves');
assert(!sceneCode.includes("ctx.fillRect(cx-radius,cy-radius,radius,radius*2)"),'2D should not tint half of the stadium');
assert(sceneCode.includes("g.scale.setScalar((spec.radius||.18)/.164*.94)"),
 '3D outer blade footprint must track collision radius');
assert(sceneCode.includes("paintImage(ctx,texture,0,0,r*2)"),
 '2D blade image must not extend beyond its collision-sized painted disc');
assert(!sceneCode.includes("r*2.24"),'legacy oversized 2D sprite causes clipping');
assert(sceneCode.includes("const topOrder="),'airborne tops must use correct depth order');
assert(sceneCode.includes("new THREE.ExtrudeGeometry(section"),
 '3D Ratchet must have hollow profile geometry');
assert(sceneCode.includes("ratchetTeeth=Math.max(0"),
 '3D Ratchet must use chosen protrusion count');
assert(sceneCode.includes("getRatchetCanvas(img)"),
 '3D Ratchet must display real selected part imagery');
assert(sceneCode.includes("fragments.find(p=>p.kind==='ratchet')"),
 '2D burst must separate selected Ratchet image');
assert(!sceneCode.includes("ctx.fillRect(-r*.45,-r*.17,r*.9,r*.34)"),
 '2D burst must not use generic rectangular fragments');
assert(html.includes('id="simSeedAuto" checked'),
 'new battles should default to new initial conditions');
assert(sceneCode.includes("const bladeLow="),'tilted blades must be lifted clear of the floor');
assert(sceneCode.includes('mesh.root.rotation.x=Math.cos(dir)*lean;'),
 '3D recoil must follow the impact-axis lean');
assert(sceneCode.includes('mesh.root.rotation.z=Math.sin(dir)*lean;'),
 '3D precession must move both tilt axes');
assert(!sceneCode.includes('Math.cos(t.heading*.38)'),
 'blade spin must not cause unrelated high-frequency rocking');
assert(!sceneCode.includes('Math.sin(t.heading*.38)'),
 'impact orientation must not be driven by heading texture');

assert(sceneCode.includes("function coastRotation("),'post-finish winner needs a smooth coasting phase');
assert(sceneCode.includes("t-t*t/(2*COAST_DURATION)"),
 'post-finish spin should decelerate to zero smoothly');
const nodes={};
for(const match of html.matchAll(/\bid="([^"]+)"/g)){
 const id=match[1];
 const value=id==='simMatchType'?'1':id==='simArenaType'?'xtreme':id==='simSpeed'?'4':id==='simSeed'?'966':
 id.startsWith('simPower')?'10500':id.startsWith('simAngle')?'0':'';
 nodes[id]={id,value,checked:id==='simSeedAuto',innerHTML:'',textContent:'',disabled:false,hidden:true,style:{},
  events:{},classList:{toggle(){}},addEventListener(type,handler){(this.events[type]??=[]).push(handler)}};
}
const renderEvents=[],arenaCalls=[],modelCalls=[];
browser.BBX_COLLECTION_API={getBeys:()=>db.beys,getBey:id=>db.beys.find(b=>b.id===id)};
browser.BBX_PART_STATS=abilities;
browser.BBX_SIM_VIEW={create:()=>({
 setArena:value=>arenaCalls.push(value),
 setBuilds:items=>modelCalls.push(items.map(x=>x?.name)),
 getVisuals:spec=>[{name:'戰刃',value:spec.name,image:'images/reference/example.png'}],
 render:(state,options)=>renderEvents.push({finish:state?.finish,done:!!state?.done,age:options?.finalAge||0,coast:options?.coastAge||0,lean:state?.tops?.[0]?.tilt??0})
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
assert(nodes.simSeedAuto.checked,'default new-match seed should be automatic');
fire('simSeed','change','123456');
assert.equal(nodes.simSeedAuto.checked,false,'manual seed input must enable deterministic replay');
assert.equal(nodes.simSeed.value,'123456');
fire('simSettingsReset');
assert.equal(nodes.simSeedAuto.checked,true,'reset should re-enable fresh seeds');
assert(nodes.simActiveParts.innerHTML.includes('sim-stat-grid'),
 'visible five-metric ratings must be shown for each current build');
assert(nodes.simActiveParts.innerHTML.includes('查看各零件原始數值'),
 'part-level audit must be available in the simulation UI');
const firstStatHtml=nodes.simActiveParts.innerHTML;
const changeBit={value:'OWN-UX-08-01',dataset:{team:'0',index:'0',part:'bit'}};
changeBit.closest=()=>changeBit;
for(const handler of nodes.simTeam0.events.change||[])handler({target:changeBit});
assert.notEqual(nodes.simActiveParts.innerHTML,firstStatHtml,
 'selected Bit must change the displayed effective stats');
assert(nodes.simActiveParts.innerHTML.includes('爆裂抗性 <b>30.0</b>'),
 'swapping to FB uses its 30-point burst resistance');
changeBit.value='OWN-G3084-01';
for(const handler of nodes.simTeam0.events.change||[])handler({target:changeBit});
fire('simArenaType','change','plain');
assert.equal(arenaCalls.at(-1),'plain');
fire('simSettingsReset');
assert.equal(nodes.simArenaType.value,'xtreme');
assert.equal(nodes.simPower0.value,'10500');
assert.equal(nodes.simPower0Number.value,'10500');
fire('simPower0','input','14000');
assert.equal(nodes.simPower0Number.value,'14000');
assert.equal(nodes.simPower0Display.textContent,'14,000 SP');
fire('simPower0Number','change','12345');
assert.equal(nodes.simPower0.value,'12345');
fire('simSettingsReset');
assert.equal(nodes.simPower0Number.value,'10500');
assert.equal(nodes.simAngle1.value,'0');
assert.equal(nodes.simLauncher1.value,'winder');
assert.equal(nodes.simMatchType.value,'1');
const beforeAnglePreviewMeshes=modelCalls.length;
fire('simAngle0','input','35');
assert(renderEvents.at(-1).lean>.4,'positive angle tilts preview');
fire('simAngle0','input','-35');
assert(renderEvents.at(-1).lean<-.4,'negative angle tilts preview');
assert.equal(modelCalls.length,beforeAnglePreviewMeshes,'slider moves should not rebuild 3D geometry');
fire('simAngle0','input','0');
const beforeModels=modelCalls.length;
const changed={value:'OWN-G3084-03',dataset:{team:'0',index:'0',part:'blade'}};
changed.closest=()=>changed;
for(const handler of nodes.simTeam0.events.change||[])handler({target:changed});
assert(modelCalls.length>beforeModels,'change selected blade updates scene');
assert(nodes.simActiveParts.innerHTML.includes('Crest Leon'));
fire('simStart');
assert(Number(nodes.simSeed.value)>=1,'starting an auto-seeded match records its seed');
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
for(let i=0;i<320&&frames.length;i++){
 const cb=frames.shift();now+=16;cb(now);
}
assert(renderEvents.some(r=>r.coast>=4),
 'winner should keep spinning smoothly after the score has appeared');
fire('simMatchType','change','3');
assert.equal((nodes.simTeam0.innerHTML.match(/sim-build-card/g)||[]).length,3);
assert.equal((nodes.simTeam1.innerHTML.match(/sim-build-card/g)||[]).length,3);
console.log(JSON.stringify({
 passed:true,stadiumSwap:arenaCalls.includes('plain'),reset:true,
 newBladePreview:true,finishBeforeScoring:true,visualFrame,scoredFrame,threeDeck:true
},null,2));
