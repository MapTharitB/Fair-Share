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
export function renderChargeCard(kind, label, view) {
  return [
    `<div class="sum-card" data-summary-card="${kind}">`,
    `<div class="sum-lbl">${label}`,
    `</div>`,
    `<div class="sum-pair">`,
    `<div class="sum-field canonical">`,
    `<input class="sum-input" data-summary-input="${kind}:rate" value="${escapeHtml(formatPctForDisplay(view.rate))}" inputmode="decimal" enterkeyhint="done" autocomplete="off" spellcheck="false" />`,
    `<span class="sum-field-lbl">%</span>`,
    `</div>`,
    `<div class="sum-field derived">`,
    `<input class="sum-input" data-summary-input="${kind}:amount" value="${escapeHtml(formatMoneyDisplay(view.amount))}" inputmode="decimal" enterkeyhint="done" autocomplete="off" spellcheck="false" />`,
    `<span class="sum-field-lbl">฿</span>`,
    `</div>`,
    `</div>`,
    `</div>`
  ].join('');
}
export function renderDiscountCard(view) {
  const isPercent = view.mode === "rate";
  return [
    `<div class="sum-card" data-summary-card="discount">`,
    `<div class="sum-lbl">ส่วนลด`,
    `</div>`,
    `<div class="sum-pair">`,
    `<div class="sum-field ${isPercent ? 'canonical' : 'derived'}">`,
    `<input class="sum-input" data-summary-input="discount:rate" value="${escapeHtml(formatPctForDisplay(view.rate))}" inputmode="decimal" enterkeyhint="done" autocomplete="off" spellcheck="false" />`,
    `<span class="sum-field-lbl">%</span>`,
    `</div>`,
    `<div class="sum-field ${!isPercent ? 'canonical' : 'derived'}">`,
    `<input class="sum-input" data-summary-input="discount:amount" value="${escapeHtml(formatMoney(Math.abs(view.amount)))}" inputmode="decimal" enterkeyhint="done" autocomplete="off" spellcheck="false" />`,
    `<span class="sum-field-lbl">฿</span>`,
    `</div>`,
    `</div>`,
    `</div>`
  ].join('');
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
