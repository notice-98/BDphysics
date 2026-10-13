import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {headItemModel,normalizeTextureValue} from '../dist/head-textures.js';
import {ModelRenderer} from '../dist/model-renderer.js';
import {preset,object,quaternionFromEuler} from '../dist/physics.js';
import {generateDatapack,VERSIONS} from '../dist/exporter.js';
const a=normalizeTextureValue('https://textures.minecraft.net/texture/'+'a'.repeat(64)),b=normalizeTextureValue('https://textures.minecraft.net/texture/'+'b'.repeat(64));
const calls=[],part=color=>({c:[0,0,0],s:[.5,.5,.5],q:[0,0,0,1],color}),ready={parts:[part('#0000ff')]},draft={parts:[part('#00ff00')]};
const assets={key:'heads',version:'26.3',headItem:async(...args)=>{calls.push(['ready',...args]);return ready;},paintedHead:async(...args)=>{calls.push(['draft',...args]);return draft;},item:async(...args)=>{calls.push(['plain',...args]);return ready;}};
const head={type:'item',block:'minecraft:player_head',headSkin:'data:image/png;base64,draft',headTexture:a,headNeedsBake:false,itemDisplay:'none',headSecondLayer:false,visualParts:[part('#ff0000')]};
assert.equal(await headItemModel(assets,head),ready);assert.deepEqual(calls.pop(),['ready',head.block,a,'none',false]);assert.equal(await headItemModel(assets,{...head,headNeedsBake:true}),draft);assert.equal(calls.pop()[0],'draft');assert.equal(await headItemModel(assets,{...head,headTexture:null}),draft);assert.equal(calls.pop()[0],'draft');
const oldDocument=globalThis.document;globalThis.document={createElement:()=>({width:16,height:16,getContext:()=>({fillRect(){}})})};
try{const renderer=new ModelRenderer(),root=new THREE.Group();await renderer.fill(root,head,assets,{});assert.equal(root.userData.parts,ready.parts,'registered source replaces stale local visualParts');await renderer.fill(root,{...head,headNeedsBake:true},assets,{});assert.equal(root.userData.parts,draft.parts,'registration state invalidates the cached source');renderer.disposeRoot(root);}finally{if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;}
const p=preset('empty');p.objects=[object('b1','wood',[0,1,0],{type:'item',block:'minecraft:player_head',headTexture:a,headSkin:head.headSkin,headNeedsBake:false,playerPart:'body'}),object('b2','wood',[0,2,0],{type:'item',block:'minecraft:player_head',headTexture:b,headSkin:head.headSkin,headNeedsBake:false,playerPart:'head'})];const recording={fps:20,ticks:0,duration:0,objects:p.objects,frames:[p.objects.map(o=>({id:o.id,p:o.position,q:quaternionFromEuler(o.rotation)}))]};
for(const version of VERSIONS){const pack=generateDatapack(p,recording,{namespace:'part_textures',version:version.id});const init=pack.files.get('data/part_textures/'+(version.legacy?'functions':'function')+'/init.mcfunction');const summons=init.split('\n').filter(l=>l.startsWith('summon minecraft:item_display'));assert.equal(summons.length,2);assert(summons[0].includes(a));assert(!summons[0].includes(b));assert(summons[1].includes(b));assert(!summons[1].includes(a));}
p.objects[0].headNeedsBake=true;assert.throws(()=>generateDatapack(p,recording,{namespace:'part_textures'}),/미등록/);
console.log('PASS registered-head preview ignores stale PNG geometry, draft state refreshes, and 25 exporters retain distinct per-part textures and reject drafts');
