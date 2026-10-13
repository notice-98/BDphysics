import * as THREE from './vendor/three.module.js';
import {decomposeAffine} from './affine.js';
import {object,validateProject} from './physics.js';

export const SHAPE_PRESETS=[
 ['sphere','구'],['tetrahedron','정사면체'],['octahedron','정팔면체'],
 ['dodecahedron','정십이면체'],['icosahedron','정이십면체'],['torus','토러스'],
 ['cylinder','원기둥'],['cone','원뿔'],['pyramid','사각뿔'],
 ['prism','삼각기둥'],['circle','원'],['triangle','삼각형']
];
export const SHAPE_THICKNESS=1/128;
const V=a=>new THREE.Vector3(...a);

// Three overlapping parallelograms cover exactly one triangle. Each is a
// transformed concrete block; both rotations preserve its sheared shape in game.
export function trianglePrisms(vertices,thickness=SHAPE_THICKNESS){
 return vertices.map((a,i)=>{
  const u=V(vertices[(i+1)%3]).sub(V(a)).multiplyScalar(.5);
  const v=V(vertices[(i+2)%3]).sub(V(a)).multiplyScalar(.5);
  const n=new THREE.Vector3().crossVectors(u,v).normalize().multiplyScalar(thickness);
  const center=V(a).add(u.clone().add(v).multiplyScalar(.5));
  return new THREE.Matrix4().makeBasis(u,v,n).setPosition(center);
 });
}

// Put a regular face on the ground using a rigid rotation only; never stretch
// a regular solid to force equal axis-aligned bounds.
function restOnFace(geometry){
 const p=geometry.getAttribute('position'),index=geometry.getIndex(),count=index?index.count:p.count;
 let bottom=new THREE.Vector3(0,1,0);
 for(let i=0;i<count;i+=3){
  const [a,b,c]=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j));
  const n=new THREE.Vector3().crossVectors(b.sub(a),c.sub(a)).normalize();
  if(n.y<bottom.y)bottom=n;
 }
 geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(bottom,new THREE.Vector3(0,-1,0)));
 return geometry;
}

export function shapeTriangles(kind,resolution=12){
 if(!SHAPE_PRESETS.some(([id])=>id===kind))throw new Error('지원하지 않는 도형입니다.');
 const n=Math.max(6,Math.min(24,Math.round(Number(resolution)||12))),half=Math.max(3,Math.round(n/2));
 if(kind==='triangle')return [[[-.5,-Math.sqrt(3)/6,0],[.5,-Math.sqrt(3)/6,0],[0,Math.sqrt(3)/3,0]]];
 let geometry;
 switch(kind){
  case 'sphere':geometry=new THREE.SphereGeometry(.5,n,half);break;
  case 'tetrahedron':geometry=restOnFace(new THREE.TetrahedronGeometry(.5,0));break;
  case 'octahedron':geometry=new THREE.OctahedronGeometry(.5,0);break;
  case 'dodecahedron':geometry=restOnFace(new THREE.DodecahedronGeometry(.5,0));break;
  case 'icosahedron':geometry=new THREE.IcosahedronGeometry(.5,0);break;
  case 'torus':geometry=new THREE.TorusGeometry(.34,.16,half,n);geometry.rotateX(Math.PI/2);break;
  case 'cylinder':geometry=new THREE.CylinderGeometry(.5,.5,1,n,1,false);break;
  case 'cone':geometry=new THREE.ConeGeometry(.5,1,n,1,false);break;
  case 'pyramid':geometry=new THREE.ConeGeometry(.5,1,4,1,false);geometry.rotateY(Math.PI/4);break;
  case 'prism':geometry=new THREE.CylinderGeometry(.5,.5,1,3,1,false);break;
  case 'circle':geometry=new THREE.CircleGeometry(.5,n);break;
 }
 geometry.computeBoundingBox();
 const center=geometry.boundingBox.getCenter(new THREE.Vector3());
 const size=geometry.boundingBox.getSize(new THREE.Vector3()),scale=1/Math.max(size.x,size.y,size.z);
 const position=geometry.getAttribute('position'),index=geometry.getIndex(),count=index?index.count:position.count,triangles=[];
 for(let i=0;i<count;i+=3){
  const vertices=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(position,index?index.getX(i+j):i+j).sub(center).multiplyScalar(scale));
  if(new THREE.Vector3().crossVectors(vertices[1].clone().sub(vertices[0]),vertices[2].clone().sub(vertices[0])).lengthSq()<1e-14)continue;
  triangles.push(vertices.map(v=>v.toArray()));
 }
 geometry.dispose();return triangles;
}

export function shapeMatrices(kind,resolution=12){
 return shapeTriangles(kind,resolution).flatMap(vertices=>trianglePrisms(vertices));
}

export function addShapePreset(project,kind,{resolution=12,position=[.5,.5,.5]}={}){
 const matrices=shapeMatrices(kind,resolution),name=SHAPE_PRESETS.find(([id])=>id===kind)[1];
 if(project.objects.length+matrices.length>8192)throw new Error('도형을 추가하면 물체 8,192개 제한을 초과합니다. 곡면 분할을 낮춰 주세요.');
 project.groups||=[];
 let id=Math.max(0,...project.objects.map(o=>+o.id.slice(1)));
 const gId='g'+(Math.max(0,...project.groups.map(g=>+g.id.slice(1)))+1);
 project.groups.push({id:gId,name,parent:null,threshold:1000000,releaseTime:null,shapePreset:kind});
 for(const m of matrices){
  const {rotation,scale,right}=decomposeAffine(m),s=scale.toArray();
  const p=new THREE.Vector3().setFromMatrixPosition(m).toArray().map((v,i)=>v+position[i]);
  project.objects.push(object('b'+(++id),'stone',p,{
   block:'minecraft:white_concrete',name:'흰색 콘크리트',lowPolyFace:true,
   rotation:new THREE.Euler().setFromQuaternion(rotation,'XYZ').toArray().slice(0,3).map(v=>v*180/Math.PI),
   size:s.map(Math.abs),mirror:s.map(v=>Math.sign(v)||1),rightRotation:right.toArray(),
   mass:Math.max(.01,25*Math.abs(m.determinant())),friction:.75,restitution:.08,group:gId
  }));
 }
 validateProject(project);return gId;
}
