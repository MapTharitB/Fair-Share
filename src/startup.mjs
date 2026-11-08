// Deliberately loaded as a classic script, even with this source extension.
// It can explain file:// restrictions before any module is requested.
(() => {
  const entry = document.currentScript.dataset.entry;
  if (location.protocol !== 'file:') {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = new URL(entry, document.baseURI).href;
    script.addEventListener('error', () => {
      const notice = document.createElement('main');
      notice.className = 'empty';
      const message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.textContent = 'โหลดแอปไม่สำเร็จ กรุณาลองเปิดหน้านี้อีกครั้ง';
      const retry = document.createElement('a');
      retry.href = location.href;
      retry.textContent = 'ลองใหม่';
      notice.append(message, retry);
      document.body.replaceChildren(notice);
    }, {once: true});
    document.body.append(script);
    return;
  }

  const style = document.createElement('style');
  style.textContent = `
    html, body { height: auto; min-height: 100%; overflow: auto; }
    body { margin: 0; background: var(--color-background,Canvas); color: var(--color-text,CanvasText); }
    .file-startup { box-sizing: border-box; max-width: 560px; margin: 10vh auto;
      padding: 24px; font: 16px/1.7 Sarabun, sans-serif; overflow-wrap: anywhere; }
    .file-startup h1 { font-size: 24px; line-height: 1.4; color: var(--color-orange-on-light,LinkText); }
    .file-startup p { margin: 16px 0; }
  `;
  document.head.append(style);
  const main = document.createElement('main');
  main.className = 'file-startup';
  main.setAttribute('aria-labelledby', 'file-startup-title');
  const heading = document.createElement('h1');
  heading.id = 'file-startup-title';
  heading.textContent = 'เปิด หารจ่ายแฟร์ๆ ผ่านที่อยู่เว็บ';
  main.append(heading);
  for (const text of [
    'เบราว์เซอร์ไม่อนุญาตให้ หารจ่ายแฟร์ๆ ทำงานเมื่อเปิดไฟล์ HTML จากเครื่องโดยตรง',
    'ใช้ทางลัดหรือบุ๊กมาร์กที่บันทึกไว้เพื่อเปิด หารจ่ายแฟร์ๆ ผ่านที่อยู่เว็บเดิม บิลที่บันทึกไว้จะอยู่กับที่อยู่เว็บและเบราว์เซอร์ที่ใช้บันทึก',
    'บน Windows ให้ดับเบิลคลิกทางลัดของหารจ่ายแฟร์ๆ (ไฟล์ .url) แทนไฟล์ HTML หากเปิดไม่ได้ ให้ตรวจสอบว่าตัวเปิดเว็บยังทำงานอยู่'
  ]) {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    main.append(paragraph);
  }
  // Remove inert app controls rather than presenting a shell that looks usable.
  // Do not access storage, redirect to another origin, or change browser security.
  document.body.replaceChildren(main);
})();
