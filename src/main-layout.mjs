import {mainScrollKey} from './bill-work-keys.mjs';
export function createMainScroll({storage,getEpoch}){
  const lifetime=new AbortController(),signal=lifetime.signal;
  let epoch,offsets={menu:0,summary:0},active=null,restoring=false,generation=0,frame=0;
  if('scrollRestoration' in history)history.scrollRestoration='manual';
  function sync(){if(epoch===getEpoch())return;epoch=getEpoch();offsets={menu:0,summary:0};try{const saved=JSON.parse(storage?.getItem(mainScrollKey(epoch)));if(saved?.epoch===epoch)for(const page of ['menu','summary'])if(Number.isFinite(saved[page])&&saved[page]>=0)offsets[page]=saved[page];}catch{}}
  function persist(){try{storage?.setItem(mainScrollKey(epoch),JSON.stringify({epoch,...offsets}));}catch{}}
  function capture(){sync();if(active&&!restoring){offsets[active]=scrollY;persist();}}
  function leave(){capture();active=null;generation++;cancelAnimationFrame(frame);restoring=false;}
  function before(page){sync();if(active===page)capture();restoring=true;generation++;cancelAnimationFrame(frame);}
  function restore(position){
    const token=generation;restoring=true;
    frame=requestAnimationFrame(()=>{if(token!==generation)return;window.scrollTo({...position,behavior:'instant'});
      frame=requestAnimationFrame(()=>{if(token!==generation)return;window.scrollTo({...position,behavior:'instant'});
        frame=requestAnimationFrame(()=>{if(token!==generation)return;
          const finish=()=>{if(token!==generation)return;window.scrollTo({...position,behavior:'instant'});restoring=false;capture();};
          if(document.fonts?.status==='loading')document.fonts.ready.then(finish);else finish();
        });});});
  }
  function after(page){active=page;restore({top:offsets[page]});}
  function restoreTransient(position){leave();restore({left:position.x,top:position.y});}
  window.addEventListener('scroll',capture,{passive:true,signal});window.addEventListener('pagehide',capture,{signal});
  // A deliberate gesture can interrupt restoration rather than fighting the user.
  const interrupt=()=>{if(restoring){generation++;cancelAnimationFrame(frame);restoring=false;capture();}};
  window.addEventListener('wheel',interrupt,{passive:true,signal});window.addEventListener('touchstart',interrupt,{passive:true,signal});
  return {before,after,leave,capture,restoreTransient,dispose(){leave();lifetime.abort();},reset(){leave();epoch=getEpoch();offsets={menu:0,summary:0};persist();},get generation(){return generation;},get restoring(){return restoring;}};
}

// CSS owns positioning. Only the export bar's actual size reserves document space.
export function reserveBottomAction(bar){
  if(!bar)return ()=>{};
  const root=document.documentElement;
  const update=()=>root.style.setProperty('--bottom-action-height',bar.getBoundingClientRect().height+'px');
  const observer=new ResizeObserver(update);observer.observe(bar);update();
  return ()=>{observer.disconnect();root.style.removeProperty('--bottom-action-height');};
}

export function observeStickyHeading(heading){
  if(!heading)return ()=>{};
  let frame=0;
  const update=()=>{frame=0;const top=parseFloat(getComputedStyle(heading).top)||0;heading.classList.toggle('is-stuck',heading.getBoundingClientRect().top<=top+.5&&scrollY>0);};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  const observer=new ResizeObserver(schedule);observer.observe(document.getElementById('hdr'));observer.observe(heading);
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);update();
  return ()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);};
}
