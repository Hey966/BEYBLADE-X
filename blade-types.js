/* Display-only Blade categories; preserve original release-type records. */
(function(root){
 'use strict';
 const titles=Object.freeze({attack:'攻擊型',defense:'防禦型',stamina:'持久型',balance:'平衡型'});
 const parts=root.BBX_PART_STATS?.beys||{};
 const kinds=['blade','mainBlade','assistBlade'];
 const byCode=new Map();
 for(const bey of root.BBX_SEED?.beys||[]){
  for(const kind of kinds){
   const code=String(bey[kind]??'').trim().toUpperCase();
   const category=parts[bey.id]?.parts?.[kind]?.type;
   if(!code||!titles[category])continue;
   const key=kind+':'+code;
   if(!byCode.has(key))byCode.set(key,category);
   else if(byCode.get(key)!==category)byCode.set(key,null);
  }
 }
 function type(code,owner,kind='blade'){
  if(!kinds.includes(kind))return null;
  const recorded=parts[owner]?.parts?.[kind]?.type;
  if(titles[recorded])return recorded;
  return byCode.get(kind+':'+String(code??'').trim().toUpperCase())||null;
 }
 function suffix(code,owner,kind='blade'){
  return '（'+(titles[type(code,owner,kind)]||'類型待查證')+'）';
 }
 function label(code,owner,kind='blade'){
  const value=String(code??'').trim();
  return value?value+suffix(value,owner,kind):'未登記';
 }
 root.BBX_BLADE_TYPES=Object.freeze({type,suffix,label,titles});
})(window);
