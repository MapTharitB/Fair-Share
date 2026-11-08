import {historyNeedsCompact} from './history-controls.mjs';

export const RECEIPT_PLACEHOLDER='หากอ่านภาพใบเสร็จไม่แม่นยำ\nโปรดถ่ายภาพให้ตรง และคมชัด\nหรือใช้ฟีเจอร์คัดลอกข้อความจากภาพ\nบนอุปกรณ์ของคุณนำมาวางแทน';
const widePlaceholder='หากอ่านภาพใบเสร็จไม่แม่นยำ โปรดถ่ายภาพให้ตรง และคมชัด\nหรือใช้ฟีเจอร์คัดลอกข้อความจากภาพบนอุปกรณ์ของคุณนำมาวางแทน';
function widthOf(text,style){const probe=document.createElement('span');probe.className='text-measure-probe';probe.style.font=style.font;probe.style.letterSpacing=style.letterSpacing;probe.textContent=text;document.body.append(probe);const width=probe.getBoundingClientRect().width;probe.remove();return width;}
function updateReceiptPlaceholder(){
  const ta=document.getElementById('receiptText');if(!ta)return;const style=getComputedStyle(ta),placeholder=getComputedStyle(ta,'::placeholder');
  const available=ta.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
  ta.placeholder=Math.max(...widePlaceholder.split('\n').map(line=>widthOf(line,placeholder)))<=available+.5?widePlaceholder:RECEIPT_PLACEHOLDER;
}
function fitAdjustmentLabel(){
  const label=document.querySelector('.sum-lbl[data-short-label]');
  if(!label)return;
  const {fullLabel,shortLabel}=label.dataset;
  // The visible label is uppercase. Measure that form even when SC is showing.
  const width=widthOf(fullLabel.toUpperCase(),getComputedStyle(label));
  const text=width<=label.getBoundingClientRect().width?fullLabel:shortLabel;
  if(label.textContent!==text)label.textContent=text;
}
function fitSummaryTotals(){
  const bar=document.getElementById('summaryBar');
  if(!bar)return;
  const needsStack=[...bar.children].some(card=>{
    const [label,amount]=card.children;
    const style=getComputedStyle(card);
    const insets=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)
      +parseFloat(style.borderLeftWidth)+parseFloat(style.borderRightWidth);
    const available=card.getBoundingClientRect().width-insets;
    // The children keep their intrinsic widths in either orientation.
    const required=label.getBoundingClientRect().width+amount.getBoundingClientRect().width+parseFloat(style.columnGap);
    return required>available;
  });
  bar.classList.toggle('is-stacked',needsStack);
}
export function mountReceiptLayout({onLayout=()=>{}}={}){
  const controller=new AbortController(),signal=controller.signal;let frame=0;
  function update(){
    frame=0;
    const pair=document.querySelector('#receipt-history');
    if(pair){
      const header=document.querySelector('.top-bar'),style=getComputedStyle(header),title=header.querySelector('.top-title');
      const labelWidth=widthOf('ย้อนกลับ',getComputedStyle(pair.querySelector('button')));pair.style.setProperty('--history-label-width',labelWidth+'px');
      const inner=header.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),add=document.getElementById('addBtn')?.offsetWidth??0;
      const titleWidth=widthOf(title.textContent,getComputedStyle(title)),minimum=titleWidth+44+92+add+24,secondary=document.getElementById('subBar');
      if(secondary&&!pair.contains(document.activeElement)){
        const below=minimum>inner;secondary.hidden=!below;if(below&&pair.parentElement!==secondary)secondary.append(pair);else if(!below&&pair.parentElement!==header)header.insertBefore(pair,document.getElementById('addBtn'));
      }
      pair.classList.toggle('compact',historyNeedsCompact(labelWidth,pair.parentElement===secondary?inner:inner-titleWidth-44-add-24));
    }
    updateReceiptLayout();onLayout();
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(update);}
  window.addEventListener('resize',schedule,{signal});window.addEventListener('scroll',schedule,{capture:true,passive:true,signal});window.visualViewport?.addEventListener('resize',schedule,{signal});window.visualViewport?.addEventListener('scroll',schedule,{signal});
  const observer=new ResizeObserver(schedule);for(const el of [document.querySelector('.top-bar'),document.querySelector('.submit-wrap-inner'),document.querySelector('.summary-grid')])if(el)observer.observe(el);
  document.fonts?.ready.then(()=>{if(!signal.aborted)schedule();});schedule();
  return ()=>{controller.abort();observer.disconnect();cancelAnimationFrame(frame);};
}

function updateStickyOffsets(){const topBar=document.querySelector('.top-bar');const subBar=document.getElementById('subBar');const submitInner=document.querySelector('.submit-wrap-inner');if(!topBar)return;const topH=topBar.getBoundingClientRect().height;const subVisible=subBar&&window.getComputedStyle(subBar).display!=='none';const subH=subVisible?subBar.getBoundingClientRect().height:0;const submitH=submitInner?submitInner.getBoundingClientRect().height:60;document.documentElement.style.setProperty('--sticky-top-2',topH+'px');document.documentElement.style.setProperty('--sticky-top-3',(topH+subH)+'px');document.documentElement.style.setProperty('--submit-reserve',(submitH+24)+'px');}
function updateSwapButtonAlignment(){const p2Th=document.getElementById('swapColsBtn')?.closest('th');if(!p2Th)return;const p1Th=p2Th.previousElementSibling;if(!p1Th)return;const p1Label=p1Th.querySelector('.th-label');const p2Label=p2Th.querySelector('.th-label');if(!p1Label||!p2Label)return;const pointA=p1Label.getBoundingClientRect().right;const pointB=p2Label.getBoundingClientRect().left;const midX=(pointA+pointB)/2;const p2ThRect=p2Th.getBoundingClientRect();const leftInP2=midX-p2ThRect.left;const numWidth=Math.max(20,p2ThRect.width-leftInP2-11-7);document.documentElement.style.setProperty('--swap-btn-left',`${leftInP2}px`);document.documentElement.style.setProperty('--p2-num-width',`${numWidth}px`);}
function fitP2Numbers(){const numWidth=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--p2-num-width'))||0;if(numWidth<=0)return;document.querySelectorAll('[data-p2-num]').forEach(span=>{span.style.fontSize='';let fs=parseFloat(window.getComputedStyle(span).fontSize)||12;while(span.scrollWidth>numWidth&&fs>8){fs=Math.max(8,fs-0.5);span.style.fontSize=`${fs}px`;}});}

export function updateReceiptLayout(){updateReceiptPlaceholder();fitAdjustmentLabel();fitSummaryTotals();updateStickyOffsets();updateSwapButtonAlignment();fitP2Numbers();}
