import {createInteractionBusy} from './interaction-busy.mjs';
let active=null,sequence=0;
export const customName=value=>({em:String(value)});
export function setSheetText(node,value){
  node.replaceChildren();
  for(const part of Array.isArray(value)?value:[value]){
    if(typeof part==='object'&&part!==null&&typeof part.em==='string'){const em=document.createElement('em');em.textContent=part.em;node.append(em);}
    else node.append(document.createTextNode(String(part??'')));
  }
}
export function sheetOpen(){return !!active;}
export function openSheet(options){return showSheet(options);}
function showSheet({title,body='',actions=[],className='',fallback,mount,restoreFocus=true,hasUnsavedChanges},parent=null){
  if(parent){if(active!==parent||parent.busy)return Promise.resolve(null);}
  else if(active){if(active.busy||active.parent)return Promise.resolve(null);active.finish(null);}
  if(!document.getElementById('dialog-sheet-style')){const link=document.createElement('link');link.id='dialog-sheet-style';link.rel='stylesheet';link.href=new URL('../assets/dialog-sheet.css',import.meta.url).href;document.head.append(link);}
  const opener=document.activeElement,dialog=document.createElement('dialog'),heading=document.createElement('h2'),content=document.createElement('div'),footer=document.createElement('div'),error=document.createElement('p');
  dialog.className='fs-sheet '+className;heading.id='sheet-title-'+(++sequence);heading.tabIndex=-1;heading.autofocus=true;setSheetText(heading,title);dialog.setAttribute('aria-labelledby',heading.id);
  content.className='sheet-body';content.innerHTML=body;error.className='sheet-error import-error';error.setAttribute('role','alert');error.tabIndex=-1;error.hidden=true;
  footer.className='sheet-actions receipt-options-actions';dialog.append(heading,content,error,footer);
  const scroller=document.querySelector('body.receipt-page #app')|| (location.pathname.endsWith('receipt.html')?document.getElementById('app'):null);
  const scroll={x:scrollX,y:scrollY,inner:scroller?.scrollTop,overflow:document.documentElement.style.overflow,appOverflow:scroller?.style.overflow};
  if(scroller)scroller.style.overflow='hidden';else document.documentElement.style.overflow='hidden';
  document.body.append(dialog);
  return new Promise(resolve=>{
    let dispose=()=>{},finished=false;
    const interaction=createInteractionBusy(dialog);
    const guardExit=event=>{if(active?.dialog===dialog&&active.busy){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',guardExit);
    const host={dialog,body:content,footer,heading,busy:false,parent,
      error(message){setSheetText(error,message);error.hidden=false;error.focus({preventScroll:true});error.scrollIntoView({block:'nearest'});},
      clearError(){error.hidden=true;},
      setTitle(value){setSheetText(heading,value);},
      setBusy(value){if(finished)return;host.busy=!!value;interaction.setBusy(host.busy);if(host.busy)dialog.setAttribute('aria-busy','true');else dialog.removeAttribute('aria-busy');},
      async dismiss(value=null){
        if(active!==host||host.busy)return;
        if(hasUnsavedChanges?.()&&!await confirmDiscard({parent:host,fallback:heading}))return;
        host.finish(value);
      },
      finish(value){if(finished||host.busy||active!==host)return;finished=true;dispose();interaction.dispose();window.removeEventListener('beforeunload',guardExit);window.visualViewport?.removeEventListener('resize',bounds);window.visualViewport?.removeEventListener('scroll',bounds);dialog.close();dialog.remove();active=parent;if(scroller){scroller.style.overflow=scroll.appOverflow;scroller.scrollTop=scroll.inner;}else{document.documentElement.style.overflow=scroll.overflow;window.scrollTo(scroll.x,scroll.y);}if(typeof restoreFocus==='function'?restoreFocus(value):restoreFocus){const target=opener?.isConnected&&opener.getClientRects().length&&!opener.disabled&&opener.matches('button,a,input,textarea,select,[tabindex]')?opener:(typeof fallback==='function'?fallback():fallback)??document.querySelector('#bill-selector,#submitBtn');target?.focus?.({preventScroll:true});}resolve(value);}
    };
    active=host;
    function bounds(){const viewport=window.visualViewport,height=viewport?.height??innerHeight;dialog.style.setProperty('--sheet-height',height-16+'px');dialog.style.setProperty('--sheet-bottom',Math.max(0,innerHeight-height-(viewport?.offsetTop??0))+'px');dialog.classList.toggle('sheet-short',height<=520);}
    bounds();window.visualViewport?.addEventListener('resize',bounds);window.visualViewport?.addEventListener('scroll',bounds);
    for(const action of actions){
      const button=document.createElement('button');button.type='button';button.textContent=action.label;button.className=action.className||'';if(action.id)button.id=action.id;if(action.data)Object.assign(button.dataset,action.data);button.disabled=!!action.disabled;
      button.addEventListener('click',async()=>{if(active!==host||host.busy)return;if(action.dismiss){await host.dismiss(action.value);return;}if(!action.run){host.finish(action.value??null);return;}host.clearError();host.setBusy(true);try{const result=await action.run(host);host.setBusy(false);if(result!==false)host.finish(result??action.value??true);}catch(e){host.setBusy(false);host.error(e.message);}});footer.append(button);
    }
    dialog.addEventListener('cancel',event=>{event.preventDefault();void host.dismiss();});
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)void host.dismiss();}});
    dialog.addEventListener('keydown',event=>{
      if(event.key==='Enter'&&(event.isComposing||event.target.matches('input[type=search]'))){event.preventDefault();return;}
      if(event.key==='Tab'){const nodes=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')].filter(n=>n.tabIndex>=0&&n.getClientRects().length&&!n.closest('[hidden]'));if(!nodes.length){event.preventDefault();heading.focus();return;}const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===heading)){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
    });
    dialog.showModal();
    dispose=mount?.(host)||(()=>{});
    // A custom header can reparent the heading and lose native dialog focus.
    if(document.activeElement!==heading)heading.focus({preventScroll:true});
  });
}
export async function confirmDiscard({fallback,parent=null}={}){
  const result=await showSheet({
    title:'ออกโดยไม่บันทึกไหม?',body:'<p>สิ่งที่แก้ไว้จะไม่ถูกบันทึก</p>',fallback,
    actions:[{label:'แก้ต่อ',value:false,className:'sheet-primary'},{label:'ไม่บันทึก',value:true}]
  },parent);
  return result===true;
}


// Controllers own data and recovery; this component only presents one episode.
export function createRecoveryNotice({getModel, fallback}){
  const lifetime=new AbortController(),signal=lifetime.signal;
  const timers=new Set();let frame=0;
  const scheduleShow=()=>{const timer=setTimeout(()=>{timers.delete(timer);void show();},0);timers.add(timer);};
  const button=document.createElement('button');
  button.type='button';button.className='recovery-status';button.hidden=true;
  button.setAttribute('aria-haspopup','dialog');document.body.append(button);
  let key='',shown='',generation=0,loading=false,host=null,observedBar=null;
  const observer=new ResizeObserver(place);
  function place(){
    const bar=[...document.querySelectorAll('#summary-export-bar,#add-menu-slot,.parse-wrap,.submit-wrap')].find(node=>{const rect=node.getBoundingClientRect();return rect.width&&rect.top<innerHeight&&rect.bottom>=innerHeight-2;});
    if(bar!==observedBar){observer.disconnect();observedBar=bar;if(bar)observer.observe(bar);}
    button.style.bottom=bar?Math.max(12,innerHeight-bar.getBoundingClientRect().top+12)+'px':'';
  }
  window.addEventListener('resize',place,{signal});

  async function show(force=false){
    if(!key||loading||sheetOpen()||(!force&&shown===key))return;
    const token=generation,episode=key;loading=true;
    let model;
    try{model=await getModel();}catch{model={title:'ไม่สามารถเปิดบิลได้',message:'ไม่สามารถเข้าถึงข้อมูลบิลได้ขณะนี้',actions:[]};}
    finally{loading=false;}
    if(token!==generation){
      // The new episode's scheduled show may have run while this read was pending.
      if(key)void show();
      return;
    }
    if(!key||sheetOpen()||!model)return;
    shown=episode;
    const choice=await openSheet({title:model.title,body:'<p></p>',className:'recovery-sheet',fallback,
      mount:current=>{host=current;current.body.firstChild.textContent=model.message;return ()=>{host=null;};},
      actions:[...model.actions.map((action,index)=>({label:action.label,id:action.id,value:action,className:index===0?'sheet-primary':''})),{label:model.dismissLabel??'ปิด',value:null}]});
    if(choice&&token===generation){
      try{await choice.run();}catch{update(key,'ยังไม่ได้บันทึก');}
    }
  }
  function update(next,label='ยังไม่ได้บันทึก'){
    next=next||'';
    if(next!==key){generation++;key=next;host?.finish(null);if(!next)shown='';}
    button.hidden=!key;button.textContent=label;if(key){cancelAnimationFrame(frame);frame=requestAnimationFrame(place);}
    if(key)scheduleShow();
  }
  button.onclick=()=>void show(true);
  document.addEventListener('close',()=>{if(key)scheduleShow();},{capture:true,signal});
  return {update,show:()=>show(true),dispose(){generation++;key='';shown='';lifetime.abort();observer.disconnect();cancelAnimationFrame(frame);for(const timer of timers)clearTimeout(timer);timers.clear();host?.finish(null);button.remove();}};
}
