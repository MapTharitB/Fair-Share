// src/ui-icons.mjs
var BIN_GEOMETRY = `<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>`;
function binIcon({ receipt = false } = {}) {
  const variant = receipt ? ' fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"' : "";
  return `<svg viewBox="0 0 24 24"${variant}>${BIN_GEOMETRY}</svg>`;
}
var MAIN_ICONS = {
  lock: `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  unlock: `<svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,
  bin: binIcon(),
  download: `<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" class="icon-plus"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  camera: `<svg viewBox="0 0 24 24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`
};

// src/bill-display.mjs
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
var round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;
var r4 = (value) => round(value, 4);
var getItemTotal = (item) => item.authoritativeTotalCents != null ? item.authoritativeTotalCents / 100 : r4((parseFloat(item.price) || 0) * Math.max(parseInt(item.quantity) || 1, 1));
var formatNumber = (v, trim = false) => {
  const a = Math.abs(v), pts = a.toFixed(2).split(".");
  const dec = trim ? pts[1].replace(/0+$/, "") : pts[1];
  const int = (v < 0 ? "−" : "") + pts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec ? int + "." + dec : int;
};
var fmt = (v, suffix = "บาท") => formatNumber(v) + " " + suffix;
var fmtTrim = (v, suffix = "บาท") => formatNumber(v, true) + " " + suffix;
var fmtComma = (v) => {
  const n = parseFloat(String(v).replace(/,/g, ""));
  return isNaN(n) ? "" : formatNumber(n);
};
var displayRate = (v) => String(Math.round((v || 0) * 100) / 100);
var fP = (v) => (typeof v === "number" ? v : 0).toFixed(2) + "%";

// src/receipt-display.mjs
function formatMoney(n) {
  return (Number.isFinite(n) ? n : 0).toFixed(2);
}
function formatMoneyDisplay(n) {
  const num = Number.isFinite(n) ? n : 0;
  const [i, d] = num.toFixed(2).split(".");
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + d;
}
function formatPctForDisplay(rate) {
  if (!Number.isFinite(rate)) return "0";
  const r = Math.round(rate * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
function renderAdjustmentCard(kind, label, rate, amount, canonical, shortLabel = "") {
  const fields2 = [["rate", rate, "%"], ["amount", amount, "฿"]].map(([field, value, unit]) => `<div class="sum-field ${field === canonical ? "canonical" : "derived"}">
      <input class="sum-input" data-summary-input="${kind}:${field}" aria-label="${label} (${unit})" value="${esc(value)}" inputmode="decimal" enterkeyhint="done" autocomplete="off" spellcheck="false" />
      <span class="sum-field-lbl" aria-hidden="true">${unit}</span>
    </div>`).join("");
  const responsiveLabel = shortLabel ? ` data-full-label="${label}" data-short-label="${shortLabel}"` : "";
  return `<div class="sum-card" data-summary-card="${kind}">
    <div class="sum-lbl"${responsiveLabel}>${label}</div>
    <div class="sum-pair">${fields2}</div>
  </div>`;
}
function renderChargeCard(kind, label, view, shortLabel) {
  return renderAdjustmentCard(kind, label, formatPctForDisplay(view.rate), formatMoneyDisplay(view.amount), "rate", shortLabel);
}
function renderDiscountCard(view) {
  return renderAdjustmentCard(
    "discount",
    "ส่วนลด",
    formatPctForDisplay(view.rate),
    formatMoney(Math.abs(view.amount)),
    view.mode === "rate" ? "rate" : "amount"
  );
}
function flattenHtmlTable(html) {
  if (!/<table|<tr/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const rows = doc.querySelectorAll("tr");
  if (!rows.length) return null;
  const lines = [];
  rows.forEach((row) => {
    const cells = row.querySelectorAll("td, th");
    if (!cells.length) return;
    const parts = [];
    cells.forEach((cell) => {
      const t = (cell.textContent || "").replace(/\s+/g, " ").trim();
      parts.push(t);
    });
    if (parts.some((p) => p.length > 0)) lines.push(parts.join("	"));
  });
  return lines.length ? lines.join("\n") : null;
}

// src/history-controls.mjs
var icon = (redo2) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${redo2 ? "M21 10a9 9 0 1 0-2.6 8.4M21 4v6h-6" : "M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6"}"/></svg>`;
function historyNeedsCompact(labelWidth, availableWidth) {
  return 2 * (labelWidth + 39) + 4 > availableWidth;
}
function mountHistoryControls(host, { scope, onUndo, onRedo, editors: editors2 }) {
  host.classList.add("history-controls");
  const buttons = [["ย้อนกลับ", onUndo, false], ["ทำซ้ำ", onRedo, true]].map(([label, action, redo2]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-button";
    button.setAttribute("aria-label", label + " " + scope);
    button.title = label + " " + scope;
    button.innerHTML = icon(redo2);
    const text2 = document.createElement("span");
    text2.textContent = label;
    button.append(text2);
    host.append(button);
    if (editors2) editors2.bind(button, action);
    else button.onclick = action;
    return button;
  });
  return { update({ canUndo, canRedo, compact = false }) {
    buttons[0].disabled = !canUndo;
    buttons[1].disabled = !canRedo;
    host.classList.toggle("compact", compact);
  }, dispose() {
    host.replaceChildren();
  } };
}

// src/receipt-layout.mjs
var RECEIPT_PLACEHOLDER = "หากอ่านภาพใบเสร็จไม่แม่นยำ\nโปรดถ่ายภาพให้ตรง และคมชัด\nหรือใช้ฟีเจอร์คัดลอกข้อความจากภาพ\nบนอุปกรณ์ของคุณนำมาวางแทน";
var widePlaceholder = "หากอ่านภาพใบเสร็จไม่แม่นยำ โปรดถ่ายภาพให้ตรง และคมชัด\nหรือใช้ฟีเจอร์คัดลอกข้อความจากภาพบนอุปกรณ์ของคุณนำมาวางแทน";
function widthOf(text2, style) {
  const probe = document.createElement("span");
  probe.className = "text-measure-probe";
  probe.style.font = style.font;
  probe.style.letterSpacing = style.letterSpacing;
  probe.textContent = text2;
  document.body.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}
function updateReceiptPlaceholder() {
  const ta = document.getElementById("receiptText");
  if (!ta) return;
  const style = getComputedStyle(ta), placeholder = getComputedStyle(ta, "::placeholder");
  const available = ta.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  ta.placeholder = Math.max(...widePlaceholder.split("\n").map((line) => widthOf(line, placeholder))) <= available + 0.5 ? widePlaceholder : RECEIPT_PLACEHOLDER;
}
function fitAdjustmentLabel() {
  const label = document.querySelector(".sum-lbl[data-short-label]");
  if (!label) return;
  const { fullLabel, shortLabel } = label.dataset;
  const width = widthOf(fullLabel.toUpperCase(), getComputedStyle(label));
  const text2 = width <= label.getBoundingClientRect().width ? fullLabel : shortLabel;
  if (label.textContent !== text2) label.textContent = text2;
}
function fitSummaryTotals() {
  const bar = document.getElementById("summaryBar");
  if (!bar) return;
  const needsStack = [...bar.children].some((card) => {
    const [label, amount] = card.children;
    const style = getComputedStyle(card);
    const insets = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const available = card.getBoundingClientRect().width - insets;
    const required = label.getBoundingClientRect().width + amount.getBoundingClientRect().width + parseFloat(style.columnGap);
    return required > available;
  });
  bar.classList.toggle("is-stacked", needsStack);
}
function mountReceiptLayout({ onLayout = () => {
} } = {}) {
  const controller = new AbortController(), signal = controller.signal;
  let frame = 0;
  function update() {
    frame = 0;
    const pair = document.querySelector("#receipt-history");
    if (pair) {
      const header = document.querySelector(".top-bar"), style = getComputedStyle(header), title = header.querySelector(".top-title");
      const labelWidth = widthOf("ย้อนกลับ", getComputedStyle(pair.querySelector("button")));
      pair.style.setProperty("--history-label-width", labelWidth + "px");
      const inner = header.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), add = document.getElementById("addBtn")?.offsetWidth ?? 0;
      const titleWidth = widthOf(title.textContent, getComputedStyle(title)), minimum = titleWidth + 44 + 92 + add + 24, secondary = document.getElementById("subBar");
      if (secondary && !pair.contains(document.activeElement)) {
        const below = minimum > inner;
        secondary.hidden = !below;
        if (below && pair.parentElement !== secondary) secondary.append(pair);
        else if (!below && pair.parentElement !== header) header.insertBefore(pair, document.getElementById("addBtn"));
      }
      pair.classList.toggle("compact", historyNeedsCompact(labelWidth, pair.parentElement === secondary ? inner : inner - titleWidth - 44 - add - 24));
    }
    updateReceiptLayout();
    onLayout();
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  window.addEventListener("resize", schedule, { signal });
  window.addEventListener("scroll", schedule, { capture: true, passive: true, signal });
  window.visualViewport?.addEventListener("resize", schedule, { signal });
  window.visualViewport?.addEventListener("scroll", schedule, { signal });
  const observer = new ResizeObserver(schedule);
  for (const el of [document.querySelector(".top-bar"), document.querySelector(".submit-wrap-inner"), document.querySelector(".summary-grid")]) if (el) observer.observe(el);
  document.fonts?.ready.then(() => {
    if (!signal.aborted) schedule();
  });
  schedule();
  return () => {
    controller.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}
function updateStickyOffsets() {
  const topBar = document.querySelector(".top-bar");
  const subBar = document.getElementById("subBar");
  const submitInner = document.querySelector(".submit-wrap-inner");
  if (!topBar) return;
  const topH = topBar.getBoundingClientRect().height;
  const subVisible = subBar && window.getComputedStyle(subBar).display !== "none";
  const subH = subVisible ? subBar.getBoundingClientRect().height : 0;
  const submitH = submitInner ? submitInner.getBoundingClientRect().height : 60;
  document.documentElement.style.setProperty("--sticky-top-2", topH + "px");
  document.documentElement.style.setProperty("--sticky-top-3", topH + subH + "px");
  document.documentElement.style.setProperty("--submit-reserve", submitH + 24 + "px");
}
function updateSwapButtonAlignment() {
  const p2Th = document.getElementById("swapColsBtn")?.closest("th");
  if (!p2Th) return;
  const p1Th = p2Th.previousElementSibling;
  if (!p1Th) return;
  const p1Label = p1Th.querySelector(".th-label");
  const p2Label = p2Th.querySelector(".th-label");
  if (!p1Label || !p2Label) return;
  const pointA = p1Label.getBoundingClientRect().right;
  const pointB = p2Label.getBoundingClientRect().left;
  const midX = (pointA + pointB) / 2;
  const p2ThRect = p2Th.getBoundingClientRect();
  const leftInP2 = midX - p2ThRect.left;
  const numWidth = Math.max(20, p2ThRect.width - leftInP2 - 11 - 7);
  document.documentElement.style.setProperty("--swap-btn-left", `${leftInP2}px`);
  document.documentElement.style.setProperty("--p2-num-width", `${numWidth}px`);
}
function fitP2Numbers() {
  const numWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--p2-num-width")) || 0;
  if (numWidth <= 0) return;
  document.querySelectorAll("[data-p2-num]").forEach((span) => {
    span.style.fontSize = "";
    let fs = parseFloat(window.getComputedStyle(span).fontSize) || 12;
    while (span.scrollWidth > numWidth && fs > 8) {
      fs = Math.max(8, fs - 0.5);
      span.style.fontSize = `${fs}px`;
    }
  });
}
function updateReceiptLayout() {
  updateReceiptPlaceholder();
  fitAdjustmentLabel();
  fitSummaryTotals();
  updateStickyOffsets();
  updateSwapButtonAlignment();
  fitP2Numbers();
}

// src/receipt-parser.mjs
function createReceiptParser({ createId = () => Math.random().toString(36).slice(2, 9) } = {}) {
  const UNIT_WORDS = /* @__PURE__ */ new Set(["ขวด", "แก้ว", "จาน ", "ชาม", "ชิ้น", "ถ้วย", "ชุด", "แพ็ค", "กล่อง", "กระป๋อง", "โหล", "ถุง", "อัน", "ที่", "หัว", "ตัว", "กิโล", "กก", "ลิตร", "มล", "คู่", "แผ่น", "เส้น", "portion", "pcs", "pc", "set", "bottle", "glass", "can", "box", "cup", "bowl"]);
  const r2 = (n) => Math.round(n * 100) / 100;
  const uid2 = createId;
  const stripPunct = (s) => String(s || "").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").trim();
  function nfc(s) {
    return String(s ?? "").normalize("NFC");
  }
  const SUMMARY_MORPHEMES_TH = ["ทั้งสิ้น", "ยอด", "รวม", "สุทธิ", "ราคา", "ภาษี", "เงิน", "ชำระ", "จ่าย", "ทอน", "ก่อน", "หลัง", "ค่า", "สินค้า", "ทั้ง", "หมด", "อาหาร"];
  const SAFE_COLUMN_MORPHEMES = ["รายการสินค้า", "ราคาสินค้า", "จำนวนเงิน", "หน่วยละ", "รายการ", "สินค้า", "อาหาร", "จำนวน", "หน่วย", "ราคา", "รหัส", "ชิ้น"];
  function coversBy(word, morphemeList) {
    const n = word.length;
    const reach = new Uint8Array(n + 1);
    reach[0] = 1;
    for (let i = 0; i < n; i++) {
      if (!reach[i]) continue;
      for (const m of morphemeList) {
        if (i + m.length <= n && word.slice(i, i + m.length) === m) reach[i + m.length] = 1;
      }
    }
    return reach[n] === 1;
  }
  function isSummaryByComposition(line) {
    const s = nfc(String(line || "")).trim();
    const words = s.replace(/[\d%.,฿$()\-:;/\\]+/g, " ").trim().split(/\s+/).filter((w) => /\p{L}/u.test(w));
    return words.length > 0 && words.every((w) => coversBy(w, SUMMARY_MORPHEMES_TH));
  }
  const SAFE_PLUS_SUMMARY = [...SAFE_COLUMN_MORPHEMES, ...SUMMARY_MORPHEMES_TH];
  const FIELD_LABEL_RE = /^(?:qty|quantity|จำนวน|price|ราคา|unit\s*price|หน่วยละ|line\s*total|จำนวนเงิน|amount|สินค้า|อาหาร|รายการ|รายการสินค้า|ราคาสินค้า|item\s*(?:id|no\.?)|no\.?|เลขที่|table|โต๊ะ|order|invoice|bill|receipt|ref|code|id|branch|สาขา|staff|cashier|พนักงาน|แคชเชียร์|ลูกค้า|customer|phone|tel|telephone|mobile|มือถือ|โทร|เบอร์|date|time|วันที่|เวลา|รหัส|ชิ้น|sku|covers|pax|guests|duration|event)$/i;
  const DATE_RE = /^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/;
  const TIME_RE = /^\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?$/;
  const PHONE_RE = /^0\d[\d\s-]{7,9}$/;
  const LONG_NUM_RE = /^\d{7,}$/;
  const ALNUM_ID_RE = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9][A-Za-z0-9-]{5,}$/;
  const SEPARATOR_RE = /^[-=*─━·•─═]{3,}$/;
  const DISCOUNT_RE = /(?:^-\s*\d|ส่วนลด|ลดราคา|ลดพิเศษ|หักส่วนลด|discount|disc\.?|promo(?:tion|โมชั่น)?|coupon|คูปอง|voucher|วาวเชอร์|rebate)/i;
  const POST_DISCOUNT_TOTAL_RE = /^(?:ยอด|รวม|net|total|ราคา)\S*(?:หลัง|after)/iu;
  const KV_PAIR_RE = /\b([\p{L}][\p{L} ]{1,20}):\s*\S+/gu;
  const KV_META_KEY_RE = /^(?:table|โต๊ะ|cover|covers|pax|guests|staff|cashier|แคชเชียร์|date|time|วันที่|เวลา|order|invoice|ref|duration|event|branch|สาขา|phone|tel|โทร|time\s*in|time\s*out|in|out)$/i;
  function isMultiKVMetaLine(line) {
    const matches = [...nfc(line).matchAll(KV_PAIR_RE)];
    if (matches.length < 2) return false;
    return matches.some((m) => KV_META_KEY_RE.test(m[1].trim()));
  }
  function isSafeColumnHeader(line) {
    const s = nfc(String(line || "")).trim();
    if (!/\p{L}/u.test(s)) return false;
    const words = s.replace(/[\d%.,฿$€()\-:;/\\]+/g, " ").trim().split(/\s+/).filter((w) => /\p{L}/u.test(w));
    if (!words.length) return false;
    const isCovered = (w) => FIELD_LABEL_RE.test(w) || coversBy(w, SAFE_PLUS_SUMMARY);
    const isSafe = (w) => FIELD_LABEL_RE.test(w) || coversBy(w, SAFE_COLUMN_MORPHEMES);
    return words.every(isCovered) && words.some(isSafe);
  }
  const STRONG_SUMMARY_RE = /^(?:subtotal|sub\stotal|grand\stotal|net\stotal|total|amount\sdue|balance\sdue|balance|ยอดรวม|ยอดช(?:ำ|ํา)ระ|ยอดสุทธิ|ยอดรวมสุทธิ|ยอดรวมทั้งสิ้น|ยอดที่ต้องช(?:ำ|ํา)ระ|ยอดเงิน|รวมสุทธิ|รวมทั้งสิ้น|รวมเงิน|สุทธิ|ทั้งสิ้น|ราคารวม|ราคาสุทธิ|ก่อนภาษี|หลังภาษี|ภาษีมูลค่าเพิ่ม|ภาษี|เงินสด|เงินทอน|ทอน|รับเงิน|จ่ายเงิน|ช(?:ำ|ํา)ระเงิน|พร้อมเพย์|promptpay|prompt\spay|qr\scode|qr|credit\scard|debit\s*card|transfer|โอนเงิน|บัตรเครดิต|บัตรเดบิต|service\scharge|servicecharge|svc\scharge|ค่าบริการ|ค่าเซอร์วิส|rounding|rounded|change|before\s+(?:vat|tax)|after\s+(?:vat|tax)|vat\s+(?:item|items|included|inclusive|exclusive|excl\.?|incl\.?|amount|exempt|zero|rate|subtotal|sub)|ex(?:cl(?:uding)?)?\.?\s*(?:vat|tax)|inc(?:l(?:uding)?)?\.?\s*(?:vat|tax)|vat|value\sadded\stax|visa|amex|american\s+express|jcb|union\s*pay|alipay|paypal|wechat(?:\s*pay)?|true\s+money|line\s+pay|grab\s+pay|shopeepay|shopee\s+pay|e[\s\-]?wallet|gift\s*(?:card|voucher)|master\s*card|rabbit\s*(?:card|pay)|discover\s*card|point\s*(?:redeem(?:ed)?|reward)|(?:ยอด|รวม|net|total|ราคา)\S*(?:หลัง|after)|ใบเสร็จ(?:รับเงิน)?|ใบก(?:ำ|ํา)กับภาษี(?:อย่างย่อ)?|ใบแจ้งหนี้|ใบสั่งซื้อ|tax\s+invoice|ใบเสนอราคา|quotation)(?=[\s%.,฿$\d()\-:]|$)/i;
  const WEAK_SUMMARY_RE = /^(?:รวม|ยอด|tip|cash)(?=[\s%.,฿$\d()\-]|$)/i;
  const MULTI_KW_SUMMARY_SET = ["สุทธิ", "ชำระ", "ส่วนลด", "รวม", "ยอด", "ราคา", "ภาษี", "vat", "tax", "total", "discount"];
  const SUMMARY_NAME_RE = /^(?:subtotal|sub\stotal|grand\stotal|net\stotal|total|amount\sdue|balance\sdue|ยอดรวม|ยอดชำระ|ยอดสุทธิ|ยอดรวมสุทธิ|ยอดรวมทั้งสิ้น|ยอดที่ต้องชำระ|ยอดเงิน|รวมสุทธิ|รวมทั้งสิ้น|รวมเงิน|รวม|สุทธิ|ยอด|ทั้งสิ้น|ราคารวม|ราคาสุทธิ|ก่อนภาษี|หลังภาษี|เงินสด|เงินทอน|ทอน|รับเงิน|จ่าย|ชำระเงิน|พร้อมเพย์|promptpay|qr|qr\scode|credit\scard|debit\s*card|transfer|โอนเงิน|บัตรเครดิต|บัตรเดบิต|service\scharge|servicecharge|svc\scharge|ค่าบริการ|ค่าเซอร์วิส|vat|ภาษีมูลค่าเพิ่ม|ภาษี|rounding|rounded|cash|change|balance|tip|before\s+(?:vat|tax)|after\s+(?:vat|tax)|vat\s+(?:item|items|included|inclusive|exclusive|excl\.?|incl\.?|amount|exempt|zero|rate|subtotal|sub)|ex(?:cl(?:uding)?)?\.?\s*(?:vat|tax)|inc(?:l(?:uding)?)?\.?\s*(?:vat|tax))$/i;
  const TAX_SUBLABEL_RE = /^(?:item|items?|included|inclusive|exclusive|excl\.?|incl\.?|before|after|amount|rate|exempt|zero):?\s*/i;
  function isSummaryOrMetaLine(line) {
    const s = nfc(String(line || "").trim());
    if (!s) return false;
    if (isSafeColumnHeader(s)) return true;
    if (STRONG_SUMMARY_RE.test(s)) return true;
    if (isMultiKVMetaLine(s)) return true;
    if (/^sc(?=[\s%.,\d]|$)/i.test(s)) {
      const after = s.replace(/^sc\s*/i, "").trim();
      if (after === "" || /\d/.test(after) && /^[%\d\s.,฿$()\-]*$/.test(after)) return true;
    }
    if (WEAK_SUMMARY_RE.test(s)) {
      const afterKeyword = s.replace(WEAK_SUMMARY_RE, "").trim();
      if (!afterKeyword) return true;
      if (/\d/.test(afterKeyword) && /^[%\d\s.,(),฿$()\-]*$/.test(afterKeyword)) return true;
      if (TAX_SUBLABEL_RE.test(afterKeyword)) {
        const remainder = afterKeyword.replace(TAX_SUBLABEL_RE, "").trim();
        if (!remainder || /\d/.test(remainder) && /^[%\d\s.,(),฿$()\-]*$/.test(remainder)) return true;
      }
    }
    if (/\d/.test(s) && isSummaryByComposition(s)) return true;
    return false;
  }
  function quickClassify(line) {
    const s = nfc(String(line || "")).trim();
    if (!s) return "empty";
    if (isSummaryOrMetaLine(s)) return "meta";
    return "item";
  }
  function normalizeText2(raw) {
    return String(raw ?? "").normalize("NFC").replace(/\u00A0|\u3000|\uFEFF/g, " ").replace(/\t+/g, " ").replace(/\r/g, "").replace(/[，]/g, ",").replace(/[．｡。]/g, ".").split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
  }
  function looksComplete(line) {
    const ts = String(line || "").trim().split(/\s+/);
    return ts.length > 0 && /^-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$|^-?\d+(?:\.\d{1,2})?$/.test(ts[ts.length - 1]);
  }
  function collapseVerticalOCR(lines) {
    const isPureNumericLine = (line) => {
      const s = String(line ?? "").trim();
      return /^-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$|^-?\d+(?:\.\d{1,2})?$/.test(s) || /^\d{1,2}$/.test(s);
    };
    const isCategoryHeaderCandidate = (line) => {
      const s = String(line ?? "").trim();
      return s.length > 0 && s.length < 30 && !/\d/.test(s);
    };
    let pureNumericCount = 0;
    for (const line of lines) {
      if (isSummaryOrMetaLine(line)) continue;
      if (isPureNumericLine(line)) pureNumericCount++;
    }
    const numericRatio = lines.length ? pureNumericCount / lines.length : 0;
    if (!(pureNumericCount >= 3 && numericRatio >= 0.2)) return lines;
    const result = [];
    let i = 0;
    while (i < lines.length) {
      const current = lines[i];
      if (isPureNumericLine(current)) {
        i++;
        continue;
      }
      const nameParts = [];
      const first = String(current ?? "").trim();
      if (first) nameParts.push(first);
      i++;
      while (i < lines.length && !isPureNumericLine(lines[i]) && nameParts.length < 3) {
        const part = String(lines[i] ?? "").trim();
        if (part) nameParts.push(part);
        i++;
      }
      const numericParts = [];
      while (i < lines.length && isPureNumericLine(lines[i])) {
        numericParts.push(String(lines[i] ?? "").trim());
        i++;
      }
      if (!numericParts.length) {
        if (isCategoryHeaderCandidate(nameParts[0] || "")) continue;
        continue;
      }
      result.push([...nameParts, ...numericParts].join(" ").replace(/\s+/g, " ").trim());
    }
    return result;
  }
  function mergeWrappedLines2(lines) {
    const out = [];
    let i = 0;
    let prevWasMeta = false;
    while (i < lines.length) {
      const cur = lines[i];
      const curIsMeta = quickClassify(cur) === "meta";
      if (curIsMeta || looksComplete(cur) || prevWasMeta) {
        out.push(cur);
        prevWasMeta = curIsMeta;
        i++;
        continue;
      }
      prevWasMeta = false;
      const next = lines[i + 1] ?? null;
      const after = lines[i + 2] ?? null;
      if (next && quickClassify(next) !== "meta" && !looksComplete(next) && after && quickClassify(after) !== "meta" && looksComplete(after)) {
        out.push(`${cur} ${next} ${after}`.replace(/\s+/g, " ").trim());
        i += 3;
        continue;
      }
      if (next && quickClassify(next) !== "meta" && /\d/.test(next)) {
        out.push(`${cur} ${next}`.replace(/\s+/g, " ").trim());
        i += 2;
        continue;
      }
      out.push(cur);
      i++;
    }
    return out;
  }
  function cleanToken(raw) {
    return stripPunct(raw).replace(/,/g, "");
  }
  function isNoiseToken(raw) {
    const s = cleanToken(raw);
    if (!s) return true;
    if (DATE_RE.test(s)) return true;
    if (TIME_RE.test(s)) return true;
    if (PHONE_RE.test(s)) return true;
    if (LONG_NUM_RE.test(s)) return true;
    if (ALNUM_ID_RE.test(s)) return true;
    if (SEPARATOR_RE.test(raw)) return true;
    if (FIELD_LABEL_RE.test(s)) return true;
    return false;
  }
  function isSwallowLabel(raw) {
    const s = cleanToken(raw).toLowerCase();
    return /^(?:no\.?|เลขที่|table|โต๊ะ|phone|tel|telephone|mobile|มือถือ|โทร|เบอร์|qty|quantity|จำนวน|ราคา|price|unit|หน่วยละ|amount|จำนวนเงิน|subtotal|total|grand|net|ยอดรวม|ยอดชำระ|ยอดสุทธิ|รวมสุทธิ|รวม|สุทธิ|ยอด|ทั้งสิ้น|เงินสด|เงินทอน|ทอน|รับเงิน|ชำระเงิน|vat|ภาษี|order|invoice|bill|receipt|ref|id|code|date|time|วันที่|เวลา|สาขา|branch|staff|cashier|พนักงาน|แคชเชียร์|ลูกค้า|customer|cash|change|balance|tip|rounding)$/i.test(s);
  }
  function stripNoiseTokens(line) {
    const tokens = nfc(String(line || "").trim()).split(/\s+/).filter(Boolean);
    const kept = [];
    let swallowNext = false;
    for (let i = 0; i < tokens.length; i++) {
      const raw = tokens[i];
      const clean = cleanToken(raw);
      if (!clean) continue;
      if (/^(?:qty|quantity|จำนวน)$/i.test(clean) && /^\d{1,2}$/.test(tokens[i + 1] ?? "")) {
        swallowNext = false;
        continue;
      }
      if (isSwallowLabel(raw)) {
        swallowNext = true;
        continue;
      }
      if (swallowNext) {
        if (/^(?:-?\d+(?:[.,]\d{1,2})?|0(?:[\s-]*\d){7,}|(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{2,})$/.test(clean)) {
          swallowNext = false;
          continue;
        }
        swallowNext = false;
      }
      if (isNoiseToken(raw)) continue;
      kept.push(raw);
    }
    return kept.join(" ").replace(/\s+/g, " ").trim();
  }
  function tokenizeLine(line) {
    return nfc(String(line || "").trim()).split(/\s+/).filter(Boolean).map((raw) => {
      const clean = raw.replace(/,/g, "");
      if (/^-?\d+(?:\.\d{1,2})?$/.test(clean)) {
        const value = parseFloat(clean);
        const isDecimal = raw.includes(".");
        const hasThousandsSep = /\d,\d{3}/.test(raw);
        return { type: "number", raw, value, isDecimal, hasThousandsSep, isInteger: Number.isInteger(value) && !isDecimal, isNegative: value < 0, isDefinitelyPrice: isDecimal || hasThousandsSep || Math.abs(value) > 999, couldBeQty: !isDecimal && !hasThousandsSep && Number.isInteger(value) && value >= 1 && value <= 99 };
      }
      if (UNIT_WORDS.has(stripPunct(raw))) return { type: "unit", raw };
      return { type: "text", raw };
    });
  }
  function scoreAssignment(lt, qt, up, tokens, ctx) {
    let s = 0;
    if (lt.isDecimal) s += 20;
    if (lt.hasThousandsSep) s += 18;
    if (lt.value > 999) s += 15;
    else if (lt.value > 99) s += 10;
    else if (lt.value > 20) s += 5;
    else if (lt.value < 5) s -= 6;
    if (lt.isInteger && !lt.isDecimal && !lt.hasThousandsSep) {
      const hasTextToken = tokens.some((t) => t.type === "text" && /\p{L}/u.test(t.raw));
      if (hasTextToken) {
        if (lt.value >= 20 && lt.value <= 500) s += 6;
        else if (lt.value >= 10 && lt.value <= 1e3) s += 3;
      }
    }
    if (lt.i === tokens.length - 1) s += 8;
    else if (lt.i >= tokens.length - 2) s += 3;
    if (ctx) {
      if (lt.value >= ctx.p10 * 0.4 && lt.value <= ctx.p90 * 2.5) s += 8;
      else if (lt.value < ctx.p10 * 0.2 || lt.value > ctx.p90 * 5) s -= 5;
    }
    if (qt) {
      if (qt.value < lt.value) s += 18;
      else if (qt.value > lt.value) s -= 20;
      if (qt.value <= 6) s += 10;
      else if (qt.value <= 12) s += 5;
      else if (qt.value <= 20) s += 2;
      const hasAdjUnit = tokens[qt.i + 1]?.type === "unit" || tokens[qt.i - 1]?.type === "unit";
      if (hasAdjUnit) s += 12;
      const prevTxt = tokens[qt.i - 1]?.type === "text";
      const nextTxt = tokens[qt.i + 1]?.type === "text";
      if (prevTxt && nextTxt) s -= 28;
      else if (prevTxt) s -= 2;
      if (ctx) {
        if (qt.value <= ctx.maxQty + 3) s += 5;
        if (qt.value > ctx.maxQty * 3 + 5) s -= 8;
      }
    }
    if (up && qt) {
      const calc = r2(up.value * qt.value);
      const diff = Math.abs(calc - lt.value);
      if (diff < 0.01) s += 55;
      else if (diff <= 1) s += 45;
      else if (diff <= lt.value * 0.03) s += 20;
      else s -= 30;
      if (up.value <= lt.value) s += 5;
      else s -= 8;
      if (up.isDecimal) s += 3;
    }
    return s;
  }
  function findBestAssignment(tokens, ctx) {
    const nums = tokens.map((t, i) => ({ ...t, i })).filter((t) => t.type === "number" && !t.isNegative);
    if (!nums.length) return null;
    if (nums.length === 1) {
      const n = nums[0];
      const sc = (n.isDefinitelyPrice ? 38 : n.value > 20 ? 25 : 10) + (n.i === tokens.length - 1 ? 8 : 0);
      return { lt: n, qt: null, up: null, score: sc };
    }
    const candidates = [];
    for (const lt of nums) {
      candidates.push({ lt, qt: null, up: null, score: scoreAssignment(lt, null, null, tokens, ctx) });
      for (const qt of nums.filter((n) => n !== lt && n.couldBeQty)) {
        candidates.push({ lt, qt, up: null, score: scoreAssignment(lt, qt, null, tokens, ctx) });
        for (const up of nums.filter((n) => n !== lt && n !== qt)) {
          candidates.push({ lt, qt, up, score: scoreAssignment(lt, qt, up, tokens, ctx) });
        }
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }
  const ITEM_CODE_RE = /^([A-Z][A-Z0-9]{1,7}|\d{2,6})\s+(?=[^\d])/;
  function buildItemRow(p) {
    const qty = p.qty ?? null;
    return { id: uid2(), rawLine: p.rawLine ?? "", lineType: "item", pattern: p.pattern ?? "unknown", itemCode: p.itemCode ?? null, itemName: p.itemName ?? "", qty: qty ?? 1, qtyWasNull: qty == null, unit: p.unit ?? null, priceSource: p.priceSource ?? "line_total", priceValue: p.priceValue ?? 0, confidence: p.confidence ?? 0.5, needsReview: (p.confidence ?? 0.5) < 0.72, isDiscount: false, discountAmount: null, flags: p.flags ?? [] };
  }
  function parseDiscountLine2(rawLine) {
    const s = nfc(String(rawLine || "").trim());
    const tokens = s.split(/\s+/);
    let discountAmount = null;
    for (const t of tokens) {
      const v = parseFloat(t.replace(/,/g, "").replace(/^[(\-]+/, "").replace(/[)]+$/, ""));
      if (isFinite(v) && v > 0) {
        discountAmount = v;
        break;
      }
    }
    const isAmountToken = (t) => {
      const c = t.replace(/,/g, "").replace(/^[(\-]+/, "").replace(/[)]+$/, "");
      return /^\d+(?:\.\d{1,2})?$/.test(c) && parseFloat(c) > 0;
    };
    const label = tokens.filter((t) => !isAmountToken(t)).join(" ").replace(/^[-\s]+/, "").trim() || "ส่วนลด";
    const hasPercent = /%/.test(s);
    return { id: uid2(), rawLine, lineType: "discount", pattern: "discount", itemCode: null, itemName: label, qty: 1, qtyWasNull: false, unit: null, priceSource: "line_total", priceValue: -(discountAmount ?? 0), confidence: discountAmount != null ? 0.92 : 0.5, needsReview: false, isDiscount: true, discountType: hasPercent ? "percent" : "baht", discountAmount: discountAmount ?? 0, flags: [] };
  }
  function mismatchedPrintedRow(tokens, rawLine, itemCode) {
    const [qty, unit, total] = tokens.slice(-3);
    if (!qty?.couldBeQty || unit?.type !== "number" || unit.isNegative || total?.type !== "number" || total.isNegative || !(unit.isDefinitelyPrice || total.isDefinitelyPrice)) return null;
    const name = tokens.slice(0, -3).map((t) => t.raw).join(" ");
    if (!/\p{L}/u.test(name)) return null;
    const calculated = Math.round(unit.value * 100) * qty.value;
    if (calculated === Math.round(total.value * 100)) return null;
    return buildItemRow({
      rawLine,
      itemCode,
      itemName: name,
      qty: qty.value,
      priceValue: total.value,
      confidence: 0.5,
      pattern: "unit-qty-total",
      flags: [{
        type: "calc_mismatch",
        msg: `ราคา ${unit.raw} × ${qty.raw} ไม่ตรงกับยอด ${total.raw} ในใบเสร็จ`
      }]
    });
  }
  function parseItemLine2(rawLine, ctx) {
    const codeMatch = nfc(String(rawLine || "")).match(ITEM_CODE_RE);
    const itemCode = codeMatch?.[1] ?? null;
    const stripped = codeMatch ? rawLine.slice(codeMatch[0].length) : rawLine;
    const tokens = tokenizeLine(stripped);
    const printed = mismatchedPrintedRow(tokens, rawLine, itemCode);
    if (printed) return printed;
    const best = findBestAssignment(tokens, ctx);
    if (!best) return buildItemRow({ rawLine, itemCode, itemName: stripped, confidence: 0.15, pattern: "text-only" });
    const used = new Set([best.lt.i, best.qt?.i, best.up?.i].filter((x) => x != null));
    let unit = null;
    if (best.qt) {
      const after = tokens[best.qt.i + 1];
      const before = tokens[best.qt.i - 1];
      if (after?.type === "unit") {
        unit = stripPunct(after.raw);
        used.add(best.qt.i + 1);
      } else if (before?.type === "unit") {
        unit = stripPunct(before.raw);
        used.add(best.qt.i - 1);
      }
    }
    const itemName = tokens.filter((_, i) => !used.has(i)).map((t) => t.raw).join(" ").trim() || stripped;
    const flags = [];
    if (best.up && best.qt) {
      const calc = r2(best.up.value * best.qt.value);
      if (Math.abs(calc - best.lt.value) > 1) flags.push({ type: "calc_mismatch", msg: `${best.up.value} x ${best.qt.value} = ${calc} != ${best.lt.value}` });
    }
    if (best.qt && best.qt.value >= best.lt.value) flags.push({ type: "qty_gte_price", msg: `qty(${best.qt.value}) >= price(${best.lt.value})` });
    const conf = Math.min(Math.max(0.35 + best.score / 120, 0.2), 0.97);
    let priceSource = "line_total";
    let priceValue = best.lt.value;
    if (best.up) {
      priceSource = "unit_price";
      priceValue = best.up.value;
    } else if (best.qt && best.lt.i < best.qt.i) {
      priceSource = "unit_price";
    }
    const pattern = best.up ? "unit-qty-total" : best.qt ? "item-qty-price" : "item-price-only";
    return buildItemRow({ rawLine, itemCode, itemName, qty: best.qt?.value ?? null, unit, priceSource, priceValue, confidence: conf, flags, pattern });
  }
  function getDerivedValues2(row) {
    const qty = row.qty || 1;
    if (row.priceSource === "unit_price") return { unitPrice: row.priceValue, lineTotal: r2(row.priceValue * qty) };
    return { lineTotal: row.priceValue, unitPrice: r2(row.priceValue / qty) };
  }
  function buildContext(rows) {
    let hc = rows.filter((r) => !r.isDiscount && r.confidence >= 0.72);
    if (hc.length < 2) hc = rows.filter((r) => !r.isDiscount && r.confidence >= 0.5);
    if (hc.length < 2) return null;
    const prices = hc.map((r) => getDerivedValues2(r).lineTotal).filter((v) => v > 0).sort((a, b) => a - b);
    const qtys = hc.map((r) => r.qty);
    const pct = (arr, p) => arr[Math.floor(arr.length * p)] ?? arr[arr.length - 1];
    return { p10: pct(prices, 0.1), p25: pct(prices, 0.25), p75: pct(prices, 0.75), p90: pct(prices, 0.9), minPrice: prices[0], maxPrice: prices[prices.length - 1], maxQty: Math.max(...qtys) };
  }
  const _SC_STRONG = /^(?:service\scharge|servicecharge|svc\scharge|ค่าบริการ|ค่าเซอร์วิส)(?=[\s%.,฿$\d]|$)/i;
  const _VAT_STRONG = /^(?:vat|value\sadded\stax|ภาษีมูลค่าเพิ่ม)(?=[\s%.,฿$\d]|$)/i;
  const _SC_WEAK = /^sc(?=[\s%.,\d]|$)/i;
  const _VAT_WEAK = /^ภาษี(?=[\s%.,฿$\d]|$)/i;
  function _normSumLine(s) {
    return String(s || "").normalize("NFC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  }
  function _extractPct(s) {
    const m = String(s).match(/(\d[\d,]*(?:\.\d+)?)\s*%/);
    return m ? Number(m[1].replace(/,/g, "")) : null;
  }
  function _extractAmt(s) {
    const m = String(s).match(/(-?\d[\d,]*(?:\.\d{1,2})?)\s*$/);
    return m ? parseFloat(m[1].replace(/,/g, "")) : null;
  }
  function countSummaryKeywords(line) {
    const s = nfc(String(line || "")).toLowerCase();
    let count = 0;
    for (const kw of MULTI_KW_SUMMARY_SET) {
      if (s.includes(kw)) {
        count++;
        if (count >= 2) return count;
      }
    }
    return count;
  }
  function isServiceChargeLine(norm) {
    return _SC_STRONG.test(norm) || _SC_WEAK.test(norm);
  }
  function isVatLine(norm) {
    return _VAT_STRONG.test(norm) || _VAT_WEAK.test(norm);
  }
  function isDiscountSummaryLine(raw, norm) {
    return DISCOUNT_RE.test(raw) || DISCOUNT_RE.test(norm);
  }
  function extractSummarySources2(rawLines, onEntries) {
    const entries = rawLines.map((raw, index) => {
      const norm = _normSumLine(raw);
      if (!norm) return null;
      if (POST_DISCOUNT_TOTAL_RE.test(nfc(raw).trim())) return null;
      const pct = _extractPct(raw);
      const amt = _extractAmt(raw);
      if (isServiceChargeLine(norm)) return { kind: "service_charge", raw, norm, index, pct: Number.isFinite(pct) ? pct : null, amt: Number.isFinite(amt) ? Math.abs(amt) : null, hasPct: pct != null, hasAmt: amt != null };
      if (isVatLine(norm)) return { kind: "vat", raw, norm, index, pct: Number.isFinite(pct) ? pct : null, amt: Number.isFinite(amt) ? Math.abs(amt) : null, hasPct: pct != null, hasAmt: amt != null };
      if (isDiscountSummaryLine(raw, norm)) return { kind: "discount", raw, norm, index, pct: Number.isFinite(pct) ? pct : null, amt: Number.isFinite(amt) ? Math.abs(amt) : null, hasPct: pct != null, hasAmt: amt != null };
      return null;
    }).filter(Boolean);
    onEntries?.(entries);
    const scList = entries.filter((e) => e.kind === "service_charge");
    const vatList = entries.filter((e) => e.kind === "vat");
    const discList = entries.filter((e) => e.kind === "discount");
    const pickSCorVAT = (list) => {
      if (!list.length) return null;
      const pctItem = list.find((x) => x.hasPct && Number.isFinite(x.pct));
      if (pctItem) return { mode: "percent", value: pctItem.pct, raw: pctItem.raw, sourceIndex: pctItem.index, sourceCount: list.length };
      const amtItem = list.find((x) => x.hasAmt && Number.isFinite(x.amt));
      if (amtItem) return { mode: "amount", value: amtItem.amt, raw: amtItem.raw, sourceIndex: amtItem.index, sourceCount: list.length };
      return null;
    };
    const discountPct = discList.find((x) => x.hasPct && Number.isFinite(x.pct));
    const rawAmountDiscountSum = r2(discList.filter((x) => !x.hasPct && x.hasAmt && Number.isFinite(x.amt)).reduce((s, x) => s + Math.abs(x.amt), 0));
    const discountAmtItem = discList.find((x) => !x.hasPct && x.hasAmt && Number.isFinite(x.amt));
    return { service_charge: pickSCorVAT(scList), vat: pickSCorVAT(vatList), discount: discountPct ? { mode: "percent", value: discountPct.pct, raw: discountPct.raw, sourceIndex: discountPct.index, sourceCount: discList.length, extraAmountSum: rawAmountDiscountSum } : discList.some((x) => x.hasAmt) ? { mode: "amount", value: rawAmountDiscountSum, raw: discountAmtItem?.raw ?? "", sourceIndex: discountAmtItem?.index ?? -1, sourceCount: discList.length, extraAmountSum: 0 } : null };
  }
  function isSummaryItemName(name) {
    const n = nfc(String(name || "").trim());
    return SUMMARY_NAME_RE.test(n) || isSummaryByComposition(n) || isSafeColumnHeader(n);
  }
  function detectBillNumericStyle(rawLines) {
    const joined = rawLines.join("\n");
    return { hasDecimal: /\b\d+\.\d{2}\b/.test(joined), hasThousands: /\b\d{1,3},\d{3}\b/.test(joined) };
  }
  const ADDR_MORPHEMES = /* @__PURE__ */ new Set(["ถ", "ถ.", "ถนน", "ซ", "ซ.", "ซอย", "หมู่", "ม.", "แขวง", "เขต", "อำเภอ", "อ.", "ตำบล", "ต.", "จังหวัด", "จ."]);
  const ADDR_PREFIX_MORPHEMES = ["ถนน", "แขวง", "เขต", "อำเภอ", "ตำบล", "จังหวัด"];
  function hasAddressMorpheme(line) {
    return nfc(line).split(/[\s,\/]+/).some((tok) => {
      const t = stripPunct(tok);
      if (ADDR_MORPHEMES.has(t)) return true;
      return ADDR_PREFIX_MORPHEMES.some((m) => t.startsWith(m) && t.length > m.length);
    });
  }
  const METADATA_ANCHOR_RE = /(?:โทร|tel|fax|phone|โทรศัพท์|ใบเสร็จ|receipt|invoice|s\/n#?|pos\s*id#?|เลขที่|order|bill|table|โต๊ะ|cashier|แคชเชียร์|วันที่|เวลา|date|time|\b0\d{8,9}\b)/i;
  function findMetadataAnchorIndices(mergedLines) {
    return new Set(mergedLines.map((l, i) => METADATA_ANCHOR_RE.test(nfc(l)) ? i : -1).filter((i) => i >= 0));
  }
  function isNearMetadataAnchor(idx, anchors, win = 5) {
    for (let d = -win; d <= win; d++) if (anchors.has(idx + d)) return true;
    return false;
  }
  function isLikelyAddressLine(line, lineIdx, billStyle, anchorIndices) {
    const s = nfc(line).trim();
    const fiveDigit = (s.match(/\b\d{5}\b/g) || []).find((t) => /^\d{5}$/.test(t));
    if (!fiveDigit) return false;
    let score = 0;
    if (billStyle.hasDecimal || billStyle.hasThousands) score += 4;
    if (hasAddressMorpheme(s)) score += 3;
    if (isNearMetadataAnchor(lineIdx, anchorIndices)) score += 2;
    if (!/\b\d{1,3}(?:,\d{3})+\b|\b\d+\.\d{2}\b/.test(s)) score += 1;
    return score >= 4;
  }
  function applyZoneFilter(rows) {
    const isAnchor = (row) => !row.isDiscount && !isSummaryItemName(row.itemName) && row.confidence >= 0.55 && row.itemName.trim().length >= 2;
    const anchorIdxs = rows.reduce((acc, row, i) => {
      if (isAnchor(row)) acc.push(i);
      return acc;
    }, []);
    if (anchorIdxs.length < 2) {
      return rows.filter((row) => row.isDiscount || (isSummaryItemName(row.itemName) ? false : !row.isDiscount && /^[\d\s.,\-]+$/.test(row.itemName.trim()) ? false : row.itemName.trim().length >= 2));
    }
    const first = anchorIdxs[0];
    const last = anchorIdxs[anchorIdxs.length - 1];
    return rows.filter((row, idx) => {
      if (row.isDiscount) return true;
      if (isSummaryItemName(row.itemName)) return false;
      if (!row.isDiscount && /^[\d\s.,\-]+$/.test(row.itemName.trim())) return false;
      if (idx >= first && idx <= last) return true;
      return row.confidence >= 0.5;
    });
  }
  function preprocessReceipt2(rawText, sourceByClean) {
    const normalized = normalizeText2(rawText);
    const rawLines = normalized.split("\n").filter(Boolean);
    const collapsedLines = collapseVerticalOCR(rawLines);
    const mergedLines = mergeWrappedLines2(collapsedLines);
    const billStyle = detectBillNumericStyle(rawLines);
    const anchorIndices = findMetadataAnchorIndices(mergedLines);
    const cleanLines = [];
    for (let idx = 0; idx < mergedLines.length; idx++) {
      const orig = mergedLines[idx];
      const origNfc = nfc(orig);
      if (!origNfc.trim()) continue;
      if (SEPARATOR_RE.test(origNfc)) continue;
      const trimmed = origNfc.trim();
      if (DATE_RE.test(trimmed) && trimmed.split(/\s+/).length === 1) continue;
      if (TIME_RE.test(trimmed) && trimmed.split(/\s+/).length === 1) continue;
      if (isMultiKVMetaLine(origNfc)) continue;
      if (idx + 1 < mergedLines.length && isMultiKVMetaLine(nfc(mergedLines[idx + 1]))) continue;
      if (isLikelyAddressLine(origNfc, idx, billStyle, anchorIndices)) continue;
      if (DISCOUNT_RE.test(origNfc)) continue;
      if (STRONG_SUMMARY_RE.test(origNfc.trim())) continue;
      if (WEAK_SUMMARY_RE.test(origNfc.trim())) {
        const _afterKw = origNfc.trim().replace(WEAK_SUMMARY_RE, "").trim();
        if (!_afterKw) continue;
        if (/\d/.test(_afterKw) && /^[%\d\s.,(),฿$\-]*$/.test(_afterKw)) continue;
      }
      if (countSummaryKeywords(origNfc) >= 2) continue;
      const clean = stripNoiseTokens(origNfc);
      if (!clean) continue;
      cleanLines.push(clean);
      if (sourceByClean) {
        const lines = sourceByClean.get(clean) ?? [];
        lines.push(orig);
        sourceByClean.set(clean, lines);
      }
    }
    return { cleanLines, rawLines };
  }
  function recoverOmittedPriceLines(rawLines, rows, sourceByClean) {
    const represented = [...new Set(rows.map((row) => row.rawLine))].flatMap((clean) => sourceByClean.get(clean) ?? []);
    const recovered = [];
    for (const line of rawLines) {
      if (!/\p{L}/u.test(line) || !/[\d,]+\.\d{2}$/.test(line)) continue;
      if (STRONG_SUMMARY_RE.test(line) || DISCOUNT_RE.test(line) || /^(?:service|svc|sc\b|tax|grand|net|cash|รวม|ยอด|สุทธิ|โทร|tel|date|วันที่|เวลา|เลขที่|ถนน|ที่อยู่)/i.test(line)) continue;
      if (represented.some((source) => (" " + source + " ").includes(" " + line + " "))) continue;
      const row = parseItemLine2(line, null);
      row.needsReview = true;
      row.flags.push({ type: "recovered_line", msg: "พบรายการที่ต้องตรวจสอบ" });
      recovered.push(row);
    }
    return recovered;
  }
  function parseReceipt2(rawText, { recoverOmitted = false, onSummaryEntries } = {}) {
    const sourceByClean = recoverOmitted ? /* @__PURE__ */ new Map() : null;
    const { cleanLines, rawLines } = preprocessReceipt2(rawText, sourceByClean);
    const summarySource = extractSummarySources2(rawLines, onSummaryEntries);
    let rows = cleanLines.filter((line) => quickClassify(line) !== "meta").map((line) => parseItemLine2(line, null));
    const ctx = buildContext(rows);
    if (ctx) rows = rows.map((row) => {
      if (row.confidence >= 0.72) return row;
      const revised = parseItemLine2(row.rawLine, ctx);
      return revised.confidence > row.confidence ? revised : row;
    });
    rows = applyZoneFilter(rows);
    if (recoverOmitted) rows.push(...recoverOmittedPriceLines(rawLines, rows, sourceByClean));
    return { rows, summarySource };
  }
  function initializeSummaryEdits2(subtotal, summarySource) {
    const scSource = summarySource?.service_charge ?? null;
    const vatSource = summarySource?.vat ?? null;
    const discSource = summarySource?.discount ?? null;
    let scRate = null;
    if (scSource) {
      if (scSource.mode === "percent") scRate = scSource.value;
      else scRate = subtotal > 0 ? scSource.value / subtotal * 100 : 0;
    }
    const scAmount = scRate != null ? r2(subtotal * scRate / 100) : 0;
    const vatBase = r2(subtotal + scAmount);
    let vatRate = null;
    if (vatSource) {
      if (vatSource.mode === "percent") vatRate = vatSource.value;
      else vatRate = vatBase > 0 ? vatSource.value / vatBase * 100 : 0;
    }
    return { service_charge_rate: scRate, vat_rate: vatRate, discount_rate: discSource != null && discSource.mode === "percent" ? discSource.value : null, discount_amount: discSource != null && discSource.mode !== "percent" ? discSource.value : null };
  }
  function resolveSummaryState2(subtotal, summarySource, summaryEdits, discountCanonical) {
    const scSource = summarySource?.service_charge ?? null;
    const vatSource = summarySource?.vat ?? null;
    const discSource = summarySource?.discount ?? null;
    const scRate = Number.isFinite(summaryEdits?.service_charge_rate) ? summaryEdits.service_charge_rate : scSource ? scSource.mode === "percent" ? scSource.value : subtotal > 0 ? scSource.value / subtotal * 100 : 0 : null;
    const scAmount = scRate != null ? r2(subtotal * scRate / 100) : 0;
    const vatBase = r2(subtotal + scAmount);
    const vatRate = Number.isFinite(summaryEdits?.vat_rate) ? summaryEdits.vat_rate : vatSource ? vatSource.mode === "percent" ? vatSource.value : vatBase > 0 ? vatSource.value / vatBase * 100 : 0 : null;
    const vatAmount = vatRate != null ? r2(vatBase * vatRate / 100) : 0;
    const discountBase = r2(subtotal + scAmount + vatAmount);
    const effectiveMode = discountCanonical ?? discSource?.mode ?? "amount";
    let discountAmount = 0;
    let discountRate = 0;
    if (effectiveMode === "rate") {
      let storedRate = summaryEdits?.discount_rate;
      if (!Number.isFinite(storedRate) && discSource?.mode === "percent") storedRate = discSource.value;
      if (!Number.isFinite(storedRate)) storedRate = 0;
      discountRate = storedRate;
      discountAmount = r2(discountBase * discountRate / 100);
      if (discSource?.extraAmountSum) discountAmount = r2(discountAmount + discSource.extraAmountSum);
    } else {
      let storedAmount = summaryEdits?.discount_amount;
      if (!Number.isFinite(storedAmount) && discSource?.mode !== "percent") storedAmount = discSource?.value;
      if (!Number.isFinite(storedAmount)) storedAmount = 0;
      discountAmount = r2(storedAmount);
      discountRate = discountBase > 0 ? r2(discountAmount / discountBase * 100) : 0;
    }
    const total = r2(subtotal + scAmount + vatAmount - discountAmount);
    return { subtotal, service_charge: { source: scSource, rate: scRate ?? 0, amount: scAmount, mode: scSource?.mode ?? null }, vat: { source: vatSource, rate: vatRate ?? 0, amount: vatAmount, mode: vatSource?.mode ?? null }, discount: { source: discSource, mode: effectiveMode, rate: discountRate, amount: discountAmount, extraAmountSum: discSource?.extraAmountSum || 0 }, total };
  }
  return { parseReceipt: parseReceipt2, getDerivedValues: getDerivedValues2, initializeSummaryEdits: initializeSummaryEdits2, resolveSummaryState: resolveSummaryState2, mergeWrappedLines: mergeWrappedLines2, normalizeText: normalizeText2, preprocessReceipt: preprocessReceipt2, extractSummarySources: extractSummarySources2, parseItemLine: parseItemLine2, parseDiscountLine: parseDiscountLine2 };
}
var { parseReceipt, getDerivedValues, initializeSummaryEdits, resolveSummaryState, mergeWrappedLines, normalizeText, preprocessReceipt, extractSummarySources, parseItemLine, parseDiscountLine } = createReceiptParser();

// src/item-allocation.mjs
var SCALE = 1000000n;
var totalOf = (item) => item.priceSource === "line_total" ? item.priceCents : item.priceCents * item.quantity;
var roundRatio = (numerator, denominator) => (numerator * 2n + denominator) / (denominator * 2n);
function quotas(values, denominator) {
  const parts = values.map((value, index) => ({ index, amount: value / denominator, remainder: value % denominator }));
  let remaining = roundRatio(values.reduce((sum, value) => sum + value, 0n), denominator) - parts.reduce((sum, part) => sum + part.amount, 0n);
  const remainderOrder = [...parts].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const part of remainderOrder) {
    if (remaining-- <= 0n) break;
    part.amount++;
  }
  return parts.map((part) => Number(part.amount));
}
function normalizeAssignmentLocks(item) {
  const next = structuredClone(item);
  const total = totalOf(next);
  const missing2 = next.assignments.filter((assignment) => assignment.lockMode == null && assignment.locked);
  const units = total ? quotas(missing2.map((assignment) => BigInt(assignment.amountCents) * SCALE), BigInt(total)) : missing2.map(() => 0);
  let index = 0;
  for (const assignment of next.assignments) {
    if (assignment.lockMode == null) {
      assignment.lockMode = "percentage";
      assignment.lockPercentUnits = assignment.locked ? units[index++] : 0;
    }
  }
  return next;
}
function allocationOvercommitted(item) {
  const next = normalizeAssignmentLocks(item);
  const total = BigInt(totalOf(next));
  let quota = 0n;
  for (const assignment of next.assignments) {
    if (!assignment.locked) continue;
    quota += assignment.lockMode === "amount" ? BigInt(assignment.amountCents) * SCALE : total * BigInt(assignment.lockPercentUnits);
  }
  return quota > total * SCALE;
}
function recalculateItemAssignments(item) {
  const next = normalizeAssignmentLocks(item);
  const total = totalOf(next);
  const percentages = next.assignments.filter((assignment) => assignment.locked && assignment.lockMode === "percentage");
  const resolved = quotas(percentages.map((assignment) => BigInt(total) * BigInt(assignment.lockPercentUnits)), SCALE);
  percentages.forEach((assignment, index) => {
    assignment.amountCents = resolved[index];
  });
  const overallocated = allocationOvercommitted(next);
  const locked = next.assignments.reduce((sum, assignment) => sum + (assignment.locked ? assignment.amountCents : 0), 0);
  const unlocked = next.assignments.filter((assignment) => !assignment.locked);
  const remainder = overallocated ? 0 : Math.max(0, total - locked);
  const each = unlocked.length ? Math.floor(remainder / unlocked.length) : 0;
  const extra = unlocked.length ? remainder % unlocked.length : 0;
  unlocked.forEach((assignment, index) => {
    assignment.amountCents = each + (index < extra ? 1 : 0);
  });
  return { item: next, overallocated };
}

// src/bill-state.mjs
var VERSION = 1;
function newId(random = globalThis.crypto) {
  if (typeof random.randomUUID === "function") return random.randomUUID();
  const bytes = random.getRandomValues(new Uint8Array(16));
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
}
var copy = (v) => structuredClone(v);
function integer(v, min = 0, max = 1e12) {
  if (!Number.isSafeInteger(v) || v < min || v > max) throw Error("จำนวนเงินหรือจำนวนรายการไม่ถูกต้อง");
  return v;
}
function cents(value) {
  const text2 = String(value).replace(/,/g, "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text2)) throw Error("กรอกจำนวนเงินไม่เกิน 2 ตำแหน่ง");
  const [a, b = ""] = text2.split(".");
  return integer(Number(a) * 100 + Number(b.padEnd(2, "0")));
}
function ratio(amount, numerator, denominator) {
  integer(amount);
  integer(numerator);
  integer(denominator, 1);
  return integer(Number((BigInt(amount) * BigInt(numerator) * 2n + BigInt(denominator)) / (2n * BigInt(denominator))));
}
var money = (c) => (c / 100).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
var adjustment = () => ({ service: { kind: "rate", value: 1e3, enabled: false }, tax: { kind: "rate", value: 700, enabled: false, treatment: "excluded" }, discount: { kind: "fixed", value: 0, enabled: false }, placement: "after_sc_vat", serviceDist: "equal", discountDist: "equal" });
var emptyBill = () => ({ version: VERSION, revision: 0, people: [], items: [], groups: [{ id: "manual", name: "รายการที่เพิ่มเอง", ...adjustment() }], imports: [], undo: null });
function itemTotal(item) {
  return item.priceSource === "line_total" ? item.priceCents : integer(item.priceCents * item.quantity);
}
var text = (v, max = 200) => {
  if (typeof v !== "string" || v.length > max) throw Error("ข้อมูลข้อความไม่ถูกต้อง");
  return v;
};
var unique = (values) => {
  if (new Set(values).size !== values.length) throw Error("พบรหัสซ้ำในข้อมูล");
};
function validateBill(b, { undo: undo2 = true } = {}) {
  if (!b || b.version !== VERSION) throw Error("รุ่นข้อมูลไม่รองรับ");
  integer(b.revision);
  for (const key of ["people", "items", "groups", "imports"]) if (!Array.isArray(b[key]) || b[key].length > 1e4) throw Error("รูปแบบข้อมูลไม่ถูกต้อง");
  if (!b.groups.length) throw Error("ไม่พบข้อมูลการปรับยอดบิล");
  for (const list of [b.people, b.items, b.groups]) {
    list.forEach((x) => {
      if (!text(x.id, 100)) throw Error("ไม่มีรหัสรายการ");
    });
    unique(list.map((x) => x.id));
  }
  const people = new Set(b.people.map((p) => {
    text(p.name, 100);
    if (!p.name.trim()) throw Error("กรอกชื่อผู้ร่วมจ่าย");
    return p.id;
  }));
  const groups = new Set(b.groups.map((g) => g.id));
  b.groups.forEach((g) => {
    text(g.name);
    if (!["before_sc_vat", "after_sc_vat"].includes(g.placement)) throw Error("ลำดับส่วนลดไม่ถูกต้อง");
    for (const k of ["serviceDist", "discountDist"]) if (!["equal", "proportional"].includes(g[k])) throw Error("วิธีแบ่งค่าใช้จ่ายไม่ถูกต้อง");
    for (const k of ["service", "tax", "discount"]) {
      const a = g[k];
      if (!a || !["rate", "fixed"].includes(a.kind) || typeof a.enabled !== "boolean") throw Error("ข้อมูลค่าบริการไม่ถูกต้อง");
      integer(a.value, 0, a.kind === "rate" ? 1e4 : 1e12);
    }
    if (!["included", "excluded", "unknown"].includes(g.tax.treatment)) throw Error("ข้อมูลภาษีไม่ถูกต้อง");
    if (g.printedTotalCents != null) integer(g.printedTotalCents);
  });
  b.items.forEach((it) => {
    text(it.name);
    integer(it.quantity, 1, 99);
    integer(it.priceCents);
    if (!["line_total", "unit_price"].includes(it.priceSource) || !groups.has(it.groupId)) throw Error("ข้อมูลราคาหรือใบเสร็จไม่ถูกต้อง");
    if (!Array.isArray(it.assignments)) throw Error("ข้อมูลผู้ร่วมจ่ายไม่ถูกต้อง");
    unique(it.assignments.map((a) => a.personId));
    let locked = 0;
    for (const a of it.assignments) {
      if (!people.has(a.personId) || typeof a.locked !== "boolean") throw Error("ไม่พบผู้ร่วมจ่ายของรายการ");
      integer(a.amountCents);
      if (a.locked) locked += a.amountCents;
      if (Object.hasOwn(a, "lockMode") && !["amount", "percentage"].includes(a.lockMode)) throw Error("รูปแบบการล็อกไม่ถูกต้อง");
      if (a.lockMode === "percentage") integer(a.lockPercentUnits, 0, 1e6);
      if (a.lockMode !== "percentage" && Object.hasOwn(a, "lockPercentUnits")) throw Error("ข้อมูลการล็อกไม่ถูกต้อง");
    }
    if (locked > itemTotal(it) || allocationOvercommitted(it)) throw Error("ยอดที่ล็อกไว้เกินราคารายการ");
  });
  b.imports.forEach((x) => text(x, 100));
  unique(b.imports);
  if (b.undo != null) {
    if (!undo2 || !b.undo.before) throw Error("ข้อมูลย้อนกลับไม่ถูกต้อง");
    validateBill(b.undo.before, { undo: false });
    integer(b.undo.atRevision);
  }
  return b;
}
function normalizeBillPolicy(b) {
  validateBill(b);
  const next = copy(b);
  const map = (bill) => {
    bill.groups.forEach((g) => {
      g.placement = "after_sc_vat";
    });
    bill.items = bill.items.map(normalizeAssignmentLocks);
    if (bill.undo) map(bill.undo.before);
  };
  map(next);
  return next;
}
function allocate(total, weights) {
  weights.forEach((w) => integer(w));
  integer(weights.reduce((a, b) => a + b, 0));
  return allocateWeights(total, weights);
}
function allocateWeights(total, weights) {
  integer(total);
  const denominator = weights.reduce((sum, weight) => sum + BigInt(weight), 0n);
  if (!denominator) return weights.map(() => 0);
  const parts = weights.map((weight, index) => {
    const numerator = BigInt(total) * BigInt(weight);
    return { index, amount: Number(numerator / denominator), remainder: numerator % denominator };
  });
  let remaining = total - parts.reduce((sum, part) => sum + part.amount, 0);
  const remainderOrder = [...parts].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const part of remainderOrder) {
    if (remaining-- <= 0) break;
    part.amount++;
  }
  return parts.map((part) => part.amount);
}
function shares(it) {
  const total = itemTotal(it);
  const assignments = it.assignments;
  const locked = assignments.reduce((sum, assignment) => sum + (assignment.locked ? assignment.amountCents : 0), 0);
  if (locked > total) throw Error("ยอดที่ล็อกไว้เกินราคารายการ");
  const unlocked = assignments.filter((assignment) => !assignment.locked);
  const amounts = allocate(total - locked, unlocked.map(() => 1));
  let index = 0;
  return assignments.map((assignment) => ({
    personId: assignment.personId,
    amountCents: assignment.locked ? assignment.amountCents : amounts[index++]
  }));
}
function calculate(bill) {
  validateBill(bill);
  const totals = Object.fromEntries(bill.people.map((person) => [person.id, {
    subtotal: 0,
    service: 0,
    tax: 0,
    discount: 0,
    total: 0
  }]));
  let subtotal = 0, grand = 0, unallocated = 0;
  const groups = [], warnings = [];
  for (const group of bill.groups) {
    const base = bill.people.map(() => 0);
    let full = 0;
    for (const item of bill.items.filter((item2) => item2.groupId === group.id)) {
      full = integer(full + itemTotal(item));
      for (const assignment of shares(item)) {
        const index = bill.people.findIndex((person) => person.id === assignment.personId);
        base[index] += assignment.amountCents;
      }
    }
    const missing2 = full - base.reduce((sum, amount2) => sum + amount2, 0);
    base.push(missing2);
    const amount = (adjustment2, basis) => !adjustment2.enabled ? 0 : adjustment2.kind === "fixed" ? adjustment2.value : ratio(basis, adjustment2.value, 1e4);
    const equalWeights = (values) => {
      const sum = values.reduce((total2, value) => total2 + value, 0);
      const missing3 = values.at(-1);
      return bill.people.length ? [...bill.people.map(() => sum - missing3), BigInt(missing3) * BigInt(bill.people.length)] : [1];
    };
    const split = (total2, weights) => allocateWeights(total2, weights.some((weight) => weight > 0) ? weights : weights.map((_, index) => index === weights.length - 1 ? 1 : 0));
    const distribute = (total2, values, mode) => split(total2, mode === "equal" ? equalWeights(values) : values);
    const service = amount(group.service, full);
    const services = distribute(service, base, group.serviceDist);
    const vatBase = integer(full + service);
    if (group.tax.enabled && group.tax.treatment === "unknown") {
      warnings.push("กรุณาตรวจสอบว่าราคารวมภาษีแล้วหรือยัง");
    }
    const vat = group.tax.treatment === "excluded" ? amount(group.tax, vatBase) : 0;
    const withService = base.map((value, index) => value + services[index]);
    const taxes = split(vat, withService);
    const beforeDiscount = withService.map((value, index) => value + taxes[index]);
    const discount = Math.min(amount(group.discount, vatBase + vat), vatBase + vat);
    const discounts = distribute(discount, beforeDiscount, group.discountDist);
    const final = beforeDiscount.map((value, index) => integer(value - discounts[index], -1e12));
    for (let index = 0; index < bill.people.length; index++) {
      const person = totals[bill.people[index].id];
      person.subtotal = integer(person.subtotal + base[index]);
      person.service = integer(person.service + services[index]);
      person.tax = integer(person.tax + taxes[index]);
      person.discount = integer(person.discount + discounts[index]);
      person.total = integer(person.total + final[index], -1e12);
    }
    const total = integer(vatBase + vat - discount);
    subtotal = integer(subtotal + full);
    grand = integer(grand + total);
    unallocated += final.at(-1);
    groups.push({
      id: group.id,
      subtotal: full,
      service,
      tax: vat,
      discount,
      total,
      difference: group.printedTotalCents == null ? null : total - group.printedTotalCents
    });
  }
  if (Object.values(totals).some((person) => person.total < 0)) {
    warnings.push("ส่วนลดแบบหารเท่าทำให้บางคนมียอดติดลบ ลองเลือกแบ่งส่วนลดตามสัดส่วน");
  }
  if (unallocated) warnings.push("ยังมีรายการที่แบ่งจ่ายไม่ครบ");
  return { subtotal, grand, unallocated, people: totals, groups, warnings: [...new Set(warnings)] };
}

// src/receipt-draft.mjs
function receiptSummary(subtotal, source, edits, mode = "amount") {
  return resolveSummaryState(subtotal, source, edits, mode);
}
function receiptReviewSummary(subtotal, source, edits, mode, treatment) {
  const view = receiptSummary(subtotal, source, edits, mode);
  if (treatment !== "included") return view;
  const gross = Math.round((subtotal + view.service_charge.amount) * 100) / 100;
  const vat = source?.vat?.mode === "amount" ? view.vat.amount : Math.round(gross * view.vat.rate / (100 + view.vat.rate) * 100) / 100;
  view.vat.amount = vat;
  view.vat.rate = gross > vat ? vat / (gross - vat) * 100 : 0;
  if (mode === "rate") view.discount.amount = Math.round((gross * (edits?.discount_rate ?? source?.discount?.value ?? 0) / 100 + (source?.discount?.extraAmountSum ?? 0)) * 100) / 100;
  view.total = Math.round((gross - view.discount.amount) * 100) / 100;
  return view;
}
var clone = (value) => structuredClone(value);
function reviewSubtotal(review) {
  const subtotal = review.rows.filter((row) => !row.isDiscount).reduce((sum, row) => sum + getDerivedValues(row).lineTotal, 0);
  return Math.round(subtotal * 100) / 100;
}
function validateReview(review) {
  if (typeof review.raw !== "string" || review.raw.length > 1e5 || !Array.isArray(review.rows) || review.rows.length > 1e4) throw Error("เปิดฉบับร่างไม่ได้ โปรดกลับไปแยกเมนูจากข้อความอีกครั้ง");
  const ids = /* @__PURE__ */ new Set();
  for (const row of review.rows) {
    if (typeof row.id !== "string" || !row.id || ids.has(row.id) || typeof row.itemName !== "string" || row.itemName.length > 200 || !Number.isInteger(row.qty) || row.qty < 1 || row.qty > 99 || !["unit_price", "line_total"].includes(row.priceSource) || !Number.isFinite(row.priceValue) || row.priceValue < 0 || row.priceValue > 1e10) throw Error("ข้อมูลเมนูในฉบับร่างไม่ถูกต้อง โปรดกลับไปตรวจสอบข้อความ");
    ids.add(row.id);
    if (row.flags != null && (!Array.isArray(row.flags) || row.flags.some((flag) => !flag || typeof flag.type !== "string" || flag.msg != null && typeof flag.msg !== "string"))) throw Error("ข้อมูลเมนูในฉบับร่างไม่ถูกต้อง โปรดกลับไปตรวจสอบข้อความ");
  }
  for (const value of Object.values(review.summaryEdits ?? {})) if (value != null && (!Number.isFinite(value) || value < 0)) throw Error("ข้อมูลปรับยอดในฉบับร่างไม่ถูกต้อง");
  for (const key of ["service_charge", "vat", "discount"]) {
    const source = review.summarySource?.[key];
    if (source != null && (!["amount", "percent"].includes(source.mode) || !Number.isFinite(source.value) || source.value < 0 || source.extraAmountSum != null && (!Number.isFinite(source.extraAmountSum) || source.extraAmountSum < 0))) throw Error("ข้อมูลปรับยอดในฉบับร่างไม่ถูกต้อง");
  }
  if (!["rate", "amount"].includes(review.discountCanonical) || !["input", "results"].includes(review.page) || !["append", "replace"].includes(review.importMode) || !["all", "none"].includes(review.importAssignments)) throw Error("ตัวเลือกในฉบับร่างไม่ถูกต้อง");
  if (review.page === "results" && (typeof review.draft?.id !== "string" || !review.draft.id || typeof review.draft?.group?.id !== "string")) throw Error("ไม่พบข้อมูลใบเสร็จเดิม โปรดกลับไปแยกเมนูอีกครั้ง");
  const view = receiptSummary(reviewSubtotal(review), review.summarySource, review.summaryEdits, review.discountCanonical);
  if (![view.total, view.service_charge.amount, view.vat.amount, view.discount.amount].every((v) => Number.isFinite(v) && v >= 0)) throw Error("ยอดฉบับร่างไม่ถูกต้อง โปรดตรวจสอบรายการและส่วนลด");
}
function normalizeReviewDraft(saved) {
  if (saved?.schema !== 3) throw Error("รุ่นฉบับร่างไม่รองรับ เก็บข้อความไว้แล้วแยกเมนูอีกครั้ง");
  if (typeof saved.billId !== "string" || !saved.billId || !Number.isSafeInteger(saved.baseRevision) || saved.baseRevision < 1) throw Error("ฉบับร่างไม่มีข้อมูลบิลที่ถูกต้อง");
  const review = { schema: 3, billId: saved.billId, baseRevision: saved.baseRevision, raw: saved.raw, rows: clone(saved.rows), summarySource: clone(saved.summarySource ?? {}), summaryEdits: clone(saved.summaryEdits ?? {}), discountCanonical: saved.discountCanonical ?? "amount", colOrder: clone(saved.colOrder ?? ["unit_price", "line_total"]), importMode: saved.importMode ?? "append", importAssignments: saved.importAssignments ?? "all", page: saved.page ?? "input", draft: clone(saved.draft ?? null) };
  if (!sameColumns(review.colOrder)) throw Error("ลำดับคอลัมน์ในฉบับร่างไม่ถูกต้อง");
  validateReview(review);
  return { review, notices: [] };
}
function sameColumns(columns) {
  return Array.isArray(columns) && columns.length === 2 && new Set(columns).size === 2 && columns.every((c) => ["unit_price", "line_total"].includes(c));
}
function buildReviewedDraft(review) {
  validateReview(review);
  const draft = clone(review.draft), rows = review.rows.filter((r) => !r.isDiscount);
  if (!rows.length) throw Error("ยังไม่มีเมนูให้เพิ่ม");
  draft.items = rows.map((r) => ({ id: r.id, groupId: draft.group.id, name: r.itemName, quantity: r.qty, priceSource: r.priceSource, priceCents: Math.round(r.priceValue * 100), assignments: [], rawLine: r.rawLine ?? "" }));
  const view = receiptSummary(reviewSubtotal(review), review.summarySource, review.summaryEdits, review.discountCanonical);
  for (const [key, field] of [["service", "service_charge"], ["tax", "vat"], ["discount", "discount"]]) {
    const rate = key === "discount" ? review.discountCanonical === "rate" && !review.summarySource?.discount?.extraAmountSum : review.summarySource?.[field]?.mode === "percent";
    const value = rate ? view[field].rate : view[field].amount;
    draft.group[key] = { kind: rate ? "rate" : "fixed", value: Math.round(value * 100), enabled: value > 0, ...key === "tax" ? { treatment: "excluded" } : {} };
  }
  if (!draft.group.service.value) draft.group.service = { kind: "rate", value: 1e3, enabled: false };
  if (!draft.group.tax.value) draft.group.tax = { kind: "rate", value: 700, enabled: false, treatment: "excluded" };
  draft.group.placement = "after_sc_vat";
  return draft;
}
function copyReceiptForImport(draft) {
  const next = clone(draft);
  next.id = newId();
  next.group.id = newId();
  next.items = next.items.map((item) => ({ ...item, id: newId(), groupId: next.group.id }));
  return next;
}
function parseDraft(raw, { id = newId } = {}) {
  if (typeof raw !== "string" || raw.length > 1e5) throw Error("ข้อความใบเสร็จยาวเกินไป");
  const normalized = raw.replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 3664)).replace(/\u0e4d\u0e32/g, "ำ");
  const notices = [];
  const parsed = parseReceipt(normalized, { recoverOmitted: true, onSummaryEntries(entries) {
    const vat = entries.filter((e) => e.kind === "vat" && /^(?:vat|value added tax|ภาษี(?:มูลค่าเพิ่ม)?)\s*(?:inclusive|included|incl\.|รวมในราคา|รวมอยู่ในราคา)/i.test(e.norm));
    if (vat.length) notices.push(`ใบเสร็จระบุ “${vat.map((e) => e.raw).join(" / ")}” หากราคาอาหารรวมภาษีแล้ว ให้ตั้ง VAT เป็น 0 เพื่อไม่ให้คิดซ้ำ`);
    const discounts = entries.filter((e) => e.kind === "discount");
    if (discounts.filter((e) => e.hasPct).length > 1) notices.push(`พบส่วนลดหลายอัตรา “${discounts.map((e) => e.raw).join(" / ")}” ค่าเริ่มต้นใช้อัตราแรก ตรวจสอบและแก้ยอดส่วนลดให้ตรงกับใบเสร็จ`);
  } });
  const groupId = id(), group = { id: groupId, name: "ใบเสร็จ", ...adjustment() };
  const source = parsed.summarySource;
  for (const [key, field] of [["service", "service_charge"], ["tax", "vat"], ["discount", "discount"]]) {
    const a = source[field];
    if (a) group[key] = { ...group[key], enabled: true, kind: a.mode === "percent" ? "rate" : "fixed", value: a.mode === "percent" ? Math.round(a.value * 100) : cents(a.value.toFixed(2)) };
  }
  if (source.vat) group.tax.treatment = "unknown";
  const totalLines = normalized.split(/\r?\n/).filter((l) => /^\s*(?:grand\s*total|net\s*total|total|ยอดชำระสุทธิ|ยอดสุทธิ|ยอดรวมสุทธิ|รวมทั้งสิ้น|ยอดรวมทั้งสิ้น|รวมทั้งหมด|ยอดรวม)\s*[:：]?\s*(?:฿|\$|THB|บาท)?\s*[\d,]+(?:\.\d{1,2})?\s*(?:บาท|฿)?\s*$/i.test(l));
  if (totalLines.length) {
    const match = totalLines.at(-1).match(/([\d,]+(?:\.\d{1,2})?)\s*(?:บาท|฿)?\s*$/);
    group.printedTotalCents = cents(match[1]);
  }
  const items = parsed.rows.filter((r) => !r.isDiscount).map((r) => ({ id: id(), groupId, name: r.itemName, quantity: r.qty, priceSource: r.priceSource, priceCents: cents(r.priceValue.toFixed(2)), assignments: [], needsReview: r.needsReview, rawLine: r.rawLine, flags: r.flags }));
  if (source.discount?.extraAmountSum) {
    const subtotal = items.reduce((s, r) => s + (r.priceSource === "line_total" ? r.priceCents : r.priceCents * r.quantity), 0) / 100;
    const edits = initializeSummaryEdits(subtotal, source);
    const result = receiptSummary(subtotal, source, edits, "rate");
    group.discount = { kind: "fixed", enabled: true, value: cents(result.discount.amount.toFixed(2)) };
    notices.push("พบส่วนลดหลายรูปแบบ กรุณาตรวจสอบยอดส่วนลดรวม");
  }
  const draft = { id: id(), raw, group, items, notices };
  const check = emptyBill();
  check.groups.push(group);
  check.items = items;
  validateBill(check);
  return { draft, summarySource: source };
}
function createDraft(raw, options) {
  return parseDraft(raw, options).draft;
}
function createReceiptReview(raw) {
  const { draft, summarySource } = parseDraft(raw);
  const rows = draft.items.map((item) => ({
    id: item.id,
    rawLine: item.rawLine,
    itemName: item.name,
    qty: item.quantity,
    priceSource: item.priceSource,
    priceValue: item.priceCents / 100,
    needsReview: item.needsReview,
    flags: item.flags || [],
    isDiscount: false
  }));
  return { draft, rows, summarySource };
}

// src/receipt-view.mjs
function mountViewHistory(model, actions) {
  const history = mountHistoryControls(document.getElementById("receipt-history"), {
    scope: model.page === "input" ? "ข้อความใบเสร็จ" : "รายละเอียดใบเสร็จ",
    onUndo: actions.undo,
    onRedo: actions.redo,
    editors: { bind: actions.bindAction }
  });
  history.update(model.history);
  actions.historyMounted(history);
  return history;
}
function scheduleInitialLayout() {
  let first = 0, second = 0;
  first = requestAnimationFrame(() => {
    updateReceiptLayout();
    second = requestAnimationFrame(updateReceiptLayout);
  });
  return () => {
    cancelAnimationFrame(first);
    cancelAnimationFrame(second);
  };
}
function showReceiptError(message) {
  const element = document.getElementById("receipt-import-error");
  if (element) {
    element.hidden = false;
    element.textContent = message;
    element.scrollIntoView({ block: "nearest" });
  }
}
var RECEIPT_ICON = `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 2 1.5V2"/><line x1="9" y1="8" x2="17" y2="8"/><line x1="9" y1="12" x2="17" y2="12"/><line x1="9" y1="16" x2="14" y2="16"/></svg>`;
var BIN_ICON = binIcon({ receipt: true });
var BACK_CHEVRON = `<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>`;
function renderReceiptHeader(review = false) {
  return `<div class="top-bar receipt-header">
    <button class="back-btn" aria-label="ย้อนกลับ" id="${review ? "backBtn" : "p1BackBtn"}">${BACK_CHEVRON}</button>
    <span class="top-title">${review ? "โปรดตรวจสอบความถูกต้อง" : "อ่านใบเสร็จ"}</span>
    <div id="receipt-history"></div>
    ${review ? '<button class="add-btn results-add-btn" id="addBtn">+ เพิ่มเมนู</button>' : ""}
  </div>`;
}
var SWAP_ICON_ALL = `<svg width="13" height="10" viewBox="0 0 13 10" fill="none"><line x1="1.5" y1="5" x2="11.5" y2="5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><polyline points="4,2 1.5,5 4,8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polyline points="9,2 11.5,5 9,8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
var SWAP_ICON_ROW = `<svg width="11" height="9" viewBox="0 0 11 9" fill="none"><line x1="1.5" y1="4.5" x2="9.5" y2="4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><polyline points="3.5,2 1.5,4.5 3.5,7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polyline points="7.5,2 9.5,4.5 7.5,7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
function renderReceiptVision(visionState2, { readFile }) {
  const zone = document.getElementById("visionZone");
  if (!zone) return;
  zone.innerHTML = `
    <button type="button" class="vision-upload-area" id="visionDropArea">
      <div class="vision-empty">
        <div class="vision-empty-icon">${RECEIPT_ICON}</div>
        <div class="vision-empty-cta">อัพโหลดรูปใบเสร็จ</div>
        ${visionState2.statusMsg ? `<div class="vision-status-msg ${visionState2.statusKind}">${esc(visionState2.statusMsg)}</div>` : `<div class="vision-empty-sub">รองรับ JPG, PNG, WebP หรือลากไฟล์มาวาง</div>`}
        <div class="vision-login-notice">อ่านรูปในเครื่องคุณ เช็กชื่อเมนูกับราคาก่อนเพิ่มลงบิล</div>
      </div>
    </button>`;
  const dropArea = document.getElementById("visionDropArea");
  if (dropArea) {
    dropArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropArea.classList.add("drag-over");
    });
    dropArea.addEventListener("dragleave", () => dropArea.classList.remove("drag-over"));
    dropArea.addEventListener("drop", (e) => {
      e.preventDefault();
      dropArea.classList.remove("drag-over");
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith("image/")) readFile(file);
    });
    dropArea.addEventListener("click", () => document.getElementById("imageFilePicker").click());
  }
}
function rowEditTarget(element, key) {
  const rowId = element.closest("tr").dataset.rowId;
  return [rowId, element.dataset[key].slice(rowId.length + 1)];
}
function renderPriceCell(state2, row, colLabel) {
  const { unitPrice, lineTotal } = getDerivedValues(row);
  const isCanonical = colLabel === row.priceSource;
  const roleClass = isCanonical ? "td-canonical td-price-source" : "td-derived";
  const value = colLabel === "unit_price" ? unitPrice : lineTotal;
  const field = `${esc(row.id)}:${colLabel}`;
  const editing = state2.editing?.rowId === row.id && state2.editing.field === colLabel;
  if (editing) {
    return `<td class="cell-with-overlay ${roleClass}"><input class="ci price" data-edit-input="${field}" value="${formatMoney(value)}" inputmode="decimal" enterkeyhint="done" autocomplete="off" spellcheck="false" /></td>`;
  }
  const isRightCol = state2.colOrder[1] === colLabel;
  const swapOverlay = isRightCol && !row.isDiscount ? `<button class="swap-position swap-row-btn" data-swap-row="${esc(row.id)}" title="สลับราคาแถวนี้">${SWAP_ICON_ROW}</button>` : "";
  const column = isRightCol ? " td-price-end" : "";
  const discount = isCanonical && row.isDiscount ? " td-discount" : "";
  const display = formatMoneyDisplay(value);
  const content2 = isRightCol ? `<span data-p2-num class="p2-num">${display}</span>` : display;
  return `<td class="${roleClass}${discount}${column}" data-edit-cell="${field}">${swapOverlay}${content2}</td>`;
}
function renderInput(model, actions) {
  const app = document.getElementById("app"), state2 = model;
  app.innerHTML = `
    ${renderReceiptHeader()}
    <div class="pg-input">
      <div class="input-inner">
        <div class="vision-zone" id="visionZone"></div>
        <div class="ta-card">
          <div class="ta-bar">
            <span class="ta-lbl">ข้อความที่อ่าน/คัดลอกจากภาพใบเสร็จ</span>
            <button class="clear-ta-btn" id="clearTaBtn" ${!state2.raw ? "disabled" : ""}>ลบทั้งหมด</button>
          </div>
          <textarea class="receipt-ta" id="receiptText" placeholder="${RECEIPT_PLACEHOLDER}">${esc(state2.raw || "")}</textarea>
        </div>
      </div>
    </div>
    <div class="parse-wrap">
      <div class="parse-wrap-inner">
        <button class="parse-btn" id="parseBtn">แยกเมนูและราคาอัตโนมัติ</button>
      </div>
    </div>`;
  renderReceiptVision(model.vision, { readFile: actions.readFile });
  const history = mountViewHistory(model, actions), cleanup = mountReceiptLayout();
  const imagePicker = document.getElementById("imageFilePicker");
  const pickImage = imagePicker.onchange = (e) => {
    const f = e.target.files?.[0];
    if (f) actions.readFile(f);
    imagePicker.value = "";
  };
  const ta = document.getElementById("receiptText");
  ta.addEventListener("input", () => {
    actions.rawChanged(ta.value);
    document.getElementById("clearTaBtn").disabled = !ta.value;
  });
  ta.addEventListener("paste", (e) => {
    const html = e.clipboardData?.getData("text/html") || "";
    const flat = flattenHtmlTable(html);
    if (flat === null) return;
    e.preventDefault();
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    ta.value = before + flat + after;
    ta.selectionStart = ta.selectionEnd = start + flat.length;
    actions.rawChanged(ta.value);
    const clearBtn = document.getElementById("clearTaBtn");
    if (clearBtn) clearBtn.disabled = !ta.value;
  });
  document.getElementById("clearTaBtn").addEventListener("click", actions.clearText);
  actions.bindAction(document.getElementById("p1BackBtn"), actions.returnToBill);
  actions.bindAction(document.getElementById("parseBtn"), actions.parse);
  const cancelInitial = scheduleInitialLayout();
  return () => {
    cancelInitial();
    cleanup();
    history.dispose();
    if (imagePicker.onchange === pickImage) imagePicker.onchange = null;
  };
}
function renderReview(model, actions) {
  const app = document.getElementById("app"), state2 = model;
  let _summaryCardFocusing = false;
  const subtotal = reviewSubtotal(state2);
  const summaryView = receiptSummary(subtotal, state2.summarySource, state2.summaryEdits, state2.discountCanonical);
  const showSC = summaryView.service_charge.amount > 0 || summaryView.service_charge.rate > 0;
  const showVAT = summaryView.vat.amount > 0 || summaryView.vat.rate > 0;
  const showDisc = summaryView.discount.amount > 0;
  const footerColspan = 3;
  const firstItemRow = state2.rows.find((r) => !r.isDiscount);
  const canonicalRole = firstItemRow ? firstItemRow.priceSource : "line_total";
  const rowsHtml = state2.rows.map((row, i) => {
    const cls = row.isDiscount ? "row-disc" : i % 2 === 0 ? "row-even" : "row-odd";
    const nameEditing = state2.editing?.rowId === row.id && state2.editing?.field === "itemName";
    const qtyEditing = state2.editing?.rowId === row.id && state2.editing?.field === "qty";
    const discTypeBadge = row.isDiscount && row.discountType ? `<span class="badge-discount-type badge">${row.discountType === "percent" ? "%" : "฿"}</span>` : "";
    const nameCell = nameEditing ? `<td class="td-canonical"><input class="ci name" data-edit-input="${esc(row.id)}:itemName" value="${esc(row.itemName)}" enterkeyhint="done" autocomplete="off" spellcheck="false" /></td>` : `<td class="td-name td-canonical" data-edit-cell="${esc(row.id)}:itemName">${esc(row.itemName)}${row.isDiscount ? '<span class="badge badge-d">disc</span>' : ""}${discTypeBadge}${row.needsReview && !row.isDiscount ? '<span class="badge badge-r">?</span>' : ""}${row.flags?.length > 0 ? `<span class="badge badge-w" title="${esc((row.flags || []).map((f) => f.msg || f.type).join(" / "))}">!</span>` : ""}</td>`;
    const qtyCell = qtyEditing ? `<td class="td-quantity td-canonical"><input class="ci qty" data-edit-input="${esc(row.id)}:qty" value="${row.qty}" inputmode="numeric" enterkeyhint="done" autocomplete="off" spellcheck="false" /></td>` : `<td class="td-quantity td-canonical" data-edit-cell="${esc(row.id)}:qty"><span>${row.qty}</span></td>`;
    return `<tr class="${cls}" data-row-id="${esc(row.id)}">${nameCell}${qtyCell}${renderPriceCell(state2, row, state2.colOrder[0])}${renderPriceCell(state2, row, state2.colOrder[1])}<td class="td-del"><button class="del" data-delete="${esc(row.id)}" title="ลบ">${BIN_ICON}</button></td></tr>`;
  }).join("");
  const scRateLabel = summaryView.service_charge.rate > 0 ? ` (${formatPctForDisplay(summaryView.service_charge.rate)}%)` : "";
  const vatRateLabel = summaryView.vat.rate > 0 ? ` (${formatPctForDisplay(summaryView.vat.rate)}%)` : "";
  const discRateLabel = state2.discountCanonical === "rate" && summaryView.discount.rate > 0 ? ` (${formatPctForDisplay(summaryView.discount.rate)}%)` : "";
  app.innerHTML = `
    <div class="pg-results">
      ${renderReceiptHeader(true)}
      <div class="sub-bar receipt-history-row" id="subBar" hidden></div>
      <div class="res-inner">
      <div class="summary-sticky-bar" id="summaryBar">
        <div class="ssb-card"><span class="ssb-lbl">รวมค่าอาหาร</span><span class="ssb-val ssb-subtotal">${formatMoneyDisplay(summaryView.subtotal)}</span></div>
        <div class="ssb-card ssb-card-total"><span class="ssb-lbl">ยอดที่ต้องจ่าย</span><span class="ssb-val ssb-total">${formatMoneyDisplay(summaryView.total)}</span></div>
      </div>
      <div class="summary-grid">${renderChargeCard("service_charge", "Service Charge", summaryView.service_charge, "SC")}${renderChargeCard("vat", "VAT", summaryView.vat)}${renderDiscountCard(summaryView.discount)}</div>
      <div class="swap-bar"><span class="swap-hint"><span class="swap-hint-fragment"><span class="swap-hint-emphasis">เลขสีส้ม </span><span class="swap-hint-p2">คือราคาที่อ่านได้จากใบเสร็จ</span></span><span class="swap-hint-fragment swap-hint-p2">หรือราคาที่คุณแก้ไขใหม่</span></span></div>
      <div class="tbl-card"><div class="tbl-scroll"><table>
        <colgroup><col class="col-name"/><col class="col-qty"/><col class="col-p1"/><col class="col-p2"/><col class="col-del"/></colgroup>
        <thead><tr>
          <th class="th-name th-fix">เมนู</th>
          <th class="th-quantity th-fix right">จำนวน</th>
          ${(() => {
    const thCells = state2.colOrder.map((role, idx) => {
      const isCanonical = role === canonicalRole;
      const label = role === "unit_price" ? "ราคา" : "ยอดรวม";
      if (idx === 1) {
        return `<th class="cell-with-overlay th-fix right${isCanonical ? " th-canonical" : ""}"><button class="swap-position swap-col-btn" id="swapColsBtn" title="สลับคอลัมน์ราคาทั้งหมด">${SWAP_ICON_ALL}</button><span class="th-label">${label}</span></th>`;
      }
      return `<th class="th-fix right${isCanonical ? " th-canonical" : ""}"><span class="th-label">${label}</span></th>`;
    });
    return thCells[0] + thCells[1];
  })()}
          <th class="th-delete th-fix"></th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr><td class="tfoot-label" colspan="${footerColspan}">รวมค่าอาหาร</td><td class="tfoot-value tfoot-subtotal">${formatMoneyDisplay(summaryView.subtotal)}</td><td></td></tr>
          ${showSC ? `<tr><td class="tfoot-label" colspan="${footerColspan}">Service Charge${esc(scRateLabel)}</td><td class="tfoot-value tfoot-sc">+${formatMoneyDisplay(summaryView.service_charge.amount)}</td><td></td></tr>` : ""}
          ${showVAT ? `<tr><td class="tfoot-label" colspan="${footerColspan}">VAT${esc(vatRateLabel)}</td><td class="tfoot-value tfoot-vat">+${formatMoneyDisplay(summaryView.vat.amount)}</td><td></td></tr>` : ""}
          ${showDisc ? `<tr><td class="tfoot-label" colspan="${footerColspan}">ส่วนลด${esc(discRateLabel)}</td><td class="tfoot-value tfoot-disc">-${formatMoneyDisplay(summaryView.discount.amount)}</td><td></td></tr>` : ""}
          <tr class="tfoot-grand"><td class="tfoot-label" colspan="${footerColspan}">ยอดที่ต้องจ่าย</td><td class="tfoot-value tfoot-total">${formatMoneyDisplay(summaryView.total)}</td><td></td></tr>
        </tfoot>
      </table></div></div>
      <div class="results-bottom-spacer" aria-hidden="true"></div>
    </div></div>
    <div class="submit-wrap"><div class="submit-wrap-inner"><button class="submit-btn" id="submitBtn">เพิ่มเมนูลงบิล</button></div></div>`;
  const error = document.createElement("p");
  error.id = "receipt-import-error";
  error.className = "import-error";
  error.setAttribute("role", "alert");
  error.hidden = true;
  document.querySelector(".results-bottom-spacer").before(error);
  const history = mountViewHistory(model, actions), cleanup = mountReceiptLayout();
  if (model.draftNotice) showReceiptError(model.draftNotice);
  bindActionById("backBtn", actions.backToInput);
  bindActionById("addBtn", actions.addRow);
  bindActionById("submitBtn", actions.submit);
  bindActionById("swapColsBtn", actions.swapAll);
  app.querySelectorAll("[data-swap-row]").forEach((btn) => {
    actions.bindAction(btn, () => actions.swapRow(btn.dataset.swapRow));
  });
  app.querySelectorAll("[data-edit-cell]").forEach((cell) => {
    const [rowId, field] = rowEditTarget(cell, "editCell");
    actions.bindAction(cell, () => actions.startEdit(rowId, field));
  });
  app.querySelectorAll("[data-edit-input]").forEach((input) => {
    const [rowId, field] = rowEditTarget(input, "editInput");
    const selectAll = field !== "itemName";
    let committing = false;
    input.addEventListener("focus", () => {
      if (selectAll && typeof input.select === "function") input.select();
    });
    input.addEventListener("blur", () => {
      if (committing) {
        committing = false;
        return;
      }
      actions.commitRow(rowId, field, input.value);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        committing = true;
        input.blur();
        actions.commitRow(rowId, field, input.value);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        committing = true;
        input.blur();
        actions.cancelEdit();
      }
    });
  });
  app.querySelectorAll("[data-delete]").forEach((btn) => {
    actions.bindAction(btn, () => actions.deleteRow(btn.dataset.delete));
  });
  app.querySelectorAll("[data-summary-card]").forEach((card) => {
    card.querySelectorAll("[data-summary-input]").forEach((input) => {
      const [cardKind, field] = input.dataset.summaryInput.split(":");
      let committing = false;
      let valueAtFocus = null;
      input.addEventListener("pointerdown", () => {
        _summaryCardFocusing = true;
      });
      input.addEventListener("focus", () => {
        _summaryCardFocusing = false;
        valueAtFocus = input.value;
        if (typeof input.select === "function") input.select();
      });
      input.addEventListener("blur", () => {
        if (committing) {
          committing = false;
          return;
        }
        if (input.value === valueAtFocus) {
          return;
        }
        if (_summaryCardFocusing) {
          actions.editSummary(cardKind, field, input.value, { forceHistory: true, render: false });
          return;
        }
        actions.editSummary(cardKind, field, input.value);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.isComposing) {
          e.preventDefault();
          committing = true;
          input.blur();
          actions.editSummary(cardKind, field, input.value);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          committing = true;
          input.blur();
          actions.cancelEdit();
        }
      });
    });
  });
  const cancelInitial = scheduleInitialLayout();
  return () => {
    cancelInitial();
    cleanup();
    history.dispose();
  };
  function bindActionById(id, action) {
    const button = document.getElementById(id);
    if (button) actions.bindAction(button, action);
  }
}

// src/receipt-ocr-controller.mjs
function createReceiptOcrController({ reader, prepareImage: prepareImage2, getRaw, parseText, present }) {
  let generation = 0, active2 = null, disposed = false;
  const isCurrent = (operation) => !disposed && active2 === operation && operation.token === generation;
  function close(operation) {
    if (active2 !== operation) return;
    active2 = null;
    present.close(operation.token);
  }
  function cancel() {
    const operation = active2;
    if (!operation) return;
    generation++;
    operation.preparation.abort();
    Promise.resolve(reader.cancel()).catch(() => {
    });
    close(operation);
  }
  async function read(file) {
    if (disposed) return;
    cancel();
    const operation = { token: ++generation, progress: 0, startingRaw: getRaw(), preparation: new AbortController() };
    active2 = operation;
    const token = operation.token;
    present.open(token);
    present.progress(token, { label: "กำลังเตรียมอ่านรูป…", percent: 0, note: null, preparing: true });
    try {
      const image = await prepareImage2(file, { signal: operation.preparation.signal });
      if (!isCurrent(operation)) return;
      const raw = await reader.read(image, (event) => {
        if (!isCurrent(operation) || event.status !== "recognizing text" || !Number.isFinite(event.progress)) return;
        operation.progress = Math.max(operation.progress, Math.min(95, Math.max(0, event.progress * 95)));
        present.progress(token, {
          label: event.progress >= 1 ? "กำลังจัดเตรียมข้อความ…" : "กำลังอ่านข้อความ…",
          percent: operation.progress,
          note: null,
          preparing: false
        });
      });
      if (!isCurrent(operation)) return;
      if (getRaw() !== operation.startingRaw) throw Error("ข้อความที่คุณวางยังอยู่ในหน้านี้ ลองเลือกรูปอีกครั้ง");
      present.progress(token, { label: "อ่านรูปแล้ว", percent: 100, note: null, preparing: false });
      await present.success(token);
      if (!isCurrent(operation)) return;
      if (getRaw() !== operation.startingRaw) throw Error("ข้อความที่คุณวางยังอยู่ในหน้านี้ ลองเลือกรูปอีกครั้ง");
      await parseText(raw, () => isCurrent(operation));
    } catch (error) {
      if (isCurrent(operation)) present.error(token, error);
    } finally {
      close(operation);
    }
  }
  return {
    read,
    cancel,
    dispose() {
      disposed = true;
      cancel();
    }
  };
}

// src/receipt-import.mjs
function importReceipt(bill, draft, {
  mode = "append",
  charges = "receipt",
  assignmentMode = "preserve"
} = {}) {
  if (!["append", "replace"].includes(mode) || !["receipt", "keep"].includes(charges) || !["preserve", "all", "none"].includes(assignmentMode)) {
    throw Error("ตัวเลือกเพิ่มลงบิลไม่ถูกต้อง");
  }
  if (bill.imports.includes(draft.id)) throw Error("นำเข้าใบเสร็จนี้แล้ว");
  const next = structuredClone(bill);
  const before = structuredClone(bill);
  before.undo = null;
  if (mode === "replace") next.items = [];
  for (const source of draft.items) {
    const item = { ...structuredClone(source), groupId: "manual" };
    if (assignmentMode !== "preserve") {
      item.assignments = assignmentMode === "all" ? bill.people.map((person) => ({ personId: person.id, locked: false, amountCents: 0 })) : [];
      item.assignments = shares(item).map((share) => ({ ...share, locked: false }));
    }
    next.items.push(item);
  }
  if (charges === "receipt") {
    if (draft.group.tax.enabled && draft.group.tax.treatment === "unknown") {
      throw Error("กรุณาระบุว่าราคารวมภาษีแล้วหรือยัง");
    }
    next.groups = [{ ...structuredClone(draft.group), id: "manual", name: "บิลปัจจุบัน" }];
  }
  next.imports.push(draft.id);
  next.revision++;
  next.undo = { before, atRevision: next.revision };
  const normalized = normalizeBillPolicy(next);
  calculate(normalized);
  return normalized;
}

// src/receipt-import-controller.mjs
function createReceiptImportController({
  getSession,
  getReview,
  getStatus,
  setBaseRevision,
  setOptions,
  persistDraft: persistDraft2,
  confirmRepeat,
  chooseImport,
  onCommitted,
  onError,
  returnToBill: returnToBill2
}) {
  let busy = false;
  async function submit() {
    if (busy || getStatus().composing) return;
    busy = true;
    let repeatNeeded = false;
    try {
      const status = getStatus();
      if (status.targetError) throw Error(status.targetError);
      if (status.draftBlocked) throw Error("โปรดกลับไปแยกเมนูจากข้อความอีกครั้ง");
      const session = getSession();
      if (!session) throw Error("ไม่พบบิลนี้ เปิดบิลที่ต้องการก่อนอ่านใบเสร็จ");
      const loaded = await session.load();
      if (loaded.status !== "loaded") throw Error(loaded.message);
      const review = getReview();
      const repeated = session.current.imports.includes(review.draft?.id);
      let prepared = buildReviewedDraft(review);
      if (repeated) {
        if (!await confirmRepeat()) return;
        prepared = copyReceiptForImport(prepared);
        setBaseRevision(session.record.recordRevision);
      }
      let attemptSubmitted = false, committed = false;
      const hasItems = session.current.items.length > 0;
      const hasPeople = session.current.people.length > 0;
      const imported = await chooseImport({
        hasItems,
        hasPeople,
        mode: review.importMode,
        assignmentMode: review.importAssignments,
        onConfirm: async (options) => {
          setOptions(options);
          persistDraft2();
          const loaded2 = await session.load();
          if (loaded2.status !== "loaded") {
            const error = Error(loaded2.message);
            onError(error, { targetStatus: loaded2.status, inline: false });
            throw error;
          }
          const bill = session.current;
          if (bill.imports.includes(prepared.id)) {
            if (repeated || attemptSubmitted) {
              onCommitted(prepared);
              committed = true;
              persistDraft2();
              return;
            }
            repeatNeeded = true;
            onCommitted(prepared);
            return;
          }
          if (hasItems !== bill.items.length > 0 || hasPeople !== bill.people.length > 0) {
            throw Error("รายการหรือคนในบิลเปลี่ยนไป ปิดหน้าต่างนี้แล้วกดเพิ่มเมนูลงบิลอีกครั้งเพื่อเลือกใหม่");
          }
          if (getReview().baseRevision !== session.record.recordRevision) {
            setBaseRevision(session.record.recordRevision);
            persistDraft2();
            throw Error("บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนเพิ่มเมนู");
          }
          const next = importReceipt(bill, prepared, { ...options, charges: "receipt" });
          attemptSubmitted = true;
          const result = await session.commit(next, { kind: "import", baseRevision: getReview().baseRevision });
          if (!["saved", "unchanged"].includes(result.status)) throw Error(result.message);
          onCommitted(prepared);
          committed = true;
          persistDraft2();
        }
      });
      if (imported && committed && !repeatNeeded) await returnToBill2();
    } catch (error) {
      onError(error);
    } finally {
      busy = false;
    }
    if (repeatNeeded) await submit();
  }
  return { submit, get busy() {
    return busy;
  } };
}

// src/history.mjs
var clone2 = (value) => structuredClone(value);
function sameValue(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && sameValue(a[key], b[key]));
}
function createHistory(initial, { limit = 20, equal = sameValue, serialized } = {}) {
  let states = [clone2(initial)], cursor = 0;
  if (serialized) {
    if (serialized.format !== 1 || !Array.isArray(serialized.states) || !serialized.states.length || serialized.states.length > limit + 1 || !Number.isInteger(serialized.cursor) || serialized.cursor < 0 || serialized.cursor >= serialized.states.length) throw Error("ข้อมูลประวัติไม่ถูกต้อง");
    states = clone2(serialized.states);
    cursor = serialized.cursor;
  }
  return {
    get current() {
      return clone2(states[cursor]);
    },
    get canUndo() {
      return cursor > 0;
    },
    get canRedo() {
      return cursor < states.length - 1;
    },
    // Unrecorded options belong to this slot; older states and redo stay intact.
    replaceCurrent(next) {
      states[cursor] = clone2(next);
    },
    record(next, { force = false } = {}) {
      if (!force && equal(states[cursor], next)) return false;
      states = states.slice(0, cursor + 1);
      states.push(clone2(next));
      if (states.length > limit + 1) states.shift();
      cursor = states.length - 1;
      return true;
    },
    undo() {
      if (cursor > 0) cursor--;
      return clone2(states[cursor]);
    },
    redo() {
      if (cursor < states.length - 1) cursor++;
      return clone2(states[cursor]);
    },
    reset(next) {
      states = [clone2(next)];
      cursor = 0;
    },
    mapStates(mapper) {
      const mapped = [];
      let position = 0;
      states.forEach((state2, index) => {
        const next = mapper(clone2(state2));
        if (!mapped.length || !equal(mapped.at(-1), next)) mapped.push(clone2(next));
        if (index === cursor) position = mapped.length - 1;
      });
      states = mapped;
      cursor = position;
    },
    serialize() {
      return { format: 1, states: clone2(states), cursor };
    }
  };
}

// src/receipt-review-model.mjs
var roundMoney = (value) => Math.round(value * 100) / 100;
var fields = ["rows", "summarySource", "summaryEdits", "discountCanonical", "colOrder", "importMode", "importAssignments"];
function snapshot(review = {}) {
  const defaults = {
    rows: [],
    summarySource: null,
    summaryEdits: { service_charge_rate: null, vat_rate: null, discount_rate: null, discount_amount: null },
    discountCanonical: "rate",
    colOrder: ["unit_price", "line_total"],
    importMode: "append",
    importAssignments: "all"
  };
  return Object.fromEntries(fields.map((field) => [field, structuredClone(review[field] ?? defaults[field])]));
}
function createReceiptReviewModel(initialReview) {
  const history = createHistory(snapshot(initialReview), { limit: 20 });
  function edit(mutator, { force = false } = {}) {
    const next = history.current;
    mutator(next);
    history.record(next, { force });
    return history.current;
  }
  return {
    getSnapshot: () => history.current,
    replace: (review) => history.reset(snapshot(review)),
    setImportOptions({ mode, assignmentMode }) {
      const next = history.current;
      if (mode !== void 0) next.importMode = mode;
      if (assignmentMode !== void 0) next.importAssignments = assignmentMode;
      history.replaceCurrent(next);
    },
    updateRow(id, patch) {
      return edit((review) => {
        review.rows = review.rows.map((row) => row.id === id ? { ...row, ...structuredClone(patch) } : row);
      });
    },
    addRow(row) {
      return edit((review) => {
        review.rows.push(structuredClone(row));
      }, { force: true });
    },
    deleteRow(id) {
      return edit((review) => {
        review.rows = review.rows.filter((row) => row.id !== id);
      }, { force: true });
    },
    swapPrices(idOrNull = null) {
      return edit((review) => {
        review.rows = review.rows.map((row) => idOrNull == null || row.id === idOrNull ? { ...row, priceSource: row.priceSource === "line_total" ? "unit_price" : "line_total" } : row);
      }, { force: true });
    },
    editSummary(kind, field, value, { forceHistory = false } = {}) {
      return edit((review) => {
        const subtotal = reviewSubtotal(review);
        const current = receiptSummary(subtotal, review.summarySource, review.summaryEdits, review.discountCanonical);
        const parsed = parseFloat(String(value).replace(/,/g, "").replace(/-/g, ""));
        const amount = Number.isFinite(parsed) ? Math.abs(parsed) : 0;
        if (kind === "service_charge" || kind === "vat") {
          review.summarySource = { ...review.summarySource, [kind]: {
            ...review.summarySource?.[kind],
            mode: field === "rate" ? "percent" : "amount",
            value: amount
          } };
          const basis = kind === "vat" ? roundMoney(subtotal + current.service_charge.amount) : subtotal;
          review.summaryEdits = {
            ...review.summaryEdits,
            [kind + "_rate"]: field === "rate" ? amount : basis > 0 ? amount / basis * 100 : 0
          };
        } else if (kind === "discount") {
          review.discountCanonical = field === "rate" ? "rate" : "amount";
          review.summaryEdits = {
            ...review.summaryEdits,
            discount_rate: field === "rate" ? amount : null,
            discount_amount: field === "rate" ? null : amount
          };
        }
      }, { force: forceHistory });
    },
    undo: () => history.undo(),
    redo: () => history.redo(),
    get canUndo() {
      return history.canUndo;
    },
    get canRedo() {
      return history.canRedo;
    }
  };
}

// src/receipt-text-history.mjs
function createReceiptTextHistory(initialText = "") {
  const history = createHistory(initialText, { limit: 19 });
  return {
    record: (text2) => history.record(text2),
    undo(currentText) {
      history.record(currentText);
      return history.undo();
    },
    redo(currentText) {
      history.record(currentText);
      return history.redo();
    },
    reset: (text2) => history.reset(text2),
    canUndo: (currentText) => history.canUndo || currentText !== history.current,
    get canRedo() {
      return history.canRedo;
    }
  };
}

// src/bill-admission.mjs
function assertSingleGroup(bill) {
  if (bill.groups.length !== 1) {
    throw Error("ข้อมูลนี้มีหลายชุดค่าใช้จ่าย กรุณาดาวน์โหลดสำรองก่อนรวมบิล");
  }
}
function admittedBill(value) {
  const bill = normalizeBillPolicy(value);
  assertSingleGroup(bill);
  calculate(bill);
  return bill;
}

// src/bill-work-keys.mjs
var HISTORY_KEY = "fairshare.bill-history.v2:";
var billHistoryKey = (id) => HISTORY_KEY + id;
var receiptDraftKey = (id) => "fairshare.approved-parser.v3:" + id;
var mainScrollKey = (id) => "fairshare.main-scroll.v2:" + id;
var billUiKey = (id) => "fairshare.ui.v2:" + id;

// src/bill-session.mjs
var MAX_BYTES = 2 * 1024 * 1024;
var clone3 = (value) => structuredClone(value);
var content = (bill) => {
  const b = clone3(bill);
  delete b.revision;
  delete b.undo;
  delete b.imports;
  return b;
};
var snapshot2 = (value, imports) => ({ ...emptyBill(), ...clone3(value), imports: [...imports], undo: null });
var fits = (value) => new TextEncoder().encode(JSON.stringify(value)).length <= MAX_BYTES;
function purgeBillWork(storage, id) {
  for (const key of [billHistoryKey(id), receiptDraftKey(id), mainScrollKey(id), billUiKey(id)]) try {
    storage?.removeItem(key);
  } catch {
  }
}
function createBillSession({ repository: repository2, billId: billId2, sessionStorage: sessionStorage2 }) {
  let record = null, history = null, persistence = "session", blocked = false, busy = false;
  const key = billHistoryKey(billId2);
  function write(value) {
    try {
      if (!sessionStorage2 || !fits(value)) return false;
      const raw = JSON.stringify(value);
      sessionStorage2.setItem(key, raw);
      return sessionStorage2.getItem(key) === raw;
    } catch {
      return false;
    }
  }
  const envelope = (r = record, h = history) => ({ format: 2, billId: billId2, revision: r.bill.revision, content: content(r.bill), history: h.serialize() });
  function result(status, message) {
    return { status, bill: record && clone3(record.bill), record: record && clone3(record), historyPersistence: persistence, message };
  }
  async function load({ canAdopt = () => true } = {}) {
    try {
      const next = await repository2.read(billId2);
      if (!next) {
        blocked = true;
        return result("missing", "ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์");
      }
      if (!canAdopt(next)) return result("conflict", "บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนบันทึก");
      blocked = false;
      const old = record, oldHistory = history;
      record = next;
      history = createHistory(content(next.bill));
      let restored = false;
      if (oldHistory && old.bill.revision === next.bill.revision && sameValue(content(old.bill), content(next.bill))) {
        history = oldHistory;
        restored = true;
      }
      try {
        let saved = JSON.parse(sessionStorage2?.getItem(key) || "null");
        if (saved?.pending) {
          const pending = saved.pending;
          if (next.lastMutationId === pending.mutationId) saved = pending.to;
          else if (sameValue(content(next.bill), pending.from.content) && next.bill.revision === pending.from.revision) saved = pending.from;
          else saved = null;
        }
        if (!restored && saved?.format === 2 && saved.billId === billId2 && saved.revision === next.bill.revision && sameValue(saved.content, content(next.bill)) && fits(saved)) {
          const restoredHistory = createHistory(null, { serialized: saved.history });
          for (const state2 of saved.history.states) admittedBill(snapshot2(state2, next.bill.imports));
          if (!sameValue(restoredHistory.current, content(next.bill))) throw Error("ประวัติไม่ตรงกับบิล");
          history = restoredHistory;
          restored = true;
        }
      } catch {
        persistence = "memory";
      }
      persistence = write(envelope()) ? "session" : "memory";
      return result("loaded", old && old.bill.revision !== next.bill.revision ? "บิลเปลี่ยนจากอีกแท็บ ประวัติย้อนกลับของบิลนี้เริ่มใหม่" : void 0);
    } catch (error) {
      blocked = true;
      return result("failed", error.message);
    }
  }
  async function assertCurrent() {
    const latest = await repository2.read(billId2);
    if (!latest) {
      blocked = true;
      throw Error("ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์");
    }
    if (!record || latest.recordRevision !== record.recordRevision) {
      blocked = true;
      throw Error("บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดแล้วลองอีกครั้ง");
    }
    return clone3(latest);
  }
  async function commit(candidate, { baseRevision: baseRevision2 = record?.recordRevision, kind = "edit", mutationId = newId(), timeline } = {}) {
    if (busy) return result("failed", "กำลังบันทึก รอสักครู่");
    if (blocked || !record) return result("conflict", "เช็กบิลล่าสุดก่อนบันทึก");
    busy = true;
    try {
      await assertCurrent();
      if (baseRevision2 !== record.recordRevision) return result("conflict", "บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดแล้วลองอีกครั้ง");
      const next = admittedBill(candidate);
      next.undo = null;
      next.imports = [.../* @__PURE__ */ new Set([...record.bill.imports, ...next.imports])];
      if (sameValue(content(next), content(record.bill)) && sameValue(next.imports, record.bill.imports)) return result("unchanged");
      next.revision = record.bill.revision + 1;
      admittedBill(next);
      let h = createHistory(null, { serialized: timeline ?? history.serialize() });
      if (!timeline) h.record(content(next));
      const pendingRecord = { ...record, bill: next };
      while (!fits(envelope(pendingRecord, h)) && h.serialize().states.length > 1) {
        const s = h.serialize();
        if (s.cursor > 0) {
          s.states.shift();
          s.cursor--;
        } else s.states.pop();
        h = createHistory(null, { serialized: s });
      }
      const from = envelope(), to = envelope(pendingRecord, h);
      persistence = write({ ...from, pending: { kind, from, to, mutationId } }) ? "session" : "memory";
      const outcome = await repository2.write({ id: billId2, expectedRevision: baseRevision2, mutationId, change: { kind: "content", bill: next } });
      if (!["saved", "unchanged"].includes(outcome.status)) {
        if (["conflict", "missing", "uncertain"].includes(outcome.status)) blocked = true;
        if (outcome.status !== "uncertain") write(from);
        return result(outcome.status, outcome.message);
      }
      record = outcome.record;
      history = h;
      persistence = write(envelope()) ? "session" : "memory";
      return result(outcome.status, persistence === "session" ? void 0 : "บิลบันทึกแล้ว แต่ประวัติย้อนกลับอาจหายเมื่อโหลดใหม่");
    } catch (error) {
      return result(blocked ? "conflict" : "failed", error.message);
    } finally {
      busy = false;
    }
  }
  async function move(direction) {
    if (!history || !(direction === "undo" ? history.canUndo : history.canRedo)) return result("unchanged");
    const h = createHistory(null, { serialized: history.serialize() });
    return commit(snapshot2(h[direction](), record.bill.imports), { kind: direction, timeline: h.serialize() });
  }
  return {
    load,
    commit,
    undo: () => move("undo"),
    redo: () => move("redo"),
    reconcile: load,
    assertCurrent,
    get current() {
      return record && clone3(record.bill);
    },
    get record() {
      return record && clone3(record);
    },
    get billId() {
      return billId2;
    },
    get canUndo() {
      return !blocked && !!history?.canUndo;
    },
    get canRedo() {
      return !blocked && !!history?.canRedo;
    }
  };
}

// src/editor-actions.mjs
function createEditorActions(root = document) {
  const actions = /* @__PURE__ */ new WeakMap(), composing = /* @__PURE__ */ new Set();
  let pointer = null, pending = null, suppressedClick = null;
  const controller = new AbortController(), options = { capture: true, signal: controller.signal };
  function run(action) {
    if (composing.size) {
      pending = action;
      return false;
    }
    const editor = root.activeElement ?? document.activeElement;
    editor?.blur?.();
    action();
    return true;
  }
  root.addEventListener("compositionstart", (e) => composing.add(e.target), options);
  root.addEventListener("compositionend", (e) => {
    composing.delete(e.target);
    requestAnimationFrame(() => {
      if (!composing.size && pending) {
        const action = pending;
        pending = null;
        run(action);
      }
    });
  }, options);
  root.addEventListener("pointerdown", (e) => {
    suppressedClick = null;
    const button = e.target.closest?.("button,[data-editor-action]");
    if (button && actions.has(button)) {
      pointer = { button, x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, options);
  root.addEventListener("pointermove", (e) => {
    if (pointer && Math.hypot(e.clientX - pointer.x, e.clientY - pointer.y) > 8) pointer = null;
  }, options);
  root.addEventListener("pointercancel", () => {
    pointer = null;
  }, options);
  root.addEventListener("pointerup", (e) => {
    const p = pointer;
    pointer = null;
    if (!p || p.button.disabled || e.target.closest?.("button,[data-editor-action]") !== p.button) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    suppressedClick = { pointerId: e.pointerId };
    run(actions.get(p.button));
  }, options);
  root.addEventListener("click", (e) => {
    const handled = suppressedClick;
    suppressedClick = null;
    if (handled && e.detail > 0 && (e.pointerId === void 0 || e.pointerId === handled.pointerId)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, options);
  return {
    bind(button, action) {
      if (button.dataset && button.tagName !== "BUTTON") button.dataset.editorAction = "";
      actions.set(button, action);
      button.addEventListener("click", (e) => {
        if (button.tagName !== "INPUT" || !["checkbox", "radio"].includes(button.type)) e.preventDefault();
        e.stopImmediatePropagation();
        run(action);
      });
    },
    run,
    get composing() {
      return composing.size > 0;
    },
    dispose() {
      controller.abort();
      composing.clear();
      pending = null;
    }
  };
}

// src/choice-layout.mjs
function measureChoiceGroup(group, { textFor = (face) => face.textContent } = {}) {
  const context = document.createElement("canvas").getContext("2d");
  const px = (value) => parseFloat(value) || 0;
  const groupStyle = getComputedStyle(group);
  const weights = ["--choice-rest-weight", "--choice-selected-weight"].map((token) => groupStyle.getPropertyValue(token).trim()).filter(Boolean);
  const widths = [...group.querySelectorAll(".segmented-face")].map((face) => {
    const style = getComputedStyle(face);
    const text2 = textFor(face);
    const textWidth = Math.max(...(weights.length ? weights : [style.fontWeight]).map((weight) => {
      context.font = `${weight} ${style.fontSize} ${style.fontFamily}`;
      return context.measureText(text2).width;
    }));
    return textWidth + Math.max(0, [...text2].length - 1) * px(style.letterSpacing) + px(style.paddingLeft) + px(style.paddingRight) + px(style.borderLeftWidth) + px(style.borderRightWidth);
  });
  return Math.ceil(2 * Math.max(...widths) + px(groupStyle.columnGap) + px(groupStyle.paddingLeft) + px(groupStyle.paddingRight) + px(groupStyle.borderLeftWidth) + px(groupStyle.borderRightWidth));
}
function layoutAdjustments(row) {
  if (!row?.clientWidth) return;
  const px = (value) => parseFloat(value) || 0, cards = [...row.children];
  const outer = (style) => px(style.paddingLeft) + px(style.paddingRight) + px(style.borderLeftWidth) + px(style.borderRightWidth);
  row.classList.remove("adj-cards-stacked");
  for (const card of cards) card.classList.remove("ab-wide", "adj-controls-stacked");
  const compactOuter = cards.map((card) => outer(getComputedStyle(card)));
  for (const card of cards) card.classList.add("ab-wide");
  const gap = px(getComputedStyle(row).columnGap), column = (row.clientWidth - gap * (cards.length - 1)) / cards.length;
  const metrics = cards.map((card, index) => {
    const control = card.querySelector(".adj-bar-ctrl"), children = [...control.children], style = getComputedStyle(control);
    const widths = children.map((n) => n.getBoundingClientRect().width);
    const cardStyle = getComputedStyle(card);
    return { card, full: widths.reduce((a, b) => a + b, 0) + px(style.columnGap) * (widths.length - 1), min: Math.max(...widths), label: card.querySelector(".adj-bar-label").getBoundingClientRect().width, compactOuter: compactOuter[index], wideOuter: outer(cardStyle), gap: px(cardStyle.columnGap) };
  });
  const stacked = metrics.some((m) => m.min + m.compactOuter > column), width = stacked ? row.clientWidth : column;
  row.classList.toggle("adj-cards-stacked", stacked);
  const wide = metrics.every((m) => m.full + m.label + m.wideOuter + m.gap + 1 <= width);
  const controlsStacked = !wide && metrics.some((m) => m.full + m.compactOuter + 1 > width);
  for (const m of metrics) {
    m.card.classList.toggle("ab-wide", wide);
    m.card.classList.toggle("adj-controls-stacked", controlsStacked);
  }
}
function observeChoices(host, update) {
  let frame = 0, disposed = false;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!disposed) update();
    });
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(host);
  for (const face of host.querySelectorAll(".segmented-face")) observer.observe(face);
  document.fonts?.ready.then(() => {
    if (!disposed) schedule();
  });
  document.fonts?.addEventListener("loadingdone", schedule);
  update();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    document.fonts?.removeEventListener("loadingdone", schedule);
  };
}

// src/interaction-busy.mjs
var surfaces = 'button,input,select,textarea,a[href],label,[contenteditable]:not([contenteditable="false"]),[role="button"],[data-a],[data-editor-action],.open-row,.person-chip';
var events = ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "keydown", "beforeinput", "paste", "cut", "drop", "change"];
function createInteractionBusy(root, { signal } = {}) {
  const window2 = root.ownerDocument.defaultView, lifetime = new AbortController(), attributes = /* @__PURE__ */ new Map();
  let busy = false, disposed = false;
  function restore(node, previous) {
    if (node.getAttribute("aria-disabled") !== "true") return;
    if (previous === null) node.removeAttribute("aria-disabled");
    else node.setAttribute("aria-disabled", previous);
  }
  function refresh() {
    if (!busy || disposed) return;
    for (const [node, previous] of attributes) if (!root.contains(node)) {
      restore(node, previous);
      attributes.delete(node);
    }
    for (const node of root.querySelectorAll(surfaces)) {
      if (attributes.has(node)) continue;
      attributes.set(node, node.getAttribute("aria-disabled"));
      node.setAttribute("aria-disabled", "true");
    }
  }
  const observer = new window2.MutationObserver(refresh);
  function block(event) {
    if (!busy || !root.contains(event.target)) return;
    const target = event.target.closest?.(surfaces);
    if (!target || !root.contains(target)) return;
    if (event.type === "keydown") {
      const key = event.key;
      if (key === "Tab" || ["Shift", "Control", "Alt", "Meta"].includes(key)) return;
      if ((event.ctrlKey || event.metaKey) && ["c", "a"].includes(key.toLowerCase())) return;
      const choice = target.matches("select,input[type=radio],input[type=checkbox],input[type=range]");
      const editable = target.matches('textarea,input:not([type=radio]):not([type=checkbox]):not([type=button]):not([type=submit]),[contenteditable]:not([contenteditable="false"])');
      if (!["Enter", " ", "Spacebar", "Escape"].includes(key) && !(choice && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(key)) && !(editable && (key.length === 1 || ["Backspace", "Delete"].includes(key)))) return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  for (const type of events) window2.addEventListener(type, block, { capture: true, signal: lifetime.signal });
  function setBusy(value) {
    if (disposed) return;
    busy = !!value;
    if (busy) {
      refresh();
      observer.observe(root, { subtree: true, childList: true });
    } else {
      observer.disconnect();
      for (const [node, previous] of attributes) restore(node, previous);
      attributes.clear();
    }
  }
  function dispose() {
    if (disposed) return;
    setBusy(false);
    disposed = true;
    lifetime.abort();
    signal?.removeEventListener("abort", dispose);
  }
  if (signal?.aborted) dispose();
  else signal?.addEventListener("abort", dispose, { once: true });
  return { setBusy, dispose };
}

// src/in-app-confirm.mjs
var active = null, sequence = 0;
var customName = (value) => ({ em: String(value) });
function setSheetText(node, value) {
  node.replaceChildren();
  for (const part of Array.isArray(value) ? value : [value]) {
    if (typeof part === "object" && part !== null && typeof part.em === "string") {
      const em = document.createElement("em");
      em.textContent = part.em;
      node.append(em);
    } else node.append(document.createTextNode(String(part ?? "")));
  }
}
function sheetOpen() {
  return !!active;
}
function openSheet(options) {
  return showSheet(options);
}
function showSheet({ title, body = "", actions = [], className = "", fallback, mount, restoreFocus = true, hasUnsavedChanges }, parent = null) {
  if (parent) {
    if (active !== parent || parent.busy) return Promise.resolve(null);
  } else if (active) {
    if (active.busy || active.parent) return Promise.resolve(null);
    active.finish(null);
  }
  if (!document.getElementById("dialog-sheet-style")) {
    const link = document.createElement("link");
    link.id = "dialog-sheet-style";
    link.rel = "stylesheet";
    link.href = new URL("../assets/dialog-sheet.css", import.meta.url).href;
    document.head.append(link);
  }
  const opener = document.activeElement, dialog = document.createElement("dialog"), heading = document.createElement("h2"), content2 = document.createElement("div"), footer = document.createElement("div"), error = document.createElement("p");
  dialog.className = "fs-sheet " + className;
  heading.id = "sheet-title-" + ++sequence;
  heading.tabIndex = -1;
  heading.autofocus = true;
  setSheetText(heading, title);
  dialog.setAttribute("aria-labelledby", heading.id);
  content2.className = "sheet-body";
  content2.innerHTML = body;
  error.className = "sheet-error import-error";
  error.setAttribute("role", "alert");
  error.tabIndex = -1;
  error.hidden = true;
  footer.className = "sheet-actions receipt-options-actions";
  dialog.append(heading, content2, error, footer);
  const scroller = document.querySelector("body.receipt-page #app") || (location.pathname.endsWith("receipt.html") ? document.getElementById("app") : null);
  const scroll = { x: scrollX, y: scrollY, inner: scroller?.scrollTop, overflow: document.documentElement.style.overflow, appOverflow: scroller?.style.overflow };
  if (scroller) scroller.style.overflow = "hidden";
  else document.documentElement.style.overflow = "hidden";
  document.body.append(dialog);
  return new Promise((resolve) => {
    let dispose = () => {
    }, finished = false;
    const interaction = createInteractionBusy(dialog);
    const guardExit = (event) => {
      if (active?.dialog === dialog && active.busy) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guardExit);
    const host = {
      dialog,
      body: content2,
      footer,
      heading,
      busy: false,
      parent,
      error(message) {
        setSheetText(error, message);
        error.hidden = false;
        error.focus({ preventScroll: true });
        error.scrollIntoView({ block: "nearest" });
      },
      clearError() {
        error.hidden = true;
      },
      setTitle(value) {
        setSheetText(heading, value);
      },
      setBusy(value) {
        if (finished) return;
        host.busy = !!value;
        interaction.setBusy(host.busy);
        if (host.busy) dialog.setAttribute("aria-busy", "true");
        else dialog.removeAttribute("aria-busy");
      },
      async dismiss(value = null) {
        if (active !== host || host.busy) return;
        if (hasUnsavedChanges?.() && !await confirmDiscard({ parent: host, fallback: heading })) return;
        host.finish(value);
      },
      finish(value) {
        if (finished || host.busy || active !== host) return;
        finished = true;
        dispose();
        interaction.dispose();
        window.removeEventListener("beforeunload", guardExit);
        window.visualViewport?.removeEventListener("resize", bounds);
        window.visualViewport?.removeEventListener("scroll", bounds);
        dialog.close();
        dialog.remove();
        active = parent;
        if (scroller) {
          scroller.style.overflow = scroll.appOverflow;
          scroller.scrollTop = scroll.inner;
        } else {
          document.documentElement.style.overflow = scroll.overflow;
          window.scrollTo(scroll.x, scroll.y);
        }
        if (typeof restoreFocus === "function" ? restoreFocus(value) : restoreFocus) {
          const target = opener?.isConnected && opener.getClientRects().length && !opener.disabled && opener.matches("button,a,input,textarea,select,[tabindex]") ? opener : (typeof fallback === "function" ? fallback() : fallback) ?? document.querySelector("#bill-selector,#submitBtn");
          target?.focus?.({ preventScroll: true });
        }
        resolve(value);
      }
    };
    active = host;
    function bounds() {
      const viewport = window.visualViewport, height = viewport?.height ?? innerHeight;
      dialog.style.setProperty("--sheet-height", height - 16 + "px");
      dialog.style.setProperty("--sheet-bottom", Math.max(0, innerHeight - height - (viewport?.offsetTop ?? 0)) + "px");
      dialog.classList.toggle("sheet-short", height <= 520);
    }
    bounds();
    window.visualViewport?.addEventListener("resize", bounds);
    window.visualViewport?.addEventListener("scroll", bounds);
    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.className = action.className || "";
      if (action.id) button.id = action.id;
      if (action.data) Object.assign(button.dataset, action.data);
      button.disabled = !!action.disabled;
      button.addEventListener("click", async () => {
        if (active !== host || host.busy) return;
        if (action.dismiss) {
          await host.dismiss(action.value);
          return;
        }
        if (!action.run) {
          host.finish(action.value ?? null);
          return;
        }
        host.clearError();
        host.setBusy(true);
        try {
          const result = await action.run(host);
          host.setBusy(false);
          if (result !== false) host.finish(result ?? action.value ?? true);
        } catch (e) {
          host.setBusy(false);
          host.error(e.message);
        }
      });
      footer.append(button);
    }
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      void host.dismiss();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) void host.dismiss();
      }
    });
    dialog.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.isComposing || event.target.matches("input[type=search]"))) {
        event.preventDefault();
        return;
      }
      if (event.key === "Tab") {
        const nodes = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]')].filter((n) => n.tabIndex >= 0 && n.getClientRects().length && !n.closest("[hidden]"));
        if (!nodes.length) {
          event.preventDefault();
          heading.focus();
          return;
        }
        const first = nodes[0], last = nodes.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === heading)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
    dialog.showModal();
    dispose = mount?.(host) || (() => {
    });
    if (document.activeElement !== heading) heading.focus({ preventScroll: true });
  });
}
async function confirmDiscard({ fallback, parent = null } = {}) {
  const result = await showSheet({
    title: "ออกโดยไม่บันทึกไหม?",
    body: "<p>สิ่งที่แก้ไว้จะไม่ถูกบันทึก</p>",
    fallback,
    actions: [{ label: "แก้ต่อ", value: false, className: "sheet-primary" }, { label: "ไม่บันทึก", value: true }]
  }, parent);
  return result === true;
}
function createRecoveryNotice({ getModel, fallback }) {
  const lifetime = new AbortController(), signal = lifetime.signal;
  const timers = /* @__PURE__ */ new Set();
  let frame = 0;
  const scheduleShow = () => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      void show();
    }, 0);
    timers.add(timer);
  };
  const button = document.createElement("button");
  button.type = "button";
  button.className = "recovery-status";
  button.hidden = true;
  button.setAttribute("aria-haspopup", "dialog");
  document.body.append(button);
  let key = "", shown = "", generation = 0, loading = false, host = null, observedBar = null;
  const observer = new ResizeObserver(place);
  function place() {
    const bar = [...document.querySelectorAll("#summary-export-bar,#add-menu-slot,.parse-wrap,.submit-wrap")].find((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width && rect.top < innerHeight && rect.bottom >= innerHeight - 2;
    });
    if (bar !== observedBar) {
      observer.disconnect();
      observedBar = bar;
      if (bar) observer.observe(bar);
    }
    button.style.bottom = bar ? Math.max(12, innerHeight - bar.getBoundingClientRect().top + 12) + "px" : "";
  }
  window.addEventListener("resize", place, { signal });
  async function show(force = false) {
    if (!key || loading || sheetOpen() || !force && shown === key) return;
    const token = generation, episode = key;
    loading = true;
    let model;
    try {
      model = await getModel();
    } catch {
      model = { title: "ไม่สามารถเปิดบิลได้", message: "ไม่สามารถเข้าถึงข้อมูลบิลได้ขณะนี้", actions: [] };
    } finally {
      loading = false;
    }
    if (token !== generation) {
      if (key) void show();
      return;
    }
    if (!key || sheetOpen() || !model) return;
    shown = episode;
    const choice = await openSheet({
      title: model.title,
      body: "<p></p>",
      className: "recovery-sheet",
      fallback,
      mount: (current) => {
        host = current;
        current.body.firstChild.textContent = model.message;
        return () => {
          host = null;
        };
      },
      actions: [...model.actions.map((action, index) => ({ label: action.label, id: action.id, value: action, className: index === 0 ? "sheet-primary" : "" })), { label: model.dismissLabel ?? "ปิด", value: null }]
    });
    if (choice && token === generation) {
      try {
        await choice.run();
      } catch {
        update(key, "ยังไม่ได้บันทึก");
      }
    }
  }
  function update(next, label = "ยังไม่ได้บันทึก") {
    next = next || "";
    if (next !== key) {
      generation++;
      key = next;
      host?.finish(null);
      if (!next) shown = "";
    }
    button.hidden = !key;
    button.textContent = label;
    if (key) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    }
    if (key) scheduleShow();
  }
  button.onclick = () => void show(true);
  document.addEventListener("close", () => {
    if (key) scheduleShow();
  }, { capture: true, signal });
  return { update, show: () => show(true), dispose() {
    generation++;
    key = "";
    shown = "";
    lifetime.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    host?.finish(null);
    button.remove();
  } };
}

// src/receipt-import-dialog.mjs
function mountOptionLayout(dialog) {
  function update() {
    const layouts = [...dialog.querySelectorAll(".segmented")].map((group) => ({ group, stacked: measureChoiceGroup(group) > group.getBoundingClientRect().width }));
    for (const { group, stacked } of layouts) group.classList.toggle("segmented-stacked", stacked);
  }
  return observeChoices(dialog, update);
}
async function openReceiptImport({ mode = "append", assignmentMode = "all", hasItems = true, hasPeople = true, onConfirm }) {
  if (!hasItems) mode = "append";
  if (!hasPeople) assignmentMode = "all";
  if (!hasItems && !hasPeople) {
    await onConfirm({ mode, assignmentMode });
    return true;
  }
  return openSheet({
    title: "วิธีเพิ่มเมนูลงในบิลเดิม",
    className: "receipt-options",
    body: `
    ${hasItems ? `<fieldset><legend>รายการอาหาร</legend><div class="segmented">
      <label class="segmented-option"><input type="radio" name="food-mode" value="append"><span class="segmented-face">เพิ่มต่อจากบิลเดิม</span></label>
      <label class="segmented-option"><input type="radio" name="food-mode" value="replace"><span class="segmented-face">แทนที่เมนูเดิม</span></label></div></fieldset>` : ""}
    ${hasPeople ? `<fieldset><legend>คนที่กิน</legend><div class="segmented">
      <label class="segmented-option"><input type="radio" name="people-mode" value="all"><span class="segmented-face">แบ่งให้ทุกคน</span></label>
      <label class="segmented-option"><input type="radio" name="people-mode" value="none"><span class="segmented-face">เลือกเองภายหลัง</span></label></div></fieldset>` : ""}`,
    actions: [{ label: "ยกเลิก", value: false, data: { cancel: "" } }, { label: "ตกลง", className: "sheet-primary", data: { confirm: "" }, run: async (host) => {
      await onConfirm({ mode: host.body.querySelector('[name="food-mode"]:checked')?.value ?? mode, assignmentMode: host.body.querySelector('[name="people-mode"]:checked')?.value ?? assignmentMode });
      return true;
    } }],
    fallback: () => document.getElementById("submitBtn"),
    mount: (host) => {
      host.heading.id = "receipt-options-title";
      host.dialog.setAttribute("aria-labelledby", host.heading.id);
      if (hasItems) host.body.querySelector(`[name="food-mode"][value="${mode}"]`).checked = true;
      if (hasPeople) host.body.querySelector(`[name="people-mode"][value="${assignmentMode}"]`).checked = true;
      return mountOptionLayout(host.dialog);
    }
  });
}

// src/ocr-reader.mjs
function createOcrReader(factory) {
  let active2 = null;
  async function cancel() {
    const old = active2;
    active2 = null;
    if (!old) return;
    old.reject(Error("ยกเลิกการอ่านแล้ว"));
    if (old.worker) {
      await old.recognizeInvoked;
      await old.worker.terminate();
    }
  }
  async function read(image, onProgress = () => {
  }) {
    const previous = cancel(), op = { worker: null, reject: null, recognizeInvoked: null };
    const stopped = new Promise((_, reject) => {
      op.reject = reject;
    });
    active2 = op;
    const work = (async () => {
      await previous;
      if (active2 !== op) throw Error("ยกเลิกการอ่านแล้ว");
      const current = await factory((event) => {
        if (active2 === op) onProgress(event);
      });
      if (active2 !== op) {
        await current.terminate();
        throw Error("ยกเลิกการอ่านแล้ว");
      }
      op.worker = current;
      let finishInvocation, recognition;
      op.recognizeInvoked = new Promise((resolve) => {
        finishInvocation = resolve;
      });
      try {
        recognition = current.recognize(image);
      } finally {
        finishInvocation();
      }
      const result = await recognition;
      if (active2 !== op) throw Error("ยกเลิกการอ่านแล้ว");
      return result.data.text;
    })();
    const timer = setTimeout(() => {
      if (active2 === op) cancel().catch(() => {
      });
    }, 12e4);
    try {
      return await Promise.race([work, stopped]);
    } finally {
      clearTimeout(timer);
      if (active2 === op) {
        active2 = null;
        if (op.worker) await op.worker.terminate();
      }
    }
  }
  return { read, cancel };
}
async function browserWorker(logger) {
  if (!globalThis.Tesseract) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = new URL("../vendor/tesseract/tesseract.js/dist/tesseract.min.js", import.meta.url).href;
      script.onload = resolve;
      script.onerror = () => {
        script.remove();
        reject(Error("ยังอ่านรูปไม่ได้ ลองอีกครั้งหรือวางข้อความแทน"));
      };
      document.head.append(script);
    });
  }
  return Tesseract.createWorker("tha+eng", 1, {
    workerPath: new URL("../vendor/tesseract/tesseract.js/dist/worker.min.js", import.meta.url).href,
    corePath: new URL("../vendor/tesseract/tesseract.js-core/tesseract-core-lstm.wasm.js", import.meta.url).href,
    langPath: new URL("../vendor/tesseract/languages/", import.meta.url).href,
    workerBlobURL: false,
    logger
  });
}
async function prepareImage(file, { signal } = {}) {
  signal?.throwIfAborted();
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw Error("ใช้รูป JPG, PNG หรือ WebP ได้ ถ้าเป็น HEIC ให้คัดลอกข้อความจากรูปมาวางแทน");
  if (file.size > 12 * 1024 * 1024) throw Error("รูปใหญ่เกิน 12 MB ลองลดขนาดแล้วเลือกใหม่");
  const image = new Image(), url = URL.createObjectURL(file);
  const imageError = "เปิดรูปนี้ไม่ได้ ลองใช้รูปอื่นหรือวางข้อความแทน";
  async function encode() {
    image.src = url;
    try {
      await image.decode();
    } catch (error) {
      if (error.message === "The source image cannot be decoded.") throw Error(imageError, { cause: error });
      throw error;
    }
    signal?.throwIfAborted();
    if (image.width * image.height > 24e6) throw Error("รูปใหญ่เกินไป ลองลดขนาดแล้วเลือกใหม่");
    const scale = Math.min(1, 2400 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    signal?.throwIfAborted();
    if (!blob) throw Error(imageError);
    const bytes = await blob.arrayBuffer();
    signal?.throwIfAborted();
    return new Uint8Array(bytes);
  }
  let onAbort;
  try {
    if (!signal) return await encode();
    const stopped = new Promise((_, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
    });
    return await Promise.race([stopped, encode()]);
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort);
    URL.revokeObjectURL(url);
  }
}

// src/bill-operations.mjs
var copy2 = (value) => structuredClone(value);
function isEmptyBillContent(bill) {
  if (bill.people.length || bill.items.length || bill.groups.length !== 1) return false;
  const current = bill.groups[0], defaults = emptyBill().groups[0];
  if (current.printedTotalCents != null) return false;
  return ["service", "tax", "discount"].every((key) => Object.keys(defaults[key]).every((field) => current[key][field] === defaults[key][field])) && ["placement", "serviceDist", "discountDist"].every((key) => current[key] === defaults[key]);
}
function checked(bill) {
  validateBill(bill);
  calculate(bill);
  return bill;
}
function clearPeople(bill) {
  const next = copy2(bill);
  next.people = [];
  next.items.forEach((item) => {
    item.assignments = [];
  });
  return checked(next);
}
function clearDishes(bill) {
  const next = copy2(bill);
  next.items = [];
  next.groups = emptyBill().groups;
  return checked(next);
}
function setPersonMenus(bill, personId, selectedItemIds) {
  validateBill(bill);
  if (!bill.people.some((p) => p.id === personId)) throw Error("ไม่พบรายชื่อคนนี้ในบิล");
  const selected = new Set(selectedItemIds);
  if (selected.size !== selectedItemIds.length || [...selected].some((id) => !bill.items.some((it) => it.id === id))) throw Error("ไม่พบเมนูที่เลือกในบิล");
  const next = copy2(bill), changedItemIds = [], removedLockedItemIds = [];
  next.items = next.items.map((item) => {
    const assignment = item.assignments.find((a) => a.personId === personId), wanted = selected.has(item.id);
    if (!!assignment === wanted) return item;
    changedItemIds.push(item.id);
    if (assignment?.locked) removedLockedItemIds.push(item.id);
    if (wanted) item.assignments.push({ personId, locked: false, amountCents: 0, lockMode: "percentage", lockPercentUnits: 0 });
    else item.assignments = item.assignments.filter((a) => a.personId !== personId);
    return recalculateItemAssignments(item).item;
  });
  return { bill: checked(next), changedItemIds, removedLockedItemIds };
}
function isProtectedDefault(record, library) {
  return !!record && record.name === "ร้านอาหาร 1" && isEmptyBillContent(record.bill) && library.records.length === 1 && !library.damaged.length && library.records[0].id === record.id;
}

// src/bill-repository.mjs
var DATABASE = "fairshare";
var DEVELOPMENT_BILL_KEYS = ["fairshare.v1", "fairshare.v1.backup", "fairshare.v1.pending", "fairshare.v1.damaged"];
function billName(value) {
  if (typeof value !== "string" || !value.trim()) throw Error("กรอกชื่อบิล");
  const name = value.trim();
  if (name.length > 100) throw Error("ชื่อบิลยาวได้ไม่เกิน 100 ตัวอักษร");
  return name;
}
var clone4 = (value) => structuredClone(value);
var missing = () => ({ status: "missing", message: "ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์" });
var uncertain = () => ({ status: "uncertain", message: "ยังยืนยันผลการบันทึกไม่ได้ ดาวน์โหลดสิ่งที่แก้ไว้ก่อนปิดหน้านี้" });
var errorMessage = (error) => ({
  QuotaExceededError: "พื้นที่บันทึกไม่พอ ดาวน์โหลดสิ่งที่แก้ไว้แล้วลองอีกครั้ง",
  SecurityError: "เปิดข้อมูลในเบราว์เซอร์ไม่ได้ เช็กการอนุญาตให้บันทึกข้อมูลแล้วลองอีกครั้ง",
  NotAllowedError: "เปิดข้อมูลในเบราว์เซอร์ไม่ได้ เช็กการอนุญาตให้บันทึกข้อมูลแล้วลองอีกครั้ง",
  AbortError: "การบันทึกถูกยกเลิก ลองอีกครั้ง",
  InvalidStateError: "ไม่สามารถบันทึกบิลได้ขณะนี้",
  VersionError: "ไม่สามารถเปิดข้อมูลบิลด้วยแอปรุ่นนี้",
  UnknownError: "เปิดข้อมูลไม่ได้ ลองอีกครั้งหรือดาวน์โหลดข้อมูลเดิมก่อน"
})[error?.name] || error?.message || "เปิดข้อมูลในเบราว์เซอร์ไม่ได้ ลองอีกครั้ง";
function checkRecord(record) {
  if (!record || typeof record.id !== "string" || !record.id || record.id.length > 100 || billName(record.name) !== record.name || !Number.isSafeInteger(record.createdAt) || !Number.isSafeInteger(record.updatedAt) || !Number.isSafeInteger(record.recordRevision) || record.recordRevision < 1 || typeof record.lastMutationId !== "string") throw Error("ข้อมูลบิลที่บันทึกไว้ไม่ครบ");
  if (!Number.isFinite(new Date(record.createdAt).getTime()) || !Number.isFinite(new Date(record.updatedAt).getTime())) throw Error("วันที่ของบิลไม่ถูกต้อง");
  admittedBill(record.bill);
  if (record.previous) {
    billName(record.previous.name);
    admittedBill(record.previous.bill);
  }
  return record;
}
function classify(values) {
  const records = [], damaged = [];
  for (const raw of values) {
    try {
      records.push(checkRecord(raw));
    } catch (error) {
      damaged.push({ id: raw.id, raw, message: error.message });
    }
  }
  records.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  return { records, damaged };
}
function automaticName(values, allowSeparate) {
  const used = /* @__PURE__ */ new Set();
  for (const { name } of values) {
    try {
      used.add(billName(name));
    } catch {
      if (!allowSeparate) return null;
    }
  }
  let number = 1;
  while (used.has("ร้านอาหาร " + number)) number++;
  return "ร้านอาหาร " + number;
}
function validateIdentity(id, mutationId) {
  if (typeof id !== "string" || !id || id.length > 100 || typeof mutationId !== "string" || !mutationId) throw Error("ข้อมูลการบันทึกไม่ครบ");
}
function sourceAttention(storage) {
  try {
    if (!storage) throw Error("เปิดข้อมูลเดิมไม่ได้");
    if (DEVELOPMENT_BILL_KEYS.some((key) => storage.getItem(key) !== null)) return "พบข้อมูลเดิมในเบราว์เซอร์ ตรวจสอบหรือดาวน์โหลดก่อนเริ่ม";
    return "";
  } catch (error) {
    return errorMessage(error);
  }
}
async function openBillRepository({ indexedDB = globalThis.indexedDB, developmentStorage, clock = Date.now } = {}) {
  if (!indexedDB) throw Error("เบราว์เซอร์นี้เปิดที่บันทึกบิลไม่ได้");
  let db, closed = false, connecting = null, channel, connectionError = null;
  function connect() {
    if (closed) return Promise.reject(Error("ไม่สามารถบันทึกบิลได้ขณะนี้"));
    if (connecting) return connecting;
    connecting = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      let rejected = false;
      const timer = setTimeout(() => {
        rejected = true;
        reject(Error("ไม่สามารถเปิดบิลได้ขณะนี้"));
      }, 4e3);
      request.onupgradeneeded = () => {
        const db2 = request.result;
        db2.createObjectStore("bills", { keyPath: "id" });
        db2.createObjectStore("meta", { keyPath: "key" });
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (rejected || closed) {
          request.result.close();
          reject(Error("ไม่สามารถบันทึกบิลได้ขณะนี้"));
        } else {
          db = request.result;
          connectionError = null;
          const connection = db;
          const disconnect = () => {
            connection.close();
            if (db === connection) db = null;
          };
          connection.onclose = () => {
            if (db === connection) db = null;
          };
          connection.onversionchange = () => {
            disconnect();
            if (globalThis.window) window.dispatchEvent(new Event("fairshare-storage-versionchange"));
          };
          resolve(db);
        }
      };
      request.onerror = () => {
        clearTimeout(timer);
        reject(request.error);
      };
      request.onblocked = () => {
        clearTimeout(timer);
        rejected = true;
        reject(Error("ไม่สามารถเปิดบิลได้ขณะนี้"));
      };
    }).catch((error) => {
      connectionError = error.name;
      throw Object.assign(Error(errorMessage(error)), { code: error.name });
    }).finally(() => {
      connecting = null;
    });
    return connecting;
  }
  await connect();
  try {
    if (globalThis.window && globalThis.BroadcastChannel) channel = new BroadcastChannel("fairshare-library");
  } catch {
  }
  function close() {
    closed = true;
    db?.close();
    db = null;
    channel?.close();
  }
  async function transaction(stores, mode, work) {
    let prepared;
    try {
      if (closed) throw Error("ไม่สามารถบันทึกบิลได้ขณะนี้");
      const connection = db ?? await connect();
      try {
        prepared = connection.transaction(stores, mode);
      } catch (error) {
        if (error.name !== "InvalidStateError") throw error;
        connection.close();
        if (db === connection) db = null;
        prepared = (await connect()).transaction(stores, mode);
      }
    } catch (error) {
      throw Object.assign(Error(errorMessage(error)), { known: true });
    }
    return new Promise((resolve, reject) => {
      const fail = (error, known) => reject(Object.assign(Error(errorMessage(error)), { known }));
      let tx, value, failure;
      function abort(error) {
        failure = error;
        try {
          tx.abort();
        } catch {
          fail(error, false);
        }
      }
      function receive(request, callback) {
        request.onsuccess = () => {
          try {
            callback(request.result);
          } catch (error) {
            abort(error);
          }
        };
      }
      try {
        tx = prepared;
        tx.oncomplete = () => resolve(value);
        tx.onabort = () => fail(failure || tx.error || Error("การบันทึกถูกยกเลิก ลองอีกครั้ง"), true);
        work(tx, (result) => {
          value = result;
        }, receive);
      } catch (error) {
        if (tx) abort(error);
        else fail(error, true);
      }
    });
  }
  const readRaw = (key) => transaction(["bills"], "readonly", (tx, set, receive) => receive(tx.objectStore("bills").get(key), (record) => set(record ?? null)));
  const readMeta = (key) => transaction(["meta"], "readonly", (tx, set, receive) => receive(tx.objectStore("meta").get(key), (entry) => set(entry?.value ?? null)));
  const announce = (record, kind, id = record.id) => {
    try {
      channel?.postMessage({ id, recordRevision: record?.recordRevision ?? null, kind });
    } catch {
    }
  };
  const fresh = (id, mutationId, name, bill) => {
    const now = clock();
    return { id, name, createdAt: now, updatedAt: now, recordRevision: 1, lastMutationId: mutationId, bill, previous: null };
  };
  const conflict = (record) => ({ status: "conflict", record, message: "บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดแล้วลองอีกครั้ง" });
  const collision = () => ({ status: "conflict", message: "รหัสบิลนี้มีอยู่แล้ว" });
  const attention = (message) => ({ status: "attention", message });
  async function reconcileOperation({ id, mutationId, replacementId }) {
    try {
      if (replacementId) {
        return await transaction(["bills"], "readonly", (tx, set, receive) => {
          const store = tx.objectStore("bills");
          receive(store.get(id), (target) => receive(store.get(replacementId), (replacement) => {
            if (!target && replacement?.lastMutationId === mutationId) {
              set({ status: "saved", deletedId: id, successor: checkRecord(replacement), createdDefault: true });
            } else set(uncertain());
          }));
        });
      }
      const record = await readRaw(id);
      if (record?.lastMutationId === mutationId) return { status: "saved", record: checkRecord(record), created: true };
    } catch {
    }
    return uncertain();
  }
  async function mutationFailure(error, args) {
    if (error.known !== false) return { status: "failed", message: errorMessage(error) };
    return reconcileOperation(args);
  }
  async function mutate(kind, args) {
    try {
      validateIdentity(args.id, args.mutationId);
      const content2 = args.change?.kind === "content", automatic = args.change?.kind === "rename-default";
      let prepared;
      if (kind === "create") prepared = { name: billName(args.name), bill: admittedBill(args.bill) };
      else if (content2) prepared = { bill: admittedBill(args.change.bill) };
      else if (args.change?.kind === "rename") prepared = { name: billName(args.change.name) };
      else if (automatic) prepared = {};
      else throw Error("ข้อมูลการเปลี่ยนแปลงไม่ถูกต้อง");
      const result = await transaction(["bills", "meta"], "readwrite", (tx, set, receive) => {
        const store = tx.objectStore("bills"), meta = tx.objectStore("meta");
        receive(store.get(args.id), (old) => {
          if (old?.lastMutationId === args.mutationId) {
            set({ status: "saved", record: checkRecord(old) });
            return;
          }
          if (kind === "create") {
            if (old) {
              set(collision());
              return;
            }
            const record = fresh(args.id, args.mutationId, prepared.name, prepared.bill);
            store.add(record);
            meta.put({ key: "initialized", value: true });
            set({ status: "saved", record });
            return;
          }
          if (!old) {
            set(missing());
            return;
          }
          checkRecord(old);
          if (old.recordRevision !== args.expectedRevision) {
            set(conflict(old));
            return;
          }
          function save() {
            if (content2 ? sameValue(old.bill, prepared.bill) : old.name === prepared.name) {
              set({ status: "unchanged", record: old });
              return;
            }
            const record = { ...old, ...prepared, recordRevision: old.recordRevision + 1, lastMutationId: args.mutationId, updatedAt: clock(), previous: content2 ? { name: old.name, bill: old.bill } : old.previous };
            if (!Number.isSafeInteger(record.recordRevision)) throw Error("จำนวนการแก้ไขเกินขอบเขต");
            store.put(record);
            set({ status: "saved", record });
          }
          if (automatic) receive(store.getAll(), (values) => {
            prepared.name = automaticName(values.filter((record) => record.id !== old.id), false);
            if (!prepared.name) {
              set(attention("มีบิลที่อ่านชื่อไม่ได้ ตรวจสอบข้อมูลเดิมก่อนตั้งชื่อ"));
              return;
            }
            save();
          });
          else save();
        });
      });
      if (result.status === "saved") announce(result.record, kind === "write" ? args.change.kind : kind, args.id);
      return result;
    } catch (error) {
      return mutationFailure(error, args);
    }
  }
  async function defaultBill(args, automatic) {
    try {
      validateIdentity(args.id, args.mutationId);
      const result = await transaction(["bills", "meta"], "readwrite", (tx, set, receive) => {
        const store = tx.objectStore("bills"), meta = tx.objectStore("meta");
        receive(meta.get("initialized"), (initialized) => receive(store.getAll(), (values) => receive(meta.get("lastSelected"), (last) => {
          const original = values.find((record2) => record2.id === args.id);
          if (original?.lastMutationId === args.mutationId) {
            set({ status: "saved", record: checkRecord(original), created: true });
            return;
          }
          if (automatic) {
            const { records, damaged } = classify(values);
            if (damaged.some((record3) => record3.id === last?.value) || !records.length && damaged.length) {
              set(attention("มีบิลที่เปิดไม่ได้ เลือกบิลหรือตรวจสอบข้อมูลเดิม"));
              return;
            }
            const record2 = records.find((record3) => record3.id === last?.value) ?? records[0];
            if (record2) {
              meta.put({ key: "lastSelected", value: record2.id });
              set({ status: "selected", record: record2, created: false });
              return;
            }
          }
          if (original) {
            set(collision());
            return;
          }
          const reason = !initialized?.value && sourceAttention(developmentStorage);
          const name = automaticName(values, args.allowSeparate);
          if (!args.allowSeparate && (reason || !name)) {
            set(attention(reason || "มีบิลที่อ่านชื่อไม่ได้ ตรวจสอบข้อมูลเดิมก่อนเริ่ม"));
            return;
          }
          const record = fresh(args.id, args.mutationId, name, emptyBill());
          store.add(record);
          meta.put({ key: "initialized", value: true });
          meta.put({ key: "lastSelected", value: record.id });
          set({ status: "saved", record, created: true });
        })));
      });
      if (result.created) announce(result.record, "create");
      return result;
    } catch (error) {
      return mutationFailure(error, args);
    }
  }
  async function removeAndSelect(args) {
    try {
      validateIdentity(args.id, args.mutationId);
      validateIdentity(args.replacementId, args.mutationId);
      if (args.id === args.replacementId) throw Error("รหัสบิลใหม่ต้องต่างจากบิลที่ลบ");
      const result = await transaction(["bills", "meta"], "readwrite", (tx, set, receive) => {
        const store = tx.objectStore("bills"), meta = tx.objectStore("meta");
        receive(store.get(args.id), (old) => {
          if (!old) {
            set(missing());
            return;
          }
          checkRecord(old);
          if (old.recordRevision !== args.expectedRevision) {
            set(conflict(old));
            return;
          }
          receive(store.getAll(), (all) => receive(meta.get("initialized"), (initialized) => {
            if (args.createReplacement && args.allowReuse && isProtectedDefault(old, classify(all)) && old.recordRevision === 1 && old.previous === null && sameValue(old.bill, emptyBill())) {
              set({ status: "reused", record: old });
              return;
            }
            const values = all.filter((record) => record.id !== args.id);
            const { records, damaged } = classify(values);
            if (args.createReplacement) {
              if (all.some((record) => record.id === args.replacementId)) {
                set(collision());
                return;
              }
              if (!automaticName(values, false)) {
                set(attention("มีบิลที่อ่านชื่อไม่ได้ ตรวจสอบข้อมูลเดิมก่อนเริ่ม"));
                return;
              }
            }
            store.delete(args.id);
            let successor = records[0] ?? null, createdDefault = false, reason = "";
            if (!successor || args.createReplacement) {
              reason = args.createReplacement ? "" : damaged.length ? "บิลที่เหลือเปิดไม่ได้ ตรวจสอบข้อมูลเดิม" : !initialized?.value && sourceAttention(developmentStorage);
              if (!reason) {
                successor = fresh(args.replacementId, args.mutationId, automaticName(values, false), emptyBill());
                store.add(successor);
                meta.put({ key: "initialized", value: true });
                createdDefault = true;
              }
            }
            meta.put({ key: "lastSelected", value: successor?.id ?? null });
            set({ status: "saved", deletedId: args.id, successor, createdDefault, attention: reason || void 0 });
          }));
        });
      });
      if (result.status === "saved") {
        announce(null, "remove", args.id);
        if (result.createdDefault) announce(result.successor, "create");
      }
      return result;
    } catch (error) {
      return mutationFailure(error, args);
    }
  }
  return {
    get connectionError() {
      return connectionError;
    },
    list: () => transaction(["bills"], "readonly", (tx, set, receive) => receive(tx.objectStore("bills").getAll(), (values) => set(classify(values)))),
    async read(key) {
      const raw = await readRaw(key);
      return raw ? clone4(checkRecord(raw)) : null;
    },
    readRaw,
    readMeta,
    create: (args) => mutate("create", args),
    write: (args) => mutate("write", args),
    ensureDefault: ({ id, mutationId }) => defaultBill({ id, mutationId }, true),
    createDefault: (args) => defaultBill(args, false),
    removeAndSelect,
    reconcileOperation,
    async writeLastSelected(value) {
      try {
        await transaction(["meta"], "readwrite", (tx, set) => {
          tx.objectStore("meta").put({ key: "lastSelected", value });
          set(true);
        });
        return true;
      } catch {
        return false;
      }
    },
    close
  };
}

// src/pointer-hover.mjs
function trackPointerHover(root, signal) {
  if (signal.aborted) return;
  let hovered = /* @__PURE__ */ new Set();
  const options = { capture: true, passive: true, signal };
  function clear() {
    for (const node of hovered) node.classList.remove("pointer-hover");
    hovered.clear();
  }
  root.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" && !(event.pointerType === "pen" && event.buttons === 0)) {
      clear();
      return;
    }
    const next = new Set(event.composedPath().filter((node) => node.nodeType === 1));
    for (const node of hovered) if (!next.has(node)) node.classList.remove("pointer-hover");
    for (const node of next) if (!hovered.has(node)) node.classList.add("pointer-hover");
    hovered = next;
  }, options);
  root.defaultView.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse") clear();
  }, options);
  root.addEventListener("pointercancel", clear, options);
  root.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) clear();
  }, options);
  root.defaultView.addEventListener("keydown", clear, options);
  root.addEventListener("visibilitychange", () => {
    if (root.hidden) clear();
  }, options);
  root.defaultView.addEventListener("pagehide", clear, options);
  signal.addEventListener("abort", clear, { once: true });
}

// src/parser-ui.mjs
var receiptLifetime = new AbortController();
trackPointerHover(document, receiptLifetime.signal);
var receiptInteraction = createInteractionBusy(document.getElementById("app"), { signal: receiptLifetime.signal });
function onReceipt(type, callback) {
  addEventListener(type, callback, { signal: receiptLifetime.signal });
}
var warnedDraft = null;
var lastDraft = null, receiptCommitted = false, draftBlocked = false, draftNotice = "";
var editors = createEditorActions();
var tabStorage;
try {
  tabStorage = sessionStorage;
} catch {
}
var billId = new URL(location.href).searchParams.get("bill");
var draftKey = receiptDraftKey(billId);
var repository, billSession, targetError = "", draftStorageFailed = false, rawDraftEvidence = null, targetMissing = false, leavingReceipt = false;
var draftReadSucceeded = false, rawCheckpointPending = false;
try {
  if (billId && tabStorage) {
    rawDraftEvidence = tabStorage.getItem(draftKey);
    draftReadSucceeded = true;
  }
} catch {
  draftStorageFailed = true;
}
try {
  repository = await openBillRepository();
  if (!billId) throw Error("ไม่พบบิลนี้ เปิดบิลที่ต้องการก่อนอ่านใบเสร็จ");
  billSession = createBillSession({ repository, billId, sessionStorage: tabStorage });
  const loaded = await billSession.load();
  if (loaded.status !== "loaded") {
    targetMissing = loaded.status === "missing";
    throw Error(loaded.message);
  }
} catch (error) {
  targetError = error.message;
}
var baseRevision = billSession?.record?.recordRevision ?? null, layoutCleanup = () => {
}, receiptHistory = null;
function returnUrl() {
  const url = new URL("../index.html", import.meta.url);
  if (billId) url.searchParams.set("bill", billId);
  if (targetMissing || !billId) {
    url.searchParams.delete("bill");
    url.searchParams.set("select", "1");
  }
  return url.href;
}
function reviewData() {
  return { schema: 3, billId, baseRevision, raw: state.raw, ...reviewModel.getSnapshot(), page: state.page, draft: lastDraft };
}
function ocrSetProgress(label, pct, note) {
  const sub = document.getElementById("ocr-prog-sub");
  const fill = document.getElementById("ocr-prog-fill");
  const noteEl = document.getElementById("ocr-prog-note");
  if (sub) sub.textContent = label;
  if (fill) fill.style.width = Math.min(100, Math.max(0, pct)) + "%";
  if (noteEl) {
    if (note != null) {
      noteEl.textContent = note;
      noteEl.style.display = "";
    } else noteEl.style.display = "none";
  }
}
var visionState = { statusMsg: "", statusKind: "" };
var localReader = createOcrReader(browserWorker);
var overlay = document.getElementById("ocr-prog-ov");
var ocrPresentation = null;
var ocrController = createReceiptOcrController({
  reader: localReader,
  prepareImage,
  getRaw: () => state.raw,
  parseText: parseCurrentText,
  present: {
    open(token) {
      ocrPresentation = { token, previous: document.activeElement, succeeded: false, timer: null, resume: null };
      overlay.classList.add("vis", "preparing");
      overlay.setAttribute("aria-hidden", "false");
      document.getElementById("app").inert = true;
      document.getElementById("ocr-title").focus({ preventScroll: true });
    },
    progress(token, { label, percent, note, preparing }) {
      if (ocrPresentation?.token !== token) return;
      overlay.classList.toggle("preparing", preparing);
      ocrSetProgress(label, percent, note);
    },
    async success(token) {
      const presentation = ocrPresentation;
      if (presentation?.token !== token) return;
      presentation.succeeded = true;
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        await new Promise((resolve) => {
          presentation.resume = resolve;
          presentation.timer = setTimeout(resolve, 120);
        });
      }
    },
    error(token) {
      if (ocrPresentation?.token !== token) return;
      visionState.statusMsg = "อ่านรูปนี้ไม่ได้ ลองใช้รูปที่ชัดขึ้น หรือคัดลอกข้อความจากรูปมาวางแทน";
      visionState.statusKind = "error";
      renderVisionZone();
      ocrPresentation.succeeded = false;
      ocrPresentation.previous = document.getElementById("visionDropArea");
    },
    close(token) {
      const presentation = ocrPresentation;
      if (presentation?.token !== token) return;
      ocrPresentation = null;
      clearTimeout(presentation.timer);
      presentation.resume?.();
      overlay.classList.remove("vis");
      overlay.setAttribute("aria-hidden", "true");
      document.getElementById("app").inert = false;
      document.getElementById("ocr-prog-fill").style.width = "0%";
      const previous = presentation.succeeded && state.page === "results" ? document.querySelector(".top-title") : presentation.previous;
      if (previous?.isConnected) {
        if (previous.matches(".top-title")) previous.tabIndex = -1;
        previous.focus();
      }
    }
  }
});
function cancelRead() {
  ocrController.cancel();
}
function setVisionImage(file) {
  return ocrController.read(file);
}
document.getElementById("ocr-cancel").addEventListener("click", cancelRead, { signal: receiptLifetime.signal });
overlay.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    cancelRead();
  } else if (event.key === "Tab") {
    event.preventDefault();
    document.getElementById("ocr-cancel").focus();
  }
}, { signal: receiptLifetime.signal });
onReceipt("pagehide", cancelRead);
function renderVisionZone() {
  renderReceiptVision(visionState, { readFile: setVisionImage });
}
var uid = newId;
var parseGeneration = 0, textGeneration = 0;
async function parseCurrentText(raw = state.raw, isCurrent = () => true) {
  const token = ++parseGeneration, inputGeneration = textGeneration;
  const current = () => token === parseGeneration && inputGeneration === textGeneration && isCurrent();
  let result, loaded;
  const resume = !draftBlocked && lastDraft && raw === lastDraft.raw;
  if (raw === state.raw) pushTextHistory(raw);
  try {
    result = resume ? null : createReceiptReview(raw);
    loaded = billSession ? await billSession.load({ canAdopt: current }) : null;
  } catch (error) {
    if (!current()) return;
    state.raw = raw;
    pushTextHistory(raw);
    state.page = "input";
    render();
    throw error;
  }
  if (!current()) return;
  clearTimeout(textDebounceTimer);
  state.raw = raw;
  pushTextHistory(raw);
  if (loaded?.status === "loaded") {
    baseRevision = billSession.record.recordRevision;
    targetMissing = false;
    targetError = "";
  } else if (loaded) {
    targetMissing = loaded.status === "missing";
    targetError = loaded.message;
  }
  if (resume) {
    state.page = "results";
    render();
    void showReceiptWarnings();
    return;
  }
  lastDraft = result.draft;
  receiptCommitted = false;
  const subtotal = reviewSubtotal(result);
  reviewModel.replace({
    ...reviewModel.getSnapshot(),
    rows: result.rows,
    summarySource: result.summarySource,
    importMode: "append",
    importAssignments: "all",
    summaryEdits: initializeSummaryEdits(subtotal, result.summarySource),
    discountCanonical: result.summarySource?.discount?.mode === "amount" ? "amount" : "rate"
  });
  draftBlocked = false;
  draftNotice = "";
  state.page = "results";
  state.editing = null;
  render();
  void showReceiptWarnings();
}
var reviewModel = createReceiptReviewModel();
var textHistory = createReceiptTextHistory("");
var state = { page: "input", raw: "", editing: null };
for (const key of ["rows", "summarySource", "summaryEdits", "discountCanonical", "colOrder", "importMode", "importAssignments"]) {
  Object.defineProperty(state, key, { get: () => reviewModel.getSnapshot()[key] });
}
var textDebounceTimer = null;
function pushTextHistory(text2) {
  textHistory.record(text2);
}
function checkpointTextAction(raw) {
  if (raw !== state.raw) {
    state.raw = raw;
    rawCheckpointPending = true;
  }
  syncTextDOM();
  flushRawCheckpoint();
}
function textUndo() {
  textGeneration++;
  clearTimeout(textDebounceTimer);
  checkpointTextAction(textHistory.undo(state.raw));
}
function textRedo() {
  textGeneration++;
  clearTimeout(textDebounceTimer);
  checkpointTextAction(textHistory.redo(state.raw));
}
function clearTextArea() {
  textGeneration++;
  clearTimeout(textDebounceTimer);
  if (state.raw === "") return;
  textHistory.record(state.raw);
  textHistory.record("");
  checkpointTextAction("");
}
function syncTextDOM() {
  const ta = document.getElementById("receiptText");
  if (ta) ta.value = state.raw;
  const clearBtn = document.getElementById("clearTaBtn");
  if (clearBtn) clearBtn.disabled = !state.raw;
  updateTextUndoRedoBtns();
}
function updateTextUndoRedoBtns() {
  receiptHistory?.update({ canUndo: textHistory.canUndo(state.raw), canRedo: textHistory.canRedo });
}
function undo() {
  if (!reviewModel.canUndo) return;
  reviewModel.undo();
  state.editing = null;
  render();
}
function redo() {
  if (!reviewModel.canRedo) return;
  reviewModel.redo();
  state.editing = null;
  render();
}
function updateRow(id, patch) {
  reviewModel.updateRow(id, patch);
  render();
}
function addRow() {
  const row = { id: uid(), rawLine: "", itemName: "เมนูใหม่", qty: 1, priceSource: "line_total", priceValue: 0, needsReview: false, isDiscount: false, flags: [] };
  reviewModel.addRow(row);
  state.editing = { rowId: row.id, field: "itemName" };
  render();
  const input = document.querySelector(`[data-edit-input="${CSS.escape(row.id)}:itemName"]`);
  if (input) {
    input.focus({ preventScroll: true });
    input.select();
    requestAnimationFrame(() => {
      if (input.isConnected) input.scrollIntoView({ block: "center", behavior: "auto" });
    });
  }
}
function deleteRow(id) {
  reviewModel.deleteRow(id);
  render();
}
function handleSwap() {
  reviewModel.swapPrices(null);
  render();
}
function swapRow(id) {
  reviewModel.swapPrices(id);
  render();
}
function startEdit(rowId, field) {
  state.editing = { rowId, field };
  render();
  const el = document.querySelector(`[data-edit-input="${CSS.escape(rowId)}:${field}"]`);
  if (!el) return;
  el.focus();
  if (field !== "itemName" && typeof el.select === "function") el.select();
}
function commitEdit(rowId, field, value) {
  const row = state.rows.find((r) => r.id === rowId);
  if (!row) {
    state.editing = null;
    render();
    return;
  }
  state.editing = null;
  if (field === "itemName") {
    const trimmed = String(value).trim();
    updateRow(rowId, { itemName: trimmed || "เมนูใหม่", needsReview: false });
    return;
  }
  if (field === "qty") {
    const n = Math.min(99, Math.max(1, Math.round(parseFloat(String(value).replace(/,/g, "")) || 1)));
    updateRow(rowId, { qty: n, qtyWasNull: false, needsReview: false });
    return;
  }
  if (field === "unit_price" || field === "line_total") {
    const n = parseFloat(String(value).replace(/,/g, "")) || 0;
    const safeN = Math.max(0, n);
    updateRow(rowId, { priceValue: safeN, priceSource: field, needsReview: false });
    return;
  }
}
function persistDraft() {
  if (draftBlocked || !billId || targetError) return false;
  if (!Number.isSafeInteger(baseRevision)) {
    draftStorageFailed = true;
    return false;
  }
  try {
    if (!tabStorage) throw Error();
    const raw = JSON.stringify(reviewData());
    tabStorage.setItem(draftKey, raw);
    if (tabStorage.getItem(draftKey) !== raw) throw Error();
    draftStorageFailed = false;
    rawCheckpointPending = false;
    return true;
  } catch {
    draftStorageFailed = true;
    return false;
  }
}
function flushRawCheckpoint() {
  if (!rawCheckpointPending) return true;
  let saved = false;
  if (draftReadSucceeded) saved = persistDraft();
  else draftStorageFailed = true;
  showStorageNotice();
  return saved;
}
function downloadReceiptData(raw, filename, type) {
  const url = URL.createObjectURL(new Blob([raw], { type })), a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
function downloadReceiptText() {
  downloadReceiptData(state.raw, "หารจ่ายแฟร์ๆ-receipt-text.txt", "text/plain;charset=utf-8");
}
var restoredText = "";
function downloadReceiptWork() {
  let raw = JSON.stringify(reviewData());
  if (draftBlocked && rawDraftEvidence !== null) {
    raw = state.raw === restoredText ? rawDraftEvidence : JSON.stringify({ source: rawDraftEvidence, receiptText: state.raw });
  }
  downloadReceiptData(raw, "หารจ่ายแฟร์ๆ-receipt-draft-evidence.json", "application/json");
}
function hasReceiptWork() {
  return rawCheckpointPending || !!state.raw || rawDraftEvidence !== null;
}
async function returnToBill(destination = returnUrl()) {
  if (!persistDraft() && hasReceiptWork()) {
    const result = await openSheet({ title: "ไม่สามารถบันทึกฉบับร่างได้ขณะนี้", body: "<p>ดาวน์โหลดฉบับร่างก่อนกลับไปยังบิล หรืออยู่หน้านี้เพื่อแก้ต่อ</p>", actions: [
      { label: "แก้ต่อ", value: false },
      { label: "ดาวน์โหลดฉบับร่างและกลับ", run: async () => {
        downloadReceiptWork();
        return true;
      } }
    ] });
    if (!result) return;
  }
  leavingReceipt = true;
  location.href = destination;
}
var recovery = createRecoveryNotice({ getModel: async () => editors.composing ? null : {
  title: targetMissing ? "ไม่สามารถเปิดบิลได้" : "ไม่สามารถบันทึกบิลได้ขณะนี้",
  message: targetMissing ? "ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์" + (state.raw ? " ข้อความใบเสร็จยังอยู่ในหน้านี้" : "") : hasReceiptWork() ? "ดาวน์โหลดข้อความใบเสร็จก่อนปิดหน้านี้" : "ไม่สามารถเข้าถึงข้อมูลบิลได้ขณะนี้",
  dismissLabel: "แก้ต่อ",
  actions: [
    ...!targetMissing && repository?.connectionError !== "VersionError" ? [{ label: "ลองบันทึกอีกครั้ง", run: async () => {
      await checkTarget();
      persistDraft();
      showStorageNotice();
    } }] : [],
    { label: "ดาวน์โหลดข้อความ", run: downloadReceiptText }
  ]
}, fallback: () => document.getElementById("parseBtn") ?? document.getElementById("submitBtn") });
function showStorageNotice() {
  recovery.update(targetError || draftStorageFailed || draftNotice ? `${billId}:${targetError}:${draftNotice}:${draftStorageFailed}` : "", "ยังไม่ได้บันทึก");
}
function startNewReceipt() {
  textGeneration++;
  parseGeneration++;
  receiptCommitted = false;
  lastDraft = null;
  rawDraftEvidence = null;
  reviewModel.replace({ ...reviewModel.getSnapshot(), rows: [], summarySource: null, summaryEdits: { service_charge_rate: null, vat_rate: null, discount_rate: null, discount_amount: null }, discountCanonical: "rate" });
  textHistory.reset("");
  Object.assign(state, { raw: "", page: "input", editing: null });
  visionState.statusMsg = "";
  visionState.statusKind = "";
  render();
}
async function offerImportedReceipt() {
  if (!receiptCommitted || targetError || draftBlocked) return;
  const result = await openSheet({
    title: "เพิ่มใบเสร็จนี้ลงบิลแล้ว",
    className: "receipt-revisit",
    body: "<p>อัพโหลดใบเสร็จใหม่ หรือดูรายละเอียดใบเสร็จเดิม</p>",
    actions: [{ id: "new-receipt", label: "อัพโหลดใบเสร็จใหม่", className: "sheet-primary", value: "new" }, { label: "ดูรายละเอียดเดิม", value: "inspect" }],
    fallback: () => document.getElementById("submitBtn") ?? document.getElementById("parseBtn")
  });
  if (result === "new") startNewReceipt();
  else if (lastDraft) {
    state.page = "results";
    render();
    document.getElementById("submitBtn")?.focus({ preventScroll: true });
  }
}
async function showReceiptWarnings() {
  if (state.page !== "results" || !lastDraft || warnedDraft === lastDraft.id || targetError || draftBlocked || draftStorageFailed || draftNotice || sheetOpen()) return;
  const notes = [...lastDraft.notices ?? [], ...state.rows.flatMap((row) => (row.flags ?? []).filter((flag) => flag.type === "calc_mismatch").map((flag) => row.itemName + ": " + flag.msg))];
  warnedDraft = lastDraft.id;
  if (!notes.length) return;
  await openSheet({
    title: "หมายเหตุ",
    className: "receipt-warnings",
    actions: [{ label: "ตกลง", className: "sheet-primary", value: true }],
    fallback: () => document.getElementById("submitBtn"),
    mount: (host) => {
      for (const note of notes) {
        const p = document.createElement("p");
        p.textContent = note;
        host.body.append(p);
      }
    }
  });
}
function render() {
  clearTimeout(textDebounceTimer);
  textDebounceTimer = null;
  layoutCleanup();
  receiptHistory = null;
  persistDraft();
  const model = {
    ...reviewModel.getSnapshot(),
    raw: state.raw,
    page: state.page,
    editing: structuredClone(state.editing),
    draftNotice,
    vision: { ...visionState },
    history: state.page === "input" ? { canUndo: textHistory.canUndo(state.raw), canRedo: textHistory.canRedo } : { canUndo: reviewModel.canUndo, canRedo: reviewModel.canRedo }
  };
  layoutCleanup = (state.page === "input" ? renderInput : renderReview)(model, receiptActions);
  showStorageNotice();
}
function showImportError(message) {
  showReceiptError(message);
}
var importController = createReceiptImportController({
  getSession: () => billSession,
  getReview: reviewData,
  getStatus: () => ({ composing: editors.composing, targetError, draftBlocked }),
  setBaseRevision: (value) => {
    baseRevision = value;
  },
  setOptions: (options) => reviewModel.setImportOptions(options),
  persistDraft,
  confirmRepeat: () => openSheet({
    title: "เพิ่มใบเสร็จเดิมอีกครั้งหรือไม่?",
    body: "<p>เคยเพิ่มใบเสร็จนี้ลงบิลไปแล้ว หากเพิ่มต่อจะซ้ำเมนูเดิม</p>",
    actions: [{ label: "ยกเลิก", value: false }, { label: "เพิ่มอีกครั้ง", className: "sheet-primary", value: true }],
    fallback: () => document.getElementById("submitBtn")
  }),
  chooseImport: openReceiptImport,
  onCommitted: (draft) => {
    lastDraft = draft;
    receiptCommitted = true;
  },
  onError: (error, context = {}) => {
    if (context.targetStatus) {
      targetMissing = context.targetStatus === "missing";
      targetError = error.message;
    }
    if (context.inline !== false) showImportError(error.message);
  },
  returnToBill
});
async function submitReceipt() {
  if (importController.busy) return;
  const pending = importController.submit();
  receiptInteraction.setBusy(importController.busy);
  try {
    await pending;
  } finally {
    receiptInteraction.setBusy(false);
    showStorageNotice();
  }
}
var receiptActions = {
  bindAction: (element, action) => editors.bind(element, action),
  historyMounted: (control) => {
    receiptHistory = control;
  },
  undo: () => state.page === "input" ? textUndo() : undo(),
  redo: () => state.page === "input" ? textRedo() : redo(),
  readFile: setVisionImage,
  clearText: clearTextArea,
  returnToBill,
  submit: submitReceipt,
  rawChanged(raw) {
    textGeneration++;
    if (raw !== state.raw) {
      state.raw = raw;
      rawCheckpointPending = true;
    }
    clearTimeout(textDebounceTimer);
    updateTextUndoRedoBtns();
    textDebounceTimer = setTimeout(() => {
      textDebounceTimer = null;
      pushTextHistory(state.raw);
      updateTextUndoRedoBtns();
      flushRawCheckpoint();
    }, 500);
  },
  async parse() {
    try {
      await parseCurrentText();
    } catch (error) {
      console.error("Parse failed:", error);
      visionState.statusMsg = "แยกเมนูยังไม่ได้ ลองเช็กข้อความแล้วกดอีกครั้ง";
      visionState.statusKind = "error";
      renderVisionZone();
    }
  },
  backToInput() {
    parseGeneration++;
    state.page = "input";
    state.editing = null;
    render();
  },
  cancelEdit() {
    state.editing = null;
    render();
  },
  startEdit,
  commitRow: commitEdit,
  addRow,
  deleteRow,
  swapAll: handleSwap,
  swapRow,
  editSummary(kind, field, value, { render: shouldRender = true, ...options } = {}) {
    reviewModel.editSummary(kind, field, value, options);
    if (shouldRender) render();
  }
};
var savedCache = null;
try {
  const saved = savedCache = rawDraftEvidence === null ? null : JSON.parse(rawDraftEvidence);
  if (saved) {
    const { review, notices } = normalizeReviewDraft(saved);
    if (review.billId !== billId) throw Error("ฉบับร่างนี้เป็นของบิลอื่น");
    reviewModel.replace(review);
    state.raw = review.raw;
    state.page = review.page;
    lastDraft = review.draft;
    draftNotice = notices.join(" ");
    baseRevision = review.baseRevision;
    textHistory.reset(state.raw);
    if (lastDraft && billSession?.current?.imports.includes(lastDraft.id)) receiptCommitted = true;
  } else if (rawDraftEvidence !== null) throw Error("เปิดฉบับร่างเดิมไม่ได้");
} catch (error) {
  if (typeof savedCache?.raw === "string") state.raw = savedCache.raw;
  restoredText = state.raw;
  draftBlocked = true;
  draftNotice = error.message;
  visionState.statusMsg = error.message;
  visionState.statusKind = "error";
}
render();
void offerImportedReceipt().then(showReceiptWarnings);
onReceipt("pagehide", persistDraft);
onReceipt("beforeunload", (event) => {
  if (leavingReceipt) return;
  flushRawCheckpoint();
  if (importController.busy || rawCheckpointPending || draftStorageFailed || targetError && hasReceiptWork() || draftBlocked && hasReceiptWork()) {
    event.preventDefault();
    event.returnValue = "";
  }
});
onReceipt("compositionend", () => {
  if (!editors.composing) showStorageNotice();
});
async function checkTarget() {
  if (importController.busy) return;
  if (!repository) {
    try {
      repository = await openBillRepository();
      if (billId) billSession = createBillSession({ repository, billId, sessionStorage: tabStorage });
    } catch (error) {
      targetError = error.message;
      showStorageNotice();
      return;
    }
  }
  if (!billSession) return;
  try {
    const latest = await repository.read(billId);
    if (!latest) {
      targetMissing = true;
      targetError = "ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์";
      showImportError(targetError);
      showStorageNotice();
    } else {
      targetMissing = false;
      targetError = "";
      showStorageNotice();
      if (latest.recordRevision !== baseRevision) showImportError("บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนเพิ่มเมนู");
    }
  } catch (error) {
    targetError = error.message;
    showImportError(targetError);
    showStorageNotice();
  }
}
onReceipt("pageshow", checkTarget);
onReceipt("fairshare-storage-versionchange", () => {
  void checkTarget();
});
onReceipt("focus", checkTarget);
var receiptChannel;
try {
  receiptChannel = new BroadcastChannel("fairshare-library");
  receiptChannel.onmessage = (event) => {
    if (event.data?.id === billId) void checkTarget();
  };
} catch {
}
onReceipt("pagehide", (event) => {
  parseGeneration++;
  clearTimeout(textDebounceTimer);
  pushTextHistory(state.raw);
  if (event.persisted !== false) return;
  receiptLifetime.abort();
  ocrController.dispose();
  layoutCleanup();
  recovery.dispose();
  editors.dispose();
  receiptChannel?.close();
  repository?.close();
});
