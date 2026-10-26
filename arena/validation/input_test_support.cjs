'use strict';
class Target {
  constructor(tagName=''){this.tagName=tagName;this.listeners=new Map();this.classList={add(){},remove(){},toggle(){}};}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  emit(type,props={}){
    const event={type,target:this,repeat:false,preventDefault(){this.defaultPrevented=true;},...props};
    for(const fn of this.listeners.get(type)||[])fn(event);
    this['on'+type]?.(event);
    return event;
  }
  closest(){return ['BUTTON','INPUT','TEXTAREA','SELECT'].includes(this.tagName)||this.isContentEditable||this.role==='textbox'?this:null;}
}
function dom(){
  const win=new Target(),doc=new Target(),nodes=new Map();
  doc.hidden=false;doc.visibilityState='visible';doc.focused=true;doc.hasFocus=()=>doc.focused;doc.pointerLockElement=null;
  const context=new Proxy({},{get:(o,k)=>o[k]??(()=>{})});
  function element(id,tag='DIV'){
    const el=new Target(tag);el.id=id;el.getContext=()=>context;
    el.focus=()=>{doc.activeElement=el;doc.emit('focusin',{target:el});};nodes.set(id,el);return el;
  }
  for(const id of ['view','minimap'])element(id,'CANVAS');
  for(const id of ['west','east','overview','routes','tour','start'])element(id,'BUTTON');
  element('tourSelect','SELECT').value='direct_west_objective';
  for(const id of ['intro','crosshair','tourResult','notice','zone','perf','status'])element(id);
  doc.querySelector=selector=>nodes.get(selector.slice(1));doc.createElement=tag=>element('created-'+nodes.size,tag.toUpperCase());
  doc.activeElement=nodes.get('view');
  doc.exitPointerLock=()=>{doc.pointerLockElement=null;doc.emit('pointerlockchange');};
  nodes.get('view').requestPointerLock=()=>{doc.pointerLockElement=nodes.get('view');doc.emit('pointerlockchange');return Promise.resolve();};
  return {win,doc,view:nodes.get('view'),nodes,element,
    key(code,props={}){return win.emit('keydown',{code,target:doc.activeElement,...props});},
    up(code,props={}){return win.emit('keyup',{code,target:doc.activeElement,...props});},
    blur(){doc.focused=false;win.emit('blur');},focus(){doc.focused=true;win.emit('focus');},
    visibility(hidden){doc.hidden=hidden;doc.visibilityState=hidden?'hidden':'visible';doc.emit('visibilitychange');}
  };
}
module.exports={Target,dom};
