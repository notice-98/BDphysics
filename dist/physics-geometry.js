import * as THREE from './vendor/three.module.js';
import {shapeParts} from './shapes.js';
import {rotateLocal} from './affine.js';
const EPS=1e-7,identity=[0,0,0,1],near=(a,b)=>Math.abs(a-b)<EPS;
const bounds=p=>({min:p.c.map((v,i)=>v-p.s[i]/2),max:p.c.map((v,i)=>v+p.s[i]/2)});
const axisOf=v=>{const axis=v.findIndex(x=>Math.abs(x)>1-EPS);return axis>=0&&v.every((x,i)=>i===axis||Math.abs(x)<EPS)?axis:-1;};
const rotate=(v,q)=>new THREE.Vector3().fromArray(v).applyQuaternion(new THREE.Quaternion().fromArray(q)).toArray();
// Preserve the exact union, including holes. Only touching boxes with identical
// cross-sections are joined; rotated/sheared shapes retain their original hulls.
export function collisionParts(o){
 let parts=shapeParts(o).map(p=>{const axes=identity.slice(0,3).map((_,i)=>axisOf(rotate([0,1,2].map(j=>j===i?1:0),p.q)));if(axes.some(a=>a<0))return p;const s=[0,0,0];axes.forEach((a,i)=>s[a]=p.s[i]);return {c:p.c.slice(),s,q:identity};});
 for(let pass=0;pass<3;pass++){
  const before=parts.length;
  for(let axis=0;axis<3;axis++){
   const groups=new Map(),other=[0,1,2].filter(i=>i!==axis),rest=[];
   for(const p of parts){if(p.q.slice(0,3).some(v=>Math.abs(v)>EPS)){rest.push(p);continue;}const b=bounds(p),key=other.flatMap(i=>[b.min[i],b.max[i]]).map(v=>Math.round(v/EPS)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(b);}
   for(const boxes of groups.values()){
    boxes.sort((a,b)=>a.min[axis]-b.min[axis]);let current=null;
    const emit=()=>{if(current)rest.push({c:current.min.map((v,i)=>(v+current.max[i])/2),s:current.min.map((v,i)=>current.max[i]-v),q:identity});};
    for(const b of boxes){if(current&&near(current.max[axis],b.min[axis])&&other.every(i=>near(current.min[i],b.min[i])&&near(current.max[i],b.max[i])))current.max[axis]=b.max[axis];else{emit();current={min:b.min.slice(),max:b.max.slice()};}}emit();
   }
   parts=rest;
  }
  if(parts.length===before)break;
 }
 return parts;
}
// Test solid occupancy, rather than box ordering: vanilla voxel-shape partitions
// can be asymmetric even when the complete block is exactly mirror symmetric.
export function reflectionSymmetric(parts,axis){
 if(parts.some(p=>p.q.slice(0,3).some(v=>Math.abs(v)>EPS)))return false;
 const boxes=parts.map(bounds),other=[0,1,2].filter(i=>i!==axis),cuts=other.map(i=>[...new Set(boxes.flatMap(b=>[b.min[i],b.max[i]]).map(v=>Math.round(v/EPS)))].sort((a,b)=>a-b)),cells=new Map();
 if(cuts[0].length*cuts[1].length>4096)return false;
 for(const b of boxes){const range=other.map((a,i)=>[cuts[i].indexOf(Math.round(b.min[a]/EPS)),cuts[i].indexOf(Math.round(b.max[a]/EPS))]);for(let u=range[0][0];u<range[0][1];u++)for(let v=range[1][0];v<range[1][1];v++){const key=u*cuts[1].length+v;if(!cells.has(key))cells.set(key,[]);cells.get(key).push([b.min[axis],b.max[axis]]);}}
 for(const intervals of cells.values()){intervals.sort((a,b)=>a[0]-b[0]);const merged=[];for(const r of intervals){const last=merged.at(-1);if(last&&r[0]<=last[1]+EPS)last[1]=Math.max(last[1],r[1]);else merged.push(r.slice());}for(let i=0;i<merged.length;i++){const r=merged[i],s=merged[merged.length-1-i];if(!near(r[0],-s[1])||!near(r[1],-s[0]))return false;}}
 return true;
}
// A mirror-invariant scene has no physical motion perpendicular to that plane.
// Constrain only proven symmetries, so solver roundoff cannot invent a sideways
// impulse. Asymmetric models, off-centre hits, spins and tilted surfaces stay 3D.
export function symmetryAxes(project,partsById,quaternionFromEuler){
 if(!project.objects.length||(project.fields||[]).length||project.objects.some(o=>o.magnet&&o.magnet.polarity!=='off')||(project.connections||[]).some(c=>c.kind==='hinge'||c.ragdoll))return [];
 const localWorld=(o,p,q=quaternionFromEuler(o.rotation))=>rotate(rotateLocal(o,p).map((v,i)=>v*o.size[i]*(o.mirror?.[i]||1)),q);
 const qInverse=q=>[-q[0],-q[1],-q[2],q[3]],mul=(a,b)=>new THREE.Quaternion().fromArray(a).multiply(new THREE.Quaternion().fromArray(b)).toArray();
 return [0,1,2].filter(axis=>{
  if(axis===1&&(project.gravity!==0||(project.explosions||[]).some(e=>project.objects.some(o=>o.position.every((v,i)=>near(v,e.position[i]))))))return false;
  const plane=project.objects[0].position[axis],normal=[0,1,2].map(i=>i===axis?1:0);
  if(project.objects.some(o=>!near(o.position[axis],plane)||!near(o.velocity[axis],0)))return false;
  for(const o of project.objects){
   const q=quaternionFromEuler(o.rotation),localAxis=axisOf(rotate(normal,qInverse(q))),parts=partsById.get(o.id);if(localAxis<0||!reflectionSymmetric(parts,localAxis))return false;const volume=parts.reduce((s,p)=>s+p.s[0]*p.s[1]*p.s[2],0);if(volume&&Math.abs(parts.reduce((s,p)=>s+p.c[localAxis]*p.s[0]*p.s[1]*p.s[2],0)/volume)>EPS)return false;
   if(parts.some(p=>{const c=rotate(p.c.map((v,i)=>v*o.size[i]*(o.mirror?.[i]||1)),q),e=[0,1,2].reduce((s,i)=>s+Math.abs(rotate([0,1,2].map(j=>j===i?p.s[i]*o.size[i]/2:0),q)[axis]),0);return axis===1?o.position[1]+c[1]-e<=.01:Math.abs(plane+c[axis])+e>=4096-1e-5;}))return false;
   for(const key of o.keys||[]){if(!near(key.position[axis],plane))return false;const dq=mul(quaternionFromEuler(key.rotation),qInverse(q));if(dq.slice(0,3).some((v,i)=>i!==axis&&!near(v,0)))return false;}
  }
  for(const e of project.events){const o=project.objects.find(o=>o.id===e.target),offset=o?localWorld(o,e.point):e.point;if(!near(e.vector[axis],0)||!near(offset[axis],0)||e.kind==='throw'&&e.spin.some((v,i)=>i!==axis&&!near(v,0)))return false;}
  for(const e of project.explosions||[])if(!near(e.position[axis],plane))return false;
  for(const c of project.connections||[]){const a=project.objects.find(o=>o.id===c.a),b=project.objects.find(o=>o.id===c.b);if(!near(localWorld(a,c.anchorA)[axis],0)||(b?!near(localWorld(b,c.anchorB)[axis],0):!near(c.worldPoint[axis],plane)))return false;}
  return true;
 });
}
