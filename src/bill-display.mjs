export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;
const r4 = value => round(value, 4);
export const getItemTotal = item => item.authoritativeTotalCents != null ? item.authoritativeTotalCents / 100 : r4((parseFloat(item.price) || 0) * Math.max(parseInt(item.quantity) || 1, 1));
const formatNumber = (v, trim = false) => {
  const a = Math.abs(v),
    pts = a.toFixed(2).split('.');
  const dec = trim ? pts[1].replace(/0+$/, '') : pts[1];
  const int = (v < 0 ? '−' : '') + pts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec ? int + '.' + dec : int;
};
export const fmt = (v, suffix = 'บาท') => formatNumber(v) + ' ' + suffix;
export const fmtTrim = (v, suffix = 'บาท') => formatNumber(v, true) + ' ' + suffix;
export const fmtComma = v => {
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? '' : formatNumber(n);
};
export const displayRate = v => String(Math.round((v || 0) * 100) / 100);
export const fP = v => (typeof v === 'number' ? v : 0).toFixed(2) + '%';

export {MAIN_ICONS} from './ui-icons.mjs';
