/* BEYBLADE X V1 simulation controller. Computation and graphics run separately. */
(function(root){
'use strict';
const C=root.BBX_SIM_CORE,V=root.BBX_SIM_VIEW,api=root.BBX_COLLECTION_API,abilities=root.BBX_PART_STATS;
const $=id=>document.getElementById(id);
if(!C||!V||!api||!abilities){const e=$('simMessage');if(e)e.textContent="模擬器缺少收藏或能力資料。";return}
const clean=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
  return '<option value="'+clean(b.id)+'"'+(b.id===selected?' selected':'')+(disabled?' disabled':'')+'>'+clean(b.name+(part==='ratchet'?' / '+b.ratchet:part==='bit'?' / '+b.bit:part==='lockChip'?' / '+b.lockChip:part==='mainBlade'?' / '+b.mainBlade:part==='assistBlade'?' / '+b.assistBlade:''))+'</option>';
 }).join('');
}
function card(team,index){
 const b=selections[team][index],type=b.mode==='cx';
 const sub=(label,field,list,key)=>'<label>'+label+'<select data-team="'+team+'" data-index="'+index+'" data-part="'+field+'">'+options(list,b[field],key)+'</select></label>';
 return '<article class="sim-build-card"><div class="sim-build-title"><strong>'+(team===0?'我方':'對手')+'・'+(index+1)+' 號</strong><span>原廠能力資料</span></div>'+
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
 const partNames={blade:'戰刃',lockChip:'紋章',mainBlade:'主刃',assistBlade:'輔助刃',ratchet:'固鎖',bit:'軸心'};
 const statNum=value=>Number(value||0).toFixed(1);
 const content=specs.map((spec,i)=>{
  if(!spec)return '';
  const images=viewer.getVisuals(spec);
  const effective='<div class="sim-stat-grid" aria-label="目前配置實際參與對戰的能力">'+
   statNames.map(([label,key])=>'<span>'+clean(label)+' <b>'+statNum(spec.vector[key])+'</b></span>').join('')+'</div>';
  const source='<details class="sim-part-stats"><summary>查看各零件原始數值</summary>'+
   (spec.partStats||[]).map(p=>'<div class="sim-part-stat-row"><b>'+clean(partNames[p.part]||p.part)+'</b> '+
    statNames.map(([label,key])=>clean(label)+':'+statNum(p[key])).join(' / ')+
    (p.part==='ratchet'?' / 高度:'+statNum(p.height):'')+'</div>').join('')+'</details>';
  return '<div class="sim-visual-side"><strong>'+(i===0?'我方':'對手')+'：'+clean(spec.name)+'</strong>'+
   '<div class="sim-visual-pieces">'+images.map(p=>'<div class="sim-piece-preview">'+
    (p.image?'<img src="'+clean(p.image)+'" alt="'+clean(p.name)+'" loading="lazy" onerror="this.style.visibility=\'hidden\'">':'<div class="sim-part-empty">尚無圖片</div>')+
    '<span>'+clean(p.name)+'</span><small>'+clean(p.value)+'</small></div>').join('')+'</div>'+
    effective+source+'</div>';
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
 $('simPower'+i+'Display').textContent=value.toLocaleString('zh-TW')+' SP';
 if(runtime)clearMatch('發射力道已變更，請重新開始。');
}
function settings(){
 return {
  seed:(Math.trunc(Number($('simSeed').value))||966)>>>0,
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
  battle.finish==='burst'?'爆裂勝利 +2':battle.finish==='spin'?'迴轉勝利 +1':'平手';
 if(winner!==null)runtime.points[winner]+=battle.points;
 runtime.history.push({round:runtime.round+1,winner,finish:battle.finish,points:battle.points,
  collisions:battle.collisionCount,railEvents:battle.railCount,seed:battle.seed,seconds:battle.elapsed});
 if(winner!==null)runtime.deckIndex++;
 runtime.complete=Math.max(...runtime.points)>=4||runtime.round>=23;
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
 report((idx+1)+' 號陀螺從左右半場上方投放，落點由亂數種子決定。');
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
$('simNext').addEventListener('click',()=>{
 if(!runtime||runtime.complete||!runtime.battle?.done)return;
 runtime.round++;beginRound();
});
$('simPause').addEventListener('click',()=>{
 if(!runtime?.battle||runtime.battle.done)return;
 runtime.paused=!runtime.paused;$('simPause').textContent=runtime.paused?'繼續':'暫停';
 audio?.update?.(runtime.battle.tops,runtime.paused);
});
$('simReset').addEventListener('click',()=>clearMatch('已清空。種子與設定不變，可再次重現結果。'));
$('simMatchType').addEventListener('change',()=>{
 renderTeams();clearMatch('已切換'+$('simMatchType').value+'對'+$('simMatchType').value+'模式。');
});
$('simArenaType').addEventListener('change',()=>{
 viewer.setArena($('simArenaType').value);
 clearMatch('場地已切換。畫面及物理參數已同步，請重新開始。');
});
for(const id of ['simSeed','simLauncher0','simLauncher1'])$(id).addEventListener('change',()=>{
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
 $('simSpeed').value='1';
 for(const i of [0,1]){
  $('simLauncher'+i).value='winder';
  $('simPower'+i).value='10500';
  $('simPower'+i+'Number').value='10500';
  $('simAngle'+i).value='0';
  $('simPower'+i+'Display').textContent='10,500 SP';
  $('simAngle'+i+'Display').textContent='0°';
 }
 renderTeams();
 clearMatch('已重置對戰形式、場地、發射器、SP 力道、角度、種子與播放速度。自訂零件保留。');
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
