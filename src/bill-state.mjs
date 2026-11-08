// Current application contract. Legacy extraction modules remain comparison references.
import {normalizeAssignmentLocks,allocationOvercommitted} from './item-allocation.mjs';
const VERSION=1;
export function newId(random=globalThis.crypto){
  if(typeof random.randomUUID==='function')return random.randomUUID();
  // getRandomValues also works on a local HTTP device preview. Keep UUID v4
  // randomness without relying on the HTTPS-only randomUUID convenience API.
  const bytes=random.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
const copy=v=>structuredClone(v);
export function integer(v,min=0,max=1e12){if(!Number.isSafeInteger(v)||v<min||v>max)throw Error('จำนวนเงินหรือจำนวนรายการไม่ถูกต้อง');return v;}
export function cents(value){
  const text=String(value).replace(/,/g,'').trim();
  if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw Error('กรอกจำนวนเงินไม่เกิน 2 ตำแหน่ง');
  const [a,b='']=text.split('.');return integer(Number(a)*100+Number(b.padEnd(2,'0')));
}
function ratio(amount,numerator,denominator){
  integer(amount);integer(numerator);integer(denominator,1);
  // Integer satang, rounded half up. Rates use hundredths of one percent:
  // 1000 / 10000 is 10%, without a floating-point money intermediate.
  return integer(Number((BigInt(amount)*BigInt(numerator)*2n+BigInt(denominator))/(2n*BigInt(denominator))));
}
export const money=c=>(c/100).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
export const adjustment=()=>({service:{kind:'rate',value:1000,enabled:false},tax:{kind:'rate',value:700,enabled:false,treatment:'excluded'},discount:{kind:'fixed',value:0,enabled:false},placement:'after_sc_vat',serviceDist:'equal',discountDist:'equal'});
export const emptyBill=()=>({version:VERSION,revision:0,people:[],items:[],groups:[{id:'manual',name:'รายการที่เพิ่มเอง',...adjustment()}],imports:[],undo:null});
export function itemTotal(item){return item.priceSource==='line_total'?item.priceCents:integer(item.priceCents*item.quantity);}
const text=(v,max=200)=>{if(typeof v!=='string'||v.length>max)throw Error('ข้อมูลข้อความไม่ถูกต้อง');return v;};
const unique=values=>{if(new Set(values).size!==values.length)throw Error('พบรหัสซ้ำในข้อมูล');};
export function validateBill(b,{undo=true}={}){
  if(!b||b.version!==VERSION)throw Error('รุ่นข้อมูลไม่รองรับ');integer(b.revision);
  for(const key of ['people','items','groups','imports'])if(!Array.isArray(b[key])||b[key].length>10000)throw Error('รูปแบบข้อมูลไม่ถูกต้อง');
  if(!b.groups.length)throw Error('ไม่พบข้อมูลการปรับยอดบิล');
  for(const list of [b.people,b.items,b.groups]){list.forEach(x=>{if(!text(x.id,100))throw Error('ไม่มีรหัสรายการ');});unique(list.map(x=>x.id));}
  const people=new Set(b.people.map(p=>{text(p.name,100);if(!p.name.trim())throw Error('กรอกชื่อผู้ร่วมจ่าย');return p.id;}));
  const groups=new Set(b.groups.map(g=>g.id));
  b.groups.forEach(g=>{
    text(g.name);if(!['before_sc_vat','after_sc_vat'].includes(g.placement))throw Error('ลำดับส่วนลดไม่ถูกต้อง');
    for(const k of ['serviceDist','discountDist'])if(!['equal','proportional'].includes(g[k]))throw Error('วิธีแบ่งค่าใช้จ่ายไม่ถูกต้อง');
    for(const k of ['service','tax','discount']){const a=g[k];if(!a||!['rate','fixed'].includes(a.kind)||typeof a.enabled!=='boolean')throw Error('ข้อมูลค่าบริการไม่ถูกต้อง');integer(a.value,0,a.kind==='rate'?10000:1e12);}
    if(!['included','excluded','unknown'].includes(g.tax.treatment))throw Error('ข้อมูลภาษีไม่ถูกต้อง');
    if(g.printedTotalCents!=null)integer(g.printedTotalCents);
  });
  b.items.forEach(it=>{
    text(it.name);integer(it.quantity,1,99);integer(it.priceCents);
    if(!['line_total','unit_price'].includes(it.priceSource)||!groups.has(it.groupId))throw Error('ข้อมูลราคาหรือใบเสร็จไม่ถูกต้อง');
    if(!Array.isArray(it.assignments))throw Error('ข้อมูลผู้ร่วมจ่ายไม่ถูกต้อง');unique(it.assignments.map(a=>a.personId));
    let locked=0;
    for(const a of it.assignments){
      if(!people.has(a.personId)||typeof a.locked!=='boolean')throw Error('ไม่พบผู้ร่วมจ่ายของรายการ');integer(a.amountCents);if(a.locked)locked+=a.amountCents;
      if(Object.hasOwn(a,'lockMode')&&!['amount','percentage'].includes(a.lockMode))throw Error('รูปแบบการล็อกไม่ถูกต้อง');
      if(a.lockMode==='percentage')integer(a.lockPercentUnits,0,1000000);
      if(a.lockMode!=='percentage'&&Object.hasOwn(a,'lockPercentUnits'))throw Error('ข้อมูลการล็อกไม่ถูกต้อง');
    }
    if(locked>itemTotal(it)||allocationOvercommitted(it))throw Error('ยอดที่ล็อกไว้เกินราคารายการ');
  });
  b.imports.forEach(x=>text(x,100));unique(b.imports);
  if(b.undo!=null){if(!undo||!b.undo.before)throw Error('ข้อมูลย้อนกลับไม่ถูกต้อง');validateBill(b.undo.before,{undo:false});integer(b.undo.atRevision);}
  return b;
}
export function normalizeBillPolicy(b){
  validateBill(b);const next=copy(b);
  const map=bill=>{bill.groups.forEach(g=>{g.placement='after_sc_vat';});bill.items=bill.items.map(normalizeAssignmentLocks);if(bill.undo)map(bill.undo.before);};
  map(next);return next;
}
// Exact largest-remainder allocation; ties follow stored participant order.
export function allocate(total,weights){
  weights.forEach(w=>integer(w));integer(weights.reduce((a,b)=>a+b,0));
  return allocateWeights(total,weights);
}
function allocateWeights(total,weights){
  integer(total);
  const denominator = weights.reduce((sum, weight) => sum + BigInt(weight), 0n);
  if (!denominator) return weights.map(() => 0);
  const parts = weights.map((weight, index) => {
    const numerator = BigInt(total) * BigInt(weight);
    return {index, amount: Number(numerator / denominator), remainder: numerator % denominator};
  });
  let remaining = total - parts.reduce((sum, part) => sum + part.amount, 0);
  const remainderOrder = [...parts].sort((a, b) => a.remainder === b.remainder
    ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const part of remainderOrder) {
    if (remaining-- <= 0) break;
    part.amount++;
  }
  return parts.map(part => part.amount);
}
export function shares(it){
  const total = itemTotal(it);
  const assignments = it.assignments;
  const locked = assignments.reduce((sum, assignment) => sum + (assignment.locked ? assignment.amountCents : 0), 0);
  if (locked > total) throw Error('ยอดที่ล็อกไว้เกินราคารายการ');
  const unlocked = assignments.filter(assignment => !assignment.locked);
  const amounts = allocate(total - locked, unlocked.map(() => 1));
  let index = 0;
  return assignments.map(assignment => ({
    personId: assignment.personId,
    amountCents: assignment.locked ? assignment.amountCents : amounts[index++]
  }));
}
export function calculate(bill) {
  validateBill(bill);
  const totals = Object.fromEntries(bill.people.map(person => [person.id, {
    subtotal: 0, service: 0, tax: 0, discount: 0, total: 0
  }]));
  let subtotal = 0, grand = 0, unallocated = 0;
  const groups = [], warnings = [];
  for (const group of bill.groups) {
    const base = bill.people.map(() => 0);
    let full = 0;
    for (const item of bill.items.filter(item => item.groupId === group.id)) {
      full = integer(full + itemTotal(item));
      for (const assignment of shares(item)) {
        const index = bill.people.findIndex(person => person.id === assignment.personId);
        base[index] += assignment.amountCents;
      }
    }
    const missing = full - base.reduce((sum, amount) => sum + amount, 0);
    base.push(missing);
    const amount = (adjustment, basis) => !adjustment.enabled ? 0
      : adjustment.kind === 'fixed' ? adjustment.value : ratio(basis, adjustment.value, 10000);
    const equalWeights = values => {
      const sum = values.reduce((total, value) => total + value, 0);
      const missing = values.at(-1);
      // Reserve the unallocated fraction before equal distribution to people.
      // BigInt weights prevent overflow even when the participant count is large.
      return bill.people.length
        ? [...bill.people.map(() => sum - missing), BigInt(missing) * BigInt(bill.people.length)] : [1];
    };
    const split = (total, weights) => allocateWeights(total, weights.some(weight => weight > 0)
      ? weights : weights.map((_, index) => index === weights.length - 1 ? 1 : 0));
    const distribute = (total, values, mode) => split(total, mode === 'equal' ? equalWeights(values) : values);
    // Financial ordering is service, then excluded VAT, then discount.
    const service = amount(group.service, full);
    const services = distribute(service, base, group.serviceDist);
    const vatBase = integer(full + service);
    if (group.tax.enabled && group.tax.treatment === 'unknown') {
      warnings.push('กรุณาตรวจสอบว่าราคารวมภาษีแล้วหรือยัง');
    }
    const vat = group.tax.treatment === 'excluded' ? amount(group.tax, vatBase) : 0;
    const withService = base.map((value, index) => value + services[index]);
    const taxes = split(vat, withService);
    const beforeDiscount = withService.map((value, index) => value + taxes[index]);
    const discount = Math.min(amount(group.discount, vatBase + vat), vatBase + vat);
    const discounts = distribute(discount, beforeDiscount, group.discountDist);
    const final = beforeDiscount.map((value, index) => integer(value - discounts[index], -1e12));
    for (let index = 0; index < bill.people.length; index++) {
      const person = totals[bill.people[index].id];
      person.subtotal = integer(person.subtotal + base[index]);
      person.service = integer(person.service + services[index]);
      person.tax = integer(person.tax + taxes[index]);
      person.discount = integer(person.discount + discounts[index]);
      person.total = integer(person.total + final[index], -1e12);
    }
    const total = integer(vatBase + vat - discount);
    subtotal = integer(subtotal + full);
    grand = integer(grand + total);
    unallocated += final.at(-1);
    groups.push({id: group.id, subtotal: full, service, tax: vat, discount, total,
      difference: group.printedTotalCents == null ? null : total - group.printedTotalCents});
  }
  if (Object.values(totals).some(person => person.total < 0)) {
    warnings.push('ส่วนลดแบบหารเท่าทำให้บางคนมียอดติดลบ ลองเลือกแบ่งส่วนลดตามสัดส่วน');
  }
  if (unallocated) warnings.push('ยังมีรายการที่แบ่งจ่ายไม่ครบ');
  return {subtotal, grand, unallocated, people: totals, groups, warnings: [...new Set(warnings)]};
}
