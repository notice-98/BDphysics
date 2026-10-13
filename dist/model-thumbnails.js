import * as THREE from 'three';
import {ModelRenderer} from './model-renderer.js';
import {decodeState} from './shapes.js';
export class ModelThumbnails{
 constructor(){this.cache=new Map();this.models=new ModelRenderer();this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});this.renderer.setSize(128,128);this.renderer.setPixelRatio(1);this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;this.scene=new THREE.Scene();this.scene.add(new THREE.HemisphereLight('#ffffff','#718095',2));const light=new THREE.DirectionalLight('#ffffff',2.5);light.position.set(-3,6,5);this.scene.add(light);this.camera=new THREE.PerspectiveCamera(30,1,.01,100);this.queue=Promise.resolve();}
 get(id,type,assets,catalog){const key=assets.key+'|'+type+'|'+id;if(!this.cache.has(key)){const job=this.queue.then(()=>this.render(id,type,assets,catalog));this.queue=job.catch(()=>{});this.cache.set(key,job);}return this.cache.get(key);}
 async render(id,type,assets,catalog){
  const block=type==='block'?catalog.blocks.find(b=>'minecraft:'+b.name===id):null,properties=block?decodeState(block):{};if(properties.half==='upper')properties.half='lower';if(properties.part==='head')properties.part='foot';
  const o={id:'thumbnail',type,block:id,blockStates:properties,size:[1,1,1]},root=new THREE.Group();this.scene.add(root);
  try{await this.models.fill(root,o,assets,properties);await this.models.ready();if(!root.children.length)return null;root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());root.position.sub(center);root.updateMatrixWorld(true);
   let direction=new THREE.Vector3(1.15,.85,1.5);if(type==='item'&&size.z<Math.max(size.x,size.y)*.2)direction.set(.1,.08,1);else if(size.x<Math.max(size.y,size.z)*.15)direction.set(1,.4,.3);else if(size.z<Math.max(size.x,size.y)*.15)direction.set(.3,.45,1);
   this.camera.position.copy(direction.normalize().multiplyScalar(Math.max(.05,size.length())/2/Math.sin(Math.PI/12)*1.15));this.camera.lookAt(0,0,0);this.camera.updateMatrixWorld(true);this.renderer.render(this.scene,this.camera);return this.renderer.domElement.toDataURL('image/png');
  }finally{this.scene.remove(root);this.models.disposeRoot(root);}
 }
}
