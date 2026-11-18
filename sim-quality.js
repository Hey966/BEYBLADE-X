/* Display quality only. Does not change parts, scoring or physics. */
(function(root){
'use strict';
const profiles=Object.freeze({
 performance:Object.freeze({id:'performance',label:'省電',pixelRatio:.85,shadows:false,shadowSize:0,sparkBudget:10,sparkScale:.6,trailLimit:12,contactShadow:false,contactOpacity:0,spinBlur:false,metalness:.36,roughness:.48,clearcoat:0,guardOpacity:.12,toneMapping:false,exposure:1,hemisphere:2.9,keyIntensity:2.45,fillIntensity:0,rimIntensity:0}),
 balanced:Object.freeze({id:'balanced',label:'平衡',pixelRatio:1.35,shadows:true,shadowSize:512,sparkBudget:28,sparkScale:1,trailLimit:24,contactShadow:true,contactOpacity:.24,spinBlur:false,metalness:.69,roughness:.30,clearcoat:.25,guardOpacity:.17,toneMapping:true,exposure:1.12,hemisphere:2.45,keyIntensity:2.55,fillIntensity:.65,rimIntensity:.50}),
 ultra:Object.freeze({id:'ultra',label:'極致',pixelRatio:2,shadows:true,shadowSize:2048,sparkBudget:80,sparkScale:1.65,trailLimit:36,contactShadow:true,contactOpacity:.43,spinBlur:true,metalness:.89,roughness:.19,clearcoat:.78,guardOpacity:.25,toneMapping:true,exposure:1.20,hemisphere:2.15,keyIntensity:2.90,fillIntensity:1.20,rimIntensity:.95})
});
const normalize=name=>Object.prototype.hasOwnProperty.call(profiles,name)?name:'ultra';
const profile=name=>profiles[normalize(name)];
function resolutionScale(name,dpr){
 const ratio=Number(dpr);
 return Math.min(profile(name).pixelRatio,Number.isFinite(ratio)&&ratio>0?ratio:1);
}
root.BBX_SIM_QUALITY=Object.freeze({profiles,normalize,profile,resolutionScale,defaultMode:'ultra'});
})(typeof window!=='undefined'?window:this);
