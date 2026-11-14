import {node} from './ui.js';
const number=n=>new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(n);
const won=n=>n==null?'—':`${number(Math.round(n))}원`;
const original=m=>m?`${m.currency} ${number(m.amount)}`:'—';
const percent=n=>`${number(Math.round(n*10)/10)}%`;
function status(p){return p.verified?['확인 완료','verified']:p.issues.length?['검토 필요','review']:p.order.cancelled?['취소 완료','ok']:p.record.documentKind==='subscription'&&!p.record.product?['정기결제','ok']:['확인됨','ok'];}
function badge(p){const [label,cls]=status(p);return node('span',label,`status ${cls}`);}
function priceView(p,basis,showCalculation=true){
  const wrap=node('div',null,'price-value');wrap.append(node('strong',p?.krw==null?'미확인':won(p.krw)));
  if(p?.original.currency!=='KRW'&&p?.original)wrap.append(node('small',`원가 ${original(p.original)}`));
  if(p?.kind==='환율 추정')wrap.append(node('span','환율 추정','price-tag'));
  else if(p?.kind==='환산 대기')wrap.append(node('span','환산 대기','price-tag warning'));
  else if(p?.kind==='할인율 계산'&&showCalculation)wrap.append(node('span','할인율로 계산','price-tag'));
  else if(p?.kind==='원화 단가로 계산')wrap.append(node('span','원화 단가로 계산','price-tag'));
  if(basis)wrap.append(node('small',basis));return wrap;
}
function discountView(p){
  const d=p.pricing.discount;if(!d)return document.createDocumentFragment();
  const view=priceView(d.price,null,false);view.classList.add('discount-value');if(d.rate!=null)view.querySelector('strong').after(node('span',percent(d.rate),'discount-rate'));
  return view;
}
function changeView(p){
  const wrap=node('div',null,'price-change'),c=p.change;
  if(c){const cls=c.amount>0?'up':c.amount<0?'down':'flat';wrap.classList.add(cls);wrap.append(node('strong',`${c.amount>0?'+':c.amount<0?'−':''}${won(Math.abs(c.amount))}`),node('small',`${c.percent===null?'이전 가격 0원':`${c.percent>0?'+':''}${percent(c.percent)}`} · ${c.from.slice(5).replace('-','.')} 대비`));if(c.estimated)wrap.append(node('small','환율 변화 포함'));}
  else if(p.order.cancelled||!p.eligible||p.pricing.regular?.krw==null)wrap.append(node('span',p.order.cancelled?'취소 · 비교 제외':'비교 보류','muted'));
  return wrap;
}

export {number,won,original,percent,status,badge,priceView,discountView,changeView};
