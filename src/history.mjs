const clone=value=>structuredClone(value);
export function sameValue(a,b){
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const keys=Object.keys(a);
  return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&sameValue(a[key],b[key]));
}

// A timeline is independent of persistence and of the domain being edited.
export function createHistory(initial,{limit=20,equal=sameValue,serialized}={}){
  let states=[clone(initial)],cursor=0;
  if(serialized){
    if(serialized.format!==1||!Array.isArray(serialized.states)||!serialized.states.length||serialized.states.length>limit+1||!Number.isInteger(serialized.cursor)||serialized.cursor<0||serialized.cursor>=serialized.states.length)throw Error('ข้อมูลประวัติไม่ถูกต้อง');
    states=clone(serialized.states);cursor=serialized.cursor;
  }
  return {
    get current(){return clone(states[cursor]);},
    get canUndo(){return cursor>0;},get canRedo(){return cursor<states.length-1;},
    // Unrecorded options belong to this slot; older states and redo stay intact.
    replaceCurrent(next){states[cursor]=clone(next);},
    record(next,{force=false}={}){if(!force&&equal(states[cursor],next))return false;states=states.slice(0,cursor+1);states.push(clone(next));if(states.length>limit+1)states.shift();cursor=states.length-1;return true;},
    undo(){if(cursor>0)cursor--;return clone(states[cursor]);},
    redo(){if(cursor<states.length-1)cursor++;return clone(states[cursor]);},
    reset(next){states=[clone(next)];cursor=0;},
    mapStates(mapper){const mapped=[];let position=0;states.forEach((state,index)=>{const next=mapper(clone(state));if(!mapped.length||!equal(mapped.at(-1),next))mapped.push(clone(next));if(index===cursor)position=mapped.length-1;});states=mapped;cursor=position;},
    serialize(){return {format:1,states:clone(states),cursor};}
  };
}
