import {esc as escapeHtml} from './bill-display.mjs';
import {formatMoney,formatMoneyDisplay,formatPctForDisplay,renderChargeCard,renderDiscountCard,flattenHtmlTable} from './receipt-display.mjs';
import {createBillSession} from './bill-session.mjs';
import {createEditorActions} from './editor-actions.mjs';
import {mountHistoryControls} from './history-controls.mjs';
import {openReceiptImport} from './receipt-import-dialog.mjs';
import {openSheet} from './in-app-confirm.mjs';
import {mountReceiptLayout,updateReceiptPlaceholder,RECEIPT_PLACEHOLDER} from './receipt-layout.mjs';
import {getDerivedValues,initializeSummaryEdits} from './receipt-parser.mjs';
import {createReceiptReview,receiptSummary,normalizeReviewDraft,buildReviewedDraft,copyReceiptForImport} from './receipt-draft.mjs';
import {createOcrReader,browserWorker,prepareImage} from './ocr-reader.mjs';
import {openBillRepository} from './bill-repository.mjs';
import {importToApproved} from './approved-ui-bridge.mjs';
import {newId} from './bill-state.mjs';
let lastDraft=null,receiptCommitted=false,draftBlocked=false,draftNotice='';
const editors=createEditorActions();
let tabStorage;try{tabStorage=sessionStorage;}catch{}
const billId=new URL(location.href).searchParams.get('bill');
const draftKey='fairshare.approved-parser.v3:'+billId;
let repository,billSession,targetError='',draftStorageFailed=false,rawDraftEvidence=null,oldDraftEvidence=null,targetMissing=false,leavingReceipt=false;
try{
  if(billId)rawDraftEvidence=tabStorage?.getItem(draftKey)??null;
  oldDraftEvidence=tabStorage?.getItem('fairshare.approved-parser')??null;
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
  if(targetMissing||!billId)url.searchParams.set('select','1');
  return url.href;
}
function reviewData(){return {schema:3,billId,baseRevision,raw:state.raw,rows:state.rows,summarySource:state.summarySource,summaryEdits:state.summaryEdits,discountCanonical:state.discountCanonical,colOrder:state.colOrder,importMode:state.importMode,importAssignments:state.importAssignments,page:state.page,draft:lastDraft};}
function mountReceiptHistory(){const host=document.getElementById('receipt-history');receiptHistory=mountHistoryControls(host,{scope:state.page==='input'?'ข้อความใบเสร็จ':'รายละเอียดใบเสร็จ',onUndo:state.page==='input'?textUndo:undo,onRedo:state.page==='input'?textRedo:redo,editors});if(state.page==='input')updateTextUndoRedoBtns();else receiptHistory.update({canUndo:!!state.undoStack.length,canRedo:!!state.redoStack.length});}


/* ═══════════════════════════════════════════════════════
   RECEIPT ICONS
═══════════════════════════════════════════════════════ */
const RECEIPT_ICON = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 2 1.5V2"/><line x1="9" y1="8" x2="17" y2="8"/><line x1="9" y1="12" x2="17" y2="12"/><line x1="9" y1="16" x2="14" y2="16"/></svg>`;
const BIN_ICON   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
const BACK_CHEVRON = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>`;
const SWAP_ICON_ALL = `<svg width="13" height="10" viewBox="0 0 13 10" fill="none"><line x1="1.5" y1="5" x2="11.5" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><polyline points="4,2 1.5,5 4,8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polyline points="9,2 11.5,5 9,8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
const SWAP_ICON_ROW = `<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><line x1="1.5" y1="4.5" x2="9.5" y2="4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><polyline points="3.5,2 1.5,4.5 3.5,7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polyline points="7.5,2 9.5,4.5 7.5,7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

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
let localReadToken=0,activeRead=null;
const localReader=createOcrReader(browserWorker);
function closeRead(op){
  if(activeRead!==op)return;
  activeRead=null;
  const overlay=document.getElementById('ocr-prog-ov');
  overlay.classList.remove('vis');overlay.setAttribute('aria-hidden','true');
  document.getElementById('app').inert=false;
  document.getElementById('ocr-prog-fill').style.width='0%';
  if(op.previous?.isConnected)op.previous.focus();
}
function cancelRead(){
  if(!activeRead)return;
  const op=activeRead;localReadToken++;localReader.cancel().catch(()=>{});closeRead(op);
}
const overlay=document.getElementById('ocr-prog-ov');
document.getElementById('ocr-cancel').addEventListener('click',cancelRead);
overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();cancelRead();}else if(e.key==='Tab'){e.preventDefault();document.getElementById('ocr-cancel').focus();}});
async function setVisionImage(file){
  cancelRead();
  const token=++localReadToken,startingRaw=state.raw;
  const op={token,previous:document.activeElement,progress:0};activeRead=op;
  overlay.classList.add('vis','preparing');overlay.setAttribute('aria-hidden','false');
  ocrSetProgress('กำลังเตรียมอ่านรูป…',0,null);
  document.getElementById('app').inert=true;document.getElementById('ocr-title').focus({preventScroll:true});
  try{
    const canvas=await prepareImage(file);if(token!==localReadToken)return;
    const result=await localReader.read(canvas,event=>{
      if(token!==localReadToken)return;
      if(event.status==='recognizing text'&&Number.isFinite(event.progress)){
        overlay.classList.remove('preparing');op.progress=Math.max(op.progress,Math.min(95,Math.max(0,event.progress*95)));
        ocrSetProgress(event.progress>=1?'กำลังจัดเตรียมข้อความ…':'กำลังอ่านข้อความ…',op.progress,null);
      }
    });
    if(token!==localReadToken)return;
    if(state.raw!==startingRaw)throw Error('เก็บข้อความที่คุณวางไว้ให้แล้ว ลองเลือกรูปอีกครั้ง');
    overlay.classList.remove('preparing');ocrSetProgress('อ่านรูปแล้ว',100,null);
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)await new Promise(resolve=>setTimeout(resolve,120));
    if(token!==localReadToken)return;
    await parseCurrentText(result,()=>token===localReadToken);
    op.previous=document.querySelector('.top-title');
    if(op.previous)op.previous.tabIndex=-1;
  }catch(error){if(token===localReadToken){visionState.statusMsg='อ่านรูปนี้ไม่ได้ ลองใช้รูปที่ชัดขึ้น หรือคัดลอกข้อความจากรูปมาวางแทน';visionState.statusKind='error';renderVisionZone();op.previous=document.getElementById('visionDropArea');}}
  finally{closeRead(op);}
}
addEventListener('pagehide',cancelRead);

/* ── Render Vision Zone ── */
function renderVisionZone() {
  const zone = document.getElementById("visionZone");
  if (!zone) return;
  zone.innerHTML = `
    <button type="button" class="vision-upload-area" id="visionDropArea">
      <div class="vision-empty">
        <div class="vision-empty-icon">${RECEIPT_ICON}</div>
        <div class="vision-empty-cta">อัพโหลดรูปใบเสร็จ</div>
        ${visionState.statusMsg
          ? `<div class="vision-status-msg ${visionState.statusKind}">${escapeHtml(visionState.statusMsg)}</div>`
          : `<div class="vision-empty-sub">รองรับ JPG, PNG, WebP หรือลากไฟล์มาวาง</div>`}
        <div class="vision-login-notice">อ่านรูปในเครื่องคุณ เช็กชื่อเมนูกับราคาก่อนเพิ่มลงบิล</div>
      </div>
    </button>`;

  const dropArea = document.getElementById("visionDropArea");

  if (dropArea) {
    dropArea.addEventListener("dragover", e => { e.preventDefault(); dropArea.classList.add("drag-over"); });
    dropArea.addEventListener("dragleave", () => dropArea.classList.remove("drag-over"));
    dropArea.addEventListener("drop", e => {
      e.preventDefault(); dropArea.classList.remove("drag-over");
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith("image/")) setVisionImage(file);
    });
    dropArea.addEventListener("click", () => document.getElementById("imageFilePicker").click());
  }
}

/* ═══════════════════════════════════════════════════════
   PLACEHOLDER
═══════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════
   PARSER HELPERS
═══════════════════════════════════════════════════════ */
const r2=v=>Math.round(v*100)/100;
const uid=newId;
async function parseCurrentText(raw=state.raw,isCurrent=()=>true){
  let result,loaded;
  const resume=!draftBlocked&&lastDraft&&raw===lastDraft.raw;
  try{result=resume?null:createReceiptReview(raw);loaded=billSession?await billSession.load():null;}
  catch(error){
    // OCR text remains correctable even if parsing or target access fails.
    if(isCurrent()){state.raw=raw;pushTextHistory(raw);state.page='input';render();}
    throw error;
  }
  if(!isCurrent())return;
  clearTimeout(textDebounceTimer);state.raw=raw;pushTextHistory(raw);
  if(loaded?.status==='loaded'){baseRevision=billSession.record.recordRevision;targetMissing=false;targetError='';}
  else if(loaded){targetMissing=loaded.status==='missing';targetError=loaded.message;}
  if(resume){state.page='results';render();return;}
  lastDraft=result.draft;receiptCommitted=false;
  state.rows=result.rows;state.summarySource=result.summarySource;
  Object.assign(state,{importMode:'append',importAssignments:'all'});draftBlocked=false;draftNotice='';
  const subtotal=r2(state.rows.reduce((sum,row)=>sum+getDerivedValues(row).lineTotal,0));
  state.summaryEdits=initializeSummaryEdits(subtotal,state.summarySource);
  state.discountCanonical=result.summarySource?.discount?.mode==='amount'?'amount':'rate';
  state.undoStack=[];state.redoStack=[];state.page='results';state.editing=null;render();
}
function resolveSummaryState(subtotal,source,edits,mode){return receiptSummary(subtotal,source,edits,mode);}
const app = document.getElementById("app");
const state = {
  importMode:"append",importAssignments:"all",
  page:"input",rows:[],raw:"",colOrder:["unit_price","line_total"],
  editing:null,summarySource:null,
  summaryEdits:{service_charge_rate:null,vat_rate:null,discount_rate:null,discount_amount:null},
  discountCanonical:"rate",undoStack:[],redoStack:[],
  textHistory:[""],textHistoryPos:0,
};
let textDebounceTimer = null;
let _summaryCardFocusing = false;

function pushTextHistory(text){if(state.textHistory[state.textHistoryPos]===text)return;state.textHistory=state.textHistory.slice(0,state.textHistoryPos+1);state.textHistory.push(text);if(state.textHistory.length>20)state.textHistory.shift();state.textHistoryPos=state.textHistory.length-1;}
function textUndo(){clearTimeout(textDebounceTimer);pushTextHistory(state.raw);if(state.textHistoryPos<=0)return;state.textHistoryPos--;state.raw=state.textHistory[state.textHistoryPos];syncTextDOM();}
function textRedo(){clearTimeout(textDebounceTimer);pushTextHistory(state.raw);if(state.textHistoryPos>=state.textHistory.length-1)return;state.textHistoryPos++;state.raw=state.textHistory[state.textHistoryPos];syncTextDOM();}
function clearTextArea(){clearTimeout(textDebounceTimer);if(state.raw==="")return;if(state.raw!==state.textHistory[state.textHistoryPos])pushTextHistory(state.raw);state.raw="";pushTextHistory("");syncTextDOM();}
function syncTextDOM(){const ta=document.getElementById("receiptText");if(ta)ta.value=state.raw;const clearBtn=document.getElementById("clearTaBtn");if(clearBtn)clearBtn.disabled=!state.raw;updateTextUndoRedoBtns();}
function updateTextUndoRedoBtns(){receiptHistory?.update({canUndo:state.textHistoryPos>0||state.raw!==state.textHistory[state.textHistoryPos],canRedo:state.textHistoryPos<state.textHistory.length-1});}
function snapshot(){return structuredClone({rows:state.rows,summarySource:state.summarySource,summaryEdits:state.summaryEdits,discountCanonical:state.discountCanonical,colOrder:state.colOrder,importMode:state.importMode,importAssignments:state.importAssignments});}
function pushUndo(before=snapshot()){state.undoStack.push(before);if(state.undoStack.length>20)state.undoStack.shift();state.redoStack=[];}
function undo(){if(!state.undoStack.length)return;state.redoStack.push(snapshot());const s=state.undoStack.pop();Object.assign(state,s);state.editing=null;render();}
function redo(){if(!state.redoStack.length)return;state.undoStack.push(snapshot());const s=state.redoStack.pop();Object.assign(state,s);state.editing=null;render();}
function updateRow(id,patch){const row=state.rows.find(r=>r.id===id);if(row&&Object.keys(patch).every(k=>row[k]===patch[k])){render();return;}pushUndo();state.rows=state.rows.map(r=>r.id===id?{...r,...patch}:r);render();}
function addRow(){
  pushUndo();
  const row={id:uid(),rawLine:'',itemName:'เมนูใหม่',qty:1,priceSource:'line_total',priceValue:0,needsReview:false,isDiscount:false,flags:[]};
  state.rows.push(row);state.editing={rowId:row.id,field:'itemName'};render();
  const input=document.querySelector(`[data-edit-input="${row.id}:itemName"]`);
  if(input){input.focus({preventScroll:true});input.select();requestAnimationFrame(()=>{if(input.isConnected)input.scrollIntoView({block:'center',behavior:'auto'});});}
}
function deleteRow(id){pushUndo();state.rows=state.rows.filter(r=>r.id!==id);render();}
function handleSwap(){pushUndo();state.rows=state.rows.map(r=>({...r,priceSource:r.priceSource==="line_total"?"unit_price":"line_total"}));render();}
function swapRow(id){pushUndo();state.rows=state.rows.map(r=>r.id===id?{...r,priceSource:r.priceSource==="line_total"?"unit_price":"line_total"}:r);render();}
function startEdit(rowId,field){state.editing={rowId,field};render();const el=document.querySelector(`[data-edit-input="${rowId}:${field}"]`);if(!el)return;el.focus();if(field!=="itemName"&&typeof el.select==="function")el.select();}
function commitEdit(rowId,field,value){const row=state.rows.find(r=>r.id===rowId);if(!row){state.editing=null;render();return;}state.editing=null;if(field==="itemName"){const trimmed=String(value).trim();updateRow(rowId,{itemName:trimmed||"เมนูใหม่",needsReview:false});return;}if(field==="qty"){const n=Math.min(99,Math.max(1,Math.round(parseFloat(String(value).replace(/,/g,""))||1)));updateRow(rowId,{qty:n,qtyWasNull:false,needsReview:false});return;}if(field==="unit_price"||field==="line_total"){const n=parseFloat(String(value).replace(/,/g,""))||0;const safeN=Math.max(0,n);updateRow(rowId,{priceValue:safeN,priceSource:field,needsReview:false});return;}}
function _applySummaryState(kind,field,value){const currentSubtotal=r2(state.rows.filter(r=>!r.isDiscount).reduce((s,r)=>s+getDerivedValues(r).lineTotal,0));const currentSummary=resolveSummaryState(currentSubtotal,state.summarySource,state.summaryEdits,state.discountCanonical);const num=parseFloat(String(value).replace(/,/g,"").replace(/-/g,""));const v=Number.isFinite(num)?Math.abs(num):0;if(kind==="service_charge"){state.summarySource={...state.summarySource,service_charge:{...state.summarySource?.service_charge,mode:field==="rate"?"percent":"amount",value:v}};if(field==="rate"){state.summaryEdits={...state.summaryEdits,service_charge_rate:v};}else{state.summaryEdits={...state.summaryEdits,service_charge_rate:currentSubtotal>0?(v/currentSubtotal)*100:0};}return;}if(kind==="vat"){state.summarySource={...state.summarySource,vat:{...state.summarySource?.vat,mode:field==="rate"?"percent":"amount",value:v}};if(field==="rate"){state.summaryEdits={...state.summaryEdits,vat_rate:v};}else{const scAmount=currentSummary.service_charge.amount;const base=r2(currentSubtotal+scAmount);state.summaryEdits={...state.summaryEdits,vat_rate:base>0?(v/base)*100:0};}return;}if(kind==="discount"){if(field==="rate"){state.discountCanonical="rate";state.summaryEdits={...state.summaryEdits,discount_rate:v,discount_amount:null};}else{state.discountCanonical="amount";state.summaryEdits={...state.summaryEdits,discount_amount:v,discount_rate:null};}}}
function commitSummaryEdit(kind,field,value){const before=snapshot();_applySummaryState(kind,field,value);if(JSON.stringify(before)!==JSON.stringify(snapshot()))pushUndo(before);render();}

function updateStickyOffsets(){const topBar=document.querySelector('.top-bar');const subBar=document.getElementById('subBar');const submitInner=document.querySelector('.submit-wrap-inner');if(!topBar)return;const topH=topBar.getBoundingClientRect().height;const subVisible=subBar&&window.getComputedStyle(subBar).display!=='none';const subH=subVisible?subBar.getBoundingClientRect().height:0;const submitH=submitInner?submitInner.getBoundingClientRect().height:60;document.documentElement.style.setProperty('--sticky-top-2',topH+'px');document.documentElement.style.setProperty('--sticky-top-3',(topH+subH)+'px');document.documentElement.style.setProperty('--submit-reserve',(submitH+24)+'px');}
function updateSwapButtonAlignment(){const p2Th=document.getElementById('swapColsBtn')?.closest('th');if(!p2Th)return;const p1Th=p2Th.previousElementSibling;if(!p1Th)return;const p1Label=p1Th.querySelector('.th-label');const p2Label=p2Th.querySelector('.th-label');if(!p1Label||!p2Label)return;const pointA=p1Label.getBoundingClientRect().right;const pointB=p2Label.getBoundingClientRect().left;const midX=(pointA+pointB)/2;const p2ThRect=p2Th.getBoundingClientRect();const leftInP2=midX-p2ThRect.left;const numWidth=Math.max(20,p2ThRect.width-leftInP2-11-7);document.documentElement.style.setProperty('--swap-btn-left',`${leftInP2}px`);document.documentElement.style.setProperty('--p2-num-width',`${numWidth}px`);}
function fitP2Numbers(){const numWidth=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--p2-num-width'))||0;if(numWidth<=0)return;document.querySelectorAll('[data-p2-num]').forEach(span=>{span.style.fontSize='';let fs=parseFloat(window.getComputedStyle(span).fontSize)||12;while(span.scrollWidth>numWidth&&fs>8){fs=Math.max(8,fs-0.5);span.style.fontSize=`${fs}px`;}});}
function renderPriceCell(row,colLabel){const{unitPrice,lineTotal}=getDerivedValues(row);const isCanonical=colLabel===row.priceSource;const editing=state.editing&&state.editing.rowId===row.id&&state.editing.field===colLabel;const value=colLabel==="unit_price"?unitPrice:lineTotal;const displayRO=formatMoneyDisplay(value);const displayEdit=formatMoney(value);const isRightCol=state.colOrder[1]===colLabel;const swapOverlay=isRightCol&&!row.isDiscount?`<button class="swap-row-btn" data-swap-row="${row.id}" title="สลับราคาแถวนี้" style="position:absolute;left:var(--swap-btn-left,0px);top:50%;transform:translate(-50%,-50%);z-index:1;">${SWAP_ICON_ROW}</button>`:"";const posStyle=isRightCol?"position:relative;overflow:visible;padding-right:var(--tbl-right-pad,3px);":"";const numContent=isRightCol?`<span data-p2-num class="p2-num">${displayRO}</span>`:displayRO;if(editing){return`<td class="td-canonical" style="position:relative;overflow:visible;"><input class="ci price" data-edit-input="${row.id}:${colLabel}" value="${displayEdit}" inputmode="decimal" enterkeyhint="done" autocomplete="off" spellcheck="false" /></td>`;}if(isCanonical){return`<td class="td-canonical" data-edit-cell="${row.id}:${colLabel}" style="text-align:right;color:${row.isDiscount?"var(--red)":"var(--gold2)"};font-weight:600;${posStyle}">${swapOverlay}${numContent}</td>`;}return`<td class="td-derived" data-edit-cell="${row.id}:${colLabel}" style="text-align:right;${posStyle}">${swapOverlay}${numContent}</td>`;}
function updatePlaceholder(){updateReceiptPlaceholder();}

/* ═══════════════════════════════════════════════════════
   RENDER INPUT PAGE
═══════════════════════════════════════════════════════ */
function renderInputPage() {
  app.innerHTML = `
    <div class="top-bar top-bar-p1">
      <button class="back-btn" id="p1BackBtn">${BACK_CHEVRON}</button>
      <span class="top-title">อ่านใบเสร็จ</span><div id="receipt-history"></div>
    </div>
    <div class="pg-input">
      <div class="input-inner">
        <div class="vision-zone" id="visionZone"></div>
        <div class="ta-card">
          <div class="ta-bar">
            <span class="ta-lbl">ข้อความที่อ่าน/คัดลอกจากภาพใบเสร็จ</span>
            <button class="clear-ta-btn" id="clearTaBtn" ${!state.raw?"disabled":""}">ลบทั้งหมด</button>
          </div>
          <textarea class="receipt-ta" id="receiptText" placeholder="${RECEIPT_PLACEHOLDER}">${escapeHtml(state.raw||"")}</textarea>
        </div>
      </div>
    </div>
    <div class="parse-wrap">
      <div class="parse-wrap-inner">
        <button class="parse-btn" id="parseBtn">แยกเมนูและราคาอัตโนมัติ</button>
      </div>
    </div>`;

  renderVisionZone();mountReceiptHistory();layoutCleanup=mountReceiptLayout({onLayout:updateStickyOffsets,optionLabels:[]});

  const imagePicker = document.getElementById("imageFilePicker");
  imagePicker.onchange = e => { const f=e.target.files?.[0]; if(f) setVisionImage(f); imagePicker.value=""; };

  const ta = document.getElementById("receiptText");
  ta.addEventListener("input", () => {
    state.raw=ta.value;
    const clearBtn=document.getElementById("clearTaBtn");if(clearBtn)clearBtn.disabled=!state.raw;
    clearTimeout(textDebounceTimer);updateTextUndoRedoBtns();
    textDebounceTimer=setTimeout(()=>{pushTextHistory(state.raw);updateTextUndoRedoBtns();},500);
  });
  ta.addEventListener("paste", e=>{
    const html=e.clipboardData?.getData("text/html")||"";const flat=flattenHtmlTable(html);
    if(flat===null)return;e.preventDefault();
    const start=ta.selectionStart;const end=ta.selectionEnd;const before=ta.value.slice(0,start);const after=ta.value.slice(end);
    ta.value=before+flat+after;ta.selectionStart=ta.selectionEnd=start+flat.length;
    state.raw=ta.value;const clearBtn=document.getElementById("clearTaBtn");if(clearBtn)clearBtn.disabled=!state.raw;
    clearTimeout(textDebounceTimer);textDebounceTimer=setTimeout(()=>{pushTextHistory(state.raw);updateTextUndoRedoBtns();},500);
  });
  document.getElementById("clearTaBtn").addEventListener("click", clearTextArea);
  editors.bind(document.getElementById('p1BackBtn'),returnToBill);


  editors.bind(document.getElementById("parseBtn"), async()=>{
    try {
      await parseCurrentText();
    } catch(err){console.error("Parse failed:",err);visionState.statusMsg='แยกเมนูยังไม่ได้ ลองเช็กข้อความแล้วกดอีกครั้ง';visionState.statusKind='error';renderVisionZone();}
  });
  requestAnimationFrame(()=>{updateStickyOffsets();updatePlaceholder();requestAnimationFrame(()=>{updateStickyOffsets();updatePlaceholder();});});
}

/* ═══════════════════════════════════════════════════════
   RENDER RESULTS PAGE
═══════════════════════════════════════════════════════ */
function renderResultsPage() {
  _summaryCardFocusing = false;
  const itemRows = state.rows.filter(r=>!r.isDiscount);
  const subtotal  = r2(itemRows.reduce((s,r)=>s+getDerivedValues(r).lineTotal,0));
  const summaryView = resolveSummaryState(subtotal,state.summarySource,state.summaryEdits,state.discountCanonical);
  const showSC   = summaryView.service_charge.amount>0||summaryView.service_charge.rate>0;
  const showVAT  = summaryView.vat.amount>0||summaryView.vat.rate>0;
  const showDisc = summaryView.discount.amount>0;
  const footerColspan = 3;
  const firstItemRow  = state.rows.find(r=>!r.isDiscount);
  const canonicalRole = firstItemRow?firstItemRow.priceSource:"line_total";
  const rowsHtml = state.rows.map((row,i)=>{
    const cls=row.isDiscount?"row-disc":i%2===0?"row-even":"row-odd";
    const nameEditing=state.editing?.rowId===row.id&&state.editing?.field==="itemName";
    const qtyEditing =state.editing?.rowId===row.id&&state.editing?.field==="qty";
    const discTypeBadge=row.isDiscount&&row.discountType?`<span class="badge" style="background:rgba(212,80,80,.12);color:var(--red);font-size:7.5px">${row.discountType==="percent"?"%":"฿"}</span>`:"";
    const nameCell=nameEditing?`<td class="td-canonical"><input class="ci name" data-edit-input="${row.id}:itemName" value="${escapeHtml(row.itemName)}" enterkeyhint="done" autocomplete="off" spellcheck="false" /></td>`:`<td class="td-canonical" data-edit-cell="${row.id}:itemName" style="text-align:left;cursor:text">${escapeHtml(row.itemName)}${row.isDiscount?'<span class="badge badge-d">disc</span>':""}${discTypeBadge}${row.needsReview&&!row.isDiscount?'<span class="badge badge-r">?</span>':""}${row.flags?.length>0?`<span class="badge badge-w" title="${escapeHtml((row.flags||[]).map(f=>f.msg||f.type).join(" / "))}">!</span>`:""}</td>`;
    const qtyCell=qtyEditing?`<td class="td-canonical" style="text-align:right;padding-left:0;padding-right:4px"><input class="ci qty" data-edit-input="${row.id}:qty" value="${row.qty}" inputmode="numeric" enterkeyhint="done" autocomplete="off" spellcheck="false" /></td>`:`<td class="td-canonical" data-edit-cell="${row.id}:qty" style="text-align:right;cursor:text;padding-left:0;padding-right:4px"><span>${row.qty}</span></td>`;
    return`<tr class="${cls}" data-row-id="${row.id}">${nameCell}${qtyCell}${renderPriceCell(row,state.colOrder[0])}${renderPriceCell(row,state.colOrder[1])}<td class="td-del"><button class="del" data-delete="${row.id}" title="ลบ">${BIN_ICON}</button></td></tr>`;
  }).join("");
  const scRateLabel  =summaryView.service_charge.rate>0?` (${formatPctForDisplay(summaryView.service_charge.rate)}%)`:"";
  const vatRateLabel =summaryView.vat.rate>0?` (${formatPctForDisplay(summaryView.vat.rate)}%)`:"";
  const discRateLabel=state.discountCanonical==="rate"&&summaryView.discount.rate>0?` (${formatPctForDisplay(summaryView.discount.rate)}%)`:"";

  app.innerHTML = `
    <div class="pg-results"><div class="res-inner">
      <div class="top-bar">
        <button class="back-btn" id="backBtn">${BACK_CHEVRON}</button>
        <span class="top-title">โปรดตรวจสอบความถูกต้อง</span>
        <div id="receipt-history"></div>
        <button class="add-btn results-add-btn" id="addBtn">+ เพิ่มเมนู</button>
      </div>
      <div class="sub-bar receipt-history-row" id="subBar" hidden></div>
      <div class="summary-sticky-bar" id="summaryBar">
        <div class="ssb-card"><span class="ssb-lbl">รวมค่าอาหาร</span><span class="ssb-val ssb-subtotal">${formatMoneyDisplay(summaryView.subtotal)}</span></div>
        <div class="ssb-card ssb-card-total"><span class="ssb-lbl">ยอดที่ต้องจ่าย</span><span class="ssb-val ssb-total">${formatMoneyDisplay(summaryView.total)}</span></div>
      </div>
      <div class="summary-grid">${renderChargeCard('service_charge','Service Charge',summaryView.service_charge)}${renderChargeCard('vat','VAT',summaryView.vat)}${renderDiscountCard(summaryView.discount)}</div>
      <div class="swap-bar"><span class="swap-hint"><span style="white-space:nowrap"><span style="color:var(--gold2);font-weight:600">เลขสีทอง </span><span class="swap-hint-p2">คือราคาที่อ่านได้จากใบเสร็จ</span></span><span class="swap-hint-p2" style="white-space:nowrap">หรือราคาที่คุณแก้ไขใหม่</span></span></div>
      <div class="tbl-card"><div class="tbl-scroll"><table>
        <colgroup><col class="col-name"/><col class="col-qty"/><col class="col-p1"/><col class="col-p2"/><col class="col-del"/></colgroup>
        <thead><tr>
          <th class="th-fix" style="text-align:left">เมนู</th>
          <th class="th-fix right" style="overflow:visible;padding-left:3px;padding-right:3px;">จำนวน</th>
          ${(()=>{const thCells=state.colOrder.map((role,idx)=>{const isCanonical=role===canonicalRole;const label=role==="unit_price"?"ราคา":"ยอดรวม";if(idx===1){return`<th class="th-fix right${isCanonical?' th-canonical':''}" style="position:relative;overflow:visible;"><button class="swap-col-btn" id="swapColsBtn" title="สลับคอลัมน์ราคาทั้งหมด" style="position:absolute;left:var(--swap-btn-left,0px);top:50%;transform:translate(-50%,-50%);z-index:1;">${SWAP_ICON_ALL}</button><span class="th-label">${label}</span></th>`;}return`<th class="th-fix right${isCanonical?' th-canonical':''}"><span class="th-label">${label}</span></th>`;});return thCells[0]+thCells[1];})()}
          <th class="th-fix" style="width:32px;padding:0"></th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr><td class="tfoot-label" colspan="${footerColspan}">รวมค่าอาหาร</td><td class="tfoot-value tfoot-subtotal">${formatMoneyDisplay(summaryView.subtotal)}</td><td></td></tr>
          ${showSC?`<tr><td class="tfoot-label" colspan="${footerColspan}">Service Charge${escapeHtml(scRateLabel)}</td><td class="tfoot-value tfoot-sc">+${formatMoneyDisplay(summaryView.service_charge.amount)}</td><td></td></tr>`:""}
          ${showVAT?`<tr><td class="tfoot-label" colspan="${footerColspan}">VAT${escapeHtml(vatRateLabel)}</td><td class="tfoot-value tfoot-vat">+${formatMoneyDisplay(summaryView.vat.amount)}</td><td></td></tr>`:""}
          ${showDisc?`<tr><td class="tfoot-label" colspan="${footerColspan}">ส่วนลด${escapeHtml(discRateLabel)}</td><td class="tfoot-value tfoot-disc">-${formatMoneyDisplay(summaryView.discount.amount)}</td><td></td></tr>`:""}
          <tr class="tfoot-grand"><td class="tfoot-label" colspan="${footerColspan}">ยอดที่ต้องจ่าย</td><td class="tfoot-value tfoot-total">${formatMoneyDisplay(summaryView.total)}</td><td></td></tr>
        </tfoot>
      </table></div></div>
      <div class="results-bottom-spacer" aria-hidden="true"></div>
    </div></div>
    <div class="submit-wrap"><div class="submit-wrap-inner"><button class="submit-btn" id="submitBtn">เพิ่มเมนูลงบิล</button></div></div>`;

  const error=document.createElement('p');error.id='receipt-import-error';error.className='import-error';error.setAttribute('role','alert');error.hidden=true;
  document.querySelector('.results-bottom-spacer').before(error);
  mountReceiptHistory();layoutCleanup=mountReceiptLayout({onLayout:updateStickyOffsets});
  if(draftNotice)showImportError(draftNotice);
  bindEditorAction("backBtn",()=>{state.page="input";state.editing=null;render();});
  bindEditorAction("addBtn",addRow);
  bindEditorAction("submitBtn",submitReceipt);
  bindEditorAction("swapColsBtn",handleSwap);
  app.querySelectorAll("[data-swap-row]").forEach(btn=>{editors.bind(btn,()=>swapRow(btn.dataset.swapRow));});
  const TAP_THRESHOLD=8;
  app.querySelectorAll("[data-edit-cell]").forEach(cell=>{let tapX=0,tapY=0,tapMoved=false;cell.addEventListener("pointerdown",e=>{tapX=e.clientX;tapY=e.clientY;tapMoved=false;});cell.addEventListener("pointermove",e=>{if(Math.abs(e.clientX-tapX)>TAP_THRESHOLD||Math.abs(e.clientY-tapY)>TAP_THRESHOLD)tapMoved=true;});cell.addEventListener("pointercancel",()=>{tapMoved=true;});cell.addEventListener("pointerup",e=>{if(!tapMoved&&!e.target.closest('[data-swap-row]')){const[rowId,field]=cell.dataset.editCell.split(":");startEdit(rowId,field);}});});
  app.querySelectorAll("[data-edit-input]").forEach(input=>{const[rowId,field]=input.dataset.editInput.split(":");const selectAll=field!=="itemName";let committing=false;input.addEventListener("focus",()=>{if(selectAll&&typeof input.select==="function")input.select();});input.addEventListener("blur",()=>{if(committing){committing=false;return;}commitEdit(rowId,field,input.value);});input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.isComposing){e.preventDefault();committing=true;input.blur();commitEdit(rowId,field,input.value);}if(e.key==="Escape"){e.preventDefault();committing=true;input.blur();state.editing=null;render();}});});
  app.querySelectorAll("[data-delete]").forEach(btn=>{editors.bind(btn,()=>deleteRow(btn.dataset.delete));});
  app.querySelectorAll("[data-summary-card]").forEach(card=>{card.querySelectorAll("[data-summary-input]").forEach(input=>{const[cardKind,field]=input.dataset.summaryInput.split(":");let committing=false;let valueAtFocus=null;input.addEventListener("pointerdown",()=>{_summaryCardFocusing=true;});input.addEventListener("focus",()=>{_summaryCardFocusing=false;valueAtFocus=input.value;if(typeof input.select==="function")input.select();});input.addEventListener("blur",()=>{if(committing){committing=false;return;}if(input.value===valueAtFocus){return;}if(_summaryCardFocusing){pushUndo();_applySummaryState(cardKind,field,input.value);return;}commitSummaryEdit(cardKind,field,input.value);});input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.isComposing){e.preventDefault();committing=true;input.blur();commitSummaryEdit(cardKind,field,input.value);}if(e.key==="Escape"){e.preventDefault();committing=true;input.blur();render();}});});});
  requestAnimationFrame(()=>{updateStickyOffsets();updateSwapButtonAlignment();fitP2Numbers();requestAnimationFrame(()=>{updateStickyOffsets();updateSwapButtonAlignment();fitP2Numbers();});});
}

function bindEditorAction(id,action){const button=document.getElementById(id);if(button)editors.bind(button,action);}
function persistDraft(){if(draftBlocked||!billId||targetError)return false;if(!Number.isSafeInteger(baseRevision)){draftStorageFailed=true;return false;}try{if(!tabStorage)throw Error();const raw=JSON.stringify(reviewData());tabStorage.setItem(draftKey,raw);if(tabStorage.getItem(draftKey)!==raw)throw Error();draftStorageFailed=false;return true;}catch{draftStorageFailed=true;return false;}}
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
  if(draftBlocked&&rawDraftEvidence!==null){
    raw=state.raw===restoredText?rawDraftEvidence:JSON.stringify({source:rawDraftEvidence,receiptText:state.raw});
  }
  downloadReceiptData(raw,'หารจ่ายแฟร์ๆ-receipt-draft-evidence.json','application/json');
}
function hasReceiptWork(){return !!state.raw||rawDraftEvidence!==null;}
async function returnToBill(destination=returnUrl()){
  if(!persistDraft()&&hasReceiptWork()){
    const result=await openSheet({title:'ยังเก็บฉบับร่างไม่ได้',body:'<p>ดาวน์โหลดฉบับร่างก่อนกลับไปยังบิล หรืออยู่หน้านี้เพื่อแก้ต่อ</p>',actions:[
      {label:'แก้ต่อ',value:false},
      {label:'ดาวน์โหลดฉบับร่างและกลับ',run:async()=>{downloadReceiptWork();return true;}}
    ]});
    if(!result)return;
  }
  leavingReceipt=true;
  location.href=destination;
}
function showStorageNotice(){
  document.getElementById('receipt-storage-notice')?.remove();
  if(!targetError&&!draftStorageFailed&&!draftNotice&&oldDraftEvidence===null)return;
  const notice=document.createElement('div'),message=document.createElement('p');
  notice.id='receipt-storage-notice';
  notice.className='receipt-target-notice';
  notice.setAttribute('role','status');
  message.textContent=targetError||draftNotice||
    (draftStorageFailed?'ยังเก็บฉบับร่างไม่ได้ ดาวน์โหลดฉบับร่างก่อนออกจากหน้านี้':'พบฉบับร่างเดิมที่ดาวน์โหลดเก็บไว้ได้');
  notice.append(message);
  function action(label,callback,id){
    const button=document.createElement('button');
    button.type='button';
    button.textContent=label;
    button.onclick=callback;
    if(id)button.id=id;
    notice.append(button);
  }
  if(state.raw)action('ดาวน์โหลดข้อความใบเสร็จ',downloadReceiptText);
  if(hasReceiptWork()&&(targetError||draftStorageFailed||draftBlocked)){
    action('ดาวน์โหลดฉบับร่างใบเสร็จ',downloadReceiptWork,'download-receipt-evidence');
  }
  if(oldDraftEvidence!==null)action('ดาวน์โหลดฉบับร่างเดิม',()=>downloadReceiptData(oldDraftEvidence,'หารจ่ายแฟร์ๆ-unmatched-draft-evidence.json','application/json'));
  const back=document.createElement('a'),url=new URL(returnUrl());
  back.href=url.href;
  back.textContent=targetMissing||!billId?'เลือกบิลที่บันทึกไว้':'กลับไปยังบิล';
  back.onclick=event=>{event.preventDefault();returnToBill(url.href);};
  notice.append(back);
  document.getElementById('app').prepend(notice);
}
function startNewReceipt(){
  receiptCommitted=false;lastDraft=null;rawDraftEvidence=null;
  Object.assign(state,{raw:'',rows:[],summarySource:null,summaryEdits:{service_charge_rate:null,vat_rate:null,discount_rate:null,discount_amount:null},discountCanonical:'rate',page:'input',textHistory:[''],textHistoryPos:0,undoStack:[],redoStack:[],editing:null});
  visionState.statusMsg='';visionState.statusKind='';render();
}
async function offerImportedReceipt(){
  if(!receiptCommitted||targetError||draftBlocked)return;
  const result=await openSheet({title:'เพิ่มใบเสร็จนี้ลงบิลแล้ว',className:'receipt-revisit',
    body:'<p>อัพโหลดใบเสร็จใหม่ หรือดูรายละเอียดใบเสร็จเดิม</p>',
    actions:[{id:'new-receipt',label:'อัพโหลดใบเสร็จใหม่',className:'sheet-primary',value:'new'},{label:'ดูรายละเอียดเดิม',value:'inspect'}],
    fallback:()=>document.getElementById('submitBtn')??document.getElementById('parseBtn')});
  if(result==='new')startNewReceipt();
  else if(lastDraft){state.page='results';render();document.getElementById('submitBtn')?.focus({preventScroll:true});}
}

function render(){layoutCleanup();receiptHistory=null;persistDraft();if(state.page==='input')renderInputPage();else renderResultsPage();showStorageNotice();}
window.addEventListener('resize',()=>{updateStickyOffsets();updatePlaceholder();updateSwapButtonAlignment();fitP2Numbers();});
if(window.visualViewport)window.visualViewport.addEventListener('resize',updateStickyOffsets);
function buildImport(bill,draft){return importToApproved(bill,draft,{mode:state.importMode,charges:'receipt',assignmentMode:state.importAssignments});}
function showImportError(message){const el=document.getElementById('receipt-import-error');if(el){el.hidden=false;el.textContent=message;el.scrollIntoView({block:'nearest'});}}
let submitting=false;
async function submitReceipt(){
  if(submitting||editors.composing)return;
  submitting=true;
  let repeatNeeded=false;
  try{
    if(targetError)throw Error(targetError);
    if(draftBlocked)throw Error('โปรดกลับไปแยกเมนูจากข้อความอีกครั้ง');
    const loaded=await billSession.load();
    if(loaded.status!=='loaded')throw Error(loaded.message);
    const repeated=billSession.current.imports.includes(lastDraft?.id);
    let prepared=buildReviewedDraft(reviewData());
    if(repeated){
      const confirmed=await openSheet({title:'เพิ่มใบเสร็จเดิมอีกครั้งหรือไม่?',body:'<p>เคยเพิ่มใบเสร็จนี้ลงบิลไปแล้ว หากเพิ่มต่อจะซ้ำเมนูเดิม</p>',destructive:true,
        actions:[{label:'ยกเลิก',value:false},{label:'เพิ่มอีกครั้ง',className:'sheet-primary',value:true}],fallback:()=>document.getElementById('submitBtn')});
      if(!confirmed)return;
      prepared=copyReceiptForImport(prepared);
      baseRevision=billSession.record.recordRevision;
    }
    let attemptSubmitted=false;
    const imported=await openReceiptImport({mode:state.importMode,assignmentMode:state.importAssignments,onConfirm:async options=>{
    state.importMode=options.mode;state.importAssignments=options.assignmentMode;persistDraft();
    const loaded=await billSession.load();
    if(loaded.status!=='loaded'){targetMissing=loaded.status==='missing';targetError=loaded.message;throw Error(targetError);}
    const bill=billSession.current;
    // Matching attempt identity proves a previous commit, even if its reply was
    // lost. Another tab importing the original requires explicit repeat consent.
    if(bill.imports.includes(prepared.id)){
      if(repeated||attemptSubmitted){lastDraft=prepared;receiptCommitted=true;persistDraft();return;}
      repeatNeeded=true;receiptCommitted=true;return;
    }
    if(baseRevision!==billSession.record.recordRevision){baseRevision=billSession.record.recordRevision;persistDraft();throw Error('บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนเพิ่มเมนู');}
    const next=buildImport(bill,prepared);
    attemptSubmitted=true;
    const result=await billSession.commit(next,{kind:'import',baseRevision});
    if(!['saved','unchanged'].includes(result.status))throw Error(result.message);
    lastDraft=prepared;receiptCommitted=true;persistDraft();
  }});if(imported&&receiptCommitted&&!repeatNeeded)await returnToBill();
  }catch(error){showImportError(error.message);}finally{submitting=false;showStorageNotice();}
  if(repeatNeeded)await submitReceipt();
}
let savedCache=null;
try{
  const saved=savedCache=rawDraftEvidence===null?null:JSON.parse(rawDraftEvidence);
  if(saved){
    const {review,notices}=normalizeReviewDraft(saved);
    if(review.billId!==billId)throw Error('ฉบับร่างนี้เป็นของบิลอื่น');
    for(const key of ['raw','rows','summarySource','summaryEdits','discountCanonical','colOrder','importMode','importAssignments','page'])state[key]=review[key];
    lastDraft=review.draft;
    draftNotice=notices.join(' ');
    baseRevision=review.baseRevision;
    state.textHistory=[state.raw];
    state.textHistoryPos=0;
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
void offerImportedReceipt();
addEventListener('pagehide',persistDraft);
addEventListener('beforeunload',event=>{if(!leavingReceipt&&(submitting||draftStorageFailed||(targetError&&hasReceiptWork())||draftBlocked&&hasReceiptWork())){event.preventDefault();event.returnValue='';}});
async function checkTarget(){
  if(!billSession||submitting)return;
  try{const latest=await repository.read(billId);if(!latest){targetMissing=true;targetError='ไม่พบบิลนี้ อาจถูกลบแล้ว';showImportError(targetError);showStorageNotice();}else if(latest.recordRevision!==baseRevision)showImportError('บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนเพิ่มเมนู');}
  catch(error){targetError=error.message;showImportError(targetError);showStorageNotice();}
}
addEventListener('pageshow',checkTarget);
addEventListener('fairshare-storage-versionchange',()=>{targetError='โหลดหารจ่ายแฟร์ๆ ใหม่ก่อนบันทึกต่อ';showImportError(targetError);showStorageNotice();});
addEventListener('focus',checkTarget);
try{
  const channel=new BroadcastChannel('fairshare-library');
  channel.onmessage=event=>{if(event.data?.id===billId)void checkTarget();};
}catch{}
