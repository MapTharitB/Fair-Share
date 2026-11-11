import {createTextMeasurer} from './text-measure.mjs';
import {mountPeople,mountItem} from './main-editor-view.mjs';
import {mountMenu,mountSummary} from './main-bill-view.mjs';
import {createItemEditor,createPeopleDraft} from './main-editors.mjs';
import {createMainBillController} from './main-bill-controller.mjs';
import {createMainRecovery} from './main-recovery.mjs';
import {fmt,getItemTotal} from './bill-display.mjs';
import {getItemWarnings,getSplitLabel,getPersonWarning} from './bill-warnings.mjs';
import {downloadSummaryImage} from './summary-image.mjs';
import {createMainScroll} from './main-layout.mjs';
import {readBillFile,encodeBillFile,billFilename} from './backup-file.mjs';
import {openBillRepository} from './bill-repository.mjs';
import {createBillControls} from './bill-controls.mjs';
import {createBillNameEditor} from './bill-name-editor.mjs';
import {readBillEvidence,DEVELOPMENT_WORK_KEYS} from './bill-evidence.mjs';
import {openPersonMenus} from './person-menu-dialog.mjs';
import {clearPeople,clearDishes,setPersonMenus} from './bill-operations.mjs';
import {createRecoveryNotice,openSheet,sheetOpen,customName,setSheetText,confirmDiscard} from './in-app-confirm.mjs';
import {sameValue} from './history.mjs';
import {createEditorActions} from './editor-actions.mjs';
import {historyNeedsCompact,mountHistoryControls} from './history-controls.mjs';
import {billUiKey,receiptDraftKey} from './bill-work-keys.mjs';
import {trackPointerHover} from './pointer-hover.mjs';
import {createInteractionBusy} from './interaction-busy.mjs';

import {approvedBill,approvedShares,approvedBillTotals,recalculateApprovedItem} from './approved-ui-bridge.mjs';
import {emptyBill,newId} from './bill-state.mjs';
const pageLifetime=new AbortController(),pageTimers=new Set(),pageFrames=new Set();
trackPointerHover(document,pageLifetime.signal);
let pageDisposed=false;
function listen(target,type,callback,options={}){target.addEventListener(type,callback,{...(typeof options==='boolean'?{capture:options}:options),signal:pageLifetime.signal});}
function pageTimeout(callback,delay){const timer=setTimeout(()=>{pageTimers.delete(timer);if(!pageDisposed)callback();},delay);pageTimers.add(timer);return timer;}
function pageFrame(callback){const frame=requestAnimationFrame(time=>{pageFrames.delete(frame);if(!pageDisposed)callback(time);});pageFrames.add(frame);return frame;}
let repository=null,controls=null,nameEditor=null,actionBusy=false;
let tabStorage;try{tabStorage=sessionStorage;}catch{}

// Resource reconnection remains composition; this port never owns bill state.
const repositoryPort={read:id=>repository.read(id),write:operation=>repository.write(operation),
  reconcileOperation:operation=>repository.reconcileOperation(operation),writeLastSelected:id=>repository.writeLastSelected(id)};
const billController=createMainBillController({repository:repositoryPort,sessionStorage:tabStorage,
  getInteractionGuards:()=>({actionBusy,nameBusy:!!nameEditor?.busy,hasItemSession:!!session,
    hasPeopleDraft:hasPeopleDraft(),nameDirty:!!nameEditor?.dirty,inputFocused:!!document.activeElement?.matches('input'),sheetOpen:sheetOpen()}),
  onChange:onBillChange});
const billState=()=>billController.getSnapshot();
const workingBill=(snapshot=billState())=>snapshot.working;
const savedBill=(snapshot=billState())=>snapshot.record?.bill??emptyBill();
// Bound presentation port for existing checklist callbacks. It cannot retarget a
// pending callback to another bill and never exposes the controller's session.
function activeSession(){
  const captured=billState();if(!captured.record)return null;
  const id=captured.billId;
  const stillCurrent=()=>billController.billId===id;
  return {
    get billId(){return id;},get record(){return stillCurrent()?billState().record:captured.record;},
    get current(){return stillCurrent()?savedBill():captured.record.bill;},
    get canUndo(){return stillCurrent()&&billState().canUndo;},get canRedo(){return stillCurrent()&&billState().canRedo;},
    load:()=>stillCurrent()?billController.refresh():Promise.resolve({status:'stale',message:'บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนบันทึก'}),
    async commit(candidate,options){
      if(!stillCurrent())return {status:'conflict',message:'บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนบันทึก'};
      const accepted=await billController.commit(candidate,options),snapshot=billState();
      if(snapshot.billId!==id)return {status:'stale',message:'บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนบันทึก'};
      return {status:accepted?snapshot.outcome:snapshot.outcome??'failed',bill:snapshot.record?.bill,record:snapshot.record,message:snapshot.error};
    }
  };
}
const editors=createEditorActions();
const mainScroll=createMainScroll({storage:tabStorage,getEpoch:()=>billController.billId});
let headerHistory;
function currentItem(){return session?.snapshot().draft??workingBill().items.find(item=>item.id===activeItemId);}
function installItemDraft(item){if(session)session.edit(draft=>{for(const key of Object.keys(draft))delete draft[key];Object.assign(draft,structuredClone(item));});}
function recordItem(){if(session&&!editors.composing){session.record();updateHistory();}}
function updateHistory(snapshot=billState()){
  if(!headerHistory||savingPresentation)return;
  const itemView=view==='item-detail';
  const history=itemView?session:snapshot;
  const pending=false;
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
  const blocked=snapshot.opening||operationUncertain(snapshot)||(!itemView&&snapshot.storageBlocked);
  headerHistory.update({
    canUndo:!blocked&&(!!history?.canUndo||!!pending),
    canRedo:!blocked&&!!history?.canRedo&&!pending,
    compact:historyNeedsCompact(labelWidth,wrapped?header.clientWidth-parseFloat(headerStyle.paddingLeft)-parseFloat(headerStyle.paddingRight):available)
  });
}
function syncMainStickyOffsets(){
  const header=document.getElementById('hdr'),tabs=document.getElementById('top-tabs');
  const height=header.getBoundingClientRect().height,tabHeight=tabs.getBoundingClientRect().height;
  document.documentElement.style.setProperty('--main-header-height',height+'px');
  document.documentElement.style.setProperty('--main-summary-top',height+tabHeight+'px');
}
async function moveHistory(direction){
  if(billState().opening||operationUncertain()||billState().storageBlocked&&view!=='item-detail')return;
  if(view==='item-detail'&&session){recordItem();session[direction]();renderItemDetail();}
  else if(activeSession()&&await billController[direction]())render();
  updateHistory();
}
function acceptBill(result){return ['saved','unchanged'].includes(result.status);}
function adoptRefreshed(result){if(result.status==='loaded')render();updateHistory();updateBillContext();}

const recovery=createRecoveryNotice({getModel:recoveryModel,fallback:()=>document.getElementById('hdr-title')});
function recoverableBill(){
  capturePeopleDraft();
  const ui=billController.getRecoveryWorking();
  if(session){
    if(!session.snapshot().draft.name.trim())throw Error('รายการที่ยังกรอกไม่ครบ');
    const index=ui.items.findIndex(item=>item.id===session.snapshot().draft.id);
    if(index<0)ui.items.push(structuredClone(session.snapshot().draft));else ui.items[index]=structuredClone(session.snapshot().draft);
  }
  const people=getPeopleDraft(),pendingAdd=billState().pendingCandidate?.peopleEdit;
  if(people.rename){
    if(!people.rename.value.trim())throw Error('รายชื่อที่ยังกรอกไม่ครบ');
    const person=ui.people.find(p=>p.id===people.rename.id);if(person)person.name=people.rename.value.trim();
  }
  const sameAddition=pendingAdd?.kind==='add'&&pendingAdd.name===people.add.trim()&&ui.people.some(person=>person.id===pendingAdd.id);
  if(people.add.trim()&&!sameAddition)ui.people.push({id:newId(),name:people.add.trim()});
  return approvedBill(ui,savedBill());
}
async function selectRecoveryBill(id){
  if((billState().pendingCandidate||billState().invalidCandidate||session?.dirty||hasPeopleDraft()||nameEditor?.dirty)&&!await confirmDiscard())return false;
  return installBill(id).then(installed=>{if(installed)focusBillContext();return installed;});
}
async function saveRecoveryCopy(candidate,name){
  const operation=billState().pendingOperation?.kind==='recovery-copy'?billState().pendingOperation:newOperation('recovery-copy');
  const result=await billController.runLibraryOperation(operation,current=>repository.create({...current,name,bill:candidate}));
  if(result?.status==='saved')toast('บันทึกเป็นบิลใหม่แล้ว');
}
async function recoveryModel(){return buildRecoveryModel();}
const buildRecoveryModel=createMainRecovery({getSnapshot:billState,getWork:recoverableBill,
  getName:()=>(nameEditor?.dirty?document.getElementById('bill-selector-name').value.trim():billState().record?.name)||'บิลที่กู้คืน',
  async readLibrary(id){
    let library=null,latest,readable=false;
    try{if(!repository){repository=await openBillRepository({developmentStorage});mountBillControls();}library=await repository.list();if(id)latest=await repository.read(id);readable=true;}catch{}
    return {library,latest,readable};
  },
  async readEvidence(id){const evidence=await readBillEvidence({repository,developmentStorage,sessionStorage:tabStorage,billId:id});return evidence.sources.find(source=>source.candidate)?.candidate;},
  retry:retryOperation,open:installBill,createCopy:saveRecoveryCopy,selectBill:selectRecoveryBill,exportWork:exportCandidate,
  downloadBill:(bill,name)=>downloadText(encodeBillFile({name,bill}),billFilename(name)),startNew,selectOther:()=>controls.openSelector(),
  async connect(){if(billState().record)await checkExternalBill();else await initialize();if(billState().error)void recovery.show();},
  getConnectionError:()=>repository?.connectionError
});

// ─── 1. ICON CONSTANTS ────────────────────────────────────────────────────────
// ─── 2. BILLSPLIT NAMED CONSTANTS ─────────────────────────────────────────────
const TOAST_DURATION_MS=2200;

// ─── 3. SHARED UTILITIES ──────────────────────────────────────────────────────
const gid=newId;
const clone=o=>JSON.parse(JSON.stringify(o));
// ─── 4. STATE ─────────────────────────────────────────────────────────────────

let collapsedPeople=new Set();
let view='menu',prevView='menu',activeItemId=null,session=null,editingPid=null,peopleReturnTo=null;
const peopleDraftOwner=createPeopleDraft();
const getPeopleDraft=()=>peopleDraftOwner.snapshot();
function updatePeopleDraft(patch){peopleDraftOwner.capture({...getPeopleDraft(),...patch});}
function capturePeopleDraft(){if(view!=='people')return;const add=document.getElementById('np-inp');if(add)updatePeopleDraft({add:add.value});const edit=editingPid&&document.getElementById('ep-'+editingPid);if(edit)updatePeopleDraft({rename:{id:editingPid,value:edit.value}});}
function hasPeopleDraft(){return !!(getPeopleDraft().add.trim()||getPeopleDraft().rename||editingPid);}
function enterPeople(opener){
  peopleReturnTo={billId:activeSession().billId,view,itemId:view==='item-detail'?activeItemId:null,scroll:{x:scrollX,y:scrollY},opener:opener?.id};
  recordItem();editingPid=null;peopleDraftOwner.reset();goto('people');
}
function bindPeopleEntry(element){
  if(!element)return;
  bindBillAction(element,()=>enterPeople(document.getElementById(element.id)));
  if(element.tagName!=='BUTTON'){element.setAttribute('role','button');element.tabIndex=0;element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();editors.run(()=>runBillAction(()=>enterPeople(document.getElementById(element.id))));}});}
}
let resizeRAF=0;
let summaryHintDismissed=false;

// ─── 6. HELPERS ───────────────────────────────────────────────────────────────
const {measure:measureTW,clear:clearHistoryWidths}=createTextMeasurer();

function isItemDetailTwoLine(){const el=document.getElementById('screen-item-detail');const w=el&&el.clientWidth>50?el.clientWidth:window.innerWidth;return w<580;}

// ─── 7. BILLSPLIT LOGIC ───────────────────────────────────────────────────────
let _btCache=null;
function invalidateBT(){_btCache=null;}
function getCachedBT(snapshot=billState()){return _btCache??(_btCache=getBT(snapshot));}

function applyC(item){const result=recalculateApprovedItem(item);item.assignments=result.item.assignments;return result.overallocated;}
function getDA(item){return approvedShares(item);}


function pruneCollapsedPeople(snapshot=billState()){const live=new Set(workingBill(snapshot).people.map(p=>p.id));collapsedPeople=new Set([...collapsedPeople].filter(id=>live.has(id)));}
let savingPresentation=false,nameSaving=false,openingPresentation=false;
const mainInteraction=createInteractionBusy(document.getElementById('app'),{signal:pageLifetime.signal});
function syncBusy(){
  mainInteraction.setBusy(savingPresentation||nameSaving||actionBusy);
  const app=document.getElementById('app');
  if(savingPresentation||nameSaving||openingPresentation)app.setAttribute('aria-busy','true');else app.removeAttribute('aria-busy');
}
function setSaving(value){savingPresentation=value;syncBusy();
  if(!value){const button=document.getElementById('btn-download-summary');if(button)button.disabled=imageExporting;}
}
async function commitCandidate(candidate,options={}){return billController.commit(candidate,options);}
async function saveS(options={}){
  if(billState().storageBlocked||!activeSession()){void recovery.show();return false;}
  try{return await commitCandidate(approvedBill(workingBill(),savedBill()),options);}
  catch(error){billController.reportInvalid(error);toast('ยังไม่ได้บันทึก: '+error.message);return false;}
}
async function runBillAction(action,{allowPending=false,preserveGesture=false}={}){
  if(actionBusy||billState().opening)return;actionBusy=true;syncBusy();
  try{
    document.activeElement?.blur?.();
    if(!preserveGesture)await Promise.resolve();
    if(nameEditor?.unsettled&&!await nameEditor.settle())return;
    if(billState().saving)await billController.waitForSave();
    if((billState().pendingCandidate||billState().invalidCandidate)&&!allowPending){toast('ยังไม่ได้บันทึก ลองอีกครั้งหรือดาวน์โหลดสิ่งที่แก้ไว้ก่อน');return;}
    return await action();
  }catch(error){toast(error.message);}finally{actionBusy=false;syncBusy();if(billState().reconciliationQueued)void checkExternalBill();}
}
function bindBillAction(button,action,options){if(button)editors.bind(button,()=>runBillAction(action,options));}
function uiKey(id=billController.billId){return billUiKey(id);}
function saveUiState(snapshot=billState()){if(!snapshot.record)return;try{tabStorage?.setItem(uiKey(snapshot.billId),JSON.stringify({collapsed:[...collapsedPeople],summaryHintDismissed}));}catch{}}
const operationUncertain=(snapshot=billState())=>snapshot.pendingOperation?.outcome?.status==='uncertain';
function billControlContext(snapshot=billState()){
  const record=snapshot.missingTarget===snapshot.billId?null:snapshot.record;
  const cleared=record&&clearDishes(record.bill);
  const canClearDishes=cleared&&(!sameValue(cleared.items,record.bill.items)||!sameValue(cleared.groups,record.bill.groups));
  return {
    available:!!repository&&!snapshot.opening,
    mutationBlocked:operationUncertain(snapshot)||!!snapshot.pendingCandidate&&!snapshot.saving||snapshot.invalidCandidate,
    mainBlocked:snapshot.opening||snapshot.storageBlocked||!!snapshot.record&&operationUncertain(snapshot),
    tabsBlocked:snapshot.opening,reconciliationQueued:snapshot.reconciliationQueued,
    record,canClearDishes,canClearPeople:!!record?.bill.people.length
  };
}
function updateBillContext(snapshot=billState()){
  const row=document.getElementById('bill-context');
  if(!row)return;
  row.hidden=view==='people'||view==='item-detail';
  const uncertain=operationUncertain(snapshot),context=billControlContext(snapshot);
  const problem=uncertain?snapshot.pendingOperation.outcome.message:snapshot.error||snapshot.openingTarget?.message;
  recovery.update(problem?`${snapshot.record?snapshot.billId:snapshot.missingTarget??'startup'}:${uncertain?'uncertain':snapshot.entryPhase}:${snapshot.outcome??''}:${problem}`:'',snapshot.record?'ยังไม่ได้บันทึก':'ไม่สามารถเปิดบิลได้');
  document.getElementById('main').inert=context.mainBlocked;
  document.getElementById('top-tabs').inert=context.tabsBlocked;
  controls?.refresh(context);nameEditor?.refresh(context);
}
async function installBill(id,targetView,{reason='switch'}={}){
  const installed=await billController.open(id,{reason,targetView});
  if(installed)finishBillNavigation(targetView??(view==='summary'?'summary':'menu'));
  else if(!billState().record)goto('menu');
  return installed;
}
function finishBillNavigation(targetView){
  const url=new URL(location.href);url.searchParams.set('bill',billState().billId);url.searchParams.delete('select');history.replaceState(history.state,'',url);
  goto(targetView);
}
function downloadText(text,filename,type='application/json'){
  const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=filename;a.click();pageTimeout(()=>URL.revokeObjectURL(url),1000);toast('เริ่มดาวน์โหลดแล้ว');
}
function exportCandidate(){
  const name=activeSession()?.record?.name??'ข้อมูลกู้คืน';
  capturePeopleDraft();

  try{downloadText(encodeBillFile({name,bill:recoverableBill()}),billFilename(name));}
  catch{downloadText(JSON.stringify({format:'fairshare-unsaved-recovery',fields:[...document.querySelectorAll('#app input')].filter(input=>input.getClientRects().length).map(input=>({id:input.id,value:input.value})),billId:activeSession()?.billId,peopleDraft:getPeopleDraft(),itemDraft:session?.snapshot().draft,ui:workingBill()},null,2),'หารจ่ายแฟร์ๆ-unsaved-recovery.json');}
}
function isItemDefault(item){return !item.name.trim()&&(!item.price||item.price<=0)&&(!item.assignments||!item.assignments.length);}

function getBT(snapshot=billState()){try{return approvedBillTotals(workingBill(snapshot),savedBill(snapshot));}catch(error){toast(error.message);return null;}}

function setAllocation(item,pid,value,mode){
  const a=item.assignments.find(a=>a.personId===pid);if(!a)return;
  a.locked=true;a.lockMode=mode==='amt'?'amount':'percentage';
  if(mode==='amt'){a.amount=Math.round(value*100)/100;delete a.lockPercentUnits;}
  else a.lockPercentUnits=Math.round(Math.min(value,100)*10000);
  applyC(item);
}
function updateBillTotals(snapshot=billState()){if(view==='menu'&&menuMount)menuMount.update({...billRenderModel({},snapshot),totalsOnly:true});}
function layoutDistribution(){summaryMount?.layout();}
function updateHdrTotal(total){const el=document.getElementById('hdr-item-total');if(!el)return;if(view==='item-detail'&&total>0){el.textContent=fmt(total,'บาท');el.style.display='block';}else{el.textContent='';el.style.display='none';}}
function shouldShowSummaryHint(snapshot=billState()){if(summaryHintDismissed)return false;return workingBill(snapshot).items.some(it=>it.assignments&&it.assignments.length>0);}
function updateTabHint(snapshot=billState()){const sumTab=document.querySelector('.tab-btn[data-tab="summary"]');if(!sumTab)return;if(!sumTab.classList.contains('active')&&shouldShowSummaryHint(snapshot))sumTab.classList.add('tab-next-step');else sumTab.classList.remove('tab-next-step');}
function setMainTitle(){const el=document.getElementById('hdr-title');el.className='';el.innerHTML=`<span class="title-pre">หารจ่าย</span><span class="title-main">แฟร์ๆ</span>`;}
function setSubTitle(text){const el=document.getElementById('hdr-title');el.className='subpage-title';el.textContent=text;}

function openItemSess(itemId,isNew=false){
  activeItemId=itemId;
  const draft=isNew?{id:itemId,name:'',price:0,quantity:1,assignments:[]}:clone(workingBill().items.find(i=>i.id===itemId));
  session=createItemEditor({item:draft,isNew});
  goto('item-detail');
  const name=document.getElementById('it-name'),price=document.getElementById('it-price');
  // Entry only: rerenders and People-return must not reopen the keyboard.
  if(!draft.name.trim())name.focus({preventScroll:true});
  else if(!price.value.trim()||Number(price.value.replace(/,/g,''))===0)price.focus({preventScroll:true});
}
function teardownItemDetail(){itemMount?.dispose();itemMount=null;document.getElementById('sticky-done-wrap').style.display='none';}
function addNewItem(){if(session){toast('แก้เมนูนี้ให้เสร็จก่อน');return;}openItemSess(gid(),true);}

// Toolbar/keyboard height changes must never rebuild a screen or restore scroll.
let layoutWidth=0;
function handleViewportChange({force=false}={}){
  const width=document.documentElement.clientWidth;
  if(!force&&width===layoutWidth&&view!=='item-detail')return;
  layoutWidth=width;
  cancelAnimationFrame(resizeRAF);
  resizeRAF=pageFrame(()=>{
    updateHistory();
    if(view==='item-detail'){
      itemMount?.layout();
    }else if(view==='menu'){
      updatePeoplePreview();
    }else if(view==='summary'){
      layoutDistribution();
      syncMainStickyOffsets();
    }
  });
}

function updatePeoplePreview(){menuMount?.layout();}

async function doneAction(){
  if(editors.composing)return;
  const item=currentItem();if(!item)return;
  if(!isItemDefault(item)){
    if(!item.name.trim()){const err=document.getElementById('it-name-err');err.textContent='ชื่อเมนูห้ามว่าง';err.style.display='block';document.getElementById('it-name')?.focus();return;}
    const next=workingBill();const index=next.items.findIndex(i=>i.id===item.id);
    if(index<0)next.items.push(clone(item));else next.items[index]=clone(item);
    try{if(!await commitCandidate(approvedBill(next,savedBill())))return;}catch(error){toast(error.message);return;}
  }
  teardownItemDetail();session=null;updateTabHint();goto(prevView);
}

function modal(title,body,actions){
  return openSheet({title,body:'<p></p>',fallback:()=>document.getElementById('bill-selector'),mount:host=>setSheetText(host.body.querySelector('p'),body),actions});
}
let tT;
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(tT);tT=pageTimeout(()=>t.classList.remove('show'),TOAST_DURATION_MS);}
function confirmDelete(label,msg,{confirmLabel='ลบ'}={}){return modal(['ลบ ',customName(label),' ใช่ไหม?'],[...(Array.isArray(msg)?msg:[msg]),' (ย้อนกลับได้)'],[{label:'ยกเลิก',value:'n'},{label:confirmLabel,value:'y',className:'sheet-danger'}]);}

function isDuplicateName(name,excludeId=null){const n=name.trim().toLowerCase();return workingBill().people.some(p=>p.id!==excludeId&&p.name.trim().toLowerCase()===n);}
async function doAddPerson(){const inp=document.getElementById('np-inp'),err=document.getElementById('np-err'),name=inp.value.trim();capturePeopleDraft();if(billState().saving||billState().pendingCandidate)return false;if(!name){if(err){err.textContent='ชื่อห้ามว่าง';err.style.display='block';}return;}if(isDuplicateName(name)){if(err){err.textContent='ชื่อนี้ถูกใช้แล้ว';err.style.display='block';}return;}inp.focus({preventScroll:true});const id=gid();billController.editWorking(draft=>{draft.people.push({id,name});});invalidateBT();if(!await saveS({peopleEdit:{kind:'add',id,name}}))return false;inp.value=getPeopleDraft().add;if(err)err.style.display='none';renderPeopleList();updateBillContext();return true;}
async function doEditPerson(id){const inp=document.getElementById('ep-'+id);if(!inp)return;capturePeopleDraft();const name=inp.value.trim();if(billState().saving||billState().pendingCandidate)return false;if(!name){toast('ชื่อห้ามว่าง');return;}if(isDuplicateName(name,id)){toast('ชื่อนี้ถูกใช้แล้ว');return;}billController.editWorking(draft=>{const person=draft.people.find(person=>person.id===id);if(person)person.name=name;});if(!await saveS({peopleEdit:{kind:'rename',id,name}}))return false;renderPeopleList();return true;}
function removePersonFromItem(item,id){
  item.assignments=item.assignments.filter(assignment=>assignment.personId!==id);
  applyC(item);
  return item;
}
async function doDelPerson(id){
  const {billId,saving,pendingCandidate}=billState();
  if(saving||pendingCandidate)return;
  const p=workingBill().people.find(x=>x.id===id);if(!p)return;
  if(workingBill().items.some(it=>it.assignments.some(a=>a.personId===id))){const c=await confirmDelete(p.name,[customName(p.name),' จะถูกลบออกจากทุกเมนูอาหาร'],{confirmLabel:'ลบออก'});if(c!=='y')return;}
  const current=billState();
  if(pageDisposed||current.billId!==billId||current.opening||current.saving||current.pendingCandidate)return;
  billController.editWorking(draft=>{
    draft.items.forEach(item=>removePersonFromItem(item,id));
    draft.people=draft.people.filter(person=>person.id!==id);
  });
  invalidateBT();await saveS({peopleEdit:{kind:'delete',id,billId}});
}

let imageExporting=false;
function startSummaryImage(){
  if(billState().pendingCandidate||billState().saving){toast('บันทึกการแก้ไขก่อนดาวน์โหลด');return;}
  if(imageExporting)return;imageExporting=true;const button=document.getElementById('btn-download-summary');if(button)button.disabled=true;
  downloadSummaryImage(activeSession().record,toast).catch(error=>toast('สร้างรูปภาพไม่ได้ ลองอีกครั้ง: '+error.message)).finally(()=>{imageExporting=false;if(!billState().saving){const current=document.getElementById('btn-download-summary');if(current)current.disabled=false;}});
}
// ─── 8. RENDER FUNCTIONS ──────────────────────────────────────────────────────

let menuMount=null,summaryMount=null;
function billRenderModel(extra={},snapshot=billState()){
  const working=workingBill(snapshot),totals=getCachedBT(snapshot);
  return {working,totals,imageExporting,collapsed:[...collapsedPeople],
    labels:Object.fromEntries(working.items.map(item=>[item.id,getSplitLabel(item,working.people)])),
    warnings:Object.fromEntries(working.items.map(item=>[item.id,getItemWarnings(item,working.people)])),
    shares:Object.fromEntries(working.items.map(item=>[item.id,approvedShares(item)])),
    personWarnings:Object.fromEntries(working.people.map(person=>[person.id,getPersonWarning(person.id,working,totals)])),...extra};
}
function renderMenu(snapshot=billState()){
  mainScroll.before('menu');const model=billRenderModel({},snapshot);
  if(menuMount)menuMount.update(model);else menuMount=mountMenu(model,billViewActions);
  mainScroll.after('menu');
}
const billViewActions={
  bindPeopleEntry,bindBillAction,updateTabHint,addItem:addNewItem,openItem(id){if(session){toast('แก้เมนูนี้ให้เสร็จก่อน');return;}openItemSess(id);},
  async uploadReceipt(){if(await saveS()){mainScroll.capture();location.href=new URL('../receipt.html?bill='+encodeURIComponent(billState().billId),import.meta.url).href;}},
  async deleteItem(id){const item=workingBill().items.find(item=>item.id===id);if(!item)return;if(await confirmDelete(item.name||'เมนูนี้','เมนูนี้และข้อมูลการหารจ่ายทั้งหมดของเมนูนี้จะถูกลบ')!=='y')return;billController.editWorking(draft=>{draft.items=draft.items.filter(item=>item.id!==id);});invalidateBT();if(await saveS())renderMenu();},
  async toggleCharge(kind,enabled){billController.editWorking(draft=>{draft[kind].enabled=enabled;});invalidateBT();if(await saveS())renderMenu();},
  async editCharge(kind,value){billController.editWorking(draft=>{draft[kind].value=value|| (kind==='service'?10:7);if(value===0)draft[kind].enabled=false;});invalidateBT();if(await saveS()&&value===0)renderMenu();},
  async editDiscount(value){billController.editWorking(draft=>{draft.discount.value=value;});invalidateBT();await saveS();},
  async discountMode(mode){if(workingBill().discount.mode===mode)return;billController.editWorking(draft=>{if(mode==='percent'&&draft.discount.value>100)draft.discount.value=100;draft.discount.mode=mode;});invalidateBT();if(await saveS())renderMenu();},
  async distribution(key,value){if(billState().saving)return;billController.editWorking(draft=>{draft[key]=value;});invalidateBT();if(await saveS({kind:'distribution'}))renderSummary({keepControls:true});},
  async personMenus(personId){
    const billId=billState().billId;
    try{return await openPersonMenus({session:activeSession(),personId,onSaved:async()=>renderSummary(),onRefreshed:adoptRefreshed,onEditItem:id=>openItemSess(id),onGoToMenu:()=>goto('menu')});}
    finally{billController.releaseSheetCandidate('person-menus',billId);}
  },
  toggleCollapsed(id){if(collapsedPeople.has(id))collapsedPeople.delete(id);else collapsedPeople.add(id);saveUiState();renderSummary({keepControls:true});},
  expandAll(){collapsedPeople.clear();saveUiState();renderSummary({keepControls:true});},collapseAll(){workingBill().people.forEach(person=>collapsedPeople.add(person.id));saveUiState();renderSummary({keepControls:true});},
  async removePersonMenu(personId,itemId){
    if(billState().saving||billState().pendingCandidate)return;
    const captured=billState().record,person=captured.bill.people.find(person=>person.id===personId),item=captured.bill.items.find(item=>item.id===itemId);if(!person||!item)return;
    const remaining=item.assignments.filter(assignment=>assignment.personId!==personId).length;
    const choice=await modal(['ลบ ',customName(item.name||'เมนูนี้'),' ออกจาก ',customName(person.name),' ใช่ไหม?'],(remaining?'ส่วนแบ่งที่ไม่ได้ล็อกจะถูกคำนวณใหม่ โดยคงส่วนแบ่งที่ล็อกไว้ของคนอื่น':'เมนูนี้จะไม่มีคนเลือก')+' (ย้อนกลับได้)',[{label:'ยกเลิก',value:false},{label:'ลบออก',value:true,className:'sheet-danger'}]);if(!choice)return;
    const selected=captured.bill.items.filter(item=>item.id!==itemId&&item.assignments.some(assignment=>assignment.personId===personId)).map(item=>item.id);
    if(await commitCandidate(setPersonMenus(captured.bill,personId,selected).bill,{baseRevision:captured.recordRevision,kind:'remove-person-menu'}))renderSummary();
  },exportSummary:startSummaryImage
};

let peopleMount=null;
function peopleRenderModel(extra={}){return {working:workingBill(),peopleDraft:getPeopleDraft(),editingPid,...extra};}
function renderPeople(){const model=peopleRenderModel();if(peopleMount)peopleMount.update(model);else peopleMount=mountPeople(model,peopleViewActions);}
function renderPeopleList(){if(peopleMount)peopleMount.update(peopleRenderModel({listOnly:true}));}
const peopleViewActions={
  donePeople:()=>editors.run(()=>runBillAction(handleBack)),capturePeople:updatePeopleDraft,
  addPerson:doAddPerson,editPerson:doEditPerson,deletePerson:doDelPerson,composing:()=>editors.composing,saving:()=>billState().saving,
  renamePerson(id){if(editingPid&&editingPid!==id){toast('บันทึกหรือยกเลิกชื่อที่กำลังแก้ก่อน');return;}editingPid=id;updatePeopleDraft({rename:{id,value:workingBill().people.find(person=>person.id===id).name}});renderPeopleList();document.getElementById('ep-'+id)?.focus();},
  cancelRename(){editingPid=null;updatePeopleDraft({rename:null});renderPeopleList();updateBillContext();}
};

let itemMount=null;
function renderItemDetail(){
  recordItem();
  const model={working:workingBill(),item:currentItem(),twoLine:isItemDetailTwoLine()};
  if(itemMount)itemMount.update(model);else itemMount=mountItem(model,itemViewActions());
}
function itemViewActions(){
  const captured=session;
  const matches=()=>session===captured;
  return {bindBillAction,bindPeopleEntry,isTwoLine:isItemDetailTwoLine,bindEditorAction:(node,action)=>editors.bind(node,action),
    currentItem:()=>matches()?currentItem():null,
    installItemDraft:item=>{if(matches())installItemDraft(item);},recordItem:()=>{if(matches())recordItem();},
    renderItem:()=>{if(matches())renderItemDetail();},shares:getDA,recalculate:applyC,setAllocation,
    headerTotal:updateHdrTotal,title:setSubTitle,done:doneAction,doneSticky:()=>editors.run(doneAction),
    async deleteItem(){
      if(!matches())return;const item=currentItem();
      const hasInput=item.name.trim()||item.price>0||item.assignments.length;
      if(hasInput&&await confirmDelete(item.name||'เมนูนี้','ข้อมูลการหารจ่ายทั้งหมดของเมนูนี้จะถูกลบ')!=='y')return;
      if(!matches())return;
      if(!session.snapshot().isNew){billController.editWorking(draft=>{draft.items=draft.items.filter(item=>item.id!==activeItemId);});if(!await saveS())return;}
      teardownItemDetail();session=null;goto(prevView);
    }
  };
}

function renderSummary({keepControls=false}={},snapshot=billState()){
  if(!keepControls)mainScroll.before('summary');
  const model=billRenderModel({keepControls},snapshot);
  if(summaryMount)summaryMount.update(model);else summaryMount=mountSummary(model,billViewActions);
  if(!keepControls)mainScroll.after('summary');
}
// ─── 9. RENDER DISPATCHER ────────────────────────────────────────────────────

function renderBillProblem(snapshot=billState()){
  updateBillContext(snapshot);
  if(snapshot.record)return;
  const el=document.getElementById('screen-'+view),empty=document.createElement('div');
  empty.className='empty bill-exception';
  const message=document.createElement('p');
  message.setAttribute('role','status');
  message.textContent=snapshot.entryPhase==='loading'?'กำลังเปิดบิล…':snapshot.error||'เลือกบิลที่ต้องการเปิด';
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
  if(snapshot.entryPhase!=='loading')action('ดูตัวเลือก','bill-recovery',()=>recovery.show(),true);
  el.replaceChildren(empty);
}
function render(snapshot=billState()){
  updateBillContext(snapshot);
  const oldWork=document.getElementById('old-work');
  if(oldWork)oldWork.hidden=!snapshot.record||!hasOldWork();
  if(!snapshot.record){renderBillProblem(snapshot);return;}
  if(view==='menu')renderMenu(snapshot);
  else if(view==='people')renderPeople();
  else if(view==='item-detail')renderItemDetail();
  else if(view==='summary')renderSummary({},snapshot);
}

// ─── 10. NAVIGATION ───────────────────────────────────────────────────────────

function goto(v,opts={}){
  mainScroll.leave();
  if(v!=='menu'){menuMount?.dispose();menuMount=null;}if(v!=='summary'){summaryMount?.dispose();summaryMount=null;}
  if(v!=='people'){peopleMount?.dispose();peopleMount=null;}
  if(v!=='item-detail'){itemMount?.dispose();itemMount=null;}
  document.getElementById('sticky-done-wrap').style.display='none';
  document.getElementById('screen-'+view)?.classList.remove('active');
  if(v==='menu'||v==='summary')prevView=v;
  controls?.close();
  view=v;if(opts.itemId!==undefined)activeItemId=opts.itemId;
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
  if(v==='menu'||v==='summary'){const url=new URL(location.href);url.searchParams.set('view',v);if(activeSession())url.searchParams.set('bill',activeSession().billId);else if(billState().missingTarget!==null)url.searchParams.set('bill',billState().missingTarget);else url.searchParams.delete('bill');history.replaceState(history.state,'',url);}
  render();updateHistory();if(isSub){if(opts.restoreScroll)mainScroll.restoreTransient(opts.restoreScroll);else window.scrollTo({top:0,behavior:'instant'});}
}

async function handleBack(){
  if(editors.composing)return;
  if(view==='item-detail'){
    recordItem();
    if(session?.dirty&&!isItemDefault(session.snapshot().draft)){
      if(!await confirmDiscard({fallback:()=>document.getElementById('bill-selector')}))return;
    }
    session=null;teardownItemDetail();goto(prevView);
  }else if(view==='people'){
    capturePeopleDraft();
    const target=peopleReturnTo;
    if(!target||target.billId!==activeSession()?.billId){toast('เปิดบิลเดิมก่อนกลับจากรายชื่อคน');return;}
    const rename=getPeopleDraft().rename,addition=getPeopleDraft().add.trim();
    if(rename&&!rename.value.trim()){toast('ชื่อห้ามว่าง');return;}
    const names=workingBill().people.map(p=>(p.id===rename?.id?rename.value:p.name).trim().toLowerCase());
    if(rename&&workingBill().people.some(p=>p.id!==rename.id&&p.name.trim().toLowerCase()===rename.value.trim().toLowerCase())){toast('ชื่อนี้ถูกใช้แล้ว');return;}
    if(addition&&names.includes(addition.toLowerCase())){const error=document.getElementById('np-err');error.textContent='ชื่อนี้ถูกใช้แล้ว';error.style.display='block';return;}
    if(editingPid){if(!await doEditPerson(editingPid))return;}
    if(document.getElementById('np-inp')?.value.trim()){if(!await doAddPerson())return;}
    if(target.billId!==activeSession()?.billId)return;
    peopleReturnTo=null;peopleDraftOwner.reset();
    const addInput=document.getElementById('np-inp');if(addInput)addInput.value='';
    for(const input of document.querySelectorAll('#screen-people [data-unsaved]'))delete input.dataset.unsaved;
    goto(target.view,{itemId:target.itemId??undefined,restoreScroll:target.view==='item-detail'?target.scroll:null});
    const opener=target.opener&&document.getElementById(target.opener),heading=document.getElementById('hdr-title');
    // Pointer returns must not inherit the People text field's visible focus ring.
    if(controls?.keyboard&&opener?.getClientRects().length)opener.focus({preventScroll:true});else{heading.tabIndex=-1;heading.focus({preventScroll:true});}
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
listen(window,'resize',handleViewportChange);
listen(window,'orientationchange',handleViewportChange);
if(window.visualViewport)listen(window.visualViewport,'resize',handleViewportChange);
listen(document,'focusin',e=>{const input=e.target,token=mainScroll.generation;if(input.matches('input:not([type=radio]):not([type=checkbox]):not([type=file]):not([type=hidden])'))pageTimeout(()=>{if(token===mainScroll.generation&&!mainScroll.restoring&&input.isConnected&&document.activeElement===input){const r=input.getBoundingClientRect(),bottom=(window.visualViewport?.offsetTop??0)+(window.visualViewport?.height??innerHeight)-80;if(r.top<100||r.bottom>bottom)input.scrollIntoView({block:'center',behavior:'auto'});}},300);});
listen(document,'input',()=>queueMicrotask(updateHistory));

if(document.fonts){
  const relayoutForFonts=()=>{clearHistoryWidths();handleViewportChange({force:true});};
  document.fonts.ready.then(()=>{if(!pageDisposed)relayoutForFonts();});
  listen(document.fonts,'loadingdone',relayoutForFonts);
}

const backupInput=document.getElementById('backup-file');
const selector=document.getElementById('bill-selector'),actionsButton=document.getElementById('bill-actions');
let restoringBackup=false;
function focusBillContext(){
  const generation=mainScroll.generation,owner=controls,interaction=owner?.interaction;
  const keyboard=owner?.keyboard;
  pageFrame(()=>{
    if(generation!==mainScroll.generation||owner!==controls||interaction!==controls?.interaction||billState().opening||sheetOpen()||document.querySelector('.bill-panel')||document.activeElement?.matches('input,textarea,select'))return;
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
  if(restoringBackup||actionBusy||billState().opening||billState().saving||billControlContext().mutationBlocked){
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
  const operation=newOperation('import');
  await billController.runLibraryOperation(operation,async current=>{
    const record=await controls.importFile(file,filename,current);
    return record?(current.outcome??{status:'saved',record}):null;
  });
}
async function startNew(allowSeparate=false){
  if(billControlContext().mutationBlocked)return;
  const operation=billState().pendingOperation?.kind==='create'?billState().pendingOperation:newOperation('create');
  await billController.runLibraryOperation(operation,current=>repository.createDefault({...current,allowSeparate}));
  renderBillProblem();
}
function finishLibraryEffects({operation,libraryOutcome:outcome,installed,selectedElsewhere}){
  if(selectedElsewhere){if(operation.kind==='delete')toast('ลบบิลแล้ว');return;}
  if(operation.kind==='delete'){
    if(installed){finishBillNavigation(outcome.createdDefault?'menu':view);focusBillContext();}
    else if(!billState().record)goto('menu');
    toast('ลบบิลแล้ว');return;
  }
  if(installed){
    finishBillNavigation(operation.kind==='startup'&&!outcome.created?requestedView():'menu');
    if(operation.kind!=='startup'){focusBillContext();if(operation.kind==='create')toast('สร้างบิลใหม่แล้ว');}
  }
}
async function dispatchBillAction(kind,target){
  if(kind!=='new'&&(!target||target.id!==activeSession()?.billId||target.id===billState().missingTarget))return;
  if(kind==='download'){downloadText(encodeBillFile(target),billFilename(target.name));return;}
  if(kind==='details'){await controls.details(target);return;}
  if(billControlContext().mutationBlocked)return;
  if(kind==='new'){
    if(!target){await startNew();return;}
    while(true){
      const current=billControlContext().record;
      if(!current||current.id!==target.id||billControlContext().mutationBlocked||billState().storageBlocked)return;
      const choice=await controls.chooseNew(current);
      if(!choice)return;
      if(billControlContext().record?.id!==current.id||billControlContext().mutationBlocked)return;
      if(choice==='save'){await startNew();return;}
      const operation={...newOperation('delete',current),createReplacement:true};
      const outcome=await billController.runLibraryOperation(operation,
        pending=>controls.confirmDelete(current,pending,{canReuse:()=>{
          const session=activeSession();
          if(session?.billId!==current.id||session.canUndo||session.canRedo||session.dirty||hasPeopleDraft())return false;
          if(!tabStorage)throw Error('ไม่สามารถตรวจสอบข้อมูลบิลได้ขณะนี้ ลองอีกครั้ง');
          return tabStorage.getItem(receiptDraftKey(current.id))===null;
        }}));
      if(outcome?.status==='reused'&&!outcome.selectedElsewhere){
        mainScroll.reset();
        finishBillNavigation('menu');
        focusBillContext();
        toast('สร้างบิลใหม่แล้ว');
      }
      if(outcome||operation.outcome)return;
    }
  }
  if(kind==='delete'){
    const operation=newOperation('delete',target);
    const outcome=await billController.runLibraryOperation(operation,current=>controls.confirmDelete(target,current));
    if(!outcome){updateBillContext();void checkExternalBill();}
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
  const staged=billState().pendingCandidate;
  const accepted=await billController.retry();
  // A People deletion settles in place; the item remains the return target.
  if(accepted&&staged&&staged.peopleEdit?.kind!=='delete'){
    let newerItem=false;
    if(session){
      // A user may keep typing after dismissing recovery. Retry saves the
      // staged attempt; retain any later or incomplete item as a live draft.
      try{const recovered=recoverableBill().items.find(item=>item.id===activeItemId);newerItem=!sameValue(recovered,staged.bill.items.find(item=>item.id===activeItemId));}
      catch{newerItem=true;}
    }
    if(session&&!newerItem){teardownItemDetail();session=null;goto(prevView);}else render();
  }
  else if(!accepted&&billState().error)toast(billState().error);
  updateBillContext();updateHistory();return accepted;
}
bindBillAction(document.getElementById('old-work'),()=>inspectEvidence(),{allowPending:true});
async function clearCurrent(kind,target){
  let capture=target;const mutationId=newId();
  const people=kind==='people';
  const title=()=>[`${people?'ลบรายชื่อคนทั้งหมด':'ลบเมนูอาหารทั้งหมด'}ในบิล `,customName(capture.name),' ใช่ไหม?'];
  const body=()=>people?`รายชื่อ ${capture.bill.people.length} คนและการเลือกคนในทุกเมนูจะถูกลบ เมนู ราคา และค่าปรับยอดยังอยู่ (ย้อนกลับได้)`:capture.bill.items.length?`เมนู ${capture.bill.items.length} รายการและข้อมูลการหารจ่ายจะถูกลบ พร้อมรีเซ็ต Service Charge, VAT และส่วนลด ชื่อบิลและรายชื่อคนยังอยู่ (ย้อนกลับได้)`:'ยังไม่มีเมนู จะรีเซ็ต Service Charge, VAT ส่วนลด และข้อมูลยอดใบเสร็จเดิม โดยเก็บชื่อบิลและรายชื่อคนไว้ (ย้อนกลับได้)';
  const result=await openSheet({title:title(),body:'<p></p>',mount:host=>{host.body.querySelector('p').textContent=body();},actions:[{label:'ยกเลิก',value:false},{label:people?'ลบรายชื่อทั้งหมด':capture.bill.items.length?'ลบเมนูทั้งหมด':'รีเซ็ตค่าปรับยอด',className:'sheet-danger',run:async host=>{
    const latest=await repository.read(capture.id);if(!latest)throw Error('ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์');
    if(latest.recordRevision!==capture.recordRevision){capture=latest;adoptRefreshed(await activeSession().load());host.setTitle(title());host.body.querySelector('p').textContent=body();throw Error('บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดแล้วกดยืนยันอีกครั้ง');}
    const candidate=(people?clearPeople:clearDishes)(capture.bill);const outcome=await activeSession().commit(candidate,{baseRevision:capture.recordRevision,kind:'clear-'+kind,mutationId});
    if(!acceptBill(outcome))throw Error(outcome.message);return true;
  }}]});if(!result)billController.releaseSheetCandidate('clear-'+kind,target.id);if(result){pruneCollapsedPeople();render();}
}
function checkExternalBill(){return billController.reconcile();}
let libraryChannel;try{libraryChannel=new BroadcastChannel('fairshare-library');libraryChannel.onmessage=()=>checkExternalBill();}catch{}
listen(window,'fairshare-storage-versionchange',()=>{void checkExternalBill();});
listen(window,'focus',checkExternalBill);
listen(window,'pageshow',checkExternalBill);
listen(window,'pagehide',event=>{controls?.close();if(event.persisted===false)disposePage();});
listen(document,'visibilitychange',()=>{if(!document.hidden)checkExternalBill();});
listen(window,'beforeunload',event=>{
  if(nameEditor?.dirty||nameEditor?.busy||actionBusy&&billState().pendingOperation||operationUncertain()||billState().pendingCandidate||billState().invalidCandidate||billState().saving||session?.dirty||hasPeopleDraft()||document.querySelector('#app .screen.active [data-unsaved]')||(view==='people'&&document.getElementById('np-inp')?.value.trim())){
    event.preventDefault();
    event.returnValue='';
  }
});
listen(document,'input',event=>{
  if(event.target.matches('#app input:not([type=radio]):not([type=checkbox]):not([type=file])'))event.target.dataset.unsaved='true';
  updateBillContext();
});
listen(document,'focusout',()=>queueMicrotask(updateBillContext));
const requestedView=()=>new URL(location.href).searchParams.get('view')==='summary'?'summary':'menu';
function mountBillControls(){
  controls?.dispose();nameEditor?.dispose();
  nameEditor=createBillNameEditor({input:document.getElementById('bill-selector-name'),feedback:document.getElementById('bill-name-feedback'),repository,getContext:billControlContext,onStateChange:(state,context)=>{nameSaving=state.busy;syncBusy();document.getElementById('main').inert=context.mainBlocked||state.busy||state.problem;document.getElementById('top-tabs').inert=context.tabsBlocked||state.problem;if(!state.busy&&!state.problem&&!nameEditor?.unsettled&&context.reconciliationQueued)queueMicrotask(checkExternalBill);},onSaved:async record=>{
    if(record.id!==billState().billId)return;
    const result=await billController.refresh({preserveWorking:true,quiet:true});
    if(result.status!=='loaded')throw Error(result.message||'เปิดข้อมูลล่าสุดไม่ได้ ลองอีกครั้ง');
  }});
  controls=createBillControls({
    repository,selector,actionsButton,getContext:billControlContext,bindAction:(node,action,options)=>bindBillAction(node,action,{...options,allowPending:true}),
    onSelect:id=>selectRecoveryBill(id),
    onAction:dispatchBillAction,onInspect:inspectEvidence,onRequestImport:requestImport,
    onDownload:({text,filename,type})=>downloadText(text,filename,type),onError:toast
  });
}
function onBillChange(event){
  const snapshot=event.snapshot;
  if(snapshot.opening&&!openingPresentation){mainScroll.leave();saveUiState(snapshot);}
  openingPresentation=snapshot.opening;
  if(snapshot.saving!==savingPresentation)setSaving(snapshot.saving);
  syncBusy();
  if(event.reason==='opened'){
    // Keep the visible record and URL identity atomic for selection consumers.
    const url=new URL(location.href);url.searchParams.set('bill',snapshot.billId);url.searchParams.delete('select');history.replaceState(history.state,'',url);
    session=null;editingPid=null;peopleReturnTo=null;peopleDraftOwner.reset();
    collapsedPeople.clear();summaryHintDismissed=false;
    try{const ui=JSON.parse(tabStorage?.getItem(uiKey())||'null');collapsedPeople=new Set(ui?.collapsed??[]);summaryHintDismissed=!!ui?.summaryHintDismissed;}catch{}
    pruneCollapsedPeople(snapshot);clearHistoryWidths();invalidateBT();
  }
  if(event.accepted){
    const completed=event.completedPeopleEdit;
    if(completed?.kind==='add'&&getPeopleDraft().add.trim()===completed.name)updatePeopleDraft({add:''});
    if(completed?.kind==='rename'&&getPeopleDraft().rename?.id===completed.id&&getPeopleDraft().rename.value.trim()===completed.name){updatePeopleDraft({rename:null});editingPid=null;}
    if(completed?.kind==='delete'&&completed.billId===snapshot.billId){
      session?.mapPeople(item=>removePersonFromItem(item,completed.id));
      renderPeopleList();
    }
    for(const input of document.querySelectorAll('#app .screen.active [data-unsaved]'))delete input.dataset.unsaved;
    invalidateBT();pruneCollapsedPeople(snapshot);updateBillTotals(snapshot);
  }
  if(event.reason==='reconciled'&&event.changed){invalidateBT();pruneCollapsedPeople(snapshot);render(snapshot);}
  if(event.reason==='operation-finished')finishLibraryEffects(event);
  if(event.message)toast(event.message);
  updateBillContext(snapshot);updateHistory(snapshot);
}
async function initialize(){
  const url=new URL(location.href),explicit=url.searchParams.get('bill'),select=url.searchParams.get('select')==='1';
  try{
    repository?.close();repository=null;billController.reportEntryProblem('loading','');render();
    repository=await openBillRepository({developmentStorage});mountBillControls();
    if(explicit!==null)await installBill(explicit,requestedView(),{reason:'startup'});
    else if(select){billController.reportEntryProblem('missing','เลือกบิลที่บันทึกไว้ หรือสร้างบิลใหม่เพื่อเริ่ม');goto('menu');}
    else{
      const operation=billState().pendingOperation?.kind==='startup'?billState().pendingOperation:newOperation('startup');
      await billController.runLibraryOperation(operation,current=>repository.ensureDefault(current));
      if(!billState().record)goto('menu');
    }
    if(select){await controls.openSelector();const current=new URL(location.href);if(selector.getAttribute('aria-expanded')==='true'){current.searchParams.delete('select');history.replaceState(history.state,'',current);}}
  }catch(error){if(!controls||!repository)mountBillControls();billController.reportEntryProblem('unavailable',error.message);goto('menu');}
}
function disposePage(){
  if(pageDisposed)return;pageDisposed=true;pageLifetime.abort();
  for(const timer of pageTimers)clearTimeout(timer);for(const frame of pageFrames)cancelAnimationFrame(frame);
  pageTimers.clear();pageFrames.clear();clearHistoryWidths();cancelAnimationFrame(resizeRAF);clearTimeout(tT);
  // Capture while the active document still has its full scrollable geometry.
  mainScroll.dispose();
  menuMount?.dispose();summaryMount?.dispose();peopleMount?.dispose();itemMount?.dispose();
  controls?.dispose();nameEditor?.dispose();headerHistory?.dispose();headerObserver.disconnect();
  recovery.dispose();editors.dispose();billController.dispose();libraryChannel?.close();repository?.close();session=null;
}
await initialize();
