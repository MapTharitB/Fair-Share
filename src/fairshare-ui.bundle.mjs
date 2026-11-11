// src/text-measure.mjs
function createTextMeasurer() {
  let context, ready;
  const widths = /* @__PURE__ */ new Map();
  return {
    measure(text2, font) {
      const fontSet = document.fonts;
      if (fontSet?.ready !== ready) {
        ready = fontSet?.ready;
        widths.clear();
      }
      const key = JSON.stringify([font, text2]);
      if (widths.has(key)) return widths.get(key);
      context ??= document.createElement("canvas").getContext("2d");
      context.font = font;
      const width = context.measureText(text2).width;
      if (fontSet?.status !== "loading") widths.set(key, width);
      return width;
    },
    clear() {
      widths.clear();
    }
  };
}

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

// src/numeric-input.mjs
function parse(s, allowExpr = false) {
  const clean = String(s).replace(/\\/g, "/").replace(/,/g, "").trim();
  if (!clean) return null;
  if (allowExpr && /[+\-*/]/.test(clean)) {
    if (!/^[\d.\s+\-*/]+$/.test(clean)) return null;
    try {
      const r = Function('"use strict";return(' + clean + ")")();
      return typeof r === "number" && isFinite(r) ? r : null;
    } catch (e) {
      return null;
    }
  }
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}
function parsePct(s) {
  const clean = String(s).replace(/\\/g, "/").replace(/,/g, "").trim();
  if (!clean) return null;
  if (!/^[\d./\s+\-*]+$/.test(clean)) return null;
  if (clean.includes("/") && !/[+\-*]/.test(clean)) {
    try {
      const r = Function('"use strict";return(' + clean + ")")();
      return typeof r === "number" && isFinite(r) ? r * 100 : null;
    } catch (e) {
      return null;
    }
  }
  try {
    const r = Function('"use strict";return(' + clean + ")")();
    if (typeof r === "number" && isFinite(r)) return r;
  } catch (e) {
  }
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

// src/numeric-bindings.mjs
var numericInputs = /* @__PURE__ */ (() => {
  const stripRaw = (text2) => String(text2).replace(/,/g, "").replace(/[^\d.]/g, "");
  const normDots = (text2) => {
    const decimalIndex = text2.indexOf(".");
    if (decimalIndex >= 0) text2 = text2.slice(0, decimalIndex + 1) + text2.slice(decimalIndex + 1).replace(/\./g, "");
    if (text2.startsWith(".")) text2 = "0" + text2;
    if (text2 === ".") text2 = "0.";
    return text2;
  };
  const normLeading = (text2) => {
    const decimalIndex = text2.indexOf(".");
    if (decimalIndex >= 0) {
      let integerPart = text2.slice(0, decimalIndex) || "0";
      integerPart = integerPart.replace(/^0+(\d)/, "$1") || "0";
      return integerPart + text2.slice(decimalIndex);
    }
    return text2.replace(/^0+(\d)/, "$1") || text2;
  };
  const truncDec = (text2, maxFractionDigits) => {
    if (maxFractionDigits < 0) return text2;
    const decimalIndex = text2.indexOf(".");
    if (decimalIndex >= 0) return text2.slice(0, decimalIndex + 1 + maxFractionDigits);
    return text2;
  };
  const limitInt = (text2, maxIntegerDigits) => {
    const decimalIndex = text2.indexOf(".");
    const integerPart = decimalIndex >= 0 ? text2.slice(0, decimalIndex) : text2;
    const fractionPart = decimalIndex >= 0 ? text2.slice(decimalIndex) : "";
    return integerPart.slice(0, maxIntegerDigits) + fractionPart;
  };
  const addCommas = (text2) => {
    if (!text2) return text2;
    const decimalIndex = text2.indexOf(".");
    let integerPart = decimalIndex >= 0 ? text2.slice(0, decimalIndex) : text2;
    const fractionPart = decimalIndex >= 0 ? text2.slice(decimalIndex) : "";
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return integerPart + fractionPart;
  };
  function restoreCursor(input, oldValue, newValue, oldPosition) {
    const chars = oldValue.slice(0, oldPosition).replace(/,/g, "").length;
    let position = newValue.length, count = 0;
    for (let i = 0; i < newValue.length; i++) {
      if (count >= chars) {
        position = i;
        break;
      }
      if (newValue[i] !== ",") count++;
    }
    try {
      input.setSelectionRange(position, position);
    } catch (_) {
    }
  }
  function processPlain(text2, maxInt, maxFrac) {
    text2 = stripRaw(text2);
    text2 = normDots(text2);
    text2 = normLeading(text2);
    if (maxInt > 0) text2 = limitInt(text2, maxInt);
    if (maxFrac >= 0) text2 = truncDec(text2, maxFrac);
    return text2;
  }
  function addTriggers(input, action) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        action();
        input.blur();
      }
    });
    input.addEventListener("beforeinput", (e) => {
      if (e.inputType === "insertLineBreak" && !e.isComposing) {
        e.preventDefault();
        action();
        input.blur();
      }
    });
  }
  function bindAdjustmentEvents(input, { onInput, onCommit, onFocus }) {
    input.addEventListener("input", onInput);
    input.addEventListener("blur", onCommit);
    input.addEventListener("focus", onFocus);
    input.addEventListener("paste", (event) => {
      event.preventDefault();
      input.value = (event.clipboardData || window.clipboardData).getData("text");
      onInput();
    });
    addTriggers(input, onCommit);
  }
  function bindPercAdj(input, onCommit) {
    function doI() {
      const text2 = processPlain(input.value, 3, 1);
      if (input.value !== text2) input.value = text2;
    }
    let atFocus = input.value;
    function doC() {
      if (input.value === atFocus) return;
      const text2 = processPlain(input.value, 3, 1);
      let value = parse(text2);
      if (value === null || !isFinite(value) || value < 0) value = 0;
      if (value > 100) value = 100;
      input.value = value === 0 ? "" : String(value).replace(/\.$/, "");
      atFocus = input.value;
      onCommit(value);
    }
    bindAdjustmentEvents(input, {
      onInput: doI,
      onCommit: doC,
      onFocus() {
        atFocus = input.value;
        input.select();
      }
    });
  }
  function bindMoneyAdj(input, onCommit, {
    trimZeros = false
  } = {}) {
    let atFocus = input.value;
    function doI() {
      input.value = processPlain(input.value, 4, 2);
    }
    function doC() {
      if (input.value === atFocus) return;
      const text2 = processPlain(input.value, 4, 2);
      let value = parse(text2);
      if (value === null || !isFinite(value) || value < 0) value = 0;
      if (value === 0) {
        input.value = "";
      } else if (trimZeros) {
        const parts = value.toFixed(2).split(".");
        const dec = parts[1].replace(/0+$/, "");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        input.value = parts[0] + (dec ? "." + dec : "");
      } else {
        input.value = addCommas(value.toFixed(2));
      }
      atFocus = input.value;
      onCommit(value);
    }
    bindAdjustmentEvents(input, {
      onInput: doI,
      onCommit: doC,
      onFocus() {
        atFocus = input.value;
        input.select();
      }
    });
  }
  function bindNumeric(input, {
    allowDecimal = true,
    maxIntDigits = 6,
    maxFracDigits = 2,
    showCommas = false
  } = {}) {
    function process() {
      const oldLength = input.value.length, position = input.selectionStart;
      let value = input.value.replace(/,/g, "").replace(/[^\d.]/g, "");
      if (!allowDecimal) {
        value = value.replace(/\D/g, "");
        value = value.replace(/^0+(\d)/, "$1").replace(/^0{2,}/, "0");
        value = value.slice(0, maxIntDigits);
      } else {
        const dot = value.indexOf(".");
        if (dot >= 0) {
          let integerPart = value.slice(0, dot).slice(0, maxIntDigits);
          const decimalPart = value.slice(dot + 1).replace(/\./g, "").slice(0, maxFracDigits);
          if (!integerPart) integerPart = "0";
          else integerPart = integerPart.replace(/^0+(\d)/, "$1").replace(/^0{2,}/, "0");
          value = integerPart + "." + decimalPart;
        } else {
          value = value.slice(0, maxIntDigits);
          value = value.replace(/^0+(\d)/, "$1").replace(/^0{2,}/, "0");
        }
      }
      if (showCommas && value) {
        const parts = value.split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        const f = parts.join(".");
        input.value = f;
        const diff = f.length - oldLength;
        try {
          input.setSelectionRange(position + diff, position + diff);
        } catch (_) {
        }
      } else input.value = value;
    }
    input.addEventListener("input", process);
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      let raw = (e.clipboardData || window.clipboardData).getData("text").replace(/,/g, "");
      if (!allowDecimal) raw = raw.replace(/\D/g, "");
      else {
        raw = raw.replace(/[^\d.]/g, "");
        const parts = raw.split(".");
        if (parts.length > 2) raw = parts[0] + "." + parts.slice(1).join("");
      }
      input.value = raw;
      process();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "," || e.key === "،") e.preventDefault();
    });
  }
  return {
    stripRaw,
    normDots,
    normLeading,
    truncDec,
    limitInt,
    addCommas,
    restoreCursor,
    parse,
    parsePct,
    processPlain,
    addTriggers,
    bindPercAdj,
    bindMoneyAdj,
    bindNumeric
  };
})();

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
function validateBill(b, { undo = true } = {}) {
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
    if (!undo || !b.undo.before) throw Error("ข้อมูลย้อนกลับไม่ถูกต้อง");
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

// src/approved-ui-bridge.mjs
function approvedItem(it) {
  return normalizeAssignmentLocks({ id: it.id, name: it.name, groupId: "manual", quantity: it.quantity || 1, priceSource: it.authoritativeTotalCents != null ? "line_total" : "unit_price", priceCents: it.authoritativeTotalCents ?? cents((it.price || 0).toFixed(2)), assignments: it.assignments.map((a) => ({ personId: a.personId, locked: !!a.locked, amountCents: Math.round((a.amount || 0) * 100), ...a.lockMode ? { lockMode: a.lockMode, ...a.lockMode === "percentage" ? { lockPercentUnits: a.lockPercentUnits } : {} } : {} })) });
}
var percentageOf = (a, total) => !total ? 0 : a.locked && a.lockMode === "percentage" ? a.lockPercentUnits / 1e4 : a.amountCents / total * 100;
function uiAssignments(it) {
  const total = itemTotal(it);
  return it.assignments.map((a) => ({ personId: a.personId, locked: a.locked, amount: a.amountCents / 100, percentage: percentageOf(a, total), lockMode: a.lockMode, ...a.lockMode === "percentage" ? { lockPercentUnits: a.lockPercentUnits } : {} }));
}
function recalculateApprovedItem(item) {
  const result = recalculateItemAssignments(approvedItem(item));
  return { item: { ...structuredClone(item), assignments: uiAssignments(result.item) }, overallocated: result.overallocated };
}
var approvedItemOvercommitted = (item) => allocationOvercommitted(approvedItem(item));
function approvedShares(item) {
  const it = approvedItem(item), total = itemTotal(it);
  const resolved = allocationOvercommitted(it) ? it.assignments : shares(it), metadata = new Map(it.assignments.map((a) => [a.personId, a]));
  return Object.fromEntries(resolved.map((a) => [a.personId, { amount: a.amountCents / 100, percentage: percentageOf({ ...metadata.get(a.personId), amountCents: a.amountCents }, total) }]));
}
function approvedState(b) {
  b = normalizeBillPolicy(b);
  assertSingleGroup(b);
  const g = b.groups[0], subtotal = b.items.reduce((s, it) => s + (it.priceSource === "line_total" ? it.priceCents : it.priceCents * it.quantity), 0);
  function charge(a) {
    const value = a.kind === "rate" ? a.value / 100 : subtotal ? a.value / subtotal * 100 : 0;
    return { enabled: a.enabled, value, ...a.kind === "fixed" ? { fixedCents: a.value, displayRate: value } : {} };
  }
  const tax = charge(g.tax);
  if (g.tax.treatment === "included") {
    tax.enabled = false;
    tax.included = true;
    tax.includedEnabled = g.tax.enabled;
  }
  return { people: structuredClone(b.people), items: b.items.map((it) => ({ id: it.id, name: it.name, price: it.priceSource === "line_total" ? Math.round(it.priceCents / it.quantity) / 100 : it.priceCents / 100, quantity: it.quantity, ...it.priceSource === "line_total" ? { authoritativeTotalCents: it.priceCents } : {}, assignments: uiAssignments(it) })), service: charge(g.service), tax, discount: { mode: g.discount.kind === "fixed" ? "fixed" : "percent", value: g.discount.value / 100, placement: g.placement }, serviceDist: g.serviceDist, discountDist: g.discountDist };
}
function approvedBill(s, previous = emptyBill()) {
  const b = emptyBill();
  b.revision = previous.revision + 1;
  b.imports = [...previous.imports];
  b.people = structuredClone(s.people);
  const g = b.groups[0];
  if (previous.groups.length === 1) {
    g.name = previous.groups[0].name;
    if (previous.groups[0].printedTotalCents != null) g.printedTotalCents = previous.groups[0].printedTotalCents;
  }
  function charge(a) {
    return { enabled: !!a.enabled, kind: a.fixedCents != null && a.value === a.displayRate ? "fixed" : "rate", value: a.fixedCents != null && a.value === a.displayRate ? a.fixedCents : Math.round(a.value * 100) };
  }
  g.service = charge(s.service);
  g.tax = { ...charge(s.tax), treatment: s.tax.included && !s.tax.enabled ? "included" : "excluded" };
  if (s.tax.included && !s.tax.enabled) g.tax.enabled = !!s.tax.includedEnabled;
  g.discount = { enabled: !!s.discount.value, kind: s.discount.mode === "fixed" ? "fixed" : "rate", value: Math.round(s.discount.value * 100) };
  g.placement = "after_sc_vat";
  g.serviceDist = s.serviceDist;
  g.discountDist = s.discountDist;
  b.items = s.items.map((it) => ({ ...structuredClone(previous.items.find((x) => x.id === it.id) || {}), ...approvedItem(it) }));
  return validateBill(b);
}
function approvedTotals(s, previous) {
  if (!s.people.length) return null;
  return approvedBillTotals(s, previous);
}
function approvedBillTotals(s, previous) {
  const b = approvedBill(s, previous), r = calculate(b), g = r.groups[0], pt = /* @__PURE__ */ Object.create(null);
  for (const p of s.people) {
    const n = r.people[p.id];
    pt[p.id] = { subtotal: n.subtotal / 100, discount: n.discount / 100, service: n.service / 100, vat: n.tax / 100, total: n.total / 100, preDiscount: (n.total + n.discount) / 100 };
  }
  return { pt, Sb: r.subtotal / 100, D: g.discount / 100, discSb: (r.subtotal - g.discount) / 100, svcAmt: g.service / 100, vatAmt: g.tax / 100, grand: r.grand / 100, placement: "after_sc_vat", preDiscountTotal: (r.grand + g.discount) / 100, unallocated: r.unallocated / 100, warnings: r.warnings };
}

// src/bill-warnings.mjs
var ZERO_SHARE_SUFFIX = " มีส่วนแบ่ง 0 บาท หรือติดลบ";
var ZERO_THRESHOLD = 5e-3;
var DIFF_THRESHOLD = 5e-5;
var r42 = (value) => Math.round(value * 1e4) / 1e4;
function getItemWarnings(item, people) {
  const warnings = [], total = getItemTotal(item), assignments = item.assignments || [];
  const hasName = item.name.trim().length > 0;
  const hasPrice = total > 0;
  if (approvedItemOvercommitted(item)) {
    warnings.push({
      type: "over",
      diff: Math.max(0, assignments.filter((a) => a.locked).reduce((sum, a) => sum + a.amount, 0) - total),
      msg: "ยอดที่ล็อกไว้เกินราคารายการ โปรดปรับส่วนแบ่งหรือปลดล็อก"
    });
    return warnings;
  }
  if (hasName && !hasPrice) {
    warnings.push({
      type: "no_price",
      msg: "ยังไม่ได้ใส่ราคา"
    });
    return warnings;
  }
  if (!assignments.length) {
    warnings.push({
      type: "unassigned",
      msg: "ยังไม่ได้เลือกคน"
    });
    return warnings;
  }
  const locked = assignments.filter((a) => a.locked), unlocked = assignments.filter((a) => !a.locked);
  const lockedSum = locked.reduce((s, a) => s + (a.amount || 0), 0);
  if (total > 0) {
    if (!unlocked.length) {
      const diff = r42(lockedSum - total);
      if (Math.abs(diff) > DIFF_THRESHOLD) warnings.push({
        type: diff > 0 ? "over" : "under",
        diff: Math.abs(diff),
        msg: diff > 0 ? `ยอดแชร์เกินมา ${fmtTrim(diff, "บาท")}` : `ยอดแชร์ขาดไป ${fmtTrim(-diff, "บาท")}`
      });
    } else if (lockedSum > total + DIFF_THRESHOLD) {
      const diff = r42(lockedSum - total);
      warnings.push({
        type: "over",
        diff,
        msg: ` ยอดแชร์เกินมา ${fmtTrim(diff, "บาท")}`
      });
    }
  }
  const displayed = approvedShares(item);
  assignments.forEach((a) => {
    if (total > 0 && (displayed[a.personId]?.amount || 0) <= ZERO_THRESHOLD) {
      const person = people.find((x) => x.id === a.personId);
      warnings.push({
        type: "zero",
        personId: a.personId,
        msg: `${person?.name || "?"}${ZERO_SHARE_SUFFIX}`
      });
    }
  });
  return warnings;
}
function categorizeWarns(warnings) {
  return {
    overUnder: warnings.find((w) => w.type === "over" || w.type === "under"),
    zeroWarns: warnings.filter((w) => w.type === "zero")
  };
}
function getSplitLabel(item, people) {
  const warnings = getItemWarnings(item, people), assignments = item.assignments || [];
  const noPriceWarn = warnings.find((w) => w.type === "no_price");
  if (noPriceWarn) return {
    text: "⚠ ยังไม่ได้ใส่ราคา",
    cls: "bz"
  };
  if (!assignments.length) return {
    text: "⚠ ยังไม่ได้เลือกคน",
    cls: "bz"
  };
  if (warnings.length) {
    const {
      overUnder,
      zeroWarns
    } = categorizeWarns(warnings);
    if (overUnder) {
      let label = "⚠ " + (overUnder.type === "over" ? `เกินมา ${fmtTrim(overUnder.diff, "บาท")}` : `ขาดไป ${fmtTrim(overUnder.diff, "บาท")}`);
      if (label.length > 28) label = label.slice(0, 26) + "…";
      return {
        text: label,
        cls: "bz"
      };
    }
    if (zeroWarns.length === 1) {
      const person = people.find((x) => x.id === zeroWarns[0].personId);
      let label = `⚠ ${person?.name || "?"} จ่าย ≤ 0 บาท`;
      if (label.length > 28) label = label.slice(0, 26) + "…";
      return {
        text: label,
        cls: "bz"
      };
    }
    if (zeroWarns.length > 1) return {
      text: `⚠ ${zeroWarns.length} คน จ่าย ≤ 0 บาท`,
      cls: "bz"
    };
    let message = warnings[0].msg;
    if (message.length > 24) message = message.slice(0, 22) + "…";
    return {
      text: "⚠ " + message,
      cls: "bz"
    };
  }
  if (assignments.length === 1) return {
    text: "✓ กินคนเดียว",
    cls: "solo-badge"
  };
  return assignments.filter((a) => a.locked).length ? {
    text: "✓ แบ่งจ่ายเอง",
    cls: "bf"
  } : {
    text: "✓ หารเท่า",
    cls: "ba"
  };
}
function getPersonWarning(personId, state, totals) {
  if (totals && totals.pt[personId] !== void 0 && totals.pt[personId].total <= 0) return true;
  if (!state.items.some((it) => it.assignments.some((a) => a.personId === personId))) return true;
  for (const item of state.items) {
    const assignments = item.assignments.find((a) => a.personId === personId);
    if (!assignments) continue;
    if (getItemTotal(item) <= 0) continue;
    const displayedShares = approvedShares(item);
    if (displayedShares[personId] && displayedShares[personId].amount <= ZERO_THRESHOLD) return true;
  }
  return false;
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

// src/bill-work-keys.mjs
var HISTORY_KEY = "fairshare.bill-history.v2:";
var billHistoryKey = (id) => HISTORY_KEY + id;
var receiptDraftKey = (id) => "fairshare.approved-parser.v3:" + id;
var mainScrollKey = (id) => "fairshare.main-scroll.v2:" + id;
var billUiKey = (id) => "fairshare.ui.v2:" + id;

// src/main-layout.mjs
function createMainScroll({ storage, getEpoch }) {
  const lifetime = new AbortController(), signal = lifetime.signal;
  let epoch, offsets = { menu: 0, summary: 0 }, active2 = null, restoring = false, generation = 0, frame = 0;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  function sync() {
    if (epoch === getEpoch()) return;
    epoch = getEpoch();
    offsets = { menu: 0, summary: 0 };
    try {
      const saved = JSON.parse(storage?.getItem(mainScrollKey(epoch)));
      if (saved?.epoch === epoch) {
        for (const page of ["menu", "summary"]) if (Number.isFinite(saved[page]) && saved[page] >= 0) offsets[page] = saved[page];
      }
    } catch {
    }
  }
  function persist() {
    try {
      storage?.setItem(mainScrollKey(epoch), JSON.stringify({ epoch, ...offsets }));
    } catch {
    }
  }
  function capture() {
    sync();
    if (active2 && !restoring) {
      offsets[active2] = scrollY;
      persist();
    }
  }
  function leave() {
    capture();
    active2 = null;
    generation++;
    cancelAnimationFrame(frame);
    restoring = false;
  }
  function before(page) {
    sync();
    if (active2 === page) capture();
    restoring = true;
    generation++;
    cancelAnimationFrame(frame);
  }
  function restore(position) {
    const token = generation;
    restoring = true;
    frame = requestAnimationFrame(() => {
      if (token !== generation) return;
      window.scrollTo({ ...position, behavior: "instant" });
      frame = requestAnimationFrame(() => {
        if (token !== generation) return;
        window.scrollTo({ ...position, behavior: "instant" });
        frame = requestAnimationFrame(() => {
          if (token !== generation) return;
          const finish = () => {
            if (token !== generation) return;
            window.scrollTo({ ...position, behavior: "instant" });
            restoring = false;
            capture();
          };
          if (document.fonts?.status === "loading") document.fonts.ready.then(finish);
          else finish();
        });
      });
    });
  }
  function after(page) {
    active2 = page;
    restore({ top: offsets[page] });
  }
  function restoreTransient(position) {
    leave();
    restore({ left: position.x, top: position.y });
  }
  window.addEventListener("scroll", capture, { passive: true, signal });
  window.addEventListener("pagehide", capture, { signal });
  const interrupt = () => {
    if (restoring) {
      generation++;
      cancelAnimationFrame(frame);
      restoring = false;
      capture();
    }
  };
  window.addEventListener("wheel", interrupt, { passive: true, signal });
  window.addEventListener("touchstart", interrupt, { passive: true, signal });
  return { before, after, leave, capture, restoreTransient, dispose() {
    leave();
    lifetime.abort();
  }, reset() {
    leave();
    epoch = getEpoch();
    offsets = { menu: 0, summary: 0 };
    persist();
  }, get generation() {
    return generation;
  }, get restoring() {
    return restoring;
  } };
}
function reserveBottomAction(bar) {
  if (!bar) return () => {
  };
  const root = document.documentElement;
  const update = () => root.style.setProperty("--bottom-action-height", bar.getBoundingClientRect().height + "px");
  const observer = new ResizeObserver(update);
  observer.observe(bar);
  update();
  return () => {
    observer.disconnect();
    root.style.removeProperty("--bottom-action-height");
  };
}
function observeStickyHeading(heading) {
  if (!heading) return () => {
  };
  let frame = 0;
  const update = () => {
    frame = 0;
    const top = parseFloat(getComputedStyle(heading).top) || 0;
    heading.classList.toggle("is-stuck", heading.getBoundingClientRect().top <= top + 0.5 && scrollY > 0);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(document.getElementById("hdr"));
  observer.observe(heading);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  update();
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
  };
}

// src/main-bill-view.mjs
function bodyMeasureFont(size) {
  const style = getComputedStyle(document.body);
  return `400 ${style.getPropertyValue("--text-" + size).trim()} ${style.fontFamily}`;
}
function mountMenu(initial, actions2) {
  return mountBillView("menu", initial, actions2);
}
function mountSummary(initial, actions2) {
  return mountBillView("summary", initial, actions2);
}
function mountBillView(kind, initial, actions2) {
  let model = initial, collapsed = new Set(model.collapsed), distributionCleanup = () => {
  }, stickyCleanup = () => {
  }, bottomCleanup = () => {
  };
  const { measure: measureTW2, clear: clearTextWidths } = createTextMeasurer();
  function buildSummaryWarnLines(...args) {
    return createWarningPresentation(model.working.people).summary(...args);
  }
  function buildAdjBar({ id, label, enabled = true, ctrlHtml }) {
    return `<div class="adj-bar"${id ? ` id="${id}"` : ""}><span class="adj-bar-label${enabled ? "" : " is-muted"}">${label}</span><div class="adj-bar-ctrl">${ctrlHtml}</div></div>`;
  }
  function renderBillTotals(bt) {
    return `<div class="shdr"><span class="stitle">ยอดรวมบิล</span></div><div class="bill-totals totals"><div class="trow"><span class="tlbl">ยอดรวมย่อย</span><span class="tval">${fmt(bt.Sb)}</span></div>${billAdjRowsHtml(bt.svcAmt, bt.vatAmt, bt.D)}<div class="trow grand"><span class="tlbl">ยอดที่ต้องจ่าย</span><span class="tval">${fmt(bt.grand)}</span></div></div>`;
  }
  function distributionOptions(key, value, disabled) {
    return `<div class="segmented segmented--compact" role="radiogroup" aria-label="${key === "sd" ? "แบ่ง Service Charge" : "แบ่งส่วนลด"}">${[["equal", "หารเท่า"], ["proportional", "ตามสัดส่วน"]].map(([v, label]) => `<label class="segmented-option"><input type="radio" name="distribution-${key}" data-${key}="${v}" value="${v}" ${value === v ? "checked" : ""} ${disabled ? "disabled" : ""}><span class="segmented-face">${label}</span></label>`).join("")}</div>`;
  }
  function layoutDistribution2() {
    const row = document.querySelector("#screen-summary .dist-bar-row");
    if (!row || !row.clientWidth) return;
    const px = (value) => parseFloat(value) || 0;
    const gap = px(getComputedStyle(row).columnGap);
    const metrics = [...row.children].map((card) => {
      const style = getComputedStyle(card), label = card.querySelector(".dist-bar-label");
      const labelStyle = getComputedStyle(label);
      return {
        card,
        width: measureChoiceGroup(card.querySelector(".segmented"), { textFor: (face) => face.previousElementSibling.value === "proportional" ? "ตามสัดส่วน" : face.textContent }),
        short: measureChoiceGroup(card.querySelector(".segmented"), { textFor: (face) => face.previousElementSibling.value === "proportional" ? "สัดส่วน" : face.textContent }),
        outer: px(style.paddingLeft) + px(style.paddingRight) + px(style.borderLeftWidth) + px(style.borderRightWidth),
        // Measure the wide label style even while the card is compact, avoiding breakpoint oscillation.
        labelWidth: measureTW2(label.textContent, `500 ${labelStyle.getPropertyValue("--text-13").trim()} ${labelStyle.fontFamily}`)
      };
    });
    const half = (row.clientWidth - gap) / 2;
    const widePair = metrics.every((m) => m.width + m.outer + m.labelWidth + 10 <= half);
    const compactPair = !widePair && metrics.every((m) => m.short + m.outer <= half);
    const stacked = !widePair && !compactPair;
    const wide = widePair || stacked && metrics.every((m) => m.width + m.outer + m.labelWidth + 10 <= row.clientWidth);
    row.classList.toggle("dist-cards-stacked", stacked);
    for (const m of metrics) {
      m.card.style.setProperty("--distribution-choice-width", (compactPair ? m.short : m.width) + "px");
      m.card.classList.toggle("dist-bar-wide", wide);
      const input = m.card.querySelector("input[value=proportional]");
      input.setAttribute("aria-label", "ตามสัดส่วน");
      input.nextElementSibling.textContent = compactPair ? "สัดส่วน" : "ตามสัดส่วน";
    }
  }
  function billAdjRowsHtml(svc, vat, disc, person = false) {
    const variant = person ? " trow--person-adjustment" : "";
    let h = "";
    if (model.working.service.enabled) h += `<div class="trow${variant}"><span class="tlbl">Service Charge (${displayRate(model.working.service.value)}%)</span><span class="tval">+${fmt(svc)}</span></div>`;
    if (model.working.tax.enabled) h += `<div class="trow${variant}"><span class="tlbl">VAT (${displayRate(model.working.tax.value)}%)</span><span class="tval">+${fmt(vat)}</span></div>`;
    if (disc > 0) h += `<div class="trow${variant}"><span class="tlbl">ส่วนลด</span><span class="tval--discount tval">−${fmt(disc)}</span></div>`;
    return h;
  }
  function updatePeoplePreview2() {
    const na = document.getElementById("people-names-area");
    if (!na || !model.working.people.length) return;
    const maxW = na.clientWidth || na.getBoundingClientRect().width || 300;
    const sp = document.getElementById("people-names-span");
    if (sp) sp.textContent = buildPeoplePreview(model.working.people, maxW);
  }
  function buildPeoplePreview(people, maxWidth) {
    if (!people.length) return "";
    const font = bodyMeasureFont(13);
    const full = people.map((p) => p.name).join(", ");
    if (measureTW2(full, font) <= maxWidth) return full;
    for (let count = people.length - 1; count >= 1; count--) {
      const shown = people.slice(0, count).map((p) => p.name).join(", ");
      const ov2 = people.length - count;
      const cand = shown + ` และอีก ${ov2} คน`;
      if (measureTW2(cand, font) <= maxWidth) return cand;
    }
    const ov = people.length - 1;
    return people[0].name + (ov > 0 ? ` และอีก ${ov} คน` : "");
  }
  function emptyPeopleCard(id) {
    return `<div class="people-preview-card card"><div class="people-preview-empty"><div class="people-preview-note">ยังไม่มีรายชื่อคน โปรดเพิ่มคนเพื่อเริ่มแบ่งบิล</div><button class="btn--empty btn btn-p btn--orange" id="${id}">+ เพิ่มคน</button></div></div>`;
  }
  function renderMenuContent() {
    const el = document.getElementById("screen-menu");
    let h = "";
    const svcOn = model.working.service.enabled, vatOn = model.working.tax.enabled, dFixed = model.working.discount.mode === "fixed";
    const hasPeople = model.working.people.length > 0;
    h += `<div class="section-start shdr"><span class="stitle">รายชื่อคนที่โต๊ะอาหาร</span></div>`;
    if (!model.working.people.length) h += emptyPeopleCard("add-first-p-btn");
    else {
      h += `<div class="people-preview-card open-row card" id="go-people-bar"><div class="li"><div class="people-count"><span class="people-count-number">${model.working.people.length} คน</span></div><div id="people-names-area" class="people-preview-area"><span id="people-names-span" class="people-preview-text">${model.working.people.map((p) => esc(p.name)).join(", ")}</span></div><svg class="chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div></div>`;
    }
    h += `<div class="shdr"><span class="stitle">รายการอาหาร</span></div>`;
    h += `<button class="btn-ocr-upload" id="upload-receipt-btn">${MAIN_ICONS.camera} อ่านใบเสร็จอัตโนมัติ</button>`;
    if (model.working.items.length) {
      h += `<div class="menu-list-gap card">`;
      model.working.items.forEach((it) => {
        const lbl = model.labels[it.id], total = getItemTotal(it), qty = it.quantity || 1, n = it.assignments.length;
        const pi = qty > 1 ? `${fmt(it.price || 0, "฿")} × ${qty} = ${fmt(total, "฿")} · ${n} คน` : `${fmt(total, "฿")} · ${n} คน`;
        h += `<div class="open-row li" data-a="open-it" data-id="${esc(it.id)}"><div class="li-c"><div class="li-t">${it.name ? esc(it.name) : `<em class="text-subdued">ไม่มีชื่อเมนู</em>`}</div><div class="li-s">${pi}</div></div><div class="li-r"><span class="badge-item ${lbl.cls}">${esc(lbl.text)}</span><button class="btn-icon danger-action" data-a="del-it" data-id="${esc(it.id)}">${MAIN_ICONS.bin}</button><svg class="chevron" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg></div></div>`;
      });
      h += `</div>`;
    } else {
      h += `<div class="menu-empty empty"><div class="empty-ico">🍽️</div><div class="empty-txt">กดปุ่มด้านล่างเพื่อเพิ่มเมนูแรก</div></div>`;
    }
    h += `<div id="add-menu-slot"><button class="btn--full btn ${hasPeople ? "btn-p btn--orange" : "btn-s"}" id="add-it-btn">${MAIN_ICONS.plus} เพิ่มเมนู</button></div>`;
    h += `<div class="shdr"><span class="stitle">ปรับยอดบิล</span></div><div class="adj-bar-row">`;
    const svcCtrl = `<div class="adj-iw--rate adj-iw"><input type="text" inputmode="decimal" autocomplete="off" class="adj-inp" id="adj-svc" value="${model.working.service.value ? displayRate(model.working.service.value) : ""}" placeholder="0" ${!svcOn ? "disabled" : ""}><span class="adj-sym">%</span></div><input type="checkbox" id="svc-chk" ${svcOn ? "checked" : ""}>`;
    const vatCtrl = `<div class="adj-iw--rate adj-iw"><input type="text" inputmode="decimal" autocomplete="off" class="adj-inp" id="adj-tax" value="${model.working.tax.value ? displayRate(model.working.tax.value) : ""}" placeholder="0" ${!vatOn ? "disabled" : ""}><span class="adj-sym">%</span></div><input type="checkbox" id="tax-chk" ${vatOn ? "checked" : ""}>`;
    const discCtrl = `<div class="mtgl"><button class="mtgl-b${!dFixed ? " act" : ""}" data-dm="percent">%</button><button class="mtgl-b${dFixed ? " act" : ""}" data-dm="fixed">฿</button></div><div class="adj-iw--discount adj-iw" id="disc-adj-iw"><input type="text" inputmode="decimal" autocomplete="off" class="adj-inp" id="adj-disc" value="${model.working.discount.value || ""}" placeholder="0"><span class="adj-sym" id="disc-sym">${dFixed ? "฿" : "%"}</span></div>`;
    h += buildAdjBar({ label: "Service Charge", enabled: svcOn, ctrlHtml: svcCtrl });
    h += buildAdjBar({ label: "VAT", enabled: vatOn, ctrlHtml: vatCtrl });
    h += buildAdjBar({ id: "disc-adj-bar", label: "ส่วนลด", ctrlHtml: discCtrl });
    h += `</div><div id="menu-bill-totals">${renderBillTotals(model.totals)}</div>`;
    el.innerHTML = h;
    layoutAdjustments(el.querySelector(".adj-bar-row"));
    updatePeoplePreview2();
    actions2.updateTabHint();
    actions2.bindPeopleEntry(el.querySelector("#go-people-bar"));
    actions2.bindPeopleEntry(el.querySelector("#add-first-p-btn"));
    actions2.bindBillAction(el.querySelector("#add-it-btn"), actions2.addItem, { preserveGesture: true });
    actions2.bindBillAction(el.querySelector("#upload-receipt-btn"), actions2.uploadReceipt);
    el.querySelectorAll('[data-a="open-it"]').forEach((node) => actions2.bindBillAction(node, () => actions2.openItem(node.dataset.id), { preserveGesture: true }));
    el.querySelectorAll('[data-a="del-it"]').forEach((node) => actions2.bindBillAction(node, () => actions2.deleteItem(node.dataset.id)));
    const svcChk = el.querySelector("#svc-chk"), svcI = el.querySelector("#adj-svc");
    actions2.bindBillAction(svcChk, () => {
      const enabled = !model.working.service.enabled;
      svcChk.checked = enabled;
      return actions2.toggleCharge("service", enabled);
    }, { preserveGesture: true });
    if (svcI && !svcI.disabled) numericInputs.bindPercAdj(svcI, (value) => actions2.editCharge("service", value));
    const taxChk = el.querySelector("#tax-chk"), taxI = el.querySelector("#adj-tax");
    actions2.bindBillAction(taxChk, () => {
      const enabled = !model.working.tax.enabled;
      taxChk.checked = enabled;
      return actions2.toggleCharge("tax", enabled);
    }, { preserveGesture: true });
    if (taxI && !taxI.disabled) numericInputs.bindPercAdj(taxI, (value) => actions2.editCharge("tax", value));
    const discI = el.querySelector("#adj-disc");
    if (discI) {
      if (dFixed) numericInputs.bindMoneyAdj(discI, actions2.editDiscount, { trimZeros: true });
      else numericInputs.bindPercAdj(discI, actions2.editDiscount);
    }
    el.querySelectorAll("[data-dm]").forEach((node) => actions2.bindBillAction(node, () => actions2.discountMode(node.dataset.dm)));
  }
  function setSummaryContent(el, controls2, details, keepControls) {
    if (keepControls) {
      const bar = el.querySelector("#summary-export-bar");
      el.querySelector("#summary-details").innerHTML = details;
      if (bar) el.querySelector("#summary-export-bar")?.replaceWith(bar);
    } else {
      distributionCleanup();
      el.innerHTML = controls2 + `<div id="summary-details" class="summary-details">${details}</div>`;
      attachDistHandlers(el);
      distributionCleanup = observeChoices(el.querySelector(".dist-bar-row"), layoutDistribution2);
    }
  }
  function renderSummaryContent(keepControls = false) {
    const el = document.getElementById("screen-summary");
    let h = "";
    const svcDistDisabled = !model.working.service.enabled;
    const discDistDisabled = !model.working.discount.value || model.working.discount.value <= 0;
    const containerW = el.clientWidth || window.innerWidth;
    h += `<div class="section-start shdr"><span class="stitle">วิธีการแบ่ง</span></div><div class="dist-bar-row">`;
    h += `<div class="dist-bar${svcDistDisabled ? " disabled-bar" : ""}"><span class="dist-bar-label">Service Charge</span><div class="dist-bar-ctrl">${distributionOptions("sd", model.working.serviceDist, svcDistDisabled)}</div></div>`;
    h += `<div class="dist-bar${discDistDisabled ? " disabled-bar" : ""}"><span class="dist-bar-label">ส่วนลด</span><div class="dist-bar-ctrl">${distributionOptions("dd", model.working.discountDist, discDistDisabled)}</div></div>`;
    h += `</div>`;
    const controls2 = h;
    h = "";
    const nPeople = model.working.people.length, allExpanded = collapsed.size === 0, allCollapsed = nPeople > 0 && collapsed.size >= nPeople;
    h += `<div class="per-person-sticky"><h2 class="stitle">ยอดรวมรายคน</h2>${nPeople ? `<div class="coll-btns"><button class="coll-btn${allExpanded ? " act" : ""}" id="btn-expand-all">ขยายทั้งหมด</button><button class="coll-btn${allCollapsed ? " act" : ""}" id="btn-collapse-all">ย่อทั้งหมด</button></div>` : ""}</div>`;
    if (!model.working.people.length) {
      const totals = model.totals;
      h += emptyPeopleCard("summary-add-people") + renderBillTotals(totals);
      if (totals.unallocated) h += `<p class="wb wb-w">ยังแบ่งจ่ายไม่ครบ ${fmt(totals.unallocated)}</p>`;
      setSummaryContent(el, controls2, h, keepControls);
      actions2.bindPeopleEntry(el.querySelector("#summary-add-people"));
      return;
    }
    const bt = model.totals;
    if (!bt) {
      h += `<div class="empty"><div class="empty-ico">💰</div><div class="empty-txt">ยังไม่มีข้อมูล</div></div>`;
      setSummaryContent(el, controls2, h, keepControls);
      return;
    }
    for (const warning of bt.warnings.filter((w) => w.includes("ยอดติดลบ"))) h += `<div class="wb wb-w" role="status">${esc(warning)}</div>`;
    if (bt.unallocated) h += `<div class="menu-list-gap wb wb-w">ยังแบ่งจ่ายไม่ครบ ${fmt(bt.unallocated)}</div>`;
    const warnMap = new Map(model.working.items.map((it) => [it.id, model.warnings[it.id]]));
    const warnItems = model.working.items.filter((it) => warnMap.get(it.id).length);
    if (warnItems.length) {
      h += `<div class="menu-list-gap wb summary-item-warning"><strong class="warning-heading">⚠ มีเมนู ${warnItems.length} รายการที่ยังมีคำเตือนค้างอยู่</strong>`;
      for (const item of warnItems) {
        const lines = buildSummaryWarnLines(item, containerW, warnMap.get(item.id));
        for (const [index, line] of lines.entries()) {
          const first = index === 0 ? " warning-line--first" : "";
          if (line.hasLink) {
            h += `<div class="warning-line warning-line--linked${first}">
            <button type="button" class="warning-item-link" data-a="go-item" data-id="${esc(line.id)}">${esc(line.linkText)}</button>
            <span class="warning-linked-note">${esc(line.text)}</span>
          </div>`;
          } else {
            h += `<div class="warning-line warning-line--plain${first}">${esc(line.text)}</div>`;
          }
        }
      }
      h += `</div>`;
    }
    model.working.people.forEach((p) => {
      const pt = bt.pt[p.id];
      if (!pt) return;
      const neg = pt.total < 0, hw = model.personWarnings[p.id];
      const assigned = model.working.items.filter((it) => it.assignments.some((a) => a.personId === p.id));
      const hasNoItems = assigned.length === 0;
      const isCollapsed = collapsed.has(p.id);
      h += `<div class="scard"><button type="button" class="scard-hdr" data-a="toggle-coll" data-pid="${esc(p.id)}" aria-expanded="${!isCollapsed}"><div class="person-heading-name">${hw ? `<span class="person-heading-warning">⚠</span>` : ""}<span class="sname">${esc(p.name)}</span></div><div class="person-heading-total"><span class="stot${neg ? " neg" : ""}">${fmt(pt.total)}</span><svg class="coll-chev ${isCollapsed ? "closed" : "open"}" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg></div></button>`;
      h += `<div class="person-card-actions"><button type="button" class="btn btn-s" data-a="person-menus" data-pid="${esc(p.id)}">แก้ไขเมนูที่กิน</button></div>`;
      if (!isCollapsed) {
        if (hasNoItems) h += `<div class="person-summary-warning">⚠ ยังไม่ได้เลือกเมนูใด</div>`;
        else if (pt.total <= 0 && assigned.length > 0) h += `<div class="person-summary-warning">⚠ ยอดรวมเป็น 0 บาท หรือติดลบ</div>`;
        if (assigned.length) {
          h += `<div class="sbd">`;
          assigned.forEach((it) => {
            const a = it.assignments.find((x) => x.personId === p.id);
            if (!a) return;
            const d = model.shares[it.id][p.id] || { amount: a.amount || 0, percentage: a.percentage || 0 };
            const itW = warnMap.get(it.id).length > 0;
            const qty2 = it.quantity || 1;
            h += `<div class="open-row pdrow" data-a="go-edit-item" data-iid="${esc(it.id)}"><div class="pdi"><div class="pdn">${it.name ? esc(it.name) : `<em class="text-subdued">ไม่มีชื่อเมนู</em>`}</div><div class="pds"><span>${fmt(d.amount)}</span><span>·</span><span>${fP(d.percentage)}</span>${qty2 > 1 ? `<span class="text-subdued">จาก ${fmt(it.price || 0, "฿")}×${qty2}</span>` : ""}${a.locked ? '<span class="lk-chip">ล็อค</span>' : ""}</div></div><div class="pdr">${itW ? `<span class="person-item-warning" title="${esc(warnMap.get(it.id).map((w) => w.msg).join(", "))}">⚠</span>` : ""}<button class="btn-icon danger-action" data-a="rm-p-from-item" data-pid="${esc(p.id)}" data-iid="${esc(it.id)}" title="ลบออกจากเมนู">${MAIN_ICONS.bin}</button></div></div>`;
          });
          h += `<div class="person-totals">`;
          h += `<div class="trow--person-subtotal trow"><span class="tlbl">ยอดรวมย่อย</span><span class="tval">${fmt(pt.subtotal)}</span></div>`;
          h += billAdjRowsHtml(pt.service, pt.vat, pt.discount, true);
          h += `<div class="trow--person-grand trow grand"><span class="tlbl">ยอดรวม</span><span class="tval">${fmt(pt.total)}</span></div></div></div>`;
        }
      }
      h += "</div>";
    });
    h += renderBillTotals(bt);
    h += `<div id="summary-export-bar"><button class="btn--full btn--export btn btn-p" id="btn-download-summary" ${model.imageExporting ? "disabled" : ""}>${MAIN_ICONS.download} บันทึกสรุปยอดเป็นรูปภาพ</button></div>`;
    setSummaryContent(el, controls2, h, keepControls);
    el.querySelectorAll('[data-a="person-menus"]').forEach((node) => actions2.bindBillAction(node, () => actions2.personMenus(node.dataset.pid)));
    el.querySelectorAll('[data-a="toggle-coll"]').forEach((node) => node.addEventListener("click", () => actions2.toggleCollapsed(node.dataset.pid)));
    el.querySelector("#btn-expand-all").addEventListener("click", actions2.expandAll);
    el.querySelector("#btn-collapse-all").addEventListener("click", actions2.collapseAll);
    el.querySelectorAll('[data-a="go-item"]').forEach((node) => node.addEventListener("click", () => actions2.openItem(node.dataset.id)));
    el.querySelectorAll('[data-a="go-edit-item"]').forEach((node) => node.addEventListener("click", (event) => {
      if (!event.target.closest('[data-a="rm-p-from-item"]')) actions2.openItem(node.dataset.iid);
    }));
    el.querySelectorAll('[data-a="rm-p-from-item"]').forEach((node) => node.addEventListener("click", (event) => {
      event.stopPropagation();
      actions2.removePersonMenu(node.dataset.pid, node.dataset.iid);
    }));
    const exportButton = el.querySelector("#btn-download-summary");
    if (exportButton && !exportButton.dataset.bound) {
      actions2.bindBillAction(exportButton, actions2.exportSummary);
      exportButton.dataset.bound = "true";
    }
  }
  function attachDistHandlers(el) {
    for (const [attribute, key] of [["sd", "serviceDist"], ["dd", "discountDist"]]) {
      el.querySelectorAll("[data-" + attribute + "]").forEach((input) => input.addEventListener("change", () => {
        if (input.checked && !input.disabled) actions2.distribution(key, input.dataset[attribute]);
      }));
    }
  }
  function update(next) {
    model = next;
    collapsed = new Set(model.collapsed);
    if (model.totalsOnly) {
      const panel = document.getElementById("menu-bill-totals");
      if (panel) panel.innerHTML = renderBillTotals(model.totals);
      return;
    }
    if (kind === "menu") {
      renderMenuContent();
      return;
    }
    stickyCleanup();
    bottomCleanup();
    renderSummaryContent(!!model.keepControls);
    stickyCleanup = observeStickyHeading(document.querySelector(".per-person-sticky"));
    const bar = document.getElementById("summary-export-bar");
    document.getElementById("app-footer").style.display = bar ? "none" : "";
    bottomCleanup = reserveBottomAction(bar);
  }
  update(initial);
  return {
    update,
    layout() {
      if (kind === "menu") {
        layoutAdjustments(document.querySelector("#screen-menu .adj-bar-row"));
        updatePeoplePreview2();
      } else layoutDistribution2();
    },
    dispose() {
      distributionCleanup();
      stickyCleanup();
      bottomCleanup();
      clearTextWidths();
      document.getElementById("screen-" + kind).replaceChildren();
    }
  };
}
function renderItemWarning(item, people) {
  return createWarningPresentation(people).item(item);
}
function createWarningPresentation(people) {
  const model = { working: { people } };
  const { measure: measureTW2 } = createTextMeasurer();
  function _zeroNamesDisplay(names, ouPart, suffix, avail, font) {
    if (measureTW2(ouPart + names.join(" ") + suffix, font) <= avail) return names.join(" ");
    for (let i = names.length - 1; i >= 1; i--) {
      const cand = ouPart + names.slice(0, i).join(" ") + ` และคนอีก ${names.length - i} คน` + suffix;
      if (measureTW2(cand, font) <= avail) return names.slice(0, i).join(" ") + ` และคนอีก ${names.length - i} คน`;
    }
    return `${names.length} คน`;
  }
  function _getZeroWarnNames(zeroWarns) {
    return zeroWarns.map((w) => {
      const p = model.working.people.find((x) => x.id === w.personId);
      return p?.name || "?";
    });
  }
  function buildWarnHtml(item) {
    const total = getItemTotal(item);
    const over = getItemWarnings(item, model.working.people).find((w) => w.type === "over");
    if (over) return `<div class="wb wb-w" role="alert">⚠ ${esc(over.msg)}</div>`;
    if (!total || total <= 0) return `<div class="wb wb-n">ใส่ราคาเพื่อเริ่มแบ่งบิล</div>`;
    if (!item.assignments || !item.assignments.length) return `<div class="wb wb-n">เลือกคนด้านล่างเพื่อเริ่มแบ่งบิล</div>`;
    const warns = getItemWarnings(item, model.working.people);
    if (!warns.length) return `<div class="wb wb-ok">✓ ${item.assignments.length === 1 ? "กินคนเดียว" : "แบ่งบิลเรียบร้อย"}</div>`;
    const { overUnder, zeroWarns } = categorizeWarns(warns);
    let html = "";
    if (overUnder) html += `<div class="wb wb-w">⚠ ${esc(overUnder.msg)}</div>`;
    if (zeroWarns.length) {
      const warnEl = document.getElementById("item-warn-area");
      const avail = warnEl && warnEl.clientWidth > 50 ? warnEl.clientWidth - 30 : window.innerWidth - 62;
      const font = bodyMeasureFont(13);
      const names = _getZeroWarnNames(zeroWarns);
      const displayNames = _zeroNamesDisplay(names, "⚠ ", ZERO_SHARE_SUFFIX, avail, font);
      html += `<div class="wb wb-w">⚠ ${esc(displayNames + ZERO_SHARE_SUFFIX)}</div>`;
    }
    if (!overUnder && !zeroWarns.length) html += `<div class="wb wb-w">⚠ ${esc(warns[0].msg)}</div>`;
    return html || `<div class="wb wb-ok">✓ แบ่งบิลเรียบร้อย</div>`;
  }
  function buildSummaryWarnLines(item, containerW, preWarns) {
    const warns = preWarns || getItemWarnings(item, model.working.people);
    if (!warns.length) return [];
    const noPriceWarn = warns.find((w) => w.type === "no_price");
    const { overUnder, zeroWarns } = categorizeWarns(warns);
    const lines = [];
    const font12 = bodyMeasureFont(12);
    const fontLink = bodyMeasureFont(13);
    const wbInner = (containerW || window.innerWidth) - 32 - 26;
    if (noPriceWarn) {
      lines.push({ hasLink: true, id: item.id, linkText: item.name || "ไม่มีชื่อ", text: noPriceWarn.msg });
      return lines;
    }
    if (overUnder) lines.push({ hasLink: true, id: item.id, linkText: item.name || "ไม่มีชื่อ", text: overUnder.msg });
    if (zeroWarns.length) {
      const names = _getZeroWarnNames(zeroWarns);
      if (overUnder) {
        const avail = Math.max(wbInner - 2, 80);
        lines.push({ hasLink: false, id: item.id, text: _zeroNamesDisplay(names, "", ZERO_SHARE_SUFFIX, avail, font12) + ZERO_SHARE_SUFFIX });
      } else {
        const itemNameW = measureTW2(item.name || "ไม่มีชื่อ", fontLink);
        const avail = Math.max(wbInner - itemNameW - 5, 80);
        lines.push({ hasLink: true, id: item.id, linkText: item.name || "ไม่มีชื่อ", text: _zeroNamesDisplay(names, "", ZERO_SHARE_SUFFIX, avail, font12) + ZERO_SHARE_SUFFIX });
      }
    }
    if (!overUnder && !zeroWarns.length && warns.length) lines.push({ hasLink: true, id: item.id, linkText: item.name || "ไม่มีชื่อ", text: warns[0].msg });
    return lines;
  }
  return { item: buildWarnHtml, summary: buildSummaryWarnLines };
}

// src/main-editor-view.mjs
function mountPeople(initial, actions2) {
  let model = initial, first = true, enterHeld = false;
  const releaseEnter = (event) => {
    if (event.key === "Enter") enterHeld = false;
  };
  addEventListener("keyup", releaseEnter, true);
  function renderPeople2() {
    const el = document.getElementById("screen-people");
    let h = "";
    h += `<div class="people-add-card card"><label class="inp-lbl" for="np-inp">เพิ่มคน</label><div class="people-add-row"><input id="np-inp" class="inp--people-add inp" type="text" maxlength="30" placeholder="ชื่อจริงหรือชื่อเล่น" autocomplete="off" enterkeyhint="done"><button class="btn--people-add btn btn-p btn--orange" id="np-add-btn" type="button">เพิ่ม</button></div><div id="np-err" class="people-add-error inp-err"></div></div>`;
    h += `<div id="people-list-wrap"></div>`;
    el.innerHTML = h;
    document.getElementById("sticky-done-wrap").style.display = "block";
    document.getElementById("btn-done-sticky").textContent = "เสร็จสิ้น";
    document.getElementById("btn-done-sticky").onclick = actions2.donePeople;
    const npInp = document.getElementById("np-inp");
    npInp.value = model.peopleDraft.add;
    npInp.addEventListener("input", () => {
      actions2.capturePeople({ add: npInp.value });
    });
    document.getElementById("np-add-btn").addEventListener("click", () => actions2.addPerson());
    let enterHandled = false;
    function enterName(e) {
      if (e.isComposing || actions2.composing() || e.keyCode === 229) return;
      e.preventDefault();
      if (enterHandled || e.repeat) return;
      enterHandled = true;
      if (!npInp.value.trim()) {
        const err = document.getElementById("np-err");
        err.textContent = "";
        err.style.display = "none";
        npInp.blur();
        return;
      }
      actions2.addPerson();
    }
    npInp.addEventListener("beforeinput", (event) => {
      if (actions2.saving()) event.preventDefault();
    });
    npInp.addEventListener("paste", (event) => {
      if (actions2.saving()) event.preventDefault();
    });
    npInp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        enterHeld = true;
        enterName(e);
      }
    });
    npInp.addEventListener("beforeinput", (e) => {
      if (e.inputType === "insertLineBreak") enterName(e);
    });
    npInp.addEventListener("keyup", (e) => {
      if (e.key === "Enter") enterHandled = false;
    });
    npInp.addEventListener("focus", () => {
      if (!enterHeld) enterHandled = false;
    });
    npInp.addEventListener("input", () => {
      enterHandled = false;
    });
    npInp.addEventListener("input", () => {
      const err = document.getElementById("np-err");
      if (err) err.style.display = "none";
    });
    if (first) {
      first = false;
      if (matchMedia("(pointer: fine)").matches) npInp.focus();
    }
    renderPeopleList2();
  }
  function renderPeopleList2() {
    const wrap = document.getElementById("people-list-wrap");
    if (!wrap) return;
    let h = "";
    if (!model.working.people.length) {
      h += `<div class="people-empty empty"><div class="empty-ico">👥</div><div class="empty-txt">ยังไม่มีรายชื่อคน</div></div>`;
    } else {
      const n = model.working.people.length;
      h += `<div class="section-start shdr"><span class="stitle">คน · ${n}</span></div><div class="card"><div class="p2col">`;
      model.working.people.forEach((p, idx) => {
        const isRight = idx % 2 === 1;
        const lastRowStart = Math.floor((n - 1) / 2) * 2;
        const isLastRow = idx >= lastRowStart;
        const column = isRight ? "" : " p2cell--left";
        const row = isLastRow ? "" : " p2cell--divided";
        if (model.editingPid === p.id) {
          h += `<div class="p2cell-edit${row}"><input id="ep-${esc(p.id)}" class="inp--people-rename inp" type="text" value="${esc(p.name)}" maxlength="30" autocomplete="off" enterkeyhint="done"><button class="btn--rename-save btn btn-p" data-a="ep-save" data-id="${esc(p.id)}">✓</button><button class="btn--rename-cancel btn btn-s" data-a="ep-cancel">✕</button></div>`;
        } else {
          h += `<div class="p2cell${column}${row}"><span class="p2cell-name">${esc(p.name)}</span><button class="btn-icon--people btn-icon" data-a="rename-p" data-id="${esc(p.id)}"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button><button class="btn-icon--people btn-icon danger-action" data-a="del-p" data-id="${esc(p.id)}">${MAIN_ICONS.bin}</button></div>`;
        }
      });
      h += `</div></div>`;
    }
    wrap.innerHTML = h;
    if (model.peopleDraft.rename && model.editingPid === model.peopleDraft.rename.id) {
      const input = document.getElementById("ep-" + model.editingPid);
      if (input) input.value = model.peopleDraft.rename.value;
    }
    wrap.querySelectorAll('[data-a="rename-p"]').forEach((node) => node.addEventListener("click", (event) => {
      event.stopPropagation();
      actions2.renamePerson(node.dataset.id);
    }));
    wrap.querySelectorAll('[data-a="ep-save"]').forEach((e) => e.addEventListener("click", (ev) => {
      ev.stopPropagation();
      actions2.editPerson(e.dataset.id);
    }));
    wrap.querySelectorAll('[data-a="ep-cancel"]').forEach((e) => e.addEventListener("click", (ev) => {
      ev.stopPropagation();
      actions2.cancelRename();
    }));
    model.working.people.forEach((p) => {
      const inp = document.getElementById("ep-" + p.id);
      if (inp) {
        inp.addEventListener("input", () => {
          actions2.capturePeople({ rename: { id: p.id, value: inp.value } });
        });
        numericInputs.addTriggers(inp, () => actions2.editPerson(p.id));
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            actions2.cancelRename();
          }
        });
      }
    });
    wrap.querySelectorAll('[data-a="del-p"]').forEach((e) => e.addEventListener("click", (ev) => {
      ev.stopPropagation();
      actions2.deletePerson(e.dataset.id);
    }));
  }
  function update(next) {
    model = next;
    if (model.listOnly) renderPeopleList2();
    else renderPeople2();
  }
  update(initial);
  return { update, dispose() {
    removeEventListener("keyup", releaseEnter, true);
    document.getElementById("screen-people").replaceChildren();
    document.getElementById("btn-done-sticky").onclick = null;
  } };
}
function mountItem(initial, actions2) {
  let model = initial, disposed = false, doneObserver = null, warnAreaObserver = null, itemWidthObserver = null, chipLayoutRAF = 0, warnRebuildRAF = 0;
  const MAX_PRICE = 999999.99;
  const chipWidths = createTextMeasurer();
  const clone5 = (value) => structuredClone(value), r43 = (value) => Math.round(value * 1e4) / 1e4;
  function relayoutChips() {
    cancelAnimationFrame(chipLayoutRAF);
    chipLayoutRAF = requestAnimationFrame(() => {
      if (!disposed) {
        const item = actions2.currentItem();
        if (item) initChipLayout(item);
      }
    });
  }
  function cleanup() {
    doneObserver?.disconnect();
    warnAreaObserver?.disconnect();
    itemWidthObserver?.disconnect();
    doneObserver = warnAreaObserver = itemWidthObserver = null;
    cancelAnimationFrame(chipLayoutRAF);
    cancelAnimationFrame(warnRebuildRAF);
  }
  function buildItemFieldsHtml(item, twoLine) {
    const priceDisplay = item.price ? fmtComma(item.price) : "";
    return `<div class="item-fields${twoLine ? " item-fields--stacked" : ""}">
    <div class="item-name-field">
      <label class="field-lbl" for="it-name">ชื่อเมนู</label>
      <input id="it-name" class="inp" type="text" maxlength="50" value="${esc(item.name)}" placeholder="อาหาร/เครื่องดื่ม" autocomplete="off" enterkeyhint="next" aria-describedby="it-name-err">
      <div id="it-name-err" class="inp-err field-error-initial"></div>
    </div>
    <div class="item-number-fields">
      <div class="item-price-field">
        <div class="item-price-entry">
          <label class="field-lbl field-lbl--right" for="it-price">ราคา</label>
          <div class="field-with-unit">
            <input id="it-price" class="inp inp--currency" type="text" inputmode="decimal" autocomplete="off" value="${priceDisplay}" placeholder="0" enterkeyhint="next" aria-describedby="it-price-err">
            <span class="field-unit" aria-hidden="true">฿</span>
          </div>
        </div>
        <div id="it-price-err" class="inp-err field-error-initial"></div>
      </div>
      ${itemFieldOperator("×")}
      <div class="item-quantity-field">
        <label class="field-lbl field-lbl--center" for="it-qty">จำนวน</label>
        <input id="it-qty" class="inp inp--quantity" type="text" inputmode="numeric" autocomplete="off" value="${item.quantity || 1}" placeholder="1" enterkeyhint="done">
      </div>
      ${itemFieldOperator("=")}
      <div class="item-fields-total">
        <span class="field-lbl">ยอดรวม</span>
        <div id="it-total-disp" class="it-total-val">${fmt(getItemTotal(item), "บาท")}</div>
      </div>
    </div>
  </div>`;
  }
  function itemFieldOperator(symbol) {
    return `<div class="item-field-operator" aria-hidden="true"><span class="field-lbl">${symbol}</span><span class="item-operator-mark">${symbol}</span></div>`;
  }
  function getChipHighlight(item) {
    if (!model.working.people.length) return { allAct: false, noneAct: false };
    const ids = new Set(item.assignments.map((a) => a.personId));
    return { allAct: model.working.people.every((p) => ids.has(p.id)), noneAct: !model.working.people.some((p) => ids.has(p.id)) };
  }
  function livePreviewSplit(item, pid, value, mode) {
    const preview = clone5(item);
    actions2.setAllocation(preview, pid, value, mode);
    syncAssignmentRows(preview);
  }
  function bindItemSplitInput(inp, item, mode) {
    let edited = false;
    const parseValue = () => mode === "amt" ? numericInputs.parse(inp.value, true) : numericInputs.parsePct(inp.value);
    function commit() {
      if (!edited) return;
      edited = false;
      const value = parseValue();
      if (value === null || !isFinite(value) || value < 0) {
        syncAssignmentRows(item, null, true);
        return;
      }
      actions2.setAllocation(item, inp.dataset.pid, value, mode);
      actions2.installItemDraft(item);
      syncAssignmentRows(item, null, true);
      actions2.recordItem();
    }
    inp.addEventListener("focus", () => {
      edited = false;
      inp.select();
    });
    inp.addEventListener("input", () => {
      edited = true;
      const raw = inp.value.replace(/\\/g, "/");
      if (raw !== inp.value) inp.value = raw;
      if (!/[+\-*/]/.test(raw)) {
        const old = inp.value, pos = inp.selectionStart;
        const clean = numericInputs.processPlain(raw, mode === "amt" ? 8 : 3, mode === "amt" ? 2 : 4), next = mode === "amt" ? numericInputs.addCommas(clean) : clean;
        if (next !== old) {
          inp.value = next;
          numericInputs.restoreCursor(inp, old, next, pos);
        }
      }
      const value = parseValue();
      if (value !== null && isFinite(value) && value >= 0) livePreviewSplit(item, inp.dataset.pid, value, mode);
    });
    inp.addEventListener("blur", commit);
    numericInputs.addTriggers(inp, commit);
    inp.addEventListener("paste", (e) => {
      e.preventDefault();
      inp.value = (e.clipboardData || window.clipboardData).getData("text");
      inp.dispatchEvent(new Event("input"));
    });
  }
  const bindItemAmtInput = (inp, item) => bindItemSplitInput(inp, item, "amt");
  const bindItemPctInput = (inp, item) => bindItemSplitInput(inp, item, "pct");
  function assignmentFields(assignment, share) {
    return [
      { field: "amt", value: fmtComma(share.amount), lockMode: "amount" },
      { field: "pct", value: share.percentage.toFixed(2), lockMode: "percentage" }
    ].map(({ field, value, lockMode }) => {
      const locked = assignment.locked && assignment.lockMode === lockMode;
      return { field, value, className: `fi fi-${field} ${locked ? "fl" : "fa"}` };
    });
  }
  function syncAssignmentRows(item, focusPid = null, force = false) {
    const da = actions2.shares(item), wd = document.getElementById("item-warn-area");
    if (wd) wd.innerHTML = renderItemWarning(item, model.working.people);
    item.assignments.forEach((a) => {
      const d = da[a.personId] || { amount: 0, percentage: 0 }, lk = a.locked;
      for (const { field, value, className } of assignmentFields(a, d)) {
        const input = document.querySelector(`[data-f="${field}"][data-pid="${CSS.escape(a.personId)}"]`);
        if (input) {
          if (force || document.activeElement !== input) input.value = value;
          input.className = className;
          input.disabled = false;
        }
      }
      const button2 = document.querySelector(`[data-a="toggle-lock"][data-pid="${CSS.escape(a.personId)}"]`);
      if (button2) {
        button2.className = "lkb" + (lk ? " lk" : "");
        button2.innerHTML = lk ? MAIN_ICONS.lock : MAIN_ICONS.unlock;
        button2.disabled = false;
        button2.setAttribute("aria-label", (lk ? "ปลดล็อก" : "ล็อก") + "ส่วนแบ่ง");
      }
    });
  }
  function initChipLayout(item) {
    const cardEl = document.getElementById("chip-area");
    if (!cardEl || !model.working.people.length) return;
    const style = getComputedStyle(cardEl);
    const GAP = parseFloat(style.getPropertyValue("--space-7"));
    const chipPadding = parseFloat(style.getPropertyValue("--space-14"));
    const font = `500 ${style.getPropertyValue("--text-13").trim()} ${style.fontFamily}`;
    const rawW = cardEl.clientWidth || Math.max(window.innerWidth - 60, 120);
    const W = rawW - chipPadding * 2;
    const chips = model.working.people.map((p) => ({ p, w: Math.ceil(chipWidths.measure(p.name, font)) + chipPadding * 2 + 4 }));
    const rows = [];
    let row = [], rowW = 0;
    for (const chip of chips) {
      const nextW = row.length ? rowW + GAP + chip.w : chip.w;
      if (row.length && nextW > W) {
        rows.push(row);
        row = [chip];
        rowW = chip.w;
      } else {
        row.push(chip);
        rowW = nextW;
      }
    }
    if (row.length) rows.push(row);
    if (rows.length >= 2) {
      let last = rows[rows.length - 1], prev = rows[rows.length - 2];
      const widthOf = (arr) => arr.reduce((s, c, i) => s + c.w + (i ? GAP : 0), 0);
      let lastW = widthOf(last), prevW = widthOf(prev);
      while (prev.length > 1 && lastW / prevW < 0.5) {
        const moved = prev[prev.length - 1];
        const newPrev = prev.slice(0, -1);
        const newLast = [moved, ...last];
        const newPrevW = widthOf(newPrev), newLastW = widthOf(newLast);
        if (newPrevW <= W && newLastW <= W && newLastW / newPrevW >= 0.5) {
          prev = newPrev;
          last = newLast;
          rows[rows.length - 2] = prev;
          rows[rows.length - 1] = last;
        } else break;
        prevW = widthOf(prev);
        lastW = widthOf(last);
      }
    }
    let html = `<div class="chip-list">`;
    rows.forEach((row2) => {
      html += `<div class="chip-row">`;
      row2.forEach(({ p }) => {
        const sel = item.assignments.some((a) => a.personId === p.id);
        html += `<div data-a="chip-p" data-pid="${esc(p.id)}" class="person-chip${sel ? " is-selected" : ""}">${esc(p.name)}</div>`;
      });
      html += `</div>`;
    });
    html += `</div>`;
    cardEl.innerHTML = html;
    cardEl.querySelectorAll('[data-a="chip-p"]').forEach((c) => {
      c.addEventListener("click", () => {
        const item2 = actions2.currentItem();
        if (!item2) return;
        actions2.recordItem();
        const pid = c.dataset.pid, idx = item2.assignments.findIndex((a) => a.personId === pid);
        if (idx >= 0) item2.assignments.splice(idx, 1);
        else item2.assignments.push({ personId: pid, amount: 0, percentage: 0, locked: false });
        actions2.recalculate(item2);
        actions2.installItemDraft(item2);
        actions2.renderItem();
      });
    });
  }
  function refreshItemTotal(item) {
    const total = getItemTotal(item);
    const display = document.getElementById("it-total-disp");
    if (display) display.textContent = fmt(total, "บาท");
    actions2.headerTotal(total);
    return total;
  }
  function renderItemDetail2() {
    const el = document.getElementById("screen-item-detail");
    const item = structuredClone(model.item);
    if (!item) {
      el.innerHTML = "";
      return;
    }
    const twoLine = model.twoLine;
    const da = actions2.shares(item), total = getItemTotal(item);
    actions2.headerTotal(total);
    const { allAct, noneAct } = getChipHighlight(item);
    const addPersonBtn = model.working.people.length > 0 ? `<button id="chip-add-p-btn" class="btn--text-link">+ เพิ่ม/แก้ไขชื่อคนที่โต๊ะอาหาร</button>` : "";
    let h = `<div id="item-warn-sticky"><div id="item-warn-area">${renderItemWarning(item, model.working.people)}</div></div>`;
    h += `<div id="item-scroll-body"><div class="item-field-section">${buildItemFieldsHtml(item, twoLine)}</div>`;
    h += `<div class="item-selection-section">${addPersonBtn ? `<div class="item-people-action">${addPersonBtn}</div>` : ""}<div class="item-selection-heading"><span class="stitle">เลือกคนที่กินเมนูนี้</span>${model.working.people.length ? `<div class="coll-btns"><button class="coll-btn${allAct ? " act" : ""}" id="sel-all-btn">เลือกทุกคน</button><button class="coll-btn${noneAct ? " act" : ""}" id="desel-all-btn">ไม่เลือก</button></div>` : ""}</div></div>`;
    if (!model.working.people.length) h += `<div class="item-empty-people card"><span class="inline-link" id="go-p-link">เพิ่มคน</span> ในหน้า <em>รายชื่อคนที่โต๊ะอาหาร</em> ก่อน</div>`;
    else h += `<div id="chip-area" class="item-chip-card card"></div>`;
    if (item.assignments.length) {
      h += `<div class="card split-card">`;
      h += `<div class="split-grid split-grid--head"><div class="flbl">คน</div><div class="field-lbl--right flbl">จำนวนเงิน</div><div class="field-lbl--right flbl">เปอร์เซ็นต์</div><div></div></div>`;
      item.assignments.forEach((a) => {
        const p = model.working.people.find((x) => x.id === a.personId);
        if (!p) return;
        const d = da[a.personId] || { amount: 0, percentage: 0 }, lk = a.locked;
        const [amount, percentage] = assignmentFields(a, d);
        h += `<div class="split-grid split-grid--row" data-pid="${esc(a.personId)}"><div class="split-person-name">${esc(p.name)}</div><div class="field-with-unit split-field"><input type="text" inputmode="decimal" autocomplete="off" class="${amount.className}" aria-label="จำนวนเงินของ ${esc(p.name)}" data-f="amt" data-pid="${esc(a.personId)}" value="${amount.value}"><span class="field-unit field-unit--split">฿</span></div><div class="field-with-unit split-field"><input type="text" inputmode="decimal" autocomplete="off" class="${percentage.className}" aria-label="เปอร์เซ็นต์ของ ${esc(p.name)}" data-f="pct" data-pid="${esc(a.personId)}" value="${percentage.value}"><span class="field-unit field-unit--split">%</span></div><button aria-label="${lk ? "ปลดล็อก" : "ล็อก"}ส่วนแบ่งของ ${esc(p.name)}" class="lkb${lk ? " lk" : ""}" data-a="toggle-lock" data-pid="${esc(a.personId)}">${lk ? MAIN_ICONS.lock : MAIN_ICONS.unlock}</button></div>`;
      });
      h += `</div>`;
    }
    h += `<button class="item-bottom-action btn--full btn danger-action danger-action--outlined" id="del-item-btn">${MAIN_ICONS.bin} ลบเมนู</button>`;
    h += `<button class="item-bottom-action btn--full btn--done btn btn-p" id="btn-done-inline">เสร็จสิ้น</button></div>`;
    el.innerHTML = h;
    actions2.bindBillAction(el.querySelector("#btn-done-inline"), actions2.done);
    document.getElementById("btn-done-sticky").textContent = "เสร็จสิ้น";
    document.getElementById("btn-done-sticky").onclick = actions2.doneSticky;
    if (doneObserver) {
      doneObserver.disconnect();
      doneObserver = null;
    }
    const inlineDoneEl = document.getElementById("btn-done-inline"), stickyWrap = document.getElementById("sticky-done-wrap");
    if (inlineDoneEl && "IntersectionObserver" in window) {
      doneObserver = new IntersectionObserver((entries) => {
        stickyWrap.style.display = entries[0].isIntersecting ? "none" : "block";
      }, { threshold: 0.9 });
      doneObserver.observe(inlineDoneEl);
    } else stickyWrap.style.display = "block";
    if (warnAreaObserver) {
      warnAreaObserver.disconnect();
      warnAreaObserver = null;
    }
    const warnAreaEl = document.getElementById("item-warn-area");
    if (warnAreaEl && "ResizeObserver" in window) {
      warnAreaObserver = new ResizeObserver(() => {
        cancelAnimationFrame(warnRebuildRAF);
        warnRebuildRAF = requestAnimationFrame(() => {
          if (disposed) return;
          const it = actions2.currentItem();
          if (it) {
            const wd = document.getElementById("item-warn-area");
            if (wd) wd.innerHTML = renderItemWarning(it, model.working.people);
          }
        });
      });
      warnAreaObserver.observe(warnAreaEl);
    }
    if (itemWidthObserver) itemWidthObserver.disconnect();
    if ("ResizeObserver" in window) {
      itemWidthObserver = new ResizeObserver(() => layout());
      itemWidthObserver.observe(el);
    }
    if (model.working.people.length) initChipLayout(item);
    const nameInp = document.getElementById("it-name"), priceInp = document.getElementById("it-price"), qtyInp = document.getElementById("it-qty");
    nameInp.addEventListener("input", () => {
      item.name = nameInp.value;
      actions2.installItemDraft(item);
      actions2.title(item.name || "เมนูใหม่");
      document.getElementById("it-name-err").style.display = "none";
    });
    nameInp.addEventListener("blur", () => {
      const t = nameInp.value.trim();
      if (t) item.name = t;
      actions2.installItemDraft(item);
      actions2.recordItem();
    });
    numericInputs.addTriggers(nameInp, () => priceInp.focus());
    numericInputs.bindNumeric(priceInp, { showCommas: true });
    priceInp.addEventListener("focus", () => priceInp.select());
    priceInp.addEventListener("input", () => {
      const raw = priceInp.value.replace(/,/g, ""), num = parseFloat(raw);
      const livePrice = !isNaN(num) && num >= 0 ? Math.min(num, MAX_PRICE) : 0;
      delete item.authoritativeTotalCents;
      item.price = r43(livePrice);
      refreshItemTotal(item);
      actions2.recalculate(item, true);
      syncAssignmentRows(item);
      actions2.installItemDraft(item);
    });
    priceInp.addEventListener("blur", () => {
      const raw = priceInp.value.replace(/,/g, "");
      let num = parseFloat(raw);
      if (isNaN(num) || num < 0) {
        priceInp.value = "";
        item.price = 0;
      } else {
        num = Math.min(num, MAX_PRICE);
        item.price = r43(num);
        priceInp.value = num ? fmtComma(num) : "";
      }
      refreshItemTotal(item);
      actions2.installItemDraft(item);
      syncAssignmentRows(item);
    });
    numericInputs.addTriggers(priceInp, () => {
      qtyInp?.focus();
    });
    numericInputs.bindNumeric(qtyInp, { allowDecimal: false, maxIntDigits: 2 });
    qtyInp.addEventListener("focus", () => qtyInp.select());
    qtyInp.addEventListener("input", () => {
      const v = Math.min(Math.max(parseInt(qtyInp.value) || 1, 1), 99);
      delete item.authoritativeTotalCents;
      item.quantity = v;
      refreshItemTotal(item);
      actions2.recalculate(item, true);
      syncAssignmentRows(item);
      actions2.installItemDraft(item);
    });
    qtyInp.addEventListener("blur", () => {
      const v = Math.min(Math.max(parseInt(qtyInp.value) || 1, 1), 99);
      qtyInp.value = String(v);
      item.quantity = v;
      refreshItemTotal(item);
      actions2.installItemDraft(item);
      syncAssignmentRows(item);
    });
    numericInputs.addTriggers(qtyInp, () => qtyInp.blur());
    for (const input of el.querySelectorAll("input")) input.addEventListener("blur", () => queueMicrotask(actions2.recordItem));
    actions2.bindPeopleEntry(el.querySelector("#go-p-link"));
    actions2.bindPeopleEntry(el.querySelector("#chip-add-p-btn"));
    el.querySelector("#sel-all-btn")?.addEventListener("click", () => {
      model.working.people.forEach((p) => {
        if (!item.assignments.some((a) => a.personId === p.id)) item.assignments.push({ personId: p.id, amount: 0, percentage: 0, locked: false });
      });
      actions2.recalculate(item);
      actions2.installItemDraft(item);
      actions2.renderItem();
    });
    el.querySelector("#desel-all-btn")?.addEventListener("click", () => {
      item.assignments = [];
      actions2.recalculate(item);
      actions2.installItemDraft(item);
      actions2.renderItem();
    });
    el.querySelectorAll('[data-a="toggle-lock"]').forEach((b) => b.addEventListener("click", () => {
      const a = item.assignments.find((x) => x.personId === b.dataset.pid);
      if (!a) return;
      if (a.locked) a.locked = false;
      else {
        const current = actions2.shares(item)[a.personId] ?? { amount: 0, percentage: 0 };
        a.amount = current.amount;
        a.locked = true;
        a.lockMode ??= "percentage";
        if (a.lockMode === "percentage") a.lockPercentUnits = Math.round(current.percentage * 1e4);
      }
      actions2.recalculate(item);
      actions2.installItemDraft(item);
      actions2.renderItem();
    }));
    el.querySelectorAll('[data-f="amt"]').forEach((inp) => {
      if (!inp.disabled) bindItemAmtInput(inp, item);
    });
    el.querySelectorAll('[data-f="pct"]').forEach((inp) => {
      if (!inp.disabled) bindItemPctInput(inp, item);
    });
    actions2.bindEditorAction(el.querySelector("#del-item-btn"), actions2.deleteItem);
  }
  function layout() {
    const fields = document.querySelector("#screen-item-detail .item-fields");
    if (!fields) return;
    model = { ...model, twoLine: actions2.isTwoLine() };
    fields.classList.toggle("item-fields--stacked", model.twoLine);
    relayoutChips();
  }
  function update(next) {
    cleanup();
    model = next;
    renderItemDetail2();
  }
  update(initial);
  return {
    update,
    layout,
    dispose() {
      disposed = true;
      cleanup();
      chipWidths.clear();
      document.getElementById("screen-item-detail").replaceChildren();
      document.getElementById("btn-done-sticky").onclick = null;
    }
  };
}

// src/history.mjs
var clone = (value) => structuredClone(value);
function sameValue(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && sameValue(a[key], b[key]));
}
function createHistory(initial, { limit = 20, equal = sameValue, serialized } = {}) {
  let states = [clone(initial)], cursor = 0;
  if (serialized) {
    if (serialized.format !== 1 || !Array.isArray(serialized.states) || !serialized.states.length || serialized.states.length > limit + 1 || !Number.isInteger(serialized.cursor) || serialized.cursor < 0 || serialized.cursor >= serialized.states.length) throw Error("ข้อมูลประวัติไม่ถูกต้อง");
    states = clone(serialized.states);
    cursor = serialized.cursor;
  }
  return {
    get current() {
      return clone(states[cursor]);
    },
    get canUndo() {
      return cursor > 0;
    },
    get canRedo() {
      return cursor < states.length - 1;
    },
    // Unrecorded options belong to this slot; older states and redo stay intact.
    replaceCurrent(next) {
      states[cursor] = clone(next);
    },
    record(next, { force = false } = {}) {
      if (!force && equal(states[cursor], next)) return false;
      states = states.slice(0, cursor + 1);
      states.push(clone(next));
      if (states.length > limit + 1) states.shift();
      cursor = states.length - 1;
      return true;
    },
    undo() {
      if (cursor > 0) cursor--;
      return clone(states[cursor]);
    },
    redo() {
      if (cursor < states.length - 1) cursor++;
      return clone(states[cursor]);
    },
    reset(next) {
      states = [clone(next)];
      cursor = 0;
    },
    mapStates(mapper) {
      const mapped = [];
      let position = 0;
      states.forEach((state, index) => {
        const next = mapper(clone(state));
        if (!mapped.length || !equal(mapped.at(-1), next)) mapped.push(clone(next));
        if (index === cursor) position = mapped.length - 1;
      });
      states = mapped;
      cursor = position;
    },
    serialize() {
      return { format: 1, states: clone(states), cursor };
    }
  };
}

// src/main-editors.mjs
function createItemEditor({ item, isNew }) {
  let baseline = structuredClone(item), draft = structuredClone(item);
  const history2 = createHistory(draft);
  const snapshot2 = () => ({ itemId: draft.id, isNew, baseline: structuredClone(baseline), draft: structuredClone(draft), isDirty: !sameValue(draft, baseline) });
  return {
    edit(mutator) {
      const next = structuredClone(draft);
      mutator(next);
      draft = next;
      return snapshot2();
    },
    record() {
      return history2.record(draft);
    },
    undo() {
      draft = history2.undo();
      return snapshot2();
    },
    redo() {
      draft = history2.redo();
      return snapshot2();
    },
    snapshot: snapshot2,
    mapPeople(mapper) {
      baseline = mapper(structuredClone(baseline));
      draft = mapper(structuredClone(draft));
      history2.mapStates(mapper);
    },
    get dirty() {
      return !sameValue(draft, baseline);
    },
    get canUndo() {
      return history2.canUndo || !sameValue(draft, history2.current);
    },
    get canRedo() {
      return history2.canRedo && sameValue(draft, history2.current);
    }
  };
}
function createPeopleDraft() {
  let values = { add: "", rename: null };
  return {
    capture(next) {
      values = structuredClone(next);
    },
    reset() {
      values = { add: "", rename: null };
    },
    snapshot: () => structuredClone(values)
  };
}

// src/bill-session.mjs
var MAX_BYTES = 2 * 1024 * 1024;
var clone2 = (value) => structuredClone(value);
var content = (bill) => {
  const b = clone2(bill);
  delete b.revision;
  delete b.undo;
  delete b.imports;
  return b;
};
var snapshot = (value, imports) => ({ ...emptyBill(), ...clone2(value), imports: [...imports], undo: null });
var fits = (value) => new TextEncoder().encode(JSON.stringify(value)).length <= MAX_BYTES;
function purgeBillWork(storage, id) {
  for (const key of [billHistoryKey(id), receiptDraftKey(id), mainScrollKey(id), billUiKey(id)]) try {
    storage?.removeItem(key);
  } catch {
  }
}
function createBillSession({ repository: repository2, billId, sessionStorage: sessionStorage2 }) {
  let record = null, history2 = null, persistence = "session", blocked = false, busy = false;
  const key = billHistoryKey(billId);
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
  const envelope = (r = record, h = history2) => ({ format: 2, billId, revision: r.bill.revision, content: content(r.bill), history: h.serialize() });
  function result(status, message) {
    return { status, bill: record && clone2(record.bill), record: record && clone2(record), historyPersistence: persistence, message };
  }
  async function load({ canAdopt = () => true } = {}) {
    try {
      const next = await repository2.read(billId);
      if (!next) {
        blocked = true;
        return result("missing", "ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์");
      }
      if (!canAdopt(next)) return result("conflict", "บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนบันทึก");
      blocked = false;
      const old = record, oldHistory = history2;
      record = next;
      history2 = createHistory(content(next.bill));
      let restored = false;
      if (oldHistory && old.bill.revision === next.bill.revision && sameValue(content(old.bill), content(next.bill))) {
        history2 = oldHistory;
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
        if (!restored && saved?.format === 2 && saved.billId === billId && saved.revision === next.bill.revision && sameValue(saved.content, content(next.bill)) && fits(saved)) {
          const restoredHistory = createHistory(null, { serialized: saved.history });
          for (const state of saved.history.states) admittedBill(snapshot(state, next.bill.imports));
          if (!sameValue(restoredHistory.current, content(next.bill))) throw Error("ประวัติไม่ตรงกับบิล");
          history2 = restoredHistory;
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
    const latest = await repository2.read(billId);
    if (!latest) {
      blocked = true;
      throw Error("ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์");
    }
    if (!record || latest.recordRevision !== record.recordRevision) {
      blocked = true;
      throw Error("บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดแล้วลองอีกครั้ง");
    }
    return clone2(latest);
  }
  async function commit(candidate, { baseRevision = record?.recordRevision, kind = "edit", mutationId = newId(), timeline } = {}) {
    if (busy) return result("failed", "กำลังบันทึก รอสักครู่");
    if (blocked || !record) return result("conflict", "เช็กบิลล่าสุดก่อนบันทึก");
    busy = true;
    try {
      await assertCurrent();
      if (baseRevision !== record.recordRevision) return result("conflict", "บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดแล้วลองอีกครั้ง");
      const next = admittedBill(candidate);
      next.undo = null;
      next.imports = [.../* @__PURE__ */ new Set([...record.bill.imports, ...next.imports])];
      if (sameValue(content(next), content(record.bill)) && sameValue(next.imports, record.bill.imports)) return result("unchanged");
      next.revision = record.bill.revision + 1;
      admittedBill(next);
      let h = createHistory(null, { serialized: timeline ?? history2.serialize() });
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
      const outcome = await repository2.write({ id: billId, expectedRevision: baseRevision, mutationId, change: { kind: "content", bill: next } });
      if (!["saved", "unchanged"].includes(outcome.status)) {
        if (["conflict", "missing", "uncertain"].includes(outcome.status)) blocked = true;
        if (outcome.status !== "uncertain") write(from);
        return result(outcome.status, outcome.message);
      }
      record = outcome.record;
      history2 = h;
      persistence = write(envelope()) ? "session" : "memory";
      return result(outcome.status, persistence === "session" ? void 0 : "บิลบันทึกแล้ว แต่ประวัติย้อนกลับอาจหายเมื่อโหลดใหม่");
    } catch (error) {
      return result(blocked ? "conflict" : "failed", error.message);
    } finally {
      busy = false;
    }
  }
  async function move(direction) {
    if (!history2 || !(direction === "undo" ? history2.canUndo : history2.canRedo)) return result("unchanged");
    const h = createHistory(null, { serialized: history2.serialize() });
    return commit(snapshot(h[direction](), record.bill.imports), { kind: direction, timeline: h.serialize() });
  }
  return {
    load,
    commit,
    undo: () => move("undo"),
    redo: () => move("redo"),
    reconcile: load,
    assertCurrent,
    get current() {
      return record && clone2(record.bill);
    },
    get record() {
      return record && clone2(record);
    },
    get billId() {
      return billId;
    },
    get canUndo() {
      return !blocked && !!history2?.canUndo;
    },
    get canRedo() {
      return !blocked && !!history2?.canRedo;
    }
  };
}

// src/main-bill-controller.mjs
function overlayEdits(before, after, staged) {
  if (sameValue(before, after)) return structuredClone(staged);
  if (Array.isArray(before) && Array.isArray(after) && Array.isArray(staged)) {
    const key = (value) => value.id ?? value.personId;
    const old = new Map(before.map((value) => [key(value), value])), now = new Map(after.map((value) => [key(value), value]));
    const present = new Set(staged.map(key));
    return [
      ...staged.filter((value) => !old.has(key(value)) || now.has(key(value))).map((value) => old.has(key(value)) && now.has(key(value)) ? overlayEdits(old.get(key(value)), now.get(key(value)), value) : structuredClone(value)),
      ...after.filter((value) => !present.has(key(value)) && (!old.has(key(value)) || !sameValue(old.get(key(value)), value))).map((value) => structuredClone(value))
    ];
  }
  if (before && after && staged && typeof before === "object" && typeof after === "object" && typeof staged === "object") {
    const result = structuredClone(staged);
    for (const key of /* @__PURE__ */ new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (sameValue(before[key], after[key])) continue;
      if (!Object.hasOwn(after, key)) delete result[key];
      else result[key] = overlayEdits(before[key], after[key], staged[key]);
    }
    return result;
  }
  return structuredClone(after);
}
function createMainBillController({ repository: repository2, sessionStorage: sessionStorage2, getInteractionGuards = () => ({}), onChange = () => {
} }) {
  let session2 = null, working = approvedState(emptyBill()), pendingCandidate = null, pendingOperation = null;
  let opening = false, saving = false, storageBlocked = false, invalidCandidate = false, error = "", outcome = null, entryPhase = "loading";
  let openingTarget = null, missingTarget = null, generation = 0, openRequest = 0, savePromise = null, confirmation = null, queued = false, disposed = false;
  const clone5 = (value) => structuredClone(value);
  function getSnapshot() {
    return clone5({
      billId: session2?.billId ?? null,
      record: session2?.record ?? null,
      working,
      pendingCandidate,
      pendingOperation,
      opening,
      saving,
      storageBlocked,
      invalidCandidate,
      error,
      outcome,
      entryPhase,
      openingTarget,
      missingTarget,
      canUndo: !!session2?.canUndo,
      canRedo: !!session2?.canRedo,
      reconciliationQueued: queued
    });
  }
  function notify(reason, extra = {}) {
    if (!disposed) onChange({ reason, snapshot: getSnapshot(), ...extra });
  }
  const current = (target, token) => !disposed && session2 === target && generation === token;
  const uncertain2 = () => pendingOperation?.outcome?.status === "uncertain";
  function busyGuards() {
    const guards = getInteractionGuards();
    return saving || opening || guards.actionBusy || guards.nameBusy;
  }
  function editGuards() {
    const guards = getInteractionGuards();
    return guards.hasItemSession || guards.hasPeopleDraft || guards.nameDirty || guards.inputFocused || guards.sheetOpen || pendingCandidate || invalidCandidate;
  }
  function markMissing(id, message) {
    storageBlocked = true;
    error = message;
    outcome = "missing";
    missingTarget = id;
    entryPhase = "missing";
  }
  function accept(result, staged) {
    outcome = result.status;
    if (!["saved", "unchanged"].includes(result.status)) {
      error = result.message;
      if (result.status === "missing") markMissing(session2.billId, result.message);
      return false;
    }
    working = staged ? overlayEdits(staged.workingAtCommit, working, approvedState(result.bill)) : approvedState(result.bill);
    pendingCandidate = null;
    invalidCandidate = false;
    error = "";
    return true;
  }
  async function open(id, { reason = "switch", targetView } = {}) {
    const request = ++openRequest;
    opening = true;
    notify("save-started");
    try {
      const next = createBillSession({ repository: repository2, billId: id, sessionStorage: sessionStorage2 });
      const loaded = await next.load();
      if (disposed || openRequest !== request) return false;
      if (loaded.status !== "loaded") {
        const message = reason === "created" ? "บันทึกบิลใหม่แล้ว แต่ยังเปิดไม่ได้: " + loaded.message : reason === "deleted" ? "ลบบิลแล้ว แต่ยังเปิดบิลถัดไปไม่ได้: " + loaded.message : loaded.message;
        if (reason === "created" || reason === "deleted" || session2 && loaded.status === "failed") openingTarget = { id, targetView, reason, message };
        if (!session2) {
          missingTarget = id;
          storageBlocked = true;
          entryPhase = loaded.status === "missing" ? "missing" : "unavailable";
        }
        error = message;
        notify("error", { message });
        return false;
      }
      generation++;
      session2 = next;
      working = approvedState(loaded.bill);
      storageBlocked = false;
      invalidCandidate = false;
      error = "";
      outcome = null;
      entryPhase = "ready";
      openingTarget = null;
      missingTarget = null;
      pendingCandidate = null;
      saving = false;
      savePromise = null;
      notify("opened", { message: loaded.message });
      if (reason === "switch" || reason === "created") await repository2.writeLastSelected?.(id);
      return true;
    } finally {
      if (openRequest === request) {
        opening = false;
        notify("save-finished");
        if (queued) queueMicrotask(reconcile);
      }
    }
  }
  function editWorking(mutator) {
    const next = clone5(working);
    mutator(next);
    working = next;
    return clone5(working);
  }
  async function commit(candidate, options = {}) {
    if (saving || opening || storageBlocked || uncertain2() || !session2 || disposed) return false;
    const target = session2, token = generation;
    const staged = {
      bill: clone5(candidate),
      workingAtCommit: clone5(options.workingAtCommit ?? working),
      baseRevision: options.baseRevision ?? target.record.recordRevision,
      mutationId: options.mutationId ?? newId(),
      kind: options.kind ?? "edit",
      id: target.billId,
      peopleEdit: clone5(options.peopleEdit)
    };
    pendingCandidate = staged;
    saving = true;
    error = "";
    savePromise = target.commit(staged.bill, staged);
    notify("save-started");
    try {
      const result = await savePromise;
      if (!current(target, token)) return false;
      const accepted = accept(result, staged);
      notify("save-finished", { accepted, completedPeopleEdit: accepted ? staged.peopleEdit : void 0, message: result.message });
      return accepted;
    } finally {
      if (current(target, token)) {
        saving = false;
        savePromise = null;
        notify("save-finished");
        if (queued) queueMicrotask(reconcile);
      }
    }
  }
  async function moveHistory2(direction) {
    if (!session2 || saving || opening || storageBlocked || uncertain2()) return false;
    const target = session2, token = generation;
    saving = true;
    savePromise = target[direction]();
    notify("save-started");
    try {
      const result = await savePromise;
      if (!current(target, token)) return false;
      const accepted = accept(result);
      notify("history-moved", { accepted, message: result.message });
      return accepted;
    } finally {
      if (current(target, token)) {
        saving = false;
        savePromise = null;
        notify("save-finished");
        if (queued) queueMicrotask(reconcile);
      }
    }
  }
  async function refresh({ preserveWorking = false, quiet = false } = {}) {
    if (!session2) return { status: "missing" };
    const target = session2, token = generation;
    let retainWorking = false;
    const result = await target.load({ canAdopt: (next) => {
      if (!current(target, token)) return false;
      if (!preserveWorking) return true;
      const guards = getInteractionGuards();
      retainWorking = !!(pendingCandidate || invalidCandidate || guards.hasItemSession || guards.hasPeopleDraft) || !sameValue(working, approvedState(target.record.bill));
      return !retainWorking || next.recordRevision === target.record.recordRevision;
    } });
    if (!current(target, token)) return { status: "stale" };
    if (result.status === "loaded") {
      if (!retainWorking) {
        working = approvedState(result.bill);
        if (outcome !== "uncertain" || result.record.lastMutationId === pendingCandidate?.mutationId) {
          pendingCandidate = null;
          invalidCandidate = false;
        }
      }
      if (!pendingCandidate || outcome !== "uncertain") error = "";
      storageBlocked = false;
      notify("reconciled", { changed: true, message: result.message });
    } else if (!quiet) {
      if (result.status === "missing") markMissing(target.billId, result.message);
      else error = result.message;
      notify("error");
    }
    return result;
  }
  async function reconcile() {
    if (disposed || !session2) return;
    if (busyGuards()) {
      queued = true;
      return;
    }
    queued = false;
    const target = session2, token = generation;
    try {
      const latest = await repository2.read(target.billId);
      if (!current(target, token)) return;
      if (busyGuards()) {
        queued = true;
        return;
      }
      if (!latest) {
        markMissing(target.billId, "ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์");
        notify("error");
        return;
      }
      if (pendingCandidate && latest.lastMutationId === pendingCandidate.mutationId) {
        await confirmCandidate(pendingCandidate, target, token);
        return;
      }
      if (latest.recordRevision === target.record.recordRevision) {
        if (error && !pendingCandidate && !invalidCandidate) {
          error = "";
          storageBlocked = false;
          notify("reconciled", { changed: false });
        }
        return;
      }
      if (editGuards()) {
        error = "บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนบันทึก";
        outcome = "conflict";
        notify("error");
        return;
      }
      opening = true;
      notify("save-started");
      try {
        const next = createBillSession({ repository: repository2, billId: target.billId, sessionStorage: sessionStorage2 });
        const result = await next.load();
        if (!current(target, token)) return;
        if (getInteractionGuards().actionBusy || getInteractionGuards().nameBusy) {
          queued = true;
          return;
        }
        if (editGuards()) {
          error = "บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนบันทึก";
          outcome = "conflict";
          notify("error");
          return;
        }
        if (result.status === "loaded") {
          session2 = next;
          working = approvedState(result.bill);
          error = "";
          notify("reconciled", { changed: true, message: result.message });
        } else {
          if (result.status === "missing") markMissing(target.billId, result.message);
          else error = result.message;
          notify("error");
        }
      } finally {
        if (generation === token) {
          opening = false;
          notify("save-finished");
          if (queued) queueMicrotask(reconcile);
        }
      }
    } catch (caught) {
      if (current(target, token)) {
        error = caught.message;
        notify("error");
      }
    }
  }
  function confirmCandidate(staged, target, token) {
    if (confirmation?.staged === staged) return confirmation.promise;
    const job = { staged, promise: null };
    confirmation = job;
    job.promise = (async () => {
      try {
        const loaded = await target.load({ canAdopt: (latest) => current(target, token) && pendingCandidate === staged && latest.lastMutationId === staged.mutationId });
        if (!current(target, token) || pendingCandidate !== staged) return false;
        if (loaded.status === "loaded") {
          accept({ ...loaded, status: "saved" }, staged);
          notify("save-finished", { accepted: true, completedPeopleEdit: staged.peopleEdit });
          return true;
        }
        if (loaded.status === "missing") markMissing(staged.id, loaded.message);
        else {
          error = loaded.message;
          if (loaded.status === "conflict") outcome = "conflict";
        }
        notify("error");
        return false;
      } finally {
        if (confirmation === job) confirmation = null;
      }
    })();
    return job.promise;
  }
  async function finishOperation(operation, result) {
    if (pendingOperation !== operation || disposed) return false;
    pendingOperation = null;
    const selectedElsewhere = operation.kind === "delete" && session2 && session2.billId !== operation.id;
    let installed = false;
    if (operation.kind === "delete") {
      purgeBillWork(sessionStorage2, result.deletedId);
      if (!selectedElsewhere) {
        generation++;
        session2 = null;
        working = approvedState(emptyBill());
        storageBlocked = true;
        missingTarget = null;
        if (result.successor) installed = await open(result.successor.id, { reason: "deleted" });
        else {
          entryPhase = "attention";
          error = result.attention;
        }
      }
    } else if (result.record) {
      installed = await open(result.record.id, { reason: operation.kind === "startup" ? "startup" : "created" });
    }
    notify("operation-finished", { operation: clone5(operation), libraryOutcome: clone5(result), installed, selectedElsewhere });
    return installed || selectedElsewhere;
  }
  async function runLibraryOperation(operation, execute) {
    pendingOperation = operation;
    const token = generation;
    const holdsOpening = operation.kind === "create";
    if (holdsOpening) {
      opening = true;
      notify("save-started");
    }
    let result;
    try {
      result = await execute(operation);
      if (result) operation.outcome = result;
    } finally {
      if (generation === token && pendingOperation === operation && holdsOpening) {
        opening = false;
        notify("save-finished");
      }
    }
    if (pendingOperation !== operation || disposed) return result;
    if (result?.status === "reused") {
      pendingOperation = null;
      notify("save-finished");
      return { ...result, selectedElsewhere: generation !== token };
    }
    if (generation !== token && ["saved", "selected"].includes(result?.status)) {
      pendingOperation = null;
      if (operation.kind === "delete") purgeBillWork(sessionStorage2, result.deletedId);
      notify("operation-finished", { operation: clone5(operation), libraryOutcome: clone5(result), installed: false, selectedElsewhere: true });
      return result;
    }
    if (!result) {
      if (operation.outcome?.status !== "uncertain") pendingOperation = null;
      notify("save-finished");
      return null;
    }
    if (["saved", "selected"].includes(result.status)) {
      await finishOperation(operation, result);
      return result;
    }
    error = result.message;
    if (!session2) {
      entryPhase = result.status === "attention" ? "attention" : "unavailable";
      storageBlocked = true;
    }
    if (result.status === "conflict") pendingOperation = null;
    notify("error");
    return result;
  }
  async function retry() {
    if (uncertain2()) {
      const operation = pendingOperation;
      const result = await repository2.reconcileOperation(operation);
      if (pendingOperation !== operation) return false;
      operation.outcome = result;
      if (result.status === "saved") return finishOperation(operation, result);
      error = result.message;
      notify("error");
      return false;
    }
    const staged = pendingCandidate, target = session2, token = generation;
    if (!staged || !target) return false;
    const latest = await repository2.read(staged.id);
    if (!current(target, token) || pendingCandidate !== staged) return false;
    if (!latest) {
      markMissing(staged.id, "ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์");
      notify("error");
      return false;
    }
    if (latest.lastMutationId === staged.mutationId) {
      return confirmCandidate(staged, target, token);
    }
    if (latest.recordRevision !== staged.baseRevision) {
      error = "บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนบันทึก";
      outcome = "conflict";
      notify("error");
      return false;
    }
    const loaded = await target.load();
    if (!current(target, token) || loaded.status !== "loaded") return false;
    storageBlocked = false;
    return commit(staged.bill, staged);
  }
  return {
    getSnapshot,
    get billId() {
      return session2?.billId ?? null;
    },
    getRecoveryWorking: () => pendingCandidate ? overlayEdits(pendingCandidate.workingAtCommit, working, approvedState(pendingCandidate.bill)) : clone5(working),
    editWorking,
    open,
    commit,
    undo: () => moveHistory2("undo"),
    redo: () => moveHistory2("redo"),
    runLibraryOperation,
    retry,
    reconcile,
    refresh,
    waitForSave: () => savePromise ?? Promise.resolve(),
    reportInvalid(caught) {
      invalidCandidate = true;
      error = caught.message;
      notify("error");
    },
    releaseSheetCandidate(kind, billId) {
      if (pendingCandidate?.kind !== kind || pendingCandidate.id !== billId || saving || outcome === "uncertain") return;
      pendingCandidate = null;
      error = "";
      notify("save-finished");
    },
    reportEntryProblem(phase, message, id = null) {
      entryPhase = phase;
      error = message;
      storageBlocked = phase !== "loading";
      missingTarget = id;
      notify("error");
    },
    dispose() {
      disposed = true;
      generation++;
      openRequest++;
      queued = false;
    }
  };
}

// src/main-recovery.mjs
function createMainRecovery({
  getSnapshot,
  getWork,
  getName,
  readLibrary,
  readEvidence,
  retry,
  open,
  createCopy,
  selectBill,
  exportWork,
  downloadBill,
  startNew: startNew2,
  selectOther,
  connect,
  getConnectionError
}) {
  return async function recoveryModel2() {
    let snapshot2 = getSnapshot();
    const id = snapshot2.openingTarget?.id ?? snapshot2.billId ?? snapshot2.missingTarget;
    const { library, latest, readable } = await readLibrary(id);
    const uncertain2 = () => getSnapshot().pendingOperation?.outcome?.status === "uncertain";
    if (uncertain2()) {
      await retry();
      if (!uncertain2()) return null;
    }
    snapshot2 = getSnapshot();
    if (readable && snapshot2.record && snapshot2.pendingCandidate && latest?.lastMutationId === snapshot2.pendingCandidate.mutationId) {
      if (await retry()) return null;
    }
    if (snapshot2.openingTarget) {
      const captured = snapshot2.openingTarget;
      return { title: "ไม่สามารถเปิดบิลได้", message: "บิลที่เลือกยังเปิดไม่ได้ รายการในหน้านี้ยังอยู่", actions: [
        { label: "เปิดบิลที่เลือก", id: "reload-bill", run: () => open(captured.id, captured.targetView, { reason: captured.reason }) },
        ...snapshot2.record ? [{ label: "ดาวน์โหลดบิลในหน้านี้", id: "export-unsaved", run: exportWork }] : []
      ] };
    }
    const missing2 = readable && id && !latest;
    let candidate = null, name = getName();
    try {
      if (snapshot2.record) candidate = getWork();
    } catch {
    }
    if (!candidate && !snapshot2.record) {
      const recovered = await readEvidence(id);
      if (recovered) {
        candidate = recovered.bill;
        name = recovered.name ?? name;
      }
    }
    const actions2 = [];
    const add = (label, id2, run) => actions2.push({ label, id: id2, run });
    if (candidate && library && !uncertain2() && (missing2 || !snapshot2.record)) add("บันทึกเป็นบิลใหม่", "recover-copy", () => createCopy(candidate, name));
    if (snapshot2.record || candidate) add(candidate ? "ดาวน์โหลดบิล" : "ดาวน์โหลดรายการที่ยังกรอกไม่ครบ", "export-unsaved", () => {
      if (candidate) downloadBill(candidate, name);
      else exportWork();
    });
    if (library && !uncertain2()) {
      if (!snapshot2.record && latest) add("เปิดบิล", "recover-open", () => open(latest.id));
      if (snapshot2.record && latest && latest.recordRevision === snapshot2.record.recordRevision && snapshot2.pendingCandidate && snapshot2.outcome !== "uncertain") {
        add("บันทึกอีกครั้ง", "retry-save", retry);
      } else if (snapshot2.record && latest) add("เปิดบิลล่าสุด", "reload-bill", () => selectBill(snapshot2.billId));
      if (library.records.some((record) => record.id !== id)) add("เลือกบิลอื่น", "recover-select", selectOther);
      if (!snapshot2.record) add("สร้างบิลใหม่", "recover-new", () => startNew2(true));
      if (snapshot2.record && !readable) add("ลองเชื่อมต่ออีกครั้ง", "recover-connect", connect);
    } else if (uncertain2()) add("ลองตรวจสอบอีกครั้ง", "retry-operation", retry);
    else if (getConnectionError() !== "VersionError") add("ลองเชื่อมต่ออีกครั้ง", "recover-connect", connect);
    const conflict = readable && snapshot2.record && latest && latest.recordRevision !== snapshot2.record.recordRevision;
    return {
      title: missing2 ? candidate ? "ไม่พบข้อมูลบิลเดิม" : "ไม่สามารถเปิดบิลได้" : conflict ? "บิลมีการเปลี่ยนแปลง" : snapshot2.record ? "ไม่สามารถบันทึกบิลได้ขณะนี้" : "ไม่สามารถเปิดบิลได้",
      message: missing2 ? candidate ? "บันทึกรายการที่มีอยู่เป็นบิลใหม่เพื่อทำต่อ" : "ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์" : conflict ? "บิลถูกแก้ไขจากหน้าอื่น ดาวน์โหลดสิ่งที่แก้ไว้ก่อนเปิดบิลล่าสุด" : uncertain2() ? "ยังยืนยันการบันทึกไม่ได้ รายการที่มีอยู่ยังแสดงในหน้านี้" : candidate ? "ดาวน์โหลดบิลเพื่อบันทึกรายการที่มีอยู่ก่อนปิดหน้านี้" : "ไม่สามารถเข้าถึงข้อมูลบิลได้ขณะนี้",
      actions: actions2
    };
  };
}

// src/ui-theme.mjs
var colorRoles = {
  background: "--color-background",
  surface: "--color-surface",
  card: "--color-card",
  emphasis: "--color-orange-on-light",
  text: "--color-text",
  muted: "--color-text-muted",
  subdued: "--color-text-subdued",
  border: "--color-border",
  success: "--color-success",
  danger: "--color-danger",
  accentWash: "--color-accent-export-wash",
  sectionLabel: "--section-label-color"
};
function readUiTheme(root = document.documentElement) {
  const document2 = root.ownerDocument;
  const window2 = document2.defaultView;
  const style = window2.getComputedStyle(root);
  function required(token) {
    const value = style.getPropertyValue(token).trim();
    if (!value) throw Error("ไม่พบค่าธีม " + token);
    return value;
  }
  const colors = {};
  const fonts = Object.fromEntries(["body", "mono", "heading", "brand"].map(
    (role) => [role, required("--font-" + role)]
  ));
  const probe = document2.createElement("span");
  probe.hidden = true;
  root.append(probe);
  try {
    for (const [role, token] of Object.entries(colorRoles)) {
      const value = required(token);
      if (!window2.CSS.supports("color", value)) throw Error("ค่าสีธีมไม่ถูกต้อง " + token);
      probe.style.color = value;
      colors[role] = window2.getComputedStyle(probe).color;
    }
  } finally {
    probe.remove();
  }
  return { colors, fonts };
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
var clone3 = (value) => structuredClone(value);
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
async function openBillRepository({ indexedDB = globalThis.indexedDB, developmentStorage: developmentStorage2, clock = Date.now } = {}) {
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
          const reason = !initialized?.value && sourceAttention(developmentStorage2);
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
              reason = args.createReplacement ? "" : damaged.length ? "บิลที่เหลือเปิดไม่ได้ ตรวจสอบข้อมูลเดิม" : !initialized?.value && sourceAttention(developmentStorage2);
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
      return raw ? clone3(checkRecord(raw)) : null;
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

// src/backup-file.mjs
function decodeBillFile(raw) {
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw Error("เปิดไฟล์นี้ไม่ได้ เลือกไฟล์สำรองที่ดาวน์โหลดจาก หารจ่ายแฟร์ๆ");
  }
  if (value?.format != null) {
    if (value.format !== "fairshare-bill" || value.version !== 1) throw Error("รุ่นไฟล์บิลไม่รองรับ");
    return { name: billName(value.name), bill: admittedBill(value.bill) };
  }
  return { name: null, bill: admittedBill(value) };
}
async function readBillFile(file) {
  if (file.size > 1e7) throw Error("ไฟล์ใหญ่เกินไป เลือกไฟล์สำรองขนาดไม่เกิน 10 MB");
  let raw;
  try {
    raw = await file.text();
  } catch {
    throw Error("อ่านไฟล์นี้ไม่ได้ ลองเลือกไฟล์อีกครั้ง");
  }
  return decodeBillFile(raw);
}
function encodeBillFile({ name, bill }) {
  return JSON.stringify({ format: "fairshare-bill", version: 1, name: billName(name), bill: admittedBill(bill) }, null, 2);
}
function billFilename(name, extension = "json") {
  return "หารจ่ายแฟร์ๆ-" + name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 100) + "-" + (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) + "." + extension;
}
function validateApprovedBackup(raw) {
  return decodeBillFile(raw).bill;
}

// src/summary-image.mjs
async function downloadSummaryImage(capture, toast2) {
  const state = approvedState(capture.bill);
  const totals = approvedBillTotals(state, capture.bill);
  const hasPersonWarning = (pid) => getPersonWarning(pid, state, totals);
  const itemShares = (item) => approvedShares(item);
  if (!totals || !state.people.length) {
    toast2("ยังไม่มีข้อมูลสรุป");
    return;
  }
  await document.fonts.ready;
  const { colors, fonts } = readUiTheme();
  const billTitleFont = `600 18px ${fonts.body.replace(/,\s*sans-serif$/, "")}`;
  const DPR = Math.min(window.devicePixelRatio || 2, 3);
  const CW = 800, PAD = 32, CP = 20, GAP = 10, LH = 28, ILH = 25, CR = 12, FTR_H = 64, SLH = 36;
  const titleCanvas = document.createElement("canvas"), titleCtx = titleCanvas.getContext("2d");
  titleCtx.font = billTitleFont;
  const titleLines = [];
  let titleLine = "";
  for (const character of capture.name) {
    if (titleCtx.measureText(titleLine + character).width > CW - PAD * 2 && titleLine) {
      titleLines.push(titleLine);
      titleLine = "";
    }
    titleLine += character;
  }
  titleLines.push(titleLine);
  const HDR_H = 90 + titleLines.length * 28;
  const INNER = CW - PAD * 2;
  function personCardHeight(p) {
    const items = state.items.filter((it) => it.assignments.some((a) => a.personId === p.id));
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
  state.people.forEach((p) => {
    if (totals.pt[p.id]) TH += personCardHeight(p) + GAP;
  });
  TH += 16 + SLH + billCardHeight() + GAP + PAD + FTR_H;
  const canvas = document.createElement("canvas");
  canvas.width = CW * DPR;
  canvas.height = TH * DPR;
  const ctx = canvas.getContext("2d");
  ctx.scale(DPR, DPR);
  function drawRoundedRect(x, y2, w, h, r) {
    const rs = typeof r === "number" ? [r, r, r, r] : r;
    const [tl, tr, br, bl] = rs;
    ctx.beginPath();
    ctx.moveTo(x + tl, y2);
    ctx.lineTo(x + w - tr, y2);
    ctx.quadraticCurveTo(x + w, y2, x + w, y2 + tr);
    ctx.lineTo(x + w, y2 + h - br);
    ctx.quadraticCurveTo(x + w, y2 + h, x + w - br, y2 + h);
    ctx.lineTo(x + bl, y2 + h);
    ctx.quadraticCurveTo(x, y2 + h, x, y2 + h - bl);
    ctx.lineTo(x, y2 + tl);
    ctx.quadraticCurveTo(x, y2, x + tl, y2);
    ctx.closePath();
  }
  function drawLine(yy, x1 = PAD + CP, x2 = CW - PAD - CP) {
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, yy);
    ctx.lineTo(x2, yy);
    ctx.stroke();
  }
  function drawText(text2, x, yy, font, color, align = "left") {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(text2, x, yy);
    ctx.textAlign = "left";
  }
  function truncateText(text2, maxW) {
    if (ctx.measureText(text2).width <= maxW) return text2;
    let s = text2;
    while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
    return s + "…";
  }
  function drawBillRow(lbl, val, y2, vc, fontSize, yOff) {
    drawText(lbl, PAD + CP, y2 + LH - yOff, `400 ${fontSize} ${fonts.body}`, colors.muted);
    drawText(val, CW - PAD - CP, y2 + LH - yOff, `500 ${fontSize} ${fonts.body}`, vc, "right");
    return y2 + LH;
  }
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, CW, TH);
  ctx.fillStyle = colors.surface;
  ctx.fillRect(0, 0, CW, HDR_H);
  drawLine(HDR_H, 0, CW);
  ctx.font = `400 18px ${fonts.heading}`;
  ctx.fillStyle = colors.muted;
  ctx.fillText("หารจ่าย", PAD, 56);
  const preW = ctx.measureText("หารจ่าย").width;
  drawText("แฟร์ๆ", PAD + preW + 5, 60, `800 36px ${fonts.brand}`, colors.emphasis);
  const now = /* @__PURE__ */ new Date();
  const dStr = now.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }) + " " + now.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit"
  });
  drawText(dStr, CW - PAD, 56, `400 12px ${fonts.body}`, colors.subdued, "right");
  titleLines.forEach((line, index) => drawText(line, PAD, 96 + index * 28, billTitleFont, colors.text));
  let y = HDR_H + PAD;
  drawText("ยอดรวมรายคน", PAD, y + 20, `700 11px ${fonts.body}`, colors.sectionLabel);
  y += SLH;
  state.people.forEach((p) => {
    const pt = totals.pt[p.id];
    if (!pt) return;
    const items = state.items.filter((it) => it.assignments.some((a) => a.personId === p.id));
    const cH = personCardHeight(p);
    const neg = pt.total < 0;
    const hw = hasPersonWarning(p.id);
    drawRoundedRect(PAD, y, INNER, cH, CR);
    ctx.fillStyle = colors.card;
    ctx.fill();
    drawRoundedRect(PAD, y, INNER, cH, CR);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    let cy = y + CP;
    const pNameDisp = truncateText((hw ? "⚠ " : "") + p.name, INNER - CP * 2 - 180);
    drawText(pNameDisp, PAD + CP, cy + 28, `700 16px ${fonts.body}`, hw ? colors.danger : colors.text);
    drawText(fmt(pt.total), CW - PAD - CP, cy + 30, `700 20px ${fonts.body}`, neg ? colors.danger : colors.emphasis, "right");
    cy += 44;
    if (items.length) {
      drawLine(cy);
      cy += 8;
      items.forEach((it) => {
        const d = itemShares(it)[p.id] || {
          amount: 0
        };
        const nm = truncateText(it.name || "ไม่มีชื่อเมนู", INNER - CP * 2 - 160);
        drawText(nm, PAD + CP + 12, cy + 17, `400 13px ${fonts.body}`, colors.text);
        drawText(fmt(d.amount), CW - PAD - CP, cy + 17, `400 13px ${fonts.body}`, colors.muted, "right");
        cy += ILH;
      });
      cy += 12;
      drawLine(cy);
      cy = drawBillRow("ยอดรวมย่อย", fmt(pt.subtotal), cy, colors.text, "13px", 7);
      if (state.service.enabled) cy = drawBillRow(`Service Charge (${displayRate(state.service.value)}%)`, `+${fmt(pt.service)}`, cy, colors.text, "13px", 7);
      if (state.tax.enabled) cy = drawBillRow(`VAT (${displayRate(state.tax.value)}%)`, `+${fmt(pt.vat)}`, cy, colors.text, "13px", 7);
      if (totals.D > 0) cy = drawBillRow("ส่วนลด", `−${fmt(pt.discount)}`, cy, colors.success, "13px", 7);
      cy += 8;
      drawLine(cy);
      drawRoundedRect(PAD, y + cH - (44 + CP), INNER, 44 + CP, [0, 0, CR, CR]);
      ctx.fillStyle = colors.accentWash;
      ctx.fill();
      drawText("ยอดรวม", PAD + CP, cy + 30, `600 14px ${fonts.body}`, colors.muted);
      drawText(fmt(pt.total), CW - PAD - CP, cy + 32, `700 20px ${fonts.body}`, neg ? colors.danger : colors.emphasis, "right");
    } else {
      drawText("⚠ ยังไม่ได้เลือกเมนูใด", PAD + CP, cy + 22, `400 13px ${fonts.body}`, colors.danger);
    }
    y += cH + GAP;
  });
  y += 16;
  drawText("ยอดรวมบิล", PAD, y + 20, `700 11px ${fonts.body}`, colors.sectionLabel);
  y += SLH;
  const bcH = billCardHeight();
  drawRoundedRect(PAD, y, INNER, bcH, CR);
  ctx.fillStyle = colors.card;
  ctx.fill();
  drawRoundedRect(PAD, y, INNER, bcH, CR);
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.stroke();
  let by = y + CP;
  by = drawBillRow("ยอดรวมย่อย", fmt(totals.Sb), by, colors.text, "14px", 6);
  if (state.service.enabled) by = drawBillRow(`Service Charge (${displayRate(state.service.value)}%)`, `+${fmt(totals.svcAmt)}`, by, colors.text, "14px", 6);
  if (state.tax.enabled) by = drawBillRow(`VAT (${displayRate(state.tax.value)}%)`, `+${fmt(totals.vatAmt)}`, by, colors.text, "14px", 6);
  if (totals.D > 0) by = drawBillRow("ส่วนลด", `−${fmt(totals.D)}`, by, colors.success, "14px", 6);
  by += 8;
  drawLine(by);
  drawRoundedRect(PAD, y + bcH - (44 + CP), INNER, 44 + CP, [0, 0, CR, CR]);
  ctx.fillStyle = colors.accentWash;
  ctx.fill();
  drawText("ยอดที่ต้องจ่าย", PAD + CP, by + 30, `600 14px ${fonts.body}`, colors.muted);
  drawText(fmt(totals.grand), CW - PAD - CP, by + 34, `700 22px ${fonts.body}`, colors.emphasis, "right");
  y += bcH + PAD;
  drawText("หารจ่าย แฟร์ๆ", CW / 2, y + 22, `600 13px ${fonts.body}`, colors.subdued, "center");
  drawText("UX Design by Map Tharit Banchanurat", CW / 2, y + 40, `400 11px ${fonts.body}`, colors.subdued, "center");
  await new Promise((resolve) => canvas.toBlob((blob) => {
    try {
      if (!blob) {
        toast2("สร้างรูปภาพไม่ได้ ลองดาวน์โหลดอีกครั้ง");
        return;
      }
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url;
      a.download = billFilename(capture.name, "jpg");
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 1e3);
      toast2("เริ่มดาวน์โหลดแล้ว");
    } catch (error) {
      toast2("เริ่มดาวน์โหลดไม่ได้ ลองอีกครั้ง: " + error.message);
    } finally {
      resolve();
    }
  }, "image/jpeg", 0.92));
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
function showSheet({ title, body = "", actions: actions2 = [], className = "", fallback, mount, restoreFocus = true, hasUnsavedChanges }, parent = null) {
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
    for (const action of actions2) {
      const button2 = document.createElement("button");
      button2.type = "button";
      button2.textContent = action.label;
      button2.className = action.className || "";
      if (action.id) button2.id = action.id;
      if (action.data) Object.assign(button2.dataset, action.data);
      button2.disabled = !!action.disabled;
      button2.addEventListener("click", async () => {
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
      footer.append(button2);
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
  const button2 = document.createElement("button");
  button2.type = "button";
  button2.className = "recovery-status";
  button2.hidden = true;
  button2.setAttribute("aria-haspopup", "dialog");
  document.body.append(button2);
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
    button2.style.bottom = bar ? Math.max(12, innerHeight - bar.getBoundingClientRect().top + 12) + "px" : "";
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
    button2.hidden = !key;
    button2.textContent = label;
    if (key) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    }
    if (key) scheduleShow();
  }
  button2.onclick = () => void show(true);
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
    button2.remove();
  } };
}

// src/bill-controls.mjs
var dateFormat = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" });
var actions = [
  ["new", "btn-newbill", "สร้างบิลใหม่"],
  ["select", "select-bill", "เลือกบิล"],
  ["details", "bill-details", "รายละเอียดบิล"],
  ["import", "restore-bill", "นำเข้าบิลจากไฟล์"],
  ["download", "backup-bill", "ดาวน์โหลดไฟล์บิลนี้"],
  ["people", "clear-people", "ลบรายชื่อคนทั้งหมด"],
  ["dishes", "clear-dishes", "ลบเมนูอาหารทั้งหมด"],
  ["delete", "delete-bill", "ลบบิลนี้"]
];
function element(tag, content2) {
  const node = document.createElement(tag);
  if (content2 != null) node.textContent = content2;
  return node;
}
function button(content2) {
  const node = element("button", content2);
  node.type = "button";
  return node;
}
function saveResult(outcome) {
  if (!["saved", "unchanged"].includes(outcome.status)) throw Error(outcome.message || "ยังไม่ได้บันทึก ลองอีกครั้ง");
  return outcome.record;
}
function createBillControls({ repository: repository2, selector: selector2, actionsButton: actionsButton2, getContext, bindAction, onSelect, onAction, onInspect, onRequestImport, onDownload, onError }) {
  let active2 = null, keyboard = false, interaction = 0;
  const lifetime = new AbortController(), events2 = { capture: true, signal: lifetime.signal };
  const row = selector2.closest("#bill-context");
  document.addEventListener("pointerdown", (event) => {
    keyboard = false;
    interaction++;
    if (event.target.closest?.("#bill-selector-name")) close();
  }, events2);
  document.addEventListener("keydown", (event) => {
    interaction++;
    if (!event.metaKey && !event.ctrlKey && !event.altKey) keyboard = true;
  }, events2);
  row.addEventListener("focusin", (event) => {
    if (event.target.id === "bill-selector-name") close();
  }, { signal: lifetime.signal });
  function fallback() {
    if (!actionsButton2.disabled && actionsButton2.getClientRects().length) return actionsButton2;
    const heading = document.getElementById("hdr-title");
    heading.tabIndex = -1;
    return heading;
  }
  function close({ restoreFocus = false } = {}) {
    if (!active2) return;
    const { trigger, panel, backdrop, scope, observer, frame } = active2;
    active2 = null;
    scope.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
    panel.remove();
    backdrop.remove();
    trigger.setAttribute("aria-expanded", "false");
    row.classList.remove("bill-panel-open");
    if (restoreFocus && keyboard && trigger.getClientRects().length) trigger.focus({ preventScroll: true });
    else if (document.activeElement === trigger) trigger.blur();
  }
  function mountPanel(trigger, id) {
    if (active2?.trigger === trigger) {
      close({ restoreFocus: true });
      return null;
    }
    close();
    const panel = element("div"), backdrop = element("div");
    panel.id = id;
    panel.className = "bill-panel";
    panel.tabIndex = -1;
    backdrop.className = "bill-panel-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    const scope = new AbortController(), signal = scope.signal;
    const anchor = trigger === selector2 ? selector2.closest("#bill-name-control") : trigger;
    const popup = { trigger, panel, backdrop, scope, frame: 0, anchor: null, keyboard };
    active2 = popup;
    row.classList.add("bill-panel-open");
    trigger.setAttribute("aria-expanded", "true");
    document.body.append(backdrop, panel);
    function place() {
      if (active2 !== popup) return;
      const r = anchor.getBoundingClientRect(), bounds = row.getBoundingClientRect(), v = window.visualViewport;
      const safe = getComputedStyle(backdrop);
      const left = (v?.offsetLeft ?? 0) + Math.max(8, parseFloat(safe.paddingLeft));
      const right = (v?.offsetLeft ?? 0) + (v?.width ?? innerWidth) - Math.max(8, parseFloat(safe.paddingRight));
      const top = (v?.offsetTop ?? 0) + Math.max(8, parseFloat(safe.paddingTop));
      const bottom = (v?.offsetTop ?? 0) + (v?.height ?? innerHeight) - Math.max(8, parseFloat(safe.paddingBottom));
      const tabs = document.getElementById("top-tabs").getBoundingClientRect();
      if (!r.width || r.bottom <= Math.max(top, tabs.bottom) || r.top >= bottom || r.right <= left || r.left >= right) {
        close();
        return;
      }
      panel.style.width = "max-content";
      const width = Math.max(0, Math.min(trigger === selector2 ? r.width : panel.getBoundingClientRect().width, bounds.width, right - left));
      panel.style.width = width + "px";
      panel.style.left = Math.max(left, Math.min(trigger === selector2 ? r.left : r.right - width, right - width)) + "px";
      const below = bottom - r.bottom - 4, above = r.top - top - 4;
      const preferBelow = below >= panel.scrollHeight || below >= above;
      const height = Math.max(0, preferBelow ? below : above);
      panel.style.maxHeight = height + "px";
      panel.style.top = (preferBelow ? r.bottom + 4 : r.top - 4 - panel.offsetHeight) + "px";
      popup.anchor = r;
    }
    function schedule() {
      cancelAnimationFrame(popup.frame);
      popup.frame = requestAnimationFrame(place);
    }
    function focusOption(node) {
      if (!node) return;
      node.focus({ preventScroll: true });
      const a = node.getBoundingClientRect(), b = panel.getBoundingClientRect();
      if (a.bottom > b.bottom) panel.scrollTop += a.bottom - b.bottom;
      else if (a.top < b.top) panel.scrollTop += a.top - b.top;
    }
    function scrolled(event) {
      if (panel.contains(event.target)) return;
      const r = anchor.getBoundingClientRect(), old = popup.anchor;
      if (old && (Math.abs(r.left - old.left) > 0.5 || Math.abs(r.top - old.top) > 0.5)) close();
      else schedule();
    }
    popup.observer = new ResizeObserver(schedule);
    popup.observer.observe(trigger);
    popup.observer.observe(row);
    popup.observer.observe(panel);
    backdrop.addEventListener("click", () => close(), { signal });
    document.addEventListener("scroll", scrolled, { capture: true, passive: true, signal });
    window.addEventListener("resize", schedule, { signal });
    window.visualViewport?.addEventListener("resize", schedule, { signal });
    window.visualViewport?.addEventListener("scroll", schedule, { signal });
    document.fonts?.addEventListener("loadingdone", schedule, { signal });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        close({ restoreFocus: true });
        return;
      }
      if (event.key === "Tab") {
        close({ restoreFocus: true });
        return;
      }
      if (!panel.contains(event.target) && event.target !== trigger && event.target !== document.body || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const items = [...panel.querySelectorAll("button:not(:disabled)")];
      if (!items.length) return;
      event.preventDefault();
      const index = items.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : index < 0 ? event.key === "ArrowDown" ? 0 : items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      focusOption(items[next]);
    }, { capture: true, signal });
    return Object.assign(popup, { place, focusOption });
  }
  function openSelector() {
    const popup = mountPanel(selector2, "bill-selection-panel");
    if (!popup) return;
    popup.panel.append(element("p", "กำลังเปิดรายการบิล…"));
    popup.place();
    if (active2 === popup) void populateSelector(popup);
  }
  async function populateSelector(popup) {
    const { panel, place, focusOption } = popup;
    try {
      const { records, damaged } = await repository2.list();
      if (active2 !== popup) return;
      const list = element("div");
      list.id = "bill-selection-list";
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", "บิลที่บันทึกไว้");
      const current = getContext().record?.id;
      const entries = records.map((record) => {
        const bill = record.bill;
        const meta = dateFormat.format(record.updatedAt) + " · " + bill.people.length + " คน · " + bill.items.length + " เมนู · " + money(calculate(bill).grand) + " บาท";
        return { record, meta, key: JSON.stringify([record.name, meta]) };
      });
      const counts = /* @__PURE__ */ new Map();
      for (const { key } of entries) counts.set(key, (counts.get(key) ?? 0) + 1);
      for (const { record, meta, key } of entries) {
        const option = button();
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(record.id === current));
        option.tabIndex = -1;
        option.dataset.billId = record.id;
        option.append(element("strong", record.name + (record.id === current ? " (กำลังเปิด)" : "")), element("small", meta + (counts.get(key) > 1 ? " · " + record.id.slice(0, 8) : "")));
        bindAction(option, () => {
          if (active2 !== popup) return;
          close({ restoreFocus: true });
          if (record.id !== getContext().record?.id) return onSelect(record.id);
        });
        list.append(option);
      }
      panel.replaceChildren(list);
      if (!records.length) panel.append(element("p", "ยังไม่มีบิลที่เปิดได้"));
      if (damaged.length) {
        const unavailable = element("section");
        unavailable.setAttribute("aria-label", "บิลที่เปิดไม่ได้");
        unavailable.append(element("p", "บิลที่เปิดไม่ได้"));
        for (const { id, raw } of damaged) {
          const inspect = button("ตรวจสอบ " + (typeof raw.name === "string" && raw.name.trim() ? raw.name : "บิลที่เปิดไม่ได้"));
          inspect.tabIndex = -1;
          bindAction(inspect, () => {
            if (active2 !== popup) return;
            close({ restoreFocus: true });
            return onInspect(id);
          });
          unavailable.append(inspect);
        }
        panel.append(unavailable);
      }
      place();
      if (active2 === popup && popup.keyboard && keyboard) focusOption(list.querySelector("[aria-selected=true]") ?? panel.querySelector("button") ?? panel);
    } catch (error) {
      if (active2 === popup) {
        close({ restoreFocus: true });
        onError(error.message);
      }
    }
  }
  function disabled(kind, context) {
    if (kind === "new" || kind === "import") return context.mutationBlocked;
    if (!context.record) return true;
    if (["download", "details", "select"].includes(kind)) return false;
    if (kind === "delete" && active2?.deleteProtected) return true;
    return context.mutationBlocked || kind === "people" && !context.canClearPeople || kind === "dishes" && !context.canClearDishes;
  }
  function openActions() {
    const popup = mountPanel(actionsButton2, "bill-actions-menu");
    if (!popup) return;
    const { panel, place, focusOption } = popup;
    panel.setAttribute("role", "menu");
    panel.setAttribute("aria-labelledby", "bill-actions");
    for (const [kind, id, label] of actions) {
      if (kind === "import" || kind === "people") {
        const divider = element("div");
        divider.setAttribute("role", "separator");
        panel.append(divider);
      }
      const item = button(label);
      item.id = id;
      item.dataset.billAction = kind;
      item.setAttribute("role", "menuitem");
      item.tabIndex = -1;
      if (["people", "dishes", "delete"].includes(kind)) item.className = "danger-action";
      const target = getContext().record;
      if (kind === "import") item.onclick = () => {
        close({ restoreFocus: true });
        onRequestImport();
      };
      else bindAction(item, () => {
        if (active2 !== popup) return;
        close({ restoreFocus: true });
        return kind === "select" ? openSelector() : onAction(kind, target);
      });
      panel.append(item);
    }
    popup.deleteProtected = true;
    void repository2.list().then((library) => {
      if (active2 !== popup) return;
      popup.deleteProtected = isProtectedDefault(getContext().record, library);
      refresh();
    }).catch((error) => {
      if (active2 === popup) onError(error.message);
    });
    refresh();
    place();
    if (active2 === popup && popup.keyboard && keyboard) focusOption(panel.querySelector("button:not(:disabled)") ?? panel);
  }
  function refresh(context = getContext()) {
    selector2.disabled = !context.available;
    actionsButton2.disabled = !context.available;
    actionsButton2.setAttribute("aria-label", context.record ? "ตัวเลือกบิล " + context.record.name : "ตัวเลือกบิล");
    if (active2?.trigger === actionsButton2) {
      for (const item of active2.panel.querySelectorAll("[data-bill-action]")) item.disabled = disabled(item.dataset.billAction, context);
    }
  }
  function nameField(host, name) {
    const label = element("label", "ชื่อบิล"), input = element("input");
    label.htmlFor = "bill-name";
    input.id = "bill-name";
    input.name = "bill-name";
    input.type = "text";
    input.autocomplete = "off";
    input.value = name;
    host.body.prepend(label, input);
    return input;
  }
  function enteredName(input) {
    try {
      const name = billName(input.value);
      input.removeAttribute("aria-invalid");
      return name;
    } catch (error) {
      input.setAttribute("aria-invalid", "true");
      throw error;
    }
  }
  const cancel = { label: "ยกเลิก", value: false };
  const replaceLabel = "ลบบิลเดิมและสร้างบิลใหม่";
  function chooseNew(target) {
    return openSheet({
      title: "สร้างบิลใหม่",
      className: "new-bill-sheet",
      fallback,
      mount: (host) => {
        setSheetText(host.body, ["บิล ", customName(target.name), " บันทึกอัตโนมัติในเบราว์เซอร์นี้แล้ว สามารถเปิดอีกครั้งได้จากปุ่ม ", customName("เลือกบิล")]);
      },
      actions: [
        { label: "บันทึกและสร้างบิลใหม่", value: "save", className: "sheet-primary" },
        { label: replaceLabel, value: "delete", className: "sheet-danger" },
        cancel
      ]
    });
  }
  async function confirmDelete2(target, operation, { canReuse = () => false } = {}) {
    let captured = target;
    if (!operation.createReplacement && isProtectedDefault(target, await repository2.list())) return null;
    if (!operation.createReplacement && isEmptyBillContent(captured.bill)) {
      const outcome = operation.outcome = await repository2.removeAndSelect({ ...operation, expectedRevision: captured.recordRevision });
      if (outcome.status === "saved") return outcome;
      if (outcome.status === "conflict" && outcome.record && !isEmptyBillContent(outcome.record.bill)) captured = outcome.record;
      else {
        onError(outcome.message);
        return null;
      }
    }
    const title = () => operation.createReplacement ? replaceLabel + "?" : ["ลบบิล ", customName(captured.name), " ใช่ไหม?"];
    function explain(host) {
      const body = operation.createReplacement ? ["บิล ", customName(captured.name), " และข้อมูลทั้งหมดในบิลนี้จะถูกลบก่อนที่จะสร้างบิลใหม่"] : "บิลนี้ รวมถึงรายชื่อ " + captured.bill.people.length + " คน เมนู " + captured.bill.items.length + " รายการ และข้อมูลการหารจ่ายจะถูกลบ บิลอื่นและไฟล์ที่ดาวน์โหลดไว้จะยังอยู่";
      setSheetText(host.body, body);
      const warning = element("span", "(ไม่สามารถย้อนกลับได้)");
      warning.className = "sheet-irreversible";
      host.heading.append(warning);
    }
    return openSheet({
      title: title(),
      fallback,
      mount: explain,
      actions: [cancel, { label: operation.createReplacement ? "ลบและสร้างบิลใหม่" : "ลบบิลนี้", className: "sheet-danger", run: async (host) => {
        const outcome = operation.outcome?.status === "uncertain" ? await repository2.reconcileOperation(operation) : await repository2.removeAndSelect({ ...operation, expectedRevision: captured.recordRevision, allowReuse: canReuse() });
        operation.outcome = outcome;
        if (outcome.status === "conflict" && outcome.record) {
          captured = outcome.record;
          host.setTitle(title());
          explain(host);
          throw Error("บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดแล้วกด" + (operation.createReplacement ? "ลบและสร้างบิลใหม่" : "ลบบิลนี้") + "อีกครั้ง");
        }
        if (outcome.status === "missing") host.footer.querySelector(".sheet-danger").disabled = true;
        if (outcome.status === "uncertain") host.footer.querySelector(".sheet-danger").textContent = "ตรวจสอบการลบ";
        if (!["saved", "reused"].includes(outcome.status)) throw Error(outcome.message);
        return outcome;
      } }]
    });
  }
  async function importFile({ name, bill }, filename, operation) {
    let input;
    return openSheet({ title: "นำเข้าบิลจากไฟล์", fallback, mount: (host) => {
      input = nameField(host, name ?? (filename.replace(/\.[^.]*$/, "") || "บิลนำเข้า"));
      host.body.append(element("p", bill.people.length + " คน · " + bill.items.length + " เมนู · " + money(calculate(bill).grand) + " บาท"));
    }, actions: [cancel, { label: "เพิ่มเป็นบิลใหม่", className: "sheet-primary", run: async (host) => {
      const outcome = operation.outcome?.status === "uncertain" ? await repository2.reconcileOperation(operation) : await repository2.create({ ...operation, name: enteredName(input), bill: { ...bill, undo: null } });
      operation.outcome = outcome;
      if (outcome.status === "uncertain") {
        input.disabled = true;
        host.footer.querySelector(".sheet-primary").textContent = "ตรวจสอบการบันทึก";
      }
      return saveResult(outcome);
    } }] });
  }
  async function details(target) {
    return openSheet({ title: "รายละเอียดบิล", className: "bill-details-sheet", fallback, actions: [{ label: "ปิด" }], mount: (host) => {
      const facts = element("dl"), notice = element("p"), refreshButton = button("เปิดข้อมูลล่าสุด");
      notice.setAttribute("role", "status");
      refreshButton.hidden = true;
      const note = element("p", "บิลบันทึกอัตโนมัติในเบราว์เซอร์นี้ หากล้างข้อมูลเบราว์เซอร์ ข้อมูลบิลอาจหายไป กดปุ่ม “ดาวน์โหลดไฟล์บิลนี้” เพื่อสำรองหรือย้ายเครื่อง");
      host.body.append(facts, notice, refreshButton, note);
      let snapshot2 = target, generation = 0;
      function show(record) {
        const bill = record.bill, { grand, unallocated } = calculate(bill);
        facts.replaceChildren();
        for (const [label, value] of [
          ["ชื่อบิล", record.name],
          ["สร้างเมื่อ", dateFormat.format(record.createdAt)],
          ["แก้ไขล่าสุด", dateFormat.format(record.updatedAt)],
          ["รายชื่อคน", bill.people.length + " คน"],
          ["เมนูอาหาร", bill.items.length + " เมนู"],
          ["ยอดที่ต้องจ่าย", money(grand) + " บาท"],
          ["ยังแบ่งจ่ายไม่ครบ", money(unallocated) + " บาท"]
        ]) facts.append(element("dt", label), element("dd", value));
      }
      show(snapshot2);
      const scope = new AbortController(), signal = scope.signal;
      async function check(refresh2 = false) {
        const token = ++generation;
        try {
          const next = await repository2.read(target.id);
          if (signal.aborted || token !== generation) return;
          if (!next) throw Error("ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์");
          if (refresh2) {
            snapshot2 = next;
            show(next);
          }
          refreshButton.hidden = next.recordRevision === snapshot2.recordRevision;
          notice.textContent = refreshButton.hidden ? "" : "บิลนี้มีการเปลี่ยนแปลง เปิดข้อมูลล่าสุดเพื่อดูรายละเอียดใหม่";
        } catch (error) {
          if (signal.aborted || token !== generation) return;
          facts.replaceChildren();
          notice.textContent = error.message;
          refreshButton.hidden = false;
        }
      }
      const checkChange = () => check();
      refreshButton.onclick = () => check(true);
      window.addEventListener("focus", checkChange, { signal });
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) check();
      }, { signal });
      let channel;
      try {
        channel = new BroadcastChannel("fairshare-library");
        channel.addEventListener("message", (event) => {
          if (event.data?.id === target.id) check();
        }, { signal });
      } catch {
      }
      check();
      return () => {
        scope.abort();
        channel?.close();
      };
    } });
  }
  async function evidence({ sources, unavailable }) {
    return openSheet({ title: "ตรวจสอบข้อมูลเดิม", fallback, actions: [{ label: "ปิด" }], mount: (host) => {
      if (!sources.length) host.body.append(element("p", "ไม่พบข้อมูลเดิมที่ดาวน์โหลดได้"));
      sources.forEach((source, index) => {
        const section = element("section"), label = element("p", source.label), download = button("ดาวน์โหลดข้อมูลเดิม");
        section.className = "bill-evidence-source";
        download.onclick = () => onDownload({ text: source.raw, filename: "หารจ่ายแฟร์ๆ-evidence-" + (index + 1) + ".json" });
        section.append(label, download);
        if (source.candidate && getContext().available && !getContext().mutationBlocked) {
          const copy3 = button("ตรวจสอบและเพิ่มเป็นบิลใหม่");
          copy3.onclick = () => host.finish(source.candidate);
          section.append(copy3);
        }
        host.body.append(section);
      });
      if (unavailable.length) host.body.append(element("p", "เปิดข้อมูลบางส่วนไม่ได้: " + unavailable.join(", ")));
    } });
  }
  return { openSelector, openActions, close, refresh, get keyboard() {
    return keyboard;
  }, get interaction() {
    return interaction;
  }, dispose: () => {
    close();
    lifetime.abort();
  }, chooseNew, confirmDelete: confirmDelete2, importFile, details, evidence };
}

// src/bill-name-editor.mjs
function createBillNameEditor({ input, feedback, getContext, repository: repository2, onSaved, onStateChange = () => {
} }) {
  let target = null, pending = null, problem = "", uncertain2 = false, mutationId = null, refreshRecord = null, composing = false, selectOnPointerUp = false;
  const scope = new AbortController(), options = { signal: scope.signal };
  const dirty = () => !!refreshRecord || !!target && (input.value !== target.name || uncertain2);
  function show(message = "") {
    problem = message;
    feedback.hidden = !message;
    const recovery2 = uncertain2 || refreshRecord ? "แตะชื่อบิลหรือกด Enter เพื่อตรวจสอบอีกครั้ง" : "กด Enter เพื่อลองอีกครั้ง";
    feedback.querySelector("[role=alert]").textContent = message ? message + " · " + recovery2 : "";
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }
  function refresh(context = getContext()) {
    if (!target && !pending && !refreshRecord) input.value = context.record?.name ?? "";
    input.disabled = !context.available || !context.record || !!context.mutationBlocked;
    input.readOnly = uncertain2 || !!refreshRecord;
    input.toggleAttribute("data-unsaved", dirty());
    onStateChange({ busy: !!pending, problem: !!problem }, context);
  }
  function cancelEdit() {
    if (pending || uncertain2 || refreshRecord) return;
    const captured = target;
    target = null;
    show();
    if (captured && captured.recordRevision !== getContext().record?.recordRevision) {
      refreshRecord = captured;
      input.value = captured.name;
      void settle({ retry: true });
    }
    refresh();
    input.blur();
  }
  async function write() {
    try {
      if (!refreshRecord) {
        const change = input.value.trim() ? { kind: "rename", name: billName(input.value) } : { kind: "rename-default" };
        const outcome = uncertain2 ? await repository2.reconcileOperation({ id: target.id, mutationId }) : await repository2.write({ id: target.id, expectedRevision: target.recordRevision, mutationId: mutationId ??= newId(), change });
        if (outcome.status === "conflict" && outcome.record) {
          target = outcome.record;
          mutationId = null;
          throw Error("บิลนี้มีการเปลี่ยนแปลง ชื่อล่าสุด: " + target.name + " เช็กชื่อที่กรอกแล้วลองบันทึกอีกครั้ง");
        }
        if (outcome.status === "uncertain") uncertain2 = true;
        if (!["saved", "unchanged"].includes(outcome.status)) throw Error(outcome.message);
        refreshRecord = outcome.record;
        uncertain2 = false;
        mutationId = null;
        input.value = outcome.record.name;
      }
      await onSaved(refreshRecord);
      refreshRecord = null;
      target = null;
      show();
      return true;
    } catch (error) {
      show(error.message);
      return false;
    }
  }
  function settle({ retry: explicit = false } = {}) {
    if (pending) return pending;
    if (composing) return Promise.resolve(false);
    if (problem && !explicit) return Promise.resolve(false);
    if (!dirty()) {
      target = null;
      show();
      refresh();
      return Promise.resolve(true);
    }
    pending = Promise.resolve().then(write).finally(() => {
      pending = null;
      refresh();
    });
    refresh();
    return pending;
  }
  input.addEventListener("focus", () => {
    if (!target) {
      target = getContext().record;
      mutationId = null;
      selectOnPointerUp = /^ร้านอาหาร [1-9]\d*$/.test(input.value);
      input.setSelectionRange(selectOnPointerUp ? 0 : input.value.length, input.value.length);
    }
  }, options);
  input.addEventListener("pointerup", () => {
    if (problem && (uncertain2 || refreshRecord)) {
      void settle({ retry: true });
      return;
    }
    if (selectOnPointerUp) {
      input.select();
      selectOnPointerUp = false;
    }
  }, options);
  input.addEventListener("input", () => {
    show();
    refresh();
  }, options);
  input.addEventListener("compositionstart", () => {
    composing = true;
  }, options);
  input.addEventListener("compositionend", () => {
    composing = false;
  }, options);
  input.addEventListener("keydown", (event) => {
    if (composing || event.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (!event.repeat) void settle({ retry: true }).then((saved) => {
        if (saved) input.blur();
      });
    }
  }, options);
  input.addEventListener("blur", () => {
    void settle();
  }, options);
  refresh();
  return { refresh, settle, get dirty() {
    return dirty();
  }, get busy() {
    return !!pending;
  }, get unsettled() {
    return dirty() || !!pending || !!problem;
  }, dispose() {
    scope.abort();
  } };
}

// src/bill-evidence.mjs
var DEVELOPMENT_WORK_KEYS = ["fairshare.bill-history.v1", "fairshare.approved-parser"];
function candidateFor(raw) {
  try {
    return decodeBillFile(raw);
  } catch {
    try {
      const value = JSON.parse(raw);
      if (value?.format === "fairshare-bill" && value.version === 1) return { name: null, bill: admittedBill(value.bill) };
    } catch {
    }
    return null;
  }
}
async function readBillEvidence({ repository: repository2, developmentStorage: developmentStorage2, sessionStorage: sessionStorage2, billId }) {
  const sources = [], unavailable = [];
  function collect(label, read, admit = false) {
    try {
      const raw = read();
      if (raw != null) sources.push({ label, raw, candidate: admit ? candidateFor(raw) : null });
    } catch {
      unavailable.push(label);
    }
  }
  if (!billId) {
    const labels = ["ข้อมูลบิลเดิม", "สำเนาสำรองเดิม", "ข้อมูลที่บันทึกค้างไว้", "ข้อมูลเดิมที่เปิดไม่ได้"];
    DEVELOPMENT_BILL_KEYS.forEach((key, index) => collect(labels[index], () => developmentStorage2.getItem(key), true));
  }
  DEVELOPMENT_WORK_KEYS.forEach((key, index) => collect(index ? "ฉบับร่างใบเสร็จเดิม" : "ประวัติการแก้ไขเดิม", () => sessionStorage2.getItem(key)));
  if (billId) {
    collect("ฉบับร่างใบเสร็จของบิลนี้", () => sessionStorage2.getItem(receiptDraftKey(billId)));
    collect("ประวัติการแก้ไขของบิลนี้", () => sessionStorage2.getItem(billHistoryKey(billId)));
    if (repository2) {
      let record;
      try {
        record = await repository2.readRaw(billId);
      } catch {
        unavailable.push("ข้อมูลบิลที่บันทึกไว้");
      }
      if (record) {
        collect("ข้อมูลบิลที่บันทึกไว้", () => JSON.stringify(record));
        const source = sources.find((source2) => source2.label === "ข้อมูลบิลที่บันทึกไว้");
        if (source) {
          try {
            let name = null;
            try {
              name = billName(record.name);
            } catch {
            }
            source.candidate = { name, bill: admittedBill(record.bill) };
          } catch {
          }
        }
        if (record.previous) {
          collect("ข้อมูลก่อนบันทึกครั้งล่าสุด", () => JSON.stringify({ format: "fairshare-bill", version: 1, ...record.previous }), true);
        }
      }
    }
  }
  return { sources, unavailable };
}

// src/person-menu-dialog.mjs
var esc2 = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var memberships = (bill, pid) => new Set(bill.items.filter((it) => it.assignments.some((a) => a.personId === pid)).map((it) => it.id));
function mountPersonMenuHeader(host) {
  const header = document.createElement("div"), back = document.getElementById("btn-back").cloneNode(true);
  header.className = "person-menu-header";
  back.removeAttribute("id");
  back.removeAttribute("style");
  back.removeAttribute("aria-disabled");
  back.type = "button";
  back.setAttribute("aria-label", "ยกเลิกการเลือกเมนู");
  back.querySelector("svg").setAttribute("aria-hidden", "true");
  back.addEventListener("click", () => void host.dismiss(false));
  host.heading.before(header);
  header.append(host.heading, back);
}
async function openPersonMenus({ session: session2, personId, onSaved, onRefreshed, onEditItem, onGoToMenu }) {
  let baseline = session2.current, revision = session2.record.recordRevision, selected = memberships(baseline, personId), stale = false, limit = 50, query = "", candidate;
  const name = baseline.people.find((p) => p.id === personId)?.name;
  if (!name) return;
  const fallback = () => document.querySelector(`[data-a="person-menus"][data-pid="${CSS.escape(personId)}"]`);
  const emptyMessage = "<p>ยังไม่มีเมนูให้เลือก โปรดเพิ่มเมนูในบิลก่อน</p>";
  const emptyActions = [{ label: "ปิด", value: false }, { label: "ไปยังหน้าเมนู", value: "menu", className: "sheet-primary" }];
  if (!baseline.items.length) {
    const result2 = await openSheet({ title: ["แก้ไขเมนูที่ ", customName(name), " กิน"], fallback, body: emptyMessage, actions: emptyActions, mount: mountPersonMenuHeader });
    if (result2 === "menu") onGoToMenu();
    return result2;
  }
  let editId = null;
  const mutationId = newId();
  const result = await openSheet({
    title: ["แก้ไขเมนูที่ ", customName(name), " กิน"],
    className: "person-menu-sheet",
    fallback,
    hasUnsavedChanges: () => !!candidate?.changedItemIds.length,
    body: '<div class="person-menu-search-area"><label for="person-menu-search">ค้นหาเมนู</label><div class="person-menu-search-field"><input type="search" id="person-menu-search" autocomplete="off"><button type="button" id="person-menu-clear" aria-label="ล้างคำค้นหา" hidden><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg></button></div><div class="person-menu-selection-bar"><p id="selection-count" role="status" aria-live="polite"></p><div class="person-menu-selection-actions"><button type="button" id="selection-all" class="coll-btn">เลือกทั้งหมด</button><button type="button" id="selection-none" class="coll-btn">ไม่เลือก</button></div></div></div><div id="person-menu-list"></div><div id="person-menu-preview" class="person-menu-preview"></div><p class="person-menu-lock-note">ส่วนแบ่งที่ล็อกไว้ของคนอื่นจะคงตามการตั้งค่า ส่วนที่เหลือจะแบ่งใหม่ให้คนที่ไม่ได้ล็อก</p><button type="button" id="selection-refresh" hidden>โหลดบิลล่าสุด</button><button type="button" id="selection-export" hidden>ดาวน์โหลดสิ่งที่แก้ไว้</button>',
    actions: [{ label: "ยกเลิก", value: false, dismiss: true }, { label: "บันทึก", className: "sheet-primary", id: "selection-save", disabled: true, run: async (host) => {
      const applied = setPersonMenus(baseline, personId, [...selected]);
      const outcome = await session2.commit(applied.bill, { baseRevision: revision, kind: "person-menus", mutationId });
      if (!["saved", "unchanged"].includes(outcome.status)) {
        if (["conflict", "missing"].includes(outcome.status)) {
          stale = true;
          host.body.querySelector("#selection-refresh").hidden = false;
          host.body.querySelector("#selection-export").hidden = false;
          host.footer.querySelector("#selection-save").disabled = true;
        }
        throw Error(outcome.message);
      }
      await onSaved(outcome);
      return true;
    } }],
    mount: (host) => {
      mountPersonMenuHeader(host);
      const input = host.body.querySelector("#person-menu-search"), list = host.body.querySelector("#person-menu-list"), preview = host.body.querySelector("#person-menu-preview"), save = host.footer.querySelector("#selection-save");
      const clearSearch = host.body.querySelector("#person-menu-clear");
      clearSearch.addEventListener("click", () => {
        input.value = "";
        input.focus({ preventScroll: true });
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      const selectAll = host.body.querySelector("#selection-all"), selectNone = host.body.querySelector("#selection-none");
      const summary = document.createElement("div");
      summary.className = "person-menu-sheet-summary";
      summary.append(preview, host.body.querySelector(".person-menu-lock-note"));
      host.dialog.insertBefore(summary, host.footer);
      function draw() {
        clearSearch.hidden = !input.value;
        candidate = setPersonMenus(baseline, personId, [...selected]);
        const totals = calculate(candidate.bill), person = totals.people[personId];
        host.body.querySelector("#selection-count").textContent = `เลือก ${selected.size} จาก ${baseline.items.length} เมนู`;
        for (const [button2, active2] of [[selectAll, selected.size === baseline.items.length], [selectNone, selected.size === 0]]) {
          button2.classList.toggle("act", active2);
          button2.setAttribute("aria-pressed", String(active2));
        }
        const changed = !!candidate.changedItemIds.length;
        save.disabled = stale || !changed;
        preview.innerHTML = `ยอดที่ต้องจ่ายหลังบันทึก<strong>${money(person.total)} บาท</strong>`;
        list.replaceChildren();
        const filtered = baseline.items.map((it, index) => ({ it, index })).filter(({ it }) => it.name.toLocaleLowerCase("th").includes(query.trim().toLocaleLowerCase("th")));
        if (!filtered.length) {
          list.innerHTML = "<p>ไม่พบเมนูที่ค้นหา</p>";
          return;
        }
        for (const { it, index } of filtered.slice(0, limit)) {
          const row = document.createElement("div");
          row.className = "person-menu-row";
          const duplicate = baseline.items.filter((other) => other.name === it.name).length > 1;
          row.innerHTML = `<label class="sheet-check"><input type="checkbox" data-item-id="${esc2(it.id)}" ${selected.has(it.id) ? "checked" : ""}><span>${esc2(it.name || "ไม่มีชื่อเมนู")}${duplicate ? " (รายการที่ " + (index + 1) + ")" : ""}<small>จำนวน ${it.quantity} · ราคาเมนู ${money(itemTotal(it))} บาท</small></span></label>`;
          const nextItem = candidate.bill.items.find((next) => next.id === it.id), assignment = nextItem.assignments.find((a) => a.personId === personId);
          if (candidate.removedLockedItemIds.includes(it.id)) {
            const warning = document.createElement("p");
            warning.textContent = "เมื่อเอาออก ส่วนแบ่งที่ล็อกไว้ของคนนี้จะถูกลบ";
            row.append(warning);
          }
          if (!itemTotal(it)) {
            const warning = document.createElement("p");
            warning.textContent = "เมนูนี้ยังไม่มีราคา";
            row.append(warning);
          } else if (assignment && assignment.amountCents === 0) {
            const warning = document.createElement("p");
            warning.textContent = "เลือกเมนูนี้แล้ว แต่ส่วนแบ่งเป็น 0 บาท เพราะยอดถูกล็อกไว้ครบแล้ว";
            const edit = document.createElement("button");
            edit.type = "button";
            edit.textContent = "แก้ส่วนแบ่ง";
            edit.onclick = () => {
              editId = it.id;
              host.finish(changed ? "settle-edit" : "edit");
            };
            row.append(warning, edit);
          }
          row.querySelector("input").addEventListener("change", (event) => {
            if (event.target.checked) selected.add(it.id);
            else selected.delete(it.id);
            const focusId = it.id;
            draw();
            list.querySelector(`[data-item-id="${CSS.escape(focusId)}"]`)?.focus({ preventScroll: true });
          });
          list.append(row);
        }
        if (filtered.length > limit) {
          const more = document.createElement("button");
          more.type = "button";
          more.textContent = "แสดงเพิ่ม";
          more.onclick = () => {
            limit += 50;
            draw();
          };
          list.append(more);
        }
      }
      input.addEventListener("input", () => {
        query = input.value;
        limit = 50;
        draw();
      });
      selectAll.addEventListener("click", () => {
        selected = new Set(baseline.items.map((item) => item.id));
        draw();
      });
      selectNone.addEventListener("click", () => {
        selected.clear();
        draw();
      });
      host.body.querySelector("#selection-export").onclick = () => {
        const name2 = session2.record?.name ?? "บิลที่แก้ไว้";
        const raw = encodeBillFile({ name: name2, bill: candidate.bill });
        const url = URL.createObjectURL(new Blob([raw], { type: "application/json" })), a = document.createElement("a");
        a.href = url;
        a.download = billFilename(name2);
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1e3);
      };
      host.body.querySelector("#selection-refresh").onclick = async () => {
        if (host.busy) return;
        host.setBusy(true);
        try {
          const before = memberships(baseline, personId), added = [...selected].filter((id) => !before.has(id)), removed = [...before].filter((id) => !selected.has(id));
          const loaded = await session2.load();
          await onRefreshed?.(loaded);
          if (loaded.status !== "loaded") throw Error(loaded.message);
          const latest = session2.current;
          if (!latest.people.some((p) => p.id === personId)) throw Error("ไม่พบรายชื่อคนนี้ในบิล");
          const latestSelected = memberships(latest, personId), live = new Set(latest.items.map((it) => it.id));
          added.filter((id) => live.has(id)).forEach((id) => latestSelected.add(id));
          removed.forEach((id) => latestSelected.delete(id));
          const removedCount = baseline.items.filter((it) => !live.has(it.id)).length;
          baseline = latest;
          revision = session2.record.recordRevision;
          selected = latestSelected;
          stale = false;
          host.setBusy(false);
          host.setTitle(["แก้ไขเมนูที่ ", customName(latest.people.find((p) => p.id === personId).name), " กิน"]);
          if (!latest.items.length) {
            candidate = null;
            summary.remove();
            host.dialog.classList.remove("person-menu-sheet");
            host.clearError();
            host.body.innerHTML = emptyMessage;
            host.footer.replaceChildren();
            for (const action of emptyActions) {
              const button2 = document.createElement("button");
              button2.type = "button";
              button2.textContent = action.label;
              button2.className = action.className || "";
              button2.onclick = () => host.finish(action.value);
              host.footer.append(button2);
            }
            host.heading.focus({ preventScroll: true });
            return;
          }
          draw();
          host.body.querySelector("#selection-refresh").hidden = true;
          host.error(`โหลดบิลล่าสุดแล้ว มีการเปลี่ยนแปลง ${added.length + removed.length} เมนู และเมนูที่ถูกลบ ${removedCount} เมนู เช็กก่อนบันทึก`);
        } catch (error) {
          host.setBusy(false);
          host.error(error.message);
        }
      };
      draw();
    }
  });
  if (result === "menu") onGoToMenu();
  if (result === "edit") onEditItem(editId);
  if (result === "settle-edit") {
    const choice = await openSheet({ title: "บันทึกการเลือกก่อนแก้ส่วนแบ่งไหม?", body: "<p>เลือกว่าจะบันทึกการเลือก หรือใช้ข้อมูลที่บันทึกอยู่</p>", actions: [{ label: "ไม่บันทึกการเลือก", value: "discard" }, { label: "บันทึกการเลือก", className: "sheet-primary", run: async () => {
      const outcome = await session2.commit(candidate.bill, { baseRevision: revision, kind: "person-menus", mutationId });
      if (!["saved", "unchanged"].includes(outcome.status)) throw Error(outcome.message);
      await onSaved(outcome);
      return "saved";
    } }] });
    if (choice) onEditItem(editId);
  }
  return result;
}

// src/editor-actions.mjs
function createEditorActions(root = document) {
  const actions2 = /* @__PURE__ */ new WeakMap(), composing = /* @__PURE__ */ new Set();
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
    const button2 = e.target.closest?.("button,[data-editor-action]");
    if (button2 && actions2.has(button2)) {
      pointer = { button: button2, x: e.clientX, y: e.clientY };
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
    run(actions2.get(p.button));
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
    bind(button2, action) {
      if (button2.dataset && button2.tagName !== "BUTTON") button2.dataset.editorAction = "";
      actions2.set(button2, action);
      button2.addEventListener("click", (e) => {
        if (button2.tagName !== "INPUT" || !["checkbox", "radio"].includes(button2.type)) e.preventDefault();
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

// src/history-controls.mjs
var icon = (redo) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${redo ? "M21 10a9 9 0 1 0-2.6 8.4M21 4v6h-6" : "M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6"}"/></svg>`;
function historyNeedsCompact(labelWidth, availableWidth) {
  return 2 * (labelWidth + 39) + 4 > availableWidth;
}
function mountHistoryControls(host, { scope, onUndo, onRedo, editors: editors2 }) {
  host.classList.add("history-controls");
  const buttons = [["ย้อนกลับ", onUndo, false], ["ทำซ้ำ", onRedo, true]].map(([label, action, redo]) => {
    const button2 = document.createElement("button");
    button2.type = "button";
    button2.className = "history-button";
    button2.setAttribute("aria-label", label + " " + scope);
    button2.title = label + " " + scope;
    button2.innerHTML = icon(redo);
    const text2 = document.createElement("span");
    text2.textContent = label;
    button2.append(text2);
    host.append(button2);
    if (editors2) editors2.bind(button2, action);
    else button2.onclick = action;
    return button2;
  });
  return { update({ canUndo, canRedo, compact = false }) {
    buttons[0].disabled = !canUndo;
    buttons[1].disabled = !canRedo;
    host.classList.toggle("compact", compact);
  }, dispose() {
    host.replaceChildren();
  } };
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

// src/fairshare-ui.mjs
var pageLifetime = new AbortController(), pageTimers = /* @__PURE__ */ new Set(), pageFrames = /* @__PURE__ */ new Set();
trackPointerHover(document, pageLifetime.signal);
var pageDisposed = false;
function listen(target, type, callback, options = {}) {
  target.addEventListener(type, callback, { ...typeof options === "boolean" ? { capture: options } : options, signal: pageLifetime.signal });
}
function pageTimeout(callback, delay) {
  const timer = setTimeout(() => {
    pageTimers.delete(timer);
    if (!pageDisposed) callback();
  }, delay);
  pageTimers.add(timer);
  return timer;
}
function pageFrame(callback) {
  const frame = requestAnimationFrame((time) => {
    pageFrames.delete(frame);
    if (!pageDisposed) callback(time);
  });
  pageFrames.add(frame);
  return frame;
}
var repository = null, controls = null, nameEditor = null, actionBusy = false;
var tabStorage;
try {
  tabStorage = sessionStorage;
} catch {
}
var repositoryPort = {
  read: (id) => repository.read(id),
  write: (operation) => repository.write(operation),
  reconcileOperation: (operation) => repository.reconcileOperation(operation),
  writeLastSelected: (id) => repository.writeLastSelected(id)
};
var billController = createMainBillController({
  repository: repositoryPort,
  sessionStorage: tabStorage,
  getInteractionGuards: () => ({
    actionBusy,
    nameBusy: !!nameEditor?.busy,
    hasItemSession: !!session,
    hasPeopleDraft: hasPeopleDraft(),
    nameDirty: !!nameEditor?.dirty,
    inputFocused: !!document.activeElement?.matches("input"),
    sheetOpen: sheetOpen()
  }),
  onChange: onBillChange
});
var billState = () => billController.getSnapshot();
var workingBill = (snapshot2 = billState()) => snapshot2.working;
var savedBill = (snapshot2 = billState()) => snapshot2.record?.bill ?? emptyBill();
function activeSession() {
  const captured = billState();
  if (!captured.record) return null;
  const id = captured.billId;
  const stillCurrent = () => billController.billId === id;
  return {
    get billId() {
      return id;
    },
    get record() {
      return stillCurrent() ? billState().record : captured.record;
    },
    get current() {
      return stillCurrent() ? savedBill() : captured.record.bill;
    },
    get canUndo() {
      return stillCurrent() && billState().canUndo;
    },
    get canRedo() {
      return stillCurrent() && billState().canRedo;
    },
    load: () => stillCurrent() ? billController.refresh() : Promise.resolve({ status: "stale", message: "บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนบันทึก" }),
    async commit(candidate, options) {
      if (!stillCurrent()) return { status: "conflict", message: "บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนบันทึก" };
      const accepted = await billController.commit(candidate, options), snapshot2 = billState();
      if (snapshot2.billId !== id) return { status: "stale", message: "บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดก่อนบันทึก" };
      return { status: accepted ? snapshot2.outcome : snapshot2.outcome ?? "failed", bill: snapshot2.record?.bill, record: snapshot2.record, message: snapshot2.error };
    }
  };
}
var editors = createEditorActions();
var mainScroll = createMainScroll({ storage: tabStorage, getEpoch: () => billController.billId });
var headerHistory;
function currentItem() {
  return session?.snapshot().draft ?? workingBill().items.find((item) => item.id === activeItemId);
}
function installItemDraft(item) {
  if (session) session.edit((draft) => {
    for (const key of Object.keys(draft)) delete draft[key];
    Object.assign(draft, structuredClone(item));
  });
}
function recordItem() {
  if (session && !editors.composing) {
    session.record();
    updateHistory();
  }
}
function updateHistory(snapshot2 = billState()) {
  if (!headerHistory || savingPresentation) return;
  const itemView = view === "item-detail";
  const history2 = itemView ? session : snapshot2;
  const pending = false;
  const host = document.getElementById("header-history"), header = document.getElementById("hdr");
  const title = document.getElementById("hdr-title"), price = document.getElementById("hdr-item-total"), back = document.getElementById("btn-back");
  host.hidden = view === "people";
  const buttonStyle = getComputedStyle(host.firstElementChild);
  const font = buttonStyle.fontWeight + " " + buttonStyle.fontSize + " " + buttonStyle.fontFamily;
  const labelWidth = Math.max(measureTW("ย้อนกลับ", font), measureTW("ทำซ้ำ", font));
  host.style.setProperty("--history-label-width", labelWidth + "px");
  const headerStyle = getComputedStyle(header);
  const gap = parseFloat(headerStyle.columnGap) || 0;
  const titleWidth = itemView ? Math.min(title.scrollWidth, 160) + back.offsetWidth + 8 : [...title.children].reduce((sum, node) => sum + node.scrollWidth, 3);
  const priceWidth = price.offsetWidth;
  const available = header.clientWidth - parseFloat(headerStyle.paddingLeft) - parseFloat(headerStyle.paddingRight) - titleWidth - priceWidth - gap * (priceWidth ? 2 : 1);
  const wrapped = !host.hidden && available < 92;
  header.classList.toggle("history-wrapped", wrapped);
  const blocked = snapshot2.opening || operationUncertain(snapshot2) || !itemView && snapshot2.storageBlocked;
  headerHistory.update({
    canUndo: !blocked && (!!history2?.canUndo || !!pending),
    canRedo: !blocked && !!history2?.canRedo && !pending,
    compact: historyNeedsCompact(labelWidth, wrapped ? header.clientWidth - parseFloat(headerStyle.paddingLeft) - parseFloat(headerStyle.paddingRight) : available)
  });
}
function syncMainStickyOffsets() {
  const header = document.getElementById("hdr"), tabs = document.getElementById("top-tabs");
  const height = header.getBoundingClientRect().height, tabHeight = tabs.getBoundingClientRect().height;
  document.documentElement.style.setProperty("--main-header-height", height + "px");
  document.documentElement.style.setProperty("--main-summary-top", height + tabHeight + "px");
}
async function moveHistory(direction) {
  if (billState().opening || operationUncertain() || billState().storageBlocked && view !== "item-detail") return;
  if (view === "item-detail" && session) {
    recordItem();
    session[direction]();
    renderItemDetail();
  } else if (activeSession() && await billController[direction]()) render();
  updateHistory();
}
function acceptBill(result) {
  return ["saved", "unchanged"].includes(result.status);
}
function adoptRefreshed(result) {
  if (result.status === "loaded") render();
  updateHistory();
  updateBillContext();
}
var recovery = createRecoveryNotice({ getModel: recoveryModel, fallback: () => document.getElementById("hdr-title") });
function recoverableBill() {
  capturePeopleDraft();
  const ui = billController.getRecoveryWorking();
  if (session) {
    if (!session.snapshot().draft.name.trim()) throw Error("รายการที่ยังกรอกไม่ครบ");
    const index = ui.items.findIndex((item) => item.id === session.snapshot().draft.id);
    if (index < 0) ui.items.push(structuredClone(session.snapshot().draft));
    else ui.items[index] = structuredClone(session.snapshot().draft);
  }
  const people = getPeopleDraft(), pendingAdd = billState().pendingCandidate?.peopleEdit;
  if (people.rename) {
    if (!people.rename.value.trim()) throw Error("รายชื่อที่ยังกรอกไม่ครบ");
    const person = ui.people.find((p) => p.id === people.rename.id);
    if (person) person.name = people.rename.value.trim();
  }
  const sameAddition = pendingAdd?.kind === "add" && pendingAdd.name === people.add.trim() && ui.people.some((person) => person.id === pendingAdd.id);
  if (people.add.trim() && !sameAddition) ui.people.push({ id: newId(), name: people.add.trim() });
  return approvedBill(ui, savedBill());
}
async function selectRecoveryBill(id) {
  if ((billState().pendingCandidate || billState().invalidCandidate || session?.dirty || hasPeopleDraft() || nameEditor?.dirty) && !await confirmDiscard()) return false;
  return installBill(id).then((installed) => {
    if (installed) focusBillContext();
    return installed;
  });
}
async function saveRecoveryCopy(candidate, name) {
  const operation = billState().pendingOperation?.kind === "recovery-copy" ? billState().pendingOperation : newOperation("recovery-copy");
  const result = await billController.runLibraryOperation(operation, (current) => repository.create({ ...current, name, bill: candidate }));
  if (result?.status === "saved") toast("บันทึกเป็นบิลใหม่แล้ว");
}
async function recoveryModel() {
  return buildRecoveryModel();
}
var buildRecoveryModel = createMainRecovery({
  getSnapshot: billState,
  getWork: recoverableBill,
  getName: () => (nameEditor?.dirty ? document.getElementById("bill-selector-name").value.trim() : billState().record?.name) || "บิลที่กู้คืน",
  async readLibrary(id) {
    let library = null, latest, readable = false;
    try {
      if (!repository) {
        repository = await openBillRepository({ developmentStorage });
        mountBillControls();
      }
      library = await repository.list();
      if (id) latest = await repository.read(id);
      readable = true;
    } catch {
    }
    return { library, latest, readable };
  },
  async readEvidence(id) {
    const evidence = await readBillEvidence({ repository, developmentStorage, sessionStorage: tabStorage, billId: id });
    return evidence.sources.find((source) => source.candidate)?.candidate;
  },
  retry: retryOperation,
  open: installBill,
  createCopy: saveRecoveryCopy,
  selectBill: selectRecoveryBill,
  exportWork: exportCandidate,
  downloadBill: (bill, name) => downloadText(encodeBillFile({ name, bill }), billFilename(name)),
  startNew,
  selectOther: () => controls.openSelector(),
  async connect() {
    if (billState().record) await checkExternalBill();
    else await initialize();
    if (billState().error) void recovery.show();
  },
  getConnectionError: () => repository?.connectionError
});
var TOAST_DURATION_MS = 2200;
var gid = newId;
var clone4 = (o) => JSON.parse(JSON.stringify(o));
var collapsedPeople = /* @__PURE__ */ new Set();
var view = "menu", prevView = "menu", activeItemId = null, session = null, editingPid = null, peopleReturnTo = null;
var peopleDraftOwner = createPeopleDraft();
var getPeopleDraft = () => peopleDraftOwner.snapshot();
function updatePeopleDraft(patch) {
  peopleDraftOwner.capture({ ...getPeopleDraft(), ...patch });
}
function capturePeopleDraft() {
  if (view !== "people") return;
  const add = document.getElementById("np-inp");
  if (add) updatePeopleDraft({ add: add.value });
  const edit = editingPid && document.getElementById("ep-" + editingPid);
  if (edit) updatePeopleDraft({ rename: { id: editingPid, value: edit.value } });
}
function hasPeopleDraft() {
  return !!(getPeopleDraft().add.trim() || getPeopleDraft().rename || editingPid);
}
function enterPeople(opener) {
  peopleReturnTo = { billId: activeSession().billId, view, itemId: view === "item-detail" ? activeItemId : null, scroll: { x: scrollX, y: scrollY }, opener: opener?.id };
  recordItem();
  editingPid = null;
  peopleDraftOwner.reset();
  goto("people");
}
function bindPeopleEntry(element2) {
  if (!element2) return;
  bindBillAction(element2, () => enterPeople(document.getElementById(element2.id)));
  if (element2.tagName !== "BUTTON") {
    element2.setAttribute("role", "button");
    element2.tabIndex = 0;
    element2.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        editors.run(() => runBillAction(() => enterPeople(document.getElementById(element2.id))));
      }
    });
  }
}
var resizeRAF = 0;
var summaryHintDismissed = false;
var { measure: measureTW, clear: clearHistoryWidths } = createTextMeasurer();
function isItemDetailTwoLine() {
  const el = document.getElementById("screen-item-detail");
  const w = el && el.clientWidth > 50 ? el.clientWidth : window.innerWidth;
  return w < 580;
}
var _btCache = null;
function invalidateBT() {
  _btCache = null;
}
function getCachedBT(snapshot2 = billState()) {
  return _btCache ?? (_btCache = getBT(snapshot2));
}
function applyC(item) {
  const result = recalculateApprovedItem(item);
  item.assignments = result.item.assignments;
  return result.overallocated;
}
function getDA(item) {
  return approvedShares(item);
}
function pruneCollapsedPeople(snapshot2 = billState()) {
  const live = new Set(workingBill(snapshot2).people.map((p) => p.id));
  collapsedPeople = new Set([...collapsedPeople].filter((id) => live.has(id)));
}
var savingPresentation = false, nameSaving = false, openingPresentation = false;
var mainInteraction = createInteractionBusy(document.getElementById("app"), { signal: pageLifetime.signal });
function syncBusy() {
  mainInteraction.setBusy(savingPresentation || nameSaving || actionBusy);
  const app = document.getElementById("app");
  if (savingPresentation || nameSaving || openingPresentation) app.setAttribute("aria-busy", "true");
  else app.removeAttribute("aria-busy");
}
function setSaving(value) {
  savingPresentation = value;
  syncBusy();
  if (!value) {
    const button2 = document.getElementById("btn-download-summary");
    if (button2) button2.disabled = imageExporting;
  }
}
async function commitCandidate(candidate, options = {}) {
  return billController.commit(candidate, options);
}
async function saveS(options = {}) {
  if (billState().storageBlocked || !activeSession()) {
    void recovery.show();
    return false;
  }
  try {
    return await commitCandidate(approvedBill(workingBill(), savedBill()), options);
  } catch (error) {
    billController.reportInvalid(error);
    toast("ยังไม่ได้บันทึก: " + error.message);
    return false;
  }
}
async function runBillAction(action, { allowPending = false, preserveGesture = false } = {}) {
  if (actionBusy || billState().opening) return;
  actionBusy = true;
  syncBusy();
  try {
    document.activeElement?.blur?.();
    if (!preserveGesture) await Promise.resolve();
    if (nameEditor?.unsettled && !await nameEditor.settle()) return;
    if (billState().saving) await billController.waitForSave();
    if ((billState().pendingCandidate || billState().invalidCandidate) && !allowPending) {
      toast("ยังไม่ได้บันทึก ลองอีกครั้งหรือดาวน์โหลดสิ่งที่แก้ไว้ก่อน");
      return;
    }
    return await action();
  } catch (error) {
    toast(error.message);
  } finally {
    actionBusy = false;
    syncBusy();
    if (billState().reconciliationQueued) void checkExternalBill();
  }
}
function bindBillAction(button2, action, options) {
  if (button2) editors.bind(button2, () => runBillAction(action, options));
}
function uiKey(id = billController.billId) {
  return billUiKey(id);
}
function saveUiState(snapshot2 = billState()) {
  if (!snapshot2.record) return;
  try {
    tabStorage?.setItem(uiKey(snapshot2.billId), JSON.stringify({ collapsed: [...collapsedPeople], summaryHintDismissed }));
  } catch {
  }
}
var operationUncertain = (snapshot2 = billState()) => snapshot2.pendingOperation?.outcome?.status === "uncertain";
function billControlContext(snapshot2 = billState()) {
  const record = snapshot2.missingTarget === snapshot2.billId ? null : snapshot2.record;
  const cleared = record && clearDishes(record.bill);
  const canClearDishes = cleared && (!sameValue(cleared.items, record.bill.items) || !sameValue(cleared.groups, record.bill.groups));
  return {
    available: !!repository && !snapshot2.opening,
    mutationBlocked: operationUncertain(snapshot2) || !!snapshot2.pendingCandidate && !snapshot2.saving || snapshot2.invalidCandidate,
    mainBlocked: snapshot2.opening || snapshot2.storageBlocked || !!snapshot2.record && operationUncertain(snapshot2),
    tabsBlocked: snapshot2.opening,
    reconciliationQueued: snapshot2.reconciliationQueued,
    record,
    canClearDishes,
    canClearPeople: !!record?.bill.people.length
  };
}
function updateBillContext(snapshot2 = billState()) {
  const row = document.getElementById("bill-context");
  if (!row) return;
  row.hidden = view === "people" || view === "item-detail";
  const uncertain2 = operationUncertain(snapshot2), context = billControlContext(snapshot2);
  const problem = uncertain2 ? snapshot2.pendingOperation.outcome.message : snapshot2.error || snapshot2.openingTarget?.message;
  recovery.update(problem ? `${snapshot2.record ? snapshot2.billId : snapshot2.missingTarget ?? "startup"}:${uncertain2 ? "uncertain" : snapshot2.entryPhase}:${snapshot2.outcome ?? ""}:${problem}` : "", snapshot2.record ? "ยังไม่ได้บันทึก" : "ไม่สามารถเปิดบิลได้");
  document.getElementById("main").inert = context.mainBlocked;
  document.getElementById("top-tabs").inert = context.tabsBlocked;
  controls?.refresh(context);
  nameEditor?.refresh(context);
}
async function installBill(id, targetView, { reason = "switch" } = {}) {
  const installed = await billController.open(id, { reason, targetView });
  if (installed) finishBillNavigation(targetView ?? (view === "summary" ? "summary" : "menu"));
  else if (!billState().record) goto("menu");
  return installed;
}
function finishBillNavigation(targetView) {
  const url = new URL(location.href);
  url.searchParams.set("bill", billState().billId);
  url.searchParams.delete("select");
  history.replaceState(history.state, "", url);
  goto(targetView);
}
function downloadText(text2, filename, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text2], { type })), a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  pageTimeout(() => URL.revokeObjectURL(url), 1e3);
  toast("เริ่มดาวน์โหลดแล้ว");
}
function exportCandidate() {
  const name = activeSession()?.record?.name ?? "ข้อมูลกู้คืน";
  capturePeopleDraft();
  try {
    downloadText(encodeBillFile({ name, bill: recoverableBill() }), billFilename(name));
  } catch {
    downloadText(JSON.stringify({ format: "fairshare-unsaved-recovery", fields: [...document.querySelectorAll("#app input")].filter((input) => input.getClientRects().length).map((input) => ({ id: input.id, value: input.value })), billId: activeSession()?.billId, peopleDraft: getPeopleDraft(), itemDraft: session?.snapshot().draft, ui: workingBill() }, null, 2), "หารจ่ายแฟร์ๆ-unsaved-recovery.json");
  }
}
function isItemDefault(item) {
  return !item.name.trim() && (!item.price || item.price <= 0) && (!item.assignments || !item.assignments.length);
}
function getBT(snapshot2 = billState()) {
  try {
    return approvedBillTotals(workingBill(snapshot2), savedBill(snapshot2));
  } catch (error) {
    toast(error.message);
    return null;
  }
}
function setAllocation(item, pid, value, mode) {
  const a = item.assignments.find((a2) => a2.personId === pid);
  if (!a) return;
  a.locked = true;
  a.lockMode = mode === "amt" ? "amount" : "percentage";
  if (mode === "amt") {
    a.amount = Math.round(value * 100) / 100;
    delete a.lockPercentUnits;
  } else a.lockPercentUnits = Math.round(Math.min(value, 100) * 1e4);
  applyC(item);
}
function updateBillTotals(snapshot2 = billState()) {
  if (view === "menu" && menuMount) menuMount.update({ ...billRenderModel({}, snapshot2), totalsOnly: true });
}
function layoutDistribution() {
  summaryMount?.layout();
}
function updateHdrTotal(total) {
  const el = document.getElementById("hdr-item-total");
  if (!el) return;
  if (view === "item-detail" && total > 0) {
    el.textContent = fmt(total, "บาท");
    el.style.display = "block";
  } else {
    el.textContent = "";
    el.style.display = "none";
  }
}
function shouldShowSummaryHint(snapshot2 = billState()) {
  if (summaryHintDismissed) return false;
  return workingBill(snapshot2).items.some((it) => it.assignments && it.assignments.length > 0);
}
function updateTabHint(snapshot2 = billState()) {
  const sumTab = document.querySelector('.tab-btn[data-tab="summary"]');
  if (!sumTab) return;
  if (!sumTab.classList.contains("active") && shouldShowSummaryHint(snapshot2)) sumTab.classList.add("tab-next-step");
  else sumTab.classList.remove("tab-next-step");
}
function setMainTitle() {
  const el = document.getElementById("hdr-title");
  el.className = "";
  el.innerHTML = `<span class="title-pre">หารจ่าย</span><span class="title-main">แฟร์ๆ</span>`;
}
function setSubTitle(text2) {
  const el = document.getElementById("hdr-title");
  el.className = "subpage-title";
  el.textContent = text2;
}
function openItemSess(itemId, isNew = false) {
  activeItemId = itemId;
  const draft = isNew ? { id: itemId, name: "", price: 0, quantity: 1, assignments: [] } : clone4(workingBill().items.find((i) => i.id === itemId));
  session = createItemEditor({ item: draft, isNew });
  goto("item-detail");
  const name = document.getElementById("it-name"), price = document.getElementById("it-price");
  if (!draft.name.trim()) name.focus({ preventScroll: true });
  else if (!price.value.trim() || Number(price.value.replace(/,/g, "")) === 0) price.focus({ preventScroll: true });
}
function teardownItemDetail() {
  itemMount?.dispose();
  itemMount = null;
  document.getElementById("sticky-done-wrap").style.display = "none";
}
function addNewItem() {
  if (session) {
    toast("แก้เมนูนี้ให้เสร็จก่อน");
    return;
  }
  openItemSess(gid(), true);
}
var layoutWidth = 0;
function handleViewportChange({ force = false } = {}) {
  const width = document.documentElement.clientWidth;
  if (!force && width === layoutWidth && view !== "item-detail") return;
  layoutWidth = width;
  cancelAnimationFrame(resizeRAF);
  resizeRAF = pageFrame(() => {
    updateHistory();
    if (view === "item-detail") {
      itemMount?.layout();
    } else if (view === "menu") {
      updatePeoplePreview();
    } else if (view === "summary") {
      layoutDistribution();
      syncMainStickyOffsets();
    }
  });
}
function updatePeoplePreview() {
  menuMount?.layout();
}
async function doneAction() {
  if (editors.composing) return;
  const item = currentItem();
  if (!item) return;
  if (!isItemDefault(item)) {
    if (!item.name.trim()) {
      const err = document.getElementById("it-name-err");
      err.textContent = "ชื่อเมนูห้ามว่าง";
      err.style.display = "block";
      document.getElementById("it-name")?.focus();
      return;
    }
    const next = workingBill();
    const index = next.items.findIndex((i) => i.id === item.id);
    if (index < 0) next.items.push(clone4(item));
    else next.items[index] = clone4(item);
    try {
      if (!await commitCandidate(approvedBill(next, savedBill()))) return;
    } catch (error) {
      toast(error.message);
      return;
    }
  }
  teardownItemDetail();
  session = null;
  updateTabHint();
  goto(prevView);
}
function modal(title, body, actions2) {
  return openSheet({ title, body: "<p></p>", fallback: () => document.getElementById("bill-selector"), mount: (host) => setSheetText(host.body.querySelector("p"), body), actions: actions2 });
}
var tT;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(tT);
  tT = pageTimeout(() => t.classList.remove("show"), TOAST_DURATION_MS);
}
function confirmDelete(label, msg, { confirmLabel = "ลบ" } = {}) {
  return modal(["ลบ ", customName(label), " ใช่ไหม?"], [...Array.isArray(msg) ? msg : [msg], " (ย้อนกลับได้)"], [{ label: "ยกเลิก", value: "n" }, { label: confirmLabel, value: "y", className: "sheet-danger" }]);
}
function isDuplicateName(name, excludeId = null) {
  const n = name.trim().toLowerCase();
  return workingBill().people.some((p) => p.id !== excludeId && p.name.trim().toLowerCase() === n);
}
async function doAddPerson() {
  const inp = document.getElementById("np-inp"), err = document.getElementById("np-err"), name = inp.value.trim();
  capturePeopleDraft();
  if (billState().saving || billState().pendingCandidate) return false;
  if (!name) {
    if (err) {
      err.textContent = "ชื่อห้ามว่าง";
      err.style.display = "block";
    }
    return;
  }
  if (isDuplicateName(name)) {
    if (err) {
      err.textContent = "ชื่อนี้ถูกใช้แล้ว";
      err.style.display = "block";
    }
    return;
  }
  inp.focus({ preventScroll: true });
  const id = gid();
  billController.editWorking((draft) => {
    draft.people.push({ id, name });
  });
  invalidateBT();
  if (!await saveS({ peopleEdit: { kind: "add", id, name } })) return false;
  inp.value = getPeopleDraft().add;
  if (err) err.style.display = "none";
  renderPeopleList();
  updateBillContext();
  return true;
}
async function doEditPerson(id) {
  const inp = document.getElementById("ep-" + id);
  if (!inp) return;
  capturePeopleDraft();
  const name = inp.value.trim();
  if (billState().saving || billState().pendingCandidate) return false;
  if (!name) {
    toast("ชื่อห้ามว่าง");
    return;
  }
  if (isDuplicateName(name, id)) {
    toast("ชื่อนี้ถูกใช้แล้ว");
    return;
  }
  billController.editWorking((draft) => {
    const person = draft.people.find((person2) => person2.id === id);
    if (person) person.name = name;
  });
  if (!await saveS({ peopleEdit: { kind: "rename", id, name } })) return false;
  renderPeopleList();
  return true;
}
function removePersonFromItem(item, id) {
  item.assignments = item.assignments.filter((assignment) => assignment.personId !== id);
  applyC(item);
  return item;
}
async function doDelPerson(id) {
  const { billId, saving, pendingCandidate } = billState();
  if (saving || pendingCandidate) return;
  const p = workingBill().people.find((x) => x.id === id);
  if (!p) return;
  if (workingBill().items.some((it) => it.assignments.some((a) => a.personId === id))) {
    const c = await confirmDelete(p.name, [customName(p.name), " จะถูกลบออกจากทุกเมนูอาหาร"], { confirmLabel: "ลบออก" });
    if (c !== "y") return;
  }
  const current = billState();
  if (pageDisposed || current.billId !== billId || current.opening || current.saving || current.pendingCandidate) return;
  billController.editWorking((draft) => {
    draft.items.forEach((item) => removePersonFromItem(item, id));
    draft.people = draft.people.filter((person) => person.id !== id);
  });
  invalidateBT();
  await saveS({ peopleEdit: { kind: "delete", id, billId } });
}
var imageExporting = false;
function startSummaryImage() {
  if (billState().pendingCandidate || billState().saving) {
    toast("บันทึกการแก้ไขก่อนดาวน์โหลด");
    return;
  }
  if (imageExporting) return;
  imageExporting = true;
  const button2 = document.getElementById("btn-download-summary");
  if (button2) button2.disabled = true;
  downloadSummaryImage(activeSession().record, toast).catch((error) => toast("สร้างรูปภาพไม่ได้ ลองอีกครั้ง: " + error.message)).finally(() => {
    imageExporting = false;
    if (!billState().saving) {
      const current = document.getElementById("btn-download-summary");
      if (current) current.disabled = false;
    }
  });
}
var menuMount = null, summaryMount = null;
function billRenderModel(extra = {}, snapshot2 = billState()) {
  const working = workingBill(snapshot2), totals = getCachedBT(snapshot2);
  return {
    working,
    totals,
    imageExporting,
    collapsed: [...collapsedPeople],
    labels: Object.fromEntries(working.items.map((item) => [item.id, getSplitLabel(item, working.people)])),
    warnings: Object.fromEntries(working.items.map((item) => [item.id, getItemWarnings(item, working.people)])),
    shares: Object.fromEntries(working.items.map((item) => [item.id, approvedShares(item)])),
    personWarnings: Object.fromEntries(working.people.map((person) => [person.id, getPersonWarning(person.id, working, totals)])),
    ...extra
  };
}
function renderMenu(snapshot2 = billState()) {
  mainScroll.before("menu");
  const model = billRenderModel({}, snapshot2);
  if (menuMount) menuMount.update(model);
  else menuMount = mountMenu(model, billViewActions);
  mainScroll.after("menu");
}
var billViewActions = {
  bindPeopleEntry,
  bindBillAction,
  updateTabHint,
  addItem: addNewItem,
  openItem(id) {
    if (session) {
      toast("แก้เมนูนี้ให้เสร็จก่อน");
      return;
    }
    openItemSess(id);
  },
  async uploadReceipt() {
    if (await saveS()) {
      mainScroll.capture();
      location.href = new URL("../receipt.html?bill=" + encodeURIComponent(billState().billId), import.meta.url).href;
    }
  },
  async deleteItem(id) {
    const item = workingBill().items.find((item2) => item2.id === id);
    if (!item) return;
    if (await confirmDelete(item.name || "เมนูนี้", "เมนูนี้และข้อมูลการหารจ่ายทั้งหมดของเมนูนี้จะถูกลบ") !== "y") return;
    billController.editWorking((draft) => {
      draft.items = draft.items.filter((item2) => item2.id !== id);
    });
    invalidateBT();
    if (await saveS()) renderMenu();
  },
  async toggleCharge(kind, enabled) {
    billController.editWorking((draft) => {
      draft[kind].enabled = enabled;
    });
    invalidateBT();
    if (await saveS()) renderMenu();
  },
  async editCharge(kind, value) {
    billController.editWorking((draft) => {
      draft[kind].value = value || (kind === "service" ? 10 : 7);
      if (value === 0) draft[kind].enabled = false;
    });
    invalidateBT();
    if (await saveS() && value === 0) renderMenu();
  },
  async editDiscount(value) {
    billController.editWorking((draft) => {
      draft.discount.value = value;
    });
    invalidateBT();
    await saveS();
  },
  async discountMode(mode) {
    if (workingBill().discount.mode === mode) return;
    billController.editWorking((draft) => {
      if (mode === "percent" && draft.discount.value > 100) draft.discount.value = 100;
      draft.discount.mode = mode;
    });
    invalidateBT();
    if (await saveS()) renderMenu();
  },
  async distribution(key, value) {
    if (billState().saving) return;
    billController.editWorking((draft) => {
      draft[key] = value;
    });
    invalidateBT();
    if (await saveS({ kind: "distribution" })) renderSummary({ keepControls: true });
  },
  async personMenus(personId) {
    const billId = billState().billId;
    try {
      return await openPersonMenus({ session: activeSession(), personId, onSaved: async () => renderSummary(), onRefreshed: adoptRefreshed, onEditItem: (id) => openItemSess(id), onGoToMenu: () => goto("menu") });
    } finally {
      billController.releaseSheetCandidate("person-menus", billId);
    }
  },
  toggleCollapsed(id) {
    if (collapsedPeople.has(id)) collapsedPeople.delete(id);
    else collapsedPeople.add(id);
    saveUiState();
    renderSummary();
  },
  expandAll() {
    collapsedPeople.clear();
    saveUiState();
    renderSummary();
  },
  collapseAll() {
    workingBill().people.forEach((person) => collapsedPeople.add(person.id));
    saveUiState();
    renderSummary();
  },
  async removePersonMenu(personId, itemId) {
    if (billState().saving || billState().pendingCandidate) return;
    const captured = billState().record, person = captured.bill.people.find((person2) => person2.id === personId), item = captured.bill.items.find((item2) => item2.id === itemId);
    if (!person || !item) return;
    const remaining = item.assignments.filter((assignment) => assignment.personId !== personId).length;
    const choice = await modal(["ลบ ", customName(item.name || "เมนูนี้"), " ออกจาก ", customName(person.name), " ใช่ไหม?"], (remaining ? "ส่วนแบ่งที่ไม่ได้ล็อกจะถูกคำนวณใหม่ โดยคงส่วนแบ่งที่ล็อกไว้ของคนอื่น" : "เมนูนี้จะไม่มีคนเลือก") + " (ย้อนกลับได้)", [{ label: "ยกเลิก", value: false }, { label: "ลบออก", value: true, className: "sheet-danger" }]);
    if (!choice) return;
    const selected = captured.bill.items.filter((item2) => item2.id !== itemId && item2.assignments.some((assignment) => assignment.personId === personId)).map((item2) => item2.id);
    if (await commitCandidate(setPersonMenus(captured.bill, personId, selected).bill, { baseRevision: captured.recordRevision, kind: "remove-person-menu" })) renderSummary();
  },
  exportSummary: startSummaryImage
};
var peopleMount = null;
function peopleRenderModel(extra = {}) {
  return { working: workingBill(), peopleDraft: getPeopleDraft(), editingPid, ...extra };
}
function renderPeople() {
  const model = peopleRenderModel();
  if (peopleMount) peopleMount.update(model);
  else peopleMount = mountPeople(model, peopleViewActions);
}
function renderPeopleList() {
  if (peopleMount) peopleMount.update(peopleRenderModel({ listOnly: true }));
}
var peopleViewActions = {
  donePeople: () => editors.run(() => runBillAction(handleBack)),
  capturePeople: updatePeopleDraft,
  addPerson: doAddPerson,
  editPerson: doEditPerson,
  deletePerson: doDelPerson,
  composing: () => editors.composing,
  saving: () => billState().saving,
  renamePerson(id) {
    if (editingPid && editingPid !== id) {
      toast("บันทึกหรือยกเลิกชื่อที่กำลังแก้ก่อน");
      return;
    }
    editingPid = id;
    updatePeopleDraft({ rename: { id, value: workingBill().people.find((person) => person.id === id).name } });
    renderPeopleList();
    document.getElementById("ep-" + id)?.focus();
  },
  cancelRename() {
    editingPid = null;
    updatePeopleDraft({ rename: null });
    renderPeopleList();
    updateBillContext();
  }
};
var itemMount = null;
function renderItemDetail() {
  recordItem();
  const model = { working: workingBill(), item: currentItem(), twoLine: isItemDetailTwoLine() };
  if (itemMount) itemMount.update(model);
  else itemMount = mountItem(model, itemViewActions());
}
function itemViewActions() {
  const captured = session;
  const matches = () => session === captured;
  return {
    bindBillAction,
    bindPeopleEntry,
    isTwoLine: isItemDetailTwoLine,
    bindEditorAction: (node, action) => editors.bind(node, action),
    currentItem: () => matches() ? currentItem() : null,
    installItemDraft: (item) => {
      if (matches()) installItemDraft(item);
    },
    recordItem: () => {
      if (matches()) recordItem();
    },
    renderItem: () => {
      if (matches()) renderItemDetail();
    },
    shares: getDA,
    recalculate: applyC,
    setAllocation,
    headerTotal: updateHdrTotal,
    title: setSubTitle,
    done: doneAction,
    doneSticky: () => editors.run(doneAction),
    async deleteItem() {
      if (!matches()) return;
      const item = currentItem();
      const hasInput = item.name.trim() || item.price > 0 || item.assignments.length;
      if (hasInput && await confirmDelete(item.name || "เมนูนี้", "ข้อมูลการหารจ่ายทั้งหมดของเมนูนี้จะถูกลบ") !== "y") return;
      if (!matches()) return;
      if (!session.snapshot().isNew) {
        billController.editWorking((draft) => {
          draft.items = draft.items.filter((item2) => item2.id !== activeItemId);
        });
        if (!await saveS()) return;
      }
      teardownItemDetail();
      session = null;
      goto(prevView);
    }
  };
}
function renderSummary({ keepControls = false } = {}, snapshot2 = billState()) {
  if (!keepControls) mainScroll.before("summary");
  const model = billRenderModel({ keepControls }, snapshot2);
  if (summaryMount) summaryMount.update(model);
  else summaryMount = mountSummary(model, billViewActions);
  if (!keepControls) mainScroll.after("summary");
}
function renderBillProblem(snapshot2 = billState()) {
  updateBillContext(snapshot2);
  if (snapshot2.record) return;
  const el = document.getElementById("screen-" + view), empty = document.createElement("div");
  empty.className = "empty bill-exception";
  const message = document.createElement("p");
  message.setAttribute("role", "status");
  message.textContent = snapshot2.entryPhase === "loading" ? "กำลังเปิดบิล…" : snapshot2.error || "เลือกบิลที่ต้องการเปิด";
  empty.append(message);
  function action(label, id, callback, allowPending = false) {
    const button2 = document.createElement("button");
    button2.type = "button";
    button2.id = id;
    button2.className = "btn btn-s";
    button2.textContent = label;
    bindBillAction(button2, callback, { allowPending });
    empty.append(button2);
  }
  if (snapshot2.entryPhase !== "loading") action("ดูตัวเลือก", "bill-recovery", () => recovery.show(), true);
  el.replaceChildren(empty);
}
function render(snapshot2 = billState()) {
  updateBillContext(snapshot2);
  const oldWork = document.getElementById("old-work");
  if (oldWork) oldWork.hidden = !snapshot2.record || !hasOldWork();
  if (!snapshot2.record) {
    renderBillProblem(snapshot2);
    return;
  }
  if (view === "menu") renderMenu(snapshot2);
  else if (view === "people") renderPeople();
  else if (view === "item-detail") renderItemDetail();
  else if (view === "summary") renderSummary({}, snapshot2);
}
function goto(v, opts = {}) {
  mainScroll.leave();
  if (v !== "menu") {
    menuMount?.dispose();
    menuMount = null;
  }
  if (v !== "summary") {
    summaryMount?.dispose();
    summaryMount = null;
  }
  if (v !== "people") {
    peopleMount?.dispose();
    peopleMount = null;
  }
  if (v !== "item-detail") {
    itemMount?.dispose();
    itemMount = null;
  }
  document.getElementById("sticky-done-wrap").style.display = "none";
  document.getElementById("screen-" + view)?.classList.remove("active");
  if (v === "menu" || v === "summary") prevView = v;
  controls?.close();
  view = v;
  if (opts.itemId !== void 0) activeItemId = opts.itemId;
  const tabs = document.getElementById("top-tabs"), backBtn = document.getElementById("btn-back"), hdrTotal = document.getElementById("hdr-item-total");
  const isSub = v === "item-detail" || v === "people";
  document.body.classList.toggle("subpage", isSub);
  document.getElementById("app-footer").style.display = v === "people" ? "none" : "";
  if (v === "item-detail") {
    const it = currentItem();
    setSubTitle(it?.name || "เมนูใหม่");
    tabs.style.display = "none";
    backBtn.style.display = "flex";
    const total = getItemTotal(it || { price: 0, quantity: 1 });
    if (total > 0) {
      hdrTotal.textContent = fmt(total, "บาท");
      hdrTotal.style.display = "block";
    } else hdrTotal.style.display = "none";
  } else if (v === "people") {
    setSubTitle("รายชื่อคนที่โต๊ะอาหาร");
    tabs.style.display = "none";
    backBtn.style.display = "flex";
    hdrTotal.style.display = "none";
  } else {
    setMainTitle();
    tabs.style.display = "flex";
    backBtn.style.display = "none";
    hdrTotal.style.display = "none";
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === v));
    updateTabHint();
  }
  document.getElementById("screen-" + v)?.classList.add("active");
  updateBillContext();
  saveUiState();
  if (v === "menu" || v === "summary") {
    const url = new URL(location.href);
    url.searchParams.set("view", v);
    if (activeSession()) url.searchParams.set("bill", activeSession().billId);
    else if (billState().missingTarget !== null) url.searchParams.set("bill", billState().missingTarget);
    else url.searchParams.delete("bill");
    history.replaceState(history.state, "", url);
  }
  render();
  updateHistory();
  if (isSub) {
    if (opts.restoreScroll) mainScroll.restoreTransient(opts.restoreScroll);
    else window.scrollTo({ top: 0, behavior: "instant" });
  }
}
async function handleBack() {
  if (editors.composing) return;
  if (view === "item-detail") {
    recordItem();
    if (session?.dirty && !isItemDefault(session.snapshot().draft)) {
      if (!await confirmDiscard({ fallback: () => document.getElementById("bill-selector") })) return;
    }
    session = null;
    teardownItemDetail();
    goto(prevView);
  } else if (view === "people") {
    capturePeopleDraft();
    const target = peopleReturnTo;
    if (!target || target.billId !== activeSession()?.billId) {
      toast("เปิดบิลเดิมก่อนกลับจากรายชื่อคน");
      return;
    }
    const rename = getPeopleDraft().rename, addition = getPeopleDraft().add.trim();
    if (rename && !rename.value.trim()) {
      toast("ชื่อห้ามว่าง");
      return;
    }
    const names = workingBill().people.map((p) => (p.id === rename?.id ? rename.value : p.name).trim().toLowerCase());
    if (rename && workingBill().people.some((p) => p.id !== rename.id && p.name.trim().toLowerCase() === rename.value.trim().toLowerCase())) {
      toast("ชื่อนี้ถูกใช้แล้ว");
      return;
    }
    if (addition && names.includes(addition.toLowerCase())) {
      const error = document.getElementById("np-err");
      error.textContent = "ชื่อนี้ถูกใช้แล้ว";
      error.style.display = "block";
      return;
    }
    if (editingPid) {
      if (!await doEditPerson(editingPid)) return;
    }
    if (document.getElementById("np-inp")?.value.trim()) {
      if (!await doAddPerson()) return;
    }
    if (target.billId !== activeSession()?.billId) return;
    peopleReturnTo = null;
    peopleDraftOwner.reset();
    const addInput = document.getElementById("np-inp");
    if (addInput) addInput.value = "";
    for (const input of document.querySelectorAll("#screen-people [data-unsaved]")) delete input.dataset.unsaved;
    goto(target.view, { itemId: target.itemId ?? void 0, restoreScroll: target.view === "item-detail" ? target.scroll : null });
    const opener = target.opener && document.getElementById(target.opener), heading = document.getElementById("hdr-title");
    if (controls?.keyboard && opener?.getClientRects().length) opener.focus({ preventScroll: true });
    else {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }
}
async function handleTabClick(dest) {
  if (view === "item-detail") {
    await handleBack();
    return;
  }
  if (view === "people") {
    await handleBack();
    return;
  }
  editingPid = null;
  if (dest === "summary" && shouldShowSummaryHint()) {
    summaryHintDismissed = true;
    saveUiState();
  }
  goto(dest);
}
headerHistory = mountHistoryControls(document.getElementById("header-history"), { scope: "บิลหรือเมนูที่เปิดอยู่", onUndo: () => runBillAction(() => moveHistory("undo")), onRedo: () => runBillAction(() => moveHistory("redo")), editors });
document.querySelectorAll(".tab-btn").forEach((b) => bindBillAction(b, () => handleTabClick(b.dataset.tab)));
bindBillAction(document.getElementById("btn-back"), handleBack);
var headerObserver = new ResizeObserver(() => {
  updateHistory();
  syncMainStickyOffsets();
});
headerObserver.observe(document.getElementById("hdr"));
headerObserver.observe(document.getElementById("top-tabs"));
headerObserver.observe(document.getElementById("hdr-title"));
headerObserver.observe(document.getElementById("hdr-item-total"));
syncMainStickyOffsets();
listen(window, "resize", handleViewportChange);
listen(window, "orientationchange", handleViewportChange);
if (window.visualViewport) listen(window.visualViewport, "resize", handleViewportChange);
listen(document, "focusin", (e) => {
  const input = e.target, token = mainScroll.generation;
  if (input.matches("input:not([type=radio]):not([type=checkbox]):not([type=file]):not([type=hidden])")) pageTimeout(() => {
    if (token === mainScroll.generation && !mainScroll.restoring && input.isConnected && document.activeElement === input) {
      const r = input.getBoundingClientRect(), bottom = (window.visualViewport?.offsetTop ?? 0) + (window.visualViewport?.height ?? innerHeight) - 80;
      if (r.top < 100 || r.bottom > bottom) input.scrollIntoView({ block: "center", behavior: "auto" });
    }
  }, 300);
});
listen(document, "input", () => queueMicrotask(updateHistory));
if (document.fonts) {
  const relayoutForFonts = () => {
    clearHistoryWidths();
    handleViewportChange({ force: true });
  };
  document.fonts.ready.then(() => {
    if (!pageDisposed) relayoutForFonts();
  });
  listen(document.fonts, "loadingdone", relayoutForFonts);
}
var backupInput = document.getElementById("backup-file");
var selector = document.getElementById("bill-selector"), actionsButton = document.getElementById("bill-actions");
var restoringBackup = false;
function focusBillContext() {
  const generation = mainScroll.generation, owner = controls, interaction = owner?.interaction;
  const keyboard = owner?.keyboard;
  pageFrame(() => {
    if (generation !== mainScroll.generation || owner !== controls || interaction !== controls?.interaction || billState().opening || sheetOpen() || document.querySelector(".bill-panel") || document.activeElement?.matches("input,textarea,select")) return;
    const bounds = selector.getBoundingClientRect(), tabs = document.getElementById("top-tabs").getBoundingClientRect();
    const viewport = window.visualViewport;
    const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight);
    if (keyboard && bounds.width && bounds.top >= tabs.bottom && bounds.bottom <= bottom) selector.focus({ preventScroll: true });
    else {
      const heading = document.getElementById("hdr-title");
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  });
}
bindBillAction(selector, () => controls.openSelector(), { allowPending: true });
bindBillAction(actionsButton, () => controls.openActions(), { allowPending: true });
function requestImport() {
  if (restoringBackup || actionBusy || billState().opening || billState().saving || billControlContext().mutationBlocked) {
    toast("แก้ไขสิ่งที่ค้างไว้ก่อนนำเข้าบิล");
    return;
  }
  if (editors.composing) {
    toast("แก้ไขข้อความให้เสร็จก่อน แล้วนำเข้าบิลอีกครั้ง");
    return;
  }
  backupInput.value = "";
  backupInput.click();
}
backupInput.onchange = async () => {
  const file = backupInput.files?.[0];
  backupInput.value = "";
  if (!file || restoringBackup) return;
  restoringBackup = true;
  try {
    await runBillAction(async () => importReviewed(await readBillFile(file), file.name));
  } finally {
    restoringBackup = false;
  }
};
function newOperation(kind, record) {
  return { kind, id: record?.id ?? newId(), mutationId: newId(), ...kind === "delete" ? { replacementId: newId() } : {}, outcome: null };
}
async function importReviewed(file, filename) {
  if (billControlContext().mutationBlocked) return;
  const operation = newOperation("import");
  await billController.runLibraryOperation(operation, async (current) => {
    const record = await controls.importFile(file, filename, current);
    return record ? current.outcome ?? { status: "saved", record } : null;
  });
}
async function startNew(allowSeparate = false) {
  if (billControlContext().mutationBlocked) return;
  const operation = billState().pendingOperation?.kind === "create" ? billState().pendingOperation : newOperation("create");
  await billController.runLibraryOperation(operation, (current) => repository.createDefault({ ...current, allowSeparate }));
  renderBillProblem();
}
function finishLibraryEffects({ operation, libraryOutcome: outcome, installed, selectedElsewhere }) {
  if (selectedElsewhere) {
    if (operation.kind === "delete") toast("ลบบิลแล้ว");
    return;
  }
  if (operation.kind === "delete") {
    if (installed) {
      finishBillNavigation(outcome.createdDefault ? "menu" : view);
      focusBillContext();
    } else if (!billState().record) goto("menu");
    toast("ลบบิลแล้ว");
    return;
  }
  if (installed) {
    finishBillNavigation(operation.kind === "startup" && !outcome.created ? requestedView() : "menu");
    if (operation.kind !== "startup") {
      focusBillContext();
      if (operation.kind === "create") toast("สร้างบิลใหม่แล้ว");
    }
  }
}
async function dispatchBillAction(kind, target) {
  if (kind !== "new" && (!target || target.id !== activeSession()?.billId || target.id === billState().missingTarget)) return;
  if (kind === "download") {
    downloadText(encodeBillFile(target), billFilename(target.name));
    return;
  }
  if (kind === "details") {
    await controls.details(target);
    return;
  }
  if (billControlContext().mutationBlocked) return;
  if (kind === "new") {
    if (!target) {
      await startNew();
      return;
    }
    while (true) {
      const current = billControlContext().record;
      if (!current || current.id !== target.id || billControlContext().mutationBlocked || billState().storageBlocked) return;
      const choice = await controls.chooseNew(current);
      if (!choice) return;
      if (billControlContext().record?.id !== current.id || billControlContext().mutationBlocked) return;
      if (choice === "save") {
        await startNew();
        return;
      }
      const operation = { ...newOperation("delete", current), createReplacement: true };
      const outcome = await billController.runLibraryOperation(
        operation,
        (pending) => controls.confirmDelete(current, pending, { canReuse: () => {
          const session2 = activeSession();
          if (session2?.billId !== current.id || session2.canUndo || session2.canRedo || session2.dirty || hasPeopleDraft()) return false;
          if (!tabStorage) throw Error("ไม่สามารถตรวจสอบข้อมูลบิลได้ขณะนี้ ลองอีกครั้ง");
          return tabStorage.getItem(receiptDraftKey(current.id)) === null;
        } })
      );
      if (outcome?.status === "reused" && !outcome.selectedElsewhere) {
        mainScroll.reset();
        finishBillNavigation("menu");
        focusBillContext();
        toast("สร้างบิลใหม่แล้ว");
      }
      if (outcome || operation.outcome) return;
    }
  }
  if (kind === "delete") {
    const operation = newOperation("delete", target);
    const outcome = await billController.runLibraryOperation(operation, (current) => controls.confirmDelete(target, current));
    if (!outcome) {
      updateBillContext();
      void checkExternalBill();
    }
  } else await clearCurrent(kind, target);
}
var developmentStorage;
try {
  developmentStorage = localStorage;
} catch {
}
function hasOldWork() {
  try {
    return DEVELOPMENT_WORK_KEYS.some((key) => tabStorage?.getItem(key) != null);
  } catch {
    return false;
  }
}
async function inspectEvidence(id) {
  const model = await readBillEvidence({ repository, developmentStorage, sessionStorage: tabStorage, billId: id });
  const candidate = await controls.evidence(model);
  if (candidate) await importReviewed(candidate, "บิลจากข้อมูลเดิม.json");
}
async function retryOperation() {
  const staged = billState().pendingCandidate;
  const accepted = await billController.retry();
  if (accepted && staged && staged.peopleEdit?.kind !== "delete") {
    let newerItem = false;
    if (session) {
      try {
        const recovered = recoverableBill().items.find((item) => item.id === activeItemId);
        newerItem = !sameValue(recovered, staged.bill.items.find((item) => item.id === activeItemId));
      } catch {
        newerItem = true;
      }
    }
    if (session && !newerItem) {
      teardownItemDetail();
      session = null;
      goto(prevView);
    } else render();
  } else if (!accepted && billState().error) toast(billState().error);
  updateBillContext();
  updateHistory();
  return accepted;
}
bindBillAction(document.getElementById("old-work"), () => inspectEvidence(), { allowPending: true });
async function clearCurrent(kind, target) {
  let capture = target;
  const mutationId = newId();
  const people = kind === "people";
  const title = () => [`${people ? "ลบรายชื่อคนทั้งหมด" : "ลบเมนูอาหารทั้งหมด"}ในบิล `, customName(capture.name), " ใช่ไหม?"];
  const body = () => people ? `รายชื่อ ${capture.bill.people.length} คนและการเลือกคนในทุกเมนูจะถูกลบ เมนู ราคา และค่าปรับยอดยังอยู่ (ย้อนกลับได้)` : capture.bill.items.length ? `เมนู ${capture.bill.items.length} รายการและข้อมูลการหารจ่ายจะถูกลบ พร้อมรีเซ็ต Service Charge, VAT และส่วนลด ชื่อบิลและรายชื่อคนยังอยู่ (ย้อนกลับได้)` : "ยังไม่มีเมนู จะรีเซ็ต Service Charge, VAT ส่วนลด และข้อมูลยอดใบเสร็จเดิม โดยเก็บชื่อบิลและรายชื่อคนไว้ (ย้อนกลับได้)";
  const result = await openSheet({ title: title(), body: "<p></p>", mount: (host) => {
    host.body.querySelector("p").textContent = body();
  }, actions: [{ label: "ยกเลิก", value: false }, { label: people ? "ลบรายชื่อทั้งหมด" : capture.bill.items.length ? "ลบเมนูทั้งหมด" : "รีเซ็ตค่าปรับยอด", className: "sheet-danger", run: async (host) => {
    const latest = await repository.read(capture.id);
    if (!latest) throw Error("ไม่พบข้อมูลบิลนี้ในเบราว์เซอร์");
    if (latest.recordRevision !== capture.recordRevision) {
      capture = latest;
      adoptRefreshed(await activeSession().load());
      host.setTitle(title());
      host.body.querySelector("p").textContent = body();
      throw Error("บิลนี้มีการเปลี่ยนแปลง เช็กบิลล่าสุดแล้วกดยืนยันอีกครั้ง");
    }
    const candidate = (people ? clearPeople : clearDishes)(capture.bill);
    const outcome = await activeSession().commit(candidate, { baseRevision: capture.recordRevision, kind: "clear-" + kind, mutationId });
    if (!acceptBill(outcome)) throw Error(outcome.message);
    return true;
  } }] });
  if (!result) billController.releaseSheetCandidate("clear-" + kind, target.id);
  if (result) {
    pruneCollapsedPeople();
    render();
  }
}
function checkExternalBill() {
  return billController.reconcile();
}
var libraryChannel;
try {
  libraryChannel = new BroadcastChannel("fairshare-library");
  libraryChannel.onmessage = () => checkExternalBill();
} catch {
}
listen(window, "fairshare-storage-versionchange", () => {
  void checkExternalBill();
});
listen(window, "focus", checkExternalBill);
listen(window, "pageshow", checkExternalBill);
listen(window, "pagehide", (event) => {
  controls?.close();
  if (event.persisted === false) disposePage();
});
listen(document, "visibilitychange", () => {
  if (!document.hidden) checkExternalBill();
});
listen(window, "beforeunload", (event) => {
  if (nameEditor?.dirty || nameEditor?.busy || actionBusy && billState().pendingOperation || operationUncertain() || billState().pendingCandidate || billState().invalidCandidate || billState().saving || session?.dirty || hasPeopleDraft() || document.querySelector("#app .screen.active [data-unsaved]") || view === "people" && document.getElementById("np-inp")?.value.trim()) {
    event.preventDefault();
    event.returnValue = "";
  }
});
listen(document, "input", (event) => {
  if (event.target.matches("#app input:not([type=radio]):not([type=checkbox]):not([type=file])")) event.target.dataset.unsaved = "true";
  updateBillContext();
});
listen(document, "focusout", () => queueMicrotask(updateBillContext));
var requestedView = () => new URL(location.href).searchParams.get("view") === "summary" ? "summary" : "menu";
function mountBillControls() {
  controls?.dispose();
  nameEditor?.dispose();
  nameEditor = createBillNameEditor({ input: document.getElementById("bill-selector-name"), feedback: document.getElementById("bill-name-feedback"), repository, getContext: billControlContext, onStateChange: (state, context) => {
    nameSaving = state.busy;
    syncBusy();
    document.getElementById("main").inert = context.mainBlocked || state.busy || state.problem;
    document.getElementById("top-tabs").inert = context.tabsBlocked || state.problem;
    if (!state.busy && !state.problem && !nameEditor?.unsettled && context.reconciliationQueued) queueMicrotask(checkExternalBill);
  }, onSaved: async (record) => {
    if (record.id !== billState().billId) return;
    const result = await billController.refresh({ preserveWorking: true, quiet: true });
    if (result.status !== "loaded") throw Error(result.message || "เปิดข้อมูลล่าสุดไม่ได้ ลองอีกครั้ง");
  } });
  controls = createBillControls({
    repository,
    selector,
    actionsButton,
    getContext: billControlContext,
    bindAction: (node, action, options) => bindBillAction(node, action, { ...options, allowPending: true }),
    onSelect: (id) => selectRecoveryBill(id),
    onAction: dispatchBillAction,
    onInspect: inspectEvidence,
    onRequestImport: requestImport,
    onDownload: ({ text: text2, filename, type }) => downloadText(text2, filename, type),
    onError: toast
  });
}
function onBillChange(event) {
  const snapshot2 = event.snapshot;
  if (snapshot2.opening && !openingPresentation) {
    mainScroll.leave();
    saveUiState(snapshot2);
  }
  openingPresentation = snapshot2.opening;
  if (snapshot2.saving !== savingPresentation) setSaving(snapshot2.saving);
  syncBusy();
  if (event.reason === "opened") {
    const url = new URL(location.href);
    url.searchParams.set("bill", snapshot2.billId);
    url.searchParams.delete("select");
    history.replaceState(history.state, "", url);
    session = null;
    editingPid = null;
    peopleReturnTo = null;
    peopleDraftOwner.reset();
    collapsedPeople.clear();
    summaryHintDismissed = false;
    try {
      const ui = JSON.parse(tabStorage?.getItem(uiKey()) || "null");
      collapsedPeople = new Set(ui?.collapsed ?? []);
      summaryHintDismissed = !!ui?.summaryHintDismissed;
    } catch {
    }
    pruneCollapsedPeople(snapshot2);
    clearHistoryWidths();
    invalidateBT();
  }
  if (event.accepted) {
    const completed = event.completedPeopleEdit;
    if (completed?.kind === "add" && getPeopleDraft().add.trim() === completed.name) updatePeopleDraft({ add: "" });
    if (completed?.kind === "rename" && getPeopleDraft().rename?.id === completed.id && getPeopleDraft().rename.value.trim() === completed.name) {
      updatePeopleDraft({ rename: null });
      editingPid = null;
    }
    if (completed?.kind === "delete" && completed.billId === snapshot2.billId) {
      session?.mapPeople((item) => removePersonFromItem(item, completed.id));
      renderPeopleList();
    }
    for (const input of document.querySelectorAll("#app .screen.active [data-unsaved]")) delete input.dataset.unsaved;
    invalidateBT();
    pruneCollapsedPeople(snapshot2);
    updateBillTotals(snapshot2);
  }
  if (event.reason === "reconciled" && event.changed) {
    invalidateBT();
    pruneCollapsedPeople(snapshot2);
    render(snapshot2);
  }
  if (event.reason === "operation-finished") finishLibraryEffects(event);
  if (event.message) toast(event.message);
  updateBillContext(snapshot2);
  updateHistory(snapshot2);
}
async function initialize() {
  const url = new URL(location.href), explicit = url.searchParams.get("bill"), select = url.searchParams.get("select") === "1";
  try {
    repository?.close();
    repository = null;
    billController.reportEntryProblem("loading", "");
    render();
    repository = await openBillRepository({ developmentStorage });
    mountBillControls();
    if (explicit !== null) await installBill(explicit, requestedView(), { reason: "startup" });
    else if (select) {
      billController.reportEntryProblem("missing", "เลือกบิลที่บันทึกไว้ หรือสร้างบิลใหม่เพื่อเริ่ม");
      goto("menu");
    } else {
      const operation = billState().pendingOperation?.kind === "startup" ? billState().pendingOperation : newOperation("startup");
      await billController.runLibraryOperation(operation, (current) => repository.ensureDefault(current));
      if (!billState().record) goto("menu");
    }
    if (select) {
      await controls.openSelector();
      const current = new URL(location.href);
      if (selector.getAttribute("aria-expanded") === "true") {
        current.searchParams.delete("select");
        history.replaceState(history.state, "", current);
      }
    }
  } catch (error) {
    if (!controls || !repository) mountBillControls();
    billController.reportEntryProblem("unavailable", error.message);
    goto("menu");
  }
}
function disposePage() {
  if (pageDisposed) return;
  pageDisposed = true;
  pageLifetime.abort();
  for (const timer of pageTimers) clearTimeout(timer);
  for (const frame of pageFrames) cancelAnimationFrame(frame);
  pageTimers.clear();
  pageFrames.clear();
  clearHistoryWidths();
  cancelAnimationFrame(resizeRAF);
  clearTimeout(tT);
  mainScroll.dispose();
  menuMount?.dispose();
  summaryMount?.dispose();
  peopleMount?.dispose();
  itemMount?.dispose();
  controls?.dispose();
  nameEditor?.dispose();
  headerHistory?.dispose();
  headerObserver.disconnect();
  recovery.dispose();
  editors.dispose();
  billController.dispose();
  libraryChannel?.close();
  repository?.close();
  session = null;
}
await initialize();
