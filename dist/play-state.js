(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LittlePlay=api;})(typeof window==='undefined'?this:window,()=>{
'use strict';
const initial=kind=>({kind,started:false,selected:0,values:[0,0,0],round:0});
const done=s=>s.values.every(v=>v===(s.kind==='garden'?3:1));
function reduce(s,a){
 if(a.type==='start')return {...s,started:true};
 if(a.type==='reset')return {...initial(s.kind),started:true,round:s.round+1};
 if(!s.started||done(s))return s;
 if(a.type==='select'&&s.kind==='shapes'&&Number.isInteger(a.index)&&a.index>=0&&a.index<3&&!s.values[a.index])return {...s,selected:a.index};
 if(a.index<0||a.index>2||!Number.isInteger(a.index))return s;
 const values=s.values.slice();
 if(s.kind==='shapes'&&a.type==='place'&&s.selected===a.index){values[a.index]=1;return {...s,values,selected:values.findIndex(v=>!v)};}
 if(s.kind==='garden'&&a.type==='grow')values[a.index]=Math.min(3,values[a.index]+1);
 if(s.kind==='peekaboo'&&a.type==='reveal')values[a.index]=1;
 return {...s,values};
}
return {initial,reduce,done};
});
