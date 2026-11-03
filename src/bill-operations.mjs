import {validateBill,emptyBill,calculate} from './bill-state.mjs';
import {recalculateItemAssignments} from './item-allocation.mjs';
const copy=value=>structuredClone(value);
export function isEmptyBillContent(bill){
  if(bill.people.length||bill.items.length||bill.groups.length!==1)return false;
  const current=bill.groups[0],defaults=emptyBill().groups[0];
  if(current.printedTotalCents!=null)return false;
  return ['service','tax','discount'].every(key=>Object.keys(defaults[key]).every(field=>current[key][field]===defaults[key][field]))
    &&['placement','serviceDist','discountDist'].every(key=>current[key]===defaults[key]);
}
function checked(bill){validateBill(bill);calculate(bill);return bill;}
export function clearPeople(bill){
  const next=copy(bill);next.people=[];
  next.items.forEach(item=>{item.assignments=[];});
  return checked(next);
}
export function clearDishes(bill){
  const next=copy(bill);next.items=[];next.groups=emptyBill().groups;
  return checked(next);
}
export function setPersonMenus(bill,personId,selectedItemIds){
  validateBill(bill);
  if(!bill.people.some(p=>p.id===personId))throw Error('ไม่พบรายชื่อคนนี้ในบิล');
  const selected=new Set(selectedItemIds);
  if(selected.size!==selectedItemIds.length||[...selected].some(id=>!bill.items.some(it=>it.id===id)))throw Error('ไม่พบเมนูที่เลือกในบิล');
  const next=copy(bill),changedItemIds=[],removedLockedItemIds=[];
  next.items=next.items.map(item=>{
    const assignment=item.assignments.find(a=>a.personId===personId),wanted=selected.has(item.id);
    if(!!assignment===wanted)return item;
    changedItemIds.push(item.id);
    if(assignment?.locked)removedLockedItemIds.push(item.id);
    if(wanted)item.assignments.push({personId,locked:false,amountCents:0,lockMode:'percentage',lockPercentUnits:0});
    else item.assignments=item.assignments.filter(a=>a.personId!==personId);
    return recalculateItemAssignments(item).item;
  });
  return {bill:checked(next),changedItemIds,removedLockedItemIds};
}
