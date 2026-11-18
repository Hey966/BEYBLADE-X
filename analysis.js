/* BEYBLADE X analytical extensions.
   Release-matched catalog values; transparent heuristic, NOT measured win rate. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const api = window.BBX_COLLECTION_API;
const db = window.BBX_PART_STATS;
if(!api) { console.error('Collection API unavailable'); return; }
const html = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roles={attack:'攻擊',defense:'防禦',stamina:'持久',balance:'平衡'};
const bitLabel=(code,owner)=>window.BBX_BIT_TYPES?.label?.(code,owner)||String(code??'');
const bitSuffix=(code,owner)=>window.BBX_BIT_TYPES?.suffix?.(code,owner)||'';
const partNames={blade:'戰刃 Blade',ratchet:'固鎖 Ratchet',bit:'軸心 Bit',lockChip:'鎖定紋章',mainBlade:'主刃',assistBlade:'輔助刃'};
const abilities=()=>db?.beys||{};
const getBey=id=>api.getBey(id);
const rows=()=>api.getBeys().filter(b=>abilities()[b.id]?.parts);
const info=(owner,part)=>abilities()[owner]?.parts?.[part]||null;
const stats=(owner,part)=>info(owner,part)?.stats||{};
const v=(object,key)=>Number.isFinite(object?.[key])?object[key]:0;
const s3=a=>({attack:v(a,'attack'),defense:v(a,'defense'),stamina:v(a,'stamina')});
const add=(...objects)=>objects.reduce((out,x)=>({attack:out.attack+v(x,'attack'),defense:out.defense+v(x,'defense'),stamina:out.stamina+v(x,'stamina')}),{attack:0,defense:0,stamina:0});
const statusText=(out)=>out.length?out.join('、'):'沒有足夠數值';
function partPicture(owner,kind){return getBey(owner)?.partImages?.[kind]||''}
function showPart(owner,kind){
 const bey=getBey(owner),r=info(owner,kind),dlg=$('abilityDialog');
 if(!dlg)return;
 const pane=$('abilityContent');
 if(!r){
  pane.innerHTML='<div class="ability-sheet"><h2>尚未建立能力紀錄</h2><p>這個配件尚未核對發售版本與能力資料，不能推算數值。</p></div>';
  dlg.showModal();return;
 }
 const vals=[['attack','攻擊'],['defense','防禦'],['stamina','持久'],['dash','X 衝刺'],['burst','爆裂抗性']];
 const lines=vals.map(([key,label])=>{
   const present=Number.isFinite(r.stats?.[key]);
   const n=present?r.stats[key]:null;
   return '<div class="ability-row"><span>'+label+'</span><div class="ability-track"><i style="width:'+Math.max(0,Math.min(100,n??0))+'%"></i></div><strong>'+(present?html(n):'—')+'</strong></div>';
 }).join('');
 const picture=partPicture(owner,kind);
 const topstat=['attack','defense','stamina'].filter(k=>Number.isFinite(r.stats?.[k])).sort((a,b)=>v(r.stats,b)-v(r.stats,a))[0];
 const desc=kind==='bit'?'軸心主要影響移動方式、X 衝刺與爆裂抗性。組裝類型依軸心分類。':
  kind==='ratchet'?'固鎖主要影響高度、接觸方式與整體穩定性。':
  kind==='lockChip'?'鎖定紋章是 CX 的中心零件。零分數不代表沒有機械作用。':
  kind==='assistBlade'?'CX 輔助刃與主刃搭配，改變輪廓、接觸及攻防特性。':
  kind==='mainBlade'?'CX 主刃提供主要接觸輪廓。與輔助刃共同構成完整戰刃。':
  '戰刃決定主要重量分布、接觸輪廓與碰撞效果。';
 pane.innerHTML='<div class="ability-sheet">'+
  '<span class="eyebrow">COMPONENT PROFILE</span><h2>'+html((r.name||bey?.name||'配件能力')+(kind==='bit'?bitSuffix(bey?.bit,owner):''))+'</h2>'+
  '<p>'+html(partNames[kind]||kind)+' · 來源：'+html(bey?.name||owner)+'</p>'+
  (picture?'<img class="ability-image" src="'+html(picture)+'" alt="'+html(r.name)+'">':'')+
  '<div class="ability-metadata"><span>類型：'+html(roles[r.type]||'未標示')+'</span>'+
  (Number.isFinite(r.stats?.height)&&r.stats.height>0?'<span>高度參數：'+html(r.stats.height)+'</span>':'')+
  (Number.isFinite(r.weightG)?'<span>重量：'+html(r.weightG)+' g</span>':'')+'</div>'+
  '<div class="ability-bars">'+lines+'</div>'+
  '<p class="ability-explain">'+html(desc)+(topstat&&v(r.stats,topstat)>0?' 這個配件的主要數值偏向'+html(roles[topstat])+'。':'')+'</p>'+
  '<p class="analysis-note">圖表為來源資料所列數值，不是勝率。不同零件類別的數值不能直接等同實戰表現。</p>'+
  (r.sourceUrl?.startsWith('https://')?'<a class="ability-source" target="_blank" rel="noopener noreferrer" href="'+html(r.sourceUrl)+'">查看原始零件資料 ↗</a>':'')+'</div>';
 dlg.showModal();
}
$('closeAbility')?.addEventListener('click',()=>$('abilityDialog').close());
$('abilityDialog')?.addEventListener('click',e=>{if(e.target.id==='abilityDialog')e.target.close()});
window.BBX_ANALYSIS={showPart};
function showSource(owner,kind){
 const bey=getBey(owner);
 const dlg=$('sourceDialog'),content=$('sourceContent');
 if(!dlg||!content)return;
 if(!bey){
  content.innerHTML='<div class="source-sheet"><h2>找不到原始收藏資料</h2><p>這個零件沒有可識別的來源陀螺。</p></div>';
  dlg.showModal();return;
 }
 const pkg=api.getPackage?.(owner);
 const market=pkg?.market==='US'?'美版':pkg?.market==='JP'?'日版':'未登記';
 const photo=versionedPhoto(bey.displayImagePath||bey.partImages?.blade||'');
 const part=info(owner,kind);
 const label=partNames[kind]||kind;
 const specs=[
   ['原廠戰刃',bey.blade],
   ['原廠固鎖',bey.ratchet],
   ['原廠軸心',bitLabel(bey.bit,owner)],
   ['迴旋方向',bey.spinDirection==='L'?'左迴旋':'右迴旋']
 ];
 if(bey.system==='CX')specs.push(
   ['鎖定紋章',bey.lockChip],
   ['主刃',bey.mainBlade],
   ['輔助刃',bey.assistBlade]
 );
 content.innerHTML='<div class="source-sheet"><span class="eyebrow">ORIGINAL BEYBLADE</span>'+
  '<h2>'+html(bey.name)+'</h2>'+
  '<p class="source-subtitle">'+html(bey.system)+' · '+html(market)+' · '+html(pkg?.manufacturer||'')+'</p>'+
  (photo?'<div class="source-photo-frame"><img src="'+html(photo)+'" alt="'+html(bey.name)+' 商品圖" loading="lazy"></div>':'')+
  '<div class="source-identified"><strong>你點選的零件</strong><p>'+html(label)+'：'+html((part?.name||'原廠零件')+(kind==='bit'?bitSuffix(bey.bit,owner):''))+'</p></div>'+
  '<div class="source-original-specs">'+specs.filter(([,value])=>value).map(([name,value])=>'<div><span>'+html(name)+'</span><strong>'+html(value)+'</strong></div>').join('')+'</div>'+
  '<p class="source-subtitle">來源套組：'+html(pkg?.title||bey.packageId||'未登記')+
  (pkg?.productCode?'（'+html(pkg.productCode)+'）':'')+'</p>'+
  '<p class="source-subtitle">收藏編號：'+html(bey.id)+'</p>'+
  '<p class="source-disclaimer">圖片為原廠來源陀螺參考圖，不代表目前實際組裝狀態。</p></div>';
 dlg.showModal();
}
$('closeSource')?.addEventListener('click',()=>$('sourceDialog').close());
$('sourceDialog')?.addEventListener('click',event=>{
 if(event.target.id==='sourceDialog')event.target.close();
});
for(const resultId of ['autoResults','counterResults']){
 $(resultId)?.addEventListener('click',event=>{
  const target=event.target.closest('[data-source-owner][data-source-kind]');
  if(target)showSource(target.dataset.sourceOwner,target.dataset.sourceKind);
 });
}

if(!db?.beys){
 for(const id of ['autoResults','counterResults'])if($(id))$(id).textContent='能力資料尚未成功載入。請確認 data/part-abilities.js 是否已部署。';
 return;
}
const roleOf=(part)=>part?.type in roles?part.type:'balance';
function validUnit(b,part){
 const rec=info(b.id,part);
 return !!(rec?.available&&rec.stats&&['attack','defense','stamina'].some(k=>Number.isFinite(rec.stats[k])));
}
function allUnits(kind){
 return rows().filter(b=>validUnit(b,kind)).map(b=>({owner:b.id,name:b.name,code:kind==='ratchet'?b.ratchet:kind==='bit'?b.bit:b.blade,data:info(b.id,kind),stats:stats(b.id,kind)}));
}
const ratchets=()=>allUnits('ratchet');
const bits=()=>allUnits('bit');
function bladePool(){
 const list=rows(),base=[],chips=[],mains=[],assists=[];
 for(const b of list){
  const d=info(b.id,'blade');
  if(b.system!=='CX'&&validUnit(b,'blade')){
   base.push({mode:'whole',source:b.id,name:b.name,spin:b.spinDirection||'R',stats:s3(d.stats),keys:['blade:'+b.id],partType:d.type,preview:b.displayImagePath||''});
  }else if(b.system==='CX'){
   if(validUnit(b,'lockChip'))chips.push(b);
   if(validUnit(b,'mainBlade'))mains.push(b);
   if(validUnit(b,'assistBlade'))assists.push(b);
  }
 }
 for(const chip of chips)for(const main of mains)for(const assist of assists){
  const mixed=chip.id!==main.id||main.id!==assist.id;
  base.push({
   mode:'cx',source:main.id,chip:chip.id,main:main.id,assist:assist.id,
   name:mixed?'CX '+chip.lockChip+' / '+main.mainBlade+' / '+assist.assistBlade:main.name,
   spin:'R',stats:add(stats(chip.id,'lockChip'),stats(main.id,'mainBlade'),stats(assist.id,'assistBlade')),
   keys:['chip:'+chip.id,'main:'+main.id,'assist:'+assist.id],
   partType:info(main.id,'mainBlade')?.type,
   preview:mixed?'':main.displayImagePath||'',
   mixed
  });
 }
 return base;
}
const norm=x=>Math.max(0,Math.min(100,x));
function combatVector(bl,rc,bt){
 const a=bl.stats, r=rc.stats,t=bt.stats;
 return {
  attack:norm(v(a,'attack')*.62+v(r,'attack')*.12+v(t,'attack')*.26+v(t,'dash')*.17),
  defense:norm(v(a,'defense')*.62+v(r,'defense')*.15+v(t,'defense')*.23+v(t,'burst')*.08),
  stamina:norm(v(a,'stamina')*.62+v(r,'stamina')*.13+v(t,'stamina')*.25),
  dash:norm(v(t,'dash')),
  burst:norm(v(t,'burst'))
 };
}
function scoreStyle(vec,style,bitType){
 const a=vec.attack,d=vec.defense,s=vec.stamina,x=vec.dash,b=vec.burst;
 const core=style==='attack'?.78*a+.22*x:
  style==='defense'?.76*d+.15*b+.09*s:
  style==='stamina'?.85*s+.15*d:
  .43*((a+d+s)/3)+.36*Math.min(a,d,s)+.21*b;
 const match=bitType===style?9:bitType==='balance'?1.5:-5;
 return core+match;
}
function power(c,style){
 const vec=combatVector(c.blade,c.ratchet,c.bit),bitType=roleOf(c.bit.data);
 return {value:scoreStyle(vec,style,bitType),vec,bitType};
}
function usable(choices){
 const keys=new Set();
 for(const c of choices)for(const key of c.keys){
  if(keys.has(key))return false;keys.add(key);
 }
 return true;
}
function candidateList(style){
 const bs=bladePool(),rs=ratchets(),ts=bits();
 if(!bs.length||!rs.length||!ts.length)return [];
 // Keep promising blades while retaining at least one source from each owned base.
 const estimated=bs.map(b=>({b,value:style==='attack'?b.stats.attack:style==='defense'?b.stats.defense:style==='stamina'?b.stats.stamina:(b.stats.attack+b.stats.defense+b.stats.stamina)/3}));
 estimated.sort((x,y)=>y.value-x.value);
 const selected=estimated.slice(0,80).map(x=>x.b);
 for(const b of bs.filter(b=>b.mode==='whole'))if(!selected.includes(b))selected.push(b);
 const result=[];
 for(const blade of selected)for(const ratchet of rs)for(const bit of ts){
  const c={blade,ratchet,bit,keys:[...blade.keys,'ratchet:'+ratchet.owner,'bit:'+bit.owner]};
  const evaluated=power(c,style);
  // Requested class is governed by Bit type. Non-matching Bits remain selectable only
  // when the requested class has no available compatible Bit.
  if(evaluated.bitType!==style)continue;
  c.score=evaluated.value;c.vec=evaluated.vec;c.type=evaluated.bitType;
  result.push(c);
 }
 return result.sort((a,b)=>b.score-a.score);
}
function pickDeck(pool,count){
 if(count===1)return pool.length?[pool[0]]:[];
 const bests=pool;
 let best=null,bestValue=-Infinity;
 // Evaluate multiple first and second choices. Select the earliest valid third
 // from a score-ordered pool while respecting every physical part ID.
 for(let i=0;i<Math.min(28,bests.length);i++){
  const first=bests[i];
  let validSeconds=0;
  for(let j=0;j<bests.length;j++){
   if(i===j)continue;
   const second=bests[j];
   if(!usable([first,second]))continue;
   const third=bests.find((c,k)=>k!==i&&k!==j&&usable([first,second,c]));
   if(third){
    const team=[first,second,third];
    const diversity=new Set(team.map(c=>c.blade.source)).size;
    const score=team.reduce((sum,c)=>sum+c.score,0)+(diversity-1)*2;
    if(score>bestValue){bestValue=score;best=team;}
   }
   if(++validSeconds>=8)break;
  }
 }
 return best||[];
}

/* Full-combination suppression model.
 * Opponent classification by Bit is NOT used for match selection.
 * Each dimension compares different strengths against its defensive counter.
 * All coefficients are heuristic, not experimentally fitted winning rates.
 */
function counterCompareVectors(ours,theirs){
 const attackEdge=ours.attack+0.30*ours.dash-(theirs.defense+0.15*theirs.burst);
 const guardEdge=ours.defense+0.24*ours.burst-(theirs.attack+0.25*theirs.dash);
 const staminaEdge=ours.stamina+0.12*ours.defense-(theirs.stamina+0.12*theirs.defense);
 const burstEdge=ours.burst-theirs.burst;
 const dashEdge=ours.dash-theirs.dash;
 const raw={
  attack:0.30+0.15*(theirs.stamina/100)+0.07*(1-theirs.defense/100),
  guard:0.30+0.25*((theirs.attack+0.20*theirs.dash)/120),
  stamina:0.30+0.18*(theirs.defense/100)+0.10*(theirs.stamina/100)
 };
 const denom=raw.attack+raw.guard+raw.stamina;
 const weighted=(attackEdge*raw.attack+guardEdge*raw.guard+staminaEdge*raw.stamina)/denom;
 const margin=weighted+0.045*burstEdge+0.04*dashEdge;
 const score=Math.max(0,Math.min(100,50+0.65*margin));
 return {score,margin,attackEdge,guardEdge,staminaEdge,burstEdge,dashEdge};
}
function counterReason(result,enemy,index){
 const entries=[
  {key:'attackEdge',name:'攻擊壓力對抗對手防禦'},
  {key:'guardEdge',name:'防守承受對手攻勢'},
  {key:'staminaEdge',name:'持久能力對抗對手耐久'}
 ];
 entries.sort((a,b)=>result[b.key]-result[a.key]);
 const best=entries.slice(0,2).map(x=>x.name+' '+(result[x.key]>=0?'+':'')+fmt(result[x.key]));
 const deficit=entries[2];
 return '對手 '+(index+1)+'：'+best.join('；')+
  (result[deficit.key]<-7?'。注意：'+deficit.name+' '+fmt(result[deficit.key]):'')+'。';
}
function scoreCounterCandidate(ours,enemies){
 const matchups=enemies.map(enemy=>counterCompareVectors(ours,enemy.vector));
 const scores=matchups.map(x=>x.score);
 const average=scores.reduce((a,b)=>a+b,0)/scores.length;
 const minimum=Math.min(...scores);
 // Robust across 3 opponents. A single extraordinary matchup cannot hide a poor one.
 const total=0.60*average+0.40*minimum;
 return {score:total,matchups};
}
function counterBladeCandidates(enemies){
 const bs=bladePool();
 // Prune only by combined-ability potential. Do not prune by any label/type.
 const rated=bs.map(blade=>{
  const scores=enemies.map(e=>counterCompareVectors(
   {attack:blade.stats.attack,defense:blade.stats.defense,stamina:blade.stats.stamina,dash:0,burst:0},
   e.vector
  ).score);
  return {blade,potential:Math.max(...scores)+0.6*Math.min(...scores)};
 }).sort((a,b)=>b.potential-a.potential);
 const selected=rated.slice(0,125).map(x=>x.blade);
 // Always retain complete non-CX blades and each original CX configuration.
 for(const b of bs.filter(b=>b.mode==='whole'||(b.mode==='cx'&&!b.mixed)))if(!selected.includes(b))selected.push(b);
 return selected;
}
function counterCandidates(enemies){
 const rs=ratchets(),ts=bits(),blades=counterBladeCandidates(enemies),out=[];
 for(const blade of blades)for(const ratchet of rs)for(const bit of ts){
  const c={blade,ratchet,bit,keys:[...blade.keys,'ratchet:'+ratchet.owner,'bit:'+bit.owner]};
  c.vec=combatVector(blade,ratchet,bit);
  const result=scoreCounterCandidate(c.vec,enemies);
  c.score=result.score;c.matchups=result.matchups;c.type=roleOf(bit.data);
  out.push(c);
 }
 return out.sort((a,b)=>b.score-a.score);
}
function counterTeamScore(team,enemies){
 if(!team.length)return -Infinity;
 const n=enemies.length;
 const coverage=enemies.map((_,i)=>Math.max(...team.map(c=>c.matchups[i].score)));
 const coveredAvg=coverage.reduce((a,b)=>a+b,0)/n;
 const coveredMin=Math.min(...coverage);
 const teamAvg=team.reduce((a,c)=>a+c.score,0)/team.length;
 let assignment=coveredAvg;
 if(n===3&&team.length===3){
  // All 3! possible assignments; each of our 3 tops addresses one enemy top.
  let best=-Infinity;
  for(const p of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]){
   const value=(team[0].matchups[p[0]].score+team[1].matchups[p[1]].score+team[2].matchups[p[2]].score)/3;
   if(value>best)best=value;
  }
  assignment=best;
 }
 const differentBlades=new Set(team.map(c=>c.blade.source)).size;
 return 0.42*assignment+0.28*coveredAvg+0.20*coveredMin+0.10*teamAvg+(differentBlades-1)*0.5;
}
function pickCounterDeck(pool,count,enemies){
 if(count===1)return pool.length?[pool[0]]:[];
 if(pool.length<3)return [];
 const shortlist=pool.slice(0,Math.min(3000,pool.length));
 const seeds=pool.slice(0,22);
 for(let i=0;i<enemies.length;i++){
  const top=[...shortlist].sort((a,b)=>b.matchups[i].score-a.matchups[i].score).slice(0,9);
  seeds.push(...top);
 }
 const seen=new Set(),heads=seeds.filter(c=>{
  if(seen.has(c))return false;
  seen.add(c);return true;
 });
 let best=null,bestScore=-Infinity;
 // Search diverse leading pair choices, then maximize the team's ability
 // coverage of the selected opponents without reusing a physical component.
 for(const first of heads.slice(0,35)){
  let secondCount=0;
  for(const second of shortlist){
   if(first===second||!usable([first,second]))continue;
   let localThird=null,localScore=-Infinity;
   // Consider both high-ranked global candidates and specialists for a specific enemy.
   for(const third of heads.concat(shortlist.slice(0,95))){
    if(third===first||third===second||!usable([first,second,third]))continue;
    const value=counterTeamScore([first,second,third],enemies);
    if(value>localScore){localThird=third;localScore=value;}
   }
   if(localThird&&localScore>bestScore){
    bestScore=localScore;best=[first,second,localThird];
   }
   if(++secondCount>=12)break;
  }
 }
 if(best)return best;
 // Expand beyond the initial shortlist if all leading candidates share parts.
 const fallback=[];
 for(const candidate of pool){
  if(usable([...fallback,candidate]))fallback.push(candidate);
  if(fallback.length===3)break;
 }
 return fallback.length===3?fallback:[];
}

function toSlots(c){
 return c.blade.mode==='cx'?
  {mode:'cx',chip:c.blade.chip,main:c.blade.main,assist:c.blade.assist,ratchet:c.ratchet.owner,bit:c.bit.owner}:
  {mode:'whole',blade:c.blade.source,ratchet:c.ratchet.owner,bit:c.bit.owner};
}
function fmt(n){return Number(n||0).toFixed(1)}
function buildName(c){return c.blade.name+' '+c.ratchet.code+bitLabel(c.bit.code,c.bit.owner)}
function versionedPhoto(url){
 if(!url)return '';
 return url.includes('own-g3393-01.png')?url+(url.includes('?')?'&':'?')+'v=rudder-clean-20261116':url;
}
function recommendationPictures(c){
 const cell=(label,src,owner,kind)=>{
  const origin=getBey(owner);
  const content=src?'<img src="'+html(src)+'" alt="'+html(label)+'" loading="lazy" onerror="this.replaceWith(document.createTextNode(\'圖片缺失\'))">':'<div class="analysis-part-missing">缺少圖片</div>';
  return '<button type="button" class="analysis-part-thumb source-photo" data-source-owner="'+html(owner)+'" data-source-kind="'+html(kind)+'" aria-label="查看'+html(label)+'的來源陀螺 '+html(origin?.name||'')+'">'+content+'<span>'+html(label)+'</span><small>查看來源</small></button>';
 };
 const ratchet=cell('固鎖 '+c.ratchet.code,partPicture(c.ratchet.owner,'ratchet'),c.ratchet.owner,'ratchet');
 const bit=cell('軸心 '+bitLabel(c.bit.code,c.bit.owner),partPicture(c.bit.owner,'bit'),c.bit.owner,'bit');
 if(c.blade.mode==='cx'&&c.blade.mixed){
  const parts=[
   cell('鎖定紋章',partPicture(c.blade.chip,'lockChip'),c.blade.chip,'lockChip'),
   cell('主刃',partPicture(c.blade.main,'mainBlade'),c.blade.main,'mainBlade'),
   cell('輔助刃',partPicture(c.blade.assist,'assistBlade'),c.blade.assist,'assistBlade'),
   ratchet,bit
  ].join('');
  return '<div class="analysis-component-gallery analysis-mixed-gallery">'+parts+'</div><div class="analysis-visual-caption">點擊零件可查看其來源陀螺。混搭圖片不是完成品照片。</div>';
 }
 const ref=versionedPhoto(c.blade.preview||partPicture(c.blade.source,'blade'));
 const main=ref?'<img class="analysis-result-image" src="'+html(ref)+'" alt="'+html(c.blade.name)+' 原廠戰刃來源圖" loading="lazy" onerror="this.replaceWith(document.createTextNode(\'圖片缺失\'))">':'<div class="analysis-part-missing">缺少戰刃圖片</div>';
 return '<button type="button" class="analysis-reference-hero source-photo" data-source-owner="'+html(c.blade.source)+'" data-source-kind="blade" aria-label="查看戰刃來源陀螺 '+html(getBey(c.blade.source)?.name||'')+'">'+main+'<span class="analysis-hero-source">點擊查看來源陀螺</span></button>'+
  '<div class="analysis-component-gallery analysis-secondary-gallery">'+ratchet+bit+'</div>'+
  '<div class="analysis-visual-caption">點擊圖片可查看原廠來源。此處不是混搭完成品照片。</div>';
}

function resultMarkup(team,title,mode,enemy){
 if(!team.length)return '<div class="analysis-fail">目前沒有足夠已核對能力的相容零件，無法產生符合限制的配置。</div>';
 const best=team[0].score, total=team.reduce((n,c)=>n+c.score,0);
 const cards=team.map((c,i)=>{
  const relative=best>0?Math.round(Math.max(0,c.score)/best*100):0;
  const v=c.vec,usedSource=c.blade.mixed;
  const message=mode==='attack'?'優先考慮攻擊數值與 X 衝刺。':
   mode==='defense'?'優先考慮防禦、爆裂抗性及碰撞穩定。':
   mode==='stamina'?'優先考慮持久與抗碰撞能力。':
   '優先考慮攻、防、持久的均衡。';
  return '<article class="analysis-result-card">'+
   '<div class="analysis-result-heading"><span>配置 '+(i+1)+'</span><strong>'+html(fmt(c.score))+' <small>模型分</small></strong></div>'+
   recommendationPictures(c)+
   '<h4>'+html(buildName(c))+'</h4>'+
   (c.blade.mode==='cx'?'<p class="analysis-cx">CX：紋章 '+html(getBey(c.blade.chip)?.lockChip)+' / 主刃 '+html(getBey(c.blade.main)?.mainBlade)+' / 輔助刃 '+html(getBey(c.blade.assist)?.assistBlade)+'</p>':'')+
   '<p class="analysis-origin">固鎖：'+html(c.ratchet.code)+'（'+html(c.ratchet.name)+'）<br>軸心：'+html(bitLabel(c.bit.code,c.bit.owner))+'（'+html(c.bit.name)+'）</p>'+
   '<div class="analysis-vector"><span>攻 '+fmt(v.attack)+'</span><span>防 '+fmt(v.defense)+'</span><span>持 '+fmt(v.stamina)+'</span><span>衝 '+fmt(v.dash)+'</span></div>'+
   '<p>'+message+(usedSource?' CX 混搭圖片不代表實物外觀。':'')+'</p></article>';
 }).join('');
 const keys=team.flatMap(c=>c.keys);
 const note=enemy?'<p>對方類型為'+html(roles[enemy.type]||'未知')+'，模型優先考慮'+html(roles[mode])+'的相剋方向。</p>':'';
 return '<div class="analysis-result-summary"><h3>'+html(title)+'</h3><p>計算 '+team.length+' 顆陀螺。'+(team.length>1?'所有實體零件均未重複使用。':'')+'</p>'+note+
  '<p>模型總分 '+fmt(total)+'。分數只用於這次候選排序，不是勝率。數值越高不代表一定獲勝。</p>'+
  '<button type="button" class="analysis-load" data-analysis-load="1">套用至組裝器（可另行保存）</button></div><div class="analysis-result-grid">'+cards+'</div>';
}
let lastAuto=[],lastCounter=[];
function runAuto(){
 const style=$('autoStyle')?.value||'attack',count=Number($('autoCount')?.value||1);
 $('autoResults').textContent='分析中…';
 const pool=candidateList(style);
 const picked=pickDeck(pool,count);
 lastAuto=picked;
 $('autoResults').innerHTML=resultMarkup(picked,roles[style]+'推薦配置',style,null);
}
function option(value,title,selected){
 return '<option value="'+html(value)+'"'+(value===selected?' selected':'')+'>'+html(title)+'</option>';
}
const opponentChoices=[0,1,2].map(i=>{
 const b=rows()[i%rows().length];
 const cx=rows().find(x=>x.system==='CX');
 return {blade:b?.id||'',ratchet:b?.id||'',bit:b?.id||'',chip:cx?.id||'',main:cx?.id||'',assist:cx?.id||''};
});
function opponentSelect(field,label,items,selected){
 return '<label>'+html(label)+'<select data-opp-field="'+field+'" aria-label="'+html(label)+'">'+
  items.map(x=>option(x.id,x.label,selected)).join('')+'</select></label>';
}
function opponentEntryHtml(index){
 const choice=opponentChoices[index];
 const beyItems=rows().map(b=>({id:b.id,label:b.name+' ['+b.system+']'}));
 beyItems.push({id:'CX-CUSTOM',label:'CX 模組自訂（紋章＋主刃＋輔助刃）'});
 const ratchetItems=ratchets().map(x=>({id:x.owner,label:x.code+' ／ '+x.name}));
 const bitItems=bits().map(x=>({id:x.owner,label:bitLabel(x.code,x.owner)+' ／ '+x.name}));
 const cx=rows().filter(b=>b.system==='CX');
 const cxItems=field=>cx.map(b=>({id:b.id,label:b[field]+' ／ '+b.name}));
 const isCustom=choice.blade==='CX-CUSTOM';
 return '<article class="counter-opponent-card" data-opp-index="'+index+'">'+
  '<div class="counter-opponent-heading"><strong>對手 '+String(index+1).padStart(2,'0')+'</strong><span>選擇完整的實際零件</span></div>'+
  '<div class="analysis-controls">'+
  opponentSelect('blade','戰刃',beyItems,choice.blade)+
  opponentSelect('ratchet','固鎖',ratchetItems,choice.ratchet)+
  opponentSelect('bit','軸心',bitItems,choice.bit)+'</div>'+
  '<div class="analysis-controls opp-cx"'+(isCustom?'':' hidden')+'>'+
  opponentSelect('chip','CX 鎖定紋章',cxItems('lockChip'),choice.chip)+
  opponentSelect('main','CX 主刃',cxItems('mainBlade'),choice.main)+
  opponentSelect('assist','CX 輔助刃',cxItems('assistBlade'),choice.assist)+
  '</div></article>';
}
function renderOpponentEntries(){
 const count=Number($('opponentCount')?.value||3);
 $('opponentEntries').innerHTML=Array.from({length:count},(_,i)=>opponentEntryHtml(i)).join('');
}
$('opponentCount')?.addEventListener('change',()=>{
 lastCounter=[];
 renderOpponentEntries();
 $('counterResults').textContent='已變更對手數量，請重新執行能力壓制分析。';
});
$('opponentEntries')?.addEventListener('change',event=>{
 const input=event.target.closest('select[data-opp-field]');
 const card=input?.closest('[data-opp-index]');
 if(!input||!card)return;
 const index=Number(card.dataset.oppIndex),field=input.dataset.oppField;
 if(!Number.isInteger(index)||index<0||index>2||!Object.hasOwn(opponentChoices[index],field))return;
 opponentChoices[index][field]=input.value;
 lastCounter=[];
 if(field==='blade')renderOpponentEntries();
 $('counterResults').textContent='對手配置已變更，請重新分析。';
});
function selectedOpponent(index){
 const c=opponentChoices[index];
 const ratchet=ratchets().find(x=>x.owner===c.ratchet);
 const bit=bits().find(x=>x.owner===c.bit);
 if(!ratchet||!bit)return null;
 let blade;
 let label;
 if(c.blade==='CX-CUSTOM'){
  if(!info(c.chip,'lockChip')||!info(c.main,'mainBlade')||!info(c.assist,'assistBlade'))return null;
  blade={stats:add(stats(c.chip,'lockChip'),stats(c.main,'mainBlade'),stats(c.assist,'assistBlade'))};
  label='CX '+(getBey(c.chip)?.lockChip||'')+' / '+(getBey(c.main)?.mainBlade||'')+' / '+(getBey(c.assist)?.assistBlade||'');
 }else{
  const b=getBey(c.blade);
  if(!b||!info(b.id,'blade'))return null;
  blade={stats:s3(stats(b.id,'blade'))};
  label=b.name;
 }
 const vector=combatVector(blade,ratchet,bit);
 return {label:label+' '+ratchet.code+bitLabel(bit.code,bit.owner),vector,ratchet,bit};
}
function opponentSet(){
 const count=Number($('opponentCount')?.value||3);
 const result=[];
 for(let i=0;i<count;i++){
  const enemy=selectedOpponent(i);
  if(!enemy)return null;
  result.push(enemy);
 }
 return result;
}
function counterResultMarkup(team,enemies){
 if(!team.length)return '<div class="analysis-fail">目前沒有可同時符合能力資料與實體零件限制的配置。請改用 1 顆模式，或檢查收藏資料。</div>';
 const enemyCards=enemies.map((e,i)=>'<div class="counter-target">'+
  '<strong>對手 '+(i+1)+'：'+html(e.label)+'</strong>'+
  '<div class="analysis-vector"><span>攻 '+fmt(e.vector.attack)+'</span><span>防 '+fmt(e.vector.defense)+'</span><span>持 '+fmt(e.vector.stamina)+'</span><span>衝 '+fmt(e.vector.dash)+'</span><span>抗爆 '+fmt(e.vector.burst)+'</span></div></div>').join('');
 const coverage=enemies.map((e,j)=>{
  let bestIndex=0,bestValue=-Infinity;
  team.forEach((c,i)=>{if(c.matchups[j].score>bestValue){bestValue=c.matchups[j].score;bestIndex=i}});
  return '<div class="counter-coverage"><strong>對手 '+(j+1)+'</strong><span>配置 '+(bestIndex+1)+' 最有利 · 相對壓制 '+fmt(bestValue)+' 分</span></div>';
 }).join('');
 const cards=team.map((c,i)=>{
  const v=c.vec;
  const why=c.matchups.map((result,j)=>'<li>'+html(counterReason(result,enemies[j],j))+'<br><small>相對壓制分 '+fmt(result.score)+'；高於 50 表示模型有利，低於 50 表示模型不利。</small></li>').join('');
  return '<article class="analysis-result-card">'+
   '<div class="analysis-result-heading"><span>我方配置 '+(i+1)+'</span><strong>'+fmt(c.score)+' <small>相對評分</small></strong></div>'+
   recommendationPictures(c)+
   '<h4>'+html(buildName(c))+'</h4>'+
   (c.blade.mode==='cx'?'<p class="analysis-cx">CX：紋章 '+html(getBey(c.blade.chip)?.lockChip)+'／主刃 '+html(getBey(c.blade.main)?.mainBlade)+'／輔助刃 '+html(getBey(c.blade.assist)?.assistBlade)+'</p>':'')+
   '<p class="analysis-origin">固鎖 '+html(c.ratchet.code)+'（'+html(c.ratchet.name)+'）<br>軸心 '+html(bitLabel(c.bit.code,c.bit.owner))+'（'+html(c.bit.name)+'）</p>'+
   '<div class="analysis-vector"><span>攻 '+fmt(v.attack)+'</span><span>防 '+fmt(v.defense)+'</span><span>持 '+fmt(v.stamina)+'</span><span>衝 '+fmt(v.dash)+'</span><span>抗爆 '+fmt(v.burst)+'</span></div>'+
   '<h5 class="counter-why-title">針對各對手的能力差距</h5>'+
   '<ul class="counter-reasons">'+why+'</ul></article>';
 }).join('');
 const total=counterTeamScore(team,enemies);
 return '<div class="analysis-result-summary"><h3>能力壓制推薦：'+team.length+' 顆對 '+enemies.length+' 顆</h3>'+
  '<p>依雙方完整數值比較，不依對手的攻擊／防禦／持久類型直接決定推薦。'+(team.length===3?'已檢查三顆不重複使用實體戰刃、固鎖、軸心及 CX 模組。':'')+'</p>'+
  '<p>整隊相對模型分 '+fmt(total)+'。分數只用於比較，非勝率；對戰結果還受發射、競技盤、重心及機械相容性影響。</p>'+
  '<button type="button" class="analysis-load" data-analysis-load="1">將 '+team.length+' 顆配置套用至組裝器</button></div>'+
  '<div class="counter-enemy-overview"><h4>對手完整能力</h4>'+enemyCards+'</div>'+
  '<div class="counter-team-coverage"><h4>我方壓制覆蓋</h4>'+coverage+'</div>'+
  '<div class="analysis-result-grid">'+cards+'</div>';
}
function runCounter(){
 const enemies=opponentSet();
 if(!enemies||!enemies.length){
  $('counterResults').textContent='請選齊每顆對手的戰刃、固鎖與軸心。';
  return;
 }
 // Opponent count determines our recommended count: only 1v1 or 3v3.
 const count=enemies.length;
 if(count!==1&&count!==3){
  $('counterResults').textContent='只支援 1 對 1 或 3 對 3 分析。';
  return;
 }
 $('counterResults').textContent='正在比較雙方完整能力與隊伍壓制覆蓋…';
 const pool=counterCandidates(enemies);
 const team=pickCounterDeck(pool,count,enemies);
 lastCounter=team;
 $('counterResults').innerHTML=counterResultMarkup(team,enemies);
}

$('runAuto')?.addEventListener('click',runAuto);
$('runCounter')?.addEventListener('click',runCounter);
$('autoResults')?.addEventListener('click',e=>{
 if(!e.target.closest('[data-analysis-load]')||!lastAuto.length)return;
 api.useSuggestion(lastAuto.map(toSlots),'AI '+(roles[$('autoStyle').value]||'')+'配裝');
});
$('counterResults')?.addEventListener('click',e=>{
 if(!e.target.closest('[data-analysis-load]')||!lastCounter.length)return;
 api.useSuggestion(lastCounter.map(toSlots),'能力壓制 '+lastCounter.length+' 顆配置');
});
renderOpponentEntries();
if($('autoResults'))$('autoResults').textContent='可從 19 顆已登錄陀螺的零件庫，挑選攻擊、防禦、持久、平衡配置。';
})();
