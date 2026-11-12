import {renderSummaryImageContent} from './main-bill-view.mjs';
import {billFilename} from './backup-file.mjs';

async function inlineStyles(url){
  const response=await fetch(url);
  if(!response.ok)throw Error('โหลดรูปแบบภาพไม่สำเร็จ');
  let css=await response.text();
  const imports=[...css.matchAll(/@import\s+url\(["']?([^"')]+)["']?\);/g)];
  for(const match of imports){
    let imported='';
    try{imported=await inlineStyles(new URL(match[1],url));}
    catch(error){
      // Match the page's system font fallback when a remote font is unavailable.
      if(new URL(match[1],url).origin===location.origin)throw error;
    }
    css=css.replace(match[0],()=>imported);
  }
  const urls=[...new Set([...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(m=>m[1]).filter(value=>!value.startsWith('data:')))];
  await Promise.all(urls.map(async value=>{
    const resource=await fetch(new URL(value,url));
    if(!resource.ok)throw Error('โหลดแบบอักษรไม่สำเร็จ');
    const blob=await resource.blob();
    const data=await new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);
    });
    css=css.split(value).join(data);
  }));
  return css;
}

export async function downloadSummaryImage(capture,toast,model){
  if(!model?.working.people.length){toast('ยังไม่มีข้อมูลสรุป');return;}
  const snapshot=structuredClone(model),name=capture.name;
  const root=document.createElement('div');
  root.className='summary-image-root';
  root.inert=true;
  const style=getComputedStyle(document.documentElement);
  for(const key of style)if(key.startsWith('--'))root.style.setProperty(key,style.getPropertyValue(key));
  const header=document.createElement('header');header.className='app-header';
  const brand=document.getElementById('hdr-title').cloneNode(true);
  brand.removeAttribute('id');brand.removeAttribute('tabindex');brand.className='app-brand';
  header.append(brand);
  const nameRow=document.createElement('div');nameRow.className='summary-image-name';
  const nameControl=document.createElement('div');nameControl.className='bill-name-control';
  const title=document.createElement('div');title.className='bill-name-text';title.textContent=name;
  nameControl.append(title);nameRow.append(nameControl);root.append(header,nameRow);
  const content=document.createElement('div');content.className='summary-image-content';root.append(content);
  document.body.append(root);
  try{
    renderSummaryImageContent(snapshot,content);
    content.querySelectorAll('.dist-bar-row,.section-start,.coll-btns,.person-card-actions,.coll-chev,.btn-icon,#summary-export-bar').forEach(node=>node.remove());
    for(const node of content.querySelectorAll('.per-person-sticky'))Object.assign(node.style,{position:'static',background:'transparent'});
    const heading=content.querySelector('.per-person-sticky');
    if(heading)heading.style.marginTop='0';
    const footer=document.createElement('p');footer.className='summary-image-footer';
    footer.textContent='UX Design by Map Tharit Banchanurat';
    root.append(footer);
    const date=document.createElement('div');date.textContent=new Date().toLocaleString('th-TH');footer.prepend(date);
    await document.fonts.ready;
    const height=Math.ceil(root.getBoundingClientRect().height);
    const sheets=[...document.querySelectorAll('link[rel=stylesheet]')];
    const css=(await Promise.all(sheets.map(link=>inlineStyles(link.href)))).join('\n');
    const clone=root.cloneNode(true);
    Object.assign(clone.style,{position:'relative',left:'0',top:'0'});
    clone.setAttribute('xmlns','http://www.w3.org/1999/xhtml');
    const embedded=document.createElement('style');embedded.textContent=css;clone.prepend(embedded);
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="'+height+'"><foreignObject width="100%" height="100%">'+new XMLSerializer().serializeToString(clone)+'</foreignObject></svg>';
    const imageUrl='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
    const image=new Image();
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('สร้างภาพสรุปไม่สำเร็จ'));image.src=imageUrl;});
    const scale=Math.min(window.devicePixelRatio||2,3);
    const canvas=document.createElement('canvas');canvas.width=800*scale;canvas.height=height*scale;
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.92));
    if(!blob)throw Error('สร้างรูปภาพไม่ได้ ลองดาวน์โหลดอีกครั้ง');
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=billFilename(name,'jpg');document.body.append(a);a.click();
    setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},1000);
    toast('เริ่มดาวน์โหลดแล้ว');
  }finally{root.remove();}
}
