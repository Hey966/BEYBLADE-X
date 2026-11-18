/* BEYBLADE X simulation presentation V1.1
   3D geometry is approximate. The visible blade/ratchet/bit assets come from
   the *chosen* inventory parts; no per-product measured 3D geometry is claimed.
   Both WebGL and Canvas fallback visualize the very same sim-engine state. */
(function(root){
'use strict';
const THREE_CDN='https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
const TAU=2*Math.PI, COAST_DURATION=4.5;
function coastRotation(top,age){
 if(!top)return 0;
 const t=Math.max(0,Math.min(COAST_DURATION,Number(age)||0));
 // Linear post-finish spin decay integrated into a smooth final angle.
 return top.spinSign*top.spin*.46*(t-t*t/(2*COAST_DURATION));
}
function create(container,status,api){
 let currentArena='xtreme',lastState=null,lastFinishAge=0,lastCoastAge=0;
 let THREE=null,renderer=null,world=null,camera=null,stadium=null,rail=null,pockets=null,floorMaterial=null,rimFull=null,rimOpen=null;
 let rendered=[null,null],visualBuilds=[null,null],renderVersion=0,orbit=null;
 let qualityMode='ultra',quality=root.BBX_SIM_QUALITY?.profile('ultra')||null,lights=null;
 const imageCache=new Map();
 let activeBattle=null,eventCursor=0,fx=[],trails=[[],[]],fx3D=null,fxSprites=[],trailLines=[];
 const colors=['#55efff','#ff9b45'];
 function assignMaterialQuality(material){
  const role=material?.userData?.qualityRole;if(!role||!quality)return;
  if(role==='blade'){
   material.metalness=quality.metalness;material.roughness=quality.roughness;
   material.clearcoat=quality.clearcoat;material.clearcoatRoughness=quality.id==='ultra'?.12:.28;
  }else if(role==='under'){
   material.metalness=quality.metalness*.5;material.roughness=quality.roughness+.13;
  }else if(role==='ratchet'){
   material.metalness=quality.metalness*.28;material.roughness=quality.roughness+.15;
  }else if(role==='guard'){
   material.opacity=quality.guardOpacity;material.roughness=quality.id==='ultra'?.16:.34;
   material.clearcoat=quality.clearcoat;material.clearcoatRoughness=.16;
  }else if(role==='shell'){
   material.roughness=quality.id==='ultra'?.37:.52;
  }else if(role==='floor'){
   material.roughness=quality.id==='ultra'?.40:.59;
  }else if(role==='rail'){
   material.roughness=quality.id==='ultra'?.24:.38;
  }
  material.needsUpdate=true;
 }
 function applyQuality(){
  if(!renderer||!THREE||!world||!quality)return;
  const dpr=root.BBX_SIM_QUALITY?.resolutionScale(qualityMode,root.devicePixelRatio||1)||1;
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled=quality.shadows;
  renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.shadowMap.needsUpdate=true;
  renderer.toneMapping=quality.toneMapping?THREE.ACESFilmicToneMapping:THREE.NoToneMapping;
  renderer.toneMappingExposure=quality.exposure;
  if(lights){
   lights.hemi.intensity=quality.hemisphere;
   lights.key.intensity=quality.keyIntensity;
   lights.key.castShadow=quality.shadows;
   lights.fill.intensity=quality.fillIntensity;
   lights.rim.intensity=quality.rimIntensity;
   const size=Math.max(256,quality.shadowSize);
   if(lights.key.shadow.mapSize.x!==size){
    lights.key.shadow.map?.dispose?.();
    lights.key.shadow.map=null;
    lights.key.shadow.mapSize.set(size,size);
   }
   lights.key.shadow.radius=quality.id==='ultra'?1.6:2.5;
  }
  world.traverse(obj=>{
   const materials=obj.material?[].concat(obj.material):[];
   materials.forEach(assignMaterialQuality);
  });
  rendered.forEach(node=>{
   if(!node)return;
   if(node.shadow)node.shadow.visible=quality.contactShadow&&node.root.visible;
   if(node.spinBlur)node.spinBlur.visible=false;
  });
  if(status)status.textContent=quality.label+'畫質｜BX-10 近似 3D｜360° 自由觀看（外形非官方 CAD）';
  drawOrRender();
 }
 function setQuality(mode){
  qualityMode=root.BBX_SIM_QUALITY?.normalize(mode)||'ultra';
  quality=root.BBX_SIM_QUALITY?.profile(qualityMode)||quality;
  if(renderer&&THREE)applyQuality();
  return true;
 }
 function groundShadow(spec){
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
  const context=canvas.getContext('2d');
  const gradient=context.createRadialGradient(32,32,2,32,32,31);
  gradient.addColorStop(0,'rgba(22,37,53,.86)');
  gradient.addColorStop(.40,'rgba(22,37,53,.43)');
  gradient.addColorStop(1,'rgba(22,37,53,0)');
  context.fillStyle=gradient;context.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(canvas);
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:0,
   depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(.50,.50),material);
  shadow.rotation.x=-Math.PI/2;
  shadow.scale.setScalar(Math.max(.6,(spec.radius||.18)/.18));
  shadow.renderOrder=1;shadow.visible=false;world.add(shadow);
  return shadow;
 }
 function updateEffects(state,finalAge){
  if(!state||state!==activeBattle||state.elapsed<(activeBattle?._previousRenderElapsed||0)){
   activeBattle=state;eventCursor=0;fx=[];trails=[[],[]];
  }
  if(!state)return;
  const now=(Number(state.elapsed)||0)+(state.done?finalAge:0);
  const events=state.events||[];
  for(let i=eventCursor;i<events.length;i++){
   const ev=events[i];
   if(['hit','wall','dash','finish','land'].includes(ev.type))
    fx.push({kind:ev.type,x:Number(ev.x)||0,y:Number(ev.y)||0,t:ev.t||state.elapsed,
      strength:Number(ev.strength)||.7,who:ev.who});
  }
  eventCursor=events.length;
  fx=fx.filter(e=>now-e.t<.66).slice(-15);
  if(state.elapsed!==(state._previousRenderElapsed||-1)&&!state.done)
   state.tops.forEach((top,i)=>{
    if(!top.landed)return;
    trails[i].push({x:top.x,y:top.y,t:now});
    trails[i]=trails[i].filter(p=>now-p.t<.73).slice(-34);
   });
  state._previousRenderElapsed=state.elapsed;
 }

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
   if(!renderer)draw2D(lastState,lastFinishAge,lastCoastAge);
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
 function getRatchetCanvas(image){
  const canvas=getImageCanvas(image),c=canvas.getContext('2d');
  const cx=canvas.width/2,cy=canvas.height/2,radius=Math.min(cx,cy);
  // Use the chosen part photo, clipped to the ring rather than a square.
  c.globalCompositeOperation='destination-in';
  c.beginPath();c.arc(cx,cy,radius*.95,0,TAU);c.fill();
  c.globalCompositeOperation='destination-out';
  c.beginPath();c.arc(cx,cy,radius*.28,0,TAU);c.fill();
  c.globalCompositeOperation='source-over';
  return canvas;
 }
 function visualNames(spec){
  return getParts(spec).map(p=>({name:p.name,value:spec?.parts?.find(q=>q.key===p.kind)?.code||getBey(p.owner)?.name||'',
   image:p.src,owner:p.owner,kind:p.kind}));
 }
 function setCameraView(preset){if(!orbit)return false;orbit.preset(preset);return true}
  function setBuilds(builds){
  visualBuilds=[builds?.[0]||null,builds?.[1]||null];
  renderVersion++;
  if(THREE&&world){
   rendered.forEach(node=>{if(node){world.remove(node.root);dispose(node.root);
    if(node.shadow){world.remove(node.shadow);dispose(node.shadow);}
   }});
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
   if(rimFull)rimFull.visible=currentArena!=='xtreme';
   if(rimOpen)rimOpen.visible=currentArena==='xtreme';
   if(floorMaterial)floorMaterial.color.setHex(currentArena==='xtreme'?0xeaf0f4:0xa4beca);
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
 function draw2D(state,finalAge=0,coastAge=finalAge){
  if(!ctx)return;
  const rect=container.getBoundingClientRect(),width=Math.max(270,Math.round(rect.width)),height=Math.max(260,Math.round(rect.height));
  const dpr=Math.min(2,root.devicePixelRatio||1);
  if(fallback.width!==Math.round(width*dpr)||fallback.height!==Math.round(height*dpr)){
   fallback.width=Math.round(width*dpr);fallback.height=Math.round(height*dpr)
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const cx=width/2,cy=height/2,radius=Math.min(width*.345,height*.325);
  // Arena reference: white shell, bright lime rail and dark blue floor grid.
  const backdrop=ctx.createLinearGradient(0,0,0,height);
  backdrop.addColorStop(0,'#24508a');backdrop.addColorStop(.5,'#123b78');
  backdrop.addColorStop(1,'#092b62');
  ctx.fillStyle=backdrop;ctx.fillRect(0,0,width,height);
  ctx.strokeStyle='rgba(124,174,229,.12)';ctx.lineWidth=1;
  for(let x=0;x<width;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke()}
  for(let y=0;y<height;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke()}
  const stamp=Number(state?.elapsed)||0;
  const lastImpact=fx.slice().reverse().find(e=>(e.kind==='hit'||e.kind==='wall')&&stamp-e.t>=0&&stamp-e.t<.27);
  const shake=lastImpact?Math.min(4.4,1.1+(lastImpact.strength||.7)*2.4)*(1-(stamp-lastImpact.t)/.27):0;
  ctx.save();
  if(shake)ctx.translate(Math.sin(stamp*103)*shake,Math.cos(stamp*127)*shake);
  // Same official front zones in 2D and 3D; the fallback remains non-orbiting.
  const corners2D=[[-1.38,-1.48],[1.38,-1.48],[1.80,-1.12],[1.80,1.13],
   [1.40,1.48],[-1.40,1.48],[-1.80,1.13],[-1.80,-1.12]];
  const k=radius/1.32;
  ctx.beginPath();
  corners2D.forEach(([x,z],i)=>i?ctx.lineTo(cx+x*k,cy+z*k):ctx.moveTo(cx+x*k,cy+z*k));
  ctx.closePath();ctx.fillStyle='#e5edf1';
  ctx.shadowColor='rgba(8,15,27,.42)';ctx.shadowBlur=12;ctx.fill();ctx.shadowBlur=0;
  ctx.lineWidth=5;ctx.strokeStyle='#b7c7d2';ctx.stroke();
  const bowlColor=ctx.createRadialGradient(cx,cy,radius*.03,cx,cy,radius);
  bowlColor.addColorStop(0,currentArena==='xtreme'?'#ecf3f6':'#c8d7dd');
  bowlColor.addColorStop(1,currentArena==='xtreme'?'#ffffff':'#e1eaef');
  ctx.beginPath();ctx.arc(cx,cy,radius,0,TAU);
  ctx.fillStyle=bowlColor;ctx.fill();
  ctx.lineWidth=3;ctx.strokeStyle='#c1cfd8';ctx.stroke();
  const zones2D=root.BBX_SIM_CORE?.STADIUM_ZONES||[];
  if(currentArena==='xtreme'){
   for(const z of zones2D){
    const a=z.theta-z.halfWidth,b=z.theta+z.halfWidth;
    ctx.beginPath();ctx.arc(cx,cy,radius*1.22,a,b);
    ctx.arc(cx,cy,radius*.99,b,a,true);ctx.closePath();
    ctx.fillStyle=z.kind==='extreme'?'#706671':'#6c8190';ctx.fill();
    ctx.strokeStyle=z.kind==='extreme'?'#cd8170':'#e2d188';
    ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,radius*.99,a,b);ctx.stroke();
   }
   ctx.beginPath();
   for(let i=0;i<=160;i++){
    const t=i*TAU/160;
    const rr=radius*(root.BBX_SIM_CORE?.stadiumRailRadius?.(t)||1.17)/1.32;
    if(i===0)ctx.moveTo(cx+Math.cos(t)*rr,cy+Math.sin(t)*rr);
    else ctx.lineTo(cx+Math.cos(t)*rr,cy+Math.sin(t)*rr);
   }
   ctx.strokeStyle='#2fad47';ctx.lineWidth=7;ctx.shadowColor='rgba(34,160,68,.25)';
   ctx.shadowBlur=7;ctx.stroke();ctx.shadowBlur=0;
   const arcs=zones2D.map(z=>[z.theta-z.halfWidth,z.theta+z.halfWidth]).sort((a,b)=>a[0]-b[0]);
   let from=0;ctx.lineWidth=7;ctx.strokeStyle='#fbfdff';
   for(const [a,b] of [...arcs,[TAU,TAU]]){
    if(a>from){ctx.beginPath();ctx.arc(cx,cy,radius*1.04,from,a);ctx.stroke()}
    from=Math.max(from,b);
   }
  }else{
   ctx.lineWidth=7;ctx.strokeStyle='#fbfdff';
   ctx.beginPath();ctx.arc(cx,cy,radius*1.04,0,TAU);ctx.stroke();
  }
  ctx.setLineDash([2,9]);ctx.strokeStyle='rgba(45,64,89,.3)';ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(cx,cy,radius*.65,0,TAU);ctx.stroke();ctx.setLineDash([]);
  // Initial launch halves are enforced by sim-engine, but not drawn on the stadium.
  // Moving trails show where each simulated top actually travelled.
  for(let i=0;i<2;i++){
   const points=trails[i];if(points.length<2)continue;
   ctx.beginPath();
   for(let k=0;k<points.length;k++){
    const xx=cx+points[k].x/1.32*radius*.95,yy=cy+points[k].y/1.32*radius*.95;
    if(!k)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);
   }
   ctx.globalAlpha=.72;ctx.strokeStyle=colors[i];ctx.lineWidth=3.6;
   ctx.shadowColor=colors[i];ctx.shadowBlur=15;ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=1;
  }
  // When airborne tops project onto the same XY point, paint the higher top
  // last. This is depth ordering, not an invitation to intersect their blades.
  const topOrder=(state?.tops||[]).map((_,i)=>i).sort((i,j)=>
   (Number(state.tops[i]?.height)||0)-(Number(state.tops[j]?.height)||0));
  for(const i of topOrder){
   const t=state?.tops?.[i],spec=visualBuilds[i];if(!t)continue;
   const outcome=state.done?state.terminal:null,loser=outcome?.loser===i,finished=outcome?.finish;
   const age=Math.min(1.2,Math.max(0,finalAge));
   if(loser&&(finished==='over'||finished==='extreme')&&age>1.0)continue;
   const dist=Math.hypot(t.x,t.y)||1;
   const escape=loser&&(finished==='over'||finished==='extreme')?age*.5:0;
   const px=cx+(t.x+t.x/dist*escape)/1.32*radius*.95;
   const py=cy+(t.y+t.y/dist*escape)/1.32*radius*.95;
   const rise=Math.max(0,Number(t.height)||0);
   // Screen footprint matches the engine's collision radius (unlike the
   // previous 1.21x blade and 1.12x image oversizing).
   const r=Math.max(10,radius*(spec?.radius||.18)/1.32*.95*.96)*(1+rise*.22);
   // Ground shadow stays on the launch point while the top descends.
   if(rise>0){
    ctx.save();ctx.globalAlpha=Math.max(.10,.30-rise*.18);ctx.fillStyle='#284e69';
    ctx.beginPath();ctx.ellipse(px,py,r*.76,r*.30,0,0,TAU);ctx.fill();ctx.restore();
   }
   const lean=Number(t.tilt)||0,leanDir=Number(t.tiltDir)||0;
   const collapsed=loser&&finished==='spin'?Math.max(.23,1-age*.6):1;
   ctx.save();
   ctx.translate(px+Math.sin(leanDir)*lean*r*.16,py-rise*radius*.53);
   ctx.rotate(leanDir);
   ctx.scale(1,Math.max(.34,Math.cos(Math.abs(lean)))*collapsed);
   ctx.rotate(t.heading-leanDir+(state.done&&outcome?.winner===i?coastRotation(t,coastAge):0)+(loser&&finished==='spin'?age*1.5:0));
   if(loser&&finished==='burst'&&age>.1){
    // Split into the actual chosen Blade/Ratchet/Bit images where available.
    // The ratchet fallback is a hollow ring, not a generic rectangle.
    const fragments=getParts(spec);
    const bladePart=fragments.find(p=>p.kind==='blade'||p.kind==='mainBlade')||fragments[0];
    const ratchetPart=fragments.find(p=>p.kind==='ratchet');
    const bitPart=fragments.find(p=>p.kind==='bit');
    for(let k=0;k<3;k++){
     const direction=k*TAU/3+.6;
     ctx.save();
     ctx.translate(Math.cos(direction)*age*r*2.55,Math.sin(direction)*age*r*2.55);
     ctx.rotate(direction+age*(k+1)*1.45);
     if(k===0){
      if(!paintImage(ctx,getImage(bladePart?.src),0,0,r*1.8)){
       ctx.fillStyle='#d9eaf2';ctx.beginPath();ctx.arc(0,0,r*.9,0,TAU);ctx.fill();
      }
     }else if(k===1){
      const size=r*.97,count=Number(spec?.ratchetTeeth)||0;
      ctx.beginPath();
      for(let j=0;j<=72;j++){
       const theta=j*TAU/72,lobe=count?Math.pow(Math.max(0,Math.cos(theta*count)),6)*.10:0;
       const rad=size*.50*(1+lobe),xx=Math.cos(theta)*rad,yy=Math.sin(theta)*rad;
       if(!j)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);
      }
      ctx.closePath();ctx.moveTo(size*.15,0);ctx.arc(0,0,size*.15,0,TAU,true);
      ctx.save();ctx.clip('evenodd');
      ctx.fillStyle='#8caabb';ctx.fillRect(-size/2,-size/2,size,size);
      paintImage(ctx,getImage(ratchetPart?.src),0,0,size);
      ctx.restore();
      ctx.strokeStyle='#f5e8c8';ctx.lineWidth=1.5;ctx.stroke();
     }else{
      if(!paintImage(ctx,getImage(bitPart?.src),0,0,r*.66)){
       ctx.fillStyle='#e2b078';ctx.beginPath();ctx.arc(0,0,r*.28,0,TAU);ctx.fill();
      }
     }
     ctx.restore();
    }
    ctx.restore();continue;
   }
   const pieces=getParts(spec),primary=pieces.find(p=>p.kind==='blade'||p.kind==='mainBlade')||pieces[0];
   const texture=getImage(primary?.src);
   ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fillStyle=i===0?'#a4d3dd':'#e5a47b';ctx.fill();
   const drawn=paintImage(ctx,texture,0,0,r*2);
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
  const now=(state?.elapsed||0)+(state?.done?finalAge:0);
  for(const effect of fx){
   const age=Math.max(0,now-effect.t);
   if(age>.65)continue;
   const px=cx+effect.x/1.32*radius*.95,py=cy+effect.y/1.32*radius*.95;
   const strength=Math.max(.4,Number(effect.strength)||.7);
   const scale=1+age*(3.8+strength*1.4),opacity=Math.max(0,1-age/.65);
   ctx.save();ctx.translate(px,py);ctx.globalAlpha=opacity;
   ctx.strokeStyle=effect.kind==='dash'?'#4af5fa':effect.kind==='land'?'#8ddff3':'#fff5ad';
   ctx.lineWidth=2.3+strength*.6;ctx.shadowBlur=12+strength*7;
   ctx.shadowColor=effect.kind==='dash'?'#2cf6ff':effect.kind==='land'?'#8ddff3':'#ffc441';
   ctx.beginPath();ctx.arc(0,0,Math.min(42,(10+strength*3)*scale),0,TAU);ctx.stroke();
   for(let k=0;k<16;k++){
    const a=k*TAU/16+effect.t*.8,d=(18+strength*8)*scale*(k%3===0?1.3:.7);
    ctx.beginPath();ctx.moveTo(Math.cos(a)*8,Math.sin(a)*8);
    ctx.lineTo(Math.cos(a)*d,Math.sin(a)*d);ctx.stroke();
   }
   ctx.restore();
  }
  ctx.restore();
  ctx.font='11px system-ui';ctx.fillStyle='#bcd7e9';
  ctx.fillText(currentArena==='xtreme'?'BX-10 正式盤（外形近似）｜Xtreme Line':'練習圓盤｜無 Xtreme Line',12,19);
  if(state?.done){
   const labels={spin:'持久勝利',burst:'爆裂勝利',over:'擊飛勝利',extreme:'極限勝利',draw:'平手'};
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
 /* Derive a 2.5-D silhouette from each local, already-verified transparent Blade PNG.
 * A photo is not CAD: this traces the visible top contour only. */
function makeBladeSilhouette(canvas){
 try{
  const pixels=canvas.getContext('2d',{willReadFrequently:true})
   .getImageData(0,0,canvas.width,canvas.height).data;
  const center=canvas.width/2,half=canvas.width*.49,steps=96,samples=[],radii=[];
  let found=0;
  for(let i=0;i<steps;i++){
   const a=i*TAU/steps,cs=Math.cos(a),sn=Math.sin(a);
   let r=0;
   for(let k=half;k>=canvas.width*.12;k-=3){
    const x=Math.round(center+cs*k),y=Math.round(center+sn*k);
    if(x<0||y<0||x>=canvas.width||y>=canvas.height)continue;
    if(pixels[(y*canvas.width+x)*4+3]>95){r=k;found++;break}
   }
   radii.push(r);
  }
  if(found<steps*.80)return null;
  for(let i=0;i<steps;i++){
   const tri=[radii[(i+steps-1)%steps],radii[i],radii[(i+1)%steps]].sort((a,b)=>a-b);
   const radius=Math.max(.46,Math.min(1,tri[1]/half))*.16;
   const a=i*TAU/steps;samples.push([Math.cos(a)*radius,Math.sin(a)*radius]);
  }
  const shape=new THREE.Shape();
  samples.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.030,steps:1,bevelEnabled:true,
   bevelSize:.0025,bevelThickness:.0025,bevelSegments:1,curveSegments:2});
  geometry.rotateX(-Math.PI/2);
  return geometry;
 }catch(error){console.warn('Blade contour is not readable; retaining base geometry',error);return null}
}

 function modelColor(str){
  let seed=0;for(const ch of String(str||''))seed=(seed*31+ch.charCodeAt(0))>>>0;
  const palette=[0x93b3c4,0xe8b56b,0xa4d4d8,0xbd92c4,0xb8c678,0xd2a3a0,0xe7d4aa];
  return palette[seed%palette.length];
 }
 function makeTop(spec,i,version){
  const g=new THREE.Group(),parts=getParts(spec),heightCode=Number(spec.ratchetHeight)||60;
  const metallic=new THREE.MeshPhysicalMaterial({color:modelColor(spec.name),metalness:.78,roughness:.26,clearcoat:.0});
  metallic.userData.qualityRole='blade';
  const under=new THREE.MeshStandardMaterial({color:modelColor(spec.config.bit),metalness:.34,roughness:.33});
  under.userData.qualityRole='under';
  const ringMaterial=new THREE.MeshStandardMaterial({color:modelColor(spec.config.ratchet),
   metalness:.10,roughness:.44,transparent:true,opacity:.88,side:THREE.DoubleSide});
  ringMaterial.userData.qualityRole='ratchet';
  const body=new THREE.Group(),ratchet=new THREE.Group(),bit=new THREE.Group(),bladeBase=new THREE.Group();
  const shapeIndex=spec.mode==='cx'?8:10;
  const blade=new THREE.Mesh(new THREE.CylinderGeometry(.142,.113,.042,shapeIndex),metallic);
  blade.position.y=.127;bladeBase.add(blade);
  for(let j=0;j<7;j++){
   const element=new THREE.Mesh(new THREE.BoxGeometry(.048,.013,.048),metallic);
   const theta=j*TAU/7;
   element.position.set(Math.cos(theta)*.115,.15,Math.sin(theta)*.115);
   element.rotation.y=theta;bladeBase.add(element);
  }
  // The ratchet is a hollow, translucent ring with its correct lobe count.
  // 0-XX is circular. 3-XX has three protrusions; 7-XX has seven.
  const ratchetTeeth=Math.max(0,Math.min(9,Number(spec.ratchetTeeth)||0));
  const section=new THREE.Shape(),slices=ratchetTeeth?Math.max(96,ratchetTeeth*16):96;
  for(let j=0;j<=slices;j++){
   const theta=j*TAU/slices;
   const lobe=ratchetTeeth?Math.pow(Math.max(0,Math.cos(theta*ratchetTeeth)),6):0;
   const radius=.073+(ratchetTeeth===0?0:.009*lobe);
   const xx=Math.cos(theta)*radius,zz=Math.sin(theta)*radius;
   if(j===0)section.moveTo(xx,zz);else section.lineTo(xx,zz);
  }
  section.closePath();
  const opening=new THREE.Path();
  opening.absarc(0,0,.026,0,TAU,true);
  section.holes.push(opening);
  const ratchetGeo=new THREE.ExtrudeGeometry(section,{
   depth:.023,bevelEnabled:true,bevelSize:.001,bevelThickness:.001,
   bevelSegments:1,steps:1,curveSegments:32
  });
  ratchetGeo.rotateX(-Math.PI/2);
  const ratchetBody=new THREE.Mesh(ratchetGeo,ringMaterial);
  ratchetBody.position.y=.069+(heightCode-60)*.0004;ratchet.add(ratchetBody);
  const socket=new THREE.Mesh(new THREE.TorusGeometry(.033,.006,7,28),ringMaterial);
  socket.rotation.x=-Math.PI/2;socket.position.y=.099+(heightCode-60)*.0004;
  ratchet.add(socket);
  for(let j=0;j<3;j++){
   const theta=j*TAU/3;
   const catchPiece=new THREE.Mesh(new THREE.BoxGeometry(.019,.012,.017),ringMaterial);
   catchPiece.position.set(Math.cos(theta)*.041,.099+(heightCode-60)*.0004,Math.sin(theta)*.041);
   catchPiece.rotation.y=-theta;ratchet.add(catchPiece);
  }
  const bitBody=new THREE.Mesh(new THREE.CylinderGeometry(.035,.015,.06,8),under);
  bitBody.position.y=.034;bit.add(bitBody);
  body.add(bladeBase);
  g.add(body,ratchet,bit);
  const spinBlur=new THREE.Mesh(new THREE.RingGeometry(.108,.158,80),
   new THREE.MeshBasicMaterial({color:0xe9f2f6,transparent:true,opacity:0,
    depthWrite:false,side:THREE.DoubleSide}));
  spinBlur.rotation.x=-Math.PI/2;spinBlur.position.y=.183;spinBlur.visible=false;
  body.add(spinBlur);
  // The blade image is up to 0.164 model units from its centre. Match its
  // displayed outer radius to the same per-build radius used for physics.
  // The small inset avoids alpha edges appearing to intersect on contact.
  g.scale.setScalar((spec.radius||.18)/.164*.94);
  const centers={blade:.169,mainBlade:.172,assistBlade:.185,lockChip:.202,ratchet:.102+(heightCode-60)*.0004,bit:.045};
  const dimensions={blade:.328,mainBlade:.326,assistBlade:.276,lockChip:.12,ratchet:.164,bit:.059};
  const textureKinds=parts.filter(p=>['blade','mainBlade','assistBlade','lockChip','ratchet'].includes(p.kind));
  for(const p of textureKinds){
   if(!p.src)continue;
   const token=version;
   const img=new Image();
   img.onload=()=>{
    if(renderVersion!==token||!THREE||!world)return;
    try{
     const square=p.kind==='ratchet'?getRatchetCanvas(img):getImageCanvas(img),texture=new THREE.CanvasTexture(square);
     if(p.kind==='blade'||p.kind==='mainBlade'){
      const contour=makeBladeSilhouette(square);
      if(contour){
       body.remove(bladeBase);dispose(bladeBase);
       const contourMesh=new THREE.Mesh(contour,metallic);
       contourMesh.position.y=.112;contourMesh.castShadow=true;contourMesh.receiveShadow=true;
       body.add(contourMesh);
      }
     }
     texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=Math.min(4,renderer?.capabilities?.getMaxAnisotropy?.()||1);
     const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide});
     const plane=new THREE.Mesh(new THREE.PlaneGeometry(dimensions[p.kind],dimensions[p.kind]),material);
     plane.rotation.x=-Math.PI/2;plane.position.y=centers[p.kind];
     (p.kind==='ratchet'?ratchet:body).add(plane);
     // The user may be inspecting a stationary setup before the battle starts.
     // Re-render once the selected part texture actually finishes loading.
     renderState(lastState,{finalAge:lastFinishAge});
    }catch(error){console.warn('Image cannot be mapped to 3D:',p.src,error)}
   };
   img.onerror=()=>console.warn('Missing reference image',p.src);
   img.src=p.src;
  }
  g.position.set(i===0?-.4: .4,0,0);
  g.traverse(obj=>{
   if(obj.isMesh){obj.castShadow=!obj.material?.transparent;obj.receiveShadow=true;}
   if(obj.material)[].concat(obj.material).forEach(assignMaterialQuality);
  });
  world.add(g);
  const shadow=groundShadow(spec);
  return{root:g,blade:body,ratchet,bit,spinBlur,shadow};
 }
 async function init3D(){
  try{
   const T=await import(THREE_CDN);const gl=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
   gl.setPixelRatio(root.BBX_SIM_QUALITY?.resolutionScale(qualityMode,root.devicePixelRatio||1)||1);
   gl.setClearColor(0x112f61,1);gl.outputColorSpace=T.SRGBColorSpace;
   const scene=new T.Scene();
   scene.background=new T.Color(0x112f61);
   scene.fog=new T.Fog(0x112f61,7.5,14);
   const cam=new T.PerspectiveCamera(44,1,.1,25);
   const initial=root.BBX_STADIUM_CAMERA?.project?.(root.BBX_STADIUM_CAMERA.defaults);
   cam.position.set(initial?.x||0,initial?.y||3.5,initial?.z||2.45);cam.lookAt(0,.02,0);
   const hemi=new T.HemisphereLight(0xf8fcff,0x5b789f,3.1);scene.add(hemi);
   const key=new T.DirectionalLight(0xfffbec,3.15);key.position.set(-2.2,4.2,2.8);scene.add(key);
   key.shadow.camera.left=-2.4;key.shadow.camera.right=2.4;
   key.shadow.camera.top=2.4;key.shadow.camera.bottom=-2.4;
   key.shadow.camera.near=.4;key.shadow.camera.far=12;
   key.shadow.bias=-.00022;key.shadow.normalBias=.016;
   const fill=new T.DirectionalLight(0xb9ddff,0);fill.position.set(2.8,2.4,-2.1);scene.add(fill);
   const rimLight=new T.PointLight(0xe7f8ff,0,8);rimLight.position.set(-1.4,1.6,-1.2);scene.add(rimLight);
   lights={hemi,key,fill,rim:rimLight};
   const backgroundGrid=new T.GridHelper(8,24,0x6999cf,0x3061a2);
   backgroundGrid.position.y=-.29;
   scene.add(backgroundGrid);
   const group=new T.Group();
   // Official BX-10-inspired white base and translucent, chamfered guard.
   // Visual-only normalized dimensions; not a manufacturer's CAD mesh.
   const shell=new T.MeshStandardMaterial({color:0xedf2f5,metalness:.04,roughness:.49,side:T.DoubleSide});
   shell.userData.qualityRole='shell';
   const bright=new T.MeshStandardMaterial({color:0xffffff,metalness:.05,roughness:.38,side:T.DoubleSide});
   const mat=new T.MeshStandardMaterial({color:0xeaf0f4,metalness:.03,roughness:.59,side:T.DoubleSide});
   mat.userData.qualityRole='floor';
   const metal=new T.MeshStandardMaterial({color:0xaebfca,metalness:.10,roughness:.46});
   const clear=new T.MeshPhysicalMaterial({color:0xf5fcff,metalness:.04,roughness:.26,
    transparent:true,opacity:.20,depthWrite:false,side:T.DoubleSide});
   clear.userData.qualityRole='guard';
   // White octagonal outer chassis with the centre carved away.
   const corners=[[-1.38,-1.48],[1.38,-1.48],[1.80,-1.12],[1.80,1.13],
    [1.40,1.48],[-1.40,1.48],[-1.80,1.13],[-1.80,-1.12]];
   const hull=new T.Shape();
   corners.forEach(([x,z],i)=>i?hull.lineTo(x,-z):hull.moveTo(x,-z));
   hull.closePath();
   const hole=new T.Path();hole.absarc(0,0,1.315,0,TAU,true);hull.holes.push(hole);
   const base=new T.Mesh(new T.ExtrudeGeometry(hull,{depth:.13,bevelEnabled:true,
    bevelThickness:.018,bevelSize:.018,bevelSegments:2,curveSegments:64}),shell);
   base.rotation.x=-Math.PI/2;base.position.y=-.145;base.receiveShadow=true;group.add(base);
   // Radially sloped battle basin. Lower centre, gently rising outside.
   const bowlPoints=[[0,-.012],[.25,-.012],[.55,-.009],[.74,-.004],
    [.91,.007],[1.05,.027],[1.19,.055],[1.32,.082]];
   const bowl=new T.Mesh(new T.LatheGeometry(bowlPoints.map(([r,y])=>new T.Vector2(r,y)),120),mat);
   bowl.receiveShadow=true;group.add(bowl);
   const groove=new T.Mesh(new T.TorusGeometry(1.29,.014,10,116),metal);
   groove.rotation.x=Math.PI/2;groove.position.y=.089;group.add(groove);
   // Real BX-10 guard is polygonal, mostly clear, and open over the battle bowl.
   const upperGuard=new T.Mesh(new T.ShapeGeometry(hull,64),clear);
   upperGuard.rotation.x=-Math.PI/2;upperGuard.position.y=.265;group.add(upperGuard);
   for(let i=0;i<corners.length;i++){
    const [x1,z1]=corners[i],[x2,z2]=corners[(i+1)%corners.length];
    const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz);
    const wall=new T.Mesh(new T.BoxGeometry(len,.28,.024),clear);
    wall.position.set((x1+x2)/2,.115,(z1+z2)/2);
    wall.rotation.y=-Math.atan2(dz,dx);group.add(wall);
   }
   for(let i=0;i<4;i++){
    const theta=(i+.5)*TAU/4;
    const clip=new T.Mesh(new T.BoxGeometry(.13,.12,.13),metal);
    clip.position.set(Math.cos(theta)*1.59,.11,Math.sin(theta)*1.39);
    clip.rotation.y=-theta;group.add(clip);
   }
   // Three visible front apertures share exactly the simulator's zone angles.
   const zones=root.BBX_SIM_CORE?.STADIUM_ZONES||[
    {kind:'over',theta:.61,halfWidth:.29},{kind:'extreme',theta:Math.PI/2,halfWidth:.31},
    {kind:'over',theta:Math.PI-.61,halfWidth:.29}];
   const rimMaterial=new T.MeshStandardMaterial({color:0xfafcff,metalness:.04,roughness:.36});
   rimFull=new T.Mesh(new T.TorusGeometry(1.37,.073,14,128),rimMaterial);
   rimFull.rotation.x=-Math.PI/2;rimFull.position.y=.135;
   rimFull.visible=currentArena!=='xtreme';group.add(rimFull);
   rimOpen=new T.Group();
   const openings=zones.map(z=>[z.theta-z.halfWidth,z.theta+z.halfWidth]).sort((a,b)=>a[0]-b[0]);
   let cursor=0;
   for(const [a,b] of [...openings,[TAU,TAU]]){
    if(a>cursor){
     const rimGeo=new T.TorusGeometry(1.37,.073,14,Math.max(8,Math.ceil((a-cursor)*45)),a-cursor);
     rimGeo.rotateZ(-a);
     const part=new T.Mesh(rimGeo,rimMaterial);
     part.rotation.x=-Math.PI/2;part.position.y=.135;rimOpen.add(part);
    }
    cursor=Math.max(cursor,b);
   }
   rimOpen.visible=currentArena==='xtreme';group.add(rimOpen);
   // The official green toothed rail has a pronounced inward entry bend at rear.
   const railMat=new T.MeshStandardMaterial({color:0x26a844,metalness:.12,roughness:.38,
    emissive:0x135523,emissiveIntensity:.22});
   railMat.userData.qualityRole='rail';
   const railRadius=root.BBX_SIM_CORE?.stadiumRailRadius||(()=>1.17);
   const railCurve=new T.CatmullRomCurve3(Array.from({length:150},(_,i)=>{
    const theta=i*TAU/150,r=railRadius(theta);
    return new T.Vector3(Math.cos(theta)*r,.101,Math.sin(theta)*r);
   }),true,'centripetal');
   const guide=new T.Mesh(new T.TubeGeometry(railCurve,220,.036,9,true),railMat);
   const teeth=new T.InstancedMesh(new T.BoxGeometry(.042,.020,.025),railMat,76);
   const tooth=new T.Object3D();
   for(let i=0;i<76;i++){
    const t=i*TAU/76,r=railRadius(t);
    tooth.position.set(Math.cos(t)*r,.102,Math.sin(t)*r);
    tooth.rotation.set(0,-t,0);tooth.updateMatrix();teeth.setMatrixAt(i,tooth.matrix);
   }
   teeth.instanceMatrix.needsUpdate=true;guide.add(teeth);group.add(guide);
   const pocketGroup=new T.Group();
   for(const zone of zones){
    const begin=-zone.theta-zone.halfWidth,width=zone.halfWidth*2;
    const floor=new T.Mesh(new T.RingGeometry(1.28,1.61,24,1,begin,width),
     new T.MeshStandardMaterial({color:0x4d6170,metalness:.01,roughness:.75,
      side:T.DoubleSide}));
    floor.rotation.x=-Math.PI/2;floor.position.y=.007;pocketGroup.add(floor);
    const accent=new T.Mesh(new T.RingGeometry(1.29,1.35,24,1,begin,width),
     new T.MeshBasicMaterial({color:zone.kind==='extreme'?0xc75e57:0xe5c56c,
      transparent:true,opacity:.72,depthWrite:false,side:T.DoubleSide}));
    accent.rotation.x=-Math.PI/2;accent.position.y=.013;pocketGroup.add(accent);
    const gate=new T.Mesh(new T.BoxGeometry(zone.kind==='extreme'?.34:.29,.06,.09),metal);
    gate.position.set(Math.cos(zone.theta)*1.56,.025,Math.sin(zone.theta)*1.56);
    gate.rotation.y=-zone.theta;pocketGroup.add(gate);
   }
   group.add(pocketGroup);
   for(let i=0;i<8;i++){
    const theta=i*TAU/8;
    const tab=new T.Mesh(new T.BoxGeometry(.13,.040,.16),bright);
    tab.position.set(Math.cos(theta)*1.46,.040,Math.sin(theta)*1.46);
    tab.rotation.y=-theta;group.add(tab);
   }
   // Effects are purely visual. Physics remains in sim-engine.js.
   fx3D=new T.Group();scene.add(fx3D);
   for(let i=0;i<2;i++){
    const geo=new T.BufferGeometry(),data=new Float32Array(36*3);
    geo.setAttribute('position',new T.BufferAttribute(data,3).setUsage(T.DynamicDrawUsage));
    geo.setDrawRange(0,0);
    const line=new T.Line(geo,new T.LineBasicMaterial({
      color:i===0?0x45eeff:0xff9861,transparent:true,opacity:.85,depthWrite:false
    }));
    line.visible=false;scene.add(line);trailLines[i]=line;
   }
   const sparkCanvas=document.createElement('canvas');
   sparkCanvas.width=128;sparkCanvas.height=128;
   const sparkCtx=sparkCanvas.getContext('2d');
   const gradient=sparkCtx.createRadialGradient(64,64,2,64,64,58);
   gradient.addColorStop(0,'rgba(255,255,255,1)');
   gradient.addColorStop(.17,'rgba(255,251,210,.94)');
   gradient.addColorStop(.48,'rgba(255,198,93,.5)');
   gradient.addColorStop(1,'rgba(255,165,55,0)');
   sparkCtx.fillStyle=gradient;sparkCtx.fillRect(0,0,128,128);
   sparkCtx.strokeStyle='#fff7d1';sparkCtx.lineWidth=3;
   for(let j=0;j<14;j++){
    const theta=j*TAU/14;
    sparkCtx.beginPath();
    sparkCtx.moveTo(64+Math.cos(theta)*14,64+Math.sin(theta)*14);
    sparkCtx.lineTo(64+Math.cos(theta)*(j%3===0?61:42),64+Math.sin(theta)*(j%3===0?61:42));
    sparkCtx.stroke();
   }
   const sparkTexture=new T.CanvasTexture(sparkCanvas);
   for(let i=0;i<80;i++){
    const material=new T.SpriteMaterial({map:sparkTexture,
      color:0xffe9ae,blending:T.AdditiveBlending,transparent:true,depthWrite:false});
    const sprite=new T.Sprite(material);
    sprite.visible=false;sprite.position.y=.21;
    sprite.scale.set(.4,.4,1);fx3D.add(sprite);fxSprites.push(sprite);
   }
   scene.add(group);
   THREE=T;renderer=gl;world=scene;camera=cam;stadium=group;rail=guide;pockets=pocketGroup;floorMaterial=mat;
   applyQuality();
   container.replaceChildren(gl.domElement);
   gl.domElement.className='sim-three-canvas';
   orbit=root.BBX_STADIUM_CAMERA?.create(gl.domElement,cam,()=>renderState(lastState,{finalAge:lastFinishAge}))||null;
   setArena(currentArena);
   setBuilds(visualBuilds);
   status.textContent=quality.label+'畫質｜BX-10 近似 3D｜拖曳可 360° 旋轉，雙指／滾輪可縮放';
   renderState(lastState,{finalAge:lastFinishAge});
  }catch(error){
   status.textContent='3D 載入失敗，已改用相同物理狀態的 2D 畫面。';
   console.warn('WebGL/Three.js unavailable',error);
  }
 }
 function renderState(state,opts={}){
  lastState=state||null;
  lastFinishAge=Math.max(0,Math.min(1.3,Number(opts.finalAge)||0));
  lastCoastAge=Math.max(0,Math.min(COAST_DURATION,Number(opts.coastAge??opts.finalAge)||0));
  updateEffects(lastState,lastFinishAge);
  if(!renderer||!THREE||!world){draw2D(lastState,lastFinishAge,lastCoastAge);return}
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
   if(mesh.shadow)mesh.shadow.visible=!!t&&!!quality?.contactShadow;
   if(mesh.spinBlur)mesh.spinBlur.visible=false;
   if(!t)continue;
   const terminal=state.done?state.terminal:null;
   const loser=terminal?.loser===i,finish=terminal?.finish;
   const age=lastFinishAge,dist=Math.max(.01,Math.hypot(t.x,t.y));
   let x=t.x,z=t.y;
   if(loser&&(finish==='over'||finish==='extreme')){
    x+=t.x/dist*age*.7;z+=t.y/dist*age*.7;
   }
   const slope=Math.min(1,Math.max(0,(Math.hypot(x,z)-.70)/.62));
   mesh.root.position.set(x,.007+.094*slope*slope+Math.max(0,Number(t.height)||0)+(loser&&finish==='burst'?age*.014:0),z);
   if(mesh.shadow){
    mesh.shadow.position.set(x,.011+.094*slope*slope,z);
    mesh.shadow.material.opacity=(quality?.contactOpacity||0)*
     Math.max(.08,1-Math.max(0,Number(t.height)||0)/1.2);
    mesh.shadow.scale.setScalar(Math.max(.6,(mesh.root.scale.x||1)*(1+Math.max(0,Number(t.height)||0)*.38)));
   }
   if(mesh.spinBlur){
    const spinning=Math.max(0,Number(t.spin)||0);
    mesh.spinBlur.visible=!!quality?.spinBlur&&spinning>11&&!(loser&&finish==='burst');
    mesh.spinBlur.material.opacity=mesh.spinBlur.visible?
     Math.min(.34,Math.max(0,(spinning-11)/76*.35)):0;
   }
   mesh.root.rotation.y=t.heading+(terminal?.winner===i?coastRotation(t,lastCoastAge):0);
   // Tilt direction comes from impact recoil and axial precession. Blade
   // heading only spins the top; it must not create unrelated body shaking.
   const lean=Number(t.tilt)||0,dir=Number(t.tiltDir)||0;
   mesh.root.rotation.x=Math.cos(dir)*lean;
   mesh.root.rotation.z=Math.sin(dir)*lean;
   if(loser&&finish==='spin'){
    mesh.root.rotation.z+=Math.min(1.2,age*1.0);
    mesh.root.position.y=Math.max(-.004,.016-age*.012);
   }
   if(loser&&(finish==='over'||finish==='extreme')){
    mesh.root.rotation.z+=age*2.3;
    mesh.root.position.y+=age*.22;
   }
   if(loser&&finish==='burst'){
    mesh.blade.position.set(age*.53,age*.32,age*.24);
    mesh.ratchet.position.set(-age*.43,age*.11,age*.34);
    mesh.bit.position.set(age*.16,-age*.07,-age*.40);
    mesh.blade.rotation.set(age*4,age*3,age*2);
    mesh.ratchet.rotation.set(age*3,-age*4,age*3);
    mesh.bit.rotation.set(-age*2,age*2,age*5);
   }else{
    mesh.blade.position.set(0,0,0);mesh.ratchet.position.set(0,0,0);mesh.bit.position.set(0,0,0);
    mesh.blade.rotation.set(0,0,0);mesh.ratchet.rotation.set(0,0,0);mesh.bit.rotation.set(0,0,0);
   }
   // A heavily tilted blade could otherwise cut through the opaque stadium
   // floor, because its mesh rotates around the axle near the ground.
   // Raise the axle only as much as necessary for rim clearance.
   if(!(loser&&finish==='burst')&&Math.max(0,Number(t.height)||0)<.05){
    const a=Math.min(1.4,Math.hypot(mesh.root.rotation.x,mesh.root.rotation.z));
    const scale=mesh.root.scale.x;
    const bladeLow=.169*scale*Math.cos(a)-.164*scale*Math.sin(a);
    mesh.root.position.y+=Math.max(0,.02-bladeLow);
   }
  }
  if(rail)rail.material.emissiveIntensity=(state?.tops?.some(t=>t.railCooldown>0)?0.50:.22);
  for(let i=0;i<trailLines.length;i++){
   const line=trailLines[i],points=trails[i]||[];
   line.visible=!!state&&!state.done&&points.length>=2&&quality?.trailLimit>0;
   line.material.opacity=quality?.id==='ultra'?.87:quality?.id==='balanced'?.72:.46;
   if(line.visible){
    const attribute=line.geometry.getAttribute('position'),sample=points.slice(-Math.min(36,quality.trailLimit));
    for(let j=0;j<sample.length;j++)attribute.setXYZ(j,sample[j].x,.13,sample[j].y);
    attribute.needsUpdate=true;
    line.geometry.setDrawRange(0,sample.length);
   }
  }
  const now=(Number(state?.elapsed)||0)+(state?.done?lastFinishAge:0);
  // Each physics event generates a short cluster of real spatial particles,
  // instead of a single nearly static flash at the collision point.
  const particles=[];
  for(const event of fx.slice(-9)){
   const base=event.kind==='hit'?8:event.kind==='dash'?6:event.kind==='finish'?10:event.kind==='wall'?5:3;
   const count=Math.max(1,Math.ceil(base*(quality?.sparkScale||1)));
   for(let k=0;k<count;k++)particles.push({event,k,count});
  }
  const visible=particles.slice(-Math.min(fxSprites.length,quality?.sparkBudget||28));
  for(let i=0;i<fxSprites.length;i++){
   const sprite=fxSprites[i],part=visible[i];
   if(!part){sprite.visible=false;continue}
   const {event,k,count}=part;
   const age=Math.max(0,now-event.t),remaining=Math.max(0,1-age/.65);
   if(!remaining){sprite.visible=false;continue}
   const theta=k*TAU/count+event.t*3.2;
   const strength=Math.max(.3,Math.min(2.2,Number(event.strength)||.7));
   const scatter=(event.kind==='hit'?.12:event.kind==='finish'?.18:.07)+age*(.6+strength*.55)*(k%3===0?1:.63);
   sprite.visible=true;
   sprite.position.set(event.x+Math.cos(theta)*scatter,.20+Math.sin(theta*2)*.08+age*(.25+strength*.15),event.y+Math.sin(theta)*scatter);
   const size=(event.kind==='dash'?.16:event.kind==='land'?.11:event.kind==='finish'?.22:.12)*(1+age*1.7+strength*.28);
   sprite.scale.set(size,size,1);
   sprite.material.opacity=remaining*(k%3===0?.95:.8);
   sprite.material.color.setHex(event.kind==='dash'?0x79ffff:event.kind==='land'?0x8ddff3:event.kind==='wall'?0xffbd82:event.kind==='finish'?0xf7ffdc:0xffd686);
  }
  const recent=fx.slice().reverse().find(e=>(e.kind==='hit'||e.kind==='wall'||e.kind==='dash')&&now-e.t<.34);
  if(recent){
   const t=Math.max(0,1-(now-recent.t)/.34);
   const impact=recent.kind==='hit';
   const power=Math.max(.35,Math.min(2.2,Number(recent.strength)||.7));
   const shake=(impact?.035:.012)*power*t;
   const zoom=(impact?.22:.11)*t;
   if(orbit)orbit.apply({x:shake*Math.sin(now*93),y:-zoom+shake*Math.sin(now*123),z:-zoom+shake*Math.cos(now*107)});
   else camera.position.set(shake*Math.sin(now*93),3.5-zoom,2.45-zoom);
  }else if(orbit)orbit.apply();
  else camera.position.set(0,3.5,2.45);
  if(!orbit)camera.lookAt(0,0,0);
  renderer.render(world,camera);
 }
 init3D();
 draw2D(null);
 return{
  render:renderState,setArena,setBuilds,setCameraView,setQuality,getQuality:()=>qualityMode,
  getCameraState:()=>orbit?.getState?.()||null,getVisuals:visualNames,
  destroy(){
   orbit?.destroy();
   rendered.forEach(n=>{if(n){
    world?.remove(n.root);dispose(n.root);
    if(n.shadow){world?.remove(n.shadow);dispose(n.shadow);}
   }});
   if(world)dispose(world);
   renderer?.dispose();container.replaceChildren();
  }
 };
}
root.BBX_SIM_VIEW={create,COAST_DURATION};
})(typeof window!=='undefined'?window:this);
