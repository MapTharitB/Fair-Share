// Current application contract. Legacy extraction modules remain comparison references.
import {normalizeAssignmentLocks,allocationOvercommitted} from './item-allocation.mjs';
export const VERSION=1;
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
export function ratio(amount,numerator,denominator){
  integer(amount);integer(numerator);integer(denominator,1);
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
  integer(total);weights.forEach(w=>integer(w));
  const sum=weights.reduce((a,b)=>a+b,0);integer(sum);
  if(!sum)return weights.map(()=>0);
  const den=BigInt(sum),parts=weights.map((w,i)=>({i,n:Number(BigInt(total)*BigInt(w)/den),r:BigInt(total)*BigInt(w)%den}));
  let rest=total-parts.reduce((s,p)=>s+p.n,0);
  for(const p of [...parts].sort((a,b)=>a.r===b.r?a.i-b.i:a.r>b.r?-1:1)){if(rest--<=0)break;p.n++;}
  return parts.map(p=>p.n);
}
export function shares(it){
  const total=itemTotal(it),as=it.assignments;
  const locked=as.reduce((s,a)=>s+(a.locked?a.amountCents:0),0);
  if(locked>total)throw Error('ยอดที่ล็อกไว้เกินราคารายการ');
  const unlocked=as.filter(a=>!a.locked),amounts=allocate(total-locked,unlocked.map(()=>1));let i=0;
  return as.map(a=>({personId:a.personId,amountCents:a.locked?a.amountCents:amounts[i++]}));
}
export function calculate(b){
  validateBill(b);const totals=Object.fromEntries(b.people.map(p=>[p.id,{subtotal:0,service:0,tax:0,discount:0,total:0}]));
  let subtotal=0,grand=0,unallocated=0;const groups=[];const warnings=[];
  for(const g of b.groups){
    const base=b.people.map(()=>0);let full=0;
    for(const it of b.items.filter(it=>it.groupId===g.id)){
      full=integer(full+itemTotal(it));
      for(const a of shares(it)){const i=b.people.findIndex(p=>p.id===a.personId);base[i]+=a.amountCents;}
    }
    const missing=full-base.reduce((s,n)=>s+n,0);base.push(missing);
    const amount=(a,n)=>!a.enabled?0:a.kind==='fixed'?a.value:ratio(n,a.value,10000);
    const equalWeights=values=>{
      const sum=values.reduce((s,n)=>s+n,0),miss=values.at(-1);
      // Reserve the unallocated fraction before equal distribution to people.
      return b.people.length?[...b.people.map(()=>sum-miss),miss*b.people.length]:[1];
    };
    const split=(n,weights)=>allocate(n,weights.some(w=>w>0)?weights:weights.map((_,i)=>i===weights.length-1?1:0));
    const distribute=(n,values,mode)=>split(n,mode==='equal'?equalWeights(values):values);
    const svc=amount(g.service,full),services=distribute(svc,base,g.serviceDist);
    const vatBase=integer(full+svc);
    if(g.tax.enabled&&g.tax.treatment==='unknown')warnings.push('กรุณาตรวจสอบว่าราคารวมภาษีแล้วหรือยัง');
    const vat=g.tax.treatment==='excluded'?amount(g.tax,vatBase):0;
    const withService=base.map((n,i)=>n+services[i]),taxes=split(vat,withService);
    const pre=withService.map((n,i)=>n+taxes[i]);
    const afterCut=Math.min(amount(g.discount,vatBase+vat),vatBase+vat);
    const ds=distribute(afterCut,pre,g.discountDist);
    const final=pre.map((n,i)=>integer(n-ds[i],-1e12));
    for(let i=0;i<b.people.length;i++){
      const p=totals[b.people[i].id];p.subtotal=integer(p.subtotal+base[i]);p.service=integer(p.service+services[i]);p.tax=integer(p.tax+taxes[i]);p.discount=integer(p.discount+ds[i]);p.total=integer(p.total+final[i],-1e12);
    }
    const total=integer(vatBase+vat-afterCut);subtotal=integer(subtotal+full);grand=integer(grand+total);unallocated+=final.at(-1);
    groups.push({id:g.id,subtotal:full,service:svc,tax:vat,discount:afterCut,total,difference:g.printedTotalCents==null?null:total-g.printedTotalCents});
  }
  if(Object.values(totals).some(p=>p.total<0))warnings.push('ส่วนลดแบบหารเท่าทำให้บางคนมียอดติดลบ ลองเลือกแบ่งส่วนลดตามสัดส่วน');
  if(unallocated)warnings.push('ยังมีรายการที่แบ่งจ่ายไม่ครบ');
  return {subtotal,grand,unallocated,people:totals,groups,warnings:[...new Set(warnings)]};
}
export function editBill(b,change){const next=copy(b);next.undo=null;change(next);next.revision++;return normalizeBillPolicy(next);}
export function previewImport(b,draft,{mode='append'}={}){
  validateBill(b);if(!draft||!draft.id||!['append','replace'].includes(mode))throw Error('ข้อมูลนำเข้าไม่ถูกต้อง');
  if(b.imports.includes(draft.id))throw Error('นำเข้าใบเสร็จนี้แล้ว');
  const next=copy(b);next.undo=null;
  if(mode==='replace'){next.items=[];next.groups=next.groups.filter(g=>g.id==='manual');}
  next.groups.push(copy(draft.group));next.items.push(...copy(draft.items));next.imports.push(draft.id);next.revision++;
  const normalized=normalizeBillPolicy(next);return {next:normalized,summary:calculate(normalized),mode};
}
export function commitImport(b,draft,options){if(draft.group.tax.enabled&&draft.group.tax.treatment==='unknown')throw Error('กรุณาเลือกการคิดภาษีก่อนนำเข้า');const {next}=previewImport(b,draft,options);const before=copy(b);before.undo=null;next.undo={before,atRevision:next.revision};return normalizeBillPolicy(next);}
export function undoImport(b){
  validateBill(b);if(!b.undo||b.undo.atRevision!==b.revision)throw Error('ย้อนกลับไม่ได้หลังจากแก้ไขบิลแล้ว');
  const next=copy(b.undo.before);next.revision=b.revision+1;next.imports=[...b.imports];next.undo=null;return normalizeBillPolicy(next);
}
