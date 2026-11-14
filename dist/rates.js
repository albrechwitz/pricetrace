import {priceRecord} from './catalog.js';

export async function getHistoricalRate(date,currency,signal,fetchImpl=fetch){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^[A-Z]{3}$/.test(currency))throw new Error('환율 조회에 필요한 날짜·통화가 없어요.');
  const response=await fetchImpl(`https://api.frankfurter.dev/v2/rate/${currency.toLowerCase()}/krw?date=${encodeURIComponent(date)}`,{signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(10000)]),credentials:'omit',referrerPolicy:'no-referrer'});
  if(!response.ok)throw new Error(`환율 조회 실패 (${response.status})`);
  const data=await response.json();
  if(!Number.isFinite(data.rate)||data.rate<=0||!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||data.date>date||String(data.base).toUpperCase()!==currency||String(data.quote).toUpperCase()!=='KRW')throw new Error('환율 응답을 확인할 수 없어요.');
  return {rate:data.rate,date:data.date,source:'Frankfurter 기준환율'};
}
export async function loadRates(rows,signal,onProgress=()=>{},lookup=getHistoricalRate){
  const wanted=new Set();
  for(const row of rows){const prices=priceRecord(row);for(const p of [prices.regular,prices.discount?.price,prices.lineTotal,prices.orderTotal])if(p?.original.currency!=='KRW'&&p?.krw===null&&row.date)wanted.add(`${row.date}|${p.original.currency}`);}
  const rates=new Map(),failures=[];const queue=[...wanted];let completed=0;
  await Promise.all(Array.from({length:Math.min(4,queue.length)},async()=>{
    while(queue.length){signal?.throwIfAborted();const key=queue.shift();const [date,currency]=key.split('|');try{rates.set(key,await lookup(date,currency,signal));}catch(error){if(signal?.aborted)throw error;failures.push({key,error:error.message});}onProgress(++completed,wanted.size);}
  }));
  return {rates,failures};
}
