// Native :hover can stick after touch. Only actual hover movement enables it;
// marking the element path keeps newly opened sheets neutral under a still cursor.
export function trackPointerHover(root,signal){
  if(signal.aborted)return;
  let hovered=new Set();
  const options={capture:true,passive:true,signal};
  function clear(){
    for(const node of hovered)node.classList.remove('pointer-hover');
    hovered.clear();
  }
  root.addEventListener('pointermove',event=>{
    if(event.pointerType!=='mouse'&&!(event.pointerType==='pen'&&event.buttons===0)){clear();return;}
    const next=new Set(event.composedPath().filter(node=>node.nodeType===1));
    for(const node of hovered)if(!next.has(node))node.classList.remove('pointer-hover');
    for(const node of next)if(!hovered.has(node))node.classList.add('pointer-hover');
    hovered=next;
  },options);
  // Clear feedback before scoped busy guards stop activation at the window.
  // The entry installs this policy before creating any interaction guards.
  root.defaultView.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse')clear();},options);
  root.addEventListener('pointercancel',clear,options);
  root.addEventListener('pointerout',event=>{if(!event.relatedTarget)clear();},options);
  root.defaultView.addEventListener('keydown',clear,options);
  root.addEventListener('visibilitychange',()=>{if(root.hidden)clear();},options);
  root.defaultView.addEventListener('pagehide',clear,options);
  signal.addEventListener('abort',clear,{once:true});
}
