const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');
let time=2000,timers=new Map(),nextTimer=1;
const noop=()=>{};const gradient={addColorStop:noop};const context=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(o,p)=>p in o?o[p]:noop,set:(o,p,v)=>(o[p]=v,true)});
class El{constructor(){this.dataset={};this.style={};this.hidden=false;this.attributes={};this.handlers={};this.clientWidth=1024;this.clientHeight=500;this.classList={add:noop,remove:noop,toggle:noop};}getContext(){return context}getBoundingClientRect(){return {left:0,top:0,width:this.clientWidth,height:this.clientHeight}}addEventListener(t,fn){(this.handlers[t]??=[]).push(fn)}emit(t,e={}){for(const f of this.handlers[t]??[])f({preventDefault:noop,pointerId:1,pointerType:'touch',...e})}setAttribute(k,v){this.attributes[k]=v}setPointerCapture(){}hasPointerCapture(){return true}releasePointerCapture(){}focus(){}querySelector(){return new El()}}
const ids=Object.fromEntries(['#scene','#hint-text','#hint-sub','#sound','#welcome','#start','#done','#again','.hint'].map(x=>[x,new El()]));
const tools=['soap','water','dry'].map(t=>Object.assign(new El(),{dataset:{tool:t}}));const cars=['car','fire','digger'].map(t=>Object.assign(new El(),{dataset:{car:t}}));const pips=[new El(),new El(),new El()];
const doc={querySelector:s=>ids[s],querySelectorAll:s=>s==='.tool'?tools:s==='.vehicle'?cars:pips,addEventListener:noop,hidden:false};
const window={matchMedia:()=>({matches:false}),devicePixelRatio:1,addEventListener:noop};
const sandbox={window,document:doc,localStorage:{getItem:()=>null,setItem:noop},performance:{now:()=>time},requestAnimationFrame:noop,ResizeObserver:class{constructor(fn){this.fn=fn}observe(){this.fn()}},setTimeout:(fn)=>{const id=nextTimer++;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id),console,Math,CanvasRenderingContext2D:class{}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync('dist/game.js','utf8'),sandbox);
const state=()=>window.carBathState;const flush=()=>{time+=500;for(const [id,fn]of timers){timers.delete(id);fn()}};
const event=(x,y,pointerId=1)=>{const s=state().canvas;return {clientX:(s.carX+x*s.carScale)/1200*ids['#scene'].clientWidth,clientY:(s.carY+y*s.carScale)/s.height*ids['#scene'].clientHeight,pointerId,pointerType:'touch'}};
const tap=(x,y,id=1)=>{ids['#scene'].emit('pointerdown',event(x,y,id));ids['#scene'].emit('pointerup',event(x,y,id));};
const stroke=(y)=>{ids['#scene'].emit('pointerdown',event(-320,y));for(let x=-280;x<=320;x+=40)ids['#scene'].emit('pointermove',event(x,y));ids['#scene'].emit('pointerup',event(320,y));};
function fullWash(){for(let n=0;n<3;n++){stroke(-100);stroke(0);stroke(60);flush();assert.equal(state().stage,n+1,`phase ${n+1} reached`);}assert.equal(state().complete,true);assert.equal(state().coverage.dry,1);}
assert.equal(state().started,false);tap(0,0);assert.equal(state().coverage.soap,0,'must start explicitly');ids['#start'].emit('click');assert.equal(state().started,true);
for(const car of cars){car.emit('click');assert.equal(state().stage,0);assert.equal(state().car,car.dataset.car);fullWash();ids['#again'].emit('click');assert.equal(state().stage,0);assert.equal(state().complete,false);assert.equal(state().coverage.soap,0);}
// Wrong-order tools do not corrupt the wash or penalize the child.
tools[2].emit('click');tap(0,0);assert.equal(state().stage,0);assert.equal(state().coverage.dry,0);tools[1].emit('click');tap(0,0);assert.equal(state().coverage.water,0);tools[0].emit('click');fullWash();
// Two-finger input and canceled pointer gestures leave no stuck tool.
ids['#again'].emit('click');ids['#scene'].emit('pointerdown',event(-100,0,3));ids['#scene'].emit('pointerdown',event(150,0,4));assert.equal(state().pointers,2);ids['#scene'].emit('pointercancel',event(-100,0,3));ids['#scene'].emit('pointerup',event(150,0,4));assert.equal(state().pointers,0);
// Switch cars during the deferred transition; stale transition must not change the new car.
stroke(-100);stroke(0);cars[1].emit('click');flush();assert.equal(state().stage,0);assert.equal(state().tool,'soap');assert.equal(state().car,'fire');
ids['#sound'].emit('click');assert.equal(state().muted,true);ids['#sound'].emit('click');assert.equal(state().muted,false);
// Complete the same car twice, and keyboard alternative remains functional.
fullWash();ids['#again'].emit('click');for(let n=0;n<30&&!state().complete;n++){ids['#scene'].emit('keydown',{key:'Enter'});flush();}assert.equal(state().complete,true);
console.log('PASS: three car types, 3 cleaning phases, repeat play, out-of-order tools, touch taps/drags, simultaneous pointers, pointer cancel, mid-transition car change, mute toggle, keyboard alternative.');
