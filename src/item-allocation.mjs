// Current-app allocation rules. Reads preserve resolved cents; only edits recalculate.
const SCALE=1000000n;
const totalOf=it=>it.priceSource==='line_total'?it.priceCents:it.priceCents*it.quantity;
const roundRatio=(n,d)=>(n*2n+d)/(d*2n);
function quotas(values,denominator){
  const parts=values.map((n,i)=>({i,n:n/denominator,r:n%denominator}));
  let rest=roundRatio(values.reduce((a,b)=>a+b,0n),denominator)-parts.reduce((s,p)=>s+p.n,0n);
  for(const p of [...parts].sort((a,b)=>a.r===b.r?a.i-b.i:a.r>b.r?-1:1)){if(rest--<=0n)break;p.n++;}
  return parts.map(p=>Number(p.n));
}
export function normalizeAssignmentLocks(item){
  const it=structuredClone(item),total=totalOf(it);
  const missing=it.assignments.filter(a=>a.lockMode==null&&a.locked);
  const units=total?quotas(missing.map(a=>BigInt(a.amountCents)*SCALE),BigInt(total)):missing.map(()=>0);
  let i=0;
  for(const a of it.assignments)if(a.lockMode==null){a.lockMode='percentage';a.lockPercentUnits=a.locked?units[i++]:0;}
  return it;
}
export function allocationOvercommitted(item){
  const it=normalizeAssignmentLocks(item),total=BigInt(totalOf(it));let quota=0n;
  for(const a of it.assignments)if(a.locked)quota+=a.lockMode==='amount'?BigInt(a.amountCents)*SCALE:total*BigInt(a.lockPercentUnits);
  return quota>total*SCALE;
}
export function recalculateItemAssignments(item){
  const it=normalizeAssignmentLocks(item),total=totalOf(it),percent=it.assignments.filter(a=>a.locked&&a.lockMode==='percentage');
  const resolved=quotas(percent.map(a=>BigInt(total)*BigInt(a.lockPercentUnits)),SCALE);
  percent.forEach((a,i)=>{a.amountCents=resolved[i];});
  const overallocated=allocationOvercommitted(it),locked=it.assignments.reduce((s,a)=>s+(a.locked?a.amountCents:0),0),unlocked=it.assignments.filter(a=>!a.locked);
  const remainder=overallocated?0:Math.max(0,total-locked),each=unlocked.length?Math.floor(remainder/unlocked.length):0,extra=unlocked.length?remainder%unlocked.length:0;
  unlocked.forEach((a,i)=>{a.amountCents=each+(i<extra?1:0);});
  return {item:it,overallocated};
}
