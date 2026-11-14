import {htmlContent} from './mail-html.js';
export {htmlContent} from './mail-html.js';
const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
let sdkPromise;
export function loadGoogleSDK() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true; script.defer = true;
    const timer = setTimeout(() => { script.remove(); sdkPromise = null; reject(new Error('Google 연결 모듈을 불러오지 못했어요. 네트워크를 확인해주세요.')); }, 15000);
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); script.remove(); sdkPromise = null; reject(new Error('Google 연결 모듈을 불러오지 못했어요.')); };
    document.head.append(script);
  });
  return sdkPromise;
}
export function authorize(clientId, callback,account='') {
  if (!globalThis.google?.accounts?.oauth2) throw new Error('Google 연결 준비 후 다시 눌러주세요.');
  const client = google.accounts.oauth2.initTokenClient({
    client_id: clientId, scope: SCOPE, include_granted_scopes: false,
    callback: response => {
      if (response.error) return callback(new Error('메일 접근이 허용되지 않았어요. 다시 연결할 수 있어요.'));
      if (!google.accounts.oauth2.hasGrantedAllScopes(response, SCOPE)) return callback(new Error('Gmail 읽기 권한이 필요해요.'));
      callback(null, {token: response.access_token, expiresIn: Number(response.expires_in) || 3600});
    },
    error_callback: e => callback(new Error(e.type === 'popup_closed' ? '연결 창을 닫았어요. 준비되면 다시 연결해주세요.' : '연결 창을 열지 못했어요. 팝업 허용 여부를 확인해주세요.'))
  });
  client.requestAccessToken(account?{prompt:'',hint:account}:{prompt:'select_account'});
}
export function revoke(token) {
  if (token && globalThis.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token, () => {});
}
export function pause(ms,signal){return new Promise((resolve,reject)=>{signal?.throwIfAborted();const finish=()=>{signal?.removeEventListener('abort',abort);resolve();};const timer=setTimeout(finish,ms);function abort(){clearTimeout(timer);reject(signal.reason||new DOMException('Cancelled','AbortError'));}signal?.addEventListener('abort',abort,{once:true});});}
export async function gmailRequest(token, path, signal, fetchImpl = fetch, wait=pause) {
  let response, reason='';
  for(let attempt=0;attempt<4;attempt++){
    signal?.throwIfAborted();
    try{response=await fetchImpl(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${token}` }, signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(20000)]), cache:'no-store' });}
    catch(error){if(signal?.aborted||attempt===3)throw error;await wait(1000*2**attempt,signal);continue;}
    let rateLimited=response.status===429||response.status>=500;
    if(response.status===403){try{const data=await response.clone().json();reason=(data.error?.errors||[]).map(e=>e.reason).filter(v=>/^[a-zA-Z_]+$/.test(v)).join(', ')||data.error?.status||'';rateLimited=/ratelimit|quota|RESOURCE_EXHAUSTED/i.test(reason);}catch{}}
    if(!rateLimited||attempt===3)break;
    const retry=Number(response.headers?.get('retry-after'));await wait(Math.min(30000,retry>0?retry*1000:1000*2**attempt),signal);
  }
  if (!response.ok) {
    if (response.status === 401) throw new Error('연결이 만료됐어요. Gmail을 다시 연결해주세요.');
    if (response.status === 403) throw new Error(/ratelimit|quota|RESOURCE_EXHAUSTED/i.test(reason)?`Google 요청 한도에 도달했어요. 잠시 후 누락된 메일을 다시 가져와주세요. (${reason})`:`Google이 이 요청을 거부했어요. (${reason||'HTTP 403'})`);
    if (response.status === 429) throw new Error('요청이 많아 잠시 제한됐어요. 잠시 후 다시 시도해주세요.');
    throw new Error(`메일을 가져오지 못했어요 (HTTP ${response.status}). 다시 시도해주세요.`);
  }
  return response.json();
}
export function buildQuery() {
  return '{subject:주문 subject:결제 subject:영수증 subject:구매 subject:환불 subject:order subject:receipt subject:purchase subject:payment subject:refund}';
}
export function decodeBody(value, charset='utf-8') {
  const normalized = String(value || '').replaceAll('-','+').replaceAll('_','/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length/4)*4, '='));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  // Some gateways declare EUC-KR while delivering UTF-8. Validate the actual bytes first.
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{}
  const candidates=[charset,'euc-kr','windows-1252'].map(label=>{try{return new TextDecoder(label).decode(bytes);}catch{return null;}}).filter(v=>v!==null);
  candidates.sort((a,b)=>(a.match(/\uFFFD/g)||[]).length-(b.match(/\uFFFD/g)||[]).length);
  return candidates[0]||new TextDecoder().decode(bytes);
}
export function normalizeGmailMessage(message) {
  const headers = message.payload?.headers || [];
  const header = name => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  const plain = [], html = [];
  function visit(part) {
    if (part.filename) return; // attachments are deliberately outside this MVP
    if (part.body?.data) {
      const ct = part.headers?.find(h => h.name.toLowerCase() === 'content-type')?.value || '';
      const charset = ct.match(/charset\s*=\s*"?([^";\s]+)/i)?.[1] || 'utf-8';
      if (part.mimeType === 'text/plain') plain.push(decodeBody(part.body.data, charset));
      if (part.mimeType === 'text/html') html.push(decodeBody(part.body.data, charset));
    }
    for (const child of part.parts || []) visit(child);
  }
  visit(message.payload || {});
  const parsed = html.map(htmlContent);
  const htmlText=parsed.map(p=>p.text).join('\n');
  return {id:message.id, subject:header('Subject'),sender:header('From'),receivedAt:header('Date')||(message.internalDate?new Date(Number(message.internalDate)).toISOString():null),text:plain.length ? plain.join('\n') : htmlText,htmlText,tables:parsed.flatMap(p=>p.tables),orderIds:[...new Set(parsed.flatMap(p=>p.orderIds))],structured:parsed.flatMap(p => p.structured)};
}
export async function fetchOrders({token,signal,onProgress,messageIds}, request=gmailRequest) {
  const q=buildQuery(), ids=new Set(messageIds||[]), pages=new Set();let page;
  if(!messageIds)do {
    signal?.throwIfAborted();
    const listing=await request(token,`messages?maxResults=100&q=${encodeURIComponent(q)}${page?`&pageToken=${encodeURIComponent(page)}`:''}`,signal);
    for(const item of listing.messages||[])if(item.id)ids.add(item.id);
    onProgress?.(0,ids.size,'search');
    page=listing.nextPageToken;
    if(page&&pages.has(page))throw new Error('검색 페이지가 반복돼 가져오기를 중단했어요. 다시 시도해주세요.');
    if(page)pages.add(page);
  }while(page);
  const messages=[],failures=[],queue=[...ids];let completed=0;
  await Promise.all(Array.from({length:Math.min(3,queue.length)},async()=>{
    while(queue.length){
      signal?.throwIfAborted();const id=queue.shift();
      try{const raw=await request(token,`messages/${encodeURIComponent(id)}?format=full`,signal);
        async function body(part){if(part.filename)return;if(!part.body?.data&&part.body?.attachmentId&&/^text\/(plain|html)$/.test(part.mimeType)){const data=await request(token,`messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(part.body.attachmentId)}`,signal);part.body.data=data.data;}for(const child of part.parts||[])await body(child);}await body(raw.payload||{});
        messages.push(normalizeGmailMessage(raw));}
      catch(error){if(signal?.aborted||error.name==='AbortError')throw error;failures.push({id,error:error.message});}
      onProgress?.(++completed,ids.size,'read');
    }
  }));
  return {messages,failures,query:q,hasMore:false};
}
