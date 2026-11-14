import * as recordStorage from './storage.js';
import {$,node} from './ui.js';
import {storageMarkup} from './storage-template.js';

export function installStorage(context,repository=recordStorage){
  const {state,registerPage,onRender,onBusy,on,renderCacheStatus,snapshot,restoreData,replaceData,waitForSave,setBusy,notify,expireAuth}=context;
  const {saveSnapshot,loadSnapshot,removeSnapshot,mergeMessages,encodeBackup,decodeBackup}=repository;

  function renderStorageState(){
    $('storage-info').textContent=state.mode==='gmail'?`${state.account} · 메일 ${state.messages.length}건 · 이 브라우저에 보관`:state.mode==='sample'&&state.account?'샘플을 보고 있어요. 실제 기록을 백업하려면 가격 추적에서 내 기록으로 돌아가세요.':'Gmail 기록을 가져오거나 백업을 복원할 수 있어요.';
    $('backup-button').disabled=state.busy||state.mode!=='gmail';
    $('clear-button').hidden=state.mode==='sample';
    for(const id of ['restore-button','restore-file','clear-button'])$(id).disabled=state.busy;
  }

  registerPage('storage',{navId:'nav-storage',label:'보관 · 복원',icon:'⚙',order:3,markup:storageMarkup,beforeShow(){renderStorageState();renderCacheStatus();}});
  onRender(renderStorageState);onBusy(renderStorageState);

  on('backup-button','click',()=>{
    if(state.busy||state.mode!=='gmail')return;
    const blob=new Blob([encodeBackup(snapshot())],{type:'application/json'}),url=URL.createObjectURL(blob),link=node('a');
    link.href=url;link.download=`mailtrace-backup-${new Date().toISOString().slice(0,10)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    $('storage-result').textContent='백업 파일에는 메일 원문이 포함되어 있어요.';
  });

  async function restoreBackupText(text){
    if(state.busy)return;
    let data;
    try{
      data=decodeBackup(text);
      if(state.token&&state.account!==data.account)throw new Error('다른 계정의 백업입니다. Gmail 연결을 먼저 해제해주세요.');
    }catch(error){$('storage-result').textContent=error.message;return;}

    // Validate before changing state, then finish prior saves before merging the backup.
    const epoch=++state.epoch;state.controller?.abort();state.controller=null;setBusy(true);
    try{
      await waitForSave();if(epoch!==state.epoch)return;
      const prior=await loadSnapshot(data.account);if(epoch!==state.epoch)return;
      if(prior){data.messages=mergeMessages(prior.messages,data.messages);data.rates=[...new Map([...prior.rates,...data.rates])];data.reviews={...prior.reviews,...data.reviews};data.merges={...prior.merges,...data.merges};}
      data.savedAt=new Date().toISOString();await saveSnapshot(data);if(epoch!==state.epoch)return;
      if(state.account!==data.account)expireAuth(false);
      restoreData(data);$('restore-text').value='';$('storage-result').textContent=`메일 ${data.messages.length}건을 복원하고 이 브라우저에 저장했어요.`;
      $('storage-info').textContent=`${data.account} · 메일 ${data.messages.length}건`;notify('Gmail 연결 후 새 주문을 가져올 수 있습니다.');
    }catch(error){if(epoch===state.epoch)$('storage-result').textContent=error.message;}
    finally{if(epoch===state.epoch)setBusy(false);}
  }

  on('restore-button','click',()=>restoreBackupText($('restore-text').value));
  on('restore-file','change',async event=>{
    const input=event.target,file=input.files?.[0],epoch=state.epoch;
    try{if(file&&!state.busy){const text=await file.text();if(epoch===state.epoch)await restoreBackupText(text);}}
    catch(error){if(epoch===state.epoch)$('storage-result').textContent=error.message;}
    finally{input.value='';}
  });
  on('clear-button','click',async()=>{
    if(state.busy||state.mode==='sample')return;
    const account=state.account,epoch=++state.epoch;state.controller?.abort();state.controller=null;setBusy(true);
    try{
      await waitForSave();if(epoch!==state.epoch)return;
      if(account)await removeSnapshot(account);if(epoch!==state.epoch)return;
      state.reviews={};state.merges={};state.savedAt=null;state.saveError='';replaceData([],'empty');
      $('storage-result').textContent='이 계정의 브라우저 구매 기록을 지웠어요. Gmail 원본은 그대로입니다.';notify($('storage-result').textContent);
    }catch(error){if(epoch===state.epoch){$('storage-result').textContent='저장된 기록을 지우지 못했어요. '+error.message;notify($('storage-result').textContent,true);}}
    finally{if(epoch===state.epoch)setBusy(false);}
  });
  renderStorageState();
}
