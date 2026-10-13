import * as THREE from 'three';
import {PIXEL} from './editing.js';
export function createMinecraftGrid(){
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uStep:{value:PIXEL}},vertexShader:'varying vec3 world;void main(){vec4 p=modelMatrix*vec4(position,1.0);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',fragmentShader:'varying vec3 world;uniform float uStep;float line(vec2 p,float spacing,float width){vec2 v=p/spacing;vec2 d=max(fwidth(v),vec2(.000001));vec2 g=abs(fract(v-.5)-.5)/d;return 1.-smoothstep(0.,width,min(g.x,g.y));}void main(){vec2 p=world.xz;float footprint=max(length(dFdx(p)),length(dFdy(p)));float pixel=line(p,uStep,.7)*smoothstep(.6,2.4,uStep/footprint)*.32;float block=line(p,1.,1.15)*.62;float alpha=max(block,pixel);float fade=1.-smoothstep(35.,100.,distance(cameraPosition,world));gl_FragColor=vec4(mix(vec3(.33,.37,.42),vec3(.62,.66,.72),block),alpha*fade);}'});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(512,512),material);mesh.rotation.x=-Math.PI/2;mesh.position.y=.002;return mesh;
}
