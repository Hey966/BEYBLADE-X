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
const viewer=V.create($('simArena'),$('simRenderStatus'));
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
 clearMatch('配置已變更。請重新開始模擬。');
});
function settings(){
 return {
  seed:(Math.trunc(Number($('simSeed').value))||966)>>>0,
  arena:$('simArenaType').value,
  rail:$('simArenaType').value==='xtreme',
  launch:[0,1].map(i=>({power:Number($('simPower'+i).value),
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
 stopAnimation();runtime=null;showed=null;updateScore();
 $('simNext').disabled=true;$('simPause').disabled=true;$('simPause').textContent='暫停';
 $('simEvents').innerHTML='';
 if(message)report(message);
 viewer.render(null);
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
 runtime.complete=Math.max(...runtime.points)>=4||runtime.round>=23;
 if(runtime.complete){
  const finalWinner=runtime.points[0]>runtime.points[1]?'我方':runtime.points[1]>runtime.points[0]?'對手':'平手';
  report('本場 '+(winner===null?'平手':winner===0?'我方':'對手')+'：'+name+'。比賽完成：'+finalWinner+'。');
 }else report('本場 '+(winner===null?'平手':winner===0?'我方':'對手')+'：'+name+'。請按下一回合。');
 $('simNext').disabled=runtime.complete;
 $('simPause').disabled=true;
 $('simPause').textContent='暫停';
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
   if(b.done){viewer.render(b);showFinal(b);return}
  }
  viewer.render(b);
  $('simTime').textContent=fmt(b.elapsed)+'s / 33.0s（模型時間）';
  if(b.events.length!==runtime.logged){runtime.logged=b.events.length;renderEvents(b.events)}
  playFrame(token,now);
 });
}
function beginRound(){
 if(!runtime||runtime.complete)return;
 const idx=runtime.round%runtime.teams[0].length,conf=runtime.opts;
 const seed=(conf.seed+Math.imul(runtime.round+1,0x9E3779B1))>>>0;
 runtime.battle=C.createBattle(runtime.teams[0][idx],runtime.teams[1][idx],{
  seed,arena:conf.arena,rail:conf.rail,launch:conf.launch,record:true
 });
 runtime.paused=false;runtime.accumulator=0;runtime.logged=0;
 $('simNext').disabled=true;$('simPause').disabled=false;$('simPause').textContent='暫停';
 viewer.render(runtime.battle);updateScore();
 report((idx+1)+' 號陀螺進場。物理演算進行中。');
 const token=++frameToken;playFrame(token,performance.now());
}
function start(){
 try{
  const teams=toDecks(),opts=settings();
  clearMatch();
  runtime={teams,opts,points:[0,0],round:0,history:[],complete:false};
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
});
$('simReset').addEventListener('click',()=>clearMatch('已清空。種子與設定不變，可再次重現結果。'));
$('simMatchType').addEventListener('change',()=>{
 renderTeams();clearMatch('已切換'+$('simMatchType').value+'對'+$('simMatchType').value+'模式。');
});
for(const id of ['simPower0','simPower1','simAngle0','simAngle1'])$(id).addEventListener('input',()=>{
 $(id+'Display').textContent=$(id).value+(id.includes('Angle')?'°':'%');
});
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
renderTeams();clearMatch('第一版採能力數值推估。請選擇兩隊配件、發射力與場地。');
})(typeof window!=='undefined'?window:this);
