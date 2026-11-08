import {billName} from './bill-repository.mjs';
import {newId} from './bill-state.mjs';

export function createBillNameEditor({input,feedback,getContext,repository,onSaved,onStateChange=()=>{}}){
  let target=null,pending=null,problem='',uncertain=false,mutationId=null,refreshRecord=null,composing=false,selectOnPointerUp=false;
  const scope=new AbortController(),options={signal:scope.signal};
  const dirty=()=>!!refreshRecord||!!target&&(input.value!==target.name||uncertain);
  function show(message=''){
    problem=message;feedback.hidden=!message;
    const recovery=uncertain||refreshRecord?'แตะชื่อบิลหรือกด Enter เพื่อตรวจสอบอีกครั้ง':'กด Enter เพื่อลองอีกครั้ง';
    feedback.querySelector('[role=alert]').textContent=message?message+' · '+recovery:'';
    if(message)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');
  }
  function refresh(){
    const context=getContext();
    if(!target&&!pending&&!refreshRecord)input.value=context.record?.name??'';
    input.disabled=!context.available||!context.record||context.mutationBlocked||!!pending;
    input.readOnly=uncertain||!!refreshRecord;
    input.toggleAttribute('data-unsaved',dirty());
    onStateChange({busy:!!pending,problem:!!problem});
  }
  function cancelEdit(){
    if(pending||uncertain||refreshRecord)return;
    const captured=target;target=null;show();
    if(captured&&captured.recordRevision!==getContext().record?.recordRevision){
      refreshRecord=captured;input.value=captured.name;void settle({retry:true});
    }
    refresh();input.blur();
  }
  async function write(){
    try{
      if(!refreshRecord){
        const change=input.value.trim()?{kind:'rename',name:billName(input.value)}:{kind:'rename-default'};
        const outcome=uncertain?await repository.reconcileOperation({id:target.id,mutationId})
          :await repository.write({id:target.id,expectedRevision:target.recordRevision,mutationId:mutationId??=newId(),change});
        if(outcome.status==='conflict'&&outcome.record){target=outcome.record;mutationId=null;throw Error('บิลนี้มีการเปลี่ยนแปลง ชื่อล่าสุด: '+target.name+' เช็กชื่อที่กรอกแล้วลองบันทึกอีกครั้ง');}
        if(outcome.status==='uncertain')uncertain=true;
        if(!['saved','unchanged'].includes(outcome.status))throw Error(outcome.message);
        refreshRecord=outcome.record;uncertain=false;mutationId=null;input.value=outcome.record.name;
      }
      await onSaved(refreshRecord);refreshRecord=null;target=null;show();return true;
    }catch(error){show(error.message);return false;}
  }
  function settle({retry:explicit=false}={}){
    if(pending)return pending;
    if(composing)return Promise.resolve(false);
    if(problem&&!explicit)return Promise.resolve(false);
    if(!dirty()){target=null;show();refresh();return Promise.resolve(true);}
    pending=Promise.resolve().then(write).finally(()=>{pending=null;refresh();});refresh();return pending;
  }
  input.addEventListener('focus',()=>{
    if(!target){target=getContext().record;mutationId=null;selectOnPointerUp=/^ร้านอาหาร [1-9]\d*$/.test(input.value);input.setSelectionRange(selectOnPointerUp?0:input.value.length,input.value.length);}
  },options);
  input.addEventListener('pointerup',()=>{
    if(problem&&(uncertain||refreshRecord)){void settle({retry:true});return;}
    if(selectOnPointerUp){input.select();selectOnPointerUp=false;}
  },options);
  input.addEventListener('input',()=>{show();refresh();},options);
  input.addEventListener('compositionstart',()=>{composing=true;},options);
  input.addEventListener('compositionend',()=>{composing=false;},options);
  input.addEventListener('keydown',event=>{
    if(composing||event.isComposing||event.keyCode===229)return;
    if(event.key==='Escape'){event.preventDefault();cancelEdit();}
    if(event.key==='Enter'){event.preventDefault();if(!event.repeat)void settle({retry:true}).then(saved=>{if(saved)input.blur();});}
  },options);
  input.addEventListener('blur',()=>{void settle();},options);
  refresh();
  return {refresh,settle,get dirty(){return dirty();},get busy(){return !!pending;},get unsettled(){return dirty()||!!pending||!!problem;},dispose(){scope.abort();}};
}
