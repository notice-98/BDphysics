import {rotateLocal} from './affine.js';
import {quaternionFromEuler,rotateVector} from './physics.js';

export const CONNECTION_SEGMENTS=8;
export function localAnchor(object,anchor){return rotateLocal(object,anchor).map((v,i)=>v*object.size[i]*(object.mirror?.[i]||1));}
export function connectionEndpoints(connection,objects,poses){
 const point=(id,anchor)=>{const o=objects.get(id),s=poses?.get(id)||{p:o.position,q:quaternionFromEuler(o.rotation)},offset=rotateVector(localAnchor(o,anchor),s.q);return s.p.map((v,i)=>v+offset[i]);};
 return [point(connection.a,connection.anchorA),connection.b?point(connection.b,connection.anchorB):connection.worldPoint.slice()];
}
export function validateConnections(project){
 const connections=project.connections||[];
 if(!Array.isArray(connections)||connections.length>128)throw new Error('줄·스프링 연결은 128개까지 지원합니다.');
 const objects=new Set(project.objects.map(o=>o.id)),ids=new Set(),number=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
 const vector=(v,a,b)=>Array.isArray(v)&&v.length===3&&v.every(n=>number(n,a,b));
 for(const c of connections){
  if(!/^c[1-9]\d{0,5}$/.test(c.id)||ids.has(c.id)||!objects.has(c.a)||c.b!=null&&(!objects.has(c.b)||c.b===c.a)||!['rope','spring','weld','hinge'].includes(c.kind))throw new Error('연결 대상 또는 ID가 잘못되었습니다.');
  if(c.clearance!=null&&!number(c.clearance,0,16))throw new Error('관절 충돌 여유가 잘못되었습니다.');
  if(c.ragdoll!=null&&typeof c.ragdoll!=='boolean'||c.limits!=null&&(!Array.isArray(c.limits)||c.limits.length!==2||c.limits.some(v=>!number(v,-Math.PI,Math.PI))||c.limits[0]>c.limits[1]))throw new Error('래그돌 관절 범위가 잘못되었습니다.');
  ids.add(c.id);if(c.kind==='hinge'&&(c.pinMode!=null&&!['hinge','ball'].includes(c.pinMode)||c.worldAxis!=null&&(!vector(c.worldAxis,-1,1)||Math.abs(Math.hypot(...c.worldAxis)-1)>.001)))throw new Error('축 고정의 회전 방식 또는 월드 축이 잘못되었습니다.');if(c.kind==='weld'&&(c.anchorMode!=null&&!['vertex','edge'].includes(c.anchorMode)||c.preservePose!=null&&typeof c.preservePose!=='boolean'||c.edgeSpan!=null&&!number(c.edgeSpan,.02,32)||c.axis!=null&&(!vector(c.axis,-1,1)||Math.abs(Math.hypot(...c.axis)-1)>.001)||c.axisB!=null&&(!vector(c.axisB,-1,1)||Math.abs(Math.hypot(...c.axisB)-1)>.001)))throw new Error('접합 방식 또는 회전축이 잘못되었습니다.');if(c.kind==='weld'&&!c.b||c.kind==='hinge'&&(c.b||!vector(c.axis,-1,1)||Math.abs(Math.hypot(...c.axis)-1)>.001))throw new Error('접합은 두 물체, 축 고정은 공간 고정점과 단위 축이 필요합니다.');if(c.block&&!/^minecraft:[a-z0-9_]+$/.test(c.block)||c.blockStates&&Object.entries(c.blockStates).some(([k,v])=>!/^\w+$/.test(k)||!/^\w+$/.test(String(v))))throw new Error('줄 표시 블록이 잘못되었습니다.');
  if(!vector(c.anchorA,-16,16)||!vector(c.anchorB,-16,16)||!vector(c.worldPoint,-4096,4096)||!number(c.length,.05,256)||!number(c.thickness,.01,.25)||!number(c.stiffness,.1,100000)||!number(c.damping,0,10000)||typeof c.visible!=='boolean'||c.compression!=null&&typeof c.compression!=='boolean')throw new Error('줄·스프링 속성이 지원 범위를 벗어났습니다.');
 }
}
// A distance constraint drives the bodies. These segments visualize its slack;
// they have no separate mass or collision geometry.
export function connectionTransforms(c,objects,poses){
 if(c.kind==='weld'||c.kind==='hinge')return [];
 const [a,b]=connectionEndpoints(c,objects,poses),delta=b.map((v,i)=>v-a[i]),distance=Math.hypot(...delta),n=CONNECTION_SEGMENTS;
 const build=sag=>Array.from({length:n+1},(_,j)=>{const t=j/n;return a.map((v,i)=>v+delta[i]*t-(i===1?4*sag*t*(1-t):0));});
 let points;
 if(c.kind==='rope'){
  let lo=0,hi=c.length/2;
  if(distance<c.length)for(let k=0;k<14;k++){const mid=(lo+hi)/2,p=build(mid),length=p.slice(1).reduce((s,v,i)=>s+Math.hypot(...v.map((x,j)=>x-p[i][j])),0);if(length<c.length)lo=mid;else hi=mid;}
  points=build(distance<c.length?(lo+hi)/2:0);
 }else{
  const unit=distance>1e-9?delta.map(v=>v/distance):[0,1,0],perp=Math.abs(unit[1])<.9?[unit[2],0,-unit[0]]:[1,0,0],len=Math.hypot(...perp),radius=Math.min(.12,Math.max(.025,c.thickness*2),distance/10);
  points=Array.from({length:n+1},(_,j)=>a.map((v,i)=>v+delta[i]*j/n+perp[i]/len*(j===0||j===n?0:j%2?radius:-radius)));
 }
 return points.slice(1).map((b,i)=>{const a=points[i],v=b.map((x,j)=>x-a[j]),len=Math.hypot(...v),u=len>1e-9?v.map(x=>x/len):[0,1,0];let q=u[1]<-.999999?[1,0,0,0]:[u[2],0,-u[0],1+u[1]],norm=Math.hypot(...q);q=q.map(x=>x/norm);return {id:c.id+'_'+i,p:a.map((x,j)=>(x+b[j])/2),q,size:[c.thickness,Math.max(.001,len),c.thickness]};});
}
export function connectionVisual(c,state){return {id:state.id,type:'block',block:c.block||(c.kind==='spring'?'minecraft:white_concrete':'minecraft:black_concrete'),blockStates:c.blockStates||{},size:state.size};}
