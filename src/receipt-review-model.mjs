import {createHistory} from './history.mjs';
import {receiptSummary, reviewSubtotal} from './receipt-draft.mjs';

const roundMoney = value => Math.round(value * 100) / 100;
const fields = ['rows','summarySource','summaryEdits','discountCanonical','colOrder','importMode','importAssignments'];
function snapshot(review = {}) {
  const defaults = {rows:[], summarySource:null,
    summaryEdits:{service_charge_rate:null,vat_rate:null,discount_rate:null,discount_amount:null},
    discountCanonical:'rate',colOrder:['unit_price','line_total'],importMode:'append',importAssignments:'all'};
  return Object.fromEntries(fields.map(field => [field, structuredClone(review[field] ?? defaults[field])]));
}

/** Own the copied review and its 20 prior states. No raw evidence, DOM or storage. */
export function createReceiptReviewModel(initialReview) {
  const history = createHistory(snapshot(initialReview), {limit: 20});
  function edit(mutator, {force = false} = {}) {
    const next = history.current;
    mutator(next);
    history.record(next, {force});
    return history.current;
  }
  return {
    getSnapshot: () => history.current,
    replace: review => history.reset(snapshot(review)),
    setImportOptions({mode, assignmentMode}) {
      const next = history.current;
      if (mode !== undefined) next.importMode = mode;
      if (assignmentMode !== undefined) next.importAssignments = assignmentMode;
      history.replaceCurrent(next);
    },
    updateRow(id, patch) {
      return edit(review => { review.rows = review.rows.map(row => row.id === id ? {...row,...structuredClone(patch)} : row); });
    },
    addRow(row) { return edit(review => { review.rows.push(structuredClone(row)); }, {force:true}); },
    deleteRow(id) { return edit(review => { review.rows = review.rows.filter(row => row.id !== id); }, {force:true}); },
    swapPrices(idOrNull = null) {
      return edit(review => {
        review.rows = review.rows.map(row => idOrNull == null || row.id === idOrNull
          ? {...row,priceSource:row.priceSource === 'line_total' ? 'unit_price' : 'line_total'} : row);
      }, {force:true});
    },
    editSummary(kind, field, value, {forceHistory = false} = {}) {
      return edit(review => {
        const subtotal = reviewSubtotal(review);
        const current = receiptSummary(subtotal, review.summarySource, review.summaryEdits, review.discountCanonical);
        const parsed = parseFloat(String(value).replace(/,/g, '').replace(/-/g, ''));
        const amount = Number.isFinite(parsed) ? Math.abs(parsed) : 0;
        if (kind === 'service_charge' || kind === 'vat') {
          review.summarySource = {...review.summarySource, [kind]:{
            ...review.summarySource?.[kind],mode:field === 'rate' ? 'percent' : 'amount',value:amount
          }};
          const basis = kind === 'vat' ? roundMoney(subtotal + current.service_charge.amount) : subtotal;
          review.summaryEdits = {...review.summaryEdits,
            [kind + '_rate']:field === 'rate' ? amount : basis > 0 ? amount / basis * 100 : 0};
        } else if (kind === 'discount') {
          review.discountCanonical = field === 'rate' ? 'rate' : 'amount';
          review.summaryEdits = {...review.summaryEdits,
            discount_rate:field === 'rate' ? amount : null,
            discount_amount:field === 'rate' ? null : amount};
        }
      }, {force:forceHistory});
    },
    undo: () => history.undo(),
    redo: () => history.redo(),
    get canUndo() { return history.canUndo; },
    get canRedo() { return history.canRedo; }
  };
}
