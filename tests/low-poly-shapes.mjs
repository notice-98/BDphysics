import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {shapeTriangles,shapeMatrices,trianglePrisms,addShapePreset,SHAPE_PRESETS} from '../dist/shape-presets.js';
import {preset,validateProject,quaternionFromEuler} from '../dist/physics.js';
import {generateDatapack,displayTransform,VERSIONS} from '../dist/exporter.js';
const V=a=>new THREE.Vector3(...a),key=v=>v.map(n=>Math.round(n*1e6)).join(',');
assert(!SHAPE_PRESETS.some(([id])=>['cube','plane'].includes(id)));
assert.throws(()=>shapeMatrices('cube'),/지원하지/);assert.throws(()=>shapeMatrices('plane'),/지원하지/);
const regularFaces={tetrahedron:4,octahedron:8,dodecahedron:36,icosahedron:20};
for(const [kind]of SHAPE_PRESETS){
 const triangles=shapeTriangles(kind),matrices=shapeMatrices(kind),flat=['circle','triangle'].includes(kind),edges=new Map();
 assert.equal(matrices.length,triangles.length*3,kind+' uses exactly three blocks per triangular surface face');
 if(regularFaces[kind])assert.equal(triangles.length,regularFaces[kind],kind+' topology');
 let volume=0;
 for(const vertices of triangles){
  const [a,b,c]=vertices.map(V),normal=new THREE.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a));assert(normal.length()>1e-6);volume+=a.dot(new THREE.Vector3().crossVectors(b,c))/6;
  const inverses=trianglePrisms(vertices).map(m=>m.clone().invert());
  for(let i=0;i<=5;i++)for(let j=0;j<=5-i;j++){
   const point=a.clone().multiplyScalar(1-(i+j)/5).addScaledVector(b,i/5).addScaledVector(c,j/5);
   assert(inverses.some(m=>point.clone().applyMatrix4(m).toArray().every(v=>Math.abs(v)<=.500001)),kind+' triangle coverage');
  }
  for(let i=0;i<3;i++){const x=key(vertices[i]),y=key(vertices[(i+1)%3]),e=[x,y].sort().join('|'),d=x<y?1:-1;const found=edges.get(e)||{count:0,direction:0};found.count++;found.direction+=d;edges.set(e,found);}
 }
 if(!flat){assert(volume>0,kind+' faces wind outward');for(const edge of edges.values()){assert.equal(edge.count,2,kind+' closed manifold surface');assert.equal(edge.direction,0,kind+' adjacent faces wind consistently');}}
 const p=preset('empty'),id=addShapePreset(p,kind);validateProject(p);assert.equal(p.objects.length,matrices.length);assert.equal(p.groups[0].threshold,1e6);assert(p.objects.every(o=>o.group===id&&o.block==='minecraft:white_concrete'));
 for(let i=0;i<p.objects.length;i++){
  const o=p.objects[i],state={p:o.position,q:quaternionFromEuler(o.rotation)},t=displayTransform(state,o);
  const block=new THREE.Matrix4().compose(V(t.translation),new THREE.Quaternion(...t.left_rotation),V(t.scale)).multiply(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion(...t.right_rotation)));
  const expected=matrices[i].clone().premultiply(new THREE.Matrix4().makeTranslation(.5,.5,.5)).multiply(new THREE.Matrix4().makeTranslation(-.5,-.5,-.5));
  assert(Math.max(...expected.elements.map((n,j)=>Math.abs(n-block.elements[j])))<1e-6,kind+' world matrix retains the exact sheared triangular block');
 }
 console.log('PASS '+kind+': '+triangles.length+' triangles / '+p.objects.length+' concrete displays');
}
assert(shapeTriangles('sphere',16).length>shapeTriangles('sphere',8).length);assert(shapeTriangles('torus',16).length>shapeTriangles('torus',8).length);
const torus=shapeTriangles('torus');assert(torus.flat().every(([x,,z])=>Math.hypot(x,z)>.17),'torus retains an open center, rather than stacked filled rows');
const p=preset('empty');addShapePreset(p,'icosahedron');const recording={fps:20,ticks:0,duration:0,objects:p.objects,frames:[p.objects.map(o=>({id:o.id,p:o.position,q:quaternionFromEuler(o.rotation)}))]};
for(const version of VERSIONS){const pack=generateDatapack(p,recording,{namespace:'low_poly',version:version.id});const init=pack.files.get('data/low_poly/'+(version.legacy?'functions':'function')+'/init.mcfunction');assert.equal(init.split('\n').filter(l=>l.startsWith('summon minecraft:block_display')).length,60);assert(init.includes('minecraft:white_concrete'));assert(init.includes('right_rotation'));}
console.log('PASS all 25 datapack versions preserve the complete low-poly display surface');
