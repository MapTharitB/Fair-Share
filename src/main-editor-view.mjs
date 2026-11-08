import {createTextMeasurer} from './text-measure.mjs';
import {esc,fmt,fmtComma,getItemTotal,MAIN_ICONS as ICONS} from './bill-display.mjs';
import {numericInputs as NI} from './numeric-bindings.mjs';

/** People and item mounts own their DOM and listener/layout lifetimes only. */
export function mountPeople(initial,actions){
  let model=initial,first=true,enterHeld=false;
  const releaseEnter=event=>{if(event.key==='Enter')enterHeld=false;};
  addEventListener('keyup',releaseEnter,true);
function renderPeople(){
  const el=document.getElementById('screen-people');let h='';
  h+=`<div class="people-add-card card"><label class="inp-lbl" for="np-inp">เพิ่มคน</label><div class="people-add-row"><input id="np-inp" class="inp--people-add inp" type="text" maxlength="30" placeholder="ชื่อจริงหรือชื่อเล่น" autocomplete="off" enterkeyhint="done"><button class="btn--people-add btn btn-p btn--orange" id="np-add-btn" type="button">เพิ่ม</button></div><div id="np-err" class="people-add-error inp-err"></div></div>`;
  h+=`<div id="people-list-wrap"></div>`;
  el.innerHTML=h;
  document.getElementById('sticky-done-wrap').style.display='block';
  document.getElementById('btn-done-sticky').textContent='เสร็จสิ้น';
  document.getElementById('btn-done-sticky').onclick=actions.donePeople;
  const npInp=document.getElementById('np-inp');
  npInp.value=model.peopleDraft.add;
  npInp.addEventListener('input',()=>{actions.capturePeople({add:npInp.value});});
  document.getElementById('np-add-btn').addEventListener('click',()=>actions.addPerson());
  let enterHandled=false;
  function enterName(e){
    if(e.isComposing||actions.composing()||e.keyCode===229)return;
    e.preventDefault();if(enterHandled||e.repeat)return;enterHandled=true;
    if(!npInp.value.trim()){const err=document.getElementById('np-err');err.textContent='';err.style.display='none';npInp.blur();return;}
    actions.addPerson();
  }
  npInp.addEventListener('beforeinput',event=>{if(actions.saving())event.preventDefault();});
  npInp.addEventListener('paste',event=>{if(actions.saving())event.preventDefault();});
  npInp.addEventListener('keydown',e=>{if(e.key==='Enter'){enterHeld=true;enterName(e);}});
  npInp.addEventListener('beforeinput',e=>{if(e.inputType==='insertLineBreak')enterName(e);});
  npInp.addEventListener('keyup',e=>{if(e.key==='Enter')enterHandled=false;});
  npInp.addEventListener('focus',()=>{if(!enterHeld)enterHandled=false;});
  npInp.addEventListener('input',()=>{enterHandled=false;});
  npInp.addEventListener('input',()=>{const err=document.getElementById('np-err');if(err)err.style.display='none';});
  if(first){first=false;if(matchMedia('(pointer: fine)').matches)npInp.focus();}
  renderPeopleList();
}

function renderPeopleList(){
  const wrap=document.getElementById('people-list-wrap');if(!wrap)return;let h='';
  if(!model.working.people.length){h+=`<div class="people-empty empty"><div class="empty-ico">👥</div><div class="empty-txt">ยังไม่มีรายชื่อคน</div></div>`;}
  else{const n=model.working.people.length;h+=`<div class="section-start shdr"><span class="stitle">คน · ${n}</span></div><div class="card"><div class="p2col">`;model.working.people.forEach((p,idx)=>{const isRight=idx%2===1;const lastRowStart=Math.floor((n-1)/2)*2;const isLastRow=idx>=lastRowStart;const column=isRight?'':' p2cell--left';const row=isLastRow?'':' p2cell--divided';if(model.editingPid===p.id){h+=`<div class="p2cell-edit${row}"><input id="ep-${esc(p.id)}" class="inp--people-rename inp" type="text" value="${esc(p.name)}" maxlength="30" autocomplete="off" enterkeyhint="done"><button class="btn--rename-save btn btn-p" data-a="ep-save" data-id="${esc(p.id)}">✓</button><button class="btn--rename-cancel btn btn-s" data-a="ep-cancel">✕</button></div>`;}else{h+=`<div class="p2cell${column}${row}"><span class="p2cell-name">${esc(p.name)}</span><button class="btn-icon--people btn-icon" data-a="rename-p" data-id="${esc(p.id)}"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn-icon--people btn-icon danger-action" data-a="del-p" data-id="${esc(p.id)}">${ICONS.bin}</button></div>`;}});h+=`</div></div>`;}

  wrap.innerHTML=h;
  if(model.peopleDraft.rename&&model.editingPid===model.peopleDraft.rename.id){const input=document.getElementById('ep-'+model.editingPid);if(input)input.value=model.peopleDraft.rename.value;}
  wrap.querySelectorAll('[data-a="rename-p"]').forEach(node=>node.addEventListener('click',event=>{event.stopPropagation();actions.renamePerson(node.dataset.id);}));
  wrap.querySelectorAll('[data-a="ep-save"]').forEach(e=>e.addEventListener('click',ev=>{ev.stopPropagation();actions.editPerson(e.dataset.id);}));
  wrap.querySelectorAll('[data-a="ep-cancel"]').forEach(e=>e.addEventListener('click',ev=>{ev.stopPropagation();actions.cancelRename();}));
  model.working.people.forEach(p=>{const inp=document.getElementById('ep-'+p.id);if(inp){inp.addEventListener('input',()=>{actions.capturePeople({rename:{id:p.id,value:inp.value}});});NI.addTriggers(inp,()=>actions.editPerson(p.id));inp.addEventListener('keydown',e=>{if(e.key==='Escape'){actions.cancelRename();}});}});
  wrap.querySelectorAll('[data-a="del-p"]').forEach(e=>e.addEventListener('click',ev=>{ev.stopPropagation();actions.deletePerson(e.dataset.id);}));
}

  function update(next){model=next;if(model.listOnly)renderPeopleList();else renderPeople();}
  update(initial);
  return {update,dispose(){removeEventListener('keyup',releaseEnter,true);document.getElementById('screen-people').replaceChildren();document.getElementById('btn-done-sticky').onclick=null;}};
}


import {renderItemWarning} from './main-bill-view.mjs';
export function mountItem(initial,actions){
  let model=initial,disposed=false,doneObserver=null,warnAreaObserver=null,itemWidthObserver=null,chipLayoutRAF=0,warnRebuildRAF=0;
  const MAX_PRICE=999999.99;
  const chipWidths=createTextMeasurer();
  const clone=value=>structuredClone(value),r4=value=>Math.round(value*10000)/10000;
  function relayoutChips(){cancelAnimationFrame(chipLayoutRAF);chipLayoutRAF=requestAnimationFrame(()=>{if(!disposed){const item=actions.currentItem();if(item)initChipLayout(item);}});}
  function cleanup(){doneObserver?.disconnect();warnAreaObserver?.disconnect();itemWidthObserver?.disconnect();doneObserver=warnAreaObserver=itemWidthObserver=null;cancelAnimationFrame(chipLayoutRAF);cancelAnimationFrame(warnRebuildRAF);}
function buildItemFieldsHtml(item,twoLine){
  const priceDisplay=item.price?fmtComma(item.price):'';
  return `<div class="item-fields${twoLine?' item-fields--stacked':''}">
    <div class="item-name-field">
      <label class="field-lbl" for="it-name">ชื่อเมนู</label>
      <input id="it-name" class="inp" type="text" maxlength="50" value="${esc(item.name)}" placeholder="อาหาร/เครื่องดื่ม" autocomplete="off" enterkeyhint="next" aria-describedby="it-name-err">
      <div id="it-name-err" class="inp-err field-error-initial"></div>
    </div>
    <div class="item-number-fields">
      <div class="item-price-field">
        <div class="item-price-entry">
          <label class="field-lbl field-lbl--right" for="it-price">ราคา</label>
          <div class="field-with-unit">
            <input id="it-price" class="inp inp--currency" type="text" inputmode="decimal" autocomplete="off" value="${priceDisplay}" placeholder="0" enterkeyhint="next" aria-describedby="it-price-err">
            <span class="field-unit" aria-hidden="true">฿</span>
          </div>
        </div>
        <div id="it-price-err" class="inp-err field-error-initial"></div>
      </div>
      ${itemFieldOperator('×')}
      <div class="item-quantity-field">
        <label class="field-lbl field-lbl--center" for="it-qty">จำนวน</label>
        <input id="it-qty" class="inp inp--quantity" type="text" inputmode="numeric" autocomplete="off" value="${item.quantity||1}" placeholder="1" enterkeyhint="done">
      </div>
      ${itemFieldOperator('=')}
      <div class="item-fields-total">
        <span class="field-lbl">ยอดรวม</span>
        <div id="it-total-disp" class="it-total-val">${fmt(getItemTotal(item),'บาท')}</div>
      </div>
    </div>
  </div>`;
}

function itemFieldOperator(symbol){
  return `<div class="item-field-operator" aria-hidden="true"><span class="field-lbl">${symbol}</span><span class="item-operator-mark">${symbol}</span></div>`;
}

function getChipHighlight(item){if(!model.working.people.length)return{allAct:false,noneAct:false};const ids=new Set(item.assignments.map(a=>a.personId));return{allAct:model.working.people.every(p=>ids.has(p.id)),noneAct:!model.working.people.some(p=>ids.has(p.id))};}

function livePreviewSplit(item,pid,value,mode){const preview=clone(item);actions.setAllocation(preview,pid,value,mode);syncAssignmentRows(preview);}
function bindItemSplitInput(inp,item,mode){
  let edited=false;
  const parseValue=()=>mode==='amt'?NI.parse(inp.value,true):NI.parsePct(inp.value);
  function commit(){
    if(!edited)return;edited=false;
    const value=parseValue();
    if(value===null||!isFinite(value)||value<0){syncAssignmentRows(item,null,true);return;}
    actions.setAllocation(item,inp.dataset.pid,value,mode);actions.installItemDraft(item);
    syncAssignmentRows(item,null,true);actions.recordItem();
  }
  inp.addEventListener('focus',()=>{edited=false;inp.select();});
  inp.addEventListener('input',()=>{
    edited=true;
    const raw=inp.value.replace(/\\/g,'/');if(raw!==inp.value)inp.value=raw;
    if(!/[+\-*/]/.test(raw)){
      const old=inp.value,pos=inp.selectionStart;
      const clean=NI.processPlain(raw,mode==='amt'?8:3,mode==='amt'?2:4),next=mode==='amt'?NI.addCommas(clean):clean;
      if(next!==old){inp.value=next;NI.restoreCursor(inp,old,next,pos);}
    }
    const value=parseValue();if(value!==null&&isFinite(value)&&value>=0)livePreviewSplit(item,inp.dataset.pid,value,mode);
  });
  inp.addEventListener('blur',commit);
  NI.addTriggers(inp,commit);
  inp.addEventListener('paste',e=>{e.preventDefault();inp.value=(e.clipboardData||window.clipboardData).getData('text');inp.dispatchEvent(new Event('input'));});
}
const bindItemAmtInput=(inp,item)=>bindItemSplitInput(inp,item,'amt');
const bindItemPctInput=(inp,item)=>bindItemSplitInput(inp,item,'pct');

function assignmentFields(assignment, share) {
  return [
    {field:'amt', value:fmtComma(share.amount), lockMode:'amount'},
    {field:'pct', value:share.percentage.toFixed(2), lockMode:'percentage'}
  ].map(({field, value, lockMode}) => {
    const locked = assignment.locked && assignment.lockMode === lockMode;
    return {field, value, className:`fi fi-${field} ${locked?'fl':'fa'}`};
  });
}

function syncAssignmentRows(item,focusPid=null,force=false){
  const da=actions.shares(item),wd=document.getElementById('item-warn-area');if(wd)wd.innerHTML=renderItemWarning(item,model.working.people);
  item.assignments.forEach(a=>{
    const d=da[a.personId]||{amount:0,percentage:0},lk=a.locked;
    for(const {field,value,className} of assignmentFields(a,d)){
      const input=document.querySelector(`[data-f="${field}"][data-pid="${CSS.escape(a.personId)}"]`);
      if(input){if(force||document.activeElement!==input)input.value=value;input.className=className;input.disabled=false;}
    }
    const button=document.querySelector(`[data-a="toggle-lock"][data-pid="${CSS.escape(a.personId)}"]`);
    if(button){button.className='lkb'+(lk?' lk':'');button.innerHTML=lk?ICONS.lock:ICONS.unlock;button.disabled=false;button.setAttribute('aria-label',(lk?'ปลดล็อก':'ล็อก')+'ส่วนแบ่ง');}
  });
}
function initChipLayout(item){
  const cardEl=document.getElementById('chip-area');if(!cardEl||!model.working.people.length)return;
  const style=getComputedStyle(cardEl);
  const GAP=parseFloat(style.getPropertyValue('--space-7'));
  const chipPadding=parseFloat(style.getPropertyValue('--space-14'));
  const font=`500 ${style.getPropertyValue('--text-13').trim()} ${style.fontFamily}`;
  const rawW=cardEl.clientWidth||Math.max(window.innerWidth-60,120);const W=rawW-chipPadding*2;
  const chips=model.working.people.map(p=>({p,w:Math.ceil(chipWidths.measure(p.name,font))+chipPadding*2+4}));
  const rows=[];let row=[],rowW=0;
  for(const chip of chips){const nextW=row.length?rowW+GAP+chip.w:chip.w;if(row.length&&nextW>W){rows.push(row);row=[chip];rowW=chip.w;}else{row.push(chip);rowW=nextW;}}
  if(row.length)rows.push(row);
  if(rows.length>=2){let last=rows[rows.length-1],prev=rows[rows.length-2];const widthOf=arr=>arr.reduce((s,c,i)=>s+c.w+(i?GAP:0),0);let lastW=widthOf(last),prevW=widthOf(prev);while(prev.length>1&&lastW/prevW<0.5){const moved=prev[prev.length-1];const newPrev=prev.slice(0,-1);const newLast=[moved,...last];const newPrevW=widthOf(newPrev),newLastW=widthOf(newLast);if(newPrevW<=W&&newLastW<=W&&newLastW/newPrevW>=0.5){prev=newPrev;last=newLast;rows[rows.length-2]=prev;rows[rows.length-1]=last;}else break;prevW=widthOf(prev);lastW=widthOf(last);}}
  let html=`<div class="chip-list">`;
  rows.forEach(row=>{html+=`<div class="chip-row">`;row.forEach(({p})=>{const sel=item.assignments.some(a=>a.personId===p.id);html+=`<div data-a="chip-p" data-pid="${esc(p.id)}" class="person-chip${sel?' is-selected':''}">${esc(p.name)}</div>`;});html+=`</div>`;});
  html+=`</div>`;cardEl.innerHTML=html;
  cardEl.querySelectorAll('[data-a="chip-p"]').forEach(c=>{c.addEventListener('click',()=>{
    // Layout snapshots are display-only. Fields may have changed since the
    // ResizeObserver rebuilt these chips; record that gesture before toggling.
    const item=actions.currentItem();if(!item)return;
    actions.recordItem();
    const pid=c.dataset.pid,idx=item.assignments.findIndex(a=>a.personId===pid);
    if(idx>=0)item.assignments.splice(idx,1);else item.assignments.push({personId:pid,amount:0,percentage:0,locked:false});
    actions.recalculate(item);actions.installItemDraft(item);actions.renderItem();
  });});
}

function refreshItemTotal(item) {
  const total = getItemTotal(item);
  const display = document.getElementById('it-total-disp');
  if (display) display.textContent = fmt(total, 'บาท');
  actions.headerTotal(total);
  return total;
}

function renderItemDetail(){
  const el=document.getElementById('screen-item-detail');
  const item=structuredClone(model.item);if(!item){el.innerHTML='';return;}
  const twoLine=model.twoLine;const da=actions.shares(item),total=getItemTotal(item);
  actions.headerTotal(total);
  const{allAct,noneAct}=getChipHighlight(item);
  const addPersonBtn=model.working.people.length>0?`<button id="chip-add-p-btn" class="btn--text-link">+ เพิ่ม/แก้ไขชื่อคนที่โต๊ะอาหาร</button>`:'';
  let h=`<div id="item-warn-sticky"><div id="item-warn-area">${renderItemWarning(item,model.working.people)}</div></div>`;
  h+=`<div id="item-scroll-body"><div class="item-field-section">${buildItemFieldsHtml(item,twoLine)}</div>`;
  h+=`<div class="item-selection-section">${addPersonBtn?`<div class="item-people-action">${addPersonBtn}</div>`:''}<div class="item-selection-heading"><span class="stitle">เลือกคนที่กินเมนูนี้</span>${model.working.people.length?`<div class="coll-btns"><button class="coll-btn${allAct?' act':''}" id="sel-all-btn">เลือกทุกคน</button><button class="coll-btn${noneAct?' act':''}" id="desel-all-btn">ไม่เลือก</button></div>`:''}</div></div>`;
  if(!model.working.people.length)h+=`<div class="item-empty-people card"><span class="inline-link" id="go-p-link">เพิ่มคน</span> ในหน้า <em>รายชื่อคนที่โต๊ะอาหาร</em> ก่อน</div>`;
  else h+=`<div id="chip-area" class="item-chip-card card"></div>`;
  if(item.assignments.length){
    h+=`<div class="card split-card">`;
    h+=`<div class="split-grid split-grid--head"><div class="flbl">คน</div><div class="field-lbl--right flbl">จำนวนเงิน</div><div class="field-lbl--right flbl">เปอร์เซ็นต์</div><div></div></div>`;
    item.assignments.forEach(a=>{const p=model.working.people.find(x=>x.id===a.personId);if(!p)return;const d=da[a.personId]||{amount:0,percentage:0},lk=a.locked;const [amount,percentage]=assignmentFields(a,d);
    h+=`<div class="split-grid split-grid--row" data-pid="${esc(a.personId)}"><div class="split-person-name">${esc(p.name)}</div><div class="field-with-unit split-field"><input type="text" inputmode="decimal" autocomplete="off" class="${amount.className}" aria-label="จำนวนเงินของ ${esc(p.name)}" data-f="amt" data-pid="${esc(a.personId)}" value="${amount.value}"><span class="field-unit field-unit--split">฿</span></div><div class="field-with-unit split-field"><input type="text" inputmode="decimal" autocomplete="off" class="${percentage.className}" aria-label="เปอร์เซ็นต์ของ ${esc(p.name)}" data-f="pct" data-pid="${esc(a.personId)}" value="${percentage.value}"><span class="field-unit field-unit--split">%</span></div><button aria-label="${lk?'ปลดล็อก':'ล็อก'}ส่วนแบ่งของ ${esc(p.name)}" class="lkb${lk?' lk':''}" data-a="toggle-lock" data-pid="${esc(a.personId)}">${lk?ICONS.lock:ICONS.unlock}</button></div>`;});
    h+=`</div>`;
  }
  h+=`<button class="item-bottom-action btn--full btn danger-action danger-action--outlined" id="del-item-btn">${ICONS.bin} ลบเมนู</button>`;
  h+=`<button class="item-bottom-action btn--full btn--done btn btn-p" id="btn-done-inline">เสร็จสิ้น</button></div>`;
  el.innerHTML=h;
  actions.bindBillAction(el.querySelector('#btn-done-inline'),actions.done);
  document.getElementById('btn-done-sticky').textContent='เสร็จสิ้น';
  document.getElementById('btn-done-sticky').onclick=actions.doneSticky;
  if(doneObserver){doneObserver.disconnect();doneObserver=null;}
  const inlineDoneEl=document.getElementById('btn-done-inline'),stickyWrap=document.getElementById('sticky-done-wrap');
  if(inlineDoneEl&&'IntersectionObserver' in window){doneObserver=new IntersectionObserver(entries=>{stickyWrap.style.display=entries[0].isIntersecting?'none':'block';},{threshold:0.9});doneObserver.observe(inlineDoneEl);}else stickyWrap.style.display='block';
  if(warnAreaObserver){warnAreaObserver.disconnect();warnAreaObserver=null;}
  const warnAreaEl=document.getElementById('item-warn-area');
  if(warnAreaEl&&'ResizeObserver' in window){warnAreaObserver=new ResizeObserver(()=>{cancelAnimationFrame(warnRebuildRAF);warnRebuildRAF=requestAnimationFrame(()=>{if(disposed)return;const it=actions.currentItem();if(it){const wd=document.getElementById('item-warn-area');if(wd)wd.innerHTML=renderItemWarning(it,model.working.people);}});});warnAreaObserver.observe(warnAreaEl);}
  if(itemWidthObserver)itemWidthObserver.disconnect();
  if('ResizeObserver' in window){itemWidthObserver=new ResizeObserver(()=>layout());itemWidthObserver.observe(el);}
  if(model.working.people.length)initChipLayout(item);
  const nameInp=document.getElementById('it-name'),priceInp=document.getElementById('it-price'),qtyInp=document.getElementById('it-qty');
  nameInp.addEventListener('input',()=>{item.name=nameInp.value;actions.installItemDraft(item);actions.title(item.name||'เมนูใหม่');document.getElementById('it-name-err').style.display='none';});
  nameInp.addEventListener('blur',()=>{const t=nameInp.value.trim();if(t)item.name=t;actions.installItemDraft(item);actions.recordItem();});
  NI.addTriggers(nameInp,()=>priceInp.focus());
  NI.bindNumeric(priceInp,{showCommas:true});
  priceInp.addEventListener('focus',()=>priceInp.select());
  priceInp.addEventListener('input',()=>{const raw=priceInp.value.replace(/,/g,''),num=parseFloat(raw);const livePrice=(!isNaN(num)&&num>=0)?Math.min(num,MAX_PRICE):0;delete item.authoritativeTotalCents;item.price=r4(livePrice);refreshItemTotal(item);actions.recalculate(item,true);syncAssignmentRows(item);actions.installItemDraft(item);});
  priceInp.addEventListener('blur',()=>{const raw=priceInp.value.replace(/,/g,'');let num=parseFloat(raw);if(isNaN(num)||num<0){priceInp.value='';item.price=0;}else{num=Math.min(num,MAX_PRICE);item.price=r4(num);priceInp.value=num?fmtComma(num):'';}refreshItemTotal(item);actions.installItemDraft(item);syncAssignmentRows(item);});
  NI.addTriggers(priceInp,()=>{qtyInp?.focus();});
  NI.bindNumeric(qtyInp,{allowDecimal:false,maxIntDigits:2});
  qtyInp.addEventListener('focus',()=>qtyInp.select());
  qtyInp.addEventListener('input',()=>{const v=Math.min(Math.max(parseInt(qtyInp.value)||1,1),99);delete item.authoritativeTotalCents;item.quantity=v;refreshItemTotal(item);actions.recalculate(item,true);syncAssignmentRows(item);actions.installItemDraft(item);});
  qtyInp.addEventListener('blur',()=>{const v=Math.min(Math.max(parseInt(qtyInp.value)||1,1),99);qtyInp.value=String(v);item.quantity=v;refreshItemTotal(item);actions.installItemDraft(item);syncAssignmentRows(item);});
  NI.addTriggers(qtyInp,()=>qtyInp.blur());
  for(const input of el.querySelectorAll('input'))input.addEventListener('blur',()=>queueMicrotask(actions.recordItem));
  actions.bindPeopleEntry(el.querySelector('#go-p-link'));
  actions.bindPeopleEntry(el.querySelector('#chip-add-p-btn'));
  el.querySelector('#sel-all-btn')?.addEventListener('click',()=>{model.working.people.forEach(p=>{if(!item.assignments.some(a=>a.personId===p.id))item.assignments.push({personId:p.id,amount:0,percentage:0,locked:false});});actions.recalculate(item);actions.installItemDraft(item);actions.renderItem();});
  el.querySelector('#desel-all-btn')?.addEventListener('click',()=>{item.assignments=[];actions.recalculate(item);actions.installItemDraft(item);actions.renderItem();});
  el.querySelectorAll('[data-a="toggle-lock"]').forEach(b=>b.addEventListener('click',()=>{const a=item.assignments.find(x=>x.personId===b.dataset.pid);if(!a)return;if(a.locked)a.locked=false;else{const current=actions.shares(item)[a.personId]??{amount:0,percentage:0};a.amount=current.amount;a.locked=true;a.lockMode??='percentage';if(a.lockMode==='percentage')a.lockPercentUnits=Math.round(current.percentage*10000);}actions.recalculate(item);actions.installItemDraft(item);actions.renderItem();}));
  el.querySelectorAll('[data-f="amt"]').forEach(inp=>{if(!inp.disabled)bindItemAmtInput(inp,item);});
  el.querySelectorAll('[data-f="pct"]').forEach(inp=>{if(!inp.disabled)bindItemPctInput(inp,item);});
  actions.bindEditorAction(el.querySelector('#del-item-btn'),actions.deleteItem);
}
  function layout(){
    const fields=document.querySelector('#screen-item-detail .item-fields');
    if(!fields)return;
    model={...model,twoLine:actions.isTwoLine()};
    fields.classList.toggle('item-fields--stacked',model.twoLine);
    relayoutChips();
  }
  function update(next){cleanup();model=next;renderItemDetail();}
  update(initial);
  return {update,layout,
    dispose(){disposed=true;cleanup();chipWidths.clear();document.getElementById('screen-item-detail').replaceChildren();document.getElementById('btn-done-sticky').onclick=null;}};
}
