import {clone} from './physics.js';
import {groupMembers} from './structure.js';
export function copySelection(project,ids){
 const chosen=new Set(ids),groups=(project.groups||[]).filter(g=>{const members=groupMembers(project,g.id);return members.length&&members.every(id=>chosen.has(id));}),included=new Set(groups.map(g=>g.id));
 return {gameVersion:project.gameVersion,objects:clone(project.objects.filter(o=>chosen.has(o.id))).map(o=>({...o,group:included.has(o.group)?o.group:null})),groups:clone(groups).map(g=>({...g,parent:included.has(g.parent)?g.parent:null})),events:clone(project.events.filter(e=>chosen.has(e.target)||included.has(e.target))),connections:clone((project.connections||[]).filter(c=>chosen.has(c.a)&&(!c.b||chosen.has(c.b))))};
}
export function pasteSelection(project,data,offset=[0,0,0]){
 if(data.gameVersion!==project.gameVersion)throw new Error('복사한 물체와 장면의 마인크래프트 버전을 맞추세요.');
 let bodyId=Math.max(0,...project.objects.map(o=>Number(o.id.slice(1)))),groupId=Math.max(0,...(project.groups||[]).map(g=>Number(g.id.slice(1)))),eventId=Math.max(0,...project.events.map(e=>Number(e.id.slice(1))));
 const bodies=new Map(data.objects.map(o=>[o.id,'b'+(++bodyId)])),groups=new Map(data.groups.map(g=>[g.id,'g'+(++groupId)]));
 const objects=clone(data.objects).map(o=>({...o,id:bodies.get(o.id),name:o.name+' 복제',group:groups.get(o.group)||null,position:o.position.map((v,i)=>v+offset[i]),keys:o.keys?.map(k=>({...k,position:k.position.map((v,i)=>v+offset[i])}))}));
 let connectionId=Math.max(0,...(project.connections||[]).map(c=>Number(c.id.slice(1))));
 project.connections||=[];project.connections.push(...clone(data.connections||[]).map(c=>({...c,id:'c'+(++connectionId),a:bodies.get(c.a),b:c.b?bodies.get(c.b):null,groupA:groups.get(c.groupA)||null,groupB:groups.get(c.groupB)||null,worldPoint:c.worldPoint.map((v,i)=>v+offset[i])})));
 project.objects.push(...objects);project.groups.push(...clone(data.groups).map(g=>({...g,id:groups.get(g.id),name:g.name+' 복제',parent:groups.get(g.parent)||null})));project.events.push(...clone(data.events).map(e=>({...e,id:'f'+(++eventId),target:bodies.get(e.target)||groups.get(e.target)})));return objects.map(o=>o.id);
}
export function ungroupSelection(project,ids,groupId=null){
 const selected=new Set(ids),groups=project.groups||[],id=groupId||project.objects.find(o=>selected.has(o.id)&&o.group)?.group;
 if(!id)return;const group=groups.find(g=>g.id===id);if(!group)return;
 for(const o of project.objects)if(o.group===id)o.group=group.parent||null;for(const child of groups)if(child.parent===id)child.parent=group.parent||null;project.groups=groups.filter(g=>g.id!==id);project.events=project.events.filter(e=>e.target!==id);
}
