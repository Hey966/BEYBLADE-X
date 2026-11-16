/* Optional true 3D presentation of the deterministic 2D-plane physics.
   Generic tops are visual placeholders, not licensed/manufacturer-accurate meshes.
   If Three.js / WebGL cannot load, use a fully functional Canvas 2D fallback. */
(function(root){
'use strict';
const THREE_CDN="https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
const TAU=Math.PI*2;
function create(container,status){
 let three=null,camera=null,scene=null,renderer=null,models=[],ring=null;
 const fallback=document.createElement("canvas");
 fallback.className="sim-canvas-fallback";
 fallback.setAttribute("aria-label","陀螺競技場：二維模擬備援畫面");
 container.replaceChildren(fallback);
 status.textContent="正在載入 3D 顯示。物理計算不依賴 3D 模型。";
 const ctx=fallback.getContext("2d");
 function draw2d(s){
  if(!ctx)return;
  const rect=container.getBoundingClientRect(),w=Math.max(300,Math.round(rect.width)),h=Math.max(260,Math.round(rect.height));
  const dpr=Math.min(2,window.devicePixelRatio||1);
  if(fallback.width!==Math.round(w*dpr)||fallback.height!==Math.round(h*dpr)){fallback.width=Math.round(w*dpr);fallback.height=Math.round(h*dpr)}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const radius=Math.min(w*.43,h*.46),cx=w/2,cy=h/2;
  const bg=ctx.createRadialGradient(cx,cy,radius*.1,cx,cy,radius*1.23);
  bg.addColorStop(0,"#374e5e");bg.addColorStop(.83,"#1c2c39");bg.addColorStop(1,"#071220");
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  ctx.beginPath();ctx.arc(cx,cy,radius*1.04,0,TAU);ctx.fillStyle="#415467";ctx.fill();
  ctx.beginPath();ctx.arc(cx,cy,radius*.985,0,TAU);ctx.fillStyle="#172532";ctx.fill();
  ctx.strokeStyle="#e98142";ctx.lineWidth=6;ctx.beginPath();ctx.arc(cx,cy,radius*.86,0,TAU);ctx.stroke();
  ctx.setLineDash([5,12]);ctx.strokeStyle="rgba(186,219,230,.25)";ctx.lineWidth=1.2;
  ctx.beginPath();ctx.arc(cx,cy,radius*.57,0,TAU);ctx.stroke();ctx.setLineDash([]);
  for(const p of s?.tops||[]){
   const px=cx+p.x/1.32*radius*.91,py=cy+p.y/1.32*radius*.91;
   const r=radius*.104*(.75+p.model.radius/.107*.23);
   ctx.save();ctx.translate(px,py);ctx.rotate(p.heading);
   ctx.fillStyle="rgba(0,0,0,.40)";ctx.beginPath();ctx.ellipse(3,5,r*1.10,r*.92,0,0,TAU);ctx.fill();
   ctx.fillStyle=p.side===0?"#e5f1f7":"#ff9369";ctx.strokeStyle=p.side===0?"#85c8d3":"#c44d42";
   ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();ctx.stroke();
   ctx.fillStyle=p.side===0?"#426b80":"#8b2f35";for(let k=0;k<4;k++){ctx.rotate(TAU/4);ctx.fillRect(r*.5,-r*.14,r*.52,r*.28)}
   ctx.beginPath();ctx.arc(0,0,r*.45,0,TAU);ctx.fillStyle="#f3d16b";ctx.fill();
   ctx.restore();
  }
  ctx.fillStyle="#b5d4e8";ctx.font="12px system-ui";ctx.fillText("2D 備援視角 · 由相同物理引擎驅動",11,h-12);
 }
 async function initThree(){
  try{
   const T=await import(THREE_CDN);
   const render=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:"low-power"});
   render.setPixelRatio(Math.min(1.7,window.devicePixelRatio||1));
   render.setClearColor(0x0b1724,1);
   render.outputColorSpace=T.SRGBColorSpace;
   const world=new T.Scene();
   world.fog=new T.Fog(0x0b1724,5,9);
   const cam=new T.PerspectiveCamera(44,1,.1,30);
   cam.position.set(0,3.7,3.9);cam.lookAt(0,0,0);
   world.add(new T.HemisphereLight(0xd0eeff,0x254052,2.2));
   const spot=new T.DirectionalLight(0xfff5db,2.4);spot.position.set(-1,4,3);world.add(spot);
   const floorMat=new T.MeshStandardMaterial({color:0x243b4b,roughness:.49,metalness:.21});
   const floor=new T.Mesh(new T.CylinderGeometry(1.37,1.45,.09,100),floorMat);
   floor.position.y=-.065;world.add(floor);
   const inset=new T.Mesh(new T.CylinderGeometry(1.21,1.21,.011,96),new T.MeshStandardMaterial({color:0x1b2a3a,metalness:.36,roughness:.42}));
   inset.position.y=-.01;world.add(inset);
   const edge=new T.Mesh(new T.TorusGeometry(1.36,.066,12,96),new T.MeshStandardMaterial({color:0x9db0be,metalness:.65,roughness:.32}));
   edge.rotation.x=Math.PI/2;edge.position.y=.015;world.add(edge);
   const xrail=new T.Mesh(new T.TorusGeometry(1.16,.022,10,96),new T.MeshStandardMaterial({color:0xee8d4f,emissive:0x873d18,emissiveIntensity:.4,metalness:.4}));
   xrail.rotation.x=Math.PI/2;xrail.position.y=.018;world.add(xrail);
   const stripes=new T.Group();
   for(let i=0;i<64;i++){const theta=i/64*TAU;const tick=new T.Mesh(new T.BoxGeometry(.044,.006,.016),new T.MeshBasicMaterial({color:i%8===0?0xf7cb72:0x7a9caf}));
    tick.position.set(Math.cos(theta)*1.01,.016,Math.sin(theta)*1.01);tick.rotation.y=-theta;stripes.add(tick)}
   world.add(stripes);
   function makeTop(color,index){
    const g=new T.Group(),mat=new T.MeshStandardMaterial({color,roughness:.25,metalness:.7}),accent=new T.MeshStandardMaterial({color:index===0?0x80e2f0:0xf9b14a,metalness:.5,roughness:.38});
    const disk=new T.Mesh(new T.CylinderGeometry(.117,.087,.052,12),mat);g.add(disk);
    const brim=new T.Mesh(new T.TorusGeometry(.094,.019,7,36),accent);brim.rotation.x=Math.PI/2;brim.position.y=.034;g.add(brim);
    for(let j=0;j<6;j++){const piece=new T.Mesh(new T.BoxGeometry(.09,.018,.032),mat);piece.rotation.y=j*TAU/6;piece.position.set(Math.cos(j*TAU/6)*.095,.04,Math.sin(j*TAU/6)*.095);g.add(piece)}
    const badge=new T.Mesh(new T.CylinderGeometry(.041,.041,.062,20),accent);badge.position.y=.041;g.add(badge);
    g.position.y=.082;world.add(g);return g;
   }
   const tops=[makeTop(0xd3e1e8,0),makeTop(0xe05750,1)];
   container.replaceChildren(render.domElement);
   render.domElement.className="sim-three-canvas";
   renderer=render;scene=world;camera=cam;models=tops;three=T;ring=xrail;
   status.textContent="3D 即時畫面 · 通用陀螺模型（非實物掃描）";
  }catch(error){
   status.textContent="3D 模組無法載入，已切換 2D 備援。物理模擬功能不受影響。";
   console.warn("Three.js unavailable, 2D fallback active",error);
  }
 }
 function renderState(s){
  if(!renderer||!three||!scene){draw2d(s);return}
  const rect=container.getBoundingClientRect();
  if(rect.width<40)return;
  const w=Math.round(rect.width),h=Math.max(220,Math.round(rect.height));
  if(renderer.domElement.width!==Math.round(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(h*renderer.getPixelRatio())){
   renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
  }
  for(let i=0;i<2;i++){
   const t=s?.tops?.[i],mesh=models[i];
   mesh.visible=!!t;
   if(!t)continue;
   mesh.position.set(t.x,.09+Math.min(.12,t.wobble*.018),t.y);
   mesh.rotation.y=t.heading;
   mesh.rotation.z=Math.sin(t.heading*.38)*Math.min(.18,t.wobble*.07);
   mesh.rotation.x=Math.cos(t.heading*.36)*Math.min(.18,t.wobble*.07);
  }
  if(ring)ring.material.emissiveIntensity=(s?.tops?.some(x=>x.railCooldown>2)?1.2:.4);
  renderer.render(scene,camera);
 }
 initThree();
 draw2d(null);
 return {render:renderState,destroy(){renderer?.dispose();container.replaceChildren()}};
}
root.BBX_SIM_VIEW={create};
})(typeof window!=="undefined"?window:this);
