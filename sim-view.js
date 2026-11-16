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
 let activeBattle=null,eventCursor=0,fx=[],trails=[[],[]],fx3D=null,fxSprites=[],trailLines=[];
 const colors=['#55efff','#ff9b45'];
 function updateEffects(state,finalAge){
  if(!state||state!==activeBattle||state.elapsed<(activeBattle?._previousRenderElapsed||0)){
   activeBattle=state;eventCursor=0;fx=[];trails=[[],[]];
  }
  if(!state)return;
  const now=(Number(state.elapsed)||0)+(state.done?finalAge:0);
  const events=state.events||[];
  for(let i=eventCursor;i<events.length;i++){
   const ev=events[i];
   if(['hit','dash','finish','land'].includes(ev.type))
    fx.push({kind:ev.type,x:Number(ev.x)||0,y:Number(ev.y)||0,t:ev.t||state.elapsed,
      strength:Number(ev.strength)||.7,who:ev.who});
  }
  eventCursor=events.length;
  fx=fx.filter(e=>now-e.t<.66).slice(-15);
  if(state.elapsed!==(state._previousRenderElapsed||-1)&&!state.done)
   state.tops.forEach((top,i)=>{
    trails[i].push({x:top.x,y:top.y,t:now});
    trails[i]=trails[i].filter(p=>now-p.t<.48).slice(-24);
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
 function draw2D(state,finalAge=0){
  if(!ctx)return;
  const rect=container.getBoundingClientRect(),width=Math.max(270,Math.round(rect.width)),height=Math.max(260,Math.round(rect.height));
  const dpr=Math.min(2,root.devicePixelRatio||1);
  if(fallback.width!==Math.round(width*dpr)||fallback.height!==Math.round(height*dpr)){
   fallback.width=Math.round(width*dpr);fallback.height=Math.round(height*dpr)
  }
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
  const cx=width/2,cy=height/2,radius=Math.min(width*.45,height*.44);
  // Arena reference: white shell, bright lime rail and dark blue floor grid.
  const backdrop=ctx.createLinearGradient(0,0,0,height);
  backdrop.addColorStop(0,'#24508a');backdrop.addColorStop(.5,'#123b78');
  backdrop.addColorStop(1,'#092b62');
  ctx.fillStyle=backdrop;ctx.fillRect(0,0,width,height);
  ctx.strokeStyle='rgba(124,174,229,.12)';ctx.lineWidth=1;
  for(let x=0;x<width;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,height);ctx.stroke()}
  for(let y=0;y<height;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke()}
  ctx.fillStyle='#aabdc9';
  ctx.beginPath();ctx.ellipse(cx,cy+radius*.13,radius*1.13,radius*1.02,0,0,TAU);ctx.fill();
  ctx.fillStyle='#fafcff';
  ctx.beginPath();ctx.arc(cx,cy,radius*1.08,0,TAU);ctx.fill();
  ctx.lineWidth=6;ctx.strokeStyle='#a1b4c4';ctx.stroke();
  ctx.fillStyle=currentArena==='xtreme'?'#eef3f7':'#bdcfdb';
  ctx.beginPath();ctx.arc(cx,cy,radius*.91,0,TAU);ctx.fill();
  ctx.lineWidth=2;ctx.strokeStyle='#9aafc0';ctx.stroke();
  if(currentArena==='xtreme'){
   ctx.strokeStyle='#a7ed43';ctx.lineWidth=8;
   ctx.shadowColor='#a6ff4d';ctx.shadowBlur=12;
   ctx.beginPath();ctx.arc(cx,cy,radius*.96,0,TAU);ctx.stroke();
   ctx.shadowBlur=0;
   for(const [i,angle] of [-.70,.65,2.45].entries()){
    ctx.beginPath();ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,radius*.95,angle-.19,angle+.19);ctx.closePath();
    ctx.fillStyle=i===0?'rgba(161,244,63,.20)':'rgba(69,107,139,.20)';ctx.fill();
   }
  }else{
   ctx.strokeStyle='#5b829b';ctx.lineWidth=4;
   ctx.beginPath();ctx.arc(cx,cy,radius*.94,0,TAU);ctx.stroke();
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
   ctx.globalAlpha=.55;ctx.strokeStyle=colors[i];ctx.lineWidth=3;
   ctx.shadowColor=colors[i];ctx.shadowBlur=12;ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha=1;
  }
  for(let i=0;i<2;i++){
   const t=state?.tops?.[i],spec=visualBuilds[i];if(!t)continue;
   const outcome=state.done?state.terminal:null,loser=outcome?.loser===i,finished=outcome?.finish;
   const age=Math.min(1.2,Math.max(0,finalAge));
   if(loser&&(finished==='over'||finished==='extreme')&&age>1.0)continue;
   const dist=Math.hypot(t.x,t.y)||1;
   const escape=loser&&(finished==='over'||finished==='extreme')?age*.5:0;
   const px=cx+(t.x+t.x/dist*escape)/1.32*radius*.95;
   const py=cy+(t.y+t.y/dist*escape)/1.32*radius*.95;
   const rise=Math.max(0,Number(t.height)||0);
   const r=Math.max(15,radius*(spec?.radius||.13)/1.32*1.65)*(1+rise*.22);
   // Ground shadow stays on the launch point while the top descends.
   if(rise>0){
    ctx.save();ctx.globalAlpha=Math.max(.10,.30-rise*.18);ctx.fillStyle='#284e69';
    ctx.beginPath();ctx.ellipse(px,py,r*.76,r*.30,0,0,TAU);ctx.fill();ctx.restore();
   }
   ctx.save();ctx.translate(px,py-rise*radius*.53);
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
  const now=(state?.elapsed||0)+(state?.done?finalAge:0);
  for(const effect of fx){
   const age=Math.max(0,now-effect.t);
   if(age>.65)continue;
   const px=cx+effect.x/1.32*radius*.95,py=cy+effect.y/1.32*radius*.95;
   const scale=1+age*3.2,opacity=Math.max(0,1-age/.65);
   ctx.save();ctx.translate(px,py);ctx.globalAlpha=opacity;
   ctx.strokeStyle=effect.kind==='dash'?'#4af5fa':effect.kind==='land'?'#8ddff3':'#fff5ad';
   ctx.lineWidth=2.4;ctx.shadowBlur=12;
   ctx.shadowColor=effect.kind==='dash'?'#2cf6ff':effect.kind==='land'?'#8ddff3':'#ffc441';
   ctx.beginPath();ctx.arc(0,0,Math.min(33,10*scale),0,TAU);ctx.stroke();
   for(let k=0;k<12;k++){
    const a=k*TAU/12+effect.t*.8,d=18*scale*(k%3===0?1.3:.7);
    ctx.beginPath();ctx.moveTo(Math.cos(a)*8,Math.sin(a)*8);
    ctx.lineTo(Math.cos(a)*d,Math.sin(a)*d);ctx.stroke();
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
     // The user may be inspecting a stationary setup before the battle starts.
     // Re-render once the selected part texture actually finishes loading.
     renderState(lastState,{finalAge:lastFinishAge});
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
   gl.setClearColor(0x112f61,1);gl.outputColorSpace=T.SRGBColorSpace;
   const scene=new T.Scene();
   scene.background=new T.Color(0x112f61);
   scene.fog=new T.Fog(0x112f61,5.2,10);
   const cam=new T.PerspectiveCamera(43,1,.1,25);
   cam.position.set(0,3.5,2.45);cam.lookAt(0,0,0);
   scene.add(new T.HemisphereLight(0xf8fcff,0x5b789f,3.1));
   const key=new T.DirectionalLight(0xfffbec,3.15);key.position.set(-2.2,4.2,2.8);scene.add(key);
   const backgroundGrid=new T.GridHelper(8,24,0x6999cf,0x3061a2);
   backgroundGrid.position.y=-.29;
   scene.add(backgroundGrid);
   const group=new T.Group();
   const shell=new T.MeshStandardMaterial({color:0xf1f5f8,metalness:.14,roughness:.31});
   const bright=new T.MeshStandardMaterial({color:0xf9fcff,metalness:.11,roughness:.26});
   const mat=new T.MeshStandardMaterial({color:0xeaf0f4,metalness:.13,roughness:.38});
   const frame=new T.Mesh(new T.CylinderGeometry(1.45,1.53,.20,12),shell);
   frame.position.y=-.15;frame.rotation.y=Math.PI/12;group.add(frame);
   const basin=new T.Mesh(new T.CylinderGeometry(1.32,1.34,.095,112),bright);
   basin.position.y=-.045;group.add(basin);
   const floor=new T.Mesh(new T.CylinderGeometry(1.29,1.29,.014,112),mat);
   floor.position.y=.011;group.add(floor);
   // The launch halves are simulation-only. Keep the physical stadium visually continuous.
   const rim=new T.Mesh(new T.TorusGeometry(1.37,.073,14,128),
    new T.MeshStandardMaterial({color:0xfafcff,metalness:.27,roughness:.24}));
   rim.rotation.x=Math.PI/2;rim.position.y=.065;group.add(rim);
   const groove=new T.Mesh(new T.TorusGeometry(1.29,.026,10,112),
    new T.MeshStandardMaterial({color:0x9db3c5,metalness:.38,roughness:.42}));
   groove.rotation.x=Math.PI/2;groove.position.y=.02;group.add(groove);
   // Light green Xtreme line: only visible on Xtreme stadium.
   const guide=new T.Mesh(new T.TorusGeometry(1.17,.038,12,116),
    new T.MeshStandardMaterial({color:0xb6f344,emissive:0x69b626,
      emissiveIntensity:.84,metalness:.19,roughness:.2}));
   guide.rotation.x=Math.PI/2;guide.position.y=.075;group.add(guide);
   const pocketGroup=new T.Group();
   const darkPocket=new T.MeshStandardMaterial({color:0x6b8397,metalness:.28,roughness:.43});
   for(const [j,theta] of [-.70,.65,2.45].entries()){
    const pocket=new T.Mesh(new T.RingGeometry(1.13,1.40,20,1,theta-.22,.44),
     new T.MeshBasicMaterial({color:j===0?0x97de3a:0x7b96ae,transparent:true,
       opacity:j===0?.8:.57,side:T.DoubleSide,depthWrite:false}));
    pocket.rotation.x=-Math.PI/2;pocket.position.y=.049;pocketGroup.add(pocket);
    const rimPost=new T.Mesh(new T.BoxGeometry(.24,.115,.20),bright);
    rimPost.position.set(Math.cos(theta)*1.47,.08,Math.sin(theta)*1.47);
    rimPost.rotation.y=-theta;pocketGroup.add(rimPost);
   }
   group.add(pocketGroup);
   const frontGuide=new T.Mesh(new T.BoxGeometry(1.85,.052,.075),
     new T.MeshStandardMaterial({color:0xbbf64d,emissive:0x5aaa20,emissiveIntensity:.75}));
   frontGuide.position.set(0,.03,1.35);pocketGroup.add(frontGuide);
   for(let j=0;j<68;j++){
    const theta=j*TAU/68;
    const tick=new T.Mesh(new T.BoxGeometry(.02,.003,.011),
     new T.MeshBasicMaterial({color:j%8===0?0x52697c:0xaac0ce}));
    tick.position.set(Math.cos(theta)*.86,.021,Math.sin(theta)*.86);
    tick.rotation.y=-theta;group.add(tick);
   }
   // Embossed white side panels echo the stepped stadium shell.
   for(let j=0;j<8;j++){
    const theta=j*TAU/8;
    const arm=new T.Mesh(new T.BoxGeometry(.16,.045,.27),shell);
    arm.position.set(Math.cos(theta)*1.42,.055,Math.sin(theta)*1.42);
    arm.rotation.y=-theta;group.add(arm);
   }
   // Effects are purely visual. Physics remains in sim-engine.js.
   fx3D=new T.Group();scene.add(fx3D);
   for(let i=0;i<2;i++){
    const geo=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]);
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
   for(let i=0;i<14;i++){
    const material=new T.SpriteMaterial({map:sparkTexture,
      color:0xffe9ae,blending:T.AdditiveBlending,transparent:true,depthWrite:false});
    const sprite=new T.Sprite(material);
    sprite.visible=false;sprite.position.y=.21;
    sprite.scale.set(.4,.4,1);fx3D.add(sprite);fxSprites.push(sprite);
   }
   scene.add(group);
   THREE=T;renderer=gl;world=scene;camera=cam;stadium=group;rail=guide;pockets=pocketGroup;floorMaterial=mat;
   container.replaceChildren(gl.domElement);
   gl.domElement.className='sim-three-canvas';
   setArena(currentArena);
   setBuilds(visualBuilds);
   status.textContent='3D 即時畫面｜白色立體盤・亮綠導軌・零件貼圖（外形近似）';
   renderState(lastState,{finalAge:lastFinishAge});
  }catch(error){
   status.textContent='3D 載入失敗，已改用相同物理狀態的 2D 畫面。';
   console.warn('WebGL/Three.js unavailable',error);
  }
 }
 function renderState(state,opts={}){
  lastState=state||null;
  lastFinishAge=Math.max(0,Math.min(1.3,Number(opts.finalAge)||0));
  updateEffects(lastState,lastFinishAge);
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
   mesh.root.position.set(x,.016+Math.max(0,Number(t.height)||0)+(loser&&finish==='burst'?age*.014:0),z);
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
  if(rail)rail.material.emissiveIntensity=(state?.tops?.some(t=>t.railCooldown>2)?1.45:.84);
  for(let i=0;i<trailLines.length;i++){
   const line=trailLines[i],points=trails[i]||[];
   line.visible=!!state&&!state.done&&points.length>=2;
   if(line.visible){
    line.geometry.dispose();
    line.geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p.x,.13,p.y)));
   }
  }
  const now=(Number(state?.elapsed)||0)+(state?.done?lastFinishAge:0);
  const bursts=fx.slice(-fxSprites.length);
  for(let i=0;i<fxSprites.length;i++){
   const sprite=fxSprites[i],burst=bursts[i];
   if(!burst){sprite.visible=false;continue}
   const age=Math.max(0,now-burst.t),remaining=Math.max(0,1-age/.65);
   if(!remaining){sprite.visible=false;continue}
   sprite.visible=true;
   sprite.position.set(burst.x,.29,burst.y);
   const size=(burst.kind==='dash'?.32:burst.kind==='land'?.19:burst.kind==='finish'?.67:.48)*(1+age*3);
   sprite.scale.set(size,size,1);
   sprite.material.opacity=remaining*.97;
   sprite.material.color.setHex(burst.kind==='dash'?0x79ffff:burst.kind==='land'?0x8ddff3:burst.kind==='finish'?0xf7ffdc:0xffd686);
  }
  const recent=fx.slice().reverse().find(e=>e.kind==='hit'&&now-e.t<.2);
  if(recent){
   // Small camera tremor on impact; synchronized to the collision event.
   const t=Math.max(0,1-(now-recent.t)/.2);
   camera.position.set(.018*t*Math.sin(recent.t*83),3.5,.018*t*Math.cos(recent.t*95)+2.45);
  }else camera.position.set(0,3.5,2.45);
  camera.lookAt(0,0,0);
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
