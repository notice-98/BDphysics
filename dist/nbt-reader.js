// Java edition NBT, including Java's modified UTF-8 strings.
export function readNbt(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let at=0,nodes=0;
 const fail=()=>{throw new Error('NBT 파일이 잘렸거나 형식이 잘못되었습니다.');};
 const need=n=>{if(n<0||at+n>bytes.length)fail();};
 const number=(n,method)=>{need(n);const v=view[method](at,false);at+=n;return v;};
 function string(){const n=number(2,'getUint16');need(n);const end=at+n,out=[];while(at<end){const c=bytes[at++];if(c<128)out.push(c);else if((c&224)===192){if(at>=end)fail();const b=bytes[at++];if((b&192)!==128)fail();out.push(((c&31)<<6)|(b&63));}else if((c&240)===224){if(at+1>=end)fail();const b=bytes[at++],d=bytes[at++];if((b&192)!==128||(d&192)!==128)fail();out.push(((c&15)<<12)|((b&63)<<6)|(d&63));}else if((c&248)===240){if(at+2>=end)fail();const b=bytes[at++],d=bytes[at++],e=bytes[at++];if([b,d,e].some(v=>(v&192)!==128))fail();const cp=((c&7)<<18)|((b&63)<<12)|((d&63)<<6)|(e&63);if(cp<65536||cp>0x10ffff)fail();out.push(0xd800+((cp-65536)>>10),0xdc00+((cp-65536)&1023));}else fail();}let s='';for(let i=0;i<out.length;i+=4096)s+=String.fromCharCode(...out.slice(i,i+4096));return s;}
 function length(stride=1){const n=number(4,'getInt32');if(n<0||n>8*1024*1024)fail();need(n*stride);return n;}
 function payload(type,depth){if(depth>64||++nodes>2*1024*1024)throw new Error('NBT 계층이 너무 큽니다.');switch(type){
  case 1:return number(1,'getInt8');case 2:return number(2,'getInt16');case 3:return number(4,'getInt32');case 4:return number(8,'getBigInt64');case 5:return number(4,'getFloat32');case 6:return number(8,'getFloat64');
  case 7:{const n=length(),v=bytes.subarray(at,at+n);at+=n;return v;}case 8:return string();
  case 9:{const t=number(1,'getUint8'),n=length(0);if(t>12||(!t&&n)||n>2*1024*1024)fail();return Array.from({length:n},()=>payload(t,depth+1));}
  case 10:{const o=Object.create(null);for(;;){const t=number(1,'getUint8');if(t===0)return o;if(t>12)fail();const k=string();if(Object.hasOwn(o,k))fail();o[k]=payload(t,depth+1);}}
  case 11:{const n=length(4);return Int32Array.from({length:n},()=>number(4,'getInt32'));}
  case 12:{const n=length(8);return BigUint64Array.from({length:n},()=>number(8,'getBigUint64'));}
  default:fail();
 }}
 if(number(1,'getUint8')!==10)throw new Error('건축물 NBT의 루트는 compound여야 합니다.');string();const result=payload(10,0);if(at!==bytes.length)throw new Error('NBT 뒤에 알 수 없는 데이터가 있습니다.');return result;
}
