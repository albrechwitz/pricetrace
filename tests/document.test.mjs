import test from 'node:test';
import assert from 'node:assert/strict';
import {extractMessages} from '../dist/core.js';
import {buildCatalog} from '../dist/catalog.js';
const msg=(text,subject='[마켓] 주문 내역',id='a')=>({id,subject,sender:'order@market.example',receivedAt:'Sat, 07 Nov 2026 09:30:00 +0900',text});
test('separate label/value receipt fields and Korean dates are normalized without treating footer refund policy as cancellation',()=>{
  const [r]=extractMessages([msg('상품명\n텀블러\n결제일시\n2026년 11월 07일 09시 30분\n승인번호\nTEST-001\n상품금액\n19,000원\n상호\n테스트상점\n배송, 환불 문의는 쇼핑몰로 연락 바랍니다.','테스트상점의 결제 내역입니다.')]);assert.equal(r.product,'텀블러');assert.equal(r.lineTotal.amount,19000);assert.equal(r.paymentId,'TEST-001');assert.equal(r.date,'2026-11-07');assert.equal(r.merchant,'테스트상점');assert.equal(r.cancelled,false);assert.equal(r.quantity,null);
});
test('flattened multicolumn table recovers products, quantities, prices and sellers',()=>{
  const rows=extractMessages([msg('구매 상세내역\n쿠팡가\n수량\n구매금액\n판매자\n코튼 가방, 블루\n19,000원\n1\n19,000원\n가방상점\n노트 A5\n5,000원\n2\n10,000원\n문구상점\n결제 정보\n총 결제금액\n29,000원\n상품의 교환/반품 안내\n취소 및 환불은 문의 바랍니다.')]);assert.equal(rows.length,2);assert.equal(rows[0].product,'코튼 가방, 블루');assert.equal(rows[0].merchant,'가방상점');assert.equal(rows[1].quantity,2);assert.equal(rows[1].unitPrice.amount,5000);assert.equal(rows[0].dateBasis,'메일 수신일');assert.equal(rows[0].cancelled,false);
});
test('a combined sale/list price column retains both roles rather than choosing an arbitrary number',()=>{
  const rows=extractMessages([msg('주문번호 :\nT-1000\n· 결제일시\n2026-11-08 10:00:00\n상품정보\n상품할인적용가 (판매가)\n수량\n합계\n[테스트브랜드] 견과류\n8,000원 10,000원\n2개\n16,000원\n상품금액 20,000원 + 배송비 0원 - 할인 4,000원 = 총결제금액 16,000원')]);assert.equal(rows.length,1);assert.equal(rows[0].unitPrice.amount,10000);assert.equal(rows[0].salePrice.amount,8000);assert.equal(rows[0].quantity,2);assert.equal(rows[0].priceBlocked,false);
});
test('HTML cell metadata handles changed column order, nested text and a single explicit order link ID',()=>{
  const rows=extractMessages([{...msg('주문 완료'),tables:[[['상품명','수량','단가','상품금액'],['노트 A5','2','3,000원','6,000원']]],orderIds:['LINK-1234']}]);assert.equal(rows[0].product,'노트 A5');assert.equal(rows[0].orderId,'LINK-1234');assert.equal(rows[0].lineTotal.amount,6000);
});
test('partial cancellations are review events and do not imply a whole-order cancellation',()=>{
  const [r]=extractMessages([msg('주문번호: T1\n상품명: 컵\n수량: 1\n단가: 3,000원','마켓의 결제부분취소 내역입니다.')]);assert.equal(r.cancelled,false);assert.equal(r.partialRefund,true);assert.equal(r.priceBlocked,true);
});
test('damaged text remains flagged for refetch rather than guessing its product',()=>{
  const [r]=extractMessages([msg('�쇰Ц\n�곹뭹\n10,000 ��')]);assert.ok(r.issues.some(x=>x.includes('인코딩')));assert.equal(r.product,null);
});
test('order-free dated purchases establish a price history without unnecessary review',()=>{
  const a=msg('상품명: 컵\n판매자: 상점\n주문일: 2026-01-01\n수량: 1\n단가: 1,000원');const b={...a,id:'b',text:a.text.replace('2026-01-01','2026-02-01').replace('1,000원','1,500원')};const c=buildCatalog(extractMessages([a,b]));assert.equal(c.summary.orders,2);assert.equal(c.products[0].latest.change.amount,500);assert.equal(c.summary.review,0);
});
