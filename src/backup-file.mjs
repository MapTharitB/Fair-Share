import {billName} from './bill-repository.mjs';
import {admittedBill} from './bill-admission.mjs';
export function decodeBillFile(raw){
  let value;try{value=JSON.parse(raw);}catch{throw Error('เปิดไฟล์นี้ไม่ได้ เลือกไฟล์สำรองที่ดาวน์โหลดจาก หารจ่ายแฟร์ๆ');}
  if(value?.format!=null){
    if(value.format!=='fairshare-bill'||value.version!==1)throw Error('รุ่นไฟล์บิลไม่รองรับ');
    return {name:billName(value.name),bill:admittedBill(value.bill)};
  }
  return {name:null,bill:admittedBill(value)};
}
export async function readBillFile(file){if(file.size>10000000)throw Error('ไฟล์ใหญ่เกินไป เลือกไฟล์สำรองขนาดไม่เกิน 10 MB');let raw;try{raw=await file.text();}catch{throw Error('อ่านไฟล์นี้ไม่ได้ ลองเลือกไฟล์อีกครั้ง');}return decodeBillFile(raw);}
export function encodeBillFile({name,bill}){return JSON.stringify({format:'fairshare-bill',version:1,name:billName(name),bill:admittedBill(bill)},null,2);}
export function billFilename(name,extension='json'){return 'หารจ่ายแฟร์ๆ-'+name.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,100)+'-'+new Date().toISOString().slice(0,10)+'.'+extension;}
export function validateApprovedBackup(raw){return decodeBillFile(raw).bill;}
