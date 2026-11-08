import {createHistory} from './history.mjs';

/** Raw text has 20 total states, including its initial value. Timers stay in the page. */
export function createReceiptTextHistory(initialText = '') {
  const history = createHistory(initialText, {limit: 19});
  return {
    record: text => history.record(text),
    undo(currentText) { history.record(currentText); return history.undo(); },
    redo(currentText) { history.record(currentText); return history.redo(); },
    reset: text => history.reset(text),
    canUndo: currentText => history.canUndo || currentText !== history.current,
    get canRedo() { return history.canRedo; }
  };
}
