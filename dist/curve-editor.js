import {EASING_PRESETS,easeProgress} from './easing.js';
export function createCurveEditor(dialog,apply){
 const $=id=>dialog.querySelector('#'+id),svg=$('curveGraph'),inputs=[...dialog.querySelectorAll('[data-curve-value]')];let curve=[0,0,1,1],target=null,drag=null;
 const px=x=>40+x*220,py=y=>260-y*220;
 $('curvePresets').innerHTML=EASING_PRESETS.map((p,i)=>'<button type="button" data-curve-preset="'+i+'">'+p.name+'</button>').join('');
 function render(){
 $('curvePath').setAttribute('d','M40 260 C'+px(curve[0])+' '+py(curve[1])+','+px(curve[2])+' '+py(curve[3])+',260 40');
 for(let i=0;i<2;i++){const n=i*2,p=$('curvePoint'+i),line=$('curveHandle'+i);p.setAttribute('cx',px(curve[n]));p.setAttribute('cy',py(curve[n+1]));p.setAttribute('aria-label','제어점 '+(i+1)+' · '+curve[n].toFixed(2)+', '+curve[n+1].toFixed(2));line.setAttribute('x2',px(curve[n]));line.setAttribute('y2',py(curve[n+1]));}
 inputs.forEach((input,i)=>input.value=Number(curve[i].toFixed(3)));
 for(const b of $('curvePresets').querySelectorAll('button'))b.classList.toggle('active',EASING_PRESETS[+b.dataset.curvePreset].curve.every((v,i)=>Math.abs(curve[i]-v)<.001));
 $('curveSample').style.left=(easeProgress(.5,curve)*100)+'%';
 }
 function move(e){if(drag==null)return;const pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());curve[drag*2]=Math.max(0,Math.min(1,(pt.x-40)/220));curve[drag*2+1]=Math.max(0,Math.min(1,(260-pt.y)/220));render();}
 svg.addEventListener('pointerdown',e=>{const point=e.target.closest('[data-control]');if(!point||e.button!==0)return;e.preventDefault();drag=+point.dataset.control;svg.setPointerCapture(e.pointerId);move(e);});
 svg.addEventListener('pointermove',move);for(const name of ['pointerup','pointercancel'])svg.addEventListener(name,()=>drag=null);
 for(const p of svg.querySelectorAll('[data-control]'))p.addEventListener('keydown',e=>{const axes={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowDown:[1,-1],ArrowUp:[1,1]},step=axes[e.key];if(!step)return;e.preventDefault();const index=+p.dataset.control*2+step[0];curve[index]=Math.max(0,Math.min(1,curve[index]+step[1]*(e.shiftKey?.001:.01)));render();});
 inputs.forEach((input,i)=>input.onchange=()=>{const value=Number(input.value);if(Number.isFinite(value))curve[i]=Math.max(0,Math.min(1,value));render();});
 $('curvePresets').onclick=e=>{const b=e.target.closest('[data-curve-preset]');if(b){curve=EASING_PRESETS[+b.dataset.curvePreset].curve.slice();render();}};
 $('curveApply').onclick=()=>{if(apply(target,curve.slice()))dialog.close();};
 $('curveCancel').onclick=()=>dialog.close();
 return {open(info,value){target=info;curve=value?.slice()||[0,0,1,1];render();dialog.showModal();},close:()=>dialog.close()};
}
