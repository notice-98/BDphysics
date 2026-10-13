import {BUILDING_EXTENSIONS,decodeBuilding} from './building-import.js';
const MAGIC=new TextEncoder().encode('BDPH1\n'),LIMIT=32*1024*1024;
async function streamBytes(stream){const reader=stream.getReader(),chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>LIMIT)throw new Error('프로젝트 압축 해제 크기는 32 MB까지 지원합니다.');chunks.push(value);}}finally{reader.releaseLock();}const out=new Uint8Array(size);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}return out;}
async function gunzip(bytes){return streamBytes(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')));}
export async function encodeProject(project){const value={format:'bdphysics',formatVersion:1,project};const bytes=await streamBytes(new Blob([JSON.stringify(value)]).stream().pipeThrough(new CompressionStream('gzip')));return new Blob([MAGIC,bytes],{type:'application/octet-stream'});}
export async function decodeProjectFile(file){
 if(file.size>LIMIT)throw new Error('프로젝트 파일은 32 MB까지 지원합니다.');let bytes=new Uint8Array(await file.arrayBuffer()),native=false;if(BUILDING_EXTENSIONS.test(file.name)||bytes[0]===10&&(bytes[1]===0||bytes[1]===229))return decodeBuilding(bytes,file.name);
 if(MAGIC.every((v,i)=>bytes[i]===v)){native=true;bytes=await gunzip(bytes.subarray(MAGIC.length));}
 else if(bytes[0]===31&&bytes[1]===139)bytes=await gunzip(bytes);
 else {const text=new TextDecoder().decode(bytes).trim();if(!text.startsWith('[')&&!text.startsWith('{')&&!text.startsWith('PRJ2')){if(!/^[A-Za-z0-9+/=\s]+$/.test(text))throw new Error('지원하지 않는 프로젝트 파일입니다.');bytes=Uint8Array.from(atob(text.replace(/\s/g,'')),c=>c.charCodeAt(0));if(bytes[0]===31&&bytes[1]===139)bytes=await gunzip(bytes);}}
 if(new TextDecoder().decode(bytes.subarray(0,4))==='PRJ2'){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(bytes.length<9||bytes[4]!==1)throw new Error('지원하지 않는 BDEngine 파일 버전입니다.');const count=view.getUint32(5,true);if(count>512)throw new Error('BDEngine 파일 항목이 너무 많습니다.');let offset=9,scene;
  const require=n=>{if(offset+n>bytes.length)throw new Error('BDEngine 파일이 잘렸습니다.');};
  for(let i=0;i<count;i++){require(2);const size=view.getUint16(offset,true);offset+=2;require(size+4);const name=new TextDecoder().decode(bytes.subarray(offset,offset+size));offset+=size;const length=view.getUint32(offset,true);offset+=4;require(length);if(name==='scene.json')scene=bytes.subarray(offset,offset+length);offset+=length;}if(!scene||offset!==bytes.length)throw new Error('BDEngine 장면을 찾을 수 없습니다.');bytes=scene;
 }
 const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(native||value.format==='bdphysics'){if(value.format!=='bdphysics'||value.formatVersion!==1||!value.project)throw new Error('지원하지 않는 BDphysics 파일 버전입니다.');return {kind:'native',project:value.project};}
 if(value.schema==='voxel-dynamics/1')return {kind:'native',project:value};
 return {kind:'bde',tree:Array.isArray(value)?value:[value]};
}
