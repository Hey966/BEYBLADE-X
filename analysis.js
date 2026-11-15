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
  '<span class="eyebrow">COMPONENT PROFILE</span><h2>'+html(r.name||bey?.name||'配件能力')+'</h2>'+
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
 const photo=bey.displayImagePath||bey.partImages?.blade||'';
 const part=info(owner,kind);
 const label=partNames[kind]||kind;
 const specs=[
   ['原廠戰刃',bey.blade],
   ['原廠固鎖',bey.ratchet],
   ['原廠軸心',bey.bit],
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
  '<div class="source-identified"><strong>你點選的零件</strong><p>'+html(label)+'：'+html(part?.name||'原廠零件')+'</p></div>'+
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
function matchupStyle(enemyType){
 return {attack:'defense',defense:'stamina',stamina:'attack',balance:'balance'}[enemyType]||'balance';
}
function power(c,style,enemy){
 const vec=combatVector(c.blade,c.ratchet,c.bit),bitType=roleOf(c.bit.data);
 let value=scoreStyle(vec,style,bitType);
 if(enemy){
  // Official broad matchups are directional, not a guarantee for specific builds.
  const their=enemy.vector;
  value+=(bitType===style?7:0);
  if(enemy.type==='attack')value+=.11*vec.defense+.035*vec.burst;
  else if(enemy.type==='stamina')value+=.12*vec.attack+.08*vec.dash;
  else if(enemy.type==='defense')value+=.13*vec.stamina;
  else value+=.04*(vec.attack+vec.defense+vec.stamina);
  // Penalize large specialization gaps against a balanced enemy.
  if(enemy.type==='balance')value-=.025*(Math.max(vec.attack,vec.defense,vec.stamina)-Math.min(vec.attack,vec.defense,vec.stamina));
  // Opponent intensity influences comparisons via threat magnitude.
  const intensity=(their.attack+their.defense+their.stamina)/300;
  value+=intensity*2;
 }
 return {value,vec,bitType};
}
function usable(choices){
 const keys=new Set();
 for(const c of choices)for(const key of c.keys){
  if(keys.has(key))return false;keys.add(key);
 }
 return true;
}
function candidateList(style,enemy=null){
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
  const evaluated=power(c,style,enemy);
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
function toSlots(c){
 return c.blade.mode==='cx'?
  {mode:'cx',chip:c.blade.chip,main:c.blade.main,assist:c.blade.assist,ratchet:c.ratchet.owner,bit:c.bit.owner}:
  {mode:'whole',blade:c.blade.source,ratchet:c.ratchet.owner,bit:c.bit.owner};
}
function fmt(n){return Number(n||0).toFixed(1)}
function buildName(c){return c.blade.name+' '+c.ratchet.code+c.bit.code}
function recommendationPictures(c){
 const cell=(label,src,owner,kind)=>{
  const origin=getBey(owner);
  const content=src?'<img src="'+html(src)+'" alt="'+html(label)+'" loading="lazy" onerror="this.replaceWith(document.createTextNode(\'圖片缺失\'))">':'<div class="analysis-part-missing">缺少圖片</div>';
  return '<button type="button" class="analysis-part-thumb source-photo" data-source-owner="'+html(owner)+'" data-source-kind="'+html(kind)+'" aria-label="查看'+html(label)+'的來源陀螺 '+html(origin?.name||'')+'">'+content+'<span>'+html(label)+'</span><small>查看來源</small></button>';
 };
 const ratchet=cell('固鎖 '+c.ratchet.code,partPicture(c.ratchet.owner,'ratchet'),c.ratchet.owner,'ratchet');
 const bit=cell('軸心 '+c.bit.code,partPicture(c.bit.owner,'bit'),c.bit.owner,'bit');
 if(c.blade.mode==='cx'&&c.blade.mixed){
  const parts=[
   cell('鎖定紋章',partPicture(c.blade.chip,'lockChip'),c.blade.chip,'lockChip'),
   cell('主刃',partPicture(c.blade.main,'mainBlade'),c.blade.main,'mainBlade'),
   cell('輔助刃',partPicture(c.blade.assist,'assistBlade'),c.blade.assist,'assistBlade'),
   ratchet,bit
  ].join('');
  return '<div class="analysis-component-gallery analysis-mixed-gallery">'+parts+'</div><div class="analysis-visual-caption">點擊零件可查看其來源陀螺。混搭圖片不是完成品照片。</div>';
 }
 const ref=c.blade.preview||partPicture(c.blade.source,'blade');
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
   '<p class="analysis-origin">固鎖：'+html(c.ratchet.code)+'（'+html(c.ratchet.name)+'）<br>軸心：'+html(c.bit.code)+'（'+html(c.bit.name)+'）</p>'+
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
function option(value,title){return '<option value="'+html(value)+'">'+html(title)+'</option>';}
function renderOpponentOptions(){
 const list=rows(),select=$('oppBlade');
 if(!select)return;
 select.innerHTML=list.map(b=>option(b.id,b.name+' ['+b.system+']')).join('')+option('CX-CUSTOM','自訂 CX 紋章／主刃／輔助刃');
 for(const kind of ['ratchet','bit']){
  const node=$('opp'+(kind==='ratchet'?'Ratchet':'Bit'));
  node.innerHTML=allUnits(kind).map(u=>option(u.owner,u.code+' — '+u.name)).join('');
 }
 const cxRows=list.filter(b=>b.system==='CX');
 for(const [key,field] of [['Chip','lockChip'],['Main','mainBlade'],['Assist','assistBlade']]){
  $('opp'+key).innerHTML=cxRows.map(b=>option(b.id,b[field]+' — '+b.name)).join('');
 }
 $('oppBlade').addEventListener('change',()=>{
  $('oppCX').hidden=$('oppBlade').value!=='CX-CUSTOM';
 });
 $('oppCX').hidden=true;
}
function opponent(){
 const bladeId=$('oppBlade')?.value,ratchetId=$('oppRatchet')?.value,bitId=$('oppBit')?.value;
 const ratchet=allUnits('ratchet').find(x=>x.owner===ratchetId);
 const bit=allUnits('bit').find(x=>x.owner===bitId);
 if(!ratchet||!bit)return null;
 let bl;
 if(bladeId==='CX-CUSTOM'){
  const chip=$('oppChip').value, main=$('oppMain').value,assist=$('oppAssist').value;
  bl={stats:add(stats(chip,'lockChip'),stats(main,'mainBlade'),stats(assist,'assistBlade'))};
 }else{
  const b=getBey(bladeId);
  if(!b||!info(b.id,'blade'))return null;
  bl={stats:s3(stats(b.id,'blade'))};
 }
 return {type:roleOf(bit.data),vector:combatVector(bl,ratchet,bit),ratchet,bit};
}
function runCounter(){
 const enemy=opponent();
 if(!enemy){$('counterResults').textContent='請先選齊對方戰刃、固鎖與軸心。';return;}
 const style=matchupStyle(enemy.type),count=Number($('counterCount')?.value||1);
 $('counterResults').textContent='計算克制配置中…';
 const picked=pickDeck(candidateList(style,enemy),count);
 lastCounter=picked;
 $('counterResults').innerHTML=resultMarkup(picked,'針對'+roles[enemy.type]+'型的克制推薦',style,enemy);
}
$('runAuto')?.addEventListener('click',runAuto);
$('runCounter')?.addEventListener('click',runCounter);
$('autoResults')?.addEventListener('click',e=>{
 if(!e.target.closest('[data-analysis-load]')||!lastAuto.length)return;
 api.useSuggestion(lastAuto.map(toSlots),'AI '+(roles[$('autoStyle').value]||'')+'配裝');
});
$('counterResults')?.addEventListener('click',e=>{
 if(!e.target.closest('[data-analysis-load]')||!lastCounter.length)return;
 api.useSuggestion(lastCounter.map(toSlots),'克制 '+(roles[opponent()?.type]||'')+'配置');
});
renderOpponentOptions();
if($('autoResults'))$('autoResults').textContent='可從 19 顆已登錄陀螺的零件庫，挑選攻擊、防禦、持久、平衡配置。';
})();
