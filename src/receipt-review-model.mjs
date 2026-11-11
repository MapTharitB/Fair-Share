import {createHistory} from './history.mjs';
import {receiptNumber,emptyReceiptEvidence,fieldIssue} from './receipt-fields.mjs';

export function createManualReviewRow(id){return {id,rawLine:'',itemName:'เมนูใหม่',qty:1,priceSource:'line_total',priceValue:null,needsReview:true,isDiscount:false,flags:[],evidence:emptyReceiptEvidence(),issues:{price:fieldIssue('missing','line_total')},priceEdited:false};}
const fields = ['rows','summarySource','summaryEdits','summaryIssues','discountCanonical','colOrder','importMode','importAssignments'];
function snapshot(review = {}) {
  const defaults = {rows:[], summarySource:null,summaryIssues:{},
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
    editRow(id,field,input){
      return edit(review=>{const row=review.rows.find(r=>r.id===id);if(!row)return;
        if(field==='itemName'){row.itemName=String(input).trim()||'เมนูใหม่';return;}
        const qty=field==='qty',key=qty?'qty':'price',value=receiptNumber(input,{quantity:qty});
        row.issues={...row.issues};
        if(value===null){row.issues[key]=fieldIssue(String(input).trim()===''?'missing':'invalid',field,String(input));row[qty?'qty':'priceValue']=null;if(!qty)row.priceSource=field;return;}
        row[qty?'qty':'priceValue']=value;delete row.issues[key];
        if(qty)row.qtyWasNull=false;else{row.priceSource=field;row.priceEdited=true;}
      });
    },
    addRow(row) { return edit(review => { review.rows.push(structuredClone(row)); }, {force:true}); },
    deleteRow(id) { return edit(review => { review.rows = review.rows.filter(row => row.id !== id); }, {force:true}); },
    swapPrices(idOrNull = null) {
      return edit(review => {
        review.rows = review.rows.map(row => {
          if(idOrNull!==null&&row.id!==idOrNull)return row;
          const priceSource=row.priceSource==='line_total'?'unit_price':'line_total';
          return {...row,priceSource,priceEdited:true,issues:{...row.issues,...(row.issues?.price?{price:{...row.issues.price,editField:priceSource}}:{})}};
        });
      }, {force:true});
    },
    editSummary(kind, field, value, {forceHistory = false} = {}) {
      return edit(review => {
        const amount=receiptNumber(String(value),{summary:true});
        review.summaryIssues={...review.summaryIssues};
        if(amount===null){review.summaryIssues[kind]=fieldIssue(String(value).trim()===''?'missing':'invalid',field,String(value));return;}
        delete review.summaryIssues[kind];
        if (kind === 'service_charge' || kind === 'vat') {
          review.summarySource = {...review.summarySource, [kind]:{
            ...review.summarySource?.[kind],mode:field === 'rate' ? 'percent' : 'amount',value:amount
          }};
          review.summaryEdits = {...review.summaryEdits,
            [kind + '_rate']:field === 'rate' ? amount : null};
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
