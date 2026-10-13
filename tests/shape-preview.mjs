import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {SHAPE_PRESETS,shapeTriangles} from '../dist/shape-presets.js';
import {shapePreview,SHAPE_PREVIEW_DIRECTIONS} from '../dist/shape-preview.js';
const V=a=>new THREE.Vector3(...a),key=a=>a.map(v=>Math.round(v*1e6)).join(',');
const triangles=shapeTriangles('dodecahedron'),planes=new Map(),vertices=new Map(),edges=new Map();
for(const t of triangles){
 const [a,b,c]=t.map(V),normal=new THREE.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a)).normalize(),distance=normal.dot(a),found=[...planes.entries()].find(([,f])=>f.normal.distanceTo(normal)<1e-6&&Math.abs(f.distance-distance)<1e-6),plane=found?.[0]??String(planes.size);
 if(!planes.has(plane))planes.set(plane,{normal,distance,points:new Map(),triangles:0});
 const face=planes.get(plane);face.triangles++;
 for(const p of t){vertices.set(key(p),V(p));face.points.set(key(p),V(p));}
 for(let i=0;i<3;i++){
  const p=t[i],q=t[(i+1)%3],id=[key(p),key(q)].sort().join('|');
  if(!edges.has(id))edges.set(id,{length:V(p).distanceTo(V(q)),normals:[]});edges.get(id).normals.push(normal);
 }
}
assert.equal(vertices.size,20);assert.equal(planes.size,12);assert([...planes.values()].every(p=>p.points.size===5&&p.triangles===3),'each face remains a flat pentagon');
const radii=[...vertices.values()].map(v=>v.length());assert(Math.max(...radii)-Math.min(...radii)<1e-6,'regular vertices remain on one sphere');
const sides=[...edges.values()].filter(e=>e.normals[0].dot(e.normals[1])<.99999);assert.equal(sides.length,30);assert(Math.max(...sides.map(e=>e.length))-Math.min(...sides.map(e=>e.length))<1e-6,'all 30 true edges have equal lengths');
assert([...planes.values()].some(f=>f.normal.distanceTo(new THREE.Vector3(0,-1,0))<1e-6),'one pentagonal face rests horizontally');
const minY=Math.min(...[...vertices.values()].map(v=>v.y));assert.equal([...vertices.values()].filter(v=>Math.abs(v.y-minY)<1e-6).length,5);
for(const [kind]of SHAPE_PRESETS){
 const preview=shapePreview(kind);assert(preview.faces.length>0&&preview.edges.length>0);
 for(const p of [...preview.faces.flatMap(f=>f.points),...preview.edges.flat()])assert(p.every(Number.isFinite)&&p[0]>=7.999&&p[0]<=112.001&&p[1]>=7.999&&p[1]<=84.001,kind+' centered preview stays inside its canvas');
 const eye=V(SHAPE_PREVIEW_DIRECTIONS[kind]),view=new THREE.Matrix4().lookAt(eye,new THREE.Vector3(),new THREE.Vector3(0,1,0)).invert(),up=new THREE.Vector3(0,1,0).transformDirection(view);assert(Math.abs(up.x)<1e-9&&up.y>0,kind+' preview has no camera roll');
}
const dodeca=shapePreview('dodecahedron');assert(dodeca.faces.every(f=>f.points.length===5),'fill whole pentagons without antialiasing cracks');assert.equal(shapePreview('circle').faces.length,1,'fill the disk as one face without triangle seams');assert(dodeca.edges.length<=30,'coplanar triangulation diagonals do not appear as polyhedron edges');
for(const kind of ['circle','triangle']){const preview=shapePreview(kind);const all=preview.faces.flatMap(f=>f.points),width=Math.max(...all.map(p=>p[0]))-Math.min(...all.map(p=>p[0])),height=Math.max(...all.map(p=>p[1]))-Math.min(...all.map(p=>p[1]));assert(Math.abs(width/height-(kind==='circle'?1:2/Math.sqrt(3)))<1e-6,'flat preview preserves the true unforeshortened ratio');}
assert(SHAPE_PREVIEW_DIRECTIONS.torus[1]/Math.hypot(SHAPE_PREVIEW_DIRECTIONS.torus[0],SHAPE_PREVIEW_DIRECTIONS.torus[2])>.7,'ring preview looks down into the opening');
console.log('PASS regular dodecahedron: 12 equal pentagons, 30 equal edges, 20 equal-radius vertices and a horizontal base');
console.log('PASS all 12 previews: upright cameras, consistent fit, true outlines and unforeshortened flat shapes');
