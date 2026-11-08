import {normalizeBillPolicy, calculate, shares} from './bill-state.mjs';

/** Apply one reviewed receipt. Retries retain draft.id; explicit repeats use a new ID. */
export function importReceipt(bill, draft, {
  mode = 'append', charges = 'receipt', assignmentMode = 'preserve'
} = {}) {
  if (!['append', 'replace'].includes(mode) || !['receipt', 'keep'].includes(charges) ||
      !['preserve', 'all', 'none'].includes(assignmentMode)) {
    throw Error('ตัวเลือกเพิ่มลงบิลไม่ถูกต้อง');
  }
  if (bill.imports.includes(draft.id)) throw Error('นำเข้าใบเสร็จนี้แล้ว');
  const next = structuredClone(bill);
  const before = structuredClone(bill);
  before.undo = null;
  if (mode === 'replace') next.items = [];
  for (const source of draft.items) {
    const item = {...structuredClone(source), groupId: 'manual'};
    if (assignmentMode !== 'preserve') {
      item.assignments = assignmentMode === 'all'
        ? bill.people.map(person => ({personId: person.id, locked: false, amountCents: 0}))
        : [];
      item.assignments = shares(item).map(share => ({...share, locked: false}));
    }
    next.items.push(item);
  }
  if (charges === 'receipt') {
    if (draft.group.tax.enabled && draft.group.tax.treatment === 'unknown') {
      throw Error('กรุณาระบุว่าราคารวมภาษีแล้วหรือยัง');
    }
    next.groups = [{...structuredClone(draft.group), id: 'manual', name: 'บิลปัจจุบัน'}];
  }
  next.imports.push(draft.id);
  next.revision++;
  next.undo = {before, atRevision: next.revision};
  const normalized = normalizeBillPolicy(next);
  calculate(normalized);
  return normalized;
}
