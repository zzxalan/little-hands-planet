const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {initial,reduce,done}=require('../dist/play-state.js');
const kinds=['shapes','garden','peekaboo'];
const action=k=>k==='shapes'?'place':k==='garden'?'grow':'reveal';
for(const kind of kinds)test(`${kind}: start gate, immutable complete round, repeat clicks and replay`,()=>{
 let s=initial(kind);const original=JSON.stringify(s);
 assert.equal(reduce(s,{type:action(kind),index:0}),s);
 assert.equal(done(s),false);s=reduce(s,{type:'start'});
 for(const index of [-1,3,NaN,undefined,.5])assert.equal(reduce(s,{type:action(kind),index}),s);
 for(let i=0;i<3;i++)for(let j=0;j<(kind==='garden'?3:1);j++)s=reduce(s,{type:action(kind),index:i});
 assert(done(s));assert.equal(JSON.stringify(initial(kind)),original);
 for(let i=0;i<3;i++)assert.equal(reduce(s,{type:action(kind),index:i}),s);
 s=reduce(s,{type:'reset'});assert.equal(s.round,1);assert.equal(s.started,true);assert.deepEqual(s.values,[0,0,0]);assert(!done(s));
});
test('shape mismatch, selected piece and next unfinished target',()=>{let s=reduce(initial('shapes'),{type:'start'});s=reduce(s,{type:'place',index:1});assert.deepEqual(s.values,[0,0,0]);s=reduce(s,{type:'select',index:2});s=reduce(s,{type:'place',index:2});assert.deepEqual(s.values,[0,0,1]);assert.equal(s.selected,0);assert.equal(reduce(s,{type:'select',index:2}).selected,0);});
test('fractional shape selection is rejected',()=>{const s=reduce(initial('shapes'),{type:'start'});assert.equal(reduce(s,{type:'select',index:.5}),s);});
// Minimal DOM surface used by play.js. The world parser deliberately handles only
// its generated game buttons; these tests are logic/event tests, not layout QA.
function harness(kind){
 const noop=()=>{},timers=[];let buttons=[];
 class El{
  constructor(dataset={}){this.dataset=dataset;this.style={};this.handlers={};this.attributes={};this.children=[];this.disabled=false;this.classes=new Set();this.classList={toggle:(n,on)=>on?this.classes.add(n):this.classes.delete(n),add:n=>this.classes.add(n),remove:n=>this.classes.delete(n)};}
  set innerHTML(v){this.html=v;if(this===ids.world){buttons=[...v.matchAll(/<button class="([^"]+)" data-(piece|slot|grow|reveal)="(\d)"/g)].map(m=>{const el=new El({[m[2]]:m[3]});el.classes.add(m[1]);return el;});}}
  get innerHTML(){return this.html||'';}setAttribute(k,v){this.attributes[k]=v;}addEventListener(k,f){(this.handlers[k]??=[]).push(f);}emit(k,e={}){for(const f of this.handlers[k]||[])f({target:this,pointerId:1,button:0,clientX:0,clientY:0,...e});}
  closest(){return this;}querySelector(){return buttons.find(b=>!b.disabled);}focus(){this.focused=true;}setPointerCapture(id){this.capture=id;}releasePointerCapture(){this.capture=null;}
  getBoundingClientRect(){const i=+this.dataset.slot;return {left:100+i*150,right:200+i*150,top:100,bottom:200};}
 }
 const ids=Object.fromEntries(['world','intro','listen','replay','progress','status','celebration','start','sound','soundText','introArt'].map(k=>[k,new El()]));ids.progress.children=[new El(),new El(),new El()];
 const select=s=>s==='[data-slot]'?buttons.filter(b=>b.dataset.slot!==undefined):buttons.filter(b=>b.classes.has(s.slice(1)));
 const document={body:{dataset:{game:kind}},getElementById:id=>ids[id],querySelectorAll:select,addEventListener:noop};
 const window={LittlePlay:{initial,reduce,done},addEventListener:noop};
 const sandbox={window,document,localStorage:{getItem(){throw Error('storage unavailable')},setItem(){throw Error('storage unavailable')}},setTimeout:f=>timers.push(f),console};
 vm.runInNewContext(fs.readFileSync('dist/play.js','utf8'),sandbox);
 return {ids,window,state:()=>window.littleGameState,b:(key,i)=>buttons.find(b=>b.dataset[key]===String(i)),click(key,i){ids.world.emit('click',{target:this.b(key,i)});},pointer(type,key,i,x,y,id=1){ids.world.emit(type,{target:this.b(key,i),clientX:x,clientY:y,pointerId:id});},flush(){while(timers.length)timers.shift()();}};
}
for(const kind of kinds)test(`${kind}: no audio APIs or storage; UI full round, repeat, replay and mute`,()=>{
 const h=harness(kind),key=kind==='shapes'?'slot':kind==='garden'?'grow':'reveal';
 h.click(key,0);assert.deepEqual([...h.state().values],[0,0,0]);assert.equal(h.ids.world.inert,true);
 h.ids.start.emit('click');assert.equal(h.ids.world.inert,false);
 for(let i=0;i<3;i++)for(let j=0;j<(kind==='garden'?3:1);j++)h.click(key,i);
 assert(done(h.state()));assert.equal(h.ids.replay.hidden,false);assert(h.ids.celebration.innerHTML.includes('<span'));
 h.click(key,2);assert(done(h.state()));h.ids.sound.emit('click');assert.equal(h.state().muted,true);h.ids.sound.emit('click');assert.equal(h.state().muted,false);
 h.ids.replay.emit('click');assert.deepEqual([...h.state().values],[0,0,0]);assert.equal(h.state().round,1);assert.equal(h.ids.replay.hidden,true);
 for(let i=0;i<3;i++)for(let j=0;j<(kind==='garden'?3:1);j++)h.click(key,i);assert(done(h.state()));
});
test('shape click selection, mismatch, drag, double touch, cancel and out-of-board drop',()=>{
 const h=harness('shapes');h.ids.start.emit('click');h.click('piece',2);h.click('slot',1);assert.deepEqual([...h.state().values],[0,0,0]);h.click('slot',2);assert.equal(h.state().values[2],1);
 h.pointer('pointerdown','piece',0,10,300,1);h.pointer('pointerdown','piece',1,20,300,2);h.pointer('pointermove','piece',1,300,150,2);h.pointer('pointerup','piece',1,300,150,2);assert.equal(h.state().selected,0);
 h.pointer('pointermove','piece',0,150,150,1);h.pointer('pointerup','piece',0,150,150,1);assert.equal(h.state().values[0],1);assert.equal(h.b('piece',0).style.transform,'');h.click('piece',1);assert.equal(h.state().selected,1);h.flush();
 h.pointer('pointerdown','piece',1,0,300);h.pointer('pointermove','piece',1,300,150);h.pointer('pointercancel','piece',1,300,150);h.pointer('pointerup','piece',1,300,150);assert.equal(h.state().values[1],0);assert.equal(h.b('piece',1).style.transform,'');
 h.pointer('pointerdown','piece',1,0,300);h.pointer('pointermove','piece',1,700,390);h.pointer('pointerup','piece',1,700,390);assert.equal(h.state().values[1],0);h.flush();h.click('slot',1);assert(done(h.state()));
});
test('peekaboo upward swipe, second pointer, canceled swipe and click fallback',()=>{
 const h=harness('peekaboo');h.ids.start.emit('click');h.pointer('pointerdown','reveal',0,0,200,1);h.pointer('pointerdown','reveal',1,0,200,2);h.pointer('pointerup','reveal',1,0,100,2);assert.equal(h.state().values[1],0);h.pointer('pointerup','reveal',0,0,150,1);assert.equal(h.state().values[0],1);h.click('reveal',1);assert.equal(h.state().values[1],0);h.flush();
 h.pointer('pointerdown','reveal',1,0,200);h.pointer('pointercancel','reveal',1,0,100);h.pointer('pointerup','reveal',1,0,100);assert.equal(h.state().values[1],0);h.click('reveal',1);h.click('reveal',2);assert(done(h.state()));
});
