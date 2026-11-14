import test from 'node:test';
import assert from 'node:assert/strict';
import {checkRoute,checkCommitSubject,sensitivePath,containsCredential,isDocumentationOnly,scanCommitHistory} from './check-repository.mjs';

const sameRepo={baseRepository:'owner/pricetrace',headRepository:'owner/pricetrace'};
test('main accepts only stage from the same repository',()=>{
  assert.doesNotThrow(()=>checkRoute({...sameRepo,baseRef:'main',headRef:'stage'}));
  for(const headRef of ['feat/price-tracking','docs/development-workflow','main','Stage']){
    assert.throws(()=>checkRoute({...sameRepo,baseRef:'main',headRef}));
  }
  assert.throws(()=>checkRoute({...sameRepo,baseRef:'main',headRef:'stage',headRepository:'other/pricetrace'}));
});
test('stage accepts standard task branches and refuses bypass routes',()=>{
  for(const headRef of ['feat/price-tracking','fix/mail-errors','refactor/views','docs/guide','test/receipts','chore/git-pipeline']){
    assert.doesNotThrow(()=>checkRoute({...sameRepo,baseRef:'stage',headRef}));
  }
  for(const headRef of ['main','stage','feature/test','feat/Uppercase','feat/a;echo','feat/']){
    assert.throws(()=>checkRoute({...sameRepo,baseRef:'stage',headRef}));
  }
  assert.throws(()=>checkRoute({...sameRepo,baseRef:'unknown',headRef:'feat/price-tracking'}));
  assert.throws(()=>checkRoute({...sameRepo,baseRef:'stage',headRef:'feat/price-tracking',headRepository:null}));
});
test('commit subjects preserve the declared type and optional scope conventions',()=>{
  for(const subject of ['feat(parser): import order evidence','docs: 작업 규약 기록','fix(storage)!: change the backup schema']){
    assert.doesNotThrow(()=>checkCommitSubject(subject));
  }
  for(const subject of ['Update files','feat: ','unknown: test','feat(parser) test'])assert.throws(()=>checkCommitSubject(subject));
});
test('private runtime paths are rejected while reproducible source remains allowed',()=>{
  for(const path of ['.env','.env.local','x/.env.production','token-account.json','credentials.json','data/mail.json','backups/saved.json','mailtrace-backup-1.json','.openai/hosting.json','private.eml','account.sqlite'])assert.equal(sensitivePath(path),true,path);
  for(const path of ['.env.example','dist/demo-mails.js','tests/storage.test.mjs','docs/INTEGRATION_PLAN.md','validation.json'])assert.equal(sensitivePath(path),false,path);
});
test('credential patterns are detected without depending on a real credential fixture',()=>{
  for(const token of ['github'+'_pat_'+ 'a'.repeat(30),'gh'+'p_'+ 'b'.repeat(30),'GOC'+'SPX-'+ 'c'.repeat(20),'AI'+'za'+ 'd'.repeat(35),'-----BEGIN '+'PRIVATE KEY-----'])assert.equal(containsCredential(token),true);
  assert.equal(containsCredential("Authorization: 'Bearer ' + token"),false);
  assert.equal(containsCredential('https://accounts.google.com/gsi/client'),false);
});

test('documentation changes skip app tests even when app files exist',()=>{
  assert.equal(isDocumentationOnly(['README.md','AGENTS.md','docs/INTEGRATION_PLAN.md','.github/PULL_REQUEST_TEMPLATE.md']),true);
  for(const changed of [[],['README.md','dist/app.js'],['dist/styles.css'],['package.json'],['.github/workflows/repository-checks.yml'],['tests/browser.html']])assert.equal(isDocumentationOnly(changed),false);
});

test('history scan catches a secret introduced only by a merge and removed later',()=>{
  const reads=[];
  const readGit=(...args)=>{
    reads.push(args);
    if(args[0]==='rev-list')return 'later-clean-commit\nmerge-resolution-commit\nordinary-commit\n';
    if(args[0]==='diff-tree'){
      assert.ok(args.includes('-m'),'Merge resolution must be compared with all parents.');
      return 'dist/config.js\0';
    }
    if(args[0]==='show')return args[1].startsWith('merge-resolution-commit:')?'github'+'_pat_'+ 'a'.repeat(30):'export const config = {};';
    throw new Error('Unexpected read command.');
  };
  assert.throws(()=>scanCommitHistory('base','head',readGit),/Credential pattern detected/);
  assert.ok(reads.some(args=>args[0]==='show'&&args[1].startsWith('merge-resolution-commit:')));
  assert.equal(reads.find(args=>args[0]==='rev-list').includes('--no-merges'),false);
});

test('history scan accepts clean merge histories and inspects duplicate merge paths once',()=>{
  let blobsRead=0;
  const readGit=(...args)=>{
    if(args[0]==='rev-list')return 'merge\n';
    if(args[0]==='diff-tree')return 'README.md\0README.md\0';
    if(args[0]==='show'){blobsRead++;return '# PriceTrace\n';}
    throw new Error('Unexpected read command.');
  };
  assert.equal(scanCommitHistory('base','head',readGit),1);
  assert.equal(blobsRead,1);
});
