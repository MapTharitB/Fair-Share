import {parseReceipt,initializeSummaryEdits,resolveSummaryState} from './receipt-parser.mjs';
import {adjustment,cents,newId,validateBill,emptyBill,calculate,itemTotal} from './bill-state.mjs';
import {receiptNumber,emptyReceiptEvidence,fieldIssue,receiptIssueMessage,RECEIPT_LIMIT} from './receipt-fields.mjs';

// Public receipt summary entry point.
export function receiptSummary(subtotal,source,edits,mode='amount'){
  return resolveSummaryState(subtotal,source,edits,mode);
}
export function receiptReviewSummary(subtotal,source,edits,mode,treatment){
  const view=receiptSummary(subtotal,source,edits,mode);
  if(treatment!=='included')return view;
  const gross=Math.round((subtotal+view.service_charge.amount)*100)/100;
  const vat=source?.vat?.mode==='amount'?view.vat.amount:Math.round(gross*view.vat.rate/(100+view.vat.rate)*100)/100;
  view.vat.amount=vat;view.vat.rate=gross>vat?vat/(gross-vat)*100:0;
  if(mode==='rate')view.discount.amount=Math.round((gross*(edits?.discount_rate??source?.discount?.value??0)/100+(source?.discount?.extraAmountSum??0))*100)/100;
  view.total=Math.round((gross-view.discount.amount)*100)/100;
  return view;
}

const clone=value=>structuredClone(value);
export function reviewSubtotal(review) {
  const subtotal = review.rows.filter(row => !row.isDiscount)
    .reduce((sum,row)=>{
      if(row.priceValue==null||row.priceSource==='unit_price'&&row.qty==null)return sum;
      try{return sum+itemTotal({priceSource:row.priceSource,quantity:row.qty,priceCents:cents(String(row.priceValue))});}catch{return sum;}
    },0);
  return subtotal/100;
}
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const fail=()=>{throw Error('ข้อมูลฉบับร่างไม่ถูกต้อง เก็บฉบับร่างไว้แล้วตรวจสอบอีกครั้ง');};
function validateIssues(issues,summary=false){
  if(!plain(issues))fail();
  for(const [key,issue] of Object.entries(issues)){
    if(!(summary?['service_charge','vat','discount']:['qty','price']).includes(key)||!plain(issue)||!['missing','ambiguous','invalid','unverified'].includes(issue.reason)||!(summary?['rate','amount']:key==='qty'?['qty']:['unit_price','line_total']).includes(issue.editField)||(issue.input!==null&&(typeof issue.input!=='string'||issue.input.length>RECEIPT_LIMIT)))fail();
  }
}
function validateEvidence(row,lines){
  const e=row.evidence;if(!plain(e)||!Array.isArray(e.sourceLines)||typeof row.rawLine!=='string'||row.rawLine.length>RECEIPT_LIMIT||typeof row.priceEdited!=='boolean')fail();
  const indices=e.sourceLines;
  if(indices.some((v,i)=>!Number.isInteger(v)||v<0||v>=lines.length||(i>0&&v<=indices[i-1])))fail();
  if(indices.length&&indices.map(i=>lines[i]).join('\n')!==row.rawLine)fail();
  for(const [token,money] of [['quantityText',null],['unitText','unitCents'],['totalText','totalCents']]){
    if(e[token]!==null&&(typeof e[token]!=='string'||e[token].length>RECEIPT_LIMIT||!row.rawLine.includes(e[token])))fail();
    if(money){const value=e[money];if(value!==null&&(!Number.isSafeInteger(value)||value<0||value>1e12||e[token]===null||receiptNumber(e[token])===null||cents(String(receiptNumber(e[token])))!==value))fail();}
  }
}
function validateReview(review){
  if(typeof review.raw!=='string'||review.raw.length>100000||!Array.isArray(review.rows)||review.rows.length>10000)throw Error('เปิดฉบับร่างไม่ได้ โปรดกลับไปแยกเมนูจากข้อความอีกครั้ง');
  const sourceRaw=review.draft?.raw??review.raw;if(typeof sourceRaw!=='string'||sourceRaw.length>RECEIPT_LIMIT)fail();
  const sourceLines=sourceRaw.split(/\r\n|\r|\n/);
  const ids=new Set();
  for(const row of review.rows){
    if(!plain(row)||typeof row.id!=='string'||!row.id||row.id.length>200||ids.has(row.id)||typeof row.itemName!=='string'||row.itemName.length>200||(row.qty!==null&&(!Number.isInteger(row.qty)||row.qty<1||row.qty>99))||!['unit_price','line_total'].includes(row.priceSource)||(row.priceValue!==null&&(!Number.isFinite(row.priceValue)||row.priceValue<0||row.priceValue>1e10)))throw Error('ข้อมูลเมนูในฉบับร่างไม่ถูกต้อง โปรดกลับไปตรวจสอบข้อความ');
    if(row.priceValue!==null&&receiptNumber(String(row.priceValue))===null)fail();
    ids.add(row.id);
    if(row.isDiscount!==undefined&&typeof row.isDiscount!=='boolean')fail();
    if(row.flags!=null&&(!Array.isArray(row.flags)||row.flags.length>10000||row.flags.some(flag=>!flag||typeof flag.type!=='string'||flag.type.length>RECEIPT_LIMIT||(flag.msg!=null&&(typeof flag.msg!=='string'||flag.msg.length>RECEIPT_LIMIT)))))throw Error('ข้อมูลเมนูในฉบับร่างไม่ถูกต้อง โปรดกลับไปตรวจสอบข้อความ');
    if(!row.isDiscount){
      validateIssues(row.issues);validateEvidence(row,sourceLines);
      for(const [key,value] of [['qty',row.qty],['price',row.priceValue]]){
        const issue=row.issues[key];
        if(value===null&&!issue||issue&&['missing','invalid'].includes(issue.reason)&&value!==null||key==='price'&&issue&&issue.editField!==row.priceSource)fail();
      }
      if(row.priceValue!==null&&!row.priceEdited&&!row.issues.price){
        const proof=row.priceSource==='line_total'?row.evidence.totalCents:row.evidence.unitCents;
        if(proof===null||receiptNumber(String(row.priceValue))===null||cents(String(row.priceValue))!==proof)fail();
      }
    }
  }
  validateIssues(review.summaryIssues,true);
  if(!sameColumns(review.colOrder))fail();
  for(const value of Object.values(review.summaryEdits??{}))if(value!=null&&(!Number.isFinite(value)||value<0))throw Error('ข้อมูลปรับยอดในฉบับร่างไม่ถูกต้อง');
  for(const key of ['service_charge','vat','discount']){
    const source=review.summarySource?.[key];
    if(source!=null&&(!['amount','percent'].includes(source.mode)||!Number.isFinite(source.value)||source.value<0||(source.extraAmountSum!=null&&(!Number.isFinite(source.extraAmountSum)||source.extraAmountSum<0))))throw Error('ข้อมูลปรับยอดในฉบับร่างไม่ถูกต้อง');
  }
  if(!['rate','amount'].includes(review.discountCanonical)||!['input','results'].includes(review.page)||!['append','replace'].includes(review.importMode)||!['all','none'].includes(review.importAssignments))throw Error('ตัวเลือกในฉบับร่างไม่ถูกต้อง');
  if(review.page==='results'&&(typeof review.draft?.id!=='string'||!review.draft.id||typeof review.draft?.group?.id!=='string'))throw Error('ไม่พบข้อมูลใบเสร็จเดิม โปรดกลับไปแยกเมนูอีกครั้ง');
  if(review.draft){if(typeof review.draft.raw!=='string'||review.draft.raw.length>RECEIPT_LIMIT)fail();const b=emptyBill();b.groups.push(review.draft.group);validateBill(b);}
  if(review.draft?.notices!==undefined&&(!Array.isArray(review.draft.notices)||review.draft.notices.length>10000||review.draft.notices.some(n=>typeof n!=='string'||n.length>RECEIPT_LIMIT)))fail();
}

export function normalizeReviewDraft(saved){
  if(saved?.schema!==3)throw Error('รุ่นฉบับร่างไม่รองรับ เก็บข้อความไว้แล้วแยกเมนูอีกครั้ง');
  if(typeof saved.billId!=='string'||!saved.billId||!Number.isSafeInteger(saved.baseRevision)||saved.baseRevision<1)throw Error('ฉบับร่างไม่มีข้อมูลบิลที่ถูกต้อง');
  const review={schema:3,billId:saved.billId,baseRevision:saved.baseRevision,raw:saved.raw,rows:clone(saved.rows),summarySource:clone(saved.summarySource??{}),summaryEdits:clone(saved.summaryEdits??{}),summaryIssues:clone(Object.hasOwn(saved,'summaryIssues')?saved.summaryIssues:{}),discountCanonical:saved.discountCanonical??'amount',colOrder:clone(saved.colOrder??['unit_price','line_total']),importMode:saved.importMode??'append',importAssignments:saved.importAssignments??'all',page:saved.page??'input',draft:clone(saved.draft??null)};
  if(!Object.hasOwn(saved,'summaryIssues')){
    if(!Array.isArray(review.rows)||review.rows.some(r=>['evidence','issues','priceEdited'].some(k=>Object.hasOwn(r,k))))fail();
    for(const row of review.rows){row.rawLine??='';row.evidence=emptyReceiptEvidence();row.priceEdited=false;row.issues={qty:fieldIssue('unverified','qty'),price:fieldIssue('unverified',row.priceSource)};}
    for(const kind of ['service_charge','vat','discount'])if(review.summarySource[kind]||Object.entries(review.summaryEdits).some(([k,v])=>k.startsWith(kind+'_')&&v!==null))review.summaryIssues[kind]=fieldIssue('unverified',kind==='discount'?review.discountCanonical:review.summarySource[kind]?.mode==='amount'?'amount':'rate');
  }
  if(!sameColumns(review.colOrder))throw Error('ลำดับคอลัมน์ในฉบับร่างไม่ถูกต้อง');
  validateReview(review);return {review,notices:[]};
}
function sameColumns(columns){return Array.isArray(columns)&&columns.length===2&&new Set(columns).size===2&&columns.every(c=>['unit_price','line_total'].includes(c));}

const isReviewItem=row=>!row.isDiscount;
function projectRows(rows,groupId){return rows.filter(isReviewItem).map(r=>({id:r.id,groupId,name:r.itemName,quantity:r.qty,priceSource:r.priceSource,priceCents:cents(String(r.priceValue)),assignments:[],rawLine:r.rawLine??''}));}
export function receiptPreviewSummary(review,subtotal=reviewSubtotal(review)){
  const sources={...review.summarySource},edits={...review.summaryEdits};
  for(const kind of Object.keys(review.summaryIssues??{})){
    sources[kind]=null;
    edits[kind+'_rate']=0;
    if(kind==='discount')edits.discount_amount=0;
  }
  return receiptSummary(subtotal,sources,edits,review.discountCanonical);
}
function projectReview(review,withFallbacks){
  if(withFallbacks)review={...review,rows:review.rows.map(row=>({...row,qty:row.qty??1,priceValue:row.priceValue??0}))};
  const draft=clone(review.draft);draft.items=projectRows(review.rows,draft.group.id);
  const view=withFallbacks?receiptPreviewSummary(review):receiptSummary(reviewSubtotal(review),review.summarySource,review.summaryEdits,review.discountCanonical);
  if(view.total<0)throw Error('เช็กส่วนลด ยอดที่ต้องจ่ายต้องไม่ต่ำกว่า 0');
  for(const [key,field] of [['service','service_charge'],['tax','vat'],['discount','discount']]){
    const rate=key==='discount'?review.discountCanonical==='rate'&&!review.summarySource?.discount?.extraAmountSum:review.summarySource?.[field]?.mode==='percent';
    const value=rate?view[field].rate:view[field].amount;
    draft.group[key]={kind:rate?'rate':'fixed',value:Math.round(value*100),enabled:value>0,...(key==='tax'?{treatment:'excluded'}:{})};
  }
  if(!draft.group.service.value)draft.group.service={kind:'rate',value:1000,enabled:false};
  if(!draft.group.tax.value)draft.group.tax={kind:'rate',value:700,enabled:false,treatment:'excluded'};
  draft.group.placement='after_sc_vat';
  return draft;
}
function assessReview(review,allowUnresolved=false){
  const issues=[];
  try{validateReview(review);}catch(error){return {issues:[{structural:true,message:error.message}]};}
  if(!review.rows.some(isReviewItem))issues.push({message:'ยังไม่มีเมนูให้เพิ่ม'});
  if(review.page!=='results')issues.push({message:'กลับไปตรวจสอบเมนูก่อนเพิ่มลงบิล'});
  for(const row of review.rows.filter(isReviewItem)){
    for(const [field,value] of [['qty',row.qty],['price',row.priceValue]])if(row.issues[field]||value===null||field==='price'&&receiptNumber(String(value))===null)issues.push({rowId:row.id,field,reason:row.issues[field]?.reason,editField:field==='qty'?'qty':row.issues.price?.editField??row.priceSource});
    if(!row.issues.price&&row.priceValue!==null&&row.qty!==null)try{itemTotal({quantity:row.qty,priceSource:row.priceSource,priceCents:cents(String(row.priceValue))});}catch{issues.push({rowId:row.id,field:'price',editField:row.priceSource});}
  }
  for(const [kind,issue] of Object.entries(review.summaryIssues))issues.push({kind,field:issue.editField});
  const result={issues:issues.map(issue=>({...issue,message:receiptIssueMessage(issue)}))};
  if(issues.length&&(!allowUnresolved||issues.some(issue=>!issue.rowId&&!issue.kind)))return result;
  try{
    const draft=projectReview(review,issues.length>0),bill=emptyBill();
    bill.groups.push(draft.group);bill.items=draft.items;validateBill(bill);calculate(bill);
    return {...result,draft};
  }catch(error){return {issues:[{message:error.message}]};}
}
export function reviewAdmission(review){
  const {issues}=assessReview(review);
  return {ok:!issues.length,issues};
}
export function buildReviewedDraft(review){
  const {draft,issues}=assessReview(review);
  if(!draft)throw Error(issues[0].message);
  return draft;
}
// The UI must ask for consent before handing a candidate with issues to importReceipt.
export function prepareReceiptImport(review){
  return assessReview(review,true);
}
// A deliberate repeat is a new import, while retries reuse this one copy.
export function copyReceiptForImport(draft){
  const next=clone(draft);next.id=newId();next.group.id=newId();
  next.items=next.items.map(item=>({...item,id:newId(),groupId:next.group.id}));
  return next;
}
function parseDraft(raw,{id=newId}={}){
  if(typeof raw!=='string'||raw.length>100000)throw Error('ข้อความใบเสร็จยาวเกินไป');
  const normalized=raw.replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-0x0e50)).replace(/\u0e4d\u0e32/g,'ำ');
  const notices=[];
  const parsed=parseReceipt(raw,{recoverOmitted:true,onSummaryEntries(entries){
    const vat=entries.filter(e=>e.kind==='vat'&&/^(?:vat|value added tax|ภาษี(?:มูลค่าเพิ่ม)?)\s*(?:inclusive|included|incl\.|รวมในราคา|รวมอยู่ในราคา)/i.test(e.norm));
    if(vat.length)notices.push(`ใบเสร็จระบุว่า “${vat.map(e=>e.raw).join(' / ')}” หากราคาอาหารรวม VAT แล้ว ให้ตั้งค่า VAT เป็น 0 เพื่อไม่ให้คิดภาษีซ้ำ`);
    const discounts=entries.filter(e=>e.kind==='discount');
    if(discounts.filter(e=>e.hasPct).length>1)notices.push(`ใบเสร็จมีส่วนลดหลายเปอร์เซ็นต์ “${discounts.map(e=>e.raw).join(' / ')}” ระบบใช้เปอร์เซ็นต์แรกในการคำนวณ โปรดตรวจสอบและแก้ไขยอดส่วนลดให้ตรงกับใบเสร็จ`);
  }});
  const groupId=id(),group={id:groupId,name:'ใบเสร็จ',...adjustment()};
  const source=parsed.summarySource;
  for(const [key,field] of [['service','service_charge'],['tax','vat'],['discount','discount']]){
    const a=source[field];if(a&&a.value<=(a.mode==='percent'?100:1e10))group[key]={...group[key],enabled:true,kind:a.mode==='percent'?'rate':'fixed',value:a.mode==='percent'?Math.round(a.value*100):cents(a.value.toFixed(2))};
  }
  if(source.vat)group.tax.treatment='unknown';
  const totalLines=normalized.split(/\r?\n/).filter(l=>/^\s*(?:grand\s*total|net\s*total|total|ยอดชำระสุทธิ|ยอดสุทธิ|ยอดรวมสุทธิ|รวมทั้งสิ้น|ยอดรวมทั้งสิ้น|รวมทั้งหมด|ยอดรวม)\s*[:：]?\s*(?:฿|\$|THB|บาท)?\s*[\d,]+(?:\.\d{1,2})?\s*(?:บาท|฿)?\s*$/i.test(l));
  if(totalLines.length){const match=totalLines.at(-1).match(/([\d,]+(?:\.\d{1,2})?)\s*(?:บาท|฿)?\s*$/);group.printedTotalCents=cents(match[1]);}
  const rows=parsed.rows.filter(r=>!r.isDiscount).map(r=>({...r,id:id()}));
  const draft={id:id(),raw,group,items:[],notices};
  if(source.discount?.extraAmountSum)notices.push('ใบเสร็จมีทั้งส่วนลดแบบเปอร์เซ็นต์และแบบจำนวนเงิน โปรดตรวจสอบว่ายอดส่วนลดรวมตรงกับใบเสร็จ');
  return {draft,rows,summarySource:source,summaryIssues:parsed.summaryIssues??{}};
}

export function createDraft(raw,options){
  const review=completeReview(parseDraft(raw,options));
  const draft=buildReviewedDraft(review);
  // The raw convenience API retains its source adjustment/unknown-tax contract;
  // only the reviewed boundary applies the manual correction convention.
  const reviewedGroup=draft.group;draft.group=clone(review.draft.group);
  if(review.summarySource.discount?.extraAmountSum)draft.group.discount=reviewedGroup.discount;
  draft.items=draft.items.map(item=>{const row=review.rows.find(r=>r.id===item.id);return {...item,needsReview:row.needsReview,flags:clone(row.flags)};});
  return draft;
}
function completeReview(parsed){
  return {...parsed,raw:parsed.draft.raw,page:'results',colOrder:['unit_price','line_total'],importMode:'append',importAssignments:'all',
    summaryEdits:initializeSummaryEdits(null,parsed.summarySource),discountCanonical:parsed.summarySource?.discount?.mode==='amount'?'amount':'rate'};
}
export function createReceiptReview(raw){return completeReview(parseDraft(raw));}
