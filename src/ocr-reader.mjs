// Worker lifecycle is injectable so cancellation/retry can be checked without a browser.
export function createOcrReader(factory){
  let active=null;
  async function cancel(){const old=active;active=null;if(old){old.reject(Error('ยกเลิกการอ่านแล้ว'));if(old.worker)await old.worker.terminate();}}
  async function read(image,onProgress=()=>{}){
    const previous=cancel(),op={worker:null,reject:null};
    const stopped=new Promise((_,reject)=>{op.reject=reject;});active=op;
    const work=(async()=>{
      await previous;if(active!==op)throw Error('ยกเลิกการอ่านแล้ว');
      const current=await factory(event=>{if(active===op)onProgress(event);});
      if(active!==op){await current.terminate();throw Error('ยกเลิกการอ่านแล้ว');}
      op.worker=current;const result=await current.recognize(image);
      if(active!==op)throw Error('ยกเลิกการอ่านแล้ว');return result.data.text;
    })();
    const timer=setTimeout(()=>{if(active===op)cancel().catch(()=>{});},120000);
    try{
      return await Promise.race([work,stopped]);
    }finally{clearTimeout(timer);if(active===op){active=null;if(op.worker)await op.worker.terminate();}}
  }
  return {read,cancel};
}
export async function browserWorker(logger){
  if(!globalThis.Tesseract){
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=new URL('../vendor/tesseract/tesseract.js/dist/tesseract.min.js',import.meta.url).href;
      script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('ยังอ่านรูปไม่ได้ ลองอีกครั้งหรือวางข้อความแทน'));};document.head.append(script);
    });
  }
  return Tesseract.createWorker('tha+eng',1,{
    workerPath:new URL('../vendor/tesseract/tesseract.js/dist/worker.min.js',import.meta.url).href,
    corePath:new URL('../vendor/tesseract/tesseract.js-core/tesseract-core-lstm.wasm.js',import.meta.url).href,
    langPath:new URL('../vendor/tesseract/languages/',import.meta.url).href,
    workerBlobURL:false,logger,
  });
}
export async function prepareImage(file){
  if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('ใช้รูป JPG, PNG หรือ WebP ได้ ถ้าเป็น HEIC ให้คัดลอกข้อความจากรูปมาวางแทน');
  if(file.size>12*1024*1024)throw Error('รูปใหญ่เกิน 12 MB ลองลดขนาดแล้วเลือกใหม่');
  const url=URL.createObjectURL(file),image=new Image();
  try{
    image.src=url;await image.decode();
    if(image.width*image.height>24000000)throw Error('รูปใหญ่เกินไป ลองลดขนาดแล้วเลือกใหม่');
    const scale=Math.min(1,2400/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);
    const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    return canvas;
  }catch(error){throw Error(error.message==='The source image cannot be decoded.'?'เปิดรูปนี้ไม่ได้ ลองใช้รูปอื่นหรือวางข้อความแทน':error.message);}
  finally{URL.revokeObjectURL(url);}
}
