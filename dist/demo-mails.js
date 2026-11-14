// Fictional HTML receipts. The browser uses the same inert HTML parser as Gmail.
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const table=(headers,rows)=>`<table><thead><tr>${headers.map(h=>`<th>${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td><span>${escape(cell)}</span></td>`).join('')}</tr>`).join('')}</tbody></table>`;
const fields=entries=>entries.map(([label,value])=>`<p>${escape(label)}: ${escape(value)}</p>`).join('');
const frame=body=>`<!doctype html><html lang="ko"><body><h1>주문 내역을 확인해 주세요</h1>${body}<p>배송 및 일반 반품 정책은 고객센터를 확인하세요.</p></body></html>`;
const won=n=>`${n.toLocaleString('en-US')}원`;
export const demoHtmlMails=[];
function add(id,subject,date,body){demoHtmlMails.push({id:`demo-html-${id}`,subject,sender:'orders@fictional-market.example',receivedAt:date,html:frame(body)});}
for(const [i,date,price] of [[1,'2026-08-12',16800],[2,'2026-09-20',17400],[3,'2026-11-10',18900]]){
  const forwarded=i<3?`<p>-----Original Message-----<br>From: &quot;느린마켓&quot;&lt;orders@slow.example&gt;<br>Sent: ${date} (목) 10:00:00 (GMT+09:00)<br>Subject: [느린마켓] 주문 완료</p>`:'';
  add(`oat-${i}`,`${i<3?'FW: ':''}[느린마켓] 주문 완료`,i<3?'2026-11-01T01:00:00Z':date+'T01:00:00Z',forwarded+fields([['주문번호',`DEMO-OAT-${i}`],...(i===3?[['주문일시',date+' 10:00:00']]:[])])+table(['상품정보','상품할인적용가 (판매가)','수량','합계','제조사'],[['오트 밀크 1L × 6팩',`${won(i===3?16065:price)} ${won(price)}`,'1개',won(i===3?16065:price),'오트데이']])+fields([['총 결제금액',won(i===3?16065:price)]]));
}
const bundleItems=[['커팅매트, 그린, A3',won(7000),'3',won(21000),'느린마켓'],['수납함, 투명',won(38000),'1',won(38000),'룸앤데이']];
add('bundle-order','[느린마켓] 주문 완료','2026-11-06T10:30:20Z',table(['구매 상세내역','쿠팡가','수량','구매금액','판매자'],bundleItems)+fields([['총 결제금액',won(59000)]]));
const paymentFields=[['구매상점명','느린마켓'],['결제일시','2026년 11월 06일 19시 30분'],['주문번호','DEMO-PG-10'],['승인번호','DEMO-PAY-10'],['결제금액',won(59000)],['주문상품명','커팅매트 그린 A3 포함 총 2건']];
add('bundle-payment','가상결제 - 느린마켓의 결제 내역입니다.','2026-11-06T10:30:01Z',fields(paymentFields));
add('bundle-refund','가상결제 - 느린마켓의 결제부분취소 내역입니다.','2026-11-07T05:15:00Z',fields([...paymentFields,['부분취소금액',won(21000)],['취소가능금액',won(38000)],['취소요청일시','2026년 11월 07일 14시 15분']]));
add('fabric-order','[데일리마켓] 주문 완료','2026-11-09T01:23:25Z',table(['상품명','판매자','수량','단가','상품금액'],[['데일리 코튼 패브릭 원단, 아이보리, 100 x 300 cm','패브릭상점','2',won(8000),won(16000)]])+fields([['총 결제금액',won(16000)]]));
add('fabric-payment','가상결제 - 데일리마켓의 결제 내역입니다.','2026-11-09T01:23:00Z',fields([['구매상점명','데일리마켓'],['결제일시','2026/11/09 10:23'],['승인번호','DEMO-FABRIC-PAY'],['상품명','데일리 코튼 패브릭 원단, 아이'],['상품금액',won(16000)]]));
for(const [i,date,usd,krw] of [[1,'2026-09-01',24,33120],[2,'2026-11-12',26,36400]]){
  const order={'@context':'https://schema.org','@type':'Order',seller:{name:'Field Store'},orderNumber:`DEMO-FIELD-${i}`,orderDate:date,price:usd,priceCurrency:'USD',acceptedOffer:{itemOffered:{name:'Travel tumbler 450ml',brand:{name:'Fieldworks'}},eligibleQuantity:{value:1},price:usd,priceCurrency:'USD'}};
  add(`foreign-${i}`,'[Field Store] Order confirmation',date+'T03:00:00Z',`<script type="application/ld+json">${JSON.stringify(order)}</script>`+fields([['주문번호',order.orderNumber],['주문일',date],['상품명','Travel tumbler 450ml'],['수량','1'],['단가',`USD ${usd}`],['원화 단가',won(krw)],['상품금액',`USD ${usd}`]]));
}
add('conflict','[느린마켓] 주문 완료','2026-11-11T01:00:00Z',fields([['주문번호','DEMO-CHECK']])+table(['상품명','수량','단가','상품금액'],[['티스푼 세트','2',won(8000),won(12000)]]));
for(const cancel of [false,true])add(cancel?'cancel-confirmation':'cancel-order',cancel?'[느린마켓] 주문 취소 완료':'[느린마켓] 주문 완료','2026-11-08T02:00:00Z',fields([['주문번호','DEMO-CANCEL'],['상품명','유기농 코튼 파우치'],['수량','1'],['단가',won(9000)],['총 결제금액',won(9000)]])+`<p>${cancel?'주문이 취소되었습니다.':'주문이 접수되었습니다.'}</p>`);
export function createDemoMessages(parseHtml){
  return demoHtmlMails.map(({html,...message})=>{const parsed=parseHtml(html);return {...message,...parsed,htmlText:parsed.text};});
}
export const demoRates=new Map();
