(function(root,factory){
  if(typeof module==='object')module.exports=factory();else root.ArenaInput=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const movement=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
  const shortcuts=new Set(['Digit1','Digit2','KeyM','KeyR']);
  const isControl=target=>!!target?.closest?.('button, input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]');

  function create({window:win,document:doc,view,isEnabled=()=>true,onShortcut=()=>{},onReset=()=>{}}){
    const keys=new Set(),listeners=[];
    let focused=doc.hasFocus(),lastFrame=null;
    function reset(reason='manual'){
      keys.clear();
      onReset(reason);
    }
    function listen(target,type,handler){
      target.addEventListener(type,handler,true);
      listeners.push(()=>target.removeEventListener(type,handler,true));
    }
    function available(){return focused&&doc.hasFocus()&&!doc.hidden&&doc.visibilityState!=='hidden';}
    listen(win,'keydown',e=>{
      // OS/browser shortcuts and Esc may swallow the corresponding keyup.
      if(e.code==='Escape'||e.metaKey||e.ctrlKey||e.altKey||/^(Meta|Control|Alt)/.test(e.code)){
        reset('shortcut');return;
      }
      if(!available()||e.isComposing||isControl(e.target))return;
      const moving=movement.has(e.code)&&isEnabled(),shortcut=shortcuts.has(e.code);
      if(!moving&&!shortcut)return;
      e.preventDefault();
      // A repeat is never evidence of a fresh press after an interruption.
      // Already accepted held keys remain down without needing repeats.
      if(e.repeat)return;
      if(shortcut)onShortcut(e.code);else keys.add(e.code);
    });
    // Release even if focus, visibility, modifiers or mode changed meanwhile.
    listen(win,'keyup',e=>keys.delete(e.code));
    // Capture also sees descendant focus/blur. Those are not window lifecycle events.
    listen(win,'blur',e=>{if(e.target===win){focused=false;reset('blur');}});
    listen(win,'focus',e=>{if(e.target===win){focused=true;reset('focus');}});
    for(const event of ['pagehide','pageshow','resize'])listen(win,event,()=>reset(event));
    for(const event of ['visibilitychange','pointerlockchange','pointerlockerror','fullscreenchange','contextmenu','pointercancel','freeze','resume']){
      listen(doc,event,()=>reset(event));
    }
    listen(doc,'focusin',e=>{if(isControl(e.target))reset('control-focus');});
    listen(doc,'pointerdown',e=>{if(e.target!==view)reset('outside-pointer');});
    return {
      keys,reset,
      beginFrame(now){
        // Embedded hosts can suspend rendering without delivering focus events.
        if(lastFrame!==null&&now-lastFrame>1000)reset('frame-gap');
        lastFrame=now;
        if(!available())reset('inactive');else if(!isEnabled())keys.clear();
      },
      destroy(){for(const remove of listeners)remove();reset('destroy');}
    };
  }
  return {create};
});
