import {createBillSession,purgeBillWork} from './bill-session.mjs';
import {approvedState} from './approved-ui-bridge.mjs';
import {emptyBill,newId} from './bill-state.mjs';
import {sameValue} from './history.mjs';

// UI projections use stable item/person IDs, and personId for assignments.
// Keep staged paths unless local input changed them after the write began.
function overlayEdits(before,after,staged){
  if(sameValue(before,after))return structuredClone(staged);
  if(Array.isArray(before)&&Array.isArray(after)&&Array.isArray(staged)){
    const key=value=>value.id??value.personId;
    const old=new Map(before.map(value=>[key(value),value])),now=new Map(after.map(value=>[key(value),value]));
    const present=new Set(staged.map(key));
    return [...staged.filter(value=>!old.has(key(value))||now.has(key(value))).map(value=>
      old.has(key(value))&&now.has(key(value))?overlayEdits(old.get(key(value)),now.get(key(value)),value):structuredClone(value)),
      ...after.filter(value=>!present.has(key(value))&&(!old.has(key(value))||!sameValue(old.get(key(value)),value))).map(value=>structuredClone(value))];
  }
  if(before&&after&&staged&&typeof before==='object'&&typeof after==='object'&&typeof staged==='object'){
    const result=structuredClone(staged);
    for(const key of new Set([...Object.keys(before),...Object.keys(after)])){
      if(sameValue(before[key],after[key]))continue;
      if(!Object.hasOwn(after,key))delete result[key];else result[key]=overlayEdits(before[key],after[key],staged[key]);
    }
    return result;
  }
  return structuredClone(after);
}

/** One owner for saved identity, working projection, staged writes and reconciliation.
 * All snapshots are copies. Interaction guards and notifications are DOM-free adapters.
 */
export function createMainBillController({repository,sessionStorage,getInteractionGuards=()=>({}),onChange=()=>{}}) {
  let session=null,working=approvedState(emptyBill()),pendingCandidate=null,pendingOperation=null;
  let opening=false,saving=false,storageBlocked=false,invalidCandidate=false,error='',outcome=null,entryPhase='loading';
  let openingTarget=null,missingTarget=null,generation=0,openRequest=0,savePromise=null,confirmation=null,queued=false,disposed=false;
  const clone=value=>structuredClone(value);
  function getSnapshot(){
    return clone({billId:session?.billId??null,record:session?.record??null,working,pendingCandidate,pendingOperation,
      opening,saving,storageBlocked,invalidCandidate,error,outcome,entryPhase,openingTarget,missingTarget,
      canUndo:!!session?.canUndo,canRedo:!!session?.canRedo,reconciliationQueued:queued});
  }
  function notify(reason,extra={}){if(!disposed)onChange({reason,snapshot:getSnapshot(),...extra});}
  const current=(target,token)=>!disposed&&session===target&&generation===token;
  const uncertain=()=>pendingOperation?.outcome?.status==='uncertain';
  function busyGuards(){const guards=getInteractionGuards();return saving||opening||guards.actionBusy||guards.nameBusy;}
  function editGuards(){const guards=getInteractionGuards();return guards.hasItemSession||guards.hasPeopleDraft||guards.nameDirty||guards.inputFocused||guards.sheetOpen||pendingCandidate||invalidCandidate;}
  function markMissing(id,message){storageBlocked=true;error=message;outcome='missing';missingTarget=id;entryPhase='missing';}
  function accept(result,staged){
    outcome=result.status;
    if(!['saved','unchanged'].includes(result.status)){
      error=result.message;
      if(result.status==='missing')markMissing(session.billId,result.message);
      return false;
    }
    working=staged?overlayEdits(staged.workingAtCommit,working,approvedState(result.bill)):approvedState(result.bill);
    pendingCandidate=null;invalidCandidate=false;error='';
    return true;
  }
  async function open(id,{reason='switch',targetView}={}){
    const request=++openRequest;
    opening=true;notify('save-started');
    try{
      const next=createBillSession({repository,billId:id,sessionStorage});
      const loaded=await next.load();
      if(disposed||openRequest!==request)return false;
      if(loaded.status!=='loaded'){
        const message=reason==='created'?'บันทึกบิลใหม่แล้ว แต่ยังเปิดไม่ได้: '+loaded.message
          :reason==='deleted'?'ลบบิลแล้ว แต่ยังเปิดบิลถัดไปไม่ได้: '+loaded.message:loaded.message;
        if(reason==='created'||reason==='deleted'||session&&loaded.status==='failed')openingTarget={id,targetView,reason,message};
        if(!session){missingTarget=id;storageBlocked=true;entryPhase=loaded.status==='missing'?'missing':'unavailable';}
        error=message;notify('error',{message});return false;
      }
      // Only installation replaces the saved owner. A failed read must leave an
      // in-flight save on the still-active bill able to finish normally.
      generation++;
      session=next;working=approvedState(loaded.bill);storageBlocked=false;invalidCandidate=false;
      error='';outcome=null;entryPhase='ready';openingTarget=null;missingTarget=null;pendingCandidate=null;
      saving=false;savePromise=null;
      notify('opened',{message:loaded.message});
      if(reason==='switch'||reason==='created')await repository.writeLastSelected?.(id);
      return true;
    }finally{if(openRequest===request){opening=false;notify('save-finished');if(queued)queueMicrotask(reconcile);}}
  }
  function editWorking(mutator){const next=clone(working);mutator(next);working=next;return clone(working);}
  async function commit(candidate,options={}){
    if(saving||opening||storageBlocked||uncertain()||!session||disposed)return false;
    const target=session,token=generation;
    const staged={bill:clone(candidate),workingAtCommit:clone(options.workingAtCommit??working),baseRevision:options.baseRevision??target.record.recordRevision,
      mutationId:options.mutationId??newId(),kind:options.kind??'edit',id:target.billId,peopleEdit:clone(options.peopleEdit)};
    pendingCandidate=staged;saving=true;error='';
    savePromise=target.commit(staged.bill,staged);notify('save-started');
    try{
      const result=await savePromise;
      if(!current(target,token))return false;
      const accepted=accept(result,staged);
      notify('save-finished',{accepted,completedPeopleEdit:accepted?staged.peopleEdit:undefined,message:result.message});
      return accepted;
    }finally{
      if(current(target,token)){
        saving=false;savePromise=null;notify('save-finished');
        if(queued)queueMicrotask(reconcile);
      }
    }
  }
  async function moveHistory(direction){
    if(!session||saving||opening||storageBlocked||uncertain())return false;
    const target=session,token=generation;saving=true;
    savePromise=target[direction]();notify('save-started');
    try{
      const result=await savePromise;if(!current(target,token))return false;
      const accepted=accept(result);notify('history-moved',{accepted,message:result.message});return accepted;
    }finally{if(current(target,token)){saving=false;savePromise=null;notify('save-finished');if(queued)queueMicrotask(reconcile);}}
  }
  async function refresh({preserveWorking=false,quiet=false}={}){
    if(!session)return {status:'missing'};
    const target=session,token=generation;
    let retainWorking=false;
    const result=await target.load({canAdopt:next=>{
      if(!current(target,token))return false;
      if(!preserveWorking)return true;
      const guards=getInteractionGuards();
      retainWorking=!!(pendingCandidate||invalidCandidate||guards.hasItemSession||guards.hasPeopleDraft)
        ||!sameValue(working,approvedState(target.record.bill));
      // A clean projection follows the readback. Local work may retain the
      // same baseline, but never gain authority over a newer saved revision.
      return !retainWorking||next.recordRevision===target.record.recordRevision;
    }});
    if(!current(target,token))return {status:'stale'};
    if(result.status==='loaded'){
      if(!retainWorking){
        working=approvedState(result.bill);
        if(outcome!=='uncertain'||result.record.lastMutationId===pendingCandidate?.mutationId){pendingCandidate=null;invalidCandidate=false;}
      }
      if(!pendingCandidate||outcome!=='uncertain')error='';
      storageBlocked=false;notify('reconciled',{changed:true,message:result.message});
    }else if(!quiet){if(result.status==='missing')markMissing(target.billId,result.message);else error=result.message;notify('error');}
    return result;
  }
  async function reconcile(){
    if(disposed||!session)return;
    if(busyGuards()){queued=true;return;}
    queued=false;const target=session,token=generation;
    try{
      const latest=await repository.read(target.billId);
      if(!current(target,token))return;
      if(busyGuards()){queued=true;return;}
      if(!latest){markMissing(target.billId,'ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์');notify('error');return;}
      // A notification may be our own uncertain write, even while an editor or
      // sheet is still open. Prove its identity before reporting a conflict.
      if(pendingCandidate&&latest.lastMutationId===pendingCandidate.mutationId){await confirmCandidate(pendingCandidate,target,token);return;}
      if(latest.recordRevision===target.record.recordRevision){
        if(error&&!pendingCandidate&&!invalidCandidate){error='';storageBlocked=false;notify('reconciled',{changed:false});}
        return;
      }
      if(editGuards()){error='บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนบันทึก';outcome='conflict';notify('error');return;}
      opening=true;notify('save-started');
      try{
        // Read into a candidate owner: a guard that appears during load cannot
        // advance the current session's revision underneath locally edited work.
        const next=createBillSession({repository,billId:target.billId,sessionStorage});
        const result=await next.load();
        if(!current(target,token))return;
        if(getInteractionGuards().actionBusy||getInteractionGuards().nameBusy){queued=true;return;}
        if(editGuards()){error='บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนบันทึก';outcome='conflict';notify('error');return;}
        if(result.status==='loaded'){session=next;working=approvedState(result.bill);error='';notify('reconciled',{changed:true,message:result.message});}
        else{if(result.status==='missing')markMissing(target.billId,result.message);else error=result.message;notify('error');}
      }finally{if(generation===token){opening=false;notify('save-finished');if(queued)queueMicrotask(reconcile);}}
    }catch(caught){if(current(target,token)){error=caught.message;notify('error');}}
  }
  function confirmCandidate(staged,target,token){
    if(confirmation?.staged===staged)return confirmation.promise;
    const job={staged,promise:null};confirmation=job;
    job.promise=(async()=>{
      try{
        const loaded=await target.load({canAdopt:latest=>current(target,token)&&pendingCandidate===staged&&latest.lastMutationId===staged.mutationId});
        if(!current(target,token)||pendingCandidate!==staged)return false;
        if(loaded.status==='loaded'){
          accept({...loaded,status:'saved'},staged);
          notify('save-finished',{accepted:true,completedPeopleEdit:staged.peopleEdit});return true;
        }
        if(loaded.status==='missing')markMissing(staged.id,loaded.message);
        else{error=loaded.message;if(loaded.status==='conflict')outcome='conflict';}
        notify('error');return false;
      }finally{if(confirmation===job)confirmation=null;}
    })();
    return job.promise;
  }
  async function finishOperation(operation,result){
    if(pendingOperation!==operation||disposed)return false;
    pendingOperation=null;
    const selectedElsewhere=operation.kind==='delete'&&session&&session.billId!==operation.id;
    let installed=false;
    if(operation.kind==='delete'){
      purgeBillWork(sessionStorage,result.deletedId);
      if(!selectedElsewhere){
        generation++;session=null;working=approvedState(emptyBill());storageBlocked=true;missingTarget=null;
        if(result.successor)installed=await open(result.successor.id,{reason:'deleted'});
        else{entryPhase='attention';error=result.attention;}
      }
    }else if(result.record){
      installed=await open(result.record.id,{reason:operation.kind==='startup'?'startup':'created'});
    }
    notify('operation-finished',{operation:clone(operation),libraryOutcome:clone(result),installed,selectedElsewhere});
    return installed||selectedElsewhere;
  }
  async function runLibraryOperation(operation,execute){
    pendingOperation=operation;
    const token=generation;
    const holdsOpening=operation.kind==='create';
    if(holdsOpening){opening=true;notify('save-started');}
    let result;
    try{result=await execute(operation);if(result)operation.outcome=result;}
    finally{if(generation===token&&pendingOperation===operation&&holdsOpening){opening=false;notify('save-finished');}}
    if(pendingOperation!==operation||disposed)return result;
    if(result?.status==='reused'){
      pendingOperation=null;
      notify('save-finished');
      return {...result,selectedElsewhere:generation!==token};
    }
    if(generation!==token&&['saved','selected'].includes(result?.status)){
      pendingOperation=null;
      if(operation.kind==='delete')purgeBillWork(sessionStorage,result.deletedId);
      notify('operation-finished',{operation:clone(operation),libraryOutcome:clone(result),installed:false,selectedElsewhere:true});
      return result;
    }
    if(!result){if(operation.outcome?.status!=='uncertain')pendingOperation=null;notify('save-finished');return null;}
    if(['saved','selected'].includes(result.status)){await finishOperation(operation,result);return result;}
    error=result.message;
    if(!session){entryPhase=result.status==='attention'?'attention':'unavailable';storageBlocked=true;}
    if(result.status==='conflict')pendingOperation=null;
    notify('error');return result;
  }
  async function retry(){
    if(uncertain()){
      const operation=pendingOperation;
      const result=await repository.reconcileOperation(operation);
      if(pendingOperation!==operation)return false;
      operation.outcome=result;
      if(result.status==='saved')return finishOperation(operation,result);
      error=result.message;notify('error');return false;
    }
    const staged=pendingCandidate,target=session,token=generation;
    if(!staged||!target)return false;
    const latest=await repository.read(staged.id);
    if(!current(target,token)||pendingCandidate!==staged)return false;
    if(!latest){markMissing(staged.id,'ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์');notify('error');return false;}
    if(latest.lastMutationId===staged.mutationId){
      return confirmCandidate(staged,target,token);
    }
    if(latest.recordRevision!==staged.baseRevision){error='บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนบันทึก';outcome='conflict';notify('error');return false;}
    const loaded=await target.load();if(!current(target,token)||loaded.status!=='loaded')return false;
    storageBlocked=false;return commit(staged.bill,staged);
  }
  return {getSnapshot,get billId(){return session?.billId??null;},
    getRecoveryWorking:()=>pendingCandidate?overlayEdits(pendingCandidate.workingAtCommit,working,approvedState(pendingCandidate.bill)):clone(working),
    editWorking,open,commit,undo:()=>moveHistory('undo'),redo:()=>moveHistory('redo'),runLibraryOperation,retry,reconcile,refresh,
    waitForSave:()=>savePromise??Promise.resolve(),
    reportInvalid(caught){invalidCandidate=true;error=caught.message;notify('error');},
    releaseSheetCandidate(kind,billId){
      if(pendingCandidate?.kind!==kind||pendingCandidate.id!==billId||saving||outcome==='uncertain')return;
      // The repository reported a known failure; the sheet owns cancellation
      // of its tentative selection. Uncertain transactions remain recoverable.
      pendingCandidate=null;error='';notify('save-finished');
    },
    reportEntryProblem(phase,message,id=null){entryPhase=phase;error=message;storageBlocked=phase!=='loading';missingTarget=id;notify('error');},
    dispose(){disposed=true;generation++;openRequest++;queued=false;}
  };
}
