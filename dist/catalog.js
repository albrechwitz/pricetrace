// Two levels: product identity -> dated purchases with their own prices and evidence.
import {validate} from './core.js';
import {reconcileRows,storeIdentity,productIdentity} from './duplicates.js';
import {resolvePrices} from './pricing.js';
import {linkOrderReceipts} from './order-links.js';
export const normalizeIdentity = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, '').trim();
function senderDomain(value) {
  return String(value || '').toLowerCase().match(/@([a-z0-9.-]+)/)?.[1] || normalizeIdentity(value);
}
export function orderKey(row) {
  if(row.purchaseAlias)return row.purchaseAlias;
  const platform = storeIdentity(row.platform) || senderDomain(row.sender) || storeIdentity(row.merchant);
  if(row.orderId)return JSON.stringify([platform, normalizeIdentity(row.orderId)]);
  if(row.paymentId&&row.date)return JSON.stringify([platform,'payment',row.date,normalizeIdentity(row.paymentId)]);
  if(row.date&&(row.product||row.orderTotal)&&(resolvePrices(row).regular||row.lineTotal||row.orderTotal||row.krwOrderTotal))return JSON.stringify([platform,'mail',row.messageId]);
  return null;
}
const divide = (price, n) => price && n ? {amount:price.amount/n,currency:price.currency} : null;
function convert(original, explicitKrw, date, rates) {
  if (!original) return null;
  if (original.currency === 'KRW') return {original,krw:Math.round(original.amount),kind:'원화 원문',rate:1,rateDate:date};
  if (explicitKrw?.currency==='KRW') return {original,krw:Math.round(explicitKrw.amount),kind:'원화 원문',rate:null,rateDate:date};
  const rate=rates.get(`${date}|${original.currency}`);
  return {original,krw:rate ? Math.round(original.amount*rate.rate):null,kind:rate?'환율 추정':'환산 대기',rate:rate?.rate??null,rateDate:rate?.date??null,rateSource:rate?.source??null};
}
export function priceRecord(row, rates=new Map()) {
  const {regular,regularBasis,comparisonBasis,explicit,discountEvidence,sale,rate,regularKrw,saleKrw}=resolvePrices(row);
  const normalView=convert(regular,regularKrw,row.date,rates), saleView=discountEvidence?convert(sale,saleKrw,row.date,rates):null;
  if(saleView && explicit&&!row.salePrice&&!row.krwSalePrice&&saleView.kind==='원화 원문')saleView.kind='할인율 계산';
  const paid=discountEvidence?saleView:normalView;
  let lineKrw=row.krwLineTotal,derivedLine=false;
  if(!lineKrw&&row.lineTotal&&row.quantity&&!row.priceBlocked&&paid?.krw!=null&&paid.kind!=='환율 추정'&&paid.original.currency===row.lineTotal.currency&&Math.abs(paid.original.amount*row.quantity-row.lineTotal.amount)<1){lineKrw={amount:paid.krw*row.quantity,currency:'KRW'};derivedLine=true;}
  const lineView=convert(row.lineTotal||row.krwLineTotal,lineKrw,row.date,rates);if(lineView&&derivedLine&&lineView.original.currency!=='KRW')lineView.kind='원화 단가로 계산';
  return {regular:normalView,regularBasis,comparisonBasis,discount:discountEvidence?{price:saleView,rate,rateKind:row.discountRate!==null?'원문':'가격으로 계산',basis:row.salePrice?'할인가 명시':explicit?'명시된 할인율로 계산':'결제액 기준'}:null,lineTotal:lineView,orderTotal:convert(row.orderTotal||row.krwOrderTotal,row.krwOrderTotal,row.date,rates),originalLineTotal:row.lineTotal,originalOrderTotal:row.orderTotal,krwOrderTotal:row.krwOrderTotal};
}
function pricesConflict(candidates) {
  // A shorter confirmation is not a contradiction. Compare overlapping facts only.
  return ['retailPrice','unitPrice','salePrice','discountRate','lineTotal','quantity','date','krwUnitPrice','krwSalePrice','krwLineTotal'].some(field=>new Set(candidates.filter(c=>!c.row.cancelled&&c.row[field]!=null).map(c=>JSON.stringify(c.row[field]))).size>1);
}
export function buildCatalog(input, rates=new Map(),decisions={},reviewDecisions={}) {
  const linked=linkOrderReceipts(input,decisions,orderKey);
  const reconciled=reconcileRows(linked.rows,decisions,orderKey),rows=reconciled.rows;
  const cancelledOrders=new Set();
  for(const r of rows){
    const key=orderKey(r);if(r.cancelled&&key)cancelledOrders.add(key);
  }
  const products=new Map();
  for(const row of rows){
    const identityRow=row.identityTarget||row;
    const identityKnown=!!identityRow.product;
    const key=identityKnown?JSON.stringify([productIdentity(identityRow.product),productIdentity(identityRow.option)]):`unresolved:${row.id}`;
    if(!products.has(key))products.set(key,{id:key,identity:{name:identityRow.product||row.subject||'상품 미확인',manufacturer:null,manufacturers:new Map(),sellers:new Set(),option:identityRow.option||null,basis:'상품명 · 옵션·용량 유지',known:identityKnown},purchases:[],buckets:new Map()});
    const group=products.get(key);if(identityRow.manufacturer)group.identity.manufacturers.set(normalizeIdentity(identityRow.manufacturer),identityRow.manufacturer);if(identityRow.merchant)group.identity.sellers.add(identityRow.merchant);
    const purchaseKey=orderKey(row)||`unresolved:${row.id}`;
    if(!group.buckets.has(purchaseKey))group.buckets.set(purchaseKey,[]);
    group.buckets.get(purchaseKey).push({row});
  }
  const orders=new Set();
  for(const group of products.values()){
    const makerConflict=group.identity.manufacturers.size>1;
    group.identity.manufacturer=group.identity.manufacturers.size===1?[...group.identity.manufacturers.values()][0]:null;
    for(const [key,candidates] of group.buckets){
      // Prefer the most complete original; retain every source for audit.
      candidates.sort((a,b)=>Number(!!a.row.identityTarget)-Number(!!b.row.identityTarget)||a.row.issues.length-b.row.issues.length||a.row.id.localeCompare(b.row.id));
      const unresolvedIssue=/^(?:판매자·제조사를 확인|주문번호가 없|주문일을 확인|상품명을 확인|수량을 확인|상품 가격이 없)/;
      const row={...candidates[0].row,evidence:{...candidates[0].row.evidence},issues:[...new Set(candidates.flatMap(c=>c.row.issues.filter(i=>!unresolvedIssue.test(i)&&!i.includes('다른 메일에 같은 주문'))))]};
      for(const {row:other} of candidates)if(!other.cancelled)for(const field of ['retailPrice','unitPrice','salePrice','discountRate','lineTotal','quantity','date','krwUnitPrice','krwSalePrice','krwLineTotal','krwOrderTotal','orderTotal'])if(row[field]==null&&other[field]!=null){row[field]=other[field];row.evidence[field]=other.evidence[field];}
      validate(row);
      const issues=[...row.issues];
      const duplicateCandidates=[...new Map(candidates.flatMap(c=>reconciled.candidates.get(c.row.id)||[]).map(c=>[c.id,c])).values()];
      if(duplicateCandidates.length)issues.push('같은 구매로 보이는 다른 메일이 있어요. 중복 여부를 확인해주세요');
      const sameMessageMultiple = new Set(candidates.map(x=>x.row.messageId)).size<candidates.length;
      const conflict=pricesConflict(candidates) || sameMessageMultiple;
      if(conflict)issues.push('같은 주문·상품에 서로 다른 내역이 있어요');
      if(makerConflict)issues.push('같은 상품명에 서로 다른 제조사가 있어요. 동일 상품인지 확인해주세요');
      const cancelled=cancelledOrders.has(orderKey(row))||row.cancelled;
      if(cancelled&&!issues.some(x=>x.includes('취소')))issues.push('같은 주문에 취소·환불 내역이 있어요');
      const pricing=priceRecord(row,rates);
      const orderLinks=[...new Map(candidates.flatMap(c=>linked.linksByRow.get(c.row.id)||[]).map(link=>[link.id,link])).values()];
      const adjustments=orderLinks.flatMap(link=>link.adjustments);
      const reviewAdjustment=adjustments.filter(a=>candidates.some(c=>c.row.id===a.reviewRowId));
      for(const a of reviewAdjustment)issues.push(a.inferredProduct?'부분 취소 금액이 이 상품 합계와 일치해요. 취소 상품은 추정이므로 원문 확인이 필요해요':'주문에 부분 취소가 있어요. 취소 상품을 확정할 수 없어요');
      if(pricing.regular?.krw===null||pricing.discount?.price?.krw===null)issues.push('원화 환산에 필요한 구매일 환율을 확인하지 못했어요');
      const routine=cancelled||(row.documentKind==='subscription'&&!row.product);
      if(routine)issues.length=0;
      const eligible=!!row.date&&!!orderKey(row)&&group.identity.known&&!makerConflict&&!cancelled&&!conflict&&!row.priceBlocked&&!candidates.some(c=>c.row.priceBlocked)&&!adjustments.some(a=>!a.inferredProduct||candidates.some(c=>c.row.id===a.reviewRowId));
      const adjustmentOnly=candidates.every(c=>c.row.partialRefund);
      const sourceRows=[...candidates.map(c=>c.row),...orderLinks.flatMap(link=>link.receiptRows)];
      const reviewContextKey=makerConflict?`identity-review:${JSON.stringify([group.id,row.id,[...group.identity.manufacturers.keys()].sort()])}`:null;
      const verified=reviewContextKey?!!row.verified&&!!reviewDecisions[reviewContextKey]:row.verified;
      const purchase={id:row.id,record:row,duplicateCandidates,orderLinks,autoMerges:candidates.filter(c=>c.row.autoMergeTarget).map(c=>c.row.id),manualMerges:candidates.filter(c=>c.row.manualMergeTarget).map(c=>c.row.id),order:{key:orderKey(row),id:row.orderId||row.paymentId,date:row.date,dateBasis:row.dateBasis,seller:row.merchant,platform:row.platform||senderDomain(row.sender),quantity:row.quantity,cancelled,adjustmentOnly},pricing,source:{messageIds:[...new Set(sourceRows.map(r=>r.messageId))],rows:sourceRows},issues:[...new Set(issues)],eligible,verified,reviewContextKey,change:null};
      group.purchases.push(purchase);
      if(purchase.order.key&&!cancelled&&!adjustmentOnly)orders.add(purchase.order.key);
    }
    group.purchases.sort((a,b)=>(a.order.date||'').localeCompare(b.order.date||'')||a.id.localeCompare(b.id));
    const usable=group.purchases.filter(p=>p.eligible&&p.pricing.regular?.krw!==null&&p.pricing.regular);
    for(const p of usable){
      const prior=usable.filter(x=>x.order.date<p.order.date&&x.pricing.comparisonBasis===p.pricing.comparisonBasis).at(-1);
      if(prior){
        // Different purchases on the same prior day may have different prices.
        const alternatives=usable.filter(x=>x.order.date===prior.order.date&&x.pricing.comparisonBasis===p.pricing.comparisonBasis);
        const distinct=new Set(alternatives.map(x=>x.pricing.regular.krw));
        if(distinct.size>1){p.issues.push('직전 구매일에 가격이 여러 개라 변화량을 확정하지 않았어요');continue;}
        const old=prior.pricing.regular,now=p.pricing.regular;
        p.change={amount:now.krw-old.krw,percent:old.krw===0?null:(now.krw-old.krw)/old.krw*100,from:prior.order.date,to:p.order.date,estimated:old.kind==='환율 추정'||now.kind==='환율 추정',original:old.original.currency===now.original.currency?{amount:now.original.amount-old.original.amount,currency:now.original.currency}:null};
      }
    }
    group.latest=group.purchases.filter(p=>!p.order.cancelled&&!p.order.adjustmentOnly).at(-1)||group.purchases.at(-1);
    group.reviewCount=group.purchases.filter(p=>p.issues.length&&!p.verified).length;
    group.purchaseCount=group.purchases.filter(p=>!p.order.cancelled&&!p.order.adjustmentOnly).length;
    group.identity.sellers=[...group.identity.sellers];
    group.identity.manufacturers=[...group.identity.manufacturers.values()];
    delete group.buckets;
  }
  const list=[...products.values()].sort((a,b)=>(b.latest?.order.date||'').localeCompare(a.latest?.order.date||'')||a.identity.name.localeCompare(b.identity.name));
  return {products:list,summary:{orders:orders.size,products:list.filter(p=>p.identity.known&&p.purchases.some(x=>!x.order.cancelled&&!x.order.adjustmentOnly)).length,review:list.reduce((n,p)=>n+p.reviewCount,0)}};
}
