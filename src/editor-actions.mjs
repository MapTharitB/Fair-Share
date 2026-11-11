// Capture toolbar activation before blur can replace its DOM. Pointer movement
// cancels the gesture, so scrolling an editor never invokes a toolbar action.
export function createEditorActions(root=document){
  const actions=new WeakMap(),composing=new Set();let pointer=null,pending=null,suppressedClick=null;
  const controller=new AbortController(),options={capture:true,signal:controller.signal};
  function run(action){if(composing.size){pending=action;return false;}const editor=root.activeElement??document.activeElement;editor?.blur?.();action();return true;}
  root.addEventListener('compositionstart',e=>composing.add(e.target),options);
  root.addEventListener('compositionend',e=>{composing.delete(e.target);requestAnimationFrame(()=>{if(!composing.size&&pending){const action=pending;pending=null;run(action);}});},options);
  root.addEventListener('pointerdown',e=>{
    suppressedClick=null;
    const button=e.target.closest?.('button,[data-editor-action]');
    if(button&&actions.has(button)){
      pointer={button,x:e.clientX,y:e.clientY};
      // This handler owns activation. Suppress compatibility mouse events: after
      // pointerup opens a screen they would hit its new DOM and steal input focus.
      // Also keep the old editor alive until movement decides tap versus scroll.
      e.preventDefault();
    }
  },options);
  root.addEventListener('pointermove',e=>{if(pointer&&Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>8)pointer=null;},options);
  root.addEventListener('pointercancel',()=>{pointer=null;},options);
  root.addEventListener('pointerup',e=>{const p=pointer;pointer=null;if(!p||p.button.disabled||e.target.closest?.('button,[data-editor-action]')!==p.button)return;e.preventDefault();e.stopImmediatePropagation();suppressedClick={pointerId:e.pointerId};run(actions.get(p.button));},options);
  // A tap may replace the button or open a sheet before its click arrives.
  // Consume that same gesture at the root, even when the click is retargeted.
  root.addEventListener('click',e=>{
    const handled=suppressedClick;suppressedClick=null;
    if(handled&&e.detail>0&&(e.pointerId===undefined||e.pointerId===handled.pointerId)){e.preventDefault();e.stopImmediatePropagation();}
  },options);
  return {
    bind(button,action){if(button.dataset&&button.tagName!=='BUTTON')button.dataset.editorAction='';actions.set(button,action);button.addEventListener('click',e=>{
      // Native keyboard/programmatic choice clicks keep their checked default.
      // Pointer activation is already owned above, including its follow-up click.
      if(button.tagName!=='INPUT'||!['checkbox','radio'].includes(button.type))e.preventDefault();
      e.stopImmediatePropagation();run(action);
    });},
    run,get composing(){return composing.size>0;},dispose(){controller.abort();composing.clear();pending=null;}
  };
}
