import {renderInput,renderReview,renderReceiptVision,showReceiptError,updateReceiptTextControls,receiptActionFallback} from './receipt-view.mjs';
import {createReceiptOcrController} from './receipt-ocr-controller.mjs';
import {createReceiptImportController} from './receipt-import-controller.mjs';
import {createReceiptReviewModel,createManualReviewRow} from './receipt-review-model.mjs';
import {createReceiptTextHistory} from './receipt-text-history.mjs';
import {createBillSession} from './bill-session.mjs';
import {receiptDraftKey} from './bill-work-keys.mjs';
import {createEditorActions} from './editor-actions.mjs';
import {openReceiptImport} from './receipt-import-dialog.mjs';
import {createRecoveryNotice,openSheet,sheetOpen} from './in-app-confirm.mjs';
import {createReceiptReview,normalizeReviewDraft} from './receipt-draft.mjs';
import {createOcrReader,browserWorker,prepareImage} from './ocr-reader.mjs';
import {openBillRepository} from './bill-repository.mjs';
import {newId} from './bill-state.mjs';
import {trackPointerHover} from './pointer-hover.mjs';
import {createInteractionBusy} from './interaction-busy.mjs';
const receiptLifetime=new AbortController();
trackPointerHover(document,receiptLifetime.signal);
const receiptInteraction=createInteractionBusy(document.getElementById('app'),{signal:receiptLifetime.signal});
function onReceipt(type,callback){addEventListener(type,callback,{signal:receiptLifetime.signal});}
let warnedDraft=null;
let lastDraft=null,receiptCommitted=false,draftBlocked=false,draftNotice='';
const editors=createEditorActions();
let tabStorage;try{tabStorage=sessionStorage;}catch{}
const billId=new URL(location.href).searchParams.get('bill');
const draftKey=receiptDraftKey(billId);
let repository,billSession,targetError='',draftStorageFailed=false,rawDraftEvidence=null,targetMissing=false,leavingReceipt=false;
let draftReadSucceeded=false,rawCheckpointPending=false;
try{
  if(billId&&tabStorage){rawDraftEvidence=tabStorage.getItem(draftKey);draftReadSucceeded=true;}
}catch{draftStorageFailed=true;}
try{
  repository=await openBillRepository();
  if(!billId)throw Error('ไม่พบบิลนี้ เปิดบิลที่ต้องการก่อนอ่านใบเสร็จ');
  billSession=createBillSession({repository,billId,sessionStorage:tabStorage});
  const loaded=await billSession.load();
  if(loaded.status!=='loaded'){targetMissing=loaded.status==='missing';throw Error(loaded.message);}
}catch(error){targetError=error.message;}
let baseRevision=billSession?.record?.recordRevision??null,layoutCleanup=()=>{},receiptHistory=null;
function returnUrl(){
  const url=new URL('../index.html',import.meta.url);
  if(billId)url.searchParams.set('bill',billId);
  if(targetMissing||!billId){url.searchParams.delete('bill');url.searchParams.set('select','1');}
  return url.href;
}
function reviewData(){return {schema:3,billId,baseRevision,raw:state.raw,...reviewModel.getSnapshot(),page:state.page,draft:lastDraft};}
/* ═══════════════════════════════════════════════════════
   RECEIPT ICONS
═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   OCR OVERLAY CONTROLS
═══════════════════════════════════════════════════════ */
function ocrSetProgress(label, pct, note) {
  const sub  = document.getElementById('ocr-prog-sub');
  const fill = document.getElementById('ocr-prog-fill');
  const noteEl = document.getElementById('ocr-prog-note');
  if (sub)  sub.textContent = label;
  if (fill) fill.style.width = Math.min(100, Math.max(0, pct)) + '%';
  if (noteEl) {
    if (note != null) { noteEl.textContent = note; noteEl.style.display = ''; }
    else noteEl.style.display = 'none';
  }
}
const visionState = {statusMsg:'',statusKind:''};
const localReader=createOcrReader(browserWorker);
const overlay=document.getElementById('ocr-prog-ov');
let ocrPresentation=null;
const ocrController=createReceiptOcrController({reader:localReader,prepareImage,getRaw:()=>state.raw,parseText:parseCurrentText,
  present:{
    open(token){
      ocrPresentation={token,previous:document.activeElement,succeeded:false,timer:null,resume:null};
      overlay.classList.add('vis','preparing');overlay.setAttribute('aria-hidden','false');
      document.getElementById('app').inert=true;
      document.getElementById('ocr-title').focus({preventScroll:true});
    },
    progress(token,{label,percent,note,preparing}){
      if(ocrPresentation?.token!==token)return;
      overlay.classList.toggle('preparing',preparing);ocrSetProgress(label,percent,note);
    },
    async success(token){
      const presentation=ocrPresentation;if(presentation?.token!==token)return;
      presentation.succeeded=true;
      if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
        await new Promise(resolve=>{presentation.resume=resolve;presentation.timer=setTimeout(resolve,120);});
      }
    },
    error(token){
      if(ocrPresentation?.token!==token)return;
      visionState.statusMsg='อ่านรูปนี้ไม่ได้ ลองใช้รูปที่ชัดขึ้น หรือคัดลอกข้อความจากรูปมาวางแทน';
      visionState.statusKind='error';renderVisionZone();
      ocrPresentation.succeeded=false;ocrPresentation.previous=document.getElementById('visionDropArea');
    },
    close(token){
      const presentation=ocrPresentation;if(presentation?.token!==token)return;
      ocrPresentation=null;clearTimeout(presentation.timer);presentation.resume?.();
      overlay.classList.remove('vis');overlay.setAttribute('aria-hidden','true');
      document.getElementById('app').inert=false;
      document.getElementById('ocr-prog-fill').style.width='0%';
      const previous=presentation.succeeded&&state.page==='results'?document.querySelector('.top-title'):presentation.previous;
      if(previous?.isConnected){if(previous.matches('.top-title'))previous.tabIndex=-1;previous.focus();}
    }
  }});
function cancelRead(){ocrController.cancel();}
function setVisionImage(file){return ocrController.read(file);}
document.getElementById('ocr-cancel').addEventListener('click',cancelRead,{signal:receiptLifetime.signal});
overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();cancelRead();}else if(event.key==='Tab'){event.preventDefault();document.getElementById('ocr-cancel').focus();}},{signal:receiptLifetime.signal});
onReceipt('pagehide',cancelRead);

/* ── Render Vision Zone ── */
function renderVisionZone(){renderReceiptVision(visionState,{readFile:setVisionImage});}

/* ═══════════════════════════════════════════════════════
   PLACEHOLDER
═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   PARSER HELPERS
═══════════════════════════════════════════════════════ */
const uid=newId;
let parseGeneration=0,textGeneration=0;
async function parseCurrentText(raw=state.raw,isCurrent=()=>true){
  if(!raw.trim())return;
  if(draftBlocked){
    const replace=await openSheet({title:'เริ่มแยกเมนูจากข้อความนี้หรือไม่?',body:'<p>ฉบับร่างเดิมยังเปิดไม่ได้ ดาวน์โหลดฉบับร่างเดิมไว้ก่อนเริ่มใหม่</p>',actions:[{label:'ยกเลิก',value:false},{label:'ดาวน์โหลดฉบับร่างและเริ่มใหม่',run:async()=>{downloadReceiptWork();return true;}}],fallback:receiptActionFallback});
    if(!replace)return;
  }
  const token=++parseGeneration,inputGeneration=textGeneration;
  const current=()=>token===parseGeneration&&inputGeneration===textGeneration&&isCurrent();
  let result,loaded;
  const resume=!draftBlocked&&lastDraft&&raw===lastDraft.raw;
  // Submission is a text-history boundary even when a later edit cancels it.
  if(raw===state.raw)pushTextHistory(raw);
  try{result=resume?null:createReceiptReview(raw);loaded=billSession?await billSession.load({canAdopt:current}):null;}
  catch(error){
    // OCR text remains correctable even if parsing or target access fails.
    if(!current())return;
    state.raw=raw;pushTextHistory(raw);state.page='input';render();
    throw error;
  }
  if(!current())return;
  clearTimeout(textDebounceTimer);state.raw=raw;pushTextHistory(raw);
  if(loaded?.status==='loaded'){baseRevision=billSession.record.recordRevision;targetMissing=false;targetError='';}
  else if(loaded){targetMissing=loaded.status==='missing';targetError=loaded.message;}
  if(resume){state.page='results';render();void showReceiptWarnings();return;}
  lastDraft=result.draft;receiptCommitted=false;
  reviewModel.replace({...reviewModel.getSnapshot(),rows:result.rows,summarySource:result.summarySource,summaryIssues:result.summaryIssues,
    importMode:'append',importAssignments:'all',summaryEdits:result.summaryEdits,
    discountCanonical:result.summarySource?.discount?.mode==='amount'?'amount':'rate'});
  draftBlocked=false;draftNotice='';state.page='results';state.editing=null;render();void showReceiptWarnings();
}
const reviewModel = createReceiptReviewModel();
const textHistory = createReceiptTextHistory('');
const state = {page:'input',raw:'',editing:null};
// Presentation reads copies from the model; there are no writable review arrays here.
for (const key of ['rows','summarySource','summaryIssues','summaryEdits','discountCanonical','colOrder','importMode','importAssignments']) {
  Object.defineProperty(state,key,{get:()=>reviewModel.getSnapshot()[key]});
}
let textDebounceTimer = null;

function pushTextHistory(text){textHistory.record(text);}
function checkpointTextAction(raw){if(raw!==state.raw){state.raw=raw;rawCheckpointPending=true;}syncTextDOM();flushRawCheckpoint();}
function textUndo(){textGeneration++;clearTimeout(textDebounceTimer);checkpointTextAction(textHistory.undo(state.raw));}
function textRedo(){textGeneration++;clearTimeout(textDebounceTimer);checkpointTextAction(textHistory.redo(state.raw));}
function clearTextArea(){textGeneration++;clearTimeout(textDebounceTimer);if(state.raw==='')return;textHistory.record(state.raw);textHistory.record('');checkpointTextAction('');}
function syncTextDOM(){const ta=document.getElementById("receiptText");if(ta)ta.value=state.raw;updateReceiptTextControls(state.raw);updateTextUndoRedoBtns();}
function updateTextUndoRedoBtns(){receiptHistory?.update({canUndo:textHistory.canUndo(state.raw),canRedo:textHistory.canRedo});}
function undo(){if(!reviewModel.canUndo)return;reviewModel.undo();state.editing=null;render();}
function redo(){if(!reviewModel.canRedo)return;reviewModel.redo();state.editing=null;render();}
function addRow(){
  const row=createManualReviewRow(uid());
  reviewModel.addRow(row);state.editing={rowId:row.id,field:'itemName'};render();
  const input=document.querySelector(`[data-edit-input="${CSS.escape(row.id)}:itemName"]`);
  if(input){input.focus({preventScroll:true});input.select();requestAnimationFrame(()=>{if(input.isConnected)input.scrollIntoView({block:'center',behavior:'auto'});});}
}
function deleteRow(id){reviewModel.deleteRow(id);render();}
function handleSwap(){reviewModel.swapPrices(null);render();}
function swapRow(id){reviewModel.swapPrices(id);render();}
function startEdit(rowId,field){state.editing={rowId,field};render();const el=document.querySelector(`[data-edit-input="${CSS.escape(rowId)}:${field}"]`);if(!el)return;el.focus();if(field!=="itemName"&&typeof el.select==="function")el.select();}
function commitEdit(rowId,field,value){state.editing=null;reviewModel.editRow(rowId,field,value);render();}
function persistDraft(){if(draftBlocked||!draftReadSucceeded||!billId||targetError){if(!draftReadSucceeded)draftStorageFailed=true;return false;}if(!Number.isSafeInteger(baseRevision)){draftStorageFailed=true;return false;}try{if(!tabStorage)throw Error();const candidate=reviewData();normalizeReviewDraft(candidate);const raw=JSON.stringify(candidate);tabStorage.setItem(draftKey,raw);if(tabStorage.getItem(draftKey)!==raw)throw Error();draftStorageFailed=false;rawCheckpointPending=false;rawDraftEvidence=raw;return true;}catch{draftStorageFailed=true;return false;}}
function flushRawCheckpoint(){
  if(!rawCheckpointPending)return true;
  // A new input checkpoint must not overwrite bytes the initial read could not inspect.
  let saved=false;
  if(draftReadSucceeded)saved=persistDraft();else draftStorageFailed=true;
  showStorageNotice();
  return saved;
}
function downloadReceiptData(raw,filename,type){
  const url=URL.createObjectURL(new Blob([raw],{type})),a=document.createElement('a');
  a.href=url;
  a.download=filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadReceiptText(){
  downloadReceiptData(state.raw,'หารจ่ายแฟร์ๆ-receipt-text.txt','text/plain;charset=utf-8');
}
let restoredText='';
function downloadReceiptWork(){
  let raw=JSON.stringify(reviewData());
  if((draftBlocked||draftStorageFailed)&&rawDraftEvidence!==null){
    raw=draftBlocked&&state.raw===restoredText?rawDraftEvidence:JSON.stringify({source:rawDraftEvidence,current:reviewData(),receiptText:state.raw});
  }
  downloadReceiptData(raw,'หารจ่ายแฟร์ๆ-receipt-draft-evidence.json','application/json');
}
function hasReceiptWork(){return rawCheckpointPending||!!state.raw||rawDraftEvidence!==null;}
async function returnToBill(destination=returnUrl()){
  if(!persistDraft()&&hasReceiptWork()){
    const result=await openSheet({title:'ไม่สามารถบันทึกฉบับร่างได้ขณะนี้',body:'<p>ดาวน์โหลดฉบับร่างก่อนกลับไปยังบิล หรืออยู่หน้านี้เพื่อแก้ต่อ</p>',actions:[
      {label:'แก้ต่อ',value:false},
      {label:'ดาวน์โหลดฉบับร่างและกลับ',run:async()=>{downloadReceiptWork();return true;}}
    ]});
    if(!result)return;
  }
  leavingReceipt=true;
  location.href=destination;
}
// The status can update during IME input, but a new sheet must wait to move focus.
const recovery=createRecoveryNotice({getModel:async()=>editors.composing?null:({
  title:targetMissing?'ไม่สามารถเปิดบิลได้':'ไม่สามารถบันทึกบิลได้ขณะนี้',
  message:targetMissing?'ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์'+(state.raw?' ข้อความใบเสร็จยังอยู่ในหน้านี้':''):hasReceiptWork()?'ดาวน์โหลดข้อความใบเสร็จก่อนปิดหน้านี้':'ไม่สามารถเข้าถึงข้อมูลบิลได้ขณะนี้',
  dismissLabel:'แก้ต่อ',
  actions:[
    ...(!targetMissing&&repository?.connectionError!=='VersionError'?[{label:'ลองบันทึกอีกครั้ง',run:async()=>{await checkTarget();persistDraft();showStorageNotice();}}]:[]),
    {label:'ดาวน์โหลดข้อความ',run:downloadReceiptText},
    ...(state.page==='results'||draftBlocked?[{label:'ดาวน์โหลดฉบับร่าง',run:downloadReceiptWork}]:[])
  ]
}),fallback:receiptActionFallback});
function showStorageNotice(){
  recovery.update(targetError||draftStorageFailed||draftNotice?`${billId}:${targetError}:${draftNotice}:${draftStorageFailed}`:'','ยังไม่ได้บันทึก');
}
function startNewReceipt(){
  textGeneration++;parseGeneration++;
  receiptCommitted=false;lastDraft=null;rawDraftEvidence=null;
  reviewModel.replace({...reviewModel.getSnapshot(),rows:[],summarySource:null,summaryIssues:{},summaryEdits:{service_charge_rate:null,vat_rate:null,discount_rate:null,discount_amount:null},discountCanonical:'rate'});
  textHistory.reset('');Object.assign(state,{raw:'',page:'input',editing:null});
  visionState.statusMsg='';visionState.statusKind='';render();
}
async function offerImportedReceipt(){
  if(!receiptCommitted||targetError||draftBlocked)return;
  const result=await openSheet({title:'เพิ่มใบเสร็จนี้ลงบิลแล้ว',className:'receipt-revisit',
    body:'<p>อัพโหลดใบเสร็จใหม่ ดูรายละเอียดใบเสร็จเดิม หรือกลับไปหน้าเมนู</p>',
    actions:[{id:'new-receipt',label:'อัพโหลดใบเสร็จใหม่',className:'sheet-primary',value:'new'},{label:'ดูรายละเอียดเดิม',value:'inspect'},{label:'กลับไปหน้าเมนู',value:'menu'}],
    fallback:receiptActionFallback});
  if(result==='menu')await returnToBill();
  else if(result==='new')startNewReceipt();
  else if(lastDraft){state.page='results';render();receiptActionFallback()?.focus({preventScroll:true});}
}

async function showReceiptWarnings(){
  if(state.page!=='results'||!lastDraft||warnedDraft===lastDraft.id||targetError||draftBlocked||draftStorageFailed||draftNotice||sheetOpen())return;
  const notes=[...(lastDraft.notices??[]),...state.rows.flatMap(row=>(row.flags??[]).filter(flag=>flag.type==='calc_mismatch').map(flag=>row.itemName+': '+flag.msg))];
  warnedDraft=lastDraft.id;
  if(!notes.length)return;
  await openSheet({title:'หมายเหตุ',className:'receipt-warnings',
    actions:[{label:'ตกลง',className:'sheet-primary',value:true}],
    fallback:receiptActionFallback,
    mount:host=>{for(const note of notes){const p=document.createElement('p');p.textContent=note;host.body.append(p);}}
  });
}

async function confirmUnresolved(issues){
  const choice=await openSheet({title:'ยังมีรายการที่ต้องตรวจสอบ',className:'receipt-unresolved',
    body:'<p>โปรดตรวจสอบและแก้ไขรายการที่มีเครื่องหมาย <span class="badge badge-r">?</span> ก่อนเพิ่มเมนูลงบิล</p><p>หากเลือกทำต่อ ระบบจะใช้จำนวนและราคาที่แสดงในตาราง หากไม่ทราบจำนวน จะนับเป็น 1 หากไม่ทราบราคา จะคิดเป็น 0 บาท ส่วนค่าปรับยอดที่ยังไม่ได้ยืนยันจะไม่นำมาคำนวณ</p>',
    actions:[{label:'แก้ไข',className:'sheet-primary',value:'edit'},{label:'ทำต่อ',value:'continue'}],
    fallback:receiptActionFallback});
  if(choice==='edit'){
    const first=issues[0];
    const field=first.rowId
      ?`[data-edit-cell="${CSS.escape(first.rowId)}:${first.editField}"],[data-edit-input="${CSS.escape(first.rowId)}:${first.editField}"]`
      :`[data-summary-input="${first.kind}:${first.field}"]`;
    document.querySelector(field)?.focus();
  }
  return choice==='continue';
}

function render(){
  clearTimeout(textDebounceTimer);textDebounceTimer=null;
  layoutCleanup();receiptHistory=null;persistDraft();
  const model={...reviewModel.getSnapshot(),raw:state.raw,page:state.page,editing:structuredClone(state.editing),
    draft:lastDraft,draftNotice,vision:{...visionState},history:state.page==='input'
      ?{canUndo:textHistory.canUndo(state.raw),canRedo:textHistory.canRedo}
      :{canUndo:reviewModel.canUndo,canRedo:reviewModel.canRedo}};
  layoutCleanup=(state.page==='input'?renderInput:renderReview)(model,receiptActions);
  showStorageNotice();
}
function showImportError(message){
  if(targetError||sheetOpen())return;
  void openSheet({title:'หมายเหตุ',actions:[{label:'ตกลง',className:'sheet-primary',value:true}],fallback:receiptActionFallback,
    mount:host=>{const p=document.createElement('p');p.textContent=message;host.body.append(p);}});
}
const importController=createReceiptImportController({
  getSession:()=>billSession,getReview:reviewData,
  getStatus:()=>({composing:editors.composing,targetError,draftBlocked}),
  setBaseRevision:value=>{baseRevision=value;},
  setOptions:options=>reviewModel.setImportOptions(options),persistDraft,
  confirmUnresolved,
  confirmRepeat:()=>openSheet({title:'เพิ่มใบเสร็จเดิมอีกครั้งหรือไม่?',body:'<p>เคยเพิ่มใบเสร็จนี้ลงบิลไปแล้ว หากเพิ่มต่อจะซ้ำเมนูเดิม</p>',
    actions:[{label:'ยกเลิก',value:false},{label:'เพิ่มอีกครั้ง',className:'sheet-primary',value:true}],fallback:receiptActionFallback}),
  chooseImport:openReceiptImport,
  onCommitted:draft=>{lastDraft=draft;receiptCommitted=true;},
  onError:(error,context={})=>{
    if(context.targetStatus){targetMissing=context.targetStatus==='missing';targetError=error.message;}
    if(context.inline!==false)showImportError(error.message);
  },returnToBill
});
async function submitReceipt(){
  if(importController.busy||editors.composing||document.getElementById('submitBtn')?.disabled)return;
  document.activeElement?.blur();
  const pending=importController.submit();
  // The dialog owns progress and its own actions. Its background also rejects
  // programmatic activation; native modal inertness alone only covers user input.
  receiptInteraction.setBusy(importController.busy);
  try{await pending;}finally{receiptInteraction.setBusy(false);showStorageNotice();}
}
const receiptActions={
  bindAction:(element,action)=>editors.bind(element,action),historyMounted:control=>{receiptHistory=control;},
  undo:()=>state.page==='input'?textUndo():undo(),redo:()=>state.page==='input'?textRedo():redo(),
  readFile:setVisionImage,clearText:clearTextArea,returnToBill,submit:submitReceipt,
  rawChanged(raw){textGeneration++;if(raw!==state.raw){state.raw=raw;rawCheckpointPending=true;}clearTimeout(textDebounceTimer);updateTextUndoRedoBtns();textDebounceTimer=setTimeout(()=>{textDebounceTimer=null;pushTextHistory(state.raw);updateTextUndoRedoBtns();flushRawCheckpoint();},500);},
  async parse(){try{await parseCurrentText();}catch(error){console.error('Parse failed:',error);visionState.statusMsg='แยกเมนูยังไม่ได้ ลองเช็กข้อความแล้วกดอีกครั้ง';visionState.statusKind='error';renderVisionZone();}},
  backToInput(){parseGeneration++;state.page='input';state.editing=null;render();},
  cancelEdit(){const previous=state.editing;state.editing=null;render();if(previous)document.querySelector(`[data-edit-cell="${CSS.escape(previous.rowId)}:${previous.field}"]`)?.focus();},
  startEdit,commitRow:commitEdit,addRow,deleteRow,swapAll:handleSwap,swapRow,
  editSummary(kind,field,value){reviewModel.editSummary(kind,field,value);render();}
};
let savedCache=null;
try{
  const saved=savedCache=rawDraftEvidence===null?null:JSON.parse(rawDraftEvidence);
  if(saved){
    const {review,notices}=normalizeReviewDraft(saved);
    if(review.billId!==billId)throw Error('ฉบับร่างนี้เป็นของบิลอื่น');
    reviewModel.replace(review);state.raw=review.raw;state.page=review.page;
    lastDraft=review.draft;
    draftNotice=notices.join(' ');
    baseRevision=review.baseRevision;
    textHistory.reset(state.raw);
    if(lastDraft&&billSession?.current?.imports.includes(lastDraft.id))receiptCommitted=true;
  }else if(rawDraftEvidence!==null)throw Error('เปิดฉบับร่างเดิมไม่ได้');
}catch(error){
  if(typeof savedCache?.raw==='string')state.raw=savedCache.raw;
  restoredText=state.raw;
  draftBlocked=true;
  draftNotice=error.message;
  visionState.statusMsg=error.message;
  visionState.statusKind='error';
}
render();
void offerImportedReceipt().then(showReceiptWarnings);
onReceipt('pagehide',persistDraft);
onReceipt('beforeunload',event=>{if(leavingReceipt)return;flushRawCheckpoint();if(importController.busy||rawCheckpointPending||draftStorageFailed||(targetError&&hasReceiptWork())||draftBlocked&&hasReceiptWork()){event.preventDefault();event.returnValue='';}});
onReceipt('compositionend',()=>{if(!editors.composing)showStorageNotice();});
async function checkTarget(){
  if(importController.busy)return;
  if(!draftReadSucceeded&&tabStorage){
    try{
      const recovered=tabStorage.getItem(draftKey);draftReadSucceeded=true;rawDraftEvidence=recovered;
      if(recovered!==null){draftBlocked=true;draftNotice='พบฉบับร่างเดิม ดาวน์โหลดฉบับร่างไว้ก่อนเริ่มแยกเมนูใหม่';}
    }catch{draftStorageFailed=true;}
  }
  if(!repository){try{repository=await openBillRepository();if(billId)billSession=createBillSession({repository,billId,sessionStorage:tabStorage});}catch(error){targetError=error.message;showStorageNotice();return;}}
  if(!billSession)return;
  // Confirming an import checks the revision before writing. Passive target
  // checks only report availability, including when returning to a new receipt.
  try{const latest=await repository.read(billId);targetMissing=!latest;targetError=latest?'':'ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์';if(targetMissing)showImportError(targetError);showStorageNotice();}
  catch(error){targetError=error.message;showImportError(targetError);showStorageNotice();}
}
onReceipt('pageshow',checkTarget);
onReceipt('fairshare-storage-versionchange',()=>{void checkTarget();});
onReceipt('focus',checkTarget);
let receiptChannel;
try{
  receiptChannel=new BroadcastChannel('fairshare-library');
  receiptChannel.onmessage=event=>{if(event.data?.id===billId)void checkTarget();};
}catch{}

onReceipt('pagehide',event=>{
  parseGeneration++;
  clearTimeout(textDebounceTimer);pushTextHistory(state.raw);
  if(event.persisted!==false)return;
  receiptLifetime.abort();ocrController.dispose();layoutCleanup();recovery.dispose();editors.dispose();receiptChannel?.close();repository?.close();
});
