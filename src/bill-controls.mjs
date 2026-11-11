import {openSheet,customName,setSheetText} from './in-app-confirm.mjs';
import {isEmptyBillContent,isProtectedDefault} from './bill-operations.mjs';
import {billName} from './bill-repository.mjs';
import {calculate,money} from './bill-state.mjs';

const dateFormat=new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'short'});
const actions=[
  ['new','btn-newbill','สร้างบิลใหม่'],
  ['select','select-bill','เลือกบิล'],
  ['details','bill-details','รายละเอียดบิล'],
  ['import','restore-bill','นำเข้าบิลจากไฟล์'],
  ['download','backup-bill','ดาวน์โหลดไฟล์บิลนี้'],
  ['people','clear-people','ลบรายชื่อคนทั้งหมด'],
  ['dishes','clear-dishes','ลบเมนูอาหารทั้งหมด'],
  ['delete','delete-bill','ลบบิลนี้']
];
function element(tag,content){
  const node=document.createElement(tag);
  if(content!=null)node.textContent=content;
  return node;
}
function button(content){
  const node=element('button',content);
  node.type='button';
  return node;
}
function saveResult(outcome){
  if(!['saved','unchanged'].includes(outcome.status))throw Error(outcome.message||'ยังไม่ได้บันทึก ลองอีกครั้ง');
  return outcome.record;
}

export function createBillControls({repository,selector,actionsButton,getContext,bindAction,onSelect,onAction,onInspect,onRequestImport,onDownload,onError}){
  let active=null,keyboard=false,interaction=0;
  const lifetime=new AbortController(),events={capture:true,signal:lifetime.signal};
  const row=selector.closest('#bill-context');
  document.addEventListener('pointerdown',event=>{
    keyboard=false;interaction++;
    if(event.target.closest?.('#bill-selector-name'))close();
  },events);
  document.addEventListener('keydown',event=>{interaction++;if(!event.metaKey&&!event.ctrlKey&&!event.altKey)keyboard=true;},events);
  row.addEventListener('focusin',event=>{if(event.target.id==='bill-selector-name')close();},{signal:lifetime.signal});
  function fallback(){
    if(!actionsButton.disabled&&actionsButton.getClientRects().length)return actionsButton;
    const heading=document.getElementById('hdr-title');
    heading.tabIndex=-1;
    return heading;
  }

  function close({restoreFocus=false}={}){
    if(!active)return;
    const {trigger,panel,backdrop,scope,observer,frame}=active;
    active=null;
    scope.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
    panel.remove();
    backdrop.remove();
    trigger.setAttribute('aria-expanded','false');
    row.classList.remove('bill-panel-open');
    if(restoreFocus&&keyboard&&trigger.getClientRects().length)trigger.focus({preventScroll:true});
    else if(document.activeElement===trigger)trigger.blur();
  }

  function mountPanel(trigger,id){
    if(active?.trigger===trigger){close({restoreFocus:true});return null;}
    close();
    const panel=element('div'),backdrop=element('div');
    panel.id=id;
    panel.className='bill-panel';
    panel.tabIndex=-1;
    backdrop.className='bill-panel-backdrop';
    backdrop.setAttribute('aria-hidden','true');
    const scope=new AbortController(),signal=scope.signal;
    const anchor=trigger===selector?selector.closest('#bill-name-control'):trigger;
    const popup={trigger,panel,backdrop,scope,frame:0,anchor:null,keyboard};
    active=popup;
    row.classList.add('bill-panel-open');
    trigger.setAttribute('aria-expanded','true');
    document.body.append(backdrop,panel);
    function place(){
      if(active!==popup)return;
      const r=anchor.getBoundingClientRect(),bounds=row.getBoundingClientRect(),v=window.visualViewport;
      const safe=getComputedStyle(backdrop);
      const left=(v?.offsetLeft??0)+Math.max(8,parseFloat(safe.paddingLeft));
      const right=(v?.offsetLeft??0)+(v?.width??innerWidth)-Math.max(8,parseFloat(safe.paddingRight));
      const top=(v?.offsetTop??0)+Math.max(8,parseFloat(safe.paddingTop));
      const bottom=(v?.offsetTop??0)+(v?.height??innerHeight)-Math.max(8,parseFloat(safe.paddingBottom));
      const tabs=document.getElementById('top-tabs').getBoundingClientRect();
      if(!r.width||r.bottom<=Math.max(top,tabs.bottom)||r.top>=bottom||r.right<=left||r.left>=right){close();return;}
      // Measure natural label width before constraining it; wrapping and internal
      // scrolling take over when the usable viewport is smaller.
      panel.style.width='max-content';
      const width=Math.max(0,Math.min(trigger===selector?r.width:panel.getBoundingClientRect().width,bounds.width,right-left));
      panel.style.width=width+'px';
      panel.style.left=Math.max(left,Math.min(trigger===selector?r.left:r.right-width,right-width))+'px';
      const below=bottom-r.bottom-4,above=r.top-top-4;
      const preferBelow=below>=panel.scrollHeight||below>=above;
      const height=Math.max(0,preferBelow?below:above);
      panel.style.maxHeight=height+'px';
      panel.style.top=(preferBelow?r.bottom+4:r.top-4-panel.offsetHeight)+'px';
      popup.anchor=r;
    }
    function schedule(){
      cancelAnimationFrame(popup.frame);
      popup.frame=requestAnimationFrame(place);
    }
    function focusOption(node){
      if(!node)return;
      node.focus({preventScroll:true});
      const a=node.getBoundingClientRect(),b=panel.getBoundingClientRect();
      if(a.bottom>b.bottom)panel.scrollTop+=a.bottom-b.bottom;
      else if(a.top<b.top)panel.scrollTop+=a.top-b.top;
    }
    function scrolled(event){
      if(panel.contains(event.target))return;
      const r=anchor.getBoundingClientRect(),old=popup.anchor;
      if(old&&(Math.abs(r.left-old.left)>.5||Math.abs(r.top-old.top)>.5))close();
      else schedule();
    }
    popup.observer=new ResizeObserver(schedule);
    popup.observer.observe(trigger);
    popup.observer.observe(row);
    popup.observer.observe(panel);
    backdrop.addEventListener('click',()=>close(),{signal});
    document.addEventListener('scroll',scrolled,{capture:true,passive:true,signal});
    window.addEventListener('resize',schedule,{signal});
    window.visualViewport?.addEventListener('resize',schedule,{signal});
    window.visualViewport?.addEventListener('scroll',schedule,{signal});
    document.fonts?.addEventListener('loadingdone',schedule,{signal});
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close({restoreFocus:true});return;}
      if(event.key==='Tab'){close({restoreFocus:true});return;}
      if((!panel.contains(event.target)&&event.target!==trigger&&event.target!==document.body)||!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      const items=[...panel.querySelectorAll('button:not(:disabled)')];
      if(!items.length)return;
      event.preventDefault();
      const index=items.indexOf(document.activeElement);
      const next=event.key==='Home'?0:event.key==='End'?items.length-1:index<0?(event.key==='ArrowDown'?0:items.length-1):(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
      focusOption(items[next]);
    },{capture:true,signal});
    return Object.assign(popup,{place,focusOption});
  }

  function openSelector(){
    const popup=mountPanel(selector,'bill-selection-panel');
    if(!popup)return;
    popup.panel.append(element('p','กำลังเปิดรายการบิล…'));
    popup.place();
    if(active===popup)void populateSelector(popup);
  }
  async function populateSelector(popup){
    const {panel,place,focusOption}=popup;
    try{
      const {records,damaged}=await repository.list();
      if(active!==popup)return;
      const list=element('div');
      list.id='bill-selection-list';
      list.setAttribute('role','listbox');
      list.setAttribute('aria-label','บิลที่บันทึกไว้');
      const current=getContext().record?.id;
      const entries=records.map(record=>{
        const bill=record.bill;
        const meta=dateFormat.format(record.updatedAt)+' · '+bill.people.length+' คน · '+bill.items.length+' เมนู · '+money(calculate(bill).grand)+' บาท';
        return {record,meta,key:JSON.stringify([record.name,meta])};
      });
      const counts=new Map();
      for(const {key} of entries)counts.set(key,(counts.get(key)??0)+1);
      for(const {record,meta,key} of entries){
        const option=button();
        option.setAttribute('role','option');
        option.setAttribute('aria-selected',String(record.id===current));
        option.tabIndex=-1;
        option.dataset.billId=record.id;
        option.append(element('strong',record.name+(record.id===current?' (กำลังเปิด)':'')),element('small',meta+(counts.get(key)>1?' · '+record.id.slice(0,8):'')));
        bindAction(option,()=>{
          if(active!==popup)return;
          close({restoreFocus:true});
          if(record.id!==getContext().record?.id)return onSelect(record.id);
        });
        list.append(option);
      }
      panel.replaceChildren(list);
      if(!records.length)panel.append(element('p','ยังไม่มีบิลที่เปิดได้'));
      if(damaged.length){
        const unavailable=element('section');
        unavailable.setAttribute('aria-label','บิลที่เปิดไม่ได้');
        unavailable.append(element('p','บิลที่เปิดไม่ได้'));
        for(const {id,raw} of damaged){
          const inspect=button('ตรวจสอบ '+(typeof raw.name==='string'&&raw.name.trim()?raw.name:'บิลที่เปิดไม่ได้'));
          inspect.tabIndex=-1;
          bindAction(inspect,()=>{
            if(active!==popup)return;
            close({restoreFocus:true});
            return onInspect(id);
          });
          unavailable.append(inspect);
        }
        panel.append(unavailable);
      }
      place();
      if(active===popup&&popup.keyboard&&keyboard)focusOption(list.querySelector('[aria-selected=true]')??panel.querySelector('button')??panel);
    }catch(error){
      if(active===popup){close({restoreFocus:true});onError(error.message);}
    }
  }
  function disabled(kind,context){
    if(kind==='new'||kind==='import')return context.mutationBlocked;
    if(!context.record)return true;
    if(['download','details','select'].includes(kind))return false;
    if(kind==='delete'&&active?.deleteProtected)return true;
    return context.mutationBlocked||(kind==='people'&&!context.canClearPeople)||(kind==='dishes'&&!context.canClearDishes);
  }
  function openActions(){
    const popup=mountPanel(actionsButton,'bill-actions-menu');
    if(!popup)return;
    const {panel,place,focusOption}=popup;
    panel.setAttribute('role','menu');
    panel.setAttribute('aria-labelledby','bill-actions');
    for(const [kind,id,label] of actions){
      if(kind==='import'||kind==='people'){
        const divider=element('div');
        divider.setAttribute('role','separator');
        panel.append(divider);
      }
      const item=button(label);
      item.id=id;
      item.dataset.billAction=kind;
      item.setAttribute('role','menuitem');
      item.tabIndex=-1;
      if(['people','dishes','delete'].includes(kind))item.className='danger-action';
      const target=getContext().record;
      if(kind==='import')item.onclick=()=>{
        close({restoreFocus:true});
        onRequestImport();
      };
      else bindAction(item,()=>{
        if(active!==popup)return;
        close({restoreFocus:true});
        return kind==='select'?openSelector():onAction(kind,target);
      });
      panel.append(item);
    }
    popup.deleteProtected=true;
    void repository.list().then(library=>{if(active!==popup)return;popup.deleteProtected=isProtectedDefault(getContext().record,library);refresh();}).catch(error=>{if(active===popup)onError(error.message);});
    refresh();
    place();
    if(active===popup&&popup.keyboard&&keyboard)focusOption(panel.querySelector('button:not(:disabled)')??panel);
  }
  function refresh(context=getContext()){
    selector.disabled=!context.available;
    actionsButton.disabled=!context.available;
    actionsButton.setAttribute('aria-label',context.record?'ตัวเลือกบิล '+context.record.name:'ตัวเลือกบิล');
    if(active?.trigger===actionsButton){
      for(const item of active.panel.querySelectorAll('[data-bill-action]'))item.disabled=disabled(item.dataset.billAction,context);
    }
  }

  function nameField(host,name){
    const label=element('label','ชื่อบิล'),input=element('input');
    label.htmlFor='bill-name';
    input.id='bill-name';
    input.name='bill-name';
    input.type='text';
    input.autocomplete='off';
    input.value=name;
    host.body.prepend(label,input);
    return input;
  }
  function enteredName(input){
    try{const name=billName(input.value);input.removeAttribute('aria-invalid');return name;}
    catch(error){input.setAttribute('aria-invalid','true');throw error;}
  }
  const cancel={label:'ยกเลิก',value:false};
  const replaceLabel='ลบบิลเดิมและสร้างบิลใหม่';
  function chooseNew(target){
    return openSheet({
      title:'สร้างบิลใหม่',className:'new-bill-sheet',fallback,
      mount:host=>{setSheetText(host.body,['บิล ',customName(target.name),' บันทึกอัตโนมัติในเบราว์เซอร์นี้แล้ว สามารถเปิดอีกครั้งได้จากปุ่ม ',customName('เลือกบิล')]);},
      actions:[
        {label:'บันทึกและสร้างบิลใหม่',value:'save',className:'sheet-primary'},
        {label:replaceLabel,value:'delete',className:'sheet-danger'},
        cancel
      ]
    });
  }
  async function confirmDelete(target,operation,{canReuse=()=>false}={}){
    let captured=target;
    if(!operation.createReplacement&&isProtectedDefault(target,await repository.list()))return null;
    if(!operation.createReplacement&&isEmptyBillContent(captured.bill)){
      const outcome=operation.outcome=await repository.removeAndSelect({...operation,expectedRevision:captured.recordRevision});
      if(outcome.status==='saved')return outcome;
      if(outcome.status==='conflict'&&outcome.record&&!isEmptyBillContent(outcome.record.bill))captured=outcome.record;
      else{onError(outcome.message);return null;}
    }
    const title=()=> operation.createReplacement?replaceLabel+'?':['ลบบิล ',customName(captured.name),' ใช่ไหม?'];
    function explain(host){
      const body=operation.createReplacement
        ?['บิล ',customName(captured.name),' และข้อมูลทั้งหมดในบิลนี้จะถูกลบก่อนที่จะสร้างบิลใหม่']
        :'บิลนี้ รวมถึงรายชื่อ '+captured.bill.people.length+' คน เมนู '+captured.bill.items.length+' รายการ และข้อมูลการหารจ่ายจะถูกลบ บิลอื่นและไฟล์ที่ดาวน์โหลดไว้จะยังอยู่';
      setSheetText(host.body,body);
      const warning=element('span','(ไม่สามารถย้อนกลับได้)');warning.className='sheet-irreversible';host.heading.append(warning);
    }
    return openSheet({title:title(),fallback,mount:explain,
      actions:[cancel,{label:operation.createReplacement?'ลบและสร้างบิลใหม่':'ลบบิลนี้',className:'sheet-danger',run:async host=>{
        const outcome=operation.outcome?.status==='uncertain'?await repository.reconcileOperation(operation)
          :await repository.removeAndSelect({...operation,expectedRevision:captured.recordRevision,allowReuse:canReuse()});
        operation.outcome=outcome;
        if(outcome.status==='conflict'&&outcome.record){
          captured=outcome.record;
          host.setTitle(title());
          explain(host);
          throw Error('บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดแล้วกด'+(operation.createReplacement?'ลบและสร้างบิลใหม่':'ลบบิลนี้')+'อีกครั้ง');
        }
        if(outcome.status==='missing')host.footer.querySelector('.sheet-danger').disabled=true;
        if(outcome.status==='uncertain')host.footer.querySelector('.sheet-danger').textContent='ตรวจสอบการลบ';
        if(!['saved','reused'].includes(outcome.status))throw Error(outcome.message);
        return outcome;
      }}]});
  }

  async function importFile({name,bill},filename,operation){
    let input;
    return openSheet({title:'นำเข้าบิลจากไฟล์',fallback,mount:host=>{
      input=nameField(host,name??(filename.replace(/\.[^.]*$/,'')||'บิลนำเข้า'));
      host.body.append(element('p',bill.people.length+' คน · '+bill.items.length+' เมนู · '+money(calculate(bill).grand)+' บาท'));
    },actions:[cancel,{label:'เพิ่มเป็นบิลใหม่',className:'sheet-primary',run:async host=>{
      const outcome=operation.outcome?.status==='uncertain'?await repository.reconcileOperation(operation)
        :await repository.create({...operation,name:enteredName(input),bill:{...bill,undo:null}});
      operation.outcome=outcome;
      if(outcome.status==='uncertain'){
        input.disabled=true;
        host.footer.querySelector('.sheet-primary').textContent='ตรวจสอบการบันทึก';
      }
      return saveResult(outcome);
    }}]});
  }

  async function details(target){
    return openSheet({title:'รายละเอียดบิล',className:'bill-details-sheet',fallback,actions:[{label:'ปิด'}],mount:host=>{
      const facts=element('dl'),notice=element('p'),refreshButton=button('เปิดข้อมูลล่าสุด');
      notice.setAttribute('role','status');
      refreshButton.hidden=true;
      const note=element('p','บิลบันทึกอัตโนมัติในเบราว์เซอร์นี้ หากล้างข้อมูลเบราว์เซอร์ ข้อมูลบิลอาจหายไป กดปุ่ม “ดาวน์โหลดไฟล์บิลนี้” เพื่อสำรองหรือย้ายเครื่อง');
      host.body.append(facts,notice,refreshButton,note);
      let snapshot=target,generation=0;
      function show(record){
        const bill=record.bill,{grand,unallocated}=calculate(bill);
        facts.replaceChildren();
        for(const [label,value] of [
          ['ชื่อบิล',record.name],['สร้างเมื่อ',dateFormat.format(record.createdAt)],['แก้ไขล่าสุด',dateFormat.format(record.updatedAt)],
          ['รายชื่อคน',bill.people.length+' คน'],['เมนูอาหาร',bill.items.length+' เมนู'],
          ['ยอดที่ต้องจ่าย',money(grand)+' บาท'],['ยังแบ่งจ่ายไม่ครบ',money(unallocated)+' บาท']
        ])facts.append(element('dt',label),element('dd',value));
      }
      show(snapshot);
      const scope=new AbortController(),signal=scope.signal;
      async function check(refresh=false){
        const token=++generation;
        try{
          const next=await repository.read(target.id);
          if(signal.aborted||token!==generation)return;
          if(!next)throw Error('ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์');
          if(refresh){snapshot=next;show(next);}
          refreshButton.hidden=next.recordRevision===snapshot.recordRevision;
          notice.textContent=refreshButton.hidden?'':'บิลนี้มีการเปลี่ยนแปลง เปิดข้อมูลล่าสุดเพื่อดูรายละเอียดใหม่';
        }catch(error){
          if(signal.aborted||token!==generation)return;
          facts.replaceChildren();
          notice.textContent=error.message;
          refreshButton.hidden=false;
        }
      }
      const checkChange=()=>check();
      refreshButton.onclick=()=>check(true);
      window.addEventListener('focus',checkChange,{signal});
      document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();},{signal});
      let channel;
      try{
        channel=new BroadcastChannel('fairshare-library');
        channel.addEventListener('message',event=>{if(event.data?.id===target.id)check();},{signal});
      }catch{}
      check();
      return ()=>{scope.abort();channel?.close();};
    }});
  }
  async function evidence({sources,unavailable}){
    return openSheet({title:'ตรวจสอบข้อมูลเดิม',fallback,actions:[{label:'ปิด'}],mount:host=>{
      if(!sources.length)host.body.append(element('p','ไม่พบข้อมูลเดิมที่ดาวน์โหลดได้'));
      sources.forEach((source,index)=>{
        const section=element('section'),label=element('p',source.label),download=button('ดาวน์โหลดข้อมูลเดิม');
        section.className='bill-evidence-source';
        download.onclick=()=>onDownload({text:source.raw,filename:'หารจ่ายแฟร์ๆ-evidence-'+(index+1)+'.json'});
        section.append(label,download);
        if(source.candidate&&getContext().available&&!getContext().mutationBlocked){
          const copy=button('ตรวจสอบและเพิ่มเป็นบิลใหม่');
          copy.onclick=()=>host.finish(source.candidate);
          section.append(copy);
        }
        host.body.append(section);
      });
      if(unavailable.length)host.body.append(element('p','เปิดข้อมูลบางส่วนไม่ได้: '+unavailable.join(', ')));
    }});
  }
  return {openSelector,openActions,close,refresh,get keyboard(){return keyboard;},get interaction(){return interaction;},dispose:()=>{close();lifetime.abort();},chooseNew,confirmDelete,importFile,details,evidence};
}

// A name edit owns its captured bill/revision until it saves or is cancelled.
// Navigation calls settle(); failures never silently retry on a second blur.
