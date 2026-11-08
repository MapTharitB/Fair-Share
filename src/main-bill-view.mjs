import {createTextMeasurer} from './text-measure.mjs';
import {esc,fmt,displayRate,fP,getItemTotal,MAIN_ICONS as ICONS} from './bill-display.mjs';
import {getItemWarnings,categorizeWarns,ZERO_SHARE_SUFFIX} from './bill-warnings.mjs';
import {numericInputs as NI} from './numeric-bindings.mjs';
import {measureChoiceGroup,observeChoices,layoutAdjustments} from './choice-layout.mjs';
import {reserveBottomAction,observeStickyHeading} from './main-layout.mjs';

function bodyMeasureFont(size){
  const style=getComputedStyle(document.body);
  return `400 ${style.getPropertyValue('--text-'+size).trim()} ${style.fontFamily}`;
}

/** Read-only projection plus named actions; views have no storage/session access. */
export function mountMenu(initial,actions){return mountBillView('menu',initial,actions);}
export function mountSummary(initial,actions){return mountBillView('summary',initial,actions);}
function mountBillView(kind,initial,actions){
  let model=initial,collapsed=new Set(model.collapsed),distributionCleanup=()=>{},stickyCleanup=()=>{},bottomCleanup=()=>{};
  const {measure:measureTW,clear:clearTextWidths}=createTextMeasurer();

function buildSummaryWarnLines(...args){return createWarningPresentation(model.working.people).summary(...args);}
function buildAdjBar({id,label,enabled=true,ctrlHtml}){
  return `<div class="adj-bar"${id?` id="${id}"`:''}><span class="adj-bar-label${enabled?'':' is-muted'}">${label}</span><div class="adj-bar-ctrl">${ctrlHtml}</div></div>`;
}
function renderBillTotals(bt){return `<div class="shdr"><span class="stitle">ยอดรวมบิล</span></div><div class="bill-totals totals"><div class="trow"><span class="tlbl">ยอดรวมย่อย</span><span class="tval">${fmt(bt.Sb)}</span></div>${billAdjRowsHtml(bt.svcAmt,bt.vatAmt,bt.D)}<div class="trow grand"><span class="tlbl">ยอดที่ต้องจ่าย</span><span class="tval">${fmt(bt.grand)}</span></div></div>`;}

function distributionOptions(key,value,disabled){return `<div class="segmented segmented--compact" role="radiogroup" aria-label="${key==='sd'?'แบ่ง Service Charge':'แบ่งส่วนลด'}">${[['equal','หารเท่า'],['proportional','ตามสัดส่วน']].map(([v,label])=>`<label class="segmented-option"><input type="radio" name="distribution-${key}" data-${key}="${v}" value="${v}" ${value===v?'checked':''} ${disabled?'disabled':''}><span class="segmented-face">${label}</span></label>`).join('')}</div>`;}
function layoutDistribution(){
  const row=document.querySelector('#screen-summary .dist-bar-row');
  if(!row||!row.clientWidth)return;
  const px=value=>parseFloat(value)||0;
  const gap=px(getComputedStyle(row).columnGap);
  const metrics=[...row.children].map(card=>{
    const style=getComputedStyle(card),label=card.querySelector('.dist-bar-label');
    const labelStyle=getComputedStyle(label);
    return {card,width:measureChoiceGroup(card.querySelector('.segmented'),{textFor:face=>face.previousElementSibling.value==='proportional'?'ตามสัดส่วน':face.textContent}),
      short:measureChoiceGroup(card.querySelector('.segmented'),{textFor:face=>face.previousElementSibling.value==='proportional'?'สัดส่วน':face.textContent}),
      outer:px(style.paddingLeft)+px(style.paddingRight)+px(style.borderLeftWidth)+px(style.borderRightWidth),
      // Measure the wide label style even while the card is compact, avoiding breakpoint oscillation.
      labelWidth:measureTW(label.textContent,`500 ${labelStyle.getPropertyValue('--text-13').trim()} ${labelStyle.fontFamily}`)};
  });
  const half=(row.clientWidth-gap)/2;
  const widePair=metrics.every(m=>m.width+m.outer+m.labelWidth+10<=half);
  const compactPair=!widePair&&metrics.every(m=>m.short+m.outer<=half);
  const stacked=!widePair&&!compactPair;
  const wide=widePair||stacked&&metrics.every(m=>m.width+m.outer+m.labelWidth+10<=row.clientWidth);
  row.classList.toggle('dist-cards-stacked',stacked);
  for(const m of metrics){
    m.card.style.setProperty('--distribution-choice-width',(compactPair?m.short:m.width)+'px');m.card.classList.toggle('dist-bar-wide',wide);
    const input=m.card.querySelector('input[value=proportional]');input.setAttribute('aria-label','ตามสัดส่วน');input.nextElementSibling.textContent=compactPair?'สัดส่วน':'ตามสัดส่วน';
  }
}
function billAdjRowsHtml(svc,vat,disc,person=false){
  const variant=person?' trow--person-adjustment':'';let h='';
  if(model.working.service.enabled)h+=`<div class="trow${variant}"><span class="tlbl">Service Charge (${displayRate(model.working.service.value)}%)</span><span class="tval">+${fmt(svc)}</span></div>`;
  if(model.working.tax.enabled)h+=`<div class="trow${variant}"><span class="tlbl">VAT (${displayRate(model.working.tax.value)}%)</span><span class="tval">+${fmt(vat)}</span></div>`;
  if(disc>0)h+=`<div class="trow${variant}"><span class="tlbl">ส่วนลด</span><span class="tval--discount tval">−${fmt(disc)}</span></div>`;
  return h;
}

function updatePeoplePreview(){const na=document.getElementById('people-names-area');if(!na||!model.working.people.length)return;const maxW=na.clientWidth||na.getBoundingClientRect().width||300;const sp=document.getElementById('people-names-span');if(sp)sp.textContent=buildPeoplePreview(model.working.people,maxW);}
function buildPeoplePreview(people,maxWidth){if(!people.length)return'';const font=bodyMeasureFont(13);const full=people.map(p=>p.name).join(', ');if(measureTW(full,font)<=maxWidth)return full;for(let count=people.length-1;count>=1;count--){const shown=people.slice(0,count).map(p=>p.name).join(', ');const ov=people.length-count;const cand=shown+` และอีก ${ov} คน`;if(measureTW(cand,font)<=maxWidth)return cand;}const ov=people.length-1;return people[0].name+(ov>0?` และอีก ${ov} คน`:'');}

function emptyPeopleCard(id){return `<div class="people-preview-card card"><div class="people-preview-empty"><div class="people-preview-note">ยังไม่มีรายชื่อคน โปรดเพิ่มคนเพื่อเริ่มแบ่งบิล</div><button class="btn--empty btn btn-p btn--orange" id="${id}">+ เพิ่มคน</button></div></div>`;}
function renderMenuContent(){
  const el=document.getElementById('screen-menu');let h='';
  const svcOn=model.working.service.enabled,vatOn=model.working.tax.enabled,dFixed=model.working.discount.mode==='fixed';
  const hasPeople=model.working.people.length>0;

  h+=`<div class="section-start shdr"><span class="stitle">รายชื่อคนที่โต๊ะอาหาร</span></div>`;
  if(!model.working.people.length)h+=emptyPeopleCard('add-first-p-btn');
  else{h+=`<div class="people-preview-card open-row card" id="go-people-bar"><div class="li"><div class="people-count"><span class="people-count-number">${model.working.people.length} คน</span></div><div id="people-names-area" class="people-preview-area"><span id="people-names-span" class="people-preview-text">${model.working.people.map(p=>esc(p.name)).join(', ')}</span></div><svg class="chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div></div>`;}

  h+=`<div class="shdr"><span class="stitle">รายการอาหาร</span></div>`;
  h+=`<button class="btn-ocr-upload" id="upload-receipt-btn">${ICONS.camera} อ่านใบเสร็จอัตโนมัติ</button>`;

  if(model.working.items.length){
    h+=`<div class="menu-list-gap card">`;
    model.working.items.forEach(it=>{const lbl=model.labels[it.id],total=getItemTotal(it),qty=it.quantity||1,n=it.assignments.length;const pi=qty>1?`${fmt(it.price||0,'฿')} × ${qty} = ${fmt(total,'฿')} · ${n} คน`:`${fmt(total,'฿')} · ${n} คน`;h+=`<div class="open-row li" data-a="open-it" data-id="${esc(it.id)}"><div class="li-c"><div class="li-t">${it.name?esc(it.name):`<em class="text-subdued">ไม่มีชื่อเมนู</em>`}</div><div class="li-s">${pi}</div></div><div class="li-r"><span class="badge-item ${lbl.cls}">${esc(lbl.text)}</span><button class="btn-icon danger-action" data-a="del-it" data-id="${esc(it.id)}">${ICONS.bin}</button><svg class="chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div></div>`;});
    h+=`</div>`;
  }else{
    h+=`<div class="menu-empty empty"><div class="empty-ico">🍽️</div><div class="empty-txt">กดปุ่มด้านล่างเพื่อเพิ่มเมนูแรก</div></div>`;
  }

  h+=`<div id="add-menu-slot"><button class="btn--full btn ${hasPeople?'btn-p btn--orange':'btn-s'}" id="add-it-btn">${ICONS.plus} เพิ่มเมนู</button></div>`;

  h+=`<div class="shdr"><span class="stitle">ปรับยอดบิล</span></div><div class="adj-bar-row">`;
  const svcCtrl=`<div class="adj-iw--rate adj-iw"><input type="text" inputmode="decimal" autocomplete="off" class="adj-inp" id="adj-svc" value="${model.working.service.value?displayRate(model.working.service.value):''}" placeholder="0" ${!svcOn?'disabled':''}><span class="adj-sym">%</span></div><input type="checkbox" id="svc-chk" ${svcOn?'checked':''}>`;
  const vatCtrl=`<div class="adj-iw--rate adj-iw"><input type="text" inputmode="decimal" autocomplete="off" class="adj-inp" id="adj-tax" value="${model.working.tax.value?displayRate(model.working.tax.value):''}" placeholder="0" ${!vatOn?'disabled':''}><span class="adj-sym">%</span></div><input type="checkbox" id="tax-chk" ${vatOn?'checked':''}>`;
  const discCtrl=`<div class="mtgl"><button class="mtgl-b${!dFixed?' act':''}" data-dm="percent">%</button><button class="mtgl-b${dFixed?' act':''}" data-dm="fixed">฿</button></div><div class="adj-iw--discount adj-iw" id="disc-adj-iw"><input type="text" inputmode="decimal" autocomplete="off" class="adj-inp" id="adj-disc" value="${model.working.discount.value||''}" placeholder="0"><span class="adj-sym" id="disc-sym">${dFixed?'฿':'%'}</span></div>`;
  h+=buildAdjBar({label:'Service Charge',enabled:svcOn,ctrlHtml:svcCtrl});
  h+=buildAdjBar({label:'VAT',enabled:vatOn,ctrlHtml:vatCtrl});
  h+=buildAdjBar({id:'disc-adj-bar',label:'ส่วนลด',ctrlHtml:discCtrl});
  h+=`</div><div id="menu-bill-totals">${renderBillTotals(model.totals)}</div>`;

  el.innerHTML=h;layoutAdjustments(el.querySelector('.adj-bar-row'));updatePeoplePreview();actions.updateTabHint();

  actions.bindPeopleEntry(el.querySelector('#go-people-bar'));
  actions.bindPeopleEntry(el.querySelector('#add-first-p-btn'));
  actions.bindBillAction(el.querySelector('#add-it-btn'),actions.addItem,{preserveGesture:true});
  actions.bindBillAction(el.querySelector('#upload-receipt-btn'),actions.uploadReceipt);
  el.querySelectorAll('[data-a="open-it"]').forEach(node=>actions.bindBillAction(node,()=>actions.openItem(node.dataset.id),{preserveGesture:true}));
  el.querySelectorAll('[data-a="del-it"]').forEach(node=>node.addEventListener('click',event=>{event.stopPropagation();actions.deleteItem(node.dataset.id);}));
  const svcChk=el.querySelector('#svc-chk'),svcI=el.querySelector('#adj-svc');
  svcChk?.addEventListener('change',()=>actions.toggleCharge('service',svcChk.checked));
  if(svcI&&!svcI.disabled)NI.bindPercAdj(svcI,value=>actions.editCharge('service',value));
  const taxChk=el.querySelector('#tax-chk'),taxI=el.querySelector('#adj-tax');
  taxChk?.addEventListener('change',()=>actions.toggleCharge('tax',taxChk.checked));
  if(taxI&&!taxI.disabled)NI.bindPercAdj(taxI,value=>actions.editCharge('tax',value));
  const discI=el.querySelector('#adj-disc');
  if(discI){if(dFixed)NI.bindMoneyAdj(discI,actions.editDiscount,{trimZeros:true});else NI.bindPercAdj(discI,actions.editDiscount);}
  el.querySelectorAll('[data-dm]').forEach(node=>node.addEventListener('click',()=>actions.discountMode(node.dataset.dm)));
}
function setSummaryContent(el,controls,details,keepControls){
  if(keepControls){const bar=el.querySelector('#summary-export-bar');el.querySelector('#summary-details').innerHTML=details;if(bar)el.querySelector('#summary-export-bar')?.replaceWith(bar);}
  else{distributionCleanup();el.innerHTML=controls+`<div id="summary-details" class="summary-details">${details}</div>`;attachDistHandlers(el);distributionCleanup=observeChoices(el.querySelector('.dist-bar-row'),layoutDistribution);}
}
function renderSummaryContent(keepControls=false){
  const el=document.getElementById('screen-summary');let h='';
  const svcDistDisabled=!model.working.service.enabled;const discDistDisabled=!model.working.discount.value||model.working.discount.value<=0;
  const containerW=el.clientWidth||window.innerWidth;
  h+=`<div class="section-start shdr"><span class="stitle">วิธีการแบ่ง</span></div><div class="dist-bar-row">`;
  h+=`<div class="dist-bar${svcDistDisabled?' disabled-bar':''}"><span class="dist-bar-label">Service Charge</span><div class="dist-bar-ctrl">${distributionOptions('sd',model.working.serviceDist,svcDistDisabled)}</div></div>`;
  h+=`<div class="dist-bar${discDistDisabled?' disabled-bar':''}"><span class="dist-bar-label">ส่วนลด</span><div class="dist-bar-ctrl">${distributionOptions('dd',model.working.discountDist,discDistDisabled)}</div></div>`;
  h+=`</div>`;
  const controls=h;h='';
  const nPeople=model.working.people.length,allExpanded=collapsed.size===0,allCollapsed=nPeople>0&&collapsed.size>=nPeople;
  h+=`<div class="per-person-sticky"><h2 class="stitle">ยอดรวมรายคน</h2>${nPeople?`<div class="coll-btns"><button class="coll-btn${allExpanded?' act':''}" id="btn-expand-all">ขยายทั้งหมด</button><button class="coll-btn${allCollapsed?' act':''}" id="btn-collapse-all">ย่อทั้งหมด</button></div>`:''}</div>`;
  if(!model.working.people.length){const totals=model.totals;h+=emptyPeopleCard('summary-add-people')+renderBillTotals(totals);if(totals.unallocated)h+=`<p class="wb wb-w">ยังแบ่งจ่ายไม่ครบ ${fmt(totals.unallocated)}</p>`;setSummaryContent(el,controls,h,keepControls);actions.bindPeopleEntry(el.querySelector('#summary-add-people'));return;}
  const bt=model.totals;
  if(!bt){h+=`<div class="empty"><div class="empty-ico">💰</div><div class="empty-txt">ยังไม่มีข้อมูล</div></div>`;setSummaryContent(el,controls,h,keepControls);return;}
  for(const warning of bt.warnings.filter(w=>w.includes('ยอดติดลบ')))h+=`<div class="wb wb-w" role="status">${esc(warning)}</div>`;
  if(bt.unallocated)h+=`<div class="menu-list-gap wb wb-w">ยังแบ่งจ่ายไม่ครบ ${fmt(bt.unallocated)}</div>`;
  const warnMap=new Map(model.working.items.map(it=>[it.id,model.warnings[it.id]]));
  const warnItems=model.working.items.filter(it=>warnMap.get(it.id).length);
  if(warnItems.length){
    h+=`<div class="menu-list-gap wb summary-item-warning"><strong class="warning-heading">⚠ มีเมนู ${warnItems.length} รายการที่ยังมีคำเตือนค้างอยู่</strong>`;
    for(const item of warnItems){
      const lines=buildSummaryWarnLines(item,containerW,warnMap.get(item.id));
      for(const [index,line] of lines.entries()){
        const first=index===0?' warning-line--first':'';
        if(line.hasLink){
          h+=`<div class="warning-line warning-line--linked${first}">
            <button type="button" class="warning-item-link" data-a="go-item" data-id="${esc(line.id)}">${esc(line.linkText)}</button>
            <span class="warning-linked-note">${esc(line.text)}</span>
          </div>`;
        }else{
          h+=`<div class="warning-line warning-line--plain${first}">${esc(line.text)}</div>`;
        }
      }
    }
    h+=`</div>`;
  }
  model.working.people.forEach(p=>{
    const pt=bt.pt[p.id];if(!pt)return;const neg=pt.total<0,hw=model.personWarnings[p.id];
    const assigned=model.working.items.filter(it=>it.assignments.some(a=>a.personId===p.id));
    const hasNoItems=assigned.length===0;const isCollapsed=collapsed.has(p.id);
    h+=`<div class="scard"><button type="button" class="scard-hdr" data-a="toggle-coll" data-pid="${esc(p.id)}" aria-expanded="${!isCollapsed}"><div class="person-heading-name">${hw?`<span class="person-heading-warning">⚠</span>`:''}<span class="sname">${esc(p.name)}</span></div><div class="person-heading-total"><span class="stot${neg?' neg':''}">${fmt(pt.total)}</span><svg class="coll-chev ${isCollapsed?'closed':'open'}" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></div></button>`;
    h+=`<div class="person-card-actions"><button type="button" class="btn btn-s" data-a="person-menus" data-pid="${esc(p.id)}">แก้ไขเมนูที่กิน</button></div>`;
    if(!isCollapsed){
      if(hasNoItems)h+=`<div class="person-summary-warning">⚠ ยังไม่ได้เลือกเมนูใด</div>`;
      else if(pt.total<=0&&assigned.length>0)h+=`<div class="person-summary-warning">⚠ ยอดรวมเป็น 0 บาท หรือติดลบ</div>`;
      if(assigned.length){
        h+=`<div class="sbd">`;
        assigned.forEach(it=>{const a=it.assignments.find(x=>x.personId===p.id);if(!a)return;const d=model.shares[it.id][p.id]||{amount:a.amount||0,percentage:a.percentage||0};const itW=warnMap.get(it.id).length>0;const qty2=it.quantity||1;h+=`<div class="open-row pdrow" data-a="go-edit-item" data-iid="${esc(it.id)}"><div class="pdi"><div class="pdn">${it.name?esc(it.name):`<em class="text-subdued">ไม่มีชื่อเมนู</em>`}</div><div class="pds"><span>${fmt(d.amount)}</span><span>·</span><span>${fP(d.percentage)}</span>${qty2>1?`<span class="text-subdued">จาก ${fmt(it.price||0,'฿')}×${qty2}</span>`:''}${a.locked?'<span class="lk-chip">ล็อค</span>':''}</div></div><div class="pdr">${itW?`<span class="person-item-warning" title="${esc(warnMap.get(it.id).map(w=>w.msg).join(', '))}">⚠</span>`:''}<button class="btn-icon danger-action" data-a="rm-p-from-item" data-pid="${esc(p.id)}" data-iid="${esc(it.id)}" title="ลบออกจากเมนู">${ICONS.bin}</button></div></div>`;});
        h+=`<div class="person-totals">`;
        h+=`<div class="trow--person-subtotal trow"><span class="tlbl">ยอดรวมย่อย</span><span class="tval">${fmt(pt.subtotal)}</span></div>`;
        h+=billAdjRowsHtml(pt.service,pt.vat,pt.discount,true);
        h+=`<div class="trow--person-grand trow grand"><span class="tlbl">ยอดรวม</span><span class="tval">${fmt(pt.total)}</span></div></div></div>`;
      }
    }
    h+='</div>';
  });
  h+=renderBillTotals(bt);
  h+=`<div id="summary-export-bar"><button class="btn--full btn--export btn btn-p" id="btn-download-summary">${ICONS.download} บันทึกสรุปยอดเป็นรูปภาพ</button></div>`;
  setSummaryContent(el,controls,h,keepControls);
  el.querySelectorAll('[data-a="person-menus"]').forEach(node=>actions.bindBillAction(node,()=>actions.personMenus(node.dataset.pid)));
  el.querySelectorAll('[data-a="toggle-coll"]').forEach(node=>node.addEventListener('click',()=>actions.toggleCollapsed(node.dataset.pid)));
  el.querySelector('#btn-expand-all').addEventListener('click',actions.expandAll);
  el.querySelector('#btn-collapse-all').addEventListener('click',actions.collapseAll);
  el.querySelectorAll('[data-a="go-item"]').forEach(node=>node.addEventListener('click',()=>actions.openItem(node.dataset.id)));
  el.querySelectorAll('[data-a="go-edit-item"]').forEach(node=>node.addEventListener('click',event=>{if(!event.target.closest('[data-a="rm-p-from-item"]'))actions.openItem(node.dataset.iid);}));
  el.querySelectorAll('[data-a="rm-p-from-item"]').forEach(node=>node.addEventListener('click',event=>{event.stopPropagation();actions.removePersonMenu(node.dataset.pid,node.dataset.iid);}));
  const exportButton=el.querySelector('#btn-download-summary');
  if(exportButton&&!exportButton.dataset.bound){actions.bindBillAction(exportButton,actions.exportSummary);exportButton.dataset.bound='true';}
}

function attachDistHandlers(el){
  for(const [attribute,key] of [['sd','serviceDist'],['dd','discountDist']]){
    el.querySelectorAll('[data-'+attribute+']').forEach(input=>input.addEventListener('change',()=>{
      if(input.checked&&!input.disabled)actions.distribution(key,input.dataset[attribute]);
    }));
  }
}
  function update(next){
    model=next;collapsed=new Set(model.collapsed);
    if(model.totalsOnly){const panel=document.getElementById('menu-bill-totals');if(panel)panel.innerHTML=renderBillTotals(model.totals);return;}
    if(kind==='menu'){renderMenuContent();return;}
    stickyCleanup();bottomCleanup();renderSummaryContent(!!model.keepControls);
    stickyCleanup=observeStickyHeading(document.querySelector('.per-person-sticky'));
    const bar=document.getElementById('summary-export-bar');document.getElementById('app-footer').style.display=bar?'none':'';
    bottomCleanup=reserveBottomAction(bar);
  }
  update(initial);
  return {update,layout(){if(kind==='menu'){layoutAdjustments(document.querySelector('#screen-menu .adj-bar-row'));updatePeoplePreview();}else layoutDistribution();},
    dispose(){distributionCleanup();stickyCleanup();bottomCleanup();clearTextWidths();document.getElementById('screen-'+kind).replaceChildren();}};
}
export function renderItemWarning(item,people){return createWarningPresentation(people).item(item);}
function createWarningPresentation(people){
  const model={working:{people}};
  const {measure:measureTW}=createTextMeasurer();

function _zeroNamesDisplay(names,ouPart,suffix,avail,font){if(measureTW(ouPart+names.join(' ')+suffix,font)<=avail)return names.join(' ');for(let i=names.length-1;i>=1;i--){const cand=ouPart+names.slice(0,i).join(' ')+` และคนอีก ${names.length-i} คน`+suffix;if(measureTW(cand,font)<=avail)return names.slice(0,i).join(' ')+` และคนอีก ${names.length-i} คน`;}return`${names.length} คน`;}
function _getZeroWarnNames(zeroWarns){return zeroWarns.map(w=>{const p=model.working.people.find(x=>x.id===w.personId);return p?.name||'?';});}
function buildWarnHtml(item){
  const total=getItemTotal(item);
  const over=getItemWarnings(item,model.working.people).find(w=>w.type==='over');if(over)return`<div class="wb wb-w" role="alert">⚠ ${esc(over.msg)}</div>`;
  if(!total||total<=0)return`<div class="wb wb-n">ใส่ราคาเพื่อเริ่มแบ่งบิล</div>`;
  if(!item.assignments||!item.assignments.length)return`<div class="wb wb-n">เลือกคนด้านล่างเพื่อเริ่มแบ่งบิล</div>`;
  const warns=getItemWarnings(item,model.working.people);if(!warns.length)return`<div class="wb wb-ok">✓ ${item.assignments.length===1?'กินคนเดียว':'แบ่งบิลเรียบร้อย'}</div>`;
  const{overUnder,zeroWarns}=categorizeWarns(warns);let html='';
  if(overUnder)html+=`<div class="wb wb-w">⚠ ${esc(overUnder.msg)}</div>`;
  if(zeroWarns.length){
    const warnEl=document.getElementById('item-warn-area');
    const avail=warnEl&&warnEl.clientWidth>50?warnEl.clientWidth-30:window.innerWidth-62;
    const font=bodyMeasureFont(13);
    const names=_getZeroWarnNames(zeroWarns);
    const displayNames=_zeroNamesDisplay(names,'⚠ ',ZERO_SHARE_SUFFIX,avail,font);
    html+=`<div class="wb wb-w">⚠ ${esc(displayNames+ZERO_SHARE_SUFFIX)}</div>`;
  }
  if(!overUnder&&!zeroWarns.length)html+=`<div class="wb wb-w">⚠ ${esc(warns[0].msg)}</div>`;
  return html||`<div class="wb wb-ok">✓ แบ่งบิลเรียบร้อย</div>`;
}
function buildSummaryWarnLines(item,containerW,preWarns){
  const warns=preWarns||getItemWarnings(item,model.working.people);if(!warns.length)return[];
  const noPriceWarn=warns.find(w=>w.type==='no_price');
  const{overUnder,zeroWarns}=categorizeWarns(warns);const lines=[];
  const font12=bodyMeasureFont(12);const fontLink=bodyMeasureFont(13);
  const wbInner=(containerW||window.innerWidth)-32-26;
  if(noPriceWarn){lines.push({hasLink:true,id:item.id,linkText:item.name||'ไม่มีชื่อ',text:noPriceWarn.msg});return lines;}
  if(overUnder)lines.push({hasLink:true,id:item.id,linkText:item.name||'ไม่มีชื่อ',text:overUnder.msg});
  if(zeroWarns.length){
    const names=_getZeroWarnNames(zeroWarns);
    if(overUnder){const avail=Math.max(wbInner-2,80);lines.push({hasLink:false,id:item.id,text:_zeroNamesDisplay(names,'',ZERO_SHARE_SUFFIX,avail,font12)+ZERO_SHARE_SUFFIX});}
    else{const itemNameW=measureTW(item.name||'ไม่มีชื่อ',fontLink);const avail=Math.max(wbInner-itemNameW-5,80);lines.push({hasLink:true,id:item.id,linkText:item.name||'ไม่มีชื่อ',text:_zeroNamesDisplay(names,'',ZERO_SHARE_SUFFIX,avail,font12)+ZERO_SHARE_SUFFIX});}
  }
  if(!overUnder&&!zeroWarns.length&&warns.length)lines.push({hasLink:true,id:item.id,linkText:item.name||'ไม่มีชื่อ',text:warns[0].msg});
  return lines;
}

  return {item:buildWarnHtml,summary:buildSummaryWarnLines};
}
