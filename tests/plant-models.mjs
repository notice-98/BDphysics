import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import * as THREE from '../dist/vendor/three.module.js';
import {MinecraftAssets} from '../dist/minecraft-assets.js';
import {ModelRenderer} from '../dist/model-renderer.js';

// Exercise production mesh construction and ray culling without a GPU/texture decoder.
function rendererForGeometry(){
 const r=Object.create(ModelRenderer.prototype),texture=new THREE.Texture();
 Object.assign(r,{geometryCaches:new WeakMap(),boxGeometries:new Map(),geometryRefs:new WeakMap(),materials:new Map(),missing:texture,texture:()=>texture});
 return r;
}
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-6,`${label}: ${a} != ${b}`);
const root=new URL('../dist/vanilla/',import.meta.url);
let modelCount=0,planeCount=0,pottedCount=0,versionCount=0,rescaledOffsetCount=0;
for(const entry of await readdir(root,{withFileTypes:true})){
 if(!entry.isDirectory()||entry.name==='textures')continue;
 let bundle;try{bundle=JSON.parse(await readFile(new URL(entry.name+'/assets.json',root),'utf8'));}catch(error){if(error.code==='ENOENT')continue;throw error;}
 const assets=new MinecraftAssets(null,bundle.version,bundle.json,'./vanilla/'+entry.name+'/');assets.textureMap=bundle.textures||null;
 const models=new Map();
 function visit(value,owner){if(Array.isArray(value)){for(const v of value)visit(v,owner);}else if(value&&typeof value==='object'){if(value.model)models.set(value.model,owner);for(const v of Object.values(value))if(typeof v==='object')visit(v,owner);}}
 for(const [path,data]of Object.entries(bundle.json))if(path.includes('/blockstates/'))visit(data,'minecraft:'+path.split('/').at(-1).replace('.json',''));
 let checked=0,potted=0;
 for(const [id,owner]of models){
  const source=await assets.model(id),elements=source.elements||[];
  if(!elements.some(e=>e.from.some((v,i)=>v===e.to[i])))continue;
  const parts=await assets.modelParts(id,owner),renderer=rendererForGeometry();
  assert.equal(parts.length,elements.length,id);
  for(const [i,e]of elements.entries()){
   const thin=e.from.findIndex((v,j)=>v===e.to[j]);if(thin<0)continue;
   const part=parts[i],mesh=renderer.partMesh(part,{block:owner});mesh.updateMatrixWorld(true);
   const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
   assert.ok(mats.every(m=>m.side===THREE.FrontSide),`${entry.name} ${id}: explicit faces must be one-sided`);
   const unshaded=e.shade===false||e.shade_direction_override==='up';
   assert.ok(mats.every(m=>!!m.isMeshBasicMaterial===unshaded),`${id}: preserve vanilla plant shading`);
   const q=new THREE.Quaternion().fromArray(part.q),center=new THREE.Vector3().fromArray(part.c);
   const sides=[['west','east'],['down','up'],['north','south']][thin];
   // Each side sees exactly its own quad, never the opposite mirrored texture.
   for(const [sideIndex,face]of sides.entries()){
    const target=new THREE.Vector3(...part.s.map((s,j)=>j===thin?0:s*[.137,.213,-.311][j])).applyQuaternion(q).add(center);
    const normal=new THREE.Vector3().setComponent(thin,sideIndex?1:-1).applyQuaternion(q);
    const hits=new THREE.Raycaster(target.clone().addScaledVector(normal,2),normal.clone().negate()).intersectObject(mesh);
    assert.equal(hits.length,e.faces[face]?1:0,`${entry.name} ${id} part ${i} ${face}: coplanar face overlap`);
   }
   // Compare vertices with the original JSON's origin/rotation/rescale transform.
   const rot=e.rotation,origin=new THREE.Vector3(...(rot?.origin||[8,8,8]).map(v=>v/16-.5));
   const rotation=rot?.axis?new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3().setComponent('xyz'.indexOf(rot.axis),1),rot.angle*Math.PI/180):new THREE.Quaternion().fromArray(part.q);
   const scale=new THREE.Vector3(1,1,1);
   if(rot?.rescale&&rot.axis)for(let j=0;j<3;j++)if(j!=='xyz'.indexOf(rot.axis))scale.setComponent(j,1/Math.cos(rot.angle*Math.PI/180));
   const expected=[];
   for(const x of [e.from[0],e.to[0]])for(const y of [e.from[1],e.to[1]])for(const z of [e.from[2],e.to[2]])expected.push(new THREE.Vector3(x/16-.5,y/16-.5,z/16-.5).sub(origin).applyQuaternion(rotation).multiply(scale).add(origin));
   const positions=mesh.geometry.getAttribute('position');
   for(let j=0;j<positions.count;j++){
    const actual=new THREE.Vector3().fromBufferAttribute(positions,j).applyQuaternion(q).add(center);
    assert.ok(expected.some(v=>v.distanceTo(actual)<1e-6),`${entry.name} ${id}: original vertex transform`);
   }
   if(rot?.rescale&&rot.axis&&e.from.some((v,j)=>j!=='xyz'.indexOf(rot.axis)&&Math.abs((v+e.to[j])/2-rot.origin[j])>1e-6))rescaledOffsetCount++;
   planeCount++;
  }
  if(owner.includes('potted_')){potted++;pottedCount++;}
  checked++;modelCount++;
 }
 assert.ok(checked>30&&potted>10,`${entry.name}: audit must include plants and potted variants`);
 console.log(`PASS ${entry.name}: ${checked} planar models (${potted} potted), original geometry and front/back rendering`);
 versionCount++;
}
assert.equal(versionCount,25);
assert.ok(rescaledOffsetCount>0);

// Asymmetric UVs must remain independent on opposite sides of the same plane.
const renderer=rendererForGeometry(),p={c:[0,0,0],s:[1,1,0],q:[0,0,0,1],faces:{north:{uv:[0,0,16,16],tint:'#ffffff'},south:{uv:[0,0,16,16],tint:'#ffffff'}}};
const mesh=renderer.partMesh(p,{block:'minecraft:oak_sapling'});mesh.updateMatrixWorld(true);
const front=new THREE.Raycaster(new THREE.Vector3(.2,.13,2),new THREE.Vector3(0,0,-1)).intersectObject(mesh);
const back=new THREE.Raycaster(new THREE.Vector3(.2,.13,-2),new THREE.Vector3(0,0,1)).intersectObject(mesh);
assert.equal(front.length,1);assert.equal(back.length,1);near(front[0].uv.x,.7,'south UV');near(back[0].uv.x,.3,'north UV');
const ghost=renderer.partMesh(p,{block:'minecraft:oak_sapling'},true);assert.equal(ghost.material.side,THREE.FrontSide);
console.log(JSON.stringify({plantModels:modelCount,pottedModels:pottedCount,planes:planeCount,rescaledOffsetPlanes:rescaledOffsetCount,versions:versionCount,status:'passed'}));
