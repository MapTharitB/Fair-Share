/** Own one OCR generation. Presentation and parse installation must honor its token. */
export function createReceiptOcrController({reader, prepareImage, getRaw, parseText, present}) {
  let generation = 0, active = null, disposed = false;
  const isCurrent = operation => !disposed && active === operation && operation.token === generation;
  function close(operation) {
    if (active !== operation) return;
    active = null;
    present.close(operation.token);
  }
  function cancel() {
    const operation = active;
    if (!operation) return;
    generation++;
    Promise.resolve(reader.cancel()).catch(() => {});
    close(operation);
  }
  async function read(file) {
    if (disposed) return;
    cancel();
    const operation = {token: ++generation, progress: 0, startingRaw: getRaw()};
    active = operation;
    const token = operation.token;
    present.open(token);
    present.progress(token, {label:'กำลังเตรียมอ่านรูป…',percent:0,note:null,preparing:true});
    try {
      const image = await prepareImage(file);
      if (!isCurrent(operation)) return;
      const raw = await reader.read(image, event => {
        if (!isCurrent(operation) || event.status !== 'recognizing text' || !Number.isFinite(event.progress)) return;
        operation.progress = Math.max(operation.progress, Math.min(95, Math.max(0,event.progress * 95)));
        present.progress(token, {label:event.progress >= 1 ? 'กำลังจัดเตรียมข้อความ…' : 'กำลังอ่านข้อความ…',
          percent:operation.progress,note:null,preparing:false});
      });
      if (!isCurrent(operation)) return;
      if (getRaw() !== operation.startingRaw) throw Error('ข้อความที่คุณวางยังอยู่ในหน้านี้ ลองเลือกรูปอีกครั้ง');
      present.progress(token, {label:'อ่านรูปแล้ว',percent:100,note:null,preparing:false});
      await present.success(token);
      if (!isCurrent(operation)) return;
      // Parsing may await a target reload. Pass the generation guard through it.
      await parseText(raw, () => isCurrent(operation));
    } catch (error) {
      if (isCurrent(operation)) present.error(token, error);
    } finally {
      close(operation);
    }
  }
  return {
    read, cancel,
    dispose() {
      cancel();
      disposed = true;
      generation++;
      Promise.resolve(reader.cancel()).catch(() => {});
    }
  };
}
