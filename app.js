/* BEYBLADE X personal collection, v1.0. All browser edits are local until exported. */
(() => {
'use strict';
const VERSION = 2, KEY = 'beyblade-x-966-v1', L=window.BBX_LOCAL;
if(!L){document.body.textContent='收藏資料驗證工具未載入，請重新整理。';return;}
const seed = window.BBX_SEED;
if (!seed || !Array.isArray(seed.beys)) { document.body.textContent='無法讀取收藏資料。'; return; }
const clone = x => JSON.parse(JSON.stringify(x));
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opt = (id,label,sel) => `<option value="${esc(id)}" ${String(id)===String(sel)?'selected':''}>${esc(label)}</option>`;
const bitLabel=(code,owner)=>window.BBX_BIT_TYPES?.label?.(code,owner)||String(code??'');
const bladeLabel=(code,owner,kind='blade')=>window.BBX_BLADE_TYPES?.label?.(code,owner,kind)||String(code??'');
const bladeSuffix=(code,owner,kind='blade')=>window.BBX_BLADE_TYPES?.suffix?.(code,owner,kind)||'';
const loc = m => m==='US'?'美版':m==='JP'?'日版':'其他';
const pmap = () => new Map(DB.packages.map(p=>[p.id,p]));
let DB=clone(seed),decks=[],customAbilities={},filter='ALL',partFilter='ratchet',active='collection',slots=[blank(),blank(),blank()];
function blank(){return{mode:'whole',blade:'',chip:'',main:'',assist:'',ratchet:'',bit:''};}
const seedIds=new Set(seed.beys.map(b=>b.id));
function restore(raw){
 const result=L.parseBackup(raw,seedIds);
 DB=clone(seed);
 DB.beys.push(...result.additions);DB.packages.push(...result.packages);
 decks=result.decks;slots=result.slots;customAbilities=result.customAbilities;
 const catalog=window.BBX_PART_STATS?.beys;
 if(catalog){
  for(const id of Object.keys(catalog))if(L.ownId(id))delete catalog[id];
  Object.assign(catalog,customAbilities);
 }
}
function storedData(){return{format:'BBX-966-BACKUP',version:VERSION,additions:DB.beys.filter(b=>L.ownId(b.id)),decks,slots,customAbilities};}
try{const local=JSON.parse(localStorage.getItem(KEY)||'null');if(local)restore(local)}
catch(e){console.warn('本機備份損壞，未自動載入',e)}
function save(){try{localStorage.setItem(KEY,JSON.stringify(storedData()));return true}
 catch(e){notify('本機儲存失敗，請匯出備份');return false}}
let toastTimer;
function notify(s){const el=$('toast');el.textContent=s;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800)}
function nav(v){if(!['collection','parts','builder','counter','sim','data'].includes(v))return;active=v;document.querySelectorAll('.view').forEach(n=>n.classList.toggle('active',n.id===v));document.querySelectorAll('[data-nav]').forEach(n=>n.classList.toggle('active',n.dataset.nav===v));if(v==='builder')renderSlots();if(v==='parts')renderParts();if(v==='data')renderCompleteness();window.scrollTo({top:0,behavior:'smooth'});}
document.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',()=>nav(el.dataset.nav)));
function getBey(id){return DB.beys.find(b=>b.id===id)}
function pack(b){return pmap().get(b.packageId)||{market:b.ownMarket||'OTHER',title:'自行新增',manufacturer:b.ownMarket==='US'?'Hasbro':b.ownMarket==='JP'?'Takara Tomy':'手動登記'};}
function stock(kind){let arr=[]; for(const b of DB.beys){ if(kind==='ratchet'||kind==='bit')arr.push({id:b.id,value:b[kind],name:b.name});
 else if(kind==='blade'&&b.system!=='CX')arr.push({id:b.id,value:b.blade,name:b.name});
 else if(['chip','main','assist'].includes(kind)&&b.system==='CX'){const key={chip:'lockChip',main:'mainBlade',assist:'assistBlade'}[kind];if(b[key])arr.push({id:b.id,value:b[key],name:b.name});}
 else if(kind==='cxBlade'&&b.system==='CX')arr.push({id:b.id,value:b.blade,name:b.name}); }
 return arr.filter(x=>x.value)}
function countStats(){const count=DB.beys.length;const n=k=>DB.beys.filter(b=>b.system===k).length;const regions={US:0,JP:0};DB.beys.forEach(b=>{const m=pack(b).market;if(m in regions)regions[m]++}); $('stats').innerHTML=[['收藏總數',count],['BX 系列',n('BX')],['UX 系列',n('UX')],['CX 系列',n('CX')],['日版 / 美版',`${regions.JP} / ${regions.US}`]].map(([label,val],i)=>`<div class="stat"><span>${label}</span><strong class="${i===0?'tiny':''}">${esc(val)}</strong></div>`).join(''); }
function renderFilters(){const f=$('filters');f.innerHTML=['ALL','BX','UX','CX'].map(v=>`<button data-filter="${v}" class="${v===filter?'on':''}">${v==='ALL'?'全部':v}</button>`).join('');f.querySelectorAll('button').forEach(n=>n.onclick=()=>{filter=n.dataset.filter;renderFilters();renderCollection()})}
function displayImage(b){
 const url=b?.displayImagePath||'';
 return url.includes('own-g3393-01.png')?url+(url.includes('?')?'&':'?')+'v=rudder-clean-20261116':url;
}
function photoTag(b,alt){const src=displayImage(b), fallback=b?.referenceImageUrl||'';return src?'<img src="'+esc(src)+'" alt="'+esc(alt)+'" loading="lazy" onerror="this.replaceWith(document.createTextNode(\'圖片查核中\'))">':'<div class="photo-missing">圖片查核中</div>'}

/* Unified image framing for all collection covers. */
function coverLabel(b){
 if(!displayImage(b))return '圖片查核中';
 return b.imageStatus==='blade_only_exact_photo'?'上層戰刃照片':'完整陀螺照片';
}
const coverImageTransformCache=new Map();
function normalizeCoverImages(root){
 const images=root.querySelectorAll('.cover-stage img');
 for(const img of images){
  const apply=()=>{
   if(!img.naturalWidth||!img.naturalHeight)return;
   const key=img.getAttribute('src')||'';
   const cached=coverImageTransformCache.get(key);
   if(cached){img.style.transform=cached;return;}
   try{
    const canvas=document.createElement('canvas');
    const limit=480, ratio=Math.min(1,limit/Math.max(img.naturalWidth,img.naturalHeight));
    const w=Math.max(1,Math.round(img.naturalWidth*ratio));
    const h=Math.max(1,Math.round(img.naturalHeight*ratio));
    canvas.width=w;canvas.height=h;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)return;
    context.drawImage(img,0,0,w,h);
    const pixels=context.getImageData(0,0,w,h).data;
    let left=w,right=-1,top=h,bottom=-1;
    for(let y=0;y<h;y+=2){
     for(let x=0;x<w;x+=2){
      if(pixels[(y*w+x)*4+3]>45){
       if(x<left)left=x;if(x>right)right=x;
       if(y<top)top=y;if(y>bottom)bottom=y;
      }
     }
    }
    if(right<left||bottom<top)return;
    const fraction=Math.max((right-left+1)/w,(bottom-top+1)/h);
    if(fraction<0.08)return;
    const scale=Math.min(2.8,Math.max(0.70,0.83/fraction));
    const dx=(w/2-(left+right)/2)/w*100*scale;
    const dy=(h/2-(top+bottom)/2)/h*100*scale;
    const transform='translate('+dx.toFixed(2)+'%, '+dy.toFixed(2)+'%) scale('+scale.toFixed(3)+')';
    img.style.transform=transform;
    coverImageTransformCache.set(key,transform);
   }catch(error){
    // Preserve object-fit layout if an image cannot be measured.
   }
  };
  if(img.complete&&img.naturalWidth)apply();
  else img.addEventListener('load',apply,{once:true});
 }
}

function renderCollection(){
 const q=$('search').value.trim().toLocaleLowerCase(),m=$('marketFilter').value;
 const list=DB.beys.filter(b=>{const p=pack(b),hay=[b.name,b.blade,b.ratchet,b.bit,b.lockChip,b.mainBlade,b.assistBlade,p.title,b.manufacturerBeyCode].join(' ').toLowerCase();return (filter==='ALL'||b.system===filter)&&(m==='ALL'||p.market===m)&&hay.includes(q);});
 $('countView').textContent=list.length+' / '+DB.beys.length;
 const grouped=new Map();list.forEach(b=>{if(!grouped.has(b.packageId))grouped.set(b.packageId,[]);grouped.get(b.packageId).push(b)});
 $('collectionGrid').innerHTML=[...grouped].map(([pid,items])=>{
 const p=pack(items[0]);return '<section class="package-group"><div class="package-heading"><div><small>'+esc(p.productCode||pid)+'</small><h3>'+esc(p.title)+'</h3></div><span>'+esc(loc(p.market))+' · '+items.length+' 顆</span></div><div class="package-cards">'+items.map(b=>'<button class="bey-card" data-id="'+esc(b.id)+'"><div class="bey-photo"><div class="cover-stage">'+photoTag(b,b.name+' 商品圖')+'</div><span class="cover-note">'+esc(coverLabel(b))+'</span><span class="system-badge '+esc(b.system)+'">'+esc(b.system)+'</span></div><div class="bey-info"><div class="mini-row"><span>'+esc(loc(p.market))+' / '+esc(p.manufacturer)+'</span><span>'+(b.spinDirection==='L'?'↶ 左旋':'↷ 右旋')+'</span></div><div class="bey-name">'+esc(b.name+bladeSuffix(b.blade,b.id))+'</div><div class="bey-spec">'+esc(b.ratchet)+esc(bitLabel(b.bit,b.id))+'</div><div class="component-row"><span>原廠配置</span><b class="more">查看零件 →</b></div></div></button>').join('')+'</div></section>'
 }).join('')||'<div class="empty">沒有符合條件的陀螺。</div>';
 $('collectionGrid').querySelectorAll('.bey-card').forEach(n=>n.addEventListener('click',()=>openDetail(n.dataset.id)));
 normalizeCoverImages($('collectionGrid'));
}
const dialog=$('detailDialog');$('closeDetail').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
function openDetail(id){const b=getBey(id);if(!b)return;const p=pack(b);const fields=[['原廠戰刃',bladeLabel(b.blade,b.id)],['固鎖 Ratchet',b.ratchet],['軸心 Bit',bitLabel(b.bit,b.id)],['迴旋方向',b.spinDirection==='L'?'左迴旋':'右迴旋'],['來源套組',p.title],['製造商 / 版本',`${p.manufacturer} / ${loc(p.market)}`],['鎖定紋章 Lock Chip',b.lockChip],['主刃 Main Blade',b.mainBlade?bladeLabel(b.mainBlade,b.id,'mainBlade'):null],['輔助刃 Assist Blade',b.assistBlade?bladeLabel(b.assistBlade,b.id,'assistBlade'):null],['目前實體組裝',b.currentBuild?'已記錄':'尚未登記']].filter(([,v])=>v);
 $('detailContent').innerHTML=`<div class="detail-top">${photoTag(b,b.name)}<div><span class="system-badge ${esc(b.system)}">${esc(b.system)}</span><h2>${esc(b.name+bladeSuffix(b.blade,b.id))}</h2><p>原廠：${esc(b.ratchet)}${esc(bitLabel(b.bit,b.id))}</p><p>${esc(loc(p.market))} · ${esc(p.productCode||'')}</p><p>收藏編號：${esc(b.id)}</p>${b.wholeReferencePage?.startsWith('https://')?'<p><a href="'+esc(b.wholeReferencePage)+'" target="_blank" rel="noopener noreferrer">查看原商品參考照（完整透明圖待確認）</a></p>':''}${b.imageStatus==='blade_only_exact_photo'?'<p class="source-caveat">此圖片為該款上層戰刃，非完整組裝照片。</p>':''}</div></div><div class="detail-fields">${fields.map(([k,v])=>`<div class="detail-field"><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join('')}</div>`;

 const pictures=[['blade',b.system==='CX'?'完整戰刃':'上層戰刃',bladeLabel(b.blade,b.id)],['ratchet','中層固鎖',b.ratchet],['bit','下層軸心',bitLabel(b.bit,b.id)]];
 if(b.system==='CX'){pictures.push(['lockChip','鎖定紋章',b.lockChip],['mainBlade','主刃',bladeLabel(b.mainBlade,b.id,'mainBlade')],['assistBlade','輔助刃',bladeLabel(b.assistBlade,b.id,'assistBlade')]);}
 $('detailContent').insertAdjacentHTML('beforeend','<div class="part-visuals">'+pictures.map(([k,label,value])=>{const src=b.partImages?.[k];return '<button type="button" class="part-visual part-click" data-part-owner="'+esc(b.id)+'" data-part-kind="'+esc(k)+'" aria-label="查看 '+esc(label)+'能力"><span>'+esc(label)+'</span>'+(src?'<img src="'+esc(src)+'" alt="'+esc(label)+'" onerror="this.replaceWith(document.createTextNode(\'尚未取得透明 PNG\'))">':'<div class="pending-image">尚待查核圖片</div>')+'<strong>'+esc(value||'未登記')+'</strong><small class="click-hint">查看能力</small></button>'}).join('')+'</div>');
 dialog.showModal();}
const partTabs=[['ratchet','固鎖'],['bit','軸心'],['blade','BX / UX 戰刃'],['cxBlade','CX 完整戰刃'],['chip','CX 紋章'],['main','CX 主刃'],['assist','CX 輔助刃']];
function renderParts(){
 $('partFilters').innerHTML=partTabs.map(([k,t])=>'<button class="'+(k===partFilter?'on':'')+'" data-kind="'+k+'">'+t+'</button>').join('');
 $('partFilters').querySelectorAll('button').forEach(n=>n.onclick=()=>{partFilter=n.dataset.kind;renderParts()});
 const byType={ratchet:'ratchet',bit:'bit',blade:'blade',cxBlade:'blade',chip:'lockChip',main:'mainBlade',assist:'assistBlade'};
 const component=byType[partFilter];
 const groups=new Map();stock(partFilter).forEach(x=>{const k=x.value;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x)});
 const items=[...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
 $('partsList').innerHTML='<p class="parts-total">'+items.length+' 種型號 · '+items.reduce((a,[,v])=>a+v.length,0)+' 個實體配件</p><div class="part-grid">'+items.map(([code,list])=>{
   const thumbs=list.map(item=>{
     const bey=getBey(item.id),src=bey?.partImages?.[component]||'';
     const picture=src?'<img src="'+esc(src)+'" loading="lazy" alt="'+esc(item.name+' '+code)+'" onerror="this.replaceWith(document.createTextNode(\'圖片待確認\'))">':'<div class="part-image-missing">圖片待確認</div>';
     return '<button class="part-variant part-click" type="button" data-part-owner="'+esc(item.id)+'" data-part-kind="'+esc(component)+'" aria-label="查看 '+esc(item.name+' '+code)+' 能力">'+picture+'<small>'+esc(item.name)+'</small></button>';
   }).join('');
   return '<div class="part-entry"><b class="quantity">× '+list.length+'</b><strong>'+esc(partFilter==='bit'?bitLabel(code,list[0].id):['blade','mainBlade','assistBlade'].includes(component)?bladeLabel(code,list[0].id,component):code)+'</strong><div class="part-variants">'+thumbs+'</div></div>'
 }).join('')+'</div>';
}
const SELECTIONS={blade:()=>DB.beys,ratchet:()=>stock('ratchet'),bit:()=>stock('bit'),chip:()=>stock('chip'),main:()=>stock('main'),assist:()=>stock('assist')};
function slotPicker(kind,v,placeholder){const arr=SELECTIONS[kind]();return `<select data-field="${kind}">${opt('',placeholder,v)}${arr.map(x=>opt(x.id,kind==='blade'?`${x.name}${bladeSuffix(x.blade,x.id)} [${x.system}]`:`${kind==='bit'?bitLabel(x.value,x.id):kind==='main'?bladeLabel(x.value,x.id,'mainBlade'):kind==='assist'?bladeLabel(x.value,x.id,'assistBlade'):x.value} — ${x.name}`,v)).join('')}</select>`}
function renderSlots(){ $('buildSlots').innerHTML=slots.map((s,i)=>{
 const b=getBey(s.blade);const src=displayImage(b)||(s.mode==='cx'?displayImage(getBey(s.main)):'');
 return `<article class="slot" data-slot="${i}"><div class="slot-top"><span class="slot-number">SLOT 0${i+1}</span><span class="slot-state">${s.blade||s.chip?'已選擇':'空白'}</span></div><div class="slot-preview">${src?`<img src="${esc(src)}" alt="戰刃來源示意">`:'<strong>X</strong>'}</div><label>組裝方式<select data-field="mode">${opt('whole','完整戰刃（BX / UX / CX）',s.mode)}${opt('cx','CX 模組化（紋章＋主刃＋輔助刃）',s.mode)}</select></label>${s.mode==='whole'?`<label>戰刃 ${slotPicker('blade',s.blade,'選擇陀螺戰刃')}</label>`:`<div class="cx-fields"><label>鎖定紋章 ${slotPicker('chip',s.chip,'選擇紋章')}</label><label>主刃 ${slotPicker('main',s.main,'選擇主刃')}</label><label>輔助刃 ${slotPicker('assist',s.assist,'選擇輔助刃')}</label></div>`}<label>固鎖 ${slotPicker('ratchet',s.ratchet,'選擇固鎖')}</label><label>軸心 ${slotPicker('bit',s.bit,'選擇軸心')}</label></article>`}).join('');
 $('buildSlots').querySelectorAll('.slot').forEach(el=>el.querySelectorAll('select').forEach(n=>n.onchange=()=>{
 const i=Number(el.dataset.slot),f=n.dataset.field,v=n.value;
 if(f==='mode'){slots[i]={...blank(),mode:v};}else slots[i][f]=v;
 save();renderSlots();}));renderValidation();}
function itemResources(s){let keys=[];if(s.mode==='cx'){
 for(const k of ['chip','main','assist'])if(s[k])keys.push([`${k}:${s[k]}`,k]);
 }else if(s.blade){const b=getBey(s.blade);if(b){if(b.system==='CX'){['chip','main','assist'].forEach(k=>{if(b[{chip:'lockChip',main:'mainBlade',assist:'assistBlade'}[k]])keys.push([`${k}:${b.id}`,k]);});}else keys.push([`blade:${b.id}`,'戰刃']);}}
 for(const k of ['ratchet','bit'])if(s[k])keys.push([`${k}:${s[k]}`,k]);return keys;}
const modelColumns={blade:'blade',chip:'lockChip',main:'mainBlade',assist:'assistBlade',ratchet:'ratchet',bit:'bit'};
function modelForKey(key){const [kind,owner]=key.split(':');const value=String(getBey(owner)?.[modelColumns[kind]]??'').trim();return value?kind+':'+value.toUpperCase():'';}
function isRepeatRestricted(model){return !model.startsWith('chip:')||/^(VALKYRIE|EMPEROR|ワルキューレ|エンペラー|戰神|帝王)$/iu.test(model.slice(5));}
function validate(){let seen=new Set(),seenModels=new Set(),errs=[],used=0;slots.forEach((s,i)=>{
 const any=s.blade||s.chip||s.main||s.assist||s.ratchet||s.bit;if(!any)return;used++;
 const label=`第 ${i+1} 槽`;
 if(s.mode==='whole'&&!s.blade)errs.push(`${label}缺少戰刃`);
 if(s.mode==='cx'&&(!s.chip||!s.main||!s.assist))errs.push(`${label}的 CX 模組未選齊`);
 if(!s.ratchet||!s.bit)errs.push(`${label}缺少固鎖或軸心`);
 for(const [key,name] of itemResources(s)){if(seen.has(key))errs.push(`${label}重複使用實體${name}`);seen.add(key);const model=modelForKey(key);if(model&&isRepeatRestricted(model)&&seenModels.has(model))errs.push(`${label}重複使用同型號${name}（不同顏色也不行）`);if(model&&isRepeatRestricted(model))seenModels.add(model)}
 });return {errs,used};}
function renderValidation(){const {errs,used}=validate();$('validation').classList.toggle('bad',!!errs.length);$('validation').textContent=errs.length?'請修正：'+[...new Set(errs)].join('；'):(used?`已設定 ${used} 顆，沒有重複實體或同型號配件。`:'請先選擇戰刃、固鎖與軸心。');}
$('saveDeck').onclick=()=>{const {errs,used}=validate();if(errs.length||!used)return notify('配置未完成或有零件重複，無法保存');const name=$('deckName').value.trim()||`我的配置 ${decks.length+1}`;decks.unshift({id:`D-${Date.now()}`,name,slots:clone(slots),createdAt:new Date().toISOString()});save();renderSaved();notify('已保存至目前瀏覽器');};
$('clearDeck').onclick=()=>{slots=[blank(),blank(),blank()];save();renderSlots();notify('已清空組裝槽');};
function renderSaved(){$('savedDecks').innerHTML=decks.length?decks.map(d=>`<div class="saved-card"><div><strong>${esc(d.name)}</strong><small>${esc((d.slots||[]).filter(s=>s.blade||s.chip||s.main).length)} 顆 · ${esc((d.createdAt||'').slice(0,10))}</small></div><div class="saved-actions"><button data-load="${esc(d.id)}">載入</button><button data-remove="${esc(d.id)}">刪除</button></div></div>`).join(''):'<div style="color:var(--muted);font-size:13px;padding:13px">尚無保存配置。</div>';
 $('savedDecks').querySelectorAll('[data-load]').forEach(n=>n.onclick=()=>{const d=decks.find(x=>x.id===n.dataset.load);if(d){slots=clone(d.slots);$('deckName').value=d.name;save();renderSlots();notify('已載入配置')}});
 $('savedDecks').querySelectorAll('[data-remove]').forEach(n=>n.onclick=()=>{if(!confirm('確定刪除這筆配置嗎？'))return;decks=decks.filter(x=>x.id!==n.dataset.remove);save();renderSaved()});}
function download(obj,filename){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
$('export').onclick=()=>download({...storedData(),exportedAt:new Date().toISOString(),base:seed.beys.map(b=>b.id),packages:DB.packages.filter(p=>p.id.startsWith('PKG-LOCAL-'))},`BEYBLADE-X-backup-${new Date().toISOString().slice(0,10)}.json`);
$('import').onchange=async e=>{
 const f=e.target.files?.[0];if(!f)return;
 try{
  if(f.size>1_500_000)throw Error('備份超過 1.5 MB，請確認來源');
  const obj=JSON.parse(await f.text());
  const checked=L.parseBackup(obj,seedIds);
  if(!confirm('即將匯入 '+checked.additions.length+' 顆新增收藏及 '+checked.decks.length+' 筆配置。這會覆蓋本機記錄，繼續嗎？'))return;
  restore(obj);save();all();window.dispatchEvent(new Event('bbx-inventory-updated'));notify('已通過驗證並匯入備份');
 }catch(err){notify('匯入失敗：'+err.message)}
 finally{e.target.value=''}
};
function toggleCXInputs(){
 const on=$('addForm').elements.system.value==='CX';
 const group=$('addCXFields');
 group.hidden=!on;
 for(const el of group.querySelectorAll('input'))el.required=on;
}
$('addForm').elements.system.addEventListener('change',toggleCXInputs);
toggleCXInputs();
$('addForm').onsubmit=e=>{
 e.preventDefault();const f=new FormData(e.target);
 const id='LOCAL-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
 try{
  const bey=L.sanitizeBey({
   id,name:f.get('name'),blade:f.get('blade'),system:f.get('system'),
   spinDirection:f.get('spinDirection'),ownMarket:f.get('market'),ratchet:f.get('ratchet'),bit:f.get('bit'),
   lockChip:f.get('lockChip'),mainBlade:f.get('mainBlade'),assistBlade:f.get('assistBlade')
  });
  if(bey.system==='CX'&&(!bey.lockChip||!bey.mainBlade||!bey.assistBlade))throw Error('CX 必須填寫紋章、主刃與輔助刃');
  DB.packages.push(L.makePackage(bey));DB.beys.push(bey);
  save();all();renderManualAbilityOptions();e.target.reset();toggleCXInputs();
  window.dispatchEvent(new Event('bbx-inventory-updated'));
  notify('已新增至本機。請填入有來源的能力數值，再用於分析。');
 }catch(error){notify('無法新增：'+error.message)}
};
/* Optional, explicitly user-entered part scores. Never invent missing catalog ratings. */
function renderManualAbilityOptions(){
 const select=$('manualAbilityBey');if(!select)return;
 const previous=select.value;
 const added=DB.beys.filter(b=>L.ownId(b.id));
 select.innerHTML='<option value="">選擇新收藏</option>'+added.map(b=>opt(b.id,b.name,previous)).join('');
 const status=$('manualAbilityStatus');if(!added.length)status.textContent='尚未新增本機收藏。先在上方新增陀螺。';
 renderManualAbilityPartOptions();
}
function renderManualAbilityPartOptions(){
 const selector=$('manualAbilityPart'),b=getBey($('manualAbilityBey').value);
 if(!selector)return;
 const kinds=b?.system==='CX'?['blade','lockChip','mainBlade','assistBlade','ratchet','bit']:['blade','ratchet','bit'];
 const names={blade:'完整戰刃',lockChip:'CX 鎖定紋章',mainBlade:'CX 主刃',assistBlade:'CX 輔助刃',ratchet:'固鎖',bit:'軸心'};
 const before=selector.value;
 selector.innerHTML=kinds.map(kind=>opt(kind,names[kind],before)).join('');
 renderManualAbilityValues();
}
function renderManualAbilityValues(){
 const b=getBey($('manualAbilityBey')?.value);
 const kind=$('manualAbilityPart')?.value;
 const r=customAbilities[b?.id]?.parts?.[kind];
 const frm=$('manualAbilityForm');if(!frm)return;
 for(const name of ['attack','defense','stamina','dash','burst']){
  const input=frm.elements[name];
  input.value=Number.isFinite(r?.stats?.[name])?r.stats[name]:(['dash','burst'].includes(name)&&kind!=='bit'?0:'');
  input.required=kind==='bit'||!['dash','burst'].includes(name);
  input.disabled=['dash','burst'].includes(name)&&kind!=='bit';
 }
 frm.elements.partType.value=r?.type||'balance';
 frm.elements.sourceUrl.value=r?.sourceUrl||'';
}
$('manualAbilityBey')?.addEventListener('change',renderManualAbilityPartOptions);
$('manualAbilityPart')?.addEventListener('change',renderManualAbilityValues);
$('manualAbilityForm')?.addEventListener('submit',event=>{
 event.preventDefault();
 const frm=event.currentTarget,b=getBey($('manualAbilityBey').value),kind=$('manualAbilityPart').value;
 if(!b||!L.ownId(b.id)){notify('請先選擇本機新增陀螺');return}
 const stats={};
 for(const k of ['attack','defense','stamina','dash','burst']){
  const input=frm.elements[k];stats[k]=input.disabled?0:Number(input.value);
  if(!input.disabled&&input.value===''){notify('請先完整填寫能力值，未知值不能自動假設為 0');return}
 }
 try{
  const rec=L.sanitizeAbility(b.id,kind,{stats,type:frm.elements.partType.value,
   sourceUrl:frm.elements.sourceUrl.value},b);
  const entry=customAbilities[b.id]||{id:b.id,name:b.name,system:b.system,spinDirection:b.spinDirection,parts:{}};
  entry.parts[kind]=rec;customAbilities[b.id]=entry;
  window.BBX_PART_STATS.beys[b.id]=entry;
  save();renderManualAbilityValues();renderCompleteness();
  $('manualAbilityStatus').textContent=b.name+'／'+kind+' 已保存自填分數。資料尚未經原廠核實。';
  window.dispatchEvent(new Event('bbx-inventory-updated'));
 }catch(error){notify('無法保存能力：'+error.message)}
});

/* Controlled access to live inventory and deck slots for the dedicated analysis module. */
window.BBX_COLLECTION_API={
 getBeys:()=>DB.beys.slice(),
 getBey:id=>getBey(id),
 getPackage:id=>{const b=getBey(id);return b?pack(b):null;},
 getSavedCount:()=>decks.length,
 useSuggestion:(proposals,name)=>{
  if(!Array.isArray(proposals)||!proposals.length)return false;
  const result=[blank(),blank(),blank()];
  proposals.slice(0,3).forEach((p,i)=>{
   const s=blank();
   s.mode=p.mode==='cx'?'cx':'whole';
   if(s.mode==='cx'){
    s.chip=p.chip||'';s.main=p.main||'';s.assist=p.assist||'';
   }else s.blade=p.blade||'';
   s.ratchet=p.ratchet||'';s.bit=p.bit||'';
   result[i]=s;
  });
  const previous=slots;
  slots=result;
  const checked=validate();
  if(checked.errs.length){slots=previous;notify('推薦配置重複或不完整，未套用');return false;}
  $('deckName').value=(name||'自動分析配置').slice(0,48);
  save();renderSlots();nav('builder');
  notify('已載入自動配裝，可自行調整或保存');
  return true;
 }
};
function handleAbilityClick(event){
 const target=event.target.closest('[data-part-owner][data-part-kind]');
 if(!target)return;
 window.BBX_ANALYSIS?.showPart(target.dataset.partOwner,target.dataset.partKind);
}
$('partsList').addEventListener('click',handleAbilityClick);
$('detailContent').addEventListener('click',handleAbilityClick);

function renderCompleteness(){
 const el=$('dataCompleteness');if(!el)return;
 const owned=DB.beys.filter(b=>!b.id.startsWith('LOCAL-'));
 const pending=owned.filter(b=>b.imageStatus!=='verified_png');
 const missing=(window.BBX_PART_PHYSICS?.unverified||[]).filter(x=>x.status!=='resolved');
 const userPending=DB.beys.filter(b=>L.ownId(b.id)&&!window.BBX_PART_STATS?.beys?.[b.id]?.parts?.blade);
 const conflicts=(window.BBX_PART_PHYSICS?.statConflicts||[]).filter(x=>x.status==='unresolved');
 el.innerHTML='<p>完整陀螺透明圖：'+(owned.length-pending.length)+' / '+owned.length+' 顆。待核對 '+pending.length+' 顆。另有 '+missing.length+' 筆戰刃參考重量尚未查證，以及 '+conflicts.length+' 筆能力數值來源衝突，另有 '+userPending.length+' 顆本機新增收藏尚未登錄戰刃能力。</p>'+
 '<div class="completeness-links">'+pending.map(b=>'<div><strong>'+esc(b.name)+'</strong>：完整透明圖待核對'+
 (b.wholeReferencePage?.startsWith('https://')?' · <a href="'+esc(b.wholeReferencePage)+'" target="_blank" rel="noopener noreferrer">'+esc(b.wholeReferenceNote||'查看同款商品參考')+'</a>':'')+'</div>').join('')+'</div>'+
 '<p>BX／UX 不使用的 CX 子零件，不列入缺圖。缺乏原始秤重或有爭議的能力值，仍保留待查證狀態。</p>'+
 '<p><a href="https://github.com/Hey966/BEYBLADE-X/blob/main/docs/missing-data-audit-2026-11-18.md" target="_blank" rel="noopener noreferrer">查看逐項查核報告</a></p>';
}
function all(){countStats();renderFilters();renderCollection();renderParts();renderSlots();renderSaved();renderCompleteness();renderManualAbilityOptions();}
$('search').oninput=renderCollection;$('marketFilter').onchange=renderCollection;
all();
})();
