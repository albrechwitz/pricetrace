import test from 'node:test';
import assert from 'node:assert/strict';
import {getHistoricalRate,loadRates} from '../dist/rates.js';
import {extractMessages} from '../dist/core.js';
const foreign=(id,date='2025-01-02')=>({id,text:`판매자: Store\n주문번호: ${id}\n주문일: ${date}\n상품명: Cup\n수량: 1\n단가: USD 10`});
test('historical FX request sends date/currency only and accepts preceding publication day',async()=>{
  let seen;const rate=await getHistoricalRate('2025-01-02','USD',undefined,async(url,options)=>{seen={url,options};return {ok:true,json:async()=>({date:'2025-01-01',base:'USD',quote:'KRW',rate:1470})};});assert.equal(rate.rate,1470);assert.equal(rate.date,'2025-01-01');assert.equal(seen.url,'https://api.frankfurter.dev/v2/rate/usd/krw?date=2025-01-02');assert.equal(seen.options.credentials,'omit');assert.equal(seen.options.headers,undefined);
});
test('invalid, future and incorrect currency responses fail closed',async()=>{
  for(const data of [{rate:0,date:'2025-01-02',base:'USD',quote:'KRW'},{rate:1470,date:'2025-01-03',base:'USD',quote:'KRW'},{rate:1470,date:'2025-01-02',base:'EUR',quote:'KRW'}])await assert.rejects(getHistoricalRate('2025-01-02','USD',undefined,async()=>({ok:true,json:async()=>data})),/확인/);
});
test('rate loading deduplicates date/currency requests and reports failed rates',async()=>{
  let calls=0;const result=await loadRates(extractMessages([foreign('a'),foreign('b'),foreign('c','2025-01-03')]),undefined,()=>{},async(date)=>{calls++;if(date==='2025-01-03')throw new Error('unavailable');return {rate:1470,date};});assert.equal(calls,2);assert.equal(result.rates.size,1);assert.equal(result.failures.length,1);
});
test('native or explicit KRW unit prices need no FX request and abort is honored',async()=>{
  const a=foreign('a');a.text+='\n원화 단가: 14,000원';let calls=0;await loadRates(extractMessages([a]),undefined,()=>{},async()=>{calls++;});assert.equal(calls,0);
  const controller=new AbortController();controller.abort();await assert.rejects(loadRates(extractMessages([foreign('b')]),controller.signal),{name:'AbortError'});
});
