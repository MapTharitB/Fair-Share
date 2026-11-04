import {newId,emptyBill} from './bill-state.mjs';
import {admittedBill} from './bill-repository.mjs';
import {createHistory,sameValue} from './history.mjs';
export const HISTORY_KEY='fairshare.bill-history.v2:';
const MAX_BYTES=2*1024*1024;
const clone=value=>structuredClone(value);
const content=bill=>{const b=clone(bill);delete b.revision;delete b.undo;delete b.imports;return b;};
const snapshot=(value,imports)=>({...emptyBill(),...clone(value),imports:[...imports],undo:null});
const fits=value=>new TextEncoder().encode(JSON.stringify(value)).length<=MAX_BYTES;
export function purgeBillWork(storage,id){for(const key of [HISTORY_KEY+id,'fairshare.approved-parser.v3:'+id,'fairshare.main-scroll.v2:'+id,'fairshare.ui.v2:'+id])try{storage?.removeItem(key);}catch{}}
export function createBillSession({repository,billId,sessionStorage}){
  let record=null,history=null,persistence='session',blocked=false,busy=false;
  const key=HISTORY_KEY+billId;
  function write(value){try{if(!sessionStorage||!fits(value))return false;const raw=JSON.stringify(value);sessionStorage.setItem(key,raw);return sessionStorage.getItem(key)===raw;}catch{return false;}}
  const envelope=(r=record,h=history)=>({format:2,billId,revision:r.bill.revision,content:content(r.bill),history:h.serialize()});
  function result(status,message){return {status,bill:record&&clone(record.bill),record:record&&clone(record),historyPersistence:persistence,message};}
  async function load(){
    try{
      const next=await repository.read(billId);blocked=false;
      if(!next){blocked=true;return result('missing','ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์');}
      const old=record,oldHistory=history;record=next;history=createHistory(content(next.bill));let restored=false;
      if(oldHistory&&old.bill.revision===next.bill.revision&&sameValue(content(old.bill),content(next.bill))){history=oldHistory;restored=true;}
      try{
        let saved=JSON.parse(sessionStorage?.getItem(key)||'null');
        if(saved?.pending){const p=saved.pending;saved=next.lastMutationId===p.mutationId?p.to:sameValue(content(next.bill),p.from.content)&&next.bill.revision===p.from.revision?p.from:null;}
        if(!restored&&saved?.format===2&&saved.billId===billId&&saved.revision===next.bill.revision&&sameValue(saved.content,content(next.bill))&&fits(saved)){
          const restoredHistory=createHistory(null,{serialized:saved.history});for(const state of saved.history.states)admittedBill(snapshot(state,next.bill.imports));
          if(!sameValue(restoredHistory.current,content(next.bill)))throw Error('ประวัติไม่ตรงกับบิล');history=restoredHistory;restored=true;
        }
      }catch{persistence='memory';}
      persistence=write(envelope())?'session':'memory';
      return result('loaded',old&&old.bill.revision!==next.bill.revision?'บิลเปลี่ยนจากอีกแท็บ ประวัติย้อนกลับของบิลนี้เริ่มใหม่':undefined);
    }catch(error){blocked=true;return result('failed',error.message);}
  }
  async function assertCurrent(){
    const latest=await repository.read(billId);
    if(!latest){blocked=true;throw Error('ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์');}
    if(!record||latest.recordRevision!==record.recordRevision){blocked=true;throw Error('บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดแล้วลองอีกครั้ง');}return clone(latest);
  }
  async function commit(candidate,{baseRevision=record?.recordRevision,kind='edit',mutationId=newId(),timeline}={}){
    if(busy)return result('failed','กำลังบันทึก รอสักครู่');
    if(blocked||!record)return result('conflict','เช็กบิลล่าสุดก่อนบันทึก');
    busy=true;
    try{
      await assertCurrent();if(baseRevision!==record.recordRevision)return result('conflict','บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดแล้วลองอีกครั้ง');
      const next=admittedBill(candidate);next.undo=null;next.imports=[...new Set([...record.bill.imports,...next.imports])];
      if(sameValue(content(next),content(record.bill))&&sameValue(next.imports,record.bill.imports))return result('unchanged');
      next.revision=record.bill.revision+1;admittedBill(next);
      let h=createHistory(null,{serialized:timeline??history.serialize()});if(!timeline)h.record(content(next));
      const pendingRecord={...record,bill:next};
      while(!fits(envelope(pendingRecord,h))&&h.serialize().states.length>1){const s=h.serialize();if(s.cursor>0){s.states.shift();s.cursor--;}else s.states.pop();h=createHistory(null,{serialized:s});}
      const from=envelope(),to=envelope(pendingRecord,h);
      persistence=write({...from,pending:{kind,from,to,mutationId}})?'session':'memory';
      const outcome=await repository.write({id:billId,expectedRevision:baseRevision,mutationId,change:{kind:'content',bill:next}});
      if(!['saved','unchanged'].includes(outcome.status)){if(['conflict','missing','uncertain'].includes(outcome.status))blocked=true;if(outcome.status!=='uncertain')write(from);return result(outcome.status,outcome.message);}
      record=outcome.record;history=h;persistence=write(envelope())?'session':'memory';
      return result(outcome.status,persistence==='session'?undefined:'บิลบันทึกแล้ว แต่ประวัติย้อนกลับอาจหายเมื่อโหลดใหม่');
    }catch(error){return result(blocked?'conflict':'failed',error.message);}finally{busy=false;}
  }
  async function move(direction){if(!history||!(direction==='undo'?history.canUndo:history.canRedo))return result('unchanged');const h=createHistory(null,{serialized:history.serialize()});return commit(snapshot(h[direction](),record.bill.imports),{kind:direction,timeline:h.serialize()});}
  return {load,commit,undo:()=>move('undo'),redo:()=>move('redo'),reconcile:load,assertCurrent,
    get current(){return record&&clone(record.bill);},get record(){return record&&clone(record);},get billId(){return billId;},
    get canUndo(){return !blocked&&!!history?.canUndo;},get canRedo(){return !blocked&&!!history?.canRedo;}};
}
