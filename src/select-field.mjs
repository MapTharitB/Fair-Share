let openField=null;
export function mountSelectField(host,{id,label,options,value,onChange,editors}){
  const controller=new AbortController(),signal=controller.signal;
  const labelEl=document.createElement('span');labelEl.id=id+'-label';labelEl.textContent=label;
  const trigger=document.createElement('button');trigger.type='button';trigger.id=id;trigger.className='select-trigger';trigger.setAttribute('role','combobox');trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-labelledby',labelEl.id);trigger.setAttribute('aria-controls',id+'-list');trigger.setAttribute('aria-expanded','false');
  const text=document.createElement('span'),arrow=document.createElement('span');arrow.textContent='⌄';arrow.setAttribute('aria-hidden','true');trigger.append(text,arrow);host.append(labelEl,trigger);
  const popup=document.createElement('div');popup.id=id+'-list';popup.className='select-popup';popup.setAttribute('role','listbox');popup.setAttribute('aria-labelledby',labelEl.id);popup.hidden=true;document.body.append(popup);
  let active=0,search='',searchTime=0;
  const buttons=options.map((option,index)=>{const el=document.createElement('div');el.id=id+'-option-'+index;el.setAttribute('role','option');el.textContent=option.label;el.addEventListener('pointerdown',e=>e.preventDefault());el.addEventListener('click',()=>{active=index;accept();});popup.append(el);return el;});
  function setValue(next){value=next;const option=options.find(o=>o.value===value);text.textContent=option?.label??options[0].label;buttons.forEach((el,i)=>el.setAttribute('aria-selected',String(options[i].value===value)));}
  function highlight(){buttons.forEach((el,i)=>el.classList.toggle('active',i===active));trigger.setAttribute('aria-activedescendant',buttons[active].id);buttons[active].scrollIntoView({block:'nearest'});}
  function close(){popup.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-activedescendant');if(openField===api)openField=null;}
  function bounds(){const v=window.visualViewport;let top=v?.offsetTop??0,bottom=top+(v?.height??innerHeight);for(const el of document.querySelectorAll('.top-bar,.sub-bar,.summary-sticky-bar,.submit-wrap-inner')){const r=el.getBoundingClientRect();if(r.top<=top+1&&r.bottom>top)top=r.bottom;else if(r.top<bottom&&r.bottom>=bottom-1)bottom=r.top;}return {top,bottom,left:v?.offsetLeft??0,width:v?.width??innerWidth};}
  function position(){
    if(popup.hidden)return;const r=trigger.getBoundingClientRect(),area=bounds();
    if(!trigger.isConnected||r.bottom<=area.top||r.top>=area.bottom){close();return;}
    const below=area.bottom-r.bottom-4,above=r.top-area.top-4,up=below<popup.scrollHeight&&above>below;
    popup.style.width=Math.min(Math.max(r.width,220),area.width-16)+'px';popup.style.left=Math.max(area.left+8,Math.min(r.left,area.left+area.width-popup.offsetWidth-8))+'px';
    popup.style.maxHeight=Math.max(44,up?above:below)+'px';popup.style.top=(up?Math.max(area.top,r.top-popup.offsetHeight-4):r.bottom+4)+'px';
  }
  function show(){openField?.close();openField=api;active=Math.max(0,options.findIndex(o=>o.value===value));popup.hidden=false;trigger.setAttribute('aria-expanded','true');position();highlight();}
  function accept(){const next=options[active].value;close();trigger.focus({preventScroll:true});if(next!==value){setValue(next);onChange(next);}}
  const toggle=()=>{const current=document.getElementById(id);if(current!==trigger){current?.click();return;}popup.hidden?show():close();};
  if(editors)editors.bind(trigger,toggle);else trigger.addEventListener('click',toggle);
  trigger.addEventListener('keydown',e=>{
    if(e.isComposing)return;const key=e.key;
    if(key==='Escape'){if(!popup.hidden){e.preventDefault();close();}return;}
    if(key==='Tab'){if(!popup.hidden)accept();return;}
    if(['Enter',' ','ArrowDown','ArrowUp','Home','End'].includes(key)){
      e.preventDefault();if(popup.hidden){show();if(key==='Home')active=0;if(key==='End')active=options.length-1;}
      else if(key==='Enter'||key===' '){accept();return;}
      else if(key==='ArrowDown')active=Math.min(options.length-1,active+1);else if(key==='ArrowUp')active=Math.max(0,active-1);else active=key==='Home'?0:options.length-1;
      highlight();return;
    }
    if(key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){if(popup.hidden)show();const now=Date.now();search=now-searchTime>700?'':search;search+=key;searchTime=now;const match=options.findIndex(o=>o.label.startsWith(search));if(match>=0){active=match;highlight();}}
  });
  document.addEventListener('pointerdown',e=>{if(!host.contains(e.target)&&!popup.contains(e.target))close();},{signal});
  document.addEventListener('focusin',e=>{if(e.target!==trigger&&!popup.contains(e.target))close();},{signal});
  window.addEventListener('scroll',position,{capture:true,passive:true,signal});window.addEventListener('resize',position,{signal});
  window.visualViewport?.addEventListener('resize',position,{signal});window.visualViewport?.addEventListener('scroll',position,{signal});
  const api={setValue,close,destroy(){close();controller.abort();popup.remove();host.replaceChildren();}};setValue(value);return api;
}
