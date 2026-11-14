// Merchant-independent receipt vocabulary and layout normalization.
const fields={
  product:['상품명','상품정보','제품명','상품이름','주문상품명','구매상세내역','제품','item','itemname','product','productname','description','itemdescription'],
  quantity:['수량','구매수량','주문수량','quantity','qty'],
  unitPrice:['단가','개당가격','판매가','상품가격','가격','쿠팡가','unitprice','price'],
  retailPrice:['소비자가','정가','정상가','권장소비자가','retailprice','listprice','regularprice','msrp'],
  salePrice:['할인가','할인단가','상품할인적용가','discountedprice','saleprice'],
  saleRetail:['할인가(정가)','saleprice(listprice)'],saleUnit:['상품할인적용가(판매가)'],
  discountRate:['할인율','discountrate','discount%'],
  lineTotal:['상품금액','품목금액','구매금액','합계','소계','itemtotal','linetotal','subtotal','amount'],
  orderTotal:['결제금액','총결제금액','총구매금액','주문합계','totalpaid','ordertotal','grandtotal','total'],
  orderId:['주문번호','주문no.','주문no','주문id','ordernumber','orderid','order#'],
  paymentId:['승인번호','결제번호','거래번호','transactionid','paymentid','approvalnumber'],
  refundAmount:['부분취소금액','부분환불금액','취소금액','환불금액','refundamount'],
  remainingAmount:['취소가능금액','잔여결제금액','remainingamount'],
  refundDate:['취소요청일시','취소일시','환불일시','refunddate'],
  date:['주문일','주문일시','주문날짜','결제일','결제일시','거래일시','orderdate','purchasedate','paymentdate','transactiondate','date'],
  merchant:['판매처','판매자','판매업체','상점','상호','상호명','구매상점명','가맹점명','스토어','seller','store','merchant'],
  manufacturer:['제조사','제조업체','브랜드','manufacturer','brand'],
  platform:['구매처','플랫폼','쇼핑몰','platform','marketplace'],
  website:['사이트주소','상점주소','website','storeurl'],
  option:['옵션','선택사항','option','variant'],
  krwUnitPrice:['원화단가','원화소비자가','krwunitprice'],krwSalePrice:['원화할인가','krwsaleprice'],krwLineTotal:['원화상품금액','krwitemtotal'],krwOrderTotal:['원화결제금액','원화결제액','krwordertotal']
};
const canonical={product:'상품명',quantity:'수량',unitPrice:'단가',retailPrice:'소비자가',salePrice:'할인가',discountRate:'할인율',lineTotal:'상품금액',orderTotal:'총 결제금액',orderId:'주문번호',paymentId:'결제번호',date:'주문일',merchant:'판매자',manufacturer:'제조사',platform:'플랫폼',option:'옵션',krwUnitPrice:'원화 단가',krwSalePrice:'원화 할인가',krwLineTotal:'원화 상품금액',krwOrderTotal:'원화 결제금액'};
const clean=s=>String(s||'').normalize('NFKC').trim().replace(/^[·•▪※]\s*/,'');
const labelKey=s=>clean(s).toLowerCase().replace(/[\s:：]+/g,'');
const lookup=new Map(Object.entries(fields).flatMap(([key,aliases])=>aliases.map(a=>[labelKey(a),key])));
export const fieldName=s=>lookup.get(labelKey(s))||null;
const moneyToken='(?:[A-Z]{3}\\s*)?(?:[₩$€£]\\s*)?\\d[\\d,]*(?:\\.\\d{1,2})?\\s*(?:원|円|[A-Z]{3})?';
const amounts=s=>clean(s).match(new RegExp(moneyToken,'g'))||[];
const hasMoney=s=>/(?:\d[\d,.]*\s*(?:원|円|KRW|USD|EUR|JPY)|(?:KRW|USD|EUR|JPY|₩|\$|€|£)\s*\d)/i.test(s);
const boundary=s=>/^(?:[·•]\s*)?(?:결제\s*정보|배송\s*정보|배송시기|받으시는|주문자\s*정보|상품의\s*교환|채무\s*지급|고객이용|shipping|billing|payment\s*information)/i.test(s)||(/상품금액.*배송비|총결제금액.*=/.test(s));
export function mailContext(message){
  const subject=String(message.subject||'').replace(/^(?:\s*(?:fw|fwd|re|전달|답장)\s*:\s*)+/i,'');
  const lines=String(message.htmlText||message.text||'').split(/\r?\n/).slice(0,45).map(clean).filter(Boolean);
  const start=lines.findIndex(s=>/^-*\s*(?:Original Message|Forwarded message|전달된 메시지)/i.test(s));
  const forwarded={};
  if(start>=0&&start<8){
    for(const line of lines.slice(start+1,start+16)){
      const m=line.match(/^(From|Sent|Date|Subject|보낸 사람|보낸 날짜|제목)\s*[:：]\s*(.+)$/i);
      if(m){const key=/^(From|보낸 사람)$/i.test(m[1])?'sender':/^(Subject|제목)$/i.test(m[1])?'subject':'sentAt';if(!forwarded[key])forwarded[key]=m[2];}
      else if(forwarded.subject)break;
    }
  }
  return {subject,forwarded:forwarded.sender&&forwarded.subject?forwarded:null};
}
export function transactionState(subject,text){
  const title=String(subject||'');
  const partial=/(?:부분\s*취소|부분\s*환불|partial\s*(?:refund|cancel))/i.test(title);
  const cancelled=!partial&&/(?:주문|결제).{0,8}(?:취소|환불)|(?:취소|환불).{0,8}(?:완료|내역|안내)|order.{0,12}cancel|refund(?:ed|\s+confirmation)/i.test(title);
  // Only explicit status sentences/fields; policy footers are not transaction events.
  const explicit=String(text||'').split(/\r?\n/).slice(0,80).map(clean).some(s=>/^(?:주문이?\s*취소되었습니다[.!]?|결제가?\s*취소되었습니다[.!]?|환불이?\s*완료되었습니다[.!]?|주문상태\s*[:：]\s*취소|order\s*status\s*:\s*(?:cancelled|refunded))$/i.test(s));
  return {cancelled:cancelled||explicit,partial};
}
export function normalizeDocument(message){
  const original=String(message.htmlText||message.text||''),lines=original.slice(0,500000).split(/\r?\n/).map(clean).filter(Boolean);
  const meta={},items=[],consumed=new Set();let tableCount=0;
  const write=(target,key,value)=>{if(value&&key&&!['website','saleRetail'].includes(key)&&!target[key])target[key]=clean(value);};
  function table(headers,rows){
    if(!headers.includes('product')||!headers.some(h=>['unitPrice','saleRetail','saleUnit','retailPrice','salePrice','lineTotal'].includes(h)))return false;
    let added=0;
    for(const cells of rows){
      if(cells.length<headers.length||boundary(cells[0]||''))break;
      const item={};for(let c=0;c<headers.length;c++){
        const k=headers[c],v=clean(cells[c]);
        if(k==='saleRetail'||k==='saleUnit'){const prices=amounts(v);if(prices.length===2){if(prices[0].replace(/[\s,]/g,'')!==prices[1].replace(/[\s,]/g,''))item.salePrice=prices[0];item[k==='saleRetail'?'retailPrice':'unitPrice']=prices[1];}}
        else write(item,k,v);
      }
      if(!item.product||fieldName(item.product)||/^(?:배송비|할인|총|합계|subtotal|shipping|total)/i.test(item.product))continue;
      if(![item.unitPrice,item.salePrice,item.retailPrice,item.lineTotal].some(hasMoney))continue;
      if(item.quantity&&!/^\d+\s*(?:개|ea|pcs?)?$/i.test(item.quantity))continue;
      items.push(item);added++;
    }
    return added>0;
  }
  // Real HTML tables retain cell boundaries, even when nested spans differ by vendor.
  for(const rows of message.tables||[]){for(let h=0;h<rows.length;h++){const headers=rows[h].map(fieldName);if(headers.filter(Boolean).length>=3&&table(headers,rows.slice(h+1))){tableCount++;break;}}}
  // Flattened HTML and plain-text alternatives: contiguous semantic column headers.
  if(!items.length)for(let i=0;i<lines.length;i++){
    if(fieldName(lines[i])!=='product')continue;
    const headers=[];let j=i;while(j<lines.length&&fieldName(lines[j])&&headers.length<10){headers.push(fieldName(lines[j]));j++;}
    if(headers.length<3||!headers.some(h=>['unitPrice','saleRetail','saleUnit','retailPrice','salePrice','lineTotal'].includes(h)))continue;
    const data=[];let end=j;
    while(end+headers.length<=lines.length&&!boundary(lines[end])){
      const cells=lines.slice(end,end+headers.length);if(cells.slice(1).some(boundary))break;
      if(!headers.some((h,n)=>['unitPrice','saleRetail','saleUnit','retailPrice','salePrice','lineTotal'].includes(h)&&hasMoney(cells[n])))break;
      data.push(cells);end+=headers.length;
    }
    if(table(headers,data)){tableCount++;for(let c=i;c<end;c++)consumed.add(c);i=end-1;}
  }
  // Isolated labels followed by values, with or without punctuation.
  let current=null;
  for(let i=0;i<lines.length;i++){
    if(consumed.has(i))continue;const line=lines[i];let key,value;
    // HTML table headers are not standalone metadata. In particular, the last
    // "seller" column must not consume the first product as the platform name.
    if(tableCount&&fieldName(line)&&(fieldName(lines[i-1])||fieldName(lines[i+1])))continue;
    const colon=line.match(/^(.{1,35}?)\s*[:：]\s*(.+)$/);
    if(colon&&fieldName(colon[1])){key=fieldName(colon[1]);value=colon[2];}
    else if(fieldName(line)&&i+1<lines.length&&!fieldName(lines[i+1])&&!consumed.has(i+1)&&!boundary(lines[i+1])){key=fieldName(line);value=lines[++i];}
    if(!key||!value)continue;
    if(key==='website'){meta.website=value;continue;}
    if(key==='product'){
      if(tableCount)continue;current={};items.push(current);
    }
    if(['orderId','paymentId','date','orderTotal','krwOrderTotal','platform','refundAmount','remainingAmount','refundDate'].includes(key))write(meta,key,value);
    else if(key==='merchant'&&!tableCount&&/상호|구매상점|가맹점/.test(line))write(meta,key,value);
    else if(current)write(current,key,value);else if(['merchant','manufacturer'].includes(key))write(meta,key,value);
  }
  // A store named by the sender/subject is context, not an inferred manufacturer.
  const context=mailContext(message),subject=context.subject;
  const bracket=subject.match(/^\[([^\]]{1,40})\]/)?.[1];
  const storeFromReceipt=subject.match(/(?:,\s*| - )(.{1,50}?)(?:에서|의)\s*(?:\[.*?\])?결제/)?.[1];
  const contextStore=meta.merchant||bracket||storeFromReceipt;
  if(!meta.platform&&contextStore)meta.platform=contextStore;
  if(!meta.platform&&meta.website)meta.platform=meta.website.replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0];
  let merchantFromContext=false;
  if(!meta.merchant&&contextStore){meta.merchant=contextStore;merchantFromContext=true;}
  const kind=/(?:멤버십|멤버스|월회비|정기결제|subscription|membership)/i.test(subject)?'subscription':/(?:결제하신|결제\s*내역|결제부분취소|receipt|payment\s*(?:confirmation|receipt))/i.test(subject)?'payment':'order';
  if(!meta.orderId&&message.orderIds?.length===1)meta.orderId=message.orderIds[0];
  const state=transactionState(subject,original);
  const canonicalLines=Object.entries(meta).filter(([k])=>canonical[k]).map(([k,v])=>`${canonical[k]}: ${v}`);
  for(const item of items){canonicalLines.push(`상품명: ${item.product||''}`);for(const [k,v] of Object.entries(item))if(k!=='product'&&canonical[k])canonicalLines.push(`${canonical[k]}: ${v}`);}
  return {text:canonicalLines.join('\n'),meta,items,kind,...state,forwarded:context.forwarded,merchantFromContext,encodingDamaged:original.includes('\uFFFD'),tableCount};
}
