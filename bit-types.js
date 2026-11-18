/* Display-only BEYBLADE X Bit classifications. Keep physical Bit codes unchanged. */
/* Edition-specific classifications come from data/part-abilities.js. */
/* Cross-check: https://beybladewiki.com/zh/toys/parts/x/bit */
(function(root){
 'use strict';
 const titles=Object.freeze({attack:'攻擊型',defense:'防禦型',stamina:'持久型',balance:'平衡型'});
 const records=root.BBX_PART_STATS?.beys||{};
 const byCode=new Map();
 for(const bey of root.BBX_SEED?.beys||[]){
  const code=String(bey.bit||'').trim().toUpperCase();
  const category=records[bey.id]?.parts?.bit?.type;
  if(!code||!titles[category])continue;
  if(byCode.has(code)&&byCode.get(code)!==category)
   console.warn('軸心類型來源不一致：'+code);
  else byCode.set(code,category);
 }
 function type(code,owner){
  const recorded=records[owner]?.parts?.bit?.type;
  if(titles[recorded])return recorded;
  return byCode.get(String(code||'').trim().toUpperCase())||null;
 }
 function suffix(code,owner){
  return '（'+(titles[type(code,owner)]||'類型待查證')+'）';
 }
 function label(code,owner){
  const value=String(code??'').trim();
  return value?value+suffix(value,owner):'未登記';
 }
 root.BBX_BIT_TYPES=Object.freeze({type,suffix,label,titles});
})(window);
