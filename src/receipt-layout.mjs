export const RECEIPT_PLACEHOLDER='หากอ่านภาพใบเสร็จไม่แม่นยำ\nโปรดถ่ายภาพให้ตรง และคมชัด\nหรือใช้ฟีเจอร์คัดลอกข้อความจากภาพ\nบนอุปกรณ์ของคุณนำมาวางแทน';
const widePlaceholder='หากอ่านภาพใบเสร็จไม่แม่นยำ โปรดถ่ายภาพให้ตรง และคมชัด\nหรือใช้ฟีเจอร์คัดลอกข้อความจากภาพบนอุปกรณ์ของคุณนำมาวางแทน';
function widthOf(text,style){const probe=document.createElement('span');probe.style.cssText='position:fixed;visibility:hidden;white-space:pre;pointer-events:none;left:-10000px';probe.style.font=style.font;probe.style.letterSpacing=style.letterSpacing;probe.textContent=text;document.body.append(probe);const width=probe.getBoundingClientRect().width;probe.remove();return width;}
export function updateReceiptPlaceholder(){
  const ta=document.getElementById('receiptText');if(!ta)return;const style=getComputedStyle(ta),placeholder=getComputedStyle(ta,'::placeholder');
  const available=ta.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  ta.placeholder=Math.max(...widePlaceholder.split('\n').map(line=>widthOf(line,placeholder)))<=available+.5?widePlaceholder:RECEIPT_PLACEHOLDER;
}
export function mountReceiptLayout({onLayout=()=>{}}){
  const controller=new AbortController(),signal=controller.signal;let frame=0;
  function update(){
    frame=0;updateReceiptPlaceholder();
    const pair=document.querySelector('#receipt-history');
    if(pair){
      const header=document.querySelector('.top-bar'),style=getComputedStyle(header),title=header.querySelector('.top-title');
      const labelWidth=widthOf('ย้อนกลับ',getComputedStyle(pair.querySelector('button')));pair.style.setProperty('--history-label-width',labelWidth+'px');
      const inner=header.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),add=document.getElementById('addBtn')?.offsetWidth??0;
      const titleWidth=widthOf(title.textContent,getComputedStyle(title)),minimum=titleWidth+44+92+add+24,secondary=document.getElementById('subBar');
      if(secondary&&!pair.contains(document.activeElement)){
        const below=minimum>inner;secondary.hidden=!below;if(below&&pair.parentElement!==secondary)secondary.append(pair);else if(!below&&pair.parentElement!==header)header.insertBefore(pair,document.getElementById('addBtn'));
      }
      pair.classList.toggle('compact',2*(labelWidth+39)+4>(pair.parentElement===secondary?inner:inner-titleWidth-44-add-24));
    }
    onLayout();
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update);}
  window.addEventListener('resize',schedule,{signal});window.addEventListener('scroll',schedule,{capture:true,passive:true,signal});window.visualViewport?.addEventListener('resize',schedule,{signal});window.visualViewport?.addEventListener('scroll',schedule,{signal});
  const observer=new ResizeObserver(schedule);for(const el of [document.querySelector('.top-bar'),document.querySelector('.submit-wrap-inner')])if(el)observer.observe(el);
  document.fonts?.ready.then(()=>{if(!signal.aborted)schedule();});schedule();
  return ()=>{controller.abort();observer.disconnect();cancelAnimationFrame(frame);};
}
