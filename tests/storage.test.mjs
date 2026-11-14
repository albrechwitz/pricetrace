import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanSnapshot,mergeMessages,encodeBackup,decodeBackup,saveSession,loadSession,clearSession} from '../dist/storage.js';
test('saved snapshot whitelists message data and cannot persist OAuth credentials',()=>{
  const data=cleanSnapshot({account:'Demo@Example.com',token:'SECRET',clientSecret:'SECRET',messages:[{id:'m1',text:'order',token:'SECRET',subject:'receipt'}],reviews:{'r1':true},merges:{a:'b'},rates:[]});assert.equal(data.account,'demo@example.com');assert.ok(!JSON.stringify(data).includes('SECRET'));assert.equal(decodeBackup(encodeBackup(data)).messages.length,1);
});
test('repeated sync updates a message by ID while preserving previously fetched records',()=>{
  const merged=mergeMessages([{id:'a',text:'old'},{id:'b',text:'retained'}],[{id:'a',text:'fixed charset'},{id:'a',text:'latest'}]);assert.equal(merged.length,2);assert.equal(merged[0].text,'latest');assert.equal(merged[1].text,'retained');
});
test('corrupt backups fail explicitly before modifying cached records',()=>{assert.throws(()=>decodeBackup('{'),/JSON/);assert.throws(()=>decodeBackup('{"format":"other"}'),/지원/);assert.throws(()=>cleanSnapshot({account:'a',messages:[{id:'x'}]}),/메일 형식/);});
test('tab session restores only the same client and only before the original expiration',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};const auth={token:'FAKE',account:'demo@example.com',clientId:'client',expiresAt:Date.now()+120000};saveSession(auth,storage);assert.equal(loadSession('client',storage).token,'FAKE');assert.equal(loadSession('other',storage),null);saveSession({...auth,expiresAt:Date.now()-1},storage);assert.equal(loadSession('client',storage),null);saveSession(auth,storage);clearSession(storage);assert.equal(values.size,0);
});
