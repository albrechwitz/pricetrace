import test from 'node:test';
import assert from 'node:assert/strict';
import {buildQuery,decodeBody,normalizeGmailMessage,gmailRequest,fetchOrders,authorize} from '../dist/gmail.js';
const encode=s=>Buffer.from(s).toString('base64url');
test('every explicit authorization opens account selection without a saved-account hint',()=>{
  const prior=globalThis.google,configs=[],requests=[],results=[],scope='https://www.googleapis.com/auth/gmail.readonly';
  globalThis.google={accounts:{oauth2:{initTokenClient(config){configs.push(config);return {requestAccessToken(options){requests.push(options);}};},hasGrantedAllScopes(response,requested){assert.equal(requested,scope);return true;}}}};
  try{
    authorize('client',(...args)=>results.push(args));
    // An older caller supplying the former third argument cannot bypass selection.
    authorize('client',(...args)=>results.push(args),'saved@example.invalid');
    assert.deepEqual(requests,[{prompt:'select_account'},{prompt:'select_account'}]);
    for(const config of configs){assert.equal(config.scope,scope);assert.equal(config.include_granted_scopes,false);assert.ok(!Object.hasOwn(config,'hint')&&!Object.hasOwn(config,'login_hint'));}
    configs[1].callback({access_token:'SYNTHETIC_TOKEN',expires_in:'3600'});
    assert.deepEqual(results,[[null,{token:'SYNTHETIC_TOKEN',expiresIn:3600}]]);
  }finally{if(prior===undefined)delete globalThis.google;else globalThis.google=prior;}
});

test('account chooser cancellation, denial and missing readonly scope never report authorization success',()=>{
  const prior=globalThis.google,results=[];let config;
  globalThis.google={accounts:{oauth2:{initTokenClient(value){config=value;return {requestAccessToken(){}};},hasGrantedAllScopes(){return false;}}}};
  try{
    authorize('client',(...args)=>results.push(args));
    config.error_callback({type:'popup_closed'});
    config.callback({error:'access_denied'});
    config.callback({access_token:'SYNTHETIC_TOKEN',expires_in:3600});
    assert.equal(results.length,3);assert.ok(results.every(args=>args.length===1&&args[0] instanceof Error));
    assert.match(results[0][0].message,/연결 창을 닫았어요/);assert.match(results[1][0].message,/허용되지/);assert.match(results[2][0].message,/읽기 권한/);
  }finally{if(prior===undefined)delete globalThis.google;else globalThis.google=prior;}
});

test('search covers all sellers and dates with no platform conditions',()=>{const q=buildQuery();assert.ok(!/from:|newer_than:|after:|before:/.test(q));assert.match(q,/subject:주문/);assert.match(q,/subject:refund/);});
test('base64url handles Korean UTF-8 and arbitrary byte lengths',()=>{
  for(const s of ['한글 상품명','a','ab','abc','상품명: 커피\n수량: 2'])assert.equal(decodeBody(encode(s)),s);
});
test('multipart plain text extraction ignores attachments and preserves headers',()=>{
  const m=normalizeGmailMessage({id:'a',payload:{headers:[{name:'SUBJECT',value:'주문 완료'},{name:'From',value:'sender@example.com'}],mimeType:'multipart/mixed',parts:[{mimeType:'multipart/alternative',parts:[{mimeType:'text/plain',body:{data:encode('상품명: 컵')}}]},{filename:'secret.txt',mimeType:'text/plain',body:{data:encode('do not include')}}]}});
  assert.equal(m.text,'상품명: 컵');assert.equal(m.subject,'주문 완료');assert.equal(m.sender,'sender@example.com');
});
test('request uses Bearer header, not URL, and handles expiry',async()=>{
  let seen;await gmailRequest('TEST_TOKEN','profile',undefined,async(url,opts)=>{seen={url,opts};return {ok:true,json:async()=>({})};});
  assert.ok(!seen.url.includes('TEST_TOKEN'));assert.equal(seen.opts.headers.Authorization,'Bearer TEST_TOKEN');assert.equal(seen.opts.cache,'no-store');
  await assert.rejects(gmailRequest('t','profile',undefined,async()=>({ok:false,status:401})),/만료/);
});
test('fetch follows every page beyond 30 and preserves partial successes',async()=>{
  const visited=[];const result=await fetchOrders({token:'t'},async(token,path)=>{visited.push(path);
    if(path.startsWith('messages?'))return path.includes('pageToken=next')?{messages:[{id:'39'},{id:'40'}]}:{messages:Array.from({length:40},(_,i)=>({id:String(i)})),nextPageToken:'next'};
    if(path.includes('/2?'))throw new Error('Unavailable');return {id:path.split('/')[1].split('?')[0],payload:{mimeType:'text/plain',body:{data:encode('test')}}};
  });assert.equal(result.messages.length,40);assert.equal(result.failures.length,1);assert.equal(result.hasMore,false);assert.equal(visited.filter(p=>p.includes('/39?')).length,1);
});
test('repeated pagination token fails explicitly',async()=>{await assert.rejects(fetchOrders({token:'t'},async()=>({messages:[],nextPageToken:'loop'})),/반복/);});
test('abort prevents continuing to retrieve messages',async()=>{
  const controller=new AbortController();controller.abort();
  await assert.rejects(fetchOrders({token:'t',days:30,signal:controller.signal},async()=>({messages:[{id:'1'}]})),{name:'AbortError'});
});
test('valid UTF-8 bytes win over incorrect legacy Korean charset declarations',()=>{assert.equal(decodeBody(encode('결제일시\n주문상품명\n한글 상품'), 'euc-kr'),'결제일시\n주문상품명\n한글 상품');assert.equal(decodeBody(Buffer.from([0xb0,0xa1]).toString('base64url'),'euc-kr'),'가');});
test('transient quota failure retries and still uses the same private Authorization header',async()=>{let calls=0;const waits=[];const result=await gmailRequest('FAKE','profile',undefined,async()=>++calls<3?{ok:false,status:429}:{ok:true,status:200,json:async()=>({ready:true})},async ms=>waits.push(ms));assert.equal(result.ready,true);assert.equal(calls,3);assert.deepEqual(waits,[1000,2000]);});
test('retrying failed IDs reads only those messages, without repeating the search',async()=>{const paths=[];const r=await fetchOrders({token:'t',messageIds:['a','b','a']},async(token,path)=>{paths.push(path);return {id:path.split('/')[1].split('?')[0],payload:{mimeType:'text/plain',body:{data:encode('test')}}};});assert.equal(r.messages.length,2);assert.ok(paths.every(p=>!p.startsWith('messages?')));});
test('quota 403 reports the real reason after bounded retries',async()=>{let calls=0;await assert.rejects(gmailRequest('t','profile',undefined,async()=>{calls++;return {ok:false,status:403,clone:()=>({json:async()=>({error:{errors:[{reason:'rateLimitExceeded'}]}})})};},async()=>{}),/요청 한도.*rateLimitExceeded/);assert.equal(calls,4);});
