import test from 'node:test';
import assert from 'node:assert/strict';
import {installStorage} from '../dist/storage-page.js';
import {cleanSnapshot,decodeBackup,encodeBackup,mergeMessages} from '../dist/storage.js';

const account='records@example.invalid';
const saved=(messages=[{id:'before',text:'기존 가상 주문'}],extra={})=>cleanSnapshot({account,messages,rates:[],reviews:{before:true},merges:{},savedAt:'2026-11-14T00:00:00.000Z',...extra});
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}

function harness(t,{prior=saved(),wait=Promise.resolve(),token=null,saveError=null}={}){
  const fields=new Map(['storage-info','backup-button','clear-button','restore-button','restore-file','restore-text','storage-result'].map(id=>[id,{value:'',textContent:'',disabled:false,hidden:false}]));
  const priorDocument=globalThis.document;globalThis.document={getElementById:id=>fields.get(id)};t.after(()=>{globalThis.document=priorDocument;});
  const handlers=new Map(),renders=[],busyHooks=[],calls=[];
  const state={mode:'gmail',account,token,busy:false,epoch:4,messages:prior.messages,reviews:prior.reviews,merges:prior.merges,rates:new Map(),savedAt:prior.savedAt,saveError:'',controller:{abort(){calls.push('abort');}}};
  let persisted=prior;
  const repository={decodeBackup,encodeBackup,mergeMessages,
    async loadSnapshot(requested){calls.push(['load',requested]);return persisted;},
    async saveSnapshot(data){calls.push('save');if(saveError)throw saveError;persisted=cleanSnapshot(data);return persisted;},
    async removeSnapshot(requested){calls.push(['remove',requested]);persisted=null;}
  };
  const context={state,registerPage(){},on(id,type,fn){handlers.set(`${id}:${type}`,fn);},onRender(fn){renders.push(fn);},onBusy(fn){busyHooks.push(fn);},renderCacheStatus(){},
    snapshot(){return {...state,rates:[...state.rates]};},
    restoreData(data){calls.push('restore');Object.assign(state,{...data,mode:'gmail',rates:new Map(data.rates),saveError:''});for(const fn of renders)fn();},
    replaceData(messages,mode){Object.assign(state,{messages,mode});for(const fn of renders)fn();},
    waitForSave(){calls.push('wait');return wait;},
    setBusy(value){state.busy=value;calls.push(['busy',value]);for(const fn of busyHooks)fn(value);},
    notify(text){calls.push(['notice',text]);},
    expireAuth(){calls.push('expire');state.token=null;}
  };
  installStorage(context,repository);
  return {state,fields,calls,handlers,persisted:()=>persisted,setPersisted(value){persisted=value;},restore(text){fields.get('restore-text').value=text;return handlers.get('restore-button:click')();}};
}

test('invalid or foreign-account backup leaves state, collection and saved records untouched',async t=>{
  const h=harness(t,{token:'test-session'}),before=h.state.messages;
  await h.restore('{invalid');
  assert.deepEqual(h.calls,[]);assert.equal(h.state.epoch,4);assert.equal(h.state.busy,false);assert.equal(h.state.messages,before);
  assert.match(h.fields.get('storage-result').textContent,/JSON 형식/);
  await h.restore(encodeBackup(saved([{id:'foreign',text:'가상 기록'}],{account:'other@example.invalid'})));
  assert.deepEqual(h.calls,[]);assert.equal(h.state.epoch,4);assert.equal(h.state.messages,before);assert.equal(h.persisted().account,account);
  assert.match(h.fields.get('storage-result').textContent,/다른 계정/);
});

test('restore waits for queued persistence then merges the latest record and retained decisions',async t=>{
  const pending=deferred(),h=harness(t,{wait:pending.promise});
  const importing=saved([{id:'imported',text:'백업 가상 주문'}],{reviews:{imported:true},merges:{receipt:'imported'}});
  const operation=h.restore(encodeBackup(importing));
  assert.equal(h.state.busy,true);assert.equal(h.state.epoch,5);assert.equal(h.state.controller,null);
  assert.deepEqual(h.calls,['abort',['busy',true],'wait']);assert.equal(h.persisted().messages[0].id,'before');
  h.setPersisted(saved([{id:'latest-write',text:'대기 중이던 가상 저장'}],{reviews:{latest:true},merges:{prior:'latest-write'}}));pending.resolve();await operation;
  assert.deepEqual(h.persisted().messages.map(m=>m.id),['latest-write','imported']);
  assert.deepEqual(h.persisted().reviews,{latest:true,imported:true});assert.deepEqual(h.persisted().merges,{prior:'latest-write',receipt:'imported'});
  assert.equal(h.state.busy,false);assert.equal(h.state.mode,'gmail');assert.equal(h.fields.get('restore-text').value,'');assert.equal(h.fields.get('backup-button').disabled,false);
});

test('failed storage write preserves the current records and releases the busy state',async t=>{
  const h=harness(t,{saveError:new Error('synthetic storage failure')}),before=h.state.messages;
  await h.restore(encodeBackup(saved([{id:'imported',text:'가상 주문'}])));
  assert.equal(h.state.messages,before);assert.equal(h.persisted().messages,before);assert.equal(h.state.busy,false);assert.ok(!h.calls.includes('restore'));
  assert.equal(h.fields.get('storage-result').textContent,'synthetic storage failure');
});

test('delete waits for queued persistence and cannot delete the account while viewing a sample',async t=>{
  const pending=deferred(),h=harness(t,{wait:pending.promise});
  h.state.mode='sample';await h.handlers.get('clear-button:click')();assert.deepEqual(h.calls,[]);assert.notEqual(h.persisted(),null);
  h.state.mode='gmail';const operation=h.handlers.get('clear-button:click')();
  assert.equal(h.state.busy,true);assert.ok(!h.calls.some(call=>Array.isArray(call)&&call[0]==='remove'));
  h.setPersisted(saved([{id:'queued',text:'대기 저장'}]));pending.resolve();await operation;
  assert.equal(h.persisted(),null);assert.equal(h.state.mode,'empty');assert.deepEqual(h.state.messages,[]);assert.equal(h.state.busy,false);
  assert.deepEqual(h.calls.find(call=>Array.isArray(call)&&call[0]==='remove'),['remove',account]);
});

test('a superseding operation prevents a pending restore from loading or replacing its records',async t=>{
  const pending=deferred(),h=harness(t,{wait:pending.promise});
  const operation=h.restore(encodeBackup(saved([{id:'imported',text:'가상 주문'}])));
  h.state.epoch++;h.state.busy=true;h.state.account='new-session@example.invalid';pending.resolve();await operation;
  assert.ok(!h.calls.some(call=>Array.isArray(call)&&call[0]==='load'));assert.ok(!h.calls.includes('save'));assert.ok(!h.calls.includes('restore'));
  assert.equal(h.state.account,'new-session@example.invalid');assert.equal(h.state.busy,true);
});
