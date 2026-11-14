import {$,node} from './ui.js';
import {won,badge,priceView,discountView,changeView} from './price-view.js';
import {loadSnapshot} from './storage.js';
import {htmlContent} from './mail-html.js';
import {createDemoMessages,demoHtmlMails,demoRates} from './demo-mails.js';
import {trackingTemplate} from './tracking-template.js';

export function installTracking(context){
  const {state,render,notify,replaceData,showPage,waitForSave,restoreData}=context;
  context.registerPage('tracking',{navId:'nav-orders',label:'가격 추적',icon:'▤',order:2,markup:trackingTemplate});
  $('home-content').innerHTML="<section class=\"workflow-card\"><h2>구매 가격을 살펴보세요</h2><p>가상 주문 메일로 같은 상품의 가격 변화와 구매 이력을 확인할 수 있어요.</p><div class=\"workflow-actions\"><button class=\"button\" id=\"sample-button\">샘플로 둘러보기</button><button class=\"text-button\" id=\"return-records\" hidden>내 기록으로 돌아가기</button><button class=\"button\" data-page=\"tracking\">가격 추적으로 이동</button></div><div id=\"workspace-notice\" class=\"notice\" role=\"status\" aria-live=\"polite\"></div></section>";
function trendChart(product){
  const points=product.purchases.filter(p=>p.eligible&&p.pricing.regular?.krw!=null&&p.pricing.comparisonBasis===product.latest.pricing.comparisonBasis);if(points.length<2)return null;
  const svgNS='http://www.w3.org/2000/svg',svg=document.createElementNS(svgNS,'svg');svg.setAttribute('viewBox','0 0 340 88');svg.setAttribute('class','trend-chart');svg.setAttribute('role','img');
  const title=document.createElementNS(svgNS,'title');title.textContent=`소비자가 이력: ${points.map(p=>`${p.order.date} ${won(p.pricing.regular.krw)}`).join(', ')}`;svg.append(title);
  const vals=points.map(p=>p.pricing.regular.krw),times=points.map(p=>Date.parse(p.order.date)),min=Math.min(...vals),max=Math.max(...vals),first=times[0],last=times.at(-1);
  const coords=points.map((p,i)=>[12+(last===first?i/(points.length-1):(times[i]-first)/(last-first))*316,64-(max===min?.5:(vals[i]-min)/(max-min))*48]);
  const line=document.createElementNS(svgNS,'polyline');line.setAttribute('points',coords.map(c=>c.join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#547b55');line.setAttribute('stroke-width','2');svg.append(line);
  for(const [i,[x,y]] of coords.entries()){const dot=document.createElementNS(svgNS,'circle');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','3.5');dot.setAttribute('fill','#547b55');const tip=document.createElementNS(svgNS,'title');tip.textContent=`${points[i].order.date} · ${won(vals[i])}`;dot.append(tip);svg.append(dot);}
  return svg;
}
function historyRow(product,index){
  const tr=node('tr',null,'history-row'),td=node('td');td.colSpan=6;
  const box=node('section',null,'purchase-history');box.id=`history-${index}`;box.setAttribute('aria-label',`${product.identity.name} 구매 이력`);
  const top=node('div',null,'history-heading'),description=node('div');description.append(node('strong','구매할 때마다, 가격의 흐름'),node('p','상품명으로 묶고 옵션·용량·구성을 구분해 비교해요.'));
  if(product.identity.sellers.length>1)description.append(node('small',`판매자 ${product.identity.sellers.join(' · ')}`));
  top.append(description);const chart=trendChart(product);if(chart)top.append(chart);box.append(top);
  const table=node('table',null,'history-table'),thead=node('thead'),head=node('tr');for(const title of ['구매일 / 판매자','소비자가','할인가 / 할인율','변화량','원문'])head.append(node('th',title));thead.append(head);table.append(thead);
  const body=node('tbody');
  for(const p of [...product.purchases].reverse()){
    const r=node('tr'),order=node('td'),normal=node('td'),sale=node('td'),change=node('td'),source=node('td');
    order.append(node('strong',p.order.date?.replaceAll('-','.')||'날짜 미확인'),node('small',`${p.order.seller||product.identity.manufacturer||'판매자 미확인'}${p.order.quantity?` · ${p.order.quantity}개`:''}`));if(p.order.cancelled)order.append(node('span','취소 내역','price-tag warning'));
    normal.append(priceView(p.pricing.regular,p.pricing.regularBasis));sale.append(discountView(p));change.append(changeView(p));
    if(context.openPurchase){const button=node('button',`원문 ${p.source.messageIds.length}건 ↗`,'text-button');button.setAttribute('aria-label',`${product.identity.name} ${p.order.date||''} 원문 확인`);button.addEventListener('click',()=>context.openPurchase(p.id));source.append(button);}else source.append(node('span',`원문 ${p.source.messageIds.length}건`));if(p.issues.length||p.verified)source.append(badge(p));
    r.append(order,normal,sale,change,source);body.append(r);
  }
  table.append(body);box.append(table);td.append(box);tr.append(td);return tr;
}

function renderTracking(){
  const {products,summary}=state.catalog;
  for(const [id,value,unit] of [['metric-orders',summary.orders,'회'],['metric-items',summary.products,'개'],['metric-review',summary.review,'건']])$(id).replaceChildren(document.createTextNode(value),node('small',unit));
  $('review-count').textContent=summary.review;$('nav-count').textContent=summary.products;$('record-count').textContent=products.length;
  $('session-label').textContent=state.mode==='sample'?'SAMPLE SESSION':state.mode==='gmail'?'GMAIL SESSION':'NEW SESSION';
  $('dataset-note').textContent=state.mode==='sample'?`가상 HTML 메일 ${demoHtmlMails.length}건 · 실제 메일과 같은 추출·연결 규칙을 적용했어요.`:state.mode==='gmail'?'상품을 펼쳐 가격 이력과 원문을 확인하세요. 기록은 이 브라우저에 저장됩니다.':'Gmail을 연결하거나 샘플 데이터를 불러오세요.';
  $('sample-explainer').hidden=state.mode!=='sample';for(const id of ['return-records','return-records-tracking'])if($(id))$(id).hidden=state.mode!=='sample'||!state.account;
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.filter===state.filter)));
  const visible=products.filter(p=>(state.filter==='all'||state.filter==='review'&&p.reviewCount||state.filter==='repeat'&&p.purchaseCount>1)&&`${p.identity.name} ${p.identity.manufacturer||''} ${p.identity.sellers.join(' ')}`.toLowerCase().includes(state.search));
  const body=$('records-body');body.replaceChildren();
  for(const [i,p] of visible.entries()){
    const tr=node('tr',null,'product-row'),identity=node('td'),wrap=node('div',null,'product-cell'),text=node('div',null,'product-text');
    text.append(node('strong',p.identity.name),node('small',`${p.identity.manufacturer?`제조사 ${p.identity.manufacturer}`:p.identity.sellers.join(' · ')||'미확인'}${p.identity.option?' · '+p.identity.option:''}`));
    if(p.reviewCount)text.append(node('span',`검토 ${p.reviewCount}건`,'status review'));if(!p.purchaseCount)text.append(node('small','취소 기록만 있어요'));
    wrap.append(node('span','▧','product-icon'),text);identity.append(wrap);
    const regular=node('td'),discount=node('td'),change=node('td'),latestDate=node('td',null,'latest-purchase-date'),action=node('td');
    regular.append(priceView(p.latest.pricing.regular,!p.latest.pricing.regular?'소비자가 미확인':p.latest.pricing.regularBasis==='소비자가 명시'?'소비자가 명시':'소비자가 간주'));discount.append(discountView(p.latest));change.append(changeView(p.latest));
    latestDate.append(node('span',p.latest.order.date?.replaceAll('-','.')||'날짜 미확인'));
    const button=node('button',`${p.purchaseCount}회 ${state.expanded.has(p.id)?'⌃':'⌄'}`,'history-toggle');button.setAttribute('aria-expanded',String(state.expanded.has(p.id)));button.setAttribute('aria-controls',`history-${i}`);button.setAttribute('aria-label',`${p.identity.name} 구매 이력 ${state.expanded.has(p.id)?'접기':'펼치기'}`);button.addEventListener('click',()=>{state.expanded.has(p.id)?state.expanded.delete(p.id):state.expanded.add(p.id);render();$('records-body').querySelectorAll('.history-toggle')[i]?.focus({preventScroll:true});});action.append(button);
    tr.append(identity,regular,discount,change,latestDate,action);body.append(tr);if(state.expanded.has(p.id))body.append(historyRow(p,i));
  }
  $('empty').hidden=visible.length>0;$('visible-count').textContent=`${visible.length}개 상품 표시 / 미확인·취소 포함 ${products.length}개`;
}

function sample(){state.reviews={};state.merges={};replaceData(createDemoMessages(htmlContent),'sample',new Map(demoRates));notify('샘플 모드 · 서로 다른 HTML 주문서와 영수증을 정리한 결과입니다. 실제 저장 기록은 유지됩니다.');}


  context.sample=sample;
  context.onRender(renderTracking);
  context.onBusy(busy=>{for(const id of ['sample-button','return-records','return-records-tracking'])if($(id))$(id).disabled=busy;});
  context.on('sample-button','click',()=>{sample();showPage('tracking');});
  for(const id of ['return-records','return-records-tracking'])context.on(id,'click',async()=>{await waitForSave();const saved=await loadSnapshot(state.account).catch(()=>null);if(saved){restoreData(saved);notify('저장된 내 구매 기록으로 돌아왔어요.');showPage('tracking');}else notify('이 브라우저에 저장된 구매 기록이 없어요.');});
  document.querySelectorAll('[data-sample-search]').forEach(button=>button.addEventListener('click',()=>{state.filter='all';state.search=button.dataset.sampleSearch.toLowerCase();$('search-input').value=state.search;render();document.querySelector('.records').scrollIntoView({behavior:'smooth'});}));
  context.on('search-input','input',event=>{state.search=event.target.value.toLowerCase().trim();render();});
  document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{state.filter=button.dataset.filter;render();}));
}
