import {billName,DEVELOPMENT_BILL_KEYS} from './bill-repository.mjs';
import {admittedBill} from './bill-admission.mjs';
import {decodeBillFile} from './backup-file.mjs';
import {billHistoryKey,receiptDraftKey} from './bill-work-keys.mjs';

export const DEVELOPMENT_WORK_KEYS=['fairshare.bill-history.v1','fairshare.approved-parser'];

function candidateFor(raw){
  try{return decodeBillFile(raw);}
  catch{
    try{
      const value=JSON.parse(raw);
      if(value?.format==='fairshare-bill'&&value.version===1)return {name:null,bill:admittedBill(value.bill)};
    }catch{}
    return null;
  }
}

export async function readBillEvidence({repository,developmentStorage,sessionStorage,billId}){
  const sources=[],unavailable=[];
  function collect(label,read,admit=false){
    try{
      const raw=read();
      if(raw!=null)sources.push({label,raw,candidate:admit?candidateFor(raw):null});
    }catch{unavailable.push(label);}
  }
  if(!billId){
    const labels=['ข้อมูลบิลเดิม','สำเนาสำรองเดิม','ข้อมูลที่บันทึกค้างไว้','ข้อมูลเดิมที่เปิดไม่ได้'];
    DEVELOPMENT_BILL_KEYS.forEach((key,index)=>collect(labels[index],()=>developmentStorage.getItem(key),true));
  }
  DEVELOPMENT_WORK_KEYS.forEach((key,index)=>collect(index?'ฉบับร่างใบเสร็จเดิม':'ประวัติการแก้ไขเดิม',()=>sessionStorage.getItem(key)));
  if(billId){
    collect('ฉบับร่างใบเสร็จของบิลนี้',()=>sessionStorage.getItem(receiptDraftKey(billId)));
    collect('ประวัติการแก้ไขของบิลนี้',()=>sessionStorage.getItem(billHistoryKey(billId)));
    if(repository){
      let record;
      try{record=await repository.readRaw(billId);}
      catch{unavailable.push('ข้อมูลบิลที่บันทึกไว้');}
      if(record){
        collect('ข้อมูลบิลที่บันทึกไว้',()=>JSON.stringify(record));
        // Validate the bill independently of broken metadata. Keep the raw record too.
        const source=sources.find(source=>source.label==='ข้อมูลบิลที่บันทึกไว้');
        if(source){
          try{
            let name=null;
            try{name=billName(record.name);}catch{}
            source.candidate={name,bill:admittedBill(record.bill)};
          }catch{}
        }
        if(record.previous){
          collect('ข้อมูลก่อนบันทึกครั้งล่าสุด',()=>JSON.stringify({format:'fairshare-bill',version:1,...record.previous}),true);
        }
      }
    }
  }
  return {sources,unavailable};
}
