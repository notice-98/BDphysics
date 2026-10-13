import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {RenderBatches} from '../dist/render-batches.js';
const scene=new THREE.Scene(), roots=new Map(), objects=[], geometry=new THREE.BoxGeometry(1,1,1), material=new THREE.MeshStandardMaterial(), batches=new RenderBatches(scene);
for(let i=0;i<3;i++){
 const root=new THREE.Group();root.userData.virtual=false;root.position.set(i*2,1,-i);root.rotation.set(.2,.3+i*.1,-.1);root.scale.set(.45,.8,.0078125);
 const child=new THREE.Mesh(geometry,[material,material,material,material,material,material]);child.position.set(.07,-.09,.04);child.rotation.set(.4,-.7,.2);root.add(child);scene.add(root);roots.set('f'+i,root);objects.push({id:'f'+i,type:'block',lowPolyFace:true,rightRotation:child.quaternion.toArray()});
}
batches.rebuild(roots,objects);assert.equal(batches.batches.length,1);assert.equal(batches.objects,3);
const batch=batches.batches[0];assert.notEqual(batch.mesh.geometry,geometry);assert.equal(batch.mesh.material[0],material);
function checkWorldTransforms(){
 for(let i=0;i<batch.entries.length;i++){
  const {root,child}=batch.entries[i], instance=new THREE.Matrix4();batch.mesh.getMatrixAt(i,instance);root.updateMatrixWorld(true);
  const original=geometry.getAttribute('position'), baked=batch.mesh.geometry.getAttribute('position'), originals=geometry.getAttribute('normal'), normals=batch.mesh.geometry.getAttribute('normal');
  const expectedNormal=new THREE.Matrix3().getNormalMatrix(child.matrixWorld), instancedNormal=new THREE.Matrix3().getNormalMatrix(instance);
  for(let j=0;j<original.count;j++){
   const expected=new THREE.Vector3().fromBufferAttribute(original,j).applyMatrix4(child.matrixWorld), actual=new THREE.Vector3().fromBufferAttribute(baked,j).applyMatrix4(instance);assert(actual.distanceTo(expected)<2e-6,'batched geometry keeps the exact sheared world surface');
   const en=new THREE.Vector3().fromBufferAttribute(originals,j).applyMatrix3(expectedNormal).normalize(), an=new THREE.Vector3().fromBufferAttribute(normals,j).applyMatrix3(instancedNormal).normalize();assert(an.distanceTo(en)<2e-6,'baked rotation preserves normals under nonuniform instance scale');
  }
 }
}
checkWorldTransforms();roots.get('f1').position.set(-3,5,4);roots.get('f1').rotation.set(-.4,.6,1);batches.update();checkWorldTransforms();
let originalDisposed=false,bakedDisposed=false,materialDisposed=false;geometry.addEventListener('dispose',()=>originalDisposed=true);batch.mesh.geometry.addEventListener('dispose',()=>bakedDisposed=true);material.addEventListener('dispose',()=>materialDisposed=true);
batches.clear();assert(bakedDisposed);assert(!originalDisposed&&!materialDisposed);assert.equal(batches.objects,0);assert.equal(scene.children.length,3);assert([...roots.values()].every(r=>r.children[0].layers.mask===1));
for(const o of objects)o.lowPolyFace=false;batches.rebuild(roots,objects);assert.equal(batches.batches.length,0,'ordinary two-rotation objects retain their existing render path');
for(const o of objects){o.lowPolyFace=true;o.virtual=true;}batches.rebuild(roots,objects);assert.equal(batches.batches.length,0,'transparent virtual surfaces stay outside opaque batches');
console.log('PASS low-poly render batches: shear, normals, animation updates and resource cleanup');
