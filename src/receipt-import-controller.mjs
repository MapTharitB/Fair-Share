import {buildReviewedDraft,copyReceiptForImport} from './receipt-draft.mjs';
import {importReceipt} from './receipt-import.mjs';

/** Coordinate a submission; the choice sheet retains its repeatable onConfirm callback. */
export function createReceiptImportController({getSession,getReview,getStatus,setBaseRevision,
  setOptions,persistDraft,confirmRepeat,chooseImport,onCommitted,onError,returnToBill}) {
  let busy = false;
  async function submit() {
    if (busy || getStatus().composing) return;
    busy = true;
    let repeatNeeded = false;
    try {
      const status = getStatus();
      if (status.targetError) throw Error(status.targetError);
      if (status.draftBlocked) throw Error('โปรดกลับไปแยกเมนูจากข้อความอีกครั้ง');
      // Lookup occurs now, rather than retaining a possibly-null startup session.
      const session = getSession();
      if (!session) throw Error('ไม่พบบิลนี้ เปิดบิลที่ต้องการก่อนอ่านใบเสร็จ');
      const loaded = await session.load();
      if (loaded.status !== 'loaded') throw Error(loaded.message);
      const review = getReview();
      const repeated = session.current.imports.includes(review.draft?.id);
      let prepared = buildReviewedDraft(review);
      if (repeated) {
        if (!await confirmRepeat()) return;
        prepared = copyReceiptForImport(prepared);
        setBaseRevision(session.record.recordRevision);
      }
      let attemptSubmitted = false, committed = false;
      const hasItems = session.current.items.length > 0;
      const hasPeople = session.current.people.length > 0;
      const imported = await chooseImport({hasItems,hasPeople,mode:review.importMode,
        assignmentMode:review.importAssignments,onConfirm:async options => {
          setOptions(options);
          persistDraft();
          const loaded = await session.load();
          if (loaded.status !== 'loaded') {
            const error = Error(loaded.message);
            // The page needs target availability for its recovery model. Keep
            // the exception inside the existing choice sheet's retry handling.
            onError(error, {targetStatus:loaded.status,inline:false});
            throw error;
          }
          const bill = session.current;
          if (bill.imports.includes(prepared.id)) {
            if (repeated || attemptSubmitted) {
              onCommitted(prepared);committed = true;persistDraft();return;
            }
            repeatNeeded = true;
            onCommitted(prepared);
            return;
          }
          if (hasItems !== (bill.items.length > 0) || hasPeople !== (bill.people.length > 0)) {
            throw Error('รายการหรือคนในบิลเปลี่ยนไป ปิดหน้าต่างนี้แล้วกดเพิ่มเมนูลงบิลอีกครั้งเพื่อเลือกใหม่');
          }
          if (getReview().baseRevision !== session.record.recordRevision) {
            setBaseRevision(session.record.recordRevision);
            persistDraft();
            throw Error('บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนเพิ่มเมนู');
          }
          const next = importReceipt(bill,prepared,{...options,charges:'receipt'});
          attemptSubmitted = true;
          const result = await session.commit(next,{kind:'import',baseRevision:getReview().baseRevision});
          if (!['saved','unchanged'].includes(result.status)) throw Error(result.message);
          onCommitted(prepared);committed = true;persistDraft();
        }});
      if (imported && committed && !repeatNeeded) await returnToBill();
    } catch (error) {
      onError(error);
    } finally {
      busy = false;
    }
    if (repeatNeeded) await submit();
  }
  return {submit,get busy(){return busy;}};
}
