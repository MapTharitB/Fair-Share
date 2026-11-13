import {createReceiptReview,reviewSubtotal} from './receipt-draft.mjs';

// A category name can also describe a real purchase. Require corroborating item
// amounts before removing the ambiguous Thai label from the AI transcription.
function calculationText(text){
  const lines=text.split(/\r?\n/);
  const category=/^\s*อาหารและเครื่องดื่ม\s+([\d,]+(?:\.\d{1,2})?)\s*$/;
  const index=lines.findIndex(line=>category.test(line));
  if(index>0){
    const review=createReceiptReview(lines.slice(0,index).join('\n'),{preserveItemLines:true});
    const value=Number(lines[index].match(category)[1].replaceAll(',',''));
    if(value>0 && review.rows.length>1 && review.rows.every(row=>!row.needsReview) && reviewSubtotal(review)===value)lines.splice(index,1);
  }
  return lines.filter(line=>!/^\s*(?:grand\s+total|total|subtotal|ยอดรวม|ยอดสุทธิ|รวมทั้งสิ้น)\s*:?\s+[฿$]?[\d,]+(?:\.\d{1,2})?\s*$/i.test(line)).join('\n');
}

/** Same-origin development transport. The local server owns provider credentials. */
export function createAiReceiptReader({endpoint,token,fetcher=globalThis.fetch,timeoutMs=75000}) {
  let active=null;
  function cancel(){active?.abort();active=null;}
  async function read(bytes,onProgress=()=>{}){
    cancel();
    if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>8*1024*1024)throw Error('รูปใหญ่เกินไป ลองลดขนาดรูปก่อนอ่านด้วย AI');
    const operation=new AbortController();active=operation;
    const timer=setTimeout(()=>operation.abort(Error('AI ใช้เวลานานเกินไป ลองใหม่จะนับเป็นการอ่านอีกครั้ง')),timeoutMs);
    try{
      onProgress({status:'waiting for ai'});
      const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'image/png','X-FairShare-Prototype':token},
        body:bytes,signal:operation.signal,cache:'no-store',credentials:'omit',redirect:'error'});
      if(!response.ok){
        const messages={403:'เปิดหน้าทดลองใหม่ แล้วลองอีกครั้ง',413:'รูปใหญ่เกินไป ลองลดขนาดรูป',429:'ถึงขีดจำกัดการอ่าน หรือ AI กำลังทำงานอยู่ ลองอีกครั้งภายหลัง',503:'ยังไม่ได้ตั้งค่า AI เปิดหน้าตั้งค่าของตัวทดลองก่อนอ่านรูป',502:'AI ยังอ่านรูปนี้ไม่ได้ ลองรูปที่ชัดขึ้นหรือวางข้อความแทน',504:'ยังยืนยันผลจาก AI ไม่ได้ การลองใหม่จะนับเป็นการอ่านอีกครั้ง'};
        throw Error(messages[response.status]??'ติดต่อ AI ไม่สำเร็จ ข้อความเดิมยังอยู่');
      }
      const body=await response.text();
      if(body.length>650000)throw Error('ข้อความจาก AI ยาวเกินไป ลองแบ่งรูป');
      const result=JSON.parse(body);
      if(typeof result.text!=='string'||!result.text.trim()||result.text.length>100000)throw Error('AI ส่งข้อความไม่ครบหรืออ่านไม่ได้ ลองรูปที่ชัดขึ้น');
      operation.signal.throwIfAborted();
      const text=calculationText(result.text);
      if(!text.trim())throw Error('ไม่พบรายการสินค้าในผลจาก AI');
      return text;
    }finally{clearTimeout(timer);if(active===operation)active=null;}
  }
  return {read,cancel};
}
