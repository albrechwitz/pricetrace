import test from 'node:test';
import assert from 'node:assert/strict';
import {money,quantity,extractMessages} from '../dist/core.js';
import {samples} from '../dist/samples.js';
const message=text=>({id:'case',sender:'order@example.com',subject:'주문 완료',text});
const prefix='판매처: 테스트상점\n주문번호: T1\n주문일: 2026-11-12\n';
test('currencies must be explicit; reject ambiguous dollars and malformed amounts',()=>{
  assert.deepEqual(money('12,300원'),{amount:12300,currency:'KRW'});
  assert.deepEqual(money('USD 12.50'),{amount:12.5,currency:'USD'});
  for(const s of ['$24','12,00원','약 10,000원','10,000원 ~ 20,000원','-100원','1.5원','Infinity','1000','KRW USD 10','₩$10'])assert.equal(money(s),null,s);
  assert.equal(money('USD 10','EUR'),null);
  assert.deepEqual(money(18,'EUR'),{amount:18,currency:'EUR'});
});
test('quantity never defaults to one or guesses pack size',()=>{
  assert.equal(quantity('2개'),2);assert.equal(quantity('0'),null);assert.equal(quantity('6팩 × 2'),null);assert.equal(quantity('1.5'),null);assert.equal(quantity(undefined),null);
});
test('single-product total is retained separately and accepted as a display fallback',()=>{
  const [r]=extractMessages([message(prefix+'상품명: 커피\n수량: 1\n총 결제금액: 12,000원')]);
  assert.equal(r.unitPrice,null);assert.equal(r.lineTotal,null);assert.equal(r.orderTotal.amount,12000);assert.equal(r.messageItemCount,1);assert.equal(r.issues.length,0);
});
test('multiple products keep independent quantity and price',()=>{
  const rows=extractMessages([message(prefix+'상품명: 노트\n수량: 2\n단가: 3,000원\n상품금액: 6,000원\n상품명: 펜\n수량: 1\n단가: 1,500원\n총 결제금액: 10,500원')]);
  assert.equal(rows.length,2);assert.equal(rows[0].quantity,2);assert.equal(rows[1].unitPrice.amount,1500);assert.equal(rows[1].lineTotal,null);assert.equal(rows[1].orderTotal.amount,10500);assert.equal(rows[0].issues.length,0);
});
test('amount mismatch and conflicting quantities are flagged',()=>{
  const [r]=extractMessages([message(prefix+'상품명: 컵\n수량: 2\n수량: 3\n단가: 10,000원\n상품금액: 15,000원')]);
  assert.ok(r.issues.some(x=>x.includes('여러 개')));assert.ok(r.issues.some(x=>x.includes('일치하지')));
});
test('invalid dates and missing fields remain unknown',()=>{
  const [r]=extractMessages([message('판매처: 가게\n주문일: 2026-02-30\n상품명: 컵')]);
  assert.equal(r.date,null);assert.equal(r.quantity,null);assert.ok(r.issues.some(x=>x.includes('주문일')));assert.ok(r.issues.some(x=>x.includes('상품 가격')));
});
test('duplicate messages are idempotent and duplicate orders remain inspectable',()=>{
  const m=message(prefix+'상품명: 컵\n수량: 1\n단가: 10,000원');
  const rows=extractMessages([m,m,{...m,id:'copy'},{...m,id:'other',sender:'different@example.com'}]);
  assert.equal(rows.length,3);assert.equal(rows[1].duplicateOf,rows[0].id);assert.equal(rows[2].duplicateOf,null);
});
test('structured orders use per-offer prices and explicit quantity',()=>{
  const [r]=extractMessages([{id:'json',sender:'x',text:'',structured:[{'@graph':[{'@type':'Order',seller:{name:'Store'},orderNumber:'S1',orderDate:'2026-11-01',price:100,priceCurrency:'USD',acceptedOffer:{itemOffered:{name:'Notebook'},price:10,priceCurrency:'USD'}}]}]}]);
  assert.equal(r.unitPrice.amount,10);assert.equal(r.orderTotal.amount,100);assert.equal(r.quantity,null);assert.ok(r.evidence.unitPrice);assert.equal(r.issues.length,0);
});
test('unsupported markup returns a review row rather than a fabricated product',()=>{
  const [r]=extractMessages([message('배송이 시작되었습니다. 총 90,000원입니다.')]);assert.equal(r.product,null);assert.equal(r.unitPrice,null);assert.ok(r.issues.length);
});
test('synthetic extraction retains all originals and distinct manufacturers',()=>{
  const rows=extractMessages(samples);assert.equal(rows.length,24);assert.equal(rows.filter(r=>r.product).length,23);assert.equal(rows.filter(r=>r.duplicateOf).length,1);assert.equal(new Set(rows.filter(r=>r.product==="유리 밀폐용기 800ml").map(r=>r.manufacturer)).size,2);
});
test('explicit body discounts supplement a uniquely matching structured product',()=>{
  const m=message(prefix+'상품명: 커피\n소비자가: 10,000원\n할인가: 8,000원\n할인율: 20%');m.structured=[{'@type':'Order',seller:{name:'테스트상점'},orderNumber:'T1',orderDate:'2026-11-12',acceptedOffer:{itemOffered:{name:'커피'},price:8000,priceCurrency:'KRW',eligibleQuantity:{value:1}}}];const [r]=extractMessages([m]);assert.equal(r.retailPrice.amount,10000);assert.equal(r.salePrice.amount,8000);assert.equal(r.discountRate,20);assert.ok(r.evidence.salePrice);assert.equal(r.priceBlocked,false);
});
