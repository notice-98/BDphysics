import {rotateParts} from './affine.js';
export const UNIT_BOX={c:[0,0,0],s:[1,1,1],q:[0,0,0,1]};
export const shapeParts=o=>rotateParts(o.customColliders||o.colliderParts||[UNIT_BOX],o.rightRotation);
export const visualParts=o=>o.visualParts?rotateParts(o.visualParts,o.rightRotation):shapeParts(o);
export const boxPart=b=>({c:[(b[0]+b[3])/2-0.5,(b[1]+b[4])/2-0.5,(b[2]+b[5])/2-0.5],s:[b[3]-b[0],b[4]-b[1],b[5]-b[2]],q:[0,0,0,1]});
export function stateValues(state){return state.type==='bool'?['true','false']:state.values?state.values.map(String):Array.from({length:state.num_values},(_,i)=>String(i));}
export function decodeState(block,index=block.defaultState-block.minStateId){const values={};for(const s of [...(block.states||[])].reverse()){const v=stateValues(s);values[s.name]=v[index%v.length];index=Math.floor(index/v.length);}return values;}
export function encodeState(block,properties){let index=0;for(const s of block.states||[]){const values=stateValues(s),i=values.indexOf(String(properties[s.name]));if(i<0)throw new Error('잘못된 블록 상태: '+s.name);index=index*values.length+i;}return index;}
export function resolveBlockShape(catalog,block,properties){
 const index=encodeState(block,properties),ids=catalog.collision.blocks[block.name],id=Array.isArray(ids)?ids[index]:ids;
 if(id===undefined||!catalog.collision.shapes[id])throw new Error('이 블록 상태의 충돌 데이터가 없습니다.');
 return catalog.collision.shapes[id].filter(b=>[0,1,2].every(i=>b[i+3]>b[i])).map(boxPart);
}
export async function loadCatalog(version){
 const manifest=await fetch('./data/catalog.json').then(r=>{if(!r.ok)throw new Error('블록 데이터 파일을 불러올 수 없습니다.');return r.json();});
 const profile=manifest.versions[version];if(!profile)throw new Error('이 버전의 블록 충돌 데이터는 아직 준비되지 않았습니다. 내보내기 형식은 지원합니다.');
 const [blocks,collision,items]=await Promise.all([profile.blocks,profile.collision,profile.items].map(file=>fetch('./data/'+file).then(r=>{if(!r.ok)throw new Error('충돌 데이터 로딩 실패');return r.json();})));
 return {blocks,collision,items,version,source:manifest.source,profile};
}
