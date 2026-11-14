// Price interpretation shared by validation and the product catalog.
const divide=(price,n)=>price?{amount:price.amount/(n||1),currency:price.currency}:null;
export const isBundleName=name=>/(?:포함\s*총|외)\s*\d+\s*(?:건|종)|\band\s+\d+\s+more\b/i.test(name||'');
export function resolvePrices(row){
  const singleItem=row.messageItemCount===1&&!!row.product&&!isBundleName(row.product);
  const explicit=row.retailPrice||row.unitPrice||row.krwUnitPrice;
  let regular=explicit,field=row.retailPrice?'retailPrice':row.unitPrice?'unitPrice':row.krwUnitPrice?'krwUnitPrice':null;
  if(!regular)for(const name of ['salePrice','krwSalePrice','lineTotal','krwLineTotal',...(singleItem?['orderTotal','krwOrderTotal']:[])])if(row[name]){regular=/Total$/.test(name)?divide(row[name],row.quantity):row[name];field=name;break;}
  const fromTotal=/Total$/.test(field||''),comparisonBasis=fromTotal&&!row.quantity?'purchase':'unit';
  const regularBasis=field==='retailPrice'?'소비자가 명시':['unitPrice','krwUnitPrice'].includes(field)?'단가를 소비자가로 간주':['salePrice','krwSalePrice'].includes(field)?'할인가를 소비자가로 간주':regular?`${/order/i.test(field)?'주문 결제액':'상품 결제액'}${row.quantity?' ÷ 수량':' · 구매 단위'}을 소비자가로 간주`:'소비자가 미확인';
  const discountEvidence=row.salePrice!=null||row.krwSalePrice!=null||row.discountRate!=null;
  // A fallback payment already includes discounts: never discount it a second time.
  const sale=row.salePrice||row.krwSalePrice||(discountEvidence&&regular?(explicit?{...regular,amount:regular.amount*(1-row.discountRate/100)}:regular):null);
  const rate=row.discountRate??(explicit&&sale&&regular.amount>0&&sale.currency===regular.currency?(1-sale.amount/regular.amount)*100:null);
  let regularKrw=row.krwUnitPrice;
  if(!explicit)regularKrw=['salePrice','krwSalePrice'].includes(field)?row.krwSalePrice||divide(row.krwLineTotal,row.quantity):/order/i.test(field||'')?divide(row.krwOrderTotal,row.quantity):divide(row.krwLineTotal,row.quantity);
  else if(!discountEvidence&&!regularKrw)regularKrw=divide(row.krwLineTotal,row.quantity);
  let saleKrw=row.krwSalePrice||(discountEvidence?divide(row.krwLineTotal,row.quantity):null);
  if(!saleKrw&&explicit&&row.krwUnitPrice&&row.discountRate!=null)saleKrw={amount:row.krwUnitPrice.amount*(1-row.discountRate/100),currency:'KRW'};
  if(!saleKrw&&!explicit&&discountEvidence)saleKrw=regularKrw;
  return {regular,regularBasis,comparisonBasis,field,explicit:!!explicit,sale,rate,regularKrw,saleKrw,discountEvidence};
}
