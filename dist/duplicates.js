import {isBundleName} from './pricing.js';
const identity=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
// Ignore display separators, but preserve numeric punctuation, units and options.
export const productIdentity=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/(?<!\d),|,(?!\d)/g,'').replace(/\s+/g,'');
export const purchaseTimesConflict=(a,b)=>a.eventTimeBasis==='purchase'&&b.eventTimeBasis==='purchase'&&a.eventTime!=null&&b.eventTime!=null&&Math.abs(a.eventTime-b.eventTime)>60000;
export const storeIdentity=s=>identity(s).replace(/주식회사|\(주\)|㈜/g,'').replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/$/,'');
function comparableAmount(r){const m=r.messageItemCount===1?r.orderTotal||r.lineTotal:r.lineTotal||r.orderTotal;return m||((r.salePrice||r.unitPrice||r.retailPrice)&&r.quantity?{...(r.salePrice||r.unitPrice||r.retailPrice),amount:(r.salePrice||r.unitPrice||r.retailPrice).amount*r.quantity}:null);}
export function reconcileRows(input,decisions={},keyFor){
  const original=new Map(input.map(r=>[r.id,r]));const rows=input.map(r=>({...r}));
  for(const r of rows){let target=decisions[r.id];const seen=new Set([r.id]);while(target&&decisions[target]&&!seen.has(target)){seen.add(target);target=decisions[target];}if(target&&!seen.has(target)&&original.has(target)){const t=original.get(target);if(keyFor(t)){r.purchaseAlias=keyFor(t);r.identityTarget=t;r.manualMergeTarget=t.id;}}}
  const candidates=new Map();
  const buckets=new Map();for(const r of rows){const a=comparableAmount(r);if(decisions[r.id]==='separate'||!r.product||!r.date||!a||r.cancelled||r.partialRefund||r.manualMergeTarget)continue;const store=storeIdentity(r.platform||r.merchant);if(!store)continue;const key=JSON.stringify([store,r.date,a.currency,a.amount]);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(r);}
  for(const list of buckets.values())for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
    const a=list[i],b=list[j];if(a.messageId===b.messageId||keyFor(a)===keyFor(b))continue;
    // Different explicit order IDs are evidence of distinct purchases.
    if(a.orderId&&b.orderId&&identity(a.orderId)!==identity(b.orderId))continue;
    if(a.paymentId&&b.paymentId&&identity(a.paymentId)!==identity(b.paymentId))continue;
    if(productIdentity(a.option)!==productIdentity(b.option))continue;
    if(a.quantity&&b.quantity&&a.quantity!==b.quantity)continue;
    const x=productIdentity(a.product),y=productIdentity(b.product),exact=x===y;
    const truncated=Math.min(x.length,y.length)>=12&&(x.startsWith(y)||y.startsWith(x));
    if(!exact&&!truncated)continue;
    if(a.manufacturer&&b.manufacturer&&identity(a.manufacturer)!==identity(b.manufacturer))continue;
    for(const [from,to] of [[a,b],[b,a]]){if(!candidates.has(from.id))candidates.set(from.id,[]);candidates.get(from.id).push({id:to.id,product:to.product,date:to.date,merchant:to.merchant,amount:comparableAmount(to),reason:exact?'같은 날·구매처·상품·금액':'같은 날·구매처·금액 · 상품명이 일부만 일치'});}
  }
  // Automatically join a uniquely matched order and payment receipt. Repeated
  // same-day purchases, truncated names and multi-item totals remain separate.
  const byId=new Map(rows.map(r=>[r.id,r]));
  for(const a of rows){
    const matches=candidates.get(a.id)||[];if(matches.length!==1||decisions[a.id])continue;
    const b=byId.get(matches[0].id);if(!b||decisions[b.id]||(candidates.get(b.id)||[]).length!==1)continue;
    if(a.documentKind===b.documentKind||![a.documentKind,b.documentKind].every(k=>['order','payment'].includes(k)))continue;
    if(purchaseTimesConflict(a,b))continue;
    if(a.messageItemCount!==1||b.messageItemCount!==1||isBundleName(a.product)||isBundleName(b.product)||productIdentity(a.product)!==productIdentity(b.product))continue;
    const target=a.documentKind==='order'?a:b,receipt=target===a?b:a;
    if(!keyFor(target))continue;
    receipt.purchaseAlias=keyFor(target);receipt.identityTarget=target;receipt.autoMergeTarget=target.id;
    candidates.delete(a.id);candidates.delete(b.id);
  }
  return {rows,candidates};
}
