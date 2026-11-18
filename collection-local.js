/* Local collection record validation and repeatable backup migration. */
(function(root){
'use strict';
const PARTS=['blade','ratchet','bit','lockChip','mainBlade','assistBlade'];
const MODES=['whole','cx'];
const asText=(v,max=100)=>String(v??'').trim().slice(0,max);
const ownId=id=>/^LOCAL-[A-Za-z0-9-]{3,60}$/.test(id);
const role=type=>['attack','defense','stamina','balance'].includes(type)?type:null;
function sanitizeBey(row){
 if(!row||!ownId(row.id))throw Error('新增收藏編號不正確');
 const system=['BX','UX','CX'].includes(row.system)?row.system:null;
 const spinDirection=['L','R'].includes(row.spinDirection)?row.spinDirection:null;
 const market=['US','JP'].includes(row.ownMarket)?row.ownMarket:null;
 const name=asText(row.name,80),blade=asText(row.blade,60);
 const ratchet=asText(row.ratchet,20),bit=asText(row.bit,20);
 if(!system||!market||!name||!blade||!spinDirection||!/^[0-9]{1,2}-[0-9]{2,3}$/u.test(ratchet)||!/^[a-z0-9-]{1,12}$/iu.test(bit))throw Error('新增收藏名稱、規格、版本或迴旋方向不完整');
 const cx=system==='CX';
 return {id:row.id,name,packageId:'PKG-'+row.id,ownMarket:market,system,spinDirection,
  type:asText(row.type,25)||null,blade,
  lockChip:cx?asText(row.lockChip,50)||null:null,
  mainBlade:cx?asText(row.mainBlade,60)||null:null,
  assistBlade:cx?asText(row.assistBlade,60)||null:null,
  additionalBladeParts:[],ratchet,bit,
  currentBuild:null,imagePath:null,imageStatus:'pending_user_photo',
  manufacturerBeyCode:null,displayImagePath:null,referenceImageUrl:null,
  partImages:{},specialEdition:null};
}
function makePackage(b){
 return{id:'PKG-'+b.id,title:'手動新增：'+b.name,manufacturer:b.ownMarket==='US'?'Hasbro':'Takara Tomy',
  market:b.ownMarket,count:1,productCode:'自行登記',sourceUrl:null};
}
function sanitizeSlots(value){
 if(!Array.isArray(value)||value.length!==3)throw Error('組裝槽數量不正確');
 return value.map(row=>{if(!row||!MODES.includes(row.mode))throw Error('組裝模式不正確');
  const x={mode:row.mode};
  for(const key of ['blade','chip','main','assist','ratchet','bit']){
   const id=asText(row[key],90);
   if(id&&!(ownId(id)||/^OWN-[A-Za-z0-9-]{1,80}$/.test(id)))throw Error('組裝槽零件來源編號不正確');
   x[key]=id;
  }
  return x;
 });
}
function sanitizeAbility(owner,kind,part,bey){
 if(!bey||bey.id!==owner||!PARTS.includes(kind)||!part||typeof part!=='object')throw Error('能力紀錄來源錯誤');
 if(bey.system!=='CX'&&['lockChip','mainBlade','assistBlade'].includes(kind))throw Error('BX／UX 不包含 CX 模組');
 const stats={};
 for(const k of ['attack','defense','stamina','dash','burst']){
  const v=part.stats?.[k];
  if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100)throw Error('能力數值必須介於 0～100');
  stats[k]=v;
 }
 let height=0;
 if(kind==='ratchet'){
  height=Number(bey.ratchet.split('-')[1]);
  if(!Number.isFinite(height)||height<30||height>200)throw Error('固鎖高度不合理');
 }
 const kindName={blade:bey.blade,ratchet:bey.ratchet,bit:bey.bit,lockChip:bey.lockChip,mainBlade:bey.mainBlade,assistBlade:bey.assistBlade};
 const name=asText(kindName[kind],80);
 if(!name||name==='未登記')throw Error('請先補齊對應零件名稱');
 const type=role(part.type);
 if(kind==='bit'&&!type)throw Error('軸心需要選擇攻擊／防禦／持久／平衡類型');
 const source=asText(part.sourceUrl,400);
 if(source&&!/^https:\/\/[^\s]+$/i.test(source))throw Error('資料來源網址必須使用 HTTPS');
 return{id:'USER-'+owner+'-'+kind.toUpperCase(),available:true,name,type,
  weightG:null,stats:{...stats,height,weight:0},sourceUrl:source,
  verification:{status:'user-entered-unverified',evidenceGrade:'user-input',
   note:'使用者自填能力值；未經原廠標籤或量測獨立核實'}};
}
function parseBackup(raw,seedIds){
 if(!raw||typeof raw!=='object'||(raw.format&&raw.format!=='BBX-966-BACKUP'))throw Error('備份格式不符');
 if(raw.format==='BBX-966-BACKUP'&&![1,2].includes(raw.version))throw Error('不支援此版本的備份');
 if(!Array.isArray(raw.additions)||!Array.isArray(raw.decks))throw Error('備份缺少收藏或配置清單');
 if(raw.additions.length>100||raw.decks.length>100)throw Error('備份數量超過上限');
 const additions=[],known=new Set(seedIds||[]),packageIds=new Set();
 for(const row of raw.additions){
  const b=sanitizeBey(row);
  if(known.has(b.id))throw Error('重複收藏編號：'+b.id);
  known.add(b.id);additions.push(b);packageIds.add(b.packageId);
 }
 const packages=additions.map(makePackage);
 const slots=raw.slots?sanitizeSlots(raw.slots):[0,1,2].map(()=>({mode:'whole',blade:'',chip:'',main:'',assist:'',ratchet:'',bit:''}));
 const decks=[];
 for(const row of raw.decks){
  if(!row||typeof row.id!=='string'||!Array.isArray(row.slots))throw Error('保存配置格式錯誤');
  decks.push({id:asText(row.id,90),name:asText(row.name,48)||'未命名配置',
   createdAt:asText(row.createdAt,40),slots:sanitizeSlots(row.slots)});
 }
 const customAbilities={};
 if(raw.customAbilities!=null){
  if(typeof raw.customAbilities!=='object'||Array.isArray(raw.customAbilities))throw Error('能力欄位格式不正確');
  for(const [owner,entry] of Object.entries(raw.customAbilities)){
   const b=additions.find(x=>x.id===owner);
   if(!b||!entry||typeof entry!=='object')throw Error('能力紀錄找不到所屬陀螺');
   const parts={};
   for(const [kind,p] of Object.entries(entry.parts||{}))parts[kind]=sanitizeAbility(owner,kind,p,b);
   customAbilities[owner]={id:owner,name:b.name,system:b.system,spinDirection:b.spinDirection,parts};
  }
 }
 return{additions,packages,decks,slots,customAbilities};
}
root.BBX_LOCAL=Object.freeze({parseBackup,sanitizeBey,sanitizeAbility,sanitizeSlots,makePackage,ownId});
})(typeof window!=='undefined'?window:this);
