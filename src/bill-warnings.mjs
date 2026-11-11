import { approvedItemOvercommitted, approvedShares } from './approved-ui-bridge.mjs';
import { getItemTotal, fmtTrim } from './bill-display.mjs';
export const ZERO_SHARE_SUFFIX = ' มีส่วนแบ่ง 0 บาท หรือติดลบ';
export const ZERO_THRESHOLD = 0.005;
const DIFF_THRESHOLD = 0.00005;
const r4 = value => Math.round(value * 10000) / 10000;
export function getItemWarnings(item, people) {
  const warnings = [],
    total = getItemTotal(item),
    assignments = item.assignments || [];
  const hasName = item.name.trim().length > 0;
  const hasPrice = total > 0;
  if (approvedItemOvercommitted(item)) {
    warnings.push({
      type: 'over',
      diff: Math.max(0, assignments.filter(a => a.locked).reduce((sum, a) => sum + a.amount, 0) - total),
      msg: 'ยอดที่ล็อกไว้เกินราคารายการ โปรดปรับส่วนแบ่งหรือปลดล็อก'
    });
    return warnings;
  }
  if (hasName && !hasPrice) {
    warnings.push({
      type: 'no_price',
      msg: 'ยังไม่ได้ใส่ราคา'
    });
    return warnings;
  }
  if (!assignments.length) {
    warnings.push({
      type: 'unassigned',
      msg: 'ยังไม่ได้เลือกคน'
    });
    return warnings;
  }
  const locked = assignments.filter(a => a.locked),
    unlocked = assignments.filter(a => !a.locked);
  const lockedSum = locked.reduce((s, a) => s + (a.amount || 0), 0);
  if (total > 0) {
    if (!unlocked.length) {
      const diff = r4(lockedSum - total);
      if (Math.abs(diff) > DIFF_THRESHOLD) warnings.push({
        type: diff > 0 ? 'over' : 'under',
        diff: Math.abs(diff),
        msg: diff > 0 ? `ยอดแชร์เกินมา ${fmtTrim(diff, 'บาท')}` : `ยอดแชร์ขาดไป ${fmtTrim(-diff, 'บาท')}`
      });
    } else if (lockedSum > total + DIFF_THRESHOLD) {
      const diff = r4(lockedSum - total);
      warnings.push({
        type: 'over',
        diff,
        msg: ` ยอดแชร์เกินมา ${fmtTrim(diff, 'บาท')}`
      });
    }
  }
  const displayed = approvedShares(item);
  assignments.forEach(a => {
    if (total > 0 && (displayed[a.personId]?.amount || 0) <= ZERO_THRESHOLD) {
      const person = people.find(x => x.id === a.personId);
      warnings.push({
        type: 'zero',
        personId: a.personId,
        msg: `${person?.name || '?'}${ZERO_SHARE_SUFFIX}`
      });
    }
  });
  return warnings;
}
export function categorizeWarns(warnings) {
  return {
    overUnder: warnings.find(w => w.type === 'over' || w.type === 'under'),
    zeroWarns: warnings.filter(w => w.type === 'zero')
  };
}
export function getSplitLabel(item, people) {
  const warnings = getItemWarnings(item, people),
    assignments = item.assignments || [];
  const noPriceWarn = warnings.find(w => w.type === 'no_price');
  if (noPriceWarn) return {
    text: '⚠ ยังไม่ได้ใส่ราคา',
    cls: 'bz'
  };
  if (!assignments.length) return {
    text: '⚠ ยังไม่ได้เลือกคน',
    cls: 'bz'
  };
  if (warnings.length) {
    const {
      overUnder,
      zeroWarns
    } = categorizeWarns(warnings);
    if (overUnder) {
      let label = '⚠ ' + (overUnder.type === 'over' ? `เกินมา ${fmtTrim(overUnder.diff, 'บาท')}` : `ขาดไป ${fmtTrim(overUnder.diff, 'บาท')}`);
      if (label.length > 28) label = label.slice(0, 26) + '…';
      return {
        text: label,
        cls: 'bz'
      };
    }
    if (zeroWarns.length === 1) {
      const person = people.find(x => x.id === zeroWarns[0].personId);
      let label = `⚠ ${person?.name || '?'} จ่าย ≤ 0 บาท`;
      if (label.length > 28) label = label.slice(0, 26) + '…';
      return {
        text: label,
        cls: 'bz'
      };
    }
    if (zeroWarns.length > 1) return {
      text: `⚠ ${zeroWarns.length} คน จ่าย ≤ 0 บาท`,
      cls: 'bz'
    };
    let message = warnings[0].msg;
    if (message.length > 24) message = message.slice(0, 22) + '…';
    return {
      text: '⚠ ' + message,
      cls: 'bz'
    };
  }
  if (assignments.length === 1) return {
    text: '✓ กินคนเดียว',
    cls: 'solo-badge'
  };
  return assignments.filter(a => a.locked).length ? {
    text: '✓ แบ่งจ่ายเอง',
    cls: 'bf'
  } : {
    text: '✓ หารเท่า',
    cls: 'ba'
  };
}
export function getPersonWarning(personId, state, totals) {
  if (totals && totals.pt[personId] !== undefined && totals.pt[personId].total <= 0) return true;
  if (!state.items.some(it => it.assignments.some(a => a.personId === personId))) return true;
  for (const item of state.items) {
    const assignments = item.assignments.find(a => a.personId === personId);
    if (!assignments) continue;
    if (getItemTotal(item) <= 0) continue;
    const displayedShares = approvedShares(item);
    if (displayedShares[personId] && displayedShares[personId].amount <= ZERO_THRESHOLD) return true;
  }
  return false;
}
