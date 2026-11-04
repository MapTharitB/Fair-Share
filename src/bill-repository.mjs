import {emptyBill,normalizeBillPolicy,calculate} from './bill-state.mjs';
import {approvedState} from './approved-ui-bridge.mjs';
import {sameValue} from './history.mjs';

export const DATABASE='fairshare';
export const DEVELOPMENT_BILL_KEYS=['fairshare.v1','fairshare.v1.backup','fairshare.v1.pending','fairshare.v1.damaged'];
export function billName(value){
  if(typeof value!=='string'||!value.trim())throw Error('กรอกชื่อบิล');
  const name=value.trim();
  if(name.length>100)throw Error('ชื่อบิลยาวได้ไม่เกิน 100 ตัวอักษร');
  return name;
}
export function admittedBill(value){const bill=normalizeBillPolicy(value);approvedState(bill);calculate(bill);return bill;}
const clone=value=>structuredClone(value);
const missing=()=>({status:'missing',message:'ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์'});
const uncertain=()=>({status:'uncertain',message:'ยังยืนยันผลการบันทึกไม่ได้ ดาวน์โหลดสิ่งที่แก้ไว้ก่อนปิดหน้านี้'});
const errorMessage=error=>({
  QuotaExceededError:'พื้นที่บันทึกไม่พอ ดาวน์โหลดสิ่งที่แก้ไว้แล้วลองอีกครั้ง',
  SecurityError:'เปิดข้อมูลในเบราว์เซอร์ไม่ได้ เช็กการอนุญาตให้บันทึกข้อมูลแล้วลองอีกครั้ง',
  NotAllowedError:'เปิดข้อมูลในเบราว์เซอร์ไม่ได้ เช็กการอนุญาตให้บันทึกข้อมูลแล้วลองอีกครั้ง',
  AbortError:'การบันทึกถูกยกเลิก ลองอีกครั้ง',
  InvalidStateError:'ไม่สามารถบันทึกบิลได้ขณะนี้',
  VersionError:'ไม่สามารถเปิดข้อมูลบิลด้วยแอปรุ่นนี้',
  UnknownError:'เปิดข้อมูลไม่ได้ ลองอีกครั้งหรือดาวน์โหลดข้อมูลเดิมก่อน'
}[error?.name]||error?.message||'เปิดข้อมูลในเบราว์เซอร์ไม่ได้ ลองอีกครั้ง');
function checkRecord(record){
  if(!record||typeof record.id!=='string'||!record.id||record.id.length>100||billName(record.name)!==record.name||!Number.isSafeInteger(record.createdAt)||!Number.isSafeInteger(record.updatedAt)||!Number.isSafeInteger(record.recordRevision)||record.recordRevision<1||typeof record.lastMutationId!=='string')throw Error('ข้อมูลบิลที่บันทึกไว้ไม่ครบ');
  if(!Number.isFinite(new Date(record.createdAt).getTime())||!Number.isFinite(new Date(record.updatedAt).getTime()))throw Error('วันที่ของบิลไม่ถูกต้อง');
  admittedBill(record.bill);
  if(record.previous){billName(record.previous.name);admittedBill(record.previous.bill);}
  return record;
}
function classify(values){
  const records=[],damaged=[];
  for(const raw of values){
    try{records.push(checkRecord(raw));}
    catch(error){damaged.push({id:raw.id,raw,message:error.message});}
  }
  records.sort((a,b)=>b.updatedAt-a.updatedAt||a.id.localeCompare(b.id));
  return {records,damaged};
}
function automaticName(values,allowSeparate){
  const used=new Set();
  for(const {name} of values){
    try{used.add(billName(name));}
    catch{if(!allowSeparate)return null;}
  }
  let number=1;
  while(used.has('ร้านอาหาร '+number))number++;
  return 'ร้านอาหาร '+number;
}
function validateIdentity(id,mutationId){
  if(typeof id!=='string'||!id||id.length>100||typeof mutationId!=='string'||!mutationId)throw Error('ข้อมูลการบันทึกไม่ครบ');
}
function sourceAttention(storage){
  try{
    if(!storage)throw Error('เปิดข้อมูลเดิมไม่ได้');
    if(DEVELOPMENT_BILL_KEYS.some(key=>storage.getItem(key)!==null))return 'พบข้อมูลเดิมในเบราว์เซอร์ ตรวจสอบหรือดาวน์โหลดก่อนเริ่ม';
    return '';
  }catch(error){return errorMessage(error);}
}

export async function openBillRepository({indexedDB=globalThis.indexedDB,developmentStorage,clock=Date.now}={}){
  if(!indexedDB)throw Error('เบราว์เซอร์นี้เปิดที่บันทึกบิลไม่ได้');
  let db,closed=false,connecting=null,channel,connectionError=null;
  function connect(){
    if(closed)return Promise.reject(Error('ไม่สามารถบันทึกบิลได้ขณะนี้'));
    if(connecting)return connecting;
    connecting=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);let rejected=false;
    const timer=setTimeout(()=>{rejected=true;reject(Error('ไม่สามารถเปิดบิลได้ขณะนี้'));},4000);
    request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('bills',{keyPath:'id'});db.createObjectStore('meta',{keyPath:'key'});};
    request.onsuccess=()=>{clearTimeout(timer);if(rejected||closed){request.result.close();reject(Error('ไม่สามารถบันทึกบิลได้ขณะนี้'));}else{
      db=request.result;connectionError=null;
      const connection=db;
      const disconnect=()=>{connection.close();if(db===connection)db=null;};
      connection.onclose=()=>{if(db===connection)db=null;};
      connection.onversionchange=()=>{disconnect();if(globalThis.window)window.dispatchEvent(new Event('fairshare-storage-versionchange'));};
      resolve(db);
    }};
    request.onerror=()=>{clearTimeout(timer);reject(request.error);};
    request.onblocked=()=>{clearTimeout(timer);rejected=true;reject(Error('ไม่สามารถเปิดบิลได้ขณะนี้'));};
    }).catch(error=>{connectionError=error.name;throw Object.assign(Error(errorMessage(error)),{code:error.name});}).finally(()=>{connecting=null;});
    return connecting;
  }
  await connect();
  try{if(globalThis.window&&globalThis.BroadcastChannel)channel=new BroadcastChannel('fairshare-library');}catch{}
  function close(){closed=true;db?.close();db=null;channel?.close();}

  async function transaction(stores,mode,work){
    let prepared;
    try{
      if(closed)throw Error('ไม่สามารถบันทึกบิลได้ขณะนี้');
      const connection=db??await connect();
      try{prepared=connection.transaction(stores,mode);}
      catch(error){
        if(error.name!=='InvalidStateError')throw error;
        connection.close();if(db===connection)db=null;
        prepared=(await connect()).transaction(stores,mode);
      }
    }catch(error){throw Object.assign(Error(errorMessage(error)),{known:true});}
    return new Promise((resolve,reject)=>{
      const fail=(error,known)=>reject(Object.assign(Error(errorMessage(error)),{known}));
      let tx,value,failure;
      function abort(error){
        failure=error;
        try{tx.abort();}
        catch{fail(error,false);}
      }
      function receive(request,callback){
        request.onsuccess=()=>{
          try{callback(request.result);}
          catch(error){abort(error);}
        };
      }
      try{
        tx=prepared;
        tx.oncomplete=()=>resolve(value);
        tx.onabort=()=>fail(failure||tx.error||Error('การบันทึกถูกยกเลิก ลองอีกครั้ง'),true);
        work(tx,result=>{value=result;},receive);
      }catch(error){
        if(tx)abort(error);
        else fail(error,true);
      }
    });
  }
  const readRaw=key=>transaction(['bills'],'readonly',(tx,set,receive)=>receive(tx.objectStore('bills').get(key),record=>set(record??null)));
  const readMeta=key=>transaction(['meta'],'readonly',(tx,set,receive)=>receive(tx.objectStore('meta').get(key),entry=>set(entry?.value??null)));
  const announce=(record,kind,id=record.id)=>{
    try{channel?.postMessage({id,recordRevision:record?.recordRevision??null,kind});}catch{}
  };
  const fresh=(id,mutationId,name,bill)=>{
    const now=clock();
    return {id,name,createdAt:now,updatedAt:now,recordRevision:1,lastMutationId:mutationId,bill,previous:null};
  };
  const conflict=record=>({status:'conflict',record,message:'บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดแล้วลองอีกครั้ง'});
  const collision=()=>({status:'conflict',message:'รหัสบิลนี้มีอยู่แล้ว'});
  const attention=message=>({status:'attention',message});

  // Read-back can prove a create or an atomic replacement by its original
  // mutation ID. Absence cannot prove that this tab committed a deletion.
  async function reconcileOperation({id,mutationId,replacementId}){
    try{
      if(replacementId){
        return await transaction(['bills'],'readonly',(tx,set,receive)=>{
          const store=tx.objectStore('bills');
          receive(store.get(id),target=>receive(store.get(replacementId),replacement=>{
            if(!target&&replacement?.lastMutationId===mutationId){
              set({status:'saved',deletedId:id,successor:checkRecord(replacement),createdDefault:true});
            }else set(uncertain());
          }));
        });
      }
      const record=await readRaw(id);
      if(record?.lastMutationId===mutationId)return {status:'saved',record:checkRecord(record),created:true};
    }catch{}
    return uncertain();
  }
  async function mutationFailure(error,args){
    if(error.known!==false)return {status:'failed',message:errorMessage(error)};
    return reconcileOperation(args);
  }

  async function mutate(kind,args){
    try{
      validateIdentity(args.id,args.mutationId);
      const content=args.change?.kind==='content',automatic=args.change?.kind==='rename-default';
      let prepared;
      if(kind==='create')prepared={name:billName(args.name),bill:admittedBill(args.bill)};
      else if(content)prepared={bill:admittedBill(args.change.bill)};
      else if(args.change?.kind==='rename')prepared={name:billName(args.change.name)};
      else if(automatic)prepared={};
      else throw Error('ข้อมูลการเปลี่ยนแปลงไม่ถูกต้อง');
      const result=await transaction(['bills','meta'],'readwrite',(tx,set,receive)=>{
        const store=tx.objectStore('bills'),meta=tx.objectStore('meta');
        receive(store.get(args.id),old=>{
          if(old?.lastMutationId===args.mutationId){set({status:'saved',record:checkRecord(old)});return;}
          if(kind==='create'){
            if(old){set(collision());return;}
            const record=fresh(args.id,args.mutationId,prepared.name,prepared.bill);
            store.add(record);
            meta.put({key:'initialized',value:true});
            set({status:'saved',record});
            return;
          }
          if(!old){set(missing());return;}
          checkRecord(old);
          if(old.recordRevision!==args.expectedRevision){set(conflict(old));return;}
          function save(){
            if(content?sameValue(old.bill,prepared.bill):old.name===prepared.name){set({status:'unchanged',record:old});return;}
            const record={...old,...prepared,recordRevision:old.recordRevision+1,lastMutationId:args.mutationId,updatedAt:clock(),previous:content?{name:old.name,bill:old.bill}:old.previous};
            if(!Number.isSafeInteger(record.recordRevision))throw Error('จำนวนการแก้ไขเกินขอบเขต');
            store.put(record);
            set({status:'saved',record});
          }
          if(automatic)receive(store.getAll(),values=>{
            prepared.name=automaticName(values.filter(record=>record.id!==old.id),false);
            if(!prepared.name){set(attention('มีบิลที่อ่านชื่อไม่ได้ ตรวจสอบข้อมูลเดิมก่อนตั้งชื่อ'));return;}
            save();
          });
          else save();
        });
      });
      if(result.status==='saved')announce(result.record,kind==='write'?args.change.kind:kind,args.id);
      return result;
    }catch(error){return mutationFailure(error,args);}
  }

  async function defaultBill(args,automatic){
    try{
      validateIdentity(args.id,args.mutationId);
      const result=await transaction(['bills','meta'],'readwrite',(tx,set,receive)=>{
        const store=tx.objectStore('bills'),meta=tx.objectStore('meta');
        receive(meta.get('initialized'),initialized=>receive(store.getAll(),values=>receive(meta.get('lastSelected'),last=>{
          const original=values.find(record=>record.id===args.id);
          if(original?.lastMutationId===args.mutationId){set({status:'saved',record:checkRecord(original),created:true});return;}
          if(automatic){
            const {records,damaged}=classify(values);
            if(damaged.some(record=>record.id===last?.value)||(!records.length&&damaged.length)){
              set(attention('มีบิลที่เปิดไม่ได้ เลือกบิลหรือตรวจสอบข้อมูลเดิม'));
              return;
            }
            const record=records.find(record=>record.id===last?.value)??records[0];
            if(record){meta.put({key:'lastSelected',value:record.id});set({status:'selected',record,created:false});return;}
          }
          if(original){set(collision());return;}
          const reason=!initialized?.value&&sourceAttention(developmentStorage);
          const name=automaticName(values,args.allowSeparate);
          if(!args.allowSeparate&&(reason||!name)){set(attention(reason||'มีบิลที่อ่านชื่อไม่ได้ ตรวจสอบข้อมูลเดิมก่อนเริ่ม'));return;}
          const record=fresh(args.id,args.mutationId,name,emptyBill());
          store.add(record);
          meta.put({key:'initialized',value:true});
          meta.put({key:'lastSelected',value:record.id});
          set({status:'saved',record,created:true});
        })));
      });
      if(result.created)announce(result.record,'create');
      return result;
    }catch(error){return mutationFailure(error,args);}
  }

  async function removeAndSelect(args){
    try{
      validateIdentity(args.id,args.mutationId);
      validateIdentity(args.replacementId,args.mutationId);
      if(args.id===args.replacementId)throw Error('รหัสบิลใหม่ต้องต่างจากบิลที่ลบ');
      const result=await transaction(['bills','meta'],'readwrite',(tx,set,receive)=>{
        const store=tx.objectStore('bills'),meta=tx.objectStore('meta');
        receive(store.get(args.id),old=>{
          if(!old){set(missing());return;}
          checkRecord(old);
          if(old.recordRevision!==args.expectedRevision){set(conflict(old));return;}
          store.delete(args.id);
          receive(store.getAll(),values=>receive(meta.get('initialized'),initialized=>{
            const {records,damaged}=classify(values);
            let successor=records[0]??null,createdDefault=false,reason='';
            if(!successor){
              reason=damaged.length?'บิลที่เหลือเปิดไม่ได้ ตรวจสอบข้อมูลเดิม':!initialized?.value&&sourceAttention(developmentStorage);
              if(!reason){
                successor=fresh(args.replacementId,args.mutationId,automaticName(values,false),emptyBill());
                store.add(successor);
                meta.put({key:'initialized',value:true});
                createdDefault=true;
              }
            }
            meta.put({key:'lastSelected',value:successor?.id??null});
            set({status:'saved',deletedId:args.id,successor,createdDefault,attention:reason||undefined});
          }));
        });
      });
      if(result.status==='saved'){
        announce(null,'remove',args.id);
        if(result.createdDefault)announce(result.successor,'create');
      }
      return result;
    }catch(error){return mutationFailure(error,args);}
  }

  return {
    get connectionError(){return connectionError;},
    list:()=>transaction(['bills'],'readonly',(tx,set,receive)=>receive(tx.objectStore('bills').getAll(),values=>set(classify(values)))),
    async read(key){const raw=await readRaw(key);return raw?clone(checkRecord(raw)):null;},
    readRaw,readMeta,create:args=>mutate('create',args),write:args=>mutate('write',args),
    ensureDefault:({id,mutationId})=>defaultBill({id,mutationId},true),
    createDefault:args=>defaultBill(args,false),removeAndSelect,reconcileOperation,
    async writeLastSelected(value){
      try{await transaction(['meta'],'readwrite',(tx,set)=>{tx.objectStore('meta').put({key:'lastSelected',value});set(true);});return true;}
      catch{return false;}
    },
    close
  };
}
