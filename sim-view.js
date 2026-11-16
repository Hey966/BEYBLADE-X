/* BEYBLADE X simulation presentation V1.1
   3D geometry is approximate. The visible blade/ratchet/bit assets come from
   the *chosen* inventory parts; no per-product measured 3D geometry is claimed.
   Both WebGL and Canvas fallback visualize the very same sim-engine state. */
(function(root){
'use strict';
const THREE_CDN='https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
const TAU=2*Math.PI;
function create(container,status,api){
 let currentArena='xtreme',lastState=null,lastFinishAge=0;
 let THREE=null,renderer=null,world=null,camera=null,stadium=null,rail=null,pockets=null,floorMaterial=null;
 let rendered=[null,null],visualBuilds=[null,null],renderVersion=0;
 const imageCache=new Map();
 const fallback=document.createElement('canvas');
 fallback.className='sim-canvas-fallback';
 fallback.setAttribute('aria-label','同一物理狀態的二維競技場備援視角');
 container.replaceChildren(fallback);
 const ctx=fallback.getContext('2d');
 const getBey=id=>api?.getBey?.(id)||null;
 function part(owner,kind){
  const b=getBey(owner);
  return b?.partImages?.[kind]||(kind==='blade'?b?.displayImagePath:'')||'';
 }
 function getParts(spec){
  if(!spec?.config)return [];
  const c=spec.config;
  if(c.mode==='cx')return [
   {kind:'mainBlade',name:'CX 主刃',owner:c.main,src:part(c.main,'mainBlade'),size:.31},
   {kind:'assistBlade',name:'CX 輔助刃',owner:c.assist,src:part(c.assist,'assistBlade'),size:.265},
   {kind:'lockChip',name:'CX 鎖定紋章',owner:c.chip,src:part(c.chip,'lockChip'),size:.110},
   {kind:'ratchet',name:'固鎖',owner:c.ratchet,src:part(c.ratchet,'ratchet'),size:.110},
   {kind:'bit',name:'軸心',owner:c.bit,src:part(c.bit,'bit'),size:.070}
  ];
  return [
   {kind:'blade',name:'戰刃',owner:c.blade,src:part(c.blade,'blade'),size:.33},
   {kind:'ratchet',name:'固鎖',owner:c.ratchet,src:part(c.ratchet,'ratchet'),size:.115},
   {kind:'bit',name:'軸心',owner:c.bit,src:part(c.bit,'bit'),size:.075}
  ];
 }
 function getImage(src){
  if(!src)return null;
  if(imageCache.has(src))return imageCache.get(src);
  const entry={image:null,ready:false,error:false};
  imageCache.set(src,entry);
  const image=new Image();
  image.crossOrigin='anonymous';
  image.onload=()=>{
   entry.image=image;entry.ready=true;
   if(!renderer)draw2D(lastState,lastFinishAge);
  };
  image.onerror=()=>{entry.error=true};
  image.src=src;
  return entry;
 }
 function getImageCanvas(image){
  const source=document.createElement('canvas');
  const max=512,scale=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));
  source.width=Math.max(1,Math.round(image.naturalWidth*scale));
  source.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const c=source.getContext('2d',{willReadFrequently:true});
  c.drawImage(image,0,0,source.width,source.height);
  const pixels=c.getImageData(0,0,source.width,source.height);
  let left=source.width,right=-1,top=source.height,bottom=-1;
  for(let y=0;y<source.height;y+=2)for(let x=0;x<source.width;x+=2){
   if(pixels.data[(y*source.width+x)*4+3]>28){
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
   }
  }
  if(right<left||bottom<top)return source;
  const side=Math.max(right-left+1,bottom-top+1);
  const out=document.createElement('canvas');out.width=512;out.height=512;
  const outctx=out.getContext('2d');
  outctx.drawImage(source,left,top,right-left+1,bottom-top+1,
   (512-(right-left+1)*482/side)/2,(512-(bottom-top+1)*482/side)/2,
   (right-left+1)*482/side,(bottom-top+1)*482/side);
  return out;
 }
 function visualNames(spec){
  return getParts(spec).map(p=>({name:p.name,value:spec?.parts?.find(q=>q.key===p.kind)?.code||getBey(p.owner)?.name||'',
   image:p.src,owner:p.owner,kind:p.kind}));
 }
 function setBuilds(builds){
  visualBuilds=[builds?.[0]||null,builds?.[1]||null];
  renderVersion++;
  if(THREE&&world){
   rendered.forEach(node=>{if(node){world.remove(node.root);dispose(node.root)}});
   rendered=visualBuilds.map((b,i)=>b?makeTop(b,i,renderVersion):null);
  }
  drawOrRender();
 }
 function drawOrRender(){renderState(lastState,{finalAge:lastFinishAge})}
 function setArena(arena){
  currentArena=arena==='plain'?'plain':'xtreme';
  if(THREE&&world){
   if(rail)rail.visible=currentArena==='xtreme';
   if(pockets)pockets.visible=currentArena==='xtreme';
   if(floorMaterial)floorMaterial.color.setHex(currentArena==='xtreme'?0x1a2e41:0x3a4655);
  }
  drawOrRender();
 }
 function paintImage(ctx,img,cx,cy,side){
  if(!img?.ready)return false;
  try{
   ctx.drawImage(img.image,cx-side/2,cy-side/2,side,side);
   return true;
  }catch(e){return false}
 }
 function draw2D(state,finalAge=0){
  if(!ctx)return;
  const rect=container.getBoundingClientRect(),width=Math.max(270,Math.round(rect.width)),height=Math.max(260,Math.round(rect.height));
  const dpr=Math.min(2,root.devicePixelRatio||1);
  if(fallback.width!==Math.round(width*dpr)||fallback.height!==Math.round(height*dpr)){
   fallback.width=Math.round(width*dpr);fallback.height=Math.round(height*dpr)
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const cx=width/2,cy=height/2,radius=Math.min(width*.45,height*.44);
  const grad=ctx.createRadialGradient(cx,cy,0,cx,cy,radius*1.18);
  grad.addColorStop(0,currentArena==='xtreme'?'#2c4354':'#465569');
  grad.addColorStop(.85,currentArena==='xtreme'?'#172734':'#27384a');
  grad.addColorStop(1,'#091420');
  ctx.fillStyle=grad;ctx.fillRect(0,0,width,height);
  ctx.beginPath();ctx.arc(cx,cy,radius*1.06,0,TAU);ctx.fillStyle='#a3acb5';ctx.fill();
  ctx.beginPath();ctx.arc(cx,cy,radius,0,TAU);ctx.fillStyle=currentArena==='xtreme'?'#1b2c3c':'#334452';ctx.fill();
  if(currentArena==='xtreme'){
   ctx.strokeStyle='#eb874c';ctx.lineWidth=6;ctx.beginPath();ctx.arc(cx,cy,radius*.87,0,TAU);ctx.stroke();
   for(const angle of [-.70,.65,2.45]){
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,radius*.98,angle-.18,angle+.18);ctx.closePath();
    ctx.fillStyle=angle===-.70?'rgba(238,115,57,.35)':'rgba(61,101,139,.35)';ctx.fill();
   }
  }else{
   ctx.setLineDash([9,10]);ctx.strokeStyle='#8fa6b9';ctx.lineWidth=3;
   ctx.beginPath();ctx.arc(cx,cy,radius*.87,0,TAU);ctx.stroke();ctx.setLineDash([]);
  }
  ctx.setLineDash([2,12]);ctx.strokeStyle='rgba(200,226,237,.35)';ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(cx,cy,radius*.54,0,TAU);ctx.stroke();ctx.setLineDash([]);
  for(let i=0;i<2;i++){
   const t=state?.tops?.[i],spec=visualBuilds[i];if(!t)continue;
   const outcome=state.done?state.terminal:null,loser=outcome?.loser===i,finished=outcome?.finish;
   const age=Math.min(1.2,Math.max(0,finalAge));
   if(loser&&(finished==='over'||finished==='extreme')&&age>1.0)continue;
   const dist=Math.hypot(t.x,t.y)||1;
   const escape=loser&&(finished==='over'||finished==='extreme')?age*.5:0;
   const px=cx+(t.x+t.x/dist*escape)/1.32*radius*.95;
   const py=cy+(t.y+t.y/dist*escape)/1.32*radius*.95;
   const r=Math.max(15,radius*(spec?.radius||.13)/1.32*1.65);
   ctx.save();ctx.translate(px,py);
   ctx.rotate(t.heading+(state.done&&outcome?.winner===i?t.spin*age*.46*t.spinSign:0)+(loser&&finished==='spin'?age*1.5:0));
   const collapsed=loser&&finished==='spin'?Math.max(.23,1-age*.6):1;
   ctx.scale(1,collapsed);
   if(loser&&finished==='burst'&&age>.1){
    ctx.fillStyle=i===0?'#bde1ef':'#f6bc89';
    for(let k=0;k<3;k++){
     const angle=k*TAU/3+0.6;
     ctx.save();ctx.translate(Math.cos(angle)*age*r*2,Math.sin(angle)*age*r*2);
     ctx.rotate(angle+age*3);ctx.fillRect(-r*.45,-r*.18,r*.9,r*.36);ctx.restore();
    }
   }
   const pieces=getParts(spec),primary=pieces.find(p=>p.kind==='blade'||p.kind==='mainBlade')||pieces[0];
   const texture=getImage(primary?.src);
   ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fillStyle=i===0?'#a4d3dd':'#e5a47b';ctx.fill();
   const drawn=paintImage(ctx,texture,0,0,r*2.24);
   if(!drawn){
    ctx.strokeStyle='#f0dec2';ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle='#30465c';ctx.beginPath();ctx.arc(0,0,r*.42,0,TAU);ctx.fill();
   }
   if(spec?.mode==='cx'){
    const chip=pieces.find(p=>p.kind==='lockChip');
    paintImage(ctx,getImage(chip?.src),0,0,r*.74);
   }
   ctx.restore();
  }
  ctx.font='11px system-ui';ctx.fillStyle='#bcd7e9';
  ctx.fillText(currentArena==='xtreme'?'Xtreme 模擬盤｜Xtreme Line':'練習圓盤｜無 Xtreme Line',12,19);
  if(state?.done){
   const labels={spin:'迴轉勝利',burst:'爆裂勝利',over:'擊飛勝利',extreme:'極限勝利',draw:'平手'};
   ctx.font='bold 15px system-ui';ctx.fillStyle='#ffddab';
   ctx.fillText(labels[state.finish]||'',12,height-20);
  }
 }
 function dispose(node){
  node.traverse(c=>{
   if(c.geometry)c.geometry.dispose?.();
   const materials=c.material?[].concat(c.material):[];
   materials.forEach(m=>{m.map?.dispose?.();m.dispose?.()});
  });
 }
 function modelColor(str){
  let seed=0;for(const ch of String(str||''))seed=(seed*31+ch.charCodeAt(0))>>>0;
  const palette=[0x93b3c4,0xe8b56b,0xa4d4d8,0xbd92c4,0xb8c678,0xd2a3a0,0xe7d4aa];
  return palette[seed%palette.length];
 }
 function makeTop(spec,i,version){
  const g=new THREE.Group(),parts=getParts(spec),heightCode=Number(spec.ratchetHeight)||60;
  const metallic=new THREE.MeshStandardMaterial({color:modelColor(spec.name),metalness:.78,roughness:.26});
  const under=new THREE.MeshStandardMaterial({color:modelColor(spec.config.bit),metalness:.34,roughness:.33});
  const ringMaterial=new THREE.MeshStandardMaterial({color:modelColor(spec.config.ratchet),metalness:.40,roughness:.36});
  const body=new THREE.Group(),ratchet=new THREE.Group(),bit=new THREE.Group();
  const shapeIndex=spec.mode==='cx'?8:10;
  const blade=new THREE.Mesh(new THREE.CylinderGeometry(.142,.113,.042,shapeIndex),metallic);
  blade.position.y=.127;body.add(blade);
  for(let j=0;j<7;j++){
   const element=new THREE.Mesh(new THREE.BoxGeometry(.048,.013,.048),metallic);
   const theta=j*TAU/7;
   element.position.set(Math.cos(theta)*.115,.15,Math.sin(theta)*.115);
   element.rotation.y=theta;body.add(element);
  }
  const ratchetBody=new THREE.Mesh(new THREE.CylinderGeometry(.071,.061,.04,Math.max(6,Math.min(12,Number(String(spec.config?.ratchet||'6').charAt(0))*2))),ringMaterial);
  ratchetBody.position.y=.085+(heightCode-60)*.0004;ratchet.add(ratchetBody);
  const bitBody=new THREE.Mesh(new THREE.CylinderGeometry(.035,.015,.06,8),under);
  bitBody.position.y=.034;bit.add(bitBody);
  g.add(body,ratchet,bit);
  const centers={blade:.169,mainBlade:.172,assistBlade:.185,lockChip:.202,ratchet:.109,bit:.045};
  const dimensions={blade:.328,mainBlade:.326,assistBlade:.276,lockChip:.12,ratchet:.10,bit:.059};
  const textureKinds=parts.filter(p=>['blade','mainBlade','assistBlade','lockChip'].includes(p.kind));
  for(const p of textureKinds){
   if(!p.src)continue;
   const token=version;
   const img=new Image();
   img.onload=()=>{
    if(renderVersion!==token||!THREE||!world)return;
    try{
     const square=getImageCanvas(img),texture=new THREE.CanvasTexture(square);
     texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer?.capabilities?.getMaxAnisotropy?.()||1);
     const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide});
     const plane=new THREE.Mesh(new THREE.PlaneGeometry(dimensions[p.kind],dimensions[p.kind]),material);
     plane.rotation.x=-Math.PI/2;plane.position.y=centers[p.kind];
     body.add(plane);
    }catch(error){console.warn('Image cannot be mapped to 3D:',p.src,error)}
   };
   img.onerror=()=>console.warn('Missing reference image',p.src);
   img.src=p.src;
  }
  g.position.set(i===0?-.4: .4,0,0);
  world.add(g);
  return{root:g,blade:body,ratchet,bit};
 }
 async function init3D(){
  try{
   const T=await import(THREE_CDN);const gl=new T.WebGLRenderer({antialias:true,powerPreference:'low-power'});
   gl.setPixelRatio(Math.min(1.7,root.devicePixelRatio||1));
   gl.setClearColor(0x091421,1);gl.outputColorSpace=T.SRGBColorSpace;
   const scene=new T.Scene();
   scene.fog=new T.Fog(0x091421,4.4,7.8);
   const cam=new T.PerspectiveCamera(48,1,.1,25);
   cam.position.set(0,2.65,2.75);cam.lookAt(0,0,0);
   scene.add(new T.HemisphereLight(0xcfe6ff,0x304151,2.5));
   const key=new T.DirectionalLight(0xfaf0da,2.9);key.position.set(-1.7,3,2);scene.add(key);
   const group=new T.Group();
   const mat=new T.MeshStandardMaterial({color:0x1a2e41,metalness:.3,roughness:.55});
   const basin=new T.Mesh(new T.CylinderGeometry(1.31,1.36,.14,96),mat);basin.position.y=-.10;group.add(basin);
   const floor=new T.Mesh(new T.CylinderGeometry(1.29,1.29,.015,96),mat);floor.position.y=-.013;group.add(floor);
   const rim=new T.Mesh(new T.TorusGeometry(1.36,.048,12,110),
    new T.MeshStandardMaterial({color:0xaebac5,metalness:.62,roughness:.3}));
   rim.rotation.x=Math.PI/2;rim.position.y=.016;group.add(rim);
   const guide=new T.Mesh(new T.TorusGeometry(1.15,.025,10,100),
    new T.MeshStandardMaterial({color:0xff9857,emissive:0x893814,emissiveIntensity:.55,metalness:.38}));
   guide.rotation.x=Math.PI/2;guide.position.y=.018;group.add(guide);
   const pocketsGroup=new T.Group();
   for(const [j,theta] of [-.70,.65,2.45].entries()){
    const pocket=new T.Mesh(new T.RingGeometry(1.02,1.28,18,1,theta-.26,.52),
     new T.MeshBasicMaterial({color:j===0?0xf2894d:0x507c9a,transparent:true,opacity:.58,side:T.DoubleSide,depthWrite:false}));
    pocket.rotation.x=-Math.PI/2;pocket.position.y=.02;pocketsGroup.add(pocket);
   }
   group.add(pocketsGroup);
   for(let j=0;j<48;j++){
    const theta=j*TAU/48;
    const dot=new T.Mesh(new T.BoxGeometry(.027,.006,.017),
     new T.MeshBasicMaterial({color:j%8===0?0xeed493:0x7794aa}));
    dot.position.set(Math.cos(theta)*.98,.01,Math.sin(theta)*.98);
    dot.rotation.y=-theta;group.add(dot);
   }
   scene.add(group);
   THREE=T;renderer=gl;world=scene;camera=cam;stadium=group;rail=guide;pockets=pocketsGroup;floorMaterial=mat;
   container.replaceChildren(gl.domElement);
   gl.domElement.className='sim-three-canvas';
   setArena(currentArena);
   setBuilds(visualBuilds);
   status.textContent='3D 即時畫面：套用所選零件 PNG（外形為近似模型）';
   renderState(lastState,{finalAge:lastFinishAge});
  }catch(error){
   status.textContent='3D 載入失敗，已改用相同物理狀態的 2D 畫面。';
   console.warn('WebGL/Three.js unavailable',error);
  }
 }
 function renderState(state,opts={}){
  lastState=state||null;
  lastFinishAge=Math.max(0,Math.min(1.3,Number(opts.finalAge)||0));
  if(!renderer||!THREE||!world){draw2D(lastState,lastFinishAge);return}
  const rect=container.getBoundingClientRect(),w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));
  if(w<30)return;
  const pixelRatio=renderer.getPixelRatio();
  if(renderer.domElement.width!==Math.round(w*pixelRatio)||renderer.domElement.height!==Math.round(h*pixelRatio)){
   renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  for(let i=0;i<2;i++){
   const t=state?.tops?.[i],mesh=rendered[i];
   if(!mesh)continue;
   mesh.root.visible=!!t;
   if(!t)continue;
   const terminal=state.done?state.terminal:null;
   const loser=terminal?.loser===i,finish=terminal?.finish;
   const age=lastFinishAge,dist=Math.max(.01,Math.hypot(t.x,t.y));
   let x=t.x,z=t.y;
   if(loser&&(finish==='over'||finish==='extreme')){
    x+=t.x/dist*age*.7;z+=t.y/dist*age*.7;
   }
   mesh.root.position.set(x,.016+(loser&&finish==='burst'?age*.014:0),z);
   mesh.root.rotation.y=t.heading+(terminal?.winner===i?t.spin*age*.46*t.spinSign:0);
   mesh.root.rotation.x=Math.cos(t.heading*.38)*Math.min(.12,t.wobble*.07);
   mesh.root.rotation.z=Math.sin(t.heading*.38)*Math.min(.12,t.wobble*.07);
   if(loser&&finish==='spin'){
    mesh.root.rotation.z+=Math.min(1.2,age*1.0);
    mesh.root.position.y=Math.max(-.004,.016-age*.012);
   }
   if(loser&&(finish==='over'||finish==='extreme')){
    mesh.root.rotation.z+=age*1.7;
    mesh.root.position.y+=age*.11;
   }
   if(loser&&finish==='burst'){
    mesh.blade.position.set(age*.32,age*.21,age*.18);
    mesh.ratchet.position.set(-age*.20,age*.02,age*.27);
    mesh.bit.position.set(age*.05,-age*.07,-age*.20);
   }else{
    mesh.blade.position.set(0,0,0);mesh.ratchet.position.set(0,0,0);mesh.bit.position.set(0,0,0);
   }
  }
  if(rail)rail.material.emissiveIntensity=(state?.tops?.some(t=>t.railCooldown>2)?1.15:.55);
  renderer.render(world,camera);
 }
 init3D();
 draw2D(null);
 return{
  render:renderState,setArena,setBuilds,
  getVisuals:visualNames,
  destroy(){
   rendered.forEach(n=>{if(n){world?.remove(n.root);dispose(n.root)}});
   renderer?.dispose();container.replaceChildren();
  }
 };
}
root.BBX_SIM_VIEW={create};
})(typeof window!=='undefined'?window:this);
