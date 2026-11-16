/* BEYBLADE X prototype: deterministic, ability-driven *model*, not measured physics.
   All distances/time/energy/masses in internal normalized units. No real SI claim. */
(function(root){
'use strict';
const VERSION="sim-v1.5";
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
  // A factory-assembled CX Blade still physically contains its own chip/main/assist.
  // Track the three module owners for deck-uniqueness without double-counting stats.
  parts=main.b.system==='CX'?
    [["lockChip",kind(main.b.id,"lockChip",db,attributes)],
     ["mainBlade",kind(main.b.id,"mainBlade",db,attributes)],
     ["assistBlade",kind(main.b.id,"assistBlade",db,attributes)],
     ["ratchet",rc],["bit",bt]]:
    [["blade",main],["ratchet",rc],["bit",bt]];
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
  // Approximate collision footprint sized relative to the dish; not a real diameter.
  radius:0.168+0.00023*(x.defense+x.attack),
  massProxy:1+0.0024*x.defense+0.0013*x.attack,
  inertiaProxy:0.8+0.004*x.stamina+0.002*x.defense,
  staminaDrag:1.15+(100-x.stamina)*0.023,
  lateralDrag:0.42+(100-x.stamina)*0.002,
  // Prototype burst resistance: parts with higher burst and defense scores resist shock.
  burstThreshold:1.46+0.008*x.burst+0.002*x.defense,
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
 // SP is a user-controlled simulation input, not a calibrated Beybattle Pass measurement.
 const power=cap(opts.power??10500,0,14000),angle=cap(opts.angle??0,-35,35)*Math.PI/180;
 const launcherProxy=opts.type==='string'?1.04:1; // uncalibrated launcher model
 const launching=power/14000,sign=side===0?1:-1;
 // The centre line divides LAUNCH ZONES, not the active battle arena.
 // Every seeded landing point stays inside its own semicircle and clear of the rim.
 const x=-sign*(0.22+0.40*rng()),y=(rng()-.5)*0.68;
 // Differing tip mobility is visible at launch, before the first collision.
 // This is an empirical animation proxy rather than measured launch velocity.
 const motionBoost=spec.type==='attack'?1.60:spec.type==='balance'?1.30:spec.type==='defense'?1.0:.85;
 const speed=(0.36+0.30*launching+(spec.vector.dash/100)*0.18)*launching*motionBoost*(0.90+0.20*rng());
 const headingJitter=(rng()-.5)*.24;
 const spin=(19+launching*48*spec.launchTransfer*launcherProxy+4*(rng()-.5))*Math.min(1,launching/.20);
 return{
  x,y,vx:sign*speed*Math.cos(angle+headingJitter),vy:sign*speed*Math.sin(angle*1.35+headingJitter)*1.28,
  height:0.48+0.16*rng(),verticalVelocity:-0.16-0.10*rng(),landed:false,bounces:0,
  // Angle changes both the horizontal launch course and visible lean.
  launchAngle:angle,tilt:angle*.95,tiltDir:side===0?0:Math.PI,
  tiltVelocity:0,impact:0,
  spin:Math.max(0,spin),wobble:0,shock:0,burstLoad:0,railCooldown:0,
  exited:false,burst:false,spinSign:spec.spin,side,
  heading:rng()*TAU,phase:rng()*TAU,model:spec
 };
}
function createBattle(left,right,settings={}){
 const seed=(Number(settings.seed)||1)>>>0,rng=rand(seed);
 const launcher=settings.launch||[{power:10500,angle:0},{power:10500,angle:0}];
 const env={rail:settings.rail!==false,arena:settings.arena||"xtreme"};
 const state={version:VERSION,seed,elapsed:0,done:false,winner:null,finish:null,points:0,
  tops:[initTop(left,0,launcher[0]||{},rng),initTop(right,1,launcher[1]||{},rng)],events:[],env,terminal:null,collisionCount:0,railCount:0,lastContactAt:-5};
 function record(type,who,message,data={}){if(settings.record!==false&&state.events.length<200)state.events.push({t:+state.elapsed.toFixed(3),type,who,message,...data})}
 function decide(winner,finish){
  if(state.done)return;
  state.done=true;state.winner=winner;state.finish=finish;
  const loser=winner===null?null:1-winner;
  state.terminal={winner,loser,finish,at:+state.elapsed.toFixed(3)};
  // Terminal event is a physical model state, not a prerecorded animation.
  if(finish==="spin"&&loser!==null)state.tops[loser].spin=0;
  if(finish==="draw")state.tops.forEach(top=>{top.spin=0});
  state.points=finish==="extreme"?3:finish==="over"||finish==="burst"?2:finish==="spin"?1:0;
  record("finish",winner,finish==="extreme"?"Xtreme Finish":finish==="over"?"Over Finish":finish==="burst"?"Burst Finish":finish==="spin"?"Spin Finish":"平手",{x:loser===null?0:+state.tops[loser].x.toFixed(3),y:loser===null?0:+state.tops[loser].y.toFixed(3),result:finish});
 }
 function move(dt){
  if(state.done)return;
  state.elapsed+=dt;
  for(const t of state.tops){
   const m=t.model,v=m.vector;
   t.heading+=t.spinSign*t.spin*dt*0.46;
   // First descend from above the stadium, rebound gently once, then join the fight.
   // All airborne and bounce states are deterministic and shared by 3D / 2D / batch.
   if(!t.landed){
    t.verticalVelocity-=7.2*dt;
    t.height=Math.max(0,t.height+t.verticalVelocity*dt);
    if(t.height===0){
     if(t.bounces===0){
      t.bounces=1;
      t.verticalVelocity=Math.min(.60,-t.verticalVelocity*.16);
      t.wobble+=.025;
      record("land",t.side,"落地輕彈（模型）",{x:+t.x.toFixed(3),y:+t.y.toFixed(3),strength:+t.verticalVelocity.toFixed(3)});
     }else{
      t.verticalVelocity=0;t.landed=true;
      record("settle",t.side,"落地穩定（模型）",{x:+t.x.toFixed(3),y:+t.y.toFixed(3)});
     }
    }
    if(!t.landed)continue;
   }
   // Impacts can briefly lift a spinning top off the floor after initial landing.
   if(t.height>0||t.verticalVelocity>0){
    t.verticalVelocity-=8.2*dt;
    t.height=Math.max(0,t.height+t.verticalVelocity*dt);
    if(t.height===0){t.verticalVelocity=0;t.wobble+=.04;}
   }
   // Lean from launch angle persists at entry, while impact-induced tilt settles.
   t.tiltVelocity+=dt*(-5.8*t.tilt-3.1*t.tiltVelocity);
   t.tilt=cap(t.tilt+t.tiltVelocity*dt,-1.18,1.18);
   t.impact=Math.max(0,t.impact-dt*2.5);
   t.burstLoad=Math.max(0,t.burstLoad-dt*.008);
   t.spin=Math.max(0,t.spin-dt*(m.staminaDrag+0.13*t.wobble+Math.abs(t.tilt)*.55));
   const damping=Math.max(0,1-dt*(m.lateralDrag+0.09*t.wobble));
   t.vx*=damping;t.vy*=damping;
   // The selected launch tilt changes the first seconds of lateral motion.
   const angleInfluence=Math.max(0,1-state.elapsed/3.0);
   t.vy+=dt*Math.sin(t.launchAngle)*t.spinSign*.55*angleInfluence;
   // Small convergence toward an encounter point. A game-model heuristic, not magnetic force.
   const opponent=state.tops[1-t.side];
   if(opponent?.landed&&state.elapsed<10&&t.spin>6){
    const ox=opponent.x-t.x,oy=opponent.y-t.y,d=Math.hypot(ox,oy);
    if(d>.30&&d<1.35){
     const converge=(.28+.0030*v.dash)*(1-d/1.55);
     t.vx+=dt*converge*ox/d;
     t.vy+=dt*converge*oy/d;
    }
   }
   // Stadium slope pulls inward; Xtreme-style rails drive tangent movement.
   const radius=Math.hypot(t.x,t.y);
   if(radius>0.01){
    const slope=0.15+0.11*Math.min(1,radius/R)-0.29*(v.dash/100);
    t.vx-=dt*slope*t.x/radius;
    t.vy-=dt*slope*t.y/radius;
    // Attack-oriented tips sweep or 'flower' around the dish. Stamina tips
    // hold a quieter center path; balance and defense are intermediate.
    // The small radial oscillation is a stylized movement approximation.
    const activity=m.type==='attack'?1:m.type==='balance'?.72:m.type==='defense'?.43:.22;
    const motion=Math.max(0,Math.min(1,t.spin/40))*Math.max(0,1-state.elapsed/24);
    const pattern=Math.sin(state.elapsed*(3.5+.018*v.dash)+t.phase);
    const radialPulse=activity*.24*motion*pattern;
    const roam=(.026+.15*activity+.0013*v.dash)*motion;
    t.vx+=dt*(radialPulse*t.x/radius-t.y/radius*t.spinSign*roam);
    t.vy+=dt*(radialPulse*t.y/radius+t.x/radius*t.spinSign*roam);
   }
   t.x+=t.vx*dt;t.y+=t.vy*dt;
   t.railCooldown=Math.max(0,t.railCooldown-dt);
   t.wobble=Math.max(0,t.wobble-dt*(0.22+v.defense*.002));
   const r=Math.hypot(t.x,t.y);
   // Keep pre-rail velocity for ring-outs: Xtreme assistance cannot undo an
   // already committed outward pocket entry in the same physics step.
   const speedBeforeRail=Math.hypot(t.vx,t.vy);
   const outwardBeforeRail=r>.001?(t.vx*t.x+t.vy*t.y)/r:0;
   if(env.rail&&r>1.085&&r<R&&t.railCooldown===0&&t.spin>12){
    const theta=Math.atan2(t.y,t.x);
    // Xtreme rail contact creates a sudden inward-and-tangential sprint.
    // Unlike the older formula, the dash carries the top across the dish.
    const push=Math.min(1.4,m.railEfficiency*1.35)*(0.55+t.spin/130);
    t.vx+=-Math.sin(theta)*t.spinSign*push-Math.cos(theta)*push*1.15;
    t.vy+= Math.cos(theta)*t.spinSign*push-Math.sin(theta)*push*1.15;
    t.spin=Math.max(0,t.spin-0.85-0.025*v.dash);
    t.railCooldown=1.85;state.railCount++;
    record("dash",t.side,"Xtreme Line 衝刺（近似模型）",{x:+t.x.toFixed(3),y:+t.y.toFixed(3),strength:+push.toFixed(3)});
   }
   if(r>R-t.model.radius*0.55){
    const theta=Math.atan2(t.y,t.x);
    const pocket=(env.arena==="xtreme"&&Math.abs(theta+0.70)<0.46)?"extreme":
      (Math.abs(theta-0.65)<0.46||Math.abs(theta-2.45)<0.276)?"over":null;
    const outward=outwardBeforeRail;
    const momentum=speedBeforeRail;
    const escapeThreshold=0.53+0.002*v.defense;
    if(pocket&&outward>0.12&&momentum>escapeThreshold){
      t.exited=true;decide(1-t.side,pocket);return;
    }
    const nx=t.x/r,ny=t.y/r;
    t.x=nx*(R-m.radius*0.55);t.y=ny*(R-m.radius*0.55);
    const vn=t.vx*nx+t.vy*ny;
    if(vn>0){
    t.vx-=1.72*vn*nx;t.vy-=1.72*vn*ny;
    t.spin=Math.max(0,t.spin-(0.25+vn*0.80));
    t.wobble+=.08+vn*.12;
    t.tiltVelocity+=Math.min(.85,vn*.8)*(rng()<.5?-1:1);
    if(vn>.40){
     t.verticalVelocity=Math.max(t.verticalVelocity,Math.min(.68,vn*.32));
     t.height=Math.max(t.height,.006);
    }
    if(vn>.28)record("wall",t.side,"競技盤邊緣反彈",{x:+t.x.toFixed(3),y:+t.y.toFixed(3),strength:+vn.toFixed(3)});
   }
   }
  }
  const [a,b]=state.tops;
  if(!a.landed||!b.landed)return; // no collisions before both tops touch down
  const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||0.0001;
  const minDist=a.model.radius+b.model.radius;
  if(dist<minDist&&Math.abs(a.height-b.height)<.15){
   const nx=dx/dist,ny=dy/dist;
   const penetration=minDist-dist;
   a.x-=nx*penetration*.5;a.y-=ny*penetration*.5;
   b.x+=nx*penetration*.5;b.y+=ny*penetration*.5;
   const approach=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
   if(approach<-.03&&state.elapsed-state.lastContactAt>0.18){
    state.lastContactAt=state.elapsed;
    state.collisionCount++;
    const impulse=-(1+0.49)*approach/(1/a.model.massProxy+1/b.model.massProxy);
    const attackA=a.model.vector.attack/100,attackB=b.model.vector.attack/100;
    const hitStrength=Math.min(2.2,(0.31+impulse*1.40)*(0.75+.57*(attackA+attackB))*(.90+.20*rng()));
    const ia=impulse/a.model.massProxy,ib=impulse/b.model.massProxy;
    const kick=.11+hitStrength*.36;
    // Normal rebound plus a small tangential glancing impulse.
    const tangent=Math.min(.20,(a.spinSign-b.spinSign)*.025+(rng()-.5)*.15);
    a.vx-=nx*(ia+kick)-ny*tangent;a.vy-=ny*(ia+kick)+nx*tangent;
    b.vx+=nx*(ib+kick)+ny*tangent;b.vy+=ny*(ib+kick)-nx*tangent;
    for(const [t,attacker] of [[a,b],[b,a]]){
     const defense=t.model.vector.defense/100;
     const attackerAttack=attacker.model.vector.attack/100;
     t.spin=Math.max(0,t.spin-hitStrength*(1.7+2.5*attackerAttack)/(0.7+defense));
     t.wobble+=hitStrength*(.25+.22*attackerAttack)/(0.7+defense);
     // Lock damage accumulates across contacts; not every first hit bursts.
     // A lower burst-resistance bit and a stronger attack increase damage.
     t.burstLoad+=hitStrength*(.40+.43*attackerAttack)/(0.83+.40*t.model.vector.burst/100);
     // A harder collision knocks the top briefly into the air and sideways.
     // The rebound magnitude depends on attack, defense, and relative motion.
     const leanSign=t.side===0?-1:1;
     t.tiltDir=Math.atan2(ny,nx)+(t.side===0?Math.PI:0);
     t.tiltVelocity+=leanSign*(.9+hitStrength*2.1)*(rng()<.5?-1:1);
     t.tilt=cap(t.tilt+leanSign*hitStrength*.11,-1.18,1.18);
     t.impact=Math.max(t.impact,Math.min(1.8,hitStrength));
     if(hitStrength>.43){
      t.verticalVelocity=Math.max(t.verticalVelocity,Math.min(1.62,.18+hitStrength*.86/(.70+defense*.60)));
      t.height=Math.max(t.height,.009);
     }
    }
    if(hitStrength>.11)record("hit",null,(hitStrength>.80?"強烈撞擊！":"碰撞反彈 ")+hitStrength.toFixed(2)+"（模型單位）",{x:+((a.x+b.x)/2).toFixed(3),y:+((a.y+b.y)/2).toFixed(3),strength:+hitStrength.toFixed(3),impactSides:[+a.impact.toFixed(2),+b.impact.toFixed(2)]});
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
 let number=0,streak=0,deckIndex=0;
 // Sequential 3on3: never run six Beyblades inside the stadium at once.
 // Ties replay the same pair, consistent with the basic 3on3 round procedure.
 while(Math.max(...points)<target&&number<24){
  const offset=deckIndex%left.length,roundSeed=(seed+Math.imul(number+1,0x9E3779B1))>>>0;
  const battle=runBattle(left[offset],right[offset],{seed:roundSeed,record:false,launch:options.launch,arena:options.arena,rail:options.rail});
  rounds.push({index:number+1,left:offset,right:offset,...battle});
  if(battle.winner!==null){points[battle.winner]+=battle.points;streak=0;deckIndex++}else streak++;
  number++;
  if(streak>=5)break;
 }
 const achieved=Math.max(...points)>=target;
 return {winner:achieved?(points[0]>points[1]?0:1):null,
  scores:points,rounds,mode:left.length===1?"1v1":"3v3",seed,
  finalized:achieved,reason:achieved?"target_reached":"unresolved_round_limit",
  assumptions:"unitless_uncalibrated_model"};
}
root.BBX_SIM_CORE={VERSION,DT,MAX_TIME,makeBuild,validateDeck,createBattle,runBattle,simulateMatch,rand};
})(typeof window!=="undefined"?window:this);
