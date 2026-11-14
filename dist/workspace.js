import {extractMessages,VERSION,stableTextKey} from './core.js';
import {buildCatalog} from './catalog.js';
import {saveSnapshot,loadSnapshot,loadSession,clearSession} from './storage.js';
import {$,node} from './ui.js';

// Features register their own pages and hooks. Storage is a real shared service.
export function createWorkspace(){
  const state={mode:'empty',messages:[],rows:[],rates:new Map(),catalog:null,expanded:new Set(),filter:'all',search:'',selected:null,token:null,expires:null,controller:null,busy:false,epoch:0,account:'',clientId:'',savedAt:null,saveError:'',reviews:{},merges:{}};
  try{state.clientId=localStorage.getItem('mailtrace-client-id')||'';}catch{}
  const pages=new Map(),renderHooks=[],busyHooks=[],readyHooks=[];
  let saveQueue=Promise.resolve();
  const reviewKey=r=>`${VERSION}:${r.id}:${stableTextKey(JSON.stringify([r.product,r.quantity,r.unitPrice,r.retailPrice,r.salePrice,r.lineTotal]))}`;
  const context={state,registerPage,onRender,onBusy,onReady,on,render,setBusy,notify,showPage,replaceData,reviewKey,snapshot,restoreData,persistData,waitForSave,renderCacheStatus,expireAuth,scheduleExpiry,start,hasPage:page=>pages.has(page)};

  function on(id,type,handler){
    // Home gains its import controls in the mail feature; delegated bindings survive that update.
    document.addEventListener(type,event=>{const target=$(id);if(target&&(event.target===target||target.contains(event.target)))handler(event);});
  }
  function onRender(fn){renderHooks.push(fn);}
  function onBusy(fn){busyHooks.push(fn);}
  function onReady(fn){readyHooks.push(fn);}
  function registerPage(id,{navId,label,icon,order,markup,beforeShow}){
    if(pages.has(id))throw new Error('Page already registered: '+id);
    if(markup)$('main').insertAdjacentHTML('beforeend',markup); // authored static templates only
    if(!$(id+'-page'))throw new Error('Page markup missing: '+id);
    const button=node('button',null,'nav-item');button.id=navId;button.type='button';
    const glyph=node('span',icon);glyph.setAttribute('aria-hidden','true');button.append(glyph,document.createTextNode(label));
    if(id==='tracking'){const count=node('span','0','nav-count');count.id='nav-count';button.append(count);}
    pages.set(id,{navId,label,order,beforeShow,button});
    $('primary-nav').replaceChildren(...[...pages.values()].sort((a,b)=>a.order-b.order).map(page=>page.button));
    on(navId,'click',()=>showPage(id));
    refreshPageLinks();
  }
  function refreshPageLinks(){for(const element of document.querySelectorAll('[data-requires-page]'))element.hidden=!pages.has(element.dataset.requiresPage);}
  function showPage(id){
    if(!pages.has(id))return;
    pages.get(id).beforeShow?.();
    for(const [key,page] of pages){const active=key===id;$(key+'-page').hidden=!active;page.button.classList.toggle('active',active);if(active)page.button.setAttribute('aria-current','page');else page.button.removeAttribute('aria-current');}
    $('breadcrumb-page').textContent=pages.get(id).label;
    $(id+'-title')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});
  }
  function notify(text,error=false){for(const id of ['notice','connection-notice','tracking-notice','workspace-notice']){const target=$(id);if(target){target.textContent=text;target.classList.toggle('error',error);}}}
  function setBusy(busy){state.busy=busy;for(const hook of busyHooks)hook(busy);}
  function renderCacheStatus(){
    const savedText=state.savedAt?new Date(state.savedAt).toLocaleString('ko-KR'):'저장된 기록 없음';
    $('saved-time').textContent=savedText;if(state.savedAt)$('saved-time').dateTime=state.savedAt;else $('saved-time').removeAttribute('datetime');
    $('sidebar-save-status').textContent=state.saveError||'';$('sidebar-save-status').classList.toggle('error',!!state.saveError);
    if($('cache-status'))$('cache-status').textContent=state.saveError||(state.mode==='sample'?'샘플 모드 · 실제 저장 기록은 유지됩니다.':state.savedAt?`이 브라우저에 저장됨 · ${savedText}`:'가져온 기록은 이 브라우저에 자동 저장됩니다.');
  }
  function render(){
    state.catalog=buildCatalog(state.rows,state.rates,state.merges,state.reviews);
    renderCacheStatus();
    if($('workspace-record-count'))$('workspace-record-count').textContent=`저장된 구매 상품 ${state.catalog.summary.products}개`;
    for(const hook of renderHooks)hook();
    refreshPageLinks();
  }
  function replaceData(messages,mode,rates=new Map(),rows=extractMessages(messages)){
    state.messages=messages;state.rows=rows;state.rates=rates;state.mode=mode;
    if(mode==='gmail')for(const row of rows)row.verified=!!state.reviews[reviewKey(row)];
    state.selected=null;state.expanded.clear();state.filter='all';state.search='';
    if($('search-input'))$('search-input').value='';if($('detail-dialog')?.open)$('detail-dialog').close();render();
  }
  function snapshot(){return {account:state.account,messages:state.messages,rates:[...state.rates],reviews:state.reviews,merges:state.merges,savedAt:new Date().toISOString()};}
  function waitForSave(){return saveQueue.catch(()=>{});}
  async function persistData(){
    if(state.mode!=='gmail'||!state.account)return;
    const value=snapshot();if($('cache-status'))$('cache-status').textContent='브라우저에 저장 중…';$('sidebar-save-status').textContent='저장 중…';
    const operation=saveQueue.catch(()=>{}).then(()=>saveSnapshot(value));saveQueue=operation;
    try{const saved=await operation;if(state.account===saved.account){state.savedAt=saved.savedAt;state.saveError='';renderCacheStatus();}}
    catch{state.saveError=pages.has('storage')?'저장 실패 · 현재 화면만 유지됩니다. 기록 보관에서 백업해주세요.':'저장 실패 · 현재 화면만 유지됩니다.';renderCacheStatus();}
  }
  function restoreData(saved){state.account=saved.account;state.reviews=saved.reviews||{};state.merges=saved.merges||{};state.savedAt=saved.savedAt;state.saveError='';replaceData(saved.messages,'gmail',new Map(saved.rates||[]));renderCacheStatus();}
  function expireAuth(announce=true){state.token=null;clearTimeout(state.expires);try{clearSession();}catch{}render();if(announce)notify('Google 인증이 만료됐어요. 저장된 기록은 유지되며, 새 메일을 가져올 때 다시 연결하면 됩니다.');}
  function scheduleExpiry(expiresAt){clearTimeout(state.expires);state.expires=setTimeout(()=>{state.epoch++;state.controller?.abort();setBusy(false);expireAuth();},Math.max(1,expiresAt-Date.now()));}
  async function start(){
    const epoch=state.epoch;setBusy(true);
    try{
      let session;try{session=loadSession(state.clientId);}catch{}
      const saved=await loadSnapshot(session?.account);if(epoch!==state.epoch)return;
      if(saved)restoreData(saved);else if(context.sample)context.sample();else replaceData([],'empty');
      if(session){state.account=session.account;state.token=session.token;scheduleExpiry(session.expiresAt);render();notify(pages.has('connection')?'Gmail이 연결되어 있어요. 전체 주문 가져오기로 업데이트하세요.':'저장된 구매 기록을 불러왔어요.');}
      else if(saved)notify(pages.has('connection')?'새 주문을 가져오려면 Gmail을 다시 연결하세요.':'저장된 구매 기록을 불러왔어요.');
    }catch(error){
      if(context.sample)context.sample();else replaceData([],'empty');
      state.saveError=pages.has('storage')?'브라우저 저장소를 열지 못했어요. 가져온 기록은 백업으로 보관해주세요.':'브라우저 저장소를 열지 못했어요.';renderCacheStatus();notify(error.message,true);
    }finally{setBusy(false);}
    showPage(pages.has('tracking')?'tracking':'home');
    for(const hook of readyHooks)await hook();
  }
  registerPage('home',{navId:'nav-home',label:'Home',icon:'⌂',order:0});
  document.addEventListener('click',event=>{
    const page=event.target.closest('[data-page]');if(page)showPage(page.dataset.page);
    const close=event.target.closest('[data-close]');if(close)$(close.dataset.close)?.close();
    if(event.target instanceof HTMLDialogElement){const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();}
  });
  return context;
}
