const directions=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){const n=Math.abs(x)+Math.abs(y)+Math.abs(z);if(n===1||n===2)directions.push([x,y,z].map(v=>v/Math.sqrt(n)));}
// Catch each cardinal or 45-degree direction once, with a wider release angle.
export class DirectionDetent{
 constructor(){this.used=new Set();this.index=null;this.holding=false;}
 update(vector,enabled=true){const length=Math.hypot(...vector);this.holding=false;if(!enabled||length<.02){if(this.index!=null)this.used.add(this.index);this.index=null;return vector;}const unit=vector.map(v=>v/length),dot=d=>d.reduce((n,v,i)=>n+v*unit[i],0);if(this.index!=null&&dot(directions[this.index])<Math.cos(6*Math.PI/180)){this.used.add(this.index);this.index=null;}if(this.index==null){let best=Math.cos(3*Math.PI/180);directions.forEach((d,i)=>{const value=dot(d);if(!this.used.has(i)&&value>best){best=value;this.index=i;}});}if(this.index==null)return vector;this.holding=true;return directions[this.index].map(v=>v*length);}
 get label(){if(this.index==null)return '';const d=directions[this.index],n=d.filter(v=>v!==0).length;return n===2?'45°':d[1]?'수직':'수평';}
}

// Catch component zero on every axis, even when the vector is far from a cardinal direction.
export class ComponentDetent{
 constructor(initial,release=.125){this.axes=initial.map(v=>({previous:v,armed:Math.abs(v)>.03125,used:false,holding:false,offset:0}));this.release=release;this.holding=false;this.label='';}
 update(vector,axis='XYZ',enabled=true){this.holding=false;const held=[];const result=vector.map((desired,i)=>{const s=this.axes[i];if(!enabled){if(s.holding)s.used=true;s.holding=false;s.offset=0;s.previous=desired;return desired;}if(!axis.includes('XYZ'[i]))return desired;if(s.holding){const extra=desired-s.entry;if(Math.abs(extra)<=this.release){held.push('XYZ'[i]);return 0;}s.holding=false;s.offset=-s.entry-Math.sign(extra)*this.release;}const value=desired+s.offset;if(!s.used){if(!s.armed&&Math.abs(value)>.03125)s.armed=true;else if(s.armed&&(s.previous*value<=0||Math.abs(value)<.015625)){s.used=s.holding=true;s.entry=desired;s.previous=0;held.push('XYZ'[i]);return 0;}}s.previous=value;return value;});this.holding=held.length>0;this.label=held.map(a=>a+' = 0').join(' · ');return result;}
}
