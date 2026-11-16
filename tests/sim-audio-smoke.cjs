/* Test WebAudio effect orchestration without external assets. Node 22. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const code=fs.readFileSync(path.join(__dirname,'..','sim-audio.js'),'utf8');
let starts=0,stops=0,created=0,volumes=[];
class Param{
 setValueAtTime(v){this.value=v;return this}
 exponentialRampToValueAtTime(v){this.value=v;return this}
 setTargetAtTime(v){this.value=v;return this}
 cancelScheduledValues(){return this}
}
class Node{
 constructor(){created++;this.gain=new Param();this.frequency=new Param();this.onended=null}
 connect(){return this}
 disconnect(){}
 start(){starts++}
 stop(){stops++}
}
class Ctx{
 constructor(){this.currentTime=0;this.sampleRate=24000;this.state='running';this.destination=new Node()}
 createGain(){return new Node()}
 createOscillator(){return new Node()}
 createBiquadFilter(){return new Node()}
 createBufferSource(){return new Node()}
 createBuffer(channels,length){return{getChannelData:()=>new Float32Array(length)}}
 resume(){return Promise.resolve()}
 close(){return Promise.resolve()}
}
const browser={AudioContext:Ctx};
vm.runInNewContext(code,{window:browser,console});
const audio=browser.BBX_SIM_AUDIO.create();
assert.equal(audio.isSupported(),true);
assert.equal(audio.isEnabled(),true);
assert.equal(audio.unlock(),true);
for(const name of ['launch','hit','dash','spin','burst','over','extreme','draw','win'])
 audio.play(name,.8);
assert(starts>=20,'all sound events should create original signal generators');
audio.update([{spin:55,vx:.5,vy:.2},{spin:42,vx:.2,vy:.2}],false);
assert(starts>=22,'spinning creates two live motors');
audio.update([],true);
assert(stops>=2,'pause silences the spinning sound');
const before=starts;
audio.enable(false);
audio.play('hit');
assert.equal(starts,before,'muting prevents new sound');
audio.enable(true);audio.volume(.2);audio.play('hit');
assert(starts>before,'unmuting permits sound');
audio.stop();
console.log(JSON.stringify({passed:true,synthesisStarts:starts,stops,nodesCreated:created,muteWorks:true},null,2));
