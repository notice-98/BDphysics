import {unbakedHeads} from './head-textures.js';
import {entityMetadata} from './entity-nbt.js';
import {rotateLocal} from './affine.js';
import {rotateVector,validateProject} from './physics.js';
import {connectionTransforms,connectionVisual} from './connections.js';
import {retimeRecording} from './time-remap.js';
import {explosionParticleCommand,explosionParticleEvents} from './explosions.js';

export const VERSIONS=[
 {id:'1.19.4',format:12,legacy:true},
 {id:'1.20',format:15,legacy:true},{id:'1.20.1',format:15,legacy:true},
 {id:'1.20.2',format:18,legacy:true},{id:'1.20.3',format:26,legacy:true},{id:'1.20.4',format:26,legacy:true},
 {id:'1.20.5',format:41,legacy:true},{id:'1.20.6',format:41,legacy:true},
 {id:'1.21',format:48},{id:'1.21.1',format:48},{id:'1.21.2',format:57},{id:'1.21.3',format:57},
 {id:'1.21.4',format:61},{id:'1.21.5',format:71},{id:'1.21.6',format:80},{id:'1.21.7',format:81},{id:'1.21.8',format:81},
 {id:'1.21.9',format:[88,0]},{id:'1.21.10',format:[88,0]},{id:'1.21.11',format:[94,1]},
 {id:'26.1',format:[101,1]},{id:'26.1.1',format:[101,1]},{id:'26.1.2',format:[101,1]},{id:'26.2',format:[107,1]},{id:'26.3',format:[121,0],blockIdKey:'id'}
];
export const DEFAULT_VERSION=VERSIONS.at(-1).id;
export const namespaceValid=ns=>/^[a-z][a-z0-9_]{0,31}$/.test(ns)&&!['minecraft','voxel_dynamics'].includes(ns);
export function packMeta(version,description){
 return {pack:Array.isArray(version.format)?{description,min_format:version.format,max_format:version.format}:{pack_format:version.format,description}};
}
const f=v=>{if(!Number.isFinite(v))throw new Error('유효하지 않은 프레임 값입니다.');return (Math.abs(v)<.000000005?'0':v.toFixed(8).replace(/\.?0+$/,''))+'f';};
const arr=a=>'['+a.map(f).join(',')+']';
// block_display has its pivot at the model corner. Move the rotated half-size
// back from the rigid body's center so its collision shape and visual agree.
export function displayTransform(state,object){
 const size=object.size.map((v,i)=>v*(object.mirror?.[i]||1)),offset=object.type==='item'?[0,0,0]:rotateVector(rotateLocal(object,[.5,.5,.5]).map((v,i)=>v*size[i]),state.q);
 return {translation:state.p.map((v,i)=>v-offset[i]),left_rotation:state.q,scale:size,right_rotation:object.rightRotation||[0,0,0,1]};
}
function snbtTransform(state,object){
 const t=displayTransform(state,state.size?{...object,size:state.size}:object);
 return '{translation:'+arr(t.translation)+',left_rotation:'+arr(t.left_rotation)+',scale:'+arr(t.scale)+',right_rotation:'+arr(t.right_rotation)+'}';
}
export function generateDatapack(project,recording,options={}){
 validateProject(project);if(unbakedHeads(project).length)throw new Error('미등록 머리 텍스처가 있습니다. 래그돌의 데이터팩 텍스처 변환을 먼저 완료하세요.');
 const ns=options.namespace||'my_animation',version=VERSIONS.find(v=>v.id===(options.version||project.gameVersion||DEFAULT_VERSION));
 if(!namespaceValid(ns))throw new Error('이름은 소문자로 시작하고 소문자·숫자·밑줄만 사용할 수 있습니다 (최대 32자).');
 if(!version)throw new Error('지원하는 자바 에디션 버전을 선택해 주세요.');
 if(!recording||recording.frames.length!==recording.ticks+1||recording.fps!==20||recording.objects.length!==project.objects.length)throw new Error('먼저 현재 장면의 시뮬레이션을 기록해 주세요.');
 recording=retimeRecording(project,recording);const particleEvents=(project.explosions||[]).flatMap(explosionParticleEvents).filter(e=>e.time<=(recording.sourceDuration??recording.duration)+1e-8).map(e=>({...e,time:recording.timeMap?recording.timeMap.toOutput(e.time):e.time}));

 const connections=(recording.connections||project.connections||[]).filter(c=>c.visible&&['rope','spring'].includes(c.kind)),objectsById=new Map(recording.objects.map(o=>[o.id,o]));
 const displayFrames=recording.frames.map(frame=>{const poses=new Map(frame.map(s=>[s.id,s]));return [...frame.filter(s=>!objectsById.get(s.id)?.virtual),...connections.flatMap(c=>connectionTransforms(c,objectsById,poses))];});
 const displayObjects=[...recording.objects.filter(o=>!o.virtual),...connections.flatMap(c=>connectionTransforms(c,objectsById,new Map(recording.frames[0].map(s=>[s.id,s]))).map(s=>connectionVisual(c,s)))];
 const folder=version.legacy?'functions':'function',base=`data/${ns}/${folder}/`,files=new Map();
 const tag=`${ns}.display`,anchor=`${ns}.anchor`,objTag=o=>`${ns}.${o.id}`;
 // Scoreboard objective names are kept below the legacy 16-character limit.
 let hash=2166136261;for(const char of ns){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}const score='vd_'+(hash>>>0).toString(16);
 const set=(name,lines)=>files.set(base+name+'.mcfunction',lines.join('\n')+'\n');
 // A selector without a spatial filter can find entities in other dimensions.
 // distance=0.. keeps each dimension pass local so one game tick advances once.
 const marker=`@e[type=minecraft:marker,tag=${anchor},distance=0..,limit=1]`;
 const select=o=>`@e[type=minecraft:${o.type==='item'?'item_display':'block_display'},tag=${objTag(o)},distance=0..,limit=1]`;
 const cleanup=[];
 for(const d of ['overworld','the_nether','the_end'])cleanup.push(`execute in minecraft:${d} run kill @e[tag=${tag},distance=0..]`,`execute in minecraft:${d} run kill @e[type=minecraft:marker,tag=${anchor},distance=0..]`);
 files.set('pack.mcmeta',JSON.stringify(packMeta(version,`${project.name} · BDphysics · Java ${version.id}`),null,2)+'\n');
 files.set(`data/minecraft/tags/${folder}/load.json`,JSON.stringify({values:[`${ns}:load`]}));
 files.set(`data/minecraft/tags/${folder}/tick.json`,JSON.stringify({values:[`${ns}:tick`]}));
 set('load',[`scoreboard objectives add ${score} dummy`,`scoreboard players set #running ${score} 0`,`scoreboard players set #tick ${score} 0`,...cleanup]);
 set('clear',[`scoreboard players set #running ${score} 0`,...cleanup]);
 const init=[`function ${ns}:clear`,`scoreboard players set #tick ${score} 0`,`summon minecraft:marker ~ ~ ~ {Tags:["${anchor}"]}`];
 displayObjects.forEach((o,i)=>{
  const metadata=entityMetadata(o),tags=[tag,objTag(o),...metadata.tags].map(t=>JSON.stringify(t)).join(',');
  const states=o.blockStates&&Object.keys(o.blockStates).length?`,${version.blockIdKey?'properties':'Properties'}:{${Object.entries(o.blockStates).map(([k,v])=>`${k}:"${v}"`).join(',')}}`:'';
  const stackModern=Array.isArray(version.format)||version.format>=41;
  const profile=o.headTexture?stackModern?`,components:{"minecraft:profile":{properties:[{name:"textures",value:"${o.headTexture}"}]}}`:` ,tag:{SkullOwner:{Properties:{textures:[{Value:"${o.headTexture}"}]}}}`:'';
  const model=o.type==='item'?`item:{id:"${o.block}",${stackModern?'count:1':'Count:1b'}${profile}},item_display:"${o.itemDisplay||'none'}"`:`block_state:{${version.blockIdKey||'Name'}:"${o.block}"${states}}`;
  init.push(`summon minecraft:${o.type==='item'?'item_display':'block_display'} ~ ~ ~ {Tags:[${tags}],${model},transformation:${snbtTransform(displayFrames[0][i],o)},interpolation_duration:1,width:0f,height:0f,view_range:2f${metadata.extra}}`);
 });
 for(const e of particleEvents)if(e.particles&&e.time===0)init.push(explosionParticleCommand(e));
 set('init',init);
 set('start',[`function ${ns}:init`,`scoreboard players set #running ${score} 1`]);
 set('pause',[`scoreboard players set #running ${score} 0`]);
 set('stop',[`function ${ns}:pause`]);
 set('resume',[`execute if score #tick ${score} matches ..${recording.ticks-1} run scoreboard players set #running ${score} 1`]);
 set('reset',[`scoreboard players set #running ${score} 0`,`scoreboard players set #tick ${score} 0`,...['overworld','the_nether','the_end'].flatMap(d=>displayObjects.map((o,i)=>`execute in minecraft:${d} run data merge entity ${select(o)} {start_interpolation:0,interpolation_duration:0,transformation:${snbtTransform(displayFrames[0][i],o)}}`))]);
 set('tick',['overworld','the_nether','the_end'].map(d=>`execute if score #running ${score} matches 1 in minecraft:${d} as ${marker} at @s run function ${ns}:advance`));
 set('advance',[`scoreboard players add #tick ${score} 1`,`function ${ns}:dispatch/root`,`execute if score #tick ${score} matches ${recording.ticks}.. run scoreboard players set #running ${score} 0`]);
 // Emit only the changed fields in their actual 20 TPS frame. Skip empty
 // frames entirely; sparse dispatch keeps pauses cheap without changing time.
 const activeTicks=[];let updates=0,changedFields=0;
 const same=(a,b)=>a.every((v,i)=>f(v)===f(b[i]));
 for(let tick=1;tick<=recording.ticks;tick++){
  const lines=[];displayObjects.forEach((o,i)=>{const state=displayFrames[tick][i],prev=displayFrames[tick-1][i];if(state.id!==o.id)throw new Error('프레임의 물체 순서가 일치하지 않습니다.');const a=displayTransform(state,state.size?{...o,size:state.size}:o),b=displayTransform(prev,prev.size?{...o,size:prev.size}:o),changes=[];for(const field of ['translation','left_rotation','scale','right_rotation'])if(!same(a[field],b[field]))changes.push(field+':'+arr(a[field]));if(!changes.length)return;lines.push(`data merge entity ${select(o)} {start_interpolation:0,interpolation_duration:1,transformation:{${changes.join(',')}}}`);updates++;changedFields+=changes.length;});
  for(const e of particleEvents)if(e.particles&&Math.max(1,Math.ceil(e.time*20-1e-8))===tick&&e.time>0)lines.push(explosionParticleCommand(e));
  if(lines.length){activeTicks.push(tick);set('frames/'+String(tick).padStart(4,'0'),lines);}
 }
 function branch(ticks,name){if(ticks.length===1){const t=ticks[0];set(name,[`execute if score #tick ${score} matches ${t} run function ${ns}:frames/${String(t).padStart(4,'0')}`]);return;}const mid=Math.ceil(ticks.length/2),left=ticks.slice(0,mid),right=ticks.slice(mid);set(name,[`execute if score #tick ${score} matches ${left[0]}..${left.at(-1)} run function ${ns}:${name}/a`,`execute if score #tick ${score} matches ${right[0]}..${right.at(-1)} run function ${ns}:${name}/b`]);branch(left,name+'/a');branch(right,name+'/b');}
 if(activeTicks.length)branch(activeTicks,'dispatch/root');else set('dispatch/root',['# Static scene: no frame updates.']);
 const commands={start:`/function ${ns}:start`,pause:`/function ${ns}:pause`,resume:`/function ${ns}:resume`,reset:`/function ${ns}:reset`,clear:`/function ${ns}:clear`};
 files.set('README.txt',`BDphysics — 물리 애니메이션 데이터팩\n대상: Minecraft Java ${version.id}\n장면: ${project.name}\n길이: ${recording.duration}초 / ${recording.ticks} ticks / 물체 ${recording.objects.length}개\n\n설치\n1. 이 ZIP을 월드의 datapacks 폴더에 넣으세요. ZIP을 풀 필요는 없습니다.\n2. /reload\n3. 바닥 위 기준점에 서서 ${commands.start}\n\n원하는 기준 좌표에서 시작하려면:\n/execute positioned 0 64 0 run function ${ns}:start\n\n일시정지: ${commands.pause}\n계속 재생: ${commands.resume}\n처음 프레임으로: ${commands.reset}\n엔티티 제거: ${commands.clear}\n\n에디터 X/Y/Z는 마인크래프트 X/Y/Z와 같습니다. 1 단위 = 1 블록.\n물리 바닥의 윗면은 기준점 Y입니다. 바닥 블록을 자동 설치하지 않습니다.\n별도의 리소스팩이나 모드가 필요하지 않습니다. 고무는 slime_block으로 표시됩니다.\n이 데이터팩은 기록한 움직임을 재생합니다. 플레이어/실제 월드와 실시간 충돌하지 않습니다.\n일반 20 TPS 기준. /tick rate를 변경하면 재생 속도가 달라집니다.\n같은 네임스페이스는 하나의 애니메이션 인스턴스만 지원합니다.\n오버월드/네더/엔드 지원. 원점 청크가 언로드되면 재생이 멈추고 로드 후 계속됩니다.\n/reload는 이 데이터팩의 재생을 멈추고 표시 엔티티를 정리합니다.\n다른 데이터팩과 함께 쓰려면 서로 다른 네임스페이스를 선택하세요.\n스냅샷/Bedrock 제외. 생성 파일 구조는 검증했으나 모든 게임 버전에서 직접 실행한 것은 아닙니다.\n\n제작 프로젝트: scene.json (BDphysics에서 다시 열 수 있음)\n`);
 const savedProject=structuredClone(project);for(const o of savedProject.objects){delete o.visualParts;delete o.colliderParts;delete o.modelSource;delete o.modelApproximate;}files.set('scene.json',JSON.stringify(savedProject)+'\n');
 return {files,commands,version,updates,changedFields,activeFrames:activeTicks.length,totalFrames:recording.ticks,score,namespace:ns};
}
export async function zipDatapack(pack,JSZip){
 const zip=new JSZip();for(const [name,content]of pack.files)zip.file(name,content);
 return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
}
