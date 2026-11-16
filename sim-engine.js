/* BEYBLADE X prototype: deterministic, ability-driven *model*, not measured physics.
   All distances/time/energy/masses in internal normalized units. No real SI claim. */
(function(root){
'use strict';
const VERSION="sim-v1.0";
const TAU=Math.PI*2, DT=1/120, R=1.32, MAX_TIME=33;
const cap=(v,a=0,b=100)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:0));
const n=(obj,key)=>Number.isFinite(obj?.[key])?obj[key]:0;
const sum=(...items)=>items.reduce((o,x)=>{for(const k of ['attack','defense','stamina'])o[k]+=n(x,k);return o},{attack:0,defense:0,stamina:0});
function rand(seed){let t=(Math.trunc(Number(seed))>>>0)||1;return()=>{t+=0x6D2B79F5;let q=t;q=Math.imul(q^(q>>>15),q|1);q^=q+Math.imul(q^(q>>>7),q|61);return((q^(q>>>14))>>>0)/4294967296}}
function labelOwner(owner,db){const b=db.beys.find(x=>x.id===owner);if(!b)throw Error("找不到實體配件："+owner);return b}
function kind(owner,key,db,attributes){const b=labelOwner(owner,db),rec=attributes.beys?.[owner]?.parts?.[key];if(!rec?.available||!rec.stats)throw Error("配件缺少已核對的能力："+b.name+"／"+key);return{b,rec}}
function makeBuild(config,db,attributes){
 if(!config||!config.ratchet||!config.bit)throw Error("請選擇固鎖與軸心。");
 const rc=kind(config.ratchet,"ratchet",db,attributes),bt=kind(config.bit,"bit",db,attributes);
 let bl,bladeOwner,parts,flags=[];
 if(config.mode==="cx"){
  if(!config.chip||!config.main||!config.assist)throw Error("CX 需選擇紋章、主刃、輔助刃。");
  const chip=kind(config.chip,"lockChip",db,attributes),main=kind(config.main,"mainBlade",db,attributes),assist=kind(config.assist,"assistBlade",db,attributes);
  bl=sum(chip.rec.stats,main.rec.stats,assist.rec.stats);bladeOwner=main.b;
  parts=[["lockChip",chip],["mainBlade",main],["assistBlade",assist],["ratchet",rc],["bit",bt]];
  flags=["CX 合成能力值不代表實際完整戰刃測量"];
 }else{
  const main=kind(config.blade,"blade",db,attributes);
  bl=main.rec.stats;bladeOwner=main.b;
  // For CX's catalog-assembled Blade, use it as ONE locked element.
  parts=[["blade",main],["ratchet",rc],["bit",bt]];
 }
 const x={
  attack:cap(n(bl,"attack")*.62+n(rc.rec.stats,"attack")*.12+n(bt.rec.stats,"attack")*.26+n(bt.rec.stats,"dash")*.17),
  defense:cap(n(bl,"defense")*.62+n(rc.rec.stats,"defense")*.15+n(bt.rec.stats,"defense")*.23+n(bt.rec.stats,"burst")*.08),
  stamina:cap(n(bl,"stamina")*.62+n(rc.rec.stats,"stamina")*.13+n(bt.rec.stats,"stamina")*.25),
  dash:cap(n(bt.rec.stats,"dash")),burst:cap(n(bt.rec.stats,"burst"))
 };
 const names=parts.map(([key,v])=>({key,owner:v.b.id,code:key==="ratchet"?v.b.ratchet:key==="bit"?v.b.bit:key==="blade"?v.b.blade:key==="lockChip"?v.b.lockChip:key==="mainBlade"?v.b.mainBlade:v.b.assistBlade}));
 // Identical model names are repeated parts even when from separate physical units.
 const signatures=names.map(p=>p.key+":"+String(p.code||"").trim().toUpperCase());
 const unique=new Set(signatures);
 if(unique.size!==signatures.length)flags.push("同顆配置存在重複同類名稱，請檢查相容性");
 const partPhysical=names.map(p=>p.key+":"+p.owner);
 const height=n(rc.rec.stats,"height");
 const launcherSpeed=(n(x,"attack")*.08+n(x,"dash")*.12);
 return{
  mode:config.mode==="cx"?"cx":"whole",
  config:{...config},name:bladeOwner.name+" "+rc.b.ratchet+bt.b.bit,
  spin:bladeOwner.spinDirection==="L"?-1:1,vector:x,
  partPhysical,partModel:signatures,parts:names,flags,
  // Unmeasured dynamics proxies; these are NOT grams, kg*m^2, N or RPM.
  radius:0.107+0.00015*(x.defense+x.attack),
  massProxy:1+0.0024*x.defense+0.0013*x.attack,
  inertiaProxy:0.8+0.004*x.stamina+0.002*x.defense,
  staminaDrag:1.15+(100-x.stamina)*0.023,
  lateralDrag:0.42+(100-x.stamina)*0.002,
  burstThreshold:0.52+0.0078*x.burst,
  collisionGrip:0.45+0.0042*x.attack+0.0018*x.dash,
  railEfficiency:0.25+0.009*x.dash,
  launchTransfer:0.74+0.0024*x.attack+0.001*launcherSpeed,
  ratchetHeight:height,
  type:bt.rec.type||"unknown"
 };
}
function validateDeck(deck){
 if(!Array.isArray(deck)||![1,3].includes(deck.length))throw Error("隊伍必須包含 1 或 3 顆。");
 const inventory=new Set(),models=new Set();
 for(const build of deck){
  for(let i=0;i<build.partPhysical.length;i++){
   const id=build.partPhysical[i],model=build.partModel[i];
   if(inventory.has(id))throw Error("三顆不能重複使用同一個實體零件："+id);
   inventory.add(id);
   // Official 3on3 rule: different colors of the same part model still repeat.
   // Special lock-chip exceptions are handled separately, subject to tournament rules.
   if(deck.length===3&&!model.startsWith("lockChip:")){
    if(models.has(model))throw Error("三顆不能重複使用同型號零件（即使顏色不同）："+model);
    models.add(model);
   }
  }
 }
 return true;
}
function initTop(spec,side,opts,rng){
 const power=cap(opts.power,20,100),angle=cap(opts.angle,-35,35)*Math.PI/180;
 const launcherProxy=opts.type==='string'?1.04:1; // uncalibrated launcher model
 const launching=power/100,sign=side===0?1:-1;
 const x=sign*-0.43,y=(side===0?-0.075:0.075);
 const speed=0.31+0.25*launching+(spec.vector.dash/100)*0.12;
 return{
  x,y,vx:sign*speed*Math.cos(angle)+0.05*(rng()-.5),
  vy:sign*speed*Math.sin(angle)+(side===0?0.11:-0.11),
  spin:19+launching*48*spec.launchTransfer*launcherProxy+4*(rng()-.5),
  wobble:0,shock:0,burstLoad:0,railCooldown:0,
  exited:false,burst:false,spinSign:spec.spin,side,
  heading:rng()*TAU,tilt:0,model:spec
 };
}
function createBattle(left,right,settings={}){
 const seed=(Number(settings.seed)||1)>>>0,rng=rand(seed);
 const launcher=settings.launch||[{power:75,angle:0},{power:75,angle:0}];
 const env={rail:settings.rail!==false,arena:settings.arena||"xtreme"};
 const state={version:VERSION,seed,elapsed:0,done:false,winner:null,finish:null,points:0,
  tops:[initTop(left,0,launcher[0]||{},rng),initTop(right,1,launcher[1]||{},rng)],events:[],env,collisionCount:0,railCount:0,lastContactAt:-5};
 function record(type,who,message){if(settings.record!==false&&state.events.length<120)state.events.push({t:+state.elapsed.toFixed(2),type,who,message})}
 function decide(winner,finish){
  if(state.done)return;
  state.done=true;state.winner=winner;state.finish=finish;
  state.points=finish==="extreme"?3:finish==="over"||finish==="burst"?2:finish==="spin"?1:0;
  record("finish",winner,finish==="extreme"?"Xtreme Finish":finish==="over"?"Over Finish":finish==="burst"?"Burst Finish":finish==="spin"?"Spin Finish":"平手");
 }
 function move(dt){
  if(state.done)return;
  state.elapsed+=dt;
  for(const t of state.tops){
   const m=t.model,v=m.vector;
   t.heading+=t.spinSign*t.spin*dt*0.46;
   t.spin=Math.max(0,t.spin-dt*(m.staminaDrag+0.13*t.wobble));
   const damping=Math.max(0,1-dt*(m.lateralDrag+0.09*t.wobble));
   t.vx*=damping;t.vy*=damping;
   // Stadium slope pulls inward; Xtreme-style rails drive tangent movement.
   const radius=Math.hypot(t.x,t.y);
   if(radius>0.01){
    const slope=0.15+0.11*Math.min(1,radius/R)-0.29*(v.dash/100);
    t.vx-=dt*slope*t.x/radius;
    t.vy-=dt*slope*t.y/radius;
    // Bit mobility is modelled as an additional tangential tendency.
    const roam=0.026+0.0013*v.dash;
    t.vx+=dt*(-t.y/radius)*t.spinSign*roam;
    t.vy+=dt*(t.x/radius)*t.spinSign*roam;
   }
   t.x+=t.vx*dt;t.y+=t.vy*dt;
   t.railCooldown=Math.max(0,t.railCooldown-dt);
   t.wobble=Math.max(0,t.wobble-dt*(0.22+v.defense*.002));
   const r=Math.hypot(t.x,t.y);
   if(env.rail&&r>1.10&&r<R&&t.railCooldown===0&&t.spin>12){
    const theta=Math.atan2(t.y,t.x);
    const push=Math.min(0.94,m.railEfficiency*0.75)*(0.25+t.spin/130);
    t.vx+=-Math.sin(theta)*t.spinSign*push;
    t.vy+= Math.cos(theta)*t.spinSign*push;
    t.spin=Math.max(0,t.spin-0.85-0.025*v.dash);
    t.railCooldown=2.6;state.railCount++;
    record("dash",t.side,"Xtreme Line 衝刺（近似模型）");
   }
   if(r>R-t.model.radius*0.55){
    const theta=Math.atan2(t.y,t.x);
    const pocket=(env.arena==="xtreme"&&Math.abs(theta+0.70)<0.30)?"extreme":
      (Math.abs(theta-0.65)<0.30||Math.abs(theta-2.45)<0.18)?"over":null;
    const outward=(t.vx*t.x+t.vy*t.y)/Math.max(r,0.01);
    const momentum=Math.hypot(t.vx,t.vy);
    const escapeThreshold=0.36+0.0018*v.defense;
    if(pocket&&outward>0.12&&momentum>escapeThreshold){
      t.exited=true;decide(1-t.side,pocket);return;
    }
    const nx=t.x/r,ny=t.y/r;
    t.x=nx*(R-m.radius*0.55);t.y=ny*(R-m.radius*0.55);
    const vn=t.vx*nx+t.vy*ny;
    if(vn>0){t.vx-=1.63*vn*nx;t.vy-=1.63*vn*ny;t.spin=Math.max(0,t.spin-(0.25+vn*0.55));t.wobble+=0.04+vn*.05;}
   }
  }
  const [a,b]=state.tops,dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||0.0001;
  const minDist=a.model.radius+b.model.radius;
  if(dist<minDist){
   const nx=dx/dist,ny=dy/dist;
   const penetration=minDist-dist;
   a.x-=nx*penetration*.5;a.y-=ny*penetration*.5;
   b.x+=nx*penetration*.5;b.y+=ny*penetration*.5;
   const approach=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
   if(approach<0&&state.elapsed-state.lastContactAt>0.24){
    state.lastContactAt=state.elapsed;
    state.collisionCount++;
    const impulse=-(1+0.49)*approach/(1/a.model.massProxy+1/b.model.massProxy);
    const attackA=a.model.vector.attack/100,attackB=b.model.vector.attack/100;
    const hitStrength=(0.28+impulse)*(0.7+.42*(attackA+attackB))*(.90+.2*rng());
    const ia=impulse/a.model.massProxy,ib=impulse/b.model.massProxy;
    a.vx-=nx*(ia+0.34+hitStrength*.73);a.vy-=ny*(ia+0.34+hitStrength*.73);
    b.vx+=nx*(ib+0.34+hitStrength*.73);b.vy+=ny*(ib+0.34+hitStrength*.73);
    for(const [t,attacker] of [[a,b],[b,a]]){
     const defense=t.model.vector.defense/100;
     const attackerAttack=attacker.model.vector.attack/100;
     t.spin=Math.max(0,t.spin-hitStrength*(1.6+2*attackerAttack)/(0.7+defense));
     t.wobble+=hitStrength*(.16+.15*attackerAttack)/(0.7+defense);
     t.burstLoad+=hitStrength*(0.28+0.18*attackerAttack)/(0.65+t.model.vector.burst/100);
    }
    if(hitStrength>0.11&&state.collisionCount%2===1)record("hit",null,"衝擊 "+hitStrength.toFixed(2)+"（模型單位）");
    // Latched components do not have a measured mechanical burst threshold.
    const excess=[a,b].map(t=>t.burstLoad-t.model.burstThreshold);
    if(Math.max(...excess)>0){
      const loser=excess[0]===excess[1]?(rng()<.5?0:1):(excess[0]>excess[1]?0:1);
      state.tops[loser].burst=true;decide(1-loser,"burst");return;
    }
   }
  }
  const stopped=state.tops.map(x=>x.spin<3.0);
  if(stopped[0]||stopped[1]){
   if(stopped[0]&&stopped[1])decide(null,"draw");else decide(stopped[0]?1:0,"spin");
   return;
  }
  if(state.elapsed>=MAX_TIME){
   // If neither truly stopped, declare draw: do not invent a winner.
   decide(null,"draw");
  }
 }
 state.step=(steps=1)=>{
  const count=Math.max(1,Math.min(180,Math.trunc(steps)));
  for(let i=0;i<count&&!state.done;i++)move(DT);
  return state;
 };
 return state;
}
function runBattle(a,b,options={}){
 const battle=createBattle(a,b,options);
 for(let step=0;!battle.done&&step<Math.ceil(MAX_TIME/DT)+3;step++)battle.step();
 if(!battle.done)throw Error("Simulation step limit exceeded");
 return {winner:battle.winner,finish:battle.finish,points:battle.points,time:battle.elapsed,
  collisions:battle.collisionCount,rails:battle.railCount,seed:battle.seed,events:battle.events};
}
function simulateMatch(left,right,options={}){
 if(!Array.isArray(left)||!Array.isArray(right)||left.length!==right.length||![1,3].includes(left.length))throw Error("雙方必須各提供 1 或 3 顆陀螺");
 validateDeck(left);validateDeck(right);
 const target=cap(options.targetPoints||4,1,12);
 const seed=Number(options.seed)||1;
 const points=[0,0],rounds=[];
 let number=0,streak=0;
 // Sequential 3on3: never run six Beyblades inside the stadium at once.
 while(Math.max(...points)<target&&number<24){
  const offset=number%left.length,roundSeed=(seed+Math.imul(number+1,0x9E3779B1))>>>0;
  const battle=runBattle(left[offset],right[offset],{seed:roundSeed,record:false,launch:options.launch,arena:options.arena,rail:options.rail});
  rounds.push({index:number+1,left:offset,right:offset,...battle});
  if(battle.winner!==null){points[battle.winner]+=battle.points;streak=0}else streak++;
  number++;
  if(streak>=5)break;
 }
 return {winner:points[0]>points[1]?0:points[1]>points[0]?1:null,
  scores:points,rounds,mode:left.length===1?"1v1":"3v3",seed,
  finalized:Math.max(...points)>=target||rounds.length>=24,assumptions:"unitless_uncalibrated_model"};
}
root.BBX_SIM_CORE={VERSION,DT,MAX_TIME,makeBuild,validateDeck,createBattle,runBattle,simulateMatch,rand};
})(typeof window!=="undefined"?window:this);
