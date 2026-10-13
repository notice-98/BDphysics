import {easeProgress} from './easing.js';
export function slerp(a,b,t){let dot=a.reduce((v,x,i)=>v+x*b[i],0);if(dot<0){b=b.map(x=>-x);dot=-dot;}if(dot>.9995){const q=a.map((x,i)=>x+(b[i]-x)*t),length=Math.hypot(...q);return q.map(x=>x/length);}const angle=Math.acos(Math.min(1,dot)),s=Math.sin(angle);return a.map((x,i)=>(Math.sin((1-t)*angle)*x+Math.sin(t*angle)*b[i])/s);}
export function keySegment(object,time){
 const keys=[{time:0,position:object.position,rotation:object.rotation,size:object.size},...(object.keys||[])].sort((a,b)=>a.time-b.time);
 let a=keys[0],b=a;for(const key of keys){if(key.time<=time){a=key;b=a;}else{b=key;break;}}
 const progress=b.time<=a.time?0:Math.min(1,Math.max(0,(time-a.time)/(b.time-a.time)));
 return {a,b,progress,t:easeProgress(progress,b.easing)};
}
export function sampleKeys(object,time,toQuat){const {a,b,t}=keySegment(object,time);return {p:a.position.map((v,i)=>v+(b.position[i]-v)*t),q:slerp(toQuat(a.rotation),toQuat(b.rotation),t)};}
export function releaseVelocity(object,time,toQuat){const dt=Math.min(1/120,Math.max(time,1e-8)),a=sampleKeys(object,Math.max(0,time-dt),toQuat),b=sampleKeys(object,time,toQuat);const q=b.q,r=[-a.q[0],-a.q[1],-a.q[2],a.q[3]],d=[q[3]*r[0]+q[0]*r[3]+q[1]*r[2]-q[2]*r[1],q[3]*r[1]-q[0]*r[2]+q[1]*r[3]+q[2]*r[0],q[3]*r[2]+q[0]*r[1]-q[1]*r[0]+q[2]*r[3],q[3]*r[3]-q[0]*r[0]-q[1]*r[1]-q[2]*r[2]];if(d[3]<0)for(let i=0;i<4;i++)d[i]=-d[i];const angle=2*Math.atan2(Math.hypot(...d.slice(0,3)),Math.max(0,d[3])),len=Math.hypot(...d.slice(0,3));return {linear:b.p.map((v,i)=>(v-a.p[i])/dt),angular:d.slice(0,3).map(v=>len>1e-8?v/len*angle/dt:0)};}
