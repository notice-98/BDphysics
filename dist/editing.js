import {quaternionFromEuler,rotateVector} from './physics.js';
import {shapeParts,visualParts} from './shapes.js';
export const PIXEL=1/16,MOVE_STEP=PIXEL/2,FINE_STEP=PIXEL/16;
export const clamp=(v,min=-4096,max=4096)=>Math.max(min,Math.min(max,v));
export const snap=(v,step=MOVE_STEP)=>Number((Math.round(v/step)*step).toFixed(10));
export const nudge=(v,sign,step=MOVE_STEP)=>Number(((sign>0?Math.floor(v/step+1e-7)+1:Math.ceil(v/step-1e-7)-1)*step).toFixed(10));
export const snapDelta=(v,anchor,step=MOVE_STEP)=>anchor+Math.round((v-anchor)/step)*step;
export function worldBounds(o,parts=visualParts(o).length?visualParts(o):shapeParts(o)){const q=quaternionFromEuler(o.rotation),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const p of parts)for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){const v=rotateVector([x*p.s[0]/2,y*p.s[1]/2,z*p.s[2]/2],p.q).map((v,i)=>(v+p.c[i])*o.size[i]*(o.mirror?.[i]||1)),world=rotateVector(v,q).map((v,i)=>v+o.position[i]);for(let i=0;i<3;i++){min[i]=Math.min(min[i],world[i]);max[i]=Math.max(max[i],world[i]);}}return {min,max};}
// A detent catches contact once per gesture, then releases continuously after
// two pixels of extra movement. No jump is introduced by the original overshoot.
export class FloorDetent{
 constructor(start,contact,release=2*PIXEL){this.previous=start;this.contact=contact;this.release=release;this.used=false;this.holding=false;this.offset=0;this.armed=Math.abs(start-contact)>MOVE_STEP;}
 update(desired){if(this.holding){const extra=desired-this.entry;if(Math.abs(extra)<=this.release)return this.contact;this.holding=false;this.offset=this.contact-this.entry-Math.sign(extra)*this.release;}const value=desired+this.offset;if(!this.used){if(!this.armed&&Math.abs(value-this.contact)>MOVE_STEP)this.armed=true;else if(this.armed&&((this.previous-this.contact)*(value-this.contact)<=0||Math.abs(value-this.contact)<MOVE_STEP/2)){this.used=true;this.holding=true;this.entry=desired;this.previous=this.contact;return this.contact;}}this.previous=value;return value;}
}
