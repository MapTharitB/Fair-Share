import {esc,fmt,fmtComma,displayRate,fP,getItemTotal} from './bill-display.mjs';
import {getItemWarnings,getSplitLabel,getPersonWarning,categorizeWarns,ZERO_SHARE_SUFFIX} from './bill-warnings.mjs';
import {downloadSummaryImage} from './summary-image.mjs';
import {createMainScroll,reserveBottomAction,observeStickyHeading} from './main-layout.mjs';
import {measureChoiceGroup,observeChoices,layoutAdjustments} from './choice-layout.mjs';
import {readBillFile,encodeBillFile,billFilename} from './backup-file.mjs';
import {openBillRepository} from './bill-repository.mjs';
import {createBillControls,createBillNameEditor} from './bill-controls.mjs';
import {readBillEvidence,DEVELOPMENT_WORK_KEYS} from './bill-evidence.mjs';
import {openPersonMenus} from './person-menu-dialog.mjs';
import {clearPeople,clearDishes,setPersonMenus} from './bill-operations.mjs';
import {openSheet,sheetOpen,customName,setSheetText,confirmDiscard} from './in-app-confirm.mjs';
import {createBillSession,purgeBillWork} from './bill-session.mjs';
import {createHistory,sameValue} from './history.mjs';
import {createEditorActions} from './editor-actions.mjs';
import {mountHistoryControls} from './history-controls.mjs';

import {approvedState,approvedBill,approvedShares,approvedBillTotals,recalculateApprovedItem} from './approved-ui-bridge.mjs';
import {numericInputs as NI} from './numeric-bindings.mjs';
import {emptyBill,newId} from './bill-state.mjs';
let storedBill=emptyBill(),storageBlocked=false;
let invalidCandidate=false;
let repository=null,billSession=null,controls=null,nameEditor=null,pendingSave=null,pendingCandidate=null,actionBusy=false,installGeneration=0,storageError='',saveOutcome=null,missingTarget=null;
let entryPhase='loading',opening=false,openingTarget=null,pendingBillOperation=null,versionBlocked=false,separateStart=false;

let tabStorage;try{tabStorage=sessionStorage;}catch{}

const editors=createEditorActions();
const mainScroll=createMainScroll({storage:tabStorage,getEpoch:()=>billSession?.billId});
let bottomCleanup=()=>{};
let distributionCleanup=()=>{};
let headerHistory;
function currentItem(){return session?.draft??S.items.find(i=>i.id===activeItemId);}
function recordItem(){if(session&&!editors.composing){session.history.record(session.draft);session.isDirty=!sameValue(session.draft,session.baseline);updateHistory();}}
function updateHistory(){
  if(!headerHistory||distributionSaving)return;
  const itemView=view==='item-detail';
  const history=itemView?session?.history:billSession;
  const pending=itemView&&session&&!sameValue(session.draft,session.history.current);
  const host=document.getElementById('header-history'),header=document.getElementById('hdr');
  const title=document.getElementById('hdr-title'),price=document.getElementById('hdr-item-total'),back=document.getElementById('btn-back');
  host.hidden=view==='people';
  const buttonStyle=getComputedStyle(host.firstElementChild);
  const font=buttonStyle.fontWeight+' '+buttonStyle.fontSize+' '+buttonStyle.fontFamily;
  const labelWidth=Math.max(measureTW('ย้อนกลับ',font),measureTW('ทำซ้ำ',font));
  host.style.setProperty('--history-label-width',labelWidth+'px');
  const headerStyle=getComputedStyle(header);
  const gap=parseFloat(headerStyle.columnGap)||0;
  const titleWidth=itemView?Math.min(title.scrollWidth,160)+back.offsetWidth+8
    :[...title.children].reduce((sum,node)=>sum+node.scrollWidth,3);
  const priceWidth=price.offsetWidth;
  const available=header.clientWidth-parseFloat(headerStyle.paddingLeft)-parseFloat(headerStyle.paddingRight)-titleWidth-priceWidth-gap*(priceWidth?2:1);
  const wrapped=!host.hidden&&available<92;
  header.classList.toggle('history-wrapped',wrapped);
  const blocked=opening||operationUncertain()||(!itemView&&storageBlocked);
  headerHistory.update({
    canUndo:!blocked&&(!!history?.canUndo||!!pending),
    canRedo:!blocked&&!!history?.canRedo&&!pending,
    compact:2*(labelWidth+39)+4>(wrapped?header.clientWidth-parseFloat(headerStyle.paddingLeft)-parseFloat(headerStyle.paddingRight):available)
  });
}
function syncMainStickyOffsets(){
  const header=document.getElementById('hdr'),tabs=document.getElementById('top-tabs');
  const height=header.getBoundingClientRect().height,tabHeight=tabs.getBoundingClientRect().height;
  document.documentElement.style.setProperty('--main-header-height',height+'px');
  document.documentElement.style.setProperty('--main-summary-top',height+tabHeight+'px');
}
async function moveHistory(direction){
  if(opening||operationUncertain()||storageBlocked&&view!=='item-detail')return;
  if(view==='item-detail'&&session){recordItem();session.draft=session.history[direction]();session.isDirty=!sameValue(session.draft,session.baseline);renderItemDetail();}
  else if(billSession){setSaving(true);pendingSave=billSession[direction]();updateBillContext();let accepted=false;try{accepted=acceptBill(await pendingSave);}finally{pendingSave=null;setSaving(false);updateBillContext();}if(accepted)render();}
  updateHistory();
}
function acceptBill(result){
  saveOutcome=result.status;
  if(!['saved','unchanged'].includes(result.status)){storageError=result.message;updateBillContext();toast('ยังไม่ได้บันทึก: '+result.message);return false;}
  const completed=pendingCandidate?.peopleEdit;
  if(completed?.kind==='add'&&peopleDraft.add.trim()===completed.name)peopleDraft.add='';
  if(completed?.kind==='rename'&&peopleDraft.rename?.id===completed.id&&peopleDraft.rename.value.trim()===completed.name){peopleDraft.rename=null;editingPid=null;}
  pendingCandidate=null;invalidCandidate=false;storageError='';for(const input of document.querySelectorAll('#app .screen.active [data-unsaved]'))delete input.dataset.unsaved;
  storedBill=result.bill;S=approvedState(storedBill);invalidateBT();pruneCollapsedPeople();updateBillTotals();if(result.message)toast(result.message);updateHistory();updateBillContext();return true;
}
function adoptRefreshed(result){
  if(result.status==='loaded'){storedBill=result.bill;S=approvedState(storedBill);storageError='';invalidateBT();pruneCollapsedPeople();render();updateHistory();}
  else if(result.status==='missing')markMissing(billSession,result.message);
  else{storageError=result.message;updateBillContext();}
}

// ─── 1. ICON CONSTANTS ────────────────────────────────────────────────────────
const ICONS={
  lock:`<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  unlock:`<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
  bin:`<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  download:`<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  plus:`<svg viewBox="0 0 24 24" style="width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  camera:`<svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
};

// ─── 2. BILLSPLIT NAMED CONSTANTS ─────────────────────────────────────────────
const MAX_PRICE=999999.99;
const TOAST_DURATION_MS=2200;
const SPLIT_GRID='grid-template-columns:80px 3fr 2fr 32px;gap:6px';

// ─── 3. SHARED UTILITIES ──────────────────────────────────────────────────────
const round=(v,d)=>{const f=10**d;return Math.round(v*f)/f;};
const r4=v=>round(v,4);
const gid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const clone=o=>JSON.parse(JSON.stringify(o));
// ─── 4. STATE ─────────────────────────────────────────────────────────────────
let S={people:[],items:[],tax:{value:7,enabled:false},service:{value:10,enabled:false},discount:{mode:'percent',value:0,placement:'after_sc_vat'},serviceDist:'equal',discountDist:'equal'};

let collapsedPeople=new Set();
let view='menu',prevView='menu',activeItemId=null,session=null,editingPid=null,peopleReturnTo=null;
let peopleDraft={add:'',rename:null};
function capturePeopleDraft(){if(view!=='people')return;const add=document.getElementById('np-inp');if(add)peopleDraft.add=add.value;const edit=editingPid&&document.getElementById('ep-'+editingPid);if(edit)peopleDraft.rename={id:editingPid,value:edit.value};}
function hasPeopleDraft(){return !!(peopleDraft.add.trim()||peopleDraft.rename||editingPid);}
function enterPeople(opener){
  peopleReturnTo={billId:billSession.billId,view,itemId:view==='item-detail'?activeItemId:null,scroll:{x:scrollX,y:scrollY},opener:opener?.id};
  recordItem();editingPid=null;peopleDraft={add:'',rename:null};goto('people');
}
function bindPeopleEntry(element){
  if(!element)return;
  bindBillAction(element,()=>enterPeople(document.getElementById(element.id)));
  if(element.tagName!=='BUTTON'){element.setAttribute('role','button');element.tabIndex=0;element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();editors.run(()=>runBillAction(()=>enterPeople(document.getElementById(element.id))));}});}
}
let chipLayoutObserver=null,chipLayoutRAF=0,doneObserver=null,resizeRAF=0,warnAreaObserver=null,warnRebuildRAF=0;
let _lastTwoLine=null,summaryHintDismissed=false;
let _peoplePageRendered=false,nameEnterHeld=false;
addEventListener('keyup',event=>{if(event.key==='Enter')nameEnterHeld=false;},true);

// ─── 6. HELPERS ───────────────────────────────────────────────────────────────
const _twMemo=new Map();
function measureTW(text,font='400 13px "Sarabun",sans-serif'){
  const key=font+'|'+text;if(_twMemo.has(key))return _twMemo.get(key);
  const c=measureTW._c||(measureTW._c=document.createElement('canvas'));
  const ctx=c.getContext('2d');ctx.font=font;
  const w=ctx.measureText(text).width;_twMemo.set(key,w);return w;
}

function isItemDetailTwoLine(){const el=document.getElementById('screen-item-detail');const w=el&&el.clientWidth>50?el.clientWidth:window.innerWidth;return w<580;}

// ─── 7. BILLSPLIT LOGIC ───────────────────────────────────────────────────────
let _btCache=null;
function invalidateBT(){_btCache=null;}
function getCachedBT(){return _btCache??(_btCache=getBT());}

function applyC(item){const result=recalculateApprovedItem(item);item.assignments=result.item.assignments;return result.overallocated;}
function getDA(item){return approvedShares(item);}


function pruneCollapsedPeople(){const live=new Set(S.people.map(p=>p.id));collapsedPeople=new Set([...collapsedPeople].filter(id=>live.has(id)));}
let savingFocus=null,distributionSaving=false,savingControls=[];
// Distribution commits retain native focus and visual availability. Block the
// next activation before the shared document action dispatcher can queue it.
for(const type of ['pointerdown','pointerup','click','keydown','beforeinput'])window.addEventListener(type,event=>{
  if(!distributionSaving||!event.target.closest?.('#app')||!event.target.closest?.('button,input,a,label,[role=button]'))return;
  if(type==='keydown'&&event.key==='Tab')return;
  event.preventDefault();event.stopImmediatePropagation();
},{capture:true});
function setSaving(value,{distribution=false}={}){
  if(value)savingFocus=document.activeElement;
  const app=document.getElementById('app');if(value)app.setAttribute('aria-busy','true');else app.removeAttribute('aria-busy');
  if(value&&distribution){
    distributionSaving=true;
    savingControls=[...app.querySelectorAll('button,input')].filter(n=>!n.disabled).map(node=>({node,aria:node.getAttribute('aria-disabled')}));
    for(const {node} of savingControls)node.setAttribute('aria-disabled','true');
    return;
  }
  if(!value&&distributionSaving){
    for(const {node,aria} of savingControls)if(aria===null)node.removeAttribute('aria-disabled');else node.setAttribute('aria-disabled',aria);
    savingControls=[];distributionSaving=false;savingFocus=null;return;
  }
  for(const control of app.querySelectorAll('button,input')){if(value){if(control.id==='np-inp'&&view==='people'&&document.activeElement===control)continue;control.dataset.saveDisabled=String(control.disabled);control.disabled=true;}else if(control.dataset.saveDisabled!=null){control.disabled=control.dataset.saveDisabled==='true';delete control.dataset.saveDisabled;}}
  if(!value&&savingFocus?.isConnected&&savingFocus.matches('input[type=radio],input[type=checkbox]')&&!savingFocus.disabled)savingFocus.focus({preventScroll:true});
}
async function commitCandidate(candidate,options={}){
  if(pendingSave||opening||storageBlocked||operationUncertain())return false;
  const target=billSession;if(!target)return false;
  const staged={bill:structuredClone(candidate),baseRevision:options.baseRevision??target.record.recordRevision,mutationId:options.mutationId??newId(),kind:options.kind??'edit',id:target.billId,peopleEdit:options.peopleEdit};pendingCandidate=staged;
  setSaving(true,{distribution:options.kind==='distribution'});storageError='';
  pendingSave=target.commit(staged.bill,staged);updateBillContext();
  try{const result=await pendingSave;if(target!==billSession)return false;return acceptBill(result);}
  finally{pendingSave=null;setSaving(false);updateBillContext();updateHistory();}
}
async function saveS(options={}){
  if(storageBlocked||!billSession){toast('ยังเปิดบิลนี้เพื่อบันทึกไม่ได้ ตรวจสอบข้อมูลเดิมก่อน');return false;}
  try{return await commitCandidate(approvedBill(S,storedBill),options);}
  catch(error){invalidCandidate=true;storageError=error.message;updateBillContext();toast('ยังไม่ได้บันทึก: '+error.message);return false;}
}
async function runBillAction(action,{allowPending=false,preserveGesture=false}={}){
  if(actionBusy||opening)return;actionBusy=true;
  try{
    document.activeElement?.blur?.();
    // Clean item entry must focus inside its initiating gesture on Safari.
    if(!preserveGesture)await Promise.resolve();
    if(nameEditor?.unsettled&&!await nameEditor.settle())return;
    if(pendingSave)await pendingSave;
    if((pendingCandidate||invalidCandidate)&&!allowPending){toast('ยังไม่ได้บันทึก ลองอีกครั้งหรือดาวน์โหลดสิ่งที่แก้ไว้ก่อน');return;}
    return await action();
  }catch(error){toast(error.message);}finally{actionBusy=false;if(externalCheckQueued)void checkExternalBill();}
}
function bindBillAction(button,action,options){if(button)editors.bind(button,()=>runBillAction(action,options));}
function uiKey(){return 'fairshare.ui.v2:'+billSession?.billId;}
function saveUiState(){if(!billSession)return;try{tabStorage?.setItem(uiKey(),JSON.stringify({collapsed:[...collapsedPeople],summaryHintDismissed}));}catch{}}
const operationUncertain=()=>pendingBillOperation?.outcome?.status==='uncertain';
function billControlContext(){
  const record=missingTarget===billSession?.billId?null:billSession?.record;
  const cleared=record&&clearDishes(record.bill);
  const canClearDishes=cleared&&(!sameValue(cleared.items,record.bill.items)||!sameValue(cleared.groups,record.bill.groups));
  return {
    available:!!repository&&!versionBlocked&&!opening&&(!pendingSave||distributionSaving),
    mutationBlocked:operationUncertain()||!!pendingCandidate||invalidCandidate||versionBlocked,
    record,canClearDishes,canClearPeople:!!record?.bill.people.length
  };
}
function updateBillContext(){
  const row=document.getElementById('bill-context');
  if(!row)return;
  row.hidden=view==='people'||view==='item-detail';
  const draft=!!document.querySelector('#app .screen.active [data-unsaved]')||!!session?.isDirty||!!session?.isNew||!!editingPid||!!document.activeElement?.matches('#screen-item-detail input,#screen-people input,#np-inp:not(:placeholder-shown),#adj-svc,#adj-tax,#adj-disc');
  const problem=operationUncertain()?pendingBillOperation.outcome.message:storageError;
  document.getElementById('save-problem').hidden=!(billSession&&problem)&&!operationUncertain()&&!openingTarget;
  document.getElementById('save-error-message').textContent=problem||openingTarget?.message||'';
  document.getElementById('retry-save').hidden=!pendingCandidate||storageBlocked||['conflict','missing','uncertain'].includes(saveOutcome);
  document.getElementById('export-unsaved').hidden=!billSession||(!pendingCandidate&&!invalidCandidate&&!draft&&!hasPeopleDraft());
  document.getElementById('reload-bill').hidden=!openingTarget&&(!billSession||!storageError||operationUncertain());
  document.getElementById('reload-bill').textContent=openingTarget?'ลองเปิดบิลอีกครั้ง':'เปิดบิลล่าสุด';
  document.getElementById('retry-operation').hidden=!operationUncertain();
  document.getElementById('export-evidence').hidden=!billSession||!storageError;
  document.getElementById('separate-bill').hidden=!separateStart||!billSession||operationUncertain();
  document.getElementById('main').inert=opening||!!billSession&&operationUncertain();
  document.getElementById('top-tabs').inert=opening;
  controls?.refresh();nameEditor?.refresh();
}
function setOpening(value){
  opening=value;
  const app=document.getElementById('app');
  if(value)app.setAttribute('aria-busy','true');
  else app.removeAttribute('aria-busy');
  updateBillContext();
  updateHistory();
}
async function installBill(id,targetView,{reason='switch'}={}){
  const generation=++installGeneration;
  setOpening(true);
  try{
    const next=createBillSession({repository,billId:id,sessionStorage:tabStorage}),loaded=await next.load();
    if(generation!==installGeneration)return false;
    if(loaded.status!=='loaded'){
      const message=reason==='created'?'บันทึกบิลใหม่แล้ว แต่ยังเปิดไม่ได้: '+loaded.message
        :reason==='deleted'?'ลบบิลแล้ว แต่ยังเปิดบิลถัดไปไม่ได้: '+loaded.message:loaded.message;
      if(reason==='created'||reason==='deleted'||billSession&&loaded.status==='failed'){
        openingTarget={id,targetView,reason,message};
      }
      if(billSession){toast(message);return false;}
      missingTarget=id;
      storageBlocked=true;
      storageError=message;
      entryPhase=loaded.status==='missing'?'missing':'unavailable';
      goto('menu');
      return false;
    }
    mainScroll.leave();
    saveUiState();
    billSession=next;
    missingTarget=null;
    openingTarget=null;
    storedBill=loaded.bill;
    S=approvedState(storedBill);
    storageBlocked=false;
    storageError='';
    entryPhase='ready';
    separateStart=false;
    pendingCandidate=null;
    invalidCandidate=false;
    session=null;
    editingPid=null;
    peopleReturnTo=null;
    peopleDraft={add:'',rename:null};
    saveOutcome=null;
    collapsedPeople.clear();
    summaryHintDismissed=false;
    try{
      const ui=JSON.parse(tabStorage?.getItem(uiKey())||'null');
      collapsedPeople=new Set(ui?.collapsed??[]);
      summaryHintDismissed=!!ui?.summaryHintDismissed;
    }catch{}
    pruneCollapsedPeople();
    clearChipWidthCache();
    _twMemo.clear();
    
    invalidateBT();
    const url=new URL(location.href);
    url.searchParams.set('bill',id);
    url.searchParams.delete('select');
    history.replaceState(history.state,'',url);
    if(reason==='switch'||reason==='created')await repository.writeLastSelected(id);
    goto(targetView??(view==='summary'?'summary':'menu'));
    return true;
  }finally{
    if(generation===installGeneration)setOpening(false);
  }
}
function downloadText(text,filename,type='application/json'){
  const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('เริ่มดาวน์โหลดแล้ว');
}
function exportCandidate(){
  const name=billSession?.record?.name??'ข้อมูลกู้คืน';
  capturePeopleDraft();
  if(hasPeopleDraft()){downloadText(JSON.stringify({format:'fairshare-unsaved-recovery',billId:billSession?.billId,bill:pendingCandidate?.bill??storedBill,peopleDraft,itemDraft:session?.draft},null,2),'หารจ่ายแฟร์ๆ-unsaved-recovery.json');return;}
  try{if(session&&!session.draft.name.trim())throw Error('ยังไม่มีชื่อเมนู');const candidate=pendingCandidate?.bill??(session?approvedBill({...S,items:[...S.items.filter(it=>it.id!==session.draft.id),session.draft]},storedBill):storedBill);downloadText(encodeBillFile({name,bill:candidate}),billFilename(name));}
  catch{downloadText(JSON.stringify({format:'fairshare-unsaved-recovery',billId:billSession?.billId,itemDraft:session?.draft,ui:S},null,2),'หารจ่ายแฟร์ๆ-unsaved-recovery.json');}
}
const getWarns=item=>getItemWarnings(item,S.people);
const getSplitLbl=item=>getSplitLabel(item,S.people);
const getPWarn=pid=>getPersonWarning(pid,S,getCachedBT());
function isItemDefault(item){return !item.name.trim()&&(!item.price||item.price<=0)&&(!item.assignments||!item.assignments.length);}

function getBT(){try{return approvedBillTotals(S,storedBill);}catch(error){toast(error.message);return null;}}

function setAllocation(item,pid,value,mode){
  const a=item.assignments.find(a=>a.personId===pid);if(!a)return;
  a.locked=true;a.lockMode=mode==='amt'?'amount':'percentage';
  if(mode==='amt'){a.amount=Math.round(value*100)/100;delete a.lockPercentUnits;}
  else a.lockPercentUnits=Math.round(Math.min(value,100)*10000);
  applyC(item);
}
function livePreviewSplit(item,pid,value,mode){const preview=clone(item);setAllocation(preview,pid,value,mode);syncAssignmentRows(preview);}
function bindItemSplitInput(inp,item,mode){
  let edited=false;
  const parseValue=()=>mode==='amt'?NI.parse(inp.value,true):NI.parsePct(inp.value);
  function commit(){
    if(!edited)return;edited=false;
    const value=parseValue();
    if(value===null||!isFinite(value)||value<0){syncAssignmentRows(item,null,true);return;}
    setAllocation(item,inp.dataset.pid,value,mode);invalidateBT();if(session)session.isDirty=true;
    syncAssignmentRows(item,null,true);recordItem();
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

function _zeroNamesDisplay(names,ouPart,suffix,avail,font){if(measureTW(ouPart+names.join(' ')+suffix,font)<=avail)return names.join(' ');for(let i=names.length-1;i>=1;i--){const cand=ouPart+names.slice(0,i).join(' ')+` และคนอีก ${names.length-i} คน`+suffix;if(measureTW(cand,font)<=avail)return names.slice(0,i).join(' ')+` และคนอีก ${names.length-i} คน`;}return`${names.length} คน`;}
function _getZeroWarnNames(zeroWarns){return zeroWarns.map(w=>{const p=S.people.find(x=>x.id===w.personId);return p?.name||'?';});}
function buildWarnHtml(item){
  const total=getItemTotal(item);
  const over=getWarns(item).find(w=>w.type==='over');if(over)return`<div class="wb wb-w" role="alert">⚠ ${esc(over.msg)}</div>`;
  if(!total||total<=0)return`<div class="wb wb-n">ใส่ราคาเพื่อเริ่มแบ่งบิล</div>`;
  if(!item.assignments||!item.assignments.length)return`<div class="wb wb-n">เลือกคนด้านล่างเพื่อเริ่มแบ่งบิล</div>`;
  const warns=getWarns(item);if(!warns.length)return`<div class="wb wb-ok">✓ ${item.assignments.length===1?'กินคนเดียว':'แบ่งบิลเรียบร้อย'}</div>`;
  const{overUnder,zeroWarns}=categorizeWarns(warns);let html='';
  if(overUnder)html+=`<div class="wb wb-w">⚠ ${esc(overUnder.msg)}</div>`;
  if(zeroWarns.length){
    const warnEl=document.getElementById('item-warn-area');
    const avail=warnEl&&warnEl.clientWidth>50?warnEl.clientWidth-30:window.innerWidth-62;
    const font='400 13px "Sarabun",sans-serif';
    const names=_getZeroWarnNames(zeroWarns);
    const displayNames=_zeroNamesDisplay(names,'⚠ ',ZERO_SHARE_SUFFIX,avail,font);
    html+=`<div class="wb wb-w">⚠ ${esc(displayNames+ZERO_SHARE_SUFFIX)}</div>`;
  }
  if(!overUnder&&!zeroWarns.length)html+=`<div class="wb wb-w">⚠ ${esc(warns[0].msg)}</div>`;
  return html||`<div class="wb wb-ok">✓ แบ่งบิลเรียบร้อย</div>`;
}
function buildSummaryWarnLines(item,containerW,preWarns){
  const warns=preWarns||getWarns(item);if(!warns.length)return[];
  const noPriceWarn=warns.find(w=>w.type==='no_price');
  const{overUnder,zeroWarns}=categorizeWarns(warns);const lines=[];
  const font12='400 12px "Sarabun",sans-serif';const fontLink='400 13px "Sarabun",sans-serif';
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

function syncAssignmentRows(item,focusPid=null,force=false){
  const da=getDA(item),wd=document.getElementById('item-warn-area');if(wd)wd.innerHTML=buildWarnHtml(item);
  item.assignments.forEach(a=>{
    const d=da[a.personId]||{amount:0,percentage:0},lk=a.locked;
    for(const [field,value,locked] of [['amt',fmtComma(d.amount),lk&&a.lockMode==='amount'],['pct',d.percentage.toFixed(2),lk&&a.lockMode==='percentage']]){
      const input=document.querySelector(`[data-f="${field}"][data-pid="${CSS.escape(a.personId)}"]`);
      if(input){if(force||document.activeElement!==input)input.value=value;input.className=`fi fi-${field} ${locked?'fl':'fa'}`;input.disabled=false;}
    }
    const button=document.querySelector(`[data-a="toggle-lock"][data-pid="${CSS.escape(a.personId)}"]`);
    if(button){button.className='lkb'+(lk?' lk':'');button.innerHTML=lk?ICONS.lock:ICONS.unlock;button.disabled=false;button.setAttribute('aria-label',(lk?'ปลดล็อก':'ล็อก')+'ส่วนแบ่ง');}
  });
}
function buildAdjBar({id,label,labelColor,ctrlGap,ctrlHtml}){return`<div class="adj-bar"${id?` id="${id}"`:''}><span class="adj-bar-label" style="color:${labelColor}">${label}</span><div class="adj-bar-ctrl"${ctrlGap?` style="gap:${ctrlGap}"`:''}>${ctrlHtml}</div></div>`;}
function renderBillTotals(bt){return `<div class="shdr"><span class="stitle">ยอดรวมบิล</span></div><div class="totals" style="margin-bottom:14px"><div class="trow"><span class="tlbl">ยอดรวมย่อย</span><span class="tval">${fmt(bt.Sb)}</span></div>${billAdjRowsHtml(bt.svcAmt,bt.vatAmt,bt.D)}<div class="trow grand"><span class="tlbl">ยอดที่ต้องจ่าย</span><span class="tval pos">${fmt(bt.grand)}</span></div></div>`;}
function updateBillTotals(){const panel=document.getElementById('menu-bill-totals');if(panel&&view==='menu')panel.innerHTML=renderBillTotals(approvedBillTotals(S,storedBill));}
function distributionOptions(key,value,disabled){return `<div class="segmented" role="radiogroup" aria-label="${key==='sd'?'แบ่ง Service Charge':'แบ่งส่วนลด'}">${[['equal','หารเท่า'],['proportional','ตามสัดส่วน']].map(([v,label])=>`<label class="segmented-option"><input type="radio" name="distribution-${key}" data-${key}="${v}" value="${v}" ${value===v?'checked':''} ${disabled?'disabled':''}><span class="segmented-face">${label}</span></label>`).join('')}</div>`;}
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
      labelWidth:measureTW(label.textContent,`500 13px ${labelStyle.fontFamily}`)};
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
function billAdjRowsHtml(svc,vat,disc,rowStyle=''){
  const s=rowStyle?` style="${rowStyle}"`:'';;let h='';
  if(S.service.enabled)h+=`<div class="trow"${s}><span class="tlbl">Service Charge (${displayRate(S.service.value)}%)</span><span class="tval">+${fmt(svc)}</span></div>`;
  if(S.tax.enabled)h+=`<div class="trow"${s}><span class="tlbl">VAT (${displayRate(S.tax.value)}%)</span><span class="tval">+${fmt(vat)}</span></div>`;
  if(disc>0)h+=`<div class="trow"${s}><span class="tlbl">ส่วนลด</span><span class="tval" style="color:var(--ok)">−${fmt(disc)}</span></div>`;
  return h;
}

function updateHdrTotal(total){const el=document.getElementById('hdr-item-total');if(!el)return;if(view==='item-detail'&&total>0){el.textContent=fmt(total,'บาท');el.style.display='block';}else{el.textContent='';el.style.display='none';}}
function shouldShowSummaryHint(){if(summaryHintDismissed)return false;return S.items.some(it=>it.assignments&&it.assignments.length>0);}
function updateTabHint(){const sumTab=document.querySelector('.tab-btn[data-tab="summary"]');if(!sumTab)return;if(!sumTab.classList.contains('active')&&shouldShowSummaryHint())sumTab.classList.add('tab-next-step');else sumTab.classList.remove('tab-next-step');}
function setMainTitle(){const el=document.getElementById('hdr-title');el.className='';el.innerHTML=`<span class="title-pre">หารจ่าย</span><span class="title-main">แฟร์ๆ</span>`;}
function setSubTitle(text){const el=document.getElementById('hdr-title');el.className='subpage-title';el.textContent=text;}

const _chipWidthCache=new Map();
function getChipWidth(pid,name,ctx){if(_chipWidthCache.has(pid))return _chipWidthCache.get(pid);const w=Math.ceil(ctx.measureText(name).width)+28+4;_chipWidthCache.set(pid,w);return w;}
function clearChipWidthCache(){_chipWidthCache.clear();}
function getChipHighlight(item){if(!S.people.length)return{allAct:false,noneAct:false};const ids=new Set(item.assignments.map(a=>a.personId));return{allAct:S.people.every(p=>ids.has(p.id)),noneAct:!S.people.some(p=>ids.has(p.id))};}

function openItemSess(itemId,isNew=false){
  activeItemId=itemId;
  const draft=isNew?{id:itemId,name:'',price:0,quantity:1,assignments:[]}:clone(S.items.find(i=>i.id===itemId));
  session={itemId,isNew,baseline:clone(draft),draft,history:createHistory(draft),isDirty:false};
  goto('item-detail');
  const name=document.getElementById('it-name'),price=document.getElementById('it-price');
  // Entry only: rerenders and People-return must not reopen the keyboard.
  if(!draft.name.trim())name.focus({preventScroll:true});
  else if(!price.value.trim()||Number(price.value.replace(/,/g,''))===0)price.focus({preventScroll:true});
}
function teardownItemDetail(){if(chipLayoutObserver){chipLayoutObserver.disconnect();chipLayoutObserver=null;}if(warnAreaObserver){warnAreaObserver.disconnect();warnAreaObserver=null;}if(doneObserver){doneObserver.disconnect();doneObserver=null;}document.getElementById('sticky-done-wrap').style.display='none';}
function addNewItem(){if(session){toast('แก้เมนูนี้ให้เสร็จก่อน');return;}openItemSess(gid(),true);}
function relayoutChips(){if(view!=='item-detail'||!activeItemId)return;const item=currentItem();if(!item)return;cancelAnimationFrame(chipLayoutRAF);chipLayoutRAF=requestAnimationFrame(()=>{if(view!=='item-detail')return;initChipLayout(item);});}

// Toolbar/keyboard height changes must never rebuild a screen or restore scroll.
let layoutWidth=0;
function handleViewportChange({force=false}={}){
  const width=document.documentElement.clientWidth;
  if(!force&&width===layoutWidth&&view!=='item-detail')return;
  layoutWidth=width;
  cancelAnimationFrame(resizeRAF);
  resizeRAF=requestAnimationFrame(()=>{
    updateHistory();
    if(view==='item-detail'){
      const tl=isItemDetailTwoLine();
      if(tl!==_lastTwoLine&&!document.activeElement?.matches('#screen-item-detail input')){_lastTwoLine=tl;renderItemDetail();}
      else{relayoutChips();const item=currentItem();if(item){const wd=document.getElementById('item-warn-area');if(wd)wd.innerHTML=buildWarnHtml(item);}}
    }else if(view==='menu'){
      layoutAdjustments(document.querySelector('#screen-menu .adj-bar-row'));
      updatePeoplePreview();
    }else if(view==='summary'){
      layoutDistribution();
      syncMainStickyOffsets();
    }
  });
}

function updatePeoplePreview(){const na=document.getElementById('people-names-area');if(!na||!S.people.length)return;const maxW=na.clientWidth||na.getBoundingClientRect().width||300;const sp=document.getElementById('people-names-span');if(sp)sp.textContent=buildPeoplePreview(S.people,maxW);}
function buildPeoplePreview(people,maxWidth){if(!people.length)return'';const full=people.map(p=>p.name).join(', ');if(measureTW(full)<=maxWidth)return full;for(let count=people.length-1;count>=1;count--){const shown=people.slice(0,count).map(p=>p.name).join(', ');const ov=people.length-count;const cand=shown+` และอีก ${ov} คน`;if(measureTW(cand)<=maxWidth)return cand;}const ov=people.length-1;return people[0].name+(ov>0?` และอีก ${ov} คน`:'');}

async function doneAction(){
  if(editors.composing)return;
  const item=currentItem();if(!item)return;
  if(!isItemDefault(item)){
    if(!item.name.trim()){const err=document.getElementById('it-name-err');err.textContent='ชื่อเมนูห้ามว่าง';err.style.display='block';document.getElementById('it-name')?.focus();return;}
    const next=clone(S);const index=next.items.findIndex(i=>i.id===item.id);
    if(index<0)next.items.push(clone(item));else next.items[index]=clone(item);
    try{if(!await commitCandidate(approvedBill(next,storedBill)))return;}catch(error){toast(error.message);return;}
  }
  teardownItemDetail();session=null;updateTabHint();goto(prevView);
}

function modal(title,body,actions){
  return openSheet({title,body:'<p></p>',destructive:actions.some(action=>action.className==='sheet-danger'),fallback:()=>document.getElementById('bill-selector'),mount:host=>setSheetText(host.body.querySelector('p'),body),actions});
}
let tT;
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(tT);tT=setTimeout(()=>t.classList.remove('show'),TOAST_DURATION_MS);}
function confirmDelete(label,msg,{confirmLabel='ลบ'}={}){return modal(['ลบ ',customName(label),' ใช่ไหม?'],[...(Array.isArray(msg)?msg:[msg]),' (ย้อนกลับได้)'],[{label:'ยกเลิก',value:'n'},{label:confirmLabel,value:'y',className:'sheet-danger'}]);}

function isDuplicateName(name,excludeId=null){const n=name.trim().toLowerCase();return S.people.some(p=>p.id!==excludeId&&p.name.trim().toLowerCase()===n);}
async function doAddPerson(){const inp=document.getElementById('np-inp'),err=document.getElementById('np-err'),name=inp.value.trim();capturePeopleDraft();if(pendingSave||pendingCandidate)return false;if(!name){if(err){err.textContent='ชื่อห้ามว่าง';err.style.display='block';}return;}if(isDuplicateName(name)){if(err){err.textContent='ชื่อนี้ถูกใช้แล้ว';err.style.display='block';}return;}inp.focus({preventScroll:true});const id=gid();S.people.push({id,name});invalidateBT();if(!await saveS({peopleEdit:{kind:'add',id,name}}))return false;inp.value=peopleDraft.add;if(err)err.style.display='none';renderPeopleList();updateBillContext();return true;}
async function doEditPerson(id){const inp=document.getElementById('ep-'+id);if(!inp)return;capturePeopleDraft();const name=inp.value.trim();if(pendingSave||pendingCandidate)return false;if(!name){toast('ชื่อห้ามว่าง');return;}if(isDuplicateName(name,id)){toast('ชื่อนี้ถูกใช้แล้ว');return;}const p=S.people.find(x=>x.id===id);if(p)p.name=name;if(!await saveS({peopleEdit:{kind:'rename',id,name}}))return false;_chipWidthCache.delete(id);renderPeopleList();return true;}
async function doDelPerson(id){
  const p=S.people.find(x=>x.id===id);if(!p)return;
  if(S.items.some(it=>it.assignments.some(a=>a.personId===id))){const c=await confirmDelete(p.name,[customName(p.name),' จะถูกลบออกจากทุกเมนูอาหาร'],{confirmLabel:'ลบออก'});if(c!=='y')return;}
  S.items.forEach(it=>{it.assignments=it.assignments.filter(a=>a.personId!==id);applyC(it);});S.people=S.people.filter(x=>x.id!==id);invalidateBT();if(!await saveS())return;
  if(session){const remove=item=>{item.assignments=item.assignments.filter(a=>a.personId!==id);applyC(item);return item;};session.baseline=remove(session.baseline);session.draft=remove(session.draft);session.history.mapStates(remove);session.isDirty=!sameValue(session.draft,session.baseline);}
  pruneCollapsedPeople();renderPeopleList();
}

let imageExporting=false;
function startSummaryImage(){
  if(pendingCandidate||pendingSave){toast('บันทึกการแก้ไขก่อนดาวน์โหลด');return;}
  if(imageExporting)return;imageExporting=true;const button=document.getElementById('btn-download-summary');if(button)button.disabled=true;
  downloadSummaryImage(billSession.record,toast).catch(error=>toast('สร้างรูปภาพไม่ได้ ลองอีกครั้ง: '+error.message)).finally(()=>{imageExporting=false;if(!pendingSave){const current=document.getElementById('btn-download-summary');if(current)current.disabled=false;}});
}
// ─── 8. RENDER FUNCTIONS ──────────────────────────────────────────────────────

function buildItemFieldsHtml(item,twoLine){
  const total=getItemTotal(item),qty=item.quantity||1;
  const priceDisplay=item.price?fmtComma(item.price):'';
  const totalDisp=`<div id="it-total-disp" class="it-total-val" style="display:flex;align-items:center;justify-content:flex-end;height:48px">${fmt(total,'บาท')}</div>`;
  const totalField=`<div class="item-fields-total"><span class="field-lbl">ยอดรวม</span>${totalDisp}</div>`;
  if(twoLine){return`<div style="display:flex;flex-direction:column;gap:6px"><div><span class="field-lbl">ชื่อเมนู</span><input id="it-name" class="inp" type="text" maxlength="50" value="${esc(item.name)}" placeholder="อาหาร/เครื่องดื่ม" autocomplete="off" enterkeyhint="next"><div id="it-name-err" class="inp-err" style="display:none"></div></div><div><div style="display:flex;gap:6px;align-items:flex-end"><div style="flex:1.6 1 0;min-width:0"><span class="field-lbl" style="text-align:right;display:block">ราคา</span><div style="position:relative"><input id="it-price" type="text" inputmode="decimal" autocomplete="off" class="inp" value="${priceDisplay}" placeholder="0" enterkeyhint="next" style="width:100%;padding:10px 24px 12px 12px;text-align:right"><span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);color:var(--tm);font-size:12px;pointer-events:none">฿</span></div></div><div style="flex-shrink:0;padding-bottom:10px;font-size:15px;font-weight:700;color:var(--td);line-height:1.9">×</div><div style="flex:1 1 0;min-width:0"><span class="field-lbl" style="text-align:center;display:block">จำนวน</span><input id="it-qty" type="text" inputmode="numeric" autocomplete="off" class="inp" value="${qty}" placeholder="1" enterkeyhint="done" style="width:100%;text-align:center;padding:10px 4px 12px"></div><div style="flex-shrink:0;padding-bottom:10px;font-size:15px;font-weight:700;color:var(--td);line-height:1.9">=</div>${totalField}</div><div id="it-price-err" class="inp-err" style="display:none;white-space:nowrap"></div></div></div>`;}
  return`<div style="display:flex;flex-direction:row;gap:8px;align-items:flex-start"><div style="flex:2;min-width:0"><span class="field-lbl">ชื่อเมนู</span><input id="it-name" class="inp" type="text" maxlength="50" value="${esc(item.name)}" placeholder="อาหาร/เครื่องดื่ม" autocomplete="off" enterkeyhint="next"><div id="it-name-err" class="inp-err" style="display:none;margin-top:2px"></div></div><div style="flex:1;min-width:0"><span class="field-lbl" style="text-align:right;display:block">ราคา</span><div style="position:relative"><input id="it-price" type="text" inputmode="decimal" autocomplete="off" class="inp" value="${priceDisplay}" placeholder="0" enterkeyhint="next" style="width:100%;padding:10px 24px 12px 12px;text-align:right"><span style="position:absolute;right:8px;top:50%;transform:translateY(-50%);color:var(--tm);font-size:12px;pointer-events:none">฿</span></div><div id="it-price-err" class="inp-err" style="display:none;margin-top:2px;white-space:nowrap"></div></div><div style="flex-shrink:0"><span class="field-lbl" style="visibility:hidden">×</span><div style="height:48px;display:flex;align-items:center;font-size:15px;font-weight:700;color:var(--td)">×</div></div><div style="flex:0 0 48px;min-width:0"><span class="field-lbl" style="text-align:center;display:block">จำนวน</span><input id="it-qty" type="text" inputmode="numeric" autocomplete="off" class="inp" value="${qty}" placeholder="1" enterkeyhint="done" style="width:100%;text-align:center;padding:10px 4px 12px"></div><div style="flex-shrink:0"><span class="field-lbl" style="visibility:hidden">=</span><div style="height:48px;display:flex;align-items:center;font-size:15px;font-weight:700;color:var(--td)">=</div></div>${totalField}</div>`;
}

function emptyPeopleCard(id){return `<div class="card" style="margin-bottom:18px"><div style="padding:20px;text-align:center"><div style="color:var(--td);font-size:13px;margin-bottom:12px">ยังไม่มีรายชื่อคน โปรดเพิ่มคนเพื่อเริ่มแบ่งบิล</div><button class="btn btn-p" id="${id}" style="font-size:13px;padding:8px 18px">+ เพิ่มคน</button></div></div>`;}
function renderMenu(){
  summaryStickyCleanup();mainScroll.before('menu');bottomCleanup();renderMenuContent();bottomCleanup=()=>{};mainScroll.after('menu');}
function renderMenuContent(){
  const el=document.getElementById('screen-menu');let h='';
  const svcOn=S.service.enabled,vatOn=S.tax.enabled,dFixed=S.discount.mode==='fixed';
  const hasPeople=S.people.length>0;

  h+=`<div class="shdr" style="margin-top:0"><span class="stitle">รายชื่อคนที่โต๊ะอาหาร</span></div>`;
  if(!S.people.length)h+=emptyPeopleCard('add-first-p-btn');
  else{h+=`<div class="card" style="margin-bottom:18px;cursor:pointer" id="go-people-bar"><div class="li" style="border-bottom:none;gap:10px"><div style="flex-shrink:0"><span style="color:var(--a);font-weight:700;font-size:14px">${S.people.length} คน</span></div><div id="people-names-area" style="flex:1;min-width:0;text-align:right;overflow:hidden"><span id="people-names-span" style="color:var(--tm);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block">${S.people.map(p=>esc(p.name)).join(', ')}</span></div><svg class="chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div></div>`;}

  h+=`<div class="shdr"><span class="stitle">รายการอาหาร</span></div>`;
  h+=`<button class="btn-ocr-upload" id="upload-receipt-btn">${ICONS.camera} อ่านใบเสร็จอัตโนมัติ</button>`;

  if(S.items.length){
    h+=`<div class="card" style="margin-bottom:11px">`;
    S.items.forEach(it=>{const lbl=getSplitLbl(it),total=getItemTotal(it),qty=it.quantity||1,n=it.assignments.length;const pi=qty>1?`${fmt(it.price||0,'฿')} × ${qty} = ${fmt(total,'฿')} · ${n} คน`:`${fmt(total,'฿')} · ${n} คน`;h+=`<div class="li" data-a="open-it" data-id="${esc(it.id)}" style="cursor:pointer"><div class="li-c"><div class="li-t">${it.name?esc(it.name):`<em style="color:var(--td)">ไม่มีชื่อเมนู</em>`}</div><div class="li-s">${pi}</div></div><div class="li-r"><span class="badge-item ${lbl.cls}">${esc(lbl.text)}</span><button class="btn-icon danger-action" data-a="del-it" data-id="${esc(it.id)}">${ICONS.bin}</button><svg class="chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div></div>`;});
    h+=`</div>`;
  }else{
    h+=`<div class="empty" style="padding:22px 20px"><div class="empty-ico">🍽️</div><div class="empty-txt">กดปุ่มด้านล่างเพื่อเพิ่มเมนูแรก</div></div>`;
  }

  h+=`<div id="add-menu-slot"><button class="btn ${hasPeople?'btn-p':'btn-s'}" id="add-it-btn" style="width:100%">${ICONS.plus} เพิ่มเมนู</button></div>`;

  h+=`<div class="shdr"><span class="stitle">ปรับยอดบิล</span></div><div class="adj-bar-row">`;
  const svcCtrl=`<div class="adj-iw" style="width:58px"><input type="text" inputmode="decimal" autocomplete="off" class="adj-inp" id="adj-svc" value="${S.service.value?displayRate(S.service.value):''}" placeholder="0" ${!svcOn?'disabled':''}><span class="adj-sym">%</span></div><input type="checkbox" id="svc-chk" ${svcOn?'checked':''}>`;
  const vatCtrl=`<div class="adj-iw" style="width:58px"><input type="text" inputmode="decimal" autocomplete="off" class="adj-inp" id="adj-tax" value="${S.tax.value?displayRate(S.tax.value):''}" placeholder="0" ${!vatOn?'disabled':''}><span class="adj-sym">%</span></div><input type="checkbox" id="tax-chk" ${vatOn?'checked':''}>`;
  const discCtrl=`<div class="mtgl"><button class="mtgl-b${!dFixed?' act':''}" data-dm="percent">%</button><button class="mtgl-b${dFixed?' act':''}" data-dm="fixed">฿</button></div><div class="adj-iw" id="disc-adj-iw" style="width:90px"><input type="text" inputmode="decimal" autocomplete="off" class="adj-inp" id="adj-disc" value="${S.discount.value||''}" placeholder="0"><span class="adj-sym" id="disc-sym">${dFixed?'฿':'%'}</span></div>`;
  h+=buildAdjBar({label:'Service Charge',labelColor:svcOn?'var(--t)':'var(--td)',ctrlHtml:svcCtrl});
  h+=buildAdjBar({label:'VAT',labelColor:vatOn?'var(--t)':'var(--td)',ctrlHtml:vatCtrl});
  h+=buildAdjBar({id:'disc-adj-bar',label:'ส่วนลด',labelColor:'var(--t)',ctrlGap:'4px',ctrlHtml:discCtrl});
  h+=`</div><div id="menu-bill-totals">${renderBillTotals(approvedBillTotals(S,storedBill))}</div>`;

  el.innerHTML=h;layoutAdjustments(el.querySelector('.adj-bar-row'));updatePeoplePreview();updateTabHint();

  bindPeopleEntry(el.querySelector('#go-people-bar'));
  bindPeopleEntry(el.querySelector('#add-first-p-btn'));
  bindBillAction(el.querySelector('#add-it-btn'),addNewItem,{preserveGesture:true});
  bindBillAction(el.querySelector('#upload-receipt-btn'),async()=>{if(await saveS()){mainScroll.capture();location.href=new URL('../receipt.html?bill='+encodeURIComponent(billSession.billId),import.meta.url).href;}});
  el.querySelectorAll('[data-a="open-it"]').forEach(e=>bindBillAction(e,()=>{if(session){toast('แก้เมนูนี้ให้เสร็จก่อน');return;}openItemSess(e.dataset.id);},{preserveGesture:true}));
  el.querySelectorAll('[data-a="del-it"]').forEach(e=>e.addEventListener('click',async ev=>{ev.stopPropagation();const it=S.items.find(i=>i.id===e.dataset.id);if(!it)return;const c=await confirmDelete(it.name||'เมนูนี้','เมนูนี้และข้อมูลการหารจ่ายทั้งหมดของเมนูนี้จะถูกลบ');if(c!=='y')return;S.items=S.items.filter(i=>i.id!==e.dataset.id);invalidateBT();if(!await saveS())return;renderMenu();}));

  const svcChk=document.getElementById('svc-chk'),svcI=document.getElementById('adj-svc');
  svcChk?.addEventListener('change',async()=>{S.service.enabled=svcChk.checked;invalidateBT();if(!await saveS())return;renderMenu();});
  if(svcI&&!svcI.disabled)NI.bindPercAdj(svcI,async v=>{if(v===0){S.service.value=10;S.service.enabled=false;invalidateBT();if(!await saveS())return;renderMenu();}else{S.service.value=v;invalidateBT();await saveS();}});
  const taxChk=document.getElementById('tax-chk'),taxI=document.getElementById('adj-tax');
  taxChk?.addEventListener('change',async()=>{S.tax.enabled=taxChk.checked;invalidateBT();if(!await saveS())return;renderMenu();});
  if(taxI&&!taxI.disabled)NI.bindPercAdj(taxI,async v=>{if(v===0){S.tax.value=7;S.tax.enabled=false;invalidateBT();if(!await saveS())return;renderMenu();}else{S.tax.value=v;invalidateBT();await saveS();}});
  const discI=document.getElementById('adj-disc');
  if(discI){const commit=async v=>{S.discount.value=v;invalidateBT();await saveS();};if(dFixed)NI.bindMoneyAdj(discI,commit,{trimZeros:true});else NI.bindPercAdj(discI,commit);}
  el.querySelectorAll('[data-dm]').forEach(b=>b.addEventListener('click',async()=>{const nm=b.dataset.dm;if(S.discount.mode!==nm){if(nm==='percent'&&S.discount.value>100)S.discount.value=100;S.discount.mode=nm;invalidateBT();if(!await saveS())return;renderMenu();}}));

}

function renderPeople(){
  const el=document.getElementById('screen-people');let h='';
  h+=`<div class="card" style="padding:13px;margin-bottom:16px"><label class="inp-lbl" for="np-inp">เพิ่มคน</label><div style="display:flex;gap:7px;align-items:center;margin-top:5px"><input id="np-inp" class="inp" type="text" maxlength="30" placeholder="ชื่อจริงหรือชื่อเล่น" autocomplete="off" enterkeyhint="done" style="flex:1;padding:9px 11px 12px"><button class="btn btn-p" id="np-add-btn" type="button" style="flex-shrink:0;padding:10px 16px">เพิ่ม</button></div><div id="np-err" class="inp-err" style="display:none;margin-top:5px"></div></div>`;
  h+=`<div id="people-list-wrap"></div>`;
  el.innerHTML=h;
  document.getElementById('sticky-done-wrap').style.display='block';
  document.getElementById('btn-done-sticky').textContent='เสร็จสิ้น';
  document.getElementById('btn-done-sticky').onclick=()=>editors.run(()=>runBillAction(handleBack));
  const npInp=document.getElementById('np-inp');
  npInp.value=peopleDraft.add;
  npInp.addEventListener('input',()=>{peopleDraft.add=npInp.value;});
  document.getElementById('np-add-btn').addEventListener('click',()=>doAddPerson());
  let enterHandled=false;
  function enterName(e){
    if(e.isComposing||editors.composing||e.keyCode===229)return;
    e.preventDefault();if(enterHandled||e.repeat)return;enterHandled=true;
    if(!npInp.value.trim()){const err=document.getElementById('np-err');err.textContent='';err.style.display='none';npInp.blur();return;}
    doAddPerson();
  }
  npInp.addEventListener('beforeinput',event=>{if(pendingSave)event.preventDefault();});
  npInp.addEventListener('paste',event=>{if(pendingSave)event.preventDefault();});
  npInp.addEventListener('keydown',e=>{if(e.key==='Enter'){nameEnterHeld=true;enterName(e);}});
  npInp.addEventListener('beforeinput',e=>{if(e.inputType==='insertLineBreak')enterName(e);});
  npInp.addEventListener('keyup',e=>{if(e.key==='Enter')enterHandled=false;});
  npInp.addEventListener('focus',()=>{if(!nameEnterHeld)enterHandled=false;});
  npInp.addEventListener('input',()=>{enterHandled=false;});
  npInp.addEventListener('input',()=>{const err=document.getElementById('np-err');if(err)err.style.display='none';});
  if(!_peoplePageRendered){_peoplePageRendered=true;if(matchMedia('(pointer: fine)').matches)npInp.focus();}
  renderPeopleList();
}

function renderPeopleList(){
  const wrap=document.getElementById('people-list-wrap');if(!wrap)return;let h='';
  if(!S.people.length){h+=`<div class="empty" style="padding:28px 20px"><div class="empty-ico">👥</div><div class="empty-txt">ยังไม่มีรายชื่อคน</div></div>`;}
  else{const n=S.people.length;h+=`<div class="shdr" style="margin-top:0"><span class="stitle">คน · ${n}</span></div><div class="card"><div class="p2col">`;S.people.forEach((p,idx)=>{const isRight=idx%2===1;const lastRowStart=Math.floor((n-1)/2)*2;const isLastRow=idx>=lastRowStart;const br=isRight?'':'border-right:1px solid var(--b);';const bb=isLastRow?'':'border-bottom:1px solid var(--b);';if(editingPid===p.id){h+=`<div class="p2cell-edit" style="${bb}"><input id="ep-${esc(p.id)}" class="inp" type="text" value="${esc(p.name)}" maxlength="30" autocomplete="off" enterkeyhint="done" style="flex:1;padding:8px 10px 12px"><button class="btn btn-p" data-a="ep-save" data-id="${esc(p.id)}" style="flex-shrink:0;padding:8px 12px">✓</button><button class="btn btn-s" data-a="ep-cancel" style="flex-shrink:0;padding:8px 10px">✕</button></div>`;}else{h+=`<div class="p2cell" style="${br}${bb}"><span class="p2cell-name">${esc(p.name)}</span><button class="btn-icon" data-a="rename-p" data-id="${esc(p.id)}" style="width:28px;height:28px"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn-icon danger-action" data-a="del-p" data-id="${esc(p.id)}" style="width:28px;height:28px">${ICONS.bin}</button></div>`;}});h+=`</div></div>`;}

  wrap.innerHTML=h;
  if(peopleDraft.rename&&editingPid===peopleDraft.rename.id){const input=document.getElementById('ep-'+editingPid);if(input)input.value=peopleDraft.rename.value;}
  wrap.querySelectorAll('[data-a="rename-p"]').forEach(e=>e.addEventListener('click',ev=>{ev.stopPropagation();if(editingPid&&editingPid!==e.dataset.id){toast('บันทึกหรือยกเลิกชื่อที่กำลังแก้ก่อน');return;}editingPid=e.dataset.id;peopleDraft.rename={id:editingPid,value:S.people.find(p=>p.id===editingPid).name};renderPeopleList();document.getElementById('ep-'+e.dataset.id)?.focus();}));
  wrap.querySelectorAll('[data-a="ep-save"]').forEach(e=>e.addEventListener('click',ev=>{ev.stopPropagation();doEditPerson(e.dataset.id);}));
  wrap.querySelectorAll('[data-a="ep-cancel"]').forEach(e=>e.addEventListener('click',ev=>{ev.stopPropagation();editingPid=null;peopleDraft.rename=null;renderPeopleList();updateBillContext();}));
  S.people.forEach(p=>{const inp=document.getElementById('ep-'+p.id);if(inp){inp.addEventListener('input',()=>{peopleDraft.rename={id:p.id,value:inp.value};});NI.addTriggers(inp,()=>doEditPerson(p.id));inp.addEventListener('keydown',e=>{if(e.key==='Escape'){editingPid=null;peopleDraft.rename=null;renderPeopleList();updateBillContext();}});}});
  wrap.querySelectorAll('[data-a="del-p"]').forEach(e=>e.addEventListener('click',ev=>{ev.stopPropagation();doDelPerson(e.dataset.id);}));
}

function initChipLayout(item){
  const cardEl=document.getElementById('chip-area');if(!cardEl||!S.people.length)return;
  const GAP=7,VGAP=7,FONT='500 13px "Sarabun",sans-serif';
  const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');ctx.font=FONT;
  const rawW=cardEl.clientWidth||Math.max(window.innerWidth-60,120);const W=rawW-28;
  const chips=S.people.map(p=>({p,w:getChipWidth(p.id,p.name,ctx)}));
  const rows=[];let row=[],rowW=0;
  for(const chip of chips){const nextW=row.length?rowW+GAP+chip.w:chip.w;if(row.length&&nextW>W){rows.push(row);row=[chip];rowW=chip.w;}else{row.push(chip);rowW=nextW;}}
  if(row.length)rows.push(row);
  if(rows.length>=2){let last=rows[rows.length-1],prev=rows[rows.length-2];const widthOf=arr=>arr.reduce((s,c,i)=>s+c.w+(i?GAP:0),0);let lastW=widthOf(last),prevW=widthOf(prev);while(prev.length>1&&lastW/prevW<0.5){const moved=prev[prev.length-1];const newPrev=prev.slice(0,-1);const newLast=[moved,...last];const newPrevW=widthOf(newPrev),newLastW=widthOf(newLast);if(newPrevW<=W&&newLastW<=W&&newLastW/newPrevW>=0.5){prev=newPrev;last=newLast;rows[rows.length-2]=prev;rows[rows.length-1]=last;}else break;prevW=widthOf(prev);lastW=widthOf(last);}}
  let html=`<div style="padding:12px 14px;display:flex;flex-direction:column;gap:${VGAP}px">`;
  rows.forEach(row=>{html+=`<div style="display:flex;gap:${GAP}px;flex-wrap:nowrap">`;row.forEach(({p})=>{const sel=item.assignments.some(a=>a.personId===p.id);html+=`<div data-a="chip-p" data-pid="${esc(p.id)}" style="padding:7px 14px;border-radius:100px;font-size:13px;font-weight:500;cursor:pointer;transition:all .15s ease;white-space:nowrap;flex-shrink:0;border:1.5px solid ${sel?'var(--a)':'var(--bl)'};background:${sel?'var(--ad)':'transparent'};color:${sel?'var(--a)':'var(--tm)'}">${esc(p.name)}</div>`;});html+=`</div>`;});
  html+=`</div>`;cardEl.innerHTML=html;
  cardEl.querySelectorAll('[data-a="chip-p"]').forEach(c=>{c.addEventListener('click',()=>{const pid=c.dataset.pid;const idx=item.assignments.findIndex(a=>a.personId===pid);if(idx>=0)item.assignments.splice(idx,1);else item.assignments.push({personId:pid,amount:0,percentage:0,locked:false});applyC(item);invalidateBT();if(session)session.isDirty=true;renderItemDetail();});});
}

function renderItemDetail(){
  recordItem();
  const el=document.getElementById('screen-item-detail');
  const item=currentItem();if(!item){el.innerHTML='';return;}
  _lastTwoLine=isItemDetailTwoLine();const da=getDA(item),total=getItemTotal(item);
  updateHdrTotal(total);
  const{allAct,noneAct}=getChipHighlight(item);
  const addPersonBtn=S.people.length>0?`<button id="chip-add-p-btn" style="background:none;border:none;cursor:pointer;font-family:'Sarabun',sans-serif;font-size:12px;font-weight:500;color:var(--a);padding:0;line-height:1;flex-shrink:0">+ เพิ่ม/แก้ไขชื่อคนที่โต๊ะอาหาร</button>`:'';
  let h=`<div id="item-warn-sticky"><div id="item-warn-area">${buildWarnHtml(item)}</div></div>`;
  h+=`<div id="item-scroll-body"><div style="padding-top:4px;margin-bottom:6px">${buildItemFieldsHtml(item,_lastTwoLine)}</div>`;
  h+=`<div style="margin-top:10px;margin-bottom:9px">${addPersonBtn?`<div style="display:flex;align-items:center;margin-bottom:5px">${addPersonBtn}</div>`:''}<div style="display:flex;align-items:center;justify-content:space-between"><span class="stitle">เลือกคนที่กินเมนูนี้</span>${S.people.length?`<div style="display:flex;gap:6px"><button class="coll-btn${allAct?' act':''}" id="sel-all-btn">เลือกทุกคน</button><button class="coll-btn${noneAct?' act':''}" id="desel-all-btn">ไม่เลือก</button></div>`:''}</div></div>`;
  if(!S.people.length)h+=`<div class="card" style="padding:16px;margin-bottom:14px;font-size:13px;color:var(--tm)"><span style="cursor:pointer;color:var(--a);text-decoration:underline" id="go-p-link">เพิ่มคน</span> ในหน้า <em style="font-style:italic;color:var(--tm)">รายชื่อคนที่โต๊ะอาหาร</em> ก่อน</div>`;
  else h+=`<div id="chip-area" class="card" style="margin-bottom:14px;min-height:44px"></div>`;
  if(item.assignments.length){
    h+=`<div style="background:var(--card);border-radius:var(--r);border:1px solid var(--b);overflow:hidden;margin-bottom:14px">`;
    h+=`<div style="display:grid;${SPLIT_GRID};padding:7px 12px;border-bottom:1px solid var(--b)"><div class="flbl">คน</div><div class="flbl" style="text-align:right">จำนวนเงิน</div><div class="flbl" style="text-align:right">เปอร์เซ็นต์</div><div></div></div>`;
    item.assignments.forEach(a=>{const p=S.people.find(x=>x.id===a.personId);if(!p)return;const d=da[a.personId]||{amount:0,percentage:0},lk=a.locked;const amtCls=`fi fi-amt ${lk&&a.lockMode==='amount'?'fl':'fa'}`;const pctCls=`fi fi-pct ${lk&&a.lockMode==='percentage'?'fl':'fa'}`;const amtDisplay=fmtComma(d.amount);
    h+=`<div style="display:grid;${SPLIT_GRID};padding:10px 12px;border-bottom:1px solid var(--b);align-items:center" data-pid="${esc(a.personId)}"><div style="font-size:12px;font-weight:500;color:var(--t);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.5;padding-bottom:2px">${esc(p.name)}</div><div style="position:relative;min-width:0"><input type="text" inputmode="decimal" autocomplete="off" class="${amtCls}" aria-label="จำนวนเงินของ ${esc(p.name)}" data-f="amt" data-pid="${esc(a.personId)}" value="${amtDisplay}" style="padding-left:9px;padding-right:22px;text-align:right;width:100%"><span style="position:absolute;right:7px;top:50%;transform:translateY(-50%);color:var(--td);font-size:11px;pointer-events:none">฿</span></div><div style="position:relative;min-width:0"><input type="text" inputmode="decimal" autocomplete="off" class="${pctCls}" aria-label="เปอร์เซ็นต์ของ ${esc(p.name)}" data-f="pct" data-pid="${esc(a.personId)}" value="${d.percentage.toFixed(2)}" style="padding-left:6px;padding-right:22px;text-align:right;width:100%"><span style="position:absolute;right:7px;top:50%;transform:translateY(-50%);color:var(--td);font-size:11px;pointer-events:none">%</span></div><button aria-label="${lk?'ปลดล็อก':'ล็อก'}ส่วนแบ่งของ ${esc(p.name)}" class="lkb${lk?' lk':''}" data-a="toggle-lock" data-pid="${esc(a.personId)}">${lk?ICONS.lock:ICONS.unlock}</button></div>`;});
    h+=`</div>`;
  }
  h+=`<button class="btn danger-action danger-action--outlined" id="del-item-btn" style="width:100%;margin-bottom:10px">${ICONS.bin} ลบเมนู</button>`;
  h+=`<button class="btn btn-p" id="btn-done-inline" style="width:100%;padding:12px 18px;font-size:14px;justify-content:center;margin-bottom:10px">เสร็จสิ้น</button></div>`;
  el.innerHTML=h;
  bindBillAction(el.querySelector('#btn-done-inline'),doneAction);
  document.getElementById('btn-done-sticky').textContent='เสร็จสิ้น';
  document.getElementById('btn-done-sticky').onclick=()=>editors.run(doneAction);
  if(doneObserver){doneObserver.disconnect();doneObserver=null;}
  const inlineDoneEl=document.getElementById('btn-done-inline'),stickyWrap=document.getElementById('sticky-done-wrap');
  if(inlineDoneEl&&'IntersectionObserver' in window){doneObserver=new IntersectionObserver(entries=>{stickyWrap.style.display=entries[0].isIntersecting?'none':'block';},{threshold:0.9});doneObserver.observe(inlineDoneEl);}else stickyWrap.style.display='block';
  if(warnAreaObserver){warnAreaObserver.disconnect();warnAreaObserver=null;}
  const warnAreaEl=document.getElementById('item-warn-area');
  if(warnAreaEl&&'ResizeObserver' in window){warnAreaObserver=new ResizeObserver(()=>{cancelAnimationFrame(warnRebuildRAF);warnRebuildRAF=requestAnimationFrame(()=>{if(view!=='item-detail')return;const it=currentItem();if(it){const wd=document.getElementById('item-warn-area');if(wd)wd.innerHTML=buildWarnHtml(it);}});});warnAreaObserver.observe(warnAreaEl);}
  if(chipLayoutObserver)chipLayoutObserver.disconnect();
  const chipAreaEl=document.getElementById('chip-area');
  if(chipAreaEl&&'ResizeObserver' in window){chipLayoutObserver=new ResizeObserver(()=>relayoutChips());chipLayoutObserver.observe(chipAreaEl);}
  if(S.people.length)initChipLayout(item);
  const nameInp=document.getElementById('it-name'),priceInp=document.getElementById('it-price'),qtyInp=document.getElementById('it-qty');
  nameInp.addEventListener('input',()=>{item.name=nameInp.value;if(session)session.isDirty=true;setSubTitle(item.name||'เมนูใหม่');document.getElementById('it-name-err').style.display='none';});
  nameInp.addEventListener('blur',()=>{const t=nameInp.value.trim();if(t)item.name=t;recordItem();});
  NI.addTriggers(nameInp,()=>priceInp.focus());
  NI.bindNumeric(priceInp,{showCommas:true});
  priceInp.addEventListener('focus',()=>priceInp.select());
  priceInp.addEventListener('input',()=>{const raw=priceInp.value.replace(/,/g,''),num=parseFloat(raw);const livePrice=(!isNaN(num)&&num>=0)?Math.min(num,MAX_PRICE):0;delete item.authoritativeTotalCents;item.price=r4(livePrice);const nowTotal=getItemTotal(item);const td=document.getElementById('it-total-disp');if(td)td.textContent=fmt(nowTotal,'บาท');updateHdrTotal(nowTotal);applyC(item,true);syncAssignmentRows(item);invalidateBT();if(session)session.isDirty=true;});
  priceInp.addEventListener('blur',()=>{const raw=priceInp.value.replace(/,/g,'');let num=parseFloat(raw);if(isNaN(num)||num<0){priceInp.value='';item.price=0;}else{num=Math.min(num,MAX_PRICE);item.price=r4(num);priceInp.value=num?fmtComma(num):'';}const nowTotal=getItemTotal(item);const td=document.getElementById('it-total-disp');if(td)td.textContent=fmt(nowTotal,'บาท');updateHdrTotal(nowTotal);invalidateBT();if(session)session.isDirty=true;syncAssignmentRows(item);});
  NI.addTriggers(priceInp,()=>{qtyInp?.focus();});
  NI.bindNumeric(qtyInp,{allowDecimal:false,maxIntDigits:2});
  qtyInp.addEventListener('focus',()=>qtyInp.select());
  qtyInp.addEventListener('input',()=>{const v=Math.min(Math.max(parseInt(qtyInp.value)||1,1),99);delete item.authoritativeTotalCents;item.quantity=v;const nowTotal=getItemTotal(item);const td=document.getElementById('it-total-disp');if(td)td.textContent=fmt(nowTotal,'บาท');updateHdrTotal(nowTotal);applyC(item,true);syncAssignmentRows(item);invalidateBT();if(session)session.isDirty=true;});
  qtyInp.addEventListener('blur',()=>{const v=Math.min(Math.max(parseInt(qtyInp.value)||1,1),99);qtyInp.value=String(v);item.quantity=v;const nowTotal=getItemTotal(item);const td=document.getElementById('it-total-disp');if(td)td.textContent=fmt(nowTotal,'บาท');updateHdrTotal(nowTotal);invalidateBT();if(session)session.isDirty=true;syncAssignmentRows(item);});
  NI.addTriggers(qtyInp,()=>qtyInp.blur());
  for(const input of el.querySelectorAll('input'))input.addEventListener('blur',()=>queueMicrotask(recordItem));
  bindPeopleEntry(el.querySelector('#go-p-link'));
  bindPeopleEntry(el.querySelector('#chip-add-p-btn'));
  el.querySelector('#sel-all-btn')?.addEventListener('click',()=>{S.people.forEach(p=>{if(!item.assignments.some(a=>a.personId===p.id))item.assignments.push({personId:p.id,amount:0,percentage:0,locked:false});});applyC(item);invalidateBT();if(session)session.isDirty=true;renderItemDetail();});
  el.querySelector('#desel-all-btn')?.addEventListener('click',()=>{item.assignments=[];applyC(item);invalidateBT();if(session)session.isDirty=true;renderItemDetail();});
  el.querySelectorAll('[data-a="toggle-lock"]').forEach(b=>b.addEventListener('click',()=>{const a=item.assignments.find(x=>x.personId===b.dataset.pid);if(!a)return;if(a.locked)a.locked=false;else{const current=getDA(item)[a.personId]??{amount:0,percentage:0};a.amount=current.amount;a.locked=true;a.lockMode??='percentage';if(a.lockMode==='percentage')a.lockPercentUnits=Math.round(current.percentage*10000);}applyC(item);invalidateBT();if(session)session.isDirty=true;renderItemDetail();}));
  el.querySelectorAll('[data-f="amt"]').forEach(inp=>{if(!inp.disabled)bindItemAmtInput(inp,item);});
  el.querySelectorAll('[data-f="pct"]').forEach(inp=>{if(!inp.disabled)bindItemPctInput(inp,item);});
  editors.bind(el.querySelector('#del-item-btn'),async()=>{
    const hasInput=item.name.trim()||item.price>0||item.assignments.length;
    if(hasInput&&await confirmDelete(item.name||'เมนูนี้','ข้อมูลการหารจ่ายทั้งหมดของเมนูนี้จะถูกลบ')!=='y')return;
    if(!session.isNew){S.items=S.items.filter(i=>i.id!==activeItemId);if(!await saveS())return;}
    teardownItemDetail();session=null;goto(prevView);
  });
}

let summaryStickyCleanup=()=>{};
function renderSummary({keepControls=false}={}){
  if(!keepControls)mainScroll.before('summary');
  bottomCleanup();summaryStickyCleanup();renderSummaryContent(keepControls);
  summaryStickyCleanup=observeStickyHeading(document.querySelector('.per-person-sticky'));
  const bar=document.getElementById('summary-export-bar');
  document.getElementById('app-footer').style.display=bar?'none':'';
  bottomCleanup=reserveBottomAction(bar);
  if(!keepControls)mainScroll.after('summary');
}
function setSummaryContent(el,controls,details,keepControls){
  if(keepControls){const bar=el.querySelector('#summary-export-bar');el.querySelector('#summary-details').innerHTML=details;if(bar)el.querySelector('#summary-export-bar')?.replaceWith(bar);}
  else{distributionCleanup();el.innerHTML=controls+`<div id="summary-details" style="display:contents">${details}</div>`;attachDistHandlers(el);distributionCleanup=observeChoices(el.querySelector('.dist-bar-row'),layoutDistribution);}
}
function renderSummaryContent(keepControls=false){
  const el=document.getElementById('screen-summary');let h='';
  const svcDistDisabled=!S.service.enabled;const discDistDisabled=!S.discount.value||S.discount.value<=0;
  const containerW=el.clientWidth||window.innerWidth;
  h+=`<div class="shdr" style="margin-top:0"><span class="stitle">วิธีการแบ่ง</span></div><div class="dist-bar-row">`;
  h+=`<div class="dist-bar${svcDistDisabled?' disabled-bar':''}"><span class="dist-bar-label">Service Charge</span><div class="dist-bar-ctrl">${distributionOptions('sd',S.serviceDist,svcDistDisabled)}</div></div>`;
  h+=`<div class="dist-bar${discDistDisabled?' disabled-bar':''}"><span class="dist-bar-label">ส่วนลด</span><div class="dist-bar-ctrl">${distributionOptions('dd',S.discountDist,discDistDisabled)}</div></div>`;
  h+=`</div>`;
  const controls=h;h='';
  const nPeople=S.people.length,allExpanded=collapsedPeople.size===0,allCollapsed=nPeople>0&&collapsedPeople.size>=nPeople;
  h+=`<div class="per-person-sticky"><h2 class="stitle">ยอดรวมรายคน</h2>${nPeople?`<div class="coll-btns"><button class="coll-btn${allExpanded?' act':''}" id="btn-expand-all">ขยายทั้งหมด</button><button class="coll-btn${allCollapsed?' act':''}" id="btn-collapse-all">ย่อทั้งหมด</button></div>`:''}</div>`;
  if(!S.people.length){const totals=getCachedBT();h+=emptyPeopleCard('summary-add-people')+renderBillTotals(totals);if(totals.unallocated)h+=`<p class="wb wb-w">ยังแบ่งจ่ายไม่ครบ ${fmt(totals.unallocated)}</p>`;setSummaryContent(el,controls,h,keepControls);bindPeopleEntry(el.querySelector('#summary-add-people'));return;}
  const bt=getCachedBT();
  if(!bt){h+=`<div class="empty"><div class="empty-ico">💰</div><div class="empty-txt">ยังไม่มีข้อมูล</div></div>`;setSummaryContent(el,controls,h,keepControls);return;}
  for(const warning of bt.warnings.filter(w=>w.includes('ยอดติดลบ')))h+=`<div class="wb wb-w" role="status">${esc(warning)}</div>`;
  if(bt.unallocated)h+=`<div class="wb wb-w" style="margin-bottom:11px">ยังแบ่งจ่ายไม่ครบ ${fmt(bt.unallocated)}</div>`;
  const warnMap=new Map(S.items.map(it=>[it.id,getWarns(it)]));
  const warnItems=S.items.filter(it=>warnMap.get(it.id).length);
  if(warnItems.length){
    h+=`<div class="wb wb-w" style="margin-bottom:11px"><strong style="display:block;margin-bottom:4px">⚠ มีเมนู ${warnItems.length} รายการที่ยังมีคำเตือนค้างอยู่</strong>`;
    warnItems.forEach(it=>{const lines=buildSummaryWarnLines(it,containerW,warnMap.get(it.id));lines.forEach((line,li)=>{const mt=li===0?'4px':'2px';if(line.hasLink){h+=`<div style="margin-top:${mt};display:flex;align-items:baseline;overflow:hidden;flex-wrap:nowrap"><span class="warn-lnk" data-a="go-item" data-id="${esc(line.id)}" style="flex-shrink:0;white-space:nowrap">${esc(line.linkText)}</span><span style="color:var(--rs);font-size:12px;margin-left:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0">${esc(line.text)}</span></div>`;}else{h+=`<div style="margin-top:${mt};color:var(--rs);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-left:2px">${esc(line.text)}</div>`;}});});
    h+=`</div>`;
  }
  S.people.forEach(p=>{
    const pt=bt.pt[p.id];if(!pt)return;const neg=pt.total<0,hw=getPWarn(p.id);
    const assigned=S.items.filter(it=>it.assignments.some(a=>a.personId===p.id));
    const hasNoItems=assigned.length===0;const isCollapsed=collapsedPeople.has(p.id);
    h+=`<div class="scard"><button type="button" class="scard-hdr" data-a="toggle-coll" data-pid="${esc(p.id)}" aria-expanded="${!isCollapsed}"><div style="display:flex;align-items:center;gap:6px;min-width:0">${hw?`<span style="color:var(--rs);font-size:12px;flex-shrink:0;line-height:1">⚠</span>`:''}<span class="sname">${esc(p.name)}</span></div><div style="display:flex;align-items:center;gap:8px;flex-shrink:0"><span class="stot${neg?' neg':''}">${fmt(pt.total)}</span><svg class="coll-chev ${isCollapsed?'closed':'open'}" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></div></button>`;
    if(!isCollapsed){
      if(hasNoItems)h+=`<div style="padding:8px 14px 10px;font-size:13px;color:var(--rs);border-top:1px solid var(--b)">⚠ ยังไม่ได้เลือกเมนูใด</div>`;
      else if(pt.total<=0&&assigned.length>0)h+=`<div style="padding:8px 14px 10px;font-size:13px;color:var(--rs);border-top:1px solid var(--b)">⚠ ยอดรวมเป็น 0 บาท หรือติดลบ</div>`;
      if(assigned.length){
        h+=`<div class="sbd">`;
        assigned.forEach(it=>{const a=it.assignments.find(x=>x.personId===p.id);if(!a)return;const d=getDA(it)[p.id]||{amount:a.amount||0,percentage:a.percentage||0};const itW=warnMap.get(it.id).length>0;const qty2=it.quantity||1;h+=`<div class="pdrow" style="cursor:pointer" data-a="go-edit-item" data-iid="${esc(it.id)}"><div class="pdi"><div class="pdn">${it.name?esc(it.name):`<em style="color:var(--td)">ไม่มีชื่อเมนู</em>`}</div><div class="pds"><span>${fmt(d.amount)}</span><span>·</span><span>${fP(d.percentage)}</span>${qty2>1?`<span style="color:var(--td)">จาก ${fmt(it.price||0,'฿')}×${qty2}</span>`:''}${a.locked?'<span class="lk-chip">ล็อค</span>':''}</div></div><div class="pdr">${itW?`<span style="color:var(--rs);font-size:13px" title="${esc(warnMap.get(it.id).map(w=>w.msg).join(', '))}">⚠</span>`:''}<button class="btn-icon danger-action" data-a="rm-p-from-item" data-pid="${esc(p.id)}" data-iid="${esc(it.id)}" title="ลบออกจากเมนู">${ICONS.bin}</button></div></div>`;});
        h+=`<div style="border-top:1px solid var(--b);padding-top:4px;margin-top:2px">`;
        h+=`<div class="trow" style="padding:7px 0;border-bottom:none"><span class="tlbl">ยอดรวมย่อย</span><span class="tval">${fmt(pt.subtotal)}</span></div>`;
        h+=billAdjRowsHtml(pt.service,pt.vat,pt.discount,'padding:5px 0;border-bottom:none');
        h+=`<div class="trow grand" style="border-radius:0 0 var(--r) var(--r);margin-top:2px"><span class="tlbl">ยอดรวม</span><span class="tval${neg?' neg':' pos'}">${fmt(pt.total)}</span></div></div></div>`;
      }
    }
    h+=`<div class="person-card-footer"><button type="button" class="btn btn-s" data-a="person-menus" data-pid="${esc(p.id)}">แก้ไขเมนูที่กิน</button></div></div>`;
  });
  h+=renderBillTotals(bt);
  h+=`<div id="summary-export-bar"><button class="btn btn-p" id="btn-download-summary" style="width:100%;gap:8px">${ICONS.download} บันทึกสรุปยอดเป็นรูปภาพ</button></div>`;
  setSummaryContent(el,controls,h,keepControls);
  el.querySelectorAll('[data-a="person-menus"]').forEach(button=>bindBillAction(button,()=>openPersonMenus({session:billSession,personId:button.dataset.pid,onSaved:async result=>{acceptBill(result);renderSummary();},onRefreshed:adoptRefreshed,onEditItem:id=>openItemSess(id),onGoToMenu:()=>goto('menu')})));
  el.querySelectorAll('[data-a="toggle-coll"]').forEach(e=>e.addEventListener('click',()=>{const pid=e.dataset.pid;if(collapsedPeople.has(pid))collapsedPeople.delete(pid);else collapsedPeople.add(pid);saveUiState();renderSummary();}));
  el.querySelector('#btn-expand-all').addEventListener('click',()=>{collapsedPeople.clear();saveUiState();renderSummary();});
  el.querySelector('#btn-collapse-all').addEventListener('click',()=>{S.people.forEach(p=>collapsedPeople.add(p.id));saveUiState();renderSummary();});
  el.querySelectorAll('[data-a="go-item"]').forEach(e=>e.addEventListener('click',()=>{if(session){toast('แก้เมนูนี้ให้เสร็จก่อน');return;}openItemSess(e.dataset.id);}));
  el.querySelectorAll('[data-a="go-edit-item"]').forEach(e=>e.addEventListener('click',ev=>{if(ev.target.closest('[data-a="rm-p-from-item"]'))return;if(session){toast('แก้เมนูนี้ให้เสร็จก่อน');return;}openItemSess(e.dataset.iid);}));
  el.querySelectorAll('[data-a="rm-p-from-item"]').forEach(button=>button.addEventListener('click',async event=>{
    event.stopPropagation();if(pendingSave||pendingCandidate)return;
    const captured=billSession.record,person=captured.bill.people.find(p=>p.id===button.dataset.pid),item=captured.bill.items.find(it=>it.id===button.dataset.iid);if(!person||!item)return;
    const remaining=item.assignments.filter(a=>a.personId!==person.id).length;
    const choice=await modal(['ลบ ',customName(item.name||'เมนูนี้'),' ออกจาก ',customName(person.name),' ใช่ไหม?'],(remaining?'ส่วนแบ่งที่ไม่ได้ล็อกจะถูกคำนวณใหม่ โดยคงส่วนแบ่งที่ล็อกไว้ของคนอื่น':'เมนูนี้จะไม่มีคนเลือก')+' (ย้อนกลับได้)',[{label:'ยกเลิก',value:false},{label:'ลบออก',value:true,className:'sheet-danger'}]);if(!choice)return;
    const selected=captured.bill.items.filter(it=>it.id!==item.id&&it.assignments.some(a=>a.personId===person.id)).map(it=>it.id),candidate=setPersonMenus(captured.bill,person.id,selected).bill;
    if(await commitCandidate(candidate,{baseRevision:captured.recordRevision,kind:'remove-person-menu'}))renderSummary();
  }));
  const exportButton=el.querySelector('#btn-download-summary');
  if(exportButton&&!exportButton.dataset.bound){bindBillAction(exportButton,startSummaryImage);exportButton.dataset.bound='true';}

}

function attachDistHandlers(el){
  el.querySelectorAll('[data-sd]').forEach(b=>b.addEventListener('change',async()=>{if(b.checked&&!b.disabled&&!pendingSave){S.serviceDist=b.dataset.sd;invalidateBT();if(!await saveS({kind:'distribution'}))return;renderSummary({keepControls:true});}}));
  el.querySelectorAll('[data-dd]').forEach(b=>b.addEventListener('change',async()=>{if(b.checked&&!b.disabled&&!pendingSave){S.discountDist=b.dataset.dd;invalidateBT();if(!await saveS({kind:'distribution'}))return;renderSummary({keepControls:true});}}));
}

// ─── 9. RENDER DISPATCHER ────────────────────────────────────────────────────

function renderBillProblem(){
  updateBillContext();
  if(billSession)return;
  const el=document.getElementById('screen-'+view),empty=document.createElement('div');
  empty.className='empty bill-exception';
  const message=document.createElement('p');
  message.setAttribute('role','status');
  message.textContent=entryPhase==='loading'?'กำลังเปิดบิล…':storageError||'เลือกบิลที่ต้องการเปิด';
  empty.append(message);
  function action(label,id,callback,allowPending=false){
    const button=document.createElement('button');
    button.type='button';
    button.id=id;
    button.className='btn btn-s';
    button.textContent=label;
    bindBillAction(button,callback,{allowPending});
    empty.append(button);
  }
  if(entryPhase!=='loading'){
    if(!operationUncertain()&&entryPhase==='unavailable'&&!openingTarget){
      action('ลองอีกครั้ง','retry-open',()=>versionBlocked?location.reload():initialize());
    }
    if(separateStart&&repository&&!versionBlocked&&!operationUncertain()){
      action('สร้างบิลใหม่แยกไว้','start-separate',()=>startNew(true));
    }
    action('ตรวจสอบข้อมูลเดิม','bill-evidence',()=>inspectEvidence(missingTarget),true);
  }
  el.replaceChildren(empty);
}
function render(){
  if(view!=='summary'){summaryStickyCleanup();summaryStickyCleanup=()=>{};}
  updateBillContext();
  const oldWork=document.getElementById('old-work');
  if(oldWork)oldWork.hidden=!billSession||!hasOldWork();
  if(!billSession){bottomCleanup();renderBillProblem();return;}
  if(view==='menu')renderMenu();
  else if(view==='people')renderPeople();
  else if(view==='item-detail')renderItemDetail();
  else if(view==='summary')renderSummary();
}

// ─── 10. NAVIGATION ───────────────────────────────────────────────────────────

function goto(v,opts={}){
  mainScroll.leave();bottomCleanup();bottomCleanup=()=>{};
  if(doneObserver){doneObserver.disconnect();doneObserver=null;}
  if(warnAreaObserver){warnAreaObserver.disconnect();warnAreaObserver=null;}
  document.getElementById('sticky-done-wrap').style.display='none';
  document.getElementById('screen-'+view)?.classList.remove('active');
  if(v==='menu'||v==='summary')prevView=v;
  controls?.close();
  view=v;if(opts.itemId!==undefined)activeItemId=opts.itemId;
  if(v==='people')_peoplePageRendered=false;
  const tabs=document.getElementById('top-tabs'),backBtn=document.getElementById('btn-back'),hdrTotal=document.getElementById('hdr-item-total');
  const isSub=v==='item-detail'||v==='people';
  document.body.classList.toggle('subpage',isSub);
  document.getElementById('app-footer').style.display=(v==='people')?'none':'';

  if(v==='item-detail'){
    const it=currentItem();
    setSubTitle(it?.name||'เมนูใหม่');tabs.style.display='none';backBtn.style.display='flex';
    const total=getItemTotal(it||{price:0,quantity:1});if(total>0){hdrTotal.textContent=fmt(total,'บาท');hdrTotal.style.display='block';}else hdrTotal.style.display='none';
  }else if(v==='people'){
    setSubTitle('รายชื่อคนที่โต๊ะอาหาร');tabs.style.display='none';backBtn.style.display='flex';hdrTotal.style.display='none';
  }else{
    setMainTitle();tabs.style.display='flex';backBtn.style.display='none';hdrTotal.style.display='none';
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===v));
    updateTabHint();
  }
  document.getElementById('screen-'+v)?.classList.add('active');
  updateBillContext();saveUiState();
  if(v==='menu'||v==='summary'){const url=new URL(location.href);url.searchParams.set('view',v);if(billSession)url.searchParams.set('bill',billSession.billId);else if(missingTarget!==null)url.searchParams.set('bill',missingTarget);else url.searchParams.delete('bill');history.replaceState(history.state,'',url);}
  render();updateHistory();if(isSub){if(opts.restoreScroll)mainScroll.restoreTransient(opts.restoreScroll);else window.scrollTo({top:0,behavior:'instant'});}
}

async function handleBack(){
  if(editors.composing)return;
  if(view==='item-detail'){
    recordItem();
    if(session?.isDirty&&!isItemDefault(session.draft)){
      if(!await confirmDiscard({fallback:()=>document.getElementById('bill-selector')}))return;
    }
    session=null;teardownItemDetail();goto(prevView);
  }else if(view==='people'){
    capturePeopleDraft();
    const target=peopleReturnTo;
    if(!target||target.billId!==billSession?.billId){toast('เปิดบิลเดิมก่อนกลับจากรายชื่อคน');return;}
    const rename=peopleDraft.rename,addition=peopleDraft.add.trim();
    if(rename&&!rename.value.trim()){toast('ชื่อห้ามว่าง');return;}
    const names=S.people.map(p=>(p.id===rename?.id?rename.value:p.name).trim().toLowerCase());
    if(rename&&S.people.some(p=>p.id!==rename.id&&p.name.trim().toLowerCase()===rename.value.trim().toLowerCase())){toast('ชื่อนี้ถูกใช้แล้ว');return;}
    if(addition&&names.includes(addition.toLowerCase())){const error=document.getElementById('np-err');error.textContent='ชื่อนี้ถูกใช้แล้ว';error.style.display='block';return;}
    if(editingPid){if(!await doEditPerson(editingPid))return;}
    if(document.getElementById('np-inp')?.value.trim()){if(!await doAddPerson())return;}
    if(target.billId!==billSession?.billId)return;
    peopleReturnTo=null;peopleDraft={add:'',rename:null};
    const addInput=document.getElementById('np-inp');if(addInput)addInput.value='';
    for(const input of document.querySelectorAll('#screen-people [data-unsaved]'))delete input.dataset.unsaved;
    goto(target.view,{itemId:target.itemId??undefined,restoreScroll:target.view==='item-detail'?target.scroll:null});
    const opener=target.opener&&document.getElementById(target.opener),heading=document.getElementById('hdr-title');
    if(opener?.getClientRects().length)opener.focus({preventScroll:true});else{heading.tabIndex=-1;heading.focus({preventScroll:true});}
  }
}

async function handleTabClick(dest){
  if(view==='item-detail'){await handleBack();return;}
  if(view==='people'){await handleBack();return;}
  editingPid=null;
  if(dest==='summary'&&shouldShowSummaryHint()){summaryHintDismissed=true;saveUiState();}
  goto(dest);
}

// ─── 11. INIT ─────────────────────────────────────────────────────────────────

headerHistory=mountHistoryControls(document.getElementById('header-history'),{scope:'บิลหรือเมนูที่เปิดอยู่',onUndo:()=>runBillAction(()=>moveHistory('undo')),onRedo:()=>runBillAction(()=>moveHistory('redo')),editors});
document.querySelectorAll('.tab-btn').forEach(b=>bindBillAction(b,()=>handleTabClick(b.dataset.tab)));
bindBillAction(document.getElementById('btn-back'),handleBack);
const headerObserver=new ResizeObserver(()=>{updateHistory();syncMainStickyOffsets();});
headerObserver.observe(document.getElementById('hdr'));
headerObserver.observe(document.getElementById('top-tabs'));
headerObserver.observe(document.getElementById('hdr-title'));
headerObserver.observe(document.getElementById('hdr-item-total'));
syncMainStickyOffsets();
window.addEventListener('resize',handleViewportChange);
window.addEventListener('orientationchange',handleViewportChange);
if(window.visualViewport)window.visualViewport.addEventListener('resize',handleViewportChange);
document.addEventListener('focusin',e=>{const input=e.target,token=mainScroll.generation;if(input.matches('input:not([type=radio]):not([type=checkbox]):not([type=file]):not([type=hidden])'))setTimeout(()=>{if(token===mainScroll.generation&&!mainScroll.restoring&&input.isConnected&&document.activeElement===input){const r=input.getBoundingClientRect(),bottom=(window.visualViewport?.offsetTop??0)+(window.visualViewport?.height??innerHeight)-80;if(r.top<100||r.bottom>bottom)input.scrollIntoView({block:'center',behavior:'auto'});}},300);});
document.addEventListener('input',()=>queueMicrotask(updateHistory));
document.addEventListener('focusout',()=>requestAnimationFrame(()=>{if(view==='item-detail'&&!document.activeElement?.matches('#screen-item-detail input'))handleViewportChange();}));

if(document.fonts?.ready)document.fonts.ready.then(()=>{_twMemo.clear();handleViewportChange({force:true});});

const backupInput=document.getElementById('backup-file');
const selector=document.getElementById('bill-selector'),actionsButton=document.getElementById('bill-actions');
let restoringBackup=false,externalCheckQueued=false;
function focusBillContext(){
  const generation=mainScroll.generation,owner=controls,interaction=owner?.interaction;
  const keyboard=owner?.keyboard;
  requestAnimationFrame(()=>{
    if(generation!==mainScroll.generation||owner!==controls||interaction!==controls?.interaction||opening||sheetOpen()||document.querySelector('.bill-panel')||document.activeElement?.matches('input,textarea,select'))return;
    const bounds=selector.getBoundingClientRect(),tabs=document.getElementById('top-tabs').getBoundingClientRect();
    const viewport=window.visualViewport;
    const bottom=(viewport?.offsetTop??0)+(viewport?.height??innerHeight);
    if(keyboard&&bounds.width&&bounds.top>=tabs.bottom&&bounds.bottom<=bottom)selector.focus({preventScroll:true});
    else{
      const heading=document.getElementById('hdr-title');
      heading.tabIndex=-1;
      heading.focus({preventScroll:true});
    }
  });
}
bindBillAction(selector,()=>controls.openSelector(),{allowPending:true});
bindBillAction(actionsButton,()=>controls.openActions(),{allowPending:true});
function requestImport(){
  if(restoringBackup||actionBusy||opening||pendingSave||billControlContext().mutationBlocked){
    toast('แก้ไขสิ่งที่ค้างไว้ก่อนนำเข้าบิล');
    return;
  }
  if(editors.composing){toast('แก้ไขข้อความให้เสร็จก่อน แล้วนำเข้าบิลอีกครั้ง');return;}
  backupInput.value='';
  backupInput.click();
}
backupInput.onchange=async()=>{
  const file=backupInput.files?.[0];
  backupInput.value='';
  if(!file||restoringBackup)return;
  restoringBackup=true;
  try{await runBillAction(async()=>importReviewed(await readBillFile(file),file.name));}
  finally{restoringBackup=false;}
};
function newOperation(kind,record){
  return {kind,id:record?.id??newId(),mutationId:newId(),...(kind==='delete'?{replacementId:newId()}:{}),outcome:null};
}
async function importReviewed(file,filename){
  if(billControlContext().mutationBlocked)return;
  const operation=pendingBillOperation=newOperation('import');
  const record=await controls.importFile(file,filename,operation);
  if(!record){if(!operationUncertain())pendingBillOperation=null;updateBillContext();return;}
  await finishLibraryOperation(operation,{record});
}
async function startNew(allowSeparate=false){
  if(billControlContext().mutationBlocked)return;
  const operation=pendingBillOperation?.kind==='create'?pendingBillOperation:newOperation('create');
  pendingBillOperation=operation;
  setOpening(true);
  let outcome;
  try{outcome=operation.outcome=await repository.createDefault({...operation,allowSeparate});}
  finally{setOpening(false);}
  if(outcome.status==='saved'){await finishLibraryOperation(operation,outcome);return;}
  if(outcome.status==='attention'){
    separateStart=true;
    storageError=outcome.message;
    if(!billSession)entryPhase='attention';
  }else if(outcome.status!=='uncertain'){
    storageError=outcome.message;
    if(outcome.status==='conflict')pendingBillOperation=null;
  }
  renderBillProblem();
}
async function finishLibraryOperation(operation,outcome){
  pendingBillOperation=null;
  if(operation.kind==='delete'){
    const nextView=outcome.createdDefault?'menu':view;
    mainScroll.leave();
    purgeBillWork(tabStorage,outcome.deletedId);
    billSession=null;
    missingTarget=null;
    storageBlocked=true;
    storedBill=emptyBill();
    S=approvedState(storedBill);
    invalidateBT();
    if(outcome.successor){
      if(await installBill(outcome.successor.id,nextView,{reason:'deleted'}))focusBillContext();
    }else{
      entryPhase='attention';
      separateStart=true;
      storageError=outcome.attention;
      goto('menu');
    }
    toast('ลบบิลแล้ว');
    return;
  }
  const installed=await installBill(outcome.record.id,operation.kind==='startup'&&!outcome.created?requestedView():'menu',{reason:operation.kind==='startup'?'startup':'created'});
  if(installed&&operation.kind!=='startup'){
    focusBillContext();
    if(operation.kind==='create')toast('สร้างบิลใหม่แล้ว');
  }
}
async function dispatchBillAction(kind,target){
  if(kind!=='new'&&(!target||target.id!==billSession?.billId||target.id===missingTarget))return;
  if(kind==='download'){downloadText(encodeBillFile(target),billFilename(target.name));return;}
  if(kind==='details'){await controls.details(target);return;}
  if(billControlContext().mutationBlocked)return;
  if(kind==='new'){await startNew();return;}
  if(kind==='delete'){
    const operation=pendingBillOperation=newOperation('delete',target);
    const outcome=await controls.confirmDelete(target,operation);
    if(outcome)await finishLibraryOperation(operation,outcome);
    else{
      if(!operationUncertain())pendingBillOperation=null;
      updateBillContext();
      externalCheckQueued=true;
    }
  }else await clearCurrent(kind,target);
}
let developmentStorage;
try{developmentStorage=localStorage;}catch{}
function hasOldWork(){
  try{return DEVELOPMENT_WORK_KEYS.some(key=>tabStorage?.getItem(key)!=null);}
  catch{return false;}
}
async function inspectEvidence(id){
  const model=await readBillEvidence({repository,developmentStorage,sessionStorage:tabStorage,billId:id});
  const candidate=await controls.evidence(model);
  if(candidate)await importReviewed(candidate,'บิลจากข้อมูลเดิม.json');
}
async function retryOperation(){
  const operation=pendingBillOperation;
  if(!operationUncertain()||!repository)return;
  const outcome=operation.outcome=await repository.reconcileOperation(operation);
  if(outcome.status!=='saved'){updateBillContext();toast(outcome.message);return;}
  // Explicit selection after uncertainty may already have installed another bill.
  if(operation.kind==='delete'&&billSession&&billSession.billId!==operation.id){
    purgeBillWork(tabStorage,outcome.deletedId);
    pendingBillOperation=null;
    updateBillContext();
    updateHistory();
    toast('ลบบิลแล้ว');
    return;
  }
  await finishLibraryOperation(operation,outcome);
}
bindBillAction(document.getElementById('retry-operation'),retryOperation,{allowPending:true});
bindBillAction(document.getElementById('export-evidence'),()=>inspectEvidence(missingTarget??billSession?.billId),{allowPending:true});
bindBillAction(document.getElementById('separate-bill'),()=>startNew(true));
document.getElementById('retry-save').onclick=async()=>{
  if(!pendingCandidate)return;
  const capture=pendingCandidate;
  if(await commitCandidate(capture.bill,capture)){if(view==='item-detail'){teardownItemDetail();session=null;goto(prevView);}else render();}
};
document.getElementById('export-unsaved').onclick=exportCandidate;
bindBillAction(document.getElementById('reload-bill'),async()=>{
  if(openingTarget){
    const target=openingTarget;
    if(await installBill(target.id,target.targetView,{reason:target.reason}))focusBillContext();
    return;
  }
  if(versionBlocked){location.reload();return;}
  if(!billSession)return;
  const choice=await modal('เปิดบิลล่าสุดไหม?','ดาวน์โหลดสิ่งที่แก้ไว้ก่อน หากยังต้องการเก็บการแก้ไขในหน้านี้',[{label:'แก้ต่อ',value:false},{label:'เปิดบิลล่าสุด',value:true}]);
  if(choice)await installBill(billSession.billId);
},{allowPending:true});

bindBillAction(document.getElementById('old-work'),()=>inspectEvidence(),{allowPending:true});
async function clearCurrent(kind,target){
  let capture=target;const mutationId=newId();
  const people=kind==='people';
  const title=()=>[`${people?'ลบรายชื่อคนทั้งหมด':'ลบเมนูอาหารทั้งหมด'}ในบิล `,customName(capture.name),' ใช่ไหม?'];
  const body=()=>people?`รายชื่อ ${capture.bill.people.length} คนและการเลือกคนในทุกเมนูจะถูกลบ เมนู ราคา และค่าปรับยอดยังอยู่ (ย้อนกลับได้)`:capture.bill.items.length?`เมนู ${capture.bill.items.length} รายการและข้อมูลการหารจ่ายจะถูกลบ พร้อมรีเซ็ต Service Charge, VAT และส่วนลด ชื่อบิลและรายชื่อคนยังอยู่ (ย้อนกลับได้)`:'ยังไม่มีเมนู จะรีเซ็ต Service Charge, VAT ส่วนลด และข้อมูลยอดใบเสร็จเดิม โดยเก็บชื่อบิลและรายชื่อคนไว้ (ย้อนกลับได้)';
  const result=await openSheet({title:title(),body:'<p></p>',destructive:true,mount:host=>{host.body.querySelector('p').textContent=body();},actions:[{label:'ยกเลิก',value:false},{label:people?'ลบรายชื่อทั้งหมด':capture.bill.items.length?'ลบเมนูทั้งหมด':'รีเซ็ตค่าปรับยอด',className:'sheet-danger',run:async host=>{
    const latest=await repository.read(capture.id);if(!latest)throw Error('ไม่พบบิลนี้ อาจถูกลบแล้ว');
    if(latest.recordRevision!==capture.recordRevision){capture=latest;adoptRefreshed(await billSession.load());host.setTitle(title());host.body.querySelector('p').textContent=body();throw Error('บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดแล้วกดยืนยันอีกครั้ง');}
    const candidate=(people?clearPeople:clearDishes)(capture.bill);const outcome=await billSession.commit(candidate,{baseRevision:capture.recordRevision,kind:'clear-'+kind,mutationId});
    if(!acceptBill(outcome))throw Error(outcome.message);return true;
  }}]});if(result){pruneCollapsedPeople();render();}
}
function markMissing(target,message){
  storageBlocked=true;
  storageError=message;
  saveOutcome='missing';
  missingTarget=target.billId;
  entryPhase='missing';
  if(!session&&!pendingCandidate&&!invalidCandidate&&!hasPeopleDraft()&&!document.querySelector('#app .screen.active [data-unsaved]')){
    mainScroll.leave();
    billSession=null;
    goto('menu');
  }else updateBillContext();
}
async function checkExternalBill(){
  if(!repository||!billSession||versionBlocked)return;
  if(pendingSave||actionBusy||opening||nameEditor?.busy){externalCheckQueued=true;return;}
  externalCheckQueued=false;
  const target=billSession;
  try{
    const latest=await repository.read(target.billId);
    if(target!==billSession)return;
    if(pendingSave||actionBusy||opening||nameEditor?.busy){externalCheckQueued=true;return;}
    if(!latest){markMissing(target,'ไม่พบบิลนี้ อาจถูกลบแล้ว');updateHistory();return;}
    if(latest.recordRevision===target.record.recordRevision)return;
    if(session||hasPeopleDraft()||nameEditor?.dirty||document.activeElement?.matches('input')||sheetOpen()||pendingCandidate||invalidCandidate){
      storageError='บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนบันทึก';
      saveOutcome='conflict';
      updateBillContext();
      return;
    }
    setOpening(true);
    try{
      const result=await target.load();
      if(target!==billSession||versionBlocked)return;
      adoptRefreshed(result);
      if(result.message)toast(result.message);
    }finally{
      setOpening(false);
      if(externalCheckQueued)queueMicrotask(checkExternalBill);
    }
  }catch(error){
    if(target===billSession){storageError=error.message;updateBillContext();}
  }
}
try{const channel=new BroadcastChannel('fairshare-library');channel.onmessage=()=>checkExternalBill();}catch{}
addEventListener('fairshare-storage-versionchange',()=>{
  versionBlocked=true;
  storageBlocked=true;
  storageError='โหลดหารจ่ายแฟร์ๆ ใหม่ก่อนบันทึกต่อ';
  controls?.close();
  if(!billSession){entryPhase='unavailable';render();}
  updateBillContext();
  updateHistory();
});
addEventListener('focus',checkExternalBill);
addEventListener('pageshow',checkExternalBill);
addEventListener('pagehide',()=>controls?.close());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkExternalBill();});
addEventListener('beforeunload',event=>{
  if(nameEditor?.dirty||nameEditor?.busy||actionBusy&&pendingBillOperation||operationUncertain()||pendingCandidate||invalidCandidate||pendingSave||session?.isDirty||hasPeopleDraft()||document.querySelector('#app .screen.active [data-unsaved]')||(view==='people'&&document.getElementById('np-inp')?.value.trim())){
    event.preventDefault();
    event.returnValue='';
  }
});
document.addEventListener('input',event=>{
  if(event.target.matches('#app input:not([type=radio]):not([type=checkbox]):not([type=file])'))event.target.dataset.unsaved='true';
  updateBillContext();
});
document.addEventListener('focusout',()=>queueMicrotask(updateBillContext));
const requestedView=()=>new URL(location.href).searchParams.get('view')==='summary'?'summary':'menu';
function mountBillControls(){
  controls?.dispose();nameEditor?.dispose();
  nameEditor=createBillNameEditor({input:document.getElementById('bill-selector-name'),feedback:document.getElementById('bill-name-feedback'),repository,getContext:billControlContext,onStateChange:state=>{document.getElementById('main').inert=opening||!!billSession&&operationUncertain()||state.busy||state.problem;document.getElementById('top-tabs').inert=opening||state.problem;},onSaved:async record=>{
    const target=billSession;if(record.id!==target?.billId)return;
    const result=await target.load();if(result.status!=='loaded')throw Error(result.message||'เปิดข้อมูลล่าสุดไม่ได้ ลองอีกครั้ง');
    if(target===billSession)adoptRefreshed(result);
  }});
  controls=createBillControls({
    repository,selector,actionsButton,getContext:billControlContext,bindAction:(node,action,options)=>bindBillAction(node,action,{...options,allowPending:true}),
    onSelect:id=>pendingCandidate||invalidCandidate?toast('ยังไม่ได้บันทึก ลองอีกครั้งหรือดาวน์โหลดสิ่งที่แก้ไว้ก่อน'):installBill(id).then(installed=>{if(installed)focusBillContext();return installed;}),
    onAction:dispatchBillAction,onInspect:inspectEvidence,onRequestImport:requestImport,
    onDownload:({text,filename,type})=>downloadText(text,filename,type),onError:toast
  });
}
async function initialize(){
  const url=new URL(location.href),explicit=url.searchParams.get('bill'),select=url.searchParams.get('select')==='1';
  try{
    repository?.close();
    repository=null;
    versionBlocked=false;
    entryPhase='loading';
    storageError='';
    render();
    repository=await openBillRepository({developmentStorage});
    mountBillControls();
    if(explicit!==null)await installBill(explicit,requestedView(),{reason:'startup'});
    else if(select){
      entryPhase='missing';
      storageError='เลือกบิลที่บันทึกไว้ หรือสร้างบิลใหม่เพื่อเริ่ม';
      goto('menu');
    }else{
      const operation=pendingBillOperation?.kind==='startup'?pendingBillOperation:newOperation('startup');
      pendingBillOperation=operation;
      const outcome=operation.outcome=await repository.ensureDefault(operation);
      if(['saved','selected'].includes(outcome.status))await finishLibraryOperation(operation,outcome);
      else{
        entryPhase=outcome.status==='attention'?'attention':'unavailable';
        separateStart=outcome.status==='attention';
        storageError=outcome.message;
        storageBlocked=true;
        goto('menu');
      }
    }
    if(select){
      await controls.openSelector();
      const current=new URL(location.href);
      if(selector.getAttribute('aria-expanded')==='true'){
        current.searchParams.delete('select');
        history.replaceState(history.state,'',current);
      }
    }
  }catch(error){
    if(!controls||!repository)mountBillControls();
    entryPhase='unavailable';
    storageBlocked=true;
    storageError=error.message;
    goto('menu');
  }
}
await initialize();
