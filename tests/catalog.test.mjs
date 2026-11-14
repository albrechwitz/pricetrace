import test from 'node:test';
import assert from 'node:assert/strict';
import {extractMessages} from '../dist/core.js';
import {buildCatalog,priceRecord} from '../dist/catalog.js';
import {samples,sampleRates} from '../dist/samples.js';
const message=(id,body,header='')=>({id,sender:'orders@shop.example',subject:'주문 완료',text:`판매자: 상점\n${header}주문번호: ${id}\n주문일: 2026-01-${id==='a'?'01':'02'}\n상품명: 커피 200g\n수량: 1\n${body}`});
const catalog=messages=>buildCatalog(extractMessages(messages));
test('consumer price changes are separate from explicit discounts',()=>{
  const p=catalog([message('a','단가: 10,000원'),message('b','단가: 12,000원\n할인가: 9,600원\n할인율: 20%\n상품금액: 9,600원')]).products[0];
  assert.equal(p.latest.pricing.regular.krw,12000);assert.equal(p.latest.pricing.discount.price.krw,9600);assert.equal(p.latest.change.amount,2000);assert.equal(p.latest.change.percent,20);assert.equal(p.purchases[0].pricing.discount,null);
});
test('explicit rate calculates discount; single-product order total can supply consumer price',()=>{
  let [r]=extractMessages([message('a','소비자가: 10,000원\n할인율: 15%')]);assert.equal(priceRecord(r).discount.price.krw,8500);assert.equal(priceRecord(r).discount.price.kind,'할인율 계산');
  [r]=extractMessages([message('a','총 결제금액: 10,000원')]);assert.equal(priceRecord(r).regular.krw,10000);assert.match(priceRecord(r).regularBasis,/주문 결제액/);
});
test('sale-only becomes consumer price while ambiguous discount amounts remain reviewable',()=>{
  const p=catalog([message('a','할인가: 7,000원')]).products[0].latest;assert.equal(p.pricing.regular.krw,7000);assert.equal(p.pricing.discount.price.krw,7000);assert.equal(p.pricing.discount.rate,null);assert.equal(p.issues.length,0);
  const q=catalog([message('a','단가: 10,000원\n할인가: $8')]).products[0].latest;assert.equal(q.eligible,false);assert.ok(q.issues.length);
});
test('product names match across sellers and platforms while variants remain separate',()=>{
  const a=message('a','단가: 10,000원','제조사: 로스트랩\n플랫폼: 마켓1\n');
  const b={...message('b','단가: 11,000원','제조사: 로스트랩\n플랫폼: 마켓2\n'),sender:'order@another.example'};b.text=b.text.replace('판매자: 상점','판매자: 다른상점');
  assert.equal(catalog([a,b]).products.length,1);
  const conflict=catalog([a,{...b,text:b.text.replace('로스트랩','다른제조사')}]);assert.equal(conflict.products.length,1);assert.equal(conflict.products[0].purchaseCount,2);assert.ok(conflict.products[0].purchases.every(p=>!p.eligible&&p.issues.some(s=>s.includes('다른 제조사'))));
  assert.equal(catalog([a,{...b,text:b.text+'\n옵션: 다크'}]).products.length,2);
});
test('manufacturer and seller are retained as evidence rather than product identity keys',()=>{
  const a=message('a','단가: 10,000원','제조사: A\n'),b=message('b','단가: 11,000원');assert.equal(catalog([a,b]).products.length,1);
  const c=message('c','단가: 12,000원','제조사: B\n');const groups=catalog([a,b,c]).products;assert.equal(groups.length,1);assert.equal(groups[0].identity.manufacturer,null);assert.deepEqual(groups[0].identity.manufacturers,['A','B']);assert.ok(groups[0].purchases.every(p=>!p.eligible));
  const crossSeller=catalog([b,{...message('a','단가: 9,000원'),text:message('a','단가: 9,000원').text.replace('판매자: 상점','판매자: 다른상점')}]);assert.equal(crossSeller.products.length,1);assert.equal(crossSeller.products[0].purchaseCount,2);assert.deepEqual(crossSeller.products[0].identity.sellers,['상점','다른상점']);
});
test('same order is one purchase with all source mails; conflicting amounts cannot set a trend',()=>{
  const a=message('a','단가: 10,000원'),copy={...a,id:'copy'};let c=catalog([a,copy]);assert.equal(c.summary.orders,1);assert.equal(c.products[0].purchases.length,1);assert.equal(c.products[0].latest.source.messageIds.length,2);assert.equal(c.summary.review,0);
  c=catalog([a,{...copy,text:copy.text.replace('10,000원','12,000원')}]);assert.equal(c.products[0].latest.eligible,false);assert.equal(c.summary.review,1);
});
test('short confirmation is not a price conflict and does not replace fuller evidence',()=>{
  const a=message('a','단가: 10,000원\n상품금액: 10,000원');const b={...a,id:'copy',text:a.text.replace('단가: 10,000원\n','')};assert.equal(catalog([a,b]).products[0].latest.eligible,true);
});
test('cancelled orders are excluded even when cancellation has no product',()=>{
  const a=message('a','단가: 10,000원');const c=catalog([a,{...a,id:'cancel',subject:'주문 취소',text:a.text.split('상품명:')[0]+'주문이 취소되었습니다.'}]);assert.equal(c.summary.orders,0);assert.equal(c.products.find(p=>p.identity.known).latest.order.cancelled,true);assert.equal(c.products.find(p=>p.identity.known).latest.change,null);
});
test('unknown identity cannot create a price comparison',()=>{
  const rows=extractMessages([message('a','단가: 1,000원'),message('b','단가: 2,000원')]);rows.forEach(r=>r.product=null);const c=buildCatalog(rows);assert.equal(c.products.length,2);assert.equal(c.summary.products,0);assert.ok(c.products.every(p=>!p.latest.eligible));
});

test('named products can establish histories without seller metadata',()=>{
  const rows=extractMessages([message('a','단가: 1,000원'),message('b','단가: 2,000원')]);rows.forEach(r=>r.merchant=null);const c=buildCatalog(rows);assert.equal(c.products.length,1);assert.equal(c.summary.products,1);assert.equal(c.summary.review,0);assert.equal(c.products[0].latest.change.amount,1000);
});

test('display commas normalize while package quantities, sizes and numeric punctuation remain distinct',()=>{
  const a={...message('a','단가: 1,000원'),text:message('a','단가: 1,000원').text.replace('커피 200g','한빛 쿠키, 320g, 2개')};
  const b={...message('b','단가: 2,000원'),text:message('b','단가: 2,000원').text.replace('커피 200g','한빛 쿠키 320g 2개')};
  assert.equal(catalog([a,b]).products.length,1);assert.equal(catalog([a,b]).products[0].purchaseCount,2);
  for(const name of ['한빛 쿠키 320g 3개','한빛 쿠키 400g 2개','한빛 쿠키 320g 2개 블랙'])assert.equal(catalog([a,{...b,text:b.text.replace('한빛 쿠키 320g 2개',name)}]).products.length,2);
  assert.equal(catalog([{...a,text:a.text.replace('한빛 쿠키, 320g, 2개','캔버스 1,5m')},{...b,text:b.text.replace('한빛 쿠키 320g 2개','캔버스 15m')}]).products.length,2);
});
test('KRW original overrides reference rate and foreign originals stay intact',()=>{
  const [r]=extractMessages([message('a','단가: USD 10\n원화 단가: 13,500원')]);const p=priceRecord(r,new Map([['2026-01-01|USD',{date:'2026-01-01',rate:1400}]]));assert.equal(p.regular.krw,13500);assert.equal(p.regular.original.amount,10);assert.equal(p.regular.kind,'원화 원문');
});
test('historical conversion is explicit and failed conversions are never zero prices',()=>{
  const rows=extractMessages([message('a','단가: USD 10'),message('b','단가: USD 10')]);const rates=new Map([['2026-01-01|USD',{rate:1300,date:'2025-12-31'}],['2026-01-02|USD',{rate:1400,date:'2026-01-02'}]]);let c=buildCatalog(rows,rates);assert.equal(c.products[0].latest.change.amount,1000);assert.equal(c.products[0].latest.change.original.amount,0);assert.equal(c.products[0].latest.change.estimated,true);
  c=buildCatalog(rows);assert.equal(c.products[0].latest.pricing.regular.krw,null);assert.equal(c.products[0].latest.change,null);assert.equal(c.summary.review,2);
});
test('same-day ambiguous prior prices and zero denominator do not invent percentages',()=>{
  const a=message('a','단가: 10,000원'),b=message('b','단가: 11,000원');b.text=b.text.replace('2026-01-02','2026-01-01');const c=message('c','단가: 12,000원');const p=catalog([a,b,c]).products[0];assert.equal(p.latest.change,null);assert.ok(p.latest.issues.some(s=>s.includes('직전 구매일')));
  const zero=catalog([message('a','단가: 0원'),message('b','단가: 1,000원')]).products[0].latest;assert.equal(zero.change.percent,null);assert.equal(zero.change.amount,1000);
});
test('sample histories yield reproducible counts and meaningful increases, decreases and stability',()=>{
  const c=buildCatalog(extractMessages(samples),sampleRates);assert.deepEqual(c.summary,{orders:21,products:11,review:4});assert.equal(c.products.length,13);assert.equal(c.products.filter(p=>p.purchaseCount>1).length,8);
  const delta=name=>c.products.find(p=>p.identity.name===name).latest.change.amount;
  assert.equal(delta('오트 밀크 1L × 6팩'),1500);assert.equal(delta('드립백 커피 12개입'),-1600);assert.equal(delta('무향 핸드워시 500ml'),0);
});
test('one marketplace order with different sellers counts once',()=>{
  const a=message('a','단가: 10,000원','플랫폼: 마켓\n');const b={...a,id:'second',text:a.text.replace('판매자: 상점','판매자: 다른상점').replace('커피 200g','컵')};assert.equal(catalog([a,b]).summary.orders,1);assert.equal(catalog([a,b]).summary.products,2);
});
test('explicit KRW unit price converts matching line total without another reference rate',()=>{
  const [r]=extractMessages([message('a','단가: USD 10\n상품금액: USD 10\n원화 단가: 13,500원')]);const p=priceRecord(r);assert.equal(p.lineTotal.krw,13500);assert.equal(p.lineTotal.kind,'원화 단가로 계산');
});
test('discount evidence in another mail of the same purchase remains visible',()=>{
  const a=message('a','단가: 10,000원'),b={...a,id:'copy',text:a.text+'\n할인가: 8,000원\n할인율: 20%'};const p=catalog([a,b]).products[0].latest;assert.equal(p.pricing.discount.price.krw,8000);assert.equal(p.record.evidence.salePrice,'할인가: 8,000원');assert.equal(p.eligible,true);assert.equal(p.source.rows[0].salePrice,null);
});

test('new manufacturer conflicts need context-specific review without clearing unrelated confirmations',()=>{
  const rows=extractMessages([message('a','단가: 10,000원','제조사: A\n'),message('b','단가: 11,000원','제조사: B\n')]);rows.forEach(r=>r.verified=true);
  const c=buildCatalog(rows);assert.equal(c.summary.review,2);assert.ok(c.products[0].purchases.every(p=>!p.verified&&p.reviewContextKey));
  const reviews=Object.fromEntries(c.products[0].purchases.map(p=>[p.reviewContextKey,true]));assert.equal(buildCatalog(rows,new Map(),{},reviews).summary.review,0);
  const changed=rows.map((r,i)=>i?{...r,verified:false,unitPrice:{amount:13000,currency:'KRW'}}:r);assert.equal(buildCatalog(changed,new Map(),{},reviews).summary.review,1);
  const extra=extractMessages([message('c','단가: 12,000원','제조사: C\n')]);assert.equal(buildCatalog([...rows,...extra],new Map(),{},reviews).summary.review,3);
  assert.ok(buildCatalog([rows[0]]).products[0].latest.verified);
});
