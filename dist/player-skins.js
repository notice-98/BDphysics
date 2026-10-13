export async function lookupPlayer(nickname,{fetcher=fetch,signal}={}){
 const name=nickname.trim();
 if(!/^[A-Za-z0-9_]{1,16}$/.test(name))throw new Error('마인크래프트 닉네임을 입력하세요.');
 const timeout=AbortSignal.timeout(20000),requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
 let response;try{response=await fetcher('https://playerdb.co/api/player/minecraft/'+encodeURIComponent(name),{signal:requestSignal});}catch(e){if(signal?.aborted)throw e;throw new Error('닉네임을 조회하지 못했습니다. 잠시 뒤 다시 시도하세요.');}
 const data=await response.json(),p=data.data?.player;
 if(!response.ok||!data.success||!p||!/^([a-f0-9]{32}|[a-f0-9-]{36})$/i.test(p.id))throw new Error('해당 닉네임의 플레이어를 찾을 수 없습니다.');
 let variant='classic';const properties=p.properties||p.meta?.properties||p.raw?.properties||[];
 try{const value=properties.find(v=>v.name==='textures')?.value,skin=value&&JSON.parse(atob(value)).textures?.SKIN;if(skin?.metadata?.model==='slim')variant='slim';}catch{}
 return {name:p.username||name,id:p.id,variant,url:'https://mc-heads.net/skin/'+p.id.replaceAll('-','')};
}
export async function skinCanvas(source){
 const img=await new Promise((resolve,reject)=>{const image=new Image();image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('스킨 이미지를 불러올 수 없습니다.'));image.src=source;});
 if(img.width!==64||![32,64].includes(img.height))throw new Error('스킨은 64×64 또는 64×32 PNG여야 합니다.');
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(img,0,0);
 if(img.height===32)for(const [from,to]of [[[40,16],[32,48]],[[0,16],[16,48]]]){const [u,v]=from,[tu,tv]=to;for(const [x,y,w,h,tx,ty]of [[4,0,4,4,4,0],[8,0,4,4,8,0],[0,4,4,12,8,4],[4,4,4,12,4,4],[8,4,4,12,0,4],[12,4,4,12,12,4]]){ctx.save();ctx.translate(tu+tx+w,tv+ty);ctx.scale(-1,1);ctx.drawImage(img,u+x,v+y,w,h,0,0,w,h);ctx.restore();}}
 return canvas;
}
