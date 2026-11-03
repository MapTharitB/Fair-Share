// Full, unwrapped width of an equal-width pair, using its rendered font and box styles.
export function measureChoiceGroup(group,{textFor=face=>face.textContent}={}){
  const context=document.createElement('canvas').getContext('2d');
  const px=value=>parseFloat(value)||0;
  const widths=[...group.querySelectorAll('.segmented-face')].map(face=>{
    const style=getComputedStyle(face);
    context.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const text=textFor(face);
    return context.measureText(text).width+Math.max(0,[...text].length-1)*px(style.letterSpacing)
      +px(style.paddingLeft)+px(style.paddingRight)+px(style.borderLeftWidth)+px(style.borderRightWidth);
  });
  const style=getComputedStyle(group);
  return Math.ceil(2*Math.max(...widths)+px(style.columnGap)+px(style.paddingLeft)+px(style.paddingRight)+px(style.borderLeftWidth)+px(style.borderRightWidth));
}

// Fit the real adjustment controls inside their card padding, including the
// discount's separate mode switch and number field. Never shrink input faces.
export function layoutAdjustments(row){
  if(!row?.clientWidth)return;
  const px=value=>parseFloat(value)||0,cards=[...row.children];
  const outer=style=>px(style.paddingLeft)+px(style.paddingRight)+px(style.borderLeftWidth)+px(style.borderRightWidth);
  row.classList.remove('adj-cards-stacked');
  for(const card of cards)card.classList.remove('ab-wide','adj-controls-stacked');
  const compactOuter=cards.map(card=>outer(getComputedStyle(card)));
  // Measure the widest label style even when the previous layout was compact.
  for(const card of cards)card.classList.add('ab-wide');
  const gap=px(getComputedStyle(row).columnGap),column=(row.clientWidth-gap*(cards.length-1))/cards.length;
  const metrics=cards.map((card,index)=>{
    const control=card.querySelector('.adj-bar-ctrl'),children=[...control.children],style=getComputedStyle(control);
    const widths=children.map(n=>n.getBoundingClientRect().width);
    const cardStyle=getComputedStyle(card);
    return {card,full:widths.reduce((a,b)=>a+b,0)+px(style.columnGap)*(widths.length-1),min:Math.max(...widths),label:card.querySelector('.adj-bar-label').getBoundingClientRect().width,compactOuter:compactOuter[index],wideOuter:outer(cardStyle),gap:px(cardStyle.columnGap)};
  });
  const stacked=metrics.some(m=>m.min+m.compactOuter>column),width=stacked?row.clientWidth:column;
  row.classList.toggle('adj-cards-stacked',stacked);
  const wide=metrics.every(m=>m.full+m.label+m.wideOuter+m.gap+1<=width);
  const controlsStacked=!wide&&metrics.some(m=>m.full+m.compactOuter+1>width);
  for(const m of metrics){m.card.classList.toggle('ab-wide',wide);m.card.classList.toggle('adj-controls-stacked',controlsStacked);}
}

// Observe the available width and font-driven face sizes without rebuilding controls.
export function observeChoices(host,update){
  let frame=0,disposed=false;
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(!disposed)update();});};
  const observer=new ResizeObserver(schedule);observer.observe(host);
  for(const face of host.querySelectorAll('.segmented-face'))observer.observe(face);
  document.fonts?.ready.then(()=>{if(!disposed)schedule();});
  document.fonts?.addEventListener('loadingdone',schedule);
  update();
  return ()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();document.fonts?.removeEventListener('loadingdone',schedule);};
}
