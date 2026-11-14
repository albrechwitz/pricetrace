import test from 'node:test';
import assert from 'node:assert/strict';
import {extractMessages} from '../dist/core.js';
import {buildCatalog} from '../dist/catalog.js';
const forward=(id,date,price)=>({id,subject:'FW: Fwd: [상점] 주문 완료',sender:'forwarder@example.test',receivedAt:'2026-06-26T10:00:00Z',text:`-----Original Message-----\nFrom: "상점"<order@shop.example>\nTo: recipient@example.test\nSent: ${date} (목) 21:15:20 (GMT+09:00)\nSubject: [상점] 주문 완료\n\n상품명: 식품 1kg\n수량: 1\n단가: ${price}원`});
test('forwarded order keeps seller and uses original send date, explicitly labelled',()=>{const [r]=extractMessages([forward('a','2026-06-11',16000)]);assert.equal(r.merchant,'상점');assert.equal(r.platform,'상점');assert.equal(r.date,'2026-06-11');assert.equal(r.dateBasis,'전달 원문 발송일');assert.match(r.evidence.date,/Sent: 2026-06-11/);assert.equal(buildCatalog([r]).summary.review,0);});
test('original send dates restore a price history hidden by one common forwarding date',()=>{const c=buildCatalog(extractMessages([forward('a','2026-06-11',16000),forward('b','2026-06-18',16500),{...forward('c','2026-08-07',18000),receivedAt:'2026-08-07T14:00:00Z'}]));assert.equal(c.summary.review,0);assert.equal(c.products[0].latest.change.amount,1500);assert.equal(c.products[0].latest.change.from,'2026-06-18');});
test('explicit purchase date wins over forward date; future, invalid or unstructured Sent fields do not replace received date',()=>{
  const valid=forward('a','2026-06-11',10000);assert.equal(extractMessages([{...valid,text:valid.text+'\n주문일: 2026-06-10'}])[0].date,'2026-06-10');
  for(const text of [valid.text.replace('2026-06-11','2027-01-01'),valid.text.replace('2026-06-11','2026-02-30'),valid.text.replace('-----Original Message-----','배송 안내')]){const [r]=extractMessages([{...valid,text}]);assert.equal(r.date,'2026-06-26');assert.equal(r.dateBasis,'메일 수신일');}
});
test('JSON-LD without a purchase date can also use the forwarded original date',()=>{const message=forward('s','2026-06-11',10000);message.structured=[{'@type':'Order',seller:{name:'상점'},acceptedOffer:{itemOffered:{name:'식품 1kg'},price:10000,priceCurrency:'KRW'}}];assert.equal(extractMessages([message])[0].date,'2026-06-11');});

test('event time records explicit purchase, forwarded send and received provenance',()=>{
  const message=forward('s','2026-06-11',10000),[sent]=extractMessages([message]);assert.equal(sent.eventTimeBasis,'forwarded');
  const [purchase]=extractMessages([{...message,text:message.text+'\n주문일시: 2026-06-11 20:30:00'}]);assert.equal(purchase.eventTimeBasis,'purchase');assert.equal(purchase.eventTime,Date.parse('2026-06-11T20:30:00+09:00'));
  const [received]=extractMessages([{id:'received',subject:'[상점] 주문 완료',receivedAt:'2026-06-11T12:00:00Z',text:'상품명: 식품 1kg\n단가: 10000원'}]);assert.equal(received.eventTimeBasis,'received');
  const structured={'@type':'Order',seller:{name:'상점'},orderDate:'2026-06-11T20:30:00+09:00',acceptedOffer:{itemOffered:{name:'식품 1kg'},price:10000,priceCurrency:'KRW'}};
  assert.equal(extractMessages([{...message,structured:[structured]}])[0].eventTimeBasis,'purchase');
  delete structured.orderDate;assert.equal(extractMessages([{...message,structured:[structured]}])[0].eventTimeBasis,'forwarded');
});

test('date-only structured orders retain matching explicit body times without crossing dates',()=>{
  const structured={'@type':'Order',seller:{name:'상점'},orderDate:'2026-06-11',acceptedOffer:{itemOffered:{name:'식품 1kg'},price:10000,priceCurrency:'KRW'}};
  const message={id:'structured-time',subject:'[상점] 주문 완료',receivedAt:'2026-06-11T13:00:00Z',text:'판매자: 상점\n상품명: 식품 1kg\n단가: 10000원\n주문일시: 2026-06-11 20:30:00',structured:[structured]};
  const [row]=extractMessages([message]);assert.equal(row.eventTimeBasis,'purchase');assert.equal(row.eventTime,Date.parse('2026-06-11T20:30:00+09:00'));
  const [different]=extractMessages([{...message,text:message.text.replace('2026-06-11 20:30:00','2026-06-10 20:30:00')}]);assert.equal(different.date,'2026-06-11');assert.equal(different.eventTimeBasis,'received');
});
