// Temporary interaction exclusion without changing native availability or paint.
// Business owners still decide disabled, aria-busy, focus, and transaction state.
const surfaces='button,input,select,textarea,a[href],label,[contenteditable]:not([contenteditable="false"]),[role="button"],[data-a],[data-editor-action],.open-row,.person-chip';
const events=['pointerdown','pointerup','mousedown','mouseup','click','dblclick','keydown','beforeinput','paste','cut','drop','change'];
export function createInteractionBusy(root,{signal}={}){
  const window=root.ownerDocument.defaultView,lifetime=new AbortController(),attributes=new Map();
  let busy=false,disposed=false;
  function restore(node,previous){
    if(node.getAttribute('aria-disabled')!=='true')return;
    if(previous===null)node.removeAttribute('aria-disabled');else node.setAttribute('aria-disabled',previous);
  }
  function refresh(){
    if(!busy||disposed)return;
    for(const [node,previous] of attributes)if(!root.contains(node)){restore(node,previous);attributes.delete(node);}
    for(const node of root.querySelectorAll(surfaces)){
      if(attributes.has(node))continue;
      attributes.set(node,node.getAttribute('aria-disabled'));node.setAttribute('aria-disabled','true');
    }
  }
  const observer=new window.MutationObserver(refresh);
  function block(event){
    if(!busy||!root.contains(event.target))return;
    const target=event.target.closest?.(surfaces);if(!target||!root.contains(target))return;
    if(event.type==='keydown'){
      const key=event.key;
      if(key==='Tab'||['Shift','Control','Alt','Meta'].includes(key))return;
      if((event.ctrlKey||event.metaKey)&&['c','a'].includes(key.toLowerCase()))return;
      const choice=target.matches('select,input[type=radio],input[type=checkbox],input[type=range]');
      const editable=target.matches('textarea,input:not([type=radio]):not([type=checkbox]):not([type=button]):not([type=submit]),[contenteditable]:not([contenteditable="false"])');
      if(!['Enter',' ','Spacebar','Escape'].includes(key)&&!(choice&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(key))
        &&!(editable&&(key.length===1||['Backspace','Delete'].includes(key))))return;
    }
    event.preventDefault();event.stopImmediatePropagation();
  }
  for(const type of events)window.addEventListener(type,block,{capture:true,signal:lifetime.signal});
  function setBusy(value){
    if(disposed)return;
    busy=!!value;
    if(busy){refresh();observer.observe(root,{subtree:true,childList:true});}
    else{observer.disconnect();for(const [node,previous] of attributes)restore(node,previous);attributes.clear();}
  }
  function dispose(){if(disposed)return;setBusy(false);disposed=true;lifetime.abort();signal?.removeEventListener('abort',dispose);}
  if(signal?.aborted)dispose();else signal?.addEventListener('abort',dispose,{once:true});
  return {setBusy,dispose};
}
