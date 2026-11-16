/* BEYBLADE X original procedural audio. No copyrighted game recordings used.
   AudioContext starts ONLY after the user presses Start or Audio On. */
(function(root){
'use strict';
function create(){
 let context=null,master=null,enabled=true,level=.55,ambient=[];
 const AC=root.AudioContext||root.webkitAudioContext;
 function ready(){
  if(!enabled)return false;
  if(!AC)return false;
  try{
   if(!context){
    context=new AC();
    master=context.createGain();
    master.gain.value=level;
    master.connect(context.destination);
   }
   if(context.state==='suspended')context.resume().catch(()=>{});
   return true;
  }catch(e){return false}
 }
 function tone(freq,duration,volume,type='sine',opts={}){
  if(!ready())return;
  const t=context.currentTime+(opts.delay||0),osc=context.createOscillator(),gain=context.createGain();
  const attack=Math.min(.025,duration*.15);
  osc.type=type;
  osc.frequency.setValueAtTime(Math.max(30,freq),t);
  if(opts.end)osc.frequency.exponentialRampToValueAtTime(Math.max(30,opts.end),t+duration);
  gain.gain.setValueAtTime(.0001,t);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0003,volume),t+attack);
  gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  osc.connect(gain);gain.connect(master);
  osc.start(t);osc.stop(t+duration+.015);
  osc.onended=()=>{osc.disconnect();gain.disconnect()};
 }
 function noise(duration,volume,cutoff=2500,opts={}){
  if(!ready())return;
  const t=context.currentTime+(opts.delay||0);
  const count=Math.max(1,Math.ceil(context.sampleRate*duration));
  const buffer=context.createBuffer(1,count,context.sampleRate),channel=buffer.getChannelData(0);
  // Synthetic, deterministic envelope shape; no recorded/external sound.
  for(let i=0;i<count;i++)channel[i]=(Math.random()*2-1);
  const src=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
  src.buffer=buffer;filter.type=opts.high?'highpass':'lowpass';
  filter.frequency.value=cutoff;
  gain.gain.setValueAtTime(.0001,t);
  gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),t+.006);
  gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
  src.connect(filter);filter.connect(gain);gain.connect(master);
  src.start(t);src.stop(t+duration+.005);
  src.onended=()=>{src.disconnect();filter.disconnect();gain.disconnect()};
 }
 function stopHum(){
  for(const entry of ambient){
   try{
    entry.gain.gain.cancelScheduledValues(context.currentTime);
    entry.gain.gain.setTargetAtTime(.0001,context.currentTime,.06);
    entry.osc.stop(context.currentTime+.25);
   }catch(e){}
  }
  ambient=[];
 }
 function hum(){
  if(!ready()||ambient.length)return;
  for(let i=0;i<2;i++){
   const osc=context.createOscillator(),gain=context.createGain(),filter=context.createBiquadFilter();
   osc.type='sawtooth';osc.frequency.value=80+i*8;
   filter.type='lowpass';filter.frequency.value=750;
   gain.gain.value=.0001;
   osc.connect(filter);filter.connect(gain);gain.connect(master);
   osc.start();ambient.push({osc,gain,filter});
  }
 }
 function update(tops,paused=false){
  if(!context||!enabled)return;
  if(paused||!tops?.length){stopHum();return}
  hum();
  ambient.forEach((a,i)=>{
   const top=tops[i];
   if(!top)return;
   const speed=Math.max(0,top.spin||0),energy=Math.min(1,speed/68);
   const moving=Math.hypot(top.vx||0,top.vy||0);
   const t=context.currentTime;
   a.osc.frequency.setTargetAtTime(52+speed*2.0+(i*3),t,.045);
   a.filter.frequency.setTargetAtTime(350+speed*9+moving*210,t,.06);
   a.gain.gain.setTargetAtTime(.004+energy*.018,t,.085);
  });
 }
 function play(event,power=1){
  if(!ready())return;
  const scale=Math.max(.3,Math.min(2,Number(power)||1));
  switch(event){
   case 'land':
    noise(.095,.045*scale,1400,{high:true});
    tone(215,.10,.065*scale,'triangle',{end:120});break;
   case 'launch':
    noise(.22,.07*scale,1300,{high:true});
    tone(145,.33,.15*scale,'sawtooth',{end:520});
    tone(68,.28,.09*scale,'triangle',{end:180});break;
   case 'hit':
    noise(.14,.18*scale,4800,{high:true});
    tone(240,.18,.19*scale,'square',{end:95});
    tone(550,.13,.075*scale,'triangle',{end:240});break;
   case 'dash':
    noise(.38,.11*scale,1300,{high:true});
    tone(180,.45,.11*scale,'sawtooth',{end:1050});
    tone(320,.30,.08*scale,'sine',{end:650});break;
   case 'burst':
    noise(.46,.18*scale,2100,{high:true});
    tone(410,.43,.21*scale,'square',{end:68});
    tone(125,.55,.14*scale,'triangle',{end:48});break;
   case 'over':
   case 'extreme':
    noise(.36,.10*scale,1500,{high:true});
    tone(event==='extreme'?420:330,.55,.14*scale,'sawtooth',{end:70});break;
   case 'spin':
    tone(180,.65,.11*scale,'sine',{end:57});
    noise(.25,.035*scale,530);break;
   case 'draw':
    tone(165,.30,.06*scale,'triangle',{end:105});break;
   case 'win':
    for(let i=0;i<3;i++)tone([392,493.88,587.33][i],.36,.11,'triangle',{delay:i*.125,end:[430,530,650][i]});
    break;
   default:break;
  }
 }
 return{
  unlock:()=>ready(),
  isSupported:()=>!!AC,
  isEnabled:()=>enabled,
  enable(value){enabled=!!value;if(enabled)ready();else stopHum();return enabled},
  volume(value){level=Math.max(0,Math.min(1,Number(value)||0));if(master)master.gain.setTargetAtTime(level,context.currentTime,.03)},
  play,update,stop:stopHum,
  close(){stopHum();context?.close?.();context=null;master=null}
 };
}
root.BBX_SIM_AUDIO={create};
})(typeof window!=='undefined'?window:this);
