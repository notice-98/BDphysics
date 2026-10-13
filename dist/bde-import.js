import {headRef} from './head-textures.js';
import {markImportedPlayers} from './player-model.js';
import {decomposeAffine} from './affine.js';
import * as THREE from './vendor/three.module.js';
import {preset,MATERIALS,volume,validateProject} from './physics.js';
import {decodeState,stateValues,resolveBlockShape} from './shapes.js';
import {pruneEmptyGroups} from './structure.js';
export async function importBDE(tree,{catalog,makeObject}){
 const project=preset('empty');project.gameVersion=catalog.version;project.name=String(tree[0]?.name||'가져온 프로젝트').slice(0,80);let blockId=0,groupId=0,visited=0,texts=0,heads=0,drafts=0;
 async function walk(node,parent,group=null,depth=0,isRoot=false){
  if(!node||typeof node!=='object'||depth>16||++visited>4096)throw new Error('프로젝트 계층이 지원 범위를 벗어났습니다.');
  const values=node.transforms??[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];if(!Array.isArray(values)||values.length!==16||values.some(v=>!Number.isFinite(v)))throw new Error('잘못된 모델 변환입니다.');const world=parent.clone().multiply(new THREE.Matrix4().set(...values));
  if(node.isTextDisplay){texts++;return;}
  if(node.isCollection){let next=group;if(!isRoot||node.children?.some(c=>['left leg','right leg'].includes(String(c.name).toLowerCase().trim()))){next='g'+(++groupId);project.groups.push({id:next,name:String(node.name||'Group '+groupId).slice(0,80),parent:group,threshold:1000000,releaseTime:null});}for(const child of node.children||[])await walk(child,world,next,depth+1);return;}
  if(node.isBlockDisplay||node.isItemDisplay){
   const type=node.isItemDisplay?'item':'block',state=node.blockState||node.defaultBlockState||node.itemState||node.defaultItemState,name=String(state?.name||node.name||''),match=/^(?:minecraft:)?([a-z0-9_]+)(?:\[([^\]]*)\])?$/.exec(name);if(!match)throw new Error('지원하지 않는 Minecraft 모델 이름: '+name);const id='minecraft:'+match[1],o=await makeObject(type,id);o.id='b'+(++blockId);o.name=String(node.objectName||o.name).slice(0,80);o.group=group;
   const props={...Object.fromEntries((match[2]||'').split(',').filter(Boolean).map(pair=>pair.split('='))),...(state?.variant||{})};
   if(type==='block'){const block=catalog.blocks.find(b=>'minecraft:'+b.name===id);if(!block)throw new Error(id+'는 현재 게임 버전에 없습니다.');o.blockStates={...decodeState(block)};for(const s of block.states||[])if(props[s.name]!=null){if(!stateValues(s).includes(String(props[s.name])))throw new Error('잘못된 블록 상태: '+s.name);o.blockStates[s.name]=String(props[s.name]);}o.colliderParts=resolveBlockShape(catalog,block,o.blockStates);}
   else {o.itemDisplay=props.display||'none';if(id==='minecraft:player_head'){const ref=headRef(node,state);if(ref.value){o.headTexture=ref.value;heads++;}if(ref.skin){o.headSkin=ref.skin;o.headNeedsBake=true;drafts++;}o.headSecondLayer=node.enableSecondLayer!==false;}}
   const position=new THREE.Vector3().setFromMatrixPosition(world),{rotation,scale,right}=decomposeAffine(world);o.rightRotation=right.toArray();
   if(type==='block')position.set(.5,.5,.5).applyMatrix4(world);o.position=position.toArray();o.rotation=new THREE.Euler().setFromQuaternion(rotation,'XYZ').toArray().slice(0,3).map(v=>v*180/Math.PI);o.size=scale.toArray().map(Math.abs);o.mirror=scale.toArray().map(v=>Math.sign(v)||1);o.mass=Math.max(.01,(type==='item'?1:MATERIALS[o.material].density)*volume(o));project.objects.push(o);
  }
  for(const child of node.children||[])await walk(child,world,group,depth+1);
 }
 for(const node of tree)await walk(node,new THREE.Matrix4(),null,0,!!node.isCollection);pruneEmptyGroups(project);const players=markImportedPlayers(project);validateProject(project);return {project,report:{objects:blockId,groups:project.groups.length,excludedTexts:texts,customHeads:heads,paintedHeads:drafts,players}};
}
