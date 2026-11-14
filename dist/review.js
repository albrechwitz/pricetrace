import {$,node} from './ui.js';
import {number,won,original,badge,priceView,discountView,changeView} from './price-view.js';
import {reviewTemplate} from './review-template.js';

export function installReview(context){
  const {state,render,notify,persistData,reviewKey}=context;
  document.body.insertAdjacentHTML('beforeend',reviewTemplate);
function selectedPurchase(){return state.catalog.products.flatMap(p=>p.purchases).find(p=>p.id===state.selected);}
function showRaw(messageId){const msg=state.messages.find(m=>m.id===messageId);$('detail-raw').textContent=msg?.htmlText||msg?.text||'(텍스트 본문이 없어요. 구조화 데이터 또는 원본 메일을 확인해주세요.)';$('structured-wrapper').hidden=!msg?.structured?.length;$('detail-json').textContent=msg?.structured?.length?JSON.stringify(msg.structured,null,2):'';}
function showDetail(id){
  state.selected=id;const p=selectedPurchase();if(!p)return;const r=p.record;
  $('detail-title').textContent=r.product||'상품 정보를 확인해주세요';$('detail-subtitle').textContent=`${r.manufacturer||r.merchant||'식별 정보 미확인'} · ${p.order.date||'날짜 미확인'}`;
  $('detail-status').replaceChildren(badge(p));if(p.issues.length){const ul=node('ul',null,'issue-list');p.issues.forEach(issue=>ul.append(node('li',issue)));$('detail-status').append(ul);}
  renderDuplicateActions(p);
  const fields=$('detail-fields');fields.replaceChildren();
  const field=(label,value,evidence)=>{const item=node('div',null,'detail-field'),right=node('div');if(value instanceof Node)right.append(value);else right.append(node('strong',value??'—'));if(evidence)right.append(node('span',evidence,'evidence'));item.append(node('span',label),right);fields.append(item);};
  fields.append(node('h3','01 · 상품의 가격'));
  field('소비자가',priceView(p.pricing.regular,p.pricing.regularBasis),r.evidence.retailPrice||r.evidence.unitPrice||r.evidence.salePrice||r.evidence.lineTotal||r.evidence.orderTotal);
  field('할인 내역',discountView(p),[r.evidence.salePrice,r.evidence.discountRate].filter(Boolean).join('\n'));
  field('변화량',changeView(p));if(p.change?.original&&p.change.original.currency!=='KRW')field('원가 변화',`${p.change.original.amount>0?'+':''}${original(p.change.original)}`);
  for(const [label,price] of [['소비자가 환산',p.pricing.regular],['할인가 환산',p.pricing.discount?.price]])if(price?.original.currency!=='KRW'&&price?.original){field(label,price.kind,price.rate?`${price.rateSource} · ${price.rateDate}\n1 ${price.original.currency} = ${number(price.rate)}원`:[r.evidence.krwUnitPrice,r.evidence.krwSalePrice,r.evidence.krwLineTotal].filter(Boolean).join('\n'));}
  fields.append(node('h3','02 · 구매 내역과 근거'));
  for(const [key,label,value] of [['merchant','판매자',r.merchant],['manufacturer','제조사',r.manufacturer],['platform','플랫폼',p.order.platform],['option','옵션',r.option],['orderId',r.orderId?'주문번호':r.paymentId?'결제/승인번호':'주문번호',p.order.id],['date','구매일 / 수신일',p.order.date],['quantity','수량',p.order.quantity],['lineTotal','상품 합계',priceView(p.pricing.lineTotal)],['orderTotal','주문 결제액',priceView(p.pricing.orderTotal)]])field(label,value,r.evidence[key]);
  fields.append(node('p',`구매일이 없으면 전달 메일의 원래 발송일, 그 정보도 없으면 수신일을 사용합니다. 발송이 늦어진 경우 실제 구매일과 다를 수 있어요.${p.order.dateBasis==='메일 수신일'?' 이 기록은 수신일 기준입니다.':p.order.dateBasis==='전달 원문 발송일'?' 이 기록은 전달 원문의 발송일 기준입니다.':''}`,'detail-note'));
  for(const link of p.orderLinks)for(const a of link.adjustments){
    field('주문의 부분 취소액',a.amount?.currency==='KRW'?won(a.amount.amount):original(a.amount),a.date?`취소일: ${a.date}`:null);
    field('취소 후 남은 결제액',a.remaining?.currency==='KRW'?won(a.remaining.amount):original(a.remaining),a.balanced?'원문 결제액 − 부분 취소액과 일치':null);
    field('취소 상품 추정',a.inferredProduct||'확정할 수 없음',a.inferredProduct?'상품 합계와 취소 금액이 일치합니다. 취소 상품명이 직접 명시된 것은 아닙니다.':null);
    fields.append(node('p','부분 취소액은 주문 전체의 조정 내역입니다. 상품의 단가나 할인율을 다시 계산하지 않으며, 추정 대상 상품의 가격 비교는 보류합니다.','detail-note'));
  }
  if(p.pricing.comparisonBasis==='purchase')fields.append(node('p','수량이 없는 결제액은 구매 단위 가격으로 표시하며, 수량이 확인된 개당 가격과 섞어 비교하지 않습니다.','detail-note'));
  if(p.pricing.regularBasis.startsWith('주문 결제액'))fields.append(node('p','단일 상품의 주문 결제액을 소비자가로 사용했습니다. 배송비 등 부대비용이 포함될 수 있습니다.','detail-note'));
  $('verify-input').checked=p.verified;
  const sourceSelect=$('source-select');sourceSelect.replaceChildren();for(const messageId of p.source.messageIds){const msg=state.messages.find(m=>m.id===messageId),option=node('option',msg?.subject||messageId);option.value=messageId;sourceSelect.append(option);}showRaw(sourceSelect.value);
  if(!$('detail-dialog').open)$('detail-dialog').showModal();
}

function renderDuplicateActions(p){
  const box=$('duplicate-actions');box.replaceChildren();
  if(p.source.messageIds.length>1)box.append(node('p',`연결된 원문 ${p.source.messageIds.length}건을 함께 확인할 수 있어요.`));
  for(const link of p.orderLinks){
    box.append(node('p',link.reason+' 개별 상품 가격은 주문서에서 가져옵니다.'));
    const undo=node('button','주문과 영수증 연결 해제','text-button');undo.addEventListener('click',()=>{for(const r of link.receiptRows)state.merges[r.id]='separate';render();$('detail-dialog').close();persistData();notify('주문과 영수증을 분리했어요. 원문은 모두 유지되며 다시 자동 연결하지 않습니다.');});box.append(undo);
  }
  for(const candidate of p.duplicateCandidates){
    const card=node('div',null,'duplicate-card');card.append(node('strong',candidate.product),node('small',`${candidate.date} · ${candidate.merchant||'판매자 미확인'} · ${original(candidate.amount)}`),node('p',candidate.reason+' — 같은 구매인지 원문을 비교해주세요.'));
    const inspect=node('button','이 메일 원문 보기','text-button');inspect.addEventListener('click',()=>showDetail(candidate.id));
    const merge=node('button','같은 구매로 합치기','button small');merge.addEventListener('click',()=>{const other=state.rows.find(r=>r.id===candidate.id);const quality=r=>(r.documentKind==='order'?10:0)+(r.orderId?4:0)+(r.quantity?3:0)+(r.unitPrice||r.retailPrice?2:0);if(other&&quality(p.record)>=quality(other))state.merges[candidate.id]=p.id;else for(const source of p.source.rows)state.merges[source.id]=candidate.id;render();$('detail-dialog').close();persistData();notify('두 메일을 하나의 구매로 묶었어요. 원문은 모두 유지됩니다.');});card.append(inspect,merge);box.append(card);
  }
  for(const sourceId of p.manualMerges){const undo=node('button','직접 합친 기록 분리하기','text-button');undo.addEventListener('click',()=>{delete state.merges[sourceId];render();$('detail-dialog').close();persistData();notify('직접 합친 기록을 다시 분리했어요.');});box.append(undo);}
  if(p.autoMerges.length)box.append(node('p','구매처·날짜·상품·옵션·금액이 일치하고, 주문서와 결제 영수증이 일대일로 연결되어 자동 통합했어요.'));
  for(const sourceId of p.autoMerges){const undo=node('button','자동 통합한 기록 분리하기','text-button');undo.addEventListener('click',()=>{state.merges[sourceId]='separate';render();$('detail-dialog').close();persistData();notify('기록을 분리했어요. 이 메일은 다시 자동 통합하지 않습니다.');});box.append(undo);}
}

  context.openPurchase=showDetail;
  context.on('verify-input','change',event=>{const purchase=selectedPurchase();if(purchase){for(const source of purchase.source.rows){const row=state.rows.find(row=>row.id===source.id);if(row){row.verified=event.target.checked;state.reviews[reviewKey(row)]=event.target.checked;}}if(purchase.reviewContextKey)state.reviews[purchase.reviewContextKey]=event.target.checked;render();showDetail(state.selected);persistData();}});
  context.on('source-select','change',event=>showRaw(event.target.value));
}
