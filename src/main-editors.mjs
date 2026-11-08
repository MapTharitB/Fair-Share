import {createHistory,sameValue} from './history.mjs';

/** Own a tentative item and its history, independently of the saved bill. */
export function createItemEditor({item,isNew}) {
  let baseline=structuredClone(item),draft=structuredClone(item);
  const history=createHistory(draft);
  const snapshot=()=>({itemId:draft.id,isNew,baseline:structuredClone(baseline),draft:structuredClone(draft),isDirty:!sameValue(draft,baseline)});
  return {
    edit(mutator){const next=structuredClone(draft);mutator(next);draft=next;return snapshot();},
    record(){return history.record(draft);},
    undo(){draft=history.undo();return snapshot();},
    redo(){draft=history.redo();return snapshot();},
    snapshot,
    mapPeople(mapper){baseline=mapper(structuredClone(baseline));draft=mapper(structuredClone(draft));history.mapStates(mapper);},
    get dirty(){return !sameValue(draft,baseline);},
    get canUndo(){return history.canUndo||!sameValue(draft,history.current);},
    get canRedo(){return history.canRedo&&sameValue(draft,history.current);}
  };
}

/** People input is recoverable UI work; navigation owns the return context. */
export function createPeopleDraft() {
  let values={add:'',rename:null};
  return {
    capture(next){values=structuredClone(next);},
    reset(){values={add:'',rename:null};},
    snapshot:()=>structuredClone(values)
  };
}
