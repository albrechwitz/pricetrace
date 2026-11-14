// Pure extraction code. No network, storage, DOM, or model calls.
import {normalizeDocument,transactionState,mailContext} from './document.js';
import {resolvePrices,isBundleName} from './pricing.js';
export const VERSION = '3.2.0';
const labels = {
  merchant: /^(?:판매처|판매자|상점|스토어|merchant|seller|store)\s*[:：]\s*(.+)$/i,
  platform: /^(?:구매처|플랫폼|쇼핑몰|platform|marketplace)\s*[:：]\s*(.+)$/i,
  manufacturer: /^(?:제조사|제조업체|브랜드|manufacturer|brand)\s*[:：]\s*(.+)$/i,
  orderId: /^(?:주문번호|주문 번호|order\s*(?:number|id|#))\s*[:：]\s*(.+)$/i,
  paymentId: /^(?:승인번호|결제번호|거래번호|transaction id|payment id)\s*[:：]\s*(.+)$/i,
  date: /^(?:주문일시|주문일|주문 날짜|order date|purchase date)\s*[:：]\s*(.+)$/i,
  product: /^(?:상품명|상품 이름|제품명|product|item(?: name)?)\s*[:：]\s*(.+)$/i,
  option: /^(?:옵션|option|variant)\s*[:：]\s*(.+)$/i,
  quantity: /^(?:수량|quantity|qty)\s*[:：]\s*(.+)$/i,
  unitPrice: /^(?:단가|개당 가격|unit price)\s*[:：]\s*(.+)$/i,
  retailPrice: /^(?:소비자가|정가|정상가|권장소비자가|소비자 가격|retail price|list price|regular price|msrp)\s*[:：]\s*(.+)$/i,
  salePrice: /^(?:할인가|할인 가격|할인단가|할인 단가|개당 결제가|sale price|discounted price)\s*[:：]\s*(.+)$/i,
  discountRate: /^(?:할인율|discount rate)\s*[:：]\s*(.+)$/i,
  krwUnitPrice: /^(?:원화 단가|원화단가|원화 소비자가|KRW unit price)\s*[:：]\s*(.+)$/i,
  krwSalePrice: /^(?:원화 할인가|원화할인가|원화 실결제 단가|KRW sale price)\s*[:：]\s*(.+)$/i,
  krwLineTotal: /^(?:원화 상품금액|원화상품금액|KRW item total)\s*[:：]\s*(.+)$/i,
  krwOrderTotal: /^(?:원화 결제금액|원화결제금액|원화 결제액|KRW order total)\s*[:：]\s*(.+)$/i,
  lineTotal: /^(?:상품금액|상품 금액|품목금액|line total|item total)\s*[:：]\s*(.+)$/i,
  orderTotal: /^(?:총 결제금액|총 결제 금액|결제금액|결제 금액|주문 합계|order total|total paid)\s*[:：]\s*(.+)$/i,
};
export function money(value, currencyHint = null) {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim();
  const codes = ['KRW','USD','EUR','JPY','CNY','GBP','AUD','CAD','CHF','HKD','SGD','NZD','TWD','THB','VND','INR','IDR','MYR','PHP','SEK','NOK','DKK','PLN','CZK','HUF','TRY','BRL','MXN','ZAR','AED','SAR'];
  const detected = [...new Set([...codes.filter(code=>new RegExp(`\\b${code}\\b`,'i').test(str)),...[[/[₩원]/,'KRW'],[/US\$/i,'USD'],[/€/,'EUR'],[/円/,'JPY'],[/£/,'GBP']].filter(([pattern])=>pattern.test(str)).map(([,code])=>code)])];
  if (detected.length > 1 || (detected.length && currencyHint && detected[0] !== currencyHint)) return null;
  const currency = detected[0] || currencyHint;
  if (str.includes('$') && currency !== 'USD') return null;
  // A bare dollar sign is ambiguous; a bare number needs explicit currency context.
  if (!codes.includes(currency)) return null;
  const numeric = str.replace(new RegExp(codes.join('|')+'|US\\$|[₩원€円$£]','gi'), '').trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(numeric)) return null;
  const amount = Number(numeric.replaceAll(',', ''));
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e12 || (['KRW','JPY'].includes(currency) && !Number.isInteger(amount))) return null;
  return { amount, currency };
}
export function quantity(value) {
  const s = String(value ?? '').trim();
  if (!/^\d+(?:\s*(?:개|ea|pcs?))?$/i.test(s)) return null;
  const n = Number.parseInt(s, 10);
  return Number.isSafeInteger(n) && n > 0 && n <= 100000 ? n : null;
}
export function dateValue(value) {
  const m = String(value ?? '').trim().match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})(?=$|[ T일.])/);
  if (!m) return null;
  const [y, mo, d] = m.slice(1).map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}` : null;
}
function text(v) { return typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, 1000) : null; }
function eventTime(value){
  const s=String(value||'').trim();
  const m=s.match(/^(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})(?:일)?[ T]+(?:\([^)]*\)\s*)?(\d{1,2})[:시]\s*(\d{1,2})(?:[:분]\s*(\d{1,2}))?/);
  if(m){
    if(!dateValue(s)||+m[4]>23||+m[5]>59||+(m[6]||0)>59)return null;
    const zone=s.match(/(?:GMT)?([+-]\d{2}:?\d{2})\)?$/)?.[1]||(/Z$/.test(s)?'Z':'+09:00');
    const at=Date.parse(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5].padStart(2,'0')}:${(m[6]||'0').padStart(2,'0')}${zone}`);
    return Number.isFinite(at)?at:null;
  }
  if(!/\d{1,2}:\d{2}/.test(s))return null;
  const at=Date.parse(s);return Number.isFinite(at)?at:null;
}
function setEventTime(row,purchaseDate,forwarded,receivedAt){
  // Sending and receiving times can support a close match, but cannot contradict
  // an explicitly dated payment: notification delivery may be delayed.
  for(const [basis,value] of [['purchase',purchaseDate],['forwarded',forwarded?.sentAt],['received',receivedAt]]){
    const at=eventTime(value);if(at!=null){row.eventTime=at;row.eventTimeBasis=basis;return;}
  }
  row.eventTime=null;row.eventTimeBasis=null;
}
function fallbackDate(row,message,forwarded){
  if(row.date)return;
  const received=new Date(message.receivedAt||''),receivedDate=Number.isFinite(received.getTime())?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(received):null;
  const sentDate=dateValue(forwarded?.sentAt);
  if(sentDate&&(!receivedDate||sentDate<=receivedDate)){
    row.date=sentDate;row.dateBasis='전달 원문 발송일';row.evidence.date=`구매일 미표기 · 전달 원문 Sent: ${forwarded.sentAt}`;
  }else if(receivedDate){row.date=receivedDate;row.dateBasis='메일 수신일';row.evidence.date='구매일 미표기 · 메일 수신일 기준';}
}
function blank(message, index, format) {
  return { id: `${message.id}:${index}`, messageId: message.id, subject: message.subject || '(제목 없음)', sender: message.sender || message.sourceDomain || '', receivedAt: message.receivedAt || null, merchant: null, platform:null, manufacturer:null, orderId: null, date: null, product: null, option: null, quantity: null, unitPrice: null, retailPrice:null, salePrice:null, discountRate:null, krwUnitPrice:null,krwSalePrice:null,krwLineTotal:null,krwOrderTotal:null,lineTotal: null, orderTotal: null, cancelled:false,priceBlocked:false,format, evidence: {}, issues: [], duplicateOf: null, verified: false };
}
export function parseDiscountRate(value) {
  const match=String(value??'').trim().match(/^(\d+(?:\.\d+)?)\s*%$/);
  return match && Number(match[1])<=100 ? Number(match[1]) : null;
}
export function validate(row) {
  if (!row.date) row.issues.push('주문일을 확인할 수 없어요');
  if (!row.product) row.issues.push('상품명을 확인할 수 없어요');
  if (!resolvePrices(row).regular) row.issues.push('상품 가격이 없거나 통화·금액이 불명확해요');
  if(isBundleName(row.product)){row.issues.push('여러 상품을 묶은 결제 내역이에요. 개별 상품 가격을 확인해주세요');row.priceBlocked=true;}
  const normal=row.retailPrice||row.unitPrice;
  const paid=row.salePrice||(normal&&row.discountRate!==null?{...normal,amount:normal.amount*(1-row.discountRate/100)}:row.unitPrice||row.retailPrice);
  if (paid && row.lineTotal && row.quantity && (paid.currency !== row.lineTotal.currency || Math.abs(paid.amount * row.quantity - row.lineTotal.amount) > (paid.currency==='KRW'?1:0.011))) {row.issues.push('단가 × 수량과 상품금액이 일치하지 않아요');row.priceBlocked=true;}
  if(row.salePrice&&normal&&(row.salePrice.currency!==normal.currency||row.salePrice.amount>normal.amount)){row.issues.push('소비자가와 할인가의 통화·금액을 확인해주세요');row.priceBlocked=true;}
  if(row.salePrice&&normal&&row.discountRate!==null&&Math.abs(normal.amount*(1-row.discountRate/100)-row.salePrice.amount)>(normal.currency==='KRW'?1:0.011)){row.issues.push('할인율과 할인가가 일치하지 않아요');row.priceBlocked=true;}
  if (row.issues.some(x=>x.includes('값이 여러 개')||x.includes('할인율 형식')))row.priceBlocked=true;
  row.issues = [...new Set(row.issues)];
  return row;
}
export function extractText(message) {
  const document=normalizeDocument(message);
  const explicit=/^(?:상품명|상품 이름|제품명|product|item(?: name)?)[ \t]*[:：][ \t]*[^\s]/im.test(String(message.text||''));
  const lines = String(document.tableCount||!explicit?document.text:message.text).slice(0, 500000).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const common = {}, commonEvidence = {}, commonIssues = [];
  const chunks = [];
  let current = null;
  for (const line of lines) {
    let field, value;
    for (const [key, regex] of Object.entries(labels)) { const m = line.match(regex); if (m) { field = key; value = m[1]; break; } }
    if (!field) continue;
    if (['platform','orderId','paymentId','date','orderTotal','krwOrderTotal'].includes(field)||(['merchant','manufacturer'].includes(field)&&!current)) {
      if (common[field] && common[field] !== value) commonIssues.push(`${field} 값이 여러 개예요`);
      else { common[field] = value; commonEvidence[field] = line; }
    } else {
      if (field === 'product') { current = { values: {}, evidence: {}, issues: [] }; chunks.push(current); }
      if (current) {
        if (current.values[field] && current.values[field] !== value) current.issues.push(`${field} 값이 여러 개예요`);
        else { current.values[field] = value; current.evidence[field] = line; }
      }
    }
  }
  if (!chunks.length) chunks.push({ values: {}, evidence: {}, issues: ['지원하는 상품 필드를 찾지 못했어요'] });
  return chunks.map((chunk, i) => {
    const row = blank(message, i, '명시된 필드');
    row.messageItemCount=chunks.length;
    Object.assign(row, { merchant: chunk.values.merchant??common.merchant ?? null,manufacturer:chunk.values.manufacturer??common.manufacturer??null,platform:common.platform??null, orderId: common.orderId ?? null, date: dateValue(common.date), product: chunk.values.product ?? null, option: chunk.values.option ?? null, quantity: quantity(chunk.values.quantity), unitPrice: money(chunk.values.unitPrice), lineTotal: money(chunk.values.lineTotal), orderTotal: money(common.orderTotal),retailPrice:money(chunk.values.retailPrice),salePrice:money(chunk.values.salePrice),discountRate:parseDiscountRate(chunk.values.discountRate),krwUnitPrice:money(chunk.values.krwUnitPrice,'KRW'),krwSalePrice:money(chunk.values.krwSalePrice,'KRW'),krwLineTotal:money(chunk.values.krwLineTotal,'KRW'),krwOrderTotal:money(common.krwOrderTotal,'KRW'), evidence: {...commonEvidence, ...chunk.evidence}, issues: [...commonIssues, ...chunk.issues] });
    if(chunk.values.discountRate && row.discountRate===null)row.issues.push('할인율 형식을 확인해주세요');
    for(const field of ['unitPrice','retailPrice','salePrice','krwUnitPrice','krwSalePrice','krwLineTotal','lineTotal'])if(chunk.values[field]&&!row[field]){row.issues.push('명시된 상품 가격의 금액·통화를 확인해주세요');row.priceBlocked=true;}
    row.paymentId=common.paymentId||document.meta.paymentId||null;
    row.refundAmount=money(document.meta.refundAmount);row.remainingAmount=money(document.meta.remainingAmount);row.refundDate=dateValue(document.meta.refundDate);
    row.documentKind=document.kind;row.partialRefund=document.partial;
    row.platform=row.platform||document.meta.platform||null;
    row.merchant=row.merchant||document.meta.merchant||null;
    row.date=row.date||dateValue(document.meta.date);row.dateBasis=row.date?'원문 구매일':null;
    fallbackDate(row,message,document.forwarded);
    setEventTime(row,common.date||document.meta.date,document.forwarded,message.receivedAt);
    row.cancelled=document.cancelled;
    if(row.cancelled)row.issues.push('취소·환불 완료 내역이에요');
    if(row.partialRefund){row.issues.push('부분 취소 내역 · 어떤 상품인지 확인해주세요');row.priceBlocked=true;}
    if(document.encodingDamaged){row.issues.push('문자 인코딩이 손상됐어요. 메일을 다시 가져와주세요');row.priceBlocked=true;}
    if(row.merchant&&!row.evidence.merchant)row.evidence.merchant=`메일 제목·상점 정보: ${row.merchant}`;
    if(document.kind==='subscription'&&!row.product)row.issues.push('멤버십·정기결제 내역이에요');
    row.contentKey=stableTextKey(`${message.sender||''}|${message.subject||''}|${String(message.text||'').replace(/\s+/g,' ')}`);
    return validate(row);
  });
}
function ordersFrom(nodes) {
  const found = [];
  function visit(node, depth = 0) {
    if (!node || depth > 10) return;
    if (Array.isArray(node)) { node.slice(0, 100).forEach(n => visit(n, depth + 1)); return; }
    if (typeof node !== 'object') return;
    const types = [].concat(node['@type'] ?? []);
    if (types.some(t => /^(?:https?:\/\/schema.org\/)?Order$/.test(t))) found.push(node);
    if (node['@graph']) visit(node['@graph'], depth + 1);
  }
  visit(nodes);
  return found;
}
export function extractStructured(message) {
  const rows = [];
  for (const order of ordersFrom(message.structured ?? [])) {
    const offers = [].concat(order.acceptedOffer ?? []);
    for (const offer of offers.slice(0,100)) {
      if (!offer || typeof offer !== 'object') continue;
      const row = blank(message, rows.length, '구조화 데이터');
      row.messageItemCount=offers.length;
      row.merchant = text(order.seller?.name || order.merchant?.name || offer.seller?.name);
      row.manufacturer=text(offer.itemOffered?.manufacturer?.name||offer.itemOffered?.brand?.name||offer.itemOffered?.brand);
      row.orderId = text(order.orderNumber);
      row.date = dateValue(order.orderDate);
      row.product = text(offer.itemOffered?.name);
      row.option = text(offer.itemOffered?.sku);
      row.quantity = quantity(offer.eligibleQuantity?.value);
      row.unitPrice = money(offer.price, offer.priceCurrency);
      row.orderTotal = money(order.price, order.priceCurrency);
      const fields = { merchant: row.merchant, manufacturer:row.manufacturer,orderId: order.orderNumber, date: order.orderDate, product: offer.itemOffered?.name, option: offer.itemOffered?.sku, quantity: offer.eligibleQuantity?.value, unitPrice: offer.price == null ? null : `${offer.price} ${offer.priceCurrency ?? ''}`, orderTotal: order.price == null ? null : `${order.price} ${order.priceCurrency ?? ''}` };
      for (const [key, value] of Object.entries(fields)) if (value != null) row.evidence[key] = `JSON-LD · ${key}: ${String(value)}`;
      row.cancelled=/OrderCancelled|OrderReturned|OrderRefunded/i.test(order.orderStatus||'')||transactionState(message.subject,'').cancelled;
      if(row.cancelled)row.issues.push('취소·환불 완료 내역이에요');
      row.documentKind='order';row.dateBasis=row.date?'원문 구매일':null;
      fallbackDate(row,message,mailContext(message).forwarded);
      setEventTime(row,order.orderDate,mailContext(message).forwarded,message.receivedAt);
      rows.push(validate(row));
    }
  }
  return rows;
}
export function stableTextKey(value){let hash=2166136261;for(const c of String(value)){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(36);}
export function extractMessages(messages) {
  const seenMessages = new Set(), seenOrders = new Map(), rows = [];
  for (const message of messages) {
    if (seenMessages.has(message.id)) continue;
    seenMessages.add(message.id);
    const structured = extractStructured(message);
    const textRows=extractText(message);
    // Structured orders often omit an explicit list/sale-price pair visible in the body.
    // Supplement only one unambiguous product match in the same order.
    if(structured.length)for(const row of structured){
      const matches=textRows.filter(t=>t.product===row.product&&(!t.orderId||t.orderId===row.orderId)&&(!t.option||!row.option||t.option===row.option));
      if(matches.length===1){const t=matches[0];for(const field of ['retailPrice','salePrice','discountRate','krwUnitPrice','krwSalePrice','krwLineTotal','krwOrderTotal','manufacturer','platform'])if(row[field]==null&&t[field]!=null){row[field]=t[field];row.evidence[field]=t.evidence[field];}if(row.eventTimeBasis!=='purchase'&&t.eventTimeBasis==='purchase'&&row.date===t.date){row.eventTime=t.eventTime;row.eventTimeBasis='purchase';row.evidence.eventTime=t.evidence.date;}if(t.priceBlocked){row.priceBlocked=true;row.issues.push('본문의 가격·할인 정보를 확인해주세요');}validate(row);}
    }
    const extracted = structured.length ? structured : textRows;
    for (const row of extracted) {
      // Order IDs are scoped to sender + merchant. Preserve duplicates for inspection.
      if (row.orderId && row.merchant && row.product) {
        const key = JSON.stringify([row.sender.toLowerCase(), row.merchant, row.orderId, row.product, row.option]);
        const existing = seenOrders.get(key);
        if (existing && existing.messageId !== row.messageId) { row.duplicateOf = existing.id; row.issues.push('다른 메일에 같은 주문·상품이 있어요'); }
        else seenOrders.set(key, row);
      }
      rows.push(row);
    }
  }
  return rows;
}
