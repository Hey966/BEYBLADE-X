/* BEYBLADE X V1 simulation controller. Computation and graphics run separately. */
(function(root){
'use strict';
const C=root.BBX_SIM_CORE,V=root.BBX_SIM_VIEW,api=root.BBX_COLLECTION_API,abilities=root.BBX_PART_STATS;
const $=id=>document.getElementById(id);
if(!C||!V||!api||!abilities){const e=$('simMessage');if(e)e.textContent="模擬器缺少收藏或能力資料。";return}
const clean=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bitLabel=(code,owner)=>root.BBX_BIT_TYPES?.label?.(code,owner)||String(code??'');
const bitSuffix=(code,owner)=>root.BBX_BIT_TYPES?.suffix?.(code,owner)||'';
const bladeLabel=(code,owner,kind='blade')=>root.BBX_BLADE_TYPES?.label?.(code,owner,kind)||String(code??'');
const bladeSuffix=(code,owner,kind='blade')=>root.BBX_BLADE_TYPES?.suffix?.(code,owner,kind)||'';
const bladeKinds=new Set(['blade','mainBlade','assistBlade']);
const bladeFrom=(owner,kind)=>bladeLabel(api.getBey(owner)?.[kind],owner,kind);
const beys=api.getBeys().filter(b=>abilities.beys?.[b.id]?.parts?.ratchet&&abilities.beys?.[b.id]?.parts?.bit);
const cx=beys.filter(b=>b.system==='CX');
const choose=(p,b,valid=true)=>'<option value="'+clean(p)+'"'+(String(p)===String(b)?' selected':'')+(valid?'':' disabled')+'>'+clean(beys.find(x=>x.id===p)?.name||p)+'</option>';
const first=["OWN-G3084-01","OWN-G3084-03","OWN-G3084-02"];
const second=["OWN-G3393-01","OWN-G3393-02","OWN-G3393-03"];
const buildDefault=id=>({mode:'whole',blade:id,chip:cx[0]?.id||'',main:cx[0]?.id||'',assist:cx[0]?.id||'',ratchet:id,bit:id});
const selections=[first.map(buildDefault),second.map(buildDefault)];
let runtime=null,showed=null,frameToken=0,frameRequest=0,batchCancel=false,latestBatch=null;
const viewer=V.create($('simArena'),$('simRenderStatus'),api);
const audio=root.BBX_SIM_AUDIO?.create?.()||null;
function syncSoundButton(){
 const on=audio?.isEnabled?.()!==false;
 const b=$('simSoundToggle');
 b.textContent=on?'音效：開啟':'音效：關閉';
 b.setAttribute?.('aria-pressed',String(on));
}
function options(ids,selected,part){
 return ids.map(b=>{
  const disabled=!abilities.beys?.[b.id]?.parts?.[part]?.available;
  return '<option value="'+clean(b.id)+'"'+(b.id===selected?' selected':'')+(disabled?' disabled':'')+'>'+clean(b.name+(part==='blade'?bladeSuffix(b.blade,b.id):'')+(part==='ratchet'?' / '+b.ratchet:part==='bit'?' / '+bitLabel(b.bit,b.id):part==='lockChip'?' / '+b.lockChip:part==='mainBlade'?' / '+bladeLabel(b.mainBlade,b.id,'mainBlade'):part==='assistBlade'?' / '+bladeLabel(b.assistBlade,b.id,'assistBlade'):''))+'</option>';
 }).join('');
}
function card(team,index){
 const b=selections[team][index],type=b.mode==='cx';
 const sub=(label,field,list,key)=>'<label>'+label+'<select data-team="'+team+'" data-index="'+index+'" data-part="'+field+'">'+options(list,b[field],key)+'</select></label>';
 return '<article class="sim-build-card"><div class="sim-build-title"><strong>'+(team===0?'我方':'對手')+'・'+(index+1)+' 號</strong><span>發售版本能力資料</span></div>'+
  '<label>上層形式<select data-team="'+team+'" data-index="'+index+'" data-part="mode"><option value="whole"'+(!type?' selected':'')+'>BX／UX／CX 原廠完整戰刃</option><option value="cx"'+(type?' selected':'')+'>CX 模組自訂</option></select></label>'+
  (type?sub('CX 鎖定紋章','chip',cx,'lockChip')+sub('CX 主刃','main',cx,'mainBlade')+sub('CX 輔助刃','assist',cx,'assistBlade'):
   sub('原廠戰刃','blade',beys,'blade'))+
  sub('固鎖 Ratchet','ratchet',beys,'ratchet')+sub('軸心 Bit','bit',beys,'bit')+'</article>';
}
function renderTeams(){
 const size=Number($('simMatchType').value);
 for(const team of [0,1]){
  $('simTeam'+team).innerHTML=Array.from({length:size},(_,i)=>card(team,i)).join('');
 }
 $('simDeckLabel').textContent=size===3?'依序出戰 1、2、3 號。先得到 4 分獲勝。':'雙方固定一顆陀螺，逐回合累積得分。';
}
for(const team of [0,1])$('simTeam'+team).addEventListener('change',e=>{
 const node=e.target.closest('[data-part]');if(!node)return;
 const side=Number(node.dataset.team),i=Number(node.dataset.index),field=node.dataset.part;
 const b=selections[side]?.[i];if(!b||!Object.prototype.hasOwnProperty.call(b,field))return;
 b[field]=node.value;
 if(field==='mode')renderTeams();
 clearMatch('零件已更改。畫面將顯示所選戰刃與配件，請重新開始。');
});
let previewSpecs=[null,null];
function buildVisualPreview(specs,preview=true){
 previewSpecs=specs;
 viewer.setArena($('simArenaType').value);
 viewer.setBuilds(specs);
 const statNames=[['攻擊','attack'],['防禦','defense'],['持久','stamina'],['衝刺','dash'],['爆裂抗性','burst']];
 const partNames={blade:'戰刃',factoryBlade:'完整戰刃（採用）',lockChip:'紋章',mainBlade:'主刃',assistBlade:'輔助刃',ratchet:'固鎖',bit:'軸心'};
 const statNum=value=>Number(value||0).toFixed(1);
 const tipNames={flat:'平底',round:'球底',sharp:'針底',hybrid:'混合接觸',unknown:'未核對'};
 const sourceNames={wikiBlade:'戰刃',wikiRatchet:'固鎖',wikiBit:'軸心',
  wikiChip:'紋章',wikiMain:'主刃',wikiAssist:'輔助刃',
  wikiMetalOver:'金屬刃與超越刃',wikiMetalRage:'狂怒金屬刃',
  wikiOverFlow:'流速超越刃',beybaseScale:'實秤樣本'};
 const content=specs.map((spec,i)=>{
  if(!spec)return '';
  const images=viewer.getVisuals(spec);
  const effective='<div class="sim-stat-grid" aria-label="目前配置實際參與對戰的能力">'+
   statNames.map(([label,key])=>'<span>'+clean(label)+' <b>'+statNum(spec.vector[key])+'</b></span>').join('')+'</div>';
  const statHeading=p=>p.part==='bit'?'軸心 '+bitLabel(spec.tipProfile?.code,spec.config.bit):p.part==='factoryBlade'?'完整戰刃 '+bladeFrom(p.owner,'blade'):bladeKinds.has(p.part)?(partNames[p.part]||p.part)+' '+bladeFrom(p.owner,p.part):(partNames[p.part]||p.part);
  const source='<details class="sim-part-stats"><summary>查看各零件來源數值</summary>'+
   (spec.partStats||[]).map(p=>'<div class="sim-part-stat-row"><b>'+clean(statHeading(p))+'</b> '+
    statNames.map(([label,key])=>clean(label)+':'+statNum(p[key])).join(' / ')+
    (p.part==='ratchet'?' / 高度:'+statNum(p.height):'')+
    ' / 同型號重量:'+(p.weightG===null||p.weightG===undefined?'未確認':
     Number(p.weightG).toFixed(1)+' g'+
     ((p.weightMethod||'').includes('derived')||(p.weightMethod||'').includes('sum')?'（組件推算）':''))+
    (p.sourceUrl?.startsWith('https://')?'<div class="sim-source-links"><a href="'+clean(p.sourceUrl)+'" target="_blank" rel="noopener noreferrer">查看此零件公開能力目錄</a>（非官方實測值）</div>':'')+
    (p.verification?'<div class="sim-source-links">數值已核對 Hasbro 包裝：'+
     '<a href="'+clean(p.verification.sourceImage)+'" target="_blank" rel="noopener noreferrer">查看包裝背面</a>'+
     '（原目錄攻'+statNum(p.verification.originalCatalog.attack)+
     '／防'+statNum(p.verification.originalCatalog.defense)+
     '／持'+statNum(p.verification.originalCatalog.stamina)+'）</div>':'')+
    '</div>').join('')+'</details>';
  const measured=spec.totalWeightG!==null&&Number.isFinite(spec.totalWeightG);
  const derived=(spec.massParts||[]).some(p=>(p.method||'').includes('derived')||
   (p.method||'').includes('sum'));
  const weight='<div class="sim-weight-line">'+
   (measured?'參考整顆重量：'+Number(spec.totalWeightG).toFixed(1)+
     ' g（'+(derived?'含組件推算；':'')+'非本顆實秤）':
    '參考整顆重量：尚缺資料，採既有質量代理值')+
   '；戰刃：'+clean(spec.config.mode==='cx'?'CX 混搭（主刃／輔助刃分別標示）':bladeFrom(spec.config.blade,'blade'))+
   '；軸心：'+clean(bitLabel(spec.tipProfile?.code,spec.config.bit))+'；接觸型態：'+clean(tipNames[spec.tipProfile?.tip]||'未知')+
   '</div>';
  const sourceIds=[...new Set((spec.massParts||[]).map(row=>row.sourceId).filter(Boolean))];
  const sourceLinks=sourceIds.filter(id=>root.BBX_PART_PHYSICS?.sources?.[id]&&sourceNames[id])
   .map(id=>'<a href="'+clean(root.BBX_PART_PHYSICS.sources[id])+'" target="_blank" rel="noopener noreferrer">'+
    clean(sourceNames[id])+'</a>');
  const citations=sourceLinks.length?'<div class="sim-source-links">參考資料：'+sourceLinks.join(' / ')+'</div>':'';
  return '<div class="sim-visual-side"><strong>'+(i===0?'我方':'對手')+'：'+clean(spec.name+bitSuffix(spec.tipProfile?.code,spec.config.bit))+'</strong>'+
   '<div class="sim-visual-pieces">'+images.map(p=>'<div class="sim-piece-preview">'+
    (p.image?'<img src="'+clean(p.image)+'" alt="'+clean(p.name)+'" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'<div class="sim-part-empty">尚無圖片</div>')+
    '<span>'+clean(p.name)+'</span><small>'+clean(p.kind==='bit'?bitLabel(p.value,p.owner):bladeKinds.has(p.kind)?bladeLabel(p.value,p.owner,p.kind):p.value)+'</small></div>').join('')+'</div>'+
    effective+weight+citations+source+(spec.flags?.length?'<div class="sim-build-flags">'+spec.flags.map(clean).join('；')+'</div>':'')+'</div>';
 }).join('');
 $('simActiveParts').innerHTML=content;
 if(preview)renderLaunchPreview();
}
function renderLaunchPreview(){
 if(runtime)return;
 const state={done:false,terminal:null,tops:previewSpecs.map((b,i)=>{
   if(!b)return null;
   const launchAngle=(Number($('simAngle'+i)?.value)||0)*Math.PI/180;
   return{
    x:i===0?-.42:.42,y:i===0?-.05:.05,heading:0,spin:0,wobble:0,
    tilt:launchAngle*.95,tiltDir:i===0?0:Math.PI,launchAngle,
    height:0,landed:true,railCooldown:0,model:b,side:i
   };
  })};
 viewer.render(state);
}
function previewCurrent(){
 try{
  const db={beys:api.getBeys()},specs=[0,1].map(i=>C.makeBuild(selections[i][0],db,abilities));
  buildVisualPreview(specs,true);
 }catch(error){
  viewer.setArena($('simArenaType').value);
  viewer.setBuilds([null,null]);
  $('simActiveParts').textContent='目前配置尚未完成，請檢查零件。';
  viewer.render(null);
 }
}
function showTerminalStatus(battle){
 const label=battle.finish==='spin'?'停轉':battle.finish==='burst'?'爆裂':
  battle.finish==='over'?'出界':battle.finish==='extreme'?'進入極限區':'平手';
 const loser=battle.terminal?.loser;
 const winner=battle.winner;
 const side=winner===0?'我方':winner===1?'對手':'雙方';
 const loserSide=loser===0?'我方':loser===1?'對手':'雙方';
 $('simFinishOverlay').textContent=side+(winner===null?'平手':'勝利')+' · '+loserSide+label;
 $('simFinishOverlay').hidden=false;
 $('simTime').textContent=fmt(battle.elapsed)+'s / '+fmt(C.MAX_TIME)+'s（模型時間）';
}

const spValue=value=>Math.max(0,Math.min(14000,Math.round(Number(value)||0)));
function syncPower(i,source){
 const value=spValue($(source==='number'?'simPower'+i+'Number':'simPower'+i).value);
 $('simPower'+i).value=String(value);
 $('simPower'+i+'Number').value=String(value);
 $('simPower'+i+'Display').textContent=value.toLocaleString('zh-TW');
 if(runtime)clearMatch('模擬發射強度已變更，請重新開始。');
}
function settings(){
 // Randomize only initial conditions between new matches, never a finish.
 // Leave auto mode to replay the displayed seed with identical parts/power.
 const randomize=$('simSeedAuto')?.checked!==false;
 let seed=(Math.trunc(Number($('simSeed').value))||966)>>>0;
 if(randomize){
  seed=(Math.floor(Math.random()*4294967295)+1)>>>0;
  $('simSeed').value=String(seed);
 }
 return {
  seed,
  arena:$('simArenaType').value,
  rail:$('simArenaType').value==='xtreme',
  launch:[0,1].map(i=>({power:spValue($('simPower'+i+'Number').value),
   angle:Number($('simAngle'+i).value),type:$('simLauncher'+i).value}))
 };
}
function toDecks(){
 const count=Number($('simMatchType').value),teams=selections.map(side=>side.slice(0,count).map(b=>C.makeBuild(b, {beys:api.getBeys()},abilities)));
 teams.forEach(deck=>C.validateDeck(deck));
 return teams;
}
function report(message,bad=false){
 $('simMessage').textContent=message;
 $('simMessage').classList.toggle('sim-error',bad);
}
function fmt(n){return Number(n||0).toFixed(1)}
function updateScore(){
 if(!runtime){$('simScore').textContent='我方 0 : 0 對手';$('simRound').textContent='尚未開始';return}
 $('simScore').textContent='我方 '+runtime.points[0]+' : '+runtime.points[1]+' 對手';
 $('simRound').textContent=runtime.complete?'比賽結束':'第 '+(runtime.round+1)+' 回合・'+(runtime.teams.length===3?'3 on 3':'1 on 1');
}
function stopAnimation(){
 frameToken++;if(frameRequest)cancelAnimationFrame(frameRequest);
 frameRequest=0;
}
function clearMatch(message){
 audio?.stop?.();
 stopAnimation();runtime=null;showed=null;updateScore();
 $('simNext').disabled=true;$('simPause').disabled=true;$('simPause').textContent='暫停';
 $('simFinishOverlay').hidden=true;
 $('simEvents').innerHTML='';
 $('simTime').textContent='0.0s / '+fmt(C.MAX_TIME)+'s（模型時間）';
 if(message)report(message);
 previewCurrent();
}
function renderEvents(events){
 $('simEvents').innerHTML=(events||[]).slice(-7).reverse().map(e=>'<li><span>'+fmt(e.t)+'s</span> '+clean(e.message)+'</li>').join('');
}
function showFinal(battle){
 const winner=battle.winner;
 const name=battle.finish==='extreme'?'極限勝利 +3':battle.finish==='over'?'擊飛勝利 +2':
  battle.finish==='burst'?'爆裂勝利 +2':battle.finish==='spin'?'持久勝利 +1':'平手';
 if(winner!==null)runtime.points[winner]+=battle.points;
 runtime.history.push({round:runtime.round+1,winner,finish:battle.finish,points:battle.points,
  collisions:battle.collisionCount,railEvents:battle.railCount,seed:battle.seed,seconds:battle.elapsed});
 if(winner!==null)runtime.deckIndex++;
 runtime.complete=Math.max(...runtime.points)>=4;
 if(runtime.complete){
  const finalWinner=runtime.points[0]>runtime.points[1]?'我方':runtime.points[1]>runtime.points[0]?'對手':'平手';
  report('本場 '+(winner===null?'平手':winner===0?'我方':'對手')+'：'+name+'。比賽完成：'+finalWinner+'。');
 }else report('本場 '+(winner===null?'平手':winner===0?'我方':'對手')+'：'+name+'。請按下一回合。');
 $('simNext').disabled=runtime.complete;
 $('simPause').disabled=true;
 $('simPause').textContent='暫停';
 audio?.stop?.();
 if(runtime.complete)audio?.play?.('win',.75);
 renderEvents(battle.events);updateScore();
}
function playFrame(token,lastTime){
 if(token!==frameToken||!runtime||!runtime.battle)return;
 frameRequest=requestAnimationFrame(now=>{
  if(token!==frameToken||!runtime)return;
  const b=runtime.battle;
  if(!runtime.paused&&!b.done){
   const speed=Number($('simSpeed').value)||1;
   const elapsed=Math.min(.09,Math.max(0,(now-lastTime)/1000))*speed;
   runtime.accumulator+=elapsed;
   const steps=Math.min(55,Math.floor(runtime.accumulator/C.DT));
   if(steps){b.step(steps);runtime.accumulator-=steps*C.DT;}
  }
  $('simTime').textContent=fmt(b.elapsed)+'s / '+fmt(C.MAX_TIME)+'s（模型時間）';
  if(b.events.length!==runtime.logged){runtime.logged=b.events.length;renderEvents(b.events)}
  // Audio is triggered by NEW physics events. Visuals use the same event stream.
  for(let i=runtime.sounded||0;i<b.events.length;i++){
   const e=b.events[i];
   if(e.type==='hit')audio?.play?.('hit',Math.min(1.45,Math.max(.4,Number(e.strength)||.7)));
   else if(e.type==='land')audio?.play?.('land',.65);
   else if(e.type==='wall')audio?.play?.('hit',Math.min(.95,.40+Number(e.strength||0)));
   else if(e.type==='dash')audio?.play?.('dash',.8);
   else if(e.type==='finish')audio?.play?.(b.finish||'draw',1);
  }
  runtime.sounded=b.events.length;
  audio?.update?.(b.tops,runtime.paused||b.done);
  if(b.done){
   if(runtime.finishStarted===null){
    runtime.finishStarted=now;
    showTerminalStatus(b);
    report('已判定'+(b.winner===0?'我方':b.winner===1?'對手':'雙方')+
     (b.finish==='spin'?'停轉結束':b.finish==='over'?'出界結束':b.finish==='extreme'?'極限出界':b.finish==='burst'?'爆裂結束':'平手')+'。正在呈現終結動作，再更新分數。');
   }
   const coastDuration=Number(V.COAST_DURATION)||4.5;
   const coastAge=Math.min(coastDuration,(now-runtime.finishStarted)/1000);
   viewer.render(b,{finalAge:Math.min(1.2,coastAge),coastAge});
   // Points appear after the original finish effect. The remaining spin
   // continues to decelerate smoothly without pausing the battle or score.
   if(coastAge>=1.2&&!runtime.finalReported){
    runtime.finalReported=true;showFinal(b);
   }
   if(coastAge>=coastDuration)return;
  }else viewer.render(b);
  playFrame(token,now);
 });
}
function beginRound(){
 if(!runtime||runtime.complete)return;
 audio?.unlock?.();
 audio?.stop?.();
 audio?.play?.('launch',.9);
 const idx=runtime.deckIndex%runtime.teams[0].length,conf=runtime.opts;
 const seed=(conf.seed+Math.imul(runtime.round+1,0x9E3779B1))>>>0;
 runtime.battle=C.createBattle(runtime.teams[0][idx],runtime.teams[1][idx],{
  seed,arena:conf.arena,rail:conf.rail,launch:conf.launch,record:true
 });
 runtime.paused=false;runtime.accumulator=0;runtime.logged=0;runtime.sounded=0;runtime.lastCollisions=0;runtime.lastRails=0;runtime.finishStarted=null;runtime.finalReported=false;
 $('simFinishOverlay').hidden=true;
 buildVisualPreview([runtime.teams[0][idx],runtime.teams[1][idx]],false);
 $('simNext').disabled=true;$('simPause').disabled=false;$('simPause').textContent='暫停';
 viewer.render(runtime.battle);updateScore();
 report((idx+1)+' 號陀螺從左右半場上方投放。基準種子 '+conf.seed+'，本回合種子 '+seed+'。勝負由碰撞與配件判定。');
 const token=++frameToken;playFrame(token,performance.now());
}
function start(){
 try{
  const teams=toDecks(),opts=settings();
  clearMatch();
  runtime={teams,opts,points:[0,0],round:0,deckIndex:0,history:[],complete:false};
  beginRound();
 }catch(error){report(error.message,true)}
}
$('simStart').addEventListener('click',start);
for(const [id,preset] of [['simCameraReset','reset'],['simCameraTop','top'],['simCameraFront','front']]){
 $(id)?.addEventListener('click',()=>{
  if(!viewer.setCameraView?.(preset))
   report('目前為 2D 備援畫面。360° 旋轉需要瀏覽器支援 WebGL 3D。',true);
 });
}
$('simNext').addEventListener('click',()=>{
 if(!runtime||runtime.complete||!runtime.battle?.done)return;
 runtime.round++;beginRound();
});
$('simPause').addEventListener('click',()=>{
 if(!runtime?.battle||runtime.battle.done)return;
 runtime.paused=!runtime.paused;$('simPause').textContent=runtime.paused?'繼續':'暫停';
 audio?.update?.(runtime.battle.tops,runtime.paused);
});

/* Draw from actual owned and numerically available parts.
 * Never treat the opponent as consuming our physical inventory.
 * For a 3-top deck, use the simulator's official same-model checks. */
const randomPools=()=>{
 const byKind=part=>beys.filter(b=>abilities.beys?.[b.id]?.parts?.[part]?.available).map(b=>b.id);
 return {
  blade:byKind('blade'),
  ratchet:byKind('ratchet'),
  bit:byKind('bit'),
  chip:cx.filter(b=>abilities.beys?.[b.id]?.parts?.lockChip?.available).map(b=>b.id),
  main:cx.filter(b=>abilities.beys?.[b.id]?.parts?.mainBlade?.available).map(b=>b.id),
  assist:cx.filter(b=>abilities.beys?.[b.id]?.parts?.assistBlade?.available).map(b=>b.id)
 };
};
const randomPart=pool=>pool[Math.floor(Math.random()*pool.length)]||'';
const visibleConfig=config=>config.mode==='cx'?
 ['cx',config.chip,config.main,config.assist,config.ratchet,config.bit].join('|'):
 ['whole',config.blade,config.ratchet,config.bit].join('|');
function randomDeck(count,previous,pools,db){
 const canCX=pools.chip.length&&pools.main.length&&pools.assist.length;
 if(!pools.blade.length||!pools.ratchet.length||!pools.bit.length)return null;
 const original=previous.slice(0,count).map(visibleConfig).join('::');
 for(let attempt=0;attempt<400;attempt++){
  const deck=Array.from({length:count},()=>{
   const mode=canCX&&Math.random()<.35?'cx':'whole';
   return {
    mode,
    blade:randomPart(pools.blade),
    chip:canCX?randomPart(pools.chip):'',
    main:canCX?randomPart(pools.main):'',
    assist:canCX?randomPart(pools.assist):'',
    ratchet:randomPart(pools.ratchet),
    bit:randomPart(pools.bit)
   };
  });
  if(deck.map(visibleConfig).join('::')===original)continue;
  try{
   const built=deck.map(x=>C.makeBuild(x,db,abilities));
   C.validateDeck(built);
   return deck;
  }catch(_error){/* retry with a new legal combination */}
 }
 return null;
}
function rerollMatch(){
 const count=Number($('simMatchType').value);
 const pools=randomPools(),db={beys:api.getBeys()};
 const left=randomDeck(count,selections[0],pools,db);
 const right=randomDeck(count,selections[1],pools,db);
 if(!left||!right){
  report('現有零件不足以產生符合 '+count+' 對 '+count+' 規則的隨機配置，原本配置已保留。',true);
  return;
 }
 for(const [i,deck] of [[0,left],[1,right]]){
  for(let k=0;k<deck.length;k++)selections[i][k]=deck[k];
 }
 // Cancel an in-progress batch, otherwise its old results could be shown for new parts.
 batchCancel=true;++runStamp;latestBatch=null;
 $('simBatchRun').disabled=false;
 $('simBatchCancel').disabled=true;
 $('simBatchDownload').disabled=true;
 $('simBatchBar').style.width='0%';
 $('simBatchProgress').textContent='已更換配件，請重新執行批次模擬。';
 $('simBatchOutput').textContent='新配置尚未執行批次模擬。';
 renderTeams();
 clearMatch('雙方已隨機重新搭配'+count+' 顆陀螺的戰刃、固鎖與軸心（含 CX 模組）。比分已清零，場地與發射設定保留。請按開始新對戰。');
}
$('simReset').addEventListener('click',rerollMatch);
$('simMatchType').addEventListener('change',()=>{
 renderTeams();clearMatch('已切換'+$('simMatchType').value+'對'+$('simMatchType').value+'模式。');
});
$('simArenaType').addEventListener('change',()=>{
 viewer.setArena($('simArenaType').value);
 clearMatch('場地已切換。畫面及物理參數已同步，請重新開始。');
});
$('simSeed')?.addEventListener('change',()=>{
 if($('simSeedAuto'))$('simSeedAuto').checked=false;
 clearMatch('已切換固定種子。相同配件與發射條件可重播相同結果。');
});
$('simSeedAuto')?.addEventListener('change',()=>{
 clearMatch($('simSeedAuto').checked?'下次新對戰會產生不同種子。':'已固定目前種子，可重現對戰。');
});
for(const id of ['simLauncher0','simLauncher1'])$(id).addEventListener('change',()=>{
 clearMatch('發射設定已變更，請重新開始。');
});
for(const i of [0,1]){
 $('simPower'+i).addEventListener('input',()=>syncPower(i,'range'));
 $('simPower'+i+'Number').addEventListener('change',()=>syncPower(i,'number'));
 $('simAngle'+i).addEventListener('input',()=>{
  $('simAngle'+i+'Display').textContent=$('simAngle'+i).value+'°';
  if(runtime)clearMatch('角度已變更，請重新開始。');
  else{renderLaunchPreview();report('已更新發射傾斜與移動方向預覽。');}
 });
}
$('simSettingsReset').addEventListener('click',()=>{
 $('simMatchType').value='1';
 $('simArenaType').value='xtreme';
 $('simSeed').value='966';
 if($('simSeedAuto'))$('simSeedAuto').checked=true;
 $('simSpeed').value='1';
 for(const i of [0,1]){
  $('simLauncher'+i).value='winder';
  $('simPower'+i).value='10500';
  $('simPower'+i+'Number').value='10500';
  $('simAngle'+i).value='0';
  $('simPower'+i+'Display').textContent='10,500';
  $('simAngle'+i+'Display').textContent='0°';
 }
 renderTeams();
 clearMatch('已重置對戰設定。每次新對戰預設換種子；關閉此功能可重播。自訂零件保留。');
});
$('simSoundToggle')?.addEventListener('click',()=>{
 if(audio){
  audio.enable(!audio.isEnabled());
  if(audio.isEnabled())audio.unlock();
 }
 syncSoundButton();
});
$('simSoundVolume')?.addEventListener('input',()=>{
 const v=Math.max(0,Math.min(100,Number($('simSoundVolume').value)||0));
 $('simSoundVolumeDisplay').textContent=v+'%';
 audio?.volume?.(v/100);
});
syncSoundButton();

let runStamp=0;
function renderBatch(result){
 latestBatch=result;
 const total=result.trials,w=result.win,loss=result.loss,draw=result.draw;
 $('simBatchOutput').innerHTML='<div class="sim-batch-bars">'+
  [['我方',w,'friendly'],['對手',loss,'hostile'],['平手',draw,'neutral']].map(([label,num,kind])=>
   '<div><span>'+label+' '+num+' / '+total+'（'+(100*num/Math.max(1,total)).toFixed(1)+'%）</span>'+
   '<div class="sim-progress"><i class="'+kind+'" style="width:'+(100*num/Math.max(1,total))+'%"></i></div></div>').join('')+'</div>'+
  '<p>平均碰撞 '+fmt(result.collisions/Math.max(1,total))+' 次；平均 Xtreme Line 觸發 '+fmt(result.rails/Math.max(1,total))+' 次／完整比賽。</p>'+
  '<p>終結方式：'+Object.entries(result.finishes).map(([k,v])=>clean(k)+' '+v+' 次').join('、')+'</p>'+
  '<p>這是模型模擬頻率，不是實戰測得的勝率。</p>';
 $('simBatchDownload').disabled=false;
}
$('simBatchRun').addEventListener('click',async()=>{
 let teams;
 try{teams=toDecks()}catch(e){report(e.message,true);return}
 if(batchCancel===false&&$('simBatchRun').disabled)return;
 batchCancel=false;latestBatch=null;
 const opts=settings(),count=Number($('simBatchCount').value);
 const base=opts.seed;
 const result={version:C.VERSION,trials:0,target:count,win:0,loss:0,draw:0,collisions:0,rails:0,finishes:{},model:"uncalibrated",mode:teams[0].length===3?'3v3':'1v1',
  seed:base,settings:opts,teamLabels:teams.map(t=>t.map(b=>b.name))};
 $('simBatchRun').disabled=true;$('simBatchCancel').disabled=false;$('simBatchDownload').disabled=true;
 const stamp=++runStamp;
 try{
  while(result.trials<count&&!batchCancel&&runStamp===stamp){
   for(let z=0;z<Math.min(4,count-result.trials);z++){
    const seed=(base+Math.imul(result.trials+1,0x85EBCA6B))>>>0;
    const sim=C.simulateMatch(teams[0],teams[1],{...opts,seed});
    result.trials++;
    if(sim.winner===0)result.win++;else if(sim.winner===1)result.loss++;else result.draw++;
    for(const b of sim.rounds){
     result.finishes[b.finish]=(result.finishes[b.finish]||0)+1;
     result.collisions+=b.collisions;result.rails+=b.rails;
    }
   }
   $('simBatchProgress').textContent='已完成 '+result.trials+' / '+count+' 場模型比賽';
   $('simBatchBar').style.width=(result.trials/count*100).toFixed(1)+'%';
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  renderBatch(result);
  $('simBatchProgress').textContent=batchCancel?'已取消。保留 '+result.trials+' 場結果。':'批次模擬完成：'+result.trials+' 場。';
 }catch(error){report('批次模擬失敗：'+error.message,true)}
 finally{$('simBatchRun').disabled=false;$('simBatchCancel').disabled=true;}
});
$('simBatchCancel').addEventListener('click',()=>{batchCancel=true});
$('simBatchDownload').addEventListener('click',()=>{
 if(!latestBatch)return;
 const blob=new Blob([JSON.stringify(latestBatch,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='BEYBLADE-X_simulation_'+latestBatch.seed+'.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
});
renderTeams();clearMatch('請選兩隊配件與發射設定。雙方從盤面上方落入各自半場，落地輕彈後自由對戰。');
})(typeof window!=='undefined'?window:this);
