/* Orbit camera for the Xtreme Stadium. Camera movement never alters battle physics. */
(function(root){
'use strict';
const rad=Math.PI/180;
const defaults=Object.freeze({yaw:0,elevation:41*rad,distance:4.65});
const limits=Object.freeze({minElevation:12*rad,maxElevation:82*rad,minDistance:2.7,maxDistance:7.2});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function project(s){
 const yaw=Number(s?.yaw)||0,elev=clamp(Number(s?.elevation)||defaults.elevation,limits.minElevation,limits.maxElevation);
 const dist=clamp(Number(s?.distance)||defaults.distance,limits.minDistance,limits.maxDistance);
 return{x:Math.sin(yaw)*Math.cos(elev)*dist,y:Math.sin(elev)*dist,z:Math.cos(yaw)*Math.cos(elev)*dist};
}
function create(canvas,camera,onChange){
 const state={...defaults},pointers=new Map(),listeners=[];
 let lastPinch=0;
 const listen=(name,fn,opts)=>{canvas.addEventListener(name,fn,opts);listeners.push(()=>canvas.removeEventListener(name,fn,opts))};
 const apply=(kick={})=>{const p=project(state);camera.position.set(p.x+(kick.x||0),p.y+(kick.y||0),p.z+(kick.z||0));camera.lookAt(0,.02,0)};
 const render=()=>{apply();onChange?.()};
 function preset(name){
  if(name==='top')Object.assign(state,{yaw:0,elevation:80*rad,distance:5.4});
  else if(name==='front')Object.assign(state,{yaw:0,elevation:31*rad,distance:4.95});
  else Object.assign(state,defaults);
  render();
 }
 const distance=()=>{const p=[...pointers.values()];return p.length===2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0};
 canvas.style.touchAction='none';
 canvas.setAttribute('aria-label','拖曳可 360 度旋轉的 3D 戰鬥盤，雙指或滾輪可縮放');
 listen('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  canvas.setPointerCapture?.(e.pointerId);lastPinch=distance();e.preventDefault?.();
 });
 listen('pointermove',e=>{
  const previous=pointers.get(e.pointerId);if(!previous)return;
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===1){
   state.yaw+=(e.clientX-previous.x)*.008;
   state.elevation=clamp(state.elevation+(e.clientY-previous.y)*.006,limits.minElevation,limits.maxElevation);
  }else if(pointers.size===2){
   const next=distance();
   if(lastPinch>0&&next>0)state.distance=clamp(state.distance*lastPinch/next,limits.minDistance,limits.maxDistance);
   lastPinch=next;
  }
  render();e.preventDefault?.();
 });
 const end=e=>{pointers.delete(e.pointerId);lastPinch=distance()};
 for(const name of ['pointerup','pointercancel','lostpointercapture'])listen(name,end);
 listen('wheel',e=>{
  state.distance=clamp(state.distance*Math.exp(e.deltaY*.001),limits.minDistance,limits.maxDistance);
  render();e.preventDefault?.();
 },{passive:false});
 listen('contextmenu',e=>e.preventDefault());
 apply();
 return{apply,preset,getState:()=>({...state}),destroy:()=>{listeners.forEach(fn=>fn());pointers.clear()}};
}
root.BBX_STADIUM_CAMERA=Object.freeze({create,project,defaults,limits});
})(typeof window!=='undefined'?window:this);
