import {parseReceipt,parseItemLine,initializeSummaryEdits,resolveSummaryState,getDerivedValues} from './receipt-parser.mjs';
import {adjustment,cents,newId,validateBill,emptyBill} from './bill-state.mjs';

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
const reviewSubtotal=review=>Math.round(review.rows.filter(r=>!r.isDiscount).reduce((sum,row)=>sum+getDerivedValues(row).lineTotal,0)*100)/100;
function validateReview(review){
  if(typeof review.raw!=='string'||review.raw.length>100000||!Array.isArray(review.rows)||review.rows.length>10000)throw Error('เปิดฉบับร่างไม่ได้ โปรดกลับไปแยกเมนูจากข้อความอีกครั้ง');
  const ids=new Set();
  for(const row of review.rows){
    if(typeof row.id!=='string'||!row.id||ids.has(row.id)||typeof row.itemName!=='string'||row.itemName.length>200||!Number.isInteger(row.qty)||row.qty<1||row.qty>99||!['unit_price','line_total'].includes(row.priceSource)||!Number.isFinite(row.priceValue)||row.priceValue<0||row.priceValue>1e10)throw Error('ข้อมูลเมนูในฉบับร่างไม่ถูกต้อง โปรดกลับไปตรวจสอบข้อความ');
    ids.add(row.id);
  }
  for(const value of Object.values(review.summaryEdits??{}))if(value!=null&&(!Number.isFinite(value)||value<0))throw Error('ข้อมูลปรับยอดในฉบับร่างไม่ถูกต้อง');
  for(const key of ['service_charge','vat','discount']){
    const source=review.summarySource?.[key];
    if(source!=null&&(!['amount','percent'].includes(source.mode)||!Number.isFinite(source.value)||source.value<0||(source.extraAmountSum!=null&&(!Number.isFinite(source.extraAmountSum)||source.extraAmountSum<0))))throw Error('ข้อมูลปรับยอดในฉบับร่างไม่ถูกต้อง');
  }
  if(!['rate','amount'].includes(review.discountCanonical)||!['input','results'].includes(review.page)||!['append','replace'].includes(review.importMode)||!['all','none'].includes(review.importAssignments))throw Error('ตัวเลือกในฉบับร่างไม่ถูกต้อง');
  if(review.page==='results'&&(typeof review.draft?.id!=='string'||!review.draft.id||typeof review.draft?.group?.id!=='string'))throw Error('ไม่พบข้อมูลใบเสร็จเดิม โปรดกลับไปแยกเมนูอีกครั้ง');
  const view=receiptSummary(reviewSubtotal(review),review.summarySource,review.summaryEdits,review.discountCanonical);
  if(![view.total,view.service_charge.amount,view.vat.amount,view.discount.amount].every(v=>Number.isFinite(v)&&v>=0))throw Error('ยอดฉบับร่างไม่ถูกต้อง โปรดตรวจสอบรายการและส่วนลด');
}

export function normalizeReviewDraft(saved){
  if(saved?.schema!==3)throw Error('รุ่นฉบับร่างไม่รองรับ เก็บข้อความไว้แล้วแยกเมนูอีกครั้ง');
  if(typeof saved.billId!=='string'||!saved.billId||!Number.isSafeInteger(saved.baseRevision)||saved.baseRevision<1)throw Error('ฉบับร่างไม่มีข้อมูลบิลที่ถูกต้อง');
  const review={schema:3,billId:saved.billId,baseRevision:saved.baseRevision,raw:saved.raw,rows:clone(saved.rows),summarySource:clone(saved.summarySource??{}),summaryEdits:clone(saved.summaryEdits??{}),discountCanonical:saved.discountCanonical??'amount',colOrder:clone(saved.colOrder??['unit_price','line_total']),importMode:saved.importMode??'append',importAssignments:saved.importAssignments??'all',page:saved.page??'input',draft:clone(saved.draft??null)};
  if(!sameColumns(review.colOrder))throw Error('ลำดับคอลัมน์ในฉบับร่างไม่ถูกต้อง');
  validateReview(review);return {review,notices:[]};
}
function sameColumns(columns){return Array.isArray(columns)&&columns.length===2&&new Set(columns).size===2&&columns.every(c=>['unit_price','line_total'].includes(c));}

export function buildReviewedDraft(review){
  validateReview(review);const draft=clone(review.draft),rows=review.rows.filter(r=>!r.isDiscount);
  if(!rows.length)throw Error('ยังไม่มีเมนูให้เพิ่ม');
  draft.items=rows.map(r=>({id:r.id,groupId:draft.group.id,name:r.itemName,quantity:r.qty,priceSource:r.priceSource,priceCents:Math.round(r.priceValue*100),assignments:[],rawLine:r.rawLine??''}));
  const view=receiptSummary(reviewSubtotal(review),review.summarySource,review.summaryEdits,review.discountCanonical);
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
// A deliberate repeat is a new import, while retries reuse this one copy.
export function copyReceiptForImport(draft){
  const next=clone(draft);next.id=newId();next.group.id=newId();
  next.items=next.items.map(item=>({...item,id:newId(),groupId:next.group.id}));
  return next;
}
function parseDraft(raw,{id=newId}={}){
  if(typeof raw!=='string'||raw.length>100000)throw Error('ข้อความใบเสร็จยาวเกินไป');
  const normalized=raw.replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-0x0e50)).replace(/\u0e4d\u0e32/g,'ำ');
  const parsed=parseReceipt(normalized),groupId=id(),group={id:groupId,name:'ใบเสร็จ',...adjustment()};
  // Legacy filters can discard valid generic food names. Retain plausible omitted
  // price lines for explicit review rather than treating them as certain items.
  const compact=line=>line.replace(/\s+/g,' ').trim();
  const parsedEvidence=parsed.rows.map(r=>compact(r.rawLine));
  for(const line of normalized.split(/\r?\n/).map(l=>l.trim()).filter(Boolean)){
    if(!/\p{L}/u.test(line)||!/[\d,]+\.\d{2}\s*$/.test(line)||parsedEvidence.some(rawLine=>rawLine.includes(compact(line))))continue;
    if(/^(?:service|svc|sc\b|vat|tax|subtotal|total|grand|net|cash|change|discount|ส่วนลด|ค่าบริการ|ภาษี|รวม|ยอด|สุทธิ|เงินสด|เงินทอน|โทร|tel|date|วันที่|เวลา|เลขที่|ถนน|ที่อยู่)/i.test(line))continue;
    const row=parseItemLine(line,null);row.needsReview=true;row.flags.push({type:'recovered_line',msg:'พบรายการที่ต้องตรวจสอบ'});parsed.rows.push(row);
  }
  const source=parsed.summarySource;
  for(const [key,field] of [['service','service_charge'],['tax','vat'],['discount','discount']]){
    const a=source[field];if(a)group[key]={...group[key],enabled:true,kind:a.mode==='percent'?'rate':'fixed',value:a.mode==='percent'?Math.round(a.value*100):cents(a.value.toFixed(2))};
  }
  if(source.vat)group.tax.treatment='unknown';
  const totalLines=normalized.split(/\r?\n/).filter(l=>/^\s*(?:grand\s*total|net\s*total|total|ยอดชำระสุทธิ|ยอดสุทธิ|ยอดรวมสุทธิ|รวมทั้งสิ้น|ยอดรวมทั้งสิ้น|รวมทั้งหมด|ยอดรวม)\s*[:：]?\s*(?:฿|\$|THB|บาท)?\s*[\d,]+(?:\.\d{1,2})?\s*(?:บาท|฿)?\s*$/i.test(l));
  if(totalLines.length){const match=totalLines.at(-1).match(/([\d,]+(?:\.\d{1,2})?)\s*(?:บาท|฿)?\s*$/);group.printedTotalCents=cents(match[1]);}
  const items=parsed.rows.filter(r=>!r.isDiscount).map(r=>({id:id(),groupId,name:r.itemName,quantity:r.qty,priceSource:r.priceSource,priceCents:cents(r.priceValue.toFixed(2)),assignments:[],needsReview:r.needsReview,rawLine:r.rawLine,flags:r.flags}));
  const notices=[];
  if(source.discount?.extraAmountSum){
    const subtotal=items.reduce((s,r)=>s+(r.priceSource==='line_total'?r.priceCents:r.priceCents*r.quantity),0)/100;
    const edits=initializeSummaryEdits(subtotal,source);
    const result=receiptSummary(subtotal,source,edits,'rate');
    group.discount={kind:'fixed',enabled:true,value:cents(result.discount.amount.toFixed(2))};
    notices.push('พบส่วนลดหลายรูปแบบ กรุณาตรวจสอบยอดส่วนลดรวม');
  }
  const draft={id:id(),raw,group,items,notices};
  const check=emptyBill();check.groups.push(group);check.items=items;validateBill(check);
  return {draft,summarySource:source};
}

export function createDraft(raw,options){
  return parseDraft(raw,options).draft;
}
export function createReceiptReview(raw){
  const {draft,summarySource}=parseDraft(raw);
  const rows=draft.items.map(item=>({
    id:item.id,rawLine:item.rawLine,itemName:item.name,qty:item.quantity,
    priceSource:item.priceSource,priceValue:item.priceCents/100,
    needsReview:item.needsReview,flags:item.flags||[],isDiscount:false
  }));
  return {draft,rows,summarySource};
}
