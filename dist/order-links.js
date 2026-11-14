// A multi-item payment receipt is evidence for an order, never an item price.
import {storeIdentity,productIdentity,purchaseTimesConflict} from './duplicates.js';
const nameKey=productIdentity;
const idKey=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
const sameMoney=(a,b)=>!!a&&!!b&&a.currency===b.currency&&a.amount===b.amount;
function bundle(value){
  const m=String(value||'').match(/^(.*?)\s*(?:포함\s*총\s*(\d+)|외\s*(\d+))\s*(?:건|종)\s*$/);
  return m?{name:m[1],count:m[2]?Number(m[2]):Number(m[3])+1}:null;
}
function consistent(rows,field){const values=rows.map(r=>r[field]).filter(v=>v!=null);return values.length&&new Set(values.map(v=>JSON.stringify(v))).size===1?values[0]:null;}
export function linkOrderReceipts(input,decisions={},keyFor){
  const byMessage=new Map(),receiptGroups=new Map();
  for(const r of input){
    if(r.documentKind==='order'&&!r.cancelled&&!r.partialRefund&&!decisions[r.id]){if(!byMessage.has(r.messageId))byMessage.set(r.messageId,[]);byMessage.get(r.messageId).push(r);}
    if(r.documentKind==='payment'&&r.product&&!r.cancelled){const key=keyFor(r)||r.id;if(!receiptGroups.has(key))receiptGroups.set(key,[]);receiptGroups.get(key).push(r);}
  }
  const orders=[...byMessage.values()].filter(rows=>rows.every(r=>r.messageItemCount===rows.length&&r.product&&!r.priceBlocked&&r.merchant));
  const pending=[];
  for(const receipts of receiptGroups.values()){
    if(receipts.some(r=>decisions[r.id]))continue;
    const r=receipts.find(r=>!r.partialRefund);if(!r)continue;
    const description=bundle(r.product),total=consistent(receipts,'orderTotal')||(!description&&receipts.every(x=>x.messageItemCount===1)?consistent(receipts,'lineTotal'):null),date=consistent(receipts,'date'),platform=storeIdentity(r.platform||r.merchant);
    if(!total||total.amount<=0||!date||!platform||receipts.some(x=>nameKey(x.product)!==nameKey(r.product)))continue;
    const matches=orders.filter(rows=>{
      const orderId=consistent(rows,'orderId');
      if(r.orderId&&orderId&&idKey(r.orderId)!==idKey(orderId))return false;
      if(date!==consistent(rows,'date')||platform!==storeIdentity(consistent(rows,'platform'))||!sameMoney(total,consistent(rows,'orderTotal')))return false;
      if(description)return rows.length===description.count&&rows.some(x=>nameKey(x.product)===nameKey(description.name));
      // Full names can match despite presentation commas and a different seller
      // named by a marketplace payment receipt. Match the paid order total, not
      // the pre-discount item amount. Truncated names need independent time proof.
      if(rows.length!==1||r.messageItemCount!==1)return false;
      const item=rows[0],short=nameKey(r.product),full=nameKey(item.product);
      if(r.option&&nameKey(r.option)!==nameKey(item.option)||r.quantity&&r.quantity!==item.quantity)return false;
      if(r.manufacturer&&item.manufacturer&&idKey(r.manufacturer)!==idKey(item.manufacturer))return false;
      if(purchaseTimesConflict(r,item))return false;
      if(short===full)return true;
      if(short.length<12||!full.startsWith(short))return false;
      return r.eventTime!=null&&item.eventTime!=null&&Math.abs(r.eventTime-item.eventTime)<=60000;
    });
    if(matches.length===1)pending.push({receipts,rows:matches[0],total,date,platform,timed:!description&&nameKey(r.product)!==nameKey(matches[0][0].product),single:!description});
  }
  const excluded=new Set(),linksByRow=new Map();
  for(const match of pending){
    // Two distinct payments targeting the same order need explicit resolution.
    if(pending.filter(x=>x.rows[0].messageId===match.rows[0].messageId).length!==1)continue;
    const {receipts,rows,total}=match;
    const adjustments=receipts.filter(r=>r.partialRefund).map(r=>{
      const amount=r.refundAmount,remaining=r.remainingAmount;
      const balanced=sameMoney(total,r.orderTotal)&&amount&&remaining&&amount.currency===total.currency&&remaining.currency===total.currency&&amount.amount>0&&amount.amount<total.amount&&Math.abs(total.amount-amount.amount-remaining.amount)<0.01;
      const candidates=balanced?rows.filter(item=>sameMoney(item.lineTotal,amount)):[];
      // A matching line total is a useful estimate, not proof of cancellation.
      const inferred=candidates.length===1?candidates[0]:null;
      return {sourceId:r.id,date:r.refundDate,amount,remaining,balanced:!!balanced,inferredProduct:inferred?.product||null,reviewRowId:inferred?.id||rows[0].id};
    });
    const link={id:receipts[0].id,receiptRows:receipts,adjustments,total,itemCount:rows.length,reason:match.timed?'구매처·날짜·총액·상품명 앞부분이 맞고, 결제와 주문 메일 시각이 1분 이내인 단일 상품 주문서가 하나여서 연결했어요.':match.single?'플랫폼·날짜·상품명·주문 결제액이 일치하는 단일 상품 주문서가 하나여서 연결했어요. 상품 가격과 판매자는 주문서 기준입니다.':'구매처·날짜·주문 결제액·대표 상품명·상품 수가 일치하는 주문서가 하나여서 연결했어요.'};
    for(const row of rows)linksByRow.set(row.id,[link]);
    for(const r of receipts)excluded.add(r.id);
  }
  return {rows:input.filter(r=>!excluded.has(r.id)),linksByRow};
}
