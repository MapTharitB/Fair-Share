import {assertSingleGroup} from './bill-admission.mjs';
import {emptyBill,validateBill,normalizeBillPolicy,calculate,cents,shares,itemTotal} from './bill-state.mjs';
import {normalizeAssignmentLocks,recalculateItemAssignments,allocationOvercommitted} from './item-allocation.mjs';
function approvedItem(it){
  return normalizeAssignmentLocks({id:it.id,name:it.name,groupId:'manual',quantity:it.quantity||1,priceSource:it.authoritativeTotalCents!=null?'line_total':'unit_price',priceCents:it.authoritativeTotalCents??cents((it.price||0).toFixed(2)),assignments:it.assignments.map(a=>({personId:a.personId,locked:!!a.locked,amountCents:Math.round((a.amount||0)*100),...(a.lockMode?{lockMode:a.lockMode,...(a.lockMode==='percentage'?{lockPercentUnits:a.lockPercentUnits}:{})}:{})}))});
}
const percentageOf=(a,total)=>!total?0:a.locked&&a.lockMode==='percentage'?a.lockPercentUnits/10000:a.amountCents/total*100;
function uiAssignments(it){const total=itemTotal(it);return it.assignments.map(a=>({personId:a.personId,locked:a.locked,amount:a.amountCents/100,percentage:percentageOf(a,total),lockMode:a.lockMode,...(a.lockMode==='percentage'?{lockPercentUnits:a.lockPercentUnits}:{})}));}
export function recalculateApprovedItem(item){const result=recalculateItemAssignments(approvedItem(item));return {item:{...structuredClone(item),assignments:uiAssignments(result.item)},overallocated:result.overallocated};}
export const approvedItemOvercommitted=item=>allocationOvercommitted(approvedItem(item));
// Use the same exact item shares for editing, summaries, export and bill totals.
export function approvedShares(item){
  const it=approvedItem(item),total=itemTotal(it);
  const resolved=allocationOvercommitted(it)?it.assignments:shares(it),metadata=new Map(it.assignments.map(a=>[a.personId,a]));
  return Object.fromEntries(resolved.map(a=>[a.personId,{amount:a.amountCents/100,percentage:percentageOf({...metadata.get(a.personId),amountCents:a.amountCents},total)}]));
}
export function approvedState(b){
  b=normalizeBillPolicy(b);
  assertSingleGroup(b);
  const g=b.groups[0],subtotal=b.items.reduce((s,it)=>s+(it.priceSource==='line_total'?it.priceCents:it.priceCents*it.quantity),0);
  function charge(a){const value=a.kind==='rate'?a.value/100:subtotal?a.value/subtotal*100:0;return {enabled:a.enabled,value,...(a.kind==='fixed'?{fixedCents:a.value,displayRate:value}:{})};}
  const tax=charge(g.tax);if(g.tax.treatment==='included'){tax.enabled=false;tax.included=true;tax.includedEnabled=g.tax.enabled;}
  return {people:structuredClone(b.people),items:b.items.map(it=>({id:it.id,name:it.name,price:it.priceSource==='line_total'?Math.round(it.priceCents/it.quantity)/100:it.priceCents/100,quantity:it.quantity,...(it.priceSource==='line_total'?{authoritativeTotalCents:it.priceCents}:{}),assignments:uiAssignments(it)})),service:charge(g.service),tax,discount:{mode:g.discount.kind==='fixed'?'fixed':'percent',value:g.discount.value/100,placement:g.placement},serviceDist:g.serviceDist,discountDist:g.discountDist};
}
export function approvedBill(s,previous=emptyBill()){
  const b=emptyBill();b.revision=previous.revision+1;b.imports=[...previous.imports];b.people=structuredClone(s.people);
  const g=b.groups[0];if(previous.groups.length===1){g.name=previous.groups[0].name;if(previous.groups[0].printedTotalCents!=null)g.printedTotalCents=previous.groups[0].printedTotalCents;}
  function charge(a){return {enabled:!!a.enabled,kind:a.fixedCents!=null&&a.value===a.displayRate?'fixed':'rate',value:a.fixedCents!=null&&a.value===a.displayRate?a.fixedCents:Math.round(a.value*100)};}
  g.service=charge(s.service);g.tax={...charge(s.tax),treatment:s.tax.included&&!s.tax.enabled?'included':'excluded'};
  if(s.tax.included&&!s.tax.enabled)g.tax.enabled=!!s.tax.includedEnabled;
  g.discount={enabled:!!s.discount.value,kind:s.discount.mode==='fixed'?'fixed':'rate',value:Math.round(s.discount.value*100)};g.placement='after_sc_vat';g.serviceDist=s.serviceDist;g.discountDist=s.discountDist;
  b.items=s.items.map(it=>({...structuredClone(previous.items.find(x=>x.id===it.id)||{}),...approvedItem(it)}));
  return validateBill(b);
}
export function approvedTotals(s,previous){
  if(!s.people.length)return null;
  return approvedBillTotals(s,previous);
}
export function approvedBillTotals(s,previous){
  const b=approvedBill(s,previous),r=calculate(b),g=r.groups[0],pt=Object.create(null);
  for(const p of s.people){const n=r.people[p.id];pt[p.id]={subtotal:n.subtotal/100,discount:n.discount/100,service:n.service/100,vat:n.tax/100,total:n.total/100,preDiscount:(n.total+n.discount)/100};}
  return {pt,Sb:r.subtotal/100,D:g.discount/100,discSb:(r.subtotal-g.discount)/100,svcAmt:g.service/100,vatAmt:g.tax/100,grand:r.grand/100,placement:'after_sc_vat',preDiscountTotal:(r.grand+g.discount)/100,unallocated:r.unallocated/100,warnings:r.warnings};
}
