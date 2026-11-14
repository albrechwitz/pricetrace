import {extractMessages} from './core.js';
import {loadSnapshot,mergeMessages,saveSession,clearSession} from './storage.js';
import {loadRates} from './rates.js';
import {loadGoogleSDK,authorize,revoke,gmailRequest,fetchOrders} from './gmail.js';
import {$,node} from './ui.js';
import {connectionMarkup,homeImportMarkup,accountMarkup,guideMarkup} from './connection-template.js';

export function installConnection(context){
  const {state,render,notify,setBusy,showPage,replaceData,restoreData,snapshot,persistData,waitForSave,expireAuth,scheduleExpiry}=context;
  context.registerPage('connection',{navId:'settings-nav',label:'메일 연결',icon:'✉',order:1,markup:connectionMarkup,beforeShow:prepareSettings});
  $('home-page').querySelector('.subtitle').textContent='새로운 주문을 가져오고 저장된 구매 기록을 이어보세요.';
  $('home-content').innerHTML=homeImportMarkup;
  $('account-controls').innerHTML=accountMarkup;$('account-controls').hidden=false;
  document.body.insertAdjacentHTML('beforeend',guideMarkup);

function renderConnectionState(){
  $('source-badge').textContent=state.mode==='sample'?'샘플 데이터':state.mode==='gmail'?'Gmail 데이터':'데이터 없음';
  $('connection').textContent=state.token?state.account||'Gmail 연결됨':state.account?state.account+' · 저장된 계정':'연결된 계정 없음';
  $('connection').classList.toggle('connected',!!state.token);
  $('connect-button').textContent=state.token?'연결 관리':state.account?'Gmail 다시 연결':'Gmail 연결';
  $('disconnect-button').hidden=!state.token;
  $('connection-summary').textContent=state.token?'Gmail이 연결됐어요. Home에서 전체 주문 가져오기를 진행하세요.':state.clientId?'클라이언트 ID가 저장돼 있어요. 03단계에서 Gmail을 연결하세요.':'01 → 02 → 03 순서로 진행하세요. 이미 Google 앱이 있다면 02단계부터 시작할 수 있어요.';
  $('client-step-status').textContent=state.clientId?'클라이언트 ID 저장됨':'클라이언트 ID 미등록';
  $('auth-step-status').textContent=state.token?'Gmail 연결됨':'연결 대기';
  $('connect-page-button').textContent=state.token?'Gmail 연결됨':state.account?'Google에서 Gmail 다시 연결':'Google에서 Gmail 연결';
  $('connect-page-button').disabled=state.busy||!state.clientId||!!state.token;
  $('connect-page-help').textContent=state.token?'아래 Home으로 이동해 주문 기록을 가져오세요.':state.clientId?'테스트 사용자로 등록한 Gmail을 선택하세요.':'02단계에서 클라이언트 ID를 먼저 저장하세요.';
}
function prepareSettings(){
  $('client-id-input').value=state.clientId;
  $('current-origin').textContent=location.origin;
  $('settings-status').textContent='';
  $('copy-origin-status').textContent='';
  $('connection-notice').textContent='';renderConnectionState();
}
function settings(){showPage('connection');}
async function prepareSDK(){await loadGoogleSDK();}
function startConnect(){
  if(state.token||!state.clientId){settings();return;}
  if(!globalThis.google?.accounts?.oauth2){prepareSDK().then(()=>notify('Google 연결 준비가 끝났어요. Gmail 연결을 한 번 더 눌러주세요.')).catch(e=>notify(e.message,true));return;}
  const epoch=++state.epoch;setBusy(true);
  try{authorize(state.clientId,async(error,auth)=>{
    if(epoch!==state.epoch)return;
    if(error){setBusy(false);notify(error.message,true);return;}
    try{
      const profile=await gmailRequest(auth.token,'profile');if(epoch!==state.epoch)return;
      if(!profile.emailAddress)throw new Error('연결한 계정을 확인하지 못했어요.');
      const account=profile.emailAddress.toLowerCase();
      if(state.account!==account||state.mode!=='gmail'){await waitForSave();if(epoch!==state.epoch)return;const saved=await loadSnapshot(account).catch(()=>null);if(epoch!==state.epoch)return;state.account=account;if(saved)restoreData(saved);else{state.reviews={};state.merges={};state.savedAt=null;replaceData([],'gmail');}}
      state.token=auth.token;const expiresAt=Date.now()+Math.max(auth.expiresIn-30,1)*1000;
      try{saveSession({token:auth.token,account,clientId:state.clientId,expiresAt});}catch{}
      scheduleExpiry(expiresAt);setBusy(false);render();persistData();notify('Gmail이 연결됐어요. 전체 주문 가져오기로 구매 기록을 업데이트하세요.');
    }catch(error){if(epoch!==state.epoch)return;state.token=null;try{clearSession();}catch{}setBusy(false);render();notify(error.message,true);}

  },state.account);}catch(e){setBusy(false);notify(e.message,true);}
}
function renderFetchReport(result,conversion){const d=$('fetch-report');d.hidden=false;$('fetch-report-title').textContent=`이번 가져오기: ${result.messages.length}건 처리 · ${result.failures.length}건 실패`;const body=$('fetch-report-body');body.replaceChildren(node('p','같은 메일은 다시 가져와도 추가되지 않으며, 기존 구매 기록과 합쳐 저장합니다.'));if(result.failures.length){const list=node('ul');for(const [i,error] of result.failures.entries())list.append(node('li',`메일 ${i+1}: ${error.error}`));body.append(list);const retry=node('button','누락된 메일만 다시 가져오기','button');retry.id='retry-failed';retry.type='button';retry.addEventListener('click',()=>collectOrders(result.failures.map(f=>f.id)));body.append(retry);}if(conversion.failures.length)body.append(node('p',`환율 ${conversion.failures.length}건을 확인하지 못했습니다.`));}
context.on('save-settings','click',async()=>{
  const id=$('client-id-input').value.trim();
  if(!/^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(id)){$('settings-status').textContent='올바른 웹 애플리케이션 클라이언트 ID를 입력해주세요.';return;}
  if(state.token && id!==state.clientId){$('settings-status').textContent='클라이언트 ID를 바꾸려면 먼저 현재 Gmail 연결을 해제해주세요.';return;}
  state.clientId=id;try{localStorage.setItem('mailtrace-client-id',id);}catch{}
  $('save-settings').disabled=true;$('settings-status').textContent='Google 연결 모듈을 준비하고 있어요…';
  try{await prepareSDK();$('settings-status').textContent='클라이언트 ID를 저장했어요. 아래 03단계에서 Gmail을 연결하세요.';renderConnectionState();}catch(e){$('settings-status').textContent='ID는 저장됐지만 연결 모듈을 준비하지 못했어요. '+e.message;renderConnectionState();}finally{$('save-settings').disabled=false;}
});
context.on('connect-button','click',startConnect);
context.on('connect-page-button','click',startConnect);context.on('go-home','click',()=>showPage('home'));
context.on('connection-help','click',settings);
context.on('copy-origin','click',async()=>{
  try{await navigator.clipboard.writeText(location.origin);$('copy-origin-status').textContent='주소를 복사했어요.';}
  catch{$('copy-origin-status').textContent='복사를 허용하지 않는 브라우저예요. 위 주소를 선택해서 복사해주세요.';}
});
context.on('fetch-form','submit',e=>{e.preventDefault();collectOrders();});
async function collectOrders(messageIds){
  if(state.busy)return;if(!state.token){notify('먼저 Gmail을 연결해주세요. 샘플 데이터는 아래에서 바로 확인할 수 있어요.');startConnect();return;}
  const controller=new AbortController();state.controller=controller;const epoch=++state.epoch;setBusy(true);notify('주문 메일을 검색하고 있어요…');
  try{
    const result=await fetchOrders({token:state.token,signal:controller.signal,messageIds,onProgress:(n,total,phase)=>notify(phase==='search'?`전체 주문 검색 중 · ${total}건 발견`:`메일을 읽고 있어요 · ${n} / ${total}건`)});
    if(epoch!==state.epoch)return;
    await waitForSave();
    const previous=state.mode==='gmail'?snapshot():(await loadSnapshot(state.account))||{messages:[],rates:[],reviews:{},merges:{}};
    if(epoch!==state.epoch)return;
    const messages=mergeMessages(previous.messages,result.messages);
    const rows=extractMessages(messages);
    const conversion=await loadRates(rows,controller.signal,(n,total)=>notify(`구매일 환율 확인 중 · ${n} / ${total}건`));
    if(epoch!==state.epoch)return;
    if(!result.messages.length&&result.failures.length){renderFetchReport(result,conversion);notify(`메일을 읽지 못했어요. 기존 결과는 유지돼요. ${result.failures[0].error}`,true);return;}
    state.reviews=previous.reviews||{};state.merges=previous.merges||{};
    replaceData(messages,'gmail',new Map([...(previous.rates||[]),...conversion.rates]),rows);
    renderFetchReport(result,conversion);
    await persistData();
    notify(`주문·결제 이력을 정리했어요.${result.failures.length?` 메일 ${result.failures.length}건을 읽지 못해 결과가 일부 누락됐어요.`:''}${conversion.failures.length?` 환율 ${conversion.failures.length}건은 확인하지 못했어요.`:''}${!result.messages.length?' 주문 관련 검색 결과가 없어요.':''}`,!!result.failures.length);

  }catch(error){if(epoch===state.epoch)notify(error.name==='AbortError'?'가져오기를 취소했어요. 기존 결과는 유지돼요.':error.message,error.name!=='AbortError');if(epoch===state.epoch&&/만료/.test(error.message))expireAuth(false);}
  finally{if(epoch===state.epoch){state.controller=null;setBusy(false);render();}}
}
context.on('cancel-button','click',()=>state.controller?.abort());
context.on('disconnect-button','click',()=>{state.epoch++;state.controller?.abort();revoke(state.token);expireAuth(false);setBusy(false);render();notify('Gmail 연결을 해제했어요. 저장된 구매 기록은 계속 볼 수 있어요.');});

  context.on('guide-button','click',()=>$('guide-dialog').showModal());
  context.onRender(renderConnectionState);
  context.onBusy(busy=>{
    for(const id of ['fetch-button','connect-button'])$(id).disabled=busy;
    if($('retry-failed'))$('retry-failed').disabled=busy;
    $('cancel-button').hidden=!busy;renderConnectionState();
  });
  context.onReady(()=>{if(state.clientId)prepareSDK().catch(()=>{});});
}
