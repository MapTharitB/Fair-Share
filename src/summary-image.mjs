import { approvedState, approvedBillTotals, approvedShares } from './approved-ui-bridge.mjs';
import { fmt, displayRate } from './bill-display.mjs';
import { getPersonWarning } from './bill-warnings.mjs';
import { billFilename } from './backup-file.mjs';
export async function downloadSummaryImage(capture, toast) {
  const state = approvedState(capture.bill);
  const totals = approvedBillTotals(state, capture.bill);
  const hasPersonWarning = pid => getPersonWarning(pid, state, totals);
  const itemShares = item => approvedShares(item);
  if (!totals || !state.people.length) {
    toast('ยังไม่มีข้อมูลสรุป');
    return;
  }
  await document.fonts.ready;
  const DPR = Math.min(window.devicePixelRatio || 2, 3);
  const CW = 800,
    PAD = 32,
    CP = 20,
    GAP = 10,
    LH = 28,
    ILH = 25,
    CR = 12,
    FTR_H = 64,
    SLH = 36;
  const titleCanvas = document.createElement('canvas'),
    titleCtx = titleCanvas.getContext('2d');
  titleCtx.font = '600 18px Sarabun';
  const titleLines = [];
  let titleLine = '';
  for (const character of capture.name) {
    if (titleCtx.measureText(titleLine + character).width > CW - PAD * 2 && titleLine) {
      titleLines.push(titleLine);
      titleLine = '';
    }
    titleLine += character;
  }
  titleLines.push(titleLine);
  const HDR_H = 90 + titleLines.length * 28;
  const INNER = CW - PAD * 2;
  const CC = {
    bg: '#18150F',
    surf: '#211D17',
    card: '#2A2520',
    acc: '#C87D3E',
    text: '#F0EAE0',
    mut: '#87807A',
    dim: '#524D47',
    bdr: '#38332C',
    ok: '#5FAA78',
    red: '#D45050',
    accBg: 'rgba(200,125,62,0.07)'
  };
  function personCardHeight(p) {
    const items = state.items.filter(it => it.assignments.some(a => a.personId === p.id));
    let h = CP * 2 + 44;
    if (items.length) {
      h += 8 + items.length * ILH + 12 + LH;
      if (state.service.enabled) h += LH;
      if (state.tax.enabled) h += LH;
      if (totals.D > 0) h += LH;
      h += 8 + 44;
    } else h += LH;
    return h;
  }
  function billCardHeight() {
    let h = CP * 2 + LH;
    if (state.service.enabled) h += LH;
    if (state.tax.enabled) h += LH;
    if (totals.D > 0) h += LH;
    return h += 8 + 44;
  }
  let TH = HDR_H + PAD + SLH;
  state.people.forEach(p => {
    if (totals.pt[p.id]) TH += personCardHeight(p) + GAP;
  });
  TH += 16 + SLH + billCardHeight() + GAP + PAD + FTR_H;
  const canvas = document.createElement('canvas');
  canvas.width = CW * DPR;
  canvas.height = TH * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);
  function drawRoundedRect(x, y, w, h, r) {
    const rs = typeof r === 'number' ? [r, r, r, r] : r;
    const [tl, tr, br, bl] = rs;
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    ctx.lineTo(x + bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    ctx.lineTo(x, y + tl);
    ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
  }
  function drawLine(yy, x1 = PAD + CP, x2 = CW - PAD - CP) {
    ctx.strokeStyle = CC.bdr;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, yy);
    ctx.lineTo(x2, yy);
    ctx.stroke();
  }
  function drawText(text, x, yy, font, color, align = 'left') {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text, x, yy);
    ctx.textAlign = 'left';
  }
  function truncateText(text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  function drawBillRow(lbl, val, y, vc, fontSize, yOff) {
    drawText(lbl, PAD + CP, y + LH - yOff, `400 ${fontSize} "Sarabun",sans-serif`, CC.mut);
    drawText(val, CW - PAD - CP, y + LH - yOff, `500 ${fontSize} "Sarabun",sans-serif`, vc, 'right');
    return y + LH;
  }
  ctx.fillStyle = CC.bg;
  ctx.fillRect(0, 0, CW, TH);
  ctx.fillStyle = CC.surf;
  ctx.fillRect(0, 0, CW, HDR_H);
  drawLine(HDR_H, 0, CW);
  ctx.font = '400 18px "Prompt",sans-serif';
  ctx.fillStyle = CC.mut;
  ctx.fillText('หารจ่าย', PAD, 56);
  const preW = ctx.measureText('หารจ่าย').width;
  drawText('แฟร์ๆ', PAD + preW + 5, 60, '800 36px "Kanit",sans-serif', CC.acc);
  const now = new Date();
  const dStr = now.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) + ' ' + now.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit'
  });
  drawText(dStr, CW - PAD, 56, '400 12px "Sarabun",sans-serif', CC.dim, 'right');
  titleLines.forEach((line, index) => drawText(line, PAD, 96 + index * 28, '600 18px Sarabun', CC.text));
  let y = HDR_H + PAD;
  drawText('ยอดรวมรายคน', PAD, y + 20, '700 11px "Sarabun",sans-serif', CC.dim);
  y += SLH;
  state.people.forEach(p => {
    const pt = totals.pt[p.id];
    if (!pt) return;
    const items = state.items.filter(it => it.assignments.some(a => a.personId === p.id));
    const cH = personCardHeight(p);
    const neg = pt.total < 0;
    const hw = hasPersonWarning(p.id);
    drawRoundedRect(PAD, y, INNER, cH, CR);
    ctx.fillStyle = CC.card;
    ctx.fill();
    drawRoundedRect(PAD, y, INNER, cH, CR);
    ctx.strokeStyle = CC.bdr;
    ctx.lineWidth = 1;
    ctx.stroke();
    let cy = y + CP;
    const pNameDisp = truncateText((hw ? '⚠ ' : '') + p.name, INNER - CP * 2 - 180);
    drawText(pNameDisp, PAD + CP, cy + 28, '700 16px "Sarabun",sans-serif', hw ? CC.red : CC.text);
    drawText(fmt(pt.total), CW - PAD - CP, cy + 30, '700 20px "Sarabun",sans-serif', neg ? CC.red : CC.acc, 'right');
    cy += 44;
    if (items.length) {
      drawLine(cy);
      cy += 8;
      items.forEach(it => {
        const d = itemShares(it)[p.id] || {
          amount: 0
        };
        const nm = truncateText(it.name || 'ไม่มีชื่อเมนู', INNER - CP * 2 - 160);
        drawText(nm, PAD + CP + 12, cy + 17, '400 13px "Sarabun",sans-serif', CC.text);
        drawText(fmt(d.amount), CW - PAD - CP, cy + 17, '400 13px "Sarabun",sans-serif', CC.mut, 'right');
        cy += ILH;
      });
      cy += 12;
      drawLine(cy);
      cy = drawBillRow('ยอดรวมย่อย', fmt(pt.subtotal), cy, CC.text, '13px', 7);
      if (state.service.enabled) cy = drawBillRow(`Service Charge (${displayRate(state.service.value)}%)`, `+${fmt(pt.service)}`, cy, CC.text, '13px', 7);
      if (state.tax.enabled) cy = drawBillRow(`VAT (${displayRate(state.tax.value)}%)`, `+${fmt(pt.vat)}`, cy, CC.text, '13px', 7);
      if (totals.D > 0) cy = drawBillRow('ส่วนลด', `−${fmt(pt.discount)}`, cy, CC.ok, '13px', 7);
      cy += 8;
      drawLine(cy);
      drawRoundedRect(PAD, y + cH - (44 + CP), INNER, 44 + CP, [0, 0, CR, CR]);
      ctx.fillStyle = CC.accBg;
      ctx.fill();
      drawText('ยอดรวม', PAD + CP, cy + 30, '600 14px "Sarabun",sans-serif', CC.mut);
      drawText(fmt(pt.total), CW - PAD - CP, cy + 32, '700 20px "Sarabun",sans-serif', neg ? CC.red : CC.acc, 'right');
    } else {
      drawText('⚠ ยังไม่ได้เลือกเมนูใด', PAD + CP, cy + 22, '400 13px "Sarabun",sans-serif', CC.red);
    }
    y += cH + GAP;
  });
  y += 16;
  drawText('ยอดรวมบิล', PAD, y + 20, '700 11px "Sarabun",sans-serif', CC.dim);
  y += SLH;
  const bcH = billCardHeight();
  drawRoundedRect(PAD, y, INNER, bcH, CR);
  ctx.fillStyle = CC.card;
  ctx.fill();
  drawRoundedRect(PAD, y, INNER, bcH, CR);
  ctx.strokeStyle = CC.bdr;
  ctx.lineWidth = 1;
  ctx.stroke();
  let by = y + CP;
  by = drawBillRow('ยอดรวมย่อย', fmt(totals.Sb), by, CC.text, '14px', 6);
  if (state.service.enabled) by = drawBillRow(`Service Charge (${displayRate(state.service.value)}%)`, `+${fmt(totals.svcAmt)}`, by, CC.text, '14px', 6);
  if (state.tax.enabled) by = drawBillRow(`VAT (${displayRate(state.tax.value)}%)`, `+${fmt(totals.vatAmt)}`, by, CC.text, '14px', 6);
  if (totals.D > 0) by = drawBillRow('ส่วนลด', `−${fmt(totals.D)}`, by, CC.ok, '14px', 6);
  by += 8;
  drawLine(by);
  drawRoundedRect(PAD, y + bcH - (44 + CP), INNER, 44 + CP, [0, 0, CR, CR]);
  ctx.fillStyle = CC.accBg;
  ctx.fill();
  drawText('ยอดที่ต้องจ่าย', PAD + CP, by + 30, '600 14px "Sarabun",sans-serif', CC.mut);
  drawText(fmt(totals.grand), CW - PAD - CP, by + 34, '700 22px "Sarabun",sans-serif', CC.acc, 'right');
  y += bcH + PAD;
  drawText('หารจ่าย แฟร์ๆ', CW / 2, y + 22, '600 13px "Sarabun",sans-serif', CC.dim, 'center');
  drawText('UX Design by Map Tharit Banchanurat', CW / 2, y + 40, '400 11px "Sarabun",sans-serif', CC.dim, 'center');
  await new Promise(resolve => canvas.toBlob(blob => {
    try {
      if (!blob) {
        toast('สร้างรูปภาพไม่ได้ ลองดาวน์โหลดอีกครั้ง');
        return;
      }
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = billFilename(capture.name, 'jpg');
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 1000);
      toast('เริ่มดาวน์โหลดแล้ว');
    } catch (error) {
      toast('เริ่มดาวน์โหลดไม่ได้ ลองอีกครั้ง: ' + error.message);
    } finally {
      resolve();
    }
  }, 'image/jpeg', 0.92));
}
