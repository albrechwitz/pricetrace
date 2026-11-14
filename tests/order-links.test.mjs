import test from 'node:test';
import assert from 'node:assert/strict';
import {extractMessages} from '../dist/core.js';
import {buildCatalog} from '../dist/catalog.js';
const table=[['상품명','단가','수량','상품금액','판매자'],['커팅매트, 그린, A3','7,000원','3','21,000원','마켓'],['수납함, 투명','38,000원','1','38,000원','입점상점']];
const order={id:'o',subject:'[마켓] 주문 완료',sender:'order@market.example',receivedAt:'2026-10-30T12:43:00Z',tables:[table],text:table.flat().join('\n')+'\n결제 정보\n총 결제금액\n59,000원'};
const receipt={id:'p',subject:'KCP - 마켓의 결제 내역입니다.',sender:'receipt@pg.example',text:'구매상점명\n마켓\n결제일시\n2026년 10월 30일 21시 43분\n주문번호\nPG-1\n승인번호\nPAY-1\n결제금액\n59,000원\n주문상품명\n커팅매트 그린 A3 포함 총 2건'};
const refund={...receipt,id:'r',subject:'KCP - 마켓의 결제부분취소 내역입니다.',text:receipt.text+'\n부분취소금액\n21,000원\n취소가능금액\n38,000원\n취소요청일시\n2026년 11월 1일 14시 15분'};
const catalog=messages=>buildCatalog(extractMessages(messages));
test('HTML seller column header never becomes the platform or common seller',()=>{const rows=extractMessages([order]);assert.equal(rows.length,2);assert.ok(rows.every(r=>r.platform==='마켓'));assert.deepEqual(rows.map(r=>r.merchant),['마켓','입점상점']);});
test('multi-item receipt attaches to the order without inventing a product or changing item prices',()=>{
  const c=catalog([order,receipt]);assert.deepEqual(c.summary,{orders:1,products:2,review:0});
  assert.deepEqual(c.products.map(p=>p.latest.pricing.regular.krw).sort((a,b)=>a-b),[7000,38000]);
  for(const p of c.products){assert.deepEqual(p.latest.source.messageIds,['o','p']);assert.equal(p.latest.orderLinks.length,1);assert.equal(p.latest.orderLinks[0].itemCount,2);}
});
test('receipt connection is order-independent and does not mutate extracted source rows',()=>{const rows=extractMessages([refund,receipt,order]),before=JSON.stringify(rows);const c=buildCatalog(rows);assert.equal(c.summary.orders,1);assert.equal(c.summary.review,1);assert.equal(JSON.stringify(rows),before);});
test('partial refund remains an explicit estimate and review without cancelling the whole order',()=>{
  const c=catalog([order,receipt,refund]);assert.deepEqual(c.summary,{orders:1,products:2,review:1});
  const mat=c.products.find(p=>p.identity.name.startsWith('커팅')),other=c.products.find(p=>p!==mat);
  const a=mat.latest.orderLinks[0].adjustments[0];assert.equal(a.amount.amount,21000);assert.equal(a.remaining.amount,38000);assert.equal(a.date,'2026-11-01');assert.equal(a.balanced,true);assert.equal(a.inferredProduct,mat.identity.name);
  assert.equal(mat.latest.order.cancelled,false);assert.equal(mat.latest.eligible,false);assert.equal(other.latest.eligible,true);assert.equal(mat.latest.pricing.regular.krw,7000);assert.equal(mat.latest.source.messageIds.length,3);
});
test('ambiguous or unbalanced refunds never guess an affected item',()=>{
  for(const changed of [refund.text.replace('21,000원','20,000원'),refund.text.replace('38,000원','37,000원')]){
    const c=catalog([order,receipt,{...refund,text:changed}]);assert.equal(c.summary.review,1);assert.ok(c.products.every(p=>!p.latest.eligible));assert.equal(c.products[0].latest.orderLinks[0].adjustments[0].inferredProduct,null);
  }
});
test('explicit separation restores aggregate receipts and survives recalculation',()=>{
  const rows=extractMessages([order,receipt,refund]),decision={'p:0':'separate','r:0':'separate'};
  for(let i=0;i<2;i++){const c=buildCatalog(rows,new Map(),decision);assert.equal(c.summary.orders,2);assert.ok(c.products.every(p=>p.latest.orderLinks.length===0));assert.equal(c.summary.review,1);}
});
test('date, platform, count, product, total and explicit order ID mismatches prevent receipt attachment',()=>{
  const changes=[['2026년 10월 30일','2026년 10월 29일'],['마켓','다른마켓'],['총 2건','총 3건'],['그린 A3','블루 A3'],['59,000원','58,000원']];
  for(const [from,to] of changes){const c=catalog([order,{...receipt,text:receipt.text.replaceAll(from,to)}]);assert.ok(c.products.every(p=>!p.latest.orderLinks.length),from);}
  const c=catalog([{...order,text:order.text+'\n주문번호: STORE-2'},receipt]);assert.ok(c.products.every(p=>!p.latest.orderLinks.length));
});
test('two same-day orders or two distinct payment IDs are not collapsed',()=>{
  for(const messages of [[order,{...order,id:'o2'},receipt],[order,receipt,{...receipt,id:'p2',text:receipt.text.replace('PG-1','PG-2').replace('PAY-1','PAY-2')} ]]){
    const c=catalog(messages);assert.equal(c.summary.orders,3);assert.ok(c.products.every(p=>p.purchases.every(x=>!x.orderLinks.length)));
  }
});
test('partial receipt without an original payment is retained as a separate adjustment',()=>{const c=catalog([order,refund]);assert.equal(c.summary.orders,1);assert.ok(c.products.every(p=>!p.latest.orderLinks.length));assert.equal(c.summary.review,1);});
const single={id:'single',subject:'[마켓] 주문 완료',sender:'order@market.example',receivedAt:'2026-10-30T12:43:25Z',text:'플랫폼: 마켓\n판매자: 입점상점\n상품명: 베이직 코튼 원단 패브릭, 연그레이, 110 x 450cm\n수량: 2\n단가: 8,000원\n상품금액: 16,000원\n총 결제금액: 16,000원'};
const short={...receipt,text:receipt.text.replace('59,000원','16,000원').replace('커팅매트 그린 A3 포함 총 2건','베이직 코튼 원단 패브릭, 연그')};
test('truncated single-item receipt requires matching time and keeps the real unit price',()=>{const c=catalog([single,short]);assert.deepEqual(c.summary,{orders:1,products:1,review:0});assert.equal(c.products[0].latest.pricing.regular.krw,8000);assert.equal(c.products[0].latest.order.quantity,2);assert.equal(c.products[0].latest.orderLinks.length,1);assert.match(c.products[0].latest.orderLinks[0].reason,/1분/);});
test('truncated names alone, missing times, distant times or multiple matches never link',()=>{
  for(const messages of [[{...single,receivedAt:'2026-10-30'},short],[{...single,receivedAt:'2026-10-30T13:43:25Z'},short],[single,{...single,id:'s2'},short],[single,{...short,text:short.text.replace('21시 43분','25시 43분')}],[single,{...short,text:short.text+'\n옵션: 블루'}]])assert.ok(catalog(messages).products.every(p=>p.purchases.every(x=>!x.orderLinks.length)));
});
test('forwarded single-item orders compare original send time, not forwarding time',()=>{const forwarded={...single,subject:'FW: [마켓] 주문 완료',receivedAt:'2026-11-10T00:00:00Z',text:'-----Original Message-----\nFrom: "마켓"<order@market.example>\nSent: 2026-10-30 (금) 21:43:25 (GMT+09:00)\nSubject: [마켓] 주문 완료\n\n'+single.text};const c=catalog([forwarded,short]);assert.equal(c.summary.orders,1);assert.equal(c.summary.review,0);});
test('single-item payment labelled item amount can link only against the full order total',()=>{const payment={...short,text:short.text.replace('결제금액\n16,000원\n','')+'\n상품금액\n16,000원'};let c=catalog([single,payment]);assert.equal(c.summary.orders,1);assert.equal(c.products[0].latest.pricing.regular.krw,8000);c=catalog([{...single,text:single.text.replace('총 결제금액: 16,000원','총 결제금액: 19,000원')},payment]);assert.ok(c.products.every(p=>!p.latest.orderLinks.length));});

const discountedOrder={id:'discounted',subject:'[마켓] 주문 완료',sender:'order@market.example',receivedAt:'2026-10-30',text:'플랫폼: 마켓\n판매자: 새봄식품\n상품명: 한빛 버터 쿠키, 320g, 2개\n수량: 1\n단가: 12,000원\n상품금액: 12,000원\n총 결제금액: 10,500원'};
const fullReceipt={...receipt,text:receipt.text.replace('59,000원','10,500원').replace('커팅매트 그린 A3 포함 총 2건','한빛 버터 쿠키 320g 2개').replace('구매상점명\n마켓','구매상점명\n마켓(주)')};
test('full-name receipt matches the discounted order total despite separator and seller differences',()=>{
  for(const seller of ['마켓(주)','새봄식품','다른입점상점']){
    const rows=extractMessages([{...discountedOrder,text:discountedOrder.text.replace('새봄식품',seller)},fullReceipt]),before=JSON.stringify(rows),c=buildCatalog(rows),p=c.products[0].latest;
    assert.deepEqual(c.summary,{orders:1,products:1,review:0});assert.equal(p.pricing.regular.krw,12000);assert.equal(p.pricing.orderTotal.krw,10500);assert.equal(p.order.seller,seller);assert.equal(p.pricing.discount,null);assert.equal(p.order.quantity,1);assert.equal(p.source.messageIds.length,2);assert.equal(p.orderLinks.length,1);assert.equal(JSON.stringify(rows),before);
  }
});
test('full-name matching preserves same-day multiple orders, distinct payments and manual separation',()=>{
  for(const messages of [[discountedOrder,{...discountedOrder,id:'second-order'},fullReceipt],[discountedOrder,fullReceipt,{...fullReceipt,id:'second-payment',text:fullReceipt.text.replace('PG-1','PG-2').replace('PAY-1','PAY-2')} ]]){
    const c=catalog(messages);assert.equal(c.summary.orders,3);assert.ok(c.products.every(p=>p.purchases.every(x=>!x.orderLinks.length)));
  }
  const rows=extractMessages([discountedOrder,fullReceipt]);for(let i=0;i<2;i++){const c=buildCatalog(rows,new Map(),{'p:0':'separate'});assert.equal(c.summary.orders,2);assert.equal(c.products.length,1);assert.ok(c.products[0].purchases.every(x=>!x.orderLinks.length));}
});
test('full-name receipt still requires matching platform, paid total, quantity, options and explicit order IDs',()=>{
  for(const changed of [fullReceipt.text.replace('10,500원','12,000원'),fullReceipt.text.replaceAll('마켓','다른플랫폼'),fullReceipt.text.replace('320g 2개','320g 3개'),fullReceipt.text+'\n수량: 2',fullReceipt.text+'\n옵션: 블루'])assert.ok(catalog([discountedOrder,{...fullReceipt,text:changed}]).products.every(p=>p.purchases.every(x=>!x.orderLinks.length)));
  assert.ok(catalog([{...discountedOrder,text:discountedOrder.text+'\n주문번호: DIFFERENT'},fullReceipt]).products.every(p=>p.purchases.every(x=>!x.orderLinks.length)));
  const distinctId=catalog([{...discountedOrder,text:discountedOrder.text+'\n주문번호: A,B'},{...fullReceipt,text:fullReceipt.text.replace('PG-1','AB')}]);assert.equal(distinctId.summary.orders,2);assert.ok(distinctId.products[0].purchases.every(x=>!x.orderLinks.length&&!x.autoMerges.length));
});

test('full-name receipts with conflicting explicit purchase times remain separate for review',()=>{
  const timedOrder={...discountedOrder,receivedAt:'2026-10-30T13:43:00Z',text:discountedOrder.text+'\n주문일시: 2026-10-30 22:43:00'};
  let c=catalog([timedOrder,fullReceipt]);assert.equal(c.summary.orders,2);assert.equal(c.summary.review,2);assert.ok(c.products[0].purchases.every(x=>!x.orderLinks.length&&!x.autoMerges.length));
  // The fallback duplicate reconciler must not undo the time conflict either.
  c=catalog([{...timedOrder,text:timedOrder.text.replaceAll('12,000원','10,500원')},fullReceipt]);assert.equal(c.summary.orders,2);assert.ok(c.products[0].purchases.every(x=>!x.orderLinks.length&&!x.autoMerges.length));assert.equal(c.summary.review,2);
});

test('full-name paid-total matches tolerate delayed notification delivery without weakening purchase checks',()=>{
  const delayed={...discountedOrder,receivedAt:'2026-10-30T13:13:00Z'};
  const rows=extractMessages([delayed,fullReceipt]);assert.equal(rows[0].eventTimeBasis,'received');assert.equal(rows[1].eventTimeBasis,'purchase');assert.ok(Math.abs(rows[0].eventTime-rows[1].eventTime)>60000);
  const c=buildCatalog(rows);assert.deepEqual(c.summary,{orders:1,products:1,review:0});assert.equal(c.products[0].latest.pricing.regular.krw,12000);assert.equal(c.products[0].latest.source.messageIds.length,2);
  const ambiguous=catalog([delayed,{...delayed,id:'another-order'},fullReceipt]);assert.equal(ambiguous.summary.orders,3);assert.ok(ambiguous.products[0].purchases.every(p=>!p.orderLinks.length&&!p.autoMerges.length));
  const separated=buildCatalog(rows,new Map(),{'p:0':'separate'});assert.equal(separated.summary.orders,2);
});

test('full-name matching treats forwarded send time as notification evidence rather than purchase time',()=>{
  const forwarded={...discountedOrder,subject:'FW: [마켓] 주문 완료',receivedAt:'2026-11-02T00:00:00Z',text:'-----Original Message-----\nFrom: "마켓"<order@market.example>\nSent: 2026-10-30 (금) 22:13:00 (GMT+09:00)\nSubject: [마켓] 주문 완료\n\n'+discountedOrder.text};
  const rows=extractMessages([forwarded,fullReceipt]);assert.equal(rows[0].eventTimeBasis,'forwarded');assert.equal(rows[0].date,'2026-10-30');assert.deepEqual(buildCatalog(rows).summary,{orders:1,products:1,review:0});
  const shortDelayed={...single,receivedAt:'2026-10-30T13:13:00Z'};assert.ok(catalog([shortDelayed,short]).products.every(p=>p.purchases.every(x=>!x.orderLinks.length)));
});
