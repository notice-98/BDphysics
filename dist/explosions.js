export function validateExplosions(project){
 const explosions=project.explosions||[],ids=new Set(),n=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
 if(!Array.isArray(explosions)||explosions.length>32)throw new Error('폭발은 32개까지 지원합니다.');
 for(const e of explosions){
  if(!/^x[1-9]\d{0,5}$/.test(e.id)||ids.has(e.id)||!Array.isArray(e.position)||e.position.length!==3||!e.position.every(v=>n(v,-4096,4096))||!n(e.time,0,project.duration)||!n(e.radius,.1,128)||!n(e.strength,.01,100000)||typeof e.particles!=='boolean'||e.particleSize!=null&&!n(e.particleSize,.1,8)||e.particleCount!=null&&(!Number.isInteger(e.particleCount)||!n(e.particleCount,1,64))||e.particleSpeed!=null&&!n(e.particleSpeed,0,64))throw new Error('폭발 속성이 지원 범위를 벗어났습니다.');
  ids.add(e.id);
 }
}
export function explosionImpulse(explosion,position){
 const delta=position.map((v,i)=>v-explosion.position[i]),distance=Math.hypot(...delta);
 if(distance>=explosion.radius)return [0,0,0];
 const direction=distance>1e-6?delta.map(v=>v/distance):[0,1,0],strength=explosion.strength*(1-distance/explosion.radius)**2;
 return direction.map(v=>v*strength);
}
export function explosionParticleCommand(explosion){
 const position=explosion.position.map(v=>'~'+(v?Number(v.toFixed(5)):'')).join(' ');
 // Count zero passes delta * speed directly to the vanilla particle provider.
 // HugeExplosionParticle.quadSize = 2 * (1 - xSpeed * .5).
 const size=explosion.particleSize??1,parameter=Number((2*(1-size)).toFixed(6));
 return `particle minecraft:explosion ${position} ${parameter} 0 0 1 0 force`;
}

export function explosionParticleEvents(e){const count=e.particleCount??12,speed=e.particleSpeed??6;return Array.from({length:count},(_,i)=>{const delay=count===1?0:Math.floor(i/8)*.05,y=1-2*(i+.5)/count,r=Math.sqrt(1-y*y),angle=i*2.3999632297,distance=count===1?0:speed*(delay+.05),direction=[r*Math.cos(angle),y,r*Math.sin(angle)];return {...e,time:Math.round((e.time+delay)*20)/20,position:e.position.map((v,k)=>v+direction[k]*distance)};});}
