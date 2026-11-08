// One million units represent the whole item; one percent is 10,000 units.
// Resolved money is always integer satang. Only edits recalculate it.
const SCALE = 1000000n;
const totalOf = item => item.priceSource === 'line_total' ? item.priceCents : item.priceCents * item.quantity;
const roundRatio = (numerator, denominator) => (numerator * 2n + denominator) / (denominator * 2n);

function quotas(values, denominator) {
  const parts = values.map((value, index) => ({index, amount: value / denominator, remainder: value % denominator}));
  let remaining = roundRatio(values.reduce((sum, value) => sum + value, 0n), denominator)
    - parts.reduce((sum, part) => sum + part.amount, 0n);
  // Joint rounding conserves the rounded total. Stored order breaks equal ties.
  const remainderOrder = [...parts].sort((a, b) => a.remainder === b.remainder
    ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const part of remainderOrder) {
    if (remaining-- <= 0n) break;
    part.amount++;
  }
  return parts.map(part => Number(part.amount));
}

export function normalizeAssignmentLocks(item) {
  const next = structuredClone(item);
  const total = totalOf(next);
  const missing = next.assignments.filter(assignment => assignment.lockMode == null && assignment.locked);
  const units = total
    ? quotas(missing.map(assignment => BigInt(assignment.amountCents) * SCALE), BigInt(total))
    : missing.map(() => 0);
  let index = 0;
  for (const assignment of next.assignments) {
    if (assignment.lockMode == null) {
      assignment.lockMode = 'percentage';
      assignment.lockPercentUnits = assignment.locked ? units[index++] : 0;
    }
  }
  return next;
}

export function allocationOvercommitted(item) {
  const next = normalizeAssignmentLocks(item);
  const total = BigInt(totalOf(next));
  let quota = 0n;
  for (const assignment of next.assignments) {
    if (!assignment.locked) continue;
    quota += assignment.lockMode === 'amount'
      ? BigInt(assignment.amountCents) * SCALE
      : total * BigInt(assignment.lockPercentUnits);
  }
  return quota > total * SCALE;
}

export function recalculateItemAssignments(item) {
  const next = normalizeAssignmentLocks(item);
  const total = totalOf(next);
  const percentages = next.assignments.filter(assignment => assignment.locked && assignment.lockMode === 'percentage');
  const resolved = quotas(percentages.map(assignment => BigInt(total) * BigInt(assignment.lockPercentUnits)), SCALE);
  percentages.forEach((assignment, index) => { assignment.amountCents = resolved[index]; });
  const overallocated = allocationOvercommitted(next);
  const locked = next.assignments.reduce((sum, assignment) => sum + (assignment.locked ? assignment.amountCents : 0), 0);
  const unlocked = next.assignments.filter(assignment => !assignment.locked);
  const remainder = overallocated ? 0 : Math.max(0, total - locked);
  const each = unlocked.length ? Math.floor(remainder / unlocked.length) : 0;
  const extra = unlocked.length ? remainder % unlocked.length : 0;
  unlocked.forEach((assignment, index) => { assignment.amountCents = each + (index < extra ? 1 : 0); });
  return {item: next, overallocated};
}
