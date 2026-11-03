import {encodeBillFile,billFilename} from './backup-file.mjs';
import {openSheet,customName} from './in-app-confirm.mjs';
import {setPersonMenus} from './bill-operations.mjs';
import {calculate,money,itemTotal,newId} from './bill-state.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const memberships=(bill,pid)=>new Set(bill.items.filter(it=>it.assignments.some(a=>a.personId===pid)).map(it=>it.id));
function mountPersonMenuHeader(host){
  const header=document.createElement('div'),back=document.getElementById('btn-back').cloneNode(true);
  header.className='person-menu-header';
  back.removeAttribute('id');back.removeAttribute('style');
  back.type='button';back.setAttribute('aria-label','ยกเลิกการเลือกเมนู');
  back.querySelector('svg').setAttribute('aria-hidden','true');
  back.addEventListener('click',()=>void host.dismiss(false));
  host.heading.before(header);header.append(host.heading,back);
}
export async function openPersonMenus({session,personId,onSaved,onRefreshed,onEditItem,onGoToMenu}){
  let baseline=session.current,revision=session.record.recordRevision,selected=memberships(baseline,personId),stale=false,limit=50,query='',candidate;
  const name=baseline.people.find(p=>p.id===personId)?.name;if(!name)return;
  const fallback=()=>document.querySelector(`[data-a="person-menus"][data-pid="${CSS.escape(personId)}"]`);
  const emptyMessage='<p>ยังไม่มีเมนูให้เลือก โปรดเพิ่มเมนูในบิลก่อน</p>';
  const emptyActions=[{label:'ปิด',value:false},{label:'ไปยังหน้าเมนู',value:'menu',className:'sheet-primary'}];
  if(!baseline.items.length){const result=await openSheet({title:['แก้ไขเมนูที่ ',customName(name),' กิน'],fallback,body:emptyMessage,actions:emptyActions,mount:mountPersonMenuHeader});if(result==='menu')onGoToMenu();return result;}
  let editId=null;const mutationId=newId();
  const result=await openSheet({title:['แก้ไขเมนูที่ ',customName(name),' กิน'],className:'person-menu-sheet',fallback,
    hasUnsavedChanges:()=>!!candidate?.changedItemIds.length,
    body:'<div class="person-menu-search-area"><label for="person-menu-search">ค้นหาเมนู</label><div class="person-menu-search-field"><input type="search" id="person-menu-search" autocomplete="off"><button type="button" id="person-menu-clear" aria-label="ล้างคำค้นหา" hidden><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg></button></div><div class="person-menu-selection-bar"><p id="selection-count" role="status" aria-live="polite"></p><div class="person-menu-selection-actions"><button type="button" id="selection-all" class="coll-btn">เลือกทั้งหมด</button><button type="button" id="selection-none" class="coll-btn">ไม่เลือก</button></div></div></div><div id="person-menu-list"></div><div id="person-menu-preview" class="person-menu-preview"></div><p class="person-menu-lock-note">ส่วนแบ่งที่ล็อกไว้ของคนอื่นจะคงตามการตั้งค่า ส่วนที่เหลือจะแบ่งใหม่ให้คนที่ไม่ได้ล็อก</p><button type="button" id="selection-refresh" hidden>โหลดบิลล่าสุด</button><button type="button" id="selection-export" hidden>ดาวน์โหลดสิ่งที่แก้ไว้</button>',
    actions:[{label:'ยกเลิก',value:false,dismiss:true},{label:'บันทึก',className:'sheet-primary',id:'selection-save',disabled:true,run:async host=>{
      const applied=setPersonMenus(baseline,personId,[...selected]);
      const outcome=await session.commit(applied.bill,{baseRevision:revision,kind:'person-menus',mutationId});
      if(!['saved','unchanged'].includes(outcome.status)){
        if(['conflict','missing'].includes(outcome.status)){stale=true;host.body.querySelector('#selection-refresh').hidden=false;host.body.querySelector('#selection-export').hidden=false;host.footer.querySelector('#selection-save').dataset.wasDisabled='true';}
        throw Error(outcome.message);
      }
      await onSaved(outcome);return true;
    }}],
    mount:host=>{
      mountPersonMenuHeader(host);
      const input=host.body.querySelector('#person-menu-search'),list=host.body.querySelector('#person-menu-list'),preview=host.body.querySelector('#person-menu-preview'),save=host.footer.querySelector('#selection-save');
      const clearSearch=host.body.querySelector('#person-menu-clear');
      clearSearch.addEventListener('click',()=>{input.value='';input.focus({preventScroll:true});input.dispatchEvent(new Event('input',{bubbles:true}));});
      const selectAll=host.body.querySelector('#selection-all'),selectNone=host.body.querySelector('#selection-none');
      const summary=document.createElement('div');summary.className='person-menu-sheet-summary';summary.append(preview,host.body.querySelector('.person-menu-lock-note'));host.dialog.insertBefore(summary,host.footer);
      function draw(){
        clearSearch.hidden=!input.value;
        candidate=setPersonMenus(baseline,personId,[...selected]);const totals=calculate(candidate.bill),person=totals.people[personId];
        host.body.querySelector('#selection-count').textContent=`เลือก ${selected.size} จาก ${baseline.items.length} เมนู`;
        for(const [button,active] of [[selectAll,selected.size===baseline.items.length],[selectNone,selected.size===0]]){button.classList.toggle('act',active);button.setAttribute('aria-pressed',String(active));}
        const changed=!!candidate.changedItemIds.length;
        save.disabled=stale||!changed;
        preview.innerHTML=`ยอดที่ต้องจ่ายหลังบันทึก<strong>${money(person.total)} บาท</strong>`;
        list.replaceChildren();
        const filtered=baseline.items.map((it,index)=>({it,index})).filter(({it})=>it.name.toLocaleLowerCase('th').includes(query.trim().toLocaleLowerCase('th')));
        if(!filtered.length){list.innerHTML='<p>ไม่พบเมนูที่ค้นหา</p>';return;}
        for(const {it,index} of filtered.slice(0,limit)){
          const row=document.createElement('div');row.className='person-menu-row';
          const duplicate=baseline.items.filter(other=>other.name===it.name).length>1;
          row.innerHTML=`<label class="sheet-check"><input type="checkbox" data-item-id="${esc(it.id)}" ${selected.has(it.id)?'checked':''}><span>${esc(it.name||'ไม่มีชื่อเมนู')}${duplicate?' (รายการที่ '+(index+1)+')':''}<small>จำนวน ${it.quantity} · ราคาเมนู ${money(itemTotal(it))} บาท</small></span></label>`;
          const nextItem=candidate.bill.items.find(next=>next.id===it.id),assignment=nextItem.assignments.find(a=>a.personId===personId);
          if(candidate.removedLockedItemIds.includes(it.id)){const warning=document.createElement('p');warning.textContent='เมื่อเอาออก ส่วนแบ่งที่ล็อกไว้ของคนนี้จะถูกลบ';row.append(warning);}
          if(!itemTotal(it)){const warning=document.createElement('p');warning.textContent='เมนูนี้ยังไม่มีราคา';row.append(warning);}
          else if(assignment&&assignment.amountCents===0){const warning=document.createElement('p');warning.textContent='เลือกเมนูนี้แล้ว แต่ส่วนแบ่งเป็น 0 บาท เพราะยอดถูกล็อกไว้ครบแล้ว';const edit=document.createElement('button');edit.type='button';edit.textContent='แก้ส่วนแบ่ง';edit.onclick=()=>{editId=it.id;host.finish(changed?'settle-edit':'edit');};row.append(warning,edit);}
          row.querySelector('input').addEventListener('change',event=>{if(event.target.checked)selected.add(it.id);else selected.delete(it.id);const focusId=it.id;draw();list.querySelector(`[data-item-id="${CSS.escape(focusId)}"]`)?.focus({preventScroll:true});});list.append(row);
        }
        if(filtered.length>limit){const more=document.createElement('button');more.type='button';more.textContent='แสดงเพิ่ม';more.onclick=()=>{limit+=50;draw();};list.append(more);}
      }
      input.addEventListener('input',()=>{query=input.value;limit=50;draw();});
      selectAll.addEventListener('click',()=>{selected=new Set(baseline.items.map(item=>item.id));draw();});
      selectNone.addEventListener('click',()=>{selected.clear();draw();});
      host.body.querySelector('#selection-export').onclick=()=>{const name=session.record?.name??'บิลที่แก้ไว้';const raw=encodeBillFile({name,bill:candidate.bill});const url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=billFilename(name);a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
      host.body.querySelector('#selection-refresh').onclick=async()=>{
        if(host.busy)return;host.setBusy(true);
        try{
          const before=memberships(baseline,personId),added=[...selected].filter(id=>!before.has(id)),removed=[...before].filter(id=>!selected.has(id));
          const loaded=await session.load();await onRefreshed?.(loaded);if(loaded.status!=='loaded')throw Error(loaded.message);
          const latest=session.current;if(!latest.people.some(p=>p.id===personId))throw Error('ไม่พบรายชื่อคนนี้ในบิล');
          const latestSelected=memberships(latest,personId),live=new Set(latest.items.map(it=>it.id));
          added.filter(id=>live.has(id)).forEach(id=>latestSelected.add(id));removed.forEach(id=>latestSelected.delete(id));
          const removedCount=baseline.items.filter(it=>!live.has(it.id)).length;baseline=latest;revision=session.record.recordRevision;selected=latestSelected;stale=false;host.setBusy(false);
          host.setTitle(['แก้ไขเมนูที่ ',customName(latest.people.find(p=>p.id===personId).name),' กิน']);
          if(!latest.items.length){candidate=null;summary.remove();host.dialog.classList.remove('person-menu-sheet');host.clearError();host.body.innerHTML=emptyMessage;host.footer.replaceChildren();for(const action of emptyActions){const button=document.createElement('button');button.type='button';button.textContent=action.label;button.className=action.className||'';button.onclick=()=>host.finish(action.value);host.footer.append(button);}host.heading.focus({preventScroll:true});return;}
          draw();host.body.querySelector('#selection-refresh').hidden=true;host.error(`โหลดบิลล่าสุดแล้ว มีการเปลี่ยนแปลง ${added.length+removed.length} เมนู และเมนูที่ถูกลบ ${removedCount} เมนู เช็กก่อนบันทึก`);
        }catch(error){host.setBusy(false);host.error(error.message);}
      };
      draw();
    }});
  if(result==='menu')onGoToMenu();
  if(result==='edit')onEditItem(editId);
  if(result==='settle-edit'){
    const choice=await openSheet({title:'บันทึกการเลือกก่อนแก้ส่วนแบ่งไหม?',body:'<p>เลือกว่าจะบันทึกการเลือก หรือใช้ข้อมูลที่บันทึกอยู่</p>',actions:[{label:'ไม่บันทึกการเลือก',value:'discard'},{label:'บันทึกการเลือก',className:'sheet-primary',run:async()=>{const outcome=await session.commit(candidate.bill,{baseRevision:revision,kind:'person-menus',mutationId});if(!['saved','unchanged'].includes(outcome.status))throw Error(outcome.message);await onSaved(outcome);return 'saved';}}]});
    if(choice)onEditItem(editId);
  }
  return result;
}
