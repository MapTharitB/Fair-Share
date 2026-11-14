import {receiptNumber,receiptDigits,emptyReceiptEvidence,fieldIssue} from './receipt-fields.mjs';
// Current comparison is derived. Source warnings and printed fields never change.
export function getReceiptDiscrepancy(row){
  const e=row.evidence;
  if(row.priceEdited||row.qty==null||e?.unitCents==null||e?.totalCents==null)return null;
  const calculatedCents=e.unitCents*row.qty;
  return calculatedCents===e.totalCents?null:{calculatedCents,printedCents:e.totalCents};
}
// Extracted from Baseline/Parser.html parser helpers; no UI or OCR.
export function createReceiptParser({createId = ()=>Math.random().toString(36).slice(2,9)} = {}) {
const UNIT_WORDS = new Set(["ขวด","แก้ว","จาน ","ชาม","ชิ้น","ถ้วย","ชุด","แพ็ค","กล่อง","กระป๋อง","โหล","ถุง","อัน","ที่","หัว","ตัว","กิโล","กก","ลิตร","มล","คู่","แผ่น","เส้น","portion","pcs","pc","set","bottle","glass","can","box","cup","bowl"]);
const CATEGORY_LABELS=new Set(['อาหาร','เครื่องดื่ม','อาหารและเครื่องดื่ม','อื่นๆ']);
const r2 = n=>Math.round(n*100)/100;
const uid = createId;
const stripPunct = s=>String(s||"").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,"").trim();
function nfc(s){return String(s??"").normalize("NFC");}
const SUMMARY_MORPHEMES_TH=["ทั้งสิ้น","ยอด","รวม","สุทธิ","ราคา","ภาษี","เงิน","ชำระ","จ่าย","ทอน","ก่อน","หลัง","ค่า","สินค้า","ทั้ง","หมด","อาหาร"];
const SAFE_COLUMN_MORPHEMES=["รายการสินค้า","ราคาสินค้า","จำนวนเงิน","หน่วยละ","รายการ","สินค้า","อาหาร","จำนวน","หน่วย","ราคา","รหัส","ชิ้น"];
function coversBy(word,morphemeList){const n=word.length;const reach=new Uint8Array(n+1);reach[0]=1;for(let i=0;i<n;i++){if(!reach[i])continue;for(const m of morphemeList){if(i+m.length<=n&&word.slice(i,i+m.length)===m)reach[i+m.length]=1;}}return reach[n]===1;}
function isSummaryByComposition(line){const s=nfc(String(line||"")).trim();const words=s.replace(/[\d%.,฿$()\-:;/\\]+/g," ").trim().split(/\s+/).filter(w=>/\p{L}/u.test(w));return words.length>0&&words.every(w=>coversBy(w,SUMMARY_MORPHEMES_TH));}
const SAFE_PLUS_SUMMARY=[...SAFE_COLUMN_MORPHEMES,...SUMMARY_MORPHEMES_TH];
const FIELD_LABEL_RE=/^(?:qty|quantity|จำนวน|price|ราคา|unit\s*price|หน่วยละ|line\s*total|จำนวนเงิน|amount|สินค้า|อาหาร|รายการ|รายการสินค้า|ราคาสินค้า|item\s*(?:id|no\.?)|no\.?|เลขที่|table|โต๊ะ|order|invoice|bill|receipt|ref|code|id|branch|สาขา|staff|cashier|พนักงาน|แคชเชียร์|ลูกค้า|customer|phone|tel|telephone|mobile|มือถือ|โทร|เบอร์|date|time|วันที่|เวลา|รหัส|ชิ้น|sku|covers|pax|guests|duration|event)$/i;
const DATE_RE=/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}$/;
const TIME_RE=/^\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?$/;
const PHONE_RE=/^0\d[\d\s-]{7,9}$/;
const LONG_NUM_RE=/^\d{7,}$/;
const ALNUM_ID_RE=/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9][A-Za-z0-9-]{5,}$/;
const SEPARATOR_RE=/^[-=*─━·•─═]{3,}$/;
const DISCOUNT_RE=/(?:^-\s*\d|ส่วนลด|ลดราคา|ลดพิเศษ|หักส่วนลด|discount|disc\.?|promo(?:tion|โมชั่น)?|coupon|คูปอง|voucher|วาวเชอร์|rebate)/i;
const POST_DISCOUNT_TOTAL_RE=/^(?:ยอด|รวม|net|total|ราคา)\S*(?:หลัง|after)/iu;
const KV_PAIR_RE=/\b([\p{L}][\p{L} ]{1,20}):\s*\S+/gu;
const KV_META_KEY_RE=/^(?:table|โต๊ะ|cover|covers|pax|guests|staff|cashier|แคชเชียร์|date|time|วันที่|เวลา|order|invoice|ref|duration|event|branch|สาขา|phone|tel|โทร|time\s*in|time\s*out|in|out)$/i;
function isMultiKVMetaLine(line){const matches=[...nfc(line).matchAll(KV_PAIR_RE)];if(matches.length<2)return false;return matches.some(m=>KV_META_KEY_RE.test(m[1].trim()));}
function isSafeColumnHeader(line){const s=nfc(String(line||"")).trim();if(!/\p{L}/u.test(s))return false;const words=s.replace(/[\d%.,฿$€()\-:;/\\]+/g," ").trim().split(/\s+/).filter(w=>/\p{L}/u.test(w));if(!words.length)return false;const isCovered=w=>FIELD_LABEL_RE.test(w)||coversBy(w,SAFE_PLUS_SUMMARY);const isSafe=w=>FIELD_LABEL_RE.test(w)||coversBy(w,SAFE_COLUMN_MORPHEMES);return words.every(isCovered)&&words.some(isSafe);}
const STRONG_SUMMARY_RE=/^(?:subtotal|sub\stotal|grand\stotal|net\stotal|total|amount\sdue|balance\sdue|balance|ยอดรวม|ยอดช(?:ำ|ํา)ระ|ยอดสุทธิ|ยอดรวมสุทธิ|ยอดรวมทั้งสิ้น|ยอดที่ต้องช(?:ำ|ํา)ระ|ยอดเงิน|รวมสุทธิ|รวมทั้งสิ้น|รวมเงิน|สุทธิ|ทั้งสิ้น|ราคารวม|ราคาสุทธิ|ก่อนภาษี|หลังภาษี|ภาษีมูลค่าเพิ่ม|ภาษี|เงินสด|เงินทอน|ทอน|รับเงิน|จ่ายเงิน|ช(?:ำ|ํา)ระเงิน|พร้อมเพย์|promptpay|prompt\spay|qr\scode|qr|credit\scard|debit\s*card|transfer|โอนเงิน|บัตรเครดิต|บัตรเดบิต|service\scharge|servicecharge|svc\scharge|ค่าบริการ|ค่าเซอร์วิส|rounding|rounded|change|before\s+(?:vat|tax)|after\s+(?:vat|tax)|vat\s+(?:item|items|included|inclusive|exclusive|excl\.?|incl\.?|amount|exempt|zero|rate|subtotal|sub)|ex(?:cl(?:uding)?)?\.?\s*(?:vat|tax)|inc(?:l(?:uding)?)?\.?\s*(?:vat|tax)|vat|value\sadded\stax|visa|amex|american\s+express|jcb|union\s*pay|alipay|paypal|wechat(?:\s*pay)?|true\s+money|line\s+pay|grab\s+pay|shopeepay|shopee\s+pay|e[\s\-]?wallet|gift\s*(?:card|voucher)|master\s*card|rabbit\s*(?:card|pay)|discover\s*card|point\s*(?:redeem(?:ed)?|reward)|(?:ยอด|รวม|net|total|ราคา)\S*(?:หลัง|after)|ใบเสร็จ(?:รับเงิน)?|ใบก(?:ำ|ํา)กับภาษี(?:อย่างย่อ)?|ใบแจ้งหนี้|ใบสั่งซื้อ|tax\s+invoice|ใบเสนอราคา|quotation)(?=[\s%.,฿$\d()\-:]|$)/i;
const WEAK_SUMMARY_RE=/^(?:รวม|ยอด|tip|cash)(?=[\s%.,฿$\d()\-]|$)/i;
const MULTI_KW_SUMMARY_SET=["สุทธิ","ชำระ","ส่วนลด","รวม","ยอด","ราคา","ภาษี","vat","tax","total","discount"];
const SUMMARY_NAME_RE=/^(?:subtotal|sub\stotal|grand\stotal|net\stotal|total|amount\sdue|balance\sdue|ยอดรวม|ยอดชำระ|ยอดสุทธิ|ยอดรวมสุทธิ|ยอดรวมทั้งสิ้น|ยอดที่ต้องชำระ|ยอดเงิน|รวมสุทธิ|รวมทั้งสิ้น|รวมเงิน|รวม|สุทธิ|ยอด|ทั้งสิ้น|ราคารวม|ราคาสุทธิ|ก่อนภาษี|หลังภาษี|เงินสด|เงินทอน|ทอน|รับเงิน|จ่าย|ชำระเงิน|พร้อมเพย์|promptpay|qr|qr\scode|credit\scard|debit\s*card|transfer|โอนเงิน|บัตรเครดิต|บัตรเดบิต|service\scharge|servicecharge|svc\scharge|ค่าบริการ|ค่าเซอร์วิส|vat|ภาษีมูลค่าเพิ่ม|ภาษี|rounding|rounded|cash|change|balance|tip|before\s+(?:vat|tax)|after\s+(?:vat|tax)|vat\s+(?:item|items|included|inclusive|exclusive|excl\.?|incl\.?|amount|exempt|zero|rate|subtotal|sub)|ex(?:cl(?:uding)?)?\.?\s*(?:vat|tax)|inc(?:l(?:uding)?)?\.?\s*(?:vat|tax))$/i;
const TAX_SUBLABEL_RE=/^(?:item|items?|included|inclusive|exclusive|excl\.?|incl\.?|before|after|amount|rate|exempt|zero):?\s*/i;
function isSummaryOrMetaLine(line){
  const s=nfc(String(line||"").trim()); if(!s)return false;
  if(isSafeColumnHeader(s))return true; if(STRONG_SUMMARY_RE.test(s))return true;
  if(isMultiKVMetaLine(s))return true;
  if(/^sc(?=[\s%.,\d]|$)/i.test(s)){const after=s.replace(/^sc\s*/i,"").trim();if(after===""||(/\d/.test(after)&&/^[%\d\s.,฿$()\-]*$/.test(after)))return true;}
  if(WEAK_SUMMARY_RE.test(s)){const afterKeyword=s.replace(WEAK_SUMMARY_RE,"").trim();if(!afterKeyword)return true;if(/\d/.test(afterKeyword)&&/^[%\d\s.,(),฿$()\-]*$/.test(afterKeyword))return true;if(TAX_SUBLABEL_RE.test(afterKeyword)){const remainder=afterKeyword.replace(TAX_SUBLABEL_RE,"").trim();if(!remainder||(/\d/.test(remainder)&&/^[%\d\s.,(),฿$()\-]*$/.test(remainder)))return true;}}
  if(/\d/.test(s)&&isSummaryByComposition(s))return true; return false;
}
function quickClassify(line){const s=nfc(String(line||"")).trim();if(!s)return"empty";if(isSummaryOrMetaLine(s))return"meta";return"item";}
function normalizeText(raw){return receiptDigits(raw??"").replace(/\u0e4d\u0e32/g,"ำ").normalize("NFC").replace(/\u00A0|\u3000|\uFEFF/g," ").replace(/\t+/g," ").replace(/\r/g,"").replace(/[，]/g,",").replace(/[．｡。]/g,".").split("\n").map(l=>l.replace(/\s+/g," ").trim()).filter(Boolean).join("\n");}
function looksComplete(line){
  const tokens=String(line??'').trim().split(/\s+/);
  if(tokens.at(-1)==='?')return true;
  if(/^-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$|^-?\d+(?:\.\d{1,2})?$/.test(tokens.at(-1)))return true;
  // A complete row can end in its name when all three numeric columns precede it.
  return tokens.length>=4&&tokens.slice(0,3).every(t=>receiptNumber(t)!==null)&&tokens.slice(3).some(t=>/\p{L}/u.test(t));
}
const lineText=line=>typeof line==='string'?line:line.text;
function joinLines(lines){return typeof lines[0]==='string'?lines.join(' '):{text:lines.map(lineText).join(' '),sourceLines:lines.flatMap(l=>l.sourceLines)};}
function collapseVerticalOCR(lines){
  const numeric=line=>receiptNumber(lineText(line))!==null;
  const count=lines.filter(l=>!isSummaryOrMetaLine(lineText(l))&&numeric(l)).length;
  if(count<3||count/lines.length<0.2)return lines;
  const out=[];let i=0;
  while(i<lines.length){
    if(lines[i]?.table||lines[i]?.categoryHeading){out.push(lines[i++]);continue;}
    if(numeric(lines[i])){i++;continue;}
    const parts=[lines[i++]];
    while(i<lines.length&&!lines[i]?.table&&!lines[i]?.categoryHeading&&!numeric(lines[i])&&parts.length<3)parts.push(lines[i++]);
    let n=0;while(i<lines.length&&numeric(lines[i])){parts.push(lines[i++]);n++;}
    if(n)out.push(joinLines(parts));
  }
  return out;
}
function mergeWrappedLines(lines){
  const out=[];let i=0,prevWasMeta=false;
  while(i<lines.length){
    const cur=lines[i],text=lineText(cur),meta=cur?.categoryHeading||quickClassify(text)==='meta';
    if(cur?.table||meta||looksComplete(text)||prevWasMeta){out.push(cur);prevWasMeta=meta;i++;continue;}
    prevWasMeta=false;const next=lines[i+1],after=lines[i+2];
    if(next&&!next?.table&&!next?.categoryHeading&&quickClassify(lineText(next))!=='meta'&&!looksComplete(lineText(next))&&after&&!after?.table&&!after?.categoryHeading&&quickClassify(lineText(after))!=='meta'&&looksComplete(lineText(after))){out.push(joinLines([cur,next,after]));i+=3;continue;}
    if(next&&!next?.table&&!next?.categoryHeading&&quickClassify(lineText(next))!=='meta'&&/\d/.test(lineText(next))){out.push(joinLines([cur,next]));i+=2;continue;}
    out.push(cur);i++;
  }
  return out;
}
function cleanToken(raw){return stripPunct(raw).replace(/,/g,"");}
function isNoiseToken(raw){const s=cleanToken(raw);if(!s)return true;if(DATE_RE.test(s))return true;if(TIME_RE.test(s))return true;if(PHONE_RE.test(s))return true;if(LONG_NUM_RE.test(s))return true;if(ALNUM_ID_RE.test(s))return true;if(SEPARATOR_RE.test(raw))return true;if(FIELD_LABEL_RE.test(s))return true;return false;}
function isSwallowLabel(raw){const s=cleanToken(raw).toLowerCase();return/^(?:no\.?|เลขที่|table|โต๊ะ|phone|tel|telephone|mobile|มือถือ|โทร|เบอร์|qty|quantity|จำนวน|ราคา|price|unit|หน่วยละ|amount|จำนวนเงิน|subtotal|total|grand|net|ยอดรวม|ยอดชำระ|ยอดสุทธิ|รวมสุทธิ|รวม|สุทธิ|ยอด|ทั้งสิ้น|เงินสด|เงินทอน|ทอน|รับเงิน|ชำระเงิน|vat|ภาษี|order|invoice|bill|receipt|ref|id|code|date|time|วันที่|เวลา|สาขา|branch|staff|cashier|พนักงาน|แคชเชียร์|ลูกค้า|customer|cash|change|balance|tip|rounding)$/i.test(s);}
function stripNoiseTokens(line){const tokens=nfc(String(line||"").trim()).split(/\s+/).filter(Boolean);const kept=[];let swallowNext=false;for(let i=0;i<tokens.length;i++){const raw=tokens[i];if(raw==='?'){kept.push(raw);continue;}const clean=cleanToken(raw);if(!clean)continue;if(/^(?:qty|quantity|จำนวน)$/i.test(clean)&&/^\d{1,2}$/.test(tokens[i+1]??"")){swallowNext=false;continue;}if(/^(?:อาหาร|สินค้า)$/.test(clean)&&/\d/.test(tokens[i+1]??"")){kept.push(raw);continue;}if(isSwallowLabel(raw)){swallowNext=true;continue;}if(swallowNext){if(/^(?:-?\d+(?:[.,]\d{1,2})?|0(?:[\s-]*\d){7,}|(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{2,})$/.test(clean)){swallowNext=false;continue;}swallowNext=false;}if(isNoiseToken(raw))continue;kept.push(raw);}return kept.join(" ").replace(/\s+/g," ").trim();}
function tokenizeLine(line){return nfc(String(line||"").trim()).split(/\s+/).filter(Boolean).map(raw=>{const clean=raw.replace(/,/g,"");if(/^-?\d+(?:\.\d{1,2})?$/.test(clean)){const value=parseFloat(clean);const isDecimal=raw.includes(".");const hasThousandsSep=/\d,\d{3}/.test(raw);return{type:"number",raw,value,isDecimal,hasThousandsSep,isInteger:Number.isInteger(value)&&!isDecimal,isNegative:value<0,isDefinitelyPrice:isDecimal||hasThousandsSep||Math.abs(value)>999,couldBeQty:!isDecimal&&!hasThousandsSep&&Number.isInteger(value)&&value>=1&&value<=99};}if(UNIT_WORDS.has(stripPunct(raw)))return{type:"unit",raw};return{type:"text",raw};});}
function scoreAssignment(lt,qt,up,tokens,ctx){let s=0;if(lt.isDecimal)s+=20;if(lt.hasThousandsSep)s+=18;if(lt.value>999)s+=15;else if(lt.value>99)s+=10;else if(lt.value>20)s+=5;else if(lt.value<5)s-=6;if(lt.isInteger&&!lt.isDecimal&&!lt.hasThousandsSep){const hasTextToken=tokens.some(t=>t.type==="text"&&/\p{L}/u.test(t.raw));if(hasTextToken){if(lt.value>=20&&lt.value<=500)s+=6;else if(lt.value>=10&&lt.value<=1000)s+=3;}}if(lt.i===tokens.length-1)s+=8;else if(lt.i>=tokens.length-2)s+=3;if(ctx){if(lt.value>=ctx.p10*0.4&&lt.value<=ctx.p90*2.5)s+=8;else if(lt.value<ctx.p10*0.2||lt.value>ctx.p90*5)s-=5;}if(qt){if(qt.value<lt.value)s+=18;else if(qt.value>lt.value)s-=20;if(qt.value<=6)s+=10;else if(qt.value<=12)s+=5;else if(qt.value<=20)s+=2;const hasAdjUnit=tokens[qt.i+1]?.type==="unit"||tokens[qt.i-1]?.type==="unit";if(hasAdjUnit)s+=12;const prevTxt=tokens[qt.i-1]?.type==="text";const nextTxt=tokens[qt.i+1]?.type==="text";if(prevTxt&&nextTxt)s-=28;else if(prevTxt)s-=2;if(ctx){if(qt.value<=ctx.maxQty+3)s+=5;if(qt.value>ctx.maxQty*3+5)s-=8;}}if(up&&qt){const calc=r2(up.value*qt.value);const diff=Math.abs(calc-lt.value);if(diff<0.01)s+=55;else if(diff<=1.0)s+=45;else if(diff<=lt.value*0.03)s+=20;else s-=30;if(up.value<=lt.value)s+=5;else s-=8;if(up.isDecimal)s+=3;}return s;}
function findBestAssignment(tokens,ctx){const nums=tokens.map((t,i)=>({...t,i})).filter(t=>t.type==="number"&&!t.isNegative);if(!nums.length)return null;if(nums.length===1){const n=nums[0];const sc=(n.isDefinitelyPrice?38:n.value>20?25:10)+(n.i===tokens.length-1?8:0);return{lt:n,qt:null,up:null,score:sc};}const candidates=[];for(const lt of nums){candidates.push({lt,qt:null,up:null,score:scoreAssignment(lt,null,null,tokens,ctx)});for(const qt of nums.filter(n=>n!==lt&&n.couldBeQty)){candidates.push({lt,qt,up:null,score:scoreAssignment(lt,qt,null,tokens,ctx)});for(const up of nums.filter(n=>n!==lt&&n!==qt)){candidates.push({lt,qt,up,score:scoreAssignment(lt,qt,up,tokens,ctx)});}}}candidates.sort((a,b)=>b.score-a.score);return candidates[0];}
const ITEM_CODE_RE=/^([A-Z][A-Z0-9]{1,7})\s+(?=[^\d])/;
function buildItemRow(p){
  const missing=p.priceValue==null,issues={...(p.issues??{})};
  if(missing&&!issues.price)issues.price=fieldIssue('missing',p.priceSource??'line_total');
  return {id:uid(),rawLine:p.rawLine??'',lineType:'item',pattern:p.pattern??'unknown',itemCode:p.itemCode??null,itemName:p.itemName??'',
    qty:Object.hasOwn(p,'qty')?p.qty:1,qtyWasNull:!Object.hasOwn(p,'qty'),unit:p.unit??null,priceSource:p.priceSource??'line_total',priceValue:p.priceValue??null,
    confidence:p.confidence??0.5,needsReview:(p.confidence??0.5)<0.72,isDiscount:false,discountAmount:null,flags:p.flags??[],
    evidence:p.evidence??emptyReceiptEvidence(),issues,priceEdited:false};
}
function parseDiscountLine(rawLine){const s=nfc(String(rawLine||"").trim());const tokens=s.split(/\s+/);let discountAmount=null;for(const t of tokens){const v=parseFloat(t.replace(/,/g,"").replace(/^[(\-]+/,"").replace(/[)]+$/,""));if(isFinite(v)&&v>0){discountAmount=v;break;}}const isAmountToken=t=>{const c=t.replace(/,/g,"").replace(/^[(\-]+/,"").replace(/[)]+$/,"");return/^\d+(?:\.\d{1,2})?$/.test(c)&&parseFloat(c)>0;};const label=tokens.filter(t=>!isAmountToken(t)).join(" ").replace(/^[-\s]+/,"").trim()||"ส่วนลด";const hasPercent=/%/.test(s);return{id:uid(),rawLine,lineType:"discount",pattern:"discount",itemCode:null,itemName:label,qty:1,qtyWasNull:false,unit:null,priceSource:"line_total",priceValue:-(discountAmount??0),confidence:discountAmount!=null?0.92:0.5,needsReview:false,isDiscount:true,discountType:hasPercent?"percent":"baht",discountAmount:discountAmount??0,flags:[]};}
function parseItemLine(line,ctx,origin){
  const literal=origin?.rawLine??line;
  const codeMatch=nfc(line).match(ITEM_CODE_RE),itemCode=origin?.itemCode??codeMatch?.[1]??null;
  const stripped=codeMatch?line.slice(codeMatch[0].length):line;
  const tokens=tokenizeLine(stripped);
  // Map token occurrences forward through the contributing literal lines. No
  // string-to-first-row lookup: equal rows retain their own source occurrence.
  const literalTokens=literal.match(/\S+/g)??[];let cursor=0;
  for(const t of tokens){while(cursor<literalTokens.length&&normalizeText(literalTokens[cursor])!==t.raw)cursor++;t.literal=literalTokens[cursor++]??null;}
  const evidence=emptyReceiptEvidence();evidence.sourceLines=origin?.sourceLines??[];
  const identify=(key,t)=>{if(!t)return;evidence[key+'Text']=t.literal;if(key!=='quantity')evidence[key+'Cents']=t.literal&&receiptNumber(t.literal)!==null?Math.round(receiptNumber(t.literal)*100):null;};
  const row=(p)=>{const r=buildItemRow({rawLine:literal,itemCode,evidence,...p});
    if(origin?.tableAmbiguous&&r.priceValue!==null){r.priceSource='line_total';r.priceValue=tokens.at(-1)?.value??r.priceValue;r.issues.price=fieldIssue('ambiguous','line_total');}
    const proof=r.priceSource==='unit_price'?evidence.unitCents:evidence.totalCents;
    if(r.priceValue!==null&&proof===null&&!r.issues.price){r.priceValue=null;r.issues.price=fieldIssue('invalid',r.priceSource);}
    return r;};
  const price=t=>t&&receiptNumber(t.raw)!==null;
  const substantive=ts=>ts.some(t=>/\p{L}/u.test(t.raw));
  const nums=tokens.filter(t=>t.type==='number');
  const words=tokens.filter(t=>t.type!=='number');
  const last=tokens.at(-1),prefix=tokens.slice(0,-1);
  // A receipt column (or explicit header) is evidence; a lone leading number
  // can still belong to the name. Consume only the identified quantity token.
  if(origin?.quantityFirst&&tokens[0]?.couldBeQty&&substantive(prefix.slice(1))&&prefix.at(-1)?.type!=='number'){
    identify('quantity',tokens[0]);if(price(last))identify('total',last);
    return row({itemName:prefix.slice(1).map(t=>t.raw).join(' '),qty:tokens[0].value,
      priceValue:price(last)?last.value:null,confidence:0.9,pattern:'qty-item-price'});
  }
  let fields=origin?.alignedFields;
  if(!fields&&!origin?.tableAmbiguous&&tokens[0]?.couldBeQty&&price(tokens.at(-2))&&price(last)&&substantive(tokens.slice(1,-2))&&
    (tokens.at(-2).isDefinitelyPrice&&last.isDefinitelyPrice||Math.round(tokens.at(-2).value*100)*tokens[0].value===Math.round(last.value*100))){
    fields={quantity:tokens[0],unit:tokens.at(-2),total:last,name:tokens.slice(1,-2).map(t=>t.raw).join(' ')};
  }
  if(!fields&&!origin?.tableAmbiguous&&nums.length===3&&substantive(words)&&words.every(t=>t.raw!=='?')){
    const matches=[];
    for(const quantity of nums.filter(t=>t.couldBeQty)){
      for(const unit of nums.filter(t=>t!==quantity)){
        const total=nums.find(t=>t!==quantity&&t!==unit);
        if(price(unit)&&price(total)&&Math.round(unit.value*100)*quantity.value===Math.round(total.value*100))
          matches.push({quantity,unit,total});
      }
    }
    const conventional=matches.find(m=>m.quantity===nums[0]&&m.unit===nums[1]&&m.total===nums[2]);
    const chosen=conventional??(matches.length===1?matches[0]:null);
    if(chosen)fields={...chosen,name:words.map(t=>t.raw).join(' ')};
    else if(matches.length)return row({itemName:stripped,qty:null,issues:{qty:fieldIssue('ambiguous','qty'),price:fieldIssue('ambiguous','line_total')}});
  }
  if(fields){
    const {quantity,unit,total,name}=fields;
    identify('quantity',quantity);identify('unit',unit);identify('total',total);
    if(!unit||!total)return row({itemName:name,qty:quantity.value,priceSource:unit?'unit_price':'line_total',priceValue:(unit??total).value,confidence:0.97,pattern:'labelled-single-price'});
    const exact=Math.round(unit.value*100)*quantity.value===Math.round(total.value*100);
    return row({itemName:name,qty:quantity.value,priceSource:exact?'unit_price':'line_total',
      priceValue:exact?unit.value:total.value,confidence:0.97,pattern:'unit-qty-total',
      flags:exact?[]:[{type:'calc_mismatch',msg:`ราคา ${unit.literal??unit.raw} × ${quantity.literal??quantity.raw} ไม่ตรงกับยอด ${total.literal??total.raw} ในใบเสร็จ`}]});
  }
  const quantity=prefix.at(-1),simpleName=prefix.slice(0,-1);
  const nameNumbers=simpleName.every((t,i)=>t.type!=='number'||/\p{L}/u.test(simpleName[i+1]?.raw??''));
  if(!origin?.alignedFields&&price(last)&&quantity?.couldBeQty&&substantive(simpleName)&&nameNumbers){
    identify('quantity',quantity);identify('total',last);
    return row({itemName:simpleName.map(t=>t.raw).join(' '),qty:quantity.value,priceValue:last.value,confidence:0.8,pattern:'item-qty-price',
      flags:last.value>0&&quantity.value>=last.value?[{type:'qty_gte_price',msg:`qty(${quantity.value}) >= price(${last.value})`}]:[]});
  }
  if(last?.raw==='?'){
    const qty=prefix.at(-1)?.couldBeQty?prefix.at(-1):null;
    if(qty)identify('quantity',qty);
    const name=prefix.filter(t=>t!==qty&&t.raw!=='?').map(t=>t.raw).join(' ');
    return row({itemName:name,qty:qty?.value??null,pattern:'unread-price',issues:{price:fieldIssue('missing','line_total'),...(!qty?{qty:fieldIssue('ambiguous','qty')}:{})}});
  }
  if(!price(last)){
    const numeric=last&&/^[+-]?\d[\d,.]*$/.test(last.raw);if(numeric)identify('total',last);
    const qty=prefix.find(t=>t.couldBeQty);if(qty)identify('quantity',qty);
    return row({itemName:stripped,qty:qty?.value??1,confidence:0.15,pattern:'unread-price',issues:{price:fieldIssue(numeric?'invalid':'missing','line_total')}});
  }
  identify('total',last);
  if(prefix.some(t=>t.raw==='?'))return row({itemName:prefix.filter(t=>t.raw!=='?').map(t=>t.raw).join(' '),qty:null,priceValue:last.value,issues:{qty:fieldIssue('ambiguous','qty')},pattern:'ambiguous-quantity'});
  const [qt,up,lt]=tokens.slice(-3),nameTokens=tokens.slice(0,-3);
  if(qt?.couldBeQty&&price(up)&&price(lt)&&substantive(nameTokens)){
    identify('quantity',qt);identify('unit',up);
    const exact=Math.round(up.value*100)*qt.value===Math.round(lt.value*100);
    const labeled=origin?.labeledQty||/\b(?:qty|quantity)\b|จำนวน/i.test(literal);
    const ambiguousRole=nameTokens.at(-1)?.type==='number';
    const bare=!up.isDefinitelyPrice&&!lt.isDefinitelyPrice&&!exact&&!labeled;
    return row({itemName:nameTokens.map(t=>t.raw).join(' '),qty:qt.value,priceSource:exact&&!ambiguousRole?'unit_price':'line_total',priceValue:exact&&!ambiguousRole?up.value:lt.value,
      confidence:exact?0.97:0.5,pattern:'unit-qty-total',issues:{...(bare?{qty:fieldIssue('ambiguous','qty')}:{}),...(ambiguousRole?{price:fieldIssue('ambiguous','line_total')}:{})},
      flags:exact?[]:[{type:'calc_mismatch',msg:`ราคา ${up.literal??up.raw} × ${qt.literal??qt.raw} ไม่ตรงกับยอด ${lt.literal??lt.raw} ในใบเสร็จ`}]});
  }
  // A leading standalone numeric name/code and a fractional quantity have no
  // reliable role without labels. Keep the entire proposed name.
  const leading=prefix[0]?.type==='number'&&substantive(prefix.slice(1));
  const fractional=prefix.at(-1)?.type==='number'&&!prefix.at(-1).isInteger;
  const invalidQuantity=prefix.at(-1)?.type==='number'&&!prefix.at(-1).couldBeQty;
  if((leading&&!origin?.labeledQty)||fractional||invalidQuantity){
    identify('quantity',leading?prefix[0]:prefix.at(-1));
    return row({itemName:prefix.map(t=>t.raw).join(' '),qty:null,priceValue:last.value,issues:{qty:fieldIssue('ambiguous','qty')},pattern:'ambiguous-quantity'});
  }
  const internalNumber=prefix.findIndex(t=>t.type==='number');
  if(internalNumber>0&&prefix.slice(internalNumber+1).some(t=>/\p{L}/u.test(t.raw))){
    const ambiguous=prefix[internalNumber+1]?.type==='unit';
    if(ambiguous)identify('quantity',prefix[internalNumber]);
    return row({itemName:prefix.map(t=>t.raw).join(' '),qty:ambiguous?null:1,priceValue:last.value,confidence:0.8,pattern:'named-number',issues:ambiguous?{qty:fieldIssue('ambiguous','qty')}: {}});
  }
  const best=findBestAssignment(tokens,ctx);
  if(!best)return row({itemName:stripped});
  const used=new Set([best.lt.i,best.qt?.i,best.up?.i].filter(v=>v!=null));
  let unit=null;if(best.qt){for(const i of [best.qt.i+1,best.qt.i-1])if(tokens[i]?.type==='unit'){unit=stripPunct(tokens[i].raw);used.add(i);break;}}
  const name=tokens.filter((_,i)=>!used.has(i)).map(t=>t.raw).join(' ')||stripped;
  const numberCount=tokens.filter(t=>t.type==='number').length;
  const ambiguous=numberCount>3||numberCount>2&&!best.up;
  identify('quantity',best.qt);if(best.up)identify('unit',best.up);
  // Two-price nonstandard layouts still use the existing scoring engine, but a
  // competing unexplained number is a proposal requiring confirmation.
  let source=best.up||best.qt&&best.lt.i<best.qt.i?'unit_price':'line_total',value=best.up?.value??best.lt.value;
  if(source==='unit_price'&&!best.up){identify('unit',best.lt);evidence.totalText=null;evidence.totalCents=null;}
  const mismatch=best.up&&best.qt&&Math.round(best.up.value*100)*best.qt.value!==Math.round(best.lt.value*100);
  if(best.up){identify('total',best.lt);if(mismatch){source='line_total';value=best.lt.value;}}
  const issues=ambiguous?{price:fieldIssue('ambiguous','line_total')}:{};
  if(ambiguous){source='line_total';value=last.value;}
  return row({itemName:name,unit,qty:best.qt?.value??1,flags:[...(best.qt&&best.qt.value>=best.lt.value?[{type:'qty_gte_price',msg:`qty(${best.qt.value}) >= price(${best.lt.value})`}]:[]),...(mismatch?[{type:'calc_mismatch',msg:`ราคา ${best.up.literal??best.up.raw} × ${best.qt.literal??best.qt.raw} ไม่ตรงกับยอด ${best.lt.literal??best.lt.raw} ในใบเสร็จ`}]:[])],priceSource:source,priceValue:value,confidence:Math.min(Math.max(0.35+best.score/120,0.2),0.97),issues,pattern:best.up?'unit-qty-total':best.qt?'item-qty-price':'item-price-only'});
}
function getDerivedValues(row){
  const qty=row.qty,value=row.priceValue;
  if(value===null)return {unitPrice:null,lineTotal:null};
  if(row.priceSource==='unit_price')return {unitPrice:value,lineTotal:qty==null?null:r2(value*qty)};
  return {lineTotal:value,unitPrice:qty==null?null:r2(value/qty)};
}
function buildContext(rows){const known=rows.filter(r=>r.qty!==null&&r.priceValue!==null&&!Object.keys(r.issues??{}).length);let hc=known.filter(r=>!r.isDiscount&&r.confidence>=0.72);if(hc.length<2)hc=known.filter(r=>!r.isDiscount&&r.confidence>=0.50);if(hc.length<2)return null;const prices=hc.map(r=>getDerivedValues(r).lineTotal).filter(v=>v>0).sort((a,b)=>a-b);const qtys=hc.map(r=>r.qty);const pct=(arr,p)=>arr[Math.floor(arr.length*p)]??arr[arr.length-1];return{p10:pct(prices,.10),p25:pct(prices,.25),p75:pct(prices,.75),p90:pct(prices,.90),minPrice:prices[0],maxPrice:prices[prices.length-1],maxQty:Math.max(...qtys)};}
function taxBreakdownLines(lines){
  const records=lines.map((text,index)=>({text:normalizeText(text),index})).filter(r=>r.text);
  const labels=[/^before\s+vat\s*:?\s+(.+)$/i,/^vat\s+items?\s*:?\s+(.+)$/i,/^vat\s+included\s*:?\s+(.+)$/i];
  const metadata=new Set();
  for(let i=0;i+2<records.length;i++){
    if(labels.every((re,j)=>{const m=records[i+j].text.match(re);return m&&receiptNumber(m[1])!==null;})){
      for(let j=0;j<3;j++)metadata.add(records[i+j].index);
    }
  }
  return metadata;
}
// This is contextual classification, never a blacklist of purchased names.
function categorySummaryLines(rows,lines){
  const candidates=lines.flatMap((raw,index)=>{
    const match=normalizeText(raw).match(/^(.+?)\s+(-?[\d,]+(?:\.\d{1,2})?)$/);
    const value=match&&CATEGORY_LABELS.has(match[1])?receiptNumber(match[2].replace(/^-/,'')):null;
    return value!==null?[{index,cents:Math.round(value*100)*(match[2].startsWith('-')?-1:1)}]:[];
  });
  const categoryIndices=new Set(candidates.map(c=>c.index));
  function section(candidate,direction){
    const indices=new Set();
    for(let i=candidate.index+direction;i>=0&&i<lines.length;i+=direction){
      const text=normalizeText(lines[i]);
      if(categoryIndices.has(i)||isSummaryOrMetaLine(text)&&!DISCOUNT_RE.test(text))break;
      indices.add(i);
    }
    const purchases=rows.filter(r=>r.evidence.sourceLines.every(i=>indices.has(i))&&!categoryIndices.has(r.evidence.sourceLines[0]));
    if(purchases.some(r=>Object.keys(r.issues).length||r.qty===null||r.priceValue===null))return {count:purchases.length,matches:false};
    let count=purchases.length,amount=purchases.reduce((n,r)=>n+Math.round(getDerivedValues(r).lineTotal*100),0);
    for(const i of indices){
      const text=normalizeText(lines[i]);if(!DISCOUNT_RE.test(text)||/%/.test(text))continue;
      const token=text.split(/\s+/).at(-1),value=receiptNumber(token?.replace(/^-/,'')??'');
      if(value!==null){amount-=Math.round(value*100);count++;}
    }
    return {count,matches:count>0&&amount===candidate.cents};
  }
  const proofs=candidates.map(c=>{
    const sections=[section(c,1),section(c,-1)];
    return {index:c.index,count:Math.max(...sections.filter(s=>s.matches).map(s=>s.count),0),possible:Math.max(...sections.map(s=>s.count))};
  });
  const corroboratedSections=proofs.some(p=>p.count>=2);
  const metadata=new Set(proofs.filter(p=>p.count>=2||corroboratedSections&&p.count>=1).map(p=>p.index));
  // A mismatched/unfinished section is not permission to discard the row or
  // admit it silently as another purchase. Keep its printed amount for review.
  const ambiguous=new Set(proofs.filter(p=>!metadata.has(p.index)&&p.possible>=2).map(p=>p.index));
  return {metadata,ambiguous};
}
function markQuantityColumns(origins){
  const candidates=origins.filter(origin=>{
    const tokens=tokenizeLine(origin.clean),middle=tokens.slice(1,-1),last=tokens.at(-1);
    return !origin.alignedFields&&!origin.tableAmbiguous&&tokens[0]?.couldBeQty&&middle.some(t=>/\p{L}/u.test(t.raw))&&middle.at(-1)?.type!=='number'&&(receiptNumber(last?.raw??'')!==null||last?.raw==='?');
  });
  const names=new Map();
  for(const c of candidates){const parts=c.clean.split(' '),token=parts[0];if(!names.has(token))names.set(token,new Set());names.get(token).add(parts.slice(1,-1).join(' '));}
  // Repetition corroborates a column without treating isolated menu numbers as
  // quantities. Uncorroborated values still use the existing review path.
  for(const c of candidates)if(names.get(c.clean.split(' ')[0]).size>=2)c.quantityFirst=true;
}
const _SC_STRONG=/^(?:service\scharge|servicecharge|svc\scharge|ค่าบริการ|ค่าเซอร์วิส)(?=[\s%.,฿$\d]|$)/i;
const _VAT_STRONG=/^(?:vat|value\sadded\stax|ภาษีมูลค่าเพิ่ม)(?=[\s%.,฿$\d]|$)/i;
const _SC_WEAK=/^sc(?=[\s%.,\d]|$)/i;const _VAT_WEAK=/^ภาษี(?=[\s%.,฿$\d]|$)/i;
function _normSumLine(s){return String(s||"").normalize("NFC").replace(/[\u200B-\u200D\uFEFF]/g,"").replace(/\u00A0/g," ").replace(/\s+/g," ").trim().toLowerCase();}
function _adjustmentTail(s){return receiptDigits(s).replace(_SC_STRONG,'').replace(_VAT_STRONG,'').replace(_SC_WEAK,'').replace(_VAT_WEAK,'').replace(/^(?:discount|disc\.?|ส่วนลด|ลดราคา|ลดพิเศษ|หักส่วนลด)\s*/i,'').trim();}
function _extractPct(s){const m=_adjustmentTail(s).match(/(?:^|\s)(\S+?)\s*%/);return m?receiptNumber(m[1],{summary:true}):null;}
function _extractAmt(s){let token=_adjustmentTail(s).split(/\s+/).at(-1);if(DISCOUNT_RE.test(s))token=token.replace(/^-/, '');return receiptNumber(token);}
function countSummaryKeywords(line){const s=nfc(String(line||"")).toLowerCase();let count=0;for(const kw of MULTI_KW_SUMMARY_SET){if(s.includes(kw)){count++;if(count>=2)return count;}}return count;}
function isServiceChargeLine(norm){return _SC_STRONG.test(norm)||_SC_WEAK.test(norm);}
function isVatLine(norm){return _VAT_STRONG.test(norm)||_VAT_WEAK.test(norm);}
function isDiscountSummaryLine(raw,norm){return DISCOUNT_RE.test(raw)||DISCOUNT_RE.test(norm);}
function extractSummarySources(rawLines,onEntries){const metadata=taxBreakdownLines(rawLines);const entries=rawLines.map((raw,index)=>{if(metadata.has(index))return null;const norm=_normSumLine(receiptDigits(raw));if(!norm||/^(?:vat|tax|service charge|discount)\s+(?:amount|rate|subtotal|items?)$/i.test(norm))return null;if(POST_DISCOUNT_TOTAL_RE.test(nfc(raw).trim()))return null;const pct=_extractPct(raw);const amt=_extractAmt(raw);if(isServiceChargeLine(norm))return{kind:"service_charge",raw,norm,index,pct:Number.isFinite(pct)?pct:null,amt:Number.isFinite(amt)?Math.abs(amt):null,hasPct:pct!=null,hasAmt:amt!=null};if(isVatLine(norm))return{kind:"vat",raw,norm,index,pct:Number.isFinite(pct)?pct:null,amt:Number.isFinite(amt)?Math.abs(amt):null,hasPct:pct!=null,hasAmt:amt!=null};if(isDiscountSummaryLine(raw,norm))return{kind:"discount",raw,norm,index,pct:Number.isFinite(pct)?pct:null,amt:Number.isFinite(amt)?Math.abs(amt):null,hasPct:pct!=null,hasAmt:amt!=null};return null;}).filter(Boolean);onEntries?.(entries);const scList=entries.filter(e=>e.kind==="service_charge");const vatList=entries.filter(e=>e.kind==="vat");const discList=entries.filter(e=>e.kind==="discount");const pickSCorVAT=list=>{if(!list.length)return null;const pctItem=list.find(x=>x.hasPct&&Number.isFinite(x.pct));if(pctItem)return{mode:"percent",value:pctItem.pct,raw:pctItem.raw,sourceIndex:pctItem.index,sourceCount:list.length};const amtItem=list.find(x=>x.hasAmt&&Number.isFinite(x.amt));if(amtItem)return{mode:"amount",value:amtItem.amt,raw:amtItem.raw,sourceIndex:amtItem.index,sourceCount:list.length};return null;};const discountPct=discList.find(x=>x.hasPct&&Number.isFinite(x.pct));const rawAmountDiscountSum=r2(discList.filter(x=>!x.hasPct&&x.hasAmt&&Number.isFinite(x.amt)).reduce((s,x)=>s+Math.abs(x.amt),0));const discountAmtItem=discList.find(x=>!x.hasPct&&x.hasAmt&&Number.isFinite(x.amt));return{service_charge:pickSCorVAT(scList),vat:pickSCorVAT(vatList),discount:discountPct?{mode:"percent",value:discountPct.pct,raw:discountPct.raw,sourceIndex:discountPct.index,sourceCount:discList.length,extraAmountSum:rawAmountDiscountSum}:(discList.some(x=>x.hasAmt)?{mode:"amount",value:rawAmountDiscountSum,raw:discountAmtItem?.raw??"",sourceIndex:discountAmtItem?.index??-1,sourceCount:discList.length,extraAmountSum:0}:null),};}
function isSummaryItemName(name){const n=nfc(String(name||"").trim());if(/^(?:อาหาร|สินค้า)$/.test(n))return false;return SUMMARY_NAME_RE.test(n)||isSummaryByComposition(n)||isSafeColumnHeader(n);}
function detectBillNumericStyle(rawLines){const joined=rawLines.join("\n");return{hasDecimal:/\b\d+\.\d{2}\b/.test(joined),hasThousands:/\b\d{1,3},\d{3}\b/.test(joined)};}
const ADDR_MORPHEMES=new Set(["ถ","ถ.","ถนน","ซ","ซ.","ซอย","หมู่","ม.","แขวง","เขต","อำเภอ","อ.","ตำบล","ต.","จังหวัด","จ."]);
const ADDR_PREFIX_MORPHEMES=["ถนน","แขวง","เขต","อำเภอ","ตำบล","จังหวัด"];
function hasAddressMorpheme(line){return nfc(line).split(/[\s,\/]+/).some(tok=>{const t=stripPunct(tok);if(ADDR_MORPHEMES.has(t))return true;return ADDR_PREFIX_MORPHEMES.some(m=>t.startsWith(m)&&t.length>m.length);});}
const METADATA_ANCHOR_RE=/(?:โทร|tel|fax|phone|โทรศัพท์|ใบเสร็จ|receipt|invoice|s\/n#?|pos\s*id#?|เลขที่|order|bill|table|โต๊ะ|cashier|แคชเชียร์|วันที่|เวลา|date|time|\b0\d{8,9}\b)/i;
function findMetadataAnchorIndices(mergedLines){return new Set(mergedLines.map((l,i)=>METADATA_ANCHOR_RE.test(nfc(l))?i:-1).filter(i=>i>=0));}
function isNearMetadataAnchor(idx,anchors,win=5){for(let d=-win;d<=win;d++)if(anchors.has(idx+d))return true;return false;}
function isLikelyAddressLine(line,lineIdx,billStyle,anchorIndices){const s=nfc(line).trim();const fiveDigit=(s.match(/\b\d{5}\b/g)||[]).find(t=>/^\d{5}$/.test(t));if(!fiveDigit)return false;let score=0;if(billStyle.hasDecimal||billStyle.hasThousands)score+=4;if(hasAddressMorpheme(s))score+=3;if(isNearMetadataAnchor(lineIdx,anchorIndices))score+=2;if(!/\b\d{1,3}(?:,\d{3})+\b|\b\d+\.\d{2}\b/.test(s))score+=1;return score>=4;}
function applyZoneFilter(rows){const isAnchor=row=>!row.isDiscount&&!isSummaryItemName(row.itemName)&&row.confidence>=0.55&&row.itemName.trim().length>=2;const anchorIdxs=rows.reduce((acc,row,i)=>{if(isAnchor(row))acc.push(i);return acc;},[]);if(anchorIdxs.length<2){return rows.filter(row=>row.isDiscount||(isSummaryItemName(row.itemName)?false:(!row.isDiscount&&/^[\d\s.,\-]+$/.test(row.itemName.trim())?false:row.itemName.trim().length>=2)));}const first=anchorIdxs[0];const last=anchorIdxs[anchorIdxs.length-1];return rows.filter((row,idx)=>{if(row.isDiscount)return true;if(isSummaryItemName(row.itemName))return false;if(!row.isDiscount&&/^[\d\s.,\-]+$/.test(row.itemName.trim()))return false;if(idx>=first&&idx<=last)return true;return row.confidence>=0.50;});}
function preprocessReceipt(rawText,{preserveItemLines=false}={}){
  const literalLines=String(rawText??'').split(/\r\n|\r|\n/);
  const records=literalLines.map((line,i)=>({text:normalizeText(line),sourceLines:[i],table:line.includes('\t')})).filter(r=>r.text);
  // Multiple named sections followed by complete item rows corroborate a
  // heading. A lone unread purchase with the same name remains a review row.
  const headings=records.filter((r,i)=>CATEGORY_LABELS.has(r.text)&&records[i+1]&&looksComplete(records[i+1].text)&&/\p{L}/u.test(records[i+1].text));
  if(new Set(headings.map(r=>r.text)).size>=2)for(const heading of headings)heading.categoryHeading=true;
  const rawLines=records.map(r=>r.text),merged=preserveItemLines?records:mergeWrappedLines(collapseVerticalOCR(records));
  const billStyle=detectBillNumericStyle(rawLines),anchors=findMetadataAnchorIndices(merged.map(lineText));
  let headers=null;
  const headerAliases=[/^(?:qty|quantity|จำนวน)$/i,/^(?:unit price|price|ราคา|หน่วยละ)$/i,/^(?:total|line total|amount|ยอดรวม|จำนวนเงิน)$/i];
  const origins=[];
  for(let idx=0;idx<merged.length;idx++){
    const record=merged[idx],orig=record.text,literal=record.sourceLines.map(i=>literalLines[i]).join('\n');
    if(record.categoryHeading)continue;
    const cells=literal.split('\t').map(c=>normalizeText(c));
    if(cells.length>1&&cells.some(c=>headerAliases[0].test(c))&&cells.some(c=>headerAliases[1].test(c)||headerAliases[2].test(c))&&cells.some(c=>/^(?:item|name|description|รายการ|สินค้า|รายการสินค้า)$/i.test(c))){headers=cells;continue;}
    if(SEPARATOR_RE.test(orig)||DATE_RE.test(orig)||TIME_RE.test(orig)||isMultiKVMetaLine(orig)||idx+1<merged.length&&isMultiKVMetaLine(merged[idx+1].text)||isLikelyAddressLine(orig,idx,billStyle,anchors)||DISCOUNT_RE.test(orig)||isSummaryOrMetaLine(orig)&&! /^(?:อาหาร|สินค้า)\s+\d/.test(orig)||countSummaryKeywords(orig)>=2)continue;
    const codeColumn=headers&&cells.length>1?headers.findIndex(c=>/^(?:code|item code|รหัส|no\.?)$/i.test(c)):-1;
    const clean=stripNoiseTokens(codeColumn>=0?cells.filter((_,i)=>i!==codeColumn).join(' '):orig);if(!clean)continue;
    const cols=headers?headerAliases.map(re=>headers.findIndex(c=>re.test(c))):[];
    const aligned=headers&&cells.length===headers.length&&cols[0]>=0&&cols.some((col,i)=>i>0&&col>=0)&&cols.every((col,i)=>col<0||receiptNumber(cells[col],{quantity:i===0})!==null);
    let alignedFields=null;
    if(aligned){
      const name=cells.filter((_,i)=>i!==codeColumn&&!cols.includes(i)).join(' ').trim();
      const literalCells=literal.split('\t');
      const [quantity,unit,total]=cols.map(i=>i<0?null:{literal:literalCells[i].trim(),value:receiptNumber(cells[i])});
      if(name)alignedFields={name,quantity,unit,total};
    }
    origins.push({...record,alignedFields,clean,rawLine:literal,itemCode:codeColumn>=0?cells[codeColumn]:null,labeledQty:!!aligned,tableAmbiguous:!!headers&&cells.length>1&&!aligned});
  }
  markQuantityColumns(origins);
  return {cleanLines:origins.map(r=>r.clean),rawLines,origins,literalLines};
}
function parseReceipt(rawText,{recoverOmitted=false,onSummaryEntries,preserveItemLines=false}={}){
  const {origins,literalLines}=preprocessReceipt(rawText,{preserveItemLines});
  const summaryIssues={};
  const summarySource=extractSummarySources(literalLines,entries=>{
    onSummaryEntries?.(entries);
    for(const e of entries)if(!e.hasPct&&!e.hasAmt)summaryIssues[e.kind]=fieldIssue(/\d/.test(e.raw)?'invalid':'missing','amount');
    for(const e of entries){const value=e.hasPct?e.pct:e.amt;if(value!==null&&value>(e.hasPct?100:1e10))summaryIssues[e.kind]=fieldIssue('invalid',e.hasPct?'rate':'amount');}
  });
  for(const kind of Object.keys(summaryIssues))if(summaryIssues[kind].reason==='invalid')summarySource[kind]=null;
  let pairs=origins.filter(r=>quickClassify(r.clean)!=='meta'||/^(?:อาหาร|สินค้า)\s+\d/.test(r.clean)).map(origin=>({origin,row:parseItemLine(origin.clean,null,origin)}));
  const ctx=buildContext(pairs.map(p=>p.row));
  if(ctx)pairs=pairs.map(p=>{if(p.row.confidence>=0.72)return p;const row=parseItemLine(p.origin.clean,ctx,p.origin);return row.confidence>p.row.confidence?{...p,row}:p;});
  const {metadata:categoryMetadata,ambiguous:categoryAmbiguities}=categorySummaryLines(pairs.map(p=>p.row),literalLines);
  pairs=pairs.filter(p=>!p.origin.sourceLines.some(i=>categoryMetadata.has(i)));
  for(const p of pairs)if(p.origin.sourceLines.some(i=>categoryAmbiguities.has(i))){p.row.issues.price??=fieldIssue('ambiguous','line_total');p.row.needsReview=true;}
  let rows=preserveItemLines?pairs.map(p=>p.row):applyZoneFilter(pairs.map(p=>p.row));
  if(recoverOmitted){
    const represented=new Set(rows.flatMap(r=>r.evidence.sourceLines));
    for(let i=0;i<literalLines.length;i++){
      const text=normalizeText(literalLines[i]);
      if(categoryMetadata.has(i)||represented.has(i)||! /\p{L}/u.test(text)||!/[\d,]+\.\d{2}$/.test(text)||STRONG_SUMMARY_RE.test(text)||DISCOUNT_RE.test(text)||/^(?:service|svc|sc\b|tax|grand|net|cash|รวม|ยอด|สุทธิ|โทร|tel|date|วันที่|เวลา|เลขที่|ถนน|ที่อยู่)/i.test(text))continue;
      const row=parseItemLine(text,null,{sourceLines:[i],rawLine:literalLines[i]});row.needsReview=true;row.flags.push({type:'recovered_line',msg:'พบรายการที่ต้องตรวจสอบ'});rows.push(row);
    }
  }
  rows.sort((a,b)=>(a.evidence.sourceLines[0]??Infinity)-(b.evidence.sourceLines[0]??Infinity));
  return {rows,summarySource,summaryIssues};
}
function initializeSummaryEdits(subtotal,source){
  return {service_charge_rate:source?.service_charge?.mode==='percent'?source.service_charge.value:null,
    vat_rate:source?.vat?.mode==='percent'?source.vat.value:null,
    discount_rate:source?.discount?.mode==='percent'?source.discount.value:null,
    discount_amount:source?.discount?.mode==='amount'?source.discount.value:null};
}
function resolveSummaryState(subtotal,summarySource,summaryEdits,discountCanonical){const scSource=summarySource?.service_charge??null;const vatSource=summarySource?.vat??null;const discSource=summarySource?.discount??null;const scRate=Number.isFinite(summaryEdits?.service_charge_rate)?summaryEdits.service_charge_rate:(scSource?(scSource.mode==="percent"?scSource.value:(subtotal>0?(scSource.value/subtotal)*100:0)):null);const scAmount=scSource?.mode==='amount'&&!Number.isFinite(summaryEdits?.service_charge_rate)?scSource.value:scRate!=null?r2(subtotal*scRate/100):0;const vatBase=r2(subtotal+scAmount);const vatRate=Number.isFinite(summaryEdits?.vat_rate)?summaryEdits.vat_rate:(vatSource?(vatSource.mode==="percent"?vatSource.value:(vatBase>0?(vatSource.value/vatBase)*100:0)):null);const vatAmount=vatSource?.mode==='amount'&&!Number.isFinite(summaryEdits?.vat_rate)?vatSource.value:vatRate!=null?r2(vatBase*vatRate/100):0;const discountBase=r2(subtotal+scAmount+vatAmount);const effectiveMode=discountCanonical??discSource?.mode??"amount";let discountAmount=0;let discountRate=0;if(effectiveMode==="rate"){let storedRate=summaryEdits?.discount_rate;if(!Number.isFinite(storedRate)&&discSource?.mode==="percent")storedRate=discSource.value;if(!Number.isFinite(storedRate))storedRate=0;discountRate=storedRate;discountAmount=r2(discountBase*discountRate/100);if(discSource?.extraAmountSum)discountAmount=r2(discountAmount+discSource.extraAmountSum);}else{let storedAmount=summaryEdits?.discount_amount;if(!Number.isFinite(storedAmount)&&discSource?.mode!=="percent")storedAmount=discSource?.value;if(!Number.isFinite(storedAmount))storedAmount=0;discountAmount=r2(storedAmount);discountRate=discountBase>0?r2((discountAmount/discountBase)*100):0;}const total=r2(subtotal+scAmount+vatAmount-discountAmount);return{subtotal,service_charge:{source:scSource,rate:scRate??0,amount:scAmount,mode:scSource?.mode??null},vat:{source:vatSource,rate:vatRate??0,amount:vatAmount,mode:vatSource?.mode??null},discount:{source:discSource,mode:effectiveMode,rate:discountRate,amount:discountAmount,extraAmountSum:discSource?.extraAmountSum||0},total};}
return {parseReceipt,getDerivedValues,initializeSummaryEdits,resolveSummaryState,mergeWrappedLines,normalizeText,preprocessReceipt,extractSummarySources,parseItemLine,parseDiscountLine};
}
export const {parseReceipt,getDerivedValues,initializeSummaryEdits,resolveSummaryState,mergeWrappedLines,normalizeText,preprocessReceipt,extractSummarySources,parseItemLine,parseDiscountLine} = createReceiptParser();
