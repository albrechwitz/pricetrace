// All messages, prices, sellers and exchange rates below are fictional demo data.
export const samples=[];
function add({name,seller='느린상점',maker='',date,price,extra='',quantity=1,platform='느린마켓',option='',id}){
  const n=samples.length+1;
  const text=`플랫폼: ${platform}\n판매자: ${seller}\n${maker?`제조사: ${maker}\n`:''}주문번호: ${id||`DEMO-${n}`}\n주문일: ${date}\n상품명: ${name}\n${option?`옵션: ${option}\n`:''}수량: ${quantity}\n${price!=null?`단가: ${price}원\n`:''}${extra}`;
  const m={id:`sample-${n}`,sender:`orders@${platform==='느린마켓'?'slow':'everyday'}.example`,subject:`[${seller}] 주문 완료`,text};samples.push(m);return m;
}
for(const [date,price] of [['2026-08-12',16800],['2026-09-20',17400],['2026-11-10',18900]])add({name:'오트 밀크 1L × 6팩',maker:'오트데이',date,price,extra:date==='2026-11-10'?'할인가: 16,065원\n할인율: 15%\n상품금액: 16,065원':`상품금액: ${price}원`});
for(const [date,price] of [['2026-08-22',15900],['2026-10-05',14500],['2026-11-12',12900]])add({name:'드립백 커피 12개입',maker:'로스트랩',seller:date==='2026-11-12'?'데일리서플라이':'느린상점',platform:date==='2026-11-12'?'데일리마켓':'느린마켓',date,price,extra:`상품금액: ${price}원`});
for(const date of ['2026-09-01','2026-11-09'])add({name:'무향 핸드워시 500ml',maker:'클린데이',date,price:9900,extra:'할인율: 10%\n상품금액: 8,910원'});
for(const [date,price] of [['2026-09-15',18000],['2026-11-08',20000]])add({name:'세라믹 머그 320ml',maker:'무드웨어',date,extra:`소비자가: ${price}원\n할인가: ${price-2000}원\n상품금액: ${price-2000}원`});
for(const [date,price] of [['2026-08-01',6400],['2026-11-11',6900]])add({name:'재생지 노트 A5',date,price,quantity:2,extra:`상품금액: ${price*2}원`});
add({name:'Weekly planner A5',maker:'Paperroom',seller:'Everyday Supply',platform:'Everyday',date:'2026-09-04',extra:'Unit price: USD 17.00\nItem total: USD 17.00'});
add({name:'Weekly planner A5',maker:'Paperroom',seller:'Everyday Supply',platform:'Everyday',date:'2026-11-13',extra:'Unit price: USD 18.00\nSale price: USD 16.20\nDiscount rate: 10%\nItem total: USD 16.20'});
add({name:'Travel tumbler 450ml',maker:'Fieldworks',seller:'Field Store',platform:'Field Store',date:'2026-08-18',extra:'Unit price: USD 24.00\nKRW unit price: 33,120원\nItem total: USD 24.00'});
add({name:'Travel tumbler 450ml',maker:'Fieldworks',seller:'Field Store',platform:'Field Store',date:'2026-11-07',extra:'Unit price: USD 26.00\nKRW unit price: 36,400원\nItem total: USD 26.00'});
// Same display name, different manufacturers: deliberately separate products.
add({name:'유리 밀폐용기 800ml',maker:'글라스룸',date:'2026-11-06',price:14900});
add({name:'유리 밀폐용기 800ml',maker:'키친랩',date:'2026-11-06',price:11900});
// Same order arrives twice. One purchase with both originals retained.
samples.push({...samples[5],id:'sample-19',subject:'[데일리서플라이] 주문 결제 영수증'});
add({name:'데스크 매트',seller:'룸앤데이',date:'2026-11-12',extra:'총 결제금액: 25,000원'});
add({name:'티스푼 세트',date:'2026-11-10',price:8000,quantity:2,extra:'상품금액: 12,000원'});
const cancelled=add({name:'유기농 코튼 파우치',date:'2026-11-03',price:9000,extra:'주문이 취소되었습니다.'});cancelled.subject='주문 취소 안내';
add({name:'리넨 키친 타월',date:'2026-11-02',extra:'할인가: 8,500원\n상품금액: 8,500원'});
samples.push({id:'sample-24',sender:'receipt@unknown.example',subject:'결제 확인',text:'구매해주셔서 감사합니다.\n이미지 영수증이 첨부되어 있습니다.'});
export const sampleRates=new Map([
  ['2026-09-04|USD',{rate:1380,date:'2026-09-04',source:'샘플용 가상 환율'}],
  ['2026-11-13|USD',{rate:1400,date:'2026-11-13',source:'샘플용 가상 환율'}]
]);
