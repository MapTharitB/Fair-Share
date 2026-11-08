import {normalizeBillPolicy, calculate} from './bill-state.mjs';

/** Enforce the current application's one-adjustment-group contract. */
export function assertSingleGroup(bill) {
  if (bill.groups.length !== 1) {
    throw Error('ข้อมูลนี้มีหลายชุดค่าใช้จ่าย กรุณาดาวน์โหลดสำรองก่อนรวมบิล');
  }
}

/** Return an isolated, normalized bill admitted for current storage and history. */
export function admittedBill(value) {
  const bill = normalizeBillPolicy(value);
  assertSingleGroup(bill);
  calculate(bill);
  return bill;
}
