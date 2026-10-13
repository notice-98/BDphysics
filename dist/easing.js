export const EASING_PRESETS=[
 {name:'일정한 속도',curve:[0,0,1,1]},
 {name:'부드럽게',curve:[.25,.1,.25,1]},
 {name:'천천히 시작',curve:[.42,0,1,1]},
 {name:'천천히 끝',curve:[0,0,.58,1]},
 {name:'양끝 부드럽게',curve:[.42,0,.58,1]},
 {name:'빠르게 전환',curve:[.8,0,.2,1]}
];
export const validEasing=c=>c==null||Array.isArray(c)&&c.length===4&&c.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1);
const cubic=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
export function easeProgress(progress,curve){const x=Math.max(0,Math.min(1,progress));if(!curve||x===0||x===1||curve[0]===curve[1]&&curve[2]===curve[3])return x;let low=0,high=1,t=x;for(let i=0;i<28;i++){const value=cubic(t,curve[0],curve[2]);if(Math.abs(value-x)<1e-8)break;if(value<x)low=t;else high=t;t=(low+high)/2;}return cubic(t,curve[1],curve[3]);}
