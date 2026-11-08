import { esc as escapeHtml } from './bill-display.mjs';
export function formatMoney(n) {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}
export function formatMoneyDisplay(n) {
  const num = Number.isFinite(n) ? n : 0;
  const [i, d] = num.toFixed(2).split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + d;
}
export function formatPctForDisplay(rate) {
  if (!Number.isFinite(rate)) return "0";
  const r = Math.round(rate * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
function renderAdjustmentCard(kind, label, rate, amount, canonical, shortLabel='') {
  const fields = [['rate',rate,'%'],['amount',amount,'฿']].map(([field,value,unit])=>
    `<div class="sum-field ${field===canonical?'canonical':'derived'}">
      <input class="sum-input" data-summary-input="${kind}:${field}" aria-label="${label} (${unit})" value="${escapeHtml(value)}" inputmode="decimal" enterkeyhint="done" autocomplete="off" spellcheck="false" />
      <span class="sum-field-lbl" aria-hidden="true">${unit}</span>
    </div>`).join('');
  const responsiveLabel = shortLabel ? ` data-full-label="${label}" data-short-label="${shortLabel}"` : '';
  return `<div class="sum-card" data-summary-card="${kind}">
    <div class="sum-lbl"${responsiveLabel}>${label}</div>
    <div class="sum-pair">${fields}</div>
  </div>`;
}
export function renderChargeCard(kind, label, view, shortLabel) {
  return renderAdjustmentCard(kind,label,formatPctForDisplay(view.rate),formatMoneyDisplay(view.amount),'rate',shortLabel);
}
export function renderDiscountCard(view) {
  return renderAdjustmentCard('discount','ส่วนลด',formatPctForDisplay(view.rate),
    formatMoney(Math.abs(view.amount)),view.mode==='rate'?'rate':'amount');
}
export function flattenHtmlTable(html) {
  if (!/<table|<tr/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows = doc.querySelectorAll("tr");
  if (!rows.length) return null;
  const lines = [];
  rows.forEach(row => {
    const cells = row.querySelectorAll("td, th");
    if (!cells.length) return;
    const parts = [];
    cells.forEach(cell => {
      const t = (cell.textContent || "").replace(/\s+/g, " ").trim();
      parts.push(t);
    });
    if (parts.some(p => p.length > 0)) lines.push(parts.join("\t"));
  });
  return lines.length ? lines.join("\n") : null;
}
