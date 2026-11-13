// One viewport coordinate system for grouped surfaces. The clipping child,
// rather than its card, clips fixed paint so outer shadows remain intact.
const GROUPS='.menu-list-gap.card,#people-list-wrap > .card,.split-card,.scard,.tbl-card,.ta-card,.fs-sheet';
export function trackGlassSurfaces(root,signal){
  if(signal.aborted)return;
  function decorate(node){
    if(node.closest('.summary-image-root'))return;
    if(!node.querySelector(':scope > .glass-viewport-clip')){
      const clip=root.createElement('span');
      clip.className='glass-viewport-clip';
      clip.setAttribute('aria-hidden','true');
      node.prepend(clip);
    }
    node.classList.add('glass-viewport');
  }
  function scan(node){
    if(node.nodeType!==1&&node!==root)return;
    if(node.matches?.(GROUPS))decorate(node);
    node.querySelectorAll(GROUPS).forEach(decorate);
  }
  scan(root);
  const observer=new MutationObserver(records=>{
    for(const record of records){
      // A renderer may replace a group's children while retaining its element.
      if(record.target.matches?.(GROUPS))decorate(record.target);
      record.addedNodes.forEach(scan);
    }
  });
  observer.observe(root,{childList:true,subtree:true});
  signal.addEventListener('abort',()=>observer.disconnect(),{once:true});
}
