import {cents} from './bill-state.mjs';

// Receipt confirmation accepts whole tokens. Bill expression inputs have a
// different contract and deliberately do not use this boundary.
export const RECEIPT_LIMIT=100000;
export const receiptDigits=value=>String(value).replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-0x0e50));
export function receiptNumber(input,{quantity=false,summary=false}={}){
  if(typeof input!=='string'||input.length>RECEIPT_LIMIT)return null;
  const text=receiptDigits(input).trim();
  if(quantity)return /^\d+$/.test(text)&&Number(text)>=1&&Number(text)<=99?Number(text):null;
  const decimal=summary?'(?:\\.\\d+)?':'(?:\\.\\d{1,2})?';
  if(!new RegExp('^(?:\\d+|\\d{1,3}(?:,\\d{3})+)'+decimal+'$').test(text))return null;
  try{const value=summary?Number(text.replace(/,/g,'')):cents(text)/100;return Number.isFinite(value)&&value<=1e10?value:null;}catch{return null;}
}
export const emptyReceiptEvidence=()=>({sourceLines:[],quantityText:null,unitText:null,totalText:null,unitCents:null,totalCents:null});
export const fieldIssue=(reason,editField,input=null)=>({reason,editField,input});
export function receiptIssueMessage(issue){
  if(issue.rowId&&issue.reason==='unverified')return 'ฉบับร่างเดิมยังไม่ได้ยืนยันตัวเลข เช็กจำนวนและราคา แล้วกด Enter ในแต่ละช่อง';
  if(issue.rowId)return issue.field==='qty'?'เช็กจำนวน แล้วกด Enter เพื่อยืนยัน':'กรอกราคา หรือใส่ 0 ถ้าฟรี แล้วกด Enter เพื่อยืนยัน';
  if(issue.kind)return 'เช็ก '+({vat:'VAT',service_charge:'Service Charge',discount:'ส่วนลด'}[issue.kind])+' แล้วกรอกค่า หรือใส่ 0';
  return issue.message||'ยังไม่มีเมนูให้เพิ่ม';
}
