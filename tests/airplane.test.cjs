const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const test=require('node:test');
class Element {
 constructor(rect={left:0,top:0,width:900,height:650}){this.rect=rect;this.listeners={};this.attrs={};this.style={};this.hidden=false;this.disabled=false;this.classes=new Set();this.classList={add:(...xs)=>xs.forEach(x=>this.classes.add(x)),remove:(...xs)=>xs.forEach(x=>this.classes.delete(x))};}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 fire(name,event={}){if(name==='click'&&this.disabled)return;for(const fn of this.listeners[name]||[])fn(event);}
 setAttribute(k,v){this.attrs[k]=v;}
 getBoundingClientRect(){return this.rect;}
 setPointerCapture(id){this.captured=id;}
}
function setup(){
 const ids={},clouds=[new Element({left:90,top:150,width:180,height:140}),new Element({left:630,top:220,width:180,height:140}),new Element({left:360,top:50,width:180,height:140})],dots=Array.from({length:3},()=>new Element()),timers=new Map(),storage=new Map();let timerId=0;
 const document={getElementById:id=>ids[id]??=new Element(),querySelectorAll:q=>q==='.cloud'?clouds:dots,addEventListener(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/airplane.js'),'utf8'),{document,window:{addEventListener(){}},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),Math,Set,String});
 return {ids,clouds,dots,storage,start(){ids.start.fire('click')},flush(){for(const [id,fn]of [...timers]){timers.delete(id);fn()}},pointer(name,id,x,y){ids.plane.fire(name,{pointerId:id,clientX:x,clientY:y})}};
}
test('start gate, three clouds, rainbow, and repeat loop',()=>{const s=setup();assert(s.clouds.every(c=>c.disabled));assert(s.ids.plane.disabled);s.start();assert(s.ids.intro.hidden);for(const c of s.clouds){c.fire('click');s.flush()}assert(s.ids.rainbow.classes.has('show'));assert(!s.ids.again.hidden);assert(s.dots.every(d=>d.classes.has('done')));s.ids.again.fire('click');assert(s.ids.again.hidden);assert(!s.ids.rainbow.classes.has('show'));assert(s.dots.every(d=>!d.classes.has('done')));s.ids.plane.fire('click');s.flush();assert(s.clouds[0].classes.has('visited'));});
test('plane tap visits next cloud and repeated busy input is ignored',()=>{const s=setup();s.start();s.ids.plane.fire('click');s.clouds[1].fire('click');s.flush();assert(s.clouds[0].classes.has('visited'));assert(!s.clouds[1].classes.has('visited'));s.ids.plane.fire('click');s.flush();assert(s.clouds[1].classes.has('visited'));});
test('pointer drag into a cloud completes once, suppresses synthetic click',()=>{const s=setup();s.start();s.pointer('pointerdown',1,450,481);s.pointer('pointermove',1,180,220);assert(s.ids.plane.classes.has('dragging'));s.pointer('pointerup',1,180,220);s.ids.plane.fire('click');s.flush();assert(s.clouds[0].classes.has('visited'));assert(!s.clouds[1].classes.has('visited'));assert(!s.ids.plane.classes.has('dragging'));});
test('cancelled drag returns home with no progress and allows a new drag',()=>{const s=setup();s.start();s.pointer('pointerdown',1,450,481);s.pointer('pointermove',1,180,220);s.pointer('pointercancel',1,180,220);s.flush();assert(s.clouds.every(c=>!c.classes.has('visited')));assert.equal(s.ids.plane.style.left,'50%');assert.equal(s.ids.plane.style.top,'74%');assert(!s.ids.plane.classes.has('dragging'));s.pointer('pointerdown',2,450,481);s.pointer('pointermove',2,720,290);s.pointer('pointerup',2,720,290);s.flush();assert(s.clouds[1].classes.has('visited'));});
test('secondary pointer cannot steal drag, move plane, or complete a cloud',()=>{const s=setup();s.start();s.pointer('pointerdown',1,450,481);s.pointer('pointerdown',2,450,481);s.pointer('pointermove',2,180,220);s.pointer('pointerup',2,180,220);assert.equal(s.ids.plane.style.left,'50%');assert.equal(s.ids.plane.captured,1);s.flush();assert(s.clouds.every(c=>!c.classes.has('visited')));s.pointer('pointermove',1,180,220);s.pointer('pointerup',1,180,220);s.flush();assert(s.clouds[0].classes.has('visited'));});
test('far-away drop returns home without failure or progress',()=>{const s=setup();s.start();s.pointer('pointerdown',1,450,481);s.pointer('pointermove',1,780,550);s.pointer('pointerup',1,780,550);s.flush();assert.equal(s.ids.plane.style.top,'74%');assert(s.clouds.every(c=>!c.classes.has('visited')));});
test('restart during flight cancels delayed completion',()=>{const s=setup();s.start();s.ids.plane.fire('click');s.ids.reset.fire('click');s.flush();assert(s.clouds.every(c=>!c.classes.has('visited')));assert(s.dots.every(d=>!d.classes.has('done')));});
test('mute updates accessible state and only stores sound preference',()=>{const s=setup();s.ids.sound.fire('click');assert.equal(s.ids.sound.attrs['aria-pressed'],'true');assert.equal(s.ids.sound.attrs['aria-label'],'打开声音');assert.equal(s.storage.get('littleHandsMuted'),'true');s.ids.sound.fire('click');assert.equal(s.ids.sound.attrs['aria-pressed'],'false');assert.equal(s.storage.size,1);});
