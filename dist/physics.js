import {socketConnections,insideJointSocket} from './ragdoll-contacts.js';
import {validateSpeeds} from './time-remap.js';
import {jointAnchorPairs,createConnectivity} from './articulated-joints.js';
import {scheduleHorizon,QUIET_SECONDS,ongoingMotion} from './recording-control.js';
import {validateFields,fieldPose,fieldForce,magneticForce,magneticPairs} from './fields.js';
import {entityMetadata} from './entity-nbt.js';
import {rotateLocal} from './affine.js';
import RAPIER from './vendor/rapier.mjs';
import {groupChildren,groupMembers,groupAncestors,validateGroups} from './structure.js';
import {collisionParts,symmetryAxes} from './physics-geometry.js';
import {sampleKeys,releaseVelocity} from './keyframes.js';
import {validEasing} from './easing.js';
import {validateConnections,localAnchor} from './connections.js';
import {validateExplosions,explosionImpulse} from './explosions.js';

export const MATERIALS={
 stone:{name:'돌',block:'minecraft:stone',density:25,friction:0.75,restitution:0.08,color:'#a2a59e'},
 wood:{name:'나무',block:'minecraft:oak_planks',density:7,friction:0.55,restitution:0.18,color:'#b68c59'},
 iron:{name:'철',block:'minecraft:iron_block',density:78,friction:0.4,restitution:0.12,color:'#c4ced0'},
 rubber:{name:'고무',block:'minecraft:slime_block',density:11,friction:0.85,restitution:0.82,color:'#9bb56e'},
 ice:{name:'얼음',block:'minecraft:blue_ice',density:9,friction:0.025,restitution:0.1,color:'#80b5d4'}
};
// Artist-friendly relative densities; one length unit is one Minecraft block.
export const clone=value=>JSON.parse(JSON.stringify(value));
export const volume=o=>o.size.reduce((a,b)=>a*b,1);
export function object(id,material='stone',position=[0,2,0],extra={}){
 const m=MATERIALS[material];
 return {id,name:`${m.name} ${id.slice(1)}`,material,block:m.block,position,rotation:[0,0,0],size:[1,1,1],mass:m.density,friction:m.friction,restitution:m.restitution,fixed:false,velocity:[0,0,0],group:null,...extra};
}
export function preset(name='wall'){
 let objects=[],events=[],groups=[];
 if(name==='wall'){
  for(let y=0;y<3;y++)for(let x=0;x<4;x++)objects.push(object(`b${objects.length+1}`,'stone',[(x-1.5)*1.025,0.505+y*1.015,0]));
  events=[{id:'f1',target:'b6',kind:'impulse',time:0.8,duration:0,vector:[0,8,55],point:[0,0.25,0]}];
 }else if(name==='fracture'){
  groups.push({id:'g1',name:'전체 벽 구조',parent:null,threshold:70,releaseTime:null});
  for(let cy=0;cy<2;cy++)for(let cx=0;cx<2;cx++){
   const mid='g'+(2+cy*2+cx);groups.push({id:mid,name:`덩어리 ${cy*2+cx+1}`,parent:'g1',threshold:35,releaseTime:1.8+(cy*2+cx)*0.15});
   for(let row=0;row<2;row++){
    const leaf='g'+(6+(cy*2+cx)*2+row);groups.push({id:leaf,name:`작은 조각 ${cy*2+cx+1}-${row+1}`,parent:mid,threshold:16,releaseTime:2.8+row*0.25});
    for(let col=0;col<2;col++)objects.push(object(`b${objects.length+1}`,'stone',[(cx*2+col-1.5)*1.02,0.51+(cy*2+row)*1.02,0],{group:leaf}));
   }
  }
  events=[{id:'f1',target:'b7',kind:'impulse',time:0.8,duration:0,vector:[0,60,450],point:[0,0.3,0]}];
 }else if(name==='throw'){
  objects=[object('b1','rubber',[0,0.55,-3])];events=[{id:'f1',target:'b1',kind:'throw',time:0.4,duration:0,vector:[0,7,8],point:[0,0,0],spin:[80,0,180]}];
 }else if(name==='drop'){
  objects=[object('b1','stone',[-2,4,0]),object('b2','wood',[0,4,0]),object('b3','rubber',[2,4,0])];
 }else if(name==='domino'){
  for(let i=0;i<10;i++)objects.push(object(`b${i+1}`,'wood',[(i-4.5)*0.9,1,0],{size:[0.25,2,1],mass:3.5}));
  events=[{id:'f1',target:'b1',kind:'impulse',time:0.5,duration:0,vector:[4,0,0],point:[0,0.8,0]}];
 }else if(name==='slide'){
  objects=[object('b1','ice',[-1.6,0.55,0]),object('b2','wood',[-1.6,0.55,2])];
  events=objects.map((o,i)=>({id:`f${i+1}`,target:o.id,kind:'impulse',time:0.4,duration:0,vector:[o.mass*5,0,0],point:[0,0,0]}));
 }
 return {schema:'voxel-dynamics/1',name:({wall:'충격으로 무너지는 벽',fracture:'계층 구조 붕괴',throw:'던지기와 탄성',drop:'재질별 낙하 실험',domino:'도미노 연쇄 반응',slide:'마찰 비교 실험',empty:'New Project'})[name]||'새 물리 장면',duration:8,gravity:9.81,floorFriction:0.65,objects,events,groups};
}
export function quaternionFromEuler(degrees){
 const [x,y,z]=degrees.map(v=>v*Math.PI/360),c1=Math.cos(x),c2=Math.cos(y),c3=Math.cos(z),s1=Math.sin(x),s2=Math.sin(y),s3=Math.sin(z);
 return [s1*c2*c3+c1*s2*s3,c1*s2*c3-s1*c2*s3,c1*c2*s3+s1*s2*c3,c1*c2*c3-s1*s2*s3];
}
export function rotateVector(v,q){
 const [x,y,z,w]=q,[vx,vy,vz]=v,tx=2*(y*vz-z*vy),ty=2*(z*vx-x*vz),tz=2*(x*vy-y*vx);
 return [vx+w*tx+y*tz-z*ty,vy+w*ty+z*tx-x*tz,vz+w*tz+x*ty-y*tx];
}
const v3=v=>({x:v[0],y:v[1],z:v[2]});
const finiteNumber=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateProject(p){
 if(!p||p.schema!=='voxel-dynamics/1'||!Array.isArray(p.objects)||!Array.isArray(p.events))throw new Error('BDphysics 프로젝트 파일을 선택해 주세요.');
 if(p.objects.length>8192||p.events.length>128)throw new Error('물체 8,192개, 힘 이벤트 128개까지 지원합니다.');
 if(!finiteNumber(p.duration,0.5,Number.MAX_SAFE_INTEGER/120)||!finiteNumber(p.gravity,0,50)||!finiteNumber(p.floorFriction,0,2))throw new Error('장면의 시간 또는 중력 값이 범위를 벗어났습니다.');
 if(p.autoStop!=null&&typeof p.autoStop!=='boolean')throw new Error('자동 종료 설정이 잘못되었습니다.');
 const ids=new Set();
 const array=(a,n,min,max)=>Array.isArray(a)&&a.length===n&&a.every(v=>finiteNumber(v,min,max));
 for(const o of p.objects){
  if(!/^b[1-9]\d{0,5}$/.test(o.id)||ids.has(o.id))throw new Error('물체 ID가 잘못되었거나 중복되었습니다.');ids.add(o.id);
  if(typeof o.name!=='string'||o.name.length>80||!MATERIALS[o.material]||!/^minecraft:[a-z0-9_]+$/.test(o.block)||typeof o.fixed!=='boolean')throw new Error('지원하지 않는 물체 또는 재질입니다.');
  if(o.mirror&&(!Array.isArray(o.mirror)||o.mirror.length!==3||o.mirror.some(v=>v!==1&&v!==-1)))throw new Error('대칭 값이 잘못되었습니다.');
  if(!array(o.position,3,-4096,4096)||!array(o.rotation,3,-3600,3600)||!array(o.size,3,0.000001,16)||!array(o.velocity,3,-100,100)||!finiteNumber(o.mass,0.01,1e6)||!finiteNumber(o.friction,0,2)||!finiteNumber(o.restitution,0,1))throw new Error('물체 속성이 지원 범위를 벗어났습니다.');
  if(o.headSkin!=null&&(typeof o.headSkin!=='string'||o.headSkin.length>1048576||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(o.headSkin)))throw new Error('잘못된 PNG 머리 텍스처입니다.');if(o.headNeedsBake!=null&&typeof o.headNeedsBake!=='boolean')throw new Error('머리 베이크 설정이 잘못되었습니다.');
  if(o.headTexture!=null&&(typeof o.headTexture!=='string'||o.headTexture.length>4096||!/^[A-Za-z0-9+/=]+$/.test(o.headTexture)))throw new Error('잘못된 머리 텍스처입니다.');
  if(o.rightRotation&&(!array(o.rightRotation,4,-1,1)||Math.abs(Math.hypot(...o.rightRotation)-1)>.001))throw new Error('잘못된 오른쪽 회전입니다.');
  entityMetadata(o);
  if(o.itemDisplay!=null&&!['none','thirdperson_lefthand','thirdperson_righthand','firstperson_lefthand','firstperson_righthand','head','gui','ground','fixed'].includes(o.itemDisplay))throw new Error('잘못된 아이템 표시 방식입니다.');
  if(o.type!=null&&!['block','item'].includes(o.type))throw new Error('디스플레이 종류가 잘못되었습니다.');
  if(o.virtualTexture!=null&&typeof o.virtualTexture!=='boolean')throw new Error('가상 블록 텍스처 설정이 잘못되었습니다.');
  if(o.virtual!=null&&typeof o.virtual!=='boolean')throw new Error('가상 블록 값이 잘못되었습니다.');
  if(o.magnet){const m=o.magnet;if(!['off','metal','north','south'].includes(m.polarity)||!finiteNumber(m.strength,0,10000)||!finiteNumber(m.range,.1,64))throw new Error('자성 값이 잘못되었습니다.');}
  for(const field of ['colliderParts','visualParts','customColliders'])if(o[field]){if(!Array.isArray(o[field])||o[field].length>2048)throw new Error('충돌체가 너무 복잡합니다.');for(const part of o[field])if(!array(part.c,3,-8,8)||!array(part.s,3,field==='visualParts'?0:0.0001,16)||!array(part.q,4,-1,1)||Math.abs(Math.hypot(...part.q)-1)>.001)throw new Error('충돌 형상이 잘못되었습니다.');}
  if(o.blockStates&&Object.entries(o.blockStates).some(([k,v])=>!/^\w+$/.test(k)||!/^\w+$/.test(String(v))))throw new Error('블록 상태 속성이 잘못되었습니다.');
  if(o.keys){if(!Array.isArray(o.keys)||o.keys.length>64)throw new Error('물체별 키프레임은 64개까지 지원합니다.');const times=new Set();for(const key of o.keys){if(!validEasing(key.easing)||!finiteNumber(key.time,0,p.duration)||times.has(key.time)||!array(key.position,3,-4096,4096)||!array(key.rotation,3,-3600,3600))throw new Error('키프레임이 잘못되었거나 시간이 중복됩니다.');times.add(key.time);}}
  if(o.releaseTime!=null&&!finiteNumber(o.releaseTime,0,p.duration))throw new Error('물리 전환 시점이 잘못되었습니다.');
 }
 validateGroups(p);const groupIds=new Set((p.groups||[]).filter(g=>groupMembers(p,g.id).length).map(g=>g.id));
 const eids=new Set();
 for(const e of p.events){
  if(!/^f[1-9]\d{0,5}$/.test(e.id)||eids.has(e.id)||(!ids.has(e.target)&&!groupIds.has(e.target))||!['impulse','force','throw'].includes(e.kind))throw new Error('힘 이벤트 대상 또는 ID가 잘못되었습니다.');eids.add(e.id);if(e.continuous!=null&&typeof e.continuous!=='boolean')throw new Error('지속 힘 설정이 잘못되었습니다.');
  if(!finiteNumber(e.time,0,p.duration)||!finiteNumber(e.duration,0,Number.MAX_SAFE_INTEGER/120)||!array(e.vector,3,-100000,100000)||!array(e.point,3,-16,16))throw new Error('힘 이벤트 값이 지원 범위를 벗어났습니다.');
  if(e.kind==='throw'&&!array(e.spin,3,-3600,3600))throw new Error('던지기 회전 속도가 잘못되었습니다.');
 }
 validateGroups(p);validateConnections(p);validateExplosions(p);validateFields(p);validateSpeeds(p);return p;
}
let initialized;
export function initPhysics(){return initialized||=(RAPIER.init({}).then(()=>RAPIER));}
export async function simulate(project,onProgress=()=>{},yieldFrame=()=>Promise.resolve(),options={}){
 validateProject(project);
 const auto=options.autoStop??project.autoStop===true,horizon=scheduleHorizon(project),memoryBytes=options.memoryBytes??256*1024*1024;let ticks=Math.round(project.duration*20),quiet=0,stopReason=auto?'rest':'duration';
 if(project.objects.every(o=>(o.fixed||o.virtual)&&!o.keys?.length)&&(project.groups||[]).every(g=>g.releaseTime==null)){const poses=project.objects.map(o=>({id:o.id,p:o.position.slice(),q:quaternionFromEuler(o.rotation)}));if(auto)ticks=Math.max(10,Math.ceil((horizon+QUIET_SECONDS)*20));const maxTicks=Math.floor(memoryBytes/8)-1;if(ticks>maxTicks){ticks=maxTicks;stopReason='memory';}onProgress(1,{time:ticks/20,stopReason});return {fps:20,ticks,duration:ticks/20,stopReason,auto,frames:Array.from({length:ticks+1},()=>poses),objects:clone(project.objects),connections:clone(project.connections||[]),fractures:(project.groups||[]).filter(g=>g.threshold===0).map(g=>({group:g.id,name:g.name,time:0,cause:'unbound'}))};}
 await initPhysics();
 const world=new RAPIER.World({x:0,y:-project.gravity,z:0});world.timestep=1/120;world.numSolverIterations=8;world.numInternalPgsIterations=4;world.maxCcdSubsteps=4;
 const bodies=new Map(),movingBodies=[],fractureBodies=[],tensionSprings=[],fired=new Set(),frames=[],fractures=[];
 const queue=new RAPIER.EventQueue(true),colliderObjects=new Map(),colliderParts=new Map(),jointsByGroup=new Map(),broken=new Set();
 const objectById=new Map(project.objects.map(o=>[o.id,o])),groupById=new Map((project.groups||[]).map(g=>[g.id,g])),membersByGroup=new Map((project.groups||[]).map(g=>[g.id,groupMembers(project,g.id)])),keyObjects=project.objects.filter(o=>o.keys?.length),scheduledGroups=(project.groups||[]).filter(g=>g.releaseTime!=null),magneticObjects=project.objects.filter(o=>o.magnet&&o.magnet.polarity!=='off');
 const partsById=new Map(project.objects.map(o=>[o.id,collisionParts(o)])),planes=symmetryAxes(project,partsById,quaternionFromEuler);
 const ancestors=new Map(project.objects.map(o=>[o.id,groupAncestors(project,o).map(g=>g.id)]));
 const jointConnectivity=createConnectivity(project.objects.map(o=>o.id)),groupPairs=new Map();let rigidConnectivity=createConnectivity(project.objects.map(o=>o.id));for(const c of project.connections||[])if(c.kind==='weld'&&c.b)jointConnectivity.join(c.a,c.b);
 const rebuildRigidConnectivity=()=>{rigidConnectivity=createConnectivity(project.objects.map(o=>o.id));for(const [id,pairs]of groupPairs)if(!broken.has(id))for(const [a,b]of pairs)rigidConnectivity.join(a,b);};
 const sameAssembly=(a,b)=>a&&b&&rigidConnectivity.find(a.id)===rigidConnectivity.find(b.id);
 const sockets=socketConnections(project),socketPoses=new Map(),bodyPose=id=>socketPoses.get(id),socketObjects=project.objects.filter(o=>o.ragdoll);
 const refreshSocketPoses=()=>{for(const o of socketObjects){const body=bodies.get(o.id),p=body.translation(),q=body.rotation();socketPoses.set(o.id,{p:[p.x,p.y,p.z],q:[q.x,q.y,q.z,q.w]});}};
 const hooks={filterContactPair:(h1,h2)=>{const a=colliderObjects.get(h1),b=colliderObjects.get(h2);if(sameAssembly(a,b))return null;if(a?.ragdoll&&b?.ragdoll){const c=sockets.get([a.group,b.group].sort().join('|'));if(c&&insideJointSocket(a,b,bodyPose(a.id),bodyPose(b.id),colliderParts.get(h1),colliderParts.get(h2),c,bodyPose(c.a),objectById.get(c.a)))return null;}return RAPIER.SolverFlags.COMPUTE_IMPULSE;},filterIntersectionPair:()=>true};
 try{
  // Large static floor is a collider only, never a placed Minecraft block.
  world.createCollider(RAPIER.ColliderDesc.cuboid(4096,0.5,4096).setTranslation(0,-0.5,0).setFriction(project.floorFriction).setRestitution(0));
  for(const o of project.objects){
   const q=quaternionFromEuler(o.rotation);
   const hasKeys=!o.virtual&&o.keys?.length>0;
   const initial=hasKeys?sampleKeys(o,0,quaternionFromEuler):{p:o.position,q};
   const desc=(hasKeys?RAPIER.RigidBodyDesc.kinematicPositionBased():(o.fixed||o.virtual)?RAPIER.RigidBodyDesc.fixed():RAPIER.RigidBodyDesc.dynamic()).setTranslation(...initial.p).setRotation({x:initial.q[0],y:initial.q[1],z:initial.q[2],w:initial.q[3]}).setLinvel(...o.velocity).setCcdEnabled(true).setLinearDamping(o.ragdoll?.15:.015).setAngularDamping(o.ragdoll?.4:.04);
   const body=world.createRigidBody(desc);
   if(!body.isFixed()&&planes.length){body.setEnabledTranslations(...[0,1,2].map(i=>!planes.includes(i)),true);body.setEnabledRotations(...[0,1,2].map(i=>planes.every(axis=>axis===i)),true);}
   const parts=partsById.get(o.id),totalVolume=parts.reduce((sum,p)=>sum+p.s.reduce((v,s)=>v*s,1),0)||1;
   for(const part of parts){
    let collider;
    if(part.q.slice(0,3).every(v=>Math.abs(v)<1e-8))collider=RAPIER.ColliderDesc.cuboid(...part.s.map((s,i)=>s*o.size[i]/2)).setTranslation(...part.c.map((v,i)=>v*o.size[i]*(o.mirror?.[i]||1)));
    else{const vertices=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const v=rotateVector([x*part.s[0]/2,y*part.s[1]/2,z*part.s[2]/2],part.q);vertices.push(...v.map((p,i)=>(p+part.c[i])*o.size[i]*(o.mirror?.[i]||1)));}collider=RAPIER.ColliderDesc.convexHull(new Float32Array(vertices));}
    if(!collider)throw new Error('충돌체를 생성할 수 없습니다.');
    const partMass=o.mass*part.s.reduce((v,s)=>v*s,1)/totalVolume;
    const c=world.createCollider(collider.setMass(partMass).setFriction(o.friction).setRestitution(o.restitution).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max).setActiveHooks(ancestors.get(o.id).length?RAPIER.ActiveHooks.FILTER_CONTACT_PAIRS:RAPIER.ActiveHooks.NONE).setActiveEvents(ancestors.get(o.id).length?RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS:RAPIER.ActiveEvents.NONE).setContactForceEventThreshold(0),body);colliderObjects.set(c.handle,o);colliderParts.set(c.handle,part);
   }
   if(!parts.length)body.setAdditionalMass(o.mass,true);
   bodies.set(o.id,body);if(!body.isFixed()){movingBodies.push(body);if(ancestors.get(o.id).length)fractureBodies.push([o.id,body]);}
  }
  for(const c of project.connections||[]){
   const a=bodies.get(c.a),oa=objectById.get(c.a),b=c.b?bodies.get(c.b):world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(...c.worldPoint).setRotation(c.kind==='hinge'?a.rotation():{x:0,y:0,z:0,w:1})),ob=objectById.get(c.b);
   if(a.isFixed()&&b.isFixed())continue;
   if(c.kind==='weld'){const qa=a.rotation(),qb=b.rotation(),pa=a.translation(),pb=b.translation(),pairs=jointAnchorPairs(c,oa,ob,{p:[pa.x,pa.y,pa.z],q:[qa.x,qa.y,qa.z,qa.w]},{p:[pb.x,pb.y,pb.z],q:[qb.x,qb.y,qb.z,qb.w]});if(c.ragdoll&&c.limits&&c.axis&&c.axisB&&c.axis.every((v,i)=>Math.abs(v-c.axisB[i])<1e-5)){const joint=world.createImpulseJoint(RAPIER.JointData.revolute(v3(localAnchor(oa,c.anchorA)),v3(localAnchor(ob,c.anchorB)),v3(c.axis)),a,b,true);joint.setContactsEnabled(true);joint.setLimits(...c.limits);}else for(const anchors of pairs)world.createImpulseJoint(RAPIER.JointData.spherical(v3(anchors.a),v3(anchors.b)),a,b,true).setContactsEnabled(true);continue;}
   if(c.kind==='hinge'){const aa=localAnchor(oa,c.anchorA),q=a.rotation(),axis=c.worldAxis||rotateVector(c.axis||[0,0,1],[q.x,q.y,q.z,q.w]),axisA=rotateVector(axis,[-q.x,-q.y,-q.z,q.w]),span=c.edgeSpan??.5;for(const sign of c.pinMode==='ball'?[0]:[-.5,.5]){const an=aa.map((v,i)=>v+axisA[i]*span*sign),bn=axisA.map(v=>v*span*sign);world.createImpulseJoint(RAPIER.JointData.spherical(v3(an),v3(bn)),a,b,true).setContactsEnabled(false);}continue;}
   if(c.kind==='spring'&&!c.compression){tensionSprings.push({c,a,b,oa,ob});continue;}
   const anchorA=v3(localAnchor(oa,c.anchorA)),anchorB=v3(ob?localAnchor(ob,c.anchorB):[0,0,0]);
   const data=c.kind==='spring'?RAPIER.JointData.spring(c.length,c.stiffness,c.damping,anchorA,anchorB):RAPIER.JointData.rope(c.length,anchorA,anchorB);
   world.createImpulseJoint(data,a,b,true).setContactsEnabled(true);
  }
  for(const g of project.groups||[]){
   // Zero keeps the editor hierarchy without creating an automatic rigid weld.
   // Explicit hinges, ropes and other connections keep their own constraints.
   if(g.threshold===0){broken.add(g.id);fractures.push({group:g.id,name:g.name,time:0,cause:'unbound'});continue;}
   if(g.articulated)continue;
   if(membersByGroup.get(g.id).every(id=>bodies.get(id).isFixed()))continue;
   const clusters=[...groupChildren(project,g.id).map(c=>membersByGroup.get(c.id)),...project.objects.filter(o=>o.group===g.id).map(o=>[o.id])].filter(c=>c.length);
   const joints=[],pairs=[];
   for(let i=1;i<clusters.length;i++){
    let best=null,bestDist=Infinity;
    for(const ai of clusters.slice(0,i).flat())for(const bi of clusters[i]){
     if(jointConnectivity.find(ai)===jointConnectivity.find(bi))continue;const a=bodies.get(ai),b=bodies.get(bi),pa=a.translation(),pb=b.translation(),dist=(pa.x-pb.x)**2+(pa.y-pb.y)**2+(pa.z-pb.z)**2;
     if(dist<bestDist){bestDist=dist;best=[a,b,pa,pb,ai,bi];}
    }
    if(!best)continue;const [a,b,pa,pb,ai,bi]=best;if(a.isFixed()&&b.isFixed())continue;
    const ra=a.rotation(),rb=b.rotation(),qa=[-ra.x,-ra.y,-ra.z,ra.w],qb=[-rb.x,-rb.y,-rb.z,rb.w];
    const mid=[(pa.x+pb.x)/2,(pa.y+pb.y)/2,(pa.z+pb.z)/2];
    const an=rotateVector(mid.map((v,k)=>v-[pa.x,pa.y,pa.z][k]),qa),bn=rotateVector(mid.map((v,k)=>v-[pb.x,pb.y,pb.z][k]),qb);
    const joint=world.createImpulseJoint(RAPIER.JointData.fixed(v3(an),{...v3(qa),w:qa[3]},v3(bn),{...v3(qb),w:qb[3]}),a,b,true);
    joint.setContactsEnabled(false);joints.push(joint);pairs.push([ai,bi]);jointConnectivity.join(ai,bi);
   }
   jointsByGroup.set(g.id,joints);groupPairs.set(g.id,pairs);
  }
  rebuildRigidConnectivity();
  const breakGroup=(g,time,cause)=>{if(broken.has(g.id))return;for(const j of jointsByGroup.get(g.id)||[])if(j.isValid())world.removeImpulseJoint(j,true);broken.add(g.id);rebuildRigidConnectivity();fractures.push({group:g.id,name:g.name,time:Math.round(time*20)/20,cause});};
  const impact=(o,strength,time)=>{const group=ancestors.get(o.id).map(id=>groupById.get(id)).find(g=>!broken.has(g.id));if(group&&strength>=group.threshold)breakGroup(group,time,'impact');};
  const staticPoses=new Map();const capture=()=>project.objects.map(o=>{const b=bodies.get(o.id);if(b.isFixed()&&staticPoses.has(o.id))return staticPoses.get(o.id);const p=b.translation(),r=b.rotation(),pose={id:o.id,p:[p.x,p.y,p.z],q:[r.x,r.y,r.z,r.w]};if(b.isFixed())staticPoses.set(o.id,pose);return pose;});
  frames.push(capture());
  for(let step=0;auto||step<ticks*6;step++){
   const time=step/120;
   for(const g of scheduledGroups)if(time+1e-8>=g.releaseTime)breakGroup(g,time,'scheduled');
   const previousSpeeds=new Map(fractureBodies.map(([id,b])=>{const v=b.linvel();return [id,Math.hypot(v.x,v.y,v.z)];}));
   for(const o of keyObjects){
    const b=bodies.get(o.id);
    if(o.releaseTime!=null&&time+1e-8>=o.releaseTime&&b.isKinematic()){
     const velocity=releaseVelocity(o,o.releaseTime,quaternionFromEuler);b.setBodyType(RAPIER.RigidBodyType.Dynamic,true);b.setLinvel(v3(velocity.linear),true);b.setAngvel(v3(velocity.angular),true);
    }else if(b.isKinematic()){
     const next=sampleKeys(o,Math.min(time+1/120,o.releaseTime??Infinity),quaternionFromEuler);b.setNextKinematicTranslation(v3(next.p));b.setNextKinematicRotation({...v3(next.q),w:next.q[3]});
    }
   }
   for(const b of movingBodies){b.resetForces(false);b.resetTorques(false);}
   const environmental=new Map(),addEnvironmental=(o,b,f)=>{if(!b.isDynamic())return;if(!environmental.has(o.id))environmental.set(o.id,{o,b,f:[0,0,0]});const sum=environmental.get(o.id).f;for(let i=0;i<3;i++)sum[i]+=f[i];};
   for(const f of project.fields||[]){if(time+1e-8<f.time||!f.continuous&&time>=f.time+f.duration)continue;const pose=fieldPose(f,time,quaternionFromEuler),nextPose=fieldPose(f,time+1/120,quaternionFromEuler),targetVelocity=nextPose.p.map((v,i)=>(v-pose.p[i])*120);for(const o of project.objects){const b=bodies.get(o.id);if(!b.isDynamic())continue;const p=b.worldCom(),v=b.linvel();addEnvironmental(o,b,fieldForce(f,pose,[p.x,p.y,p.z],[v.x,v.y,v.z],o.mass,project.gravity,targetVelocity));}}
   const magnets=magneticObjects.map(o=>{const b=bodies.get(o.id),p=b.worldCom();return {o,b,p:[p.x,p.y,p.z]};});
   for(const [a,b]of magneticPairs(magnets)){if(sameAssembly(a.o,b.o))continue;const f=magneticForce(a.o,b.o,a.p,b.p);addEnvironmental(a.o,a.b,f);addEnvironmental(b.o,b.b,f.map(v=>-v));}
   for(const {o,b,f}of environmental.values()){const n=Math.hypot(...f),scale=Math.min(1,o.mass*200/Math.max(n,1e-8));b.addForce(v3(f.map(v=>v*scale)),true);}
   for(const spring of tensionSprings){
    const {c,a,b,oa,ob}=spring;
    const point=(body,o,anchor)=>{const p=body.translation(),q=body.rotation(),offset=o?rotateVector(localAnchor(o,anchor),[q.x,q.y,q.z,q.w]):[0,0,0];return [p.x+offset[0],p.y+offset[1],p.z+offset[2]];};
    const pa=point(a,oa,c.anchorA),pb=point(b,ob,c.anchorB),delta=pb.map((v,i)=>v-pa[i]),distance=Math.hypot(...delta),va=a.velocityAtPoint(v3(pa)),vb=b.velocityAtPoint(v3(pb)),direction=distance?delta.map(v=>v/distance):[0,0,0],speed=direction.reduce((s,v,i)=>s+v*([vb.x-va.x,vb.y-va.y,vb.z-va.z][i]),0),relativeGravity=direction[1]*project.gravity*((a.isDynamic()?1:0)-(b.isDynamic()?1:0)),pull=c.stiffness*(distance-c.length)+(c.damping+world.timestep*c.stiffness)*(speed+world.timestep*relativeGravity);
    // Let the constraint solver integrate translation AND rotation implicitly.
    // Slack tension-only springs have no constraint and cannot push the body.
    if(distance<=c.length+1e-8||pull<=0){if(spring.joint){world.removeImpulseJoint(spring.joint,true);spring.joint=null;}continue;}
    if(!spring.joint){const data=RAPIER.JointData.spring(c.length,c.stiffness,c.damping,v3(localAnchor(oa,c.anchorA)),v3(ob?localAnchor(ob,c.anchorB):[0,0,0]));spring.joint=world.createImpulseJoint(data,a,b,true);spring.joint.setContactsEnabled(true);}
   }
   for(const e of project.explosions||[]){
    if(fired.has(e.id)||time+1e-8<e.time)continue;
    fired.add(e.id);
    for(const o of project.objects){const b=bodies.get(o.id);if(!b.isDynamic())continue;const center=b.worldCom(),impulse=explosionImpulse(e,[center.x,center.y,center.z]),strength=Math.hypot(...impulse);if(!strength)continue;b.applyImpulse(v3(impulse),true);impact(o,strength,time);}
   }
   for(const e of project.events){
    if(time+1e-8<e.time||e.kind!=='force'&&fired.has(e.id)||e.kind==='force'&&!e.continuous&&time>=e.time+e.duration)continue;
    const isGroup=!bodies.has(e.target),memberIds=isGroup?membersByGroup.get(e.target):[e.target],members=memberIds.map(id=>({o:objectById.get(id),b:bodies.get(id)})).filter(({b})=>b&&!b.isFixed());if(!members.length)continue;
    const mass=members.reduce((sum,{o})=>sum+o.mass,0),center=[0,0,0];for(const {o,b}of members){const p=b.worldCom();for(const [i,k]of ['x','y','z'].entries())center[i]+=p[k]*o.mass/mass;}
    const groupPoint=v3(center.map((v,i)=>v+e.point[i])),spin=e.kind==='throw'?e.spin.map(v=>v*Math.PI/180):[0,0,0];
    for(const {o,b}of members){const r=b.rotation(),p=b.translation(),offset=rotateVector(rotateLocal(o,e.point).map((v,i)=>v*o.size[i]*(o.mirror?.[i]||1)),[r.x,r.y,r.z,r.w]),point=isGroup?groupPoint:{x:p.x+offset[0],y:p.y+offset[1],z:p.z+offset[2]},share=isGroup?o.mass/mass:1;
     if(e.kind==='impulse'){b.applyImpulseAtPoint(v3(e.vector.map(v=>v*share)),point,true);impact(o,Math.hypot(...e.vector)*share,time);}
     if(e.kind==='force')b.addForceAtPoint(v3(e.vector.map(v=>v*share)),point,true);
     if(e.kind==='throw'){if(b.isKinematic())b.setBodyType(RAPIER.RigidBodyType.Dynamic,true);const c=b.worldCom(),d=isGroup?[c.x-center[0],c.y-center[1],c.z-center[2]]:[0,0,0],tangent=[spin[1]*d[2]-spin[2]*d[1],spin[2]*d[0]-spin[0]*d[2],spin[0]*d[1]-spin[1]*d[0]];b.setLinvel(v3(e.vector.map((v,i)=>v+tangent[i])),true);b.setAngvel(v3(spin),true);}
    }
    if(e.kind!=='force')fired.add(e.id);
   }
   refreshSocketPoses();world.step(queue,hooks);
   queue.drainContactForceEvents(e=>{
    const a=colliderObjects.get(e.collider1()),b=colliderObjects.get(e.collider2());
    if(sameAssembly(a,b))return;
    for(const o of [a,b].filter(Boolean))if(previousSpeeds.get(o.id)>0.3){const impulse=Math.max(0,e.totalForceMagnitude()/120-o.mass*project.gravity/120);impact(o,impulse,time);}
   });
   if((step+1)%6===0){frames.push(capture());const now=(step+1)/120,still=movingBodies.every(b=>{const v=b.linvel(),a=b.angvel();return Math.hypot(v.x,v.y,v.z)<.02&&Math.hypot(a.x,a.y,a.z)<.03;});quiet=still?quiet+1:0;const escaped=movingBodies.some(b=>{const p=b.translation();return ![p.x,p.y,p.z].every(Number.isFinite)||Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(p.z))>65536;});if(escaped){stopReason='bounds';break;}if(options.shouldStop?.()){stopReason='manual';break;}if(frames.length*(64+project.objects.length*8+movingBodies.length*160)>memoryBytes){stopReason='memory';break;}if(auto&&quiet>=QUIET_SECONDS*20&&now>=horizon+QUIET_SECONDS){stopReason='rest';break;}}
   if((step+1)%120===0){const now=(step+1)/120;onProgress(auto?null:(step+1)/(ticks*6),{time:now,warning:auto&&now>Math.max(20,horizon+10)?ongoingMotion(project,now):null});await yieldFrame();}
  }
  for(let i=1;i<frames.length;i++)for(let j=0;j<project.objects.length;j++){
   const prev=frames[i-1][j].q,q=frames[i][j].q;if(q.reduce((s,v,k)=>s+v*prev[k],0)<0)frames[i][j].q=q.map(v=>-v);
  }
  if(frames.some(f=>f.some(s=>[...s.p,...s.q].some(v=>!Number.isFinite(v)))))throw new Error('시뮬레이션이 불안정합니다. 초기 겹침과 힘의 크기를 확인해 주세요.');
  ticks=frames.length-1;onProgress(1,{time:ticks/20,stopReason});return {fps:20,ticks,duration:ticks/20,stopReason,auto,frames,objects:clone(project.objects),connections:clone(project.connections||[]),fractures};
 }finally{queue.free();world.free();}
}
