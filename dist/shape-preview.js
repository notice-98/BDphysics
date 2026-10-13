import * as THREE from './vendor/three.module.js';
import {shapeTriangles} from './shape-presets.js';

// Upright cameras have no roll. Flat presets face the viewer; the torus uses
// a higher camera to expose its opening instead of showing an edge-on ring.
export const SHAPE_PREVIEW_DIRECTIONS={
 sphere:[3,2.6,5],tetrahedron:[3.4,2.5,5],octahedron:[3,2.2,5],
 dodecahedron:[3.2,2.4,5],icosahedron:[3,2.5,5],torus:[3,5,6],
 cylinder:[3,2.8,5],cone:[3,2.8,5],pyramid:[4,2.8,5],prism:[3.5,2.8,5],
 circle:[0,0,1],triangle:[0,0,1]
};
const pointKey=p=>p.map(n=>Math.round(n*1e6)).join(',');
export function shapePreview(kind,resolution=12,width=120,height=92){
 const triangles=shapeTriangles(kind,resolution),eye=new THREE.Vector3(...SHAPE_PREVIEW_DIRECTIONS[kind]);
 const view=new THREE.Matrix4().lookAt(eye,new THREE.Vector3(),new THREE.Vector3(0,1,0)).invert();
 const light=new THREE.Vector3(-.4,.8,1).normalize(),faces=[],edges=new Map(),bounds=new THREE.Box2(),parents=triangles.map((_,i)=>i);
 const find=i=>parents[i]===i?i:(parents[i]=find(parents[i]));
 for(const [id,vertices]of triangles.entries()){
  const points=vertices.map(v=>new THREE.Vector3(...v).applyMatrix4(view));
  for(const p of points)bounds.expandByPoint(new THREE.Vector2(p.x,p.y));
  const normal=new THREE.Vector3().crossVectors(points[1].clone().sub(points[0]),points[2].clone().sub(points[0])).normalize(),visible=normal.z>1e-7||['triangle','circle'].includes(kind);
  faces.push({points,normal,visible,shade:Math.round(145+95*Math.max(0,normal.dot(light)))});
  for(let i=0;i<3;i++){
   const key=[pointKey(vertices[i]),pointKey(vertices[(i+1)%3])].sort().join('|');
   if(!edges.has(key))edges.set(key,{points:[points[i],points[(i+1)%3]],ids:[],visible:false});
   const edge=edges.get(key);edge.ids.push(id);edge.visible||=visible;
  }
 }
 // Fill each connected planar face as one polygon. This also removes canvas
 // antialiasing cracks between triangles on a pentagon or a cylinder cap.
 for(const edge of edges.values())if(edge.ids.length===2){
  const [a,b]=edge.ids;if(faces[a].normal.dot(faces[b].normal)>.999999){parents[find(b)]=find(a);edge.internal=true;}
 }
 const polygons=new Map();
 for(const edge of edges.values())if(!edge.internal)for(const id of edge.ids){
  if(!faces[id].visible)continue;const group=find(id);
  if(!polygons.has(group))polygons.set(group,{points:new Map(),shade:faces[id].shade});
  for(const p of edge.points)polygons.get(group).points.set(pointKey(p.toArray()),p);
 }
 const size=bounds.getSize(new THREE.Vector2()),center=bounds.getCenter(new THREE.Vector2()),scale=Math.min((width-16)/size.x,(height-16)/size.y);
 const project=p=>[width/2+(p.x-center.x)*scale,height/2-(p.y-center.y)*scale];
 const visibleFaces=(kind==='torus'?faces.filter(f=>f.visible).map(f=>({points:f.points.map(project),shade:f.shade,z:f.points.reduce((sum,p)=>sum+p.z,0)/3})):[...polygons.values()].map(f=>{
  const points=[...f.points.values()],mid=points.reduce((s,p)=>s.add(p),new THREE.Vector3()).divideScalar(points.length);
  points.sort((a,b)=>Math.atan2(a.y-mid.y,a.x-mid.x)-Math.atan2(b.y-mid.y,b.x-mid.x));
  return {points:points.map(project),shade:f.shade,z:mid.z};
 })).sort((a,b)=>a.z-b.z);
 return {triangleCount:triangles.length,faces:visibleFaces,edges:[...edges.values()].filter(e=>e.visible&&!e.internal).map(e=>e.points.map(project))};
}
