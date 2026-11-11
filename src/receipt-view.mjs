import {binIcon} from './ui-icons.mjs';
import {esc as escapeHtml} from './bill-display.mjs';
import {formatMoney,formatMoneyDisplay,formatPctForDisplay,renderChargeCard,renderDiscountCard,flattenHtmlTable} from './receipt-display.mjs';
import {mountHistoryControls} from './history-controls.mjs';
import {mountReceiptLayout,updateReceiptLayout,RECEIPT_PLACEHOLDER} from './receipt-layout.mjs';
import {getDerivedValues} from './receipt-parser.mjs';
import {receiptSummary as resolveSummaryState,reviewSubtotal} from './receipt-draft.mjs';

// Render models are copied review/page data. Actions own every edit and async operation.
function mountViewHistory(model,actions){
  const history=mountHistoryControls(document.getElementById('receipt-history'),{
    scope:model.page==='input'?'ข้อความใบเสร็จ':'รายละเอียดใบเสร็จ',
    onUndo:actions.undo,onRedo:actions.redo,editors:{bind:actions.bindAction}});
  history.update(model.history);actions.historyMounted(history);return history;
}
function scheduleInitialLayout(){
  let first=0,second=0;
  first=requestAnimationFrame(()=>{updateReceiptLayout();second=requestAnimationFrame(updateReceiptLayout);});
  return ()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
}
export function showReceiptError(message){const element=document.getElementById('receipt-import-error');if(element){element.hidden=false;element.textContent=message;element.scrollIntoView({block:'nearest'});}}
const RECEIPT_ICON = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 2 1.5V2"/><line x1="9" y1="8" x2="17" y2="8"/><line x1="9" y1="12" x2="17" y2="12"/><line x1="9" y1="16" x2="14" y2="16"/></svg>`;
const BIN_ICON = binIcon({receipt:true});
const BACK_CHEVRON = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>`;
function renderReceiptHeader(review=false){
  return `<div class="top-bar receipt-header">
    <button class="back-btn" aria-label="ย้อนกลับ" id="${review?'backBtn':'p1BackBtn'}">${BACK_CHEVRON}</button>
    <span class="top-title">${review?'โปรดตรวจสอบความถูกต้อง':'อ่านใบเสร็จ'}</span>
    <div id="receipt-history"></div>
    ${review?'<button class="add-btn results-add-btn" id="addBtn">+ เพิ่มเมนู</button>':''}
  </div>`;
}
const SWAP_ICON_ALL = `<svg width="13" height="10" viewBox="0 0 13 10" fill="none"><line x1="1.5" y1="5" x2="11.5" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><polyline points="4,2 1.5,5 4,8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polyline points="9,2 11.5,5 9,8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
const SWAP_ICON_ROW = `<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><line x1="1.5" y1="4.5" x2="9.5" y2="4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><polyline points="3.5,2 1.5,4.5 3.5,7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polyline points="7.5,2 9.5,4.5 7.5,7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
export function renderReceiptVision(visionState,{readFile}) {
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
      if (file && file.type.startsWith("image/")) readFile(file);
    });
    dropArea.addEventListener("click", () => document.getElementById("imageFilePicker").click());
  }
}


function rowEditTarget(element,key){
  const rowId=element.closest('tr').dataset.rowId;
  return [rowId,element.dataset[key].slice(rowId.length+1)];
}

function renderPriceCell(state,row,colLabel) {
  const {unitPrice,lineTotal}=getDerivedValues(row);
  const isCanonical=colLabel===row.priceSource;
  const roleClass=isCanonical?"td-canonical td-price-source":"td-derived";
  const value=colLabel==="unit_price"?unitPrice:lineTotal;
  const field=`${escapeHtml(row.id)}:${colLabel}`;
  const editing=state.editing?.rowId===row.id&&state.editing.field===colLabel;
  if(editing){
    return `<td class="cell-with-overlay ${roleClass}"><input class="ci price" data-edit-input="${field}" value="${formatMoney(value)}" inputmode="decimal" enterkeyhint="done" autocomplete="off" spellcheck="false" /></td>`;
  }
  const isRightCol=state.colOrder[1]===colLabel;
  const swapOverlay=isRightCol&&!row.isDiscount?`<button class="swap-position swap-row-btn" data-swap-row="${escapeHtml(row.id)}" title="สลับราคาแถวนี้">${SWAP_ICON_ROW}</button>`:"";
  const column=isRightCol?" td-price-end":"";
  const discount=isCanonical&&row.isDiscount?" td-discount":"";
  const display=formatMoneyDisplay(value);
  const content=isRightCol?`<span data-p2-num class="p2-num">${display}</span>`:display;
  return `<td class="${roleClass}${discount}${column}" data-edit-cell="${field}">${swapOverlay}${content}</td>`;
}

export function renderInput(model,actions) {
  const app=document.getElementById("app"),state=model;
  app.innerHTML = `
    ${renderReceiptHeader()}
    <div class="pg-input">
      <div class="input-inner">
        <div class="vision-zone" id="visionZone"></div>
        <div class="ta-card">
          <div class="ta-bar">
            <span class="ta-lbl">ข้อความที่อ่าน/คัดลอกจากภาพใบเสร็จ</span>
            <button class="clear-ta-btn" id="clearTaBtn" ${!state.raw?"disabled":""}>ลบทั้งหมด</button>
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

  renderReceiptVision(model.vision,{readFile:actions.readFile});
  const history=mountViewHistory(model,actions),cleanup=mountReceiptLayout();

  const imagePicker = document.getElementById("imageFilePicker");
  const pickImage = imagePicker.onchange = e => { const f=e.target.files?.[0]; if(f) actions.readFile(f); imagePicker.value=""; };

  const ta = document.getElementById("receiptText");
  ta.addEventListener('input',()=>{
    actions.rawChanged(ta.value);
    document.getElementById('clearTaBtn').disabled=!ta.value;
  });
  ta.addEventListener("paste", e=>{
    const html=e.clipboardData?.getData("text/html")||"";const flat=flattenHtmlTable(html);
    if(flat===null)return;e.preventDefault();
    const start=ta.selectionStart;const end=ta.selectionEnd;const before=ta.value.slice(0,start);const after=ta.value.slice(end);
    ta.value=before+flat+after;ta.selectionStart=ta.selectionEnd=start+flat.length;
    actions.rawChanged(ta.value);const clearBtn=document.getElementById("clearTaBtn");if(clearBtn)clearBtn.disabled=!ta.value;

  });
  document.getElementById("clearTaBtn").addEventListener("click", actions.clearText);
  actions.bindAction(document.getElementById('p1BackBtn'),actions.returnToBill);


  actions.bindAction(document.getElementById('parseBtn'),actions.parse);
  const cancelInitial=scheduleInitialLayout();
  return ()=>{cancelInitial();cleanup();history.dispose();if(imagePicker.onchange===pickImage)imagePicker.onchange=null;};
}


export function renderReview(model,actions) {
  const app=document.getElementById("app"),state=model;
  let _summaryCardFocusing=false;
  const subtotal = reviewSubtotal(state);
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
    const discTypeBadge=row.isDiscount&&row.discountType?`<span class="badge-discount-type badge">${row.discountType==="percent"?"%":"฿"}</span>`:"";
    const nameCell=nameEditing?`<td class="td-canonical"><input class="ci name" data-edit-input="${escapeHtml(row.id)}:itemName" value="${escapeHtml(row.itemName)}" enterkeyhint="done" autocomplete="off" spellcheck="false" /></td>`:`<td class="td-name td-canonical" data-edit-cell="${escapeHtml(row.id)}:itemName">${escapeHtml(row.itemName)}${row.isDiscount?'<span class="badge badge-d">disc</span>':""}${discTypeBadge}${row.needsReview&&!row.isDiscount?'<span class="badge badge-r">?</span>':""}${row.flags?.length>0?`<span class="badge badge-w" title="${escapeHtml((row.flags||[]).map(f=>f.msg||f.type).join(" / "))}">!</span>`:""}</td>`;
    const qtyCell=qtyEditing?`<td class="td-quantity td-canonical"><input class="ci qty" data-edit-input="${escapeHtml(row.id)}:qty" value="${row.qty}" inputmode="numeric" enterkeyhint="done" autocomplete="off" spellcheck="false" /></td>`:`<td class="td-quantity td-canonical" data-edit-cell="${escapeHtml(row.id)}:qty"><span>${row.qty}</span></td>`;
    return`<tr class="${cls}" data-row-id="${escapeHtml(row.id)}">${nameCell}${qtyCell}${renderPriceCell(state,row,state.colOrder[0])}${renderPriceCell(state,row,state.colOrder[1])}<td class="td-del"><button class="del" data-delete="${escapeHtml(row.id)}" title="ลบ">${BIN_ICON}</button></td></tr>`;
  }).join("");
  const scRateLabel  =summaryView.service_charge.rate>0?` (${formatPctForDisplay(summaryView.service_charge.rate)}%)`:"";
  const vatRateLabel =summaryView.vat.rate>0?` (${formatPctForDisplay(summaryView.vat.rate)}%)`:"";
  const discRateLabel=state.discountCanonical==="rate"&&summaryView.discount.rate>0?` (${formatPctForDisplay(summaryView.discount.rate)}%)`:"";

  app.innerHTML = `
    <div class="pg-results">
      ${renderReceiptHeader(true)}
      <div class="sub-bar receipt-history-row" id="subBar" hidden></div>
      <div class="res-inner">
      <div class="summary-sticky-bar" id="summaryBar">
        <div class="ssb-card"><span class="ssb-lbl">รวมค่าอาหาร</span><span class="ssb-val ssb-subtotal">${formatMoneyDisplay(summaryView.subtotal)}</span></div>
        <div class="ssb-card ssb-card-total"><span class="ssb-lbl">ยอดที่ต้องจ่าย</span><span class="ssb-val ssb-total">${formatMoneyDisplay(summaryView.total)}</span></div>
      </div>
      <div class="summary-grid">${renderChargeCard('service_charge','Service Charge',summaryView.service_charge,'SC')}${renderChargeCard('vat','VAT',summaryView.vat)}${renderDiscountCard(summaryView.discount)}</div>
      <div class="swap-bar"><span class="swap-hint"><span class="swap-hint-fragment"><span class="swap-hint-emphasis">เลขสีส้ม </span><span class="swap-hint-p2">คือราคาที่อ่านได้จากใบเสร็จ</span></span><span class="swap-hint-fragment swap-hint-p2">หรือราคาที่คุณแก้ไขใหม่</span></span></div>
      <div class="tbl-card"><div class="tbl-scroll"><table>
        <colgroup><col class="col-name"/><col class="col-qty"/><col class="col-p1"/><col class="col-p2"/><col class="col-del"/></colgroup>
        <thead><tr>
          <th class="th-name th-fix">เมนู</th>
          <th class="th-quantity th-fix right">จำนวน</th>
          ${(()=>{const thCells=state.colOrder.map((role,idx)=>{const isCanonical=role===canonicalRole;const label=role==="unit_price"?"ราคา":"ยอดรวม";if(idx===1){return`<th class="cell-with-overlay th-fix right${isCanonical?' th-canonical':''}"><button class="swap-position swap-col-btn" id="swapColsBtn" title="สลับคอลัมน์ราคาทั้งหมด">${SWAP_ICON_ALL}</button><span class="th-label">${label}</span></th>`;}return`<th class="th-fix right${isCanonical?' th-canonical':''}"><span class="th-label">${label}</span></th>`;});return thCells[0]+thCells[1];})()}
          <th class="th-delete th-fix"></th>
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
  const history=mountViewHistory(model,actions),cleanup=mountReceiptLayout();
  if(model.draftNotice)showReceiptError(model.draftNotice);
  bindActionById("backBtn",actions.backToInput);
  bindActionById("addBtn",actions.addRow);
  bindActionById("submitBtn",actions.submit);
  bindActionById("swapColsBtn",actions.swapAll);
  app.querySelectorAll("[data-swap-row]").forEach(btn=>{actions.bindAction(btn,()=>actions.swapRow(btn.dataset.swapRow));});
  app.querySelectorAll('[data-edit-cell]').forEach(cell=>{
    const [rowId,field]=rowEditTarget(cell,'editCell');
    actions.bindAction(cell,()=>actions.startEdit(rowId,field));
  });
  app.querySelectorAll("[data-edit-input]").forEach(input=>{const[rowId,field]=rowEditTarget(input,"editInput");const selectAll=field!=="itemName";let committing=false;input.addEventListener("focus",()=>{if(selectAll&&typeof input.select==="function")input.select();});input.addEventListener("blur",()=>{if(committing){committing=false;return;}actions.commitRow(rowId,field,input.value);});input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.isComposing){e.preventDefault();committing=true;input.blur();actions.commitRow(rowId,field,input.value);}if(e.key==="Escape"){e.preventDefault();committing=true;input.blur();actions.cancelEdit();}});});
  app.querySelectorAll("[data-delete]").forEach(btn=>{actions.bindAction(btn,()=>actions.deleteRow(btn.dataset.delete));});
  app.querySelectorAll("[data-summary-card]").forEach(card=>{card.querySelectorAll("[data-summary-input]").forEach(input=>{const[cardKind,field]=input.dataset.summaryInput.split(":");let committing=false;let valueAtFocus=null;input.addEventListener("pointerdown",()=>{_summaryCardFocusing=true;});input.addEventListener("focus",()=>{_summaryCardFocusing=false;valueAtFocus=input.value;if(typeof input.select==="function")input.select();});input.addEventListener("blur",()=>{if(committing){committing=false;return;}if(input.value===valueAtFocus){return;}if(_summaryCardFocusing){actions.editSummary(cardKind,field,input.value,{forceHistory:true,render:false});return;}actions.editSummary(cardKind,field,input.value);});input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.isComposing){e.preventDefault();committing=true;input.blur();actions.editSummary(cardKind,field,input.value);}if(e.key==="Escape"){e.preventDefault();committing=true;input.blur();actions.cancelEdit();}});});});
  const cancelInitial=scheduleInitialLayout();
  return ()=>{cancelInitial();cleanup();history.dispose();};
  function bindActionById(id,action){const button=document.getElementById(id);if(button)actions.bindAction(button,action);}
}

