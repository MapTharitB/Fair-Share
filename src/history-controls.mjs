const icon=redo=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${redo?'M21 10a9 9 0 1 0-2.6 8.4M21 4v6h-6':'M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6'}"/></svg>`;
export function mountHistoryControls(host,{scope,onUndo,onRedo,editors}){
  host.classList.add('history-controls');
  const buttons=[['ย้อนกลับ',onUndo,false],['ทำซ้ำ',onRedo,true]].map(([label,action,redo])=>{
    const button=document.createElement('button');button.type='button';button.className='history-button';button.setAttribute('aria-label',label+' '+scope);button.title=label+' '+scope;
    button.innerHTML=icon(redo);const text=document.createElement('span');text.textContent=label;button.append(text);host.append(button);
    if(editors)editors.bind(button,action);else button.onclick=action;return button;
  });
  return {update({canUndo,canRedo,compact=false}){buttons[0].disabled=!canUndo;buttons[1].disabled=!canRedo;host.classList.toggle('compact',compact);},dispose(){host.replaceChildren();}};
}
