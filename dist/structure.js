export function groupChildren(project,id){return (project.groups||[]).filter(g=>g.parent===id);}
export function groupMembers(project,id){
 const out=project.objects.filter(o=>o.group===id).map(o=>o.id);
 for(const g of groupChildren(project,id))out.push(...groupMembers(project,g.id));return out;
}
export function groupDepth(project,id){let n=0,g=(project.groups||[]).find(g=>g.id===id);while(g?.parent){n++;g=project.groups.find(x=>x.id===g.parent);if(n>16)break;}return n;}
export function groupAncestors(project,object){const result=[];let id=object.group;while(id){const g=(project.groups||[]).find(g=>g.id===id);if(!g)break;result.unshift(g);id=g.parent;}return result;}
export function validateGroups(project){
 const groups=project.groups||[];if(!Array.isArray(groups)||groups.length>64)throw new Error('묶음은 64개까지 지원합니다.');
 const ids=new Set(groups.map(g=>g.id));if(ids.size!==groups.length)throw new Error('묶음 ID가 중복되었습니다.');
 for(const g of groups){
  if(g.articulated!=null&&typeof g.articulated!=='boolean')throw new Error('그룹 관절 설정이 잘못되었습니다.');
  if(!/^g[1-9]\d{0,5}$/.test(g.id)||typeof g.name!=='string'||g.name.length>80||!Number.isFinite(g.threshold)||g.threshold<0||g.threshold>1e6||!(g.releaseTime===null||(Number.isFinite(g.releaseTime)&&g.releaseTime>=0&&g.releaseTime<=project.duration)))throw new Error('묶음 설정이 잘못되었습니다.');
  if(g.parent!==null&&!ids.has(g.parent))throw new Error('상위 묶음이 존재하지 않습니다.');
  let id=g.parent,visited=new Set([g.id]);while(id){if(visited.has(id))throw new Error('묶음의 순환 연결은 만들 수 없습니다.');visited.add(id);id=groups.find(x=>x.id===id).parent;if(visited.size>16)throw new Error('계층은 16단계까지 지원합니다.');}
 }
 for(const o of project.objects)if(o.group!=null&&!ids.has(o.group))throw new Error('물체의 소속 묶음이 존재하지 않습니다.');
}
export function newGroup(project,selection,parent=null){
 const selected=new Set(selection);if(selected.size<2)throw new Error('Shift를 누르고 물체를 2개 이상 선택해 주세요.');
 if(parent&&[...selected].some(id=>!groupMembers(project,parent).includes(id)))throw new Error('하위 묶음은 선택한 상위 묶음 안의 물체로 만들어 주세요.');
 project.groups||=[];
 const id='g'+(Math.max(0,...project.groups.map(g=>+g.id.slice(1)))+1);
 const g={id,name:parent?'작은 조각 '+id.slice(1):'구조 묶음 '+id.slice(1),parent,threshold:parent?25:75,releaseTime:null};
 const complete=project.groups.filter(x=>x.id!==parent&&groupMembers(project,x.id).length>0&&groupMembers(project,x.id).every(id=>selected.has(id)));
 const adopt=complete.filter(x=>!complete.some(y=>y.id===x.parent));
 const adoptedIds=new Set(adopt.flatMap(x=>groupMembers(project,x.id)));
 for(const x of adopt)x.parent=id;
 for(const o of project.objects)if(selected.has(o.id)&&!adoptedIds.has(o.id))o.group=id;
 project.groups.push(g);return id;
}

export function pruneEmptyGroups(project){validateGroups(project);const keep=new Set();for(const o of project.objects){let id=o.group;while(id){keep.add(id);id=project.groups.find(g=>g.id===id)?.parent;}}project.groups=(project.groups||[]).filter(g=>keep.has(g.id));for(const c of project.connections||[]){if(c.groupA&&!keep.has(c.groupA))c.groupA=null;if(c.groupB&&!keep.has(c.groupB))c.groupB=null;}project.events=project.events.filter(e=>!e.target.startsWith('g')||keep.has(e.target));return project;}
