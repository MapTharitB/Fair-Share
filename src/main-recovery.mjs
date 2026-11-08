/** Main-page recovery policy. The shared notice still owns sheet lifecycle and focus. */
export function createMainRecovery({getSnapshot,getWork,getName,readLibrary,readEvidence,
  retry,open,createCopy,selectBill,exportWork,downloadBill,startNew,selectOther,connect,getConnectionError}) {
  return async function recoveryModel(){
    let snapshot=getSnapshot();
    const id=snapshot.openingTarget?.id??snapshot.billId??snapshot.missingTarget;
    const {library,latest,readable}=await readLibrary(id);
    const uncertain=()=>getSnapshot().pendingOperation?.outcome?.status==='uncertain';
    if(uncertain()){await retry();if(!uncertain())return null;}
    snapshot=getSnapshot();
    if(readable&&snapshot.record&&snapshot.pendingCandidate&&latest?.lastMutationId===snapshot.pendingCandidate.mutationId){
      if(await retry())return null;
    }
    if(snapshot.openingTarget){
      const captured=snapshot.openingTarget;
      return {title:'ไม่สามารถเปิดบิลได้',message:'บิลที่เลือกยังเปิดไม่ได้ รายการในหน้านี้ยังอยู่',actions:[
        {label:'เปิดบิลที่เลือก',id:'reload-bill',run:()=>open(captured.id,captured.targetView,{reason:captured.reason})},
        ...(snapshot.record?[{label:'ดาวน์โหลดบิลในหน้านี้',id:'export-unsaved',run:exportWork}]:[])
      ]};
    }
    const missing=readable&&id&&!latest;
    let candidate=null,name=getName();
    try{if(snapshot.record)candidate=getWork();}catch{}
    if(!candidate&&!snapshot.record){const recovered=await readEvidence(id);if(recovered){candidate=recovered.bill;name=recovered.name??name;}}
    const actions=[];
    const add=(label,id,run)=>actions.push({label,id,run});
    if(candidate&&library&&!uncertain()&&(missing||!snapshot.record))add('บันทึกเป็นบิลใหม่','recover-copy',()=>createCopy(candidate,name));
    if(snapshot.record||candidate)add(candidate?'ดาวน์โหลดบิล':'ดาวน์โหลดรายการที่ยังกรอกไม่ครบ','export-unsaved',()=>{
      if(candidate)downloadBill(candidate,name);else exportWork();
    });
    if(library&&!uncertain()){
      if(!snapshot.record&&latest)add('เปิดบิล','recover-open',()=>open(latest.id));
      if(snapshot.record&&latest&&latest.recordRevision===snapshot.record.recordRevision&&snapshot.pendingCandidate&&snapshot.outcome!=='uncertain'){
        add('บันทึกอีกครั้ง','retry-save',retry);
      }else if(snapshot.record&&latest)add('เปิดบิลล่าสุด','reload-bill',()=>selectBill(snapshot.billId));
      if(library.records.some(record=>record.id!==id))add('เลือกบิลอื่น','recover-select',selectOther);
      if(!snapshot.record)add('สร้างบิลใหม่','recover-new',()=>startNew(true));
      if(snapshot.record&&!readable)add('ลองเชื่อมต่ออีกครั้ง','recover-connect',connect);
    }else if(uncertain())add('ลองตรวจสอบอีกครั้ง','retry-operation',retry);
    else if(getConnectionError()!=='VersionError')add('ลองเชื่อมต่ออีกครั้ง','recover-connect',connect);
    const conflict=readable&&snapshot.record&&latest&&latest.recordRevision!==snapshot.record.recordRevision;
    return {title:missing?(candidate?'ไม่พบข้อมูลบิลเดิม':'ไม่สามารถเปิดบิลได้'):conflict?'บิลมีการเปลี่ยนแปลง':snapshot.record?'ไม่สามารถบันทึกบิลได้ขณะนี้':'ไม่สามารถเปิดบิลได้',
      message:missing?(candidate?'บันทึกรายการที่มีอยู่เป็นบิลใหม่เพื่อทำต่อ':'ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์'):conflict?'บิลถูกแก้ไขจากหน้าอื่น ดาวน์โหลดสิ่งที่แก้ไว้ก่อนเปิดบิลล่าสุด':uncertain()?'ยังยืนยันการบันทึกไม่ได้ รายการที่มีอยู่ยังแสดงในหน้านี้':candidate?'ดาวน์โหลดบิลเพื่อบันทึกรายการที่มีอยู่ก่อนปิดหน้านี้':'ไม่สามารถเข้าถึงข้อมูลบิลได้ขณะนี้',actions};
  };
}
