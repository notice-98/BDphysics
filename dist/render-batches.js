import * as THREE from './vendor/three.module.js';
// Keep source meshes for picking and bounds. Low-poly faces bake their local
// rotation into batch geometry, so instance matrices stay TRS and normals retain
// the correct lighting even when a display uses a second rotation and shear.
export class RenderBatches{
 constructor(scene){this.scene=scene;this.batches=[];this.hiddenMeshes=[];this.objects=0;}
 clear(){
  for(const mesh of this.hiddenMeshes)mesh.layers.set(0);
  for(const batch of this.batches){this.scene.remove(batch.mesh);batch.mesh.dispose();if(batch.ownsGeometry)batch.mesh.geometry.dispose();}
  this.batches=[];this.hiddenMeshes=[];this.objects=0;
 }
 rebuild(roots,objects){
  this.clear();const groups=new Map();
  for(const o of objects){
   const root=roots.get(o.id),lowPoly=!!o.lowPolyFace;
   if(!root?.visible||o.virtual||root.userData.modelStatus==='loading'||root.userData.virtual!==!!o.virtual||o.type==='item'||root.scale.x*root.scale.y*root.scale.z<0)continue;
   if(!lowPoly&&(root.children.length!==1||o.rightRotation?.slice(0,3).some(v=>Math.abs(v)>1e-8)))continue;
   root.updateMatrixWorld(true);
   for(const child of root.children){
    const materials=Array.isArray(child.material)?child.material:[child.material];
    if(!child.isMesh||(!lowPoly&&Array.isArray(child.material))||materials.some(m=>!m||m.transparent))continue;
    const local=lowPoly?child.matrix.elements.map(v=>v.toFixed(6)).join(','):'';
    const key=child.geometry.uuid+'|'+materials.map(m=>m.uuid).join(',')+'|'+local;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push({root,child,lowPoly,last:new Float64Array(10).fill(NaN)});
   }
  }
  const drawnRoots=new Set();
  for(const entries of groups.values()){
   if(entries.length<2)continue;
   const first=entries[0],child=first.child,geometry=first.lowPoly?child.geometry.clone().applyMatrix4(child.matrix):child.geometry;
   const mesh=new THREE.InstancedMesh(geometry,child.material,entries.length);
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;this.scene.add(mesh);
   for(const e of entries){e.child.layers.set(1);this.hiddenMeshes.push(e.child);drawnRoots.add(e.root);}
   this.batches.push({mesh,entries,ownsGeometry:first.lowPoly});
  }
  this.objects=drawnRoots.size;this.update();
 }
 update(){
  for(const batch of this.batches){
   let changed=false;
   for(let i=0;i<batch.entries.length;i++){
    const e=batch.entries[i],r=e.root,p=r.position,q=r.quaternion,s=r.scale,last=e.last;
    if(p.x===last[0]&&p.y===last[1]&&p.z===last[2]&&q.x===last[3]&&q.y===last[4]&&q.z===last[5]&&q.w===last[6]&&s.x===last[7]&&s.y===last[8]&&s.z===last[9])continue;
    r.updateMatrixWorld(true);batch.mesh.setMatrixAt(i,e.lowPoly?r.matrixWorld:e.child.matrixWorld);
    last.set([p.x,p.y,p.z,q.x,q.y,q.z,q.w,s.x,s.y,s.z]);changed=true;
   }
   if(changed)batch.mesh.instanceMatrix.needsUpdate=true;
  }
 }
}
